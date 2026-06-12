'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { logger, LogLevel } from '@/lib/structured-logger'
import { defaultAlchemicalMCPConfig } from '@/test/alchemical-devtools/mcp-config'
import { Progress } from '@/components/ui/progress'
import {
  Activity,
  Flame,
  Droplets,
  Mountain,
  Wind,
  Zap,
  Eye,
  EyeOff,
  RotateCcw,
  Play,
  Pause,
  Settings,
} from 'lucide-react'
import { usePlanetaryPositions } from '@/hooks/usePlanetaryPositions'

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

// Element colors for consistent theming
const elementColors = {
  spirit: { primary: '#f59e0b', secondary: '#fbbf24', glow: '#d97706' }, // Amber
  essence: { primary: '#3b82f6', secondary: '#60a5fa', glow: '#1d4ed8' }, // Blue
  matter: { primary: '#10b981', secondary: '#34d399', glow: '#059669' }, // Emerald
  substance: { primary: '#8b5cf6', secondary: '#a78bfa', glow: '#7c3aed' }, // Purple
}

const elementIcons = {
  spirit: Flame,
  essence: Droplets,
  matter: Mountain,
  substance: Wind,
}

interface FlowParticle {
  id: string
  element: keyof ElementalTokens
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  intensity: number
}

interface TokenFlowVisualizationProps {
  width?: number
  height?: number
  showParticles?: boolean
  showEquilibrium?: boolean
  animationSpeed?: number
  className?: string
}

export function TokenFlowVisualization({
  width = 600,
  height = 400,
  showParticles = true,
  showEquilibrium = true,
  animationSpeed = 1,
  className = '',
}: TokenFlowVisualizationProps) {
  const { alchmQuantities, planetaryPositions, mcpMetrics } = usePlanetaryPositions({
    refreshInterval: 2000, // More frequent updates for smooth animation
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const particlesRef = useRef<FlowParticle[]>([])
  const lastTokensRef = useRef<ElementalTokens | null>(null)

  const [isAnimating, setIsAnimating] = useState(true)
  const [showDebug, setShowDebug] = useState(false)
  const [frameCount, setFrameCount] = useState(0)

  // Current token values
  const currentTokens: ElementalTokens = {
    spirit: alchmQuantities.spirit,
    essence: alchmQuantities.essence,
    matter: alchmQuantities.matter,
    substance: alchmQuantities.substance,
  }

  // State for equilibrium data from backend
  const [equilibrium, setEquilibrium] = useState<TokenEquilibrium>({
    goldenRatio: 0,
    elementalHarmony: 0,
    planetaryDignity: 0,
    overallHealth: 0.5,
  })

  // Fetch equilibrium data from backend
  useEffect(() => {
    const fetchEquilibrium = async () => {
      try {
        const response = await fetch('/api/alchemy/token-equilibrium', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tokens: currentTokens }),
        })

        if (response.ok) {
          const data = await response.json()
          setEquilibrium(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch equilibrium data:', error)
      }
    }

    fetchEquilibrium()
  }, [currentTokens.spirit, currentTokens.essence, currentTokens.matter, currentTokens.substance])

  // Element positions in circular layout (representing hermetic circle)
  const elementPositions = useMemo(() => {
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) * 0.35

    return {
      spirit: {
        x: centerX + radius * Math.cos(-Math.PI / 2), // Top
        y: centerY + radius * Math.sin(-Math.PI / 2),
        angle: -Math.PI / 2,
      },
      essence: {
        x: centerX + radius * Math.cos(Math.PI), // Left
        y: centerY + radius * Math.sin(Math.PI),
        angle: Math.PI,
      },
      matter: {
        x: centerX + radius * Math.cos(0), // Right
        y: centerY + radius * Math.sin(0),
        angle: 0,
      },
      substance: {
        x: centerX + radius * Math.cos(Math.PI / 2), // Bottom
        y: centerY + radius * Math.sin(Math.PI / 2),
        angle: Math.PI / 2,
      },
    }
  }, [width, height])

  // Generate flow particles based on token changes
  const generateParticles = () => {
    if (!lastTokensRef.current || !showParticles) return

    const newParticles: FlowParticle[] = []

    Object.entries(currentTokens).forEach(([element, value]) => {
      const prevValue = lastTokensRef.current![element as keyof ElementalTokens]
      const change = value - prevValue

      if (Math.abs(change) > 0.01) {
        // Only generate particles for significant changes
        const particleCount = Math.min(Math.abs(change) * 10, 5) // Max 5 particles per change

        for (let i = 0; i < particleCount; i++) {
          const position = elementPositions[element as keyof ElementalTokens]
          const angle = position.angle + (Math.random() - 0.5) * 0.5 // Add some randomness

          newParticles.push({
            id: `${element}-${Date.now()}-${i}`,
            element: element as keyof ElementalTokens,
            x: position.x,
            y: position.y,
            vx: Math.cos(angle) * (change > 0 ? 1 : -1) * 0.5 * animationSpeed,
            vy: Math.sin(angle) * (change > 0 ? 1 : -1) * 0.5 * animationSpeed,
            life: 0,
            maxLife: 120, // 2 seconds at 60fps
            size: Math.abs(change) * 2 + 1,
            intensity: Math.abs(change) * 0.5,
          })
        }
      }
    })

    particlesRef.current.push(...newParticles)
    lastTokensRef.current = { ...currentTokens }
  }

  // Update particles
  const updateParticles = () => {
    particlesRef.current = particlesRef.current
      .map(particle => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        life: particle.life + 1,
        vx: particle.vx * 0.99, // Slow down over time
        vy: particle.vy * 0.99,
      }))
      .filter(particle => particle.life < particle.maxLife)
  }

  // Draw the visualization
  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas with dark background
    ctx.fillStyle = '#0f172a' // Slate-900
    ctx.fillRect(0, 0, width, height)

    // Draw hermetic equilibrium circle
    if (showEquilibrium) {
      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(width, height) * 0.35

      // Outer equilibrium ring
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 - equilibrium.overallHealth * 0.5})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
      ctx.stroke()

      // Inner balance indicator
      const balanceRadius = radius * 0.8
      ctx.strokeStyle = `rgba(59, 130, 246, ${equilibrium.overallHealth})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(centerX, centerY, balanceRadius, 0, 2 * Math.PI)
      ctx.stroke()

      // Golden ratio indicator
      const goldenRadius = radius * 0.6
      ctx.strokeStyle = `rgba(245, 158, 11, ${1 - equilibrium.goldenRatio})`
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.arc(centerX, centerY, goldenRadius, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Draw element nodes
    Object.entries(elementPositions).forEach(([element, position]) => {
      const tokenValue = currentTokens[element as keyof ElementalTokens]
      const config = defaultAlchemicalMCPConfig.tokenStabilization[element as keyof ElementalTokens]
      const intensity = Math.min(tokenValue / config.max, 1)

      // Element node
      const gradient = ctx.createRadialGradient(
        position.x,
        position.y,
        0,
        position.x,
        position.y,
        25
      )
      const colors = elementColors[element as keyof ElementalTokens]
      gradient.addColorStop(0, colors.primary)
      gradient.addColorStop(1, colors.secondary)

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(position.x, position.y, 15 + intensity * 10, 0, 2 * Math.PI)
      ctx.fill()

      // Element glow effect
      ctx.shadowColor = colors.glow
      ctx.shadowBlur = 10 + intensity * 20
      ctx.beginPath()
      ctx.arc(position.x, position.y, 20 + intensity * 15, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.shadowBlur = 0

      // Element label
      ctx.fillStyle = 'white'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(element.charAt(0).toUpperCase() + element.slice(1), position.x, position.y + 35)

      // Token value
      ctx.font = '10px monospace'
      ctx.fillText(tokenValue.toFixed(1), position.x, position.y + 48)
    })

    // Draw flow particles
    if (showParticles) {
      particlesRef.current.forEach(particle => {
        const lifeRatio = 1 - particle.life / particle.maxLife
        const colors = elementColors[particle.element]

        ctx.fillStyle = `${colors.primary}${Math.floor(lifeRatio * 255)
          .toString(16)
          .padStart(2, '0')}`
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size * lifeRatio, 0, 2 * Math.PI)
        ctx.fill()

        // Particle trail effect
        if (lifeRatio > 0.5) {
          ctx.strokeStyle = `${colors.secondary}${Math.floor(lifeRatio * 128)
            .toString(16)
            .padStart(2, '0')}`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.size * lifeRatio * 1.5, 0, 2 * Math.PI)
          ctx.stroke()
        }
      })
    }

    // Draw debug information
    if (showDebug) {
      ctx.fillStyle = 'white'
      ctx.font = '12px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`Frame: ${frameCount}`, 10, 20)
      ctx.fillText(`Particles: ${particlesRef.current.length}`, 10, 35)
      ctx.fillText(`Elemental Health: ${equilibrium.overallHealth.toFixed(3)}`, 10, 50)
      ctx.fillText(`Golden Ratio: ${equilibrium.goldenRatio.toFixed(3)}`, 10, 65)

      if (mcpMetrics) {
        ctx.fillText(`Stability: ${mcpMetrics.tokenStability}`, 10, 80)
        ctx.fillText(
          `Calc Time: ${mcpMetrics.performanceMetrics.calculationTime.toFixed(1)}ms`,
          10,
          95
        )
      }
    }
  }

  // Animation loop
  const animate = () => {
    if (!isAnimating) return

    generateParticles()
    updateParticles()
    draw()
    setFrameCount(prev => prev + 1)

    animationRef.current = requestAnimationFrame(animate)
  }

  // Start/stop animation
  useEffect(() => {
    if (isAnimating) {
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isAnimating, animate])

  // Initial draw
  useEffect(() => {
    draw()
  }, [currentTokens, showEquilibrium, showParticles, showDebug])

  // Initialize last tokens
  useEffect(() => {
    if (!lastTokensRef.current) {
      lastTokensRef.current = { ...currentTokens }
    }
  }, [currentTokens])

  const toggleAnimation = () => setIsAnimating(!isAnimating)
  const resetVisualization = () => {
    particlesRef.current = []
    setFrameCount(0)
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Token Flow Visualization
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleAnimation}>
              {isAnimating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isAnimating ? 'Pause' : 'Play'}
            </Button>
            <Button variant="outline" size="sm" onClick={resetVisualization}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowDebug(!showDebug)}>
              {showDebug ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              Debug
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Canvas */}
          <div className="border rounded-lg overflow-hidden bg-slate-900">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="block"
              style={{ imageRendering: 'crisp-edges' }}
            />
          </div>

          {/* Element Status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(currentTokens).map(([element, value]) => {
              const IconComponent = elementIcons[element as keyof ElementalTokens]
              const config =
                defaultAlchemicalMCPConfig.tokenStabilization[element as keyof ElementalTokens]
              const percentage = Math.min((value / config.max) * 100, 100)
              const isStable = value >= config.min && value <= config.max

              return (
                <Card key={element} className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <IconComponent
                      className={`h-4 w-4 ${elementColors[element as keyof ElementalTokens].primary}`}
                    />
                    <span className="font-medium capitalize text-sm">{element}</span>
                    <Badge variant={isStable ? 'default' : 'destructive'} className="text-xs">
                      {isStable ? 'Stable' : 'Unstable'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{value.toFixed(2)}</span>
                      <span>{config.equilibrium.toFixed(1)}</span>
                    </div>
                    <Progress value={percentage} className="h-1" />
                    <div className="text-xs text-muted-foreground">
                      {config.min.toFixed(1)} - {config.max.toFixed(1)}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Elemental Health Status */}
          {showEquilibrium && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Elemental Health Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Spirit Vitality</div>
                    <div
                      className={`text-lg font-mono ${currentTokens.spirit >= 0.5 ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {currentTokens.spirit >= 0.5 ? 'Healthy' : 'Deficient'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Solar/Mercurial/Jovian/Saturnine
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Essence Flow</div>
                    <div
                      className={`text-lg font-mono ${currentTokens.essence >= 0.8 ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {currentTokens.essence >= 0.8 ? 'Healthy' : 'Deficient'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Lunar/Venusian/Martial/Uranian/Neptunian/Plutonian
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Material Grounding</div>
                    <div
                      className={`text-lg font-mono ${currentTokens.matter >= 0.8 ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {currentTokens.matter >= 0.8 ? 'Healthy' : 'Deficient'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Physical manifestation</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Substance Stability</div>
                    <div
                      className={`text-lg font-mono ${currentTokens.substance >= 0.3 ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {currentTokens.substance >= 0.3 ? 'Healthy' : 'Deficient'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Mercurial/Neptunian foundations
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Performance Metrics */}
          {mcpMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Calculation</div>
                    <div className="font-mono">
                      {mcpMetrics.performanceMetrics.calculationTime.toFixed(1)}ms
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Token Recalc</div>
                    <div className="font-mono">
                      {mcpMetrics.performanceMetrics.tokenRecalculationTime.toFixed(1)}ms
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Memory</div>
                    <div className="font-mono">
                      {(mcpMetrics.performanceMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Stabilizations</div>
                    <div className="font-mono">{mcpMetrics.stabilizationEvents}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
