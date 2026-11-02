'use client'

import React, { useMemo, useState } from 'react'
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  Globe,
  Layers,
  RefreshCw,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react'
import NatalWheelSvg, { type WheelBody } from '@/components/charts/natal-wheel-svg'
import { useSolarReturnCouncil } from '@/hooks/useSolarReturnCouncil'
import { DailyPlanetaryCouncil } from './daily-planetary-council'
import { ModeSwitcher } from './council-mode-switcher'
import {
  COUNCIL_PLANETS,
  type CouncilPlanet,
  type CouncilSpeakerKey,
  type ShiftedRuler,
  type SolarReturnCouncilEdition,
  type SolarReturnCouncilTurn,
  type SolarReturnPlanetPlacement,
  type YearOverYearTelemetry,
} from '@/lib/agents/council/solar-return-types'

const CYCLE_PRESETS: ReadonlyArray<{ years: number; label: string; badge?: string }> = [
  { years: 1, label: '1Y Ago' },
  { years: 2, label: '2Y Ago' },
  { years: 3, label: '3Y Ago' },
  { years: 5, label: '5Y Ago' },
  { years: 7, label: '7Y', badge: 'Saturn Sq' },
  { years: 12, label: '12Y', badge: 'Jupiter Return' },
  { years: 19, label: '19Y', badge: 'Metonic' },
  { years: 29, label: '29Y', badge: 'Saturn Return' },
]

const MAX_YEARS_BACK = 50

const SPEAKER_STYLE: Record<CouncilSpeakerKey, { glyph: string; color: string }> = {
  gregory: { glyph: '✦', color: '#b8fc4b' },
  sun: { glyph: '☉', color: '#fbbf24' },
  moon: { glyph: '☽', color: '#cbd5e1' },
  mercury: { glyph: '☿', color: '#7bd1fa' },
  venus: { glyph: '♀', color: '#f472b6' },
  mars: { glyph: '♂', color: '#fb923c' },
  jupiter: { glyph: '♃', color: '#c084fc' },
  saturn: { glyph: '♄', color: '#a3b8a2' },
  uranus: { glyph: '♅', color: '#67e8f9' },
  neptune: { glyph: '♆', color: '#93c5fd' },
  pluto: { glyph: '♇', color: '#fda4af' },
}

const PLANET_GLYPH: Record<CouncilPlanet, string> = {
  Sun: '☉',
  Moon: '☽',
  Mercury: '☿',
  Venus: '♀',
  Mars: '♂',
  Jupiter: '♃',
  Saturn: '♄',
  Uranus: '♅',
  Neptune: '♆',
  Pluto: '♇',
}

function formatUtc(isoString: string): string {
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function toWheelPositions(
  placements: Record<CouncilPlanet, SolarReturnPlanetPlacement>
): Record<string, WheelBody> {
  const out: Record<string, WheelBody> = {}
  for (const planet of COUNCIL_PLANETS) {
    const p = placements[planet]
    if (!p) continue
    out[planet] = {
      sign: p.sign,
      degree: p.degree,
      exactLongitude: p.longitude,
      isRetrograde: p.retrograde,
    }
  }
  return out
}

function DualSolarReturnWheels({
  telemetry,
  yearsAgo,
  anchorDate,
}: {
  telemetry: YearOverYearTelemetry
  yearsAgo: number
  anchorDate: string
}) {
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null)
  const [showLedger, setShowLedger] = useState(false)

  const returnWheel = useMemo(
    () => toWheelPositions(telemetry.returnSky.positions),
    [telemetry.returnSky.positions]
  )
  const referenceWheel = useMemo(
    () => toWheelPositions(telemetry.referenceSky.positions),
    [telemetry.referenceSky.positions]
  )

  const returnYear = new Date(telemetry.returnSky.iso).getUTCFullYear()
  const refYear = new Date(telemetry.referenceSky.iso).getUTCFullYear()
  const activePlanetKey =
    selectedPlanet && COUNCIL_PLANETS.includes(selectedPlanet as CouncilPlanet)
      ? (selectedPlanet as CouncilPlanet)
      : null
  const selectedReturnPos = activePlanetKey ? telemetry.returnSky.positions[activePlanetKey] : null
  const selectedRefPos = activePlanetKey ? telemetry.referenceSky.positions[activePlanetKey] : null

  return (
    <div className="rounded-2xl border border-[#424936]/80 bg-[#07090d] p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-headline-sm text-base text-amber-300 flex items-center gap-2">
            <Compass className="h-4 w-4 text-amber-400" />
            Solar Return Zodiac Wheels ({returnYear} vs {refYear})
          </h3>
          <p className="text-xs text-[#8c947c] mt-0.5">
            Click any planetary glyph on either wheel to compare its exact degree, retrograde
            motion, and sign dignity across cycles.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowLedger(prev => !prev)}
          aria-expanded={showLedger}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#424936] bg-[#050506] px-3 py-1.5 font-mono text-[11px] text-[#c2cab0] hover:border-amber-400/50 hover:text-[#e0e4d2]"
        >
          <span>{showLedger ? 'Hide 10-Planet Table' : 'View 10-Planet Table'}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showLedger ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-amber-500/25 bg-[#050506]/90 p-4 flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-xs mb-2">
            <span className="font-mono uppercase tracking-wider text-amber-300">
              {yearsAgo === 1 ? '1-Year Return Wheel' : `${yearsAgo}-Year Return (${returnYear})`}
            </span>
            <span className="font-mono text-[11px] text-[#8c947c]">
              {formatUtc(telemetry.returnSky.iso)} UTC
            </span>
          </div>
          <NatalWheelSvg
            positions={returnWheel}
            size={268}
            selectedPlanet={selectedPlanet}
            onSelectPlanet={setSelectedPlanet}
            className="max-w-[268px] w-full h-auto"
          />
        </div>

        <div className="rounded-xl border border-[#b8fc4b]/25 bg-[#050506]/90 p-4 flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-xs mb-2">
            <span className="font-mono uppercase tracking-wider text-[#b8fc4b]">
              {anchorDate ? `Anchor Sky (${refYear})` : `Current Sky (${refYear})`}
            </span>
            <span className="font-mono text-[11px] text-[#8c947c]">
              {formatUtc(telemetry.referenceSky.iso)} UTC
            </span>
          </div>
          <NatalWheelSvg
            positions={referenceWheel}
            size={268}
            selectedPlanet={selectedPlanet}
            onSelectPlanet={setSelectedPlanet}
            className="max-w-[268px] w-full h-auto"
          />
        </div>
      </div>

      {activePlanetKey && selectedReturnPos && selectedRefPos && (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/[0.06] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base text-amber-300">{PLANET_GLYPH[activePlanetKey]}</span>
            <span className="font-semibold text-[#e0e4d2]">{`${activePlanetKey} Cycle Shift`}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="text-amber-200">
              {`${returnYear}: ${selectedReturnPos.sign} ${selectedReturnPos.degree.toFixed(1)}°${selectedReturnPos.retrograde ? ' ℞' : ''} (${selectedReturnPos.dignity})`}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[#b8fc4b]">
              {`${refYear}: ${selectedRefPos.sign} ${selectedRefPos.degree.toFixed(1)}°${selectedRefPos.retrograde ? ' ℞' : ''} (${selectedRefPos.dignity})`}
            </span>
          </div>
        </div>
      )}

      {showLedger && (
        <div className="overflow-x-auto rounded-xl border border-[#424936]/60 bg-[#050506]">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#424936]/50 text-[10px] uppercase tracking-wider text-[#8c947c]">
                <th className="px-3 py-2">Body</th>
                <th className="px-3 py-2 text-amber-300">{returnYear} Solar Return</th>
                <th className="px-3 py-2 text-[#b8fc4b]">{refYear} Reference</th>
                <th className="px-3 py-2">Sign Shift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#424936]/30">
              {COUNCIL_PLANETS.map(planet => {
                const ret = telemetry.returnSky.positions[planet]
                const ref = telemetry.referenceSky.positions[planet]
                const shifted = ret.sign !== ref.sign
                return (
                  <tr
                    key={planet}
                    onClick={() => setSelectedPlanet(prev => (prev === planet ? null : planet))}
                    className="cursor-pointer hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2 font-semibold text-[#e0e4d2]">
                      {`${PLANET_GLYPH[planet]} ${planet} Body`}
                    </td>
                    <td className="px-3 py-2 text-amber-200/90 tabular-nums">
                      {`${ret.sign} ${ret.degree.toFixed(1)}°${ret.retrograde ? ' ℞' : ''} · ${ret.dignity}`}
                    </td>
                    <td className="px-3 py-2 text-[#e0e4d2] tabular-nums">
                      {`${ref.sign} ${ref.degree.toFixed(1)}°${ref.retrograde ? ' ℞' : ''} · ${ref.dignity}`}
                    </td>
                    <td className="px-3 py-2">
                      {shifted ? (
                        <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-200">
                          {`${ret.sign} → ${ref.sign}`}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#8c947c]">Same Sign</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function HeroEchoCard({
  telemetry,
  yearsAgo = 1,
  anchorDate = '',
}: {
  telemetry: YearOverYearTelemetry
  yearsAgo?: number
  anchorDate?: string
}) {
  const { solarAlignment, returnSky, referenceSky } = telemetry
  const deltaLabel = `Δ < ${Math.max(0.001, solarAlignment.deltaArcminutes).toFixed(3)}'`
  const returnYear = new Date(returnSky.iso).getUTCFullYear()

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#14120a] to-[#070709] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          <span className="text-amber-400">☉</span>
          <span>Solar Return Conclave</span>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#424936]/80 bg-[#090b0e] px-3 py-1 text-xs text-[#c2cab0]">
          <Compass className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-mono text-[#e0e4d2]">
            {solarAlignment.degree}° {solarAlignment.minute}&apos; {solarAlignment.sign}
          </span>
          <span className="text-amber-400/80">· Exact Match ({deltaLabel})</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#424936]/50 bg-[#0c0f12]/80 p-3">
          <p className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-amber-400/90">
            <Clock className="h-3.5 w-3.5" />{' '}
            {yearsAgo === 1
              ? '1 Year Ago (Historical Return)'
              : `${yearsAgo} Years Ago (${returnYear} Solar Return)`}
          </p>
          <p className="mt-1 font-headline-sm text-sm text-[#e0e4d2]">
            {formatUtc(returnSky.iso)} UTC
          </p>
          <p className="mt-0.5 text-xs text-[#8c947c]">
            Epoch coordinate alignment · {returnSky.quality}
          </p>
        </div>

        <div className="rounded-xl border border-[#424936]/50 bg-[#0c0f12]/80 p-3">
          <p className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[#b8fc4b]">
            <Globe className="h-3.5 w-3.5" />{' '}
            {anchorDate ? `Anchor Sky (${anchorDate})` : 'Today (Reference Sky)'}
          </p>
          <p className="mt-1 font-headline-sm text-sm text-[#e0e4d2]">
            {formatUtc(referenceSky.iso)} UTC
          </p>
          <p className="mt-0.5 text-xs text-[#8c947c]">
            Current celestial baseline · {referenceSky.quality}
          </p>
        </div>
      </div>
    </div>
  )
}

function ShiftedRulersBadges({ rulers }: { rulers: ShiftedRuler[] }) {
  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#7bd1fa]">
        <Zap className="h-3.5 w-3.5" /> Shifted Fast Rulers (Year-over-Year)
      </h4>
      <div className="flex flex-wrap gap-2">
        {rulers.map(ruler => {
          const glyph = PLANET_GLYPH[ruler.planet]
          return (
            <div
              key={ruler.planet}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                ruler.shifted
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : 'border-[#424936]/60 bg-[#050506]/60 text-[#8c947c]'
              }`}
            >
              <span className="font-semibold text-amber-400">
                {glyph} {ruler.planet}
              </span>
              {ruler.shifted ? (
                <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                  <span>{ruler.fromSign}</span>
                  <ArrowRight className="h-3 w-3 text-amber-400" />
                  <span className="text-[#b8fc4b]">{ruler.toSign}</span>
                </span>
              ) : (
                <span className="text-[11px] text-[#8c947c]">{ruler.fromSign} (Stationary)</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ElementalSpectrumGauges({ telemetry }: { telemetry: YearOverYearTelemetry }) {
  const elements = [
    {
      key: 'fire',
      label: 'Fire',
      color: '#fb923c',
      ret: telemetry.returnSky.elements.percentages.fire,
      ref: telemetry.referenceSky.elements.percentages.fire,
    },
    {
      key: 'water',
      label: 'Water',
      color: '#7bd1fa',
      ret: telemetry.returnSky.elements.percentages.water,
      ref: telemetry.referenceSky.elements.percentages.water,
    },
    {
      key: 'earth',
      label: 'Earth',
      color: '#b8fc4b',
      ret: telemetry.returnSky.elements.percentages.earth,
      ref: telemetry.referenceSky.elements.percentages.earth,
    },
    {
      key: 'air',
      label: 'Air',
      color: '#cbd5e1',
      ret: telemetry.returnSky.elements.percentages.air,
      ref: telemetry.referenceSky.elements.percentages.air,
    },
  ]

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#b8fc4b]">
        <Flame className="h-3.5 w-3.5" /> Elemental Quad-Spectrum Contrast
      </h4>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {elements.map(el => (
          <div
            key={el.key}
            className="rounded-xl border border-[#424936]/50 bg-[#090b0e] p-3 text-xs"
          >
            <div className="flex items-center justify-between font-medium">
              <span style={{ color: el.color }}>{el.label}</span>
              <span className="font-mono text-[11px] text-[#8c947c]">
                {Math.round(el.ret * 100)}% return → {Math.round(el.ref * 100)}% today
              </span>
            </div>
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1b2018]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round(el.ret * 100)}%`,
                    backgroundColor: el.color,
                    opacity: 0.6,
                  }}
                />
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1b2018]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.round(el.ref * 100)}%`, backgroundColor: el.color }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ThermodynamicShiftCard({ telemetry }: { telemetry: YearOverYearTelemetry }) {
  const { thermodynamicDeltas, esmsDeltas } = telemetry
  const heatSign = thermodynamicDeltas.heat >= 0 ? '+' : ''
  const reactSign = thermodynamicDeltas.reactivity >= 0 ? '+' : ''

  return (
    <div className="rounded-xl border border-[#424936]/60 bg-[#090b0e] p-4 text-xs">
      <h4 className="flex items-center gap-2 font-mono uppercase tracking-wider text-amber-300">
        <Layers className="h-3.5 w-3.5" /> Thermodynamic & ESMS Balance Deltas
      </h4>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-[#050506] p-2.5">
          <p className="text-[10px] text-[#8c947c]">Heat Delta</p>
          <p className="mt-0.5 font-mono text-sm text-[#e0e4d2]">
            {heatSign}
            {thermodynamicDeltas.heat.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg bg-[#050506] p-2.5">
          <p className="text-[10px] text-[#8c947c]">Reactivity</p>
          <p className="mt-0.5 font-mono text-sm text-[#e0e4d2]">
            {reactSign}
            {thermodynamicDeltas.reactivity.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg bg-[#050506] p-2.5">
          <p className="text-[10px] text-[#8c947c]">Spirit / Essence</p>
          <p className="mt-0.5 font-mono text-sm text-[#e0e4d2]">
            {esmsDeltas.spirit >= 0 ? '+' : ''}
            {esmsDeltas.spirit.toFixed(1)} / {esmsDeltas.essence >= 0 ? '+' : ''}
            {esmsDeltas.essence.toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg bg-[#050506] p-2.5">
          <p className="text-[10px] text-[#8c947c]">Matter / Substance</p>
          <p className="mt-0.5 font-mono text-sm text-[#e0e4d2]">
            {esmsDeltas.matter >= 0 ? '+' : ''}
            {esmsDeltas.matter.toFixed(1)} / {esmsDeltas.substance >= 0 ? '+' : ''}
            {esmsDeltas.substance.toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  )
}

function DualSkyComparisonStrip({ telemetry }: { telemetry: YearOverYearTelemetry }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-2xl border border-[#424936]/80 bg-[#050506]/60 p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-controls="dual-sky-comparison-details"
        aria-label="Toggle Year-over-Year Dual Sky Telemetry details"
        className="flex w-full items-center justify-between text-left text-sm text-[#c2cab0] hover:text-[#e0e4d2]"
      >
        <span className="flex items-center gap-2 font-headline-sm text-base text-[#7bd1fa]">
          <Sparkles className="h-4 w-4 text-amber-400" />
          Year-over-Year Dual Sky Telemetry
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          id="dual-sky-comparison-details"
          className="mt-4 space-y-4 border-t border-[#424936]/60 pt-4"
        >
          <ShiftedRulersBadges rulers={telemetry.shiftedRulers} />
          <ElementalSpectrumGauges telemetry={telemetry} />
          <ThermodynamicShiftCard telemetry={telemetry} />
        </div>
      )}
    </div>
  )
}

function TurnCard({ turn }: { turn: SolarReturnCouncilTurn }) {
  const [expanded, setExpanded] = useState(false)
  const style = SPEAKER_STYLE[turn.speakerKey] || SPEAKER_STYLE.gregory
  const isHost = turn.speakerKey === 'gregory'

  const hostRoleBadge =
    turn.role === 'opening'
      ? 'Opening Inception'
      : turn.role === 'integration'
        ? 'Midway Integration'
        : turn.role === 'closing'
          ? 'Conclave Synthesis'
          : 'Host'

  return (
    <li
      className={`grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-xl transition-colors sm:gap-x-4 ${
        isHost
          ? 'border border-[#b8fc4b]/20 bg-[#b8fc4b]/[0.03] p-4 sm:p-5'
          : 'border border-[#424936]/40 bg-[#090b0e]/80 p-4'
      }`}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-xl border bg-[#050506] text-xl"
        style={{ color: style.color, borderColor: `${style.color}50` }}
      >
        {style.glyph}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-headline-sm text-sm font-semibold" style={{ color: style.color }}>
            {turn.speakerName}
          </span>

          {isHost && (
            <span className="rounded bg-[#b8fc4b]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#b8fc4b]">
              {hostRoleBadge}
            </span>
          )}

          <span className="text-[10px] text-[#8c947c]">
            {turn.provenance.source === 'grounded_briefing'
              ? 'Astronomical briefing'
              : 'Council voice'}
          </span>
        </div>

        <p className="mt-2 max-w-[82ch] whitespace-pre-wrap font-body-md text-sm leading-7 text-[#e0e4d2]">
          {turn.text}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(prev => !prev)}
            aria-expanded={expanded}
            aria-controls={`evidence-${turn.id}`}
            aria-label={`Toggle claim evidence for ${turn.speakerName}`}
            className="inline-flex items-center gap-1 rounded border border-[#424936]/60 bg-[#050506] px-2 py-1 text-[11px] text-[#c2cab0] hover:border-[#7bd1fa]/60"
          >
            <span>Core claim</span>
            <ChevronDown
              aria-hidden="true"
              className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>

          {turn.coverageIds.map(topic => (
            <span
              key={topic}
              className="rounded bg-[#424936]/30 px-2 py-0.5 text-[10px] text-[#8c947c]"
            >
              #{topic}
            </span>
          ))}
        </div>

        {expanded && (
          <div
            id={`evidence-${turn.id}`}
            className="mt-2.5 rounded-lg border border-[#7bd1fa]/30 bg-[#7bd1fa]/[0.04] p-3 text-xs leading-relaxed text-[#c2cab0]"
          >
            <p className="font-medium text-[#7bd1fa]">Substantive Claim:</p>
            <p className="mt-0.5 text-[#e0e4d2]">{turn.newClaim}</p>
          </div>
        )}
      </div>
    </li>
  )
}

export { ModeSwitcher }

function FollowUpContainer() {
  const [question, setQuestion] = useState('')
  const [submitted, setSubmitted] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return
    setSubmitted(question.trim())
    setQuestion('')
  }

  return (
    <div className="rounded-xl border border-[#424936]/60 bg-[#090b0e] p-4 sm:p-5">
      <h4 className="font-headline-sm text-sm text-[#7bd1fa]">
        Inquire into the Solar Return Conclave
      </h4>
      <p className="mt-1 text-xs text-[#8c947c]">
        Ask Gregory and the planetary delegates how this 1-year celestial delta influences your
        current cycle.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask about your year-over-year elemental shift..."
          aria-label="Private question for the Solar Return Council"
          className="min-w-0 flex-1 rounded-lg border border-[#424936] bg-[#050506] px-3 py-2 text-xs text-[#e0e4d2] placeholder-[#8c947c] focus:border-amber-400 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Submit question to Solar Return Council"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-semibold text-[#050506] hover:bg-amber-300"
        >
          <Send className="h-3 w-3" />
          <span>Ask</span>
        </button>
      </form>

      {submitted && (
        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/[0.04] p-3 text-xs text-[#c2cab0]">
          <p className="font-medium text-amber-300">Council reflection queued:</p>
          <p className="mt-0.5 text-[#e0e4d2]">&ldquo;{submitted}&rdquo;</p>
        </div>
      )}
    </div>
  )
}

export interface SolarReturnCouncilProps {
  initialEdition?: SolarReturnCouncilEdition | null
  defaultMode?: 'live' | 'solar-return'
  onModeSelect?: (mode: 'live' | 'solar-return') => void
  compact?: boolean
  onOpenCouncil?: () => void
}

export function SolarReturnCouncil({
  initialEdition,
  defaultMode = 'solar-return',
  onModeSelect,
  compact = false,
  onOpenCouncil,
}: SolarReturnCouncilProps) {
  const [activeMode, setActiveMode] = useState<'live' | 'solar-return'>(defaultMode)
  const [yearsAgo, setYearsAgo] = useState<number>(1)
  const [anchorDate, setAnchorDate] = useState<string>('')

  const { state, refresh } = useSolarReturnCouncil({
    date: anchorDate || undefined,
    yearsAgo,
  })

  const useInitial = Boolean(initialEdition && yearsAgo === 1 && !anchorDate)
  const edition = useInitial ? initialEdition : state.edition
  const loading = !useInitial && state.loading
  const error = !useInitial ? state.error : null

  const refYear = useMemo(() => {
    if (anchorDate) {
      const parsed = new Date(`${anchorDate}T12:00:00Z`)
      if (!isNaN(parsed.getTime())) return parsed.getUTCFullYear()
    }
    if (edition?.referenceIso) {
      const parsed = new Date(edition.referenceIso)
      if (!isNaN(parsed.getTime())) return parsed.getUTCFullYear()
    }
    return new Date().getUTCFullYear()
  }, [anchorDate, edition?.referenceIso])

  const handleModeChange = (next: 'live' | 'solar-return') => {
    setActiveMode(next)
    onModeSelect?.(next)
  }

  if (activeMode === 'live') {
    return (
      <DailyPlanetaryCouncil
        compact={compact}
        onOpenCouncil={onOpenCouncil}
        activeCouncilMode="live"
        onCouncilModeChange={handleModeChange}
      />
    )
  }

  return (
    <section
      id="solar-return-council"
      aria-label="Solar Return Historical Planetary Council"
      className="rounded-3xl border border-[#424936] bg-[#050506] p-4 text-[#e0e4d2] sm:p-6 lg:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ModeSwitcher mode={activeMode} onModeChange={handleModeChange} />
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Refresh Solar Return Council Edition"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#424936] px-3 py-1.5 text-xs text-[#c2cab0] hover:text-[#e0e4d2] disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Multi-Year Solar Return Time Machine Controls */}
      <div className="mt-4 rounded-2xl border border-amber-500/25 bg-[#090b0e] p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setYearsAgo(prev => Math.min(MAX_YEARS_BACK, prev + 1))}
              disabled={yearsAgo >= MAX_YEARS_BACK || loading}
              aria-label="Step back one solar return year"
              className="inline-flex items-center gap-1 rounded-lg border border-[#424936] bg-[#050506] px-2.5 py-1.5 font-mono text-xs text-[#e0e4d2] hover:border-amber-400/60 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-amber-400" />
              <span>Older Year</span>
            </button>

            <label className="inline-flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 font-mono text-xs text-amber-200">
              <span>Cycle:</span>
              <select
                aria-label="Select Solar Return years back"
                value={yearsAgo}
                onChange={e => setYearsAgo(Number(e.target.value))}
                className="bg-transparent font-semibold text-amber-300 focus:outline-none"
              >
                {Array.from({ length: MAX_YEARS_BACK }, (_, i) => i + 1).map(yr => (
                  <option key={yr} value={yr} className="bg-[#090b0e] text-[#e0e4d2]">
                    {`-${yr} ${yr === 1 ? 'Year' : 'Years'} (${refYear - yr})`}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setYearsAgo(prev => Math.max(1, prev - 1))}
              disabled={yearsAgo <= 1 || loading}
              aria-label="Step forward one solar return year"
              className="inline-flex items-center gap-1 rounded-lg border border-[#424936] bg-[#050506] px-2.5 py-1.5 font-mono text-xs text-[#e0e4d2] hover:border-amber-400/60 disabled:opacity-40"
            >
              <span>Newer Year</span>
              <ChevronRight className="h-3.5 w-3.5 text-amber-400" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-[#424936] bg-[#050506] px-2.5 py-1.5 text-xs text-[#c2cab0]">
              <Calendar className="h-3.5 w-3.5 text-[#b8fc4b]" />
              <span className="font-mono text-[11px]">Anchor Date:</span>
              <input
                type="date"
                aria-label="Anchor date for Solar Return lookup"
                value={anchorDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setAnchorDate(e.target.value)}
                className="bg-transparent font-mono text-xs text-[#e0e4d2] focus:outline-none"
              />
            </label>
            {(anchorDate || yearsAgo !== 1) && (
              <button
                type="button"
                onClick={() => {
                  setAnchorDate('')
                  setYearsAgo(1)
                }}
                className="rounded-lg border border-[#424936] px-2.5 py-1.5 font-mono text-[11px] text-[#b8fc4b] hover:border-[#b8fc4b]/50"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-[#8c947c]">
            Cycle Jumps:
          </span>
          {CYCLE_PRESETS.map(preset => {
            const active = yearsAgo === preset.years
            return (
              <button
                key={preset.years}
                type="button"
                onClick={() => setYearsAgo(preset.years)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                  active
                    ? 'border-amber-400 bg-amber-400/20 font-semibold text-amber-200'
                    : 'border-[#424936]/70 bg-[#050506] text-[#c2cab0] hover:border-amber-400/40 hover:text-[#e0e4d2]'
                }`}
              >
                <span>{preset.label}</span>
                {preset.badge && (
                  <span className="text-[9px] text-amber-300/80">· {preset.badge}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div id="council-panel" className="mt-6 space-y-6">
        {edition ? (
          <>
            <HeroEchoCard
              telemetry={edition.telemetry}
              yearsAgo={edition.yearsAgo ?? yearsAgo}
              anchorDate={anchorDate}
            />

            <DualSolarReturnWheels
              telemetry={edition.telemetry}
              yearsAgo={edition.yearsAgo ?? yearsAgo}
              anchorDate={anchorDate}
            />

            <div>
              <h2 className="font-headline-sm text-2xl text-[#e0e4d2] sm:text-3xl">
                {edition.title}
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[#c2cab0]">
                {edition.summary}
              </p>
            </div>

            <DualSkyComparisonStrip telemetry={edition.telemetry} />

            <div className="space-y-4">
              <h3 className="font-headline-sm text-base text-[#7bd1fa]">
                Round Table Historical Deliberation
              </h3>
              <ol className="space-y-3" aria-label="Solar Return Conclave Conversation">
                {edition.turns.map(turn => (
                  <TurnCard key={turn.id} turn={turn} />
                ))}
              </ol>
            </div>

            <FollowUpContainer />
          </>
        ) : loading ? (
          <div className="flex items-center gap-3 py-12 text-sm text-[#8c947c]">
            <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
            <span>
              Resolving {yearsAgo}-Year Solar Return ephemeris ({refYear - yearsAgo}) and convening
              delegates…
            </span>
          </div>
        ) : (
          <div role="alert" className="py-8 text-sm text-amber-200">
            {error || 'Solar return historical council is currently unavailable.'}
          </div>
        )}
      </div>
    </section>
  )
}
