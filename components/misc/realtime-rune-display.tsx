'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { RefreshCw, Zap, Clock, Globe, Sparkles } from 'lucide-react'
import { errorToast, successToast } from '@/hooks/use-toast'

interface RealtimeRune {
  id: string
  name: string
  description: string
  type: string
  runeType: string
  rarity: string
  powerLevel: number
  cost: {
    Spirit: number
    Essence: number
    Matter: number
    Substance: number
  }
  effects: Array<{
    type: string
    name: string
    description: string
    power: number
    duration: string
  }>
  metadata: {
    generationTime: string
    planetarySnapshot?: any
    alchemicalConditions?: any
    dominantElement: string
    activeInfluences: number
  }
}

interface RealtimeRuneDisplayProps {
  variant?: 'card' | 'inline' | 'widget'
  autoRefresh?: boolean
  refreshInterval?: number
  includeAlchemical?: boolean
  runeType?: 'basic' | 'enhanced' | 'premium'
  className?: string
}

export default function RealtimeRuneDisplay({
  variant = 'card',
  autoRefresh = false,
  refreshInterval = 60000, // 1 minute
  includeAlchemical = true,
  runeType = 'enhanced',
  className = '',
}: RealtimeRuneDisplayProps) {
  const [rune, setRune] = useState<RealtimeRune | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchRealtimeRune = async () => {
    setLoading(true)
    setError(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch(
        `/api/realtime-runes?includeAlchemical=${includeAlchemical}&runeType=${runeType}`,
        {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
          },
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 503 || response.status === 502) {
          throw new Error('Service temporarily unavailable - rune patterns preserved')
        }
        throw new Error(`API returned status ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.rune) {
        setRune(data.rune)
        setLastUpdated(new Date())
        successToast('Cosmic rune generated successfully')
      } else {
        throw new Error(data.error || 'Failed to generate rune')
      }
    } catch (err: any) {
      console.error('Error fetching realtime rune:', err)

      let errorMessage = 'Unknown error'
      if (err.name === 'AbortError') {
        errorMessage = 'Request timeout - please try again'
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = 'Network connection unavailable'
      } else {
        errorMessage = err instanceof Error ? err.message : 'Unknown error'
      }

      setError(errorMessage)
      errorToast(errorMessage, 'Rune Generation Failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRealtimeRune()
  }, [includeAlchemical, runeType])

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(fetchRealtimeRune, refreshInterval)
      return () => clearInterval(interval)
    }
    return undefined
  }, [autoRefresh, refreshInterval])

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'cosmic':
        return 'bg-purple-600'
      case 'legendary':
        return 'bg-orange-600'
      case 'rare':
        return 'bg-blue-600'
      case 'uncommon':
        return 'bg-green-600'
      default:
        return 'bg-gray-600'
    }
  }

  const getElementColor = (element: string) => {
    switch (element?.toLowerCase()) {
      case 'fire':
        return 'text-red-600'
      case 'water':
        return 'text-blue-600'
      case 'air':
        return 'text-yellow-600'
      case 'earth':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  if (variant === 'widget') {
    return (
      <div
        className={`bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-lg p-3 border ${className}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium">Cosmic Rune</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchRealtimeRune}
            disabled={loading}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {error ? (
          <div className="text-xs text-red-600">Error loading rune</div>
        ) : loading ? (
          <div className="text-xs text-muted-foreground">Generating...</div>
        ) : rune ? (
          <div className="space-y-1">
            <div className="text-xs font-medium truncate" title={rune.name}>
              {rune.name}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getRarityColor(rune.rarity)} size="sm">
                {rune.rarity}
              </Badge>
              <span className={`text-xs ${getElementColor(rune.metadata.dominantElement)}`}>
                {rune.metadata.dominantElement}
              </span>
            </div>
            <Progress value={(rune.powerLevel / 100) * 100} className="h-1" />
          </div>
        ) : null}
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-3 p-2 bg-muted rounded-lg ${className}`}>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-600" />
          {loading ? (
            <span className="text-sm">Generating rune...</span>
          ) : error ? (
            <span className="text-sm text-red-600">Rune generation failed</span>
          ) : rune ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{rune.name}</span>
              <Badge className={getRarityColor(rune.rarity)} size="sm">
                {rune.rarity}
              </Badge>
              <span className="text-xs text-muted-foreground">Power: {rune.powerLevel}</span>
            </div>
          ) : null}
        </div>

        <Button size="sm" variant="ghost" onClick={fetchRealtimeRune} disabled={loading}>
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    )
  }

  // Default card variant
  return (
    <Card className={`border-2 border-purple-200 dark:border-purple-800 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Real-Time Cosmic Rune
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {lastUpdated.toLocaleTimeString()}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={fetchRealtimeRune}
              disabled={loading}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="text-center py-4">
            <div className="text-red-600 mb-2">Failed to generate rune</div>
            <div className="text-sm text-muted-foreground">{error}</div>
          </div>
        ) : loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
            <div className="text-sm text-muted-foreground">Channeling cosmic energies...</div>
          </div>
        ) : rune ? (
          <div className="space-y-4">
            {/* Rune Header */}
            <div className="text-center">
              <h3 className="text-xl font-bold mb-2">{rune.name}</h3>
              <div className="flex items-center justify-center gap-2 mb-3">
                <Badge className={getRarityColor(rune.rarity)}>{rune.rarity}</Badge>
                <Badge variant="outline">{rune.type}</Badge>
                <Badge variant="outline" className={getElementColor(rune.metadata.dominantElement)}>
                  {rune.metadata.dominantElement}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{rune.description}</p>
            </div>

            <Separator />

            {/* Power Level */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Power Level</span>
                <span className="text-sm font-bold">{rune.powerLevel}/100</span>
              </div>
              <Progress value={rune.powerLevel} className="h-2" />
            </div>

            {/* Costs */}
            <div>
              <div className="text-sm font-medium mb-2">Alchemical Costs</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex justify-between">
                  <span className="text-xs text-red-600">Spirit:</span>
                  <span className="text-xs font-medium">{rune.cost.Spirit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-blue-600">Essence:</span>
                  <span className="text-xs font-medium">{rune.cost.Essence}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-green-600">Matter:</span>
                  <span className="text-xs font-medium">{rune.cost.Matter}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-yellow-600">Substance:</span>
                  <span className="text-xs font-medium">{rune.cost.Substance}</span>
                </div>
              </div>
            </div>

            {/* Effects */}
            {rune.effects && rune.effects.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Effects</div>
                <div className="space-y-2">
                  {rune.effects.map((effect, index) => (
                    <div key={index} className="text-xs p-2 bg-muted rounded">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">{effect.name}</span>
                        <Badge size="sm" variant="outline">
                          {effect.power}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">{effect.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Generated:</span>
                <span>{new Date(rune.metadata.generationTime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Influences:</span>
                <span>{rune.metadata.activeInfluences} planetary positions</span>
              </div>
              {rune.metadata.alchemicalConditions && (
                <div className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  <span>Real-time alchemical integration active</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            Click refresh to generate a cosmic rune
          </div>
        )}
      </CardContent>
    </Card>
  )
}
