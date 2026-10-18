// @vitest-environment node
/**
 * The rating route, in two layers.
 *
 *   1. "collaborators stubbed": the ESMS resolver is replaced, so the exact options the route
 *      hands it (the creator-wallet policy, the ledger loader, the push) and its failure
 *      handling can be read straight off the call.
 *   2. "end to end": nothing in `lib/agents/rating` is mocked. The real resolver and the real
 *      Prisma ledger loader run over an in-memory fake of `@/lib/db`, so a wallet that must
 *      stay private is proved private by the database never being asked for it.
 *
 * The route keeps its pushed-holdings cache and its rate-limit buckets at module level, so
 * every test boots a fresh module graph (`boot`) and nothing carries over between tests.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { SKY_BODIES, deriveLiveSky, type SkyLongitudes } from '@/lib/agents/rating/live-sky'
import { CORE_STAT_KEYS } from '@/lib/agents/rating/ovr-archetype'
import { ESMS_TOKENS, SEAL_TIERS, type EsmsHoldings } from '@/lib/agents/rating/seals-surge'
import { generateAccurateHoroscope } from '@/lib/monica/horoscope-generator'
import { ZODIAC_SIGNS } from '@/lib/staking/elements'

// ─── Constants ───────────────────────────────────────────────────────────────

const URL_ = 'http://localhost:3000/api/agents/rating'
const RESOLVER = '@/lib/agents/rating/esms-balance-resolver'
const SECRET = 'Test-Internal-Secret-Value-9'
const NOW = new Date('2026-10-15T05:43:00Z')
const TTL = 60_000

const READ_CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
}
const CORS_NAMES = Object.keys(READ_CORS)

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

const holdings = (each = 0): EsmsHoldings => ({
  spirit: each,
  essence: each,
  matter: each,
  substance: each,
})

// Wallets with values no rating, seal or coordinate could produce by accident, so that a number
// turning up anywhere in a response can only have come from that wallet.
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
const NEWTON_WALLET: EsmsHoldings = { spirit: 12.5, essence: 3.25, matter: 7.75, substance: 20.125 }
const GREG_WALLET: EsmsHoldings = { spirit: 77.5, essence: 66.25, matter: 55.75, substance: 44.125 }
const PUSHED: EsmsHoldings = { spirit: 555.5, essence: 666.25, matter: 777.75, substance: 888.125 }
const PUSHED_LATER: EsmsHoldings = {
  spirit: 31.5,
  essence: 32.25,
  matter: 33.75,
  substance: 34.125,
}
const numbersOf = (h: EsmsHoldings) => ESMS_TOKENS.map(token => String(h[token]))

const CREATOR = 'user-creator-1'
const OTHER_USER = 'user-someone-else'
const FORGED = 'agent-moonwalker-ab12'

// ─── The fake database ───────────────────────────────────────────────────────

type Row = Record<string, unknown>

interface World {
  /** `historical_agents` rows, by exact `agentId`. */
  forged: Row[]
  /** A row invented on demand for an id the world does not list. */
  forgedFor?: (agentId: string) => Row | undefined
  users: Array<{ id: string; email: string; isAgentic: boolean }>
  created: Array<{ id: string; creatorId: string | null; agentId: string; createdAt?: string }>
  /** `token_balances` rows by `users.id`. */
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

/** The score columns of a forged row written before any stats were persisted. */
const ZERO_SCORES = {
  powerScore: 0,
  resonanceScore7: 0,
  wisdomScore: 0,
  charismaScore: 0,
  intuitionScore: 0,
  adaptabilityScore: 0,
  vitalityScore: 0,
}

/** A forged row with nothing to rate: no chart and no persisted scores. */
const blankRow = (agentId = 'blank'): Row =>
  forgedRow(agentId, { name: 'Blank', natalChart: {}, ...ZERO_SCORES })

const agentic = (agentId: string) => `${agentId}@agentic.alchm.kitchen`

/** Roster agents with an agentic wallet, a person who forged FORGED, and their own wallets. */
const defaultWorld = (): World => ({
  forged: [forgedRow(FORGED)],
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

/**
 * An in-memory `@/lib/db`. Only the four reads the route's code path makes exist; touching any
 * other model or method (every write, `$transaction`, `$executeRaw`, ...) is recorded in
 * `violations` and throws.
 */
function createFakeDb(world: World) {
  const violations: string[] = []
  const failures: { lookup?: unknown; wallet?: unknown; creator?: unknown; user?: unknown } = {}
  const forged = new Map(world.forged.map(row => [row.agentId as string, row]))

  const historicalFindUnique = vi.fn(async ({ where }: { where: { agentId: string } }) => {
    if (failures.lookup) throw failures.lookup
    const row = forged.get(where.agentId) ?? world.forgedFor?.(where.agentId)
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
      if (!Array.isArray(where?.OR)) throw new Error('fake db: unexpected created_agents query')
      const rows = world.created
        .filter(row => row.creatorId !== null)
        .filter(row =>
          where.OR.some(clause =>
            'id' in clause ? row.id === clause.id : row.agentId === clause.blueprint.equals
          )
        )
        .sort(
          (a, b) =>
            Date.parse(a.createdAt ?? '2026-01-01') - Date.parse(b.createdAt ?? '2026-01-01')
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

  const guarded = <T extends object>(name: string, target: T): T =>
    new Proxy(target, {
      get(t, prop) {
        if (typeof prop === 'symbol' || prop === 'then') return undefined
        if (Object.hasOwn(t, prop)) return (t as Record<string, unknown>)[prop]
        return () => {
          violations.push(`${name}.${prop}`)
          throw new Error(`fake db: unexpected ${name}.${prop}`)
        }
      },
    })

  const prisma = guarded('prisma', {
    historical_agents: guarded('historical_agents', { findUnique: historicalFindUnique }),
    users: guarded('users', { findFirst: userFindFirst }),
    created_agents: guarded('created_agents', { findFirst: createdFindFirst }),
    tokenBalance: guarded('tokenBalance', { findUnique: walletFindUnique }),
  })

  return {
    prisma,
    violations,
    failures,
    historical: historicalFindUnique,
    users: userFindFirst,
    created: createdFindFirst,
    wallet: walletFindUnique,
  }
}

// ─── Booting the route ───────────────────────────────────────────────────────

/** `duplex` is required to send a stream body but is missing from the lib's RequestInit. */
type NextInit = NonNullable<ConstructorParameters<typeof NextRequest>[1]>

type ResolverStub = Mock<(agentId: string, options: Row) => Promise<unknown>>

interface BootOptions {
  world?: World
  /** Replace `resolveAgentEsmsBalances`; omitted, the real resolver and ledger loader run. */
  resolver?: ResolverStub
}

interface PostOptions {
  auth?: string | null
  raw?: boolean
  headers?: Record<string, string>
}

const getReq = (query: string, headers: Record<string, string> = {}) =>
  new NextRequest(`${URL_}${query}`, { headers })

const postReq = (
  body: unknown,
  { auth = `Bearer ${SECRET}`, raw = false, headers }: PostOptions = {}
) =>
  new NextRequest(URL_, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { authorization: auth } : {}),
      ...headers,
    },
    body: raw ? (body as string) : JSON.stringify(body),
  })

/** A POST whose body arrives as a stream: no Content-Length unless `declared` says so. */
function streamedPostReq(
  bytes: Uint8Array,
  { chunk = 1024, declared }: { chunk?: number; declared?: number } = {}
) {
  const state = { pulls: 0, cancelled: false, sent: 0 }
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        state.pulls++
        if (state.sent >= bytes.length) return controller.close()
        const next = bytes.subarray(state.sent, state.sent + chunk)
        state.sent += next.length
        controller.enqueue(next)
      },
      cancel() {
        state.cancelled = true
      },
    },
    { highWaterMark: 0 }
  )
  const request = new NextRequest(URL_, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${SECRET}`,
      ...(declared === undefined ? {} : { 'content-length': String(declared) }),
    },
    body: stream,
    duplex: 'half',
  } as NextInit)
  return { request, state }
}

/** A JSON body padded with trailing spaces to exactly `size` bytes. */
function jsonOfBytes(value: unknown, size: number): Uint8Array {
  const text = JSON.stringify(value)
  const encoded = new TextEncoder().encode(text)
  if (encoded.length > size) throw new Error('fixture larger than requested size')
  const out = new Uint8Array(size).fill(0x20)
  out.set(encoded)
  return out
}

async function boot({ world = defaultWorld(), resolver }: BootOptions = {}) {
  vi.resetModules()
  const db = createFakeDb(world)
  const session: { current: unknown } = { current: null }
  const auth = vi.fn(async () => {
    if (session.current instanceof Error) throw session.current
    return session.current
  })
  const rateCalls: Array<{ key: string; limit: number; windowMs: number }> = []
  const resolveSky = vi.fn(async () => sky)

  vi.doMock('@/lib/db', () => ({ prisma: db.prisma }))
  vi.doMock('@/lib/auth', () => ({ auth }))
  vi.doMock('@/lib/agents/rating/live-sky', async importOriginal => ({
    ...(await importOriginal<typeof import('@/lib/agents/rating/live-sky')>()),
    resolveLiveSky: resolveSky,
  }))
  vi.doMock('@/lib/security/rate-limit', async importOriginal => {
    const real = await importOriginal<typeof import('@/lib/security/rate-limit')>()
    return {
      ...real,
      rateLimit: (key: string, opts: { limit: number; windowMs: number }) => {
        rateCalls.push({ key, limit: opts.limit, windowMs: opts.windowMs })
        return real.rateLimit(key, opts)
      },
    }
  })
  if (resolver) {
    vi.doMock(RESOLVER, async importOriginal => ({
      ...(await importOriginal<typeof import('@/lib/agents/rating/esms-balance-resolver')>()),
      resolveAgentEsmsBalances: resolver,
    }))
  } else {
    vi.doUnmock(RESOLVER)
  }

  const route = await import('@/app/api/agents/rating/route')
  // The route checks `instanceof` against the class of THIS module graph.
  const liveSky = await import('@/lib/agents/rating/live-sky')
  const store = await import('@/lib/agents/rating/esms-ledger-store.server')

  return {
    route,
    db,
    auth,
    session,
    rateCalls,
    resolveSky,
    SkyUnavailableError: liveSky.SkyUnavailableError,
    prismaLedgerLoader: store.prismaLedgerLoader,
    get: (query: string, headers?: Record<string, string>) => route.GET(getReq(query, headers)),
    post: (body: unknown, options?: PostOptions) => route.POST(postReq(body, options)),
  }
}
type Harness = Awaited<ReturnType<typeof boot>>

// ─── Shared helpers ──────────────────────────────────────────────────────────

const bearer = { authorization: `Bearer ${SECRET}` }
const valid = { agentId: 'isaac-newton', esmsBalances: holdings(12) }

let errorSpy: Mock

/** Everything the route and its collaborators wrote to console.error, as one string. */
const logged = () => JSON.stringify(errorSpy.mock.calls)

const stubResolver = (): ResolverStub =>
  vi.fn(async (agentId: string, options: Row) =>
    options.spacetime
      ? { agentId, balances: options.spacetime, esmsSource: 'spacetimedb' }
      : { agentId, balances: holdings(3), esmsSource: 'database' }
  )

/** Every `token_balances` read the fake database saw, as the user ids it was asked for. */
const walletReads = (h: Harness) =>
  h.db.wallet.mock.calls.map(([args]) => (args as { where: { userId: string } }).where.userId)

const advanceTo = (ms: number) => vi.setSystemTime(NOW.getTime() + ms)

beforeEach(() => {
  vi.stubEnv('INTERNAL_API_SECRET', SECRET)
  vi.stubEnv('RATING_API_PER_CALLER_PER_MIN', undefined)
  vi.stubEnv('RATING_API_GLOBAL_PER_MIN', undefined)
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) as unknown as Mock
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('rating route configuration', () => {
  it('runs on the Node runtime and is never rendered statically or revalidated', async () => {
    const { route } = await boot()
    expect(route.runtime).toBe('nodejs') // the secret comparison uses node:crypto
    expect(route.dynamic).toBe('force-dynamic')
    expect(route.revalidate).toBe(0)
  })

  it('exposes exactly GET, POST and OPTIONS', async () => {
    const { route } = await boot()
    const handlers = Object.keys(route)
      .filter(name => typeof (route as Record<string, unknown>)[name] === 'function')
      .sort()
    expect(handlers).toEqual(['GET', 'OPTIONS', 'POST'])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Layer 1 — collaborators stubbed
// ═════════════════════════════════════════════════════════════════════════════

describe('rating route with the ESMS resolver stubbed', () => {
  it('serves a fully rated roster vessel on the Pentacle Vessel Rating Scale', async () => {
    const h = await boot({ resolver: stubResolver() })
    const res = await h.get('?agentId=isaac-newton')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Object.keys(body).sort()).toEqual(
      [
        'agentId', 'name', 'scale', 'ovr', 'ratings', 'spread', 'relativeAdvantage', 'archetype',
        'esmsBalances', 'esmsSource', 'seals', 'surge', 'appearance', 'zoneSynergies', 'bestZoneId',
        'sky',
      ].sort()
    ) // prettier-ignore
    expect(body).toMatchObject({ agentId: 'isaac-newton', name: 'Isaac Newton' })
    expect(body.scale).toEqual({ name: 'Pentacle Vessel Rating Scale', floor: 25, ceiling: 99 })
    expect(body.ovr).toBeGreaterThanOrEqual(25)
    expect(body.ovr).toBeLessThanOrEqual(99)
    expect(Object.keys(body.ratings).sort()).toEqual([...CORE_STAT_KEYS].sort())
    expect(body.archetype).toMatchObject({ title: expect.any(String), primary: expect.any(String) })
    expect(body.esmsBalances).toEqual(holdings(3))
    expect(body.esmsSource).toBe('database')
    expect(body.seals).toHaveLength(7)
    for (const seal of body.seals) {
      expect([null, ...SEAL_TIERS]).toContain(seal.tier)
      expect(seal.alignedRating).toEqual(expect.any(Number))
    }
    expect(body.surge).toMatchObject({
      monicaState: expect.stringMatching(/^(absent|equilibrium|convergent|divergent)$/),
      surgeType: expect.stringMatching(/^(inferno|tempest|equilibrium)$/),
      meter: expect.any(Number),
    })
    expect(body.appearance).toMatchObject({ agentId: 'isaac-newton', era: 'enlightenment' })
    expect(body.zoneSynergies.map((z: { zoneId: number }) => z.zoneId)).toEqual([
      ...Array(11).keys(),
    ])
    expect(body.sky).toMatchObject({ source: 'swiss-ephemeris', at: '2026-10-15T05:43:00.000Z' })
    expect(body.degraded).toBeUndefined()
  })

  it('hands the resolver a never-strict read through the server ledger loader, denied by default', async () => {
    const resolver = stubResolver()
    const h = await boot({ resolver })
    await h.get('?agentId=isaac-newton')

    expect(resolver).toHaveBeenCalledTimes(1)
    expect(resolver).toHaveBeenCalledWith('isaac-newton', {
      spacetime: null,
      strict: false,
      loadLedger: h.prismaLedgerLoader,
      creatorWallet: 'deny',
      onDegraded: expect.any(Function),
    })
  })

  it('logs a fall-through as stage and sanitised detail, through console.error', async () => {
    const resolver = stubResolver()
    const h = await boot({ resolver })
    await h.get('?agentId=isaac-newton')
    const { onDegraded } = resolver.mock.calls[0][1] as {
      onDegraded: (stage: string, detail: string) => void
    }

    onDegraded('ledger', 'PrismaClientKnownRequestError (P2021)')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      '[rating] esms ledger fell through: PrismaClientKnownRequestError (P2021)'
    )
  })

  it('rates Gregory’s Pentacles avatar from his roster agent’s ledger id and keeps the avatar look', async () => {
    const resolver = stubResolver()
    const h = await boot({ resolver })
    const body = await (await h.get('?agentId=user-avatar-neo')).json()

    expect(body.agentId).toBe('user-avatar-neo')
    expect(body.name).toBe('Gregory Castro')
    expect(body.appearance).toMatchObject({ agentId: 'user-avatar-neo', era: 'astral' })
    expect(resolver.mock.calls[0][0]).toBe('greg-castro-1991')
    expect(resolver.mock.calls[0][1]).toMatchObject({ creatorWallet: 'deny' })
  })

  it('passes the resolver’s provenance and its fixed-vocabulary reason straight through', async () => {
    const resolver: ResolverStub = vi.fn(async (agentId: string) => ({
      agentId,
      balances: holdings(0.5),
      esmsSource: 'fallback',
      degraded: { reason: 'ledger unavailable' },
    }))
    const h = await boot({ resolver })
    const res = await h.get('?agentId=isaac-newton')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.esmsSource).toBe('fallback')
    expect(body.esmsBalances).toEqual(holdings(0.5))
    expect(body.degraded).toEqual({ esms: 'ledger unavailable' })
  })

  it('announces a sky it could not compute: surge and sky are null, not defaults', async () => {
    const h = await boot({ resolver: stubResolver() })
    h.resolveSky.mockRejectedValue(new h.SkyUnavailableError('The sky is incomplete (Pluto)'))
    const res = await h.get('?agentId=isaac-newton')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.surge).toBeNull()
    expect(body.sky).toBeNull()
    expect(body.degraded).toEqual({ sky: 'The sky is incomplete (Pluto)' })
    expect(body.seals).toHaveLength(7) // everything that does not need the sky is still served
    expect(body.ovr).toBeGreaterThan(0)
  })

  describe('which wallet policy a GET asks for', () => {
    it('is deny for an anonymous caller of a forged vessel', async () => {
      const resolver = stubResolver()
      const h = await boot({ resolver })
      await h.get(`?agentId=${FORGED}`)
      expect(resolver.mock.calls[0][1]).toMatchObject({ creatorWallet: 'deny', spacetime: null })
    })

    it('is allow for a caller holding the internal secret', async () => {
      const resolver = stubResolver()
      const h = await boot({ resolver })
      await h.get(`?agentId=${FORGED}`, bearer)
      expect(resolver.mock.calls[0][1]).toMatchObject({ creatorWallet: 'allow' })
      expect(h.auth).not.toHaveBeenCalled()
    })

    it('is the signed-in user’s id for a session, and nothing wider', async () => {
      const resolver = stubResolver()
      const h = await boot({ resolver })
      h.session.current = { user: { id: OTHER_USER, email: 'x@example.test' } }
      await h.get(`?agentId=${FORGED}`)
      expect(resolver.mock.calls[0][1]).toMatchObject({ creatorWallet: { userId: OTHER_USER } })
    })

    it('is deny for a roster agent, however the caller identifies, and never consults the session', async () => {
      const resolver = stubResolver()
      const h = await boot({ resolver })
      h.session.current = { user: { id: CREATOR } }
      await h.get('?agentId=isaac-newton', bearer)
      await h.get('?agentId=isaac-newton')
      for (const [, options] of resolver.mock.calls) {
        expect(options).toMatchObject({ creatorWallet: 'deny' })
      }
      expect(h.auth).not.toHaveBeenCalled()
    })
  })

  describe('which holdings a GET lets the pushed cache override', () => {
    it('shows a roster push to anyone and a forged-vessel push only to the secret holder', async () => {
      const resolver = stubResolver()
      const h = await boot({ resolver })
      await h.post({ agentId: 'plato', esmsBalances: PUSHED })
      await h.post({ agentId: FORGED, esmsBalances: PUSHED_LATER })
      resolver.mockClear()

      await h.get('?agentId=plato')
      await h.get(`?agentId=${FORGED}`)
      await h.get(`?agentId=${FORGED}`, bearer)
      h.session.current = { user: { id: CREATOR } }
      await h.get(`?agentId=${FORGED}`)

      expect(resolver.mock.calls.map(([id, options]) => [id, options.spacetime])).toEqual([
        ['plato', PUSHED],
        [FORGED, null], // anonymous
        [FORGED, PUSHED_LATER], // the secret holder
        [FORGED, null], // even the signed-in creator is not shown the push
      ])
    })

    it('does not remember a push whose recalculation failed', async () => {
      const resolver = stubResolver()
      const h = await boot({ resolver })
      resolver.mockRejectedValueOnce(new Error('boom'))
      expect((await h.post({ agentId: 'plato', esmsBalances: PUSHED })).status).toBe(500)

      await h.get('?agentId=plato')
      expect(resolver).toHaveBeenLastCalledWith(
        'plato',
        expect.objectContaining({ spacetime: null })
      )
    })
  })

  describe('POST', () => {
    it('recalculates with the pushed holdings as live state, under the allow policy', async () => {
      const resolver = stubResolver()
      const h = await boot({ resolver })
      const res = await h.post({
        agentId: 'isaac-newton',
        esmsBalances: { ...holdings(12), extra: 1 },
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.esmsSource).toBe('spacetimedb')
      expect(body.esmsBalances).toEqual(holdings(12))
      expect(resolver).toHaveBeenCalledWith('isaac-newton', {
        spacetime: holdings(12),
        strict: false,
        loadLedger: h.prismaLedgerLoader,
        creatorWallet: 'allow',
        onDegraded: expect.any(Function),
      })
      // 12 whole tokens of each element, and every Seal reports exactly that balance.
      expect(body.seals.every((s: { balance: number }) => s.balance === 12)).toBe(true)
    })

    it('uses the allow policy for a forged vessel, whatever the session says', async () => {
      const resolver = stubResolver()
      const h = await boot({ resolver })
      h.session.current = { user: { id: OTHER_USER } }
      await h.post({ agentId: FORGED, esmsBalances: holdings(1) })
      expect(resolver.mock.calls[0][1]).toMatchObject({ creatorWallet: 'allow' })
      expect(h.auth).not.toHaveBeenCalled()
    })

    it('passes a push of zeros through as zeros, not as "no push"', async () => {
      const resolver = stubResolver()
      const h = await boot({ resolver })
      const res = await h.post({ agentId: 'plato', esmsBalances: holdings(0) })
      expect(res.status).toBe(200)
      expect(resolver.mock.calls[0][1]).toMatchObject({ spacetime: holdings(0) })
      await h.get('?agentId=plato')
      expect(resolver.mock.calls[1][1]).toMatchObject({ spacetime: holdings(0) })
    })
  })

  describe('a resolver that rejects', () => {
    const rejecting = () =>
      vi.fn(async () => {
        throw new Error('postgres://user:pw@db.internal/prod refused the connection')
      }) as unknown as ResolverStub

    it('is an opaque 500 for GET, logged by error class only', async () => {
      const h = await boot({ resolver: rejecting() })
      const res = await h.get('?agentId=isaac-newton')

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ success: false, error: 'Internal server error.' })
      expect(errorSpy).toHaveBeenCalledWith('[rating] GET failed:', 'Error')
      expect(logged()).not.toMatch(/postgres|pw@|db\.internal/)
    })

    it('is an opaque 500 for POST, logged by error class only', async () => {
      const h = await boot({ resolver: rejecting() })
      const res = await h.post(valid)

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ success: false, error: 'Internal server error.' })
      expect(errorSpy).toHaveBeenCalledWith('[rating] POST failed:', 'Error')
      expect(logged()).not.toMatch(/postgres|pw@|db\.internal/)
    })

    it('logs a driver error as Name (code), still without its message', async () => {
      const driver = Object.assign(
        new Error('relation "token_balances" does not exist; pw=hunter2'),
        {
          name: 'PrismaClientKnownRequestError',
          code: 'P2021',
        }
      )
      const resolver = vi.fn(async () => {
        throw driver
      }) as unknown as ResolverStub
      const h = await boot({ resolver })
      await h.get('?agentId=isaac-newton')

      expect(errorSpy).toHaveBeenCalledWith(
        '[rating] GET failed:',
        'PrismaClientKnownRequestError (P2021)'
      )
      expect(logged()).not.toMatch(/hunter2|token_balances/)
    })

    it('logs a thrown non-Error by its type alone', async () => {
      const resolver = vi.fn(async () => {
        throw 'postgres://user:pw@db.internal/prod'
      }) as unknown as ResolverStub
      const h = await boot({ resolver })
      const res = await h.get('?agentId=isaac-newton')
      expect(res.status).toBe(500)
      expect(errorSpy).toHaveBeenCalledWith('[rating] GET failed:', 'string')
      expect(logged()).not.toContain('postgres')
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Layer 2 — end to end: the real resolver and ledger loader over a fake database
// ═════════════════════════════════════════════════════════════════════════════

describe('rating route end to end', () => {
  // ─── (A) whose wallet a GET may show ───────────────────────────────────────

  describe('a creator’s wallet is private', () => {
    const noLeak = (text: string) => {
      for (const n of [...numbersOf(CREATOR_WALLET), ...numbersOf(OTHER_WALLET)]) {
        expect(text).not.toContain(n)
      }
      expect(text).not.toContain(CREATOR)
      expect(text).not.toContain(OTHER_USER)
    }

    it('answers an anonymous GET with the baseline, labelled, and never asks the ledger', async () => {
      const h = await boot()
      const res = await h.get(`?agentId=${FORGED}`)
      const text = await res.text()
      const body = JSON.parse(text)

      expect(res.status).toBe(200)
      expect(body.esmsSource).toBe('fallback')
      expect(body.esmsBalances).toEqual(holdings(0))
      expect(body.degraded).toEqual({ esms: 'owner wallet is private' })
      noLeak(text)
      expect(h.db.wallet).not.toHaveBeenCalled()
      expect(h.db.violations).toEqual([])
    })

    it('computes the Seals from that baseline, so a rich wallet cannot raise a tier', async () => {
      const anonymous = await (await (await boot()).get(`?agentId=${FORGED}`)).json()
      const unlocked = await (await (await boot()).get(`?agentId=${FORGED}`, bearer)).json()
      const noWallet = defaultWorld()
      noWallet.created = []
      noWallet.users = []
      const reference = await (
        await (await boot({ world: noWallet })).get(`?agentId=${FORGED}`)
      ).json()

      expect(reference.degraded).toEqual({ esms: 'no ledger row' })
      expect(reference.esmsBalances).toEqual(holdings(0))
      expect(anonymous.seals).toEqual(reference.seals)
      expect(anonymous.seals.every((s: { tier: unknown }) => s.tier === null)).toBe(true)
      expect(anonymous.seals.every((s: { balance: number }) => s.balance === 0)).toBe(true)
      // The wallet really does move tiers when it is allowed in, so the check above has teeth.
      expect(unlocked.seals.some((s: { tier: unknown }) => s.tier !== null)).toBe(true)
    })

    it('serves the creator’s balances to a caller with the internal secret', async () => {
      const h = await boot()
      const res = await h.get(`?agentId=${FORGED}`, bearer)
      const text = await res.text()
      const body = JSON.parse(text)

      expect(res.status).toBe(200)
      expect(body.esmsSource).toBe('database')
      expect(body.esmsBalances).toEqual(CREATOR_WALLET)
      expect(body.degraded).toBeUndefined()
      expect(walletReads(h)).toEqual([CREATOR])
      expect(h.auth).not.toHaveBeenCalled()
      // The numbers the private cases search for really are what an unlocked response carries.
      for (const n of numbersOf(CREATOR_WALLET)) expect(text).toContain(n)
    })

    it('reads the secret case-insensitively only in the scheme, never in the secret', async () => {
      const h = await boot()
      const lower = await (
        await h.get(`?agentId=${FORGED}`, { authorization: `bearer ${SECRET}` })
      ).json()
      expect(lower.esmsBalances).toEqual(CREATOR_WALLET)
      const upper = await (
        await h.get(`?agentId=${FORGED}`, { authorization: `BEARER ${SECRET}` })
      ).json()
      expect(upper.esmsBalances).toEqual(CREATOR_WALLET)
    })

    it('serves the creator’s balances to the signed-in creator', async () => {
      const h = await boot()
      h.session.current = { user: { id: CREATOR } }
      const body = await (await h.get(`?agentId=${FORGED}`)).json()

      expect(body.esmsSource).toBe('database')
      expect(body.esmsBalances).toEqual(CREATOR_WALLET)
      expect(walletReads(h)).toEqual([CREATOR])
      expect(h.auth).toHaveBeenCalledTimes(1)
    })

    it('does not serve it to a signed-in stranger, whose own rich wallet stays unread too', async () => {
      const h = await boot()
      h.session.current = { user: { id: OTHER_USER } }
      const res = await h.get(`?agentId=${FORGED}`)
      const text = await res.text()
      const body = JSON.parse(text)

      expect(body.esmsSource).toBe('fallback')
      expect(body.degraded).toEqual({ esms: 'owner wallet is private' })
      noLeak(text)
      expect(h.db.wallet).not.toHaveBeenCalled()
    })

    it.each([
      ['no session at all', null],
      ['an empty session', {}],
      ['a session with a null user', { user: null }],
      ['a session with a user and no id', { user: { email: 'a@example.test' } }],
      ['a session with an empty id', { user: { id: '' } }],
      ['a session with a numeric id', { user: { id: 42 } }],
      ['a session with a null id', { user: { id: null } }],
    ])('does not serve it to %s', async (_label, session) => {
      const h = await boot()
      h.session.current = session
      const res = await h.get(`?agentId=${FORGED}`)
      const text = await res.text()

      expect(res.status).toBe(200)
      expect(JSON.parse(text).degraded).toEqual({ esms: 'owner wallet is private' })
      noLeak(text)
      expect(h.db.wallet).not.toHaveBeenCalled()
    })

    it('does not take a session with an empty id for a creator whose recorded id is empty too', async () => {
      const world = defaultWorld()
      world.created = [{ id: 'cm-created-9', creatorId: '', agentId: FORGED }]
      world.wallets[''] = CREATOR_WALLET
      const h = await boot({ world })
      h.session.current = { user: { id: '' } }
      const text = await (await h.get(`?agentId=${FORGED}`)).text()

      expect(JSON.parse(text).degraded).toEqual({ esms: 'owner wallet is private' })
      noLeak(text)
      expect(h.db.wallet).not.toHaveBeenCalled()
    })

    it('tells a signed-in creator with no ledger row yet so, rather than inventing a wallet', async () => {
      const world = defaultWorld()
      delete world.wallets[CREATOR]
      const h = await boot({ world })
      h.session.current = { user: { id: CREATOR } }
      const body = await (await h.get(`?agentId=${FORGED}`)).json()

      expect(body).toMatchObject({
        esmsSource: 'fallback',
        esmsBalances: holdings(0),
        degraded: { esms: 'no ledger row' },
      })
      expect(walletReads(h)).toEqual([CREATOR])
    })

    it('does not serve it, and still answers 200, when the session lookup throws', async () => {
      const h = await boot()
      h.session.current = new Error('next-auth: JWT_SESSION_ERROR secret=abc')
      const res = await h.get(`?agentId=${FORGED}`)
      const text = await res.text()

      expect(res.status).toBe(200)
      expect(JSON.parse(text).degraded).toEqual({ esms: 'owner wallet is private' })
      noLeak(text)
      expect(text).not.toContain('JWT_SESSION_ERROR')
      expect(h.db.wallet).not.toHaveBeenCalled()
      expect(logged()).not.toContain('JWT_SESSION_ERROR')
    })

    it.each([
      ['the secret lowercased', SECRET.toLowerCase()],
      ['the secret uppercased', SECRET.toUpperCase()],
      ['a same-length wrong secret', `${SECRET.slice(0, -1)}8`],
      ['a prefix of the secret', SECRET.slice(0, -1)],
      ['the secret plus a character', `${SECRET}x`],
      ['the literal word undefined', 'undefined'],
      ['an empty token', ''],
    ])('is not unlocked by %s', async (_label, token) => {
      const h = await boot()
      const res = await h.get(`?agentId=${FORGED}`, { authorization: `Bearer ${token}` })
      const text = await res.text()

      expect(JSON.parse(text).degraded).toEqual({ esms: 'owner wallet is private' })
      noLeak(text)
      expect(h.db.wallet).not.toHaveBeenCalled()
    })

    it.each([
      ['the wrong scheme', `Basic ${SECRET}`],
      ['no scheme', SECRET],
      ['a trailing token', `Bearer ${SECRET} extra`],
      ['a bare Bearer', 'Bearer'],
    ])('is not unlocked by %s', async (_label, authorization) => {
      const h = await boot()
      const text = await (await h.get(`?agentId=${FORGED}`, { authorization })).text()

      expect(JSON.parse(text).degraded).toEqual({ esms: 'owner wallet is private' })
      noLeak(text)
      expect(h.db.wallet).not.toHaveBeenCalled()
    })

    it('lets a wrong bearer fall through to the session rather than refusing outright', async () => {
      const h = await boot()
      h.session.current = { user: { id: CREATOR } }
      const body = await (
        await h.get(`?agentId=${FORGED}`, { authorization: 'Bearer not-it' })
      ).json()
      expect(body.esmsBalances).toEqual(CREATOR_WALLET)
    })

    describe.each([
      ['unset', undefined],
      ['empty', ''],
    ])('with INTERNAL_API_SECRET %s', (_label, secret) => {
      it.each(['Bearer undefined', 'Bearer ', 'Bearer', 'Bearer null', 'Bearer ""'])(
        'is not unlocked by "%s"',
        async authorization => {
          vi.stubEnv('INTERNAL_API_SECRET', secret)
          const h = await boot()
          const text = await (await h.get(`?agentId=${FORGED}`, { authorization })).text()

          expect(JSON.parse(text).degraded).toEqual({ esms: 'owner wallet is private' })
          noLeak(text)
          expect(h.db.wallet).not.toHaveBeenCalled()
        }
      )
    })

    it('serves a roster agent’s agentic wallet to everyone without consulting the session', async () => {
      const h = await boot()
      h.session.current = { user: { id: OTHER_USER } }
      for (const headers of [undefined, bearer]) {
        const body = await (await h.get('?agentId=isaac-newton', headers)).json()
        expect(body.esmsSource).toBe('database')
        expect(body.esmsBalances).toEqual(NEWTON_WALLET)
        expect(body.degraded).toBeUndefined()
      }
      expect(h.auth).not.toHaveBeenCalled()
      expect(walletReads(h)).toEqual(['agentic-newton', 'agentic-newton'])
      expect(h.db.created).not.toHaveBeenCalled()
    })

    it('keeps a roster id on its agentic wallet even if a person’s forge claims that id', async () => {
      const world = defaultWorld()
      world.created.push({ id: 'cm-created-2', creatorId: CREATOR, agentId: 'isaac-newton' })
      const h = await boot({ world })
      const res = await h.get('?agentId=isaac-newton')
      const text = await res.text()

      expect(JSON.parse(text).esmsBalances).toEqual(NEWTON_WALLET)
      expect(walletReads(h)).toEqual(['agentic-newton'])
      noLeak(text)
    })

    it('serves a forged vessel that no person owns from its agentic user, to everyone', async () => {
      const world = defaultWorld()
      world.forged.push(forgedRow('sprite-lumen', { name: 'Lumen' }))
      world.users.push({ id: 'agentic-lumen', email: agentic('sprite-lumen'), isAgentic: true })
      world.wallets['agentic-lumen'] = NEWTON_WALLET
      const h = await boot({ world })
      const body = await (await h.get('?agentId=sprite-lumen')).json()

      expect(body.esmsSource).toBe('database')
      expect(body.esmsBalances).toEqual(NEWTON_WALLET)
    })

    it('resolves user-avatar-neo to the roster agent greg-castro-1991 and serves his agentic wallet publicly', async () => {
      const h = await boot()
      const res = await h.get('?agentId=user-avatar-neo')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.agentId).toBe('user-avatar-neo')
      expect(body.name).toBe('Gregory Castro')
      expect(body.appearance).toMatchObject({ agentId: 'user-avatar-neo', era: 'astral' })
      expect(body.esmsSource).toBe('database')
      expect(body.esmsBalances).toEqual(GREG_WALLET)
      expect(
        h.db.users.mock.calls.map(([args]) => (args as { where: { email: string } }).where.email)
      ).toEqual([
        agentic('greg-castro-1991'), // the ledger id, never the avatar alias
      ])
      expect(walletReads(h)).toEqual(['agentic-greg'])
      expect(h.auth).not.toHaveBeenCalled()
    })

    describe('a user-avatar-* vessel a person forged', () => {
      const avatarWorld = (withCreator: boolean) => {
        const world = defaultWorld()
        world.forged.push(forgedRow('user-avatar-zed', { name: 'Zed' }))
        if (withCreator) {
          world.created.push({ id: 'cm-created-3', creatorId: CREATOR, agentId: 'user-avatar-zed' })
        }
        return world
      }

      it('behaves like any forged vessel: private to an anonymous caller', async () => {
        const h = await boot({ world: avatarWorld(true) })
        const res = await h.get('?agentId=user-avatar-zed')
        const text = await res.text()

        expect(JSON.parse(text)).toMatchObject({
          esmsSource: 'fallback',
          esmsBalances: holdings(0),
          degraded: { esms: 'owner wallet is private' },
        })
        noLeak(text)
        expect(h.db.wallet).not.toHaveBeenCalled()
      })

      it('is shown to the secret holder and to its creator', async () => {
        const h = await boot({ world: avatarWorld(true) })
        expect(
          (await (await h.get('?agentId=user-avatar-zed', bearer)).json()).esmsBalances
        ).toEqual(CREATOR_WALLET)
        h.session.current = { user: { id: CREATOR } }
        expect((await (await h.get('?agentId=user-avatar-zed')).json()).esmsBalances).toEqual(
          CREATOR_WALLET
        )
      })

      it('has no wallet of its own to fall back to when no creator is on record', async () => {
        const h = await boot({ world: avatarWorld(false) })
        const body = await (await h.get('?agentId=user-avatar-zed', bearer)).json()
        expect(body.esmsSource).toBe('fallback')
        expect(body.degraded).toEqual({ esms: 'no ledger row' })
        expect(walletReads(h)).toEqual([])
      })
    })

    it('reports a ledger row that is corrupt as invalid, without echoing the value', async () => {
      const world = defaultWorld()
      world.wallets['agentic-newton'] = { ...NEWTON_WALLET, matter: -42.5 }
      const h = await boot({ world })
      const res = await h.get('?agentId=isaac-newton')
      const text = await res.text()

      expect(JSON.parse(text).esmsSource).toBe('fallback')
      expect(JSON.parse(text).degraded).toEqual({ esms: 'ledger row invalid' })
      expect(text).not.toContain('-42.5')
      expect(logged()).toContain('Invalid matter balance')
    })

    it('reports a missing ledger row for a roster agent as the roster baseline, labelled', async () => {
      const world = defaultWorld()
      world.users = world.users.filter(u => u.id !== 'agentic-newton')
      const h = await boot({ world })
      const body = await (await h.get('?agentId=isaac-newton')).json()
      const newton = HISTORICAL_AGENTS.find(a => a.id === 'isaac-newton')!

      expect(body.esmsSource).toBe('fallback')
      expect(body.degraded).toEqual({ esms: 'no ledger row' })
      expect(body.esmsBalances).toEqual(newton.consciousness.alchemicalElements)
    })
  })

  // ─── (B) the pushed-holdings cache ─────────────────────────────────────────

  describe('pushed holdings', () => {
    it('are not visible to an anonymous GET of a forged vessel, but are to the secret holder', async () => {
      const h = await boot()
      const push = await h.post({ agentId: FORGED, esmsBalances: PUSHED })
      expect(push.status).toBe(200)
      const pushedBody = await push.json()
      expect(pushedBody.esmsSource).toBe('spacetimedb')
      expect(pushedBody.esmsBalances).toEqual(PUSHED)

      const anonymous = await h.get(`?agentId=${FORGED}`)
      const text = await anonymous.text()
      expect(JSON.parse(text)).toMatchObject({
        esmsSource: 'fallback',
        esmsBalances: holdings(0),
        degraded: { esms: 'owner wallet is private' },
      })
      for (const n of numbersOf(PUSHED)) expect(text).not.toContain(n)

      const unlocked = await (await h.get(`?agentId=${FORGED}`, bearer)).json()
      expect(unlocked.esmsSource).toBe('spacetimedb')
      expect(unlocked.esmsBalances).toEqual(PUSHED)
      expect(unlocked.degraded).toBeUndefined()
    })

    it('are not shown to the signed-in creator either, who still reads their own ledger row', async () => {
      const h = await boot()
      await h.post({ agentId: FORGED, esmsBalances: PUSHED })
      h.session.current = { user: { id: CREATOR } }
      const body = await (await h.get(`?agentId=${FORGED}`)).json()
      expect(body.esmsSource).toBe('database')
      expect(body.esmsBalances).toEqual(CREATOR_WALLET)
    })

    it('are visible to an anonymous GET of a roster agent for 60 s, boundary included, and not after', async () => {
      const h = await boot()
      vi.useFakeTimers()
      advanceTo(0)
      await h.post({ agentId: 'isaac-newton', esmsBalances: PUSHED })

      for (const elapsed of [0, 1, TTL - 1, TTL]) {
        advanceTo(elapsed)
        const body = await (await h.get('?agentId=isaac-newton')).json()
        expect([elapsed, body.esmsSource, body.esmsBalances]).toEqual([
          elapsed,
          'spacetimedb',
          PUSHED,
        ])
      }

      advanceTo(TTL + 1)
      const expired = await (await h.get('?agentId=isaac-newton')).json()
      expect(expired.esmsSource).toBe('database')
      expect(expired.esmsBalances).toEqual(NEWTON_WALLET)
      // ...and once expired it stays gone.
      advanceTo(TTL + 2)
      expect((await (await h.get('?agentId=isaac-newton')).json()).esmsSource).toBe('database')
    })

    it('are renewed by a later push, whose own clock then governs', async () => {
      const h = await boot()
      vi.useFakeTimers()
      advanceTo(0)
      await h.post({ agentId: 'plato', esmsBalances: PUSHED })
      advanceTo(40_000)
      await h.post({ agentId: 'plato', esmsBalances: PUSHED_LATER })

      advanceTo(70_000) // 70 s after the first push, 30 s after the second
      const renewed = await (await h.get('?agentId=plato')).json()
      expect(renewed.esmsSource).toBe('spacetimedb')
      expect(renewed.esmsBalances).toEqual(PUSHED_LATER)

      advanceTo(40_000 + TTL + 1)
      expect((await (await h.get('?agentId=plato')).json()).esmsSource).not.toBe('spacetimedb')
    })

    it('belong to the agent pushed for, and to no other', async () => {
      const h = await boot()
      await h.post({ agentId: 'plato', esmsBalances: PUSHED })
      const newton = await (await h.get('?agentId=isaac-newton')).json()
      expect(newton.esmsBalances).toEqual(NEWTON_WALLET)
      expect((await (await h.get('?agentId=plato')).json()).esmsBalances).toEqual(PUSHED)
    })

    it.each([
      ['user-avatar-neo', 'greg-castro-1991'],
      ['greg-castro-1991', 'user-avatar-neo'],
      ['user-avatar-neo', 'greg-castro'],
      ['greg-castro', 'user-avatar-neo'],
    ])(
      'are shared by an alias and its roster id (pushed as %s, read as %s)',
      async (pushedAs, readAs) => {
        const h = await boot()
        const push = await h.post({ agentId: pushedAs, esmsBalances: PUSHED })
        expect(push.status).toBe(200)
        const body = await (await h.get(`?agentId=${readAs}`)).json()
        expect(body.esmsSource).toBe('spacetimedb')
        expect(body.esmsBalances).toEqual(PUSHED)
      }
    )

    it('are shared by an id written in any case', async () => {
      const h = await boot()
      const push = await (await h.post({ agentId: 'ISAAC-NEWTON', esmsBalances: PUSHED })).json()
      expect(push.agentId).toBe('isaac-newton')

      for (const readAs of ['isaac-newton', 'Isaac-Newton']) {
        const body = await (await h.get(`?agentId=${readAs}`)).json()
        expect([readAs, body.esmsSource]).toEqual([readAs, 'spacetimedb'])
      }
    })

    it('are not remembered when the push is refused', async () => {
      const h = await boot()
      for (const bad of [
        { agentId: 'plato', esmsBalances: { ...PUSHED, matter: -1 } },
        { agentId: 'plato', esmsBalances: { spirit: 1 } },
      ]) {
        expect((await h.post(bad)).status).toBe(400)
      }
      expect(
        (await h.post({ agentId: 'plato', esmsBalances: PUSHED }, { auth: 'Bearer nope' })).status
      ).toBe(401)
      expect((await (await h.get('?agentId=plato')).json()).esmsSource).not.toBe('spacetimedb')
    })

    describe('when more than 5000 distinct agents are pushed for', () => {
      const bulkWorld = (): World => ({
        ...defaultWorld(),
        forgedFor: id => (id.startsWith('bulk-') ? forgedRow(id) : undefined),
      })
      const pushRange = async (h: Harness, from: number, to: number) => {
        for (let i = from; i < to; i++) {
          const res = await h.post({ agentId: `bulk-${i}`, esmsBalances: holdings(1) })
          if (res.status !== 200) throw new Error(`push ${i} answered ${res.status}`)
        }
      }
      const seenAs = async (h: Harness, i: number) =>
        (
          await (
            await h.get(`?agentId=bulk-${i}`, { ...bearer, 'x-forwarded-for': `10.0.0.${i % 250}` })
          ).json()
        ).esmsSource

      it('drops everything still fresh to make room, and keeps working', async () => {
        const h = await boot({ world: bulkWorld() })
        vi.useFakeTimers()
        advanceTo(0)
        await pushRange(h, 0, 5001)

        expect(await seenAs(h, 5000)).toBe('spacetimedb')
        expect(await seenAs(h, 0)).toBe('fallback')
        expect(await seenAs(h, 4999)).toBe('fallback')
        // A new push after the purge is remembered like any other.
        expect((await h.post({ agentId: 'bulk-7', esmsBalances: PUSHED })).status).toBe(200)
        expect(await seenAs(h, 7)).toBe('spacetimedb')
      }, 60_000)

      it('drops only what has expired when that makes room', async () => {
        const h = await boot({ world: bulkWorld() })
        vi.useFakeTimers()
        advanceTo(0)
        await pushRange(h, 0, 2500)
        advanceTo(TTL + 1)
        await pushRange(h, 2500, 5001)

        expect(await seenAs(h, 5000)).toBe('spacetimedb')
        expect(await seenAs(h, 2500)).toBe('spacetimedb')
        expect(await seenAs(h, 4999)).toBe('spacetimedb')
        expect(await seenAs(h, 0)).toBe('fallback')
      }, 60_000)

      it('keeps all 5000 while there is room', async () => {
        const h = await boot({ world: bulkWorld() })
        vi.useFakeTimers()
        advanceTo(0)
        await pushRange(h, 0, 5000)
        expect(await seenAs(h, 0)).toBe('spacetimedb')
        expect(await seenAs(h, 4999)).toBe('spacetimedb')
      }, 60_000)
    })
  })

  // ─── (C) ids ───────────────────────────────────────────────────────────────

  describe('agent ids', () => {
    const PROTOTYPE_NAMES = [
      'constructor',
      'toString',
      'valueOf',
      'hasOwnProperty',
      'isPrototypeOf',
    ]

    it.each(PROTOTYPE_NAMES)('treats %s as an unknown agent on GET (404, not 500)', async id => {
      const h = await boot()
      const res = await h.get(`?agentId=${id}`)
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ success: false, error: `No agent "${id}" to rate.` })
      expect(h.db.historical).toHaveBeenCalledWith({ where: { agentId: id } })
    })

    it.each(PROTOTYPE_NAMES)('treats %s as an unknown agent on POST (404, not 500)', async id => {
      const h = await boot()
      const res = await h.post({ agentId: id, esmsBalances: holdings(1) })
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ success: false, error: `No agent "${id}" to rate.` })
    })

    it.each(PROTOTYPE_NAMES)(
      'rates a forged vessel that really is called %s, with a real look',
      async id => {
        const world = defaultWorld()
        world.forged.push(forgedRow(id, { name: `Vessel ${id}` }))
        const h = await boot({ world })
        const res = await h.get(`?agentId=${id}`)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.agentId).toBe(id)
        expect(body.appearance).toMatchObject({ era: 'astral' })
        expect(typeof body.appearance).toBe('object')
      }
    )

    it.each(['__proto__', '__defineGetter__', '_leading', '.hidden', '-leading'])(
      'rejects %s with 400 before any lookup',
      async id => {
        const h = await boot()
        expect((await h.get(`?agentId=${id}`)).status).toBe(400)
        expect((await h.post({ agentId: id, esmsBalances: holdings(1) })).status).toBe(400)
        expect(h.db.historical).not.toHaveBeenCalled()
      }
    )

    it.each([
      ['', 'an empty id'],
      ['%20', 'a space'],
      ['a/b', 'a slash'],
      ['../etc/passwd', 'a path'],
      ['bad id', 'an inner space'],
      ['é-agent', 'a non-ASCII letter'],
      ['isaac-newton%00', 'an encoded NUL'],
      ['%00', 'only a NUL'],
      ['isaac-newton%0A', 'a trailing newline'],
      ['isaac-newton%20', 'a trailing space'],
      ['a;b', 'a semicolon'],
    ])('rejects the agentId %j (%s) with the documented 400', async (id, _label) => {
      const h = await boot()
      const res = await h.get(`?agentId=${id}`)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({
        success: false,
        error: 'Invalid or missing agentId. Use 1-100 letters, digits, . _ -',
      })
      expect(h.db.historical).not.toHaveBeenCalled()
      expect(h.resolveSky).not.toHaveBeenCalled()
      expect(walletReads(h)).toEqual([])
    })

    it('is 400 with no agentId at all', async () => {
      const h = await boot()
      expect((await h.get('')).status).toBe(400)
      expect((await h.get('?agentid=isaac-newton')).status).toBe(400) // names are case-sensitive
    })

    it('accepts exactly 100 characters and refuses 101', async () => {
      const world = defaultWorld()
      world.forgedFor = id => (id.startsWith('long-') ? forgedRow(id) : undefined)
      const h = await boot({ world })
      const hundred = `long-${'x'.repeat(95)}`
      const res = await h.get(`?agentId=${hundred}`)
      expect(res.status).toBe(200)
      expect((await res.json()).agentId).toBe(hundred)
      expect((await h.get(`?agentId=${hundred}x`)).status).toBe(400)
    })

    it.each(['a', '9lives', 'Agent.v2_final-1', 'ISAAC-NEWTON'])(
      'accepts the well-formed id %s',
      async id => {
        const h = await boot()
        expect([id, [200, 404].includes((await h.get(`?agentId=${id}`)).status)]).toEqual([
          id,
          true,
        ])
        expect(h.db.violations).toEqual([])
      }
    )

    it('takes the first agentId when several are sent', async () => {
      const h = await boot()
      const body = await (await h.get('?agentId=plato&agentId=isaac-newton')).json()
      expect(body.agentId).toBe('plato')
    })

    it('resolves a slug the roster tolerates to its canonical id', async () => {
      const h = await boot()
      const body = await (await h.get('?agentId=greg-castro')).json()
      expect(body.agentId).toBe('greg-castro-1991')
    })

    describe('?roster=true', () => {
      it('lists every historical agent, publicly, from the static roster alone', async () => {
        const h = await boot()
        const res = await h.get('?roster=true')
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.count).toBe(HISTORICAL_AGENTS.length)
        expect(body.agents.map((a: { agentId: string }) => a.agentId)).toEqual(
          HISTORICAL_AGENTS.map(a => a.id)
        )
        for (const entry of body.agents) {
          expect(Object.keys(entry).sort()).toEqual(
            ['agentId', 'archetype', 'crownStyle', 'era', 'name', 'ovr', 'signatureRelic'].sort()
          )
          expect(entry.ovr).toBeGreaterThanOrEqual(25)
          expect(entry.ovr).toBeLessThanOrEqual(99)
        }
        expect(res.headers.get('cache-control')).toBe('public, max-age=300')
        for (const [name, value] of Object.entries(READ_CORS)) {
          expect([name, res.headers.get(name)]).toEqual([name, value])
        }
        // It touches nothing that could cost or leak: no session, ledger, database or sky.
        expect(h.auth).not.toHaveBeenCalled()
        expect(h.resolveSky).not.toHaveBeenCalled()
        expect(h.db.historical).not.toHaveBeenCalled()
        expect(h.db.wallet).not.toHaveBeenCalled()
        expect(h.db.users).not.toHaveBeenCalled()
        expect(h.db.created).not.toHaveBeenCalled()
      })

      it('takes precedence over an agentId, and only the exact word true selects it', async () => {
        const h = await boot()
        expect((await (await h.get('?roster=true&agentId=!!')).json()).count).toBe(
          HISTORICAL_AGENTS.length
        )
        for (const other of ['TRUE', '1', 'yes', '']) {
          expect([other, (await h.get(`?roster=${other}`)).status]).toEqual([other, 400])
        }
      })

      it('does not list a vessel a person forged', async () => {
        const h = await boot()
        const body = await (await h.get('?roster=true')).json()
        expect(body.agents.map((a: { agentId: string }) => a.agentId)).not.toContain(FORGED)
      })
    })
  })

  // ─── (D) POST ──────────────────────────────────────────────────────────────

  describe('POST /api/agents/rating', () => {
    describe('the secret', () => {
      it.each([undefined, ''])(
        'is 503 and does nothing when INTERNAL_API_SECRET is %j',
        async secret => {
          vi.stubEnv('INTERNAL_API_SECRET', secret)
          const h = await boot()
          for (const auth of [`Bearer ${SECRET}`, 'Bearer undefined', null]) {
            const res = await h.post(valid, { auth })
            expect(res.status).toBe(503)
            expect(await res.json()).toEqual({
              success: false,
              error: 'Rating sync is not configured.',
            })
          }
          expect(h.db.historical).not.toHaveBeenCalled()
          expect(h.resolveSky).not.toHaveBeenCalled()
        }
      )

      it.each([
        ['no Authorization header', null],
        ['a wrong secret', 'Bearer not-the-secret'],
        ['a same-length wrong secret', `Bearer ${SECRET.slice(0, -1)}8`],
        ['the secret in the wrong case', `Bearer ${SECRET.toLowerCase()}`],
        ['the secret in upper case', `Bearer ${SECRET.toUpperCase()}`],
        ['a prefix of the secret', `Bearer ${SECRET.slice(0, -1)}`],
        ['the secret with extra characters', `Bearer ${SECRET}x`],
        ['the secret and a second token', `Bearer ${SECRET} ${SECRET}`],
        ['the wrong scheme', `Basic ${SECRET}`],
        ['no scheme', SECRET],
        ['an empty bearer', 'Bearer '],
        ['a bare scheme', 'Bearer'],
      ])('is 401 with %s', async (_label, auth) => {
        const h = await boot()
        const res = await h.post(valid, { auth })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ success: false, error: 'Unauthorized' })
        expect(h.db.historical).not.toHaveBeenCalled()
        expect(h.resolveSky).not.toHaveBeenCalled()
      })

      it('is checked before the body is looked at', async () => {
        const h = await boot()
        const tooBig = await h.post('{not json', {
          auth: 'Bearer nope',
          raw: true,
          headers: { 'content-length': '99999' },
        })
        expect(tooBig.status).toBe(401)
        const { request, state } = streamedPostReq(new Uint8Array(10_000))
        request.headers.set('authorization', 'Bearer nope')
        expect((await h.route.POST(request)).status).toBe(401)
        expect(state.pulls).toBe(0)
      })

      it.each([`bearer ${SECRET}`, `BEARER ${SECRET}`, `Bearer   ${SECRET}`])(
        'accepts the scheme in any case and padded: %s',
        async auth => {
          const h = await boot()
          expect((await h.post(valid, { auth })).status).toBe(200)
        }
      )
    })

    describe('the body size', () => {
      const small = { agentId: 'isaac-newton', esmsBalances: holdings(1) }

      it('accepts exactly 4096 bytes and refuses 4097, on an honest Content-Length', async () => {
        const h = await boot()
        for (const [size, status] of [
          [4095, 200],
          [4096, 200],
          [4097, 413],
        ] as const) {
          const bytes = jsonOfBytes(small, size)
          const res = await h.route.POST(
            new NextRequest(URL_, {
              method: 'POST',
              headers: { authorization: `Bearer ${SECRET}`, 'content-length': String(size) },
              body: bytes as unknown as BodyInit,
            })
          )
          expect([size, res.status]).toEqual([size, status])
        }
      })

      it('counts bytes, not characters', async () => {
        const h = await boot()
        const bytesFor = (extra: string) =>
          new TextEncoder().encode(JSON.stringify({ ...small, note: extra }))
        const room = 4096 - bytesFor('').length
        const fits = 'é'.repeat(Math.floor(room / 2)) + 'x'.repeat(room % 2) // exactly 4096 bytes
        expect(bytesFor(fits).length).toBe(4096)
        const tooMany = `${fits}é` // 4098 bytes, but only ~2049 characters
        expect(bytesFor(tooMany).length).toBe(4098)

        const ok = await h.post({ ...small, note: fits })
        expect(ok.status).toBe(200)
        const refused = await h.post({ ...small, note: tooMany })
        expect(refused.status).toBe(413)
        expect(await refused.json()).toEqual({ success: false, error: 'Request body too large' })
      })

      it('refuses a body that merely declares itself too large, without reading it', async () => {
        const h = await boot()
        const { request, state } = streamedPostReq(jsonOfBytes(small, 100), { declared: 99_999 })
        const res = await h.route.POST(request)
        expect(res.status).toBe(413)
        expect(state.pulls).toBe(0)
      })

      it('takes the stream, not the header, as the truth when they disagree', async () => {
        const h = await boot()
        const { request } = streamedPostReq(new Uint8Array(5 * 1024 * 1024).fill(0x20), {
          chunk: 64 * 1024,
          declared: 100,
        })
        expect((await h.route.POST(request)).status).toBe(413)
      })

      it('refuses a 5 MiB stream with no Content-Length, after reading one chunk, and cancels it', async () => {
        const h = await boot()
        const { request, state } = streamedPostReq(new Uint8Array(5 * 1024 * 1024).fill(0x20), {
          chunk: 64 * 1024,
        })
        expect(request.headers.get('content-length')).toBeNull()
        const res = await h.route.POST(request)

        expect(res.status).toBe(413)
        expect(await res.json()).toEqual({ success: false, error: 'Request body too large' })
        expect(state.cancelled).toBe(true)
        expect(state.sent).toBeLessThanOrEqual(64 * 1024)
        expect(h.db.historical).not.toHaveBeenCalled()
      })

      it('accepts a streamed body of exactly 4096 bytes in small chunks, and refuses one byte more', async () => {
        const h = await boot()
        const ok = streamedPostReq(jsonOfBytes(small, 4096), { chunk: 700 })
        expect((await h.route.POST(ok.request)).status).toBe(200)
        expect(ok.state.cancelled).toBe(false)

        const over = streamedPostReq(jsonOfBytes(small, 4097), { chunk: 700 })
        expect((await h.route.POST(over.request)).status).toBe(413)
        expect(over.state.cancelled).toBe(true)
      })

      it('treats a Content-Length it cannot read as no declaration', async () => {
        const h = await boot()
        const res = await h.post(small, { headers: { 'content-length': 'many' } })
        expect(res.status).toBe(200)
      })

      it('is an opaque 500 for a stream that dies mid-body, logged by class only', async () => {
        const h = await boot()
        const stream = new ReadableStream<Uint8Array>({
          pull(controller) {
            controller.error(new Error('socket hang up at 10.1.2.3'))
          },
        })
        const res = await h.route.POST(
          new NextRequest(URL_, {
            method: 'POST',
            headers: { authorization: `Bearer ${SECRET}` },
            body: stream,
            duplex: 'half',
          } as NextInit)
        )
        expect(res.status).toBe(500)
        expect(await res.json()).toEqual({ success: false, error: 'Internal server error.' })
        expect(logged()).not.toContain('10.1.2.3')
      })
    })

    describe('the body shape', () => {
      it.each([
        ['malformed JSON', '{not json'],
        ['an empty body', ''],
        ['a JSON null', 'null'],
        ['a JSON array', '[]'],
        ['a JSON string', '"isaac-newton"'],
        ['a JSON number', '123'],
        ['a JSON boolean', 'true'],
        ['an object with no fields', '{}'],
      ])('is 400 for %s', async (_label, raw) => {
        const h = await boot()
        const res = await h.post(raw, { raw: true })
        expect(res.status).toBe(400)
        expect(h.db.historical).not.toHaveBeenCalled()
      })

      it('is 400, not 413, for a request that has no body at all', async () => {
        const h = await boot()
        const res = await h.route.POST(
          new NextRequest(URL_, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } })
        )
        expect(res.status).toBe(400)
        expect((await res.json()).error).toContain('agentId')
      })

      it.each([
        ['a number', 12],
        ['an array holding a valid id', ['isaac-newton']],
        ['an object', { id: 'isaac-newton' }],
        ['a boolean', true],
        ['null', null],
        ['an empty string', ''],
        ['a string that is not an id', '../x'],
      ])('is 400 for an agentId that is %s', async (_label, agentId) => {
        const h = await boot()
        const res = await h.post({ agentId, esmsBalances: holdings(1) })
        expect(res.status).toBe(400)
        expect((await res.json()).error).toContain('agentId')
        expect(h.db.historical).not.toHaveBeenCalled()
      })

      const DEFECTS: Array<[string, (token: string) => string]> = [
        ['negative', token => `"${token}":-0.1`],
        ['a string', token => `"${token}":"5"`],
        ['null', token => `"${token}":null`],
        ['a boolean', token => `"${token}":true`],
        ['an array', token => `"${token}":[1]`],
        ['an object', token => `"${token}":{"value":1}`],
        ['out of range (1e999)', token => `"${token}":1e999`],
        ['negative out of range (-1e999)', token => `"${token}":-1e999`],
        ['missing', () => ''],
      ]
      const withDefect = (token: string, defect: (t: string) => string) =>
        `{"agentId":"isaac-newton","esmsBalances":{${ESMS_TOKENS.map(t =>
          t === token ? defect(t) : `"${t}":1`
        )
          .filter(Boolean)
          .join(',')}}}`

      describe.each(ESMS_TOKENS)('a %s balance that is', token => {
        it.each(DEFECTS)('%s is 400', async (_label, defect) => {
          const h = await boot()
          const res = await h.post(withDefect(token, defect), { raw: true })
          expect(res.status).toBe(400)
          expect(await res.json()).toEqual({
            success: false,
            error:
              'esmsBalances must hold finite, non-negative spirit, essence, matter, substance.',
          })
          expect(h.db.historical).not.toHaveBeenCalled()
        })
      })

      it.each([
        ['no holdings', { agentId: 'isaac-newton' }],
        ['null holdings', { agentId: 'isaac-newton', esmsBalances: null }],
        ['a string for holdings', { agentId: 'isaac-newton', esmsBalances: '1,2,3,4' }],
        ['an array of four numbers', { agentId: 'isaac-newton', esmsBalances: [1, 2, 3, 4] }],
        ['a number for holdings', { agentId: 'isaac-newton', esmsBalances: 4 }],
      ])('is 400 for %s', async (_label, body) => {
        const h = await boot()
        expect((await h.post(body)).status).toBe(400)
      })

      it('checks the balances before it looks the agent up', async () => {
        const h = await boot()
        const res = await h.post({ agentId: 'nobody-here', esmsBalances: { spirit: -1 } })
        expect(res.status).toBe(400)
        expect(h.db.historical).not.toHaveBeenCalled()
      })

      it('accepts ZERO balances, and a zero of either sign', async () => {
        const h = await boot()
        const res = await h.post({ agentId: 'isaac-newton', esmsBalances: holdings(0) })
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.esmsSource).toBe('spacetimedb')
        expect(body.esmsBalances).toEqual(holdings(0))
        expect(body.seals.every((s: { tier: unknown }) => s.tier === null)).toBe(true)

        const negativeZero = await h.post(
          '{"agentId":"isaac-newton","esmsBalances":{"spirit":-0,"essence":0,"matter":0,"substance":0}}',
          { raw: true }
        )
        expect(negativeZero.status).toBe(200)
      })

      it('accepts any finite balance, however large', async () => {
        const h = await boot()
        const res = await h.post(
          '{"agentId":"isaac-newton","esmsBalances":{"spirit":1e308,"essence":1e15,"matter":0.0001,"substance":123456789.125}}',
          { raw: true }
        )
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.esmsBalances).toEqual({
          spirit: 1e308,
          essence: 1e15,
          matter: 0.0001,
          substance: 123456789.125,
        })
      })

      it('ignores fields it does not know', async () => {
        const h = await boot()
        const res = await h.post({
          ...valid,
          esmsBalances: { ...holdings(2), gold: 99 },
          note: 'x',
        })
        expect(res.status).toBe(200)
        expect((await res.json()).esmsBalances).toEqual(holdings(2))
      })
    })

    describe('what it answers for an agent', () => {
      it('is 404 for an unknown one', async () => {
        const h = await boot()
        const res = await h.post({ agentId: 'nobody-here', esmsBalances: holdings(1) })
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({
          success: false,
          error: 'No agent "nobody-here" to rate.',
        })
      })

      it.each([
        ['an empty natal chart and zero scores', {}],
        ['a null natal chart and zero scores', { natalChart: null }],
        ['a chart naming no bodies and zero scores', { natalChart: { planets: {} } }],
        ['out-of-range scores and no chart', { powerScore: 101 }],
        ['a negative score and no chart', { powerScore: -1, wisdomScore: 50 }],
        ['a non-numeric score and no chart', { powerScore: '80', wisdomScore: 50 }],
      ])('is 422 for a row with %s', async (_label, overrides) => {
        const world = defaultWorld()
        world.forged.push({ ...blankRow(), ...overrides })
        const h = await boot({ world })
        const res = await h.post({ agentId: 'blank', esmsBalances: holdings(1) })
        expect(res.status).toBe(422)
        expect(await res.json()).toEqual({
          success: false,
          error: 'Agent "blank" has no stats or natal chart to rate.',
        })
        // ...and a refused push is not remembered.
        expect((await h.get('?agentId=blank', bearer)).status).toBe(422)
      })

      it('is 503 when the lookup itself fails, and says nothing about why', async () => {
        const h = await boot()
        h.db.failures.lookup = new Error('connection to server at "10.0.0.5", port 5432 failed')
        const res = await h.post({ agentId: 'some-forged-agent', esmsBalances: holdings(1) })
        const text = await res.text()

        expect(res.status).toBe(503)
        expect(JSON.parse(text)).toEqual({
          success: false,
          error: 'Agent lookup is temporarily unavailable.',
        })
        expect(text).not.toContain('10.0.0.5')
        expect(logged()).not.toContain('10.0.0.5')
        expect(errorSpy).toHaveBeenCalledWith('[rating] agent lookup unavailable:', 'Error')
      })

      it('never reaches the database for a roster agent, so an outage there does not matter', async () => {
        const h = await boot()
        h.db.failures.lookup = new Error('db down')
        expect((await h.post(valid)).status).toBe(200)
      })
    })

    describe('what it does not do', () => {
      it('never writes the ledger: the only database access for a forged agent is reading the agent', async () => {
        const h = await boot()
        const res = await h.post({ agentId: FORGED, esmsBalances: PUSHED })
        expect(res.status).toBe(200)

        expect(h.db.violations).toEqual([])
        expect(h.db.historical).toHaveBeenCalledTimes(1)
        expect(h.db.wallet).not.toHaveBeenCalled() // the pushed holdings win; the ledger is not even read
        expect(h.db.users).not.toHaveBeenCalled()
        expect(h.db.created).not.toHaveBeenCalled()
      })

      it('touches no database at all for a roster agent', async () => {
        const h = await boot()
        expect((await h.post(valid)).status).toBe(200)
        expect(h.db.violations).toEqual([])
        for (const read of [h.db.historical, h.db.wallet, h.db.users, h.db.created]) {
          expect(read).not.toHaveBeenCalled()
        }
      })

      it('neither rate limits nor consults a session', async () => {
        const h = await boot()
        await h.post(valid)
        expect(h.rateCalls).toEqual([])
        expect(h.auth).not.toHaveBeenCalled()
      })
    })

    it('returns the same payload shape a GET serves', async () => {
      const h = await boot()
      const pushed = await (await h.post(valid)).json()
      const read = await (await h.get('?agentId=isaac-newton')).json()
      expect(Object.keys(pushed).sort()).toEqual(Object.keys(read).sort())
      expect(pushed).toEqual(read) // the push is what the next GET sees
      expect(pushed.seals.every((s: { balance: number }) => s.balance === 12)).toBe(true)
    })
  })

  // ─── (E) nothing internal leaks ────────────────────────────────────────────

  describe('error text', () => {
    it('keeps a lookup failure out of a GET 503, and out of the log, but logs its class and code', async () => {
      const h = await boot()
      h.db.failures.lookup = Object.assign(
        new Error('connection to server at "10.0.0.5", port 5432 failed'),
        {
          name: 'PrismaClientInitializationError',
          code: 'P1001',
        }
      )
      const res = await h.get('?agentId=some-forged-agent')
      const text = await res.text()

      expect(res.status).toBe(503)
      expect(JSON.parse(text)).toEqual({
        success: false,
        error: 'Agent lookup is temporarily unavailable.',
      })
      expect(text).not.toMatch(/10\.0\.0\.5|5432|P1001/)
      expect(errorSpy).toHaveBeenCalledWith(
        '[rating] agent lookup unavailable:',
        'PrismaClientInitializationError (P1001)'
      )
      expect(logged()).not.toMatch(/10\.0\.0\.5|5432/)
    })

    it('answers a ledger that throws with the fixed phrase "ledger unavailable" and the roster baseline', async () => {
      const h = await boot()
      h.db.failures.wallet = Object.assign(
        new Error(
          'Invalid `prisma.tokenBalance.findUnique()` invocation: relation "token_balances" does not exist'
        ),
        { name: 'PrismaClientKnownRequestError', code: 'P2021' }
      )
      const res = await h.get('?agentId=isaac-newton')
      const text = await res.text()
      const body = JSON.parse(text)
      const newton = HISTORICAL_AGENTS.find(a => a.id === 'isaac-newton')!

      expect(res.status).toBe(200)
      expect(body.esmsSource).toBe('fallback')
      expect(body.esmsBalances).toEqual(newton.consciousness.alchemicalElements)
      expect(body.degraded).toEqual({ esms: 'ledger unavailable' })
      expect(text).not.toMatch(/PrismaClientKnownRequestError|P2021|token_balances|findUnique/)
      // The operator still gets the class and code, and still not the message.
      expect(errorSpy).toHaveBeenCalledWith(
        '[rating] esms ledger fell through: PrismaClientKnownRequestError (P2021)'
      )
      expect(logged()).not.toMatch(/token_balances|findUnique/)
    })

    it('answers a ledger that cannot find the agentic user, or the creator, the same way', async () => {
      for (const failure of ['user', 'creator'] as const) {
        const h = await boot()
        h.db.failures[failure] = new Error('postgres://user:pw@db.internal/prod')
        const forged = failure === 'creator' ? FORGED : 'isaac-newton'
        const text = await (await h.get(`?agentId=${forged}`, bearer)).text()
        expect([failure, JSON.parse(text).degraded]).toEqual([
          failure,
          { esms: 'ledger unavailable' },
        ])
        expect(text).not.toContain('postgres')
        expect(logged()).not.toMatch(/postgres|pw@/)
      }
    })

    it('shows a generic sky failure as "live sky unavailable", and nothing of its text', async () => {
      const h = await boot()
      h.resolveSky.mockRejectedValue(
        new Error('fetch failed: https://internal.example/secret-path')
      )
      const res = await h.get('?agentId=isaac-newton')
      const text = await res.text()
      const body = JSON.parse(text)

      expect(res.status).toBe(200)
      expect(body.degraded).toEqual({ sky: 'live sky unavailable' })
      expect(body.surge).toBeNull()
      expect(body.sky).toBeNull()
      expect(text).not.toContain('internal.example')
      // The operator's log names the class of the failure, never what it said.
      expect(logged()).toBe(JSON.stringify([['[rating] live sky unavailable:', 'Error']]))
    })

    it('logs the cause of a sky failure by class name, and shows only the fixed text', async () => {
      const h = await boot()
      const cause = Object.assign(new TypeError('read /srv/app/secret.json failed'), {
        code: 'EACCES',
      })
      h.resolveSky.mockRejectedValue(
        new h.SkyUnavailableError('No sky could be computed', { cause })
      )
      const res = await h.get('?agentId=isaac-newton')
      const text = await res.text()

      expect(JSON.parse(text).degraded).toEqual({ sky: 'No sky could be computed' })
      expect(text).not.toContain('secret.json')
      expect(logged()).toBe(
        JSON.stringify([['[rating] live sky unavailable:', 'TypeError (EACCES)']])
      )
    })

    it('logs a sky failure that has no cause as its own class', async () => {
      const h = await boot()
      h.resolveSky.mockRejectedValue(new h.SkyUnavailableError('The sky is incomplete (Pluto)'))
      await h.get('?agentId=isaac-newton')
      expect(logged()).toBe(
        JSON.stringify([['[rating] live sky unavailable:', 'SkyUnavailableError']])
      )
    })

    it('shows a non-Error sky failure the same way', async () => {
      const h = await boot()
      h.resolveSky.mockRejectedValue('https://internal.example/secret-path')
      const body = await (await h.get('?agentId=isaac-newton')).json()
      expect(body.degraded).toEqual({ sky: 'live sky unavailable' })
    })

    it('does show the sky module’s own message, which it controls', async () => {
      const h = await boot()
      h.resolveSky.mockRejectedValue(new h.SkyUnavailableError('The sky is incomplete (Pluto)'))
      const body = await (await h.get('?agentId=isaac-newton')).json()
      expect(body.degraded).toEqual({ sky: 'The sky is incomplete (Pluto)' })
    })

    it('reports both degradations together, each in its own field', async () => {
      const h = await boot()
      h.resolveSky.mockRejectedValue(new Error('x'))
      const body = await (await h.get(`?agentId=${FORGED}`)).json()
      expect(body.degraded).toEqual({
        esms: 'owner wallet is private',
        sky: 'live sky unavailable',
      })
    })
  })

  // ─── (F) headers on every response class ───────────────────────────────────

  describe('headers', () => {
    const bad = async (h: Harness) => h.get('?agentId=../x')
    const blank = () => {
      const world = defaultWorld()
      world.forged.push(blankRow())
      return world
    }
    const failingResolver = (): ResolverStub =>
      vi.fn(async () => {
        throw new Error('boom')
      }) as unknown as ResolverStub

    const GETS: Array<[string, number, () => Promise<Response>]> = [
      ['GET 200 (roster)', 200, async () => (await boot()).get('?agentId=isaac-newton')],
      ['GET 200 (forged)', 200, async () => (await boot()).get(`?agentId=${FORGED}`)],
      [
        'GET 200 (forged, unlocked)',
        200,
        async () => (await boot()).get(`?agentId=${FORGED}`, bearer),
      ],
      ['GET 400', 400, async () => bad(await boot())],
      ['GET 404', 404, async () => (await boot()).get('?agentId=nobody-here')],
      ['GET 422', 422, async () => (await boot({ world: blank() })).get('?agentId=blank')],
      [
        'GET 429',
        429,
        async () => {
          vi.stubEnv('RATING_API_PER_CALLER_PER_MIN', '1')
          const h = await boot()
          await h.get('?agentId=isaac-newton')
          return h.get('?agentId=isaac-newton')
        },
      ],
      [
        'GET 429 (shared budget)',
        429,
        async () => {
          vi.stubEnv('RATING_API_GLOBAL_PER_MIN', '1')
          const h = await boot()
          await h.get('?agentId=isaac-newton')
          return h.get('?agentId=isaac-newton', { 'x-forwarded-for': '203.0.113.50' })
        },
      ],
      [
        'GET 500',
        500,
        async () => (await boot({ resolver: failingResolver() })).get('?agentId=isaac-newton'),
      ],
      [
        'GET 503',
        503,
        async () => {
          const h = await boot()
          h.db.failures.lookup = new Error('down')
          return h.get('?agentId=some-forged-agent')
        },
      ],
    ]

    it.each(GETS)('%s is no-store and readable cross-origin', async (_label, status, run) => {
      const res = await run()
      expect(res.status).toBe(status)
      expect(res.headers.get('cache-control')).toBe('no-store')
      for (const [name, value] of Object.entries(READ_CORS)) {
        expect([name, res.headers.get(name)]).toEqual([name, value])
      }
    })

    it('only ever caches the static roster listing', async () => {
      const res = await (await boot()).get('?roster=true')
      expect(res.headers.get('cache-control')).toBe('public, max-age=300')
    })

    it('answers the preflight with 204, the read-only CORS set and no Authorization allowance', async () => {
      const { route } = await boot()
      const res = await route.OPTIONS()
      expect(res.status).toBe(204)
      expect(await res.text()).toBe('')
      for (const [name, value] of Object.entries(READ_CORS)) {
        expect([name, res.headers.get(name)]).toEqual([name, value])
      }
      expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).not.toContain(
        'authorization'
      )
      expect(res.headers.get('access-control-allow-methods')).not.toContain('POST')
    })

    const POSTS: Array<[string, number, () => Promise<Response>]> = [
      ['POST 200', 200, async () => (await boot()).post(valid)],
      ['POST 400 (bad body)', 400, async () => (await boot()).post('{nope', { raw: true })],
      [
        'POST 400 (bad id)',
        400,
        async () => (await boot()).post({ agentId: '../x', esmsBalances: holdings(1) }),
      ],
      ['POST 401', 401, async () => (await boot()).post(valid, { auth: 'Bearer nope' })],
      [
        'POST 404',
        404,
        async () => (await boot()).post({ agentId: 'nobody-here', esmsBalances: holdings(1) }),
      ],
      [
        'POST 413',
        413,
        async () => (await boot()).post(valid, { headers: { 'content-length': '99999' } }),
      ],
      [
        'POST 413 (streamed)',
        413,
        async () =>
          (await boot()).route.POST(streamedPostReq(new Uint8Array(9000).fill(0x20)).request),
      ],
      [
        'POST 422',
        422,
        async () =>
          (await boot({ world: blank() })).post({ agentId: 'blank', esmsBalances: holdings(1) }),
      ],
      ['POST 500', 500, async () => (await boot({ resolver: failingResolver() })).post(valid)],
      [
        'POST 503 (not configured)',
        503,
        async () => {
          vi.stubEnv('INTERNAL_API_SECRET', undefined)
          return (await boot()).post(valid)
        },
      ],
      [
        'POST 503 (lookup)',
        503,
        async () => {
          const h = await boot()
          h.db.failures.lookup = new Error('down')
          return h.post({ agentId: 'some-forged-agent', esmsBalances: holdings(1) })
        },
      ],
    ]

    it.each(POSTS)('%s is no-store and carries no CORS headers', async (_label, status, run) => {
      const res = await run()
      expect(res.status).toBe(status)
      expect(res.headers.get('cache-control')).toBe('no-store')
      for (const name of CORS_NAMES) expect([name, res.headers.get(name)]).toEqual([name, null])
    })
  })

  // ─── (G) rate limits ───────────────────────────────────────────────────────

  describe('rate limits', () => {
    const keys = (h: Harness) => h.rateCalls.map(c => c.key)

    it('charges the caller, then the shared bucket, with the documented defaults', async () => {
      const h = await boot()
      await h.get('?agentId=isaac-newton', { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' })
      expect(h.rateCalls).toEqual([
        { key: 'rating:203.0.113.9', limit: 120, windowMs: 60_000 },
        { key: 'rating:global', limit: 1200, windowMs: 60_000 },
      ])
    })

    it.each([
      [{ 'x-real-ip': '198.51.100.7' }, 'rating:198.51.100.7'],
      [
        { 'x-forwarded-for': '  192.0.2.1 , 10.0.0.1', 'x-real-ip': '198.51.100.7' },
        'rating:192.0.2.1',
      ],
      [{}, 'rating:unknown'],
    ])('keys the caller bucket by the client address (%j)', async (headers, key) => {
      const h = await boot()
      await h.get('?agentId=isaac-newton', headers)
      expect(keys(h)[0]).toBe(key)
    })

    it('answers 429 with Retry-After: 60 once a caller is past the limit, and only that caller', async () => {
      vi.stubEnv('RATING_API_PER_CALLER_PER_MIN', '2')
      const h = await boot()
      const statuses: number[] = []
      for (let i = 0; i < 4; i++) statuses.push((await h.get('?agentId=isaac-newton')).status)
      expect(statuses).toEqual([200, 200, 429, 429])

      const limited = await h.get('?agentId=isaac-newton')
      expect(limited.headers.get('retry-after')).toBe('60')
      expect(await limited.json()).toEqual({ success: false, error: 'Too Many Requests' })

      const other = await h.get('?agentId=isaac-newton', { 'x-forwarded-for': '203.0.113.77' })
      expect(other.status).toBe(200)
      expect(other.headers.get('retry-after')).toBeNull()
    })

    it('does not charge the shared bucket for a caller who is already limited', async () => {
      vi.stubEnv('RATING_API_PER_CALLER_PER_MIN', '1')
      const h = await boot()
      await h.get('?agentId=isaac-newton')
      const before = keys(h).filter(k => k === 'rating:global').length
      const limited = await h.get('?agentId=isaac-newton')

      expect(limited.status).toBe(429)
      expect(keys(h).filter(k => k === 'rating:global').length).toBe(before)
      expect(h.resolveSky).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['a malformed id', '?agentId=../x'],
      ['a missing id', ''],
      ['an encoded NUL', '?agentId=%00'],
      ['a prototype key', '?agentId=__proto__'],
      ['the roster listing', '?roster=true'],
    ])(
      'does not charge the shared bucket for %s, though the caller pays',
      async (_label, query) => {
        const h = await boot()
        await h.get(query, { 'x-forwarded-for': '203.0.113.9' })
        expect(keys(h)).toEqual(['rating:203.0.113.9'])
      }
    )

    it.each([
      ['a rated vessel', '?agentId=isaac-newton'],
      ['an unknown agent', '?agentId=nobody-here'],
      ['a prototype name', '?agentId=constructor'],
    ])('does charge the shared bucket for %s', async (_label, query) => {
      const h = await boot()
      await h.get(query, { 'x-forwarded-for': '203.0.113.9' })
      expect(keys(h)).toEqual(['rating:203.0.113.9', 'rating:global'])
    })

    it('charges the shared bucket for a lookup that fails, and for one with nothing to rate', async () => {
      const world = defaultWorld()
      world.forged.push(blankRow())
      const h = await boot({ world })
      await h.get('?agentId=blank')
      h.db.failures.lookup = new Error('down')
      await h.get('?agentId=some-forged-agent')
      expect(keys(h).filter(k => k === 'rating:global')).toHaveLength(2)
    })

    it('limits the whole route to a shared budget, which the roster listing and a bad id do not need', async () => {
      vi.stubEnv('RATING_API_GLOBAL_PER_MIN', '2')
      const h = await boot()
      const lookup = (n: number) =>
        h.get('?agentId=isaac-newton', { 'x-forwarded-for': `203.0.113.${n}` })
      expect([(await lookup(1)).status, (await lookup(2)).status]).toEqual([200, 200])

      const spent = await lookup(3)
      expect(spent.status).toBe(429)
      expect(spent.headers.get('retry-after')).toBe('60')
      expect(await spent.json()).toEqual({ success: false, error: 'Too Many Requests' })

      expect((await h.get('?roster=true', { 'x-forwarded-for': '203.0.113.4' })).status).toBe(200)
      expect((await h.get('?agentId=../x', { 'x-forwarded-for': '203.0.113.5' })).status).toBe(400)
    })

    it('counts the roster listing against the caller’s own budget', async () => {
      vi.stubEnv('RATING_API_PER_CALLER_PER_MIN', '2')
      const h = await boot()
      const statuses: number[] = []
      for (let i = 0; i < 3; i++) statuses.push((await h.get('?roster=true')).status)
      expect(statuses).toEqual([200, 200, 429])
    })

    it('forgets the window after a minute', async () => {
      vi.stubEnv('RATING_API_PER_CALLER_PER_MIN', '1')
      const h = await boot()
      vi.useFakeTimers()
      advanceTo(0)
      expect((await h.get('?agentId=isaac-newton')).status).toBe(200)
      expect((await h.get('?agentId=isaac-newton')).status).toBe(429)
      advanceTo(TTL + 1)
      expect((await h.get('?agentId=isaac-newton')).status).toBe(200)
    })

    it.each([
      ['5', 5],
      [' 7', 7],
      ['3.9', 3],
      ['1', 1],
      ['abc', null],
      ['', null],
      ['0', null],
      ['-3', null],
      ['NaN', null],
    ])('reads RATING_API_PER_CALLER_PER_MIN=%j as %s', async (value, expected) => {
      vi.stubEnv('RATING_API_PER_CALLER_PER_MIN', value)
      const h = await boot()
      await h.get('?agentId=isaac-newton')
      expect(h.rateCalls[0].limit).toBe(expected ?? 120)
      expect(h.rateCalls[1].limit).toBe(1200) // the other knob is unaffected
    })

    it.each([
      ['9', 9],
      ['100000', 100000],
      ['0', null],
      ['-1', null],
      ['lots', null],
    ])('reads RATING_API_GLOBAL_PER_MIN=%j as %s', async (value, expected) => {
      vi.stubEnv('RATING_API_GLOBAL_PER_MIN', value)
      const h = await boot()
      await h.get('?agentId=isaac-newton')
      expect(h.rateCalls[0].limit).toBe(120)
      expect(h.rateCalls[1].limit).toBe(expected ?? 1200)
    })
  })

  // ─── (H) a vessel as the forge writes it ───────────────────────────────────

  describe('a forged vessel with the forge’s own natal chart', () => {
    const forgeChart = () =>
      JSON.parse(
        JSON.stringify(
          generateAccurateHoroscope({
            year: 1991,
            month: 5,
            day: 14,
            hour: 9,
            minute: 30,
            latitude: 40.7,
            longitude: -74,
          })
        )
      )
    const zeroColumns = ZERO_SCORES
    const worldWith = (row: Row): World => {
      const world = defaultWorld()
      world.forged = [row]
      return world
    }

    it.each([
      ['with the secret', bearer],
      ['anonymously', undefined],
    ])(
      'is rated from the chart alone when every score column is zero (%s)',
      async (_label, headers) => {
        const chart = forgeChart()
        expect(chart.tropical).toBeDefined() // the shape under test is the persisted one, not the roster's
        const h = await boot({
          world: worldWith(forgedRow(FORGED, { natalChart: chart, ...zeroColumns })),
        })
        const res = await h.get(`?agentId=${FORGED}`, headers)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(Object.keys(body.ratings).sort()).toEqual([...CORE_STAT_KEYS].sort())
        for (const key of CORE_STAT_KEYS) {
          expect(Number.isFinite(body.ratings[key])).toBe(true)
          expect(body.ratings[key]).toBeGreaterThanOrEqual(25)
          expect(body.ratings[key]).toBeLessThanOrEqual(99)
        }
        expect(Number.isFinite(body.ovr)).toBe(true)
        expect(body.appearance).toMatchObject({ agentId: FORGED, era: 'astral' })
        expect(body.seals).toHaveLength(7)
        expect(body.zoneSynergies).toHaveLength(11)
        expect(JSON.stringify(body)).not.toMatch(/NaN|Infinity/)
      }
    )

    it('rates the same chart identically in the forge’s shape and in the roster’s, ascendant included', async () => {
      const chart = forgeChart()
      const planets: Record<string, { sign: string; degree: number }> = {}
      for (const body of chart.tropical.CelestialBodies.all) {
        planets[body.label] = { sign: body.Sign.label, degree: body.degrees }
      }
      // The ecliptic longitude of the rising degree: its sign's start plus the degrees within it.
      const ascendant =
        (ZODIAC_SIGNS as readonly string[]).indexOf(chart.tropical.Ascendant.Sign.label) * 30 +
        chart.tropical.Ascendant.degrees
      const rate = async (natalChart: unknown) => {
        const h = await boot({
          world: worldWith(forgedRow(FORGED, { natalChart, ...zeroColumns })),
        })
        return (await h.get(`?agentId=${FORGED}`)).json()
      }
      const forgeShaped = await rate(chart)
      const rosterShaped = await rate({ planets, ascendant })
      const withoutAscendant = await rate({ planets })

      expect(forgeShaped.ratings).toEqual(rosterShaped.ratings)
      expect(forgeShaped.ovr).toBe(rosterShaped.ovr)
      expect(forgeShaped.seals).toEqual(rosterShaped.seals)
      // The ascendant is part of the rating, so dropping it changes the result.
      expect(withoutAscendant.ratings).not.toEqual(forgeShaped.ratings)
      expect(
        forgeShaped.seals.some((s: { natalAffinity: number | null }) => s.natalAffinity !== null)
      ).toBe(true)
    })

    it('uses persisted Sacred 7 scores when they are there', async () => {
      const h = await boot({
        world: worldWith(
          forgedRow(FORGED, { natalChart: forgeChart(), powerScore: 40, charismaScore: 90 })
        ),
      })
      const body = await (await h.get(`?agentId=${FORGED}`)).json()
      expect(body.ratings.charisma).toBeGreaterThan(body.ratings.power)
    })

    it.each([
      ['an empty natal chart', { natalChart: {} }],
      ['a null natal chart', { natalChart: null }],
      [
        'a chart that names no body',
        { natalChart: { tropical: { CelestialBodies: { all: [] } } } },
      ],
    ])('is 422 with %s and zero score columns', async (_label, overrides) => {
      const h = await boot({
        world: worldWith(forgedRow('blank', { ...zeroColumns, ...overrides })),
      })
      const res = await h.get('?agentId=blank', bearer)
      expect(res.status).toBe(422)
      expect(await res.json()).toEqual({
        success: false,
        error: 'Agent "blank" has no stats or natal chart to rate.',
      })
    })

    it('reads the row by its exact id and nothing else about the request', async () => {
      const h = await boot()
      await h.get(`?agentId=${FORGED}`)
      expect(h.db.historical).toHaveBeenCalledTimes(1)
      expect(h.db.historical).toHaveBeenCalledWith({ where: { agentId: FORGED } })
    })
  })
})
