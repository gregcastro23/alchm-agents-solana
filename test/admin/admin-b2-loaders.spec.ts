// @vitest-environment node
/**
 * The B2 loaders (agents, build health, chats, the shared dashboard) keep each
 * source independent: one failed read becomes that section's reason, never a
 * zero, and never takes the other sections down with it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  const fail = (msg: string) =>
    vi.fn(async () => {
      throw new Error(msg)
    })
  return {
    fail,
    prisma: {} as Record<string, any>,
  }
})

vi.mock('@/lib/db', () => ({ prisma: db.prisma }))

import { agentAlerts, buildAgentsReport, type CodeAgent } from '@/lib/admin/agents'
import {
  buildBuildHealthReport,
  combine,
  latestPerWorkflow,
  runState,
} from '@/lib/admin/build-health'
import { FAILED_SENTINEL, MODEL_STATS_SQL, chatAlerts, toModelStats } from '@/lib/admin/chats'
import { loadDashboard, startOfUtcDay } from '@/lib/admin/dashboard'
import { readSection } from '@/lib/admin/section'

const code: CodeAgent[] = [
  { agentId: 'ada-lovelace', name: 'Ada Lovelace', chart: 'computed' },
  { agentId: 'hypatia', name: 'Hypatia', chart: 'placeholder' },
  { agentId: 'rumi', name: 'Rumi', chart: 'missing' },
]

describe('readSection', () => {
  it('carries the reason instead of a value', async () => {
    expect(await readSection(async () => 3)).toEqual({ ok: true, value: 3 })
    expect(
      await readSection(async () => {
        throw new Error('P1001: cannot reach db')
      })
    ).toEqual({
      ok: false,
      reason: 'P1001: cannot reach db',
    })
  })
})

describe('agents report', () => {
  const okDb = {
    readRoster: async () => ({
      historical: 2,
      active: 2,
      created: 5,
      rows: [
        { agentId: 'ada-lovelace', isActive: true, hasBirthchart: true },
        { agentId: 'hypatia', isActive: true, hasBirthchart: false },
      ],
    }),
    readSync: async () => ({
      rows: [
        { agentId: 'ada-lovelace', linked: true, lastActivationAt: '2026-09-23T08:00:00.000Z' },
        { agentId: 'hypatia', linked: false, lastActivationAt: null },
      ],
    }),
    readWallets: async () => ['ada-lovelace'],
    readActivity: async () => ({
      conversations24h: 0,
      conversations7d: 4,
      actions24h: {},
      actions7d: { posted: 3, debit_failed: 1 },
      byAgent7d: { 'ada-lovelace': { chats: 4, actions: 4 } },
    }),
  }

  it('flags agents missing from the DB and from alchm.kitchen', async () => {
    const r = await buildAgentsReport(code, okDb)
    expect(r.db.ok && r.db.value.historical).toBe(2)
    const ids = r.alerts.map(a => a.id)
    expect(ids).toContain('agents:not-seeded')
    expect(r.alerts.find(a => a.id === 'agents:not-seeded')!.detail).toBe('rumi')
    const sync = r.alerts.find(a => a.id === 'agents:not-synced')!
    expect(sync.title).toMatch(/^2 agents not linked/)
    expect(sync.detail).toBe('1 without an agentic user; 1 with no alchm.kitchen user id')
    // WTEN exposes no count yet: said, not faked.
    expect(r.wten.ok).toBe(false)
  })

  it('a failed source is its own section; the rest still read', async () => {
    const r = await buildAgentsReport(code, {
      ...okDb,
      readSync: async () => {
        throw new Error('relation "users" does not exist')
      },
    })
    expect(r.sync).toEqual({ ok: false, reason: 'relation "users" does not exist' })
    expect(r.db.ok).toBe(true)
    expect(r.activity.ok).toBe(true)
    expect(r.alerts.map(a => a.id)).toContain('agents:sections-unreadable')
    // No sync verdict can be drawn from an unread source.
    expect(r.alerts.map(a => a.id)).not.toContain('agents:not-synced')
  })

  it('raises nothing when everything is seeded and linked', () => {
    const alerts = agentAlerts({
      generatedAt: '',
      code: code.slice(0, 1),
      db: {
        ok: true,
        value: {
          historical: 1,
          active: 1,
          created: 0,
          rows: [{ agentId: 'ada-lovelace', isActive: true, hasBirthchart: true }],
        },
      },
      sync: {
        ok: true,
        value: { rows: [{ agentId: 'ada-lovelace', linked: true, lastActivationAt: null }] },
      },
      wallets: { ok: true, value: { agentIds: [] } },
      activity: {
        ok: true,
        value: {
          conversations24h: 0,
          conversations7d: 0,
          actions24h: {},
          actions7d: {},
          byAgent7d: {},
        },
      },
      wten: { ok: false, reason: 'not exposed' },
    })
    expect(alerts).toEqual([])
  })
})

describe('build health', () => {
  const run = (over: Record<string, unknown>) => ({
    name: 'CI',
    status: 'completed',
    conclusion: 'success',
    head_sha: 'a'.repeat(40),
    html_url: 'https://github.com/x/y/actions/runs/1',
    run_started_at: '2026-09-23T10:00:00Z',
    created_at: '2026-09-23T10:00:00Z',
    updated_at: '2026-09-23T10:05:00Z',
    ...over,
  })

  it('classifies runs and takes the worst per commit', () => {
    expect(runState({ status: 'in_progress', conclusion: null })).toBe('pending')
    expect(runState({ status: 'completed', conclusion: 'skipped' })).toBe('success')
    expect(runState({ status: 'completed', conclusion: 'timed_out' })).toBe('failure')
    expect(combine([])).toBe('none')
    expect(combine(['success', 'pending'])).toBe('pending')
    expect(combine(['success', 'pending', 'failure'])).toBe('failure')
  })

  it('keeps only the newest run of each workflow', () => {
    const latest = latestPerWorkflow([
      run({ conclusion: 'failure' }),
      run({ conclusion: 'success', head_sha: 'b'.repeat(40) }),
      run({ name: 'Lean', status: 'in_progress', conclusion: null }),
    ] as never)
    expect(latest.map(r => [r.workflow, r.state])).toEqual([
      ['CI', 'failure'],
      ['Lean', 'pending'],
    ])
    expect(latest[0].durationMs).toBe(5 * 60_000)
    expect(latest[1].durationMs).toBeNull()
  })

  it('reads each GitHub source separately and alerts on failing main', async () => {
    const get = async (p: string) => {
      if (p.endsWith('/commits/main'))
        return {
          sha: 'c'.repeat(40),
          html_url: 'u',
          commit: { message: 'feat: x\n\nbody', committer: { date: '2026-09-23T09:00:00Z' } },
        }
      if (p.includes('branch=main')) return { workflow_runs: [run({ conclusion: 'failure' })] }
      if (p.includes('/pulls')) throw new Error('GitHub API rate limit reached')
      if (p.includes('/compare/')) return { ahead_by: 12 }
      return { workflow_runs: [] }
    }
    const r = await buildBuildHealthReport(get, {
      repo: 'o/r',
      authenticated: false,
      sha: 'd'.repeat(40),
      ref: 'main',
      vercelEnv: 'production',
    })
    expect(r.main.ok && r.main.value.message).toBe('feat: x')
    expect(r.pulls).toEqual({ ok: false, reason: 'GitHub API rate limit reached' })
    expect(r.behind).toEqual({ ok: true, value: { commits: 12 } })
    const ids = r.alerts.map(a => a.id)
    expect(ids).toEqual([
      'build:github-unreadable',
      'build:main-ci-failing',
      'build:deploy-behind-main',
    ])
  })

  it('says why "behind main" is unknown off Vercel', async () => {
    const r = await buildBuildHealthReport(async () => ({ workflow_runs: [] }), {
      repo: 'o/r',
      authenticated: true,
      sha: null,
      ref: null,
      vercelEnv: null,
    })
    expect(r.behind.ok).toBe(false)
    expect(!r.behind.ok && r.behind.reason).toMatch(/not running on a Vercel deployment/)
  })
})

describe('chats', () => {
  it('maps SQL rows, keeping missing latency as null', () => {
    expect(
      toModelStats([
        {
          model: 'groq/llama',
          calls: 10,
          failures: 2,
          timed: 0,
          p50_ms: null,
          p95_ms: null,
          last_at: new Date('2026-09-23T00:00:00Z'),
        },
      ])
    ).toEqual([
      {
        model: 'groq/llama',
        calls: 10,
        failures: 2,
        timed: 0,
        p50Ms: null,
        p95Ms: null,
        lastAt: '2026-09-23T00:00:00.000Z',
      },
    ])
  })

  it('counts the same sentinel in SQL as in code', () => {
    expect(MODEL_STATS_SQL).toContain(`strpos("agentResponse", '${FAILED_SENTINEL}')`)
  })

  it('warns at a 10% failure rate over at least 10 chats, not on a handful', () => {
    const stats = (calls: number, failures: number) => ({
      generatedAt: '',
      byModel24h: {
        ok: true as const,
        value: [{ model: 'm', calls, failures, timed: calls, p50Ms: 1, p95Ms: 1, lastAt: '' }],
      },
      byModel7d: { ok: true as const, value: [] },
      recent: { ok: true as const, value: [] },
    })
    expect(chatAlerts(stats(10, 1)).map(a => a.id)).toEqual(['chats:failure-rate'])
    expect(chatAlerts(stats(10, 0))).toEqual([])
    expect(chatAlerts(stats(5, 5))).toEqual([])
  })
})

describe('shared dashboard', () => {
  beforeEach(() => {
    for (const key of Object.keys(db.prisma)) delete db.prisma[key]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 }))
    )
  })

  function stubPrisma(overrides: Record<string, Record<string, unknown>> = {}) {
    const empty = {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      groupBy: vi.fn(async () => []),
      aggregate: vi.fn(async () => ({
        _avg: {
          latencyMs: null,
          spiritScore: null,
          essenceScore: null,
          matterScore: null,
          substanceScore: null,
        },
        _sum: { conversations: 0 },
      })),
    }
    for (const model of [
      'users',
      'historical_agents',
      'created_agents',
      'consciousness_interactions',
      'agentJingDuel',
      'mcp_invocations',
      'group_chat_sessions',
    ]) {
      db.prisma[model] = { ...empty, ...(overrides[model] ?? {}) }
    }
    db.prisma.$queryRaw = vi.fn(async () => [{ '?column?': 1 }])
  }

  it('a failed read is a reason, not a zero; real zeros stay zero', async () => {
    stubPrisma({ users: { count: db.fail('P1001: Can’t reach database server') } })
    const r = await loadDashboard(new Date('2026-09-23T12:00:00Z'))
    expect(r.users.ok).toBe(false)
    expect(!r.users.ok && r.users.reason).toMatch(/P1001/)
    expect(r.agents).toEqual({
      ok: true,
      value: { historical: 0, created: 0, totalConversations: 0 },
    })
    expect(r.alerts.map(a => a.id)).toEqual(['dashboard:sections-unreadable'])
  })

  it('no longer invents 0.5 harmony or a 100% MCP success rate', async () => {
    stubPrisma()
    const r = await loadDashboard()
    expect(r.harmony).toEqual({
      ok: true,
      value: { spirit: null, essence: null, matter: null, substance: null },
    })
    expect(r.mcp.ok && r.mcp.value.successRate).toBeNull()
    expect(r.mcp.ok && r.mcp.value.avgLatencyMs).toBeNull()
  })

  it('reports the agents backend as down with the reason', async () => {
    stubPrisma()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad gateway', { status: 502 }))
    )
    const r = await loadDashboard()
    expect(r.system.backend.ok).toBe(false)
    expect(r.alerts.map(a => a.id)).toContain('dashboard:agents-backend-down')
  })

  it('counts "today" from 00:00 UTC', () => {
    expect(startOfUtcDay(new Date('2026-09-23T23:30:00-07:00')).toISOString()).toBe(
      '2026-09-24T00:00:00.000Z'
    )
  })
})
