import { createClient, RedisClientType } from 'redis'
import { logger } from '../utils/logger.js'

interface CacheItem {
  value: any
  expiresAt: number
}

class CacheService {
  private redisClient: RedisClientType | null = null
  private memoryCache: Map<string, CacheItem> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null
  private isRedisConnected: boolean = false

  async connect(): Promise<void> {
    const redisUrl = process.env.REDIS_URL
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.NO_REDIS === 'true'

    if (redisUrl && !isTestEnv) {
      try {
        this.redisClient = createClient({
          url: redisUrl,
          socket: {
            connectTimeout: 2000, // 2 second connection timeout
            reconnectStrategy: false, // Don't retry in test environment
          },
        })

        this.redisClient.on('error', err => {
          logger.error('Redis client error:', err)
          this.isRedisConnected = false
        })

        this.redisClient.on('connect', () => {
          logger.info('Redis client connected')
          this.isRedisConnected = true
        })

        this.redisClient.on('disconnect', () => {
          logger.warn('Redis client disconnected')
          this.isRedisConnected = false
        })

        // Add connection timeout promise to fail fast
        const connectPromise = this.redisClient.connect()
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection timeout after 3s')), 3000)
        )

        await Promise.race([connectPromise, timeoutPromise])
        logger.info('Cache service initialized with Redis')
      } catch (error) {
        logger.warn('Failed to connect to Redis, using memory cache:', error)
        // Clean up failed Redis client
        if (this.redisClient) {
          this.redisClient.disconnect().catch(() => {})
          this.redisClient = null
        }
        this.setupMemoryCache()
      }
    } else {
      logger.info(
        `Cache service initialized with memory fallback${isTestEnv ? ' (test environment)' : ''}`
      )
      this.setupMemoryCache()
    }
  }

  private setupMemoryCache(): void {
    logger.info('Cache service initialized with memory fallback')

    // Cleanup expired items every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupMemoryCache()
      },
      5 * 60 * 1000
    )
  }

  private cleanupMemoryCache(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expiresAt <= now) {
        this.memoryCache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired items from memory cache`)
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      // Try Redis first if available
      if (this.redisClient && this.isRedisConnected) {
        const value = await this.redisClient.get(key)
        if (value && typeof value === 'string') {
          return JSON.parse(value) as T
        }
        return null
      }

      // Fallback to memory cache
      const item = this.memoryCache.get(key)
      if (item) {
        if (item.expiresAt > Date.now()) {
          return item.value as T
        } else {
          // Expired item
          this.memoryCache.delete(key)
        }
      }

      return null
    } catch (error) {
      logger.error('Cache get error:', error)
      return null
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      // Try Redis first if available
      if (this.redisClient && this.isRedisConnected) {
        await this.redisClient.setEx(key, ttlSeconds, JSON.stringify(value))
        return true
      }

      // Fallback to memory cache
      const expiresAt = Date.now() + ttlSeconds * 1000
      this.memoryCache.set(key, { value, expiresAt })

      return true
    } catch (error) {
      logger.error('Cache set error:', error)
      return false
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      // Try Redis first if available
      if (this.redisClient && this.isRedisConnected) {
        await this.redisClient.del(key)
      }

      // Also remove from memory cache
      this.memoryCache.delete(key)

      return true
    } catch (error) {
      logger.error('Cache delete error:', error)
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      // Try Redis first if available
      if (this.redisClient && this.isRedisConnected) {
        const exists = await this.redisClient.exists(key)
        return exists === 1
      }

      // Fallback to memory cache
      const item = this.memoryCache.get(key)
      if (item && item.expiresAt > Date.now()) {
        return true
      }

      return false
    } catch (error) {
      logger.error('Cache exists error:', error)
      return false
    }
  }

  async flush(): Promise<boolean> {
    try {
      // Try Redis first if available
      if (this.redisClient && this.isRedisConnected) {
        await this.redisClient.flushDb()
      }

      // Also clear memory cache
      this.memoryCache.clear()

      return true
    } catch (error) {
      logger.error('Cache flush error:', error)
      return false
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      // Try Redis first if available
      if (this.redisClient && this.isRedisConnected) {
        return await this.redisClient.keys(pattern)
      }

      // Fallback to memory cache with simple pattern matching
      const keys: string[] = []
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))

      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          keys.push(key)
        }
      }

      return keys
    } catch (error) {
      logger.error('Cache keys error:', error)
      return []
    }
  }

  isConnected(): boolean {
    return this.isRedisConnected || this.memoryCache.size >= 0
  }

  getStats(): {
    type: 'redis' | 'memory'
    connected: boolean
    memoryItems: number
    redisConnected: boolean
  } {
    return {
      type: this.redisClient ? 'redis' : 'memory',
      connected: this.isRedisConnected || true,
      memoryItems: this.memoryCache.size,
      redisConnected: this.redisClient !== null && this.isRedisConnected,
    }
  }

  disconnect(): void {
    if (this.redisClient) {
      this.redisClient.disconnect()
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.memoryCache.clear()
    logger.info('Cache service disconnected')
  }
}

// Singleton instance
export const cacheService = new CacheService()
export default cacheService
