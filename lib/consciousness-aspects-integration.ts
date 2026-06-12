/**
 * Consciousness-Aspects Integration
 *
 * Bridges the dynamic aspects engine with the existing kinetics system
 * to enhance agent consciousness evolution based on real-time planetary aspects.
 */

import {
  DynamicAspect,
  DynamicAspectsAnalysis,
  OptimalPeriod,
  dynamicAspectsEngine,
} from './dynamic-aspects-engine'
import {
  agentKineticProfiles as AgentKineticProfile,
  getAgentKineticProfile,
} from './agents/kinetic-profiles'
import { KineticsIntegration, EnhancedKineticData } from './kinetics-integration'
import { PlanetPosition } from './astrological-pattern-recognition'

export interface ConsciousnessAspectInfluence {
  agentId: string
  applyingAspects: DynamicAspect[] // building influences
  separatingAspects: DynamicAspect[] // fading influences
  peakInfluences: DynamicAspect[] // currently exact
  consciousnessModifier: number // overall impact (-1 to +1)
  evolutionVelocity: number // rate of change (0-2)
  aspectMomentum: number // sustained aspect influence
  optimalInteractionWindow: {
    start: Date
    end: Date
    reason: string
    expectedBoost: number
  } | null
  aspectSensitivityProfile: AspectSensitivityProfile
}

export interface AspectSensitivityProfile {
  conjunctions: number // 0-1 sensitivity to conjunctions
  oppositions: number // 0-1 sensitivity to oppositions
  trines: number // 0-1 sensitivity to trines
  squares: number // 0-1 sensitivity to squares
  sextiles: number // 0-1 sensitivity to sextiles
  quincunxes: number // 0-1 sensitivity to quincunxes
  preferredAspects: string[] // aspects that enhance this agent
  challengingAspects: string[] // aspects that create growth tension
  aspectMemoryRetention: number // how long aspect influences persist (0-1)
}

export interface EnhancedKineticWithAspects extends EnhancedKineticData {
  aspectInfluences: {
    currentInfluence: number // current aspect boost/challenge
    applyingAspectCount: number // number of applying aspects
    separatingAspectCount: number // number of separating aspects
    peakAspectCount: number // number of exact aspects
    dominantAspectType: string // strongest current aspect type
    aspectEvolutionBoost: number // consciousness evolution multiplier
    nextMajorAspectEvent: {
      aspectType: string
      daysAway: number
      expectedImpact: number
    } | null
  }
  optimalInteractionPeriods: OptimalPeriod[]
  aspectRecommendations: {
    bestTimeForInteraction: Date | null
    suggestedActivities: string[]
    aspectWarnings: string[]
  }
}

// Default aspect sensitivity profiles based on agent archetypes
const DEFAULT_ASPECT_SENSITIVITIES: Record<string, Partial<AspectSensitivityProfile>> = {
  // Creative/Artistic agents
  creative: {
    trines: 0.9,
    sextiles: 0.8,
    conjunctions: 0.7,
    preferredAspects: ['trine', 'sextile', 'quintile'],
    aspectMemoryRetention: 0.7,
  },

  // Scientific/Analytical agents
  scientific: {
    squares: 0.8,
    oppositions: 0.7,
    conjunctions: 0.6,
    preferredAspects: ['square', 'opposition'],
    challengingAspects: ['quincunx'],
    aspectMemoryRetention: 0.9,
  },

  // Philosophical/Mystical agents
  philosophical: {
    quincunxes: 0.8,
    trines: 0.7,
    conjunctions: 0.9,
    preferredAspects: ['conjunction', 'quincunx', 'trine'],
    aspectMemoryRetention: 0.95,
  },

  // Leadership/Strategic agents
  strategic: {
    squares: 0.9,
    oppositions: 0.8,
    conjunctions: 0.7,
    preferredAspects: ['square', 'opposition'],
    aspectMemoryRetention: 0.8,
  },

  // Social/Charismatic agents
  social: {
    sextiles: 0.9,
    trines: 0.8,
    conjunctions: 0.6,
    preferredAspects: ['sextile', 'trine'],
    aspectMemoryRetention: 0.6,
  },
}

export class ConsciousnessAspectsIntegration {
  private kinetics: KineticsIntegration
  private aspectInfluenceCache: Map<
    string,
    { data: ConsciousnessAspectInfluence; timestamp: number }
  > = new Map()
  private readonly CACHE_TTL = 900000 // 15 minutes

  constructor() {
    this.kinetics = KineticsIntegration.getInstance()
  }

  /**
   * Calculate comprehensive aspect influence for an agent
   */
  async calculateAspectInfluence(
    agentId: string,
    planets: PlanetPosition[],
    timeRange: number = 7
  ): Promise<ConsciousnessAspectInfluence> {
    const cacheKey = `${agentId}-${this.generatePlanetsCacheKey(planets)}-${timeRange}`
    const cached = this.aspectInfluenceCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }

    const agentProfile = getAgentKineticProfile(agentId)
    if (!agentProfile) {
      throw new Error(`Agent profile not found: ${agentId}`)
    }

    // Get dynamic aspects analysis
    const aspectsAnalysis = await dynamicAspectsEngine.calculateDynamicAspects(planets, timeRange)

    // Get agent's aspect sensitivity profile
    const aspectSensitivity = this.getAgentAspectSensitivity(agentProfile)

    // Filter aspects relevant to this agent
    const relevantAspects = this.filterRelevantAspects(
      aspectsAnalysis.currentAspects,
      aspectSensitivity
    )

    // Categorize aspects
    const applyingAspects = relevantAspects.filter(a => a.applying)
    const separatingAspects = relevantAspects.filter(a => a.separating)
    const peakInfluences = relevantAspects.filter(a => a.strength === 'peak')

    // Calculate consciousness modifier
    const consciousnessModifier = this.calculateConsciousnessModifier(
      relevantAspects,
      aspectSensitivity
    )

    // Calculate evolution velocity
    const evolutionVelocity = this.calculateEvolutionVelocity(applyingAspects, aspectSensitivity)

    // Calculate aspect momentum
    const aspectMomentum = this.calculateAspectMomentum(relevantAspects, aspectSensitivity)

    // Find optimal interaction window
    const optimalInteractionWindow = this.findOptimalInteractionWindow(
      aspectsAnalysis,
      aspectSensitivity
    )

    const influence: ConsciousnessAspectInfluence = {
      agentId,
      applyingAspects,
      separatingAspects,
      peakInfluences,
      consciousnessModifier,
      evolutionVelocity,
      aspectMomentum,
      optimalInteractionWindow,
      aspectSensitivityProfile: aspectSensitivity,
    }

    // Cache the result
    this.aspectInfluenceCache.set(cacheKey, { data: influence, timestamp: Date.now() })

    return influence
  }

  /**
   * Get optimal interaction periods for multiple agents
   */
  async getOptimalInteractionPeriods(
    agentIds: string[],
    planets: PlanetPosition[],
    daysAhead: number = 14
  ): Promise<OptimalPeriod[]> {
    const aspectsAnalysis = await dynamicAspectsEngine.calculateDynamicAspects(planets, daysAhead)

    // Get agent influences
    const agentInfluences = await Promise.all(
      agentIds.map(id => this.calculateAspectInfluence(id, planets))
    )

    // Find periods where multiple agents benefit
    const synergisticPeriods: OptimalPeriod[] = []

    for (const period of aspectsAnalysis.optimalPeriods) {
      const benefitingAgents = agentInfluences.filter(influence => {
        return (
          influence.optimalInteractionWindow &&
          influence.optimalInteractionWindow.start <= period.end &&
          influence.optimalInteractionWindow.end >= period.start
        )
      })

      if (benefitingAgents.length >= 2) {
        synergisticPeriods.push({
          ...period,
          recommendedAgents: benefitingAgents.map(b => b.agentId),
          expectedBenefits: [
            ...period.expectedBenefits,
            `Synergy between ${benefitingAgents.length} agents`,
          ],
        })
      }
    }

    return synergisticPeriods.sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  /**
   * Enhance existing kinetic profile with aspect influences
   */
  async enhanceKineticProfileWithAspects(
    agentId: string,
    planets: PlanetPosition[],
    location: { lat: number; lon: number }
  ): Promise<EnhancedKineticWithAspects> {
    // Get base enhanced kinetics
    const baseKinetics = await this.kinetics.getEnhancedKinetics(location, {
      includeAgentOptimization: true,
      includePowerPrediction: true,
      includeResonanceMap: true,
    })

    // Get aspect influence
    const aspectInfluence = await this.calculateAspectInfluence(agentId, planets)

    // Calculate aspect-enhanced metrics
    const aspectInfluences = {
      currentInfluence: aspectInfluence.consciousnessModifier,
      applyingAspectCount: aspectInfluence.applyingAspects.length,
      separatingAspectCount: aspectInfluence.separatingAspects.length,
      peakAspectCount: aspectInfluence.peakInfluences.length,
      dominantAspectType: this.getDominantAspectType(aspectInfluence.applyingAspects),
      aspectEvolutionBoost: aspectInfluence.evolutionVelocity,
      nextMajorAspectEvent: this.getNextMajorAspectEvent(aspectInfluence),
    }

    // Get optimal periods with aspects
    const optimalInteractionPeriods = await this.getOptimalInteractionPeriods([agentId], planets)

    // Generate aspect-based recommendations
    const aspectRecommendations = this.generateAspectRecommendations(aspectInfluence)

    return {
      ...baseKinetics,
      aspectInfluences,
      optimalInteractionPeriods,
      aspectRecommendations,
    }
  }

  /**
   * Get agent's aspect sensitivity profile
   */
  private getAgentAspectSensitivity(agentProfile: any): AspectSensitivityProfile {
    // Determine agent archetype based on profile
    const archetype = this.determineAgentArchetype(agentProfile)
    const baseProfile =
      DEFAULT_ASPECT_SENSITIVITIES[archetype] || DEFAULT_ASPECT_SENSITIVITIES.creative

    return {
      conjunctions: baseProfile.conjunctions || 0.5,
      oppositions: baseProfile.oppositions || 0.5,
      trines: baseProfile.trines || 0.5,
      squares: baseProfile.squares || 0.5,
      sextiles: baseProfile.sextiles || 0.5,
      quincunxes: baseProfile.quincunxes || 0.3,
      preferredAspects: baseProfile.preferredAspects || ['trine', 'sextile'],
      challengingAspects: baseProfile.challengingAspects || ['square', 'opposition'],
      aspectMemoryRetention: baseProfile.aspectMemoryRetention || 0.7,
    }
  }

  private determineAgentArchetype(agentProfile: any): string {
    if (agentProfile.v_creative && agentProfile.v_creative > 0.8) return 'creative'
    if (agentProfile.v_scientific && agentProfile.v_scientific > 0.8) return 'scientific'
    if (agentProfile.v_philosophical && agentProfile.v_philosophical > 0.8) return 'philosophical'
    if (agentProfile.v_strategic && agentProfile.v_strategic > 0.8) return 'strategic'
    if (agentProfile.v_social && agentProfile.v_social > 0.8) return 'social'
    return 'creative' // default
  }

  private filterRelevantAspects(
    aspects: DynamicAspect[],
    sensitivity: AspectSensitivityProfile
  ): DynamicAspect[] {
    return aspects.filter(aspect => {
      const aspectSensitivity = this.getAspectSensitivityValue(aspect.type, sensitivity)
      return aspectSensitivity > 0.3 // Only include aspects agent is somewhat sensitive to
    })
  }

  private getAspectSensitivityValue(
    aspectType: string,
    sensitivity: AspectSensitivityProfile
  ): number {
    switch (aspectType) {
      case 'conjunction':
        return sensitivity.conjunctions
      case 'opposition':
        return sensitivity.oppositions
      case 'trine':
        return sensitivity.trines
      case 'square':
        return sensitivity.squares
      case 'sextile':
        return sensitivity.sextiles
      case 'quincunx':
        return sensitivity.quincunxes
      default:
        return 0.3
    }
  }

  private calculateConsciousnessModifier(
    aspects: DynamicAspect[],
    sensitivity: AspectSensitivityProfile
  ): number {
    let totalModifier = 0

    for (const aspect of aspects) {
      const sensitivityValue = this.getAspectSensitivityValue(aspect.type, sensitivity)
      const aspectContribution = aspect.evolutionaryImpact * sensitivityValue

      // Applying aspects boost consciousness
      if (aspect.applying) {
        totalModifier += aspectContribution
      } else if (aspect.separating) {
        // Separating aspects provide integration bonus (smaller)
        totalModifier += aspectContribution * 0.3
      }
    }

    // Clamp to -1 to +1 range
    return Math.max(-1, Math.min(1, totalModifier))
  }

  private calculateEvolutionVelocity(
    applyingAspects: DynamicAspect[],
    sensitivity: AspectSensitivityProfile
  ): number {
    if (applyingAspects.length === 0) return 1.0

    let velocitySum = 0
    for (const aspect of applyingAspects) {
      const sensitivityValue = this.getAspectSensitivityValue(aspect.type, sensitivity)
      const aspectVelocity =
        Math.abs(aspect.orbVelocity) * sensitivityValue * aspect.evolutionaryImpact
      velocitySum += aspectVelocity
    }

    // Base velocity is 1.0, aspects can boost up to 2.0
    return Math.min(2.0, 1.0 + velocitySum)
  }

  private calculateAspectMomentum(
    aspects: DynamicAspect[],
    sensitivity: AspectSensitivityProfile
  ): number {
    let momentum = 0

    for (const aspect of aspects) {
      const sensitivityValue = this.getAspectSensitivityValue(aspect.type, sensitivity)

      if (aspect.momentumType === 'accelerating') {
        momentum += sensitivityValue * 0.3
      } else if (aspect.momentumType === 'steady') {
        momentum += sensitivityValue * 0.2
      }
    }

    return Math.min(1.0, momentum)
  }

  private findOptimalInteractionWindow(
    aspectsAnalysis: DynamicAspectsAnalysis,
    sensitivity: AspectSensitivityProfile
  ): ConsciousnessAspectInfluence['optimalInteractionWindow'] {
    const relevantPeriods = aspectsAnalysis.optimalPeriods.filter(period =>
      period.aspects.some(aspect => sensitivity.preferredAspects.includes(aspect.type))
    )

    if (relevantPeriods.length === 0) return null

    const bestPeriod = relevantPeriods.reduce((best, current) => {
      const currentScore = this.scorePeriodForAgent(current, sensitivity)
      const bestScore = this.scorePeriodForAgent(best, sensitivity)
      return currentScore > bestScore ? current : best
    })

    const expectedBoost = this.scorePeriodForAgent(bestPeriod, sensitivity)

    return {
      start: bestPeriod.start,
      end: bestPeriod.end,
      reason: `Optimal ${bestPeriod.type} period with ${bestPeriod.aspects.length} favorable aspects`,
      expectedBoost,
    }
  }

  private scorePeriodForAgent(
    period: OptimalPeriod,
    sensitivity: AspectSensitivityProfile
  ): number {
    let score = 0

    for (const aspect of period.aspects) {
      const sensitivityValue = this.getAspectSensitivityValue(aspect.type, sensitivity)
      score += aspect.evolutionaryImpact * sensitivityValue
    }

    return score
  }

  private getDominantAspectType(aspects: DynamicAspect[]): string {
    if (aspects.length === 0) return 'none'

    const aspectCounts: Record<string, number> = {}
    for (const aspect of aspects) {
      aspectCounts[aspect.type] = (aspectCounts[aspect.type] || 0) + 1
    }

    return Object.entries(aspectCounts).sort(([, a], [, b]) => b - a)[0][0]
  }

  private getNextMajorAspectEvent(
    influence: ConsciousnessAspectInfluence
  ): EnhancedKineticWithAspects['aspectInfluences']['nextMajorAspectEvent'] {
    if (influence.applyingAspects.length === 0) return null

    const nextAspect = influence.applyingAspects.reduce((closest, current) => {
      return current.daysToExact < closest.daysToExact ? current : closest
    })

    return {
      aspectType: nextAspect.type,
      daysAway: nextAspect.daysToExact,
      expectedImpact: nextAspect.evolutionaryImpact,
    }
  }

  private generateAspectRecommendations(
    influence: ConsciousnessAspectInfluence
  ): EnhancedKineticWithAspects['aspectRecommendations'] {
    const suggestedActivities: string[] = []
    const aspectWarnings: string[] = []

    // Generate activity suggestions based on applying aspects
    for (const aspect of influence.applyingAspects) {
      if (aspect.type === 'trine' || aspect.type === 'sextile') {
        suggestedActivities.push(
          `Embrace creative flow with ${aspect.planet1}-${aspect.planet2} harmony`
        )
      } else if (aspect.type === 'conjunction') {
        suggestedActivities.push(
          `Focus on integration of ${aspect.planet1}-${aspect.planet2} energies`
        )
      }
    }

    // Generate warnings for challenging aspects
    for (const aspect of influence.applyingAspects) {
      if (aspect.type === 'square' || aspect.type === 'opposition') {
        aspectWarnings.push(
          `Prepare for ${aspect.type} tension between ${aspect.planet1}-${aspect.planet2}`
        )
      }
    }

    return {
      bestTimeForInteraction: influence.optimalInteractionWindow?.start || null,
      suggestedActivities,
      aspectWarnings,
    }
  }

  private generatePlanetsCacheKey(planets: PlanetPosition[]): string {
    return planets.map(p => `${p.planet}:${p.degree}:${p.sign}`).join('|')
  }

  /**
   * Clear influence cache
   */
  clearCache(): void {
    this.aspectInfluenceCache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; oldestEntry: number; newestEntry: number } {
    const timestamps = Array.from(this.aspectInfluenceCache.values()).map(v => v.timestamp)
    return {
      size: this.aspectInfluenceCache.size,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    }
  }
}

// Singleton instance
export const consciousnessAspectsIntegration = new ConsciousnessAspectsIntegration()

// Convenience functions
export async function calculateAgentAspectInfluence(
  agentId: string,
  planets: PlanetPosition[],
  timeRange?: number
): Promise<ConsciousnessAspectInfluence> {
  return consciousnessAspectsIntegration.calculateAspectInfluence(agentId, planets, timeRange)
}

export async function getOptimalAgentInteractionPeriods(
  agentIds: string[],
  planets: PlanetPosition[],
  daysAhead?: number
): Promise<OptimalPeriod[]> {
  return consciousnessAspectsIntegration.getOptimalInteractionPeriods(agentIds, planets, daysAhead)
}

export async function enhanceAgentKineticsWithAspects(
  agentId: string,
  planets: PlanetPosition[],
  location: { lat: number; lon: number }
): Promise<EnhancedKineticWithAspects> {
  return consciousnessAspectsIntegration.enhanceKineticProfileWithAspects(
    agentId,
    planets,
    location
  )
}
