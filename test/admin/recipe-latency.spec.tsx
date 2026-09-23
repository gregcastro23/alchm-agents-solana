/**
 * A8: /api/generate-recipe latency on the admin Recipes page — read from the
 * backend's window, "unknown" when it cannot be read, and judged against
 * WTEN's 45s prewarm budget.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { loadRecipeLatency } from '@/lib/admin/recipe-latency'
import { RecipeLatencyReportSchema } from '@/lib/admin/page-schemas'
import { RecipesView } from '@/components/admin/pages/RecipesPage'

const liveBody = {
  windowSeconds: 86_400,
  countingSince: 1_790_148_000,
  processStartedAt: 1_790_148_000,
  requests: 60,
  generated: 50,
  cacheHits: 8,
  errors: 2,
  errorRate: 2 / 52,
  p50Ms: 21_400,
  p95Ms: 47_900,
  maxMs: 52_000,
  byProvider: {
    gemini: { count: 31, p50Ms: 24_000, p95Ms: 49_000 },
    groq: { count: 19, p50Ms: 13_700, p95Ms: 18_000 },
  },
}

const fetchReturning = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

afterEach(() => vi.unstubAllEnvs())

describe('loadRecipeLatency', () => {
  it('asks the backend with X-Internal-Secret and converts its timestamps', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'int-s3cret')
    const fetchImpl = fetchReturning(200, liveBody)
    const report = await loadRecipeLatency({ fetchImpl, windowMinutes: 1440 })
    const [url, init] = (fetchImpl as any).mock.calls[0]
    expect(String(url)).toContain('/api/admin/recipe-latency?windowMinutes=1440')
    expect(new Headers(init.headers).get('x-internal-secret')).toBe('int-s3cret')
    expect(report.source).toEqual({ status: 'live' })
    expect(report.summary?.countingSince).toMatch(/^\d{4}-\d\d-\d\dT/)
    expect(RecipeLatencyReportSchema.safeParse(report).success).toBe(true)
  })

  it('flags a p95 over WTEN’s 45s budget', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'x')
    const report = await loadRecipeLatency({ fetchImpl: fetchReturning(200, liveBody) })
    expect(report.alerts.map(a => a.id)).toContain('recipes:latency:p95-over-wten-budget')
  })

  it('a backend without the endpoint yet is "not provisioned", not zero', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'x')
    const report = await loadRecipeLatency({
      fetchImpl: fetchReturning(404, { detail: 'Not Found' }),
    })
    expect(report.source.status).toBe('not_provisioned')
    expect(report.summary).toBeNull()
  })

  it('no secret: unavailable, and no request is made', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', '')
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const report = await loadRecipeLatency({ fetchImpl })
    expect(report.source.status).toBe('unavailable')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('Recipes page', () => {
  it('shows live percentiles and providers', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'x')
    const report = await loadRecipeLatency({ fetchImpl: fetchReturning(200, liveBody) })
    render(<RecipesView data={JSON.parse(JSON.stringify(report))} />)
    expect(screen.getByText('21s')).toBeInTheDocument()
    expect(screen.getAllByText('48s').length).toBeGreaterThan(0)
    expect(screen.getByText('gemini')).toBeInTheDocument()
    expect(screen.getByText(/exceeds WTEN’s 45s prewarm budget/)).toBeInTheDocument()
  })

  it('an unreadable source renders "—" with its reason, never 0', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'x')
    const report = await loadRecipeLatency({ fetchImpl: fetchReturning(500, {}) })
    render(<RecipesView data={JSON.parse(JSON.stringify(report))} />)
    expect(screen.getByText(/Source unreadable/)).toBeInTheDocument()
    const unknowns = screen.getAllByLabelText(
      /^unknown: Latency source unavailable: Backend answered HTTP 500/
    )
    expect(unknowns.length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByText(/^0$/)).toBeNull()
  })
})
