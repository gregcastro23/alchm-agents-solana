import { NextRequest, NextResponse } from 'next/server'
import { ApiResilienceSystem, ApiMetrics, CircuitBreakerState } from '@/lib/api-resilience-system'

/**
 * Agent API Resilience Metrics Endpoint
 * Provides real-time API health, circuit breaker status, and retry statistics
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const apiName = searchParams.get('api')

    if (apiName) {
      // Get metrics for specific API
      const metrics = ApiResilienceSystem.getApiMetrics(apiName) as ApiMetrics | null
      const circuitStatus = ApiResilienceSystem.getCircuitBreakerStatus(
        apiName
      ) as CircuitBreakerState | null

      if (!metrics) {
        return NextResponse.json(
          {
            success: false,
            error: `No metrics found for API: ${apiName}`,
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        apiName,
        metrics: {
          ...metrics,
          uptimePercent: Math.round(metrics.uptime * 100),
          failureRate: Math.round((1 - metrics.uptime) * 100),
          retryRate:
            metrics.totalCalls > 0
              ? Math.round((metrics.retriedCalls / metrics.totalCalls) * 100)
              : 0,
        },
        circuitBreaker: circuitStatus
          ? {
              ...circuitStatus,
              isOpen: circuitStatus.state === 'OPEN',
              isHalfOpen: circuitStatus.state === 'HALF_OPEN',
            }
          : null,
        timestamp: new Date().toISOString(),
      })
    } else {
      // Get all system metrics
      const allMetrics = ApiResilienceSystem.getApiMetrics() as Map<string, any>
      const allCircuits = ApiResilienceSystem.getCircuitBreakerStatus() as Map<string, any>
      const systemHealth = ApiResilienceSystem.getSystemHealth()

      // Convert Maps to objects for JSON response
      const metricsObj = Object.fromEntries(
        Array.from(allMetrics.entries()).map(([name, metrics]) => [
          name,
          {
            ...metrics,
            uptimePercent: Math.round(metrics.uptime * 100),
            failureRate: Math.round((1 - metrics.uptime) * 100),
            retryRate:
              metrics.totalCalls > 0
                ? Math.round((metrics.retriedCalls / metrics.totalCalls) * 100)
                : 0,
          },
        ])
      )

      const circuitsObj = Object.fromEntries(
        Array.from(allCircuits.entries()).map(([name, circuit]) => [
          name,
          {
            ...circuit,
            isOpen: circuit.state === 'OPEN',
            isHalfOpen: circuit.state === 'HALF_OPEN',
          },
        ])
      )

      return NextResponse.json({
        success: true,
        systemHealth: {
          ...systemHealth,
          overallUptimePercent: Math.round(systemHealth.overallUptime * 100),
          averageResponseTimeMs: Math.round(systemHealth.averageResponseTime),
        },
        apis: metricsObj,
        circuitBreakers: circuitsObj,
        summary: {
          totalApis: Object.keys(metricsObj).length,
          healthyApis: systemHealth.healthyApis,
          openCircuits: Object.values(circuitsObj).filter((c: any) => c.isOpen).length,
          halfOpenCircuits: Object.values(circuitsObj).filter((c: any) => c.isHalfOpen).length,
        },
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error('Error fetching resilience metrics:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch resilience metrics',
        systemHealth: {
          status: 'UNKNOWN',
          overallUptime: 0,
          totalApis: 0,
          healthyApis: 0,
          circuitBreakerTrips: 0,
          averageResponseTime: 0,
        },
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, apiName } = body

    switch (action) {
      case 'reset_circuit_breaker':
        if (!apiName) {
          return NextResponse.json(
            {
              success: false,
              error: 'apiName is required for reset_circuit_breaker action',
            },
            { status: 400 }
          )
        }

        ApiResilienceSystem.resetCircuitBreaker(apiName)
        return NextResponse.json({
          success: true,
          message: `Circuit breaker reset for ${apiName}`,
          timestamp: new Date().toISOString(),
        })

      case 'reset_all_metrics':
        ApiResilienceSystem.resetMetrics()
        return NextResponse.json({
          success: true,
          message: 'All metrics and circuit breakers reset',
          timestamp: new Date().toISOString(),
        })

      case 'get_system_health':
        const health = ApiResilienceSystem.getSystemHealth()
        return NextResponse.json({
          success: true,
          systemHealth: {
            ...health,
            overallUptimePercent: Math.round(health.overallUptime * 100),
            averageResponseTimeMs: Math.round(health.averageResponseTime),
          },
          timestamp: new Date().toISOString(),
        })

      default:
        return NextResponse.json(
          {
            success: false,
            error:
              'Invalid action. Supported actions: reset_circuit_breaker, reset_all_metrics, get_system_health',
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in resilience management:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute resilience management action',
      },
      { status: 500 }
    )
  }
}
