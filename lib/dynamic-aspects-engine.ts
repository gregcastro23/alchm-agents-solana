/**
 * Dynamic Aspects Engine
 *
 * Provides sophisticated analysis of applying and separating planetary aspects
 * with consciousness evolution integration and predictive capabilities.
 */

import {
  Aspect,
  AspectType,
  PlanetPosition,
  calculateAllAspects,
} from './astrological-pattern-recognition'
import { planetaryMotionTracker, PlanetaryMotion } from './planetary-motion-tracker'

export interface DynamicAspect extends Omit<Aspect, 'strength'> {
  // Enhanced temporal properties
  orbVelocity: number // degrees per day the orb is changing
  peakDate: Date | null // when aspect will be exact (if applying)
  daysToExact: number // days until exact (if applying)
  daysSinceExact: number // days since exact (if separating)
  strength: 'building' | 'peak' | 'waning' | 'fading'
  momentumType: 'accelerating' | 'steady' | 'slowing'

  // Consciousness evolution properties
  evolutionaryImpact: number // 0-1 scale of consciousness impact
  optimalInteractionWindow: {
    start: Date
    end: Date
    reason: string
  } | null
}

export interface AspectEvent {
  id: string
  planet1: string
  planet2: string
  aspectType: AspectType
  eventType: 'applying' | 'exact' | 'separating' | 'out_of_orb'
  eventDate: Date
  exactOrb: number
  influence: 'major' | 'moderate' | 'minor'
  consciousnessImpact: {
    affectedAgents: string[]
    evolutionBoost: number
    recommendedActions: string[]
  }
}

export interface DynamicAspectsAnalysis {
  currentAspects: DynamicAspect[]
  upcomingEvents: AspectEvent[]
  applyingAspects: DynamicAspect[]
  separatingAspects: DynamicAspect[]
  peakAspects: DynamicAspect[]
  optimalPeriods: OptimalPeriod[]
  timestamp: Date
}

export interface OptimalPeriod {
  start: Date
  end: Date
  type:
    | 'consciousness_expansion'
    | 'creative_surge'
    | 'breakthrough_potential'
    | 'integration_phase'
  aspects: DynamicAspect[]
  expectedBenefits: string[]
  recommendedAgents: string[]
}

// Aspect strength definitions for consciousness impact
const ASPECT_CONSCIOUSNESS_IMPACT: Record<AspectType, number> = {
  conjunction: 0.9, // High impact - fusion of energies
  opposition: 0.8, // High impact - tension creates growth
  trine: 0.6, // Moderate - harmonious flow
  square: 0.7, // Moderate-high - creative tension
  sextile: 0.4, // Moderate - opportunity
  quincunx: 0.5, // Moderate - adjustment required
  semisextile: 0.2, // Low - subtle influence
  sesquiquadrate: 0.3, // Low-moderate - minor stress
  semisquare: 0.3, // Low-moderate - minor stress
  quintile: 0.4, // Moderate - creative potential
  biquintile: 0.4, // Moderate - creative potential
}

// Planetary consciousness influence multipliers
const PLANETARY_CONSCIOUSNESS_MULTIPLIERS: Record<string, number> = {
  Sun: 1.2, // Enhanced identity/self-actualization
  Moon: 1.1, // Emotional/intuitive development
  Mercury: 1.0, // Communication/learning
  Venus: 0.9, // Harmony/relationships
  Mars: 1.1, // Action/assertion
  Jupiter: 1.3, // Expansion/wisdom
  Saturn: 1.2, // Structure/mastery
  Uranus: 1.4, // Innovation/awakening
  Neptune: 1.1, // Spirituality/intuition
  Pluto: 1.5, // Transformation/rebirth
}

export class DynamicAspectsEngine {
  private aspectCache: Map<string, { data: DynamicAspectsAnalysis; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 1800000 // 30 minutes

  /**
   * Calculate dynamic aspects with full temporal analysis
   */
  async calculateDynamicAspects(
    planets: PlanetPosition[],
    futureRange: number = 30 // days to look ahead
  ): Promise<DynamicAspectsAnalysis> {
    const cacheKey = this.generateCacheKey(planets, futureRange)
    const cached = this.aspectCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }

    // Calculate base aspects with enhanced temporal data
    const baseAspects = await calculateAllAspects(planets)

    // Convert to dynamic aspects with enhanced analysis
    const dynamicAspects = await Promise.all(
      baseAspects.map(aspect => this.enhanceAspectWithDynamicData(aspect, planets))
    )

    // Categorize aspects
    const applyingAspects = dynamicAspects.filter(a => a.applying)
    const separatingAspects = dynamicAspects.filter(a => a.separating)
    const peakAspects = dynamicAspects.filter(a => a.strength === 'peak')

    // Predict upcoming aspect events
    const upcomingEvents = await this.predictAspectEvents(planets, futureRange)

    // Find optimal interaction periods
    const optimalPeriods = await this.findOptimalPeriods(
      dynamicAspects,
      upcomingEvents,
      futureRange
    )

    const analysis: DynamicAspectsAnalysis = {
      currentAspects: dynamicAspects,
      upcomingEvents,
      applyingAspects,
      separatingAspects,
      peakAspects,
      optimalPeriods,
      timestamp: new Date(),
    }

    // Cache the result
    this.aspectCache.set(cacheKey, { data: analysis, timestamp: Date.now() })

    return analysis
  }

  /**
   * Get applying/separating status for a specific aspect between two planets
   */
  async getApplyingSeparatingStatus(
    planet1: string,
    planet2: string,
    aspectType: AspectType,
    planets: PlanetPosition[]
  ): Promise<DynamicAspect | null> {
    const analysis = await this.calculateDynamicAspects(planets)

    return (
      analysis.currentAspects.find(
        aspect =>
          ((aspect.planet1 === planet1 && aspect.planet2 === planet2) ||
            (aspect.planet1 === planet2 && aspect.planet2 === planet1)) &&
          aspect.type === aspectType
      ) || null
    )
  }

  /**
   * Predict upcoming aspect events
   */
  async predictAspectEvents(
    planets: PlanetPosition[],
    timeRange: number = 90
  ): Promise<AspectEvent[]> {
    const events: AspectEvent[] = []
    const baseDate = planets[0]?.date || new Date()

    // Check all planet pairs for upcoming events
    for (let i = 0; i < planets.length; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const planet1 = planets[i]
        const planet2 = planets[j]

        // Check major aspects
        const majorAspects: AspectType[] = [
          'conjunction',
          'opposition',
          'trine',
          'square',
          'sextile',
        ]

        for (const aspectType of majorAspects) {
          const aspectAngle = this.getAspectAngle(aspectType)
          const exactTiming = await planetaryMotionTracker.predictExactAspectTiming(
            planet1.planet,
            this.getAbsoluteDegree(planet1),
            planet2.planet,
            this.getAbsoluteDegree(planet2),
            aspectAngle,
            timeRange,
            baseDate
          )

          if (exactTiming) {
            const event = await this.createAspectEvent(
              planet1,
              planet2,
              aspectType,
              exactTiming.date,
              exactTiming.orb
            )
            events.push(event)
          }
        }
      }
    }

    return events.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())
  }

  /**
   * Find optimal periods for consciousness work and agent interactions
   */
  private async findOptimalPeriods(
    aspects: DynamicAspect[],
    events: AspectEvent[],
    timeRange: number
  ): Promise<OptimalPeriod[]> {
    const periods: OptimalPeriod[] = []
    const now = new Date()

    // Consciousness expansion periods (multiple harmonious aspects)
    const harmoniousAspects = aspects.filter(
      a => (a.type === 'trine' || a.type === 'sextile') && a.applying && a.daysToExact <= 7
    )

    if (harmoniousAspects.length >= 2) {
      const earliestPeak = Math.min(...harmoniousAspects.map(a => a.daysToExact))
      const latestPeak = Math.max(...harmoniousAspects.map(a => a.daysToExact))

      periods.push({
        start: new Date(now.getTime() + (earliestPeak - 1) * 24 * 60 * 60 * 1000),
        end: new Date(now.getTime() + (latestPeak + 1) * 24 * 60 * 60 * 1000),
        type: 'consciousness_expansion',
        aspects: harmoniousAspects,
        expectedBenefits: ['Enhanced learning', 'Spiritual insights', 'Harmonious interactions'],
        recommendedAgents: this.getRecommendedAgentsForAspects(harmoniousAspects),
      })
    }

    // Breakthrough potential periods (strong transformative aspects)
    const transformativeAspects = aspects.filter(
      a => a.evolutionaryImpact > 0.7 && a.applying && a.daysToExact <= 10
    )

    for (const aspect of transformativeAspects) {
      periods.push({
        start: new Date(now.getTime() + (aspect.daysToExact - 2) * 24 * 60 * 60 * 1000),
        end: new Date(now.getTime() + (aspect.daysToExact + 2) * 24 * 60 * 60 * 1000),
        type: 'breakthrough_potential',
        aspects: [aspect],
        expectedBenefits: ['Major insights', 'Consciousness leaps', 'Transformative experiences'],
        recommendedAgents: this.getRecommendedAgentsForAspects([aspect]),
      })
    }

    return periods.sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  /**
   * Enhance a basic aspect with dynamic temporal and consciousness data
   */
  private async enhanceAspectWithDynamicData(
    aspect: Aspect,
    planets: PlanetPosition[]
  ): Promise<DynamicAspect> {
    // Calculate consciousness impact
    const evolutionaryImpact = this.calculateConsciousnessImpact(aspect)

    // Determine aspect strength phase
    const strength = this.calculateAspectStrengthPhase(aspect)

    // Calculate momentum type
    const momentumType = this.calculateMomentumType(aspect)

    // Find optimal interaction window
    const optimalInteractionWindow = this.calculateOptimalInteractionWindow(aspect)

    return {
      ...aspect,
      orbVelocity: aspect.orbVelocity || 0,
      peakDate: aspect.peakDate || null,
      daysToExact: aspect.daysToExact || 0,
      daysSinceExact: aspect.daysSinceExact || 0,
      strength,
      momentumType,
      evolutionaryImpact,
      optimalInteractionWindow,
    }
  }

  private calculateConsciousnessImpact(aspect: Aspect): number {
    const baseImpact = ASPECT_CONSCIOUSNESS_IMPACT[aspect.type] || 0.3
    const planet1Multiplier = PLANETARY_CONSCIOUSNESS_MULTIPLIERS[aspect.planet1] || 1.0
    const planet2Multiplier = PLANETARY_CONSCIOUSNESS_MULTIPLIERS[aspect.planet2] || 1.0

    // Applying aspects have higher consciousness impact
    const applyingBonus = aspect.applying ? 1.2 : 0.8

    // Tighter orbs have higher impact
    const orbMultiplier = Math.max(0.3, 1.0 - aspect.orb / 10)

    return Math.min(
      1.0,
      baseImpact * planet1Multiplier * planet2Multiplier * applyingBonus * orbMultiplier
    )
  }

  private calculateAspectStrengthPhase(aspect: Aspect): 'building' | 'peak' | 'waning' | 'fading' {
    if (aspect.orb <= 1.0) return 'peak'
    if (aspect.applying && (aspect.daysToExact ?? 0) <= 3) return 'building'
    if (aspect.separating && (aspect.daysSinceExact ?? 0) <= 3) return 'waning'
    return 'fading'
  }

  private calculateMomentumType(aspect: Aspect): 'accelerating' | 'steady' | 'slowing' {
    const orbVelocity = Math.abs(aspect.orbVelocity || 0)

    if (orbVelocity > 0.1) return 'accelerating'
    if (orbVelocity < 0.02) return 'slowing'
    return 'steady'
  }

  private calculateOptimalInteractionWindow(
    aspect: Aspect
  ): DynamicAspect['optimalInteractionWindow'] {
    if (!aspect.applying || !aspect.peakDate) return null

    const start = new Date(aspect.peakDate.getTime() - 2 * 24 * 60 * 60 * 1000)
    const end = new Date(aspect.peakDate.getTime() + 1 * 24 * 60 * 60 * 1000)

    return {
      start,
      end,
      reason: `Optimal for ${aspect.type} between ${aspect.planet1} and ${aspect.planet2}`,
    }
  }

  private async createAspectEvent(
    planet1: PlanetPosition,
    planet2: PlanetPosition,
    aspectType: AspectType,
    eventDate: Date,
    orb: number
  ): Promise<AspectEvent> {
    const influence = this.calculateEventInfluence(aspectType, planet1.planet, planet2.planet)

    return {
      id: `${planet1.planet}-${planet2.planet}-${aspectType}-${eventDate.getTime()}`,
      planet1: planet1.planet,
      planet2: planet2.planet,
      aspectType,
      eventType: 'exact',
      eventDate,
      exactOrb: orb,
      influence,
      consciousnessImpact: {
        affectedAgents: this.getAffectedAgents(aspectType, planet1.planet, planet2.planet),
        evolutionBoost: this.calculateEvolutionBoost(aspectType, planet1.planet, planet2.planet),
        recommendedActions: this.getRecommendedActions(aspectType, planet1.planet, planet2.planet),
      },
    }
  }

  private calculateEventInfluence(
    aspectType: AspectType,
    planet1: string,
    planet2: string
  ): 'major' | 'moderate' | 'minor' {
    const baseInfluence = ASPECT_CONSCIOUSNESS_IMPACT[aspectType]
    const planetaryInfluence =
      (PLANETARY_CONSCIOUSNESS_MULTIPLIERS[planet1] +
        PLANETARY_CONSCIOUSNESS_MULTIPLIERS[planet2]) /
      2

    const totalInfluence = baseInfluence * planetaryInfluence

    if (totalInfluence > 1.0) return 'major'
    if (totalInfluence > 0.6) return 'moderate'
    return 'minor'
  }

  private getAffectedAgents(aspectType: AspectType, planet1: string, planet2: string): string[] {
    // Return agents most sensitive to these planetary combinations
    // Based on agent planetary rulerships and elemental affinities
    const planetaryAgents: Record<string, string[]> = {
      sun: ['leonardo-da-vinci', 'shakespeare', 'cleopatra'],
      moon: ['carl-jung', 'marie-curie', 'frida-kahlo'],
      mercury: ['nikola-tesla', 'albert-einstein', 'galileo-galilei'],
      venus: ['shakespeare', 'marie-curie', 'cleopatra'],
      mars: ['leonardo-da-vinci', 'nikola-tesla', 'benjamin-franklin'],
      jupiter: ['carl-jung', 'albert-einstein', 'aristotle'],
      saturn: ['marie-curie', 'aristotle', 'benjamin-franklin'],
    }

    const agents = new Set<string>()
    if (planetaryAgents[planet1]) {
      planetaryAgents[planet1].forEach(agent => agents.add(agent))
    }
    if (planetaryAgents[planet2]) {
      planetaryAgents[planet2].forEach(agent => agents.add(agent))
    }

    return Array.from(agents).slice(0, 3) // Return top 3 most relevant
  }

  private calculateEvolutionBoost(
    aspectType: AspectType,
    planet1: string,
    planet2: string
  ): number {
    return (
      ASPECT_CONSCIOUSNESS_IMPACT[aspectType] *
      ((PLANETARY_CONSCIOUSNESS_MULTIPLIERS[planet1] +
        PLANETARY_CONSCIOUSNESS_MULTIPLIERS[planet2]) /
        2)
    )
  }

  private getRecommendedActions(
    aspectType: AspectType,
    planet1: string,
    planet2: string
  ): string[] {
    const actions: string[] = []

    if (aspectType === 'conjunction') {
      actions.push('Focus on integration and synthesis')
      actions.push('Initiate new projects combining these energies')
    } else if (aspectType === 'opposition') {
      actions.push('Seek balance and perspective')
      actions.push('Work on resolving internal tensions')
    } else if (aspectType === 'trine') {
      actions.push('Embrace natural flow and creativity')
      actions.push('Express talents and abilities freely')
    }

    return actions
  }

  private getRecommendedAgentsForAspects(aspects: DynamicAspect[]): string[] {
    // Return agents most aligned with current aspect energies
    const recommendations = new Set<string>()

    for (const aspect of aspects) {
      if (aspect.type === 'trine' || aspect.type === 'sextile') {
        recommendations.add('leonardo-da-vinci')
        recommendations.add('mozart')
      }
      if (aspect.planet1 === 'Mercury' || aspect.planet2 === 'Mercury') {
        recommendations.add('galileo-galilei')
        recommendations.add('albert-einstein')
      }
    }

    return Array.from(recommendations)
  }

  private getAspectAngle(aspectType: AspectType): number {
    const angles: Record<AspectType, number> = {
      conjunction: 0,
      opposition: 180,
      trine: 120,
      square: 90,
      sextile: 60,
      quincunx: 150,
      semisextile: 30,
      sesquiquadrate: 135,
      semisquare: 45,
      quintile: 72,
      biquintile: 144,
    }
    return angles[aspectType] || 0
  }

  private getAbsoluteDegree(planet: PlanetPosition): number {
    const signOrder = [
      'Aries',
      'Taurus',
      'Gemini',
      'Cancer',
      'Leo',
      'Virgo',
      'Libra',
      'Scorpio',
      'Sagittarius',
      'Capricorn',
      'Aquarius',
      'Pisces',
    ]
    const signIndex = signOrder.indexOf(planet.sign)
    if (signIndex === -1) return 0
    return signIndex * 30 + planet.degree
  }

  private generateCacheKey(planets: PlanetPosition[], futureRange: number): string {
    const planetData = planets.map(p => `${p.planet}:${p.degree}:${p.sign}`).join('|')
    const date =
      planets[0]?.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]
    return `${planetData}-${futureRange}-${date}`
  }

  /**
   * Clear aspect cache
   */
  clearCache(): void {
    this.aspectCache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; oldestEntry: number; newestEntry: number } {
    const timestamps = Array.from(this.aspectCache.values()).map(v => v.timestamp)
    return {
      size: this.aspectCache.size,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    }
  }
}

// Singleton instance
export const dynamicAspectsEngine = new DynamicAspectsEngine()

// Convenience functions
export async function calculateDynamicAspects(
  planets: PlanetPosition[],
  futureRange?: number
): Promise<DynamicAspectsAnalysis> {
  return dynamicAspectsEngine.calculateDynamicAspects(planets, futureRange)
}

export async function predictAspectEvents(
  planets: PlanetPosition[],
  timeRange?: number
): Promise<AspectEvent[]> {
  return dynamicAspectsEngine.predictAspectEvents(planets, timeRange)
}

export async function getAspectApplyingSeparating(
  planet1: string,
  planet2: string,
  aspectType: AspectType,
  planets: PlanetPosition[]
): Promise<DynamicAspect | null> {
  return dynamicAspectsEngine.getApplyingSeparatingStatus(planet1, planet2, aspectType, planets)
}
