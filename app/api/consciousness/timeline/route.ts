import { NextRequest, NextResponse } from 'next/server'
import { unifiedTracker } from '@/lib/consciousness/unified-tracker'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/consciousness/timeline
 * Fetch historical consciousness timeline data
 *
 * Query params:
 * - userId: string (required)
 * - agentId: string (required)
 * - startDate: ISO string (optional, defaults to 30 days ago)
 * - endDate: ISO string (optional, defaults to now)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const agentId = searchParams.get('agentId')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    if (!userId || !agentId) {
      return NextResponse.json({ error: 'userId and agentId are required' }, { status: 400 })
    }

    // Parse dates
    const endDate = endDateParam ? new Date(endDateParam) : new Date()
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

    // Fetch trend data
    const snapshots = await unifiedTracker.getTrend(userId, agentId, {
      start: startDate,
      end: endDate,
    })

    // Calculate summary statistics
    const summary =
      snapshots.length > 0
        ? {
            totalInteractions: snapshots.length,
            avgPower: snapshots.reduce((sum, s) => sum + s.power, 0) / snapshots.length,
            avgWisdom: snapshots.reduce((sum, s) => sum + s.wisdom, 0) / snapshots.length,
            avgOverall: snapshots.reduce((sum, s) => sum + s.overall, 0) / snapshots.length,
            avgChatQuality: snapshots.reduce((sum, s) => sum + s.chatQuality, 0) / snapshots.length,
            avgActionCompletion:
              snapshots.reduce((sum, s) => sum + s.actionCompletion, 0) / snapshots.length,
            avgLatency: snapshots.reduce((sum, s) => sum + s.latencyMs, 0) / snapshots.length,
          }
        : null

    return NextResponse.json({
      snapshots,
      summary,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      count: snapshots.length,
    })
  } catch (error) {
    console.error('Failed to fetch consciousness timeline:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch consciousness timeline',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
