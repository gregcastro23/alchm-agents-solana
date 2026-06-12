/**
 * Birth Data Parser for Monica
 * Extracts birth information from natural language user messages
 */

export interface ParsedBirthData {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  latitude: number
  longitude: number
}

const MONTH_NAMES: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

// Major US cities coordinates
const CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  'new york': { latitude: 40.7128, longitude: -73.9352 },
  nyc: { latitude: 40.7128, longitude: -73.9352 },
  brooklyn: { latitude: 40.6782, longitude: -73.9442 },
  manhattan: { latitude: 40.7831, longitude: -73.9712 },
  'los angeles': { latitude: 34.0522, longitude: -118.2437 },
  chicago: { latitude: 41.8781, longitude: -87.6298 },
  houston: { latitude: 29.7604, longitude: -95.3698 },
  phoenix: { latitude: 33.4484, longitude: -112.074 },
  philadelphia: { latitude: 39.9526, longitude: -75.1652 },
  'san antonio': { latitude: 29.4241, longitude: -98.4936 },
  'san diego': { latitude: 32.7157, longitude: -117.1611 },
  dallas: { latitude: 32.7767, longitude: -96.797 },
  'san jose': { latitude: 37.3382, longitude: -121.8863 },
  austin: { latitude: 30.2672, longitude: -97.7431 },
  miami: { latitude: 25.7617, longitude: -80.1918 },
  seattle: { latitude: 47.6062, longitude: -122.3321 },
  boston: { latitude: 42.3601, longitude: -71.0589 },
  denver: { latitude: 39.7392, longitude: -104.9903 },
  atlanta: { latitude: 33.749, longitude: -84.388 },
  portland: { latitude: 45.5152, longitude: -122.6784 },
  'las vegas': { latitude: 36.1699, longitude: -115.1398 },
  detroit: { latitude: 42.3314, longitude: -83.0458 },
  nashville: { latitude: 36.1627, longitude: -86.7816 },
  baltimore: { latitude: 39.2904, longitude: -76.6122 },
  'san francisco': { latitude: 37.7749, longitude: -122.4194 },
}

/**
 * Parse birth data from natural language text
 * Examples:
 * - "June 23 1991 at 10:24am in Brooklyn New York"
 * - "born on 6/23/1991 at 10:24 AM in Brooklyn, NY"
 * - "my birthdate is June 23, 1991, 10:24am, Brooklyn New York"
 */
export function parseBirthData(text: string): ParsedBirthData | null {
  const lowerText = text.toLowerCase()

  // Extract date components
  const dateMatch =
    // Format: "June 23 1991" or "June 23, 1991"
    lowerText.match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/) ||
    // Format: "6/23/1991" or "06-23-1991"
    lowerText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)

  if (!dateMatch) {
    return null
  }

  let month: number
  let day: number
  let year: number

  if (isNaN(parseInt(dateMatch[1]))) {
    // Month name format
    const monthName = dateMatch[1].toLowerCase()
    month = MONTH_NAMES[monthName] || 0
    day = parseInt(dateMatch[2])
    year = parseInt(dateMatch[3])
  } else {
    // Numeric format - assume MM/DD/YYYY
    month = parseInt(dateMatch[1])
    day = parseInt(dateMatch[2])
    year = parseInt(dateMatch[3])
  }

  // Extract time
  const timeMatch = lowerText.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/)

  let hour = 12
  let minute = 0

  if (timeMatch) {
    hour = parseInt(timeMatch[1])
    minute = parseInt(timeMatch[2])
    const meridiem = timeMatch[3]?.toLowerCase()

    // Convert to 24-hour format
    if (meridiem === 'pm' && hour !== 12) {
      hour += 12
    } else if (meridiem === 'am' && hour === 12) {
      hour = 0
    }
  }

  // Extract location
  let latitude = 40.7128 // Default to NYC
  let longitude = -73.9352

  for (const [cityName, coords] of Object.entries(CITY_COORDS)) {
    if (lowerText.includes(cityName)) {
      latitude = coords.latitude
      longitude = coords.longitude
      break
    }
  }

  // Validate parsed data
  if (
    !month ||
    month < 1 ||
    month > 12 ||
    !day ||
    day < 1 ||
    day > 31 ||
    !year ||
    year < 1900 ||
    year > 2100
  ) {
    return null
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    latitude,
    longitude,
  }
}

/**
 * Check if a message contains birth data information
 */
export function containsBirthData(text: string): boolean {
  const lowerText = text.toLowerCase()

  return (
    (lowerText.includes('birth') || lowerText.includes('born') || lowerText.includes('birthday')) &&
    (lowerText.match(/\d{4}/) !== null || // Contains a year
      Object.keys(MONTH_NAMES).some(month => lowerText.includes(month)))
  )
}

/**
 * Format birth data for display
 */
export function formatBirthData(birthData: ParsedBirthData): string {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const hour12 = birthData.hour % 12 || 12
  const ampm = birthData.hour >= 12 ? 'PM' : 'AM'

  return `${monthNames[birthData.month - 1]} ${birthData.day}, ${birthData.year} at ${hour12}:${birthData.minute.toString().padStart(2, '0')} ${ampm}`
}
