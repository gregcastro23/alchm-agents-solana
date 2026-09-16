import { NextRequest, NextResponse } from 'next/server'
import {
  isPlanetaryAgent,
  answerPillarDuel,
  AGENT_ARCHETYPE_CHARTS,
  DEFAULT_AGENT_POOLS,
  type PlanetaryAgent,
} from '@/lib/pillar-agent-duel'
import { PILLARS, pillarById, type ChartInput, type Esms } from '@/lib/alchemy/pillars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * POST /api/agents/pillar
 *
 * Companion endpoint for Pentacles Fourteen Pillars Arena feeder.
 * Receives an agent planet, an opponent opening pillar name, and the sky sect,
 * evaluates the alchemical circuit best response, and returns the chosen pillar
 * along with the characterful voice line.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const { planet, opening, sky = 'diurnal', challengerChart, challengerPools } = body

    if (!isPlanetaryAgent(planet)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or missing planet agent. Must be one of the ten planetary spheres.',
        },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Resolve opening pillar by name or id
    const openingSpec =
      typeof opening === 'number'
        ? pillarById(opening)
        : PILLARS.find(p => p.name.toLowerCase() === String(opening).toLowerCase())

    if (!openingSpec) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid opening pillar "${opening}". Must be one of the Fourteen Alchemical Pillars.`,
        },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const skySect = String(sky).toLowerCase() === 'nocturnal' ? 'nocturnal' : 'diurnal'
    const chart: ChartInput =
      challengerChart &&
      typeof challengerChart === 'object' &&
      Array.isArray((challengerChart as any).signs)
        ? (challengerChart as ChartInput)
        : AGENT_ARCHETYPE_CHARTS[planet as PlanetaryAgent]
    const pools: Esms =
      Array.isArray(challengerPools) && challengerPools.length === 4
        ? (challengerPools as Esms)
        : DEFAULT_AGENT_POOLS

    const duel = answerPillarDuel(planet as PlanetaryAgent, openingSpec.id, chart, pools, skySect)

    return NextResponse.json(
      {
        success: true,
        planet,
        pillar: duel.chosenPillar.name,
        pillarId: duel.chosenPillar.id,
        voice: duel.voice,
        source: 'best-response',
        willWin: duel.willWin,
        winner: duel.outcome.winner,
        powerRatio: duel.outcome.ratioB,
        magnitude: duel.outcome.magnitudeB,
        timestamp: new Date().toISOString(),
      },
      { headers: CORS_HEADERS }
    )
  } catch (error) {
    console.error('[pillar] Error handling agent pillar move:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
