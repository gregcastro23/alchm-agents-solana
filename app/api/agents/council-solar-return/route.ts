import { NextRequest, NextResponse } from 'next/server'
import { getSolarReturnCouncilEdition } from '@/lib/agents/council/solar-return-service'
import { SolarReturnCouncilResponseSchema } from '@/lib/agents/council/solar-return-edition-schema'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date')

  let parsedDate: Date | undefined
  if (dateParam) {
    const d = new Date(dateParam)
    if (!isNaN(d.getTime())) {
      parsedDate = d
    }
  }

  const result = await getSolarReturnCouncilEdition(parsedDate)
  const validated = SolarReturnCouncilResponseSchema.parse(result)

  return NextResponse.json(validated, {
    status: validated.status === 'unavailable' ? 503 : 200,
    headers: {
      'Cache-Control':
        validated.status === 'unavailable'
          ? 'no-store'
          : 'public, s-maxage=120, stale-while-revalidate=300',
    },
  })
}
