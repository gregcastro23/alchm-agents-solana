import { NextResponse } from 'next/server'
import { agentActionService } from '@/lib/services/agent-action-service'
import { runTransitAttunements } from '@/lib/agents/transit-attunement'
import { authorizeCron } from '@/lib/security/cron-auth'
import { runCronJob } from '@/lib/cron/heartbeat'
import { pastBudget } from '@/lib/cron/registry'

/**
 * POST /api/cron/agents/tick
 * GET /api/cron/agents/tick (Vercel Cron)
 *
 * Hourly (or per-planetary-hour) cron endpoint that:
 *  1. Evaluates every agentic user's natal chart against the current
 *     celestial weather (planetary hour, transits, elemental alignment).
 *  2. For agents whose activation score exceeds the threshold, executes
 *     an action: posting to the feed or transmuting tokens.
 *
 * Protected by CRON_SECRET in production.
 * Vercel Cron schedule: `28 * * * *` (hourly at :28, staggered off WTEN's minutes)
 */
export async function POST(request: Request) {
  return handleTick(request)
}

export async function GET(request: Request) {
  return handleTick(request)
}

async function handleTick(request: Request) {
  const cronAuth = authorizeCron(request, 'cron/agents/tick')
  if (!cronAuth.ok) return cronAuth.response

  return runCronJob('agents/tick', async ({ deadlineMs }) => {
    const summary = await agentActionService.runTick({ deadlineMs })

    // Transit auto-attunement: degree sprites bestow ESMS + planetary-12 buffs to
    // historical agents whose natal points the live sky is conjuncting. Best-effort
    // — never fails the tick, and skipped when the tick used up its time budget.
    let attunements: unknown = null
    if (pastBudget(deadlineMs)) {
      attunements = { skipped: 'time budget' }
    } else {
      try {
        attunements = await runTransitAttunements()
      } catch (err) {
        console.error('[cron/agents/tick] transit attunement failed:', err)
      }
    }

    // 207 on partial failure so a degraded tick is visible in Vercel cron logs.
    return NextResponse.json(
      {
        success: summary.errors.length === 0,
        ...summary,
        attunements,
        timestamp: new Date().toISOString(),
      },
      { status: summary.errors.length === 0 ? 200 : 207 }
    )
  })
}
