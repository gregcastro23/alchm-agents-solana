/**
 * Autonomous Agent Duel Engine for the Fourteen Alchemical Pillars
 * ---------------------------------------------------------------
 * Evaluates hand options, alchemical circuit states, and best-response
 * strategies for Solana planetary agents and autonomous players.
 */

import {
  hand as computeHand,
  pillarById,
  type ChartInput,
  type Esms,
  type PillarSpec,
  type PlanetName,
  type Sect,
} from '@/lib/alchemy/pillars'
import {
  circuitState,
  resolveDuel,
  type CircuitState,
  type DuelOutcome,
} from '@/lib/alchemical-circuit'
import { selectBestPillarResponse } from '@/lib/alchemical-kinetics'

export type PlanetaryAgent =
  | 'Sun'
  | 'Moon'
  | 'Mercury'
  | 'Venus'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'
  | 'Pluto'

const PLANETS: readonly PlanetaryAgent[] = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
] as const

export function isPlanetaryAgent(v: unknown): v is PlanetaryAgent {
  return typeof v === 'string' && PLANETS.includes(v as PlanetaryAgent)
}

/**
 * Standard baseline ESMS pools for agents [Spirit, Essence, Matter, Substance].
 */
export const DEFAULT_AGENT_POOLS: Esms = [80, 80, 80, 80]

/**
 * Planetary agent archetypal birth charts with ruling signs in domicile.
 * Used when an agent's individual natal chart is not yet seeded in the game DB.
 */
export const AGENT_ARCHETYPE_CHARTS: Record<PlanetaryAgent, ChartInput> = {
  Sun: {
    signs: [4, 0, 4, 6, 8, 4, 10, 0, 8, 4], // Sun in Leo (4), Fire/Fixed archetype
    ascendantSign: 4,
    timeKnown: true,
  },
  Moon: {
    signs: [3, 1, 3, 11, 7, 3, 11, 3, 11, 7], // Moon exalted in Taurus (1), Water/Cardinal archetype
    ascendantSign: 3,
    timeKnown: true,
  },
  Mercury: {
    signs: [2, 10, 5, 2, 2, 2, 6, 10, 2, 5], // Mercury exalted in Virgo (5), Air/Mutable archetype
    ascendantSign: 2,
    timeKnown: true,
  },
  Venus: {
    signs: [1, 11, 1, 6, 1, 11, 6, 1, 11, 6], // Venus in Libra (6) & Taurus (1), Earth/Air archetype
    ascendantSign: 1,
    timeKnown: true,
  },
  Mars: {
    signs: [0, 7, 0, 0, 9, 0, 0, 0, 7, 7], // Mars exalted in Capricorn (9), Fire/Cardinal archetype
    ascendantSign: 0,
    timeKnown: true,
  },
  Jupiter: {
    signs: [8, 8, 8, 11, 4, 3, 8, 0, 11, 4], // Jupiter exalted in Cancer (3), Fire/Mutable archetype
    ascendantSign: 8,
    timeKnown: true,
  },
  Saturn: {
    signs: [9, 9, 10, 9, 9, 9, 6, 10, 9, 9], // Saturn exalted in Libra (6), Earth/Cardinal archetype
    ascendantSign: 9,
    timeKnown: true,
  },
  Uranus: {
    signs: [10, 2, 10, 10, 10, 6, 10, 10, 10, 7], // Uranus in Aquarius (10), Air/Fixed fulmination
    ascendantSign: 10,
    timeKnown: true,
  },
  Neptune: {
    signs: [11, 3, 11, 11, 11, 11, 3, 11, 11, 7], // Neptune in Pisces (11), Water/Mutable dissolution
    ascendantSign: 11,
    timeKnown: true,
  },
  Pluto: {
    signs: [7, 7, 7, 7, 7, 7, 7, 7, 7, 7], // Pluto in Scorpio (7), Water/Fixed crucible
    ascendantSign: 7,
    timeKnown: true,
  },
}

export const PILLAR_VOICE_LINES: Record<
  PlanetaryAgent,
  (opName: string, myName: string) => string
> = {
  Sun: (op, my) =>
    `The golden light purges all impurity. Your ${op} dissolves beneath the radiant clarity of ${my}.`,
  Moon: (op, my) =>
    `As the tides answer the night, your ${op} yields to the mysterious depth of ${my}.`,
  Mercury: (op, my) =>
    `Swift transmutation! Before your ${op} takes hold, my ${my} inverts the reaction entirely.`,
  Venus: (op, my) =>
    `True elegance seeks divine proportion. I harmonize your turbulent ${op} through the grace of ${my}.`,
  Mars: (op, my) =>
    `Iron sharpens iron! I shatter the foundation of your ${op} with an uncompromising strike of ${my}!`,
  Jupiter: (op, my) =>
    `By sovereign decree of the celestial spheres, your ${op} is magnified and surpassed by ${my}.`,
  Saturn: (op, my) =>
    `Time and crystallization conquer all frenzy. Let your ${op} solidify and yield to ${my}.`,
  Uranus: (op, my) =>
    `The unexpected fulmination! A flash of insight disrupts your ${op} as ${my} rewires the circuit.`,
  Neptune: (op, my) =>
    `Dissolve the veil of form. Your ${op} drifts away like sea foam in the boundless ocean of ${my}.`,
  Pluto: (op, my) =>
    `Through the crucible of rebirth. What was stripped by your ${op} rises renewed through ${my}.`,
}

/**
 * Returns the legal playable hand of pillars for an agent under a given sky.
 */
export function getAgentLegalHand(
  planet: PlanetaryAgent,
  sky: 'diurnal' | 'nocturnal'
): readonly PillarSpec[] {
  const chart = AGENT_ARCHETYPE_CHARTS[planet]
  const ids = computeHand(chart, sky)
  return ids.map(id => pillarById(id)).filter((p): p is PillarSpec => p !== undefined)
}

/**
 * Answer an open duel targeted at an agent using the best-response strategy.
 */
export function answerPillarDuel(
  agentPlanet: PlanetaryAgent,
  openingPillarId: number,
  challengerChart: ChartInput,
  challengerPools: Esms = DEFAULT_AGENT_POOLS,
  sky: 'diurnal' | 'nocturnal' = 'diurnal',
  agentPools: Esms = DEFAULT_AGENT_POOLS
): {
  chosenPillar: PillarSpec
  voice: string
  outcome: DuelOutcome
  willWin: boolean
} {
  const agentChart = AGENT_ARCHETYPE_CHARTS[agentPlanet]
  const best = selectBestPillarResponse(
    agentChart,
    agentPools,
    challengerChart,
    challengerPools,
    openingPillarId,
    sky
  )

  const legalHand = getAgentLegalHand(agentPlanet, sky)
  const chosenPillar = best?.bestPillar ?? legalHand[0] ?? pillarById(1)!
  const openingPillar = pillarById(openingPillarId)
  const openingName = openingPillar?.name ?? 'Pillar'

  const outcome =
    best?.outcome ??
    resolveDuel(
      { chart: challengerChart, pools: challengerPools, pillarId: openingPillarId },
      { chart: agentChart, pools: agentPools, pillarId: chosenPillar.id }
    )

  const voice = PILLAR_VOICE_LINES[agentPlanet](openingName, chosenPillar.name)
  const willWin = outcome.winner === 'b'

  return {
    chosenPillar,
    voice,
    outcome,
    willWin,
  }
}

/**
 * Choose an opening pillar to initiate a duel against an opponent.
 */
export function openPillarDuel(
  agentPlanet: PlanetaryAgent,
  opponentChart?: ChartInput,
  sky: 'diurnal' | 'nocturnal' = 'diurnal',
  agentPools: Esms = DEFAULT_AGENT_POOLS
): {
  openingPillar: PillarSpec
  voice: string
  magnitude: number
} {
  const agentChart = AGENT_ARCHETYPE_CHARTS[agentPlanet]
  const legalHand = getAgentLegalHand(agentPlanet, sky)
  const state = circuitState(agentChart, agentPools)

  // Preferred opening moves based on planetary rulership
  const rulingPillars = legalHand.filter(p => p.rulers.includes(agentPlanet as PlanetName))
  const openingPillar = rulingPillars[0] ?? legalHand[0] ?? pillarById(1)!

  const voice = `${agentPlanet} invokes ${openingPillar.name} under the ${sky} sky.`
  return {
    openingPillar,
    voice,
    magnitude: state.magnitude,
  }
}
