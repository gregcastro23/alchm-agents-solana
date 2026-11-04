'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Brain, ArrowLeft, Settings, TrendingUp } from 'lucide-react'
import { PersonalizedAIChat } from '@/components/misc/personalized-ai-chat'
import type { PersonalizedAIConfig } from '@/lib/types/personalized-ai'
import { useToast } from '@/hooks/use-toast'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'
import { rateStats, evaluateSeals, earnedSeals, type CoreStats } from '@/lib/agents/rating'

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

  const companionRating = useMemo(() => {
    const levelBoost = Math.min(20, (aiConfig?.level ?? 1) * 2)
    const seed = personalityId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    const stats: CoreStats = {
      power: Math.min(99, 68 + levelBoost + (seed % 11)),
      resonance: Math.min(99, 72 + levelBoost + ((seed >> 1) % 10)),
      wisdom: Math.min(99, 74 + levelBoost + ((seed >> 2) % 9)),
      charisma: Math.min(99, 70 + levelBoost + ((seed >> 3) % 10)),
      intuition: Math.min(99, 73 + levelBoost + ((seed >> 4) % 9)),
      adaptability: Math.min(99, 71 + levelBoost + ((seed >> 5) % 10)),
      vitality: Math.min(99, 69 + levelBoost + ((seed >> 6) % 10)),
    }
    const esmsBalances = { spirit: 34, essence: 34, matter: 30, substance: 32 }
    const seals = earnedSeals(evaluateSeals({ stats, esmsBalances }))
    const rated = rateStats(stats)
    return { stats, seals, ...rated }
  }, [aiConfig?.level, personalityId])

  if (isLoading) {
    return (
      <div className="container py-8 max-w-2xl mx-auto">
        <Card className="border-white/10 bg-[#0d1020]/90 text-white backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-400" />
              <div>
                <h2 className="text-lg font-semibold text-white">Loading your AI companion...</h2>
                <p className="text-sm text-zinc-400">
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
        <Card className="border-white/10 bg-[#0d1020]/90 text-white backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-rose-400">
              <Brain className="w-5 h-5" />
              <span>AI Configuration Error</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h3 className="font-medium text-white">What you can do:</h3>
              <ul className="text-sm text-zinc-400 space-y-1">
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
              <Button onClick={() => router.push('/forge')}>Forge New Vessel</Button>
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
    <div className="container py-4 space-y-4">
      {/* Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0d1020]/90 p-4 backdrop-blur-xl">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">
                {aiConfig.basePersonality.archetype}
              </h1>
              <p className="text-xs font-mono text-zinc-400">
                Personality ID: {personalityId.split('-').pop()}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <VesselRatingRibbon
            ovr={companionRating.ovr}
            archetype={companionRating.archetype}
            seals={companionRating.seals}
            compact
          />

          <Badge
            variant="outline"
            className="flex items-center space-x-1 border-amber-400/35 bg-amber-400/10 text-amber-200"
          >
            <TrendingUp className="w-3 h-3" />
            <span>Level {aiConfig.level}</span>
          </Badge>

          <Button asChild variant="outline" size="sm" className="border-white/15 text-xs">
            <Link href="/arena">Arena →</Link>
          </Button>

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
