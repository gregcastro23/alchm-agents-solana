/**
 * Pentacle Vessel Rating Scale: ratings, OVR and archetype for the Sacred 7.
 *
 * This module is the bridge between ASOL's seven core stats (0–100, from
 * `deriveStatsFromChart`) and the Pentacles rating contract (`lib/agents/rating-contract.ts`,
 * ratified in #65). The contract owns every formula and constant that decides what a number
 * *means*; this file only converts a stat onto the contract's 25–99 scale and calls the
 * contract's functions:
 *
 *   stat (0–100) ──toRating──► rating (25–99) ──► computeOvr               → ovr
 *                                              ├─► computeRelativeAdvantage → relativeAdvantage
 *                                              └─► resolveArchetype        → archetype
 *
 * Nothing is re-derived here, so the two cannot drift: `test/agents/rating-contract-parity.spec.ts`
 * fails if a result ever differs from the contract's own function on the same ratings.
 *
 * ## What the contract's constants do to the roster
 *
 * The contract's pinned `ROSTER_BASELINE_RATINGS` are used as given. Measured over the 72
 * `HISTORICAL_AGENTS` (2026-10-19) they are NOT the roster's rating-scale means or medians (for
 * `power` the contract says mean 76.5 / baseline 63, the roster's mean rating is 81.6 and its
 * median 83), so `computeRelativeAdvantage` names `power` the primary stat of 46 of 72 agents
 * and the roster shares 18 distinct titles. That is a property of the contract's numbers, not of
 * this module: re-measuring them is a one-file change in `rating-contract.ts`, and the
 * calibration diagnostics in the parity spec flip as soon as it lands.
 *
 * It is deliberately NOT `calculateOverall` from `lib/sacred-7-stats.ts`, which is the plain
 * mean of all 19 stats and feeds other surfaces.
 */
import type { CraftedAgent } from '@/lib/agent-types'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import type { Sacred7Stats } from '@/lib/sacred-7-stats'
import {
  SACRED_STAT_KEYS,
  clampStat,
  computeOvr,
  computeRelativeAdvantage,
  resolveArchetype,
  type SacredStatKey,
  type VesselArchetype,
} from '../rating-contract'

export type { SacredStatKey, VesselArchetype }

/** Canonical order (the contract's). Also the tie-break order for ranking. */
export const CORE_STAT_KEYS = SACRED_STAT_KEYS

export type CoreStatKey = SacredStatKey
export type CoreStats = Pick<Sacred7Stats, CoreStatKey>

/** A stat of 0 rates as the floor and a stat of 100 as the ceiling. */
export const RATING_FLOOR = 25
export const RATING_CEILING = 99

/** The scale's public name and bounds, for payloads and UI copy. */
export const VESSEL_RATING_SCALE = {
  name: 'Pentacle Vessel Rating Scale',
  floor: RATING_FLOOR,
  ceiling: RATING_CEILING,
} as const

export interface AgentRating {
  /** Per-stat rating, `RATING_FLOOR`–`RATING_CEILING`, integers. */
  ratings: Record<CoreStatKey, number>
  /** Overall, `RATING_FLOOR`–`RATING_CEILING` (the contract's ordered weighted average). */
  ovr: number
  /** Each stat's rating minus the contract's pinned roster baseline, 1 dp. */
  relativeAdvantage: Record<CoreStatKey, number>
  archetype: VesselArchetype
}

/** Validate and clamp a 0–100 stat. Non-finite input throws; finite out-of-range is clamped. */
function checkedStat(stat: number, label: string): number {
  if (!Number.isFinite(stat)) {
    throw new RangeError(`Cannot rate ${label}: ${String(stat)} is not a finite number`)
  }
  return Math.min(100, Math.max(0, stat))
}

/**
 * Map a 0–100 stat onto the 25–99 rating scale. Out-of-range input is clamped;
 * non-finite input throws rather than rating as the floor, because a rating
 * that silently reads as "bad" would hide a broken chart upstream.
 */
export function toRating(stat: number, label = 'stat'): number {
  const unit = checkedStat(stat, label) / 100
  return clampStat(RATING_FLOOR + unit * (RATING_CEILING - RATING_FLOOR))
}

/** Rate seven 0–100 stats with the contract's own functions. */
export function rateStats(stats: CoreStats): AgentRating {
  const ratings = {} as Record<CoreStatKey, number>
  for (const key of CORE_STAT_KEYS) ratings[key] = toRating(stats[key], key)

  const relativeAdvantage = computeRelativeAdvantage(ratings)
  return {
    ratings,
    ovr: computeOvr(ratings),
    relativeAdvantage,
    archetype: resolveArchetype(relativeAdvantage),
  }
}

/** Static (natal-chart baseline) rating for an agent. */
export function rateAgent(agent: CraftedAgent): AgentRating {
  return rateStats(deriveSacredStats(agent))
}
