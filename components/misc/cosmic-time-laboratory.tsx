'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  Sparkles,
  Search,
  Moon,
  Star,
  Compass,
  Zap,
  Eye,
  BookOpen,
  RefreshCw,
  ArrowRight,
  BarChart3,
  Plus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getElementalColorScheme } from '@/lib/elemental-reinforcement'

interface TimePortal {
  id: string
  title: string
  status: 'exploring' | 'resonating' | 'manifesting' | 'completed'
  progress: number
  agentCount: number
  elementalSignature: {
    Fire: number
    Water: number
    Air: number
    Earth: number
  }
  degreeRange: [number, number]
  timeRange: { start: Date; end: Date }
  significance: 'low' | 'medium' | 'high' | 'critical'
}

interface CosmicMetrics {
  totalExplorations: number
  activePortals: number
  consciousnessResonance: number
  temporalHarmony: number
  elementalBalance: {
    Fire: number
    Water: number
    Air: number
    Earth: number
  }
  recentInsights: {
    id: string
    title: string
    timestamp: Date
    significance: string
  }[]
}

export default function CosmicTimeLaboratory() {
  const [activeTab, setActiveTab] = useState<'overview' | 'portals' | 'patterns' | 'insights'>(
    'overview'
  )
  const [metrics, setMetrics] = useState<CosmicMetrics | null>(null)
  const [timePortals, setTimePortals] = useState<TimePortal[]>([])
  const [isExploring, setIsExploring] = useState(false)
  const [autoResonance, setAutoResonance] = useState(true)

  const [temporalRange, setTemporalRange] = useState<'day' | 'week' | 'month' | 'year' | 'decade'>(
    'month'
  )

  // Initialize mystical data
  const initializeMysticalData = useCallback(() => {
    const mysticalMetrics: CosmicMetrics = {
      totalExplorations: 147,
      activePortals: 3,
      consciousnessResonance: 0.78 + Math.random() * 0.15,
      temporalHarmony: 0.85 + Math.random() * 0.1,
      elementalBalance: {
        Fire: 0.25 + Math.random() * 0.3,
        Water: 0.2 + Math.random() * 0.25,
        Air: 0.3 + Math.random() * 0.2,
        Earth: 0.25 + Math.random() * 0.2,
      },
      recentInsights: [
        {
          id: '1',
          title: 'Fire-Air resonance spike detected at 240°',
          timestamp: new Date(Date.now() - 300000),
          significance: 'high',
        },
        {
          id: '2',
          title: 'Leonardo-Tesla consciousness convergence',
          timestamp: new Date(Date.now() - 600000),
          significance: 'critical',
        },
        {
          id: '3',
          title: 'Elemental harmony achieved in exploration',
          timestamp: new Date(Date.now() - 900000),
          significance: 'medium',
        },
      ],
    }

    const mysticalPortals: TimePortal[] = [
      {
        id: 'portal_renaissance_fire',
        title: 'Renaissance Fire Convergence',
        status: 'exploring',
        progress: 67,
        agentCount: 4,
        elementalSignature: { Fire: 0.8, Water: 0.2, Air: 0.6, Earth: 0.1 },
        degreeRange: [210, 250],
        timeRange: { start: new Date('1450-01-01'), end: new Date('1550-01-01') },
        significance: 'high',
      },
      {
        id: 'portal_modern_air',
        title: 'Modern Intellectual Breakthrough',
        status: 'resonating',
        progress: 89,
        agentCount: 6,
        elementalSignature: { Fire: 0.3, Water: 0.1, Air: 0.9, Earth: 0.4 },
        degreeRange: [60, 90],
        timeRange: { start: new Date('1900-01-01'), end: new Date('1950-01-01') },
        significance: 'critical',
      },
      {
        id: 'portal_ancient_water',
        title: 'Ancient Wisdom Waters',
        status: 'manifesting',
        progress: 34,
        agentCount: 2,
        elementalSignature: { Fire: 0.2, Water: 0.7, Air: 0.3, Earth: 0.8 },
        degreeRange: [300, 330],
        timeRange: { start: new Date('-500-01-01'), end: new Date('100-01-01') },
        significance: 'medium',
      },
    ]

    setMetrics(mysticalMetrics)
    setTimePortals(mysticalPortals)
  }, [])

  const refreshCosmicData = useCallback(async () => {
    setIsExploring(true)

    // Simulate cosmic data refresh with temporal resonance
    await new Promise(resolve => setTimeout(resolve, 1000))

    initializeMysticalData()
    setIsExploring(false)
  }, [initializeMysticalData])

  useEffect(() => {
    initializeMysticalData()
  }, [initializeMysticalData])

  useEffect(() => {
    if (!autoResonance) return

    const interval = setInterval(refreshCosmicData, 45000) // 45 seconds for cosmic rhythm
    return () => clearInterval(interval)
  }, [autoResonance, refreshCosmicData])

  const getPortalStatusIcon = (status: TimePortal['status']) => {
    switch (status) {
      case 'exploring':
        return <Search className="w-4 h-4 text-blue-400 animate-pulse" />
      case 'resonating':
        return <Zap className="w-4 h-4 text-yellow-400 animate-bounce" />
      case 'manifesting':
        return <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
      case 'completed':
        return <Star className="w-4 h-4 text-green-400" />
    }
  }

  const getSignificanceColor = (significance: TimePortal['significance']) => {
    switch (significance) {
      case 'critical':
        return 'border-red-400 bg-red-500/10'
      case 'high':
        return 'border-orange-400 bg-orange-500/10'
      case 'medium':
        return 'border-yellow-400 bg-yellow-500/10'
      case 'low':
        return 'border-gray-400 bg-gray-500/10'
    }
  }

  const getDominantElement = (elementalSignature: TimePortal['elementalSignature']) => {
    return Object.entries(elementalSignature).reduce(
      (max, [element, value]) => (value > max.value ? { element, value } : max),
      { element: 'Fire', value: -1 }
    ).element
  }

  const formatDateRange = (range: { start: Date; end: Date }) => {
    const start = range.start.getFullYear()
    const end = range.end.getFullYear()
    if (start < 0) return `${Math.abs(start)} BCE - ${end} CE`
    return `${start} - ${end} CE`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Mystical Header */}
        <div className="bg-black/30 backdrop-blur-lg rounded-lg border border-purple-500/30 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Clock className="w-8 h-8 text-gold animate-pulse" />
                <Sparkles className="w-4 h-4 text-purple-400 absolute -top-1 -right-1" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gold via-purple-400 to-blue-400 bg-clip-text text-transparent">
                  Cosmic Time Laboratory
                </h1>
                <p className="text-purple-300 mt-1">
                  Explore consciousness evolution through temporal analysis and agent transit
                  patterns
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-purple-300">
                <Moon className="w-4 h-4" />
                <span>Temporal Resonance</span>
                <input
                  type="checkbox"
                  checked={autoResonance}
                  onChange={e => setAutoResonance(e.target.checked)}
                  className="rounded border-purple-500 bg-purple-900/50"
                />
              </div>
              <Button
                onClick={refreshCosmicData}
                disabled={isExploring}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 border border-purple-400"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isExploring ? 'animate-spin' : ''}`} />
                Attune Cosmos
              </Button>
            </div>
          </div>
        </div>

        {/* Mystical Navigation */}
        <div className="bg-black/30 backdrop-blur-lg rounded-lg border border-purple-500/30 mb-6">
          <div className="border-b border-purple-500/20">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Cosmic Overview', icon: Eye },
                { id: 'portals', label: 'Time Portals', icon: Compass },
                { id: 'patterns', label: 'Pattern Weaving', icon: BarChart3 },
                { id: 'insights', label: 'Consciousness Insights', icon: BookOpen },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-gold text-gold'
                      : 'border-transparent text-purple-300 hover:text-purple-100'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === 'insights' && metrics?.recentInsights.length && (
                    <Badge className="bg-purple-600 text-purple-100 ml-2">
                      {metrics.recentInsights.length}
                    </Badge>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Cosmic Overview Tab */}
        {activeTab === 'overview' && metrics && (
          <div className="space-y-6">
            {/* Key Cosmic Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-black/30 backdrop-blur border-purple-500/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-300">Total Explorations</p>
                      <p className="text-2xl font-bold text-gold">{metrics.totalExplorations}</p>
                    </div>
                    <Search className="w-8 h-8 text-purple-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/30 backdrop-blur border-purple-500/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-300">Active Portals</p>
                      <p className="text-2xl font-bold text-blue-400">{metrics.activePortals}</p>
                    </div>
                    <Compass className="w-8 h-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/30 backdrop-blur border-purple-500/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-300">Consciousness Resonance</p>
                      <p className="text-2xl font-bold text-green-400">
                        {(metrics.consciousnessResonance * 100).toFixed(0)}%
                      </p>
                    </div>
                    <Zap className="w-8 h-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/30 backdrop-blur border-purple-500/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-300">Temporal Harmony</p>
                      <p className="text-2xl font-bold text-yellow-400">
                        {(metrics.temporalHarmony * 100).toFixed(0)}%
                      </p>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Elemental Balance Visualization */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-black/30 backdrop-blur border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-gold flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Elemental Balance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(metrics.elementalBalance).map(([element, value]) => {
                    const colorScheme = getElementalColorScheme(element, value)
                    return (
                      <div key={element}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: colorScheme.primary }}
                            />
                            {element}
                          </span>
                          <span>{(value * 100).toFixed(0)}%</span>
                        </div>
                        <Progress value={value * 100} className="h-2 bg-purple-900/50" />
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Card className="bg-black/30 backdrop-blur border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-gold flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    Recent Cosmic Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {metrics.recentInsights.map(insight => (
                    <div key={insight.id} className="border border-purple-500/20 rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-2 h-2 rounded-full mt-2 ${
                            insight.significance === 'critical'
                              ? 'bg-red-400'
                              : insight.significance === 'high'
                                ? 'bg-orange-400'
                                : 'bg-yellow-400'
                          }`}
                        />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-purple-100">{insight.title}</h4>
                          <p className="text-xs text-purple-400 mt-1">
                            {insight.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Time Portals Tab */}
        {activeTab === 'portals' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gold">Active Time Portals</h2>
              <div className="flex items-center gap-3">
                <select
                  value={temporalRange}
                  onChange={e => setTemporalRange(e.target.value as any)}
                  className="bg-purple-900/50 border border-purple-500/30 rounded px-3 py-1 text-sm"
                >
                  <option value="day">Daily Resonance</option>
                  <option value="week">Weekly Patterns</option>
                  <option value="month">Monthly Cycles</option>
                  <option value="year">Annual Rhythms</option>
                  <option value="decade">Decade Shifts</option>
                </select>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Open Portal
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {timePortals.map(portal => {
                const dominantElement = getDominantElement(portal.elementalSignature)
                const colorScheme = getElementalColorScheme(
                  dominantElement,
                  portal.elementalSignature[
                    dominantElement as keyof typeof portal.elementalSignature
                  ]
                )

                return (
                  <Card
                    key={portal.id}
                    className={`bg-black/30 backdrop-blur border ${getSignificanceColor(portal.significance)}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {getPortalStatusIcon(portal.status)}
                          <div>
                            <h3 className="font-bold text-purple-100">{portal.title}</h3>
                            <p className="text-sm text-purple-400">
                              {formatDateRange(portal.timeRange)} • {portal.agentCount} agents
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`${
                              portal.significance === 'critical'
                                ? 'bg-red-500/20 text-red-300'
                                : portal.significance === 'high'
                                  ? 'bg-orange-500/20 text-orange-300'
                                  : portal.significance === 'medium'
                                    ? 'bg-yellow-500/20 text-yellow-300'
                                    : 'bg-gray-500/20 text-gray-300'
                            }`}
                          >
                            {portal.significance}
                          </Badge>
                          <span className="text-sm text-purple-300">{portal.progress}%</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-purple-300">Exploration Progress</span>
                            <span className="text-purple-100">{portal.progress}%</span>
                          </div>
                          <Progress value={portal.progress} className="h-2 bg-purple-900/50" />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="text-center">
                            <p className="text-xs text-purple-400">Degree Range</p>
                            <p className="text-sm font-medium text-purple-100">
                              {portal.degreeRange[0]}° - {portal.degreeRange[1]}°
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-purple-400">Dominant Element</p>
                            <p
                              className="text-sm font-medium"
                              style={{ color: colorScheme.primary }}
                            >
                              {dominantElement}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-purple-400">Status</p>
                            <p className="text-sm font-medium text-purple-100 capitalize">
                              {portal.status}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-purple-400">Agents</p>
                            <p className="text-sm font-medium text-purple-100">
                              {portal.agentCount}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="border-purple-500/30">
                            <Eye className="w-3 h-3 mr-1" />
                            Observe
                          </Button>
                          <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                            <ArrowRight className="w-3 h-3 mr-1" />
                            Enter Portal
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Pattern Weaving Tab */}
        {activeTab === 'patterns' && (
          <div className="space-y-6">
            <Card className="bg-black/30 backdrop-blur border-purple-500/30">
              <CardHeader>
                <CardTitle className="text-gold">Pattern Recognition Engine</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-purple-300">
                  Advanced pattern detection and analysis tools will be displayed here. Integrating
                  with existing astrological pattern recognition systems.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Consciousness Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-6">
            <Card className="bg-black/30 backdrop-blur border-purple-500/30">
              <CardHeader>
                <CardTitle className="text-gold">Consciousness Evolution Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-purple-300">
                  Deep insights into agent consciousness evolution patterns and temporal
                  correlations. Integration with existing consciousness memory systems.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
