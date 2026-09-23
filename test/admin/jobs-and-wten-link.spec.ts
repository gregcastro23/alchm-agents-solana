// @vitest-environment node
/**
 * The Jobs and WTEN-link reports: numbers from live sources, "unknown" (null)
 * when a source cannot be read — never 0 — and alerts that don't cry wolf.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: { wten_deliveries: { create: vi.fn(), deleteMany: vi.fn() } },
}))

import { prisma } from '@/lib/db'
import { JobsReportSchema, WtenLinkReportSchema } from '@/lib/admin/page-schemas'
import { buildJobsReport } from '@/lib/admin/jobs'
import { __resetProbeCache, interpretProbe, probeSecrets } from '@/lib/admin/wten-link'
import { __resetDeliveryLog, recordDeliveryAttempt } from '@/lib/wten/delivery-log'
import { listCronJobs } from '@/lib/cron/registry'
import {
  NOW,
  jobsFixture,
  jobsUnavailableFixture,
  wtenLinkFixture,
  wtenLinkUnavailableFixture,
} from './fixtures/admin-pages'

describe('jobs report', () => {
  const report = jobsFixture()
  const job = (name: string) => report.jobs.find(j => j.name === name)!

  it('validates against the client schema', () => {
    expect(JobsReportSchema.safeParse(report).success).toBe(true)
    expect(JobsReportSchema.safeParse(jobsUnavailableFixture()).success).toBe(true)
  })

  it('one hourly failure after successes is retrying, not failing, and raises no alert', () => {
    expect(job('agents/tick').state).toBe('retrying')
    expect(report.alerts.some(a => a.id.startsWith('jobs:agents/tick:failing'))).toBe(false)
  })

  it('counts missed runs against the schedule, only since heartbeats began', () => {
    expect(job('agents/claim-yield').missed24h).toBe(2) // two runs dropped from the fixture
    expect(job('push-feed').missed24h).toBe(0)
    expect(job('push-feed').expected24h).toBe(48)
    // No heartbeat ever: unknown, not "24 missed".
    expect(job('scrabble/tick').state).toBe('never')
    expect(job('scrabble/tick').missed24h).toBeNull()
    expect(job('scrabble/tick').successRate7d).toBeNull()
  })

  it('reports p95 against the 300s limit and flags a job near it', () => {
    const tick = job('agents/tick')
    expect(tick.limitMs).toBe(300_000)
    expect(tick.p95DurationMs).toBeGreaterThan(240_000)
    expect(report.alerts.some(a => a.id === 'jobs:agents/tick:near-limit')).toBe(true)
  })

  it('keeps the last 24 runs newest first, with partial runs marked', () => {
    const recent = job('agents/tick').recent
    expect(recent).toHaveLength(24)
    expect(Date.parse(recent[0]!.startedAt)).toBeGreaterThan(Date.parse(recent[1]!.startedAt))
    expect(recent[1]!.partial).toBe(true)
  })

  it('maps minutes: ASOL jobs off WTEN minutes', () => {
    const m = (n: number) => report.minutes[n]!
    expect(m(28).asolJobs).toEqual(['agents/tick'])
    expect(m(0).wten).toBe(true)
    expect(report.minutes.filter(s => s.asolJobs.length > 0 && s.wten)).toEqual([])
  })

  it('an unreadable heartbeat table makes every derived number null, not zero', () => {
    const r = jobsUnavailableFixture()
    for (const j of r.jobs) {
      expect(j.state).toBeNull()
      expect(j.missed24h).toBeNull()
      expect(j.runs24h).toBeNull()
      expect(j.successRate7d).toBeNull()
      expect(j.p95DurationMs).toBeNull()
    }
    expect(r.alerts.map(a => a.id)).toContain('jobs:heartbeats:not_provisioned')
  })

  it('a daily job with one failure is failing and alerts critical', () => {
    const r = buildJobsReport({
      jobs: listCronJobs(),
      runs: [
        {
          job: 'agents/refresh-reservoirs',
          startedAt: new Date(NOW - 14 * 3600_000),
          status: 'failure',
          durationMs: 900,
          error: 'boom',
          details: {},
        },
      ],
      firstRunAt: new Map([['agents/refresh-reservoirs', new Date(NOW - 14 * 3600_000)]]),
      heartbeats: { status: 'live' },
      nowMs: NOW,
    })
    expect(r.jobs.find(j => j.name === 'agents/refresh-reservoirs')!.state).toBe('failing')
    expect(r.alerts.find(a => a.id === 'jobs:agents/refresh-reservoirs:failing')?.severity).toBe(
      'critical'
    )
  })
})

describe('WTEN link report', () => {
  beforeEach(() => __resetProbeCache())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('validates against the client schema, live and unavailable', () => {
    expect(WtenLinkReportSchema.safeParse(wtenLinkFixture()).success).toBe(true)
    expect(WtenLinkReportSchema.safeParse(wtenLinkUnavailableFixture()).success).toBe(true)
  })

  it('an unavailable delivery log is null data and a critical alert, not an empty list', () => {
    const r = wtenLinkUnavailableFixture()
    expect(r.endpoints).toBeNull()
    expect(r.recent).toBeNull()
    expect(r.alerts.find(a => a.id === 'wten:deliveries:unavailable')?.severity).toBe('critical')
  })

  it('attaches the endpoint policy to each row', () => {
    const debit = wtenLinkFixture().endpoints!.find(e => e.endpoint === 'economy/sync-debit')!
    expect(debit).toMatchObject({ timeoutMs: 10_000, receiverDedupes: true })
    expect(debit.lastError).toMatchObject({ status: null, message: 'timeout (10000ms)' })
  })

  it.each([
    [401, [400], 'mismatch'],
    [403, [400], 'mismatch'],
    [400, [400], 'match'],
    [404, [200, 404], 'match'],
    [500, [400], 'unknown'],
    [null, [400], 'unknown'],
  ] as const)('probe status %s → %s', (status, accepted, verdict) => {
    expect(interpretProbe(status, [...accepted]).verdict).toBe(verdict)
  })

  it('probes each secret the way its WTEN route checks it, and caches for 5 minutes', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'int-s3cret')
    vi.stubEnv('ALCHM_KITCHEN_SYNC_SECRET', 'sync-s3cret')
    vi.stubEnv('ALCHM_KITCHEN_SYNC_URL', 'https://alchm.test')
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetchImpl = vi.fn(async (url: any, init: any) => {
      calls.push({ url: String(url), init })
      return new Response('{}', { status: String(url).includes('agent-recipes') ? 400 : 401 })
    }) as unknown as typeof fetch

    const probes = await probeSecrets({ fetchImpl, nowMs: NOW })
    expect(probes.map(p => [p.secret, p.verdict])).toEqual([
      ['INTERNAL_API_SECRET', 'match'],
      ['ALCHM_KITCHEN_SYNC_SECRET', 'mismatch'],
    ])
    expect(calls[0]!.url).toBe('https://alchm.test/api/internal/agent-recipes')
    expect(new Headers(calls[0]!.init.headers).get('authorization')).toBe('Bearer int-s3cret')
    expect(calls[0]!.init.body).toBe('{}')
    expect(calls[1]!.url).toContain(
      '/api/economy/balance?email=secret-probe%40agentic.alchm.kitchen'
    )
    expect(new Headers(calls[1]!.init.headers).get('x-sync-secret')).toBe('sync-s3cret')
    // Nothing secret leaks into what the page shows.
    expect(JSON.stringify(probes)).not.toMatch(/s3cret/)

    await probeSecrets({ fetchImpl, nowMs: NOW + 60_000 })
    expect(calls).toHaveLength(2)
  })

  it('an unset secret is reported as such, without a request', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', '')
    vi.stubEnv('ALCHM_KITCHEN_SYNC_SECRET', '')
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const probes = await probeSecrets({ fetchImpl, nowMs: NOW })
    expect(probes.every(p => p.verdict === 'not_configured')).toBe(true)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('delivery log writer', () => {
  beforeEach(() => __resetDeliveryLog())
  afterEach(() => vi.restoreAllMocks())
  const attempt = {
    endpoint: 'feed' as const,
    eventId: 'e',
    attempt: 1,
    status: 201,
    latencyMs: 12.4,
    result: 'delivered' as const,
  }

  it('writes one row per attempt', async () => {
    vi.mocked(prisma.wten_deliveries.create).mockResolvedValue({} as any)
    await recordDeliveryAttempt(attempt, () => 1)
    expect(prisma.wten_deliveries.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        endpoint: 'feed',
        eventId: 'e',
        attempt: 1,
        status: 201,
        result: 'delivered',
        latencyMs: 12,
      }),
    })
  })

  it('never throws, and goes quiet after a missing-table error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(prisma.wten_deliveries.create).mockRejectedValue(
      Object.assign(new Error('missing'), { code: 'P2021' })
    )
    await expect(recordDeliveryAttempt(attempt)).resolves.toBeUndefined()
    await recordDeliveryAttempt(attempt)
    expect(prisma.wten_deliveries.create).toHaveBeenCalledTimes(1)
  })
})
