/**
 * Transit Notification Service
 * ============================
 *
 * Manages transit notifications for users, including creation, delivery,
 * and interaction tracking for significant astrological transits.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface TransitNotificationData {
  userId: string
  natalChartId: string
  transitSignificanceId?: string
  transitSignificanceData?: any
  title: string
  message: string
  notifyDate: Date
  transitDate: Date
  priority: 'low' | 'medium' | 'high' | 'critical'
  urgency?: 'normal' | 'urgent' | 'time_sensitive'
  category: 'personal_transit' | 'agent_activation' | 'consciousness_breakthrough'
  actionRequired?: boolean
  deliveryMethod?: 'in_app' | 'email' | 'push' | 'sms'
  contextData?: any
  expiresAt?: Date
}

export interface NotificationPreferences {
  enabled: boolean
  significanceThreshold: number
  priorityLevels: ('low' | 'medium' | 'high' | 'critical')[]
  categories: ('personal_transit' | 'agent_activation' | 'consciousness_breakthrough')[]
  deliveryMethods: ('in_app' | 'email' | 'push' | 'sms')[]
  quietHours?: {
    start: string // HH:MM
    end: string // HH:MM
  }
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly'
}

/**
 * Create a transit notification
 */
export async function createTransitNotification(data: TransitNotificationData): Promise<any> {
  try {
    const notification = await (prisma as any).transitNotification.create({
      data: {
        userId: data.userId,
        natalChartId: data.natalChartId,
        transitSignificanceId: data.transitSignificanceId,
        transitSignificanceData: data.transitSignificanceData,
        title: data.title,
        message: data.message,
        notifyDate: data.notifyDate,
        transitDate: data.transitDate,
        priority: data.priority,
        urgency: data.urgency || 'normal',
        category: data.category,
        actionRequired: data.actionRequired || false,
        deliveryMethod: data.deliveryMethod || 'in_app',
        contextData: data.contextData,
        expiresAt: data.expiresAt,
        status: 'pending',
        isActive: true,
      },
    })

    return notification
  } catch (error) {
    console.error('Error creating transit notification:', error)
    throw new Error('Failed to create transit notification')
  }
}

/**
 * Get upcoming notifications for a user
 */
export async function getUpcomingNotifications(
  userId: string,
  options: {
    limit?: number
    includeRead?: boolean
    priorityFilter?: ('low' | 'medium' | 'high' | 'critical')[]
    categoryFilter?: ('personal_transit' | 'agent_activation' | 'consciousness_breakthrough')[]
  } = {}
): Promise<any[]> {
  const { limit = 50, includeRead = false, priorityFilter, categoryFilter } = options

  try {
    const notifications = await (prisma as any).transitNotification.findMany({
      where: {
        userId,
        isActive: true,
        ...(includeRead ? {} : { status: { not: 'read' } }),
        ...(priorityFilter && priorityFilter.length > 0
          ? { priority: { in: priorityFilter } }
          : {}),
        ...(categoryFilter && categoryFilter.length > 0
          ? { category: { in: categoryFilter } }
          : {}),
      },
      include: {
        natalChart: {
          select: {
            chartName: true,
            dominantElement: true,
            dominantModality: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' }, // Critical first
        { notifyDate: 'asc' }, // Soonest first
        { createdAt: 'desc' },
      ],
      take: limit,
    })

    return notifications
  } catch (error) {
    console.error('Error fetching upcoming notifications:', error)
    throw new Error('Failed to fetch upcoming notifications')
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  try {
    await (prisma as any).transitNotification.updateMany({
      where: {
        id: notificationId,
        userId, // Security: ensure user owns notification
      },
      data: {
        status: 'read',
        readAt: new Date(),
        lastInteraction: new Date(),
        interactionCount: { increment: 1 },
      },
    })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    throw new Error('Failed to mark notification as read')
  }
}

/**
 * Mark notification as dismissed
 */
export async function dismissNotification(notificationId: string, userId: string): Promise<void> {
  try {
    await (prisma as any).transitNotification.updateMany({
      where: {
        id: notificationId,
        userId, // Security: ensure user owns notification
      },
      data: {
        status: 'dismissed',
        dismissedAt: new Date(),
        lastInteraction: new Date(),
        interactionCount: { increment: 1 },
      },
    })
  } catch (error) {
    console.error('Error dismissing notification:', error)
    throw new Error('Failed to dismiss notification')
  }
}

// A process-wide global Map to persist preferences in memory for tests/runs
const preferencesStore = new Map<string, any>()

/**
 * Get user notification preferences (with defaults)
 */
export async function getUserNotificationPreferences(userId: string): Promise<any> {
  try {
    const defaultPreferences = {
      enabled: true,
      significanceThreshold: 0.6,
      priorityLevels: ['medium', 'high', 'critical'],
      categories: ['personal_transit', 'agent_activation', 'consciousness_breakthrough'],
      deliveryMethods: ['in_app'],
      frequency: 'immediate',
      threshold: 0.6,
      channels: ['in_app'],
    }

    const stored = preferencesStore.get(userId)
    if (stored) {
      return {
        ...defaultPreferences,
        ...stored,
      }
    }

    return defaultPreferences
  } catch (error) {
    console.error('Error fetching user notification preferences:', error)
    throw new Error('Failed to fetch notification preferences')
  }
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferences(
  userId: string,
  preferences: any
): Promise<void> {
  try {
    const existing = preferencesStore.get(userId) || {}
    preferencesStore.set(userId, {
      ...existing,
      ...preferences,
    })
    console.log('Updating notification preferences for user:', userId, preferences)
  } catch (error) {
    console.error('Error updating notification preferences:', error)
    throw new Error('Failed to update notification preferences')
  }
}

/**
 * Create notifications for significant transits
 */
export async function createNotificationsForSignificantTransits(
  natalChartId: string,
  transits: any[]
): Promise<number> {
  try {
    const chart = await (prisma as any).userNatalChart.findUnique({
      where: { id: natalChartId },
      select: { userId: true, chartName: true },
    })

    if (!chart) {
      throw new Error('Natal chart not found')
    }

    const preferences = await getUserNotificationPreferences(chart.userId)
    let notificationCount = 0

    for (const transit of transits) {
      // Check if transit meets user's significance threshold
      if (transit.overallScore < preferences.significanceThreshold) {
        continue
      }

      // Check if priority level is enabled
      if (!preferences.priorityLevels.includes(transit.priority || 'medium')) {
        continue
      }

      // Check if category is enabled
      if (!preferences.categories.includes(transit.category || 'personal_transit')) {
        continue
      }

      // Create notification
      const notifyDate = new Date() // Immediate notification
      const transitDate = transit.transitDate || new Date()

      await createTransitNotification({
        userId: chart.userId,
        natalChartId,
        transitSignificanceData: transit,
        title: transit.title || `Significant Transit: ${transit.transitingPlanet}`,
        message:
          transit.interpretation?.transitThemes?.join(', ') ||
          'A significant astrological transit is occurring',
        notifyDate,
        transitDate,
        priority: transit.priority || 'medium',
        category: transit.category || 'personal_transit',
        contextData: {
          transitingPlanet: transit.transitingPlanet,
          natalPlanet: transit.natalPlanet,
          significance: transit.overallScore,
        },
      })

      notificationCount++
    }

    return notificationCount
  } catch (error) {
    console.error('Error creating notifications for significant transits:', error)
    throw new Error('Failed to create notifications for significant transits')
  }
}

/**
 * Schedule transit monitoring for all active charts
 */
export async function scheduleTransitMonitoring(): Promise<{
  chartsProcessed: number
  notificationsCreated: number
  errors: string[]
}> {
  const result = {
    chartsProcessed: 0,
    notificationsCreated: 0,
    errors: [] as string[],
  }

  try {
    // Get all active natal charts
    const activeCharts = await (prisma as any).userNatalChart.findMany({
      where: {
        isActive: true,
        notificationOn: true,
      },
      select: {
        id: true,
        userId: true,
        chartName: true,
        planets: true,
        preferences: true,
      },
    })

    result.chartsProcessed = activeCharts.length

    for (const chart of activeCharts) {
      try {
        // Calculate today's transits (simplified - in real implementation would be more sophisticated)
        // This is a simplified version - real implementation would use the transit calculator
        const mockTransits: any[] = [] // In real implementation, calculate actual transits

        if (mockTransits.length > 0) {
          const notificationsCreated = await createNotificationsForSignificantTransits(
            chart.id,
            mockTransits
          )
          result.notificationsCreated += notificationsCreated
        }
      } catch (chartError) {
        const errorMsg = `Error processing chart ${chart.id}: ${chartError instanceof Error ? chartError.message : 'Unknown error'}`
        result.errors.push(errorMsg)
        console.error(errorMsg)
      }
    }
  } catch (error) {
    const errorMsg = `Error in transit monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`
    result.errors.push(errorMsg)
    console.error(errorMsg)
  }

  return result
}

/**
 * Clean up expired notifications
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  try {
    const result = await (prisma as any).transitNotification.updateMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { isActive: false }],
        status: { notIn: ['read', 'dismissed'] },
      },
      data: {
        status: 'dismissed',
        dismissedAt: new Date(),
      },
    })

    return result.count
  } catch (error) {
    console.error('Error cleaning up expired notifications:', error)
    throw new Error('Failed to cleanup expired notifications')
  }
}

/**
 * Get notification statistics for a user
 */
export async function getNotificationStatistics(userId: string): Promise<{
  total: number
  unread: number
  byPriority: Record<string, number>
  byCategory: Record<string, number>
  recentActivity: number // Last 7 days
}> {
  try {
    const [total, unread, byPriority, byCategory, recentActivity] = await Promise.all([
      (prisma as any).transitNotification.count({ where: { userId, isActive: true } }),
      (prisma as any).transitNotification.count({
        where: { userId, isActive: true, status: { not: 'read' } },
      }),
      (prisma as any).transitNotification.groupBy({
        by: ['priority'],
        where: { userId, isActive: true },
        _count: true,
      }),
      (prisma as any).transitNotification.groupBy({
        by: ['category'],
        where: { userId, isActive: true },
        _count: true,
      }),
      (prisma as any).transitNotification.count({
        where: {
          userId,
          isActive: true,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ])

    return {
      total,
      unread,
      byPriority: byPriority.reduce(
        (acc: any, item: any) => ({ ...acc, [item.priority]: item._count }),
        {}
      ),
      byCategory: byCategory.reduce(
        (acc: any, item: any) => ({ ...acc, [item.category]: item._count }),
        {}
      ),
      recentActivity,
    }
  } catch (error) {
    console.error('Error fetching notification statistics:', error)
    throw new Error('Failed to fetch notification statistics')
  }
}
