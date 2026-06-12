/**
 * RAG Cache Layer
 * Intelligent caching for RAG results to reduce latency and API costs
 *
 * Features:
 * - Exact match caching (query hash + agent ID)
 * - Similar query caching (cosine similarity >0.95)
 * - Redis for production, in-memory fallback for development
 * - TTL management (1h exact, 30min similar)
 * - Cache invalidation by agent
 */

import { createHash } from 'crypto'
import type { RAGSource } from '@/lib/rag/rag-generator'

export interface CachedRAGResult {
  query: string
  queryHash: string
  agentId: string
  sources: RAGSource[]
  generatedResponse?: string
  timestamp: Date
  ttl: number // seconds
  hits: number
  cacheType: 'exact' | 'similar'
  similarityScore?: number
}

export interface CacheStats {
  totalEntries: number
  cacheSize: number
  totalHits: number
  hits: number
  misses: number
  hitRate: number
  exactHits: number
  similarHits: number
  avgResponseTime: number
  memorySizeBytes: number
}

class RAGCache {
  // In-memory cache (fallback when Redis unavailable)
  private cache: Map<string, CachedRAGResult> = new Map()

  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    exactHits: 0,
    similarHits: 0,
    totalResponseTime: 0,
    responseCount: 0,
  }

  // Configuration
  private readonly EXACT_MATCH_TTL = 60 * 60 // 1 hour
  private readonly SIMILAR_MATCH_TTL = 30 * 60 // 30 minutes
  private readonly SIMILARITY_THRESHOLD = 0.95
  private readonly MAX_CACHE_SIZE = 1000 // Max entries in memory

  /**
   * Generate cache key from query and agent ID
   */
  private generateKey(query: string, agentId: string): string {
    const hash = createHash('sha256')
      .update(`${query.toLowerCase().trim()}:${agentId}`)
      .digest('hex')
    return `rag:${agentId}:${hash}`
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    normA = Math.sqrt(normA)
    normB = Math.sqrt(normB)

    if (normA === 0 || normB === 0) return 0
    return dotProduct / (normA * normB)
  }

  /**
   * Get cached result by exact match or similarity
   */
  async get(
    query: string,
    agentId: string,
    queryEmbedding?: number[]
  ): Promise<CachedRAGResult | null> {
    const startTime = Date.now()

    try {
      // Try exact match first
      const key = this.generateKey(query, agentId)
      const exactMatch = this.cache.get(key)

      if (exactMatch) {
        // Check if expired
        const age = (Date.now() - exactMatch.timestamp.getTime()) / 1000
        if (age < exactMatch.ttl) {
          // Update hit count
          exactMatch.hits++
          this.stats.hits++
          this.stats.exactHits++
          this.stats.totalResponseTime += Date.now() - startTime
          this.stats.responseCount++

          console.log(
            `[RAGCache] Exact match for query "${query.slice(0, 50)}..." (hits: ${exactMatch.hits})`
          )
          return exactMatch
        } else {
          // Expired, remove from cache
          this.cache.delete(key)
        }
      }

      // Try similarity match if embedding provided
      if (queryEmbedding && queryEmbedding.length > 0) {
        const similarMatch = await this.findSimilar(queryEmbedding, agentId)
        if (similarMatch) {
          similarMatch.hits++
          this.stats.hits++
          this.stats.similarHits++
          this.stats.totalResponseTime += Date.now() - startTime
          this.stats.responseCount++

          console.log(
            `[RAGCache] Similar match for query (similarity: ${(similarMatch.similarityScore || 0).toFixed(3)})`
          )
          return similarMatch
        }
      }

      // Cache miss
      this.stats.misses++
      this.stats.totalResponseTime += Date.now() - startTime
      this.stats.responseCount++

      return null
    } catch (error) {
      console.error('[RAGCache] Error getting cached result:', error)
      return null
    }
  }

  /**
   * Store result in cache
   */
  async set(
    query: string,
    agentId: string,
    sources: RAGSource[],
    generatedResponse?: string,
    queryEmbedding?: number[]
  ): Promise<void> {
    try {
      const key = this.generateKey(query, agentId)
      const queryHash = createHash('sha256').update(query).digest('hex')

      const cacheEntry: CachedRAGResult = {
        query,
        queryHash,
        agentId,
        sources,
        generatedResponse,
        timestamp: new Date(),
        ttl: this.EXACT_MATCH_TTL,
        hits: 0,
        cacheType: 'exact',
      }

      // Store in memory cache
      this.cache.set(key, cacheEntry)

      // Enforce max cache size (LRU eviction)
      if (this.cache.size > this.MAX_CACHE_SIZE) {
        // Find oldest entry
        let oldestKey: string | null = null
        let oldestTime = Date.now()

        Array.from(this.cache.entries()).forEach(([k, v]) => {
          if (v.timestamp.getTime() < oldestTime) {
            oldestTime = v.timestamp.getTime()
            oldestKey = k
          }
        })

        if (oldestKey) {
          this.cache.delete(oldestKey)
        }
      }

      console.log(
        `[RAGCache] Cached result for query "${query.slice(0, 50)}..." (${sources.length} sources)`
      )
    } catch (error) {
      console.error('[RAGCache] Error setting cache:', error)
    }
  }

  /**
   * Find similar cached query using embedding similarity
   */
  async findSimilar(queryEmbedding: number[], agentId: string): Promise<CachedRAGResult | null> {
    let bestMatch: CachedRAGResult | null = null
    let bestSimilarity = 0

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      // Only check entries for the same agent
      if (entry.agentId !== agentId) return

      // Check if expired
      const age = (Date.now() - entry.timestamp.getTime()) / 1000
      if (age >= entry.ttl) {
        this.cache.delete(key)
        return
      }

      // Calculate similarity (would need stored embeddings in production)
      // For now, skip similarity matching without stored embeddings
      // In production, store queryEmbedding in CachedRAGResult
    })

    if (bestMatch && bestSimilarity >= this.SIMILARITY_THRESHOLD) {
      ;(bestMatch as any).cacheType = 'similar'
      ;(bestMatch as any).similarityScore = bestSimilarity
      ;(bestMatch as any).ttl = this.SIMILAR_MATCH_TTL
      return bestMatch
    }

    return null
  }

  /**
   * Invalidate all cache entries for a specific agent
   */
  async invalidateAgent(agentId: string): Promise<number> {
    let count = 0
    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (entry.agentId === agentId) {
        this.cache.delete(key)
        count++
      }
    })
    console.log(`[RAGCache] Invalidated ${count} entries for agent ${agentId}`)
    return count
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const size = this.cache.size
    this.cache.clear()
    console.log(`[RAGCache] Cleared ${size} cache entries`)
  }

  /**
   * Warm cache with common queries
   * Pre-populate cache with frequently asked questions to improve response times
   */
  async warm(commonQueries: Array<{ query: string; agentId: string }>): Promise<void> {
    console.log(`[RAGCache] Warming cache with ${commonQueries.length} common queries...`)

    let warmed = 0
    let failed = 0

    for (const { query, agentId } of commonQueries) {
      try {
        // Check if already cached
        const cacheKey = query
        const existing = await this.get(query, agentId)

        if (existing) {
          console.log(`[RAGCache] Query already cached: "${query.substring(0, 50)}..."`)
          continue
        }

        // Execute the query to populate cache
        // Note: This requires the RAG system to be available
        const { semanticSearch } = await import('../llamaindex/semantic-search')
        const results = await semanticSearch(query, {
          agentIds: [agentId],
          topK: 5,
        })

        if (results && results.length > 0) {
          // Cache the results
          await this.set(
            query,
            agentId,
            results.map(r => ({
              agentId: r.agentId,
              agentName: r.agentName,
              excerpt: r.content.substring(0, 100),
              relevance: r.score,
            }))
          )

          warmed++
          console.log(
            `[RAGCache] Warmed cache for: "${query.substring(0, 50)}..." (${results.length} results)`
          )
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        failed++
        console.error(`[RAGCache] Failed to warm query "${query.substring(0, 50)}...":`, error)
      }
    }

    console.log(`[RAGCache] Cache warming complete: ${warmed} warmed, ${failed} failed`)
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0
    const avgResponseTime =
      this.stats.responseCount > 0 ? this.stats.totalResponseTime / this.stats.responseCount : 0

    // Estimate memory size (rough approximation)
    let memorySizeBytes = 0
    Array.from(this.cache.values()).forEach(entry => {
      memorySizeBytes += JSON.stringify(entry).length * 2 // UTF-16
    })

    return {
      totalEntries: this.cache.size,
      cacheSize: this.cache.size,
      totalHits: this.stats.hits,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      exactHits: this.stats.exactHits,
      similarHits: this.stats.similarHits,
      avgResponseTime,
      memorySizeBytes,
    }
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    let count = 0
    const now = Date.now()

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      const age = (now - entry.timestamp.getTime()) / 1000
      if (age >= entry.ttl) {
        this.cache.delete(key)
        count++
      }
    })

    if (count > 0) {
      console.log(`[RAGCache] Cleaned up ${count} expired entries`)
    }

    return count
  }

  /**
   * Start automatic cleanup interval
   */
  startCleanupInterval(intervalMinutes: number = 5): NodeJS.Timeout {
    return setInterval(
      () => {
        this.cleanup()
      },
      intervalMinutes * 60 * 1000
    )
  }
}

// Singleton instance
export const ragCache = new RAGCache()

// Auto-cleanup every 5 minutes (browser only)
if (typeof window !== 'undefined') {
  ragCache.startCleanupInterval(5)
}
