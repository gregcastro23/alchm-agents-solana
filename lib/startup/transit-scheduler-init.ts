/**
 * Transit Scheduler Initialization
 * ================================
 *
 * Initialize the transit monitoring scheduler on application startup
 */

import { TransitMonitoringScheduler } from '@/lib/jobs/transit-monitoring-job'
import { initializeCleanup } from '@/lib/services/realtime-notification-service'

let scheduler: TransitMonitoringScheduler | null = null

/**
 * Initialize transit monitoring scheduler
 */
export function initializeTransitScheduler(
  options: {
    intervalMinutes?: number
    enabled?: boolean
  } = {}
) {
  const {
    intervalMinutes = 60, // Default: run every hour
    enabled = process.env.NODE_ENV === 'production', // Only enable in production by default
  } = options

  if (!enabled) {
    console.log(
      '⏸️  Transit monitoring scheduler disabled (not in production or explicitly disabled)'
    )
    return null
  }

  if (scheduler) {
    console.log('⚠️  Transit monitoring scheduler already initialized')
    return scheduler
  }

  try {
    console.log(
      `🚀 Initializing transit monitoring scheduler (every ${intervalMinutes} minutes)...`
    )

    scheduler = new TransitMonitoringScheduler(intervalMinutes, {
      skipChartsWithoutPreferences: true,
      maxChartsPerRun: 100, // Process up to 100 charts per run
    })

    // Start the scheduler
    scheduler.start()

    console.log('✅ Transit monitoring scheduler started successfully')

    return scheduler
  } catch (error) {
    console.error('❌ Failed to initialize transit monitoring scheduler:', error)
    return null
  }
}

/**
 * Stop the transit monitoring scheduler
 */
export function stopTransitScheduler() {
  if (scheduler) {
    console.log('🛑 Stopping transit monitoring scheduler...')
    scheduler.stop()
    scheduler = null
    console.log('✅ Transit monitoring scheduler stopped')
  } else {
    console.log('⚠️  No transit monitoring scheduler to stop')
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    isActive: scheduler?.isActive() || false,
    intervalMinutes: (scheduler as any)?.intervalMinutes || null,
  }
}

/**
 * Initialize all background services
 */
export function initializeBackgroundServices() {
  console.log('🔧 Initializing background services...')

  // Initialize transit scheduler
  const schedulerInstance = initializeTransitScheduler({
    intervalMinutes: parseInt(process.env.TRANSIT_SCHEDULER_INTERVAL || '60'),
    enabled:
      process.env.ENABLE_TRANSIT_SCHEDULER === 'true' || process.env.NODE_ENV === 'production',
  })

  // Initialize real-time notification cleanup
  initializeCleanup()

  console.log('✅ Background services initialization complete')

  return {
    scheduler: schedulerInstance,
  }
}

/**
 * Graceful shutdown handler
 */
export function setupGracefulShutdown() {
  const shutdown = () => {
    console.log('🛑 Received shutdown signal, stopping background services...')
    stopTransitScheduler()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  console.log('🛡️  Graceful shutdown handlers configured')
}
