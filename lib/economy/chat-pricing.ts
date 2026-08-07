import type { Element } from '@/lib/agent-types'
import { TOKEN_TYPES, UNIFIED_CHAT_BASE_COST, type EsmsCost } from '@/lib/economy-config'

export const CHAT_RESONANCE_DISCOUNT = 0.5
export const CHAT_CLASH_MARKUP = 1.5

export type ElementalPriceRelationship = 'resonance' | 'clash' | 'neutral'

export interface AgentChatPricing {
  agentElement: Element | null
  transitElement: Element | null
  relationship: ElementalPriceRelationship
  multiplier: number
  cost: EsmsCost
}

const ELEMENT_TOTALS: ReadonlyArray<{
  element: Element
  axis: 'Total Spirit' | 'Total Essence' | 'Total Matter' | 'Total Substance'
}> = [
  { element: 'Fire', axis: 'Total Spirit' },
  { element: 'Water', axis: 'Total Essence' },
  { element: 'Earth', axis: 'Total Matter' },
  { element: 'Air', axis: 'Total Substance' },
]

const OPPOSING_ELEMENT: Readonly<Record<Element, Element>> = {
  Fire: 'Water',
  Water: 'Fire',
  Earth: 'Air',
  Air: 'Earth',
}

function normalizeElement(value: unknown): Element | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'fire') return 'Fire'
  if (normalized === 'water') return 'Water'
  if (normalized === 'earth') return 'Earth'
  if (normalized === 'air') return 'Air'
  return null
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function roundEsms(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000
}

function multiplyCost(baseCost: EsmsCost, multiplier: number): EsmsCost {
  return TOKEN_TYPES.reduce((cost, token) => {
    cost[token] = roundEsms(baseCost[token] * multiplier)
    return cost
  }, {} as EsmsCost)
}

/**
 * Read the dominant element from the legacy live-alchemy response.
 * Missing/invalid or all-zero observations return null, keeping pricing at its
 * neutral baseline rather than fabricating a transit alignment.
 */
export function dominantTransitElement(currentAlchemy: unknown): Element | null {
  if (!currentAlchemy || typeof currentAlchemy !== 'object') return null
  const effects = (currentAlchemy as Record<string, unknown>)['Alchemy Effects']
  if (!effects || typeof effects !== 'object') return null

  const measured = ELEMENT_TOTALS.map(({ element, axis }) => ({
    element,
    value: finiteNumber((effects as Record<string, unknown>)[axis]),
  })).filter((entry): entry is { element: Element; value: number } => entry.value !== null)

  if (measured.length === 0 || measured.every(entry => entry.value === 0)) return null

  const maxValue = Math.max(...measured.map(entry => entry.value))
  const dominant = measured.filter(entry => entry.value === maxValue)
  return dominant.length === 1 ? dominant[0].element : null
}

export function elementalPriceRelationship(
  agentElement: unknown,
  transitElement: unknown
): ElementalPriceRelationship {
  const agent = normalizeElement(agentElement)
  const transit = normalizeElement(transitElement)
  if (!agent || !transit) return 'neutral'
  if (agent === transit) return 'resonance'
  return OPPOSING_ELEMENT[agent] === transit ? 'clash' : 'neutral'
}

/** Calculate the complete four-axis fee for one agent against the live sky. */
export function calculateAgentChatPricing(
  agentElement: unknown,
  currentAlchemy: unknown,
  baseCost: EsmsCost = UNIFIED_CHAT_BASE_COST
): AgentChatPricing {
  const agent = normalizeElement(agentElement)
  const transit = dominantTransitElement(currentAlchemy)
  const relationship = elementalPriceRelationship(agent, transit)
  const multiplier =
    relationship === 'resonance'
      ? CHAT_RESONANCE_DISCOUNT
      : relationship === 'clash'
        ? CHAT_CLASH_MARKUP
        : 1

  return {
    agentElement: agent,
    transitElement: transit,
    relationship,
    multiplier,
    cost: multiplyCost(baseCost, multiplier),
  }
}
