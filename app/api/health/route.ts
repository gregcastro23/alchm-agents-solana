import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { backend } from '@/lib/backend'
import { feedStreamBus } from '@/lib/agents/feed-stream-bus'

export const dynamic = 'force-dynamic'

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

interface HealthCheck {
  status: HealthStatus
  timestamp: string
  service: string
  version: string
  environment: string
  checks: {
    database: { status: HealthStatus; latency: number; error: string | null }
    backend: { status: HealthStatus; latency: number; error: string | null }
    redis: { status: HealthStatus; error: string | null }
    memory: { usage: number; percentage: number }
    uptime: number
    feed: { activeListeners: number; pendingQueueCount: number }
  }
}

/**
 * Comprehensive health check endpoint for Docker monitoring
 * Returns detailed health status of all system components
 */
export async function GET() {
  const healthCheck: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'planetary-agents-frontend',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: { status: 'unknown', latency: 0, error: null },
      backend: { status: 'unknown', latency: 0, error: null },
      redis: { status: 'unknown', error: null },
      memory: { usage: 0, percentage: 0 },
      uptime: process.uptime(),
      feed: { activeListeners: 0, pendingQueueCount: 0 },
    },
  }

  let overallStatus: HealthStatus = 'healthy'

  // Database health check
  try {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const latency = Date.now() - start

    healthCheck.checks.database = {
      status: 'healthy',
      latency,
      error: null,
    }
  } catch (error) {
    overallStatus = 'unhealthy'
    healthCheck.checks.database = {
      status: 'unhealthy',
      latency: 0,
      error: error instanceof Error ? error.message : 'Database connection failed',
    }
  }

  // Backend service health check
  try {
    const start = Date.now()
    await backend.health()
    const latency = Date.now() - start

    healthCheck.checks.backend = {
      status: 'healthy',
      latency,
      error: null,
    }
  } catch (error) {
    healthCheck.checks.backend = {
      status: 'unhealthy',
      latency: 0,
      error: error instanceof Error ? error.message : 'Backend connection failed',
    }
  }

  // Feed telemetry check
  try {
    const pendingQueueCount = await prisma.agent_action_events.count({
      where: { status: 'pending' },
    })
    healthCheck.checks.feed = {
      activeListeners: feedStreamBus.listenerCount,
      pendingQueueCount,
    }
  } catch (error) {
    console.error('[health] failed to query feed pending events:', error)
    healthCheck.checks.feed = {
      activeListeners: feedStreamBus.listenerCount,
      pendingQueueCount: 0,
    }
  }

  // Memory usage check
  const memUsage = process.memoryUsage()
  const totalMemory = memUsage.heapTotal + memUsage.external + memUsage.arrayBuffers
  const memoryPercentage = Math.round((totalMemory / (512 * 1024 * 1024)) * 100) // Assuming 512MB limit

  healthCheck.checks.memory = {
    usage: Math.round(totalMemory / 1024 / 1024), // MB
    percentage: memoryPercentage,
  }

  // High memory usage warning
  if (memoryPercentage > 90) {
    overallStatus = 'degraded'
  }

  // Update overall status
  healthCheck.status = overallStatus

  // Return appropriate HTTP status code
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503

  return NextResponse.json(healthCheck, { status: statusCode })
}

/**
 * HEAD request for simple liveness probe
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
