import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface MetricsSnapshot {
  users: {
    total: number
    activeToday: number
    retentionRate: number
  }
  interactions: {
    total: number
    lastHour: number
    averagePerUser: number
  }
  evolution: {
    total: number
    levels: Record<string, number>
  }
  subscriptions: {
    tiers: Record<string, number>
  }
  agents: {
    popular: Array<{
      agentId: string
      interactions: number
    }>
  }
  timestamp: string
}

// Prometheus-compatible metrics endpoint
export async function GET(_req: NextRequest) {
  try {
    const metrics = await generateMetrics()

    // Return in Prometheus format
    const prometheusMetrics = formatPrometheusMetrics(metrics)

    return new Response(prometheusMetrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Metrics generation error:', error)
    return NextResponse.json({ error: 'Failed to generate metrics' }, { status: 500 })
  }
}

async function generateMetrics() {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // User metrics
  const totalUsers = await prisma.users.count()
  const activeUsersToday = await prisma.users.count({
    where: {
      lastLogin: {
        gte: oneDayAgo,
      },
    },
  })

  // Consciousness interaction metrics
  const totalInteractions = await prisma.consciousness_interactions.count()
  const interactionsLastHour = await prisma.consciousness_interactions.count({
    where: {
      timestamp: {
        gte: oneHourAgo,
      },
    },
  })

  // Agent evolution metrics
  const totalEvolutions = await prisma.agent_evolution_states.count()
  const evolutionLevels = await prisma.agent_evolution_states.groupBy({
    by: ['currentLevel'],
    _count: true,
  })

  // Subscription metrics
  const subscriptionTiers = await prisma.userSubscription.groupBy({
    by: ['tier'],
    _count: true,
  })

  // Popular agents
  const popularAgents = await prisma.consciousness_interactions.groupBy({
    by: ['agentId'],
    _count: true,
    orderBy: {
      _count: {
        agentId: 'desc',
      },
    },
    take: 10,
  })

  return {
    users: {
      total: totalUsers,
      activeToday: activeUsersToday,
      retentionRate: totalUsers > 0 ? activeUsersToday / totalUsers : 0,
    },
    interactions: {
      total: totalInteractions,
      lastHour: interactionsLastHour,
      averagePerUser: totalUsers > 0 ? totalInteractions / totalUsers : 0,
    },
    evolution: {
      total: totalEvolutions,
      levels: evolutionLevels.reduce(
        (acc: Record<string, number>, level: any) => {
          acc[level.currentLevel] = level._count
          return acc
        },
        {} as Record<string, number>
      ),
    },
    subscriptions: {
      tiers: subscriptionTiers.reduce(
        (acc: Record<string, number>, tier: any) => {
          acc[tier.tier] = tier._count
          return acc
        },
        {} as Record<string, number>
      ),
    },
    agents: {
      popular: popularAgents.map(agent => ({
        agentId: agent.agentId,
        interactions: agent._count,
      })),
    },
    timestamp: now.toISOString(),
  }
}

function formatPrometheusMetrics(metrics: MetricsSnapshot): string {
  const lines = []

  // User metrics
  lines.push('# HELP planetary_agents_users_total Total number of registered users')
  lines.push('# TYPE planetary_agents_users_total counter')
  lines.push(`planetary_agents_users_total ${metrics.users.total}`)

  lines.push('# HELP planetary_agents_users_active_today Active users in the last 24 hours')
  lines.push('# TYPE planetary_agents_users_active_today gauge')
  lines.push(`planetary_agents_users_active_today ${metrics.users.activeToday}`)

  // Interaction metrics
  lines.push('# HELP planetary_agents_interactions_total Total consciousness interactions')
  lines.push('# TYPE planetary_agents_interactions_total counter')
  lines.push(`planetary_agents_interactions_total ${metrics.interactions.total}`)

  lines.push('# HELP planetary_agents_interactions_last_hour Interactions in the last hour')
  lines.push('# TYPE planetary_agents_interactions_last_hour gauge')
  lines.push(`planetary_agents_interactions_last_hour ${metrics.interactions.lastHour}`)

  // Evolution metrics
  lines.push('# HELP planetary_agents_evolutions_total Total agent evolutions')
  lines.push('# TYPE planetary_agents_evolutions_total counter')
  lines.push(`planetary_agents_evolutions_total ${metrics.evolution.total}`)

  // Evolution levels
  Object.entries(metrics.evolution.levels).forEach(([level, count]) => {
    lines.push(`planetary_agents_evolution_level{level="${level}"} ${count}`)
  })

  // Subscription tiers
  lines.push('# HELP planetary_agents_subscriptions Subscription distribution by tier')
  lines.push('# TYPE planetary_agents_subscriptions gauge')
  Object.entries(metrics.subscriptions.tiers).forEach(([tier, count]) => {
    lines.push(`planetary_agents_subscriptions{tier="${tier}"} ${count}`)
  })

  // Popular agents
  lines.push('# HELP planetary_agents_agent_interactions Interactions per agent')
  lines.push('# TYPE planetary_agents_agent_interactions counter')
  metrics.agents.popular.forEach(agent => {
    lines.push(
      `planetary_agents_agent_interactions{agent_id="${agent.agentId}"} ${agent.interactions}`
    )
  })

  return `${lines.join('\n')}\n`
}

// Health dashboard endpoint
export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json()

    if (action === 'dashboard') {
      const metrics = await generateMetrics()
      const backend: { status: string; responseTime: number | null } = {
        status: 'checking...',
        responseTime: null,
      }

      // Add real-time system metrics
      const systemMetrics = {
        ...metrics,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
          platform: process.platform,
        },
        backend,
      }

      // Test backend connectivity
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const startTime = Date.now()
        // PA backend exposes /health (not /api/health) — see backend/main.py.
        const response = await fetch(`${backendUrl}/health`, {
          signal: AbortSignal.timeout(5000),
        })
        const responseTime = Date.now() - startTime

        systemMetrics.backend = {
          status: response.ok ? 'healthy' : 'degraded',
          responseTime,
        }
      } catch (error) {
        systemMetrics.backend = {
          status: 'offline',
          responseTime: null,
        }
      }

      return NextResponse.json({
        success: true,
        data: systemMetrics,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Metrics dashboard error:', error)
    return NextResponse.json({ error: 'Failed to generate dashboard' }, { status: 500 })
  }
}
