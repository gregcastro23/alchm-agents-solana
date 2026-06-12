/**
 * Zodiac Accuracy Monitoring and Error Handling System
 * ===================================================
 *
 * Comprehensive monitoring, logging, and error handling for zodiac calculations
 */

interface ZodiacMetrics {
  calculationsPerformed: number
  averageCalculationTime: number
  errorCount: number
  cacheHitRate: number
  apiRequestCount: number
  accuracyChecks: {
    passed: number
    failed: number
    averageDeviation: number
  }
}

interface ZodiacError {
  id: string
  timestamp: Date
  type: 'calculation' | 'api' | 'cache' | 'validation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: Record<string, unknown>
  stack?: string
  resolved: boolean
}

class ZodiacMonitoringSystem {
  private metrics: ZodiacMetrics
  private errors: ZodiacError[]
  private performanceLog: Array<{ timestamp: Date; operation: string; duration: number }>
  private maxLogSize = 1000
  private maxErrorSize = 500

  constructor() {
    this.metrics = {
      calculationsPerformed: 0,
      averageCalculationTime: 0,
      errorCount: 0,
      cacheHitRate: 0,
      apiRequestCount: 0,
      accuracyChecks: {
        passed: 0,
        failed: 0,
        averageDeviation: 0,
      },
    }
    this.errors = []
    this.performanceLog = []
  }

  /**
   * Record a zodiac calculation performance metric
   */
  recordCalculation(operation: string, duration: number, success: boolean = true): void {
    this.metrics.calculationsPerformed++

    // Update average calculation time
    const totalTime =
      this.metrics.averageCalculationTime * (this.metrics.calculationsPerformed - 1) + duration
    this.metrics.averageCalculationTime = totalTime / this.metrics.calculationsPerformed

    // Add to performance log
    this.performanceLog.push({
      timestamp: new Date(),
      operation,
      duration,
    })

    // Trim log if too large
    if (this.performanceLog.length > this.maxLogSize) {
      this.performanceLog = this.performanceLog.slice(-this.maxLogSize)
    }

    if (!success) {
      this.recordError('calculation', 'medium', `Calculation failed: ${operation}`, {
        operation,
        duration,
      })
    }
  }

  /**
   * Record an error in the zodiac system
   */
  recordError(
    type: ZodiacError['type'],
    severity: ZodiacError['severity'],
    message: string,
    details: Record<string, unknown> = {},
    stack?: string
  ): void {
    const error: ZodiacError = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      type,
      severity,
      message,
      details,
      stack,
      resolved: false,
    }

    this.errors.push(error)
    this.metrics.errorCount++

    // Trim errors if too many
    if (this.errors.length > this.maxErrorSize) {
      this.errors = this.errors.slice(-this.maxErrorSize)
    }

    // Log to console based on severity
    if (severity === 'critical') {
      console.error(`🚨 CRITICAL ZODIAC ERROR: ${message}`, details)
    } else if (severity === 'high') {
      console.error(`❌ ZODIAC ERROR: ${message}`, details)
    } else if (severity === 'medium') {
      console.warn(`⚠️  ZODIAC WARNING: ${message}`, details)
    } else {
      console.log(`ℹ️  ZODIAC INFO: ${message}`, details)
    }
  }

  /**
   * Record cache performance
   */
  recordCacheOperation(hit: boolean): void {
    const totalOps = this.metrics.calculationsPerformed
    if (totalOps > 0) {
      const hitCount = this.metrics.cacheHitRate * totalOps + (hit ? 1 : 0)
      this.metrics.cacheHitRate = hitCount / (totalOps + 1)
    } else {
      this.metrics.cacheHitRate = hit ? 1 : 0
    }
  }

  /**
   * Record API request
   */
  recordApiRequest(): void {
    this.metrics.apiRequestCount++
  }

  /**
   * Record accuracy check result
   */
  recordAccuracyCheck(passed: boolean, deviation?: number): void {
    if (passed) {
      this.metrics.accuracyChecks.passed++
    } else {
      this.metrics.accuracyChecks.failed++
    }

    if (deviation !== undefined) {
      const total = this.metrics.accuracyChecks.passed + this.metrics.accuracyChecks.failed
      const currentSum = this.metrics.accuracyChecks.averageDeviation * (total - 1)
      this.metrics.accuracyChecks.averageDeviation = (currentSum + deviation) / total
    }
  }

  /**
   * Get current system metrics
   */
  getMetrics(): ZodiacMetrics {
    return { ...this.metrics }
  }

  /**
   * Get recent errors
   */
  getRecentErrors(severity?: ZodiacError['severity']): ZodiacError[] {
    let filteredErrors = [...this.errors]

    if (severity) {
      filteredErrors = filteredErrors.filter(e => e.severity === severity)
    }

    return filteredErrors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 50)
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    averageTime: number
    medianTime: number
    p95Time: number
    slowestOperations: Array<{ operation: string; duration: number; timestamp: Date }>
  } {
    if (this.performanceLog.length === 0) {
      return {
        averageTime: 0,
        medianTime: 0,
        p95Time: 0,
        slowestOperations: [],
      }
    }

    const durations = this.performanceLog.map(entry => entry.duration).sort((a, b) => a - b)
    const medianIndex = Math.floor(durations.length / 2)
    const p95Index = Math.floor(durations.length * 0.95)

    const slowestOperations = [...this.performanceLog]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)

    return {
      averageTime: this.metrics.averageCalculationTime,
      medianTime: durations[medianIndex],
      p95Time: durations[p95Index],
      slowestOperations,
    }
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical'
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    // Check error rate
    const recentErrors = this.getRecentErrors()
    const criticalErrors = recentErrors.filter(e => e.severity === 'critical' && !e.resolved)
    const highErrors = recentErrors.filter(e => e.severity === 'high' && !e.resolved)

    if (criticalErrors.length > 0) {
      status = 'critical'
      issues.push(`${criticalErrors.length} unresolved critical errors`)
      recommendations.push('Immediate attention required for critical errors')
    } else if (highErrors.length > 5) {
      status = 'warning'
      issues.push(`${highErrors.length} high-severity errors`)
      recommendations.push('Review and resolve high-severity errors')
    }

    // Check performance
    if (this.metrics.averageCalculationTime > 100) {
      status = status === 'healthy' ? 'warning' : status
      issues.push(`Average calculation time is ${this.metrics.averageCalculationTime.toFixed(2)}ms`)
      recommendations.push('Consider optimizing calculation performance')
    }

    // Check cache performance
    if (this.metrics.cacheHitRate < 0.5 && this.metrics.calculationsPerformed > 100) {
      status = status === 'healthy' ? 'warning' : status
      issues.push(`Low cache hit rate: ${(this.metrics.cacheHitRate * 100).toFixed(1)}%`)
      recommendations.push('Review caching strategy for better performance')
    }

    // Check accuracy
    const totalAccuracyChecks =
      this.metrics.accuracyChecks.passed + this.metrics.accuracyChecks.failed
    if (totalAccuracyChecks > 10) {
      const failureRate = this.metrics.accuracyChecks.failed / totalAccuracyChecks
      if (failureRate > 0.1) {
        status = 'critical'
        issues.push(`High accuracy check failure rate: ${(failureRate * 100).toFixed(1)}%`)
        recommendations.push('Critical: Review calculation accuracy immediately')
      }
    }

    return { status, issues, recommendations }
  }

  /**
   * Generate monitoring report
   */
  generateReport(): string {
    const metrics = this.getMetrics()
    const health = this.getHealthStatus()
    const performance = this.getPerformanceStats()
    const recentErrors = this.getRecentErrors().slice(0, 5)

    return `
🔍 Zodiac Accuracy System Monitoring Report
==========================================
Generated: ${new Date().toISOString()}

📊 System Health: ${health.status.toUpperCase()}
${health.issues.length > 0 ? 'Issues:\n' + health.issues.map(i => `  ❌ ${i}`).join('\n') : '  ✅ No issues detected'}
${health.recommendations.length > 0 ? '\nRecommendations:\n' + health.recommendations.map(r => `  💡 ${r}`).join('\n') : ''}

📈 Performance Metrics:
  • Calculations Performed: ${metrics.calculationsPerformed.toLocaleString()}
  • Average Calculation Time: ${metrics.averageCalculationTime.toFixed(2)}ms
  • Median Calculation Time: ${performance.medianTime.toFixed(2)}ms
  • 95th Percentile Time: ${performance.p95Time.toFixed(2)}ms
  • Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%
  • API Requests: ${metrics.apiRequestCount.toLocaleString()}

🎯 Accuracy Metrics:
  • Accuracy Checks Passed: ${metrics.accuracyChecks.passed}
  • Accuracy Checks Failed: ${metrics.accuracyChecks.failed}
  • Average Deviation: ${metrics.accuracyChecks.averageDeviation.toFixed(4)}°

❌ Error Summary:
  • Total Errors: ${metrics.errorCount}
  • Recent Errors: ${recentErrors.length}
${
  recentErrors.length > 0
    ? recentErrors
        .map(e => `  • ${e.timestamp.toISOString()}: [${e.severity.toUpperCase()}] ${e.message}`)
        .join('\n')
    : '  • No recent errors'
}

⚡ Performance Leaders:
${performance.slowestOperations
  .slice(0, 3)
  .map(op => `  • ${op.operation}: ${op.duration.toFixed(2)}ms`)
  .join('\n')}
`
  }

  /**
   * Clear old data and reset counters
   */
  reset(): void {
    this.metrics = {
      calculationsPerformed: 0,
      averageCalculationTime: 0,
      errorCount: 0,
      cacheHitRate: 0,
      apiRequestCount: 0,
      accuracyChecks: {
        passed: 0,
        failed: 0,
        averageDeviation: 0,
      },
    }
    this.errors = []
    this.performanceLog = []
  }

  private generateErrorId(): string {
    return `zodiac_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Global monitoring instance
export const zodiacMonitoring = new ZodiacMonitoringSystem()

/**
 * Decorator for monitoring zodiac calculations
 */
export function monitorZodiacCalculation(operationName: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = function (...args: any[]) {
      const startTime = Date.now()

      try {
        const result = method.apply(this, args)

        if (result instanceof Promise) {
          return result
            .then(res => {
              zodiacMonitoring.recordCalculation(operationName, Date.now() - startTime, true)
              return res
            })
            .catch(err => {
              zodiacMonitoring.recordCalculation(operationName, Date.now() - startTime, false)
              zodiacMonitoring.recordError('calculation', 'high', `${operationName} failed`, {
                args,
                error: err.message,
              })
              throw err
            })
        } else {
          zodiacMonitoring.recordCalculation(operationName, Date.now() - startTime, true)
          return result
        }
      } catch (error) {
        zodiacMonitoring.recordCalculation(operationName, Date.now() - startTime, false)
        zodiacMonitoring.recordError('calculation', 'high', `${operationName} failed`, {
          args,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        throw error
      }
    }

    return descriptor
  }
}

/**
 * Error handling wrapper for zodiac calculations
 */
export function withZodiacErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  fallbackFn?: T,
  operationName: string = 'zodiac_calculation'
): T {
  return ((...args: any[]) => {
    try {
      const result = fn(...args)

      if (result instanceof Promise) {
        return result.catch(error => {
          zodiacMonitoring.recordError(
            'calculation',
            'medium',
            `${operationName} failed, using fallback`,
            {
              args,
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          )

          if (fallbackFn) {
            return fallbackFn(...args)
          } else {
            throw error
          }
        })
      } else {
        return result
      }
    } catch (error) {
      zodiacMonitoring.recordError(
        'calculation',
        'medium',
        `${operationName} failed, using fallback`,
        {
          args,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )

      if (fallbackFn) {
        return fallbackFn(...args)
      } else {
        throw error
      }
    }
  }) as T
}

/**
 * Validate zodiac calculation results
 */
export function validateZodiacResult(result: any, expectedType: string): boolean {
  try {
    switch (expectedType) {
      case 'zodiacPosition':
        return (
          typeof result === 'object' &&
          typeof result.absolute_longitude === 'number' &&
          result.absolute_longitude >= 0 &&
          result.absolute_longitude < 360 &&
          typeof result.sign === 'string' &&
          typeof result.degree_in_sign === 'number' &&
          result.degree_in_sign >= 0 &&
          result.degree_in_sign < 30
        )

      case 'solarPosition':
        return (
          typeof result === 'object' &&
          typeof result.longitude === 'number' &&
          result.longitude >= 0 &&
          result.longitude < 360 &&
          typeof result.distance === 'number' &&
          result.distance > 0.9 &&
          result.distance < 1.1
        )

      case 'dateRange':
        return (
          typeof result === 'object' &&
          result.start instanceof Date &&
          result.end instanceof Date &&
          result.start.getTime() < result.end.getTime()
        )

      default:
        return true
    }
  } catch (error) {
    zodiacMonitoring.recordError('validation', 'low', `Validation failed for ${expectedType}`, {
      result,
      error,
    })
    return false
  }
}

export { ZodiacMonitoringSystem }
