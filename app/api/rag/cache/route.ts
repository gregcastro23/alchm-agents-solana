/**
 * RAG Cache Statistics API
 *
 * GET /api/rag/cache - Get cache statistics
 * DELETE /api/rag/cache - Clear cache
 */

import { NextRequest, NextResponse } from 'next/server'
import { ragCache } from '@/lib/rag/rag-cache'

export const dynamic = 'force-dynamic'

/**
 * GET /api/rag/cache
 * Get cache statistics
 */
export async function GET(request: NextRequest) {
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
  try {
    // In production, you might want to add authentication here
    // const session = await getSession(request)
    // if (!session?.user?.isAdmin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    ragCache.clear()

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
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
  try {
    const body = await request.json()

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
      })
    }

    if (body.clearAll) {
      ragCache.clear()
      return NextResponse.json({
        success: true,
        message: 'All cache entries cleared',
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request: provide agentId or clearAll=true',
      },
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
