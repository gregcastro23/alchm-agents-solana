'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Download,
  Share,
  Star,
  Clock,
  Target,
  Zap,
  Award,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface TransitData {
  id: string
  transitDate: string
  transitDegree: number
  transitingPlanet: string
  natalPlanet: string
  natalDegree: number
  natalSign: string
  natalHouse?: number
  aspectType: string
  aspectOrb: number
  planetaryAgent: {
    ruler: string
    sign: string
    dignity: string
    element: string
    modality: string
    consciousnessLevel: string
    powerLevel: number
  }
  overallScore: number
  scores: {
    dignityScore: number
    elementalHarmonyScore: number
    aspectQualityScore: number
    personalRelevanceScore: number
  }
  elementalHarmony: {
    natalElement: string
    transitElement: string
    harmonic: boolean
    challenging: boolean
    neutral: boolean
  }
  interpretation: {
    transitThemes: string[]
    dignityInterpretation: string
    elementalInterpretation: string
    consciousnessThemes: string[]
  }
  recommendedActions: string[]
  recommendedQueries: string[]
  consciousnessWork: string[]
  activationStrength: number
}

interface TransitComparisonProps {
  userId: string
  availableTransits: TransitData[]
  onTransitSelect?: (transit: TransitData) => void
  maxComparisons?: number
}

export function TransitComparison({
  userId,
  availableTransits,
  onTransitSelect,
  maxComparisons = 4,
}: TransitComparisonProps) {
  const [selectedTransits, setSelectedTransits] = useState<TransitData[]>([])
  const [comparisonResults, setComparisonResults] = useState<any>(null)
  const [exporting, setExporting] = useState(false)
  const [recommendation, setRecommendation] = useState<string | null>(null)

  // Handle transit selection
  const toggleTransitSelection = (transit: TransitData) => {
    setSelectedTransits(prev => {
      const isSelected = prev.some(t => t.id === transit.id)

      if (isSelected) {
        return prev.filter(t => t.id !== transit.id)
      } else if (prev.length < maxComparisons) {
        return [...prev, transit]
      } else {
        return prev // Max reached, don't add more
      }
    })
  }

  // Generate comparison analysis
  const generateComparison = useCallback(() => {
    if (selectedTransits.length < 2) {
      setComparisonResults(null)
      setRecommendation(null)
      return
    }

    const comparison = analyzeTransits(selectedTransits)
    setComparisonResults(comparison)

    // Generate recommendation
    const rec = generateRecommendation(selectedTransits, comparison)
    setRecommendation(rec)
  }, [selectedTransits])

  useEffect(() => {
    generateComparison()
  }, [generateComparison])

  // Analyze transits for comparison
  const analyzeTransits = (transits: TransitData[]) => {
    // Calculate averages and differences
    const avgScore = transits.reduce((sum, t) => sum + t.overallScore, 0) / transits.length
    const maxScore = Math.max(...transits.map(t => t.overallScore))
    const minScore = Math.min(...transits.map(t => t.overallScore))

    // Element distribution
    const elementCount: Record<string, number> = {}
    transits.forEach(transit => {
      const element = transit.planetaryAgent.element
      elementCount[element] = (elementCount[element] || 0) + 1
    })

    // Dignity distribution
    const dignityCount: Record<string, number> = {}
    transits.forEach(transit => {
      const dignity = transit.planetaryAgent.dignity
      dignityCount[dignity] = (dignityCount[dignity] || 0) + 1
    })

    // Timing analysis
    const dates = transits
      .map(t => new Date(t.transitDate))
      .sort((a, b) => a.getTime() - b.getTime())
    const timeSpan = differenceInDays(dates[dates.length - 1], dates[0])

    // Planetary agent analysis
    const agentCount: Record<string, number> = {}
    transits.forEach(transit => {
      const agent = `${transit.planetaryAgent.ruler} in ${transit.planetaryAgent.sign}`
      agentCount[agent] = (agentCount[agent] || 0) + 1
    })

    return {
      summary: {
        averageScore: avgScore,
        maxScore,
        minScore,
        scoreRange: maxScore - minScore,
        totalTransits: transits.length,
        timeSpan,
      },
      distributions: {
        elements: elementCount,
        dignities: dignityCount,
        agents: agentCount,
      },
      individualScores: transits.map(transit => ({
        id: transit.id,
        overallScore: transit.overallScore,
        dignityScore: transit.scores.dignityScore,
        elementalHarmonyScore: transit.scores.elementalHarmonyScore,
        aspectQualityScore: transit.scores.aspectQualityScore,
        personalRelevanceScore: transit.scores.personalRelevanceScore,
        orb: transit.aspectOrb,
      })),
    }
  }

  // Generate recommendation based on analysis
  const generateRecommendation = (transits: TransitData[], analysis: any) => {
    const highestScoreTransit = transits.reduce((prev, current) =>
      prev.overallScore > current.overallScore ? prev : current
    )

    const lowestOrbTransit = transits.reduce((prev, current) =>
      prev.aspectOrb < current.aspectOrb ? prev : current
    )

    // Determine focus recommendation
    if (analysis.summary.scoreRange > 0.3) {
      return `Focus on the highest significance transit: ${highestScoreTransit.transitingPlanet} ${highestScoreTransit.aspectType} ${highestScoreTransit.natalPlanet} (${(highestScoreTransit.overallScore * 100).toFixed(0)}% significance). The others are comparatively less impactful.`
    } else if (analysis.summary.timeSpan < 7) {
      return `Multiple significant transits are occurring within a short timeframe. Consider them as a unified period of transformation rather than separate events.`
    } else if (lowestOrbTransit.aspectOrb < 2) {
      return `The ${lowestOrbTransit.transitingPlanet} ${lowestOrbTransit.aspectType} ${lowestOrbTransit.natalPlanet} transit has the tightest orb (${lowestOrbTransit.aspectOrb.toFixed(1)}°), making it the most precise and potentially most noticeable.`
    } else {
      return `All selected transits have relatively balanced significance. Focus on the one most relevant to your current life circumstances and goals.`
    }
  }

  // Export comparison
  const handleExport = async () => {
    try {
      setExporting(true)

      const exportData = {
        comparison: comparisonResults,
        selectedTransits,
        recommendation,
        generatedAt: new Date().toISOString(),
        userId,
      }

      const jsonData = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `transit-comparison-${format(new Date(), 'yyyy-MM-dd')}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  // Get significance color
  const getSignificanceColor = (score: number) => {
    if (score >= 0.8) return 'text-red-500'
    if (score >= 0.6) return 'text-orange-500'
    return 'text-green-500'
  }

  // Get significance level
  const getSignificanceLevel = (score: number) => {
    if (score >= 0.8) return 'Critical'
    if (score >= 0.6) return 'High'
    return 'Medium'
  }

  // Render comparison table
  const renderComparisonTable = () => {
    if (!comparisonResults) return null

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Transit Comparison Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Transit</th>
                  <th className="text-center p-2">Overall Score</th>
                  <th className="text-center p-2">Dignity</th>
                  <th className="text-center p-2">Elemental Harmony</th>
                  <th className="text-center p-2">Aspect Quality</th>
                  <th className="text-center p-2">Personal Relevance</th>
                  <th className="text-center p-2">Orb</th>
                </tr>
              </thead>
              <tbody>
                {selectedTransits.map((transit, index) => {
                  const scores = comparisonResults.individualScores.find(
                    (s: any) => s.id === transit.id
                  )
                  return (
                    <tr key={transit.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        <div>
                          <div className="font-medium">
                            {transit.transitingPlanet} {transit.aspectType} {transit.natalPlanet}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(transit.transitDate), 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </td>
                      <td className="text-center p-2">
                        <div className={`font-bold ${getSignificanceColor(scores.overallScore)}`}>
                          {(scores.overallScore * 100).toFixed(0)}%
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {getSignificanceLevel(scores.overallScore)}
                        </Badge>
                      </td>
                      <td className="text-center p-2">
                        <Progress value={scores.dignityScore * 100} className="w-16 h-2 mx-auto" />
                        <div className="text-xs mt-1">
                          {(scores.dignityScore * 100).toFixed(0)}%
                        </div>
                      </td>
                      <td className="text-center p-2">
                        <Progress
                          value={scores.elementalHarmonyScore * 100}
                          className="w-16 h-2 mx-auto"
                        />
                        <div className="text-xs mt-1">
                          {(scores.elementalHarmonyScore * 100).toFixed(0)}%
                        </div>
                      </td>
                      <td className="text-center p-2">
                        <Progress
                          value={scores.aspectQualityScore * 100}
                          className="w-16 h-2 mx-auto"
                        />
                        <div className="text-xs mt-1">
                          {(scores.aspectQualityScore * 100).toFixed(0)}%
                        </div>
                      </td>
                      <td className="text-center p-2">
                        <Progress
                          value={scores.personalRelevanceScore * 100}
                          className="w-16 h-2 mx-auto"
                        />
                        <div className="text-xs mt-1">
                          {(scores.personalRelevanceScore * 100).toFixed(0)}%
                        </div>
                      </td>
                      <td className="text-center p-2">
                        <span className="font-mono text-sm">{scores.orb.toFixed(1)}°</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Render summary statistics
  const renderSummaryStats = () => {
    if (!comparisonResults) return null

    const { summary, distributions } = comparisonResults

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Score Analysis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-4 h-4" />
              Significance Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Average Score</span>
              <span className="font-bold">{(summary.averageScore * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Highest Score</span>
              <span className={`font-bold ${getSignificanceColor(summary.maxScore)}`}>
                {(summary.maxScore * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Score Range</span>
              <span className="font-bold">{(summary.scoreRange * 100).toFixed(0)}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Element Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Elemental Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(distributions.elements).map(([element, count]) => (
                <div key={element} className="flex justify-between items-center">
                  <span className="text-sm">{element}</span>
                  <Badge variant="secondary">{count as number}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Timing Analysis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Timing Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Time Span</span>
              <span className="font-bold">{summary.timeSpan} days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Transits</span>
              <span className="font-bold">{summary.totalTransits}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Avg Interval</span>
              <span className="font-bold">
                {summary.totalTransits > 1
                  ? Math.round(summary.timeSpan / (summary.totalTransits - 1))
                  : 0}{' '}
                days
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transit Comparison</h2>
          <p className="text-muted-foreground">
            Compare multiple transits side-by-side to understand their relative importance and
            timing
          </p>
        </div>

        <div className="flex items-center gap-2">
          {comparisonResults && (
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          )}
        </div>
      </div>

      {/* Selection Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Select Transits to Compare ({selectedTransits.length}/{maxComparisons})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableTransits.map(transit => {
              const isSelected = selectedTransits.some(t => t.id === transit.id)
              return (
                <div
                  key={transit.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleTransitSelection(transit)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => {}} // Handled by parent div
                      />
                      <span className="font-medium text-sm">
                        {transit.transitingPlanet} → {transit.natalPlanet}
                      </span>
                    </div>
                    <Badge className={getSignificanceColor(transit.overallScore)}>
                      {(transit.overallScore * 100).toFixed(0)}%
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      {transit.aspectType} • Orb: {transit.aspectOrb.toFixed(1)}°
                    </div>
                    <div>{format(new Date(transit.transitDate), 'MMM dd, yyyy')}</div>
                    <div>
                      {transit.planetaryAgent.ruler} in {transit.planetaryAgent.sign}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {selectedTransits.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select 2-4 transits above to begin comparison analysis</p>
            </div>
          )}

          {selectedTransits.length === 1 && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Select at least one more transit to enable comparison analysis.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Selected Transits Summary */}
      {selectedTransits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Transits ({selectedTransits.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {selectedTransits.map((transit, index) => (
                <div key={transit.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">{index + 1}</Badge>
                    <Badge className={getSignificanceColor(transit.overallScore)}>
                      {(transit.overallScore * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="font-medium text-sm">
                    {transit.transitingPlanet} {transit.aspectType} {transit.natalPlanet}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(new Date(transit.transitDate), 'MMM dd')}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => onTransitSelect?.(transit)}
                  >
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Results */}
      {comparisonResults && (
        <>
          {/* Summary Statistics */}
          {renderSummaryStats()}

          {/* Comparison Table */}
          {renderComparisonTable()}

          {/* Recommendation */}
          {recommendation && (
            <Alert>
              <Award className="h-4 w-4" />
              <AlertDescription>
                <strong>Recommendation:</strong> {recommendation}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  )
}
