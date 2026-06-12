/**
 * Agent Semantic Search Endpoint
 *
 * Gated by USE_RAG_GENERATION feature flag.
 * Provides semantic search, multi-agent search, and similarity matching across agent knowledge.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withApiErrorHandling } from '@/lib/error-handling'
import { logger } from '@/lib/structured-logger'

export const runtime = 'nodejs'

/**
 * Semantic Search Request Interface
 */
interface SemanticSearchRequest {
  mode?: 'single' | 'multi' | 'similar'
  concept: string
  agentId?: string
  agentIds?: string[]
  options?: any
}

/**
 * Checks if RAG features are enabled via feature flag
 */
function checkRagEnabled() {
  if (process.env.USE_RAG_GENERATION !== 'true') {
    return NextResponse.json(
      {
        success: false,
        status: 'disabled',
        error: 'RAG features disabled',
        message:
          'RAG features are currently disabled. Set USE_RAG_GENERATION=true in your environment.',
      },
      { status: 503 }
    )
  }
  return null
}

async function searchBackendRag(agentId: string, concept: string) {
  const backendUrl =
    process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
  const url = new URL('/api/rag/search', backendUrl)
  url.searchParams.set('agent_id', agentId)
  url.searchParams.set('query', concept)

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Backend RAG search failed with HTTP ${response.status}`)
  }

  const data = await response.json()
  const documents = data.documents?.[0] || []
  const metadatas = data.metadatas?.[0] || []
  const distances = data.distances?.[0] || []
  const ids = data.ids?.[0] || []

  return {
    success: true,
    degraded: data.degraded === true,
    source: 'backend-rag',
    results: documents.map((document: string, index: number) => ({
      id: ids[index] || `${agentId}-${index}`,
      agentId,
      agentName: metadatas[index]?.agentName || agentId,
      content: document,
      score: Math.max(0, 1 - Number(distances[index] || 0)),
      metadata: metadatas[index] || {},
    })),
    backendError: data.error,
  }
}

/**
 * POST /api/agents/semantic-search
 * Performs semantic search operations
 */
export async function POST(req: NextRequest) {
  const ragDisabled = checkRagEnabled()

  return withApiErrorHandling(
    async () => {
      const body: SemanticSearchRequest = await req
        .json()
        .catch(() => ({}) as SemanticSearchRequest)

      if (!body.concept || body.concept.trim().length === 0) {
        return NextResponse.json({ success: false, error: 'concept is required' }, { status: 400 })
      }

      if (ragDisabled) {
        if (!body.agentId || body.mode === 'multi' || body.mode === 'similar') return ragDisabled
        return searchBackendRag(body.agentId, body.concept)
      }

      const { searchAgentKnowledge, multiAgentSearch, findSimilarAgents } =
        await import('@/lib/llamaindex')

      logger.info('Semantic search request received', {
        system: 'api',
        operation: 'semantic_search',
        metadata: { mode: body.mode || 'single', agentId: body.agentId },
      })

      let result
      if (body.mode === 'multi') {
        result = await multiAgentSearch(
          body.concept,
          body.agentIds || [],
          body.options?.resultsPerAgent
        )
      } else if (body.mode === 'similar') {
        result = await findSimilarAgents(body.concept, body.options)
      } else {
        if (!body.agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId is required for single-agent search' },
            { status: 400 }
          )
        }
        try {
          result = await searchAgentKnowledge(body.agentId, body.concept, body.options)
        } catch (error) {
          logger.warn('Semantic search fell back to backend RAG', {
            system: 'api',
            operation: 'semantic_search_fallback',
            agentId: body.agentId,
            metadata: { error: error instanceof Error ? error.message : String(error) },
          })
          return searchBackendRag(body.agentId, body.concept)
        }
      }

      return {
        success: true,
        ...result,
      }
    },
    {
      system: 'rag',
      operation: 'api_semantic_search',
      severity: 'medium',
    }
  )
}

/**
 * GET /api/agents/semantic-search
 * Checks RAG system health and returns collection statistics
 */
export async function GET(_req: NextRequest) {
  const ragDisabled = checkRagEnabled()
  if (ragDisabled) return ragDisabled

  return withApiErrorHandling(
    async () => {
      const { validateIngestion, getIngestionStatus } =
        await import('@/lib/llamaindex/ingestion-pipeline')

      const validation = await validateIngestion()
      const status = await getIngestionStatus()

      logger.info('RAG health check requested', {
        system: 'api',
        operation: 'rag_health',
        metadata: { healthy: validation.valid },
      })

      return {
        success: true,
        healthy: validation.valid,
        status: status.message,
        documentCount: status.documentCount,
        collectionName: status.collectionName,
        errors: validation.errors,
      }
    },
    {
      system: 'rag',
      operation: 'api_rag_health',
      severity: 'low',
    }
  )
}
