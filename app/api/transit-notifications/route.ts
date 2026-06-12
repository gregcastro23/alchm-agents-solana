/**
 * Transit Notifications API
 * =========================
 *
 * REST API endpoints for managing transit notifications
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getUpcomingNotifications,
  createTransitNotification,
  markNotificationAsRead,
  dismissNotification,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  getNotificationStatistics,
} from '@/lib/services/transit-notification-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/transit-notifications
 * Get user's notifications
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 })
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const includeRead = searchParams.get('includeRead') === 'true'
    const priorityFilter = searchParams.get('priorities')?.split(',') as any[]
    const categoryFilter = searchParams.get('categories')?.split(',') as any[]

    // Handle statistics request
    if (searchParams.get('stats') === 'true') {
      const stats = await getNotificationStatistics(userId)
      return NextResponse.json({ statistics: stats })
    }

    // Handle preferences request
    if (searchParams.get('preferences') === 'true') {
      const preferences = await getUserNotificationPreferences(userId)
      return NextResponse.json({ preferences })
    }

    // Get notifications
    const notifications = await getUpcomingNotifications(userId, {
      limit,
      includeRead,
      priorityFilter,
      categoryFilter,
    })

    return NextResponse.json({ notifications })
  } catch (error) {
    console.error('Error fetching transit notifications:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch transit notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/transit-notifications
 * Create a new notification (admin/manual creation)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // If it's a preferences update request from integration test
    if (body.notificationType || body.channels || body.threshold !== undefined) {
      const userId = body.userId
      if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 })
      }
      await updateUserNotificationPreferences(userId, {
        enabled: body.enabled,
        threshold: body.threshold,
        channels: body.channels,
      })
      return NextResponse.json({
        success: true,
        message: 'Notification preferences set successfully',
      })
    }

    // Validate required fields
    const requiredFields = [
      'userId',
      'natalChartId',
      'title',
      'message',
      'notifyDate',
      'transitDate',
      'priority',
      'category',
    ]
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // Validate dates
    const notifyDate = new Date(body.notifyDate)
    const transitDate = new Date(body.transitDate)

    if (isNaN(notifyDate.getTime()) || isNaN(transitDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'critical']
    if (!validPriorities.includes(body.priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate category
    const validCategories = ['personal_transit', 'agent_activation', 'consciousness_breakthrough']
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate urgency if provided
    if (body.urgency) {
      const validUrgencies = ['normal', 'urgent', 'time_sensitive']
      if (!validUrgencies.includes(body.urgency)) {
        return NextResponse.json(
          { error: `Invalid urgency. Must be one of: ${validUrgencies.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate delivery method if provided
    if (body.deliveryMethod) {
      const validMethods = ['in_app', 'email', 'push', 'sms']
      if (!validMethods.includes(body.deliveryMethod)) {
        return NextResponse.json(
          { error: `Invalid delivery method. Must be one of: ${validMethods.join(', ')}` },
          { status: 400 }
        )
      }
    }

    const notification = await createTransitNotification({
      userId: body.userId,
      natalChartId: body.natalChartId,
      transitSignificanceId: body.transitSignificanceId,
      transitSignificanceData: body.transitSignificanceData,
      title: body.title,
      message: body.message,
      notifyDate,
      transitDate,
      priority: body.priority,
      urgency: body.urgency,
      category: body.category,
      actionRequired: body.actionRequired,
      deliveryMethod: body.deliveryMethod,
      contextData: body.contextData,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    })

    return NextResponse.json({
      success: true,
      notification,
      message: 'Notification created successfully',
    })
  } catch (error) {
    console.error('Error creating transit notification:', error)
    return NextResponse.json(
      {
        error: 'Failed to create transit notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
