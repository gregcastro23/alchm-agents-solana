/**
 * Enhanced Monica Router
 * Implements supervisor-pattern routing with observability tracking
 * Based on LangGraph multi-agent best practices
 */

import type { UnifiedAgent } from '@/lib/unified-agent-types'
import { observabilityTracker } from '@/lib/observability/tracker'

export interface RoutingDecision {
  selectedAgents: UnifiedAgent[]
  reason: string
  confidence: number // 0-1
  routingStrategy: 'single' | 'multi' | 'all'
}

export interface RoutingContext {
  message: string
  availableAgents: UnifiedAgent[]
  conversationHistory?: Array<{ role: string; content: string }>
  userIntent?: string[]
}

/**
 * Monica's enhanced routing logic
 * Acts as supervisor to route queries to specialized agents
 */
export class MonicaRouter {
  /**
   * Analyze user message and determine which agents should respond
   * This is the core routing logic that replaces simple "send to all" approach
   */
  async route(context: RoutingContext, traceId?: string): Promise<RoutingDecision> {
    const { message, availableAgents, conversationHistory } = context

    // Analyze message intent
    const intent = this.analyzeIntent(message, conversationHistory)

    // Route based on agent specialties
    const routingDecision = this.selectAgents(intent, availableAgents)

    // Record routing decision in observability if traceId provided
    if (traceId) {
      routingDecision.selectedAgents.forEach(agent => {
        observabilityTracker.recordRoutingDecision(
          traceId,
          null, // Monica is initial router
          agent.id,
          routingDecision.reason,
          routingDecision.confidence
        )
      })
    }

    return routingDecision
  }

  /**
   * Analyze user intent from message
   */
  private analyzeIntent(
    message: string,
    history?: Array<{ role: string; content: string }>
  ): {
    primaryIntent: string
    secondaryIntents: string[]
    keywords: string[]
  } {
    const lowerMessage = message.toLowerCase()

    // Intent patterns
    const intentPatterns = {
      astrological: [
        'birth chart',
        'natal',
        'zodiac',
        'planets',
        'aspects',
        'horoscope',
        'astrology',
        'planetary',
      ],
      historical: ['what would', 'how did', 'historical', 'era', 'period', 'philosophy', 'teach'],
      consciousness: [
        'consciousness',
        'awareness',
        'spiritual',
        'evolution',
        'enlightenment',
        'meditation',
      ],
      tarot: ['tarot', 'cards', 'reading', 'spread', 'oracle'],
      celestial: [
        'moon',
        'sun',
        'mars',
        'venus',
        'mercury',
        'jupiter',
        'saturn',
        'uranus',
        'neptune',
        'pluto',
      ],
      temporal: ['time', 'timing', 'when', 'moment', 'now', 'today', 'planetary hour'],
      synthesis: ['combine', 'together', 'group', 'council', 'all agents'],
    }

    // Detect primary intent
    let primaryIntent = 'general'
    let maxMatches = 0

    Object.entries(intentPatterns).forEach(([intent, patterns]) => {
      const matches = patterns.filter(pattern => lowerMessage.includes(pattern)).length
      if (matches > maxMatches) {
        maxMatches = matches
        primaryIntent = intent
      }
    })

    // Detect secondary intents
    const secondaryIntents: string[] = []
    Object.entries(intentPatterns).forEach(([intent, patterns]) => {
      if (intent !== primaryIntent) {
        const matches = patterns.filter(pattern => lowerMessage.includes(pattern)).length
        if (matches > 0) {
          secondaryIntents.push(intent)
        }
      }
    })

    // Extract keywords
    const keywords = lowerMessage
      .split(' ')
      .filter(word => word.length > 4)
      .slice(0, 10)

    return {
      primaryIntent,
      secondaryIntents,
      keywords,
    }
  }

  /**
   * Select appropriate agents based on intent
   */
  private selectAgents(
    intent: { primaryIntent: string; secondaryIntents: string[]; keywords: string[] },
    availableAgents: UnifiedAgent[]
  ): RoutingDecision {
    // Route based on primary intent
    switch (intent.primaryIntent) {
      case 'astrological':
        return this.routeAstrological(intent, availableAgents)

      case 'historical':
        return this.routeHistorical(intent, availableAgents)

      case 'consciousness':
        return this.routeConsciousness(intent, availableAgents)

      case 'tarot':
        return this.routeTarot(intent, availableAgents)

      case 'celestial':
        return this.routeCelestial(intent, availableAgents)

      case 'temporal':
        return this.routeTemporal(intent, availableAgents)

      case 'synthesis':
        return this.routeSynthesis(intent, availableAgents)

      default:
        return this.routeGeneral(intent, availableAgents)
    }
  }

  /**
   * Route astrological queries
   */
  private routeAstrological(intent: any, availableAgents: UnifiedAgent[]): RoutingDecision {
    // Prefer planetary agents for astrological queries
    const planetaryAgents = availableAgents.filter(a => a.type === 'planetary')

    if (planetaryAgents.length > 0) {
      return {
        selectedAgents: planetaryAgents.slice(0, 3), // Top 3 planetary agents
        reason: 'Routing to planetary agents for astrological insight',
        confidence: 0.9,
        routingStrategy: 'multi',
      }
    }

    // Fallback to historical agents with astrological knowledge
    const astrologicalHistorical = availableAgents.filter(
      a =>
        a.type === 'historical' &&
        (a.capabilities?.wisdomDomains?.includes('astrology') ||
          a.capabilities?.specialty?.toLowerCase().includes('astrology'))
    )

    if (astrologicalHistorical.length > 0) {
      return {
        selectedAgents: astrologicalHistorical.slice(0, 2),
        reason: 'Routing to historical agents with astrological expertise',
        confidence: 0.75,
        routingStrategy: 'multi',
      }
    }

    return this.routeGeneral(intent, availableAgents)
  }

  /**
   * Route historical queries
   */
  private routeHistorical(intent: any, availableAgents: UnifiedAgent[]): RoutingDecision {
    // Prefer historical agents
    const historicalAgents = availableAgents.filter(a => a.type === 'historical')

    if (historicalAgents.length > 0) {
      // Try to match era or specialty from keywords
      const matchedAgents = historicalAgents.filter(agent => {
        const agentInfo =
          `${agent.name} ${agent.title} ${agent.capabilities?.specialty}`.toLowerCase()
        return intent.keywords.some((keyword: string) => agentInfo.includes(keyword))
      })

      if (matchedAgents.length > 0) {
        return {
          selectedAgents: matchedAgents.slice(0, 2),
          reason: `Routing to historical agents matching query context`,
          confidence: 0.9,
          routingStrategy: 'multi',
        }
      }

      // Otherwise, select diverse historical agents
      return {
        selectedAgents: historicalAgents.slice(0, 3),
        reason: 'Routing to diverse historical perspectives',
        confidence: 0.8,
        routingStrategy: 'multi',
      }
    }

    return this.routeGeneral(intent, availableAgents)
  }

  /**
   * Route consciousness/spiritual queries
   */
  private routeConsciousness(intent: any, availableAgents: UnifiedAgent[]): RoutingDecision {
    // Prefer agents with high consciousness levels
    const highConsciousnessAgents = availableAgents
      .filter(a => a.consciousness.monicaConstant > 4.0)
      .sort((a, b) => b.consciousness.monicaConstant - a.consciousness.monicaConstant)

    if (highConsciousnessAgents.length > 0) {
      return {
        selectedAgents: highConsciousnessAgents.slice(0, 3),
        reason: 'Routing to high-consciousness agents for spiritual guidance',
        confidence: 0.95,
        routingStrategy: 'multi',
      }
    }

    return this.routeGeneral(intent, availableAgents)
  }

  /**
   * Route tarot queries
   */
  private routeTarot(intent: any, availableAgents: UnifiedAgent[]): RoutingDecision {
    // For tarot, we want agents with intuition and mystical expertise
    const tarotAgents = availableAgents.filter(
      a =>
        a.capabilities?.wisdomDomains?.includes('divination') ||
        a.capabilities?.specialty?.toLowerCase().includes('mystical') ||
        (a.stats as any)?.intuition > 80
    )

    if (tarotAgents.length > 0) {
      return {
        selectedAgents: tarotAgents.slice(0, 2),
        reason: 'Routing to agents with divinatory expertise',
        confidence: 0.85,
        routingStrategy: 'multi',
      }
    }

    return this.routeGeneral(intent, availableAgents)
  }

  /**
   * Route celestial queries
   */
  private routeCelestial(intent: any, availableAgents: UnifiedAgent[]): RoutingDecision {
    // Always include planetary agents for celestial queries
    const planetaryAgents = availableAgents.filter(a => a.type === 'planetary')

    return {
      selectedAgents: planetaryAgents.length > 0 ? planetaryAgents : availableAgents,
      reason: 'Routing to planetary agents for celestial insights',
      confidence: planetaryAgents.length > 0 ? 0.95 : 0.6,
      routingStrategy: planetaryAgents.length > 0 ? 'all' : 'multi',
    }
  }

  /**
   * Route temporal/timing queries
   */
  private routeTemporal(intent: any, availableAgents: UnifiedAgent[]): RoutingDecision {
    // Temporal queries benefit from multiple perspectives
    const diverseAgents = this.selectDiverseAgents(availableAgents, 3)

    return {
      selectedAgents: diverseAgents,
      reason: 'Routing to diverse agents for temporal analysis',
      confidence: 0.8,
      routingStrategy: 'multi',
    }
  }

  /**
   * Route synthesis/group queries
   */
  private routeSynthesis(intent: any, availableAgents: UnifiedAgent[]): RoutingDecision {
    // User explicitly wants multiple perspectives
    return {
      selectedAgents: availableAgents,
      reason: 'User requested group synthesis - routing to all agents',
      confidence: 1.0,
      routingStrategy: 'all',
    }
  }

  /**
   * General routing fallback
   */
  private routeGeneral(intent: any, availableAgents: UnifiedAgent[]): RoutingDecision {
    // Select 2-3 diverse agents
    const selected = this.selectDiverseAgents(availableAgents, 3)

    return {
      selectedAgents: selected,
      reason: 'General query - routing to diverse agent perspectives',
      confidence: 0.7,
      routingStrategy: 'multi',
    }
  }

  /**
   * Select diverse agents (different types, eras, elements)
   */
  private selectDiverseAgents(agents: UnifiedAgent[], count: number): UnifiedAgent[] {
    const selected: UnifiedAgent[] = []
    const usedTypes = new Set<string>()
    const usedElements = new Set<string>()

    // Prioritize diversity
    for (const agent of agents) {
      if (selected.length >= count) break

      const isNewType = !usedTypes.has(agent.type)
      const isNewElement = !usedElements.has(agent.consciousness.dominantElement)

      if (isNewType || isNewElement) {
        selected.push(agent)
        usedTypes.add(agent.type)
        usedElements.add(agent.consciousness.dominantElement)
      }
    }

    // Fill remaining slots if needed
    for (const agent of agents) {
      if (selected.length >= count) break
      if (!selected.includes(agent)) {
        selected.push(agent)
      }
    }

    return selected.slice(0, count)
  }

  /**
   * Evaluate if routing decision was correct
   * Called after response is generated to improve routing logic
   */
  evaluateRoutingQuality(
    decision: RoutingDecision,
    userMessage: string,
    agentResponses: Array<{ agentId: string; content: string }>
  ): {
    wasCorrect: boolean
    improvementSuggestion?: string
  } {
    // Simple heuristics - in production, use LLM-as-judge
    const avgResponseLength =
      agentResponses.reduce((sum, r) => sum + r.content.length, 0) / agentResponses.length

    // Check if responses were substantial
    const wasSubstantial = avgResponseLength > 100

    // Check if too many agents (inefficient)
    const tooManyAgents = agentResponses.length > 4

    // Check if too few agents (might miss insights)
    const tooFewAgents = agentResponses.length < 2 && decision.routingStrategy !== 'single'

    if (!wasSubstantial) {
      return {
        wasCorrect: false,
        improvementSuggestion:
          'Agents provided shallow responses - consider routing to higher consciousness agents',
      }
    }

    if (tooManyAgents) {
      return {
        wasCorrect: false,
        improvementSuggestion: 'Too many agents responded - could route more selectively',
      }
    }

    if (tooFewAgents) {
      return {
        wasCorrect: false,
        improvementSuggestion: 'Too few agents responded - consider multi-agent routing',
      }
    }

    return {
      wasCorrect: true,
    }
  }
}

// Singleton instance
export const monicaRouter = new MonicaRouter()
