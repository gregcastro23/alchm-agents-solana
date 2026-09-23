import { NextResponse } from 'next/server'
import { runLeagueTick } from '@/lib/agents/scrabble-league'
import { authorizeCron } from '@/lib/security/cron-auth'
import { runCronJob } from '@/lib/cron/heartbeat'

/**
 * POST/GET /api/cron/scrabble/tick (Vercel Cron, hourly)
 *
 * Advances the always-on Agent Scrabble League by one tick: plays a batch of
 * pending round-robin pairings (deterministic, LLM-free matches), updates ELO +
 * standings, and emits a capped set of persona-voiced feed posts for feed-worthy
 * outcomes. Gated by SCRABBLE_LEAGUE_ENABLED (off by default until reviewed).
 *
 * Mirrors app/api/cron/agents/tick: CRON_SECRET fail-closed in production, HTTP
 * 207 on partial failure so a degraded tick is visible in Vercel cron logs.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  return handleTick(request)
}

export async function GET(request: Request) {
  return handleTick(request)
}

async function handleTick(request: Request) {
  const cronAuth = authorizeCron(request, 'cron/scrabble/tick')
  if (!cronAuth.ok) return cronAuth.response

  return runCronJob('scrabble/tick', async () => {
    // Off by default until reviewed (see cost model). Flip SCRABBLE_LEAGUE_ENABLED=true to run.
    if (process.env.SCRABBLE_LEAGUE_ENABLED !== 'true') {
      return NextResponse.json(
        {
          success: true,
          skipped: true,
          reason: 'SCRABBLE_LEAGUE_ENABLED is not true',
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      )
    }

    const summary = await runLeagueTick()

    // 207 on partial failure so a degraded tick is visible in Vercel cron logs.
    return NextResponse.json(
      {
        success: summary.errors.length === 0,
        ...summary,
        timestamp: new Date().toISOString(),
      },
      { status: summary.errors.length === 0 ? 200 : 207 }
    )
  })
}
