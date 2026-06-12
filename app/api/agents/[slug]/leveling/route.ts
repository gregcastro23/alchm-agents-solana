/**
 * GET /api/agents/:agentId/leveling
 *
 * Returns an agent's Cosmic leveling state straight from the historical_agents
 * row (Neon via Prisma — independent of the Railway backend), with IVs, EVs,
 * effective Sacred 7 stats, and XP-bar progress pre-computed by the engine so
 * the UI can render without duplicating the math.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  deriveIVs,
  normalizeEvs,
  effectiveStats,
  levelProgress,
  evTotal as sumEvs,
  SACRED_7_KEYS,
  type Sacred7Key,
} from '@/lib/consciousness-engine'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: agentId } = await params

  try {
    const agent = await (prisma.historical_agents as any).findUnique({
      where: { agentId },
      select: {
        agentId: true,
        name: true,
        level: true,
        xp: true,
        evolutionValues: true,
        evTotal: true,
        ivSnapshot: true,
        lastTrainingPartner: true,
        // Score fields for IV fallback when ivSnapshot is missing.
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

    if (!agent) {
      return NextResponse.json(
        { success: false, error: `Agent not found: ${agentId}` },
        { status: 404 }
      )
    }

    // IVs: prefer the cached snapshot, fall back to live derivation.
    let ivs = {} as Record<Sacred7Key, number>
    const snap = agent.ivSnapshot
    if (snap && typeof snap === 'object' && !Array.isArray(snap)) {
      for (const key of SACRED_7_KEYS) ivs[key] = Number((snap as any)[key]) || 0
    }
    if (!Object.values(ivs).some(v => v > 0)) {
      ivs = deriveIVs(agent)
    }

    const evs = normalizeEvs(agent.evolutionValues)
    const level = agent.level ?? 1
    const xp = agent.xp ?? 0
    const total = agent.evTotal ?? sumEvs(evs)

    return NextResponse.json({
      success: true,
      agentId: agent.agentId,
      name: agent.name,
      level,
      xp,
      progress: levelProgress(xp),
      ivs,
      evs,
      evTotal: total,
      effectiveStats: effectiveStats(ivs, evs, level),
      lastTrainingPartner: agent.lastTrainingPartner ?? null,
    })
  } catch (error) {
    console.error('leveling GET error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
