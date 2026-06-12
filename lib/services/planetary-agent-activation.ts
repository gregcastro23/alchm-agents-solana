/**
 * Planetary Agent Activation Service
 * ===================================
 *
 * Activates planetary agents for specific degrees and calculates their
 * consciousness profiles based on current celestial conditions.
 */

import {
  getPlanetaryAgentForDegree,
  type PlanetaryAgentConfig,
} from '../degree-planetary-agent-mapping'
import { UnifiedAgentFactory } from '../unified-agent-factory'
import type { PlanetaryConfig, UnifiedAgent } from '../unified-agent-types'
import {
  getPlanetaryDignity,
  getSignElement,
  getPlanetaryElement,
  calculateElementalAffinity,
} from '../astrological-data'
import { getLunarDegreePersonality } from '../moon-phase-calculator'
import { PLANET_SYMBOLS, PLANET_COLORS } from '../planetary-config-helper'

export interface ActivatedPlanetaryAgent {
  // Degree information
  degree: number
  zodiacDegree: number
  sign: string

  // Planetary agent configuration
  config: PlanetaryAgentConfig

  // Activated agent (using unified agent system)
  agent: UnifiedAgent

  // Activation strength
  activationStrength: number // 0-1

  // Consciousness state at this degree
  consciousnessState: {
    level: string
    powerLevel: number
    themes: string[]
    qualities: string[]
  }

  // Transit information (if applicable)
  transitInfo?: {
    transitingPlanet: string
    natalPlanet?: string
    aspectType?: string
    orb?: number
    significance: number
  }
}

/**
 * Activate a planetary agent for a specific degree
 */
export function activatePlanetaryAgentForDegree(
  degree: number,
  options: {
    transitingPlanet?: string
    natalPlanet?: string
    aspectType?: string
    orb?: number
    currentDateTime?: Date
  } = {}
): ActivatedPlanetaryAgent | null {
  const config = getPlanetaryAgentForDegree(degree)

  if (!config) return null

  // Create planetary config for unified agent factory
  const planetaryConfig: PlanetaryConfig = {
    planet: config.ruler,
    sign: config.sign,
    degree: String(config.zodiacDegree),
    isDiurnal: options.currentDateTime ? isDiurnalTime(options.currentDateTime) : true,
    retrograde: false, // Would need ephemeris data for accuracy
  } as any

  // Create unified agent
  const factory = new UnifiedAgentFactory()
  const agent = factory.createFromPlanetary(planetaryConfig)

  // Calculate activation strength
  const activationStrength = calculateActivationStrength(config, options)

  // Calculate significance if this is a transit
  let transitInfo
  if (options.transitingPlanet) {
    transitInfo = {
      transitingPlanet: options.transitingPlanet,
      natalPlanet: options.natalPlanet,
      aspectType: options.aspectType || 'conjunction',
      orb: options.orb || 0,
      significance: calculateTransitSignificance(config, options),
    }
  }

  return {
    degree,
    zodiacDegree: config.zodiacDegree,
    sign: config.sign,
    config,
    agent,
    activationStrength,
    consciousnessState: {
      level: config.consciousnessLevel,
      powerLevel: config.powerLevel,
      themes: config.themes,
      qualities: config.qualities,
    },
    transitInfo,
  }
}

/**
 * Activate planetary agents for all natal placements
 */
export function activateNatalPlanetaryAgents(
  natalPlacements: Array<{ planet: string; degree: number; sign: string; house?: number }>
): ActivatedPlanetaryAgent[] {
  return natalPlacements
    .map(placement => {
      const activated = activatePlanetaryAgentForDegree(placement.degree, {
        natalPlanet: placement.planet,
      })

      if (!activated) return null

      // Enhance with natal-specific information
      return {
        ...activated,
        transitInfo: {
          transitingPlanet: placement.planet,
          natalPlanet: placement.planet,
          aspectType: 'natal_position',
          orb: 0,
          significance: activated.config.powerLevel,
        },
      }
    })
    .filter(Boolean) as ActivatedPlanetaryAgent[]
}

/**
 * Calculate transit significance when Sun (or another planet) transits a natal placement
 */
export function calculateTransitActivation(
  transitingPlanetDegree: number,
  natalPlacements: Array<{ planet: string; degree: number; sign: string }>,
  options: {
    transitingPlanet?: string
    orbTolerance?: number
  } = {}
): ActivatedPlanetaryAgent[] {
  const transitingPlanet = options.transitingPlanet || 'Sun'
  const orbTolerance = options.orbTolerance || 5 // degrees

  const activatedAgents: ActivatedPlanetaryAgent[] = []

  for (const placement of natalPlacements) {
    // Calculate orb
    const orb = calculateOrb(transitingPlanetDegree, placement.degree)

    // Only consider aspects within orb tolerance
    if (orb > orbTolerance) continue

    // Activate the planetary agent at the natal degree
    const activated = activatePlanetaryAgentForDegree(placement.degree, {
      transitingPlanet,
      natalPlanet: placement.planet,
      aspectType: 'conjunction',
      orb,
    })

    if (activated) {
      activatedAgents.push(activated)
    }
  }

  // Sort by significance (highest first)
  return activatedAgents.sort(
    (a, b) => (b.transitInfo?.significance || 0) - (a.transitInfo?.significance || 0)
  )
}

/**
 * Create planetary agents for all 10 planets at a specific moment
 */
export function createMomentPlanetaryAgents(
  planetaryData: {
    planets: Record<
      string,
      { longitude: number; sign: string; signDegree: number; retrograde?: boolean }
    >
  },
  options: {
    currentDateTime?: Date
  } = {}
): ActivatedPlanetaryAgent[] {
  const planetNames = [
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
  ]
  const agents: ActivatedPlanetaryAgent[] = []

  for (const planetName of planetNames) {
    const planetData = planetaryData.planets[planetName]
    if (!planetData) {
      console.log(
        `Planet ${planetName} not found in planetaryData.planets:`,
        Object.keys(planetaryData.planets)
      )
      continue
    }

    // Create planetary config for unified agent factory
    const planetaryConfig: PlanetaryConfig = {
      planet: planetName,
      sign: planetData.sign,
      degree: planetData.signDegree.toString(),
      dignity: getPlanetaryDignity(planetName, planetData.sign),
      element: getSignElement(planetData.sign) as any,
      color: PLANET_COLORS[planetName as keyof typeof PLANET_COLORS] || '#8b5cf6',
      symbol: PLANET_SYMBOLS[planetName as keyof typeof PLANET_SYMBOLS] || '●',
      isDiurnal: options.currentDateTime ? isDiurnalTime(options.currentDateTime) : true,
      retrograde: planetData.retrograde || false,
    } as any

    // Add lunar personality for Moon agent
    if (planetName === 'Moon') {
      const lunarPersonality = getLunarDegreePersonality(planetData.longitude)
      planetaryConfig.moonPhase = lunarPersonality.phase
      planetaryConfig.moonPersonality = lunarPersonality.personality
      planetaryConfig.moonDegree = planetData.longitude
    }

    // Create unified agent
    const factory = new UnifiedAgentFactory()
    const agent = factory.createFromPlanetary(planetaryConfig)

    // Calculate activation strength
    const activationStrength = calculateActivationStrength(
      { powerLevel: 0.5 } as any, // Use default config
      { orb: 0 }
    )

    // Create activated agent
    const activatedAgent: ActivatedPlanetaryAgent = {
      degree: planetData.signDegree,
      zodiacDegree: planetData.signDegree,
      sign: planetData.sign,
      config: {
        ruler: planetName,
        sign: planetData.sign,
        zodiacDegree: planetData.signDegree,
        degree: Number(planetData.signDegree),
        rulerDignity: getPlanetaryDignity(planetName, planetData.sign) as any,
        isCardinalDegree: false,
        element: (getPlanetaryElement(planetName) || getSignElement(planetData.sign)) as any,
        powerLevel: 0.5,
        consciousnessLevel: 'active',
        themes: [`${planetName} energy`, `${planetData.sign} expression`],
        qualities: [`${planetName} characteristics in ${planetData.sign}`],
        modality: 'Cardinal', // Default
        isCriticalDegree: false,
        isAnaretic: false,
      },
      agent,
      activationStrength,
      consciousnessState: {
        level: 'Active',
        powerLevel: activationStrength * 100,
        themes: [`${planetName} energy`, `${planetData.sign} expression`],
        qualities: [`${planetName} characteristics in ${planetData.sign}`],
      },
    }

    agents.push(activatedAgent)
  }

  return agents
}

/**
 * Get recommended actions for an activated planetary agent
 */
export function getActivatedAgentRecommendations(activated: ActivatedPlanetaryAgent): {
  actions: string[]
  queries: string[]
  consciousnessWork: string[]
} {
  const { config, agent, transitInfo } = activated

  const actions: string[] = []
  const queries: string[] = []
  const consciousnessWork: string[] = []

  // Element-based actions
  if (config.element === 'Fire') {
    actions.push('Take bold, decisive action', 'Express creativity freely', 'Lead with confidence')
    consciousnessWork.push(
      'Channel passion constructively',
      'Develop courage',
      'Ignite inspiration'
    )
  } else if (config.element === 'Water') {
    actions.push('Honor emotions', 'Trust intuition', 'Nurture connections')
    consciousnessWork.push(
      'Deepen emotional intelligence',
      'Develop psychic sensitivity',
      'Practice compassion'
    )
  } else if (config.element === 'Air') {
    actions.push('Communicate clearly', 'Connect socially', 'Learn something new')
    consciousnessWork.push('Sharpen mental clarity', 'Develop objectivity', 'Expand perspectives')
  } else if (config.element === 'Earth') {
    actions.push('Build something lasting', 'Ground yourself', 'Focus on practical matters')
    consciousnessWork.push('Develop patience', 'Master discipline', 'Create stability')
  }

  // Dignity-based recommendations
  if (config.rulerDignity === 'domicile') {
    actions.push(`Work with ${config.ruler}'s core strengths`)
    consciousnessWork.push('This is optimal time for growth in this area')
  } else if (config.rulerDignity === 'exaltation') {
    actions.push(`${config.ruler} is highly elevated - maximize this energy`)
    consciousnessWork.push('Breakthrough potential is extremely high')
  } else if (config.rulerDignity === 'detriment' || config.rulerDignity === 'fall') {
    actions.push('Exercise patience and work with challenges')
    consciousnessWork.push('Transform difficulties into wisdom')
  }

  // Special degree recommendations
  if (config.isAnaretic) {
    actions.push('Complete unfinished business', 'Prepare for transitions')
    consciousnessWork.push('Release what no longer serves', 'Culmination and closure work')
  }

  if (config.isCriticalDegree) {
    actions.push('Pay attention to significant events', 'Make important decisions')
    consciousnessWork.push('Crisis as opportunity for growth', 'Heightened awareness')
  }

  // Queries for the planetary agent
  queries.push(
    `${config.ruler} in ${config.sign}, what wisdom do you have for me at ${config.zodiacDegree}°?`,
    `How can I best work with ${config.element} energy right now?`,
    `What consciousness breakthrough is available through this ${config.modality} ${config.element} activation?`
  )

  if (transitInfo) {
    queries.push(
      `What does ${transitInfo.transitingPlanet} activating my natal ${transitInfo.natalPlanet} mean?`,
      `How can I maximize this ${transitInfo.aspectType} transit?`
    )
  }

  return {
    actions: actions.slice(0, 5),
    queries: queries.slice(0, 4),
    consciousnessWork: consciousnessWork.slice(0, 4),
  }
}

// Helper functions

function calculateActivationStrength(
  config: PlanetaryAgentConfig,
  options: {
    transitingPlanet?: string
    orb?: number
  }
): number {
  let strength = config.powerLevel // Base strength from degree power

  // Exact degrees (0° or 29°) have higher activation
  if (config.zodiacDegree === 0) strength += 0.1
  if (config.zodiacDegree === 29) strength += 0.15

  // Critical degrees boost activation
  if (config.isCriticalDegree) strength += 0.1

  // Tight orbs increase activation
  if (options.orb !== undefined) {
    const orbBonus = ((5 - options.orb) / 5) * 0.2 // 0-0.2 based on tightness
    strength += orbBonus
  }

  return Math.max(0, Math.min(1, strength))
}

function calculateTransitSignificance(
  config: PlanetaryAgentConfig,
  options: {
    transitingPlanet?: string
    natalPlanet?: string
    orb?: number
  }
): number {
  let significance = config.powerLevel

  // Luminaries (Sun/Moon) transiting are more significant
  if (options.transitingPlanet === 'Sun' || options.transitingPlanet === 'Moon') {
    significance += 0.15
  }

  // Transiting to natal luminaries is more significant
  if (options.natalPlanet === 'Sun' || options.natalPlanet === 'Moon') {
    significance += 0.2
  }

  // Tight orbs are more significant
  if (options.orb !== undefined) {
    const orbBonus = ((5 - options.orb) / 5) * 0.25
    significance += orbBonus
  }

  // Anaretic and critical degrees boost significance
  if (config.isAnaretic) significance += 0.15
  if (config.isCriticalDegree) significance += 0.1

  return Math.max(0, Math.min(1, significance))
}

function calculateOrb(degree1: number, degree2: number): number {
  const diff = Math.abs(degree1 - degree2)
  return Math.min(diff, 360 - diff)
}

function isDiurnalTime(date: Date): boolean {
  const hour = date.getHours()
  return hour >= 6 && hour < 18
}
