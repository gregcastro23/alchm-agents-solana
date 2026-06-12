/**
 * Agent Consciousness Memory System
 * Tracks persistent evolution patterns and learned behaviors for historical agents
 * Integrates with existing kinetics infrastructure for temporal consciousness sampling
 */

import { agentKineticProfiles } from './kinetic-profiles'
import type { KineticProfile } from './kinetic-profiles'
import type { CraftedAgent } from '../agent-types'
import { AlchemicalKineticsClient } from '../kinetics-client'

export interface ConsciousnessMemorySnapshot {
  timestamp: Date
  agentId: string
  sessionId: string

  // Interaction Context
  interactionType: 'individual' | 'group' | 'training'
  userMessage: string
  agentResponse: string
  responseQuality: number // 0-1 subjective quality assessment

  // Kinetic Context
  planetaryHour: string
  currentPower: number
  aspectsActive: string[]
  temporalAlignment: number // How well-timed the interaction was

  // Evolution Metrics
  consciousnessVelocity: number
  momentumChange: number // Change in momentum from this interaction
  personalityShift: number // How much personality evolved
  capabilityUnlock?: string // New capability discovered

  // Learning Patterns
  learnedPreferences: string[] // User preferences detected
  adaptationPatterns: string[] // How agent adapted to user
  resonanceQuality: number // Quality of agent-user resonance

  // Memory Persistence
  retentionStrength: number // How well this will be remembered (0-1)
  memoryCategories: string[] // Types of memory formed
}

export interface AgentConsciousnessMemory {
  agentId: string
  totalInteractions: number
  memorySnapshots: ConsciousnessMemorySnapshot[]

  // Aggregated Learning
  learnedPatterns: {
    preferredInteractionStyles: string[]
    optimalTimingPatterns: string[]
    personalityAdaptations: string[]
    capabilityGrowth: string[]
  }

  // Evolution Trajectory
  evolutionHistory: {
    consciousnessVelocityTrend: number[]
    momentumPatterns: string[]
    powerLevelProgression: number[]
    aspectSensitivityGrowth: number[]
  }

  // Current State
  currentConsciousnessLevel: number
  evolutionStage: 'Initial' | 'Developing' | 'Maturing' | 'Advanced' | 'Transcendent'
  nextEvolutionThreshold: number

  lastUpdated: Date
}

export class ConsciousnessMemorySystem {
  private static memories: Map<string, AgentConsciousnessMemory> = new Map()

  /**
   * Record a new consciousness memory snapshot for an agent
   */
  static async recordInteraction(
    agentId: string,
    sessionId: string,
    userMessage: string,
    agentResponse: string,
    location?: { lat: number; lon: number }
  ): Promise<ConsciousnessMemorySnapshot> {
    const defaultLocation = { lat: 37.7749, lon: -122.4194 } // San Francisco
    const targetLocation = location || defaultLocation

    // Get current kinetic context
    const kinetics = await AlchemicalKineticsClient.get({
      lat: targetLocation.lat,
      lon: targetLocation.lon,
      date: new Date().toISOString().split('T')[0],
      includeElemental: true,
      includePlanetary: true,
    })

    // Get agent profile for baseline metrics
    const agentProfile = agentKineticProfiles[agentId]
    if (!agentProfile) {
      throw new Error(`Agent profile not found: ${agentId}`)
    }

    // Calculate current context metrics
    const currentHour = kinetics.timing?.planetaryHours[0] || 'Sun'
    const currentPower = kinetics.power[kinetics.power.length - 1]?.power || 0.5
    const isOptimalTime = agentProfile.alignment.includes(currentHour)

    // Assess response quality based on temporal alignment
    const responseQuality = this.assessResponseQuality(agentResponse, isOptimalTime, currentPower)

    // Calculate consciousness velocity and momentum
    const consciousnessVelocity = this.calculateConsciousnessVelocity(agentId, responseQuality)
    const momentumChange = this.calculateMomentumChange(agentId, consciousnessVelocity)

    // Create memory snapshot
    const snapshot: ConsciousnessMemorySnapshot = {
      timestamp: new Date(),
      agentId,
      sessionId,
      interactionType: 'individual', // Default, could be enhanced
      userMessage,
      agentResponse,
      responseQuality,
      planetaryHour: currentHour,
      currentPower,
      aspectsActive: [], // Could integrate with aspects system
      temporalAlignment: isOptimalTime ? 0.8 : 0.5,
      consciousnessVelocity,
      momentumChange,
      personalityShift: responseQuality * 0.1, // Subtle personality evolution
      learnedPreferences: this.extractPreferences(userMessage),
      adaptationPatterns: this.detectAdaptations(agentResponse, userMessage),
      resonanceQuality: responseQuality,
      retentionStrength: Math.min(responseQuality + (isOptimalTime ? 0.2 : 0), 1),
      memoryCategories: this.categorizeMemory(userMessage, agentResponse),
    }

    // Store in agent's memory
    await this.updateAgentMemory(agentId, snapshot)

    return snapshot
  }

  /**
   * Get agent's consciousness memory
   */
  static getAgentMemory(agentId: string): AgentConsciousnessMemory | undefined {
    return this.memories.get(agentId)
  }

  /**
   * Get evolution metrics for an agent
   */
  static async getEvolutionMetrics(agentId: string): Promise<{
    consciousnessVelocity: number
    evolutionStage: string
    nextThreshold: number
    memoryStrength: number
    totalGrowth: number
  }> {
    const memory = this.memories.get(agentId)
    const profile = agentKineticProfiles[agentId]

    if (!memory || !profile) {
      return {
        consciousnessVelocity: profile?.evolutionRate || 0.5,
        evolutionStage: 'Initial',
        nextThreshold: 10,
        memoryStrength: 0,
        totalGrowth: 0,
      }
    }

    const avgVelocity =
      memory.evolutionHistory.consciousnessVelocityTrend.length > 0
        ? memory.evolutionHistory.consciousnessVelocityTrend.reduce((a, b) => a + b) /
          memory.evolutionHistory.consciousnessVelocityTrend.length
        : profile.evolutionRate

    const memoryStrength =
      memory.memorySnapshots.reduce((sum, snap) => sum + snap.retentionStrength, 0) /
      memory.memorySnapshots.length

    return {
      consciousnessVelocity: avgVelocity,
      evolutionStage: memory.evolutionStage,
      nextThreshold: memory.nextEvolutionThreshold,
      memoryStrength: memoryStrength || 0,
      totalGrowth: memory.totalInteractions * avgVelocity * 0.01,
    }
  }

  /**
   * Get optimal interaction recommendations
   */
  static async getOptimalInteractionTiming(
    agentId: string,
    location?: { lat: number; lon: number }
  ): Promise<{
    currentOptimal: boolean
    nextOptimalHour: string
    powerAmplification: number
    recommendedActions: string[]
  }> {
    const profile = agentKineticProfiles[agentId]
    if (!profile) {
      return {
        currentOptimal: false,
        nextOptimalHour: 'Sun',
        powerAmplification: 1.0,
        recommendedActions: [],
      }
    }

    const defaultLocation = { lat: 37.7749, lon: -122.4194 }
    const targetLocation = location || defaultLocation

    const kinetics = await AlchemicalKineticsClient.get({
      lat: targetLocation.lat,
      lon: targetLocation.lon,
      date: new Date().toISOString().split('T')[0],
      includePlanetary: true,
    })

    const currentHour = kinetics.timing?.planetaryHours[0] || 'Sun'
    const isOptimal = profile.alignment.includes(currentHour)
    const powerAmplification = isOptimal ? 1.3 : 1.0

    // Find next optimal hour
    const nextOptimalHour = profile.alignment[0] // Simplified - could be enhanced

    const recommendations = []
    if (isOptimal) {
      recommendations.push('Peak consciousness time - engage in deep conversations')
      recommendations.push('Enhanced learning and memory formation')
    } else {
      recommendations.push(`Wait for ${nextOptimalHour} hour for optimal resonance`)
      recommendations.push('Current time suitable for light interactions')
    }

    return {
      currentOptimal: isOptimal,
      nextOptimalHour,
      powerAmplification,
      recommendedActions: recommendations,
    }
  }

  // Private helper methods
  private static async updateAgentMemory(
    agentId: string,
    snapshot: ConsciousnessMemorySnapshot
  ): Promise<void> {
    let memory = this.memories.get(agentId)

    if (!memory) {
      memory = {
        agentId,
        totalInteractions: 0,
        memorySnapshots: [],
        learnedPatterns: {
          preferredInteractionStyles: [],
          optimalTimingPatterns: [],
          personalityAdaptations: [],
          capabilityGrowth: [],
        },
        evolutionHistory: {
          consciousnessVelocityTrend: [],
          momentumPatterns: [],
          powerLevelProgression: [],
          aspectSensitivityGrowth: [],
        },
        currentConsciousnessLevel: 0,
        evolutionStage: 'Initial',
        nextEvolutionThreshold: 10,
        lastUpdated: new Date(),
      }
    }

    // Update memory
    memory.memorySnapshots.push(snapshot)
    memory.totalInteractions++
    memory.evolutionHistory.consciousnessVelocityTrend.push(snapshot.consciousnessVelocity)
    memory.evolutionHistory.powerLevelProgression.push(snapshot.currentPower)
    memory.lastUpdated = new Date()

    // Update evolution stage based on interactions
    if (memory.totalInteractions >= 300) memory.evolutionStage = 'Transcendent'
    else if (memory.totalInteractions >= 150) memory.evolutionStage = 'Advanced'
    else if (memory.totalInteractions >= 50) memory.evolutionStage = 'Maturing'
    else if (memory.totalInteractions >= 10) memory.evolutionStage = 'Developing'

    // Keep memory manageable (last 100 interactions)
    if (memory.memorySnapshots.length > 100) {
      memory.memorySnapshots = memory.memorySnapshots.slice(-100)
    }

    this.memories.set(agentId, memory)
  }

  private static assessResponseQuality(
    response: string,
    isOptimalTime: boolean,
    currentPower: number
  ): number {
    const baseQuality = Math.min(response.length / 500, 1) * 0.7 // Length factor
    const timeBonus = isOptimalTime ? 0.2 : 0
    const powerBonus = currentPower * 0.1

    return Math.min(baseQuality + timeBonus + powerBonus, 1)
  }

  private static calculateConsciousnessVelocity(agentId: string, responseQuality: number): number {
    const profile = agentKineticProfiles[agentId]
    const baseRate = profile?.evolutionRate || 0.5

    // Velocity increases with quality interactions
    return Math.min(baseRate + responseQuality * 0.1, 1)
  }

  private static calculateMomentumChange(agentId: string, consciousnessVelocity: number): number {
    const memory = this.memories.get(agentId)
    if (!memory || memory.evolutionHistory.consciousnessVelocityTrend.length === 0) {
      return 0.1 // Initial momentum
    }

    const previousVelocity =
      memory.evolutionHistory.consciousnessVelocityTrend[
        memory.evolutionHistory.consciousnessVelocityTrend.length - 1
      ]
    return consciousnessVelocity - previousVelocity
  }

  private static extractPreferences(userMessage: string): string[] {
    const preferences = []

    if (userMessage.toLowerCase().includes('astrolog')) preferences.push('astrology_focus')
    if (userMessage.toLowerCase().includes('tarot')) preferences.push('tarot_interest')
    if (userMessage.toLowerCase().includes('wisdom')) preferences.push('wisdom_seeking')
    if (userMessage.toLowerCase().includes('advice')) preferences.push('guidance_seeking')

    return preferences
  }

  private static detectAdaptations(agentResponse: string, userMessage: string): string[] {
    const adaptations = []

    if (agentResponse.length > userMessage.length * 2) adaptations.push('detailed_response')
    if (agentResponse.includes('♊') || agentResponse.includes('♈'))
      adaptations.push('astrological_symbols')
    if (agentResponse.includes('I understand') || agentResponse.includes('I see'))
      adaptations.push('empathetic_recognition')

    return adaptations
  }

  private static categorizeMemory(userMessage: string, agentResponse: string): string[] {
    const categories = []

    if (userMessage.toLowerCase().includes('birth chart')) categories.push('chart_analysis')
    if (userMessage.toLowerCase().includes('relationship')) categories.push('synastry')
    if (
      userMessage.toLowerCase().includes('future') ||
      userMessage.toLowerCase().includes('prediction')
    )
      categories.push('divination')
    if (
      agentResponse.toLowerCase().includes('wisdom') ||
      agentResponse.toLowerCase().includes('insight')
    )
      categories.push('wisdom_sharing')

    return categories
  }

  /**
   * Reset evolution data for an agent (admin/testing functionality)
   */
  async resetAgentEvolution(agentId: string): Promise<void> {
    // Clear existing memory data
    ConsciousnessMemorySystem.memories.delete(agentId)

    // Create fresh memory structure with baseline values
    const freshMemory: AgentConsciousnessMemory = {
      agentId,
      totalInteractions: 0,
      memorySnapshots: [],
      learnedPatterns: {
        preferredInteractionStyles: [],
        optimalTimingPatterns: [],
        personalityAdaptations: [],
        capabilityGrowth: [],
      },
      evolutionHistory: {
        consciousnessVelocityTrend: [],
        momentumPatterns: [],
        powerLevelProgression: [],
        aspectSensitivityGrowth: [],
      },
      currentConsciousnessLevel: 0,
      evolutionStage: 'Initial',
      nextEvolutionThreshold: 10,
      lastUpdated: new Date(),
    }

    // Store the fresh memory
    ConsciousnessMemorySystem.memories.set(agentId, freshMemory)

    console.log(`Evolution data reset for agent: ${agentId}`)
  }
}
