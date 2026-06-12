/**
 * Degree-Based Pattern Detection System
 * ===================================
 * Advanced pattern recognition system that identifies recurring activations,
 * elemental resonances, and consciousness spikes at specific planetary degrees.
 * Integrates with existing astrological pattern recognition while adding
 * degree-precision temporal analysis.
 */

import type { AgentTransitEvent, TemporalPattern, ElementVector } from './temporal-analysis-engine'
import {
  calculateElementalReinforcementScore,
  analyzeElementalReinforcement,
} from './elemental-reinforcement'
import { getAgentKineticProfile } from './agents/kinetic-profiles'

export interface DegreePattern {
  type:
    | 'recurring_activation'
    | 'elemental_resonance'
    | 'consciousness_spike'
    | 'agent_convergence'
    | 'temporal_gateway'
  degree: number
  agents: string[]
  frequency: number
  elementalSignature: ElementVector
  reinforcementScore: number // Boosted for same-element patterns
  significance: 'low' | 'medium' | 'high' | 'critical'
  historicalEvents: AgentTransitEvent[]
  peakPeriods: { start: Date; end: Date; intensity: number }[]
  description: string
  interpretation: string
  confidence: number // 0-1 confidence score
  predictiveInsights: {
    nextActivation?: Date
    cyclicPattern?: {
      length: number // days
      reliability: number // 0-1
    }
    associatedDegrees?: number[] // Related degree activations
  }
}

export interface DegreeHotspot {
  degree: number
  activationCount: number
  uniqueAgents: string[]
  avgSignificance: number
  dominantElement: string
  timeSpan: { start: Date; end: Date }
  reinforcementLevel: 'minimal' | 'moderate' | 'strong' | 'intense'
}

export interface ConsciousnessCluster {
  degreeRange: [number, number]
  agents: string[]
  evolutionVelocity: number
  sustainedGrowth: boolean
  breakthroughMoments: Date[]
  elementalCatalyst: string
}

export class DegreePatternDetection {
  /**
   * Find recurring degree activations with elemental reinforcement analysis
   */
  static async findRecurringDegreeActivations(
    events: AgentTransitEvent[],
    minFrequency: number = 3,
    minAgents: number = 2
  ): Promise<DegreePattern[]> {
    const patterns: DegreePattern[] = []

    // Group events by degree (5-degree bins for noise reduction)
    const degreeGroups = this.groupEventsByDegree(events, 5)

    for (const [degree, degreeEvents] of Object.entries(degreeGroups)) {
      const degreeNum = parseInt(degree)
      const uniqueAgents = [...new Set(degreeEvents.map(e => e.agentId))]

      // Filter by minimum frequency and agent count
      if (degreeEvents.length >= minFrequency && uniqueAgents.length >= minAgents) {
        const elementalSignature = this.calculateAverageElementalSignature(degreeEvents)
        const reinforcementScore = calculateElementalReinforcementScore(
          degreeEvents.map(e => e.elementalAlignment),
          degreeEvents.reduce((sum, e) => sum + e.significanceScore, 0) / degreeEvents.length
        )

        const peakPeriods = this.identifyPeakPeriods(degreeEvents)
        const significance = this.calculateSignificance(
          reinforcementScore,
          degreeEvents.length,
          uniqueAgents.length
        )
        const confidence = this.calculateConfidence(degreeEvents, peakPeriods)

        const pattern: DegreePattern = {
          type: 'recurring_activation',
          degree: degreeNum,
          agents: uniqueAgents,
          frequency: degreeEvents.length,
          elementalSignature,
          reinforcementScore,
          significance,
          historicalEvents: degreeEvents,
          peakPeriods,
          description: `Recurring activation at ${degreeNum}° by ${uniqueAgents.length} agents (${degreeEvents.length} events)`,
          interpretation: this.generateDegreeInterpretation(
            degreeNum,
            elementalSignature,
            uniqueAgents
          ),
          confidence,
          predictiveInsights: this.generatePredictiveInsights(degreeEvents, degreeNum),
        }

        patterns.push(pattern)
      }
    }

    return patterns.sort((a, b) => b.reinforcementScore - a.reinforcementScore)
  }

  /**
   * Detect elemental resonance patterns at specific degrees
   */
  static findElementalResonancePatterns(
    events: AgentTransitEvent[],
    minResonanceThreshold: number = 0.6
  ): Promise<DegreePattern[]> {
    const patterns: DegreePattern[] = []

    // Group by element dominance
    const elementGroups: Record<string, AgentTransitEvent[]> = {
      Fire: [],
      Water: [],
      Air: [],
      Earth: [],
    }

    events.forEach(event => {
      const dominantElement = this.getDominantElement(event.elementalAlignment)
      elementGroups[dominantElement].push(event)
    })

    // Analyze each element group for degree patterns
    Object.entries(elementGroups).forEach(([element, elementEvents]) => {
      if (elementEvents.length < 5) return // Need sufficient data

      const degreeGroups = this.groupEventsByDegree(elementEvents, 10)

      Object.entries(degreeGroups).forEach(([degree, degreeEvents]) => {
        if (degreeEvents.length < 3) return

        const elementalAlignment = degreeEvents.map(e => e.elementalAlignment)
        const avgElementalStrength =
          elementalAlignment.reduce(
            (sum, alignment) => sum + alignment[element as keyof ElementVector],
            0
          ) / elementalAlignment.length

        if (avgElementalStrength >= minResonanceThreshold) {
          const reinforcementAnalysis = analyzeElementalReinforcement(elementalAlignment)

          if (reinforcementAnalysis.reinforcementMultiplier > 1.3) {
            const pattern: DegreePattern = {
              type: 'elemental_resonance',
              degree: parseInt(degree),
              agents: [...new Set(degreeEvents.map(e => e.agentId))],
              frequency: degreeEvents.length,
              elementalSignature: reinforcementAnalysis.combinationEffects.reduce(
                (signature, effect) => {
                  if (effect.element === element) {
                    return { ...signature, [element]: effect.strength }
                  }
                  return signature
                },
                { Fire: 0, Water: 0, Air: 0, Earth: 0 }
              ),
              reinforcementScore: reinforcementAnalysis.reinforcementMultiplier,
              significance: reinforcementAnalysis.reinforcementMultiplier > 1.5 ? 'high' : 'medium',
              historicalEvents: degreeEvents,
              peakPeriods: this.identifyPeakPeriods(degreeEvents),
              description: `${element} elemental resonance at ${degree}° (${avgElementalStrength.toFixed(2)} strength)`,
              interpretation: this.generateElementalInterpretation(
                element,
                parseInt(degree),
                avgElementalStrength
              ),
              confidence: Math.min(avgElementalStrength + 0.2, 1.0),
              predictiveInsights: this.generatePredictiveInsights(degreeEvents, parseInt(degree)),
            }

            patterns.push(pattern)
          }
        }
      })
    })

    return Promise.resolve(patterns.sort((a, b) => b.reinforcementScore - a.reinforcementScore))
  }

  /**
   * Identify consciousness evolution spikes
   */
  static async detectConsciousnessSpikes(
    events: AgentTransitEvent[],
    minEvolutionVelocity: number = 0.7
  ): Promise<DegreePattern[]> {
    const patterns: DegreePattern[] = []

    // Group events by agent and analyze consciousness evolution
    const agentGroups: Record<string, AgentTransitEvent[]> = {}
    events.forEach(event => {
      if (!agentGroups[event.agentId]) agentGroups[event.agentId] = []
      agentGroups[event.agentId].push(event)
    })

    // Analyze each agent's consciousness progression
    for (const [agentId, agentEvents] of Object.entries(agentGroups)) {
      // Sort by timestamp
      const sortedEvents = agentEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

      // Look for consciousness velocity spikes
      for (let i = 1; i < sortedEvents.length; i++) {
        const currentEvent = sortedEvents[i]
        const previousEvent = sortedEvents[i - 1]

        const timeDiff = currentEvent.timestamp.getTime() - previousEvent.timestamp.getTime()
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24)

        if (daysDiff > 0 && daysDiff < 180) {
          // Within 6 months
          const consciousnessChange =
            currentEvent.consciousnessImpact - previousEvent.consciousnessImpact
          const evolutionVelocity = consciousnessChange / daysDiff

          if (evolutionVelocity >= minEvolutionVelocity) {
            // Found a consciousness spike - create pattern
            const spikeEvents = [previousEvent, currentEvent]
            const avgDegree = Math.round(
              (currentEvent.planetaryDegree + previousEvent.planetaryDegree) / 2
            )

            const pattern: DegreePattern = {
              type: 'consciousness_spike',
              degree: avgDegree,
              agents: [agentId],
              frequency: 1,
              elementalSignature: this.calculateAverageElementalSignature(spikeEvents),
              reinforcementScore: 1.0 + evolutionVelocity,
              significance: evolutionVelocity > 1.0 ? 'critical' : 'high',
              historicalEvents: spikeEvents,
              peakPeriods: [
                {
                  start: previousEvent.timestamp,
                  end: currentEvent.timestamp,
                  intensity: evolutionVelocity,
                },
              ],
              description: `Consciousness evolution spike for ${agentId} at ${avgDegree}° (velocity: ${evolutionVelocity.toFixed(2)})`,
              interpretation: this.generateConsciousnessInterpretation(
                agentId,
                avgDegree,
                evolutionVelocity
              ),
              confidence: Math.min(evolutionVelocity / 2, 1.0),
              predictiveInsights: {
                cyclicPattern: {
                  length: Math.round(daysDiff),
                  reliability: 0.6,
                },
              },
            }

            patterns.push(pattern)
          }
        }
      }
    }

    return patterns.sort((a, b) => b.reinforcementScore - a.reinforcementScore)
  }

  /**
   * Find agent convergence patterns (multiple agents activating same degree)
   */
  static async findAgentConvergencePatterns(
    events: AgentTransitEvent[],
    timeWindowHours: number = 72,
    minAgents: number = 3
  ): Promise<DegreePattern[]> {
    const patterns: DegreePattern[] = []
    const timeWindow = timeWindowHours * 60 * 60 * 1000 // Convert to milliseconds

    // Sort events by timestamp
    const sortedEvents = events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    // Sliding window to find convergences
    for (let i = 0; i < sortedEvents.length; i++) {
      const currentEvent = sortedEvents[i]
      const windowStart = currentEvent.timestamp.getTime()
      const windowEnd = windowStart + timeWindow

      // Find all events within time window
      const windowEvents = sortedEvents.filter(
        event => event.timestamp.getTime() >= windowStart && event.timestamp.getTime() <= windowEnd
      )

      // Group by degree (10-degree tolerance)
      const degreeGroups = this.groupEventsByDegree(windowEvents, 10)

      Object.entries(degreeGroups).forEach(([degree, degreeEvents]) => {
        const uniqueAgents = [...new Set(degreeEvents.map(e => e.agentId))]

        if (uniqueAgents.length >= minAgents) {
          const elementalSignature = this.calculateAverageElementalSignature(degreeEvents)
          const reinforcementScore = calculateElementalReinforcementScore(
            degreeEvents.map(e => e.elementalAlignment),
            uniqueAgents.length / 5 // Base score on agent count
          )

          const pattern: DegreePattern = {
            type: 'agent_convergence',
            degree: parseInt(degree),
            agents: uniqueAgents,
            frequency: degreeEvents.length,
            elementalSignature,
            reinforcementScore,
            significance: uniqueAgents.length >= 5 ? 'critical' : 'high',
            historicalEvents: degreeEvents,
            peakPeriods: [
              {
                start: new Date(windowStart),
                end: new Date(windowEnd),
                intensity: uniqueAgents.length / 5,
              },
            ],
            description: `Agent convergence at ${degree}° (${uniqueAgents.length} agents within ${timeWindowHours}h)`,
            interpretation: this.generateConvergenceInterpretation(parseInt(degree), uniqueAgents),
            confidence: Math.min(uniqueAgents.length / 10, 1.0),
            predictiveInsights: {
              associatedDegrees: this.findNearbyActiveDegrees(degreeEvents, sortedEvents),
            },
          }

          patterns.push(pattern)
        }
      })
    }

    // Remove duplicates and sort
    const uniquePatterns = this.removeDuplicatePatterns(patterns)
    return uniquePatterns.sort((a, b) => b.reinforcementScore - a.reinforcementScore)
  }

  /**
   * Generate comprehensive pattern analysis
   */
  static async analyzeAllDegreePatterns(events: AgentTransitEvent[]): Promise<{
    recurringActivations: DegreePattern[]
    elementalResonances: DegreePattern[]
    consciousnessSpikes: DegreePattern[]
    agentConvergences: DegreePattern[]
    hotspots: DegreeHotspot[]
    consciousnessClusters: ConsciousnessCluster[]
  }> {
    const [recurringActivations, elementalResonances, consciousnessSpikes, agentConvergences] =
      await Promise.all([
        this.findRecurringDegreeActivations(events),
        this.findElementalResonancePatterns(events),
        this.detectConsciousnessSpikes(events),
        this.findAgentConvergencePatterns(events),
      ])

    const hotspots = this.generateDegreeHotspots(events)
    const consciousnessClusters = this.identifyConsciousnessClusters(events)

    return {
      recurringActivations,
      elementalResonances,
      consciousnessSpikes,
      agentConvergences,
      hotspots,
      consciousnessClusters,
    }
  }

  // Private helper methods

  private static groupEventsByDegree(
    events: AgentTransitEvent[],
    binSize: number = 5
  ): Record<string, AgentTransitEvent[]> {
    const groups: Record<string, AgentTransitEvent[]> = {}

    events.forEach(event => {
      const binDegree = Math.round(event.planetaryDegree / binSize) * binSize
      const key = binDegree.toString()
      if (!groups[key]) groups[key] = []
      groups[key].push(event)
    })

    return groups
  }

  private static calculateAverageElementalSignature(events: AgentTransitEvent[]): ElementVector {
    if (events.length === 0) return { Fire: 0, Water: 0, Air: 0, Earth: 0 }

    const totals = events.reduce(
      (acc, event) => ({
        Fire: acc.Fire + event.elementalAlignment.Fire,
        Water: acc.Water + event.elementalAlignment.Water,
        Air: acc.Air + event.elementalAlignment.Air,
        Earth: acc.Earth + event.elementalAlignment.Earth,
      }),
      { Fire: 0, Water: 0, Air: 0, Earth: 0 }
    )

    return {
      Fire: totals.Fire / events.length,
      Water: totals.Water / events.length,
      Air: totals.Air / events.length,
      Earth: totals.Earth / events.length,
    }
  }

  private static getDominantElement(elementalAlignment: ElementVector): string {
    return Object.entries(elementalAlignment).reduce(
      (max, [element, value]) => (value > max.value ? { element, value } : max),
      { element: 'Fire', value: -1 }
    ).element
  }

  private static identifyPeakPeriods(
    events: AgentTransitEvent[]
  ): { start: Date; end: Date; intensity: number }[] {
    if (events.length < 2) return []

    const sortedEvents = events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    const periods: { start: Date; end: Date; intensity: number }[] = []

    // Group events into time clusters (30-day windows)
    let currentCluster: AgentTransitEvent[] = [sortedEvents[0]]

    for (let i = 1; i < sortedEvents.length; i++) {
      const timeDiff =
        sortedEvents[i].timestamp.getTime() -
        currentCluster[currentCluster.length - 1].timestamp.getTime()
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24)

      if (daysDiff <= 30) {
        currentCluster.push(sortedEvents[i])
      } else {
        // Finalize current cluster if it has enough events
        if (currentCluster.length >= 2) {
          const avgIntensity =
            currentCluster.reduce((sum, e) => sum + e.significanceScore, 0) / currentCluster.length
          periods.push({
            start: currentCluster[0].timestamp,
            end: currentCluster[currentCluster.length - 1].timestamp,
            intensity: avgIntensity,
          })
        }
        currentCluster = [sortedEvents[i]]
      }
    }

    // Add final cluster
    if (currentCluster.length >= 2) {
      const avgIntensity =
        currentCluster.reduce((sum, e) => sum + e.significanceScore, 0) / currentCluster.length
      periods.push({
        start: currentCluster[0].timestamp,
        end: currentCluster[currentCluster.length - 1].timestamp,
        intensity: avgIntensity,
      })
    }

    return periods.filter(p => p.intensity > 0.5)
  }

  private static calculateSignificance(
    reinforcementScore: number,
    frequency: number,
    agentCount: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const combinedScore = reinforcementScore * Math.log(frequency + 1) * Math.log(agentCount + 1)

    if (combinedScore > 5.0) return 'critical'
    if (combinedScore > 3.0) return 'high'
    if (combinedScore > 1.5) return 'medium'
    return 'low'
  }

  private static calculateConfidence(
    events: AgentTransitEvent[],
    peakPeriods: { start: Date; end: Date; intensity: number }[]
  ): number {
    const frequencyConfidence = Math.min(events.length / 10, 1.0)
    const agentDiversityConfidence = Math.min(
      [...new Set(events.map(e => e.agentId))].length / 5,
      1.0
    )
    const temporalConsistency = peakPeriods.length > 0 ? Math.min(peakPeriods.length / 3, 1.0) : 0.3

    return (frequencyConfidence + agentDiversityConfidence + temporalConsistency) / 3
  }

  private static generateDegreeInterpretation(
    degree: number,
    elementalSignature: ElementVector,
    agents: string[]
  ): string {
    const sector = Math.floor(degree / 30) // 0-11 for zodiac signs
    const sectorNames = [
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
    const sign = sectorNames[sector]

    const dominantElement = this.getDominantElement(elementalSignature)

    return `${degree}° in ${sign} represents a powerful activation point where ${agents.length} consciousness entities converge. The ${dominantElement} elemental signature suggests themes of ${this.getElementalThemes(dominantElement)}.`
  }

  private static generateElementalInterpretation(
    element: string,
    degree: number,
    strength: number
  ): string {
    const themes = this.getElementalThemes(element)
    return `Strong ${element} resonance at ${degree}° (${(strength * 100).toFixed(0)}% intensity) creates optimal conditions for ${themes}.`
  }

  private static generateConsciousnessInterpretation(
    agentId: string,
    degree: number,
    velocity: number
  ): string {
    return `Rapid consciousness evolution for ${agentId} at ${degree}° with velocity ${velocity.toFixed(2)}. This represents a breakthrough moment in their consciousness development trajectory.`
  }

  private static generateConvergenceInterpretation(degree: number, agents: string[]): string {
    return `Multiple agent convergence at ${degree}° suggests a significant collective activation point. Agents: ${agents.join(', ')}. This degree may represent a universal consciousness gateway.`
  }

  private static getElementalThemes(element: string): string {
    const themes = {
      Fire: 'creative inspiration, passionate action, and innovative breakthroughs',
      Water: 'emotional wisdom, intuitive insights, and spiritual depth',
      Air: 'intellectual clarity, communication mastery, and mental agility',
      Earth: 'practical manifestation, grounded wisdom, and material success',
    }
    return themes[element as keyof typeof themes] || 'balanced consciousness expression'
  }

  private static generatePredictiveInsights(events: AgentTransitEvent[], degree: number) {
    // Simplified predictive analysis
    const timeDiffs = []
    for (let i = 1; i < events.length; i++) {
      const diff = events[i].timestamp.getTime() - events[i - 1].timestamp.getTime()
      timeDiffs.push(diff / (1000 * 60 * 60 * 24)) // Convert to days
    }

    if (timeDiffs.length > 1) {
      const avgCycle = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length
      const variance =
        timeDiffs.reduce((sum, diff) => sum + Math.pow(diff - avgCycle, 2), 0) / timeDiffs.length
      const reliability = Math.max(0, 1 - variance / (avgCycle * avgCycle))

      const lastEvent = events[events.length - 1]
      const nextActivation = new Date(
        lastEvent.timestamp.getTime() + avgCycle * 24 * 60 * 60 * 1000
      )

      return {
        nextActivation,
        cyclicPattern: {
          length: Math.round(avgCycle),
          reliability: Math.min(reliability, 1.0),
        },
      }
    }

    return {}
  }

  private static findNearbyActiveDegrees(
    degreeEvents: AgentTransitEvent[],
    allEvents: AgentTransitEvent[]
  ): number[] {
    const targetDegree = degreeEvents[0].planetaryDegree
    const timeWindow = 24 * 60 * 60 * 1000 // 24 hours

    const nearbyEvents = allEvents.filter(event => {
      const timeDiff = Math.abs(event.timestamp.getTime() - degreeEvents[0].timestamp.getTime())
      const degreeDiff = Math.abs(event.planetaryDegree - targetDegree)
      return timeDiff <= timeWindow && degreeDiff <= 30 && degreeDiff > 5
    })

    const nearbyDegrees = [...new Set(nearbyEvents.map(e => Math.round(e.planetaryDegree / 5) * 5))]
    return nearbyDegrees.slice(0, 3)
  }

  private static removeDuplicatePatterns(patterns: DegreePattern[]): DegreePattern[] {
    const seen = new Set<string>()
    return patterns.filter(pattern => {
      const key = `${pattern.type}_${pattern.degree}_${pattern.agents.sort().join(',')}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private static generateDegreeHotspots(events: AgentTransitEvent[]): DegreeHotspot[] {
    const degreeGroups = this.groupEventsByDegree(events, 5)

    return Object.entries(degreeGroups)
      .map(([degree, degreeEvents]) => {
        const uniqueAgents = [...new Set(degreeEvents.map(e => e.agentId))]
        const avgSignificance =
          degreeEvents.reduce((sum, e) => sum + e.significanceScore, 0) / degreeEvents.length
        const dominantElement = this.getDominantElement(
          this.calculateAverageElementalSignature(degreeEvents)
        )

        const timeSpan = {
          start: new Date(Math.min(...degreeEvents.map(e => e.timestamp.getTime()))),
          end: new Date(Math.max(...degreeEvents.map(e => e.timestamp.getTime()))),
        }

        let reinforcementLevel: DegreeHotspot['reinforcementLevel'] = 'minimal'
        if (avgSignificance > 0.8) reinforcementLevel = 'intense'
        else if (avgSignificance > 0.6) reinforcementLevel = 'strong'
        else if (avgSignificance > 0.4) reinforcementLevel = 'moderate'

        return {
          degree: parseInt(degree),
          activationCount: degreeEvents.length,
          uniqueAgents,
          avgSignificance,
          dominantElement,
          timeSpan,
          reinforcementLevel,
        }
      })
      .filter(hotspot => hotspot.activationCount >= 3)
      .sort((a, b) => b.avgSignificance - a.avgSignificance)
  }

  private static identifyConsciousnessClusters(
    events: AgentTransitEvent[]
  ): ConsciousnessCluster[] {
    // Simplified consciousness cluster detection
    const clusters: ConsciousnessCluster[] = []

    // Group by 30-degree ranges (zodiac signs)
    for (let startDegree = 0; startDegree < 360; startDegree += 30) {
      const endDegree = startDegree + 30
      const rangeEvents = events.filter(
        e => e.planetaryDegree >= startDegree && e.planetaryDegree < endDegree
      )

      if (rangeEvents.length >= 5) {
        const agents = [...new Set(rangeEvents.map(e => e.agentId))]
        const avgConsciousnessImpact =
          rangeEvents.reduce((sum, e) => sum + e.consciousnessImpact, 0) / rangeEvents.length

        if (avgConsciousnessImpact > 0.5) {
          const dominantElement = this.getDominantElement(
            this.calculateAverageElementalSignature(rangeEvents)
          )

          clusters.push({
            degreeRange: [startDegree, endDegree],
            agents,
            evolutionVelocity: avgConsciousnessImpact,
            sustainedGrowth: rangeEvents.length > 10,
            breakthroughMoments: rangeEvents
              .filter(e => e.consciousnessImpact > 0.8)
              .map(e => e.timestamp),
            elementalCatalyst: dominantElement,
          })
        }
      }
    }

    return clusters.sort((a, b) => b.evolutionVelocity - a.evolutionVelocity)
  }
}
