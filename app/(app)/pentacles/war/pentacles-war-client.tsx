'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  Bot,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Crown,
  FlaskConical,
  Radio,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
  Target,
  Users,
} from 'lucide-react'
import { usePentaclesWarState } from '@/lib/spacetime/hooks/usePentaclesWarState'

const FACTIONS = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
] as const

const FACTION_TONE: Record<string, string> = {
  Sun: '#fbbf24',
  Moon: '#c4b5fd',
  Mercury: '#67e8f9',
  Venus: '#f9a8d4',
  Mars: '#fb7185',
  Jupiter: '#a78bfa',
  Saturn: '#94a3b8',
  Uranus: '#2dd4bf',
  Neptune: '#60a5fa',
  Pluto: '#c084fc',
}

interface ControllerIntent {
  intentId: string
  action: string
  agentKey: string
  rationale: string
}

interface ControllerStatus {
  enabled: boolean
  active: boolean
  paused: boolean
  dryRun: boolean
  writable: boolean
  distributedLock: boolean
  intervalMs: number
  lastRun: null | {
    finishedAt: string
    rosterSeen: number
    executed: number
    failed: number
    intents: ControllerIntent[]
  }
}

function zoneName(zoneId: number): string {
  if (zoneId < 5) return `House ${['I', 'II', 'III', 'IV', 'V'][zoneId]}`
  if (zoneId < 10) return `Spire ${['I', 'II', 'III', 'IV', 'V'][zoneId - 5]}`
  return 'The Crown'
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1_000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3_600)}h ago`
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  )
}

export default function PentaclesWarClient() {
  const live = usePentaclesWarState()
  const [controller, setController] = useState<ControllerStatus | null>(null)
  const [operatorError, setOperatorError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const refreshController = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/pentacles-agents', { cache: 'no-store' })
      const payload = (await response.json()) as {
        success?: boolean
        scheduler?: ControllerStatus
        error?: string
      }
      if (!response.ok || !payload.scheduler)
        throw new Error(payload.error || 'Controller unavailable')
      setController(payload.scheduler)
      setOperatorError(null)
    } catch (error) {
      setOperatorError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  useEffect(() => {
    void refreshController()
    const timer = setInterval(() => void refreshController(), 10_000)
    return () => clearInterval(timer)
  }, [refreshController])

  const operate = async (action: 'control' | 'evaluate' | 'preview', body = {}) => {
    setPending(action)
    try {
      const response = await fetch('/api/admin/pentacles-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      })
      const payload = (await response.json()) as {
        success?: boolean
        scheduler?: ControllerStatus
        error?: string
      }
      if (!response.ok) throw new Error(payload.error || 'Operator action failed')
      if (payload.scheduler) setController(payload.scheduler)
      await refreshController()
    } catch (error) {
      setOperatorError(error instanceof Error ? error.message : String(error))
    } finally {
      setPending(null)
    }
  }

  const standings = useMemo(
    () =>
      FACTIONS.map(faction => {
        const zones = live.zones.filter(zone => zone.owner === faction)
        return {
          faction,
          zones: zones.length,
          agents: live.agents.filter(agent => agent.faction === faction).length,
          control: zones.reduce((total, zone) => total + Math.abs(zone.control), 0),
        }
      }).sort((left, right) => right.zones - left.zones || right.control - left.control),
    [live.agents, live.zones]
  )

  const activeTables = live.meleeTables.filter(table => table.state !== 'Resolved')
  const pendingAgentTurns = activeTables.reduce(
    (total, table) => total + table.pendingAgentTurns,
    0
  )
  const recentTables = live.meleeTables.slice(0, 5)
  const recentBattles = live.battles.slice(0, 6)
  const intents = controller?.lastRun?.intents.slice(0, 8) ?? []

  return (
    <main className="min-h-screen bg-[#060810] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(91,33,182,0.16),transparent_34%),radial-gradient(circle_at_86%_18%,rgba(14,116,144,0.13),transparent_30%)]" />
      <div className="relative mx-auto max-w-[1500px] px-4 pb-20 pt-5 sm:px-7 lg:px-10">
        <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-2 text-sm">
            <Link className="text-slate-500 transition hover:text-slate-200" href="/pentacles">
              Pentacles
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-700" />
            <span className="text-amber-300">War Table Command</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/pentacles"
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-white/20 hover:text-white"
            >
              Sky Vaults
            </Link>
            <Link
              href="/pentacles/portfolio"
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-white/20 hover:text-white"
            >
              Portfolio
            </Link>
          </div>
        </nav>

        <header className="grid gap-7 py-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/80">
              <Crown className="h-4 w-4" /> Territorial intelligence
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
              The War Table is live.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
              A 2–6 faction, 12-trick zone melee. Pentacles referees every legal move; ASOL
              synchronizes agents, scores intent, and executes only owner-authorized actions.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <span
              className={`h-2.5 w-2.5 rounded-full ${live.status === 'connected' ? 'bg-emerald-400 shadow-[0_0_14px_#34d399]' : 'bg-amber-400'}`}
            />
            <div>
              <p className="text-xs font-medium text-slate-200">SpacetimeDB {live.status}</p>
              <p className="text-[11px] text-slate-500">
                {live.isLive ? 'Authoritative tables streaming' : 'Waiting for gameplay state'}
              </p>
            </div>
          </div>
        </header>

        {(live.error || operatorError) && (
          <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-100/80">
            {live.error || `Operator controls: ${operatorError}`}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Claimed zones"
            value={live.zones.filter(zone => zone.owner).length}
            detail="of 11 territories"
          />
          <Metric
            label="ASOL agents"
            value={live.agents.length}
            detail={`${live.players.length} total seekers`}
          />
          <Metric
            label="Active tables"
            value={activeTables.length}
            detail={`${live.meleeTables.length} recorded rounds`}
          />
          <Metric
            label="Battle ledger"
            value={live.battles.length}
            detail="authoritative outcomes"
          />
          <Metric
            label="Controller"
            value={controller?.paused ? 'PAUSED' : controller?.dryRun ? 'DRY' : 'ARMED'}
            detail={
              controller?.lastRun
                ? `last sweep ${timeAgo(controller.lastRun.finishedAt)}`
                : 'awaiting status'
            }
          />
        </section>

        <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-7">
            <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e18]/90">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-violet-300" />
                  <div>
                    <h2 className="font-medium">Faction standings</h2>
                    <p className="text-xs text-slate-500">
                      Zone flags, committed agents, and held control
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
                  Live
                </span>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {standings.map((standing, index) => (
                  <div
                    key={standing.faction}
                    className="grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 px-5 py-3.5"
                  >
                    <span className="font-mono text-xs text-slate-600">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="flex items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: FACTION_TONE[standing.faction] }}
                      />
                      <span className="text-sm font-medium">{standing.faction}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-slate-200">{standing.zones}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-600">zones</p>
                    </div>
                    <div className="w-20 text-right">
                      <p className="font-mono text-sm text-slate-400">{standing.agents}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-600">agents</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0b0e18]/90 p-5">
              <div className="mb-5 flex items-center gap-3">
                <Target className="h-5 w-5 text-cyan-300" />
                <div>
                  <h2 className="font-medium">Territorial field</h2>
                  <p className="text-xs text-slate-500">Five Houses, five Spires, and the Crown</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {live.zones.map(zone => (
                  <article
                    key={zone.zoneId}
                    className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 p-4"
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-px"
                      style={{ background: zone.owner ? FACTION_TONE[zone.owner] : '#334155' }}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                          {zone.kind}
                        </p>
                        <h3 className="mt-1 text-sm font-medium">{zoneName(zone.zoneId)}</h3>
                      </div>
                      {zone.inFlux && <Sparkles className="h-4 w-4 text-amber-300" />}
                    </div>
                    <div className="mt-5 flex items-end justify-between">
                      <div>
                        <p
                          className="text-xs"
                          style={{ color: zone.owner ? FACTION_TONE[zone.owner] : '#64748b' }}
                        >
                          {zone.owner ?? 'Unclaimed'}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-600">
                          {zone.claimedStars} claimed stars
                        </p>
                      </div>
                      <span className="font-mono text-sm text-slate-400">
                        {zone.control > 0 ? '+' : ''}
                        {zone.control}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0b0e18]/90 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Swords className="h-5 w-5 text-rose-300" />
                  <div>
                    <h2 className="font-medium">War Tables</h2>
                    <p className="text-xs text-slate-500">12-trick progress and seated champions</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {recentTables.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-600">
                    No War Table has mustered in this subscription yet.
                  </p>
                ) : (
                  recentTables.map(table => (
                    <article
                      key={table.tableId}
                      className="rounded-2xl border border-white/[0.08] bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium">{zoneName(table.zoneId)}</h3>
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                              {table.state}
                            </span>
                            {table.pendingAgentTurns > 0 && (
                              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
                                ASOL choosing
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            Round {table.roundIndex} · {table.trumpSuit} trump
                          </p>
                        </div>
                        <div className="text-right font-mono text-xs text-slate-400">
                          <p>{table.tricks}/12 tricks</p>
                          <p className="mt-1 text-slate-600">{table.cardsRemaining} cards remain</p>
                        </div>
                      </div>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                          style={{ width: `${Math.min(100, (table.tricks / 12) * 100)}%` }}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {table.seats.map(seat => (
                          <span
                            key={seat.seatId}
                            className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-slate-400"
                          >
                            <span style={{ color: FACTION_TONE[seat.faction] }}>
                              {seat.faction}
                            </span>{' '}
                            · {seat.occupant} · {seat.score} pts
                          </span>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0b0e18]/90 p-5">
              <div className="mb-5 flex items-center gap-3">
                <Activity className="h-5 w-5 text-emerald-300" />
                <div>
                  <h2 className="font-medium">Battle outcomes</h2>
                  <p className="text-xs text-slate-500">
                    Individual agent raids resolved by Pentacles
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {recentBattles.map(battle => (
                  <article
                    key={battle.battleId}
                    className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{battle.attacker}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Star HIP {battle.starId} · {timeAgo(battle.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${battle.won ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}
                      >
                        {battle.won ? 'claimed' : 'repelled'}
                      </span>
                    </div>
                    <p className="mt-4 font-mono text-xs text-slate-500">
                      {battle.attackerScore} ATK / {battle.defenseRating} DEF
                    </p>
                  </article>
                ))}
                {recentBattles.length === 0 && (
                  <p className="text-sm text-slate-600">No battle outcomes streamed yet.</p>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-7">
            <section className="rounded-3xl border border-amber-300/15 bg-gradient-to-b from-amber-300/[0.055] to-[#0b0e18] p-5 xl:sticky xl:top-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-amber-300" />
                  <div>
                    <h2 className="font-medium">ASOL controller</h2>
                    <p className="text-xs text-slate-500">10-second deterministic sweep</p>
                  </div>
                </div>
                <Radio
                  className={`h-4 w-4 ${controller?.active ? 'text-emerald-300' : 'text-slate-700'}`}
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!controller || Boolean(pending)}
                  onClick={() => void operate('control', { paused: !controller?.paused })}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-slate-300 transition hover:bg-white/[0.07] disabled:opacity-40"
                >
                  {controller?.paused ? (
                    <CirclePlay className="h-4 w-4" />
                  ) : (
                    <CirclePause className="h-4 w-4" />
                  )}
                  {controller?.paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  disabled={!controller || Boolean(pending)}
                  onClick={() => void operate('control', { dryRun: !controller?.dryRun })}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-slate-300 transition hover:bg-white/[0.07] disabled:opacity-40"
                >
                  <FlaskConical className="h-4 w-4" />
                  {controller?.dryRun ? 'Arm writes' : 'Dry run'}
                </button>
                <button
                  type="button"
                  disabled={!controller || Boolean(pending)}
                  onClick={() => void operate('preview')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-slate-300 transition hover:bg-white/[0.07] disabled:opacity-40"
                >
                  <Target className="h-4 w-4" /> Preview
                </button>
                <button
                  type="button"
                  disabled={!controller || Boolean(pending)}
                  onClick={() => void operate('evaluate')}
                  className="flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-3 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-200 disabled:opacity-40"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${pending === 'evaluate' ? 'animate-spin' : ''}`}
                  />{' '}
                  Sweep now
                </button>
              </div>

              <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Worker</span>
                  <span className="text-slate-300">
                    {controller?.active ? 'active' : 'offline'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Pending turns</span>
                  <span className={pendingAgentTurns > 0 ? 'text-amber-300' : 'text-slate-300'}>
                    {pendingAgentTurns}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Writes</span>
                  <span className={controller?.writable ? 'text-emerald-300' : 'text-amber-300'}>
                    {controller?.writable ? 'credentialed' : 'locked'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Worker lock</span>
                  <span
                    className={controller?.distributedLock ? 'text-emerald-300' : 'text-amber-300'}
                  >
                    {controller ? (controller.distributedLock ? 'Redis' : 'local only') : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Mode</span>
                  <span className="text-slate-300">{controller?.dryRun ? 'dry run' : 'live'}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Roster</span>
                  <span className="text-slate-300">{controller?.lastRun?.rosterSeen ?? '—'}</span>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Latest intent
                  </p>
                  <span className="text-[10px] text-slate-700">{intents.length} shown</span>
                </div>
                <div className="space-y-2">
                  {intents.map(intent => (
                    <article
                      key={intent.intentId}
                      className="rounded-xl border border-white/[0.07] bg-black/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-slate-300">
                          {intent.agentKey}
                        </span>
                        <span className="shrink-0 rounded-full bg-violet-400/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-violet-300">
                          {intent.action.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] leading-4 text-slate-600">
                        {intent.rationale}
                      </p>
                    </article>
                  ))}
                  {intents.length === 0 && (
                    <p className="text-xs leading-5 text-slate-600">
                      No controller intent is available yet. Preview a sweep after the backend is
                      connected.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0b0e18]/90 p-5">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-cyan-300" />
                <div>
                  <h2 className="font-medium">Agent roster</h2>
                  <p className="text-xs text-slate-500">Public Pentacles NPC charts</p>
                </div>
              </div>
              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {live.agents.map(agent => (
                  <div
                    key={agent.identity}
                    className="flex items-center justify-between rounded-xl border border-white/[0.06] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs text-slate-300">{agent.handle}</p>
                      <p
                        className="mt-0.5 text-[10px]"
                        style={{ color: FACTION_TONE[agent.faction] ?? '#64748b' }}
                      >
                        {agent.faction}
                      </p>
                    </div>
                    <div className="text-right font-mono text-[10px] text-slate-600">
                      <p>{agent.cardCount} cards</p>
                      <p>{agent.activeCardCount} active</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
