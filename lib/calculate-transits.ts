/**
 * Transit position calculator — synchronous wrapper around the enhanced
 * astronomical calculator. Used by the Time Laboratory page.
 */

import {
  toJulianDay,
  calculateEnhancedPlanetPosition,
  longitudeToSignDegree,
} from './enhanced-astronomical-calculator'

export interface CurrentPlanetPosition {
  sign: string
  degree: number
  retrograde: boolean
  longitude: number
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
 * Returns the current approximate position for each planet.
 * Uses the enhanced VSOP87-based calculator (±0.1° accuracy for inner planets).
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
        degree: Math.round(degree * 100) / 100,
        retrograde: pos.retrograde,
        longitude: Math.round(pos.longitude * 10000) / 10000,
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
