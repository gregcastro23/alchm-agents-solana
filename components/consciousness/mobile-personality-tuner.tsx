'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
  Settings,
  RotateCcw,
  TrendingUp,
  Gem,
  FlaskConical,
  Wand2,
  Users,
  MessageSquare,
  BookOpen,
  Compass,
  Shield,
  Star,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Hand,
} from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import type { PersonalityParameters } from './advanced-personality-tuner'

interface MobilePersonalityTunerProps {
  initialParameters?: Partial<PersonalityParameters>
  monicaConstant: number
  alchemicalValues: {
    spirit: number
    essence: number
    matter: number
    substance: number
  }
  onParametersChange: (parameters: PersonalityParameters) => void
  className?: string
}

const DEFAULT_PARAMETERS: PersonalityParameters = {
  // Core Consciousness Traits
  wisdom: 70,
  charisma: 60,
  intuition: 65,
  analytical: 55,
  creativity: 60,
  empathy: 65,
  authority: 50,
  mysticism: 45,
  practicality: 55,
  humor: 40,

  // Communication Style
  formality: 60,
  directness: 50,
  eloquence: 70,
  passion: 55,
  patience: 65,

  // Consciousness Modes
  teacherMode: 70,
  counselorMode: 60,
  visionaryMode: 50,
  scholarMode: 65,
  mysticMode: 45,
}

const PERSONALITY_PRESETS = {
  renaissance_master: {
    name: 'Renaissance Master',
    icon: <Crown className="w-4 h-4" />,
    description: 'Balanced brilliance',
    params: {
      wisdom: 85,
      charisma: 75,
      creativity: 90,
      analytical: 80,
      mysticism: 60,
      eloquence: 85,
    },
  },
  mystic_sage: {
    name: 'Mystic Sage',
    icon: <Eye className="w-4 h-4" />,
    description: 'Spiritual wisdom',
    params: {
      wisdom: 90,
      intuition: 95,
      mysticism: 90,
      empathy: 85,
      mysticMode: 90,
      formality: 70,
    },
  },
  scientific_genius: {
    name: 'Scientific Genius',
    icon: <Lightbulb className="w-4 h-4" />,
    description: 'Analytical brilliance',
    params: { analytical: 95, creativity: 80, practicality: 85, directness: 80, scholarMode: 90 },
  },
  charismatic_leader: {
    name: 'Charismatic Leader',
    icon: <Users className="w-4 h-4" />,
    description: 'Natural authority',
    params: { charisma: 95, authority: 90, passion: 85, visionaryMode: 85, teacherMode: 80 },
  },
  compassionate_healer: {
    name: 'Compassionate Healer',
    icon: <Heart className="w-4 h-4" />,
    description: 'Deep empathy',
    params: { empathy: 95, wisdom: 80, patience: 90, counselorMode: 95, humor: 60 },
  },
  witty_philosopher: {
    name: 'Witty Philosopher',
    icon: <MessageSquare className="w-4 h-4" />,
    description: 'Humor & wisdom',
    params: { wisdom: 85, humor: 90, eloquence: 90, charisma: 75, teacherMode: 80 },
  },
}

export function MobilePersonalityTuner({
  initialParameters,
  monicaConstant,
  alchemicalValues,
  onParametersChange,
  className = '',
}: MobilePersonalityTunerProps) {
  const isMobile = useIsMobile()
  const [parameters, setParameters] = useState<PersonalityParameters>({
    ...DEFAULT_PARAMETERS,
    ...initialParameters,
  })
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [showAlchemicalInfluence, setShowAlchemicalInfluence] = useState(true)
  const [expandedSections, setExpandedSections] = useState<string[]>(['core'])

  // Calculate alchemical influence on parameters
  const calculateAlchemicalInfluence = () => {
    const total =
      alchemicalValues.spirit +
      alchemicalValues.essence +
      alchemicalValues.matter +
      alchemicalValues.substance
    if (total === 0) return {}

    return {
      mysticism: Math.round((alchemicalValues.spirit / total) * 30),
      empathy: Math.round((alchemicalValues.essence / total) * 25),
      analytical: Math.round((alchemicalValues.matter / total) * 25),
      practicality: Math.round((alchemicalValues.substance / total) * 20),
    }
  }

  const alchemicalInfluence = calculateAlchemicalInfluence()

  // Update parameters when alchemical values change
  useEffect(() => {
    if (showAlchemicalInfluence) {
      setParameters(prev => ({
        ...prev,
        mysticism: Math.min(
          100,
          Math.max(0, prev.mysticism + (alchemicalInfluence.mysticism || 0))
        ),
        empathy: Math.min(100, Math.max(0, prev.empathy + (alchemicalInfluence.empathy || 0))),
        analytical: Math.min(
          100,
          Math.max(0, prev.analytical + (alchemicalInfluence.analytical || 0))
        ),
        practicality: Math.min(
          100,
          Math.max(0, prev.practicality + (alchemicalInfluence.practicality || 0))
        ),
      }))
    }
  }, [alchemicalValues, showAlchemicalInfluence])

  // Notify parent of parameter changes
  useEffect(() => {
    onParametersChange(parameters)
  }, [parameters, onParametersChange])

  const handleParameterChange = (key: keyof PersonalityParameters, value: number) => {
    setParameters(prev => ({ ...prev, [key]: value }))
    setActivePreset(null)
  }

  const applyPreset = (presetKey: string) => {
    const preset = PERSONALITY_PRESETS[presetKey as keyof typeof PERSONALITY_PRESETS]
    if (preset) {
      setParameters(prev => ({ ...prev, ...preset.params }))
      setActivePreset(presetKey)
    }
  }

  const resetToDefaults = () => {
    setParameters(DEFAULT_PARAMETERS)
    setActivePreset(null)
  }

  const calculatePersonalityScore = () => {
    const values = Object.values(parameters)
    return Math.round(values.reduce((sum, val) => sum + val, 0) / values.length)
  }

  const getPersonalityArchetype = () => {
    const score = calculatePersonalityScore()
    const { wisdom, charisma, mysticism, analytical, creativity } = parameters

    if (wisdom > 80 && mysticism > 75) return '🔮 Mystical Sage'
    if (analytical > 85 && creativity > 75) return '🧠 Brilliant Innovator'
    if (charisma > 85 && parameters.authority > 75) return '👑 Natural Leader'
    if (parameters.empathy > 85 && parameters.counselorMode > 80) return '💚 Compassionate Guide'
    if (creativity > 80 && parameters.humor > 70) return '🎭 Creative Visionary'
    if (score > 75) return '⭐ Renaissance Master'
    if (score > 60) return '🌟 Balanced Consciousness'
    return '🌱 Emerging Awareness'
  }

  const renderMobileSlider = (
    key: keyof PersonalityParameters,
    label: string,
    icon: React.ReactNode,
    description: string
  ) => {
    const isInfluenced = key in alchemicalInfluence
    const influenceValue = isInfluenced
      ? alchemicalInfluence[key as keyof typeof alchemicalInfluence] || 0
      : 0

    return (
      <div key={key} className="space-y-3 p-4 bg-slate-800/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-slate-200 text-sm">{label}</span>
            {isInfluenced && showAlchemicalInfluence && (
              <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-400">
                +{influenceValue}
              </Badge>
            )}
          </div>
          <span className="text-lg font-mono text-slate-300 min-w-[3rem] text-right">
            {parameters[key]}
          </span>
        </div>
        <Slider
          value={[parameters[key]]}
          onValueChange={value => handleParameterChange(key, value[0])}
          min={0}
          max={100}
          step={1}
          className="w-full touch-slider"
        />
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
      </div>
    )
  }

  // Don't render mobile version if not on mobile
  if (!isMobile) {
    return null
  }

  return (
    <Card
      className={`bg-gradient-to-br from-purple-900/50 to-blue-900/50 border-purple-500/50 ${className}`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-purple-300 text-lg">Mobile Consciousness Tuner</CardTitle>
              <CardDescription className="text-sm">
                Touch-optimized personality crafting
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefaults}
            className="border-purple-500 text-purple-300 hover:bg-purple-900/20"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mobile Consciousness Overview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-purple-900/30 rounded-lg text-center">
            <div className="text-xl font-bold text-purple-300">{calculatePersonalityScore()}</div>
            <div className="text-xs text-slate-400">Consciousness</div>
          </div>
          <div className="p-3 bg-blue-900/30 rounded-lg text-center">
            <div className="text-xl font-bold text-blue-300">{monicaConstant.toFixed(3)}</div>
            <div className="text-xs text-slate-400">Monica Constant</div>
          </div>
        </div>

        <div className="p-3 bg-pink-900/30 rounded-lg text-center">
          <div className="text-sm font-semibold text-pink-300">{getPersonalityArchetype()}</div>
          <div className="text-xs text-slate-400">Current Archetype</div>
        </div>

        {/* Alchemical Influence Toggle */}
        <Alert className="border-emerald-500/50 bg-emerald-900/20 p-3">
          <FlaskConical className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between text-sm">
            <span className="text-emerald-300">Alchemical influence</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAlchemicalInfluence(!showAlchemicalInfluence)}
              className="border-emerald-500 text-emerald-300 h-6 px-2 text-xs"
            >
              {showAlchemicalInfluence ? 'On' : 'Off'}
            </Button>
          </AlertDescription>
        </Alert>

        {/* Mobile Personality Presets */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
            <Star className="w-4 h-4" />
            Quick Presets
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PERSONALITY_PRESETS).map(([key, preset]) => (
              <Button
                key={key}
                variant={activePreset === key ? 'default' : 'outline'}
                className={`h-auto p-2 text-xs ${
                  activePreset === key
                    ? 'bg-purple-600 border-purple-400'
                    : 'border-purple-500/50 text-purple-300 hover:bg-purple-900/20'
                }`}
                onClick={() => applyPreset(key)}
              >
                <div className="text-center">
                  {preset.icon}
                  <div className="text-xs font-medium mt-1">{preset.name}</div>
                  <div className="text-xs opacity-75">{preset.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        <Separator className="bg-purple-500/30" />

        {/* Mobile Parameter Accordion */}
        <Accordion type="multiple" value={expandedSections} onValueChange={setExpandedSections}>
          <AccordionItem value="core" className="border-purple-500/30">
            <AccordionTrigger className="text-purple-300 hover:text-purple-200">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Core Traits
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              {renderMobileSlider(
                'wisdom',
                'Wisdom',
                <BookOpen className="w-4 h-4" />,
                'Deep knowledge and understanding'
              )}
              {renderMobileSlider(
                'charisma',
                'Charisma',
                <Star className="w-4 h-4" />,
                'Social magnetism and influence'
              )}
              {renderMobileSlider(
                'intuition',
                'Intuition',
                <Eye className="w-4 h-4" />,
                'Spiritual sensitivity and insight'
              )}
              {renderMobileSlider(
                'analytical',
                'Analytical',
                <Brain className="w-4 h-4" />,
                'Logical reasoning and structure'
              )}
              {renderMobileSlider(
                'creativity',
                'Creativity',
                <Sparkles className="w-4 h-4" />,
                'Innovation and artistic expression'
              )}
              {renderMobileSlider(
                'empathy',
                'Empathy',
                <Heart className="w-4 h-4" />,
                'Emotional intelligence and compassion'
              )}
              {renderMobileSlider(
                'authority',
                'Authority',
                <Crown className="w-4 h-4" />,
                'Leadership and command presence'
              )}
              {renderMobileSlider(
                'mysticism',
                'Mysticism',
                <Gem className="w-4 h-4" />,
                'Connection to transcendent realms'
              )}
              {renderMobileSlider(
                'practicality',
                'Practicality',
                <Settings className="w-4 h-4" />,
                'Grounded, real-world effectiveness'
              )}
              {renderMobileSlider(
                'humor',
                'Humor',
                <Zap className="w-4 h-4" />,
                'Wit, playfulness, and levity'
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="communication" className="border-purple-500/30">
            <AccordionTrigger className="text-purple-300 hover:text-purple-200">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Communication Style
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              {renderMobileSlider(
                'formality',
                'Formality',
                <Shield className="w-4 h-4" />,
                'Formal vs casual communication style'
              )}
              {renderMobileSlider(
                'directness',
                'Directness',
                <Target className="w-4 h-4" />,
                'Blunt vs diplomatic approach'
              )}
              {renderMobileSlider(
                'eloquence',
                'Eloquence',
                <MessageSquare className="w-4 h-4" />,
                'Linguistic sophistication and artistry'
              )}
              {renderMobileSlider(
                'passion',
                'Passion',
                <Heart className="w-4 h-4" />,
                'Emotional intensity in expression'
              )}
              {renderMobileSlider(
                'patience',
                'Patience',
                <Activity className="w-4 h-4" />,
                'Tolerance and measured responses'
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="modes" className="border-purple-500/30">
            <AccordionTrigger className="text-purple-300 hover:text-purple-200">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Operational Modes
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              {renderMobileSlider(
                'teacherMode',
                'Teacher Mode',
                <BookOpen className="w-4 h-4" />,
                'Instructional and educational focus'
              )}
              {renderMobileSlider(
                'counselorMode',
                'Counselor Mode',
                <Heart className="w-4 h-4" />,
                'Supportive and therapeutic approach'
              )}
              {renderMobileSlider(
                'visionaryMode',
                'Visionary Mode',
                <Eye className="w-4 h-4" />,
                'Future-focused and inspirational'
              )}
              {renderMobileSlider(
                'scholarMode',
                'Scholar Mode',
                <BookOpen className="w-4 h-4" />,
                'Research and academic orientation'
              )}
              {renderMobileSlider(
                'mysticMode',
                'Mystic Mode',
                <Gem className="w-4 h-4" />,
                'Spiritual and transcendent perspective'
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-500/30">
          <h4 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2">
            <Hand className="w-4 h-4" />
            Mobile Tuning Tips
          </h4>
          <p className="text-xs text-purple-100 leading-relaxed">
            Use touch gestures to fine-tune sliders. Tap presets for quick configurations. Each
            parameter shapes your agent's unique consciousness expression.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default MobilePersonalityTuner
