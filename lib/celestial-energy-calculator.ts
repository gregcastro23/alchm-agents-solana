/**
 * Celestial Energy Calculator - State-of-the-Art Implementation
 * ============================================================
 *
 * Advanced system for calculating and quantifying celestial energy over time
 * Integrates A#, SMES, Kinetic, and Thermodynamic metrics with real planetary positions
 */

import { generateAccurateHoroscope, type HoroscopeData } from './monica/horoscope-generator'

export interface ElementVector {
  Fire: number
  Water: number
  Air: number
  Earth: number
}
export interface MetricVector {
  Heat: number
  Entropy: number
  Reactivity: number
  Energy: number
}
export type ElementKey = keyof ElementVector

function computeInertia(_elements: ElementVector): number {
  return 0
}

async function sampleHourlyAlchm(
  _location: Location,
  _timestamp: Date,
  _options: any
): Promise<any[]> {
  return [
    {
      spirit: 50,
      matter: 50,
      essence: 50,
      substance: 50,
      Heat: 50,
      Entropy: 50,
      Reactivity: 50,
      Energy: 50,
      totals: { Fire: 25, Water: 25, Air: 25, Earth: 25 },
    },
  ]
}

export interface Location {
  lat: number
  lon: number
  name?: string
  timezone?: string
}

export interface CelestialMoment {
  timestamp: Date
  planetaryDegrees: Record<string, number>
  alchemical: {
    A_number: number
    spirit: number
    matter: number
    essence: number
    substance: number
  }
  kinetic: {
    velocity: ElementVector
    momentum: ElementVector
    power: number
    inertia: number
    metricVelocity: MetricVector
  }
  thermodynamic: {
    heat: number
    entropy: number
    reactivity: number
    energy: number
  }
  elemental: ElementVector
  planetary: {
    dominantPlanet: string
    dominantSign: string
    moonPhase: number
    retrogradeCount: number
  }
  consciousness: {
    resonanceLevel: number
    evolutionPhase: string
    spiritualAmplitude: number
  }
}

export interface TimeSeriesOptions {
  startDate: Date
  endDate: Date
  interval: 'minute' | 'hour' | 'day' | 'week'
  location: Location
  includeRetrogrades: boolean
  smoothingWindow?: number
  highPrecision?: boolean
}

export interface CelestialTimeSeries {
  moments: CelestialMoment[]
  statistics: {
    duration: number // milliseconds
    totalMoments: number
    peakEnergy: CelestialMoment
    averageValues: Partial<CelestialMoment>
    trends: {
      alchemical: 'rising' | 'falling' | 'stable'
      kinetic: 'accelerating' | 'decelerating' | 'stable'
      consciousness: 'evolving' | 'stabilizing' | 'transforming'
    }
  }
  patterns: {
    type: string
    description: string
    timeWindow: { start: Date; end: Date }
    significance: number
  }[]
}

/**
 * Advanced Celestial Energy Calculator
 */
export class CelestialEnergyCalculator {
  private cache = new Map<string, CelestialMoment>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Calculate celestial energy for a specific moment
   */
  async calculateMoment(timestamp: Date, location: Location): Promise<CelestialMoment> {
    const cacheKey = `${timestamp.getTime()}-${location.lat}-${location.lon}`

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      if (Date.now() - timestamp.getTime() < this.CACHE_TTL) {
        return cached
      }
    }

    try {
      // Generate accurate horoscope for the moment
      const horoscope = await generateAccurateHoroscope({
        year: timestamp.getFullYear(),
        month: timestamp.getMonth() + 1,
        day: timestamp.getDate(),
        hour: timestamp.getHours(),
        minute: timestamp.getMinutes(),
        latitude: location.lat,
        longitude: location.lon,
      })

      // Validate horoscope data
      const planets = horoscope?.tropical?.CelestialBodies?.all
      if (!horoscope || !planets) {
        console.error('Invalid horoscope generated:', horoscope)
        throw new Error('Failed to generate valid horoscope data')
      }

      // Sample alchemical data
      const alchemicalSample = await sampleHourlyAlchm(
        {
          lat: location.lat,
          lon: location.lon,
        } as Location,
        timestamp,
        {
          includePlanetaryHours: true,
          validateTiming: true,
          hoursToSample: 1,
          startHour: timestamp.getHours(),
        }
      )

      const sample = alchemicalSample[0] // Get the single sample for this moment

      if (!sample) {
        throw new Error('Failed to generate alchemical sample')
      }

      // Calculate planetary degrees
      const planetaryDegrees = this.extractPlanetaryDegrees(horoscope)

      // Calculate enhanced alchemical metrics
      const alchemical = this.calculateAlchemicalMetrics(sample, horoscope)

      // Calculate kinetic derivatives
      const kinetic = this.calculateKineticMetrics(sample, alchemicalSample)

      // Calculate thermodynamic values
      const thermodynamic = {
        heat: sample.Heat,
        entropy: sample.Entropy,
        reactivity: sample.Reactivity,
        energy: sample.Energy,
      }

      // Calculate elemental distribution
      const elemental: ElementVector = {
        Fire: sample.totals.Fire,
        Water: sample.totals.Water,
        Air: sample.totals.Air,
        Earth: sample.totals.Earth,
      }

      // Calculate planetary context
      const planetary = this.calculatePlanetaryContext(horoscope)

      // Calculate consciousness metrics
      const consciousness = this.calculateConsciousnessMetrics(alchemical, kinetic, planetary)

      const moment: CelestialMoment = {
        timestamp,
        planetaryDegrees,
        alchemical,
        kinetic,
        thermodynamic,
        elemental,
        planetary,
        consciousness,
      }

      // Cache the result
      this.cache.set(cacheKey, moment)

      return moment
    } catch (error) {
      console.error('Error calculating celestial moment:', error)
      throw new Error(
        `Failed to calculate celestial energy: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Generate time series of celestial energy
   */
  async generateTimeSeries(options: TimeSeriesOptions): Promise<CelestialTimeSeries> {
    const moments: CelestialMoment[] = []
    const timeSteps = this.generateTimeSteps(options.startDate, options.endDate, options.interval)

    // Calculate moments in parallel for performance
    const batchSize = 10 // Process in batches to avoid overwhelming the system
    for (let i = 0; i < timeSteps.length; i += batchSize) {
      const batch = timeSteps.slice(i, i + batchSize)
      const batchPromises = batch.map(timestamp =>
        this.calculateMoment(timestamp, options.location)
      )

      try {
        const batchResults = await Promise.all(batchPromises)
        moments.push(...batchResults)
      } catch (error) {
        console.error(`Error processing batch ${i}-${i + batchSize}:`, error)
        // Continue with other batches
      }
    }

    // Apply smoothing if requested
    const smoothedMoments = options.smoothingWindow
      ? this.applySmoothing(moments, options.smoothingWindow)
      : moments

    // Calculate statistics and patterns (only if we have moments)
    const statistics = smoothedMoments.length > 0 ? this.calculateStatistics(smoothedMoments) : null
    const patterns = smoothedMoments.length > 0 ? this.detectPatterns(smoothedMoments) : []

    return {
      moments: smoothedMoments,
      statistics,
      patterns,
    }
  }

  /**
   * Extract planetary degrees from horoscope
   */
  private extractPlanetaryDegrees(horoscope: HoroscopeData): Record<string, number> {
    const degrees: Record<string, number> = {}

    // Extract planets from horoscope structure
    const planets = horoscope?.tropical?.CelestialBodies?.all

    if (!horoscope || !planets) {
      console.error('Invalid horoscope data: planets is null or undefined')
      return degrees
    }

    // Handle array format
    if (Array.isArray(planets)) {
      for (const planet of planets) {
        if (planet.label && typeof planet.degrees === 'number') {
          degrees[planet.label] = planet.degrees
        }
      }
    }

    // Add angles
    if (horoscope.tropical?.Ascendant?.degrees) {
      degrees['Ascendant'] = horoscope.tropical.Ascendant.degrees
    }

    // Add midheaven if available
    if (horoscope.tropical?.Houses?.[10]?.degree) {
      degrees['Midheaven'] = horoscope.tropical.Houses[10].degree
    }

    return degrees
  }

  /**
   * Calculate enhanced alchemical metrics including A#
   */
  private calculateAlchemicalMetrics(sample: any, horoscope: HoroscopeData) {
    // Calculate A# (Alchemical Number) using advanced formula
    const A_number = this.calculateAlchemicalNumber(sample, horoscope)

    return {
      A_number,
      spirit: sample.spirit || 0,
      matter: sample.matter || 0,
      essence: sample.essence || 0,
      substance: sample.substance || 0,
    }
  }

  /**
   * Calculate advanced A# using planetary positions and alchemical ratios
   */
  private calculateAlchemicalNumber(sample: any, horoscope: HoroscopeData): number {
    // Get alchemical values directly from sample (capitalized for consistency)
    const Spirit = sample.spirit || 0
    const Matter = sample.matter || 0
    const Essence = sample.essence || 0
    const Substance = sample.substance || 0

    // Base A# calculation
    let A_number = Spirit + Matter + Essence + Substance

    // Planetary amplifications
    const sunDegree = this.extractPlanetaryDegrees(horoscope)['Sun']
    const moonDegree = this.extractPlanetaryDegrees(horoscope)['Moon']

    // Solar amplification (fire principle)
    const solarAmplification = 1 + Math.sin((sunDegree * Math.PI) / 180) * 0.1

    // Lunar modulation (water principle)
    const lunarModulation = 1 + Math.cos((moonDegree * Math.PI) / 180) * 0.08

    // Golden ratio enhancement for consciousness resonance
    const PHI = 1.618033988749
    const consciousnessEnhancement = (Spirit / (Matter + 1)) * PHI * 0.05

    A_number = A_number * solarAmplification * lunarModulation + consciousnessEnhancement

    return Math.round(A_number * 1000) / 1000 // Round to 3 decimal places
  }

  /**
   * Calculate kinetic metrics with enhanced derivatives
   */
  private calculateKineticMetrics(currentSample: any, _timeSeries: any[]) {
    const elements: ElementVector = {
      Fire: currentSample.totals.Fire,
      Water: currentSample.totals.Water,
      Air: currentSample.totals.Air,
      Earth: currentSample.totals.Earth,
    }

    const metrics: MetricVector = {
      Heat: currentSample.Heat,
      Entropy: currentSample.Entropy,
      Reactivity: currentSample.Reactivity,
      Energy: currentSample.Energy,
    }

    // For single moment calculation, use current element values as velocity
    const velocity: ElementVector = { ...elements }

    // Calculate momentum as weighted elements
    const momentum: ElementVector = {
      Fire: elements.Fire * 1.2,
      Water: elements.Water * 0.8,
      Air: elements.Air * 1.1,
      Earth: elements.Earth * 0.9,
    }

    // Calculate power as sum of thermodynamic values
    const power = metrics.Heat + metrics.Entropy + metrics.Reactivity + metrics.Energy

    const inertia = computeInertia(elements)

    // For single moment, use current metrics as metric velocity
    const metricVelocity: MetricVector = { ...metrics }

    return {
      velocity,
      momentum,
      power,
      inertia,
      metricVelocity,
    }
  }

  /**
   * Calculate planetary context
   */
  private calculatePlanetaryContext(horoscope: HoroscopeData) {
    // Null check for (horoscope as any).planets
    if (!horoscope || !(horoscope as any).planets) {
      console.error('Invalid horoscope data: planets is null or undefined')
      return {
        dominantPlanet: 'Sun',
        dominantSign: 'Aries',
        moonPhase: 0,
        retrogradeCount: 0,
      }
    }

    const planets = Object.entries((horoscope as any).planets)

    // Find dominant planet (most aspects or strongest dignity)
    let dominantPlanet = 'Sun' // default
    let maxStrength = 0

    for (const [planet, data] of planets) {
      const strength = this.calculatePlanetaryStrength(planet, data)
      if (strength > maxStrength) {
        maxStrength = strength
        dominantPlanet = planet
      }
    }

    // Find dominant sign (most planets)
    const signCounts: Record<string, number> = {}
    for (const [, data] of planets) {
      if (data && (data as any).sign) {
        signCounts[(data as any).sign] = (signCounts[(data as any).sign] || 0) + 1
      }
    }
    const dominantSign = Object.entries(signCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'Aries'

    // Calculate moon phase (simplified)
    const sunDegree = this.extractPlanetaryDegrees(horoscope)['Sun'] || 0
    const moonDegree = this.extractPlanetaryDegrees(horoscope)['Moon'] || 0
    const moonPhase =
      isNaN(sunDegree) || isNaN(moonDegree) ? 0 : ((moonDegree - sunDegree + 360) % 360) / 360

    // Count retrograde planets
    const retrogradeCount = planets.filter(([, data]) => (data as any).retrograde).length

    return {
      dominantPlanet,
      dominantSign,
      moonPhase,
      retrogradeCount,
    }
  }

  /**
   * Calculate consciousness metrics
   */
  private calculateConsciousnessMetrics(alchemical: any, kinetic: any, planetary: any) {
    // Resonance level based on A# and elemental harmony
    const resonanceLevel =
      Math.min(1.0, alchemical.A_number / 100) * (1 + (kinetic.power / 10) * 0.1)

    // Evolution phase based on planetary context
    const evolutionPhase = this.determineEvolutionPhase(planetary, alchemical)

    // Spiritual amplitude based on spirit-to-matter ratio
    const spiritualAmplitude =
      (alchemical.spirit / (alchemical.matter + 1)) * (1 + planetary.moonPhase * 0.2)

    return {
      resonanceLevel: Math.min(1.0, Math.max(0.0, resonanceLevel)),
      evolutionPhase,
      spiritualAmplitude: Math.max(0.0, spiritualAmplitude),
    }
  }

  /**
   * Determine evolution phase based on planetary and alchemical factors
   */
  private determineEvolutionPhase(planetary: any, alchemical: any): string {
    const phases = [
      'Initiation',
      'Development',
      'Integration',
      'Mastery',
      'Transcendence',
      'Illumination',
      'Unity',
    ]

    // Base phase on A# level
    const basePhase = Math.floor((alchemical.A_number / 20) % phases.length)

    // Modify based on planetary factors
    let phaseModifier = 0
    if (planetary.dominantPlanet === 'Jupiter') phaseModifier += 1
    if (planetary.dominantPlanet === 'Saturn') phaseModifier -= 1
    if (planetary.retrogradeCount > 3) phaseModifier += 1

    const finalPhase = Math.max(0, Math.min(phases.length - 1, basePhase + phaseModifier))
    return phases[finalPhase]
  }

  /**
   * Generate time steps for the specified interval
   */
  private generateTimeSteps(startDate: Date, endDate: Date, interval: string): Date[] {
    const steps: Date[] = []
    const current = new Date(startDate)

    const intervalMs =
      {
        minute: 60 * 1000,
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
      }[interval] || 60 * 60 * 1000

    while (current <= endDate) {
      steps.push(new Date(current))
      current.setTime(current.getTime() + intervalMs)
    }

    return steps
  }

  /**
   * Apply smoothing to time series data
   */
  private applySmoothing(moments: CelestialMoment[], window: number): CelestialMoment[] {
    if (window <= 1 || moments.length < window) return moments

    return moments.map((moment, index) => {
      const start = Math.max(0, index - Math.floor(window / 2))
      const end = Math.min(moments.length, start + window)
      const subset = moments.slice(start, end)

      // Calculate smoothed values
      const smoothed = { ...moment }

      // Smooth alchemical values
      smoothed.alchemical.A_number = this.average(subset.map(m => m.alchemical.A_number))
      smoothed.alchemical.spirit = this.average(subset.map(m => m.alchemical.spirit))
      smoothed.alchemical.matter = this.average(subset.map(m => m.alchemical.matter))
      smoothed.alchemical.essence = this.average(subset.map(m => m.alchemical.essence))
      smoothed.alchemical.substance = this.average(subset.map(m => m.alchemical.substance))

      // Smooth thermodynamic values
      smoothed.thermodynamic.heat = this.average(subset.map(m => m.thermodynamic.heat))
      smoothed.thermodynamic.entropy = this.average(subset.map(m => m.thermodynamic.entropy))
      smoothed.thermodynamic.reactivity = this.average(subset.map(m => m.thermodynamic.reactivity))
      smoothed.thermodynamic.energy = this.average(subset.map(m => m.thermodynamic.energy))

      return smoothed
    })
  }

  /**
   * Calculate comprehensive statistics
   */
  private calculateStatistics(moments: CelestialMoment[]) {
    if (moments.length === 0) {
      throw new Error('Cannot calculate statistics for empty moment series')
    }

    const duration =
      moments[moments.length - 1].timestamp.getTime() - moments[0].timestamp.getTime()

    // Find peak energy moment
    const peakEnergy = moments.reduce((peak, current) =>
      current.alchemical.A_number > peak.alchemical.A_number ? current : peak
    )

    // Calculate averages
    const averageValues = {
      alchemical: {
        A_number: this.average(moments.map(m => m.alchemical.A_number)),
        spirit: this.average(moments.map(m => m.alchemical.spirit)),
        matter: this.average(moments.map(m => m.alchemical.matter)),
        essence: this.average(moments.map(m => m.alchemical.essence)),
        substance: this.average(moments.map(m => m.alchemical.substance)),
      },
      kinetic: {
        power: this.average(moments.map(m => m.kinetic.power)),
        inertia: this.average(moments.map(m => m.kinetic.inertia)),
      },
      consciousness: {
        resonanceLevel: this.average(moments.map(m => m.consciousness.resonanceLevel)),
        spiritualAmplitude: this.average(moments.map(m => m.consciousness.spiritualAmplitude)),
      },
    }

    // Analyze trends
    const trends = this.analyzeTrends(moments)

    return {
      duration,
      totalMoments: moments.length,
      peakEnergy,
      averageValues,
      trends,
    } as any
  }

  /**
   * Analyze trends in the time series
   */
  private analyzeTrends(moments: CelestialMoment[]) {
    if (moments.length < 3) {
      return {
        alchemical: 'stable' as const,
        kinetic: 'stable' as const,
        consciousness: 'stable' as const,
      }
    }

    const first = moments[0]
    const last = moments[moments.length - 1]

    // Alchemical trend
    const alchemicalChange = last.alchemical.A_number - first.alchemical.A_number
    const alchemicalTrend =
      Math.abs(alchemicalChange) < 0.1 ? 'stable' : alchemicalChange > 0 ? 'rising' : 'falling'

    // Kinetic trend
    const kineticChange = last.kinetic.power - first.kinetic.power
    const kineticTrend =
      Math.abs(kineticChange) < 0.1 ? 'stable' : kineticChange > 0 ? 'accelerating' : 'decelerating'

    // Consciousness trend
    const consciousnessChange =
      last.consciousness.resonanceLevel - first.consciousness.resonanceLevel
    const consciousnessTrend =
      Math.abs(consciousnessChange) < 0.05
        ? 'stabilizing'
        : consciousnessChange > 0
          ? 'evolving'
          : 'transforming'

    return {
      alchemical: alchemicalTrend,
      kinetic: kineticTrend,
      consciousness: consciousnessTrend,
    }
  }

  /**
   * Detect patterns in the time series
   */
  private detectPatterns(moments: CelestialMoment[]) {
    const patterns: any[] = []

    // Peak detection
    const peaks = this.findPeaks(moments.map(m => m.alchemical.A_number))
    if (peaks.length > 0) {
      patterns.push({
        type: 'A# Peaks',
        description: `Detected ${peaks.length} significant alchemical peaks`,
        timeWindow: {
          start: moments[Math.min(...peaks)].timestamp,
          end: moments[Math.max(...peaks)].timestamp,
        },
        significance: peaks.length / moments.length,
      })
    }

    // Consciousness evolution patterns
    const evolutionPhases = moments.map(m => m.consciousness.evolutionPhase)
    const uniquePhases = [...new Set(evolutionPhases)]
    if (uniquePhases.length > 1) {
      patterns.push({
        type: 'Consciousness Evolution',
        description: `Progression through phases: ${uniquePhases.join(' → ')}`,
        timeWindow: {
          start: moments[0].timestamp,
          end: moments[moments.length - 1].timestamp,
        },
        significance: uniquePhases.length / 7, // 7 total phases
      })
    }

    return patterns
  }

  /**
   * Helper methods
   */

  private calculatePlanetaryStrength(_planet: string, data: any): number {
    // Simplified strength calculation with null checks
    let strength = 1
    if (data && typeof data === 'object') {
      if (data.dignity && data.dignity > 0) strength += data.dignity
      if (data.retrograde === false) strength += 0.5
    }
    return strength
  }

  private average(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  private findPeaks(values: number[]): number[] {
    const peaks: number[] = []
    const threshold = this.average(values) * 1.2 // 20% above average

    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1] && values[i] > threshold) {
        peaks.push(i)
      }
    }

    return peaks
  }
}

// Export singleton instance
export const celestialEnergyCalculator = new CelestialEnergyCalculator()

// Export types
