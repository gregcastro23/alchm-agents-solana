/**
 * Real-Time Notification Service
 * ==============================
 *
 * Service for real-time notifications using Server-Sent Events (SSE)
 * or WebSocket connections for instant transit alerts.
 */

import { NextRequest, NextResponse } from 'next/server'

// Store active connections
const activeConnections = new Map<
  string,
  {
    controller: ReadableStreamDefaultController
    userId: string
    lastActivity: Date
  }
>()

// Notification queue for each user
const notificationQueues = new Map<string, any[]>()

export interface RealtimeNotification {
  id: string
  type: 'transit_alert' | 'job_complete' | 'system_status'
  title: string
  message: string
  data?: any
  timestamp: Date
  priority: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Send notification to specific user
 */
export function sendNotificationToUser(
  userId: string,
  notification: RealtimeNotification
): boolean {
  const connection = activeConnections.get(userId)
  if (!connection) {
    // Queue notification for when user reconnects
    if (!notificationQueues.has(userId)) {
      notificationQueues.set(userId, [])
    }
    notificationQueues.get(userId)!.push(notification)
    return false
  }

  try {
    const message = `data: ${JSON.stringify(notification)}\n\n`
    connection.controller.enqueue(new TextEncoder().encode(message))
    connection.lastActivity = new Date()
    return true
  } catch (error) {
    console.error('Failed to send notification to user:', userId, error)
    activeConnections.delete(userId)
    return false
  }
}

/**
 * Broadcast notification to all connected users
 */
export function broadcastNotification(notification: RealtimeNotification): number {
  let sentCount = 0

  for (const [userId, connection] of activeConnections) {
    try {
      const message = `data: ${JSON.stringify(notification)}\n\n`
      connection.controller.enqueue(new TextEncoder().encode(message))
      connection.lastActivity = new Date()
      sentCount++
    } catch (error) {
      console.error('Failed to broadcast to user:', userId, error)
      activeConnections.delete(userId)
    }
  }

  return sentCount
}

/**
 * Send transit alert notification
 */
export function sendTransitAlert(
  userId: string,
  transitData: {
    transitDate: Date
    transitDegree: number
    transitingPlanet: string
    natalPlanet: string
    significanceScore: number
    planetaryAgent: string
  }
): boolean {
  const notification: RealtimeNotification = {
    id: `transit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'transit_alert',
    title: `${transitData.transitingPlanet} Transit Alert`,
    message: `Significant ${transitData.transitingPlanet} transit to your ${transitData.natalPlanet} at ${transitData.transitDegree.toFixed(1)}°`,
    data: transitData,
    timestamp: new Date(),
    priority:
      transitData.significanceScore >= 0.8
        ? 'critical'
        : transitData.significanceScore >= 0.6
          ? 'high'
          : 'medium',
  }

  return sendNotificationToUser(userId, notification)
}

/**
 * Send job completion notification
 */
export function sendJobCompleteNotification(
  userId: string,
  jobData: {
    jobId: string
    jobType: string
    chartsProcessed: number
    notificationsCreated: number
    executionTime: number
  }
): boolean {
  const notification: RealtimeNotification = {
    id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'job_complete',
    title: 'Transit Monitoring Complete',
    message: `Processed ${jobData.chartsProcessed} charts, created ${jobData.notificationsCreated} notifications in ${Math.round(jobData.executionTime / 1000)}s`,
    data: jobData,
    timestamp: new Date(),
    priority: 'low',
  }

  return sendNotificationToUser(userId, notification)
}

/**
 * Send system status notification
 */
export function sendSystemStatusNotification(
  userId: string,
  statusData: {
    schedulerActive: boolean
    lastJobCompleted?: Date
    totalJobsToday: number
  }
): boolean {
  const notification: RealtimeNotification = {
    id: `status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'system_status',
    title: 'System Status Update',
    message: `Background monitoring is ${statusData.schedulerActive ? 'active' : 'inactive'}. ${statusData.totalJobsToday} jobs completed today.`,
    data: statusData,
    timestamp: new Date(),
    priority: 'low',
  }

  return sendNotificationToUser(userId, notification)
}

/**
 * Create SSE connection handler
 */
export function createRealtimeConnection(userId: string) {
  const stream = new ReadableStream({
    start(controller) {
      // Store connection
      activeConnections.set(userId, {
        controller,
        userId,
        lastActivity: new Date(),
      })

      console.log(`📡 Real-time connection established for user: ${userId}`)

      // Send initial connection confirmation
      const welcomeMessage = `data: ${JSON.stringify({
        type: 'connection',
        message: 'Real-time connection established',
        timestamp: new Date(),
      })}\n\n`
      controller.enqueue(new TextEncoder().encode(welcomeMessage))

      // Send queued notifications
      const queuedNotifications = notificationQueues.get(userId) || []
      if (queuedNotifications.length > 0) {
        for (const notification of queuedNotifications) {
          const message = `data: ${JSON.stringify(notification)}\n\n`
          controller.enqueue(new TextEncoder().encode(message))
        }
        notificationQueues.delete(userId)
      }
    },

    cancel() {
      console.log(`📡 Real-time connection closed for user: ${userId}`)
      activeConnections.delete(userId)
    },
  })

  return stream
}

/**
 * Get connection statistics
 */
export function getConnectionStats() {
  const now = new Date()
  const activeConnectionsCount = activeConnections.size

  // Count connections active in last 5 minutes
  let recentConnectionsCount = 0
  for (const connection of activeConnections.values()) {
    if (now.getTime() - connection.lastActivity.getTime() < 5 * 60 * 1000) {
      recentConnectionsCount++
    }
  }

  return {
    activeConnections: activeConnectionsCount,
    recentConnections: recentConnectionsCount,
    queuedNotifications: Array.from(notificationQueues.values()).reduce(
      (total, queue) => total + queue.length,
      0
    ),
  }
}

/**
 * Clean up inactive connections
 */
export function cleanupInactiveConnections(maxAgeMinutes: number = 30) {
  const now = new Date()
  const maxAge = maxAgeMinutes * 60 * 1000

  let cleanedCount = 0
  for (const [userId, connection] of activeConnections) {
    if (now.getTime() - connection.lastActivity.getTime() > maxAge) {
      try {
        connection.controller.close()
      } catch (error) {
        console.error('Error closing inactive connection:', error)
      }
      activeConnections.delete(userId)
      cleanedCount++
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} inactive connections`)
  }

  return cleanedCount
}

/**
 * API Route Handler for SSE connections
 */
export async function handleRealtimeConnection(request: NextRequest) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 })
  }

  // Create SSE response
  const response = new NextResponse(createRealtimeConnection(userId), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  })

  return response
}

/**
 * Initialize cleanup interval
 */
export function initializeCleanup() {
  // Clean up inactive connections every 5 minutes
  setInterval(
    () => {
      cleanupInactiveConnections(30) // 30 minutes max age
    },
    5 * 60 * 1000
  )

  console.log('🧹 Real-time connection cleanup initialized')
}
