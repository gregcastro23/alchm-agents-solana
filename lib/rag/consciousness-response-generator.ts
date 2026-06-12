/**
 * Consciousness-Aware Response Generator
 *
 * Generates rich, personality-driven responses using:
 * - Full agent consciousness profile
 * - Astrological influences from natal chart
 * - Personality traits, gifts, shadows, challenges
 * - Alchemical elements and thermodynamic qualities
 * - Current mood and consciousness level
 * - Monica Constant and kinetic evolution
 */

import type { UnifiedAgent } from '@/lib/unified-agent-types'
import type { SearchResult } from '@/lib/llamaindex/semantic-search'

export interface ConsciousnessResponseOptions {
  agent: UnifiedAgent
  userMessage: string
  sources: SearchResult[]
  conversationHistory?: Array<{ role: string; content: string }>
}

/**
 * Generate a consciousness-aware response that deeply reflects the agent's full profile
 * The agent EMBODIES their traits - they don't talk about them
 */
export function generateConsciousnessResponse(options: ConsciousnessResponseOptions): string {
  const { agent, userMessage, sources } = options

  console.log('[ConsciousnessGenerator] 🎯 CALLED for agent:', agent.name)
  console.log('[ConsciousnessGenerator] Agent type:', agent.type)
  console.log('[ConsciousnessGenerator] Has historicalData:', !!agent.historicalData)

  // Extract all available agent data
  const historicalData = agent.historicalData
  const abilities = historicalData?.abilities
  const shadows = historicalData?.shadows
  const gifts = historicalData?.gifts
  const challenges = (historicalData as any)?.challenges
  const strength = historicalData?.consciousness?.strength
  const emotion = historicalData?.consciousness?.emotion
  const uniquePower = abilities?.uniquePower

  console.log('[ConsciousnessGenerator] Has abilities:', !!abilities)
  console.log('[ConsciousnessGenerator] uniquePower:', uniquePower?.substring(0, 50) + '...')
  console.log('[ConsciousnessGenerator] strength:', strength)
  console.log('[ConsciousnessGenerator] Sources count:', sources.length)

  // Build authentic response - BE the agent, don't describe them
  const response: string[] = []

  // === CORE WISDOM: The main response content ===
  if (sources.length > 0) {
    console.log('[ConsciousnessGenerator] ✅ Path: Sources available - synthesizing naturally')
    // We have sources - synthesize naturally
    response.push(synthesizeSourcesNaturally(sources, uniquePower))
  } else if (abilities && uniquePower) {
    console.log('[ConsciousnessGenerator] ✅ Path: No sources - using wisdom response')
    // No sources - respond from wisdom and ability
    response.push(generateWisdomResponse(abilities, userMessage, strength, emotion))
  } else {
    console.log('[ConsciousnessGenerator] ⚠️  Path: Minimal fallback (no abilities/uniquePower)')
    // Minimal fallback
    response.push(generateBasicResponse(userMessage, strength))
  }

  // === OPTIONAL DEPTH: Only if naturally relevant to the query ===
  const depthElement = addDepthIfRelevant(shadows, gifts, challenges, userMessage)
  if (depthElement) {
    response.push(` ${depthElement}`)
  }

  const finalResponse = response.join('').trim()
  console.log('[ConsciousnessGenerator] 📝 Final response length:', finalResponse.length)
  console.log('[ConsciousnessGenerator] 📝 First 100 chars:', finalResponse.substring(0, 100))

  return finalResponse
}

/**
 * Generate natural wisdom response when no sources available
 */
function generateWisdomResponse(
  abilities: any,
  query: string,
  strength?: string,
  emotion?: string
): string {
  const queryLower = query.toLowerCase()
  const domains = abilities.wisdomDomains || []
  const uniquePower = abilities.uniquePower || ''

  // Find if query relates to a domain
  const relevantDomain = domains.find((domain: string) =>
    queryLower.includes(domain.toLowerCase().split(' ')[0])
  )

  // Build natural response
  const responses: string[] = []

  // Natural opening based on query type
  if (queryLower.includes('?')) {
    responses.push(getQuestionOpening(queryLower))
  }

  // Core wisdom - directly answer from their essence
  if (relevantDomain) {
    responses.push(`${uniquePower} `)

    if (strength) {
      // Add their strength naturally, not as a label
      responses.push(`In my experience, ${strength.toLowerCase()}. `)
    }
  } else {
    // General response drawing from unique power
    responses.push(`${uniquePower} `)
  }

  return responses.join('')
}

/**
 * Get natural question opening
 */
function getQuestionOpening(queryLower: string): string {
  if (queryLower.includes('why') || queryLower.includes('purpose')) {
    return '' // No opening needed for why/purpose - get straight to the answer
  }
  if (queryLower.includes('how')) {
    return '' // No opening for how - direct response
  }
  return '' // Generally, skip openings and get to the substance
}

/**
 * Generate basic response for minimal data
 */
function generateBasicResponse(query: string, strength?: string): string {
  if (strength) {
    return `${strength}. `
  }
  return 'From my perspective and experience, this matter requires careful consideration of both principle and practice. '
}

/**
 * Synthesize sources into natural conversation
 * No meta-commentary, just BE the agent speaking naturally
 */
function synthesizeSourcesNaturally(sources: SearchResult[], uniquePower?: string): string {
  // Clean sources of markdown and structured metadata
  const cleanSources = sources
    .map(source => {
      let content = source.content

      // Remove ALL markdown headers (##, ###, etc.) and their content on the same line
      content = content.replace(/^#+\s+.+$/gm, '')

      // Remove metadata patterns: "Key: Value" at start of lines
      content = content.replace(/^[A-Z][a-z\s]+:\s*.+$/gm, '')

      // Remove bullet points and list markers
      content = content.replace(/^\s*[-*•]\s+/gm, '')

      // Remove numbered lists
      content = content.replace(/^\s*\d+\.\s+/gm, '')

      // Remove horizontal rules
      content = content.replace(/^[-=]{3,}$/gm, '')

      // Remove agent profile metadata patterns
      content = content.replace(/Born:\s*.+$/gm, '')
      content = content.replace(/Era:\s*.+$/gm, '')
      content = content.replace(/Specialty:\s*.+$/gm, '')
      content = content.replace(/Core Essence/gi, '')
      content = content.replace(/Essence:\s*.+$/gm, '')
      content = content.replace(/Expression:\s*.+$/gm, '')
      content = content.replace(/Emotion:\s*.+$/gm, '')

      // Remove multiple newlines
      content = content.replace(/\n{2,}/g, ' ')

      // Trim and clean whitespace
      content = content.trim().replace(/\s{2,}/g, ' ')

      return content
    })
    .filter(content => content.length > 50) // Only meaningful content

  if (cleanSources.length === 0) {
    // No usable sources
    if (uniquePower) {
      return uniquePower
    }
    return 'I approach this from years of contemplation and experience. '
  }

  const response: string[] = []

  // First source - get the core insight
  if (cleanSources[0]) {
    let excerpt = cleanSources[0].substring(0, 300).trim()

    // Find natural sentence breaks
    const sentences = excerpt.match(/[^.!?]+[.!?]+/g) || [excerpt]

    // Take first 2-3 sentences for a complete thought
    const naturalExcerpt = sentences.slice(0, Math.min(3, sentences.length)).join(' ')

    response.push(naturalExcerpt.trim())
  }

  // Second source if substantially different
  if (cleanSources.length > 1) {
    const firstContent = cleanSources[0].substring(0, 100)
    const secondContent = cleanSources[1]

    // Only add if different topic
    if (!secondContent.includes(firstContent.substring(0, 50))) {
      let excerpt = secondContent.substring(0, 250).trim()
      const sentences = excerpt.match(/[^.!?]+[.!?]+/g) || [excerpt]
      const naturalExcerpt = sentences.slice(0, 2).join(' ')

      response.push(` ${naturalExcerpt.trim()}`)
    }
  }

  return response.join('')
}

/**
 * Add depth element only if naturally relevant
 * Be subtle - integrate naturally, don't announce it
 */
function addDepthIfRelevant(
  shadows: any[] | undefined,
  gifts: any[] | undefined,
  challenges: any[] | undefined,
  query: string
): string | null {
  const queryLower = query.toLowerCase()

  // Only add depth if directly asked about challenges/struggles
  if (
    (queryLower.includes('challenge') ||
      queryLower.includes('struggle') ||
      queryLower.includes('difficult')) &&
    shadows &&
    shadows.length > 0
  ) {
    const shadow = shadows[0]
    // Natural integration - just mention it, don't label it
    return `I've learned that ${shadow.transformationPath.toLowerCase()}.`
  }

  // Only for growth/improvement questions
  if (
    (queryLower.includes('grow') ||
      queryLower.includes('improve') ||
      queryLower.includes('develop')) &&
    challenges &&
    challenges.length > 0
  ) {
    const challenge = challenges[0]
    return `${challenge.growthOpportunity}.`
  }

  // Generally, skip depth elements - let the main response carry the weight
  return null
}

/**
 * Main export - check if we should use this enhanced generator
 */
export function shouldUseConsciousnessGenerator(agent: UnifiedAgent): boolean {
  // Use if agent has rich historical data
  const isHistorical = agent.type === 'historical'
  const hasConsciousness = !!agent.historicalData?.consciousness
  const hasAbilities = !!agent.historicalData?.abilities

  const shouldUse = !!(isHistorical && hasConsciousness && hasAbilities)

  console.log('[ConsciousnessGenerator] shouldUse check for', agent.name)
  console.log('[ConsciousnessGenerator]   isHistorical:', isHistorical)
  console.log('[ConsciousnessGenerator]   hasConsciousness:', hasConsciousness)
  console.log('[ConsciousnessGenerator]   hasAbilities:', hasAbilities)
  console.log('[ConsciousnessGenerator]   RESULT:', shouldUse ? '✅ YES' : '❌ NO')

  return shouldUse
}
