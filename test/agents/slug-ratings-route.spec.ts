// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { feedStreamBus, type FeedStreamMessage } from '@/lib/agents/feed-stream-bus'
import { SACRED_STAT_KEYS } from '@/lib/agents/rating-contract'
import { SKY_BODIES, deriveLiveSky, type SkyLongitudes } from '@/lib/agents/rating/live-sky'
import { ESMS_TOKENS, type EsmsHoldings } from '@/lib/agents/rating/seals-surge'
import { resolveAgentAppearance } from '@/lib/agents/vessel-appearance-manifest'

const SECRET = 'Test-Internal-Secret-Value-9'
const NOW = new Date('2026-10-15T05:43:00Z')

const LONGITUDES: Record<string, [number, boolean]> = {
  Sun: [201.893, false],
  Moon: [254.488, false],
  Mercury: [226.6762, false],
  Venus: [215.71, true],
  Mars: [129.7684, false],
  Jupiter: [141.9852, false],
  Saturn: [10.4673, true],
  Uranus: [65.2121, true],
  Neptune: [2.4796, true],
  Pluto: [303.0663, true],
}
const sky = deriveLiveSky(
  Object.fromEntries(
    SKY_BODIES.map(b => [b, { longitude: LONGITUDES[b][0], retrograde: LONGITUDES[b][1] }])
  ) as SkyLongitudes,
  'swiss-ephemeris',
  NOW
)

const CREATOR_WALLET: EsmsHoldings = {
  spirit: 1234.5,
  essence: 2345.25,
  matter: 3456.75,
  substance: 4567.125,
}
const OTHER_WALLET: EsmsHoldings = {
  spirit: 9191.5,
  essence: 9292.25,
  matter: 9393.75,
  substance: 9494.125,
}
const NEWTON_WALLET: EsmsHoldings = {
  spirit: 12.5,
  essence: 3.25,
  matter: 7.75,
  substance: 20.125,
}
const GREG_WALLET: EsmsHoldings = {
  spirit: 77.5,
  essence: 66.25,
  matter: 55.75,
  substance: 44.125,
}
const PUSHED: EsmsHoldings = {
  spirit: 555.5,
  essence: 666.25,
  matter: 777.75,
  substance: 888.125,
}

const CREATOR = 'user-creator-1'
const OTHER_USER = 'user-someone-else'
const FORGED = 'agent-moonwalker-ab12'
const UNRATABLE = 'agent-blank-unratable'

type Row = Record<string, unknown>

interface World {
  forged: Row[]
  users: Array<{ id: string; email: string; isAgentic: boolean }>
  created: Array<{ id: string; creatorId: string | null; agentId: string; createdAt?: string }>
  wallets: Record<string, EsmsHoldings>
}

const forgedRow = (agentId: string, overrides: Row = {}): Row => ({
  agentId,
  name: 'Moonwalker',
  monicaConstant: 1.2,
  natalChart: {
    planets: {
      Sun: { sign: 'Aries', degree: 12 },
      Moon: { sign: 'Leo', degree: 3 },
      Mars: { sign: 'Sagittarius', degree: 20 },
    },
  },
  powerScore: 95,
  resonanceScore7: 93,
  wisdomScore: 94,
  charismaScore: 96,
  intuitionScore: 97,
  adaptabilityScore: 92,
  vitalityScore: 98,
  ...overrides,
})

const blankRow = (agentId: string): Row => ({
  agentId,
  name: 'Blank',
  natalChart: {},
  powerScore: 0,
  resonanceScore7: 0,
  wisdomScore: 0,
  charismaScore: 0,
  intuitionScore: 0,
  adaptabilityScore: 0,
  vitalityScore: 0,
})

const agentic = (agentId: string) => `${agentId}@agentic.alchm.kitchen`

const defaultWorld = (): World => ({
  forged: [forgedRow(FORGED), blankRow(UNRATABLE)],
  users: [
    { id: 'agentic-newton', email: agentic('isaac-newton'), isAgentic: true },
    { id: 'agentic-greg', email: agentic('greg-castro-1991'), isAgentic: true },
    { id: CREATOR, email: 'creator@example.test', isAgentic: false },
    { id: OTHER_USER, email: 'other@example.test', isAgentic: false },
  ],
  created: [{ id: 'cm-created-1', creatorId: CREATOR, agentId: FORGED }],
  wallets: {
    'agentic-newton': NEWTON_WALLET,
    'agentic-greg': GREG_WALLET,
    [CREATOR]: CREATOR_WALLET,
    [OTHER_USER]: OTHER_WALLET,
  },
})

const decimal = (n: number) => ({ toNumber: () => n, toString: () => String(n) })

function createFakeDb(world: World) {
  const forged = new Map(world.forged.map(row => [row.agentId as string, row]))
  const failures: { lookup?: unknown; wallet?: unknown; creator?: unknown; user?: unknown } = {}

  const historicalFindUnique = vi.fn(async ({ where }: { where: { agentId: string } }) => {
    if (failures.lookup) throw failures.lookup
    const row = forged.get(where.agentId)
    return row ? structuredClone(row) : null
  })
  const userFindFirst = vi.fn(
    async ({ where }: { where: { email: string; isAgentic: boolean } }) => {
      if (failures.user) throw failures.user
      const user = world.users.find(u => u.email === where.email && u.isAgentic === where.isAgentic)
      return user ? { id: user.id } : null
    }
  )
  const createdFindFirst = vi.fn(
    async ({
      where,
    }: {
      where: {
        creatorId: { not: null }
        OR: Array<{ id: string } | { blueprint: { path: string[]; equals: string } }>
      }
    }) => {
      if (failures.creator) throw failures.creator
      const rows = world.created
        .filter(row => row.creatorId !== null)
        .filter(row =>
          where.OR.some(clause =>
            'id' in clause ? row.id === clause.id : row.agentId === clause.blueprint.equals
          )
        )
      return rows.length > 0 ? { creatorId: rows[0].creatorId } : null
    }
  )
  const walletFindUnique = vi.fn(async ({ where }: { where: { userId: string } }) => {
    if (failures.wallet) throw failures.wallet
    const wallet = world.wallets[where.userId]
    if (!wallet) return null
    return Object.fromEntries(ESMS_TOKENS.map(token => [token, decimal(wallet[token])]))
  })

  return {
    prisma: {
      historical_agents: { findUnique: historicalFindUnique },
      users: { findFirst: userFindFirst },
      created_agents: { findFirst: createdFindFirst },
      tokenBalance: { findUnique: walletFindUnique },
    },
    historicalFindUnique,
    userFindFirst,
    createdFindFirst,
    walletFindUnique,
    failures,
  }
}

const getReq = (slug: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000/api/agents/${slug}/ratings`, { headers })

async function boot({ world = defaultWorld() }: { world?: World } = {}) {
  vi.resetModules()
  process.env.INTERNAL_API_SECRET = SECRET

  const db = createFakeDb(world)
  const session: { current: unknown } = { current: null }
  const auth = vi.fn(async () => {
    if (session.current instanceof Error) throw session.current
    return session.current
  })
  const resolveSky = vi.fn(async () => sky)

  vi.doMock('@/lib/db', () => ({ prisma: db.prisma }))
  vi.doMock('@/lib/auth', () => ({ auth }))
  vi.doMock('@/lib/agents/rating/live-sky', async importOriginal => ({
    ...(await importOriginal<typeof import('@/lib/agents/rating/live-sky')>()),
    resolveLiveSky: resolveSky,
  }))

  const route = await import('@/app/api/agents/[slug]/ratings/route')
  const resolverServer = await import('@/lib/agents/rating/rating-resolver.server')
  resolverServer.clearPushed()
  feedStreamBus.resetForTesting()

  return {
    route,
    resolverServer,
    db,
    auth,
    session,
    resolveSky,
    get: (slug: string, headers: Record<string, string> = {}) =>
      route.GET(getReq(slug, headers), { params: Promise.resolve({ slug }) }),
    options: () => route.OPTIONS(),
  }
}

type Harness = Awaited<ReturnType<typeof boot>>

describe('GET /api/agents/[slug]/ratings', () => {
  let h: Harness
  const feedMessages: FeedStreamMessage[] = []
  let unsub: () => void

  beforeEach(async () => {
    feedMessages.length = 0
    h = await boot()
    unsub = feedStreamBus.subscribe(m => feedMessages.push(m))
  })

  afterEach(() => {
    unsub?.()
    feedStreamBus.resetForTesting()
    h?.resolverServer.clearPushed()
  })

  describe('canonical historical agents', () => {
    it('rates isaac-newton with real stats, live sky, Saturn faction and emits to feed stream', async () => {
      const res = await h.get('isaac-newton')
      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe('*')

      const body = await res.json()
      expect(body.key).toBe('isaac-newton')
      expect(body.handle).toBe('Sir Isaac Newton')
      expect(body.faction).toBe(6)
      expect(body.factionName).toBe('Saturn')
      expect(body.provenance).toBe('historical')

      // Real ratings on [25, 99]
      for (const stat of SACRED_STAT_KEYS) {
        expect(body.ratings[stat]).toBeGreaterThanOrEqual(25)
        expect(body.ratings[stat]).toBeLessThanOrEqual(99)
      }
      expect(body.ovr).toBeGreaterThanOrEqual(25)
      expect(body.ovr).toBeLessThanOrEqual(99)
      expect(body.archetype).toBeDefined()
      expect(typeof body.archetype.title).toBe('string')

      // Live sky surge state
      expect(body.surge).toBeDefined()
      expect(typeof body.surge.meter).toBe('number')
      expect(['inferno', 'tempest', 'equilibrium']).toContain(body.surge.surgeType)

      // Verified appearance
      expect(body.appearance).toEqual(resolveAgentAppearance('isaac-newton'))

      // Emitted to feedStreamBus
      const ratingEvents = feedMessages.filter(m => m.event === 'agent_rating')
      expect(ratingEvents.length).toBe(1)
      expect((ratingEvents[0].data as { key: string }).key).toBe('isaac-newton')

      if (body.surge.active) {
        const surgeEvents = feedMessages.filter(m => m.event === 'resonance_surge')
        expect(surgeEvents.length).toBe(1)
        expect((surgeEvents[0].data as { agentId: string }).agentId).toBe('isaac-newton')
      }
    })

    it('matches case-insensitively for slugs like Isaac-Newton', async () => {
      const res = await h.get('Isaac-Newton')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.key).toBe('isaac-newton')
      expect(body.factionName).toBe('Saturn')
    })

    it('rates leonardo-da-vinci under Pluto faction (not Solaris)', async () => {
      const res = await h.get('leonardo-da-vinci')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.key).toBe('leonardo-da-vinci')
      expect(body.faction).toBe(9)
      expect(body.factionName).toBe('Pluto')
      expect(body.archetype.title).toBe('Symphonic Virtuoso')
    })

    it('rates emily-dickinson under Venus faction (not Solaris)', async () => {
      const res = await h.get('emily-dickinson')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.key).toBe('emily-dickinson')
      expect(body.faction).toBe(3)
      expect(body.factionName).toBe('Venus')
    })
  })

  describe('fixture pilots and aliases', () => {
    it('resolves user-avatar-neo as Adept Neo with Sun faction and Gregory Castro stats', async () => {
      const res = await h.get('user-avatar-neo')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.key).toBe('user-avatar-neo')
      expect(body.handle).toBe('Adept Neo')
      expect(body.provenance).toBe('user')
      expect(body.faction).toBe(0)
      expect(body.factionName).toBe('Sun')
      expect(body.appearance).toEqual(resolveAgentAppearance('user-avatar-neo'))

      const ratingEvents = feedMessages.filter(m => m.event === 'agent_rating')
      expect(ratingEvents.length).toBe(1)
      expect((ratingEvents[0].data as { key: string }).key).toBe('user-avatar-neo')
    })
  })

  describe('SpacetimeDB pushed holdings cache', () => {
    it('uses holdings pushed via rating-resolver cache for subsequent slug requests', async () => {
      h.resolverServer.rememberPushed('isaac-newton', PUSHED)
      const res = await h.get('isaac-newton')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.esms).toEqual(PUSHED)
      expect(body.esmsSource).toBe('spacetimedb')
    })

    it('shares pushed holdings between alias user-avatar-neo and greg-castro-1991', async () => {
      h.resolverServer.rememberPushed('greg-castro-1991', PUSHED)
      const res = await h.get('user-avatar-neo')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.esms).toEqual(PUSHED)
      expect(body.esmsSource).toBe('spacetimedb')
    })
  })

  describe('user-forged vessels and creator wallet privacy', () => {
    it('redacts creator wallet for anonymous callers (esmsSource: fallback, degraded: private)', async () => {
      const res = await h.get(FORGED)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.key).toBe(FORGED)
      expect(body.handle).toBe('Moonwalker')
      expect(body.provenance).toBe('user')
      expect(body.esmsSource).toBe('fallback')
      expect(body.degraded?.esms).toBe('owner wallet is private')
      // Creator wallet values must never appear in the anonymous response
      expect(body.esms.spirit).not.toBe(CREATOR_WALLET.spirit)
      expect(h.db.walletFindUnique).not.toHaveBeenCalled()
    })

    it('allows reading creator wallet when presenting INTERNAL_API_SECRET bearer', async () => {
      const res = await h.get(FORGED, { authorization: `Bearer ${SECRET}` })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.esms).toEqual(CREATOR_WALLET)
      expect(body.esmsSource).toBe('database')
      expect(h.db.walletFindUnique).toHaveBeenCalled()
    })

    it('allows reading creator wallet when signed in as the creator', async () => {
      h.session.current = { user: { id: CREATOR } }
      const res = await h.get(FORGED)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.esms).toEqual(CREATOR_WALLET)
      expect(body.esmsSource).toBe('database')
    })

    it('redacts creator wallet when signed in as a different user', async () => {
      h.session.current = { user: { id: OTHER_USER } }
      const res = await h.get(FORGED)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.esmsSource).toBe('fallback')
      expect(body.degraded?.esms).toBe('owner wallet is private')
      expect(h.db.walletFindUnique).not.toHaveBeenCalled()
    })
  })

  describe('validation and error handling', () => {
    it('returns 404 when agent is unknown', async () => {
      const res = await h.get('non-existent-agent-xyz')
      expect(res.status).toBe(404)
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
      const body = await res.json()
      expect(body.error).toBe('Agent not found')
    })

    it('returns 422 when agent is forged but unratable', async () => {
      const res = await h.get(UNRATABLE)
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe('Agent has no stats or natal chart to rate')
    })

    it.each([
      ['empty spaces', '   '],
      ['path traversal / slash', 'foo/bar'],
      ['special symbols', 'agent@bad!'],
      ['overly long slug', 'a'.repeat(101)],
    ])('returns 400 for invalid slug: %s', async (_, slug) => {
      const res = await h.get(slug)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Invalid or missing agent slug')
    })

    it('returns 503 when agent database lookup is temporarily unavailable', async () => {
      h.db.failures.lookup = new Error('Connection lost')
      const res = await h.get(FORGED)
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.error).toBe('Agent lookup is temporarily unavailable')
    })

    it('handles OPTIONS preflight with 204 and CORS headers', async () => {
      const res = await h.options()
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
      expect(res.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS')
      expect(res.headers.get('access-control-allow-headers')).toBe('Content-Type')
    })
  })
})
