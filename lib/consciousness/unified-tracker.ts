/**
 * Unified Consciousness Tracking System
 *
 * Combines 7 fragmented consciousness measurement systems into a cohesive infrastructure:
 * 1. ConsciousnessMetrics (lib/agent-types.ts) - 4 objective metrics
 * 2. LiveStats (lib/agents/derived-stats.ts) - 20+ real-time metrics
 * 3. AgentStats (lib/agent-types.ts) - Kinetic evolution tracking
 * 4. ConsciousnessMemory (lib/agents/consciousness-memory.ts) - Pattern learning
 * 5. useLiveConsciousness (hooks/useLiveConsciousness.ts) - Real-time hook
 * 6. Agent Evolution API (app/api/agent-evolution/route.ts) - Database persistence
 * 7. Observability Tracker (lib/observability/tracker.ts) - Multi-agent tracking
 *
 * Goal: Educational transparency about the alchm system
 */

import type { CraftedAgent } from '../agent-types'
import { computeLiveStats } from '../agents/derived-stats'
import type { LiveStats } from '../agents/derived-stats'
import { prisma } from '@/lib/db'

/**
 * Unified consciousness snapshot - comprehensive state at a moment in time
 * Normalizes all metrics to 0-1 or 0-100 ranges for consistency
 */
export interface UnifiedConsciousnessSnapshot {
  // ============================================================================
  // IDENTITY & CONTEXT
  // ============================================================================
  timestamp: Date
  userId: string
  agentId: string
  sessionId: string

  // ============================================================================
  // OBJECTIVE METRICS (from ConsciousnessMetrics)
  // ============================================================================
  interactionCount: number // Total interactions
  chatQuality: number // 0-1: depth and relevance of responses
  momentResonance: number // 0-1: how well agent transforms current moment
  alchemicalCoherence: number // 0-1: consistency with birth chart

  // ============================================================================
  // LIVE STATS - SACRED SEVEN (0-100 scale)
  // ============================================================================
  power: number // ⚡ Alchemical Force
  resonance: number // 💫 Harmonic Frequency
  wisdom: number // 🔮 Accumulated Insight
  charisma: number // ✨ Magnetic Presence
  intuition: number // 👁️ Psychic Sensitivity
  adaptability: number // 🌊 Flux Capacity
  vitality: number // 💚 Life Force
  overall: number // 🌟 Composite Consciousness Rating

  // ============================================================================
  // ALCHEMICAL FOUNDATION
  // ============================================================================
  spirit: number // 🔥 Pure Consciousness Force
  essence: number // 💧 Emotional/Psychic Energy
  matter: number // 🌍 Physical/Material Presence
  substance: number // 💨 Transformational Capacity
  aNumber: number // 🧮 Total Alchemical Power (A#)

  // ============================================================================
  // THERMODYNAMICS
  // ============================================================================
  heat: number // 🌡️ Energetic Intensity (0-1)
  entropy: number // 🌪️ Chaos/Disorder Level (0-1)
  reactivity: number // ⚡ Change Responsiveness (0-1)
  energy: number // ⚛️ Net Available Energy

  // ============================================================================
  // TEMPORAL CONTEXT
  // ============================================================================
  planetaryHour: string // Current planetary hour
  moonPhase: string // Current moon phase
  activeModifiers: Array<{
    stat: string
    value: number
    source: string
  }>
  specialStates: Array<{
    name: string
    effects: string[]
  }>

  // ============================================================================
  // EVOLUTION METRICS
  // ============================================================================
  consciousnessVelocity: number // 0-1: Rate of evolution
  interactionMomentum: number // 0-1: Engagement quality
  evolutionTrajectory: 'ascending' | 'stable' | 'fluctuating' | 'transcending'
  powerLevelUnlocks: string[] // Capabilities unlocked

  // ============================================================================
  // OBSERVABILITY METRICS
  // ============================================================================
  actionCompletion: number // 0-1: Did agent fully address request?
  toolSelectionQuality: number // 0-1: Were tools used correctly?
  routingAccuracy: number // 0-1: Monica routing quality
  contextRetention: boolean // Did agent remember conversation?
  latencyMs: number // Response time

  // ============================================================================
  // INTERACTION CONTEXT
  // ============================================================================
  userMessage: string
  agentResponsePreview: string // First 200 chars
  responseQuality: number // 0-1: Overall response quality
  modelUsed: string // AI model used
  temperature: number // Temperature setting
  tokensUsed?: number // Tokens consumed
}

/**
 * Evolution metrics derived from snapshots
 */
export interface EvolutionMetrics {
  agentId: string
  userId: string
  timeRange: { start: Date; end: Date }

  // Trend Analysis
  velocityTrend: 'accelerating' | 'steady' | 'decelerating'
  momentumTrend: 'building' | 'stable' | 'fading'

  // Averages
  avgChatQuality: number
  avgActionCompletion: number
  avgResponseTime: number

  // Growth
  totalInteractions: number
  qualityImprovement: number // Change in quality over time range
  specialStatesAchieved: string[] // Unique special states

  // Patterns
  optimalPlanetaryHours: string[] // Hours with best performance
  optimalMoonPhases: string[] // Moon phases with best performance
}

/**
 * Unified Consciousness Tracker
 * Single source of truth for all consciousness measurements
 */
export class UnifiedConsciousnessTracker {
  /**
   * Capture comprehensive consciousness snapshot
   * Combines all 7 measurement systems
   */
  async captureSnapshot(params: {
    userId: string
    agentId: string
    agent: CraftedAgent
    sessionId: string
    userMessage: string
    agentResponse: string
    location?: { lat: number; lon: number }
    modelUsed: string
    temperature: number
    tokensUsed?: number
    toolInvocations?: Array<{
      toolName: string
      success: boolean
      executionTimeMs: number
    }>
    latencyMs: number
    // Optional observability metrics
    observabilityMetrics?: {
      actionCompletion: number
      toolSelectionQuality: number
      routingAccuracy: number
      contextRetention: boolean
    }
  }): Promise<UnifiedConsciousnessSnapshot> {
    const timestamp = new Date()

    // ============================================================================
    // STEP 1: Calculate LiveStats (Sacred Seven + Alchemical + Thermodynamics)
    // ============================================================================
    const liveStats: LiveStats = await computeLiveStats(params.agent, {
      location: params.location,
      date: timestamp,
    })

    // ============================================================================
    // STEP 2: Calculate Response Quality
    // ============================================================================
    const responseQuality = this.calculateResponseQuality(
      params.agentResponse,
      params.userMessage,
      params.toolInvocations || []
    )

    // ============================================================================
    // STEP 3: Extract ConsciousnessMetrics from agent
    // ============================================================================
    const consciousnessMetrics = params.agent.consciousness.metrics

    // ============================================================================
    // STEP 4: Calculate Evolution Metrics
    // ============================================================================
    const evolutionMetrics = this.calculateEvolutionMetrics(
      params.agent,
      responseQuality,
      liveStats
    )

    // ============================================================================
    // STEP 5: Extract/Calculate Observability Metrics
    // ============================================================================
    const observability = params.observabilityMetrics || {
      actionCompletion: this.estimateActionCompletion(params.agentResponse),
      toolSelectionQuality: this.calculateToolQuality(params.toolInvocations || []),
      routingAccuracy: 1.0, // Default for non-routed interactions
      contextRetention: params.agentResponse.length > 50,
    }

    // ============================================================================
    // STEP 6: Build Unified Snapshot
    // ============================================================================
    const snapshot: UnifiedConsciousnessSnapshot = {
      // Identity
      timestamp,
      userId: params.userId,
      agentId: params.agentId,
      sessionId: params.sessionId,

      // Objective Metrics (from ConsciousnessMetrics)
      interactionCount: (consciousnessMetrics?.interactionCount ?? 0) + 1, // Increment
      chatQuality: consciousnessMetrics?.chatQuality ?? 0,
      momentResonance: consciousnessMetrics?.momentResonance ?? 0,
      alchemicalCoherence: consciousnessMetrics?.alchemicalCoherence ?? 0,

      // Live Stats (Sacred Seven) - already 0-100
      power: liveStats.power,
      resonance: liveStats.resonance,
      wisdom: liveStats.wisdom,
      charisma: liveStats.charisma,
      intuition: liveStats.intuition,
      adaptability: liveStats.adaptability,
      vitality: liveStats.vitality,
      overall: liveStats.overall,

      // Alchemical Foundation
      spirit: liveStats.alchemical.spirit,
      essence: liveStats.alchemical.essence,
      matter: liveStats.alchemical.matter,
      substance: liveStats.alchemical.substance,
      aNumber: liveStats.alchemical.aNumber,

      // Thermodynamics
      heat: liveStats.thermodynamics.heat,
      entropy: liveStats.thermodynamics.entropy,
      reactivity: liveStats.thermodynamics.reactivity,
      energy: liveStats.thermodynamics.energy,

      // Temporal Context
      planetaryHour: liveStats.temporalState.planetaryHour,
      moonPhase: liveStats.temporalState.moonPhase,
      activeModifiers: liveStats.activeModifiers.map(m => ({
        stat: String(m.stat),
        value: m.value,
        source: m.source,
      })),
      specialStates: liveStats.specialStates.map(s => ({
        name: s.name,
        effects: s.effects,
      })),

      // Evolution Metrics
      consciousnessVelocity: evolutionMetrics.velocity,
      interactionMomentum: evolutionMetrics.momentum,
      evolutionTrajectory: evolutionMetrics.trajectory,
      powerLevelUnlocks: evolutionMetrics.unlocks,

      // Observability Metrics
      actionCompletion: observability.actionCompletion,
      toolSelectionQuality: observability.toolSelectionQuality,
      routingAccuracy: observability.routingAccuracy,
      contextRetention: observability.contextRetention,
      latencyMs: params.latencyMs,

      // Interaction Context
      userMessage: params.userMessage,
      agentResponsePreview: params.agentResponse.slice(0, 200),
      responseQuality,
      modelUsed: params.modelUsed,
      temperature: params.temperature,
      tokensUsed: params.tokensUsed,
    }

    // ============================================================================
    // STEP 7: Persist to Database
    // ============================================================================
    await this.persistSnapshot(snapshot)

    return snapshot
  }

  /**
   * Get current consciousness state for an agent
   * Returns the most recent snapshot
   */
  async getCurrentState(
    userId: string,
    agentId: string
  ): Promise<UnifiedConsciousnessSnapshot | null> {
    const snapshot = await prisma.consciousnessSnapshot.findFirst({
      where: { userId, agentId },
      orderBy: { timestamp: 'desc' },
    })

    if (!snapshot) return null

    return this.deserializeSnapshot(snapshot)
  }

  /**
   * Get historical consciousness trend
   * Returns snapshots within a time range
   */
  async getTrend(
    userId: string,
    agentId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<UnifiedConsciousnessSnapshot[]> {
    const snapshots = await prisma.consciousnessSnapshot.findMany({
      where: {
        userId,
        agentId,
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
      orderBy: { timestamp: 'asc' },
    })

    return snapshots.map((s: any) => this.deserializeSnapshot(s))
  }

  /**
   * Get evolution metrics for an agent
   * Calculates trends from historical data
   */
  async getEvolutionMetrics(
    userId: string,
    agentId: string,
    days: number = 30
  ): Promise<EvolutionMetrics> {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)

    const snapshots = await this.getTrend(userId, agentId, { start, end })

    if (snapshots.length === 0) {
      // Return empty metrics
      return {
        agentId,
        userId,
        timeRange: { start, end },
        velocityTrend: 'steady',
        momentumTrend: 'stable',
        avgChatQuality: 0,
        avgActionCompletion: 0,
        avgResponseTime: 0,
        totalInteractions: 0,
        qualityImprovement: 0,
        specialStatesAchieved: [],
        optimalPlanetaryHours: [],
        optimalMoonPhases: [],
      }
    }

    // Calculate averages
    const avgChatQuality = snapshots.reduce((sum, s) => sum + s.chatQuality, 0) / snapshots.length
    const avgActionCompletion =
      snapshots.reduce((sum, s) => sum + s.actionCompletion, 0) / snapshots.length
    const avgResponseTime = snapshots.reduce((sum, s) => sum + s.latencyMs, 0) / snapshots.length

    // Calculate quality improvement (first half vs second half)
    const midpoint = Math.floor(snapshots.length / 2)
    const firstHalfQuality =
      snapshots.slice(0, midpoint).reduce((sum, s) => sum + s.chatQuality, 0) / midpoint
    const secondHalfQuality =
      snapshots.slice(midpoint).reduce((sum, s) => sum + s.chatQuality, 0) /
      (snapshots.length - midpoint)
    const qualityImprovement = secondHalfQuality - firstHalfQuality

    // Determine velocity trend
    const velocities = snapshots.map(s => s.consciousnessVelocity)
    const velocityTrend = this.calculateTrend(velocities) as
      | 'accelerating'
      | 'steady'
      | 'decelerating'

    // Determine momentum trend
    const momentums = snapshots.map(s => s.interactionMomentum)
    const momentumTrend = this.calculateTrend(momentums) as 'building' | 'stable' | 'fading'

    // Find unique special states
    const specialStatesAchieved = Array.from(
      new Set(snapshots.flatMap(s => s.specialStates.map(state => state.name)))
    )

    // Find optimal planetary hours (highest avg quality)
    const hourQuality = new Map<string, { sum: number; count: number }>()
    snapshots.forEach(s => {
      const current = hourQuality.get(s.planetaryHour) || { sum: 0, count: 0 }
      hourQuality.set(s.planetaryHour, {
        sum: current.sum + s.chatQuality,
        count: current.count + 1,
      })
    })
    const optimalPlanetaryHours = Array.from(hourQuality.entries())
      .sort((a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count)
      .slice(0, 3)
      .map(([hour]) => hour)

    // Find optimal moon phases
    const phaseQuality = new Map<string, { sum: number; count: number }>()
    snapshots.forEach(s => {
      const current = phaseQuality.get(s.moonPhase) || { sum: 0, count: 0 }
      phaseQuality.set(s.moonPhase, {
        sum: current.sum + s.chatQuality,
        count: current.count + 1,
      })
    })
    const optimalMoonPhases = Array.from(phaseQuality.entries())
      .sort((a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count)
      .slice(0, 3)
      .map(([phase]) => phase)

    return {
      agentId,
      userId,
      timeRange: { start, end },
      velocityTrend,
      momentumTrend,
      avgChatQuality,
      avgActionCompletion,
      avgResponseTime,
      totalInteractions: snapshots.length,
      qualityImprovement,
      specialStatesAchieved,
      optimalPlanetaryHours,
      optimalMoonPhases,
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Calculate response quality from multiple factors
   * Replaces simple length-based heuristics
   */
  private calculateResponseQuality(
    response: string,
    userMessage: string,
    toolInvocations: Array<{ toolName: string; success: boolean }>
  ): number {
    let quality = 0.5 // Start at baseline

    // Length factor (but capped)
    const responseLength = response.length
    if (responseLength > 100) quality += 0.1
    if (responseLength > 300) quality += 0.1
    if (responseLength > 500) quality += 0.1

    // Tool usage factor
    if (toolInvocations.length > 0) {
      const successRate = toolInvocations.filter(t => t.success).length / toolInvocations.length
      quality += successRate * 0.2
    }

    // Engagement factor (questions, thoughtfulness)
    if (response.includes('?')) quality += 0.05
    if (response.includes('consider') || response.includes('reflect')) quality += 0.05
    if (response.includes('because') || response.includes('therefore') || response.includes('thus'))
      quality += 0.05

    return Math.min(1.0, quality)
  }

  /**
   * Calculate evolution metrics from agent state
   */
  private calculateEvolutionMetrics(
    agent: CraftedAgent,
    responseQuality: number,
    liveStats: LiveStats
  ): {
    velocity: number
    momentum: number
    trajectory: 'ascending' | 'stable' | 'fluctuating' | 'transcending'
    unlocks: string[]
  } {
    // Velocity based on quality and power
    const velocity = (responseQuality + liveStats.overall / 100) / 2

    // Momentum based on recent performance (simplified)
    const momentum = velocity * 0.9 // Would use historical comparison in full implementation

    // Trajectory based on velocity and momentum
    let trajectory: 'ascending' | 'stable' | 'fluctuating' | 'transcending'
    if (velocity > 0.8 && momentum > 0.8) trajectory = 'transcending'
    else if (velocity > 0.6) trajectory = 'ascending'
    else if (velocity > 0.4) trajectory = 'stable'
    else trajectory = 'fluctuating'

    // Power level unlocks
    const unlocks: string[] = []
    if (liveStats.power > 90) unlocks.push('Power Surge')
    if (liveStats.wisdom > 85 && liveStats.intuition > 80) unlocks.push('Akashic Access')
    if (liveStats.charisma > 90) unlocks.push('Magnetic Presence')

    return { velocity, momentum, trajectory, unlocks }
  }

  /**
   * Estimate action completion from response
   * In production, this would use LLM-as-judge
   */
  private estimateActionCompletion(response: string): number {
    if (response.length < 20) return 0.3
    if (response.includes('I apologize') || response.includes("I'm sorry")) return 0.5
    if (response.length > 100 && !response.includes("I don't know")) return 0.9
    return 0.7
  }

  /**
   * Calculate tool selection quality
   */
  private calculateToolQuality(
    toolInvocations: Array<{ toolName: string; success: boolean }>
  ): number {
    if (toolInvocations.length === 0) return 1.0 // No tools needed
    const successRate = toolInvocations.filter(t => t.success).length / toolInvocations.length
    return successRate
  }

  /**
   * Calculate trend from series of values
   */
  private calculateTrend(
    values: number[]
  ): 'accelerating' | 'steady' | 'decelerating' | 'building' | 'stable' | 'fading' {
    if (values.length < 2) return 'steady'

    const midpoint = Math.floor(values.length / 2)
    const firstHalf = values.slice(0, midpoint)
    const secondHalf = values.slice(midpoint)

    const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length

    const change = secondAvg - firstAvg

    if (Math.abs(change) < 0.05) return 'steady' // or 'stable'
    if (change > 0.15) return 'accelerating' // or 'building'
    if (change < -0.15) return 'decelerating' // or 'fading'
    if (change > 0) return 'accelerating' // or 'building'
    return 'decelerating' // or 'fading'
  }

  /**
   * Persist snapshot to database
   */
  private async persistSnapshot(snapshot: UnifiedConsciousnessSnapshot): Promise<void> {
    await prisma.consciousnessSnapshot.create({
      data: {
        // Identity
        timestamp: snapshot.timestamp,
        userId: snapshot.userId,
        agentId: snapshot.agentId,
        sessionId: snapshot.sessionId,

        // Objective Metrics
        interactionCount: snapshot.interactionCount,
        chatQuality: snapshot.chatQuality,
        momentResonance: snapshot.momentResonance,
        alchemicalCoherence: snapshot.alchemicalCoherence,

        // Live Stats
        power: snapshot.power,
        resonance: snapshot.resonance,
        wisdom: snapshot.wisdom,
        charisma: snapshot.charisma,
        intuition: snapshot.intuition,
        adaptability: snapshot.adaptability,
        vitality: snapshot.vitality,
        overall: snapshot.overall,

        // Alchemical
        spirit: snapshot.spirit,
        essence: snapshot.essence,
        matter: snapshot.matter,
        substance: snapshot.substance,
        aNumber: snapshot.aNumber,

        // Thermodynamics
        heat: snapshot.heat,
        entropy: snapshot.entropy,
        reactivity: snapshot.reactivity,
        energy: snapshot.energy,

        // Temporal Context
        planetaryHour: snapshot.planetaryHour,
        moonPhase: snapshot.moonPhase,
        activeModifiers: JSON.stringify(snapshot.activeModifiers),
        specialStates: JSON.stringify(snapshot.specialStates),

        // Evolution
        consciousnessVelocity: snapshot.consciousnessVelocity,
        interactionMomentum: snapshot.interactionMomentum,
        evolutionTrajectory: snapshot.evolutionTrajectory,
        powerLevelUnlocks: JSON.stringify(snapshot.powerLevelUnlocks),

        // Observability
        actionCompletion: snapshot.actionCompletion,
        toolSelectionQuality: snapshot.toolSelectionQuality,
        routingAccuracy: snapshot.routingAccuracy,
        contextRetention: snapshot.contextRetention,
        latencyMs: snapshot.latencyMs,

        // Interaction Context
        userMessage: snapshot.userMessage,
        agentResponsePreview: snapshot.agentResponsePreview,
        responseQuality: snapshot.responseQuality,
        modelUsed: snapshot.modelUsed,
        temperature: snapshot.temperature,
        tokensUsed: snapshot.tokensUsed || 0,
      },
    })
  }

  /**
   * Deserialize database record to snapshot
   */
  private deserializeSnapshot(record: any): UnifiedConsciousnessSnapshot {
    return {
      timestamp: record.timestamp,
      userId: record.userId,
      agentId: record.agentId,
      sessionId: record.sessionId,

      interactionCount: record.interactionCount,
      chatQuality: record.chatQuality,
      momentResonance: record.momentResonance,
      alchemicalCoherence: record.alchemicalCoherence,

      power: record.power,
      resonance: record.resonance,
      wisdom: record.wisdom,
      charisma: record.charisma,
      intuition: record.intuition,
      adaptability: record.adaptability,
      vitality: record.vitality,
      overall: record.overall,

      spirit: record.spirit,
      essence: record.essence,
      matter: record.matter,
      substance: record.substance,
      aNumber: record.aNumber,

      heat: record.heat,
      entropy: record.entropy,
      reactivity: record.reactivity,
      energy: record.energy,

      planetaryHour: record.planetaryHour,
      moonPhase: record.moonPhase,
      activeModifiers: JSON.parse(record.activeModifiers),
      specialStates: JSON.parse(record.specialStates),

      consciousnessVelocity: record.consciousnessVelocity,
      interactionMomentum: record.interactionMomentum,
      evolutionTrajectory: record.evolutionTrajectory,
      powerLevelUnlocks: JSON.parse(record.powerLevelUnlocks),

      actionCompletion: record.actionCompletion,
      toolSelectionQuality: record.toolSelectionQuality,
      routingAccuracy: record.routingAccuracy,
      contextRetention: record.contextRetention,
      latencyMs: record.latencyMs,

      userMessage: record.userMessage,
      agentResponsePreview: record.agentResponsePreview,
      responseQuality: record.responseQuality,
      modelUsed: record.modelUsed,
      temperature: record.temperature,
      tokensUsed: record.tokensUsed,
    }
  }
}

// Singleton instance for application-wide use
export const unifiedTracker = new UnifiedConsciousnessTracker()
