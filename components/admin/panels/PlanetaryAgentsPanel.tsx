'use client'

import {
  Activity,
  AlertTriangle,
  Bot,
  Clock,
  Globe2,
  Orbit,
  Radar,
  Satellite,
  Server,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdminAlert } from '@/lib/admin/alerts'
import {
  AlertRow,
  Bar,
  Empty,
  KeyValue,
  Metric,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  Pill,
  Section,
  StatusDot,
  formatAge,
  formatDateTime,
  formatNumber,
  type Tone,
} from './ui'

export type PlanetaryPayload = {
  generatedAt: string
  ephemeris: {
    source: string
    reachable: boolean
    backendUrl: string
    latencyMs: number | null
    bodies: Array<{
      planet: string
      sign: string
      degree: number
      longitude: number
      retrograde: boolean
    }>
    withheld: string[]
    error: string | null
    approximationValidRange: string
  }
  backends: Array<{
    name: string
    url: string
    path: string
    env: string
    ok: boolean
    status: number | null
    latencyMs: number
    error: string | null
    configured: boolean
  }>
  roster: {
    total: number
    wallets: number
    degreeSprites: number
    lunarSprites: number
    degreeGridExpected: number
    perPlanet: Array<{ planet: string; count: number }>
    perDignity: Array<{ tier: string; count: number }>
  } | null
  conversations: {
    total24h: number
    total7d: number
    spriteConversations7d: number
    walletConversations7d: number
    spriteSharePct: number
    topSprites: Array<{ agentId: string; count: number; avgLatencyMs: number | null }>
  } | null
  transits: {
    statusCounts: Record<string, number>
    failed: number
    overdue: number
    notifications24h: number
    catalogedTransits: number
    totalJobs: number
    recent: Array<{
      id: string
      jobType: string
      status: string
      scheduledFor: string | null
      completedAt: string | null
      executionTime: number | null
      lastError: string | null
      retryCount: number
      chartsProcessed: number
      transitsFound: number
      notificationsCreated: number
    }>
  } | null
  activation: {
    statusCounts: Record<string, number>
    evaluated24h: number
    posted24h: number
    avgScore24h: number | null
    maxScore24h: number | null
    recentFailures: Array<{
      id: string
      agentId: string
      eventType: string
      triggerType: string
      triggerSummary: string
      score: number
      attempts: number
      lastError: string | null
      evaluatedAt: string | null
    }>
  } | null
  crons: {
    secretConfigured: boolean
    jobs: Array<{
      path: string
      schedule: string
      label: string
      expectedIntervalMinutes: number
      evidence: string
      lastEvidenceAt: string | null
      ageMinutes: number | null
      stale: boolean
      staleAfterMinutes: number
    }>
  }
  degraded: Array<{ section: string; error: string }>
  alerts: AdminAlert[]
}

const JOB_STATUS_TONE: Record<string, Tone> = {
  completed: 'emerald',
  running: 'sky',
  pending: 'amber',
  failed: 'rose',
}

export default function PlanetaryAgentsPanel({
  data,
  loading,
  error,
  onRetry,
  onNavigate,
}: {
  data: PlanetaryPayload | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onNavigate?: (tab: string) => void
}) {
  if (error) return <PanelError message={error} onRetry={onRetry} />
  if (loading && !data) return <PanelSkeleton />
  if (!data) return <Empty label="Planetary integration telemetry is unavailable." />

  const { ephemeris, backends, roster, conversations, transits, activation, crons } = data
  const swiss = ephemeris.source === 'swiss-ephemeris'
  const maxPlanet = Math.max(1, ...(roster?.perPlanet.map(p => p.count) ?? [1]))

  return (
    <div className="space-y-6">
      <PanelHeader
        eyebrow="Planetary Agents Integration"
        title="Sky Layer, Sprites & Automation"
        description="Where the live sky meets the roster: measured ephemeris provenance, the degree and lunar sprite reservoirs, transit automation, the feed activation engine, and whether the scheduled jobs that drive all of it are actually running."
        icon={Orbit}
        tone="violet"
        action={
          <span className="text-[10px] font-mono text-zinc-500">
            read {formatDateTime(data.generatedAt)}
          </span>
        }
      />

      {data.degraded.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4" />
            {data.degraded.length} section(s) unreadable
          </div>
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-amber-100/80">
            {data.degraded.map(d => (
              <li key={d.section}>
                <span className="font-bold">{d.section}</span>: {d.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.alerts.length > 0 && (
        <Section title="Planetary Alerts" icon={AlertTriangle}>
          <div className="space-y-2.5">
            {data.alerts.map(alert => (
              <AlertRow key={alert.id} alert={alert} onNavigate={onNavigate} />
            ))}
          </div>
        </Section>
      )}

      {/* Ephemeris provenance — the headline claim */}
      <Section
        title="Live Sky Provenance"
        icon={Satellite}
        subtitle="Measured by asking the ephemeris backend, not inferred from configuration"
        action={
          <div className="flex items-center gap-2">
            <StatusDot ok={swiss} label={swiss ? 'swiss-ephemeris' : 'approximation'} />
            {ephemeris.latencyMs !== null && (
              <span className="font-mono text-[10px] text-zinc-500">{ephemeris.latencyMs}ms</span>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div
            className={cn(
              'rounded-xl border p-4 text-xs leading-relaxed',
              swiss
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-100/80'
                : 'border-rose-500/25 bg-rose-500/10 text-rose-100/90'
            )}
          >
            {swiss ? (
              <>
                Positions are being served by the Swiss ephemeris backend at{' '}
                <span className="font-mono">{ephemeris.backendUrl}</span> and validate against its
                schema, so charts computed now legitimately carry{' '}
                <span className="font-mono">source: &quot;swiss-ephemeris&quot;</span>.
              </>
            ) : (
              <>
                The Swiss backend at <span className="font-mono">{ephemeris.backendUrl}</span> is
                not answering ({ephemeris.error}). Everything below comes from the local Keplerian
                approximation, stamped{' '}
                <span className="font-mono">source: &quot;{ephemeris.source}&quot;</span> — element
                set fitted for {ephemeris.approximationValidRange}, no perturbation terms. Do not
                produce a <span className="font-mono">computed</span> natal chart from it.
              </>
            )}
          </div>

          {ephemeris.withheld.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-100/80">
              Withheld as physically implausible rather than returned wrong:{' '}
              <span className="font-mono font-bold">{ephemeris.withheld.join(', ')}</span>
            </div>
          )}

          {ephemeris.bodies.length === 0 ? (
            <Empty label="No bodies could be resolved from either source." />
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {ephemeris.bodies.map(body => (
                <div
                  key={body.planet}
                  className="rounded-xl border border-white/5 bg-zinc-950/40 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-200">{body.planet}</span>
                    {body.retrograde && <Pill tone="amber">℞</Pill>}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-zinc-400">
                    {body.degree.toFixed(2)}° {body.sign}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-600">λ {body.longitude}°</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Backends */}
      <Section
        title="Backend Reachability"
        icon={Server}
        subtitle="All three services this layer depends on"
      >
        <div className="grid gap-3 lg:grid-cols-3">
          {backends.map(backend => (
            <div key={backend.env} className="rounded-xl border border-white/5 bg-zinc-950/40 p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-zinc-200">{backend.name}</span>
                <StatusDot ok={backend.ok} label={backend.ok ? `${backend.status}` : 'down'} />
              </div>
              <p className="mt-1.5 truncate font-mono text-[10px] text-zinc-500">{backend.url}</p>
              <div className="mt-2">
                <KeyValue label="Latency" value={`${backend.latencyMs}ms`} />
                <KeyValue
                  label="Config"
                  value={backend.configured ? backend.env : 'code default'}
                />
                {backend.error && <KeyValue label="Error" value={backend.error} tone="rose" />}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Roster classification */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Section
          title="Sprite Roster"
          icon={Sparkles}
          subtitle="Classified through lib/agents/agent-type-model.ts"
        >
          {!roster ? (
            <Empty label="Roster unreadable." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Metric
                  icon={Bot}
                  label="Wallets"
                  value={formatNumber(roster.wallets)}
                  tone="sky"
                />
                <Metric
                  icon={Orbit}
                  label="Degree Sprites"
                  value={formatNumber(roster.degreeSprites)}
                  detail={`of ${formatNumber(roster.degreeGridExpected)} grid`}
                  tone={roster.degreeSprites === 0 ? 'rose' : 'violet'}
                />
                <Metric
                  icon={Globe2}
                  label="Lunar Sprites"
                  value={formatNumber(roster.lunarSprites)}
                  tone="emerald"
                />
              </div>

              {roster.perPlanet.length > 0 ? (
                <div className="border-t border-white/5 pt-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Degree sprites per planet
                  </p>
                  <div className="space-y-2">
                    {roster.perPlanet.map(row => (
                      <div key={row.planet} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-medium capitalize text-zinc-400">{row.planet}</span>
                          <span className="font-mono font-bold text-zinc-500">{row.count}</span>
                        </div>
                        <Bar value={row.count} max={maxPlanet} tone="violet" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-5 text-center text-[11px] leading-relaxed text-zinc-500">
                  No degree sprites are seeded in this database. The reservoir economy and transit
                  attunement both operate on sprites, so both are inert here regardless of what the
                  cron reports.
                </div>
              )}

              {roster.perDignity.length > 0 && (
                <div className="border-t border-white/5 pt-3">
                  {roster.perDignity.map(row => (
                    <KeyValue
                      key={row.tier}
                      label={`Dignity · ${row.tier}`}
                      value={formatNumber(row.count)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title="Sprite Conversation Volume" icon={Activity} subtitle="Last 7 days">
          {!conversations ? (
            <Empty label="Conversation table unreadable." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Metric
                  icon={Activity}
                  label="Chats 24h"
                  value={formatNumber(conversations.total24h)}
                  tone="sky"
                />
                <Metric
                  icon={Orbit}
                  label="Sprite Share"
                  value={`${conversations.spriteSharePct}%`}
                  detail={`${formatNumber(conversations.spriteConversations7d)} of ${formatNumber(conversations.spriteConversations7d + conversations.walletConversations7d)}`}
                  tone="violet"
                />
              </div>
              {conversations.topSprites.length === 0 ? (
                <Empty label="No planetary sprite has been consulted in the last 7 days." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b border-zinc-800 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-2 py-2 text-left">Sprite</th>
                        <th className="px-2 py-2 text-right">Chats</th>
                        <th className="px-2 py-2 text-right">Avg latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {conversations.topSprites.map(sprite => (
                        <tr key={sprite.agentId}>
                          <td className="px-2 py-2 font-mono text-zinc-300">{sprite.agentId}</td>
                          <td className="px-2 py-2 text-right font-mono text-zinc-400">
                            {sprite.count}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-zinc-500">
                            {sprite.avgLatencyMs === null ? '—' : `${sprite.avgLatencyMs}ms`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Section>
      </div>

      {/* Cron liveness */}
      <Section
        title="Scheduled Job Liveness"
        icon={Clock}
        subtitle="No cron run-log exists — liveness is inferred from the side effect each job leaves behind"
        action={
          <StatusDot
            ok={crons.secretConfigured}
            label={crons.secretConfigured ? 'CRON_SECRET set' : 'CRON_SECRET missing'}
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="border-b border-zinc-800 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Job</th>
                <th className="px-3 py-2.5 text-left">Schedule</th>
                <th className="px-3 py-2.5 text-left">Evidence</th>
                <th className="px-3 py-2.5 text-right">Last trace</th>
                <th className="px-3 py-2.5 text-right">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {crons.jobs.map(job => (
                <tr key={job.path} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-zinc-200">{job.label}</div>
                    <div className="font-mono text-[10px] text-zinc-600">{job.path}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[10px] text-zinc-500">
                    {job.schedule}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[10px] text-zinc-500">
                    {job.evidence}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[11px] text-zinc-400">
                    {formatAge(job.ageMinutes)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <StatusDot ok={!job.stale} label={job.stale ? 'no trace' : 'active'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Transit automation + activation engine */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Transit Monitoring" icon={Radar}>
          {!transits ? (
            <Empty label="Transit job table unreadable." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Metric
                  icon={Radar}
                  label="Jobs"
                  value={formatNumber(transits.totalJobs)}
                  detail={`${transits.failed} failed · ${transits.overdue} overdue`}
                  tone={transits.failed > 0 || transits.overdue > 0 ? 'rose' : 'emerald'}
                />
                <Metric
                  icon={Activity}
                  label="Notifications 24h"
                  value={formatNumber(transits.notifications24h)}
                  detail={`${formatNumber(transits.catalogedTransits)} cataloged transits`}
                  tone="sky"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {Object.entries(transits.statusCounts).map(([status, count]) => (
                  <Pill key={status} tone={JOB_STATUS_TONE[status] ?? 'zinc'}>
                    {status} {count}
                  </Pill>
                ))}
              </div>

              {transits.recent.length === 0 ? (
                <Empty label="No transit monitoring jobs have ever been scheduled." />
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  {transits.recent.map(job => (
                    <div key={job.id} className="border-b border-white/5 py-2.5 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-zinc-300">
                          {job.jobType}
                        </span>
                        <Pill tone={JOB_STATUS_TONE[job.status] ?? 'zinc'}>{job.status}</Pill>
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-zinc-500">
                        {job.chartsProcessed} charts · {job.transitsFound} transits ·{' '}
                        {job.notificationsCreated} notifications
                        {job.executionTime !== null && ` · ${job.executionTime}ms`}
                      </p>
                      {job.lastError && (
                        <p className="mt-1 truncate font-mono text-[10px] text-rose-300/70">
                          {job.lastError} (retry {job.retryCount})
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        <Section
          title="Feed Activation Engine"
          icon={Sparkles}
          subtitle="agent_action_events — scored against the live sky, then posted"
        >
          {!activation ? (
            <Empty label="Action event table unreadable." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Metric
                  icon={Activity}
                  label="Evaluated 24h"
                  value={formatNumber(activation.evaluated24h)}
                  detail={`avg score ${activation.avgScore24h ?? '—'}`}
                  tone="sky"
                />
                <Metric
                  icon={Sparkles}
                  label="Posted 24h"
                  value={formatNumber(activation.posted24h)}
                  detail={`peak score ${activation.maxScore24h ?? '—'}`}
                  tone="emerald"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {Object.entries(activation.statusCounts).map(([status, count]) => (
                  <Pill
                    key={status}
                    tone={status === 'failed' ? 'rose' : status === 'pending' ? 'amber' : 'emerald'}
                  >
                    {status} {count}
                  </Pill>
                ))}
              </div>

              {activation.recentFailures.length === 0 ? (
                <Empty label="No failed activation events." />
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {activation.recentFailures.map(event => (
                    <div
                      key={event.id}
                      className="rounded-xl border border-rose-500/15 bg-rose-500/5 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-zinc-200">
                          {event.agentId}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          score {event.score} · {event.attempts} attempts
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {event.eventType} ← {event.triggerType}: {event.triggerSummary}
                      </p>
                      {event.lastError && (
                        <p className="mt-1 font-mono text-[10px] text-rose-300/80">
                          {event.lastError}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
