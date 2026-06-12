/**
 * Planetary Motion Tracker
 *
 * Tracks planetary velocities and predicts future positions for dynamic aspect analysis.
 * Uses traditional astrological daily motion rates enhanced with real-time calculations.
 */

export interface PlanetaryMotion {
  planet: string
  currentPosition: number // degrees (0-360)
  dailyMotion: number // degrees per day
  velocity: number // current speed relative to average
  retrograde: boolean
  motionTrend: 'accelerating' | 'decelerating' | 'stable'
  lastUpdated: Date
}

export interface PlanetaryVelocityProfile {
  planet: string
  averageDailyMotion: number
  maxDailyMotion: number
  minDailyMotion: number
  retrogradeFrequency: number // times per year
  stationaryOrbDuration: number // days near stationary
}

// Traditional astrological daily motion rates (degrees per day)
const PLANETARY_VELOCITY_PROFILES: Record<string, PlanetaryVelocityProfile> = {
  Sun: {
    planet: 'Sun',
    averageDailyMotion: 0.9856, // ~59 arcminutes
    maxDailyMotion: 1.0192, // perihelion
    minDailyMotion: 0.9529, // aphelion
    retrogradeFrequency: 0, // never retrograde
    stationaryOrbDuration: 0,
  },
  Moon: {
    planet: 'Moon',
    averageDailyMotion: 13.1764, // ~13° 11'
    maxDailyMotion: 15.4085, // perigee
    minDailyMotion: 11.9603, // apogee
    retrogradeFrequency: 0, // never retrograde
    stationaryOrbDuration: 0,
  },
  Mercury: {
    planet: 'Mercury',
    averageDailyMotion: 1.383, // ~1° 23'
    maxDailyMotion: 2.2, // elongation
    minDailyMotion: -1.4, // retrograde
    retrogradeFrequency: 3, // ~3 times per year
    stationaryOrbDuration: 3, // ~3 days stationary
  },
  Venus: {
    planet: 'Venus',
    averageDailyMotion: 1.2021, // ~1° 12'
    maxDailyMotion: 1.27, // elongation
    minDailyMotion: -0.7, // retrograde
    retrogradeFrequency: 0.625, // ~19 months
    stationaryOrbDuration: 5, // ~5 days stationary
  },
  Mars: {
    planet: 'Mars',
    averageDailyMotion: 0.524, // ~31'
    maxDailyMotion: 0.8, // opposition approach
    minDailyMotion: -0.5, // retrograde
    retrogradeFrequency: 1, // ~26 months
    stationaryOrbDuration: 7, // ~7 days stationary
  },
  Jupiter: {
    planet: 'Jupiter',
    averageDailyMotion: 0.0831, // ~5'
    maxDailyMotion: 0.25, // fastest direct
    minDailyMotion: -0.1, // retrograde
    retrogradeFrequency: 1, // ~13 months
    stationaryOrbDuration: 10, // ~10 days stationary
  },
  Saturn: {
    planet: 'Saturn',
    averageDailyMotion: 0.0335, // ~2'
    maxDailyMotion: 0.13, // fastest direct
    minDailyMotion: -0.05, // retrograde
    retrogradeFrequency: 1, // ~12.5 months
    stationaryOrbDuration: 12, // ~12 days stationary
  },
  Uranus: {
    planet: 'Uranus',
    averageDailyMotion: 0.0117, // ~42"
    maxDailyMotion: 0.06, // fastest direct
    minDailyMotion: -0.02, // retrograde
    retrogradeFrequency: 1, // ~12 months
    stationaryOrbDuration: 15, // ~15 days stationary
  },
  Neptune: {
    planet: 'Neptune',
    averageDailyMotion: 0.006, // ~22"
    maxDailyMotion: 0.03, // fastest direct
    minDailyMotion: -0.01, // retrograde
    retrogradeFrequency: 1, // ~12 months
    stationaryOrbDuration: 17, // ~17 days stationary
  },
  Pluto: {
    planet: 'Pluto',
    averageDailyMotion: 0.0039, // ~14"
    maxDailyMotion: 0.025, // fastest direct
    minDailyMotion: -0.008, // retrograde
    retrogradeFrequency: 1, // ~12 months
    stationaryOrbDuration: 20, // ~20 days stationary
  },
}

export class PlanetaryMotionTracker {
  private motionCache: Map<string, { data: PlanetaryMotion; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 1800000 // 30 minutes for most planets
  private readonly MOON_CACHE_TTL = 300000 // 5 minutes for Moon
  private readonly SUN_CACHE_TTL = 3600000 // 1 hour for Sun

  /**
   * Calculate current daily motion for a planet at a given date
   */
  async calculateDailyMotion(planet: string, date: Date): Promise<number> {
    const profile = PLANETARY_VELOCITY_PROFILES[planet]
    if (!profile) {
      throw new Error(`Unknown planet: ${planet}`)
    }

    // For now, use average motion with orbital variation
    // In production, this would integrate with astronomical APIs
    const orbitalPhase = this.calculateOrbitalPhase(planet, date)
    const seasonalVariation = this.calculateSeasonalVariation(planet, orbitalPhase)

    return profile.averageDailyMotion * seasonalVariation
  }

  /**
   * Predict planetary position at a future date
   */
  async predictPosition(
    planet: string,
    currentPosition: number,
    targetDate: Date,
    currentDate: Date = new Date()
  ): Promise<number> {
    const daysDiff = (targetDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    const dailyMotion = await this.calculateDailyMotion(planet, currentDate)

    // Account for retrograde periods
    const retrogradeAdjustment = this.calculateRetrogradeAdjustment(planet, currentDate, daysDiff)
    const totalMotion = dailyMotion * daysDiff * retrogradeAdjustment

    // Normalize to 0-360 range
    let predictedPosition = currentPosition + totalMotion
    while (predictedPosition < 0) predictedPosition += 360
    while (predictedPosition >= 360) predictedPosition -= 360

    return predictedPosition
  }

  /**
   * Get velocity profile for a planet over a date range
   */
  async getVelocityProfile(
    planet: string,
    daysRange: number,
    startDate: Date = new Date()
  ): Promise<number[]> {
    const profile: number[] = []

    for (let i = 0; i < daysRange; i++) {
      const checkDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
      const velocity = await this.calculateDailyMotion(planet, checkDate)
      profile.push(velocity)
    }

    return profile
  }

  /**
   * Get comprehensive planetary motion data
   */
  async getPlanetaryMotion(
    planet: string,
    currentPosition: number,
    date: Date = new Date()
  ): Promise<PlanetaryMotion> {
    const cacheKey = `${planet}-${date.toISOString().split('T')[0]}`
    const ttl = this.getCacheTTL(planet)
    const cached = this.motionCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data
    }

    const dailyMotion = await this.calculateDailyMotion(planet, date)
    const profile = PLANETARY_VELOCITY_PROFILES[planet]

    // Calculate velocity relative to average
    const velocity = Math.abs(dailyMotion) / profile.averageDailyMotion

    // Determine if retrograde
    const retrograde = dailyMotion < 0

    // Calculate motion trend
    const motionTrend = await this.calculateMotionTrend(planet, date)

    const motion: PlanetaryMotion = {
      planet,
      currentPosition,
      dailyMotion,
      velocity,
      retrograde,
      motionTrend,
      lastUpdated: date,
    }

    // Cache the result
    this.motionCache.set(cacheKey, { data: motion, timestamp: Date.now() })

    return motion
  }

  /**
   * Calculate the separation velocity between two planets
   * Positive = separating, Negative = applying
   */
  async calculateSeparationVelocity(
    planet1: string,
    position1: number,
    planet2: string,
    position2: number,
    aspectAngle: number = 0,
    date: Date = new Date()
  ): Promise<number> {
    const motion1 = await this.getPlanetaryMotion(planet1, position1, date)
    const motion2 = await this.getPlanetaryMotion(planet2, position2, date)

    // Calculate current angular separation
    let currentSeparation = Math.abs(position1 - position2)
    if (currentSeparation > 180) {
      currentSeparation = 360 - currentSeparation
    }

    // Calculate how this separation will change
    // Faster planet "catches up" to slower planet
    const relativeVelocity = motion1.dailyMotion - motion2.dailyMotion

    // Determine if the aspect is forming (applying) or separating
    const targetSeparation = Math.abs(aspectAngle)
    const currentOrbFromExact = Math.abs(currentSeparation - targetSeparation)

    // Project one day ahead to see if orb is tightening or widening
    const futurePosition1 = await this.predictPosition(
      planet1,
      position1,
      new Date(date.getTime() + 24 * 60 * 60 * 1000),
      date
    )
    const futurePosition2 = await this.predictPosition(
      planet2,
      position2,
      new Date(date.getTime() + 24 * 60 * 60 * 1000),
      date
    )

    let futureSeparation = Math.abs(futurePosition1 - futurePosition2)
    if (futureSeparation > 180) {
      futureSeparation = 360 - futureSeparation
    }

    const futureOrbFromExact = Math.abs(futureSeparation - targetSeparation)

    // Velocity of orb change (negative = applying, positive = separating)
    return futureOrbFromExact - currentOrbFromExact
  }

  /**
   * Predict when an aspect will be exact
   */
  async predictExactAspectTiming(
    planet1: string,
    position1: number,
    planet2: string,
    position2: number,
    aspectAngle: number,
    maxDays: number = 90,
    date: Date = new Date()
  ): Promise<{ date: Date; orb: number } | null> {
    const separationVelocity = await this.calculateSeparationVelocity(
      planet1,
      position1,
      planet2,
      position2,
      aspectAngle,
      date
    )

    // If separating, aspect won't become exact
    if (separationVelocity > 0) {
      return null
    }

    // Calculate current orb
    let currentSeparation = Math.abs(position1 - position2)
    if (currentSeparation > 180) {
      currentSeparation = 360 - currentSeparation
    }
    const currentOrb = Math.abs(currentSeparation - Math.abs(aspectAngle))

    // Estimate days to exact using separation velocity
    const daysToExact = Math.abs(currentOrb / separationVelocity)

    if (daysToExact > maxDays) {
      return null
    }

    const exactDate = new Date(date.getTime() + daysToExact * 24 * 60 * 60 * 1000)

    return {
      date: exactDate,
      orb: 0, // Will be exact
    }
  }

  private getCacheTTL(planet: string): number {
    switch (planet) {
      case 'Moon':
        return this.MOON_CACHE_TTL
      case 'Sun':
        return this.SUN_CACHE_TTL
      default:
        return this.CACHE_TTL
    }
  }

  private calculateOrbitalPhase(planet: string, date: Date): number {
    // Simplified orbital phase calculation
    const dayOfYear = this.getDayOfYear(date)
    return (dayOfYear / 365.25) * 2 * Math.PI
  }

  private calculateSeasonalVariation(planet: string, orbitalPhase: number): number {
    // Planets move faster at perihelion, slower at aphelion
    const profile = PLANETARY_VELOCITY_PROFILES[planet]
    const eccentricity = this.getOrbitalEccentricity(planet)

    // Simplified seasonal variation based on orbital mechanics
    const variation = 1 + eccentricity * Math.cos(orbitalPhase)
    return Math.max(0.1, Math.min(2.0, variation))
  }

  private calculateRetrogradeAdjustment(planet: string, date: Date, daysDiff: number): number {
    const profile = PLANETARY_VELOCITY_PROFILES[planet]
    if (profile.retrogradeFrequency === 0) return 1.0

    // Simplified retrograde calculation
    // In production, this would use accurate retrograde ephemeris
    const retrogradePhase = this.calculateRetrogradePhase(planet, date)

    if (retrogradePhase > 0.4 && retrogradePhase < 0.6) {
      return -0.5 // Retrograde motion
    }

    return 1.0 // Direct motion
  }

  private calculateRetrogradePhase(planet: string, date: Date): number {
    // Simplified retrograde phase calculation
    const profile = PLANETARY_VELOCITY_PROFILES[planet]
    const daysSinceEpoch =
      (date.getTime() - new Date('2000-01-01').getTime()) / (1000 * 60 * 60 * 24)
    const cycleDays = 365.25 / profile.retrogradeFrequency

    return (daysSinceEpoch % cycleDays) / cycleDays
  }

  private async calculateMotionTrend(
    planet: string,
    date: Date
  ): Promise<'accelerating' | 'decelerating' | 'stable'> {
    // Compare velocity over a 3-day window
    const prevDate = new Date(date.getTime() - 3 * 24 * 60 * 60 * 1000)
    const nextDate = new Date(date.getTime() + 3 * 24 * 60 * 60 * 1000)

    const prevMotion = await this.calculateDailyMotion(planet, prevDate)
    const currentMotion = await this.calculateDailyMotion(planet, date)
    const nextMotion = await this.calculateDailyMotion(planet, nextDate)

    const trend = (nextMotion - prevMotion) / 6 // 6-day span

    if (trend > 0.01) return 'accelerating'
    if (trend < -0.01) return 'decelerating'
    return 'stable'
  }

  private getOrbitalEccentricity(planet: string): number {
    const eccentricities: Record<string, number> = {
      Sun: 0.0167, // Earth's orbit
      Moon: 0.0549, // Moon's orbit around Earth
      Mercury: 0.2056,
      Venus: 0.0067,
      Mars: 0.0934,
      Jupiter: 0.0489,
      Saturn: 0.0565,
      Uranus: 0.0463,
      Neptune: 0.0095,
      Pluto: 0.2488,
    }
    return eccentricities[planet] || 0.05
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0)
    const diff = date.getTime() - start.getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  /**
   * Clear motion cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.motionCache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; oldestEntry: number; newestEntry: number } {
    const timestamps = Array.from(this.motionCache.values()).map(v => v.timestamp)
    return {
      size: this.motionCache.size,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    }
  }
}

// Singleton instance
export const planetaryMotionTracker = new PlanetaryMotionTracker()

// Convenience functions
export async function calculatePlanetaryVelocity(
  planet: string,
  position: number,
  date: Date = new Date()
): Promise<PlanetaryMotion> {
  return planetaryMotionTracker.getPlanetaryMotion(planet, position, date)
}

export async function predictPlanetaryPosition(
  planet: string,
  currentPosition: number,
  targetDate: Date,
  currentDate: Date = new Date()
): Promise<number> {
  return planetaryMotionTracker.predictPosition(planet, currentPosition, targetDate, currentDate)
}

export async function calculateAspectSeparationRate(
  planet1: string,
  position1: number,
  planet2: string,
  position2: number,
  aspectAngle: number = 0,
  date: Date = new Date()
): Promise<number> {
  return planetaryMotionTracker.calculateSeparationVelocity(
    planet1,
    position1,
    planet2,
    position2,
    aspectAngle,
    date
  )
}
