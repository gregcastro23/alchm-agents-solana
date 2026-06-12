'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Brain, ArrowLeft, Settings, TrendingUp } from 'lucide-react'
import { PersonalizedAIChat } from '@/components/misc/personalized-ai-chat'
import type { PersonalizedAIConfig } from '@/lib/types/personalized-ai'
import { useToast } from '@/hooks/use-toast'

export default function PersonalizedAIChatPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const personalityId = params.id as string

  const [aiConfig, setAiConfig] = useState<PersonalizedAIConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAIConfig = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/personalized-ai/${personalityId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load AI configuration')
      }

      setAiConfig(data.aiConfig)
    } catch (err) {
      console.error('Error loading AI config:', err)
      setError(err instanceof Error ? err.message : 'Failed to load AI configuration')
    } finally {
      setIsLoading(false)
    }
  }, [personalityId])

  useEffect(() => {
    if (personalityId) {
      fetchAIConfig()
    }
  }, [personalityId, fetchAIConfig])

  const handleXPUpdate = (newXP: number, newLevel: number) => {
    if (aiConfig) {
      setAiConfig(prev =>
        prev
          ? {
              ...prev,
              totalXp: newXP,
              level: newLevel,
            }
          : null
      )
    }
  }

  const handleAchievementUnlock = (achievements: any[]) => {
    achievements.forEach(achievement => {
      toast({
        title: '🏆 Achievement Unlocked!',
        description: `${achievement.achievementData.name}: ${achievement.achievementData.description}`,
        duration: 5000,
      })
    })
  }

  if (isLoading) {
    return (
      <div className="container py-8 max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Loading your AI companion...</h2>
                <p className="text-sm text-muted-foreground">
                  Retrieving your personalized consciousness configuration
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-8 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-destructive">
              <Brain className="w-5 h-5" />
              <span>AI Configuration Error</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h3 className="font-medium">What you can do:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Check that the personality ID is correct</li>
                <li>• Try creating a new AI consciousness if this one is missing</li>
                <li>• Contact support if the problem persists</li>
              </ul>
            </div>

            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
              <Button onClick={() => router.push('/consciousness-survey')}>Create New AI</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!aiConfig) {
    return null
  }

  return (
    <div className="container py-4">
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{aiConfig.basePersonality.archetype}</h1>
              <p className="text-sm text-muted-foreground">
                Personality ID: {personalityId.split('-').pop()}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3" />
            <span>Level {aiConfig.level}</span>
          </Badge>

          <Button variant="ghost" size="sm">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Chat Interface */}
      <PersonalizedAIChat
        aiConfig={aiConfig}
        onXPUpdate={handleXPUpdate}
        onAchievementUnlock={handleAchievementUnlock}
      />
    </div>
  )
}
