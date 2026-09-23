import 'server-only'

import type { AdminAlert } from '@/lib/admin/alerts'
import { readSection, type Section } from '@/lib/admin/section'
import { prisma } from '@/lib/db'

/**
 * Chats & providers: recent historical-agent chats, and per-model call counts,
 * failure rates and latency from the AgentConversation log.
 *
 * A chat counts as failed when its response is empty or is the backend's
 * exhausted-chain sentinel (`[All providers unavailable]`) — the only failures
 * this table records. Chats that errored before a row was written are invisible here.
 */

export const FAILED_SENTINEL = '[All providers unavailable]'
/** Failure rate that earns a warning, over at least MIN_CALLS calls. */
export const FAILURE_WARN_RATE = 0.1
export const MIN_CALLS = 10

export interface ModelStats {
  model: string
  calls: number
  failures: number
  /** Calls with a recorded response time; latency percentiles are over these. */
  timed: number
  p50Ms: number | null
  p95Ms: number | null
  lastAt: string
}

export interface RecentChat {
  id: string
  agentId: string
  agentName: string
  sessionId: string
  userMessage: string
  agentResponse: string
  responseTime: number | null
  modelUsed: string | null
  createdAt: string
  failed: boolean
}

export interface ChatsReport {
  generatedAt: string
  byModel24h: Section<ModelStats[]>
  byModel7d: Section<ModelStats[]>
  recent: Section<RecentChat[]>
  alerts: AdminAlert[]
}

/**
 * $1 = window start. `percentile_disc` skips NULL response times.
 * The sentinel is written out (not interpolated) so the text is fixed in source
 * and scripts/checkRawSqlPrepares.ts can PREPARE it; a test pins it to FAILED_SENTINEL.
 */
export const MODEL_STATS_SQL = `
SELECT COALESCE("modelUsed", '(not recorded)')                                  AS model,
       COUNT(*)::int                                                           AS calls,
       COUNT(*) FILTER (WHERE "agentResponse" = ''
                           OR strpos("agentResponse", '[All providers unavailable]') > 0)::int AS failures,
       COUNT("responseTime")::int                                              AS timed,
       percentile_disc(0.5) WITHIN GROUP (ORDER BY "responseTime")::int        AS p50_ms,
       percentile_disc(0.95) WITHIN GROUP (ORDER BY "responseTime")::int       AS p95_ms,
       MAX("createdAt")                                                        AS last_at
  FROM "AgentConversation"
 WHERE "createdAt" >= $1
 GROUP BY 1
 ORDER BY calls DESC
 LIMIT 40`

interface ModelRow {
  model: string
  calls: number
  failures: number
  timed: number
  p50_ms: number | null
  p95_ms: number | null
  last_at: Date | string
}

export function toModelStats(rows: ModelRow[]): ModelStats[] {
  return rows.map(r => ({
    model: r.model,
    calls: Number(r.calls),
    failures: Number(r.failures),
    timed: Number(r.timed),
    p50Ms: r.p50_ms === null ? null : Number(r.p50_ms),
    p95Ms: r.p95_ms === null ? null : Number(r.p95_ms),
    lastAt: new Date(r.last_at).toISOString(),
  }))
}

export function chatAlerts(r: Omit<ChatsReport, 'alerts'>): AdminAlert[] {
  const alerts: AdminAlert[] = []
  const unread = (['byModel24h', 'byModel7d', 'recent'] as const).filter(k => !r[k].ok)
  if (unread.length > 0) {
    alerts.push({
      id: 'chats:unreadable',
      severity: 'warning',
      source: 'agents',
      title: `Could not read chat telemetry (${unread.join(', ')})`,
      detail: unread.map(k => `${k}: ${(r[k] as { reason: string }).reason}`).join(' · '),
      href: '/admin/chats',
    })
  }
  if (r.byModel24h.ok) {
    const calls = r.byModel24h.value.reduce((n, m) => n + m.calls, 0)
    const failures = r.byModel24h.value.reduce((n, m) => n + m.failures, 0)
    if (calls >= MIN_CALLS && failures / calls >= FAILURE_WARN_RATE) {
      alerts.push({
        id: 'chats:failure-rate',
        severity: 'warning',
        source: 'agents',
        title: `${Math.round((failures / calls) * 100)}% of chats failed in the last 24h`,
        detail: `${failures} of ${calls} chats ended with "${FAILED_SENTINEL}" — every provider in the chain refused.`,
        remediation: 'Check provider keys and quotas; GET /api/providers/health pings each one.',
        href: '/admin/chats',
      })
    }
  }
  return alerts
}

export async function loadChatsReport(now: Date = new Date()): Promise<ChatsReport> {
  const since = (hours: number) => new Date(now.getTime() - hours * 3_600_000)
  const [byModel24h, byModel7d, recent] = await Promise.all([
    readSection(async () =>
      toModelStats(await prisma.$queryRawUnsafe<ModelRow[]>(MODEL_STATS_SQL, since(24)))
    ),
    readSection(async () =>
      toModelStats(await prisma.$queryRawUnsafe<ModelRow[]>(MODEL_STATS_SQL, since(24 * 7)))
    ),
    readSection(async () => {
      const convs = await prisma.agentConversation.findMany({
        take: 30,
        orderBy: { createdAt: 'desc' },
        include: { historical_agents: { select: { name: true } } },
      })
      return convs.map(c => ({
        id: c.id,
        agentId: c.agentId,
        agentName: c.historical_agents?.name || c.agentId,
        sessionId: c.sessionId,
        userMessage: c.userMessage.slice(0, 4000),
        agentResponse: c.agentResponse.slice(0, 8000),
        responseTime: c.responseTime,
        modelUsed: c.modelUsed,
        createdAt: c.createdAt.toISOString(),
        failed: c.agentResponse === '' || c.agentResponse.includes(FAILED_SENTINEL),
      }))
    }),
  ])
  const report = { generatedAt: now.toISOString(), byModel24h, byModel7d, recent }
  return { ...report, alerts: chatAlerts(report) }
}
