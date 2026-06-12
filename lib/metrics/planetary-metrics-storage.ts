export interface AccuracyValidationResult {
  timestamp: string
  source: string
  accuracy: string
  precision: number
  planetsValidated: number
  totalPlanets: number
  responseTime: number
  cached: boolean
}

// In-memory metrics storage (would be Redis in production)
export const metricsStorage: {
  accuracyValidations: AccuracyValidationResult[]
  performanceLogs: { timestamp: number; responseTime: number; accuracy: string; cached: boolean }[]
  cacheHits: number
  cacheMisses: number
  requestsByAccuracy: Record<string, number>
  requestsBySource: Record<string, number>
  lastHealthCheck: Date | null
} = {
  accuracyValidations: [],
  performanceLogs: [],
  cacheHits: 0,
  cacheMisses: 0,
  requestsByAccuracy: {},
  requestsBySource: {},
  lastHealthCheck: null,
}

export function trackPerformanceMetrics(
  responseTime: number,
  accuracy: string,
  cached: boolean,
  source: string
) {
  metricsStorage.performanceLogs.push({
    timestamp: Date.now(),
    responseTime,
    accuracy,
    cached,
  })

  // Keep only last 1000 performance logs
  if (metricsStorage.performanceLogs.length > 1000) {
    metricsStorage.performanceLogs = metricsStorage.performanceLogs.slice(-1000)
  }

  // Track cache hits/misses
  if (cached) {
    metricsStorage.cacheHits++
  } else {
    metricsStorage.cacheMisses++
  }

  // Track usage by accuracy and source
  metricsStorage.requestsByAccuracy[accuracy] =
    (metricsStorage.requestsByAccuracy[accuracy] || 0) + 1
  metricsStorage.requestsBySource[source] = (metricsStorage.requestsBySource[source] || 0) + 1
}
