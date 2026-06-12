/**
 * Group Consciousness Dynamics
 * ============================
 *
 * Calculate real-time compatibility scores, momentum flow, and group consciousness
 * metrics for multi-agent interactions in the Gallery of Perpetuity.
 */

import { agentKineticProfiles, calculateKineticState } from '../agents/kinetic-profiles'

export interface AgentCompatibility {
  agentId1: string
  agentId2: string
  compatibility: number // 0.0-1.0
  resonanceType: 'harmonic' | 'complementary' | 'challenging' | 'transformative'
  strengthFactors: string[]
  growthPotential: number
}

export interface GroupHarmony {
  overallScore: number // 0.0-1.0
  powerAmplification: number // 1.0-3.0
  momentumFlow: 'accelerating' | 'sustained' | 'building' | 'dispersing'
  optimalSpeaker: string | null
  synergyWindows: Array<{
    startTime: Date
    endTime: Date
    description: string
    amplification: number
  }>
}

export interface MomentumFlow {
  direction: 'inward' | 'outward' | 'circular' | 'spiral'
  intensity: number // 0.0-1.0
  elementalBalance: {
    Fire: number
    Water: number
    Air: number
    Earth: number
  }
  flowPattern: string
}

export class GroupConsciousnessDynamics {
  /**
   * Calculate pairwise compatibility between two agents
   */
  static calculateCompatibility(agentId1: string, agentId2: string): AgentCompatibility {
    const profile1 = agentKineticProfiles[agentId1]
    const profile2 = agentKineticProfiles[agentId2]

    if (!profile1 || !profile2) {
      return {
        agentId1,
        agentId2,
        compatibility: 0.5,
        resonanceType: 'challenging',
        strengthFactors: [],
        growthPotential: 0.3,
      }
    }

    // Calculate elemental compatibility
    const elementalCompatibility = this.calculateElementalCompatibility(
      profile1.velocitySignature,
      profile2.velocitySignature
    )

    // Calculate planetary alignment compatibility
    const planetaryCompatibility = this.calculatePlanetaryCompatibility(
      profile1.alignment,
      profile2.alignment
    )

    // Calculate evolution rate synergy
    const evolutionSynergy = this.calculateEvolutionSynergy(
      profile1.evolutionRate,
      profile2.evolutionRate
    )

    // Overall compatibility score
    const compatibility =
      elementalCompatibility * 0.4 + planetaryCompatibility * 0.4 + evolutionSynergy * 0.2

    // Determine resonance type
    let resonanceType: 'harmonic' | 'complementary' | 'challenging' | 'transformative'
    if (compatibility > 0.8) resonanceType = 'harmonic'
    else if (compatibility > 0.6) resonanceType = 'complementary'
    else if (compatibility > 0.4) resonanceType = 'challenging'
    else resonanceType = 'transformative'

    // Identify strength factors
    const strengthFactors: string[] = []
    if (elementalCompatibility > 0.7) strengthFactors.push('Elemental Harmony')
    if (planetaryCompatibility > 0.7) strengthFactors.push('Planetary Alignment')
    if (evolutionSynergy > 0.7) strengthFactors.push('Evolution Synergy')
    if (this.hasComplementaryAbilities(profile1.specialAbilities, profile2.specialAbilities)) {
      strengthFactors.push('Complementary Abilities')
    }

    // Growth potential (challenging pairs often have high growth potential)
    const growthPotential = compatibility < 0.6 ? 0.8 : compatibility * 0.7

    return {
      agentId1,
      agentId2,
      compatibility,
      resonanceType,
      strengthFactors,
      growthPotential,
    }
  }

  /**
   * Calculate group harmony for multiple agents
   */
  static calculateGroupHarmony(
    agentIds: string[],
    planetaryInfluences: string[] = [],
    elementalTotals: { Fire: number; Water: number; Air: number; Earth: number } = {
      Fire: 5,
      Water: 5,
      Air: 5,
      Earth: 5,
    }
  ): GroupHarmony {
    if (agentIds.length < 2) {
      return {
        overallScore: 0.5,
        powerAmplification: 1.0,
        momentumFlow: 'sustained',
        optimalSpeaker: agentIds[0] || null,
        synergyWindows: [],
      }
    }

    // Calculate all pairwise compatibilities
    const compatibilities: AgentCompatibility[] = []
    for (let i = 0; i < agentIds.length; i++) {
      for (let j = i + 1; j < agentIds.length; j++) {
        compatibilities.push(this.calculateCompatibility(agentIds[i], agentIds[j]))
      }
    }

    // Overall group score
    const overallScore =
      compatibilities.reduce((sum, comp) => sum + comp.compatibility, 0) / compatibilities.length

    // Power amplification based on group size and harmony
    const sizeModifier = Math.max(0.5, 1 - (agentIds.length - 2) * 0.1) // Larger groups are harder to harmonize
    const powerAmplification = 1 + overallScore * sizeModifier * 2 // Max 3x amplification

    // Determine momentum flow
    let momentumFlow: 'accelerating' | 'sustained' | 'building' | 'dispersing'
    if (overallScore > 0.8) momentumFlow = 'accelerating'
    else if (overallScore > 0.6) momentumFlow = 'sustained'
    else if (overallScore > 0.4) momentumFlow = 'building'
    else momentumFlow = 'dispersing'

    // Find optimal speaker (agent with best overall compatibility)
    const agentScores = agentIds.map(agentId => {
      const agentCompatibilities = compatibilities.filter(
        comp => comp.agentId1 === agentId || comp.agentId2 === agentId
      )
      const avgCompatibility =
        agentCompatibilities.reduce((sum, comp) => sum + comp.compatibility, 0) /
        agentCompatibilities.length
      return { agentId, score: avgCompatibility }
    })
    const optimalSpeaker = agentScores.sort((a, b) => b.score - a.score)[0]?.agentId || null

    // Generate synergy windows (times when group consciousness peaks)
    const synergyWindows = this.generateSynergyWindows(agentIds, planetaryInfluences)

    return {
      overallScore,
      powerAmplification,
      momentumFlow,
      optimalSpeaker,
      synergyWindows,
    }
  }

  /**
   * Calculate momentum flow visualization data
   */
  static calculateMomentumFlow(
    agentIds: string[],
    elementalTotals: { Fire: number; Water: number; Air: number; Earth: number }
  ): MomentumFlow {
    if (agentIds.length === 0) {
      return {
        direction: 'circular',
        intensity: 0.5,
        elementalBalance: { Fire: 0.25, Water: 0.25, Air: 0.25, Earth: 0.25 },
        flowPattern: 'equilibrium',
      }
    }

    // Calculate combined elemental signature
    const combinedSignature = { Fire: 0, Water: 0, Air: 0, Earth: 0 }
    agentIds.forEach(agentId => {
      const profile = agentKineticProfiles[agentId]
      if (profile) {
        combinedSignature.Fire += profile.velocitySignature.Fire
        combinedSignature.Water += profile.velocitySignature.Water
        combinedSignature.Air += profile.velocitySignature.Air
        combinedSignature.Earth += profile.velocitySignature.Earth
      }
    })

    // Normalize
    const total = Object.values(combinedSignature).reduce((sum, val) => sum + val, 0)
    if (total > 0) {
      Object.keys(combinedSignature).forEach(key => {
        combinedSignature[key as keyof typeof combinedSignature] /= total
      })
    }

    // Determine flow direction based on elemental dominance
    const maxElement = Object.entries(combinedSignature).reduce(
      (max, [element, value]) => (value > max.value ? { element, value } : max),
      { element: 'Fire', value: 0 }
    )

    let direction: 'inward' | 'outward' | 'circular' | 'spiral'
    switch (maxElement.element) {
      case 'Fire':
        direction = 'outward'
        break
      case 'Water':
        direction = 'inward'
        break
      case 'Air':
        direction = 'spiral'
        break
      case 'Earth':
        direction = 'circular'
        break
      default:
        direction = 'circular'
    }

    // Calculate intensity based on group coherence
    const variance =
      Object.values(combinedSignature).reduce((sum, val) => {
        const avg = 0.25
        return sum + Math.pow(val - avg, 2)
      }, 0) / 4
    const intensity = Math.max(0.1, 1 - variance * 4) // Higher variance = lower intensity

    // Generate flow pattern description
    const flowPattern = this.generateFlowPattern(direction, intensity, maxElement.element)

    return {
      direction,
      intensity,
      elementalBalance: combinedSignature,
      flowPattern,
    }
  }

  /**
   * Calculate elemental compatibility between two velocity signatures
   */
  private static calculateElementalCompatibility(
    signature1: { Fire: number; Water: number; Air: number; Earth: number },
    signature2: { Fire: number; Water: number; Air: number; Earth: number }
  ): number {
    // Following the elemental logic principles: elements reinforce themselves
    const fireHarmony = Math.min(signature1.Fire, signature2.Fire) * 0.9 // Same element = high compatibility
    const waterHarmony = Math.min(signature1.Water, signature2.Water) * 0.9
    const airHarmony = Math.min(signature1.Air, signature2.Air) * 0.9
    const earthHarmony = Math.min(signature1.Earth, signature2.Earth) * 0.9

    // Different elements have good compatibility (0.7+)
    const crossElemental =
      (Math.abs(signature1.Fire - signature2.Water) * 0.7 +
        Math.abs(signature1.Water - signature2.Air) * 0.7 +
        Math.abs(signature1.Air - signature2.Earth) * 0.7 +
        Math.abs(signature1.Earth - signature2.Fire) * 0.7) /
      4

    return (fireHarmony + waterHarmony + airHarmony + earthHarmony + crossElemental) / 5
  }

  /**
   * Calculate planetary alignment compatibility
   */
  private static calculatePlanetaryCompatibility(
    alignment1: string[],
    alignment2: string[]
  ): number {
    const sharedPlanets = alignment1.filter(planet => alignment2.includes(planet))
    const totalUnique = new Set([...alignment1, ...alignment2]).size

    // High compatibility for shared planets, moderate for different but compatible planets
    const sharedBonus = sharedPlanets.length / Math.max(alignment1.length, alignment2.length)
    const diversityBonus = ((totalUnique - sharedPlanets.length) / totalUnique) * 0.6

    return Math.min(1.0, sharedBonus * 0.8 + diversityBonus)
  }

  /**
   * Calculate evolution rate synergy
   */
  private static calculateEvolutionSynergy(rate1: number, rate2: number): number {
    const rateDifference = Math.abs(rate1 - rate2)
    const avgRate = (rate1 + rate2) / 2

    // Similar rates create harmony, different rates create growth potential
    if (rateDifference < 0.2) return 0.9 // Very similar rates
    if (rateDifference < 0.4) return 0.7 // Moderately different
    return 0.5 // Very different rates
  }

  /**
   * Check if abilities complement each other
   */
  private static hasComplementaryAbilities(abilities1: string[], abilities2: string[]): boolean {
    // Define complementary ability pairs
    const complementaryPairs = [
      ['artistic-technical-fusion', 'scientific-persistence'],
      ['emotional-truth-revelation', 'shadow-integration'],
      ['divine-music-channeling', 'mystical-poetry-transmission'],
      ['strategic-consciousness', 'diplomatic-wisdom'],
      ['invention-manifestation', 'computational-consciousness'],
    ]

    return complementaryPairs.some(
      ([ability1, ability2]) =>
        (abilities1.includes(ability1) && abilities2.includes(ability2)) ||
        (abilities1.includes(ability2) && abilities2.includes(ability1))
    )
  }

  /**
   * Generate synergy windows for optimal group interactions
   */
  private static generateSynergyWindows(
    agentIds: string[],
    planetaryInfluences: string[]
  ): Array<{
    startTime: Date
    endTime: Date
    description: string
    amplification: number
  }> {
    const windows = []
    const now = new Date()

    // Check for planetary alignments that benefit multiple agents
    agentIds.forEach(agentId => {
      const profile = agentKineticProfiles[agentId]
      if (!profile) return

      profile.alignment.forEach(planet => {
        if (planetaryInfluences.includes(planet)) {
          // Create a synergy window for this alignment
          const startTime = new Date(now.getTime() + Math.random() * 2 * 60 * 60 * 1000) // Next 2 hours
          const endTime = new Date(startTime.getTime() + 45 * 60 * 1000) // 45 minute window

          windows.push({
            startTime,
            endTime,
            description: `${planet} alignment enhances ${agentId.replace(/-/g, ' ')}`,
            amplification: 1.2 + Math.random() * 0.3,
          })
        }
      })
    })

    // Add group consciousness peaks
    if (agentIds.length >= 3) {
      const groupPeak = new Date(now.getTime() + (1 + Math.random() * 6) * 60 * 60 * 1000)
      windows.push({
        startTime: groupPeak,
        endTime: new Date(groupPeak.getTime() + 30 * 60 * 1000),
        description: 'Group consciousness convergence peak',
        amplification: 1.5 + agentIds.length * 0.1,
      })
    }

    return windows.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()).slice(0, 5)
  }

  /**
   * Generate flow pattern description
   */
  private static generateFlowPattern(
    direction: string,
    intensity: number,
    dominantElement: string
  ): string {
    const intensityDesc =
      intensity > 0.8
        ? 'intense'
        : intensity > 0.6
          ? 'strong'
          : intensity > 0.4
            ? 'moderate'
            : 'gentle'

    const patterns = {
      outward: `${intensityDesc} radiant expansion (${dominantElement}-driven)`,
      inward: `${intensityDesc} convergent focus (${dominantElement}-centered)`,
      spiral: `${intensityDesc} ascending spiral (${dominantElement}-lifted)`,
      circular: `${intensityDesc} harmonic circulation (${dominantElement}-grounded)`,
    }

    return patterns[direction as keyof typeof patterns] || `${intensityDesc} balanced flow`
  }

  /**
   * Get real-time group consciousness score
   */
  static getGroupConsciousnessScore(
    agentIds: string[],
    currentPlanetaryHour: string,
    elementalTotals: { Fire: number; Water: number; Air: number; Earth: number }
  ): {
    score: number
    level: 'low' | 'moderate' | 'high' | 'transcendent'
    description: string
    nextPeak: Date | null
  } {
    if (agentIds.length === 0) {
      return { score: 0, level: 'low', description: 'No agents present', nextPeak: null }
    }

    // Calculate base group harmony
    const harmony = this.calculateGroupHarmony(agentIds, [currentPlanetaryHour], elementalTotals)

    // Apply planetary hour bonus
    const planetaryBonus = agentIds.reduce((bonus, agentId) => {
      const profile = agentKineticProfiles[agentId]
      return bonus + (profile?.alignment.includes(currentPlanetaryHour) ? 0.1 : 0)
    }, 0)

    const score = Math.min(1.0, harmony.overallScore + planetaryBonus)

    // Determine consciousness level
    let level: 'low' | 'moderate' | 'high' | 'transcendent'
    if (score > 0.9) level = 'transcendent'
    else if (score > 0.7) level = 'high'
    else if (score > 0.5) level = 'moderate'
    else level = 'low'

    // Generate description
    const description = this.generateConsciousnessDescription(
      score,
      agentIds.length,
      currentPlanetaryHour
    )

    // Predict next peak (simplified)
    const nextPeak = harmony.synergyWindows[0]?.startTime || null

    return { score, level, description, nextPeak }
  }

  /**
   * Generate consciousness description
   */
  private static generateConsciousnessDescription(
    score: number,
    agentCount: number,
    planetaryHour: string
  ): string {
    if (score > 0.9) {
      return `Transcendent group consciousness achieved! ${agentCount} agents in perfect ${planetaryHour} harmony.`
    } else if (score > 0.7) {
      return `High consciousness resonance with ${agentCount} agents under ${planetaryHour} influence.`
    } else if (score > 0.5) {
      return `Moderate group coherence developing among ${agentCount} agents.`
    } else {
      return `Building consciousness foundation with ${agentCount} agents.`
    }
  }

  /**
   * Calculate optimal speaker rotation for sustained engagement
   */
  static calculateOptimalSpeakerRotation(
    agentIds: string[],
    conversationHistory: Array<{ agentId: string; timestamp: Date; engagement: number }>
  ): {
    nextSpeaker: string
    rotationPattern: string[]
    reasoningFactors: string[]
  } {
    // Find agent who hasn't spoken recently and has high current alignment
    const recentSpeakers = conversationHistory
      .filter(msg => Date.now() - msg.timestamp.getTime() < 5 * 60 * 1000) // Last 5 minutes
      .map(msg => msg.agentId)

    const availableAgents = agentIds.filter(id => !recentSpeakers.includes(id))

    if (availableAgents.length === 0) {
      // All agents spoke recently, choose based on engagement
      const bestEngagement = conversationHistory.reduce(
        (best, msg) => (msg.engagement > best.engagement ? msg : best),
        { agentId: agentIds[0], engagement: 0 }
      )

      return {
        nextSpeaker: bestEngagement.agentId,
        rotationPattern: agentIds,
        reasoningFactors: ['High engagement history'],
      }
    }

    // Choose from available agents based on current conditions
    const nextSpeaker = availableAgents[0] // Simplified selection

    return {
      nextSpeaker,
      rotationPattern: [...availableAgents, ...recentSpeakers],
      reasoningFactors: ['Fresh perspective', 'Rotation balance'],
    }
  }
}

export default GroupConsciousnessDynamics
