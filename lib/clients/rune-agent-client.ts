/**
 * Backend-first Rune/Agent Client
 * Generates runes of the moment and gets agent recommendations
 * Falls back to local generation if backend is unavailable
 */

import { generateSignVectorRune } from '@/lib/runes/sign-vector-runes'
import { createNatalSigilRune } from '@/lib/runes/natal-sigil-runes'
import type { CraftedAgent } from '@/lib/agent-types'
import { demoCraftedAgents } from '@/lib/demo-agents-data'
import { CharacterVectorCalculator } from '@/lib/astrological-character-vectors'

// Types
export interface RuneGenerationRequest {
  datetime: Date
  location: { latitude: number; longitude: number }
  context?: 'cuisine' | 'general' | 'manifestation' | 'protection'
  preferences?: {
    cuisineTypes?: string[]
    dietaryRestrictions?: string[]
    intensity?: 'gentle' | 'moderate' | 'intense'
  }
}

export interface RuneOfTheMoment {
  id: string
  name: string
  symbol: string
  description: string
  element: 'fire' | 'water' | 'earth' | 'air' | 'spirit'
  powerLevel: number
  guidance: string
  culinaryInfluence: {
    element: string
    suggestions: string[]
    avoid: string[]
    cookingMethods: string[]
    seasonalAlignment: string
  }
  activationWindow: {
    start: Date
    end: Date
    optimalMoment: Date
  }
}

export interface AgentRecommendation {
  agentId: string
  name: string
  title: string
  resonanceScore: number
  personalityMatch: number
  temporalAlignment: number
  overallScore: number
  reasoning: string[]
  culinarySpecialty: string[]
  recommendedInteractionStyle: 'conversational' | 'instructional' | 'collaborative'
}

export interface RuneAgentResult {
  rune: RuneOfTheMoment
  agent: AgentRecommendation
  synergy: {
    score: number
    description: string
    enhancedCapabilities: string[]
  }
  metadata: {
    source: 'backend' | 'local_fallback'
    generationTime: number
    datetime: string
    location: string
  }
}

export class RuneAgentClient {
  private static backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
  private static useBackend = process.env.NEXT_PUBLIC_RUNE_AGENT_BACKEND === 'true'

  /**
   * Generate complete rune and agent recommendation
   */
  static async generateComplete(request: RuneGenerationRequest): Promise<RuneAgentResult> {
    const startTime = Date.now()

    if (this.useBackend) {
      try {
        const backendResult = await this.callBackend(request)
        if (backendResult) {
          return {
            ...backendResult,
            metadata: {
              ...backendResult.metadata,
              generationTime: Date.now() - startTime,
              source: 'backend',
            },
          }
        }
      } catch (error) {
        console.warn('Backend rune/agent generation failed, falling back to local:', error)
      }
    }

    // Local fallback
    return this.generateLocal(request, startTime)
  }

  /**
   * Generate just the rune of the moment
   */
  static async generateRune(request: RuneGenerationRequest): Promise<RuneOfTheMoment> {
    const complete = await this.generateComplete(request)
    return complete.rune
  }

  /**
   * Get just agent recommendations
   */
  static async getAgentRecommendation(
    request: RuneGenerationRequest
  ): Promise<AgentRecommendation> {
    const complete = await this.generateComplete(request)
    return complete.agent
  }

  /**
   * Call backend for rune and agent generation
   */
  private static async callBackend(
    request: RuneGenerationRequest
  ): Promise<RuneAgentResult | null> {
    try {
      // Try backend rune generation
      const runeResponse = await fetch(`${this.backendUrl}/api/alchemy/imaginize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: request.location,
          datetime: request.datetime.toISOString(),
          context: request.context || 'cuisine',
        }),
      })

      // Try backend agent recommendation
      const agentResponse = await fetch(`${this.backendUrl}/api/consciousness/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: request.location,
          datetime: request.datetime.toISOString(),
          preferences: request.preferences,
        }),
      })

      let rune: RuneOfTheMoment | null = null
      let agent: AgentRecommendation | null = null

      // Process rune response
      if (runeResponse.ok) {
        const runeData = await runeResponse.json()
        if (runeData.success && runeData.rune) {
          rune = this.transformBackendRune(runeData.rune)
        }
      }

      // Process agent response
      if (agentResponse.ok) {
        const agentData = await agentResponse.json()
        if (agentData.success && agentData.recommendation) {
          agent = this.transformBackendAgent(agentData.recommendation)
        }
      }

      // If we got both, combine them
      if (rune && agent) {
        return {
          rune,
          agent,
          synergy: this.calculateSynergy(rune, agent),
          metadata: {
            source: 'backend',
            generationTime: 0,
            datetime: request.datetime.toISOString(),
            location: `${request.location.latitude},${request.location.longitude}`,
          },
        }
      }

      return null
    } catch (error) {
      console.error('Error calling backend rune/agent service:', error)
      return null
    }
  }

  /**
   * Transform backend rune response
   */
  private static transformBackendRune(backendRune: any): RuneOfTheMoment {
    return {
      id: backendRune.id || `rune-${Date.now()}`,
      name: backendRune.name || 'Moment Rune',
      symbol: backendRune.symbol || '☆',
      description: backendRune.description || 'A rune of the current moment',
      element: backendRune.element || 'spirit',
      powerLevel: backendRune.powerLevel || 75,
      guidance: backendRune.guidance || "Trust the moment's wisdom",
      culinaryInfluence:
        backendRune.culinaryInfluence || this.getDefaultCulinaryInfluence('spirit'),
      activationWindow: {
        start: new Date(),
        end: new Date(Date.now() + 3600000), // 1 hour
        optimalMoment: new Date(Date.now() + 1800000), // 30 minutes
      },
    }
  }

  /**
   * Transform backend agent response
   */
  private static transformBackendAgent(backendAgent: any): AgentRecommendation {
    return {
      agentId: backendAgent.agentId || 'consciousness-mirror',
      name: backendAgent.name || 'Consciousness Mirror',
      title: backendAgent.title || 'Universal Guide',
      resonanceScore: backendAgent.resonanceScore || 85,
      personalityMatch: backendAgent.personalityMatch || 80,
      temporalAlignment: backendAgent.temporalAlignment || 90,
      overallScore: backendAgent.overallScore || 85,
      reasoning: backendAgent.reasoning || [
        'Strong temporal alignment',
        'High consciousness resonance',
      ],
      culinarySpecialty: backendAgent.culinarySpecialty || [
        'Intuitive cooking',
        'Elemental balance',
      ],
      recommendedInteractionStyle: backendAgent.recommendedInteractionStyle || 'collaborative',
    }
  }

  /**
   * Local fallback generation
   */
  private static async generateLocal(
    request: RuneGenerationRequest,
    startTime: number
  ): Promise<RuneAgentResult> {
    try {
      // Generate local rune
      const rune = await this.generateLocalRune(request)

      // Get local agent recommendation
      const agent = await this.generateLocalAgent(request)

      // Calculate synergy
      const synergy = this.calculateSynergy(rune, agent)

      return {
        rune,
        agent,
        synergy,
        metadata: {
          source: 'local_fallback',
          generationTime: Date.now() - startTime,
          datetime: request.datetime.toISOString(),
          location: `${request.location.latitude},${request.location.longitude}`,
        },
      }
    } catch (error) {
      console.error('Local rune/agent generation failed:', error)
      return this.getEmergencyFallback(request, startTime)
    }
  }

  /**
   * Generate local rune using existing rune systems
   */
  private static async generateLocalRune(request: RuneGenerationRequest): Promise<RuneOfTheMoment> {
    const hour = request.datetime.getHours()
    const minute = request.datetime.getMinutes()

    // Generate a valid ChartCharacterProfile using CharacterVectorCalculator
    const signs = [
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
    const placements = [
      { planet: 'sun', sign: signs[hour % 12] },
      { planet: 'moon', sign: signs[(hour + 2) % 12] },
      { planet: 'mercury', sign: signs[(hour + 1) % 12] },
      { planet: 'venus', sign: signs[(hour + 3) % 12] },
      { planet: 'mars', sign: signs[(hour + 4) % 12] },
      { planet: 'jupiter', sign: signs[(hour + 5) % 12] },
      { planet: 'saturn', sign: signs[(hour + 6) % 12] },
      { planet: 'ascendant', sign: signs[(hour + 7) % 12] },
    ]
    const chartProfile = CharacterVectorCalculator.generateChartCharacterProfile(placements)

    // Use existing rune generation system
    const signVectorRune = generateSignVectorRune(chartProfile, 'moment')

    // Transform to our interface
    return {
      id: signVectorRune.id,
      name: signVectorRune.name,
      symbol: signVectorRune.symbol,
      description:
        signVectorRune.description ||
        `A ${signVectorRune.element} rune channeling the energy of this moment`,
      element: signVectorRune.element,
      powerLevel: signVectorRune.powerLevel || 75,
      guidance: this.generateRuneGuidance(signVectorRune, request.context),
      culinaryInfluence: this.generateCulinaryInfluence(signVectorRune, request.preferences),
      activationWindow: {
        start: request.datetime,
        end: new Date(request.datetime.getTime() + 3600000), // 1 hour
        optimalMoment: new Date(request.datetime.getTime() + 1800000), // 30 minutes
      },
    }
  }

  /**
   * Generate local agent recommendation
   */
  private static async generateLocalAgent(
    request: RuneGenerationRequest
  ): Promise<AgentRecommendation> {
    const hour = request.datetime.getHours()
    const currentPlanetaryHour = this.getPlanetaryHour(hour)

    // Score all available agents for current moment
    const scoredAgents = demoCraftedAgents.map(agent => {
      let score = 0
      const reasoning: string[] = []

      // Temporal alignment (40% weight)
      const temporalScore = this.calculateTemporalAlignment(agent, hour, currentPlanetaryHour)
      score += temporalScore * 0.4
      if (temporalScore > 0.7) reasoning.push('Strong temporal alignment')

      // Context relevance (30% weight)
      const contextScore = this.calculateContextRelevance(
        agent,
        request.context,
        request.preferences
      )
      score += contextScore * 0.3
      if (contextScore > 0.8) reasoning.push('Excellent context match')

      // Consciousness level (20% weight)
      const consciousnessScore = agent.consciousness.monicaConstant / 2
      score += consciousnessScore * 0.2
      if (consciousnessScore > 0.8) reasoning.push('High consciousness alignment')

      // Culinary expertise (10% weight)
      const culinaryScore = this.calculateCulinaryExpertise(agent, request.preferences)
      score += culinaryScore * 0.1
      if (culinaryScore > 0.7) reasoning.push('Strong culinary expertise')

      return {
        agent,
        score: Math.min(1, score),
        reasoning,
        temporalAlignment: temporalScore,
        contextRelevance: contextScore,
        culinaryExpertise: culinaryScore,
      }
    })

    // Get top agent
    const topAgent = scoredAgents.sort((a, b) => b.score - a.score)[0]

    if (!topAgent) {
      throw new Error('No suitable agent found')
    }

    return {
      agentId: topAgent.agent.id,
      name: topAgent.agent.name,
      title: topAgent.agent.title,
      resonanceScore: Math.round(topAgent.score * 100),
      personalityMatch: Math.round(topAgent.contextRelevance * 100),
      temporalAlignment: Math.round(topAgent.temporalAlignment * 100),
      overallScore: Math.round(topAgent.score * 100),
      reasoning: topAgent.reasoning.length > 0 ? topAgent.reasoning : ['Good overall alignment'],
      culinarySpecialty: this.getCulinarySpecialties(topAgent.agent, request.preferences),
      recommendedInteractionStyle:
        topAgent.score > 0.8
          ? 'collaborative'
          : topAgent.score > 0.6
            ? 'conversational'
            : 'instructional',
    }
  }

  /**
   * Calculate synergy between rune and agent
   */
  private static calculateSynergy(
    rune: RuneOfTheMoment,
    agent: AgentRecommendation
  ): {
    score: number
    description: string
    enhancedCapabilities: string[]
  } {
    // Calculate elemental compatibility
    const elementalCompatibility = this.getElementalCompatibility(rune.element)

    // Calculate power alignment
    const powerAlignment = (rune.powerLevel / 100) * (agent.overallScore / 100)

    // Overall synergy score
    const score = elementalCompatibility * 0.6 + powerAlignment * 0.4

    const enhancedCapabilities = []
    if (score > 0.8) {
      enhancedCapabilities.push('Amplified intuition', 'Enhanced manifestation power')
    }
    if (rune.element === 'fire' && agent.overallScore > 80) {
      enhancedCapabilities.push('Accelerated transformation')
    }
    if (rune.element === 'water' && agent.personalityMatch > 80) {
      enhancedCapabilities.push('Emotional harmony')
    }

    return {
      score: Math.round(score * 100),
      description: this.getSynergyDescription(score, rune.element),
      enhancedCapabilities,
    }
  }

  // Helper methods
  private static getDominantElementForTime(hour: number): string {
    const elements = ['fire', 'earth', 'air', 'water']
    return elements[hour % 4]
  }

  private static calculateElementalBalance(datetime: Date, location: any) {
    return {
      fire: 0.3 + (datetime.getHours() / 24) * 0.4,
      earth: 0.4 + (Math.abs(location.latitude) / 90) * 0.3,
      air: 0.25 + (datetime.getMinutes() / 60) * 0.3,
      water: 0.35 + (Math.abs(location.longitude) / 180) * 0.3,
    }
  }

  private static getPlanetaryInfluences(hour: number) {
    const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
    return [planets[hour % 7]]
  }

  private static getPlanetaryHour(hour: number): string {
    const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
    return planets[hour % 7]
  }

  private static calculateTemporalAlignment(
    agent: any,
    hour: number,
    planetaryHour: string
  ): number {
    // Base alignment
    let score = 0.5

    // Check if agent is aligned with current planetary hour
    if (agent.stats?.kineticEvolution?.optimalInteractionHours) {
      const optimalHours = agent.stats.kineticEvolution.optimalInteractionHours
      const isOptimal = optimalHours.some((range: string) => {
        const [start, end] = range.split('-').map(Number)
        return hour >= start && hour <= end
      })
      if (isOptimal) score += 0.3
    }

    // Consciousness level bonus
    if (agent.consciousness?.monicaConstant > 1.5) {
      score += 0.2
    }

    return Math.min(1, score)
  }

  private static calculateContextRelevance(
    agent: any,
    context?: string,
    preferences?: any
  ): number {
    let score = 0.6 // Base score

    if (context === 'cuisine') {
      // Check if agent has culinary-related abilities
      if (
        agent.title.toLowerCase().includes('chef') ||
        agent.title.toLowerCase().includes('food') ||
        agent.name.toLowerCase().includes('culinary')
      ) {
        score += 0.3
      }

      // Check consciousness level for food wisdom
      if (agent.consciousness?.monicaConstant > 1.2) {
        score += 0.1
      }
    }

    return Math.min(1, score)
  }

  private static calculateCulinaryExpertise(agent: any, preferences?: any): number {
    let score = 0.5 // Base culinary ability

    // Check agent specialties
    if (
      agent.specialties?.includes('nutrition') ||
      agent.specialties?.includes('cooking') ||
      agent.title.toLowerCase().includes('wellness')
    ) {
      score += 0.3
    }

    // Consciousness-based culinary wisdom
    const consciousnessBonus = Math.min(0.2, agent.consciousness?.monicaConstant / 10)
    score += consciousnessBonus

    return Math.min(1, score)
  }

  private static getCulinarySpecialties(agent: any, preferences?: any): string[] {
    const specialties = ['Intuitive cooking', 'Seasonal alignment']

    if (agent.consciousness?.monicaConstant > 1.5) {
      specialties.push('Consciousness-based nutrition')
    }

    if (preferences?.cuisineTypes?.length) {
      specialties.push(`${preferences.cuisineTypes[0]} cuisine expertise`)
    }

    return specialties
  }

  private static generateRuneGuidance(rune: any, context?: string): string {
    const element = rune.element
    const baseGuidance = {
      fire: 'Embrace transformation and bold action in your culinary journey',
      water: 'Flow with intuition and emotional nourishment in your choices',
      earth: 'Ground yourself with wholesome, nurturing ingredients',
      air: 'Seek lightness, clarity, and inspiration in your meals',
      spirit: 'Trust the divine wisdom that guides your sustenance',
    }

    return (
      baseGuidance[element as keyof typeof baseGuidance] ||
      'Follow the path that nourishes your soul'
    )
  }

  private static generateCulinaryInfluence(rune: any, preferences?: any) {
    const element = rune.element
    const influences = {
      fire: {
        element: 'Fire',
        suggestions: ['Spicy dishes', 'Grilled foods', 'Energizing spices', 'Red foods'],
        avoid: ['Cold foods', 'Raw dishes in excess', 'Heavy dairy'],
        cookingMethods: ['Grilling', 'Sautéing', 'Roasting', 'Flambéing'],
        seasonalAlignment: 'Summer foods, warming spices',
      },
      water: {
        element: 'Water',
        suggestions: ['Soups', 'Stews', 'Hydrating foods', 'Ocean-based proteins'],
        avoid: ['Excessive salt', 'Dehydrating foods', 'Over-spiced dishes'],
        cookingMethods: ['Steaming', 'Poaching', 'Braising', 'Simmering'],
        seasonalAlignment: 'Fresh seasonal produce, cooling foods',
      },
      earth: {
        element: 'Earth',
        suggestions: ['Root vegetables', 'Grains', 'Legumes', 'Hearty meals'],
        avoid: ['Processed foods', 'Artificial ingredients', 'Light meals when grounding needed'],
        cookingMethods: ['Slow cooking', 'Baking', 'Roasting', 'Pressure cooking'],
        seasonalAlignment: 'Seasonal local produce, comfort foods',
      },
      air: {
        element: 'Air',
        suggestions: ['Light meals', 'Fresh herbs', 'Salads', 'Fermented foods'],
        avoid: ['Heavy foods', 'Excessive meat', 'Overly rich dishes'],
        cookingMethods: ['Raw preparation', 'Light sautéing', 'Quick cooking', 'Fermentation'],
        seasonalAlignment: 'Spring foods, light and airy preparations',
      },
    }

    return influences[element as keyof typeof influences] || influences.fire
  }

  private static getDefaultCulinaryInfluence(element: string) {
    return this.generateCulinaryInfluence({ element }, {})
  }

  private static getElementalCompatibility(element: string): number {
    // All elements are compatible in our system - same element highest compatibility
    return element ? 0.9 : 0.7
  }

  private static getSynergyDescription(score: number, element: string): string {
    if (score > 0.8) {
      return `Powerful ${element} synergy creates amplified manifestation potential`
    } else if (score > 0.6) {
      return `Good ${element} alignment supports harmonious collaboration`
    } else {
      return `Moderate compatibility allows for balanced guidance`
    }
  }

  /**
   * Emergency fallback with minimal functionality
   */
  private static getEmergencyFallback(
    request: RuneGenerationRequest,
    startTime: number
  ): RuneAgentResult {
    return {
      rune: {
        id: `emergency-rune-${Date.now()}`,
        name: 'Moment Essence',
        symbol: '☆',
        description: 'A simple rune of the current moment',
        element: 'spirit',
        powerLevel: 50,
        guidance: 'Trust your inner wisdom in this moment',
        culinaryInfluence: this.getDefaultCulinaryInfluence('spirit'),
        activationWindow: {
          start: request.datetime,
          end: new Date(request.datetime.getTime() + 3600000),
          optimalMoment: new Date(request.datetime.getTime() + 1800000),
        },
      },
      agent: {
        agentId: 'universal-guide',
        name: 'Universal Guide',
        title: 'Culinary Companion',
        resonanceScore: 75,
        personalityMatch: 70,
        temporalAlignment: 80,
        overallScore: 75,
        reasoning: ['Available as universal guidance'],
        culinarySpecialty: ['Balanced nutrition', 'Mindful eating'],
        recommendedInteractionStyle: 'conversational',
      },
      synergy: {
        score: 70,
        description: 'Balanced universal guidance available',
        enhancedCapabilities: ['Basic culinary wisdom'],
      },
      metadata: {
        source: 'local_fallback',
        generationTime: Date.now() - startTime,
        datetime: request.datetime.toISOString(),
        location: `${request.location.latitude},${request.location.longitude}`,
      },
    }
  }
}
