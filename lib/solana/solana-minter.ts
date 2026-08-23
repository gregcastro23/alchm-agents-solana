/**
 * Solana Token-2022 ESMS Minter
 *
 * Settles off-chain ESMS claims natively on Solana Devnet Token-2022 mints
 * using 4-decimal u64 integer precision (1 token unit = 10,000 raw atoms),
 * perfectly matching Alchm.kitchen's Decimal(12,4) off-chain ledger.
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import bs58 from 'bs58'
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { parseUnits, type Hex } from 'viem'

import {
  AsolSolanaClient,
  type AsolSolanaWallet,
  type EsmsAmounts,
} from '@/lib/solana/asol-solana-client'
import { resolveSolanaRpcUrls, withSolanaRpcFailover } from '@/lib/solana/rpc-failover'
import { getSolanaServiceSigner, KmsSolanaSigner } from '@/lib/solana/kms-signer'

export interface EsmsClaimAmounts {
  spirit: string
  essence: string
  matter: string
  substance: string
}

/** Load backend Solana payer keypair from environment or local wallet path. */
export function solanaPayerFromEnvironment(): Keypair | null {
  let raw = process.env.SOLANA_AGENT_PAYER_KEY?.trim()
  if (!raw && process.env.NODE_ENV !== 'production') {
    const localPath =
      process.env.SOLANA_AGENT_PAYER_PATH ??
      process.env.ANCHOR_WALLET ??
      join(homedir(), '.config', 'solana', 'id.json')
    try {
      raw = readFileSync(localPath, 'utf8').trim()
    } catch {
      return null
    }
  }
  if (!raw) return null
  try {
    const bytes = raw.startsWith('[')
      ? Uint8Array.from((JSON.parse(raw) as unknown[]).map(Number))
      : bs58.decode(raw)
    if (bytes.length !== 64) throw new Error('expected a 64-byte secret key')
    return Keypair.fromSecretKey(bytes)
  } catch (error) {
    throw new Error(
      `SOLANA_AGENT_PAYER_KEY is invalid: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/** Convert hex claimId string (0x...) to 32-byte Uint8Array. */
export function claimIdToBytes32(claimId: Hex | string): Uint8Array {
  const clean = claimId.startsWith('0x') ? claimId.slice(2) : claimId
  if (clean.length !== 64) throw new Error('claimId must be a 32-byte hex string')
  return Uint8Array.from(Buffer.from(clean, 'hex'))
}

/** Scale ledger decimals → 4-dp raw u64 bigints [spirit, essence, matter, substance]. */
export function toSolanaOnchainAmounts(amounts: EsmsClaimAmounts): EsmsAmounts {
  const clamp = (val: string) => parseUnits(val || '0', 4)
  return [
    clamp(amounts.spirit),
    clamp(amounts.essence),
    clamp(amounts.matter),
    clamp(amounts.substance),
  ]
}

/** Calculate 32-byte ledger reference hash for auditability. */
export function computeLedgerReferenceHash(
  claimId: Hex | string,
  amounts: EsmsClaimAmounts
): Uint8Array {
  const payload = `ASOL_CLAIM_SOLANA_V1:${claimId}:${amounts.spirit}:${amounts.essence}:${amounts.matter}:${amounts.substance}`
  return createHash('sha256').update(payload).digest()
}

/**
 * Mint a settled claim natively on Solana Token-2022 mints.
 * Uses Cloud KMS HSM signer with devnet/local fallback.
 * `claimId` is the bytes32 hex idempotency key.
 * Returns the transaction signature string.
 */
export async function mintEsmsClaimSolana(params: {
  recipient: PublicKey | string
  claimId: Hex | string
  amounts: EsmsClaimAmounts
  signer?: AsolSolanaWallet | Keypair
}): Promise<string> {
  const resolvedSigner: AsolSolanaWallet | null = params.signer
    ? params.signer instanceof Keypair
      ? new KmsSolanaSigner({
          provider: 'local',
          keypair: params.signer,
          publicKey: params.signer.publicKey,
        })
      : params.signer
    : getSolanaServiceSigner()

  if (!resolvedSigner) {
    throw new Error(
      'Solana service signer not configured (set AWS_KMS_KEY_ID, GCP_KMS_KEY_NAME, or SOLANA_AGENT_PAYER_KEY)'
    )
  }

  const recipientPubkey =
    typeof params.recipient === 'string' ? new PublicKey(params.recipient) : params.recipient

  const claimIdBytes = claimIdToBytes32(params.claimId)
  const onchainAmounts = toSolanaOnchainAmounts(params.amounts)
  const ledgerHash = computeLedgerReferenceHash(params.claimId, params.amounts)

  const rpcUrls = resolveSolanaRpcUrls()

  return withSolanaRpcFailover({
    rpcUrls,
    operation: async connection => {
      const client = new AsolSolanaClient({
        connection,
        wallet: resolvedSigner,
      })

      const ix = await client.buildClaimMintEsmsInstruction({
        claimId: claimIdBytes,
        ledgerReferenceHash: ledgerHash,
        recipient: recipientPubkey,
        amounts: onchainAmounts,
        authority: resolvedSigner.publicKey,
      })

      const tx = new Transaction().add(ix)
      tx.feePayer = resolvedSigner.publicKey
      const { blockhash } = await connection.getLatestBlockhash('confirmed')
      tx.recentBlockhash = blockhash

      await resolvedSigner.signTransaction(tx)

      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })

      await connection.confirmTransaction(signature, 'confirmed')
      return signature
    },
  })
}
