/**
 * RAG Quality Improvements
 * Enhances retrieval quality through reranking, filtering, and query expansion
 */

import type { SearchResult } from '@/lib/llamaindex/semantic-search'

export interface QualityMetrics {
  recencyScore: number
  diversityScore: number
  qualityScore: number
  combinedScore: number
}

export interface ScoredSearchResult extends SearchResult {
  qualityMetrics?: QualityMetrics
}

/**
 * 1. Rerank results with additional signals
 *
 * Enhances relevance by considering:
 * - Recency: Newer content gets a slight boost
 * - Quality: Based on past feedback and source reliability
 * - Diversity: Penalizes duplicate or overly similar content
 */
export function rerankResults(
  results: SearchResult[],
  query: string,
  options?: {
    recencyWeight?: number // 0-1, default 0.1
    qualityWeight?: number // 0-1, default 0.2
    diversityWeight?: number // 0-1, default 0.1
  }
): ScoredSearchResult[] {
  const recencyWeight = options?.recencyWeight ?? 0.1
  const qualityWeight = options?.qualityWeight ?? 0.2
  const diversityWeight = options?.diversityWeight ?? 0.1

  // Calculate additional scores for each result
  const scoredResults: ScoredSearchResult[] = results.map((result, index) => {
    // Recency: newer content gets slight boost
    const age = result.metadata?.year
      ? new Date().getFullYear() - (result.metadata.year as number)
      : 100
    const recencyScore = Math.max(0, 1 - age / 100)

    // Quality: based on past feedback (placeholder - could integrate with analytics)
    // In production, this could query feedback data from database
    const qualityScore = 0.8 // Default quality score

    // Diversity: penalize similar content (check for duplicate concepts)
    let diversityScore = 1.0
    const content = result.content.toLowerCase()
    for (let i = 0; i < index; i++) {
      const prevContent = results[i].content.toLowerCase()
      // Simple overlap check (in production, use embeddings)
      const overlapWords = content
        .split(' ')
        .filter(w => prevContent.includes(w) && w.length > 4).length
      if (overlapWords > 10) {
        diversityScore -= 0.2
      }
    }
    diversityScore = Math.max(0.3, diversityScore)

    // Combined score
    const baseScore = result.score
    const combinedScore =
      baseScore * (1 - recencyWeight - qualityWeight - diversityWeight) +
      recencyScore * recencyWeight +
      qualityScore * qualityWeight +
      diversityScore * diversityWeight

    return {
      ...result,
      score: combinedScore,
      qualityMetrics: {
        recencyScore,
        qualityScore,
        diversityScore,
        combinedScore,
      },
    }
  })

  // Sort by new combined score
  return scoredResults.sort((a, b) => b.score - a.score)
}

/**
 * 2. Filter low-quality sources
 *
 * Removes sources below relevance threshold while ensuring
 * minimum number of results are returned
 */
export function filterLowQualitySources(
  results: SearchResult[],
  options?: {
    threshold?: number // Minimum relevance, default 0.35
    minResults?: number // Keep at least N results, default 2
  }
): SearchResult[] {
  const threshold = options?.threshold ?? 0.35
  const minResults = options?.minResults ?? 2

  // Filter by threshold
  const filtered = results.filter(r => r.score >= threshold)

  // Ensure minimum results
  if (filtered.length < minResults && results.length >= minResults) {
    // Return top minResults from original
    return results.slice(0, minResults)
  }

  // If we still don't have enough, return what we have
  return filtered.length > 0 ? filtered : results.slice(0, Math.min(minResults, results.length))
}

/**
 * 3. Expand query context for better retrieval
 *
 * Enriches the query with relevant contextual information about
 * the agent and domain for more targeted retrieval
 */
export function expandQueryContext(
  query: string,
  agentContext: {
    agentId: string
    name: string
    era?: string
    specialties?: string[]
  }
): string {
  // Add agent context to query
  const contextParts = [query]

  if (agentContext.era) {
    contextParts.push(`Historical context: ${agentContext.era}`)
  }

  if (agentContext.specialties && agentContext.specialties.length > 0) {
    contextParts.push(`Expertise areas: ${agentContext.specialties.join(', ')}`)
  }

  // Add implicit philosophical context for deeper queries
  const philosophicalKeywords = [
    'why',
    'meaning',
    'purpose',
    'ethics',
    'morality',
    'good',
    'evil',
    'justice',
    'virtue',
    'wisdom',
  ]
  if (philosophicalKeywords.some(kw => query.toLowerCase().includes(kw))) {
    contextParts.push('philosophical perspective')
  }

  return contextParts.join(' | ')
}

/**
 * 4. Detect ambiguous queries
 *
 * Identifies queries that are too vague or lack sufficient context,
 * providing helpful suggestions for improvement
 */
export function detectAmbiguousQuery(query: string): {
  isAmbiguous: boolean
  suggestions: string[]
  reason?: string
} {
  const lowercaseQuery = query.toLowerCase().trim()

  // Too short
  if (query.split(' ').length < 3) {
    return {
      isAmbiguous: true,
      reason: 'Query is too brief',
      suggestions: [
        "Add more context about what aspect you're interested in",
        'Specify a time period or philosophical school',
        "Include why you're asking this question",
      ],
    }
  }

  // Vague pronouns without context
  const vaguePronouns = ['it', 'this', 'that', 'they', 'them']
  if (vaguePronouns.some(p => lowercaseQuery.startsWith(p + ' '))) {
    return {
      isAmbiguous: true,
      reason: 'Query starts with vague pronoun',
      suggestions: [
        'Replace "it/this/that" with the specific topic',
        "Provide more context about what you're referring to",
      ],
    }
  }

  // Generic requests
  const genericPhrases = ['tell me about', 'what about', 'info on', 'talk about']
  if (genericPhrases.some(p => lowercaseQuery.includes(p))) {
    return {
      isAmbiguous: true,
      reason: 'Generic question format',
      suggestions: [
        'Ask a specific question instead of "tell me about X"',
        'Example: "What were X\'s main contributions to Y?"',
        'Example: "How did X influence the development of Y?"',
      ],
    }
  }

  return { isAmbiguous: false, suggestions: [] }
}

/**
 * 5. Calculate overall query quality score
 *
 * Provides a single metric for query quality that can be logged
 * for analytics and continuous improvement
 */
export function calculateQueryQuality(query: string): {
  score: number // 0-1
  factors: {
    length: number
    specificity: number
    clarity: number
  }
} {
  const words = query.trim().split(/\s+/)
  const length = words.length

  // Length score (optimal: 5-20 words)
  let lengthScore = 1.0
  if (length < 3) lengthScore = 0.3
  else if (length < 5) lengthScore = 0.6
  else if (length > 20) lengthScore = 0.8

  // Specificity score (presence of specific terms)
  const specificTerms = [
    'how',
    'why',
    'what',
    'when',
    'where',
    'which',
    'who',
    'define',
    'explain',
    'compare',
    'contrast',
  ]
  const hasSpecificTerms = specificTerms.some(term => query.toLowerCase().includes(term))
  const specificityScore = hasSpecificTerms ? 1.0 : 0.5

  // Clarity score (inverse of ambiguity)
  const ambiguityCheck = detectAmbiguousQuery(query)
  const clarityScore = ambiguityCheck.isAmbiguous ? 0.4 : 1.0

  // Combined score
  const score = (lengthScore + specificityScore + clarityScore) / 3

  return {
    score,
    factors: {
      length: lengthScore,
      specificity: specificityScore,
      clarity: clarityScore,
    },
  }
}

/**
 * 6. Generate query improvement suggestions
 *
 * Provides actionable suggestions to improve query quality
 */
export function generateQuerySuggestions(query: string, qualityScore: number): string[] {
  const suggestions: string[] = []

  if (qualityScore < 0.5) {
    suggestions.push('Try to be more specific about what you want to know')
  }

  const words = query.trim().split(/\s+/)
  if (words.length < 5) {
    suggestions.push('Add more details or context to your question')
  }

  const hasQuestionWord = ['how', 'why', 'what', 'when', 'where', 'which', 'who'].some(q =>
    query.toLowerCase().includes(q)
  )
  if (!hasQuestionWord) {
    suggestions.push('Try framing your request as a specific question')
  }

  const ambiguityCheck = detectAmbiguousQuery(query)
  if (ambiguityCheck.isAmbiguous) {
    suggestions.push(...ambiguityCheck.suggestions)
  }

  return suggestions
}
