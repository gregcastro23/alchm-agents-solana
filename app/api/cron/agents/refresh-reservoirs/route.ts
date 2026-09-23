import { NextResponse } from 'next/server'
import { refreshSpriteReservoirs } from '@/lib/agents/sprite-reservoirs'
import { authorizeCron } from '@/lib/security/cron-auth'
import { runCronJob } from '@/lib/cron/heartbeat'

/**
 * GET/POST /api/cron/agents/refresh-reservoirs
 *
 * Daily cron: re-mints every sky-sprite's ESMS reservoir from the live sky
 * (degree → dignity, moon → phase). Wallet agents are untouched. Protected by
 * CRON_SECRET in production.
 *
 * Vercel Cron schedule: `20 0 * * *` (daily at 00:20 UTC, staggered off WTEN's minutes).
 */
export async function POST(request: Request) {
  return handleRefresh(request)
}

export async function GET(request: Request) {
  return handleRefresh(request)
}

async function handleRefresh(request: Request) {
  const cronAuth = authorizeCron(request, 'cron/agents/refresh-reservoirs')
  if (!cronAuth.ok) return cronAuth.response

  return runCronJob('agents/refresh-reservoirs', async () => {
    const summary = await refreshSpriteReservoirs()

    return NextResponse.json({
      success: summary.errors === 0,
      ...summary,
      timestamp: new Date().toISOString(),
    })
  })
}
