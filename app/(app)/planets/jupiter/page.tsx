/**
 * Jupiter planet page — fully RSC.
 *
 * All data is either static or pre-fetched server-side; the only
 * "client-like" action (navigate to Jupiter agent) is handled via Link.
 */

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HistoricalTransitCard } from '@/components/misc/historical-transit-card'
import { getTransitsByPlanet } from '@/lib/historical-transit-data'
import { identifyPlanetaryThemes } from '@/lib/transit-patterns'
import { getPlanetaryAgentStats } from '@/lib/agents/planetary-agent-stats'
import { rateStats, evaluateSeals, earnedSeals } from '@/lib/agents/rating'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'
import { backend } from '@/lib/backend'
import { ArrowLeft, ArrowRight, Sparkles, Calendar, TrendingUp } from 'lucide-react'

export default async function JupiterPage() {
  // Pre-fetch live position
  let currentPosition: { sign: string; degree: string } | null = null
  let currentThemes: any = null
  try {
    const data = await backend.planetary.positions()
    const jupiter = (data as any)?.planetary_positions?.Jupiter
    if (jupiter) {
      currentPosition = {
        sign: jupiter.sign || '',
        degree:
          typeof jupiter.degree === 'number'
            ? jupiter.degree.toFixed(2)
            : String(jupiter.degree ?? '0'),
      }
      currentThemes = identifyPlanetaryThemes('Jupiter', jupiter.sign || '')
    }
  } catch {
    // Render without live position — static content still shows
  }

  // Static historical data (synchronous)
  const jupiterTransits = getTransitsByPlanet('Jupiter').slice(-10)

  const activeSign = currentPosition?.sign || 'Sagittarius'
  const activeDegree = Math.max(
    1,
    Math.min(30, Math.round(parseFloat(currentPosition?.degree || '15') || 15))
  )
  const jupiterStats = getPlanetaryAgentStats('Jupiter', activeSign, activeDegree)
  const jupiterRated = rateStats(jupiterStats)
  const jupiterSeals = earnedSeals(
    evaluateSeals({
      stats: jupiterStats,
      esmsBalances: { spirit: 85, essence: 80, matter: 60, substance: 75 },
    })
  )

  const agentHref = `/agents/Jupiter/${encodeURIComponent(activeSign)}/${activeDegree}`

  return (
    <div className="container py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 rounded-full border border-indigo-400/30">
            <span className="text-3xl">♃</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold">Jupiter</h1>
            <p className="text-muted-foreground">Expansion, Wisdom & Higher Learning</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/planets/sun">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Sun
            </Button>
          </Link>
          <Link href="/planets/moon">
            <Button variant="outline" size="sm">
              Moon
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      <Card className="mb-6 border-indigo-500/30 bg-[#0d1020]/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-400" />
            Current Jupiter Position
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Badge variant="default" className="text-lg py-1 px-3">
              {activeSign} {currentPosition?.degree ?? activeDegree}°
            </Badge>
            <span className="text-sm text-muted-foreground">
              Jupiter expands consciousness through {activeSign}
            </span>
          </div>

          <VesselRatingRibbon
            ovr={jupiterRated.ovr}
            archetype={jupiterRated.archetype}
            seals={jupiterSeals}
            compact
          />

          {currentThemes && (
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold mb-2">Current Themes</h4>
                <div className="flex flex-wrap gap-2">
                  {currentThemes.themes?.slice(0, 4).map((theme: string) => (
                    <Badge key={theme} variant="outline">
                      {theme}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Active Archetypes</h4>
                <div className="flex flex-wrap gap-2">
                  {currentThemes.archetypes?.slice(0, 3).map((archetype: string) => (
                    <Badge key={archetype} variant="secondary">
                      {archetype}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-white/10 bg-[#0d1020]/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-400" />
                Historical Jupiter Transits
              </CardTitle>
              <CardDescription>Jupiter&apos;s journey through the zodiac over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {jupiterTransits.map((transit, index) => (
                  <HistoricalTransitCard
                    key={index}
                    transit={transit}
                    compact={true}
                    showProgress={true}
                    showEvents={true}
                    showThemes={true}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-white/10 bg-[#0d1020]/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                Jupiter Essentials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Cycle Length</p>
                <p className="font-semibold">12 years</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Domicile Signs</p>
                <div className="flex gap-2">
                  <Badge variant="default">Sagittarius</Badge>
                  <Badge variant="default">Pisces</Badge>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Exaltation</p>
                <Badge variant="secondary">Cancer</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Keywords</p>
                <div className="flex flex-wrap gap-1">
                  {['Expansion', 'Wisdom', 'Growth', 'Teaching', 'Philosophy'].map(keyword => (
                    <Badge key={keyword} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#0d1020]/90">
            <CardHeader>
              <CardTitle>Jupiter Returns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { age: 12, label: 'First expansion of consciousness' },
                { age: 24, label: 'Career and purpose clarification' },
                { age: 36, label: 'Professional mastery phase' },
                { age: 48, label: 'Wisdom teaching phase' },
              ].map(({ age, label }) => (
                <div key={age} className="p-3 border border-white/10 bg-white/[0.03] rounded-lg">
                  <p className="font-medium text-sm">Age {age}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#0d1020]/90">
            <CardHeader>
              <CardTitle>Consult Jupiter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect with Jupiter&apos;s expansive wisdom ({jupiterRated.ovr} PVR ·{' '}
                {jupiterRated.archetype.title})
              </p>
              <Link href={agentHref} className="block">
                <Button className="w-full">Chat with Jupiter Agent</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
