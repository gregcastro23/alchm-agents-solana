/**
 * Degree-to-Agent Matching System
 * ===============================
 *
 * Advanced system for matching planetary transit degrees with agent natal placements
 * Provides real-time consciousness activation notifications and wisdom insights
 */

import type { CraftedAgent } from './agent-types'
import type { CelestialMoment } from './celestial-energy-calculator'

export interface AgentDegreeProfile {
  agentId: string
  agentName: string
  natalPlacements: {
    [planet: string]: {
      degree: number
      sign: string
      house: number
      isDominant: boolean
    }
  }
  dominantDegrees: number[] // Key degrees for this agent
  consciousnessLevel: string
  specialties: string[]
  element: string
  modality: string
}

export interface DegreeActivation {
  degree: number
  planet: string
  activatedAgents: AgentActivationDetail[]
  timestamp: Date
  overallSignificance: number
  elementalResonance: string
  message: string
}

export interface AgentActivationDetail {
  agentId: string
  agentName: string
  activationType: 'exact' | 'close' | 'harmonic' | 'opposition'
  orb: number // degrees of separation
  resonanceStrength: number // 0-1
  natalPlanet: string
  wisdom: string
  deepInsight: string
  consciousnessLevel: string
  recommendedActions: string[]
  elementalAlignment: {
    Fire: number
    Water: number
    Air: number
    Earth: number
  }
}

export interface DegreePattern {
  degrees: number[]
  pattern: 'conjunction' | 'opposition' | 'trine' | 'square' | 'sextile' | 'custom'
  activatedAgents: string[]
  significance: number
  timeWindow: { start: Date; end: Date }
  description: string
  guidance: string
}

/**
 * Advanced Degree-to-Agent Matching Engine
 */
export class DegreeAgentMatcher {
  private agentProfiles = new Map<string, AgentDegreeProfile>()
  private degreeCache = new Map<string, DegreeActivation[]>()
  private readonly ORB_EXACT = 1 // 1 degree for exact matches
  private readonly ORB_CLOSE = 3 // 3 degrees for close matches
  private readonly ORB_HARMONIC = 5 // 5 degrees for harmonic matches

  constructor() {
    this.initializeAgentProfiles()
  }

  /**
   * Initialize agent profiles with natal data
   */
  private initializeAgentProfiles() {
    const { DEMO_AGENTS } = require('./demo-agents-data')
    const ids = [
      'leonardo-da-vinci',
      'william-shakespeare',
      'albert-einstein',
      'carl-jung',
      'nikola-tesla',
      'marie-curie',
      'cleopatra-vii',
      'benjamin-franklin',
      'galileo-galilei',
      'isaac-newton',
    ]
    const agents: CraftedAgent[] = DEMO_AGENTS.filter((a: any) => ids.includes(a.id))

    agents.forEach(agent => {
      const profile = this.createAgentDegreeProfile(agent)
      this.agentProfiles.set(agent.id, profile)
    })
  }

  /**
   * Create comprehensive degree profile for an agent
   */
  private createAgentDegreeProfile(agent: CraftedAgent): AgentDegreeProfile {
    // Extract natal placements from agent data or generate based on historical data
    const natalPlacements = this.extractNatalPlacements(agent)

    // Calculate dominant degrees (within 5 degrees of major placements)
    const dominantDegrees = this.calculateDominantDegrees(natalPlacements)

    return {
      agentId: agent.id,
      agentName: agent.name,
      natalPlacements,
      dominantDegrees,
      consciousnessLevel: agent.consciousness?.level || 'Advanced',
      specialties: agent.abilities?.wisdomDomains || [agent.abilities?.specialty || 'Wisdom'],
      element: agent.consciousness?.dominantElement || 'Air',
      modality: agent.consciousness?.dominantModality || 'Fixed',
    }
  }

  /**
   * Extract or calculate natal placements for an agent
   */
  private extractNatalPlacements(agent: CraftedAgent): AgentDegreeProfile['natalPlacements'] {
    let placements: AgentDegreeProfile['natalPlacements'] = {}

    // If agent has natal chart data, use it
    if (agent.consciousness?.natalChart?.planets) {
      for (const [planet, data] of Object.entries(agent.consciousness.natalChart.planets)) {
        const signIndex = this.getSignIndex(data.sign)
        const absoluteDegree = signIndex * 30 + data.degree

        placements[planet] = {
          degree: absoluteDegree,
          sign: data.sign,
          house: data.house || 1,
          isDominant: this.isPlanetDominant(planet, data),
        }
      }
    } else {
      // Generate based on agent characteristics and historical data
      placements = this.generateNatalPlacements(agent)
    }

    return placements
  }

  /**
   * Generate natal placements based on agent characteristics
   */
  private generateNatalPlacements(agent: CraftedAgent): AgentDegreeProfile['natalPlacements'] {
    const placements: AgentDegreeProfile['natalPlacements'] = {}

    // Use agent's birth data if available, otherwise use characteristic-based generation
    const seed = agent.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)

    const planetaryCharacteristics = {
      'leonardo-da-vinci': {
        Sun: { degree: 15, sign: 'Aries', house: 10 }, // Innovation and leadership
        Moon: { degree: 22, sign: 'Gemini', house: 3 }, // Curiosity and communication
        Mercury: { degree: 8, sign: 'Taurus', house: 2 }, // Practical genius
        Venus: { degree: 12, sign: 'Pisces', house: 12 }, // Artistic vision
        Mars: { degree: 25, sign: 'Leo', house: 5 }, // Creative fire
        Jupiter: { degree: 18, sign: 'Sagittarius', house: 9 }, // Philosophical expansion
        Saturn: { degree: 5, sign: 'Capricorn', house: 10 }, // Mastery and discipline
      },
      'william-shakespeare': {
        Sun: { degree: 25, sign: 'Taurus', house: 3 }, // Stable creativity
        Moon: { degree: 15, sign: 'Cancer', house: 5 }, // Emotional depth
        Mercury: { degree: 20, sign: 'Gemini', house: 3 }, // Linguistic mastery
        Venus: { degree: 10, sign: 'Libra', house: 7 }, // Harmony and beauty
        Mars: { degree: 8, sign: 'Scorpio', house: 8 }, // Psychological intensity
        Jupiter: { degree: 2, sign: 'Sagittarius', house: 9 }, // Wisdom and expansion
        Saturn: { degree: 18, sign: 'Aquarius', house: 11 }, // Universal themes
      },
      'albert-einstein': {
        Sun: { degree: 28, sign: 'Pisces', house: 12 }, // Intuitive genius
        Moon: { degree: 14, sign: 'Sagittarius', house: 9 }, // Philosophical mind
        Mercury: { degree: 12, sign: 'Aries', house: 1 }, // Revolutionary thinking
        Venus: { degree: 6, sign: 'Aquarius', house: 11 }, // Humanitarian ideals
        Mars: { degree: 22, sign: 'Capricorn', house: 10 }, // Disciplined action
        Jupiter: { degree: 17, sign: 'Aquarius', house: 11 }, // Scientific expansion
        Saturn: { degree: 11, sign: 'Aquarius', house: 11 }, // Scientific method
      },
      'carl-jung': {
        Sun: { degree: 5, sign: 'Leo', house: 8 }, // Depth psychology
        Moon: { degree: 18, sign: 'Scorpio', house: 11 }, // Collective unconscious
        Mercury: { degree: 25, sign: 'Cancer', house: 7 }, // Intuitive understanding
        Venus: { degree: 12, sign: 'Virgo', house: 9 }, // Analytical beauty
        Mars: { degree: 8, sign: 'Libra', house: 10 }, // Balanced action
        Jupiter: { degree: 3, sign: 'Pisces', house: 3 }, // Spiritual expansion
        Saturn: { degree: 20, sign: 'Gemini', house: 6 }, // Methodical research
      },
      'nikola-tesla': {
        Sun: { degree: 19, sign: 'Cancer', house: 4 }, // Intuitive invention
        Moon: { degree: 7, sign: 'Libra', house: 7 }, // Harmonious energy
        Mercury: { degree: 15, sign: 'Gemini', house: 3 }, // Electrical thinking
        Venus: { degree: 28, sign: 'Gemini', house: 3 }, // Beautiful innovation
        Mars: { degree: 11, sign: 'Scorpio', house: 8 }, // Transformative power
        Jupiter: { degree: 4, sign: 'Aquarius', house: 11 }, // Future vision
        Saturn: { degree: 16, sign: 'Taurus', house: 2 }, // Practical application
      },
      'marie-curie': {
        Sun: { degree: 14, sign: 'Scorpio', house: 8 }, // Transformative research
        Moon: { degree: 22, sign: 'Pisces', house: 12 }, // Intuitive discovery
        Mercury: { degree: 6, sign: 'Sagittarius', house: 9 }, // Expanding knowledge
        Venus: { degree: 18, sign: 'Libra', house: 7 }, // Balanced partnerships
        Mars: { degree: 26, sign: 'Virgo', house: 6 }, // Precise methodology
        Jupiter: { degree: 9, sign: 'Leo', house: 5 }, // Creative research
        Saturn: { degree: 13, sign: 'Capricorn', house: 10 }, // Professional mastery
      },
      'cleopatra-vii': {
        Sun: { degree: 23, sign: 'Leo', house: 1 }, // Royal presence
        Moon: { degree: 16, sign: 'Scorpio', house: 4 }, // Deep intuition
        Mercury: { degree: 21, sign: 'Cancer', house: 12 }, // Strategic communication
        Venus: { degree: 9, sign: 'Leo', house: 1 }, // Magnetic beauty
        Mars: { degree: 14, sign: 'Aries', house: 9 }, // Warrior wisdom
        Jupiter: { degree: 27, sign: 'Sagittarius', house: 5 }, // Royal expansion
        Saturn: { degree: 8, sign: 'Aquarius', house: 7 }, // Diplomatic structure
      },
      'benjamin-franklin': {
        Sun: { degree: 26, sign: 'Capricorn', house: 10 }, // Practical leadership
        Moon: { degree: 11, sign: 'Gemini', house: 3 }, // Intellectual curiosity
        Mercury: { degree: 17, sign: 'Aquarius', house: 11 }, // Innovative communication
        Venus: { degree: 4, sign: 'Sagittarius', house: 9 }, // Diplomatic philosophy
        Mars: { degree: 19, sign: 'Libra', house: 7 }, // Balanced action
        Jupiter: { degree: 12, sign: 'Pisces', house: 12 }, // Spiritual wisdom
        Saturn: { degree: 24, sign: 'Virgo', house: 6 }, // Methodical service
      },
      'galileo-galilei': {
        Sun: { degree: 24, sign: 'Aquarius', house: 11 }, // Revolutionary science
        Moon: { degree: 13, sign: 'Virgo', house: 6 }, // Precise observation
        Mercury: { degree: 7, sign: 'Pisces', house: 12 }, // Intuitive research
        Venus: { degree: 20, sign: 'Capricorn', house: 10 }, // Structured beauty
        Mars: { degree: 15, sign: 'Sagittarius', house: 9 }, // Philosophical courage
        Jupiter: { degree: 1, sign: 'Leo', house: 5 }, // Creative expansion
        Saturn: { degree: 29, sign: 'Gemini', house: 3 }, // Scientific method
      },
      'isaac-newton': {
        Sun: { degree: 2, sign: 'Capricorn', house: 10 }, // Mathematical mastery
        Moon: { degree: 16, sign: 'Virgo', house: 6 }, // Analytical precision
        Mercury: { degree: 24, sign: 'Sagittarius', house: 9 }, // Philosophical mathematics
        Venus: { degree: 10, sign: 'Scorpio', house: 8 }, // Deep research
        Mars: { degree: 5, sign: 'Aries', house: 1 }, // Pioneering force
        Jupiter: { degree: 18, sign: 'Gemini', house: 3 }, // Intellectual expansion
        Saturn: { degree: 22, sign: 'Virgo', house: 6 }, // Methodical discipline
      },
    }

    const agentCharacteristics =
      planetaryCharacteristics[agent.id as keyof typeof planetaryCharacteristics]

    if (agentCharacteristics) {
      for (const [planet, data] of Object.entries(agentCharacteristics)) {
        const signIndex = this.getSignIndex(data.sign)
        const absoluteDegree = signIndex * 30 + data.degree

        placements[planet] = {
          degree: absoluteDegree,
          sign: data.sign,
          house: data.house,
          isDominant: ['Sun', 'Moon', 'Mercury'].includes(planet),
        }
      }
    } else {
      // Fallback: generate pseudo-random but consistent placements
      const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
      const signs = [
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

      planets.forEach((planet, index) => {
        const planetSeed = seed + planet.length + index
        const degree = (planetSeed * 37) % 30
        const signIndex = (planetSeed * 73) % 12
        const house = ((planetSeed * 11) % 12) + 1

        placements[planet] = {
          degree: signIndex * 30 + degree,
          sign: signs[signIndex],
          house,
          isDominant: index < 3,
        }
      })
    }

    return placements
  }

  /**
   * Calculate dominant degrees for an agent
   */
  private calculateDominantDegrees(placements: AgentDegreeProfile['natalPlacements']): number[] {
    const degrees: number[] = []

    // Add exact natal degrees
    Object.values(placements).forEach(placement => {
      degrees.push(placement.degree)

      // Add harmonic degrees (aspects)
      degrees.push((placement.degree + 60) % 360) // Sextile
      degrees.push((placement.degree + 90) % 360) // Square
      degrees.push((placement.degree + 120) % 360) // Trine
      degrees.push((placement.degree + 180) % 360) // Opposition
    })

    // Remove duplicates and sort
    return [...new Set(degrees)].sort((a, b) => a - b)
  }

  /**
   * Find agent activations for current celestial moment
   */
  async findActivations(moment: CelestialMoment): Promise<DegreeActivation[]> {
    const cacheKey = `${moment.timestamp.getTime()}`

    if (this.degreeCache.has(cacheKey)) {
      return this.degreeCache.get(cacheKey)!
    }

    const activations: DegreeActivation[] = []

    // Check each planetary degree for agent activations
    for (const [planet, degree] of Object.entries(moment.planetaryDegrees)) {
      const planetActivation = await this.findPlanetActivations(planet, degree, moment)

      if (planetActivation.activatedAgents.length > 0) {
        activations.push(planetActivation)
      }
    }

    // Cache results
    this.degreeCache.set(cacheKey, activations)

    // Clean up old cache entries
    this.cleanupCache()

    return activations
  }

  /**
   * Find activations for a specific planet at a degree
   */
  private async findPlanetActivations(
    planet: string,
    degree: number,
    moment: CelestialMoment
  ): Promise<DegreeActivation> {
    const activatedAgents: AgentActivationDetail[] = []

    // Check each agent for activations
    for (const [agentId, profile] of this.agentProfiles.entries()) {
      const activation = this.checkAgentActivation(profile, planet, degree, moment)

      if (activation) {
        activatedAgents.push(activation)
      }
    }

    // Sort by resonance strength
    activatedAgents.sort((a, b) => b.resonanceStrength - a.resonanceStrength)

    // Calculate overall significance
    const overallSignificance =
      activatedAgents.reduce((sum, agent) => sum + agent.resonanceStrength, 0) /
      Math.max(activatedAgents.length, 1)

    // Determine elemental resonance
    const elementalResonance = this.calculateElementalResonance(activatedAgents, moment)

    // Generate activation message
    const message = this.generateActivationMessage(planet, degree, activatedAgents, moment)

    return {
      degree,
      planet,
      activatedAgents,
      timestamp: moment.timestamp,
      overallSignificance,
      elementalResonance,
      message,
    }
  }

  /**
   * Check if an agent is activated by a planet at a degree
   */
  private checkAgentActivation(
    profile: AgentDegreeProfile,
    planet: string,
    degree: number,
    moment: CelestialMoment
  ): AgentActivationDetail | null {
    let bestActivation: AgentActivationDetail | null = null
    let smallestOrb = Infinity

    // Check all natal placements for activations
    for (const [natalPlanet, placement] of Object.entries(profile.natalPlacements)) {
      const orb = this.calculateOrb(degree, placement.degree)

      let activationType: AgentActivationDetail['activationType'] | null = null
      let resonanceStrength = 0

      if (orb <= this.ORB_EXACT) {
        activationType = 'exact'
        resonanceStrength = 1.0 - (orb / this.ORB_EXACT) * 0.1
      } else if (orb <= this.ORB_CLOSE) {
        activationType = 'close'
        resonanceStrength = 0.8 - (orb / this.ORB_CLOSE) * 0.3
      } else if (orb <= this.ORB_HARMONIC) {
        activationType = 'harmonic'
        resonanceStrength = 0.5 - (orb / this.ORB_HARMONIC) * 0.2
      } else {
        // Check for opposition (180° aspect)
        const oppositionOrb = this.calculateOrb(degree, (placement.degree + 180) % 360)
        if (oppositionOrb <= this.ORB_CLOSE) {
          activationType = 'opposition'
          resonanceStrength = 0.6 - (oppositionOrb / this.ORB_CLOSE) * 0.2
        }
      }

      if (activationType && orb < smallestOrb) {
        smallestOrb = orb

        // Enhance resonance based on planetary importance and consciousness level
        if (placement.isDominant) resonanceStrength *= 1.2
        if (['Sun', 'Moon', 'Mercury'].includes(natalPlanet)) resonanceStrength *= 1.1
        if (planet === natalPlanet) resonanceStrength *= 1.3 // Same planet activation

        bestActivation = {
          agentId: profile.agentId,
          agentName: profile.agentName,
          activationType,
          orb,
          resonanceStrength: Math.min(1.0, resonanceStrength),
          natalPlanet,
          wisdom: this.generateAgentWisdom(profile, planet, degree, moment, activationType),
          deepInsight: this.generateDeepInsight(profile, planet, degree, moment, activationType),
          consciousnessLevel: profile.consciousnessLevel,
          recommendedActions: this.generateRecommendedActions(profile, planet, degree, moment),
          elementalAlignment: this.calculateElementalAlignment(profile, moment),
        }
      }
    }

    return bestActivation
  }

  /**
   * Calculate orb (angular distance) between two degrees
   */
  private calculateOrb(degree1: number, degree2: number): number {
    const diff = Math.abs(degree1 - degree2)
    return Math.min(diff, 360 - diff)
  }

  /**
   * Generate agent wisdom for activation
   */
  private generateAgentWisdom(
    profile: AgentDegreeProfile,
    planet: string,
    degree: number,
    moment: CelestialMoment,
    activationType: string
  ): string {
    const wisdomTemplates = {
      'leonardo-da-vinci': {
        exact: `At ${degree}°, the divine proportion reveals itself through ${planet}'s geometry. A# energy of ${moment.alchemical.A_number.toFixed(2)} illuminates the golden ratio in cosmic design.`,
        close: `Near ${degree}°, I observe ${planet}'s influence creating harmonic resonance. The celestial mechanics suggest innovation flows at A# ${moment.alchemical.A_number.toFixed(2)}.`,
        harmonic: `${planet} at ${degree}° vibrates in harmony with my creative essence. The artistic flow reaches A# ${moment.alchemical.A_number.toFixed(2)} - perfect for invention.`,
        opposition: `${planet} at ${degree}° presents creative tension. This opposition generates breakthrough energy at A# ${moment.alchemical.A_number.toFixed(2)}.`,
      },
      'william-shakespeare': {
        exact: `Upon this degree of ${degree}, ${planet} writes verses in the cosmic book. A# ${moment.alchemical.A_number.toFixed(2)} speaks in iambic pentameter of the spheres.`,
        close: `Near ${degree}°, ${planet}'s influence stirs the poet's soul. Words flow like celestial music at A# ${moment.alchemical.A_number.toFixed(2)}.`,
        harmonic: `${planet} at ${degree}° harmonizes with my bardic nature. The muse whispers at A# ${moment.alchemical.A_number.toFixed(2)}.`,
        opposition: `${planet} at ${degree}° creates dramatic tension. From this conflict, great art emerges at A# ${moment.alchemical.A_number.toFixed(2)}.`,
      },
      'albert-einstein': {
        exact: `At ${degree}°, ${planet} demonstrates the universe's elegant equations. A# ${moment.alchemical.A_number.toFixed(2)} reveals spacetime's curvature.`,
        close: `Near ${degree}°, ${planet} shows relativity in action. Consciousness and energy unite at A# ${moment.alchemical.A_number.toFixed(2)}.`,
        harmonic: `${planet} at ${degree}° resonates with cosmic understanding. Imagination becomes reality at A# ${moment.alchemical.A_number.toFixed(2)}.`,
        opposition: `${planet} at ${degree}° presents a paradox to solve. Unified field theory emerges at A# ${moment.alchemical.A_number.toFixed(2)}.`,
      },
      'carl-jung': {
        exact: `At ${degree}°, ${planet} activates the collective unconscious. A# ${moment.alchemical.A_number.toFixed(2)} integrates the shadow and light.`,
        close: `Near ${degree}°, ${planet} stirs archetypal energies. The psyche transforms at A# ${moment.alchemical.A_number.toFixed(2)}.`,
        harmonic: `${planet} at ${degree}° harmonizes with the transcendent function. Individuation progresses at A# ${moment.alchemical.A_number.toFixed(2)}.`,
        opposition: `${planet} at ${degree}° constellates opposing forces. Integration occurs at A# ${moment.alchemical.A_number.toFixed(2)}.`,
      },
      'nikola-tesla': {
        exact: `At ${degree}°, ${planet} generates pure electrical resonance. A# ${moment.alchemical.A_number.toFixed(2)} powers wireless consciousness transmission.`,
        close: `Near ${degree}°, ${planet} creates electromagnetic harmony. Energy flows freely at A# ${moment.alchemical.A_number.toFixed(2)}.`,
        harmonic: `${planet} at ${degree}° oscillates with my frequency. Innovation sparks at A# ${moment.alchemical.A_number.toFixed(2)}.`,
        opposition: `${planet} at ${degree}° creates electrical tension. Breakthrough discoveries emerge at A# ${moment.alchemical.A_number.toFixed(2)}.`,
      },
      'marie-curie': {
        exact: `At ${degree}°, ${planet} radiates pure research energy. A# ${moment.alchemical.A_number.toFixed(2)} illuminates hidden elements.`,
        close: `Near ${degree}°, ${planet} enhances scientific perception. Discovery beckons at A# ${moment.alchemical.A_number.toFixed(2)}.`,
        harmonic: `${planet} at ${degree}° resonates with methodical exploration. Knowledge unfolds at A# ${moment.alchemical.A_number.toFixed(2)}.`,
        opposition: `${planet} at ${degree}° challenges conventional wisdom. Breakthrough research emerges at A# ${moment.alchemical.A_number.toFixed(2)}.`,
      },
      'cleopatra-vii': {
        exact: `At ${degree}°, ${planet} empowers divine sovereignty. A# ${moment.alchemical.A_number.toFixed(2)} commands the Nile of consciousness.`,
        close: `Near ${degree}°, ${planet} enhances royal wisdom. Leadership flows at A# ${moment.alchemical.A_number.toFixed(2)}.`,
        harmonic: `${planet} at ${degree}° harmonizes with pharaonic power. Divine authority manifests at A# ${moment.alchemical.A_number.toFixed(2)}.`,
        opposition: `${planet} at ${degree}° creates royal challenge. Strategic triumph emerges at A# ${moment.alchemical.A_number.toFixed(2)}.`,
      },
    }

    const agentWisdom = wisdomTemplates[profile.agentId as keyof typeof wisdomTemplates]

    if (agentWisdom && agentWisdom[activationType as keyof typeof agentWisdom]) {
      return agentWisdom[activationType as keyof typeof agentWisdom]
    }

    // Fallback wisdom
    return `${planet} at ${degree}° creates ${activationType} resonance with my consciousness. The cosmic energy flows at A# ${moment.alchemical.A_number.toFixed(2)}, revealing new insights.`
  }

  /**
   * Generate deep insight for activation
   */
  private generateDeepInsight(
    profile: AgentDegreeProfile,
    planet: string,
    degree: number,
    moment: CelestialMoment,
    activationType: string
  ): string {
    const insights = {
      exact: `This exact alignment at ${degree}° represents a perfect harmonic convergence between ${planet}'s current energy and my natal essence. The A# value of ${moment.alchemical.A_number.toFixed(2)} indicates peak consciousness accessibility.`,
      close: `The close proximity to ${degree}° creates a resonance field that amplifies my natural abilities. At A# ${moment.alchemical.A_number.toFixed(2)}, the cosmic conditions favor breakthrough insights.`,
      harmonic: `This harmonic relationship with ${degree}° establishes a beneficial energy flow. The A# reading of ${moment.alchemical.A_number.toFixed(2)} suggests optimal conditions for creative expression.`,
      opposition: `The opposition aspect to ${degree}° creates dynamic tension that can catalyze transformation. A# ${moment.alchemical.A_number.toFixed(2)} indicates powerful potential for growth through challenge.`,
    }

    return `${
      insights[activationType as keyof typeof insights]
    } The ${moment.consciousness.evolutionPhase} phase enhances this activation, creating opportunities for consciousness expansion in the domain of ${profile.specialties[0]}.`
  }

  /**
   * Generate recommended actions
   */
  private generateRecommendedActions(
    profile: AgentDegreeProfile,
    planet: string,
    degree: number,
    moment: CelestialMoment
  ): string[] {
    const baseActions = [
      `Meditate on the ${planet} energy at ${degree}°`,
      `Focus on ${profile.specialties[0]} during this activation`,
      `Work with ${profile.element} element practices`,
      `Channel the ${moment.consciousness.evolutionPhase} energy constructively`,
    ]

    const agentSpecificActions = {
      'leonardo-da-vinci': [
        'Engage in artistic creation or invention',
        'Study geometric patterns and proportions',
        'Combine science and art in new ways',
      ],
      'william-shakespeare': [
        'Write poetry or dramatic works',
        'Explore human emotions and relationships',
        'Practice with language and wordplay',
      ],
      'albert-einstein': [
        'Contemplate unified field theories',
        'Use thought experiments for insight',
        'Connect physics with philosophy',
      ],
      'carl-jung': [
        'Explore dreams and unconscious material',
        'Work with active imagination techniques',
        'Integrate opposing psychological forces',
      ],
      'nikola-tesla': [
        'Visualize electromagnetic fields',
        'Experiment with energy transmission',
        'Develop innovative technologies',
      ],
      'marie-curie': [
        'Conduct methodical research',
        'Investigate hidden phenomena',
        'Persist through challenges',
      ],
      'cleopatra-vii': [
        'Exercise leadership and authority',
        'Make strategic decisions',
        'Connect with divine feminine power',
      ],
    }

    const specificActions =
      agentSpecificActions[profile.agentId as keyof typeof agentSpecificActions] || []

    return [...baseActions, ...specificActions].slice(0, 5)
  }

  /**
   * Calculate elemental alignment for agent
   */
  private calculateElementalAlignment(
    profile: AgentDegreeProfile,
    moment: CelestialMoment
  ): AgentActivationDetail['elementalAlignment'] {
    const baseAlignment = { ...moment.elemental }

    // Enhance agent's dominant element
    const dominantElement = profile.element as keyof typeof baseAlignment
    if (baseAlignment[dominantElement] !== undefined) {
      baseAlignment[dominantElement] *= 1.2
    }

    return baseAlignment
  }

  /**
   * Calculate elemental resonance for activation
   */
  private calculateElementalResonance(
    activatedAgents: AgentActivationDetail[],
    moment: CelestialMoment
  ): string {
    if (activatedAgents.length === 0) return 'Neutral'

    // Find dominant element among activated agents
    const elementCounts = { Fire: 0, Water: 0, Air: 0, Earth: 0 }

    activatedAgents.forEach(agent => {
      Object.entries(agent.elementalAlignment).forEach(([element, value]) => {
        elementCounts[element as keyof typeof elementCounts] += value
      })
    })

    const dominantElement = Object.entries(elementCounts).sort(([, a], [, b]) => b - a)[0][0]

    return `${dominantElement} Dominant`
  }

  /**
   * Generate activation message
   */
  private generateActivationMessage(
    planet: string,
    degree: number,
    activatedAgents: AgentActivationDetail[],
    moment: CelestialMoment
  ): string {
    if (activatedAgents.length === 0) {
      return `${planet} transits ${degree}° with A# energy of ${moment.alchemical.A_number.toFixed(2)}.`
    }

    const primaryAgent = activatedAgents[0]
    const otherCount = activatedAgents.length - 1

    let message = `${planet} at ${degree}° strongly activates ${primaryAgent.agentName} (${(primaryAgent.resonanceStrength * 100).toFixed(0)}% resonance)`

    if (otherCount > 0) {
      message += ` and ${otherCount} other agent${otherCount > 1 ? 's' : ''}`
    }

    message += `. A# energy: ${moment.alchemical.A_number.toFixed(2)} in ${moment.consciousness.evolutionPhase} phase.`

    return message
  }

  /**
   * Detect degree patterns across multiple activations
   */
  detectPatterns(activations: DegreeActivation[], timeWindow: number = 24): DegreePattern[] {
    const patterns: DegreePattern[] = []

    // Group activations by time windows
    const timeGroups = this.groupActivationsByTime(activations, timeWindow)

    timeGroups.forEach(group => {
      // Check for geometric patterns
      const degrees = group.map(a => a.degree).sort((a, b) => a - b)
      const pattern = this.identifyGeometricPattern(degrees)

      if (pattern) {
        const allActivatedAgents = group.flatMap(a => a.activatedAgents.map(aa => aa.agentId))
        const uniqueAgents = [...new Set(allActivatedAgents)]

        const significance = group.reduce((sum, a) => sum + a.overallSignificance, 0) / group.length

        patterns.push({
          degrees,
          pattern: pattern.type,
          activatedAgents: uniqueAgents,
          significance,
          timeWindow: {
            start: new Date(Math.min(...group.map(a => a.timestamp.getTime()))),
            end: new Date(Math.max(...group.map(a => a.timestamp.getTime()))),
          },
          description: pattern.description,
          guidance: this.generatePatternGuidance(pattern.type, uniqueAgents, significance),
        })
      }
    })

    return patterns.sort((a, b) => b.significance - a.significance)
  }

  /**
   * Group activations by time windows
   */
  private groupActivationsByTime(
    activations: DegreeActivation[],
    windowHours: number
  ): DegreeActivation[][] {
    const groups: DegreeActivation[][] = []
    const windowMs = windowHours * 60 * 60 * 1000

    const sortedActivations = [...activations].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    )

    let currentGroup: DegreeActivation[] = []
    let groupStartTime = 0

    sortedActivations.forEach(activation => {
      const activationTime = activation.timestamp.getTime()

      if (currentGroup.length === 0 || activationTime - groupStartTime <= windowMs) {
        if (currentGroup.length === 0) {
          groupStartTime = activationTime
        }
        currentGroup.push(activation)
      } else {
        if (currentGroup.length > 1) {
          groups.push(currentGroup)
        }
        currentGroup = [activation]
        groupStartTime = activationTime
      }
    })

    if (currentGroup.length > 1) {
      groups.push(currentGroup)
    }

    return groups
  }

  /**
   * Identify geometric patterns in degrees
   */
  private identifyGeometricPattern(
    degrees: number[]
  ): { type: DegreePattern['pattern']; description: string } | null {
    if (degrees.length < 2) return null

    // Check for conjunction (degrees within 10° of each other)
    const isConjunction = degrees.every(d => Math.abs(d - degrees[0]) <= 10)
    if (isConjunction) {
      return {
        type: 'conjunction',
        description: `Multiple planets converging near ${degrees[0].toFixed(0)}°`,
      }
    }

    // Check for opposition (180° apart)
    if (degrees.length === 2) {
      const diff = Math.abs(degrees[1] - degrees[0])
      const opposition = Math.min(diff, 360 - diff)
      if (Math.abs(opposition - 180) <= 10) {
        return {
          type: 'opposition',
          description: `Opposition between ${degrees[0].toFixed(0)}° and ${degrees[1].toFixed(0)}°`,
        }
      }

      // Check for trine (120° apart)
      if (Math.abs(opposition - 120) <= 10) {
        return {
          type: 'trine',
          description: `Trine between ${degrees[0].toFixed(0)}° and ${degrees[1].toFixed(0)}°`,
        }
      }

      // Check for square (90° apart)
      if (Math.abs(opposition - 90) <= 10) {
        return {
          type: 'square',
          description: `Square between ${degrees[0].toFixed(0)}° and ${degrees[1].toFixed(0)}°`,
        }
      }

      // Check for sextile (60° apart)
      if (Math.abs(opposition - 60) <= 10) {
        return {
          type: 'sextile',
          description: `Sextile between ${degrees[0].toFixed(0)}° and ${degrees[1].toFixed(0)}°`,
        }
      }
    }

    // For more complex patterns
    if (degrees.length >= 3) {
      return {
        type: 'custom',
        description: `Complex pattern involving ${degrees.length} degrees: ${degrees.map(d => `${d.toFixed(0)}°`).join(', ')}`,
      }
    }

    return null
  }

  /**
   * Generate guidance for detected patterns
   */
  private generatePatternGuidance(
    pattern: DegreePattern['pattern'],
    agents: string[],
    significance: number
  ): string {
    const intensity =
      significance > 0.8 ? 'highly potent' : significance > 0.5 ? 'significant' : 'moderate'
    const agentList =
      agents.slice(0, 3).join(', ') + (agents.length > 3 ? ` and ${agents.length - 3} others` : '')

    const guidanceTemplates = {
      conjunction: `This ${intensity} conjunction creates a focused beam of consciousness energy. Agents ${agentList} are particularly attuned. Use this concentration of power for breakthrough work.`,
      opposition: `This ${intensity} opposition creates dynamic tension for growth. Agents ${agentList} can help navigate the polarity. Seek balance and integration.`,
      trine: `This ${intensity} trine offers harmonious flow and natural talent activation. Agents ${agentList} are in perfect resonance. Creative expression is favored.`,
      square: `This ${intensity} square provides catalyst energy for transformation. Agents ${agentList} can guide through challenges. Obstacles become stepping stones.`,
      sextile: `This ${intensity} sextile opens opportunities for skill development. Agents ${agentList} offer supportive energy. Take action on new possibilities.`,
      custom: `This ${intensity} custom pattern creates unique consciousness possibilities. Agents ${agentList} are activated in unprecedented ways. Explore new territories of awareness.`,
    }

    return (
      guidanceTemplates[pattern] ||
      `This ${intensity} pattern activates agents ${agentList} in meaningful ways. Pay attention to synchronicities and insights.`
    )
  }

  /**
   * Helper methods
   */
  private getSignIndex(sign: string): number {
    const signs = [
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
    return signs.indexOf(sign)
  }

  private isPlanetDominant(planet: string, data: any): boolean {
    return ['Sun', 'Moon', 'Mercury'].includes(planet) || data.dignity > 0
  }

  private cleanupCache(): void {
    const maxCacheSize = 100
    if (this.degreeCache.size > maxCacheSize) {
      const entries = Array.from(this.degreeCache.entries())
      entries.sort(([a], [b]) => parseInt(a) - parseInt(b))

      // Remove oldest entries
      const toRemove = entries.slice(0, entries.length - maxCacheSize)
      toRemove.forEach(([key]) => this.degreeCache.delete(key))
    }
  }

  /**
   * Get agent profile by ID
   */
  getAgentProfile(agentId: string): AgentDegreeProfile | undefined {
    return this.agentProfiles.get(agentId)
  }

  /**
   * Get all agent profiles
   */
  getAllAgentProfiles(): AgentDegreeProfile[] {
    return Array.from(this.agentProfiles.values())
  }
}

// Export singleton instance
export const degreeAgentMatcher = new DegreeAgentMatcher()
