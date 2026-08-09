import type { Element } from '@/lib/agent-types'
import { TOKEN_TYPES, type EsmsCost } from '@/lib/economy-config'
import { buildAgentContext } from '@/lib/agents/persona/build-agent-context'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'

export const CHAT_RESONANCE_DISCOUNT = 0.5
export const CHAT_CLASH_MARKUP = 1.5

export type ElementalPriceRelationship = 'resonance' | 'clash' | 'neutral'

export interface AgentChatPricing {
  agentElement: Element | null
  transitElement: Element | null
  relationship: ElementalPriceRelationship
  multiplier: number
  baseCost: EsmsCost
  cost: EsmsCost
  waveHarmonics: Record<string, number>
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

/** Extract normalized element from string, agent ID, or agent object. */
export function extractAgentElement(agentOrInput: unknown): Element | null {
  if (!agentOrInput) return null

  if (typeof agentOrInput === 'string') {
    const direct = normalizeElement(agentOrInput)
    if (direct) return direct

    try {
      const ctx = buildAgentContext(agentOrInput)
      if (ctx?.agent?.consciousness?.dominantElement) {
        return normalizeElement(ctx.agent.consciousness.dominantElement)
      }
    } catch {}
    return null
  }

  if (typeof agentOrInput === 'object') {
    const obj = agentOrInput as any
    const raw = obj.consciousness?.dominantElement || obj.dominantElement || obj.element
    return normalizeElement(raw)
  }

  return null
}

function safeNum(val: unknown, fallback = 0): number {
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Derive an accessible per-agent base cost vector from natal chart placements & stats.
 * Baseline totals ~1.0 ESMS (0.25 avg per axis), weighted continuously by the agent's
 * specific chart dignity, solar agency, lunar receptivity, saturnian structure, and mercurial velocity.
 */
export function deriveAgentBaseCost(agentOrInput: unknown): EsmsCost {
  let agent: any = null
  if (typeof agentOrInput === 'string') {
    try {
      const ctx = buildAgentContext(agentOrInput)
      agent = ctx?.agent
    } catch {}
  } else if (typeof agentOrInput === 'object') {
    agent = agentOrInput
  }

  let spiritWeight = 0.25
  let essenceWeight = 0.25
  let matterWeight = 0.25
  let substanceWeight = 0.25

  if (agent) {
    try {
      const stats = deriveSacredStats(agent)
      // Solar agency & Jovian expansion → Spirit weight
      const solarPower =
        (safeNum(stats?.solarAgency) +
          safeNum(stats?.jovianExpansion) +
          safeNum(stats?.martialImpetus)) /
        300
      // Lunar receptivity & Neptunian resonance → Essence weight
      const lunarPower =
        (safeNum(stats?.lunarReceptivity) +
          safeNum(stats?.neptunianResonance) +
          safeNum(stats?.venusianCoherence)) /
        300
      // Saturnian structure & Chironic adaptation → Matter weight
      const saturnPower =
        (safeNum(stats?.saturnianStructure) +
          safeNum(stats?.chironicAdaptation) +
          safeNum(stats?.plutonicIntegration)) /
        300
      // Mercurial velocity & Uranian surprisal → Substance weight
      const mercurialPower =
        (safeNum(stats?.mercurialVelocity) + safeNum(stats?.uranianSurprisal)) / 200

      spiritWeight = 0.15 + solarPower * 0.3
      essenceWeight = 0.15 + lunarPower * 0.3
      matterWeight = 0.15 + saturnPower * 0.3
      substanceWeight = 0.15 + mercurialPower * 0.3
    } catch {}
  }

  // Element fallback if no agent object was resolved
  const element = extractAgentElement(agentOrInput)
  if (element === 'Fire') spiritWeight = Math.max(spiritWeight, 0.4)
  if (element === 'Water') essenceWeight = Math.max(essenceWeight, 0.4)
  if (element === 'Earth') matterWeight = Math.max(matterWeight, 0.4)
  if (element === 'Air') substanceWeight = Math.max(substanceWeight, 0.4)

  return {
    Spirit: roundEsms(safeNum(spiritWeight, 0.25)),
    Essence: roundEsms(safeNum(essenceWeight, 0.25)),
    Matter: roundEsms(safeNum(matterWeight, 0.25)),
    Substance: roundEsms(safeNum(substanceWeight, 0.25)),
  }
}

/**
 * Read the dominant element from the legacy live-alchemy response.
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
  const agent = extractAgentElement(agentElement)
  const transit = normalizeElement(transitElement)
  if (!agent || !transit) return 'neutral'
  if (agent === transit) return 'resonance'
  return OPPOSING_ELEMENT[agent] === transit ? 'clash' : 'neutral'
}

/**
 * Compute the continuous Chart Dignity Wavefunction \Psi_a(t) for live sky transits.
 * Returns a value in [-1, +1] representing harmonic resonance or dissonance.
 */
export function computeDignityWaveharmonics(currentAlchemy: unknown): Record<string, number> {
  if (!currentAlchemy || typeof currentAlchemy !== 'object') {
    return { Spirit: 0, Essence: 0, Matter: 0, Substance: 0 }
  }

  const effects = (currentAlchemy as Record<string, unknown>)['Alchemy Effects'] as
    | Record<string, unknown>
    | undefined
  if (!effects) return { Spirit: 0, Essence: 0, Matter: 0, Substance: 0 }

  const spiritVal = finiteNumber(effects['Total Spirit']) ?? 0
  const essenceVal = finiteNumber(effects['Total Essence']) ?? 0
  const matterVal = finiteNumber(effects['Total Matter']) ?? 0
  const substanceVal = finiteNumber(effects['Total Substance']) ?? 0

  const total =
    Math.abs(spiritVal) + Math.abs(essenceVal) + Math.abs(matterVal) + Math.abs(substanceVal)
  if (total === 0) return { Spirit: 0, Essence: 0, Matter: 0, Substance: 0 }

  // Waveharmonics normalized between -1 and +1
  return {
    Spirit: roundEsms(spiritVal / (total / 2)),
    Essence: roundEsms(essenceVal / (total / 2)),
    Matter: roundEsms(matterVal / (total / 2)),
    Substance: roundEsms(substanceVal / (total / 2)),
  }
}

export interface PerMessagePricingOptions {
  message?: string
  baseCostOverride?: EsmsCost
}

/** Calculate the complete four-axis fee for one message turn against the live sky. */
export function calculateAgentChatPricing(
  agentOrInput: unknown,
  currentAlchemy: unknown,
  options?: PerMessagePricingOptions | EsmsCost
): AgentChatPricing {
  const agentElement = extractAgentElement(agentOrInput)

  const messageStr =
    options && typeof options === 'object' && 'message' in options
      ? (options as PerMessagePricingOptions).message
      : undefined

  const baseCostOverride =
    options && typeof options === 'object' && 'Spirit' in options
      ? (options as EsmsCost)
      : (options as PerMessagePricingOptions)?.baseCostOverride

  const baseCost = baseCostOverride ?? deriveAgentBaseCost(agentOrInput)
  const transit = dominantTransitElement(currentAlchemy)
  const relationship = elementalPriceRelationship(agentElement, transit)

  let lengthMultiplier = 1.0
  if (messageStr && typeof messageStr === 'string') {
    const len = messageStr.trim().length
    lengthMultiplier = Math.min(1.5, Math.max(1.0, 1.0 + Math.floor(len / 200) * 0.1))
  }

  const multiplier =
    (relationship === 'resonance'
      ? CHAT_RESONANCE_DISCOUNT
      : relationship === 'clash'
        ? CHAT_CLASH_MARKUP
        : 1) * lengthMultiplier

  const waveHarmonics = computeDignityWaveharmonics(currentAlchemy)

  // Modulate fee per axis using continuous dignity wave: Cost_a = Base_a * (1 - 0.35 * Psi_a) * multiplier
  const cost: EsmsCost = {
    Spirit: roundEsms(
      baseCost.Spirit * Math.max(0.3, 1.0 - 0.35 * (waveHarmonics.Spirit || 0)) * multiplier
    ),
    Essence: roundEsms(
      baseCost.Essence * Math.max(0.3, 1.0 - 0.35 * (waveHarmonics.Essence || 0)) * multiplier
    ),
    Matter: roundEsms(
      baseCost.Matter * Math.max(0.3, 1.0 - 0.35 * (waveHarmonics.Matter || 0)) * multiplier
    ),
    Substance: roundEsms(
      baseCost.Substance * Math.max(0.3, 1.0 - 0.35 * (waveHarmonics.Substance || 0)) * multiplier
    ),
  }

  return {
    agentElement,
    transitElement: transit,
    relationship,
    multiplier,
    baseCost,
    cost,
    waveHarmonics,
  }
}
