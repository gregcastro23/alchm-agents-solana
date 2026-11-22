import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { buildOverviewPulse } from '@/lib/admin/overview-pulse'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return adminErrorResponse(auth)

  const fresh = req.nextUrl.searchParams.get('fresh') === '1'
  const pulse = await buildOverviewPulse({ fresh })

  return NextResponse.json(pulse, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
