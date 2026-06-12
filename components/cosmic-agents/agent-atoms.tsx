'use client'

import React from 'react'
import { ELEMENT_COLOR, PLANETS, JING_MOVES, SACRED7_KEYS } from './constants'
import type {
  CouncilAgent,
  Element,
  ESMS,
  JingMoveId,
  NatalPosition,
  PlanetName,
  Sacred7Stats,
} from './types'

function getInitials(name: string): string {
  return name
    .split(/[\s·]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

function agentTone(a: CouncilAgent): Element {
  const top = (Object.entries(a.elemental) as [Element, number][]).sort((x, y) => y[1] - x[1])[0]
  return top[0]
}

interface AvatarProps {
  agent: CouncilAgent
  size?: 'small' | 'md' | 'large'
  showBand?: boolean
  showRuler?: boolean
  onClick?: () => void
}

export function Avatar({
  agent,
  size = 'md',
  showBand = true,
  showRuler = false,
  onClick,
}: AvatarProps) {
  const cls = ['avatar']
  if (size === 'small') cls.push('small')
  if (size === 'large') cls.push('large')
  if (agent.kind === 'planetary' || agent.kind === 'lunar') cls.push(agent.kind)
  if (agent.isRulerOfMoment || showRuler) cls.push('ruler')

  const planet = agent.planet ? PLANETS[agent.planet as PlanetName] : null
  const label = planet ? planet.glyph : getInitials(agent.name)
  agentTone(agent) // computed for side-effect of asserting elemental shape

  return (
    <div
      className={cls.join(' ')}
      onClick={onClick}
      style={{
        color: planet ? planet.color : 'inherit',
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      <span className="ring" />
      {label}
      {showBand && size !== 'small' && (
        <div className="band">
          {(['Fire', 'Water', 'Earth', 'Air'] as Element[]).map(el => (
            <i
              key={el}
              style={{
                background: ELEMENT_COLOR[el],
                opacity: Math.min(1, agent.elemental[el] / 50),
                width: Math.max(2, Math.round(agent.elemental[el] / 10)) + 'px',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface AgentLineProps {
  agent: CouncilAgent
  size?: 'small' | 'md'
  subline?: string
  onClick?: () => void
}

export function AgentLine({ agent, size = 'md', subline, onClick }: AgentLineProps) {
  return (
    <div
      className="agent-line"
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <Avatar agent={agent} size={size} />
      <div style={{ minWidth: 0 }}>
        <div className={size === 'small' ? 'name-mini' : 'name'}>{agent.name}</div>
        {subline && <div className="sub">{subline}</div>}
      </div>
    </div>
  )
}

interface MoveChipProps {
  moveId: JingMoveId
  cost?: { stat: string; amount: number }
  label?: string
}

export function MoveChip({ moveId, cost }: MoveChipProps) {
  const move = JING_MOVES[moveId]
  if (!move) return null
  const el = move.element.split('·')[0].toLowerCase()
  const displayCost = cost || { stat: move.cost.stat, amount: move.cost.amount }
  return (
    <span className={'move ' + el}>
      <span className="g">{move.glyph}</span>
      <span className="nm">{move.name}</span>
      {displayCost && (
        <span className="cost">
          −{displayCost.amount} {displayCost.stat}
        </span>
      )}
    </span>
  )
}

export function ElementalBar({
  data,
  height = 8,
}: {
  data: Record<Element, number>
  height?: number
}) {
  const total = (Object.values(data) as number[]).reduce((s, v) => s + v, 0) || 1
  return (
    <>
      <div className="elemental-bar" style={{ height: height + 'px' }}>
        {(['Fire', 'Water', 'Earth', 'Air'] as Element[]).map(el => (
          <div
            key={el}
            style={{
              width: (data[el] / total) * 100 + '%',
              background: ELEMENT_COLOR[el],
            }}
          />
        ))}
      </div>
      <div className="elemental-legend">
        {(['Fire', 'Water', 'Earth', 'Air'] as Element[]).map(el => (
          <div key={el} className="lg">
            <span className="dot" style={{ background: ELEMENT_COLOR[el] }} />
            <span>{el[0]}</span>
            <span className="pct">{data[el]}%</span>
          </div>
        ))}
      </div>
    </>
  )
}

export function ESMSDisplay({ esms }: { esms: ESMS }) {
  const items: Array<{ k: keyof ESMS; lab: string; cls: string }> = [
    { k: 'spirit', lab: 'Spirit', cls: 'spirit' },
    { k: 'essence', lab: 'Essence', cls: 'essence' },
    { k: 'matter', lab: 'Matter', cls: 'matter' },
    { k: 'substance', lab: 'Substance', cls: 'substance' },
  ]
  return (
    <div className="esms">
      {items.map(it => (
        <div key={it.k} className={'quad ' + it.cls}>
          <div className="lab">{it.lab}</div>
          <div className="val">{esms[it.k]}</div>
        </div>
      ))}
    </div>
  )
}

export function Sacred7Display({ stats }: { stats: Sacred7Stats }) {
  return (
    <div className="sacred7">
      {SACRED7_KEYS.map(k => (
        <div key={k} className="s7row">
          <div className="lab">{k}</div>
          <div className="bar">
            <i style={{ width: stats[k] + '%' }} />
          </div>
          <div className="v">{stats[k]}</div>
        </div>
      ))}
    </div>
  )
}

export function NatalGrid({ natal }: { natal: NatalPosition[] }) {
  return (
    <div className="natal-grid">
      {natal.map(p => {
        const planet = PLANETS[p.planet as PlanetName]
        return (
          <div key={p.planet} className="natal-cell">
            <span className="planet" style={{ color: planet?.color }}>
              {planet?.glyph || ''} {p.planet}
            </span>
            <span>
              {Math.floor(p.degree)}° {p.sign}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function CooldownRing({ size = 14, progress = 0 }: { size?: number; progress?: number }) {
  const r = (size - 2) / 2
  const c = size / 2
  const circ = 2 * Math.PI * r
  const dash = circ * progress
  return (
    <svg width={size} height={size} style={{ verticalAlign: 'middle' }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </svg>
  )
}
