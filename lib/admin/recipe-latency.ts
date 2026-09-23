import 'server-only'

import type { AdminAlert } from '@/lib/admin/alerts'
import type { SourceStatus } from '@/lib/admin/jobs'

/**
 * /api/generate-recipe latency and error rate, read from the Python backend's
 * in-process window (backend/recipe_metrics.py via /api/admin/recipe-latency).
 * That window resets on each deploy or restart; `countingSince` is passed
 * through so the page can say how much history the numbers cover.
 */

export interface RecipeLatencySummary {
  windowSeconds: number
  countingSince: string
  processStartedAt: string
  requests: number
  generated: number
  cacheHits: number
  errors: number
  errorRate: number | null
  p50Ms: number | null
  p95Ms: number | null
  maxMs: number | null
  byProvider: Record<string, { count: number; p50Ms: number | null; p95Ms: number | null }>
}

export interface RecipeLatencyReport {
  generatedAt: string
  source: SourceStatus
  summary: RecipeLatencySummary | null
  /** WTEN's prewarm gives each generation at most this long (agentRecipePrewarm.ts PA_TIMEOUT_MS). */
  wtenBudgetMs: number
  alerts: AdminAlert[]
}

export const WTEN_PREWARM_BUDGET_MS = 45_000

const BACKEND_URL = () =>
  (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    'https://api.agents.alchm.kitchen'
  ).replace(/\/$/, '')

export function recipeAlerts(
  summary: RecipeLatencySummary | null,
  source: SourceStatus
): AdminAlert[] {
  const alerts: AdminAlert[] = []
  if (source.status !== 'live') {
    alerts.push({
      id: 'recipes:latency:unavailable',
      severity: 'warning',
      source: 'infrastructure',
      title: 'Recipe latency is unreadable',
      detail: source.reason,
      href: '/admin/recipes',
    })
    return alerts
  }
  if (
    summary?.p95Ms !== null &&
    summary?.p95Ms !== undefined &&
    summary.p95Ms > WTEN_PREWARM_BUDGET_MS
  ) {
    alerts.push({
      id: 'recipes:latency:p95-over-wten-budget',
      severity: 'warning',
      source: 'infrastructure',
      title: 'Recipe generation p95 exceeds WTEN’s 45s prewarm budget',
      detail: `p95 ${(summary.p95Ms / 1000).toFixed(1)}s over ${summary.generated} generations; WTEN abandons calls after 45s.`,
      href: '/admin/recipes',
    })
  }
  if (
    summary &&
    summary.errorRate !== null &&
    summary.generated + summary.errors >= 5 &&
    summary.errorRate > 0.2
  ) {
    alerts.push({
      id: 'recipes:errors',
      severity: 'warning',
      source: 'infrastructure',
      title: 'Recipe generation is failing often',
      detail: `${summary.errors} of ${summary.generated + summary.errors} generations failed in the window.`,
      href: '/admin/recipes',
    })
  }
  return alerts
}

const toIso = (unixSeconds: unknown): string =>
  typeof unixSeconds === 'number' ? new Date(unixSeconds * 1000).toISOString() : String(unixSeconds)

export async function loadRecipeLatency(
  options: { windowMinutes?: number; fetchImpl?: typeof fetch } = {}
): Promise<RecipeLatencyReport> {
  const fetchImpl = options.fetchImpl ?? ((i, n) => globalThis.fetch(i, n))
  const windowMinutes = options.windowMinutes ?? 1440
  const secret = process.env.INTERNAL_API_SECRET
  let source: SourceStatus
  let summary: RecipeLatencySummary | null = null

  if (!secret) {
    source = {
      status: 'unavailable',
      reason: 'INTERNAL_API_SECRET is not set, so the backend cannot be asked.',
    }
  } else {
    try {
      const res = await fetchImpl(
        `${BACKEND_URL()}/api/admin/recipe-latency?windowMinutes=${windowMinutes}`,
        {
          headers: { 'X-Internal-Secret': secret },
          cache: 'no-store',
          signal: AbortSignal.timeout(8_000),
        }
      )
      if (res.status === 404) {
        source = {
          status: 'not_provisioned',
          reason:
            'The deployed backend has no /api/admin/recipe-latency yet (ships with this change).',
        }
      } else if (!res.ok) {
        source = { status: 'unavailable', reason: `Backend answered HTTP ${res.status}.` }
      } else {
        const raw = (await res.json()) as Record<string, unknown>
        summary = {
          ...(raw as unknown as RecipeLatencySummary),
          countingSince: toIso(raw.countingSince),
          processStartedAt: toIso(raw.processStartedAt),
        }
        source = { status: 'live' }
      }
    } catch (err) {
      source = { status: 'unavailable', reason: err instanceof Error ? err.message : String(err) }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source,
    summary,
    wtenBudgetMs: WTEN_PREWARM_BUDGET_MS,
    alerts: recipeAlerts(summary, source),
  }
}
