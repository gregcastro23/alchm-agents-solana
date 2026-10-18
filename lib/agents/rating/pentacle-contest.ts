/**
 * Pentacle Zone Synergy & Contest Engine.
 *
 * The Pentacle grid has 11 zones (`lib/staking/pentacle-geometry.ts`): Houses 0–4 along
 * the horizon, Spires 5–9 at the star tips and the Crown (10) in the centre. This module
 * answers two questions about them, purely and deterministically:
 *
 *   • How well does a vessel fit a zone? — its **Effective Contest Rating** (ECR) there,
 *     `effectiveContestRating` / `computeZoneSynergies`.
 *   • Who holds a zone after two vessels contest it? — `resolveZoneContest`.
 *
 * Nothing here reads a clock, a random source, the network or a chart, and nothing imports a
 * Node builtin, so the same calls serve an off-chain preview, an API route and a client
 * component. It takes `CoreStats` as given (it never derives them) and reads Seals and a
 * Resonance Surge in the shapes `seals-surge.ts` already produces.
 *
 * ## The ECR
 *
 *   ECR(zone) = ( Σ_k  weight[zone][k] · clamp(stat′[k], 0, 100) ) × sealMultiplier(zone)
 *
 * rounded to 2 dp, where `stat′` is the vessel's stats plus the temporary boosts of its
 * Resonance Surge **only while that surge is active**. Every zone's weights sum to 1, so before
 * Seals the ECR is a weighted average of the stats: it never leaves the range of the vessel's
 * own stats, and a flat vessel scores the same everywhere. Seals are what tilt a vessel toward
 * a particular zone *beyond* its stats: the multiplier is that of the highest earned tier among
 * the vessel's Seals whose token matches the zone's element (1.0 when there is none).
 *
 * ## Zone profiles are policy, not measurement
 *
 * The weights below are design choices, not fits to data. The shape of the policy:
 *
 *   • **Houses** (the horizon arcs) are where a position is physically held: `vitality` and
 *     `power` carry 60% of every House, plus one distinct secondary stat per House.
 *   • **Spires** (the star tips) are where a position is read from afar: `intuition`, `wisdom`
 *     and `adaptability` carry 70–75% of every Spire, one of them leading.
 *   • **The Crown** is the keystone: no stat above 19%, none below 12%, with `resonance` and
 *     `charisma` the two highest, because the Crown is held by drawing the others together.
 *
 * Within each kind the five profiles differ, so which zone a vessel is best at depends on its
 * build, and the roster does not collapse onto one zone (`test/agents/pentacle-contest.spec.ts`
 * measures the spread).
 *
 * ## Zone elements follow the compass
 *
 * A zone's element does not follow its weights; it follows where the zone sits on the horizon,
 * so the board is a fixed, memorable map. Each zone's azimuth is North = 0°, clockwise: Spire
 * k sits at 72°·k, and House k, between Spire k and Spire k+1, at 72°·k + 36°. The four
 * quadrants take the traditional cardinal elements — North (315°–45°) Earth, East (45°–135°)
 * Air, South (135°–225°) Fire, West (225°–315°) Water — and the Crown, which has no azimuth,
 * takes Water because its two lead stats (`resonance`, `charisma`) are the stats whose Seals
 * draw on Essence. That gives Earth ×3 (House 0, House 4, Spire N), Air ×2 (House 1, Spire
 * ENE), Fire ×3 (House 2, Spires SE and SW) and Water ×3 (House 3, Spire WNW, the Crown). No
 * zone centre falls on a quadrant boundary, so the rule has no ties.
 *
 * Decoupling element from weights is deliberate: a Seal's token multiplies the whole ECR, so a
 * vessel can specialise through its stats, through its Seals, or both, and the two axes are
 * not forced to agree.
 */
import { ELEMENT_TO_ESMS } from '@/lib/staking/elements'
import { SPIRE_LABELS, zoneKind, type ZoneKindName } from '@/lib/staking/pentacle-geometry'
import type { Element } from '@/lib/staking/types'
import { CORE_STAT_KEYS, type CoreStats, type SacredStatKey } from './ovr-archetype'
import {
  ESMS_TOKENS,
  SEAL_TIERS,
  applyStatBoosts,
  type AlchemicalSeal,
  type EsmsToken,
  type ResonanceSurgeState,
  type SealTier,
} from './seals-surge'

// ─── Zone profiles ───────────────────────────────────────────────────────────

export interface ZoneProfile {
  /** 0–10, equal to this profile's index in `ZONE_PROFILES`. */
  zoneId: number
  kind: ZoneKindName
  label: string
  element: Element
  /** The ESMS token of `element`: the token a Seal must carry to multiply the ECR here. */
  esmsToken: EsmsToken
  /** How much each Sacred 7 stat counts toward the ECR here. Sums to 1; at least two are non-zero. */
  weights: Record<SacredStatKey, number>
}

/** Weights written as whole percents so each row can be checked against 100 at a glance. */
interface ZoneSpec {
  element: Element
  percent: Record<SacredStatKey, number>
}

/**
 * Index = zone id. Columns read power · resonance · wisdom · charisma · intuition ·
 * adaptability · vitality (the canonical stat order). See the module header for the rationale.
 */
const ZONE_SPECS: readonly ZoneSpec[] = [
  // Houses 0–4, horizon arcs: Spire k → Spire k+1. Vitality + power lead; one secondary each.
  // House N-ENE, azimuth 36°. Vitality-led, wisdom secondary.
  {
    element: 'Earth',
    percent: {
      power: 25,
      resonance: 5,
      wisdom: 20,
      charisma: 5,
      intuition: 5,
      adaptability: 5,
      vitality: 35,
    },
  },
  // House ENE-SE, azimuth 108°. Power-led, adaptability secondary.
  {
    element: 'Air',
    percent: {
      power: 35,
      resonance: 5,
      wisdom: 5,
      charisma: 5,
      intuition: 5,
      adaptability: 20,
      vitality: 25,
    },
  },
  // House SE-SW, azimuth 180°. Power-led, charisma secondary.
  {
    element: 'Fire',
    percent: {
      power: 35,
      resonance: 5,
      wisdom: 5,
      charisma: 20,
      intuition: 5,
      adaptability: 5,
      vitality: 25,
    },
  },
  // House SW-WNW, azimuth 252°. Vitality-led, resonance secondary.
  {
    element: 'Water',
    percent: {
      power: 25,
      resonance: 20,
      wisdom: 5,
      charisma: 5,
      intuition: 5,
      adaptability: 5,
      vitality: 35,
    },
  },
  // House WNW-N, azimuth 324°. Power and vitality level, intuition secondary.
  {
    element: 'Earth',
    percent: {
      power: 30,
      resonance: 5,
      wisdom: 5,
      charisma: 5,
      intuition: 20,
      adaptability: 5,
      vitality: 30,
    },
  },
  // Spires 5–9, star tips at 72°·k. Intuition, wisdom and adaptability lead; one leads outright.
  // Spire N, azimuth 0°. Wisdom-led.
  {
    element: 'Earth',
    percent: {
      power: 5,
      resonance: 10,
      wisdom: 35,
      charisma: 5,
      intuition: 20,
      adaptability: 15,
      vitality: 10,
    },
  },
  // Spire ENE, azimuth 72°. Adaptability-led.
  {
    element: 'Air',
    percent: {
      power: 10,
      resonance: 5,
      wisdom: 15,
      charisma: 10,
      intuition: 20,
      adaptability: 35,
      vitality: 5,
    },
  },
  // Spire SE, azimuth 144°. Intuition-led.
  {
    element: 'Fire',
    percent: {
      power: 10,
      resonance: 5,
      wisdom: 20,
      charisma: 10,
      intuition: 35,
      adaptability: 15,
      vitality: 5,
    },
  },
  // Spire SW, azimuth 216°. Wisdom-led, adaptability close behind.
  {
    element: 'Fire',
    percent: {
      power: 5,
      resonance: 10,
      wisdom: 30,
      charisma: 5,
      intuition: 20,
      adaptability: 25,
      vitality: 5,
    },
  },
  // Spire WNW, azimuth 288°. Intuition-led, with resonance as its tide.
  {
    element: 'Water',
    percent: {
      power: 5,
      resonance: 15,
      wisdom: 20,
      charisma: 5,
      intuition: 30,
      adaptability: 20,
      vitality: 5,
    },
  },
  // Crown 10, the keystone. Balanced, with resonance and charisma carrying extra.
  {
    element: 'Water',
    percent: {
      power: 12,
      resonance: 19,
      wisdom: 13,
      charisma: 19,
      intuition: 13,
      adaptability: 12,
      vitality: 12,
    },
  },
]

function weightsFromPercent(
  zoneId: number,
  percent: Record<SacredStatKey, number>
): Record<SacredStatKey, number> {
  const total = CORE_STAT_KEYS.reduce((sum, key) => sum + percent[key], 0)
  // A table that does not sum to 100 would quietly inflate or deflate every ECR in the zone,
  // so refuse to load rather than ship it.
  if (total !== 100) {
    throw new RangeError(`Zone ${zoneId} weights sum to ${total}%, expected 100%`)
  }
  const weights = {} as Record<SacredStatKey, number>
  for (const key of CORE_STAT_KEYS) weights[key] = percent[key] / 100
  return Object.freeze(weights)
}

function zoneLabel(zoneId: number): string {
  const kind = zoneKind(zoneId)
  if (kind === 'Crown') return 'Crown'
  if (kind === 'Spire') return `Spire ${SPIRE_LABELS[zoneId - 5]}`
  return `House ${SPIRE_LABELS[zoneId]}-${SPIRE_LABELS[(zoneId + 1) % SPIRE_LABELS.length]}`
}

/** The 11 zones, frozen, with `ZONE_PROFILES[i].zoneId === i`. */
export const ZONE_PROFILES: readonly ZoneProfile[] = Object.freeze(
  ZONE_SPECS.map(
    (spec, zoneId): ZoneProfile =>
      Object.freeze({
        zoneId,
        kind: zoneKind(zoneId),
        label: zoneLabel(zoneId),
        element: spec.element,
        esmsToken: ESMS_TOKENS[ELEMENT_TO_ESMS[spec.element]],
        weights: weightsFromPercent(zoneId, spec.percent),
      })
  )
)

// ─── Seals ───────────────────────────────────────────────────────────────────

/**
 * ECR multiplier for the highest earned tier of a Seal whose token matches the zone's element.
 * Strictly increasing in tier order, so a higher tier can never lower the ECR.
 */
export const SEAL_TIER_MULTIPLIERS: Readonly<Record<SealTier, number>> = Object.freeze({
  Copper: 1.05,
  Silver: 1.1,
  Gold: 1.18,
  Aether: 1.28,
  Celestial: 1.4,
})

// ─── Effective Contest Rating ────────────────────────────────────────────────

export interface ContestVessel {
  /** Natal or live core stats, 0–100. Out-of-range finite values are clamped; non-finite throw. */
  stats: CoreStats
  /** The vessel's evaluated Seals (`evaluateSeals`); a Seal with `tier: null` counts for nothing. */
  seals: readonly AlchemicalSeal[]
  /** A Resonance Surge: its boosts apply only while `active`. */
  surge?: Pick<ResonanceSurgeState, 'active' | 'statBoosts'> | null
}

const round2 = (value: number): number => Math.round(value * 100) / 100

function requireZone(zoneId: number): ZoneProfile {
  const profile = Number.isInteger(zoneId) ? ZONE_PROFILES[zoneId] : undefined
  if (profile === undefined) {
    throw new RangeError(
      `Unknown zone ${String(zoneId)}: expected an integer from 0 to ${ZONE_PROFILES.length - 1}`
    )
  }
  return profile
}

/** A vessel reduced to what every zone needs: clamped boosted stats and its best tier per token. */
interface PreparedVessel {
  stats: CoreStats
  /** Index into `SEAL_TIERS` of the highest earned tier for each token, −1 if none. */
  bestTier: Record<EsmsToken, number>
}

/**
 * Validate once and reduce a vessel. A broken input throws here, identically for every zone, so
 * a read that is wrong never shows up as a vessel that merely scored badly.
 */
function prepareVessel(vessel: ContestVessel): PreparedVessel {
  for (const key of CORE_STAT_KEYS) {
    const value = vessel.stats[key]
    if (!Number.isFinite(value)) {
      throw new RangeError(`Cannot rate ${key}: ${String(value)} is not a finite number`)
    }
  }

  const surge = vessel.surge
  const boosted = applyStatBoosts(vessel.stats, surge?.active ? surge.statBoosts : {})
  const stats = {} as CoreStats
  for (const key of CORE_STAT_KEYS) {
    const value = boosted[key]
    if (!Number.isFinite(value)) {
      throw new RangeError(`Cannot rate ${key}: ${String(value)} after surge boosts is not finite`)
    }
    stats[key] = Math.min(100, Math.max(0, value))
  }

  const bestTier: Record<EsmsToken, number> = { spirit: -1, essence: -1, matter: -1, substance: -1 }
  for (const seal of vessel.seals) {
    // Every Seal is checked, not only those that match this zone, so the answer is the same
    // whichever zone is asked about.
    if (!ESMS_TOKENS.includes(seal.token)) {
      throw new RangeError(`Seal ${seal.id} has an unknown token: ${String(seal.token)}`)
    }
    if (seal.tier === null) continue
    const tierIndex = SEAL_TIERS.indexOf(seal.tier)
    if (tierIndex < 0) {
      throw new RangeError(`Seal ${seal.id} has an unknown tier: ${String(seal.tier)}`)
    }
    if (tierIndex > bestTier[seal.token]) bestTier[seal.token] = tierIndex
  }

  return { stats, bestTier }
}

function rateInZone(prepared: PreparedVessel, profile: ZoneProfile): number {
  let weighted = 0
  for (const key of CORE_STAT_KEYS) weighted += profile.weights[key] * prepared.stats[key]
  const tierIndex = prepared.bestTier[profile.esmsToken]
  const multiplier = tierIndex < 0 ? 1 : SEAL_TIER_MULTIPLIERS[SEAL_TIERS[tierIndex]]
  return round2(weighted * multiplier)
}

/**
 * The vessel's ECR in one zone, to 2 dp. Throws `RangeError` for a zone id that is not an
 * integer from 0 to 10, for a non-finite stat (before or after surge boosts), and for a Seal
 * with an unknown token or tier.
 */
export function effectiveContestRating(vessel: ContestVessel, zoneId: number): number {
  const profile = requireZone(zoneId)
  return rateInZone(prepareVessel(vessel), profile)
}

// ─── Contest resolution ──────────────────────────────────────────────────────

/** Control points per percent of relative margin: a 10% lead moves control by 20. */
export const CONTROL_GAIN = 2

/** The most control that can change hands in one contest. */
export const MAX_CONTROL_SWING = 40

export interface ZoneContestResult {
  winner: 'attacker' | 'defender' | 'draw'
  /** The attacker's ECR in the zone. */
  attackerScore: number
  defenderScore: number
  /** |attackerScore − defenderScore|, 2 dp. */
  margin: number
  /** Signed from the attacker's side: positive if the attacker won, negative if the defender did. */
  controlDelta: number
  /** The attacker's share of the zone afterwards, clamped to 0–100. */
  nextControl: number
}

/**
 * Resolve one contest over a zone. `currentControl` is the **attacker's** share of the zone,
 * 0–100 (50 contested, 100 fully the attacker's); a value outside that range or non-finite
 * throws `RangeError`.
 *
 *   winner       strict comparison of the two 2-dp ECRs; equal is a draw
 *   margin       |attackerScore − defenderScore|, 2 dp
 *   controlDelta round(clamp(margin / max(attackerScore, defenderScore, 1) · 100 · CONTROL_GAIN,
 *                            0, MAX_CONTROL_SWING)), signed by the winner, 0 on a draw
 *   nextControl  clamp(currentControl + controlDelta, 0, 100)
 *
 * The swing is *relative* (margin over the larger score), so it does not grow just because a
 * zone's ratings are high. A winner by less than a rounding step can still carry a delta of 0.
 *
 * The result is symmetric: swapping attacker and defender and mirroring control (100 − c)
 * mirrors the result, since the swing is rounded as a magnitude before its sign is applied.
 */
export function resolveZoneContest(
  attacker: ContestVessel,
  defender: ContestVessel,
  zoneId: number,
  currentControl: number
): ZoneContestResult {
  if (!Number.isFinite(currentControl) || currentControl < 0 || currentControl > 100) {
    throw new RangeError(
      `currentControl must be a finite number from 0 to 100, got ${String(currentControl)}`
    )
  }
  const profile = requireZone(zoneId)
  const attackerScore = rateInZone(prepareVessel(attacker), profile)
  const defenderScore = rateInZone(prepareVessel(defender), profile)

  const winner =
    attackerScore > defenderScore ? 'attacker' : defenderScore > attackerScore ? 'defender' : 'draw'
  const margin = round2(Math.abs(attackerScore - defenderScore))

  const relative = (margin / Math.max(attackerScore, defenderScore, 1)) * 100 * CONTROL_GAIN
  const swing = Math.round(Math.min(MAX_CONTROL_SWING, Math.max(0, relative)))
  // `swing || 0` keeps a zero swing from becoming −0 on a defender win.
  const controlDelta = winner === 'attacker' ? swing : winner === 'defender' ? -swing || 0 : 0

  return {
    winner,
    attackerScore,
    defenderScore,
    margin,
    controlDelta,
    nextControl: Math.min(100, Math.max(0, currentControl + controlDelta)),
  }
}

// ─── Zone synergies ──────────────────────────────────────────────────────────

/** One zone's entry in the rating payload's `zoneSynergies`. */
export interface ZoneSynergy {
  zoneId: number
  kind: ZoneKindName
  label: string
  element: Element
  esmsToken: EsmsToken
  /** The vessel's ECR in this zone. */
  synergy: number
}

/** The vessel's ECR in all 11 zones, in zone-id order. Each equals `effectiveContestRating`. */
export function computeZoneSynergies(vessel: ContestVessel): ZoneSynergy[] {
  const prepared = prepareVessel(vessel)
  return ZONE_PROFILES.map(profile => ({
    zoneId: profile.zoneId,
    kind: profile.kind,
    label: profile.label,
    element: profile.element,
    esmsToken: profile.esmsToken,
    synergy: rateInZone(prepared, profile),
  }))
}

/** The zone where the vessel's ECR is highest; the lowest zone id wins a tie. */
export function bestZoneId(vessel: ContestVessel): number {
  const synergies = computeZoneSynergies(vessel)
  let best = synergies[0]
  for (const entry of synergies) if (entry.synergy > best.synergy) best = entry
  return best.zoneId
}
