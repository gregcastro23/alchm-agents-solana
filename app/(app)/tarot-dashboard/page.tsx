'use client'

import React, { useState, useEffect } from 'react'
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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
          <Wand2 className="h-10 w-10 text-purple-600" />
          Tarot & Alchemy Dashboard
          <Sparkles className="h-8 w-8 text-amber-500" />
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Master the 78-card tarot system through alchemical wisdom and planetary guidance
        </p>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-purple-600" />
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-600" />
                  Planetary Ruler Card
                </CardTitle>
                <CardDescription>
                  Current major arcana influence based on planetary rulers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {planetaryCard ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-2xl font-bold">{planetaryCard.name}</h3>
                      <p className="text-muted-foreground">
                        {planetaryCard.element} • {planetaryCard.planetaryRuler}
                      </p>
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

                    <Button
                      variant="outline"
                      onClick={() => setSelectedCard(planetaryCard)}
                      className="w-full"
                    >
                      Explore This Card
                    </Button>
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
            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-purple-600" />
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-600" />
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
                    <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 border-red-200">
                      <CardContent className="p-4 text-center">
                        <Flame className="h-8 w-8 text-red-500 mx-auto mb-2" />
                        <h3 className="font-medium text-red-800 dark:text-red-200">Spirit</h3>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {alchmQuantities.spirit.toFixed(2)}
                        </p>
                        <p className="text-xs text-red-600/70 dark:text-red-400/70">
                          Active • Transformative
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200">
                      <CardContent className="p-4 text-center">
                        <Droplets className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                        <h3 className="font-medium text-blue-800 dark:text-blue-200">Essence</h3>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {alchmQuantities.essence.toFixed(2)}
                        </p>
                        <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                          Receptive • Flowing
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200">
                      <CardContent className="p-4 text-center">
                        <Mountain className="h-8 w-8 text-green-500 mx-auto mb-2" />
                        <h3 className="font-medium text-green-800 dark:text-green-200">Matter</h3>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {alchmQuantities.matter.toFixed(2)}
                        </p>
                        <p className="text-xs text-green-600/70 dark:text-green-400/70">
                          Structural • Grounding
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950 border-yellow-200">
                      <CardContent className="p-4 text-center">
                        <Wind className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                        <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
                          Substance
                        </h3>
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          {alchmQuantities.substance.toFixed(2)}
                        </p>
                        <p className="text-xs text-yellow-600/70 dark:text-yellow-400/70">
                          Connective • Bridging
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tarot Element Correspondences */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Tarot Suit Correspondences</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                          <Wand2 className="h-5 w-5 text-red-500 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-red-800 dark:text-red-200">
                              Wands = Spirit ({alchmQuantities.spirit.toFixed(2)})
                            </h4>
                            <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                              Fire element, creativity, passion, spiritual energy
                            </p>
                            <p className="text-xs text-red-600/80 dark:text-red-400/80">
                              Current tarot influence:{' '}
                              {alchmQuantities.spirit > 5
                                ? 'High creative fire energy'
                                : alchmQuantities.spirit > 3
                                  ? 'Moderate spiritual activation'
                                  : 'Gentle creative stirring'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                          <Heart className="h-5 w-5 text-blue-500 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-blue-800 dark:text-blue-200">
                              Cups = Essence ({alchmQuantities.essence.toFixed(2)})
                            </h4>
                            <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                              Water element, emotions, relationships, intuition
                            </p>
                            <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
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
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                          <Shield className="h-5 w-5 text-green-500 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-green-800 dark:text-green-200">
                              Pentacles = Matter ({alchmQuantities.matter.toFixed(2)})
                            </h4>
                            <p className="text-sm text-green-600 dark:text-green-400 mb-2">
                              Earth element, material world, resources, manifestation
                            </p>
                            <p className="text-xs text-green-600/80 dark:text-green-400/80">
                              Current tarot influence:{' '}
                              {alchmQuantities.matter > 7
                                ? 'Strong manifestation and material focus'
                                : alchmQuantities.matter > 4
                                  ? 'Practical grounding energy'
                                  : 'Gentle material awareness'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
                          <Compass className="h-5 w-5 text-yellow-500 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                              Swords = Substance ({alchmQuantities.substance.toFixed(2)})
                            </h4>
                            <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">
                              Air element, thoughts, communication, mental clarity
                            </p>
                            <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shuffle className="h-5 w-5 text-purple-600" />
                  Three Card Spread
                </CardTitle>
                <CardDescription>Past • Present • Future insight</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 border rounded-lg">
                    <h4 className="font-medium text-sm mb-1">Past</h4>
                    <div className="h-16 bg-muted rounded flex items-center justify-center">
                      <Star className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="text-center p-3 border rounded-lg bg-purple-50 dark:bg-purple-950">
                    <h4 className="font-medium text-sm mb-1">Present</h4>
                    <div className="h-16 bg-purple-100 dark:bg-purple-900 rounded flex items-center justify-center">
                      <Eye className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <h4 className="font-medium text-sm mb-1">Future</h4>
                    <div className="h-16 bg-muted rounded flex items-center justify-center">
                      <Star className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <Button className="w-full" variant="outline">
                  <Shuffle className="h-4 w-4 mr-2" />
                  Draw Three Cards
                </Button>
              </CardContent>
            </Card>

            {/* Alchemical Elements Spread */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-600" />
                  Alchemical Elements Spread
                </CardTitle>
                <CardDescription>Spirit • Essence • Matter • Substance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 border rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Flame className="h-3 w-3 text-red-500" />
                      <h4 className="font-medium text-sm">Spirit</h4>
                    </div>
                    <div className="h-16 bg-red-50 dark:bg-red-950 rounded flex items-center justify-center">
                      <Wand2 className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Droplets className="h-3 w-3 text-blue-500" />
                      <h4 className="font-medium text-sm">Essence</h4>
                    </div>
                    <div className="h-16 bg-blue-50 dark:bg-blue-950 rounded flex items-center justify-center">
                      <Heart className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Mountain className="h-3 w-3 text-green-500" />
                      <h4 className="font-medium text-sm">Matter</h4>
                    </div>
                    <div className="h-16 bg-green-50 dark:bg-green-950 rounded flex items-center justify-center">
                      <Shield className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Wind className="h-3 w-3 text-yellow-500" />
                      <h4 className="font-medium text-sm">Substance</h4>
                    </div>
                    <div className="h-16 bg-yellow-50 dark:bg-yellow-950 rounded flex items-center justify-center">
                      <Compass className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                </div>
                <Button className="w-full" variant="outline">
                  <Layers className="h-4 w-4 mr-2" />
                  Draw Alchemical Spread
                </Button>
              </CardContent>
            </Card>

            {/* Planetary Rulers Spread */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-600" />
                  Planetary Rulers Spread
                </CardTitle>
                <CardDescription>7-card major arcana planetary guidance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="inline-block p-4 border-2 border-amber-200 rounded-lg bg-amber-50 dark:bg-amber-950">
                    <Crown className="h-12 w-12 text-amber-600 mx-auto" />
                    <p className="text-sm font-medium mt-2">Full Planetary Spread</p>
                  </div>
                </div>
                <div className="text-center text-sm text-muted-foreground space-y-1">
                  <p>Sun • Moon • Mercury • Venus</p>
                  <p>Mars • Jupiter • Saturn</p>
                </div>
                <Button className="w-full" variant="outline">
                  <Crown className="h-4 w-4 mr-2" />
                  Draw Planetary Spread
                </Button>
              </CardContent>
            </Card>

            {/* Reading Journal */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-green-600" />
                  Reading Journal
                </CardTitle>
                <CardDescription>Save and track your tarot insights</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-8">
                  <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Track your readings and insights</p>
                </div>
                <Button className="w-full" variant="outline">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Open Journal
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tarot Learning & Mastery */}
        <TabsContent value="learning" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  Tarot Fundamentals
                </CardTitle>
                <CardDescription>Master the 78-card system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="border-l-4 border-red-500 pl-4">
                    <h4 className="font-medium">Fire - Wands</h4>
                    <p className="text-sm text-muted-foreground">
                      Spirit energy, creativity, passion, spiritual growth
                    </p>
                    <p className="text-xs text-red-600 mt-1">Aces-Kings • Pages through Kings</p>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium">Water - Cups</h4>
                    <p className="text-sm text-muted-foreground">
                      Essence flow, emotions, relationships, intuition
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Hearts and healing • Emotional depths
                    </p>
                  </div>
                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-medium">Earth - Pentacles</h4>
                    <p className="text-sm text-muted-foreground">
                      Matter manifestation, material world, resources
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Physical realm • Practical application
                    </p>
                  </div>
                  <div className="border-l-4 border-yellow-500 pl-4">
                    <h4 className="font-medium">Air - Swords</h4>
                    <p className="text-sm text-muted-foreground">
                      Substance bridge, thoughts, communication, clarity
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      Mental realm • Intellectual connection
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-purple-600" />
                  Major Arcana Journey
                </CardTitle>
                <CardDescription>22 cards of spiritual evolution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded border-l-4 border-purple-400">
                    <h4 className="font-medium text-purple-800 dark:text-purple-200">
                      The Fool's Journey
                    </h4>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Spiritual evolution from 0 to 21
                    </p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded border-l-4 border-amber-400">
                    <h4 className="font-medium text-amber-800 dark:text-amber-200">
                      Planetary Rulers
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Each card corresponds to planetary energy
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded border-l-4 border-blue-400">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200">
                      Alchemical Integration
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Spirit, Essence, Matter, Substance qualities
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-gold-600" />
                  Planetary Correspondences
                </CardTitle>
                <CardDescription>Tarot cards and celestial rulers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <span>☉ Sun</span>
                      <Badge variant="outline" className="text-xs">
                        The Sun
                      </Badge>
                    </span>
                    <span className="text-muted-foreground">Vitality, consciousness</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <span>☽ Moon</span>
                      <Badge variant="outline" className="text-xs">
                        The Moon
                      </Badge>
                    </span>
                    <span className="text-muted-foreground">Intuition, subconscious</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <span>☿ Mercury</span>
                      <Badge variant="outline" className="text-xs">
                        The Magician
                      </Badge>
                    </span>
                    <span className="text-muted-foreground">Communication, skill</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <span>♀ Venus</span>
                      <Badge variant="outline" className="text-xs">
                        The Empress
                      </Badge>
                    </span>
                    <span className="text-muted-foreground">Love, beauty, creation</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <span>♂ Mars</span>
                      <Badge variant="outline" className="text-xs">
                        The Tower
                      </Badge>
                    </span>
                    <span className="text-muted-foreground">Action, transformation</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <span>♃ Jupiter</span>
                      <Badge variant="outline" className="text-xs">
                        Wheel of Fortune
                      </Badge>
                    </span>
                    <span className="text-muted-foreground">Expansion, wisdom</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <span>♄ Saturn</span>
                      <Badge variant="outline" className="text-xs">
                        The World
                      </Badge>
                    </span>
                    <span className="text-muted-foreground">Structure, mastery</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-600" />
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
