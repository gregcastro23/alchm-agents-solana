'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Flame, Droplets, Mountain, Wind, TrendingUp, RotateCcw, Play, Pause } from 'lucide-react'

export interface TokenState {
  Spirit: number
  Essence: number
  Matter: number
  Substance: number
}

export interface ConsciousnessLevel {
  name: string
  level: number
  description?: string
}

export interface TokenMonitorIntegrationProps {
  initial?: TokenState
  mc: number
  level: ConsciousnessLevel
  onChange?: (tokens: TokenState) => void
  autoGenerate?: boolean
  className?: string
}

interface TokenMultiplier {
  base: number
  consciousness: number
  mcBonus: number
  total: number
}

// MC bonus thresholds with diminishing returns
const MC_BONUS_THRESHOLDS = {
  elevated: 1.618, // Golden ratio threshold
  advanced: 2.618, // Fibonacci progression
  illuminated: 4.236, // Higher consciousness
  transcendent: 6.854, // Unity consciousness
}

/**
 * Calculate consciousness-based multiplier
 */
function calculateConsciousnessMultiplier(level: number): number {
  return 1 + level * 0.1 // 10% per level as specified
}

/**
 * Calculate Monica Constant bonus with diminishing returns
 */
function calculateMCBonus(mc: number): number {
  if (mc < MC_BONUS_THRESHOLDS.elevated) return 0

  // Progressive bonus with diminishing returns, capped at 0.3
  let bonus = 0

  if (mc >= MC_BONUS_THRESHOLDS.elevated) {
    bonus += 0.05 // Base elevated bonus
  }
  if (mc >= MC_BONUS_THRESHOLDS.advanced) {
    bonus += 0.05 // Advanced bonus
  }
  if (mc >= MC_BONUS_THRESHOLDS.illuminated) {
    bonus += 0.1 // Significant illuminated bonus
  }
  if (mc >= MC_BONUS_THRESHOLDS.transcendent) {
    bonus += 0.1 // Transcendent bonus
  }

  return Math.min(0.3, bonus) // Cap at 0.3 total as specified
}

/**
 * Calculate token multipliers for all elements
 */
function calculateTokenMultipliers(
  mc: number,
  level: ConsciousnessLevel
): Record<keyof TokenState, TokenMultiplier> {
  const consciousnessMultiplier = calculateConsciousnessMultiplier(level.level)
  const mcBonus = calculateMCBonus(mc)

  return {
    Spirit: {
      base: 1.0,
      consciousness: consciousnessMultiplier,
      mcBonus,
      total: consciousnessMultiplier + mcBonus,
    },
    Essence: {
      base: 1.0,
      consciousness: consciousnessMultiplier,
      mcBonus,
      total: consciousnessMultiplier + mcBonus,
    },
    Matter: {
      base: 1.0,
      consciousness: consciousnessMultiplier,
      mcBonus,
      total: consciousnessMultiplier + mcBonus,
    },
    Substance: {
      base: 1.0,
      consciousness: consciousnessMultiplier,
      mcBonus,
      total: consciousnessMultiplier + mcBonus,
    },
  }
}

/**
 * Generate new token values based on multipliers
 */
function generateTokenValues(
  current: TokenState,
  multipliers: Record<keyof TokenState, TokenMultiplier>,
  baseIncrement: number = 1
): TokenState {
  return {
    Spirit: Math.min(100, current.Spirit + baseIncrement * multipliers.Spirit.total),
    Essence: Math.min(100, current.Essence + baseIncrement * multipliers.Essence.total),
    Matter: Math.min(100, current.Matter + baseIncrement * multipliers.Matter.total),
    Substance: Math.min(100, current.Substance + baseIncrement * multipliers.Substance.total),
  }
}

export function TokenMonitorIntegration({
  initial = { Spirit: 25, Essence: 25, Matter: 25, Substance: 25 },
  mc,
  level,
  onChange,
  autoGenerate = false,
  className = '',
}: TokenMonitorIntegrationProps) {
  const [tokens, setTokens] = useState<TokenState>(initial)
  const [isGenerating, setIsGenerating] = useState(autoGenerate)
  const [generationCount, setGenerationCount] = useState(0)

  // Calculate multipliers
  const multipliers = calculateTokenMultipliers(mc, level)

  // Auto-generation effect
  useEffect(() => {
    if (!isGenerating) return

    const interval = setInterval(() => {
      setTokens(current => {
        const newTokens = generateTokenValues(current, multipliers, 2)
        setGenerationCount(prev => prev + 1)
        return newTokens
      })
    }, 2000) // Generate every 2 seconds

    return () => clearInterval(interval)
  }, [isGenerating, multipliers])

  // Notify parent of changes
  useEffect(() => {
    onChange?.(tokens)
  }, [tokens, onChange])

  const handleReset = useCallback(() => {
    setTokens(initial)
    setGenerationCount(0)
  }, [initial])

  const handleManualGenerate = useCallback(() => {
    setTokens(current => generateTokenValues(current, multipliers, 3))
    setGenerationCount(prev => prev + 1)
  }, [multipliers])

  const toggleAutoGenerate = useCallback(() => {
    setIsGenerating(prev => !prev)
  }, [])

  const getElementIcon = (element: keyof TokenState) => {
    const icons = {
      Spirit: <Flame className="h-4 w-4 text-red-500" />,
      Essence: <Droplets className="h-4 w-4 text-blue-500" />,
      Matter: <Mountain className="h-4 w-4 text-green-500" />,
      Substance: <Wind className="h-4 w-4 text-gray-500" />,
    }
    return icons[element]
  }

  const getElementColor = (element: keyof TokenState) => {
    const colors = {
      Spirit: 'border-red-200 bg-gradient-to-br from-red-50 to-orange-50',
      Essence: 'border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50',
      Matter: 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50',
      Substance: 'border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50',
    }
    return colors[element]
  }

  const getProgressColor = (element: keyof TokenState) => {
    const colors = {
      Spirit: 'text-red-600',
      Essence: 'text-blue-600',
      Matter: 'text-green-600',
      Substance: 'text-gray-600',
    }
    return colors[element]
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with consciousness info and controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Token Monitor Integration
              </CardTitle>
              <CardDescription>Consciousness-enhanced token generation</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <span className="font-medium">MC:</span>
                <span>{mc.toFixed(3)}</span>
              </Badge>
              <Badge variant="secondary">
                {level.name} (L{level.level})
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              Generations: {generationCount} • Multiplier: {multipliers.Spirit.total.toFixed(2)}x •
              MC Bonus: +{(multipliers.Spirit.mcBonus * 100).toFixed(0)}%
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleManualGenerate}
                className="flex items-center gap-1"
              >
                <TrendingUp className="h-3 w-3" />
                Generate
              </Button>

              <Button
                variant={isGenerating ? 'destructive' : 'default'}
                size="sm"
                onClick={toggleAutoGenerate}
                className="flex items-center gap-1"
              >
                {isGenerating ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {isGenerating ? 'Pause' : 'Auto'}
              </Button>
            </div>
          </div>

          {/* Token display grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.keys(tokens) as Array<keyof TokenState>).map(element => {
              const value = tokens[element]
              const multiplier = multipliers[element]

              return (
                <Card key={element} className={getElementColor(element)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      {getElementIcon(element)}
                      {element}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {element === 'Spirit' && 'Divine Spark & Inspiration'}
                      {element === 'Essence' && 'Emotional Truth & Soul Flow'}
                      {element === 'Matter' && 'Physical Manifestation'}
                      {element === 'Substance' && 'Mental Structure & Communication'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    <div className={`text-2xl font-bold ${getProgressColor(element)}`}>
                      {value.toFixed(1)}
                    </div>

                    <Progress value={value} className="h-2" />

                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base:</span>
                        <span>{multiplier.base.toFixed(1)}x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Consciousness:</span>
                        <span>+{((multiplier.consciousness - 1) * 100).toFixed(0)}%</span>
                      </div>
                      {multiplier.mcBonus > 0 && (
                        <div className="flex justify-between text-purple-600">
                          <span>MC Bonus:</span>
                          <span>+{(multiplier.mcBonus * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Generation status indicator */}
          {isGenerating && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-4 p-2 bg-green-50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Auto-generation active • Next update in ~2s
            </div>
          )}
        </CardContent>
      </Card>

      {/* Multiplier breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consciousness Multiplier Breakdown</CardTitle>
          <CardDescription>
            How your Monica Constant and consciousness level enhance token generation
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <div className="font-medium flex items-center gap-2">
                <Badge variant="outline">Base Rate</Badge>
              </div>
              <div className="text-muted-foreground">1.0x standard generation for all elements</div>
            </div>

            <div className="space-y-2">
              <div className="font-medium flex items-center gap-2">
                <Badge variant="secondary">Consciousness</Badge>
              </div>
              <div className="text-muted-foreground">
                +{((multipliers.Spirit.consciousness - 1) * 100).toFixed(0)}% from Level{' '}
                {level.level} ({level.name})
              </div>
            </div>

            {multipliers.Spirit.mcBonus > 0 && (
              <div className="space-y-2">
                <div className="font-medium flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-800">MC Bonus</Badge>
                </div>
                <div className="text-muted-foreground">
                  +{(multipliers.Spirit.mcBonus * 100).toFixed(0)}% from MC {mc.toFixed(3)}
                  {mc >= MC_BONUS_THRESHOLDS.transcendent && ' (Transcendent)'}
                  {mc >= MC_BONUS_THRESHOLDS.illuminated &&
                    mc < MC_BONUS_THRESHOLDS.transcendent &&
                    ' (Illuminated)'}
                  {mc >= MC_BONUS_THRESHOLDS.advanced &&
                    mc < MC_BONUS_THRESHOLDS.illuminated &&
                    ' (Advanced)'}
                  {mc >= MC_BONUS_THRESHOLDS.elevated &&
                    mc < MC_BONUS_THRESHOLDS.advanced &&
                    ' (Elevated)'}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total Multiplier:</span>
              <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                {multipliers.Spirit.total.toFixed(3)}x
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              All elements generate {((multipliers.Spirit.total - 1) * 100).toFixed(0)}% faster
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
