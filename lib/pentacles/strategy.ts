import {
  PLANET_FACTIONS,
  type NatalChartInput,
  type NatalPlacementInput,
  type PentaclesAgent,
  type PentaclesCard,
  type PentaclesIntent,
  type PentaclesJingMove,
  type PentaclesStar,
  type PentaclesZone,
  type PlanetFaction,
  type WarTableChoiceInput,
  type WordCandidate,
} from './types'

const FULL_WHEEL_MINUTES = 21_600

const SIGN_RULERS: readonly PlanetFaction[] = [
  'Mars',
  'Venus',
  'Mercury',
  'Moon',
  'Sun',
  'Mercury',
  'Venus',
  'Pluto',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
]

const JING_COUNTERS: Record<PentaclesJingMove, PentaclesJingMove> = {
  Meltdown: 'Vacuum',
  Freeze: 'Meltdown',
  TectonicRoot: 'Erode',
  Vacuum: 'Freeze',
  Erode: 'Vacuum',
}

function factionIndex(faction: PlanetFaction): number {
  return PLANET_FACTIONS.indexOf(faction)
}

function signRuler(sign: number): PlanetFaction {
  return SIGN_RULERS[((sign % 12) + 12) % 12] ?? 'Mars'
}

function circularDistance(a: number, b: number): number {
  const distance = Math.abs(a - b)
  return Math.min(distance, FULL_WHEEL_MINUTES - distance)
}

function isAngular(placement: NatalPlacementInput, chart: NatalChartInput): boolean {
  const absoluteMinutes = placement.sign * 1_800 + placement.arcMinutes
  return (
    circularDistance(absoluteMinutes, chart.ascendant) < 600 ||
    circularDistance(absoluteMinutes, chart.midheaven) < 600
  )
}

/** Mirrors Pentacles `chart::faction_scores`; keep this covered by parity tests. */
export function factionScores(chart: NatalChartInput): Record<PlanetFaction, number> {
  const scores = Object.fromEntries(PLANET_FACTIONS.map(faction => [faction, 0])) as Record<
    PlanetFaction,
    number
  >

  if (chart.timeKnown) {
    scores[signRuler(Math.floor(chart.ascendant / 1_800) % 12)] += 3
  }

  for (const placement of chart.placements) {
    scores[placement.body] += 1 + placement.dignity * 0.4
    if (chart.timeKnown && isAngular(placement, chart)) scores[placement.body] += 1.5
    if (placement.body === 'Sun' || placement.body === 'Moon') {
      scores[signRuler(placement.sign)] += 2
    }

    if (signRuler(placement.sign) !== placement.body) scores[placement.body] += 0.5
  }

  for (let left = 0; left < chart.placements.length; left += 1) {
    for (let right = left + 1; right < chart.placements.length; right += 1) {
      const a = chart.placements[left]
      const b = chart.placements[right]
      if (!a || !b) continue
      if (signRuler(a.sign) === b.body && signRuler(b.sign) === a.body) {
        scores[a.body] += 1.5
        scores[b.body] += 1.5
      }
    }
  }

  return scores
}

export function topFactionChoices(chart: NatalChartInput): PlanetFaction[] {
  const scores = factionScores(chart)
  return [...PLANET_FACTIONS]
    .sort((left, right) => scores[right] - scores[left] || factionIndex(left) - factionIndex(right))
    .slice(0, 3)
}

export function isFactionEligible(chart: NatalChartInput, faction: PlanetFaction): boolean {
  return topFactionChoices(chart).includes(faction)
}

/** Mirrors Pentacles `can_access_zone`; Pentacles remains the final authority. */
export function accessibleZoneIds(
  faction: PlanetFaction,
  zones: readonly PentaclesZone[]
): number[] {
  const owned = new Set(
    zones.filter(zone => zone.owner === faction).map(zone => Number(zone.zoneId))
  )

  return zones
    .map(zone => zone.zoneId)
    .filter(zoneId => {
      if (zoneId < 5) return true
      if (zoneId < 10) {
        const spireIndex = zoneId - 5
        return owned.has(spireIndex) || owned.has((spireIndex + 4) % 5)
      }
      return [5, 6, 7, 8, 9].filter(zoneId => owned.has(zoneId)).length >= 2
    })
    .sort((left, right) => left - right)
}

function cardPower(card: PentaclesCard): number {
  const base = card.attack + card.health * 0.5 + card.armour * 0.4 + card.level * 2
  return base * (card.inverted ? 0.92 : 1) * (card.isMajor ? 1.25 : 1)
}

function starPriority(star: PentaclesStar, zones: readonly PentaclesZone[]): number {
  const zone = zones.find(candidate => candidate.zoneId === star.regionHint)
  const contested = zone?.owner ? 20 : 10
  const controlPressure = zone ? Math.max(0, 1_000 - Math.abs(zone.control)) / 100 : 0
  const visibility = Math.max(-5, Math.min(10, 5 - star.magnitude))
  return contested + controlPressure + visibility
}

export function chooseStarBattle(input: {
  agent: PentaclesAgent
  zones: readonly PentaclesZone[]
  stars: readonly PentaclesStar[]
  cards: readonly PentaclesCard[]
}): PentaclesIntent | null {
  const reachable = new Set(accessibleZoneIds(input.agent.faction, input.zones))
  const star = input.stars
    .filter(candidate => reachable.has(candidate.regionHint))
    .filter(candidate => candidate.heldBy !== input.agent.faction)
    .sort(
      (left, right) =>
        starPriority(right, input.zones) - starPriority(left, input.zones) ||
        left.hipId - right.hipId
    )[0]

  const cards = input.cards
    .filter(candidate => candidate.ownerIdentity === input.agent.identity)
    .sort(
      (left, right) => cardPower(right) - cardPower(left) || left.cardId.localeCompare(right.cardId)
    )
    .slice(0, 3)

  if (!star || cards.length === 0) return null

  const cardIds = cards.map(card => card.cardId)
  return {
    intentId: `${input.agent.agentKey}:star_battle:${star.hipId}:${cardIds.join('-')}`,
    action: 'star_battle',
    agentKey: input.agent.agentKey,
    targetId: String(star.hipId),
    cardIds,
    rationale: `Highest-scoring accessible enemy star in zone ${star.regionHint}`,
    score:
      starPriority(star, input.zones) + cards.reduce((total, card) => total + cardPower(card), 0),
    createdAt: new Date().toISOString(),
  }
}

export function isWordCandidate(word: string, candidates: readonly WordCandidate[]): boolean {
  const normalized = word.trim().toUpperCase()
  return candidates.some(candidate => candidate.word.trim().toUpperCase() === normalized)
}

export function chooseJingCounter(opening: PentaclesJingMove): PentaclesJingMove {
  return JING_COUNTERS[opening]
}

/**
 * Scores only the legal IDs supplied by Pentacles. This is the ASOL half of the
 * future `agent_melee_turn` handoff; it never tries to reproduce the referee.
 */
export function chooseWarTableCard(input: WarTableChoiceInput): string | null {
  const legal = new Set(input.legalCardIds)
  const choices = input.hand.filter(card => legal.has(card.cardId))
  if (choices.length === 0) return null

  choices.sort((left, right) => {
    const score = (card: PentaclesCard) =>
      card.rank +
      (card.suit === input.trumpSuit ? 16 : 0) +
      (card.isMajor ? 12 : 0) +
      (input.trickNumber >= 10 ? cardPower(card) / 10 : 0)
    return score(right) - score(left) || left.cardId.localeCompare(right.cardId)
  })

  return choices[0]?.cardId ?? null
}
