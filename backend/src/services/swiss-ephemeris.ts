/**
 * Swiss Ephemeris Service (Backend)
 * ==================================
 *
 * Earth Element - Stable, native compilation
 * Performs high-accuracy astronomical calculations using Swiss Ephemeris
 * ±0.001° accuracy for all planetary positions
 *
 * Traditional Alchemical Principle:
 * This service embodies the Earth element - stable, persistent, and foundational.
 * Heavy computational work (native modules) belongs in the Earth vessel (backend),
 * while light visualization (React) belongs in the Air vessel (frontend).
 */

import swisseph from 'swisseph'

export interface PlanetaryPosition {
  longitude: number // 0-360 degrees
  latitude: number // Ecliptic latitude
  distance: number // Distance from Earth in AU
  speed: number // Degrees per day
}

export interface HouseSystem {
  houses: number[] // 12 house cusps in degrees
  ascendant: number // Rising sign degree
  mc: number // Midheaven degree
}

export interface ConsciousnessParameters {
  spirit: number // Fire element (0-1)
  essence: number // Air element (0-1)
  matter: number // Water element (0-1)
  substance: number // Earth element (0-1)
  monicaConstant: number // (Spirit × φ + Essence) / (Matter + Substance + 1)
  planetaryInfluences: Record<
    string,
    {
      element: string
      strength: number
    }
  >
}

// Swiss Ephemeris planet constants
const PLANETS = {
  sun: swisseph.SE_SUN,
  moon: swisseph.SE_MOON,
  mercury: swisseph.SE_MERCURY,
  venus: swisseph.SE_VENUS,
  mars: swisseph.SE_MARS,
  jupiter: swisseph.SE_JUPITER,
  saturn: swisseph.SE_SATURN,
  uranus: swisseph.SE_URANUS,
  neptune: swisseph.SE_NEPTUNE,
  pluto: swisseph.SE_PLUTO,
  'north-node': swisseph.SE_TRUE_NODE,
  chiron: swisseph.SE_CHIRON,
} as const

// Planetary alchemy correspondences (from frontend alchemizer.ts)
const PLANETARY_ALCHEMY: Record<
  string,
  { spirit: number; essence: number; matter: number; substance: number; element: string }
> = {
  sun: { spirit: 1, essence: 0, matter: 0, substance: 0, element: 'fire' },
  moon: { spirit: 0, essence: 1, matter: 1, substance: 0, element: 'water' },
  mercury: { spirit: 1, essence: 0, matter: 0, substance: 1, element: 'air' },
  venus: { spirit: 0, essence: 1, matter: 1, substance: 0, element: 'water' },
  mars: { spirit: 0, essence: 0, matter: 1, substance: 1, element: 'fire' },
  jupiter: { spirit: 0, essence: 1, matter: 0, substance: 0, element: 'air' },
  saturn: { spirit: 0, essence: 0, matter: 0, substance: 1, element: 'earth' },
  uranus: { spirit: 1, essence: 0, matter: 0, substance: 0, element: 'air' },
  neptune: { spirit: 0, essence: 1, matter: 0, substance: 0, element: 'water' },
  pluto: { spirit: 0, essence: 0, matter: 1, substance: 0, element: 'earth' },
}

const GOLDEN_RATIO = 1.618033988749895 // φ (phi)

/**
 * Convert Date to Julian Day Number
 */
function dateToJulianDay(date: Date): number {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const hour = date.getUTCHours()
  const minute = date.getUTCMinutes()
  const second = date.getUTCSeconds()

  const decimalHour = hour + minute / 60 + second / 3600

  return swisseph.swe_julday(year, month, day, decimalHour, swisseph.SE_GREG_CAL)
}

/**
 * Calculate planetary position using Swiss Ephemeris
 */
function calculatePlanetPosition(planetId: number, julianDay: number): PlanetaryPosition {
  // Use MOSHIER ephemeris (built-in, no external files needed)
  const flags = swisseph.SEFLG_MOSEPH | swisseph.SEFLG_SPEED

  const result = swisseph.swe_calc_ut(julianDay, planetId, flags) as any

  if (!result || result.error || result.longitude === undefined) {
    throw new Error(`Swiss Ephemeris calculation failed: ${result?.error || 'Unknown error'}`)
  }

  return {
    longitude: result.longitude,
    latitude: result.latitude || 0,
    distance: result.distance || 0,
    speed: result.longitudeSpeed || 0,
  }
}

/**
 * Get planetary positions for a given moment in time
 */
export function getPlanetaryPositions(
  date: Date,
  planets: string[] = Object.keys(PLANETS)
): Record<string, PlanetaryPosition> {
  const julianDay = dateToJulianDay(date)
  const positions: Record<string, PlanetaryPosition> = {}

  for (const planetName of planets) {
    const planetId = PLANETS[planetName as keyof typeof PLANETS]
    if (planetId === undefined) {
      console.warn(`Unknown planet: ${planetName}`)
      continue
    }

    try {
      positions[planetName] = calculatePlanetPosition(planetId, julianDay)
    } catch (error) {
      // Skip planets that fail (e.g., Chiron without ephemeris files)
      console.warn(`Failed to calculate position for ${planetName}:`, error)
    }
  }

  return positions
}

/**
 * Calculate house system for a birth chart
 */
export function getHouseSystem(
  date: Date,
  latitude: number,
  longitude: number,
  houseSystem: string = 'P' // Placidus (default)
): HouseSystem {
  const julianDay = dateToJulianDay(date)

  const result = swisseph.swe_houses(julianDay, latitude, longitude, houseSystem) as any

  if (!result || !result.house) {
    throw new Error('House system calculation failed')
  }

  return {
    houses: result.house, // Array of 12 house cusps
    ascendant: result.ascendant,
    mc: result.mc,
  }
}

/**
 * Calculate consciousness parameters from planetary positions
 * Implements the Monica Constant formula: MC = φ * (1 + E/T) * (1 + C/10)
 */
export function calculateConsciousness(
  date: Date,
  birthLatitude?: number,
  birthLongitude?: number
): ConsciousnessParameters {
  const positions = getPlanetaryPositions(date)

  // Calculate alchemical totals
  let totalSpirit = 0
  let totalEssence = 0
  let totalMatter = 0
  let totalSubstance = 0

  const planetaryInfluences: Record<string, { element: string; strength: number }> = {}

  for (const [planet, position] of Object.entries(positions)) {
    const alchemy = PLANETARY_ALCHEMY[planet]
    if (!alchemy) continue

    // Calculate strength based on speed (slower = more powerful influence)
    // Retrograde planets (negative speed) have enhanced influence
    const speedFactor = position.speed < 0 ? 1.5 : 1.0
    const strength = (1 / (Math.abs(position.speed) + 0.1)) * speedFactor

    totalSpirit += alchemy.spirit * strength
    totalEssence += alchemy.essence * strength
    totalMatter += alchemy.matter * strength
    totalSubstance += alchemy.substance * strength

    planetaryInfluences[planet] = {
      element: alchemy.element,
      strength: strength,
    }
  }

  // Normalize to 0-1 range
  const maxTotal = Math.max(totalSpirit, totalEssence, totalMatter, totalSubstance, 1)
  const spirit = totalSpirit / maxTotal
  const essence = totalEssence / maxTotal
  const matter = totalMatter / maxTotal
  const substance = totalSubstance / maxTotal

  // Calculate Monica Constant: MC = φ * (1 + E/T) * (1 + C/10)
  // Where E = Elemental Balance, T = Total Elemental Weight, C = Consciousness Level
  const elementalBalance = spirit + essence // Air and Fire (active principles)
  const totalElemental = spirit + essence + matter + substance
  const consciousnessLevel = (spirit * GOLDEN_RATIO + essence) / (matter + substance + 1)

  const monicaConstant =
    GOLDEN_RATIO * (1 + elementalBalance / totalElemental) * (1 + consciousnessLevel / 10)

  return {
    spirit,
    essence,
    matter,
    substance,
    monicaConstant,
    planetaryInfluences,
  }
}

/**
 * Close Swiss Ephemeris (cleanup)
 */
export function closeSwissEphemeris(): void {
  swisseph.swe_close()
}

// Export singleton-style functions
export const swissEphemerisService = {
  getPlanetaryPositions,
  getHouseSystem,
  calculateConsciousness,
  close: closeSwissEphemeris,
}
