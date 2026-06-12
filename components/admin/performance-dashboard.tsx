'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Activity,
  Users,
  Zap,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  LineChart,
  Clock,
  Cpu,
  HardDrive,
  Wifi,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  RefreshCw,
  Download,
  Eye,
  MessageCircle,
  Target,
  Brain,
  Star,
} from 'lucide-react'

// Types for dashboard data
interface SystemMetrics {
  timestamp: number
  activeUsers: number
  totalSessions: number
  averageSessionDuration: number | null
  pageLoadTime: number | null
  errorRate: number | null
  apiResponseTime: number
  memoryUsage: number | null
  cpuUsage: number | null
  estimated?: Record<string, boolean>
}

interface UserAnalytics {
  totalUsers: number
  activeUsers: number
  newUsersToday: number
  returningUsers: number
  userRetention: number
  averageSessionTime: number | null
  topFeatures: Array<{
    name: string
    usage: number
    growth: number | null
  }>
  deviceBreakdown: {
    desktop: number
    mobile: number
    tablet: number
  }
  browserBreakdown: Record<string, number>
  telemetryCoverage?: {
    deviceSamples: number
    browserSamples: number
    estimated: boolean
  }
}

interface AgentAnalytics {
  totalChats: number
  activeConversations: number
  averageResponseTime: number
  popularAgents: Array<{
    name: string
    chats: number
    satisfaction: number | null
  }>
  consciousnessGrowth: number
  councilSessions: number
  averageEvolutionPoints: number
}

interface PerformanceMetrics {
  systemHealth: 'excellent' | 'good' | 'fair' | 'poor'
  uptime: number | null
  responseTime: number
  throughput: number
  errorRate: number | null
  alerts: Array<{
    id: string
    type: 'error' | 'warning' | 'info'
    message: string
    timestamp: number
  }>
  estimated?: Record<string, boolean>
}

interface DashboardData {
  systemMetrics: SystemMetrics
  userAnalytics: UserAnalytics
  agentAnalytics: AgentAnalytics
  performanceMetrics: PerformanceMetrics
  timeRange: '1h' | '24h' | '7d' | '30d'
}

export const PerformanceDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch real dashboard data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)

      try {
        // Fetch real metrics from API
        const response = await fetch(`/api/admin/performance-metrics?timeRange=${timeRange}`)

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const apiData = await response.json()

        if (apiData.success && apiData.metrics) {
          setData({
            timeRange,
            ...apiData.metrics,
          })
        } else {
          console.error('[Dashboard] Invalid API response:', apiData)
        }
      } catch (error) {
        console.error('[Dashboard] Failed to fetch metrics:', error)
        // Keep existing data on error, don't clear it
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()

    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
    return undefined
  }, [timeRange, autoRefresh])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return 'n/a'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatNullableNumber = (value: number | null, suffix = '') => {
    if (value === null) return 'n/a'
    return `${Number(value.toFixed(value % 1 === 0 ? 0 : 1))}${suffix}`
  }

  const formatNullablePercent = (value: number | null) => {
    if (value === null) return 'n/a'
    return `${value.toFixed(2)}%`
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent':
        return 'text-green-400'
      case 'good':
        return 'text-blue-400'
      case 'fair':
        return 'text-yellow-400'
      case 'poor':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'excellent':
        return <Star className="w-5 h-5 text-green-400" />
      case 'good':
        return <TrendingUp className="w-5 h-5 text-blue-400" />
      case 'fair':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'poor':
        return <TrendingDown className="w-5 h-5 text-red-400" />
      default:
        return <Activity className="w-5 h-5 text-gray-400" />
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
          <span className="text-purple-300">Loading dashboard data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gold">Performance Dashboard</h1>
          <p className="text-purple-400">Real-time monitoring of the Planetary Agent System</p>
        </div>

        <div className="flex items-center gap-4">
          <Select
            value={timeRange}
            onValueChange={value => setTimeRange(value as '1h' | '24h' | '7d' | '30d')}
          >
            <SelectTrigger className="cosmic-select w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="cosmic-button"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>

          <Button variant="outline" size="sm" className="cosmic-button">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cosmic-glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-400">System Health</p>
                <p
                  className={`text-2xl font-bold capitalize ${getHealthColor(data.performanceMetrics.systemHealth)}`}
                >
                  {data.performanceMetrics.systemHealth}
                </p>
              </div>
              {getHealthIcon(data.performanceMetrics.systemHealth)}
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-400">Active Users</p>
                <p className="text-2xl font-bold text-gold">
                  {formatNumber(data.systemMetrics.activeUsers)}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-400">Uptime</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatNullableNumber(data.performanceMetrics.uptime, '%')}
                </p>
              </div>
              <Activity className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-400">Response Time</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {data.systemMetrics.apiResponseTime}ms
                </p>
              </div>
              <Zap className="w-8 h-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="cosmic-tabs">
          <TabsTrigger value="overview" className="cosmic-tab">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="cosmic-tab">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="agents" className="cosmic-tab">
            <Brain className="w-4 h-4 mr-2" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="performance" className="cosmic-tab">
            <Activity className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="alerts" className="cosmic-tab">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Alerts
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Metrics */}
            <Card className="cosmic-glass">
              <CardHeader>
                <CardTitle className="text-gold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Key Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Total Sessions</span>
                  <span className="text-gold font-semibold">
                    {formatNumber(data.systemMetrics.totalSessions)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Avg Session Duration</span>
                  <span className="text-gold font-semibold">
                    {formatDuration(data.systemMetrics.averageSessionDuration)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Page Load Time</span>
                  <span className="text-gold font-semibold">
                    {formatNullableNumber(data.systemMetrics.pageLoadTime, 's')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Error Rate</span>
                  <span className="text-gold font-semibold">
                    {formatNullablePercent(
                      data.systemMetrics.errorRate === null
                        ? null
                        : data.systemMetrics.errorRate * 100
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Top Features */}
            <Card className="cosmic-glass">
              <CardHeader>
                <CardTitle className="text-gold flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Top Features
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.userAnalytics.topFeatures.map((feature, index) => (
                  <div key={feature.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="cosmic-badge">#{index + 1}</Badge>
                      <span className="text-purple-300">{feature.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gold font-semibold">{formatNumber(feature.usage)}</span>
                      {feature.growth === null ? (
                        <span className="text-sm text-purple-500">tracked</span>
                      ) : (
                        <span
                          className={`text-sm ${feature.growth > 0 ? 'text-green-400' : 'text-red-400'}`}
                        >
                          {feature.growth > 0 ? '+' : ''}
                          {feature.growth.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* System Resources */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="cosmic-glass">
              <CardHeader>
                <CardTitle className="text-gold flex items-center gap-2">
                  <Cpu className="w-5 h-5" />
                  System Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-purple-300">CPU Usage</span>
                    <span className="text-gold">
                      {formatNullableNumber(data.systemMetrics.cpuUsage, '%')}
                    </span>
                  </div>
                  <Progress value={data.systemMetrics.cpuUsage ?? 0} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-purple-300">Memory Usage</span>
                    <span className="text-gold">
                      {formatNullableNumber(data.systemMetrics.memoryUsage, '%')}
                    </span>
                  </div>
                  <Progress value={data.systemMetrics.memoryUsage ?? 0} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="cosmic-glass">
              <CardHeader>
                <CardTitle className="text-gold flex items-center gap-2">
                  <Wifi className="w-5 h-5" />
                  Network Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Throughput</span>
                  <span className="text-gold font-semibold">
                    {formatNumber(data.performanceMetrics.throughput)} req/min
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Avg Response Time</span>
                  <span className="text-gold font-semibold">
                    {data.performanceMetrics.responseTime}ms
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Error Rate</span>
                  <span className="text-gold font-semibold">
                    {formatNullablePercent(
                      data.performanceMetrics.errorRate === null
                        ? null
                        : data.performanceMetrics.errorRate * 100
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="cosmic-glass">
              <CardHeader>
                <CardTitle className="text-gold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  User Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Total Users</span>
                  <span className="text-gold font-semibold">
                    {formatNumber(data.userAnalytics.totalUsers)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Active Users</span>
                  <span className="text-gold font-semibold">
                    {formatNumber(data.userAnalytics.activeUsers)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">New Users Today</span>
                  <span className="text-gold font-semibold">
                    {formatNumber(data.userAnalytics.newUsersToday)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">User Retention</span>
                  <span className="text-gold font-semibold">
                    {data.userAnalytics.userRetention}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Avg Session Time</span>
                  <span className="text-gold font-semibold">
                    {formatDuration(data.userAnalytics.averageSessionTime)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="cosmic-glass">
              <CardHeader>
                <CardTitle className="text-gold flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  Device Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-blue-400" />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-300">Desktop</span>
                      <span className="text-gold">
                        {data.userAnalytics.deviceBreakdown.desktop}%
                      </span>
                    </div>
                    <Progress
                      value={data.userAnalytics.deviceBreakdown.desktop}
                      className="h-2 mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-green-400" />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-300">Mobile</span>
                      <span className="text-gold">
                        {data.userAnalytics.deviceBreakdown.mobile}%
                      </span>
                    </div>
                    <Progress
                      value={data.userAnalytics.deviceBreakdown.mobile}
                      className="h-2 mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Tablet className="w-5 h-5 text-purple-400" />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-300">Tablet</span>
                      <span className="text-gold">
                        {data.userAnalytics.deviceBreakdown.tablet}%
                      </span>
                    </div>
                    <Progress
                      value={data.userAnalytics.deviceBreakdown.tablet}
                      className="h-2 mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="cosmic-glass">
            <CardHeader>
              <CardTitle className="text-gold flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Browser Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Object.entries(data.userAnalytics.browserBreakdown).length === 0 ? (
                  <div className="col-span-full py-6 text-center text-sm text-purple-400">
                    No browser telemetry captured in this range
                  </div>
                ) : (
                  Object.entries(data.userAnalytics.browserBreakdown).map(
                    ([browser, percentage]) => (
                      <div key={browser} className="text-center">
                        <div className="text-2xl font-bold text-gold">{percentage}%</div>
                        <div className="text-sm text-purple-400">{browser}</div>
                      </div>
                    )
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="cosmic-glass">
              <CardHeader>
                <CardTitle className="text-gold flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Agent Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Total Chats</span>
                  <span className="text-gold font-semibold">
                    {formatNumber(data.agentAnalytics.totalChats)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Active Conversations</span>
                  <span className="text-gold font-semibold">
                    {formatNumber(data.agentAnalytics.activeConversations)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Avg Response Time</span>
                  <span className="text-gold font-semibold">
                    {data.agentAnalytics.averageResponseTime}s
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Consciousness Growth</span>
                  <span className="text-gold font-semibold">
                    +{formatNumber(data.agentAnalytics.consciousnessGrowth)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Council Sessions</span>
                  <span className="text-gold font-semibold">
                    {formatNumber(data.agentAnalytics.councilSessions)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="cosmic-glass">
              <CardHeader>
                <CardTitle className="text-gold flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Popular Agents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.agentAnalytics.popularAgents.map((agent, index) => (
                  <div key={agent.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="cosmic-badge">#{index + 1}</Badge>
                      <span className="text-purple-300">{agent.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gold font-semibold">{formatNumber(agent.chats)}</span>
                      <Badge variant="outline" className="text-xs">
                        {agent.satisfaction === null ? 'n/a' : `${agent.satisfaction}%`}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="cosmic-glass">
              <CardContent className="p-6 text-center">
                <Clock className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                <div className="text-2xl font-bold text-gold">
                  {formatNullableNumber(data.performanceMetrics.uptime, '%')}
                </div>
                <div className="text-sm text-purple-400">System Uptime</div>
              </CardContent>
            </Card>

            <Card className="cosmic-glass">
              <CardContent className="p-6 text-center">
                <Zap className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
                <div className="text-2xl font-bold text-gold">
                  {data.performanceMetrics.responseTime}ms
                </div>
                <div className="text-sm text-purple-400">Avg Response Time</div>
              </CardContent>
            </Card>

            <Card className="cosmic-glass">
              <CardContent className="p-6 text-center">
                <TrendingUp className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <div className="text-2xl font-bold text-gold">
                  {formatNumber(data.performanceMetrics.throughput)}
                </div>
                <div className="text-sm text-purple-400">Requests/Minute</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card className="cosmic-glass">
            <CardHeader>
              <CardTitle className="text-gold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                System Alerts ({data.performanceMetrics.alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.performanceMetrics.alerts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-green-400 text-4xl mb-4">✓</div>
                  <p className="text-purple-300">All systems operational</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.performanceMetrics.alerts.map(alert => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 p-3 border border-purple-500/20 rounded-lg"
                    >
                      <AlertTriangle
                        className={`w-5 h-5 mt-0.5 ${
                          alert.type === 'error'
                            ? 'text-red-400'
                            : alert.type === 'warning'
                              ? 'text-yellow-400'
                              : 'text-blue-400'
                        }`}
                      />
                      <div className="flex-1">
                        <p className="text-purple-200">{alert.message}</p>
                        <p className="text-xs text-purple-400">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        className={`cosmic-badge capitalize ${
                          alert.type === 'error'
                            ? 'bg-red-500/20 text-red-400'
                            : alert.type === 'warning'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {alert.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default PerformanceDashboard
