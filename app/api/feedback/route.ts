/**
 * Feedback API Endpoint
 * Collects user feedback for beta testing and improvement
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandling } from '@/lib/error-handling'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/structured-logger'

interface FeedbackData {
  rating?: number
  category: string
  message: string
  userId?: string
  userAgent?: string
  url?: string
  timestamp?: string
}

export async function POST(request: NextRequest) {
  const result = await withErrorHandling(
    async () => {
      const feedback: FeedbackData = await request.json()

      // Validate required fields
      if (!feedback.category || !feedback.message?.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required fields: category and message are required',
          },
          { status: 400 }
        )
      }

      // Validate category
      const validCategories = ['bug', 'feature', 'ui', 'performance', 'general']
      if (!validCategories.includes(feedback.category)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid category. Must be one of: ' + validCategories.join(', '),
          },
          { status: 400 }
        )
      }

      // Validate rating (optional)
      if (feedback.rating !== undefined && (feedback.rating < 1 || feedback.rating > 5)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Rating must be between 1 and 5',
          },
          { status: 400 }
        )
      }

      // Add timestamp and additional metadata
      const feedbackEntry = {
        ...feedback,
        timestamp: feedback.timestamp || new Date().toISOString(),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: feedback.userAgent || request.headers.get('user-agent') || 'unknown',
      }

      const savedFeedback = await prisma.feedback.create({
        data: {
          userId: feedback.userId || null,
          category: feedback.category,
          rating: feedback.rating ?? null,
          message: feedback.message.trim(),
          url: feedback.url || null,
          userAgent: feedbackEntry.userAgent,
          ip: feedbackEntry.ip,
        },
      })

      logger.info('User feedback received', {
        system: 'feedback',
        operation: 'collect',
        userId: feedback.userId,
        metadata: {
          feedbackId: savedFeedback.id,
          category: feedback.category,
          rating: feedback.rating,
          messageLength: feedback.message.length,
          hasUserId: !!feedback.userId,
          url: feedback.url,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Thank you for your feedback!',
        feedbackId: savedFeedback.id,
      })
    },
    {
      system: 'api',
      operation: 'feedback_submit',
      severity: 'low',
    }
  )

  if ('success' in result && result.success === false) {
    return NextResponse.json(
      {
        success: false,
        error: result.userMessage,
        context: result.context,
      },
      { status: 500 }
    )
  }
  return result as NextResponse
}

// Optional: GET endpoint to retrieve feedback statistics (admin only)
export async function GET(_request: NextRequest) {
  const result = await withErrorHandling(
    async () => {
      const [totalFeedback, ratingStats, categoryCounts, recentFeedback] = await Promise.all([
        prisma.feedback.count(),
        prisma.feedback.aggregate({ _avg: { rating: true } }),
        prisma.feedback.groupBy({
          by: ['category'],
          _count: { category: true },
        }),
        prisma.feedback.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            category: true,
            rating: true,
            message: true,
            url: true,
            status: true,
            createdAt: true,
          },
        }),
      ])

      const categories = Object.fromEntries(
        ['bug', 'feature', 'ui', 'performance', 'general'].map(category => [category, 0])
      )

      for (const category of categoryCounts) {
        categories[category.category] = category._count.category
      }

      const stats = {
        totalFeedback,
        averageRating: ratingStats._avg.rating ?? 0,
        categories,
        recentFeedback: recentFeedback.map(feedback => ({
          id: feedback.id,
          category: feedback.category,
          rating: feedback.rating,
          message: feedback.message,
          url: feedback.url,
          status: feedback.status,
          timestamp: feedback.createdAt.toISOString(),
        })),
      }

      logger.info('Feedback statistics requested', {
        system: 'feedback',
        operation: 'stats',
        metadata: { totalFeedback },
      })

      return NextResponse.json({
        success: true,
        data: stats,
      })
    },
    {
      system: 'api',
      operation: 'feedback_stats',
      severity: 'low',
    }
  )

  if ('success' in result && result.success === false) {
    return NextResponse.json(
      {
        success: false,
        error: result.userMessage,
        context: result.context,
      },
      { status: 500 }
    )
  }
  return result as NextResponse
}
