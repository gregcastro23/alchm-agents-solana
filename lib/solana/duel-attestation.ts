import { createHash } from 'node:crypto'
import { PublicKey } from '@solana/web3.js'
import type { EsmsClaimAmounts } from './solana-minter'

/** Fixed on-chain ESMS reward per verified 14-Pillars duel win (in Token-2022 atoms). */
export const DUEL_WIN_REWARD: EsmsClaimAmounts = {
  spirit: '1000',
  essence: '1000',
  matter: '1000',
  substance: '1000',
} as const

/** Maximum duel win claims permitted per wallet per UTC day. */
export const DUEL_WIN_DAILY_CAP = 5

export const DUEL_RECEIPT_DOMAIN = Buffer.from('ASOL_PILLAR_DUEL_RECEIPT_V1')

/**
 * Compute the canonical 32-byte receipt id for a 14-Pillars duel win.
 * Formatted as: sha256("ASOL_PILLAR_DUEL_RECEIPT_V1" || spacetimeDbIdentity(32) || duel_id(u64 LE) || created_at_micros(i64 LE)).
 * Exactly one receipt per duel; survives database republishes that reset duel_id sequence.
 */
export function computeDuelReceiptId(
  dbIdentity: Uint8Array | string,
  duelId: bigint | number | string,
  createdAtMicros: bigint | number | string
): Uint8Array {
  const dbIdentityBuf =
    typeof dbIdentity === 'string'
      ? Buffer.from(dbIdentity.replace(/^0x/i, ''), 'hex')
      : Buffer.from(dbIdentity)
  if (dbIdentityBuf.length !== 32) {
    throw new Error('dbIdentity must be exactly 32 bytes')
  }

  const duelIdBig = BigInt(duelId)
  const duelIdBuf = Buffer.alloc(8)
  duelIdBuf.writeBigUInt64LE(duelIdBig, 0)

  const createdBig = BigInt(createdAtMicros)
  const createdBuf = Buffer.alloc(8)
  createdBuf.writeBigInt64LE(createdBig, 0)

  const preimage = Buffer.concat([DUEL_RECEIPT_DOMAIN, dbIdentityBuf, duelIdBuf, createdBuf])
  return Uint8Array.from(createHash('sha256').update(preimage).digest())
}

/**
 * Compute the 32-byte ledgerReferenceHash for a resolved duel win.
 * Binds: receiptId(32) || winnerWallet(32) || opponentIdentity(32) || openingPillar(u32 LE) || powerRatioBps(u32 LE) || resolvedAtMicros(i64 LE).
 */
export function computeDuelLedgerReference(args: {
  receiptId: Uint8Array
  winnerWallet: PublicKey | string
  opponentIdentity: Uint8Array | string
  openingPillar: number
  powerRatioBps: number
  resolvedAtMicros: bigint | number | string
}): Uint8Array {
  const {
    receiptId,
    winnerWallet,
    opponentIdentity,
    openingPillar,
    powerRatioBps,
    resolvedAtMicros,
  } = args
  if (receiptId.length !== 32) throw new Error('receiptId must be 32 bytes')

  const winnerKey = typeof winnerWallet === 'string' ? new PublicKey(winnerWallet) : winnerWallet
  const oppBuf =
    typeof opponentIdentity === 'string'
      ? Buffer.from(opponentIdentity.replace(/^0x/i, ''), 'hex')
      : Buffer.from(opponentIdentity)
  if (oppBuf.length !== 32) throw new Error('opponentIdentity must be 32 bytes')

  const tail = Buffer.alloc(4 + 4 + 8)
  tail.writeUInt32LE(openingPillar, 0)
  tail.writeUInt32LE(powerRatioBps, 4)
  tail.writeBigInt64LE(BigInt(resolvedAtMicros), 8)

  const payload = Buffer.concat([Buffer.from(receiptId), winnerKey.toBuffer(), oppBuf, tail])
  return Uint8Array.from(createHash('sha256').update(payload).digest())
}
