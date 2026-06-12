export type CircuitState = 'closed' | 'open' | 'half_open'

export class CircuitBreaker {
  private failureCount = 0
  private successCount = 0
  private state: CircuitState = 'closed'
  private nextAttempt = 0

  constructor(
    private readonly failureThreshold: number = 3,
    private readonly successThreshold: number = 1,
    private readonly cooldownMs: number = 5000
  ) {}

  async exec<T>(fn: () => Promise<T>): Promise<{ result?: T; degraded: boolean }> {
    const now = Date.now()
    if (this.state === 'open') {
      if (now > this.nextAttempt) {
        this.state = 'half_open'
      } else {
        return { degraded: true }
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return { result, degraded: false }
    } catch (_e) {
      this.onFailure()
      return { degraded: true }
    }
  }

  private onSuccess() {
    if (this.state === 'half_open') {
      this.successCount += 1
      if (this.successCount >= this.successThreshold) {
        this.state = 'closed'
        this.failureCount = 0
        this.successCount = 0
      }
    } else {
      this.failureCount = 0
    }
  }

  private onFailure() {
    this.failureCount += 1
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open'
      this.nextAttempt = Date.now() + this.cooldownMs
    }
  }
}

export async function withRetries<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 200
): Promise<T> {
  let attempt = 0
  let lastError: any
  while (attempt <= retries) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (attempt === retries) break
      const backoff = baseDelayMs * Math.pow(2, attempt)
      await new Promise(res => setTimeout(res, backoff))
      attempt += 1
    }
  }
  throw lastError
}

// Global circuit breaker instance for shared use
const globalCircuitBreaker = new CircuitBreaker()

// Convenience function that uses the global circuit breaker
export async function circuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
  const result = await globalCircuitBreaker.exec(fn)
  if (result.degraded) {
    throw new Error('Circuit breaker is open - service temporarily unavailable')
  }
  return result.result!
}
