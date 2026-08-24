/**
 * Shop pricing helpers — convert a whole-ESMS basket into the shapes the
 * on-chain burn and affordability checks need.
 *
 * Digital items are priced in whole ESMS units per axis (like AGENT_OPERATION_COSTS
 * and the 12-ESMS context-card unlock). The on-chain token is 18-dp, so a cost of
 * `5 Spirit` becomes `5 * 1e18` when burned.
 */

import { parseUnits } from 'viem'
import type { EsmsAmounts } from '@/lib/esms-chain/redeemer'
import type { OnchainEsms } from '@/lib/esms-chain/contract'

export interface EsmsCost {
  spirit: number
  essence: number
  matter: number
  substance: number
}

export const ESMS_AXES = ['spirit', 'essence', 'matter', 'substance'] as const
export type EsmsAxis = (typeof ESMS_AXES)[number]

/** Total ESMS across all four axes. */
export function totalEsms(cost: EsmsCost): number {
  return cost.spirit + cost.essence + cost.matter + cost.substance
}

/** Cost as decimal strings for the redeemer (which scales to 18-dp). */
export function costToAmountStrings(cost: EsmsCost): EsmsAmounts {
  return {
    spirit: String(cost.spirit),
    essence: String(cost.essence),
    matter: String(cost.matter),
    substance: String(cost.substance),
  }
}

/** Whether on-chain balances (18-dp bigints) cover a whole-ESMS cost on every axis. */
export function canAffordOnchain(balances: OnchainEsms, cost: EsmsCost): boolean {
  return ESMS_AXES.every(axis => balances[axis] >= parseUnits(String(cost[axis]), 18))
}

/** The per-axis on-chain shortfall (18-dp), for "claim more to chain" messaging. */
export function onchainShortfall(balances: OnchainEsms, cost: EsmsCost): EsmsCost {
  const short = (axis: EsmsAxis): number => {
    const need = parseUnits(String(cost[axis]), 18)
    const have = balances[axis]
    if (have >= need) return 0
    // whole-ESMS shortfall, rounded up
    return Math.ceil(Number(need - have) / 1e18)
  }
  return {
    spirit: short('spirit'),
    essence: short('essence'),
    matter: short('matter'),
    substance: short('substance'),
  }
}

/** USD price formatted from cents, e.g. 1100 → "$11.00". */
export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/** 1 whole ESMS token = 10,000 raw atoms (4 decimal places) on Solana. */
export const SOLANA_RAW_SCALE = 10_000n

/**
 * Convert EsmsCost (whole units) to 4-dp raw u64 bigints on Solana.
 * Order: [Spirit (0), Essence (1), Matter (2), Substance (3)]
 */
export function costToSolanaAmounts(cost: EsmsCost): readonly [bigint, bigint, bigint, bigint] {
  return [
    BigInt(Math.max(0, cost.spirit)) * SOLANA_RAW_SCALE,
    BigInt(Math.max(0, cost.essence)) * SOLANA_RAW_SCALE,
    BigInt(Math.max(0, cost.matter)) * SOLANA_RAW_SCALE,
    BigInt(Math.max(0, cost.substance)) * SOLANA_RAW_SCALE,
  ]
}

/**
 * Whether Solana on-chain balances (4-dp raw bigints) cover the cost on every axis.
 */
export function canAffordSolana(
  balances: readonly [bigint, bigint, bigint, bigint],
  cost: EsmsCost
): boolean {
  const needed = costToSolanaAmounts(cost)
  return needed.every((need, index) => (balances[index] ?? 0n) >= need)
}

/**
 * The per-axis shortfall on Solana (in whole ESMS units, rounded up).
 */
export function solanaShortfall(
  balances: readonly [bigint, bigint, bigint, bigint],
  cost: EsmsCost
): EsmsCost {
  const needed = costToSolanaAmounts(cost)
  const short = (index: number): number => {
    const need = needed[index]
    const have = balances[index] ?? 0n
    if (have >= need) return 0
    return Math.ceil(Number(need - have) / Number(SOLANA_RAW_SCALE))
  }
  return {
    spirit: short(0),
    essence: short(1),
    matter: short(2),
    substance: short(3),
  }
}
