import { NextRequest, NextResponse } from 'next/server'
import { agentCache, type CacheMetrics } from '@/lib/agent-cache-system'

/**
 * Agent Cache Metrics API Endpoint
 * Provides real-time cache performance statistics
 */

export async function GET(_request: NextRequest) {
  try {
    // Get current cache metrics
    const metrics = await agentCache.getMetrics()

    // Check if caching is available
    const cacheAvailable = agentCache.isAvailable()

    // Calculate additional insights
    const insights = {
      cacheStatus: cacheAvailable ? 'Active' : 'Disabled (Redis not available)',
      performanceLevel: getPerformanceLevel(metrics.hitRate),
      estimatedTimeSaved: formatTimeSaved(metrics.savedTimeMs),
      recommendations: generateRecommendations(metrics),
    }

    return NextResponse.json({
      success: true,
      cacheAvailable,
      metrics: {
        ...metrics,
        hitRatePercent: Math.round(metrics.hitRate * 100),
        missRatePercent: Math.round((1 - metrics.hitRate) * 100),
      },
      insights,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching cache metrics:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cache metrics',
        cacheAvailable: false,
        metrics: {
          totalRequests: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRate: 0,
          hitRatePercent: 0,
          missRatePercent: 100,
          averageResponseTime: 0,
          savedTimeMs: 0,
          similarityMatches: 0,
        },
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, agentId } = body

    if (action === 'clear_agent_cache' && agentId) {
      await agentCache.clearAgentCache(agentId)

      return NextResponse.json({
        success: true,
        message: `Cache cleared for agent: ${agentId}`,
        timestamp: new Date().toISOString(),
      })
    }

    if (action === 'warm_up_cache') {
      await agentCache.warmUpCache()

      return NextResponse.json({
        success: true,
        message: 'Cache warm-up initiated',
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Supported actions: clear_agent_cache, warm_up_cache',
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in cache management:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute cache management action',
      },
      { status: 500 }
    )
  }
}

/**
 * Determine performance level based on hit rate
 */
function getPerformanceLevel(hitRate: number): string {
  if (hitRate >= 0.8) return 'Excellent'
  if (hitRate >= 0.6) return 'Good'
  if (hitRate >= 0.4) return 'Fair'
  if (hitRate >= 0.2) return 'Poor'
  return 'Very Poor'
}

/**
 * Format time saved in a human-readable way
 */
function formatTimeSaved(timeMs: number): string {
  if (timeMs < 1000) return `${Math.round(timeMs)}ms`
  if (timeMs < 60000) return `${Math.round(timeMs / 1000)}s`
  if (timeMs < 3600000) return `${Math.round(timeMs / 60000)}m`
  return `${Math.round(timeMs / 3600000)}h`
}

/**
 * Generate performance recommendations
 */
function generateRecommendations(metrics: CacheMetrics): string[] {
  const recommendations: string[] = []

  if (metrics.hitRate < 0.3) {
    recommendations.push('Low cache hit rate - consider adjusting similarity thresholds')
  }

  if (metrics.totalRequests > 100 && metrics.similarityMatches === 0) {
    recommendations.push('No semantic matches found - verify similarity detection is working')
  }

  if (metrics.hitRate > 0.8) {
    recommendations.push('Excellent cache performance - consider expanding cache TTL')
  }

  if (metrics.totalRequests < 50) {
    recommendations.push('Limited data - more interactions needed for meaningful metrics')
  }

  if (recommendations.length === 0) {
    recommendations.push('Cache is performing well - no immediate action needed')
  }

  return recommendations
}
