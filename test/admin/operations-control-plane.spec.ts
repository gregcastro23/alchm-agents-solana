import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyDbError, sanitizeDbMessage } from '@/lib/db-error'
import { classifyDebitPathFromDeliveries } from '@/lib/admin/debit-path'
import {
  buildSustainedReminder,
  classifyTransition,
  evaluateAndDispatchSnapshot,
  getAlertDeliveryStatus,
  __resetOperatorAlertsForTests,
} from '@/lib/admin/operator-alerts'
import {
  buildOperationsControlPlane,
  toControlPlaneSnapshotSummary,
} from '@/lib/admin/operations-control-plane'
import { combine, fromLiveFlag } from '@/lib/admin/provenance'
import {
  __resetRatingLedgerGuardForTests,
  createGuardedLedgerLoader,
} from '@/lib/agents/rating/rating-resolver.server'
import type { DashboardReport } from '@/lib/admin/dashboard'
import type { JobsReport } from '@/lib/admin/jobs'
import type { WtenLinkReport } from '@/lib/admin/wten-link'

function okSection<T>(value: T): { ok: true; value: T } {
  return { ok: true, value }
}

function makeHealthyInputs(): {
  dashboard: DashboardReport
  jobs: JobsReport
  wtenLink: WtenLinkReport
} {
  const generatedAt = '2026-11-21T23:00:00.000Z'
  const dashboard: DashboardReport = {
    generatedAt,
    users: okSection({ total: 100, newToday: 5, admins: 2 }),
    agents: okSection({ historical: 390, created: 12, totalConversations: 5000 }),
    harmony: okSection({ spirit: 70, essence: 72, matter: 68, substance: 71 }),
    activity: okSection([]),
    topAgents: okSection([]),
    jing: okSection({
      recentJingDuels: [],
      jingAggregates: {
        total: 80,
        last24h: 10,
        last7d: 40,
        stanceHistogram: {},
        boostElementHistogram: {},
        topPairs: [],
        avgLatencyMs: 120,
      },
    }),
    mcp: okSection({
      total: 400,
      last24h: 25,
      successRate: 96,
      avgLatencyMs: 85,
      topTools: [],
      recent: [],
    }),
    groupChats: okSection({
      total: 200,
      last24h: 12,
      recent: [],
      originHistogram: {},
    }),
    system: {
      database: okSection({ latencyMs: 18 }),
      backend: okSection({
        url: 'https://api.agents.alchm.kitchen',
        status: 200,
        latencyMs: 42,
      }),
      providersConfigured: { openai: true },
      deployment: {
        url: 'agents.alchm.kitchen',
        env: 'production',
        commitSha: 'abc1234',
        commitRef: 'main',
        region: 'iad1',
      },
    },
    alerts: [],
  }

  const jobs: JobsReport = {
    generatedAt,
    heartbeats: { status: 'live' },
    jobs: [],
    minutes: [],
    alerts: [],
  } as unknown as JobsReport

  const wtenLink: WtenLinkReport = {
    generatedAt,
    windowHours: 24,
    deliveries: { status: 'live' },
    endpoints: [
      {
        endpoint: 'feed',
        attempts: 150,
        events: 150,
        split: {
          ok2xx: 150,
          alreadyApplied409: 0,
          insufficientFunds402: 0,
          otherClient4xx: 0,
          server5xx: 0,
          timeouts: 0,
          networkErrors: 0,
        },
        p95LatencyMs: 180,
        lastAt: generatedAt,
        lastError: null,
        timeoutMs: 8000,
        receiverDedupes: true,
      },
      {
        endpoint: 'economy/sync-debit',
        attempts: 40,
        events: 40,
        split: {
          ok2xx: 39,
          alreadyApplied409: 1,
          insufficientFunds402: 0,
          otherClient4xx: 0,
          server5xx: 0,
          timeouts: 0,
          networkErrors: 0,
        },
        p95LatencyMs: 140,
        lastAt: generatedAt,
        lastError: null,
        timeoutMs: 8000,
        receiverDedupes: true,
      },
    ],
    recent: [],
    secrets: [
      {
        secret: 'INTERNAL_API_SECRET',
        verdict: 'match',
        probe: '/api/health',
        status: 200,
        detail: 'Match',
        checkedAt: generatedAt,
      },
    ],
    hookSecretConfigured: true,
    alerts: [],
  }

  return { dashboard, jobs, wtenLink }
}

describe('DB error classification, provenance & Operations Control Plane', () => {
  beforeEach(() => {
    __resetOperatorAlertsForTests()
    __resetRatingLedgerGuardForTests()
  })

  afterEach(() => {
    __resetRatingLedgerGuardForTests()
  })

  it('classifies Neon PG 53000 quota exhaustion & scrubs credentials', () => {
    const err = Object.assign(
      new Error(
        'postgresql://user:supersecret@ep-mute-thunder.neon.tech/neondb exceeded the quota.'
      ),
      { code: '53000' }
    )
    const classified = classifyDbError(err)
    expect(classified.kind).toBe('quota_exceeded')
    expect(classified.isUnavailable).toBe(true)
    expect(classified.summary).toContain('53000')
    expect(classified.remediation).toContain('console.neon.tech')

    const sanitized = sanitizeDbMessage(err.message)
    expect(sanitized).not.toContain('supersecret')
    expect(sanitized).toContain('[redacted-dsn]')

    expect(classifyDbError({ code: 'P2024', message: 'Timed out' }).kind).toBe('pooler_saturated')
    expect(classifyDbError({ name: 'PrismaClientInitializationError', message: 'down' }).kind).toBe(
      'unreachable'
    )
    expect(classifyDbError({ code: 'P2021', message: 'missing' }).kind).toBe('missing_table')
  })

  it('detects WTEN silent debit-path incidents when feed traffic flows without landed debits', () => {
    const res = classifyDebitPathFromDeliveries({ status: 'live' }, [
      {
        endpoint: 'feed',
        attempts: 151,
        split: { ok2xx: 151, alreadyApplied409: 0 },
        lastError: null,
      },
      {
        endpoint: 'economy/sync-debit',
        attempts: 0,
        split: { ok2xx: 0, alreadyApplied409: 0 },
        lastError: null,
      },
    ])
    expect(res.verdict).toBe('INCIDENT')
    expect(res.feedAttempts).toBe(151)
    expect(res.debitsLanded).toBe(0)

    const idle = classifyDebitPathFromDeliveries({ status: 'live' }, [])
    expect(idle.verdict).toBe('IDLE')

    const unknown = classifyDebitPathFromDeliveries(
      { status: 'unavailable', reason: 'Database quota exceeded (PG 53000)' },
      null
    )
    expect(unknown.verdict).toBe('UNKNOWN')
  })

  it('reports alert delivery READY whenever Slack OR Email is configured', () => {
    const slackOnly = getAlertDeliveryStatus({
      ALERT_SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T000/B000/XXX',
    } as unknown as NodeJS.ProcessEnv)
    expect(slackOnly.ready).toBe(true)
    expect(slackOnly.channels).toEqual(['slack'])

    const emailOnly = getAlertDeliveryStatus({
      RESEND_API_KEY: 're_test_123',
      AUTH_ADMIN_EMAIL: 'ops@alchm.kitchen',
    } as unknown as NodeJS.ProcessEnv)
    expect(emailOnly.ready).toBe(true)
    expect(emailOnly.channels).toEqual(['email'])
    expect(emailOnly.recipientsCount).toBe(1)

    const neither = getAlertDeliveryStatus({} as unknown as NodeJS.ProcessEnv)
    expect(neither.ready).toBe(false)
    expect(neither.channels).toEqual([])
  })

  it('classifies posture transitions & fires sustained reminders only after reminderHours', () => {
    expect(classifyTransition('NOMINAL', 'CRITICAL')).toMatchObject({
      changed: true,
      kind: 'degraded',
      severity: 'critical',
    })
    expect(classifyTransition('CRITICAL', 'NOMINAL')).toMatchObject({
      changed: true,
      kind: 'recovered',
      severity: 'info',
    })
    expect(classifyTransition('CRITICAL', 'CRITICAL').changed).toBe(false)

    const snap = {
      state: 'CRITICAL' as const,
      readinessScore: 15,
      domains: [],
      alerts: [
        {
          id: 'db',
          severity: 'critical' as const,
          source: 'infrastructure' as const,
          title: 'Primary database down',
          detail: 'PG 53000',
          href: '/admin/infrastructure',
        },
      ],
    }

    const t0 = 1_700_000_000_000
    expect(
      buildSustainedReminder({
        current: snap,
        previousSentAtMs: t0,
        nowMs: t0 + 12 * 3_600_000,
        reminderHours: 24,
      })
    ).toBeNull()

    const fired = buildSustainedReminder({
      current: snap,
      previousSentAtMs: t0,
      nowMs: t0 + 24 * 3_600_000 + 1000,
      reminderHours: 24,
    })
    expect(fired?.kind).toBe('sustained-incident')
    expect(fired?.subject).toContain('CRITICAL (24h)')
  })

  it('synthesizes NOMINAL vs CRITICAL Operations Control Plane with clamped readiness on DB outage', () => {
    const { dashboard, jobs, wtenLink } = makeHealthyInputs()
    const readyDelivery = getAlertDeliveryStatus({
      ALERT_SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B/X',
    } as unknown as NodeJS.ProcessEnv)

    const healthy = buildOperationsControlPlane({
      dashboard,
      jobs,
      wtenLink,
      alertDelivery: readyDelivery,
    })
    expect(healthy.state).toBe('NOMINAL')
    expect(healthy.readinessScore).toBe(100)
    expect(healthy.coverage.live).toBe(8)
    expect(healthy.coverage.pct).toBe(100)

    // Simulate PG 53000 outage taking down DB + read sections
    const outageDashboard: DashboardReport = {
      ...dashboard,
      users: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      agents: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      mcp: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      jing: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      groupChats: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      system: {
        ...dashboard.system,
        database: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      },
      alerts: [
        {
          id: 'dashboard:database-down',
          severity: 'critical',
          source: 'infrastructure',
          title: 'Primary database is unreachable',
          detail: 'Database quota exceeded (PG 53000)',
          href: '/admin/infrastructure',
        },
      ],
    }

    const outage = buildOperationsControlPlane({
      dashboard: outageDashboard,
      jobs,
      wtenLink,
      alertDelivery: getAlertDeliveryStatus({} as unknown as NodeJS.ProcessEnv),
    })
    expect(outage.state).toBe('CRITICAL')
    expect(outage.readinessScore).not.toBeNull()
    expect(outage.readinessScore!).toBeLessThanOrEqual(35)
    expect(outage.priorities[0]?.tier).toBe('P0')
    expect(outage.domains.find(d => d.key === 'database')?.provenance.state).toBe('no-source')
  })

  it('builds accurate composite Provenance states', () => {
    const pLive = fromLiveFlag({ live: true, source: 'a' })
    const pNoSrc = fromLiveFlag({ live: false, source: 'b', reason: 'down' })
    const pUninst = fromLiveFlag({
      live: false,
      source: 'c',
      reason: 'Table not provisioned yet',
    })
    expect(pLive.state).toBe('live')
    expect(pNoSrc.state).toBe('no-source')
    expect(pUninst.state).toBe('not-instrumented')
    expect(combine([pLive, pLive]).state).toBe('live')
    expect(combine([pLive, pNoSrc]).state).toBe('partial')
  })

  it('caches public ledger reads for 15s and opens 30s DB circuit breaker on 53000 error', async () => {
    let clock = 1_000_000
    const inner = vi.fn().mockResolvedValue({ spirit: 10, essence: 20, matter: 30, substance: 40 })
    const guarded = createGuardedLedgerLoader(inner, {
      now: () => clock,
      forceEnableInTest: true,
    })

    // First 'deny' read hits inner and caches
    await expect(guarded('aristotle', { creatorWallet: 'deny' })).resolves.toMatchObject({
      spirit: 10,
    })
    // Second read within 15s returns cached without hitting inner
    clock += 5_000
    await expect(guarded('aristotle', { creatorWallet: 'deny' })).resolves.toMatchObject({
      spirit: 10,
    })
    expect(inner).toHaveBeenCalledTimes(1)

    // Privileged user policy never reads/writes shared public cache
    await guarded('aristotle', { creatorWallet: { userId: 'u1' } })
    expect(inner).toHaveBeenCalledTimes(2)

    // Simulate quota failure on new agent -> opens 30s circuit
    const failingInner = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('quota exceeded'), { code: '53000' }))
    const guardedOutage = createGuardedLedgerLoader(failingInner, {
      now: () => clock,
      forceEnableInTest: true,
    })
    await expect(guardedOutage('plato', { creatorWallet: 'deny' })).rejects.toThrow(/quota/)
    // Immediate follow-up fails fast from circuit breaker without calling failingInner again
    clock += 1_000
    await expect(guardedOutage('socrates', { creatorWallet: 'deny' })).rejects.toThrow(
      /circuit open/i
    )
    expect(failingInner).toHaveBeenCalledTimes(1)

    // After 30s, circuit closes and probes again
    clock += 31_000
    await expect(guardedOutage('socrates', { creatorWallet: 'deny' })).rejects.toThrow(/quota/)
    expect(failingInner).toHaveBeenCalledTimes(2)
  })

  it('carries wten:debit-path-silent P0 alert into snapshot summary and preserves previousState in evaluateAndDispatchSnapshot', async () => {
    const { dashboard, jobs, wtenLink } = makeHealthyInputs()
    const readyDelivery = getAlertDeliveryStatus({
      ALERT_SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B/X',
    } as unknown as NodeJS.ProcessEnv)

    const healthyControlPlane = buildOperationsControlPlane({
      dashboard,
      jobs,
      wtenLink,
      alertDelivery: readyDelivery,
    })
    const first = await evaluateAndDispatchSnapshot(
      toControlPlaneSnapshotSummary(healthyControlPlane),
      { dryRun: true, nowMs: 1_700_000_000_000 }
    )
    expect(first.previousState).toBeNull()
    expect(first.currentState).toBe('NOMINAL')

    const silentDebitWten: WtenLinkReport = {
      ...wtenLink,
      endpoints: [
        {
          endpoint: 'feed',
          attempts: 151,
          events: 151,
          split: {
            ok2xx: 151,
            alreadyApplied409: 0,
            insufficientFunds402: 0,
            otherClient4xx: 0,
            server5xx: 0,
            timeouts: 0,
            networkErrors: 0,
          },
          p95LatencyMs: 120,
          lastAt: wtenLink.generatedAt,
          lastError: null,
          timeoutMs: 8000,
          receiverDedupes: true,
        },
        {
          endpoint: 'economy/sync-debit',
          attempts: 0,
          events: 0,
          split: {
            ok2xx: 0,
            alreadyApplied409: 0,
            insufficientFunds402: 0,
            otherClient4xx: 0,
            server5xx: 0,
            timeouts: 0,
            networkErrors: 0,
          },
          p95LatencyMs: null,
          lastAt: null,
          lastError: null,
          timeoutMs: 8000,
          receiverDedupes: true,
        },
      ],
      alerts: [
        {
          id: 'wten:debit-path-silent',
          severity: 'critical',
          source: 'economy',
          title: 'Agent feed traffic is active but zero sync-debit calls landed',
          detail: '151 feed delivery attempt(s) in window but ZERO sync-debit calls landed',
          remediation: 'Check /admin/jobs (`agents/tick`) and primary database health.',
          href: '/admin/wten',
        },
      ],
    }

    const degradedControlPlane = buildOperationsControlPlane({
      dashboard,
      jobs,
      wtenLink: silentDebitWten,
      alertDelivery: readyDelivery,
    })
    const summary = toControlPlaneSnapshotSummary(degradedControlPlane)
    expect(summary.state).toBe('CRITICAL')
    expect(
      summary.alerts.some(a => a.id === 'wten:debit-path-silent' && a.severity === 'critical')
    ).toBe(true)

    const second = await evaluateAndDispatchSnapshot(summary, {
      dryRun: true,
      nowMs: 1_700_000_060_000,
    })
    expect(second.previousState).toBe('NOMINAL')
    expect(second.currentState).toBe('CRITICAL')
    expect(second.events[0]?.kind).toBe('degraded')

    const third = await evaluateAndDispatchSnapshot(summary, {
      dryRun: true,
      nowMs: 1_700_000_120_000,
    })
    expect(third.previousState).toBe('CRITICAL')
    expect(third.currentState).toBe('CRITICAL')
  })
})
