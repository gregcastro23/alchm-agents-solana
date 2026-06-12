/**
 * Mock RAG Response Generator
 * Used for testing when Anthropic API is unavailable
 * Simulates realistic responses based on retrieved sources
 */

import type { SearchResult } from '@/lib/llamaindex/semantic-search'
import type { UnifiedAgent } from '@/lib/unified-agent-types'
import {
  generateConsciousnessResponse,
  shouldUseConsciousnessGenerator,
} from './consciousness-response-generator'

export interface MockGenerationOptions {
  agent:
    | UnifiedAgent
    | {
        id: string
        name: string
        era?: string
      }
  userMessage: string
  sources: SearchResult[]
  conversationHistory?: Array<{ role: string; content: string }>
}

/**
 * Helper to check if agent is a full UnifiedAgent
 */
function isUnifiedAgent(agent: any): agent is UnifiedAgent {
  return agent && typeof agent === 'object' && 'consciousness' in agent
}

/**
 * Generate a mock response that references the retrieved sources
 * This simulates what Claude would do - synthesizing sources into an answer
 */
export function generateMockResponse(options: MockGenerationOptions): string {
  const { agent, userMessage, sources, conversationHistory } = options

  console.log('[MockGenerator] 🎬 generateMockResponse called for:', agent.name)
  console.log('[MockGenerator] Agent keys:', Object.keys(agent))

  // Check if we can use the rich consciousness generator
  const isFullAgent = isUnifiedAgent(agent)
  console.log('[MockGenerator] isFullAgent (has consciousness):', isFullAgent)

  if (isFullAgent && shouldUseConsciousnessGenerator(agent)) {
    console.log('[MockGenerator] ✅ Routing to consciousness generator')
    return generateConsciousnessResponse({
      agent,
      userMessage,
      sources,
      conversationHistory,
    })
  }

  console.log('[MockGenerator] ❌ Using OLD fallback generation')

  // Fallback to simple generation for minimal agent data
  const consciousness = isFullAgent ? agent.consciousness : undefined
  const historicalData =
    isFullAgent && agent.type === 'historical' ? agent.historicalData : undefined
  const personality = historicalData?.personality
  const natalChart = historicalData?.consciousness?.natalChart
  const era = historicalData?.historicalEra || ('era' in agent ? agent.era : undefined)

  // Extract key concepts from query
  const query = userMessage.toLowerCase()
  const isQuestion =
    query.includes('?') ||
    query.includes('what') ||
    query.includes('how') ||
    query.includes('why') ||
    query.includes('when') ||
    query.includes('where') ||
    query.includes('who')

  // Build response based on sources and agent personality
  const response: string[] = []

  // Only add generic openings when NO sources are available
  // If we have sources, let the content speak for itself
  if (sources.length === 0) {
    // Opening based on agent personality and query type
    if (isQuestion) {
      // Use personality traits if available
      if (personality?.traits && personality.traits.length > 0) {
        const dominantTrait = personality.traits[0]
        response.push(
          `Ah, an excellent question. As someone who has always embodied ${dominantTrait.toLowerCase()}, `
        )
      } else if (era) {
        response.push(`Based on my knowledge and experience during ${era}, `)
      } else {
        response.push(`Based on my knowledge and experience, `)
      }
    } else {
      response.push(`Regarding your inquiry about this matter, `)
    }
  }

  if (sources.length === 0) {
    // No sources - create personality-driven response
    if (consciousness && natalChart) {
      // Reference consciousness level and astrological influences
      const sunSign =
        (natalChart.planets as any)?.find((p: any) => p.name === 'Sun')?.sign || 'the cosmos'
      const conscLevel = consciousness.level || 'active'

      response.push(
        `While I don't have specific documented sources about "${userMessage.slice(0, 40)}...", ` +
          `my consciousness—shaped by ${sunSign} and currently at a ${conscLevel} state—compels me to share my perspective. `
      )

      // Add personality-specific insight
      if ((personality as any)?.description) {
        const personalitySnippet = (personality as any).description.slice(0, 150)
        response.push(
          `${personalitySnippet}... ` +
            `This essence informs how I approach your inquiry. Would you like me to elaborate further?`
        )
      } else {
        response.push(
          `I'd be happy to discuss this topic from my philosophical perspective if you'd like to explore it further.`
        )
      }
    } else {
      // Fallback for minimal agent data
      response.push(
        `I don't have specific documented knowledge about "${userMessage.slice(0, 50)}..." ` +
          `in my available sources. However, I'd be happy to discuss this topic from my ` +
          `philosophical perspective if you'd like to explore it further.`
      )
    }
  } else if (sources.length === 1) {
    // Single source - use full content, no truncation
    const source = sources[0]
    const content = source.content.trim()

    // Just return the content naturally - no meta-commentary
    response.push(content)
  } else {
    // Multiple sources - synthesize naturally
    response.push('') // Start fresh for multiple sources

    // Include up to 3 sources with natural synthesis
    sources.slice(0, 3).forEach((source, idx) => {
      const content = source.content.trim()

      // Take full sentences, not arbitrary character limits
      const sentences = content.match(/[^.!?]+[.!?]+/g) || [content]
      const naturalExcerpt = sentences.slice(0, Math.min(3, sentences.length)).join(' ')

      if (idx === 0) {
        response.push(naturalExcerpt)
      } else {
        response.push(`\n\n${naturalExcerpt}`)
      }
    })
  }

  return response.join('')
}

/**
 * Simulate generation timing for realistic testing
 * Returns a promise that resolves after a random delay (500-1500ms)
 * to mimic real API call latency
 */
export function simulateGenerationDelay(): Promise<void> {
  // Random delay between 500-1500ms to simulate API call
  const delay = 500 + Math.random() * 1000
  return new Promise(resolve => setTimeout(resolve, delay))
}

/**
 * Check if we should use mock generation
 * Returns true if Anthropic API is unavailable or forced mock mode
 */
export function shouldUseMockGeneration(): boolean {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const forceMock = process.env.USE_MOCK_GENERATION === 'true'

  // Use mock if explicitly enabled OR if no valid API key
  return forceMock || !apiKey || apiKey.length < 20
}

/**
 * Get mock generation status message
 * Returns a user-friendly status string
 */
export function getMockGenerationStatus(): string {
  const forceMock = process.env.USE_MOCK_GENERATION === 'true'
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length >= 20

  if (forceMock) {
    return 'Mock generation enabled (USE_MOCK_GENERATION=true)'
  } else if (!hasApiKey) {
    return 'Mock generation active (no valid Anthropic API key)'
  } else {
    return 'Real generation active (Anthropic API connected)'
  }
}
