/**
 * RAG Generator - Retrieval-Augmented Generation
 *
 * Integrates semantic search with AI generation to enhance responses
 * with retrieved agent knowledge. Works with both Claude and GPT models.
 */

import { type SearchResult } from '@/lib/llamaindex/semantic-search'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { ragCache } from '@/lib/rag/rag-cache'
import {
  rerankResults,
  filterLowQualitySources,
  detectAmbiguousQuery,
  calculateQueryQuality,
} from '@/lib/rag/rag-quality'
import {
  generateMockResponse,
  simulateGenerationDelay,
  shouldUseMockGeneration,
  getMockGenerationStatus,
} from '@/lib/rag/mock-generator'

// Configuration
const MAX_CONTEXT_TOKENS = parseInt(process.env.RAG_MAX_CONTEXT_TOKENS || '1500')
const CHARS_PER_TOKEN = 4
const USE_CACHE = process.env.USE_RAG_CACHE !== 'false' // Enabled by default

export interface RAGGenerateOptions {
  agent: any // Historical or planetary agent
  agentId: string
  userMessage: string
  systemPrompt: string
  conversationHistory?: Array<{ role: string; content: string }>
  sessionId?: string
  /** AI model identifier — passed to the generation call when RAG is bypassed */
  model?: string
  /** Sampling temperature (0–2). Defaults to 0.7. */
  temperature?: number
  /** Maximum output tokens. Defaults to 800. */
  maxTokens?: number
  ragConfig?: {
    enabled: boolean
    topK: number
    threshold: number
    useReranking: boolean
  }
}

export interface RAGSource {
  agentId: string
  agentName: string
  excerpt: string
  relevance: number
}

export interface RAGMetadata {
  enabled: boolean
  ragUsed: boolean
  retrievedDocs?: number
  sources?: RAGSource[]
  queryTime?: number
  totalTime?: number
  error?: string
  cacheHit?: boolean
  cacheLatency?: number
  retrievalTime?: number
  generationTime?: number
  /** True when the response text came from the offline mock generator, not a real LLM. */
  mock?: boolean
  /** Human-readable reason the result is degraded (e.g. mock/offline mode, API error). */
  degradedReason?: string
}

export interface RAGResult {
  text: string // AI-generated response
  ragMetadata: RAGMetadata
}

/**
 * Generate with RAG enhancement
 * Performs semantic search, builds context, and generates response
 */
export async function generateWithRAG(options: RAGGenerateOptions): Promise<RAGResult> {
  const startTime = Date.now()

  // Check if RAG is enabled
  const ragEnabled =
    options.ragConfig?.enabled !== false &&
    (process.env.USE_RAG_GENERATION === 'true' || process.env.USE_VECTOR_SEARCH === 'true')

  if (!ragEnabled) {
    return {
      text: '',
      ragMetadata: {
        enabled: false,
        ragUsed: false,
      },
    }
  }

  try {
    // Dynamic import for semantic search to prevent loading heavy modules when not used
    const { semanticSearch } = await import('@/lib/llamaindex/semantic-search')

    console.log(`[RAG] Generating with RAG for agent ${options.agentId}`)

    // Stage 0: Check Cache (if enabled)
    if (USE_CACHE) {
      const cacheCheckStart = Date.now()
      const cachedResult = await ragCache.get(options.userMessage, options.agentId)
      const cacheLatency = Date.now() - cacheCheckStart

      if (cachedResult) {
        console.log(`[RAG] 🎯 Cache hit! Returning cached result (${cacheLatency}ms)`)
        const totalTime = Date.now() - startTime

        // Convert cached sources to RAGSource format
        const sources: RAGSource[] = cachedResult.sources.map(s => ({
          agentId: s.agentId,
          agentName: s.agentName,
          excerpt: s.excerpt,
          relevance: s.relevance,
        }))

        return {
          text: cachedResult.generatedResponse || '',
          ragMetadata: {
            enabled: true,
            ragUsed: true,
            retrievedDocs: cachedResult.sources.length,
            sources,
            queryTime: 0,
            totalTime,
            cacheHit: true,
            cacheLatency,
          },
        }
      }

      console.log(`[RAG] Cache miss, proceeding with retrieval (${cacheLatency}ms)`)
    }

    // Stage 1: Semantic Search
    const searchStartTime = Date.now()

    const searchResults = await semanticSearch(options.userMessage, {
      topK: options.ragConfig?.topK || 5,
      threshold: options.ragConfig?.threshold || 0.7,
      agentIds: options.agentId ? [options.agentId] : undefined,
      includeMetadata: true,
      useReranking: options.ragConfig?.useReranking !== false,
    })

    const retrievalTime = Date.now() - searchStartTime

    console.log(`[RAG] Retrieved ${searchResults.length} relevant documents in ${retrievalTime}ms`)

    // Check query quality and ambiguity (for analytics)
    const queryQuality = calculateQueryQuality(options.userMessage)
    const ambiguityCheck = detectAmbiguousQuery(options.userMessage)
    if (ambiguityCheck.isAmbiguous) {
      console.log(`[RAG] ⚠️ Ambiguous query detected: ${ambiguityCheck.reason}`)
      // Continue anyway, but log for analytics
    }
    console.log(
      `[RAG] Query quality score: ${(queryQuality.score * 100).toFixed(0)}% (length: ${queryQuality.factors.length.toFixed(2)}, specificity: ${queryQuality.factors.specificity.toFixed(2)}, clarity: ${queryQuality.factors.clarity.toFixed(2)})`
    )

    // If no results, still generate a response with mock (no sources)
    if (searchResults.length === 0) {
      console.log('[RAG] ⚠️  No relevant documents found, generating response without sources')

      const useMock = shouldUseMockGeneration()
      const generationStartTime = Date.now()
      let responseText: string

      if (useMock) {
        console.log('[RAG] Using mock generation with no sources')
        console.log('[RAG] Agent being passed:', options.agent.name, 'ID:', options.agentId)
        console.log('[RAG] Agent type:', options.agent.type)
        console.log('[RAG] Agent has historicalData:', !!options.agent.historicalData)
        await simulateGenerationDelay()
        responseText = generateMockResponse({
          agent: options.agent, // Pass full agent object
          userMessage: options.userMessage,
          sources: [], // No sources available
          conversationHistory: options.conversationHistory,
        })
        console.log('[RAG] Mock generation returned text length:', responseText.length)
        console.log('[RAG] First 150 chars:', responseText.substring(0, 150))
      } else {
        // Fallback to empty string if no mock and no API
        responseText = ''
      }

      const generationTime = Date.now() - generationStartTime

      return {
        text: responseText,
        ragMetadata: {
          enabled: true,
          ragUsed: false,
          retrievedDocs: 0,
          retrievalTime,
          generationTime,
          cacheHit: false,
          mock: useMock,
          degradedReason: useMock ? getMockGenerationStatus() : undefined,
        },
      }
    }

    // Stage 1.5: Apply Quality Improvements
    console.log('[RAG] Applying quality improvements (reranking + filtering)...')

    // Rerank with quality signals (recency, quality, diversity)
    const rerankedResults = rerankResults(searchResults, options.userMessage, {
      recencyWeight: 0.1,
      qualityWeight: 0.2,
      diversityWeight: 0.1,
    })

    // Filter low-quality sources (threshold 0.35, min 2 results)
    const filteredResults = filterLowQualitySources(rerankedResults, {
      threshold: 0.35,
      minResults: 2,
    })

    console.log(
      `[RAG] Quality filtering: ${searchResults.length} → ${rerankedResults.length} (reranked) → ${filteredResults.length} (filtered)`
    )

    // Use filteredResults from here on
    const finalResults = filteredResults

    // Stage 2: Build Enhanced Context
    const enhancedContext = buildEnhancedContext(finalResults, MAX_CONTEXT_TOKENS)

    // Stage 3: Generate with Claude
    const enhancedSystemPrompt = buildEnhancedPrompt(
      options.systemPrompt,
      enhancedContext,
      options.agent
    )

    const messages = [
      ...(options.conversationHistory || []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: options.userMessage },
    ]

    // Stage 3: Generate Response (or use mock)
    const useMock = shouldUseMockGeneration()
    const generationStartTime = Date.now()

    let responseText: string
    let generationTime: number
    // Track whether the text is mock-generated so the caller can surface a
    // "degraded/offline" signal instead of presenting canned text as a real reply.
    let servedMock = useMock
    let degradedReason: string | undefined = useMock ? getMockGenerationStatus() : undefined

    if (useMock) {
      console.log('[RAG] ⚠️  Using mock generation (Anthropic API unavailable)')
      console.log(`[RAG] Status: ${getMockGenerationStatus()}`)
      await simulateGenerationDelay()
      responseText = generateMockResponse({
        agent: options.agent, // Pass full agent object
        userMessage: options.userMessage,
        sources: finalResults,
        conversationHistory: options.conversationHistory,
      })
      generationTime = Date.now() - generationStartTime
      console.log(`[RAG] Mock generation completed in ${generationTime}ms`)
    } else {
      // Real API generation
      try {
        const response = await generateText({
          model: anthropic(process.env.CLAUDE_DEFAULT_MODEL || 'claude-sonnet-4-6'),
          system: enhancedSystemPrompt,
          messages,
          temperature: 0.7,
        })
        responseText = response.text
        generationTime = Date.now() - generationStartTime
        console.log(`[RAG] Real generation completed in ${generationTime}ms`)
      } catch (error) {
        // Fallback to mock on API error
        console.log('[RAG] ⚠️  API error, falling back to mock generation')
        console.error('[RAG] API Error:', error)
        servedMock = true
        degradedReason = 'Anthropic API unavailable — served offline mock response'
        await simulateGenerationDelay()
        responseText = generateMockResponse({
          agent: options.agent, // Pass full agent object
          userMessage: options.userMessage,
          sources: finalResults,
          conversationHistory: options.conversationHistory,
        })
        generationTime = Date.now() - generationStartTime
      }
    }

    const totalTime = Date.now() - startTime

    // Build sources for metadata (use finalResults which are filtered and reranked)
    const sources: RAGSource[] = finalResults.map(r => ({
      agentId: r.agentId,
      agentName: r.agentName,
      excerpt: r.content.substring(0, 100) + (r.content.length > 100 ? '...' : ''),
      relevance: r.score,
    }))

    console.log(
      `[RAG] Generated response in ${totalTime}ms (retrieval: ${retrievalTime}ms, generation: ${generationTime}ms)`
    )

    // Store in cache for future use (use finalResults)
    if (USE_CACHE && responseText) {
      await ragCache.set(
        options.userMessage,
        options.agentId,
        finalResults.map(r => ({
          agentId: r.agentId,
          agentName: r.agentName,
          excerpt: r.content.substring(0, 100) + (r.content.length > 100 ? '...' : ''),
          relevance: r.score,
        })),
        responseText
      )
      console.log(`[RAG] Cached result for future queries`)
    }

    return {
      text: responseText,
      ragMetadata: {
        enabled: true,
        ragUsed: true,
        retrievedDocs: finalResults.length,
        sources,
        retrievalTime,
        generationTime,
        totalTime,
        cacheHit: false,
        mock: servedMock,
        degradedReason,
      },
    }
  } catch (error) {
    console.error('[RAG] Generation failed:', error)

    // Graceful fallback
    return {
      text: '',
      ragMetadata: {
        enabled: true,
        ragUsed: false,
        error: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

/**
 * Build enhanced context from search results
 * Formats retrieved knowledge for inclusion in system prompt
 */
export function buildEnhancedContext(
  results: SearchResult[],
  maxTokens: number = MAX_CONTEXT_TOKENS
): string {
  const sections: string[] = []
  const maxChars = maxTokens * CHARS_PER_TOKEN
  let currentLength = 0

  sections.push('## Retrieved Knowledge Context\n')
  sections.push('The following wisdom has been retrieved from related agents:\n')

  for (const result of results) {
    const agentSection = `\n### From ${result.agentName} (Relevance: ${(result.score * 100).toFixed(0)}%)\n${result.content}\n`

    // Check if adding this would exceed limit
    if (currentLength + agentSection.length > maxChars) {
      break
    }

    sections.push(agentSection)
    currentLength += agentSection.length
  }

  sections.push(
    '\nUse the above context to enhance your response, but maintain your unique personality and voice.'
  )

  return sections.join('')
}

/**
 * Build enhanced system prompt with retrieved context
 */
export function buildEnhancedPrompt(
  basePrompt: string,
  retrievedContext: string,
  agent: any
): string {
  const sections: string[] = []

  // Original system prompt
  sections.push(basePrompt)

  // Add retrieved context
  sections.push('\n---\n')
  sections.push(retrievedContext)

  // Guidance for using retrieved context
  sections.push('\n---\n')
  sections.push('## Guidance for Using Retrieved Context\n')
  sections.push('1. Use the retrieved knowledge to provide deeper, more informed responses')
  sections.push('2. Cite or reference other agents when their wisdom is relevant')
  sections.push("3. Maintain your unique personality - don't simply parrot the retrieved content")
  sections.push('4. Synthesize insights from multiple sources when applicable')
  sections.push('5. If retrieved context contradicts your perspective, acknowledge it thoughtfully')

  return sections.join('\n')
}

/**
 * Generate summary of retrieved context for logging/debugging
 */
export function summarizeRetrievedContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No relevant context retrieved'
  }

  const agentNames = [...new Set(results.map(r => r.agentName))]
  const avgRelevance = results.reduce((sum, r) => sum + r.score, 0) / results.length

  return (
    `Retrieved ${results.length} passages from ${agentNames.length} agent(s): ${agentNames.join(', ')} ` +
    `(avg relevance: ${(avgRelevance * 100).toFixed(0)}%)`
  )
}

/**
 * Check if RAG should be used for a given query
 * Some queries might not benefit from RAG (e.g., greetings)
 */
export function shouldUseRAG(userMessage: string): boolean {
  if (!userMessage) return false
  const message = userMessage.toLowerCase().trim()

  // Skip RAG for simple greetings
  const greetings = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good evening']
  if (greetings.some(g => message === g)) {
    return false
  }

  // Skip RAG for very short queries (likely not substantive)
  if (message.length < 10) {
    return false
  }

  // Use RAG for questions and substantive statements
  return true
}

/**
 * Get RAG configuration from environment
 */
export function getRAGConfig(): {
  enabled: boolean
  topK: number
  threshold: number
  useReranking: boolean
  maxContextTokens: number
} {
  return {
    enabled: process.env.USE_RAG_GENERATION === 'true' || process.env.USE_VECTOR_SEARCH === 'true',
    topK: parseInt(process.env.RAG_TOP_K || '5'),
    threshold: parseFloat(process.env.RAG_RELEVANCE_THRESHOLD || '0.7'),
    useReranking: process.env.RAG_USE_RERANKING !== 'false',
    maxContextTokens: parseInt(process.env.RAG_MAX_CONTEXT_TOKENS || '1500'),
  }
}
