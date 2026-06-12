/**
 * Performance Monitoring and Error Handling System
 * Tracks API response times, error rates, and system health
 */

interface PerformanceMetric {
  endpoint: string
  method: string
  responseTime: number
  statusCode: number
  timestamp: Date
  userId?: string
  error?: string
}

interface SystemHealth {
  apiResponseTime: {
    average: number
    p95: number
    p99: number
  }
  errorRate: number
  activeUsers: number
  memoryUsage: number
  uptime: number
  lastChecked: Date
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private maxMetrics = 1000 // Keep last 1000 metrics in memory
  private healthCheckInterval: NodeJS.Timeout | null = null

  constructor() {
    // Start health monitoring
    this.startHealthMonitoring()
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric)

    // Keep only recent metrics to prevent memory bloat
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // Log slow requests for debugging
    if (metric.responseTime > 5000) {
      // 5 seconds
      console.warn(`🐌 Slow request detected: ${metric.endpoint} took ${metric.responseTime}ms`)
    }

    // Log errors
    if (metric.statusCode >= 400) {
      console.error(
        `❌ Error request: ${metric.method} ${metric.endpoint} - ${metric.statusCode}${metric.error ? `: ${metric.error}` : ''}`
      )
    }
  }

  /**
   * Get current system health
   */
  getSystemHealth(): SystemHealth {
    const now = new Date()
    const recentMetrics = this.metrics.filter(
      m => now.getTime() - m.timestamp.getTime() < 5 * 60 * 1000 // Last 5 minutes
    )

    const responseTimes = recentMetrics.map(m => m.responseTime).sort((a, b) => a - b)
    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length

    return {
      apiResponseTime: {
        average:
          responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0,
        p95:
          responseTimes.length > 0
            ? responseTimes[Math.floor(responseTimes.length * 0.95)] || 0
            : 0,
        p99:
          responseTimes.length > 0
            ? responseTimes[Math.floor(responseTimes.length * 0.99)] || 0
            : 0,
      },
      errorRate: recentMetrics.length > 0 ? (errorCount / recentMetrics.length) * 100 : 0,
      activeUsers: this.getActiveUserCount(),
      memoryUsage: this.getMemoryUsage(),
      uptime: process.uptime(),
      lastChecked: now,
    }
  }

  /**
   * Get performance metrics for a specific endpoint
   */
  getEndpointMetrics(
    endpoint: string,
    timeRange: number = 60
  ): {
    averageResponseTime: number
    requestCount: number
    errorRate: number
    recentErrors: PerformanceMetric[]
  } {
    const now = new Date()
    const endpointMetrics = this.metrics.filter(
      m => m.endpoint === endpoint && now.getTime() - m.timestamp.getTime() < timeRange * 60 * 1000
    )

    const errors = endpointMetrics.filter(m => m.statusCode >= 400)

    return {
      averageResponseTime:
        endpointMetrics.length > 0
          ? endpointMetrics.reduce((sum, m) => sum + m.responseTime, 0) / endpointMetrics.length
          : 0,
      requestCount: endpointMetrics.length,
      errorRate: endpointMetrics.length > 0 ? (errors.length / endpointMetrics.length) * 100 : 0,
      recentErrors: errors.slice(-5), // Last 5 errors
    }
  }

  /**
   * Get top slow endpoints
   */
  getSlowEndpoints(limit: number = 5): Array<{
    endpoint: string
    averageResponseTime: number
    requestCount: number
  }> {
    const endpointGroups: Record<string, PerformanceMetric[]> = {}

    // Group by endpoint
    this.metrics.forEach(metric => {
      if (!endpointGroups[metric.endpoint]) {
        endpointGroups[metric.endpoint] = []
      }
      endpointGroups[metric.endpoint].push(metric)
    })

    // Calculate averages and sort
    const endpointStats = Object.entries(endpointGroups)
      .map(([endpoint, metrics]) => ({
        endpoint,
        averageResponseTime: metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length,
        requestCount: metrics.length,
      }))
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)

    return endpointStats.slice(0, limit)
  }

  /**
   * Start automatic health monitoring
   */
  private startHealthMonitoring() {
    this.healthCheckInterval = setInterval(() => {
      const health = this.getSystemHealth()

      // Alert on high error rate
      if (health.errorRate > 10) {
        console.warn(`⚠️  High error rate detected: ${health.errorRate.toFixed(2)}%`)
      }

      // Alert on slow average response time
      if (health.apiResponseTime.average > 2000) {
        console.warn(
          `⚠️  Slow API performance: ${health.apiResponseTime.average.toFixed(0)}ms average`
        )
      }

      // Alert on high memory usage
      if (health.memoryUsage > 80) {
        console.warn(`⚠️  High memory usage: ${health.memoryUsage.toFixed(1)}%`)
      }
    }, 60000) // Check every minute
  }

  /**
   * Get active user count from recent metrics
   */
  private getActiveUserCount(): number {
    const now = new Date()
    const recentUsers = new Set(
      this.metrics
        .filter(
          m => m.userId && now.getTime() - m.timestamp.getTime() < 15 * 60 * 1000 // Last 15 minutes
        )
        .map(m => m.userId)
    )
    return recentUsers.size
  }

  /**
   * Get memory usage percentage
   */
  private getMemoryUsage(): number {
    const memoryUsage = process.memoryUsage()
    const totalMemory = 512 * 1024 * 1024 // Assume 512MB limit
    return (memoryUsage.heapUsed / totalMemory) * 100
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  /**
   * Clear old metrics
   */
  clearMetrics() {
    this.metrics = []
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * Express middleware for automatic performance tracking
 */
export function trackPerformance(req: any, res: any, next: any) {
  const startTime = Date.now()
  const originalSend = res.send

  res.send = function (body: any) {
    const responseTime = Date.now() - startTime

    performanceMonitor.recordMetric({
      endpoint: req.path || req.url,
      method: req.method,
      responseTime,
      statusCode: res.statusCode,
      timestamp: new Date(),
      userId: req.user?.id || req.headers['x-user-id'],
      error: res.statusCode >= 400 ? body : undefined,
    })

    return originalSend.call(this, body)
  }

  next()
}

/**
 * Error handling wrapper for API routes
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  endpoint: string
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now()

    try {
      const result = await handler(...args)

      // Record successful metric
      performanceMonitor.recordMetric({
        endpoint,
        method: 'API',
        responseTime: Date.now() - startTime,
        statusCode: 200,
        timestamp: new Date(),
      })

      return result
    } catch (error) {
      // Record error metric
      performanceMonitor.recordMetric({
        endpoint,
        method: 'API',
        responseTime: Date.now() - startTime,
        statusCode: 500,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      })

      // Log error for debugging
      console.error(`❌ Error in ${endpoint}:`, error)

      throw error
    }
  }
}

/**
 * React hook for performance data
 */
export function usePerformanceData() {
  return {
    getSystemHealth: () => performanceMonitor.getSystemHealth(),
    getEndpointMetrics: (endpoint: string) => performanceMonitor.getEndpointMetrics(endpoint),
    getSlowEndpoints: () => performanceMonitor.getSlowEndpoints(),
  }
}
