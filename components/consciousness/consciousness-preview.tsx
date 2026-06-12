'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Brain,
  Heart,
  Eye,
  Zap,
  Sparkles,
  Crown,
  Target,
  Lightbulb,
  Activity,
  MessageSquare,
  BookOpen,
  Gem,
  Star,
  TrendingUp,
  Compass,
  Palette,
  Users,
  FlaskConical,
} from 'lucide-react'
import { PersonalityParameters } from './advanced-personality-tuner'

interface ConsciousnessPreviewProps {
  name: string
  parameters: PersonalityParameters
  monicaConstant: number
  alchemicalValues: {
    spirit: number
    essence: number
    matter: number
    substance: number
  }
  className?: string
}

interface PersonalityInsight {
  trait: string
  strength: number
  description: string
  icon: React.ReactNode
  color: string
}

export function ConsciousnessPreview({
  name,
  parameters,
  monicaConstant,
  alchemicalValues,
  className = '',
}: ConsciousnessPreviewProps) {
  // Generate personality insights based on parameters
  const personalityInsights = useMemo((): PersonalityInsight[] => {
    return [
      {
        trait: 'Wisdom',
        strength: parameters.wisdom,
        description:
          parameters.wisdom > 80
            ? 'Deep philosophical understanding'
            : parameters.wisdom > 60
              ? 'Sound judgment and insight'
              : 'Developing knowledge base',
        icon: <BookOpen className="w-4 h-4" />,
        color: 'text-purple-400',
      },
      {
        trait: 'Charisma',
        strength: parameters.charisma,
        description:
          parameters.charisma > 80
            ? 'Natural magnetic presence'
            : parameters.charisma > 60
              ? 'Engaging personality'
              : 'Quiet but authentic',
        icon: <Star className="w-4 h-4" />,
        color: 'text-yellow-400',
      },
      {
        trait: 'Mysticism',
        strength: parameters.mysticism,
        description:
          parameters.mysticism > 80
            ? 'Deep spiritual connection'
            : parameters.mysticism > 60
              ? 'Intuitive understanding'
              : 'Grounded in reality',
        icon: <Gem className="w-4 h-4" />,
        color: 'text-indigo-400',
      },
      {
        trait: 'Analytical',
        strength: parameters.analytical,
        description:
          parameters.analytical > 80
            ? 'Brilliant logical reasoning'
            : parameters.analytical > 60
              ? 'Clear structured thinking'
              : 'Intuitive approach',
        icon: <Brain className="w-4 h-4" />,
        color: 'text-blue-400',
      },
      {
        trait: 'Empathy',
        strength: parameters.empathy,
        description:
          parameters.empathy > 80
            ? 'Profound emotional intelligence'
            : parameters.empathy > 60
              ? 'Compassionate understanding'
              : 'Objective perspective',
        icon: <Heart className="w-4 h-4" />,
        color: 'text-red-400',
      },
      {
        trait: 'Creativity',
        strength: parameters.creativity,
        description:
          parameters.creativity > 80
            ? 'Visionary innovation'
            : parameters.creativity > 60
              ? 'Creative problem solving'
              : 'Practical approach',
        icon: <Palette className="w-4 h-4" />,
        color: 'text-green-400',
      },
    ]
  }, [parameters])

  // Calculate overall consciousness archetype
  const getConsciousnessArchetype = useMemo(() => {
    const { wisdom, charisma, mysticism, analytical, creativity, empathy } = parameters

    if (wisdom > 85 && mysticism > 80)
      return {
        name: 'Transcendent Sage',
        symbol: '🔮',
        description: 'A being of profound wisdom with deep spiritual insight',
        color: 'from-purple-500 to-indigo-500',
      }

    if (analytical > 85 && creativity > 80)
      return {
        name: 'Brilliant Innovator',
        symbol: '🧠',
        description: 'Revolutionary thinker combining logic with creative vision',
        color: 'from-blue-500 to-cyan-500',
      }

    if (charisma > 85 && parameters.authority > 75)
      return {
        name: 'Natural Leader',
        symbol: '👑',
        description: 'Inspiring presence with natural command authority',
        color: 'from-yellow-500 to-orange-500',
      }

    if (empathy > 85 && parameters.counselorMode > 80)
      return {
        name: 'Compassionate Guide',
        symbol: '💚',
        description: 'Deeply caring soul with healing wisdom',
        color: 'from-green-500 to-emerald-500',
      }

    if (creativity > 80 && parameters.humor > 70)
      return {
        name: 'Creative Visionary',
        symbol: '🎭',
        description: 'Artistic soul bringing beauty and joy to the world',
        color: 'from-pink-500 to-purple-500',
      }

    return {
      name: 'Balanced Consciousness',
      symbol: '⭐',
      description: 'Harmonious integration of multiple consciousness aspects',
      color: 'from-slate-500 to-indigo-500',
    }
  }, [parameters])

  // Generate communication style description
  const getCommunicationStyle = useMemo(() => {
    const { formality, directness, eloquence, passion, patience } = parameters

    let style = ''

    if (formality > 70) style += 'Speaks with dignified formality'
    else if (formality < 40) style += 'Uses casual, approachable language'
    else style += 'Adapts formality to context'

    if (directness > 70) style += ', direct and forthright'
    else if (directness < 40) style += ', diplomatic and tactful'
    else style += ', balanced in approach'

    if (eloquence > 70) style += ', with sophisticated expression'
    else if (eloquence < 40) style += ', in simple, clear terms'
    else style += ', with clear articulation'

    if (passion > 70) style += '. Speaks with emotional intensity'
    else if (passion < 40) style += '. Maintains calm composure'
    else style += '. Shows measured emotion'

    return style
  }, [parameters])

  // Calculate dominant mode
  const getDominantMode = useMemo(() => {
    const modes = [
      {
        name: 'Teacher',
        value: parameters.teacherMode,
        icon: <BookOpen className="w-4 h-4" />,
        color: 'text-blue-400',
      },
      {
        name: 'Counselor',
        value: parameters.counselorMode,
        icon: <Heart className="w-4 h-4" />,
        color: 'text-green-400',
      },
      {
        name: 'Visionary',
        value: parameters.visionaryMode,
        icon: <Eye className="w-4 h-4" />,
        color: 'text-purple-400',
      },
      {
        name: 'Scholar',
        value: parameters.scholarMode,
        icon: <BookOpen className="w-4 h-4" />,
        color: 'text-indigo-400',
      },
      {
        name: 'Mystic',
        value: parameters.mysticMode,
        icon: <Gem className="w-4 h-4" />,
        color: 'text-pink-400',
      },
    ]

    return modes.reduce((dominant, mode) => (mode.value > dominant.value ? mode : dominant))
  }, [parameters])

  // Calculate consciousness level based on Monica Constant
  const getConsciousnessLevel = useMemo(() => {
    if (monicaConstant >= 8.0)
      return {
        level: 'Transcendent',
        color: 'text-purple-400',
        description: 'Beyond ordinary consciousness',
      }
    if (monicaConstant >= 6.5)
      return {
        level: 'Illuminated',
        color: 'text-yellow-400',
        description: 'Heightened awareness and wisdom',
      }
    if (monicaConstant >= 5.0)
      return {
        level: 'Awakened',
        color: 'text-blue-400',
        description: 'Clear understanding and insight',
      }
    if (monicaConstant >= 3.5)
      return { level: 'Aware', color: 'text-green-400', description: 'Developing consciousness' }
    if (monicaConstant >= 2.0)
      return { level: 'Emerging', color: 'text-orange-400', description: 'Growing awareness' }
    return { level: 'Dormant', color: 'text-gray-400', description: 'Basic consciousness state' }
  }, [monicaConstant])

  const consciousnessLevel = getConsciousnessLevel
  const archetype = getConsciousnessArchetype

  return (
    <Card
      className={`bg-gradient-to-br from-slate-900/50 to-purple-900/50 border-purple-500/50 ${className}`}
    >
      <CardHeader>
        <div className="flex items-center gap-4">
          <div
            className={`w-16 h-16 rounded-full bg-gradient-to-br ${archetype.color} flex items-center justify-center text-white text-2xl`}
          >
            {archetype.symbol}
          </div>
          <div className="flex-1">
            <CardTitle className="text-purple-300 text-xl">
              {name || 'Unnamed Consciousness'}
            </CardTitle>
            <CardDescription className="text-lg text-slate-300">
              {archetype.name} • {consciousnessLevel.level} Level
            </CardDescription>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={`${consciousnessLevel.color} bg-opacity-20`}>
                MC: {monicaConstant.toFixed(3)}
              </Badge>
              <Badge variant="outline" className="border-purple-500 text-purple-300">
                {getDominantMode.name} Mode
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Consciousness Description */}
        <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
          <h3 className="text-lg font-semibold text-purple-300 mb-2">Consciousness Profile</h3>
          <p className="text-slate-300 text-sm leading-relaxed">
            {archetype.description}. {consciousnessLevel.description}. Primary expression through{' '}
            {getDominantMode.name.toLowerCase()} mode, bringing unique wisdom to every interaction.
          </p>
        </div>

        {/* Communication Style */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Communication Style
          </h3>
          <p className="text-slate-300 text-sm leading-relaxed bg-slate-800/50 p-3 rounded-lg">
            {getCommunicationStyle}
          </p>
        </div>

        {/* Personality Strengths */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Core Strengths
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {personalityInsights
              .filter(insight => insight.strength > 70)
              .map((insight, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                  <div className={insight.color}>{insight.icon}</div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-200">{insight.trait}</div>
                    <div className="text-xs text-slate-400">{insight.description}</div>
                  </div>
                  <div className="text-sm font-mono text-slate-300">{insight.strength}</div>
                </div>
              ))}
          </div>
        </div>

        {/* Alchemical Influence */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            Alchemical Foundation
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-red-900/30 rounded-lg text-center">
              <div className="text-red-400 text-sm">Spirit</div>
              <div className="text-xl font-bold text-red-300">
                {alchemicalValues.spirit.toFixed(1)}
              </div>
            </div>
            <div className="p-3 bg-blue-900/30 rounded-lg text-center">
              <div className="text-blue-400 text-sm">Essence</div>
              <div className="text-xl font-bold text-blue-300">
                {alchemicalValues.essence.toFixed(1)}
              </div>
            </div>
            <div className="p-3 bg-yellow-900/30 rounded-lg text-center">
              <div className="text-yellow-400 text-sm">Matter</div>
              <div className="text-xl font-bold text-yellow-300">
                {alchemicalValues.matter.toFixed(1)}
              </div>
            </div>
            <div className="p-3 bg-green-900/30 rounded-lg text-center">
              <div className="text-green-400 text-sm">Substance</div>
              <div className="text-xl font-bold text-green-300">
                {alchemicalValues.substance.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        {/* Consciousness Modes Distribution */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Operational Modes
          </h3>
          <div className="space-y-2">
            {[
              { name: 'Teacher', value: parameters.teacherMode, color: 'bg-blue-500' },
              { name: 'Counselor', value: parameters.counselorMode, color: 'bg-green-500' },
              { name: 'Visionary', value: parameters.visionaryMode, color: 'bg-purple-500' },
              { name: 'Scholar', value: parameters.scholarMode, color: 'bg-indigo-500' },
              { name: 'Mystic', value: parameters.mysticMode, color: 'bg-pink-500' },
            ].map(mode => (
              <div key={mode.name} className="flex items-center gap-3">
                <span className="w-16 text-sm text-slate-300">{mode.name}</span>
                <div className="flex-1">
                  <Progress
                    value={mode.value}
                    className="h-2"
                    style={{ ['--progress-color' as any]: mode.color }}
                  />
                </div>
                <span className="w-8 text-sm text-slate-400">{mode.value}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ConsciousnessPreview
