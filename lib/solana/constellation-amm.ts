/**
 * Client SDK for the Constellation virtual-reserve AMM (Phase 6).
 *
 * Ports `ConstellationAMM.sol` from Arc EVM. Three things differ, and the first is
 * the one a caller has to know:
 *
 * 1. **LP positions are not transferable.** Arc issues a `ConstellationDeed`
 *    ERC-721 -- a deliberately tradable trophy. On Solana the position is an
 *    owner-seeded `DeedPosition` PDA, which no instruction can move to another
 *    wallet. There is one position per `(owner, pool)`; a repeat add accumulates
 *    into it, and it closes and refunds its rent when its last share is redeemed.
 * 2. **Nothing is escrowed.** ESMS is soulbound, so the pool holds no custody:
 *    input is burned and output is minted. Reserves are bookkeeping in
 *    `ConstellationPool`, not balances.
 * 3. **Attestations are Ed25519 over a byte string**, not EIP-712. The Arc
 *    attestor key is secp256k1 and cannot sign for this path.
 *
 * The math here mirrors `programs/asol_program/src/state/amm.rs` exactly and is
 * pinned against it by `test/solana/constellation-amm.spec.ts`. It is for quoting
 * and previews only -- the program recomputes everything on chain.
 */

import { createHash } from 'node:crypto'
import {
  Ed25519Program,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  Transaction,
  type Connection,
  type TransactionInstruction,
} from '@solana/web3.js'
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token'

import { ASOL_SOLANA_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@/lib/solana/esms'
import {
  AMM_VISIBILITY_AUTHORIZATION_DOMAIN,
  buildAmmVisibilityAuthorizationVector,
} from '@/lib/solana/vectors'
import {
  ADD_LIQUIDITY_CU_LIMIT,
  BOOTSTRAP_POOL_CU_LIMIT,
  REGISTER_POOL_CU_LIMIT,
  SET_POOL_PAUSE_CU_LIMIT,
  SWAP_ESMS_CU_LIMIT,
  WITHDRAW_LIQUIDITY_CU_LIMIT,
  estimatePriorityFee,
  injectComputeBudgetInstructions,
} from '@/lib/solana/priority-fee'

/**
 * Re-exported so callers never have to reach for it separately. Phase 5 finding
 * **S8**: the star-vault client did not re-export it and a test silently passed
 * `programId: undefined`.
 */
export { ASOL_SOLANA_PROGRAM_ID, TOKEN_2022_PROGRAM_ID }

// ---------------------------------------------------------------------------
// Constants -- mirror programs/asol_program/src/constants.rs
// ---------------------------------------------------------------------------

export const CONSTELLATION_AMM_SEEDS = {
  programAuthority: Buffer.from('program_authority'),
  esmsMint: Buffer.from('esms_mint'),
  constellationPool: Buffer.from('constellation_pool'),
  deedPosition: Buffer.from('deed'),
  ammNonce: Buffer.from('amm_nonce'),
} as const

export { AMM_VISIBILITY_AUTHORIZATION_DOMAIN }

/** Byte length of the canonical `ASOL_AMM_VISIBILITY_V1` preimage. */
export const AMM_VISIBILITY_MESSAGE_BYTES = 170

export const AMM_OP_ADD_LIQUIDITY = 0
export const AMM_OP_SWAP = 1

/** 10%. Above this a pool is registerable but every swap would revert. */
export const MAX_FEE_BPS = 1_000
export const BPS_DENOMINATOR = 10_000
/** 1%: the tolerance an `add_liquidity` deposit may be off the pool's ratio. */
export const RATIO_TOLERANCE_BPS = 100
export const MINIMUM_LIQUIDITY = 1_000n
/** 100,000.0000 ESMS, the per-element ceiling on a one-shot bootstrap. */
export const MAX_BOOTSTRAP_RESERVE = 1_000_000_000n

export type EsmsElementId = 0 | 1 | 2 | 3

/**
 * The six canonical element pairs, indexed by `poolId`. Ordering is `a < b` and is
 * enforced on chain, so a pair cannot be registered under both orderings as two
 * divergent pools. Matches `PAIRS` in `lib/staking/amm.ts`.
 */
export const CONSTELLATION_PAIRS: ReadonlyArray<readonly [EsmsElementId, EsmsElementId]> = [
  [0, 1], // Spirit-Essence
  [0, 2], // Spirit-Matter
  [0, 3], // Spirit-Substance
  [1, 2], // Essence-Matter
  [1, 3], // Essence-Substance
  [2, 3], // Matter-Substance
]

export const MAX_AMM_POOL_ID = CONSTELLATION_PAIRS.length - 1

/** `poolId` for an unordered element pair, or -1 for identical elements. */
export function poolIdForPair(a: EsmsElementId, b: EsmsElementId): number {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  if (lo === hi) return -1
  return CONSTELLATION_PAIRS.findIndex(pair => pair[0] === lo && pair[1] === hi)
}

// ---------------------------------------------------------------------------
// PDAs
// ---------------------------------------------------------------------------

function poolIdBuffer(poolId: number): Buffer {
  if (!Number.isInteger(poolId) || poolId < 0 || poolId > 0xffff) {
    throw new RangeError(`poolId must be a u16, received ${poolId}`)
  }
  const buffer = Buffer.alloc(2)
  buffer.writeUInt16LE(poolId, 0)
  return buffer
}

export function getProgramConfigAddress(programId = ASOL_SOLANA_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([CONSTELLATION_AMM_SEEDS.programAuthority], programId)[0]
}

export function getEsmsMintAddress(
  element: EsmsElementId,
  programId = ASOL_SOLANA_PROGRAM_ID
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [CONSTELLATION_AMM_SEEDS.esmsMint, Buffer.from([element])],
    programId
  )[0]
}

export function getConstellationPoolAddress(
  poolId: number,
  programId = ASOL_SOLANA_PROGRAM_ID
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [CONSTELLATION_AMM_SEEDS.constellationPool, poolIdBuffer(poolId)],
    programId
  )[0]
}

/**
 * One position per `(owner, pool)`. `poolId` is part of the seed, so a position
 * opened against one pool cannot be presented against another -- and two pools held
 * by the same wallet derive to distinct accounts.
 */
export function getDeedPositionAddress(
  poolId: number,
  owner: PublicKey,
  programId = ASOL_SOLANA_PROGRAM_ID
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [CONSTELLATION_AMM_SEEDS.deedPosition, poolIdBuffer(poolId), owner.toBuffer()],
    programId
  )[0]
}

export function getPoolTraderNonceAddress(
  poolId: number,
  trader: PublicKey,
  programId = ASOL_SOLANA_PROGRAM_ID
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [CONSTELLATION_AMM_SEEDS.ammNonce, poolIdBuffer(poolId), trader.toBuffer()],
    programId
  )[0]
}

function esmsAta(owner: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, true, TOKEN_2022_PROGRAM_ID)
}

// ---------------------------------------------------------------------------
// Pure math -- mirrors state/amm.rs
// ---------------------------------------------------------------------------

/** Babylonian integer square root. Mirrors `integer_sqrt`. */
export function integerSqrt(y: bigint): bigint {
  if (y < 0n) throw new RangeError('integerSqrt is not defined for negative values')
  if (y > 3n) {
    let z = y
    let x = y / 2n + 1n
    while (x < z) {
      z = x
      x = (y / x + x) / 2n
    }
    return z
  }
  return y === 0n ? 0n : 1n
}

/**
 * Constant-product quote with the fee taken off the input. Mirrors `quote_swap`;
 * every division floors, which floors toward the pool.
 */
export function quoteAmmSwap(args: {
  reserveIn: bigint
  reserveOut: bigint
  feeBps: number
  inAmount: bigint
}): bigint {
  const { reserveIn, reserveOut, feeBps, inAmount } = args
  if (inAmount <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n
  if (feeBps < 0 || feeBps > BPS_DENOMINATOR) {
    throw new RangeError(`feeBps must be 0..=${BPS_DENOMINATOR}, received ${feeBps}`)
  }
  const inWithFee =
    (inAmount * (BigInt(BPS_DENOMINATOR) - BigInt(feeBps))) / BigInt(BPS_DENOMINATOR)
  const denominator = reserveIn + inWithFee
  if (denominator === 0n) return 0n
  return (reserveOut * inWithFee) / denominator
}

export class OffRatioDepositError extends Error {
  constructor(
    readonly sharesA: bigint,
    readonly sharesB: bigint
  ) {
    super(
      `deposit is off the pool ratio by more than ${RATIO_TOLERANCE_BPS / 100}%: ` +
        `${sharesA} vs ${sharesB} shares`
    )
    this.name = 'OffRatioDepositError'
  }
}

/**
 * Shares minted for a deposit. Mirrors `compute_add_shares`: the lower of the two
 * per-side share counts is minted, and the pair must be within
 * `RATIO_TOLERANCE_BPS` of the pool's ratio.
 */
export function calculateAddLiquidityShares(args: {
  reserveA: bigint
  reserveB: bigint
  totalShares: bigint
  amtA: bigint
  amtB: bigint
}): bigint {
  const { reserveA, reserveB, totalShares, amtA, amtB } = args
  if (amtA <= 0n || amtB <= 0n) throw new RangeError('both deposit legs must be positive')
  if (reserveA <= 0n || reserveB <= 0n || totalShares <= 0n) {
    throw new Error('pool has not been bootstrapped')
  }
  const sharesA = (amtA * totalShares) / reserveA
  const sharesB = (amtB * totalShares) / reserveB
  const lo = sharesA < sharesB ? sharesA : sharesB
  const hi = sharesA < sharesB ? sharesB : sharesA
  if (lo <= 0n) throw new Error('deposit is too small to mint a share')
  if ((hi - lo) * BigInt(BPS_DENOMINATOR) > lo * BigInt(RATIO_TOLERANCE_BPS)) {
    throw new OffRatioDepositError(sharesA, sharesB)
  }
  return lo
}

export interface WithdrawalAmounts {
  pullShares: bigint
  amtA: bigint
  amtB: bigint
  remainingShares: bigint
  /** The program closes the position and refunds its rent when this is true. */
  closesPosition: boolean
}

/**
 * Mirrors `compute_withdrawal`. `shareBps` is a fraction of the caller's *own*
 * position, not of the pool. Both legs floor toward the pool.
 */
export function calculateWithdrawalAmounts(args: {
  reserveA: bigint
  reserveB: bigint
  totalShares: bigint
  shares: bigint
  shareBps: number
}): WithdrawalAmounts {
  const { reserveA, reserveB, totalShares, shares, shareBps } = args
  if (!Number.isInteger(shareBps) || shareBps <= 0 || shareBps > BPS_DENOMINATOR) {
    throw new RangeError(`shareBps must be 1..=${BPS_DENOMINATOR}, received ${shareBps}`)
  }
  if (shares <= 0n) throw new RangeError('position holds no shares')
  if (totalShares <= 0n) throw new Error('pool holds no shares')

  let pullShares = (shares * BigInt(shareBps)) / BigInt(BPS_DENOMINATOR)
  if (pullShares <= 0n) {
    throw new RangeError(`shareBps ${shareBps} rounds to zero shares on a ${shares}-share position`)
  }
  if (pullShares > shares) pullShares = shares

  const remainingShares = shares - pullShares
  return {
    pullShares,
    amtA: (reserveA * pullShares) / totalShares,
    amtB: (reserveB * pullShares) / totalShares,
    remainingShares,
    closesPosition: remainingShares === 0n,
  }
}

// ---------------------------------------------------------------------------
// Attestation preimage
// ---------------------------------------------------------------------------

export interface AmmVisibilityAuthorizationArgs {
  programId?: PublicKey
  clusterDomain: Uint8Array
  trader: PublicKey
  poolId: number
  /** `AMM_OP_ADD_LIQUIDITY` or `AMM_OP_SWAP`. Bound so an add signature cannot be spent on a swap. */
  op: number
  regionCommit: Uint8Array
  visibleStars: number
  /** Must equal the trader's current on-chain `PoolTraderNonce.nonce`. */
  nonce: bigint
  deadline: bigint
}

/**
 * The canonical 170-byte `ASOL_AMM_VISIBILITY_V1` preimage the attestor signs.
 *
 * ```text
 *   0  domain          22   b"ASOL_AMM_VISIBILITY_V1"
 *  22  program_id      32   binds the message to this deployment
 *  54  cluster_domain  32   from ProgramConfig
 *  86  trader          32
 * 118  pool_id          2   u16 LE
 * 120  op               1   0 = add_liquidity, 1 = swap
 * 121  region_commit   32
 * 153  visible_stars    1
 * 154  nonce            8   u64 LE
 * 162  deadline         8   i64 LE
 * ```
 *
 * Byte-identical to `amm_visibility_authorization_message` in
 * `programs/asol_program/src/vectors.rs`, asserted against the same hex vector.
 */
export function buildAmmVisibilityAuthorizationMessage(
  args: AmmVisibilityAuthorizationArgs
): Buffer {
  const {
    programId = ASOL_SOLANA_PROGRAM_ID,
    clusterDomain,
    trader,
    poolId,
    op,
    regionCommit,
    visibleStars,
    nonce,
    deadline,
  } = args

  if (clusterDomain.length !== 32) throw new RangeError('clusterDomain must be exactly 32 bytes')
  if (regionCommit.length !== 32) throw new RangeError('regionCommit must be exactly 32 bytes')
  if (op !== AMM_OP_ADD_LIQUIDITY && op !== AMM_OP_SWAP) {
    throw new RangeError(`op must be ${AMM_OP_ADD_LIQUIDITY} or ${AMM_OP_SWAP}, received ${op}`)
  }
  if (!Number.isInteger(visibleStars) || visibleStars < 0 || visibleStars > 255) {
    throw new RangeError('visibleStars must fit in a u8')
  }

  // Serialisation itself lives in `lib/solana/vectors.ts`, which mirrors the Rust
  // `vectors.rs` byte for byte. This wrapper only adds the typed, validated
  // interface: a second copy of the layout is a second place for it to drift.
  const message = buildAmmVisibilityAuthorizationVector({
    programId: programId.toBytes(),
    clusterDomain,
    trader: trader.toBytes(),
    poolId,
    op,
    regionCommit,
    visibleStars,
    nonce,
    deadline,
  })

  /* istanbul ignore next -- a length drift here is a protocol break, not a bad input */
  if (message.length !== AMM_VISIBILITY_MESSAGE_BYTES) {
    throw new Error(
      `attestation preimage is ${message.length} bytes, expected ${AMM_VISIBILITY_MESSAGE_BYTES}`
    )
  }
  return message
}

// ---------------------------------------------------------------------------
// Instruction encoding
// ---------------------------------------------------------------------------

/** Anchor instruction discriminator: `sha256("global:<snake_case_name>")[..8]`. */
export function anchorDiscriminator(instructionName: string): Buffer {
  return createHash('sha256').update(`global:${instructionName}`).digest().subarray(0, 8)
}

function u16le(value: number): Buffer {
  const buffer = Buffer.alloc(2)
  buffer.writeUInt16LE(value, 0)
  return buffer
}

function u64le(value: bigint): Buffer {
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64LE(value, 0)
  return buffer
}

function i64le(value: bigint): Buffer {
  const buffer = Buffer.alloc(8)
  buffer.writeBigInt64LE(value, 0)
  return buffer
}

// ---------------------------------------------------------------------------
// Admin instructions
// ---------------------------------------------------------------------------

export function buildRegisterPoolInstruction(args: {
  poolId: number
  elementA: EsmsElementId
  elementB: EsmsElementId
  feeBps: number
  admin: PublicKey
  programId?: PublicKey
}): TransactionInstruction {
  const { poolId, elementA, elementB, feeBps, admin, programId = ASOL_SOLANA_PROGRAM_ID } = args
  if (elementA >= elementB) {
    throw new RangeError(
      `elements must be canonically ordered (a < b), received ${elementA},${elementB}`
    )
  }
  if (poolId > MAX_AMM_POOL_ID) {
    throw new RangeError(`poolId must be 0..=${MAX_AMM_POOL_ID}, received ${poolId}`)
  }
  if (feeBps > MAX_FEE_BPS) {
    throw new RangeError(`feeBps must be <= ${MAX_FEE_BPS}, received ${feeBps}`)
  }

  return {
    programId,
    keys: [
      { pubkey: getProgramConfigAddress(programId), isSigner: false, isWritable: false },
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: getConstellationPoolAddress(poolId, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      anchorDiscriminator('register_pool'),
      u16le(poolId),
      Buffer.from([elementA, elementB]),
      u16le(feeBps),
    ]),
  }
}

/**
 * One-shot. `register_pool` uses `init` rather than `init_if_needed` and the pool
 * refuses a second bootstrap, which closes Arc's repeatable-`seedInitial` hole:
 * there, re-seeding minted the admin a withdrawable position against reserves
 * nobody had funded. All bootstrap shares here are permanently locked and no
 * position is created.
 */
export function buildBootstrapPoolInstruction(args: {
  poolId: number
  reserveA: bigint
  reserveB: bigint
  admin: PublicKey
  programId?: PublicKey
}): TransactionInstruction {
  const { poolId, reserveA, reserveB, admin, programId = ASOL_SOLANA_PROGRAM_ID } = args
  if (reserveA <= 0n || reserveB <= 0n) throw new RangeError('both reserves must be positive')
  if (reserveA > MAX_BOOTSTRAP_RESERVE || reserveB > MAX_BOOTSTRAP_RESERVE) {
    throw new RangeError(`reserves must be <= ${MAX_BOOTSTRAP_RESERVE} atoms`)
  }
  if (integerSqrt(reserveA * reserveB) <= MINIMUM_LIQUIDITY) {
    throw new RangeError(`bootstrap must mint more than ${MINIMUM_LIQUIDITY} shares`)
  }

  return {
    programId,
    keys: [
      { pubkey: getProgramConfigAddress(programId), isSigner: false, isWritable: false },
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: getConstellationPoolAddress(poolId, programId), isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([
      anchorDiscriminator('bootstrap_pool'),
      u16le(poolId),
      u64le(reserveA),
      u64le(reserveB),
    ]),
  }
}

/**
 * Pause is per-pool, not global: `ProgramConfig` is live on devnet at exactly its
 * allocated size, so it cannot grow a field without bricking every existing claim
 * and redemption. Pausing blocks `add_liquidity` and `swap_esms`; withdrawal is
 * deliberately never gated, so liquidity can always leave.
 */
export function buildSetPoolPauseInstruction(args: {
  poolId: number
  paused: boolean
  authority: PublicKey
  programId?: PublicKey
}): TransactionInstruction {
  const { poolId, paused, authority, programId = ASOL_SOLANA_PROGRAM_ID } = args
  return {
    programId,
    keys: [
      { pubkey: getProgramConfigAddress(programId), isSigner: false, isWritable: false },
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: getConstellationPoolAddress(poolId, programId), isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([
      anchorDiscriminator('set_pool_pause'),
      u16le(poolId),
      Buffer.from([paused ? 1 : 0]),
    ]),
  }
}

// ---------------------------------------------------------------------------
// Attested instructions
// ---------------------------------------------------------------------------

export interface AttestationEnvelope {
  /** The attestor public key, which must equal `ProgramConfig.attestor`. */
  attestor: PublicKey
  /** 64-byte Ed25519 signature over the 170-byte preimage. */
  signature: Uint8Array
  regionCommit: Uint8Array
  visibleStars: number
  nonce: bigint
  deadline: bigint
  clusterDomain: Uint8Array
}

export function buildAddLiquidityInstruction(args: {
  poolId: number
  elementA: EsmsElementId
  elementB: EsmsElementId
  amtA: bigint
  amtB: bigint
  minShares: bigint
  trader: PublicKey
  attestation: AttestationEnvelope
  programId?: PublicKey
}): TransactionInstruction {
  const {
    poolId,
    elementA,
    elementB,
    amtA,
    amtB,
    minShares,
    trader,
    attestation,
    programId = ASOL_SOLANA_PROGRAM_ID,
  } = args
  const mintA = getEsmsMintAddress(elementA, programId)
  const mintB = getEsmsMintAddress(elementB, programId)

  return {
    programId,
    keys: [
      { pubkey: getProgramConfigAddress(programId), isSigner: false, isWritable: false },
      { pubkey: getConstellationPoolAddress(poolId, programId), isSigner: false, isWritable: true },
      { pubkey: trader, isSigner: true, isWritable: true },
      {
        pubkey: getPoolTraderNonceAddress(poolId, trader, programId),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: mintA, isSigner: false, isWritable: true },
      { pubkey: mintB, isSigner: false, isWritable: true },
      { pubkey: esmsAta(trader, mintA), isSigner: false, isWritable: true },
      { pubkey: esmsAta(trader, mintB), isSigner: false, isWritable: true },
      {
        pubkey: getDeedPositionAddress(poolId, trader, programId),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      anchorDiscriminator('add_liquidity'),
      u16le(poolId),
      u64le(amtA),
      u64le(amtB),
      u64le(minShares),
      Buffer.from(attestation.regionCommit),
      Buffer.from([attestation.visibleStars]),
      u64le(attestation.nonce),
      i64le(attestation.deadline),
    ]),
  }
}

export function buildSwapEsmsInstruction(args: {
  poolId: number
  elementA: EsmsElementId
  elementB: EsmsElementId
  inElement: EsmsElementId
  inAmount: bigint
  minOut: bigint
  trader: PublicKey
  attestation: AttestationEnvelope
  programId?: PublicKey
}): TransactionInstruction {
  const {
    poolId,
    elementA,
    elementB,
    inElement,
    inAmount,
    minOut,
    trader,
    attestation,
    programId = ASOL_SOLANA_PROGRAM_ID,
  } = args
  if (inElement !== elementA && inElement !== elementB) {
    throw new RangeError(`inElement ${inElement} is not in pool ${poolId}'s pair`)
  }
  const mintA = getEsmsMintAddress(elementA, programId)
  const mintB = getEsmsMintAddress(elementB, programId)
  // The output element is derived here only to pick the ATA. It is deliberately
  // *not* part of the instruction payload: the program recomputes it from pool
  // state, so it is never an argument an attacker can steer.
  const inMint = inElement === elementA ? mintA : mintB
  const outMint = inElement === elementA ? mintB : mintA

  return {
    programId,
    keys: [
      { pubkey: getProgramConfigAddress(programId), isSigner: false, isWritable: false },
      { pubkey: getConstellationPoolAddress(poolId, programId), isSigner: false, isWritable: true },
      { pubkey: trader, isSigner: true, isWritable: true },
      {
        pubkey: getPoolTraderNonceAddress(poolId, trader, programId),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: mintA, isSigner: false, isWritable: true },
      { pubkey: mintB, isSigner: false, isWritable: true },
      { pubkey: esmsAta(trader, inMint), isSigner: false, isWritable: true },
      // Created idempotently by the program; the handler asserts this is the
      // canonical ATA for `outMint` before any CPI.
      { pubkey: esmsAta(trader, outMint), isSigner: false, isWritable: true },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      anchorDiscriminator('swap_esms'),
      u16le(poolId),
      Buffer.from([inElement]),
      u64le(inAmount),
      u64le(minOut),
      Buffer.from(attestation.regionCommit),
      Buffer.from([attestation.visibleStars]),
      u64le(attestation.nonce),
      i64le(attestation.deadline),
    ]),
  }
}

/**
 * Unconditional: no attestation, no pause gate. `shareBps` is a fraction of the
 * caller's own position (`1..=10000`); the position account is closed and its rent
 * refunded once its last share is redeemed.
 */
export function buildWithdrawLiquidityInstruction(args: {
  poolId: number
  elementA: EsmsElementId
  elementB: EsmsElementId
  shareBps: number
  owner: PublicKey
  programId?: PublicKey
}): TransactionInstruction {
  const { poolId, elementA, elementB, shareBps, owner, programId = ASOL_SOLANA_PROGRAM_ID } = args
  if (!Number.isInteger(shareBps) || shareBps <= 0 || shareBps > BPS_DENOMINATOR) {
    throw new RangeError(`shareBps must be 1..=${BPS_DENOMINATOR}, received ${shareBps}`)
  }
  const mintA = getEsmsMintAddress(elementA, programId)
  const mintB = getEsmsMintAddress(elementB, programId)

  return {
    programId,
    keys: [
      { pubkey: getProgramConfigAddress(programId), isSigner: false, isWritable: false },
      { pubkey: getConstellationPoolAddress(poolId, programId), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: mintA, isSigner: false, isWritable: true },
      { pubkey: mintB, isSigner: false, isWritable: true },
      { pubkey: esmsAta(owner, mintA), isSigner: false, isWritable: true },
      { pubkey: esmsAta(owner, mintB), isSigner: false, isWritable: true },
      {
        pubkey: getDeedPositionAddress(poolId, owner, programId),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      anchorDiscriminator('withdraw_liquidity'),
      u16le(poolId),
      u16le(shareBps),
    ]),
  }
}

// ---------------------------------------------------------------------------
// Transaction assembly
// ---------------------------------------------------------------------------

/**
 * The Ed25519 precompile instruction carrying the attestation.
 *
 * The program reads the instruction at `current_index - 1` and requires all three
 * of the precompile's `instruction_index` fields to be `u16::MAX`, so the signature
 * must live in this instruction's own data and sit immediately before the AMM
 * instruction. `buildAttestedTransaction` is what keeps that true once compute
 * budget instructions are prepended.
 */
export function buildEd25519AttestationInstruction(
  attestation: Pick<AttestationEnvelope, 'attestor' | 'signature'>,
  message: Buffer
): TransactionInstruction {
  if (attestation.signature.length !== 64) {
    throw new RangeError('an Ed25519 signature must be exactly 64 bytes')
  }
  return Ed25519Program.createInstructionWithPublicKey({
    publicKey: attestation.attestor.toBytes(),
    message,
    signature: attestation.signature,
  })
}

async function buildAttestedTransaction(args: {
  connection: Pick<Connection, 'getRecentPrioritizationFees'>
  instruction: TransactionInstruction
  message: Buffer
  attestation: AttestationEnvelope
  computeUnitLimit: number
  feePayer: PublicKey
}): Promise<Transaction> {
  const { connection, instruction, message, attestation, computeUnitLimit, feePayer } = args
  const microLamports = await estimatePriorityFee(
    connection,
    instruction.keys.filter(key => key.isWritable).map(key => key.pubkey)
  )
  // ComputeBudget instructions land at 0 and 1, so the Ed25519 instruction ends up
  // at index 2 and the AMM instruction at 3 -- adjacency preserved.
  const instructions = injectComputeBudgetInstructions(
    [buildEd25519AttestationInstruction(attestation, message), instruction],
    { units: computeUnitLimit, microLamports }
  )
  const transaction = new Transaction().add(...instructions)
  transaction.feePayer = feePayer
  return transaction
}

export async function buildAddLiquidityTransaction(args: {
  connection: Pick<Connection, 'getRecentPrioritizationFees'>
  poolId: number
  elementA: EsmsElementId
  elementB: EsmsElementId
  amtA: bigint
  amtB: bigint
  minShares: bigint
  trader: PublicKey
  attestation: AttestationEnvelope
  programId?: PublicKey
}): Promise<Transaction> {
  const instruction = buildAddLiquidityInstruction(args)
  const message = buildAmmVisibilityAuthorizationMessage({
    programId: args.programId,
    clusterDomain: args.attestation.clusterDomain,
    trader: args.trader,
    poolId: args.poolId,
    op: AMM_OP_ADD_LIQUIDITY,
    regionCommit: args.attestation.regionCommit,
    visibleStars: args.attestation.visibleStars,
    nonce: args.attestation.nonce,
    deadline: args.attestation.deadline,
  })
  return buildAttestedTransaction({
    connection: args.connection,
    instruction,
    message,
    attestation: args.attestation,
    computeUnitLimit: ADD_LIQUIDITY_CU_LIMIT,
    feePayer: args.trader,
  })
}

export async function buildSwapEsmsTransaction(args: {
  connection: Pick<Connection, 'getRecentPrioritizationFees'>
  poolId: number
  elementA: EsmsElementId
  elementB: EsmsElementId
  inElement: EsmsElementId
  inAmount: bigint
  minOut: bigint
  trader: PublicKey
  attestation: AttestationEnvelope
  programId?: PublicKey
}): Promise<Transaction> {
  const instruction = buildSwapEsmsInstruction(args)
  const message = buildAmmVisibilityAuthorizationMessage({
    programId: args.programId,
    clusterDomain: args.attestation.clusterDomain,
    trader: args.trader,
    poolId: args.poolId,
    op: AMM_OP_SWAP,
    regionCommit: args.attestation.regionCommit,
    visibleStars: args.attestation.visibleStars,
    nonce: args.attestation.nonce,
    deadline: args.attestation.deadline,
  })
  return buildAttestedTransaction({
    connection: args.connection,
    instruction,
    message,
    attestation: args.attestation,
    computeUnitLimit: SWAP_ESMS_CU_LIMIT,
    feePayer: args.trader,
  })
}

export async function buildWithdrawLiquidityTransaction(args: {
  connection: Pick<Connection, 'getRecentPrioritizationFees'>
  poolId: number
  elementA: EsmsElementId
  elementB: EsmsElementId
  shareBps: number
  owner: PublicKey
  programId?: PublicKey
}): Promise<Transaction> {
  const instruction = buildWithdrawLiquidityInstruction(args)
  const microLamports = await estimatePriorityFee(
    args.connection,
    instruction.keys.filter(key => key.isWritable).map(key => key.pubkey)
  )
  const transaction = new Transaction().add(
    ...injectComputeBudgetInstructions([instruction], {
      units: WITHDRAW_LIQUIDITY_CU_LIMIT,
      microLamports,
    })
  )
  transaction.feePayer = args.owner
  return transaction
}

export const ADMIN_CU_LIMITS = {
  registerPool: REGISTER_POOL_CU_LIMIT,
  bootstrapPool: BOOTSTRAP_POOL_CU_LIMIT,
  setPoolPause: SET_POOL_PAUSE_CU_LIMIT,
} as const

// ---------------------------------------------------------------------------
// Account decoding
// ---------------------------------------------------------------------------

export interface ConstellationPoolState {
  version: number
  poolId: number
  elementA: EsmsElementId
  elementB: EsmsElementId
  feeBps: number
  reserveA: bigint
  reserveB: bigint
  totalShares: bigint
  bootstrapped: boolean
  paused: boolean
  bump: number
}

export interface DeedPositionState {
  version: number
  poolId: number
  owner: PublicKey
  shares: bigint
  createdSlot: bigint
  bump: number
}

/** Anchor account discriminator: `sha256("account:<Name>")[..8]`. */
export function anchorAccountDiscriminator(accountName: string): Buffer {
  return createHash('sha256').update(`account:${accountName}`).digest().subarray(0, 8)
}

function requireDiscriminator(data: Buffer, accountName: string): Buffer {
  const expected = anchorAccountDiscriminator(accountName)
  if (data.length < 8 || !data.subarray(0, 8).equals(expected)) {
    throw new Error(`account data is not a ${accountName}`)
  }
  return data.subarray(8)
}

export function decodeConstellationPool(data: Buffer): ConstellationPoolState {
  const body = requireDiscriminator(data, 'ConstellationPool')
  return {
    version: body.readUInt8(0),
    poolId: body.readUInt16LE(1),
    elementA: body.readUInt8(3) as EsmsElementId,
    elementB: body.readUInt8(4) as EsmsElementId,
    feeBps: body.readUInt16LE(5),
    reserveA: body.readBigUInt64LE(7),
    reserveB: body.readBigUInt64LE(15),
    totalShares: body.readBigUInt64LE(23),
    bootstrapped: body.readUInt8(31) === 1,
    paused: body.readUInt8(32) === 1,
    bump: body.readUInt8(33),
  }
}

export function decodeDeedPosition(data: Buffer): DeedPositionState {
  const body = requireDiscriminator(data, 'DeedPosition')
  return {
    version: body.readUInt8(0),
    poolId: body.readUInt16LE(1),
    owner: new PublicKey(body.subarray(3, 35)),
    shares: body.readBigUInt64LE(35),
    createdSlot: body.readBigUInt64LE(43),
    bump: body.readUInt8(51),
  }
}

export function decodePoolTraderNonce(data: Buffer): {
  version: number
  poolId: number
  trader: PublicKey
  nonce: bigint
  bump: number
} {
  const body = requireDiscriminator(data, 'PoolTraderNonce')
  return {
    version: body.readUInt8(0),
    poolId: body.readUInt16LE(1),
    trader: new PublicKey(body.subarray(3, 35)),
    nonce: body.readBigUInt64LE(35),
    bump: body.readUInt8(43),
  }
}

/**
 * The trader's next attestation nonce. An account that does not exist yet reads as
 * 0, which is what the program expects on a first touch.
 */
export async function fetchPoolTraderNonce(
  connection: Pick<Connection, 'getAccountInfo'>,
  poolId: number,
  trader: PublicKey,
  programId = ASOL_SOLANA_PROGRAM_ID
): Promise<bigint> {
  const address = getPoolTraderNonceAddress(poolId, trader, programId)
  const account = await connection.getAccountInfo(address)
  if (!account) return 0n
  return decodePoolTraderNonce(Buffer.from(account.data)).nonce
}
