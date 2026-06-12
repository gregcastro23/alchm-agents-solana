import type { ElementName, SkyContext, TransitTrigger } from './transit-trigger-detector.js'

export type AgentActionType = 'claim_daily' | 'commensal_request' | 'recipe_generation'

export interface HistoricalAgentRecord {
  agentId: string
  name: string
  title?: string
  dominantElement?: string | null
  spiritScore?: number | null
  essenceScore?: number | null
  matterScore?: number | null
  substanceScore?: number | null
  specialty?: string | null
  wisdomDomains?: any
  natalChart?: any
}

export interface CandidateAgentAction {
  agentId: string
  agentEmail: string
  eventType: AgentActionType
  triggerType: TransitTrigger['type']
  triggerSummary: string
  score: number
  metadataPayload: Record<string, unknown>
  cooldownHours: number
  idempotencyWindow: 'day' | 'half-day' | 'week' | 'transit'
}

interface NormalizedStats {
  spirit: number
  essence: number
  matter: number
  substance: number
  heat: number
  reactivity: number
}

const ELEMENT_TO_ESMS: Record<
  ElementName,
  keyof Pick<NormalizedStats, 'spirit' | 'essence' | 'matter' | 'substance'>
> = {
  Fire: 'spirit',
  Air: 'essence',
  Water: 'matter',
  Earth: 'substance',
}

const ACTION_THRESHOLDS: Record<AgentActionType, number> = {
  claim_daily: 0.65,
  commensal_request: 0.75,
  recipe_generation: 0.85,
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function normalizedScore(value: number | null | undefined, fallback: number): number {
  if (!Number.isFinite(Number(value))) return fallback
  const numeric = Number(value)
  return numeric > 1 ? clamp01(numeric / 100) : clamp01(numeric)
}

function normalizeElement(value: string | null | undefined): ElementName | null {
  if (!value) return null
  const normalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  return ['Fire', 'Earth', 'Air', 'Water'].includes(normalized) ? (normalized as ElementName) : null
}

function getStats(agent: HistoricalAgentRecord): NormalizedStats {
  const spirit = normalizedScore(agent.spiritScore, 0.5)
  const essence = normalizedScore(agent.essenceScore, 0.5)
  const matter = normalizedScore(agent.matterScore, 0.5)
  const substance = normalizedScore(agent.substanceScore, 0.5)
  const dominantElement = normalizeElement(agent.dominantElement)
  const denominator = substance + essence + matter + 1
  const heat = clamp01((spirit ** 2 + (dominantElement === 'Fire' ? 1 : 0) ** 2) / denominator)
  const reactivity = clamp01((spirit ** 2 + substance ** 2 + essence ** 2) / (matter + 0.5) ** 2)

  return {
    spirit,
    essence,
    matter,
    substance,
    heat,
    reactivity,
  }
}

function agentEmail(agentId: string): string {
  return `${agentId}@agentic.alchm.kitchen`
}

function roundScore(score: number): number {
  return Math.round(clamp01(score) * 1000) / 1000
}

function transitPlanetBonus(trigger: TransitTrigger, eventType: AgentActionType): number {
  const planet = trigger.transitingPlanet
  if (!planet) return 0

  if (eventType === 'recipe_generation') {
    if (planet === 'Jupiter') return 0.28
    if (planet === 'Sun') return 0.18
    if (planet === 'Saturn') return 0.14
  }

  if (eventType === 'commensal_request') {
    if (planet === 'Venus') return 0.28
    if (planet === 'Mars') return 0.24
    if (planet === 'Moon') return 0.12
  }

  if (eventType === 'claim_daily') {
    if (planet === 'Moon') return 0.22
    if (planet === 'Saturn') return 0.12
  }

  return 0
}

function lunarActionBonus(
  trigger: TransitTrigger,
  stats: NormalizedStats,
  eventType: AgentActionType
): number {
  if (trigger.type !== 'lunar_phase' || !trigger.moonElement) return 0

  const elementStat = stats[ELEMENT_TO_ESMS[trigger.moonElement]]
  const isNewMoon = trigger.lunarPhase === 'New Moon'
  const isFullMoon = trigger.lunarPhase === 'Full Moon'

  if (eventType === 'claim_daily') {
    return (isNewMoon ? 0.2 : 0.08) + elementStat * 0.18
  }

  if (eventType === 'commensal_request') {
    return (isFullMoon ? 0.22 : 0.06) + (trigger.moonElement === 'Fire' ? stats.heat * 0.14 : 0)
  }

  if (eventType === 'recipe_generation') {
    return (isNewMoon ? 0.18 : 0.05) + (trigger.moonElement === 'Air' ? stats.essence * 0.1 : 0)
  }

  return 0
}

function recipeNameFor(
  agent: HistoricalAgentRecord,
  trigger: TransitTrigger,
  sky: SkyContext
): string {
  const element =
    normalizeElement(agent.dominantElement) || trigger.moonElement || sky.lunar.moon.element
  const domains = Array.isArray(agent.wisdomDomains) ? agent.wisdomDomains : []
  const domain = String(domains[0] || agent.specialty || 'Cosmic')
    .split('&')[0]
    .split(',')[0]
    .trim()

  const vesselByElement: Record<string, string> = {
    Fire: 'Ember Broth',
    Earth: 'Harvest Bowl',
    Air: 'Herbal Tisane',
    Water: 'Moonlit Stew',
  }

  return `${agent.name}'s ${domain} ${vesselByElement[element] || 'Cosmic Dish'}`
}

function metadataFor(
  agent: HistoricalAgentRecord,
  eventType: AgentActionType,
  trigger: TransitTrigger,
  sky: SkyContext,
  stats: NormalizedStats
): Record<string, unknown> {
  const base = {
    transitTrigger: trigger.summary,
    triggerType: trigger.type,
    evaluatedAt: sky.evaluatedAt.toISOString(),
    lunarPhase: sky.lunar.phaseName,
    moonSign: sky.lunar.moon.sign,
    moonElement: sky.lunar.moon.element,
    dominantElement: normalizeElement(agent.dominantElement),
    esms: {
      spirit: stats.spirit,
      essence: stats.essence,
      matter: stats.matter,
      substance: stats.substance,
    },
  }

  if (eventType === 'recipe_generation') {
    return {
      ...base,
      recipeName: recipeNameFor(agent, trigger, sky),
      topic: trigger.summary,
    }
  }

  if (eventType === 'commensal_request') {
    const invitationTheme = `${agent.name} requests a ${sky.lunar.moon.element.toLowerCase()}-aligned table`
    return {
      ...base,
      invitationTheme,
      topic: invitationTheme,
      targetName: 'Alchm Kitchen community',
    }
  }

  return {
    ...base,
    yieldType: `${sky.lunar.moon.element.toLowerCase()}_cosmic_yield`,
  }
}

function scoreAction(
  eventType: AgentActionType,
  agent: HistoricalAgentRecord,
  trigger: TransitTrigger,
  sky: SkyContext,
  stats: NormalizedStats
): number {
  const dominantElementBonus =
    normalizeElement(agent.dominantElement) === trigger.moonElement ? 0.08 : 0

  if (eventType === 'claim_daily') {
    return (
      0.24 +
      trigger.strength * 0.2 +
      stats.matter * 0.18 +
      stats.substance * 0.16 +
      lunarActionBonus(trigger, stats, eventType) +
      transitPlanetBonus(trigger, eventType) +
      dominantElementBonus
    )
  }

  if (eventType === 'commensal_request') {
    return (
      0.18 +
      trigger.strength * 0.25 +
      stats.essence * 0.2 +
      stats.heat * 0.14 +
      stats.reactivity * 0.08 +
      lunarActionBonus(trigger, stats, eventType) +
      transitPlanetBonus(trigger, eventType) +
      dominantElementBonus
    )
  }

  return (
    0.2 +
    trigger.strength * 0.3 +
    stats.spirit * 0.18 +
    stats.essence * 0.08 +
    lunarActionBonus(trigger, stats, eventType) +
    transitPlanetBonus(trigger, eventType) +
    dominantElementBonus
  )
}

export function mapAgentActions(
  agent: HistoricalAgentRecord,
  triggers: TransitTrigger[],
  sky: SkyContext
): CandidateAgentAction[] {
  const stats = getStats(agent)
  const candidates: CandidateAgentAction[] = []

  for (const trigger of triggers) {
    const eventTypes: AgentActionType[] =
      trigger.type === 'transit_conjunction'
        ? ['recipe_generation', 'commensal_request', 'claim_daily']
        : ['claim_daily', 'commensal_request', 'recipe_generation']

    for (const eventType of eventTypes) {
      const score = roundScore(scoreAction(eventType, agent, trigger, sky, stats))
      if (score < ACTION_THRESHOLDS[eventType]) continue

      candidates.push({
        agentId: agent.agentId,
        agentEmail: agentEmail(agent.agentId),
        eventType,
        triggerType: trigger.type,
        triggerSummary: trigger.summary,
        score,
        metadataPayload: metadataFor(agent, eventType, trigger, sky, stats),
        cooldownHours:
          eventType === 'claim_daily' ? 24 : eventType === 'commensal_request' ? 12 : 96,
        idempotencyWindow:
          eventType === 'claim_daily'
            ? 'day'
            : eventType === 'commensal_request'
              ? 'half-day'
              : trigger.type === 'transit_conjunction'
                ? 'transit'
                : 'week',
      })
    }
  }

  return candidates.sort((a, b) => b.score - a.score)
}

export const agentActionMapper = {
  mapAgentActions,
}
