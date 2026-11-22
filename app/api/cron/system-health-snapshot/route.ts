import { NextResponse } from 'next/server'
import { buildOverviewPulse } from '@/lib/admin/overview-pulse'
import { toControlPlaneSnapshotSummary } from '@/lib/admin/operations-control-plane'
import { evaluateAndDispatchSnapshot } from '@/lib/admin/operator-alerts'
import { runCronJob } from '@/lib/cron/heartbeat'
import { authorizeCron } from '@/lib/security/cron-auth'

export const dynamic = 'force-dynamic'

/**
 * GET/POST /api/cron/system-health-snapshot
 *
 * Hourly cron (`58 * * * *`) that captures the Planetary Agents Operations Control
 * Plane snapshot, evaluates state transitions / sustained CRITICAL incidents,
 * and dispatches operator alerts when Resend or Slack is configured.
 *
 * Intentionally does NOT export `maxDuration` so Vercel memory/cron contract tests
 * keep it lightweight.
 */
export async function GET(request: Request) {
  return handleSnapshot(request)
}

export async function POST(request: Request) {
  return handleSnapshot(request)
}

async function handleSnapshot(request: Request) {
  const cronAuth = authorizeCron(request, 'cron/system-health-snapshot')
  if (!cronAuth.ok) return cronAuth.response

  return runCronJob('system-health-snapshot', async () => {
    const pulse = await buildOverviewPulse({ fresh: true })
    const summary = toControlPlaneSnapshotSummary(pulse.controlPlane)
    const dispatchResult = await evaluateAndDispatchSnapshot(summary)

    return NextResponse.json(
      {
        ok: true,
        state: pulse.controlPlane.state,
        readinessScore: pulse.controlPlane.readinessScore,
        debitVerdict: pulse.debitPath.verdict,
        dispatchedCount: dispatchResult.events.length,
        deliveryReady: dispatchResult.delivery.ready,
        channels: dispatchResult.delivery.channels,
        events: dispatchResult.events,
        timestamp: dispatchResult.evaluatedAt,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  })
}
