/**
 * RAG Cache Statistics API
 *
 * GET /api/rag/cache - Get cache statistics
 * DELETE /api/rag/cache - Clear cache
 */

import { NextRequest, NextResponse } from 'next/server'
import { ragCache } from '@/lib/rag/rag-cache'
import { recordAdminAction } from '@/lib/admin/audit'
import { requireAdminOrService, toAdminAuditActor } from '@/lib/security/privileged-api-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/rag/cache
 * Get cache statistics
 */
export async function GET(request: NextRequest) {
  const access = await requireAdminOrService(request)
  if (!access.ok) return access.response

  try {
    const stats = ragCache.getStats()

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        // Add computed metrics
        avgHitsPerEntry: stats.cacheSize > 0 ? stats.totalHits / stats.cacheSize : 0,
        memoryUsageEstimate: `~${Math.round(stats.cacheSize * 2)}KB`, // Rough estimate
      },
    })
  } catch (error) {
    console.error('[RAG Cache API] Failed to get stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cache stats',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/rag/cache
 * Clear cache (admin only in production)
 */
export async function DELETE(request: NextRequest) {
  const access = await requireAdminOrService(request)
  if (!access.ok) return access.response

  try {
    const audit = await recordAdminAction(toAdminAuditActor(access), {
      action: 'rag.cache.clear.requested',
      targetType: 'rag_cache',
      targetId: 'all',
      before: { stats: ragCache.getStats() },
      after: { cacheSize: 0 },
    })
    if (!audit.recorded) {
      return NextResponse.json(
        { success: false, error: `Mandatory audit write failed: ${audit.reason}` },
        { status: 503 }
      )
    }

    ragCache.clear()

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
      audit,
    })
  } catch (error) {
    console.error('[RAG Cache API] Failed to clear cache:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear cache',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rag/cache/invalidate
 * Invalidate specific cache entries
 */
export async function POST(request: NextRequest) {
  const access = await requireAdminOrService(request)
  if (!access.ok) return access.response

  try {
    const body = await request.json()

    const targetId = body.agentId ? String(body.agentId) : body.clearAll ? 'all' : null
    if (!targetId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request: provide agentId or clearAll=true',
        },
        { status: 400 }
      )
    }

    const audit = await recordAdminAction(toAdminAuditActor(access), {
      action: body.agentId ? 'rag.cache.invalidate-agent.requested' : 'rag.cache.clear.requested',
      targetType: 'rag_cache',
      targetId,
      before: { stats: ragCache.getStats() },
      after: body.agentId ? { agentId: targetId, invalidated: true } : { cacheSize: 0 },
    })
    if (!audit.recorded) {
      return NextResponse.json(
        { success: false, error: `Mandatory audit write failed: ${audit.reason}` },
        { status: 503 }
      )
    }

    // Support invalidating by agent or query pattern
    if (body.agentId) {
      const agentId: string = String(body.agentId)

      // 1. Clear the in-memory rag-cache entries for this agent. This
      //    is the fast path that affects subsequent chats on this Next
      //    instance immediately.
      const inMemoryRemoved = await ragCache.invalidateAgent(agentId)

      // 2. Fire-and-not-quite-forget the backend ChromaDB invalidation.
      //    Failure here doesn't break the in-memory invalidation that
      //    already succeeded — we report the partial result so the
      //    caller can decide to retry the backend hop separately.
      let backendResult: { deletedChunks: number; remainingChunks: number } | null = null
      let backendError: string | null = null
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL ||
          process.env.PLANETARY_AGENTS_BACKEND_URL ||
          'http://localhost:8000'
        const internalSecret = process.env.INTERNAL_API_SECRET
        if (!internalSecret) {
          backendError = 'INTERNAL_API_SECRET missing — ChromaDB invalidation skipped.'
        } else {
          const response = await fetch(
            `${backendUrl.replace(/\/$/, '')}/api/rag/agents/${encodeURIComponent(agentId)}`,
            {
              method: 'DELETE',
              headers: {
                'X-Internal-Secret': internalSecret,
              },
            }
          )
          if (response.ok) {
            backendResult = (await response.json()) as {
              deletedChunks: number
              remainingChunks: number
            }
          } else {
            backendError = `Backend responded ${response.status}: ${await response.text()}`
          }
        }
      } catch (err) {
        backendError = err instanceof Error ? err.message : String(err)
      }

      return NextResponse.json({
        success: backendError === null,
        agentId,
        inMemoryRemoved,
        chromaDb: backendResult ?? { error: backendError },
        audit,
      })
    }

    if (body.clearAll) {
      ragCache.clear()
      return NextResponse.json({
        success: true,
        message: 'All cache entries cleared',
        audit,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid cache invalidation request' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[RAG Cache API] Failed to invalidate cache:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to invalidate cache',
      },
      { status: 500 }
    )
  }
}
