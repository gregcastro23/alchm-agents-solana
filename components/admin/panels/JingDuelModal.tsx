'use client'

import { ChevronRight, Swords, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdminJingDuel } from '@/types/admin'

/** Full ledger of one Jing duel: synastry, both transit overlays, both prompts. */
export default function JingDuelModal({
  duel,
  onClose,
}: {
  duel: AdminJingDuel
  onClose: () => void
}) {
  const synastry = duel.synastrySnapshot as {
    pair?: { agentA?: string; agentB?: string; cacheHit?: boolean }
    scores?: {
      tension?: number
      harmony?: number
      intensification?: number
      aspectCount?: number
    }
    dominantStance?: string
    interchartAspects?: Array<{
      planetA: string
      planetB: string
      type: string
      orb: number
      exactness: number
      harmonic: string
    }>
  } | null
  const casterTransit = duel.casterTransitSnapshot as {
    summary?: string
    boostElement?: string | null
    boostMagnitude?: number
    stressNotes?: string[]
    activations?: Array<{
      transitPlanet: string
      natalPoint: string
      type: string
      orb: number
      exactness: number
      natalElement: string
      valence: string
    }>
  } | null
  const targetTransit = duel.targetTransitSnapshot as typeof casterTransit
  const stanceTone: Record<string, string> = {
    clash: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    absorb: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    mirror: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300',
  }
  const boostPct = Math.round(duel.boostMagnitude * 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-4xl bg-zinc-900/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] backdrop-blur-md">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex justify-between items-start">
          <div>
            <h3 className="text-lg font-black text-zinc-100 flex items-center gap-2 uppercase tracking-wider text-sm">
              <Swords className="w-5 h-5 text-fuchsia-400 animate-pulse" />
              Conflict Duel Ledger
            </h3>
            <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-zinc-200">{duel.casterName}</span>
              <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
              <span className="font-semibold text-zinc-200">{duel.targetName}</span>
              <span className="text-zinc-500 font-bold">·</span>
              <span className="font-mono text-zinc-400 font-bold">
                {duel.attackMoveId} → {duel.counterMoveId}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-md hover:bg-zinc-800"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs select-text">
          {/* Headline cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-950/40 p-4 border border-white/5 rounded-xl font-mono text-[10px] font-bold">
            <div>
              <span className="text-zinc-500 block uppercase tracking-wider text-[9px]">
                Stance
              </span>
              <span
                className={cn(
                  'inline-block mt-1 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase border tracking-wider capitalize',
                  stanceTone[duel.stance] || 'border-zinc-700 bg-zinc-800 text-zinc-300'
                )}
              >
                {duel.stance}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block uppercase tracking-wider text-[9px]">
                Boost Magnitude
              </span>
              <span className="text-zinc-300 font-bold mt-1 block">
                {duel.boostElement ? `${boostPct}% ${duel.boostElement}` : '—'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block uppercase tracking-wider text-[9px]">
                Resolution time
              </span>
              <span className="text-zinc-300 font-bold mt-1 block">
                {duel.latencyMs ? `${duel.latencyMs}ms` : 'n/a'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block uppercase tracking-wider text-[9px]">
                Metaphysical Cache
              </span>
              <span
                className={cn(
                  'font-bold mt-1 block',
                  duel.cacheHit ? 'text-emerald-400' : 'text-zinc-500'
                )}
              >
                {duel.cacheHit ? 'HIT' : 'MISS'}
              </span>
            </div>
          </div>

          {/* Synastry summary */}
          {synastry && (
            <div className="space-y-1.5">
              <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                Pair Synastry Harmonics
              </h4>
              <div className="bg-zinc-950/60 border border-white/5 p-4 rounded-xl space-y-3">
                <div className="grid grid-cols-3 gap-3 text-[10px] font-mono font-bold">
                  <div>
                    <span className="text-zinc-500 block uppercase tracking-wider text-[9px]">
                      Tension
                    </span>
                    <span className="text-rose-400">
                      {synastry.scores?.tension?.toFixed(2) ?? '0.00'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block uppercase tracking-wider text-[9px]">
                      Harmony
                    </span>
                    <span className="text-sky-400">
                      {synastry.scores?.harmony?.toFixed(2) ?? '0.00'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block uppercase tracking-wider text-[9px]">
                      Intensification
                    </span>
                    <span className="text-fuchsia-400">
                      {synastry.scores?.intensification?.toFixed(2) ?? '0.00'}
                    </span>
                  </div>
                </div>
                {synastry.interchartAspects && synastry.interchartAspects.length > 0 && (
                  <ul className="space-y-1.5 text-[10px] font-mono text-zinc-350 pt-3 border-t border-white/5">
                    {synastry.interchartAspects.slice(0, 6).map((a, i) => (
                      <li key={i} className="flex justify-between">
                        <span>
                          {duel.casterName.split(' ')[0]} {a.planetA}{' '}
                          <span
                            className={cn(
                              'mx-1 font-bold',
                              a.harmonic === 'friction'
                                ? 'text-rose-400 bg-rose-500/5 px-1 rounded border border-rose-500/10'
                                : a.harmonic === 'harmony'
                                  ? 'text-sky-400 bg-sky-500/5 px-1 rounded border border-sky-500/10'
                                  : 'text-fuchsia-400 bg-fuchsia-500/5 px-1 rounded border border-fuchsia-500/10'
                            )}
                          >
                            {a.type}
                          </span>
                          {duel.targetName.split(' ')[0]} {a.planetB}
                        </span>
                        <span className="text-zinc-555 font-bold">{a.orb.toFixed(1)}° orb</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Per-agent transit overlays */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: duel.casterName, overlay: casterTransit, role: 'Initiator (Caster)' },
              {
                label: duel.targetName,
                overlay: defenderTransit(duel, targetTransit),
                role: 'Defender (Target)',
              },
            ].map((entry, i) => (
              <div
                key={i}
                className="bg-zinc-950/60 border border-white/5 p-4 rounded-xl space-y-2.5"
              >
                <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                  <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                    {entry.role} Transit
                  </h4>
                  <span className="text-xs text-zinc-350 font-bold">{entry.label}</span>
                </div>
                {entry.overlay ? (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-300 italic leading-relaxed">
                      {entry.overlay.summary || 'No summary'}
                    </p>
                    {entry.overlay.activations && entry.overlay.activations.length > 0 && (
                      <ul className="space-y-1 text-[10px] font-mono text-zinc-450 pt-1 leading-relaxed">
                        {entry.overlay.activations.slice(0, 4).map((a: any, j: number) => (
                          <li key={j}>
                            transit {a.transitPlanet} {a.type} natal {a.natalPoint}{' '}
                            <span className="text-zinc-555">({a.orb.toFixed(1)}°)</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {entry.overlay.stressNotes && entry.overlay.stressNotes.length > 0 && (
                      <div className="pt-2 border-t border-white/5 space-y-1">
                        {entry.overlay.stressNotes.map((note: string, k: number) => (
                          <p key={k} className="text-[10px] text-rose-300/80 font-bold font-mono">
                            ⚠ {note}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-555 italic font-medium">No transit captured</p>
                )}
              </div>
            ))}
          </div>

          {/* Prompts + Responses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                Caster Input Prompt
              </h4>
              <div className="bg-zinc-950/60 border border-white/5 p-4 rounded-xl text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-[180px] overflow-y-auto leading-relaxed select-text">
                {duel.casterPrompt || <span className="text-zinc-650 italic">not captured</span>}
              </div>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                Caster Output Response
              </h4>
              <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-xl text-xs text-zinc-200 whitespace-pre-wrap max-h-[180px] overflow-y-auto leading-relaxed select-text">
                {duel.casterResponse || <span className="text-zinc-650 italic">not captured</span>}
              </div>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                Target Input Prompt
              </h4>
              <div className="bg-zinc-950/60 border border-white/5 p-4 rounded-xl text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-[180px] overflow-y-auto leading-relaxed select-text">
                {duel.targetPrompt || <span className="text-zinc-650 italic">not captured</span>}
              </div>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                Target Output Response
              </h4>
              <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-xl text-xs text-zinc-200 whitespace-pre-wrap max-h-[180px] overflow-y-auto leading-relaxed select-text">
                {duel.targetResponse || <span className="text-zinc-650 italic">not captured</span>}
              </div>
            </div>
          </div>

          {/* Footer ids */}
          <div className="pt-3 text-[10px] font-mono text-zinc-500 flex justify-between border-t border-white/5">
            <span>Session: {duel.sessionId}</span>
            <span>ID: {duel.id}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-zinc-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 transition-all duration-200 text-zinc-100 rounded-xl text-[10px] font-bold uppercase tracking-wider"
          >
            Close Ledger
          </button>
        </div>
      </div>
    </div>
  )
}

// Helpers
function defenderTransit(duel: AdminJingDuel, snapshot: any) {
  // If targetTransitSnapshot is empty, fall back to targetTransitSnapshot fields
  if (snapshot) return snapshot
  return (duel as any).targetTransitSnapshot || null
}
