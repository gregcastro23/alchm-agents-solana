'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Star,
  Triangle,
  Square,
  Circle,
  Hexagon,
  Info,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
} from 'lucide-react'
import {
  detectPatterns,
  getAspectSymbol,
  getAspectColor,
  type PlanetPosition,
  type Aspect,
  type PatternConfiguration,
  type AspectType,
} from '@/lib/astrological-pattern-recognition'

interface AspectGridProps {
  planets: Record<string, { sign: string; degree: number; house: number }>
  className?: string
}

const PLANET_ORDER = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
]
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

// Ensure we always iterate over an actual array to avoid runtime errors
function getPlanetOrderArray(): string[] {
  const order = Array.isArray(PLANET_ORDER) ? PLANET_ORDER : Object.keys(PLANET_SYMBOLS)
  return Array.isArray(order) ? order.slice() : []
}

const PATTERN_ICONS: Record<string, React.ReactNode> = {
  'grand-trine': <Triangle className="w-4 h-4" />,
  't-square': <Square className="w-4 h-4" />,
  'grand-cross': <Square className="w-4 h-4" />,
  yod: <Triangle className="w-4 h-4 rotate-180" />,
  stellium: <Circle className="w-4 h-4" />,
  'mystic-rectangle': <Square className="w-4 h-4" />,
  kite: <Hexagon className="w-4 h-4" />,
}

const PATTERN_COLORS: Record<string, string> = {
  'grand-trine': 'bg-blue-100 text-blue-800',
  't-square': 'bg-red-100 text-red-800',
  'grand-cross': 'bg-purple-100 text-purple-800',
  yod: 'bg-green-100 text-green-800',
  stellium: 'bg-orange-100 text-orange-800',
  'mystic-rectangle': 'bg-indigo-100 text-indigo-800',
  kite: 'bg-cyan-100 text-cyan-800',
}

export default function AspectGrid({ planets, className = '' }: AspectGridProps) {
  const [aspects, setAspects] = useState<Aspect[]>([])
  const [patterns, setPatterns] = useState<PatternConfiguration[]>([])
  const [selectedAspect, setSelectedAspect] = useState<Aspect | null>(null)
  const [selectedPattern, setSelectedPattern] = useState<PatternConfiguration | null>(null)
  const [activeTab, setActiveTab] = useState<'grid' | 'patterns' | 'analysis'>('grid')

  // Defensive copies to avoid runtime issues when detectors return undefined
  const safeAspects: Aspect[] = Array.isArray(aspects) ? aspects : []
  const safePatterns: PatternConfiguration[] = Array.isArray(patterns) ? patterns : []

  // Convert planets to the format needed for pattern detection
  const planetPositions: PlanetPosition[] = Object.entries(planets || {})
    .filter(([planet]) => getPlanetOrderArray().includes(planet))
    .map(([planet, data]) => ({
      planet,
      sign: data.sign,
      degree: data.degree,
      house: data.house,
    }))

  useEffect(() => {
    void detectPatterns(planetPositions).then(
      ({ aspects: detectedAspects, patterns: detectedPatterns }) => {
        setAspects(Array.isArray(detectedAspects) ? detectedAspects : [])
        setPatterns(Array.isArray(detectedPatterns) ? detectedPatterns : [])
      }
    )
  }, [planets])

  // Create aspect matrix for grid display
  const createAspectMatrix = () => {
    const matrix: Record<string, Record<string, Aspect | null>> = {}

    const order = getPlanetOrderArray()
    for (const p1 of order) {
      matrix[p1] = {}
      for (const p2 of order) {
        matrix[p1][p2] = null
      }
    }

    ;(aspects || []).forEach(aspect => {
      if (matrix[aspect.planet1]?.[aspect.planet2] !== undefined) {
        matrix[aspect.planet1][aspect.planet2] = aspect
      }
      if (matrix[aspect.planet2]?.[aspect.planet1] !== undefined) {
        matrix[aspect.planet2][aspect.planet1] = aspect
      }
    })

    return matrix
  }

  const aspectMatrix = createAspectMatrix()

  // Group aspects by type for analysis
  const aspectsByType = safeAspects.reduce(
    (acc, aspect) => {
      if (!acc[aspect.type]) acc[aspect.type] = []
      acc[aspect.type].push(aspect)
      return acc
    },
    {} as Record<AspectType, Aspect[]>
  )

  const getAspectStrengthColor = (strength: Aspect['strength']) => {
    switch (strength) {
      case 'exact':
        return 'text-red-600 font-bold'
      case 'tight':
        return 'text-orange-600 font-semibold'
      case 'moderate':
        return 'text-yellow-600'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-500" />
          Aspects & Patterns Analysis
        </CardTitle>
        <CardDescription>
          {safeAspects.length} aspects • {safePatterns.length} patterns detected
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="grid">Aspect Grid</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>

          {/* Aspect Grid Tab */}
          <TabsContent value="grid" className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-1"></th>
                    {getPlanetOrderArray()
                      .filter(p => planets[p])
                      .map(planet => (
                        <th key={planet} className="p-1 text-center">
                          <span className="text-lg">{PLANET_SYMBOLS[planet]}</span>
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {getPlanetOrderArray()
                    .filter(p => planets[p])
                    .map((planet1, i) => (
                      <tr key={planet1}>
                        <td className="p-1 font-medium text-right">
                          <span className="text-lg">{PLANET_SYMBOLS[planet1]}</span>
                        </td>
                        {getPlanetOrderArray()
                          .filter(p => planets[p])
                          .map((planet2, j) => {
                            const aspect = aspectMatrix[planet1]?.[planet2]

                            if (i === j) {
                              // Diagonal - show planet name
                              return (
                                <td key={planet2} className="p-1 text-center bg-muted">
                                  <span className="text-[10px] capitalize">
                                    {planet1.slice(0, 3)}
                                  </span>
                                </td>
                              )
                            }

                            if (!aspect) {
                              return (
                                <td key={planet2} className="p-1 text-center">
                                  -
                                </td>
                              )
                            }

                            return (
                              <TooltipProvider key={planet2}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <td
                                      className="p-1 text-center cursor-pointer hover:bg-muted"
                                      onClick={() => setSelectedAspect(aspect)}
                                    >
                                      <span
                                        className={`text-lg ${getAspectStrengthColor(aspect.strength)}`}
                                        style={{ color: getAspectColor(aspect.type) }}
                                      >
                                        {getAspectSymbol(aspect.type)}
                                      </span>
                                    </td>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs space-y-1">
                                      <div className="font-medium">
                                        {planet1} {getAspectSymbol(aspect.type)} {planet2}
                                      </div>
                                      <div>
                                        {aspect.type} ({aspect.angle}°)
                                      </div>
                                      <div>Orb: {aspect.orb.toFixed(2)}°</div>
                                      <div>Strength: {aspect.strength}</div>
                                      <div>{aspect.applying ? 'Applying' : 'Separating'}</div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )
                          })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Aspect Legend */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Aspect Symbols</h4>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                {(
                  [
                    'conjunction',
                    'opposition',
                    'trine',
                    'square',
                    'sextile',
                    'quincunx',
                  ] as AspectType[]
                ).map(type => (
                  <div key={type} className="flex items-center gap-1">
                    <span style={{ color: getAspectColor(type) }} className="text-lg">
                      {getAspectSymbol(type)}
                    </span>
                    <span className="capitalize">{type}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Patterns Tab */}
          <TabsContent value="patterns" className="space-y-4">
            {safePatterns.length === 0 ? (
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  No major aspect patterns detected in this chart.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {safePatterns.map((pattern, index) => (
                  <Card
                    key={index}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedPattern(pattern)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {PATTERN_ICONS[pattern.type]}
                          <h4 className="font-medium capitalize">
                            {pattern.type.replace('-', ' ')}
                          </h4>
                          <Badge className={PATTERN_COLORS[pattern.type] || 'bg-gray-100'}>
                            {pattern.strength.toFixed(0)}% strength
                          </Badge>
                        </div>
                        {pattern.element && <Badge variant="outline">{pattern.element}</Badge>}
                      </div>

                      <div className="text-sm text-muted-foreground mb-2">
                        Planets: {pattern.planets.map(p => PLANET_SYMBOLS[p] || p).join(' - ')}
                      </div>

                      <p className="text-sm">{pattern.interpretation}</p>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {pattern.aspects.map((aspect, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {aspect.planet1} {getAspectSymbol(aspect.type)} {aspect.planet2}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="space-y-4">
            {/* Aspect Distribution */}
            <div>
              <h4 className="text-sm font-medium mb-3">Aspect Distribution</h4>
              <div className="space-y-2">
                {Object.entries(aspectsByType).map(([type, typeAspects]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        style={{ color: getAspectColor(type as AspectType) }}
                        className="text-lg"
                      >
                        {getAspectSymbol(type as AspectType)}
                      </span>
                      <span className="capitalize text-sm">{type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{typeAspects.length}</Badge>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{
                            width: `${(typeAspects.length / Math.max(1, safeAspects.length)) * 100}%`,
                            backgroundColor: getAspectColor(type as AspectType),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Aspect Strength Analysis */}
            <div>
              <h4 className="text-sm font-medium mb-3">Aspect Strength</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-muted rounded">
                  <div className="text-2xl font-bold text-red-600">
                    {safeAspects.filter(a => a.strength === 'exact').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Exact Aspects</div>
                </div>
                <div className="text-center p-3 bg-muted rounded">
                  <div className="text-2xl font-bold text-orange-600">
                    {safeAspects.filter(a => a.strength === 'tight').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Tight Aspects</div>
                </div>
              </div>
            </div>

            {/* Applying vs Separating */}
            <div>
              <h4 className="text-sm font-medium mb-3">Aspect Dynamics</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Applying</span>
                  </div>
                  <Badge variant="secondary">{safeAspects.filter(a => a.applying).length}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Separating</span>
                  </div>
                  <Badge variant="secondary">{safeAspects.filter(a => !a.applying).length}</Badge>
                </div>
              </div>
            </div>

            {/* Most Aspected Planets */}
            <div>
              <h4 className="text-sm font-medium mb-3">Most Aspected Planets</h4>
              <div className="space-y-2">
                {getPlanetOrderArray()
                  .filter(p => planets[p])
                  .map(planet => {
                    const planetAspects = safeAspects.filter(
                      a => a.planet1 === planet || a.planet2 === planet
                    )
                    return { planet, count: planetAspects.length }
                  })
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 5)
                  .map(({ planet, count }) => (
                    <div key={planet} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{PLANET_SYMBOLS[planet]}</span>
                        <span className="capitalize text-sm">{planet}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{count} aspects</Badge>
                        <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${(count / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Selected Aspect Details */}
        {selectedAspect && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">
                {selectedAspect.planet1} {getAspectSymbol(selectedAspect.type)}{' '}
                {selectedAspect.planet2}
              </h4>
              <button
                onClick={() => setSelectedAspect(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Type:</span> {selectedAspect.type}
              </div>
              <div>
                <span className="text-muted-foreground">Angle:</span> {selectedAspect.angle}°
              </div>
              <div>
                <span className="text-muted-foreground">Orb:</span> {selectedAspect.orb.toFixed(2)}°
              </div>
              <div>
                <span className="text-muted-foreground">Strength:</span> {selectedAspect.strength}
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Direction:</span>{' '}
                {selectedAspect.applying ? 'Applying (strengthening)' : 'Separating (weakening)'}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
