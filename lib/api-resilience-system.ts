/**
 * API Resilience System
 * Implements exponential backoff retry logic and circuit breaker pattern
 * for enhanced reliability of agent consciousness systems
 */

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitterMs: number
}

export interface CircuitBreakerConfig {
  failureThreshold: number // Number of failures before opening circuit
  recoveryTimeoutMs: number // Time to wait before trying again
  successThreshold: number // Successful calls needed to close circuit
  timeWindowMs: number // Time window for failure counting
}

export interface ApiCall<T> {
  name: string
  execute: () => Promise<T>
  timeout?: number
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failures: number
  lastFailureTime: number
  successCount: number
  timeWindow: { start: number; failures: number }[]
}

export interface ApiMetrics {
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  retriedCalls: number
  circuitBreakerTrips: number
  averageResponseTime: number
  lastCallTime: number
  uptime: number
}

export class ApiResilienceSystem {
  private static circuitBreakers: Map<string, CircuitBreakerState> = new Map()
  private static metrics: Map<string, ApiMetrics> = new Map()

  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterMs: 500,
  }

  private static readonly DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeoutMs: 30000, // 30 seconds
    successThreshold: 2,
    timeWindowMs: 60000, // 1 minute
  }

  /**
   * Execute API call with retry logic and circuit breaker protection
   */
  static async executeWithResilience<T>(
    apiCall: ApiCall<T>,
    retryConfig?: Partial<RetryConfig>,
    circuitConfig?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const config = { ...this.DEFAULT_RETRY_CONFIG, ...retryConfig }
    const circuitConf = { ...this.DEFAULT_CIRCUIT_CONFIG, ...circuitConfig }

    // Check circuit breaker first
    const circuitState = this.getCircuitBreakerState(apiCall.name, circuitConf)

    if (circuitState.state === 'OPEN') {
      const timeSinceFailure = Date.now() - circuitState.lastFailureTime
      if (timeSinceFailure < circuitConf.recoveryTimeoutMs) {
        throw new Error(
          `Circuit breaker OPEN for ${apiCall.name}. Try again in ${Math.round((circuitConf.recoveryTimeoutMs - timeSinceFailure) / 1000)}s`
        )
      } else {
        // Move to HALF_OPEN state
        circuitState.state = 'HALF_OPEN'
        circuitState.successCount = 0
      }
    }

    return this.executeWithRetry(apiCall, config, circuitConf)
  }

  /**
   * Execute API call with exponential backoff retry
   */
  private static async executeWithRetry<T>(
    apiCall: ApiCall<T>,
    config: RetryConfig,
    circuitConfig: CircuitBreakerConfig
  ): Promise<T> {
    const startTime = Date.now()
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // Add timeout if specified
        const executePromise = apiCall.execute()
        const result = apiCall.timeout
          ? await Promise.race([
              executePromise,
              this.createTimeoutPromise(apiCall.timeout, apiCall.name),
            ])
          : await executePromise

        // Success - update circuit breaker and metrics
        this.handleSuccess(apiCall.name, Date.now() - startTime, circuitConfig)
        this.updateMetrics(apiCall.name, true, attempt > 0, Date.now() - startTime)

        return result as T
      } catch (error) {
        lastError = error as Error
        console.warn(
          `API call ${apiCall.name} failed (attempt ${attempt + 1}/${config.maxRetries + 1}):`,
          error
        )

        // Update circuit breaker and metrics for failure
        this.handleFailure(apiCall.name, circuitConfig)

        if (attempt === config.maxRetries) {
          // Final failure - update metrics and throw
          this.updateMetrics(apiCall.name, false, attempt > 0, Date.now() - startTime)
          break
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, config)
        console.log(`Retrying ${apiCall.name} in ${delay}ms...`)
        await this.sleep(delay)
      }
    }

    throw lastError || new Error(`All retry attempts failed for ${apiCall.name}`)
  }

  /**
   * Create timeout promise for API calls
   */
  private static createTimeoutPromise<T>(timeoutMs: number, apiName: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`API call ${apiName} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private static calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt)
    const jitter = Math.random() * config.jitterMs
    const totalDelay = exponentialDelay + jitter

    return Math.min(totalDelay, config.maxDelayMs)
  }

  /**
   * Get or create circuit breaker state
   */
  private static getCircuitBreakerState(
    apiName: string,
    config: CircuitBreakerConfig
  ): CircuitBreakerState {
    if (!this.circuitBreakers.has(apiName)) {
      this.circuitBreakers.set(apiName, {
        state: 'CLOSED',
        failures: 0,
        lastFailureTime: 0,
        successCount: 0,
        timeWindow: [],
      })
    }

    const state = this.circuitBreakers.get(apiName)!

    // Clean old time window entries
    const now = Date.now()
    state.timeWindow = state.timeWindow.filter(entry => now - entry.start < config.timeWindowMs)

    return state
  }

  /**
   * Handle successful API call
   */
  private static handleSuccess(
    apiName: string,
    responseTime: number,
    config: CircuitBreakerConfig
  ): void {
    const state = this.getCircuitBreakerState(apiName, config)

    if (state.state === 'HALF_OPEN') {
      state.successCount++
      if (state.successCount >= config.successThreshold) {
        // Close the circuit
        state.state = 'CLOSED'
        state.failures = 0
        state.timeWindow = []
        console.log(`✅ Circuit breaker CLOSED for ${apiName} after successful recovery`)
      }
    } else if (state.state === 'CLOSED') {
      // Reset failure count on success
      state.failures = Math.max(0, state.failures - 1)
    }
  }

  /**
   * Handle failed API call
   */
  private static handleFailure(apiName: string, config: CircuitBreakerConfig): void {
    const state = this.getCircuitBreakerState(apiName, config)
    const now = Date.now()

    state.failures++
    state.lastFailureTime = now
    state.timeWindow.push({ start: now, failures: 1 })

    // Count failures in current time window
    const windowFailures = state.timeWindow.reduce((sum, entry) => sum + entry.failures, 0)

    if (state.state === 'CLOSED' && windowFailures >= config.failureThreshold) {
      // Open the circuit
      state.state = 'OPEN'
      this.incrementCircuitBreakerTrips(apiName)
      console.warn(`🚨 Circuit breaker OPENED for ${apiName} after ${windowFailures} failures`)
    } else if (state.state === 'HALF_OPEN') {
      // Go back to OPEN on any failure in HALF_OPEN
      state.state = 'OPEN'
      state.successCount = 0
      console.warn(`🚨 Circuit breaker returned to OPEN for ${apiName}`)
    }
  }

  /**
   * Update API metrics
   */
  private static updateMetrics(
    apiName: string,
    success: boolean,
    wasRetried: boolean,
    responseTime: number
  ): void {
    if (!this.metrics.has(apiName)) {
      this.metrics.set(apiName, {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        retriedCalls: 0,
        circuitBreakerTrips: 0,
        averageResponseTime: 0,
        lastCallTime: 0,
        uptime: 0,
      })
    }

    const metrics = this.metrics.get(apiName)!

    metrics.totalCalls++
    metrics.lastCallTime = Date.now()

    if (success) {
      metrics.successfulCalls++
    } else {
      metrics.failedCalls++
    }

    if (wasRetried) {
      metrics.retriedCalls++
    }

    // Update average response time
    metrics.averageResponseTime =
      (metrics.averageResponseTime * (metrics.totalCalls - 1) + responseTime) / metrics.totalCalls

    // Calculate uptime percentage
    metrics.uptime = metrics.successfulCalls / metrics.totalCalls
  }

  /**
   * Increment circuit breaker trips counter
   */
  private static incrementCircuitBreakerTrips(apiName: string): void {
    const metrics = this.metrics.get(apiName)
    if (metrics) {
      metrics.circuitBreakerTrips++
    }
  }

  /**
   * Get API metrics for monitoring
   */
  static getApiMetrics(apiName?: string): Map<string, ApiMetrics> | ApiMetrics | null {
    if (apiName) {
      return this.metrics.get(apiName) ?? null
    }
    return this.metrics
  }

  /**
   * Get circuit breaker status
   */
  static getCircuitBreakerStatus(
    apiName?: string
  ): Map<string, CircuitBreakerState> | CircuitBreakerState | null {
    if (apiName) {
      return this.circuitBreakers.get(apiName) || null
    }
    return this.circuitBreakers
  }

  /**
   * Reset circuit breaker (admin function)
   */
  static resetCircuitBreaker(apiName: string): void {
    const state = this.circuitBreakers.get(apiName)
    if (state) {
      state.state = 'CLOSED'
      state.failures = 0
      state.successCount = 0
      state.timeWindow = []
      console.log(`🔄 Circuit breaker reset for ${apiName}`)
    }
  }

  /**
   * Reset all metrics (admin function)
   */
  static resetMetrics(): void {
    this.metrics.clear()
    this.circuitBreakers.clear()
    console.log('📊 All API metrics and circuit breakers reset')
  }

  /**
   * Sleep utility
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Create resilient API wrapper for common agent calls
   */
  static createResilientApiCall<T>(
    name: string,
    apiFunction: () => Promise<T>,
    timeout?: number
  ): () => Promise<T> {
    return () =>
      this.executeWithResilience({
        name,
        execute: apiFunction,
        timeout,
      })
  }

  /**
   * Get overall system health
   */
  static getSystemHealth(): {
    overallUptime: number
    totalApis: number
    healthyApis: number
    circuitBreakerTrips: number
    averageResponseTime: number
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'
  } {
    const allMetrics = Array.from(this.metrics.values())

    if (allMetrics.length === 0) {
      return {
        overallUptime: 1,
        totalApis: 0,
        healthyApis: 0,
        circuitBreakerTrips: 0,
        averageResponseTime: 0,
        status: 'HEALTHY',
      }
    }

    const totalUptime = allMetrics.reduce((sum, m) => sum + m.uptime, 0)
    const overallUptime = totalUptime / allMetrics.length
    const healthyApis = allMetrics.filter(m => m.uptime > 0.8).length
    const totalTrips = allMetrics.reduce((sum, m) => sum + m.circuitBreakerTrips, 0)
    const avgResponseTime =
      allMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / allMetrics.length

    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY'
    if (overallUptime < 0.5 || totalTrips > 10) status = 'UNHEALTHY'
    else if (overallUptime < 0.8 || totalTrips > 3) status = 'DEGRADED'

    return {
      overallUptime,
      totalApis: allMetrics.length,
      healthyApis,
      circuitBreakerTrips: totalTrips,
      averageResponseTime: avgResponseTime,
      status,
    }
  }
}

// Export helper functions for common use cases
export const resilientApiCall = ApiResilienceSystem.executeWithResilience
export const createResilientCall = ApiResilienceSystem.createResilientApiCall
export const getApiHealth = ApiResilienceSystem.getSystemHealth
