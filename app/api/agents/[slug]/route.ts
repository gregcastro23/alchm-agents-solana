import { type NextRequest, NextResponse } from 'next/server'
import { HISTORICAL_AGENTS, getHistoricalAgent } from '@/lib/agents/historical'

export const dynamic = 'force-static'
export const revalidate = false

export async function generateStaticParams() {
  return HISTORICAL_AGENTS.map(agent => ({ slug: agent.id }))
}

const PROFILE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PROFILE_HEADERS })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const agent = getHistoricalAgent(slug)

  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found' },
      { status: 404, headers: PROFILE_HEADERS }
    )
  }

  return NextResponse.json(agent, { headers: PROFILE_HEADERS })
}
