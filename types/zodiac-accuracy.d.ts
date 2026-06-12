/**
 * TypeScript Type Definitions for Zodiac Accuracy System
 * ======================================================
 *
 * Comprehensive type definitions for all zodiac accuracy APIs and interfaces
 */

// Core Zodiac Types
export interface ZodiacPosition {
  /** Absolute ecliptic longitude in degrees (0-360) */
  absolute_longitude: number
  /** Zodiac sign name */
  sign: string
  /** Sign index (0-11, Aries=0) */
  sign_index: number
  /** Degree within the sign (0-30) */
  degree_in_sign: number
  /** Minute within the degree (0-60) */
  minute_in_degree: number
  /** Decan number (1-3) */
  decan: number
  /** Planetary ruler of the decan */
  decan_ruler: string
}

export interface SolarPosition {
  /** Ecliptic longitude in degrees */
  longitude: number
  /** Ecliptic latitude (should be ~0 for Sun) */
  latitude: number
  /** Distance from Earth in AU */
  distance: number
  /** Daily motion in degrees per day */
  speed: number
  /** Equation of time in minutes */
  equation_of_time: number
  /** Solar declination in degrees */
  declination: number
  /** Right ascension in degrees */
  right_ascension: number
}

export interface DateRange {
  /** Start date/time of the range */
  start: Date
  /** End date/time of the range */
  end: Date
  /** Duration in hours */
  duration_hours: number
}

// Calendar and Mapping Types
export interface DegreeMapEntry {
  /** Zodiac degree (0-359) */
  degree: number
  /** Zodiac sign name */
  sign: string
  /** Degree within sign (0-30) */
  signDegree: number
  /** Decan number (1-3) */
  decan: number
  /** Date range when Sun is at this degree */
  dateRange: DateRange
  /** Associated keywords or Sabian symbols */
  keywords: string[]
}

export interface SignPeriod {
  /** Zodiac sign name */
  sign: string
  /** When the sign period starts */
  startDate: Date
  /** When the sign period ends */
  endDate: Date
  /** Duration in days */
  durationDays: number
  /** Decan periods within the sign */
  decans: {
    first: DateRange
    second: DateRange
    third: DateRange
  }
}

export interface AnnualZodiacCalendar {
  /** Calendar year */
  year: number
  /** Spring equinox date */
  springEquinox: Date
  /** Summer solstice date */
  summerSolstice: Date
  /** Autumn equinox date */
  autumnEquinox: Date
  /** Winter solstice date */
  winterSolstice: Date
  /** All 12 sign periods for the year */
  signPeriods: SignPeriod[]
  /** Complete degree mapping (0-359) */
  degreeMap: Map<number, DegreeMapEntry>
}

// API Response Types
export interface ZodiacCalendarApiResponse {
  /** API action performed */
  action: string
  /** Response data (varies by action) */
  data: unknown
  /** Timestamp of calculation */
  timestamp: string
}

export interface DegreeForDateResponse {
  /** Input date */
  date: string
  /** Zodiac position information */
  zodiac: ZodiacPosition
  /** Detailed degree information */
  degreeInfo: DegreeMapEntry
  /** Solar position data */
  solar: {
    longitude: number
    distance: number
    speed: number
    equation_of_time: number
    declination: number
  }
}

export interface DatesForDegreeResponse {
  /** Target degree */
  degree: number
  /** Target year */
  year: number
  /** Zodiac sign at this degree */
  sign: string
  /** Degree within the sign */
  signDegree: number
  /** Date range for this degree */
  dateRange: DateRange
  /** Human-readable description */
  description: string
}

export interface YearMapResponse {
  /** Calendar year */
  year: number
  /** Cardinal points (equinoxes/solstices) */
  equinoxes_solstices: {
    spring_equinox: Date
    summer_solstice: Date
    autumn_equinox: Date
    winter_solstice: Date
  }
  /** Sign ingress dates */
  sign_ingresses: Record<string, Date>
  /** Sign durations in days */
  sign_durations: Record<string, number>
  /** Complete sign periods */
  sign_periods: SignPeriod[]
  /** Total number of degree mappings */
  total_degrees: number
  /** Sample cardinal degrees for preview */
  sample_degrees: DegreeMapEntry[]
}

export interface CurrentPeriodResponse {
  /** Current timestamp */
  current_time: string
  /** Current zodiac position */
  zodiac_position: ZodiacPosition
  /** Current sign period */
  current_period: SignPeriod | null
  /** Next sign ingress information */
  next_ingress: {
    sign: string
    days: number
    date: Date
  }
  /** Current decan */
  current_decan: number
  /** Current decan ruler */
  decan_ruler: string
}

export interface MonthlyCalendarResponse {
  /** Calendar year */
  year: number
  /** Month name */
  month: string
  /** Daily zodiac information */
  days: Array<{
    date: number
    zodiacDegree: number
    sign: string
    signDegree: number
    decan: number
    isIngress: boolean
    isCardinal: boolean
  }>
  /** Days with sign ingresses */
  ingress_days: Array<{
    date: number
    zodiacDegree: number
    sign: string
    signDegree: number
    decan: number
    isIngress: boolean
    isCardinal: boolean
  }>
  /** Days with cardinal points */
  cardinal_days: Array<{
    date: number
    zodiacDegree: number
    sign: string
    signDegree: number
    decan: number
    isIngress: boolean
    isCardinal: boolean
  }>
}

export interface CompareAccuracyResponse {
  /** Input date for comparison */
  date: string
  /** Old calculation method results */
  old_calculation: {
    sign: string
    degree: number
    absolute: number
    method: string
  }
  /** New calculation method results */
  new_calculation: {
    sign: string
    degree: number
    absolute: number
    method: string
  }
  /** Accuracy improvement metrics */
  accuracy_improvement: {
    degree_difference: number
    improvement_factor: string
    sun_distance: string
    sun_speed: string
    equation_of_time: string
  }
}

// Integration Types
export interface ZodiacIntegrationConfig {
  /** Enable high-precision calculations */
  useHighPrecision: boolean
  /** Cache calendar data */
  enableCaching: boolean
  /** Fallback to approximations on error */
  enableFallback: boolean
  /** Log calculation details */
  enableLogging: boolean
}

export interface PlatformIntegration {
  /** Birth chart system integration */
  birthCharts: {
    useEnhancedCalculator: boolean
    precision: 'low' | 'medium' | 'high'
    includeDecanRulers: boolean
  }
  /** Tarot system integration */
  tarot: {
    useExactDecanBoundaries: boolean
    includePlanetaryHours: boolean
    useSeasonalTiming: boolean
  }
  /** Agent system integration */
  agents: {
    useRealTimePositions: boolean
    updateFrequency: 'hourly' | 'daily' | 'weekly'
    includeTransitData: boolean
  }
  /** API system integration */
  api: {
    enableAllEndpoints: boolean
    rateLimiting: boolean
    cacheResponses: boolean
    compressionEnabled: boolean
  }
}

// Error Types
export interface ZodiacCalculationError extends Error {
  code: 'INVALID_DATE' | 'CALCULATION_FAILED' | 'CACHE_ERROR' | 'API_ERROR'
  details: {
    input: unknown
    timestamp: string
    method: string
  }
}

// Utility Types
export type ZodiacSign =
  | 'Aries'
  | 'Taurus'
  | 'Gemini'
  | 'Cancer'
  | 'Leo'
  | 'Virgo'
  | 'Libra'
  | 'Scorpio'
  | 'Sagittarius'
  | 'Capricorn'
  | 'Aquarius'
  | 'Pisces'

export type DecanRuler =
  | 'Mars'
  | 'Sun'
  | 'Jupiter'
  | 'Venus'
  | 'Mercury'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'
  | 'Pluto'
  | 'Moon'

export type CardinalPoint =
  | 'spring_equinox'
  | 'summer_solstice'
  | 'autumn_equinox'
  | 'winter_solstice'

export type ZodiacApiAction =
  | 'degree-for-date'
  | 'dates-for-degree'
  | 'year-map'
  | 'current-period'
  | 'monthly-calendar'
  | 'compare-accuracy'

// Function Type Definitions
export interface ZodiacCalculationFunctions {
  /** Get zodiac position for a specific date */
  getZodiacPositionForDate: (date: Date) => ZodiacPosition

  /** Calculate solar position with high precision */
  calculateSolarPosition: (date: Date) => SolarPosition

  /** Get date ranges for a specific zodiac degree */
  getDatesForZodiacDegree: (degree: number, year: number) => DateRange

  /** Get cardinal points for a year */
  getCardinalPoints: (year: number) => Record<CardinalPoint, Date>

  /** Get sign durations for a year */
  getSignDurations: (year: number) => Record<ZodiacSign, number>

  /** Build complete annual calendar */
  buildAnnualCalendar: (year: number) => AnnualZodiacCalendar

  /** Get current zodiac period */
  getCurrentZodiacPeriod: () => SignPeriod | null

  /** Get days until next ingress */
  daysUntilNextIngress: () => {
    sign: string
    days: number
    date: Date
  }

  /** Get monthly zodiac calendar */
  getMonthlyZodiacCalendar: (year: number, month: number) => MonthlyCalendarResponse
}

// Export all types for use across the platform
export * from './zodiac-accuracy'

// Global type augmentation for enhanced accuracy
declare global {
  namespace PlanetaryAgents {
    interface ZodiacSystem {
      accuracy: 'enhanced'
      precision: number
      method: 'vsop87'
      features: {
        decanRulers: true
        variableSignDurations: true
        exactCardinalPoints: true
        realTimeCalculations: true
        caching: true
        apiIntegration: true
      }
    }
  }
}
