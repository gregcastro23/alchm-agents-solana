'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Sparkles,
  Star,
  TrendingUp,
  Users,
  RefreshCw,
  ChevronRight,
  Heart,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

interface AgentRecommendation {
  agentId: string
  name: string
  compatibilityScore: number
  reasons: string[]
  evolutionPotential: number
  elementalAlignment: number
  currentLevel?: string
  totalPower?: number
  interactionCount?: number
  lastInteraction?: string | null
}

interface RecommendationsResponse {
  success: boolean
  recommendations: AgentRecommendation[]
  userProfile?: {
    birthChart: any
    totalAgentsAvailable: number
    recommendationsGenerated: string
  }
  error?: string
  message?: string
}

export function AgentRecommendationsWidget() {
  const [recommendations, setRecommendations] = useState<AgentRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRecommendations = async () => {
    try {
      const response = await fetch('/api/agent-recommendations')
      const data: RecommendationsResponse = await response.json()

      if (data.success) {
        setRecommendations(data.recommendations)
        setError(null)
      } else {
        setError(data.error || 'Failed to get recommendations')
      }
    } catch (err) {
      setError('Network error - please try again')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refreshRecommendations = async () => {
    setRefreshing(true)
    await fetchRecommendations()
  }

  useEffect(() => {
    fetchRecommendations()
  }, [])

  const getCompatibilityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50'
    if (score >= 0.6) return 'text-blue-600 bg-blue-50'
    if (score >= 0.4) return 'text-yellow-600 bg-yellow-50'
    return 'text-gray-600 bg-gray-50'
  }

  const getCompatibilityText = (score: number) => {
    if (score >= 0.8) return 'Excellent'
    if (score >= 0.6) return 'Very Good'
    if (score >= 0.4) return 'Good'
    return 'Moderate'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Agent Recommendations
          </CardTitle>
          <CardDescription>Finding your perfect consciousness matches...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Agent Recommendations
          </CardTitle>
          <CardDescription>Personalized consciousness matches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-gray-600 mb-4">{error}</p>
            {error.includes('Birth chart') ? (
              <Link href="/auth/signin">
                <Button variant="outline">
                  Complete Birth Chart
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <Button onClick={fetchRecommendations} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Recommended Agents
            </CardTitle>
            <CardDescription>Personalized matches based on your birth chart</CardDescription>
          </div>
          <Button onClick={refreshRecommendations} variant="ghost" size="sm" disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.map((rec, index) => (
            <div
              key={rec.agentId}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{rec.name}</h3>
                    {index === 0 && (
                      <Badge className="bg-gold-50 text-gold-600 text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Top Match
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <div
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getCompatibilityColor(rec.compatibilityScore)}`}
                    >
                      {Math.round(rec.compatibilityScore * 100)}%{' '}
                      {getCompatibilityText(rec.compatibilityScore)}
                    </div>

                    {rec.currentLevel && (
                      <Badge variant="outline" className="text-xs">
                        {rec.currentLevel} • {rec.totalPower || 0} power
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1 mb-3">
                    {rec.reasons.slice(0, 2).map((reason, i) => (
                      <p key={i} className="text-xs text-gray-600 flex items-center">
                        <Heart className="h-3 w-3 mr-1 text-purple-400" />
                        {reason}
                      </p>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Evolution Potential:</span>
                      <Progress value={rec.evolutionPotential * 100} className="h-1 mt-1" />
                    </div>
                    <div>
                      <span className="text-gray-500">Elemental Alignment:</span>
                      <Progress value={rec.elementalAlignment * 100} className="h-1 mt-1" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-xs text-gray-500">
                  {rec.interactionCount ? (
                    <span>{rec.interactionCount} conversations</span>
                  ) : (
                    <span>New connection</span>
                  )}
                </div>

                <Link href={`/gallery/chat/${rec.agentId}`}>
                  <Button size="sm" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    Start Chat
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link href="/gallery">
            <Button variant="outline" className="w-full">
              <Users className="h-4 w-4 mr-2" />
              Explore All Agents
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
