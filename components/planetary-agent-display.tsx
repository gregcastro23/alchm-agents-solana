'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { MessageCircle, Sparkles } from 'lucide-react'

export interface PlanetaryAgentInfo {
  ruler: string
  sign: string
  dignity: string
  element: string
  modality: string
  consciousnessLevel: string
  powerLevel: number
}

export interface PlanetaryTransitDisplay {
  transitDate: Date | string
  transitDegree: number
  transitingPlanet: string
  natalPlanet: string
  natalDegree: number
  natalSign: string
  natalHouse?: number
  aspectType: string
  aspectOrb: number
  planetaryAgent: PlanetaryAgentInfo
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

interface PlanetaryAgentDisplayProps {
  transit: PlanetaryTransitDisplay
  showDetails?: boolean
  enableChat?: boolean
  onChatInitiate?: (planet: string, sign: string, degree: number, context: any) => void
}

export function PlanetaryAgentDisplay({
  transit,
  showDetails = true,
  enableChat = false,
  onChatInitiate,
}: PlanetaryAgentDisplayProps) {
  const { planetaryAgent, interpretation, elementalHarmony } = transit

  // Get colors for elements
  const elementColors = {
    Fire: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    Water: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    Air: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    Earth: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  }

  // Get colors for dignity
  const dignityColors = {
    domicile: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    exaltation: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    peregrine: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    detriment: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    fall: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }

  // Format date
  const transitDate = new Date(transit.transitDate)
  const dateStr = transitDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Get planet symbols
  const planetSymbols: Record<string, string> = {
    Sun: '☉',
    Moon: '☽',
    Mercury: '☿',
    Venus: '♀',
    Mars: '♂',
    Jupiter: '♃',
    Saturn: '♄',
    Uranus: '♅',
    Neptune: '♆',
    Pluto: '♇',
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">
              {planetSymbols[planetaryAgent.ruler] || ''} {planetaryAgent.ruler} in{' '}
              {planetaryAgent.sign}
            </CardTitle>
            <CardDescription>
              {planetSymbols[transit.transitingPlanet] || ''} {transit.transitingPlanet} transiting
              natal {planetSymbols[transit.natalPlanet] || ''} {transit.natalPlanet} • {dateStr}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className="text-lg font-bold">
              {(transit.overallScore * 100).toFixed(0)}%
            </Badge>
            <div className="text-xs text-muted-foreground">Significance</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Chat Integration */}
        {enableChat && onChatInitiate && (
          <div className="flex gap-2">
            <Button
              className="flex-1 cosmic-button"
              onClick={() =>
                onChatInitiate(planetaryAgent.ruler, planetaryAgent.sign, transit.transitDegree, {
                  transit: transit,
                  context: 'planetary_agent_activation',
                  significanceScore: transit.overallScore,
                  elementalHarmony: elementalHarmony,
                  interpretation: interpretation,
                })
              }
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Ask This Agent
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                onChatInitiate(planetaryAgent.ruler, planetaryAgent.sign, transit.transitDegree, {
                  transit: transit,
                  context: 'wisdom_guidance',
                  significanceScore: transit.overallScore,
                  elementalHarmony: elementalHarmony,
                  interpretation: interpretation,
                })
              }
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Wisdom
            </Button>
          </div>
        )}

        {enableChat && <Separator />}
        {/* Planetary Agent Info */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge className={elementColors[planetaryAgent.element as keyof typeof elementColors]}>
              {planetaryAgent.element}
            </Badge>
            <Badge variant="outline">{planetaryAgent.modality}</Badge>
            <Badge className={dignityColors[planetaryAgent.dignity as keyof typeof dignityColors]}>
              {planetaryAgent.dignity}
            </Badge>
            <Badge variant="secondary">{planetaryAgent.consciousnessLevel}</Badge>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Power Level:</span>{' '}
              <span className="font-semibold">{(planetaryAgent.powerLevel * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Activation:</span>{' '}
              <span className="font-semibold">
                {(transit.activationStrength * 100).toFixed(0)}%
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Orb:</span>{' '}
              <span className="font-semibold">{transit.aspectOrb.toFixed(2)}°</span>
            </div>
          </div>
        </div>

        {showDetails && (
          <>
            <Separator />

            {/* Dignity Interpretation */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Planetary Dignity</h4>
              <p className="text-sm text-muted-foreground">
                {interpretation.dignityInterpretation}
              </p>
            </div>

            {/* Elemental Harmony */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Elemental Dynamics</h4>
              <div className="flex gap-2 mb-2">
                <Badge
                  className={
                    elementColors[elementalHarmony.natalElement as keyof typeof elementColors]
                  }
                >
                  Natal: {elementalHarmony.natalElement}
                </Badge>
                <span className="text-muted-foreground">×</span>
                <Badge
                  className={
                    elementColors[elementalHarmony.transitElement as keyof typeof elementColors]
                  }
                >
                  Transit: {elementalHarmony.transitElement}
                </Badge>
                {elementalHarmony.harmonic && <Badge variant="default">Harmonic</Badge>}
                {elementalHarmony.challenging && <Badge variant="destructive">Challenging</Badge>}
                {elementalHarmony.neutral && <Badge variant="outline">Neutral</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {interpretation.elementalInterpretation}
              </p>
            </div>

            {/* Transit Themes */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Transit Themes</h4>
              <div className="flex flex-wrap gap-2">
                {interpretation.transitThemes.map((theme, i) => (
                  <Badge key={i} variant="secondary">
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Scores Breakdown */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Significance Breakdown</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Dignity:</span>{' '}
                  <span className="font-semibold">
                    {(transit.scores.dignityScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Elemental Harmony:</span>{' '}
                  <span className="font-semibold">
                    {(transit.scores.elementalHarmonyScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Aspect Quality:</span>{' '}
                  <span className="font-semibold">
                    {(transit.scores.aspectQualityScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Personal Relevance:</span>{' '}
                  <span className="font-semibold">
                    {(transit.scores.personalRelevanceScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Recommended Actions */}
            {transit.recommendedActions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Recommended Actions</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {transit.recommendedActions.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Consciousness Work */}
            {transit.consciousnessWork.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Consciousness Work</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {transit.consciousnessWork.map((work, i) => (
                    <li key={i}>{work}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Queries */}
            {transit.recommendedQueries.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Questions to Ask the Planetary Agent</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground italic">
                  {transit.recommendedQueries.map((query, i) => (
                    <li key={i}>{query}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function PlanetaryAgentList({ transits }: { transits: PlanetaryTransitDisplay[] }) {
  if (transits.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No significant transits found for this period.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {transits.map((transit, index) => (
        <PlanetaryAgentDisplay key={index} transit={transit} />
      ))}
    </div>
  )
}
