import { NextResponse } from 'next/server'
import { dailyCouncilService } from '@/lib/agents/council/daily-council-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const result = await dailyCouncilService.read()
  return NextResponse.json(result, {
    status: result.status === 'unavailable' ? 503 : 200,
    headers: {
      'Cache-Control':
        result.status === 'unavailable'
          ? 'no-store'
          : 'public, s-maxage=60, stale-while-revalidate=120',
    },
  })
}
