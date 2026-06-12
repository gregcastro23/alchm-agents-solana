/**
 * Consciousness Persistence Layer
 * Handles all database operations for agent evolution and user consciousness tracking
 */

import 'server-only'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function saveEvolutionState(userId: string, agentId: string, state: any) {
  await prisma.agent_evolution_states.upsert({
    where: { agentId_userId: { userId, agentId } },
    update: { evolutionHistory: JSON.stringify(state) },
    create: { userId, agentId, evolutionHistory: JSON.stringify(state) },
  })
}

// Add load function if needed

export interface EvolutionState {
  agentId: string
  userId: string
  currentLevel: string
  totalPower: number
  interactionCount: number
  lastInteraction: Date
  specialAbilitiesUnlocked: string[]
  evolutionHistory: any[]
  affinityScores: Record<string, number>
}

export interface InteractionData {
  userId: string
  agentId: string
  interactionType: string
  powerGained: number
  planetaryInfluence: string
  elementalResonance: number
  forceMagnitude?: number
  metadata?: any
}

class ConsciousnessPersistence {
  /**
   * Save or update agent evolution state
   */
  async saveEvolutionState(userId: string, agentId: string, state: Partial<EvolutionState>) {
    try {
      const evolutionState = await prisma.agent_evolution_states.upsert({
        where: {
          agentId_userId: {
            agentId,
            userId,
          },
        },
        update: {
          currentLevel: state.currentLevel,
          totalPower: state.totalPower,
          interactionCount: state.interactionCount,
          lastInteraction: state.lastInteraction || new Date(),
          specialAbilitiesUnlocked: state.specialAbilitiesUnlocked
            ? JSON.stringify(state.specialAbilitiesUnlocked)
            : undefined,
          evolutionHistory: state.evolutionHistory
            ? JSON.stringify(state.evolutionHistory)
            : undefined,
          affinityScores: state.affinityScores ? JSON.stringify(state.affinityScores) : undefined,
        },
        create: {
          agentId,
          userId,
          currentLevel: state.currentLevel || 'bronze',
          totalPower: state.totalPower || 0,
          interactionCount: state.interactionCount || 0,
          lastInteraction: state.lastInteraction || new Date(),
          specialAbilitiesUnlocked: JSON.stringify(state.specialAbilitiesUnlocked || []),
          evolutionHistory: JSON.stringify(state.evolutionHistory || []),
          affinityScores: JSON.stringify(state.affinityScores || {}),
        },
      })

      return this.parseEvolutionState(evolutionState)
    } catch (error) {
      console.error('Failed to save evolution state:', error)
      throw error
    }
  }

  /**
   * Load agent evolution state for a user
   */
  async loadEvolutionState(userId: string, agentId: string): Promise<EvolutionState | null> {
    try {
      const state = await prisma.agent_evolution_states.findUnique({
        where: {
          agentId_userId: {
            agentId,
            userId,
          },
        },
      })

      if (!state) {
        // Create initial state
        return this.saveEvolutionState(userId, agentId, {
          currentLevel: 'bronze',
          totalPower: 0,
          interactionCount: 0,
          specialAbilitiesUnlocked: [],
          evolutionHistory: [],
          affinityScores: {},
        })
      }

      return this.parseEvolutionState(state)
    } catch (error) {
      console.error('Failed to load evolution state:', error)
      return null
    }
  }

  /**
   * Get all evolution states for a user
   */
  async getUserEvolutionStates(userId: string): Promise<EvolutionState[]> {
    try {
      const states = await prisma.agent_evolution_states.findMany({
        where: { userId },
        orderBy: { lastInteraction: 'desc' },
      })

      return states.map(state => this.parseEvolutionState(state))
    } catch (error) {
      console.error('Failed to get user evolution states:', error)
      return []
    }
  }

  /**
   * Log a consciousness interaction
   */
  async logInteraction(data: InteractionData) {
    try {
      const interaction = await prisma.consciousness_interactions.create({
        data: {
          userId: data.userId,
          agentId: data.agentId,
          interactionType: data.interactionType,
          powerGained: data.powerGained,
          planetaryInfluence: data.planetaryInfluence,
          elementalResonance: data.elementalResonance,
          forceMagnitude: data.forceMagnitude || null,
          metadata: JSON.stringify(data.metadata || {}),
        },
      })

      // Update evolution state
      const currentState = await this.loadEvolutionState(data.userId, data.agentId)
      if (currentState) {
        const newPower = currentState.totalPower + data.powerGained
        const newLevel = this.calculateLevel(newPower)

        await this.saveEvolutionState(data.userId, data.agentId, {
          totalPower: newPower,
          currentLevel: newLevel,
          interactionCount: currentState.interactionCount + 1,
          lastInteraction: new Date(),
        })
      }

      return interaction
    } catch (error) {
      console.error('Failed to log interaction:', error)
      throw error
    }
  }

  /**
   * Get interaction history for a user and agent
   */
  async getInteractionHistory(userId: string, agentId: string, limit: number = 10) {
    try {
      const interactions = await prisma.consciousness_interactions.findMany({
        where: {
          userId,
          agentId,
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      })

      return interactions.map(interaction => ({
        ...interaction,
        metadata: interaction.metadata ? JSON.parse(interaction.metadata as string) : {},
      }))
    } catch (error) {
      console.error('Failed to get interaction history:', error)
      return []
    }
  }

  /**
   * Get user's consciousness journey summary
   */
  async getConsciousnessJourney(userId: string) {
    try {
      const [evolutionStates, recentInteractions, userProgress] = await Promise.all([
        this.getUserEvolutionStates(userId),
        prisma.consciousness_interactions.findMany({
          where: { userId },
          orderBy: { timestamp: 'desc' },
          take: 20,
        }),
        prisma.monica_user_progress.findUnique({
          where: { userId },
        }),
      ])

      const totalPower = evolutionStates.reduce((sum, state) => sum + state.totalPower, 0)
      const totalInteractions = evolutionStates.reduce(
        (sum, state) => sum + state.interactionCount,
        0
      )
      const activeAgents = evolutionStates.filter(state => state.interactionCount > 0).length

      return {
        userId,
        totalPower,
        totalInteractions,
        activeAgents,
        userLevel: userProgress?.level || 1,
        totalXP: userProgress?.totalXP || 0,
        evolutionStates,
        recentInteractions: recentInteractions.map(i => ({
          ...i,
          metadata: i.metadata ? JSON.parse(i.metadata as string) : {},
        })),
        journeyStarted: evolutionStates[0]?.lastInteraction || new Date(),
      }
    } catch (error) {
      console.error('Failed to get consciousness journey:', error)
      throw error
    }
  }

  /**
   * Calculate consciousness level based on total power
   */
  private calculateLevel(totalPower: number): string {
    if (totalPower < 100) return 'bronze'
    if (totalPower < 500) return 'silver'
    if (totalPower < 1000) return 'gold'
    if (totalPower < 2500) return 'platinum'
    if (totalPower < 5000) return 'diamond'
    if (totalPower < 10000) return 'master'
    return 'transcendent'
  }

  /**
   * Parse evolution state from database
   */
  private parseEvolutionState(state: any): EvolutionState {
    return {
      agentId: state.agentId,
      userId: state.userId,
      currentLevel: state.currentLevel,
      totalPower: state.totalPower,
      interactionCount: state.interactionCount,
      lastInteraction: state.lastInteraction,
      specialAbilitiesUnlocked: state.specialAbilitiesUnlocked
        ? JSON.parse(state.specialAbilitiesUnlocked)
        : [],
      evolutionHistory: state.evolutionHistory ? JSON.parse(state.evolutionHistory) : [],
      affinityScores: state.affinityScores ? JSON.parse(state.affinityScores) : {},
    }
  }

  /**
   * Reset agent evolution (for testing/admin purposes)
   */
  async resetAgentEvolution(userId: string, agentId: string) {
    try {
      await prisma.agent_evolution_states.delete({
        where: {
          agentId_userId: {
            agentId,
            userId,
          },
        },
      })

      // Create fresh state
      return this.saveEvolutionState(userId, agentId, {
        currentLevel: 'bronze',
        totalPower: 0,
        interactionCount: 0,
        specialAbilitiesUnlocked: [],
        evolutionHistory: [],
        affinityScores: {},
      })
    } catch (error) {
      console.error('Failed to reset agent evolution:', error)
      throw error
    }
  }
}

// Export singleton instance
export const consciousnessPersistence = new ConsciousnessPersistence()
