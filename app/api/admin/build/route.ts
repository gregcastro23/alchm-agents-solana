import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { sortAlerts } from '@/lib/admin/alerts'
import { loadBuildHealthReport } from '@/lib/admin/build-health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Build health from GitHub: latest CI per workflow on main, open PRs with
 * their CI state, and how far this deployment is behind main.
 */
export async function GET(_req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const report = await loadBuildHealthReport()
  return NextResponse.json(
    { ...report, alerts: sortAlerts(report.alerts) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
