'use client'

import CosmicTelemetryPanel from '@/components/admin/panels/CosmicTelemetryPanel'
import SystemPulsePanel, { type PulsePayload } from '@/components/admin/panels/SystemPulsePanel'
import { LegacyEnvelopeSchema, type DashboardPayload } from '@/lib/admin/page-schemas'
import { AdminFrame } from './AdminFrame'
import { useAdminNavigate, useDashboard } from './hooks'
import {
  Card,
  LoadState,
  Read,
  Stat,
  Unknown,
  formatAgo,
  num,
  useValidatedPoll,
} from './primitives'

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

export function OverviewPage() {
  const navigate = useAdminNavigate()
  const pulse = useValidatedPoll('/api/admin/alerts', LegacyEnvelopeSchema, 120_000)
  const dashboard = useDashboard()
  const data = dashboard.data
  return (
    <AdminFrame
      title="Overview"
      description="What is wrong right now across every subsystem, then the headline numbers."
      updated={data ? `Read ${formatAgo(data.generatedAt)}` : undefined}
    >
      <SystemPulsePanel
        data={pulse.loaded.state === 'ok' ? (pulse.loaded.data as unknown as PulsePayload) : null}
        loading={pulse.loaded.state === 'loading'}
        error={pulse.loaded.state === 'error' ? pulse.loaded.reason : null}
        onRetry={pulse.refresh}
        onNavigate={navigate}
      />
      <LoadState loaded={dashboard.loaded} onRetry={dashboard.refresh} />
      {data && <OverviewView data={data} />}
    </AdminFrame>
  )
}
