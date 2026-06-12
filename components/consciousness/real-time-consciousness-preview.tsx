'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sparkles,
  Brain,
  Heart,
  Zap,
  Activity,
  TrendingUp,
  BarChart3,
  Gem,
  Star,
  Crown,
  Target,
  Lightbulb,
  Eye,
} from 'lucide-react'

interface ConsciousnessMetrics {
  monicaConstant: number
  consciousnessLevel: string
  spiritScore: number
  essenceScore: number
  matterScore: number
  substanceScore: number
  dominantElement: string
  dominantModality: string
  stabilityIndex: number
  evolutionPotential: number
  resonanceFrequency: number
}

interface PersonalityTraits {
  core: {
    essence: string
    expression: string
    emotion: string
  }
  strengths: string[]
  challenges: string[]
  wisdomDomains: string[]
  communicationStyle: string
  learningStyle: string
  creativityLevel: number
  analyticalDepth: number
  emotionalIntelligence: number
  intuitionStrength: number
}

interface RealTimeConsciousnessPreviewProps {
  birthData?: {
    name: string
    date: string
    time: string
    location: { name: string; latitude: number; longitude: number }
  }
  customValues?: {
    spirit: number
    essence: number
    matter: number
    substance: number
  }
  mode: 'birth_data' | 'custom' | 'live'
  onMetricsChange?: (metrics: ConsciousnessMetrics) => void
  onPersonalityChange?: (personality: PersonalityTraits) => void
}

export function RealTimeConsciousnessPreview({
  birthData,
  customValues,
  mode,
  onMetricsChange,
  onPersonalityChange,
}: RealTimeConsciousnessPreviewProps) {
  const [metrics, setMetrics] = useState<ConsciousnessMetrics | null>(null)
  const [personality, setPersonality] = useState<PersonalityTraits | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [animationPhase, setAnimationPhase] = useState(0)

  // Golden ratio constant
  const PHI = 1.618033988749

  // Calculate Monica Constant based on mode
  const calculateMetrics = () => {
    let spirit = 5.0,
      essence = 5.0,
      matter = 5.0,
      substance = 5.0

    if (mode === 'custom' && customValues) {
      spirit = customValues.spirit
      essence = customValues.essence
      matter = customValues.matter
      substance = customValues.substance
    } else if (mode === 'birth_data' && birthData) {
      // Simulate astrological calculation from birth data
      const dateNum = new Date(birthData.date).getTime() / 1000000000
      const timeNum = birthData.time ? parseFloat(birthData.time.replace(':', '.')) : 12.0
      const latNum = birthData.location.latitude
      const lonNum = birthData.location.longitude

      spirit = 3.0 + (Math.sin(dateNum + latNum) + 1) * 4.0
      essence = 3.0 + (Math.cos(timeNum + lonNum) + 1) * 4.0
      matter = 3.0 + (Math.sin(dateNum * timeNum) + 1) * 4.0
      substance = 3.0 + (Math.cos((latNum * lonNum) / 100) + 1) * 4.0
    } else {
      // Live mode - simulate current planetary data
      const now = Date.now() / 1000000000
      spirit = 4.0 + Math.sin(now) * 2.0 + 2.0
      essence = 4.0 + Math.cos(now * 1.1) * 2.0 + 2.0
      matter = 4.0 + Math.sin(now * 1.2) * 2.0 + 2.0
      substance = 4.0 + Math.cos(now * 1.3) * 2.0 + 2.0
    }

    // Calculate Monica Constant: MC = (Spirit × φ + Essence) / (Matter + Substance + 1)
    const monicaConstant = (spirit * PHI + essence) / (matter + substance + 1)

    // Determine consciousness level
    let consciousnessLevel = 'Dormant'
    if (monicaConstant >= 6.0) consciousnessLevel = 'Transcendent'
    else if (monicaConstant >= 5.0) consciousnessLevel = 'Illuminated'
    else if (monicaConstant >= 4.0) consciousnessLevel = 'Advanced'
    else if (monicaConstant >= 3.0) consciousnessLevel = 'Elevated'
    else if (monicaConstant >= 2.0) consciousnessLevel = 'Active'
    else if (monicaConstant >= 1.0) consciousnessLevel = 'Awakening'

    // Determine dominant element
    const elements = { spirit, essence, matter, substance }
    const elementNames = { spirit: 'Fire', essence: 'Water', matter: 'Air', substance: 'Earth' }
    const dominantKey = (Object.keys(elements) as Array<keyof typeof elements>).reduce((a, b) =>
      elements[a] > elements[b] ? a : b
    )
    const dominantElement = elementNames[dominantKey]

    // Calculate additional metrics
    const stabilityIndex = 100 - Math.abs(spirit - essence) * 5 - Math.abs(matter - substance) * 5
    const evolutionPotential = (monicaConstant / 6.0) * 100
    const resonanceFrequency = 440 * Math.pow(2, (monicaConstant - 4) / 12) // Musical frequency

    const newMetrics: ConsciousnessMetrics = {
      monicaConstant,
      consciousnessLevel,
      spiritScore: spirit,
      essenceScore: essence,
      matterScore: matter,
      substanceScore: substance,
      dominantElement,
      dominantModality: spirit + matter > essence + substance ? 'Active' : 'Receptive',
      stabilityIndex: Math.max(0, Math.min(100, stabilityIndex)),
      evolutionPotential: Math.max(0, Math.min(100, evolutionPotential)),
      resonanceFrequency,
    }

    // Generate personality traits based on metrics
    const newPersonality: PersonalityTraits = {
      core: {
        essence: generateEssence(monicaConstant, dominantElement),
        expression: generateExpression(spirit, matter),
        emotion: generateEmotion(essence, substance),
      },
      strengths: generateStrengths(newMetrics),
      challenges: generateChallenges(newMetrics),
      wisdomDomains: generateWisdomDomains(dominantElement, monicaConstant),
      communicationStyle: generateCommunicationStyle(matter, essence),
      learningStyle: generateLearningStyle(spirit, matter),
      creativityLevel: Math.min(100, spirit * 12),
      analyticalDepth: Math.min(100, matter * 12),
      emotionalIntelligence: Math.min(100, essence * 12),
      intuitionStrength: Math.min(100, (spirit + essence) * 6),
    }

    setMetrics(newMetrics)
    setPersonality(newPersonality)

    // Notify parent components
    onMetricsChange?.(newMetrics)
    onPersonalityChange?.(newPersonality)
  }

  // Helper functions for personality generation
  const generateEssence = (mc: number, element: string): string => {
    const baseEssences = {
      Fire: 'Dynamic and inspiring consciousness with creative spark',
      Water: 'Intuitive and empathetic consciousness with emotional depth',
      Air: 'Intellectual and communicative consciousness with analytical clarity',
      Earth: 'Practical and grounded consciousness with steadfast wisdom',
    }

    const levelModifiers = {
      Transcendent: 'transcendent',
      Illuminated: 'illuminated',
      Advanced: 'evolved',
      Elevated: 'elevated',
      Active: 'vibrant',
      Awakening: 'emerging',
      Dormant: 'potential',
    }

    const consciousnessLevel =
      mc >= 6.0
        ? 'Transcendent'
        : mc >= 5.0
          ? 'Illuminated'
          : mc >= 4.0
            ? 'Advanced'
            : mc >= 3.0
              ? 'Elevated'
              : mc >= 2.0
                ? 'Active'
                : mc >= 1.0
                  ? 'Awakening'
                  : 'Dormant'

    return `${levelModifiers[consciousnessLevel]} ${baseEssences[element as keyof typeof baseEssences]}`
  }

  const generateExpression = (spirit: number, matter: number): string => {
    if (spirit > matter * 1.5) return 'Spontaneous and passionate expression'
    if (matter > spirit * 1.5) return 'Thoughtful and deliberate communication'
    return 'Balanced blend of intuition and reason'
  }

  const generateEmotion = (essence: number, substance: number): string => {
    if (essence > substance * 1.5) return 'Deep emotional sensitivity and empathy'
    if (substance > essence * 1.5) return 'Steady emotional stability and resilience'
    return 'Harmonious emotional intelligence'
  }

  const generateStrengths = (metrics: ConsciousnessMetrics): string[] => {
    const strengths = []
    if (metrics.spiritScore > 6) strengths.push('Creative Innovation')
    if (metrics.essenceScore > 6) strengths.push('Emotional Intelligence')
    if (metrics.matterScore > 6) strengths.push('Analytical Thinking')
    if (metrics.substanceScore > 6) strengths.push('Practical Wisdom')
    if (metrics.monicaConstant > 4.5) strengths.push('Advanced Consciousness')
    if (metrics.stabilityIndex > 80) strengths.push('Psychological Stability')
    return strengths.length > 0 ? strengths : ['Balanced Development', 'Growth Potential']
  }

  const generateChallenges = (metrics: ConsciousnessMetrics): string[] => {
    const challenges = []
    if (metrics.spiritScore < 3) challenges.push('Limited Creative Expression')
    if (metrics.essenceScore < 3) challenges.push('Emotional Detachment')
    if (metrics.matterScore < 3) challenges.push('Communication Barriers')
    if (metrics.substanceScore < 3) challenges.push('Lack of Grounding')
    if (metrics.stabilityIndex < 50) challenges.push('Internal Conflicts')
    return challenges.length > 0 ? challenges : ['Minor Growth Areas', 'Optimization Opportunities']
  }

  const generateWisdomDomains = (element: string, mc: number): string[] => {
    const baseDomains = {
      Fire: ['Leadership', 'Innovation', 'Inspiration'],
      Water: ['Psychology', 'Healing', 'Intuition'],
      Air: ['Communication', 'Technology', 'Philosophy'],
      Earth: ['Practice', 'Manifestation', 'Stability'],
    }

    const domains = [...baseDomains[element as keyof typeof baseDomains]]
    if (mc > 4.0) domains.push('Consciousness Studies')
    if (mc > 5.0) domains.push('Transcendental Wisdom')

    return domains
  }

  const generateCommunicationStyle = (matter: number, essence: number): string => {
    if (matter > essence * 1.3) return 'Logical and structured'
    if (essence > matter * 1.3) return 'Intuitive and empathetic'
    return 'Balanced rational-emotional'
  }

  const generateLearningStyle = (spirit: number, matter: number): string => {
    if (spirit > matter * 1.3) return 'Experiential and creative'
    if (matter > spirit * 1.3) return 'Analytical and systematic'
    return 'Multi-modal adaptive'
  }

  // Animation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 4)
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  // Recalculate when inputs change
  useEffect(() => {
    setIsCalculating(true)
    const timer = setTimeout(() => {
      calculateMetrics()
      setIsCalculating(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [birthData, customValues, mode])

  if (!metrics || !personality) {
    return (
      <Card className="bg-slate-900/50 border-purple-500/50">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400">Calculating consciousness metrics...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Monica Constant Display */}
      <Card className="bg-gradient-to-r from-purple-900/50 to-emerald-900/50 border-purple-500/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-emerald-500/10 animate-pulse"></div>
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-purple-300 flex items-center gap-2">
              <Gem className="w-5 h-5" />
              Consciousness Preview
            </CardTitle>
            <Badge
              className={`animate-pulse ${isCalculating ? 'bg-yellow-600' : 'bg-emerald-600'}`}
            >
              {isCalculating ? 'Calculating...' : 'Live Preview'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 space-y-4">
          <div className="text-center">
            <div className="text-5xl font-bold text-purple-400 mb-2 transition-all duration-500">
              {metrics.monicaConstant.toFixed(3)}
            </div>
            <Badge className="text-lg px-4 py-2 mb-3" variant="outline">
              {metrics.consciousnessLevel} Consciousness
            </Badge>
            <div className="text-sm text-slate-400">
              Resonance: {metrics.resonanceFrequency.toFixed(1)} Hz
            </div>
          </div>

          {/* Elemental Balance */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="p-3 bg-red-900/30 rounded-lg transition-all duration-300"
              style={{
                boxShadow: animationPhase === 0 ? '0 0 20px rgba(239, 68, 68, 0.3)' : 'none',
              }}
            >
              <div className="text-red-400 text-sm flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Spirit (Fire)
              </div>
              <div className="text-xl font-bold">{metrics.spiritScore.toFixed(1)}</div>
            </div>
            <div
              className="p-3 bg-blue-900/30 rounded-lg transition-all duration-300"
              style={{
                boxShadow: animationPhase === 1 ? '0 0 20px rgba(59, 130, 246, 0.3)' : 'none',
              }}
            >
              <div className="text-blue-400 text-sm flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Essence (Water)
              </div>
              <div className="text-xl font-bold">{metrics.essenceScore.toFixed(1)}</div>
            </div>
            <div
              className="p-3 bg-yellow-900/30 rounded-lg transition-all duration-300"
              style={{
                boxShadow: animationPhase === 2 ? '0 0 20px rgba(245, 158, 11, 0.3)' : 'none',
              }}
            >
              <div className="text-yellow-400 text-sm flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Matter (Air)
              </div>
              <div className="text-xl font-bold">{metrics.matterScore.toFixed(1)}</div>
            </div>
            <div
              className="p-3 bg-green-900/30 rounded-lg transition-all duration-300"
              style={{
                boxShadow: animationPhase === 3 ? '0 0 20px rgba(34, 197, 94, 0.3)' : 'none',
              }}
            >
              <div className="text-green-400 text-sm flex items-center gap-2">
                <Target className="w-4 h-4" />
                Substance (Earth)
              </div>
              <div className="text-xl font-bold">{metrics.substanceScore.toFixed(1)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personality Preview */}
      <Card className="bg-slate-900/50 border-emerald-500/50">
        <CardHeader>
          <CardTitle className="text-emerald-300 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Personality Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-emerald-300 mb-2">Core Essence</h4>
            <p className="text-sm text-slate-300">{personality.core.essence}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-emerald-300 mb-2">Strengths</h4>
              <div className="space-y-1">
                {personality.strengths.map((strength, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                    <Star className="w-3 h-3 text-emerald-400" />
                    {strength}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-emerald-300 mb-2">Wisdom Domains</h4>
              <div className="flex flex-wrap gap-1">
                {personality.wisdomDomains.map((domain, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {domain}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Capability Metrics */}
          <div className="space-y-3 pt-2 border-t border-slate-700">
            <h4 className="text-sm font-semibold text-emerald-300">Capability Profile</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Creativity</span>
                  <span>{personality.creativityLevel.toFixed(0)}%</span>
                </div>
                <Progress value={personality.creativityLevel} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Analysis</span>
                  <span>{personality.analyticalDepth.toFixed(0)}%</span>
                </div>
                <Progress value={personality.analyticalDepth} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Emotional IQ</span>
                  <span>{personality.emotionalIntelligence.toFixed(0)}%</span>
                </div>
                <Progress value={personality.emotionalIntelligence} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Intuition</span>
                  <span>{personality.intuitionStrength.toFixed(0)}%</span>
                </div>
                <Progress value={personality.intuitionStrength} className="h-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consciousness Stability */}
      <Card className="bg-slate-900/50 border-blue-500/50">
        <CardHeader>
          <CardTitle className="text-blue-300 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Consciousness Stability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Stability Index</span>
                <span className="font-bold">{metrics.stabilityIndex.toFixed(0)}%</span>
              </div>
              <Progress value={metrics.stabilityIndex} className="h-3" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Evolution Potential</span>
                <span className="font-bold">{metrics.evolutionPotential.toFixed(0)}%</span>
              </div>
              <Progress value={metrics.evolutionPotential} className="h-3" />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-blue-900/20 rounded-lg">
            <div>
              <div className="text-sm font-medium">Dominant Pattern</div>
              <div className="text-xs text-slate-400">
                {metrics.dominantElement} • {metrics.dominantModality}
              </div>
            </div>
            <Badge variant="outline" className="border-blue-500 text-blue-300">
              {personality.communicationStyle}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
