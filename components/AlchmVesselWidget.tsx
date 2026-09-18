'use client'

import Link from 'next/link'
import {
  Box,
  Droplets,
  Flame,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Wind,
} from 'lucide-react'
import type {
  AlchmVesselState,
  EsmsTuple,
  VesselSourceKey,
  VesselStreamKey,
} from '@/lib/vessel/contract'
import { useAlchmVessel, type VesselSyncState } from '@/lib/vessel/useAlchmVessel'

const TOKENS = [
  {
    key: 'spirit',
    label: 'Spirit',
    short: 'Sp',
    element: 'Fire',
    icon: Flame,
    text: 'text-amber-300',
    bar: 'bg-amber-400',
  },
  {
    key: 'essence',
    label: 'Essence',
    short: 'Es',
    element: 'Water',
    icon: Droplets,
    text: 'text-sky-300',
    bar: 'bg-sky-400',
  },
  {
    key: 'matter',
    label: 'Matter',
    short: 'Ma',
    element: 'Earth',
    icon: Box,
    text: 'text-emerald-300',
    bar: 'bg-emerald-400',
  },
  {
    key: 'substance',
    label: 'Substance',
    short: 'Su',
    element: 'Air',
    icon: Wind,
    text: 'text-violet-300',
    bar: 'bg-violet-400',
  },
] as const

const STREAMS: Array<{ key: VesselStreamKey; label: string; tag: string; tone: string }> = [
  {
    key: 'jingDuels',
    label: 'Jing & 14 Pillars',
    tag: 'Jing',
    tone: 'border-rose-400/30 text-rose-300',
  },
  {
    key: 'staking',
    label: 'Yields & Streaks',
    tag: 'StarVault',
    tone: 'border-emerald-400/30 text-emerald-300',
  },
  {
    key: 'pentaclesMelee',
    label: 'Pentacles Arena',
    tag: 'Pentacles',
    tone: 'border-yellow-300/30 text-yellow-200',
  },
  {
    key: 'kitchenAchievements',
    label: 'Kitchen Achievements',
    tag: 'Kitchen',
    tone: 'border-amber-400/30 text-amber-300',
  },
]

const SOURCE_LABEL: Record<VesselSourceKey, string> = {
  kitchenLedger: 'Kitchen ledger',
  agentsArena: 'Agents arena',
  spacetimedb: 'Pentacles (SpacetimeDB)',
  priceIndex: 'Price index',
  onchain: 'On-chain (Solana Token-2022)',
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 })
const stat = (n: number | null | undefined) => (n === null || n === undefined ? '—' : fmt(n))

function EsmsRow({ esms }: { esms: EsmsTuple }) {
  return (
    <div className="grid grid-cols-4 gap-1 font-mono text-[11px]">
      {TOKENS.map((t, i) => (
        <span
          key={t.key}
          className={esms[i] > 0 ? t.text : 'text-zinc-600'}
          title={`${t.label} ${esms[i]}`}
        >
          {t.short} {fmt(esms[i])}
        </span>
      ))}
    </div>
  )
}

function streamDetail(vessel: AlchmVesselState, key: VesselStreamKey): string {
  const s = vessel.streams
  switch (key) {
    case 'jingDuels':
      return `${stat(s.jingDuels.agentDuelsRecorded)} agent rounds · ${stat(s.jingDuels.arenaWins)}/${stat(s.jingDuels.arenaResolved)} arena wins`
    case 'staking':
      return `${stat(s.staking.streakDays)}-day streak · StarVault accrual not aggregated yet`
    case 'pentaclesMelee':
      return `${stat(s.pentaclesMelee.arenaTokens)} arena tokens · ${stat(s.pentaclesMelee.wordWins)} word wins`
    case 'kitchenAchievements':
      return `${stat(s.kitchenAchievements.achievementsUnlocked)} achievements · ${stat(s.kitchenAchievements.questsCompleted)} quests`
  }
}

function SyncBadge({ sync, onRefresh }: { sync: VesselSyncState; onRefresh: () => void }) {
  const label =
    sync === 'live'
      ? 'Live'
      : sync === 'reconnecting'
        ? 'Reconnecting · cached'
        : sync === 'error'
          ? 'Unavailable'
          : 'Syncing'
  const tone =
    sync === 'live'
      ? 'text-emerald-300 border-emerald-400/30'
      : sync === 'reconnecting'
        ? 'text-amber-300 border-amber-400/40 animate-pulse'
        : sync === 'error'
          ? 'text-rose-300 border-rose-400/30'
          : 'text-zinc-400 border-zinc-700'
  return (
    <button
      type="button"
      onClick={onRefresh}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}
      title="Refresh the Vessel"
    >
      {sync === 'loading' ? (
        <Loader2 size={10} className="animate-spin" />
      ) : (
        <RefreshCw size={10} />
      )}
      {label}
    </button>
  )
}

export function AlchmVesselWidget({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const { vessel, sync, refresh } = useAlchmVessel()

  if (sync === 'signed-out') return null

  const total = vessel
    ? vessel.balances.spirit +
      vessel.balances.essence +
      vessel.balances.matter +
      vessel.balances.substance
    : 0

  if (variant === 'compact') {
    return (
      <div
        className={`rounded-lg border p-2 ${sync === 'reconnecting' ? 'border-amber-400/40' : 'border-zinc-800'}`}
        aria-label="Alchm Vessel summary"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold tracking-wider text-zinc-300">
            ALCHM VESSEL
          </span>
          <SyncBadge sync={sync} onRefresh={() => void refresh()} />
        </div>
        {!vessel ? (
          <div className="text-[11px] text-zinc-500">
            {sync === 'error' ? 'Vessel unavailable right now.' : 'Gathering streams…'}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
              {TOKENS.map(t => (
                <div
                  key={t.key}
                  className={t.bar}
                  style={{ width: total > 0 ? `${(vessel.balances[t.key] / total) * 100}%` : '0%' }}
                />
              ))}
            </div>
            {STREAMS.map(s => (
              <div key={s.key} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-zinc-400">{s.label}</span>
                <span className="font-mono text-zinc-200">
                  {fmt(vessel.streams[s.key].ledgerEsms.reduce((a, b) => a + b, 0))}
                </span>
              </div>
            ))}
            <Link
              href="/profile#alchm-vessel"
              className="block text-center text-[11px] text-indigo-300 hover:text-indigo-200 pt-1"
            >
              Open the Vessel
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <section
      id="alchm-vessel"
      aria-label="The Alchm Vessel"
      className={`my-8 rounded-2xl border bg-black/40 p-5 text-white backdrop-blur ${
        sync === 'reconnecting'
          ? 'border-amber-400/40 shadow-[0_0_28px_rgba(251,191,36,0.12)]'
          : 'border-white/10'
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Sparkles size={18} className="text-amber-300" /> The Alchm Vessel
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            One elemental treasury across Agents, the Kitchen, and the Pentacles arena.
          </p>
        </div>
        <SyncBadge sync={sync} onRefresh={() => void refresh()} />
      </header>

      {!vessel && (
        <div className="h-32 rounded-xl bg-white/[0.03] flex items-center justify-center text-xs text-zinc-500">
          {sync === 'error'
            ? 'The Vessel could not be assembled right now.'
            : 'Gathering elemental streams…'}
        </div>
      )}

      {vessel && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TOKENS.map(t => {
              const Icon = t.icon
              const amount = vessel.balances[t.key]
              return (
                <div
                  key={t.key}
                  className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div
                    aria-hidden
                    className={`absolute inset-x-0 bottom-0 ${t.bar} opacity-10 transition-all duration-700`}
                    style={{ height: total > 0 ? `${(amount / total) * 100}%` : '0%' }}
                  />
                  <div className="relative">
                    <div className={`flex items-center gap-1.5 text-xs ${t.text}`}>
                      <Icon size={14} aria-hidden /> {t.label}
                      <span className="text-zinc-500">· {t.element}</span>
                    </div>
                    <div className="font-mono text-lg mt-1">{fmt(amount)}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
            <span className="rounded-full border border-white/10 px-3 py-1">
              Total {fmt(total)} ESMS
              {vessel.balances.totalUsdEquivalent !== null
                ? ` ≈ $${vessel.balances.totalUsdEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                : ' · no USD rail published'}
            </span>
            {vessel.walletAddress && (
              <span
                className="rounded-full border border-white/10 px-3 py-1 font-mono"
                title={vessel.walletAddress}
              >
                <ShieldCheck size={11} className="inline mr-1 text-emerald-300" />
                {vessel.walletAddress.slice(0, 4)}…{vessel.walletAddress.slice(-4)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {STREAMS.map(s => (
              <div key={s.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${s.tone}`}
                  >
                    {s.tag}
                  </span>
                </div>
                <EsmsRow esms={vessel.streams[s.key].ledgerEsms} />
                <p className="mt-2 text-[11px] text-zinc-500">{streamDetail(vessel, s.key)}</p>
              </div>
            ))}
          </div>

          {vessel.streams.jingDuels.recentClashes.length > 0 && (
            <div>
              <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-400 mb-2">
                <Swords size={12} /> Recent clashes
              </h3>
              <ul className="divide-y divide-white/5 text-xs">
                {vessel.streams.jingDuels.recentClashes.slice(0, 5).map(c => (
                  <li key={c.duelId} className="flex items-center gap-3 py-1.5">
                    <span className="rounded border border-white/10 px-1.5 text-[10px] uppercase text-zinc-400">
                      {c.source}
                    </span>
                    <span className="flex-1 truncate text-zinc-300">
                      {c.kind} · {c.opponent}
                    </span>
                    <span
                      className={
                        c.won === true
                          ? 'text-emerald-300'
                          : c.won === false
                            ? 'text-rose-300'
                            : 'text-zinc-500'
                      }
                    >
                      {c.won === true ? (
                        <>
                          <Trophy size={11} className="inline" /> won
                        </>
                      ) : c.won === false ? (
                        'lost'
                      ) : (
                        '—'
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details className="text-[11px] text-zinc-500">
            <summary className="cursor-pointer select-none">Sources</summary>
            <ul className="mt-2 space-y-1">
              {(Object.keys(vessel.sources) as VesselSourceKey[]).map(key => (
                <li key={key} className="flex gap-2">
                  <span className={vessel.sources[key].ok ? 'text-emerald-400' : 'text-rose-400'}>
                    ●
                  </span>
                  <span className="text-zinc-300">{SOURCE_LABEL[key]}</span>
                  {vessel.sources[key].detail && (
                    <span className="truncate">{vessel.sources[key].detail}</span>
                  )}
                </li>
              ))}
              <li>Synced {new Date(vessel.lastSyncedAt).toLocaleTimeString()}</li>
            </ul>
          </details>
        </div>
      )}
    </section>
  )
}
