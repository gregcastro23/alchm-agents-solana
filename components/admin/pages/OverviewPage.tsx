'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import CosmicTelemetryPanel from '@/components/admin/panels/CosmicTelemetryPanel'
import SystemPulsePanel, { type PulsePayload } from '@/components/admin/panels/SystemPulsePanel'
import { useAdminLiveStream, type StreamConnectionState } from '@/hooks/useAdminLiveStream'
import { ADMIN_NAV, adminHref } from '@/lib/admin/nav'
import { LegacyEnvelopeSchema, type DashboardPayload } from '@/lib/admin/page-schemas'
import { AdminFrame } from './AdminFrame'
import { OperationsControlPlane } from './OperationsControlPlane'
import { ProgressionOverview } from './ProgressionOverview'
import { PulseStrip } from './PulseStrip'
import { useAdminNavigate } from './hooks'
import { Card, Read, Stat, Unknown, formatAgo, num, useValidatedPoll } from './primitives'

function reasonOf(section: { ok: boolean; reason?: string }) {
  return section.ok ? '' : (section.reason ?? 'unreadable')
}

export function OverviewView({ data }: { data: DashboardPayload }) {
  const { users, agents, harmony, activity, topAgents, system } = data
  const h = harmony.ok ? harmony.value : null
  const harmonyComplete =
    h && h.spirit !== null && h.essence !== null && h.matter !== null && h.substance !== null

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Users"
          value={num(users.ok ? users.value.total : null, reasonOf(users))}
          sub={
            users.ok
              ? `+${users.value.newToday} since 00:00 UTC · ${users.value.admins} admins`
              : undefined
          }
        />
        <Stat
          label="Historical agents"
          value={num(agents.ok ? agents.value.historical : null, reasonOf(agents))}
          sub={agents.ok ? `${agents.value.created} user-created` : undefined}
        />
        <Stat
          label="Conversations, all time"
          value={num(agents.ok ? agents.value.totalConversations : null, reasonOf(agents))}
          sub="Sum of historical_agents.conversations"
        />
        <Stat
          label="Database"
          value={
            system.database.ok ? (
              <span>
                <span aria-hidden="true">✓ </span>Up
              </span>
            ) : (
              <span>
                <span aria-hidden="true">✕ </span>Down
              </span>
            )
          }
          sub={
            system.database.ok
              ? `${system.database.value.latencyMs} ms round trip`
              : system.database.reason
          }
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Recent activity" subtitle="Latest consciousness_interactions rows.">
          <Read section={activity}>
            {rows =>
              rows.length === 0 ? (
                <p className="text-sm text-zinc-400">No interactions recorded.</p>
              ) : (
                <ul className="divide-y divide-white/5 text-sm">
                  {rows.slice(0, 8).map(a => (
                    <li
                      key={`${a.type}-${a.timestamp}`}
                      className="flex flex-wrap justify-between gap-2 py-2"
                    >
                      <span className="min-w-0 break-words text-zinc-200">{a.description}</span>
                      <span className="text-[11px] text-zinc-400">
                        {a.type} · {formatAgo(a.timestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            }
          </Read>
        </Card>

        <Card title="Most consulted agents" subtitle="By historical_agents.conversations.">
          <Read section={topAgents}>
            {rows =>
              rows.length === 0 ? (
                <p className="text-sm text-zinc-400">No agents yet.</p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {rows.map((a, i) => {
                    const max = Math.max(...rows.map(r => r.interactions), 1)
                    return (
                      <li key={a.id}>
                        <div className="flex justify-between gap-3">
                          <span className="truncate text-zinc-100">
                            {i + 1}. {a.name}
                          </span>
                          <span className="tabular-nums text-zinc-300">
                            {a.interactions.toLocaleString('en-US')}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-white/5" aria-hidden="true">
                          <div
                            className="h-full rounded-full bg-sky-400"
                            style={{ width: `${Math.round((a.interactions / max) * 100)}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )
            }
          </Read>
        </Card>
      </div>

      {harmonyComplete ? (
        <CosmicTelemetryPanel
          data={{
            agents: {
              cosmicHarmony: {
                spirit: h.spirit!,
                essence: h.essence!,
                matter: h.matter!,
                substance: h.substance!,
              },
            },
          }}
        />
      ) : (
        <Card
          title="Roster harmony"
          subtitle="Average Spirit / Essence / Matter / Substance across the roster."
        >
          <p className="text-sm text-zinc-300">
            <Unknown reason={harmony.ok ? 'no agent has all four scores' : harmony.reason} />{' '}
            <span className="text-zinc-400">
              {harmony.ok
                ? 'No agent has all four element scores yet.'
                : `Could not read: ${harmony.reason}`}
            </span>
          </p>
        </Card>
      )}
    </>
  )
}

const STREAM_BADGE: Record<StreamConnectionState, { icon: string; label: string; style: string }> =
  {
    connecting: {
      icon: '◌',
      label: 'Connecting SSE',
      style: 'border-white/15 bg-zinc-900 text-zinc-300',
    },
    live: {
      icon: '●',
      label: 'Live SSE',
      style: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
    },
    reconnecting: {
      icon: '↻',
      label: 'Reconnecting',
      style: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
    },
    polling: {
      icon: '◐',
      label: 'Polling fallback',
      style: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
    },
    paused: {
      icon: '⏸',
      label: 'Paused (tab hidden)',
      style: 'border-zinc-500/40 bg-zinc-800/70 text-zinc-300',
    },
    error: {
      icon: '✕',
      label: 'Stream error',
      style: 'border-rose-400/45 bg-rose-500/10 text-rose-200',
    },
  }

type OverviewTabId = 'core' | 'digest' | 'consoles'

const OVERVIEW_TABS: Array<{ id: OverviewTabId; label: string }> = [
  { id: 'core', label: 'Core Metrics & Roster' },
  { id: 'digest', label: 'Subsystem Digest (14)' },
  { id: 'consoles', label: 'Console Launchers' },
]

/** Lazy-mounted only when the operator activates the Subsystem Digest tab. */
function SubsystemDigestTab() {
  const navigate = useAdminNavigate()
  const pulse = useValidatedPoll('/api/admin/alerts', LegacyEnvelopeSchema, 120_000)

  return (
    <SystemPulsePanel
      data={pulse.loaded.state === 'ok' ? (pulse.loaded.data as unknown as PulsePayload) : null}
      loading={pulse.loaded.state === 'loading'}
      error={pulse.loaded.state === 'error' ? pulse.loaded.reason : null}
      onRetry={pulse.refresh}
      onNavigate={navigate}
    />
  )
}

export function OverviewPage() {
  const { data: pulse, error, updatedAt, connectionState, refreshNow } = useAdminLiveStream()
  const [activeTab, setActiveTab] = useState<OverviewTabId>('core')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const streamMeta = STREAM_BADGE[connectionState]

  const onTabKeyDown = (idx: number, e: React.KeyboardEvent<HTMLButtonElement>) => {
    let nextIdx: number | null = null
    if (e.key === 'ArrowRight') {
      nextIdx = (idx + 1) % OVERVIEW_TABS.length
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (idx - 1 + OVERVIEW_TABS.length) % OVERVIEW_TABS.length
    } else if (e.key === 'Home') {
      nextIdx = 0
    } else if (e.key === 'End') {
      nextIdx = OVERVIEW_TABS.length - 1
    }
    if (nextIdx === null) return
    e.preventDefault()
    const target = OVERVIEW_TABS[nextIdx]
    if (!target) return
    setActiveTab(target.id)
    tabRefs.current[nextIdx]?.focus()
  }

  return (
    <AdminFrame
      title="Overview"
      description="Live operations control plane, provenance-tracked telemetry stream, and deep-dive fleet views."
      statusSlot={
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] ${streamMeta.style}`}
          >
            <span aria-hidden="true">{streamMeta.icon}</span>
            <span>{streamMeta.label}</span>
          </span>
          <button
            type="button"
            onClick={() => void refreshNow()}
            className="rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:border-white/30 hover:bg-zinc-800"
          >
            Refresh
          </button>
        </div>
      }
      updated={updatedAt ? `Read ${formatAgo(new Date(updatedAt).toISOString())}` : undefined}
    >
      {error && !pulse && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void refreshNow()}
            className="rounded border border-rose-300/40 px-2.5 py-1 font-semibold hover:bg-rose-500/20"
          >
            Retry
          </button>
        </div>
      )}

      {!pulse ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 text-sm text-zinc-400">
          Connecting to live operations control plane stream…
        </div>
      ) : (
        <>
          <PulseStrip pulse={pulse} />
          <OperationsControlPlane pulse={pulse} />

          <section aria-label="Detailed telemetry tabs" className="space-y-4">
            <div
              role="tablist"
              aria-label="Overview deep dive views"
              className="flex flex-nowrap gap-1 overflow-x-auto border-b border-white/10"
            >
              {OVERVIEW_TABS.map((tab, idx) => {
                const selected = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    ref={el => {
                      tabRefs.current[idx] = el
                    }}
                    id={`overview-tab-${tab.id}`}
                    role="tab"
                    type="button"
                    aria-selected={selected}
                    aria-controls={`overview-panel-${tab.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={e => onTabKeyDown(idx, e)}
                    className={`shrink-0 border-b-2 px-3.5 py-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      selected
                        ? 'border-amber-400 text-amber-200'
                        : 'border-transparent text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div
              id="overview-panel-core"
              role="tabpanel"
              aria-labelledby="overview-tab-core"
              hidden={activeTab !== 'core'}
              className="space-y-5"
            >
              <ProgressionOverview />
              <OverviewView data={pulse.dashboard} />
            </div>

            <div
              id="overview-panel-digest"
              role="tabpanel"
              aria-labelledby="overview-tab-digest"
              hidden={activeTab !== 'digest'}
            >
              {activeTab === 'digest' && <SubsystemDigestTab />}
            </div>

            <div
              id="overview-panel-consoles"
              role="tabpanel"
              aria-labelledby="overview-tab-consoles"
              hidden={activeTab !== 'consoles'}
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ADMIN_NAV.map(group => (
                  <div
                    key={group.group}
                    className="rounded-xl border border-white/10 bg-zinc-900/50 p-4"
                  >
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      {group.group}
                    </h4>
                    <ul className="mt-2.5 space-y-2">
                      {group.items.map(item => (
                        <li key={item.href}>
                          <Link
                            href={adminHref(item.href)}
                            className="block rounded-lg border border-white/5 bg-zinc-950/60 px-3 py-2 text-xs hover:border-white/20"
                          >
                            <div className="font-semibold text-zinc-100">{item.label}</div>
                            <div className="text-[11px] text-zinc-400">{item.href}</div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </AdminFrame>
  )
}
