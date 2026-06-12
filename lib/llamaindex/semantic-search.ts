/**
 * Semantic Search - Query Vector Store for Relevant Agent Knowledge
 *
 * Provides semantic search capabilities across historical agent knowledge.
 * Includes filtering, reranking, and multi-agent search support.
 */

import { type QueryResult } from './vector-store'

// Configuration
const COLLECTION_NAME = 'historical_agents'
const DEFAULT_TOP_K = 5
const DEFAULT_THRESHOLD = 0.4 // Adjusted for L2 distance (was 0.7 for cosine)

export interface SearchOptions {
  topK?: number // Number of results to return (default: 5)
  threshold?: number // Minimum relevance score (default: 0.7)
  agentIds?: string[] // Filter by specific agents
  includeMetadata?: boolean // Include full metadata (default: true)
  useReranking?: boolean // Apply reranking algorithm (default: true)
}

export interface SearchResult {
  id: string
  agentId: string
  agentName: string
  content: string
  score: number // Similarity score (0-1)
  metadata: {
    chunkIndex: number
    totalChunks: number
    source: string
    era?: string
    specialty?: string
    consciousnessLevel?: string
    [key: string]: any
  }
}

export interface GroupedSearchResults {
  query: string
  totalResults: number
  resultsByAgent: Map<string, SearchResult[]>
  topResults: SearchResult[]
}

/**
 * Semantic search across all agents
 * Returns most relevant knowledge chunks based on query
 */
export async function semanticSearch(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const startTime = Date.now()

  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty')
  }

  const topK = options?.topK || DEFAULT_TOP_K
  const threshold = options?.threshold || DEFAULT_THRESHOLD
  const includeMetadata = options?.includeMetadata !== false
  const useReranking = options?.useReranking !== false

  try {
    // Dynamic import for vector store and embeddings to prevent loading heavy modules
    const { getOrCreateCollection, queryCollection } = await import('./vector-store')
    const { generateQueryEmbedding } = await import('./embeddings-service')

    console.log(`[SemanticSearch] Searching for: "${query}" (topK=${topK}, threshold=${threshold})`)

    // Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(query)

    // Get collection
    const collection = await getOrCreateCollection(COLLECTION_NAME)

    // Build filter for agent IDs if provided
    const filter =
      options?.agentIds && options.agentIds.length > 0
        ? { agentId: { $in: options.agentIds } }
        : undefined

    // Query vector store
    const results = await queryCollection(collection, queryEmbedding, {
      topK: topK * 2, // Get more results for reranking
      filter: filter as any,
      includeMetadata,
    })

    // Convert to SearchResult format
    let searchResults: SearchResult[] = results.map(r => ({
      id: r.id,
      agentId: r.metadata.agentId,
      agentName: r.metadata.agentName,
      content: r.document,
      score: r.score,
      metadata: {
        ...r.metadata,
        chunkIndex: r.metadata.chunkIndex,
        totalChunks: r.metadata.totalChunks,
        source: r.metadata.source,
        era: r.metadata.era,
        specialty: r.metadata.specialty,
        consciousnessLevel: r.metadata.consciousnessLevel,
      },
    }))

    // Filter by threshold
    searchResults = searchResults.filter(r => r.score >= threshold)

    // Apply reranking if enabled
    if (useReranking && searchResults.length > 0) {
      searchResults = rerankResults(searchResults, query)
    }

    // Limit to topK
    searchResults = searchResults.slice(0, topK)

    const elapsed = Date.now() - startTime
    console.log(
      `[SemanticSearch] Found ${searchResults.length} results in ${elapsed}ms ` +
        `(avg score: ${searchResults.length > 0 ? (searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length).toFixed(3) : 'N/A'})`
    )

    return searchResults
  } catch (error) {
    console.error('[SemanticSearch] Search failed:', error)
    throw new Error(
      `Semantic search failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Search knowledge from a specific agent
 */
export async function searchAgentKnowledge(
  agentId: string,
  query: string,
  topK?: number
): Promise<SearchResult[]> {
  console.log(`[SemanticSearch] Searching agent knowledge: ${agentId}`)

  return semanticSearch(query, {
    topK: topK || DEFAULT_TOP_K,
    agentIds: [agentId],
    threshold: 0.35, // Lower threshold for agent-specific search (L2 distance)
    useReranking: true,
  })
}

/**
 * Multi-agent search with grouped results
 * Searches across multiple agents and groups results by agent
 */
export async function multiAgentSearch(
  query: string,
  agentIds: string[],
  resultsPerAgent?: number
): Promise<GroupedSearchResults> {
  console.log(`[SemanticSearch] Multi-agent search across ${agentIds.length} agents`)

  const perAgent = resultsPerAgent || 3
  const totalTopK = agentIds.length * perAgent

  // Search across all specified agents
  const results = await semanticSearch(query, {
    topK: totalTopK,
    agentIds,
    threshold: 0.35, // L2 distance threshold
    useReranking: true,
  })

  // Group by agent
  const resultsByAgent = new Map<string, SearchResult[]>()

  for (const result of results) {
    const agentResults = resultsByAgent.get(result.agentId) || []
    if (agentResults.length < perAgent) {
      agentResults.push(result)
      resultsByAgent.set(result.agentId, agentResults)
    }
  }

  // Get top overall results
  const topResults = results.slice(0, Math.min(10, results.length))

  return {
    query,
    totalResults: results.length,
    resultsByAgent,
    topResults,
  }
}

/**
 * Rerank results using simple keyword and relevance boosting
 * More sophisticated reranking can be added later (e.g., Cohere rerank)
 */
function rerankResults(results: SearchResult[], query: string): SearchResult[] {
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3)

  return results
    .map(result => {
      let boostedScore = result.score

      // Boost if content contains exact query
      if (result.content.toLowerCase().includes(queryLower)) {
        boostedScore *= 1.1
      }

      // Boost for keyword matches
      const contentLower = result.content.toLowerCase()
      let keywordMatches = 0
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          keywordMatches++
        }
      }

      if (keywordMatches > 0) {
        boostedScore *= 1 + keywordMatches * 0.05
      }

      // Boost for certain metadata
      if (result.metadata.specialty) {
        const specialtyLower = String(result.metadata.specialty).toLowerCase()
        if (queryWords.some(word => specialtyLower.includes(word))) {
          boostedScore *= 1.05
        }
      }

      // Cap score at 1.0
      boostedScore = Math.min(1.0, boostedScore)

      return {
        ...result,
        score: boostedScore,
      }
    })
    .sort((a, b) => b.score - a.score)
}

/**
 * Find similar agents based on a concept or theme
 */
export async function findSimilarAgents(
  concept: string,
  topK?: number
): Promise<{ agentId: string; agentName: string; relevance: number }[]> {
  const results = await semanticSearch(concept, {
    topK: topK || 10,
    threshold: 0.4, // L2 distance threshold
  })

  // Group by agent and get highest score per agent
  const agentScores = new Map<string, { name: string; maxScore: number }>()

  for (const result of results) {
    const existing = agentScores.get(result.agentId)
    if (!existing || result.score > existing.maxScore) {
      agentScores.set(result.agentId, {
        name: result.agentName,
        maxScore: result.score,
      })
    }
  }

  // Convert to array and sort by relevance
  return Array.from(agentScores.entries())
    .map(([agentId, data]) => ({
      agentId,
      agentName: data.name,
      relevance: data.maxScore,
    }))
    .sort((a, b) => b.relevance - a.relevance)
}

/**
 * Get diverse results - ensures variety across different agents
 */
export async function diverseSearch(query: string, topK?: number): Promise<SearchResult[]> {
  const results = await semanticSearch(query, {
    topK: (topK || 5) * 3, // Get more results
    threshold: 0.35, // L2 distance threshold
  })

  // Select diverse results - max 2 per agent
  const diverseResults: SearchResult[] = []
  const agentCounts = new Map<string, number>()
  const maxPerAgent = 2

  for (const result of results) {
    const count = agentCounts.get(result.agentId) || 0
    if (count < maxPerAgent) {
      diverseResults.push(result)
      agentCounts.set(result.agentId, count + 1)
    }

    if (diverseResults.length >= (topK || 5)) {
      break
    }
  }

  return diverseResults
}

/**
 * Search with metadata filters
 */
export async function searchWithFilters(
  query: string,
  filters: {
    era?: string
    consciousnessLevel?: string
    specialty?: string
  },
  topK?: number
): Promise<SearchResult[]> {
  // Note: ChromaDB filtering is limited, so we'll filter post-query
  const results = await semanticSearch(query, {
    topK: (topK || 5) * 2,
    threshold: 0.35, // L2 distance threshold
  })

  // Apply filters
  let filtered = results

  if (filters.era) {
    filtered = filtered.filter(r => r.metadata.era === filters.era)
  }

  if (filters.consciousnessLevel) {
    filtered = filtered.filter(r => r.metadata.consciousnessLevel === filters.consciousnessLevel)
  }

  if (filters.specialty) {
    filtered = filtered.filter(r =>
      String(r.metadata.specialty).toLowerCase().includes(filters.specialty!.toLowerCase())
    )
  }

  return filtered.slice(0, topK || 5)
}

/**
 * Get search statistics
 */
export async function getSearchStats(query: string): Promise<{
  totalMatches: number
  averageScore: number
  agentCoverage: number
  topAgents: { agentId: string; agentName: string; matches: number }[]
}> {
  const results = await semanticSearch(query, {
    topK: 20,
    threshold: 0.35, // L2 distance threshold
  })

  const agentMatches = new Map<string, { name: string; count: number }>()

  for (const result of results) {
    const existing = agentMatches.get(result.agentId)
    if (existing) {
      existing.count++
    } else {
      agentMatches.set(result.agentId, { name: result.agentName, count: 1 })
    }
  }

  const averageScore =
    results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0

  const topAgents = Array.from(agentMatches.entries())
    .map(([agentId, data]) => ({
      agentId,
      agentName: data.name,
      matches: data.count,
    }))
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 5)

  return {
    totalMatches: results.length,
    averageScore,
    agentCoverage: agentMatches.size,
    topAgents,
  }
}
