'use client'

import React, { useState } from 'react'
import { SignCharacterVector } from '@/lib/astrological-character-vectors'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface SignVectorGraphicProps {
  signVector: SignCharacterVector
  size?: 'small' | 'medium' | 'large'
  showLabels?: boolean
  showTooltips?: boolean
  animated?: boolean
  className?: string
}

const ZODIAC_SIGNS = [
  { name: 'Aries', symbol: '♈', element: 'fire', color: '#FF6B6B', angle: 0 },
  { name: 'Taurus', symbol: '♉', element: 'earth', color: '#4ECDC4', angle: 30 },
  { name: 'Gemini', symbol: '♊', element: 'air', color: '#45B7D1', angle: 60 },
  { name: 'Cancer', symbol: '♋', element: 'water', color: '#96CEB4', angle: 90 },
  { name: 'Leo', symbol: '♌', element: 'fire', color: '#FFEAA7', angle: 120 },
  { name: 'Virgo', symbol: '♍', element: 'earth', color: '#DDA0DD', angle: 150 },
  { name: 'Libra', symbol: '♎', element: 'air', color: '#98D8C8', angle: 180 },
  { name: 'Scorpio', symbol: '♏', element: 'water', color: '#F7DC6F', angle: 210 },
  { name: 'Sagittarius', symbol: '♐', element: 'fire', color: '#BB8FCE', angle: 240 },
  { name: 'Capricorn', symbol: '♑', element: 'earth', color: '#85C1E9', angle: 270 },
  { name: 'Aquarius', symbol: '♒', element: 'air', color: '#F8C471', angle: 300 },
  { name: 'Pisces', symbol: '♓', element: 'water', color: '#82E0AA', angle: 330 },
]

const ELEMENT_COLORS = {
  fire: '#FF6B6B',
  earth: '#4ECDC4',
  air: '#45B7D1',
  water: '#96CEB4',
}

export default function SignVectorGraphic({
  signVector,
  size = 'medium',
  showLabels = true,
  showTooltips = true,
  animated = true,
  className = '',
}: SignVectorGraphicProps) {
  const [hoveredSign, setHoveredSign] = useState<string | null>(null)

  // Size configurations
  const sizeConfig = {
    small: { radius: 60, strokeWidth: 8, fontSize: 12, labelDistance: 75 },
    medium: { radius: 100, strokeWidth: 12, fontSize: 16, labelDistance: 120 },
    large: { radius: 140, strokeWidth: 16, fontSize: 20, labelDistance: 165 },
  }

  const config = sizeConfig[size]
  const svgSize = config.labelDistance * 2 + 40
  const center = svgSize / 2

  // Calculate segment paths for each zodiac sign
  const createSegmentPath = (startAngle: number, percentage: number) => {
    const endAngle = startAngle + 30 // Each sign gets 30 degrees
    const innerRadius = config.radius - config.strokeWidth
    const outerRadius = config.radius

    // Scale radius based on percentage (minimum 20% visibility)
    const scaledRadius = innerRadius + (outerRadius - innerRadius) * Math.max(0.2, percentage / 100)

    const startAngleRad = ((startAngle - 90) * Math.PI) / 180
    const endAngleRad = ((endAngle - 90) * Math.PI) / 180

    const x1 = center + innerRadius * Math.cos(startAngleRad)
    const y1 = center + innerRadius * Math.sin(startAngleRad)
    const x2 = center + scaledRadius * Math.cos(startAngleRad)
    const y2 = center + scaledRadius * Math.sin(startAngleRad)
    const x3 = center + scaledRadius * Math.cos(endAngleRad)
    const y3 = center + scaledRadius * Math.sin(endAngleRad)
    const x4 = center + innerRadius * Math.cos(endAngleRad)
    const y4 = center + innerRadius * Math.sin(endAngleRad)

    return `M ${x1} ${y1} L ${x2} ${y2} A ${scaledRadius} ${scaledRadius} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 0 0 ${x1} ${y1}`
  }

  // Get label position
  const getLabelPosition = (angle: number) => {
    const angleRad = ((angle - 90 + 15) * Math.PI) / 180 // Center of each 30-degree segment
    const x = center + config.labelDistance * Math.cos(angleRad)
    const y = center + config.labelDistance * Math.sin(angleRad)
    return { x, y }
  }

  // Calculate elemental distribution
  const elementalTotals = ZODIAC_SIGNS.reduce(
    (acc, sign) => {
      const percentage = signVector[sign.name.toLowerCase() as keyof SignCharacterVector] as number
      acc[sign.element] = (acc[sign.element] || 0) + percentage
      return acc
    },
    {} as Record<string, number>
  )

  const dominantElement = Object.entries(elementalTotals).reduce((a, b) =>
    elementalTotals[a[0]] > elementalTotals[b[0]] ? a : b
  )[0]

  const SignSegment = ({ sign, index }: { sign: (typeof ZODIAC_SIGNS)[0]; index: number }) => {
    const percentage = signVector[sign.name.toLowerCase() as keyof SignCharacterVector] as number
    const isHovered = hoveredSign === sign.name
    const opacity = percentage < 1 ? 0.3 : Math.max(0.4, percentage / 100)

    const path = createSegmentPath(sign.angle, percentage)
    const labelPos = getLabelPosition(sign.angle)

    const segment = (
      <g key={sign.name}>
        <path
          d={path}
          fill={sign.color}
          opacity={opacity}
          stroke={isHovered ? '#333' : 'white'}
          strokeWidth={isHovered ? 2 : 1}
          className={`transition-all duration-300 cursor-pointer ${animated ? 'hover:scale-105' : ''}`}
          onMouseEnter={() => setHoveredSign(sign.name)}
          onMouseLeave={() => setHoveredSign(null)}
        />
        {showLabels && (
          <g>
            <text
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={config.fontSize}
              fontWeight="bold"
              fill="#333"
              className="pointer-events-none select-none"
            >
              {sign.symbol}
            </text>
            <text
              x={labelPos.x}
              y={labelPos.y + config.fontSize + 4}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={config.fontSize * 0.6}
              fill="#666"
              className="pointer-events-none select-none"
            >
              {Math.round(percentage)}%
            </text>
          </g>
        )}
      </g>
    )

    if (showTooltips) {
      return (
        <Tooltip key={sign.name}>
          <TooltipTrigger asChild>{segment}</TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <div className="font-bold">
                {sign.name} {sign.symbol}
              </div>
              <div className="text-sm text-muted-foreground">
                {percentage.toFixed(1)}% • {sign.element}
              </div>
              <div className="text-xs mt-1">
                {percentage > 15
                  ? 'Strong influence'
                  : percentage > 5
                    ? 'Moderate influence'
                    : percentage > 0
                      ? 'Minor influence'
                      : 'No influence'}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      )
    }

    return segment
  }

  return (
    <TooltipProvider>
      <div className={`flex flex-col items-center ${className}`}>
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className={`${animated ? 'transition-transform duration-500' : ''} ${hoveredSign ? 'scale-105' : ''}`}
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={config.radius - config.strokeWidth / 2}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={2}
          />

          {/* Central element indicator */}
          <circle
            cx={center}
            cy={center}
            r={config.radius - config.strokeWidth - 10}
            fill={ELEMENT_COLORS[dominantElement as keyof typeof ELEMENT_COLORS]}
            opacity={0.2}
          />

          {/* Central text */}
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={config.fontSize}
            fontWeight="bold"
            fill="#333"
            className="pointer-events-none select-none"
          >
            {dominantElement.toUpperCase()}
          </text>

          {/* Zodiac segments */}
          {ZODIAC_SIGNS.map((sign, index) => (
            <SignSegment key={sign.name} sign={sign} index={index} />
          ))}
        </svg>

        {/* Element distribution summary */}
        {size !== 'small' && (
          <div className="mt-2 flex flex-wrap gap-2 justify-center max-w-xs">
            {Object.entries(elementalTotals)
              .sort(([, a], [, b]) => b - a)
              .map(([element, total]) => (
                <Badge
                  key={element}
                  variant="outline"
                  className="text-xs"
                  style={{
                    borderColor: ELEMENT_COLORS[element as keyof typeof ELEMENT_COLORS],
                    color: ELEMENT_COLORS[element as keyof typeof ELEMENT_COLORS],
                  }}
                >
                  {element} {Math.round(total)}%
                </Badge>
              ))}
          </div>
        )}

        {hoveredSign && size === 'large' && (
          <Card className="mt-4 w-64 absolute z-10 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {ZODIAC_SIGNS.find(s => s.name === hoveredSign)?.symbol}
                {hoveredSign}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xs text-muted-foreground">
                <div>
                  Influence:{' '}
                  {(
                    signVector[hoveredSign.toLowerCase() as keyof SignCharacterVector] as number
                  ).toFixed(1)}
                  %
                </div>
                <div>Element: {ZODIAC_SIGNS.find(s => s.name === hoveredSign)?.element}</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  )
}

// Helper function to calculate sign vectors from natal chart data
export function calculateSignVectorFromChart(natalChart: any): SignCharacterVector {
  const placements: Array<{ planet: string; sign: string }> = []

  // Support multiple natalChart shapes
  // Case 1: natalChart.planets with capitalized planet keys
  if (natalChart?.planets && typeof natalChart.planets === 'object') {
    const planetKeys = Object.keys(natalChart.planets)
    for (const key of planetKeys) {
      const data = natalChart.planets[key]
      const sign = data?.sign
      if (typeof sign === 'string' && sign.length > 0) {
        placements.push({ planet: key.toLowerCase(), sign })
      }
    }
  } else {
    // Case 2: flat lowercase keys
    const maybePush = (planetKey: string) => {
      const data = natalChart?.[planetKey]
      const sign = data?.sign
      if (typeof sign === 'string' && sign.length > 0) {
        placements.push({ planet: planetKey, sign })
      }
    }
    ;[
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
      'ascendant',
    ].forEach(maybePush)
  }

  // Use the character vector calculator
  const { CharacterVectorCalculator } = require('@/lib/astrological-character-vectors')
  return CharacterVectorCalculator.calculateSignVectors(placements)
}

// Component for displaying just the dominant signs as a compact rune-like symbol
export function SignVectorRune({
  signVector,
  size = 24,
}: {
  signVector: SignCharacterVector
  size?: number
}) {
  const dominantSigns = Object.entries(signVector)
    .filter(([sign]) => sign !== 'total')
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)

  return (
    <div
      className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100 border-2 border-purple-200"
      style={{ width: size, height: size }}
    >
      <div className="text-xs font-bold text-purple-800">
        {dominantSigns
          .map(([sign]) => ZODIAC_SIGNS.find(s => s.name.toLowerCase() === sign)?.symbol)
          .join('')}
      </div>
    </div>
  )
}
