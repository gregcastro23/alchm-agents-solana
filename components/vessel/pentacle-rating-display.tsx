'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Flame, Shield, Sparkles, Swords, Zap, Crown, Compass, Lock, RefreshCw } from 'lucide-react'
import {
  CANONICAL_SEAL_CATALOG,
  SACRED_STAT_KEYS,
  SEAL_ESMS_GATES,
  SEAL_STAT_GATES,
  SEAL_TIER_MULTIPLIERS,
  type AlchemicalSeal,
  type ResonanceSurgeState,
  type SacredStatKey,
  type SealTier,
  type VesselArchetype,
} from '@/lib/agents/rating-contract'
import {
  CELESTIAL_MIN_NATAL_AFFINITY,
  type RatedVesselPayload,
  type SealProgress,
  type ZoneSynergy,
} from '@/lib/agents/rating'
import { VESSEL_RELIC_LABELS } from '@/lib/agents/vessel-appearance-manifest'
import { cn } from '@/lib/utils'

export const SEAL_TIER_STYLES: Record<
  SealTier,
  { badge: string; border: string; text: string; dot: string }
> = {
  Copper: {
    badge: 'border-amber-700/50 bg-amber-950/50 text-amber-300',
    border: 'border-amber-700/40',
    text: 'text-amber-300',
    dot: 'bg-amber-500',
  },
  Silver: {
    badge: 'border-slate-300/45 bg-slate-800/60 text-slate-100',
    border: 'border-slate-300/35',
    text: 'text-slate-200',
    dot: 'bg-slate-200',
  },
  Gold: {
    badge:
      'border-yellow-400/55 bg-yellow-500/15 text-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.18)]',
    border: 'border-yellow-400/45',
    text: 'text-yellow-200',
    dot: 'bg-yellow-400',
  },
  Astral: {
    badge:
      'border-violet-400/60 bg-violet-500/20 text-violet-100 shadow-[0_0_14px_rgba(167,139,250,0.25)]',
    border: 'border-violet-400/50',
    text: 'text-violet-200',
    dot: 'bg-violet-400',
  },
  Celestial: {
    badge:
      'border-cyan-300/70 bg-gradient-to-r from-amber-500/20 via-violet-500/25 to-cyan-500/20 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.28)]',
    border: 'border-cyan-300/55',
    text: 'text-cyan-200',
    dot: 'bg-cyan-300',
  },
}

const TIER_RANK: Record<SealTier, number> = {
  Copper: 1,
  Silver: 2,
  Gold: 3,
  Astral: 4,
  Celestial: 5,
}

export function pickHighestSeal(seals: readonly AlchemicalSeal[]): AlchemicalSeal | null {
  if (!seals.length) return null
  return [...seals].sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier])[0] ?? null
}

export function formatRelicLabel(relic?: string | null): string | null {
  if (!relic) return null
  return (
    VESSEL_RELIC_LABELS[relic] ??
    relic
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  )
}

export interface VesselRatingRibbonProps {
  ovr: number
  archetype: VesselArchetype
  seals?: readonly AlchemicalSeal[]
  surge?: ResonanceSurgeState | null
  compact?: boolean
  className?: string
}

export function VesselRatingRibbon({
  ovr,
  archetype,
  seals = [],
  surge = null,
  compact = false,
  className,
}: VesselRatingRibbonProps) {
  const topSeal = pickHighestSeal(seals)

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md border border-amber-400/45 bg-amber-400/12 font-mono font-bold text-amber-200',
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
        )}
        title={`Pentacle Vessel Rating: ${ovr} OVR (25–99 OWA scale)`}
      >
        <span className="text-[9px] uppercase tracking-wider text-amber-300/80">PVR</span>
        <span>{ovr}</span>
      </span>

      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md border border-violet-400/30 bg-violet-500/10 font-medium text-violet-100',
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
        )}
        title={`Archetype Signature: ${archetype.primary} + ${archetype.secondary}`}
      >
        <Sparkles className="h-3 w-3 text-violet-300 shrink-0" />
        <span className="truncate max-w-[165px]">{archetype.title}</span>
      </span>

      {topSeal && (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md border font-mono font-semibold',
            SEAL_TIER_STYLES[topSeal.tier].badge,
            compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
          )}
          title={`${topSeal.tier} ${topSeal.name} (${topSeal.multiplier.toFixed(2)}x Zone Contest Multiplier)`}
        >
          <Shield className="h-3 w-3 shrink-0" />
          <span>
            {topSeal.tier} · {topSeal.name}
          </span>
        </span>
      )}

      {surge?.active && (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md border font-mono font-semibold uppercase',
            surge.surgeType === 'equilibrium'
              ? 'border-cyan-300/60 bg-cyan-500/15 text-cyan-200'
              : surge.surgeType === 'inferno'
                ? 'border-orange-400/60 bg-orange-500/15 text-orange-200'
                : 'border-sky-400/60 bg-sky-500/15 text-sky-200',
            compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
          )}
          title={`Resonance Surge Active (${surge.meter}/100)`}
        >
          <Flame className="h-3 w-3 shrink-0" />
          <span>{surge.surgeType}</span>
        </span>
      )}
    </div>
  )
}

export function AlchemicalSealsCodex({
  sealProgress,
  esmsSource,
}: {
  sealProgress: readonly SealProgress[]
  esmsSource?: string
}) {
  const earnedCount = sealProgress.filter(s => s.tier !== null).length

  return (
    <section className="rounded-xl border border-amber-400/20 bg-[#0d1020]/90 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-300" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-amber-200">
              7 Alchemical Seals
            </h3>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Dual-gated by mean-aligned Sacred 7 rating and ESMS reserves ({esmsSource ?? 'ledger'}).
          </p>
        </div>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-mono text-xs font-semibold text-amber-200">
          {earnedCount} / {sealProgress.length} Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sealProgress.map(entry => {
          const catalog = CANONICAL_SEAL_CATALOG[entry.stat]
          const style = entry.tier ? SEAL_TIER_STYLES[entry.tier] : null
          const multiplier = entry.tier ? SEAL_TIER_MULTIPLIERS[entry.tier] : 1.0
          const nextStatGate = entry.nextTier ? SEAL_STAT_GATES[entry.nextTier] : null
          const nextEsmsGate = entry.nextTier ? SEAL_ESMS_GATES[entry.nextTier] : null

          return (
            <div
              key={entry.id}
              className={cn(
                'rounded-lg border p-3.5 transition-colors',
                style ? `${style.border} bg-white/[0.03]` : 'border-white/10 bg-black/30 opacity-85'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-zinc-100">{entry.name}</span>
                    <span className="font-mono text-[10px] uppercase text-zinc-400">
                      ({entry.stat})
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-400 leading-snug">
                    {catalog?.description}
                  </p>
                </div>

                {entry.tier && style ? (
                  <span
                    className={cn(
                      'shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase',
                      style.badge
                    )}
                  >
                    {entry.tier} · {multiplier.toFixed(2)}x
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                    <Lock className="h-2.5 w-2.5" />
                    Locked
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-black/40 p-2 font-mono text-[10px]">
                <div>
                  <div className="text-zinc-500">Aligned Stat</div>
                  <div className="text-zinc-200 font-semibold">
                    {entry.alignedRating.toFixed(1)}
                    {nextStatGate !== null && (
                      <span className="text-zinc-500"> / {nextStatGate}</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 capitalize">{entry.token}</div>
                  <div className="text-zinc-200 font-semibold">
                    {entry.balance.toFixed(1)}
                    {nextEsmsGate !== null && (
                      <span className="text-zinc-500"> / {nextEsmsGate}</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Natal Bodies</div>
                  <div className="text-zinc-200 font-semibold">
                    {entry.natalAffinity !== null
                      ? `${entry.natalAffinity} / ${CELESTIAL_MIN_NATAL_AFFINITY}`
                      : '—'}
                  </div>
                </div>
              </div>

              {entry.nextTier && entry.blockedBy.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] text-zinc-400">
                  <span>
                    Next: <strong className="text-zinc-200">{entry.nextTier}</strong>
                  </span>
                  <span className="font-mono text-amber-300/90">
                    Needs:{' '}
                    {entry.blockedBy
                      .map(b =>
                        b === 'stat'
                          ? `${entry.stat} ≥ ${nextStatGate}`
                          : b === 'esms'
                            ? `${entry.token} ≥ ${nextEsmsGate}`
                            : `${CELESTIAL_MIN_NATAL_AFFINITY}+ natal ${entry.token} bodies`
                      )
                      .join(' · ')}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function ResonanceSurgePanel({
  surge,
  skySource,
  degradedReason,
}: {
  surge: ResonanceSurgeState | null
  skySource?: string | null
  degradedReason?: string
}) {
  if (!surge) {
    return (
      <section className="rounded-xl border border-white/10 bg-[#0d1020]/90 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-zinc-400" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-300">
              Resonance Surge Telemetry
            </h3>
          </div>
          <span className="font-mono text-[10px] uppercase text-amber-300">Sky Feed Offline</span>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          Live ephemeris surge is momentarily unavailable ({degradedReason ?? 'no sky telemetry'}).
          Static natal OVR and Seals remain authoritative.
        </p>
      </section>
    )
  }

  const boostEntries = Object.entries(surge.statBoosts) as Array<[SacredStatKey, number]>

  return (
    <section
      className={cn(
        'rounded-xl border p-5 space-y-4',
        surge.active
          ? 'border-orange-400/45 bg-gradient-to-br from-[#1b1124]/95 to-[#0d1020]/95 shadow-[0_0_25px_rgba(249,115,22,0.12)]'
          : 'border-violet-400/20 bg-[#0d1020]/90'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Flame
              className={cn('h-4 w-4', surge.active ? 'text-orange-400' : 'text-violet-300')}
            />
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-100">
              Live Resonance Surge
            </h3>
            {skySource && (
              <span
                className={cn(
                  'rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase',
                  skySource === 'swiss-ephemeris'
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-400/35 bg-amber-500/10 text-amber-200'
                )}
              >
                {skySource === 'swiss-ephemeris' ? 'Swiss Ephemeris · Live' : 'VSOP87 Approx'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            Ignites at meter ≥ 70 from live sky Heat, Reactivity &amp; natal aspect alignment.
          </p>
        </div>

        <span
          className={cn(
            'rounded-full border px-3 py-1 font-mono text-xs font-bold uppercase',
            surge.active
              ? 'border-orange-400/60 bg-orange-500/20 text-orange-200'
              : 'border-white/15 bg-white/5 text-zinc-300'
          )}
        >
          {surge.active ? `IGNITED · ${surge.surgeType}` : `Dormant · ${surge.surgeType}`}
        </span>
      </div>

      {/* Surge Meter Bar with 70 Ignition Marker */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-zinc-400">Surge Meter</span>
          <span className="font-bold text-zinc-100">{surge.meter} / 100</span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full border border-white/10 bg-black/50">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              surge.active
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-cyan-400'
                : 'bg-gradient-to-r from-violet-600 to-indigo-400'
            )}
            style={{ width: `${Math.max(2, Math.min(100, surge.meter))}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-300/90"
            style={{ left: '70%' }}
            title="Ignition Threshold: 70"
          />
        </div>
        <div className="flex justify-between font-mono text-[10px] text-zinc-500">
          <span>0</span>
          <span className="text-amber-300/80">Ignition (70)</span>
          <span>100</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 rounded-lg border border-white/10 bg-black/35 p-2.5 font-mono text-xs">
        <div>
          <div className="text-[10px] text-zinc-500">Sky Heat</div>
          <div className="font-semibold text-orange-200">{surge.heat.toFixed(3)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">Reactivity</div>
          <div className="font-semibold text-sky-200">{surge.reactivity.toFixed(3)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">Monica State</div>
          <div className="font-semibold capitalize text-cyan-200">{surge.monicaState}</div>
        </div>
      </div>

      {surge.active && boostEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {boostEntries.map(([stat, boost]) => (
            <span
              key={stat}
              className="rounded-md border border-orange-400/35 bg-orange-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-orange-200"
            >
              {stat} +{boost}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

export function PentacleZoneSynergyPanel({
  zoneSynergies,
  bestZoneId,
}: {
  zoneSynergies: readonly ZoneSynergy[]
  bestZoneId: number
}) {
  if (!zoneSynergies.length) return null

  const sorted = [...zoneSynergies].sort((a, b) => b.synergy - a.synergy)
  const best = zoneSynergies.find(z => z.zoneId === bestZoneId) ?? sorted[0]

  return (
    <section className="rounded-xl border border-violet-400/20 bg-[#0d1020]/90 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-violet-300" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-violet-200">
              Pentacle Zone Synergies (11-Zone ECR)
            </h3>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Effective Contest Rating across the Crown, 5 Spires, and 5 Horizon Houses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/pentacles"
            className="rounded-full border border-violet-400/35 bg-violet-500/15 px-3 py-1 font-mono text-[11px] font-semibold text-violet-100 hover:bg-violet-500/25 transition-colors"
          >
            Star Vaults →
          </Link>
          <Link
            href="/pentacles/war"
            className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 font-mono text-[11px] font-semibold text-amber-200 hover:bg-amber-400/25 transition-colors"
          >
            <Swords className="h-3 w-3" />
            War Table
          </Link>
        </div>
      </div>

      {best && (
        <div className="flex items-center justify-between rounded-lg border border-amber-400/40 bg-amber-400/10 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-300" />
            <span className="text-xs font-semibold text-amber-100">
              Peak Domain: {best.label} ({best.element} · {best.esmsToken})
            </span>
          </div>
          <span className="font-mono text-sm font-bold text-amber-200">
            ECR {best.synergy.toFixed(1)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {sorted.map(zone => {
          const isBest = zone.zoneId === bestZoneId
          return (
            <div
              key={zone.zoneId}
              className={cn(
                'rounded-lg border p-2.5 font-mono transition-colors',
                isBest
                  ? 'border-amber-400/50 bg-amber-400/10'
                  : 'border-white/10 bg-black/30 hover:border-white/20'
              )}
            >
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span className="uppercase">{zone.kind}</span>
                <span className="capitalize text-violet-300">{zone.element}</span>
              </div>
              <div className="mt-0.5 text-xs font-semibold text-zinc-100 truncate">
                {zone.label}
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-[10px] text-zinc-500">ECR</span>
                <span
                  className={cn('text-sm font-bold', isBest ? 'text-amber-200' : 'text-zinc-200')}
                >
                  {zone.synergy.toFixed(1)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Client-side live hydrator for ISR-cached Codex pages (`/agent/[id]`).
 * Renders the SSR/ISR `initialPayload` on first paint with zero layout shift, then
 * refreshes `/api/agents/rating?agentId=...` (`no-store`) so Live Resonance Surge,
 * 11-Zone ECR, and creator-authenticated ESMS Seal Gates never freeze at build time.
 */
export function LiveVesselRatingSection({
  agentId,
  initialPayload,
}: {
  agentId: string
  initialPayload: RatedVesselPayload
}) {
  const [payload, setPayload] = useState<RatedVesselPayload>(initialPayload)
  const [refreshing, setRefreshing] = useState(false)
  const [hydratedAt, setHydratedAt] = useState<string | null>(null)

  const refreshLiveRating = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/agents/rating?agentId=${encodeURIComponent(agentId)}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const live = (await res.json()) as RatedVesselPayload
      if (live && typeof live.ovr === 'number' && live.ratings) {
        setPayload(live)
        setHydratedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      }
    } catch {
      // Preserve initialPayload gracefully when offline.
    } finally {
      setRefreshing(false)
    }
  }, [agentId])

  useEffect(() => {
    void refreshLiveRating()
  }, [refreshLiveRating])

  return (
    <div className="space-y-4 relative z-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-7 rounded-xl border border-amber-400/25 bg-[#0d1020]/90 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-amber-200">
                  Pentacle Vessel Rating Scale (25–99 OWA)
                </span>
                <button
                  type="button"
                  onClick={() => void refreshLiveRating()}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:border-amber-400/40 hover:text-amber-200 transition-colors disabled:opacity-50"
                  title="Refresh live sky surge, ESMS Seal gates, and 11-zone ECR"
                >
                  <RefreshCw className={cn('h-2.5 w-2.5', refreshing && 'animate-spin')} />
                  {hydratedAt ? `Synced ${hydratedAt}` : 'Live Sync'}
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Ordered Weighted Average &amp; Relative Advantage vs. canonical 72-vessel roster
                baseline
              </p>
            </div>
            <div className="text-right font-mono">
              <span className="text-2xl font-black text-amber-300">PVR {payload.ovr}</span>
              <span className="block text-[10px] text-violet-200">{payload.archetype.title}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SACRED_STAT_KEYS.map(key => {
              const ratingVal = payload.ratings[key]
              const adv = payload.relativeAdvantage[key]
              const isLead =
                payload.archetype.primary === key || payload.archetype.secondary === key
              return (
                <div
                  key={key}
                  className={`rounded-lg border p-2.5 font-mono ${
                    isLead ? 'border-amber-400/45 bg-amber-400/10' : 'border-white/10 bg-black/35'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize font-semibold text-zinc-100">
                      {key}
                      {payload.archetype.primary === key && (
                        <span className="ml-1.5 text-[9px] uppercase text-amber-300">
                          · Primary
                        </span>
                      )}
                      {payload.archetype.secondary === key && (
                        <span className="ml-1.5 text-[9px] uppercase text-violet-300">
                          · Secondary
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] ${adv >= 0 ? 'text-emerald-300' : 'text-zinc-400'}`}
                      >
                        {adv >= 0 ? `+${adv.toFixed(1)}` : adv.toFixed(1)}
                      </span>
                      <span className="font-bold text-amber-200">{ratingVal}</span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/50">
                    <div
                      className={`h-full rounded-full ${
                        isLead ? 'bg-amber-400' : 'bg-violet-400/75'
                      }`}
                      style={{ width: `${Math.max(5, Math.min(100, ratingVal))}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="lg:col-span-5">
          <ResonanceSurgePanel
            surge={payload.surge}
            skySource={payload.sky?.source ?? null}
            degradedReason={payload.degraded?.sky}
          />
        </div>
      </div>

      <AlchemicalSealsCodex sealProgress={payload.sealProgress} esmsSource={payload.esmsSource} />

      <PentacleZoneSynergyPanel
        zoneSynergies={payload.zoneSynergies}
        bestZoneId={payload.bestZoneId}
      />
    </div>
  )
}
