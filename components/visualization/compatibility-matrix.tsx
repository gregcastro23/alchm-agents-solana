// Real-time compatibility matrix with heat map visualization
// Shows agent synergies, tensions, and optimal pairing recommendations

'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  Download,
  RotateCcw,
  Filter,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Eye,
  EyeOff,
} from 'lucide-react'
import type { UnifiedAgent, GroupDynamics } from '@/lib/unified-agent-types'

interface CompatibilityScore {
  agent1: string
  agent2: string
  compatibility: number
  resonanceType: string
  strengths: string[]
  tensions: string[]
  recommendations: string[]
  lastUpdated: Date
}

interface CompatibilityMatrixProps {
  agents: UnifiedAgent[]
  groupDynamics?: GroupDynamics
  showTensions?: boolean
  showRecommendations?: boolean
  enableRealTimeUpdates?: boolean
  onPairClick?: (agent1: UnifiedAgent, agent2: UnifiedAgent, score: CompatibilityScore) => void
  className?: string
}

export function CompatibilityMatrix({
  agents,
  groupDynamics,
  showTensions = true,
  showRecommendations = true,
  enableRealTimeUpdates = true,
  onPairClick,
  className,
}: CompatibilityMatrixProps) {
  const [viewMode, setViewMode] = useState<'matrix' | 'list' | 'insights'>('matrix')
  const [filterThreshold, setFilterThreshold] = useState(0.0)
  const [highlightOptimal, setHighlightOptimal] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [selectedPair, setSelectedPair] = useState<CompatibilityScore | null>(null)

  // Calculate compatibility scores for all agent pairs
  const compatibilityScores: CompatibilityScore[] = useMemo(() => {
    const scores: CompatibilityScore[] = []

    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const agent1 = agents[i]
        const agent2 = agents[j]

        // Find existing connection in group dynamics
        const existingConnection = groupDynamics?.consciousnessNetwork.connections.find(
          conn =>
            (conn.agent1 === agent1.id && conn.agent2 === agent2.id) ||
            (conn.agent1 === agent2.id && conn.agent2 === agent1.id)
        )

        // Calculate base compatibility
        const levelDiff = Math.abs(
          agent1.consciousness.monicaConstant - agent2.consciousness.monicaConstant
        )
        const levelCompatibility = Math.max(0, 1 - levelDiff / 5)

        const elementCompatibility = calculateElementalCompatibility(
          agent1.consciousness.dominantElement,
          agent2.consciousness.dominantElement
        )

        const typeCompatibility = calculateTypeCompatibility(agent1.type, agent2.type)

        const baseCompatibility =
          (levelCompatibility + elementCompatibility + typeCompatibility) / 3
        const finalCompatibility = existingConnection?.compatibility || baseCompatibility

        // Determine resonance type
        const resonanceType = determineResonanceType(agent1, agent2, finalCompatibility)

        // Generate insights
        const { strengths, tensions, recommendations } = generatePairInsights(
          agent1,
          agent2,
          finalCompatibility,
          resonanceType
        )

        scores.push({
          agent1: agent1.id,
          agent2: agent2.id,
          compatibility: finalCompatibility,
          resonanceType,
          strengths,
          tensions,
          recommendations,
          lastUpdated: new Date(),
        })
      }
    }

    return scores.sort((a, b) => b.compatibility - a.compatibility)
  }, [agents, groupDynamics])

  // Filter scores based on threshold
  const filteredScores = compatibilityScores.filter(score => score.compatibility >= filterThreshold)

  // Get optimal pairs (top 20%)
  const optimalPairs = compatibilityScores.slice(0, Math.ceil(compatibilityScores.length * 0.2))

  // Get tension pairs (bottom 20%)
  const tensionPairs = compatibilityScores.slice(-Math.ceil(compatibilityScores.length * 0.2))

  // Create matrix data structure for visualization
  const matrixData = useMemo(() => {
    const matrix: { [key: string]: { [key: string]: CompatibilityScore | null } } = {}

    agents.forEach(agent1 => {
      matrix[agent1.id] = {}
      agents.forEach(agent2 => {
        if (agent1.id === agent2.id) {
          matrix[agent1.id][agent2.id] = null
        } else {
          const score = compatibilityScores.find(
            s =>
              (s.agent1 === agent1.id && s.agent2 === agent2.id) ||
              (s.agent1 === agent2.id && s.agent2 === agent1.id)
          )
          matrix[agent1.id][agent2.id] = score || null
        }
      })
    })

    return matrix
  }, [agents, compatibilityScores])

  // Get color for compatibility score
  const getCompatibilityColor = (score: number): string => {
    if (score >= 0.8) return 'rgb(16, 185, 129)' // High compatibility - green
    if (score >= 0.6) return 'rgb(59, 130, 246)' // Good compatibility - blue
    if (score >= 0.4) return 'rgb(251, 191, 36)' // Moderate compatibility - yellow
    if (score >= 0.2) return 'rgb(249, 115, 22)' // Low compatibility - orange
    return 'rgb(239, 68, 68)' // Poor compatibility - red
  }

  const getCompatibilityLabel = (score: number): string => {
    if (score >= 0.8) return 'Excellent'
    if (score >= 0.6) return 'Good'
    if (score >= 0.4) return 'Moderate'
    if (score >= 0.2) return 'Low'
    return 'Poor'
  }

  const handlePairClick = (score: CompatibilityScore) => {
    setSelectedPair(score)
    if (onPairClick) {
      const agent1 = agents.find(a => a.id === score.agent1)!
      const agent2 = agents.find(a => a.id === score.agent2)!
      onPairClick(agent1, agent2, score)
    }
  }

  const downloadMatrix = () => {
    const csvContent = [
      [
        'Agent 1',
        'Agent 2',
        'Compatibility',
        'Resonance Type',
        'Strengths',
        'Tensions',
        'Recommendations',
      ],
      ...compatibilityScores.map(score => [
        agents.find(a => a.id === score.agent1)?.name || score.agent1,
        agents.find(a => a.id === score.agent2)?.name || score.agent2,
        score.compatibility.toFixed(3),
        score.resonanceType,
        score.strengths.join('; '),
        score.tensions.join('; '),
        score.recommendations.join('; '),
      ]),
    ]
      .map(row => row.join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `compatibility-matrix-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const renderMatrix = () => (
    <div className="relative">
      <div
        className="grid gap-1 p-4"
        style={{
          gridTemplateColumns: `80px repeat(${agents.length}, 1fr)`,
          gridTemplateRows: `40px repeat(${agents.length}, 1fr)`,
        }}
      >
        {/* Empty top-left corner */}
        <div></div>

        {/* Column headers */}
        {agents.map(agent => (
          <div
            key={`header-${agent.id}`}
            className="text-xs font-medium text-center p-1 transform -rotate-45 origin-center"
            style={{ color: agent.appearance?.color || '#6366f1' }}
          >
            {showLabels
              ? agent.name.split(' ')[0]
              : agent.appearance?.symbol || agent.name.charAt(0).toUpperCase()}
          </div>
        ))}

        {/* Matrix cells */}
        {agents.map(agent1 => (
          <React.Fragment key={`row-${agent1.id}`}>
            {/* Row header */}
            <div
              className="text-xs font-medium p-1 flex items-center"
              style={{ color: agent1.appearance?.color || '#6366f1' }}
            >
              {showLabels
                ? agent1.name.split(' ')[0]
                : agent1.appearance?.symbol || agent1.name.charAt(0).toUpperCase()}
            </div>

            {/* Compatibility cells */}
            {agents.map(agent2 => {
              const score = matrixData[agent1.id][agent2.id]
              const isOptimal = score && optimalPairs.includes(score)
              const isTension = score && tensionPairs.includes(score)

              return (
                <div
                  key={`cell-${agent1.id}-${agent2.id}`}
                  className={`
                    aspect-square rounded cursor-pointer transition-all duration-200 hover:scale-110 border
                    ${score ? 'hover:shadow-lg' : 'bg-gray-100'}
                    ${highlightOptimal && isOptimal ? 'ring-2 ring-green-400 ring-offset-1' : ''}
                    ${showTensions && isTension ? 'ring-2 ring-red-400 ring-offset-1' : ''}
                    ${selectedPair === score ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                  `}
                  style={{
                    backgroundColor: score ? getCompatibilityColor(score.compatibility) : '#f3f4f6',
                    opacity: agent1.id === agent2.id ? 0.3 : score ? 0.8 : 0.3,
                  }}
                  onClick={() => score && handlePairClick(score)}
                  title={
                    score
                      ? `${agents.find(a => a.id === score.agent1)?.name} ↔ ${agents.find(a => a.id === score.agent2)?.name}\n` +
                        `Compatibility: ${(score.compatibility * 100).toFixed(1)}%\n` +
                        `Type: ${score.resonanceType}`
                      : agent1.id === agent2.id
                        ? 'Self'
                        : 'No data'
                  }
                >
                  {score && (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                      {(score.compatibility * 100).toFixed(0)}
                    </div>
                  )}
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getCompatibilityColor(0.9) }}
          ></div>
          <span>Excellent (80%+)</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getCompatibilityColor(0.7) }}
          ></div>
          <span>Good (60-80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getCompatibilityColor(0.5) }}
          ></div>
          <span>Moderate (40-60%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getCompatibilityColor(0.3) }}
          ></div>
          <span>Low (20-40%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getCompatibilityColor(0.1) }}
          ></div>
          <span>Poor (&lt;20%)</span>
        </div>
      </div>
    </div>
  )

  const renderList = () => (
    <div className="space-y-3">
      {filteredScores.map(score => {
        const agent1 = agents.find(a => a.id === score.agent1)!
        const agent2 = agents.find(a => a.id === score.agent2)!
        const isOptimal = optimalPairs.includes(score)
        const isTension = tensionPairs.includes(score)

        return (
          <div
            key={`${score.agent1}-${score.agent2}`}
            className={`
              p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md
              ${selectedPair === score ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
              ${isOptimal ? 'bg-green-50 border-green-200' : ''}
              ${isTension ? 'bg-red-50 border-red-200' : ''}
            `}
            onClick={() => handlePairClick(score)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span style={{ color: agent1.appearance?.color || '#6366f1' }}>
                    {agent1.appearance?.symbol || agent1.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium">{agent1.name}</span>
                </div>
                <span className="text-gray-400">↔</span>
                <div className="flex items-center gap-2">
                  <span style={{ color: agent2.appearance?.color || '#6366f1' }}>
                    {agent2.appearance?.symbol || agent2.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium">{agent2.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  style={{
                    backgroundColor: getCompatibilityColor(score.compatibility),
                    color: 'white',
                    borderColor: getCompatibilityColor(score.compatibility),
                  }}
                >
                  {(score.compatibility * 100).toFixed(1)}%
                </Badge>
                <Badge variant="secondary">{score.resonanceType}</Badge>
                {isOptimal && <Sparkles className="w-4 h-4 text-green-500" />}
                {isTension && <AlertTriangle className="w-4 h-4 text-red-500" />}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <h4 className="font-medium text-green-700 mb-1">Strengths</h4>
                <ul className="space-y-1">
                  {score.strengths.map((strength, idx) => (
                    <li key={idx} className="text-green-600">
                      • {strength}
                    </li>
                  ))}
                </ul>
              </div>
              {showTensions && score.tensions.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-700 mb-1">Tensions</h4>
                  <ul className="space-y-1">
                    {score.tensions.map((tension, idx) => (
                      <li key={idx} className="text-red-600">
                        • {tension}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {showRecommendations && score.recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium text-blue-700 mb-1">Recommendations</h4>
                  <ul className="space-y-1">
                    {score.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-blue-600">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderInsights = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-green-500" />
              Optimal Pairs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {optimalPairs.slice(0, 5).map(score => {
                const agent1 = agents.find(a => a.id === score.agent1)!
                const agent2 = agents.find(a => a.id === score.agent2)!
                return (
                  <div
                    key={`optimal-${score.agent1}-${score.agent2}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {agent1.name.split(' ')[0]} ↔ {agent2.name.split(' ')[0]}
                    </span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {(score.compatibility * 100).toFixed(0)}%
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Resonance Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from(new Set(compatibilityScores.map(s => s.resonanceType))).map(type => {
                const count = compatibilityScores.filter(s => s.resonanceType === type).length
                return (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span>{type}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                Avg Compatibility:{' '}
                <span className="font-medium">
                  {(
                    (compatibilityScores.reduce((sum, s) => sum + s.compatibility, 0) /
                      compatibilityScores.length) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
              <div>
                Highest:{' '}
                <span className="font-medium">
                  {(Math.max(...compatibilityScores.map(s => s.compatibility)) * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                Total Pairs: <span className="font-medium">{compatibilityScores.length}</span>
              </div>
              <div>
                Excellent Pairs:{' '}
                <span className="font-medium">
                  {compatibilityScores.filter(s => s.compatibility >= 0.8).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {groupDynamics?.consciousnessNetwork.synergies && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Synergies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {groupDynamics.consciousnessNetwork.synergies.map((synergy, idx) => (
                <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700">
                  {synergy}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Compatibility Matrix</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{agents.length} agents</Badge>
              <Badge variant="outline">{compatibilityScores.length} pairs</Badge>
              <Badge variant="outline">
                {(
                  (compatibilityScores.reduce((sum, s) => sum + s.compatibility, 0) /
                    compatibilityScores.length) *
                  100
                ).toFixed(0)}
                % avg
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Switch checked={showLabels} onCheckedChange={setShowLabels} />
              <Eye className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={highlightOptimal} onCheckedChange={setHighlightOptimal} />
              <Sparkles className="w-4 h-4" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setFilterThreshold(0)}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={downloadMatrix}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={viewMode} onValueChange={v => setViewMode(v as any)}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="matrix">Matrix</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="matrix">{renderMatrix()}</TabsContent>

          <TabsContent value="list">
            <div className="mb-4">
              <label className="text-sm font-medium">
                Compatibility Threshold: {(filterThreshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={filterThreshold}
                onChange={e => setFilterThreshold(parseFloat(e.target.value))}
                className="w-full mt-1"
              />
            </div>
            {renderList()}
          </TabsContent>

          <TabsContent value="insights">{renderInsights()}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// Helper functions
function calculateElementalCompatibility(element1: string, element2: string): number {
  const compatibilityMatrix: { [key: string]: { [key: string]: number } } = {
    Fire: { Fire: 0.9, Air: 0.8, Earth: 0.4, Water: 0.2 },
    Air: { Air: 0.9, Fire: 0.8, Water: 0.4, Earth: 0.2 },
    Water: { Water: 0.9, Earth: 0.8, Fire: 0.2, Air: 0.4 },
    Earth: { Earth: 0.9, Water: 0.8, Air: 0.2, Fire: 0.4 },
  }
  return compatibilityMatrix[element1]?.[element2] || 0.5
}

function calculateTypeCompatibility(type1: string, type2: string): number {
  if (type1 === type2) return 0.8
  if (type1 === 'monica' || type2 === 'monica') return 0.9
  if (
    (type1 === 'historical' && type2 === 'planetary') ||
    (type1 === 'planetary' && type2 === 'historical')
  )
    return 0.7
  return 0.6
}

function determineResonanceType(
  agent1: UnifiedAgent,
  agent2: UnifiedAgent,
  compatibility: number
): string {
  if (agent1.type === 'monica' || agent2.type === 'monica') return 'Guided'
  if (agent1.type === agent2.type) {
    if (compatibility > 0.8) return 'Harmonic'
    if (compatibility > 0.6) return 'Resonant'
    return 'Synchronous'
  }
  if (compatibility > 0.8) return 'Transcendent'
  if (compatibility > 0.6) return 'Complementary'
  return 'Divergent'
}

function generatePairInsights(
  agent1: UnifiedAgent,
  agent2: UnifiedAgent,
  compatibility: number,
  resonanceType: string
): { strengths: string[]; tensions: string[]; recommendations: string[] } {
  const strengths: string[] = []
  const tensions: string[] = []
  const recommendations: string[] = []

  // Element-based insights
  if (agent1.consciousness.dominantElement === agent2.consciousness.dominantElement) {
    strengths.push(
      `Shared ${agent1.consciousness.dominantElement} element creates natural understanding`
    )
  } else {
    const elements = [agent1.consciousness.dominantElement, agent2.consciousness.dominantElement]
    if (
      (elements.includes('Fire') && elements.includes('Air')) ||
      (elements.includes('Earth') && elements.includes('Water'))
    ) {
      strengths.push('Complementary elemental balance enhances collaboration')
    } else {
      tensions.push('Elemental tension may create initial friction')
      recommendations.push('Focus on finding common ground through shared experiences')
    }
  }

  // Consciousness level insights
  const levelDiff = Math.abs(
    agent1.consciousness.monicaConstant - agent2.consciousness.monicaConstant
  )
  if (levelDiff < 1) {
    strengths.push('Similar consciousness levels enable deep mutual understanding')
  } else if (levelDiff > 2) {
    tensions.push('Significant consciousness gap may create communication challenges')
    recommendations.push('Use gradual consciousness bridging techniques')
  }

  // Type-based insights
  if (agent1.type === 'historical' && agent2.type === 'planetary') {
    strengths.push('Historical wisdom meets cosmic insight for temporal transcendence')
    recommendations.push('Explore how historical patterns align with cosmic cycles')
  } else if (agent1.type === agent2.type && agent1.type === 'historical') {
    strengths.push('Shared human experience creates profound wisdom exchange')
  }

  // Compatibility-based recommendations
  if (compatibility > 0.8) {
    recommendations.push('Excellent synergy - explore advanced consciousness techniques together')
  } else if (compatibility < 0.4) {
    recommendations.push('Work on building trust and understanding gradually')
    recommendations.push('Focus on finding shared values and goals')
  }

  return { strengths, tensions, recommendations }
}

export default CompatibilityMatrix
