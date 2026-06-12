'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  Calendar,
  Target,
  Sparkles,
  Settings,
  Play,
  Pause,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Circle,
} from 'lucide-react'
import type { CraftedAgent } from '@/lib/agent-types'

interface DynamicAspect {
  id: string
  planet1: string
  planet2: string
  type: string
  applying: boolean
  separating: boolean
  orbVelocity: number
  daysToExact: number
  daysSinceExact: number
  strength: 'building' | 'peak' | 'waning' | 'fading'
  evolutionaryImpact: number
  currentOrb: number
}

interface AspectEvent {
  id: string
  date: Date
  aspectType: string
  planet1: string
  planet2: string
  eventType: 'applying' | 'exact' | 'separating'
  impact: number
}

interface VisualizerProps {
  selectedAgents: CraftedAgent[]
  timeRange?: number
  showTimeline?: boolean
  showRealTime?: boolean
  compact?: boolean
}

// Mock data generation for demonstration
const generateMockAspects = (agents: CraftedAgent[], currentDate: Date): DynamicAspect[] => {
  const aspects: DynamicAspect[] = []

  // Generate aspects based on agent combinations
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const agent1 = agents[i]
      const agent2 = agents[j]

      // Leonardo + Jung: Creative-Psychological Trine
      if (
        (agent1.id === 'leonardo-da-vinci' && agent2.id === 'carl-jung') ||
        (agent1.id === 'carl-jung' && agent2.id === 'leonardo-da-vinci')
      ) {
        aspects.push({
          id: `${agent1.id}-${agent2.id}-trine`,
          planet1: 'Mercury',
          planet2: 'Moon',
          type: 'trine',
          applying: true,
          separating: false,
          orbVelocity: -0.15,
          daysToExact: 3,
          daysSinceExact: 0,
          strength: 'building',
          evolutionaryImpact: 0.85,
          currentOrb: 4.2,
        })
      }

      // Einstein + Tesla: Scientific Innovation Square
      if (
        (agent1.id === 'albert-einstein' && agent2.id === 'nikola-tesla') ||
        (agent1.id === 'nikola-tesla' && agent2.id === 'albert-einstein')
      ) {
        aspects.push({
          id: `${agent1.id}-${agent2.id}-square`,
          planet1: 'Uranus',
          planet2: 'Saturn',
          type: 'square',
          applying: true,
          separating: false,
          orbVelocity: -0.08,
          daysToExact: 7,
          daysSinceExact: 0,
          strength: 'building',
          evolutionaryImpact: 0.92,
          currentOrb: 6.8,
        })
      }

      // General aspects for other combinations
      if (Math.random() > 0.7) {
        const aspectTypes = ['conjunction', 'sextile', 'square', 'trine', 'opposition']
        const randomType = aspectTypes[Math.floor(Math.random() * aspectTypes.length)]
        const isApplying = Math.random() > 0.5

        aspects.push({
          id: `${agent1.id}-${agent2.id}-${randomType}`,
          planet1: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'][Math.floor(Math.random() * 5)],
          planet2: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'][Math.floor(Math.random() * 4)],
          type: randomType,
          applying: isApplying,
          separating: !isApplying,
          orbVelocity: isApplying ? -Math.random() * 0.3 : Math.random() * 0.3,
          daysToExact: isApplying ? Math.floor(Math.random() * 14) + 1 : 0,
          daysSinceExact: !isApplying ? Math.floor(Math.random() * 7) + 1 : 0,
          strength: ['building', 'peak', 'waning', 'fading'][Math.floor(Math.random() * 4)] as any,
          evolutionaryImpact: 0.3 + Math.random() * 0.6,
          currentOrb: Math.random() * 10,
        })
      }
    }
  }

  return aspects
}

const generateMockEvents = (timeRange: number): AspectEvent[] => {
  const events: AspectEvent[] = []
  const now = new Date()

  for (let i = 0; i < timeRange; i++) {
    if (Math.random() > 0.8) {
      // 20% chance of event each day
      const eventDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000)
      events.push({
        id: `event-${i}`,
        date: eventDate,
        aspectType: ['conjunction', 'trine', 'square', 'sextile'][Math.floor(Math.random() * 4)],
        planet1: ['Sun', 'Moon', 'Mercury', 'Venus'][Math.floor(Math.random() * 4)],
        planet2: ['Mars', 'Jupiter', 'Saturn', 'Uranus'][Math.floor(Math.random() * 4)],
        eventType: ['applying', 'exact', 'separating'][Math.floor(Math.random() * 3)] as any,
        impact: 0.4 + Math.random() * 0.6,
      })
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime())
}

const getAspectSymbol = (type: string): string => {
  const symbols: Record<string, string> = {
    conjunction: '☌',
    opposition: '☍',
    trine: '△',
    square: '□',
    sextile: '⚹',
    quincunx: '⚻',
  }
  return symbols[type] || '?'
}

const getAspectColor = (type: string): string => {
  const colors: Record<string, string> = {
    conjunction: '#8B4513',
    opposition: '#FF0000',
    trine: '#0000FF',
    square: '#FF6600',
    sextile: '#00AA00',
    quincunx: '#800080',
  }
  return colors[type] || '#808080'
}

const getStrengthColor = (strength: string): string => {
  const colors: Record<string, string> = {
    building: '#22C55E',
    peak: '#EF4444',
    waning: '#F59E0B',
    fading: '#6B7280',
  }
  return colors[strength] || '#6B7280'
}

export function DynamicAspectsVisualizer({
  selectedAgents,
  timeRange = 30,
  showTimeline = true,
  showRealTime = true,
  compact = false,
}: VisualizerProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState([1])
  const [selectedTimeRange, setSelectedTimeRange] = useState([timeRange])
  const [showApplying, setShowApplying] = useState(true)
  const [showSeparating, setShowSeparating] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  // Generate mock data
  const aspects = useMemo(
    () => generateMockAspects(selectedAgents, currentTime),
    [selectedAgents, currentTime]
  )

  const events = useMemo(() => generateMockEvents(selectedTimeRange[0]), [selectedTimeRange])

  // Filter aspects based on settings
  const filteredAspects = useMemo(() => {
    return aspects.filter(aspect => {
      if (!showApplying && aspect.applying) return false
      if (!showSeparating && aspect.separating) return false
      return true
    })
  }, [aspects, showApplying, showSeparating])

  // Real-time playback simulation
  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      setCurrentTime(prev => new Date(prev.getTime() + 60 * 60 * 1000 * playbackSpeed[0])) // Hours
    }, 1000)

    return () => clearInterval(interval)
  }, [isPlaying, playbackSpeed])

  // Reset to current time
  const resetTime = () => {
    setCurrentTime(new Date())
    setIsPlaying(false)
  }

  if (selectedAgents.length === 0) {
    return (
      <Card className={compact ? 'p-2' : ''}>
        <CardHeader className={compact ? 'p-2 pb-1' : ''}>
          <CardTitle className={compact ? 'text-sm' : 'text-base'}>
            Dynamic Aspects Visualizer
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'p-2 pt-1' : ''}>
          <p className="text-sm text-muted-foreground">
            Select agents to visualize dynamic aspects
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={compact ? 'p-2' : ''}>
      <CardHeader className={compact ? 'p-2 pb-1' : ''}>
        <CardTitle
          className={`${compact ? 'text-sm' : 'text-base'} flex items-center justify-between`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Dynamic Aspects Visualizer
            <Badge variant="secondary" className="text-xs">
              {filteredAspects.length} aspects
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {showRealTime && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="text-xs"
                >
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
                <Button size="sm" variant="outline" onClick={resetTime} className="text-xs">
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSettings(!showSettings)}
              className="text-xs"
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className={compact ? 'p-2 pt-1' : ''}>
        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-4 p-3 bg-muted rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Time Range (days)</label>
              <span className="text-sm text-muted-foreground">{selectedTimeRange[0]}</span>
            </div>
            <Slider
              value={selectedTimeRange}
              onValueChange={setSelectedTimeRange}
              max={90}
              min={7}
              step={1}
              className="w-full"
            />

            {showRealTime && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Playback Speed</label>
                  <span className="text-sm text-muted-foreground">{playbackSpeed[0]}x</span>
                </div>
                <Slider
                  value={playbackSpeed}
                  onValueChange={setPlaybackSpeed}
                  max={24}
                  min={0.5}
                  step={0.5}
                  className="w-full"
                />
              </>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <Switch id="applying" checked={showApplying} onCheckedChange={setShowApplying} />
                <label htmlFor="applying" className="text-sm">
                  Show Applying
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="separating"
                  checked={showSeparating}
                  onCheckedChange={setShowSeparating}
                />
                <label htmlFor="separating" className="text-sm">
                  Show Separating
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Current Time Display */}
        {showRealTime && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            <span>Current Time: {currentTime.toLocaleString()}</span>
            {isPlaying && (
              <Badge variant="secondary" className="text-xs animate-pulse">
                <Play className="h-2 w-2 mr-1" />
                Live
              </Badge>
            )}
          </div>
        )}

        {/* Current Aspects Grid */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <Target className="h-3 w-3" />
              Current Aspects
            </h3>
            <div className="grid gap-2">
              {filteredAspects.map(aspect => (
                <div
                  key={aspect.id}
                  className="flex items-center justify-between p-2 border rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center justify-center w-6 h-6 rounded text-white text-xs"
                      style={{ backgroundColor: getAspectColor(aspect.type) }}
                    >
                      {getAspectSymbol(aspect.type)}
                    </div>
                    <span className="text-sm font-medium">
                      {aspect.planet1} - {aspect.planet2}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{ borderColor: getStrengthColor(aspect.strength) }}
                    >
                      {aspect.strength}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground text-right">
                      <div className="flex items-center gap-1">
                        {aspect.applying ? (
                          <>
                            <ArrowUp className="h-2 w-2 text-green-600" />
                            <span className="text-green-600">{aspect.daysToExact}d to exact</span>
                          </>
                        ) : (
                          <>
                            <ArrowDown className="h-2 w-2 text-orange-600" />
                            <span className="text-orange-600">
                              {aspect.daysSinceExact}d since exact
                            </span>
                          </>
                        )}
                      </div>
                      <div>Orb: {aspect.currentOrb.toFixed(1)}°</div>
                    </div>
                    <div className="flex items-center">
                      <div
                        className="w-2 h-8 rounded"
                        style={{
                          backgroundColor: `hsl(${aspect.evolutionaryImpact * 120}, 70%, 60%)`,
                          opacity: aspect.evolutionaryImpact,
                        }}
                        title={`Impact: ${(aspect.evolutionaryImpact * 100).toFixed(0)}%`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline View */}
          {showTimeline && events.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Upcoming Events ({events.length})
              </h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {events.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-2 border rounded text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Circle
                        className="h-2 w-2"
                        style={{ color: getAspectColor(event.aspectType) }}
                        fill="currentColor"
                      />
                      <span>
                        {event.planet1}-{event.planet2}
                      </span>
                      <span className="text-muted-foreground">{event.aspectType}</span>
                    </div>
                    <div className="text-right">
                      <div>{event.date.toLocaleDateString()}</div>
                      <div className="text-muted-foreground">
                        {event.eventType} • {(event.impact * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Statistics */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Statistics</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span>Applying:</span>
                <span className="text-green-600 font-medium">
                  {aspects.filter(a => a.applying).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Separating:</span>
                <span className="text-orange-600 font-medium">
                  {aspects.filter(a => a.separating).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Avg Impact:</span>
                <span className="font-medium">
                  {aspects.length > 0
                    ? `${(
                        (aspects.reduce((sum, a) => sum + a.evolutionaryImpact, 0) /
                          aspects.length) *
                        100
                      ).toFixed(0)}%`
                    : '0%'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Peak Aspects:</span>
                <span className="text-red-600 font-medium">
                  {aspects.filter(a => a.strength === 'peak').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default DynamicAspectsVisualizer
