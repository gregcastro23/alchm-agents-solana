/**
 * RAG (Retrieval-Augmented Generation) Wrapper - FULL IMPLEMENTATION
 *
 * Integrates RAG capabilities into Monica and other agents.
 * Provides seamless fallback when RAG is disabled or unavailable.
 *
 * Feature flags:
 * - USE_RAG_GENERATION: Enable RAG-enhanced generation
 * - USE_VECTOR_SEARCH: Enable semantic search capabilities
 */

import {
  getRAGConfig,
  shouldUseRAG,
  summarizeRetrievedContext,
  type RAGGenerateOptions,
  type RAGResult,
  type RAGMetadata,
  type RAGSource,
} from './rag-generator'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { logger } from '@/lib/structured-logger'

/**
 * Resolve AI model provider and ID for direct (non-RAG) generation.
 * Prefers the model passed in options; falls back to MONICA env vars and
 * finally to safe known-good defaults.
 */
function resolveDirectModel(modelId?: string) {
  const id =
    modelId || process.env.MONICA_DEFAULT_MODEL || process.env.CLAUDE_DEFAULT_MODEL || 'gpt-4o-mini'

  // Claude model IDs start with 'claude-'
  if (id.startsWith('claude-')) {
    return anthropic(id)
  }
  return openai(id)
}

/**
 * Call AI directly without RAG context — used as fallback when RAG is
 * disabled or the query doesn't require retrieval augmentation.
 */
async function generateDirect(options: RAGGenerateOptions): Promise<RAGResult> {
  const model = resolveDirectModel((options as any).model)
  const temperature = (options as any).temperature ?? 0.7
  const maxOutputTokens = (options as any).maxTokens ?? 800

  const { text } = await generateText({
    model,
    system: options.systemPrompt,
    prompt: options.userMessage,
    temperature,
    maxOutputTokens,
  })

  return {
    text,
    ragMetadata: {
      enabled: false,
      ragUsed: false,
    },
  }
}

export type { RAGGenerateOptions, RAGResult, RAGMetadata, RAGSource }
export { shouldUseRAG }

/**
 * Generate with RAG enhancement (main entry point)
 *
 * This function is the primary interface for RAG-enhanced generation.
 * It handles feature flag checks, fallback logic, and error handling.
 */
export async function generateWithRAG(options: RAGGenerateOptions): Promise<RAGResult> {
  // Check if RAG is globally enabled
  const ragConfig = getRAGConfig()

  if (!ragConfig.enabled) {
    logger.debug('RAG is disabled — falling back to direct generation', {
      system: 'rag',
      operation: 'generate',
    })
    return generateDirect(options)
  }

  // Check if this query should use RAG
  if (!shouldUseRAG(options.userMessage)) {
    logger.debug('Query does not require RAG — falling back to direct generation', {
      system: 'rag',
      operation: 'generate',
      metadata: { messageLength: options.userMessage.length },
    })
    return generateDirect(options)
  }

  try {
    // Dynamic import for RAG core to prevent loading heavy modules when not used
    const { generateWithRAG: generateWithRAGCore } = await import('./rag-generator')

    // Merge with environment config if not explicitly provided
    const mergedOptions: RAGGenerateOptions = {
      ...options,
      ragConfig: {
        enabled: ragConfig.enabled,
        topK: options.ragConfig?.topK || ragConfig.topK,
        threshold: options.ragConfig?.threshold || ragConfig.threshold,
        useReranking: options.ragConfig?.useReranking ?? ragConfig.useReranking,
      },
    }

    // Generate with RAG
    const result = await generateWithRAGCore(mergedOptions)

    // Log results
    if (result.ragMetadata.ragUsed && result.ragMetadata.sources) {
      const summary = summarizeRetrievedContext(
        result.ragMetadata.sources.map(s => ({
          id: s.agentId,
          agentId: s.agentId,
          agentName: s.agentName,
          content: s.excerpt,
          score: s.relevance,
          metadata: {
            agentId: s.agentId,
            agentName: s.agentName,
            chunkIndex: 0,
            totalChunks: 1,
            source: 'historical_agent',
          },
        }))
      )
      logger.info('RAG generation completed', {
        system: 'rag',
        operation: 'generate',
        metadata: {
          summary,
          sourcesCount: result.ragMetadata.sources.length,
          retrievedDocs: result.ragMetadata.retrievedDocs,
        },
      })
    }

    return result
  } catch (error) {
    logger.error('RAG generation failed, falling back', {
      system: 'rag',
      operation: 'generate',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    })

    // Graceful fallback — RAG failed, still generate a response without it
    logger.debug('RAG failed — falling back to direct generation', {
      system: 'rag',
      operation: 'generate',
    })
    try {
      return await generateDirect(options)
    } catch (directErr) {
      logger.error('Direct generation also failed', {
        system: 'rag',
        operation: 'generate',
        metadata: { error: directErr instanceof Error ? directErr.message : String(directErr) },
      })
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
}

/**
 * Get RAG system status
 *
 * Returns information about RAG availability and configuration.
 */
export async function getRAGStatus(): Promise<{
  enabled: boolean
  vectorStoreReady: boolean
  message: string
  config?: {
    topK: number
    threshold: number
    useReranking: boolean
    maxContextTokens: number
  }
}> {
  const config = getRAGConfig()

  if (!config.enabled) {
    return {
      enabled: false,
      vectorStoreReady: false,
      message: 'RAG features are disabled (set USE_RAG_GENERATION=true or USE_VECTOR_SEARCH=true)',
    }
  }

  // Perform actual vector store health check
  try {
    const { healthCheck } = await import('@/lib/llamaindex/vector-store')
    const health = await healthCheck()

    return {
      enabled: true,
      vectorStoreReady: health.healthy,
      message: health.healthy
        ? `RAG is enabled and operational (${health.url})`
        : `RAG enabled but vector store unavailable: ${health.message}`,
      config: {
        topK: config.topK,
        threshold: config.threshold,
        useReranking: config.useReranking,
        maxContextTokens: config.maxContextTokens,
      },
    }
  } catch (error) {
    logger.error('RAG health check failed', {
      system: 'rag',
      operation: 'health_check',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    })
    return {
      enabled: true,
      vectorStoreReady: false,
      message: `RAG enabled but health check failed: ${error instanceof Error ? error.message : String(error)}`,
      config: {
        topK: config.topK,
        threshold: config.threshold,
        useReranking: config.useReranking,
        maxContextTokens: config.maxContextTokens,
      },
    }
  }
}

/**
 * Check if RAG is available for use
 */
export async function isRAGAvailable(): Promise<boolean> {
  try {
    const status = await getRAGStatus()
    return status.enabled && status.vectorStoreReady
  } catch (error) {
    logger.error('Error checking RAG availability', {
      system: 'rag',
      operation: 'availability_check',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    })
    return false
  }
}

/**
 * Warm up RAG system (preload collections, test connections, etc.)
 * Call this during app initialization for better first-request performance
 */
export async function warmupRAG(): Promise<boolean> {
  const config = getRAGConfig()

  if (!config.enabled) {
    logger.debug('RAG is disabled, skipping warmup', {
      system: 'rag',
      operation: 'warmup',
    })
    return false
  }

  try {
    logger.info('Warming up RAG system', {
      system: 'rag',
      operation: 'warmup',
    })

    // Import and check vector store health
    const { healthCheck } = await import('@/lib/llamaindex/vector-store')
    const health = await healthCheck()

    if (!health.healthy) {
      logger.warn('Vector store is not healthy', {
        system: 'rag',
        operation: 'warmup',
        metadata: { message: health.message },
      })
      return false
    }

    logger.info('RAG system warmup complete', {
      system: 'rag',
      operation: 'warmup',
    })
    return true
  } catch (error) {
    logger.error('RAG warmup failed', {
      system: 'rag',
      operation: 'warmup',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    })
    return false
  }
}

/**
 * Get RAG statistics (for debugging/monitoring)
 */
export function getRAGStats(): {
  enabled: boolean
  featuresUsed: string[]
  configuration: Record<string, any>
} {
  const config = getRAGConfig()

  const featuresUsed: string[] = []
  if (process.env.USE_RAG_GENERATION === 'true') {
    featuresUsed.push('RAG Generation')
  }
  if (process.env.USE_VECTOR_SEARCH === 'true') {
    featuresUsed.push('Vector Search')
  }

  return {
    enabled: config.enabled,
    featuresUsed,
    configuration: {
      topK: config.topK,
      threshold: config.threshold,
      useReranking: config.useReranking,
      maxContextTokens: config.maxContextTokens,
      embeddingsModel: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large',
      chromaDbUrl: process.env.CHROMADB_URL || 'http://localhost:8001',
    },
  }
}
