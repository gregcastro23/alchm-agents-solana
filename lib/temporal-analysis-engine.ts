/**
 * Temporal Analysis Engine for Time Laboratory
 * ------------------------------------------
 * Advanced temporal analysis system that transforms planetary agents' historical transit data
 * into AI-guided exploration experiences. Leverages existing AlchemicalKineticsSampler
 * and consciousness memory systems for degree-aware temporal queries.
 */

import { agentKineticProfiles } from './agents/kinetic-profiles'
import { planetaryAPI } from './planetary-api-client'
import { ConsciousnessMemorySystem } from './agents/consciousness-memory'
import { logger } from '@/lib/structured-logger'
import { HourlyAlchemicalSample, sampleDateRange } from './alchemical-kinetics-sampler'
import {
  calculateReturnPattern,
  identifyPlanetaryThemes,
  findHistoricalPatterns,
} from './transit-patterns'
import {
  detectGrandTrines,
  detectTSquares,
  type PatternConfiguration,
} from './astrological-pattern-recognition'
import type { KineticProfile } from './agents/kinetic-profiles'
import {
  getDegreeAgents,
  getDegreeEnhancedAnalysis,
  calculateNatalTransitSignificance,
  findSignificantTransitDates,
  type DegreeAgentMapping,
  type NatalPlacementTransit,
  type DegreeTransitSignificance,
} from './degree-agent-mapping'

export interface TemporalQuery {
  type: 'natural_language' | 'structured'
  query: string // e.g., "Show Fire reinforcements during Renaissance"
  dateRange?: { start: Date; end: Date }
  agents?: string[] // Agent IDs to focus on
  degrees?: number[] // Specific planetary degrees (0-360)
  elements?: ('Fire' | 'Water' | 'Air' | 'Earth')[]
  granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  reinforcementMode?: boolean // Boost same-element patterns
  location?: { latitude: number; longitude: number }
  natalChart?: NatalPlacement[] // Natal chart placements for transit analysis
}

export interface NatalPlacement {
  planet: string
  degree: number
  sign?: string
  house?: number
}

export interface ElementVector {
  Fire: number
  Water: number
  Air: number
  Earth: number
}

export interface AgentTransitEvent {
  agentId: string
  timestamp: Date
  planetaryDegree: number
  transitingPlanet: string
  aspectType?: string
  elementalAlignment: ElementVector
  consciousnessImpact: number
  significanceScore: number // Boosted for elemental reinforcement
  planetaryHour: string
  seasonalPhase: string
  powerLevel: number
  isExact?: boolean // Indicates if degree was calculated via Swisseph
  qualityMetrics: {
    depth: number
    clarity: number
    resonance: number
    temporalAlignment: number
  }
}

export interface TemporalPattern {
  type:
    | 'recurring_activation'
    | 'elemental_resonance'
    | 'consciousness_spike'
    | 'historical_correlation'
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
}

export interface TemporalAnalysisResult {
  query: TemporalQuery
  transitEvents: AgentTransitEvent[]
  patterns: TemporalPattern[]
  reinforcementScores: { element: string; score: number }[]
  insights: {
    dominantElements: string[]
    peakPeriods: { start: Date; end: Date; description: string }[]
    agentResonance: { agentId: string; resonanceScore: number }[]
    degreeHotspots: { degree: number; activationCount: number; agents: string[] }[]
  }
  recommendations: {
    optimalQueryTimes: string[]
    suggestedAgents: string[]
    relatedPatterns: string[]
    deepDiveOpportunities: string[]
  }
  natalTransits?: {
    significantTransits: NatalPlacementTransit[]
    degreeAgentMappings: DegreeAgentMapping[]
    transitSignificance: DegreeTransitSignificance[]
  }
}

export class TemporalAnalysisEngine {
  private static readonly DEFAULT_LOCATION = { latitude: 37.7749, longitude: -122.4194 } // San Francisco

  /**
   * Parse natural language queries into structured temporal requests
   */
  static parseNaturalLanguage(query: string): TemporalQuery {
    const parsedQuery: TemporalQuery = {
      type: 'natural_language',
      query: query.trim(),
      reinforcementMode: true,
      location: this.DEFAULT_LOCATION,
    }

    // Extract time references
    if (query.toLowerCase().includes('renaissance')) {
      parsedQuery.dateRange = { start: new Date('1400-01-01'), end: new Date('1600-01-01') }
    } else if (query.toLowerCase().includes('enlightenment')) {
      parsedQuery.dateRange = { start: new Date('1685-01-01'), end: new Date('1815-01-01') }
    } else if (
      query.toLowerCase().includes('modern') ||
      query.toLowerCase().includes('20th century')
    ) {
      parsedQuery.dateRange = { start: new Date('1900-01-01'), end: new Date('2000-01-01') }
    } else if (
      query.toLowerCase().includes('recent') ||
      query.toLowerCase().includes('last year')
    ) {
      const now = new Date()
      const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      parsedQuery.dateRange = { start: lastYear, end: now }
    }

    // Extract elemental references
    const elements: ('Fire' | 'Water' | 'Air' | 'Earth')[] = []
    if (query.toLowerCase().includes('fire')) elements.push('Fire')
    if (query.toLowerCase().includes('water')) elements.push('Water')
    if (query.toLowerCase().includes('air')) elements.push('Air')
    if (query.toLowerCase().includes('earth')) elements.push('Earth')
    if (elements.length > 0) parsedQuery.elements = elements

    // Extract agent references
    const agents: string[] = []
    if (query.toLowerCase().includes('einstein')) agents.push('albert-einstein')
    if (query.toLowerCase().includes('leonardo') || query.toLowerCase().includes('da vinci'))
      agents.push('leonardo-da-vinci')
    if (query.toLowerCase().includes('shakespeare')) agents.push('william-shakespeare')
    if (query.toLowerCase().includes('tesla')) agents.push('nikola-tesla')
    if (query.toLowerCase().includes('jung')) agents.push('carl-jung')
    if (query.toLowerCase().includes('curie')) agents.push('marie-curie')
    if (agents.length > 0) parsedQuery.agents = agents

    // Extract granularity
    if (query.toLowerCase().includes('hourly') || query.toLowerCase().includes('hour by hour')) {
      parsedQuery.granularity = 'hourly'
    } else if (
      query.toLowerCase().includes('daily') ||
      query.toLowerCase().includes('day by day')
    ) {
      parsedQuery.granularity = 'daily'
    } else if (query.toLowerCase().includes('weekly')) {
      parsedQuery.granularity = 'weekly'
    } else if (query.toLowerCase().includes('monthly')) {
      parsedQuery.granularity = 'monthly'
    }

    // Extract degree references
    const degreeMatch = query.match(/(\d+)\s*degree/i)
    if (degreeMatch) {
      parsedQuery.degrees = [parseInt(degreeMatch[1])]
    }

    // Extract natal chart placements (e.g., "my Sun at 15° Leo", "Moon 0° Scorpio")
    const natalMatches = query.matchAll(/(\w+)\s+(?:at\s+)?(\d+)°?\s*([A-Za-z]+)/gi)
    const natalPlacements: NatalPlacement[] = []

    for (const match of natalMatches) {
      const [, planet, degreeStr, sign] = match
      const degree = parseInt(degreeStr)
      if (!isNaN(degree) && degree >= 0 && degree <= 360) {
        natalPlacements.push({
          planet: planet.charAt(0).toUpperCase() + planet.slice(1).toLowerCase(),
          degree,
          sign,
        })
      }
    }

    if (natalPlacements.length > 0) {
      parsedQuery.natalChart = natalPlacements
    }

    // Check for transit-related queries
    if (
      query.toLowerCase().includes('transit') ||
      query.toLowerCase().includes('natal') ||
      natalPlacements.length > 0
    ) {
      parsedQuery.reinforcementMode = true // Enable enhanced analysis for transits
    }

    return parsedQuery
  }

  /**
   * Find agent transit events at specific degrees
   */
  static async getAgentTransitHistory(
    agentId: string,
    degreeRange?: [number, number],
    dateRange?: { start: Date; end: Date },
    location = this.DEFAULT_LOCATION
  ): Promise<AgentTransitEvent[]> {
    const profile = agentKineticProfiles[agentId]
    if (!profile) {
      throw new Error(`Agent profile not found: ${agentId}`)
    }

    // Default to last 2 years if no date range specified
    const defaultEnd = new Date()
    const defaultStart = new Date(
      defaultEnd.getFullYear() - 2,
      defaultEnd.getMonth(),
      defaultEnd.getDate()
    )
    const targetDateRange = dateRange || { start: defaultStart, end: defaultEnd }

    // Sample alchemical data for the date range
    const { samples } = await sampleDateRange(
      location,
      targetDateRange.start,
      targetDateRange.end,
      {
        hoursToSample: 24,
        includePlanetaryHours: true,
        validateTiming: true,
      }
    )

    const transitEvents: AgentTransitEvent[] = []

    // Fetch actual planetary positions in batch using Swisseph via PlanetaryAPI
    const batchRequests = samples.map(sample => ({
      date: sample.t,
      planet: sample.planetaryHour || 'Sun',
    }))

    let batchPositions: any[] = []
    let fallbackCount = 0
    let successCount = 0
    const startTime = Date.now()

    try {
      // We chunk the requests to avoid overloading the backend
      const CHUNK_SIZE = 50
      for (let i = 0; i < batchRequests.length; i += CHUNK_SIZE) {
        const chunk = batchRequests.slice(i, i + CHUNK_SIZE)
        const res = await planetaryAPI.getBatchPlanetaryPositions(chunk)
        batchPositions = batchPositions.concat(res)
        successCount += chunk.length
      }
    } catch (e) {
      fallbackCount = batchRequests.length - successCount
      logger.warn('Failed to fetch exact swisseph positions, falling back to approximation', {
        system: 'temporal-analysis',
        operation: 'getAgentTransitHistory',
        metadata: {
          error: e instanceof Error ? e.message : 'Unknown error',
          agentId,
          totalRequested: batchRequests.length,
          successful: successCount,
          failed: fallbackCount,
        },
      })
    }

    const duration = Date.now() - startTime

    let actualFallbackCount = 0

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]

      let actualDegree = 0
      let isExact = false

      if (batchPositions[i] && batchPositions[i].position) {
        // Swisseph returns 0-360 absolute longitude
        actualDegree = batchPositions[i].position.longitude
        isExact = true
      } else {
        // Fallback approximation if Swisseph fails
        const dayOfYear = this.getDayOfYear(sample.t)
        actualDegree = ((dayOfYear * 360) / 365) % 360
        actualFallbackCount++
      }

      // Filter by degree range if specified
      if (degreeRange && (actualDegree < degreeRange[0] || actualDegree > degreeRange[1])) {
        continue
      }

      // Calculate consciousness impact based on agent profile and timing
      const consciousnessImpact = this.calculateConsciousnessImpact(profile, sample)
      const elementalAlignment = sample.totals
      const significanceScore = this.calculateSignificanceScore(
        elementalAlignment,
        consciousnessImpact,
        true
      )

      const transitEvent: AgentTransitEvent = {
        agentId,
        timestamp: sample.t,
        planetaryDegree: actualDegree,
        transitingPlanet: sample.planetaryHour || 'Sun',
        elementalAlignment,
        consciousnessImpact,
        significanceScore,
        planetaryHour: sample.planetaryHour || 'Sun',
        seasonalPhase: sample.seasonalPhase || 'Neutral',
        powerLevel: sample.Energy,
        isExact,
        qualityMetrics: {
          depth: Math.min(consciousnessImpact * 1.2, 1),
          clarity: Math.min(sample.Energy * 0.8, 1),
          resonance: this.calculateResonance(profile, sample),
          temporalAlignment: profile.alignment.includes(sample.planetaryHour || 'Sun') ? 0.9 : 0.5,
        },
      }

      transitEvents.push(transitEvent)
    }

    logger.info('Swisseph batch positions fetched and processed', {
      system: 'temporal-analysis',
      operation: 'getAgentTransitHistory',
      metadata: {
        agentId,
        durationMs: duration,
        totalRequested: batchRequests.length,
        actualFallbackCount,
        successRate:
          batchRequests.length > 0
            ? (batchRequests.length - actualFallbackCount) / batchRequests.length
            : 0,
        fallbackRate: batchRequests.length > 0 ? actualFallbackCount / batchRequests.length : 0,
      },
    })

    return transitEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  /**
   * Detect degree-based patterns across agents with elemental reinforcement
   */
  static async detectDegreePatterns(
    agents: string[],
    timeRange: { start: Date; end: Date },
    location = this.DEFAULT_LOCATION
  ): Promise<TemporalPattern[]> {
    const patterns: TemporalPattern[] = []
    const agentTransits: Record<string, AgentTransitEvent[]> = {}

    // Collect transit data for all agents
    for (const agentId of agents) {
      agentTransits[agentId] = await this.getAgentTransitHistory(
        agentId,
        undefined,
        timeRange,
        location
      )
    }

    // Analyze degree-based patterns
    const degreeActivations: Record<number, AgentTransitEvent[]> = {}

    Object.values(agentTransits)
      .flat()
      .forEach(event => {
        const roundedDegree = Math.round(event.planetaryDegree)
        if (!degreeActivations[roundedDegree]) {
          degreeActivations[roundedDegree] = []
        }
        degreeActivations[roundedDegree].push(event)
      })

    // Find recurring degree activations (3+ agents activating same degree)
    Object.entries(degreeActivations).forEach(([degreeStr, events]) => {
      const degree = parseInt(degreeStr)
      const uniqueAgents = [...new Set(events.map(e => e.agentId))]

      if (uniqueAgents.length >= 3) {
        const elementalSignature = this.calculateAverageElementalSignature(events)
        const reinforcementScore = this.calculateElementalReinforcementScore(
          events.map(e => e.elementalAlignment),
          events.reduce((sum, e) => sum + e.significanceScore, 0) / events.length
        )

        const pattern: TemporalPattern = {
          type: 'recurring_activation',
          degree,
          agents: uniqueAgents,
          frequency: events.length,
          elementalSignature,
          reinforcementScore,
          significance: this.determineSignificance(reinforcementScore, events.length),
          historicalEvents: events,
          peakPeriods: this.identifyPeakPeriods(events),
          description: `Recurring activation at ${degree}° by ${uniqueAgents.length} agents`,
          interpretation: this.generatePatternInterpretation(
            degree,
            elementalSignature,
            uniqueAgents
          ),
        }

        patterns.push(pattern)
      }
    })

    // Find elemental resonance patterns
    const elementalPatterns = this.findElementalResonancePatterns(agentTransits, timeRange)
    patterns.push(...elementalPatterns)

    return patterns.sort((a, b) => b.reinforcementScore - a.reinforcementScore)
  }

  /**
   * Calculate elemental reinforcement score (same elements boost each other)
   */
  static calculateElementalReinforcementScore(
    elements: ElementVector[],
    baseScore: number
  ): number {
    if (elements.length === 0) return baseScore

    const totalElements = {
      Fire: elements.reduce((sum, e) => sum + e.Fire, 0),
      Water: elements.reduce((sum, e) => sum + e.Water, 0),
      Air: elements.reduce((sum, e) => sum + e.Air, 0),
      Earth: elements.reduce((sum, e) => sum + e.Earth, 0),
    }

    // Find the dominant element
    const maxElement = Math.max(...Object.values(totalElements))
    const dominantElementCount = Object.values(totalElements).filter(
      val => val === maxElement
    ).length

    // Same elements reinforce each other (no opposition mechanics)
    let reinforcementMultiplier = 1.0

    if (dominantElementCount === 1) {
      // Clear elemental dominance - boost based on strength
      reinforcementMultiplier = 1.0 + maxElement * 0.15
    } else {
      // Multiple elements present - moderate boost for harmony
      reinforcementMultiplier = 1.0 + maxElement * 0.08
    }

    return baseScore * reinforcementMultiplier
  }

  /**
   * Perform comprehensive temporal analysis
   */
  static async performTemporalAnalysis(query: TemporalQuery): Promise<TemporalAnalysisResult> {
    const parsedQuery =
      query.type === 'natural_language' ? this.parseNaturalLanguage(query.query) : query

    // Use provided agents or default to key historical figures
    const targetAgents = parsedQuery.agents || [
      'leonardo-da-vinci',
      'william-shakespeare',
      'albert-einstein',
      'nikola-tesla',
      'carl-jung',
      'marie-curie',
    ]

    const dateRange = parsedQuery.dateRange || {
      start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
      end: new Date(),
    }

    // Collect transit events
    const transitEvents: AgentTransitEvent[] = []
    for (const agentId of targetAgents) {
      const agentEvents = await this.getAgentTransitHistory(
        agentId,
        parsedQuery.degrees ? [parsedQuery.degrees[0], parsedQuery.degrees[0]] : undefined,
        dateRange,
        parsedQuery.location
      )
      transitEvents.push(...agentEvents)
    }

    // Detect patterns
    const patterns = await this.detectDegreePatterns(targetAgents, dateRange, parsedQuery.location)

    // Calculate reinforcement scores
    const reinforcementScores = this.calculateElementReinforcementScores(transitEvents)

    // Generate insights
    const insights = this.generateInsights(transitEvents, patterns)

    // Generate recommendations
    const recommendations = this.generateRecommendations(transitEvents, patterns, parsedQuery)

    // Initialize result
    const result: TemporalAnalysisResult = {
      query: parsedQuery,
      transitEvents,
      patterns,
      reinforcementScores,
      insights,
      recommendations,
    }

    // Add natal transit analysis if natal chart is provided
    if (parsedQuery.natalChart && parsedQuery.natalChart.length > 0) {
      const natalTransits = await this.performNatalTransitAnalysis(
        parsedQuery.natalChart,
        dateRange,
        parsedQuery.location
      )
      result.natalTransits = natalTransits
    }

    return result
  }

  /**
   * Perform natal transit analysis for personalized insights
   */
  static async performNatalTransitAnalysis(
    natalChart: NatalPlacement[],
    dateRange: { start: Date; end: Date },
    location = this.DEFAULT_LOCATION
  ): Promise<{
    significantTransits: NatalPlacementTransit[]
    degreeAgentMappings: DegreeAgentMapping[]
    transitSignificance: DegreeTransitSignificance[]
  }> {
    const significantTransits: NatalPlacementTransit[] = []
    const degreeAgentMappings: DegreeAgentMapping[] = []
    const transitSignificance: DegreeTransitSignificance[] = []

    // Analyze each day in the date range for significant transits
    const currentDate = new Date(dateRange.start)
    while (currentDate <= dateRange.end) {
      const dayTransits = calculateNatalTransitSignificance(natalChart, currentDate, location)

      significantTransits.push(...dayTransits)
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Get unique degree agent mappings for the natal chart
    const uniqueDegrees = [...new Set(natalChart.map(p => p.degree))]
    for (const degree of uniqueDegrees) {
      const mapping = getDegreeAgents(degree)
      if (mapping) {
        degreeAgentMappings.push(mapping)
      }
    }

    // Find significant transit dates for the year
    const year = dateRange.start.getFullYear()
    const yearlySignificance = findSignificantTransitDates(natalChart, year, location)
    transitSignificance.push(...yearlySignificance)

    return {
      significantTransits: significantTransits
        .sort((a, b) => b.significanceScore - a.significanceScore)
        .slice(0, 50), // Limit to top 50 most significant
      degreeAgentMappings,
      transitSignificance: transitSignificance
        .sort((a, b) => b.significanceScore - a.significanceScore)
        .slice(0, 20), // Limit to top 20 most significant dates
    }
  }

  // Private helper methods

  private static getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0)
    const diff = date.getTime() - start.getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  private static calculateConsciousnessImpact(
    profile: KineticProfile,
    sample: HourlyAlchemicalSample
  ): number {
    const baseRate = profile.evolutionRate
    const hourBonus = profile.alignment.includes(sample.planetaryHour || 'Sun') ? 0.3 : 0
    const energyBonus = sample.Energy * 0.2
    const elementalBonus = this.calculateElementalBonus(profile, sample.totals)

    return Math.min(baseRate + hourBonus + energyBonus + elementalBonus, 1.0)
  }

  private static calculateElementalBonus(profile: KineticProfile, elements: ElementVector): number {
    // Simplified elemental affinity calculation based on agent type
    const totalElemental = elements.Fire + elements.Water + elements.Air + elements.Earth
    return totalElemental > 0 ? Math.min(totalElemental * 0.1, 0.2) : 0
  }

  private static calculateSignificanceScore(
    elementalAlignment: ElementVector,
    consciousnessImpact: number,
    reinforcementMode: boolean
  ): number {
    const baseScore = consciousnessImpact * 0.7
    const elementalScore =
      (elementalAlignment.Fire +
        elementalAlignment.Water +
        elementalAlignment.Air +
        elementalAlignment.Earth) *
      0.3

    const combinedScore = baseScore + elementalScore

    if (reinforcementMode) {
      return this.calculateElementalReinforcementScore([elementalAlignment], combinedScore)
    }

    return combinedScore
  }

  private static calculateResonance(
    profile: KineticProfile,
    sample: HourlyAlchemicalSample
  ): number {
    const hourMatch = profile.alignment.includes(sample.planetaryHour || 'Sun') ? 0.4 : 0.2
    const seasonalMatch = sample.seasonalPhase === 'Spring' ? 0.3 : 0.2 // Simplified
    const energyMatch = Math.min(sample.Energy, 0.3)

    return Math.min(hourMatch + seasonalMatch + energyMatch, 1.0)
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

  private static determineSignificance(
    reinforcementScore: number,
    eventCount: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (reinforcementScore > 0.8 && eventCount >= 10) return 'critical'
    if (reinforcementScore > 0.6 && eventCount >= 7) return 'high'
    if (reinforcementScore > 0.4 && eventCount >= 4) return 'medium'
    return 'low'
  }

  private static identifyPeakPeriods(
    events: AgentTransitEvent[]
  ): { start: Date; end: Date; intensity: number }[] {
    // Group events by time proximity and identify high-intensity clusters
    const periods: { start: Date; end: Date; intensity: number }[] = []

    if (events.length === 0) return periods

    // Sort events by timestamp
    const sortedEvents = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    let currentPeriodStart = sortedEvents[0].timestamp
    let currentPeriodEvents: AgentTransitEvent[] = [sortedEvents[0]]

    for (let i = 1; i < sortedEvents.length; i++) {
      const timeDiff = sortedEvents[i].timestamp.getTime() - sortedEvents[i - 1].timestamp.getTime()
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24)

      if (daysDiff <= 30) {
        // Events within 30 days are part of same period
        currentPeriodEvents.push(sortedEvents[i])
      } else {
        // Finalize current period
        const avgIntensity =
          currentPeriodEvents.reduce((sum, e) => sum + e.significanceScore, 0) /
          currentPeriodEvents.length
        periods.push({
          start: currentPeriodStart,
          end: currentPeriodEvents[currentPeriodEvents.length - 1].timestamp,
          intensity: avgIntensity,
        })

        // Start new period
        currentPeriodStart = sortedEvents[i].timestamp
        currentPeriodEvents = [sortedEvents[i]]
      }
    }

    // Add final period
    if (currentPeriodEvents.length > 0) {
      const avgIntensity =
        currentPeriodEvents.reduce((sum, e) => sum + e.significanceScore, 0) /
        currentPeriodEvents.length
      periods.push({
        start: currentPeriodStart,
        end: currentPeriodEvents[currentPeriodEvents.length - 1].timestamp,
        intensity: avgIntensity,
      })
    }

    return periods.filter(p => p.intensity > 0.5) // Only return significant periods
  }

  private static generatePatternInterpretation(
    degree: number,
    elementalSignature: ElementVector,
    agents: string[]
  ): string {
    const dominantElement = Object.entries(elementalSignature).reduce(
      (max, [element, value]) => (value > max.value ? { element, value } : max),
      { element: 'Fire', value: -1 }
    ).element

    const interpretations = {
      Fire: `${degree}° represents a point of creative ignition and passionate expression`,
      Water: `${degree}° embodies emotional depth and intuitive understanding`,
      Air: `${degree}° signifies intellectual breakthrough and communication mastery`,
      Earth: `${degree}° indicates practical manifestation and material wisdom`,
    }

    return `${interpretations[dominantElement as keyof typeof interpretations]}. Activated by ${agents.length} consciousness entities: ${agents.slice(0, 3).join(', ')}${agents.length > 3 ? '...' : ''}.`
  }

  private static findElementalResonancePatterns(
    agentTransits: Record<string, AgentTransitEvent[]>,
    timeRange: { start: Date; end: Date }
  ): TemporalPattern[] {
    const patterns: TemporalPattern[] = []

    // Group events by element dominance
    const elementalGroups: Record<string, AgentTransitEvent[]> = {
      Fire: [],
      Water: [],
      Air: [],
      Earth: [],
    }

    Object.values(agentTransits)
      .flat()
      .forEach(event => {
        const dominantElement = Object.entries(event.elementalAlignment).reduce(
          (max, [element, value]) => (value > max.value ? { element, value } : max),
          { element: 'Fire', value: -1 }
        ).element

        elementalGroups[dominantElement].push(event)
      })

    // Create patterns for elements with sufficient resonance
    Object.entries(elementalGroups).forEach(([element, events]) => {
      if (events.length >= 5) {
        const uniqueAgents = [...new Set(events.map(e => e.agentId))]
        const avgDegree = events.reduce((sum, e) => sum + e.planetaryDegree, 0) / events.length
        const reinforcementScore = this.calculateElementalReinforcementScore(
          events.map(e => e.elementalAlignment),
          events.reduce((sum, e) => sum + e.significanceScore, 0) / events.length
        )

        const pattern: TemporalPattern = {
          type: 'elemental_resonance',
          degree: Math.round(avgDegree),
          agents: uniqueAgents,
          frequency: events.length,
          elementalSignature: this.calculateAverageElementalSignature(events),
          reinforcementScore,
          significance: this.determineSignificance(reinforcementScore, events.length),
          historicalEvents: events,
          peakPeriods: this.identifyPeakPeriods(events),
          description: `${element} elemental resonance pattern across ${uniqueAgents.length} agents`,
          interpretation: `Strong ${element} element manifestation indicates ${this.getElementalMeaning(element)} themes in consciousness evolution.`,
        }

        patterns.push(pattern)
      }
    })

    return patterns
  }

  private static getElementalMeaning(element: string): string {
    const meanings = {
      Fire: 'creative inspiration and passionate action',
      Water: 'emotional wisdom and intuitive insights',
      Air: 'intellectual breakthroughs and communication',
      Earth: 'practical manifestation and grounded wisdom',
    }
    return meanings[element as keyof typeof meanings] || 'balanced consciousness'
  }

  private static calculateElementReinforcementScores(
    events: AgentTransitEvent[]
  ): { element: string; score: number }[] {
    const elementTotals = { Fire: 0, Water: 0, Air: 0, Earth: 0 }

    events.forEach(event => {
      elementTotals.Fire += event.elementalAlignment.Fire
      elementTotals.Water += event.elementalAlignment.Water
      elementTotals.Air += event.elementalAlignment.Air
      elementTotals.Earth += event.elementalAlignment.Earth
    })

    return Object.entries(elementTotals)
      .map(([element, total]) => ({
        element,
        score: this.calculateElementalReinforcementScore(
          events.map(e => e.elementalAlignment),
          total / events.length
        ),
      }))
      .sort((a, b) => b.score - a.score)
  }

  private static generateInsights(events: AgentTransitEvent[], patterns: TemporalPattern[]) {
    const elementalTotals = { Fire: 0, Water: 0, Air: 0, Earth: 0 }
    events.forEach(event => {
      elementalTotals.Fire += event.elementalAlignment.Fire
      elementalTotals.Water += event.elementalAlignment.Water
      elementalTotals.Air += event.elementalAlignment.Air
      elementalTotals.Earth += event.elementalAlignment.Earth
    })

    const dominantElements = Object.entries(elementalTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([element]) => element)

    const peakPeriods = patterns
      .flatMap(p => p.peakPeriods)
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 3)
      .map(period => ({
        start: period.start,
        end: period.end,
        description: `High intensity period (${period.intensity.toFixed(2)} resonance)`,
      }))

    const agentResonance = Object.entries(
      events.reduce(
        (acc, event) => {
          acc[event.agentId] = (acc[event.agentId] || 0) + event.qualityMetrics.resonance
          return acc
        },
        {} as Record<string, number>
      )
    )
      .map(([agentId, totalResonance]) => ({
        agentId,
        resonanceScore: totalResonance / events.filter(e => e.agentId === agentId).length,
      }))
      .sort((a, b) => b.resonanceScore - a.resonanceScore)

    const degreeActivations = events.reduce(
      (acc, event) => {
        const degree = Math.round(event.planetaryDegree)
        if (!acc[degree]) acc[degree] = { count: 0, agents: new Set<string>() }
        acc[degree].count++
        acc[degree].agents.add(event.agentId)
        return acc
      },
      {} as Record<number, { count: number; agents: Set<string> }>
    )

    const degreeHotspots = Object.entries(degreeActivations)
      .map(([degree, data]) => ({
        degree: parseInt(degree),
        activationCount: data.count,
        agents: Array.from(data.agents),
      }))
      .sort((a, b) => b.activationCount - a.activationCount)
      .slice(0, 5)

    return {
      dominantElements,
      peakPeriods,
      agentResonance,
      degreeHotspots,
    }
  }

  private static generateRecommendations(
    events: AgentTransitEvent[],
    patterns: TemporalPattern[],
    query: TemporalQuery
  ) {
    const optimalQueryTimes: string[] = []
    const hourCounts = events.reduce(
      (acc, event) => {
        acc[event.planetaryHour] = (acc[event.planetaryHour] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .forEach(([hour]) => {
        optimalQueryTimes.push(`${hour} hour for enhanced temporal resonance`)
      })

    const suggestedAgents = events.reduce(
      (acc, event) => {
        acc[event.agentId] = (acc[event.agentId] || 0) + event.significanceScore
        return acc
      },
      {} as Record<string, number>
    )

    const topAgents = Object.entries(suggestedAgents)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([agentId]) => agentId)

    const relatedPatterns = patterns
      .filter(p => p.significance === 'high' || p.significance === 'critical')
      .slice(0, 3)
      .map(p => `${p.type} at ${p.degree}° (${p.significance} significance)`)

    const deepDiveOpportunities = [
      `Explore ${patterns.length > 0 ? patterns[0].degree : 'key'}° activation patterns in detail`,
      `Investigate elemental reinforcement during peak periods`,
      `Compare consciousness evolution rates across selected agents`,
    ]

    return {
      optimalQueryTimes,
      suggestedAgents: topAgents,
      relatedPatterns,
      deepDiveOpportunities,
    }
  }
}
