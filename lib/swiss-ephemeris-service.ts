/**
 * Swiss Ephemeris Service (Frontend Facade)
 * ==========================================
 *
 * Air Element - Light, distributed visualization
 * Delegates all astronomical calculations to the backend (Earth vessel)
 *
 * Traditional Alchemical Principle:
 * This service acts as an Air vessel - light and ephemeral, channeling data
 * from the Earth vessel (backend with Swiss Ephemeris) without performing
 * heavy computational work itself.
 *
 * MIGRATION NOTE: This file now acts as a facade/adapter, maintaining the
 * same interface as before but delegating to the backend API client.
 * All direct swisseph-v2 imports have been removed.
 */

import { planetaryAPI } from '@/lib/planetary-api-client'

export interface SwissEphemPlanetPosition {
  planet: string
  sign: string
  degree: number // 0-29.9999 within sign
  longitude: number // 0-360 absolute longitude
  latitude: number
  distance: number
  speed: number
  retrograde: boolean
}

const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]

/**
 * Convert longitude to sign and degree
 */
function longitudeToSignDegree(longitude: number): { sign: string; degree: number } {
  // Normalize longitude to 0-360
  let normalizedLongitude = ((longitude % 360) + 360) % 360

  // Calculate sign index (0-11)
  const signIndex = Math.floor(normalizedLongitude / 30)

  // Calculate degree within sign (0-29.9999)
  const degree = normalizedLongitude % 30

  return {
    sign: ZODIAC_SIGNS[signIndex],
    degree: Math.max(0, Math.min(29.9999, degree)),
  }
}

/**
 * Get all planetary positions for a given date
 * Now delegates to backend API
 */
export async function getAllPlanetaryPositions(
  date: Date,
  latitude: number = 0,
  longitude: number = 0
): Promise<Record<string, SwissEphemPlanetPosition>> {
  try {
    // Call backend API for planetary positions
    const backendPositions = await planetaryAPI.getPlanetaryPositions(
      date,
      latitude !== 0 || longitude !== 0 ? latitude : undefined,
      latitude !== 0 || longitude !== 0 ? longitude : undefined
    )

    const positions: Record<string, SwissEphemPlanetPosition> = {}

    // Convert backend format to frontend format
    for (const [planetKey, pos] of Object.entries(backendPositions)) {
      // Capitalize planet name for consistency
      const planetName = planetKey.charAt(0).toUpperCase() + planetKey.slice(1)

      const { sign, degree } = longitudeToSignDegree(pos.longitude)

      positions[planetName] = {
        planet: planetName,
        sign,
        degree,
        longitude: pos.longitude,
        latitude: pos.latitude,
        distance: pos.distance,
        speed: pos.speed,
        retrograde: pos.speed < 0,
      }
    }

    // If coordinates provided, fetch house system data
    if (latitude !== 0 || longitude !== 0) {
      try {
        const houses = await planetaryAPI.getHouseSystem(date, latitude, longitude, 'P')

        // Add Ascendant
        const { sign: ascSign, degree: ascDegree } = longitudeToSignDegree(houses.ascendant)
        positions['Ascendant'] = {
          planet: 'Ascendant',
          sign: ascSign,
          degree: ascDegree,
          longitude: houses.ascendant,
          latitude: 0,
          distance: 0,
          speed: 0,
          retrograde: false,
        }

        // Add MC
        const { sign: mcSign, degree: mcDegree } = longitudeToSignDegree(houses.mc)
        positions['MC'] = {
          planet: 'MC',
          sign: mcSign,
          degree: mcDegree,
          longitude: houses.mc,
          latitude: 0,
          distance: 0,
          speed: 0,
          retrograde: false,
        }
      } catch (error) {
        console.warn('Failed to calculate Ascendant/MC:', error)
        // Continue without house system data
      }
    }

    return positions
  } catch (error) {
    console.error('[SwissEphemerisService] getAllPlanetaryPositions failed:', error)
    throw new Error(
      `Failed to fetch planetary positions from backend: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Get planetary position for a specific planet
 * Now delegates to backend API
 */
export async function getPlanetPosition(
  planetName: string,
  date: Date
): Promise<SwissEphemPlanetPosition | null> {
  try {
    // Request only the specific planet
    const planetKey = planetName.toLowerCase()
    const backendPositions = await planetaryAPI.getPlanetaryPositions(date, undefined, undefined, [
      planetKey,
    ])

    const pos = backendPositions[planetKey]
    if (!pos) {
      console.error(`Planet ${planetName} not found in backend response`)
      return null
    }

    const { sign, degree } = longitudeToSignDegree(pos.longitude)

    return {
      planet: planetName,
      sign,
      degree,
      longitude: pos.longitude,
      latitude: pos.latitude,
      distance: pos.distance,
      speed: pos.speed,
      retrograde: pos.speed < 0,
    }
  } catch (error) {
    console.error(`[SwissEphemerisService] Failed to calculate position for ${planetName}:`, error)
    return null
  }
}

/**
 * Close Swiss Ephemeris (no-op now, kept for API compatibility)
 */
export function closeSwissEphemeris(): void {
  // No-op: backend handles cleanup
  console.log('[SwissEphemerisService] Close called (delegated to backend)')
}

/**
 * Calculates a consciousness profile based on planetary positions.
 * This is the core logic for the Philosopher's Stone agent creation.
 */
export async function calculateConsciousness(date: Date, latitude: number, longitude: number) {
  const positions = await getAllPlanetaryPositions(date, latitude, longitude)

  // Elemental Mapping
  const elementMap: Record<string, 'Fire' | 'Water' | 'Air' | 'Earth'> = {
    Aries: 'Fire',
    Leo: 'Fire',
    Sagittarius: 'Fire',
    Cancer: 'Water',
    Scorpio: 'Water',
    Pisces: 'Water',
    Gemini: 'Air',
    Libra: 'Air',
    Aquarius: 'Air',
    Taurus: 'Earth',
    Virgo: 'Earth',
    Capricorn: 'Earth',
  }

  const elements = { Fire: 0, Water: 0, Air: 0, Earth: 0 }
  let totalPoints = 0

  // Simple weighting system for planets
  const weights: Record<string, number> = {
    Sun: 3,
    Moon: 3,
    Ascendant: 3,
    Mercury: 2,
    Venus: 2,
    Mars: 2,
    Jupiter: 1,
    Saturn: 1,
    Uranus: 1,
    Neptune: 1,
    Pluto: 1,
  }

  for (const [planet, pos] of Object.entries(positions)) {
    const weight = weights[planet] || 1
    const element = elementMap[pos.sign]
    if (element) {
      elements[element] += weight
      totalPoints += weight
    }
  }

  // Normalize elements to percentages
  const normalizedElements = {
    Fire: totalPoints > 0 ? elements.Fire / totalPoints : 0,
    Water: totalPoints > 0 ? elements.Water / totalPoints : 0,
    Air: totalPoints > 0 ? elements.Air / totalPoints : 0,
    Earth: totalPoints > 0 ? elements.Earth / totalPoints : 0,
  }

  // Determine dominant element
  const dominantElement = Object.entries(normalizedElements).sort(([, a], [, b]) => b - a)[0][0]

  // Calculate a Monica Constant (complex synthesis of planetary longitudes)
  // For now, a pseudo-hash based on Sun, Moon, Ascendant degrees
  let monicaSum = 0
  if (positions['Sun']) monicaSum += positions['Sun'].longitude
  if (positions['Moon']) monicaSum += positions['Moon'].longitude * 1.5
  if (positions['Ascendant']) monicaSum += positions['Ascendant'].longitude * 2

  const monicaConstant = (monicaSum % 360) / 360.0

  return {
    positions,
    elements: normalizedElements,
    dominantElement,
    monicaConstant,
  }
}

// Export singleton instance
export const swissEphemerisService = {
  getAllPlanetaryPositions,
  getPlanetPosition,
  calculateConsciousness,
  close: closeSwissEphemeris,
}
