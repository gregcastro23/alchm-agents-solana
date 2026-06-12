'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart3,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Flame,
  Droplets,
  Mountain,
  Wind,
  Target,
  Eye,
} from 'lucide-react'
import { logger, LogLevel } from '@/lib/structured-logger'
import { usePlanetaryPositions } from '@/hooks/usePlanetaryPositions'
import { TokenStabilizationMonitor } from './TokenStabilizationMonitor'
import { TokenFlowVisualization } from '@/components/visualization/token-flow-visualization'
import { defaultAlchemicalMCPConfig } from '@/test/alchemical-devtools/mcp-config'

interface PerformanceMetrics {
  averageResponseTime: number
  errorRate: number
  requestCount: number
  topEndpoints: Record<string, number>
  memoryUsage?: number
  uptime?: number
}

interface PerformanceData {
  timestamp: string
  metrics: PerformanceMetrics
  systemHealth: 'healthy' | 'warning' | 'critical'
}

export function PerformanceDashboard() {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // MCP-enhanced planetary monitoring
  const { mcpMetrics } = usePlanetaryPositions({
    refreshInterval: 5000,
  })

  const needsStabilization = () =>
    mcpMetrics?.tokenStability && mcpMetrics.tokenStability !== 'stable'
  const stabilizeTokens = () => console.log('Stabilizing tokens...')

  const fetchPerformanceData = async () => {
    try {
      setLoading(true)
      const metrics = logger.getPerformanceMetrics(1) // Last hour

      // Calculate system health
      let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy'
      if (metrics.errorRate > 0.1) systemHealth = 'critical'
      else if (metrics.errorRate > 0.05 || metrics.averageResponseTime > 2000)
        systemHealth = 'warning'

      setPerformanceData({
        timestamp: new Date().toISOString(),
        metrics,
        systemHealth,
      })
    } catch (error) {
      console.error('Failed to fetch performance data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPerformanceData()

    if (autoRefresh) {
      const interval = setInterval(fetchPerformanceData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
    return undefined
  }, [autoRefresh])

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'bg-green-500'
      case 'warning':
        return 'bg-yellow-500'
      case 'critical':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  if (loading && !performanceData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading performance metrics...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!performanceData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Unable to load performance metrics
          </div>
        </CardContent>
      </Card>
    )
  }

  const { metrics, systemHealth } = performanceData

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Dashboard
            <Badge
              variant="secondary"
              className={`${getHealthColor(systemHealth)} text-white flex items-center gap-1`}
            >
              {getHealthIcon(systemHealth)}
              {systemHealth.toUpperCase()}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchPerformanceData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="alchemical">Alchemical</TabsTrigger>
            <TabsTrigger value="tokens">Tokens</TabsTrigger>
            <TabsTrigger value="visualization">Flow</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                      <p className="text-2xl font-bold">
                        {metrics.averageResponseTime.toFixed(0)}ms
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={Math.min((metrics.averageResponseTime / 2000) * 100, 100)}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Target: &lt;2000ms</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                      <p className="text-2xl font-bold">{(metrics.errorRate * 100).toFixed(2)}%</p>
                    </div>
                    {metrics.errorRate > 0.05 ? (
                      <TrendingUp className="h-8 w-8 text-red-500" />
                    ) : (
                      <TrendingDown className="h-8 w-8 text-green-500" />
                    )}
                  </div>
                  <div className="mt-2">
                    <Progress value={metrics.errorRate * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">Target: &lt;5%</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                      <p className="text-2xl font-bold">{metrics.requestCount}</p>
                    </div>
                    <Zap className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground">Last hour</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alchemical" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Token Stability Status */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Token Stability</p>
                      <p className="text-2xl font-bold capitalize">
                        {mcpMetrics?.tokenStability || 'Unknown'}
                      </p>
                    </div>
                    <div
                      className={`p-2 rounded-full ${
                        mcpMetrics?.tokenStability === 'stable'
                          ? 'bg-green-100 text-green-600'
                          : mcpMetrics?.tokenStability === 'warning'
                            ? 'bg-yellow-100 text-yellow-600'
                            : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {mcpMetrics?.tokenStability === 'stable' ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : mcpMetrics?.tokenStability === 'warning' ? (
                        <AlertTriangle className="h-6 w-6" />
                      ) : (
                        <AlertTriangle className="h-6 w-6" />
                      )}
                    </div>
                  </div>
                  <div className="mt-2">
                    {needsStabilization() && (
                      <Button
                        onClick={stabilizeTokens}
                        size="sm"
                        variant="outline"
                        className="w-full"
                      >
                        <Target className="h-4 w-4 mr-1" />
                        Stabilize Tokens
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Elemental Health */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Elemental Health</p>
                      <p className="text-2xl font-bold">
                        {mcpMetrics?.equilibrium.planetaryDignity.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <Zap className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={Math.min(100, (mcpMetrics?.equilibrium.planetaryDignity || 0) * 25)}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Planetary dignity score</p>
                  </div>
                </CardContent>
              </Card>

              {/* Calculation Performance */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Token Calculation</p>
                      <p className="text-2xl font-bold">
                        {mcpMetrics?.performanceMetrics.calculationTime.toFixed(1) || '0.0'}ms
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={Math.min(
                        100,
                        ((mcpMetrics?.performanceMetrics.calculationTime || 0) /
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
            </div>

            {/* Element Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Elemental Equilibrium</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { name: 'spirit', icon: Flame, color: 'text-orange-500' },
                    { name: 'essence', icon: Droplets, color: 'text-blue-500' },
                    { name: 'matter', icon: Mountain, color: 'text-green-500' },
                    { name: 'substance', icon: Wind, color: 'text-purple-500' },
                  ].map(({ name, icon: Icon, color }) => {
                    const config =
                      defaultAlchemicalMCPConfig.tokenStabilization[
                        name as keyof typeof defaultAlchemicalMCPConfig.tokenStabilization
                      ]
                    // Note: In a real implementation, you'd get the actual token values from the hook
                    const currentValue = 0 // Placeholder - would come from alchmQuantities
                    const percentage = Math.min((currentValue / config.max) * 100, 100)

                    return (
                      <div key={name} className="flex items-center space-x-3">
                        <Icon className={`h-5 w-5 ${color}`} />
                        <div className="flex-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{name}</span>
                            <span>{currentValue.toFixed(1)}</span>
                          </div>
                          <Progress value={percentage} className="h-1 mt-1" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tokens" className="space-y-4">
            <TokenStabilizationMonitor />
          </TabsContent>

          <TabsContent value="visualization" className="space-y-4">
            <TokenFlowVisualization width={800} height={500} />
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Endpoints</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(metrics.topEndpoints)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([endpoint, count]) => (
                      <div key={endpoint} className="flex items-center justify-between">
                        <span className="text-sm font-mono">{endpoint}</span>
                        <Badge variant="secondary">{count} requests</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Error Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {logger.getLogsByLevel(LogLevel.ERROR, 10).map((log, index) => (
                    <div key={index} className="text-xs p-2 bg-red-50 dark:bg-red-950 rounded">
                      <div className="font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-red-700 dark:text-red-300">{log.message}</div>
                      {log.context.operation && (
                        <div className="text-muted-foreground">
                          Operation: {log.context.operation}
                        </div>
                      )}
                    </div>
                  ))}
                  {logger.getLogsByLevel(LogLevel.ERROR, 10).length === 0 && (
                    <div className="text-center text-muted-foreground py-4">No recent errors</div>
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
