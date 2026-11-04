'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Activity,
  Sparkles,
  Users,
  Clock,
  MessageSquare,
  Star,
  Zap,
  ArrowRight,
  Compass,
  Orbit,
} from 'lucide-react'
import Link from 'next/link'
import { fetchCurrentPlanetaryPositions } from '@/lib/monica/fetch-current-positions'
import { degreeAgentMatcher } from '@/lib/degree-agent-matcher'
import { DEMO_AGENTS } from '@/lib/demo-agents-data'
import { ZodiacWheel } from '@/components/zodiac-wheel'
import { PlanetFBDCard } from '@/components/planet-fbd-card'
import { buildFBDFromWheelPositions, isDiurnal } from '@/lib/alchm-fbd/adapter'
import { rateAgent } from '@/lib/agents/rating'
import { resolveAgentAppearance } from '@/lib/agents/vessel-appearance-manifest'
import { computeAgentProgression } from '@/lib/agents/leveling-service'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'
import { VesselProgressionDisplay } from '@/components/vessel/vessel-progression-display'
import { NatalTransitBiWheel } from '@/components/charts/NatalTransitBiWheel'
import dynamic from 'next/dynamic'
import type { CraftedAgent } from '@/lib/agent-types'

const HistoricalCouncilChat = dynamic(() => import('@/components/misc/historical-council-chat'), {
  loading: () => (
    <div className="h-32 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  ),
})

interface PlanetActivation {
  planet: string
  sign: string
  degree: number
  agents: Array<{ agent: CraftedAgent; activationStrength: number }>
}

export default function TransitsPage() {
  const [planetaryPositions, setPlanetaryPositions] = useState<any>(null)
  const [activations, setActivations] = useState<PlanetActivation[]>([])
  const [wheelTransits, setWheelTransits] = useState<
    Array<{ planet: string; longitude: number; sign: string }>
  >([])
  const [activatedAgentIds, setActivatedAgentIds] = useState<string[]>([])

  // Free-body diagrams for the current sky. Recomputed only when positions
  // change — the engine does a full aspect pass plus a three-layer ESMS
  // decomposition, which is wasted work on every unrelated re-render.
  const fbd = useMemo(
    () => buildFBDFromWheelPositions(wheelTransits, { diurnal: isDiurnal(new Date()) }),
    [wheelTransits]
  )
  // ESMS the ten cards don't carry (Ascendant grounding + the far half of any
  // aspect to a body without a card). Surfaced rather than hidden, so the grid
  // never implies "ten cards = the whole sky".
  const fbdOffCard = fbd
    ? fbd.totals.unattributed.Spirit +
      fbd.totals.unattributed.Essence +
      fbd.totals.unattributed.Matter +
      fbd.totals.unattributed.Substance
    : 0
  const [loading, setLoading] = useState(true)
  const [showGroupChat, setShowGroupChat] = useState(false)
  const [showPersonalBiWheel, setShowPersonalBiWheel] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    loadTransitsAndActivateAgents(true)
    // Refresh every 5 minutes — silently: no loading flash, no modal re-open
    const interval = setInterval(() => loadTransitsAndActivateAgents(false), 300000)
    return () => clearInterval(interval)
  }, [])

  const loadTransitsAndActivateAgents = async (initialLoad: boolean) => {
    try {
      if (initialLoad) setLoading(true)

      // Fetch current planetary positions
      const positions = await fetchCurrentPlanetaryPositions()
      setPlanetaryPositions(positions)

      if (!positions || !positions['Planet Positions']) {
        setLoading(false)
        return
      }

      // Build moment object for degree matching
      const planetPositions = positions['Planet Positions']
      const signs = [
        'Aries',
        'Taurus',
        'Gemini',
        'Cancer',
        'Leo',
        'Virgo',
        'Libra',
        'Scorpio',
        'Sagittarius',
        'Capricorn',
        'Aquarius',
        'Pisces',
      ]

      const planetaryDegrees: Record<string, number> = {}
      const planetActivations: PlanetActivation[] = []
      const currentWheelTransits: Array<{ planet: string; longitude: number; sign: string }> = []

      Object.entries(planetPositions).forEach(([planet, data]: [string, any]) => {
        const signIndex = signs.indexOf(data.sign)
        if (signIndex >= 0) {
          const absoluteDegree = signIndex * 30 + data.degree
          planetaryDegrees[planet] = absoluteDegree

          currentWheelTransits.push({
            planet,
            longitude: absoluteDegree,
            sign: data.sign,
          })

          // Store for display
          planetActivations.push({
            planet,
            sign: data.sign,
            degree: data.degree,
            agents: [],
          })
        }
      })

      // Create moment object for degree matching
      const now = new Date()
      const moment: any = {
        timestamp: now,
        planetaryDegrees,
        alchemical: {
          A_number: (positions['Alchemy Effects'] as any)?.['A#'] || 2.0,
          spirit: positions['Alchemy Effects']?.['Total Spirit'] || 0.25,
          matter: positions['Alchemy Effects']?.['Total Matter'] || 0.25,
          essence: positions['Alchemy Effects']?.['Total Essence'] || 0.25,
          substance: positions['Alchemy Effects']?.['Total Substance'] || 0.25,
        },
        kinetic: {
          velocity: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
          momentum: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
          power: 0,
          inertia: 0,
          metricVelocity: { Heat: 0, Entropy: 0, Reactivity: 0, Energy: 0 },
        },
        thermodynamic: { heat: 0, entropy: 0, reactivity: 0, energy: 0 },
        elemental: { Fire: 0.25, Water: 0.25, Air: 0.25, Earth: 0.25 },
        planetary: {
          dominantPlanet: 'Sun',
          dominantSign: 'Aries',
          moonPhase: 0,
          retrogradeCount: 0,
        },
        consciousness: {
          resonanceLevel: 0.1,
          evolutionPhase: 'Integration',
          spiritualAmplitude: 0.1,
        },
      }

      // Find agent activations
      const matchedActivations = await degreeAgentMatcher.findActivations(moment)

      // Update planet activations with matched agents
      matchedActivations.forEach(activation => {
        const planetActivation = planetActivations.find(p => p.planet === activation.planet)
        if (planetActivation && activation.activatedAgents.length > 0) {
          const agents = activation.activatedAgents.map(aa => ({
            agent: DEMO_AGENTS.find(a => a.id === aa.agentId)!,
            activationStrength: aa.resonanceStrength,
          }))
          planetActivation.agents = agents.filter(a => a.agent)
        }
      })

      // Collect all activated agent IDs (top 5 most activated)
      const allActivatedAgents = planetActivations
        .flatMap(p => p.agents)
        .sort((a, b) => b.activationStrength - a.activationStrength)
        .slice(0, 5)
        .map(a => a.agent.id)

      setActivations(planetActivations.filter(p => p.agents.length > 0))
      setWheelTransits(currentWheelTransits)
      setActivatedAgentIds([...new Set(allActivatedAgents)])
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error loading transits:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPlanetEmoji = (planet: string) => {
    const emojis: Record<string, string> = {
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
    return emojis[planet] || '⭐'
  }

  const activatedAgents = useMemo(
    () => DEMO_AGENTS.filter(a => activatedAgentIds.includes(a.id)),
    [activatedAgentIds]
  )

  // Memoize rated & progressed metadata once for all activated agents in the sky
  const vesselMetaById = useMemo(() => {
    const uniqueIds = new Set<string>()
    activations.forEach(p => p.agents.forEach(item => uniqueIds.add(item.agent.id)))
    activatedAgentIds.forEach(id => uniqueIds.add(id))

    const map = new Map<
      string,
      {
        rating: ReturnType<typeof rateAgent>
        appearance: ReturnType<typeof resolveAgentAppearance>
        progression: ReturnType<typeof computeAgentProgression>
      }
    >()

    uniqueIds.forEach(id => {
      const agent = DEMO_AGENTS.find(a => a.id === id)
      if (!agent) return
      const rating = rateAgent(agent)
      map.set(id, {
        rating,
        appearance: resolveAgentAppearance(agent.id, undefined, rating.archetype),
        progression: computeAgentProgression(agent),
      })
    })
    return map
  }, [activations, activatedAgentIds])

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-amber-400/20 bg-gradient-to-br from-[#12162b]/95 via-[#0d1020]/95 to-[#090b14]/95 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-amber-200 mb-2">
            <Compass className="w-3 h-3 text-amber-300" />
            Live Celestial Telemetry · Rated Vessel Resonance
          </div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2.5 text-zinc-50">
            <Activity className="w-7 h-7 text-amber-400 shrink-0" />
            Current Transits &amp; Vessel Activation
          </h1>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-2xl">
            Real-time planetary degrees resonating with historical &amp; crafted vessels across the
            Pentacle Rating Scale (25–99 OVR) and dynamic celestial progression.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 border-white/15 bg-black/40 text-zinc-200 font-mono text-xs py-1 px-2.5"
          >
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            Updated {mounted ? lastUpdate.toLocaleTimeString() : '—'}
          </Badge>
          {activatedAgentIds.length > 0 && (
            <Badge className="flex items-center gap-1.5 border border-violet-400/40 bg-violet-500/15 text-violet-100 font-mono text-xs py-1 px-2.5">
              <Users className="w-3.5 h-3.5 text-violet-300" />
              {activatedAgentIds.length} Top Vessels Activated
            </Badge>
          )}
          {activatedAgentIds.length > 0 && (
            <Button
              size="sm"
              onClick={() => setShowGroupChat(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-semibold hover:from-amber-400 hover:to-amber-300"
            >
              <MessageSquare className="w-4 h-4" />
              Convene Transit Council
            </Button>
          )}
        </div>
      </div>

      {/* Current Cosmic Energies */}
      {planetaryPositions && (
        <Card className="border border-violet-400/25 bg-[#0d1020]/90 backdrop-blur-md shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-zinc-100">
              <Star className="w-5 h-5 text-amber-400" />
              Current Cosmic Configuration (ESMS Sky Totals)
            </CardTitle>
            <CardDescription className="text-zinc-400 font-mono text-xs">
              Ephemeris snapshot at {mounted ? new Date().toLocaleString() : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {planetaryPositions['Alchemy Effects'] && (
                <>
                  <div className="text-center p-3.5 bg-black/45 rounded-xl border border-violet-400/25">
                    <div className="text-2xl font-mono font-bold text-violet-300">
                      {planetaryPositions['Alchemy Effects']['A#']?.toFixed(2) || 'N/A'}
                    </div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mt-0.5">
                      Alchemical A#
                    </div>
                  </div>
                  <div className="text-center p-3.5 bg-black/45 rounded-xl border border-rose-400/25">
                    <div className="text-2xl font-mono font-bold text-rose-300">
                      {planetaryPositions['Alchemy Effects']['Total Spirit']?.toFixed(1) || 'N/A'}
                    </div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mt-0.5">
                      Spirit
                    </div>
                  </div>
                  <div className="text-center p-3.5 bg-black/45 rounded-xl border border-sky-400/25">
                    <div className="text-2xl font-mono font-bold text-sky-300">
                      {planetaryPositions['Alchemy Effects']['Total Essence']?.toFixed(1) || 'N/A'}
                    </div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mt-0.5">
                      Essence
                    </div>
                  </div>
                  <div className="text-center p-3.5 bg-black/45 rounded-xl border border-amber-400/25">
                    <div className="text-2xl font-mono font-bold text-amber-300">
                      {planetaryPositions['Alchemy Effects']['Total Matter']?.toFixed(1) || 'N/A'}
                    </div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mt-0.5">
                      Matter
                    </div>
                  </div>
                  <div className="text-center p-3.5 bg-black/45 rounded-xl border border-emerald-400/25">
                    <div className="text-2xl font-mono font-bold text-emerald-300">
                      {planetaryPositions['Alchemy Effects']['Total Substance']?.toFixed(1) ||
                        'N/A'}
                    </div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mt-0.5">
                      Substance
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wave 20C: Personal Natal × Live Sky Bi-Wheel & Daily Mentors */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Orbit className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-zinc-100">
              Personal Natal Sky Overlay &amp; Daily Mentors
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPersonalBiWheel(prev => !prev)}
            className="border-white/15 bg-black/40 text-xs font-mono text-zinc-300 hover:text-white"
          >
            {showPersonalBiWheel ? 'Hide Bi-Wheel Overlay' : 'Show Bi-Wheel Overlay'}
          </Button>
        </div>

        {showPersonalBiWheel && (
          <NatalTransitBiWheel
            userName="Visitor Natal Horizon"
            liveTransitPlacements={planetaryPositions?.['Planet Positions']}
            showMentorStrip={true}
          />
        )}
      </div>

      {/* Planetary Transit Visualizer */}
      {!loading && wheelTransits.length > 0 && (
        <Card className="border border-white/10 bg-[#0d1020]/90 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-zinc-100">
              <Sparkles className="w-5 h-5 text-violet-400" />
              Live Transit Visualizer
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Real-time plotting of celestial bodies triggering vessel consciousness parameters.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center p-0 md:p-6 overflow-hidden">
            <div className="w-full max-w-[600px] mx-auto scale-90 sm:scale-100 flex justify-center">
              <ZodiacWheel currentTransits={wheelTransits} natalChart={{ planets: [] }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Free-body diagrams — every force acting on each planet right now */}
      {fbd && fbd.cards.length > 0 && (
        <Card className="border border-white/10 bg-[#0d1020]/90 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              Planetary Free-Body Diagrams
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Every force acting on each planet, drawn at the exact arc minute it occupies — aspects
              at true ecliptic bearings, elemental sign and sect pulls, dignity, and momentum. The
              violet resultant is the planet&apos;s net alchemical tendency.
              {fbdOffCard > 0.005 && (
                <span className="block mt-1 opacity-75 font-mono text-xs">
                  {fbdOffCard.toFixed(2)} ESMS sits off-card (the Ascendant grounding vessel is not
                  a planet and gets no diagram), so the cards deliberately do not sum to the sky
                  total.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="alchm-fbd-root grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {fbd.cards.map(card => (
                <PlanetFBDCard key={card.planet} fbd={card} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transit Activations */}
      {loading ? (
        <Card className="border border-white/10 bg-[#0d1020]/90">
          <CardContent className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
            <p className="text-zinc-400">Loading current transits &amp; rating active vessels...</p>
          </CardContent>
        </Card>
      ) : activations.length === 0 ? (
        <Card className="border border-white/10 bg-[#0d1020]/90">
          <CardContent className="p-12 text-center">
            <Sparkles className="w-16 h-16 text-zinc-500 mx-auto mb-4" />
            <p className="text-zinc-300 font-medium">
              No vessels currently activated by exact transit degrees
            </p>
            <p className="text-sm text-zinc-400 mt-2">
              Planetary positions activate vessels when they align within natal degree orbs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="border border-amber-400/25 bg-[#0d1020]/95 shadow-xl">
            <CardHeader className="border-b border-white/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-zinc-50">
                <Zap className="w-5 h-5 text-amber-400" />
                Active Transit Connections
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Planets activating rated consciousness vessels through live degree resonance — click
                any vessel for its full Codex or quick commune.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              {activations.map(activation => (
                <div
                  key={activation.planet}
                  className="p-4 md:p-5 rounded-xl border border-white/10 bg-gradient-to-br from-[#14182e]/95 to-[#0b0e1b]/95 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/35 bg-amber-400/10 text-2xl text-amber-200 shadow-inner">
                        {getPlanetEmoji(activation.planet)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-base md:text-lg text-zinc-100">
                          {activation.planet} in {activation.sign}
                        </h3>
                        <p className="text-xs md:text-sm font-mono text-zinc-400">
                          {activation.degree.toFixed(1)}° · Activating {activation.agents.length}{' '}
                          vessel{activation.agents.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="border-amber-400/35 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20 hover:text-amber-50"
                    >
                      <Link
                        href={`/gallery?planet=${activation.planet}&sign=${activation.sign}&degree=${activation.degree.toFixed(1)}`}
                        className="flex items-center gap-1.5 font-mono text-xs"
                      >
                        View in Gallery
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {activation.agents.map(({ agent, activationStrength }) => {
                      const meta = vesselMetaById.get(agent.id)
                      const portraitSrc =
                        agent.appearance?.avatar && agent.appearance.avatar.startsWith('http')
                          ? agent.appearance.avatar
                          : meta?.appearance.portraitSvgDataUri
                      return (
                        <div
                          key={agent.id}
                          className="group flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-black/45 p-3.5 hover:border-amber-400/45 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <Link
                              href={`/agent/${agent.id}`}
                              className="flex items-center gap-2.5 min-w-0"
                            >
                              {portraitSrc ? (
                                <img
                                  src={portraitSrc}
                                  alt={agent.name}
                                  className="h-10 w-10 rounded-full border border-amber-400/35 object-cover shrink-0 bg-[#121629]"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full border border-amber-400/35 bg-amber-400/10 flex items-center justify-center font-mono text-xs font-bold text-amber-200 shrink-0">
                                  {agent.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-zinc-100 group-hover:text-amber-200 transition-colors truncate">
                                  {agent.name}
                                </div>
                                {agent.title && (
                                  <div className="text-[11px] text-zinc-400 truncate">
                                    {agent.title}
                                  </div>
                                )}
                              </div>
                            </Link>

                            <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-200">
                              {(activationStrength * 100).toFixed(0)}%
                            </span>
                          </div>

                          {meta && (
                            <VesselRatingRibbon
                              ovr={meta.rating.ovr}
                              archetype={meta.rating.archetype}
                              compact
                            />
                          )}

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                            {meta ? (
                              <VesselProgressionDisplay
                                progression={meta.progression}
                                variant="card-badge"
                              />
                            ) : (
                              <span />
                            )}
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/vault/${agent.id}`}
                                className="rounded-md border border-violet-400/35 bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-violet-100 hover:bg-violet-500/25 transition-colors"
                              >
                                Commune
                              </Link>
                              <Link
                                href={`/agent/${agent.id}`}
                                className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-200 hover:border-amber-400/40 hover:text-amber-200 transition-colors"
                              >
                                Codex →
                              </Link>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Transit-Activated Council Banner */}
          {activatedAgentIds.length > 0 && (
            <Card className="border border-emerald-400/35 bg-gradient-to-r from-emerald-950/60 via-[#0d1522] to-[#0d1020]">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-emerald-100 mb-1">
                      Transit-Activated Consciousness Council
                    </h3>
                    <p className="text-sm text-zinc-300">
                      {activatedAgents.map(a => a.name).join(', ')} are aligned with the live sky
                      and ready for multi-vessel dialogue.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={() => setShowGroupChat(true)}
                    className="flex items-center gap-2 bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Open Council Chat
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Historical Council Chat - Auto-opened with activated agents */}
      <HistoricalCouncilChat
        isOpen={showGroupChat}
        onClose={() => setShowGroupChat(false)}
        historicalAgents={DEMO_AGENTS}
        filterBySelectedAgents={activatedAgentIds}
        title="Transit-Activated Consciousness Council"
        maxAgents={5}
        allowMonica={true}
        showAgentBiographies={true}
        enableTimelineView={false}
        enableEraFilters={false}
        enableSpecializationGroups={false}
      />
    </div>
  )
}
