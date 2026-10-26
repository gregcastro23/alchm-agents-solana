/** Strict adapters for recorded stats and attributed chart positions. No invented defaults. */
import { ALL_VESSEL_STAT_KEYS, PLANETARY_STAT_KEYS, type VesselStats } from './progression'
import { SACRED_STAT_KEYS } from '@/lib/agents/rating-contract'
import { SIGN_ORDER } from '@/lib/agents/council/aspect-dialogue-engine'

export const PLANETARY_BODIES = [
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
export type PlanetaryBody = (typeof PLANETARY_BODIES)[number]
export interface NatalPlacementInput {
  sign?: string
  degree?: number
  longitude?: number
}
export interface AgentStatSource {
  sacredStats?: Partial<VesselStats>
  planetaryStats?: Partial<Record<(typeof PLANETARY_STAT_KEYS)[number], number>>
  consciousness?: {
    natalChart?: { provenance?: string; planets?: Record<string, NatalPlacementInput> }
  }
  stats?: { conversations?: number }
  conversations?: number
}

function bounded(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError('A recorded finite stat is required')
  }
  return Math.max(minimum, Math.min(maximum, value))
}
export const clampSacredStat = (value: unknown) => bounded(value, 25, 99)
export const clampPlanetaryStat = (value: unknown) => bounded(value, 0, 100)

export function placementToLongitude(placement: NatalPlacementInput | undefined): number | null {
  if (!placement || typeof placement !== 'object') return null
  const hasLongitude = placement.longitude !== undefined
  if (hasLongitude && !Number.isFinite(placement.longitude)) return null
  const hasSign = placement.sign !== undefined
  const hasDegree = placement.degree !== undefined
  let fromSign: number | null = null
  if (hasSign || hasDegree) {
    const index = SIGN_ORDER.findIndex(
      sign => sign.toLowerCase() === placement.sign?.trim().toLowerCase()
    )
    const degree = placement.degree
    if (
      index < 0 ||
      typeof degree !== 'number' ||
      !Number.isFinite(degree) ||
      degree < 0 ||
      degree >= 30
    )
      return null
    fromSign = index * 30 + degree
  }
  if (!hasLongitude) return fromSign
  const longitude = ((placement.longitude! % 360) + 360) % 360
  if (fromSign !== null) {
    const distance = Math.abs(longitude - fromSign)
    if (Math.min(distance, 360 - distance) > 0.000001) return null
  }
  return longitude
}

export function resolveNatalLongitudes(
  planets: Record<string, NatalPlacementInput> | undefined
): Record<string, { longitude: number }> {
  const result: Record<string, { longitude: number }> = {}
  if (!planets || typeof planets !== 'object' || Array.isArray(planets)) return result
  for (const [name, placement] of Object.entries(planets)) {
    const body = PLANETARY_BODIES.find(
      candidate => candidate.toLowerCase() === name.trim().toLowerCase()
    )
    if (!body) continue
    if (result[body]) throw new RangeError(`Duplicate natal position for ${body}`)
    const longitude = placementToLongitude(placement)
    if (longitude === null) throw new RangeError(`Invalid natal position for ${body}`)
    result[body] = { longitude }
  }
  return result
}

/** Existing CraftedAgent.sacredStats can hold all 19 keys; split sources are also accepted. */
export function resolve19Stats(source?: AgentStatSource): VesselStats {
  const result = {} as VesselStats
  for (const key of ALL_VESSEL_STAT_KEYS) {
    const sacred = (SACRED_STAT_KEYS as readonly string[]).includes(key)
    const value = sacred
      ? source?.sacredStats?.[key]
      : (source?.planetaryStats?.[key as (typeof PLANETARY_STAT_KEYS)[number]] ??
        source?.sacredStats?.[key])
    const minimum = sacred ? 25 : 0
    const maximum = sacred ? 99 : 100
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < minimum ||
      value > maximum
    ) {
      throw new RangeError(`Recorded ${key} is required in [${minimum}, ${maximum}]`)
    }
    result[key] = value
  }
  return result
}
