import { NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/security/cron-auth'
import { runCronJob } from '@/lib/cron/heartbeat'
import { dailyCouncilService } from '@/lib/agents/council/daily-council-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

async function handleCron(request: Request) {
  const access = authorizeCron(request, 'cron/agents/council-daily')
  if (!access.ok) return access.response
  return runCronJob('agents/council-daily', async ({ startedAt, deadlineMs }) => {
    try {
      const result = await dailyCouncilService.publish({
        date: startedAt,
        deadlineMs: deadlineMs - 5000,
      })
      return NextResponse.json(
        { success: true, ...result },
        { status: result.status === 'briefing_only' ? 207 : 200 }
      )
    } catch {
      // Keep provider responses and database connection details out of public errors/logs.
      return NextResponse.json(
        { success: false, error: 'Daily council generation or persistence failed' },
        { status: 500 }
      )
    }
  })
}

export const GET = handleCron
export const POST = handleCron
