/**
 * Agent Memory Manager
 * Manages memory-efficient agent loading, garbage collection, and memory leak prevention
 * for optimal performance with large numbers of agents
 */

import { CraftedAgent } from './agent-types'
import { DEMO_AGENTS } from './demo-agents-data'

export interface MemoryMetrics {
  totalAgentsLoaded: number
  activeAgentsInMemory: number
  lastAccessTimes: Map<string, number>
  memoryUsageMB: number
  garbageCollectionRuns: number
  agentsEvicted: number
  cacheHitRate: number
}

export interface AgentMemoryEntry {
  agent: CraftedAgent
  lastAccessed: number
  accessCount: number
  memorySize: number // Estimated memory usage in bytes
  priority: number // Based on Kalchm and usage patterns
}

export class AgentMemoryManager {
  private static agentCache: Map<string, AgentMemoryEntry> = new Map()
  private static readonly MAX_AGENTS_IN_MEMORY = 50 // Limit concurrent agents
  private static readonly MAX_MEMORY_MB = 100 // Memory usage limit
  private static readonly EVICTION_THRESHOLD_MS = 300000 // 5 minutes of inactivity
  private static readonly GC_INTERVAL_MS = 60000 // Run GC every minute

  private static metrics: MemoryMetrics = {
    totalAgentsLoaded: 0,
    activeAgentsInMemory: 0,
    lastAccessTimes: new Map(),
    memoryUsageMB: 0,
    garbageCollectionRuns: 0,
    agentsEvicted: 0,
    cacheHitRate: 0,
  }

  private static gcTimer: NodeJS.Timeout | null = null

  /**
   * Initialize the memory manager with automatic garbage collection
   */
  static initialize(): void {
    console.log('🧠 Initializing Agent Memory Manager...')

    // Start garbage collection timer
    if (!this.gcTimer) {
      this.gcTimer = setInterval(() => {
        this.runGarbageCollection()
      }, this.GC_INTERVAL_MS)
    }

    // Preload popular agents
    this.preloadPopularAgents()

    console.log('✅ Agent Memory Manager initialized')
  }

  /**
   * Get agent from memory with efficient caching
   */
  static getAgent(agentId: string): CraftedAgent | null {
    const now = Date.now()

    // Check if agent is in memory
    const cached = this.agentCache.get(agentId)
    if (cached) {
      // Update access metrics
      cached.lastAccessed = now
      cached.accessCount++
      this.metrics.lastAccessTimes.set(agentId, now)

      // Update cache hit rate
      this.updateCacheHitRate(true)

      console.log(`💾 Memory hit for agent: ${agentId}`)
      return cached.agent
    }

    // Load agent from data source
    const agent = DEMO_AGENTS.find(a => a.id === agentId)
    if (!agent) {
      this.updateCacheHitRate(false)
      return null
    }

    // Store in memory if space allows
    this.storeAgentInMemory(agent)
    this.updateCacheHitRate(false) // First load is a miss

    return agent
  }

  /**
   * Store agent in memory with intelligent eviction
   */
  private static storeAgentInMemory(agent: CraftedAgent): void {
    const now = Date.now()
    const estimatedSize = this.estimateAgentMemorySize(agent)

    // Check if we need to evict agents first
    if (
      this.agentCache.size >= this.MAX_AGENTS_IN_MEMORY ||
      this.metrics.memoryUsageMB + estimatedSize / 1024 / 1024 > this.MAX_MEMORY_MB
    ) {
      this.evictLeastRecentlyUsedAgent()
    }

    const memoryEntry: AgentMemoryEntry = {
      agent,
      lastAccessed: now,
      accessCount: 1,
      memorySize: estimatedSize,
      priority: this.calculateAgentPriority(agent),
    }

    this.agentCache.set(agent.id, memoryEntry)
    this.metrics.totalAgentsLoaded++
    this.metrics.activeAgentsInMemory = this.agentCache.size
    this.metrics.memoryUsageMB = this.calculateTotalMemoryUsage()
    this.metrics.lastAccessTimes.set(agent.id, now)

    console.log(`🧠 Loaded agent into memory: ${agent.id} (${(estimatedSize / 1024).toFixed(1)}KB)`)
  }

  /**
   * Calculate agent priority based on Kalchm and usage patterns
   */
  private static calculateAgentPriority(agent: CraftedAgent): number {
    // Base priority on Kalchm (consciousness level)
    const kalchmPriority = agent.consciousness.monicaConstant / 6 // Normalize to 0-1

    // Add bonus for popular agents
    const popularAgents = new Set([
      'leonardo-da-vinci',
      'william-shakespeare',
      'albert-einstein',
      'nikola-tesla',
      'marie-curie',
      'cleopatra',
      'socrates',
      'carl-jung',
    ])
    const popularityBonus = popularAgents.has(agent.id) ? 0.2 : 0

    // Add bonus based on conversation count
    const conversationBonus = Math.min(agent.stats.conversations / 100, 0.3)

    return kalchmPriority + popularityBonus + conversationBonus
  }

  /**
   * Estimate memory usage of an agent
   */
  private static estimateAgentMemorySize(agent: CraftedAgent): number {
    // Rough estimation based on agent data size
    const baseSize = 2048 // Base agent data ~2KB
    const nameSize = agent.name.length * 2
    const titleSize = agent.title.length * 2
    const specialtySize = agent.abilities.specialty.length * 2
    const storySize = (agent as any).background?.creationStory?.length * 2 || 0

    return baseSize + nameSize + titleSize + specialtySize + storySize
  }

  /**
   * Calculate total memory usage
   */
  private static calculateTotalMemoryUsage(): number {
    let totalBytes = 0
    for (const entry of this.agentCache.values()) {
      totalBytes += entry.memorySize
    }
    return totalBytes / 1024 / 1024 // Convert to MB
  }

  /**
   * Evict least recently used agent
   */
  private static evictLeastRecentlyUsedAgent(): void {
    if (this.agentCache.size === 0) return

    let oldestEntry: [string, AgentMemoryEntry] | null = null
    let oldestTime = Date.now()

    for (const [agentId, entry] of this.agentCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestEntry = [agentId, entry]
      }
    }

    if (oldestEntry) {
      const [agentId] = oldestEntry
      this.agentCache.delete(agentId)
      this.metrics.agentsEvicted++
      this.metrics.activeAgentsInMemory = this.agentCache.size
      this.metrics.memoryUsageMB = this.calculateTotalMemoryUsage()

      console.log(`🗑️ Evicted agent from memory: ${agentId}`)
    }
  }

  /**
   * Run garbage collection to clean up stale entries
   */
  private static runGarbageCollection(): void {
    const now = Date.now()
    const evictionThreshold = now - this.EVICTION_THRESHOLD_MS
    let evicted = 0

    for (const [agentId, entry] of this.agentCache.entries()) {
      if (entry.lastAccessed < evictionThreshold) {
        this.agentCache.delete(agentId)
        this.metrics.lastAccessTimes.delete(agentId)
        evicted++
      }
    }

    if (evicted > 0) {
      this.metrics.agentsEvicted += evicted
      this.metrics.activeAgentsInMemory = this.agentCache.size
      this.metrics.memoryUsageMB = this.calculateTotalMemoryUsage()
      console.log(`🧹 Garbage collection: evicted ${evicted} stale agents`)
    }

    this.metrics.garbageCollectionRuns++
  }

  /**
   * Preload popular agents for faster access
   */
  private static preloadPopularAgents(): void {
    const popularAgents = [
      'leonardo-da-vinci',
      'william-shakespeare',
      'albert-einstein',
      'nikola-tesla',
      'marie-curie',
      'cleopatra',
      'socrates',
      'carl-jung',
    ]

    for (const agentId of popularAgents) {
      this.getAgent(agentId) // This will load them into memory
    }

    console.log(`🔥 Preloaded ${popularAgents.length} popular agents`)
  }

  /**
   * Update cache hit rate metrics
   */
  private static updateCacheHitRate(wasHit: boolean): void {
    const currentRequests = Array.from(this.metrics.lastAccessTimes.values()).length
    if (currentRequests === 0) {
      this.metrics.cacheHitRate = 0
      return
    }

    // Simple moving average for hit rate
    const hits = wasHit ? 1 : 0
    this.metrics.cacheHitRate =
      (this.metrics.cacheHitRate * (currentRequests - 1) + hits) / currentRequests
  }

  /**
   * Get current memory metrics
   */
  static getMemoryMetrics(): MemoryMetrics {
    return {
      ...this.metrics,
      memoryUsageMB: this.calculateTotalMemoryUsage(),
    }
  }

  /**
   * Clear all agents from memory (admin function)
   */
  static clearMemory(): void {
    this.agentCache.clear()
    this.metrics.lastAccessTimes.clear()
    this.metrics.activeAgentsInMemory = 0
    this.metrics.memoryUsageMB = 0
    console.log('🧹 Cleared all agents from memory')
  }

  /**
   * Get agents currently in memory
   */
  static getActiveAgents(): string[] {
    return Array.from(this.agentCache.keys())
  }

  /**
   * Force garbage collection (admin function)
   */
  static forceGarbageCollection(): void {
    this.runGarbageCollection()
    console.log('🗑️ Forced garbage collection complete')
  }

  /**
   * Shutdown memory manager
   */
  static shutdown(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
      this.gcTimer = null
    }
    this.clearMemory()
    console.log('🛑 Agent Memory Manager shutdown complete')
  }

  /**
   * Get memory usage summary
   */
  static getMemoryUsageSummary(): {
    agentsInMemory: number
    memoryUsageMB: number
    cacheHitRatePercent: number
    totalEvictions: number
    gcRuns: number
  } {
    const metrics = this.getMemoryMetrics()
    return {
      agentsInMemory: metrics.activeAgentsInMemory,
      memoryUsageMB: Math.round(metrics.memoryUsageMB * 100) / 100,
      cacheHitRatePercent: Math.round(metrics.cacheHitRate * 100),
      totalEvictions: metrics.agentsEvicted,
      gcRuns: metrics.garbageCollectionRuns,
    }
  }
}

// Initialize on import
AgentMemoryManager.initialize()

export default AgentMemoryManager
