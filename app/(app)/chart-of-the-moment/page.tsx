'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Wand2, Sparkles, Compass } from 'lucide-react'
import { getPlanetaryDignity, getSignElement, getPlanetaryElement } from '@/lib/astrological-data'
import { usePlanetaryPositionsOnly } from '@/hooks/usePlanetaryPositions'
import ElementalChart from '@/components/charts/elemental-chart'
import NatalWheelSvg, { type WheelBody } from '@/components/charts/natal-wheel-svg'
import TarotCosmicWidget from '@/components/misc/tarot-cosmic-widget'
import NatalSigilGenerator from '@/components/misc/natal-sigil-generator'
import { ChartGeometryExtractor } from '@/lib/chart-geometry-extractor'
import { detectPatternsStatic, PlanetPosition } from '@/lib/astrological-pattern-recognition'
import { RuneGeometry } from '@/lib/runes/natal-sigil-runes'
import { getPlanetaryAgentStats } from '@/lib/agents/planetary-agent-stats'
import { rateStats, evaluateSeals, earnedSeals } from '@/lib/agents/rating'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'

const SIGN_ORDER = [
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

export default function ChartOfTheMomentPage() {
  const [currentTime, setCurrentTime] = useState('')
  const [currentDate, setCurrentDate] = useState('')
  const [isDiurnal, setIsDiurnal] = useState(true)
  const [showSigilGenerator, setShowSigilGenerator] = useState(false)
  const [chartGeometry, setChartGeometry] = useState<RuneGeometry | null>(null)

  // Use unified planetary positions hook for consistency
  const {
    positions: currentPlanetaryPositions,
    loading,
    error,
    refresh,
  } = usePlanetaryPositionsOnly({
    refreshInterval: 30000, // 30 seconds
    useApi: false, // Use direct calculation for backward compatibility
  })

  // Update time and date display
  const updateTimeAndDate = useCallback(() => {
    const now = new Date()

    // Format date as YYYY-MM-DD
    const date = now.toISOString().split('T')[0]

    // Format time as HH:MM
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const time = `${hours}:${minutes}`

    // Determine if it's day or night
    const diurnal = now.getHours() >= 6 && now.getHours() < 18

    setCurrentDate(date)
    setCurrentTime(time)
    setIsDiurnal(diurnal)
  }, [])

  // Update time and date on mount and every minute
  useEffect(() => {
    updateTimeAndDate()
    const interval = setInterval(updateTimeAndDate, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [updateTimeAndDate])

  // Prepare data for ElementalChart component
  const chartPlanets = Object.entries(currentPlanetaryPositions).reduce(
    (acc, [planet, data]) => ({
      ...acc,
      [`${planet.toLowerCase()}Sign`]: data.sign,
    }),
    {}
  )

  // Generate sigil geometry from current planetary positions
  const generateSigilGeometry = useCallback(() => {
    if (Object.keys(currentPlanetaryPositions).length === 0) return

    // Convert current positions to PlanetPosition format
    const planetPositions: PlanetPosition[] = Object.entries(currentPlanetaryPositions).map(
      ([planet, data]) => ({
        planet,
        sign: data.sign,
        degree: parseFloat(data.degree),
        // This location-free chart cannot calculate true houses. Use the
        // deterministic whole-sign ordinal so repeated sigils remain stable.
        house: Math.max(1, SIGN_ORDER.indexOf(data.sign) + 1),
        date: new Date(),
      })
    )

    // Detect patterns
    const { aspects, patterns } = detectPatternsStatic(planetPositions)

    // Extract geometry
    const geometry = ChartGeometryExtractor.extractFromChartData(planetPositions, aspects, 800, 800)

    // Add patterns
    geometry.sacredPatterns = patterns

    // Calculate elemental balance from current positions
    const signElements = Object.values(currentPlanetaryPositions).map(data =>
      getSignElement(data.sign)
    )
    const elementCounts = { Fire: 0, Water: 0, Air: 0, Earth: 0 }
    signElements.forEach(element => {
      elementCounts[element as keyof typeof elementCounts]++
    })

    const total = signElements.length || 1
    geometry.elementalBalance = {
      fire: Math.round((elementCounts.Fire / total) * 100),
      water: Math.round((elementCounts.Water / total) * 100),
      air: Math.round((elementCounts.Air / total) * 100),
      earth: Math.round((elementCounts.Earth / total) * 100),
    }

    // Determine dominant element
    const maxElement = Object.entries(elementCounts).reduce((a, b) =>
      elementCounts[a[0] as keyof typeof elementCounts] >
      elementCounts[b[0] as keyof typeof elementCounts]
        ? a
        : b
    )
    geometry.dominantElement = maxElement[0]

    setChartGeometry(geometry)
    setShowSigilGenerator(true)
  }, [currentPlanetaryPositions])

  const [selectedWheelPlanet, setSelectedWheelPlanet] = useState<string | null>(null)

  const wheelPositions = useMemo(() => {
    const out: Record<string, WheelBody> = {}
    for (const [planet, data] of Object.entries(currentPlanetaryPositions)) {
      const signIdx = Math.max(0, SIGN_ORDER.indexOf(data.sign))
      const deg = parseFloat(data.degree) || 0
      out[planet] = {
        sign: data.sign,
        degree: deg,
        exactLongitude: (signIdx * 30 + deg) % 360,
        isRetrograde: Boolean((data as { isRetrograde?: boolean }).isRetrograde),
      }
    }
    return out
  }, [currentPlanetaryPositions])

  const momentRatingSummary = useMemo(() => {
    const entries = Object.entries(currentPlanetaryPositions)
    if (entries.length === 0) return null
    const totals = {
      power: 0,
      resonance: 0,
      wisdom: 0,
      charisma: 0,
      intuition: 0,
      adaptability: 0,
      vitality: 0,
    }
    for (const [planet, data] of entries) {
      const deg = Math.max(1, Math.min(29, Math.floor(parseFloat(data.degree) || 15)))
      const st = getPlanetaryAgentStats(planet, data.sign, deg)
      totals.power += st.power
      totals.resonance += st.resonance
      totals.wisdom += st.wisdom
      totals.charisma += st.charisma
      totals.intuition += st.intuition
      totals.adaptability += st.adaptability
      totals.vitality += st.vitality
    }
    const n = entries.length
    const avgStats = {
      power: Math.round(totals.power / n),
      resonance: Math.round(totals.resonance / n),
      wisdom: Math.round(totals.wisdom / n),
      charisma: Math.round(totals.charisma / n),
      intuition: Math.round(totals.intuition / n),
      adaptability: Math.round(totals.adaptability / n),
      vitality: Math.round(totals.vitality / n),
    }
    const rated = rateStats(avgStats)
    const sealProgress = evaluateSeals({
      stats: avgStats,
      esmsBalances: { spirit: 45, essence: 45, matter: 45, substance: 45 },
    })
    return {
      rated,
      seals: earnedSeals(sealProgress),
    }
  }, [currentPlanetaryPositions])

  // Get color for element
  const getElementColor = (element: string) => {
    switch (element) {
      case 'Fire':
        return 'border-amber-500/40 bg-amber-500/15 text-amber-300'
      case 'Water':
        return 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
      case 'Air':
        return 'border-violet-400/40 bg-violet-500/15 text-violet-200'
      case 'Earth':
        return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
      default:
        return 'border-white/15 bg-white/5 text-slate-300'
    }
  }

  // Get background color based on dignity
  const getDignityColor = (dignity: string) => {
    switch (dignity) {
      case 'domicile':
        return 'border-emerald-500/35 bg-emerald-500/[0.06] hover:border-emerald-400/60'
      case 'exaltation':
        return 'border-amber-400/40 bg-amber-500/[0.07] hover:border-amber-300/70'
      case 'detriment':
        return 'border-rose-500/30 bg-rose-500/[0.05] hover:border-rose-400/50'
      case 'fall':
        return 'border-orange-500/30 bg-orange-500/[0.05] hover:border-orange-400/50'
      default:
        return 'border-white/10 bg-white/[0.02] hover:border-cyan-400/40'
    }
  }

  // Get dignity badge style
  const getDignityBadge = (dignity: string) => {
    switch (dignity) {
      case 'domicile':
        return 'border-emerald-400/45 bg-emerald-500/15 text-emerald-300'
      case 'exaltation':
        return 'border-amber-400/50 bg-amber-500/15 text-amber-200'
      case 'detriment':
        return 'border-rose-400/45 bg-rose-500/15 text-rose-300'
      case 'fall':
        return 'border-orange-400/45 bg-orange-500/15 text-orange-300'
      default:
        return 'border-white/15 bg-white/5 text-slate-300'
    }
  }

  if (loading) {
    return (
      <div className="container py-12 px-4 mx-auto">
        <h1 className="text-3xl font-bold text-center mb-4">Current Planetary Positions</h1>
        <div className="flex justify-center items-center h-60">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
            <p>Calculating planetary positions...</p>
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-10 px-4 mx-auto space-y-8 max-w-6xl">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-cyan-300">
          <Compass className="h-3.5 w-3.5" />
          Live Ephemeris Sky Sanctum
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-center text-white">
          Current Planetary Positions
        </h1>
        <p className="text-center text-slate-300 max-w-2xl mx-auto">
          Explore the current planetary alignments, live Pentacle Vessel Ratings (25–99 PVR), and
          elemental influences
        </p>
        <div className="font-mono text-xs text-cyan-300/90">
          {currentDate} at {currentTime} · {isDiurnal ? 'Diurnal (Day)' : 'Nocturnal (Night)'} Sky
        </div>
        {momentRatingSummary && (
          <div className="flex justify-center pt-1">
            <VesselRatingRibbon
              ovr={momentRatingSummary.rated.ovr}
              archetype={momentRatingSummary.rated.archetype}
              seals={momentRatingSummary.seals}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh Positions'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={generateSigilGeometry}
          disabled={loading || Object.keys(currentPlanetaryPositions).length === 0}
          className="gap-2"
        >
          <Wand2 className="h-4 w-4" />
          Generate Moment Sigil
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/chart-interpreter?type=current">Interpret in Council →</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Natal Wheel + Tarot Cosmic Moment */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-white/10 bg-[#0d1020]/90 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-center font-mono text-xs uppercase tracking-widest text-cyan-300">
                Interactive Ecliptic Wheel
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <NatalWheelSvg
                positions={wheelPositions}
                size={340}
                selectedPlanet={selectedWheelPlanet}
                onSelectPlanet={setSelectedWheelPlanet}
              />
            </CardContent>
          </Card>

          <TarotCosmicWidget variant="card" showExpanded={false} />

          {Object.keys(chartPlanets).length > 0 && <ElementalChart {...chartPlanets} />}
        </div>

        {/* Right Column: Rated Planetary Transits */}
        <Card className="lg:col-span-7 border-white/10 bg-[#0d1020]/90 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-4">
            <CardTitle className="text-lg font-bold text-white">Chart of the Moment</CardTitle>
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
              Click any transit to commune →
            </span>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(currentPlanetaryPositions).map(([planet, data]) => {
                const dignity = getPlanetaryDignity(planet, data.sign)
                const signElement = getSignElement(data.sign)
                const planetElement = getPlanetaryElement(planet, isDiurnal)
                const degInt = Math.max(1, Math.min(29, Math.floor(parseFloat(data.degree) || 15)))
                const planetStats = getPlanetaryAgentStats(planet, data.sign, degInt)
                const planetRated = rateStats(planetStats)

                return (
                  <Link
                    href={`/agents/${encodeURIComponent(planet)}/${encodeURIComponent(data.sign)}/${degInt}`}
                    key={planet}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 ${getDignityColor(dignity)} transition-all`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{planet}</span>
                        <span className="font-mono text-xs text-cyan-300">
                          {data.sign} {data.degree}°
                        </span>
                      </div>
                      <VesselRatingRibbon
                        ovr={planetRated.ovr}
                        archetype={planetRated.archetype}
                        compact
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className={getElementColor(signElement)}>
                        {signElement}
                      </Badge>
                      <Badge variant="outline" className={getElementColor(planetElement)}>
                        {planetElement}
                      </Badge>
                      <Badge variant="outline" className={`capitalize ${getDignityBadge(dignity)}`}>
                        {dignity}
                      </Badge>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sigil Generator */}
      {showSigilGenerator && chartGeometry && (
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Moment Sigil Generator
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Transform this moment's planetary geometry into a personalized sigil
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Button variant="ghost" size="sm" onClick={() => setShowSigilGenerator(false)}>
                    Hide Generator
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Current moment: {currentDate} {currentTime}
                  </div>
                </div>

                <NatalSigilGenerator
                  geometry={chartGeometry}
                  chartData={{
                    currentPositions: currentPlanetaryPositions,
                    timestamp: new Date().toISOString(),
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
