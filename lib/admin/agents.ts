import 'server-only'

import type { AdminAlert } from '@/lib/admin/alerts'
import { readSection, type Section } from '@/lib/admin/section'
import { prisma } from '@/lib/db'

/**
 * Agents page: the roster as the code defines it, checked against what the
 * database holds, which agents have an agentic user linked to alchm.kitchen,
 * and what each agent actually did in the last day and week.
 *
 * The code roster is bundled, so it always reads. Every other source is a
 * separate section: a failed read leaves that column "—" with its reason.
 */

export const AGENTIC_EMAIL_DOMAIN = 'agentic.alchm.kitchen'

export interface CodeAgent {
  agentId: string
  name: string
  /** computed | authored | placeholder | unattributed, or 'missing' when no chart */
  chart: string
}

export interface AgentsReport {
  generatedAt: string
  code: CodeAgent[]
  db: Section<{
    historical: number
    active: number
    created: number
    rows: Array<{ agentId: string; isActive: boolean; hasBirthchart: boolean }>
  }>
  sync: Section<{
    rows: Array<{ agentId: string; linked: boolean; lastActivationAt: string | null }>
  }>
  wallets: Section<{ agentIds: string[] }>
  activity: Section<{
    conversations24h: number
    conversations7d: number
    actions24h: Record<string, number>
    actions7d: Record<string, number>
    byAgent7d: Record<string, { chats: number; actions: number }>
  }>
  /** alchm.kitchen does not expose an agent count yet; kept so the page can say so. */
  wten: Section<{ agents: number }>
  alerts: AdminAlert[]
}

type Rows = Array<{ agentId: string; _count: { _all: number } }>

export async function buildAgentsReport(
  code: CodeAgent[],
  db: {
    readRoster(): Promise<AgentsReport['db'] extends Section<infer T> ? T : never>
    readSync(): Promise<AgentsReport['sync'] extends Section<infer T> ? T : never>
    readWallets(): Promise<string[]>
    readActivity(
      since24h: Date,
      since7d: Date
    ): Promise<AgentsReport['activity'] extends Section<infer T> ? T : never>
  },
  now: Date = new Date()
): Promise<AgentsReport> {
  const since24h = new Date(now.getTime() - 86_400_000)
  const since7d = new Date(now.getTime() - 7 * 86_400_000)
  const [roster, sync, wallets, activity] = await Promise.all([
    readSection(() => db.readRoster()),
    readSection(() => db.readSync()),
    readSection(async () => ({ agentIds: await db.readWallets() })),
    readSection(() => db.readActivity(since24h, since7d)),
  ])
  const report: Omit<AgentsReport, 'alerts'> = {
    generatedAt: now.toISOString(),
    code,
    db: roster,
    sync,
    wallets,
    activity,
    wten: {
      ok: false,
      reason:
        'alchm.kitchen exposes no agent roster count yet (requested); compare with its admin panel by hand.',
    },
  }
  return { ...report, alerts: agentAlerts(report) }
}

export function agentAlerts(r: Omit<AgentsReport, 'alerts'>): AdminAlert[] {
  const alerts: AdminAlert[] = []
  const codeIds = new Set(r.code.map(a => a.agentId))
  const unread = (['db', 'sync', 'wallets', 'activity'] as const).filter(k => !r[k].ok)
  if (unread.length > 0) {
    alerts.push({
      id: 'agents:sections-unreadable',
      severity: 'warning',
      source: 'agents',
      title: `Could not read ${unread.join(', ')} for the agent roster`,
      detail: unread.map(k => `${k}: ${(r[k] as { reason: string }).reason}`).join(' · '),
      href: '/admin/agents',
    })
  }
  if (r.db.ok) {
    const inDb = new Set(r.db.value.rows.map(row => row.agentId))
    const missing = [...codeIds].filter(id => !inDb.has(id))
    if (missing.length > 0) {
      alerts.push({
        id: 'agents:not-seeded',
        severity: 'warning',
        source: 'agents',
        title: `${missing.length} agent${missing.length === 1 ? '' : 's'} in code but not in historical_agents`,
        detail: missing.slice(0, 12).join(', ') + (missing.length > 12 ? ', …' : ''),
        remediation: 'Run bun run scripts/seed-historical-agents.ts against this environment.',
        href: '/admin/agents',
      })
    }
  }
  if (r.sync.ok) {
    const byId = new Map(r.sync.value.rows.map(row => [row.agentId, row]))
    const noUser = [...codeIds].filter(id => !byId.has(id))
    const unlinked = [...codeIds].filter(id => byId.has(id) && !byId.get(id)!.linked)
    if (noUser.length + unlinked.length > 0) {
      alerts.push({
        id: 'agents:not-synced',
        severity: 'warning',
        source: 'agents',
        title: `${noUser.length + unlinked.length} agent${noUser.length + unlinked.length === 1 ? '' : 's'} not linked to alchm.kitchen`,
        detail: [
          noUser.length ? `${noUser.length} without an agentic user` : '',
          unlinked.length ? `${unlinked.length} with no alchm.kitchen user id` : '',
        ]
          .filter(Boolean)
          .join('; '),
        remediation:
          'Run bun run scripts/provision-agentic-users.ts, then scripts/backfill-agent-sync.ts.',
        href: '/admin/agents',
      })
    }
  }
  return alerts
}

function countByStatus(
  rows: Array<{ status: string; _count: { _all: number } }>
): Record<string, number> {
  return Object.fromEntries(rows.map(row => [row.status, row._count._all]))
}

async function readFromPrisma(): Promise<Parameters<typeof buildAgentsReport>[1]> {
  return {
    async readRoster() {
      const [rows, created] = await Promise.all([
        prisma.historical_agents.findMany({
          select: { agentId: true, isActive: true, hasBirthchart: true },
        }),
        prisma.created_agents.count(),
      ])
      return {
        historical: rows.length,
        active: rows.filter(row => row.isActive).length,
        created,
        rows,
      }
    },
    async readSync() {
      const users = await prisma.users.findMany({
        where: { email: { endsWith: `@${AGENTIC_EMAIL_DOMAIN}` } },
        select: { email: true, alchmKitchenUserId: true, lastActivationAt: true },
      })
      return {
        rows: users.map(u => ({
          agentId: u.email.slice(0, -(AGENTIC_EMAIL_DOMAIN.length + 1)),
          linked: Boolean(u.alchmKitchenUserId),
          lastActivationAt: u.lastActivationAt?.toISOString() ?? null,
        })),
      }
    },
    async readWallets() {
      const rows = await prisma.agent_wallets.findMany({ select: { agentId: true } })
      return rows.map(row => row.agentId)
    },
    async readActivity(since24h, since7d) {
      const [c24, c7, a24, a7, chatsByAgent, actionsByAgent] = await Promise.all([
        prisma.agentConversation.count({ where: { createdAt: { gte: since24h } } }),
        prisma.agentConversation.count({ where: { createdAt: { gte: since7d } } }),
        prisma.agent_action_events.groupBy({
          by: ['status'],
          where: { evaluatedAt: { gte: since24h } },
          _count: { _all: true },
        }),
        prisma.agent_action_events.groupBy({
          by: ['status'],
          where: { evaluatedAt: { gte: since7d } },
          _count: { _all: true },
        }),
        prisma.agentConversation.groupBy({
          by: ['agentId'],
          where: { createdAt: { gte: since7d } },
          _count: { _all: true },
        }),
        prisma.agent_action_events.groupBy({
          by: ['agentId'],
          where: { evaluatedAt: { gte: since7d } },
          _count: { _all: true },
        }),
      ])
      const byAgent7d: Record<string, { chats: number; actions: number }> = {}
      for (const row of chatsByAgent as Rows) {
        byAgent7d[row.agentId] = { chats: row._count._all, actions: 0 }
      }
      for (const row of actionsByAgent as Rows) {
        byAgent7d[row.agentId] = {
          chats: byAgent7d[row.agentId]?.chats ?? 0,
          actions: row._count._all,
        }
      }
      return {
        conversations24h: c24,
        conversations7d: c7,
        actions24h: countByStatus(a24 as never),
        actions7d: countByStatus(a7 as never),
        byAgent7d,
      }
    },
  }
}

export async function codeRoster(): Promise<CodeAgent[]> {
  const { HISTORICAL_AGENTS } = await import('@/lib/agents/historical')
  return HISTORICAL_AGENTS.map(agent => {
    const chart = (agent as { consciousness?: { natalChart?: { provenance?: string } } })
      .consciousness?.natalChart
    return {
      agentId: agent.id,
      name: agent.name,
      chart: chart ? (chart.provenance ?? 'unattributed') : 'missing',
    }
  })
}

export async function loadAgentsReport(): Promise<AgentsReport> {
  return buildAgentsReport(await codeRoster(), await readFromPrisma())
}
