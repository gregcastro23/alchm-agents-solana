/** Pure, versioned Vessel progression. XP is permanent; the sky changes only current ratings. */
import { SACRED_STAT_KEYS, type SacredStatKey } from '@/lib/agents/sacred-stat-keys'
import { detectAspect, type AspectName } from '@/lib/agents/council/aspect-dialogue-engine'

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

/**
 * Every transit can aspect every natal body. A same-body return carries three
 * units of influence; each cross-body aspect carries one. These fixed weights
 * are game tuning and their denominator includes missing bodies, so incomplete
 * charts never concentrate all influence into the remaining measurements.
 *
 * The orb taper is continuous at the edge of each aspect and bounded [-1, 1].
 * The aspect engine is pure geometry and has no profile or ephemeris imports.
 */
function natalTransitResponse(
  natalBody: Planet,
  natalLongitude: number,
  sky: Partial<Record<Planet, number>>
): number {
  let response = 0
  let totalWeight = 0
  for (const transitBody of PLANETS) {
    const weight = transitBody === natalBody ? 3 : 1
    totalWeight += weight
    const transitLongitude = sky[transitBody]
    if (transitLongitude === undefined) continue
    const aspect = detectAspect(natalLongitude, transitLongitude)
    if (aspect) {
      response +=
        weight * ASPECT_RESPONSE[aspect.name] * Math.max(0, 1 - aspect.orb / aspect.definition.orb)
    }
  }
  return response / totalWeight
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
 * removes at most 8, and never changes XP, level or the trained baseline.
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

  const responses: Partial<Record<Planet, number>> = {}
  for (const planet of natalBodies) {
    responses[planet] = natalTransitResponse(planet, natal[planet]!, sky)
  }
  for (const key of ALL_VESSEL_STAT_KEYS) {
    const affinity = AFFINITIES[key]
    // Missing bodies keep their weight but contribute no response: partial DNA
    // never amplifies a remaining body's effect or invents a placement.
    const response =
      sum(PLANETS.map(planet => (affinity[planet] ?? 0) * (responses[planet] ?? 0))) /
      sum(Object.values(affinity))
    const sensitivity =
      0.75 +
      0.15 * affinityOverlap(affinity, AFFINITIES[input.character.primary]) +
      0.1 * affinityOverlap(affinity, AFFINITIES[input.character.secondary])
    const scale = isSacred(key) ? 74 : 100
    const delta = response * sensitivity * (8 / 74) * scale
    result.statDeltas[key] =
      clamp(input.stats[key] + delta, isSacred(key) ? 25 : 0, isSacred(key) ? 99 : 100) -
      input.stats[key]
  }
  const changed = Object.fromEntries(
    ALL_VESSEL_STAT_KEYS.map(key => [key, input.stats[key] + result.statDeltas[key]])
  ) as VesselStats
  const transitDelta = clamp(overall(changed) - baseOverall, -8, 8)
  result.currentOverall = clamp(trainedOverall + transitDelta, 25, 99)
  return result
}
