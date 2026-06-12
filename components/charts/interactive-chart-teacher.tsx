'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BookOpen,
  Star,
  Users,
  Lightbulb,
  Target,
  Brain,
  Heart,
  Eye,
  Crown,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Circle,
  PlayCircle,
  Clock,
  Award,
} from 'lucide-react'
import type {
  BirthChartFeature,
  AstrologicalLearningModule,
  RelationalAstrologyPattern,
  CosmicCurriculumProgress,
  InteractiveExercise,
} from '@/lib/astrological-education-engine'

interface InteractiveChartTeacherProps {
  userChartFeatures: BirthChartFeature[]
  currentModule?: AstrologicalLearningModule
  progress: CosmicCurriculumProgress
  onModuleSelect?: (moduleId: string) => void
  onExerciseComplete?: (exerciseId: string, results: any) => void
  universeConnectionLevel: number
  userElementalProfile?: string[]
  userPlanetaryEmphasis?: string[]
  relationalPatterns?: RelationalAstrologyPattern[]
  onScenarioComplete?: (scenarioId: string, results: any) => void
  onPatternMastery?: (patternId: string) => void
}

export function InteractiveChartTeacher({
  userChartFeatures,
  currentModule,
  progress,
  onModuleSelect,
  onExerciseComplete,
  universeConnectionLevel,
  userElementalProfile = ['fire', 'water'], // Default example
  userPlanetaryEmphasis = ['sun', 'moon'], // Default example
  relationalPatterns,
  onScenarioComplete,
  onPatternMastery,
}: InteractiveChartTeacherProps) {
  const [selectedFeature, setSelectedFeature] = useState<BirthChartFeature | null>(null)
  const [activeExercise, setActiveExercise] = useState<InteractiveExercise | null>(null)
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set())

  const getFeatureIcon = (featureType: string) => {
    switch (featureType) {
      case 'planet_sign':
        return <Star className="h-5 w-5" />
      case 'planet_house':
        return <Target className="h-5 w-5" />
      case 'aspect':
        return <ArrowRight className="h-5 w-5" />
      case 'stellium':
        return <Sparkles className="h-5 w-5" />
      case 'dignity':
        return <Crown className="h-5 w-5" />
      default:
        return <Circle className="h-5 w-5" />
    }
  }

  const getSignificanceColor = (level: string) => {
    switch (level) {
      case 'foundational':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'important':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'notable':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'subtle':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getModuleTypeIcon = (type: string) => {
    switch (type) {
      case 'foundational':
        return <BookOpen className="h-4 w-4" />
      case 'personal':
        return <Heart className="h-4 w-4" />
      case 'relational':
        return <Users className="h-4 w-4" />
      case 'evolutionary':
        return <Brain className="h-4 w-4" />
      case 'universal':
        return <Eye className="h-4 w-4" />
      default:
        return <Circle className="h-4 w-4" />
    }
  }

  const getExerciseTypeIcon = (type: string) => {
    switch (type) {
      case 'visualization':
        return <Eye className="h-4 w-4" />
      case 'meditation':
        return <Brain className="h-4 w-4" />
      case 'journaling':
        return <BookOpen className="h-4 w-4" />
      case 'observation':
        return <Target className="h-4 w-4" />
      case 'experimentation':
        return <Lightbulb className="h-4 w-4" />
      case 'dialogue':
        return <Users className="h-4 w-4" />
      default:
        return <PlayCircle className="h-4 w-4" />
    }
  }

  const foundationalFeatures = userChartFeatures.filter(
    f => f.significance_level === 'foundational'
  )
  const importantFeatures = userChartFeatures.filter(f => f.significance_level === 'important')
  const notableFeatures = userChartFeatures.filter(f => f.significance_level === 'notable')

  return (
    <div className="space-y-6">
      {/* Universe Connection Header */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-indigo-600" />
            Learning Yourself to Understand the Universe
          </CardTitle>
          <CardDescription>
            Progress: {universeConnectionLevel}% Universal Consciousness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress value={universeConnectionLevel} className="h-3" />
            <div className="text-sm text-muted-foreground">
              {universeConnectionLevel < 25 && '🌱 Beginning cosmic awareness'}
              {universeConnectionLevel >= 25 &&
                universeConnectionLevel < 50 &&
                '⭐ Recognizing cosmic patterns'}
              {universeConnectionLevel >= 50 &&
                universeConnectionLevel < 75 &&
                '🌙 Integrating personal-universal wisdom'}
              {universeConnectionLevel >= 75 && '🌟 Embodying cosmic consciousness'}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="chart-features" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chart-features">Your Chart</TabsTrigger>
          <TabsTrigger value="current-lesson">Current Lesson</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="practice">Practice</TabsTrigger>
        </TabsList>

        {/* Your Birth Chart Features */}
        <TabsContent value="chart-features" className="space-y-4">
          <div className="grid gap-4">
            {/* Foundational Features */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Crown className="h-5 w-5 text-purple-600" />
                Foundational Features
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {foundationalFeatures.map(feature => (
                  <Card
                    key={feature.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedFeature?.id === feature.id ? 'ring-2 ring-purple-500' : ''
                    }`}
                    onClick={() => setSelectedFeature(feature)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {getFeatureIcon(feature.feature_type)}
                        {feature.title}
                      </CardTitle>
                      <Badge className={getSignificanceColor(feature.significance_level)}>
                        {feature.significance_level}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {feature.description}
                      </p>
                      <div className="mt-2 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-yellow-500" />
                        <span className="text-xs">{feature.cosmic_purpose}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Important Features */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Star className="h-5 w-5 text-blue-600" />
                Important Features
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {importantFeatures.map(feature => (
                  <Card
                    key={feature.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedFeature?.id === feature.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedFeature(feature)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {getFeatureIcon(feature.feature_type)}
                        {feature.title}
                      </CardTitle>
                      <Badge className={getSignificanceColor(feature.significance_level)}>
                        {feature.significance_level}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Selected Feature Detail */}
          {selectedFeature && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getFeatureIcon(selectedFeature.feature_type)}
                  {selectedFeature.title}
                </CardTitle>
                <CardDescription>{selectedFeature.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      How This Shows Up For You
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedFeature.personal_manifestation}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Growth Opportunities
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {selectedFeature.growth_opportunities.map((opportunity, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <ArrowRight className="h-3 w-3 mt-0.5 text-green-500" />
                          {opportunity}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    Cosmic Purpose
                  </h4>
                  <p className="text-sm text-muted-foreground">{selectedFeature.cosmic_purpose}</p>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onModuleSelect?.(selectedFeature.id)}>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Learn More
                  </Button>
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4 mr-2" />
                    Relationships
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Current Learning Module */}
        <TabsContent value="current-lesson" className="space-y-4">
          {currentModule ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getModuleTypeIcon(currentModule.module_type)}
                  {currentModule.title}
                </CardTitle>
                <Badge>{currentModule.module_type}</Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Overview</h4>
                  <p className="text-sm text-muted-foreground">{currentModule.content.overview}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Key Concepts</h4>
                  <ul className="space-y-1">
                    {currentModule.content.key_concepts.map((concept, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                        {concept}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Personal Examples</h4>
                  <div className="space-y-2">
                    {currentModule.content.personal_examples.map((example, index) => (
                      <div key={index} className="p-3 bg-blue-50 rounded-lg text-sm">
                        {example}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Interactive Exercises</h4>
                  <div className="space-y-3">
                    {currentModule.content.interactive_exercises.map(exercise => (
                      <Card key={exercise.id} className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            {getExerciseTypeIcon(exercise.exercise_type)}
                            {exercise.title}
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              {exercise.duration_minutes}m
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            {exercise.instructions}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={completedExercises.has(exercise.id) ? 'outline' : 'default'}
                              onClick={() => setActiveExercise(exercise)}
                            >
                              {completedExercises.has(exercise.id) ? (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Completed
                                </>
                              ) : (
                                <>
                                  <PlayCircle className="h-4 w-4 mr-2" />
                                  Start Exercise
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Reflection Questions</h4>
                  <div className="space-y-2">
                    {currentModule.content.reflection_questions.map((question, index) => (
                      <div key={index} className="p-3 bg-purple-50 rounded-lg">
                        <p className="text-sm font-medium">💭 {question}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Select a chart feature to begin learning</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Relational Astrology */}
        <TabsContent value="relationships" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Understanding Cosmic Relationships
              </CardTitle>
              <CardDescription>
                Learn how your chart interacts with other signs and patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Relational astrology training is available in the main dashboard</p>
                <p className="text-sm">
                  Switch to the &quot;Relational Practice&quot; tab to explore patterns
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Practice Exercises */}
        <TabsContent value="practice" className="space-y-4">
          {activeExercise ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getExerciseTypeIcon(activeExercise.exercise_type)}
                  {activeExercise.title}
                </CardTitle>
                <Badge>{activeExercise.exercise_type}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium mb-2">Instructions</h4>
                  <p className="text-sm">{activeExercise.instructions}</p>
                </div>

                {activeExercise.materials_needed && (
                  <div>
                    <h4 className="font-medium mb-2">Materials Needed</h4>
                    <ul className="text-sm space-y-1">
                      {activeExercise.materials_needed.map((material, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Circle className="h-3 w-3" />
                          {material}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-2">Success Criteria</h4>
                  <ul className="space-y-1">
                    {activeExercise.success_criteria.map((criteria, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Target className="h-4 w-4 text-green-500" />
                        {criteria}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setCompletedExercises(prev => new Set(prev).add(activeExercise.id))
                      onExerciseComplete?.(activeExercise.id, { completed: true })
                      setActiveExercise(null)
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                  <Button variant="outline" onClick={() => setActiveExercise(null)}>
                    Back to Lesson
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <PlayCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Start an exercise from your current lesson</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
