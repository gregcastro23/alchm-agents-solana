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
import { claimIdToBytes32, getReceiptAddress, ASOL_SOLANA_PROGRAM_ID } from '@/lib/solana/esms'
import { MAX_LEDGER_ATOMS } from '@/lib/solana/vectors'

export interface EsmsClaimAmounts {
  spirit: string
  essence: string
  matter: string
  substance: string
}

/**
 * Protocol vs Policy Velocity Caps:
 *
 * 1. Protocol Bound: `MAX_LEDGER_ATOMS` (999,999,999,999 raw atoms = 99,999,999.9999 tokens)
 *    is enforced directly by the on-chain Anchor program in `validate_amounts`. Any claim
 *    exceeding this bound is rejected by the runtime with `AmountOutOfRange`.
 *
 * 2. Policy Cap: `DEFAULT_MAX_CLAIM_ATOMS` (100,000,000,000 raw atoms = 10,000,000.0000 tokens)
 *    is a tighter defense-in-depth policy ceiling enforced off-chain before transaction construction
 *    and signing, preventing runaway mints if a service key is compromised.
 *    Configurable via process.env.SOLANA_MAX_CLAIM_ATOMS.
 */
export { MAX_LEDGER_ATOMS }
export const DEFAULT_MAX_CLAIM_ATOMS = 100_000_000_000n

export function resolveMaxClaimAtoms(): bigint {
  const envCap = process.env.SOLANA_MAX_CLAIM_ATOMS?.trim()
  if (envCap) {
    const parsed = BigInt(envCap)
    if (parsed > MAX_LEDGER_ATOMS) {
      throw new Error(
        `Configured SOLANA_MAX_CLAIM_ATOMS (${parsed}) exceeds protocol bound MAX_LEDGER_ATOMS (${MAX_LEDGER_ATOMS})`
      )
    }
    return parsed
  }
  return DEFAULT_MAX_CLAIM_ATOMS
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

// Defined in `esms.ts`, which pulls in no Node built-ins, and re-exported here so
// existing server-side importers keep working. This module loads keypairs from
// disk and must never reach a client bundle.
export { claimIdToBytes32 }

/** Scale ledger decimals → 4-dp raw u64 bigints [spirit, essence, matter, substance] with policy velocity guard. */
export function toSolanaOnchainAmounts(amounts: EsmsClaimAmounts): EsmsAmounts {
  const maxAtoms = resolveMaxClaimAtoms()
  const clamp = (val: string, element: string) => {
    const atoms = parseUnits(val || '0', 4)
    if (atoms > maxAtoms) {
      throw new Error(
        `Claim amount for ${element} (${atoms} atoms) exceeds policy velocity limit of ${maxAtoms} atoms (10,000,000 tokens). Exceeding protocol bound (${MAX_LEDGER_ATOMS}) is also an on-chain program error.`
      )
    }
    return atoms
  }
  return [
    clamp(amounts.spirit, 'spirit'),
    clamp(amounts.essence, 'essence'),
    clamp(amounts.matter, 'matter'),
    clamp(amounts.substance, 'substance'),
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

export type SettlementProof = { settled: true; txHash: string } | { settled: false }

/**
 * Checks on-chain whether a claim was minted on Solana and recovers its transaction signature.
 * Safe for failover and idempotent retries.
 */
export async function getSolanaClaimSettlementProof(
  claimId: Hex | string,
  connection?: Connection
): Promise<SettlementProof> {
  const claimIdBytes = claimIdToBytes32(claimId)
  const receiptAddress = getReceiptAddress('claim', claimIdBytes, ASOL_SOLANA_PROGRAM_ID)

  const check = async (conn: Connection): Promise<SettlementProof> => {
    const accountInfo = await conn.getAccountInfo(receiptAddress, 'confirmed')
    if (!accountInfo) {
      return { settled: false }
    }
    const signatures = await conn.getSignaturesForAddress(receiptAddress, { limit: 1 })
    const txHash = signatures[0]?.signature ?? 'settled_onchain'
    return { settled: true, txHash }
  }

  if (connection) {
    return check(connection)
  }

  const rpcUrls = resolveSolanaRpcUrls()
  return withSolanaRpcFailover({
    rpcUrls,
    operation: async conn => check(conn),
  })
}

/**
 * Mint a settled claim natively on Solana Token-2022 mints.
 * Uses Cloud KMS HSM signer with devnet/local fallback.
 * Routes through AsolSolanaClient.claimMintEsms for compute budget and dynamic priority fees.
 * Returns the transaction signature string.
 */
export async function mintEsmsClaimSolana(params: {
  recipient: PublicKey | string
  claimId: Hex | string
  amounts: EsmsClaimAmounts
  signer?: AsolSolanaWallet | Keypair
  connection?: Connection
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

  // 1. Pre-flight check: if already settled on-chain, return the existing signature
  const preflight = await getSolanaClaimSettlementProof(params.claimId, params.connection)
  if (preflight.settled) {
    return preflight.txHash
  }

  const executeSend = async (connection: Connection): Promise<string> => {
    const client = new AsolSolanaClient({
      connection,
      wallet: resolvedSigner,
      confirmOptions: { commitment: 'confirmed' },
    })

    try {
      return await client.claimMintEsms({
        claimId: claimIdBytes,
        ledgerReferenceHash: ledgerHash,
        recipient: recipientPubkey,
        amounts: onchainAmounts,
        authority: resolvedSigner.publicKey,
      })
    } catch (sendError) {
      // 2. Post-timeout recovery: if confirmation failed or timed out,
      // verify if the ClaimReceipt actually landed on-chain.
      const recovery = await getSolanaClaimSettlementProof(params.claimId, connection)
      if (recovery.settled) {
        return recovery.txHash
      }
      throw sendError
    }
  }

  if (params.connection) {
    return executeSend(params.connection)
  }

  const rpcUrls = resolveSolanaRpcUrls()
  return withSolanaRpcFailover({
    rpcUrls,
    operation: async connection => executeSend(connection),
  })
}
