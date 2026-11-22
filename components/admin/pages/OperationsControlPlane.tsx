'use client'

import Link from 'next/link'
import { ProvenanceBadge } from '@/components/admin/kit/ProvenanceBadge'
import type { PostureState } from '@/lib/admin/operator-alerts'
import type { OverviewPulsePayload } from '@/lib/admin/overview-pulse-schema'
import { adminHref } from '@/lib/admin/nav'
import { formatAge } from '@/lib/admin/provenance'

const POSTURE_BADGE: Record<PostureState, { ring: string; pill: string; icon: string }> = {
  NOMINAL: {
    ring: '#34d399',
    pill: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
    icon: '●',
  },
  ATTENTION: {
    ring: '#fbbf24',
    pill: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
    icon: '▲',
  },
  CRITICAL: {
    ring: '#fb7185',
    pill: 'border-rose-400/45 bg-rose-500/15 text-rose-200',
    icon: '◆',
  },
}

const PRIORITY_STYLE: Record<'P0' | 'P1' | 'P2', string> = {
  P0: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  P1: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  P2: 'border-sky-400/35 bg-sky-500/10 text-sky-200',
}

const MAINTENANCE_STYLE: Record<'ready' | 'degraded' | 'missing', string> = {
  ready: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  degraded: 'border-rose-400/35 bg-rose-500/10 text-rose-200',
  missing: 'border-amber-400/35 bg-amber-500/10 text-amber-200',
}

function ReadinessRing({ score, state }: { score: number | null; state: PostureState }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score))
  const offset = circumference * (1 - pct / 100)
  const stroke = POSTURE_BADGE[state].ring

  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 84 84" aria-hidden="true">
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="7"
        />
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums text-zinc-50">
          {score === null ? '—' : `${score}%`}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-400">Ready</span>
      </div>
    </div>
  )
}

/**
 * Operations Control Plane (WTEN-parity):
 * - Posture & Readiness Ring (`NOMINAL` / `ATTENTION` / `CRITICAL`)
 * - Signal coverage meter (`live / total`)
 * - P0 / P1 / P2 Priority Triage Queue with remediation actions
 * - 8-Domain Pulse Matrix with strict Provenance badges
 * - Maintenance Readiness & Operator Alert Delivery status
 */
export function OperationsControlPlane({ pulse }: { pulse: OverviewPulsePayload }) {
  const { controlPlane, debitPath, alertDelivery, recentAlerts } = pulse
  const badge = POSTURE_BADGE[controlPlane.state]

  return (
    <div className="space-y-4">
      {/* 1. Executive Posture Banner */}
      <section
        aria-label="Operations control plane posture"
        className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <ReadinessRing score={controlPlane.readinessScore} state={controlPlane.state} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold tracking-wider ${badge.pill}`}
                >
                  <span aria-hidden="true">{badge.icon}</span>
                  <span>{controlPlane.state}</span>
                </span>
                <ProvenanceBadge provenance={controlPlane.coverage.provenance} compact />
                <span className="text-xs text-zinc-400">
                  {controlPlane.coverage.live}/{controlPlane.coverage.total} signals live (
                  {controlPlane.coverage.pct}%)
                </span>
              </div>
              <h2 className="mt-2 text-base font-semibold text-zinc-50">
                Operations Control Plane
              </h2>
              <p className="mt-1 text-sm text-zinc-300">{controlPlane.summary}</p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-zinc-950/70 px-3.5 py-2.5 text-xs md:min-w-[260px]">
            <div className="flex w-full items-center justify-between gap-2">
              <span className="font-medium text-zinc-400">Alert Delivery</span>
              <span
                className={`font-mono font-semibold ${
                  alertDelivery.ready ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {alertDelivery.ready ? 'READY' : 'UNCONFIGURED'}
              </span>
            </div>
            <div className="text-zinc-300">
              {alertDelivery.ready
                ? `Active channels: ${alertDelivery.channels.join(', ')}${
                    alertDelivery.emailConfigured
                      ? ` · ${alertDelivery.recipientsCount} recipient(s)`
                      : ''
                  }`
                : 'Set RESEND_API_KEY + AUTH_ADMIN_EMAIL or ALERT_SLACK_WEBHOOK_URL.'}
            </div>
            <div className="w-full border-t border-white/10 pt-1.5 text-zinc-400">
              Debit path:{' '}
              <span
                className={
                  debitPath.verdict === 'INCIDENT'
                    ? 'font-semibold text-rose-300'
                    : debitPath.verdict === 'OK'
                      ? 'font-semibold text-emerald-300'
                      : 'text-zinc-200'
                }
              >
                {debitPath.verdict}
              </span>{' '}
              ({debitPath.debitsLanded} landed / {debitPath.feedAttempts} feed)
            </div>
          </div>
        </div>
      </section>

      {/* 2. P0/P1/P2 Priority Triage Queue */}
      <section
        aria-label="Priority triage queue"
        className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100">
            Priority Triage Queue ({controlPlane.priorities.length})
          </h3>
          <span className="text-xs text-zinc-400">Sorted P0 &rarr; P2 · Worst first</span>
        </div>

        {controlPlane.priorities.length === 0 ? (
          <p className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-2.5 text-xs text-emerald-200">
            No active operational incidents or warnings across the fleet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {controlPlane.priorities.map(item => (
              <li
                key={item.id}
                className="flex flex-col justify-between gap-2 rounded-xl border border-white/10 bg-zinc-950/70 p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${PRIORITY_STYLE[item.tier]}`}
                    >
                      {item.tier}
                    </span>
                    <span className="text-xs font-semibold text-zinc-100">{item.title}</span>
                    <span className="text-[11px] text-zinc-500">[{item.source}]</span>
                  </div>
                  <p className="text-xs text-zinc-300">{item.detail}</p>
                  {item.remediation && (
                    <p className="text-xs text-amber-200/90">Remediation: {item.remediation}</p>
                  )}
                </div>
                <Link
                  href={adminHref(item.href)}
                  className="shrink-0 self-start rounded-lg border border-white/15 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:border-white/30 hover:bg-white/5 sm:self-center"
                >
                  Inspect &rarr;
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. 8-Domain Pulse Matrix */}
      <section aria-label="Domain pulse matrix">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Domain Pulse Matrix</h3>
          <span className="text-xs text-zinc-400">Measured directly from upstream sources</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {controlPlane.domains.map(domain => {
            const pill = POSTURE_BADGE[domain.state]
            return (
              <Link
                key={domain.key}
                href={adminHref(domain.href)}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-zinc-900/50 p-3.5 transition hover:border-white/25"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-200">{domain.label}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] ${pill.pill}`}
                    >
                      <span aria-hidden="true">{pill.icon}</span>
                      {domain.state}
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-semibold tabular-nums text-zinc-50">
                    {domain.headline}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-400" title={domain.detail}>
                    {domain.detail}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5">
                  <ProvenanceBadge provenance={domain.provenance} compact />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* 4. Maintenance & Operator Alert Dispatch History */}
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Maintenance and alerts">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Instrumentation & Maintenance</h3>
          <ul className="mt-3 space-y-2">
            {controlPlane.maintenance.map(item => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950/60 p-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-100">{item.label}</span>
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${MAINTENANCE_STYLE[item.status]}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-300">{item.summary}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">{item.detail}</div>
                </div>
                <Link
                  href={adminHref(item.href)}
                  className="shrink-0 text-xs text-amber-300 hover:text-amber-200"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Operator Alert Audit</h3>
            <span className="text-xs text-zinc-400">Hourly snapshot @ :58 UTC</span>
          </div>
          {recentAlerts.length === 0 ? (
            <p className="mt-3 rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-4 text-xs text-zinc-400">
              No state-transition or sustained-incident dispatches recorded in this instance’s
              window yet. Run{' '}
              <code className="text-zinc-200">/api/cron/system-health-snapshot</code> or wait for
              the top-of-hour `:58` schedule.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentAlerts.slice(0, 5).map(ev => (
                <li
                  key={ev.id}
                  className="rounded-xl border border-white/10 bg-zinc-950/60 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-100">{ev.subject}</span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      {formatAge(ev.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 text-zinc-300">
                    {ev.fromState} &rarr; {ev.toState} ·{' '}
                    {ev.dispatchedTo.length > 0
                      ? `sent to ${ev.dispatchedTo.join(', ')}`
                      : 'logged (delivery disabled)'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
