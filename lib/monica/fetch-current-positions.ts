// Fetch current planetary positions using our working API endpoint
// Simplified implementation that uses the proven /api/philosophers-stone/positions endpoint

export interface AlchemizeApiResponse {
  'Planet Positions'?: {
    [planet: string]: {
      sign: string
      degree: number
    }
  }
  'Alchemy Effects'?: {
    'Total Spirit': number
    'Total Essence': number
    'Total Matter': number
    'Total Substance': number
  }
  'Major Arcana'?: string[]
  'Minor Arcana'?: string[]
  'Decan Effects'?: {
    [planet: string]: string
  }
}

// Cache for preventing concurrent requests
let currentRequest: Promise<AlchemizeApiResponse | null> | null = null
let lastRequestTime = 0
const REQUEST_CACHE_DURATION = 30000 // 30 seconds

export async function fetchCurrentPlanetaryPositions(
  signal?: AbortSignal
): Promise<AlchemizeApiResponse | null> {
  // Check if already aborted before starting
  if (signal?.aborted) {
    throw new Error('Request aborted')
  }

  // Return cached request if one is in progress or recently completed
  const now = Date.now()
  if (currentRequest && now - lastRequestTime < REQUEST_CACHE_DURATION) {
    console.log('Using cached/in-progress request for planetary positions')
    try {
      return await currentRequest
    } catch (error) {
      // If cached request failed with AbortError, re-throw it
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'))
      ) {
        throw error
      }
      // For other errors, continue to create new request
      console.log('Cached request failed, creating new request:', error)
    }
  }

  // Create new request
  currentRequest = performFetch(signal)
  lastRequestTime = now

  try {
    const result = await currentRequest
    return result
  } catch (error) {
    // Handle AbortError specifically - don't clear cache, just re-throw
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('aborted'))
    ) {
      throw error
    }
    // For other errors, log and re-throw
    console.error('Request failed:', error)
    throw error
  } finally {
    // Clear the request after completion (but not for aborted requests)
    if (!signal?.aborted) {
      setTimeout(() => {
        if (Date.now() - lastRequestTime >= REQUEST_CACHE_DURATION) {
          currentRequest = null
        }
      }, REQUEST_CACHE_DURATION)
    }
  }
}

async function performFetch(signal?: AbortSignal): Promise<AlchemizeApiResponse | null> {
  try {
    // Check if already aborted before making the request
    if (signal?.aborted) {
      throw new Error('Request aborted')
    }

    // Use our proven working philosophers-stone/positions API
    console.log('Fetching current planetary positions from philosophers-stone API...')

    const response = await fetch('/api/philosophers-stone/positions', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    })

    if (!response.ok) {
      console.error('Philosophers Stone API error:', response.status, response.statusText)
      return await enhancedPositionsNow() // prefer enhanced fallback if API returns error
    }

    const data = await response.json()

    // Transform the response to match the expected AlchemizeApiResponse format
    const transformedData: AlchemizeApiResponse = {
      'Planet Positions': {},
      'Alchemy Effects': {
        'Total Spirit': data.alchmQuantities?.spirit || 0,
        'Total Essence': data.alchmQuantities?.essence || 0,
        'Total Matter': data.alchmQuantities?.matter || 0,
        'Total Substance': data.alchmQuantities?.substance || 0,
      },
      'Major Arcana': [],
      'Minor Arcana': [],
      'Decan Effects': {},
    }

    // Transform planetary positions array to the expected object format
    if (data.planetaryPositions && Array.isArray(data.planetaryPositions)) {
      data.planetaryPositions.forEach((planet: any) => {
        if (transformedData['Planet Positions']) {
          const rawDegree = typeof planet.degree === 'number' ? planet.degree : undefined
          const signDegree =
            typeof rawDegree === 'number'
              ? ((rawDegree % 30) + 30) % 30 // normalize within 0-30
              : undefined
          const sign = planet.sign
          transformedData['Planet Positions'][planet.planet] = {
            sign,
            degree: typeof signDegree === 'number' ? signDegree : (undefined as any),
          }
          // Attach dignity label for UI if needed
          try {
            const label = getEssentialDignityLabel(planet.planet, sign)
            ;(transformedData as any)['Dignities'] = (transformedData as any)['Dignities'] || {}
            ;(transformedData as any)['Dignities'][planet.planet] = label
          } catch {
            // Dignity labels are optional UI decoration — skip on lookup failure.
          }
        }
      })
    }

    // If API data is incomplete or missing degrees, compute enhanced fallback for correctness
    const planetCount = Object.keys(transformedData['Planet Positions'] || {}).length
    const needsEnhanced =
      planetCount < 7 ||
      Object.values(transformedData['Planet Positions'] || {}).some(
        (p: any) => typeof p.degree !== 'number'
      )

    if (needsEnhanced) {
      const enhanced = await enhancedPositionsNow()
      if (enhanced) {
        transformedData['Planet Positions'] = enhanced['Planet Positions']
        // Recompute dignities with enhanced positions as well
        try {
          const dignities: Record<string, string> = {}
          Object.entries(enhanced['Planet Positions'] || {}).forEach(([planet, pos]: any) => {
            if (pos?.sign) dignities[planet] = getEssentialDignityLabel(planet, pos.sign)
          })
          ;(transformedData as any)['Dignities'] = dignities
        } catch {
          // Dignity labels are optional UI decoration — skip on lookup failure.
        }
      }
    }

    console.log('Philosophers Stone API response transformed:', {
      hasPlanetPositions: !!transformedData['Planet Positions'],
      hasAlchemyEffects: !!transformedData['Alchemy Effects'],
      planetCount: Object.keys(transformedData['Planet Positions'] || {}).length,
      monicaConstant: data.monicaConstant,
    })

    return transformedData
  } catch (error: any) {
    // Silence expected aborts and component unmount cases and prefer enhanced fallback
    const errorName = error && typeof error === 'object' ? (error as any).name : ''
    const errorMessage = typeof error === 'string' ? error : String((error as any)?.message || '')
    if (
      /AbortError/i.test(errorName) ||
      /aborted|abort|component-unmount|unmount/i.test(errorMessage)
    ) {
      // Return enhanced fallback rather than logging a console error
      return await enhancedPositionsNow()
    }

    console.error('Error fetching planetary positions from philosophers-stone API:', error)
    // As a robust fallback, compute enhanced positions locally
    try {
      const enhanced = await enhancedPositionsNow()
      return enhanced
    } catch (e) {
      console.error('Enhanced fallback failed:', e)
      return null
    }
  }
}

// --- Enhanced local fallback using our professional calculator ---
import { calculateAllPlanets, type EnhancedBirthInfo } from '../enhanced-astronomical-calculator'
import { ESSENTIAL_DIGNITIES } from '../astrological-dignities-engine'

function getEssentialDignityLabel(
  planet: string,
  sign: string
): 'Domicile' | 'Exalted' | 'Detriment' | 'Fall' | 'Peregrine' {
  const d = (ESSENTIAL_DIGNITIES as any)[planet]
  if (!d) return 'Peregrine'
  const inList = (val: any, s: string) => (Array.isArray(val) ? val.includes(s) : val === s)
  if (inList(d.domicile, sign)) return 'Domicile'
  if (inList(d.exaltation, sign)) return 'Exalted'
  if (inList(d.detriment, sign)) return 'Detriment'
  if (inList(d.fall, sign)) return 'Fall'
  return 'Peregrine'
}

async function enhancedPositionsNow(): Promise<AlchemizeApiResponse | null> {
  try {
    const now = new Date()
    // Use a reasonable default location; planetary longitudes are time-dependent (not location)
    const birthInfo: EnhancedBirthInfo = {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      day: now.getUTCDate(),
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      second: now.getUTCSeconds(),
      latitude: 0,
      longitude: 0,
    }

    const results = calculateAllPlanets(birthInfo)

    const planetPositions: Record<string, { sign: string; degree: number }> = {}
    Object.entries(results.planets).forEach(([name, pos]) => {
      planetPositions[name] = {
        sign: pos.sign,
        degree: pos.signDegree,
      }
    })

    return {
      'Planet Positions': planetPositions,
      'Alchemy Effects': undefined as any,
      'Major Arcana': [],
      'Minor Arcana': [],
      'Decan Effects': {},
    }
  } catch (error) {
    console.error('enhancedPositionsNow() failed:', error)
    return null
  }
}

// Get the current Sun's decan based on real position
export function getSunDecanFromPosition(sunSign: string, sunDegree: number): number {
  // Map signs to their starting degrees in the zodiac
  const signToDegree: Record<string, number> = {
    Aries: 0,
    Taurus: 30,
    Gemini: 60,
    Cancer: 90,
    Leo: 120,
    Virgo: 150,
    Libra: 180,
    Scorpio: 210,
    Sagittarius: 240,
    Capricorn: 270,
    Aquarius: 300,
    Pisces: 330,
  }

  const signStartDegree = signToDegree[sunSign] || 0
  const absoluteDegree = signStartDegree + sunDegree

  // Each decan is 10 degrees, starting from 0
  // 0-10 = 1st decan Aries (0), 10-20 = 2nd decan Aries (10), etc.
  const decanIndex = Math.floor(absoluteDegree / 10) * 10

  console.log(`Sun at ${sunSign} ${sunDegree}° = absolute ${absoluteDegree}° = decan ${decanIndex}`)

  return decanIndex
}
