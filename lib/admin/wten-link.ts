import 'server-only'

import { prisma } from '@/lib/db'
import type { AdminAlert } from '@/lib/admin/alerts'
import type { SourceStatus } from '@/lib/admin/jobs'
import { WTEN_ENDPOINT_POLICY, type WtenEndpoint } from '@/lib/wten/delivery'

/**
 * The admin WTEN-link report: how ASOL's deliveries to WTEN are doing (from
 * `wten_deliveries`, written by lib/wten/delivery.ts) and whether the two
 * shared secrets match WTEN's — inferred from the status WTEN answers a
 * harmless probe with, never by reading a secret.
 */

export interface StatusSplit {
  ok2xx: number
  alreadyApplied409: number
  insufficientFunds402: number
  otherClient4xx: number
  server5xx: number
  timeouts: number
  networkErrors: number
}

export interface EndpointHealth {
  endpoint: string
  attempts: number
  events: number
  split: StatusSplit
  p95LatencyMs: number | null
  lastAt: string | null
  lastError: { at: string; status: number | null; message: string } | null
  timeoutMs: number | null
  receiverDedupes: boolean | null
}

export interface DeliveryRow {
  at: string
  endpoint: string
  eventId: string
  attempt: number
  status: number | null
  result: string
  latencyMs: number
  error: string | null
}

export type SecretVerdict = 'match' | 'mismatch' | 'not_configured' | 'unknown'

export interface SecretProbe {
  secret: 'INTERNAL_API_SECRET' | 'ALCHM_KITCHEN_SYNC_SECRET'
  verdict: SecretVerdict
  /** What was asked of WTEN, for the operator. */
  probe: string
  status: number | null
  detail: string
  checkedAt: string
}

export interface WtenLinkReport {
  generatedAt: string
  windowHours: number
  deliveries: SourceStatus
  endpoints: EndpointHealth[] | null
  recent: DeliveryRow[] | null
  secrets: SecretProbe[]
  alerts: AdminAlert[]
}

/**
 * Per-endpoint aggregate over a window. Parameter $1 = window start.
 * Checked against PostgreSQL (PGlite) with the table from
 * prisma/migrations/20260923120000_add_cron_runs_and_wten_deliveries.
 */
export const ENDPOINT_HEALTH_SQL = `
SELECT endpoint,
       COUNT(*)::int                                                        AS attempts,
       COUNT(DISTINCT event_id)::int                                        AS events,
       COUNT(*) FILTER (WHERE status BETWEEN 200 AND 299)::int              AS ok2xx,
       COUNT(*) FILTER (WHERE status = 409)::int                            AS conflict409,
       COUNT(*) FILTER (WHERE status = 402)::int                            AS payment402,
       COUNT(*) FILTER (WHERE status BETWEEN 400 AND 499
                          AND status NOT IN (402, 409))::int                AS client4xx,
       COUNT(*) FILTER (WHERE status >= 500)::int                           AS server5xx,
       COUNT(*) FILTER (WHERE status IS NULL AND error LIKE 'timeout%')::int AS timeouts,
       COUNT(*) FILTER (WHERE status IS NULL
                          AND (error IS NULL OR error NOT LIKE 'timeout%'))::int AS network,
       percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms)::int        AS p95_ms,
       MAX(created_at)                                                      AS last_at
  FROM wten_deliveries
 WHERE created_at >= $1
 GROUP BY endpoint
 ORDER BY endpoint`

/** Latest failed/rejected attempt per endpoint in the window. $1 = window start. */
export const LAST_ERROR_SQL = `
SELECT DISTINCT ON (endpoint) endpoint, status, error, created_at
  FROM wten_deliveries
 WHERE created_at >= $1
   AND result IN ('failed', 'rejected', 'retry')
 ORDER BY endpoint, created_at DESC`

interface HealthRow {
  endpoint: string
  attempts: number
  events: number
  ok2xx: number
  conflict409: number
  payment402: number
  client4xx: number
  server5xx: number
  timeouts: number
  network: number
  p95_ms: number | null
  last_at: Date | string | null
}

interface LastErrorRow {
  endpoint: string
  status: number | null
  error: string | null
  created_at: Date | string
}

const iso = (v: Date | string | null): string | null =>
  v === null ? null : v instanceof Date ? v.toISOString() : new Date(v).toISOString()

export function buildEndpointHealth(
  rows: HealthRow[],
  lastErrors: LastErrorRow[]
): EndpointHealth[] {
  const errors = new Map(lastErrors.map(r => [r.endpoint, r]))
  return rows.map(row => {
    const policy = WTEN_ENDPOINT_POLICY[row.endpoint as WtenEndpoint]
    const err = errors.get(row.endpoint)
    return {
      endpoint: row.endpoint,
      attempts: row.attempts,
      events: row.events,
      split: {
        ok2xx: row.ok2xx,
        alreadyApplied409: row.conflict409,
        insufficientFunds402: row.payment402,
        otherClient4xx: row.client4xx,
        server5xx: row.server5xx,
        timeouts: row.timeouts,
        networkErrors: row.network,
      },
      p95LatencyMs: row.p95_ms,
      lastAt: iso(row.last_at),
      lastError: err
        ? {
            at: iso(err.created_at)!,
            status: err.status,
            message: err.error ?? `HTTP ${err.status}`,
          }
        : null,
      timeoutMs: policy?.timeoutMs ?? null,
      receiverDedupes: policy?.receiverDedupes ?? null,
    }
  })
}

// ---------------------------------------------------------------------------
// Secret probes
// ---------------------------------------------------------------------------

const PROBE_TTL_MS = 5 * 60_000
const PROBE_TIMEOUT_MS = 5_000
let probeCache: { at: number; probes: SecretProbe[] } | null = null

function wtenBase(): string {
  return (process.env.ALCHM_KITCHEN_SYNC_URL || 'https://alchm.kitchen').replace(/\/$/, '')
}

/**
 * Interpret WTEN's answer. `accepted` are statuses WTEN only returns AFTER its
 * secret check passed; 401/403 mean it rejected the secret.
 */
export function interpretProbe(
  status: number | null,
  accepted: number[],
  errorText?: string
): { verdict: SecretVerdict; detail: string } {
  if (status === null)
    return { verdict: 'unknown', detail: `No answer: ${errorText ?? 'network error'}` }
  if (status === 401 || status === 403) {
    return {
      verdict: 'mismatch',
      detail: `WTEN answered ${status}: it does not accept ASOL's value (they differ, or WTEN has none set).`,
    }
  }
  if (accepted.includes(status)) {
    return {
      verdict: 'match',
      detail: `WTEN answered ${status}, which it only returns past its secret check.`,
    }
  }
  return {
    verdict: 'unknown',
    detail: `WTEN answered ${status}; that says nothing about the secret.`,
  }
}

async function probe(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit
): Promise<{ status: number | null; error?: string }> {
  try {
    const res = await fetchImpl(url, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    return { status: res.status }
  } catch (err) {
    return { status: null, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function probeSecrets(
  options: { fetchImpl?: typeof fetch; nowMs?: number; fresh?: boolean } = {}
): Promise<SecretProbe[]> {
  const nowMs = options.nowMs ?? Date.now()
  if (!options.fresh && probeCache && nowMs - probeCache.at < PROBE_TTL_MS) return probeCache.probes
  const fetchImpl = options.fetchImpl ?? ((i, n) => globalThis.fetch(i, n))
  const base = wtenBase()
  const checkedAt = new Date(nowMs).toISOString()
  const probes: SecretProbe[] = []

  // INTERNAL_API_SECRET: WTEN's agent-recipes checks the bearer first, then
  // rejects an empty body with 400. Nothing is written either way.
  const internal = process.env.INTERNAL_API_SECRET
  const internalProbe = `POST ${base}/api/internal/agent-recipes with an empty body`
  if (!internal) {
    probes.push({
      secret: 'INTERNAL_API_SECRET',
      verdict: 'not_configured',
      probe: internalProbe,
      status: null,
      detail: 'Not set in this deployment.',
      checkedAt,
    })
  } else {
    const r = await probe(fetchImpl, `${base}/api/internal/agent-recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${internal}` },
      body: '{}',
    })
    probes.push({
      secret: 'INTERNAL_API_SECRET',
      probe: internalProbe,
      status: r.status,
      checkedAt,
      ...interpretProbe(r.status, [400], r.error),
    })
  }

  // ALCHM_KITCHEN_SYNC_SECRET: WTEN's balance route only takes the
  // X-Sync-Secret path (and answers 404 for an unknown email) when it matches.
  const sync = process.env.ALCHM_KITCHEN_SYNC_SECRET
  const probeEmail = 'secret-probe@agentic.alchm.kitchen'
  const syncProbe = `GET ${base}/api/economy/balance?email=${probeEmail}`
  if (!sync) {
    probes.push({
      secret: 'ALCHM_KITCHEN_SYNC_SECRET',
      verdict: 'not_configured',
      probe: syncProbe,
      status: null,
      detail: 'Not set in this deployment.',
      checkedAt,
    })
  } else {
    const r = await probe(
      fetchImpl,
      `${base}/api/economy/balance?email=${encodeURIComponent(probeEmail)}`,
      {
        headers: { 'X-Sync-Secret': sync },
      }
    )
    probes.push({
      secret: 'ALCHM_KITCHEN_SYNC_SECRET',
      probe: syncProbe,
      status: r.status,
      checkedAt,
      ...interpretProbe(r.status, [200, 404], r.error),
    })
  }

  probeCache = { at: nowMs, probes }
  return probes
}

/** Test-only. */
export function __resetProbeCache(): void {
  probeCache = null
}

// ---------------------------------------------------------------------------

function describeReadError(err: unknown): SourceStatus {
  const code = (err as { code?: string; meta?: { code?: string } } | null)?.code
  const pgCode = (err as { meta?: { code?: string } } | null)?.meta?.code
  if (
    code === 'P2021' ||
    pgCode === '42P01' ||
    /wten_deliveries.*does not exist/i.test(String(err))
  ) {
    return {
      status: 'not_provisioned',
      reason: 'Table wten_deliveries does not exist yet (db push pending).',
    }
  }
  return {
    status: 'unavailable',
    reason: err instanceof Error ? err.message.slice(0, 300) : 'read failed',
  }
}

export function linkAlerts(report: Omit<WtenLinkReport, 'alerts'>): AdminAlert[] {
  const alerts: AdminAlert[] = []
  for (const s of report.secrets) {
    if (s.verdict === 'mismatch' || s.verdict === 'not_configured') {
      alerts.push({
        id: `wten:secret:${s.secret}:${s.verdict}`,
        severity: 'critical',
        source: 'infrastructure',
        title: `${s.secret} ${s.verdict === 'mismatch' ? 'does not match WTEN' : 'is not set'}`,
        detail: s.detail,
        href: '/admin/wten',
      })
    }
  }
  if (report.deliveries.status !== 'live') {
    alerts.push({
      id: `wten:deliveries:${report.deliveries.status}`,
      severity: report.deliveries.status === 'unavailable' ? 'critical' : 'warning',
      source: 'infrastructure',
      title:
        report.deliveries.status === 'not_provisioned'
          ? 'WTEN delivery log is not provisioned'
          : 'WTEN delivery log is unreadable',
      detail: report.deliveries.reason,
      remediation:
        report.deliveries.status === 'not_provisioned'
          ? 'Run `bunx prisma db push` to create wten_deliveries.'
          : undefined,
      href: '/admin/wten',
    })
  }
  for (const e of report.endpoints ?? []) {
    const failures = e.split.server5xx + e.split.timeouts + e.split.networkErrors
    if (e.attempts >= 10 && failures / e.attempts > 0.2) {
      alerts.push({
        id: `wten:endpoint:${e.endpoint}:failing`,
        severity: 'warning',
        source: 'infrastructure',
        title: `Deliveries to WTEN ${e.endpoint} are failing`,
        detail: `${failures} of ${e.attempts} attempts in ${report.windowHours}h got a 5xx, a timeout or no answer.`,
        href: '/admin/wten',
      })
    }
  }
  return alerts
}

export async function loadWtenLinkReport(
  options: { nowMs?: number; windowHours?: number; fetchImpl?: typeof fetch } = {}
): Promise<WtenLinkReport> {
  const nowMs = options.nowMs ?? Date.now()
  const windowHours = options.windowHours ?? 24
  const since = new Date(nowMs - windowHours * 3_600_000)

  const [deliveryPart, secrets] = await Promise.all([
    (async () => {
      try {
        const [health, lastErrors, recent] = await Promise.all([
          prisma.$queryRawUnsafe<HealthRow[]>(ENDPOINT_HEALTH_SQL, since),
          prisma.$queryRawUnsafe<LastErrorRow[]>(LAST_ERROR_SQL, since),
          prisma.wten_deliveries.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
        ])
        return {
          deliveries: { status: 'live' } as SourceStatus,
          endpoints: buildEndpointHealth(health, lastErrors),
          recent: recent.map(
            (r): DeliveryRow => ({
              at: r.createdAt.toISOString(),
              endpoint: r.endpoint,
              eventId: r.eventId,
              attempt: r.attempt,
              status: r.status,
              result: r.result,
              latencyMs: r.latencyMs,
              error: r.error,
            })
          ),
        }
      } catch (err) {
        return { deliveries: describeReadError(err), endpoints: null, recent: null }
      }
    })(),
    probeSecrets({ fetchImpl: options.fetchImpl, nowMs }),
  ])

  const partial = {
    generatedAt: new Date(nowMs).toISOString(),
    windowHours,
    ...deliveryPart,
    secrets,
  }
  return { ...partial, alerts: linkAlerts(partial) }
}
