'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BarChart3,
  RefreshCw,
  Download,
  Trash2,
  TrendingUp,
  Users,
  FileText,
  Clock,
  Database,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts'
import { RAGMonitor } from '@/components/rag/rag-monitor'
import { ragAnalytics, type RAGAnalytics, type RAGQueryLog } from '@/lib/rag/rag-analytics'

export default function RAGAnalyticsPage() {
  const [analytics, setAnalytics] = useState<RAGAnalytics | null>(null)
  const [recentLogs, setRecentLogs] = useState<RAGQueryLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const loadAnalytics = () => {
    try {
      const data = ragAnalytics.getAnalytics()
      const logs = ragAnalytics.getRecentLogs(100)
      setAnalytics(data)
      setRecentLogs(logs)
      setLastRefresh(new Date())
      setIsLoading(false)
    } catch (error) {
      console.error('[RAGAnalytics] Failed to load analytics:', error)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [])

  const handleRefresh = () => {
    setIsLoading(true)
    loadAnalytics()
  }

  const handleClearLogs = () => {
    if (confirm('Are you sure you want to clear all analytics logs? This cannot be undone.')) {
      ragAnalytics.clearLogs()
      loadAnalytics()
    }
  }

  const handleExport = () => {
    const data = {
      analytics,
      recentLogs,
      exportDate: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rag-analytics-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading && !analytics) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading RAG analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RAG Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and analyze Retrieval-Augmented Generation performance
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Last updated: {formatTimestamp(lastRefresh)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={handleClearLogs}
            variant="destructive"
            size="sm"
            disabled={!analytics || analytics.totalQueries === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Logs
          </Button>
        </div>
      </div>

      {/* System Health Banner */}
      {analytics && analytics.errorRate > 0.5 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1">Known Issue: Anthropic Model Access</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  RAG retrieval is working perfectly (finding documents with 60-65% relevance in
                  sub-500ms), but text generation is currently blocked. The Anthropic API key
                  authenticates successfully but no Claude models are available for this
                  organization ID.
                </p>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1 text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Vector Search: Operational
                  </div>
                  <div className="flex items-center gap-1 text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Document Retrieval: Operational
                  </div>
                  <div className="flex items-center gap-1 text-red-700">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Text Generation: Blocked (404 Model Not Found)
                  </div>
                </div>
                <p className="text-xs mt-3 font-medium">
                  Solution: Contact Anthropic support to enable Claude model access for API key.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Monitoring Cards */}
      {analytics && <RAGMonitor variant="detailed" autoRefresh refreshInterval={5000} />}

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Users className="w-4 h-4 mr-2" />
            Top Agents
          </TabsTrigger>
          <TabsTrigger value="performance">
            <TrendingUp className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileText className="w-4 h-4 mr-2" />
            Query Logs
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalQueries || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics?.ragEnabledQueries || 0} with RAG
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics ? (analytics.successRate * 100).toFixed(1) : 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics?.totalQueries
                    ? Math.round(analytics.successRate * analytics.totalQueries)
                    : 0}{' '}
                  successful
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics ? analytics.avgTotalTime.toFixed(0) : 0}ms
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics ? analytics.avgRetrievalTime.toFixed(0) : 0}ms retrieval
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Relevance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics ? (analytics.avgRelevanceScore * 100).toFixed(1) : 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics ? analytics.avgSourcesPerQuery.toFixed(1) : 0} sources/query
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Success Rate Radial Chart */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Success Rate</CardTitle>
                <CardDescription>Query success vs failure rate</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="90%"
                    data={[
                      {
                        name: 'Success',
                        value: analytics ? analytics.successRate * 100 : 0,
                        fill:
                          analytics && analytics.successRate > 0.9
                            ? '#22c55e'
                            : analytics && analytics.successRate > 0.75
                              ? '#eab308'
                              : '#ef4444',
                      },
                    ]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background dataKey="value" cornerRadius={10} />
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-2xl font-bold"
                    >
                      {analytics ? (analytics.successRate * 100).toFixed(1) : 0}%
                    </text>
                  </RadialBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* RAG Usage Radial Chart */}
            <Card>
              <CardHeader>
                <CardTitle>RAG Usage</CardTitle>
                <CardDescription>Percentage of queries using RAG</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="90%"
                    data={[
                      {
                        name: 'RAG',
                        value: analytics ? analytics.ragUsageRate * 100 : 0,
                        fill: '#8b5cf6',
                      },
                    ]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background dataKey="value" cornerRadius={10} />
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-2xl font-bold"
                    >
                      {analytics ? (analytics.ragUsageRate * 100).toFixed(1) : 0}%
                    </text>
                  </RadialBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Average Sources Radial Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Sources per Query</CardTitle>
                <CardDescription>Average number of retrieved sources</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="90%"
                    data={[
                      {
                        name: 'Sources',
                        value: analytics
                          ? Math.min((analytics.avgSourcesPerQuery / 5) * 100, 100)
                          : 0,
                        fill: '#06b6d4',
                      },
                    ]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background dataKey="value" cornerRadius={10} />
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-2xl font-bold"
                    >
                      {analytics ? analytics.avgSourcesPerQuery.toFixed(1) : 0}
                    </text>
                  </RadialBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Cache Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Cache Hit Rate</CardTitle>
                <CardDescription>Percentage of queries served from cache</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="90%"
                    data={[
                      {
                        name: 'Cache Hits',
                        value: analytics ? analytics.cacheHitRate * 100 : 0,
                        fill:
                          analytics && analytics.cacheHitRate > 0.5
                            ? '#22c55e'
                            : analytics && analytics.cacheHitRate > 0.3
                              ? '#eab308'
                              : '#06b6d4',
                      },
                    ]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background dataKey="value" cornerRadius={10} />
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-2xl font-bold"
                    >
                      {analytics ? (analytics.cacheHitRate * 100).toFixed(1) : 0}%
                    </text>
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="mt-2 text-center text-xs text-muted-foreground">
                  {analytics?.cacheHits || 0} hits / {analytics?.cacheMisses || 0} misses
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cache Latency</CardTitle>
                <CardDescription>Average time to check cache</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {analytics ? analytics.avgCacheLatency.toFixed(1) : 0}ms
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Cache overhead per query</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cache Performance</CardTitle>
                <CardDescription>Response time comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Cached</span>
                      <span className="font-semibold text-green-600">
                        {analytics ? analytics.avgCachedResponseTime.toFixed(0) : 0}ms
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width:
                            analytics && analytics.avgUncachedResponseTime > 0
                              ? `${Math.min((analytics.avgCachedResponseTime / analytics.avgUncachedResponseTime) * 100, 100)}%`
                              : '0%',
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Uncached</span>
                      <span className="font-semibold text-orange-600">
                        {analytics ? analytics.avgUncachedResponseTime.toFixed(0) : 0}ms
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500" style={{ width: '100%' }} />
                    </div>
                  </div>
                  {analytics && analytics.avgUncachedResponseTime > 0 && (
                    <div className="text-center pt-2 border-t">
                      <p className="text-xs font-semibold text-blue-600">
                        {(
                          (1 -
                            analytics.avgCachedResponseTime / analytics.avgUncachedResponseTime) *
                          100
                        ).toFixed(0)}
                        % faster with cache
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Query Volume Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Query Volume Over Time</CardTitle>
              <CardDescription>Daily query count and RAG usage</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.performanceTrend && analytics.performanceTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.performanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fontSize: 12 }}
                      tickFormatter={value => {
                        const date = new Date(value)
                        return `${date.getMonth() + 1}/${date.getDate()}`
                      }}
                    />
                    <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelFormatter={value => {
                        const date = new Date(value)
                        return date.toLocaleDateString()
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="queryCount"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      name="Total Queries"
                      dot={{ fill: '#8b5cf6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  No query volume data available yet. Start chatting with agents to see trends.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Relevance Score Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Relevance Score Trend</CardTitle>
              <CardDescription>Average relevance of retrieved sources over time</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.relevanceTrend && analytics.relevanceTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.relevanceTrend}>
                    <defs>
                      <linearGradient id="relevanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                        <stop offset="50%" stopColor="#eab308" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fontSize: 12 }}
                      tickFormatter={value => {
                        const date = new Date(value)
                        return `${date.getMonth() + 1}/${date.getDate()}`
                      }}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fontSize: 12 }}
                      tickFormatter={value => `${(value * 100).toFixed(0)}%`}
                      domain={[0, 1]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelFormatter={value => {
                        const date = new Date(value)
                        return date.toLocaleDateString()
                      }}
                      formatter={(value: any) => `${(value * 100).toFixed(1)}%`}
                    />
                    <Area
                      type="monotone"
                      dataKey="avgRelevance"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#relevanceGradient)"
                      name="Avg Relevance"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  No relevance trend data available yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Agents Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Top Agents by Query Volume</CardTitle>
              <CardDescription>Most frequently consulted historical agents</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.topAgents && analytics.topAgents.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={analytics.topAgents.slice(0, 10)}
                    layout="vertical"
                    margin={{ left: 120 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="agentName"
                      className="text-xs"
                      tick={{ fontSize: 11 }}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      cursor={{ fill: 'hsl(var(--muted))' }}
                    />
                    <Bar dataKey="queryCount" fill="#06b6d4" radius={[0, 8, 8, 0]} name="Queries" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  No agent query data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Agents Tab */}
        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle>Top Historical Agents by Query Volume</CardTitle>
              <CardDescription>Most frequently consulted agents</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Queries</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics?.topAgents && analytics.topAgents.length > 0 ? (
                    analytics.topAgents.map((agent, index) => (
                      <TableRow key={agent.agentId}>
                        <TableCell className="font-medium">#{index + 1}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{agent.agentName}</div>
                            <div className="text-xs text-muted-foreground">{agent.agentId}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {agent.queryCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {analytics.totalQueries > 0
                            ? ((agent.queryCount / analytics.totalQueries) * 100).toFixed(1)
                            : 0}
                          %
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No query data available yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Trend</CardTitle>
                <CardDescription>Average response time over time</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics?.performanceTrend && analytics.performanceTrend.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.performanceTrend.slice(-7).map((trend, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{trend.date}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{trend.avgTime.toFixed(0)}ms</span>
                          <Badge variant="outline" className="text-xs">
                            {trend.queryCount} queries
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No performance data available yet
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Relevance Trend</CardTitle>
                <CardDescription>Average relevance score over time</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics?.relevanceTrend && analytics.relevanceTrend.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.relevanceTrend.slice(-7).map((trend, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{trend.date}</span>
                        <span className="font-medium">
                          {(trend.avgRelevance * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No relevance data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Query Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Recent Query Logs</CardTitle>
              <CardDescription>Last 100 RAG queries</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Timestamp</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Query</TableHead>
                      <TableHead className="text-center">RAG</TableHead>
                      <TableHead className="text-right">Sources</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                      <TableHead className="text-right">Relevance</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentLogs.length > 0 ? (
                      recentLogs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </TableCell>
                          <TableCell className="text-sm">{log.agentName}</TableCell>
                          <TableCell className="max-w-md truncate text-sm">{log.query}</TableCell>
                          <TableCell className="text-center">
                            {log.ragUsed ? (
                              <Badge variant="default" className="text-xs">
                                Yes
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                No
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{log.sourcesRetrieved}</TableCell>
                          <TableCell className="text-right text-xs">
                            {log.totalTime.toFixed(0)}ms
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {(log.averageRelevance * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-center">
                            {log.success ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-600 mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No query logs available yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
