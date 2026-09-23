import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { sortAlerts } from '@/lib/admin/alerts'
import { loadChatsReport } from '@/lib/admin/chats'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Chats & providers: per-model calls, failures and latency (24h, 7d), and recent chats. */
export async function GET(_req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const report = await loadChatsReport()
  return NextResponse.json(
    { ...report, alerts: sortAlerts(report.alerts) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
