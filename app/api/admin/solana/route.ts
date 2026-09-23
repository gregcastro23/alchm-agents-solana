import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { sortAlerts } from '@/lib/admin/alerts'
import { loadSolanaChainReport, type SolanaChainReport } from '@/lib/admin/solana-chain'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The page and the alert digest both poll this; a minute's memo keeps a public
// RPC from rate-limiting us into "unknown".
let cached: { at: number; report: SolanaChainReport } | null = null
const CACHE_TTL_MS = 60_000

/**
 * Solana & chain: every address in deployments/*.json checked against devnet
 * (and the program against mainnet-beta), section by section, plus the sync and
 * bridge worker queues and a devnet → mainnet readiness checklist.
 */
export async function GET(_req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  if (!cached || Date.now() - cached.at >= CACHE_TTL_MS) {
    const report = await loadSolanaChainReport()
    cached = { at: Date.now(), report: { ...report, alerts: sortAlerts(report.alerts) } }
  }
  return NextResponse.json(cached.report, { headers: { 'Cache-Control': 'no-store' } })
}
