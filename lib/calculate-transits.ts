/**
 * Transit position calculator — synchronous wrapper around the enhanced
 * astronomical calculator. Used by the Time Laboratory page.
 */

import {
  toJulianDay,
  calculateEnhancedPlanetPosition,
  longitudeToSignDegree,
  type EphemerisSource,
} from './enhanced-astronomical-calculator'

export interface CurrentPlanetPosition {
  sign: string
  degree: number
  retrograde: boolean
  longitude: number
  /** Daily motion in degrees per day (signed, negative = retrograde) */
  speed?: number
  /** The origin of this position, retained through every council adapter. */
  source?: EphemerisSource | 'unverified'
  asOf?: string
}

export class DegradedEphemerisError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DegradedEphemerisError'
  }
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
] as const

/**
 * Returns labelled local Keplerian approximations, never measured Swiss positions.
 */
export function getCurrentPlanetaryPositions(
  date: Date = new Date(),
  options?: { requireComplete?: boolean }
): Record<string, CurrentPlanetPosition> {
  const jd = toJulianDay(date)
  const result: Record<string, CurrentPlanetPosition> = {}

  for (const planet of PLANETS) {
    try {
      const pos = calculateEnhancedPlanetPosition(planet, jd)
      const { sign, degree } = longitudeToSignDegree(pos.longitude)
      result[planet] = {
        sign,
        degree,
        retrograde: pos.retrograde,
        longitude: pos.longitude,
        speed: pos.speed,
        source: pos.source,
        asOf: date.toISOString(),
      }
    } catch {
      // Skip planets that fail calculation
    }
  }

  if (options?.requireComplete && Object.keys(result).length < PLANETS.length) {
    throw new DegradedEphemerisError(
      `Degraded ephemeris read: resolved only ${Object.keys(result).length} of ${PLANETS.length} bodies`
    )
  }

  return result
}
