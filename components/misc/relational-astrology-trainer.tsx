'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Users,
  Heart,
  Zap,
  Droplets,
  Wind,
  Mountain,
  Sun,
  Moon,
  MessageCircle,
  Star,
  ArrowRight,
  CheckCircle,
  PlayCircle,
  Brain,
  Lightbulb,
  Target,
  Award,
  Flame,
  Waves,
  Cloud,
  TreePine,
} from 'lucide-react'
import type {
  RelationalAstrologyPattern,
  PracticeScenario,
  CosmicCurriculumProgress,
} from '@/lib/astrological-education-engine'

interface RelationalAstrologyTrainerProps {
  userElementalProfile: string[] // Primary elements in user's chart
  userPlanetaryEmphasis: string[] // Prominent planets in user's chart
  availablePatterns: RelationalAstrologyPattern[]
  progress: CosmicCurriculumProgress
  onScenarioComplete?: (scenarioId: string, results: any) => void
  onPatternMastery?: (patternId: string) => void
}

export function RelationalAstrologyTrainer({
  userElementalProfile,
  userPlanetaryEmphasis,
  availablePatterns,
  progress,
  onScenarioComplete,
  onPatternMastery,
}: RelationalAstrologyTrainerProps) {
  const [selectedPattern, setSelectedPattern] = useState<RelationalAstrologyPattern | null>(null)
  const [activeScenario, setActiveScenario] = useState<PracticeScenario | null>(null)
  const [completedScenarios, setCompletedScenarios] = useState<Set<string>>(new Set())
  const [practiceMode, setPracticeMode] = useState<'learn' | 'practice' | 'integrate'>('learn')

  const getElementIcon = (element: string) => {
    switch (element.toLowerCase()) {
      case 'fire':
        return <Flame className="h-5 w-5 text-red-500" />
      case 'water':
        return <Droplets className="h-5 w-5 text-blue-500" />
      case 'air':
        return <Wind className="h-5 w-5 text-yellow-500" />
      case 'earth':
        return <Mountain className="h-5 w-5 text-green-500" />
      default:
        return <Star className="h-5 w-5" />
    }
  }

  const getPlanetIcon = (planet: string) => {
    switch (planet.toLowerCase()) {
      case 'sun':
        return <Sun className="h-5 w-5 text-orange-500" />
      case 'moon':
        return <Moon className="h-5 w-5 text-gray-400" />
      case 'mercury':
        return <MessageCircle className="h-5 w-5 text-gray-600" />
      case 'venus':
        return <Heart className="h-5 w-5 text-pink-500" />
      case 'mars':
        return <Zap className="h-5 w-5 text-red-600" />
      default:
        return <Star className="h-5 w-5" />
    }
  }

  const getPatternTypeIcon = (type: string) => {
    switch (type) {
      case 'element_dance':
        return <Users className="h-5 w-5" />
      case 'planetary_dialogue':
        return <MessageCircle className="h-5 w-5" />
      case 'synastry':
        return <Heart className="h-5 w-5" />
      case 'composite':
        return <Star className="h-5 w-5" />
      default:
        return <Brain className="h-5 w-5" />
    }
  }

  const getHarmonyColor = (potential: number) => {
    if (potential >= 90) return 'bg-green-100 text-green-800 border-green-200'
    if (potential >= 70) return 'bg-blue-100 text-blue-800 border-blue-200'
    if (potential >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getChallengeColor = (potential: number) => {
    if (potential >= 70) return 'bg-red-100 text-red-800 border-red-200'
    if (potential >= 50) return 'bg-orange-100 text-orange-800 border-orange-200'
    if (potential >= 30) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-green-100 text-green-800 border-green-200'
  }

  // Filter patterns relevant to user's chart
  const relevantPatterns = availablePatterns.filter(pattern => {
    const hasElementalMatch = pattern.participants.some(participant =>
      userElementalProfile.some(element =>
        participant.toLowerCase().includes(element.toLowerCase())
      )
    )
    const hasPlanetaryMatch = pattern.participants.some(participant =>
      userPlanetaryEmphasis.some(planet => participant.toLowerCase().includes(planet.toLowerCase()))
    )
    return hasElementalMatch || hasPlanetaryMatch
  })

  const elementalPatterns = relevantPatterns.filter(p => p.pattern_type === 'element_dance')
  const planetaryPatterns = relevantPatterns.filter(p => p.pattern_type === 'planetary_dialogue')

  const getPatternMastery = (patternId: string): number => {
    return progress.relational_understanding[patternId] || 0
  }

  const handleScenarioComplete = (scenario: PracticeScenario) => {
    setCompletedScenarios(prev => new Set(prev).add(scenario.id))
    onScenarioComplete?.(scenario.id, {
      completed: true,
      patternId: selectedPattern?.id,
      insights: scenario.integration_reflection,
    })

    // Check if pattern is mastered (all scenarios completed)
    if (selectedPattern) {
      const allScenarios = selectedPattern.practice_scenarios
      const allCompleted = allScenarios.every(
        s => completedScenarios.has(s.id) || s.id === scenario.id
      )
      if (allCompleted) {
        onPatternMastery?.(selectedPattern.id)
      }
    }

    setActiveScenario(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-600" />
            Relational Astrology Training
          </CardTitle>
          <CardDescription>Learn how your cosmic energies interact with others</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="text-sm font-medium">Your Elemental Emphasis:</div>
            {userElementalProfile.map(element => (
              <Badge key={element} variant="outline" className="flex items-center gap-1">
                {getElementIcon(element)}
                {element}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="text-sm font-medium">Your Planetary Emphasis:</div>
            {userPlanetaryEmphasis.map(planet => (
              <Badge key={planet} variant="outline" className="flex items-center gap-1">
                {getPlanetIcon(planet)}
                {planet}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={practiceMode}
        onValueChange={(value: string) =>
          setPracticeMode(value as 'learn' | 'practice' | 'integrate')
        }
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="learn">Learn Patterns</TabsTrigger>
          <TabsTrigger value="practice">Practice Scenarios</TabsTrigger>
          <TabsTrigger value="integrate">Integration</TabsTrigger>
        </TabsList>

        {/* Learn Patterns Tab */}
        <TabsContent value="learn" className="space-y-4">
          <div className="grid gap-4">
            {/* Elemental Patterns */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Elemental Dynamics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {elementalPatterns.map(pattern => (
                  <Card
                    key={pattern.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedPattern?.id === pattern.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedPattern(pattern)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {getPatternTypeIcon(pattern.pattern_type)}
                        {pattern.interaction_theme}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge className={getHarmonyColor(pattern.harmony_potential)}>
                          Harmony: {pattern.harmony_potential}%
                        </Badge>
                        <Badge className={getChallengeColor(pattern.challenge_potential)}>
                          Challenge: {pattern.challenge_potential}%
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 mb-2">
                        {pattern.participants.map((participant, idx) => (
                          <React.Fragment key={participant}>
                            {idx > 0 && <ArrowRight className="h-3 w-3" />}
                            <span className="text-xs font-medium">{participant}</span>
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Mastery: {getPatternMastery(pattern.id)}%
                        </span>
                        <Progress value={getPatternMastery(pattern.id)} className="w-16 h-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Planetary Patterns */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-purple-600" />
                Planetary Dialogues
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {planetaryPatterns.map(pattern => (
                  <Card
                    key={pattern.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedPattern?.id === pattern.id ? 'ring-2 ring-purple-500' : ''
                    }`}
                    onClick={() => setSelectedPattern(pattern)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {getPatternTypeIcon(pattern.pattern_type)}
                        {pattern.interaction_theme}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge className={getHarmonyColor(pattern.harmony_potential)}>
                          Harmony: {pattern.harmony_potential}%
                        </Badge>
                        <Badge className={getChallengeColor(pattern.challenge_potential)}>
                          Challenge: {pattern.challenge_potential}%
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 mb-2">
                        {pattern.participants.map((participant, idx) => (
                          <React.Fragment key={participant}>
                            {idx > 0 && <ArrowRight className="h-3 w-3" />}
                            <span className="text-xs font-medium">{participant}</span>
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Mastery: {getPatternMastery(pattern.id)}%
                        </span>
                        <Progress value={getPatternMastery(pattern.id)} className="w-16 h-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Selected Pattern Detail */}
          {selectedPattern && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getPatternTypeIcon(selectedPattern.pattern_type)}
                  {selectedPattern.interaction_theme}
                </CardTitle>
                <CardDescription>{selectedPattern.growth_catalyst}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Learning Objectives
                    </h4>
                    <ul className="text-sm space-y-1">
                      {selectedPattern.learning_objectives.map((objective, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle className="h-3 w-3 mt-0.5 text-green-500" />
                          {objective}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      Consciousness Development
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedPattern.consciousness_development}
                    </p>
                    <div className="mt-2">
                      <h5 className="text-xs font-medium">Universal Principle:</h5>
                      <p className="text-xs text-muted-foreground italic">
                        {selectedPattern.universal_principle}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setPracticeMode('practice')}>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Practice Scenarios
                  </Button>
                  <Button variant="outline" onClick={() => setPracticeMode('integrate')}>
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Integration
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Practice Scenarios Tab */}
        <TabsContent value="practice" className="space-y-4">
          {selectedPattern ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PlayCircle className="h-5 w-5" />
                    Practice Scenarios: {selectedPattern.interaction_theme}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedPattern.practice_scenarios.map(scenario => (
                      <Card
                        key={scenario.id}
                        className={`border-l-4 ${
                          completedScenarios.has(scenario.id)
                            ? 'border-l-green-500 bg-green-50'
                            : 'border-l-blue-500'
                        }`}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            {completedScenarios.has(scenario.id) ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <PlayCircle className="h-4 w-4 text-blue-500" />
                            )}
                            {scenario.scenario_title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            {scenario.situation_description}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={completedScenarios.has(scenario.id) ? 'outline' : 'default'}
                              onClick={() => setActiveScenario(scenario)}
                            >
                              {completedScenarios.has(scenario.id) ? 'Review' : 'Start Practice'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Active Scenario Detail */}
              {activeScenario && (
                <Card className="border-2 border-blue-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      {activeScenario.scenario_title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium mb-2">Situation</h4>
                      <p className="text-sm">{activeScenario.situation_description}</p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Astrological Dynamics</h4>
                      <ul className="space-y-1">
                        {activeScenario.astrological_dynamics.map((dynamic, index) => (
                          <li key={index} className="text-sm flex items-start gap-2">
                            <Star className="h-3 w-3 mt-0.5 text-yellow-500" />
                            {dynamic}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Practice Instructions</h4>
                      <p className="text-sm p-3 bg-yellow-50 rounded-lg">
                        {activeScenario.practice_instructions}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Awareness Points</h4>
                      <ul className="space-y-1">
                        {activeScenario.awareness_points.map((point, index) => (
                          <li key={index} className="text-sm flex items-start gap-2">
                            <Lightbulb className="h-3 w-3 mt-0.5 text-orange-500" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium mb-2">Integration Reflection</h4>
                      <p className="text-sm italic">{activeScenario.integration_reflection}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => handleScenarioComplete(activeScenario)}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Complete Practice
                      </Button>
                      <Button variant="outline" onClick={() => setActiveScenario(null)}>
                        Back to Scenarios
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Select a pattern to practice scenarios</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Integration Tab */}
        <TabsContent value="integrate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Relational Mastery Progress
              </CardTitle>
              <CardDescription>Your journey in understanding cosmic relationships</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {relevantPatterns.map(pattern => {
                const mastery = getPatternMastery(pattern.id)
                const completedCount = pattern.practice_scenarios.filter(s =>
                  completedScenarios.has(s.id)
                ).length
                const totalCount = pattern.practice_scenarios.length

                return (
                  <div key={pattern.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getPatternTypeIcon(pattern.pattern_type)}
                        <span className="font-medium">{pattern.interaction_theme}</span>
                      </div>
                      <Badge variant="outline">
                        {completedCount}/{totalCount} scenarios
                      </Badge>
                    </div>
                    <Progress value={mastery} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      {mastery < 25 && '🌱 Beginning awareness'}
                      {mastery >= 25 && mastery < 50 && '🌿 Growing understanding'}
                      {mastery >= 50 && mastery < 75 && '🌸 Developing mastery'}
                      {mastery >= 75 && '🌟 Approaching mastery'}
                    </div>
                  </div>
                )
              })}

              <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                <h4 className="font-medium mb-2">Universal Integration Insight</h4>
                <p className="text-sm text-muted-foreground">
                  As you master these relational patterns, you develop the wisdom to see yourself in
                  others and others in yourself. Each interaction becomes an opportunity to
                  understand both your unique nature and the universal principles that connect all
                  beings.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
