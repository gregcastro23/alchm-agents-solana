/**
 * Fixtures for the split admin pages, shaped by the zod schemas the pages
 * validate with — each is parsed, so a fixture that drifts fails loudly.
 */
import {
  AgentsReportSchema,
  BuildHealthReportSchema,
  ChatsReportSchema,
  DashboardReportSchema,
  type AgentsPayload,
  type BuildHealthPayload,
  type ChatsPayload,
  type DashboardPayload,
} from '@/lib/admin/page-schemas'

const NOW = '2026-09-23T12:00:00.000Z'

export function agentsFixture(opts: { syncFails?: boolean } = {}): AgentsPayload {
  return AgentsReportSchema.parse({
    generatedAt: NOW,
    code: [
      { agentId: 'ada-lovelace', name: 'Ada Lovelace', chart: 'computed' },
      { agentId: 'hypatia', name: 'Hypatia', chart: 'placeholder' },
      { agentId: 'rumi', name: 'Rumi', chart: 'missing' },
    ],
    db: {
      ok: true,
      value: {
        historical: 2,
        active: 2,
        created: 0,
        rows: [
          { agentId: 'ada-lovelace', isActive: true, hasBirthchart: true },
          { agentId: 'hypatia', isActive: true, hasBirthchart: false },
        ],
      },
    },
    sync: opts.syncFails
      ? { ok: false, reason: 'relation "users" does not exist' }
      : {
          ok: true,
          value: {
            rows: [
              {
                agentId: 'ada-lovelace',
                linked: true,
                lastActivationAt: '2026-09-23T11:00:00.000Z',
              },
              { agentId: 'hypatia', linked: false, lastActivationAt: null },
            ],
          },
        },
    wallets: { ok: true, value: { agentIds: ['ada-lovelace'] } },
    activity: {
      ok: true,
      value: {
        conversations24h: 0,
        conversations7d: 4,
        actions24h: {},
        actions7d: { posted: 3 },
        byAgent7d: { 'ada-lovelace': { chats: 4, actions: 3 } },
      },
    },
    wten: {
      ok: false,
      reason:
        'alchm.kitchen exposes no agent roster count yet (requested); compare with its admin panel by hand.',
    },
    alerts: [],
  })
}

export function buildFixture(): BuildHealthPayload {
  return BuildHealthReportSchema.parse({
    generatedAt: NOW,
    repo: 'gregcastro23/alchm-agents-solana',
    authenticated: false,
    deployed: { sha: 'd'.repeat(40), ref: 'main', env: 'production' },
    main: {
      ok: true,
      value: {
        sha: 'c'.repeat(40),
        message: 'feat: x',
        committedAt: NOW,
        url: 'https://github.com/x',
      },
    },
    behind: { ok: true, value: { commits: 0 } },
    ci: {
      ok: true,
      value: [
        {
          workflow: 'CI',
          state: 'failure',
          sha: 'c'.repeat(40),
          url: 'https://github.com/r/1',
          startedAt: NOW,
          durationMs: 300_000,
        },
        {
          workflow: 'Lean verify',
          state: 'success',
          sha: 'c'.repeat(40),
          url: 'https://github.com/r/2',
          startedAt: NOW,
          durationMs: 60_000,
        },
      ],
    },
    pulls: { ok: false, reason: 'GitHub API rate limit reached' },
    alerts: [],
  })
}

export function chatsFixture(): ChatsPayload {
  return ChatsReportSchema.parse({
    generatedAt: NOW,
    byModel24h: {
      ok: true,
      value: [
        {
          model: 'groq/llama-3.3-70b-versatile',
          calls: 10,
          failures: 2,
          timed: 0,
          p50Ms: null,
          p95Ms: null,
          lastAt: NOW,
        },
      ],
    },
    byModel7d: { ok: true, value: [] },
    recent: {
      ok: true,
      value: [
        {
          id: '1',
          agentId: 'rumi',
          agentName: 'Rumi',
          sessionId: 's',
          userMessage: 'hi',
          agentResponse: '[All providers unavailable]',
          responseTime: null,
          modelUsed: null,
          createdAt: NOW,
          failed: true,
        },
        {
          id: '2',
          agentId: 'hypatia',
          agentName: 'Hypatia',
          sessionId: 's',
          userMessage: 'hi',
          agentResponse: 'Greetings.',
          responseTime: 1200,
          modelUsed: 'groq/llama',
          createdAt: NOW,
          failed: false,
        },
      ],
    },
    alerts: [],
  })
}

export function dashboardFixture(): DashboardPayload {
  return DashboardReportSchema.parse({
    generatedAt: NOW,
    users: { ok: false, reason: 'P1001: Can’t reach database server' },
    agents: { ok: true, value: { historical: 12, created: 0, totalConversations: 0 } },
    harmony: { ok: true, value: { spirit: null, essence: null, matter: null, substance: null } },
    activity: { ok: true, value: [] },
    topAgents: { ok: true, value: [] },
    jing: { ok: false, reason: 'relation "AgentJingDuel" does not exist' },
    mcp: {
      ok: true,
      value: {
        total: 0,
        last24h: 0,
        successRate: null,
        avgLatencyMs: null,
        topTools: [],
        recent: [],
      },
    },
    groupChats: { ok: true, value: { total: 0, last24h: 0, recent: [], originHistogram: {} } },
    system: {
      database: { ok: true, value: { latencyMs: 14 } },
      backend: { ok: false, reason: 'https://api.agents.alchm.kitchen/health answered 502' },
      providersConfigured: {
        openai: false,
        anthropic: true,
        google: false,
        groq: true,
        gateway: false,
      },
      deployment: {
        url: 'agents.alchm.kitchen',
        env: 'production',
        commitSha: 'e'.repeat(40),
        commitRef: 'main',
        region: 'iad1',
      },
    },
    alerts: [],
  })
}
