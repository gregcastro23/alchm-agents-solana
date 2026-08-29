import { PublicKey } from '@solana/web3.js'

export const ASOL_SOLANA_PROGRAM_ID = new PublicKey('5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD')
export const AAE_SOLANA_PROGRAM_ID = ASOL_SOLANA_PROGRAM_ID
export const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')
export const ESMS_DECIMALS = 4
export const ESMS_RAW_SCALE = 10_000n
export const REDEEM_AUTHORIZATION_DOMAIN = Buffer.from('ASOL_ESMS_REDEEM_V1')

export const ASOL_SOLANA_SEEDS = {
  programAuthority: Buffer.from('program_authority'),
  esmsMint: Buffer.from('esms_mint'),
  personaCommitment: Buffer.from('persona_commitment'),
  claimReceipt: Buffer.from('claim_receipt'),
  orderReceipt: Buffer.from('order_receipt'),
} as const
export const AAE_SOLANA_SEEDS = ASOL_SOLANA_SEEDS

export function getProgramConfigAddress(programId = ASOL_SOLANA_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([ASOL_SOLANA_SEEDS.programAuthority], programId)[0]
}

export function getEsmsMintAddresses(programId = ASOL_SOLANA_PROGRAM_ID): PublicKey[] {
  return [0, 1, 2, 3].map(
    mintId =>
      PublicKey.findProgramAddressSync(
        [ASOL_SOLANA_SEEDS.esmsMint, Buffer.from([mintId])],
        programId
      )[0]
  )
}

/** Pinned deterministic Devnet ESMS PDA mint addresses derived from AAE_SOLANA_PROGRAM_ID */
export const ESMS_DEVNET_MINTS = {
  Spirit: new PublicKey('K5kwwomtWYydxJacA7bC5yUEW9TtEuVqBKBoqAWLmhQ'),
  Essence: new PublicKey('3FcpToU7bj4sLD687uecbesEjzjxBfqYn2EcBXJKPaCf'),
  Matter: new PublicKey('7naJZozLrknDF3dguAdEWn7Z4MviUkXitjhaAt57Vkb4'),
  Substance: new PublicKey('6RY6ZG1eJQ2uEvpyA6XK74WyF1MpTYbw97hdhELqDUsa'),
} as const

export function getReceiptAddress(
  kind: 'claim' | 'order',
  id: Uint8Array,
  programId = ASOL_SOLANA_PROGRAM_ID
): PublicKey {
  if (id.length !== 32) throw new Error('Receipt IDs must be exactly 32 bytes')
  const seed = kind === 'claim' ? ASOL_SOLANA_SEEDS.claimReceipt : ASOL_SOLANA_SEEDS.orderReceipt
  return PublicKey.findProgramAddressSync([seed, Buffer.from(id)], programId)[0]
}

export function getPersonaCommitmentAddress(
  agentId: Uint8Array,
  programId = ASOL_SOLANA_PROGRAM_ID
): PublicKey {
  if (agentId.length !== 32) throw new Error('Agent IDs must be exactly 32 bytes')
  return PublicKey.findProgramAddressSync(
    [ASOL_SOLANA_SEEDS.personaCommitment, Buffer.from(agentId)],
    programId
  )[0]
}

/**
 * Convert a hex claim/order id (`0x…`) to a 32-byte array.
 *
 * Lives here rather than in `solana-minter.ts` because the shop's client hook
 * needs it: that module reaches for `node:fs`/`node:os` to load a payer keypair
 * from disk, and importing it from a `'use client'` file pulled those built-ins
 * into the browser bundle and broke every Next.js production build.
 */
export function claimIdToBytes32(claimId: string): Uint8Array {
  const clean = claimId.startsWith('0x') ? claimId.slice(2) : claimId
  if (clean.length !== 64) throw new Error('claimId must be a 32-byte hex string')
  return Uint8Array.from(Buffer.from(clean, 'hex'))
}

/** Format Token-2022 raw units without ever crossing JavaScript's Number boundary. */
export function formatEsmsRawAmount(raw: bigint): string {
  if (raw < 0n) throw new RangeError('ESMS token balances cannot be negative')
  const whole = raw / ESMS_RAW_SCALE
  const fraction = (raw % ESMS_RAW_SCALE).toString().padStart(ESMS_DECIMALS, '0')
  return `${whole}.${fraction}`
}

export function buildRedeemAuthorizationMessage(args: {
  programId?: PublicKey
  clusterDomain: Uint8Array
  holder: PublicKey
  orderId: Uint8Array
  amounts: readonly bigint[]
  deadline: bigint
}): Buffer {
  const {
    programId = ASOL_SOLANA_PROGRAM_ID,
    clusterDomain,
    holder,
    orderId,
    amounts,
    deadline,
  } = args
  if (clusterDomain.length !== 32 || orderId.length !== 32 || amounts.length !== 4) {
    throw new Error('Authorization requires 32-byte domains/IDs and exactly four amounts')
  }
  const values = Buffer.alloc(8 * 5)
  amounts.forEach((amount, index) => values.writeBigUInt64LE(amount, index * 8))
  values.writeBigInt64LE(deadline, 32)
  return Buffer.concat([
    REDEEM_AUTHORIZATION_DOMAIN,
    programId.toBuffer(),
    Buffer.from(clusterDomain),
    holder.toBuffer(),
    Buffer.from(orderId),
    values,
  ])
}
