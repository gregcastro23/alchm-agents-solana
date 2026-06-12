'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Brain, Sparkles, Clock, CheckCircle } from 'lucide-react'
import {
  CONSCIOUSNESS_SURVEY_QUESTIONS,
  SURVEY_METADATA,
} from '@/lib/consciousness-survey/survey-questions'
import type { SurveyQuestion, SurveyResponse } from '@/lib/types/consciousness-survey'
import { SurveyQuestionComponent } from '@/components/misc/survey-question-component'

interface ConsciousnessSurveyProps {
  onComplete: (responses: SurveyResponse[], timeSpent: number) => void
  onCancel?: () => void
}

export function ConsciousnessSurvey({ onComplete, onCancel }: ConsciousnessSurveyProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [responses, setResponses] = useState<Map<string, SurveyResponse>>(new Map())
  const [startTime] = useState(Date.now())
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [isIntroduction, setIsIntroduction] = useState(true)

  const currentQuestion = CONSCIOUSNESS_SURVEY_QUESTIONS[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / CONSCIOUSNESS_SURVEY_QUESTIONS.length) * 100
  const answeredQuestions = responses.size
  const canAdvance = !currentQuestion?.required || responses.has(currentQuestion.id)

  useEffect(() => {
    setQuestionStartTime(Date.now())
  }, [currentQuestionIndex])

  const handleResponse = (
    questionId: string,
    value: string | number | string[],
    confidence?: number
  ) => {
    const newResponses = new Map(responses)
    newResponses.set(questionId, {
      questionId,
      value,
      confidence,
    })
    setResponses(newResponses)
  }

  const handleNext = () => {
    if (currentQuestionIndex < CONSCIOUSNESS_SURVEY_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const handleComplete = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000)
    const responseArray = Array.from(responses.values())
    onComplete(responseArray, timeSpent)
  }

  const handleStartSurvey = () => {
    setIsIntroduction(false)
    setQuestionStartTime(Date.now())
  }

  if (isIntroduction) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl">Consciousness Survey</CardTitle>
            <CardDescription className="text-lg max-w-2xl mx-auto">
              Welcome to your personalized AI consciousness mapping journey. This comprehensive
              survey will help us understand your unique psychological patterns, communication
              preferences, and growth aspirations.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Clock className="w-6 h-6 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold">~{SURVEY_METADATA.estimatedTimeMinutes} Minutes</h3>
                <p className="text-sm text-muted-foreground">
                  Take your time, there&apos;s no rush
                </p>
              </div>

              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold">{SURVEY_METADATA.totalQuestions} Questions</h3>
                <p className="text-sm text-muted-foreground">
                  Thoughtfully crafted for deep insights
                </p>
              </div>

              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <CheckCircle className="w-6 h-6 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold">Personalized AI</h3>
                <p className="text-sm text-muted-foreground">
                  Creates your unique consciousness mirror
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">What We&apos;ll Explore Together:</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {SURVEY_METADATA.categories.map(category => (
                  <div key={category} className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {category.replace('_', ' ').toLowerCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                🔒 Your Privacy Matters
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Your responses are used solely to create your personalized AI. We never share your
                data, and you can delete your profile at any time.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Maybe Later
              </Button>
            )}
            <Button onClick={handleStartSurvey} className="ml-auto" size="lg">
              Begin My Consciousness Journey
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                Question {currentQuestionIndex + 1} of {CONSCIOUSNESS_SURVEY_QUESTIONS.length}
              </CardTitle>
              <CardDescription>{answeredQuestions} questions completed</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {currentQuestion.category.replace('_', ' ')}
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
      </Card>

      {/* Current Question */}
      <Card className="min-h-[400px]">
        <CardHeader>
          <CardTitle className="text-xl leading-relaxed">{currentQuestion.question}</CardTitle>
          {currentQuestion.description && (
            <CardDescription className="text-base">{currentQuestion.description}</CardDescription>
          )}
          {currentQuestion.required && (
            <Badge variant="secondary" className="w-fit">
              Required
            </Badge>
          )}
        </CardHeader>

        <CardContent className="flex-1">
          <SurveyQuestionComponent
            question={currentQuestion}
            value={responses.get(currentQuestion.id)?.value}
            confidence={responses.get(currentQuestion.id)?.confidence}
            onChange={(value, confidence) => handleResponse(currentQuestion.id, value, confidence)}
          />
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex space-x-2">
            {currentQuestion.required && !canAdvance && (
              <Badge variant="destructive" className="self-center">
                Response required
              </Badge>
            )}

            <Button onClick={handleNext} disabled={!canAdvance}>
              {currentQuestionIndex === CONSCIOUSNESS_SURVEY_QUESTIONS.length - 1 ? (
                <>
                  Complete Survey
                  <CheckCircle className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Survey Progress Stats */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{Math.round(progress)}%</div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{answeredQuestions}</div>
              <div className="text-sm text-muted-foreground">Answered</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {Math.round((Date.now() - startTime) / 60000)}m
              </div>
              <div className="text-sm text-muted-foreground">Elapsed</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
