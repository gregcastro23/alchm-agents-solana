/**
 * Individual Transit Notification API
 * ===================================
 *
 * Operations for specific transit notifications by ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  markNotificationAsRead,
  dismissNotification,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from '@/lib/services/transit-notification-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/transit-notifications/[id]
 * Get specific notification by ID
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 })
    }

    const notification = await prisma.transitNotification.findFirst({
      where: {
        id,
        userId, // Security: ensure user owns notification
      },
      include: {
        natalChart: {
          select: {
            chartName: true,
            dominantElement: true,
            dominantModality: true,
          },
        },
        transitSignificance: true,
      },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    return NextResponse.json({ notification })
  } catch (error) {
    console.error('Error fetching transit notification:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch transit notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/transit-notifications/[id]
 * Update notification (mark as read, dismiss, etc.)
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 })
    }

    const { id } = await params
    const { action, ...updateData } = body

    // Handle specific actions
    if (action === 'mark_read') {
      await markNotificationAsRead(id, userId)
      return NextResponse.json({ success: true, message: 'Notification marked as read' })
    }

    if (action === 'dismiss') {
      await dismissNotification(id, userId)
      return NextResponse.json({ success: true, message: 'Notification dismissed' })
    }

    if (action === 'update_preferences') {
      await updateUserNotificationPreferences(userId, updateData)
      return NextResponse.json({ success: true, message: 'Notification preferences updated' })
    }

    // General update
    const validFields = [
      'status',
      'sentAt',
      'deliveredAt',
      'readAt',
      'dismissedAt',
      'interactionCount',
      'lastInteraction',
      'userRating',
      'userFeedback',
    ]

    const updatePayload: any = {}
    for (const field of validFields) {
      if (updateData[field] !== undefined) {
        if (field.includes('At')) {
          // Convert date strings to Date objects
          updatePayload[field] = updateData[field] ? new Date(updateData[field]) : null
        } else {
          updatePayload[field] = updateData[field]
        }
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updatePayload.updatedAt = new Date()

    const notification = await prisma.transitNotification.updateMany({
      where: {
        id,
        userId, // Security: ensure user owns notification
      },
      data: updatePayload,
    })

    if (notification.count === 0) {
      return NextResponse.json(
        { error: 'Notification not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, message: 'Notification updated successfully' })
  } catch (error) {
    console.error('Error updating transit notification:', error)
    return NextResponse.json(
      {
        error: 'Failed to update transit notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/transit-notifications/[id]
 * Delete notification
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 })
    }

    const { id } = await params
    const notification = await prisma.transitNotification.deleteMany({
      where: {
        id: id,
        userId, // Security: ensure user owns notification
      },
    })

    if (notification.count === 0) {
      return NextResponse.json(
        { error: 'Notification not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, message: 'Notification deleted successfully' })
  } catch (error) {
    console.error('Error deleting transit notification:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete transit notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
