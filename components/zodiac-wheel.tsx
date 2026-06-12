'use client'

import React, { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ZoomIn, ZoomOut, RotateCcw, Target } from 'lucide-react'

interface ZodiacWheelProps {
  natalChart?: {
    planets: Array<{
      name: string
      longitude: number
      sign: string
      house?: number
    }>
    ascendant?: {
      longitude: number
      sign: string
    }
  }
  currentTransits?: Array<{
    planet: string
    longitude: number
    sign: string
  }>
  activeTransits?: Array<{
    transitDate: string
    transitDegree: number
    transitingPlanet: string
    natalPlanet: string
    natalDegree: number
    aspectType: string
    aspectOrb: number
    overallScore: number
  }>
  onDegreeClick?: (degree: number, sign: string) => void
  onPlanetClick?: (planet: string, isNatal: boolean) => void
  size?: number
}

const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]

const SIGN_SYMBOLS: Record<string, string> = {
  Aries: '♈',
  Taurus: '♉',
  Gemini: '♊',
  Cancer: '♋',
  Leo: '♌',
  Virgo: '♍',
  Libra: '♎',
  Scorpio: '♏',
  Sagittarius: '♐',
  Capricorn: '♑',
  Aquarius: '♒',
  Pisces: '♓',
}

const PLANET_SYMBOLS: Record<string, string> = {
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
  Ascendant: 'As',
}

const PLANET_COLORS: Record<string, string> = {
  Sun: '#FFD700',
  Moon: '#C0C0C0',
  Mercury: '#8C7853',
  Venus: '#FFC0CB',
  Mars: '#CD5C5C',
  Jupiter: '#DAA520',
  Saturn: '#808080',
  Uranus: '#40E0D0',
  Neptune: '#4169E1',
  Pluto: '#8B0000',
  Ascendant: '#9370DB',
}

const ELEMENT_COLORS: Record<string, string> = {
  Fire: '#FF6B35',
  Water: '#4A90E2',
  Air: '#7ED321',
  Earth: '#F5A623',
}

export function ZodiacWheel({
  natalChart,
  currentTransits = [],
  activeTransits = [],
  onDegreeClick,
  onPlanetClick,
  size = 600,
}: ZodiacWheelProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [rotation, setRotation] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [selectedDegree, setSelectedDegree] = useState<number | null>(null)
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null)
  const [showAspects, setShowAspects] = useState(true)
  const [showTransiting, setShowTransiting] = useState(true)
  const [showNatal, setShowNatal] = useState(true)
  const [aspectThreshold, setAspectThreshold] = useState([5]) // orb threshold
  const [hoveredElement, setHoveredElement] = useState<string | null>(null)

  const centerX = size / 2
  const centerY = size / 2
  const outerRadius = size / 2 - 40
  const innerRadius = outerRadius - 60
  const degreeRadius = innerRadius - 40

  // Convert zodiac longitude to angle (0° = Aries = 0°, counterclockwise)
  const longitudeToAngle = (longitude: number) => {
    return (360 - longitude) * (Math.PI / 180)
  }

  // Convert angle back to zodiac longitude
  const angleToLongitude = (angle: number) => {
    const degrees = (angle * 180) / Math.PI
    return (360 - degrees) % 360
  }

  // Get position on circle
  const getPosition = (angle: number, radius: number) => {
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)
    return { x, y }
  }

  // Get sign for degree
  const getSignForDegree = (degree: number) => {
    const signIndex = Math.floor(degree / 30)
    return ZODIAC_SIGNS[signIndex]
  }

  // Get degree within sign
  const getDegreeInSign = (degree: number) => {
    return degree % 30
  }

  // Handle degree click
  const handleDegreeClick = (event: React.MouseEvent<SVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = event.clientX - rect.left - centerX
    const y = event.clientY - rect.top - centerY
    const angle = Math.atan2(y, x)
    const longitude = angleToLongitude(angle)

    setSelectedDegree(longitude)
    onDegreeClick?.(longitude, getSignForDegree(longitude))
  }

  // Handle planet click
  const handlePlanetClick = (planet: string, isNatal: boolean) => {
    setSelectedPlanet(planet)
    onPlanetClick?.(planet, isNatal)
  }

  // Reset view
  const resetView = () => {
    setRotation(0)
    setZoom(1)
    setSelectedDegree(null)
    setSelectedPlanet(null)
  }

  // Render zodiac signs
  const renderZodiacSigns = () => {
    const signs = []

    for (let i = 0; i < 12; i++) {
      const startAngle = i * 30 * (Math.PI / 180)
      const endAngle = (i + 1) * 30 * (Math.PI / 180)

      // Sign sector
      const pathData = [
        `M ${centerX + outerRadius * Math.cos(startAngle)} ${centerY + outerRadius * Math.sin(startAngle)}`,
        `A ${outerRadius} ${outerRadius} 0 0 1 ${centerX + outerRadius * Math.cos(endAngle)} ${centerY + outerRadius * Math.sin(endAngle)}`,
        `L ${centerX + innerRadius * Math.cos(endAngle)} ${centerY + innerRadius * Math.sin(endAngle)}`,
        `A ${innerRadius} ${innerRadius} 0 0 0 ${centerX + innerRadius * Math.cos(startAngle)} ${centerY + innerRadius * Math.sin(startAngle)}`,
        'Z',
      ].join(' ')

      const sign = ZODIAC_SIGNS[i]
      const element = getElementForSign(sign)
      const elementColor = ELEMENT_COLORS[element as keyof typeof ELEMENT_COLORS]
      const midAngle = (startAngle + endAngle) / 2
      const symbolPos = getPosition(midAngle, (outerRadius + innerRadius) / 2)

      signs.push(
        <g key={`sign-${i}`}>
          <path
            d={pathData}
            fill={elementColor}
            fillOpacity={0.1}
            stroke={elementColor}
            strokeWidth={1}
            className="cursor-pointer hover:fill-opacity-30 transition-all"
            onMouseEnter={() => setHoveredElement(sign)}
            onMouseLeave={() => setHoveredElement(null)}
            onClick={() => onDegreeClick?.(i * 30, sign)}
          />
          {/* Sign symbol */}
          <text
            key={`symbol-${i}`}
            x={symbolPos.x}
            y={symbolPos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="16"
            fill={elementColor}
            className="font-bold pointer-events-none select-none"
          >
            {SIGN_SYMBOLS[sign]}
          </text>
          {/* Degree markers */}
          {Array.from({ length: 6 }, (_, degIndex) => {
            const deg = degIndex * 5
            const degreeAngle = ((i * 30 + deg) * Math.PI) / 180
            const markerPos = getPosition(degreeAngle, degreeRadius)
            const isMainMarker = deg % 10 === 0

            return (
              <line
                key={`degree-${i}-${deg}`}
                x1={markerPos.x}
                y1={markerPos.y}
                x2={markerPos.x + (isMainMarker ? 10 : 5) * Math.cos(degreeAngle)}
                y2={markerPos.y + (isMainMarker ? 10 : 5) * Math.sin(degreeAngle)}
                stroke={elementColor}
                strokeWidth={isMainMarker ? 2 : 1}
                className="pointer-events-none"
              />
            )
          })}
        </g>
      )
    }

    return signs
  }

  // Render planets
  const renderPlanets = () => {
    const planets: any[] = []

    if (showNatal && natalChart?.planets) {
      natalChart.planets.forEach(planet => {
        const angle = longitudeToAngle(planet.longitude)
        const pos = getPosition(angle, degreeRadius - 20)
        const color = PLANET_COLORS[planet.name as keyof typeof PLANET_COLORS] || '#666'

        planets.push(
          <g key={`natal-${planet.name}`}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={8}
              fill={color}
              stroke="#fff"
              strokeWidth={2}
              className="cursor-pointer hover:r-10 transition-all drop-shadow-lg"
              onClick={() => handlePlanetClick(planet.name, true)}
            />
            <text
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fill="#fff"
              className="font-bold pointer-events-none select-none"
            >
              {PLANET_SYMBOLS[planet.name] || planet.name[0]}
            </text>
          </g>
        )
      })
    }

    if (showTransiting) {
      currentTransits.forEach(transit => {
        const angle = longitudeToAngle(transit.longitude)
        const pos = getPosition(angle, degreeRadius - 45)
        const color = PLANET_COLORS[transit.planet as keyof typeof PLANET_COLORS] || '#666'

        planets.push(
          <g key={`transit-${transit.planet}`}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={6}
              fill={color}
              stroke="#fff"
              strokeWidth={2}
              className="cursor-pointer hover:r-8 transition-all drop-shadow-lg opacity-80"
              onClick={() => handlePlanetClick(transit.planet, false)}
            />
            <text
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fill="#fff"
              className="font-bold pointer-events-none select-none"
            >
              {PLANET_SYMBOLS[transit.planet] || transit.planet[0]}
            </text>
          </g>
        )
      })
    }

    return planets
  }

  // Render aspects
  const renderAspects = () => {
    if (!showAspects) return []

    const aspects: any[] = []

    activeTransits.forEach((transit, index) => {
      if (transit.aspectOrb > aspectThreshold[0]) return

      // Find natal planet position
      const natalPlanet = natalChart?.planets.find(p => p.name === transit.natalPlanet)
      if (!natalPlanet) return

      // Find transiting planet position
      const transitingPlanet = currentTransits.find(p => p.planet === transit.transitingPlanet)
      if (!transitingPlanet) return

      const natalAngle = longitudeToAngle(natalPlanet.longitude)
      const transitAngle = longitudeToAngle(transitingPlanet.longitude)

      const natalPos = getPosition(natalAngle, degreeRadius - 20)
      const transitPos = getPosition(transitAngle, degreeRadius - 45)

      // Determine aspect color
      let aspectColor = '#666'
      if (transit.aspectType === 'Conjunction') aspectColor = '#FFD700'
      else if (transit.aspectType === 'Opposition') aspectColor = '#FF4444'
      else if (transit.aspectType === 'Trine') aspectColor = '#44FF44'
      else if (transit.aspectType === 'Square') aspectColor = '#FF8844'

      // Calculate opacity based on significance
      const opacity = Math.max(0.3, transit.overallScore)

      aspects.push(
        <line
          key={`aspect-${index}`}
          x1={natalPos.x}
          y1={natalPos.y}
          x2={transitPos.x}
          y2={transitPos.y}
          stroke={aspectColor}
          strokeWidth={2}
          strokeOpacity={opacity}
          className="pointer-events-none"
        />
      )
    })

    return aspects
  }

  // Get element for sign
  const getElementForSign = (sign: string) => {
    const elementMap: Record<string, string> = {
      Aries: 'Fire',
      Taurus: 'Earth',
      Gemini: 'Air',
      Cancer: 'Water',
      Leo: 'Fire',
      Virgo: 'Earth',
      Libra: 'Air',
      Scorpio: 'Water',
      Sagittarius: 'Fire',
      Capricorn: 'Earth',
      Aquarius: 'Air',
      Pisces: 'Water',
    }
    return elementMap[sign] || 'Fire'
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Zodiac Wheel Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Display Options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Display Options</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-natal" className="text-sm">
                    Natal Planets
                  </Label>
                  <Switch id="show-natal" checked={showNatal} onCheckedChange={setShowNatal} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-transiting" className="text-sm">
                    Transiting Planets
                  </Label>
                  <Switch
                    id="show-transiting"
                    checked={showTransiting}
                    onCheckedChange={setShowTransiting}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-aspects" className="text-sm">
                    Aspect Lines
                  </Label>
                  <Switch
                    id="show-aspects"
                    checked={showAspects}
                    onCheckedChange={setShowAspects}
                  />
                </div>
              </div>
            </div>

            {/* Aspect Settings */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Aspect Settings</Label>
              <div className="space-y-2">
                <Label className="text-sm">Max Orb: {aspectThreshold[0]}°</Label>
                <Slider
                  value={aspectThreshold}
                  onValueChange={setAspectThreshold}
                  max={15}
                  min={0.5}
                  step={0.5}
                  className="w-full"
                />
              </div>
            </div>

            {/* View Controls */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">View Controls</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoom(Math.min(zoom * 1.2, 3))}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoom(Math.max(zoom * 0.8, 0.5))}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={resetView}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zodiac Wheel */}
      <Card>
        <CardContent className="flex justify-center p-6">
          <div className="relative">
            <svg
              ref={svgRef}
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="cursor-crosshair"
              onClick={handleDegreeClick}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center',
              }}
            >
              {/* Outer circle */}
              <circle
                cx={centerX}
                cy={centerY}
                r={outerRadius}
                fill="none"
                stroke="#333"
                strokeWidth={2}
              />

              {/* Inner circle */}
              <circle
                cx={centerX}
                cy={centerY}
                r={innerRadius}
                fill="none"
                stroke="#666"
                strokeWidth={1}
              />

              {/* Degree circle */}
              <circle
                cx={centerX}
                cy={centerY}
                r={degreeRadius}
                fill="none"
                stroke="#999"
                strokeWidth={1}
              />

              {/* Zodiac signs */}
              {renderZodiacSigns()}

              {/* Planets */}
              {renderPlanets()}

              {/* Aspects */}
              {renderAspects()}

              {/* Selected degree indicator */}
              {selectedDegree !== null && (
                <g>
                  <line
                    x1={centerX}
                    y1={centerY}
                    x2={centerX + degreeRadius * Math.cos(longitudeToAngle(selectedDegree))}
                    y2={centerY + degreeRadius * Math.sin(longitudeToAngle(selectedDegree))}
                    stroke="#FFD700"
                    strokeWidth={3}
                    strokeOpacity={0.8}
                  />
                  <circle
                    cx={centerX + degreeRadius * Math.cos(longitudeToAngle(selectedDegree))}
                    cy={centerY + degreeRadius * Math.sin(longitudeToAngle(selectedDegree))}
                    r={4}
                    fill="#FFD700"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                </g>
              )}
            </svg>

            {/* Hover tooltip */}
            {hoveredElement && (
              <div className="absolute top-2 left-2 bg-black/80 text-white p-2 rounded text-sm pointer-events-none">
                {hoveredElement} ({getElementForSign(hoveredElement)})
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Elements */}
            <div>
              <h4 className="font-semibold mb-2">Elements</h4>
              <div className="space-y-1">
                {Object.entries(ELEMENT_COLORS).map(([element, color]) => (
                  <div key={element} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                    <span className="text-sm">{element}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Planets */}
            <div>
              <h4 className="font-semibold mb-2">Planets</h4>
              <div className="space-y-1">
                {Object.entries(PLANET_SYMBOLS).map(([planet, symbol]) => (
                  <div key={planet} className="flex items-center gap-2">
                    <span className="text-sm">{symbol}</span>
                    <span className="text-sm">{planet}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Aspects */}
            <div>
              <h4 className="font-semibold mb-2">Aspects</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-yellow-400" />
                  <span className="text-sm">Conjunction</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-red-500" />
                  <span className="text-sm">Opposition</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-green-500" />
                  <span className="text-sm">Trine</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-orange-500" />
                  <span className="text-sm">Square</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Degree Details Dialog */}
      {selectedDegree !== null && (
        <Dialog open={selectedDegree !== null} onOpenChange={() => setSelectedDegree(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Degree Details</DialogTitle>
              <DialogDescription>
                Information about {selectedDegree.toFixed(1)}° {getSignForDegree(selectedDegree)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Longitude</Label>
                  <p className="text-lg">{selectedDegree.toFixed(1)}°</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Sign</Label>
                  <p className="text-lg">{getSignForDegree(selectedDegree)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Degree in Sign</Label>
                  <p className="text-lg">{getDegreeInSign(selectedDegree).toFixed(1)}°</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Element</Label>
                  <p className="text-lg">{getElementForSign(getSignForDegree(selectedDegree))}</p>
                </div>
              </div>

              {/* Planetary agents for this degree */}
              <div>
                <Label className="text-sm font-medium">Planetary Agents</Label>
                <div className="mt-2 space-y-2">
                  {/* This would be populated with actual agent data */}
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Mars in Aries</Badge>
                      <Badge variant="secondary">1st Decan</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Dynamic action, pioneering spirit, courage and initiative
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Planet Details Dialog */}
      {selectedPlanet && (
        <Dialog open={selectedPlanet !== null} onOpenChange={() => setSelectedPlanet(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Planet Details</DialogTitle>
              <DialogDescription>Information about {selectedPlanet}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Planet</Label>
                  <p className="text-lg flex items-center gap-2">
                    <span>{PLANET_SYMBOLS[selectedPlanet] || ''}</span>
                    {selectedPlanet}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Type</Label>
                  <p className="text-lg">
                    {selectedPlanet === selectedPlanet ? 'Natal' : 'Transiting'}
                  </p>
                </div>
              </div>

              {/* Planet information would be populated here */}
              <div>
                <Label className="text-sm font-medium">Position</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Position information would be displayed here
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
