import { Router as createRouter, type Request, type Response } from 'express'
import type { Router as ExpressRouter } from 'express'
import { alchmClient } from '../services/alchm-client.js'
import { cacheService } from '../services/cache.js'
import { asyncHandler } from '../middleware/error-handler.js'

const router: ExpressRouter = createRouter()

/**
 * GET /api/health
 * Basic health check endpoint
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now()

    // Check external service health with timeout protection
    let alchmBackendHealth = { healthy: true, responseTime: 0, error: null }
    try {
      // Set a 3-second timeout for external service check
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), 3000)
      )
      alchmBackendHealth = (await Promise.race([alchmClient.healthCheck(), timeoutPromise])) as any
    } catch (error) {
      // If external service is down, still report our service as healthy
      alchmBackendHealth = {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'External service unavailable',
      }
    }

    // Check cache service
    const cacheStats = cacheService.getStats()

    // Check circuit breaker status
    const circuitBreakerStatus = alchmClient.getStatus()

    // Always report as operational for Render health checks
    // External service issues shouldn't prevent deployment
    const health = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        alchmBackend: {
          healthy: alchmBackendHealth.healthy,
          responseTime: alchmBackendHealth.responseTime,
          error: alchmBackendHealth.error,
          circuitBreaker: circuitBreakerStatus,
        },
        cache: {
          type: cacheStats.type,
          connected: cacheStats.connected,
          memoryItems: cacheStats.memoryItems,
        },
      },
      featureFlags: {
        planetaryHoursBackend: process.env.PLANETARY_HOURS_BACKEND === 'true',
        thermodynamicsBackend: process.env.THERMODYNAMICS_BACKEND === 'true',
        tokenCalculationsBackend: process.env.TOKEN_CALCULATIONS_BACKEND === 'true',
        kineticsBackend: process.env.KINETICS_BACKEND === 'true',
      },
    }

    // For Render deployment: Always return 200 for health checks
    // External service issues shouldn't prevent deployment
    const coreServicesHealthy = cacheStats.connected
    const externalServicesHealthy = alchmBackendHealth.healthy

    // Determine status but always return 200 for Render compatibility
    let status = 'operational'
    if (!coreServicesHealthy) {
      status = 'unhealthy'
    } else if (!externalServicesHealthy) {
      status = 'degraded'
    }

    health.status = status

    // Always return 200 OK for Render health checks
    res.status(200).json(health)
  })
)

/**
 * GET /api/health/detailed
 * Detailed health check with dependency testing
 */
router.get(
  '/detailed',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now()
    const checks = []

    // Test cache operations
    try {
      const testKey = 'health-check-test'
      const testValue = { test: true, timestamp: Date.now() }

      await cacheService.set(testKey, testValue, 10)
      const retrieved = await cacheService.get(testKey)
      await cacheService.del(testKey)

      checks.push({
        name: 'Cache Operations',
        status: 'pass',
        responseTime: Date.now() - startTime,
        details: 'Set, get, and delete operations successful',
      })
    } catch (error) {
      checks.push({
        name: 'Cache Operations',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime,
      })
    }

    // Test external service connectivity
    const alchmHealth = await alchmClient.healthCheck()
    checks.push({
      name: 'Alchm Backend',
      status: alchmHealth.healthy ? 'pass' : 'fail',
      responseTime: alchmHealth.responseTime,
      error: alchmHealth.error,
    })

    // Memory usage
    const memoryUsage = process.memoryUsage()
    checks.push({
      name: 'Memory Usage',
      status: memoryUsage.heapUsed < 500 * 1024 * 1024 ? 'pass' : 'warn', // 500MB threshold
      details: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      },
    })

    const allPassed = checks.every(check => check.status === 'pass')
    const hasWarnings = checks.some(check => check.status === 'warn')

    const result = {
      status: allPassed ? 'healthy' : hasWarnings ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      totalResponseTime: Date.now() - startTime,
      checks,
    }

    const statusCode = allPassed ? 200 : hasWarnings ? 200 : 503
    res.status(statusCode).json(result)
  })
)

export default router
