/**
 * OVR + Archetype rating for the Sacred 7.
 *
 * Distils an agent's seven core stats (0–100, from `deriveStatsFromChart` and
 * optionally folded with ESMS/thermodynamics by `enhanceWithAlchemy`) into the
 * things a game board needs to show at a glance:
 *
 *   • a per-stat rating on a 25–99 scale (what the radar draws),
 *   • one Overall (OVR) number,
 *   • each stat's advantage over the league average (`relativeAdvantage`),
 *   • a named build archetype ("Hermetic Vanguard").
 *
 * This is *presentation math over the stats*, not a second derivation of them:
 * it takes `Sacred7Stats` as given and never reads a natal chart, a planet, or a
 * thermodynamic quantity itself. Callers that want a live rating run
 * `enhanceWithAlchemy` first and pass the result in.
 *
 * It is deliberately NOT `calculateOverall` from `lib/sacred-7-stats.ts`, which
 * is the plain mean of all 19 stats and feeds other surfaces. The two answer
 * different questions and must not be swapped for one another.
 *
 * ## Two scales, on purpose
 *
 * Ratings and OVR use the **raw** scale, so a player can compare any two stats
 * or two agents directly. The archetype *title* uses **league-relative**
 * advantage instead, because `deriveStatsFromChart` weights `power` far above
 * the other stats (roster-mean power ≈ 76 against ≈ 65–70 for the rest) and
 * naming by raw height called ~70% of the roster a "Vanguard". Naming by how far
 * a stat sits above its own league average spreads titles across the roster
 * while the radar still shows true heights; `relativeAdvantage` is returned so
 * the UI can explain a title whose stat isn't the tallest bar.
 *
 * The baselines are pinned constants, not recomputed from the live roster —
 * otherwise adding one agent would rename every other. They are calibrated to
 * the *natal* stats from `deriveSacredStats`; `test/agents/ovr-archetype.spec.ts`
 * re-measures the roster and fails when they drift, so they cannot go stale
 * silently. Stats boosted by `enhanceWithAlchemy` or a Takeover sit above the
 * natal baseline, so pass natal stats when you want a stable title.
 *
 * ## How OVR is weighted
 *
 * OVR is an *ordered weighted average*: the highest-rated stat counts
 * `OVR_RANK_WEIGHTS[0]`, the second `OVR_RANK_WEIGHTS[1]`, every other stat 1.
 * Weighting by **rank** rather than by a fixed stat is what keeps this honest:
 *
 *   - Specialists out-rate generalists with the same total, which is the point
 *     of an archetype system.
 *   - It is monotone — raising any stat can never lower OVR — and continuous,
 *     because the weights follow the sorted order, not the identity of a stat.
 *     Weighting "the dominant planet's stat" would not be monotone: bumping a
 *     rival stat past it would swap the weights and could drop OVR.
 *   - Ties cannot change the value (tied stats are equal, so which one gets the
 *     bigger weight is irrelevant); they only change which archetype *name* is
 *     chosen, and that is broken by `CORE_STAT_KEYS` order so output is stable.
 */
import type { CraftedAgent } from '@/lib/agent-types'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import type { Sacred7Stats } from '@/lib/sacred-7-stats'

/** Canonical order. Also the tie-break order for ranking. */
export const CORE_STAT_KEYS = [
  'power',
  'resonance',
  'wisdom',
  'charisma',
  'intuition',
  'adaptability',
  'vitality',
] as const

export type CoreStatKey = (typeof CORE_STAT_KEYS)[number]
export type CoreStats = Pick<Sacred7Stats, CoreStatKey>

/** A stat of 0 rates as the floor and a stat of 100 as the ceiling. */
export const RATING_FLOOR = 25
export const RATING_CEILING = 99

/** Weights for the 1st- and 2nd-highest stat; every other stat weighs 1. */
export const OVR_RANK_WEIGHTS = [1.6, 1.3] as const

/**
 * If the gap between the best and worst *rating* is below this, the agent has
 * no meaningful specialty and is named `BALANCED_TITLE` rather than for a
 * coin-flip between near-equal stats. Judged on raw ratings — what the radar
 * shows — so a flat radar is never given a specialist name.
 */
export const BALANCED_SPREAD = 6

export const BALANCED_TITLE = 'Equilibrium Adept'

/**
 * League baselines: population mean and standard deviation of each core stat
 * (0–100 scale) across the 72 `HISTORICAL_AGENTS`, via `deriveSacredStats`,
 * measured 2026-10-16. Re-pin from the failure message of the calibration test
 * in `test/agents/ovr-archetype.spec.ts` if the derivation or roster moves.
 */
export const STAT_BASELINES: Readonly<Record<CoreStatKey, { mean: number; sd: number }>> = {
  power: { mean: 76.5, sd: 8.8 },
  resonance: { mean: 69.0, sd: 6.3 },
  wisdom: { mean: 68.4, sd: 5.8 },
  charisma: { mean: 67.3, sd: 7.9 },
  intuition: { mean: 70.2, sd: 7.5 },
  adaptability: { mean: 65.0, sd: 6.0 },
  vitality: { mean: 67.1, sd: 6.4 },
}

/**
 * Name fragments. A title is `<secondary adjective> <primary noun>`, so each map
 * must stay injective — the 42 ordered (primary, secondary) pairs then yield 42
 * distinct titles. `test/agents/ovr-archetype.spec.ts` enforces this.
 */
const ARCHETYPE_WORDS: Record<CoreStatKey, { adjective: string; noun: string }> = {
  power: { adjective: 'Sovereign', noun: 'Vanguard' },
  resonance: { adjective: 'Harmonic', noun: 'Conductor' },
  wisdom: { adjective: 'Hermetic', noun: 'Sage' },
  charisma: { adjective: 'Radiant', noun: 'Herald' },
  intuition: { adjective: 'Veiled', noun: 'Seer' },
  adaptability: { adjective: 'Mercurial', noun: 'Shapeshifter' },
  vitality: { adjective: 'Verdant', noun: 'Vitalist' },
}

export interface Archetype {
  /** `balanced` when the radar is flat; `primary`/`secondary` are still the two largest relative advantages. */
  kind: 'specialist' | 'balanced'
  /** Stat furthest above its league average. Not necessarily the tallest bar. */
  primary: CoreStatKey
  secondary: CoreStatKey
  title: string
}

export interface AgentRating {
  /** Per-stat rating, `RATING_FLOOR`–`RATING_CEILING`. */
  ratings: Record<CoreStatKey, number>
  /** Overall, `RATING_FLOOR`–`RATING_CEILING`. */
  ovr: number
  /** Best minus worst rating — how lopsided the radar is. */
  spread: number
  /**
   * Standard deviations above (+) or below (−) the league average, per stat, to
   * 2 dp. This — not the raw rating — is what picks the archetype.
   */
  relativeAdvantage: Record<CoreStatKey, number>
  archetype: Archetype
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
  return Math.round(RATING_FLOOR + unit * (RATING_CEILING - RATING_FLOOR))
}

/** Stat keys ordered best-first by `score`, ties broken by canonical order. */
function rankKeys(score: Record<CoreStatKey, number>): CoreStatKey[] {
  return [...CORE_STAT_KEYS].sort(
    (a, b) => score[b] - score[a] || CORE_STAT_KEYS.indexOf(a) - CORE_STAT_KEYS.indexOf(b)
  )
}

export function archetypeTitle(primary: CoreStatKey, secondary: CoreStatKey): string {
  return `${ARCHETYPE_WORDS[secondary].adjective} ${ARCHETYPE_WORDS[primary].noun}`
}

export function rateStats(stats: CoreStats): AgentRating {
  const ratings = {} as Record<CoreStatKey, number>
  const advantage = {} as Record<CoreStatKey, number>
  for (const key of CORE_STAT_KEYS) {
    const stat = checkedStat(stats[key], key)
    ratings[key] = toRating(stat, key)
    advantage[key] = (stat - STAT_BASELINES[key].mean) / STAT_BASELINES[key].sd
  }

  // OVR and spread follow the raw ratings…
  const byRating = rankKeys(ratings)
  const spread = ratings[byRating[0]] - ratings[byRating[byRating.length - 1]]
  let weighted = 0
  let totalWeight = 0
  byRating.forEach((key, i) => {
    const weight = OVR_RANK_WEIGHTS[i] ?? 1
    weighted += ratings[key] * weight
    totalWeight += weight
  })
  const ovr = Math.round(weighted / totalWeight)

  // …the title follows the league-relative advantage (ranked unrounded, so the
  // 2-dp figures we expose can tie without the ordering becoming ambiguous).
  const [primary, secondary] = rankKeys(advantage)
  const balanced = spread < BALANCED_SPREAD

  const relativeAdvantage = {} as Record<CoreStatKey, number>
  for (const key of CORE_STAT_KEYS) relativeAdvantage[key] = Math.round(advantage[key] * 100) / 100

  return {
    ratings,
    ovr,
    spread,
    relativeAdvantage,
    archetype: {
      kind: balanced ? 'balanced' : 'specialist',
      primary,
      secondary,
      title: balanced ? BALANCED_TITLE : archetypeTitle(primary, secondary),
    },
  }
}

/** Static (natal-chart baseline) rating for an agent. */
export function rateAgent(agent: CraftedAgent): AgentRating {
  return rateStats(deriveSacredStats(agent))
}
