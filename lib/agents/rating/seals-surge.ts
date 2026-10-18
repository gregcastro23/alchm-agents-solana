/**
 * Alchemical Seals + Resonance Surge for the Pentacle Vessel Rating Scale.
 *
 * Pure, deterministic and free of `three`, React, and network access, so the same
 * calls serve an off-chain agent preview, an on-chain Token-2022 balance, and a
 * shader reading uniforms.
 *
 *   • `evaluateSeals`          — ESMS holdings + Sacred 7 stats (+ natal chart) → tiered Seals.
 *   • `calculateResonanceSurge` — a live `Thermodynamics` payload (+ Monica, + an optional
 *     natal chart against the live sky) → a 0–100 meter, an active flag, a type, and
 *     temporary stat boosts.
 *
 * ## Nothing here derives thermodynamics
 *
 * Heat, reactivity, Monica and Kalchm have exactly one definition per runtime
 * (`lib/thermodynamics/kalchm.ts`). `calculateResonanceSurge` only *reads* the numbers
 * that engine produced and maps them onto a meter — a game-design mapping, not a
 * physical formula — so `bun run check:no-stray-kalchm` has nothing to object to.
 * Monica never enters the meter; it only classifies the surge (see below).
 *
 * ## Seal stat gates are mean-aligned
 *
 * `deriveStatsFromChart` weights `power` far above the other six stats (roster mean
 * ≈ 76.5 against 65–70), so gating every Seal on the raw rating handed out *Crucible
 * Finisher* at well over twice the rate of the other Seals. Rather than touch the
 * derivation — persona prompts and Anthropic cache keys hash its output — each stat's
 * rating is shifted by its own league mean before it meets a gate
 * (`computeMeanAlignedRating`). Ratings, OVR and the radar stay on the raw 25–99 scale;
 * only the comparison against the Seal gates is aligned.
 *
 * ## Calibration constants are measured, not guessed
 *
 * The surge anchors come from the live sky (600 evenly spaced dates, 2020–2035,
 * through `deriveLiveEphemeris`); `test/agents/surge-calibration.spec.ts` repeats the
 * measurement and fails if the engine's output moves. The stat gates come from the
 * roster's rating distribution (`test/agents/seals-surge.spec.ts` re-measures them).
 * The **ESMS balance gates are policy, not measurement** — the repo holds no
 * distribution of real user balances — and are the first thing to tune once there is
 * one.
 */
import type { NatalChartProvenance } from '@/lib/agent-types'
import { MONICA_EQUILIBRIUM, type Thermodynamics } from '@/lib/thermodynamics/kalchm'
import { ELEMENT_BY_SIGN, ESMS_ELEMENT, type ZodiacSign } from '@/lib/staking/elements'
import type { Element, EsmsId } from '@/lib/staking/types'
import {
  RATING_CEILING,
  RATING_FLOOR,
  STAT_BASELINES,
  toRating,
  type CoreStatKey,
  type CoreStats,
  type SacredStatKey,
} from './ovr-archetype'

// ─── Alchemical Seals ────────────────────────────────────────────────────────

export const SEAL_TIERS = ['Copper', 'Silver', 'Gold', 'Aether', 'Celestial'] as const
export type SealTier = (typeof SEAL_TIERS)[number]

/** Order matches `EsmsId` 0–3 (Spirit, Essence, Matter, Substance). */
export const ESMS_TOKENS = ['spirit', 'essence', 'matter', 'substance'] as const
export type EsmsToken = (typeof ESMS_TOKENS)[number]

/**
 * Holdings in **whole tokens** (UI units): Solana mints carry 4 decimals and the
 * Arc ESMS 18, so convert before calling. `EsmsBalances` from `useEsmsBalances`
 * fits as-is; extra fields are ignored.
 */
export type EsmsHoldings = Record<EsmsToken, number>

/** A catalog entry: which stat and which ESMS token a Seal is earned through. */
export interface AlchemicalSealDefinition {
  id: string
  name: string
  token: EsmsToken
  stat: SacredStatKey
}

/** One Seal per Sacred 7 stat, so every stat has somewhere to go. */
export const SEAL_CATALOG: readonly AlchemicalSealDefinition[] = [
  { id: 'crucible-finisher', name: 'Crucible Finisher', token: 'substance', stat: 'power' },
  { id: 'astral-vision', name: 'Astral Vision', token: 'spirit', stat: 'intuition' },
  { id: 'immovable-foundation', name: 'Immovable Foundation', token: 'matter', stat: 'vitality' },
  { id: 'harmonic-sovereign', name: 'Harmonic Sovereign', token: 'essence', stat: 'charisma' },
  { id: 'tidal-chorus', name: 'Tidal Chorus', token: 'essence', stat: 'resonance' },
  { id: 'quicksilver-pivot', name: 'Quicksilver Pivot', token: 'spirit', stat: 'adaptability' },
  { id: 'philosophers-stone', name: "Philosopher's Stone", token: 'matter', stat: 'wisdom' },
]

/**
 * A Seal tier needs BOTH its (mean-aligned) stat rating on the 25–99 scale and its
 * ESMS balance — the tier is the lower of the two gates. The balance gates are the
 * whole-token thresholds 0.5 / 2 / 10 / 50 / 250. An agent's own `alchemicalElements`
 * (0.4–0.98) therefore top out at Copper, which is the intended off-chain baseline.
 */
export const SEAL_TIER_REQUIREMENTS: Readonly<
  Record<SealTier, { minRating: number; minBalance: number }>
> = {
  Copper: { minRating: 74, minBalance: 0.5 },
  Silver: { minRating: 80, minBalance: 2 },
  Gold: { minRating: 86, minBalance: 10 },
  Aether: { minRating: 91, minBalance: 50 },
  Celestial: { minRating: 96, minBalance: 250 },
}

/**
 * Celestial additionally needs the chart's blessing: at least this many of the
 * ten classical bodies natally placed in the Seal token's element (Fire→Spirit,
 * Water→Essence, Earth→Matter, Air→Substance — `lib/staking/elements.ts`). Across
 * the roster ≥4 holds for 7–22% of agents depending on the element.
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

// ─── Mean alignment ──────────────────────────────────────────────────────────

/** Mean of the seven league means: the common level every stat is aligned to (0–100 scale). */
export const GLOBAL_ROSTER_MEAN =
  Object.values(STAT_BASELINES).reduce((sum, { mean }) => sum + mean, 0) /
  Object.keys(STAT_BASELINES).length

/** A 0–100 stat value expressed on the 25–99 rating scale, unrounded. */
function toRatingUnits(stat: number): number {
  return RATING_FLOOR + (stat / 100) * (RATING_CEILING - RATING_FLOOR)
}

/**
 * Shift a stat's rating by how far its league mean sits from the common mean, so the
 * Seal gates mean the same distance above "typical" for every stat:
 *
 *   aligned = rating − rating(league mean of the stat) + rating(GLOBAL_ROSTER_MEAN)
 *
 * The baselines are on the 0–100 stat scale and the gates on the 25–99 rating scale, so
 * the offset is converted before it is applied (a stat-point difference of d is
 * 0.74·d rating points). Returns an unrounded number; it is only ever compared to a gate.
 */
export function computeMeanAlignedRating(stat: SacredStatKey, rating: number): number {
  if (!Number.isFinite(rating)) {
    throw new RangeError(`Cannot align ${stat}: ${String(rating)} is not a finite number`)
  }
  return rating - toRatingUnits(STAT_BASELINES[stat].mean) + toRatingUnits(GLOBAL_ROSTER_MEAN)
}

// ─── Evaluating Seals ────────────────────────────────────────────────────────

export interface SealInputs {
  /** Core stats, 0–100. Pass natal stats for a stable result, boosted stats for a live one. */
  stats: CoreStats
  esmsBalances: EsmsHoldings
  /** Optional; without one, Celestial is unreachable. */
  natalChart?: NatalChartInput | null
}

/** A catalog Seal with its evaluated tier. */
export interface AlchemicalSeal {
  id: string
  name: string
  token: EsmsToken
  stat: SacredStatKey
  /** Highest tier cleared, or `null` if not even Copper. */
  tier: SealTier | null
  /** The tier above `tier` (Copper if none yet), or `null` at the top. */
  nextTier: SealTier | null
  /** What currently stops `nextTier`; empty at the top. */
  blockedBy: Array<'stat' | 'esms' | 'natal'>
  /** The raw 25–99 rating — what the radar shows. */
  statRating: number
  /** The rating after mean alignment — what the gates were compared against (2 dp). */
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

function clears(
  tier: SealTier,
  alignedRating: number,
  balance: number,
  affinity: number | null
): boolean {
  const need = SEAL_TIER_REQUIREMENTS[tier]
  if (alignedRating < need.minRating || balance < need.minBalance) return false
  return tier !== 'Celestial' || (affinity !== null && affinity >= CELESTIAL_MIN_NATAL_AFFINITY)
}

/**
 * Evaluate every catalog Seal. Always returns the whole catalog, in catalog
 * order, with `tier: null` for Seals not yet earned — filter with `earnedSeals`.
 *
 * Throws on a non-finite stat, or a balance that is non-finite or negative: a
 * quiet fallback would show a broken read as an agent who simply earned nothing.
 */
export function evaluateSeals({ stats, esmsBalances, natalChart }: SealInputs): AlchemicalSeal[] {
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

    let tierIndex = -1
    for (let i = SEAL_TIERS.length - 1; i >= 0; i--) {
      if (clears(SEAL_TIERS[i], alignedRating, balance, affinity)) {
        tierIndex = i
        break
      }
    }

    const nextTier = SEAL_TIERS[tierIndex + 1] ?? null
    const blockedBy: AlchemicalSeal['blockedBy'] = []
    if (nextTier) {
      const need = SEAL_TIER_REQUIREMENTS[nextTier]
      if (alignedRating < need.minRating) blockedBy.push('stat')
      if (balance < need.minBalance) blockedBy.push('esms')
      if (
        nextTier === 'Celestial' &&
        (affinity === null || affinity < CELESTIAL_MIN_NATAL_AFFINITY)
      ) {
        blockedBy.push('natal')
      }
    }

    return {
      id: seal.id,
      name: seal.name,
      token: seal.token,
      stat: seal.stat,
      tier: tierIndex >= 0 ? SEAL_TIERS[tierIndex] : null,
      nextTier,
      blockedBy,
      statRating,
      alignedRating: Math.round(alignedRating * 100) / 100,
      balance,
      natalAffinity: affinity,
    }
  })
}

export function earnedSeals(results: readonly AlchemicalSeal[]): AlchemicalSeal[] {
  return results.filter(result => result.tier !== null)
}

// ─── Resonance Surge ─────────────────────────────────────────────────────────

/**
 * Heat-led surges burn; reactivity-led ones storm; and an active surge at exact Monica
 * equilibrium is both.
 */
export type ResonanceSurgeType = 'inferno' | 'tempest' | 'equilibrium'

/** Where Monica sits, from the canonical engine's output (`null` there means ABSENT). */
export type MonicaState = 'absent' | 'equilibrium' | 'convergent' | 'divergent'

const SURGE_BOOSTED_STATS: Record<'inferno' | 'tempest', readonly SacredStatKey[]> = {
  inferno: ['resonance', 'charisma'],
  tempest: ['intuition', 'adaptability'],
}

/** The union of both: the dual surge boosts everything either type would. */
const EQUILIBRIUM_BOOSTED_STATS: readonly SacredStatKey[] = [
  ...SURGE_BOOSTED_STATS.inferno,
  ...SURGE_BOOSTED_STATS.tempest,
]

/** Meter value (0–100) at which a surge is active. ≈8% of sky samples. */
export const SURGE_ACTIVE_AT = 70

/** Stat points added on the 0–100 scale at a full meter; scales linearly with the meter. */
export const MAX_SURGE_BOOST = 10

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
   * classifies the result: `monicaState`, and the `equilibrium` upgrade of an *active*
   * surge when Monica sits exactly at `MONICA_EQUILIBRIUM`.
   */
  monica?: number | null
  /**
   * Optional per-agent harmony: this agent's natal chart against the live sky. Both are
   * needed; a `placeholder`/`unattributed` chart is ignored. Without them the meter is the
   * pure shared-sky meter.
   */
  natalChart?: NatalChartInput | null
  sky?: SkyBodies | null
}

export interface ResonanceSurgeState {
  /** 0–100 after the harmony offset; continuous, so a shader can ease it. */
  meter: number
  /** The shared-sky meter before any harmony offset, 0–100. */
  skyMeter: number
  /** −12…+12 (2 dp); 0 when no usable natal chart or sky was given. */
  harmonyOffset: number
  active: boolean
  /** The type the meter is building toward (also meaningful below the threshold). */
  surgeType: ResonanceSurgeType
  monicaState: MonicaState
  /** Empty unless `active`. */
  statBoosts: Partial<CoreStats>
  /** Each quantity's share of the meter, 0–1 — ready to use as shader uniforms. */
  components: { heat: number; reactivity: number }
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

/**
 * Classify Monica. The engine reports ABSENT as `null`, never as a number; exact Kalchm
 * equilibrium is the constant `MONICA_EQUILIBRIUM`. Zero is not a value the engine
 * produces; it is not positive, so it classifies as divergent.
 */
export function classifyMonica(monica: number | null | undefined): MonicaState {
  if (monica === null || monica === undefined) return 'absent'
  if (!Number.isFinite(monica)) {
    throw new RangeError(`Monica must be a finite number or null, got ${String(monica)}`)
  }
  if (monica === MONICA_EQUILIBRIUM) return 'equilibrium'
  return monica > 0 ? 'convergent' : 'divergent'
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

export function calculateResonanceSurge(
  { thermodynamics, monica, natalChart, sky }: SurgeInputs,
  calibration: SurgeCalibration = DEFAULT_SURGE_CALIBRATION
): ResonanceSurgeState {
  const { heat, reactivity } = thermodynamics
  if (!Number.isFinite(heat) || !Number.isFinite(reactivity)) {
    throw new RangeError(
      `Cannot compute a resonance surge from non-finite thermodynamics (heat ${String(heat)}, reactivity ${String(reactivity)})`
    )
  }
  const monicaState = classifyMonica(monica) // also rejects a non-finite Monica
  assertCalibration(calibration)

  const heatShare = ramp(heat, calibration.heat)
  const reactivityShare = ramp(reactivity, calibration.reactivity)
  const skyMeter = 100 * (HEAT_WEIGHT * heatShare + REACTIVITY_WEIGHT * reactivityShare)

  const harmony = elementalHarmony(natalChart, sky)
  const harmonyOffset = harmony === null ? 0 : Math.round(harmony * HARMONY_MAX_OFFSET * 100) / 100
  const meter = Math.min(100, Math.max(0, skyMeter + harmonyOffset))

  const active = meter >= SURGE_ACTIVE_AT
  const building: 'inferno' | 'tempest' = heatShare >= reactivityShare ? 'inferno' : 'tempest'
  const dual = active && monicaState === 'equilibrium'
  const surgeType: ResonanceSurgeType = dual ? 'equilibrium' : building

  const statBoosts: Partial<CoreStats> = {}
  if (active) {
    const boost = Math.round((MAX_SURGE_BOOST * meter) / 100)
    const boosted = dual ? EQUILIBRIUM_BOOSTED_STATS : SURGE_BOOSTED_STATS[building]
    for (const stat of boosted) statBoosts[stat] = boost
  }

  return {
    meter,
    skyMeter,
    harmonyOffset,
    active,
    surgeType,
    monicaState,
    statBoosts,
    components: { heat: heatShare, reactivity: reactivityShare },
  }
}

/** Apply boosts to stats, clamped to 100. Returns a new object; the input is untouched. */
export function applyStatBoosts(stats: CoreStats, boosts: Partial<CoreStats>): CoreStats {
  const boosted = { ...stats }
  for (const [key, amount] of Object.entries(boosts) as Array<[CoreStatKey, number]>) {
    boosted[key] = Math.min(100, boosted[key] + amount)
  }
  return boosted
}
