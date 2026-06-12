'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Activity, TrendingUp, Users, AlertTriangle, CheckCircle, Target, Zap } from 'lucide-react'

export interface HarmonicMetrics {
  Spirit: { period: number; phase: number; amplitude: number }
  currentWave: number
}

export interface AgentTrigger {
  planet: string
  confidence: number // 0-1
  reason: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  action: 'consult' | 'consolidate' | 'activate' | 'balance'
  element?: 'fire' | 'water' | 'air' | 'earth'
}

export interface CouncilRecommendation {
  triggers: AgentTrigger[]
  dominantAction: string
  harmonicState: 'chaotic' | 'fluctuating' | 'stable' | 'resonant' | 'transcendent'
  overallConfidence: number
  summary: string
}

export interface HarmonicAnalysisBridgeProps {
  metrics: HarmonicMetrics
  onCouncilRecommendation?: (recommendation: CouncilRecommendation) => void
  autoAnalyze?: boolean
  className?: string
}

/**
 * Pure function to get council recommendations from harmonic metrics
 */
export function getCouncilRecommendations(metrics: HarmonicMetrics): CouncilRecommendation {
  const { Spirit, currentWave } = metrics
  const { period, phase, amplitude } = Spirit

  // Validate inputs
  const validAmplitude = Math.max(0, Math.min(1, amplitude || 0))
  const validPhase = Math.abs(phase || 0) % (2 * Math.PI)
  const validPeriod = Math.max(0.1, period || 1)
  const validCurrentWave = Math.max(0, Math.min(1, currentWave || 0))

  const triggers: AgentTrigger[] = []

  // High amplitude + peak phase -> Action agents (Mars/Mercury)
  const phasePosition = Math.cos(validPhase) // -1 to 1, peak at phase=0
  const isNearPeak = Math.abs(phasePosition) > 0.7 // Near peak or trough
  const isHighAmplitude = validAmplitude > 0.6

  if (isHighAmplitude && isNearPeak) {
    if (phasePosition > 0) {
      // Positive peak - action and initiative
      triggers.push({
        planet: 'Mars',
        confidence: Math.min(1, validAmplitude + Math.abs(phasePosition) * 0.3),
        reason: `High amplitude (${(validAmplitude * 100).toFixed(0)}%) at positive peak phase suggests powerful initiative energy`,
        priority: validAmplitude > 0.8 ? 'urgent' : 'high',
        action: 'activate',
        element: 'fire',
      })

      triggers.push({
        planet: 'Mercury',
        confidence: Math.min(1, validAmplitude * 0.8 + 0.2),
        reason: `Peak harmonic phase indicates optimal communication and decision-making timing`,
        priority: 'medium',
        action: 'consult',
        element: 'air',
      })
    } else {
      // Negative peak - release and transformation
      triggers.push({
        planet: 'Saturn',
        confidence: Math.min(1, validAmplitude + Math.abs(phasePosition) * 0.2),
        reason: `High amplitude at negative peak suggests deep transformation and restructuring energy`,
        priority: 'high',
        action: 'consolidate',
        element: 'earth',
      })
    }
  }

  // Low amplitude -> Stabilizing agents (Saturn)
  if (validAmplitude < 0.3) {
    triggers.push({
      planet: 'Saturn',
      confidence: 0.6 + (0.3 - validAmplitude) * 0.8,
      reason: `Low amplitude (${(validAmplitude * 100).toFixed(0)}%) indicates need for grounding and stability`,
      priority: 'medium',
      action: 'consolidate',
      element: 'earth',
    })

    triggers.push({
      planet: 'Venus',
      confidence: 0.5 + (0.3 - validAmplitude) * 0.5,
      reason: `Gentle harmonic state calls for harmony and relationship balance`,
      priority: 'low',
      action: 'balance',
      element: 'water',
    })
  }

  // Very short periods -> Quick decision agents
  if (validPeriod < 1.0) {
    triggers.push({
      planet: 'Mercury',
      confidence: 0.7 + (1.0 - validPeriod) * 0.3,
      reason: `Rapid harmonic period (${validPeriod.toFixed(2)}) suggests need for quick mental processing`,
      priority: 'high',
      action: 'consult',
      element: 'air',
    })
  }

  // Very long periods -> Wisdom/patience agents
  if (validPeriod > 3.0) {
    triggers.push({
      planet: 'Jupiter',
      confidence: 0.6 + Math.min(0.4, (validPeriod - 3.0) * 0.1),
      reason: `Extended harmonic period (${validPeriod.toFixed(2)}) indicates deep wisdom and expansion energy`,
      priority: 'medium',
      action: 'consult',
      element: 'fire',
    })
  }

  // Current wave state analysis
  if (validCurrentWave > 0.8) {
    triggers.push({
      planet: 'Sun',
      confidence: 0.8 + validCurrentWave * 0.2,
      reason: `High current wave (${(validCurrentWave * 100).toFixed(0)}%) suggests peak creative and leadership energy`,
      priority: 'high',
      action: 'activate',
      element: 'fire',
    })
  }

  if (validCurrentWave < 0.2) {
    triggers.push({
      planet: 'Moon',
      confidence: 0.7 + (0.2 - validCurrentWave) * 1.5,
      reason: `Low current wave (${(validCurrentWave * 100).toFixed(0)}%) indicates introspective and intuitive timing`,
      priority: 'medium',
      action: 'consult',
      element: 'water',
    })
  }

  // Remove duplicates and sort by confidence
  const uniqueTriggers = triggers.reduce((acc, trigger) => {
    const existing = acc.find(t => t.planet === trigger.planet)
    if (existing) {
      // Keep the one with higher confidence
      if (trigger.confidence > existing.confidence) {
        acc = acc.filter(t => t.planet !== trigger.planet)
        acc.push(trigger)
      }
    } else {
      acc.push(trigger)
    }
    return acc
  }, [] as AgentTrigger[])

  const sortedTriggers = uniqueTriggers.sort((a, b) => b.confidence - a.confidence).slice(0, 5) // Max 5 triggers for planetary council limit

  // Determine harmonic state
  let harmonicState: CouncilRecommendation['harmonicState'] = 'stable'
  const harmonicComplexity =
    validAmplitude * Math.abs(Math.sin(validPhase)) * (1 / Math.max(0.1, validPeriod))

  if (harmonicComplexity > 0.8) harmonicState = 'chaotic'
  else if (harmonicComplexity > 0.6) harmonicState = 'fluctuating'
  else if (harmonicComplexity < 0.1 && validAmplitude > 0.7) harmonicState = 'resonant'
  else if (harmonicComplexity < 0.05 && validAmplitude > 0.9) harmonicState = 'transcendent'

  // Determine dominant action
  const actionCounts: Record<string, number> = {}
  sortedTriggers.forEach(trigger => {
    actionCounts[trigger.action] = (actionCounts[trigger.action] || 0) + trigger.confidence
  })

  const dominantAction =
    Object.entries(actionCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'balance'

  // Calculate overall confidence
  const overallConfidence =
    sortedTriggers.length > 0
      ? sortedTriggers.reduce((sum, t) => sum + t.confidence, 0) / sortedTriggers.length
      : 0.5

  // Generate summary
  const summary =
    sortedTriggers.length > 0
      ? `Harmonic analysis recommends ${dominantAction} action with ${sortedTriggers.length} planetary triggers. ` +
        `State: ${harmonicState}. Primary agents: ${sortedTriggers
          .slice(0, 3)
          .map(t => t.planet)
          .join(', ')}.`
      : `Harmonic patterns suggest stable ${harmonicState} state with balanced energy distribution.`

  return {
    triggers: sortedTriggers,
    dominantAction,
    harmonicState,
    overallConfidence,
    summary,
  }
}

export function HarmonicAnalysisBridge({
  metrics,
  onCouncilRecommendation,
  autoAnalyze = true,
  className = '',
}: HarmonicAnalysisBridgeProps) {
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null)
  const [analysisCount, setAnalysisCount] = useState(0)

  // Calculate recommendations
  const recommendations = useMemo(() => {
    return getCouncilRecommendations(metrics)
  }, [metrics])

  // Auto-analyze effect
  useEffect(() => {
    if (autoAnalyze) {
      setLastAnalysis(new Date())
      setAnalysisCount(prev => prev + 1)
      onCouncilRecommendation?.(recommendations)
    }
  }, [recommendations, autoAnalyze, onCouncilRecommendation])

  const handleManualAnalysis = () => {
    setLastAnalysis(new Date())
    setAnalysisCount(prev => prev + 1)
    onCouncilRecommendation?.(recommendations)
  }

  const getPriorityColor = (priority: AgentTrigger['priority']) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    }
    return colors[priority]
  }

  const getActionIcon = (action: AgentTrigger['action']) => {
    const icons = {
      consult: <Users className="h-3 w-3" />,
      consolidate: <Target className="h-3 w-3" />,
      activate: <Zap className="h-3 w-3" />,
      balance: <Activity className="h-3 w-3" />,
    }
    return icons[action]
  }

  const getStateColor = (state: CouncilRecommendation['harmonicState']) => {
    const colors = {
      chaotic: 'text-red-600',
      fluctuating: 'text-orange-600',
      stable: 'text-green-600',
      resonant: 'text-blue-600',
      transcendent: 'text-purple-600',
    }
    return colors[state]
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with analysis info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Harmonic Analysis Bridge
              </CardTitle>
              <CardDescription>
                Planetary Council recommendations from harmonic metrics
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Analyses: {analysisCount}</Badge>
              <Badge className={getStateColor(recommendations.harmonicState)}>
                {recommendations.harmonicState}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Current metrics display */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Spirit Period</div>
              <div className="font-medium">{metrics.Spirit.period.toFixed(2)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Phase</div>
              <div className="font-medium">
                {(metrics.Spirit.phase % (2 * Math.PI)).toFixed(2)}π
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Amplitude</div>
              <div className="font-medium">{(metrics.Spirit.amplitude * 100).toFixed(0)}%</div>
              <Progress value={metrics.Spirit.amplitude * 100} className="h-1" />
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Current Wave</div>
              <div className="font-medium">{(metrics.currentWave * 100).toFixed(0)}%</div>
              <Progress value={metrics.currentWave * 100} className="h-1" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              {lastAnalysis
                ? `Last analysis: ${lastAnalysis.toLocaleTimeString()}`
                : 'No analysis yet'}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualAnalysis}
              className="flex items-center gap-1"
            >
              <TrendingUp className="h-3 w-3" />
              Analyze
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Council Recommendations
          </CardTitle>
          <CardDescription>Suggested planetary agents based on harmonic patterns</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <div className="font-medium text-blue-900">Analysis Summary</div>
                <div className="text-sm text-blue-700 mt-1">{recommendations.summary}</div>
                <div className="flex items-center gap-4 mt-2 text-xs text-blue-600">
                  <span>Confidence: {(recommendations.overallConfidence * 100).toFixed(0)}%</span>
                  <span>Dominant Action: {recommendations.dominantAction}</span>
                  <span>Triggers: {recommendations.triggers.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Agent triggers */}
          {recommendations.triggers.length > 0 ? (
            <div className="space-y-3">
              <div className="font-medium text-sm">Recommended Planetary Agents:</div>
              {recommendations.triggers.map((trigger, index) => (
                <Card key={`${trigger.planet}-${index}`} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{trigger.planet}</span>
                          <Badge className={getPriorityColor(trigger.priority)}>
                            {trigger.priority}
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1">
                            {getActionIcon(trigger.action)}
                            {trigger.action}
                          </Badge>
                          {trigger.element && <Badge variant="secondary">{trigger.element}</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">{trigger.reason}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {(trigger.confidence * 100).toFixed(0)}%
                        </div>
                        <Progress value={trigger.confidence * 100} className="w-16 h-1 mt-1" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No specific agent triggers detected</p>
              <p className="text-sm">Harmonic patterns suggest balanced state</p>
            </div>
          )}

          {/* Auto-analysis indicator */}
          {autoAnalyze && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-4 p-2 bg-green-50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Auto-analysis active • Updating with harmonic changes
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
