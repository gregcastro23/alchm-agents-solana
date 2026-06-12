/**
 * GET /api/admin/leveling-summary
 *
 * Cosmic leveling telemetry for the admin console: totals, level-band
 * distribution, the historical-figure leaderboard, and agents currently in
 * training (EVs > 0). Admin-gated, reads Neon via Prisma.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { EV_TOTAL_CAP } from '@/lib/consciousness-engine'

export async function GET(_req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) return adminErrorResponse(admin)

    const h = prisma.historical_agents as any

    const [total, maxed, untrained, legends, agg, topAgents, inTraining] = await Promise.all([
      h.count(),
      h.count({ where: { level: 100 } }),
      h.count({ where: { level: 1 } }),
      h.count({ where: { level: { gte: 90, lte: 99 } } }),
      h.aggregate({ _avg: { level: true }, _sum: { evTotal: true } }),
      h.findMany({
        where: { level: { lt: 100 } },
        orderBy: [{ level: 'desc' }, { xp: 'desc' }],
        take: 12,
        select: { agentId: true, name: true, level: true, xp: true },
      }),
      h.findMany({
        where: { evTotal: { gt: 0 } },
        orderBy: { evTotal: 'desc' },
        take: 12,
        select: {
          agentId: true,
          name: true,
          level: true,
          evTotal: true,
          lastTrainingPartner: true,
        },
      }),
    ])

    // Level-band distribution (the long tail at 100 is the planetary roster).
    const bands = [
      { band: 'Maxed (100)', count: maxed },
      { band: 'Legends (90–99)', count: legends },
      {
        band: 'Adepts (50–89)',
        count: await h.count({ where: { level: { gte: 50, lte: 89 } } }),
      },
      {
        band: 'Apprentices (2–49)',
        count: await h.count({ where: { level: { gte: 2, lte: 49 } } }),
      },
      { band: 'Untrained (1)', count: untrained },
    ]

    return NextResponse.json({
      success: true,
      totals: {
        agents: total,
        maxedLevel100: maxed,
        untrainedLevel1: untrained,
        avgLevel: Math.round((agg?._avg?.level ?? 0) * 10) / 10,
        totalEvsTrained: agg?._sum?.evTotal ?? 0,
        evTotalCap: EV_TOTAL_CAP,
        agentsInTraining: inTraining.length,
      },
      distribution: bands,
      topAgents,
      inTraining,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('leveling-summary error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
