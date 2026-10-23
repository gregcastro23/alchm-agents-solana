/** Pure, versioned Vessel progression. XP is permanent; the sky changes only current ratings. */
import { SACRED_STAT_KEYS, type SacredStatKey } from '@/lib/agents/sacred-stat-keys'
import { detectAspect, type AspectName } from '@/lib/agents/council/aspect-dialogue-engine'
import {
  computeAmbientAlchemicalTide,
  computeDignityWaveharmonics,
  computeDyadicChordGain,
  computeEsmsAxisAttribution,
  computeSkyEsmsWavefunction,
  type EsmsAxisAttribution,
  type EsmsWavefunction,
} from '@/lib/vessel/esms-wavefunction'

export {
  computeAmbientAlchemicalTide,
  computeDignityWaveharmonics,
  computeDyadicChordGain,
  computeEsmsAxisAttribution,
  computeSkyEsmsWavefunction,
  type EsmsAxisAttribution,
  type EsmsWavefunction,
}

export const PLANETARY_STAT_KEYS = [
  'solarAgency',
  'lunarReceptivity',
  'mercurialVelocity',
  'venusianCoherence',
  'martialImpetus',
  'jovianExpansion',
  'saturnianStructure',
  'chironicAdaptation',
  'uranianSurprisal',
  'neptunianResonance',
  'plutonicIntegration',
  'kineticAlignment',
] as const

export const ALL_VESSEL_STAT_KEYS = [...SACRED_STAT_KEYS, ...PLANETARY_STAT_KEYS] as const
export type VesselStatKey = (typeof ALL_VESSEL_STAT_KEYS)[number]
export type VesselStats = Record<VesselStatKey, number>
export const VESSEL_PROGRESSION_VERSION = 1 as const
export const MAX_SKY_AGE_MS = 15 * 60 * 1000

export const MAX_DIGNITY_OVR_DELTA = 15 as const
export const MAX_SACRED_DELTA = 18 as const
export const MAX_PLANETARY_DELTA = 24 as const

export interface VesselProgressionInput {
  /** Sacred 7 use [25,99]; Planetary 12 use [0,100]. */
  stats: VesselStats
  totalXp: number
  natal: {
    provenance: 'computed' | 'authored' | 'placeholder' | 'unattributed'
    /** Partial attributed DNA is allowed, but yields an estimated Current Overall. */
    positions: Record<string, { longitude: number }>
  }
  sky: {
    asOf: string
    source: 'swiss-ephemeris' | 'vsop87-approximation' | 'unverified'
    /** Ten main planets are required for live status; Chiron is optional. */
    positions: Record<string, { longitude: number }>
  } | null
  character: { primary: SacredStatKey; secondary: SacredStatKey }
  now: number
}

export interface VesselProgression {
  version: typeof VESSEL_PROGRESSION_VERSION
  level: number
  totalXp: number
  /** Null at level 100; XP can still accumulate. */
  xpToNextLevel: number | null
  baseOverall: number
  trainedOverall: number
  currentOverall: number | null
  /** True unclamped [-15, +15] scalar celestial dignity delta, preserved even when currentOverall saturates at 25 or 99. */
  transitDelta?: number | null
  /** Four-axis ESMS attribution in [-1, 1]^4 showing which alchemical element drives the live transit shift. */
  esmsAxisAttribution?: EsmsAxisAttribution | null
  status: 'live' | 'estimated' | 'unavailable'
  asOf: string | null
  reasons: string[]
  /** Applied sky-only deltas from the input stats, in each stat's native scale.
   * The permanent level boost is applied to Overall, not to individual stats.
   */
  statDeltas: VesselStats
}

const PLANETS = [
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
  'Chiron',
] as const
type Planet = (typeof PLANETS)[number]
type Affinity = Partial<Record<Planet, number>>
const REQUIRED_PLANETS = PLANETS.filter(planet => planet !== 'Chiron')

/** Explicit game tuning, using the canonical stat-to-planet vocabulary. */
const AFFINITIES: Record<VesselStatKey, Affinity> = {
  power: { Sun: 2, Mars: 2, Pluto: 1 },
  resonance: { Moon: 2, Venus: 1, Neptune: 2 },
  wisdom: { Mercury: 2, Jupiter: 2, Saturn: 1 },
  charisma: { Sun: 1, Venus: 2, Jupiter: 1 },
  intuition: { Moon: 2, Neptune: 2, Chiron: 1 },
  adaptability: { Mercury: 2, Uranus: 2, Chiron: 1 },
  vitality: { Sun: 2, Mars: 1, Saturn: 1 },
  solarAgency: { Sun: 1 },
  lunarReceptivity: { Moon: 1 },
  mercurialVelocity: { Mercury: 1 },
  venusianCoherence: { Venus: 1 },
  martialImpetus: { Mars: 1 },
  jovianExpansion: { Jupiter: 1 },
  saturnianStructure: { Saturn: 1 },
  chironicAdaptation: { Chiron: 1 },
  uranianSurprisal: { Uranus: 1 },
  neptunianResonance: { Neptune: 1 },
  plutonicIntegration: { Pluto: 1 },
  kineticAlignment: Object.fromEntries(PLANETS.map(planet => [planet, 1])),
}

/** Game responses, not a claim that astrological geometry measures human ability. */
const ASPECT_RESPONSE: Record<AspectName, number> = {
  Conjunction: 1,
  Opposition: -1,
  Trine: 0.85,
  Square: -0.8,
  Sextile: 0.6,
  Quincunx: -0.4,
  'Semi-Sextile': 0.25,
}
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value))
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const isSacred = (key: VesselStatKey): key is SacredStatKey =>
  (SACRED_STAT_KEYS as readonly string[]).includes(key)
const zeroDeltas = () =>
  Object.fromEntries(ALL_VESSEL_STAT_KEYS.map(key => [key, 0])) as VesselStats

function normalizedStat(key: VesselStatKey, value: number): number {
  return isSacred(key) ? (value - 25) / 74 : value / 100
}

function overall(stats: VesselStats): number {
  const sacred = sum(SACRED_STAT_KEYS.map(key => normalizedStat(key, stats[key]))) / 7
  const planetary = sum(PLANETARY_STAT_KEYS.map(key => normalizedStat(key, stats[key]))) / 12
  return 25 + 74 * (sacred * 0.5 + planetary * 0.5)
}

function parsePositions(
  positions: Record<string, { longitude: number }> | undefined,
  label: string,
  reasons: string[]
): Partial<Record<Planet, number>> | null {
  if (!positions || typeof positions !== 'object' || Array.isArray(positions)) {
    reasons.push(`${label} positions are unavailable.`)
    return null
  }
  const parsed: Partial<Record<Planet, number>> = {}
  for (const [name, position] of Object.entries(positions)) {
    const planet = PLANETS.find(candidate => candidate.toLowerCase() === name.trim().toLowerCase())
    if (!planet) continue
    if (parsed[planet] !== undefined || !Number.isFinite(position?.longitude)) {
      reasons.push(`${label} has an invalid or duplicate ${planet} position.`)
      return null
    }
    parsed[planet] = ((position.longitude % 360) + 360) % 360
  }
  return parsed
}

function affinityOverlap(affinity: Affinity, signature: Affinity): number {
  const weight = sum(Object.values(affinity))
  return sum(PLANETS.map(planet => (affinity[planet] ?? 0) * (signature[planet] ? 1 : 0))) / weight
}

const SIGN_RULERS: Record<
  number,
  { domicile: string[]; exaltation: string[]; detriment: string[]; fall: string[] }
> = {
  0: { domicile: ['Mars'], exaltation: ['Sun'], detriment: ['Venus'], fall: ['Saturn'] }, // Aries
  1: { domicile: ['Venus'], exaltation: ['Moon'], detriment: ['Mars', 'Pluto'], fall: ['Uranus'] }, // Taurus
  2: { domicile: ['Mercury'], exaltation: [], detriment: ['Jupiter'], fall: [] }, // Gemini
  3: { domicile: ['Moon'], exaltation: ['Jupiter'], detriment: ['Saturn'], fall: ['Mars'] }, // Cancer
  4: {
    domicile: ['Sun'],
    exaltation: ['Neptune'],
    detriment: ['Saturn', 'Uranus'],
    fall: ['Pluto'],
  }, // Leo
  5: {
    domicile: ['Mercury', 'Chiron'],
    exaltation: ['Mercury'],
    detriment: ['Jupiter', 'Neptune'],
    fall: ['Venus'],
  }, // Virgo
  6: { domicile: ['Venus'], exaltation: ['Saturn'], detriment: ['Mars'], fall: ['Sun'] }, // Libra
  7: { domicile: ['Mars', 'Pluto'], exaltation: ['Uranus'], detriment: ['Venus'], fall: ['Moon'] }, // Scorpio
  8: { domicile: ['Jupiter'], exaltation: ['Chiron'], detriment: ['Mercury'], fall: [] }, // Sagittarius
  9: { domicile: ['Saturn'], exaltation: ['Mars'], detriment: ['Moon'], fall: ['Jupiter'] }, // Capricorn
  10: { domicile: ['Saturn', 'Uranus'], exaltation: [], detriment: ['Sun'], fall: ['Neptune'] }, // Aquarius
  11: {
    domicile: ['Jupiter', 'Neptune'],
    exaltation: ['Venus'],
    detriment: ['Mercury'],
    fall: ['Mercury'],
  }, // Pisces
}

const CONJUNCTION_BASE_BIAS: Record<string, number> = {
  Sun: 0.85,
  Moon: 0.8,
  Venus: 0.9,
  Jupiter: 0.95,
  Mercury: 0.65,
  Chiron: 0.6,
  Uranus: 0.5,
  Neptune: 0.55,
  Mars: 0.25,
  Saturn: 0.25,
  Pluto: 0.2,
}

/**
 * Returns classical essential dignity score in [-3, +3] for a planet at a given ecliptic longitude.
 * Domicile: +3 | Exaltation: +2 | Detriment: -2 | Fall: -3 | Peregrine: 0
 */
export function computeEssentialDignityScore(planet: string, longitude: number): number {
  const normalizedLon = ((longitude % 360) + 360) % 360
  const signIndex = Math.floor(normalizedLon / 30)
  const table = SIGN_RULERS[signIndex]
  if (!table) return 0

  const p = planet.trim().toLowerCase()
  const match = (list: string[]) => list.some(item => item.toLowerCase() === p)

  if (match(table.domicile)) return 3
  if (match(table.exaltation)) return 2
  if (match(table.fall)) return -3
  if (match(table.detriment)) return -2
  return 0
}

/**
 * Stage 2: Active-Energy Normalized Planetary Response Vector in [-1, 1]^11
 * Coupled with the 4D ESMS Wavefunction \Psi(t) via Channel A (ambient tide)
 * and Channel B (dyadic chord reception gain).
 */
export function computePlanetaryResponseVector(
  natalLongitudes: Partial<Record<Planet, number>>,
  skyLongitudes: Partial<Record<Planet, number>>,
  bodies: readonly Planet[] = PLANETS,
  wavefunctionOverride?: EsmsWavefunction
): Record<Planet, number> {
  const responses = {} as Record<Planet, number>
  const TAU_SQUARED = 2.25 // Damping floor (1.5^2)
  const KAPPA_ASPECT = 1.15
  const KAPPA_ESSENTIAL = 0.35
  const KAPPA_PSI = 0.12
  const wavefunction =
    wavefunctionOverride ?? computeSkyEsmsWavefunction(skyLongitudes, computeEssentialDignityScore)
  const presentSkyCount = bodies.filter(b => skyLongitudes[b] !== undefined).length

  for (const natalBody of bodies) {
    const natalLon = natalLongitudes[natalBody]
    if (natalLon === undefined) {
      responses[natalBody] = 0
      continue
    }

    const skySelfLon = skyLongitudes[natalBody]
    let weightedSum = 0
    let activeWeightSqSum = 0

    for (const transitBody of bodies) {
      const isSameBody = natalBody === transitBody
      const pairWeight = isSameBody ? 3.0 : 1.0
      const transitLon = skyLongitudes[transitBody]
      if (transitLon === undefined) {
        // When a required sky planet is missing from a multi-planet snapshot, retain its
        // denominator weight so missing telemetry never amplifies remaining measurements.
        if (presentSkyCount > 1 && transitBody !== 'Chiron') {
          activeWeightSqSum += pairWeight * pairWeight
        }
        continue
      }

      const aspect = detectAspect(natalLon, transitLon)
      if (!aspect) continue

      const transitEssential = computeEssentialDignityScore(transitBody, transitLon)

      // Conjunctions are modulated by the transiting body's essential dignity & nature
      const basePolarity =
        aspect.name === 'Conjunction'
          ? clamp((CONJUNCTION_BASE_BIAS[transitBody] ?? 0.55) + 0.2 * transitEssential, -0.85, 1.0)
          : ASPECT_RESPONSE[aspect.name] *
            (1 + 0.08 * transitEssential * Math.sign(ASPECT_RESPONSE[aspect.name]))

      const attenuation = Math.max(0, 1 - aspect.orb / aspect.definition.orb)
      const chordGain = computeDyadicChordGain(natalBody, transitBody, basePolarity, wavefunction)
      const responseIJ = basePolarity * chordGain * attenuation

      if (Math.abs(responseIJ) > 0) {
        weightedSum += pairWeight * responseIJ
        activeWeightSqSum += pairWeight * pairWeight
      }
    }

    const aspectEnergy = weightedSum / Math.sqrt(activeWeightSqSum + TAU_SQUARED)
    const essentialPosture =
      skySelfLon !== undefined ? computeEssentialDignityScore(natalBody, skySelfLon) / 3.0 : 0
    const ambientTide =
      skySelfLon !== undefined ? computeAmbientAlchemicalTide(natalBody, wavefunction) : 0

    responses[natalBody] = Math.tanh(
      KAPPA_ASPECT * aspectEnergy + KAPPA_ESSENTIAL * essentialPosture + KAPPA_PSI * ambientTide
    )
  }

  return responses
}

/**
 * Stage 3 & 4: Variance-Preserving Affinity Projection & Archetype Amplification
 */
export function computeDignityStatDeltas(
  planetaryResponses: Record<Planet, number>,
  primaryStat: SacredStatKey,
  secondaryStat: SacredStatKey
): VesselStats {
  const deltas = {} as VesselStats
  const primaryAffinity = AFFINITIES[primaryStat]
  const secondaryAffinity = AFFINITIES[secondaryStat]

  for (const key of ALL_VESSEL_STAT_KEYS) {
    const affinity = AFFINITIES[key]
    let dot = 0
    let l1Norm = 0
    let l2SqNorm = 0

    for (const planet of PLANETS) {
      const weight = affinity[planet] ?? 0
      const r = planetaryResponses[planet] ?? 0
      dot += weight * r
      l1Norm += Math.abs(weight)
      l2SqNorm += weight * weight
    }

    const hybridNorm = Math.sqrt(l1Norm * Math.sqrt(l2SqNorm))
    const rho = hybridNorm > 0 ? clamp(dot / hybridNorm, -1, 1) : 0

    // Amplifying sensitivity in [0.85, 1.35] instead of dampening in [0.75, 1.00]
    const ovPrimary = affinityOverlap(affinity, primaryAffinity)
    const ovSecondary = affinityOverlap(affinity, secondaryAffinity)
    const c_k = 0.85 + 0.3 * ovPrimary + 0.2 * ovSecondary

    const isSacredStat = isSacred(key)
    const scale = isSacredStat ? 74 : 100
    const maxCap = isSacredStat ? MAX_SACRED_DELTA : MAX_PLANETARY_DELTA

    const rawDelta = rho * c_k * (MAX_DIGNITY_OVR_DELTA / 74) * scale
    deltas[key] = clamp(rawDelta, -maxCap, maxCap)
  }

  return deltas
}

const OWA_SACRED_WEIGHTS = [
  1.6 / 7.9,
  1.3 / 7.9,
  1.0 / 7.9,
  1.0 / 7.9,
  1.0 / 7.9,
  1.0 / 7.9,
  1.0 / 7.9,
] as const

export function computeScalarDignityRating(
  vesselStats: VesselStats,
  statDeltas: VesselStats,
  primaryStat?: SacredStatKey,
  secondaryStat?: SacredStatKey
): number {
  const modifiedStats = Object.fromEntries(
    ALL_VESSEL_STAT_KEYS.map(key => [key, vesselStats[key] + statDeltas[key]])
  ) as VesselStats

  const uniformDelta = overall(modifiedStats) - overall(vesselStats)

  // Order Sacred 7 keys by archetype primary & secondary, then descending by permanent vessel stats
  const sortedByValue = [...SACRED_STAT_KEYS].sort((a, b) => {
    const diff = vesselStats[b] - vesselStats[a]
    if (diff !== 0) return diff
    return SACRED_STAT_KEYS.indexOf(a) - SACRED_STAT_KEYS.indexOf(b)
  })
  const primary = primaryStat ?? sortedByValue[0]
  const secondary = secondaryStat ?? sortedByValue.find(k => k !== primary) ?? sortedByValue[1]
  const restKeys = sortedByValue.filter(k => k !== primary && k !== secondary)
  const orderedSacredKeys = [primary, secondary, ...restKeys]

  const owaSacredDelta = orderedSacredKeys.reduce(
    (acc, key, idx) => acc + OWA_SACRED_WEIGHTS[idx]! * (statDeltas[key] ?? 0),
    0
  )

  const blendedDelta = 0.6 * uniformDelta + 0.4 * owaSacredDelta
  return clamp(blendedDelta, -MAX_DIGNITY_OVR_DELTA, MAX_DIGNITY_OVR_DELTA)
}

/** Permanent earned growth remains available even when chart or stat data is missing. */
export function computeVesselGrowth(totalXp: number): {
  level: number
  totalXp: number
  xpToNextLevel: number | null
  levelBoost: number
} {
  if (!Number.isSafeInteger(totalXp) || totalXp < 0) {
    throw new RangeError('totalXp must be a nonnegative safe integer')
  }
  const level = Math.min(100, 1 + Math.floor(Math.sqrt(totalXp / 100)))
  return {
    level,
    totalXp,
    xpToNextLevel: level === 100 ? null : 100 * level ** 2 - totalXp,
    levelBoost: (12 * (level - 1)) / 99,
  }
}

/**
 * One deterministic snapshot. No fetching, clock reads, random values or XP writes.
 * Every stat contributes to overall. Level adds at most 12 points; sky adds or
 * removes at most 15, and never changes XP, level or the trained baseline.
 */
export function computeVesselProgression(input: VesselProgressionInput): VesselProgression {
  const growth = computeVesselGrowth(input.totalXp)
  if (!Number.isFinite(input.now) || !Number.isFinite(new Date(input.now).getTime())) {
    throw new RangeError('now must be a valid timestamp')
  }
  for (const key of ALL_VESSEL_STAT_KEYS) {
    const value = input.stats?.[key]
    const minimum = isSacred(key) ? 25 : 0
    const maximum = isSacred(key) ? 99 : 100
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new RangeError(`${key} must be finite and within [${minimum}, ${maximum}]`)
    }
  }
  if (
    !input.character ||
    !SACRED_STAT_KEYS.includes(input.character.primary) ||
    !SACRED_STAT_KEYS.includes(input.character.secondary)
  ) {
    throw new RangeError('character must identify canonical Sacred stats')
  }

  const baseOverall = overall(input.stats)
  const trainedOverall = clamp(baseOverall + growth.levelBoost, 25, 99)
  const result: VesselProgression = {
    version: VESSEL_PROGRESSION_VERSION,
    level: growth.level,
    totalXp: growth.totalXp,
    xpToNextLevel: growth.xpToNextLevel,
    baseOverall,
    trainedOverall,
    currentOverall: null,
    transitDelta: null,
    esmsAxisAttribution: null,
    status: 'unavailable',
    asOf: null,
    reasons: [],
    statDeltas: zeroDeltas(),
  }

  if (!input.natal || !['computed', 'authored'].includes(input.natal.provenance)) {
    result.reasons.push(
      'An attributed natal chart is required; placeholder or unattributed DNA is unavailable.'
    )
    return result
  }
  if (!input.sky || !['swiss-ephemeris', 'vsop87-approximation'].includes(input.sky.source)) {
    result.reasons.push('A sourced current sky snapshot is unavailable.')
    return result
  }
  const skyTime = Date.parse(input.sky.asOf)
  if (!Number.isFinite(skyTime)) {
    result.reasons.push('The sky snapshot has no valid observation time.')
    return result
  }
  result.asOf = new Date(skyTime).toISOString()
  if (input.now - skyTime > MAX_SKY_AGE_MS || skyTime - input.now > 60_000) {
    result.reasons.push('The sky snapshot is stale or does not describe the current time.')
    return result
  }

  const natal = parsePositions(input.natal.positions, 'Natal chart', result.reasons)
  const sky = parsePositions(input.sky.positions, 'Sky snapshot', result.reasons)
  if (!natal || !sky) return result
  const natalBodies = PLANETS.filter(planet => natal[planet] !== undefined)
  const skyBodies = PLANETS.filter(planet => sky[planet] !== undefined)
  if (!natalBodies.length || !skyBodies.length) {
    result.reasons.push('No natal and current planetary positions can be compared.')
    return result
  }
  const missingNatal = REQUIRED_PLANETS.filter(planet => natal[planet] === undefined)
  const missingSky = REQUIRED_PLANETS.filter(planet => sky[planet] === undefined)
  if (missingNatal.length)
    result.reasons.push(`Natal chart coverage unavailable for ${missingNatal.join(', ')}.`)
  if (missingSky.length)
    result.reasons.push(`Sky snapshot coverage unavailable for ${missingSky.join(', ')}.`)
  if (natal.Chiron === undefined || sky.Chiron === undefined) {
    result.reasons.push(
      'Optional Chiron coverage is incomplete; missing placements contribute no transit response.'
    )
  }
  if (input.natal.provenance === 'authored')
    result.reasons.push('Natal DNA is authored, not a verified ephemeris measurement.')
  if (input.sky.source === 'vsop87-approximation')
    result.reasons.push('Current sky positions are approximate.')
  result.status =
    input.natal.provenance === 'computed' &&
    input.sky.source === 'swiss-ephemeris' &&
    !missingNatal.length &&
    !missingSky.length
      ? 'live'
      : 'estimated'

  const wavefunction = computeSkyEsmsWavefunction(sky, computeEssentialDignityScore)
  const responses = computePlanetaryResponseVector(natal, sky, PLANETS, wavefunction)
  const rawDeltas = computeDignityStatDeltas(
    responses,
    input.character.primary,
    input.character.secondary
  )

  for (const key of ALL_VESSEL_STAT_KEYS) {
    const isSacredStat = isSacred(key)
    const minBound = isSacredStat ? 25 : 0
    const maxBound = isSacredStat ? 99 : 100
    result.statDeltas[key] =
      clamp(input.stats[key] + rawDeltas[key], minBound, maxBound) - input.stats[key]
  }

  const transitDelta = computeScalarDignityRating(
    input.stats,
    result.statDeltas,
    input.character.primary,
    input.character.secondary
  )
  result.transitDelta = transitDelta
  result.esmsAxisAttribution = computeEsmsAxisAttribution(responses, wavefunction)
  result.currentOverall = clamp(trainedOverall + transitDelta, 25, 99)
  return result
}
