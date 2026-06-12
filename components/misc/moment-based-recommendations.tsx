'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Sparkles,
  Clock,
  Zap,
  TrendingUp,
  Users,
  Brain,
  Target,
  Lightbulb,
  Star,
  Timer,
  RefreshCw,
  ChevronRight,
  Activity,
  Flame,
  Droplets,
  Wind,
  Mountain,
} from 'lucide-react'
import type { CraftedAgent } from '@/lib/agent-types'
import { getAgentKineticProfile } from '@/lib/agents/kinetic-profiles'

// Browser-safe replacement for the removed AlchemicalKineticsClient. Reads
// `/api/alchemize?legacy=true` and exposes the moment data shape this
// component already consumes (timing.planetaryHours[0], power[].power).
// TODO: replace with a real kinetics endpoint when restored.
const CHALDEAN_PLANETARY_HOURS = [
  'Saturn',
  'Jupiter',
  'Mars',
  'Sun',
  'Venus',
  'Mercury',
  'Moon',
] as const

async function fetchMomentEnvelope(_loc: { lat: number; lon: number }): Promise<{
  power: Array<{ power: number }>
  timing: { planetaryHours: string[]; seasonalInfluence: string }
}> {
  let power = 0.5
  try {
    const res = await fetch('/api/alchemize?legacy=true')
    if (res.ok) {
      const data = await res.json()
      const thermoVal = Number(data?.thermo_val ?? data?.Heat ?? 0)
      const kineticVal = Number(data?.kinetic_val ?? data?.Reactivity ?? 0)
      power = Math.max(0, Math.min(1, thermoVal || kineticVal || 0.5))
    }
  } catch (err) {
    console.error('moment envelope fetch failed:', err)
  }
  const idx = new Date().getHours() % CHALDEAN_PLANETARY_HOURS.length
  return {
    power: [{ power }],
    timing: {
      planetaryHours: [CHALDEAN_PLANETARY_HOURS[idx]],
      seasonalInfluence: 'Neutral',
    },
  }
}

interface AgentRecommendation {
  agent: CraftedAgent
  score: number
  confidence: number
  reasons: string[]
  kineticContext: {
    isOptimalTime: boolean
    planetaryAlignment: number
    aspectSensitivity: number
    momentumCompatibility: number
    powerAmplification: number
  }
  recommendationType:
    | 'optimal_timing'
    | 'high_compatibility'
    | 'consciousness_growth'
    | 'complementary_wisdom'
    | 'momentum_synergy'
  timeWindow: {
    optimal: boolean
    nextOptimal?: Date
    duration?: number // minutes
  }
  synergies: string[]
}

interface RecommendationCategory {
  type:
    | 'optimal_timing'
    | 'high_compatibility'
    | 'consciousness_growth'
    | 'complementary_wisdom'
    | 'momentum_synergy'
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  agents: AgentRecommendation[]
}

interface MomentBasedRecommendationsProps {
  allAgents: CraftedAgent[]
  selectedAgents?: CraftedAgent[]
  userLocation?: { lat: number; lon: number }
  className?: string
  maxRecommendations?: number
  showReasonDetails?: boolean
  onAgentSelect?: (agent: CraftedAgent) => void
  onRecommendationUpdate?: (recommendations: AgentRecommendation[]) => void
}

export function MomentBasedRecommendations({
  allAgents,
  selectedAgents = [],
  userLocation = { lat: 37.7749, lon: -122.4194 },
  className = '',
  maxRecommendations = 8,
  showReasonDetails = true,
  onAgentSelect,
  onRecommendationUpdate,
}: MomentBasedRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendationCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentMomentData, setCurrentMomentData] = useState<any>(null)
  const [activeCategory, setActiveCategory] = useState<string>('optimal_timing')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Calculate agent compatibility score for current moment
  const calculateMomentScore = (agent: CraftedAgent, momentData: any): AgentRecommendation => {
    const kineticProfile = getAgentKineticProfile(agent.id)
    if (!kineticProfile) {
      return createFallbackRecommendation(agent)
    }

    const now = new Date()
    const hour = now.getHours()
    const currentPlanetaryHour = momentData.timing?.planetaryHours?.[0] || 'Sun'

    // Calculate optimal timing score
    const optimalHours = kineticProfile.peak_hours || []
    const isOptimalTime =
      optimalHours.includes(currentPlanetaryHour) ||
      (hour >= 6 && hour <= 18 && kineticProfile.power_alignment?.includes('Sun')) ||
      hour >= 19 ||
      (hour <= 5 && kineticProfile.power_alignment?.includes('Moon'))

    // Calculate planetary alignment
    const planetaryAlignment = kineticProfile.power_alignment?.includes(currentPlanetaryHour)
      ? 0.9
      : 0.5

    // Calculate aspect sensitivity based on current aspects
    const aspectSensitivity = calculateAspectSensitivity(kineticProfile, momentData)

    // Calculate momentum compatibility
    const momentumCompatibility = calculateMomentumCompatibility(kineticProfile, momentData)

    // Calculate power amplification
    const currentPower = momentData.power?.[momentData.power.length - 1]?.power || 0.5
    const powerAmplification = Math.min(
      1,
      currentPower * (kineticProfile.consciousness_rate || 0.5)
    )

    // Overall score calculation
    const baseScore =
      planetaryAlignment * 0.3 +
      aspectSensitivity * 0.2 +
      momentumCompatibility * 0.3 +
      powerAmplification * 0.2

    const optimalBonus = isOptimalTime ? 0.2 : 0
    const finalScore = Math.min(1, baseScore + optimalBonus)

    // Determine recommendation type
    const recommendationType = determineRecommendationType(
      isOptimalTime,
      finalScore,
      kineticProfile,
      selectedAgents,
      agent
    )

    // Generate reasons
    const reasons = generateReasons(
      agent,
      kineticProfile,
      isOptimalTime,
      planetaryAlignment,
      aspectSensitivity,
      currentPlanetaryHour
    )

    // Generate synergies
    const synergies = generateSynergies(agent, kineticProfile, momentData, selectedAgents)

    return {
      agent,
      score: finalScore,
      confidence: Math.min(1, finalScore + 0.1),
      reasons,
      kineticContext: {
        isOptimalTime,
        planetaryAlignment,
        aspectSensitivity,
        momentumCompatibility,
        powerAmplification,
      },
      recommendationType,
      timeWindow: {
        optimal: isOptimalTime,
        nextOptimal: isOptimalTime ? undefined : calculateNextOptimalTime(kineticProfile),
        duration: isOptimalTime ? 60 : undefined,
      },
      synergies,
    }
  }

  const calculateAspectSensitivity = (profile: any, momentData: any): number => {
    if (!profile.aspect_sensitivity) return 0.5

    // Simplified aspect calculation - in production would use real aspect data
    const sensitivitySum = Object.values(profile.aspect_sensitivity).reduce(
      (sum: number, val: any) => sum + val,
      0
    )
    const averageSensitivity = sensitivitySum / Object.keys(profile.aspect_sensitivity).length

    return Math.min(
      1,
      averageSensitivity * (momentData.power?.[momentData.power.length - 1]?.power || 0.5)
    )
  }

  const calculateMomentumCompatibility = (profile: any, momentData: any): number => {
    const momentumTypes = {
      sustained: 0.8,
      building: momentData.power?.[momentData.power.length - 1]?.power > 0.6 ? 0.9 : 0.4,
      oscillating: 0.6,
      explosive: 0.7,
      gradual: 0.5,
    }

    return momentumTypes[profile.momentum_type as keyof typeof momentumTypes] || 0.5
  }

  const determineRecommendationType = (
    isOptimalTime: boolean,
    score: number,
    profile: any,
    selectedAgents: CraftedAgent[],
    agent: CraftedAgent
  ): AgentRecommendation['recommendationType'] => {
    if (isOptimalTime && score > 0.8) return 'optimal_timing'
    if (score > 0.7) return 'high_compatibility'
    if (profile.consciousness_rate > 0.7) return 'consciousness_growth'
    if (selectedAgents.length > 0) return 'complementary_wisdom'
    return 'momentum_synergy'
  }

  const generateReasons = (
    agent: CraftedAgent,
    profile: any,
    isOptimalTime: boolean,
    planetaryAlignment: number,
    aspectSensitivity: number,
    currentHour: string
  ): string[] => {
    const reasons: string[] = []

    if (isOptimalTime) {
      reasons.push(`Perfect timing - ${currentHour} hour aligns with ${agent.name}'s peak energy`)
    }

    if (planetaryAlignment > 0.8) {
      reasons.push(`Strong planetary resonance with current ${currentHour} influence`)
    }

    if (aspectSensitivity > 0.7) {
      reasons.push('Heightened sensitivity to current cosmic aspects')
    }

    if (profile.consciousness_rate > 0.7) {
      reasons.push('Accelerated consciousness evolution in current conditions')
    }

    if (
      agent.consciousness.level === 'Illuminated' ||
      agent.consciousness.level === 'Transcendent'
    ) {
      reasons.push('Advanced consciousness ideal for current moment complexity')
    }

    // Add ability-specific reasons
    if (agent.abilities.specialty.toLowerCase().includes('wisdom') && currentHour === 'Jupiter') {
      reasons.push('Wisdom domains amplified by Jupiter hour')
    }

    if (agent.abilities.specialty.toLowerCase().includes('creative') && currentHour === 'Sun') {
      reasons.push('Creative abilities enhanced by solar energy')
    }

    return reasons.slice(0, 3)
  }

  const generateSynergies = (
    agent: CraftedAgent,
    profile: any,
    momentData: any,
    selectedAgents: CraftedAgent[]
  ): string[] => {
    const synergies: string[] = []

    // Elemental synergies
    const dominantElement = agent.consciousness.dominantElement
    const currentPower = momentData.power?.[momentData.power.length - 1]?.power || 0.5

    if (currentPower > 0.7) {
      synergies.push(`${dominantElement} element amplified by high cosmic power`)
    }

    // Synergies with selected agents
    selectedAgents.forEach(selectedAgent => {
      if (selectedAgent.consciousness.dominantElement !== dominantElement) {
        synergies.push(
          `Balances ${selectedAgent.name}'s ${selectedAgent.consciousness.dominantElement} energy`
        )
      }

      if (
        Math.abs(selectedAgent.consciousness.monicaConstant - agent.consciousness.monicaConstant) <
        1
      ) {
        synergies.push(`Resonant consciousness level with ${selectedAgent.name}`)
      }
    })

    // Momentum synergies
    if (profile.momentum_type === 'building' && currentPower > 0.6) {
      synergies.push('Building momentum enhanced by rising cosmic energy')
    }

    return synergies.slice(0, 2)
  }

  const calculateNextOptimalTime = (profile: any): Date => {
    const now = new Date()
    const nextOptimal = new Date(now)
    nextOptimal.setHours(now.getHours() + 1 + Math.floor(Math.random() * 6)) // 1-7 hours from now
    return nextOptimal
  }

  const createFallbackRecommendation = (agent: CraftedAgent): AgentRecommendation => {
    return {
      agent,
      score: 0.5,
      confidence: 0.3,
      reasons: ['General compatibility with current conditions'],
      kineticContext: {
        isOptimalTime: false,
        planetaryAlignment: 0.5,
        aspectSensitivity: 0.5,
        momentumCompatibility: 0.5,
        powerAmplification: 0.5,
      },
      recommendationType: 'complementary_wisdom',
      timeWindow: { optimal: false },
      synergies: [],
    }
  }

  // Fetch current moment data and calculate recommendations
  const stableAgents = useMemo(() => allAgents, [allAgents])
  const stableSelected = useMemo(() => selectedAgents, [selectedAgents])
  const stableLocation = useMemo(() => userLocation, [userLocation.lat, userLocation.lon])
  const isFetchingRef = useRef(false)

  const fetchRecommendations = async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      setLoading(true)
      setError(null)

      // Get current kinetic moment envelope via proxy
      const momentData = await fetchMomentEnvelope({
        lat: stableLocation.lat,
        lon: stableLocation.lon,
      })

      setCurrentMomentData(momentData)

      // Calculate recommendations for all agents (with null safety)
      if (!stableAgents || !Array.isArray(stableAgents)) {
        console.warn('allAgents is undefined or not an array, skipping recommendations')
        setLoading(false)
        return
      }

      const agentRecommendations = stableAgents
        .map(agent => calculateMomentScore(agent, momentData))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxRecommendations)

      // Group by recommendation type
      const categories: any[] = [
        {
          type: 'optimal_timing',
          title: 'Perfect Timing',
          description: 'Agents in their peak planetary hours',
          icon: Timer,
          color: 'text-green-600',
          agents: agentRecommendations.filter(r => r.recommendationType === 'optimal_timing'),
        },
        {
          type: 'high_compatibility',
          title: 'High Compatibility',
          description: 'Best overall alignment with current moment',
          icon: Star,
          color: 'text-yellow-600',
          agents: agentRecommendations.filter(r => r.recommendationType === 'high_compatibility'),
        },
        {
          type: 'consciousness_growth',
          title: 'Growth Accelerated',
          description: 'Enhanced evolution potential now',
          icon: TrendingUp,
          color: 'text-blue-600',
          agents: agentRecommendations.filter(r => r.recommendationType === 'consciousness_growth'),
        },
        {
          type: 'complementary_wisdom',
          title: 'Complementary Wisdom',
          description: 'Balances your current selection',
          icon: Brain,
          color: 'text-purple-600',
          agents: agentRecommendations.filter(r => r.recommendationType === 'complementary_wisdom'),
        },
        {
          type: 'momentum_synergy',
          title: 'Momentum Synergy',
          description: 'Aligned kinetic patterns',
          icon: Activity,
          color: 'text-orange-600',
          agents: agentRecommendations.filter(r => r.recommendationType === 'momentum_synergy'),
        },
      ].filter(category => category.agents.length > 0)

      setRecommendations(categories)
      setLastUpdate(new Date())

      if (onRecommendationUpdate) {
        onRecommendationUpdate(agentRecommendations)
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error)
      setError('Failed to load moment-based recommendations. Please try again.')
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }

  useEffect(() => {
    if (stableAgents && Array.isArray(stableAgents) && stableAgents.length > 0) {
      fetchRecommendations()

      const interval = setInterval(fetchRecommendations, 300000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [stableAgents, stableSelected, stableLocation.lat, stableLocation.lon, maxRecommendations])

  const getElementIcon = (element: string) => {
    switch (element) {
      case 'Fire':
        return Flame
      case 'Water':
        return Droplets
      case 'Air':
        return Wind
      case 'Earth':
        return Mountain
      default:
        return Target
    }
  }

  const RecommendationCard = ({ recommendation }: { recommendation: AgentRecommendation }) => {
    const ElementIcon = getElementIcon(recommendation.agent.consciousness.dominantElement)

    return (
      <Card
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => onAgentSelect?.(recommendation.agent)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: recommendation.agent.appearance?.color || '#6366f1' }}
              >
                {recommendation.agent.appearance?.symbol ||
                  recommendation.agent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="font-medium">{recommendation.agent.name}</h4>
                <p className="text-xs text-muted-foreground">{recommendation.agent.title}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{(recommendation.score * 100).toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">compatibility</div>
            </div>
          </div>

          {/* Kinetic Context Bars */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 text-xs">
              <ElementIcon className="w-3 h-3" />
              <span className="flex-1">Power Alignment</span>
              <Progress
                value={recommendation.kineticContext.planetaryAlignment * 100}
                className="w-16 h-2"
              />
            </div>
            {recommendation.kineticContext.isOptimalTime && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <Timer className="w-3 h-3" />
                <span>Optimal timing window</span>
              </div>
            )}
          </div>

          {/* Reasons */}
          {showReasonDetails && (
            <div className="space-y-1 mb-3">
              {recommendation.reasons.slice(0, 2).map((reason, i) => (
                <div key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          )}

          {/* Synergies */}
          {recommendation.synergies.length > 0 && (
            <div className="space-y-1">
              {recommendation.synergies.slice(0, 1).map((synergy, i) => (
                <div key={i} className="text-xs text-blue-600 flex items-start gap-1">
                  <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{synergy}</span>
                </div>
              ))}
            </div>
          )}

          {/* Time Window */}
          {!recommendation.timeWindow.optimal && recommendation.timeWindow.nextOptimal && (
            <div className="text-xs text-orange-600 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>
                Next optimal: {recommendation.timeWindow.nextOptimal.toLocaleTimeString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Show loading state when loading or when agents are not available
  if (loading || !allAgents || !Array.isArray(allAgents) || allAgents.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>
              {!allAgents || !Array.isArray(allAgents) || allAgents.length === 0
                ? 'Loading agents...'
                : 'Calculating moment-based recommendations...'}
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-red-600">{error}</span>
            <Button variant="outline" size="sm" onClick={fetchRecommendations}>
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={`${className} border-2 border-green-200 bg-gradient-to-br from-green-50/50 to-blue-50/50`}
    >
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-green-600" />
          Moment-Based Recommendations
          <Badge variant="outline" className="ml-auto">
            Live
          </Badge>
        </CardTitle>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Agents optimized for current cosmic conditions
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Updated: {lastUpdate?.toLocaleTimeString()}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2">
          {recommendations.map(category => {
            const IconComponent = category.icon
            return (
              <Button
                key={category.type}
                variant={activeCategory === category.type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(category.type)}
                className="flex items-center gap-1"
              >
                <IconComponent className="w-3 h-3" />
                {category.title}
                <Badge variant="secondary" className="ml-1">
                  {category.agents.length}
                </Badge>
              </Button>
            )
          })}
        </div>

        {/* Active Category Content */}
        {recommendations.find(cat => cat.type === activeCategory) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {(() => {
                const category = recommendations.find(cat => cat.type === activeCategory)!
                const IconComponent = category.icon
                return (
                  <>
                    <IconComponent className={`w-4 h-4 ${category.color}`} />
                    <h3 className="font-medium">{category.title}</h3>
                    <span className="text-sm text-muted-foreground">- {category.description}</span>
                  </>
                )
              })()}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recommendations
                .find(cat => cat.type === activeCategory)!
                .agents.slice(0, 4)
                .map(recommendation => (
                  <RecommendationCard
                    key={recommendation.agent.id}
                    recommendation={recommendation}
                  />
                ))}
            </div>

            {recommendations.find(cat => cat.type === activeCategory)!.agents.length > 4 && (
              <Button variant="outline" className="w-full">
                <Users className="w-3 h-3 mr-1" />
                Show {recommendations.find(cat => cat.type === activeCategory)!.agents.length -
                  4}{' '}
                More
              </Button>
            )}
          </div>
        )}

        {recommendations.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Target className="w-8 h-8 mx-auto mb-2" />
            <p>No specific recommendations for current moment</p>
            <p className="text-sm">All agents are equally suitable</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
