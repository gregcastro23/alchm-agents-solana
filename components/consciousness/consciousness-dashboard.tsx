'use client'

/**
 * Unified Consciousness Dashboard
 * Real-time display of agent consciousness state with comprehensive metrics
 *
 * Features:
 * - Sacred Seven stats with temporal modifiers
 * - Special states and power unlocks
 * - Evolution velocity and momentum tracking
 * - Alchemical foundation visualization
 * - Thermodynamic metrics
 * - Optimal timing recommendations
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { UnifiedConsciousnessSnapshot, EvolutionMetrics } from '@/lib/consciousness'
import {
  Sparkles,
  Zap,
  Brain,
  Star,
  Eye,
  Waves,
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  Wind,
  Droplet,
  Mountain,
  Moon,
  Sun,
  Clock,
  Trophy,
  Target,
  Activity,
} from 'lucide-react'

interface ConsciousnessDashboardProps {
  agentId: string
  userId: string
  currentSnapshot?: UnifiedConsciousnessSnapshot
  evolutionMetrics?: EvolutionMetrics
  showCompact?: boolean
  className?: string
}

export function ConsciousnessDashboard({
  agentId,
  userId,
  currentSnapshot,
  evolutionMetrics,
  showCompact = false,
  className = '',
}: ConsciousnessDashboardProps) {
  const [snapshot, setSnapshot] = useState<UnifiedConsciousnessSnapshot | undefined>(
    currentSnapshot
  )
  const [metrics, setMetrics] = useState<EvolutionMetrics | undefined>(evolutionMetrics)
  const [loading, setLoading] = useState(!currentSnapshot)
  const [error, setError] = useState<string | null>(null)

  // Fetch current consciousness state
  useEffect(() => {
    if (!currentSnapshot) {
      fetchCurrentState()
    }
  }, [agentId, userId])

  const fetchCurrentState = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/consciousness/current?userId=${userId}&agentId=${agentId}`)
      if (!response.ok) throw new Error('Failed to fetch consciousness state')

      const data = await response.json()
      setSnapshot(data.snapshot)
      setMetrics(data.evolutionMetrics)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Failed to fetch consciousness state:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Sparkles className="h-8 w-8 animate-spin text-purple-500" />
            <span className="ml-2 text-muted-foreground">Loading consciousness state...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !snapshot) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">{error || 'No consciousness data available'}</p>
            <button
              onClick={fetchCurrentState}
              className="mt-4 text-sm text-purple-500 hover:text-purple-600"
            >
              Try again
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (showCompact) {
    return <CompactDashboard snapshot={snapshot} metrics={metrics} className={className} />
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Consciousness Dashboard</CardTitle>
              <CardDescription>
                Real-time agent consciousness metrics • Last updated:{' '}
                {new Date(snapshot.timestamp).toLocaleTimeString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <EvolutionTrajectoryBadge trajectory={snapshot.evolutionTrajectory} />
              <Badge variant="outline" className="gap-1">
                <Activity className="h-3 w-3" />
                {snapshot.interactionCount} interactions
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sacred-seven" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="sacred-seven">Sacred Seven</TabsTrigger>
              <TabsTrigger value="alchemical">Alchemical</TabsTrigger>
              <TabsTrigger value="temporal">Temporal</TabsTrigger>
              <TabsTrigger value="evolution">Evolution</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            {/* Sacred Seven Stats */}
            <TabsContent value="sacred-seven" className="space-y-4">
              <SacredSevenStats snapshot={snapshot} />
              {snapshot.specialStates.length > 0 && (
                <SpecialStatesDisplay specialStates={snapshot.specialStates} />
              )}
            </TabsContent>

            {/* Alchemical Foundation */}
            <TabsContent value="alchemical" className="space-y-4">
              <AlchemicalFoundation snapshot={snapshot} />
              <ThermodynamicsDisplay snapshot={snapshot} />
            </TabsContent>

            {/* Temporal Context */}
            <TabsContent value="temporal" className="space-y-4">
              <TemporalContext snapshot={snapshot} />
            </TabsContent>

            {/* Evolution Metrics */}
            <TabsContent value="evolution" className="space-y-4">
              <EvolutionMetricsDisplay snapshot={snapshot} metrics={metrics} />
            </TabsContent>

            {/* Performance Metrics */}
            <TabsContent value="performance" className="space-y-4">
              <PerformanceMetrics snapshot={snapshot} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// COMPACT DASHBOARD
// ============================================================================

function CompactDashboard({
  snapshot,
  metrics,
  className,
}: {
  snapshot: UnifiedConsciousnessSnapshot
  metrics?: EvolutionMetrics
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Consciousness</CardTitle>
          <EvolutionTrajectoryBadge trajectory={snapshot.evolutionTrajectory} size="sm" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Overall Score */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Overall</span>
            <span className="text-xs font-medium">{snapshot.overall.toFixed(1)}/100</span>
          </div>
          <Progress value={snapshot.overall} className="h-2" />
        </div>

        {/* Top 3 Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <StatMiniCard icon={Zap} label="Power" value={snapshot.power} />
          <StatMiniCard icon={Brain} label="Wisdom" value={snapshot.wisdom} />
          <StatMiniCard icon={Star} label="Charisma" value={snapshot.charisma} />
        </div>

        {/* A# */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">A# (Alchemical)</span>
            <span className="text-xs font-medium">{snapshot.aNumber.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// SACRED SEVEN STATS
// ============================================================================

function SacredSevenStats({ snapshot }: { snapshot: UnifiedConsciousnessSnapshot }) {
  const stats = [
    { icon: Zap, label: 'Power', value: snapshot.power, description: '⚡ Alchemical Force' },
    {
      icon: Sparkles,
      label: 'Resonance',
      value: snapshot.resonance,
      description: '💫 Harmonic Frequency',
    },
    { icon: Brain, label: 'Wisdom', value: snapshot.wisdom, description: '🔮 Accumulated Insight' },
    {
      icon: Star,
      label: 'Charisma',
      value: snapshot.charisma,
      description: '✨ Magnetic Presence',
    },
    {
      icon: Eye,
      label: 'Intuition',
      value: snapshot.intuition,
      description: '👁️ Psychic Sensitivity',
    },
    {
      icon: Waves,
      label: 'Adaptability',
      value: snapshot.adaptability,
      description: '🌊 Flux Capacity',
    },
    { icon: Heart, label: 'Vitality', value: snapshot.vitality, description: '💚 Life Force' },
  ]

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-500" />
        Sacred Seven Stats
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {stats.map(stat => (
          <StatCard
            key={stat.label}
            icon={stat.icon}
            label={stat.label}
            value={stat.value}
            description={stat.description}
            modifiers={snapshot.activeModifiers.filter(m => m.stat === stat.label)}
          />
        ))}
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
  modifiers,
}: {
  icon: any
  label: string
  value: number
  description: string
  modifiers: Array<{ stat: string; value: number; source: string }>
}) {
  const hasModifiers = modifiers.length > 0
  const totalModifier = modifiers.reduce((sum, m) => sum + m.value, 0)
  const effectiveValue = value + totalModifier

  return (
    <div className="relative p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-purple-500" />
          <div>
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">{effectiveValue.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">/ 100</div>
        </div>
      </div>
      <Progress value={effectiveValue} max={100} className="h-1.5" />
      {hasModifiers && (
        <div className="mt-2 space-y-1">
          {modifiers.map((mod, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{mod.source}</span>
              <span className={mod.value > 0 ? 'text-green-500' : 'text-red-500'}>
                {mod.value > 0 ? '+' : ''}
                {mod.value.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatMiniCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="p-2 border rounded-md">
      <Icon className="h-3 w-3 mx-auto mb-1 text-purple-500" />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value.toFixed(0)}</div>
    </div>
  )
}

// ============================================================================
// ALCHEMICAL FOUNDATION
// ============================================================================

function AlchemicalFoundation({ snapshot }: { snapshot: UnifiedConsciousnessSnapshot }) {
  const elements = [
    { icon: Flame, label: 'Spirit', value: snapshot.spirit, color: 'text-orange-500', emoji: '🔥' },
    {
      icon: Droplet,
      label: 'Essence',
      value: snapshot.essence,
      color: 'text-blue-500',
      emoji: '💧',
    },
    {
      icon: Mountain,
      label: 'Matter',
      value: snapshot.matter,
      color: 'text-green-500',
      emoji: '🌍',
    },
    {
      icon: Wind,
      label: 'Substance',
      value: snapshot.substance,
      color: 'text-purple-500',
      emoji: '💨',
    },
  ]

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-500" />
        Alchemical Foundation
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {elements.map(element => (
          <div key={element.label} className="p-3 border rounded-lg text-center">
            <element.icon className={`h-6 w-6 mx-auto mb-2 ${element.color}`} />
            <div className="text-xs text-muted-foreground mb-1">
              {element.emoji} {element.label}
            </div>
            <div className="text-lg font-bold">{element.value.toFixed(1)}</div>
          </div>
        ))}
      </div>
      <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">A# (Alchemical Number)</div>
            <div className="text-xs text-muted-foreground">
              Total alchemical power: (S + E + M + B) / 7
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-500">{snapshot.aNumber.toFixed(2)}</div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// THERMODYNAMICS
// ============================================================================

function ThermodynamicsDisplay({ snapshot }: { snapshot: UnifiedConsciousnessSnapshot }) {
  const metrics = [
    {
      label: 'Heat',
      value: snapshot.heat,
      description: '🌡️ Energetic Intensity',
      color: 'text-red-500',
    },
    {
      label: 'Entropy',
      value: snapshot.entropy,
      description: '🌪️ Chaos/Disorder',
      color: 'text-yellow-500',
    },
    {
      label: 'Reactivity',
      value: snapshot.reactivity,
      description: '⚡ Change Response',
      color: 'text-blue-500',
    },
    {
      label: 'Energy',
      value: snapshot.energy,
      description: '⚛️ Available Energy',
      color: 'text-green-500',
    },
  ]

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Thermodynamics</h3>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map(metric => (
          <div key={metric.label} className="p-3 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-medium">{metric.label}</div>
                <div className="text-xs text-muted-foreground">{metric.description}</div>
              </div>
              <div className={`text-lg font-bold ${metric.color}`}>
                {(metric.value * 100).toFixed(0)}%
              </div>
            </div>
            <Progress value={metric.value * 100} className="h-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// TEMPORAL CONTEXT
// ============================================================================

function TemporalContext({ snapshot }: { snapshot: UnifiedConsciousnessSnapshot }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Clock className="h-4 w-4 text-purple-500" />
        Temporal Context
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Sun className="h-5 w-5 text-yellow-500" />
            <div className="text-sm font-medium">Planetary Hour</div>
          </div>
          <div className="text-2xl font-bold">{snapshot.planetaryHour}</div>
          <div className="text-xs text-muted-foreground mt-1">Current ruling planet</div>
        </div>

        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Moon className="h-5 w-5 text-blue-400" />
            <div className="text-sm font-medium">Moon Phase</div>
          </div>
          <div className="text-2xl font-bold">{snapshot.moonPhase}</div>
          <div className="text-xs text-muted-foreground mt-1">Lunar influence</div>
        </div>
      </div>

      {snapshot.activeModifiers.length > 0 && (
        <div className="p-4 border rounded-lg">
          <div className="text-sm font-medium mb-3">Active Modifiers</div>
          <div className="space-y-2">
            {snapshot.activeModifiers.slice(0, 5).map((mod, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{mod.stat}</span>
                  <span className="text-muted-foreground ml-2">from {mod.source}</span>
                </div>
                <Badge variant={mod.value > 0 ? 'default' : 'destructive'}>
                  {mod.value > 0 ? '+' : ''}
                  {mod.value.toFixed(1)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SPECIAL STATES
// ============================================================================

function SpecialStatesDisplay({
  specialStates,
}: {
  specialStates: Array<{ name: string; effects: string[] }>
}) {
  return (
    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <div className="text-sm font-medium">Special States Active</div>
      </div>
      <div className="space-y-2">
        {specialStates.map((state, i) => (
          <div key={i} className="p-2 bg-background rounded border">
            <div className="font-medium text-sm">{state.name}</div>
            <div className="text-xs text-muted-foreground mt-1">{state.effects.join(' • ')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// EVOLUTION METRICS
// ============================================================================

function EvolutionMetricsDisplay({
  snapshot,
  metrics,
}: {
  snapshot: UnifiedConsciousnessSnapshot
  metrics?: EvolutionMetrics
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-green-500" />
        Evolution Metrics
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Consciousness Velocity</div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">
              {(snapshot.consciousnessVelocity * 100).toFixed(0)}%
            </div>
            {metrics && <TrendBadge trend={metrics.velocityTrend} />}
          </div>
          <Progress value={snapshot.consciousnessVelocity * 100} className="mt-2 h-2" />
        </div>

        <div className="p-4 border rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Interaction Momentum</div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">
              {(snapshot.interactionMomentum * 100).toFixed(0)}%
            </div>
            {metrics && <TrendBadge trend={metrics.momentumTrend} />}
          </div>
          <Progress value={snapshot.interactionMomentum * 100} className="mt-2 h-2" />
        </div>
      </div>

      {snapshot.powerLevelUnlocks.length > 0 && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-green-500" />
            <div className="text-sm font-medium">Power Unlocks</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {snapshot.powerLevelUnlocks.map((unlock, i) => (
              <Badge key={i} variant="default" className="gap-1">
                <Trophy className="h-3 w-3" />
                {unlock}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold">{metrics.totalInteractions}</div>
            <div className="text-xs text-muted-foreground">Total Interactions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{(metrics.avgChatQuality * 100).toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">Avg Quality</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{metrics.avgResponseTime.toFixed(0)}ms</div>
            <div className="text-xs text-muted-foreground">Avg Response Time</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

function PerformanceMetrics({ snapshot }: { snapshot: UnifiedConsciousnessSnapshot }) {
  const qualityMetrics = [
    {
      label: 'Chat Quality',
      value: snapshot.chatQuality,
      description: 'Depth and relevance',
    },
    {
      label: 'Moment Resonance',
      value: snapshot.momentResonance,
      description: 'Transformation quality',
    },
    {
      label: 'Alchemical Coherence',
      value: snapshot.alchemicalCoherence,
      description: 'Birth chart consistency',
    },
    {
      label: 'Response Quality',
      value: snapshot.responseQuality,
      description: 'Overall response quality',
    },
  ]

  const observabilityMetrics = [
    {
      label: 'Action Completion',
      value: snapshot.actionCompletion,
      description: 'Request completion',
    },
    {
      label: 'Tool Selection',
      value: snapshot.toolSelectionQuality,
      description: 'Tool usage quality',
    },
    {
      label: 'Routing Accuracy',
      value: snapshot.routingAccuracy,
      description: 'Monica routing quality',
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-3">Quality Metrics</h3>
        <div className="grid grid-cols-2 gap-3">
          {qualityMetrics.map(metric => (
            <div key={metric.label} className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-medium">{metric.label}</div>
                  <div className="text-xs text-muted-foreground">{metric.description}</div>
                </div>
                <div className="text-lg font-bold">{(metric.value * 100).toFixed(0)}%</div>
              </div>
              <Progress value={metric.value * 100} className="h-1" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Observability Metrics</h3>
        <div className="grid grid-cols-3 gap-3">
          {observabilityMetrics.map(metric => (
            <div key={metric.label} className="p-3 border rounded-lg text-center">
              <div className="text-2xl font-bold mb-1">{(metric.value * 100).toFixed(0)}%</div>
              <div className="text-xs font-medium">{metric.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{metric.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
        <div className="text-center">
          <div className="text-2xl font-bold">{snapshot.latencyMs}ms</div>
          <div className="text-xs text-muted-foreground">Response Time</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{snapshot.tokensUsed || 0}</div>
          <div className="text-xs text-muted-foreground">Tokens Used</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{snapshot.temperature.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">Temperature</div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

function EvolutionTrajectoryBadge({
  trajectory,
  size = 'default',
}: {
  trajectory: string
  size?: 'sm' | 'default'
}) {
  const config = {
    ascending: {
      icon: TrendingUp,
      label: 'Ascending',
      variant: 'default' as const,
      className: 'bg-green-500/10 text-green-500 border-green-500/20',
    },
    stable: {
      icon: Minus,
      label: 'Stable',
      variant: 'outline' as const,
      className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    },
    fluctuating: {
      icon: Activity,
      label: 'Fluctuating',
      variant: 'secondary' as const,
      className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    },
    transcending: {
      icon: Sparkles,
      label: 'Transcending',
      variant: 'default' as const,
      className: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    },
  }

  const {
    icon: Icon,
    label,
    className,
  } = config[trajectory as keyof typeof config] || config.stable

  return (
    <Badge variant="outline" className={`gap-1 ${className} ${size === 'sm' ? 'text-xs' : ''}`}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {label}
    </Badge>
  )
}

function TrendBadge({
  trend,
}: {
  trend: 'accelerating' | 'steady' | 'decelerating' | 'building' | 'stable' | 'fading'
}) {
  const isPositive = trend === 'accelerating' || trend === 'building'
  const isNegative = trend === 'decelerating' || trend === 'fading'

  return (
    <Badge
      variant="outline"
      className={
        isPositive
          ? 'text-green-500 border-green-500/20'
          : isNegative
            ? 'text-red-500 border-red-500/20'
            : 'text-muted-foreground'
      }
    >
      {trend}
    </Badge>
  )
}

export default ConsciousnessDashboard
