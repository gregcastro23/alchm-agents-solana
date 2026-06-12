/**
 * System Initialization API
 * ==========================
 *
 * Initialize background services on application startup
 */

import {
  initializeBackgroundServices,
  getSchedulerStatus,
} from '@/lib/startup/transit-scheduler-init'

let initialized = false

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/system-init
 * Initialize background services
 */
export async function POST(request: Request) {
  try {
    if (initialized) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Background services already initialized',
          status: getSchedulerStatus(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('🚀 Initializing background services via API...')

    const services = initializeBackgroundServices()
    initialized = true

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Background services initialized successfully',
        services: {
          scheduler: {
            isActive: services.scheduler?.isActive() || false,
            intervalMinutes: (services.scheduler as any)?.intervalMinutes || null,
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Failed to initialize background services:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to initialize background services',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * GET /api/system-init
 * Get initialization status
 */
export async function GET() {
  try {
    const schedulerStatus = getSchedulerStatus()

    return new Response(
      JSON.stringify({
        initialized,
        scheduler: schedulerStatus,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Failed to get initialization status:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to get initialization status',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
