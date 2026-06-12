import { NextRequest, NextResponse } from 'next/server'
import { unifiedTracker } from '@/lib/consciousness/unified-tracker'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/consciousness/current
 * Fetch current consciousness state and evolution metrics for an agent
 *
 * Query params:
 * - userId: string (required)
 * - agentId: string (required)
 * - days: number (optional, default 30) - days of history for evolution metrics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const agentId = searchParams.get('agentId')
    const days = parseInt(searchParams.get('days') || '30', 10)

    if (!userId || !agentId) {
      return NextResponse.json({ error: 'userId and agentId are required' }, { status: 400 })
    }

    // Fetch current state
    const currentSnapshot = await unifiedTracker.getCurrentState(userId, agentId)

    // Fetch evolution metrics
    const evolutionMetrics = await unifiedTracker.getEvolutionMetrics(userId, agentId, days)

    if (!currentSnapshot) {
      return NextResponse.json(
        {
          snapshot: null,
          evolutionMetrics,
          message: 'No consciousness data available for this agent',
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      snapshot: currentSnapshot,
      evolutionMetrics,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to fetch consciousness state:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch consciousness state',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
