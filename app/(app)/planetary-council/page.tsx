'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import PlanetaryWisdomChat from '@/components/misc/planetary-wisdom-chat'
import { SolarReturnCouncil } from '@/components/landing/solar-return-council'
import { usePlanetaryPositions } from '@/hooks/usePlanetaryPositions'
import { getPlanetaryAgentStats } from '@/lib/agents/planetary-agent-stats'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'
import { rateStats, evaluateSeals, earnedSeals, type CoreStats } from '@/lib/agents/rating'

export default function PlanetaryCouncilPage() {
  const [isOpen, setIsOpen] = useState(true)
  const skyData = usePlanetaryPositions()
  const skySource = skyData.planetaryPositions[0]?.source
  const isLiveSwiss = skySource === 'swiss-ephemeris'

  const councilRating = useMemo(() => {
    const positions = skyData.planetaryPositions.length
      ? skyData.planetaryPositions
      : [
          { planet: 'Sun', sign: 'Leo', degree: 15 },
          { planet: 'Moon', sign: 'Cancer', degree: 12 },
          { planet: 'Mercury', sign: 'Gemini', degree: 10 },
        ]
    const list = positions.map(p =>
      getPlanetaryAgentStats(p.planet, p.sign, Math.round(p.degree ?? 15))
    )
    const keys: Array<keyof CoreStats> = [
      'power',
      'resonance',
      'wisdom',
      'charisma',
      'intuition',
      'adaptability',
      'vitality',
    ]
    const stats = {} as CoreStats
    for (const k of keys) {
      stats[k] = Math.min(99, Math.round(list.reduce((acc, s) => acc + s[k], 0) / list.length) + 3)
    }
    const esmsBalances = {
      spirit: Math.max(28, Math.round((skyData.alchmQuantities?.spirit ?? 0.3) * 120)),
      essence: Math.max(28, Math.round((skyData.alchmQuantities?.essence ?? 0.3) * 120)),
      matter: Math.max(28, Math.round((skyData.alchmQuantities?.matter ?? 0.25) * 120)),
      substance: Math.max(28, Math.round((skyData.alchmQuantities?.substance ?? 0.25) * 120)),
    }
    const seals = earnedSeals(evaluateSeals({ stats, esmsBalances }))
    const rated = rateStats(stats)
    return { stats, seals, ...rated }
  }, [skyData.planetaryPositions, skyData.alchmQuantities])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c0319] via-[#1a0838] to-[#0c0319] text-white relative">
      {/* Starfield Background */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(2px 2px at 15% 25%, rgba(255, 255, 255, 0.7), transparent), radial-gradient(1.5px 1.5px at 78% 12%, rgba(167, 139, 250, 0.8), transparent), radial-gradient(1px 1px at 35% 68%, rgba(255, 255, 255, 0.6), transparent)',
          backgroundSize: '500px 500px, 400px 400px, 300px 300px',
        }}
      />

      <div className="container relative z-10 mx-auto py-8 px-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <MessageSquare className="w-8 h-8 text-purple-500" />
            Planetary Council Chamber
          </h1>
          <p className="text-lg text-purple-200/70 max-w-2xl mx-auto">
            Convene a council of planetary agents to receive multifaceted wisdom. Each planet brings
            its unique perspective, creating a symphony of cosmic guidance.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider ${
                isLiveSwiss
                  ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-400/30 bg-amber-500/10 text-amber-200'
              }`}
              title="Active ephemeris provenance feeding council dignity and transit calculations"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isLiveSwiss ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              {isLiveSwiss ? 'Swiss Ephemeris · Live' : 'VSOP87 Approx'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-900/20 px-3 py-1 text-xs text-blue-200 backdrop-blur-md">
              🌙 <strong className="text-blue-100">360° Moon Phase Intelligence</strong> active
            </span>
            <Link
              href="/council-feed"
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/35 bg-violet-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-violet-200 hover:bg-violet-500/20"
            >
              Live Council Feed →
            </Link>
            <Link
              href="/arena"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-amber-200 hover:bg-amber-500/20"
            >
              Synastry Arena →
            </Link>
          </div>
          <div className="mt-4 flex justify-center">
            <VesselRatingRibbon
              ovr={councilRating.ovr}
              archetype={councilRating.archetype}
              seals={councilRating.seals}
              compact
            />
          </div>
          <div className="mt-3 text-xs text-purple-300/60">
            Tip: Review Gregory Castro&apos;s Daily Planetary Council briefing below or convene a
            custom multi-planet chamber synced to the live sky.
          </div>

          {!isOpen && (
            <div className="mt-4">
              <Button onClick={() => setIsOpen(true)} size="lg">
                <MessageSquare className="w-5 h-5 mr-2" />
                Open Planetary Council
              </Button>
            </div>
          )}
        </div>

        <div className="mb-10 max-w-6xl mx-auto">
          <SolarReturnCouncil defaultMode="live" onOpenCouncil={() => setIsOpen(true)} />
        </div>

        <PlanetaryWisdomChat
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          defaultActivePlanets={['Sun', 'Moon', 'Mercury']}
          enableAutoSync={true}
          syncInterval={60000}
          showCurrentSkyChart={true}
          enableTransitAlerts={true}
          planetaryHourNotifications={true}
          title="Planetary Council Chamber"
          maxAgents={7}
          allowMonica={true}
        />

        <div className="mt-12 max-w-3xl mx-auto">
          <div className="bg-black/40 backdrop-blur-md rounded-lg p-6 border border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.05)]">
            <h2 className="text-xl font-semibold mb-3 text-white">
              How the Planetary Council Works
            </h2>
            <ul className="space-y-2 text-sm text-purple-200/70">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Select up to 5 planetary agents to form your council</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Configure each planet's zodiacal position for personalized responses</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Each agent responds from their unique planetary perspective</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Planets in strong dignity positions speak with greater authority</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Responses incorporate current alchemical energies (A-Number)</span>
              </li>
            </ul>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="bg-black/40 backdrop-blur-md rounded-lg p-5 border border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.05)] hover:border-purple-500/30 transition-colors">
              <h3 className="font-semibold mb-2 text-white">Beneficial Combinations</h3>
              <ul className="text-sm space-y-1 text-purple-200/70">
                <li>
                  <span className="text-amber-400">☉ Sun</span> +{' '}
                  <span className="text-gray-300">☽ Moon</span>: Balance of conscious and
                  unconscious
                </li>
                <li>
                  <span className="text-pink-400">♀ Venus</span> +{' '}
                  <span className="text-red-500">♂ Mars</span>: Harmony and action in relationships
                </li>
                <li>
                  <span className="text-orange-400">☿ Mercury</span> +{' '}
                  <span className="text-blue-400">♃ Jupiter</span>: Communication and wisdom
                </li>
                <li>
                  <span className="text-purple-400">♄ Saturn</span> +{' '}
                  <span className="text-cyan-400">♅ Uranus</span>: Structure meets innovation
                </li>
              </ul>
            </div>

            <div className="bg-black/40 backdrop-blur-md rounded-lg p-5 border border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.05)] hover:border-purple-500/30 transition-colors">
              <h3 className="font-semibold mb-2 text-white">Council Dynamics</h3>
              <ul className="text-sm space-y-1 text-purple-200/70">
                <li>Planets in domicile speak with natural authority</li>
                <li>Exalted planets offer elevated perspectives</li>
                <li>Planets in fall provide lessons through challenges</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
