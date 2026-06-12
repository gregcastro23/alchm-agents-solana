'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Sparkles,
  Shield,
  Zap,
  Eye,
  Flame,
  TreePine,
  Wind,
  Droplets,
  Crown,
  Clock,
  Star,
  TrendingUp,
  TrendingDown,
  Brain,
  Heart,
  RotateCw,
  Activity,
} from 'lucide-react'
import {
  RUNE_CATALOG,
  calculateRuneCosts,
  canAffordRune,
  getRecommendedRunes,
  type Rune,
  type AlchemicalCost,
} from '@/lib/runes/rune-system'

interface RunesPreviewProps {
  userResources?: AlchemicalCost
  sacredStats?: {
    power: number
    resonance: number
    wisdom: number
    charisma: number
    intuition: number
    adaptability: number
    vitality: number
  }
  currentConditions?: any
}

export default function RunesPreview({
  userResources = { spirit: 25, essence: 30, matter: 20, substance: 15, totalCost: 90 },
  sacredStats = {
    power: 75,
    resonance: 60,
    wisdom: 80,
    charisma: 50,
    intuition: 90,
    adaptability: 65,
    vitality: 70,
  },
  currentConditions = {
    jupiter_hour: true,
    waxing_moon: true,
    planet_exalted: false,
  },
}: RunesPreviewProps) {
  const [selectedRune, setSelectedRune] = useState<Rune | null>(null)
  const [filteredRunes, setFilteredRunes] = useState<Rune[]>(RUNE_CATALOG)
  const [filterType, setFilterType] = useState<'all' | 'affordable' | 'recommended'>('all')

  useEffect(() => {
    switch (filterType) {
      case 'affordable':
        setFilteredRunes(
          RUNE_CATALOG.filter(rune => canAffordRune(rune, userResources, currentConditions))
        )
        break
      case 'recommended':
        setFilteredRunes(getRecommendedRunes(userResources, currentConditions))
        break
      default:
        setFilteredRunes(RUNE_CATALOG)
    }
  }, [filterType, userResources, currentConditions])

  const getElementIcon = (element: string) => {
    switch (element) {
      case 'fire':
        return <Flame className="h-4 w-4 text-red-500" />
      case 'earth':
        return <TreePine className="h-4 w-4 text-green-500" />
      case 'air':
        return <Wind className="h-4 w-4 text-blue-500" />
      case 'water':
        return <Droplets className="h-4 w-4 text-cyan-500" />
      case 'spirit':
        return <Star className="h-4 w-4 text-purple-500" />
      default:
        return <Sparkles className="h-4 w-4" />
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
      return (
        <span className="text-green-600 flex items-center gap-1">
          <TrendingDown className="h-3 w-3" />
          {currentCost} (-{Math.round(((baseCost - currentCost) / baseCost) * 100)}%)
        </span>
      )
    } else if (currentCost > baseCost) {
      return (
        <span className="text-red-600 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {currentCost} (+{Math.round(((currentCost - baseCost) / baseCost) * 100)}%)
        </span>
      )
    }
    return <span className="text-gray-600">{currentCost}</span>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            Runes System Preview
          </CardTitle>
          <CardDescription>
            Craft powerful runes using alchemical resources. Prices fluctuate based on astrological
            conditions.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Current Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Current Alchemical Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{userResources.spirit}</div>
              <div className="text-xs text-gray-500">Spirit</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{userResources.essence}</div>
              <div className="text-xs text-gray-500">Essence</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{userResources.matter}</div>
              <div className="text-xs text-gray-500">Matter</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{userResources.substance}</div>
              <div className="text-xs text-gray-500">Substance</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sacred Stats Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">7-Sacred Stats Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            <div className="text-center p-2 bg-orange-500/10 rounded border border-orange-500/30">
              <Zap className="h-4 w-4 mx-auto mb-1 text-orange-600" />
              <div className="font-mono text-sm">{sacredStats.power}</div>
              <div className="text-[10px] text-gray-500">Power</div>
            </div>
            <div className="text-center p-2 bg-purple-500/10 rounded border border-purple-500/30">
              <Activity className="h-4 w-4 mx-auto mb-1 text-purple-600" />
              <div className="font-mono text-sm">{sacredStats.resonance}</div>
              <div className="text-[10px] text-gray-500">Reson.</div>
            </div>
            <div className="text-center p-2 bg-indigo-500/10 rounded border border-indigo-500/30">
              <Brain className="h-4 w-4 mx-auto mb-1 text-indigo-600" />
              <div className="font-mono text-sm">{sacredStats.wisdom}</div>
              <div className="text-[10px] text-gray-500">Wisdom</div>
            </div>
            <div className="text-center p-2 bg-pink-500/10 rounded border border-pink-500/30">
              <Heart className="h-4 w-4 mx-auto mb-1 text-pink-600" />
              <div className="font-mono text-sm">{sacredStats.charisma}</div>
              <div className="text-[10px] text-gray-500">Charis.</div>
            </div>
            <div className="text-center p-2 bg-cyan-500/10 rounded border border-cyan-500/30">
              <Eye className="h-4 w-4 mx-auto mb-1 text-cyan-600" />
              <div className="font-mono text-sm">{sacredStats.intuition}</div>
              <div className="text-[10px] text-gray-500">Intuit.</div>
            </div>
            <div className="text-center p-2 bg-teal-500/10 rounded border border-teal-500/30">
              <RotateCw className="h-4 w-4 mx-auto mb-1 text-teal-600" />
              <div className="font-mono text-sm">{sacredStats.adaptability}</div>
              <div className="text-[10px] text-gray-500">Adapt.</div>
            </div>
            <div className="text-center p-2 bg-green-500/10 rounded border border-green-500/30">
              <Sparkles className="h-4 w-4 mx-auto mb-1 text-green-600" />
              <div className="font-mono text-sm">{sacredStats.vitality}</div>
              <div className="text-[10px] text-gray-500">Vital.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Astrological Modifiers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Active Astrological Modifiers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {currentConditions.jupiter_hour && (
              <Badge variant="outline" className="text-green-600">
                🪐 Jupiter Hour: -40% all costs
              </Badge>
            )}
            {currentConditions.waxing_moon && (
              <Badge variant="outline" className="text-blue-600">
                🌒 Waxing Moon: -10% enhancement costs
              </Badge>
            )}
            {currentConditions.planet_exalted && (
              <Badge variant="outline" className="text-purple-600">
                ⭐ Planet Exalted: -40% element costs
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filter Controls */}
      <div className="flex gap-2">
        <Button
          variant={filterType === 'all' ? 'default' : 'outline'}
          onClick={() => setFilterType('all')}
          size="sm"
        >
          All Runes ({RUNE_CATALOG.length})
        </Button>
        <Button
          variant={filterType === 'affordable' ? 'default' : 'outline'}
          onClick={() => setFilterType('affordable')}
          size="sm"
        >
          Affordable (
          {
            RUNE_CATALOG.filter(rune => canAffordRune(rune, userResources, currentConditions))
              .length
          }
          )
        </Button>
        <Button
          variant={filterType === 'recommended' ? 'default' : 'outline'}
          onClick={() => setFilterType('recommended')}
          size="sm"
        >
          Recommended ({getRecommendedRunes(userResources, currentConditions).length})
        </Button>
      </div>

      {/* Runes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRunes.map(rune => {
          const currentCost = calculateRuneCosts(rune, currentConditions)
          const canAfford = canAffordRune(rune, userResources, currentConditions)

          return (
            <Card
              key={rune.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedRune?.id === rune.id ? 'ring-2 ring-purple-500' : ''
              } ${!canAfford ? 'opacity-60' : ''}`}
              onClick={() => setSelectedRune(rune)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-2xl">{rune.symbol}</div>
                    <div>
                      <CardTitle className="text-sm">{rune.name}</CardTitle>
                      <div className="flex items-center gap-1 mt-1">
                        {getElementIcon(rune.element)}
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
                <p className="text-xs text-gray-600 mb-3 line-clamp-2">{rune.description}</p>

                {/* Costs */}
                <div className="space-y-2">
                  <div className="text-xs font-medium">Alchemical Cost:</div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="flex justify-between">
                      <span>Spirit:</span>
                      {formatCostChange(rune.baseCost.spirit, currentCost.spirit)}
                    </div>
                    <div className="flex justify-between">
                      <span>Essence:</span>
                      {formatCostChange(rune.baseCost.essence, currentCost.essence)}
                    </div>
                    <div className="flex justify-between">
                      <span>Matter:</span>
                      {formatCostChange(rune.baseCost.matter, currentCost.matter)}
                    </div>
                    <div className="flex justify-between">
                      <span>Substance:</span>
                      {formatCostChange(rune.baseCost.substance, currentCost.substance)}
                    </div>
                  </div>
                  <div className="border-t pt-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Total:</span>
                      {formatCostChange(rune.baseCost.totalCost, currentCost.totalCost)}
                    </div>
                  </div>
                </div>

                {/* Crafting Time */}
                <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {rune.craftingTime} minutes
                </div>

                {/* Action Button */}
                <Button
                  className="w-full mt-3"
                  size="sm"
                  disabled={!canAfford}
                  variant={canAfford ? 'default' : 'outline'}
                >
                  {canAfford ? 'Craft Rune' : 'Insufficient Resources'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Selected Rune Details */}
      {selectedRune && (
        <Card className="border-2 border-purple-300 bg-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">{selectedRune.symbol}</span>
              {selectedRune.name}
            </CardTitle>
            <CardDescription>{selectedRune.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Effects */}
              <div>
                <h4 className="font-medium mb-2">Effects:</h4>
                {selectedRune.effects.map((effect, index) => (
                  <div key={index} className="bg-white p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{effect.type}</Badge>
                      <span className="text-sm font-medium">Power: {effect.power}%</span>
                      <span className="text-sm text-gray-500">Duration: {effect.duration}</span>
                    </div>
                    <p className="text-sm text-gray-700">{effect.description}</p>
                  </div>
                ))}
              </div>

              {/* Requirements */}
              {selectedRune.requirements && Object.keys(selectedRune.requirements).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Requirements:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedRune.requirements.minANumber && (
                      <Badge variant="outline">
                        Min A-Number: {selectedRune.requirements.minANumber}
                      </Badge>
                    )}
                    {selectedRune.requirements.planetaryHour && (
                      <Badge variant="outline">
                        Hour: {selectedRune.requirements.planetaryHour}
                      </Badge>
                    )}
                    {selectedRune.requirements.moonPhase && (
                      <Badge variant="outline">Moon: {selectedRune.requirements.moonPhase}</Badge>
                    )}
                    {selectedRune.requirements.consciousness_level && (
                      <Badge variant="outline">
                        Consciousness: Level {selectedRune.requirements.consciousness_level}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Cooldown */}
              {selectedRune.cooldown && (
                <div>
                  <Badge variant="outline" className="text-orange-600">
                    ⏰ Cooldown: {selectedRune.cooldown} hours
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
