'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Zap,
  Flame,
  Droplets,
  Mountain,
  Wind,
  Eye,
  Camera,
  RefreshCw,
  Target,
} from 'lucide-react'
import { usePlanetaryPositions } from '@/hooks/usePlanetaryPositions'
import { logger, LogLevel } from '@/lib/structured-logger'
import { defaultAlchemicalMCPConfig, isTokenStable } from '@/test/alchemical-devtools/mcp-config'

type ElementalTokens = {
  spirit: number
  essence: number
  matter: number
  substance: number
}

type TokenEquilibrium = {
  goldenRatio: number
  elementalHarmony: number
  planetaryDignity: number
  overallHealth: number
}

// Alchemical element icons mapping
const elementIcons = {
  spirit: Flame,
  essence: Droplets,
  matter: Mountain,
  substance: Wind,
}

// Planetary rulership colors for visual consistency
const elementColors = {
  spirit: 'text-orange-500',
  essence: 'text-blue-500',
  matter: 'text-green-500',
  substance: 'text-purple-500',
}

interface TokenFluctuation {
  timestamp: Date
  tokens: ElementalTokens
  equilibrium: TokenEquilibrium
  planetaryContext: {
    currentHour: string
    dominantPlanet: string
    activeAspects: string[]
  }
  stability: 'stable' | 'warning' | 'critical'
}

interface StabilizationMetrics {
  averageStability: number
  fluctuationFrequency: number
  equilibriumVariance: number
  overallHealthScore: number
  lastStabilization: Date | null
  stabilizationEvents: number
}

export function TokenStabilizationMonitor() {
  const { alchmQuantities, planetaryPositions, loading, error, refresh } = usePlanetaryPositions({
    refreshInterval: 5000, // More frequent updates for real-time monitoring
  })

  const [fluctuationHistory, setFluctuationHistory] = useState<TokenFluctuation[]>([])
  const [stabilizationMetrics, setStabilizationMetrics] = useState<StabilizationMetrics>({
    averageStability: 0,
    fluctuationFrequency: 0,
    equilibriumVariance: 0,
    overallHealthScore: 0,
    lastStabilization: null,
    stabilizationEvents: 0,
  })

  const [isMonitoring, setIsMonitoring] = useState(true)
  const [captureScreenshots, setCaptureScreenshots] = useState(false)
  const [performanceMetrics, setPerformanceMetrics] = useState({
    calculationTime: 0,
    domUpdateTime: 0,
    memoryUsage: 0,
  })

  // Memoize current tokens to prevent unnecessary recalculations
  const currentTokens = useMemo(
    (): ElementalTokens => ({
      spirit: alchmQuantities.spirit,
      essence: alchmQuantities.essence,
      matter: alchmQuantities.matter,
      substance: alchmQuantities.substance,
    }),
    [
      alchmQuantities.spirit,
      alchmQuantities.essence,
      alchmQuantities.matter,
      alchmQuantities.substance,
    ]
  )

  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastTokensRef = useRef<ElementalTokens | null>(null)
  const lastCalculationTimeRef = useRef<number>(0)
  const screenshotCountRef = useRef(0)

  // API calling functions for backend computations
  const validateTokenEquilibriumAPI = useCallback(
    async (tokens: ElementalTokens): Promise<TokenEquilibrium> => {
      try {
        const response = await fetch('/api/alchemy/token-equilibrium', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tokens }),
        })

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`)
        }

        const data = await response.json()
        return data.data
      } catch (error) {
        console.error('Token equilibrium validation failed:', error)
        // Fallback to local calculation if API fails
        return {
          goldenRatio: 0,
          elementalHarmony: 0,
          planetaryDignity: 0,
          overallHealth: 0.5,
        }
      }
    },
    []
  )

  const calculateStabilizationAPI = useCallback(async (tokens: ElementalTokens) => {
    try {
      const response = await fetch('/api/alchemy/token-stabilization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokens }),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      return data.data.adjustments
    } catch (error) {
      console.error('Token stabilization calculation failed:', error)
      return {}
    }
  }, [])

  const [currentEquilibrium, setCurrentEquilibrium] = useState<TokenEquilibrium>({
    goldenRatio: 0,
    elementalHarmony: 0,
    planetaryDignity: 0,
    overallHealth: 0,
  })

  useEffect(() => {
    validateTokenEquilibriumAPI(currentTokens).then(result => {
      if (result && Object.keys(result).length > 0) setCurrentEquilibrium(result)
    })
  }, [currentTokens, validateTokenEquilibriumAPI])

  // Determine stability status based on hermetic principles
  const getStabilityStatus = (equilibrium: TokenEquilibrium): 'stable' | 'warning' | 'critical' => {
    const elementalImbalance = equilibrium.elementalHarmony
    const goldenRatioDeviation = equilibrium.goldenRatio

    if (elementalImbalance > 1.0 || goldenRatioDeviation > 0.5) return 'critical'
    if (elementalImbalance > 0.5 || goldenRatioDeviation > 0.3) return 'warning'
    return 'stable'
  }

  const stabilityStatus = getStabilityStatus(currentEquilibrium)

  // Monitor token fluctuations and log significant changes
  const monitorTokenFluctuations = useCallback(async () => {
    if (!isMonitoring || loading) return

    const startTime = performance.now()

    // Performance optimization: skip calculations if less than 100ms since last calculation
    const timeSinceLastCalc = startTime - lastCalculationTimeRef.current
    if (timeSinceLastCalc < 100) return
    lastCalculationTimeRef.current = startTime

    // Check for significant token changes
    if (lastTokensRef.current) {
      const changes = Object.entries(currentTokens).reduce(
        (acc, [key, value]) => {
          const previousValue = lastTokensRef.current![key as keyof ElementalTokens]
          const change = Math.abs(value - previousValue)
          const percentChange = previousValue > 0 ? (change / previousValue) * 100 : 0

          if (percentChange > 5) {
            // Log changes > 5%
            acc[key] = { change, percentChange }
          }

          return acc
        },
        {} as Record<string, { change: number; percentChange: number }>
      )

      if (Object.keys(changes).length > 0) {
        logger.info('Token fluctuation detected', {
          operation: 'token_monitoring',
          metadata: {
            changes,
            planetaryContext: {
              dominantPlanet: planetaryPositions[0]?.planet || 'Unknown',
              currentTokens,
            },
          },
        })

        // Capture screenshot during significant transitions if enabled
        if (captureScreenshots) {
          captureScreenshot(`token-transition-${Date.now()}`)
        }
      }
    }

    // Update fluctuation history
    const fluctuation: TokenFluctuation = {
      timestamp: new Date(),
      tokens: { ...currentTokens },
      equilibrium: currentEquilibrium,
      planetaryContext: {
        currentHour: 'Unknown', // Would need planetary hour calculation
        dominantPlanet: planetaryPositions[0]?.planet || 'Unknown',
        activeAspects: [], // Would need aspect calculation
      },
      stability: stabilityStatus,
    }

    setFluctuationHistory(prev => {
      const newHistory = [...prev, fluctuation].slice(-50) // Keep last 50 entries
      return newHistory
    })

    // Update stabilization metrics
    setStabilizationMetrics(prev => {
      const stabilityScores = fluctuationHistory.map(f => f.equilibrium.elementalHarmony)
      const averageStability =
        stabilityScores.length > 0
          ? stabilityScores.reduce((a, b) => a + b, 0) / stabilityScores.length
          : 0

      return {
        ...prev,
        averageStability,
        fluctuationFrequency:
          fluctuationHistory.length /
          Math.max(
            1,
            (Date.now() - (fluctuationHistory[0]?.timestamp.getTime() || Date.now())) / 60000
          ), // per minute
        equilibriumVariance: Math.sqrt(
          stabilityScores.reduce((sum, score) => sum + Math.pow(score - averageStability, 2), 0) /
            Math.max(1, stabilityScores.length)
        ),
        overallHealthScore: currentEquilibrium.overallHealth,
      }
    })

    lastTokensRef.current = { ...currentTokens }

    // Update performance metrics
    const calculationTime = performance.now() - startTime
    setPerformanceMetrics(prev => ({
      ...prev,
      calculationTime,
      domUpdateTime: performance.now() - startTime, // Simplified
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
    }))

    // Log performance if calculation is slow
    if (calculationTime > defaultAlchemicalMCPConfig.performanceThresholds.maxCalculationTime) {
      logger.warn('Token calculation performance degradation', {
        operation: 'performance_monitoring',
        metadata: {
          calculationTime,
          threshold: defaultAlchemicalMCPConfig.performanceThresholds.maxCalculationTime,
          currentTokens,
        },
      })
    }
  }, [
    isMonitoring,
    loading,
    currentTokens,
    currentEquilibrium,
    stabilityStatus,
    planetaryPositions,
    fluctuationHistory,
    captureScreenshots,
  ])

  // Capture screenshot function (simplified for demo)
  const captureScreenshot = useCallback(
    async (filename: string) => {
      try {
        // In a real implementation, this would use Chrome DevTools Protocol
        // For now, we'll simulate screenshot capture
        screenshotCountRef.current++

        logger.info('Screenshot captured during token transition', {
          operation: 'screenshot_capture',
          metadata: {
            filename,
            screenshotCount: screenshotCountRef.current,
            planetaryContext: {
              dominantPlanet: planetaryPositions[0]?.planet,
              tokenState: currentTokens,
            },
          },
        })
      } catch (error) {
        console.error('Failed to capture screenshot:', error)
      }
    },
    [planetaryPositions, currentTokens]
  )

  // Stabilization function for imbalanced tokens
  const stabilizeTokens = useCallback(async () => {
    if (!isTokenStable(currentTokens, defaultAlchemicalMCPConfig)) {
      const adjustment = await calculateStabilizationAPI(currentTokens)

      logger.info('Token stabilization applied', {
        operation: 'token_stabilization',
        metadata: {
          originalTokens: currentTokens,
          adjustment,
          equilibrium: currentEquilibrium,
        },
      })

      setStabilizationMetrics(prev => ({
        ...prev,
        lastStabilization: new Date(),
        stabilizationEvents: prev.stabilizationEvents + 1,
      }))

      // In a real implementation, this would trigger a recalculation
      // For now, we just log the stabilization event
    }
  }, [currentTokens, currentEquilibrium])

  // Set up monitoring interval
  useEffect(() => {
    if (isMonitoring) {
      monitoringIntervalRef.current = setInterval(monitorTokenFluctuations, 2000) // Monitor every 2 seconds
    } else {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current)
      }
    }

    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current)
      }
    }
  }, [monitorTokenFluctuations, isMonitoring])

  // Monitor for critical imbalances and auto-stabilize
  useEffect(() => {
    if (stabilityStatus === 'critical') {
      stabilizeTokens()
    }
  }, [stabilityStatus, stabilizeTokens])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'stable':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getElementIcon = (element: keyof ElementalTokens) => {
    const IconComponent = elementIcons[element]
    return <IconComponent className={`h-4 w-4 ${elementColors[element]}`} />
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Token Stabilization Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Initializing alchemical monitoring...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Token Stabilization Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-500" />
            <p>Alchemical monitoring error: {error}</p>
            <Button onClick={refresh} className="mt-4" variant="outline">
              Retry Connection
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Token Stabilization Monitor
            <Badge
              variant="secondary"
              className={`flex items-center gap-1 ${
                stabilityStatus === 'stable'
                  ? 'bg-green-100 text-green-800'
                  : stabilityStatus === 'warning'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
              }`}
            >
              {getStatusIcon(stabilityStatus)}
              {stabilityStatus.toUpperCase()}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={isMonitoring ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsMonitoring(!isMonitoring)}
            >
              <Eye className="h-4 w-4 mr-1" />
              {isMonitoring ? 'Monitoring' : 'Paused'}
            </Button>
            <Button
              variant={captureScreenshots ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCaptureScreenshots(!captureScreenshots)}
            >
              <Camera className="h-4 w-4 mr-1" />
              Screenshots
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={stabilizeTokens}
              disabled={stabilityStatus === 'stable'}
            >
              <Target className="h-4 w-4 mr-1" />
              Stabilize
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="elements">Elements</TabsTrigger>
            <TabsTrigger value="equilibrium">Equilibrium</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Elemental Health</p>
                      <p className="text-2xl font-bold">
                        {currentEquilibrium.overallHealth.toFixed(3)}
                      </p>
                    </div>
                    <Zap className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={Math.min(100, currentEquilibrium.overallHealth * 100)}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Overall elemental vitality</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Calculation Performance
                      </p>
                      <p className="text-2xl font-bold">
                        {performanceMetrics.calculationTime.toFixed(1)}ms
                      </p>
                    </div>
                    <TrendingUp
                      className={`h-8 w-8 ${
                        performanceMetrics.calculationTime >
                        defaultAlchemicalMCPConfig.performanceThresholds.maxCalculationTime
                          ? 'text-red-500'
                          : 'text-green-500'
                      }`}
                    />
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={Math.min(
                        100,
                        (performanceMetrics.calculationTime /
                          defaultAlchemicalMCPConfig.performanceThresholds.maxCalculationTime) *
                          100
                      )}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Target: &lt;
                      {defaultAlchemicalMCPConfig.performanceThresholds.maxCalculationTime}ms
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Stabilization Events
                      </p>
                      <p className="text-2xl font-bold">
                        {stabilizationMetrics.stabilizationEvents}
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground">
                      Last:{' '}
                      {stabilizationMetrics.lastStabilization?.toLocaleTimeString() || 'Never'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="elements" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(currentTokens).map(([element, value]) => {
                const config =
                  defaultAlchemicalMCPConfig.tokenStabilization[element as keyof ElementalTokens]
                const percentage = ((value - config.min) / (config.max - config.min)) * 100

                return (
                  <Card key={element}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getElementIcon(element as keyof ElementalTokens)}
                          <span className="capitalize font-medium">{element}</span>
                        </div>
                        <span className="text-lg font-bold">{value.toFixed(2)}</span>
                      </div>
                      <div className="mt-2">
                        <Progress value={Math.max(0, Math.min(100, percentage))} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          Range: {config.min}-{config.max}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="equilibrium" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Traditional Elemental Derivations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Spirit: Divine masculine (Sun, Mercury, Jupiter, Saturn)
                    </div>
                    <div className="flex justify-between">
                      <span>Current Spirit:</span>
                      <span className="font-mono">{currentTokens.spirit.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Essence: Divine feminine (Moon, Venus, Mars, Uranus, Neptune, Pluto)
                    </div>
                    <div className="flex justify-between">
                      <span>Current Essence:</span>
                      <span className="font-mono">{currentTokens.essence.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Matter: Physical manifestation (Moon, Venus, Mars, Saturn, Uranus, Pluto)
                    </div>
                    <div className="flex justify-between">
                      <span>Current Matter:</span>
                      <span className="font-mono">{currentTokens.matter.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Substance: Material foundation (Mercury, Neptune)
                    </div>
                    <div className="flex justify-between">
                      <span>Current Substance:</span>
                      <span className="font-mono">{currentTokens.substance.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Elemental Health Assessment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Spirit Vitality:</span>
                      <span
                        className={`font-mono ${currentTokens.spirit >= 0.5 ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {currentTokens.spirit >= 0.5 ? 'Healthy' : 'Deficient'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Solar, Mercurial, Jovian, Saturnine influences
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Essence Flow:</span>
                      <span
                        className={`font-mono ${currentTokens.essence >= 0.8 ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {currentTokens.essence >= 0.8 ? 'Healthy' : 'Deficient'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Lunar, Venusian, Martial, Uranian, Neptunian, Plutonian influences
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Material Grounding:</span>
                      <span
                        className={`font-mono ${currentTokens.matter >= 0.8 ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {currentTokens.matter >= 0.8 ? 'Healthy' : 'Deficient'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Physical planetary influences and concrete manifestation
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Substance Stability:</span>
                      <span
                        className={`font-mono ${currentTokens.substance >= 0.3 ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {currentTokens.substance >= 0.3 ? 'Healthy' : 'Deficient'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Mercurial planning and Neptunian dream foundations
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Fluctuations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {fluctuationHistory
                    .slice(-10)
                    .reverse()
                    .map((fluctuation, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-muted rounded"
                      >
                        <div className="flex items-center gap-2">
                          {getStatusIcon(fluctuation.stability)}
                          <span className="text-sm font-mono">
                            {fluctuation.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Health: {fluctuation.equilibrium.overallHealth.toFixed(3)}
                        </div>
                      </div>
                    ))}
                  {fluctuationHistory.length === 0 && (
                    <div className="text-center text-muted-foreground py-4">
                      No fluctuation data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
