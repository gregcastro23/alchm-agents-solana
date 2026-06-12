import { logger } from './logger.js'

export interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeout: number
  monitoringPeriod: number
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export default class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failureCount: number = 0
  private lastFailureTime?: number
  private nextAttempt?: number

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN
        logger.info('Circuit breaker moving to HALF_OPEN state')
      } else {
        throw new Error('Circuit breaker is OPEN - operation not allowed')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    this.state = CircuitBreakerState.CLOSED
    logger.debug('Circuit breaker reset to CLOSED state')
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN
      this.nextAttempt = Date.now() + this.config.recoveryTimeout
      logger.warn(`Circuit breaker opened after ${this.failureCount} failures`)
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttempt !== undefined && Date.now() >= this.nextAttempt
  }

  getState(): string {
    return this.state
  }

  getFailureCount(): number {
    return this.failureCount
  }

  getLastFailureTime(): number | undefined {
    return this.lastFailureTime
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED
    this.failureCount = 0
    this.lastFailureTime = undefined
    this.nextAttempt = undefined
    logger.info('Circuit breaker manually reset')
  }
}
