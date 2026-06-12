/**
 * RAG Analytics System
 * Tracks RAG usage, performance, and effectiveness metrics
 */

export interface RAGQueryLog {
  id: string
  timestamp: Date
  agentId: string
  agentName: string
  query: string
  queryLength: number
  ragUsed: boolean
  sourcesRetrieved: number
  retrievalTime: number
  generationTime?: number
  totalTime: number
  success: boolean
  error?: string
  relevanceScores: number[]
  averageRelevance: number
  sessionId: string
  userId?: string
  cacheHit?: boolean
  cacheLatency?: number
}

export interface RAGAnalytics {
  totalQueries: number
  ragEnabledQueries: number
  ragUsageRate: number
  totalSources: number
  avgSourcesPerQuery: number
  avgRetrievalTime: number
  avgGenerationTime: number
  avgTotalTime: number
  avgRelevanceScore: number
  successRate: number
  errorRate: number
  cacheHitRate: number
  cacheHits: number
  cacheMisses: number
  avgCacheLatency: number
  avgCachedResponseTime: number
  avgUncachedResponseTime: number
  topAgents: Array<{ agentId: string; agentName: string; queryCount: number }>
  topDocuments: Array<{ documentId: string; retrievalCount: number }>
  performanceTrend: Array<{ date: string; avgTime: number; queryCount: number }>
  relevanceTrend: Array<{ date: string; avgRelevance: number }>
}

class RAGAnalyticsManager {
  private logs: RAGQueryLog[] = []
  private maxLogs = 10000 // Keep last 10k logs in memory

  /**
   * Log a RAG query
   * Returns the generated query ID for linking feedback
   */
  logQuery(log: Omit<RAGQueryLog, 'id' | 'timestamp'>, sources?: any[]): string {
    const queryLog: RAGQueryLog = {
      ...log,
      id: this.generateId(),
      timestamp: new Date(),
    }

    this.logs.push(queryLog)

    // Trim logs if exceeds max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Persist to localStorage for client-side tracking
    if (typeof window !== 'undefined') {
      try {
        const recentLogs = this.logs.slice(-100) // Keep last 100 in localStorage
        localStorage.setItem('rag-analytics-logs', JSON.stringify(recentLogs))
      } catch (error) {
        console.warn('[RAGAnalytics] Failed to persist to localStorage:', error)
      }

      // Also persist to database via API (async, non-blocking)
      this.persistToDatabase(log, sources).catch(error => {
        console.warn('[RAGAnalytics] Failed to persist to database:', error)
      })
    }

    // Return query ID for feedback linking
    return queryLog.id
  }

  /**
   * Persist log to database via API
   */
  private async persistToDatabase(
    log: Omit<RAGQueryLog, 'id' | 'timestamp'>,
    sources?: any[]
  ): Promise<void> {
    if (typeof window === 'undefined') return

    try {
      const response = await fetch('/api/rag/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...log,
          sources,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Failed to persist analytics')
      }
    } catch (error) {
      // Silent fail - localStorage is backup
      console.warn('[RAGAnalytics] Database persistence failed:', error)
    }
  }

  /**
   * Get analytics summary
   */
  getAnalytics(timeRange?: { start: Date; end: Date }): RAGAnalytics {
    let filteredLogs = this.logs

    // Filter by time range if provided
    if (timeRange) {
      filteredLogs = this.logs.filter(
        log => log.timestamp >= timeRange.start && log.timestamp <= timeRange.end
      )
    }

    const totalQueries = filteredLogs.length
    const ragEnabledQueries = filteredLogs.filter(log => log.ragUsed).length
    const successfulQueries = filteredLogs.filter(log => log.success).length

    // Calculate averages
    const avgSourcesPerQuery =
      filteredLogs.reduce((sum, log) => sum + log.sourcesRetrieved, 0) / totalQueries || 0
    const avgRetrievalTime =
      filteredLogs.reduce((sum, log) => sum + log.retrievalTime, 0) / totalQueries || 0
    const avgGenerationTime =
      filteredLogs
        .filter(log => log.generationTime)
        .reduce((sum, log) => sum + (log.generationTime || 0), 0) /
        filteredLogs.filter(log => log.generationTime).length || 0
    const avgTotalTime =
      filteredLogs.reduce((sum, log) => sum + log.totalTime, 0) / totalQueries || 0
    const avgRelevanceScore =
      filteredLogs.reduce((sum, log) => sum + log.averageRelevance, 0) / totalQueries || 0

    // Calculate cache metrics
    const cacheHits = filteredLogs.filter(log => log.cacheHit === true).length
    const cacheMisses = filteredLogs.filter(log => log.cacheHit === false).length
    const cacheHitRate = totalQueries > 0 ? cacheHits / totalQueries : 0

    const cachedQueries = filteredLogs.filter(log => log.cacheHit === true)
    const uncachedQueries = filteredLogs.filter(log => log.cacheHit === false)

    const avgCacheLatency =
      cachedQueries.length > 0
        ? cachedQueries.reduce((sum, log) => sum + (log.cacheLatency || 0), 0) /
          cachedQueries.length
        : 0

    const avgCachedResponseTime =
      cachedQueries.length > 0
        ? cachedQueries.reduce((sum, log) => sum + log.totalTime, 0) / cachedQueries.length
        : 0

    const avgUncachedResponseTime =
      uncachedQueries.length > 0
        ? uncachedQueries.reduce((sum, log) => sum + log.totalTime, 0) / uncachedQueries.length
        : 0

    // Top agents
    const agentCounts = new Map<string, { name: string; count: number }>()
    filteredLogs.forEach(log => {
      const existing = agentCounts.get(log.agentId)
      if (existing) {
        existing.count++
      } else {
        agentCounts.set(log.agentId, { name: log.agentName, count: 1 })
      }
    })
    const topAgents = Array.from(agentCounts.entries())
      .map(([agentId, { name, count }]) => ({
        agentId,
        agentName: name,
        queryCount: count,
      }))
      .sort((a, b) => b.queryCount - a.queryCount)
      .slice(0, 10)

    // Performance trend (group by day)
    const dailyStats = this.groupByDay(filteredLogs)
    const performanceTrend = dailyStats.map(({ date, logs }) => ({
      date,
      avgTime: logs.reduce((sum, log) => sum + log.totalTime, 0) / logs.length,
      queryCount: logs.length,
    }))

    const relevanceTrend = dailyStats.map(({ date, logs }) => ({
      date,
      avgRelevance: logs.reduce((sum, log) => sum + log.averageRelevance, 0) / logs.length,
    }))

    return {
      totalQueries,
      ragEnabledQueries,
      ragUsageRate: totalQueries > 0 ? ragEnabledQueries / totalQueries : 0,
      totalSources: filteredLogs.reduce((sum, log) => sum + log.sourcesRetrieved, 0),
      avgSourcesPerQuery,
      avgRetrievalTime,
      avgGenerationTime,
      avgTotalTime,
      avgRelevanceScore,
      successRate: totalQueries > 0 ? successfulQueries / totalQueries : 0,
      errorRate: totalQueries > 0 ? (totalQueries - successfulQueries) / totalQueries : 0,
      cacheHitRate,
      cacheHits,
      cacheMisses,
      avgCacheLatency,
      avgCachedResponseTime,
      avgUncachedResponseTime,
      topAgents,
      topDocuments: [], // Would need document-level tracking
      performanceTrend,
      relevanceTrend,
    }
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit = 50): RAGQueryLog[] {
    return this.logs.slice(-limit).reverse()
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = []
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rag-analytics-logs')
    }
  }

  /**
   * Load logs from localStorage
   */
  loadFromStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('rag-analytics-logs')
        if (stored) {
          const logs = JSON.parse(stored) as RAGQueryLog[]
          // Convert timestamp strings back to Date objects
          this.logs = logs.map(log => ({
            ...log,
            timestamp: new Date(log.timestamp),
          }))
        }
      } catch (error) {
        console.warn('[RAGAnalytics] Failed to load from localStorage:', error)
      }
    }
  }

  private generateId(): string {
    return `rag-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  private groupByDay(logs: RAGQueryLog[]): Array<{ date: string; logs: RAGQueryLog[] }> {
    const groups = new Map<string, RAGQueryLog[]>()

    logs.forEach(log => {
      const dateKey = log.timestamp.toISOString().split('T')[0]
      const existing = groups.get(dateKey)
      if (existing) {
        existing.push(log)
      } else {
        groups.set(dateKey, [log])
      }
    })

    return Array.from(groups.entries())
      .map(([date, logs]) => ({ date, logs }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
}

// Singleton instance
export const ragAnalytics = new RAGAnalyticsManager()

// Auto-load from storage on initialization
if (typeof window !== 'undefined') {
  ragAnalytics.loadFromStorage()
}
