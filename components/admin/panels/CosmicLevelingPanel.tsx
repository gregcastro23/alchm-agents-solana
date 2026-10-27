'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { LevelingReport } from '@/lib/admin/leveling-schema'
import { ALL_VESSEL_STAT_KEYS } from '@/lib/vessel/progression'
import { VesselProgressionDisplay } from '@/components/vessel/vessel-progression-display'
import {
  AlertList,
  Badge,
  Card,
  Read,
  ScrollTable,
  Stat,
  Unknown,
  num,
  td,
  th,
} from '@/components/admin/pages/primitives'

type Progression = Extract<LevelingReport['progression'], { ok: true }>['value']
type Agent = Progression['agents'][number]
type Sort = 'experience' | 'current' | 'name'
type Status = 'all' | Agent['progressionStatus'] | 'pending'

const STATUS = {
  live: { glyph: '✓', label: 'Live', tone: 'ok' },
  estimated: { glyph: '◐', label: 'Estimated', tone: 'warn' },
  unavailable: { glyph: '○', label: 'Unavailable', tone: 'muted' },
} as const
const inputClass =
  'min-w-0 rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400'
const decimal = (value: number) => value.toFixed(1)
const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`
const missingReason = (agent: Agent) =>
  agent.reasons.join(' · ') || 'Progression input has not been connected.'

function ProgressionSummary({ value }: { value: Progression }) {
  const { totals } = value
  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Catalog agents" value={num(totals.agents, '')} sub="Historical agent roster" />
        <Stat
          label="Mean Vessel Level"
          value={num(totals.avgVesselLevel, 'No agents have recorded experience.', decimal)}
          sub={`${totals.withExperience} with experience · ${totals.pendingExperience} pending`}
        />
        <Stat
          label="Recorded lifetime EXP"
          value={num(
            totals.withExperience ? totals.totalXp : null,
            'No agents have connected experience.'
          )}
          sub="Sum across agents with connected experience"
        />
        <Stat
          label="Current rating coverage"
          value={`${totals.live + totals.estimated} / ${totals.agents}`}
          sub={`${totals.live} live · ${totals.estimated} estimated · ${totals.unavailable} unavailable`}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card
          title="Permanent growth & the current sky"
          subtitle="Two readings of the same Vessel."
        >
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-semibold text-indigo-200">Vessel Level & lifetime Alchm EXP</dt>
              <dd className="mt-1 text-zinc-400">
                Earned growth stays with the agent. Spending, inactivity and sky changes do not
                lower it.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-sky-200">Base → boost → baseline → current</dt>
              <dd className="mt-1 text-zinc-400">
                Base Overall combines 7 Sacred and 12 Planetary stats. The Vessel Level boost
                establishes Baseline Overall; natal DNA, character and current transits then move
                Current Overall above or below it.
              </dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-relaxed text-amber-200/80">
            Experience currently comes from recorded catalog training where available. Durable live
            chat and cross-site awards are pending integration. Alchemical Seals and spendable ESMS
            remain separate from Vessel Level.
          </p>
        </Card>
        <Card title="Vessel Level distribution" subtitle="Unknown experience has its own band.">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Agent counts by permanent Vessel Level</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Level band</th>
                <th scope="col">Agents</th>
              </tr>
            </thead>
            <tbody>
              {value.distribution.map(band => (
                <tr key={band.band}>
                  <th scope="row" className="w-2/3 py-1.5 pr-3 font-normal text-zinc-300">
                    {band.band}
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/5" aria-hidden="true">
                      <div
                        className={`h-full rounded-full ${band.band === 'Experience pending' ? 'bg-zinc-500' : 'bg-indigo-400'}`}
                        style={{
                          width: `${totals.agents ? (band.count / totals.agents) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </th>
                  <td className="text-right tabular-nums text-zinc-200">
                    {band.count.toLocaleString('en-US')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  )
}

function AgentProgressionTable({
  value,
  initialAgentId,
}: {
  value: Progression
  initialAgentId: string
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [sort, setSort] = useState<Sort>('experience')
  const [selectedId, setSelectedId] = useState<string | null>(initialAgentId || null)
  const inspectionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (selectedId) inspectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [selectedId])
  const selected = value.agents.find(agent => agent.agentId === selectedId)
  const shown = useMemo(() => {
    const query = search.trim().toLowerCase()
    return value.agents
      .filter(
        agent =>
          (!query || `${agent.name} ${agent.agentId}`.toLowerCase().includes(query)) &&
          (status === 'all' ||
            (status === 'pending' ? agent.totalXp === null : agent.progressionStatus === status))
      )
      .sort((a, b) => {
        const difference =
          sort === 'experience'
            ? (b.totalXp ?? -1) - (a.totalXp ?? -1)
            : sort === 'current'
              ? (b.currentOverall ?? -1) - (a.currentOverall ?? -1)
              : 0
        return difference || a.name.localeCompare(b.name)
      })
  }, [value.agents, search, status, sort])

  return (
    <>
      <Card
        title="Agent progression"
        subtitle="All catalog agents, including level 100 and pending experience. Inspect an agent for its 19 stats and EXP evidence."
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-400">
            Find an agent
            <input
              className={inputClass}
              type="search"
              placeholder="Name or agent ID"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-400">
            Rating status
            <select
              className={inputClass}
              value={status}
              onChange={event => setStatus(event.target.value as Status)}
            >
              <option value="all">All agents</option>
              <option value="live">Live</option>
              <option value="estimated">Estimated</option>
              <option value="unavailable">Unavailable</option>
              <option value="pending">Experience pending</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-400">
            Sort by
            <select
              className={inputClass}
              value={sort}
              onChange={event => setSort(event.target.value as Sort)}
            >
              <option value="experience">Lifetime EXP</option>
              <option value="current">Current Overall</option>
              <option value="name">Agent name</option>
            </select>
          </label>
        </div>
        <ScrollTable label="Agent Vessel progression">
          <thead>
            <tr>
              {[
                'Agent',
                'Vessel Level',
                'Lifetime EXP',
                'Base',
                'Level boost',
                'Baseline Overall',
                'Current Overall',
                'Transit delta',
                'Rating / observed',
              ].map(label => (
                <th key={label} className={th} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(agent => {
              const reason = missingReason(agent)
              const badge = STATUS[agent.progressionStatus]
              return (
                <tr
                  key={agent.agentId}
                  className={agent.agentId === selectedId ? 'bg-indigo-500/10' : undefined}
                >
                  <td className={td}>
                    <button
                      type="button"
                      className="text-left font-semibold text-indigo-200 underline decoration-indigo-500/40 underline-offset-4 hover:text-indigo-100"
                      aria-label={`Inspect ${agent.name}`}
                      aria-pressed={agent.agentId === selectedId}
                      onClick={() => setSelectedId(agent.agentId)}
                    >
                      {agent.name}
                    </button>
                    <span className="mt-1 block font-mono text-[10px] text-zinc-500">
                      {agent.agentId}
                    </span>
                  </td>
                  <td className={td}>{num(agent.vesselLevel, reason)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {num(agent.totalXp, reason)}
                    <span className="mt-1 block text-[10px] text-zinc-400">
                      {agent.vesselLevel === 100
                        ? 'Max level · EXP keeps accumulating'
                        : agent.xpToNextLevel !== null
                          ? `${agent.xpToNextLevel.toLocaleString('en-US')} to next level`
                          : 'Experience pending'}
                    </span>
                  </td>
                  <td className={td}>{num(agent.baseOverall, reason, decimal)}</td>
                  <td className={td}>{num(agent.levelBoost, reason, signed)}</td>
                  <td className={td}>{num(agent.trainedOverall, reason, decimal)}</td>
                  <td className={td}>{num(agent.currentOverall, reason, decimal)}</td>
                  <td className={td}>
                    {agent.transitDelta === null ? (
                      <Unknown reason={reason} />
                    ) : (
                      <Badge
                        glyph={agent.transitDelta > 0 ? '↑' : agent.transitDelta < 0 ? '↓' : '→'}
                        label={`${signed(agent.transitDelta)} ${agent.transitDelta > 0 ? 'Rising' : agent.transitDelta < 0 ? 'Falling' : 'Steady'}`}
                        tone={
                          agent.transitDelta > 0 ? 'ok' : agent.transitDelta < 0 ? 'warn' : 'muted'
                        }
                      />
                    )}
                  </td>
                  <td className={td}>
                    <Badge {...badge} title={reason} />
                    <span className="mt-1 block text-[10px] text-zinc-400">
                      {agent.asOf ? (
                        <time dateTime={agent.asOf}>
                          {new Date(agent.asOf).toLocaleString('en-US', {
                            timeZone: 'UTC',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          UTC
                        </time>
                      ) : (
                        'No sky observation'
                      )}
                    </span>
                    {agent.reasons.length > 0 && (
                      <details className="mt-1 max-w-56 text-[10px] text-zinc-400">
                        <summary className="cursor-pointer">Source details</summary>
                        <ul className="mt-1 space-y-1">
                          {agent.reasons.map((message, index) => (
                            <li key={index}>{message}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              )
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-sm text-zinc-400">
                  No agents match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </ScrollTable>
        <p className="mt-3 text-xs text-zinc-400">
          {shown.length} of {value.agents.length} agents shown. Current ratings can change without
          changing permanent growth.
        </p>
      </Card>
      {selected && (
        <div ref={inspectionRef} className="scroll-mt-6">
          <Card
            title={`${selected.name} · Vessel inspection`}
            action={
              <Link
                className="text-xs text-indigo-200 underline"
                href={`/agent/${encodeURIComponent(selected.agentId)}`}
              >
                Open agent profile →
              </Link>
            }
          >
            {selected.totalXp === null || selected.vesselLevel === null ? (
              <div>
                <p className="text-sm text-zinc-400">
                  <Unknown reason={missingReason(selected)} /> Experience pending.{' '}
                  {missingReason(selected)}
                </p>
                {selected.stats && (
                  <div
                    className="mt-4"
                    role="region"
                    aria-label="Recorded stats while experience is pending"
                  >
                    <p className="mb-3 text-xs text-zinc-400">
                      Recorded stats remain available. Baseline and current capability require
                      connected experience.
                    </p>
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {ALL_VESSEL_STAT_KEYS.map(key => (
                        <div className="rounded-lg border border-white/10 p-3" key={key}>
                          <dt className="text-xs capitalize text-zinc-400">
                            {key.replace(/([A-Z])/g, ' $1')}
                          </dt>
                          <dd className="mt-1 tabular-nums">{selected.stats![key].toFixed(1)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            ) : (
              <VesselProgressionDisplay
                key={selected.agentId}
                progression={selected}
                subjectName={selected.name}
                variant="full"
                defaultExpanded
              />
            )}
          </Card>
        </div>
      )}
    </>
  )
}

export function LevelingView({
  data,
  initialAgentId = '',
}: {
  data: LevelingReport
  initialAgentId?: string
}) {
  return (
    <div className="space-y-5">
      <AlertList alerts={data.alerts} />
      <Read section={data.progression}>
        {value => (
          <>
            <ProgressionSummary value={value} />
            <AgentProgressionTable
              key={initialAgentId}
              value={value}
              initialAgentId={initialAgentId}
            />
          </>
        )}
      </Read>
      <Card
        title="Legacy level & EV training"
        subtitle="Historical database fields retained for comparison. These are separate from Vessel Level and lifetime Alchm EXP."
      >
        <Read section={data.legacy}>
          {legacy => (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Stat label="Database agents" value={num(legacy.totals.agents, '')} />
                <Stat
                  label="Mean legacy level"
                  value={num(legacy.totals.avgLevel, 'No legacy levels recorded.', decimal)}
                  sub={`${legacy.totals.maxedLevel100} at legacy level 100`}
                />
                <Stat
                  label="Agents with recorded EVs"
                  value={num(legacy.totals.agentsWithEvs, '')}
                  sub="EV balance above zero; not an active training queue"
                />
                <Stat
                  label="Total recorded EVs"
                  value={num(legacy.totals.totalEvsTrained, '')}
                  sub={`${legacy.totals.evTotalCap} EV cap per agent`}
                />
              </div>
              <p className="my-3 text-xs text-zinc-400">
                Top {legacy.inTraining.length} agents by recorded EVs.
              </p>
              <ScrollTable label="Legacy EV training">
                <thead>
                  <tr>
                    {['Agent', 'Legacy level', 'Recorded EVs', 'Last training partner'].map(
                      label => (
                        <th className={th} key={label} scope="col">
                          {label}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {legacy.inTraining.map(agent => (
                    <tr key={agent.agentId}>
                      <td className={td}>{agent.name}</td>
                      <td className={td}>{agent.level}</td>
                      <td className={td}>
                        {agent.evTotal} / {legacy.totals.evTotalCap}
                      </td>
                      <td className={td}>{agent.lastTrainingPartner ?? 'None recorded'}</td>
                    </tr>
                  ))}
                  {legacy.inTraining.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-sm text-zinc-400">
                        No agents have recorded EVs.
                      </td>
                    </tr>
                  )}
                </tbody>
              </ScrollTable>
            </>
          )}
        </Read>
      </Card>
    </div>
  )
}

export default function CosmicLevelingPanel({
  leveling,
  loading,
  initialAgentId = '',
}: {
  leveling: LevelingReport | null
  loading: boolean
  initialAgentId?: string
}) {
  if (loading && !leveling)
    return (
      <p role="status" className="text-sm text-zinc-400">
        Loading Vessel progression…
      </p>
    )
  if (!leveling)
    return <p className="text-sm text-zinc-400">Vessel progression is currently unavailable.</p>
  return <LevelingView data={leveling} initialAgentId={initialAgentId} />
}
