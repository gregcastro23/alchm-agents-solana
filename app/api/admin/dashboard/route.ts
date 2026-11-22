import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { sortAlerts } from '@/lib/admin/alerts'
import { loadDashboard } from '@/lib/admin/dashboard'
import { memoizeAdmin } from '@/lib/admin/memory-cache'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CACHE_TTL_MS = 15_000

/**
 * The shared admin read (users, roster, activity, Jing, MCP, councils, system).
 * Every part is read on its own and reports its own failure — see lib/admin/dashboard.ts.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const fresh = req.nextUrl.searchParams.get('fresh') === '1'
  const report = await memoizeAdmin(
    'admin:dashboard',
    CACHE_TTL_MS,
    async () => {
      const loaded = await loadDashboard()
      return { ...loaded, alerts: sortAlerts(loaded.alerts) }
    },
    { fresh }
  )
  return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
}
