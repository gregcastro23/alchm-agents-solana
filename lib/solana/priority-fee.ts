import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  type TransactionInstruction,
} from '@solana/web3.js'

export const CLAIM_MINT_CU_LIMIT = 135_000
export const REDEEM_SELF_CU_LIMIT = 80_000
export const REDEEM_SPONSORED_CU_LIMIT = 115_000
export const RECORD_PERSONA_CU_LIMIT = 50_000
// Constellation AMM (Phase 6). These are measured, not estimated: the litesvm
// suite's `profiles_compute_units` executes each instruction against the compiled
// SBF program and fails if it outgrows the limit published here, so the two cannot
// drift. Observed 2026-08-28, first touch:
//   register_pool 11,586 | bootstrap_pool 12,850 | set_pool_pause      7,343
//   add_liquidity 61,034 | swap_esms      49,350 | withdraw_liquidity 36,164
// `withdrawLiquidity` carries extra headroom for the one case the harness cannot
// reach -- an owner who closed an emptied ATA between adding and withdrawing, so
// `init_if_needed` has to create both output ATAs (~25k each).
export const ADD_LIQUIDITY_CU_LIMIT = 85_000
export const SWAP_ESMS_CU_LIMIT = 75_000
export const WITHDRAW_LIQUIDITY_CU_LIMIT = 95_000
export const REGISTER_POOL_CU_LIMIT = 20_000
export const BOOTSTRAP_POOL_CU_LIMIT = 20_000
export const SET_POOL_PAUSE_CU_LIMIT = 15_000

export const DEFAULT_PRIORITY_FEE_PERCENTILE = 65
export const DEFAULT_MIN_MICRO_LAMPORTS = 5_000n
export const DEFAULT_MAX_MICRO_LAMPORTS = 2_000_000n

export const PROFILED_CU_LIMITS: Record<string, number> = {
  claim: CLAIM_MINT_CU_LIMIT,
  redeem: REDEEM_SELF_CU_LIMIT,
  redeemFor: REDEEM_SPONSORED_CU_LIMIT,
  persona: RECORD_PERSONA_CU_LIMIT,
  swap: SWAP_ESMS_CU_LIMIT,
  addLiquidity: ADD_LIQUIDITY_CU_LIMIT,
  withdrawLiquidity: WITHDRAW_LIQUIDITY_CU_LIMIT,
  registerPool: REGISTER_POOL_CU_LIMIT,
  bootstrapPool: BOOTSTRAP_POOL_CU_LIMIT,
  setPoolPause: SET_POOL_PAUSE_CU_LIMIT,
}

export function resolveComputeUnitLimit(transactionType: string, fallback = 200_000): number {
  return PROFILED_CU_LIMITS[transactionType] ?? fallback
}

export interface PriorityFeeOptions {
  percentile?: number
  minMicroLamports?: number | bigint
  maxMicroLamports?: number | bigint
}

/**
 * Dynamically estimates the prioritization fee in micro-lamports per compute unit
 * based on recent prioritization fees observed across locked writable accounts.
 *
 * Defaults:
 * - percentile: 65th percentile
 * - minMicroLamports: 5,000
 * - maxMicroLamports: 2,000,000
 */
export async function estimatePriorityFee(
  connection: Pick<Connection, 'getRecentPrioritizationFees'>,
  accounts: PublicKey[] = [],
  options: PriorityFeeOptions = {}
): Promise<bigint> {
  const percentile = options.percentile ?? DEFAULT_PRIORITY_FEE_PERCENTILE
  const minMicroLamports = BigInt(options.minMicroLamports ?? DEFAULT_MIN_MICRO_LAMPORTS)
  const maxMicroLamports = BigInt(options.maxMicroLamports ?? DEFAULT_MAX_MICRO_LAMPORTS)

  let fees: Array<{ prioritizationFee: number; slot: number }> = []
  try {
    const config = accounts.length > 0 ? { lockedWritableAccounts: accounts } : undefined
    fees = await (config
      ? connection.getRecentPrioritizationFees(config)
      : connection.getRecentPrioritizationFees())
  } catch {
    return minMicroLamports
  }

  const nonZeroFees = fees
    .map(f => f.prioritizationFee)
    .filter(fee => fee > 0)
    .sort((a, b) => a - b)

  if (nonZeroFees.length === 0) {
    return minMicroLamports
  }

  const pctRatio = percentile > 1 ? percentile / 100 : percentile
  const clampedRatio = Math.max(0, Math.min(1, pctRatio))
  const index = Math.min(
    nonZeroFees.length - 1,
    Math.max(0, Math.floor(clampedRatio * nonZeroFees.length))
  )
  const rawFee = BigInt(Math.round(nonZeroFees[index]))

  if (rawFee < minMicroLamports) return minMicroLamports
  if (rawFee > maxMicroLamports) return maxMicroLamports
  return rawFee
}

/**
 * Injects ComputeBudgetProgram instructions (limit and price) strictly at indices 0 and 1.
 * Any existing ComputeBudget instructions in the array are stripped to avoid conflicts.
 */
export function injectComputeBudgetInstructions(
  instructions: readonly TransactionInstruction[],
  config: { units: number; microLamports: bigint | number }
): TransactionInstruction[] {
  const limitIx = ComputeBudgetProgram.setComputeUnitLimit({ units: config.units })
  const priceIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports:
      typeof config.microLamports === 'number'
        ? BigInt(config.microLamports)
        : config.microLamports,
  })

  const COMPUTE_BUDGET_PROGRAM_ID = ComputeBudgetProgram.programId
  const businessInstructions = instructions.filter(
    ix => !ix.programId.equals(COMPUTE_BUDGET_PROGRAM_ID)
  )

  return [limitIx, priceIx, ...businessInstructions]
}
