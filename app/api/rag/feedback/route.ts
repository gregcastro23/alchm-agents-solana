/**
 * RAG Feedback API
 * Endpoint for submitting user feedback on RAG-enhanced responses
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrService, requireUserOrService } from '@/lib/security/privileged-api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SubmitFeedbackRequest {
  queryId: string
  agentId: string
  sessionId: string
  userId?: string
  thumbsUp?: boolean | null
  starRating?: number | null
  sourcesHelpful?: boolean
  comment?: string | null
}

/**
 * POST /api/rag/feedback - Submit user feedback on RAG response
 */
export async function POST(request: NextRequest) {
  const access = await requireUserOrService(request)
  if (!access.ok) return access.response

  try {
    const body = (await request.json()) as SubmitFeedbackRequest

    // Validate required fields
    if (!body.queryId || !body.agentId || !body.sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: queryId, agentId, sessionId' },
        { status: 400 }
      )
    }

    // Validate star rating if provided
    if (body.starRating !== undefined && body.starRating !== null) {
      if (body.starRating < 1 || body.starRating > 5) {
        return NextResponse.json({ error: 'Star rating must be between 1 and 5' }, { status: 400 })
      }
    }

    // Validate comment length if provided
    if (body.comment && body.comment.length > 500) {
      return NextResponse.json({ error: 'Comment must be 500 characters or less' }, { status: 400 })
    }

    const query = await prisma.rAGQuery.findUnique({
      where: { id: body.queryId },
      select: { id: true, agentId: true, sessionId: true, userId: true },
    })

    if (!query) {
      return NextResponse.json({ error: 'RAG query not found' }, { status: 404 })
    }
    if (query.agentId !== body.agentId || query.sessionId !== body.sessionId) {
      return NextResponse.json(
        { error: 'Feedback does not match the persisted RAG query' },
        { status: 409 }
      )
    }
    if (access.kind === 'user' && query.userId !== access.user.id) {
      return NextResponse.json(
        { error: 'Feedback query is not owned by this user' },
        { status: 403 }
      )
    }

    // Create feedback only after the foreign-key target and ownership match.
    const feedback = await prisma.rAGFeedback.create({
      data: {
        queryId: body.queryId,
        agentId: body.agentId,
        sessionId: body.sessionId,
        userId: access.kind === 'user' ? access.user.id : body.userId,
        thumbsUp: body.thumbsUp,
        starRating: body.starRating,
        sourcesHelpful: body.sourcesHelpful || false,
        comment: body.comment,
      },
    })

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
      message: 'Feedback submitted successfully',
    })
  } catch (error) {
    console.error('[RAG Feedback API] Error submitting feedback:', error)
    return NextResponse.json(
      {
        error: 'Failed to submit feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/rag/feedback - Query feedback data
 */
export async function GET(request: NextRequest) {
  const access = await requireAdminOrService(request)
  if (!access.ok) return access.response

  try {
    const { searchParams } = new URL(request.url)
    const queryId = searchParams.get('queryId')
    const agentId = searchParams.get('agentId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const minRating = searchParams.get('minRating')
    const thumbsUp = searchParams.get('thumbsUp')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query filters
    const where: any = {}
    if (queryId) where.queryId = queryId
    if (agentId) where.agentId = agentId
    if (thumbsUp !== null && thumbsUp !== undefined) {
      where.thumbsUp = thumbsUp === 'true'
    }
    if (minRating) {
      where.starRating = { gte: parseInt(minRating) }
    }
    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) where.timestamp.gte = new Date(startDate)
      if (endDate) where.timestamp.lte = new Date(endDate)
    }

    // Fetch feedback records
    const feedback = await prisma.rAGFeedback.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      skip: offset,
    })

    // Get total count
    const totalCount = await prisma.rAGFeedback.count({ where })

    // Calculate aggregate stats
    const stats = await prisma.rAGFeedback.aggregate({
      where,
      _avg: {
        starRating: true,
      },
      _count: {
        id: true,
        thumbsUp: true,
        starRating: true,
      },
    })

    // Count positive/negative feedback
    const positiveCount = await prisma.rAGFeedback.count({
      where: { ...where, thumbsUp: true },
    })
    const negativeCount = await prisma.rAGFeedback.count({
      where: { ...where, thumbsUp: false },
    })
    const sourcesHelpfulCount = await prisma.rAGFeedback.count({
      where: { ...where, sourcesHelpful: true },
    })

    return NextResponse.json({
      feedback: feedback.map(f => ({
        ...f,
        timestamp: f.timestamp.toISOString(),
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      stats: {
        totalFeedback: stats._count.id,
        avgStarRating: stats._avg.starRating || 0,
        positiveCount,
        negativeCount,
        sourcesHelpfulCount,
        positiveRate: stats._count.id > 0 ? positiveCount / stats._count.id : 0,
        feedbackWithRating: stats._count.starRating || 0,
        feedbackWithThumb: stats._count.thumbsUp || 0,
      },
    })
  } catch (error) {
    console.error('[RAG Feedback API] Error querying feedback:', error)
    return NextResponse.json(
      {
        error: 'Failed to query feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
