'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Heart,
  Users,
  Star,
  Zap,
  TrendingUp,
  MessageCircle,
  Brain,
  Lightbulb,
  Target,
  Crown,
  Sparkles,
  Calendar,
  BookOpen,
  Award,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Info,
  Flame,
  Droplets,
  Wind,
  Mountain,
} from 'lucide-react'
import type {
  SynastryChart,
  SynastryReport,
  CompatibilityAnalysis,
  SynastryAspect,
  RelationshipStrength,
  RelationshipChallenge,
} from '@/lib/synastry-compatibility-engine'
import {
  SynastryAnalysisEngine,
  getCompatibilityInterpretation,
  COMPATIBILITY_INTERPRETATIONS,
} from '@/lib/synastry-compatibility-engine'

interface SynastryCompatibilityDashboardProps {
  synastryChart: SynastryChart
  onReportGenerate?: (report: SynastryReport) => void
  onInsightSave?: (insight: string) => void
}

export function SynastryCompatibilityDashboard({
  synastryChart,
  onReportGenerate,
  onInsightSave,
}: SynastryCompatibilityDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'aspects' | 'compatibility' | 'guidance'>(
    'overview'
  )
  const [selectedAspect, setSelectedAspect] = useState<SynastryAspect | null>(null)

  // Generate complete synastry report
  const synastryReport = useMemo(() => {
    const report = SynastryAnalysisEngine.generateSynastryReport(synastryChart)
    onReportGenerate?.(report)
    return report
  }, [synastryChart, onReportGenerate])

  const compatibility = synastryReport.compatibility_analysis
  const compatibilityInterpretation = getCompatibilityInterpretation(
    compatibility.overall_compatibility
  )

  const getElementIcon = (element: string) => {
    switch (element.toLowerCase()) {
      case 'fire':
        return <Flame className="h-4 w-4 text-red-500" />
      case 'water':
        return <Droplets className="h-4 w-4 text-blue-500" />
      case 'air':
        return <Wind className="h-4 w-4 text-yellow-500" />
      case 'earth':
        return <Mountain className="h-4 w-4 text-green-500" />
      default:
        return <Star className="h-4 w-4" />
    }
  }

  const getAspectIcon = (aspectType: string) => {
    switch (aspectType) {
      case 'conjunction':
        return <Zap className="h-4 w-4 text-purple-500" />
      case 'trine':
        return <Star className="h-4 w-4 text-green-500" />
      case 'sextile':
        return <Sparkles className="h-4 w-4 text-blue-500" />
      case 'square':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case 'opposition':
        return <ArrowRight className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  const getCompatibilityColor = (score: number) => {
    if (score >= 90) return 'from-green-50 to-emerald-50 border-green-200'
    if (score >= 80) return 'from-blue-50 to-sky-50 border-blue-200'
    if (score >= 70) return 'from-yellow-50 to-amber-50 border-yellow-200'
    if (score >= 60) return 'from-orange-50 to-red-50 border-orange-200'
    return 'from-red-50 to-pink-50 border-red-200'
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 80) return 'text-blue-600'
    if (score >= 70) return 'text-yellow-600'
    if (score >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Header - Relationship Overview */}
      <Card
        className={`bg-gradient-to-r ${getCompatibilityColor(compatibility.overall_compatibility)}`}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Heart className="h-8 w-8 text-pink-600" />
            <div>
              <h1 className="text-2xl font-bold">
                {synastryChart.person1.name} & {synastryChart.person2.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Synastry & Compatibility Analysis
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Compatibility</span>
                <span
                  className={`text-2xl font-bold ${getScoreColor(compatibility.overall_compatibility)}`}
                >
                  {compatibility.overall_compatibility}%
                </span>
              </div>
              <Progress value={compatibility.overall_compatibility} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {compatibilityInterpretation.description}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Growth Potential</span>
                <span className="text-lg font-bold">
                  {compatibility.growth_catalyst_potential}%
                </span>
              </div>
              <Progress value={compatibility.growth_catalyst_potential} className="h-3" />
              <div className="flex flex-wrap gap-1">
                {compatibilityInterpretation.keywords.slice(0, 2).map((keyword, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Relationship Purpose</span>
                <Crown className="h-5 w-5 text-violet-600" />
              </div>
              <p className="text-sm text-muted-foreground">
                {synastryReport.composite_chart.relationship_purpose}
              </p>
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="aspects">Aspects</TabsTrigger>
          <TabsTrigger value="compatibility">Compatibility</TabsTrigger>
          <TabsTrigger value="guidance">Guidance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Elemental Harmony */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Elemental Harmony
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{synastryChart.person1.name}</h4>
                    <div className="flex items-center gap-2">
                      {getElementIcon(synastryChart.person1.elemental_emphasis.dominant_element)}
                      <span className="text-sm capitalize">
                        {synastryChart.person1.elemental_emphasis.dominant_element}
                      </span>
                      <Badge variant="outline">Primary</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {getElementIcon(synastryChart.person1.elemental_emphasis.secondary_element)}
                      <span className="text-sm capitalize">
                        {synastryChart.person1.elemental_emphasis.secondary_element}
                      </span>
                      <Badge variant="outline">Secondary</Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{synastryChart.person2.name}</h4>
                    <div className="flex items-center gap-2">
                      {getElementIcon(synastryChart.person2.elemental_emphasis.dominant_element)}
                      <span className="text-sm capitalize">
                        {synastryChart.person2.elemental_emphasis.dominant_element}
                      </span>
                      <Badge variant="outline">Primary</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {getElementIcon(synastryChart.person2.elemental_emphasis.secondary_element)}
                      <span className="text-sm capitalize">
                        {synastryChart.person2.elemental_emphasis.secondary_element}
                      </span>
                      <Badge variant="outline">Secondary</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Elemental Compatibility</span>
                    <span
                      className={`font-medium ${getScoreColor(compatibility.elemental_harmony)}`}
                    >
                      {compatibility.elemental_harmony}%
                    </span>
                  </div>
                  <Progress value={compatibility.elemental_harmony} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Top Aspects */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Key Synastry Aspects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {synastryReport.major_aspects.slice(0, 4).map(aspect => (
                    <div
                      key={aspect.id}
                      className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => setSelectedAspect(aspect)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {getAspectIcon(aspect.aspect_type)}
                        <span className="text-sm font-medium">
                          {aspect.person1}&apos;s {aspect.planet1} {aspect.aspect_type}{' '}
                          {aspect.person2}&apos;s {aspect.planet2}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {aspect.aspect_strength}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{aspect.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Relationship Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Relationship Evolution Timeline
              </CardTitle>
              <CardDescription>The natural phases of your relationship journey</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {synastryReport.relationship_timeline.map((phase, index) => (
                  <div key={phase.phase_name} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                      </div>
                      {index < synastryReport.relationship_timeline.length - 1 && (
                        <div className="w-px h-16 bg-gray-200 mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-8">
                      <h4 className="font-medium">{phase.phase_name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{phase.timeframe}</p>
                      <p className="text-sm mb-2">{phase.consciousness_focus}</p>
                      <div className="flex flex-wrap gap-1">
                        {phase.key_themes.slice(0, 3).map((theme, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aspects Tab */}
        <TabsContent value="aspects" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Major Synastry Aspects</CardTitle>
                <CardDescription>Planetary connections between your charts</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {synastryReport.major_aspects.map(aspect => (
                      <Card
                        key={aspect.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedAspect?.id === aspect.id ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => setSelectedAspect(aspect)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {getAspectIcon(aspect.aspect_type)}
                            <span className="font-medium text-sm">
                              {aspect.planet1} {aspect.aspect_type} {aspect.planet2}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {aspect.orb}° orb
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Harmony: </span>
                              <span className={getScoreColor(aspect.harmony_rating)}>
                                {aspect.harmony_rating}%
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Growth: </span>
                              <span className={getScoreColor(aspect.growth_potential)}>
                                {aspect.growth_potential}%
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Aspect Detail */}
            {selectedAspect && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getAspectIcon(selectedAspect.aspect_type)}
                    {selectedAspect.planet1} {selectedAspect.aspect_type} {selectedAspect.planet2}
                  </CardTitle>
                  <CardDescription>
                    {selectedAspect.person1} & {selectedAspect.person2}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">{selectedAspect.description}</p>

                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Relationship Themes</h4>
                    <ul className="text-sm space-y-1">
                      {selectedAspect.relationship_themes.map((theme, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Heart className="h-3 w-3 text-pink-500" />
                          {theme}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Consciousness Lessons</h4>
                    <ul className="text-sm space-y-1">
                      {selectedAspect.consciousness_lessons.map((lesson, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Brain className="h-3 w-3 text-purple-500" />
                          {lesson}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Compatibility Tab */}
        <TabsContent value="compatibility" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Compatibility Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Compatibility Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Overall Compatibility', value: compatibility.overall_compatibility },
                  { label: 'Elemental Harmony', value: compatibility.elemental_harmony },
                  { label: 'Communication Match', value: compatibility.communication_style_match },
                  {
                    label: 'Emotional Compatibility',
                    value: compatibility.emotional_compatibility,
                  },
                  { label: 'Values Alignment', value: compatibility.values_alignment },
                  { label: 'Growth Potential', value: compatibility.growth_catalyst_potential },
                ].map(item => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className={`font-bold ${getScoreColor(item.value)}`}>
                        {item.value}%
                      </span>
                    </div>
                    <Progress value={item.value} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Strengths & Challenges */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Strengths & Growth Areas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Key Strengths
                  </h4>
                  {compatibility.strengths.slice(0, 2).map((strength, index) => (
                    <div key={index} className="p-3 bg-green-50 rounded-lg">
                      <h5 className="font-medium text-sm text-green-800">{strength.area}</h5>
                      <p className="text-xs text-green-700 mt-1">{strength.description}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-orange-500" />
                    Growth Areas
                  </h4>
                  {compatibility.challenges.slice(0, 2).map((challenge, index) => (
                    <div key={index} className="p-3 bg-orange-50 rounded-lg">
                      <h5 className="font-medium text-sm text-orange-800">{challenge.area}</h5>
                      <p className="text-xs text-orange-700 mt-1">{challenge.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Universal Lesson */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Universal Lesson & Purpose
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg">
                <p className="text-sm font-medium text-violet-800 mb-2">
                  {compatibility.universal_lesson}
                </p>
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-violet-700">
                    Consciousness Development Areas:
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {compatibility.consciousness_development_areas.map((area, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="text-xs text-violet-700 border-violet-200"
                      >
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guidance Tab */}
        <TabsContent value="guidance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Practices */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Daily Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {synastryReport.practical_guidance.daily_practices.map((practice, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                      {practice}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Communication Strategies */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Communication Strategies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {synastryReport.practical_guidance.communication_strategies.map(
                    (strategy, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <MessageCircle className="h-4 w-4 mt-0.5 text-blue-500" />
                        {strategy}
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Personalized Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {compatibility.recommendations.map((recommendation, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{recommendation.title}</CardTitle>
                      <Badge variant="outline" className="w-fit">
                        {recommendation.category}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        {recommendation.description}
                      </p>
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium">Specific Practices:</h4>
                        <ul className="text-xs space-y-1">
                          {recommendation.specific_practices.map((practice, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <ArrowRight className="h-3 w-3 mt-0.5 text-gray-400" />
                              {practice}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
