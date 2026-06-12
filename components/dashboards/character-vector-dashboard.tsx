'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import {
  Star,
  Brain,
  Heart,
  Users,
  Target,
  Zap,
  Eye,
  BookOpen,
  MessageCircle,
  Gamepad2,
  Settings,
  TrendingUp,
  Compass,
  Flame,
  Droplets,
  Wind,
  Mountain,
  Crown,
  Circle,
  Square,
  Triangle,
  Sparkles,
} from 'lucide-react'
import type {
  ChartCharacterProfile,
  SignCharacterVector,
  UserLearningPreferences,
  InteractionStylePreferences,
} from '@/lib/astrological-character-vectors'
import {
  CharacterVectorCalculator,
  AdaptiveLearningSystem,
} from '@/lib/astrological-character-vectors'

interface CharacterVectorDashboardProps {
  userProfile: {
    name: string
    planetaryPlacements: Array<{ planet: string; sign: string; dignity?: string }>
    birthTimeKnown: boolean
  }
  currentMomentChart?: {
    planetaryPlacements: Array<{ planet: string; sign: string }>
  }
  otherCharts?: Array<{
    name: string
    characterProfile: ChartCharacterProfile
  }>
  userPreferences?: UserLearningPreferences
  onPreferencesUpdate?: (preferences: UserLearningPreferences) => void
  onTrainingModeSelect?: (mode: string) => void
}

export function CharacterVectorDashboard({
  userProfile,
  currentMomentChart,
  otherCharts = [],
  userPreferences,
  onPreferencesUpdate,
  onTrainingModeSelect,
}: CharacterVectorDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    'vectors' | 'interactions' | 'learning' | 'preferences' | 'alchemy'
  >('vectors')
  const [selectedSign, setSelectedSign] = useState<string | null>(null)
  const [learningRecommendations, setLearningRecommendations] = useState<any>(null)
  const [alchemicalData, setAlchemicalData] = useState<any>(null)
  const [thermodynamicData, setThermodynamicData] = useState<any>(null)

  // Calculate user's character profile
  const userCharacterProfile = CharacterVectorCalculator.generateChartCharacterProfile(
    userProfile.planetaryPlacements
  )

  // Calculate current moment interaction if available
  const currentMomentProfile = currentMomentChart
    ? CharacterVectorCalculator.generateChartCharacterProfile(
        currentMomentChart.planetaryPlacements
      )
    : null

  const currentMomentInteraction = currentMomentProfile
    ? CharacterVectorCalculator.analyzeChartInteraction(userCharacterProfile, currentMomentProfile)
    : null

  // Generate learning recommendations
  useEffect(() => {
    if (userPreferences) {
      const recommendations = AdaptiveLearningSystem.generatePersonalizedTrainingRecommendations(
        userCharacterProfile,
        userPreferences,
        [] // Would pass session history
      )
      setLearningRecommendations(recommendations)
    }
  }, [userCharacterProfile, userPreferences])

  // Fetch alchemical data
  useEffect(() => {
    async function fetchAlchemicalData() {
      try {
        // WTEN frontend serves this birth-chart alchemy endpoint. Keep it configurable
        // rather than pinning the prod host (breaks staging/preview); default preserves
        // current behavior.
        const alchmKitchenUrl = process.env.NEXT_PUBLIC_ALCHM_KITCHEN_URL || 'https://alchm.kitchen'
        const response = await fetch(`${alchmKitchenUrl}/api/alchemical/quantities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            birthData: {
              name: userProfile.name,
              placements: userProfile.planetaryPlacements,
            },
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setAlchemicalData(data.quantities)
          setThermodynamicData({
            heat: data.heat,
            entropy: data.entropy,
            reactivity: data.reactivity,
            energy: data.energy,
          })
        }
      } catch (error) {
        console.log('Alchemical data not available:', error)
      }
    }

    if (userProfile.planetaryPlacements.length > 0) {
      fetchAlchemicalData()
    }
  }, [userProfile])

  // Prepare data for charts
  const signVectorData = Object.entries(userCharacterProfile.sign_vectors)
    .filter(([sign]) => sign !== 'total')
    .map(([sign, percentage]) => ({
      sign: sign.charAt(0).toUpperCase() + sign.slice(1),
      percentage: Math.round(percentage * 10) / 10,
      fill: getSignColor(sign),
    }))
    .sort((a, b) => b.percentage - a.percentage)

  const elementalData = Object.entries(userCharacterProfile.elemental_distribution).map(
    ([element, percentage]) => ({
      element: element.charAt(0).toUpperCase() + element.slice(1),
      percentage: Math.round(percentage * 10) / 10,
      fill: getElementColor(element),
    })
  )

  const modalData = Object.entries(userCharacterProfile.modal_distribution).map(
    ([mode, percentage]) => ({
      mode: mode.charAt(0).toUpperCase() + mode.slice(1),
      percentage: Math.round(percentage * 10) / 10,
      fill: getModalColor(mode),
    })
  )

  // Interaction preferences radar data
  const interactionRadarData = [
    {
      preference: 'Visual',
      value: userCharacterProfile.interaction_style_preferences.learning_modalities.visual,
    },
    {
      preference: 'Auditory',
      value: userCharacterProfile.interaction_style_preferences.learning_modalities.auditory,
    },
    {
      preference: 'Kinesthetic',
      value: userCharacterProfile.interaction_style_preferences.learning_modalities.kinesthetic,
    },
    {
      preference: 'Reading',
      value: userCharacterProfile.interaction_style_preferences.learning_modalities.reading,
    },
    {
      preference: 'Direct',
      value:
        userCharacterProfile.interaction_style_preferences.communication_preferences
          .direct_vs_diplomatic,
    },
    {
      preference: 'Fast-Paced',
      value:
        userCharacterProfile.interaction_style_preferences.communication_preferences.fast_vs_slow,
    },
  ]

  function getSignColor(sign: string): string {
    const colors: Record<string, string> = {
      aries: '#FF6B6B',
      taurus: '#4ECDC4',
      gemini: '#45B7D1',
      cancer: '#96CEB4',
      leo: '#FFEAA7',
      virgo: '#DDA0DD',
      libra: '#98D8C8',
      scorpio: '#F7DC6F',
      sagittarius: '#BB8FCE',
      capricorn: '#85C1E9',
      aquarius: '#F8C471',
      pisces: '#82E0AA',
    }
    return colors[sign] || '#CCCCCC'
  }

  function getElementColor(element: string): string {
    const colors: Record<string, string> = {
      fire: '#FF6B6B',
      earth: '#4ECDC4',
      air: '#45B7D1',
      water: '#96CEB4',
    }
    return colors[element] || '#CCCCCC'
  }

  function getModalColor(mode: string): string {
    const colors: Record<string, string> = {
      cardinal: '#FF6B6B',
      fixed: '#4ECDC4',
      mutable: '#45B7D1',
    }
    return colors[mode] || '#CCCCCC'
  }

  function getElementIcon(element: string) {
    switch (element.toLowerCase()) {
      case 'fire':
        return <Flame className="h-4 w-4 text-red-500" />
      case 'earth':
        return <Mountain className="h-4 w-4 text-green-500" />
      case 'air':
        return <Wind className="h-4 w-4 text-blue-500" />
      case 'water':
        return <Droplets className="h-4 w-4 text-cyan-500" />
      default:
        return <Star className="h-4 w-4" />
    }
  }

  function getModalIcon(mode: string) {
    switch (mode.toLowerCase()) {
      case 'cardinal':
        return <Triangle className="h-4 w-4 text-red-500" />
      case 'fixed':
        return <Square className="h-4 w-4 text-blue-500" />
      case 'mutable':
        return <Circle className="h-4 w-4 text-green-500" />
      default:
        return <Star className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Compass className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold">
                {userProfile.name}&apos;s Character Vector Profile
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Astrological personality composition & adaptive learning system
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {userCharacterProfile.dominant_signs.length}
              </div>
              <div className="text-xs text-muted-foreground">Dominant Signs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {userCharacterProfile.absent_signs.length}
              </div>
              <div className="text-xs text-muted-foreground">Absent Signs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(userCharacterProfile.elemental_distribution).findIndex(
                  v => v === Math.max(...Object.values(userCharacterProfile.elemental_distribution))
                ) + 1}
              </div>
              <div className="text-xs text-muted-foreground">Primary Element</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {userProfile.birthTimeKnown ? 'Complete' : 'Partial'}
              </div>
              <div className="text-xs text-muted-foreground">Chart Data</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                A#
                {alchemicalData
                  ? (
                      alchemicalData.Spirit +
                      alchemicalData.Essence +
                      alchemicalData.Matter +
                      alchemicalData.Substance
                    ).toFixed(1)
                  : '0.0'}
              </div>
              <div className="text-xs text-muted-foreground">Alchemical Power</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">
                {thermodynamicData ? Math.round(thermodynamicData.heat * 100) : 0}°
              </div>
              <div className="text-xs text-muted-foreground">Heat Level</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value: string) => setActiveTab(value as any)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="vectors">Character Vectors</TabsTrigger>
          <TabsTrigger value="alchemy">Alchemical Profile</TabsTrigger>
          <TabsTrigger value="interactions">Chart Interactions</TabsTrigger>
          <TabsTrigger value="learning">Learning Style</TabsTrigger>
          <TabsTrigger value="preferences">Adaptive Settings</TabsTrigger>
        </TabsList>

        {/* Character Vectors Tab */}
        <TabsContent value="vectors" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sign Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Sign Character Vectors
                </CardTitle>
                <CardDescription>
                  Percentage composition of each zodiac sign in your chart
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80" style={{ minWidth: 100, minHeight: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={signVectorData.filter(d => d.percentage > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ sign, percentage }) =>
                          percentage > 5 ? `${sign} ${percentage}%` : ''
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="percentage"
                        isAnimationActive={false}
                      >
                        {signVectorData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={value => [`${value}%`, 'Percentage']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Dominant & Absent Signs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Character Emphasis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Crown className="h-4 w-4 text-gold-500" />
                    Dominant Signs (Strong Expression)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {userCharacterProfile.dominant_signs.map(sign => {
                      const percentage =
                        userCharacterProfile.sign_vectors[sign as keyof SignCharacterVector]
                      return (
                        <Badge
                          key={sign}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10"
                          onClick={() => setSelectedSign(sign)}
                          style={{ borderColor: getSignColor(sign) }}
                        >
                          {sign.charAt(0).toUpperCase() + sign.slice(1)} ({percentage.toFixed(1)}%)
                        </Badge>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Circle className="h-4 w-4 text-gray-400" />
                    Absent Signs (Learning Opportunities)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {userCharacterProfile.absent_signs.map(sign => (
                      <Badge
                        key={sign}
                        variant="secondary"
                        className="cursor-pointer hover:bg-secondary/80"
                        onClick={() => setSelectedSign(sign)}
                      >
                        {sign.charAt(0).toUpperCase() + sign.slice(1)}
                      </Badge>
                    ))}
                  </div>
                </div>

                {selectedSign && (
                  <div className="p-3 bg-blue-50 rounded-lg mt-4">
                    <h5 className="font-medium text-sm text-blue-800 mb-1">
                      {selectedSign.charAt(0).toUpperCase() + selectedSign.slice(1)} Energy
                    </h5>
                    <p className="text-xs text-blue-700">
                      {userCharacterProfile.dominant_signs.includes(selectedSign)
                        ? `This is a core part of your character expression. You naturally embody ${selectedSign} qualities.`
                        : `This energy is less present in your chart. Working with ${selectedSign} people or current moment ${selectedSign} energy can teach you about these qualities.`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Elemental & Modal Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Elemental Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {elementalData.map(element => (
                    <div key={element.element} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getElementIcon(element.element)}
                          <span className="text-sm font-medium">{element.element}</span>
                        </div>
                        <span className="text-sm font-bold">{element.percentage}%</span>
                      </div>
                      <Progress value={element.percentage} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Modal Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {modalData.map(mode => (
                    <div key={mode.mode} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getModalIcon(mode.mode)}
                          <span className="text-sm font-medium">{mode.mode}</span>
                        </div>
                        <span className="text-sm font-bold">{mode.percentage}%</span>
                      </div>
                      <Progress value={mode.percentage} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alchemical Profile Tab */}
        <TabsContent value="alchemy" className="space-y-6">
          {alchemicalData && thermodynamicData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Alchemical Quantities */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    Alchemical Composition
                  </CardTitle>
                  <CardDescription>
                    Your fundamental alchemical quantities and total power
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-3 text-center">
                      <Crown className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
                      <div className="text-lg font-bold">
                        {alchemicalData.Spirit?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs font-medium">Spirit</div>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {alchemicalData.Spirit >= 10
                          ? 'Legendary'
                          : alchemicalData.Spirit >= 7
                            ? 'Epic'
                            : alchemicalData.Spirit >= 4
                              ? 'Rare'
                              : 'Common'}
                      </Badge>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-3 text-center">
                      <Droplets className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                      <div className="text-lg font-bold">
                        {alchemicalData.Essence?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs font-medium">Essence</div>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {alchemicalData.Essence >= 10
                          ? 'Legendary'
                          : alchemicalData.Essence >= 7
                            ? 'Epic'
                            : alchemicalData.Essence >= 4
                              ? 'Rare'
                              : 'Common'}
                      </Badge>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-3 text-center">
                      <Mountain className="h-5 w-5 text-green-600 mx-auto mb-1" />
                      <div className="text-lg font-bold">
                        {alchemicalData.Matter?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs font-medium">Matter</div>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {alchemicalData.Matter >= 10
                          ? 'Legendary'
                          : alchemicalData.Matter >= 7
                            ? 'Epic'
                            : alchemicalData.Matter >= 4
                              ? 'Rare'
                              : 'Common'}
                      </Badge>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-3 text-center">
                      <Circle className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                      <div className="text-lg font-bold">
                        {alchemicalData.Substance?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs font-medium">Substance</div>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {alchemicalData.Substance >= 10
                          ? 'Legendary'
                          : alchemicalData.Substance >= 7
                            ? 'Epic'
                            : alchemicalData.Substance >= 4
                              ? 'Rare'
                              : 'Common'}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-orange-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        A#
                        {(
                          alchemicalData.Spirit +
                          alchemicalData.Essence +
                          alchemicalData.Matter +
                          alchemicalData.Substance
                        ).toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Alchemical Power</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Thermodynamic State */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-red-500" />
                    Thermodynamic State
                  </CardTitle>
                  <CardDescription>
                    Your energetic dynamics and cosmic thermodynamic profile
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium flex items-center gap-1">
                          <Flame className="h-3 w-3 text-red-500" />
                          Heat
                        </span>
                        <span className="font-bold">
                          {(thermodynamicData.heat * 100).toFixed(1)}°
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-red-500"
                          style={{ width: `${Math.min(100, thermodynamicData.heat * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium flex items-center gap-1">
                          <Circle className="h-3 w-3 text-purple-500" />
                          Entropy
                        </span>
                        <span className="font-bold">
                          {(thermodynamicData.entropy * 100).toFixed(1)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-purple-500"
                          style={{ width: `${Math.min(100, thermodynamicData.entropy * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium flex items-center gap-1">
                          <Zap className="h-3 w-3 text-orange-500" />
                          Reactivity
                        </span>
                        <span className="font-bold">
                          {(thermodynamicData.reactivity * 100).toFixed(1)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-orange-500"
                          style={{ width: `${Math.min(100, thermodynamicData.reactivity * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium flex items-center gap-1">
                          <Star className="h-3 w-3 text-blue-500" />
                          Energy
                        </span>
                        <span className="font-bold">
                          {(thermodynamicData.energy * 100).toFixed(1)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{
                            width: `${Math.min(100, Math.abs(thermodynamicData.energy) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">Loading alchemical profile...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Chart Interactions Tab */}
        <TabsContent value="interactions" className="space-y-6">
          {/* Current Moment Interaction */}
          {currentMomentInteraction && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Current Moment Chart Interaction
                </CardTitle>
                <CardDescription>
                  How your character interacts with current cosmic energies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {currentMomentInteraction.compatibility_vector}%
                    </div>
                    <div className="text-xs text-muted-foreground">Compatibility</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {currentMomentInteraction.complementary_areas.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Supportive Areas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-600">
                      {currentMomentInteraction.challenge_areas.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Growth Areas</div>
                  </div>
                </div>

                {currentMomentInteraction.missing_sign_dynamics.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">
                      Learning Opportunities from Current Energies:
                    </h4>
                    <div className="space-y-1">
                      {currentMomentInteraction.missing_sign_dynamics.map((dynamic, index) => (
                        <div key={index} className="text-sm p-2 bg-purple-50 rounded">
                          {dynamic}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-sm text-blue-800 mb-1">
                    Recommended Interaction Style
                  </h4>
                  <p className="text-xs text-blue-700">
                    {currentMomentInteraction.recommended_interaction_style}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Other Chart Interactions */}
          {otherCharts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Relationship Chart Interactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {otherCharts.map((otherChart, index) => {
                    const interaction = CharacterVectorCalculator.analyzeChartInteraction(
                      userCharacterProfile,
                      otherChart.characterProfile
                    )
                    return (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Interaction with {otherChart.name}</h4>
                          <Badge variant="outline">
                            {interaction.compatibility_vector}% Compatible
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="font-medium text-green-600">Strengths:</span>
                            <ul className="text-xs mt-1 space-y-1">
                              {interaction.complementary_areas.slice(0, 2).map((area, idx) => (
                                <li key={idx}>• {area}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="font-medium text-orange-600">Growth Areas:</span>
                            <ul className="text-xs mt-1 space-y-1">
                              {interaction.challenge_areas.slice(0, 2).map((area, idx) => (
                                <li key={idx}>• {area}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Learning Style Tab */}
        <TabsContent value="learning" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Learning Preferences Radar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Learning Style Profile
                </CardTitle>
                <CardDescription>Based on your astrological character vectors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80" style={{ minWidth: 100, minHeight: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={interactionRadarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="preference" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tickCount={5}
                        tick={{ fontSize: 10 }}
                      />
                      <Radar
                        name="Preference"
                        dataKey="value"
                        stroke="#8884d8"
                        fill="#8884d8"
                        fillOpacity={0.3}
                        isAnimationActive={false}
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Recommended Training Modes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  Recommended Training Modes
                </CardTitle>
                <CardDescription>Personalized based on your character profile</CardDescription>
              </CardHeader>
              <CardContent>
                {learningRecommendations ? (
                  <div className="space-y-3">
                    {learningRecommendations.recommended_modes.map(
                      (mode: string, index: number) => (
                        <Button
                          key={index}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => onTrainingModeSelect?.(mode)}
                        >
                          <Gamepad2 className="h-4 w-4 mr-2" />
                          {mode.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Button>
                      )
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    Set up preferences to see personalized recommendations
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Session Structure Recommendations */}
          {learningRecommendations && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Optimal Session Structure
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Opening Style</h4>
                    <p className="text-xs text-muted-foreground">
                      {learningRecommendations.session_structure.opening === 'quick_start_action'
                        ? 'Jump right into action and engagement'
                        : 'Gentle warm-up and orientation'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-2">Content Structure</h4>
                    <p className="text-xs text-muted-foreground">
                      {learningRecommendations.session_structure.main_content.segments} segments
                      with{' '}
                      {learningRecommendations.session_structure.main_content.length_per_segment ===
                      'short_bursts'
                        ? 'quick, varied activities'
                        : 'deeper, focused exploration'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-2">Closing Style</h4>
                    <p className="text-xs text-muted-foreground">
                      {learningRecommendations.session_structure.closing === 'open_ended_reflection'
                        ? 'Open-ended reflection and questions'
                        : 'Clear summary and concrete takeaways'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Adaptive Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Adaptive Learning Preferences
              </CardTitle>
              <CardDescription>
                Customize how the system adapts to your unique learning style
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Preference customization interface would go here</p>
                  <p className="text-sm">
                    This would include settings for training modes, session preferences, interaction
                    styles, and personalization options
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
