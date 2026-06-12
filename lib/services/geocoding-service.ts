/**
 * Geocoding Service - Location to Coordinates Conversion
 *
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 * Falls back to mock data if service is unavailable
 */

export interface GeocodeResult {
  latitude: number
  longitude: number
  formattedName: string
  country?: string
  state?: string
  city?: string
}

// Nominatim API configuration
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
const REQUEST_DELAY = 1000 // Nominatim requires 1 request per second
let lastRequestTime = 0

// Mock fallback data for common cities
const FALLBACK_COORDINATES: Record<string, GeocodeResult> = {
  'new york': {
    latitude: 40.7128,
    longitude: -74.006,
    formattedName: 'New York, NY, USA',
    city: 'New York',
    state: 'NY',
    country: 'USA',
  },
  london: {
    latitude: 51.5074,
    longitude: -0.1278,
    formattedName: 'London, England, UK',
    city: 'London',
    country: 'United Kingdom',
  },
  paris: {
    latitude: 48.8566,
    longitude: 2.3522,
    formattedName: 'Paris, France',
    city: 'Paris',
    country: 'France',
  },
  tokyo: {
    latitude: 35.6762,
    longitude: 139.6503,
    formattedName: 'Tokyo, Japan',
    city: 'Tokyo',
    country: 'Japan',
  },
  sydney: {
    latitude: -33.8688,
    longitude: 151.2093,
    formattedName: 'Sydney, Australia',
    city: 'Sydney',
    country: 'Australia',
  },
  'los angeles': {
    latitude: 34.0522,
    longitude: -118.2437,
    formattedName: 'Los Angeles, CA, USA',
    city: 'Los Angeles',
    state: 'CA',
    country: 'USA',
  },
  chicago: {
    latitude: 41.8781,
    longitude: -87.6298,
    formattedName: 'Chicago, IL, USA',
    city: 'Chicago',
    state: 'IL',
    country: 'USA',
  },
  toronto: {
    latitude: 43.6532,
    longitude: -79.3832,
    formattedName: 'Toronto, Canada',
    city: 'Toronto',
    country: 'Canada',
  },
  berlin: {
    latitude: 52.52,
    longitude: 13.405,
    formattedName: 'Berlin, Germany',
    city: 'Berlin',
    country: 'Germany',
  },
  rome: {
    latitude: 41.9028,
    longitude: 12.4964,
    formattedName: 'Rome, Italy',
    city: 'Rome',
    country: 'Italy',
  },
}

/**
 * Geocode a location string to coordinates using Nominatim API
 * Falls back to mock data if API fails
 */
export async function geocodeLocation(location: string): Promise<GeocodeResult | null> {
  if (!location || location.trim().length === 0) {
    return null
  }

  const normalizedLocation = location.toLowerCase().trim()

  try {
    // Check fallback data first for common cities (faster)
    const fallback = getFallbackCoordinates(normalizedLocation)
    if (fallback) {
      console.log('[Geocoding] Using cached coordinates for:', location)
      return fallback
    }

    // Rate limiting - ensure 1 second between requests
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    if (timeSinceLastRequest < REQUEST_DELAY) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest))
    }

    // Query Nominatim API
    const url = new URL(`${NOMINATIM_BASE_URL}/search`)
    url.searchParams.set('q', location)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('addressdetails', '1')

    console.log('[Geocoding] Querying Nominatim for:', location)

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'PlanetaryAgents/1.0 (Astrological Application)',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    lastRequestTime = Date.now()

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      console.log('[Geocoding] No results from Nominatim, trying fallback')
      return getFallbackCoordinates(normalizedLocation)
    }

    const result = data[0]
    const geocodeResult: GeocodeResult = {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      formattedName: result.display_name,
      city: result.address?.city || result.address?.town || result.address?.village,
      state: result.address?.state,
      country: result.address?.country,
    }

    console.log('[Geocoding] Found:', geocodeResult.formattedName)
    return geocodeResult
  } catch (error) {
    console.error('[Geocoding] Error:', error)

    // Fallback to mock data
    const fallback = getFallbackCoordinates(normalizedLocation)
    if (fallback) {
      console.log('[Geocoding] Using fallback coordinates')
      return fallback
    }

    return null
  }
}

/**
 * Get fallback coordinates for common cities
 */
function getFallbackCoordinates(normalizedLocation: string): GeocodeResult | null {
  const match = Object.entries(FALLBACK_COORDINATES).find(
    ([key]) => normalizedLocation.includes(key) || key.includes(normalizedLocation)
  )

  if (match) {
    return match[1]
  }

  return null
}

/**
 * Batch geocode multiple locations
 */
export async function geocodeLocations(
  locations: string[]
): Promise<Map<string, GeocodeResult | null>> {
  const results = new Map<string, GeocodeResult | null>()

  for (const location of locations) {
    const result = await geocodeLocation(location)
    results.set(location, result)
  }

  return results
}

/**
 * Reverse geocode coordinates to location name
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    // Rate limiting
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    if (timeSinceLastRequest < REQUEST_DELAY) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest))
    }

    const url = new URL(`${NOMINATIM_BASE_URL}/reverse`)
    url.searchParams.set('lat', latitude.toString())
    url.searchParams.set('lon', longitude.toString())
    url.searchParams.set('format', 'json')

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'PlanetaryAgents/1.0 (Astrological Application)',
      },
      signal: AbortSignal.timeout(5000),
    })

    lastRequestTime = Date.now()

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`)
    }

    const data = await response.json()
    return data.display_name || null
  } catch (error) {
    console.error('[Geocoding] Reverse geocode error:', error)
    return null
  }
}
