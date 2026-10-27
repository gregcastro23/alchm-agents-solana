// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// /api/agents/unified is the public chat door AND a verbatim proxy of Railway's agent CRUD. Until
// this gate the CRUD half answered anyone: lib/backend.ts attaches INTERNAL_API_SECRET to every
// upstream call, so an anonymous caller could read every forged vessel's exact birth date, time and
// coordinates, and rename or delete a vessel.

const SECRET = 'unified-gate-secret-9f2c'
const ORIGIN = 'http://localhost'

const GATED_POST: Array<{ action: string; parameters?: Record<string, unknown>; calls: string[] }> =
  [
    { action: 'list', parameters: { limit: 5 }, calls: ['list'] },
    { action: 'get', parameters: { agentId: 'agent-1' }, calls: ['get'] },
    { action: 'create', parameters: { name: 'x' }, calls: ['create'] },
    { action: 'update', parameters: { agentId: 'agent-1', name: 'y' }, calls: ['update'] },
    { action: 'delete', parameters: { agentId: 'agent-1' }, calls: ['delete'] },
    { action: 'stats', parameters: {}, calls: ['stats'] },
    { action: 'search', parameters: { query: 'wren' }, calls: ['search'] },
    { action: 'dashboard', parameters: {}, calls: ['stats', 'list'] },
  ]

const ADMIN_ROW = { id: 'user-admin', email: 'admin@example.test', name: 'Admin', role: 'admin' }

type Backend = Record<string, ReturnType<typeof vi.fn>>

async function boot(options: { session?: unknown; dbUser?: unknown; spyOnGate?: boolean } = {}) {
  vi.resetModules()
  process.env.INTERNAL_API_SECRET = SECRET

  const agents: Backend = {
    list: vi.fn().mockResolvedValue([{ agentId: 'agent-1', birthTime: '05:41' }]),
    get: vi.fn().mockResolvedValue({ agentId: 'agent-1', birthTime: '05:41' }),
    create: vi.fn().mockResolvedValue({ agentId: 'agent-2' }),
    update: vi.fn().mockResolvedValue({ agentId: 'agent-1' }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    stats: vi.fn().mockResolvedValue({ total: 3 }),
    search: vi.fn().mockResolvedValue({ agents: [] }),
    multiChat: vi.fn().mockResolvedValue({ responses: [{ agentId: 'sirius', text: 'hello' }] }),
  }
  const session = options.session ?? null
  vi.doMock('@/lib/backend', () => ({
    backend: { agents },
    getAlchemicalQuantitiesLegacy: vi.fn(),
  }))
  vi.doMock('@/lib/auth', () => ({
    auth: vi.fn().mockResolvedValue(session),
    resolveAuth: vi.fn().mockResolvedValue({ session, identityUnavailable: false }),
  }))
  vi.doMock('@/lib/db', () => ({
    prisma: { users: { findFirst: vi.fn().mockResolvedValue(options.dbUser ?? null) } },
  }))
  vi.doMock('@/lib/agents/persona/build-agent-context', () => ({
    buildAgentContext: vi.fn(() => null),
  }))
  vi.doMock('@/lib/consciousness-persistence', () => ({
    consciousnessPersistence: { logInteraction: vi.fn() },
  }))
  vi.doMock('@/lib/namestone', () => ({ registerAgentSubnameOnCreate: vi.fn() }))

  const gate = vi.fn()
  // a doMock outlives resetModules: never let a previous test's stand-in answer for the real gate
  vi.doUnmock('@/lib/security/privileged-api-auth')
  if (options.spyOnGate) {
    vi.doMock('@/lib/security/privileged-api-auth', async importOriginal => {
      const actual = await importOriginal<typeof import('@/lib/security/privileged-api-auth')>()
      return {
        ...actual,
        requireAdminOrService: async (request: Request) => {
          gate()
          return actual.requireAdminOrService(request)
        },
      }
    })
  }

  const route = await import('@/app/api/agents/unified/route')
  return { route, agents, gate }
}

const originalSecret = process.env.INTERNAL_API_SECRET
function restoreSecret() {
  if (originalSecret === undefined) delete process.env.INTERNAL_API_SECRET
  else process.env.INTERNAL_API_SECRET = originalSecret
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`${ORIGIN}/api/agents/unified`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
const get = (query: string, headers: Record<string, string> = {}) =>
  new NextRequest(`${ORIGIN}/api/agents/unified?${query}`, { headers })

const NO_ACCESS: Array<
  [string, { session?: unknown; dbUser?: unknown; headers: Record<string, string> }]
> = [
  ['anonymous', { headers: {} }],
  ['wrong bearer', { headers: { authorization: 'Bearer not-the-secret' } }],
  ['wrong X-Internal-Secret', { headers: { 'x-internal-secret': 'not-the-secret' } }],
  [
    'a signed-in user who is not an admin',
    {
      session: { user: { id: 'user-1', role: 'user' } },
      dbUser: null,
      headers: { origin: ORIGIN },
    },
  ],
  [
    'a session that claims admin which the database does not confirm',
    {
      session: { user: { id: 'user-2', email: 'x@example.test', role: 'admin' } },
      dbUser: { ...ADMIN_ROW, id: 'user-2', role: 'user' },
      headers: { origin: ORIGIN },
    },
  ],
]

const anyBackendCall = (agents: Backend) =>
  Object.entries(agents)
    .filter(([, fn]) => fn.mock.calls.length > 0)
    .map(([name]) => name)

describe('POST /api/agents/unified: the CRUD actions need an admin or the internal secret', () => {
  afterEach(() => {
    restoreSecret()
    vi.restoreAllMocks()
  })

  for (const { action, parameters } of GATED_POST) {
    for (const [who, caller] of NO_ACCESS) {
      it(`${action}, ${who}: refused, and the upstream is never reached`, async () => {
        const { route, agents } = await boot({ session: caller.session, dbUser: caller.dbUser })
        const res = await route.POST(post({ action, parameters }, caller.headers))
        const body = await res.json()

        expect([401, 403]).toContain(res.status)
        expect(body.success).toBe(false)
        expect(JSON.stringify(body)).not.toContain('05:41')
        expect(anyBackendCall(agents)).toEqual([])
        // a refusal must not be cached and served to the admin who asks next
        expect(res.headers.get('cache-control')).toBe('private, no-store')
      })
    }
  }

  for (const { action, parameters, calls } of GATED_POST) {
    it(`${action}: the internal secret reaches the upstream`, async () => {
      const { route, agents } = await boot()
      const res = await route.POST(
        post({ action, parameters }, { authorization: `Bearer ${SECRET}` })
      )
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
      expect(anyBackendCall(agents).sort()).toEqual([...calls].sort())
    })
  }

  it('the secret is accepted in X-Internal-Secret too', async () => {
    const { route, agents } = await boot()
    const res = await route.POST(post({ action: 'stats' }, { 'x-internal-secret': SECRET }))
    expect(res.status).toBe(200)
    expect(agents.stats).toHaveBeenCalledOnce()
  })

  it('a database-verified admin session may use them, from this origin only', async () => {
    const session = { user: { id: ADMIN_ROW.id, email: ADMIN_ROW.email, role: 'admin' } }
    const ok = await boot({ session, dbUser: ADMIN_ROW })
    const allowed = await ok.route.POST(post({ action: 'stats' }, { origin: ORIGIN }))
    expect(allowed.status).toBe(200)
    expect(ok.agents.stats).toHaveBeenCalledOnce()

    const crossSite = await boot({ session, dbUser: ADMIN_ROW })
    const refused = await crossSite.route.POST(
      post(
        { action: 'delete', parameters: { agentId: 'agent-1' } },
        { origin: 'https://evil.example' }
      )
    )
    expect(refused.status).toBe(403)
    expect(crossSite.agents.delete).not.toHaveBeenCalled()

    const noOrigin = await boot({ session, dbUser: ADMIN_ROW })
    const refusedToo = await noOrigin.route.POST(
      post({ action: 'delete', parameters: { agentId: 'agent-1' } })
    )
    expect(refusedToo.status).toBe(403)
    expect(noOrigin.agents.delete).not.toHaveBeenCalled()
  })

  it('without INTERNAL_API_SECRET configured, no header unlocks anything (fail closed)', async () => {
    const { route, agents } = await boot()
    delete process.env.INTERNAL_API_SECRET
    for (const headers of [
      { authorization: 'Bearer ' },
      { authorization: 'Bearer undefined' },
      { 'x-internal-secret': '' },
      { 'x-internal-secret': 'undefined' },
    ]) {
      const res = await route.POST(post({ action: 'list' }, headers))
      expect([401, 403]).toContain(res.status)
    }
    expect(anyBackendCall(agents)).toEqual([])
  })

  it('an unknown action is gated too: a new case added later is private until someone decides otherwise', async () => {
    const anon = await boot()
    const refused = await anon.route.POST(post({ action: 'export-everything' }))
    expect(refused.status).toBe(401)

    const holder = await boot()
    const reached = await holder.route.POST(
      post({ action: 'export-everything' }, { authorization: `Bearer ${SECRET}` })
    )
    expect(reached.status).toBe(400)
    expect((await reached.json()).error).toContain('Unknown action')
  })

  it('a missing action is gated', async () => {
    const { route } = await boot()
    const res = await route.POST(post({ parameters: {} }))
    expect(res.status).toBe(401)
  })

  it('if identity cannot be established the answer is 503, never the data', async () => {
    const { route, agents } = await boot()
    vi.resetModules()
    vi.doMock('@/lib/security/privileged-api-auth', () => ({
      requireAdminOrService: vi.fn().mockRejectedValue(new Error('auth backend down: db.internal')),
    }))
    try {
      const again = await import('@/app/api/agents/unified/route')
      const res = await again.POST(post({ action: 'list' }))
      const body = await res.json()
      expect(res.status).toBe(503)
      expect(JSON.stringify(body)).not.toContain('db.internal')
      expect(anyBackendCall(agents)).toEqual([])
    } finally {
      vi.doUnmock('@/lib/security/privileged-api-auth')
    }
    void route
  })
})

describe('GET /api/agents/unified', () => {
  afterEach(() => {
    restoreSecret()
    vi.restoreAllMocks()
  })

  for (const [who, caller] of NO_ACCESS) {
    it(`?action=list, ${who}: refused and never cached`, async () => {
      const { route, agents } = await boot({ session: caller.session, dbUser: caller.dbUser })
      const res = await route.GET(get('action=list&limit=100', caller.headers))
      expect([401, 403]).toContain(res.status)
      expect(agents.list).not.toHaveBeenCalled()
      expect(res.headers.get('cache-control')).toBe('private, no-store')
      expect(res.headers.get('vary')).toContain('Cookie')
    })
  }

  it('?action=list with the secret answers, privately', async () => {
    const { route, agents } = await boot()
    const res = await route.GET(get('action=list&limit=100', { authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(200)
    expect(agents.list).toHaveBeenCalledWith({ action: 'list', limit: '100' })
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(res.headers.get('vary')).toContain('Authorization')
  })

  it('?action=health stays public and static', async () => {
    const { route, agents } = await boot()
    const res = await route.GET(get('action=health'))
    expect(res.status).toBe(200)
    expect((await res.json()).data.status).toBe('healthy')
    expect(anyBackendCall(agents)).toEqual([])
  })

  it('an unknown GET action is gated like any other', async () => {
    const { route } = await boot()
    expect((await route.GET(get('action=dump'))).status).toBe(401)
  })
})

describe('what stays public on /api/agents/unified', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = SECRET
  })
  afterEach(() => {
    restoreSecret()
    vi.restoreAllMocks()
  })

  it('chat, interact, multi_agent_chat and evolve never consult the gate', async () => {
    const { route, agents, gate } = await boot({ spyOnGate: true })

    // multi_agent_chat runs to completion anonymously, as the staking panel and the verify script use it
    const multi = await route.POST(
      post({ action: 'multi_agent_chat', agentIds: ['sirius'], message: 'hello' })
    )
    expect(multi.status).toBe(200)
    expect(agents.multiChat).toHaveBeenCalledOnce()

    // chat and interact fail on their own validation (no agentId), after the point a gate would sit
    for (const action of ['chat', 'interact']) {
      const res = await route.POST(post({ action }))
      expect(res.status).toBe(500)
      expect((await res.json()).error).toBe('Missing agentId')
    }

    const evolve = await route.POST(post({ action: 'evolve', parameters: { agentId: 'x' } }))
    expect(evolve.status).toBe(501)

    expect(gate).not.toHaveBeenCalled()
  })

  it('every other action consults the gate exactly once', async () => {
    const { route, gate } = await boot({ spyOnGate: true })
    for (const { action, parameters } of GATED_POST) {
      gate.mockClear()
      await route.POST(post({ action, parameters }))
      expect(gate, action).toHaveBeenCalledTimes(1)
    }
    gate.mockClear()
    await route.GET(get('action=list'))
    expect(gate).toHaveBeenCalledTimes(1)
  })
})

describe('in-repo callers of /api/agents/unified', () => {
  const ROOT = path.resolve(__dirname, '../..')
  const PUBLIC = new Set(['chat', 'interact', 'multi_agent_chat'])

  function sources(dir: string): string[] {
    const out: string[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.next', '.git'].includes(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...sources(full))
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(full)
    }
    return out
  }

  it('the app UI and scripts use only the public actions, so gating the CRUD ones breaks nobody', () => {
    const callers: Record<string, string[]> = {}
    for (const dir of ['app', 'components', 'hooks', 'lib', 'scripts', 'desktop-shell/src']) {
      const base = path.join(ROOT, dir)
      if (!fs.existsSync(base)) continue
      for (const file of sources(base)) {
        const rel = path.relative(ROOT, file)
        if (rel === 'app/api/agents/unified/route.ts') continue
        const text = fs.readFileSync(file, 'utf8')
        if (!text.includes('/api/agents/unified')) continue
        callers[rel] = [...text.matchAll(/action:\s*['"`]([A-Za-z_]+)['"`]/g)].map(m => m[1])
      }
    }

    // The callers known when the gate was added. A new one is not an error, but its actions are.
    expect(Object.keys(callers).sort()).toEqual(
      expect.arrayContaining([
        'components/alchemy/CommuneChat.tsx',
        'components/misc/agent-level-panel.tsx',
        'components/staking/StarAgentChatPanel.tsx',
        'scripts/verify-pentacles-foundation.ts',
      ])
    )
    for (const [file, actions] of Object.entries(callers)) {
      expect(actions.length, `${file} names no action`).toBeGreaterThan(0)
      for (const action of actions) {
        expect(PUBLIC.has(action), `${file} calls the gated action "${action}"`).toBe(true)
      }
    }
  })
})
