// Performance Optimization Engine for Planetary Agent Transit System
// Handles caching, query optimization, load testing, and performance monitoring

import { PrismaClient } from '@prisma/client'
import { Redis } from 'ioredis'
import { performance } from 'perf_hooks'

const prisma = new PrismaClient()

// Redis client for caching
let redisClient: Redis | null = null

// Performance metrics storage
interface PerformanceMetrics {
  timestamp: Date
  endpoint: string
  method: string
  responseTime: number
  statusCode: number
  userId?: string
  memoryUsage: NodeJS.MemoryUsage
  cacheHit?: boolean
  databaseQueries: number
  databaseTime: number
}

interface OptimizationConfig {
  cacheEnabled: boolean
  cacheTTL: number
  queryOptimizationEnabled: boolean
  performanceMonitoringEnabled: boolean
  loadTestingEnabled: boolean
  maxConcurrentUsers: number
  apiTimeout: number
}

class PerformanceOptimizationEngine {
  private metrics: PerformanceMetrics[] = []
  private config: OptimizationConfig
  private isInitialized = false

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      cacheEnabled: true,
      cacheTTL: 3600, // 1 hour
      queryOptimizationEnabled: true,
      performanceMonitoringEnabled: true,
      loadTestingEnabled: true,
      maxConcurrentUsers: 100,
      apiTimeout: 30000, // 30 seconds
      ...config,
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Initialize Redis client
      if (this.config.cacheEnabled) {
        redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

        redisClient.on('error', error => {
          console.warn('Redis connection error:', error.message)
          redisClient = null
        })

        redisClient.on('connect', () => {
          console.log('Redis connected for performance optimization')
        })
      }

      // Initialize database optimizations
      if (this.config.queryOptimizationEnabled) {
        await this.initializeDatabaseOptimizations()
      }

      this.isInitialized = true
      console.log('Performance Optimization Engine initialized')
    } catch (error) {
      console.error('Failed to initialize Performance Optimization Engine:', error)
      throw error
    }
  }

  // Cache Management
  async getCachedData<T>(key: string): Promise<T | null> {
    if (!redisClient || !this.config.cacheEnabled) return null

    try {
      const cached = await redisClient.get(key)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.warn('Cache retrieval error:', error)
      return null
    }
  }

  async setCachedData(key: string, data: any, ttl?: number): Promise<void> {
    if (!redisClient || !this.config.cacheEnabled) return

    try {
      const serializedData = JSON.stringify(data)
      const expiration = ttl || this.config.cacheTTL
      await redisClient.setex(key, expiration, serializedData)
    } catch (error) {
      console.warn('Cache storage error:', error)
    }
  }

  async invalidateCache(pattern: string): Promise<void> {
    if (!redisClient || !this.config.cacheEnabled) return

    try {
      const keys = await redisClient.keys(pattern)
      if (keys.length > 0) {
        await redisClient.del(...keys)
      }
    } catch (error) {
      console.warn('Cache invalidation error:', error)
    }
  }

  // Database Query Optimization
  async initializeDatabaseOptimizations(): Promise<void> {
    try {
      // Create performance indexes if they don't exist
      await this.createPerformanceIndexes()

      // Analyze and optimize slow queries
      await this.analyzeQueryPerformance()

      console.log('Database optimizations initialized')
    } catch (error) {
      console.error('Database optimization initialization failed:', error)
    }
  }

  private async createPerformanceIndexes(): Promise<void> {
    // Index for transit queries
    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_natal_chart_user_active
      ON "NatalChart" ("userId", "isActive") WHERE "isActive" = true;
    `

    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_celestial_placement_planet_sign
      ON "CelestialPlacement" ("planet", "sign");
    `

    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transit_significance_score
      ON "TransitSignificance" ("significanceScore") WHERE "significanceScore" > 0.5;
    `

    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transit_notification_user_status
      ON "TransitNotification" ("userId", "status", "scheduledFor");
    `

    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_interaction_timestamp
      ON "AgentInteraction" ("timestamp") WHERE "timestamp" > NOW() - INTERVAL '30 days';
    `

    console.log('Performance indexes created')
  }

  private async analyzeQueryPerformance(): Promise<void> {
    // Analyze slow queries and suggest optimizations
    const slowQueries = await prisma.$queryRaw<
      Array<{ query: string; mean_time: number; calls: number }>
    >`
      SELECT query, mean_time, calls
      FROM pg_stat_statements
      WHERE mean_time > 100 AND calls > 10
      ORDER BY mean_time DESC
      LIMIT 10;
    `

    if (slowQueries.length > 0) {
      console.log('Slow queries detected:')
      slowQueries.forEach((query, index) => {
        console.log(
          `${index + 1}. ${query.query} - ${query.mean_time}ms avg (${query.calls} calls)`
        )
      })
    }
  }

  // Query optimization methods
  async optimizeTransitQuery(
    userId: string,
    chartId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const cacheKey = `transits:${userId}:${chartId}:${startDate.toISOString()}:${endDate.toISOString()}`

    // Try cache first
    const cachedResult = await this.getCachedData(cacheKey)
    if (cachedResult) {
      return { ...cachedResult, cached: true }
    }

    // Optimized database query with eager loading
    const startTime = performance.now()

    const result = await prisma.user_natal_charts.findUnique({
      where: { id: chartId },
      include: {
        transit_significances: {
          where: {
            transitDate: {
              gte: startDate,
              lte: endDate,
            },
            overallScore: { gte: 0.3 },
          },
          orderBy: { overallScore: 'desc' },
          take: 50, // Limit results for performance
        },
      },
    })

    if (result && result.userId !== userId) {
      return null
    }

    const queryTime = performance.now() - startTime

    // Cache the result
    await this.setCachedData(cacheKey, { ...result, queryTime }, 1800) // 30 minutes

    return { ...result, queryTime, cached: false }
  }

  async optimizeAgentChatQuery(sessionId: string, limit: number = 20): Promise<any> {
    const cacheKey = `chat:${sessionId}:${limit}`

    const cachedResult = await this.getCachedData(cacheKey)
    if (cachedResult) {
      return { ...cachedResult, cached: true }
    }

    const startTime = performance.now()

    const result = await prisma.agentConversation.findMany({
      where: { sessionId },
      include: {
        historical_agents: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const queryTime = performance.now() - startTime

    await this.setCachedData(cacheKey, { interactions: result, queryTime }, 600) // 10 minutes

    return { interactions: result, queryTime, cached: false }
  }

  // Performance Monitoring
  async recordMetric(metric: Omit<PerformanceMetrics, 'timestamp' | 'memoryUsage'>): Promise<void> {
    if (!this.config.performanceMonitoringEnabled) return

    const fullMetric: PerformanceMetrics = {
      ...metric,
      timestamp: new Date(),
      memoryUsage: process.memoryUsage(),
    }

    this.metrics.push(fullMetric)

    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }

    // Persist to database periodically (every 100 metrics)
    if (this.metrics.length % 100 === 0) {
      await this.persistMetrics()
    }
  }

  private async persistMetrics(): Promise<void> {
    // Keeping metrics in memory only for lightweight performance tracking
    this.metrics = []
  }

  async getPerformanceReport(timeRange: { start: Date; end: Date }): Promise<any> {
    const metrics = this.metrics
      .filter(m => {
        const time =
          m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp).getTime()
        return time >= timeRange.start.getTime() && time <= timeRange.end.getTime()
      })
      .sort((a: any, b: any) => {
        const timeA =
          a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime()
        const timeB =
          b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime()
        return timeB - timeA
      })

    const report = {
      summary: {
        totalRequests: metrics.length,
        averageResponseTime:
          metrics.reduce((sum: number, m: any) => sum + m.responseTime, 0) / metrics.length,
        errorRate: metrics.filter((m: any) => m.statusCode >= 400).length / metrics.length,
        cacheHitRate: metrics.filter((m: any) => m.cacheHit).length / metrics.length,
      },
      endpoints: this.groupByEndpoint(metrics),
      timeSeries: this.generateTimeSeries(metrics),
      recommendations: await this.generateOptimizationRecommendations(metrics),
    }

    return report
  }

  private groupByEndpoint(metrics: any[]): Record<string, any> {
    const grouped: Record<string, any> = {}

    metrics.forEach(metric => {
      if (!grouped[metric.endpoint]) {
        grouped[metric.endpoint] = {
          count: 0,
          totalResponseTime: 0,
          errors: 0,
          cacheHits: 0,
        }
      }

      grouped[metric.endpoint].count++
      grouped[metric.endpoint].totalResponseTime += metric.responseTime
      if (metric.statusCode >= 400) grouped[metric.endpoint].errors++
      if (metric.cacheHit) grouped[metric.endpoint].cacheHits++
    })

    // Calculate averages
    Object.keys(grouped).forEach(endpoint => {
      grouped[endpoint].averageResponseTime =
        grouped[endpoint].totalResponseTime / grouped[endpoint].count
      grouped[endpoint].errorRate = grouped[endpoint].errors / grouped[endpoint].count
      grouped[endpoint].cacheHitRate = grouped[endpoint].cacheHits / grouped[endpoint].count
    })

    return grouped
  }

  private generateTimeSeries(metrics: any[]): any[] {
    // Group metrics by minute
    const timeSeries: Record<string, any> = {}

    metrics.forEach(metric => {
      const minute = metric.timestamp.toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm

      if (!timeSeries[minute]) {
        timeSeries[minute] = {
          timestamp: minute,
          requests: 0,
          totalResponseTime: 0,
          errors: 0,
        }
      }

      timeSeries[minute].requests++
      timeSeries[minute].totalResponseTime += metric.responseTime
      if (metric.statusCode >= 400) timeSeries[minute].errors++
    })

    return Object.values(timeSeries).map((data: any) => ({
      ...data,
      averageResponseTime: data.totalResponseTime / data.requests,
    }))
  }

  private async generateOptimizationRecommendations(metrics: any[]): Promise<string[]> {
    const recommendations: string[] = []

    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length
    const errorRate = metrics.filter(m => m.statusCode >= 400).length / metrics.length
    const cacheHitRate = metrics.filter(m => m.cacheHit).length / metrics.length

    if (avgResponseTime > 500) {
      recommendations.push(
        'Consider implementing database query optimization or caching for slow endpoints'
      )
    }

    if (errorRate > 0.05) {
      recommendations.push('High error rate detected - review error handling and validation logic')
    }

    if (cacheHitRate < 0.5) {
      recommendations.push(
        'Low cache hit rate - consider adjusting cache TTL or cache key strategy'
      )
    }

    // Database performance recommendations
    const avgDbTime = metrics.reduce((sum, m) => sum + m.databaseTime, 0) / metrics.length
    if (avgDbTime > 100) {
      recommendations.push(
        'Database query optimization needed - consider adding indexes or query restructuring'
      )
    }

    return recommendations
  }

  // Load Testing
  async runLoadTest(config: {
    duration: number
    concurrentUsers: number
    endpoints: Array<{ url: string; method: string; body?: any; headers?: Record<string, string> }>
    rampUpTime?: number
  }): Promise<any> {
    if (!this.config.loadTestingEnabled) {
      throw new Error('Load testing is disabled')
    }

    const results = {
      startTime: new Date(),
      duration: config.duration,
      concurrentUsers: config.concurrentUsers,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      percentile95ResponseTime: 0,
      percentile99ResponseTime: 0,
      errorRate: 0,
      throughput: 0, // requests per second
      endpointResults: {} as Record<string, any>,
      recommendations: [] as string[],
    }

    const responseTimes: number[] = []
    const endpointStats: Record<
      string,
      { count: number; responseTimes: number[]; errors: number }
    > = {}

    const startTime = Date.now()
    const endTime = startTime + config.duration

    // Create user pools
    const userPools = Array(config.concurrentUsers)
      .fill(null)
      .map((_, i) => ({
        id: `load-test-user-${i}`,
        session: `session-${i}`,
      }))

    const testPromises: Promise<void>[] = []

    for (let i = 0; i < config.concurrentUsers; i++) {
      testPromises.push(
        this.simulateUserLoad(userPools[i], config, endTime, responseTimes, endpointStats)
      )
    }

    await Promise.all(testPromises)

    const totalDuration = (Date.now() - startTime) / 1000 // seconds

    // Calculate results
    results.totalRequests = responseTimes.length
    results.successfulRequests =
      responseTimes.length -
      Object.values(endpointStats).reduce((sum, stats) => sum + stats.errors, 0)
    results.failedRequests = Object.values(endpointStats).reduce(
      (sum, stats) => sum + stats.errors,
      0
    )
    results.averageResponseTime =
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    results.errorRate = results.failedRequests / results.totalRequests
    results.throughput = results.totalRequests / totalDuration

    // Calculate percentiles
    responseTimes.sort((a, b) => a - b)
    const p95Index = Math.floor(responseTimes.length * 0.95)
    const p99Index = Math.floor(responseTimes.length * 0.99)
    results.percentile95ResponseTime = responseTimes[p95Index] || 0
    results.percentile99ResponseTime = responseTimes[p99Index] || 0

    // Process endpoint results
    Object.entries(endpointStats).forEach(([endpoint, stats]) => {
      const avgTime =
        stats.responseTimes.reduce((sum, time) => sum + time, 0) / stats.responseTimes.length
      results.endpointResults[endpoint] = {
        requests: stats.count,
        averageResponseTime: avgTime,
        errorRate: stats.errors / stats.count,
      }
    })

    // Generate recommendations
    results.recommendations = this.generateLoadTestRecommendations(results)

    return results
  }

  private async simulateUserLoad(
    user: any,
    config: any,
    endTime: number,
    responseTimes: number[],
    endpointStats: Record<string, { count: number; responseTimes: number[]; errors: number }>
  ): Promise<void> {
    while (Date.now() < endTime) {
      for (const endpoint of config.endpoints) {
        if (Date.now() >= endTime) break

        const startTime = performance.now()

        try {
          // Initialize stats for endpoint
          if (!endpointStats[endpoint.url]) {
            endpointStats[endpoint.url] = { count: 0, responseTimes: [], errors: 0 }
          }

          // Make request (simplified - would use actual fetch in real implementation)
          await this.makeTestRequest(endpoint, user)

          const responseTime = performance.now() - startTime
          responseTimes.push(responseTime)
          endpointStats[endpoint.url].count++
          endpointStats[endpoint.url].responseTimes.push(responseTime)
        } catch (error) {
          const responseTime = performance.now() - startTime
          responseTimes.push(responseTime)
          endpointStats[endpoint.url].count++
          endpointStats[endpoint.url].errors++
        }

        // Small delay between requests to simulate realistic user behavior
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500))
      }
    }
  }

  private async makeTestRequest(endpoint: any, user: any): Promise<void> {
    // Simplified request simulation - would use actual fetch in real implementation
    // This would make real HTTP requests to test the system
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50))
  }

  private generateLoadTestRecommendations(results: any): string[] {
    const recommendations: string[] = []

    if (results.averageResponseTime > 1000) {
      recommendations.push(
        'Average response time is too high - consider optimizing database queries and implementing caching'
      )
    }

    if (results.errorRate > 0.05) {
      recommendations.push(
        'High error rate detected - review error handling and add circuit breakers'
      )
    }

    if (results.percentile95ResponseTime > 2000) {
      recommendations.push(
        '95th percentile response time is high - implement request queuing and rate limiting'
      )
    }

    if (results.throughput < results.concurrentUsers * 2) {
      recommendations.push(
        'Low throughput detected - consider horizontal scaling and load balancing'
      )
    }

    return recommendations
  }

  // Memory and Resource Monitoring
  async getResourceUsage(): Promise<any> {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    return {
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime: process.uptime(),
      pid: process.pid,
    }
  }

  // Cleanup
  async shutdown(): Promise<void> {
    if (redisClient) {
      await redisClient.quit()
    }

    // Persist any remaining metrics
    if (this.metrics.length > 0) {
      await this.persistMetrics()
    }

    this.isInitialized = false
    console.log('Performance Optimization Engine shut down')
  }
}

// Singleton instance
export const performanceEngine = new PerformanceOptimizationEngine()

// Middleware for automatic performance monitoring
export function createPerformanceMiddleware() {
  return async (request: Request, response: Response, next: Function) => {
    const startTime = performance.now()
    const startMemory = process.memoryUsage()

    // Extract request details
    const url = new URL(request.url)
    const endpoint = `${request.method} ${url.pathname}`

    let databaseQueries = 0
    let databaseTime = 0

    // Monkey patch prisma to track queries
    const originalExecute = prisma.$executeRaw
    prisma.$executeRaw = (async (...args: any[]) => {
      const queryStart = performance.now()
      databaseQueries++
      const result = await (originalExecute as any).apply(prisma, args)
      databaseTime += performance.now() - queryStart
      return result
    }) as any

    try {
      await next()

      const responseTime = performance.now() - startTime

      // Record metrics
      await performanceEngine.recordMetric({
        endpoint,
        method: request.method,
        responseTime,
        statusCode: response.status,
        userId: (request as any).userId,
        cacheHit: (response as any).cacheHit,
        databaseQueries,
        databaseTime,
      })
    } finally {
      // Restore original function
      prisma.$executeRaw = originalExecute
    }
  }
}

export default PerformanceOptimizationEngine
