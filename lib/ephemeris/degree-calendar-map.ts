/**
 * Degree-to-Calendar Mapping Service
 * ===================================
 *
 * Provides fast lookups and caching for zodiac degree to calendar date mappings
 * Accounts for yearly variations in Sun's position due to leap years and orbital mechanics
 */

import {
  calculateSolarPosition,
  getZodiacPositionForDate,
  getDatesForZodiacDegree,
  generateYearlyDegreeMap,
  getZodiacIngresses,
  getCardinalPoints,
  DateRange,
  ZodiacPosition,
} from './solar-ephemeris'

export interface DegreeMapEntry {
  degree: number // 0-359
  sign: string // Zodiac sign name
  signDegree: number // 0-30 within sign
  decan: number // 1-3
  dateRange: DateRange // When Sun is at this degree
  keywords: string[] // Sabian symbols or keywords
}

export interface SignPeriod {
  sign: string
  startDate: Date
  endDate: Date
  durationDays: number
  decans: {
    first: DateRange
    second: DateRange
    third: DateRange
  }
}

export interface AnnualZodiacCalendar {
  year: number
  springEquinox: Date
  summerSolstice: Date
  autumnEquinox: Date
  winterSolstice: Date
  signPeriods: SignPeriod[]
  degreeMap: Map<number, DegreeMapEntry>
}

// Cache for yearly degree maps to avoid recalculation
const yearlyMapCache = new Map<number, AnnualZodiacCalendar>()

// Sabian symbols or keywords for each degree (simplified - you could expand this)
const DEGREE_KEYWORDS: Record<string, string[]> = {
  Aries_0: ['New beginnings', 'Pioneer spirit', 'Cardinal fire'],
  Aries_15: ['Warrior energy', 'Mid-sign strength', 'Pure action'],
  Aries_29: ['Completion', 'Transition', 'Final push'],
  Taurus_0: ['Grounding', 'Material foundation', 'Fixed earth'],
  Gemini_0: ['Communication', 'Mutable air', 'Curiosity'],
  Cancer_0: ['Nurturing', 'Cardinal water', 'Emotional security'],
  Leo_0: ['Creative expression', 'Fixed fire', 'Solar power'],
  Virgo_0: ['Analysis', 'Mutable earth', 'Perfectionism'],
  Libra_0: ['Balance', 'Cardinal air', 'Relationships'],
  Scorpio_0: ['Transformation', 'Fixed water', 'Deep psychology'],
  Sagittarius_0: ['Philosophy', 'Mutable fire', 'Expansion'],
  Capricorn_0: ['Ambition', 'Cardinal earth', 'Structure'],
  Aquarius_0: ['Innovation', 'Fixed air', 'Humanitarian'],
  Pisces_0: ['Transcendence', 'Mutable water', 'Universal love'],
}

/**
 * Get keywords for a specific zodiac degree
 */
function getKeywordsForDegree(sign: string, signDegree: number): string[] {
  // Check for specific degree keywords
  const key = `${sign}_${Math.floor(signDegree)}`
  if (DEGREE_KEYWORDS[key]) {
    return DEGREE_KEYWORDS[key]
  }

  // Default keywords based on decan
  const decan = Math.floor(signDegree / 10) + 1
  const element = getSignElement(sign)
  const modality = getSignModality(sign)

  return [
    `${sign} ${decan === 1 ? 'early' : decan === 2 ? 'middle' : 'late'} degrees`,
    `Decan ${decan}`,
    `${modality} ${element}`,
  ]
}

/**
 * Get element for zodiac sign
 */
function getSignElement(sign: string): string {
  const elements: Record<string, string> = {
    Aries: 'Fire',
    Leo: 'Fire',
    Sagittarius: 'Fire',
    Taurus: 'Earth',
    Virgo: 'Earth',
    Capricorn: 'Earth',
    Gemini: 'Air',
    Libra: 'Air',
    Aquarius: 'Air',
    Cancer: 'Water',
    Scorpio: 'Water',
    Pisces: 'Water',
  }
  return elements[sign] || 'Unknown'
}

/**
 * Get modality for zodiac sign
 */
function getSignModality(sign: string): string {
  const modalities: Record<string, string> = {
    Aries: 'Cardinal',
    Cancer: 'Cardinal',
    Libra: 'Cardinal',
    Capricorn: 'Cardinal',
    Taurus: 'Fixed',
    Leo: 'Fixed',
    Scorpio: 'Fixed',
    Aquarius: 'Fixed',
    Gemini: 'Mutable',
    Virgo: 'Mutable',
    Sagittarius: 'Mutable',
    Pisces: 'Mutable',
  }
  return modalities[sign] || 'Unknown'
}

/**
 * Build complete annual zodiac calendar with all mappings
 */
export function buildAnnualCalendar(year: number): AnnualZodiacCalendar {
  // Check cache first
  if (yearlyMapCache.has(year)) {
    return yearlyMapCache.get(year)!
  }

  // Get cardinal points (equinoxes and solstices)
  const cardinalPoints = getCardinalPoints(year)

  // Get sign ingress dates
  const ingresses = getZodiacIngresses(year)
  const nextYearIngresses = getZodiacIngresses(year + 1)

  // Build sign periods with decan dates
  const signPeriods: SignPeriod[] = []
  const signs = Object.keys(ingresses)

  for (let i = 0; i < signs.length; i++) {
    const sign = signs[i]
    const nextSign = signs[(i + 1) % signs.length]

    const startDate = ingresses[sign]
    const endDate = i === signs.length - 1 ? nextYearIngresses[signs[0]] : ingresses[nextSign]

    const durationMs = endDate.getTime() - startDate.getTime()
    const durationDays = durationMs / (1000 * 60 * 60 * 24)

    // Calculate decan periods (each roughly 1/3 of sign duration)
    const decanDuration = durationMs / 3

    const firstDecanEnd = new Date(startDate.getTime() + decanDuration)
    const secondDecanEnd = new Date(startDate.getTime() + 2 * decanDuration)

    signPeriods.push({
      sign,
      startDate,
      endDate,
      durationDays,
      decans: {
        first: {
          start: startDate,
          end: firstDecanEnd,
          duration_hours: decanDuration / (1000 * 60 * 60),
        },
        second: {
          start: firstDecanEnd,
          end: secondDecanEnd,
          duration_hours: decanDuration / (1000 * 60 * 60),
        },
        third: {
          start: secondDecanEnd,
          end: endDate,
          duration_hours: decanDuration / (1000 * 60 * 60),
        },
      },
    })
  }

  // Generate degree map with enriched data
  const basicDegreeMap = generateYearlyDegreeMap(year)
  const enrichedDegreeMap = new Map<number, DegreeMapEntry>()

  for (const [degree, dateRange] of basicDegreeMap.entries()) {
    const signIndex = Math.floor(degree / 30)
    const signDegree = degree % 30
    const sign = signs[signIndex]
    const decan = Math.floor(signDegree / 10) + 1

    enrichedDegreeMap.set(degree, {
      degree,
      sign,
      signDegree,
      decan,
      dateRange,
      keywords: getKeywordsForDegree(sign, signDegree),
    })
  }

  const calendar: AnnualZodiacCalendar = {
    year,
    springEquinox: cardinalPoints.spring_equinox,
    summerSolstice: cardinalPoints.summer_solstice,
    autumnEquinox: cardinalPoints.autumn_equinox,
    winterSolstice: cardinalPoints.winter_solstice,
    signPeriods,
    degreeMap: enrichedDegreeMap,
  }

  // Cache the result
  yearlyMapCache.set(year, calendar)

  return calendar
}

/**
 * Find what zodiac degree the Sun is at for a given date
 * Returns enriched information including keywords and decan
 */
export function getDegreeForDate(date: Date): DegreeMapEntry {
  const year = date.getFullYear()
  const calendar = buildAnnualCalendar(year)

  const zodiacPos = getZodiacPositionForDate(date)
  const degree = Math.floor(zodiacPos.absolute_longitude)

  // Get the entry from our pre-calculated map
  let entry = calendar.degreeMap.get(degree)

  // If not found (shouldn't happen), create on the fly
  if (!entry) {
    const dateRange = getDatesForZodiacDegree(year, degree)
    entry = {
      degree,
      sign: zodiacPos.sign,
      signDegree: zodiacPos.degree_in_sign,
      decan: zodiacPos.decan,
      dateRange,
      keywords: getKeywordsForDegree(zodiacPos.sign, zodiacPos.degree_in_sign),
    }
  }

  return entry
}

/**
 * Find all dates in a year when Sun is at a specific degree
 * Useful for anniversary calculations
 */
export function findDatesForDegree(degree: number, year: number): DateRange {
  const calendar = buildAnnualCalendar(year)
  const entry = calendar.degreeMap.get(Math.floor(degree))

  if (!entry) {
    // Fallback to calculation
    return getDatesForZodiacDegree(year, degree)
  }

  return entry.dateRange
}

/**
 * Get the current zodiac period information
 */
export function getCurrentZodiacPeriod(): SignPeriod | null {
  const now = new Date()
  const year = now.getFullYear()
  const calendar = buildAnnualCalendar(year)

  for (const period of calendar.signPeriods) {
    if (now >= period.startDate && now < period.endDate) {
      return period
    }
  }

  return null
}

/**
 * Calculate how many days until the next sign ingress
 */
export function daysUntilNextIngress(): { sign: string; days: number; date: Date } {
  const now = new Date()
  const year = now.getFullYear()
  const calendar = buildAnnualCalendar(year)

  for (const period of calendar.signPeriods) {
    if (now < period.startDate) {
      const days = (period.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      return {
        sign: period.sign,
        days: Math.ceil(days),
        date: period.startDate,
      }
    }
  }

  // If we're in the last sign of the year, get next year's Aries
  const nextYearCalendar = buildAnnualCalendar(year + 1)
  const nextAries = nextYearCalendar.signPeriods[0]
  const days = (nextAries.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

  return {
    sign: 'Aries',
    days: Math.ceil(days),
    date: nextAries.startDate,
  }
}

/**
 * Get a formatted calendar view of zodiac periods for a month
 */
export function getMonthlyZodiacCalendar(
  year: number,
  month: number
): {
  month: string
  days: Array<{
    date: number
    zodiacDegree: number
    sign: string
    signDegree: number
    decan: number
    isIngress: boolean
    isCardinal: boolean
  }>
} {
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

  const calendar = buildAnnualCalendar(year)
  const daysInMonth = new Date(year, month, 0).getDate()
  const days = []

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day, 12, 0, 0) // Noon to avoid DST issues
    const zodiacPos = getZodiacPositionForDate(date)
    const degree = Math.floor(zodiacPos.absolute_longitude)

    // Check if this is an ingress day (0° of any sign)
    const isIngress = zodiacPos.degree_in_sign < 1 && day > 1

    // Check if this is a cardinal point
    const isCardinal = [0, 90, 180, 270].includes(degree)

    days.push({
      date: day,
      zodiacDegree: degree,
      sign: zodiacPos.sign,
      signDegree: Math.floor(zodiacPos.degree_in_sign),
      decan: zodiacPos.decan,
      isIngress,
      isCardinal,
    })
  }

  return {
    month: monthNames[month - 1],
    days,
  }
}

/**
 * Invalidate cache for a specific year
 * Useful if calculations need to be refreshed
 */
export function invalidateYearCache(year: number): void {
  yearlyMapCache.delete(year)
}

/**
 * Clear entire cache
 */
export function clearCache(): void {
  yearlyMapCache.clear()
}
