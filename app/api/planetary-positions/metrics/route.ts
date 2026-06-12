import { NextRequest, NextResponse } from 'next/server'
import { planetaryPositionsService } from '@/lib/services/planetary-positions-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function buildMetrics(validation: Awaited<ReturnType<typeof runValidation>>) {
  const cacheStats = planetaryPositionsService.getCacheStats()
  const totalRequests = 1
  const cacheHits = validation?.cached ? 1 : 0
  const cacheMisses = totalRequests - cacheHits
  const responseTime = validation.responseTime
  const source = validation.source
  const accuracy = validation.accuracy

  return {
    accuracyValidation: {
      lastValidation: validation,
      averagePrecision: validation.precision,
      validationCount: 1,
      sourcesUsed: { [source]: 1 },
    },
    cache: {
      hits: cacheHits,
      misses: cacheMisses,
      hitRate: totalRequests > 0 ? cacheHits / totalRequests : 0,
      totalRequests,
      averageCacheAge: 0,
      cacheSize: cacheStats.size,
    },
    performance: {
      p50: responseTime,
      p95: responseTime,
      p99: responseTime,
      average: responseTime,
      min: responseTime,
      max: responseTime,
      totalRequests,
    },
    health: {
      circuitBreakers: {},
      externalApiStatus: validation.accuracy === 'fallback' ? 'degraded' : 'healthy',
      lastHealthCheck: new Date().toISOString(),
    },
    usage: {
      requestsByAccuracy: { high: 0, medium: 0, low: 0, fallback: 0, [accuracy]: 1 },
      requestsBySource: { [source]: 1 },
      popularTimeRanges: {},
    },
  }
}

async function runValidation() {
  const startedAt = Date.now()
  const data = await planetaryPositionsService.getPlanetaryPositions(new Date(), {
    accuracy: 'high',
    useCache: true,
  })
  const responseTime = Date.now() - startedAt
  const valid = planetaryPositionsService.validatePositions(data.planetaryPositions)

  return {
    timestamp: data.timestamp,
    source: data.source,
    accuracy: data.accuracy,
    precision: data.accuracy === 'high' ? 0.01 : data.accuracy === 'medium' ? 0.1 : 1,
    planetsValidated: valid ? data.planetaryPositions.length : 0,
    totalPlanets: data.planetaryPositions.length,
    responseTime,
    cached: data.cached,
  }
}

export async function GET(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get('action')
    const validation = await runValidation()

    if (action === 'validate') {
      return NextResponse.json({
        success: true,
        validation,
        timestamp: new Date().toISOString(),
      })
    }

    if (action === 'health') {
      return NextResponse.json({
        success: true,
        health: {
          status: validation.accuracy === 'fallback' ? 'degraded' : 'healthy',
          source: validation.source,
          accuracy: validation.accuracy,
          responseTime: validation.responseTime,
          lastHealthCheck: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      metrics: buildMetrics(validation),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load planetary position metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
