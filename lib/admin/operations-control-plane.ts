import type { AdminAlert } from '@/lib/admin/alerts'
import type { DashboardReport } from '@/lib/admin/dashboard'
import type { JobsReport } from '@/lib/admin/jobs'
import type {
  AlertDeliveryStatus,
  ControlPlaneSnapshotSummary,
  PostureState,
} from '@/lib/admin/operator-alerts'
import { combine, fromLiveFlag, type Provenance } from '@/lib/admin/provenance'
import { classifyDebitPathFromDeliveries } from '@/lib/admin/debit-path'
import type { WtenLinkReport } from '@/lib/admin/wten-link'

/**
 * Operations Control Plane synthesis (WTEN-parity).
 *
 * Pure transformer over DashboardReport + JobsReport + WtenLinkReport +
 * alert delivery readiness. Never performs network or SQL I/O and never
 * synthesizes optimistic defaults when upstream sources fail.
 */

export type ControlPlaneDomainKey =
  | 'database'
  | 'backend'
  | 'wten-link'
  | 'jobs'
  | 'agents'
  | 'mcp'
  | 'councils'
  | 'arena'

export interface ControlPlaneDomain {
  key: ControlPlaneDomainKey
  label: string
  state: PostureState
  headline: string
  detail: string
  href: string
  provenance: Provenance
}

export type PriorityTier = 'P0' | 'P1' | 'P2'

export interface ControlPlanePriority {
  id: string
  tier: PriorityTier
  source: string
  title: string
  detail: string
  remediation?: string
  href: string
}

export interface MaintenanceItem {
  id: 'cron-heartbeats' | 'wten-delivery-log' | 'shared-secrets' | 'alert-delivery'
  label: string
  status: 'ready' | 'degraded' | 'missing'
  summary: string
  detail: string
  href: string
}

export interface OperationsControlPlane {
  generatedAt: string
  state: PostureState
  /** 0-100 posture index, or null only when no domains were evaluated. */
  readinessScore: number | null
  summary: string
  coverage: {
    live: number
    total: number
    pct: number
    provenance: Provenance
  }
  domains: ControlPlaneDomain[]
  priorities: ControlPlanePriority[]
  maintenance: MaintenanceItem[]
}

export interface BuildOperationsControlPlaneInput {
  dashboard: DashboardReport
  jobs: JobsReport
  wtenLink: WtenLinkReport
  alertDelivery: AlertDeliveryStatus
  nowIso?: string
}

const PRIORITY_RANK: Record<PriorityTier, number> = { P0: 0, P1: 1, P2: 2 }

function alertTier(severity: AdminAlert['severity']): PriorityTier {
  if (severity === 'critical') return 'P0'
  if (severity === 'warning') return 'P1'
  return 'P2'
}

export function buildOperationsControlPlane(
  input: BuildOperationsControlPlaneInput
): OperationsControlPlane {
  const { dashboard, jobs, wtenLink, alertDelivery } = input
  const nowIso = input.nowIso ?? dashboard.generatedAt
  const dbOk = dashboard.system.database.ok

  const debitPath = classifyDebitPathFromDeliveries(wtenLink.deliveries, wtenLink.endpoints)
  const secretMismatch = wtenLink.secrets.some(s => s.verdict === 'mismatch')
  const secretNotConfigured = wtenLink.secrets.some(s => s.verdict === 'not_configured')
  const hookSecretMissing = wtenLink.hookSecretConfigured === false

  const domains: ControlPlaneDomain[] = [
    {
      key: 'database',
      label: 'Primary Postgres',
      state: dbOk ? 'NOMINAL' : 'CRITICAL',
      headline: dbOk ? `${dashboard.system.database.value.latencyMs}ms` : 'Down',
      detail: dbOk ? 'SELECT 1 reachable' : dashboard.system.database.reason,
      href: '/admin/infrastructure',
      provenance: fromLiveFlag({
        live: dbOk,
        source: 'postgres ($queryRaw)',
        measuredAt: dashboard.generatedAt,
        reason: dbOk ? null : dashboard.system.database.reason,
      }),
    },
    {
      key: 'backend',
      label: 'Python Agent API',
      state: dashboard.system.backend.ok ? 'NOMINAL' : 'CRITICAL',
      headline: dashboard.system.backend.ok
        ? `${dashboard.system.backend.value.latencyMs}ms`
        : 'Unhealthy',
      detail: dashboard.system.backend.ok
        ? `HTTP ${dashboard.system.backend.value.status} · ${dashboard.system.backend.value.url}`
        : dashboard.system.backend.reason,
      href: '/admin/infrastructure',
      provenance: fromLiveFlag({
        live: dashboard.system.backend.ok,
        source: 'backend /health',
        measuredAt: dashboard.generatedAt,
        reason: dashboard.system.backend.ok ? null : dashboard.system.backend.reason,
      }),
    },
    {
      key: 'wten-link',
      label: 'WTEN Debit & Sync',
      state:
        debitPath.verdict === 'INCIDENT' || secretMismatch
          ? 'CRITICAL'
          : wtenLink.deliveries.status !== 'live' ||
              hookSecretMissing ||
              secretNotConfigured ||
              wtenLink.alerts.some(a => a.severity === 'critical' || a.severity === 'warning')
            ? 'ATTENTION'
            : 'NOMINAL',
      headline:
        debitPath.verdict === 'INCIDENT'
          ? 'Debit silent'
          : debitPath.verdict === 'UNKNOWN'
            ? 'Unreadable'
            : `${debitPath.debitsLanded} debits`,
      detail: debitPath.summary,
      href: '/admin/wten',
      provenance: fromLiveFlag({
        live: wtenLink.deliveries.status === 'live',
        source: 'wten_deliveries',
        measuredAt: wtenLink.generatedAt,
        reason: wtenLink.deliveries.status === 'live' ? null : wtenLink.deliveries.reason,
        missingVars: hookSecretMissing ? ['HOOK_SECRET_ASOL'] : undefined,
      }),
    },
    {
      key: 'jobs',
      label: 'Cron Heartbeats',
      state: jobs.alerts.some(a => a.severity === 'critical')
        ? 'CRITICAL'
        : jobs.heartbeats.status !== 'live' || jobs.alerts.some(a => a.severity === 'warning')
          ? 'ATTENTION'
          : 'NOMINAL',
      headline: jobs.heartbeats.status === 'live' ? `${jobs.jobs.length} jobs` : 'No source',
      detail:
        jobs.heartbeats.status === 'live'
          ? (jobs.alerts[0]?.title ?? 'Scheduled ticks & claim-yield healthy')
          : jobs.heartbeats.reason,
      href: '/admin/jobs',
      provenance: fromLiveFlag({
        live: jobs.heartbeats.status === 'live',
        source: 'cron_runs',
        measuredAt: jobs.generatedAt,
        reason: jobs.heartbeats.status === 'live' ? null : jobs.heartbeats.reason,
      }),
    },
    {
      key: 'agents',
      label: 'Agents & Users',
      state:
        dashboard.agents.ok && dashboard.users.ok ? 'NOMINAL' : dbOk ? 'ATTENTION' : 'CRITICAL',
      headline: dashboard.agents.ok
        ? `${dashboard.agents.value.historical} hist · ${dashboard.agents.value.created} custom`
        : 'Unavailable',
      detail: dashboard.agents.ok
        ? `${dashboard.agents.value.totalConversations} conversations · ${
            dashboard.users.ok ? `${dashboard.users.value.total} users` : 'users unreadable'
          }`
        : dashboard.agents.reason,
      href: '/admin/agents',
      provenance: fromLiveFlag({
        live: dashboard.agents.ok && dashboard.users.ok,
        source: 'users + agents',
        measuredAt: dashboard.generatedAt,
        reason: !dashboard.agents.ok
          ? dashboard.agents.reason
          : !dashboard.users.ok
            ? dashboard.users.reason
            : null,
      }),
    },
    {
      key: 'mcp',
      label: 'MCP Runtime',
      state: !dashboard.mcp.ok
        ? dbOk
          ? 'ATTENTION'
          : 'CRITICAL'
        : dashboard.mcp.value.last24h >= 5 && (dashboard.mcp.value.successRate ?? 100) < 70
          ? 'ATTENTION'
          : 'NOMINAL',
      headline: dashboard.mcp.ok ? `${dashboard.mcp.value.last24h} / 24h` : 'Unavailable',
      detail: dashboard.mcp.ok
        ? dashboard.mcp.value.successRate !== null
          ? `${dashboard.mcp.value.successRate}% success (${dashboard.mcp.value.total} total)`
          : `${dashboard.mcp.value.total} total calls · 0 in last 24h`
        : dashboard.mcp.reason,
      href: '/admin/mcp',
      provenance: fromLiveFlag({
        live: dashboard.mcp.ok,
        source: 'mcp_invocations',
        measuredAt: dashboard.generatedAt,
        reason: dashboard.mcp.ok ? null : dashboard.mcp.reason,
      }),
    },
    {
      key: 'councils',
      label: 'Councils',
      state: !dashboard.groupChats.ok ? (dbOk ? 'ATTENTION' : 'CRITICAL') : 'NOMINAL',
      headline: dashboard.groupChats.ok
        ? `${dashboard.groupChats.value.last24h} / 24h`
        : 'Unavailable',
      detail: dashboard.groupChats.ok
        ? `${dashboard.groupChats.value.total} total council sessions`
        : dashboard.groupChats.reason,
      href: '/admin/councils',
      provenance: fromLiveFlag({
        live: dashboard.groupChats.ok,
        source: 'group_chat_sessions',
        measuredAt: dashboard.generatedAt,
        reason: dashboard.groupChats.ok ? null : dashboard.groupChats.reason,
      }),
    },
    {
      key: 'arena',
      label: 'Jing Arena',
      state: !dashboard.jing.ok ? (dbOk ? 'ATTENTION' : 'CRITICAL') : 'NOMINAL',
      headline: dashboard.jing.ok
        ? `${dashboard.jing.value.jingAggregates.last24h} / 24h`
        : 'Unavailable',
      detail: dashboard.jing.ok
        ? `${dashboard.jing.value.jingAggregates.total} duels logged`
        : dashboard.jing.reason,
      href: '/admin/arena',
      provenance: fromLiveFlag({
        live: dashboard.jing.ok,
        source: 'jing_duel_logs',
        measuredAt: dashboard.generatedAt,
        reason: dashboard.jing.ok ? null : dashboard.jing.reason,
      }),
    },
  ]

  // Merge & deduplicate alerts across Dashboard, Jobs, and WTEN Link into P0/P1/P2 queue.
  const seenPriorityIds = new Set<string>()
  const priorities: ControlPlanePriority[] = []
  for (const alert of [...dashboard.alerts, ...jobs.alerts, ...wtenLink.alerts]) {
    if (seenPriorityIds.has(alert.id)) continue
    seenPriorityIds.add(alert.id)
    priorities.push({
      id: alert.id,
      tier: alertTier(alert.severity),
      source: alert.source,
      title: alert.title,
      detail: alert.detail,
      ...(alert.remediation ? { remediation: alert.remediation } : {}),
      href: alert.href ?? '/admin',
    })
  }

  if (!alertDelivery.ready) {
    priorities.push({
      id: 'ops:alert-delivery-unconfigured',
      tier: 'P1',
      source: 'infrastructure',
      title: 'Operator alert delivery is not configured',
      detail:
        'Neither Resend email (RESEND_API_KEY + AUTH_ADMIN_EMAIL) nor Slack webhook (ALERT_SLACK_WEBHOOK_URL) is provisioned.',
      remediation:
        'Set RESEND_API_KEY + AUTH_ADMIN_EMAIL or ALERT_SLACK_WEBHOOK_URL in Vercel project env.',
      href: '/admin/infrastructure',
    })
  }

  priorities.sort((a, b) => PRIORITY_RANK[a.tier] - PRIORITY_RANK[b.tier])

  // Overall posture & readiness score
  const hasCritical =
    domains.some(d => d.state === 'CRITICAL') || priorities.some(p => p.tier === 'P0')
  const hasAttention =
    domains.some(d => d.state === 'ATTENTION') || priorities.some(p => p.tier === 'P1')
  const state: PostureState = hasCritical ? 'CRITICAL' : hasAttention ? 'ATTENTION' : 'NOMINAL'

  const rawPoints = domains.reduce((acc, d) => {
    if (d.state === 'NOMINAL') return acc + 100
    if (d.state === 'ATTENTION') return acc + 55
    return acc
  }, 0)
  let readinessScore: number | null =
    domains.length > 0 ? Math.round(rawPoints / domains.length) : null
  if (!dbOk && readinessScore !== null) {
    readinessScore = Math.min(readinessScore, 35)
  }

  const liveCount = domains.filter(d => d.provenance.state === 'live').length
  const totalCount = domains.length
  const coveragePct = totalCount > 0 ? Math.round((liveCount / totalCount) * 100) : 0

  const p0Count = priorities.filter(p => p.tier === 'P0').length
  const p1Count = priorities.filter(p => p.tier === 'P1').length
  const summary =
    state === 'NOMINAL'
      ? `All ${totalCount} operational domains nominal (${coveragePct}% live signal coverage).`
      : state === 'CRITICAL'
        ? `${p0Count} P0 critical issue(s) active — ${priorities[0]?.title ?? 'core dependency down'}.`
        : `${p1Count} P1 warning(s) require attention (${coveragePct}% live coverage).`

  const maintenance: MaintenanceItem[] = [
    {
      id: 'cron-heartbeats',
      label: 'Cron heartbeats table',
      status:
        jobs.heartbeats.status === 'live'
          ? 'ready'
          : jobs.heartbeats.status === 'not_provisioned'
            ? 'missing'
            : 'degraded',
      summary:
        jobs.heartbeats.status === 'live'
          ? `${jobs.jobs.length} jobs tracked`
          : jobs.heartbeats.status === 'not_provisioned'
            ? 'Table not provisioned'
            : 'Unreadable',
      detail:
        jobs.heartbeats.status === 'live'
          ? 'cron_runs reachable for tick, push-feed, claim-yield, and snapshot telemetry.'
          : jobs.heartbeats.reason,
      href: '/admin/jobs',
    },
    {
      id: 'wten-delivery-log',
      label: 'WTEN delivery audit log',
      status:
        wtenLink.deliveries.status === 'live'
          ? 'ready'
          : wtenLink.deliveries.status === 'not_provisioned'
            ? 'missing'
            : 'degraded',
      summary:
        wtenLink.deliveries.status === 'live'
          ? `${debitPath.debitsLanded} debits / ${debitPath.feedAttempts} feed in ${wtenLink.windowHours}h`
          : wtenLink.deliveries.status === 'not_provisioned'
            ? 'Table not provisioned'
            : 'Unreadable',
      detail: debitPath.summary,
      href: '/admin/wten',
    },
    {
      id: 'shared-secrets',
      label: 'Cross-service HMAC & sync secrets',
      status: secretMismatch
        ? 'degraded'
        : secretNotConfigured || hookSecretMissing
          ? 'missing'
          : wtenLink.secrets.some(s => s.verdict === 'unknown')
            ? 'degraded'
            : 'ready',
      summary: secretMismatch
        ? 'Secret mismatch with WTEN'
        : hookSecretMissing
          ? 'HOOK_SECRET_ASOL missing'
          : secretNotConfigured
            ? 'Sync secret missing'
            : wtenLink.secrets.every(s => s.verdict === 'match')
              ? 'Secrets match WTEN'
              : 'Probe inconclusive',
      detail:
        wtenLink.secrets.map(s => `${s.secret}: ${s.verdict}`).join(' · ') +
        (wtenLink.hookSecretConfigured === undefined
          ? ''
          : ` · HOOK_SECRET_ASOL: ${wtenLink.hookSecretConfigured ? 'set' : 'unset'}`),
      href: '/admin/wten',
    },
    {
      id: 'alert-delivery',
      label: 'Operator alert delivery',
      status: alertDelivery.ready ? 'ready' : 'missing',
      summary: alertDelivery.ready
        ? `READY (${alertDelivery.channels.join(' + ')})`
        : 'Unconfigured',
      detail: alertDelivery.ready
        ? `Alerts deliver via ${alertDelivery.channels.join(', ')}${
            alertDelivery.emailConfigured ? ` (${alertDelivery.recipientsCount} recipient(s))` : ''
          }.`
        : `Set RESEND_API_KEY + AUTH_ADMIN_EMAIL or ALERT_SLACK_WEBHOOK_URL.`,
      href: '/admin/infrastructure',
    },
  ]

  return {
    generatedAt: nowIso,
    state,
    readinessScore,
    summary,
    coverage: {
      live: liveCount,
      total: totalCount,
      pct: coveragePct,
      provenance: combine(
        domains.map(d => d.provenance),
        'operations-control-plane'
      ),
    },
    domains,
    priorities,
    maintenance,
  }
}

function priorityTierSeverity(tier: PriorityTier): AdminAlert['severity'] {
  if (tier === 'P0') return 'critical'
  if (tier === 'P1') return 'warning'
  return 'info'
}

export function toControlPlaneSnapshotSummary(
  controlPlane: OperationsControlPlane
): ControlPlaneSnapshotSummary {
  return {
    state: controlPlane.state,
    readinessScore: controlPlane.readinessScore,
    domains: controlPlane.domains.map(d => ({
      key: d.key,
      label: d.label,
      state: d.state,
      detail: d.detail,
    })),
    alerts: controlPlane.priorities.map(p => ({
      id: p.id,
      severity: priorityTierSeverity(p.tier),
      source: p.source as AdminAlert['source'],
      title: p.title,
      detail: p.detail,
      ...(p.remediation ? { remediation: p.remediation } : {}),
      href: p.href,
    })),
  }
}
