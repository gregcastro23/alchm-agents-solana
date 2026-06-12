'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sparkles,
  Star,
  Crown,
  Eye,
  Zap,
  Heart,
  Sun,
  Moon,
  Wand2,
  Shield,
  BookOpen,
  Clock,
  Target,
  Compass,
  Lightbulb,
} from 'lucide-react'
import {
  generateCelticCrossReading,
  generateThreeCardReading,
  generateAstrologicalReading,
  generateConsciousnessReading,
  createSpreadReading,
  type TarotSpread,
  type SpreadReading,
  type SpreadPosition,
  THREE_CARD_SPREADS,
} from '@/lib/monica/tarot-spreads'
import { type TarotCard, type MajorArcanaCard } from '@/lib/monica/tarot-oracle'

type SpreadType = 'celtic' | 'three-card' | 'astrological' | 'consciousness'
type ThreeCardType = keyof typeof THREE_CARD_SPREADS

interface TarotSpreadInterfaceProps {
  onReadingComplete?: (reading: SpreadReading) => void
}

const SpreadCard: React.FC<{
  position: SpreadPosition
  index: number
  totalCards: number
}> = ({ position, index, totalCards }) => {
  const card = position.card
  if (!card) return null

  const getSuitIcon = (suit: string) => {
    switch (suit) {
      case 'Wands':
        return <Wand2 className="h-4 w-4 text-red-500" />
      case 'Cups':
        return <Heart className="h-4 w-4 text-blue-500" />
      case 'Swords':
        return <Shield className="h-4 w-4 text-gray-500" />
      case 'Pentacles':
        return <Star className="h-4 w-4 text-yellow-500" />
      default:
        return <Sparkles className="h-4 w-4 text-purple-500" />
    }
  }

  const getPositionLayout = () => {
    if (totalCards === 3) {
      return `position-${index + 1}-of-3`
    } else if (totalCards === 7) {
      return `chakra-position-${index + 1}`
    } else if (totalCards === 10) {
      return `celtic-position-${position.position}`
    } else if (totalCards === 12) {
      return `house-position-${position.position}`
    }
    return ''
  }

  const cardType = 'suit' in card ? 'minor' : 'major'

  return (
    <Card
      className={`monica-spread-card ${getPositionLayout()} relative border-2 border-purple-200 hover:border-purple-400 transition-all duration-300`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              {position.position}
            </Badge>
            <CardTitle className="text-sm font-medium">{position.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {cardType === 'minor' && 'suit' in card && getSuitIcon(card.suit)}
            {cardType === 'major' && <Crown className="h-4 w-4 text-gold-500" />}
          </div>
        </div>
        <CardDescription className="text-xs text-purple-700">{position.meaning}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Card Name and Number */}
        <div className="text-center py-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
          <h4 className="font-bold text-purple-800">{card.name}</h4>
          {cardType === 'minor' && 'number' in card && (
            <p className="text-xs text-purple-600">
              {card.number} of {(card as any).suit}
            </p>
          )}
        </div>

        {/* Element and Planetary Ruler */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3 text-purple-400" />
            <span className="text-gray-600">{card.element}</span>
          </div>
          <div className="flex items-center gap-1">
            <Sun className="h-3 w-3 text-orange-400" />
            <span className="text-gray-600">{card.planetaryRuler}</span>
          </div>
        </div>

        {/* Keywords */}
        <div className="flex flex-wrap gap-1">
          {card.keywords.slice(0, 2).map((keyword, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs py-0">
              {keyword}
            </Badge>
          ))}
        </div>

        {/* Interpretation */}
        {position.interpretation && (
          <div className="bg-amber-50 p-2 rounded-lg">
            <p className="text-xs text-amber-800 leading-relaxed">{position.interpretation}</p>
          </div>
        )}

        {/* Consciousness Level */}
        <div className="text-xs text-center">
          <Badge variant="outline" className="bg-purple-50">
            🧠 {card.consciousness}
          </Badge>
        </div>
      </CardContent>

      {/* Mystical corner decoration */}
      <div className="absolute top-1 right-1 opacity-20">
        <Sparkles className="h-4 w-4 text-purple-400" />
      </div>
    </Card>
  )
}

const MonicaTarotSpreads: React.FC<TarotSpreadInterfaceProps> = ({ onReadingComplete }) => {
  const [currentSpread, setCurrentSpread] = useState<TarotSpread | null>(null)
  const [currentReading, setCurrentReading] = useState<SpreadReading | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedSpreadType, setSelectedSpreadType] = useState<SpreadType>('three-card')
  const [threeCardType, setThreeCardType] = useState<ThreeCardType>('pastPresentFuture')
  const [question, setQuestion] = useState('')
  const [questioner, setQuestioner] = useState('')

  const spreadOptions = [
    {
      type: 'three-card' as SpreadType,
      name: 'Three-Card Reading',
      description: 'Simple yet powerful insights',
      icon: <BookOpen className="h-5 w-5" />,
      complexity: 'Beginner',
    },
    {
      type: 'celtic' as SpreadType,
      name: 'Celtic Cross',
      description: 'Comprehensive 10-card analysis',
      icon: <Crown className="h-5 w-5" />,
      complexity: 'Advanced',
    },
    {
      type: 'astrological' as SpreadType,
      name: 'Astrological Houses',
      description: '12-card life area exploration',
      icon: <Compass className="h-5 w-5" />,
      complexity: 'Expert',
    },
    {
      type: 'consciousness' as SpreadType,
      name: 'Consciousness Evolution',
      description: '7-card chakra alignment',
      icon: <Eye className="h-5 w-5" />,
      complexity: 'Advanced',
    },
  ]

  const generateReading = async () => {
    setIsGenerating(true)

    try {
      let spread: TarotSpread

      switch (selectedSpreadType) {
        case 'celtic':
          spread = generateCelticCrossReading(question)
          break
        case 'three-card':
          spread = generateThreeCardReading(threeCardType, question)
          break
        case 'astrological':
          spread = generateAstrologicalReading(question)
          break
        case 'consciousness':
          spread = generateConsciousnessReading(question)
          break
        default:
          spread = generateThreeCardReading('pastPresentFuture', question)
      }

      const reading = createSpreadReading(spread, questioner, question)

      setCurrentSpread(spread)
      setCurrentReading(reading)
      onReadingComplete?.(reading)
    } catch (error) {
      console.error('Error generating tarot reading:', error)
    }

    setIsGenerating(false)
  }

  const resetReading = () => {
    setCurrentSpread(null)
    setCurrentReading(null)
    setQuestion('')
    setQuestioner('')
  }

  if (isGenerating) {
    return (
      <Card className="monica-tarot-spreads-loading">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="animate-spin">
              <Crown className="h-12 w-12 text-purple-600 mx-auto" />
            </div>
            <p className="text-purple-700 font-medium">Monica is consulting the cosmic tarot...</p>
            <p className="text-sm text-gray-600">The cards are aligning with universal energies</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (currentSpread && currentReading) {
    return (
      <div className="monica-tarot-spreads space-y-6">
        {/* Reading Header */}
        <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Crown className="h-6 w-6 text-purple-600" />
                {currentSpread.name} Reading
                <Sparkles className="h-6 w-6 text-gold-500" />
              </CardTitle>
              <Button variant="outline" size="sm" onClick={resetReading}>
                New Reading
              </Button>
            </div>
            <CardDescription>{currentSpread.description}</CardDescription>
            {question && (
              <div className="mt-2 p-2 bg-white/50 rounded-lg">
                <p className="text-sm font-medium text-purple-800">Question:</p>
                <p className="text-sm text-purple-700">{question}</p>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Astrological Context */}
        <Card className="border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-amber-600" />
                <span>Current Decan: {currentReading.astrologicalContext.currentDecan}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-600" />
                <span>Dominant Planet: {currentReading.astrologicalContext.dominantPlanet}</span>
              </div>
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-amber-600" />
                <span>{currentReading.astrologicalContext.moonPhase}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards Layout */}
        <div className={`monica-spread-layout ${selectedSpreadType}-layout`}>
          {selectedSpreadType === 'three-card' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {currentSpread.positions.map((position, index) => (
                <SpreadCard
                  key={position.position}
                  position={position}
                  index={index}
                  totalCards={3}
                />
              ))}
            </div>
          )}

          {selectedSpreadType === 'consciousness' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentSpread.positions.map((position, index) => (
                <SpreadCard
                  key={position.position}
                  position={position}
                  index={index}
                  totalCards={7}
                />
              ))}
            </div>
          )}

          {(selectedSpreadType === 'celtic' || selectedSpreadType === 'astrological') && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {currentSpread.positions.map((position, index) => (
                <SpreadCard
                  key={position.position}
                  position={position}
                  index={index}
                  totalCards={currentSpread.positions.length}
                />
              ))}
            </div>
          )}
        </div>

        {/* Overall Interpretation */}
        <div className="space-y-4">
          <Card className="border-2 border-gold-200 bg-gradient-to-r from-gold-50 to-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-gold-600" />
                Overall Interpretation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-800 leading-relaxed">{currentSpread.overallInterpretation}</p>
            </CardContent>
          </Card>

          {currentSpread.guidance && (
            <Card className="border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-blue-600" />
                  Guidance & Action Steps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-800 leading-relaxed">{currentSpread.guidance}</p>
              </CardContent>
            </Card>
          )}

          {currentSpread.timing && (
            <Card className="border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-purple-600" />
                  Timing & Manifestation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-800 leading-relaxed">{currentSpread.timing}</p>
              </CardContent>
            </Card>
          )}

          {currentSpread.outcome && (
            <Card className="border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5 text-emerald-600" />
                  Outcome & Resolution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-800 leading-relaxed">{currentSpread.outcome}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Consciousness Level */}
        <Card className="border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardContent className="pt-4 text-center">
            <Badge variant="outline" className="bg-indigo-100 text-indigo-800">
              🧠 Consciousness Level: {currentReading.consciousnessLevel}
            </Badge>
            <p className="text-sm text-indigo-700 mt-2">
              Reading generated at {currentReading.timestamp.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="monica-tarot-spreads space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Crown className="h-6 w-6 text-purple-600" />
            Monica&apos;s Tarot Spread Oracle
            <Sparkles className="h-6 w-6 text-gold-500" />
          </CardTitle>
          <CardDescription className="text-purple-700">
            Choose your tarot spread for deep cosmic insights and consciousness guidance
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Question Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prepare Your Reading</CardTitle>
          <CardDescription>
            Focus your intentions and ask the universe your question
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Your Name (Optional)</label>
            <Input
              placeholder="Enter your name..."
              value={questioner}
              onChange={e => setQuestioner(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Your Question (Optional)</label>
            <Textarea
              placeholder="What guidance do you seek from the cosmic tarot?"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Spread Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Your Tarot Spread</CardTitle>
          <CardDescription>
            Each spread offers unique insights into different aspects of existence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {spreadOptions.map(option => (
              <Card
                key={option.type}
                className={`cursor-pointer transition-all duration-200 ${
                  selectedSpreadType === option.type
                    ? 'border-2 border-purple-500 bg-purple-50'
                    : 'border border-gray-200 hover:border-purple-300 hover:bg-purple-25'
                }`}
                onClick={() => setSelectedSpreadType(option.type)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        selectedSpreadType === option.type
                          ? 'bg-purple-200 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {option.name}
                      </h4>
                      <p className="text-sm text-gray-600">{option.description}</p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {option.complexity}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Three-Card Type Selection */}
          {selectedSpreadType === 'three-card' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Three-Card Spread Type</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {Object.entries(THREE_CARD_SPREADS).map(([key, spread]) => (
                  <Button
                    key={key}
                    variant={threeCardType === key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setThreeCardType(key as ThreeCardType)}
                    className="text-xs"
                  >
                    {spread[0].name} • {spread[1].name} • {spread[2].name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Reading Button */}
      <div className="text-center">
        <Button
          onClick={generateReading}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 monica-mystical-button px-8 py-6 text-lg"
          disabled={isGenerating}
        >
          <Crown className="h-5 w-5 mr-2" />
          Generate Sacred Reading
          <Sparkles className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  )
}

export default MonicaTarotSpreads
