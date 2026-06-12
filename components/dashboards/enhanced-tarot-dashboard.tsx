'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Sparkles,
  Star,
  Crown,
  Eye,
  Zap,
  Heart,
  Sun,
  Moon,
  Wand2,
  Shield,
  Circle,
  Square,
  Triangle,
  Hexagon,
  Clock,
} from 'lucide-react'
import {
  getCurrentDecan,
  getPlanetaryRulerCard,
  generateConsciousnessCraftingInsight,
  DECAN_TAROT_MAPPINGS,
  MAJOR_ARCANA_PLANETARY,
  ZODIAC_MAJOR_ARCANA,
  type TarotCard,
  type MajorArcanaCard,
  type ConsciousnessCraftingInsight,
} from '@/lib/monica/tarot-oracle'

interface EnhancedTarotDashboardProps {
  variant?: 'full' | 'compact' | 'minimal'
  showAdvancedInsights?: boolean
  onCardSelect?: (card: TarotCard | MajorArcanaCard) => void
}

const EnhancedTarotDashboard: React.FC<EnhancedTarotDashboardProps> = ({
  variant = 'full',
  showAdvancedInsights = true,
  onCardSelect,
}) => {
  const [currentCard, setCurrentCard] = useState<TarotCard | null>(null)
  const [planetaryCard, setPlanetaryCard] = useState<MajorArcanaCard | null>(null)
  const [insight, setInsight] = useState<ConsciousnessCraftingInsight | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('current')
  const [sunPosition, setSunPosition] = useState<string>('')

  useEffect(() => {
    const abortController = new AbortController()

    const loadTarotDashboard = async () => {
      setIsLoading(true)

      try {
        // Early abort check before any async operations
        if (abortController.signal.aborted) {
          console.log('Enhanced tarot dashboard request aborted before starting')
          return
        }

        const { card: decanCard, sunPosition: position } = await getCurrentDecan(
          abortController.signal
        )

        if (abortController.signal.aborted) return

        setCurrentCard(decanCard)
        setSunPosition(position)

        let rulerCard: MajorArcanaCard | null = null
        if (decanCard?.planetaryRuler) {
          rulerCard = getPlanetaryRulerCard(decanCard.planetaryRuler)
        }

        if (!rulerCard) {
          rulerCard = getPlanetaryRulerCard('Sun')
        }

        setPlanetaryCard(rulerCard)

        if (decanCard && rulerCard) {
          const craftingInsight = generateConsciousnessCraftingInsight(decanCard, rulerCard)
          setInsight(craftingInsight)
        }
      } catch (error) {
        // Check if the error is due to abortion first
        if (abortController.signal.aborted) {
          console.log('Enhanced tarot dashboard request was aborted')
          return
        }

        // Handle AbortError and abort messages specifically
        if (
          error instanceof Error &&
          (error.name === 'AbortError' ||
            error.message.includes('aborted') ||
            error.message.includes('Request aborted'))
        ) {
          console.log('Enhanced tarot dashboard AbortError caught:', error.message)
          return
        }

        console.error('Error loading tarot dashboard (non-abort):', error)

        // Only update state if not aborted
        if (!abortController.signal.aborted) {
          const fallbackCard = DECAN_TAROT_MAPPINGS[110]
          const fallbackRulerCard = getPlanetaryRulerCard('Sun')

          setCurrentCard(fallbackCard)
          setSunPosition('Fallback position')
          setPlanetaryCard(fallbackRulerCard)

          if (fallbackCard && fallbackRulerCard) {
            const fallbackInsight = generateConsciousnessCraftingInsight(
              fallbackCard,
              fallbackRulerCard
            )
            setInsight(fallbackInsight)
          }
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadTarotDashboard()

    return () => {
      abortController.abort()
    }
  }, [])

  const getElementIcon = (element: string) => {
    switch (element) {
      case 'Fire':
        return <Zap className="h-4 w-4 text-red-400" />
      case 'Water':
        return <Heart className="h-4 w-4 text-blue-400" />
      case 'Air':
        return <Eye className="h-4 w-4 text-gray-400" />
      case 'Earth':
        return <Star className="h-4 w-4 text-green-400" />
      default:
        return <Sparkles className="h-4 w-4 text-purple-400" />
    }
  }

  const getSuitIcon = (suit: string) => {
    switch (suit) {
      case 'Wands':
        return <Wand2 className="h-5 w-5 text-red-500" />
      case 'Cups':
        return <Heart className="h-5 w-5 text-blue-500" />
      case 'Swords':
        return <Shield className="h-5 w-5 text-gray-500" />
      case 'Pentacles':
        return <Star className="h-5 w-5 text-yellow-500" />
      default:
        return <Sparkles className="h-5 w-5 text-purple-500" />
    }
  }

  const getAlchemicalShape = (element: string) => {
    switch (element) {
      case 'Fire':
        return <Triangle className="h-4 w-4 text-red-500" />
      case 'Water':
        return <Triangle className="h-4 w-4 text-blue-500 rotate-180" />
      case 'Air':
        return <Triangle className="h-4 w-4 text-gray-500" />
      case 'Earth':
        return <Square className="h-4 w-4 text-green-500" />
      default:
        return <Circle className="h-4 w-4 text-purple-500" />
    }
  }

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-4">
            <div className="animate-spin">
              <Crown className="h-8 w-8 text-purple-600 mx-auto" />
            </div>
            <p className="text-purple-700 font-medium">Consulting the cosmic tarot...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (variant === 'minimal') {
    return (
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Crown className="h-4 w-4 text-purple-600" />
            Current Cosmic Card
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {currentCard && (
            <div className="flex items-center gap-2">
              {getSuitIcon(currentCard.suit)}
              <span className="font-medium text-sm">{currentCard.name}</span>
              <Badge variant="outline" className="text-xs">
                {currentCard.element}
              </Badge>
            </div>
          )}
          {sunPosition && (
            <p className="text-xs text-amber-600">
              <Sun className="inline h-3 w-3 mr-1" />
              {sunPosition}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="space-y-4">
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-600" />
              Cosmic Tarot Moment
            </CardTitle>
            {sunPosition && (
              <CardDescription className="text-amber-600">
                <Sun className="inline h-4 w-4 mr-1" />
                {sunPosition}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {currentCard && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getSuitIcon(currentCard.suit)}
                  <span className="font-medium">{currentCard.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getElementIcon(currentCard.element)}
                  <Badge variant="outline" className="text-xs">
                    {currentCard.element}
                  </Badge>
                </div>
              </div>
            )}
            {insight && (
              <div className="bg-white/50 p-3 rounded-lg">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {insight.guidance.split('.')[0]}.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    Synergy: {Math.round(insight.synergy * 100)}%
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {insight.chakraActivation.primaryChakra} Chakra
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Crown className="h-6 w-6 text-purple-600" />
            Enhanced Tarot Dashboard
            <Sparkles className="h-6 w-6 text-gold-500" />
          </CardTitle>
          <CardDescription className="text-purple-700">
            Real-time cosmic consciousness crafting system
          </CardDescription>
          {sunPosition && (
            <p className="text-sm text-amber-600 mt-2">
              <Sun className="inline h-4 w-4 mr-1" />
              Solar Position: {sunPosition}
            </p>
          )}
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="current">Current</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="planetary">Planetary</TabsTrigger>
          <TabsTrigger value="alchemy">Alchemy</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Current Decan Card */}
            {currentCard && (
              <Card className="relative overflow-hidden border-2 border-blue-200">
                <div className="absolute top-2 right-2 opacity-20">
                  <Sparkles className="h-8 w-8 text-blue-400" />
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {getSuitIcon(currentCard.suit)}
                      {currentCard.name}
                    </CardTitle>
                    <Badge variant="outline">{currentCard.number}</Badge>
                  </div>
                  <CardDescription className="font-medium text-blue-700">
                    Current Decan Card
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      {getElementIcon(currentCard.element)}
                      <span>{currentCard.element}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Sun className="h-4 w-4 text-orange-400" />
                      <span>{currentCard.planetaryRuler}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {currentCard.keywords.map((keyword, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>

                  <p className="text-sm text-gray-700 leading-relaxed">{currentCard.meaning}</p>

                  <div className="bg-blue-50 p-2 rounded-lg">
                    <p className="text-xs font-medium text-blue-800">
                      🧠 {currentCard.consciousness}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span>Spirit:</span>
                      <div className="flex items-center gap-1">
                        <span>{currentCard.alchemicalValues.spirit}</span>
                        <div className="w-6 h-1 bg-gray-200 rounded">
                          <div
                            className="h-full bg-red-500 rounded"
                            style={{ width: `${currentCard.alchemicalValues.spirit * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span>Essence:</span>
                      <div className="flex items-center gap-1">
                        <span>{currentCard.alchemicalValues.essence}</span>
                        <div className="w-6 h-1 bg-gray-200 rounded">
                          <div
                            className="h-full bg-blue-500 rounded"
                            style={{ width: `${currentCard.alchemicalValues.essence * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span>Matter:</span>
                      <div className="flex items-center gap-1">
                        <span>{currentCard.alchemicalValues.matter}</span>
                        <div className="w-6 h-1 bg-gray-200 rounded">
                          <div
                            className="h-full bg-green-500 rounded"
                            style={{ width: `${currentCard.alchemicalValues.matter * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span>Substance:</span>
                      <div className="flex items-center gap-1">
                        <span>{currentCard.alchemicalValues.substance}</span>
                        <div className="w-6 h-1 bg-gray-200 rounded">
                          <div
                            className="h-full bg-purple-500 rounded"
                            style={{ width: `${currentCard.alchemicalValues.substance * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCardSelect?.(currentCard)}
                    className="w-full mt-2"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Explore This Card
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Planetary Ruler Card */}
            {planetaryCard && (
              <Card className="relative overflow-hidden border-2 border-gold-200">
                <div className="absolute top-2 right-2 opacity-20">
                  <Crown className="h-8 w-8 text-gold-400" />
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Crown className="h-5 w-5 text-gold-500" />
                      {planetaryCard.name}
                    </CardTitle>
                    <Badge variant="outline">Major</Badge>
                  </div>
                  <CardDescription className="font-medium text-gold-700">
                    {currentCard?.planetaryRuler} Planetary Ruler
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      {getElementIcon(planetaryCard.element)}
                      <span>{planetaryCard.element}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4 text-indigo-500" />
                      <span>{planetaryCard.chakra}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {planetaryCard.keywords.map((keyword, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>

                  <p className="text-sm text-gray-700 leading-relaxed">{planetaryCard.meaning}</p>

                  <div className="bg-gold-50 p-2 rounded-lg">
                    <p className="text-xs font-medium text-gold-800">
                      🌟 {planetaryCard.consciousness}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCardSelect?.(planetaryCard)}
                    className="w-full mt-2"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Explore This Archetype
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          {insight && showAdvancedInsights && (
            <div className="space-y-4">
              {/* Main Insight */}
              <Card className="border-2 border-gold-200 bg-gradient-to-r from-gold-50 to-yellow-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Eye className="h-5 w-5 text-gold-600" />
                    Consciousness Crafting Insight
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Synergy: {Math.round(insight.synergy * 100)}%</Badge>
                    <Badge variant="secondary">{insight.consciousnessLevel}</Badge>
                    <Badge variant="outline">
                      {insight.alchemicalBalance.dominantElement} Dominant
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-purple-800 mb-2">💫 Cosmic Guidance</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">{insight.guidance}</p>
                  </div>

                  <div>
                    <h4 className="font-medium text-purple-800 mb-2">🎯 Practical Application</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {insight.practicalApplication}
                    </p>
                  </div>

                  {/* Synergy Visualization */}
                  <div>
                    <h4 className="font-medium text-purple-800 mb-2">🔮 Energy Synergy</h4>
                    <Progress value={insight.synergy * 100} className="w-full" />
                    <p className="text-xs text-gray-600 mt-1">
                      Card-Planetary Harmony: {Math.round(insight.synergy * 100)}%
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Analysis Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Chakra Activation */}
                <Card className="border border-indigo-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4 text-indigo-600" />
                      Chakra System
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Primary:</span>
                        <Badge variant="outline" className="text-xs">
                          {insight.chakraActivation.primaryChakra}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Secondary:</span>
                        <Badge variant="outline" className="text-xs">
                          {insight.chakraActivation.secondaryChakra}
                        </Badge>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Activation:</span>
                          <span>{Math.round(insight.chakraActivation.activationLevel * 100)}%</span>
                        </div>
                        <Progress value={insight.chakraActivation.activationLevel * 100} />
                      </div>
                    </div>
                    {insight.chakraActivation.balancingNeeded.length > 0 && (
                      <div className="text-xs text-gray-600">
                        <strong>Balance needed:</strong>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {insight.chakraActivation.balancingNeeded.map((chakra, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {chakra}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Development Path */}
                <Card className="border border-orange-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Star className="h-4 w-4 text-orange-600" />
                      Growth Path
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span>Current:</span>
                        <Badge variant="outline" className="text-xs">
                          {insight.developmentPath.currentPhase}
                        </Badge>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span>Next:</span>
                        <Badge variant="secondary" className="text-xs">
                          {insight.developmentPath.nextPhase}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <strong>Focus Skills:</strong>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {insight.developmentPath.skillsToFocus.map((skill, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <strong>Shadow Work:</strong>
                          <ul className="text-xs space-y-1 mt-1">
                            {insight.developmentPath.shadowWork.slice(0, 2).map((work, index) => (
                              <li key={index} className="flex items-start gap-1">
                                <span className="text-orange-500">•</span>
                                <span>{work}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Time Recommendations */}
              <Card className="border border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    Optimal Timing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">Best Time:</span>
                        <span className="text-blue-700">
                          {insight.timeRecommendations.bestTimeForPractice}
                        </span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">Duration:</span>
                        <span>{insight.timeRecommendations.duration}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">Frequency:</span>
                        <span>{insight.timeRecommendations.frequency}</span>
                      </div>
                      <div className="text-blue-700 font-medium">
                        🌙 {insight.timeRecommendations.moonPhaseAlignment}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="planetary" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(MAJOR_ARCANA_PLANETARY).map(([planet, card]) => (
              <Card
                key={planet}
                className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200 hover:border-purple-300"
                onClick={() => onCardSelect?.(card)}
              >
                <CardContent className="p-4 text-center space-y-2">
                  <div className="flex justify-center">
                    <Crown className="h-8 w-8 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{card.name}</h3>
                    <p className="text-xs text-gray-600">{planet}</p>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    {getElementIcon(card.element)}
                    <span className="text-xs">{card.element}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {card.chakra}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alchemy" className="space-y-4">
          {insight && (
            <Card className="border border-emerald-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hexagon className="h-5 w-5 text-emerald-600" />
                  Alchemical Synthesis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries({
                    Spirit: {
                      value: insight.alchemicalBalance.spirit,
                      color: 'red',
                      shape: 'triangle',
                    },
                    Essence: {
                      value: insight.alchemicalBalance.essence,
                      color: 'blue',
                      shape: 'circle',
                    },
                    Matter: {
                      value: insight.alchemicalBalance.matter,
                      color: 'green',
                      shape: 'square',
                    },
                    Substance: {
                      value: insight.alchemicalBalance.substance,
                      color: 'purple',
                      shape: 'hexagon',
                    },
                  }).map(([element, { value, color, shape }]) => (
                    <Card key={element} className="text-center p-4">
                      <div className="space-y-2">
                        <div className="flex justify-center">{getAlchemicalShape(element)}</div>
                        <h4 className="font-medium text-sm">{element}</h4>
                        <div className="space-y-1">
                          <Progress value={value * 100} className={`w-full`} />
                          <span className="text-xs font-mono">{value.toFixed(2)}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="bg-emerald-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-emerald-800">Elemental Harmony</h4>
                    <Badge variant="outline">
                      {Math.round(insight.alchemicalBalance.elementalHarmony * 100)}%
                    </Badge>
                  </div>
                  <Progress
                    value={insight.alchemicalBalance.elementalHarmony * 100}
                    className="mb-2"
                  />
                  <p className="text-sm text-emerald-700">
                    Dominant Element: <strong>{insight.alchemicalBalance.dominantElement}</strong>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default EnhancedTarotDashboard
