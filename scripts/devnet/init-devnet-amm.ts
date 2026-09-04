#!/usr/bin/env bun
/**
 * Constellation AMM Devnet Initialization & Live Trading Drill
 *
 * Idempotently registers and bootstraps all 6 canonical Constellation AMM pools
 * on Solana Devnet with approved parameters:
 *   - Fee: 30 bps (0.30%)
 *   - Initial virtual reserves: 100,000,000 atoms (10,000.0000 ESMS) per element
 *   - Initial shares: 100,000,000
 *
 * Also executes a live end-to-end trading drill on Pool 0 using an ephemeral trader:
 *   1. Claim test ESMS atoms for ephemeral trader
 *   2. Add liquidity with Ed25519 attestations
 *   3. Swap ESMS with Ed25519 attestations
 *   4. Reject replayed nonces
 *   5. Withdraw liquidity (100%) and verify DeedPosition PDA cleanup
 *
 * Usage:
 *   bun run scripts/devnet/init-devnet-amm.ts [--skip-drill] [--rpc-url <url>]
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import nacl from 'tweetnacl'
import * as anchor from '@coral-xyz/anchor'
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token'

import {
  CONSTELLATION_PAIRS,
  getConstellationPoolAddress,
  decodeConstellationPool,
  buildRegisterPoolInstruction,
  buildBootstrapPoolInstruction,
  buildAddLiquidityTransaction,
  buildSwapEsmsTransaction,
  buildWithdrawLiquidityTransaction,
  getDeedPositionAddress,
  decodeDeedPosition,
  fetchPoolTraderNonce,
  getEsmsMintAddress,
  ASOL_SOLANA_PROGRAM_ID,
} from '@/lib/solana/constellation-amm'
import { getProgramConfigAddress, getEsmsMintAddresses, getReceiptAddress } from '@/lib/solana/esms'
import { IDL, type AsolProgram } from '@/lib/solana/idl'
import { buildAmmVisibilityAuthorizationVector } from '@/lib/solana/vectors'
import { SOLANA_DEVNET_GENESIS_HASH } from '@/lib/solana/network-config'

export const UNIFORM_FEE_BPS = 30
export const UNIFORM_BOOTSTRAP_RESERVE = 100_000_000n // 10,000.0000 ESMS atoms

export function loadOperatorKeypair(): Keypair {
  const customPath = process.env.ANCHOR_WALLET ?? process.env.SOLANA_WALLET_PATH
  const defaultPath = resolve(process.env.HOME ?? '', '.config/solana/id.json')
  const keypairPath = customPath && existsSync(customPath) ? customPath : defaultPath

  if (!existsSync(keypairPath)) {
    throw new Error(`Solana operator keypair not found at ${keypairPath}`)
  }
  const secretKey = Uint8Array.from(JSON.parse(readFileSync(keypairPath, 'utf8')))
  return Keypair.fromSecretKey(secretKey)
}

export async function sendWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 5,
  delayMs = 1500
): Promise<T> {
  let attempt = 0
  while (true) {
    attempt++
    try {
      return await fn()
    } catch (err: any) {
      const isInstructionError =
        err?.message?.includes('InstructionError') ||
        err?.message?.includes('custom program error') ||
        err?.message?.includes('Simulation failed')
      if (isInstructionError || attempt >= maxAttempts) throw err
      const isRateLimited =
        err?.message?.includes('429') || err?.message?.includes('Too Many Requests')
      const wait = isRateLimited ? delayMs * attempt * 2 : delayMs
      console.warn(
        `[Retry ${attempt}/${maxAttempts}] ${err?.message?.slice(0, 80)}... Waiting ${wait}ms`
      )
      await new Promise(res => setTimeout(res, wait))
    }
  }
}

export async function sendAndConfirmCustom(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[]
): Promise<string> {
  return await sendWithRetry(async () => {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    transaction.recentBlockhash = blockhash
    transaction.lastValidBlockHeight = lastValidBlockHeight
    transaction.feePayer = signers[0].publicKey
    transaction.signatures = []
    transaction.sign(...signers)

    const rawTx = transaction.serialize()
    const signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    })

    for (let i = 0; i < 45; i++) {
      const status = await connection.getSignatureStatus(signature)
      if (
        status.value?.confirmationStatus === 'confirmed' ||
        status.value?.confirmationStatus === 'finalized'
      ) {
        if (status.value.err) {
          throw new Error(`Transaction ${signature} failed: ${JSON.stringify(status.value.err)}`)
        }
        return signature
      }
      await new Promise(r => setTimeout(r, 1000))
    }
    throw new Error(`Transaction ${signature} confirmation timeout`)
  })
}

export async function initDevnetAmm(options: {
  rpcUrl?: string
  skipDrill?: boolean
  operatorKeypair?: Keypair
}) {
  const rpcUrl =
    options.rpcUrl ?? process.env.ANCHOR_PROVIDER_URL ?? 'https://api.devnet.solana.com'
  const connection = new Connection(rpcUrl, { commitment: 'confirmed' })
  const operator = options.operatorKeypair ?? loadOperatorKeypair()
  const programId = ASOL_SOLANA_PROGRAM_ID

  console.log('=============================================================')
  console.log('🌌 CONSTELLATION AMM DEVNET INITIALIZATION & VERIFICATION')
  console.log('=============================================================')
  console.log(`RPC Endpoint: ${rpcUrl}`)
  console.log(`Operator:     ${operator.publicKey.toBase58()}`)
  console.log(`Program ID:   ${programId.toBase58()}`)

  // 1. Genesis Check
  const genesisHash = await connection.getGenesisHash()
  if (genesisHash !== SOLANA_DEVNET_GENESIS_HASH) {
    throw new Error(`Genesis mismatch! Expected ${SOLANA_DEVNET_GENESIS_HASH}, got ${genesisHash}`)
  }
  console.log(`Genesis Hash: ${genesisHash} (✅ MATCH)`)

  // 2. Load ProgramConfig
  const programConfigPda = getProgramConfigAddress(programId)
  const wallet = new anchor.Wallet(operator)
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' })
  anchor.setProvider(provider)
  const program = new anchor.Program(IDL as any, provider) as anchor.Program<AsolProgram>
  const config = await program.account.programConfig.fetch(programConfigPda)
  console.log(`Config Admin: ${config.admin.toBase58()}`)
  console.log(`Attestor:     ${config.attestor.toBase58()}`)
  console.log(`Pauser:       ${config.pauser.toBase58()}`)

  if (!config.admin.equals(operator.publicKey)) {
    throw new Error(
      `Operator ${operator.publicKey.toBase58()} is not ProgramConfig admin ${config.admin.toBase58()}`
    )
  }

  // 3. Register & Bootstrap All 6 Canonical Pools
  console.log('\n--- Checking All 6 Canonical Constellation Pools ---')
  for (let poolId = 0; poolId < CONSTELLATION_PAIRS.length; poolId++) {
    const [elemA, elemB] = CONSTELLATION_PAIRS[poolId]
    const poolPda = getConstellationPoolAddress(poolId, programId)
    const existingInfo = await connection.getAccountInfo(poolPda)

    if (!existingInfo) {
      console.log(`Pool ${poolId} (${elemA} <-> ${elemB}): Registering...`)
      const registerIx = buildRegisterPoolInstruction({
        poolId,
        elementA: elemA,
        elementB: elemB,
        feeBps: UNIFORM_FEE_BPS,
        admin: operator.publicKey,
        programId,
      })
      const tx = new Transaction().add(registerIx)
      const sig = await sendAndConfirmCustom(connection, tx, [operator])
      console.log(`  ✓ Registered Pool ${poolId}: ${sig}`)
    }

    const poolInfo = await connection.getAccountInfo(poolPda)
    if (!poolInfo) throw new Error(`Pool ${poolId} account still missing after registration`)
    const poolState = decodeConstellationPool(Buffer.from(poolInfo.data))

    if (!poolState.bootstrapped) {
      console.log(
        `Pool ${poolId} (${elemA} <-> ${elemB}): Bootstrapping with ${UNIFORM_BOOTSTRAP_RESERVE} atoms...`
      )
      const bootstrapIx = buildBootstrapPoolInstruction({
        poolId,
        reserveA: UNIFORM_BOOTSTRAP_RESERVE,
        reserveB: UNIFORM_BOOTSTRAP_RESERVE,
        admin: operator.publicKey,
        programId,
      })
      const tx = new Transaction().add(bootstrapIx)
      const sig = await sendAndConfirmCustom(connection, tx, [operator])
      console.log(`  ✓ Bootstrapped Pool ${poolId}: ${sig}`)
    } else {
      console.log(
        `Pool ${poolId} (${elemA} <-> ${elemB}): Already bootstrapped (Reserve A: ${poolState.reserveA}, Reserve B: ${poolState.reserveB}, Fee: ${poolState.feeBps} bps)`
      )
    }
  }

  if (options.skipDrill) {
    console.log('\nDrill skipped (--skip-drill specified).')
    return
  }

  // 4. Live AMM Trading Drill on Pool 0
  console.log('\n--- Initiating Live AMM Drill on Pool 0 (Spirit <-> Essence) ---')
  const drillAttestor = Keypair.generate()
  const ephemeralTrader = Keypair.generate()
  console.log(`Ephemeral Trader:   ${ephemeralTrader.publicKey.toBase58()}`)
  console.log(`Dedicated Attestor: ${drillAttestor.publicKey.toBase58()}`)

  // Set attestor to drillAttestor temporarily
  const savedAttestor = config.attestor
  const savedPauser = config.pauser
  console.log(`Setting attestor to drillAttestor...`)
  await sendWithRetry(() =>
    program.methods
      .setServiceAuthorities(drillAttestor.publicKey, savedPauser)
      .accountsPartial({ programConfig: programConfigPda, authority: operator.publicKey })
      .rpc()
  )

  try {
    // Fund ephemeral trader with SOL
    console.log(`Funding ephemeral trader with 0.05 SOL...`)
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: operator.publicKey,
        toPubkey: ephemeralTrader.publicKey,
        lamports: 50_000_000,
      })
    )
    await sendAndConfirmCustom(connection, fundTx, [operator])

    // Grant ephemeral trader ESMS tokens via claimMintEsms
    console.log(`Claiming 100,000 atoms per element for ephemeral trader...`)
    const mints = getEsmsMintAddresses(programId)
    const traderAtas = mints.map(mint =>
      getAssociatedTokenAddressSync(mint, ephemeralTrader.publicKey, false, TOKEN_2022_PROGRAM_ID)
    )
    const claimId = Uint8Array.from(randomBytes(32))
    const claimAmounts = [100_000n, 100_000n, 100_000n, 100_000n] as const
    const claimReceipt = getReceiptAddress('claim', claimId, programId)

    await sendWithRetry(() =>
      program.methods
        .claimMintEsms(
          [...claimId],
          [...Uint8Array.from(randomBytes(32))],
          claimAmounts.map(v => new anchor.BN(v.toString()))
        )
        .accountsPartial({
          programConfig: programConfigPda,
          claimReceipt,
          authority: operator.publicKey,
          recipient: ephemeralTrader.publicKey,
          spiritMint: mints[0],
          essenceMint: mints[1],
          matterMint: mints[2],
          substanceMint: mints[3],
          spiritAccount: traderAtas[0],
          essenceAccount: traderAtas[1],
          matterAccount: traderAtas[2],
          substanceAccount: traderAtas[3],
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    )
    console.log(`  ✓ Granted ESMS atoms to ephemeral trader`)

    const clusterDomain = Uint8Array.from(config.clusterDomain)
    const pool0Id = 0
    const regionCommit = Uint8Array.from(randomBytes(32))
    const visibleStars = 1

    // Step 4.1: Add Liquidity
    console.log(`Testing Add Liquidity (20,000 Spirit, 20,000 Essence)...`)
    const currentNonce = await fetchPoolTraderNonce(
      connection,
      pool0Id,
      ephemeralTrader.publicKey,
      programId
    )
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)

    const addMessage = buildAmmVisibilityAuthorizationVector({
      programId: programId.toBuffer(),
      clusterDomain,
      trader: ephemeralTrader.publicKey.toBuffer(),
      poolId: pool0Id,
      op: 0, // AMM_OP_ADD_LIQUIDITY
      regionCommit,
      visibleStars,
      nonce: currentNonce,
      deadline,
    })
    const addSignature = nacl.sign.detached(addMessage, drillAttestor.secretKey)

    const addTx = await buildAddLiquidityTransaction({
      connection,
      poolId: pool0Id,
      elementA: 0,
      elementB: 1,
      amtA: 20_000n,
      amtB: 20_000n,
      minShares: 19_000n,
      trader: ephemeralTrader.publicKey,
      attestation: {
        attestor: drillAttestor.publicKey,
        signature: addSignature,
        regionCommit,
        visibleStars,
        nonce: currentNonce,
        deadline,
        clusterDomain,
      },
      programId,
    })
    const addSig = await sendAndConfirmCustom(connection, addTx, [ephemeralTrader])
    console.log(`  ✓ Add Liquidity Succeeded: ${addSig}`)

    const deedPda = getDeedPositionAddress(pool0Id, ephemeralTrader.publicKey, programId)
    const deedInfo = await connection.getAccountInfo(deedPda)
    if (!deedInfo) throw new Error('DeedPosition PDA not found after add_liquidity')
    const deed = decodeDeedPosition(Buffer.from(deedInfo.data))
    console.log(`  ✓ DeedPosition Verified: ${deed.shares} shares held`)

    // Step 4.2: Swap ESMS
    console.log(`Testing Swap ESMS (5,000 Spirit -> Essence)...`)
    const swapNonce = await fetchPoolTraderNonce(
      connection,
      pool0Id,
      ephemeralTrader.publicKey,
      programId
    )
    const swapMessage = buildAmmVisibilityAuthorizationVector({
      programId: programId.toBuffer(),
      clusterDomain,
      trader: ephemeralTrader.publicKey.toBuffer(),
      poolId: pool0Id,
      op: 1, // AMM_OP_SWAP
      regionCommit,
      visibleStars,
      nonce: swapNonce,
      deadline,
    })
    const swapSignature = nacl.sign.detached(swapMessage, drillAttestor.secretKey)

    const swapTx = await buildSwapEsmsTransaction({
      connection,
      poolId: pool0Id,
      elementA: 0,
      elementB: 1,
      inElement: 0,
      inAmount: 5_000n,
      minOut: 4_500n,
      trader: ephemeralTrader.publicKey,
      attestation: {
        attestor: drillAttestor.publicKey,
        signature: swapSignature,
        regionCommit,
        visibleStars,
        nonce: swapNonce,
        deadline,
        clusterDomain,
      },
      programId,
    })
    const swapSig = await sendAndConfirmCustom(connection, swapTx, [ephemeralTrader])
    console.log(`  ✓ Swap Succeeded: ${swapSig}`)

    // Step 4.3: Nonce Replay Rejection
    console.log(`Testing Replay Rejection (resending spent swap transaction)...`)
    let replayRejected = false
    try {
      const replayTx = await buildSwapEsmsTransaction({
        connection,
        poolId: pool0Id,
        elementA: 0,
        elementB: 1,
        inElement: 0,
        inAmount: 5_000n,
        minOut: 4_500n,
        trader: ephemeralTrader.publicKey,
        attestation: {
          attestor: drillAttestor.publicKey,
          signature: swapSignature,
          regionCommit,
          visibleStars,
          nonce: swapNonce, // Stale nonce!
          deadline,
          clusterDomain,
        },
        programId,
      })
      await sendAndConfirmCustom(connection, replayTx, [ephemeralTrader])
    } catch {
      replayRejected = true
    }
    if (!replayRejected) {
      throw new Error('Replayed AMM transaction was unexpectedly accepted!')
    }
    console.log(`  ✓ Replay Rejected as expected (InvalidPoolNonce)`)

    // Step 4.4: Withdraw Liquidity
    console.log(`Testing 100% Liquidity Withdrawal...`)
    const withdrawTx = await buildWithdrawLiquidityTransaction({
      connection,
      poolId: pool0Id,
      elementA: 0,
      elementB: 1,
      shareBps: 10_000, // 100%
      owner: ephemeralTrader.publicKey,
      programId,
    })
    const withdrawSig = await sendAndConfirmCustom(connection, withdrawTx, [ephemeralTrader])
    console.log(`  ✓ Withdrawal Succeeded: ${withdrawSig}`)

    const closedDeedInfo = await connection.getAccountInfo(deedPda)
    if (closedDeedInfo) {
      throw new Error('DeedPosition PDA was not closed after 100% withdrawal')
    }
    console.log(`  ✓ DeedPosition PDA Closed and rent refunded`)

    console.log('=============================================================')
    console.log('🎉 ALL AMM DEVNET INITIALIZATIONS & DRILLS PASSED!')
    console.log('=============================================================')
  } finally {
    // Restore original attestor
    console.log(`Restoring attestor authority to ${savedAttestor.toBase58()}...`)
    await sendWithRetry(() =>
      program.methods
        .setServiceAuthorities(savedAttestor, savedPauser)
        .accountsPartial({ programConfig: programConfigPda, authority: operator.publicKey })
        .rpc()
    )
    console.log(`  ✓ Attestor authority restored.`)
  }
}

// CLI entry point
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('init-devnet-amm.ts')
) {
  const skipDrill = process.argv.includes('--skip-drill')
  const rpcIndex = process.argv.indexOf('--rpc-url')
  const rpcUrl = rpcIndex !== -1 ? process.argv[rpcIndex + 1] : undefined

  initDevnetAmm({ rpcUrl, skipDrill })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal AMM initialization error:', err)
      process.exit(1)
    })
}
