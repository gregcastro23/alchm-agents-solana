import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextRequest, NextResponse } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OverviewPulsePayload } from '@/lib/admin/overview-pulse-schema'

const requireAdminMock = vi.fn()
const authorizeCronMock = vi.fn()
const runCronJobMock = vi.fn()
const buildOverviewPulseMock = vi.fn()
const evaluateAndDispatchSnapshotMock = vi.fn()
const pushRouterMock = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: requireAdminMock,
  adminErrorResponse: (res: { status: number; error: string }) =>
    NextResponse.json({ error: res.error }, { status: res.status }),
}))

vi.mock('@/lib/security/cron-auth', () => ({
  authorizeCron: authorizeCronMock,
}))

vi.mock('@/lib/cron/heartbeat', () => ({
  runCronJob: runCronJobMock,
}))

vi.mock('@/lib/admin/overview-pulse', () => ({
  buildOverviewPulse: buildOverviewPulseMock,
}))

vi.mock('@/lib/admin/operator-alerts', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/admin/operator-alerts')>()
  return {
    ...actual,
    evaluateAndDispatchSnapshot: evaluateAndDispatchSnapshotMock,
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushRouterMock }),
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/admin/pages/ProgressionOverview', () => ({
  ProgressionOverview: () => <div data-testid="progression-overview" />,
}))

vi.mock('@/components/admin/panels/CosmicTelemetryPanel', () => ({
  default: () => <div data-testid="cosmic-telemetry-panel" />,
}))

function makePulseFixture(): OverviewPulsePayload {
  const generatedAt = '2026-11-21T23:30:00.000Z'
  return {
    generatedAt,
    controlPlane: {
      generatedAt,
      state: 'CRITICAL',
      readinessScore: 25,
      summary: '1 P0 critical issue(s) active — Primary database is unreachable.',
      coverage: {
        live: 2,
        total: 8,
        pct: 25,
        provenance: {
          state: 'partial',
          source: 'operations-control-plane',
          measuredAt: generatedAt,
        },
      },
      domains: [
        {
          key: 'database',
          label: 'Primary Postgres',
          state: 'CRITICAL',
          headline: 'Down',
          detail: 'Database quota exceeded (PG 53000)',
          href: '/admin/infrastructure',
          provenance: {
            state: 'no-source',
            source: 'postgres ($queryRaw)',
            measuredAt: generatedAt,
            note: 'Database quota exceeded (PG 53000)',
          },
        },
        {
          key: 'backend',
          label: 'Python Agent API',
          state: 'NOMINAL',
          headline: '41ms',
          detail: 'HTTP 200',
          href: '/admin/infrastructure',
          provenance: { state: 'live', source: 'backend /health', measuredAt: generatedAt },
        },
      ],
      priorities: [
        {
          id: 'dashboard:database-down',
          tier: 'P0',
          source: 'infrastructure',
          title: 'Primary database is unreachable',
          detail: 'Database quota exceeded (PG 53000)',
          remediation: 'Upgrade Neon quota on console.neon.tech or switch DATABASE_URL.',
          href: '/admin/infrastructure',
        },
      ],
      maintenance: [
        {
          id: 'alert-delivery',
          label: 'Operator alert delivery',
          status: 'ready',
          summary: 'READY (slack)',
          detail: 'Alerts deliver via slack.',
          href: '/admin/infrastructure',
        },
      ],
    },
    debitPath: {
      verdict: 'INCIDENT',
      summary: '151 feed delivery attempt(s) in window but ZERO sync-debit calls landed',
      feedAttempts: 151,
      debitAttempts: 0,
      debitsLanded: 0,
      lastDebitError: null,
    },
    alertDelivery: {
      emailConfigured: false,
      slackConfigured: true,
      ready: true,
      channels: ['slack'],
      recipientsCount: 0,
      missingEnv: ['RESEND_API_KEY', 'AUTH_ADMIN_EMAIL'],
      fromAddress: 'Alchm Agents Ops <ops@alchm.kitchen>',
      dashboardUrl: 'https://agents.alchm.kitchen/admin',
    },
    recentAlerts: [],
    dashboard: {
      generatedAt,
      users: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      agents: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      harmony: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      activity: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      topAgents: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      jing: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      mcp: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      groupChats: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
      system: {
        database: { ok: false, reason: 'Database quota exceeded (PG 53000)' },
        backend: {
          ok: true,
          value: { url: 'https://api.agents.alchm.kitchen', status: 200, latencyMs: 41 },
        },
        providersConfigured: { openai: true },
        deployment: {
          url: 'agents.alchm.kitchen',
          env: 'production',
          commitSha: 'deadbeef',
          commitRef: 'main',
          region: 'iad1',
        },
      },
      alerts: [],
    } as unknown as OverviewPulsePayload['dashboard'],
  }
}

describe('Admin API pulse/stream/snapshot routes and upgraded Overview UI', () => {
  const originalEventSource = globalThis.EventSource
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    buildOverviewPulseMock.mockResolvedValue(makePulseFixture())
    evaluateAndDispatchSnapshotMock.mockResolvedValue({
      evaluatedAt: '2026-11-21T23:30:00.000Z',
      previousState: 'NOMINAL',
      currentState: 'CRITICAL',
      delivery: makePulseFixture().alertDelivery,
      events: [],
    })
    runCronJobMock.mockImplementation(async (_job, work) => work({}))

    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.setAttribute('open', '')
        Object.defineProperty(this, 'open', { configurable: true, value: true })
      }
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function close() {
        this.removeAttribute('open')
        Object.defineProperty(this, 'open', { configurable: true, value: false })
        this.dispatchEvent(new Event('close'))
      }
    }
  })

  afterEach(() => {
    globalThis.EventSource = originalEventSource
    globalThis.fetch = originalFetch
  })

  it('enforces admin auth on /api/admin/overview-pulse and returns no-store pulse JSON', async () => {
    const { GET } = await import('@/app/api/admin/overview-pulse/route')

    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      error: 'Authentication required',
    })
    const denied = await GET(new NextRequest('http://localhost/api/admin/overview-pulse'))
    expect(denied.status).toBe(401)

    requireAdminMock.mockResolvedValueOnce({
      ok: true,
      user: { id: 'a1', email: 'ops@alchm.kitchen', role: 'admin' },
      source: 'db-role',
    })
    const okRes = await GET(new NextRequest('http://localhost/api/admin/overview-pulse?fresh=1'))
    expect(okRes.status).toBe(200)
    expect(okRes.headers.get('cache-control')).toBe('no-store')
    const json = await okRes.json()
    expect(json.controlPlane.state).toBe('CRITICAL')
    expect(buildOverviewPulseMock).toHaveBeenCalledWith({ fresh: true })
  })

  it('enforces admin auth on /api/admin/stream and emits valid SSE pulse frames on ?once=1', async () => {
    const { GET } = await import('@/app/api/admin/stream/route')

    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'Admin privileges required',
    })
    const denied = await GET(new NextRequest('http://localhost/api/admin/stream?once=1'))
    expect(denied.status).toBe(403)

    requireAdminMock.mockResolvedValueOnce({
      ok: true,
      user: { id: 'a1', email: 'ops@alchm.kitchen', role: 'admin' },
      source: 'db-role',
    })
    const streamRes = await GET(new NextRequest('http://localhost/api/admin/stream?once=1'))
    expect(streamRes.status).toBe(200)
    expect(streamRes.headers.get('content-type')).toContain('text/event-stream')
    const bodyText = await streamRes.text()
    expect(bodyText).toContain('retry: 5000')
    expect(bodyText).toContain('event: pulse')
    expect(bodyText).toContain('"state":"CRITICAL"')
  })

  it('protects and runs /api/cron/system-health-snapshot via authorizeCron + runCronJob', async () => {
    const { GET } = await import('@/app/api/cron/system-health-snapshot/route')

    authorizeCronMock.mockReturnValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const denied = await GET(new Request('http://localhost/api/cron/system-health-snapshot'))
    expect(denied.status).toBe(401)

    authorizeCronMock.mockReturnValueOnce({ ok: true })
    const ok = await GET(new Request('http://localhost/api/cron/system-health-snapshot'))
    expect(ok.status).toBe(200)
    const body = await ok.json()
    expect(body.ok).toBe(true)
    expect(body.state).toBe('CRITICAL')
    expect(body.debitVerdict).toBe('INCIDENT')
    expect(evaluateAndDispatchSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('renders AdminCommandPalette using native <dialog> and filters routes + dynamic queries', async () => {
    const { AdminCommandPalette } = await import('@/components/admin/AdminCommandPalette')
    const { container } = render(<AdminCommandPalette />)

    const dialog = container.querySelector('dialog')
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute('role')).toBeNull()
    expect(dialog?.getAttribute('aria-modal')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Open admin command palette/i }))
    expect(dialog?.open).toBe(true)

    const search = screen.getByPlaceholderText(/Filter 20 admin consoles/i)
    fireEvent.change(search, { target: { value: 'agent:gregory' } })
    expect(screen.getByText(/Search agent “gregory”/i)).toBeTruthy()
  })

  it('renders OverviewPage with live SSE control plane and lazy opt-in Subsystem Digest tab', async () => {
    const fixture = makePulseFixture()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: {} }),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    class MockEventSource {
      static CLOSED = 2
      readyState = 1
      private listeners = new Map<string, Array<(ev: Event) => void>>()
      onerror: ((ev: Event) => void) | null = null
      constructor(_url: string) {
        setTimeout(() => {
          const handlers = this.listeners.get('pulse') ?? []
          for (const h of handlers) {
            h({ data: JSON.stringify(fixture) } as unknown as MessageEvent<string>)
          }
        }, 0)
      }
      addEventListener(type: string, cb: (ev: Event) => void) {
        const list = this.listeners.get(type) ?? []
        list.push(cb)
        this.listeners.set(type, list)
      }
      close() {
        this.readyState = 2
      }
    }
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource

    const { OverviewPage } = await import('@/components/admin/pages/OverviewPage')
    render(<OverviewPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Operations Control Plane/i })).toBeTruthy()
    })

    expect(screen.getByText(/Live SSE/i)).toBeTruthy()
    expect(screen.getByText(/Priority Triage Queue/i)).toBeTruthy()
    expect(
      screen.getByRole('tab', { name: /Core Metrics & Roster/i }).getAttribute('aria-selected')
    ).toBe('true')

    // Selection-by-activation: /api/admin/alerts must NOT have been fetched on initial mount.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/admin/alerts'))).toBe(
      false
    )

    // Clicking Subsystem Digest (14) opts into fetching /api/admin/alerts.
    fireEvent.click(screen.getByRole('tab', { name: /Subsystem Digest/i }))
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/admin/alerts'))).toBe(
        true
      )
    })
  })
})
