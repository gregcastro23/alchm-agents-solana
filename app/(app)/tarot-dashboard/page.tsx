'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Crown,
  Sparkles,
  Star,
  Eye,
  Clock,
  Wand2,
  Heart,
  Shield,
  BookOpen,
  TrendingUp,
  Settings,
  Shuffle,
  Layers,
  Flame,
  Droplets,
  Mountain,
  Wind,
  Compass,
} from 'lucide-react'
import TarotCosmicWidget from '@/components/misc/tarot-cosmic-widget'
import {
  getCurrentDecan,
  getPlanetaryRulerCard,
  DECAN_TAROT_MAPPINGS,
  MAJOR_ARCANA_PLANETARY,
  type TarotCard,
  type MajorArcanaCard,
} from '@/lib/monica/tarot-oracle'
import { usePlanetaryPositions } from '@/hooks/usePlanetaryPositions'
import { getPlanetaryAgentStats } from '@/lib/agents/planetary-agent-stats'
import { rateStats } from '@/lib/agents/rating'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'

const PLANET_DOMICILE_SIGN: Record<string, string> = {
  Sun: 'Leo',
  Moon: 'Cancer',
  Mercury: 'Virgo',
  Venus: 'Taurus',
  Mars: 'Aries',
  Jupiter: 'Sagittarius',
  Saturn: 'Capricorn',
}

export default function TarotDashboardPage() {
  const [selectedCard, setSelectedCard] = useState<TarotCard | MajorArcanaCard | null>(null)
  const [activeView, setActiveView] = useState<'current' | 'alchemical' | 'spreads' | 'learning'>(
    'current'
  )
  const [currentDecanCard, setCurrentDecanCard] = useState<TarotCard | null>(null)
  const [planetaryCard, setPlanetaryCard] = useState<MajorArcanaCard | null>(null)

  // Get current alchemical data for tarot analysis
  const { alchmQuantities, loading } = usePlanetaryPositions({ useApi: true })

  useEffect(() => {
    void getCurrentDecan().then(decan => {
      if (decan?.card) {
        setCurrentDecanCard(decan.card)
      }
    })

    // Get planetary ruler card (simplified for dashboard)
    const rulerCard = getPlanetaryRulerCard('Sun')
    if (rulerCard) {
      setPlanetaryCard(rulerCard)
    }
  }, [])

  const handleCardSelect = (card: TarotCard | MajorArcanaCard) => {
    setSelectedCard(card)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8 space-y-4">
        <h1 className="text-4xl font-bold flex items-center justify-center gap-3 text-white">
          <Wand2 className="h-10 w-10 text-violet-400" />
          Tarot & Alchemy Dashboard
          <Sparkles className="h-8 w-8 text-amber-400" />
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Master the 78-card tarot system through alchemical wisdom, Pentacle ratings, and planetary
          guidance
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/monica">Open Live Monica Tarot Oracle →</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/planetary-agents">Planetary Rulers →</Link>
          </Button>
        </div>
      </div>

      {/* Quick Status Bar */}
      <div className="mb-8">
        <TarotCosmicWidget variant="header" linkToFullOracle={false} />
      </div>

      <Tabs
        value={activeView}
        onValueChange={value => setActiveView(value as any)}
        className="space-y-8"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="current" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Current Cards
          </TabsTrigger>
          <TabsTrigger value="alchemical" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Alchemical Quantities
          </TabsTrigger>
          <TabsTrigger value="spreads" className="flex items-center gap-2">
            <Shuffle className="h-4 w-4" />
            Card Spreads
          </TabsTrigger>
          <TabsTrigger value="learning" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Tarot Mastery
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-8">
          {/* Current Active Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Current Decan Card */}
            <Card className="border-white/10 bg-[#0d1020]/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-violet-400" />
                  Current Decan Card
                </CardTitle>
                <CardDescription>
                  Your active minor arcana card based on the sun's position
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentDecanCard ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-2xl font-bold">{currentDecanCard.name}</h3>
                      <p className="text-muted-foreground">
                        {currentDecanCard.element} • {currentDecanCard.suit}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium mb-1">Card Meaning</h4>
                        <p className="text-sm text-muted-foreground">{currentDecanCard.meaning}</p>
                      </div>

                      <div>
                        <h4 className="font-medium mb-1">Keywords</h4>
                        <div className="flex flex-wrap gap-1">
                          {currentDecanCard.keywords.map((keyword, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {'alchemicalValues' in currentDecanCard && (
                        <div>
                          <h4 className="font-medium mb-2">Alchemical Signature</h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              <Flame className="h-3 w-3 text-red-500" />
                              <span>
                                Spirit: {currentDecanCard.alchemicalValues.spirit.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Droplets className="h-3 w-3 text-blue-500" />
                              <span>
                                Essence: {currentDecanCard.alchemicalValues.essence.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Mountain className="h-3 w-3 text-green-500" />
                              <span>
                                Matter: {currentDecanCard.alchemicalValues.matter.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Wind className="h-3 w-3 text-yellow-500" />
                              <span>
                                Substance: {currentDecanCard.alchemicalValues.substance.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => setSelectedCard(currentDecanCard)}
                      className="w-full"
                    >
                      Explore This Card
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading current decan card...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current Planetary Ruler Card */}
            <Card className="border-white/10 bg-[#0d1020]/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-400" />
                  Planetary Ruler Card
                </CardTitle>
                <CardDescription>
                  Current major arcana influence based on planetary rulers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {planetaryCard ? (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <h3 className="text-2xl font-bold">{planetaryCard.name}</h3>
                      <p className="text-muted-foreground">
                        {planetaryCard.element} • {planetaryCard.planetaryRuler}
                      </p>
                      <div className="flex justify-center">
                        {(() => {
                          const ruler = planetaryCard.planetaryRuler || 'Sun'
                          const sign = PLANET_DOMICILE_SIGN[ruler] || 'Leo'
                          const rulerRated = rateStats(getPlanetaryAgentStats(ruler, sign, 15))
                          return (
                            <VesselRatingRibbon
                              ovr={rulerRated.ovr}
                              archetype={rulerRated.archetype}
                              compact
                            />
                          )
                        })()}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium mb-1">Planetary Influence</h4>
                        <p className="text-sm text-muted-foreground">{planetaryCard.meaning}</p>
                      </div>

                      <div>
                        <h4 className="font-medium mb-1">Consciousness Focus</h4>
                        <p className="text-sm text-muted-foreground">
                          {planetaryCard.consciousness}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium mb-1">Keywords</h4>
                        <div className="flex flex-wrap gap-1">
                          {planetaryCard.keywords.map((keyword, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedCard(planetaryCard)}
                        className="w-full"
                      >
                        Explore This Card
                      </Button>
                      <Button variant="outline" asChild className="w-full">
                        <Link
                          href={`/agents/${encodeURIComponent(planetaryCard.planetaryRuler || 'Sun')}/${encodeURIComponent(PLANET_DOMICILE_SIGN[planetaryCard.planetaryRuler || 'Sun'] || 'Leo')}/15`}
                        >
                          Consult {planetaryCard.planetaryRuler || 'Sun'} →
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading planetary ruler card...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Selected Card Analysis */}
          {selectedCard && (
            <Card className="border border-violet-400/35 bg-[#0d1020]/95 shadow-[0_0_24px_rgba(167,139,250,0.12)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-violet-300" />
                  Tarot Analysis: {selectedCard.name}
                </CardTitle>
                <CardDescription>
                  Detailed card interpretation and alchemical correspondences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">🎯 Core Interpretation</h4>
                      <p className="text-sm">{selectedCard.meaning}</p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">🧠 Consciousness Activation</h4>
                      <p className="text-sm">{selectedCard.consciousness}</p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">🔮 Tarot Keywords</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedCard.keywords.map((keyword, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">⚡ Elemental Properties</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Wand2 className="h-4 w-4 text-red-500" />
                          <span className="text-sm">Element: {selectedCard.element}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-amber-500" />
                          <span className="text-sm">Ruler: {selectedCard.planetaryRuler}</span>
                        </div>
                        {'suit' in selectedCard && (
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-purple-500" />
                            <span className="text-sm">Suit: {selectedCard.suit}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {'alchemicalValues' in selectedCard && (
                      <div>
                        <h4 className="font-medium mb-2">⚗️ Alchemical Profile</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <Flame className="h-4 w-4 text-red-500" />
                            <div className="flex-1">
                              <div className="flex justify-between text-xs">
                                <span>Spirit</span>
                                <span className="font-mono">
                                  {selectedCard.alchemicalValues.spirit.toFixed(2)}
                                </span>
                              </div>
                              <Progress
                                value={selectedCard.alchemicalValues.spirit * 100}
                                className="h-1 mt-1"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Droplets className="h-4 w-4 text-blue-500" />
                            <div className="flex-1">
                              <div className="flex justify-between text-xs">
                                <span>Essence</span>
                                <span className="font-mono">
                                  {selectedCard.alchemicalValues.essence.toFixed(2)}
                                </span>
                              </div>
                              <Progress
                                value={selectedCard.alchemicalValues.essence * 100}
                                className="h-1 mt-1"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mountain className="h-4 w-4 text-green-500" />
                            <div className="flex-1">
                              <div className="flex justify-between text-xs">
                                <span>Matter</span>
                                <span className="font-mono">
                                  {selectedCard.alchemicalValues.matter.toFixed(2)}
                                </span>
                              </div>
                              <Progress
                                value={selectedCard.alchemicalValues.matter * 100}
                                className="h-1 mt-1"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Wind className="h-4 w-4 text-yellow-500" />
                            <div className="flex-1">
                              <div className="flex justify-between text-xs">
                                <span>Substance</span>
                                <span className="font-mono">
                                  {selectedCard.alchemicalValues.substance.toFixed(2)}
                                </span>
                              </div>
                              <Progress
                                value={selectedCard.alchemicalValues.substance * 100}
                                className="h-1 mt-1"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedCard(null)}
                    className="w-full"
                  >
                    Close Analysis
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* New Alchemical Quantities Tab */}
        <TabsContent value="alchemical" className="space-y-8">
          <Card className="border-white/10 bg-[#0d1020]/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-violet-400" />
                Live Alchemical Quantities & Tarot Correlations
              </CardTitle>
              <CardDescription>
                Current planetary alchemical values and their tarot manifestations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading alchemical data...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Current Values */}
                  <div className="grid md:grid-cols-4 gap-4">
                    <Card className="border-amber-500/30 bg-amber-500/[0.06]">
                      <CardContent className="p-4 text-center">
                        <Flame className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                        <h3 className="font-medium text-amber-200">Spirit</h3>
                        <p className="text-2xl font-bold text-amber-300">
                          {alchmQuantities.spirit.toFixed(2)}
                        </p>
                        <p className="text-xs text-amber-300/75">Active • Transformative</p>
                      </CardContent>
                    </Card>

                    <Card className="border-cyan-500/30 bg-cyan-500/[0.06]">
                      <CardContent className="p-4 text-center">
                        <Droplets className="h-8 w-8 text-cyan-400 mx-auto mb-2" />
                        <h3 className="font-medium text-cyan-200">Essence</h3>
                        <p className="text-2xl font-bold text-cyan-300">
                          {alchmQuantities.essence.toFixed(2)}
                        </p>
                        <p className="text-xs text-cyan-300/75">Receptive • Flowing</p>
                      </CardContent>
                    </Card>

                    <Card className="border-emerald-500/30 bg-emerald-500/[0.06]">
                      <CardContent className="p-4 text-center">
                        <Mountain className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                        <h3 className="font-medium text-emerald-200">Matter</h3>
                        <p className="text-2xl font-bold text-emerald-300">
                          {alchmQuantities.matter.toFixed(2)}
                        </p>
                        <p className="text-xs text-emerald-300/75">Structural • Grounding</p>
                      </CardContent>
                    </Card>

                    <Card className="border-violet-500/30 bg-violet-500/[0.06]">
                      <CardContent className="p-4 text-center">
                        <Wind className="h-8 w-8 text-violet-400 mx-auto mb-2" />
                        <h3 className="font-medium text-violet-200">Substance</h3>
                        <p className="text-2xl font-bold text-violet-300">
                          {alchmQuantities.substance.toFixed(2)}
                        </p>
                        <p className="text-xs text-violet-300/75">Connective • Bridging</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tarot Element Correspondences */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Tarot Suit Correspondences</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06]">
                          <Wand2 className="h-5 w-5 text-amber-400 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-amber-200">
                              Wands = Spirit ({alchmQuantities.spirit.toFixed(2)})
                            </h4>
                            <p className="text-sm text-amber-300/90 mb-2">
                              Fire element, creativity, passion, spiritual energy
                            </p>
                            <p className="text-xs text-slate-300">
                              Current tarot influence:{' '}
                              {alchmQuantities.spirit > 5
                                ? 'High creative fire energy'
                                : alchmQuantities.spirit > 3
                                  ? 'Moderate spiritual activation'
                                  : 'Gentle creative stirring'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06]">
                          <Heart className="h-5 w-5 text-cyan-400 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-cyan-200">
                              Cups = Essence ({alchmQuantities.essence.toFixed(2)})
                            </h4>
                            <p className="text-sm text-cyan-300/90 mb-2">
                              Water element, emotions, relationships, intuition
                            </p>
                            <p className="text-xs text-slate-300">
                              Current tarot influence:{' '}
                              {alchmQuantities.essence > 8
                                ? 'Deep emotional flow and intuitive insights'
                                : alchmQuantities.essence > 5
                                  ? 'Active emotional processing'
                                  : 'Subtle emotional awareness'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06]">
                          <Shield className="h-5 w-5 text-emerald-400 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-emerald-200">
                              Pentacles = Matter ({alchmQuantities.matter.toFixed(2)})
                            </h4>
                            <p className="text-sm text-emerald-300/90 mb-2">
                              Earth element, material world, resources, manifestation
                            </p>
                            <p className="text-xs text-slate-300">
                              Current tarot influence:{' '}
                              {alchmQuantities.matter > 7
                                ? 'Strong manifestation and material focus'
                                : alchmQuantities.matter > 4
                                  ? 'Practical grounding energy'
                                  : 'Gentle material awareness'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-violet-500/25 bg-violet-500/[0.06]">
                          <Compass className="h-5 w-5 text-violet-400 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-violet-200">
                              Swords = Substance ({alchmQuantities.substance.toFixed(2)})
                            </h4>
                            <p className="text-sm text-violet-300/90 mb-2">
                              Air element, thoughts, communication, mental clarity
                            </p>
                            <p className="text-xs text-slate-300">
                              Current tarot influence:{' '}
                              {alchmQuantities.substance > 3
                                ? 'Active mental processing and communication'
                                : alchmQuantities.substance > 1
                                  ? 'Clear thinking and connections'
                                  : 'Subtle mental bridging'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Card Spreads & Reading Tools */}
        <TabsContent value="spreads" className="space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Three Card Spread */}
            <Card className="border-white/10 bg-[#0d1020]/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shuffle className="h-5 w-5 text-violet-400" />
                  Three Card Spread
                </CardTitle>
                <CardDescription>Past • Present • Future insight</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 border border-white/10 rounded-lg bg-white/[0.02]">
                    <h4 className="font-medium text-sm mb-1">Past</h4>
                    <div className="h-16 bg-white/5 rounded flex items-center justify-center">
                      <Star className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="text-center p-3 border border-violet-400/35 rounded-lg bg-violet-500/10">
                    <h4 className="font-medium text-sm mb-1">Present</h4>
                    <div className="h-16 bg-violet-500/20 rounded flex items-center justify-center">
                      <Eye className="h-6 w-6 text-violet-300" />
                    </div>
                  </div>
                  <div className="text-center p-3 border border-white/10 rounded-lg bg-white/[0.02]">
                    <h4 className="font-medium text-sm mb-1">Future</h4>
                    <div className="h-16 bg-white/5 rounded flex items-center justify-center">
                      <Star className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/monica">
                    <Shuffle className="h-4 w-4 mr-2" />
                    Draw Three Cards in Live Oracle
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Alchemical Elements Spread */}
            <Card className="border-white/10 bg-[#0d1020]/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-cyan-400" />
                  Alchemical Elements Spread
                </CardTitle>
                <CardDescription>Spirit • Essence • Matter • Substance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 border border-white/10 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Flame className="h-3 w-3 text-amber-400" />
                      <h4 className="font-medium text-sm">Spirit</h4>
                    </div>
                    <div className="h-16 bg-amber-500/10 rounded flex items-center justify-center">
                      <Wand2 className="h-6 w-6 text-amber-300" />
                    </div>
                  </div>
                  <div className="text-center p-3 border border-white/10 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Droplets className="h-3 w-3 text-cyan-400" />
                      <h4 className="font-medium text-sm">Essence</h4>
                    </div>
                    <div className="h-16 bg-cyan-500/10 rounded flex items-center justify-center">
                      <Heart className="h-6 w-6 text-cyan-300" />
                    </div>
                  </div>
                  <div className="text-center p-3 border border-white/10 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Mountain className="h-3 w-3 text-emerald-400" />
                      <h4 className="font-medium text-sm">Matter</h4>
                    </div>
                    <div className="h-16 bg-emerald-500/10 rounded flex items-center justify-center">
                      <Shield className="h-6 w-6 text-emerald-300" />
                    </div>
                  </div>
                  <div className="text-center p-3 border border-white/10 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Wind className="h-3 w-3 text-violet-400" />
                      <h4 className="font-medium text-sm">Substance</h4>
                    </div>
                    <div className="h-16 bg-violet-500/10 rounded flex items-center justify-center">
                      <Compass className="h-6 w-6 text-violet-300" />
                    </div>
                  </div>
                </div>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/monica">
                    <Layers className="h-4 w-4 mr-2" />
                    Draw Alchemical Spread
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Planetary Rulers Spread */}
            <Card className="border-white/10 bg-[#0d1020]/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-400" />
                  Planetary Rulers Spread
                </CardTitle>
                <CardDescription>7-card major arcana planetary guidance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="inline-block p-4 border border-amber-400/35 rounded-xl bg-amber-500/10">
                    <Crown className="h-12 w-12 text-amber-300 mx-auto" />
                    <p className="text-sm font-medium mt-2">Full Planetary Spread</p>
                  </div>
                </div>
                <div className="text-center text-sm text-muted-foreground space-y-1">
                  <p>Sun • Moon • Mercury • Venus</p>
                  <p>Mars • Jupiter • Saturn</p>
                </div>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/planetary-agents">
                    <Crown className="h-4 w-4 mr-2" />
                    Draw Planetary Spread
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Reading Journal */}
            <Card className="border-white/10 bg-[#0d1020]/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-emerald-400" />
                  Reading Journal
                </CardTitle>
                <CardDescription>Save and track your tarot insights</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-8">
                  <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Track your readings and insights</p>
                </div>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/monica">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Open Journal
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tarot Learning & Mastery */}
        <TabsContent value="learning" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-white/10 bg-[#0d1020]/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-cyan-400" />
                  Tarot Fundamentals
                </CardTitle>
                <CardDescription>Master the 78-card system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="border-l-4 border-amber-400 pl-4">
                    <h4 className="font-medium">Fire - Wands</h4>
                    <p className="text-sm text-muted-foreground">
                      Spirit energy, creativity, passion, spiritual growth
                    </p>
                    <p className="text-xs text-amber-300 mt-1">Aces-Kings • Pages through Kings</p>
                  </div>
                  <div className="border-l-4 border-cyan-400 pl-4">
                    <h4 className="font-medium">Water - Cups</h4>
                    <p className="text-sm text-muted-foreground">
                      Essence flow, emotions, relationships, intuition
                    </p>
                    <p className="text-xs text-cyan-300 mt-1">
                      Hearts and healing • Emotional depths
                    </p>
                  </div>
                  <div className="border-l-4 border-emerald-400 pl-4">
                    <h4 className="font-medium">Earth - Pentacles</h4>
                    <p className="text-sm text-muted-foreground">
                      Matter manifestation, material world, resources
                    </p>
                    <p className="text-xs text-emerald-300 mt-1">
                      Physical realm • Practical application
                    </p>
                  </div>
                  <div className="border-l-4 border-violet-400 pl-4">
                    <h4 className="font-medium">Air - Swords</h4>
                    <p className="text-sm text-muted-foreground">
                      Substance bridge, thoughts, communication, clarity
                    </p>
                    <p className="text-xs text-violet-300 mt-1">
                      Mental realm • Intellectual connection
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#0d1020]/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-violet-400" />
                  Major Arcana Journey
                </CardTitle>
                <CardDescription>22 cards of spiritual evolution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="bg-violet-500/10 p-3 rounded border-l-4 border-violet-400">
                    <h4 className="font-medium text-violet-200">The Fool's Journey</h4>
                    <p className="text-sm text-violet-300/90">Spiritual evolution from 0 to 21</p>
                  </div>
                  <div className="bg-amber-500/10 p-3 rounded border-l-4 border-amber-400">
                    <h4 className="font-medium text-amber-200">Planetary Rulers</h4>
                    <p className="text-sm text-amber-300/90">
                      Each card corresponds to planetary energy
                    </p>
                  </div>
                  <div className="bg-cyan-500/10 p-3 rounded border-l-4 border-cyan-400">
                    <h4 className="font-medium text-cyan-200">Alchemical Integration</h4>
                    <p className="text-sm text-cyan-300/90">
                      Spirit, Essence, Matter, Substance qualities
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#0d1020]/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-400" />
                  Planetary Correspondences
                </CardTitle>
                <CardDescription>
                  Tarot cards, celestial rulers, and live Pentacle ratings (click to consult)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {(
                    [
                      {
                        planet: 'Sun',
                        glyph: '☉',
                        arcana: 'The Sun',
                        domain: 'Vitality, consciousness',
                      },
                      {
                        planet: 'Moon',
                        glyph: '☽',
                        arcana: 'The Moon',
                        domain: 'Intuition, subconscious',
                      },
                      {
                        planet: 'Mercury',
                        glyph: '☿',
                        arcana: 'The Magician',
                        domain: 'Communication, skill',
                      },
                      {
                        planet: 'Venus',
                        glyph: '♀',
                        arcana: 'The Empress',
                        domain: 'Love, beauty, creation',
                      },
                      {
                        planet: 'Mars',
                        glyph: '♂',
                        arcana: 'The Tower',
                        domain: 'Action, transformation',
                      },
                      {
                        planet: 'Jupiter',
                        glyph: '♃',
                        arcana: 'Wheel of Fortune',
                        domain: 'Expansion, wisdom',
                      },
                      {
                        planet: 'Saturn',
                        glyph: '♄',
                        arcana: 'The World',
                        domain: 'Structure, mastery',
                      },
                    ] as const
                  ).map(row => {
                    const sign = PLANET_DOMICILE_SIGN[row.planet] || 'Leo'
                    const rated = rateStats(getPlanetaryAgentStats(row.planet, sign, 15))
                    return (
                      <Link
                        key={row.planet}
                        href={`/agents/${row.planet}/${sign}/15`}
                        className="flex justify-between items-center p-2 rounded-lg border border-white/10 bg-white/[0.02] hover:border-amber-400/40 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span>
                            {row.glyph} {row.planet}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {row.arcana}
                          </Badge>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground hidden sm:inline">
                            {row.domain}
                          </span>
                          <span className="rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-200">
                            PVR {rated.ovr}
                          </span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#0d1020]/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-violet-400" />
                  Alchemical Tarot Practice
                </CardTitle>
                <CardDescription>Integrate the four principles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Daily Integration</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Morning: Draw current decan card for Spirit guidance</li>
                      <li>• Midday: Check planetary ruler for active energy</li>
                      <li>• Evening: Reflect on alchemical correspondences</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Advanced Techniques</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Alchemical element spreads for life situations</li>
                      <li>• Planetary timing for major decisions</li>
                      <li>• Decan progression tracking for growth</li>
                      <li>• Spirit-Essence-Matter-Substance balance work</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
