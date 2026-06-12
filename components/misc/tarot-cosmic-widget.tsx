'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  ChevronRight,
  Expand,
  RotateCw,
  Brain,
} from 'lucide-react'
import { getCurrentDecan, DECAN_TAROT_MAPPINGS, type TarotCard } from '@/lib/monica/tarot-oracle'
import Link from 'next/link'

interface TarotCosmicWidgetProps {
  variant?: 'sidebar' | 'header' | 'card' | 'inline'
  showExpanded?: boolean
  linkToFullOracle?: boolean
}

const TarotCosmicWidget: React.FC<TarotCosmicWidgetProps> = ({
  variant = 'card',
  showExpanded = false,
  linkToFullOracle = true,
}) => {
  const [currentCard, setCurrentCard] = useState<TarotCard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sunPosition, setSunPosition] = useState<string>('')
  const [isExpanded, setIsExpanded] = useState(showExpanded)

  useEffect(() => {
    const abortController = new AbortController()

    const loadCurrentCard = async () => {
      try {
        // Early abort check before any async operations
        if (abortController.signal.aborted) {
          console.log('TarotCosmicWidget request aborted before starting')
          return
        }

        const { card, sunPosition } = await getCurrentDecan(abortController.signal)

        if (abortController.signal.aborted) return

        setCurrentCard(card)
        setSunPosition(sunPosition)
      } catch (error) {
        // Check if the error is due to abortion first
        if (abortController.signal.aborted) {
          console.log('TarotCosmicWidget request was aborted')
          return
        }

        // Handle AbortError and abort messages specifically
        if (
          error instanceof Error &&
          (error.name === 'AbortError' ||
            error.message.includes('aborted') ||
            error.message.includes('Request aborted'))
        ) {
          console.log('TarotCosmicWidget AbortError caught:', error.message)
          return
        }

        console.error('TarotCosmicWidget error (non-abort):', error)

        // Only update state if not aborted - use graceful fallback
        if (!abortController.signal.aborted) {
          try {
            // Use a safe fallback card
            setCurrentCard(
              DECAN_TAROT_MAPPINGS[110] || {
                name: 'The Star',
                number: 17,
                planetaryRuler: 'Aquarius',
                element: 'Air',
                chakra: 'Crown',
                keywords: ['hope', 'guidance', 'inspiration'],
                meaning: 'Hope and spiritual guidance in times of uncertainty.',
                consciousness: 'Fixed Air inspiration - innovative hope and humanitarian vision',
              }
            )
            setSunPosition('Current moment')
          } catch (fallbackError) {
            console.error('Fallback failed in TarotCosmicWidget:', fallbackError)
          }
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadCurrentCard()

    return () => {
      // Provide an explicit reason to avoid noisy "signal is aborted without reason" console messages
      // and make downstream handling clearer.
      try {
        abortController.abort('component-unmount')
      } catch {
        // abort() can throw if the controller already settled — safe to ignore.
      }
    }
  }, [])

  const getSuitIcon = (suit: string) => {
    switch (suit) {
      case 'Wands':
        return <Wand2 className="h-4 w-4 text-red-500" />
      case 'Cups':
        return <Heart className="h-4 w-4 text-blue-500" />
      case 'Swords':
        return <Shield className="h-4 w-4 text-gray-500" />
      case 'Pentacles':
        return <Star className="h-4 w-4 text-yellow-500" />
      default:
        return <Sparkles className="h-4 w-4 text-purple-500" />
    }
  }

  const getElementIcon = (element: string) => {
    switch (element) {
      case 'Fire':
        return <Zap className="h-3 w-3 text-red-400" />
      case 'Water':
        return <Heart className="h-3 w-3 text-blue-400" />
      case 'Air':
        return <Eye className="h-3 w-3 text-gray-400" />
      case 'Earth':
        return <Star className="h-3 w-3 text-green-400" />
      default:
        return <Sparkles className="h-3 w-3 text-purple-400" />
    }
  }

  if (isLoading) {
    return (
      <div
        className={`
        ${variant === 'sidebar' ? 'w-full' : ''}
        ${variant === 'header' ? 'flex items-center gap-2' : ''}
        ${variant === 'inline' ? 'inline-flex items-center gap-2' : ''}
      `}
      >
        <div className="animate-pulse flex items-center gap-2 p-2 bg-purple-50 rounded">
          <Crown className="h-4 w-4 text-purple-500 animate-spin" />
          <span className="text-sm text-purple-600">Loading cosmic card...</span>
        </div>
      </div>
    )
  }

  // Sidebar variant
  if (variant === 'sidebar') {
    return (
      <Card className="w-full border-purple-200 bg-gradient-to-b from-purple-50 to-pink-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Crown className="h-4 w-4 text-purple-600" />
            Cosmic Moment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentCard && (
            <>
              <div className="flex items-center gap-2">
                {getSuitIcon(currentCard.suit)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{currentCard.name}</p>
                  <div className="flex items-center gap-1">
                    {getElementIcon(currentCard.element)}
                    <span className="text-xs text-gray-600">{currentCard.element}</span>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {currentCard.keywords.slice(0, 2).map((keyword, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>

                  <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">
                    {currentCard.meaning}
                  </p>

                  <div className="bg-purple-100 p-2 rounded text-xs">
                    <p className="text-purple-800 font-medium">
                      {currentCard.consciousness.split(' - ')[0]}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-6 px-2 text-xs"
                >
                  <Expand className="h-3 w-3 mr-1" />
                  {isExpanded ? 'Less' : 'More'}
                </Button>

                {linkToFullOracle && (
                  <Link href="/tarot-dashboard">
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </div>

              {sunPosition && (
                <p className="text-xs text-amber-600 border-t pt-2">
                  <Sun className="inline h-3 w-3 mr-1" />
                  {sunPosition}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // Header variant
  if (variant === 'header') {
    return (
      <div className="flex items-center gap-3 px-3 py-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
        <Crown className="h-4 w-4 text-purple-600" />

        {currentCard && (
          <>
            <div className="flex items-center gap-2">
              {getSuitIcon(currentCard.suit)}
              <span className="font-medium text-sm">{currentCard.name}</span>
            </div>

            <div className="flex items-center gap-1">
              {getElementIcon(currentCard.element)}
              <Badge variant="outline" className="text-xs h-5">
                {currentCard.element}
              </Badge>
            </div>

            <div className="text-xs text-gray-600">{currentCard.keywords[0]}</div>
          </>
        )}

        {linkToFullOracle && (
          <Link href="/tarot-dashboard">
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        )}
      </div>
    )
  }

  // Inline variant
  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center gap-2 px-2 py-1 bg-purple-50 rounded border border-purple-200">
        <Crown className="h-3 w-3 text-purple-600" />
        {currentCard && (
          <>
            <span className="text-sm font-medium">{currentCard.name}</span>
            <Badge variant="outline" className="text-xs h-4 px-1">
              {currentCard.element}
            </Badge>
          </>
        )}
        {linkToFullOracle && (
          <Link href="/tarot-dashboard" className="text-purple-600 hover:text-purple-800">
            <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </span>
    )
  }

  // Card variant (default)
  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Crown className="h-5 w-5 text-purple-600" />
          Current Cosmic Card
        </CardTitle>
        {sunPosition && !isExpanded && (
          <CardDescription className="text-amber-600 text-xs">
            <Sun className="inline h-3 w-3 mr-1" />
            {sunPosition.split(' ')[0]} {sunPosition.split(' ')[1]}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {currentCard && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getSuitIcon(currentCard.suit)}
                <div>
                  <p className="font-medium">{currentCard.name}</p>
                  <div className="flex items-center gap-1">
                    {getElementIcon(currentCard.element)}
                    <span className="text-xs text-gray-600">{currentCard.element}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-600">{currentCard.planetaryRuler}</span>
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {currentCard.number}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1">
              {currentCard.keywords.slice(0, 3).map((keyword, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>

            {isExpanded && (
              <div className="space-y-2">
                <p className="text-sm text-gray-700 leading-relaxed">{currentCard.meaning}</p>

                <div className="bg-white/50 p-2 rounded">
                  <p className="text-xs font-medium text-purple-800">
                    🧠 {currentCard.consciousness}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span>Spirit:</span>
                    <span className="font-mono">{currentCard.alchemicalValues.spirit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Essence:</span>
                    <span className="font-mono">{currentCard.alchemicalValues.essence}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Matter:</span>
                    <span className="font-mono">{currentCard.alchemicalValues.matter}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Substance:</span>
                    <span className="font-mono">{currentCard.alchemicalValues.substance}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-purple-100">
                  <p className="text-xs font-medium text-purple-800 mb-2">Sacred Stats Alignment</p>
                  <div className="grid grid-cols-7 gap-1">
                    {[
                      {
                        icon: Zap,
                        label: 'Power',
                        value: Math.round(
                          currentCard.alchemicalValues.spirit * 80 +
                            currentCard.alchemicalValues.essence * 20
                        ),
                        color: 'text-orange-600',
                        bg: 'bg-orange-500/10',
                      },
                      {
                        icon: Heart,
                        label: 'Reson.',
                        value: Math.round(
                          currentCard.alchemicalValues.essence * 90 +
                            currentCard.alchemicalValues.substance * 10
                        ),
                        color: 'text-purple-600',
                        bg: 'bg-purple-500/10',
                      },
                      {
                        icon: Brain,
                        label: 'Wisdom',
                        value: Math.round(
                          currentCard.alchemicalValues.matter * 70 +
                            currentCard.alchemicalValues.spirit * 30
                        ),
                        color: 'text-indigo-600',
                        bg: 'bg-indigo-500/10',
                      },
                      {
                        icon: Crown,
                        label: 'Charis.',
                        value: Math.round(
                          currentCard.alchemicalValues.essence * 60 +
                            currentCard.alchemicalValues.spirit * 40
                        ),
                        color: 'text-pink-600',
                        bg: 'bg-pink-500/10',
                      },
                      {
                        icon: Eye,
                        label: 'Intuit.',
                        value: Math.round(
                          currentCard.alchemicalValues.spirit * 50 +
                            currentCard.alchemicalValues.substance * 50
                        ),
                        color: 'text-cyan-600',
                        bg: 'bg-cyan-500/10',
                      },
                      {
                        icon: RotateCw,
                        label: 'Adapt.',
                        value: Math.round(
                          currentCard.alchemicalValues.substance * 80 +
                            currentCard.alchemicalValues.essence * 20
                        ),
                        color: 'text-teal-600',
                        bg: 'bg-teal-500/10',
                      },
                      {
                        icon: Sparkles,
                        label: 'Vital.',
                        value: Math.round(
                          currentCard.alchemicalValues.matter * 90 +
                            currentCard.alchemicalValues.spirit * 10
                        ),
                        color: 'text-green-600',
                        bg: 'bg-green-500/10',
                      },
                    ].map((stat, i) => (
                      <div key={i} className={`text-center p-1 rounded ${stat.bg}`}>
                        <stat.icon className={`h-3 w-3 mx-auto mb-0.5 ${stat.color}`} />
                        <div className="font-mono text-[9px]">{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-purple-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 px-3 text-xs"
              >
                <Expand className="h-3 w-3 mr-1" />
                {isExpanded ? 'Show Less' : 'Show More'}
              </Button>

              {linkToFullOracle && (
                <Link href="/tarot-dashboard">
                  <Button variant="outline" size="sm" className="h-7 px-3 text-xs">
                    Tarot Dashboard
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              )}
            </div>

            {sunPosition && isExpanded && (
              <div className="bg-amber-50 p-2 rounded text-xs">
                <p className="text-amber-700">
                  <Sun className="inline h-3 w-3 mr-1" />
                  Solar Position: {sunPosition}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default TarotCosmicWidget
