import { logger } from '../utils/logger.js'
import CircuitBreaker from '../utils/circuit-breaker.js'
import { cacheService } from './cache.js'
const breaker = new CircuitBreaker({
  failureThreshold: 3,
  recoveryTimeout: 5000,
  monitoringPeriod: 60000,
})

const ALCHM_BACKEND_URL = process.env.ALCHM_BACKEND_URL || 'https://alchm-backend.onrender.com'

const apiClient = {
  async get(endpoint: string) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 7000)
    try {
      const response = await fetch(`${ALCHM_BACKEND_URL}${endpoint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      return { status: response.status }
    } finally {
      clearTimeout(timeout)
    }
  },
  async post(endpoint: string, data: any) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 7000)
    try {
      const response = await fetch(`${ALCHM_BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const responseData = await response.json()
      return { data: responseData }
    } finally {
      clearTimeout(timeout)
    }
  },
}

// Simple stable stringify to generate deterministic cache keys
function stableStringify(value: unknown): string {
  const seen = new WeakSet()
  const stringify = (val: any): string => {
    if (val === null || typeof val !== 'object') {
      return JSON.stringify(val)
    }
    if (seen.has(val)) {
      return '"[Circular]"'
    }
    seen.add(val)
    if (Array.isArray(val)) {
      return `[${val.map(item => stringify(item)).join(',')}]`
    }
    const keys = Object.keys(val).sort()
    return `{${keys.map(k => `${JSON.stringify(k)}:${stringify(val[k])}`).join(',')}}`
  }
  return stringify(value)
}

function createCacheKey(endpoint: string, payload?: unknown): string {
  return `alchm:${endpoint}:${payload ? stableStringify(payload) : 'nopayload'}`
}

// In-flight request deduplication
const inFlightRequests: Map<string, Promise<any>> = new Map()

// Circuit breaker wrapped POST
const protectedPost = async (endpoint: string, data: any) =>
  breaker.execute(async () => {
    const response = await apiClient.post(endpoint, data)
    return response.data
  })

async function cachedPost(endpoint: string, data: any, ttlSeconds: number): Promise<any> {
  const cacheKey = createCacheKey(`POST${endpoint}`, data)
  try {
    const cached = await cacheService.get<any>(cacheKey)
    if (cached !== null) {
      return cached
    }
  } catch (error) {
    logger.warn('Cache get failed (post):', error)
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!
  }

  const reqPromise = (async () => {
    try {
      const result = await protectedPost(endpoint, data)
      await cacheService.set(cacheKey, result, ttlSeconds)
      return result
    } catch (error) {
      // On failure, serve last known cached value if available
      const fallback = await cacheService.get<any>(cacheKey)
      if (fallback !== null) {
        logger.warn(`Serving cached fallback for ${endpoint}`)
        return fallback
      }
      throw error
    } finally {
      inFlightRequests.delete(cacheKey)
    }
  })()

  inFlightRequests.set(cacheKey, reqPromise)
  return reqPromise
}

async function cachedGet(endpoint: string, ttlSeconds: number): Promise<any> {
  const cacheKey = createCacheKey(`GET${endpoint}`)
  try {
    const cached = await cacheService.get<any>(cacheKey)
    if (cached !== null) {
      return cached
    }
  } catch (error) {
    logger.warn('Cache get failed (get):', error)
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!
  }

  const reqPromise = (async () => {
    try {
      const start = Date.now()
      const resp = await apiClient.get(endpoint)
      const result = { healthy: resp.status === 200, responseTime: Date.now() - start }
      await cacheService.set(cacheKey, result, ttlSeconds)
      return result
    } catch (error: any) {
      const result = { healthy: false, responseTime: undefined, error: error?.message }
      // Cache failures briefly to avoid hot loops
      await cacheService.set(cacheKey, result, Math.max(15, Math.min(ttlSeconds, 60)))
      return result
    } finally {
      inFlightRequests.delete(cacheKey)
    }
  })()

  inFlightRequests.set(cacheKey, reqPromise)
  return reqPromise
}

export async function getRealHoroscope(birthData: any): Promise<any> {
  try {
    // Stable data for a specific birth chart; safe to cache longer
    return await cachedPost('/horoscope', birthData, 24 * 60 * 60)
  } catch (error) {
    logger.error('Horoscope API error:', error)
    throw error
  }
}

export async function getRealPlanetaryPositions(location: {
  lat: number
  lon: number
}): Promise<any> {
  try {
    // Planetary positions change frequently; short cache
    return await cachedPost('/planetary', { location }, 5 * 60)
  } catch (error) {
    logger.error('Planetary API error:', error)
    throw error
  }
}

// Named client used by routes
export const alchmClient = {
  async calculateAlchemy(payload: { birthInfo: any; options?: any }): Promise<any> {
    try {
      // Derived from static birth info; moderate cache
      return await cachedPost('/alchemy/calculate', payload, 60 * 60)
    } catch (error) {
      logger.error('calculateAlchemy error:', error)
      return { success: false, error: 'calculateAlchemy_failed' }
    }
  },
  async imaginize(payload: { birthInfo: any; horoscope?: any; options?: any }): Promise<any> {
    try {
      // Imaginize can vary with options; shorter cache
      return await cachedPost('/alchemy/imaginize', payload, 15 * 60)
    } catch (error) {
      logger.error('imaginize error:', error)
      return { success: false, error: 'imaginize_failed' }
    }
  },
  async healthCheck(): Promise<{ healthy: boolean; responseTime?: number; error?: string }> {
    // Cache health result briefly to avoid spamming external service
    return await cachedGet('/health', 60)
  },
  getStatus(): any {
    // Minimal status; circuit breaker wrapper may expose state in your implementation
    return { open: false }
  },
}
