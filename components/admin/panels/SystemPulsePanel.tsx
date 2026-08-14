'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  Info,
  KeyRound,
  Radio,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdminAlert, AlertSeverity } from '@/lib/admin/alerts'
import {
  AlertRow,
  Empty,
  KeyValue,
  Metric,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  Section,
  StatusDot,
  formatAge,
  formatDateTime,
  formatNumber,
} from './ui'

export type PulsePayload = {
  generatedAt: string
  collectionMs: number
  posture: 'healthy' | 'warn' | 'error'
  counts: Record<AlertSeverity, number>
  alerts: AdminAlert[]
  subsystems: Array<{
    id: string
    label: string
    ok: boolean
    latencyMs: number
    error: string | null
    alertCount: number
  }>
  database: { ok: boolean; latencyMs: number; error: string | null }
  providers: Array<{ id: string; env: string; role: string; configured: boolean }>
  requiredSecrets: Array<{ env: string; impact: string; configured: boolean }>
  recentFailures: {
    mcpFailures24h: number
    mcpTotal24h: number
    lastConversationMinutesAgo: number | null
  } | null
}

const SEVERITIES: AlertSeverity[] = ['critical', 'warning', 'info']

export default function SystemPulsePanel({
  data,
  loading,
  error,
  onRetry,
  onNavigate,
  compact = false,
}: {
  data: PulsePayload | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onNavigate?: (tab: string) => void
  /** Overview embed: digest only, no infrastructure detail. */
  compact?: boolean
}) {
  const [filter, setFilter] = useState<AlertSeverity | 'all'>('all')

  const visible = useMemo(
    () => (data ? data.alerts.filter(a => filter === 'all' || a.severity === filter) : []),
    [data, filter]
  )

  if (error) return <PanelError message={error} onRetry={onRetry} />
  if (loading && !data) return <PanelSkeleton cards={3} />
  if (!data) return <Empty label="System pulse is unavailable." />

  const digest = (
    <Section
      title="Problem Digest"
      icon={ShieldAlert}
      subtitle={`Merged from ${data.subsystems.length} subsystems in ${data.collectionMs}ms — each subsystem decides what counts as bad for its own numbers`}
      action={
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition',
              filter === 'all'
                ? 'border-zinc-400/30 bg-zinc-100/10 text-zinc-100'
                : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07]'
            )}
          >
            all {data.alerts.length}
          </button>
          {SEVERITIES.map(severity => (
            <button
              key={severity}
              type="button"
              onClick={() => setFilter(severity)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition',
                filter === severity
                  ? severity === 'critical'
                    ? 'border-rose-500/40 bg-rose-500/20 text-rose-200'
                    : severity === 'warning'
                      ? 'border-amber-500/40 bg-amber-500/20 text-amber-200'
                      : 'border-sky-500/40 bg-sky-500/20 text-sky-200'
                  : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07]'
              )}
            >
              {severity} {data.counts[severity]}
            </button>
          ))}
        </div>
      }
    >
      {visible.length === 0 ? (
        <Empty
          label={
            data.alerts.length === 0
              ? 'No subsystem reported a problem. Every diagnostic that ran came back clean.'
              : `No ${filter} alerts.`
          }
        />
      ) : (
        <div className="space-y-2.5">
          {visible.map(alert => (
            <AlertRow key={alert.id} alert={alert} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </Section>
  )

  if (compact) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric
            icon={XCircle}
            label="Critical"
            value={formatNumber(data.counts.critical)}
            tone={data.counts.critical > 0 ? 'rose' : 'emerald'}
          />
          <Metric
            icon={AlertTriangle}
            label="Warnings"
            value={formatNumber(data.counts.warning)}
            tone={data.counts.warning > 0 ? 'amber' : 'emerald'}
          />
          <Metric icon={Info} label="Notices" value={formatNumber(data.counts.info)} tone="sky" />
        </div>
        {digest}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PanelHeader
        eyebrow="System Pulse"
        title="What Is Wrong Right Now"
        description="One ranked digest across the token economy, planetary integration, codebase health, onboarding and infrastructure. A subsystem that fails to answer becomes an alert of its own rather than vanishing from the list."
        icon={Radio}
        tone={data.posture === 'error' ? 'rose' : data.posture === 'warn' ? 'amber' : 'emerald'}
        action={
          <div className="text-right">
            <StatusDot
              ok={data.posture === 'healthy'}
              unknown={data.posture === 'warn'}
              label={data.posture}
            />
            <p className="mt-1.5 font-mono text-[10px] text-zinc-500">
              {formatDateTime(data.generatedAt)}
            </p>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={XCircle}
          label="Critical"
          value={formatNumber(data.counts.critical)}
          detail="Acting now"
          tone={data.counts.critical > 0 ? 'rose' : 'emerald'}
        />
        <Metric
          icon={AlertTriangle}
          label="Warnings"
          value={formatNumber(data.counts.warning)}
          detail="Degrading"
          tone={data.counts.warning > 0 ? 'amber' : 'emerald'}
        />
        <Metric
          icon={Info}
          label="Notices"
          value={formatNumber(data.counts.info)}
          detail="Worth knowing"
          tone="sky"
        />
        <Metric
          icon={Database}
          label="Database"
          value={data.database.ok ? `${data.database.latencyMs}ms` : 'down'}
          detail={data.database.ok ? 'SELECT 1 answered' : (data.database.error ?? 'unreachable')}
          tone={data.database.ok ? 'emerald' : 'rose'}
        />
      </div>

      {digest}

      {/* Subsystem collection status */}
      <Section
        title="Diagnostic Collection"
        icon={Activity}
        subtitle="Whether each subsystem answered — an unanswered subsystem is unknown, not healthy"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.subsystems.map(subsystem => (
            <button
              key={subsystem.id}
              type="button"
              onClick={() => onNavigate?.(subsystem.id)}
              className="rounded-xl border border-white/5 bg-zinc-950/40 p-4 text-left transition hover:border-white/15 hover:bg-zinc-900/50"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-zinc-200">{subsystem.label}</span>
                <StatusDot ok={subsystem.ok} label={subsystem.ok ? 'ok' : 'failed'} />
              </div>
              <p className="mt-2 font-mono text-[10px] text-zinc-500">
                {subsystem.latencyMs}ms · {subsystem.alertCount} alert
                {subsystem.alertCount === 1 ? '' : 's'}
              </p>
              {subsystem.error && (
                <p className="mt-1 truncate font-mono text-[10px] text-rose-300/70">
                  {subsystem.error}
                </p>
              )}
            </button>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Model providers */}
        <Section
          title="Model Provider Chain"
          icon={Cpu}
          subtitle="The free chain skips missing keys silently — absence is only visible if stated"
        >
          <div className="space-y-2">
            {data.providers.map(provider => (
              <div
                key={provider.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-zinc-950/40 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-200">{provider.id}</p>
                  <p className="truncate text-[10px] text-zinc-500">{provider.role}</p>
                </div>
                <StatusDot ok={provider.configured} label={provider.configured ? 'set' : 'unset'} />
              </div>
            ))}
          </div>
        </Section>

        {/* Secrets + live error surface */}
        <Section title="Fail-Closed Secrets & Live Errors" icon={KeyRound}>
          <div className="space-y-4">
            <div className="space-y-2">
              {data.requiredSecrets.map(secret => (
                <div
                  key={secret.env}
                  className={cn(
                    'rounded-xl border p-3',
                    secret.configured
                      ? 'border-white/5 bg-zinc-950/40'
                      : 'border-amber-500/25 bg-amber-500/10'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-zinc-200">
                      {secret.env}
                    </span>
                    <StatusDot
                      ok={secret.configured}
                      label={secret.configured ? 'set' : 'missing'}
                    />
                  </div>
                  {!secret.configured && (
                    <p className="mt-1.5 text-[10px] leading-relaxed text-amber-100/80">
                      {secret.impact}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {data.recentFailures && (
              <div className="border-t border-white/5 pt-3">
                <KeyValue
                  label="MCP failures (24h)"
                  value={`${data.recentFailures.mcpFailures24h} of ${data.recentFailures.mcpTotal24h}`}
                  tone={data.recentFailures.mcpFailures24h > 0 ? 'rose' : undefined}
                />
                <KeyValue
                  label="Last conversation"
                  value={formatAge(data.recentFailures.lastConversationMinutesAgo)}
                />
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  )
}
