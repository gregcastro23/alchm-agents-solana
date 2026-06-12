'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import RunesPreview from '@/components/misc/runes-preview'

interface AstrologicalCondition {
  condition: string
  active: boolean
  effect: string
  multiplier: number
}

interface ConditionsData {
  success: boolean
  conditions: AstrologicalCondition[]
  overallMultiplier: number
  priceChange: 'decreased' | 'increased' | 'stable'
  summary: {
    activeCount: number
    favorableCount: number
    unfavorableCount: number
  }
}

export default function RunesPreviewPage() {
  const [conditionsData, setConditionsData] = useState<ConditionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Simulated user resources (would come from actual user data)
  const userResources = {
    spirit: 25,
    essence: 30,
    matter: 20,
    substance: 15,
    totalCost: 90,
  }

  const fetchConditions = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/runes/current-conditions')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: ConditionsData = await response.json()
      setConditionsData(data)
    } catch (err) {
      console.error('Failed to fetch conditions:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch conditions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConditions()
  }, [])

  const getPriceChangeIcon = () => {
    if (!conditionsData) return <Minus className="h-4 w-4" />

    switch (conditionsData.priceChange) {
      case 'decreased':
        return <TrendingDown className="h-4 w-4 text-green-500" />
      case 'increased':
        return <TrendingUp className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getPriceChangeText = () => {
    if (!conditionsData) return 'Loading...'

    const multiplier = conditionsData.overallMultiplier
    if (multiplier < 1) {
      return `${Math.round((1 - multiplier) * 100)}% cheaper`
    } else if (multiplier > 1) {
      return `${Math.round((multiplier - 1) * 100)}% more expensive`
    }
    return 'Standard pricing'
  }

  // Convert conditions to the format expected by the preview component
  const currentConditions =
    conditionsData?.conditions.reduce(
      (acc, condition) => {
        acc[condition.condition] = condition.active
        return acc
      },
      {} as Record<string, boolean>
    ) || {}

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Runes System Preview
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          Craft powerful consciousness tools using alchemical resources
        </p>

        {/* Current Conditions Summary */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Current Astrological Market Conditions
              <Button variant="ghost" size="sm" onClick={fetchConditions} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>{error} - Using fallback conditions for preview</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {/* Overall Price Impact */}
                <div className="flex items-center justify-center gap-2 text-lg">
                  {getPriceChangeIcon()}
                  <span className="font-medium">Rune prices are {getPriceChangeText()}</span>
                </div>

                {/* Active Conditions */}
                {conditionsData && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {conditionsData.conditions.map((condition, index) => (
                        <Badge
                          key={index}
                          variant={
                            condition.multiplier < 1
                              ? 'default'
                              : condition.multiplier > 1
                                ? 'destructive'
                                : 'outline'
                          }
                          className="text-xs"
                        >
                          {condition.effect}
                        </Badge>
                      ))}
                    </div>

                    <div className="text-sm text-gray-600 grid grid-cols-3 gap-4 max-w-md mx-auto">
                      <div className="text-center">
                        <div className="font-bold text-lg">
                          {conditionsData.summary.activeCount}
                        </div>
                        <div>Active</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-green-600">
                          {conditionsData.summary.favorableCount}
                        </div>
                        <div>Favorable</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-red-600">
                          {conditionsData.summary.unfavorableCount}
                        </div>
                        <div>Unfavorable</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Notice */}
      <Alert className="mb-6 max-w-4xl mx-auto">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Preview Mode:</strong> This is a demonstration of the Runes system. Prices are
          calculated based on real-time astrological conditions from your Alchm system. In the full
          implementation, users would spend actual resources and receive functional runes.
        </AlertDescription>
      </Alert>

      {/* Main Preview Component */}
      <RunesPreview userResources={userResources} currentConditions={currentConditions} />

      {/* System Information */}
      <Card className="mt-8 max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">How the Runes System Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">🔮 Rune Categories</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>
                  <strong>Consciousness:</strong> Enhance awareness and perception
                </li>
                <li>
                  <strong>Protection:</strong> Shield against negative energies
                </li>
                <li>
                  <strong>Enhancement:</strong> Amplify existing abilities
                </li>
                <li>
                  <strong>Manifestation:</strong> Bring intentions into reality
                </li>
                <li>
                  <strong>Divination:</strong> Reveal hidden knowledge
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">⭐ Rarity Levels</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>
                  <strong>Common:</strong> Basic utility runes
                </li>
                <li>
                  <strong>Uncommon:</strong> Enhanced effects
                </li>
                <li>
                  <strong>Rare:</strong> Specialized abilities
                </li>
                <li>
                  <strong>Epic:</strong> Powerful consciousness tools
                </li>
                <li>
                  <strong>Legendary:</strong> Reality-altering capabilities
                </li>
                <li>
                  <strong>Cosmic:</strong> Universe-level influence
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">📈 Dynamic Pricing</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>Prices change based on planetary hours</li>
                <li>Moon phases affect specific rune types</li>
                <li>Planetary dignities influence costs</li>
                <li>Your A-Number unlocks advanced runes</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">⚗️ Resource Management</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>
                  <strong>Spirit:</strong> Consciousness and cosmic energy
                </li>
                <li>
                  <strong>Essence:</strong> Emotional and intuitive power
                </li>
                <li>
                  <strong>Matter:</strong> Physical manifestation force
                </li>
                <li>
                  <strong>Substance:</strong> Structural and binding energy
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
