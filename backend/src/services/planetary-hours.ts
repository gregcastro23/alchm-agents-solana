import { logger } from '../utils/logger.js'
import { cacheService } from './cache.js'

export interface Location {
  lat: number
  lon: number
}

export interface PlanetaryHourInfo {
  planet: string
  dayType: 'day' | 'night'
  hourIndex: number
  startTime: Date
  endTime: Date
  nextTransition: Date
  modifiers: {
    [key: string]: number
  }
}

export interface PlanetaryForecast {
  datetime: Date
  planetaryHour: PlanetaryHourInfo
  influence: {
    spirit: number
    essence: number
    matter: number
    substance: number
    fire: number
    water: number
    air: number
    earth: number
  }
}

// Traditional planetary hour sequence
export const PLANETARY_HOURS = {
  Sunday: ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'],
  Monday: ['Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury'],
  Tuesday: ['Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter'],
  Wednesday: ['Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus'],
  Thursday: ['Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn'],
  Friday: ['Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun'],
  Saturday: ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'],
} as const

// Planetary modifiers for alchemical calculations
export const PLANETARY_MODIFIERS = {
  Sun: { Spirit: 0.3, Fire: 0.2, essence: 0.1 },
  Moon: { Essence: 0.3, Water: 0.2, matter: 0.1 },
  Mercury: { Spirit: 0.2, Air: 0.3, substance: 0.1 },
  Venus: { Essence: 0.2, Water: 0.2, Earth: 0.2 },
  Mars: { Matter: 0.3, Fire: 0.2, spirit: 0.1 },
  Jupiter: { Spirit: 0.2, Air: 0.2, essence: 0.2 },
  Saturn: { Matter: 0.3, Earth: 0.2, substance: 0.1 },
} as const

// Simple repeating sequence helper for legacy/simple paths
export const PLANETARY_HOUR_SEQUENCE = [
  'Sun',
  'Venus',
  'Mercury',
  'Moon',
  'Saturn',
  'Jupiter',
  'Mars',
] as const

class PlanetaryHoursService {
  /**
   * Calculate sunrise and sunset times for a given location and date
   * Using simplified solar calculations
   */
  private calculateSunTimes(date: Date, location: Location): { sunrise: Date; sunset: Date } {
    const dayOfYear = this.getDayOfYear(date)
    const lat = (location.lat * Math.PI) / 180 // Convert to radians

    // Solar declination
    const declination =
      (23.45 * Math.sin((((360 * (284 + dayOfYear)) / 365) * Math.PI) / 180) * Math.PI) / 180

    // Calculate cosine of hour angle
    const cosHourAngle = -Math.tan(lat) * Math.tan(declination)

    // Handle polar regions (midnight sun / polar night)
    let hourAngle: number
    if (cosHourAngle > 1) {
      // Polar night - sun never rises, use arbitrary 12-hour "night"
      const midnight = new Date(date)
      midnight.setHours(0, 0, 0, 0)
      return {
        sunrise: midnight,
        sunset: midnight,
      }
    } else if (cosHourAngle < -1) {
      // Midnight sun - sun never sets, use full 24-hour "day"
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)
      return {
        sunrise: startOfDay,
        sunset: endOfDay,
      }
    } else {
      hourAngle = Math.acos(cosHourAngle)
    }

    // Solar noon in decimal hours
    const solarNoon = 12 - location.lon / 15

    // Sunrise and sunset in decimal hours
    const sunriseHour = solarNoon - (hourAngle * 12) / Math.PI
    const sunsetHour = solarNoon + (hourAngle * 12) / Math.PI

    // Convert to Date objects
    const sunrise = new Date(date)
    sunrise.setHours(Math.floor(sunriseHour), (sunriseHour % 1) * 60, 0, 0)

    const sunset = new Date(date)
    sunset.setHours(Math.floor(sunsetHour), (sunsetHour % 1) * 60, 0, 0)

    return { sunrise, sunset }
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0)
    const diff = date.getTime() - start.getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  /**
   * Get the current planetary hour for a given time and location
   */
  async getCurrentPlanetaryHour(
    datetime: Date = new Date(),
    location: Location
  ): Promise<PlanetaryHourInfo> {
    const cacheKey = `planetary-hour:${datetime.toDateString()}:${location.lat}:${location.lon}:${datetime.getHours()}`

    try {
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        logger.debug('Returning cached planetary hour')
        return cached as PlanetaryHourInfo
      }
    } catch (error) {
      logger.warn('Cache check failed for planetary hour:', error)
    }

    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ] as const
    const dayName = dayNames[datetime.getDay()]

    const { sunrise, sunset } = this.calculateSunTimes(datetime, location)

    // Determine if it's day or night
    const isDaytime = datetime >= sunrise && datetime < sunset

    let hourIndex: number
    let startTime: Date
    let endTime: Date

    if (isDaytime) {
      // Daytime: divide daylight into 12 planetary hours
      const dayLength = sunset.getTime() - sunrise.getTime()
      const planetaryHourLength = dayLength / 12
      const timeSinceSunrise = datetime.getTime() - sunrise.getTime()

      hourIndex = Math.floor(timeSinceSunrise / planetaryHourLength)
      if (hourIndex >= 12) hourIndex = 11 // Cap at last hour

      startTime = new Date(sunrise.getTime() + hourIndex * planetaryHourLength)
      endTime = new Date(sunrise.getTime() + (hourIndex + 1) * planetaryHourLength)
    } else {
      // Nighttime: divide night into 12 planetary hours
      const previousSunset =
        datetime < sunrise ? new Date(sunset.getTime() - 24 * 60 * 60 * 1000) : sunset
      const nextSunrise =
        datetime >= sunset ? new Date(sunrise.getTime() + 24 * 60 * 60 * 1000) : sunrise

      const nightLength = nextSunrise.getTime() - previousSunset.getTime()
      const planetaryHourLength = nightLength / 12
      const timeSinceSunset = datetime.getTime() - previousSunset.getTime()

      hourIndex = Math.floor(timeSinceSunset / planetaryHourLength) + 12 // Offset for night hours
      if (hourIndex >= 24) hourIndex = 23 // Cap at last hour

      const nightHourIndex = hourIndex - 12
      startTime = new Date(previousSunset.getTime() + nightHourIndex * planetaryHourLength)
      endTime = new Date(previousSunset.getTime() + (nightHourIndex + 1) * planetaryHourLength)
    }

    // Get the ruling planet
    const planetIndex = hourIndex % 7
    const planet = PLANETARY_HOURS[dayName][planetIndex]

    // Calculate next transition
    const nextTransition = endTime

    // Get modifiers for this planet
    const modifiers = PLANETARY_MODIFIERS[planet as keyof typeof PLANETARY_MODIFIERS] || {}

    const result: PlanetaryHourInfo = {
      planet,
      dayType: isDaytime ? 'day' : 'night',
      hourIndex,
      startTime,
      endTime,
      nextTransition,
      modifiers,
    }

    // Cache for 1 hour
    try {
      await cacheService.set(cacheKey, result, 3600)
    } catch (error) {
      logger.warn('Failed to cache planetary hour:', error)
    }

    return result
  }

  /**
   * Get planetary hour forecast for a date range
   */
  async getForecast(
    startDate: Date,
    endDate: Date,
    location: Location,
    intervalMinutes: number = 60
  ): Promise<PlanetaryForecast[]> {
    const cacheKey = `planetary-forecast:${startDate.toISOString()}:${endDate.toISOString()}:${location.lat}:${location.lon}:${intervalMinutes}`

    try {
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        logger.debug('Returning cached planetary forecast')
        return cached as PlanetaryForecast[]
      }
    } catch (error) {
      logger.warn('Cache check failed for planetary forecast:', error)
    }

    const forecast: PlanetaryForecast[] = []
    const current = new Date(startDate)

    while (current <= endDate) {
      const planetaryHour = await this.getCurrentPlanetaryHour(current, location)

      // Calculate planetary influence on alchemical properties
      const influence = this.calculatePlanetaryInfluence(planetaryHour)

      forecast.push({
        datetime: new Date(current),
        planetaryHour,
        influence,
      })

      current.setMinutes(current.getMinutes() + intervalMinutes)
    }

    // Cache forecast for 30 minutes
    try {
      await cacheService.set(cacheKey, forecast, 1800)
    } catch (error) {
      logger.warn('Failed to cache planetary forecast:', error)
    }

    return forecast
  }

  /**
   * Calculate how planetary hours influence alchemical properties
   */
  private calculatePlanetaryInfluence(planetaryHour: PlanetaryHourInfo) {
    const baseInfluence = {
      spirit: 1.0,
      essence: 1.0,
      matter: 1.0,
      substance: 1.0,
      fire: 1.0,
      water: 1.0,
      air: 1.0,
      earth: 1.0,
    }

    // Apply planetary modifiers
    const modifiers = planetaryHour.modifiers

    return {
      spirit: baseInfluence.spirit * (1 + (modifiers.Spirit || modifiers.spirit || 0)),
      essence: baseInfluence.essence * (1 + (modifiers.Essence || modifiers.essence || 0)),
      matter: baseInfluence.matter * (1 + (modifiers.Matter || modifiers.matter || 0)),
      substance: baseInfluence.substance * (1 + (modifiers.Substance || modifiers.substance || 0)),
      fire: baseInfluence.fire * (1 + (modifiers.Fire || modifiers.fire || 0)),
      water: baseInfluence.water * (1 + (modifiers.Water || modifiers.water || 0)),
      air: baseInfluence.air * (1 + (modifiers.Air || modifiers.air || 0)),
      earth: baseInfluence.earth * (1 + (modifiers.Earth || modifiers.earth || 0)),
    }
  }

  /**
   * Get optimal times for specific planetary influences
   */
  async getOptimalTimes(
    date: Date,
    location: Location,
    targetPlanet: string
  ): Promise<PlanetaryHourInfo[]> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const forecast = await this.getForecast(startOfDay, endOfDay, location, 60)

    return forecast
      .filter(f => f.planetaryHour.planet === targetPlanet)
      .map(f => ({
        ...f.planetaryHour,
        startTime: new Date(f.planetaryHour.startTime),
        endTime: new Date(f.planetaryHour.endTime),
        nextTransition: new Date(f.planetaryHour.nextTransition),
      }))
  }
}

// Singleton instance
export const planetaryHoursService = new PlanetaryHoursService()
export default planetaryHoursService
