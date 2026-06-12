/**
 * Time Laboratory Performance Optimization System
 * ==============================================
 *
 * Advanced caching, query optimization, and performance monitoring
 * for the Time Laboratory temporal analysis system.
 */

export interface PerformanceMetrics {
  queryTime: number
  cacheHitRate: number
  memoryUsage: number
  activeConnections: number
  averageResponseTime: number
  patternDetectionTime: number
  elementalCalculationTime: number
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
  hitCount: number
  size: number
}

export interface QueryOptimizationHint {
  useIndex?: string[]
  preferCache?: boolean
  batchSize?: number
  timeWindowMs?: number
  elementalFilter?: string[]
  degreeRange?: [number, number]
}

/**
 * Advanced caching system with intelligent eviction and prefetching
 */
export class TemporalAnalysisCache {
  private cache = new Map<string, CacheEntry<any>>()
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalQueries: 0,
  }
  private readonly maxSize: number
  private readonly defaultTTL: number

  constructor(maxSize = 1000, defaultTTL = 300000) {
    // 5 minutes default
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL

    // Cleanup interval
    setInterval(() => this.cleanup(), 60000) // Every minute
  }

  generateKey(query: any, options?: any): string {
    const keyData = {
      query: query.query,
      type: query.type,
      agents: query.agents?.sort(),
      elements: query.elements?.sort(),
      degrees: query.degrees?.sort(),
      dateRange: query.dateRange,
      reinforcementMode: query.reinforcementMode,
      granularity: query.granularity,
      options,
    }
    return Buffer.from(JSON.stringify(keyData)).toString('base64')
  }

  async get<T>(key: string): Promise<T | null> {
    this.metrics.totalQueries++

    const entry = this.cache.get(key)
    if (!entry) {
      this.metrics.misses++
      return null
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.metrics.misses++
      return null
    }

    entry.hitCount++
    this.metrics.hits++
    return entry.data
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const expiresAt = Date.now() + (ttl || this.defaultTTL)
    const size = this.estimateSize(data)

    // Evict if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed()
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt,
      hitCount: 0,
      size,
    })
  }

  private estimateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch {
      return 1024 // Fallback estimate
    }
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey = ''
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.metrics.evictions++
    }
  }

  private cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key))
  }

  getMetrics(): typeof this.metrics & { hitRate: number; size: number } {
    return {
      ...this.metrics,
      hitRate: this.metrics.totalQueries > 0 ? this.metrics.hits / this.metrics.totalQueries : 0,
      size: this.cache.size,
    }
  }

  clear(): void {
    this.cache.clear()
    this.metrics = { hits: 0, misses: 0, evictions: 0, totalQueries: 0 }
  }
}

/**
 * Query optimization engine for temporal analysis
 */
export class QueryOptimizer {
  private queryStats = new Map<
    string,
    {
      executionTimes: number[]
      lastOptimized: number
      effectiveHints: QueryOptimizationHint[]
    }
  >()

  analyzeQuery(query: any): QueryOptimizationHint {
    const hints: QueryOptimizationHint = {}

    // Optimize based on query characteristics
    if (query.agents && query.agents.length > 10) {
      hints.batchSize = 5 // Process in smaller batches
    }

    if (query.dateRange) {
      const range =
        new Date(query.dateRange.end).getTime() - new Date(query.dateRange.start).getTime()
      const days = range / (1000 * 60 * 60 * 24)

      if (days > 365) {
        hints.timeWindowMs = 7 * 24 * 60 * 60 * 1000 // Weekly windows for large ranges
      } else if (days > 30) {
        hints.timeWindowMs = 24 * 60 * 60 * 1000 // Daily windows for monthly ranges
      }
    }

    // Suggest caching for expensive queries
    if (query.type === 'natural_language' || query.reinforcementMode) {
      hints.preferCache = true
    }

    // Optimize degree ranges
    if (query.degrees && query.degrees.length > 0) {
      const min = Math.min(...query.degrees)
      const max = Math.max(...query.degrees)
      hints.degreeRange = [min, max]
    }

    // Element filtering optimization
    if (query.elements && query.elements.length < 4) {
      hints.elementalFilter = query.elements
    }

    return hints
  }

  recordExecution(queryKey: string, executionTime: number, hints: QueryOptimizationHint): void {
    if (!this.queryStats.has(queryKey)) {
      this.queryStats.set(queryKey, {
        executionTimes: [],
        lastOptimized: Date.now(),
        effectiveHints: [],
      })
    }

    const stats = this.queryStats.get(queryKey)!
    stats.executionTimes.push(executionTime)

    // Keep only last 10 execution times
    if (stats.executionTimes.length > 10) {
      stats.executionTimes.shift()
    }

    // Track effective hints
    if (executionTime < this.getAverageExecutionTime(queryKey)) {
      stats.effectiveHints.push(hints)
    }
  }

  private getAverageExecutionTime(queryKey: string): number {
    const stats = this.queryStats.get(queryKey)
    if (!stats || stats.executionTimes.length === 0) return 0
    return stats.executionTimes.reduce((a, b) => a + b, 0) / stats.executionTimes.length
  }

  getOptimizationRecommendations(queryKey: string): QueryOptimizationHint {
    const stats = this.queryStats.get(queryKey)
    if (!stats || stats.effectiveHints.length === 0) {
      return {}
    }

    // Merge effective hints
    const mergedHints: QueryOptimizationHint = {}

    stats.effectiveHints.forEach(hint => {
      if (hint.batchSize && !mergedHints.batchSize) {
        mergedHints.batchSize = hint.batchSize
      }
      if (hint.preferCache) {
        mergedHints.preferCache = true
      }
      if (hint.timeWindowMs && !mergedHints.timeWindowMs) {
        mergedHints.timeWindowMs = hint.timeWindowMs
      }
    })

    return mergedHints
  }
}

/**
 * Performance monitoring system
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    queryTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    activeConnections: 0,
    averageResponseTime: 0,
    patternDetectionTime: 0,
    elementalCalculationTime: 0,
  }

  private responseTimes: number[] = []
  private patternDetectionTimes: number[] = []
  private elementalCalculationTimes: number[] = []

  recordQueryTime(time: number): void {
    this.metrics.queryTime = time
    this.responseTimes.push(time)

    // Keep only last 100 response times
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift()
    }

    this.updateAverageResponseTime()
  }

  recordPatternDetectionTime(time: number): void {
    this.metrics.patternDetectionTime = time
    this.patternDetectionTimes.push(time)

    if (this.patternDetectionTimes.length > 50) {
      this.patternDetectionTimes.shift()
    }
  }

  recordElementalCalculationTime(time: number): void {
    this.metrics.elementalCalculationTime = time
    this.elementalCalculationTimes.push(time)

    if (this.elementalCalculationTimes.length > 50) {
      this.elementalCalculationTimes.shift()
    }
  }

  updateCacheHitRate(hitRate: number): void {
    this.metrics.cacheHitRate = hitRate
  }

  updateMemoryUsage(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      this.metrics.memoryUsage = usage.heapUsed / 1024 / 1024 // MB
    }
  }

  updateActiveConnections(count: number): void {
    this.metrics.activeConnections = count
  }

  private updateAverageResponseTime(): void {
    if (this.responseTimes.length === 0) return
    this.metrics.averageResponseTime =
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
  }

  getMetrics(): PerformanceMetrics {
    this.updateMemoryUsage()
    return { ...this.metrics }
  }

  getDetailedMetrics() {
    return {
      ...this.getMetrics(),
      responseTimePercentiles: this.calculatePercentiles(this.responseTimes),
      patternDetectionPercentiles: this.calculatePercentiles(this.patternDetectionTimes),
      elementalCalculationPercentiles: this.calculatePercentiles(this.elementalCalculationTimes),
      trendAnalysis: this.analyzeTrends(),
    }
  }

  private calculatePercentiles(values: number[]) {
    if (values.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0 }

    const sorted = [...values].sort((a, b) => a - b)
    const len = sorted.length

    return {
      p50: sorted[Math.floor(len * 0.5)],
      p90: sorted[Math.floor(len * 0.9)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
    }
  }

  private analyzeTrends() {
    const recentResponseTimes = this.responseTimes.slice(-20)
    const olderResponseTimes = this.responseTimes.slice(0, 20)

    if (recentResponseTimes.length === 0 || olderResponseTimes.length === 0) {
      return { trend: 'insufficient_data', improvement: 0 }
    }

    const recentAvg = recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length
    const olderAvg = olderResponseTimes.reduce((a, b) => a + b, 0) / olderResponseTimes.length

    const improvement = ((olderAvg - recentAvg) / olderAvg) * 100

    return {
      trend: improvement > 5 ? 'improving' : improvement < -5 ? 'degrading' : 'stable',
      improvement: Math.round(improvement * 100) / 100,
    }
  }

  generatePerformanceReport(): string {
    const metrics = this.getDetailedMetrics()

    return `
Time Laboratory Performance Report
=================================
Generated: ${new Date().toISOString()}

Core Metrics:
- Average Response Time: ${Math.round(metrics.averageResponseTime)}ms
- Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%
- Memory Usage: ${metrics.memoryUsage.toFixed(1)}MB
- Active Connections: ${metrics.activeConnections}

Performance Percentiles:
- Response Time P95: ${Math.round(metrics.responseTimePercentiles.p95)}ms
- Pattern Detection P95: ${Math.round(metrics.patternDetectionPercentiles.p95)}ms
- Elemental Calculation P95: ${Math.round(metrics.elementalCalculationPercentiles.p95)}ms

Trend Analysis:
- Performance Trend: ${metrics.trendAnalysis.trend}
- Performance Change: ${metrics.trendAnalysis.improvement > 0 ? '+' : ''}${metrics.trendAnalysis.improvement}%

Recommendations:
${this.generateRecommendations(metrics)}
    `.trim()
  }

  private generateRecommendations(metrics: any): string {
    const recommendations: string[] = []

    if (metrics.cacheHitRate < 0.7) {
      recommendations.push('- Consider increasing cache TTL or implementing smarter prefetching')
    }

    if (metrics.averageResponseTime > 2000) {
      recommendations.push('- Response times are high, consider query optimization or scaling')
    }

    if (metrics.memoryUsage > 500) {
      recommendations.push('- High memory usage detected, consider implementing memory cleanup')
    }

    if (metrics.trendAnalysis.trend === 'degrading') {
      recommendations.push('- Performance is degrading, investigate recent changes')
    }

    if (recommendations.length === 0) {
      recommendations.push('- Performance is within acceptable ranges')
    }

    return recommendations.join('\n')
  }
}

// Singleton instances for global use
export const globalCache = new TemporalAnalysisCache()
export const globalQueryOptimizer = new QueryOptimizer()
export const globalPerformanceMonitor = new PerformanceMonitor()

/**
 * Decorator for automatic performance monitoring
 */
export function monitorPerformance(
  target: any,
  propertyName: string,
  descriptor: PropertyDescriptor
) {
  const method = descriptor.value

  descriptor.value = async function (...args: any[]) {
    const start = performance.now()

    try {
      const result = await method.apply(this, args)
      const duration = performance.now() - start

      globalPerformanceMonitor.recordQueryTime(duration)

      return result
    } catch (error) {
      const duration = performance.now() - start
      globalPerformanceMonitor.recordQueryTime(duration)
      throw error
    }
  }

  return descriptor
}

/**
 * Utility for measuring specific operations
 */
export async function measureOperation<T>(
  operation: () => Promise<T>,
  operationType: 'query' | 'pattern' | 'elemental'
): Promise<T> {
  const start = performance.now()

  try {
    const result = await operation()
    const duration = performance.now() - start

    switch (operationType) {
      case 'query':
        globalPerformanceMonitor.recordQueryTime(duration)
        break
      case 'pattern':
        globalPerformanceMonitor.recordPatternDetectionTime(duration)
        break
      case 'elemental':
        globalPerformanceMonitor.recordElementalCalculationTime(duration)
        break
    }

    return result
  } catch (error) {
    const duration = performance.now() - start

    // Still record the time even on error
    switch (operationType) {
      case 'query':
        globalPerformanceMonitor.recordQueryTime(duration)
        break
      case 'pattern':
        globalPerformanceMonitor.recordPatternDetectionTime(duration)
        break
      case 'elemental':
        globalPerformanceMonitor.recordElementalCalculationTime(duration)
        break
    }

    throw error
  }
}
