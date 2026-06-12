/**
 * GET /api/agents/leveling
 *
 * Bulk Cosmic leveling lookup for the gallery: returns a compact map of
 * agentId -> { level, xp, evTotal } straight from Neon via Prisma. Lets the
 * client merge level badges + sort-by-level without N round-trips or a Railway
 * redeploy. Optional `?agentIds=a,b,c` narrows the result.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { CORS_HEADERS, corsPreflight } from '@/lib/cors'

export function OPTIONS() {
  return corsPreflight()
}

export async function GET(request: NextRequest) {
  try {
    const idsParam = new URL(request.url).searchParams.get('agentIds')
    const agentIds = idsParam
      ? idsParam
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : null

    const rows = await (prisma.historical_agents as any).findMany({
      where: agentIds && agentIds.length ? { agentId: { in: agentIds } } : undefined,
      select: { agentId: true, level: true, xp: true, evTotal: true },
    })

    const map: Record<string, { level: number; xp: number; evTotal: number }> = {}
    for (const r of rows as Array<{
      agentId: string
      level: number | null
      xp: number | null
      evTotal: number | null
    }>) {
      map[r.agentId] = { level: r.level ?? 1, xp: r.xp ?? 0, evTotal: r.evTotal ?? 0 }
    }

    return NextResponse.json(
      { success: true, count: rows.length, leveling: map },
      { headers: CORS_HEADERS }
    )
  } catch (error) {
    console.error('bulk leveling GET error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        leveling: {},
      },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
