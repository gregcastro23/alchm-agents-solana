'use client'

import { useEffect, useMemo, useState } from 'react'

import { LiveVaultGallery } from './LiveVaultGallery'
import { AlchemicalButton } from './AlchemicalButton'
import { useOccultStore, type OccultAgentRef } from '@/lib/store/occult-store'
import { getHistoricalAgent } from '@/lib/agents/historical'
import {
  SEAL_TIER_MULTIPLIERS,
  rateAgent,
  resolveZoneContest,
  type RatedVesselPayload,
} from '@/lib/agents/rating'
import { SEAL_TIERS } from '@/lib/agents/rating-contract'
import { resolveAgentAppearance } from '@/lib/agents/vessel-appearance-manifest'
import { cn } from '@/lib/utils'

/**
 * Synastry Assembly (Stitch realization plan, Phase 5, Module 3).
 * Select two REAL agents for astrometric resonance testing. The pairing
 * lives in the occult store so the Duel tab picks it up.
 */

function bestSealMultiplierLabel(payload: RatedVesselPayload | null): string {
  if (!payload || payload.seals.length === 0) return '1.00x Base'
  let maxIdx = -1
  for (const seal of payload.seals) {
    const idx = SEAL_TIERS.indexOf(seal.tier)
    if (idx > maxIdx) maxIdx = idx
  }
  if (maxIdx < 0) return '1.00x Base'
  const tier = SEAL_TIERS[maxIdx]
  return `${SEAL_TIER_MULTIPLIERS[tier].toFixed(2)}x ${tier}`
}

function surgeBadgeLabel(payload: RatedVesselPayload | null): string {
  if (!payload?.surge) return 'Sky Sync…'
  if (payload.surge.active) {
    const boosts = Object.entries(payload.surge.statBoosts)
      .filter(([, v]) => (v ?? 0) > 0)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([k, v]) => `+${v} ${k.slice(0, 3).toUpperCase()}`)
      .join(' · ')
    return `Surge Active (${boosts || '+12/+8/+4'})`
  }
  return `Meter ${Math.round(payload.surge.meter)}/100`
}

function resolveSlotVessel(agent: OccultAgentRef | null, livePayload: RatedVesselPayload | null) {
  if (!agent) return null
  const canonical = getHistoricalAgent(agent.agentId)
  const fallbackRating = canonical ? rateAgent(canonical) : null
  const ovr = livePayload?.ovr ?? agent.ovr ?? fallbackRating?.ovr ?? null
  const archetypeTitle =
    livePayload?.archetype.title ?? agent.archetypeTitle ?? fallbackRating?.archetype.title ?? null
  const ratings = livePayload?.ratings ?? agent.ratings ?? fallbackRating?.ratings ?? null
  const appearance = resolveAgentAppearance(
    canonical?.id ?? agent.agentId,
    undefined,
    archetypeTitle ? { title: archetypeTitle } : undefined
  )
  return {
    ovr,
    archetypeTitle,
    ratings,
    seals: livePayload?.seals ?? [],
    surge: livePayload?.surge ?? null,
    sealLabel: bestSealMultiplierLabel(livePayload),
    surgeLabel: surgeBadgeLabel(livePayload),
    appearance,
  }
}

function slotCard(
  agent: OccultAgentRef | null,
  livePayload: RatedVesselPayload | null,
  label: string,
  active: boolean
) {
  const vessel = resolveSlotVessel(agent, livePayload)
  return (
    <div
      className={cn(
        'glass-panel rounded-xl p-6 flex flex-col items-center text-center min-h-[180px] justify-center transition-all',
        active && 'premium-glow',
        agent && !active && 'ghost-border-violet'
      )}
    >
      <p className="font-label-mono text-[11px] uppercase tracking-widest text-on-surface-variant mb-2">
        {label}
      </p>
      {agent && vessel ? (
        <>
          <img
            src={vessel.appearance.portraitSvgDataUri}
            alt={agent.name}
            className="w-14 h-14 rounded-full border border-st-primary/40 bg-black/60 object-cover mb-2.5"
          />
          <h3 className="font-headline-sm text-headline-sm text-on-surface">{agent.name}</h3>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {vessel.ovr !== null && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/45 bg-amber-400/12 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-200 tabular-nums">
                <span className="text-[9px] uppercase tracking-wider text-amber-300/80">PVR</span>
                <span>{vessel.ovr}</span>
              </span>
            )}
            {vessel.archetypeTitle && (
              <span className="inline-flex items-center rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-100">
                {vessel.archetypeTitle}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 font-mono text-[10px]">
            <span className="rounded border border-amber-400/25 bg-black/40 px-1.5 py-0.5 text-amber-200/90 tabular-nums">
              Seal {vessel.sealLabel}
            </span>
            <span
              className={cn(
                'rounded border px-1.5 py-0.5 tabular-nums',
                vessel.surge?.active
                  ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/10 bg-black/30 text-zinc-400'
              )}
            >
              {vessel.surgeLabel}
            </span>
          </div>
          {typeof agent.monicaConstant === 'number' && (
            <p className="font-label-mono text-label-mono text-monica-constant glow-monica mt-2 tabular-nums">
              A#{agent.monicaConstant.toFixed(3)}
            </p>
          )}
        </>
      ) : (
        <p className="font-body-md text-body-md text-outline">
          {active ? 'Choose from the Vault below' : 'Empty well'}
        </p>
      )}
    </div>
  )
}

export function SynastryAssembly({ onCommence }: { onCommence: () => void }) {
  const { caster, target, setCaster, setTarget } = useOccultStore()
  const [assigning, setAssigning] = useState<'caster' | 'target'>('caster')
  const [casterLive, setCasterLive] = useState<RatedVesselPayload | null>(null)
  const [targetLive, setTargetLive] = useState<RatedVesselPayload | null>(null)

  useEffect(() => {
    const id = caster?.agentId
    if (!id) {
      setCasterLive(null)
      return
    }
    let cancelled = false
    fetch(`/api/agents/rating?agentId=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(res => (res.ok ? (res.json() as Promise<RatedVesselPayload>) : null))
      .then(payload => {
        if (!cancelled) setCasterLive(payload)
      })
      .catch(() => {
        if (!cancelled) setCasterLive(null)
      })
    return () => {
      cancelled = true
    }
  }, [caster?.agentId])

  useEffect(() => {
    const id = target?.agentId
    if (!id) {
      setTargetLive(null)
      return
    }
    let cancelled = false
    fetch(`/api/agents/rating?agentId=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(res => (res.ok ? (res.json() as Promise<RatedVesselPayload>) : null))
      .then(payload => {
        if (!cancelled) setTargetLive(payload)
      })
      .catch(() => {
        if (!cancelled) setTargetLive(null)
      })
    return () => {
      cancelled = true
    }
  }, [target?.agentId])

  const casterVessel = useMemo(() => resolveSlotVessel(caster, casterLive), [caster, casterLive])
  const targetVessel = useMemo(() => resolveSlotVessel(target, targetLive), [target, targetLive])

  const crownContest = useMemo(() => {
    if (!casterVessel?.ratings || !targetVessel?.ratings) return null
    return resolveZoneContest(
      {
        ratings: casterVessel.ratings,
        seals: casterVessel.seals,
        surge: casterVessel.surge,
      },
      {
        ratings: targetVessel.ratings,
        seals: targetVessel.seals,
        surge: targetVessel.surge,
      },
      10, // Zone 10 = The Crown
      50
    )
  }, [casterVessel, targetVessel])

  const resonance =
    typeof caster?.monicaConstant === 'number' && typeof target?.monicaConstant === 'number'
      ? Math.max(0, 1 - Math.abs(caster.monicaConstant - target.monicaConstant) / 7)
      : null

  const handleSelect = (agent: OccultAgentRef) => {
    if (assigning === 'caster') {
      setCaster(agent)
      setAssigning('target')
    } else {
      setTarget(agent)
    }
  }

  return (
    <div className="min-h-screen bg-st-background pb-24">
      <header className="px-margin-mobile md:px-margin-desktop pt-12 max-w-container-max mx-auto">
        <h1 className="font-headline-xl-mobile md:font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-background">
          Synastry Assembly
        </h1>
        <p className="font-label-mono text-label-mono text-on-surface-variant mt-3 uppercase">
          Select dual entities for astrometric resonance &amp; Pentacle Crown contest testing.
        </p>
      </header>

      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto mt-8 grid md:grid-cols-3 gap-gutter items-stretch">
        <button type="button" className="text-left" onClick={() => setAssigning('caster')}>
          {slotCard(caster, casterLive, 'Caster', assigning === 'caster')}
        </button>

        {/* Resonance vector + Crown ECR Contest Preview */}
        <div className="glass-float rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <p className="font-label-mono text-[11px] uppercase tracking-widest text-on-surface-variant mb-2">
            Resonance Vector
          </p>
          {resonance !== null ? (
            <>
              <p className="font-headline-lg text-headline-lg text-monica-constant glow-monica tabular-nums">
                {(resonance * 100).toFixed(1)}%
              </p>
              <p
                className={cn(
                  'font-label-mono text-label-mono mt-1',
                  resonance > 0.6 ? 'text-tertiary' : 'text-error'
                )}
              >
                {resonance > 0.6 ? 'Aligned' : 'High Volatility'}
              </p>
            </>
          ) : (
            <p className="font-body-md text-body-md text-outline">Awaiting both entities…</p>
          )}

          {crownContest && (
            <div className="mt-4 w-full rounded-lg border border-amber-400/25 bg-black/40 px-3 py-2 font-mono text-[11px]">
              <div className="text-[10px] uppercase tracking-wider text-amber-300/90">
                Pentacle Crown ECR
              </div>
              <div className="mt-1 flex items-center justify-between text-zinc-200 tabular-nums">
                <span>{crownContest.attackerScore.toFixed(1)}</span>
                <span className="text-[10px] uppercase text-zinc-400">
                  {crownContest.winner === 'draw'
                    ? 'Deadlock'
                    : crownContest.winner === 'attacker'
                      ? `Caster +${crownContest.controlDelta}%`
                      : `Target +${Math.abs(crownContest.controlDelta)}%`}
                </span>
                <span>{crownContest.defenderScore.toFixed(1)}</span>
              </div>
            </div>
          )}

          <AlchemicalButton className="mt-5" disabled={!caster || !target} onClick={onCommence}>
            Commence Jing Duel
          </AlchemicalButton>
        </div>

        <button type="button" className="text-left" onClick={() => setAssigning('target')}>
          {slotCard(target, targetLive, 'Target', assigning === 'target')}
        </button>
      </div>

      <div className="mt-4">
        <p className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto font-label-mono text-[11px] uppercase tracking-widest text-outline">
          Assigning: {assigning === 'caster' ? 'Caster (left well)' : 'Target (right well)'} — pick
          below. Historical minds carry the richest personas in the duel.
        </p>
        <LiveVaultGallery selectable onSelect={handleSelect} />
      </div>
    </div>
  )
}
