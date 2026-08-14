/**
 * Geocoding Service - Location to Coordinates Conversion
 *
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 * Falls back to curated city data if service is unavailable or rate-limited.
 */

export interface GeocodeResult {
  latitude: number
  longitude: number
  formattedName: string
  displayName?: string
  primary?: string
  secondary?: string
  type?: string
  country?: string
  state?: string
  city?: string
  timezone?: string
}

// Nominatim API configuration
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
const REQUEST_DELAY = 1000 // Nominatim requires 1 request per second
let lastRequestTime = 0

// Curated fallback data for major global cities
const FALLBACK_COORDINATES: Record<string, GeocodeResult> = {
  'new york': {
    latitude: 40.7128,
    longitude: -74.006,
    formattedName: 'New York, NY, USA',
    displayName: 'New York, NY, USA',
    primary: 'New York',
    secondary: 'New York, United States',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    type: 'city',
  },
  london: {
    latitude: 51.5074,
    longitude: -0.1278,
    formattedName: 'London, England, UK',
    displayName: 'London, England, UK',
    primary: 'London',
    secondary: 'Greater London, United Kingdom',
    city: 'London',
    country: 'United Kingdom',
    type: 'city',
  },
  paris: {
    latitude: 48.8566,
    longitude: 2.3522,
    formattedName: 'Paris, France',
    displayName: 'Paris, France',
    primary: 'Paris',
    secondary: 'Île-de-France, France',
    city: 'Paris',
    country: 'France',
    type: 'city',
  },
  tokyo: {
    latitude: 35.6762,
    longitude: 139.6503,
    formattedName: 'Tokyo, Japan',
    displayName: 'Tokyo, Japan',
    primary: 'Tokyo',
    secondary: 'Kanto, Japan',
    city: 'Tokyo',
    country: 'Japan',
    type: 'city',
  },
  sydney: {
    latitude: -33.8688,
    longitude: 151.2093,
    formattedName: 'Sydney, Australia',
    displayName: 'Sydney, Australia',
    primary: 'Sydney',
    secondary: 'New South Wales, Australia',
    city: 'Sydney',
    country: 'Australia',
    type: 'city',
  },
  'los angeles': {
    latitude: 34.0522,
    longitude: -118.2437,
    formattedName: 'Los Angeles, CA, USA',
    displayName: 'Los Angeles, CA, USA',
    primary: 'Los Angeles',
    secondary: 'California, United States',
    city: 'Los Angeles',
    state: 'CA',
    country: 'USA',
    type: 'city',
  },
  chicago: {
    latitude: 41.8781,
    longitude: -87.6298,
    formattedName: 'Chicago, IL, USA',
    displayName: 'Chicago, IL, USA',
    primary: 'Chicago',
    secondary: 'Illinois, United States',
    city: 'Chicago',
    state: 'IL',
    country: 'USA',
    type: 'city',
  },
  toronto: {
    latitude: 43.6532,
    longitude: -79.3832,
    formattedName: 'Toronto, Canada',
    displayName: 'Toronto, Canada',
    primary: 'Toronto',
    secondary: 'Ontario, Canada',
    city: 'Toronto',
    country: 'Canada',
    type: 'city',
  },
  berlin: {
    latitude: 52.52,
    longitude: 13.405,
    formattedName: 'Berlin, Germany',
    displayName: 'Berlin, Germany',
    primary: 'Berlin',
    secondary: 'Berlin, Germany',
    city: 'Berlin',
    country: 'Germany',
    type: 'city',
  },
  rome: {
    latitude: 41.9028,
    longitude: 12.4964,
    formattedName: 'Rome, Italy',
    displayName: 'Rome, Italy',
    primary: 'Rome',
    secondary: 'Lazio, Italy',
    city: 'Rome',
    country: 'Italy',
    type: 'city',
  },
  miami: {
    latitude: 25.7617,
    longitude: -80.1918,
    formattedName: 'Miami, FL, USA',
    displayName: 'Miami, FL, USA',
    primary: 'Miami',
    secondary: 'Florida, United States',
    city: 'Miami',
    state: 'FL',
    country: 'USA',
    type: 'city',
  },
  'san francisco': {
    latitude: 37.7749,
    longitude: -122.4194,
    formattedName: 'San Francisco, CA, USA',
    displayName: 'San Francisco, CA, USA',
    primary: 'San Francisco',
    secondary: 'California, United States',
    city: 'San Francisco',
    state: 'CA',
    country: 'USA',
    type: 'city',
  },
}

/**
 * Format raw Nominatim display name into clear primary and secondary parts.
 */
export function formatLocationName(raw: string): { primary: string; secondary: string } {
  const parts = raw.split(',').map(p => p.trim())
  if (parts.length <= 2) {
    return { primary: parts[0] || raw, secondary: parts.slice(1).join(', ') }
  }
  const primary = parts[0]
  const secondary = [parts[1], parts[parts.length - 1]].filter(Boolean).join(', ')
  return { primary, secondary }
}

/**
 * Search for locations matching a query string with autocomplete support.
 * Returns up to `limit` deduplicated results.
 */
export async function searchGeocodeLocations(query: string, limit = 5): Promise<GeocodeResult[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  const normalized = query.toLowerCase().trim()

  try {
    // Check fallback for exact match first
    const instantFallback = getFallbackCoordinates(normalized)
    const fallbackList = instantFallback ? [instantFallback] : []

    // Rate limiting to respect Nominatim usage policy
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    if (timeSinceLastRequest < REQUEST_DELAY) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest))
    }

    const url = new URL(`${NOMINATIM_BASE_URL}/search`)
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', String(Math.max(limit * 2, 10)))
    url.searchParams.set('addressdetails', '1')

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'PlanetaryAgents/1.0 (Astrological Application)',
      },
      signal: AbortSignal.timeout(5000),
    })

    lastRequestTime = Date.now()

    if (!response.ok) {
      console.warn(`[Geocoding] Nominatim responded with status ${response.status}`)
      return fallbackList.length > 0 ? fallbackList : findMatchingFallbacks(normalized, limit)
    }

    const data = await response.json()
    if (!Array.isArray(data) || data.length === 0) {
      return fallbackList.length > 0 ? fallbackList : findMatchingFallbacks(normalized, limit)
    }

    const results: GeocodeResult[] = []
    const seen = new Set<string>()

    for (const item of data) {
      const displayName = item.display_name || ''
      const { primary, secondary } = formatLocationName(displayName)
      const dedupKey = `${primary}-${secondary}`.toLowerCase()

      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)

      const lat = parseFloat(item.lat)
      const lon = parseFloat(item.lon)

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

      results.push({
        latitude: lat,
        longitude: lon,
        formattedName: displayName,
        displayName,
        primary,
        secondary,
        type: item.type || 'city',
        city: item.address?.city || item.address?.town || item.address?.village || primary,
        state: item.address?.state,
        country: item.address?.country,
      })

      if (results.length >= limit) break
    }

    return results.length > 0 ? results : fallbackList
  } catch (error) {
    console.error('[Geocoding] Search error:', error)
    return findMatchingFallbacks(normalized, limit)
  }
}

/**
 * Geocode a location string to a single best coordinate result.
 * Falls back to curated city data if API fails.
 */
export async function geocodeLocation(location: string): Promise<GeocodeResult | null> {
  const results = await searchGeocodeLocations(location, 1)
  return results.length > 0 ? results[0] : null
}

/**
 * Alias for geocodeLocation for single-result fetching.
 */
export async function geocodeLocationSingle(location: string): Promise<GeocodeResult | null> {
  return geocodeLocation(location)
}

/**
 * Get fallback coordinates for common cities
 */
function getFallbackCoordinates(normalizedLocation: string): GeocodeResult | null {
  const match = Object.entries(FALLBACK_COORDINATES).find(
    ([key]) =>
      normalizedLocation === key ||
      normalizedLocation.startsWith(key) ||
      key.startsWith(normalizedLocation)
  )
  return match ? match[1] : null
}

/**
 * Search fallback dictionary for partial matches
 */
function findMatchingFallbacks(normalizedQuery: string, limit = 5): GeocodeResult[] {
  const matches: GeocodeResult[] = []
  for (const [key, val] of Object.entries(FALLBACK_COORDINATES)) {
    if (key.includes(normalizedQuery) || normalizedQuery.includes(key)) {
      matches.push(val)
      if (matches.length >= limit) break
    }
  }
  return matches
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
