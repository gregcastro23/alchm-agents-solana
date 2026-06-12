'use client'

/**
 * Consciousness Evolution Timeline
 * Visualizes agent consciousness evolution over time with interactive charts
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { UnifiedConsciousnessSnapshot } from '@/lib/consciousness'
import { LineChart, TrendingUp, Zap, Brain, Star, Activity, Clock } from 'lucide-react'

interface ConsciousnessTimelineProps {
  agentId: string
  userId: string
  days?: number
  className?: string
}

interface TimelineData {
  snapshots: UnifiedConsciousnessSnapshot[]
  summary: {
    totalInteractions: number
    avgPower: number
    avgWisdom: number
    avgOverall: number
    avgChatQuality: number
    avgActionCompletion: number
    avgLatency: number
  } | null
  timeRange: {
    start: string
    end: string
  }
  count: number
}

export function ConsciousnessTimeline({
  agentId,
  userId,
  days = 30,
  className = '',
}: ConsciousnessTimelineProps) {
  const [data, setData] = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTimeline()
  }, [agentId, userId, days])

  const fetchTimeline = async () => {
    try {
      setLoading(true)
      setError(null)

      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

      const response = await fetch(
        `/api/consciousness/timeline?userId=${userId}&agentId=${agentId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      )

      if (!response.ok) throw new Error('Failed to fetch timeline')

      const timeline = await response.json()
      setData(timeline)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Failed to fetch timeline:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Activity className="h-8 w-8 animate-spin text-purple-500" />
            <span className="ml-2 text-muted-foreground">Loading timeline...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">{error || 'No timeline data available'}</p>
            <button
              onClick={fetchTimeline}
              className="mt-4 text-sm text-purple-500 hover:text-purple-600"
            >
              Try again
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.count === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <LineChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No interactions recorded yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Start chatting to build consciousness history
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Consciousness Evolution Timeline</CardTitle>
            <CardDescription>
              {data.count} interactions over {days} days
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <TrendingUp className="h-3 w-3" />
            {data.summary ? `${data.summary.avgOverall.toFixed(1)}/100 avg` : 'N/A'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <TimelineSummary data={data} />
            <SimpleTimeline snapshots={data.snapshots} />
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <StatsTrends snapshots={data.snapshots} />
          </TabsContent>

          <TabsContent value="quality" className="space-y-4">
            <QualityTrends snapshots={data.snapshots} />
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <PerformanceTrends snapshots={data.snapshots} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// TIMELINE SUMMARY
// ============================================================================

function TimelineSummary({ data }: { data: TimelineData }) {
  if (!data.summary) return null

  const metrics = [
    { icon: Zap, label: 'Avg Power', value: data.summary.avgPower, suffix: '/100' },
    { icon: Brain, label: 'Avg Wisdom', value: data.summary.avgWisdom, suffix: '/100' },
    { icon: Star, label: 'Avg Overall', value: data.summary.avgOverall, suffix: '/100' },
    {
      icon: Activity,
      label: 'Chat Quality',
      value: data.summary.avgChatQuality * 100,
      suffix: '%',
    },
    {
      icon: TrendingUp,
      label: 'Completion',
      value: data.summary.avgActionCompletion * 100,
      suffix: '%',
    },
    { icon: Clock, label: 'Avg Latency', value: data.summary.avgLatency, suffix: 'ms' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {metrics.map((metric, i) => (
        <div key={i} className="p-4 border rounded-lg text-center">
          <metric.icon className="h-5 w-5 mx-auto mb-2 text-purple-500" />
          <div className="text-2xl font-bold">
            {metric.value.toFixed(metric.suffix === 'ms' ? 0 : 1)}
            <span className="text-sm text-muted-foreground ml-1">{metric.suffix}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">{metric.label}</div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// SIMPLE TIMELINE
// ============================================================================

function SimpleTimeline({ snapshots }: { snapshots: UnifiedConsciousnessSnapshot[] }) {
  // Group by day
  const byDay = snapshots.reduce(
    (acc, snapshot) => {
      const day = new Date(snapshot.timestamp).toLocaleDateString()
      if (!acc[day]) acc[day] = []
      acc[day].push(snapshot)
      return acc
    },
    {} as Record<string, UnifiedConsciousnessSnapshot[]>
  )

  const days = Object.keys(byDay).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Activity by Day</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {days.map(day => {
          const daySnapshots = byDay[day]
          const avgOverall =
            daySnapshots.reduce((sum, s) => sum + s.overall, 0) / daySnapshots.length

          return (
            <div key={day} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm">{day}</div>
                <Badge variant="outline">{daySnapshots.length} interactions</Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-purple-500 rounded-full h-2 transition-all"
                    style={{ width: `${avgOverall}%` }}
                  />
                </div>
                <div className="text-sm font-medium min-w-[4rem] text-right">
                  {avgOverall.toFixed(1)}/100
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// STATS TRENDS
// ============================================================================

function StatsTrends({ snapshots }: { snapshots: UnifiedConsciousnessSnapshot[] }) {
  const stats = [
    { key: 'power', label: 'Power', icon: Zap },
    { key: 'wisdom', label: 'Wisdom', icon: Brain },
    { key: 'charisma', label: 'Charisma', icon: Star },
  ]

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Sacred Seven Trends</h3>
      {stats.map(stat => {
        const values = snapshots.map(
          s => s[stat.key as keyof UnifiedConsciousnessSnapshot] as number
        )
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length
        const min = Math.min(...values)
        const max = Math.max(...values)
        const trend = values[values.length - 1] - values[0]

        return (
          <div key={stat.key} className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <stat.icon className="h-4 w-4 text-purple-500" />
                <span className="font-medium">{stat.label}</span>
              </div>
              <Badge variant={trend > 0 ? 'default' : trend < 0 ? 'destructive' : 'outline'}>
                {trend > 0 ? '+' : ''}
                {trend.toFixed(1)}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Average</div>
                <div className="font-medium">{avg.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Min</div>
                <div className="font-medium">{min.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Max</div>
                <div className="font-medium">{max.toFixed(1)}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// QUALITY TRENDS
// ============================================================================

function QualityTrends({ snapshots }: { snapshots: UnifiedConsciousnessSnapshot[] }) {
  const metrics = [
    { key: 'chatQuality', label: 'Chat Quality' },
    { key: 'momentResonance', label: 'Moment Resonance' },
    { key: 'alchemicalCoherence', label: 'Alchemical Coherence' },
    { key: 'responseQuality', label: 'Response Quality' },
  ]

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Quality Metrics Trends</h3>
      {metrics.map(metric => {
        const values = snapshots.map(
          s => (s[metric.key as keyof UnifiedConsciousnessSnapshot] as number) * 100
        )
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length

        return (
          <div key={metric.key} className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{metric.label}</span>
              <span className="text-lg font-bold">{avg.toFixed(1)}%</span>
            </div>
            <div className="bg-muted rounded-full h-2">
              <div
                className="bg-purple-500 rounded-full h-2 transition-all"
                style={{ width: `${avg}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// PERFORMANCE TRENDS
// ============================================================================

function PerformanceTrends({ snapshots }: { snapshots: UnifiedConsciousnessSnapshot[] }) {
  const avgLatency = snapshots.reduce((sum, s) => sum + s.latencyMs, 0) / snapshots.length
  const avgTokens = snapshots.reduce((sum, s) => sum + (s.tokensUsed || 0), 0) / snapshots.length
  const avgActionCompletion =
    snapshots.reduce((sum, s) => sum + s.actionCompletion, 0) / snapshots.length

  const fastResponses = snapshots.filter(s => s.latencyMs < 2000).length
  const fastPercent = (fastResponses / snapshots.length) * 100

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Performance Overview</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border rounded-lg text-center">
          <div className="text-2xl font-bold">{avgLatency.toFixed(0)}ms</div>
          <div className="text-xs text-muted-foreground mt-1">Avg Response Time</div>
        </div>
        <div className="p-4 border rounded-lg text-center">
          <div className="text-2xl font-bold">{fastPercent.toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground mt-1">Fast Responses (&lt;2s)</div>
        </div>
        <div className="p-4 border rounded-lg text-center">
          <div className="text-2xl font-bold">{avgTokens.toFixed(0)}</div>
          <div className="text-xs text-muted-foreground mt-1">Avg Tokens</div>
        </div>
        <div className="p-4 border rounded-lg text-center">
          <div className="text-2xl font-bold">{(avgActionCompletion * 100).toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground mt-1">Action Completion</div>
        </div>
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <div className="text-sm font-medium mb-2">Response Time Distribution</div>
        <div className="space-y-2">
          {[
            { label: '< 1s', range: [0, 1000] },
            { label: '1-2s', range: [1000, 2000] },
            { label: '2-5s', range: [2000, 5000] },
            { label: '> 5s', range: [5000, Infinity] },
          ].map(({ label, range }) => {
            const count = snapshots.filter(
              s => s.latencyMs >= range[0] && s.latencyMs < range[1]
            ).length
            const percent = (count / snapshots.length) * 100

            return (
              <div key={label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">
                    {count} ({percent.toFixed(0)}%)
                  </span>
                </div>
                <div className="bg-background rounded-full h-1.5">
                  <div
                    className="bg-purple-500 rounded-full h-1.5"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ConsciousnessTimeline
