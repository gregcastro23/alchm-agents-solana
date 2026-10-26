'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AgentsReportSchema, type AgentsPayload } from '@/lib/admin/page-schemas'
import { AdminFrame } from './AdminFrame'
import {
  AlertList,
  Badge,
  Card,
  LoadState,
  Read,
  ScrollTable,
  Stat,
  Unknown,
  formatAgo,
  num,
  td,
  th,
  useValidatedPoll,
  type Tone,
} from './primitives'

const CHART: Record<string, { glyph: string; label: string; tone: Tone }> = {
  computed: { glyph: '✓', label: 'Computed', tone: 'ok' },
  authored: { glyph: '◐', label: 'Authored', tone: 'muted' },
  placeholder: { glyph: '!', label: 'Placeholder', tone: 'warn' },
  unattributed: { glyph: '?', label: 'Unattributed', tone: 'warn' },
  missing: { glyph: '✕', label: 'No chart', tone: 'bad' },
}

const yes = <Badge glyph="✓" label="Yes" tone="ok" />
const no = (label = 'No') => <Badge glyph="✕" label={label} tone="bad" />
const CATALOG_UNREPORTED = 'Vessel catalog metadata was not included in this response.'

function sumCounts(counts: Record<string, number>) {
  return Object.values(counts).reduce((a, b) => a + b, 0)
}

function StatusCounts({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return <span className="text-zinc-400">none</span>
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {entries.map(([status, count]) => (
        <span key={status}>
          <span className="text-zinc-400">{status}</span> {count.toLocaleString('en-US')}
        </span>
      ))}
    </span>
  )
}

export function AgentsView({ data }: { data: AgentsPayload }) {
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [faction, setFaction] = useState('')

  const rows = useMemo(() => {
    const db = data.db.ok ? new Map(data.db.value.rows.map(r => [r.agentId, r])) : null
    const sync = data.sync.ok ? new Map(data.sync.value.rows.map(r => [r.agentId, r])) : null
    const activity = data.activity.ok ? data.activity.value.byAgent7d : null
    return data.code
      .map(agent => {
        const dbRow = db?.get(agent.agentId)
        const syncRow = sync?.get(agent.agentId)
        const act = activity ? (activity[agent.agentId] ?? { chats: 0, actions: 0 }) : null
        const issues = [
          agent.chart === 'missing' || agent.chart === 'placeholder' ? 'chart' : '',
          db && !dbRow ? 'not seeded' : '',
          sync && !syncRow?.linked ? 'not linked' : '',
          act && act.chats + act.actions === 0 ? 'silent 7d' : '',
        ].filter(Boolean)
        return { agent, dbRow, syncRow, act, issues }
      })
      .sort((a, b) => b.issues.length - a.issues.length || a.agent.name.localeCompare(b.agent.name))
  }, [data])

  const query = search.trim().toLocaleLowerCase()
  const shown = rows.filter(({ agent, issues }) => {
    const catalog = agent.vessel
    const matchesSearch = [
      agent.name,
      agent.agentId,
      catalog?.faction,
      catalog?.era,
      catalog?.archetype,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(query)
    return (
      matchesSearch &&
      (!faction || catalog?.faction === faction) &&
      (!attentionOnly || issues.length > 0)
    )
  })
  const catalog = data.code.flatMap(agent => (agent.vessel ? [agent.vessel] : []))
  const factions = [...new Set(catalog.map(vessel => vessel.faction))].sort()
  const chartCounts = data.code.reduce<Record<string, number>>((acc, a) => {
    acc[a.chart] = (acc[a.chart] ?? 0) + 1
    return acc
  }, {})
  const linked = data.sync.ok ? data.sync.value.rows.filter(r => r.linked).length : null
  const reason = (s: { ok: boolean; reason?: string }) => (s.ok ? '' : (s.reason ?? 'unreadable'))

  return (
    <>
      <AlertList alerts={data.alerts} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Agents in code"
          value={num(data.code.length, '')}
          sub="lib/agents/historical"
        />
        <Stat
          label="In historical_agents"
          value={num(data.db.ok ? data.db.value.historical : null, reason(data.db))}
          sub={
            data.db.ok
              ? `${data.db.value.active} active · ${data.db.value.created} user-created agents`
              : undefined
          }
        />
        <Stat
          label="Linked to alchm.kitchen"
          value={num(linked, reason(data.sync))}
          sub={data.sync.ok ? `${data.sync.value.rows.length} agentic users in this DB` : undefined}
        />
        <Stat
          label="Agents on alchm.kitchen"
          value={num(data.wten.ok ? data.wten.value.agents : null, reason(data.wten))}
          sub={data.wten.ok ? undefined : 'Not exposed by WTEN yet'}
        />
      </div>

      <Card
        title="Vessel catalog"
        subtitle="Identity and likeness from the shared Vessel catalog; archetypes use the natal Sacred 7 baseline. Open progression for earned levels, trained capability and current sky effects."
        action={
          <Link className="text-xs text-indigo-300 hover:underline" href="/admin/leveling">
            View agent progression →
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat
            label="Catalog coverage"
            value={`${catalog.length} / ${data.code.length}`}
            sub="Roster identities reported"
          />
          <Stat
            label="Planetary factions"
            value={num(catalog.length ? factions.length : null, CATALOG_UNREPORTED)}
            sub="Represented in reported identities"
          />
          <Stat
            label="Painted portraits"
            value={num(
              catalog.length
                ? catalog.filter(vessel => vessel.likeness === 'painted').length
                : null,
              CATALOG_UNREPORTED
            )}
            sub="Portrait path declared in the catalog"
          />
          <Stat
            label="Procedural cameos"
            value={num(
              catalog.length
                ? catalog.filter(vessel => vessel.likeness === 'procedural').length
                : null,
              CATALOG_UNREPORTED
            )}
            sub="Generated from the likeness manifest"
          />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card
          title="Natal charts"
          subtitle="Provenance declared in code; historical_agents.hasBirthchart from the database."
        >
          <ul className="flex flex-wrap gap-2">
            {Object.entries(CHART).map(([key, c]) => (
              <li key={key}>
                <Badge
                  glyph={c.glyph}
                  label={`${c.label} ${chartCounts[key] ?? 0}`}
                  tone={c.tone}
                />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-zinc-300">
            Rows flagged without a birth chart in the database:{' '}
            {num(
              data.db.ok ? data.db.value.rows.filter(r => !r.hasBirthchart).length : null,
              reason(data.db)
            )}
          </p>
        </Card>

        <Card
          title="Activity"
          subtitle="Chats from AgentConversation; feed actions from agent_action_events, by status."
        >
          <Read section={data.activity}>
            {a => (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] text-zinc-400">Chats, 24h / 7d</dt>
                  <dd className="tabular-nums">
                    {a.conversations24h.toLocaleString('en-US')} /{' '}
                    {a.conversations7d.toLocaleString('en-US')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-zinc-400">Feed actions, 24h / 7d</dt>
                  <dd className="tabular-nums">
                    {sumCounts(a.actions24h).toLocaleString('en-US')} /{' '}
                    {sumCounts(a.actions7d).toLocaleString('en-US')}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[11px] text-zinc-400">Actions by status, 7d</dt>
                  <dd className="text-xs">
                    <StatusCounts counts={a.actions7d} />
                  </dd>
                </div>
              </dl>
            )}
          </Read>
        </Card>
      </div>

      <Card
        title="Roster"
        subtitle="Agents needing attention first: missing or placeholder chart, not seeded, not linked to alchm.kitchen, or silent for 7 days."
        action={
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={e => setAttentionOnly(e.target.checked)}
              className="accent-indigo-400"
            />
            Needing attention only
          </label>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
          <label className="text-xs text-zinc-300">
            Search roster
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Name, agent ID, era or archetype"
              className="mt-1 block w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
            />
          </label>
          <label className="text-xs text-zinc-300">
            Planetary faction
            <select
              value={faction}
              onChange={event => setFaction(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">All factions</option>
              {factions.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ScrollTable label="Agent roster">
          <thead>
            <tr>
              <th className={th}>Agent</th>
              <th className={th}>Vessel identity</th>
              <th className={th}>Likeness</th>
              <th className={th}>Chart</th>
              <th className={th}>Seeded</th>
              <th className={th}>alchm.kitchen</th>
              <th className={th}>Wallet</th>
              <th className={th}>Last activation</th>
              <th className={th}>Chats 7d</th>
              <th className={th}>Actions 7d</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ agent, dbRow, syncRow, act }) => {
              const chart = CHART[agent.chart] ?? CHART.unattributed
              return (
                <tr key={agent.agentId}>
                  <td className={td}>
                    <Link
                      className="font-semibold text-zinc-100 hover:text-indigo-300 hover:underline"
                      href={`/agent/${encodeURIComponent(agent.agentId)}`}
                    >
                      {agent.name}
                    </Link>
                    <span className="block font-mono text-[10px] text-zinc-400">
                      {agent.agentId}
                    </span>
                    <Link
                      className="mt-1 inline-block text-xs text-indigo-300 hover:underline"
                      href={`/admin/leveling?agent=${encodeURIComponent(agent.agentId)}`}
                    >
                      Progression →
                    </Link>
                  </td>
                  <td className={td}>
                    {agent.vessel ? (
                      <>
                        <span className="block font-medium text-zinc-200">
                          {agent.vessel.faction} ·{' '}
                          <span className="capitalize">{agent.vessel.era}</span>
                        </span>
                        <span className="block text-xs text-zinc-400">
                          {agent.vessel.archetype ?? 'Archetype requires a non-placeholder chart'}
                        </span>
                        <span className="mt-1 block text-[10px] text-zinc-500">
                          {agent.vessel.archetype ? 'Natal archetype · ' : ''}
                          {agent.vessel.provenance} provenance
                        </span>
                      </>
                    ) : (
                      <Unknown reason={CATALOG_UNREPORTED} />
                    )}
                  </td>
                  <td className={td}>
                    {agent.vessel ? (
                      <>
                        <Badge
                          glyph={agent.vessel.likeness === 'painted' ? '◉' : '◇'}
                          label={
                            agent.vessel.likeness === 'painted'
                              ? 'Painted portrait'
                              : 'Procedural cameo'
                          }
                          tone="muted"
                        />
                        <span className="mt-1 block text-[10px] text-zinc-400">
                          {agent.vessel.hasModel ? '3D asset declared' : 'No 3D asset declared'}
                        </span>
                      </>
                    ) : (
                      <Unknown reason={CATALOG_UNREPORTED} />
                    )}
                  </td>
                  <td className={td}>
                    <Badge glyph={chart.glyph} label={chart.label} tone={chart.tone} />
                  </td>
                  <td className={td}>
                    {!data.db.ok ? (
                      <Unknown reason={data.db.reason} />
                    ) : !dbRow ? (
                      no('Missing')
                    ) : dbRow.isActive ? (
                      yes
                    ) : (
                      <Badge glyph="○" label="Inactive" tone="muted" />
                    )}
                  </td>
                  <td className={td}>
                    {!data.sync.ok ? (
                      <Unknown reason={data.sync.reason} />
                    ) : !syncRow ? (
                      no('No user')
                    ) : syncRow.linked ? (
                      <Badge glyph="✓" label="Linked" tone="ok" />
                    ) : (
                      <Badge glyph="!" label="Unlinked" tone="warn" />
                    )}
                  </td>
                  <td className={td}>
                    {!data.wallets.ok ? (
                      <Unknown reason={data.wallets.reason} />
                    ) : data.wallets.value.agentIds.includes(agent.agentId) ? (
                      yes
                    ) : (
                      <Badge glyph="○" label="None" tone="muted" />
                    )}
                  </td>
                  <td className={td}>
                    {!data.sync.ok ? (
                      <Unknown reason={data.sync.reason} />
                    ) : (
                      formatAgo(syncRow?.lastActivationAt ?? null)
                    )}
                  </td>
                  <td className={`${td} tabular-nums`}>
                    {act ? act.chats : <Unknown reason={reason(data.activity)} />}
                  </td>
                  <td className={`${td} tabular-nums`}>
                    {act ? act.actions : <Unknown reason={reason(data.activity)} />}
                  </td>
                </tr>
              )
            })}
            {shown.length === 0 && (
              <tr>
                <td className={`${td} text-center text-zinc-400`} colSpan={10}>
                  No agents match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </ScrollTable>
        <p className="mt-2 text-[11px] text-zinc-400">
          {shown.length} of {rows.length} agents shown. Delivery health for agent-sync is on the
          WTEN link page.
        </p>
      </Card>
    </>
  )
}

export function AgentsPage() {
  const { loaded, refresh } = useValidatedPoll('/api/admin/agents', AgentsReportSchema, 120_000)
  const data =
    loaded.state === 'ok' ? loaded.data : loaded.state === 'error' ? loaded.stale : undefined
  return (
    <AdminFrame
      title="Agents"
      description="Vessel identities, likenesses and progression links alongside chart provenance, database provisioning, alchm.kitchen sync and weekly activity."
      updated={data ? `Read ${formatAgo(data.generatedAt)}` : undefined}
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && <AgentsView data={data} />}
    </AdminFrame>
  )
}
