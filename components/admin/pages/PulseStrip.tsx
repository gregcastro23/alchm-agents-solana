'use client'

import Link from 'next/link'
import { ProvenanceBadge } from '@/components/admin/kit/ProvenanceBadge'
import { adminHref } from '@/lib/admin/nav'
import { fromLiveFlag, type Provenance } from '@/lib/admin/provenance'
import type { OverviewPulsePayload } from '@/lib/admin/overview-pulse-schema'

interface PulseTile {
  id: string
  label: string
  value: string
  sub: string
  href: string
  tone: 'nominal' | 'attention' | 'critical'
  provenance: Provenance
}

const TONE_BORDER: Record<PulseTile['tone'], string> = {
  nominal: 'border-white/10 bg-zinc-900/50',
  attention: 'border-amber-400/35 bg-amber-500/5',
  critical: 'border-rose-400/45 bg-rose-500/10',
}

/**
 * Six-tile live KPI strip rendered across the top of the upgraded `/admin`
 * Overview, with explicit provenance on every value (`LIVE`, `NO SOURCE`, etc.).
 */
export function PulseStrip({ pulse }: { pulse: OverviewPulsePayload }) {
  const { controlPlane, debitPath, dashboard } = pulse
  const dbDomain = controlPlane.domains.find(d => d.key === 'database')
  const backendDomain = controlPlane.domains.find(d => d.key === 'backend')
  const wtenDomain = controlPlane.domains.find(d => d.key === 'wten-link')
  const jobsDomain = controlPlane.domains.find(d => d.key === 'jobs')
  const mcpDomain = controlPlane.domains.find(d => d.key === 'mcp')

  const activityTotal24h =
    (dashboard.jing.ok ? dashboard.jing.value.jingAggregates.last24h : 0) +
    (dashboard.groupChats.ok ? dashboard.groupChats.value.last24h : 0) +
    (dashboard.mcp.ok ? dashboard.mcp.value.last24h : 0)
  const activityProvenance = fromLiveFlag({
    live: dashboard.jing.ok || dashboard.groupChats.ok || dashboard.mcp.ok,
    source: 'jing + councils + mcp (24h)',
    measuredAt: dashboard.generatedAt,
    reason: !dashboard.system.database.ok
      ? dashboard.system.database.ok
        ? null
        : dashboard.system.database.reason
      : null,
  })

  const tiles: PulseTile[] = [
    {
      id: 'readiness',
      label: 'Readiness',
      value: controlPlane.readinessScore === null ? '—' : `${controlPlane.readinessScore}%`,
      sub: `${controlPlane.state} · ${controlPlane.coverage.live}/${controlPlane.coverage.total} live`,
      href: '/admin',
      tone:
        controlPlane.state === 'CRITICAL'
          ? 'critical'
          : controlPlane.state === 'ATTENTION'
            ? 'attention'
            : 'nominal',
      provenance: controlPlane.coverage.provenance,
    },
    {
      id: 'postgres',
      label: 'Postgres DB',
      value: dashboard.system.database.ok
        ? `${dashboard.system.database.value.latencyMs}ms`
        : 'Down',
      sub: dashboard.system.database.ok ? 'Primary database' : dashboard.system.database.reason,
      href: '/admin/infrastructure',
      tone: dashboard.system.database.ok ? 'nominal' : 'critical',
      provenance:
        dbDomain?.provenance ??
        fromLiveFlag({
          live: dashboard.system.database.ok,
          source: 'postgres',
          measuredAt: dashboard.generatedAt,
        }),
    },
    {
      id: 'backend',
      label: 'Python API',
      value: dashboard.system.backend.ok
        ? `${dashboard.system.backend.value.latencyMs}ms`
        : 'Unhealthy',
      sub: dashboard.system.backend.ok
        ? `HTTP ${dashboard.system.backend.value.status}`
        : dashboard.system.backend.reason,
      href: '/admin/infrastructure',
      tone: dashboard.system.backend.ok ? 'nominal' : 'critical',
      provenance:
        backendDomain?.provenance ??
        fromLiveFlag({
          live: dashboard.system.backend.ok,
          source: 'backend /health',
          measuredAt: dashboard.generatedAt,
        }),
    },
    {
      id: 'debit-path',
      label: 'WTEN Debit Path',
      value:
        debitPath.verdict === 'UNKNOWN'
          ? '—'
          : debitPath.verdict === 'INCIDENT'
            ? '0 debits'
            : `${debitPath.debitsLanded}`,
      sub: `${debitPath.verdict} · ${debitPath.feedAttempts} feed / 24h`,
      href: '/admin/wten',
      tone:
        debitPath.verdict === 'INCIDENT'
          ? 'critical'
          : debitPath.verdict === 'UNKNOWN'
            ? 'attention'
            : 'nominal',
      provenance:
        wtenDomain?.provenance ??
        fromLiveFlag({
          live: debitPath.verdict !== 'UNKNOWN',
          source: 'wten_deliveries',
          measuredAt: controlPlane.generatedAt,
        }),
    },
    {
      id: 'crons',
      label: 'Cron Fleet',
      value: jobsDomain?.headline ?? '—',
      sub: jobsDomain?.detail ?? 'Cron telemetry',
      href: '/admin/jobs',
      tone:
        jobsDomain?.state === 'CRITICAL'
          ? 'critical'
          : jobsDomain?.state === 'ATTENTION'
            ? 'attention'
            : 'nominal',
      provenance:
        jobsDomain?.provenance ??
        fromLiveFlag({ live: false, source: 'cron_runs', measuredAt: controlPlane.generatedAt }),
    },
    {
      id: 'activity-24h',
      label: '24h Ops Volume',
      value:
        activityProvenance.state === 'no-source' ? '—' : `${activityTotal24h.toLocaleString()}`,
      sub:
        dashboard.mcp.ok && dashboard.jing.ok && dashboard.groupChats.ok
          ? `${dashboard.jing.value.jingAggregates.last24h} jing · ${dashboard.groupChats.value.last24h} councils · ${dashboard.mcp.value.last24h} mcp`
          : (mcpDomain?.detail ?? 'Database required'),
      href: '/admin/arena',
      tone: activityProvenance.state === 'no-source' ? 'critical' : 'nominal',
      provenance: activityProvenance,
    },
  ]

  return (
    <section aria-label="Live operational KPI strip">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {tiles.map(tile => (
          <Link
            key={tile.id}
            href={adminHref(tile.href)}
            className={`group flex flex-col justify-between rounded-xl border p-3.5 transition hover:border-white/25 ${TONE_BORDER[tile.tone]}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                {tile.label}
              </span>
              <ProvenanceBadge provenance={tile.provenance} compact />
            </div>
            <div className="mt-2.5 text-xl font-semibold tabular-nums text-zinc-50">
              {tile.value}
            </div>
            <div className="mt-1 truncate text-xs text-zinc-400" title={tile.sub}>
              {tile.sub}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
