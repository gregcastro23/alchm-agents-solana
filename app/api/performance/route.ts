import { NextResponse } from 'next/server'
import { performanceCache } from '@/lib/performance-cache'

// Performance monitoring API endpoint
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    if (action === 'stats') {
      // Return cache statistics
      const stats = performanceCache.getStats()

      return NextResponse.json({
        success: true,
        stats: {
          ...stats,
          performance: {
            cacheHitRatio: calculateCacheHitRatio(stats),
            averageAge: calculateAverageAge(stats.entries),
            expiredEntries: stats.entries.filter(entry => entry.expired).length,
            activeEntries: stats.entries.filter(entry => !entry.expired).length,
          },
        },
      })
    }

    if (action === 'clear') {
      const type = searchParams.get('type') as 'planetary' | 'alchemical' | 'elemental'

      if (type) {
        performanceCache.clearType(type)
        return NextResponse.json({
          success: true,
          message: `Cleared ${type} cache`,
        })
      } else {
        performanceCache.clear()
        return NextResponse.json({
          success: true,
          message: 'Cleared all cache',
        })
      }
    }

    return NextResponse.json({
      success: true,
      info: {
        description: 'Performance Monitoring API',
        endpoints: {
          'GET /api/performance?action=stats': 'Get cache statistics',
          'GET /api/performance?action=clear': 'Clear all cache',
          'GET /api/performance?action=clear&type=planetary': 'Clear planetary cache',
          'GET /api/performance?action=clear&type=alchemical': 'Clear alchemical cache',
          'GET /api/performance?action=clear&type=elemental': 'Clear elemental cache',
        },
      },
    })
  } catch (error) {
    console.error('Performance API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process performance request',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// Cache performance tracking
interface CacheMetrics {
  hits: number
  misses: number
  totalRequests: number
  startTime: number
}

// In-memory cache metrics (in production, this should be persisted)
let cacheMetrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  totalRequests: 0,
  startTime: Date.now(),
}

// Helper functions for performance calculations
function calculateCacheHitRatio(stats: any): string {
  // Use actual tracked metrics if available
  if (cacheMetrics.totalRequests > 0) {
    const ratio = (cacheMetrics.hits / cacheMetrics.totalRequests) * 100
    return `${ratio.toFixed(1)}%`
  }

  // Fallback to estimated ratio based on cache content
  const activeEntries = stats.entries
    ? stats.entries.filter((entry: any) => !entry.expired).length
    : 0
  const totalEntries = stats.size || 0

  if (totalEntries === 0) return '0%'

  const ratio = (activeEntries / totalEntries) * 100
  return `${ratio.toFixed(1)}%`
}

// Functions to track cache performance (should be called by cache operations)
function recordCacheHit(): void {
  cacheMetrics.hits++
  cacheMetrics.totalRequests++
}

function recordCacheMiss(): void {
  cacheMetrics.misses++
  cacheMetrics.totalRequests++
}

function getCacheMetrics(): CacheMetrics {
  return { ...cacheMetrics }
}

function resetCacheMetrics(): void {
  cacheMetrics = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    startTime: Date.now(),
  }
}

function calculateAverageAge(entries: any[]): number {
  if (entries.length === 0) return 0

  const totalAge = entries.reduce((sum, entry) => sum + entry.age, 0)
  return Math.round(totalAge / entries.length)
}

// POST endpoint for performance actions
export async function POST(req: Request) {
  try {
    const { action } = await req.json()

    if (action === 'benchmark') {
      // Run a simple benchmark test
      const startTime = Date.now()

      // Simulate some cache operations
      const testData = { test: 'benchmark', timestamp: Date.now() }

      for (let i = 0; i < 100; i++) {
        performanceCache.set(`benchmark-${i}`, testData)
        performanceCache.get(`benchmark-${i}`)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      return NextResponse.json({
        success: true,
        benchmark: {
          operations: 200, // 100 sets + 100 gets
          duration: `${duration}ms`,
          operationsPerSecond: Math.round(200 / (duration / 1000)),
        },
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unknown action',
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Performance POST API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process performance action',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
