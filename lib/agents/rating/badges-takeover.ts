/**
 * Badges + Takeover for the Sacred 7 rating system.
 *
 * Pure, deterministic and free of `three`, React, and network access, so the same
 * calls serve an off-chain agent preview, an on-chain Token-2022 balance, and a
 * shader reading uniforms.
 *
 *   • `evaluateBadges`  — ESMS holdings + Sacred 7 stats (+ natal chart) → tiered badges.
 *   • `calculateTakeover` — a live `Thermodynamics` payload → a 0–100 meter, an
 *     active flag, a type, and temporary stat boosts.
 *
 * ## Nothing here derives thermodynamics
 *
 * Heat, reactivity, Monica and Kalchm have exactly one definition per runtime
 * (`lib/thermodynamics/kalchm.ts`). `calculateTakeover` only *reads* the numbers
 * that engine produced and maps them onto a meter — a game-design mapping, not a
 * physical formula — so `bun run check:no-stray-kalchm` has nothing to object to.
 *
 * ## Calibration constants are measured, not guessed
 *
 * The takeover anchors come from the live sky (600 evenly spaced dates,
 * 2020–2035, through `deriveLiveEphemeris`); `test/agents/takeover-calibration.spec.ts`
 * repeats the measurement and fails if the engine's output moves. The stat gates
 * come from the roster's rating distribution. The **ESMS balance gates are policy,
 * not measurement** — the repo holds no distribution of real user balances — and
 * are the first thing to tune once there is one.
 */
import type { NatalChartProvenance } from '@/lib/agent-types'
import type { Thermodynamics } from '@/lib/thermodynamics/kalchm'
import { ELEMENT_BY_SIGN, ESMS_ELEMENT, type ZodiacSign } from '@/lib/staking/elements'
import type { EsmsId } from '@/lib/staking/types'
import { toRating, type CoreStatKey, type CoreStats } from './ovr-archetype'

// ─── Badges ──────────────────────────────────────────────────────────────────

export const BADGE_TIERS = ['Bronze', 'Silver', 'Gold', 'Hall of Fame', 'Celestial'] as const
export type BadgeTier = (typeof BADGE_TIERS)[number]

/** Order matches `EsmsId` 0–3 (Spirit, Essence, Matter, Substance). */
export const ESMS_TOKENS = ['spirit', 'essence', 'matter', 'substance'] as const
export type EsmsToken = (typeof ESMS_TOKENS)[number]

/**
 * Holdings in **whole tokens** (UI units): Solana mints carry 4 decimals and the
 * Arc ESMS 18, so convert before calling. `EsmsBalances` from `useEsmsBalances`
 * fits as-is; extra fields are ignored.
 */
export type EsmsHoldings = Record<EsmsToken, number>

export interface BadgeDefinition {
  id: string
  name: string
  token: EsmsToken
  stat: CoreStatKey
}

/**
 * One badge per Sacred 7 stat, so every stat has somewhere to go. The first four
 * are the owner's spec; the last three fill the remaining stats.
 */
export const BADGE_CATALOG: readonly BadgeDefinition[] = [
  { id: 'astral-vision', name: 'Astral Vision', token: 'spirit', stat: 'intuition' },
  { id: 'immovable-foundation', name: 'Immovable Foundation', token: 'matter', stat: 'vitality' },
  {
    id: 'harmonic-floor-general',
    name: 'Harmonic Floor General',
    token: 'essence',
    stat: 'charisma',
  },
  { id: 'crucible-finisher', name: 'Crucible Finisher', token: 'substance', stat: 'power' },
  { id: 'tidal-chorus', name: 'Tidal Chorus', token: 'essence', stat: 'resonance' },
  { id: 'quicksilver-pivot', name: 'Quicksilver Pivot', token: 'substance', stat: 'adaptability' },
  { id: 'philosophers-stone', name: "Philosopher's Stone", token: 'matter', stat: 'wisdom' },
]

/**
 * A badge tier needs BOTH its stat rating (25–99 scale) and its ESMS balance —
 * the tier is the lower of the two gates. Stat gates are calibrated to the
 * roster (≈66% / 29% / 6% / 1% / 0% of agent-stat pairs clear them); balance
 * gates are policy. An agent's own `alchemicalElements` (0.4–0.98) therefore
 * top out at Bronze, which is the intended off-chain baseline.
 */
export const BADGE_TIER_REQUIREMENTS: Readonly<
  Record<BadgeTier, { minRating: number; minBalance: number }>
> = {
  Bronze: { minRating: 74, minBalance: 0.5 },
  Silver: { minRating: 80, minBalance: 2 },
  Gold: { minRating: 86, minBalance: 10 },
  'Hall of Fame': { minRating: 91, minBalance: 50 },
  Celestial: { minRating: 96, minBalance: 250 },
}

/**
 * Celestial additionally needs the chart's blessing: at least this many of the
 * ten classical bodies natally placed in the badge token's element (Fire→Spirit,
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

export interface BadgeInputs {
  /** Core stats, 0–100. Pass natal stats for a stable result, boosted stats for a live one. */
  stats: CoreStats
  esmsBalances: EsmsHoldings
  /** Optional; without one, Celestial is unreachable. */
  natalChart?: NatalChartInput | null
}

export interface BadgeResult {
  id: string
  name: string
  token: EsmsToken
  stat: CoreStatKey
  /** Highest tier cleared, or `null` if not even Bronze. */
  tier: BadgeTier | null
  /** The tier above `tier` (Bronze if none yet), or `null` at the top. */
  nextTier: BadgeTier | null
  /** What currently stops `nextTier`; empty at the top. */
  blockedBy: Array<'stat' | 'esms' | 'natal'>
  statRating: number
  balance: number
  /** Classical bodies in the token's element, or `null` if there is no usable chart. */
  natalAffinity: number | null
}

/**
 * Bodies natally in the token's element. `null` when there is no chart, or when
 * the chart is a `placeholder`/`unattributed` one: those are stacked or
 * unsourced numbers, and a Celestial badge must not rest on a chart that is not
 * a measurement or a deliberate authorship.
 */
export function natalAffinity(
  natalChart: NatalChartInput | null | undefined,
  token: EsmsToken
): number | null {
  if (!natalChart) return null
  if (natalChart.provenance === 'placeholder' || natalChart.provenance === 'unattributed') {
    return null
  }
  const element = ESMS_ELEMENT[ESMS_TOKENS.indexOf(token) as EsmsId]
  let count = 0
  for (const body of CLASSICAL_BODIES) {
    const sign = natalChart.planets[body]?.sign
    if (sign !== undefined && ELEMENT_BY_SIGN[sign as ZodiacSign] === element) count++
  }
  return count
}

function clears(
  tier: BadgeTier,
  rating: number,
  balance: number,
  affinity: number | null
): boolean {
  const need = BADGE_TIER_REQUIREMENTS[tier]
  if (rating < need.minRating || balance < need.minBalance) return false
  return tier !== 'Celestial' || (affinity !== null && affinity >= CELESTIAL_MIN_NATAL_AFFINITY)
}

/**
 * Evaluate every catalog badge. Always returns the whole catalog, in catalog
 * order, with `tier: null` for badges not yet earned — filter with `earnedBadges`.
 *
 * Throws on a non-finite stat, or a balance that is non-finite or negative: a
 * quiet fallback would show a broken read as an agent who simply earned nothing.
 */
export function evaluateBadges({ stats, esmsBalances, natalChart }: BadgeInputs): BadgeResult[] {
  for (const token of ESMS_TOKENS) {
    const balance = esmsBalances[token]
    if (!Number.isFinite(balance) || balance < 0) {
      throw new RangeError(`Invalid ${token} balance: ${String(balance)}`)
    }
  }

  return BADGE_CATALOG.map(badge => {
    const statRating = toRating(stats[badge.stat], badge.stat)
    const balance = esmsBalances[badge.token]
    const affinity = natalAffinity(natalChart, badge.token)

    let tierIndex = -1
    for (let i = BADGE_TIERS.length - 1; i >= 0; i--) {
      if (clears(BADGE_TIERS[i], statRating, balance, affinity)) {
        tierIndex = i
        break
      }
    }

    const nextTier = BADGE_TIERS[tierIndex + 1] ?? null
    const blockedBy: BadgeResult['blockedBy'] = []
    if (nextTier) {
      const need = BADGE_TIER_REQUIREMENTS[nextTier]
      if (statRating < need.minRating) blockedBy.push('stat')
      if (balance < need.minBalance) blockedBy.push('esms')
      if (
        nextTier === 'Celestial' &&
        (affinity === null || affinity < CELESTIAL_MIN_NATAL_AFFINITY)
      ) {
        blockedBy.push('natal')
      }
    }

    return {
      id: badge.id,
      name: badge.name,
      token: badge.token,
      stat: badge.stat,
      tier: tierIndex >= 0 ? BADGE_TIERS[tierIndex] : null,
      nextTier,
      blockedBy,
      statRating,
      balance,
      natalAffinity: affinity,
    }
  })
}

export function earnedBadges(results: readonly BadgeResult[]): BadgeResult[] {
  return results.filter(result => result.tier !== null)
}

// ─── Takeover ────────────────────────────────────────────────────────────────

/** Heat-led takeovers burn; reactivity-led ones storm. */
export type TakeoverArchetype = 'inferno' | 'tempest'

/**
 * The core stats each type boosts are the ones `enhanceWithAlchemy` already ties
 * to that quantity (heat → resonance, charisma; reactivity → intuition,
 * adaptability), so a takeover amplifies what the quantity was already feeding.
 */
const TAKEOVER_BOOSTED_STATS: Record<TakeoverArchetype, readonly CoreStatKey[]> = {
  inferno: ['resonance', 'charisma'],
  tempest: ['intuition', 'adaptability'],
}

/** Meter value (0–100) at which a takeover is active. ≈6% of sky samples. */
export const TAKEOVER_ACTIVE_AT = 70

/** Stat points added on the 0–100 scale at a full meter; scales linearly with the meter. */
export const MAX_TAKEOVER_BOOST = 10

/** Heat and reactivity each carry half the meter. */
const HEAT_WEIGHT = 0.5
const REACTIVITY_WEIGHT = 0.5

/**
 * Each quantity ramps linearly from 0 at `low` to its full share of the meter at
 * `high`, and is clamped outside that range.
 */
export interface TakeoverCalibration {
  heat: { low: number; high: number }
  reactivity: { low: number; high: number }
}

/**
 * The 5th and 95th percentile of live-sky heat and reactivity (600 dates,
 * 2020–2035; heat 0.016–0.075, reactivity 0.54–3.4). The two differ by ~50×, so
 * each is ramped on its own scale. Calibrated to the *shared sky*: for a
 * per-agent payload (natal + transit) pass a `TakeoverCalibration` measured on that.
 */
export const DEFAULT_TAKEOVER_CALIBRATION: TakeoverCalibration = {
  heat: { low: 0.016, high: 0.075 },
  reactivity: { low: 0.54, high: 3.4 },
}

export interface TakeoverInputs {
  /** Straight from `calculateThermodynamics`; only `heat` and `reactivity` are read. */
  thermodynamics: Pick<Thermodynamics, 'heat' | 'reactivity'>
  /**
   * Straight from `calculateMonica`, `null` meaning ABSENT. Accepted so callers can
   * pass the engine's output through untouched, but it deliberately does NOT move
   * the meter: ABSENT must never degrade a takeover, and there is no measured
   * meaning for Monica's sign or magnitude to build a meter on (see the note on
   * `calculateMonica`). Wire it in only once there is one.
   */
  monica?: number | null
}

export interface TakeoverState {
  /** 0–100; continuous, so a shader can ease it. */
  meter: number
  active: boolean
  /** The type the meter is building toward (also meaningful below the threshold). */
  takeoverType: TakeoverArchetype
  /** Empty unless `active`. */
  statBoosts: Partial<CoreStats>
  /** Each quantity's share of the meter, 0–1 — ready to use as shader uniforms. */
  components: { heat: number; reactivity: number }
}

function ramp(value: number, { low, high }: { low: number; high: number }): number {
  return Math.min(1, Math.max(0, (value - low) / (high - low)))
}

function assertCalibration(calibration: TakeoverCalibration): void {
  for (const [name, { low, high }] of Object.entries(calibration)) {
    if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
      throw new RangeError(`Invalid ${name} calibration: need finite low < high`)
    }
  }
}

export function calculateTakeover(
  { thermodynamics, monica }: TakeoverInputs,
  calibration: TakeoverCalibration = DEFAULT_TAKEOVER_CALIBRATION
): TakeoverState {
  const { heat, reactivity } = thermodynamics
  if (!Number.isFinite(heat) || !Number.isFinite(reactivity)) {
    throw new RangeError(
      `Cannot compute takeover from non-finite thermodynamics (heat ${String(heat)}, reactivity ${String(reactivity)})`
    )
  }
  if (monica !== undefined && monica !== null && !Number.isFinite(monica)) {
    throw new RangeError(`Monica must be a finite number or null, got ${String(monica)}`)
  }
  assertCalibration(calibration)

  const heatShare = ramp(heat, calibration.heat)
  const reactivityShare = ramp(reactivity, calibration.reactivity)
  const meter = 100 * (HEAT_WEIGHT * heatShare + REACTIVITY_WEIGHT * reactivityShare)
  const active = meter >= TAKEOVER_ACTIVE_AT
  const takeoverType: TakeoverArchetype = heatShare >= reactivityShare ? 'inferno' : 'tempest'

  const statBoosts: Partial<CoreStats> = {}
  if (active) {
    const boost = Math.round((MAX_TAKEOVER_BOOST * meter) / 100)
    for (const stat of TAKEOVER_BOOSTED_STATS[takeoverType]) statBoosts[stat] = boost
  }

  return {
    meter,
    active,
    takeoverType,
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
