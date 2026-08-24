import { NextResponse } from 'next/server'
import { Connection, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import type { Address, Hex } from 'viem'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getShopItem } from '@/lib/shop/catalog'
import { shopOrderId, isValidNonce } from '@/lib/shop/orders'
import { grantPurchase, hasUnlock, isOrderFulfilled } from '@/lib/shop/entitlement'
import {
  canAffordOnchain,
  canAffordSolana,
  costToAmountStrings,
  costToSolanaAmounts,
  onchainShortfall,
  solanaShortfall,
} from '@/lib/shop/pricing'
import {
  buildRedeemAuthChallenge,
  esmsOnchainConfigured,
  readEsmsBalances,
  readEsmsRedeemed,
} from '@/lib/esms-chain/contract'
import {
  redeemEsmsFor,
  redeemerConfigured,
  toOnchainAmounts,
  verifyRedeem,
} from '@/lib/esms-chain/redeemer'
import { AsolSolanaClient, type AsolSolanaWallet } from '@/lib/solana/asol-solana-client'
import { buildRedeemAuthorizationMessage } from '@/lib/solana/esms'
import { claimIdToBytes32 } from '@/lib/solana/solana-minter'
import { getSolanaServiceSigner } from '@/lib/solana/kms-signer'
import { resolveSolanaRpcUrls } from '@/lib/solana/rpc-failover'

export const dynamic = 'force-dynamic'

const TX_PATTERN = /^0x[0-9a-f]{64}$/i

/**
 * POST /api/shop/purchase  { itemId, payWith?, rail?, nonce?, txHash?, signature?, deadline? }
 *
 * Digital items (apothecary, pentacles) settle with a real on-chain ESMS burn:
 *  - EVM Rail: Base Sepolia ERC-1155 burn via EIP-712 RedeemAuthorization.
 *  - Solana Rail: Solana Token-2022 burn via detached Ed25519 redeem_for_esms.
 *  - The bytes32 orderId guards both on-chain burns and the entitlement table,
 *    preventing double-burns across rails and enabling safe retries.
 */
export async function POST(request: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    itemId?: unknown
    payWith?: unknown
    rail?: unknown
    nonce?: unknown
    txHash?: unknown
    signature?: unknown
    deadline?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const item = typeof body.itemId === 'string' ? getShopItem(body.itemId) : undefined
  if (!item) return NextResponse.json({ error: 'Unknown item' }, { status: 404 })

  const rail = body.rail === 'solana' ? 'solana' : 'evm'

  // ── Digital items: ESMS is the native rail; USDC/Card top up first ────────
  const payWith = body.payWith === 'usdc' || body.payWith === 'card' ? body.payWith : 'esms'
  if (payWith !== 'esms') {
    // Digital goods are priced in ESMS — route fiat buyers to the ESMS Bazaar.
    return NextResponse.json({
      mode: 'topup',
      url: `/shop?highlight=${encodeURIComponent(item.id)}`,
      itemId: item.id,
    })
  }

  // One-time unlock already owned → idempotent success.
  if (!item.repeatable && (await hasUnlock(userId, item.id))) {
    return NextResponse.json({ ok: true, alreadyOwned: true, itemId: item.id })
  }

  // Repeatable items need a stable per-purchase nonce so retries reuse the order.
  if (item.repeatable && !isValidNonce(body.nonce)) {
    return NextResponse.json(
      { error: 'A stable `nonce` is required for repeatable items.' },
      { status: 400 }
    )
  }

  const orderId = shopOrderId(userId, item.id, item.repeatable ? (body.nonce as string) : undefined)

  // ── Cross-rail fulfillment check ──────────────────────────────────────────
  if (await isOrderFulfilled(orderId)) {
    return NextResponse.json({ ok: true, itemId: item.id, orderId, reconciled: true })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RAIL: SOLANA (Token-2022 Native Detached Burn)
  // ══════════════════════════════════════════════════════════════════════════
  if (rail === 'solana') {
    const verifiedWallet = await prisma.verifiedSolanaWallet
      .findUnique({ where: { userId }, select: { solanaPubKey: true } })
      .catch(() => null)

    if (!verifiedWallet?.solanaPubKey) {
      return NextResponse.json(
        {
          error: 'Connect and verify your Solana wallet before spending on Solana.',
          code: 'no_solana_wallet',
        },
        { status: 400 }
      )
    }

    let solanaPubKey: PublicKey
    try {
      solanaPubKey = new PublicKey(verifiedWallet.solanaPubKey)
    } catch {
      return NextResponse.json(
        { error: 'Invalid verified Solana wallet address.', code: 'invalid_solana_wallet' },
        { status: 400 }
      )
    }

    const orderIdBytes = claimIdToBytes32(orderId)
    const amounts = costToSolanaAmounts(item.esms)
    const rpcUrls = resolveSolanaRpcUrls()
    const connection = new Connection(
      rpcUrls[0] ?? process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
      'confirmed'
    )

    const serviceSigner = getSolanaServiceSigner()
    const readWallet: AsolSolanaWallet = serviceSigner ?? {
      publicKey: solanaPubKey,
      signTransaction: async tx => tx,
      signAllTransactions: async txs => txs,
    }
    const solanaClient = new AsolSolanaClient({ connection, wallet: readWallet })

    // Fail-closed cluster domain read
    let clusterDomain: Uint8Array
    try {
      clusterDomain = await solanaClient.fetchClusterDomain()
      if (clusterDomain.length !== 32 || clusterDomain.every(b => b === 0)) {
        throw new Error('Invalid cluster domain on-chain')
      }
    } catch (err) {
      console.error('[api/shop/purchase] Solana cluster domain read failed:', err)
      return NextResponse.json(
        {
          error: 'Solana ESMS program cluster domain is not configured or reachable.',
          code: 'cluster_domain_unavailable',
        },
        { status: 503 }
      )
    }

    // Reconcile: if already burned on Solana, grant entitlement
    try {
      if (await solanaClient.hasOrderReceipt(orderIdBytes)) {
        await grantPurchase({ userId, item, orderId })
        return NextResponse.json({
          ok: true,
          itemId: item.id,
          orderId,
          reconciled: true,
          rail: 'solana',
        })
      }
    } catch (err) {
      console.warn('[api/shop/purchase] Solana orderReceipt check failed (continuing):', err)
    }

    // Check Solana 4-dp balances
    let balances: readonly [bigint, bigint, bigint, bigint]
    try {
      balances = await solanaClient.readEsmsBalances(solanaPubKey)
    } catch (err) {
      console.error('[api/shop/purchase] Solana balance read failed:', err)
      return NextResponse.json(
        { error: 'Could not read your on-chain Solana ESMS balance.', code: 'balance_unavailable' },
        { status: 502 }
      )
    }

    if (!canAffordSolana(balances, item.esms)) {
      return NextResponse.json(
        {
          error: 'Insufficient on-chain ESMS on Solana. Claim more to chain, then try again.',
          code: 'insufficient_esms',
          shortfall: solanaShortfall(balances, item.esms),
        },
        { status: 402 }
      )
    }

    const rawSig =
      typeof body.signature === 'string' && body.signature.trim().length > 0
        ? body.signature.trim()
        : null

    // If signature is absent, return signing challenge
    if (!rawSig || body.deadline === undefined) {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)
      const message = buildRedeemAuthorizationMessage({
        programId: solanaClient.programId,
        clusterDomain,
        holder: solanaPubKey,
        orderId: orderIdBytes,
        amounts,
        deadline,
      })
      return NextResponse.json({
        mode: 'sign_solana',
        itemId: item.id,
        orderId,
        deadline: deadline.toString(),
        messageBase64: message.toString('base64'),
        clusterDomainHex: Buffer.from(clusterDomain).toString('hex'),
        challengeDomain: 'ASOL_ESMS_REDEEM_V1',
        rail: 'solana',
      })
    }

    // Verify deadline
    let deadline: bigint
    try {
      deadline = BigInt(String(body.deadline))
    } catch {
      return NextResponse.json(
        { error: 'Invalid deadline.', code: 'bad_deadline' },
        { status: 400 }
      )
    }
    if (deadline < BigInt(Math.floor(Date.now() / 1000))) {
      return NextResponse.json(
        { error: 'Signing window expired — try again.', code: 'sig_expired' },
        { status: 400 }
      )
    }

    if (!serviceSigner) {
      return NextResponse.json(
        {
          error: 'Solana ESMS settlement service signer is not configured for this deployment.',
          code: 'redeemer_unconfigured',
        },
        { status: 503 }
      )
    }

    // Decode detached Ed25519 signature (base58 or hex)
    let sigBytes: Uint8Array
    try {
      if (rawSig.startsWith('0x')) {
        sigBytes = Uint8Array.from(Buffer.from(rawSig.slice(2), 'hex'))
      } else {
        try {
          sigBytes = bs58.decode(rawSig)
        } catch {
          sigBytes = Uint8Array.from(Buffer.from(rawSig, 'base64'))
        }
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid signature format (expected base58 or hex).', code: 'bad_signature' },
        { status: 400 }
      )
    }

    if (sigBytes.length !== 64) {
      return NextResponse.json(
        { error: 'Invalid Ed25519 signature length (expected 64 bytes).', code: 'bad_signature' },
        { status: 400 }
      )
    }

    // Submit sponsored redeem via backend service signer
    const executingClient = new AsolSolanaClient({ connection, wallet: serviceSigner })
    try {
      const burnTx = await executingClient.redeemForEsms({
        orderId: orderIdBytes,
        amounts,
        holder: solanaPubKey,
        holderSignature: sigBytes,
        clusterDomain,
        deadline,
      })
      await grantPurchase({ userId, item, orderId, txHash: burnTx })
      return NextResponse.json({
        ok: true,
        itemId: item.id,
        orderId,
        txHash: burnTx,
        rail: 'solana',
      })
    } catch (err) {
      console.error('[api/shop/purchase] Solana sponsored burn failed (retryable):', err)
      return NextResponse.json(
        {
          error: 'On-chain ESMS burn on Solana failed — retry shortly.',
          code: 'burn_failed',
          retryable: true,
        },
        { status: 502 }
      )
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RAIL: EVM (Base Sepolia EIP-712 RedeemAuthorization)
  // ══════════════════════════════════════════════════════════════════════════
  if (!esmsOnchainConfigured()) {
    return NextResponse.json(
      {
        error: 'On-chain ESMS is not deployed in this environment yet.',
        code: 'onchain_unconfigured',
      },
      { status: 503 }
    )
  }

  const user = await prisma.users
    .findUnique({ where: { id: userId }, select: { walletAddress: true } })
    .catch(() => null)
  const wallet = user?.walletAddress as Address | undefined
  if (!wallet) {
    return NextResponse.json(
      {
        error: 'Connect your wallet (Privy) and claim ESMS to chain before spending.',
        code: 'no_wallet',
      },
      { status: 400 }
    )
  }

  const amounts = costToAmountStrings(item.esms)

  // Reconcile: if this order already burned on EVM, just (re)grant the entitlement.
  try {
    if (await readEsmsRedeemed(orderId)) {
      await grantPurchase({ userId, item, orderId })
      return NextResponse.json({ ok: true, itemId: item.id, orderId, reconciled: true })
    }
  } catch (err) {
    console.warn('[api/shop/purchase] redeemedOrders read failed (continuing):', err)
  }

  // ── Path A: buyer's wallet already signed the redeem; verify and grant ────
  const txHash =
    typeof body.txHash === 'string' && TX_PATTERN.test(body.txHash) ? (body.txHash as Hex) : null
  if (txHash) {
    const ok = await verifyRedeem({ txHash, orderId, from: wallet })
    if (!ok) {
      return NextResponse.json(
        { error: 'Could not verify the on-chain ESMS burn for this order.', code: 'verify_failed' },
        { status: 502 }
      )
    }
    await grantPurchase({ userId, item, orderId, txHash })
    return NextResponse.json({ ok: true, itemId: item.id, orderId, txHash })
  }

  // ── Path B: backend-sponsored burn (BURNER wallet pays gas) ───────────────
  let balances
  try {
    balances = await readEsmsBalances(wallet)
  } catch (err) {
    console.error('[api/shop/purchase] balance read failed:', err)
    return NextResponse.json(
      { error: 'Could not read your on-chain ESMS balance.', code: 'balance_unavailable' },
      { status: 502 }
    )
  }

  if (!canAffordOnchain(balances, item.esms)) {
    return NextResponse.json(
      {
        error: 'Insufficient on-chain ESMS. Claim more to chain, then try again.',
        code: 'insufficient_esms',
        shortfall: onchainShortfall(balances, item.esms),
      },
      { status: 402 }
    )
  }

  if (!redeemerConfigured()) {
    return NextResponse.json(
      {
        error: 'ESMS settlement wallet is not configured for this deployment.',
        code: 'redeemer_unconfigured',
      },
      { status: 503 }
    )
  }

  // The buyer must authorize the sponsored burn with an EIP-712 RedeemAuthorization
  // (gasless — a signature, not a tx). Without one, hand the client a signing challenge.
  const sig =
    typeof body.signature === 'string' && /^0x[0-9a-fA-F]+$/.test(body.signature)
      ? (body.signature as Hex)
      : null
  if (!sig || body.deadline === undefined) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)
    return NextResponse.json({
      mode: 'sign',
      itemId: item.id,
      orderId,
      deadline: deadline.toString(),
      challenge: buildRedeemAuthChallenge({
        from: wallet,
        orderId,
        values: toOnchainAmounts(amounts),
        deadline,
      }),
    })
  }

  let deadline: bigint
  try {
    deadline = BigInt(String(body.deadline))
  } catch {
    return NextResponse.json({ error: 'Invalid deadline.', code: 'bad_deadline' }, { status: 400 })
  }
  if (deadline < BigInt(Math.floor(Date.now() / 1000))) {
    return NextResponse.json(
      { error: 'Signing window expired — try again.', code: 'sig_expired' },
      { status: 400 }
    )
  }

  try {
    const burnTx = await redeemEsmsFor({ from: wallet, orderId, amounts, deadline, sig })
    await grantPurchase({ userId, item, orderId, txHash: burnTx })
    return NextResponse.json({ ok: true, itemId: item.id, orderId, txHash: burnTx })
  } catch (err) {
    console.error('[api/shop/purchase] sponsored burn failed (retryable):', err)
    return NextResponse.json(
      { error: 'On-chain ESMS burn failed — retry shortly.', code: 'burn_failed', retryable: true },
      { status: 502 }
    )
  }
}
