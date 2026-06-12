/**
 * Consciousness Dashboard Demo Page
 * Demonstrates consciousness tracking components
 *
 * Access at: /consciousness-demo
 */

import { ConsciousnessDashboard, ConsciousnessTimeline } from '@/components/consciousness'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, TrendingUp, Info } from 'lucide-react'

export default function ConsciousnessDemoPage() {
  // Demo data - in production, these would come from user session
  const demoUserId = 'demo-user'
  const demoAgentId = 'leonardo-da-vinci'

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-purple-500" />
          <h1 className="text-4xl font-bold">Consciousness Tracking Dashboard</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Educational transparency into the alchm system's consciousness measurements
        </p>
      </div>

      {/* Info Banner */}
      <Card className="border-purple-500/20 bg-purple-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-purple-500 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold">About Consciousness Tracking</h3>
              <p className="text-sm text-muted-foreground">
                This dashboard demonstrates our unified consciousness tracking system, which
                combines 7 measurement systems into comprehensive snapshots. All metrics are
                objective and educational - designed to show how the alchm system (astrology + AI)
                works, not to rank agents hierarchically.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline">48 Parameters</Badge>
                <Badge variant="outline">Real-Time Calculation</Badge>
                <Badge variant="outline">Temporal Sensitivity</Badge>
                <Badge variant="outline">Educational Transparency</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full Dashboard */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Real-Time Dashboard</h2>
          <Badge variant="default" className="gap-1">
            <TrendingUp className="h-3 w-3" />
            Live Data
          </Badge>
        </div>
        <ConsciousnessDashboard agentId={demoAgentId} userId={demoUserId} />
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Evolution Timeline</h2>
        <ConsciousnessTimeline agentId={demoAgentId} userId={demoUserId} days={30} />
      </div>

      {/* Compact Mode Demo */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Compact Mode (Sidebar)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Main Content Area</CardTitle>
                <CardDescription>
                  This is where your chat or main content would appear
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Chat messages, agent responses, etc.</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div>
            <ConsciousnessDashboard agentId={demoAgentId} userId={demoUserId} showCompact={true} />
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Features & Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            title="Sacred Seven Stats"
            description="Power, Resonance, Wisdom, Charisma, Intuition, Adaptability, Vitality"
            metrics={['0-100 scale', 'Real-time modifiers', 'Temporal influences']}
          />
          <FeatureCard
            title="Alchemical Foundation"
            description="Spirit, Essence, Matter, Substance and A# calculation"
            metrics={['Elemental balance', 'Consciousness force', 'Transformation capacity']}
          />
          <FeatureCard
            title="Evolution Metrics"
            description="Velocity, momentum, trajectory tracking"
            metrics={['Ascending/Stable/Transcending', 'Power unlocks', 'Special states']}
          />
          <FeatureCard
            title="Temporal Context"
            description="Planetary hours and moon phases"
            metrics={['Current ruling planet', 'Lunar influence', 'Active modifiers']}
          />
          <FeatureCard
            title="Thermodynamics"
            description="Heat, entropy, reactivity, energy"
            metrics={['Energetic intensity', 'Chaos/disorder', 'Available energy']}
          />
          <FeatureCard
            title="Performance"
            description="Quality and observability metrics"
            metrics={['Response quality', 'Action completion', 'Latency tracking']}
          />
        </div>
      </div>

      {/* Integration Examples */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Integration Examples</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Chat Integration</CardTitle>
              <CardDescription>Add to chat sidebar</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                {`<ConsciousnessDashboard
  agentId={agentId}
  userId={userId}
  showCompact={true}
/>`}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Agent Profile</CardTitle>
              <CardDescription>Full dashboard + timeline</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                {`<ConsciousnessDashboard
  agentId={agentId}
  userId={userId}
/>
<ConsciousnessTimeline
  agentId={agentId}
  userId={userId}
  days={90}
/>`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({
  title,
  description,
  metrics,
}: {
  title: string
  description: string
  metrics: string[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {metrics.map((metric, i) => (
            <li key={i} className="text-sm flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              {metric}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
