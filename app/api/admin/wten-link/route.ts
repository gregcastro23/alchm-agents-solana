import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { sortAlerts } from '@/lib/admin/alerts'
import { loadWtenLinkReport } from '@/lib/admin/wten-link'

export const dynamic = 'force-dynamic'

/**
 * WTEN link: delivery health per WTEN endpoint over the last 24h (from
 * `wten_deliveries`), the latest attempts, and whether each shared secret
 * matches WTEN's — judged from the status WTEN answers a harmless probe with
 * (cached 5 minutes), never by reading a secret.
 */
export async function GET(_req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const report = await loadWtenLinkReport()
  return NextResponse.json(
    { ...report, alerts: sortAlerts(report.alerts) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
