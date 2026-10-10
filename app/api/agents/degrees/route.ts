import { type NextRequest, NextResponse } from 'next/server'
import { computeActiveDegreeAgents } from '@/lib/agents/activations'

export const dynamic = 'force-dynamic'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawDate = searchParams.get('date')
  const date = rawDate ? new Date(rawDate) : new Date()

  if (Number.isNaN(date.getTime())) {
    return NextResponse.json(
      { error: 'Invalid date parameter' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const activeAgents = computeActiveDegreeAgents(date)
  const degreesMap: Record<number, unknown> = {}

  // Only assign active agents to degrees where a planet is currently transiting
  for (const a of activeAgents) {
    if (a.absoluteDegree !== undefined) {
      degreesMap[a.absoluteDegree] = {
        id: a.agent.id,
        name: a.agent.name,
        description: a.agent.description,
        activationStrength: Math.round(a.strength * 100),
        strength: a.strength,
        dignity: a.dignity,
        element: a.element,
        planetaryRuler: a.planetaryRuler,
        config: {
          element: a.element,
          planetaryRuler: a.planetaryRuler,
          dignity: a.dignity,
          modality: a.modality,
          degree: a.exactDegree,
        },
        consciousnessState: {
          level: a.consciousness?.level,
          powerLevel: a.consciousness?.powerLevel,
        },
        agent: a.agent,
      }
    }
  }

  return NextResponse.json(degreesMap, { headers: CORS_HEADERS })
}
