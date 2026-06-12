'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Flame,
  Droplets,
  Mountain,
  Wind,
  Thermometer,
  Activity,
  Zap,
  Target,
  Brain,
  Heart,
  Eye,
  Crown,
} from 'lucide-react'
import type {
  AlchemicalQuantities,
  ConsciousnessStats,
  AlchemicalConsciousnessTask,
  ConsciousParameters,
} from '@/lib/astrological-dignities-engine'

interface AlchemicalConsciousnessDashboardProps {
  consciousnessStats: ConsciousnessStats
  consciousParameters: ConsciousParameters // Add this
  onTaskSelect?: (task: AlchemicalConsciousnessTask) => void
  realTimeUpdates?: boolean
}

export function AlchemicalConsciousnessDashboard({
  consciousnessStats,
  onTaskSelect,
  realTimeUpdates = false,
}: AlchemicalConsciousnessDashboardProps) {
  const [currentStats, setCurrentStats] = useState(consciousnessStats)
  const [animationFrame, setAnimationFrame] = useState(0)

  // Simulate real-time updates for demonstration
  useEffect(() => {
    if (realTimeUpdates) {
      const interval = setInterval(() => {
        setAnimationFrame(prev => prev + 1)
        // Subtle fluctuations to simulate real-time consciousness changes
        setCurrentStats(prev => ({
          ...prev,
          current_alchemical_state: {
            ...prev.current_alchemical_state,
            consciousness_temperature: Math.max(
              0,
              Math.min(
                100,
                prev.current_alchemical_state.consciousness_temperature + (Math.random() - 0.5) * 3
              )
            ),
            entropy_level: Math.max(
              0,
              Math.min(100, prev.current_alchemical_state.entropy_level + (Math.random() - 0.5) * 2)
            ),
          },
        }))
      }, 2000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [realTimeUpdates])

  const state = currentStats.current_alchemical_state

  const getElementIcon = (element: string) => {
    switch (element) {
      case 'fire':
        return <Flame className="h-5 w-5 text-red-500" />
      case 'water':
        return <Droplets className="h-5 w-5 text-blue-500" />
      case 'air':
        return <Wind className="h-5 w-5 text-gray-500" />
      case 'earth':
        return <Mountain className="h-5 w-5 text-green-500" />
      default:
        return <Activity className="h-5 w-5" />
    }
  }

  const getThermodynamicColor = (state: string) => {
    switch (state) {
      case 'heating':
        return 'text-red-500 bg-red-50'
      case 'cooling':
        return 'text-blue-500 bg-blue-50'
      case 'expanding':
        return 'text-purple-500 bg-purple-50'
      case 'contracting':
        return 'text-gray-500 bg-gray-50'
      case 'transforming':
        return 'text-yellow-500 bg-yellow-50'
      default:
        return 'text-green-500 bg-green-50'
    }
  }

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'awakening':
        return 'bg-gradient-to-r from-yellow-400 to-orange-500'
      case 'expanding':
        return 'bg-gradient-to-r from-blue-400 to-purple-500'
      case 'integrating':
        return 'bg-gradient-to-r from-green-400 to-blue-500'
      case 'stabilizing':
        return 'bg-gradient-to-r from-gray-400 to-gray-600'
      case 'transforming':
        return 'bg-gradient-to-r from-purple-400 to-pink-500'
      case 'transcending':
        return 'bg-gradient-to-r from-indigo-400 to-purple-600'
      default:
        return 'bg-gradient-to-r from-gray-400 to-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">A-Number</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.a_number.toFixed(3)}</div>
            <Badge className={getPhaseColor(currentStats.consciousness_phase)}>
              {currentStats.consciousness_phase}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              Consciousness Temp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.consciousness_temperature}°</div>
            <Badge className={getThermodynamicColor(state.thermodynamic_state)}>
              {state.thermodynamic_state}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Entropy Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.entropy_level}%</div>
            <Progress value={state.entropy_level} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alchemical" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="alchemical">Alchemical</TabsTrigger>
          <TabsTrigger value="elemental">Elemental</TabsTrigger>
          <TabsTrigger value="coefficients">Coefficients</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="pillars">Pillars</TabsTrigger>
        </TabsList>

        {/* Alchemical Quantities */}
        <TabsContent value="alchemical" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-red-200 bg-gradient-to-br from-red-50 to-orange-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Flame className="h-4 w-4 text-red-500" />
                  Spirit
                </CardTitle>
                <CardDescription>Divine Spark & Inspiration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {(state.spirit * 100).toFixed(1)}%
                </div>
                <Progress value={state.spirit * 100} className="mt-2" />
                <div className="text-xs text-muted-foreground mt-1">
                  Fire element • Passion • Creativity
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  Essence
                </CardTitle>
                <CardDescription>Emotional Truth & Soul Flow</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {(state.essence * 100).toFixed(1)}%
                </div>
                <Progress value={state.essence * 100} className="mt-2" />
                <div className="text-xs text-muted-foreground mt-1">
                  Water element • Feeling • Intuition
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Mountain className="h-4 w-4 text-green-500" />
                  Matter
                </CardTitle>
                <CardDescription>Physical Manifestation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {(state.matter * 100).toFixed(1)}%
                </div>
                <Progress value={state.matter * 100} className="mt-2" />
                <div className="text-xs text-muted-foreground mt-1">
                  Earth element • Form • Manifestation
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wind className="h-4 w-4 text-gray-500" />
                  Substance
                </CardTitle>
                <CardDescription>Mental Structure & Communication</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-600">
                  {(state.substance * 100).toFixed(1)}%
                </div>
                <Progress value={state.substance * 100} className="mt-2" />
                <div className="text-xs text-muted-foreground mt-1">
                  Air element • Thought • Communication
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Elemental Balance */}
        <TabsContent value="elemental" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getElementIcon(currentStats.dominant_element)}
                Elemental Consciousness Balance
              </CardTitle>
              <CardDescription>
                Dominant Element:{' '}
                {currentStats.dominant_element.charAt(0).toUpperCase() +
                  currentStats.dominant_element.slice(1)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(currentStats.elemental_balance).map(([element, value]) => (
                <div key={element} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getElementIcon(element)}
                      <span className="font-medium capitalize">{element}</span>
                    </div>
                    <span className="text-sm font-bold">{value}%</span>
                  </div>
                  <Progress value={value} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consciousness Coefficients */}
        <TabsContent value="coefficients" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Learning Velocity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentStats.learning_velocity_multiplier.toFixed(2)}x
                </div>
                <div className="text-xs text-muted-foreground">Mercury & Jupiter influence</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Creative Flow
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentStats.creative_flow_coefficient.toFixed(2)}x
                </div>
                <div className="text-xs text-muted-foreground">Venus influence</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Manifestation Power
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentStats.manifestation_power_index.toFixed(2)}x
                </div>
                <div className="text-xs text-muted-foreground">Mars & Saturn influence</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Intuitive Receptivity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentStats.intuitive_receptivity_quotient.toFixed(2)}x
                </div>
                <div className="text-xs text-muted-foreground">Moon influence</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alchemical Tasks */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Alchemical Consciousness Tasks
              </CardTitle>
              <CardDescription>
                Personalized tasks based on your current alchemical state
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Crown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Connect your birth chart to unlock personalized alchemical tasks</p>
                <Button className="mt-4" variant="outline">
                  Generate Tasks
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alchemical Consciousness Pillars */}
        <TabsContent value="pillars" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alchemical Consciousness Pillars</CardTitle>
              <CardDescription>Trainable abilities based on alchemical processes</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries((consciousnessStats as any).alchemical_pillars).map(([key, val]) => {
                const value = val as number
                const level =
                  value < 30
                    ? 'Novice'
                    : value < 60
                      ? 'Adept'
                      : value < 90
                        ? 'Master'
                        : 'Transcendent'
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                      <Badge variant="outline">{level}</Badge>
                    </div>
                    <Progress value={value} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      Score: {value.toFixed(0)}% - Train to improve!
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Real-time indicator */}
      {realTimeUpdates && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Live consciousness monitoring active
        </div>
      )}
    </div>
  )
}
