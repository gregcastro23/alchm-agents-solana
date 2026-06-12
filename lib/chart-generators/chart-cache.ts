// lib/chart-generators/chart-cache.ts
// Simple in-memory cache for generated charts

import { BirthInfo } from '../schemas'
import { AstrologizeWheelResponse } from '../astrologize'

interface CacheEntry {
  data: AstrologizeWheelResponse
  timestamp: number
  expiresAt: number
}

class ChartCache {
  private cache = new Map<string, CacheEntry>()
  private readonly defaultTTL = 60 * 60 * 1000 // 1 hour for birth charts
  private readonly momentTTL = 5 * 60 * 1000 // 5 minutes for current moment charts

  /**
   * Generate cache key from birth info
   */
  private generateKey(birthInfo: BirthInfo, isCurrentMoment = false): string {
    if (isCurrentMoment) {
      // For current moment charts, cache by day to avoid too frequent regeneration
      const now = new Date()
      return `moment-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`
    }

    // For birth charts, cache based on exact birth data
    return `birth-${birthInfo.year}-${birthInfo.month}-${birthInfo.day}-${birthInfo.hour}-${birthInfo.minute}-${birthInfo.latitude || 0}-${birthInfo.longitude || 0}`
  }

  /**
   * Get cached chart if available and not expired
   */
  get(birthInfo: BirthInfo, isCurrentMoment = false): AstrologizeWheelResponse | null {
    const key = this.generateKey(birthInfo, isCurrentMoment)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Update access time for LRU-like behavior
    entry.timestamp = Date.now()
    return entry.data
  }

  /**
   * Store chart in cache
   */
  set(birthInfo: BirthInfo, data: AstrologizeWheelResponse, isCurrentMoment = false): void {
    const key = this.generateKey(birthInfo, isCurrentMoment)
    const ttl = isCurrentMoment ? this.momentTTL : this.defaultTTL
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    }

    this.cache.set(key, entry)

    // Simple cache size management - remove oldest entries if too large
    if (this.cache.size > 100) {
      this.cleanup()
    }
  }

  /**
   * Clean up expired and old entries
   */
  private cleanup(): void {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())

    // Remove expired entries
    entries.forEach(([key, entry]) => {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    })

    // If still too large, remove oldest entries
    if (this.cache.size > 50) {
      const sortedEntries = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp
      )

      // Remove oldest 25 entries
      sortedEntries.slice(0, 25).forEach(([key]) => {
        this.cache.delete(key)
      })
    }
  }

  /**
   * Clear all cached charts
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

// Export singleton instance
export const chartCache = new ChartCache()
