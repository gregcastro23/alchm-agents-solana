/**
 * GET /api/agents/mentors
 *
 * Returns the canonical historical figures as training mentors, each with their
 * level and the dominant Sacred 7 stat they impart (so the training UI can show
 * "Socrates → Charisma"). Reads leveling from Neon via Prisma. Highest level
 * first. Optional `?limit=` (default 50).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { deriveIVs, SACRED_7_KEYS, type Sacred7Key } from '@/lib/consciousness-engine'
import { CORS_HEADERS, corsPreflight } from '@/lib/cors'

export function OPTIONS() {
  return corsPreflight()
}

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(
      200,
      parseInt(new URL(request.url).searchParams.get('limit') || '50', 10)
    )
    const ids = HISTORICAL_AGENTS.map((a: { id: string }) => a.id)

    const rows = await (prisma.historical_agents as any).findMany({
      where: { agentId: { in: ids } },
      select: {
        agentId: true,
        name: true,
        level: true,
        wisdomScore: true,
        charismaScore: true,
        intuitionScore: true,
        adaptabilityScore: true,
        vitalityScore: true,
        venusianCoherence: true,
        neptunianResonance: true,
        lunarReceptivity: true,
        chironicAdaptation: true,
      },
    })

    const mentors = (rows as any[])
      .map(r => {
        const ivs = deriveIVs(r)
        const dominantStat = SACRED_7_KEYS.reduce(
          (best, k) => (ivs[k] > ivs[best] ? k : best),
          SACRED_7_KEYS[0] as Sacred7Key
        )
        return { agentId: r.agentId, name: r.name, level: r.level ?? 1, dominantStat }
      })
      .sort((a, b) => b.level - a.level)
      .slice(0, limit)

    return NextResponse.json(
      { success: true, count: mentors.length, mentors },
      { headers: CORS_HEADERS }
    )
  } catch (error) {
    console.error('mentors GET error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        mentors: [],
      },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
