/**
 * Consciousness Memory Persistence
 * ===============================
 *
 * Database persistence layer for agent evolution, user interactions,
 * and consciousness journey tracking.
 */

import { prisma } from '@/lib/db'

export interface AgentEvolutionState {
  agentId: string
  userId?: string
  currentLevel: 'bronze' | 'silver' | 'gold' | 'platinum' | 'transcendent'
  totalPower: number
  interactionCount: number
  lastInteraction: Date
  specialAbilitiesUnlocked: string[]
  evolutionHistory: Array<{
    level: string
    unlockedAt: Date
    powerAtUnlock: number
  }>
  affinityScores: {
    [otherAgentId: string]: number
  }
}

export interface ConsciousnessInteraction {
  id: string
  userId?: string
  agentId: string
  interactionType: 'chat' | 'consultation' | 'group_chat' | 'kinetic_evolution'
  powerGained: number
  planetaryInfluence: string
  elementalResonance: number
  timestamp: Date
  metadata: {
    messageContent?: string
    groupAgents?: string[]
    evolutionTriggered?: boolean
    abilityUnlocked?: string
  }
}

export class ConsciousnessMemoryPersistence {
  /**
   * Get or create agent evolution state for a user
   */
  static async getAgentEvolution(agentId: string, userId?: string): Promise<AgentEvolutionState> {
    try {
      // Try to find existing state
      const existing = await (prisma as any).agentEvolutionState.findFirst({
        where: {
          agentId,
          userId: userId || null,
        },
      })

      if (existing) {
        return {
          agentId: existing.agentId,
          userId: existing.userId || undefined,
          currentLevel: existing.currentLevel as any,
          totalPower: existing.totalPower,
          interactionCount: existing.interactionCount,
          lastInteraction: existing.lastInteraction,
          specialAbilitiesUnlocked: existing.specialAbilitiesUnlocked as string[],
          evolutionHistory: existing.evolutionHistory as any[],
          affinityScores: existing.affinityScores as any,
        }
      }

      // Create new state
      const newState: AgentEvolutionState = {
        agentId,
        userId,
        currentLevel: 'bronze',
        totalPower: 0,
        interactionCount: 0,
        lastInteraction: new Date(),
        specialAbilitiesUnlocked: [],
        evolutionHistory: [],
        affinityScores: {},
      }

      // Save to database
      await this.saveAgentEvolution(newState)
      return newState
    } catch (error) {
      console.error('Error getting agent evolution:', error)

      // Return default state on error
      return {
        agentId,
        userId,
        currentLevel: 'bronze',
        totalPower: 0,
        interactionCount: 0,
        lastInteraction: new Date(),
        specialAbilitiesUnlocked: [],
        evolutionHistory: [],
        affinityScores: {},
      }
    }
  }

  /**
   * Save agent evolution state to database
   */
  static async saveAgentEvolution(state: AgentEvolutionState): Promise<void> {
    try {
      await (prisma as any).agentEvolutionState.upsert({
        where: {
          agentId_userId: {
            agentId: state.agentId,
            userId: state.userId || 'anonymous',
          },
        },
        update: {
          currentLevel: state.currentLevel,
          totalPower: state.totalPower,
          interactionCount: state.interactionCount,
          lastInteraction: state.lastInteraction,
          specialAbilitiesUnlocked: state.specialAbilitiesUnlocked,
          evolutionHistory: state.evolutionHistory as any,
          affinityScores: state.affinityScores as any,
        },
        create: {
          agentId: state.agentId,
          userId: state.userId || 'anonymous',
          currentLevel: state.currentLevel,
          totalPower: state.totalPower,
          interactionCount: state.interactionCount,
          lastInteraction: state.lastInteraction,
          specialAbilitiesUnlocked: state.specialAbilitiesUnlocked,
          evolutionHistory: state.evolutionHistory as any,
          affinityScores: state.affinityScores as any,
        },
      })
    } catch (error) {
      console.error('Error saving agent evolution:', error)
    }
  }

  /**
   * Record a consciousness interaction
   */
  static async recordInteraction(interaction: Omit<ConsciousnessInteraction, 'id'>): Promise<void> {
    try {
      // Save interaction
      await (prisma as any).consciousnessInteraction.create({
        data: {
          userId: interaction.userId || 'anonymous',
          agentId: interaction.agentId,
          interactionType: interaction.interactionType,
          powerGained: interaction.powerGained,
          planetaryInfluence: interaction.planetaryInfluence,
          elementalResonance: interaction.elementalResonance,
          timestamp: interaction.timestamp,
          metadata: interaction.metadata as any,
        },
      })

      // Update agent evolution state
      const currentState = await this.getAgentEvolution(interaction.agentId, interaction.userId)

      const updatedState: AgentEvolutionState = {
        ...currentState,
        totalPower: currentState.totalPower + interaction.powerGained,
        interactionCount: currentState.interactionCount + 1,
        lastInteraction: interaction.timestamp,
      }

      // Check for evolution level up
      const newLevel = this.calculateEvolutionLevel(updatedState.totalPower)
      if (newLevel !== currentState.currentLevel) {
        updatedState.currentLevel = newLevel
        updatedState.evolutionHistory.push({
          level: newLevel,
          unlockedAt: interaction.timestamp,
          powerAtUnlock: updatedState.totalPower,
        })

        // Check for new abilities
        const newAbilities = this.getUnlockedAbilities(newLevel, interaction.agentId)
        updatedState.specialAbilitiesUnlocked = newAbilities
      }

      await this.saveAgentEvolution(updatedState)
    } catch (error) {
      console.error('Error recording interaction:', error)
    }
  }

  /**
   * Get interaction history for an agent
   */
  static async getInteractionHistory(
    agentId: string,
    userId?: string,
    limit: number = 50
  ): Promise<ConsciousnessInteraction[]> {
    try {
      const interactions = await (prisma as any).consciousnessInteraction.findMany({
        where: {
          agentId,
          userId: userId || 'anonymous',
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: limit,
      })

      return interactions.map((interaction: any) => ({
        id: interaction.id,
        userId: interaction.userId === 'anonymous' ? undefined : interaction.userId,
        agentId: interaction.agentId,
        interactionType: interaction.interactionType as any,
        powerGained: interaction.powerGained,
        planetaryInfluence: interaction.planetaryInfluence,
        elementalResonance: interaction.elementalResonance,
        timestamp: interaction.timestamp,
        metadata: interaction.metadata as any,
      }))
    } catch (error) {
      console.error('Error getting interaction history:', error)
      return []
    }
  }

  /**
   * Get consciousness journey summary for a user
   */
  static async getConsciousnessJourney(userId: string): Promise<{
    totalInteractions: number
    totalPowerGained: number
    agentsEvolved: number
    favoriteAgent: string | null
    journeyStarted: Date | null
    milestones: Array<{
      type: 'evolution' | 'ability' | 'achievement'
      description: string
      timestamp: Date
      agentId: string
    }>
  }> {
    try {
      // Get all interactions for user
      const interactions = await (prisma as any).consciousnessInteraction.findMany({
        where: { userId },
        orderBy: { timestamp: 'asc' },
      })

      // Get all evolution states for user
      const evolutionStates = await (prisma as any).agentEvolutionState.findMany({
        where: { userId },
      })

      const totalInteractions = interactions.length
      const totalPowerGained = interactions.reduce(
        (sum: any, interaction: any) => sum + interaction.powerGained,
        0
      )
      const agentsEvolved = evolutionStates.filter(
        (state: any) => state.currentLevel !== 'bronze'
      ).length

      // Find favorite agent (most interactions)
      const agentCounts = interactions.reduce(
        (counts: Record<string, number>, interaction: any) => {
          counts[interaction.agentId] = (counts[interaction.agentId] || 0) + 1
          return counts
        },
        {} as Record<string, number>
      )
      const favoriteAgent = Object.entries(agentCounts).reduce(
        (favorite: any, [agentId, count]: any) =>
          count > favorite.count ? { agentId, count } : favorite,
        { agentId: null as string | null, count: 0 }
      ).agentId

      const journeyStarted = interactions[0]?.timestamp || null

      // Generate milestones
      const milestones: any[] = []

      // Evolution milestones
      evolutionStates.forEach((state: any) => {
        ;(state.evolutionHistory as any[]).forEach(evolution => {
          milestones.push({
            type: 'evolution' as const,
            description: `${state.agentId.replace(/-/g, ' ')} evolved to ${evolution.level}`,
            timestamp: new Date(evolution.unlockedAt),
            agentId: state.agentId,
          })
        })
      })

      // Sort milestones by date
      milestones.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

      return {
        totalInteractions,
        totalPowerGained,
        agentsEvolved,
        favoriteAgent,
        journeyStarted,
        milestones: milestones.slice(-10), // Last 10 milestones
      }
    } catch (error) {
      console.error('Error getting consciousness journey:', error)
      return {
        totalInteractions: 0,
        totalPowerGained: 0,
        agentsEvolved: 0,
        favoriteAgent: null,
        journeyStarted: null,
        milestones: [],
      }
    }
  }

  /**
   * Calculate evolution level based on total power
   */
  private static calculateEvolutionLevel(
    totalPower: number
  ): 'bronze' | 'silver' | 'gold' | 'platinum' | 'transcendent' {
    if (totalPower >= 2000) return 'transcendent'
    if (totalPower >= 1000) return 'platinum'
    if (totalPower >= 500) return 'gold'
    if (totalPower >= 200) return 'silver'
    return 'bronze'
  }

  /**
   * Get unlocked abilities for evolution level
   */
  private static getUnlockedAbilities(level: string, _agentId: string): string[] {
    const levelIndex = ['bronze', 'silver', 'gold', 'platinum', 'transcendent'].indexOf(level)

    // This would integrate with the agent kinetic profiles
    const baseAbilities = [
      'basic-consciousness',
      'enhanced-wisdom',
      'advanced-insight',
      'transcendent-awareness',
    ]
    return baseAbilities.slice(0, levelIndex + 1)
  }

  /**
   * Clean up old interaction data (for performance)
   */
  static async cleanupOldData(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)

      await (prisma as any).consciousnessInteraction.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      })
    } catch (error) {
      console.error('Error cleaning up old data:', error)
    }
  }
}

export default ConsciousnessMemoryPersistence
