'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Sparkles,
  Clock,
  Zap,
  TrendingUp,
  Users,
  Brain,
  Timer,
  Target,
  Lightbulb,
  Star,
  Activity,
  RefreshCw,
  Plus,
} from 'lucide-react'
import type { CraftedAgent } from '@/lib/agent-types'
import { getAgentKineticProfile } from '@/lib/agents/kinetic-profiles'

interface AgentRecommendation {
  agent: CraftedAgent
  score: number
  reasons: string[]
  kineticContext: {
    isOptimalTime: boolean
    compatibilityWithSelected: number
    consciousnessVelocity: number
    powerAlignment: number
  }
  recommendationType:
    | 'optimal_timing'
    | 'high_compatibility'
    | 'consciousness_growth'
    | 'complementary_wisdom'
    | 'momentum_synergy'
}

interface AgentRecommendationSystemProps {
  allAgents: CraftedAgent[]
  selectedAgents: CraftedAgent[]
  userLocation?: { lat: number; lon: number }
  onAgentSelect?: (agent: CraftedAgent) => void
  maxRecommendations?: number
  showReasonDetails?: boolean
}

export function AgentRecommendationSystem({
  allAgents,
  selectedAgents,
  userLocation,
  onAgentSelect,
  maxRecommendations = 6,
  showReasonDetails = true,
}: AgentRecommendationSystemProps) {
  const [recommendations, setRecommendations] = useState<AgentRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPlanetaryHour, setCurrentPlanetaryHour] = useState<string>('Sun')

  useEffect(() => {
    generateRecommendations()
  }, [selectedAgents, allAgents, userLocation])

  const generateRecommendations = async () => {
    setLoading(true)
    try {
      // Get current kinetic context
      const defaultLocation = { lat: 37.7749, lon: -122.4194 }
      const targetLocation = userLocation || defaultLocation

      const response = await fetch(
        `/api/alchm-kinetics?lat=${targetLocation.lat}&lon=${targetLocation.lon}&date=${new Date().toISOString().split('T')[0]}&includePlanetary=true`
      )

      let currentHour = 'Sun'
      if (response.ok) {
        const kinetics = await response.json()
        currentHour = kinetics.timing?.planetaryHours[0] || 'Sun'
        setCurrentPlanetaryHour(currentHour)
      }

      // Filter out already selected agents
      const selectedIds = new Set(selectedAgents.map(a => a.id))
      const availableAgents = allAgents.filter(agent => !selectedIds.has(agent.id))

      // Generate recommendations for each available agent
      const agentRecommendations: AgentRecommendation[] = []

      for (const agent of availableAgents) {
        const recommendation = await evaluateAgent(
          agent,
          selectedAgents,
          currentHour,
          targetLocation
        )
        if (recommendation.score > 0.3) {
          // Only include decent recommendations
          agentRecommendations.push(recommendation)
        }
      }

      // Sort by score and take top recommendations
      const sortedRecommendations = agentRecommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, maxRecommendations)

      setRecommendations(sortedRecommendations)
    } catch (error) {
      console.error('Failed to generate agent recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  const evaluateAgent = async (
    agent: CraftedAgent,
    selectedAgents: CraftedAgent[],
    planetaryHour: string,
    location: { lat: number; lon: number }
  ): Promise<AgentRecommendation> => {
    const profile = getAgentKineticProfile(agent.id)
    const reasons: string[] = []
    let score = 0.5 // Base score
    let recommendationType: AgentRecommendation['recommendationType'] = 'complementary_wisdom'

    // 1. Optimal timing evaluation
    const isOptimalTime = profile?.peak_hours.includes(planetaryHour) || false
    if (isOptimalTime) {
      score += 0.3
      reasons.push(`🌟 Peak consciousness time (${planetaryHour} hour)`)
      recommendationType = 'optimal_timing'
    }

    // 2. Compatibility with selected agents
    let avgCompatibility = 0.5
    if (selectedAgents.length > 0) {
      let totalCompatibility = 0
      let compatibilityCount = 0

      for (const selectedAgent of selectedAgents) {
        try {
          const response = await fetch(
            `/api/agent-evolution/compatibility?agent1=${agent.id}&agent2=${selectedAgent.id}&lat=${location.lat}&lon=${location.lon}`
          )
          if (response.ok) {
            const data = await response.json()
            totalCompatibility += data.compatibility.contextual
            compatibilityCount++
          }
        } catch (error) {
          // Fallback to basic compatibility calculation
          totalCompatibility += 0.5
          compatibilityCount++
        }
      }

      if (compatibilityCount > 0) {
        avgCompatibility = totalCompatibility / compatibilityCount
      }

      if (avgCompatibility > 0.8) {
        score += 0.25
        reasons.push('💫 Exceptional compatibility with selected agents')
        recommendationType = 'high_compatibility'
      } else if (avgCompatibility > 0.6) {
        score += 0.15
        reasons.push('🤝 Good compatibility with selected agents')
      }
    }

    // 3. Consciousness development potential
    const consciousnessVelocity = profile?.consciousness_rate || 0.5
    if (consciousnessVelocity > 0.8) {
      score += 0.2
      reasons.push('🚀 High consciousness development velocity')
      recommendationType = 'consciousness_growth'
    }

    // 4. Monica Constant evaluation
    if (agent.consciousness.monicaConstant > 5.0) {
      score += 0.15
      reasons.push(
        `⚗️ Legendary consciousness (MC: ${agent.consciousness.monicaConstant.toFixed(2)})`
      )
    } else if (agent.consciousness.monicaConstant > 4.0) {
      score += 0.1
      reasons.push(
        `✨ Advanced consciousness (MC: ${agent.consciousness.monicaConstant.toFixed(2)})`
      )
    }

    // 5. Complementary wisdom domains
    if (selectedAgents.length > 0) {
      const selectedWisdomDomains = new Set(selectedAgents.flatMap(a => a.abilities.wisdomDomains))
      const uniqueWisdom = agent.abilities.wisdomDomains.filter(
        domain => !selectedWisdomDomains.has(domain)
      )

      if (uniqueWisdom.length > 0) {
        score += uniqueWisdom.length * 0.05
        reasons.push(`🎯 Brings unique wisdom: ${uniqueWisdom.slice(0, 2).join(', ')}`)
        recommendationType = 'complementary_wisdom'
      }
    }

    // 6. Momentum synergy evaluation
    if (selectedAgents.length > 0 && profile) {
      const selectedMomentumTypes = selectedAgents
        .map(a => getAgentKineticProfile(a.id)?.momentum_type)
        .filter(Boolean)

      const hasMomentumSynergy = selectedMomentumTypes.some(type => {
        if (type === profile.momentum_type) return true
        if (type === 'sustained' && profile.momentum_type === 'building') return true
        if (type === 'oscillating' && profile.momentum_type === 'explosive') return true
        return false
      })

      if (hasMomentumSynergy) {
        score += 0.1
        reasons.push(`🌊 Perfect momentum synergy (${profile.momentum_type})`)
        recommendationType = 'momentum_synergy'
      }
    }

    return {
      agent,
      score: Math.min(score, 1),
      reasons,
      kineticContext: {
        isOptimalTime,
        compatibilityWithSelected: avgCompatibility,
        consciousnessVelocity,
        powerAlignment: isOptimalTime ? 0.9 : 0.5,
      },
      recommendationType,
    }
  }

  const getRecommendationTypeIcon = (type: AgentRecommendation['recommendationType']) => {
    switch (type) {
      case 'optimal_timing':
        return Timer
      case 'high_compatibility':
        return Users
      case 'consciousness_growth':
        return TrendingUp
      case 'complementary_wisdom':
        return Lightbulb
      case 'momentum_synergy':
        return Activity
      default:
        return Star
    }
  }

  const getRecommendationTypeColor = (type: AgentRecommendation['recommendationType']) => {
    switch (type) {
      case 'optimal_timing':
        return 'text-purple-600'
      case 'high_compatibility':
        return 'text-blue-600'
      case 'consciousness_growth':
        return 'text-green-600'
      case 'complementary_wisdom':
        return 'text-orange-600'
      case 'momentum_synergy':
        return 'text-pink-600'
      default:
        return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm text-gray-600">Analyzing consciousness compatibility...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Brain className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
            No optimal recommendations found
          </h3>
          <p className="text-sm text-gray-600">
            Try selecting different agents or check back during optimal planetary hours
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          Kinetic Consciousness Recommendations
          <Badge variant="outline" className="ml-auto">
            {currentPlanetaryHour} Hour
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((rec, index) => {
          const TypeIcon = getRecommendationTypeIcon(rec.recommendationType)
          const typeColor = getRecommendationTypeColor(rec.recommendationType)

          return (
            <div
              key={rec.agent.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                    <TypeIcon className={`h-4 w-4 ${typeColor}`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {rec.agent.name}
                    </h3>
                    <p className="text-sm text-gray-600">{rec.agent.title}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Badge
                    variant="outline"
                    className={
                      rec.score > 0.8
                        ? 'text-green-700 border-green-200'
                        : rec.score > 0.6
                          ? 'text-blue-700 border-blue-200'
                          : 'text-gray-700'
                    }
                  >
                    {Math.round(rec.score * 100)}% match
                  </Badge>
                  {rec.kineticContext.isOptimalTime && (
                    <Badge className="bg-purple-100 text-purple-700">
                      <Timer className="h-3 w-3 mr-1" />
                      Peak Time
                    </Badge>
                  )}
                </div>
              </div>

              {/* Kinetic Context Indicators */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-1 text-xs">
                        <Clock className="h-3 w-3 text-gray-500" />
                        <span>{rec.kineticContext.isOptimalTime ? 'Optimal' : 'Standard'}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Current timing alignment with agent's peak hours</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-1 text-xs">
                        <Users className="h-3 w-3 text-gray-500" />
                        <span>
                          {Math.round(rec.kineticContext.compatibilityWithSelected * 100)}%
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Compatibility with currently selected agents</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-1 text-xs">
                        <TrendingUp className="h-3 w-3 text-gray-500" />
                        <span>{Math.round(rec.kineticContext.consciousnessVelocity * 100)}%</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Consciousness development velocity</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-1 text-xs">
                        <Zap className="h-3 w-3 text-gray-500" />
                        <span>{Math.round(rec.kineticContext.powerAlignment * 100)}%</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Current power alignment strength</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Recommendation Reasons */}
              {showReasonDetails && rec.reasons.length > 0 && (
                <div className="space-y-1 mb-3">
                  {rec.reasons.slice(0, 3).map((reason, idx) => (
                    <div key={idx} className="text-xs text-gray-700 bg-gray-50 rounded px-2 py-1">
                      {reason}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAgentSelect?.(rec.agent)}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Select Agent
                </Button>
              </div>
            </div>
          )
        })}

        {/* Refresh Button */}
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={generateRecommendations}
            disabled={loading}
            className="w-full flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Recommendations
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Quick recommendations component for sidebar or compact display
interface QuickRecommendationsProps {
  allAgents: CraftedAgent[]
  selectedAgents: CraftedAgent[]
  onAgentSelect?: (agent: CraftedAgent) => void
  maxItems?: number
}

export function QuickRecommendations({
  allAgents,
  selectedAgents,
  onAgentSelect,
  maxItems = 3,
}: QuickRecommendationsProps) {
  const [topRecommendations, setTopRecommendations] = useState<AgentRecommendation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    generateQuickRecommendations()
  }, [selectedAgents, allAgents])

  const generateQuickRecommendations = async () => {
    setLoading(true)
    try {
      // Simplified recommendation logic for quick display
      const selectedIds = new Set(selectedAgents.map(a => a.id))
      const availableAgents = allAgents.filter(agent => !selectedIds.has(agent.id))

      const quickRecs = availableAgents
        .map(agent => {
          const profile = getAgentKineticProfile(agent.id)
          let score = agent.consciousness.monicaConstant / 10 // Base on Monica Constant

          if (profile?.consciousness_rate && profile.consciousness_rate > 0.8) {
            score += 0.2
          }

          return {
            agent,
            score,
            reasons: [`MC: ${agent.consciousness.monicaConstant.toFixed(2)}`],
            kineticContext: {
              isOptimalTime: false,
              compatibilityWithSelected: 0.5,
              consciousnessVelocity: profile?.consciousness_rate || 0.5,
              powerAlignment: 0.5,
            },
            recommendationType: 'complementary_wisdom' as const,
          }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, maxItems)

      setTopRecommendations(quickRecs)
    } catch (error) {
      console.error('Quick recommendations failed:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
        <span className="text-xs text-gray-600">Loading recommendations...</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {topRecommendations.map((rec, index) => (
        <div
          key={rec.agent.id}
          className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              #{index + 1}
            </Badge>
            <div className="text-sm">
              <div className="font-medium">{rec.agent.name}</div>
              <div className="text-xs text-gray-600">{rec.reasons[0]}</div>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAgentSelect?.(rec.agent)}
            className="h-6 w-6 p-0"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}
