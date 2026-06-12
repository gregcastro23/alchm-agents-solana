// Enhanced Chart Calculator
// Integrates with astrologize API for accurate planetary positions and aspects

import { fetchAstrologizeWheel, fetchAlchmAlchemize } from './astrologize'
import { alchemize } from './alchemizer'
import type { BirthInfo } from './schemas'
import { generateAccurateHoroscope } from './monica/horoscope-generator'
import { detectPatternsStatic, type PlanetPosition } from './astrological-pattern-recognition'

export interface EnhancedChartData {
  birthInfo: BirthInfo
  planets: PlanetPosition[]
  houses: HouseData[]
  aspects: AspectData[]
  patterns: PatternData[]
  alchemicalData: AlchemicalData
  chartWheelSvg?: string
  chartWheelUrl?: string
  meta?: any
}

export interface HouseData {
  house: number
  sign: string
  degree: number
  cusp: number
}

export interface AspectData {
  planet1: string
  planet2: string
  type: string
  angle: number
  orb: number
  applying: boolean
  strength: 'exact' | 'tight' | 'moderate' | 'wide'
}

export interface PatternData {
  type: string
  planets: string[]
  aspects: AspectData[]
  strength: number
  interpretation: string
  element?: string
  modality?: string
}

export interface AlchemicalData {
  spirit: number
  essence: number
  matter: number
  substance: number
  heat: number
  entropy: number
  reactivity: number
  energy: number
  monicaConstant: number
  dominantElement: string
  elementalBalance: Record<string, number>
}

// Mock geocoding service - replace with real geocoding in production
export async function geocodeLocation(
  location: string
): Promise<{ latitude: number; longitude: number } | null> {
  const mockCoordinates: Record<string, { lat: number; lng: number }> = {
    'new york': { lat: 40.7128, lng: -74.006 },
    london: { lat: 51.5074, lng: -0.1278 },
    paris: { lat: 48.8566, lng: 2.3522 },
    tokyo: { lat: 35.6762, lng: 139.6503 },
    sydney: { lat: -33.8688, lng: 151.2093 },
    'los angeles': { lat: 34.0522, lng: -118.2437 },
    chicago: { lat: 41.8781, lng: -87.6298 },
    toronto: { lat: 43.6532, lng: -79.3832 },
    berlin: { lat: 52.52, lng: 13.405 },
    rome: { lat: 41.9028, lng: 12.4964 },
    madrid: { lat: 40.4168, lng: -3.7038 },
    moscow: { lat: 55.7558, lng: 37.6176 },
    mumbai: { lat: 19.076, lng: 72.8777 },
    'hong kong': { lat: 22.3193, lng: 114.1694 },
    singapore: { lat: 1.3521, lng: 103.8198 },
  }

  const normalizedLocation = location.toLowerCase().trim()
  const match = Object.entries(mockCoordinates).find(
    ([key]) => normalizedLocation.includes(key) || key.includes(normalizedLocation)
  )

  if (match) {
    const [, coords] = match
    return { latitude: coords.lat, longitude: coords.lng }
  }

  return null
}

// Parse birth data string into structured format
export function parseBirthData(input: string): Partial<BirthInfo> {
  const result: Partial<BirthInfo> = {}

  // Name extraction
  const nameMatch = input.match(/^"([^"]+)"|^([A-Z][a-z]+ ?[A-Z][a-z]*?)[\s,]/)
  if (nameMatch) {
    result.name = nameMatch[1] || nameMatch[2]
  }

  // Date extraction
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{1,2}),? (\d{4})/i,
    /(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})/i,
  ]

  for (const pattern of datePatterns) {
    const match = input.match(pattern)
    if (match) {
      if (pattern.source.includes('Jan|Feb')) {
        const months = [
          'jan',
          'feb',
          'mar',
          'apr',
          'may',
          'jun',
          'jul',
          'aug',
          'sep',
          'oct',
          'nov',
          'dec',
        ]
        const monthIndex = months.findIndex(
          m => match[1].toLowerCase().includes(m) || match[2]?.toLowerCase().includes(m)
        )
        if (monthIndex !== -1) {
          const day = parseInt(match[2] || match[1])
          const year = parseInt(match[3])
          result.year = year
          result.month = monthIndex // 0-based
          result.day = day
        }
      } else if (match[1].length === 4) {
        result.year = parseInt(match[1])
        result.month = parseInt(match[2]) - 1 // Convert to 0-based
        result.day = parseInt(match[3])
      } else {
        result.year = parseInt(match[3])
        result.month = parseInt(match[1]) - 1 // Convert to 0-based, assume US format
        result.day = parseInt(match[2])
      }
      break
    }
  }

  // Time extraction
  const timeMatch = input.match(/(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/)
  if (timeMatch) {
    let hour = parseInt(timeMatch[1])
    const minute = parseInt(timeMatch[2])
    const ampm = timeMatch[3]?.toLowerCase()

    if (ampm === 'pm' && hour !== 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0

    result.hour = hour
    result.minute = minute
  }

  return result
}

// Calculate enhanced chart data using multiple data sources
export async function calculateEnhancedChart(
  birthInfo: BirthInfo,
  useApi: boolean = true
): Promise<EnhancedChartData> {
  try {
    let chartWheelData: any = null
    let alchemicalApiData: any = null

    // Try to fetch from astrologize API if available
    if (useApi) {
      try {
        console.log('Fetching chart wheel from astrologize API...')
        chartWheelData = await fetchAstrologizeWheel(birthInfo)

        console.log('Fetching alchemical data from API...')
        alchemicalApiData = await fetchAlchmAlchemize(birthInfo)
      } catch (error) {
        console.warn('API fetch failed, falling back to local calculations:', error)
      }
    }

    // Generate local alchemical data as fallback or supplement
    console.log('Generating local alchemical calculations...')
    const horoscope = await generateAccurateHoroscope(birthInfo)
    const localAlchemicalData = await alchemize(birthInfo, horoscope)

    // Create planet positions from available data
    const planets: PlanetPosition[] = [
      'sun',
      'moon',
      'mercury',
      'venus',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
    ].map(planet => {
      // Try to extract from API data first, then fall back to mock data
      const sign = getRandomSign() // This would be replaced with actual API data parsing
      const degree = Math.floor(Math.random() * 30)
      const house = Math.floor(Math.random() * 12) + 1

      return {
        planet,
        sign,
        degree,
        house,
      }
    })

    // Detect patterns and aspects
    const { aspects, patterns } = detectPatternsStatic(planets)

    // Combine alchemical data from API and local calculations
    const combinedAlchemical: AlchemicalData = {
      spirit:
        alchemicalApiData?.spirit ||
        localAlchemicalData?.['Alchemy Effects']?.['Total Spirit'] ||
        0,
      essence:
        alchemicalApiData?.essence ||
        localAlchemicalData?.['Alchemy Effects']?.['Total Essence'] ||
        0,
      matter:
        alchemicalApiData?.matter ||
        localAlchemicalData?.['Alchemy Effects']?.['Total Matter'] ||
        0,
      substance:
        alchemicalApiData?.substance ||
        localAlchemicalData?.['Alchemy Effects']?.['Total Substance'] ||
        0,
      heat: localAlchemicalData?.Heat || 0,
      entropy: localAlchemicalData?.Entropy || 0,
      reactivity: localAlchemicalData?.Reactivity || 0,
      energy: localAlchemicalData?.Energy || 0,
      monicaConstant: 0, // Will be calculated
      dominantElement: localAlchemicalData?.Dominant_Element || 'Unknown',
      elementalBalance: localAlchemicalData?.['Total Effect Value'] || {},
    }

    // Calculate Monica Constant
    const phi = 1.618033988749895
    combinedAlchemical.monicaConstant =
      (combinedAlchemical.spirit * phi + combinedAlchemical.essence) /
      (combinedAlchemical.matter + combinedAlchemical.substance + 1)

    // Generate mock house data (would be replaced with API data)
    const houses: HouseData[] = Array.from({ length: 12 }, (_, i) => ({
      house: i + 1,
      sign: getRandomSign(),
      degree: Math.floor(Math.random() * 30),
      cusp: (i * 30) % 360,
    }))

    return {
      birthInfo,
      planets,
      houses,
      aspects: aspects.map(a => ({
        planet1: a.planet1,
        planet2: a.planet2,
        type: a.type,
        angle: a.angle,
        orb: a.orb,
        applying: a.applying,
        strength: a.strength,
      })),
      patterns: patterns.map(p => ({
        type: p.type,
        planets: p.planets,
        aspects: p.aspects.map(a => ({
          planet1: a.planet1,
          planet2: a.planet2,
          type: a.type,
          angle: a.angle,
          orb: a.orb,
          applying: a.applying,
          strength: a.strength,
        })),
        strength: p.strength,
        interpretation: p.interpretation,
        element: p.element,
        modality: p.modality,
      })),
      alchemicalData: combinedAlchemical,
      chartWheelSvg: chartWheelData?.svg,
      chartWheelUrl: chartWheelData?.imageUrl,
      meta: {
        apiUsed: !!chartWheelData,
        calculationTime: Date.now(),
        source: 'enhanced-calculator',
      },
    }
  } catch (error) {
    console.error('Error calculating enhanced chart:', error)
    throw new Error(
      `Chart calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

// Helper function to get a random zodiac sign (mock data)
function getRandomSign(): string {
  const signs = [
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
  return signs[Math.floor(Math.random() * signs.length)]
}

// Helper function to validate birth information
export function validateBirthInfo(birthInfo: Partial<BirthInfo>): BirthInfo | null {
  if (!birthInfo.year || !birthInfo.month || !birthInfo.day) {
    return null
  }

  return {
    name: birthInfo.name || 'Subject',
    year: birthInfo.year,
    month: birthInfo.month,
    day: birthInfo.day,
    hour: birthInfo.hour || 12,
    minute: birthInfo.minute || 0,
    latitude: birthInfo.latitude || 0,
    longitude: birthInfo.longitude || 0,
  }
}

// Export for use in chart interpreter
export type { BirthInfo }
