/**
 * Performance Metrics API
 * Provides real system metrics for the performance dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'

type TimeRange = '1h' | '24h' | '7d' | '30d'

function getStartTime(timeRange: TimeRange) {
  const now = new Date()

  switch (timeRange) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000)
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '24h':
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
  }
}

function getPercent(count: number, total: number) {
  return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
}

function normalizeLabel(value?: string | null) {
  if (!value) return 'Unknown'

  return value
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) return adminErrorResponse(admin)

    const searchParams = request.nextUrl.searchParams
    const rawTimeRange = searchParams.get('timeRange') || '24h'
    const timeRange: TimeRange = ['1h', '24h', '7d', '30d'].includes(rawTimeRange)
      ? (rawTimeRange as TimeRange)
      : '24h'

    const now = new Date()
    const startTime = getStartTime(timeRange)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [
      totalUsers,
      newUsersToday,
      totalSessions,
      totalConversations,
      recentConversations,
      activeUserRows,
      agentStats,
      monicaInteractions,
      ragQueries,
      deviceRows,
      browserRows,
      consciousnessGrowth,
      councilSessions,
      evolutionStats,
    ] = await Promise.all([
      prisma.users.count(),
      prisma.users.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.userSession.count(),
      prisma.agentConversation.count(),
      prisma.agentConversation.count({
        where: {
          createdAt: { gte: startTime },
        },
      }),
      prisma.agentConversation.findMany({
        where: {
          createdAt: { gte: startTime },
          userId: { not: null },
        },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.agentConversation.groupBy({
        by: ['agentId'],
        _count: { agentId: true },
        _avg: { responseTime: true },
        where: { createdAt: { gte: startTime } },
        orderBy: { _count: { agentId: 'desc' } },
        take: 5,
      }),
      prisma.monica_interactions.count({ where: { createdAt: { gte: startTime } } }),
      prisma.rAGQuery.count({ where: { timestamp: { gte: startTime } } }),
      prisma.monica_interactions.groupBy({
        by: ['deviceType'],
        where: { createdAt: { gte: startTime }, deviceType: { not: null } },
        _count: { deviceType: true },
      }),
      prisma.monica_interactions.groupBy({
        by: ['browserInfo'],
        where: { createdAt: { gte: startTime }, browserInfo: { not: null } },
        _count: { browserInfo: true },
      }),
      prisma.consciousness_interactions.aggregate({
        where: { timestamp: { gte: startTime } },
        _sum: { powerGained: true },
      }),
      prisma.consciousness_interactions.count({
        where: {
          timestamp: { gte: startTime },
          interactionType: { contains: 'council', mode: 'insensitive' },
        },
      }),
      prisma.historical_agents.aggregate({
        _avg: { evolutionPoints: true },
      }),
    ])

    const activeUsers = activeUserRows.length
    const avgResponseTimeMs =
      agentStats.reduce((sum, stat) => sum + (stat._avg.responseTime || 0), 0) /
      (agentStats.length || 1)
    const windowMinutes = Math.max(1, (now.getTime() - startTime.getTime()) / 60000)
    const memoryUsage =
      process.memoryUsage().heapTotal > 0
        ? (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
        : null

    const deviceTotal = deviceRows.reduce((sum, row) => sum + row._count.deviceType, 0)
    const deviceBreakdown = {
      desktop: getPercent(
        deviceRows
          .filter(row => row.deviceType?.toLowerCase().includes('desktop'))
          .reduce((sum, row) => sum + row._count.deviceType, 0),
        deviceTotal
      ),
      mobile: getPercent(
        deviceRows
          .filter(row => row.deviceType?.toLowerCase().includes('mobile'))
          .reduce((sum, row) => sum + row._count.deviceType, 0),
        deviceTotal
      ),
      tablet: getPercent(
        deviceRows
          .filter(row => row.deviceType?.toLowerCase().includes('tablet'))
          .reduce((sum, row) => sum + row._count.deviceType, 0),
        deviceTotal
      ),
    }

    const browserTotal = browserRows.reduce((sum, row) => sum + row._count.browserInfo, 0)
    const browserBreakdown = Object.fromEntries(
      browserRows
        .map(row => [
          normalizeLabel(row.browserInfo),
          getPercent(row._count.browserInfo, browserTotal),
        ])
        .slice(0, 6)
    )

    const metrics = {
      systemMetrics: {
        timestamp: Date.now(),
        activeUsers,
        totalSessions,
        averageSessionDuration: null,
        pageLoadTime: null,
        errorRate: null,
        apiResponseTime: Math.round(avgResponseTimeMs || 0),
        memoryUsage,
        cpuUsage: null,
        estimated: {
          averageSessionDuration: false,
          pageLoadTime: false,
          errorRate: false,
          cpuUsage: false,
        },
      },
      userAnalytics: {
        totalUsers,
        activeUsers,
        newUsersToday,
        returningUsers: activeUsers,
        userRetention: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
        averageSessionTime: null,
        topFeatures: [
          { name: 'Agent Chat', usage: recentConversations, growth: null },
          { name: 'Monica Companion', usage: monicaInteractions, growth: null },
          { name: 'RAG Queries', usage: ragQueries, growth: null },
          { name: 'Council Sessions', usage: councilSessions, growth: null },
        ],
        deviceBreakdown,
        browserBreakdown,
        telemetryCoverage: {
          deviceSamples: deviceTotal,
          browserSamples: browserTotal,
          estimated: false,
        },
      },
      agentAnalytics: {
        totalChats: totalConversations,
        activeConversations: recentConversations,
        averageResponseTime: avgResponseTimeMs ? Number((avgResponseTimeMs / 1000).toFixed(2)) : 0,
        popularAgents: agentStats.map(stat => ({
          name: normalizeLabel(stat.agentId),
          chats: stat._count.agentId,
          satisfaction: null,
        })),
        consciousnessGrowth: Math.round(consciousnessGrowth._sum.powerGained || 0),
        councilSessions,
        averageEvolutionPoints: Number((evolutionStats._avg.evolutionPoints || 0).toFixed(1)),
      },
      performanceMetrics: {
        systemHealth:
          activeUsers > 100
            ? 'excellent'
            : activeUsers > 50
              ? 'good'
              : activeUsers > 10
                ? 'fair'
                : 'poor',
        uptime: null,
        responseTime: Math.round(avgResponseTimeMs || 0),
        throughput: Math.round(recentConversations / windowMinutes),
        errorRate: null,
        alerts: [],
        estimated: {
          uptime: false,
          errorRate: false,
        },
      },
    }

    return NextResponse.json({
      success: true,
      timeRange,
      metrics,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Performance API] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
