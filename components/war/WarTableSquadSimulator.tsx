'use client'

import { useMemo, useState } from 'react'
import {
  Crown,
  Flame,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Wand2,
  Zap,
} from 'lucide-react'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'
import {
  ZONE_PROFILES,
  earnedSeals,
  evaluateSeals,
  rateStats,
  type CoreStats,
} from '@/lib/agents/rating'
import {
  WAR_TABLE_CANONICAL_ROSTER,
  autoSlotSquadOptimalEcr,
  buildPreviewMeleeHand,
  buildSquadVesselCandidate,
  formatTarotMeleeCard,
  simulateAllZonesForSquad,
  type SquadVesselCandidate,
  type TarotMeleeCard,
} from '@/lib/war/squad-optimizer'

interface LiveZoneSummary {
  zoneId: number
  kind: string
  owner: string | null
  control: number
  inFlux: boolean
  fluxLevel: number
  claimedStars: number
}

interface LiveAgentSummary {
  identity: string
  handle: string
  faction: string
  cardCount: number
  activeCardCount: number
}

interface LiveMeleeHandRow {
  handId: string
  tableId: string
  seatId: string
  cardId: string
  suit: string
  rank: number
  isMajor: boolean
  inverted: boolean
  played: boolean
}

export interface WarTableSquadSimulatorProps {
  liveZones: LiveZoneSummary[]
  liveAgents: LiveAgentSummary[]
  liveMyMeleeHand?: LiveMeleeHandRow[]
  activeTrumpSuit?: string
}

const ELEMENT_BADGE_STYLE: Record<string, string> = {
  Fire: 'border-rose-400/35 bg-rose-500/10 text-rose-200',
  Water: 'border-cyan-400/35 bg-cyan-500/10 text-cyan-200',
  Air: 'border-violet-400/35 bg-violet-500/10 text-violet-200',
  Earth: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200',
}

const SUIT_ACCENT_STYLE: Record<TarotMeleeCard['suit'], string> = {
  Wands: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  Cups: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200',
  Swords: 'border-violet-400/40 bg-violet-500/10 text-violet-200',
  Pentacles: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
}

export function WarTableSquadSimulator({
  liveZones,
  liveAgents,
  liveMyMeleeHand = [],
  activeTrumpSuit = 'Wands',
}: WarTableSquadSimulatorProps) {
  const [surgeOverride, setSurgeOverride] = useState<boolean>(true)
  const [selectedSquadIds, setSelectedSquadIds] = useState<string[]>(() =>
    WAR_TABLE_CANONICAL_ROSTER.slice(0, 5).map(v => v.id)
  )
  const [activeBrushVesselId, setActiveBrushVesselId] = useState<string>(
    WAR_TABLE_CANONICAL_ROSTER[0].id
  )
  const [trumpSuit, setTrumpSuit] = useState<TarotMeleeCard['suit']>(
    activeTrumpSuit === 'Cups' || activeTrumpSuit === 'Swords' || activeTrumpSuit === 'Pentacles'
      ? activeTrumpSuit
      : 'Wands'
  )
  const [handSeed, setHandSeed] = useState<number>(0)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [playedCardIds, setPlayedCardIds] = useState<Record<string, boolean>>({})
  const [zoneFilter, setZoneFilter] = useState<'ALL' | 'House' | 'Spire' | 'Crown'>('ALL')

  // Merge canonical War Table vessels with any live SpacetimeDB agents
  const fullRoster = useMemo<SquadVesselCandidate[]>(() => {
    const base = WAR_TABLE_CANONICAL_ROSTER.map(v =>
      buildSquadVesselCandidate({
        id: v.id,
        name: v.name,
        title: v.title,
        faction: v.faction,
        element: v.element,
        ratings: v.ratings,
        esmsBalances: v.esmsBalances,
        surgeActive: surgeOverride ? true : v.surge.active,
      })
    )

    const liveExtras = liveAgents.slice(0, 4).map((agent, idx) => {
      const elements = ['Fire', 'Earth', 'Air', 'Water'] as const
      const element = elements[idx % 4]
      const seed = 78 + ((idx * 5 + agent.cardCount) % 16)
      return buildSquadVesselCandidate({
        id: `live-${agent.identity.slice(0, 10)}`,
        name: agent.handle,
        title: `${agent.faction} Live NPC Champion`,
        faction: agent.faction,
        element,
        ratings: {
          power: Math.min(97, seed + (idx % 2 === 0 ? 8 : 2)),
          resonance: Math.min(97, seed + (idx % 3 === 0 ? 9 : 3)),
          wisdom: Math.min(97, seed + 5),
          charisma: Math.min(97, seed + 4),
          intuition: Math.min(97, seed + (idx % 2 === 1 ? 9 : 4)),
          adaptability: Math.min(97, seed + 6),
          vitality: Math.min(97, seed + 7),
        },
        esmsBalances: {
          spirit: 240 + agent.activeCardCount * 20,
          essence: 230 + agent.cardCount * 15,
          matter: 220 + idx * 30,
          substance: 235 + idx * 25,
        },
        surgeActive: surgeOverride,
      })
    })

    return [...base, ...liveExtras]
  }, [liveAgents, surgeOverride])

  const activeSquad = useMemo(
    () => fullRoster.filter(v => selectedSquadIds.includes(v.id)).slice(0, 5),
    [fullRoster, selectedSquadIds]
  )

  const [slottedByZone, setSlottedByZone] = useState<Record<number, string>>(() =>
    autoSlotSquadOptimalEcr(WAR_TABLE_CANONICAL_ROSTER.slice(0, 5))
  )

  // Build Tarot Melee Hand (`my_melee_hand`)
  const meleeHand = useMemo<TarotMeleeCard[]>(() => {
    const rawHand =
      liveMyMeleeHand.length > 0
        ? liveMyMeleeHand.map(card =>
            formatTarotMeleeCard({
              ...card,
              trumpSuit,
            })
          )
        : buildPreviewMeleeHand(handSeed, trumpSuit)

    return rawHand.map(card => ({
      ...card,
      played: card.played || Boolean(playedCardIds[card.handId]),
    }))
  }, [handSeed, liveMyMeleeHand, playedCardIds, trumpSuit])

  const activeCard = useMemo<TarotMeleeCard | null>(() => {
    const unplayed = meleeHand.filter(c => !c.played)
    if (selectedCardId) {
      return meleeHand.find(c => c.handId === selectedCardId) ?? unplayed[0] ?? null
    }
    return unplayed[0] ?? null
  }, [meleeHand, selectedCardId])

  const zoneSimulations = useMemo(
    () =>
      simulateAllZonesForSquad({
        slottedByZone,
        roster: fullRoster,
        liveZones,
        selectedCard: activeCard,
      }),
    [activeCard, fullRoster, liveZones, slottedByZone]
  )

  const slottedSimulations = useMemo(
    () => zoneSimulations.filter(sim => sim.attacker !== null),
    [zoneSimulations]
  )

  const squadSummary = useMemo(() => {
    const totalEcr =
      Math.round(slottedSimulations.reduce((acc, s) => acc + s.effectiveAttackerEcr, 0) * 100) / 100
    const avgWinProb =
      slottedSimulations.length > 0
        ? Math.round(
            slottedSimulations.reduce((acc, s) => acc + s.winProbabilityPct, 0) /
              slottedSimulations.length
          )
        : 0
    const netControlSwing = slottedSimulations.reduce(
      (acc, s) => acc + (s.contest?.controlDelta ?? 0),
      0
    )
    const favoredZones = slottedSimulations.filter(
      s => s.contest?.winner === 'attacker' || s.winProbabilityPct >= 52
    ).length

    const compositeStats: CoreStats =
      activeSquad.length > 0
        ? {
            power: Math.round(
              activeSquad.reduce((a, v) => a + v.ratings.power, 0) / activeSquad.length
            ),
            resonance: Math.round(
              activeSquad.reduce((a, v) => a + v.ratings.resonance, 0) / activeSquad.length
            ),
            wisdom: Math.round(
              activeSquad.reduce((a, v) => a + v.ratings.wisdom, 0) / activeSquad.length
            ),
            charisma: Math.round(
              activeSquad.reduce((a, v) => a + v.ratings.charisma, 0) / activeSquad.length
            ),
            intuition: Math.round(
              activeSquad.reduce((a, v) => a + v.ratings.intuition, 0) / activeSquad.length
            ),
            adaptability: Math.round(
              activeSquad.reduce((a, v) => a + v.ratings.adaptability, 0) / activeSquad.length
            ),
            vitality: Math.round(
              activeSquad.reduce((a, v) => a + v.ratings.vitality, 0) / activeSquad.length
            ),
          }
        : {
            power: 80,
            resonance: 80,
            wisdom: 80,
            charisma: 80,
            intuition: 80,
            adaptability: 80,
            vitality: 80,
          }

    const rated = rateStats(compositeStats)
    const seals = earnedSeals(
      evaluateSeals({
        stats: compositeStats,
        esmsBalances: { spirit: 360, essence: 340, matter: 320, substance: 340 },
      })
    )

    return {
      totalEcr,
      avgWinProb,
      netControlSwing,
      favoredZones,
      ovr: rated.ovr,
      archetype: rated.archetype,
      seals,
    }
  }, [activeSquad, slottedSimulations])

  const handleAutoSlotOptimal = () => {
    const optimal = autoSlotSquadOptimalEcr(activeSquad)
    setSlottedByZone(optimal)
  }

  const handleAssignVesselToZone = (vesselId: string, zoneId: number) => {
    setSlottedByZone(prev => {
      const next: Record<number, string> = {}
      // Remove this vessel from any previous zone
      for (const [zKey, vId] of Object.entries(prev)) {
        const numericZ = Number(zKey)
        if (vId !== vesselId && numericZ !== zoneId) {
          next[numericZ] = vId
        }
      }
      // Enforce max 5 slotted zones
      const existingEntries = Object.entries(next)
      if (existingEntries.length >= 5) {
        const firstZoneToDrop = Number(existingEntries[0][0])
        delete next[firstZoneToDrop]
      }
      next[zoneId] = vesselId
      return next
    })

    if (!selectedSquadIds.includes(vesselId)) {
      setSelectedSquadIds(prev => [vesselId, ...prev.slice(0, 4)])
    }
  }

  const handleToggleSquadMember = (vesselId: string) => {
    setActiveBrushVesselId(vesselId)
    setSelectedSquadIds(prev => {
      if (prev.includes(vesselId)) {
        if (prev.length <= 1) return prev
        const filtered = prev.filter(id => id !== vesselId)
        setSlottedByZone(slots => {
          const copy = { ...slots }
          for (const [z, v] of Object.entries(copy)) {
            if (v === vesselId) delete copy[Number(z)]
          }
          return copy
        })
        return filtered
      }
      const next = [...prev.slice(0, 4), vesselId]
      return next
    })
  }

  const filteredSimulations = useMemo(
    () =>
      zoneFilter === 'ALL'
        ? zoneSimulations
        : zoneSimulations.filter(s => s.zone.kind === zoneFilter),
    [zoneFilter, zoneSimulations]
  )

  return (
    <section
      id="war-table-squad-simulator"
      className="rounded-3xl border border-amber-400/20 bg-gradient-to-b from-[#0d1120]/95 via-[#090c16]/95 to-[#070911] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:p-6"
    >
      {/* Top Command Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">
              <Swords className="h-3 w-3" /> 11-Zone Lineup Optimizer
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200">
              resolveZoneContest + my_melee_hand
            </span>
          </div>
          <h2 className="mt-2.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            War Table Squad Builder &amp; Tarot Melee Simulator
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
            Slot a 5-vessel strike squad across Houses 0–4, Spires 5–9, and Crown 10. Compute exact
            Effective Contest Ratings (ECR), Seal multipliers (1.05x–1.40x), and live{' '}
            <code className="text-amber-200">my_melee_hand</code> Tarot trick modifiers before
            committing to a 12-trick War Table.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <VesselRatingRibbon
            ovr={squadSummary.ovr}
            archetype={squadSummary.archetype}
            seals={squadSummary.seals}
            compact
          />
          <button
            type="button"
            onClick={handleAutoSlotOptimal}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-400/15 px-3.5 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/25"
          >
            <Wand2 className="h-3.5 w-3.5 text-amber-300" />
            Auto-Slot Optimal ECR
          </button>
          <button
            type="button"
            onClick={() => setSurgeOverride(prev => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
              surgeOverride
                ? 'border-violet-400/40 bg-violet-500/15 text-violet-100'
                : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-violet-300" />
            Surge {surgeOverride ? '+12/+8/+4 ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Squad Aggregate Telemetry Strip */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Slotted Squad ECR
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-amber-200 tabular-nums">
              {squadSummary.totalEcr.toFixed(1)}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {slottedSimulations.length}/5 zones active
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Mean Win Probability
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span
              className={`font-mono text-2xl font-semibold tabular-nums ${
                squadSummary.avgWinProb >= 55
                  ? 'text-emerald-300'
                  : squadSummary.avgWinProb >= 45
                    ? 'text-amber-300'
                    : 'text-rose-300'
              }`}
            >
              {squadSummary.avgWinProb}%
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {squadSummary.favoredZones}/{slottedSimulations.length || 5} favored
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Projected Control Swing
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span
              className={`font-mono text-2xl font-semibold tabular-nums ${
                squadSummary.netControlSwing >= 0 ? 'text-cyan-300' : 'text-rose-300'
              }`}
            >
              {squadSummary.netControlSwing >= 0 ? '+' : ''}
              {squadSummary.netControlSwing}
            </span>
            <span className="font-mono text-[11px] text-slate-400">±40 max / zone</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Active Melee Lead Card
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-violet-200">
              {activeCard ? activeCard.title : 'None staged'}
            </span>
            <span className="shrink-0 font-mono text-xs text-emerald-300">
              +{activeCard ? activeCard.ecrBonus.toFixed(1) : '0.0'} ECR
            </span>
          </div>
        </div>
      </div>

      {/* 5-Vessel Strike Roster Bar */}
      <div className="mt-5">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-300" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Strike Vessel Roster ({activeSquad.length}/5 Selected)
            </h3>
          </div>
          <p className="text-[11px] text-slate-500">
            Select a vessel and assign its target Pentacle zone, or click{' '}
            <span className="text-amber-200">Auto-Slot Optimal ECR</span>.
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {fullRoster.map(vessel => {
            const isInSquad = selectedSquadIds.includes(vessel.id)
            const isBrush = activeBrushVesselId === vessel.id
            const assignedZoneEntry = Object.entries(slottedByZone).find(
              ([, vId]) => vId === vessel.id
            )
            const assignedZoneId = assignedZoneEntry ? Number(assignedZoneEntry[0]) : null
            const assignedZoneProfile =
              assignedZoneId !== null ? ZONE_PROFILES[assignedZoneId] : null

            return (
              <div
                key={vessel.id}
                onClick={() => setActiveBrushVesselId(vessel.id)}
                className={`cursor-pointer rounded-2xl border p-3 transition ${
                  isBrush
                    ? 'border-amber-300/60 bg-amber-400/[0.08] shadow-[0_0_20px_rgba(251,191,36,0.12)]'
                    : isInSquad
                      ? 'border-white/15 bg-white/[0.04] hover:border-white/25'
                      : 'border-white/[0.06] bg-black/20 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-white">
                        {vessel.name}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">
                      {vessel.faction} · {vessel.archetype.title}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200">
                    PVR {vessel.ovr}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span
                    className={`rounded-md border px-1.5 py-0.5 font-mono ${
                      ELEMENT_BADGE_STYLE[vessel.element] ?? 'border-white/10 text-slate-300'
                    }`}
                  >
                    {vessel.element}
                  </span>
                  <span className="rounded-md border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-cyan-200">
                    Best: {vessel.bestZoneLabel} ({vessel.bestZoneEcr.toFixed(1)})
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      handleToggleSquadMember(vessel.id)
                    }}
                    className={`rounded-lg border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                      isInSquad
                        ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                        : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white'
                    }`}
                  >
                    {isInSquad ? 'In Squad' : '+ Recruit'}
                  </button>

                  <select
                    aria-label={`Assign ${vessel.name} to zone`}
                    value={assignedZoneId !== null ? String(assignedZoneId) : ''}
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '') {
                        setSlottedByZone(prev => {
                          const copy = { ...prev }
                          if (assignedZoneId !== null) delete copy[assignedZoneId]
                          return copy
                        })
                      } else {
                        handleAssignVesselToZone(vessel.id, Number(val))
                      }
                    }}
                    className="max-w-[145px] truncate rounded-lg border border-white/15 bg-[#070a14] px-2 py-1 font-mono text-[10px] text-slate-200 focus:border-amber-400 focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {ZONE_PROFILES.map(zp => (
                      <option key={zp.zoneId} value={String(zp.zoneId)}>
                        Z{zp.zoneId}: {zp.label} (
                        {vessel.zoneSynergies[zp.zoneId]?.synergy.toFixed(1)})
                      </option>
                    ))}
                  </select>
                </div>

                {assignedZoneProfile && (
                  <p className="mt-1.5 font-mono text-[10px] text-amber-300/90">
                    Slotted → {assignedZoneProfile.label} ({assignedZoneProfile.element})
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 11-Zone Contest Simulator Grid */}
      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-cyan-300" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              11-Zone Contest Resolution &amp; Win-Probability Matrix
            </h3>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'House', 'Spire', 'Crown'] as const).map(kind => (
              <button
                key={kind}
                type="button"
                onClick={() => setZoneFilter(kind)}
                className={`rounded-lg border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                  zoneFilter === kind
                    ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                }`}
              >
                {kind === 'ALL' ? 'All 11 Zones' : `${kind}s`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSimulations.map(sim => {
            const isSlotted = sim.attacker !== null
            const isOptimalForAttacker = sim.attacker && sim.attacker.bestZoneId === sim.zone.zoneId

            return (
              <article
                key={sim.zone.zoneId}
                className={`rounded-2xl border p-4 transition ${
                  isSlotted
                    ? 'border-amber-400/35 bg-gradient-to-b from-amber-500/[0.07] to-black/40'
                    : 'border-white/[0.08] bg-black/25 hover:border-white/15'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        Z{sim.zone.zoneId} · {sim.zone.kind}
                      </span>
                      <span
                        className={`rounded border px-1.5 py-0.2 font-mono text-[9px] ${
                          ELEMENT_BADGE_STYLE[sim.zone.element] ?? 'border-white/10 text-slate-300'
                        }`}
                      >
                        {sim.zone.element} ({sim.zone.esmsToken})
                      </span>
                    </div>
                    <h4 className="mt-1 text-sm font-semibold text-white">{sim.zone.label}</h4>
                  </div>

                  {isSlotted ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                        sim.winProbabilityPct >= 55
                          ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                          : sim.winProbabilityPct >= 45
                            ? 'border-amber-400/35 bg-amber-500/15 text-amber-200'
                            : 'border-rose-400/35 bg-rose-500/15 text-rose-200'
                      }`}
                    >
                      {sim.winProbabilityPct}% Win
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAssignVesselToZone(activeBrushVesselId, sim.zone.zoneId)}
                      className="rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1 font-mono text-[10px] text-slate-300 transition hover:border-amber-300/40 hover:bg-amber-400/15 hover:text-amber-100"
                    >
                      + Slot Active
                    </button>
                  )}
                </div>

                {isSlotted && sim.attacker && sim.contest ? (
                  <div className="mt-3 space-y-2.5">
                    <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold text-amber-200">
                            {sim.attacker.name}
                          </span>
                          {isOptimalForAttacker && (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase text-emerald-300">
                              #1 Best Zone
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                          Seal {sim.sealMultiplier.toFixed(2)}x · Card +
                          {sim.tarotBonusEcr.toFixed(1)}
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <p className="text-sm font-bold text-white tabular-nums">
                          {sim.effectiveAttackerEcr.toFixed(1)}
                        </p>
                        <p className="text-[9px] uppercase text-slate-500">ATK ECR</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-1 font-mono text-[11px] text-slate-400">
                      <span>
                        vs. <strong className="text-slate-200">{sim.defenderName}</strong> (PVR{' '}
                        {sim.defenderOvr})
                      </span>
                      <span>DEF {sim.contest.defenderScore.toFixed(1)} ECR</span>
                    </div>

                    {/* Win Probability Bar */}
                    <div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            sim.winProbabilityPct >= 55
                              ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                              : sim.winProbabilityPct >= 45
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
                                : 'bg-gradient-to-r from-rose-500 to-orange-400'
                          }`}
                          style={{ width: `${sim.winProbabilityPct}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-slate-400">
                        <span>~{sim.projectedTricksWon}/12 tricks</span>
                        <span
                          className={
                            sim.contest.controlDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'
                          }
                        >
                          Control {sim.contest.controlDelta >= 0 ? '+' : ''}
                          {sim.contest.controlDelta} → {sim.contest.nextControl}%
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-dashed border-white/[0.08] px-3 py-3 text-xs text-slate-500">
                    <span>Held by {sim.defenderName}</span>
                    <span className="font-mono text-[11px] text-slate-400">
                      PVR {sim.defenderOvr}
                    </span>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>

      {/* Interactive Tarot Melee Hand (`my_melee_hand`) Drawer */}
      <div className="mt-6 rounded-2xl border border-violet-400/25 bg-[#090d1a]/90 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
          <div className="flex items-center gap-2.5">
            <Layers className="h-4 w-4 text-violet-300" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">
                  Tarot Melee Hand Drawer (<code className="text-violet-300">my_melee_hand</code>)
                </h3>
                <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] text-violet-200">
                  {liveMyMeleeHand.length > 0 ? 'Live SpacetimeDB Hand' : 'Pre-Stake Tactical Hand'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Inspect card suit resonance, Major Arcana overrides, and trump multipliers before
                playing a trick.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
              {(['Wands', 'Cups', 'Swords', 'Pentacles'] as const).map(suit => (
                <button
                  key={suit}
                  type="button"
                  onClick={() => setTrumpSuit(suit)}
                  className={`rounded-lg px-2 py-1 font-mono text-[10px] transition ${
                    trumpSuit === suit
                      ? 'bg-amber-400/20 font-semibold text-amber-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {suit}
                </button>
              ))}
            </div>

            {liveMyMeleeHand.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  setHandSeed(prev => prev + 1)
                  setPlayedCardIds({})
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-1.5 font-mono text-[11px] text-slate-200 transition hover:bg-white/[0.1]"
              >
                <RefreshCw className="h-3.5 w-3.5 text-cyan-300" />
                Deal Hand
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {meleeHand.map(card => {
            const isSelected = activeCard?.handId === card.handId
            const isTrump = card.suit === trumpSuit

            return (
              <div
                key={card.handId}
                onClick={() => setSelectedCardId(card.handId)}
                className={`cursor-pointer rounded-2xl border p-3.5 transition ${
                  card.played
                    ? 'border-white/[0.05] bg-black/20 opacity-50'
                    : isSelected
                      ? 'border-amber-300/60 bg-gradient-to-b from-violet-500/20 to-amber-500/10 shadow-[0_0_24px_rgba(167,139,250,0.2)]'
                      : 'border-white/10 bg-black/30 hover:border-violet-400/40'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${
                      SUIT_ACCENT_STYLE[card.suit]
                    }`}
                  >
                    {card.suit} · {card.element}
                  </span>
                  {card.isMajor ? (
                    <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-amber-200">
                      Major
                    </span>
                  ) : isTrump ? (
                    <span className="rounded bg-cyan-400/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-cyan-200">
                      Trump
                    </span>
                  ) : null}
                </div>

                <h4 className="mt-2.5 text-sm font-semibold text-white">{card.title}</h4>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {card.tacticalNote}
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-2.5 font-mono text-[10px]">
                  <span className="text-emerald-300">+{card.ecrBonus.toFixed(1)} ECR</span>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      setPlayedCardIds(prev => ({
                        ...prev,
                        [card.handId]: !prev[card.handId],
                      }))
                    }}
                    className="rounded border border-white/15 bg-white/[0.05] px-2 py-0.5 text-slate-300 hover:bg-white/[0.12]"
                  >
                    {card.played ? 'Unstage' : 'Stage Trick'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
export default WarTableSquadSimulator
