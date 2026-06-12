import { type NextRequest, NextResponse } from 'next/server'
import {
  ACTIVITY_CACHE_HEADERS,
  ACTIVITY_OPTIONS_HEADERS,
  getAgentActions,
  validateInternalBearer,
} from '@/lib/agents/activity-surfaces'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: ACTIVITY_OPTIONS_HEADERS })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const auth = validateInternalBearer(req)
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: auth.status || 401, headers: ACTIVITY_OPTIONS_HEADERS }
    )
  }

  const { slug } = await params
  const data = await getAgentActions(slug, req.nextUrl.searchParams)
  return NextResponse.json(data, { headers: ACTIVITY_CACHE_HEADERS })
}
