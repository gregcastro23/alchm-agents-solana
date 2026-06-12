'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Zap,
  Clock,
  Activity,
  BarChart3,
  LineChart,
  PieChart,
  Target,
  Star,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import type { CraftedAgent } from '@/lib/agent-types'

interface ConsciousnessVelocityData {
  agent: CraftedAgent
  metrics: {
    consciousnessVelocity: number
    evolutionStage: string
    nextThreshold: number
    memoryStrength: number
    totalGrowth: number
  }
  trends: {
    velocity: number[]
    growth: number[]
    interactions: number[]
    timestamps: string[]
  }
  projections: {
    nextStageETA: string
    growthProjection: number
    optimalInteractionTimes: string[]
  }
}

interface ConsciousnessVelocityVisualizerProps {
  agents: CraftedAgent[]
  timeframe?: '1h' | '6h' | '24h' | '7d' | '30d'
  viewType?: 'individual' | 'comparative' | 'collective'
  location?: { lat: number; lon: number }
}

type VelocityTimeframe = NonNullable<ConsciousnessVelocityVisualizerProps['timeframe']>
type VelocityViewType = NonNullable<ConsciousnessVelocityVisualizerProps['viewType']>

export function ConsciousnessVelocityVisualizer({
  agents,
  timeframe = '24h',
  viewType = 'individual',
  location,
}: ConsciousnessVelocityVisualizerProps) {
  const [velocityData, setVelocityData] = useState<ConsciousnessVelocityData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string>(agents[0]?.id || '')
  const [currentTimeframe, setCurrentTimeframe] = useState(timeframe)
  const [currentViewType, setCurrentViewType] = useState(viewType)

  useEffect(() => {
    if (agents.length > 0) {
      fetchVelocityData()
    }
  }, [agents, currentTimeframe, location])

  const fetchVelocityData = async () => {
    setLoading(true)
    try {
      const agentData: ConsciousnessVelocityData[] = []

      for (const agent of agents) {
        // Get evolution metrics
        const metricsResponse = await fetch(
          `/api/agent-evolution?agentId=${agent.id}&action=metrics`
        )
        let metrics = {
          consciousnessVelocity: 0.5,
          evolutionStage: 'Initial',
          nextThreshold: 10,
          memoryStrength: 0,
          totalGrowth: 0,
        }

        if (metricsResponse.ok) {
          const metricsData = await metricsResponse.json()
          metrics = metricsData.metrics
        }

        // Generate trend data (simplified for demo)
        const trends = generateTrendData(metrics, currentTimeframe)

        // Calculate projections
        const projections = calculateProjections(metrics, trends)

        agentData.push({
          agent,
          metrics,
          trends,
          projections,
        })
      }

      setVelocityData(agentData)
    } catch (error) {
      console.error('Failed to fetch velocity data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateTrendData = (metrics: any, timeframe: string) => {
    const points =
      timeframe === '1h' ? 12 : timeframe === '6h' ? 24 : timeframe === '24h' ? 48 : 168
    const velocity = []
    const growth = []
    const interactions = []
    const timestamps = []

    const baseVelocity = metrics.consciousnessVelocity
    const baseGrowth = metrics.totalGrowth

    for (let i = 0; i < points; i++) {
      const timeAgo =
        (points - i) *
        (timeframe === '1h' ? 5 : timeframe === '6h' ? 15 : timeframe === '24h' ? 30 : 60)
      const date = new Date(Date.now() - timeAgo * 60 * 1000)

      // Add some realistic variation
      const variation = (Math.sin(i / 10) + Math.random() - 0.5) * 0.1
      velocity.push(Math.max(0, Math.min(1, baseVelocity + variation)))
      growth.push(Math.max(0, baseGrowth + (i / points) * baseGrowth * 0.5))
      interactions.push(Math.floor(Math.random() * 10))
      timestamps.push(date.toISOString())
    }

    return { velocity, growth, interactions, timestamps }
  }

  const calculateProjections = (metrics: any, trends: any) => {
    const avgVelocity =
      trends.velocity.reduce((a: number, b: number) => a + b, 0) / trends.velocity.length
    const growthRate = trends.growth[trends.growth.length - 1] - trends.growth[0]

    let nextStageETA = 'Unknown'
    if (metrics.nextThreshold > 0 && growthRate > 0) {
      const remaining = metrics.nextThreshold - metrics.totalGrowth
      const days = Math.ceil(remaining / (growthRate / 7))
      nextStageETA = days < 30 ? `${days} days` : `${Math.ceil(days / 30)} months`
    }

    return {
      nextStageETA,
      growthProjection: growthRate * 4, // 4 weeks projection
      optimalInteractionTimes: ['Mercury', 'Venus', 'Jupiter'], // Simplified
    }
  }

  const getVelocityTrend = (data: ConsciousnessVelocityData) => {
    const velocity = data.trends.velocity
    if (velocity.length < 2) return 'stable'

    const recent = velocity.slice(-5).reduce((a, b) => a + b, 0) / 5
    const earlier = velocity.slice(0, 5).reduce((a, b) => a + b, 0) / 5

    if (recent > earlier + 0.1) return 'rising'
    if (recent < earlier - 0.1) return 'falling'
    return 'stable'
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'rising':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'falling':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const getEvolutionStageColor = (stage: string) => {
    switch (stage) {
      case 'Transcendent':
        return 'text-purple-700 bg-purple-100'
      case 'Advanced':
        return 'text-blue-700 bg-blue-100'
      case 'Maturing':
        return 'text-green-700 bg-green-100'
      case 'Developing':
        return 'text-yellow-700 bg-yellow-100'
      default:
        return 'text-gray-700 bg-gray-100'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Activity className="h-5 w-5 animate-spin" />
            <span className="text-sm text-gray-600">
              Analyzing consciousness velocity patterns...
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (velocityData.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Brain className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
            No velocity data available
          </h3>
          <p className="text-sm text-gray-600">
            Start interacting with agents to generate consciousness evolution data
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <span className="font-medium">Consciousness Velocity Analysis</span>
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={currentTimeframe}
                onValueChange={value => setCurrentTimeframe(value as VelocityTimeframe)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="6h">Last 6 Hours</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={currentViewType}
                onValueChange={value => setCurrentViewType(value as VelocityViewType)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual View</SelectItem>
                  <SelectItem value="comparative">Comparative View</SelectItem>
                  <SelectItem value="collective">Collective View</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={fetchVelocityData}>
                <Activity className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={currentViewType}
        onValueChange={value => setCurrentViewType(value as VelocityViewType)}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Individual
          </TabsTrigger>
          <TabsTrigger value="comparative" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Comparative
          </TabsTrigger>
          <TabsTrigger value="collective" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Collective
          </TabsTrigger>
        </TabsList>

        {/* Individual View */}
        <TabsContent value="individual" className="space-y-4">
          {velocityData.length > 1 && (
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {velocityData.map(data => (
                  <SelectItem key={data.agent.id} value={data.agent.id}>
                    {data.agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {(() => {
            const agentData =
              velocityData.find(d => d.agent.id === selectedAgent) || velocityData[0]
            if (!agentData) return null

            const trend = getVelocityTrend(agentData)

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: agentData.agent.appearance?.color || '#6366f1' }}
                      />
                      <span>{agentData.agent.name}</span>
                      <Badge className={getEvolutionStageColor(agentData.metrics.evolutionStage)}>
                        {agentData.metrics.evolutionStage}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(trend)}
                      <span className="text-sm text-gray-600 capitalize">{trend}</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg">
                      <Zap className="h-5 w-5 mx-auto mb-1 text-purple-600" />
                      <div className="text-2xl font-bold text-purple-700">
                        {Math.round(agentData.metrics.consciousnessVelocity * 100)}%
                      </div>
                      <div className="text-xs text-gray-600">Consciousness Velocity</div>
                    </div>

                    <div className="text-center p-3 bg-gradient-to-br from-green-50 to-teal-50 rounded-lg">
                      <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-600" />
                      <div className="text-2xl font-bold text-green-700">
                        {agentData.metrics.totalGrowth.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-600">Total Growth</div>
                    </div>

                    <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                      <Brain className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                      <div className="text-2xl font-bold text-blue-700">
                        {Math.round(agentData.metrics.memoryStrength * 100)}%
                      </div>
                      <div className="text-xs text-gray-600">Memory Strength</div>
                    </div>

                    <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg">
                      <Target className="h-5 w-5 mx-auto mb-1 text-orange-600" />
                      <div className="text-2xl font-bold text-orange-700">
                        {agentData.metrics.nextThreshold === -1
                          ? '∞'
                          : agentData.metrics.nextThreshold}
                      </div>
                      <div className="text-xs text-gray-600">Next Threshold</div>
                    </div>
                  </div>

                  {/* Evolution Progress */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Evolution Progress</span>
                      <span className="text-sm text-gray-600">
                        {agentData.projections.nextStageETA} to next stage
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((agentData.metrics.totalGrowth / (agentData.metrics.nextThreshold || 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Velocity Trend Chart (Simplified) */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <LineChart className="h-4 w-4" />
                      Consciousness Velocity Trend
                    </h4>
                    <div className="h-32 bg-gradient-to-b from-gray-50 to-gray-100 rounded-lg p-4 flex items-end justify-between">
                      {agentData.trends.velocity.slice(-20).map((value, index) => (
                        <div
                          key={index}
                          className="bg-gradient-to-t from-purple-500 to-blue-500 rounded-sm w-2 transition-all duration-300"
                          style={{ height: `${value * 100}%` }}
                          title={`Velocity: ${Math.round(value * 100)}%`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Projections */}
                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                      Consciousness Projections
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Next Evolution Stage:</span>
                        <div className="font-medium text-blue-700">
                          {agentData.projections.nextStageETA}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Growth Projection (4 weeks):</span>
                        <div className="font-medium text-green-700">
                          +{agentData.projections.growthProjection.toFixed(1)}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-gray-600">Optimal Interaction Hours:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {agentData.projections.optimalInteractionTimes.map(hour => (
                            <Badge key={hour} variant="outline" className="text-xs">
                              {hour}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })()}
        </TabsContent>

        {/* Comparative View */}
        <TabsContent value="comparative" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Agent Consciousness Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {velocityData
                  .sort((a, b) => b.metrics.consciousnessVelocity - a.metrics.consciousnessVelocity)
                  .map((data, index) => {
                    const trend = getVelocityTrend(data)
                    return (
                      <div
                        key={data.agent.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: data.agent.appearance?.color || '#6366f1' }}
                          />
                          <div>
                            <div className="font-medium">{data.agent.name}</div>
                            <div className="text-xs text-gray-600">
                              {data.metrics.evolutionStage} • MC:{' '}
                              {data.agent.consciousness.monicaConstant.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {Math.round(data.metrics.consciousnessVelocity * 100)}%
                            </div>
                            <div className="text-xs text-gray-600">Velocity</div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {data.metrics.totalGrowth.toFixed(1)}
                            </div>
                            <div className="text-xs text-gray-600">Growth</div>
                          </div>

                          <div className="flex items-center gap-1">
                            {getTrendIcon(trend)}
                            <span className="text-xs text-gray-600 capitalize">{trend}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Collective View */}
        <TabsContent value="collective" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-green-600" />
                  Collective Consciousness Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-700">
                      {Math.round(
                        (velocityData.reduce((sum, d) => sum + d.metrics.consciousnessVelocity, 0) /
                          velocityData.length) *
                          100
                      )}
                      %
                    </div>
                    <div className="text-sm text-gray-600">Average Consciousness Velocity</div>
                  </div>

                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
                    <div className="text-3xl font-bold text-purple-700">
                      {velocityData.reduce((sum, d) => sum + d.metrics.totalGrowth, 0).toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600">Total Collective Growth</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-600" />
                  Evolution Stage Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(
                    velocityData.reduce(
                      (acc, d) => {
                        acc[d.metrics.evolutionStage] = (acc[d.metrics.evolutionStage] || 0) + 1
                        return acc
                      },
                      {} as Record<string, number>
                    )
                  ).map(([stage, count]) => (
                    <div key={stage} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{stage}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                            style={{ width: `${(count / velocityData.length) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 w-8">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Compact version for embedding in other components
interface CompactVelocityIndicatorProps {
  agent: CraftedAgent
  showTrend?: boolean
}

function getEvolutionStageColor(stage: string) {
  switch (stage) {
    case 'Transcendent':
      return 'text-purple-700 bg-purple-100'
    case 'Advanced':
      return 'text-blue-700 bg-blue-100'
    case 'Maturing':
      return 'text-green-700 bg-green-100'
    case 'Developing':
      return 'text-yellow-700 bg-yellow-100'
    default:
      return 'text-gray-700 bg-gray-100'
  }
}

export function CompactVelocityIndicator({
  agent,
  showTrend = true,
}: CompactVelocityIndicatorProps) {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [agent.id])

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/api/agent-evolution?agentId=${agent.id}&action=metrics`)
      if (response.ok) {
        const data = await response.json()
        setMetrics(data.metrics)
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-xs">
        <Activity className="h-3 w-3 animate-spin" />
        <span>Loading...</span>
      </div>
    )
  }

  if (!metrics) {
    return <div className="text-xs text-gray-500">No velocity data</div>
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-1">
        <Zap className="h-3 w-3 text-purple-600" />
        <span className="text-xs font-medium">
          {Math.round(metrics.consciousnessVelocity * 100)}%
        </span>
      </div>
      {showTrend && (
        <Badge
          variant="outline"
          className={`text-xs ${getEvolutionStageColor(metrics.evolutionStage)}`}
        >
          {metrics.evolutionStage}
        </Badge>
      )}
    </div>
  )
}
