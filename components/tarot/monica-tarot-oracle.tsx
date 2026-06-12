'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkles, Star, Crown, Eye, Zap, Heart, Sun, Moon, Wand2, Shield } from 'lucide-react'
import {
  getCurrentDecan,
  getPlanetaryRulerCard,
  generateConsciousnessCraftingInsight,
  DECAN_TAROT_MAPPINGS,
  type TarotCard,
  type MajorArcanaCard,
  type ConsciousnessCraftingInsight,
} from '@/lib/monica/tarot-oracle'

interface TarotCardDisplayProps {
  card: TarotCard | MajorArcanaCard
  type: 'minor' | 'major'
  title: string
  glowColor?: string
}

const TarotCardDisplay: React.FC<TarotCardDisplayProps> = ({
  card,
  type,
  title,
  glowColor = 'purple',
}) => {
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

  const glowClass = `monica-tarot-card-glow-${glowColor}`

  return (
    <Card className={`relative overflow-hidden border-2 ${glowClass} monica-tarot-card`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {type === 'minor' && 'suit' in card && getSuitIcon(card.suit)}
            {type === 'major' && <Crown className="h-5 w-5 text-gold-500" />}
            {card.name}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {type === 'minor' && 'number' in card ? `${card.number}` : 'Major'}
          </Badge>
        </div>
        <CardDescription className="text-sm font-medium text-purple-700">{title}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Element and Planetary Ruler */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            {getElementIcon(card.element)}
            <span className="text-gray-600">{card.element}</span>
          </div>
          <div className="flex items-center gap-1">
            <Sun className="h-4 w-4 text-orange-400" />
            <span className="text-gray-600">{card.planetaryRuler}</span>
          </div>
        </div>

        {/* Keywords */}
        <div className="flex flex-wrap gap-1">
          {card.keywords.slice(0, 3).map((keyword, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {keyword}
            </Badge>
          ))}
        </div>

        {/* Meaning */}
        <p className="text-sm text-gray-700 leading-relaxed">{card.meaning}</p>

        {/* Consciousness Level */}
        <div className="bg-purple-50 p-2 rounded-lg">
          <p className="text-xs font-medium text-purple-800">🧠 {card.consciousness}</p>
        </div>

        {/* Alchemical Values for Minor Arcana */}
        {type === 'minor' && 'alchemicalValues' in card && (
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div className="flex justify-between">
              <span>Spirit:</span>
              <span className="font-mono">{card.alchemicalValues.spirit}</span>
            </div>
            <div className="flex justify-between">
              <span>Essence:</span>
              <span className="font-mono">{card.alchemicalValues.essence}</span>
            </div>
            <div className="flex justify-between">
              <span>Matter:</span>
              <span className="font-mono">{card.alchemicalValues.matter}</span>
            </div>
            <div className="flex justify-between">
              <span>Substance:</span>
              <span className="font-mono">{card.alchemicalValues.substance}</span>
            </div>
          </div>
        )}

        {/* Chakra for Major Arcana */}
        {type === 'major' && 'chakra' in card && (
          <div className="flex items-center gap-2 text-sm">
            <Eye className="h-4 w-4 text-indigo-500" />
            <span className="text-indigo-700">{card.chakra} Chakra</span>
          </div>
        )}
      </CardContent>

      {/* Mystical corner decoration */}
      <div className="absolute top-2 right-2 opacity-20">
        <Sparkles className="h-6 w-6 text-purple-400" />
      </div>
    </Card>
  )
}

interface MonicaTarotOracleProps {
  onInsightGenerated?: (insight: ConsciousnessCraftingInsight) => void
}

const MonicaTarotOracle: React.FC<MonicaTarotOracleProps> = ({ onInsightGenerated }) => {
  const [currentDecanCard, setCurrentDecanCard] = useState<TarotCard | null>(null)
  const [planetaryCard, setPlanetaryCard] = useState<MajorArcanaCard | null>(null)
  const [insight, setInsight] = useState<ConsciousnessCraftingInsight | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [sunPosition, setSunPosition] = useState<string>('')

  useEffect(() => {
    const abortController = new AbortController()

    // Calculate current cosmic tarot configuration
    const loadTarotConfiguration = async () => {
      setIsLoading(true)

      try {
        // Early abort check before any async operations
        if (abortController.signal.aborted) {
          console.log('Tarot configuration request aborted before starting')
          return
        }

        // Get current decan card with real-time positions
        const { card: decanCard, sunPosition: position } = await getCurrentDecan(
          abortController.signal
        )

        // Check if component was unmounted or aborted after async operation
        if (abortController.signal.aborted) return

        // Only update state if not aborted
        if (!abortController.signal.aborted) {
          setCurrentDecanCard(decanCard)
          setSunPosition(position)

          // Get the decan's planetary ruler card
          let rulerCard: MajorArcanaCard | null = null
          if (decanCard && decanCard.planetaryRuler) {
            rulerCard = getPlanetaryRulerCard(decanCard.planetaryRuler)
          }

          // If no ruler card found, fallback to Sun
          if (!rulerCard) {
            rulerCard = getPlanetaryRulerCard('Sun')
          }

          setPlanetaryCard(rulerCard)

          // Generate consciousness crafting insight
          if (decanCard && rulerCard) {
            const craftingInsight = generateConsciousnessCraftingInsight(decanCard, rulerCard)
            setInsight(craftingInsight)
            onInsightGenerated?.(craftingInsight)
          }
        }
      } catch (error) {
        // Check if the error is due to abortion - handle this gracefully
        if (
          abortController.signal.aborted ||
          (error instanceof Error &&
            (error.name === 'AbortError' ||
              error.message.includes('aborted') ||
              error.message.includes('Request aborted')))
        ) {
          console.log('Tarot configuration request was aborted - component likely unmounted')
          return
        }

        console.error('Error loading tarot configuration (non-abort):', error)

        // Fallback: set default values if API fails (only if not aborted)
        if (!abortController.signal.aborted) {
          const fallbackCard = DECAN_TAROT_MAPPINGS[110] // Default Cancer 3rd decan
          setCurrentDecanCard(fallbackCard || null)
          setSunPosition('Unable to determine (using fallback)')

          // Set fallback planetary card
          const fallbackRulerCard = getPlanetaryRulerCard('Sun')
          setPlanetaryCard(fallbackRulerCard)

          // Generate fallback insight
          if (fallbackCard && fallbackRulerCard) {
            const fallbackInsight = generateConsciousnessCraftingInsight(
              fallbackCard,
              fallbackRulerCard
            )
            setInsight(fallbackInsight)
            onInsightGenerated?.(fallbackInsight)
          }
        }
      } finally {
        // Always clear loading state unless aborted
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadTarotConfiguration()

    // Cleanup function to abort the request if component unmounts
    return () => {
      try {
        if (abortController && !abortController.signal.aborted) {
          abortController.abort()
        }
      } catch (error) {
        // Silently handle abort errors during cleanup
        console.debug('AbortController cleanup error (expected during unmount):', error)
      }
    }
  }, []) // Remove onInsightGenerated dependency to prevent unnecessary re-runs

  if (isLoading) {
    return (
      <Card className="monica-tarot-oracle-loading">
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

  return (
    <div className="monica-tarot-oracle space-y-6">
      {/* Oracle Header */}
      <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Crown className="h-6 w-6 text-purple-600" />
            Monica&apos;s Tarot Oracle
            <Sparkles className="h-6 w-6 text-gold-500" />
          </CardTitle>
          <CardDescription className="text-purple-700">
            Current Cosmic Tarot Configuration for Consciousness Crafting
          </CardDescription>
          {sunPosition && (
            <p className="text-sm text-amber-600 mt-2">
              <Sun className="inline h-4 w-4 mr-1" />
              Sun at {sunPosition}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Current Cards Display */}
      <div className="grid md:grid-cols-2 gap-6">
        {currentDecanCard && (
          <TarotCardDisplay
            card={currentDecanCard}
            type="minor"
            title="Current Decan Card"
            glowColor="blue"
          />
        )}

        {planetaryCard && (
          <TarotCardDisplay
            card={planetaryCard}
            type="major"
            title={`${currentDecanCard?.planetaryRuler || 'Solar'} Ruler Card`}
            glowColor="gold"
          />
        )}
      </div>

      {/* Advanced Consciousness Crafting Insight */}
      {insight && (
        <div className="space-y-4">
          {/* Main Insight Card */}
          <Card className="border-2 border-gold-200 bg-gradient-to-r from-gold-50 to-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5 text-gold-600" />
                Advanced Consciousness Crafting
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Synergy: {Math.round(insight.synergy * 100)}%
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {insight.consciousnessLevel}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {insight.alchemicalBalance.dominantElement} Dominant
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-purple-800">💫 Cosmic Guidance</h4>
                <p className="text-sm text-gray-700 leading-relaxed">{insight.guidance}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-purple-800">🎯 Practical Application</h4>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {insight.practicalApplication}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Analysis Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Chakra Activation */}
            <Card className="border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-indigo-600" />
                  Chakra Activation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Primary:</span>
                  <span className="font-medium text-indigo-700">
                    {insight.chakraActivation.primaryChakra}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Secondary:</span>
                  <span className="font-medium text-indigo-700">
                    {insight.chakraActivation.secondaryChakra}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Activation:</span>
                  <span className="font-medium">
                    {Math.round(insight.chakraActivation.activationLevel * 100)}%
                  </span>
                </div>
                {insight.chakraActivation.balancingNeeded.length > 0 && (
                  <div className="text-xs text-gray-600 mt-2">
                    <strong>Balance needed:</strong>{' '}
                    {insight.chakraActivation.balancingNeeded.join(', ')}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alchemical Balance */}
            <Card className="border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  Alchemical Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span>Spirit:</span>
                    <span className="font-mono">{insight.alchemicalBalance.spirit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Essence:</span>
                    <span className="font-mono">
                      {insight.alchemicalBalance.essence.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Matter:</span>
                    <span className="font-mono">{insight.alchemicalBalance.matter.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Substance:</span>
                    <span className="font-mono">
                      {insight.alchemicalBalance.substance.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-emerald-700 font-medium">
                  Elemental Harmony: {Math.round(insight.alchemicalBalance.elementalHarmony * 100)}%
                </div>
              </CardContent>
            </Card>

            {/* Development Path */}
            <Card className="border border-orange-200 bg-gradient-to-br from-orange-50 to-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="h-4 w-4 text-orange-600" />
                  Development Path
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span>Current Phase:</span>
                    <span className="font-medium text-orange-700">
                      {insight.developmentPath.currentPhase}
                    </span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span>Next Phase:</span>
                    <span className="font-medium text-orange-700">
                      {insight.developmentPath.nextPhase}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <strong>Focus Skills:</strong>
                    <div className="flex flex-wrap gap-1">
                      {insight.developmentPath.skillsToFocus.map((skill, index) => (
                        <Badge key={index} variant="outline" className="text-xs py-0">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Time Recommendations */}
            <Card className="border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Moon className="h-4 w-4 text-blue-600" />
                  Optimal Timing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Best Time:</span>
                    <span className="font-medium text-blue-700">
                      {insight.timeRecommendations.bestTimeForPractice}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-medium">{insight.timeRecommendations.duration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Frequency:</span>
                    <span className="font-medium">{insight.timeRecommendations.frequency}</span>
                  </div>
                  <div className="text-blue-700 font-medium mt-2">
                    🌙 {insight.timeRecommendations.moonPhaseAlignment}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Shadow Work & Integration */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-600" />
                  Shadow Work
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs space-y-1">
                  {insight.developmentPath.shadowWork.map((work, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-purple-500">•</span>
                      <span>{work}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Heart className="h-4 w-4 text-teal-600" />
                  Integration Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs space-y-1">
                  {insight.developmentPath.integration.map((practice, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-teal-500">•</span>
                      <span>{practice}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <Button
          variant="outline"
          className="monica-mystical-button"
          onClick={() => window.location.reload()}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Refresh Oracle
        </Button>

        <Button
          className="bg-purple-600 hover:bg-purple-700 monica-mystical-button"
          onClick={() => {
            // Could trigger a deeper tarot reading or consciousness analysis
            console.log('Deep tarot analysis requested')
          }}
        >
          <Crown className="h-4 w-4 mr-2" />
          Deep Analysis
        </Button>
      </div>
    </div>
  )
}

export default MonicaTarotOracle
