'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Crown, Sparkles, Sun, Moon, Star, Eye } from 'lucide-react'

// Unified interfaces
interface TarotCard {
  name: string
  suit?: string
  number?: number | string
  meaning: string
  reversedMeaning: string
  keywords: string[]
  element?: string
  consciousness?: string
  chakra?: string
  alchemicalValues?: {
    spirit: number
    essence: number
    matter: number
    substance: number
  }
}

interface TarotReading {
  id: string
  spread: string
  cards: TarotCard[]
  interpretation: string
  timestamp: Date
}

interface UnifiedTarotSystemProps {
  mode?: 'oracle' | 'spreads' | 'dashboard'
  onReadingComplete?: (reading: TarotReading) => void
}

// Consolidated tarot data (simplified for demo)
const MAJOR_ARCANA: TarotCard[] = [
  {
    name: 'The Fool',
    number: 0,
    meaning: 'New beginnings, innocence, spontaneity',
    reversedMeaning: 'Recklessness, taken advantage of, inconsideration',
    keywords: ['new beginnings', 'innocence', 'journey', 'potential'],
    element: 'Air',
    consciousness: 'Pure potential and infinite possibility',
    chakra: 'Crown',
  },
  {
    name: 'The Magician',
    number: 1,
    meaning: 'Manifestation, resourcefulness, power',
    reversedMeaning: 'Manipulation, poor planning, untapped talents',
    keywords: ['manifestation', 'power', 'skill', 'concentration'],
    element: 'Air',
    consciousness: 'Focused will and creative power',
    chakra: 'Throat',
  },
  // Add more cards as needed...
]

const MINOR_ARCANA_SAMPLE: TarotCard[] = [
  {
    name: 'Two of Wands',
    suit: 'Wands',
    number: 2,
    meaning: 'Personal power and future planning',
    reversedMeaning: 'Lack of planning, fear of unknown',
    keywords: ['planning', 'power', 'dominion', 'leadership'],
    element: 'Fire',
    consciousness: 'Cardinal Fire initiation - the spark of individual will',
    alchemicalValues: { spirit: 0.7, essence: 0.2, matter: 0.1, substance: 0.0 },
  },
  // Add more cards as needed...
]

export function UnifiedTarotSystem({
  mode = 'dashboard',
  onReadingComplete,
}: UnifiedTarotSystemProps) {
  const [currentReading, setCurrentReading] = useState<TarotReading | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedSpread, setSelectedSpread] = useState('three-card')

  const spreads = {
    'three-card': { name: 'Three Card Spread', positions: ['Past', 'Present', 'Future'] },
    'celtic-cross': {
      name: 'Celtic Cross',
      positions: [
        'Present',
        'Challenge',
        'Past',
        'Future',
        'Crown',
        'Foundation',
        'Advice',
        'External',
        'Hopes',
        'Outcome',
      ],
    },
    'single-card': { name: 'Daily Card', positions: ['Guidance'] },
  }

  const drawCards = async (spreadType: string) => {
    setIsDrawing(true)

    // Simulate card drawing with animation delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    const spread = spreads[spreadType as keyof typeof spreads]
    const allCards = [...MAJOR_ARCANA, ...MINOR_ARCANA_SAMPLE]
    const shuffled = [...allCards].sort(() => Math.random() - 0.5)
    const drawnCards = shuffled.slice(0, spread.positions.length)

    const reading: TarotReading = {
      id: `reading_${Date.now()}`,
      spread: spread.name,
      cards: drawnCards,
      interpretation: generateInterpretation(drawnCards, spread.positions),
      timestamp: new Date(),
    }

    setCurrentReading(reading)
    setIsDrawing(false)
    onReadingComplete?.(reading)
  }

  const generateInterpretation = (cards: TarotCard[], positions: string[]): string => {
    // Simple interpretation generation
    const cardMeanings = cards
      .map((card, index) => `${positions[index]}: ${card.name} - ${card.meaning}`)
      .join('. ')

    return `Your reading reveals: ${cardMeanings}. The cards suggest a time of transformation and growth.`
  }

  if (mode === 'oracle') {
    return (
      <Card className="monica-tarot-oracle border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Crown className="h-6 w-6 text-purple-600" />
            Tarot Oracle
            <Sparkles className="h-6 w-6 text-gold-500" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!currentReading ? (
            <div className="text-center space-y-4">
              <Button
                onClick={() => drawCards('single-card')}
                disabled={isDrawing}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isDrawing ? 'Drawing...' : 'Draw Daily Guidance'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <TarotCardDisplay card={currentReading.cards[0]} />
              <p className="text-sm text-purple-700 italic">{currentReading.interpretation}</p>
              <Button variant="outline" onClick={() => setCurrentReading(null)} className="w-full">
                Draw New Card
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (mode === 'spreads') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tarot Spreads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {Object.entries(spreads).map(([key, spread]) => (
                <Button
                  key={key}
                  variant={selectedSpread === key ? 'default' : 'outline'}
                  onClick={() => setSelectedSpread(key)}
                  className="h-auto p-4 flex flex-col items-center gap-2"
                >
                  <span className="font-semibold">{spread.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {spread.positions.length} cards
                  </span>
                </Button>
              ))}
            </div>

            <Button
              onClick={() => drawCards(selectedSpread)}
              disabled={isDrawing}
              className="w-full"
            >
              {isDrawing
                ? 'Drawing Cards...'
                : `Draw ${spreads[selectedSpread as keyof typeof spreads].name}`}
            </Button>
          </CardContent>
        </Card>

        {currentReading && (
          <Card>
            <CardHeader>
              <CardTitle>{currentReading.spread} Reading</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {currentReading.cards.map((card, index) => (
                  <div key={index} className="space-y-2">
                    <h4 className="font-semibold text-center">
                      {spreads[selectedSpread as keyof typeof spreads].positions[index]}
                    </h4>
                    <TarotCardDisplay card={card} />
                  </div>
                ))}
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Interpretation</h4>
                <p className="text-sm">{currentReading.interpretation}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Default dashboard mode
  return (
    <div className="space-y-6">
      <Tabs defaultValue="oracle" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="oracle">Oracle</TabsTrigger>
          <TabsTrigger value="spreads">Spreads</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="oracle">
          <UnifiedTarotSystem mode="oracle" onReadingComplete={onReadingComplete} />
        </TabsContent>

        <TabsContent value="spreads">
          <UnifiedTarotSystem mode="spreads" onReadingComplete={onReadingComplete} />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Reading History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Your previous readings will appear here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TarotCardDisplay({ card }: { card: TarotCard }) {
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200">
      <CardContent className="p-4 space-y-3">
        {/* Card Name */}
        <h3 className="font-bold text-lg text-center text-indigo-900">{card.name}</h3>

        {/* Keywords */}
        <div className="flex flex-wrap gap-1 justify-center">
          {card.keywords.map((keyword, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {keyword}
            </Badge>
          ))}
        </div>

        {/* Meaning */}
        <p className="text-sm text-gray-700 leading-relaxed text-center">{card.meaning}</p>

        {/* Element & Consciousness */}
        {card.element && (
          <div className="text-center">
            <Badge variant="outline" className="text-xs">
              {card.element}
            </Badge>
          </div>
        )}

        {/* Consciousness Level */}
        {card.consciousness && (
          <div className="bg-purple-50 p-2 rounded-lg">
            <p className="text-xs font-medium text-purple-800 text-center">
              🧠 {card.consciousness}
            </p>
          </div>
        )}

        {/* Alchemical Values for Minor Arcana */}
        {card.alchemicalValues && (
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div className="flex justify-between">
              <span>Spirit:</span>
              <span className="font-mono">{card.alchemicalValues.spirit}</span>
            </div>
            <div className="flex justify-between">
              <span>Essence:</span>
              <span className="font-mono">{card.alchemicalValues.essence}</span>
            </div>
            <div className="flex justify-between">
              <span>Matter:</span>
              <span className="font-mono">{card.alchemicalValues.matter}</span>
            </div>
            <div className="flex justify-between">
              <span>Substance:</span>
              <span className="font-mono">{card.alchemicalValues.substance}</span>
            </div>
          </div>
        )}

        {/* Chakra for Major Arcana */}
        {card.chakra && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <Eye className="h-4 w-4 text-indigo-500" />
            <span className="text-indigo-700">{card.chakra} Chakra</span>
          </div>
        )}
      </CardContent>

      {/* Mystical corner decoration */}
      <div className="absolute top-2 right-2 opacity-20">
        <Sparkles className="h-6 w-6 text-purple-400" />
      </div>
    </Card>
  )
}
