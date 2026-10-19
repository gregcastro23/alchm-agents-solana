/**
 * Alchemical Seals + Resonance Surge for the Pentacle Vessel Rating Scale.
 *
 * Pure, deterministic and free of `three`, React, and network access, so the same
 * calls serve an off-chain agent preview, an on-chain Token-2022 balance, and a
 * shader reading uniforms.
 *
 *   • `evaluateSeals`           — ESMS holdings + Sacred 7 stats (+ natal chart) → each Seal's
 *     progress; `earnedSeals` turns it into the contract's `AlchemicalSeal[]`.
 *   • `calculateResonanceSurge` — a live `Thermodynamics` payload (+ Monica, + an optional
 *     natal chart against the live sky) → the contract's `ResonanceSurgeState`.
 *
 * ## The contract decides; this module feeds it
 *
 * Tier names, stat gates, ESMS gates, tier multipliers, the Seal catalog, the roster baselines
 * and mean alignment, the Monica classification, the surge type and the surge's stat boosts all
 * live in `lib/agents/rating-contract.ts` (ratified in #65) and are called, not copied:
 * `evaluateSealTier`, `computeMeanAlignedRating`, `buildCanonicalSeal`, `determineMonicaState`,
 * `evaluateSurgeState`. What is added here is what the contract has no inputs for:
 *
 *   • **Celestial needs the chart's blessing** (a stricter ASOL rule, see below);
 *   • **progress** — `nextTier`, `blockedBy`, `maxTier` — so a UI can say what stops a Seal;
 *   • **the surge meter** — the contract takes a precomputed meter; this module computes it from
 *     the live sky's heat and reactivity (measured anchors) and an optional natal harmony offset.
 *
 * `test/agents/rating-contract-parity.spec.ts` checks that every result equals the contract's own
 * function on the same inputs, so the two cannot drift.
 *
 * ## Nothing here derives thermodynamics
 *
 * Heat, reactivity, Monica and Kalchm have exactly one definition per runtime
 * (`lib/thermodynamics/kalchm.ts`). `calculateResonanceSurge` only *reads* the numbers that
 * engine produced and maps them onto a meter — a game-design mapping, not a physical formula —
 * so `bun run check:no-stray-kalchm` has nothing to object to. Monica never enters the meter;
 * it only classifies the surge (the contract's `determineMonicaState`).
 *
 * ## Calibration constants are measured, not guessed
 *
 * The surge anchors come from the live sky (600 evenly spaced dates, 2020–2035, through
 * `deriveLiveEphemeris`); `test/agents/surge-calibration.spec.ts` repeats the measurement and
 * fails if the engine's output moves. The **ESMS balance gates are policy, not measurement** —
 * the repo holds no distribution of real user balances.
 */
import type { NatalChartProvenance } from '@/lib/agent-types'
import type { Thermodynamics } from '@/lib/thermodynamics/kalchm'
import { ELEMENT_BY_SIGN, ESMS_ELEMENT, type ZodiacSign } from '@/lib/staking/elements'
import type { Element, EsmsId } from '@/lib/staking/types'
import {
  CANONICAL_SEAL_CATALOG,
  ESMS_KEYS,
  SACRED_STAT_KEYS,
  SEAL_ESMS_GATES,
  SEAL_STAT_GATES,
  SEAL_TIERS,
  buildCanonicalSeal,
  computeMeanAlignedRating,
  evaluateSealTier,
  evaluateSurgeState,
  type AlchemicalSeal,
  type EsmsBalances,
  type EsmsKey,
  type MonicaState,
  type ResonanceSurgeState,
  type SealTier,
  type SurgeType,
} from '../rating-contract'
import {
  RATING_CEILING,
  toRating,
  type CoreStats,
  type SacredStatKey,
  type VesselArchetype,
} from './ovr-archetype'

export { SEAL_TIERS, computeMeanAlignedRating }
export type { AlchemicalSeal, MonicaState, ResonanceSurgeState, SealTier, SurgeType }

// ─── Vocabulary ──────────────────────────────────────────────────────────────

/** Order matches `EsmsId` 0–3 (Spirit, Essence, Matter, Substance). */
export const ESMS_TOKENS = ESMS_KEYS
export type EsmsToken = EsmsKey

/**
 * Holdings in **whole tokens** (UI units): Solana mints carry 4 decimals and the
 * Arc ESMS 18, so convert before calling. The contract calls the same record `EsmsBalances`.
 */
export type EsmsHoldings = EsmsBalances

/** A catalog entry: which stat and which ESMS token a Seal is earned through. */
export interface AlchemicalSealDefinition {
  /** The contract's id: `seal-<stat>`. */
  id: string
  name: string
  token: EsmsToken
  stat: SacredStatKey
}

/** One Seal per Sacred 7 stat, in the contract's stat order, built from its catalog. */
export const SEAL_CATALOG: readonly AlchemicalSealDefinition[] = SACRED_STAT_KEYS.map(stat => ({
  id: `seal-${stat}`,
  name: CANONICAL_SEAL_CATALOG[stat].name,
  token: CANONICAL_SEAL_CATALOG[stat].category,
  stat,
}))

/**
 * A Seal tier needs BOTH its (mean-aligned) stat rating on the 25–99 scale and its ESMS balance;
 * the tier is the highest whose two gates both clear. Read from the contract's
 * `SEAL_STAT_GATES` / `SEAL_ESMS_GATES` (74 / 80 / 86 / 91 / 96 and 0.5 / 2 / 10 / 50 / 250).
 */
export const SEAL_TIER_REQUIREMENTS: Readonly<
  Record<SealTier, { minRating: number; minBalance: number }>
> = Object.freeze(
  Object.fromEntries(
    SEAL_TIERS.map(tier => [
      tier,
      Object.freeze({ minRating: SEAL_STAT_GATES[tier], minBalance: SEAL_ESMS_GATES[tier] }),
    ])
  ) as Record<SealTier, { minRating: number; minBalance: number }>
)

/**
 * Celestial additionally needs the chart's blessing — a rule ASOL adds on top of the contract
 * (which only bars a placeholder chart): at least this many of the ten classical bodies natally
 * placed in the Seal token's element (Fire→Spirit, Water→Essence, Earth→Matter, Air→Substance —
 * `lib/staking/elements.ts`). Across the roster ≥4 holds for 7–22% of agents depending on the
 * element. It is passed to the contract's `evaluateSealTier` through its Celestial bar, so every
 * other tier is exactly the contract's.
 */
export const CELESTIAL_MIN_NATAL_AFFINITY = 4

const CLASSICAL_BODIES = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
] as const

/** Structural subset of `NatalChart`: a full chart, with or without provenance, fits. */
export interface NatalChartInput {
  planets: Record<string, { sign: string }>
  provenance?: NatalChartProvenance
}

/** A `placeholder` or `unattributed` chart is stacked or unsourced; it never earns anything. */
function usableChart(chart: NatalChartInput | null | undefined): NatalChartInput | null {
  if (!chart) return null
  if (chart.provenance === 'placeholder' || chart.provenance === 'unattributed') return null
  return chart
}

// ─── Evaluating Seals ────────────────────────────────────────────────────────

export interface SealInputs {
  /** Core stats, 0–100. Pass natal stats for a stable result, boosted stats for a live one. */
  stats: CoreStats
  esmsBalances: EsmsHoldings
  /** Optional; without one, Celestial is unreachable. */
  natalChart?: NatalChartInput | null
}

/** One catalog Seal's standing: the tier it holds and what stands between it and the next. */
export interface SealProgress {
  /** The contract's `seal-<stat>`. */
  id: string
  name: string
  token: EsmsToken
  stat: SacredStatKey
  /** Highest tier cleared, or `null` if not even Copper. */
  tier: SealTier | null
  /**
   * The tier above `tier` (Copper if none yet), or `null` at the top — the top being `maxTier`,
   * which is below Celestial for a stat whose aligned ceiling cannot reach that gate.
   */
  nextTier: SealTier | null
  /** What currently stops `nextTier`; empty when `nextTier` is `null`. */
  blockedBy: Array<'stat' | 'esms' | 'natal'>
  /**
   * The highest tier this Seal's stat can ever reach: the rating gates are compared with the
   * mean-aligned rating, and a perfect stat (rating 99) aligns to a different ceiling per stat
   * (`99 − mean + GLOBAL_ROSTER_MEAN`). With the contract's means a perfect `power` aligns to
   * 90.5, short of the Astral gate (91), so Crucible Finisher tops out at Gold; every other Seal
   * can reach Celestial.
   */
  maxTier: SealTier
  /** The raw 25–99 rating — what the radar shows. */
  statRating: number
  /** The rating after the contract's mean alignment — what the gates were compared against (2 dp). */
  alignedRating: number
  balance: number
  /** Classical bodies in the token's element, or `null` if there is no usable chart. */
  natalAffinity: number | null
}

/**
 * Bodies natally in the token's element. `null` when there is no chart, or when
 * the chart is a `placeholder`/`unattributed` one: those are stacked or
 * unsourced numbers, and a Celestial Seal must not rest on a chart that is not
 * a measurement or a deliberate authorship.
 */
export function natalAffinity(
  natalChart: NatalChartInput | null | undefined,
  token: EsmsToken
): number | null {
  const chart = usableChart(natalChart)
  if (!chart) return null
  const element = ESMS_ELEMENT[ESMS_TOKENS.indexOf(token) as EsmsId]
  let count = 0
  for (const body of CLASSICAL_BODIES) {
    const sign = chart.planets[body]?.sign
    if (sign !== undefined && ELEMENT_BY_SIGN[sign as ZodiacSign] === element) count++
  }
  return count
}

/**
 * Evaluate every catalog Seal. Always returns the whole catalog, in the contract's stat order,
 * with `tier: null` for Seals not yet earned — `earnedSeals` turns it into the contract's list.
 *
 * Throws on a non-finite stat, or a balance that is non-finite or negative: a
 * quiet fallback would show a broken read as an agent who simply earned nothing.
 */
export function evaluateSeals({ stats, esmsBalances, natalChart }: SealInputs): SealProgress[] {
  for (const token of ESMS_TOKENS) {
    const balance = esmsBalances[token]
    if (!Number.isFinite(balance) || balance < 0) {
      throw new RangeError(`Invalid ${token} balance: ${String(balance)}`)
    }
  }

  return SEAL_CATALOG.map(seal => {
    const statRating = toRating(stats[seal.stat], seal.stat)
    const alignedRating = computeMeanAlignedRating(seal.stat, statRating)
    const balance = esmsBalances[seal.token]
    const affinity = natalAffinity(natalChart, seal.token)
    const celestialAllowed = affinity !== null && affinity >= CELESTIAL_MIN_NATAL_AFFINITY

    // The contract's tier, with its Celestial bar closed unless the chart blesses it.
    const tier = evaluateSealTier(seal.stat, statRating, balance, !celestialAllowed)
    const tierIndex = tier === null ? -1 : SEAL_TIERS.indexOf(tier)

    const ceiling = computeMeanAlignedRating(seal.stat, RATING_CEILING)
    let maxTierIndex = 0
    for (let i = 0; i < SEAL_TIERS.length; i++) {
      if (SEAL_STAT_GATES[SEAL_TIERS[i]] <= ceiling) maxTierIndex = i
    }
    const nextTier = tierIndex + 1 <= maxTierIndex ? SEAL_TIERS[tierIndex + 1] : null
    const blockedBy: SealProgress['blockedBy'] = []
    if (nextTier) {
      if (alignedRating < SEAL_STAT_GATES[nextTier]) blockedBy.push('stat')
      if (balance < SEAL_ESMS_GATES[nextTier]) blockedBy.push('esms')
      if (nextTier === 'Celestial' && !celestialAllowed) blockedBy.push('natal')
    }

    return {
      id: seal.id,
      name: seal.name,
      token: seal.token,
      stat: seal.stat,
      tier,
      nextTier,
      blockedBy,
      maxTier: SEAL_TIERS[maxTierIndex],
      statRating,
      alignedRating: Math.round(alignedRating * 100) / 100,
      balance,
      natalAffinity: affinity,
    }
  })
}

/** The Seals a vessel holds, as the contract's `AlchemicalSeal[]` (`buildCanonicalSeal`). */
export function earnedSeals(results: readonly SealProgress[]): AlchemicalSeal[] {
  const earned: AlchemicalSeal[] = []
  for (const result of results) {
    if (result.tier !== null) earned.push(buildCanonicalSeal(result.stat, result.tier))
  }
  return earned
}

// ─── Resonance Surge ─────────────────────────────────────────────────────────

/** The most a natal chart's harmony with the live sky can move the meter, either way. */
export const HARMONY_MAX_OFFSET = 12

/** Heat and reactivity each carry half the meter. */
const HEAT_WEIGHT = 0.5
const REACTIVITY_WEIGHT = 0.5

/**
 * Each quantity ramps linearly from 0 at `low` to its full share of the meter at
 * `high`, and is clamped outside that range.
 */
export interface SurgeCalibration {
  heat: { low: number; high: number }
  reactivity: { low: number; high: number }
}

/**
 * The 5th and 95th percentile of live-sky heat and reactivity (600 dates, 2020–2035;
 * heat 0.018–0.115, reactivity 0.56–3.59). The two differ by ~30×, so each is ramped on its
 * own scale. Calibrated to the *shared sky*: for a per-agent payload (natal + transit) pass a
 * `SurgeCalibration` measured on that.
 *
 * Re-pinned from the first version (heat 0.016–0.075): that measurement fed
 * `deriveLiveEphemeris` right ascensions in degrees, and the function reads any value up to 24
 * as hours, so bodies near 0°–24° of RA were multiplied by 15 and placed in the wrong sign. The
 * board's feed carries RA in hours; `eclipticLongitudeToEphemerisRow` (live-sky.ts) now emits
 * hours, and this is the distribution it produces.
 */
export const DEFAULT_SURGE_CALIBRATION: SurgeCalibration = {
  heat: { low: 0.0184, high: 0.1154 },
  reactivity: { low: 0.561, high: 3.586 },
}

/** The live sky's body → sign map (a subset of a chart's `planets` is enough). */
export type SkyBodies = Record<string, { sign: string }>

export interface SurgeInputs {
  /** Straight from `calculateThermodynamics`; only `heat` and `reactivity` are read. */
  thermodynamics: Pick<Thermodynamics, 'heat' | 'reactivity'>
  /**
   * Straight from `calculateMonica`, `null` meaning ABSENT. It never moves the meter:
   * ABSENT must never degrade a surge, and there is no measured meaning for Monica's
   * sign or magnitude to build a meter on (see the note on `calculateMonica`). It only
   * classifies the result, through the contract: `monicaState`, and the `equilibrium` upgrade
   * of an *active* surge at Monica equilibrium.
   */
  monica?: number | null
  /** The vessel's archetype: the contract boosts its primary and secondary stat the most. */
  archetype: Pick<VesselArchetype, 'primary' | 'secondary'>
  /**
   * Optional per-agent harmony: this agent's natal chart against the live sky. Both are
   * needed; a `placeholder`/`unattributed` chart is ignored. Without them the meter is the
   * pure shared-sky meter.
   */
  natalChart?: NatalChartInput | null
  sky?: SkyBodies | null
}

/**
 * The contract's `ResonanceSurgeState` — `meter` an integer 0–100, `active` at 70 or more,
 * `heat` and `reactivity` the quantities' **ramp positions** (0–1, "normalized" in the
 * contract's words), `statBoosts` over all seven stats — plus how the meter was reached.
 */
export interface ResonanceSurgeReading extends ResonanceSurgeState {
  /** The shared-sky meter before any harmony offset, 0–100, unrounded. */
  skyMeter: number
  /** −12…+12 (2 dp); 0 when no usable natal chart or sky was given. */
  harmonyOffset: number
}

function ramp(value: number, { low, high }: { low: number; high: number }): number {
  return Math.min(1, Math.max(0, (value - low) / (high - low)))
}

function assertCalibration(calibration: SurgeCalibration): void {
  for (const [name, { low, high }] of Object.entries(calibration)) {
    if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
      throw new RangeError(`Invalid ${name} calibration: need finite low < high`)
    }
  }
}

/** Monica is a finite number or `null` (ABSENT); anything else is a broken read, not a state. */
function assertMonica(monica: number | null | undefined): void {
  if (monica !== null && monica !== undefined && !Number.isFinite(monica)) {
    throw new RangeError(`Monica must be a finite number or null, got ${String(monica)}`)
  }
}

// ─── Elemental harmony (natal chart vs the live sky) ─────────────────────────

/**
 * How two elements sit together: the same element reinforces, Fire–Air and Earth–Water are
 * sympathetic, Fire opposes Water and Air opposes Earth (the Pentacles lore), and the
 * remaining pairs are neutral. A game-design mapping, not physics.
 */
function elementRelation(natal: Element, transit: Element): number {
  if (natal === transit) return 1
  const pair = [natal, transit].sort().join('+')
  if (pair === 'Air+Fire' || pair === 'Earth+Water') return 0.5
  if (pair === 'Fire+Water' || pair === 'Air+Earth') return -1
  return 0
}

/**
 * Mean elemental relation across the ten classical bodies, each natal sign against the
 * same body's sign in the live sky, in [−1, +1]. `null` when there is no usable chart or
 * no body appears in both.
 */
export function elementalHarmony(
  natalChart: NatalChartInput | null | undefined,
  sky: SkyBodies | null | undefined
): number | null {
  const chart = usableChart(natalChart)
  if (!chart || !sky) return null
  let total = 0
  let counted = 0
  for (const body of CLASSICAL_BODIES) {
    const natalSign = chart.planets[body]?.sign
    const skySign = sky[body]?.sign
    const natal = natalSign === undefined ? undefined : ELEMENT_BY_SIGN[natalSign as ZodiacSign]
    const transit = skySign === undefined ? undefined : ELEMENT_BY_SIGN[skySign as ZodiacSign]
    if (natal === undefined || transit === undefined) continue
    total += elementRelation(natal, transit)
    counted++
  }
  return counted === 0 ? null : total / counted
}

/**
 * The surge for a vessel under the live sky: this module computes the meter (measured ramps plus
 * the natal harmony offset) and the contract's `evaluateSurgeState` decides everything else.
 */
export function calculateResonanceSurge(
  { thermodynamics, monica, archetype, natalChart, sky }: SurgeInputs,
  calibration: SurgeCalibration = DEFAULT_SURGE_CALIBRATION
): ResonanceSurgeReading {
  const { heat, reactivity } = thermodynamics
  if (!Number.isFinite(heat) || !Number.isFinite(reactivity)) {
    throw new RangeError(
      `Cannot compute a resonance surge from non-finite thermodynamics (heat ${String(heat)}, reactivity ${String(reactivity)})`
    )
  }
  assertMonica(monica)
  assertCalibration(calibration)

  const heatShare = ramp(heat, calibration.heat)
  const reactivityShare = ramp(reactivity, calibration.reactivity)
  const skyMeter = 100 * (HEAT_WEIGHT * heatShare + REACTIVITY_WEIGHT * reactivityShare)

  const harmony = elementalHarmony(natalChart, sky)
  const harmonyOffset = harmony === null ? 0 : Math.round(harmony * HARMONY_MAX_OFFSET * 100) / 100
  const meter = Math.min(100, Math.max(0, skyMeter + harmonyOffset))

  const state = evaluateSurgeState(
    meter,
    heatShare,
    reactivityShare,
    archetype.primary,
    archetype.secondary,
    monica ?? null
  )
  return { ...state, skyMeter, harmonyOffset }
}
