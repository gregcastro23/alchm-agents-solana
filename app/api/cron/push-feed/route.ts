import { NextResponse } from 'next/server'
import { feedPusherService } from '@/lib/agents/feed-pusher'
import { authorizeCron } from '@/lib/security/cron-auth'
import { runCronJob } from '@/lib/cron/heartbeat'

/**
 * POST /api/cron/push-feed
 * GET /api/cron/push-feed (Vercel Cron)
 *
 * Cron endpoint to trigger the evaluation of agentic feed actions and
 * push them to the WTEN ingestion endpoint.
 */
export async function POST(request: Request) {
  return handlePushFeed(request)
}

export async function GET(request: Request) {
  return handlePushFeed(request)
}

async function handlePushFeed(request: Request) {
  const cronAuth = authorizeCron(request, 'cron/push-feed')
  if (!cronAuth.ok) return cronAuth.response

  return runCronJob('push-feed', async ({ deadlineMs }) => {
    const result = await feedPusherService.evaluateAndPush({ deadlineMs })

    // 207 on partial failure so a degraded push is visible in Vercel cron logs.
    return NextResponse.json(
      {
        success: result.success,
        pushedCount: result.pushedCount,
        skippedForBudget: result.skippedForBudget ?? 0,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      },
      { status: result.success ? 200 : 207 }
    )
  })
}
