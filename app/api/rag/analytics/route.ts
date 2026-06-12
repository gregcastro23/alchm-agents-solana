/**
 * RAG Analytics API
 * Endpoints for persisting and querying RAG analytics data
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface LogQueryRequest {
  agentId: string
  agentName: string
  query: string
  queryLength: number
  ragUsed: boolean
  sourcesRetrieved: number
  retrievalTime: number
  generationTime?: number
  totalTime: number
  success: boolean
  error?: string
  relevanceScores: number[]
  averageRelevance: number
  sessionId: string
  userId?: string
  modelUsed?: string
  temperature?: number
  metadata?: any
  sources?: Array<{
    documentId: string
    agentId: string
    agentName: string
    title: string
    content: string
    relevanceScore: number
    era?: string
    category?: string
    tags?: string[]
    metadata?: any
  }>
}

/**
 * POST /api/rag/analytics - Log a RAG query
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LogQueryRequest

    // Validate required fields
    if (!body.agentId || !body.query || !body.sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, query, sessionId' },
        { status: 400 }
      )
    }

    // Create RAG query record with related sources
    const queryRecord = await prisma.rAGQuery.create({
      data: {
        agentId: body.agentId,
        agentName: body.agentName,
        query: body.query,
        queryLength: body.queryLength,
        ragUsed: body.ragUsed,
        sourcesRetrieved: body.sourcesRetrieved,
        retrievalTime: body.retrievalTime,
        generationTime: body.generationTime,
        totalTime: body.totalTime,
        success: body.success,
        error: body.error,
        relevanceScores: body.relevanceScores,
        avgRelevance: body.averageRelevance,
        sessionId: body.sessionId,
        userId: body.userId,
        modelUsed: body.modelUsed,
        temperature: body.temperature,
        metadata: body.metadata,
        // Create related sources
        sources: body.sources
          ? {
              create: body.sources.map(source => ({
                documentId: source.documentId,
                agentId: source.agentId,
                agentName: source.agentName,
                title: source.title,
                content: source.content,
                relevanceScore: source.relevanceScore,
                era: source.era,
                category: source.category,
                tags: source.tags,
                metadata: source.metadata,
              })),
            }
          : undefined,
      },
      include: {
        sources: true,
      },
    })

    return NextResponse.json({
      success: true,
      queryId: queryRecord.id,
      sourcesCreated: queryRecord.sources.length,
    })
  } catch (error) {
    console.error('[RAG Analytics API] Error logging query:', error)
    return NextResponse.json(
      {
        error: 'Failed to log RAG query',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/rag/analytics - Query analytics data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query filters
    const where: any = {}
    if (agentId) where.agentId = agentId
    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) where.timestamp.gte = new Date(startDate)
      if (endDate) where.timestamp.lte = new Date(endDate)
    }

    // Fetch queries with sources
    const queries = await prisma.rAGQuery.findMany({
      where,
      include: {
        sources: true,
        feedback: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      skip: offset,
    })

    // Get total count for pagination
    const totalCount = await prisma.rAGQuery.count({ where })

    // Calculate aggregate stats
    const stats = await prisma.rAGQuery.aggregate({
      where,
      _avg: {
        retrievalTime: true,
        generationTime: true,
        totalTime: true,
        avgRelevance: true,
      },
      _sum: {
        sourcesRetrieved: true,
      },
      _count: {
        id: true,
      },
    })

    // Count success/failure
    const successCount = await prisma.rAGQuery.count({
      where: { ...where, success: true },
    })
    const ragUsedCount = await prisma.rAGQuery.count({
      where: { ...where, ragUsed: true },
    })

    return NextResponse.json({
      queries: queries.map(q => ({
        ...q,
        timestamp: q.timestamp.toISOString(),
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      stats: {
        totalQueries: stats._count.id,
        ragUsageRate: stats._count.id > 0 ? ragUsedCount / stats._count.id : 0,
        successRate: stats._count.id > 0 ? successCount / stats._count.id : 0,
        avgRetrievalTime: stats._avg.retrievalTime || 0,
        avgGenerationTime: stats._avg.generationTime || 0,
        avgTotalTime: stats._avg.totalTime || 0,
        avgRelevance: stats._avg.avgRelevance || 0,
        totalSources: stats._sum.sourcesRetrieved || 0,
      },
    })
  } catch (error) {
    console.error('[RAG Analytics API] Error querying analytics:', error)
    return NextResponse.json(
      {
        error: 'Failed to query analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
