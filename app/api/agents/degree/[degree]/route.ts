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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ degree: string }> }
) {
  const { degree: rawDegree } = await params
  const targetDegree = parseInt(rawDegree, 10)

  if (isNaN(targetDegree) || targetDegree < 0 || targetDegree > 359) {
    return NextResponse.json(
      { error: 'Degree must be an integer between 0 and 359' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const { searchParams } = new URL(request.url)
  const rawDate = searchParams.get('date')
  const date = rawDate ? new Date(rawDate) : new Date()

  const activeAgents = computeActiveDegreeAgents(date)
  const matchingAgent = activeAgents.find(a => a.absoluteDegree === targetDegree)

  if (!matchingAgent) {
    return NextResponse.json(
      {
        active: false,
        degree: targetDegree,
        message: `Degree ${targetDegree}° is currently dormant. No transiting planet is in this exact degree.`,
      },
      { status: 200, headers: CORS_HEADERS }
    )
  }

  return NextResponse.json(
    {
      active: true,
      degree: targetDegree,
      ...matchingAgent,
    },
    { headers: CORS_HEADERS }
  )
}
