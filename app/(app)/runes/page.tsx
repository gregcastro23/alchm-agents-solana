'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sparkles,
  Users,
  Wand2,
  Crown,
  Info,
  RefreshCw,
  Zap,
  Heart,
  Shield,
  Eye,
  Globe,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
} from 'lucide-react'

import MultiChartInput, { type ChartInput } from '@/components/charts/multi-chart-input'
import {
  MULTI_CHART_RUNE_CATALOG,
  type ChartCombination,
  type MultiChartRune,
  type AlchemicalCost,
  getAvailableRunesForCharts,
  calculateMultiChartRuneCosts,
  calculateRunePower,
} from '@/lib/runes/multi-chart-runes'

interface RunesPageState {
  currentTab: 'input' | 'analysis' | 'minting' | 'minted'
  charts: ChartInput[]
  relationshipType: string
  isAnalyzing: boolean
  analysisResult: {
    chartCombination: ChartCombination
    availableRunes: MultiChartRune[]
    compatibilityScore: number
  } | null
  userResources: AlchemicalCost
  currentConditions: Record<string, boolean>
  selectedRune: MultiChartRune | null
  mintedRunes: any[]
  isLoading: boolean
  error: string | null
}

export default function RunesPage() {
  const [state, setState] = useState<RunesPageState>({
    currentTab: 'input',
    charts: [],
    relationshipType: '',
    isAnalyzing: false,
    analysisResult: null,
    userResources: { spirit: 50, essence: 60, matter: 40, substance: 35, totalCost: 185 }, // Example resources
    currentConditions: {},
    selectedRune: null,
    mintedRunes: [],
    isLoading: false,
    error: null,
  })

  // Load current astrological conditions on mount
  useEffect(() => {
    fetchCurrentConditions()
  }, [])

  const fetchCurrentConditions = async () => {
    try {
      const response = await fetch('/api/runes/current-conditions')
      const data = await response.json()

      if (data.success) {
        const conditions: Record<string, boolean> = {}
        data.conditions.forEach((condition: any) => {
          conditions[condition.condition] = condition.active
        })
        setState(prev => ({ ...prev, currentConditions: conditions }))
      }
    } catch (error) {
      console.error('Failed to fetch conditions:', error)
    }
  }

  const handleAnalyzeCharts = async () => {
    if (state.charts.length === 0) return

    setState(prev => ({ ...prev, isAnalyzing: true, error: null }))

    try {
      const response = await fetch('/api/runes/analyze-charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charts: state.charts.map(chart => ({
            name: chart.name,
            birthDate: chart.birthDate,
            birthTime: chart.birthTime,
            birthLocation: chart.birthLocation,
          })),
          relationshipType: state.relationshipType,
        }),
      })

      const data = await response.json()

      if (data.success) {
        const availableRunes = getAvailableRunesForCharts(
          data.chartCombination,
          state.userResources
        )

        setState(prev => ({
          ...prev,
          analysisResult: {
            chartCombination: data.chartCombination,
            availableRunes,
            compatibilityScore: data.chartCombination.synergy,
          },
          currentTab: 'analysis',
        }))
      } else {
        setState(prev => ({ ...prev, error: data.error }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Analysis failed',
      }))
    } finally {
      setState(prev => ({ ...prev, isAnalyzing: false }))
    }
  }

  const handleMintRune = async (rune: MultiChartRune) => {
    if (!state.analysisResult) return

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch('/api/runes/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runeId: rune.id,
          chartCombination: state.analysisResult.chartCombination,
          userResources: state.userResources,
          currentConditions: state.currentConditions,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setState(prev => ({
          ...prev,
          mintedRunes: [...prev.mintedRunes, data.mintedRune],
          userResources: data.transaction.remainingResources,
          currentTab: 'minted',
        }))
      } else {
        setState(prev => ({ ...prev, error: data.error }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Minting failed',
      }))
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const getRuneTypeIcon = (type: string) => {
    switch (type) {
      case 'offensive':
        return <Zap className="h-4 w-4 text-red-500" />
      case 'defensive':
        return <Shield className="h-4 w-4 text-blue-500" />
      case 'utility':
        return <Eye className="h-4 w-4 text-green-500" />
      case 'cosmic':
        return <Crown className="h-4 w-4 text-purple-500" />
      case 'temporal':
        return <Clock className="h-4 w-4 text-orange-500" />
      default:
        return <Sparkles className="h-4 w-4" />
    }
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'bg-gray-100 text-gray-800'
      case 'uncommon':
        return 'bg-green-100 text-green-800'
      case 'rare':
        return 'bg-blue-100 text-blue-800'
      case 'epic':
        return 'bg-purple-100 text-purple-800'
      case 'legendary':
        return 'bg-orange-100 text-orange-800'
      case 'cosmic':
        return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCostChange = (baseCost: number, currentCost: number) => {
    if (currentCost < baseCost) {
      const discount = Math.round(((baseCost - currentCost) / baseCost) * 100)
      return (
        <span className="text-green-600 flex items-center gap-1">
          <TrendingDown className="h-3 w-3" />
          {currentCost} (-{discount}%)
        </span>
      )
    } else if (currentCost > baseCost) {
      const increase = Math.round(((currentCost - baseCost) / baseCost) * 100)
      return (
        <span className="text-red-600 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {currentCost} (+{increase}%)
        </span>
      )
    }
    return <span className="text-gray-600">{currentCost}</span>
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Multi-Chart Rune Minting
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          Combine astrological charts to mint powerful consciousness tools
        </p>
      </div>

      {/* Current Resources */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Your Alchemical Resources</CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchCurrentConditions}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{state.userResources.spirit}</div>
              <div className="text-sm text-gray-500">Spirit</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{state.userResources.essence}</div>
              <div className="text-sm text-gray-500">Essence</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{state.userResources.matter}</div>
              <div className="text-sm text-gray-500">Matter</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {state.userResources.substance}
              </div>
              <div className="text-sm text-gray-500">Substance</div>
            </div>
          </div>

          {/* Active Conditions */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Active Astrological Conditions</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(state.currentConditions).map(
                ([condition, active]) =>
                  active && (
                    <Badge key={condition} variant="outline" className="text-xs">
                      {condition.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  )
              )}
              {Object.values(state.currentConditions).every(v => !v) && (
                <Badge variant="outline" className="text-xs">
                  No special conditions active
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {state.error && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Main Interface */}
      <Tabs
        value={state.currentTab}
        onValueChange={tab => setState(prev => ({ ...prev, currentTab: tab as any }))}
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="input" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Chart Input
          </TabsTrigger>
          <TabsTrigger value="analysis" disabled={!state.analysisResult}>
            <Sparkles className="h-4 w-4" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="minting" disabled={!state.selectedRune}>
            <Wand2 className="h-4 w-4" />
            Minting
          </TabsTrigger>
          <TabsTrigger value="minted">
            <CheckCircle className="h-4 w-4" />
            Minted ({state.mintedRunes.length})
          </TabsTrigger>
        </TabsList>

        {/* Chart Input Tab */}
        <TabsContent value="input" className="space-y-6">
          <MultiChartInput
            onChartsChange={charts => setState(prev => ({ ...prev, charts }))}
            onRelationshipTypeChange={type =>
              setState(prev => ({ ...prev, relationshipType: type }))
            }
            onAnalyze={handleAnalyzeCharts}
            isAnalyzing={state.isAnalyzing}
            maxCharts={8}
          />
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          {state.analysisResult && (
            <>
              {/* Chart Combination Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Chart Combination Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {state.analysisResult.chartCombination.complexity}
                      </div>
                      <div className="text-sm text-gray-500">Complexity</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {state.analysisResult.compatibilityScore}%
                      </div>
                      <div className="text-sm text-gray-500">Synergy</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {state.analysisResult.chartCombination.dominantElement}
                      </div>
                      <div className="text-sm text-gray-500">Element</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {state.analysisResult.chartCombination.harmonicResonance.toFixed(1)}x
                      </div>
                      <div className="text-sm text-gray-500">Resonance</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Available Runes */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    Available Runes ({state.analysisResult.availableRunes.length})
                  </CardTitle>
                  <CardDescription>
                    Runes you can mint with your current chart combination and resources
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {state.analysisResult.availableRunes.map(rune => {
                      const costs = calculateMultiChartRuneCosts(
                        rune,
                        state.analysisResult!.chartCombination,
                        state.currentConditions
                      )
                      const power = calculateRunePower(rune, state.analysisResult!.chartCombination)
                      const canAfford =
                        state.userResources.spirit >= costs.spirit &&
                        state.userResources.essence >= costs.essence &&
                        state.userResources.matter >= costs.matter &&
                        state.userResources.substance >= costs.substance

                      return (
                        <Card
                          key={rune.id}
                          className={`cursor-pointer transition-all hover:shadow-lg ${
                            !canAfford ? 'opacity-60' : ''
                          }`}
                          onClick={() =>
                            canAfford &&
                            setState(prev => ({
                              ...prev,
                              selectedRune: rune,
                              currentTab: 'minting',
                            }))
                          }
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="text-2xl">{rune.symbol}</div>
                                <div>
                                  <CardTitle className="text-sm">{rune.name}</CardTitle>
                                  <div className="flex items-center gap-1 mt-1">
                                    {getRuneTypeIcon(rune.runeType)}
                                    <Badge className={`text-xs ${getRarityColor(rune.rarity)}`}>
                                      {rune.rarity}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                              {rune.description}
                            </p>

                            {/* Enhanced Power Display */}
                            <div className="mb-3">
                              <div className="flex justify-between text-xs">
                                <span>Enhanced Power:</span>
                                <span className="font-bold text-purple-600">{power}%</span>
                              </div>
                              <Progress value={Math.min(power, 300)} className="h-2 mt-1" />
                            </div>

                            {/* Costs */}
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span>Spirit:</span>
                                {formatCostChange(rune.baseCost.spirit, costs.spirit)}
                              </div>
                              <div className="flex justify-between">
                                <span>Essence:</span>
                                {formatCostChange(rune.baseCost.essence, costs.essence)}
                              </div>
                              <div className="flex justify-between">
                                <span>Matter:</span>
                                {formatCostChange(rune.baseCost.matter, costs.matter)}
                              </div>
                              <div className="flex justify-between">
                                <span>Substance:</span>
                                {formatCostChange(rune.baseCost.substance, costs.substance)}
                              </div>
                            </div>

                            <Button
                              className="w-full mt-3"
                              size="sm"
                              disabled={!canAfford}
                              onClick={e => {
                                e.stopPropagation()
                                if (canAfford) {
                                  setState(prev => ({
                                    ...prev,
                                    selectedRune: rune,
                                    currentTab: 'minting',
                                  }))
                                }
                              }}
                            >
                              {canAfford ? 'Select for Minting' : 'Insufficient Resources'}
                            </Button>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Minting Tab */}
        <TabsContent value="minting" className="space-y-6">
          {state.selectedRune && state.analysisResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">{state.selectedRune.symbol}</span>
                  {state.selectedRune.name}
                </CardTitle>
                <CardDescription>{state.selectedRune.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Minting Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Enhanced Properties</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Base Power:</span>
                          <span>100%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Enhanced Power:</span>
                          <span className="font-bold text-purple-600">
                            {calculateRunePower(
                              state.selectedRune,
                              state.analysisResult.chartCombination
                            )}
                            %
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Crafting Time:</span>
                          <span>{state.selectedRune.craftingTime} minutes</span>
                        </div>
                        {state.selectedRune.cooldown && (
                          <div className="flex justify-between">
                            <span>Cooldown:</span>
                            <span>{state.selectedRune.cooldown} hours</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Final Costs</h4>
                      {(() => {
                        const costs = calculateMultiChartRuneCosts(
                          state.selectedRune,
                          state.analysisResult.chartCombination,
                          state.currentConditions
                        )
                        return (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Spirit:</span>
                              {formatCostChange(state.selectedRune.baseCost.spirit, costs.spirit)}
                            </div>
                            <div className="flex justify-between">
                              <span>Essence:</span>
                              {formatCostChange(state.selectedRune.baseCost.essence, costs.essence)}
                            </div>
                            <div className="flex justify-between">
                              <span>Matter:</span>
                              {formatCostChange(state.selectedRune.baseCost.matter, costs.matter)}
                            </div>
                            <div className="flex justify-between">
                              <span>Substance:</span>
                              {formatCostChange(
                                state.selectedRune.baseCost.substance,
                                costs.substance
                              )}
                            </div>
                            <div className="border-t pt-1 flex justify-between font-medium">
                              <span>Total:</span>
                              {formatCostChange(
                                state.selectedRune.baseCost.totalCost,
                                costs.totalCost
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Mint Button */}
                  <Button
                    onClick={() => handleMintRune(state.selectedRune!)}
                    disabled={state.isLoading}
                    className="w-full h-12 text-lg"
                    size="lg"
                  >
                    {state.isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Minting Rune...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Wand2 className="h-5 w-5" />
                        Mint {state.selectedRune.name}
                      </div>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Minted Runes Tab */}
        <TabsContent value="minted" className="space-y-6">
          {state.mintedRunes.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-gray-500 mb-4">
                  <Wand2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No runes minted yet</p>
                  <p className="text-sm">Go back to Chart Input to start your journey</p>
                </div>
                <Button onClick={() => setState(prev => ({ ...prev, currentTab: 'input' }))}>
                  Start Minting Runes
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {state.mintedRunes.map((mintedRune, index) => (
                <Card key={mintedRune.id} className="border-green-200 bg-green-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">{mintedRune.originalRune.symbol}</span>
                      {mintedRune.originalRune.name}
                      <Badge variant="outline" className="text-green-700">
                        Active
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Minted on{' '}
                      {new Date(mintedRune.mintingSignature.mintingTimestamp).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Active Effects</h4>
                        <div className="space-y-2">
                          {mintedRune.activeEffects.map((effect: any, i: number) => (
                            <div key={i} className="bg-white p-2 rounded text-sm">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-medium">Power: {effect.power}%</span>
                                <Badge variant="outline" className="text-xs">
                                  {effect.duration}
                                </Badge>
                              </div>
                              <p className="text-gray-700">{effect.effect}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {mintedRune.collectiveParticipants && (
                        <div>
                          <h4 className="font-medium mb-2">Participants</h4>
                          <div className="flex flex-wrap gap-1">
                            {mintedRune.collectiveParticipants.map((participant: any) => (
                              <Badge
                                key={participant.chartId}
                                variant="outline"
                                className="text-xs"
                              >
                                {participant.name} ({participant.contributionPercentage}%)
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Monica's Integration */}
      <Card className="mt-8 border-green-200 bg-green-50/50">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="mb-4">
              <Heart className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <h3 className="text-lg font-semibold text-green-800">Need Guidance?</h3>
              <p className="text-sm text-green-700">
                Consult Monica, your Master Rune Minter, for personalized chart analysis and optimal
                rune recommendations
              </p>
            </div>
            <Button
              variant="outline"
              className="border-green-600 text-green-700 hover:bg-green-100"
            >
              Chat with Monica About Runes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
