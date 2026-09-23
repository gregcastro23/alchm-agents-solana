import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { loadAgentsReport } from '@/lib/admin/agents'
import { sortAlerts } from '@/lib/admin/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Agents: the code roster against historical_agents, agentic users linked to
 * alchm.kitchen, wallets, chart provenance, and 24h / 7d activity per agent.
 */
export async function GET(_req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const report = await loadAgentsReport()
  return NextResponse.json(
    { ...report, alerts: sortAlerts(report.alerts) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
