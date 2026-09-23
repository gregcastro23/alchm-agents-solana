import 'server-only'

import type { AdminAlert } from '@/lib/admin/alerts'
import { readSection, unreadable, type Section } from '@/lib/admin/section'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

/**
 * The shared admin read behind the Overview, Councils, Arenas, MCP,
 * Infrastructure and Deployments pages. Each part is read in isolation: a part
 * that fails carries its reason, so a page shows "—" and why instead of a zero.
 *
 * (Until 2026-09 this route swallowed every error into 0 or [], reported a
 * fixed 0.5 for the harmony averages when the aggregate failed, and stamped
 * `lastDeploy` with the request time.)
 */

export interface JingDuelRow {
  id: string
  sessionId: string
  userId: string | null
  source: string
  casterId: string
  casterName: string
  targetId: string
  targetName: string
  attackMoveId: string
  counterMoveId: string
  stance: string
  boostElement: string | null
  boostMagnitude: number
  cacheHit: boolean
  latencyMs: number | null
  modelUsed: string | null
  createdAt: string
  synastrySnapshot: Prisma.JsonValue
  casterTransitSnapshot: Prisma.JsonValue
  targetTransitSnapshot: Prisma.JsonValue
  casterPrompt: string | null
  casterResponse: string | null
  targetPrompt: string | null
  targetResponse: string | null
}

export interface DashboardReport {
  generatedAt: string
  users: Section<{ total: number; newToday: number; admins: number }>
  agents: Section<{ historical: number; created: number; totalConversations: number }>
  /** Roster averages; a null axis means no agent has that score, not 0.5. */
  harmony: Section<{
    spirit: number | null
    essence: number | null
    matter: number | null
    substance: number | null
  }>
  activity: Section<Array<{ type: string; description: string; timestamp: string }>>
  topAgents: Section<Array<{ id: string; name: string; interactions: number }>>
  jing: Section<{
    recentJingDuels: JingDuelRow[]
    jingAggregates: {
      total: number
      last24h: number
      last7d: number
      stanceHistogram: Record<string, number>
      boostElementHistogram: Record<string, number>
      topPairs: Array<{
        casterId: string
        targetId: string
        casterName: string
        targetName: string
        count: number
      }>
      avgLatencyMs: number | null
    }
  }>
  mcp: Section<{
    total: number
    last24h: number
    /** null when there were no calls in the window — not 100%. */
    successRate: number | null
    avgLatencyMs: number | null
    topTools: Array<{ toolName: string; count: number }>
    recent: Array<{
      toolName: string
      calledAt: string
      completedAt: string | null
      latencyMs: number | null
      success: boolean
      caller: string | null
      arguments: Prisma.JsonValue
      errorMessage: string | null
      agentId: string | null
    }>
  }>
  groupChats: Section<{
    total: number
    last24h: number
    recent: Array<{
      id: string
      agentIds: Prisma.JsonValue
      transitKey: string | null
      userId: string | null
      origin: string | null
      createdAt: string
    }>
    originHistogram: Record<string, number>
  }>
  system: {
    database: Section<{ latencyMs: number }>
    backend: Section<{ url: string; status: number; latencyMs: number }>
    /** Whether a key is set on this deployment — configured, not verified working. */
    providersConfigured: Record<string, boolean>
    deployment: {
      url: string | null
      env: string | null
      commitSha: string | null
      commitRef: string | null
      region: string | null
    }
  }
  alerts: AdminAlert[]
}

const round2 = (v: number | null | undefined) =>
  v === null || v === undefined ? null : Math.round(v * 100) / 100

export function startOfUtcDay(now: Date): Date {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function agentBackendUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    'https://api.agents.alchm.kitchen'
  ).replace(/\/$/, '')
}

export async function loadDashboard(now: Date = new Date()): Promise<DashboardReport> {
  const since24h = new Date(now.getTime() - 86_400_000)
  const since7d = new Date(now.getTime() - 7 * 86_400_000)

  const [users, agents, harmony, activity, topAgents, jing, mcp, groupChats, database, backend] =
    await Promise.all([
      readSection(async () => {
        const [total, newToday, admins] = await Promise.all([
          prisma.users.count(),
          prisma.users.count({ where: { createdAt: { gte: startOfUtcDay(now) } } }),
          prisma.users.count({ where: { role: 'admin' } }),
        ])
        return { total, newToday, admins }
      }),
      readSection(async () => {
        const [historical, created, conv] = await Promise.all([
          prisma.historical_agents.count(),
          prisma.created_agents.count(),
          prisma.historical_agents.aggregate({ _sum: { conversations: true } }),
        ])
        return { historical, created, totalConversations: conv._sum?.conversations ?? 0 }
      }),
      readSection(async () => {
        const avg = await prisma.historical_agents.aggregate({
          _avg: { spiritScore: true, essenceScore: true, matterScore: true, substanceScore: true },
        })
        return {
          spirit: round2(avg._avg.spiritScore),
          essence: round2(avg._avg.essenceScore),
          matter: round2(avg._avg.matterScore),
          substance: round2(avg._avg.substanceScore),
        }
      }),
      readSection(async () => {
        const rows = await prisma.consciousness_interactions.findMany({
          take: 10,
          orderBy: { timestamp: 'desc' },
          select: { interactionType: true, agentId: true, timestamp: true },
        })
        return rows.map(i => ({
          type: i.interactionType,
          description: `Interaction with agent ${i.agentId}`,
          timestamp: i.timestamp.toISOString(),
        }))
      }),
      readSection(async () => {
        const top = await prisma.historical_agents.findMany({
          take: 5,
          orderBy: { conversations: 'desc' },
          select: { agentId: true, name: true, conversations: true },
        })
        return top.map(a => ({ id: a.agentId, name: a.name, interactions: a.conversations }))
      }),
      readSection(() => readJing(since24h, since7d)),
      readSection(() => readMcp(since24h)),
      readSection(() => readGroupChats(since24h)),
      readSection(async () => {
        const started = Date.now()
        await prisma.$queryRaw`SELECT 1`
        return { latencyMs: Date.now() - started }
      }),
      readSection(async () => {
        const url = agentBackendUrl()
        const started = Date.now()
        const res = await fetch(`${url}/health`, {
          signal: AbortSignal.timeout(3000),
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`${url}/health answered ${res.status}`)
        return { url, status: res.status, latencyMs: Date.now() - started }
      }),
    ])

  const report: Omit<DashboardReport, 'alerts'> = {
    generatedAt: now.toISOString(),
    users,
    agents,
    harmony,
    activity,
    topAgents,
    jing,
    mcp,
    groupChats,
    system: {
      database,
      backend,
      providersConfigured: {
        openai: Boolean(process.env.OPENAI_API_KEY),
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
        groq: Boolean(process.env.GROQ_API_KEY),
        gateway: process.env.AI_GATEWAY_ENABLED === 'true',
      },
      deployment: {
        url: process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || null,
        env: process.env.VERCEL_ENV || null,
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
        commitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
        region: process.env.VERCEL_REGION || null,
      },
    },
  }
  return { ...report, alerts: dashboardAlerts(report) }
}

export function dashboardAlerts(r: Omit<DashboardReport, 'alerts'>): AdminAlert[] {
  const failed = unreadable({
    users: r.users,
    agents: r.agents,
    harmony: r.harmony,
    activity: r.activity,
    topAgents: r.topAgents,
    jing: r.jing,
    mcp: r.mcp,
    groupChats: r.groupChats,
  })
  const alerts: AdminAlert[] = []
  if (failed.length > 0) {
    alerts.push({
      id: 'dashboard:sections-unreadable',
      severity: 'warning',
      source: 'infrastructure',
      title: `Could not read ${failed.join(', ')}`,
      detail: failed
        .map(k => `${k}: ${((r as Record<string, unknown>)[k] as { reason: string }).reason}`)
        .join(' · '),
      href: '/admin',
    })
  }
  if (!r.system.backend.ok) {
    alerts.push({
      id: 'dashboard:agents-backend-down',
      severity: 'critical',
      source: 'infrastructure',
      title: 'Agents backend health check failed',
      detail: r.system.backend.reason,
      href: '/admin/infrastructure',
    })
  }
  return alerts
}

async function readJing(
  since24h: Date,
  since7d: Date
): Promise<Extract<DashboardReport['jing'], { ok: true }>['value']> {
  const [duels, total, last24h, last7d, stanceGroups, boostGroups, pairGroups, latencyAgg] =
    await Promise.all([
      prisma.agentJingDuel.findMany({
        take: 30,
        orderBy: { createdAt: 'desc' },
        include: { caster: { select: { name: true } }, target: { select: { name: true } } },
      }),
      prisma.agentJingDuel.count(),
      prisma.agentJingDuel.count({ where: { createdAt: { gte: since24h } } }),
      prisma.agentJingDuel.count({ where: { createdAt: { gte: since7d } } }),
      prisma.agentJingDuel.groupBy({ by: ['stance'], _count: { _all: true } }),
      prisma.agentJingDuel.groupBy({ by: ['boostElement'], _count: { _all: true } }),
      prisma.agentJingDuel.groupBy({
        by: ['casterId', 'targetId'],
        _count: { _all: true },
        orderBy: { _count: { casterId: 'desc' } },
        take: 5,
      }),
      prisma.agentJingDuel.aggregate({ _avg: { latencyMs: true } }),
    ])

  const pairIds = Array.from(new Set(pairGroups.flatMap(p => [p.casterId, p.targetId])))
  const names = new Map(
    (
      await prisma.historical_agents.findMany({
        where: { agentId: { in: pairIds } },
        select: { agentId: true, name: true },
      })
    ).map(a => [a.agentId, a.name])
  )

  return {
    recentJingDuels: duels.map(d => ({
      id: d.id,
      sessionId: d.sessionId,
      userId: d.userId,
      source: d.source,
      casterId: d.casterId,
      casterName: d.caster?.name || d.casterId,
      targetId: d.targetId,
      targetName: d.target?.name || d.targetId,
      attackMoveId: d.attackMoveId,
      counterMoveId: d.counterMoveId,
      stance: d.stance,
      boostElement: d.boostElement,
      boostMagnitude: d.boostMagnitude,
      cacheHit: d.cacheHit,
      latencyMs: d.latencyMs,
      modelUsed: d.modelUsed,
      createdAt: d.createdAt.toISOString(),
      synastrySnapshot: d.synastrySnapshot,
      casterTransitSnapshot: d.casterTransitSnapshot,
      targetTransitSnapshot: d.targetTransitSnapshot,
      casterPrompt: d.casterPrompt,
      casterResponse: d.casterResponse,
      targetPrompt: d.targetPrompt,
      targetResponse: d.targetResponse,
    })),
    jingAggregates: {
      total,
      last24h,
      last7d,
      stanceHistogram: Object.fromEntries(stanceGroups.map(g => [g.stance, g._count._all])),
      boostElementHistogram: Object.fromEntries(
        boostGroups.map(g => [g.boostElement || 'none', g._count._all])
      ),
      topPairs: pairGroups.map(p => ({
        casterId: p.casterId,
        targetId: p.targetId,
        casterName: names.get(p.casterId) || p.casterId,
        targetName: names.get(p.targetId) || p.targetId,
        count: p._count._all,
      })),
      avgLatencyMs:
        latencyAgg._avg.latencyMs === null ? null : Math.round(latencyAgg._avg.latencyMs),
    },
  }
}

async function readMcp(
  since24h: Date
): Promise<Extract<DashboardReport['mcp'], { ok: true }>['value']> {
  const [total, last24h, success24h, latencyAgg, toolGroups, recentRows] = await Promise.all([
    prisma.mcp_invocations.count(),
    prisma.mcp_invocations.count({ where: { calledAt: { gte: since24h } } }),
    prisma.mcp_invocations.count({ where: { calledAt: { gte: since24h }, success: true } }),
    prisma.mcp_invocations.aggregate({
      where: { calledAt: { gte: since24h }, success: true },
      _avg: { latencyMs: true },
    }),
    prisma.mcp_invocations.groupBy({
      by: ['toolName'],
      _count: { _all: true },
      orderBy: { _count: { toolName: 'desc' } },
      take: 5,
    }),
    prisma.mcp_invocations.findMany({
      take: 15,
      orderBy: { calledAt: 'desc' },
      select: {
        toolName: true,
        calledAt: true,
        completedAt: true,
        latencyMs: true,
        success: true,
        caller: true,
        arguments: true,
        errorMessage: true,
        agentId: true,
      },
    }),
  ])
  return {
    total,
    last24h,
    successRate: last24h > 0 ? Math.round((success24h / last24h) * 100) : null,
    avgLatencyMs: latencyAgg._avg.latencyMs === null ? null : Math.round(latencyAgg._avg.latencyMs),
    topTools: toolGroups.map(g => ({ toolName: g.toolName, count: g._count._all })),
    recent: recentRows.map(row => ({
      ...row,
      calledAt: row.calledAt.toISOString(),
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    })),
  }
}

async function readGroupChats(
  since24h: Date
): Promise<Extract<DashboardReport['groupChats'], { ok: true }>['value']> {
  const [total, last24h, originGroups, recentRows] = await Promise.all([
    prisma.group_chat_sessions.count(),
    prisma.group_chat_sessions.count({ where: { createdAt: { gte: since24h } } }),
    prisma.group_chat_sessions.groupBy({ by: ['origin'], _count: { _all: true } }),
    prisma.group_chat_sessions.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        agentIds: true,
        transitKey: true,
        userId: true,
        origin: true,
        createdAt: true,
      },
    }),
  ])
  return {
    total,
    last24h,
    recent: recentRows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })),
    originHistogram: Object.fromEntries(
      originGroups.map(g => [g.origin || 'unknown', g._count._all])
    ),
  }
}
