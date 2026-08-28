import {
  Connection,
  Ed25519Program,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from '@solana/web3.js'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { keccak256 } from 'viem'

import {
  ASOL_SOLANA_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getEsmsMintAddresses,
  getProgramConfigAddress,
} from '@/lib/solana/esms'
import { openZeppelinStarLeaf } from '@/lib/solana/vectors'

export { ASOL_SOLANA_PROGRAM_ID }

export const STAR_VAULT_SEEDS = {
  starVault: Buffer.from('star-vault'),
  starPool: Buffer.from('star-pool'),
  stakePosition: Buffer.from('stake'),
} as const

export const STAR_YIELD_AUTHORIZATION_DOMAIN = Buffer.from('ASOL_STAR_YIELD_V1')
export const USDC_DECIMALS = 6
export const USDC_RAW_SCALE = 1_000_000n
export const SECONDS_PER_DAY = 86_400n
export const MAX_YIELD_RATE_PER_USDC_DAY = 1_000_000_0000n
export const MAX_STAR_PROOF_DEPTH = 32

export function getStarVaultAddress(programId = ASOL_SOLANA_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([STAR_VAULT_SEEDS.starVault], programId)
}

export function getStarPoolAddress(
  starId: number,
  programId = ASOL_SOLANA_PROGRAM_ID
): [PublicKey, number] {
  const starIdBuf = Buffer.alloc(4)
  starIdBuf.writeUInt32LE(starId, 0)
  return PublicKey.findProgramAddressSync([STAR_VAULT_SEEDS.starPool, starIdBuf], programId)
}

export function getStakePositionAddress(
  starId: number,
  staker: PublicKey,
  programId = ASOL_SOLANA_PROGRAM_ID
): [PublicKey, number] {
  const starIdBuf = Buffer.alloc(4)
  starIdBuf.writeUInt32LE(starId, 0)
  return PublicKey.findProgramAddressSync(
    [STAR_VAULT_SEEDS.stakePosition, starIdBuf, staker.toBuffer()],
    programId
  )
}

export interface YieldCapParams {
  principal: bigint
  maxRatePerUsdcDay: bigint
  elapsedSeconds: bigint
}

/**
 * Deterministically computes the yield accrual cap in ESMS atoms.
 * Formula: (principal * maxRatePerUsdcDay * elapsedSeconds) / (10^6 * 86400)
 */
export function calculateYieldCap({
  principal,
  maxRatePerUsdcDay,
  elapsedSeconds,
}: YieldCapParams): bigint {
  if (principal <= 0n || maxRatePerUsdcDay <= 0n || elapsedSeconds <= 0n) {
    return 0n
  }
  const numerator = principal * maxRatePerUsdcDay * elapsedSeconds
  const denominator = USDC_RAW_SCALE * SECONDS_PER_DAY
  return numerator / denominator
}

export interface CheckpointParams {
  currentPrincipal: bigint
  maxRatePerUsdcDay: bigint
  lastCheckpoint: bigint
  now: bigint
  accruedCap: bigint
}

export interface CheckpointResult {
  accruedCap: bigint
  lastCheckpoint: bigint
}

/**
 * Checkpoints position yield prior to any principal change.
 * Prevents retroactive yield accrual on fresh top-up capital.
 */
export function checkpointYield({
  currentPrincipal,
  maxRatePerUsdcDay,
  lastCheckpoint,
  now,
  accruedCap,
}: CheckpointParams): CheckpointResult {
  const elapsed = now > lastCheckpoint ? now - lastCheckpoint : 0n
  const updatedCheckpoint = now > lastCheckpoint ? now : lastCheckpoint
  if (elapsed <= 0n) {
    return {
      accruedCap,
      lastCheckpoint: updatedCheckpoint,
    }
  }
  if (currentPrincipal > 0n && maxRatePerUsdcDay > 0n) {
    const delta = calculateYieldCap({
      principal: currentPrincipal,
      maxRatePerUsdcDay,
      elapsedSeconds: elapsed,
    })
    return {
      accruedCap: accruedCap + delta,
      lastCheckpoint: updatedCheckpoint,
    }
  }
  return {
    accruedCap,
    lastCheckpoint: updatedCheckpoint,
  }
}

export interface StarYieldAuthorizationArgs {
  programId?: PublicKey
  clusterDomain: Uint8Array
  staker: PublicKey
  starId: number
  elementId: number
  amount: bigint
  nonce: bigint
  deadline: bigint
}

/**
 * Serializes the canonical Ed25519 authorization message for StarVault yield claims.
 */
export function buildStarYieldAuthorizationMessage(args: {
  programId?: PublicKey
  clusterDomain: Uint8Array
  staker: PublicKey
  starId: number
  elementId: number
  amount: bigint
  nonce: bigint
  deadline: bigint
}): Buffer {
  const {
    programId = ASOL_SOLANA_PROGRAM_ID,
    clusterDomain,
    staker,
    starId,
    elementId,
    amount,
    nonce,
    deadline,
  } = args

  if (clusterDomain.length !== 32) {
    throw new Error('clusterDomain must be exactly 32 bytes')
  }
  if (elementId < 0 || elementId > 3) {
    throw new RangeError('elementId must be between 0 and 3')
  }

  const starIdBuf = Buffer.alloc(4)
  starIdBuf.writeUInt32LE(starId, 0)

  const elementBuf = Buffer.from([elementId])

  const valuesBuf = Buffer.alloc(24)
  valuesBuf.writeBigUInt64LE(amount, 0)
  valuesBuf.writeBigUInt64LE(nonce, 8)
  valuesBuf.writeBigInt64LE(deadline, 16)

  return Buffer.concat([
    STAR_YIELD_AUTHORIZATION_DOMAIN,
    programId.toBuffer(),
    Buffer.from(clusterDomain),
    staker.toBuffer(),
    starIdBuf,
    elementBuf,
    valuesBuf,
  ])
}

/**
 * Verifies an OpenZeppelin StandardMerkleTree proof against the root.
 */

export function verifyStarMerkleProof(
  proof: readonly (string | Uint8Array)[],
  root: string,
  leaf: string
): boolean {
  let computed = (leaf.startsWith('0x') ? leaf : `0x${leaf}`) as `0x${string}`
  const normalizedRoot = (root.startsWith('0x') ? root : `0x${root}`).toLowerCase()

  for (const item of proof) {
    const itemHex = (
      typeof item === 'string'
        ? item.startsWith('0x')
          ? item
          : `0x${item}`
        : `0x${Buffer.from(item).toString('hex')}`
    ) as `0x${string}`

    const [first, second] =
      computed.toLowerCase() <= itemHex.toLowerCase() ? [computed, itemHex] : [itemHex, computed]

    const concatenated = `0x${first.slice(2)}${second.slice(2)}` as `0x${string}`
    computed = keccak256(concatenated)
  }

  return computed.toLowerCase() === normalizedRoot
}

export { openZeppelinStarLeaf }
