'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Activity,
  Zap,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Database,
  Wifi,
  WifiOff,
} from 'lucide-react'

interface AccuracyValidation {
  timestamp: string
  source: string
  accuracy: string
  precision: number
  planetsValidated: number
  totalPlanets: number
  responseTime: number
  cached: boolean
}

interface CacheMetrics {
  hits: number
  misses: number
  hitRate: number
  totalRequests: number
  averageCacheAge: number
  cacheSize: number
}

interface PerformanceMetrics {
  p50: number
  p95: number
  p99: number
  average: number
  min: number
  max: number
  totalRequests: number
}

interface PlanetaryMetrics {
  accuracyValidation: {
    lastValidation: AccuracyValidation | null
    averagePrecision: number
    validationCount: number
    sourcesUsed: Record<string, number>
  }
  cache: CacheMetrics
  performance: PerformanceMetrics
  health: {
    circuitBreakers: Record<string, { state: string; failures: number; lastFailure: string | null }>
    externalApiStatus: string
    lastHealthCheck: string
  }
  usage: {
    requestsByAccuracy: Record<string, number>
    requestsBySource: Record<string, number>
    popularTimeRanges: Record<string, number>
  }
}

interface MonitorData {
  success: boolean
  metrics?: PlanetaryMetrics
  validation?: AccuracyValidation
  health?: any
  timestamp: string
}

const PlanetaryPositionsMonitor: React.FC = () => {
  const [data, setData] = useState<MonitorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<
    'overview' | 'accuracy' | 'performance' | 'cache' | 'health'
  >('overview')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/planetary-positions/metrics')
      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics')
    } finally {
      setLoading(false)
    }
  }

  const runValidation = async () => {
    try {
      const response = await fetch('/api/planetary-positions/metrics?action=validate')
      const result = await response.json()
      if (result.success) {
        setData(prev => (prev ? { ...prev, validation: result.validation } : null))
      }
    } catch (err) {
      console.error('Validation failed:', err)
    }
  }

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/planetary-positions/metrics?action=health')
      const result = await response.json()
      if (result.success) {
        setData(prev => (prev ? { ...prev, health: result.health } : null))
      }
    } catch (err) {
      console.error('Health check failed:', err)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchMetrics()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [autoRefresh])

  const getAccuracyColor = (accuracy: string) => {
    switch (accuracy) {
      case 'high':
        return 'bg-green-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-orange-500'
      case 'fallback':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600'
      case 'degraded':
        return 'text-yellow-600'
      case 'offline':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  if (loading && !data) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading planetary positions metrics...
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load metrics: {error}
          <Button onClick={fetchMetrics} variant="outline" size="sm" className="ml-2">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const metrics = data?.metrics
  if (!metrics) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <CardTitle>Planetary Positions Monitor</CardTitle>
              <Badge variant="outline" className="text-xs">
                {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Unknown'}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setAutoRefresh(!autoRefresh)}
                variant={autoRefresh ? 'default' : 'outline'}
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto
              </Button>
              <Button onClick={fetchMetrics} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-6">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'accuracy', label: 'Accuracy', icon: Target },
              { id: 'performance', label: 'Performance', icon: Zap },
              { id: 'cache', label: 'Cache', icon: Database },
              { id: 'health', label: 'Health', icon: Wifi },
            ].map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                onClick={() => setActiveTab(id as any)}
                variant={activeTab === id ? 'default' : 'outline'}
                size="sm"
                className="flex items-center space-x-1"
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Accuracy Status */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Accuracy</p>
                      <p className="text-2xl font-bold">
                        {metrics.accuracyValidation.lastValidation?.precision.toFixed(2) || 'N/A'}°
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="mt-2">
                    <Badge
                      className={getAccuracyColor(
                        metrics.accuracyValidation.lastValidation?.accuracy || 'unknown'
                      )}
                    >
                      {metrics.accuracyValidation.lastValidation?.accuracy || 'unknown'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Response Time */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg Response</p>
                      <p className="text-2xl font-bold">
                        {formatTime(metrics.performance.average)}
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={Math.min((metrics.performance.average / 1000) * 100, 100)}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Cache Hit Rate */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Cache Hit Rate</p>
                      <p className="text-2xl font-bold">
                        {formatPercentage(metrics.cache.hitRate)}
                      </p>
                    </div>
                    <Database className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="mt-2">
                    <Progress value={metrics.cache.hitRate * 100} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Health Status */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">API Health</p>
                      <p
                        className={`text-lg font-bold ${getHealthColor(metrics.health.externalApiStatus)}`}
                      >
                        {metrics.health.externalApiStatus}
                      </p>
                    </div>
                    {metrics.health.externalApiStatus === 'healthy' ? (
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    ) : (
                      <WifiOff className="h-8 w-8 text-red-600" />
                    )}
                  </div>
                  <div className="mt-2">
                    <Badge
                      variant={
                        metrics.health.externalApiStatus === 'healthy' ? 'default' : 'destructive'
                      }
                    >
                      Railway Backend
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Accuracy Tab */}
          {activeTab === 'accuracy' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Accuracy Validation</h3>
                <Button onClick={runValidation} variant="outline" size="sm">
                  <Target className="h-4 w-4 mr-1" />
                  Run Validation
                </Button>
              </div>

              {metrics.accuracyValidation.lastValidation && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Last Validation Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Precision</p>
                        <p className="text-xl font-bold">
                          {metrics.accuracyValidation.lastValidation.precision.toFixed(3)}°
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Source</p>
                        <Badge>{metrics.accuracyValidation.lastValidation.source}</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Planets Validated</p>
                        <p className="text-xl font-bold">
                          {metrics.accuracyValidation.lastValidation.planetsValidated}/
                          {metrics.accuracyValidation.lastValidation.totalPlanets}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Response Time</p>
                        <p className="text-xl font-bold">
                          {formatTime(metrics.accuracyValidation.lastValidation.responseTime)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Historical Accuracy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Avg Precision (24h)</p>
                      <p className="text-xl font-bold">
                        {metrics.accuracyValidation.averagePrecision.toFixed(3)}°
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Validations (24h)</p>
                      <p className="text-xl font-bold">
                        {metrics.accuracyValidation.validationCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Sources Used</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(metrics.accuracyValidation.sourcesUsed).map(
                          ([source, count]) => (
                            <Badge key={source} variant="outline" className="text-xs">
                              {source}: {count}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Response Time Percentiles (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">P50 (Median)</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatTime(metrics.performance.p50)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">P95</p>
                      <p className="text-xl font-bold text-yellow-600">
                        {formatTime(metrics.performance.p95)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">P99</p>
                      <p className="text-xl font-bold text-red-600">
                        {formatTime(metrics.performance.p99)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Requests</p>
                      <p className="text-xl font-bold">
                        {metrics.performance.totalRequests.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Request Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>High Accuracy</span>
                        <span>{metrics.usage.requestsByAccuracy.high || 0}</span>
                      </div>
                      <Progress
                        value={
                          ((metrics.usage.requestsByAccuracy.high || 0) /
                            Math.max(
                              Object.values(metrics.usage.requestsByAccuracy).reduce(
                                (a, b) => a + b,
                                0
                              ),
                              1
                            )) *
                          100
                        }
                        className="h-2"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Medium Accuracy</span>
                        <span>{metrics.usage.requestsByAccuracy.medium || 0}</span>
                      </div>
                      <Progress
                        value={
                          ((metrics.usage.requestsByAccuracy.medium || 0) /
                            Math.max(
                              Object.values(metrics.usage.requestsByAccuracy).reduce(
                                (a, b) => a + b,
                                0
                              ),
                              1
                            )) *
                          100
                        }
                        className="h-2"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Low Accuracy</span>
                        <span>{metrics.usage.requestsByAccuracy.low || 0}</span>
                      </div>
                      <Progress
                        value={
                          ((metrics.usage.requestsByAccuracy.low || 0) /
                            Math.max(
                              Object.values(metrics.usage.requestsByAccuracy).reduce(
                                (a, b) => a + b,
                                0
                              ),
                              1
                            )) *
                          100
                        }
                        className="h-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Cache Tab */}
          {activeTab === 'cache' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cache Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Hit Rate</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatPercentage(metrics.cache.hitRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Cache Hits</p>
                      <p className="text-xl font-bold">{metrics.cache.hits.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Cache Misses</p>
                      <p className="text-xl font-bold">{metrics.cache.misses.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Requests</p>
                      <p className="text-xl font-bold">
                        {metrics.cache.totalRequests.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Health Tab */}
          {activeTab === 'health' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Service Health</h3>
                <Button onClick={checkHealth} variant="outline" size="sm">
                  <Wifi className="h-4 w-4 mr-1" />
                  Check Health
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">External API Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        metrics.health.externalApiStatus === 'healthy'
                          ? 'bg-green-500'
                          : metrics.health.externalApiStatus === 'degraded'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                    />
                    <span
                      className={`text-lg font-semibold ${getHealthColor(metrics.health.externalApiStatus)}`}
                    >
                      {metrics.health.externalApiStatus.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Last checked: {new Date(metrics.health.lastHealthCheck).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PlanetaryPositionsMonitor
