'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Users, Zap, TrendingUp, Clock, Sparkles, ArrowRight, Activity, Target } from 'lucide-react'
import { GroupConsciousnessDynamics } from '@/lib/consciousness/group-dynamics'
import { usePlanetaryHours } from '@/lib/hooks/usePlanetaryHours'
import type { CraftedAgent } from '@/lib/agent-types'

interface GroupConsciousnessIndicatorProps {
  selectedAgents: CraftedAgent[]
  location?: { lat: number; lon: number }
  onOptimalSpeakerSuggestion?: (agentId: string) => void
  className?: string
}

export function GroupConsciousnessIndicator({
  selectedAgents,
  location = { lat: 37.7749, lon: -122.4194 },
  onOptimalSpeakerSuggestion,
  className = '',
}: GroupConsciousnessIndicatorProps) {
  const [groupHarmony, setGroupHarmony] = useState<any>(null)
  const [compatibilityMatrix, setCompatibilityMatrix] = useState<any[]>([])
  const [momentumFlow, setMomentumFlow] = useState<any>(null)
  const [consciousnessScore, setConsciousnessScore] = useState<any>(null)

  const { planetaryHour } = usePlanetaryHours({ location, refreshInterval: 60000 })

  useEffect(() => {
    if (selectedAgents.length < 2) return

    const agentIds = selectedAgents.map(agent => agent.id)
    const planetaryInfluences = planetaryHour ? [planetaryHour.planet] : ['Sun']
    const elementalTotals = { Fire: 5, Water: 5, Air: 5, Earth: 5 } // Mock for now

    // Calculate group harmony
    const harmony = GroupConsciousnessDynamics.calculateGroupHarmony(
      agentIds,
      planetaryInfluences,
      elementalTotals
    )
    setGroupHarmony(harmony)

    // Calculate pairwise compatibilities
    const compatibilities = []
    for (let i = 0; i < agentIds.length; i++) {
      for (let j = i + 1; j < agentIds.length; j++) {
        const compatibility = GroupConsciousnessDynamics.calculateCompatibility(
          agentIds[i],
          agentIds[j]
        )
        compatibilities.push(compatibility)
      }
    }
    setCompatibilityMatrix(compatibilities)

    // Calculate momentum flow
    const flow = GroupConsciousnessDynamics.calculateMomentumFlow(agentIds, elementalTotals)
    setMomentumFlow(flow)

    // Get consciousness score
    const score = GroupConsciousnessDynamics.getGroupConsciousnessScore(
      agentIds,
      planetaryHour?.planet || 'Sun',
      elementalTotals
    )
    setConsciousnessScore(score)
  }, [selectedAgents, planetaryHour])

  if (selectedAgents.length < 2) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Group Consciousness
          </CardTitle>
          <CardDescription>Select 2+ agents to see group dynamics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            Add more agents to activate group consciousness analysis
          </div>
        </CardContent>
      </Card>
    )
  }

  const getConsciousnessColor = (level: string) => {
    switch (level) {
      case 'transcendent':
        return 'text-purple-600 bg-purple-100 dark:bg-purple-950'
      case 'high':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-950'
      case 'moderate':
        return 'text-green-600 bg-green-100 dark:bg-green-950'
      case 'low':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-950'
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-950'
    }
  }

  const getMomentumIcon = (flow: string) => {
    switch (flow) {
      case 'accelerating':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'sustained':
        return <Activity className="h-4 w-4 text-blue-500" />
      case 'building':
        return <ArrowRight className="h-4 w-4 text-yellow-500" />
      case 'dispersing':
        return <Target className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  return (
    <Card
      className={`transition-all duration-300 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] hover:-translate-y-1 ${className}`}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Group Consciousness
        </CardTitle>
        <CardDescription>
          Real-time dynamics for {selectedAgents.length} consciousness agents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Consciousness Score */}
        {consciousnessScore && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="font-medium">Consciousness Level</span>
              </div>
              <Badge className={getConsciousnessColor(consciousnessScore.level)}>
                {consciousnessScore.level.toUpperCase()}
              </Badge>
            </div>
            <Progress value={consciousnessScore.score * 100} className="h-3" />
            <p className="text-sm text-muted-foreground">{consciousnessScore.description}</p>
          </div>
        )}

        {/* Group Harmony Metrics */}
        {groupHarmony && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Power Amplification</span>
              </div>
              <div className="text-lg font-bold">×{groupHarmony.powerAmplification.toFixed(2)}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {getMomentumIcon(groupHarmony.momentumFlow)}
                <span className="text-sm font-medium">Momentum</span>
              </div>
              <div className="text-sm capitalize">{groupHarmony.momentumFlow}</div>
            </div>
          </div>
        )}

        {/* Optimal Speaker */}
        {groupHarmony?.optimalSpeaker && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Optimal Speaker
                  </span>
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {groupHarmony.optimalSpeaker
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  has the strongest group resonance right now
                </div>
              </div>

              {onOptimalSpeakerSuggestion && (
                <Button
                  size="sm"
                  onClick={() => onOptimalSpeakerSuggestion(groupHarmony.optimalSpeaker)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Suggest
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Compatibility Matrix */}
        {compatibilityMatrix.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Agent Compatibility</div>
            <div className="space-y-1">
              {compatibilityMatrix.slice(0, 5).map((comp, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">
                    {comp.agentId1.split('-')[0]} ↔ {comp.agentId2.split('-')[0]}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        comp.compatibility > 0.8
                          ? 'border-green-500 text-green-700'
                          : comp.compatibility > 0.6
                            ? 'border-blue-500 text-blue-700'
                            : comp.compatibility > 0.4
                              ? 'border-yellow-500 text-yellow-700'
                              : 'border-red-500 text-red-700'
                      }`}
                    >
                      {comp.resonanceType}
                    </Badge>
                    <span className="font-mono w-8 text-right">
                      {(comp.compatibility * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Momentum Flow Visualization */}
        {momentumFlow && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Energy Flow Pattern</div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm capitalize">{momentumFlow.direction} Flow</span>
                <Badge variant="outline">
                  {(momentumFlow.intensity * 100).toFixed(0)}% Intensity
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">{momentumFlow.flowPattern}</div>

              {/* Elemental Balance Visualization */}
              <div className="grid grid-cols-4 gap-1 mt-3">
                {Object.entries(momentumFlow.elementalBalance).map(
                  ([element, value]: [string, any]) => (
                    <div key={element} className="text-center">
                      <div className="text-xs font-medium">{element}</div>
                      <div className="text-xs text-muted-foreground">
                        {(value * 100).toFixed(0)}%
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Synergy Windows */}
        {groupHarmony?.synergyWindows?.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Upcoming Synergy Windows</div>
            <div className="space-y-1">
              {groupHarmony.synergyWindows.slice(0, 3).map((window: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-xs p-2 bg-purple-50 dark:bg-purple-950/20 rounded"
                >
                  <Clock className="h-3 w-3 text-purple-600" />
                  <div className="flex-1">
                    <div className="font-medium">{window.description}</div>
                    <div className="text-muted-foreground">
                      {new Date(window.startTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' - '}
                      {new Date(window.endTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    ×{window.amplification.toFixed(1)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real-time Updates */}
        <div className="text-xs text-muted-foreground text-center">
          Updates every 60 seconds • Powered by Kinetics Backend
        </div>
      </CardContent>
    </Card>
  )
}
