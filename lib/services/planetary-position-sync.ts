/**
 * Planetary Position Synchronization Service
 * ========================================
 *
 * Cross-backend synchronization service that connects Planetary Agents' VSOP87
 * astronomical precision with WhatToEatNext's planetary position rectification.
 * Ensures the most accurate astrological calculations in spiritual technology history.
 */

import { syncMonitoringService } from './sync-monitoring'
import { backend } from '@/lib/backend'
import { calculateAllPlanets, type EnhancedBirthInfo } from '@/lib/enhanced-astronomical-calculator'

export interface PlanetaryPositionSync {
  planet: string
  sign: string
  degree: number
  exact_longitude: number
  is_retrograde: boolean
  source: 'planetary_agents' | 'whattoeatnext'
  confidence: number
  last_updated: string
  accuracy_level: 'authoritative' | 'rectified' | 'partial'
  corrections_applied?: boolean
  original_discrepancy?: number
  validated_by?: string
  validation_confidence?: number
}

export interface SyncResult {
  success: boolean
  synchronized_positions: Record<string, PlanetaryPositionSync>
  sync_report: {
    sync_duration_ms: number
    discrepancies_found: number
    corrections_applied: number
    authoritative_source: string
  }
  errors?: string[]
}

export interface SyncHealthStatus {
  planetary_agents_available: boolean
  whattoeatnext_available: boolean
  vsop87_available: boolean
  sync_service_active: boolean
  last_sync_attempt: string
  last_successful_sync: string
  overall_health: 'healthy' | 'warning' | 'critical'
}

export interface SyncStatus {
  is_enabled: boolean
  last_sync_result?: SyncResult
  health_status: SyncHealthStatus
  cache_stats: {
    size: number
    hit_rate: number
    last_cleanup: string
  }
  metrics: {
    total_syncs: number
    successful_syncs: number
    average_sync_time_ms: number
    total_discrepancies: number
    total_corrections: number
  }
}

export class PlanetaryPositionSyncService {
  private readonly whattoeatnextBaseUrl: string
  private readonly apiKey: string
  private readonly cache = new Map<string, { data: SyncResult; timestamp: number }>()
  /**
   * Cache TTL in ms. Mutable at runtime via setCacheTtl() so an
   * operator can shrink the window during incident response without
   * a redeploy. Default 5 minutes — same as the original constant.
   */
  private cacheTtlMs = 5 * 60 * 1000
  private lastSyncAttempt?: string
  private lastSuccessfulSync?: string
  private lastSyncResult?: SyncResult
  private metrics = {
    total_syncs: 0,
    successful_syncs: 0,
    average_sync_time: 0,
    total_discrepancies: 0,
    total_corrections: 0,
  }

  constructor() {
    this.whattoeatnextBaseUrl = this.resolveWhatToEatNextBaseUrl(process.env.WHATTOEATNEXT_BASE_URL)
    this.apiKey = process.env.WHATTOEATNEXT_API_KEY || ''
  }

  private resolveWhatToEatNextBaseUrl(configuredUrl?: string): string {
    const candidate = configuredUrl || 'https://whattoeatnext-production.up.railway.app'
    try {
      const parsed = new URL(candidate)
      if (parsed.hostname === 'api.alchm.kitchen') {
        return 'https://whattoeatnext-production.up.railway.app'
      }
      return parsed.origin
    } catch {
      return 'https://whattoeatnext-production.up.railway.app'
    }
  }

  /**
   * Main synchronization method - connects VSOP87 with WhatToEatNext rectification
   */
  async synchronizePositions(targetDate?: Date): Promise<SyncResult> {
    const date = targetDate || new Date()
    const cacheKey = `sync_${date.toISOString().slice(0, 16)}` // 1-minute precision cache

    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.data
    }

    const startTime = Date.now()

    try {
      // Get our VSOP87 positions
      const ourPositions = await this.getPlanetaryAgentsPositions(date)

      // Get WhatToEatNext rectified positions
      const theirPositions = await this.getWhatToEatNextPositions(date)

      // Perform synchronization
      const syncResult = this.performSynchronization(ourPositions, theirPositions, date)

      const result: SyncResult = {
        success: syncResult.success,
        synchronized_positions: syncResult.synchronized_positions,
        sync_report: {
          sync_duration_ms: Date.now() - startTime,
          discrepancies_found: syncResult.discrepancies_found,
          corrections_applied: syncResult.corrections_applied,
          authoritative_source: syncResult.authoritative_source,
        },
      }

      // Update metrics
      this.updateMetrics(result)
      this.lastSyncAttempt = new Date().toISOString()
      this.lastSuccessfulSync = this.lastSyncAttempt
      this.lastSyncResult = result

      // Cache successful results
      if (result.success) {
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
      }

      // Log result to monitoring service
      syncMonitoringService.logSyncResult(result)

      return result
    } catch (error) {
      console.error('Planetary position synchronization failed:', error)
      const result = {
        success: false,
        synchronized_positions: {},
        sync_report: {
          sync_duration_ms: Date.now() - startTime,
          discrepancies_found: 0,
          corrections_applied: 0,
          authoritative_source: 'sync_error',
        },
        errors: [error instanceof Error ? error.message : String(error)],
      }
      this.lastSyncAttempt = new Date().toISOString()
      this.lastSyncResult = result
      syncMonitoringService.logSyncResult(result)
      return result
    }
  }

  /**
   * Get positions from Planetary Agents' VSOP87 system
   */
  private async getPlanetaryAgentsPositions(
    date: Date,
    latitude: number = 40.7128,
    longitude: number = -74.006
  ): Promise<Record<string, PlanetaryPositionSync>> {
    const calculationInput: EnhancedBirthInfo = {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
      latitude,
      longitude,
    }

    const result = calculateAllPlanets(calculationInput)
    const timestamp = new Date().toISOString()
    const positions: Record<string, PlanetaryPositionSync> = {}

    Object.entries(result.planets).forEach(([planet, pos]) => {
      positions[planet] = {
        planet,
        sign: pos.sign,
        degree: pos.signDegree,
        exact_longitude: pos.longitude,
        is_retrograde: Boolean(pos.retrograde),
        source: 'planetary_agents',
        confidence: 1.0,
        last_updated: timestamp,
        accuracy_level: 'authoritative',
      }
    })

    return positions
  }

  /**
   * Get rectified positions from WhatToEatNext
   */
  private async getWhatToEatNextPositions(
    date: Date,
    latitude: number = 40.7128,
    longitude: number = -74.006
  ): Promise<Record<string, PlanetaryPositionSync>> {
    const data = await backend.planetary.positions(date, latitude, longitude)
    const positions: Record<string, PlanetaryPositionSync> = {}

    Object.entries(data.planetary_positions || {}).forEach(([planet, pos]: [string, any]) => {
      positions[planet] = {
        planet,
        sign: pos.sign,
        degree: pos.degree,
        exact_longitude: pos.exactLongitude ?? pos.exact_longitude,
        is_retrograde: pos.isRetrograde ?? pos.is_retrograde ?? false,
        source: 'whattoeatnext',
        confidence: 0.9,
        last_updated: new Date().toISOString(),
        accuracy_level: 'rectified',
      }
    })

    if (Object.keys(positions).length === 0) {
      throw new Error('WhatToEatNext returned no synchronized positions')
    }

    return positions
  }

  /**
   * Perform the actual synchronization logic
   */
  private performSynchronization(
    ourPositions: Record<string, PlanetaryPositionSync>,
    theirPositions: Record<string, PlanetaryPositionSync>,
    date: Date
  ): {
    success: boolean
    synchronized_positions: Record<string, PlanetaryPositionSync>
    discrepancies_found: number
    corrections_applied: number
    authoritative_source: string
  } {
    const synchronized: Record<string, PlanetaryPositionSync> = {}
    let discrepancies_found = 0
    let corrections_applied = 0

    // Get all planet names
    const allPlanets = new Set([...Object.keys(ourPositions), ...Object.keys(theirPositions)])

    for (const planet of allPlanets) {
      const ourPos = ourPositions[planet]
      const theirPos = theirPositions[planet]

      if (ourPos && theirPos) {
        // Both systems have data - compare and synchronize
        const discrepancy = Math.abs(ourPos.exact_longitude - theirPos.exact_longitude)

        if (discrepancy > 0.01) {
          // More than 0.01° difference
          discrepancies_found++

          // Use our position as authoritative (we have VSOP87 precision)
          synchronized[planet] = {
            ...ourPos,
            corrections_applied: true,
            original_discrepancy: discrepancy,
          }
          corrections_applied++
        } else {
          // Positions agree within tolerance
          synchronized[planet] = {
            ...ourPos,
            validated_by: 'whattoeatnext',
            validation_confidence: 1.0,
          }
        }
      } else if (ourPos) {
        // Only we have data
        synchronized[planet] = ourPos
      } else if (theirPos) {
        // Only they have data - surface as partial, not fallback
        synchronized[planet] = {
          ...theirPos,
          accuracy_level: 'partial',
        }
      }
    }

    return {
      success: true,
      synchronized_positions: synchronized,
      discrepancies_found,
      corrections_applied,
      authoritative_source: 'planetary_agents_vsop87',
    }
  }

  /**
   * Handle webhook sync updates from WhatToEatNext
   */
  async handleWebhookSync(positions: Record<string, any>, date: string): Promise<boolean> {
    try {
      // Validate webhook data
      const targetDate = new Date(date)
      if (isNaN(targetDate.getTime())) {
        throw new Error('Invalid date in webhook')
      }

      // Convert webhook format to our sync format
      const theirPositions: Record<string, PlanetaryPositionSync> = {}
      Object.entries(positions).forEach(([planet, pos]: [string, any]) => {
        theirPositions[planet] = {
          planet,
          sign: pos.sign,
          degree: pos.degree,
          exact_longitude: pos.exact_longitude,
          is_retrograde: pos.is_retrograde || false,
          source: 'whattoeatnext',
          confidence: pos.confidence || 0.9,
          last_updated: pos.timestamp || new Date().toISOString(),
          accuracy_level: 'rectified',
        }
      })

      // Perform synchronization with webhook data
      const ourPositions = await this.getPlanetaryAgentsPositions(targetDate)
      const syncResult = this.performSynchronization(ourPositions, theirPositions, targetDate)

      // Update metrics
      const result: SyncResult = {
        success: true,
        synchronized_positions: syncResult.synchronized_positions,
        sync_report: {
          sync_duration_ms: 0, // Webhook doesn't have duration
          discrepancies_found: syncResult.discrepancies_found,
          corrections_applied: syncResult.corrections_applied,
          authoritative_source: syncResult.authoritative_source,
        },
      }

      this.updateMetrics(result)

      return true
    } catch (error) {
      console.error('Webhook sync processing failed:', error)
      return false
    }
  }

  /**
   * Emergency synchronization - bypasses cache and forces fresh calculations
   */
  async emergencySynchronization(targetDate?: Date): Promise<SyncResult> {
    const date = targetDate || new Date()

    // Clear cache for this date
    const cacheKey = `sync_${date.toISOString().slice(0, 16)}`
    this.cache.delete(cacheKey)

    // Force fresh sync
    return await this.synchronizePositions(date)
  }

  /**
   * Get health status of cross-backend synchronization
   */
  async getHealthStatus(): Promise<SyncHealthStatus> {
    try {
      const now = new Date()
      const localCalculation = calculateAllPlanets({
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
        day: now.getUTCDate(),
        hour: now.getUTCHours(),
        minute: now.getUTCMinutes(),
        second: now.getUTCSeconds(),
        latitude: 0,
        longitude: 0,
      })
      const vsop87_available = Object.keys(localCalculation.planets).length > 0

      // Test WhatToEatNext connectivity
      let whattoeatnext_available = false
      try {
        const theirHealth = await fetch(`${this.whattoeatnextBaseUrl}/health`, {
          signal: AbortSignal.timeout(5000),
        })
        whattoeatnext_available = theirHealth.ok
      } catch (innerError) {
        console.warn('WhatToEatNext health check failed:', innerError)
      }

      // Check if sync service is active (we're running)
      const sync_service_active = true

      const overall_health =
        vsop87_available && whattoeatnext_available && sync_service_active
          ? 'healthy'
          : !whattoeatnext_available || !sync_service_active
            ? 'warning'
            : 'critical'

      return {
        planetary_agents_available: vsop87_available,
        whattoeatnext_available,
        vsop87_available,
        sync_service_active,
        last_sync_attempt: this.lastSyncAttempt || new Date().toISOString(),
        last_successful_sync: this.lastSuccessfulSync || 'never',
        overall_health,
      }
    } catch (error) {
      return {
        planetary_agents_available: false,
        whattoeatnext_available: false,
        vsop87_available: false,
        sync_service_active: false,
        last_sync_attempt: this.lastSyncAttempt || new Date().toISOString(),
        last_successful_sync: this.lastSuccessfulSync || 'never',
        overall_health: 'critical',
      }
    }
  }

  /**
   * Get comprehensive sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const health = await this.getHealthStatus()

    return {
      is_enabled: process.env.CROSS_BACKEND_SYNC_ENABLED === 'true',
      last_sync_result: this.lastSyncResult,
      health_status: health,
      cache_stats: {
        size: this.cache.size,
        hit_rate:
          this.metrics.total_syncs > 0
            ? this.metrics.successful_syncs / this.metrics.total_syncs
            : 0,
        last_cleanup: new Date().toISOString(), // Would track actual cleanup time
      },
      metrics: {
        total_syncs: this.metrics.total_syncs,
        successful_syncs: this.metrics.successful_syncs,
        average_sync_time_ms: this.metrics.average_sync_time,
        total_discrepancies: this.metrics.total_discrepancies,
        total_corrections: this.metrics.total_corrections,
      },
    }
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(result: SyncResult): void {
    this.metrics.total_syncs++

    if (result.success) {
      this.metrics.successful_syncs++
    }

    this.metrics.average_sync_time =
      (this.metrics.average_sync_time * (this.metrics.total_syncs - 1) +
        result.sync_report.sync_duration_ms) /
      this.metrics.total_syncs

    this.metrics.total_discrepancies += result.sync_report.discrepancies_found
    this.metrics.total_corrections += result.sync_report.corrections_applied
  }

  /**
   * Clear sync cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[]; hitRate: number } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      hitRate:
        this.metrics.total_syncs > 0 ? this.metrics.successful_syncs / this.metrics.total_syncs : 0,
    }
  }

  /**
   * Runtime cache TTL adjustment. Clamped to [1s, 1h] — anything
   * outside that range is almost certainly a unit confusion or a
   * footgun. The new value is in-memory and resets on restart, which
   * is intentional: persistent config belongs in env vars, this is
   * for incident-response tuning.
   */
  setCacheTtl(ttlMs: number): { applied: number; previous: number } {
    const previous = this.cacheTtlMs
    const clamped = Math.min(Math.max(1_000, Math.round(ttlMs)), 60 * 60 * 1000)
    this.cacheTtlMs = clamped
    return { applied: clamped, previous }
  }

  /** Read the current runtime cache TTL in ms. */
  getCacheTtl(): number {
    return this.cacheTtlMs
  }
}

// Export singleton instance
export const planetaryPositionSyncService = new PlanetaryPositionSyncService()
