// Astrological Pattern Recognition System
// Detects Grand Trines, T-Squares, Yods, Stelliums, and other significant patterns

import { planetaryMotionTracker } from './planetary-motion-tracker'

export interface PlanetPosition {
  planet: string
  sign: string
  degree: number
  house: number
  date?: Date // Add optional date for motion calculations
}

export interface Aspect {
  planet1: string
  planet2: string
  type: AspectType
  angle: number
  orb: number
  applying: boolean
  separating: boolean
  orbVelocity?: number // degrees per day the orb is changing
  peakDate?: Date | null // when aspect will be exact (if applying)
  daysToExact?: number // days until exact (if applying)
  daysSinceExact?: number // days since exact (if separating)
  strength: 'exact' | 'tight' | 'moderate' | 'wide'
}

export type AspectType =
  | 'conjunction'
  | 'opposition'
  | 'trine'
  | 'square'
  | 'sextile'
  | 'quincunx'
  | 'semisextile'
  | 'sesquiquadrate'
  | 'semisquare'
  | 'quintile'
  | 'biquintile'

export interface PatternConfiguration {
  type: PatternType
  planets: string[]
  aspects: Aspect[]
  strength: number // 0-100
  interpretation: string
  element?: string
  modality?: string
}

export type PatternType =
  | 'grand-trine'
  | 't-square'
  | 'grand-cross'
  | 'yod'
  | 'stellium'
  | 'mystic-rectangle'
  | 'kite'
  | 'grand-sextile'
  | 'cradle'

// Aspect definitions with orbs
const ASPECT_DEFINITIONS: Record<AspectType, { angle: number; orb: number; majorAspect: boolean }> =
  {
    conjunction: { angle: 0, orb: 10, majorAspect: true },
    opposition: { angle: 180, orb: 10, majorAspect: true },
    trine: { angle: 120, orb: 8, majorAspect: true },
    square: { angle: 90, orb: 8, majorAspect: true },
    sextile: { angle: 60, orb: 6, majorAspect: true },
    quincunx: { angle: 150, orb: 3, majorAspect: false },
    semisextile: { angle: 30, orb: 2, majorAspect: false },
    sesquiquadrate: { angle: 135, orb: 2, majorAspect: false },
    semisquare: { angle: 45, orb: 2, majorAspect: false },
    quintile: { angle: 72, orb: 2, majorAspect: false },
    biquintile: { angle: 144, orb: 2, majorAspect: false },
  }

// Sign elements for pattern analysis
const SIGN_ELEMENTS: Record<string, string> = {
  Aries: 'Fire',
  Taurus: 'Earth',
  Gemini: 'Air',
  Cancer: 'Water',
  Leo: 'Fire',
  Virgo: 'Earth',
  Libra: 'Air',
  Scorpio: 'Water',
  Sagittarius: 'Fire',
  Capricorn: 'Earth',
  Aquarius: 'Air',
  Pisces: 'Water',
}

// Sign modalities for pattern analysis
const SIGN_MODALITIES: Record<string, string> = {
  Aries: 'Cardinal',
  Taurus: 'Fixed',
  Gemini: 'Mutable',
  Cancer: 'Cardinal',
  Leo: 'Fixed',
  Virgo: 'Mutable',
  Libra: 'Cardinal',
  Scorpio: 'Fixed',
  Sagittarius: 'Mutable',
  Capricorn: 'Cardinal',
  Aquarius: 'Fixed',
  Pisces: 'Mutable',
}

// Calculate the absolute degree position (0-360)
function getAbsoluteDegree(sign: string, degree: number): number {
  const signOrder = [
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
  const signIndex = signOrder.indexOf(sign)
  if (signIndex === -1) return 0
  return signIndex * 30 + degree
}

// Calculate the angular distance between two positions
function calculateAngle(degree1: number, degree2: number): number {
  let angle = Math.abs(degree1 - degree2)
  if (angle > 180) {
    angle = 360 - angle
  }
  return angle
}

// Determine if two planets are in aspect with dynamic applying/separating analysis
async function calculateAspect(
  planet1: PlanetPosition,
  planet2: PlanetPosition
): Promise<Aspect | null> {
  const degree1 = getAbsoluteDegree(planet1.sign, planet1.degree)
  const degree2 = getAbsoluteDegree(planet2.sign, planet2.degree)
  const angle = calculateAngle(degree1, degree2)
  const aspectDate = planet1.date || planet2.date || new Date()

  // Check each aspect type
  for (const [aspectType, definition] of Object.entries(ASPECT_DEFINITIONS)) {
    const orb = Math.abs(angle - definition.angle)
    if (orb <= definition.orb) {
      // Calculate velocity-based applying/separating using motion tracker
      let applying = false
      let separating = false
      let orbVelocity: number | undefined
      let peakDate: Date | null | undefined
      let daysToExact: number | undefined
      let daysSinceExact: number | undefined

      try {
        // Get separation velocity (negative = applying, positive = separating)
        orbVelocity = await planetaryMotionTracker.calculateSeparationVelocity(
          planet1.planet,
          degree1,
          planet2.planet,
          degree2,
          definition.angle,
          aspectDate
        )

        applying = orbVelocity < -0.01 // Orb tightening
        separating = orbVelocity > 0.01 // Orb widening

        if (applying) {
          // Predict when aspect will be exact
          const exactTiming = await planetaryMotionTracker.predictExactAspectTiming(
            planet1.planet,
            degree1,
            planet2.planet,
            degree2,
            definition.angle,
            90, // max 90 days ahead
            aspectDate
          )

          if (exactTiming) {
            peakDate = exactTiming.date
            daysToExact = Math.round(
              (exactTiming.date.getTime() - aspectDate.getTime()) / (1000 * 60 * 60 * 24)
            )
          }
        } else if (separating) {
          // Estimate days since exact (approximate)
          daysSinceExact = Math.round(Math.abs(orb / orbVelocity))
        }
      } catch (error) {
        console.warn(
          `Could not calculate dynamic aspect data for ${planet1.planet}-${planet2.planet}:`,
          error
        )
        // Fallback to simple position comparison for backward compatibility
        applying = degree1 < degree2
        separating = !applying
      }

      // Determine strength based on orb
      let strength: Aspect['strength'] = 'wide'
      if (orb <= 1) strength = 'exact'
      else if (orb <= definition.orb * 0.5) strength = 'tight'
      else if (orb <= definition.orb * 0.75) strength = 'moderate'

      return {
        planet1: planet1.planet,
        planet2: planet2.planet,
        type: aspectType as AspectType,
        angle: definition.angle,
        orb,
        applying,
        separating,
        orbVelocity,
        peakDate,
        daysToExact,
        daysSinceExact,
        strength,
      }
    }
  }

  return null
}

// Calculate all aspects in a chart with dynamic analysis
export async function calculateAllAspects(planets: PlanetPosition[]): Promise<Aspect[]> {
  const aspects: Aspect[] = []

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const aspect = await calculateAspect(planets[i], planets[j])
      if (aspect) {
        aspects.push(aspect)
      }
    }
  }

  return aspects
}

// Backward compatibility function for static aspect calculation
export function calculateAllAspectsStatic(planets: PlanetPosition[]): Aspect[] {
  const aspects: Aspect[] = []

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const degree1 = getAbsoluteDegree(planets[i].sign, planets[i].degree)
      const degree2 = getAbsoluteDegree(planets[j].sign, planets[j].degree)
      const angle = calculateAngle(degree1, degree2)

      // Check each aspect type (static calculation)
      for (const [aspectType, definition] of Object.entries(ASPECT_DEFINITIONS)) {
        const orb = Math.abs(angle - definition.angle)
        if (orb <= definition.orb) {
          // Simple applying/separating (for backward compatibility)
          const applying = degree1 < degree2

          // Determine strength based on orb
          let strength: Aspect['strength'] = 'wide'
          if (orb <= 1) strength = 'exact'
          else if (orb <= definition.orb * 0.5) strength = 'tight'
          else if (orb <= definition.orb * 0.75) strength = 'moderate'

          aspects.push({
            planet1: planets[i].planet,
            planet2: planets[j].planet,
            type: aspectType as AspectType,
            angle: definition.angle,
            orb,
            applying,
            separating: !applying,
            strength,
          })
          break // Only find the first matching aspect
        }
      }
    }
  }

  return aspects
}

// Detect Grand Trine pattern (3 planets in trine to each other)
function detectGrandTrine(planets: PlanetPosition[], aspects: Aspect[]): PatternConfiguration[] {
  const patterns: PatternConfiguration[] = []
  const trines = aspects.filter(a => a.type === 'trine')

  // Look for three planets that all trine each other
  for (let i = 0; i < trines.length; i++) {
    for (let j = i + 1; j < trines.length; j++) {
      const trine1 = trines[i]
      const trine2 = trines[j]

      // Check if they share a planet
      const sharedPlanet = [trine1.planet1, trine1.planet2].find(p =>
        [trine2.planet1, trine2.planet2].includes(p)
      )

      if (sharedPlanet) {
        const otherPlanets = [
          trine1.planet1,
          trine1.planet2,
          trine2.planet1,
          trine2.planet2,
        ].filter(p => p !== sharedPlanet)

        // Check if the other two planets also trine each other
        const thirdTrine = trines.find(
          t =>
            (t.planet1 === otherPlanets[0] && t.planet2 === otherPlanets[1]) ||
            (t.planet1 === otherPlanets[1] && t.planet2 === otherPlanets[0])
        )

        if (thirdTrine) {
          const trianglePlanets = [sharedPlanet, ...otherPlanets]

          // Determine the element of the grand trine
          const elements = trianglePlanets.map(p => {
            const planet = planets.find(pl => pl.planet === p)
            return planet ? SIGN_ELEMENTS[planet.sign] : ''
          })
          const dominantElement = elements[0] // They should all be the same element

          // Calculate pattern strength
          const avgOrb = (trine1.orb + trine2.orb + thirdTrine.orb) / 3
          const strength = Math.max(0, 100 - avgOrb * 10)

          patterns.push({
            type: 'grand-trine',
            planets: trianglePlanets,
            aspects: [trine1, trine2, thirdTrine],
            strength,
            element: dominantElement,
            interpretation: `Grand Trine in ${dominantElement}: Exceptional talent and ease in ${dominantElement.toLowerCase()} element matters. Natural flow of energy between ${trianglePlanets.join(', ')}.`,
          })
        }
      }
    }
  }

  return patterns
}

// Detect T-Square pattern (opposition with both planets square to a third)
function detectTSquare(planets: PlanetPosition[], aspects: Aspect[]): PatternConfiguration[] {
  const patterns: PatternConfiguration[] = []
  const oppositions = aspects.filter(a => a.type === 'opposition')
  const squares = aspects.filter(a => a.type === 'square')

  for (const opposition of oppositions) {
    // Find squares from both ends of the opposition
    const squares1 = squares.filter(
      s => s.planet1 === opposition.planet1 || s.planet2 === opposition.planet1
    )
    const squares2 = squares.filter(
      s => s.planet1 === opposition.planet2 || s.planet2 === opposition.planet2
    )

    // Find the apex planet (squared by both opposition planets)
    for (const sq1 of squares1) {
      const apexFromSq1 = sq1.planet1 === opposition.planet1 ? sq1.planet2 : sq1.planet1

      const sq2 = squares2.find(s => s.planet1 === apexFromSq1 || s.planet2 === apexFromSq1)

      if (sq2) {
        const tSquarePlanets = [opposition.planet1, opposition.planet2, apexFromSq1]

        // Calculate pattern strength
        const avgOrb = (opposition.orb + sq1.orb + sq2.orb) / 3
        const strength = Math.max(0, 100 - avgOrb * 10)

        // Determine modality
        const modalities = tSquarePlanets.map(p => {
          const planet = planets.find(pl => pl.planet === p)
          return planet ? SIGN_MODALITIES[planet.sign] : ''
        })
        const dominantModality = modalities[0]

        patterns.push({
          type: 't-square',
          planets: tSquarePlanets,
          aspects: [opposition, sq1, sq2],
          strength,
          modality: dominantModality,
          interpretation: `T-Square with ${apexFromSq1} as apex: Dynamic tension creating drive for achievement. Challenge between ${opposition.planet1} and ${opposition.planet2} focused through ${apexFromSq1}.`,
        })
      }
    }
  }

  return patterns
}

// Export aliases for plural naming convention
export const detectGrandTrines = detectGrandTrine
export const detectTSquares = detectTSquare

// Detect Yod pattern (two quincunxes with a sextile base)
function detectYod(planets: PlanetPosition[], aspects: Aspect[]): PatternConfiguration[] {
  const patterns: PatternConfiguration[] = []
  const quincunxes = aspects.filter(a => a.type === 'quincunx')
  const sextiles = aspects.filter(a => a.type === 'sextile')

  for (const sextile of sextiles) {
    // Find quincunxes from both ends of the sextile
    const quinc1 = quincunxes.find(
      q => q.planet1 === sextile.planet1 || q.planet2 === sextile.planet1
    )
    const quinc2 = quincunxes.find(
      q => q.planet1 === sextile.planet2 || q.planet2 === sextile.planet2
    )

    if (quinc1 && quinc2) {
      // Find the apex planet
      const apex1 = quinc1.planet1 === sextile.planet1 ? quinc1.planet2 : quinc1.planet1
      const apex2 = quinc2.planet1 === sextile.planet2 ? quinc2.planet2 : quinc2.planet1

      if (apex1 === apex2) {
        const yodPlanets = [sextile.planet1, sextile.planet2, apex1]

        // Calculate pattern strength
        const avgOrb = (sextile.orb + quinc1.orb + quinc2.orb) / 3
        const strength = Math.max(0, 100 - avgOrb * 15) // Tighter orbs for Yod

        patterns.push({
          type: 'yod',
          planets: yodPlanets,
          aspects: [sextile, quinc1, quinc2],
          strength,
          interpretation: `Yod (Finger of God) pointing to ${apex1}: Fated quality requiring adjustment. ${sextile.planet1} and ${sextile.planet2} create a mission focused through ${apex1}.`,
        })
      }
    }
  }

  return patterns
}

// Detect Stellium (3+ planets in conjunction or same sign)
function detectStellium(planets: PlanetPosition[], aspects: Aspect[]): PatternConfiguration[] {
  const patterns: PatternConfiguration[] = []
  const conjunctions = aspects.filter(a => a.type === 'conjunction')

  // Group planets by sign
  const planetsBySign: Record<string, PlanetPosition[]> = {}
  for (const planet of planets) {
    if (!planetsBySign[planet.sign]) {
      planetsBySign[planet.sign] = []
    }
    planetsBySign[planet.sign].push(planet)
  }

  // Check for stelliums by sign
  for (const [sign, signPlanets] of Object.entries(planetsBySign)) {
    if (signPlanets.length >= 3) {
      // Verify they're in conjunction
      const stelliumPlanets = signPlanets.map(p => p.planet)
      const stelliumConjunctions = conjunctions.filter(
        c => stelliumPlanets.includes(c.planet1) && stelliumPlanets.includes(c.planet2)
      )

      if (stelliumConjunctions.length >= 2) {
        const avgOrb =
          stelliumConjunctions.reduce((sum, c) => sum + c.orb, 0) / stelliumConjunctions.length
        const strength = Math.max(0, 100 - avgOrb * 8)

        patterns.push({
          type: 'stellium',
          planets: stelliumPlanets,
          aspects: stelliumConjunctions,
          strength,
          element: SIGN_ELEMENTS[sign],
          modality: SIGN_MODALITIES[sign],
          interpretation: `Stellium in ${sign}: Concentrated energy and focus in ${sign} themes. Powerful emphasis on ${SIGN_ELEMENTS[sign].toLowerCase()} element and ${SIGN_MODALITIES[sign].toLowerCase()} modality.`,
        })
      }
    }
  }

  // Also check for stelliums by house
  const planetsByHouse: Record<number, PlanetPosition[]> = {}
  for (const planet of planets) {
    if (!planetsByHouse[planet.house]) {
      planetsByHouse[planet.house] = []
    }
    planetsByHouse[planet.house].push(planet)
  }

  for (const [house, housePlanets] of Object.entries(planetsByHouse)) {
    if (housePlanets.length >= 3) {
      const stelliumPlanets = housePlanets.map(p => p.planet)
      const stelliumConjunctions = conjunctions.filter(
        c => stelliumPlanets.includes(c.planet1) && stelliumPlanets.includes(c.planet2)
      )

      if (stelliumConjunctions.length >= 1) {
        const strength = 80 // House stelliums are significant even without tight conjunctions

        patterns.push({
          type: 'stellium',
          planets: stelliumPlanets,
          aspects: stelliumConjunctions,
          strength,
          interpretation: `Stellium in House ${house}: Major life focus on house ${house} matters. Concentration of planetary energies in this life area.`,
        })
      }
    }
  }

  return patterns
}

// Detect Grand Cross (two oppositions forming a cross with squares)
function detectGrandCross(planets: PlanetPosition[], aspects: Aspect[]): PatternConfiguration[] {
  const patterns: PatternConfiguration[] = []
  const oppositions = aspects.filter(a => a.type === 'opposition')
  const squares = aspects.filter(a => a.type === 'square')

  // Need at least 2 oppositions for a grand cross
  for (let i = 0; i < oppositions.length; i++) {
    for (let j = i + 1; j < oppositions.length; j++) {
      const opp1 = oppositions[i]
      const opp2 = oppositions[j]

      // Check if the four planets form a cross
      const crossPlanets = [opp1.planet1, opp1.planet2, opp2.planet1, opp2.planet2]
      const uniquePlanets = Array.from(new Set(crossPlanets))

      if (uniquePlanets.length === 4) {
        // Verify all necessary squares exist
        const requiredSquares = [
          [opp1.planet1, opp2.planet1],
          [opp1.planet1, opp2.planet2],
          [opp1.planet2, opp2.planet1],
          [opp1.planet2, opp2.planet2],
        ]

        const foundSquares = requiredSquares.filter(([p1, p2]) =>
          squares.some(
            s => (s.planet1 === p1 && s.planet2 === p2) || (s.planet1 === p2 && s.planet2 === p1)
          )
        )

        if (foundSquares.length >= 4) {
          const crossAspects = [
            opp1,
            opp2,
            ...squares.filter(
              s => uniquePlanets.includes(s.planet1) && uniquePlanets.includes(s.planet2)
            ),
          ]

          const avgOrb = crossAspects.reduce((sum, a) => sum + a.orb, 0) / crossAspects.length
          const strength = Math.max(0, 100 - avgOrb * 10)

          patterns.push({
            type: 'grand-cross',
            planets: uniquePlanets,
            aspects: crossAspects,
            strength,
            interpretation: `Grand Cross: Maximum tension and drive. Challenges from all directions creating exceptional strength and determination. Dynamic balance required between ${uniquePlanets.join(', ')}.`,
          })
        }
      }
    }
  }

  return patterns
}

// Main pattern detection function with dynamic aspects
export async function detectPatterns(planets: PlanetPosition[]): Promise<{
  aspects: Aspect[]
  patterns: PatternConfiguration[]
}> {
  // Calculate all aspects with dynamic analysis
  const aspects = await calculateAllAspects(planets)

  // Detect various patterns
  const patterns: PatternConfiguration[] = [
    ...detectGrandTrine(planets, aspects),
    ...detectTSquare(planets, aspects),
    ...detectYod(planets, aspects),
    ...detectStellium(planets, aspects),
    ...detectGrandCross(planets, aspects),
  ]

  // Sort patterns by strength
  patterns.sort((a, b) => b.strength - a.strength)

  return {
    aspects,
    patterns,
  }
}

// Backward compatibility function for static pattern detection
export function detectPatternsStatic(planets: PlanetPosition[]): {
  aspects: Aspect[]
  patterns: PatternConfiguration[]
} {
  // Calculate all aspects (static)
  const aspects = calculateAllAspectsStatic(planets)

  // Detect various patterns
  const patterns: PatternConfiguration[] = [
    ...detectGrandTrine(planets, aspects),
    ...detectTSquare(planets, aspects),
    ...detectYod(planets, aspects),
    ...detectStellium(planets, aspects),
    ...detectGrandCross(planets, aspects),
  ]

  // Sort patterns by strength
  patterns.sort((a, b) => b.strength - a.strength)

  return {
    aspects,
    patterns,
  }
}

// Get aspect symbol
export function getAspectSymbol(type: AspectType): string {
  const symbols: Record<AspectType, string> = {
    conjunction: '☌',
    opposition: '☍',
    trine: '△',
    square: '□',
    sextile: '⚹',
    quincunx: '⚻',
    semisextile: '⚺',
    sesquiquadrate: '⚼',
    semisquare: '∠',
    quintile: 'Q',
    biquintile: 'bQ',
  }
  return symbols[type] || '?'
}

// Get aspect color for visualization
export function getAspectColor(type: AspectType): string {
  const colors: Record<AspectType, string> = {
    conjunction: '#8B4513', // brown
    opposition: '#FF0000', // red
    trine: '#0000FF', // blue
    square: '#FF0000', // red
    sextile: '#00FF00', // green
    quincunx: '#800080', // purple
    semisextile: '#90EE90', // light green
    sesquiquadrate: '#FFA500', // orange
    semisquare: '#FFD700', // gold
    quintile: '#4B0082', // indigo
    biquintile: '#9400D3', // violet
  }
  return colors[type] || '#808080'
}
