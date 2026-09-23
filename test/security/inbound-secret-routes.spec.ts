// @vitest-environment node
/**
 * Every route that receives a shared secret still accepts the right one and
 * rejects a wrong one after moving to constant-time comparison. The work each
 * route does after auth is mocked out: these tests are about the gate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/agents/feed-pusher', () => ({
  feedPusherService: {
    evaluateAndPush: vi.fn(async () => ({ success: true, pushedCount: 0, errors: [] })),
    pushActions: vi.fn(async () => ({ success: true, pushedCount: 1, errors: [] })),
  },
}))
vi.mock('@/lib/services/agent-action-service', () => ({
  agentActionService: {
    runTick: vi.fn(async () => ({ errors: [] })),
    runDailyYieldForAgents: vi.fn(async () => ({ errors: [] })),
  },
}))
vi.mock('@/lib/agents/transit-attunement', () => ({
  runTransitAttunements: vi.fn(async () => null),
}))
vi.mock('@/lib/agents/scrabble-league', () => ({
  runLeagueTick: vi.fn(async () => ({ errors: [] })),
}))
vi.mock('@/lib/agents/sprite-reservoirs', () => ({
  refreshSpriteReservoirs: vi.fn(async () => ({ errors: 0 })),
}))
vi.mock('@/lib/agents/weekly-feature-rotation', () => ({
  resolveWeeklyFeature: vi.fn(async () => {
    throw new Error('stop after auth')
  }),
}))
vi.mock('@/lib/agents/historical', () => ({ HISTORICAL_AGENTS: [] }))
vi.mock('@/app/api/menu-planner/generate/route', () => ({ POST: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: { agentConversation: { deleteMany: vi.fn(async () => ({ count: 0 })) } },
}))
vi.mock('@/lib/solana/health', () => ({
  collectSolanaOperationalHealth: vi.fn(async () => ({ status: 'healthy' })),
}))
vi.mock('@/lib/services/economyService', () => ({
  EconomyService: { claimPlanetaryYield: vi.fn(async () => ({ success: true, amount: 5 })) },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(async () => ({ ok: false, status: 401, error: 'Unauthorized' })),
  adminErrorResponse: (r: { status: number; error: string }) =>
    NextResponse.json({ error: r.error }, { status: r.status }),
}))
vi.mock('@/lib/services/planetary-position-sync', () => ({
  planetaryPositionSyncService: { clearCache: vi.fn() },
}))
vi.mock('@/lib/agentkit', () => ({ isCdpConfigured: () => false }))
vi.mock('@/lib/agentkit/actions', () => ({ transferFromAgent: vi.fn() }))

const SECRET = 'r1ght-s3cret-value'
const WRONG = 'r1ght-s3cret-valuf'

type Handler = (req: any, ctx?: any) => Promise<Response>

const url = (path: string) => `https://agents.alchm.kitchen${path}`
const get = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(url(path), { headers })
const post = (path: string, headers: Record<string, string> = {}, body: unknown = {}) =>
  new NextRequest(url(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('CRON_SECRET', SECRET)
  vi.stubEnv('INTERNAL_API_SECRET', SECRET)
  vi.stubEnv('PLANETARY_SYNC_SECRET', '')
  vi.stubEnv('ALCHM_KITCHEN_SYNC_SECRET', '')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const CRONS: Array<[string, () => Promise<{ GET: Handler }>]> = [
  ['/api/cron/push-feed', () => import('@/app/api/cron/push-feed/route')],
  ['/api/cron/agents/tick', () => import('@/app/api/cron/agents/tick/route')],
  ['/api/cron/agents/claim-yield', () => import('@/app/api/cron/agents/claim-yield/route')],
  ['/api/cron/scrabble/tick', () => import('@/app/api/cron/scrabble/tick/route')],
  [
    '/api/cron/agents/refresh-reservoirs',
    () => import('@/app/api/cron/agents/refresh-reservoirs/route'),
  ],
  [
    '/api/cron/agents/announce-weekly-feature',
    () => import('@/app/api/cron/agents/announce-weekly-feature/route'),
  ],
  ['/api/cron/agents/weekly-menu', () => import('@/app/api/cron/agents/weekly-menu/route')],
]

describe.each(CRONS)('%s', (path, load) => {
  it('accepts Bearer CRON_SECRET', async () => {
    const { GET } = await load()
    const res = await GET(get(path, { authorization: `Bearer ${SECRET}` }))
    expect(res.status).not.toBe(401)
  })

  it('rejects a wrong, a missing, and a scheme-less secret', async () => {
    const { GET } = await load()
    for (const headers of [{ authorization: `Bearer ${WRONG}` }, {}, { authorization: SECRET }]) {
      expect((await GET(get(path, headers))).status).toBe(401)
    }
  })

  it('rejects everything on a deployment with no CRON_SECRET (including previews)', async () => {
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const { GET } = await load()
    expect((await GET(get(path))).status).toBe(401)
  })
})

describe('/api/cron/purge-guest-chats', () => {
  it('accepts CRON_SECRET via bearer, X-Sync-Secret or X-Cron-Secret, and rejects a wrong one', async () => {
    const { POST } = await import('@/app/api/cron/purge-guest-chats/route')
    vi.stubEnv('INTERNAL_API_SECRET', 'a-different-internal-secret')
    for (const headers of [
      { authorization: `Bearer ${SECRET}` },
      { 'x-sync-secret': SECRET },
      { 'x-cron-secret': SECRET },
    ]) {
      expect((await POST(post('/api/cron/purge-guest-chats', headers))).status).toBe(200)
    }
    expect(
      (await POST(post('/api/cron/purge-guest-chats', { 'x-cron-secret': WRONG }))).status
    ).toBe(401)
  })
})

describe('/api/solana/health', () => {
  it('accepts Bearer INTERNAL_API_SECRET and rejects a wrong one', async () => {
    const { GET } = await import('@/app/api/solana/health/route')
    expect(
      (await GET(get('/api/solana/health', { authorization: `Bearer ${SECRET}` }))).status
    ).toBe(200)
    expect(
      (await GET(get('/api/solana/health', { authorization: `Bearer ${WRONG}` }))).status
    ).toBe(401)
    expect((await GET(get('/api/solana/health'))).status).toBe(401)
  })
})

describe('/api/economy/claim-yield', () => {
  const body = { historicalAgentId: 'socrates', planetaryAgentId: 'planetary-mars-gemini-22' }
  it('accepts CRON_SECRET or INTERNAL_API_SECRET as a bearer', async () => {
    const { POST } = await import('@/app/api/economy/claim-yield/route')
    vi.stubEnv('CRON_SECRET', 'cron-only')
    for (const secret of ['cron-only', SECRET]) {
      const res = await POST(
        post('/api/economy/claim-yield', { authorization: `Bearer ${secret}` }, body)
      )
      expect(res.status).toBe(200)
    }
  })

  it('rejects a wrong bearer with no session', async () => {
    const { POST } = await import('@/app/api/economy/claim-yield/route')
    const res = await POST(
      post('/api/economy/claim-yield', { authorization: `Bearer ${WRONG}` }, body)
    )
    expect(res.status).toBe(401)
  })

  it('no longer lets NODE_ENV=test through unauthenticated', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const { POST } = await import('@/app/api/economy/claim-yield/route')
    expect((await POST(post('/api/economy/claim-yield', {}, body))).status).toBe(401)
  })
})

describe('/api/agents/[slug]/wallet/transfer', () => {
  const ctx = { params: Promise.resolve({ slug: 'ares' }) }
  it('accepts the internal secret in either header and rejects a wrong one', async () => {
    const { POST } = await import('@/app/api/agents/[slug]/wallet/transfer/route')
    // Past auth the route stops at 503 (CDP not configured) — anything but 401.
    for (const headers of [
      { authorization: `Bearer ${SECRET}` },
      { 'x-internal-secret': SECRET },
    ]) {
      expect((await POST(post('/x', headers), ctx)).status).toBe(503)
    }
    expect((await POST(post('/x', { 'x-internal-secret': WRONG }), ctx)).status).toBe(401)
  })
})

describe('/api/planetary-sync (gated actions)', () => {
  it('accepts the sync secret and rejects a wrong one', async () => {
    const { GET } = await import('@/app/api/planetary-sync/route')
    const ok = await GET(get('/api/planetary-sync?action=clear-cache', { 'x-sync-secret': SECRET }))
    expect(ok.status).toBe(200)
    const bad = await GET(get('/api/planetary-sync?action=clear-cache', { 'x-sync-secret': WRONG }))
    expect(bad.status).toBe(401)
  })
})

describe('validateInternalBearer (agent activity surfaces)', () => {
  it('accepts the right bearer and rejects a wrong one', async () => {
    const { validateInternalBearer } = await import('@/lib/agents/activity-surfaces')
    const req = (h: string) => new Request('https://x', { headers: { authorization: h } })
    expect(validateInternalBearer(req(`Bearer ${SECRET}`)).ok).toBe(true)
    expect(validateInternalBearer(req(`Bearer ${WRONG}`))).toMatchObject({ ok: false, status: 401 })
  })
})
