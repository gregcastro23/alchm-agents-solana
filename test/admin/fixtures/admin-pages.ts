/**
 * Realistic fixtures for the Jobs and WTEN-link admin pages, built through the
 * real server-side builders so they cannot drift from the payload shape.
 */
import { buildJobsReport, type RunRow } from '@/lib/admin/jobs'
import { buildEndpointHealth, linkAlerts, type WtenLinkReport } from '@/lib/admin/wten-link'
import { listCronJobs } from '@/lib/cron/registry'

export const NOW = Date.UTC(2026, 8, 23, 14, 5)
const MIN = 60_000
const HOUR = 60 * MIN

function hourlyRuns(
  job: string,
  minute: number,
  count: number,
  opts: { failAt?: number[]; partialEvery?: number; slowMs?: number } = {}
): RunRow[] {
  const rows: RunRow[] = []
  const lastFire = Math.floor((NOW - minute * MIN) / HOUR) * HOUR + minute * MIN
  for (let i = 0; i < count; i++) {
    const startedAt = new Date(lastFire - i * HOUR)
    const failed = opts.failAt?.includes(i)
    rows.push({
      job,
      startedAt,
      status: failed ? 'failure' : 'success',
      durationMs: (opts.slowMs ?? 40_000) + ((i * 7919) % 20_000),
      error: failed ? 'sync-debit timeout (10000ms) after 3 attempts' : null,
      details: {
        httpStatus: failed ? 500 : opts.partialEvery && i % opts.partialEvery === 0 ? 207 : 200,
        partial: Boolean(opts.partialEvery && i % opts.partialEvery === 0),
      },
    })
  }
  return rows
}

export function jobsFixture() {
  const runs: RunRow[] = [
    ...hourlyRuns('agents/tick', 28, 160, { failAt: [0], partialEvery: 1, slowMs: 232_000 }),
    ...hourlyRuns('agents/claim-yield', 40, 160).filter((_, i) => i !== 5 && i !== 9),
    ...[...hourlyRuns('push-feed', 14, 160), ...hourlyRuns('push-feed', 44, 160)],
    ...hourlyRuns('agents/refresh-reservoirs', 20, 1).map(r => ({
      ...r,
      startedAt: new Date(Date.UTC(2026, 8, 23, 0, 20)),
    })),
  ]
  const firstRunAt = new Map<string, Date>()
  for (const r of runs) {
    const cur = firstRunAt.get(r.job)
    if (!cur || r.startedAt < cur) firstRunAt.set(r.job, r.startedAt)
  }
  return buildJobsReport({
    jobs: listCronJobs(),
    runs,
    firstRunAt,
    heartbeats: { status: 'live' },
    nowMs: NOW,
  })
}

export function jobsUnavailableFixture() {
  return buildJobsReport({
    jobs: listCronJobs(),
    runs: null,
    firstRunAt: null,
    heartbeats: {
      status: 'not_provisioned',
      reason: 'Table cron_runs does not exist yet (db push pending).',
    },
    nowMs: NOW,
  })
}

export function wtenLinkFixture(): WtenLinkReport {
  const endpoints = buildEndpointHealth(
    [
      {
        endpoint: 'economy/sync-debit',
        attempts: 1712,
        events: 1698,
        ok2xx: 598,
        conflict409: 11,
        payment402: 1072,
        client4xx: 0,
        server5xx: 17,
        timeouts: 14,
        network: 0,
        p95_ms: 2140,
        last_at: new Date(NOW - 7 * MIN),
      },
      {
        endpoint: 'economy/sync-credit',
        attempts: 96,
        events: 96,
        ok2xx: 71,
        conflict409: 25,
        payment402: 0,
        client4xx: 0,
        server5xx: 0,
        timeouts: 0,
        network: 0,
        p95_ms: 880,
        last_at: new Date(NOW - 25 * MIN),
      },
      {
        endpoint: 'feed',
        attempts: 402,
        events: 402,
        ok2xx: 398,
        conflict409: 0,
        payment402: 0,
        client4xx: 2,
        server5xx: 0,
        timeouts: 1,
        network: 1,
        p95_ms: 1210,
        last_at: new Date(NOW - 21 * MIN),
      },
      {
        endpoint: 'economy/sync-event',
        attempts: 0,
        events: 0,
        ok2xx: 0,
        conflict409: 0,
        payment402: 0,
        client4xx: 0,
        server5xx: 0,
        timeouts: 0,
        network: 0,
        p95_ms: null,
        last_at: null,
      },
    ],
    [
      {
        endpoint: 'economy/sync-debit',
        status: null,
        error: 'timeout (10000ms)',
        created_at: new Date(NOW - 97 * MIN),
      },
      {
        endpoint: 'feed',
        status: 400,
        error: 'HTTP 400: Missing required fields',
        created_at: new Date(NOW - 5 * HOUR),
      },
    ]
  )
  const partial = {
    generatedAt: new Date(NOW).toISOString(),
    windowHours: 24,
    deliveries: { status: 'live' as const },
    endpoints,
    recent: [
      {
        at: new Date(NOW - 7 * MIN).toISOString(),
        endpoint: 'economy/sync-debit',
        eventId: 'agent_action:cmpti7d5m000fy3dfjex7etga:2026-09-23T13',
        attempt: 1,
        status: 402,
        result: 'rejected',
        latencyMs: 412,
        error: 'HTTP 402: insufficient_funds',
      },
      {
        at: new Date(NOW - 7 * MIN).toISOString(),
        endpoint: 'economy/sync-debit',
        eventId: 'agent_action:cmpti7d5m000fy3dfjex7etgb:2026-09-23T13',
        attempt: 3,
        status: 200,
        result: 'delivered',
        latencyMs: 690,
        error: null,
      },
      {
        at: new Date(NOW - 8 * MIN).toISOString(),
        endpoint: 'economy/sync-debit',
        eventId: 'agent_action:cmpti7d5m000fy3dfjex7etgb:2026-09-23T13',
        attempt: 2,
        status: 503,
        result: 'retry',
        latencyMs: 301,
        error: 'HTTP 503:',
      },
      {
        at: new Date(NOW - 21 * MIN).toISOString(),
        endpoint: 'feed',
        eventId: 'feed:insight:socrates:1022414',
        attempt: 1,
        status: 201,
        result: 'delivered',
        latencyMs: 1188,
        error: null,
      },
    ],
    secrets: [
      {
        secret: 'INTERNAL_API_SECRET' as const,
        verdict: 'match' as const,
        probe: 'POST https://alchm.kitchen/api/internal/agent-recipes with an empty body',
        status: 400,
        detail: 'WTEN answered 400, which it only returns past its secret check.',
        checkedAt: new Date(NOW - 2 * MIN).toISOString(),
      },
      {
        secret: 'ALCHM_KITCHEN_SYNC_SECRET' as const,
        verdict: 'mismatch' as const,
        probe:
          'GET https://alchm.kitchen/api/economy/balance?email=secret-probe@agentic.alchm.kitchen',
        status: 401,
        detail:
          "WTEN answered 401: it does not accept ASOL's value (they differ, or WTEN has none set).",
        checkedAt: new Date(NOW - 2 * MIN).toISOString(),
      },
    ],
  }
  return { ...partial, alerts: linkAlerts(partial) }
}

export function wtenLinkUnavailableFixture(): WtenLinkReport {
  const partial = {
    generatedAt: new Date(NOW).toISOString(),
    windowHours: 24,
    deliveries: {
      status: 'unavailable' as const,
      reason: "Can't reach database server at `db.prisma.io:5432`",
    },
    endpoints: null,
    recent: null,
    secrets: [
      {
        secret: 'INTERNAL_API_SECRET' as const,
        verdict: 'unknown' as const,
        probe: 'POST https://alchm.kitchen/api/internal/agent-recipes with an empty body',
        status: null,
        detail: 'No answer: fetch failed',
        checkedAt: new Date(NOW).toISOString(),
      },
      {
        secret: 'ALCHM_KITCHEN_SYNC_SECRET' as const,
        verdict: 'not_configured' as const,
        probe:
          'GET https://alchm.kitchen/api/economy/balance?email=secret-probe@agentic.alchm.kitchen',
        status: null,
        detail: 'Not set in this deployment.',
        checkedAt: new Date(NOW).toISOString(),
      },
    ],
  }
  return { ...partial, alerts: linkAlerts(partial) }
}
