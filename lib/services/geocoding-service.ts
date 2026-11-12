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
  utcOffsetHours?: number
  lmtOffsetHours?: number
  clockToLmtMinutes?: number
}

// Nominatim API configuration
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
const REQUEST_DELAY = 1000 // Nominatim requires 1 request per second
let lastRequestTime = 0

// Curated fallback data for major global cities (with IANA timezones)
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
    timezone: 'America/New_York',
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
    timezone: 'Europe/London',
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
    timezone: 'Europe/Paris',
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
    timezone: 'Asia/Tokyo',
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
    timezone: 'Australia/Sydney',
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
    timezone: 'America/Los_Angeles',
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
    timezone: 'America/Chicago',
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
    timezone: 'America/Toronto',
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
    timezone: 'Europe/Berlin',
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
    timezone: 'Europe/Rome',
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
    timezone: 'America/New_York',
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
    timezone: 'America/Los_Angeles',
    type: 'city',
  },
  bangkok: {
    latitude: 13.7563,
    longitude: 100.5018,
    formattedName: 'Bangkok, Thailand',
    displayName: 'Bangkok, Thailand',
    primary: 'Bangkok',
    secondary: 'Bangkok, Thailand',
    city: 'Bangkok',
    country: 'Thailand',
    timezone: 'Asia/Bangkok',
    type: 'city',
  },
  madrid: {
    latitude: 40.4168,
    longitude: -3.7038,
    formattedName: 'Madrid, Spain',
    displayName: 'Madrid, Spain',
    primary: 'Madrid',
    secondary: 'Community of Madrid, Spain',
    city: 'Madrid',
    country: 'Spain',
    timezone: 'Europe/Madrid',
    type: 'city',
  },
  amsterdam: {
    latitude: 52.3676,
    longitude: 4.9041,
    formattedName: 'Amsterdam, Netherlands',
    displayName: 'Amsterdam, Netherlands',
    primary: 'Amsterdam',
    secondary: 'North Holland, Netherlands',
    city: 'Amsterdam',
    country: 'Netherlands',
    timezone: 'Europe/Amsterdam',
    type: 'city',
  },
  vienna: {
    latitude: 48.2082,
    longitude: 16.3738,
    formattedName: 'Vienna, Austria',
    displayName: 'Vienna, Austria',
    primary: 'Vienna',
    secondary: 'Vienna, Austria',
    city: 'Vienna',
    country: 'Austria',
    timezone: 'Europe/Vienna',
    type: 'city',
  },
  zurich: {
    latitude: 47.3769,
    longitude: 8.5417,
    formattedName: 'Zurich, Switzerland',
    displayName: 'Zurich, Switzerland',
    primary: 'Zurich',
    secondary: 'Zurich, Switzerland',
    city: 'Zurich',
    country: 'Switzerland',
    timezone: 'Europe/Zurich',
    type: 'city',
  },
  dublin: {
    latitude: 53.3498,
    longitude: -6.2603,
    formattedName: 'Dublin, Ireland',
    displayName: 'Dublin, Ireland',
    primary: 'Dublin',
    secondary: 'Leinster, Ireland',
    city: 'Dublin',
    country: 'Ireland',
    timezone: 'Europe/Dublin',
    type: 'city',
  },
  athens: {
    latitude: 37.9838,
    longitude: 23.7275,
    formattedName: 'Athens, Greece',
    displayName: 'Athens, Greece',
    primary: 'Athens',
    secondary: 'Attica, Greece',
    city: 'Athens',
    country: 'Greece',
    timezone: 'Europe/Athens',
    type: 'city',
  },
  istanbul: {
    latitude: 41.0082,
    longitude: 28.9784,
    formattedName: 'Istanbul, Turkey',
    displayName: 'Istanbul, Turkey',
    primary: 'Istanbul',
    secondary: 'Marmara, Turkey',
    city: 'Istanbul',
    country: 'Turkey',
    timezone: 'Europe/Istanbul',
    type: 'city',
  },
  cairo: {
    latitude: 30.0444,
    longitude: 31.2357,
    formattedName: 'Cairo, Egypt',
    displayName: 'Cairo, Egypt',
    primary: 'Cairo',
    secondary: 'Cairo Governorate, Egypt',
    city: 'Cairo',
    country: 'Egypt',
    timezone: 'Africa/Cairo',
    type: 'city',
  },
  mumbai: {
    latitude: 19.076,
    longitude: 72.8777,
    formattedName: 'Mumbai, India',
    displayName: 'Mumbai, India',
    primary: 'Mumbai',
    secondary: 'Maharashtra, India',
    city: 'Mumbai',
    country: 'India',
    timezone: 'Asia/Kolkata',
    type: 'city',
  },
  delhi: {
    latitude: 28.6139,
    longitude: 77.209,
    formattedName: 'Delhi, India',
    displayName: 'Delhi, India',
    primary: 'Delhi',
    secondary: 'Delhi, India',
    city: 'Delhi',
    country: 'India',
    timezone: 'Asia/Kolkata',
    type: 'city',
  },
  singapore: {
    latitude: 1.3521,
    longitude: 103.8198,
    formattedName: 'Singapore',
    displayName: 'Singapore',
    primary: 'Singapore',
    secondary: 'Singapore',
    city: 'Singapore',
    country: 'Singapore',
    timezone: 'Asia/Singapore',
    type: 'city',
  },
  'hong kong': {
    latitude: 22.3193,
    longitude: 114.1694,
    formattedName: 'Hong Kong',
    displayName: 'Hong Kong',
    primary: 'Hong Kong',
    secondary: 'Hong Kong',
    city: 'Hong Kong',
    country: 'China',
    timezone: 'Asia/Hong_Kong',
    type: 'city',
  },
  seoul: {
    latitude: 37.5665,
    longitude: 126.978,
    formattedName: 'Seoul, South Korea',
    displayName: 'Seoul, South Korea',
    primary: 'Seoul',
    secondary: 'Seoul, South Korea',
    city: 'Seoul',
    country: 'South Korea',
    timezone: 'Asia/Seoul',
    type: 'city',
  },
  beijing: {
    latitude: 39.9042,
    longitude: 116.4074,
    formattedName: 'Beijing, China',
    displayName: 'Beijing, China',
    primary: 'Beijing',
    secondary: 'Beijing, China',
    city: 'Beijing',
    country: 'China',
    timezone: 'Asia/Shanghai',
    type: 'city',
  },
  taipei: {
    latitude: 25.033,
    longitude: 121.5654,
    formattedName: 'Taipei, Taiwan',
    displayName: 'Taipei, Taiwan',
    primary: 'Taipei',
    secondary: 'Taipei, Taiwan',
    city: 'Taipei',
    country: 'Taiwan',
    timezone: 'Asia/Taipei',
    type: 'city',
  },
  jakarta: {
    latitude: -6.2088,
    longitude: 106.8456,
    formattedName: 'Jakarta, Indonesia',
    displayName: 'Jakarta, Indonesia',
    primary: 'Jakarta',
    secondary: 'Jakarta, Indonesia',
    city: 'Jakarta',
    country: 'Indonesia',
    timezone: 'Asia/Jakarta',
    type: 'city',
  },
  manila: {
    latitude: 14.5995,
    longitude: 120.9842,
    formattedName: 'Manila, Philippines',
    displayName: 'Manila, Philippines',
    primary: 'Manila',
    secondary: 'Metro Manila, Philippines',
    city: 'Manila',
    country: 'Philippines',
    timezone: 'Asia/Manila',
    type: 'city',
  },
  moscow: {
    latitude: 55.7558,
    longitude: 37.6176,
    formattedName: 'Moscow, Russia',
    displayName: 'Moscow, Russia',
    primary: 'Moscow',
    secondary: 'Moscow, Russia',
    city: 'Moscow',
    country: 'Russia',
    timezone: 'Europe/Moscow',
    type: 'city',
  },
  'mexico city': {
    latitude: 19.4326,
    longitude: -99.1332,
    formattedName: 'Mexico City, Mexico',
    displayName: 'Mexico City, Mexico',
    primary: 'Mexico City',
    secondary: 'CDMX, Mexico',
    city: 'Mexico City',
    country: 'Mexico',
    timezone: 'America/Mexico_City',
    type: 'city',
  },
  'sao paulo': {
    latitude: -23.5505,
    longitude: -46.6333,
    formattedName: 'São Paulo, Brazil',
    displayName: 'São Paulo, Brazil',
    primary: 'São Paulo',
    secondary: 'São Paulo, Brazil',
    city: 'São Paulo',
    country: 'Brazil',
    timezone: 'America/Sao_Paulo',
    type: 'city',
  },
  'buenos aires': {
    latitude: -34.6037,
    longitude: -58.3816,
    formattedName: 'Buenos Aires, Argentina',
    displayName: 'Buenos Aires, Argentina',
    primary: 'Buenos Aires',
    secondary: 'Buenos Aires, Argentina',
    city: 'Buenos Aires',
    country: 'Argentina',
    timezone: 'America/Argentina/Buenos_Aires',
    type: 'city',
  },
  boston: {
    latitude: 42.3601,
    longitude: -71.0589,
    formattedName: 'Boston, MA, USA',
    displayName: 'Boston, MA, USA',
    primary: 'Boston',
    secondary: 'Massachusetts, United States',
    city: 'Boston',
    state: 'MA',
    country: 'USA',
    timezone: 'America/New_York',
    type: 'city',
  },
  seattle: {
    latitude: 47.6062,
    longitude: -122.3321,
    formattedName: 'Seattle, WA, USA',
    displayName: 'Seattle, WA, USA',
    primary: 'Seattle',
    secondary: 'Washington, United States',
    city: 'Seattle',
    state: 'WA',
    country: 'USA',
    timezone: 'America/Los_Angeles',
    type: 'city',
  },
  austin: {
    latitude: 30.2672,
    longitude: -97.7431,
    formattedName: 'Austin, TX, USA',
    displayName: 'Austin, TX, USA',
    primary: 'Austin',
    secondary: 'Texas, United States',
    city: 'Austin',
    state: 'TX',
    country: 'USA',
    timezone: 'America/Chicago',
    type: 'city',
  },
  denver: {
    latitude: 39.7392,
    longitude: -104.9903,
    formattedName: 'Denver, CO, USA',
    displayName: 'Denver, CO, USA',
    primary: 'Denver',
    secondary: 'Colorado, United States',
    city: 'Denver',
    state: 'CO',
    country: 'USA',
    timezone: 'America/Denver',
    type: 'city',
  },
  atlanta: {
    latitude: 33.749,
    longitude: -84.388,
    formattedName: 'Atlanta, GA, USA',
    displayName: 'Atlanta, GA, USA',
    primary: 'Atlanta',
    secondary: 'Georgia, United States',
    city: 'Atlanta',
    state: 'GA',
    country: 'USA',
    timezone: 'America/New_York',
    type: 'city',
  },
  houston: {
    latitude: 29.7604,
    longitude: -95.3698,
    formattedName: 'Houston, TX, USA',
    displayName: 'Houston, TX, USA',
    primary: 'Houston',
    secondary: 'Texas, United States',
    city: 'Houston',
    state: 'TX',
    country: 'USA',
    timezone: 'America/Chicago',
    type: 'city',
  },
  phoenix: {
    latitude: 33.4484,
    longitude: -112.074,
    formattedName: 'Phoenix, AZ, USA',
    displayName: 'Phoenix, AZ, USA',
    primary: 'Phoenix',
    secondary: 'Arizona, United States',
    city: 'Phoenix',
    state: 'AZ',
    country: 'USA',
    timezone: 'America/Phoenix',
    type: 'city',
  },
  ulm: {
    latitude: 48.4011,
    longitude: 9.9876,
    formattedName: 'Ulm, Germany',
    displayName: 'Ulm, Germany',
    primary: 'Ulm',
    secondary: 'Baden-Württemberg, Germany',
    city: 'Ulm',
    country: 'Germany',
    timezone: 'Europe/Berlin',
    type: 'city',
  },
  florence: {
    latitude: 43.7696,
    longitude: 11.2558,
    formattedName: 'Florence, Italy',
    displayName: 'Florence, Italy',
    primary: 'Florence',
    secondary: 'Tuscany, Italy',
    city: 'Florence',
    country: 'Italy',
    timezone: 'Europe/Rome',
    type: 'city',
  },
  pisa: {
    latitude: 43.7228,
    longitude: 10.4017,
    formattedName: 'Pisa, Italy',
    displayName: 'Pisa, Italy',
    primary: 'Pisa',
    secondary: 'Tuscany, Italy',
    city: 'Pisa',
    country: 'Italy',
    timezone: 'Europe/Rome',
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

export interface TimezoneMetadata {
  timezone?: string
  utcOffsetHours: number
  lmtOffsetHours: number
  clockToLmtMinutes: number
}

function resolveIanaUtcOffsetHours(timezone: string, referenceDate: Date): number | null {
  try {
    const utcMs = Math.floor(referenceDate.getTime() / 1000) * 1000
    const aligned = new Date(utcMs)
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    const parts = dtf.formatToParts(aligned)
    const partNum = (type: string) => Number(parts.find(p => p.type === type)?.value ?? NaN)
    const year = partNum('year')
    const month = partNum('month')
    const day = partNum('day')
    const rawHour = partNum('hour')
    const hour = rawHour === 24 ? 0 : rawHour
    const minute = partNum('minute')
    const second = partNum('second')
    if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
      return null
    }
    const localAsUtc = new Date(0)
    localAsUtc.setUTCFullYear(year, month - 1, day)
    localAsUtc.setUTCHours(hour, minute, second, 0)
    const diffHours = (localAsUtc.getTime() - utcMs) / 3_600_000
    return Number(diffHours.toFixed(4))
  } catch {
    return null
  }
}

/**
 * Compute UTC zone offset, astronomical Local Mean Time (LMT) offset, and
 * the signed correction (in minutes) from wall-clock time to LMT.
 */
export function computeTimezoneMetadata(
  longitude: number,
  timezone?: string,
  referenceDate?: Date
): TimezoneMetadata {
  const safeLon = Number.isFinite(longitude) ? longitude : 0
  const lmtOffsetHours = Number((safeLon / 15).toFixed(4))
  const ref = referenceDate && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date()
  const resolvedUtc = timezone ? resolveIanaUtcOffsetHours(timezone, ref) : null
  const utcOffsetHours = resolvedUtc !== null ? resolvedUtc : Math.round(safeLon / 15)
  const clockToLmtMinutes = Math.round((lmtOffsetHours - utcOffsetHours) * 60)

  return {
    ...(timezone ? { timezone } : {}),
    utcOffsetHours,
    lmtOffsetHours,
    clockToLmtMinutes,
  }
}

function enrichGeocodeResult(result: GeocodeResult, referenceDate?: Date): GeocodeResult {
  const fallbackTz =
    result.timezone ??
    (result.city ? getFallbackCoordinates(result.city.toLowerCase())?.timezone : undefined)
  const meta = computeTimezoneMetadata(result.longitude, fallbackTz, referenceDate)
  return {
    ...result,
    ...meta,
  }
}

/**
 * Search for locations matching a query string with autocomplete support.
 * Returns up to `limit` deduplicated results.
 */
export async function searchGeocodeLocations(
  query: string,
  limit = 5,
  referenceDate?: Date
): Promise<GeocodeResult[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  const normalized = query.toLowerCase().trim()
  const instantFallback = getFallbackCoordinates(normalized)
  const fallbackList = instantFallback ? [enrichGeocodeResult(instantFallback, referenceDate)] : []

  if (limit === 1 && fallbackList.length > 0) {
    return fallbackList
  }

  try {
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
      return fallbackList.length > 0
        ? fallbackList
        : findMatchingFallbacks(normalized, limit).map(r => enrichGeocodeResult(r, referenceDate))
    }

    const data = await response.json()
    if (!Array.isArray(data) || data.length === 0) {
      return fallbackList.length > 0
        ? fallbackList
        : findMatchingFallbacks(normalized, limit).map(r => enrichGeocodeResult(r, referenceDate))
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

      const city = item.address?.city || item.address?.town || item.address?.village || primary
      results.push(
        enrichGeocodeResult(
          {
            latitude: lat,
            longitude: lon,
            formattedName: displayName,
            displayName,
            primary,
            secondary,
            type: item.type || 'city',
            city,
            state: item.address?.state,
            country: item.address?.country,
            timezone: instantFallback?.timezone,
          },
          referenceDate
        )
      )

      if (results.length >= limit) break
    }

    return results.length > 0 ? results : fallbackList
  } catch (error) {
    console.error('[Geocoding] Search error:', error)
    return fallbackList.length > 0
      ? fallbackList
      : findMatchingFallbacks(normalized, limit).map(r => enrichGeocodeResult(r, referenceDate))
  }
}

/**
 * Geocode a location string to a single best coordinate result.
 * Falls back to curated city data if API fails.
 */
export async function geocodeLocation(
  location: string,
  referenceDate?: Date
): Promise<GeocodeResult | null> {
  const results = await searchGeocodeLocations(location, 1, referenceDate)
  return results.length > 0 ? results[0] : null
}

/**
 * Alias for geocodeLocation for single-result fetching.
 */
export async function geocodeLocationSingle(
  location: string,
  referenceDate?: Date
): Promise<GeocodeResult | null> {
  return geocodeLocation(location, referenceDate)
}

/**
 * Get fallback coordinates for common cities
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getFallbackCoordinates(normalizedLocation: string): GeocodeResult | null {
  const cleaned = normalizedLocation.toLowerCase().trim().replace(/\s+/g, ' ')
  if (!cleaned) return null

  const primarySegment = cleaned.split(',')[0].trim()
  const direct = FALLBACK_COORDINATES[cleaned] ?? FALLBACK_COORDINATES[primarySegment]
  if (direct) return direct

  const sortedEntries = Object.entries(FALLBACK_COORDINATES).sort(([a], [b]) => b.length - a.length)
  const boundaryMatch = sortedEntries.find(([key]) =>
    new RegExp(`(^|[,\\s/])${escapeRegExp(key)}($|[,\\s/])`).test(cleaned)
  )
  return boundaryMatch ? boundaryMatch[1] : null
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
