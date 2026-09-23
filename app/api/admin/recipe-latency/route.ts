import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { sortAlerts } from '@/lib/admin/alerts'
import { loadRecipeLatency } from '@/lib/admin/recipe-latency'

export const dynamic = 'force-dynamic'

/**
 * /api/generate-recipe p50 / p95 / error rate, from the Python backend's
 * in-process window. WTEN's hourly prewarm is the main caller and gives each
 * generation 45s, so p95 is judged against that budget.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const minutes = Number(new URL(req.url).searchParams.get('windowMinutes') ?? 1440)
  const windowMinutes = Number.isFinite(minutes)
    ? Math.min(10080, Math.max(5, Math.round(minutes)))
    : 1440
  const report = await loadRecipeLatency({ windowMinutes })
  return NextResponse.json(
    { ...report, alerts: sortAlerts(report.alerts) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
