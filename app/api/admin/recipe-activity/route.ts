import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { sortAlerts } from '@/lib/admin/alerts'
import { loadRecipeActivity } from '@/lib/admin/recipe-activity'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Bundled catalog coverage and persisted recipe alterations/reviews; no delivery side effects. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const report = await loadRecipeActivity()
  return NextResponse.json(
    { ...report, alerts: sortAlerts(report.alerts) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
