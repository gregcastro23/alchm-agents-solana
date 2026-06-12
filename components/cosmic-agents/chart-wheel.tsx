'use client'

import React from 'react'
import { SIGNS, PLANETS, ELEMENT_COLOR } from './constants'
import type { ChartOfMoment, PlanetName, AspectType } from './types'

interface Props {
  chart: ChartOfMoment
  size?: number
  animate?: boolean
}

const ASPECT_COLOR: Record<AspectType, string> = {
  conjunction: '#f5d195',
  sextile: '#7ad1c4',
  square: '#ef5d4e',
  trine: '#8aa56a',
  opposition: '#a78bfa',
}

export function ChartWheel({ chart, size = 320, animate = true }: Props) {
  const cx = size / 2
  const cy = size / 2
  const rOuter = size * 0.48
  const rSignIn = size * 0.4
  const rSignOut = size * 0.46
  const rGlyph = size * 0.43
  const rPlanet = size * 0.345
  const rInner = size * 0.3
  const rCore = size * 0.16

  const degToXY = (deg: number, r: number): [number, number] => {
    const a = ((deg - 90) * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }

  const positionsByName = Object.fromEntries(chart.positions.map(p => [p.planet, p]))

  const planetAbs = (p: { sign: string; degree: number }) => {
    const idx = SIGNS.findIndex(s => s.name === p.sign)
    return idx * 30 + p.degree
  }

  return (
    <svg className="wheel-svg" viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id="cw-coreGrad">
          <stop offset="0%" stopColor="rgba(245,181,66,0.4)" />
          <stop offset="60%" stopColor="rgba(245,181,66,0.06)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="cw-discGrad">
          <stop offset="0%" stopColor="rgba(167,139,250,0.10)" />
          <stop offset="100%" stopColor="rgba(167,139,250,0.0)" />
        </radialGradient>
      </defs>

      <circle
        cx={cx}
        cy={cy}
        r={rOuter}
        fill="none"
        stroke="rgba(167,139,250,0.20)"
        strokeWidth="1"
      />
      <circle cx={cx} cy={cy} r={rSignOut} fill="url(#cw-discGrad)" />
      <circle
        cx={cx}
        cy={cy}
        r={rSignOut}
        fill="none"
        stroke="rgba(167,139,250,0.12)"
        strokeWidth="0.75"
      />
      <circle
        cx={cx}
        cy={cy}
        r={rSignIn}
        fill="none"
        stroke="rgba(167,139,250,0.16)"
        strokeWidth="0.75"
      />
      <circle
        cx={cx}
        cy={cy}
        r={rInner}
        fill="none"
        stroke="rgba(167,139,250,0.20)"
        strokeWidth="0.75"
        strokeDasharray="2 3"
      />

      {SIGNS.map((sign, i) => {
        const start = i * 30
        const end = start + 30
        const [x1, y1] = degToXY(start, rSignOut)
        const [x2, y2] = degToXY(start, rSignIn)
        const isRuler = sign.name === chart.dominantSign

        let rulerPath: React.ReactNode = null
        if (isRuler) {
          const outerPts: Array<[number, number]> = []
          for (let d = start; d <= end; d += 1) outerPts.push(degToXY(d, rSignOut))
          const innerPts: Array<[number, number]> = []
          for (let d = end; d >= start; d -= 1) innerPts.push(degToXY(d, rSignIn))
          const path =
            outerPts.map((p, idx) => (idx === 0 ? 'M' : 'L') + p[0] + ',' + p[1]).join(' ') +
            innerPts.map(p => 'L' + p[0] + ',' + p[1]).join(' ') +
            'Z'
          rulerPath = (
            <path
              d={path}
              fill="rgba(245,181,66,0.10)"
              stroke="rgba(245,181,66,0.4)"
              strokeWidth="0.5"
            />
          )
        }

        const [gx, gy] = degToXY(start + 15, rGlyph)
        return (
          <g key={sign.name}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(167,139,250,0.18)"
              strokeWidth="0.75"
            />
            {rulerPath}
            <text
              x={gx}
              y={gy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size * 0.045}
              fill={isRuler ? '#f5d195' : ELEMENT_COLOR[sign.element]}
              opacity={isRuler ? 1 : 0.65}
              fontFamily="Cormorant Garamond, serif"
            >
              {sign.glyph}
            </text>
          </g>
        )
      })}

      <g opacity="0.85">
        {chart.aspects.map((asp, i) => {
          const pa = positionsByName[asp.a]
          const pb = positionsByName[asp.b]
          if (!pa || !pb) return null
          const [ax, ay] = degToXY(planetAbs(pa), rPlanet)
          const [bx, by] = degToXY(planetAbs(pb), rPlanet)
          const color = ASPECT_COLOR[asp.type] || '#a78bfa'
          const dash = asp.applying ? undefined : '3 4'
          return (
            <line
              key={i}
              x1={ax}
              y1={ay}
              x2={bx}
              y2={by}
              stroke={color}
              strokeWidth={asp.applying ? 1.1 : 0.7}
              strokeDasharray={dash}
              opacity={asp.intensity * 0.7 + 0.15}
            />
          )
        })}
      </g>

      <circle cx={cx} cy={cy} r={rCore} fill="url(#cw-coreGrad)" />
      <circle cx={cx} cy={cy} r={rCore * 0.4} fill="rgba(245,181,66,0.18)" />

      {chart.positions.map(p => {
        const abs = planetAbs(p)
        const [px, py] = degToXY(abs, rPlanet)
        const isRuler = p.planet === chart.dominantPlanet
        const planet = PLANETS[p.planet as PlanetName]
        if (!planet) return null
        return (
          <g key={p.planet as string}>
            {isRuler && (
              <circle
                cx={px}
                cy={py}
                r={size * 0.04}
                fill="rgba(245,181,66,0.15)"
                stroke="rgba(245,181,66,0.6)"
                strokeWidth="0.75"
              >
                {animate && (
                  <animate
                    attributeName="r"
                    values={`${size * 0.04};${size * 0.055};${size * 0.04}`}
                    dur="2.6s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>
            )}
            <circle
              cx={px}
              cy={py}
              r={size * 0.022}
              fill="rgba(8,6,26,0.95)"
              stroke={isRuler ? '#f5d195' : planet.color}
              strokeWidth={isRuler ? 1.2 : 0.8}
            />
            <text
              x={px}
              y={py + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size * 0.032}
              fill={isRuler ? '#f5d195' : planet.color}
              fontFamily="Cormorant Garamond, serif"
            >
              {planet.glyph}
            </text>
          </g>
        )
      })}

      {[0, 90, 180, 270].map(deg => {
        const [x1, y1] = degToXY(deg, rOuter)
        const [x2, y2] = degToXY(deg, rOuter + 4)
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(167,139,250,0.4)"
            strokeWidth="1"
          />
        )
      })}
    </svg>
  )
}
