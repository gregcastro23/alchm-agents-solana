'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  Eye,
  Flame,
  Info,
  Layers,
  Orbit,
  Sparkles,
  Terminal,
  Utensils,
  Zap,
} from 'lucide-react'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'
import {
  ASPECT_DEFINITIONS,
  DEFAULT_USER_NATAL,
  ZODIAC_ELEMENTS,
  ZODIAC_SIGNS,
  angularSeparation,
  computeNatalTransitOverlay,
  type AspectType,
  type CelestialPlacement,
  type DailyMentorMatch,
  type HarmonicCategory,
  type NatalTransitOverlay,
  type TransitAspect,
} from '@/lib/astrology/natal-transit-overlay'

export interface NatalTransitBiWheelProps {
  userNatalPlacements?: Record<string, any> | null
  liveTransitPlacements?: Record<string, any> | null
  userName?: string
  size?: number
  showMentorStrip?: boolean
  className?: string
}

const PLANET_GLYPHS: Record<string, string> = {
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
  Ascendant: 'Asc',
}

const PLANET_COLORS: Record<string, string> = {
  Sun: '#fbbf24',
  Moon: '#f1f5f9',
  Mercury: '#a78bfa',
  Venus: '#f9a8d4',
  Mars: '#fb7185',
  Jupiter: '#fb923c',
  Saturn: '#94a3b8',
  Uranus: '#2dd4bf',
  Neptune: '#60a5fa',
  Pluto: '#c084fc',
  Ascendant: '#e2e8f0',
}

const ZODIAC_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']

const ELEMENT_TINTS: Record<string, string> = {
  Fire: 'rgba(251, 113, 133, 0.12)',
  Earth: 'rgba(52, 211, 153, 0.12)',
  Air: 'rgba(167, 139, 250, 0.12)',
  Water: 'rgba(56, 189, 248, 0.12)',
}

/** Compute Cartesian coordinate for an ecliptic longitude: 0° Aries at 9 o'clock, CCW. */
function polarToCartesian(cx: number, cy: number, r: number, longitude: number): [number, number] {
  const rad = (longitude * Math.PI) / 180
  return [cx - r * Math.cos(rad), cy + r * Math.sin(rad)]
}

export function NatalTransitBiWheel({
  userNatalPlacements = null,
  liveTransitPlacements = null,
  userName = 'Your Natal Chart',
  size = 520,
  showMentorStrip = true,
  className = '',
}: NatalTransitBiWheelProps) {
  const [selectedBody, setSelectedBody] = useState<string | null>(null)
  const [selectedAspectId, setSelectedAspectId] = useState<string | null>(null)
  const [aspectFilter, setAspectFilter] = useState<HarmonicCategory | 'ALL'>('ALL')
  const [showMcpWire, setShowMcpWire] = useState<boolean>(false)
  const [copiedWire, setCopiedWire] = useState<boolean>(false)

  const overlay = useMemo<NatalTransitOverlay>(
    () => computeNatalTransitOverlay(userNatalPlacements, liveTransitPlacements),
    [liveTransitPlacements, userNatalPlacements]
  )

  const filteredAspects = useMemo(() => {
    let list = overlay.aspects
    if (aspectFilter !== 'ALL') {
      list = list.filter(a => a.category === aspectFilter)
    }
    if (selectedBody) {
      list = list.filter(a => a.natalBody === selectedBody || a.transitBody === selectedBody)
    }
    return list
  }, [aspectFilter, overlay.aspects, selectedBody])

  const activeAspect = useMemo<TransitAspect | null>(() => {
    if (selectedAspectId) {
      return overlay.aspects.find(a => a.id === selectedAspectId) ?? overlay.aspects[0] ?? null
    }
    return filteredAspects[0] ?? overlay.aspects[0] ?? null
  }, [filteredAspects, overlay.aspects, selectedAspectId])

  // Bi-Wheel SVG Geometry Radii
  const cx = size / 2
  const cy = size / 2
  const rOuter = size * 0.485
  const rTransitRim = size * 0.445
  const rZodiacOuter = size * 0.415
  const rZodiacInner = size * 0.335
  const rNatalRim = size * 0.305
  const rAspectDisc = size * 0.235

  const handleCopyWire = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(JSON.stringify(overlay.mcpWirePayload, null, 2))
      setCopiedWire(true)
      setTimeout(() => setCopiedWire(false), 1800)
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Bi-Wheel Header & Live Resonance Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-[#090d18]/90 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.55)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">
              <Orbit className="h-3 w-3" /> Concentric Bi-Wheel
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-violet-200">
              Inner Natal × Outer Live Sky
            </span>
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {userName} × Live Planetary Transits
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {overlay.aspects.length} exact geometric aspect chords active today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-3.5 py-2 font-mono text-xs">
            <span className="text-slate-400">Resonance Score: </span>
            <strong className="text-emerald-300">{overlay.overallResonanceScore}/99</strong>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-2xl border border-violet-400/35 bg-violet-500/15 px-3 py-2 font-mono text-xs text-violet-200">
            <Zap className="h-3.5 w-3.5 text-violet-300" />
            <span>
              {overlay.surgeState.tier} (+{overlay.surgeState.deltaOvr} OVR)
            </span>
          </div>
        </div>
      </div>

      {/* Main Wheel + Active Aspect Inspection Grid */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] items-start">
        {/* Left: The Concentric SVG Bi-Wheel */}
        <div className="relative flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#080b14]/95 p-4 sm:p-6 shadow-2xl">
          {/* Legend Strip */}
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono">
            <span className="inline-flex items-center gap-1 text-slate-300">
              <span className="h-2 w-2 rounded-full border border-cyan-400 bg-cyan-500/30" />
              Outer Ring: Live Transits
            </span>
            <span className="text-slate-600">·</span>
            <span className="inline-flex items-center gap-1 text-slate-300">
              <span className="h-2 w-2 rounded-full border border-amber-400 bg-amber-500/30" />
              Inner Ring: Natal Positions
            </span>
            <span className="text-slate-600">·</span>
            <span className="inline-flex items-center gap-1 text-slate-300">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              Harmonic (Trine/Sextile)
            </span>
            <span className="text-slate-600">·</span>
            <span className="inline-flex items-center gap-1 text-slate-300">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              Catalytic (Square/Opp)
            </span>
          </div>

          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-full max-w-[520px] select-none overflow-visible"
            style={{ filter: 'drop-shadow(0 0 35px rgba(0,0,0,0.8))' }}
          >
            <defs>
              <radialGradient id="biwheel-disc-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0a0f1d" stopOpacity="0.95" />
                <stop offset="60%" stopColor="#080c18" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#05070f" stopOpacity="0.95" />
              </radialGradient>
            </defs>

            {/* Central Dark Disc */}
            <circle
              cx={cx}
              cy={cy}
              r={rOuter}
              fill="url(#biwheel-disc-grad)"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
            />

            {/* 12 Zodiac Ring Sectors */}
            {ZODIAC_SIGNS.map((sign, idx) => {
              const startAngle = idx * 30
              const endAngle = (idx + 1) * 30
              const [p1x, p1y] = polarToCartesian(cx, cy, rZodiacInner, startAngle)
              const [p2x, p2y] = polarToCartesian(cx, cy, rZodiacOuter, startAngle)
              const [p3x, p3y] = polarToCartesian(cx, cy, rZodiacOuter, endAngle)
              const [p4x, p4y] = polarToCartesian(cx, cy, rZodiacInner, endAngle)
              const [gx, gy] = polarToCartesian(
                cx,
                cy,
                (rZodiacInner + rZodiacOuter) / 2,
                startAngle + 15
              )
              const element = ZODIAC_ELEMENTS[sign]
              const tint = ELEMENT_TINTS[element] || 'rgba(255,255,255,0.05)'

              const pathData = `M ${p1x} ${p1y} L ${p2x} ${p2y} A ${rZodiacOuter} ${rZodiacOuter} 0 0 1 ${p3x} ${p3y} L ${p4x} ${p4y} A ${rZodiacInner} ${rZodiacInner} 0 0 0 ${p1x} ${p1y} Z`

              return (
                <g key={sign}>
                  <path
                    d={pathData}
                    fill={tint}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={0.75}
                  />
                  <text
                    x={gx}
                    y={gy + 4}
                    fontSize={size * 0.024}
                    fill="rgba(255,255,255,0.75)"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {ZODIAC_GLYPHS[idx]}
                  </text>
                </g>
              )
            })}

            {/* Inner Natal Rim & Outer Transit Rim Circles */}
            <circle
              cx={cx}
              cy={cy}
              r={rNatalRim}
              fill="none"
              stroke="rgba(251, 191, 36, 0.25)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <circle
              cx={cx}
              cy={cy}
              r={rTransitRim}
              fill="none"
              stroke="rgba(56, 189, 248, 0.25)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />

            {/* Aspect Chord Lines (connecting inner natal to outer transit) */}
            {filteredAspects.map(aspect => {
              const [nx, ny] = polarToCartesian(cx, cy, rAspectDisc, aspect.natalLongitude)
              const [tx, ty] = polarToCartesian(cx, cy, rAspectDisc, aspect.transitLongitude)
              const isChordActive =
                activeAspect?.id === aspect.id ||
                selectedBody === aspect.natalBody ||
                selectedBody === aspect.transitBody

              return (
                <g
                  key={aspect.id}
                  onClick={() => setSelectedAspectId(aspect.id)}
                  className="cursor-pointer"
                >
                  <line
                    x1={nx}
                    y1={ny}
                    x2={tx}
                    y2={ty}
                    stroke={aspect.color}
                    strokeWidth={isChordActive ? 2.5 : 1.2}
                    strokeDasharray={aspect.category === 'harmonic' ? undefined : '4 3'}
                    opacity={isChordActive ? 0.95 : selectedBody ? 0.2 : 0.65}
                  />
                </g>
              )
            })}

            {/* Inner Natal Bodies */}
            {Object.values(overlay.userNatal).map(body => {
              const [bx, by] = polarToCartesian(cx, cy, rNatalRim, body.exactLongitude)
              const isSelected = selectedBody === body.planet
              const glyph = PLANET_GLYPHS[body.planet] || body.planet.slice(0, 2)
              const color = PLANET_COLORS[body.planet] || '#f1f5f9'

              return (
                <g
                  key={`natal-${body.planet}`}
                  onClick={() => setSelectedBody(isSelected ? null : body.planet)}
                  className="cursor-pointer transition-transform hover:scale-110"
                >
                  <circle
                    cx={bx}
                    cy={by}
                    r={size * 0.024}
                    fill="#0f172a"
                    stroke={color}
                    strokeWidth={isSelected ? 2.5 : 1.2}
                  />
                  <text
                    x={bx}
                    y={by + 3.5}
                    fontSize={size * 0.022}
                    fill={color}
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {glyph}
                  </text>
                </g>
              )
            })}

            {/* Outer Transit Bodies */}
            {Object.values(overlay.liveTransit).map(body => {
              const [bx, by] = polarToCartesian(cx, cy, rTransitRim, body.exactLongitude)
              const isSelected = selectedBody === body.planet
              const glyph = PLANET_GLYPHS[body.planet] || body.planet.slice(0, 2)
              const color = PLANET_COLORS[body.planet] || '#38bdf8'

              return (
                <g
                  key={`transit-${body.planet}`}
                  onClick={() => setSelectedBody(isSelected ? null : body.planet)}
                  className="cursor-pointer transition-transform hover:scale-110"
                >
                  <circle
                    cx={bx}
                    cy={by}
                    r={size * 0.024}
                    fill="#070d1e"
                    stroke={color}
                    strokeWidth={isSelected ? 2.5 : 1.2}
                  />
                  <text
                    x={bx}
                    y={by + 3.5}
                    fontSize={size * 0.022}
                    fill={color}
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {glyph}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Quick Clear Filter */}
          {selectedBody && (
            <button
              type="button"
              onClick={() => setSelectedBody(null)}
              className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-slate-300 hover:text-white"
            >
              Showing chords for <strong className="text-amber-200">{selectedBody}</strong> (Click
              to reset)
            </button>
          )}
        </div>

        {/* Right: Aspect Chord Detail & Aspect Filter Controls */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'harmonic', 'catalytic', 'fusion'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setAspectFilter(cat)}
                className={`rounded-xl border px-3 py-1.5 font-mono text-xs transition ${
                  aspectFilter === cat
                    ? 'border-amber-400/40 bg-amber-400/15 font-semibold text-amber-200'
                    : 'border-white/10 bg-[#080b14] text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat === 'ALL'
                  ? 'All Chords'
                  : cat === 'harmonic'
                    ? 'Harmonics (△/⚹)'
                    : cat === 'catalytic'
                      ? 'Catalytic (□/☍)'
                      : 'Fusion (☌)'}
              </button>
            ))}
          </div>

          {/* Active Highlighted Aspect Card */}
          {activeAspect && (
            <article className="rounded-2xl border border-amber-400/30 bg-gradient-to-b from-[#111728]/95 to-[#0b0e1a]/95 p-4 shadow-lg">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg font-mono text-base font-bold"
                    style={{ background: `${activeAspect.color}20`, color: activeAspect.color }}
                  >
                    {activeAspect.symbol}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Transiting {activeAspect.transitBody} {activeAspect.aspect} Natal{' '}
                      {activeAspect.natalBody}
                    </h3>
                    <p className="font-mono text-[10px] text-slate-400">
                      Orb: {activeAspect.orb.toFixed(2)}° · Resonance Gain{' '}
                      <strong className="text-emerald-300">{activeAspect.resonanceGain}x</strong>
                    </p>
                  </div>
                </div>

                <span
                  className="rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase"
                  style={{ background: `${activeAspect.color}25`, color: activeAspect.color }}
                >
                  {activeAspect.category}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-slate-300">
                <div className="rounded-xl border border-white/[0.06] bg-black/30 p-2.5">
                  <p className="text-[10px] uppercase text-slate-500">Outer Live Sky</p>
                  <p className="mt-0.5 font-semibold text-cyan-200">
                    {activeAspect.transitBody} in {activeAspect.transitSign}{' '}
                    {activeAspect.transitDegree}°
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/30 p-2.5">
                  <p className="text-[10px] uppercase text-slate-500">Inner Natal</p>
                  <p className="mt-0.5 font-semibold text-amber-200">
                    {activeAspect.natalBody} in {activeAspect.natalSign} {activeAspect.natalDegree}°
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-slate-300">
                {activeAspect.description}
              </p>
            </article>
          )}

          {/* Aspect List Strip */}
          <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
            {filteredAspects.map(aspect => (
              <div
                key={aspect.id}
                onClick={() => setSelectedAspectId(aspect.id)}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-2.5 transition ${
                  activeAspect?.id === aspect.id
                    ? 'border-amber-300/50 bg-amber-400/[0.08]'
                    : 'border-white/[0.07] bg-black/25 hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm" style={{ color: aspect.color }}>
                    {aspect.symbol}
                  </span>
                  <div className="text-xs">
                    <span className="font-medium text-white">
                      {aspect.transitBody} {aspect.aspect} {aspect.natalBody}
                    </span>
                    <p className="font-mono text-[10px] text-slate-400">
                      {aspect.transitSign} ↔ {aspect.natalSign}
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <p className="text-slate-300">{aspect.orb.toFixed(1)}° orb</p>
                  <p className="text-emerald-300">+{aspect.resonanceGain}x</p>
                </div>
              </div>
            ))}
          </div>

          {/* MCP Wire Trigger Accordion */}
          <div className="rounded-2xl border border-white/10 bg-[#080b14] p-3.5">
            <button
              type="button"
              onClick={() => setShowMcpWire(prev => !prev)}
              className="flex w-full items-center justify-between text-left font-mono text-xs text-slate-300 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-cyan-300" />
                @alchm/mcp-server@1.4.0 Wire Payload (`get_transit_natal_overlay`)
              </span>
              {showMcpWire ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showMcpWire && (
              <div className="mt-3 space-y-2 border-t border-white/[0.08] pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-slate-500">
                    Canonical MCP RPC Response
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyWire}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] text-slate-300 hover:text-white"
                    >
                      {copiedWire ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-300" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-cyan-300" /> Copy JSON
                        </>
                      )}
                    </button>
                    <Link
                      href="/desktop"
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-300 hover:underline"
                    >
                      MCP Playground ↗
                    </Link>
                  </div>
                </div>
                <pre className="max-h-40 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/50 p-2.5 font-mono text-[10px] leading-relaxed text-slate-300">
                  {JSON.stringify(overlay.mcpWirePayload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily Historical Mentor Match Section */}
      {showMentorStrip && overlay.topMentors.length > 0 && (
        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <Compass className="h-5 w-5 text-amber-300" />
              <div>
                <h3 className="text-base font-semibold text-white">
                  Daily Historical Mentor Match
                </h3>
                <p className="text-xs text-slate-400">
                  The top 3 historical vessels whose natal charts lock onto your active sky transits
                  today.
                </p>
              </div>
            </div>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-0.5 font-mono text-[10px] text-amber-200">
              Ranked by Sky Synastry
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {overlay.topMentors.map(mentor => (
              <article
                key={mentor.agentId}
                className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#0a0d1a]/95 p-5 shadow-lg transition hover:border-amber-400/30"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-amber-300">
                        #{mentor.rank} Mentor · {mentor.surgeTier}
                      </span>
                      <h4 className="mt-1 text-base font-semibold text-white">
                        {mentor.agentName}
                      </h4>
                      <p className="text-[11px] text-slate-400">{mentor.agentTitle}</p>
                    </div>

                    <VesselRatingRibbon
                      ovr={mentor.pvr}
                      archetype={mentor.archetype}
                      seals={mentor.seals}
                      compact
                    />
                  </div>

                  <div className="mt-3.5 rounded-2xl border border-white/[0.06] bg-black/30 p-2.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Synergy Chord:</span>
                      <strong className="text-cyan-200">
                        {mentor.dominantAspect.transitBody} {mentor.dominantAspect.symbol}{' '}
                        {mentor.dominantAspect.natalBody}
                      </strong>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-slate-400">
                      <span>Mentor Resonance:</span>
                      <strong className="text-emerald-300">
                        {mentor.mentorResonanceScore} / 99
                      </strong>
                    </div>
                  </div>

                  <p className="mt-3 text-xs italic leading-relaxed text-slate-300">
                    “{mentor.resonanceRationale}”
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-1.5 border-t border-white/10 pt-3 text-center font-mono text-[10px]">
                  <Link
                    href={mentor.links.agentProfile}
                    className="rounded-lg border border-white/15 bg-white/[0.04] py-1.5 text-slate-200 hover:bg-white/[0.1]"
                  >
                    Codex
                  </Link>
                  <Link
                    href={mentor.links.synastry}
                    className="rounded-lg border border-violet-400/30 bg-violet-500/10 py-1.5 text-violet-200 hover:bg-violet-500/20"
                  >
                    Synastry
                  </Link>
                  <Link
                    href={mentor.links.culinary}
                    className="rounded-lg border border-amber-400/30 bg-amber-400/10 py-1.5 text-amber-200 hover:bg-amber-400/20"
                  >
                    Kitchen
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default NatalTransitBiWheel
