'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Star, Sun, Moon, Zap, Eye, Info } from 'lucide-react'
import CircularNatalHoroscope from '@/components/charts/circular-natal-horoscope'
import { getPlanetaryDignity, getSignElement } from '@/lib/astrological-data'

interface Planet {
  name: string
  sign: string
  degree: number
  house: number
  retrograde?: boolean
}

interface EnhancedChartDisplayProps {
  planets: Record<string, { sign: string; degree: number; house: number; retrograde?: boolean }>
  chartName?: string
  onPlanetClick?: (planet: string | null) => void
  selectedPlanet?: string | null
  className?: string
}

const PLANET_SYMBOLS: Record<string, string> = {
  sun: '☉',
  moon: '☽',
  mercury: '☿',
  venus: '♀',
  mars: '♂',
  jupiter: '♃',
  saturn: '♄',
  uranus: '♅',
  neptune: '♆',
  pluto: '♇',
}

const PLANET_COLORS: Record<string, string> = {
  sun: 'text-yellow-600',
  moon: 'text-blue-400',
  mercury: 'text-green-600',
  venus: 'text-pink-500',
  mars: 'text-red-600',
  jupiter: 'text-purple-600',
  saturn: 'text-gray-700',
  uranus: 'text-cyan-500',
  neptune: 'text-blue-600',
  pluto: 'text-gray-900 dark:text-gray-100',
}

const DIGNITY_COLORS: Record<string, string> = {
  domicile: 'bg-green-100 text-green-800',
  exaltation: 'bg-blue-100 text-blue-800',
  detriment: 'bg-red-100 text-red-800',
  fall: 'bg-orange-100 text-orange-800',
  neutral: 'bg-gray-100 text-gray-600',
}

export default function EnhancedChartDisplay({
  planets,
  chartName = 'Natal Chart',
  onPlanetClick,
  selectedPlanet,
  className = '',
}: EnhancedChartDisplayProps) {
  const [hoveredPlanet, setHoveredPlanet] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const planetList = Object.entries(planets).map(([name, data]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    ...data,
    dignity: getPlanetaryDignity(name, data.sign),
    element: getSignElement(data.sign),
  }))

  const getDignityText = (dignity: string) => {
    switch (dignity) {
      case 'domicile':
        return 'Domicile (Strong)'
      case 'exaltation':
        return 'Exaltation (Very Strong)'
      case 'detriment':
        return 'Detriment (Challenged)'
      case 'fall':
        return 'Fall (Very Challenged)'
      default:
        return 'Neutral'
    }
  }

  const handlePlanetClick = (planetName: string) => {
    if (onPlanetClick) {
      onPlanetClick(planetName.toLowerCase())
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          {chartName}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDetails(!showDetails)}>
            <Eye className="w-4 h-4 mr-1" />
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>
        </div>
      </div>

      {/* Chart Visualization */}
      <Card className="relative overflow-hidden">
        <CardContent className="p-6">
          <div className="relative">
            <CircularNatalHoroscope className="w-full" />

            {/* Interactive Overlay for Future Enhancement */}
            <div className="absolute inset-0 pointer-events-none">
              {/* This will be enhanced with clickable planetary elements */}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Planetary Details Panel */}
      {showDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              Planetary Positions & Dignities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {planetList.map(planet => (
                <TooltipProvider key={planet.name}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`
                          flex items-center justify-between p-3 rounded-lg border cursor-pointer
                          hover:bg-muted/50 transition-colors
                          ${selectedPlanet === planet.name.toLowerCase() ? 'ring-2 ring-primary' : ''}
                        `}
                        onClick={() => handlePlanetClick(planet.name)}
                        onMouseEnter={() => setHoveredPlanet(planet.name)}
                        onMouseLeave={() => setHoveredPlanet(null)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`text-2xl ${PLANET_COLORS[planet.name.toLowerCase()]}`}>
                            {PLANET_SYMBOLS[planet.name.toLowerCase()]}
                          </div>
                          <div>
                            <div className="font-medium">{planet.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {planet.degree}° {planet.sign} • House {planet.house}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={DIGNITY_COLORS[planet.dignity]}>
                            {planet.dignity === 'neutral'
                              ? 'Neutral'
                              : getDignityText(planet.dignity)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {planet.element}
                          </Badge>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1 text-sm">
                        <div className="font-medium">
                          {planet.name} in {planet.sign}
                        </div>
                        <div>
                          Position: {planet.degree}° • House {planet.house}
                        </div>
                        <div>Dignity: {getDignityText(planet.dignity)}</div>
                        <div>Element: {planet.element}</div>
                        {planet.retrograde && <div className="text-orange-600">⚹ Retrograde</div>}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Planet Details Modal */}
      {selectedPlanet && (
        <Dialog open={!!selectedPlanet} onOpenChange={() => onPlanetClick?.(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className={`text-2xl ${PLANET_COLORS[selectedPlanet]}`}>
                  {PLANET_SYMBOLS[selectedPlanet]}
                </span>
                {selectedPlanet.charAt(0).toUpperCase() + selectedPlanet.slice(1)} Details
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {(() => {
                const planet = planetList.find(p => p.name.toLowerCase() === selectedPlanet)
                if (!planet) return null

                return (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Sign:</span>
                        <div className="font-medium">{planet.sign}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Degree:</span>
                        <div className="font-medium">{planet.degree}°</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">House:</span>
                        <div className="font-medium">{planet.house}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Element:</span>
                        <div className="font-medium">{planet.element}</div>
                      </div>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-sm">Dignity:</span>
                      <Badge className={`ml-2 ${DIGNITY_COLORS[planet.dignity]}`}>
                        {getDignityText(planet.dignity)}
                      </Badge>
                    </div>

                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm">
                        <strong>Interpretation:</strong> {planet.name} in {planet.sign}
                        {planet.dignity !== 'neutral' && ` (${planet.dignity})`} brings
                        {planet.element.toLowerCase()} energy to house {planet.house}
                        matters. Click "Consult Council" for detailed analysis.
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
