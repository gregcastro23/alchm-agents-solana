import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { sortAlerts } from '@/lib/admin/alerts'
import { loadJobsReport } from '@/lib/admin/jobs'

export const dynamic = 'force-dynamic'

/**
 * Jobs & crons: one row per scheduled ASOL job, evaluated from `cron_runs`
 * heartbeats with the same rules WTEN uses. When heartbeats cannot be read the
 * report says so (`heartbeats.status`) and every derived number is null.
 */
export async function GET(_req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const report = await loadJobsReport()
  return NextResponse.json(
    { ...report, alerts: sortAlerts(report.alerts) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
