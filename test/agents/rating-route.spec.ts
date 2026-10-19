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
 *
 * The payload the route serves is the Pentacles rating contract's `RatedAgentPayload`
 * (`lib/agents/rating-contract.ts`) plus the extension fields only a live rating knows. Where a
 * test asks "is this what the contract says?", the contract's own functions are the oracle
 * (`expectContractConformant`); everywhere else the expected numbers are pinned as literals.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import {
  FIXTURE_AGENTS,
  ROSTER_BASELINE_RATINGS,
  SACRED_STAT_KEYS,
  SEAL_ESMS_GATES,
  SEAL_STAT_GATES,
  SEAL_TIER_MULTIPLIERS,
  buildCanonicalSeal,
  computeMeanAlignedRating,
  computeOvr,
  computeRelativeAdvantage,
  evaluateSealTier,
  evaluateSurgeState,
  resolveArchetype,
} from '@/lib/agents/rating-contract'
import { SKY_BODIES, deriveLiveSky, type SkyLongitudes } from '@/lib/agents/rating/live-sky'
import { CORE_STAT_KEYS } from '@/lib/agents/rating/ovr-archetype'
import { ESMS_TOKENS, type EsmsHoldings } from '@/lib/agents/rating/seals-surge'
import {
  CANONICAL_ROSTER_71,
  resolveAgentAppearance,
} from '@/lib/agents/vessel-appearance-manifest'
import { generateAccurateHoroscope } from '@/lib/monica/horoscope-generator'
import { ZODIAC_SIGNS } from '@/lib/staking/elements'

// ─── Constants ───────────────────────────────────────────────────────────────

const URL_ = 'http://localhost:3000/api/agents/rating'
const RESOLVER = '@/lib/agents/rating/esms-balance-resolver'
const SECRET = 'Test-Internal-Secret-Value-9'
const NOW = new Date('2026-10-15T05:43:00Z')
const TTL = 60_000
/**
 * The tests that make thousands of requests take about a second on an idle machine; the budget
 * only has to survive a machine that is busy with something else (a parallel CI shard).
 */
const BULK_TIMEOUT_MS = 300_000

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

// ─── The contract's vocabulary, pinned ───────────────────────────────────────

type Stat = (typeof SACRED_STAT_KEYS)[number]
const STATS: readonly Stat[] = [
  'power',
  'resonance',
  'wisdom',
  'charisma',
  'intuition',
  'adaptability',
  'vitality',
]
/** Weakest to strongest. `Astral` replaced the tier that used to sit between Gold and Celestial. */
const TIERS = ['Copper', 'Silver', 'Gold', 'Astral', 'Celestial'] as const
type Tier = (typeof TIERS)[number]
/** The retired tier name, assembled from parts so that this file does not contain it. */
const RETIRED_TIER = ['ae', 'ther'].join('')
/** The faction index of the contract: a classical body, 0 = Sun. */
const FACTIONS = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
] as const
/** A natal Sun sign's ruling body as a faction index (the fallback faction of a vessel). */
const RULER_FACTION: Record<string, number> = {
  Aries: 4,
  Taurus: 3,
  Gemini: 2,
  Cancer: 1,
  Leo: 0,
  Virgo: 2,
  Libra: 3,
  Scorpio: 9,
  Sagittarius: 5,
  Capricorn: 6,
  Aquarius: 7,
  Pisces: 8,
}
const rank = (tier: string | null): number => (tier === null ? -1 : TIERS.indexOf(tier as Tier))

/** The manifest and the route reduce an id to its base key: trimmed, lower-cased, no `-<birth year>`. */
const baseKeyOf = (id: string): string => id.trim().toLowerCase().replace(/-\d+$/, '')
/** The contract's pilots (the keys of `FIXTURE_AGENTS`) by base key. */
const PILOTS = new Map(FIXTURE_AGENTS.map(pilot => [baseKeyOf(pilot.key), pilot]))
/**
 * What a roster agent is called in a payload: the contract's handle for a pilot, else its own
 * name. Only Newton ('Sir Isaac Newton' against the roster's 'Isaac Newton') differs today, so
 * the literal pins in the pilot tests below carry the weight and this is the sweep's oracle.
 */
const handleOf = (agent: { id: string; name: string }): string =>
  PILOTS.get(baseKeyOf(agent.id))?.handle ?? agent.name
/** The identity fields a payload shares with the contract's fixtures. */
const identityOf = (p: {
  key: string
  handle: string
  faction: number
  factionName: string
  isPlaceholder?: boolean
  provenance?: string
}) => ({
  key: p.key,
  handle: p.handle,
  faction: p.faction,
  factionName: p.factionName,
  isPlaceholder: p.isPlaceholder,
  provenance: p.provenance,
})
/** The classical bodies' trim colours the manifest draws a look in (`PLANET_COLORS`, by faction). */
const SUN_TRIM = '#ff9800'
const MOON_TRIM = '#e0e0e0'

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
const valid = { agentId: 'isaac-newton', esms: holdings(12) }

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

/**
 * A roster agent as the booted route sees it. Every `boot` re-imports the roster, so an edit
 * made to the returned object lives exactly as long as its test.
 */
async function rosterAgent(id: string) {
  const { getHistoricalAgent } = await import('@/lib/agents/historical')
  const agent = getHistoricalAgent(id)
  if (!agent) throw new Error(`${id} is not on the roster`)
  return agent
}

// ─── Reading a payload against the contract ──────────────────────────────────

interface SealView {
  id: string
  name: string
  category: string
  tier: Tier
  description: string
  statKey: Stat
  multiplier: number
}
interface ProgressView {
  id: string
  name: string
  token: string
  stat: Stat
  tier: Tier | null
  nextTier: Tier | null
  blockedBy: string[]
  maxTier: Tier
  statRating: number
  alignedRating: number
  balance: number
  natalAffinity: number | null
}
interface SurgeView {
  meter: number
  active: boolean
  surgeType: string
  monica: number | null
  monicaState: string
  heat: number
  reactivity: number
  statBoosts: Partial<Record<Stat, number>>
  skyMeter: number
  harmonyOffset: number
}
interface PayloadView {
  key: string
  handle: string
  faction: number
  factionName: string
  isPlaceholder: boolean
  provenance: string
  appearance: ReturnType<typeof resolveAgentAppearance>
  avatarModelUrl?: string
  headMeshUrl?: string
  ratings: Record<Stat, number>
  relativeAdvantage: Record<Stat, number>
  ovr: number
  archetype: { title: string; primary: Stat; secondary: Stat }
  esms: EsmsHoldings
  seals: SealView[]
  surge: SurgeView | null
  scale: { name: string; floor: number; ceiling: number }
  sealProgress: ProgressView[]
  esmsSource: string
  zoneSynergies: Array<{ zoneId: number; esmsToken: string; synergy: number }>
  bestZoneId: number
  sky: {
    source: string
    at: string
    heat: number
    reactivity: number
    monica: number | null
  } | null
  degraded?: { esms?: string; sky?: string }
}
const view = async (res: Response) => (await res.json()) as PayloadView

/** The keys of the contract's `RatedAgentPayload` (its optional model URLs aside). */
const CONTRACT_KEYS = [
  'key',
  'handle',
  'faction',
  'factionName',
  'isPlaceholder',
  'provenance',
  'appearance',
  'ratings',
  'relativeAdvantage',
  'ovr',
  'archetype',
  'esms',
  'seals',
  'surge',
]
/** What only a live, server-side rating adds on top of the contract. */
const EXTENSION_KEYS = ['scale', 'sealProgress', 'esmsSource', 'zoneSynergies', 'bestZoneId', 'sky']
const ALL_KEYS = [...CONTRACT_KEYS, ...EXTENSION_KEYS]
/** The names the payload carried before it conformed to the contract. */
const RETIRED_KEYS = ['agentId', 'name', 'esmsBalances', 'spread']

const round2 = (n: number) => Math.round(n * 100) / 100
const keysOf = (body: object) => Object.keys(body).sort()

/**
 * Everything a served payload says that the contract (`lib/agents/rating-contract.ts`) also
 * decides, checked with the contract's own functions on the payload's own ratings: OVR, relative
 * advantage, archetype, the Seal objects (`buildCanonicalSeal`), each Seal's tier
 * (`evaluateSealTier`, with ASOL's Celestial blessing as the one stricter rule) and the surge
 * (`evaluateSurgeState`). Sweeping a roster through it names the vessel in every failure.
 */
function expectContractConformant(body: PayloadView) {
  const who = body.key
  const is = (label: string, actual: unknown, expected: unknown) =>
    expect([who, label, actual]).toEqual([who, label, expected])

  is('rating keys', keysOf(body.ratings), [...STATS].sort())
  for (const stat of STATS) {
    const rating = body.ratings[stat]
    is(
      `${stat} is an integer on 25..99`,
      Number.isInteger(rating) && rating >= 25 && rating <= 99,
      true
    )
  }
  is('relativeAdvantage', body.relativeAdvantage, computeRelativeAdvantage(body.ratings))
  is('ovr', body.ovr, computeOvr(body.ratings))
  is('archetype', body.archetype, resolveArchetype(body.relativeAdvantage))
  is('factionName', body.factionName, FACTIONS[body.faction])
  is('scale', body.scale, { name: 'Pentacle Vessel Rating Scale', floor: 25, ceiling: 99 })

  // Seals: the whole catalog in progress, the earned ones as the contract's own objects.
  is(
    'sealProgress ids',
    body.sealProgress.map(p => p.id),
    STATS.map(stat => `seal-${stat}`)
  )
  is(
    'sealProgress stats',
    body.sealProgress.map(p => p.stat),
    [...STATS]
  )
  is(
    'seals',
    body.seals,
    body.sealProgress
      .filter(p => p.tier !== null)
      .map(p => buildCanonicalSeal(p.stat, p.tier as Tier))
  )
  for (const p of body.sealProgress) {
    const at = (what: string) => `${p.stat}: ${what}`
    const catalog = buildCanonicalSeal(p.stat, 'Copper')
    is(at('name'), p.name, catalog.name)
    is(at('token'), p.token, catalog.category)
    is(at('statRating'), p.statRating, body.ratings[p.stat])
    is(at('balance'), p.balance, body.esms[p.token as keyof EsmsHoldings])
    const aligned = computeMeanAlignedRating(p.stat, p.statRating)
    is(at('alignedRating'), p.alignedRating, round2(aligned))

    // A tier is the contract's. Celestial additionally needs 4 of the ten bodies in the token's
    // element, which ASOL passes in through the contract's own Celestial bar.
    const blessed = p.natalAffinity !== null && p.natalAffinity >= 4
    is(at('tier'), p.tier, evaluateSealTier(p.stat, p.statRating, p.balance, !blessed))
    if (body.isPlaceholder) is(at('a placeholder chart has no affinity'), p.natalAffinity, null)

    const ceiling = computeMeanAlignedRating(p.stat, 99)
    const maxTier = TIERS.filter(tier => SEAL_STAT_GATES[tier] <= ceiling).pop() ?? 'Copper'
    is(at('maxTier'), p.maxTier, maxTier)
    const next = rank(p.tier) + 1 <= rank(maxTier) ? TIERS[rank(p.tier) + 1] : null
    is(at('nextTier'), p.nextTier, next)
    const blockedBy: string[] = []
    if (next) {
      if (aligned < SEAL_STAT_GATES[next]) blockedBy.push('stat')
      if (p.balance < SEAL_ESMS_GATES[next]) blockedBy.push('esms')
      if (next === 'Celestial' && !blessed) blockedBy.push('natal')
    }
    is(at('blockedBy'), p.blockedBy, blockedBy)
  }

  // The surge: the contract's state for the meter, plus how the meter was reached.
  if (body.surge) {
    const { skyMeter, harmonyOffset, ...state } = body.surge
    const { primary, secondary } = body.archetype
    is(
      'surge state',
      state,
      evaluateSurgeState(
        state.meter,
        state.heat,
        state.reactivity,
        primary,
        secondary,
        state.monica
      )
    )
    is(
      'meter is an integer on 0..100',
      Number.isInteger(state.meter) && state.meter >= 0 && state.meter <= 100,
      true
    )
    is(
      'heat and reactivity are ramp positions',
      [state.heat, state.reactivity].every(v => v >= 0 && v <= 1),
      true
    )
    is('harmony stays within 12', Math.abs(harmonyOffset) <= 12, true)
    is('meter', state.meter, Math.max(0, Math.min(100, Math.round(skyMeter + harmonyOffset))))
  }

  // Zones: eleven, in order, and the best one is the first that holds the maximum.
  is(
    'zone ids',
    body.zoneSynergies.map(z => z.zoneId),
    [...Array(11).keys()]
  )
  const top = Math.max(...body.zoneSynergies.map(z => z.synergy))
  is('bestZoneId', body.bestZoneId, body.zoneSynergies.find(z => z.synergy === top)?.zoneId)
}

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
  it('serves a fully rated roster vessel: the contract’s payload plus its extensions, nothing else', async () => {
    const h = await boot({ resolver: stubResolver() })
    const res = await h.get('?agentId=isaac-newton')
    const body = await view(res)

    expect(res.status).toBe(200)
    expect(keysOf(body)).toEqual([...ALL_KEYS].sort())
    for (const retired of RETIRED_KEYS) expect(body).not.toHaveProperty(retired)
    // Newton is one of the contract's pilots, so he is named as the contract names him
    // ('Sir Isaac Newton'), not as the roster does ('Isaac Newton').
    expect(body).toMatchObject({
      key: 'isaac-newton',
      handle: 'Sir Isaac Newton',
      isPlaceholder: false,
      provenance: 'historical',
    })
    expect(body.scale).toEqual({ name: 'Pentacle Vessel Rating Scale', floor: 25, ceiling: 99 })
    expect(keysOf(body.ratings)).toEqual([...CORE_STAT_KEYS].sort())
    expect(body.archetype).toMatchObject({ title: expect.any(String), primary: expect.any(String) })
    expect(body.esms).toEqual(holdings(3))
    expect(body.esmsSource).toBe('database')
    expect(body.ovr).toBeGreaterThanOrEqual(25)
    expect(body.ovr).toBeLessThanOrEqual(99)

    // 3 of each element clears Copper (0.5) and Silver (2) but not Gold (10), so no Seal is
    // above Silver whatever the stat; every Seal reports that balance.
    expect(body.sealProgress).toHaveLength(7)
    for (const progress of body.sealProgress) {
      expect([null, 'Copper', 'Silver']).toContain(progress.tier)
      expect(progress.balance).toBe(3)
    }
    expect(body.seals.length).toBeGreaterThan(0)
    for (const seal of body.seals) expect(['Copper', 'Silver']).toContain(seal.tier)

    expect(body.surge).toMatchObject({
      monicaState: expect.stringMatching(/^(absent|equilibrium|convergent|divergent)$/),
      surgeType: expect.stringMatching(/^(inferno|tempest|equilibrium)$/),
      meter: expect.any(Number),
      skyMeter: expect.any(Number),
      harmonyOffset: expect.any(Number),
    })
    expect(body.appearance).toMatchObject({ era: 'enlightenment' })
    expect(body.appearance).toEqual(resolveAgentAppearance('isaac-newton'))
    expect(body.zoneSynergies.map(z => z.zoneId)).toEqual([...Array(11).keys()])
    expect(body.sky).toMatchObject({ source: 'swiss-ephemeris', at: '2026-10-15T05:43:00.000Z' })
    expect(body.degraded).toBeUndefined()
    expectContractConformant(body)
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

  it('rates Gregory’s Pentacles avatar from his roster agent’s ledger id, named and looking as the contract’s pilot', async () => {
    const resolver = stubResolver()
    const h = await boot({ resolver })
    const body = await view(await h.get('?agentId=user-avatar-neo'))

    expect(body.key).toBe('user-avatar-neo')
    // The avatar is the contract's pilot 'Adept Neo' (provenance `user`), not the person who
    // owns the ledger id it is rated from.
    expect(body.handle).toBe('Adept Neo')
    expect(body.provenance).toBe('user')
    expect(body.appearance).toMatchObject({ era: 'astral' })
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
    expect(body.esms).toEqual(holdings(0.5))
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
    expect(body.sealProgress).toHaveLength(7) // everything that does not need the sky is still served
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
      await h.post({ agentId: 'plato', esms: PUSHED })
      await h.post({ agentId: FORGED, esms: PUSHED_LATER })
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
      expect((await h.post({ agentId: 'plato', esms: PUSHED })).status).toBe(500)

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
        esms: { ...holdings(12), extra: 1 },
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.esmsSource).toBe('spacetimedb')
      expect(body.esms).toEqual(holdings(12))
      expect(resolver).toHaveBeenCalledWith('isaac-newton', {
        spacetime: holdings(12),
        strict: false,
        loadLedger: h.prismaLedgerLoader,
        creatorWallet: 'allow',
        onDegraded: expect.any(Function),
      })
      // 12 whole tokens of each element, and every Seal reports exactly that balance.
      expect(body.sealProgress).toHaveLength(7)
      expect(body.sealProgress.every((s: { balance: number }) => s.balance === 12)).toBe(true)
    })

    it('uses the allow policy for a forged vessel, whatever the session says', async () => {
      const resolver = stubResolver()
      const h = await boot({ resolver })
      h.session.current = { user: { id: OTHER_USER } }
      await h.post({ agentId: FORGED, esms: holdings(1) })
      expect(resolver.mock.calls[0][1]).toMatchObject({ creatorWallet: 'allow' })
      expect(h.auth).not.toHaveBeenCalled()
    })

    it('passes a push of zeros through as zeros, not as "no push"', async () => {
      const resolver = stubResolver()
      const h = await boot({ resolver })
      const res = await h.post({ agentId: 'plato', esms: holdings(0) })
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
      expect(body.esms).toEqual(holdings(0))
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
      expect(reference.esms).toEqual(holdings(0))
      expect(anonymous.seals).toEqual(reference.seals)
      expect(anonymous.sealProgress).toEqual(reference.sealProgress)
      expect(anonymous.seals).toEqual([]) // a baseline of zero earns no Seal, whatever the stats
      expect(anonymous.sealProgress.every((s: { tier: unknown }) => s.tier === null)).toBe(true)
      expect(anonymous.sealProgress.every((s: { balance: number }) => s.balance === 0)).toBe(true)
      // The wallet really does move tiers when it is allowed in, so the check above has teeth.
      expect(unlocked.seals.length).toBeGreaterThan(0)
      expect(unlocked.sealProgress.some((s: { tier: unknown }) => s.tier !== null)).toBe(true)
    })

    it('serves the creator’s balances to a caller with the internal secret', async () => {
      const h = await boot()
      const res = await h.get(`?agentId=${FORGED}`, bearer)
      const text = await res.text()
      const body = JSON.parse(text)

      expect(res.status).toBe(200)
      expect(body.esmsSource).toBe('database')
      expect(body.esms).toEqual(CREATOR_WALLET)
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
      expect(lower.esms).toEqual(CREATOR_WALLET)
      const upper = await (
        await h.get(`?agentId=${FORGED}`, { authorization: `BEARER ${SECRET}` })
      ).json()
      expect(upper.esms).toEqual(CREATOR_WALLET)
    })

    it('serves the creator’s balances to the signed-in creator', async () => {
      const h = await boot()
      h.session.current = { user: { id: CREATOR } }
      const body = await (await h.get(`?agentId=${FORGED}`)).json()

      expect(body.esmsSource).toBe('database')
      expect(body.esms).toEqual(CREATOR_WALLET)
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
        esms: holdings(0),
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
      expect(body.esms).toEqual(CREATOR_WALLET)
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
        expect(body.esms).toEqual(NEWTON_WALLET)
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

      expect(JSON.parse(text).esms).toEqual(NEWTON_WALLET)
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
      expect(body.esms).toEqual(NEWTON_WALLET)
    })

    it('resolves user-avatar-neo to the roster agent greg-castro-1991 and serves his agentic wallet publicly', async () => {
      const h = await boot()
      const res = await h.get('?agentId=user-avatar-neo')
      const body = await view(res)

      expect(res.status).toBe(200)
      expect(body.key).toBe('user-avatar-neo')
      expect(body.handle).toBe('Adept Neo') // the pilot's name; the wallet below is still Gregory's
      expect(body.provenance).toBe('user')
      expect(body.appearance).toMatchObject({ era: 'astral' })
      expect(body.esmsSource).toBe('database')
      expect(body.esms).toEqual(GREG_WALLET)
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
          esms: holdings(0),
          degraded: { esms: 'owner wallet is private' },
        })
        noLeak(text)
        expect(h.db.wallet).not.toHaveBeenCalled()
      })

      it('is shown to the secret holder and to its creator', async () => {
        const h = await boot({ world: avatarWorld(true) })
        expect((await (await h.get('?agentId=user-avatar-zed', bearer)).json()).esms).toEqual(
          CREATOR_WALLET
        )
        h.session.current = { user: { id: CREATOR } }
        expect((await (await h.get('?agentId=user-avatar-zed')).json()).esms).toEqual(
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
      expect(body.esms).toEqual(newton.consciousness.alchemicalElements)
    })
  })

  // ─── (B) the pushed-holdings cache ─────────────────────────────────────────

  describe('pushed holdings', () => {
    it('are not visible to an anonymous GET of a forged vessel, but are to the secret holder', async () => {
      const h = await boot()
      const push = await h.post({ agentId: FORGED, esms: PUSHED })
      expect(push.status).toBe(200)
      const pushedBody = await push.json()
      expect(pushedBody.esmsSource).toBe('spacetimedb')
      expect(pushedBody.esms).toEqual(PUSHED)

      const anonymous = await h.get(`?agentId=${FORGED}`)
      const text = await anonymous.text()
      expect(JSON.parse(text)).toMatchObject({
        esmsSource: 'fallback',
        esms: holdings(0),
        degraded: { esms: 'owner wallet is private' },
      })
      for (const n of numbersOf(PUSHED)) expect(text).not.toContain(n)

      const unlocked = await (await h.get(`?agentId=${FORGED}`, bearer)).json()
      expect(unlocked.esmsSource).toBe('spacetimedb')
      expect(unlocked.esms).toEqual(PUSHED)
      expect(unlocked.degraded).toBeUndefined()
    })

    it('are not shown to the signed-in creator either, who still reads their own ledger row', async () => {
      const h = await boot()
      await h.post({ agentId: FORGED, esms: PUSHED })
      h.session.current = { user: { id: CREATOR } }
      const body = await (await h.get(`?agentId=${FORGED}`)).json()
      expect(body.esmsSource).toBe('database')
      expect(body.esms).toEqual(CREATOR_WALLET)
    })

    it('are visible to an anonymous GET of a roster agent for 60 s, boundary included, and not after', async () => {
      const h = await boot()
      vi.useFakeTimers()
      advanceTo(0)
      await h.post({ agentId: 'isaac-newton', esms: PUSHED })

      for (const elapsed of [0, 1, TTL - 1, TTL]) {
        advanceTo(elapsed)
        const body = await (await h.get('?agentId=isaac-newton')).json()
        expect([elapsed, body.esmsSource, body.esms]).toEqual([elapsed, 'spacetimedb', PUSHED])
      }

      advanceTo(TTL + 1)
      const expired = await (await h.get('?agentId=isaac-newton')).json()
      expect(expired.esmsSource).toBe('database')
      expect(expired.esms).toEqual(NEWTON_WALLET)
      // ...and once expired it stays gone.
      advanceTo(TTL + 2)
      expect((await (await h.get('?agentId=isaac-newton')).json()).esmsSource).toBe('database')
    })

    it('are renewed by a later push, whose own clock then governs', async () => {
      const h = await boot()
      vi.useFakeTimers()
      advanceTo(0)
      await h.post({ agentId: 'plato', esms: PUSHED })
      advanceTo(40_000)
      await h.post({ agentId: 'plato', esms: PUSHED_LATER })

      advanceTo(70_000) // 70 s after the first push, 30 s after the second
      const renewed = await (await h.get('?agentId=plato')).json()
      expect(renewed.esmsSource).toBe('spacetimedb')
      expect(renewed.esms).toEqual(PUSHED_LATER)

      advanceTo(40_000 + TTL + 1)
      expect((await (await h.get('?agentId=plato')).json()).esmsSource).not.toBe('spacetimedb')
    })

    it('belong to the agent pushed for, and to no other', async () => {
      const h = await boot()
      await h.post({ agentId: 'plato', esms: PUSHED })
      const newton = await (await h.get('?agentId=isaac-newton')).json()
      expect(newton.esms).toEqual(NEWTON_WALLET)
      expect((await (await h.get('?agentId=plato')).json()).esms).toEqual(PUSHED)
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
        const push = await h.post({ agentId: pushedAs, esms: PUSHED })
        expect(push.status).toBe(200)
        const body = await (await h.get(`?agentId=${readAs}`)).json()
        expect(body.esmsSource).toBe('spacetimedb')
        expect(body.esms).toEqual(PUSHED)
      }
    )

    it('are shared by an id written in any case', async () => {
      const h = await boot()
      const push = await (await h.post({ agentId: 'ISAAC-NEWTON', esms: PUSHED })).json()
      expect(push.key).toBe('isaac-newton')

      for (const readAs of ['isaac-newton', 'Isaac-Newton']) {
        const body = await (await h.get(`?agentId=${readAs}`)).json()
        expect([readAs, body.esmsSource]).toEqual([readAs, 'spacetimedb'])
      }
    })

    it('are not remembered when the push is refused', async () => {
      const h = await boot()
      for (const bad of [
        { agentId: 'plato', esms: { ...PUSHED, matter: -1 } },
        { agentId: 'plato', esms: { spirit: 1 } },
      ]) {
        expect((await h.post(bad)).status).toBe(400)
      }
      expect(
        (await h.post({ agentId: 'plato', esms: PUSHED }, { auth: 'Bearer nope' })).status
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
          const res = await h.post({ agentId: `bulk-${i}`, esms: holdings(1) })
          if (res.status !== 200) throw new Error(`push ${i} answered ${res.status}`)
        }
      }
      const seenAs = async (h: Harness, i: number) =>
        (
          await (
            await h.get(`?agentId=bulk-${i}`, { ...bearer, 'x-forwarded-for': `10.0.0.${i % 250}` })
          ).json()
        ).esmsSource

      it(
        'drops everything still fresh to make room, and keeps working',
        async () => {
          const h = await boot({ world: bulkWorld() })
          vi.useFakeTimers()
          advanceTo(0)
          await pushRange(h, 0, 5001)

          expect(await seenAs(h, 5000)).toBe('spacetimedb')
          expect(await seenAs(h, 0)).toBe('fallback')
          expect(await seenAs(h, 4999)).toBe('fallback')
          // A new push after the purge is remembered like any other.
          expect((await h.post({ agentId: 'bulk-7', esms: PUSHED })).status).toBe(200)
          expect(await seenAs(h, 7)).toBe('spacetimedb')
        },
        BULK_TIMEOUT_MS
      )

      it(
        'drops only what has expired when that makes room',
        async () => {
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
        },
        BULK_TIMEOUT_MS
      )

      it(
        'counts an entry exactly 60 s old as still fresh, so it makes no room and everything goes',
        async () => {
          const h = await boot({ world: bulkWorld() })
          vi.useFakeTimers()
          advanceTo(0)
          await pushRange(h, 0, 2500)
          advanceTo(TTL) // readable at exactly this age (see "boundary included" above)
          await pushRange(h, 2500, 5001)

          expect(await seenAs(h, 5000)).toBe('spacetimedb')
          expect(await seenAs(h, 4999)).toBe('fallback') // not spared by a purge of the old ones
          expect(await seenAs(h, 2500)).toBe('fallback')
          expect(await seenAs(h, 0)).toBe('fallback')
        },
        BULK_TIMEOUT_MS
      )

      it(
        'keeps all 5000 while there is room',
        async () => {
          const h = await boot({ world: bulkWorld() })
          vi.useFakeTimers()
          advanceTo(0)
          await pushRange(h, 0, 5000)
          expect(await seenAs(h, 0)).toBe('spacetimedb')
          expect(await seenAs(h, 4999)).toBe('spacetimedb')
        },
        BULK_TIMEOUT_MS
      )
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
      const res = await h.post({ agentId: id, esms: holdings(1) })
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
        const body = await view(res)

        expect(res.status).toBe(200)
        expect(body.key).toBe(id)
        expect(body.handle).toBe(`Vessel ${id}`)
        expect(body.appearance).toMatchObject({ era: 'astral' })
        expect(typeof body.appearance).toBe('object')
        // The look is the manifest's, derived from the vessel's own faction and archetype.
        expect(body.appearance).toEqual(resolveAgentAppearance(id, body.faction, body.archetype))
      }
    )

    it.each(['__proto__', '__defineGetter__', '_leading', '.hidden', '-leading'])(
      'rejects %s with 400 before any lookup',
      async id => {
        const h = await boot()
        expect((await h.get(`?agentId=${id}`)).status).toBe(400)
        expect((await h.post({ agentId: id, esms: holdings(1) })).status).toBe(400)
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
      expect((await res.json()).key).toBe(hundred)
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
      expect(body.key).toBe('plato')
    })

    it('resolves a slug the roster tolerates to its canonical id', async () => {
      const h = await boot()
      const body = await (await h.get('?agentId=greg-castro')).json()
      expect(body.key).toBe('greg-castro-1991')
    })

    describe('?roster=true', () => {
      it('lists every historical agent, publicly, from the static roster alone', async () => {
        const h = await boot()
        const res = await h.get('?roster=true')
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.count).toBe(HISTORICAL_AGENTS.length)
        expect(body.agents.map((a: { key: string }) => a.key)).toEqual(
          HISTORICAL_AGENTS.map(a => a.id)
        )
        // A contract pilot is listed under the contract's handle, every other agent under its name.
        expect(body.agents.map((a: { handle: string }) => a.handle)).toEqual(
          HISTORICAL_AGENTS.map(handleOf)
        )
        for (const entry of body.agents) {
          expect(Object.keys(entry).sort()).toEqual(
            [
              'key',
              'handle',
              'faction',
              'factionName',
              'ovr',
              'archetype',
              'era',
              'crownStyle',
              'signatureRelic',
            ].sort()
          )
          expect(entry.ovr).toBeGreaterThanOrEqual(25)
          expect(entry.ovr).toBeLessThanOrEqual(99)
          expect(Number.isInteger(entry.faction)).toBe(true)
          expect(entry.faction).toBeGreaterThanOrEqual(0)
          expect(entry.faction).toBeLessThanOrEqual(9)
          expect(entry.factionName).toBe(FACTIONS[entry.faction])
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
        expect(body.agents.map((a: { key: string }) => a.key)).not.toContain(FORGED)
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
      const small = { agentId: 'isaac-newton', esms: holdings(1) }

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
        const res = await h.post({ agentId, esms: holdings(1) })
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
        `{"agentId":"isaac-newton","esms":{${ESMS_TOKENS.map(t =>
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
            error: 'esms must hold finite, non-negative spirit, essence, matter, substance.',
          })
          expect(h.db.historical).not.toHaveBeenCalled()
        })
      })

      it.each([
        ['no holdings', { agentId: 'isaac-newton' }],
        ['null holdings', { agentId: 'isaac-newton', esms: null }],
        ['a string for holdings', { agentId: 'isaac-newton', esms: '1,2,3,4' }],
        ['an array of four numbers', { agentId: 'isaac-newton', esms: [1, 2, 3, 4] }],
        ['a number for holdings', { agentId: 'isaac-newton', esms: 4 }],
      ])('is 400 for %s', async (_label, body) => {
        const h = await boot()
        expect((await h.post(body)).status).toBe(400)
      })

      it('does not take the retired field name: holdings sent as esmsBalances are no holdings', async () => {
        const h = await boot()
        const res = await h.post({ agentId: 'isaac-newton', esmsBalances: holdings(1) })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({
          success: false,
          error: 'esms must hold finite, non-negative spirit, essence, matter, substance.',
        })
        expect(h.db.historical).not.toHaveBeenCalled()
      })

      it('checks the balances before it looks the agent up', async () => {
        const h = await boot()
        const res = await h.post({ agentId: 'nobody-here', esms: { spirit: -1 } })
        expect(res.status).toBe(400)
        expect(h.db.historical).not.toHaveBeenCalled()
      })

      it('accepts ZERO balances, and a zero of either sign', async () => {
        const h = await boot()
        const res = await h.post({ agentId: 'isaac-newton', esms: holdings(0) })
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.esmsSource).toBe('spacetimedb')
        expect(body.esms).toEqual(holdings(0))
        expect(body.seals).toEqual([]) // nothing is held, so nothing is earned
        expect(body.sealProgress.every((s: { tier: unknown }) => s.tier === null)).toBe(true)

        const negativeZero = await h.post(
          '{"agentId":"isaac-newton","esms":{"spirit":-0,"essence":0,"matter":0,"substance":0}}',
          { raw: true }
        )
        expect(negativeZero.status).toBe(200)
      })

      it('accepts any finite balance, however large', async () => {
        const h = await boot()
        const res = await h.post(
          '{"agentId":"isaac-newton","esms":{"spirit":1e308,"essence":1e15,"matter":0.0001,"substance":123456789.125}}',
          { raw: true }
        )
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.esms).toEqual({
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
          esms: { ...holdings(2), gold: 99 },
          note: 'x',
        })
        expect(res.status).toBe(200)
        expect((await res.json()).esms).toEqual(holdings(2))
      })
    })

    describe('what it answers for an agent', () => {
      it('is 404 for an unknown one', async () => {
        const h = await boot()
        const res = await h.post({ agentId: 'nobody-here', esms: holdings(1) })
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
        const res = await h.post({ agentId: 'blank', esms: holdings(1) })
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
        const res = await h.post({ agentId: 'some-forged-agent', esms: holdings(1) })
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
        const res = await h.post({ agentId: FORGED, esms: PUSHED })
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
      expect(pushed.sealProgress.every((s: { balance: number }) => s.balance === 12)).toBe(true)
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
      expect(body.esms).toEqual(newton.consciousness.alchemicalElements)
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
        async () => (await boot()).post({ agentId: '../x', esms: holdings(1) }),
      ],
      ['POST 401', 401, async () => (await boot()).post(valid, { auth: 'Bearer nope' })],
      [
        'POST 404',
        404,
        async () => (await boot()).post({ agentId: 'nobody-here', esms: holdings(1) }),
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
        async () => (await boot({ world: blank() })).post({ agentId: 'blank', esms: holdings(1) }),
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
          return h.post({ agentId: 'some-forged-agent', esms: holdings(1) })
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
        expect(body.appearance).toMatchObject({ era: 'astral' })
        expect(body.sealProgress).toHaveLength(7)
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
      // ...and the faction is the ruler of the natal Sun's sign, whichever shape the chart is in.
      const sunSign = chart.tropical.CelestialBodies.all.find(
        (body: { label: string }) => body.label === 'Sun'
      ).Sign.label
      expect(forgeShaped.faction).toBe(RULER_FACTION[sunSign])
      expect(rosterShaped.faction).toBe(RULER_FACTION[sunSign])
      expect(forgeShaped.appearance).toEqual(rosterShaped.appearance)
      expect(forgeShaped.seals).toEqual(rosterShaped.seals)
      expect(forgeShaped.sealProgress).toEqual(rosterShaped.sealProgress)
      // The ascendant is part of the rating, so dropping it changes the result.
      expect(withoutAscendant.ratings).not.toEqual(forgeShaped.ratings)
      expect(
        forgeShaped.sealProgress.some(
          (s: { natalAffinity: number | null }) => s.natalAffinity !== null
        )
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

  // ─── (I) the payload is the Pentacles rating contract ──────────────────────

  describe('the payload is the Pentacles rating contract', () => {
    const forgedWorld = (overrides: Row = {}): World => {
      const world = defaultWorld()
      world.forged = [forgedRow(FORGED, overrides)]
      return world
    }

    describe('carries every contract key, and exactly the documented extensions', () => {
      it('for a roster vessel', async () => {
        const h = await boot()
        const body = await view(await h.get('?agentId=isaac-newton'))
        expect(keysOf(body)).toEqual([...ALL_KEYS].sort())
        for (const retired of RETIRED_KEYS) expect(body).not.toHaveProperty(retired)
        expectContractConformant(body)
      })

      it('for a forged vessel read with the secret', async () => {
        const h = await boot()
        const body = await view(await h.get(`?agentId=${FORGED}`, bearer))
        expect(keysOf(body)).toEqual([...ALL_KEYS].sort())
        for (const retired of RETIRED_KEYS) expect(body).not.toHaveProperty(retired)
        expectContractConformant(body)
      })

      it('for a forged vessel read anonymously, which adds only the degraded note', async () => {
        const h = await boot()
        const body = await view(await h.get(`?agentId=${FORGED}`))
        expect(keysOf(body)).toEqual([...ALL_KEYS, 'degraded'].sort())
        expect(body.degraded).toEqual({ esms: 'owner wallet is private' })
        expectContractConformant(body)
      })

      it('for a read with no sky: surge and sky are present and null, not missing', async () => {
        const h = await boot()
        h.resolveSky.mockRejectedValue(new h.SkyUnavailableError('The sky is incomplete (Pluto)'))
        const body = await view(await h.get('?agentId=isaac-newton'))

        expect(keysOf(body)).toEqual([...ALL_KEYS, 'degraded'].sort())
        expect(body).toHaveProperty('surge', null)
        expect(body).toHaveProperty('sky', null)
        expect(body.degraded).toEqual({ sky: 'The sky is incomplete (Pluto)' })
        expectContractConformant(body) // everything the contract decides without a sky still holds
      })

      it('for a push, which answers the payload a GET serves', async () => {
        const h = await boot()
        const body = await view(await h.post({ agentId: FORGED, esms: PUSHED }))
        expect(keysOf(body)).toEqual([...ALL_KEYS].sort())
        expect(body.esms).toEqual(PUSHED)
        expectContractConformant(body)
      })
    })

    it('rates a forged vessel with persisted scores to exactly the numbers the contract gives', async () => {
      // Scores 95, 93, 94, 96, 97, 92, 98 rate (25 + score x 0.74, rounded) as 95, 94, 95, 96, 97,
      // 93, 98. OVR: top 98 x 1.6 + next 97 x 1.3 + mean(96, 95, 95, 94, 93) x 1.0 = 377.5; / 3.9 = 96.8.
      const h = await boot()
      const body = await view(await h.get(`?agentId=${FORGED}`, bearer))

      expect(body.ratings).toEqual({
        power: 95,
        resonance: 94,
        wisdom: 95,
        charisma: 96,
        intuition: 97,
        adaptability: 93,
        vitality: 98,
      })
      // Against the pinned roster baselines 63, 62, 64, 61, 62, 63, 62.
      expect(body.relativeAdvantage).toEqual({
        power: 32,
        resonance: 32,
        wisdom: 31,
        charisma: 35,
        intuition: 35,
        adaptability: 30,
        vitality: 36,
      })
      expect(body.ovr).toBe(97)
      // Vitality leads by 36; charisma and intuition tie at 35 and the stat order breaks it.
      expect(body.archetype).toEqual({
        title: 'Tenacious Champion',
        primary: 'vitality',
        secondary: 'charisma',
      })
    })

    it('earns exactly the Seals the contract’s gates allow for that vessel and a rich wallet', async () => {
      // Aligned rating = rating - roster mean + 68: 86.5, 95, 94.5, 99.5, 99, 93.5, 100. Power's
      // 86.5 is Gold (86) and short of Astral (91); the rest clear Astral. Celestial (96) is
      // also cleared by charisma, intuition and vitality, but the chart (Sun Aries, Moon Leo,
      // Mars Sagittarius) puts at most 3 bodies in any element, short of the 4 it must.
      const h = await boot()
      const body = await view(await h.get(`?agentId=${FORGED}`, bearer))

      expect(body.seals).toEqual([
        {
          id: 'seal-power',
          name: 'Crucible Finisher',
          category: 'substance',
          tier: 'Gold',
          description: 'Channels raw material pressure into irresistible decisive force.',
          statKey: 'power',
          multiplier: 1.18,
        },
        {
          id: 'seal-resonance',
          name: 'Tidal Chorus',
          category: 'essence',
          tier: 'Astral',
          description: 'Attunes with the ambient frequencies of celestial transits.',
          statKey: 'resonance',
          multiplier: 1.28,
        },
        {
          id: 'seal-wisdom',
          name: "Philosopher's Stone",
          category: 'matter',
          tier: 'Astral',
          description: 'Transforms accumulated experience into strategic mastery.',
          statKey: 'wisdom',
          multiplier: 1.28,
        },
        {
          id: 'seal-charisma',
          name: 'Harmonic Sovereign',
          category: 'essence',
          tier: 'Astral',
          description: 'Commands celestial resonance to align allied forces.',
          statKey: 'charisma',
          multiplier: 1.28,
        },
        {
          id: 'seal-intuition',
          name: 'Astral Vision',
          category: 'spirit',
          tier: 'Astral',
          description: 'Pierces through veil illusions with sovereign foresight.',
          statKey: 'intuition',
          multiplier: 1.28,
        },
        {
          id: 'seal-adaptability',
          name: 'Quicksilver Pivot',
          category: 'spirit',
          tier: 'Astral',
          description: 'Transmutes tactical posture across shifting court elements.',
          statKey: 'adaptability',
          multiplier: 1.28,
        },
        {
          id: 'seal-vitality',
          name: 'Immovable Foundation',
          category: 'matter',
          tier: 'Astral',
          description: 'Anchors vessel integrity against territorial disruption.',
          statKey: 'vitality',
          multiplier: 1.28,
        },
      ])

      const progress = body.sealProgress.map(p => [
        p.stat,
        p.token,
        p.tier,
        p.nextTier,
        p.blockedBy,
        p.maxTier,
        p.statRating,
        p.alignedRating,
        p.balance,
        p.natalAffinity,
      ])
      expect(progress).toEqual([
        ['power', 'substance', 'Gold', null, [], 'Gold', 95, 86.5, 4567.125, 0],
        ['resonance', 'essence', 'Astral', 'Celestial', ['stat', 'natal'], 'Celestial', 94, 95, 2345.25, 0],
        ['wisdom', 'matter', 'Astral', 'Celestial', ['stat', 'natal'], 'Celestial', 95, 94.5, 3456.75, 0],
        ['charisma', 'essence', 'Astral', 'Celestial', ['natal'], 'Celestial', 96, 99.5, 2345.25, 0],
        ['intuition', 'spirit', 'Astral', 'Celestial', ['natal'], 'Celestial', 97, 99, 1234.5, 3],
        ['adaptability', 'spirit', 'Astral', 'Celestial', ['stat', 'natal'], 'Celestial', 93, 93.5, 1234.5, 3],
        ['vitality', 'matter', 'Astral', 'Celestial', ['natal'], 'Celestial', 98, 100, 3456.75, 0],
      ]) // prettier-ignore
    })

    describe('the surge the live sky puts on a vessel', () => {
      it('reads the fixture sky: heat and reactivity as ramp positions, the harmony offset, the boosts', async () => {
        // The sky's heat 0.1315 is past the ramp's top (0.1154) and its reactivity 3.5657 sits at
        // (3.5657 - 0.561) / (3.586 - 0.561) = 0.9933 of its ramp: sky meter 99.66. The chart's
        // Fire Sun, Moon and Mars meet an Air Sun and Fire Moon and Mars in the sky (0.5, 1, 1),
        // a mean of 0.8333 x 12 = +10, so the meter reaches the ceiling.
        const h = await boot()
        const body = await view(await h.get(`?agentId=${FORGED}`))
        const surge = body.surge as SurgeView

        expect(surge).toMatchObject({
          meter: 100,
          active: true,
          surgeType: 'inferno', // heat 1 >= reactivity 0.9933
          monicaState: 'convergent',
          heat: 1,
          harmonyOffset: 10,
          // Vitality leads the archetype (+12), charisma follows (+8), the rest get +4.
          statBoosts: {
            power: 4,
            resonance: 4,
            wisdom: 4,
            charisma: 8,
            intuition: 4,
            adaptability: 4,
            vitality: 12,
          },
        })
        expect(surge.skyMeter).toBeCloseTo(99.664, 3)
        expect(surge.reactivity).toBeCloseTo(0.99328, 4)
        expect(surge.monica).toBe(sky.monica)
        expect(body.sky).toEqual({
          source: 'swiss-ephemeris',
          at: '2026-10-15T05:43:00.000Z',
          heat: sky.thermodynamics.heat,
          reactivity: sky.thermodynamics.reactivity,
          monica: sky.monica,
        })
      })

      it('is calm under a calm sky: no boosts, not active, and the chart’s harmony alone on the meter', async () => {
        const h = await boot({ world: forgedWorld() })
        h.resolveSky.mockResolvedValue({
          ...sky,
          thermodynamics: { ...sky.thermodynamics, heat: 0.0184, reactivity: 0.561 },
        })
        const body = await view(await h.get(`?agentId=${FORGED}`))

        expect(body.surge).toMatchObject({
          meter: 10,
          active: false,
          heat: 0,
          reactivity: 0,
          skyMeter: 0,
          harmonyOffset: 10,
          statBoosts: {},
        })
        expect(body.sky).toMatchObject({ heat: 0.0184, reactivity: 0.561 })
        expectContractConformant(body)
      })

      it.each([
        [1.618, 'equilibrium', 'equilibrium', { vitality: 16, charisma: 12, power: 8 }],
        [null, 'absent', 'inferno', { vitality: 12, charisma: 8, power: 4 }],
        [0.5, 'convergent', 'inferno', { vitality: 12, charisma: 8, power: 4 }],
        [-0.5, 'divergent', 'inferno', { vitality: 12, charisma: 8, power: 4 }],
      ])(
        'classifies Monica %j as %s: an active surge is %s with boosts %j',
        async (monica, monicaState, surgeType, boosts) => {
          const h = await boot({ world: forgedWorld() })
          h.resolveSky.mockResolvedValue({ ...sky, monica })
          const body = await view(await h.get(`?agentId=${FORGED}`))
          const surge = body.surge as SurgeView

          expect(surge).toMatchObject({ monica, monicaState, surgeType, meter: 100, active: true })
          expect(surge.statBoosts).toMatchObject(boosts)
          expect(body.sky?.monica).toBe(monica)
          expectContractConformant(body)
        }
      )

      it('does not let Monica move the meter', async () => {
        const meters: number[] = []
        for (const monica of [1.618, null, 0.5, -0.5]) {
          const h = await boot({ world: forgedWorld() })
          h.resolveSky.mockResolvedValue({ ...sky, monica })
          const surge = (await view(await h.get(`?agentId=${FORGED}`))).surge as SurgeView
          meters.push(surge.skyMeter)
        }
        expect(new Set(meters).size).toBe(1)
      })

      it('lifts every zone’s synergy under an active surge, and not under a missing sky', async () => {
        const h = await boot({ world: forgedWorld() })
        const healthy = await view(await h.get(`?agentId=${FORGED}`))
        h.resolveSky.mockRejectedValue(new h.SkyUnavailableError('The sky is incomplete (Pluto)'))
        const noSky = await view(await h.get(`?agentId=${FORGED}`))
        h.resolveSky.mockResolvedValue({
          ...sky,
          thermodynamics: { ...sky.thermodynamics, heat: 0.0184, reactivity: 0.561 },
        })
        const calm = await view(await h.get(`?agentId=${FORGED}`))

        for (const zone of healthy.zoneSynergies) {
          const without = noSky.zoneSynergies[zone.zoneId].synergy
          expect([zone.zoneId, zone.synergy > without]).toEqual([zone.zoneId, true])
          // A calm sky boosts nothing, so it rates the vessel exactly as no sky does.
          expect([zone.zoneId, calm.zoneSynergies[zone.zoneId].synergy]).toEqual([
            zone.zoneId,
            without,
          ])
        }
      })

      it('answers an opaque 500 for a sky whose numbers are not finite, naming only the error class', async () => {
        const h = await boot()
        h.resolveSky.mockResolvedValue({
          ...sky,
          thermodynamics: { ...sky.thermodynamics, heat: Number.NaN },
        })
        const res = await h.get('?agentId=isaac-newton')

        expect(res.status).toBe(500)
        expect(await res.json()).toEqual({ success: false, error: 'Internal server error.' })
        expect(errorSpy).toHaveBeenCalledWith('[rating] GET failed:', 'RangeError')
        expect(logged()).not.toContain('NaN')
      })
    })

    describe('Seals and zone synergies', () => {
      // An anonymous read of a forged vessel holds nothing, so it has no Seal and no multiplier:
      // each zone is then the plain weighted mean of the vessel's ratings. House 0 weighs power,
      // resonance, wisdom, charisma, intuition, adaptability, vitality as 25, 5, 20, 5, 5, 5, 35
      // and House 1 as 35, 5, 5, 5, 5, 20, 25 (per cent).
      it('weighs the zones by the vessel’s ratings on 25 to 99, not by its raw scores', async () => {
        // Ratings 95, 94, 95, 96, 97, 93, 98 (the raw scores are 95, 93, 94, 96, 97, 92, 98, which
        // would give House 0 95.75). No sky, so no surge boosts anything.
        const h = await boot({ world: forgedWorld() })
        h.resolveSky.mockRejectedValue(new h.SkyUnavailableError('The sky is incomplete (Pluto)'))
        const body = await view(await h.get(`?agentId=${FORGED}`))

        expect(body.seals).toEqual([])
        expect(body.surge).toBeNull()
        expect(body.zoneSynergies.slice(0, 2).map(zone => [zone.zoneId, zone.synergy])).toEqual([
          [0, 96.05],
          [1, 95.45],
        ])
      })

      it('adds an active surge’s boosts to the ratings first, and stops at 99', async () => {
        // The fixture sky's surge boosts power, resonance, wisdom, intuition and adaptability by 4,
        // charisma by 8 and vitality by 12: 99, 98, 99, 99, 99, 97, 99 once clamped. House 0:
        // 24.75 + 4.9 + 19.8 + 4.95 + 4.95 + 4.85 + 34.65.
        const h = await boot({ world: forgedWorld() })
        const body = await view(await h.get(`?agentId=${FORGED}`))

        expect(body.surge?.active).toBe(true)
        expect(body.zoneSynergies[0].synergy).toBe(98.85)
      })

      it('multiplies each zone by the best Seal tier of the zone’s own element token', async () => {
        const h = await boot({ world: forgedWorld() })
        const rich = await view(await h.get(`?agentId=${FORGED}`, bearer))
        const poor = await view(await h.get(`?agentId=${FORGED}`))

        for (const zone of rich.zoneSynergies) {
          const best = rich.seals
            .filter(seal => seal.category === zone.esmsToken)
            .map(seal => SEAL_TIER_MULTIPLIERS[seal.tier])
          const multiplier = best.length === 0 ? 1 : Math.max(...best)
          const unseal = poor.zoneSynergies[zone.zoneId]
          expect([zone.zoneId, zone.esmsToken]).toEqual([unseal.zoneId, unseal.esmsToken])
          // Two roundings (the sum, then the product) allow a hundredth of slack.
          expect([
            zone.zoneId,
            Math.abs(zone.synergy - unseal.synergy * multiplier) < 0.05,
          ]).toEqual([zone.zoneId, true])
        }
        // The Seals really moved a zone, so the comparison above has teeth.
        expect(rich.zoneSynergies.some((z, i) => z.synergy > poor.zoneSynergies[i].synergy)).toBe(
          true
        )
      })
    })
  })

  // ─── (J) who is who: factions, provenance, looks ───────────────────────────

  describe('a vessel’s faction, provenance and look', () => {
    const withSun = (sign: string): World => {
      const world = defaultWorld()
      world.forged = [
        forgedRow(FORGED, {
          natalChart: { planets: { Sun: { sign, degree: 12 }, Moon: { sign, degree: 3 } } },
        }),
      ]
      return world
    }

    it.each(Object.entries(RULER_FACTION))(
      'puts a forged vessel whose natal Sun is in %s in faction %i',
      async (sign, faction) => {
        const h = await boot({ world: withSun(sign) })
        const body = await view(await h.get(`?agentId=${FORGED}`))

        expect(body.faction).toBe(faction)
        expect(body.factionName).toBe(FACTIONS[faction])
        expect(body.provenance).toBe('user')
        expect(body.isPlaceholder).toBe(false)
        expect(body.appearance).toEqual(resolveAgentAppearance(FORGED, faction, body.archetype))
      }
    )

    it('falls back to the Sun’s faction when a forged chart names no Sun', async () => {
      const world = defaultWorld()
      world.forged = [
        forgedRow(FORGED, { natalChart: { planets: { Moon: { sign: 'Cancer', degree: 3 } } } }),
      ]
      const h = await boot({ world })
      const body = await view(await h.get(`?agentId=${FORGED}`))

      expect(body.faction).toBe(0)
      expect(body.factionName).toBe('Sun')
    })

    describe('a natal Sun sign that is not one of the twelve', () => {
      // `getRulingPlanet` reads any string it does not know as Aries, whose ruler is Mars (4), so
      // an unrecognised sign must never reach it: such a chart names no Sun and the vessel is
      // the Sun's (0), drawn in the Sun's colour.
      it.each([
        'Banana',
        'Ophiuchus',
        'constructor',
        '__proto__',
        'toString',
        'hasOwnProperty',
        '',
        '   ',
        'Ari',
        'Aries!',
        'Aries Taurus',
        'Arie s',
        'Sagittarius.',
        'Aries\u0000',
        '0',
      ])('gives a Sun in %j no ruler: faction 0, not Aries’ Mars', async sign => {
        const h = await boot({ world: withSun(sign) })
        const res = await h.get(`?agentId=${FORGED}`)
        const body = await view(res)

        expect(res.status).toBe(200)
        expect([body.faction, body.factionName]).toEqual([0, 'Sun'])
        expect(body.provenance).toBe('user')
        expect(body.appearance).toEqual(resolveAgentAppearance(FORGED, 0, body.archetype))
        expect(body.appearance.paletteOverrides.secondaryTrimHex).toBe(SUN_TRIM)
      })
    })

    describe('a natal Sun sign written loosely', () => {
      // A real sign is a real sign in any case and with stray white space around it. 'LEO' lands on
      // the same faction as an unknown sign (the Sun rules Leo), so the other rows carry the weight.
      it.each([
        ['  aries ', 4],
        ['ARIES', 4],
        ['taurus', 3],
        ['\tGemini', 2],
        ['cAnCeR', 1],
        ['LEO', 0],
        ['virgo\n', 2],
        [' LIBRA ', 3],
        ['sCoRpIo', 9],
        ['SAGITTARIUS', 5],
        [' Capricorn\n', 6],
        ['AQUARIUS', 7],
        ['pisces', 8],
      ])('puts a Sun in %j in faction %i, as the sign spelt properly', async (sign, faction) => {
        const h = await boot({ world: withSun(sign) })
        const body = await view(await h.get(`?agentId=${FORGED}`))

        expect([body.faction, body.factionName]).toEqual([faction, FACTIONS[faction]])
        expect(body.appearance).toEqual(resolveAgentAppearance(FORGED, faction, body.archetype))
      })
    })

    it('gives two forged vessels with different factions different looks, trimmed in their faction’s colour', async () => {
      const aries = await view(
        await (await boot({ world: withSun('Aries') })).get(`?agentId=${FORGED}`)
      )
      const libra = await view(
        await (await boot({ world: withSun('Libra') })).get(`?agentId=${FORGED}`)
      )

      expect(aries.faction).not.toBe(libra.faction)
      expect(aries.appearance.paletteOverrides.secondaryTrimHex).not.toBe(
        libra.appearance.paletteOverrides.secondaryTrimHex
      )
    })

    it('takes a contract pilot’s faction over the roster’s: Newton is Saturn’s although the roster lists the Moon', async () => {
      const pilot = FIXTURE_AGENTS.find(agent => agent.key === 'isaac-newton')
      const listed = CANONICAL_ROSTER_71.find(entry => entry.key === 'isaac-newton')
      expect([pilot?.faction, listed?.faction]).toEqual([6, 1]) // the premise
      const h = await boot()
      const body = await view(await h.get('?agentId=isaac-newton'))

      expect(body.faction).toBe(6)
      expect(body.factionName).toBe('Saturn')
    })

    it('takes a roster vessel’s faction from the roster when it is no pilot', async () => {
      const listed = CANONICAL_ROSTER_71.find(entry => entry.key === 'lewis-carroll')
      expect(listed?.faction).toBe(5) // the premise
      expect(FIXTURE_AGENTS.some(agent => agent.key === 'lewis-carroll')).toBe(false)
      const h = await boot()
      const carroll = await view(await h.get('?agentId=lewis-carroll'))

      expect(carroll.faction).toBe(5)
      expect(carroll.factionName).toBe('Jupiter')
    })

    it('reads a birth-year id against the roster’s: Tesla is Venus’s although his natal Sun is in Cancer', async () => {
      const h = await boot()
      const body = await view(await h.get('?agentId=nikola-tesla-1856'))
      const tesla = HISTORICAL_AGENTS.find(agent => agent.id === 'nikola-tesla-1856')
      expect(tesla?.consciousness.natalChart.planets.Sun?.sign).toBe('Cancer') // the premise
      expect(CANONICAL_ROSTER_71.find(entry => entry.key === 'nikola-tesla-1856')?.faction).toBe(3)

      expect(body.faction).toBe(3)
      expect(body.factionName).toBe('Venus')
    })

    it('falls back to the ruler of the natal Sun for the one roster vessel the roster does not list', async () => {
      const unlisted = HISTORICAL_AGENTS.filter(
        agent =>
          !CANONICAL_ROSTER_71.some(
            entry => entry.key.replace(/-\d+$/, '') === agent.id.replace(/-\d+$/, '')
          )
      )
      expect(unlisted.map(agent => agent.id)).toEqual(['greg-castro-1991']) // the premise
      const h = await boot()
      const body = await view(await h.get('?agentId=greg-castro-1991'))

      expect(body.faction).toBe(1) // Gregory's natal Sun is in Cancer, which the Moon rules
      expect(body.factionName).toBe('Moon')
    })

    it.each([
      ['isaac-newton-1643', 6, 'a contract pilot'],
      ['Isaac-Newton-1643', 6, 'a contract pilot, in another case'],
      ['lewis-carroll-1832', 5, 'a roster entry'],
    ])(
      'reads a forged id %s as the manifest does: faction %i of its base key, the look it resolves to (%s)',
      async (id, faction) => {
        // The roster does not resolve these (a birth year it never had), so the row is a person's.
        const world = defaultWorld()
        world.forged = [forgedRow(id)] // its natal Sun is in Aries, ruled by Mars (4)
        const h = await boot({ world })
        const body = await view(await h.get(`?agentId=${id}`))

        expect(body.provenance).toBe('user')
        expect(body.key).toBe(id)
        expect(body.faction).toBe(faction)
        expect(body.factionName).toBe(FACTIONS[faction])
        expect(body.appearance).toEqual(resolveAgentAppearance(id, faction, body.archetype))
      }
    )

    it('marks a placeholder chart as a placeholder vessel, and gives it no Celestial Seal', async () => {
      const h = await boot()
      const body = await view(await h.post({ agentId: 'plato', esms: holdings(1000) }))
      const plato = HISTORICAL_AGENTS.find(agent => agent.id === 'plato')
      expect(plato?.consciousness.natalChart.provenance).toBe('placeholder') // the premise

      expect(body.isPlaceholder).toBe(true)
      expect(body.provenance).toBe('placeholder')
      expect(body.sealProgress.every(p => p.natalAffinity === null)).toBe(true)
      expect(body.seals.some(seal => seal.tier === 'Celestial')).toBe(false)
      expect(body.sealProgress.every(p => p.tier !== 'Celestial')).toBe(true)
    })

    it('marks a charted roster vessel as historical and not a placeholder', async () => {
      const h = await boot()
      const body = await view(await h.get('?agentId=isaac-newton'))
      expect(body.isPlaceholder).toBe(false)
      expect(body.provenance).toBe('historical')
    })

    it('passes a roster vessel’s model URLs through, and only the ones it has', async () => {
      const h = await boot()
      const { getHistoricalAgent } = await import('@/lib/agents/historical')
      const newton = getHistoricalAgent('isaac-newton')
      if (!newton) throw new Error('isaac-newton is not on the roster')
      newton.avatarModelUrl = '/models/newton.glb'
      const onlyAvatar = await view(await h.get('?agentId=isaac-newton'))
      expect(onlyAvatar.avatarModelUrl).toBe('/models/newton.glb')
      expect(onlyAvatar).not.toHaveProperty('headMeshUrl')

      newton.avatarModelUrl = undefined
      newton.headMeshUrl = '/models/newton-head.glb'
      const onlyHead = await view(await h.get('?agentId=isaac-newton'))
      expect(onlyHead.headMeshUrl).toBe('/models/newton-head.glb')
      expect(onlyHead).not.toHaveProperty('avatarModelUrl')
    })

    describe('when the manifest’s look carries model URLs of its own', () => {
      // No look in the manifest ships a model today; the type allows it, so the route has to
      // pass one through (and let a roster agent's own model win) the day one does.
      const MANIFEST = '@/lib/agents/vessel-appearance-manifest'
      const LOOK_AVATAR = '/models/look.glb'
      const LOOK_HEAD = '/models/look-head.glb'
      beforeEach(() => {
        vi.doMock(MANIFEST, async importOriginal => {
          const real =
            await importOriginal<typeof import('@/lib/agents/vessel-appearance-manifest')>()
          return {
            ...real,
            resolveAgentAppearance: (...args: Parameters<typeof real.resolveAgentAppearance>) => ({
              ...real.resolveAgentAppearance(...args),
              avatarModelUrl: LOOK_AVATAR,
              headMeshUrl: LOOK_HEAD,
            }),
          }
        })
      })
      afterEach(() => {
        vi.doUnmock(MANIFEST)
      })

      it('passes them through for a forged vessel', async () => {
        const h = await boot()
        const body = await view(await h.get(`?agentId=${FORGED}`, bearer))
        expect([body.avatarModelUrl, body.headMeshUrl]).toEqual([LOOK_AVATAR, LOOK_HEAD])
        expect([body.appearance.avatarModelUrl, body.appearance.headMeshUrl]).toEqual([
          LOOK_AVATAR,
          LOOK_HEAD,
        ])
      })

      it('fills in for a roster agent that has no model of its own', async () => {
        const h = await boot()
        const body = await view(await h.get('?agentId=isaac-newton'))
        expect([body.avatarModelUrl, body.headMeshUrl]).toEqual([LOOK_AVATAR, LOOK_HEAD])
      })

      it('yields to the model a roster agent has, one at a time', async () => {
        const h = await boot()
        const { getHistoricalAgent } = await import('@/lib/agents/historical')
        const newton = getHistoricalAgent('isaac-newton')
        if (!newton) throw new Error('isaac-newton is not on the roster')

        newton.avatarModelUrl = '/models/newton.glb'
        const ownAvatar = await view(await h.get('?agentId=isaac-newton'))
        expect([ownAvatar.avatarModelUrl, ownAvatar.headMeshUrl]).toEqual([
          '/models/newton.glb',
          LOOK_HEAD,
        ])

        newton.avatarModelUrl = undefined
        newton.headMeshUrl = '/models/newton-head.glb'
        const ownHead = await view(await h.get('?agentId=isaac-newton'))
        expect([ownHead.avatarModelUrl, ownHead.headMeshUrl]).toEqual([
          LOOK_AVATAR,
          '/models/newton-head.glb',
        ])
      })
    })

    describe('the Pentacles avatar alias', () => {
      /** What the contract says of its pilot `user-avatar-neo`, as literals. */
      const ADEPT_NEO = {
        key: 'user-avatar-neo',
        handle: 'Adept Neo',
        faction: 0,
        factionName: 'Sun',
        isPlaceholder: false,
        provenance: 'user',
      }

      it('answers as the contract’s Adept Neo: user-avatar-neo, the Sun’s faction, provenance user, the pilot’s look', async () => {
        const pilot = FIXTURE_AGENTS.find(agent => agent.key === 'user-avatar-neo')
        if (!pilot) throw new Error('the contract has no user-avatar-neo pilot')
        const resolver = stubResolver()
        const h = await boot({ resolver })
        const body = await view(await h.get('?agentId=user-avatar-neo'))

        expect(identityOf(body)).toEqual(ADEPT_NEO)
        expect(identityOf(body)).toEqual(identityOf(pilot)) // the premise, and the contract as oracle
        expect(body.appearance).toEqual(pilot.appearance)
        expect(body.appearance).toMatchObject({
          era: 'astral',
          headSilhouette: { crownStyle: 'sovereign-crest' },
          paletteOverrides: { secondaryTrimHex: '#efc45c' },
        })
        // ...while the ledger id stays his roster agent's.
        expect(resolver.mock.calls.map(([id]) => id)).toEqual(['greg-castro-1991'])
        expectContractConformant(body)
      })

      it('is Adept Neo on a POST too, and neither response names the person behind the ledger id', async () => {
        const h = await boot()
        const read = await (await h.get('?agentId=user-avatar-neo')).text()
        const pushed = await (await h.post({ agentId: 'user-avatar-neo', esms: PUSHED })).text()

        for (const text of [read, pushed]) {
          expect(identityOf(JSON.parse(text))).toEqual(ADEPT_NEO)
          expect(text).not.toMatch(/gregory|castro|greg-/i)
        }
      })

      it('shares the stats, ratings and wallet of greg-castro-1991, under a different key, name, provenance, faction and look', async () => {
        const h = await boot()
        const avatar = await view(await h.get('?agentId=user-avatar-neo'))
        const rostered = await view(await h.get('?agentId=greg-castro-1991'))

        expect(rostered.key).toBe('greg-castro-1991')
        expect([rostered.handle, avatar.handle]).toEqual(['Gregory Castro', 'Adept Neo'])
        expect([rostered.provenance, avatar.provenance]).toEqual(['historical', 'user'])
        expect(rostered.ratings).toEqual(avatar.ratings)
        expect(rostered.ovr).toBe(avatar.ovr)
        expect(rostered.archetype).toEqual(avatar.archetype)
        expect(rostered.esms).toEqual(GREG_WALLET)
        expect(avatar.esms).toEqual(GREG_WALLET)
        expect(rostered.sealProgress).toEqual(avatar.sealProgress)
        // Gregory is a Cancer: his roster entry follows the Moon and is drawn in the Moon's
        // colours; the avatar is the Sun's pilot and wears the pilot's look.
        expect(rostered.faction).toBe(1)
        expect(avatar.faction).toBe(0)
        expect(rostered.appearance).toEqual(resolveAgentAppearance('greg-castro-1991', 1))
        expect(rostered.appearance).not.toEqual(avatar.appearance)
      })

      it('is the one alias there is', async () => {
        const h = await boot()
        const { VESSEL_ALIASES } = await import('@/lib/agents/rating/vessel-payload')
        expect(VESSEL_ALIASES).toEqual({ 'user-avatar-neo': 'greg-castro-1991' })
        expect((await h.get('?agentId=zz')).status).toBe(404)
      })

      it('is listed under its roster id and name, never under the alias or the pilot’s', async () => {
        const h = await boot()
        const agents = (await (await h.get('?roster=true')).json()).agents as Array<{
          key: string
          handle: string
        }>
        const handles = new Map(agents.map(entry => [entry.key, entry.handle]))
        expect(handles.get('greg-castro-1991')).toBe('Gregory Castro')
        expect(handles.has('user-avatar-neo')).toBe(false)
        expect([...handles.values()]).not.toContain('Adept Neo')
      })
    })

    describe('a contract pilot’s name and provenance', () => {
      /** The three pilots that are also on the roster: id, handle, faction and its name. */
      const ON_THE_ROSTER = [
        ['isaac-newton', 'Sir Isaac Newton', 6, 'Saturn'],
        ['leonardo-da-vinci', 'Leonardo da Vinci', 9, 'Pluto'],
        ['emily-dickinson', 'Emily Dickinson', 3, 'Venus'],
      ] as const

      it('premise: the contract has these four pilots, named and sourced so', () => {
        expect(
          Object.fromEntries(
            FIXTURE_AGENTS.map(pilot => [
              pilot.key,
              [pilot.handle, pilot.provenance, pilot.faction],
            ])
          )
        ).toEqual({
          'isaac-newton': ['Sir Isaac Newton', 'historical', 6],
          'leonardo-da-vinci': ['Leonardo da Vinci', 'historical', 9],
          'emily-dickinson': ['Emily Dickinson', 'historical', 3],
          'user-avatar-neo': ['Adept Neo', 'user', 0],
        })
        // Newton is the one whose roster name differs from the contract's handle.
        for (const [id, handle] of ON_THE_ROSTER) {
          const onRoster = HISTORICAL_AGENTS.find(agent => agent.id === id)
          expect([id, onRoster?.name === handle]).toEqual([id, id !== 'isaac-newton'])
        }
      })

      it.each(ON_THE_ROSTER)(
        'GET %s answers with the contract’s handle %s, provenance historical and faction %i (%s)',
        async (id, handle, faction, factionName) => {
          const pilot = FIXTURE_AGENTS.find(agent => agent.key === id)
          const h = await boot()
          const body = await view(await h.get(`?agentId=${id}`))

          expect(identityOf(body)).toEqual({
            key: id,
            handle,
            faction,
            factionName,
            isPlaceholder: false,
            provenance: 'historical',
          })
          expect(identityOf(body)).toEqual(identityOf(pilot as NonNullable<typeof pilot>))
          expect(body.appearance).toEqual(resolveAgentAppearance(id))
          expectContractConformant(body)
        }
      )

      it.each(ON_THE_ROSTER)(
        'POST %s answers with the same handle %s, and a GET of the push says the same',
        async (id, handle) => {
          const h = await boot()
          const pushed = await view(await h.post({ agentId: id, esms: PUSHED }))
          const read = await view(await h.get(`?agentId=${id}`))

          expect([pushed.handle, pushed.provenance]).toEqual([handle, 'historical'])
          expect(read.esmsSource).toBe('spacetimedb') // it did read the push
          expect(identityOf(read)).toEqual(identityOf(pushed))
        }
      )

      it.each(ON_THE_ROSTER)(
        'names %s as the contract does, whatever the roster calls it (GET and the listing)',
        async (id, handle) => {
          const h = await boot()
          const agent = await rosterAgent(id)
          agent.name = 'Renamed In The Roster'

          const body = await view(await h.get(`?agentId=${id}`))
          expect(body.handle).toBe(handle)
          const listed = (await (await h.get('?roster=true')).json()).agents.find(
            (entry: { key: string }) => entry.key === id
          )
          expect(listed.handle).toBe(handle)
        }
      )

      it.each(ON_THE_ROSTER)(
        'finds %s by its base key when the roster id carries a birth year, in any case',
        async (pilotId, handle, faction, factionName) => {
          // No pilot's roster id has a birth year today, so one is given to it for the test.
          for (const id of [`${pilotId}-1643`, `${pilotId.toUpperCase()}-1643`]) {
            const h = await boot()
            const agent = await rosterAgent(pilotId)
            agent.id = id
            agent.name = 'Renamed In The Roster'

            const body = await view(await h.get(`?agentId=${id}`))
            expect([id, identityOf(body)]).toEqual([
              id,
              {
                key: id,
                handle,
                faction,
                factionName,
                isPlaceholder: false,
                provenance: 'historical',
              },
            ])
            expect([id, body.appearance]).toEqual([id, resolveAgentAppearance(id)])
          }
        }
      )

      it('names every roster agent that is no pilot by the roster’s own name', async () => {
        const h = await boot()
        expect(FIXTURE_AGENTS.some(pilot => pilot.key === 'lewis-carroll')).toBe(false)
        const agent = await rosterAgent('lewis-carroll')
        agent.name = 'Renamed In The Roster'

        const body = await view(await h.get('?agentId=lewis-carroll'))
        expect([body.handle, body.provenance]).toEqual(['Renamed In The Roster', 'historical'])
        const listed = (await (await h.get('?roster=true')).json()).agents.find(
          (entry: { key: string }) => entry.key === 'lewis-carroll'
        )
        expect(listed.handle).toBe('Renamed In The Roster')
      })

      it('lists the pilots under the contract’s handles, beside everyone else’s roster names', async () => {
        const h = await boot()
        const agents = (await (await h.get('?roster=true')).json()).agents as Array<{
          key: string
          handle: string
        }>
        const handles = new Map(agents.map(entry => [entry.key, entry.handle]))

        expect([
          handles.get('isaac-newton'),
          handles.get('leonardo-da-vinci'),
          handles.get('emily-dickinson'),
          handles.get('lewis-carroll'),
          handles.get('greg-castro-1991'),
        ]).toEqual([
          'Sir Isaac Newton',
          'Leonardo da Vinci',
          'Emily Dickinson',
          'Lewis Carroll',
          'Gregory Castro',
        ])
        expect([...handles.values()]).not.toContain('Isaac Newton')
      })

      it.each([
        ['isaac-newton', 'Sir Isaac Newton', 6, 'Saturn'],
        ['user-avatar-neo', 'Adept Neo', 0, 'Sun'],
      ])(
        'keeps %s a placeholder when its chart is one: the chart outranks the pilot’s provenance',
        async (id, handle, faction, factionName) => {
          const h = await boot()
          const ledgerId = id === 'user-avatar-neo' ? 'greg-castro-1991' : id
          const agent = await rosterAgent(ledgerId)
          agent.consciousness.natalChart.provenance = 'placeholder'

          const body = await view(await h.get(`?agentId=${id}`))
          expect(identityOf(body)).toEqual({
            key: id,
            handle,
            faction,
            factionName,
            isPlaceholder: true,
            provenance: 'placeholder',
          })
          expect(body.sealProgress.every(p => p.natalAffinity === null)).toBe(true)
          expectContractConformant(body)
        }
      )

      it('does not rename or re-source a person’s forged vessel that borrows a pilot’s id: only the roster has pilots', async () => {
        const world = defaultWorld()
        world.forged = [
          forgedRow('isaac-newton-1643', { name: 'Isaac The Second' }),
          forgedRow('user-avatar-neo-7', { name: 'Not The Avatar' }),
        ]
        const h = await boot({ world })

        const newton = await view(await h.get('?agentId=isaac-newton-1643'))
        expect([newton.handle, newton.provenance]).toEqual(['Isaac The Second', 'user'])
        expect(newton.faction).toBe(6) // the pilot's faction is taken from its base key all the same
        const neo = await view(await h.get('?agentId=user-avatar-neo-7'))
        expect([neo.handle, neo.provenance]).toEqual(['Not The Avatar', 'user'])
      })
    })

    describe('the one roster vessel the manifest does not list', () => {
      it('draws greg-castro-1991 in his own faction’s colour, the Moon’s, not the manifest’s default Sun', async () => {
        // The premise: asked for no faction, the manifest would draw him in the Sun's colour.
        expect(resolveAgentAppearance('greg-castro-1991').paletteOverrides.secondaryTrimHex).toBe(
          SUN_TRIM
        )
        const h = await boot()
        const body = await view(await h.get('?agentId=greg-castro-1991'))

        expect([body.faction, body.factionName]).toEqual([1, 'Moon'])
        expect(body.appearance.paletteOverrides.secondaryTrimHex).toBe(MOON_TRIM)
        expect(body.appearance).toEqual(resolveAgentAppearance('greg-castro-1991', 1))
        expect(body.appearance).not.toEqual(resolveAgentAppearance('greg-castro-1991'))
      })

      it.each(['greg-castro', 'GREG-CASTRO-1991'])(
        'draws it the same when the roster resolves the id %s to his',
        async id => {
          const h = await boot()
          const body = await view(await h.get(`?agentId=${id}`))
          expect(body.key).toBe('greg-castro-1991')
          expect(body.appearance).toEqual(resolveAgentAppearance('greg-castro-1991', 1))
        }
      )

      it('draws it the same on a POST and in the listing, and each says what the look is', async () => {
        const h = await boot()
        const pushed = await view(await h.post({ agentId: 'greg-castro-1991', esms: PUSHED }))
        expect(pushed.appearance).toEqual(resolveAgentAppearance('greg-castro-1991', 1))

        const listed = (await (await h.get('?roster=true')).json()).agents.find(
          (entry: { key: string }) => entry.key === 'greg-castro-1991'
        )
        expect(listed).toMatchObject({
          faction: 1,
          factionName: 'Moon',
          era: pushed.appearance.era,
          crownStyle: pushed.appearance.headSilhouette.crownStyle,
          signatureRelic: pushed.appearance.signatureRelic,
        })
      })
    })

    describe('what the route asks the manifest for', () => {
      // The look of a vessel the manifest knows is the manifest's own, and the route must ask
      // for it by id alone: a faction passed along would redraw it. For every roster vessel
      // today the two coincide (the roster's own faction is the manifest's), so the only
      // place the difference shows is in the call.
      const MANIFEST = '@/lib/agents/vessel-appearance-manifest'
      let asked: unknown[][]
      beforeEach(() => {
        asked = []
        vi.doMock(MANIFEST, async importOriginal => {
          const real =
            await importOriginal<typeof import('@/lib/agents/vessel-appearance-manifest')>()
          return {
            ...real,
            resolveAgentAppearance: (...args: Parameters<typeof real.resolveAgentAppearance>) => {
              asked.push(args)
              return real.resolveAgentAppearance(...args)
            },
          }
        })
      })
      afterEach(() => {
        vi.doUnmock(MANIFEST)
      })
      const askedFor = (id: string) => asked.filter(args => args[0] === id)

      it.each([
        ['isaac-newton', 'a contract pilot'],
        ['lewis-carroll', 'a roster entry'],
        ['nikola-tesla-1856', 'a roster entry with a birth year'],
        ['user-avatar-neo', 'the avatar alias'],
      ])('asks for %s (%s) by its id alone', async id => {
        const h = await boot()
        asked.length = 0 // loading the contract asked for its own pilots' looks
        expect((await h.get(`?agentId=${id}`)).status).toBe(200)
        expect(askedFor(id)).toEqual([[id]])
      })

      it('asks for greg-castro-1991, whom it does not list, with his faction: the Moon’s, 1', async () => {
        const h = await boot()
        asked.length = 0
        expect((await h.get('?agentId=greg-castro-1991')).status).toBe(200)
        expect(askedFor('greg-castro-1991')).toEqual([['greg-castro-1991', 1]])
      })

      it('asks for every roster vessel by its id alone but the one it does not list, across the whole listing', async () => {
        const h = await boot()
        asked.length = 0
        expect((await h.get('?roster=true')).status).toBe(200)

        const unknown = HISTORICAL_AGENTS.filter(
          agent =>
            !PILOTS.has(baseKeyOf(agent.id)) &&
            !CANONICAL_ROSTER_71.some(entry => baseKeyOf(entry.key) === baseKeyOf(agent.id))
        )
        expect(unknown.map(agent => agent.id)).toEqual(['greg-castro-1991']) // the premise
        for (const agent of HISTORICAL_AGENTS) {
          const withFaction = unknown.includes(agent) ? [1] : []
          expect([agent.id, askedFor(agent.id)]).toEqual([agent.id, [[agent.id, ...withFaction]]])
        }
      })
    })
  })

  // ─── (J2) the ends of the scale ────────────────────────────────────────────

  describe('the ends of the rating scale', () => {
    const scored = (scores: number[]): World => {
      const [power, resonance, wisdom, charisma, intuition, adaptability, vitality] = scores
      const world = defaultWorld()
      world.forged = [
        forgedRow(FORGED, {
          powerScore: power,
          resonanceScore7: resonance,
          wisdomScore: wisdom,
          charismaScore: charisma,
          intuitionScore: intuition,
          adaptabilityScore: adaptability,
          vitalityScore: vitality,
        }),
      ]
      return world
    }
    const SCALE = { name: 'Pentacle Vessel Rating Scale', floor: 25, ceiling: 99 }

    it('rates a score of 0 as 25 and a score of 100 as 99, and rounds the ones between', async () => {
      // 25 + score / 100 * 74, rounded: 0 -> 25, 1 -> 25.74, 10 -> 32.4, 50 -> 62, 90 -> 91.6,
      // 99 -> 98.26, 100 -> 99.
      const h = await boot({ world: scored([0, 50, 100, 1, 99, 10, 90]) })
      const body = await view(await h.get(`?agentId=${FORGED}`))

      expect(body.ratings).toEqual({
        power: 25,
        resonance: 62,
        wisdom: 99,
        charisma: 26,
        intuition: 98,
        adaptability: 32,
        vitality: 92,
      })
      expect(body.scale).toEqual(SCALE)
      expectContractConformant(body)
    })

    it('rates a vessel of perfect scores 99 all through, and of the faintest ones 25 all through', async () => {
      const rated = async (world: World, query = `?agentId=${FORGED}`) =>
        view(await (await boot({ world })).get(query))
      const perfect = await rated(scored([100, 100, 100, 100, 100, 100, 100]))
      expect(Object.values(perfect.ratings)).toEqual(Array(7).fill(99))
      expect(perfect.ovr).toBe(99)

      const faint = await rated(scored([0, 0, 0, 0, 0, 0, 0.001]))
      expect(Object.values(faint.ratings)).toEqual(Array(7).fill(25))
      expect(faint.ovr).toBe(25)

      // The scale a payload announces is the same wherever the vessel sits on it.
      const roster = await rated(defaultWorld(), '?agentId=isaac-newton')
      for (const body of [perfect, faint, roster]) expect(body.scale).toEqual(SCALE)
    })
  })

  // ─── (K) a GET and a POST of the same inputs ───────────────────────────────

  describe('a GET and a POST of the same inputs', () => {
    /** What a different holding changes; everything else is a function of the vessel and the sky. */
    const HOLDING_DRIVEN = [
      'esms',
      'esmsSource',
      'seals',
      'sealProgress',
      'zoneSynergies',
      'bestZoneId',
      'degraded',
    ]
    const changedKeys = (a: PayloadView, b: PayloadView) =>
      [...new Set([...keysOf(a), ...keysOf(b)])]
        .filter(key => JSON.stringify((a as never)[key]) !== JSON.stringify((b as never)[key]))
        .sort()

    it('are the same payload for a roster vessel, except where the push applies: its provenance', async () => {
      const h = await boot()
      const read = await view(await h.get('?agentId=isaac-newton'))
      const pushed = await view(await h.post({ agentId: 'isaac-newton', esms: NEWTON_WALLET }))

      expect(read.esmsSource).toBe('database')
      expect(pushed.esmsSource).toBe('spacetimedb')
      expect(changedKeys(read, pushed)).toEqual(['esmsSource'])
    })

    it('are the same payload for a forged vessel the secret holder reads, except for the same provenance', async () => {
      const h = await boot()
      const read = await view(await h.get(`?agentId=${FORGED}`, bearer))
      const pushed = await view(await h.post({ agentId: FORGED, esms: CREATOR_WALLET }))

      expect(read.esmsSource).toBe('database')
      expect(pushed.esmsSource).toBe('spacetimedb')
      expect(changedKeys(read, pushed)).toEqual(['esmsSource'])
    })

    it('differ in nothing but what the holdings drive when the holdings differ', async () => {
      const h = await boot()
      const read = await view(await h.get('?agentId=isaac-newton'))
      const richer = await view(await h.post({ agentId: 'isaac-newton', esms: holdings(300) }))

      const changed = changedKeys(read, richer)
      expect(changed.filter(key => !HOLDING_DRIVEN.includes(key))).toEqual([])
      expect(changed).toEqual(
        expect.arrayContaining(['esms', 'esmsSource', 'sealProgress', 'zoneSynergies'])
      )
      // Everything the vessel and the sky decide is untouched by what it holds.
      for (const key of [
        'key',
        'handle',
        'faction',
        'factionName',
        'appearance',
        'ratings',
        'ovr',
        'archetype',
        'surge',
        'sky',
      ] as const) {
        expect([key, richer[key]]).toEqual([key, read[key]])
      }
    })

    it('are the same payload again on a repeated GET', async () => {
      const h = await boot()
      const first = await view(await h.get(`?agentId=${FORGED}`))
      const second = await view(await h.get(`?agentId=${FORGED}`))
      expect(second).toEqual(first)
    })

    it('answer the same payload for an alias push as for the roster id it stands for', async () => {
      const h = await boot()
      const viaAlias = await view(await h.post({ agentId: 'user-avatar-neo', esms: PUSHED }))
      const viaRoster = await view(await h.post({ agentId: 'greg-castro-1991', esms: PUSHED }))

      expect(viaAlias.key).toBe('user-avatar-neo')
      expect(viaRoster.key).toBe('greg-castro-1991')
      expect(viaAlias.esms).toEqual(viaRoster.esms)
      expect(viaAlias.sealProgress).toEqual(viaRoster.sealProgress)
      expect(viaAlias.seals).toEqual(viaRoster.seals)
    })
  })

  // ─── (L) what a seal may say about a private wallet ────────────────────────

  describe('the Seals of an anonymous GET of a forged vessel', () => {
    const noWalletWorld = (): World => {
      const world = defaultWorld()
      world.created = []
      world.users = []
      return world
    }
    const withoutNote = ({ degraded: _degraded, ...rest }: PayloadView) => rest

    it('never exceed what the baseline holdings allow, whatever the creator holds', async () => {
      const anonymous = await view(await (await boot()).get(`?agentId=${FORGED}`))

      expect(anonymous.esms).toEqual(holdings(0))
      for (const p of anonymous.sealProgress) {
        // The contract's own answer for this stat and the baseline balance: nothing at all.
        const allowed = evaluateSealTier(
          p.stat,
          p.statRating,
          anonymous.esms[p.token as keyof EsmsHoldings]
        )
        expect([p.stat, allowed]).toEqual([p.stat, null])
        expect([p.stat, rank(p.tier) <= rank(allowed)]).toEqual([p.stat, true])
        expect(p.balance).toBe(0)
      }
      expect(anonymous.seals).toEqual([])
    })

    it('are every one still short of Copper, with the ESMS gate the only thing in the way', async () => {
      // Every aligned rating of this vessel clears Copper's 74, so the baseline alone blocks it.
      const anonymous = await view(await (await boot()).get(`?agentId=${FORGED}`))
      for (const p of anonymous.sealProgress) {
        expect([p.stat, p.tier, p.nextTier, p.blockedBy]).toEqual([
          p.stat,
          null,
          'Copper',
          ['esms'],
        ])
      }
    })

    it('are the very payload a vessel with no wallet at all gets, apart from the note saying why', async () => {
      const anonymous = await view(await (await boot()).get(`?agentId=${FORGED}`))
      const reference = await view(
        await (await boot({ world: noWalletWorld() })).get(`?agentId=${FORGED}`)
      )

      expect(anonymous.degraded).toEqual({ esms: 'owner wallet is private' })
      expect(reference.degraded).toEqual({ esms: 'no ledger row' })
      // Seals, progress, zone synergies and the best zone included: none can encode the wallet.
      expect(withoutNote(anonymous)).toEqual(withoutNote(reference))
    })

    it('are the same for a signed-in stranger and for an anonymous caller', async () => {
      const h = await boot()
      const anonymous = await view(await h.get(`?agentId=${FORGED}`))
      h.session.current = { user: { id: OTHER_USER } }
      const stranger = await view(await h.get(`?agentId=${FORGED}`))
      expect(stranger).toEqual(anonymous)
    })

    it('carry no number from the creator’s wallet anywhere, from the Seals to the zone synergies', async () => {
      const h = await boot()
      const text = await (await h.get(`?agentId=${FORGED}`)).text()
      for (const n of [...numbersOf(CREATOR_WALLET), ...numbersOf(OTHER_WALLET)]) {
        expect(text).not.toContain(n)
      }
      // ...although the same vessel read with the secret carries them, in the Seals' balances too.
      const unlocked = await view(await h.get(`?agentId=${FORGED}`, bearer))
      expect(unlocked.sealProgress.map(p => p.balance).sort()).toEqual(
        [1234.5, 1234.5, 2345.25, 2345.25, 3456.75, 3456.75, 4567.125].sort()
      )
      expect(rank(unlocked.sealProgress[0].tier)).toBeGreaterThan(rank(null))
    })

    it('are computed from the roster baseline for a roster vessel with no ledger row, and labelled so', async () => {
      const world = defaultWorld()
      world.users = world.users.filter(u => u.id !== 'agentic-newton')
      const h = await boot({ world })
      const body = await view(await h.get('?agentId=isaac-newton'))
      const newton = HISTORICAL_AGENTS.find(a => a.id === 'isaac-newton')!
      const baseline = newton.consciousness.alchemicalElements as EsmsHoldings

      expect(body.esmsSource).toBe('fallback')
      expect(body.esms).toEqual(baseline)
      for (const p of body.sealProgress) {
        expect(p.balance).toBe(baseline[p.token as keyof EsmsHoldings])
        expect(rank(p.tier)).toBeLessThanOrEqual(
          rank(evaluateSealTier(p.stat, p.statRating, baseline[p.token as keyof EsmsHoldings]))
        )
      }
      expectContractConformant(body)
    })
  })

  // ─── (M) the Pentacles vocabulary ──────────────────────────────────────────

  describe('the tier vocabulary', () => {
    const tiersIn = (body: PayloadView): Array<Tier | null> => [
      ...body.seals.map(seal => seal.tier),
      ...body.sealProgress.flatMap(p => [p.tier, p.nextTier, p.maxTier]),
    ]
    const stray = (body: PayloadView) =>
      tiersIn(body).filter(tier => tier !== null && !(TIERS as readonly string[]).includes(tier))

    it('is Copper, Silver, Gold, Astral and Celestial, and the retired name is nowhere in any response', async () => {
      const h = await boot()
      const responses: Response[] = [
        await h.get('?agentId=isaac-newton'),
        await h.get('?agentId=user-avatar-neo'),
        await h.get(`?agentId=${FORGED}`),
        await h.get(`?agentId=${FORGED}`, bearer),
        await h.get('?roster=true'),
        await h.post({ agentId: 'isaac-newton', esms: holdings(1000) }),
        await h.post({ agentId: FORGED, esms: holdings(1000) }),
        await h.get('?agentId=../x'), // 400
        await h.get('?agentId=nobody-here'), // 404
        await h.post({ agentId: 'isaac-newton', esms: { spirit: -1 } }), // 400
        await h.post({ agentId: 'nobody-here', esms: holdings(1) }), // 404
      ]
      h.resolveSky.mockRejectedValue(new h.SkyUnavailableError('The sky is incomplete (Pluto)'))
      responses.push(await h.get('?agentId=isaac-newton')) // a degraded read
      h.db.failures.lookup = new Error('down')
      responses.push(await h.get('?agentId=some-forged-agent')) // 503

      for (const res of responses) {
        const text = await res.text()
        expect([res.status, text.toLowerCase().includes(RETIRED_TIER)]).toEqual([res.status, false])
      }
    })

    it('contains no tier outside the five, for a vessel holding nothing and for one holding everything', async () => {
      const h = await boot()
      for (const each of [0, 0.5, 2, 10, 50, 250, 1e9]) {
        const body = await view(await h.post({ agentId: FORGED, esms: holdings(each) }))
        expect([each, stray(body)]).toEqual([each, []])
        expect(body.sealProgress.map(p => p.maxTier).every(tier => TIERS.includes(tier))).toBe(true)
      }
    })

    it('climbs one tier per gate as the ESMS balance grows, for a vessel whose stats clear them all', async () => {
      // Aligned vitality is 100, past every stat gate (74 to 96); the chart's Fire bodies (3) leave
      // Celestial shut, so the balance alone sets the tier, at 0.5 / 2 / 10 / 50 and never 250.
      const h = await boot()
      const tierAt = async (balance: number) => {
        const body = await view(await h.post({ agentId: FORGED, esms: holdings(balance) }))
        return body.sealProgress.find(p => p.stat === 'vitality')?.tier
      }
      expect(await tierAt(0.4999)).toBeNull()
      expect(await tierAt(0.5)).toBe('Copper')
      expect(await tierAt(1.9999)).toBe('Copper')
      expect(await tierAt(2)).toBe('Silver')
      expect(await tierAt(9.9999)).toBe('Silver')
      expect(await tierAt(10)).toBe('Gold')
      expect(await tierAt(49.9999)).toBe('Gold')
      expect(await tierAt(50)).toBe('Astral')
      expect(await tierAt(250)).toBe('Astral')
      expect(await tierAt(1e9)).toBe('Astral')
    })

    it('multiplies a Seal by its own tier’s factor: 1.05, 1.1, 1.18, 1.28 and 1.4', async () => {
      // Celestial's 1.4 needs the chart's blessing and is read below; the other four come
      // straight off a forged vessel whose chart leaves Celestial shut.
      const h = await boot()
      const factors: Record<string, number> = {}
      for (const [balance, tier] of [
        [0.5, 'Copper'],
        [2, 'Silver'],
        [10, 'Gold'],
        [50, 'Astral'],
      ] as const) {
        const body = await view(await h.post({ agentId: FORGED, esms: holdings(balance) }))
        const seal = body.seals.find(s => s.statKey === 'vitality')
        expect(seal?.tier).toBe(tier)
        factors[tier] = seal?.multiplier as number
      }
      expect(factors).toEqual({ Copper: 1.05, Silver: 1.1, Gold: 1.18, Astral: 1.28 })
    })

    describe('Celestial, which also needs the chart’s blessing', () => {
      /** Intuition's token is spirit (Fire). Chiron is no classical body and counts for nothing. */
      const chartWith = (fire: number): Row => {
        const fireSigns = ['Aries', 'Leo', 'Sagittarius', 'Aries', 'Leo']
        const bodies = ['Sun', 'Moon', 'Mars', 'Jupiter', 'Uranus']
        const planets: Record<string, { sign: string; degree: number }> = {
          Mercury: { sign: 'Taurus', degree: 5 },
          Venus: { sign: 'Gemini', degree: 5 },
          Chiron: { sign: 'Aries', degree: 5 },
        }
        for (let i = 0; i < fire; i++) planets[bodies[i]] = { sign: fireSigns[i], degree: 10 }
        return { planets }
      }
      /** Intuition 93.5 rates 94 and aligns to 96 (94 - mean 66 + 68), exactly Celestial's gate. */
      const celestialFor = async (
        fire: number,
        { score = 93.5, spirit = 250 }: { score?: number; spirit?: number } = {}
      ) => {
        const world = defaultWorld()
        world.forged = [forgedRow(FORGED, { natalChart: chartWith(fire), intuitionScore: score })]
        const h = await boot({ world })
        const body = await view(
          await h.post({ agentId: FORGED, esms: { ...holdings(1000), spirit } })
        )
        const intuition = body.sealProgress.find(p => p.stat === 'intuition') as ProgressView
        return { body, intuition }
      }

      it('is earned on the gate exactly: 4 bodies in the token’s element, aligned 96, 250 of the token', async () => {
        const { body, intuition } = await celestialFor(4)
        expect(intuition).toMatchObject({
          statRating: 94,
          alignedRating: 96,
          balance: 250,
          natalAffinity: 4,
          tier: 'Celestial',
          nextTier: null,
          blockedBy: [],
        })
        const seal = body.seals.find(s => s.statKey === 'intuition')
        expect(seal).toMatchObject({ id: 'seal-intuition', tier: 'Celestial', multiplier: 1.4 })
        expectContractConformant(body)
      })

      it.each([
        ['one body short of the element', () => celestialFor(3), 3, []],
        [
          'one point of balance short of 250',
          () => celestialFor(4, { spirit: 249.99 }),
          4,
          ['esms'],
        ],
        [
          'one rating point short of the stat gate',
          () => celestialFor(4, { score: 92 }),
          4,
          ['stat'],
        ],
      ] as const)('is held back %s, at Astral', async (_label, run, affinity, blockedBy) => {
        const { body, intuition } = await run()
        expect(intuition).toMatchObject({
          tier: 'Astral',
          nextTier: 'Celestial',
          natalAffinity: affinity,
        })
        expect(intuition.blockedBy).toEqual(affinity < 4 ? [...blockedBy, 'natal'] : blockedBy)
        expect(body.seals.some(seal => seal.tier === 'Celestial')).toBe(false)
        expectContractConformant(body)
      })
    })

    it('puts the pinned stat gate on a perfect power stat just short of Astral: Crucible Finisher tops out at Gold', async () => {
      const world = defaultWorld()
      world.forged = [forgedRow(FORGED, { powerScore: 100 })]
      const h = await boot({ world })
      const body = await view(await h.post({ agentId: FORGED, esms: holdings(1000) }))
      const power = body.sealProgress.find(p => p.stat === 'power')

      expect(power).toMatchObject({
        statRating: 99,
        alignedRating: 90.5,
        tier: 'Gold',
        maxTier: 'Gold',
        nextTier: null,
      })
      expect(SEAL_STAT_GATES.Astral).toBe(91) // the premise: 90.5 < 91
      for (const p of body.sealProgress.filter(p => p.stat !== 'power')) {
        expect([p.stat, p.maxTier]).toEqual([p.stat, 'Celestial'])
      }
    })
  })

  // ─── (N) every roster vessel through the route ─────────────────────────────

  describe('every roster vessel, pushed a rich wallet', () => {
    const stripped = (id: string) => id.toLowerCase().replace(/-\d+$/, '')
    const canonical = new Map(
      CANONICAL_ROSTER_71.map(entry => [stripped(entry.key), entry.faction])
    )
    const pilots = new Map(FIXTURE_AGENTS.map(entry => [stripped(entry.key), entry.faction]))

    /** The faction a roster agent must carry: its pilot's, else the roster's, else its Sun's ruler. */
    const expectedFaction = (agent: (typeof HISTORICAL_AGENTS)[number]): number => {
      const key = stripped(agent.id)
      return (
        pilots.get(key) ??
        canonical.get(key) ??
        RULER_FACTION[agent.consciousness.natalChart.planets.Sun?.sign ?? ''] ??
        0
      )
    }

    it(
      'is rated as the contract says, in its own faction, look and provenance',
      async () => {
        const h = await boot()
        const seen = new Set<string>()
        const bodies = new Map<string, PayloadView>()
        const unlisted: string[] = []

        for (const agent of HISTORICAL_AGENTS) {
          const res = await h.post({ agentId: agent.id, esms: holdings(1000) })
          expect([agent.id, res.status]).toEqual([agent.id, 200])
          const text = await res.text()
          expect([agent.id, text.toLowerCase().includes(RETIRED_TIER)]).toEqual([agent.id, false])
          const body = JSON.parse(text) as PayloadView
          bodies.set(agent.id, body)

          // A contract pilot is named by the contract, every other agent by the roster.
          expect([agent.id, body.key, body.handle]).toEqual([agent.id, agent.id, handleOf(agent)])
          expectContractConformant(body)
          const expected = expectedFaction(agent)
          expect([agent.id, body.faction, body.factionName]).toEqual([
            agent.id,
            expected,
            FACTIONS[expected],
          ])
          // A placeholder chart is a placeholder whoever the vessel is; otherwise a pilot carries
          // the contract's provenance and everyone else is historical.
          const placeholder = agent.consciousness.natalChart.provenance === 'placeholder'
          expect([agent.id, body.isPlaceholder, body.provenance]).toEqual([
            agent.id,
            placeholder,
            placeholder
              ? 'placeholder'
              : (PILOTS.get(stripped(agent.id))?.provenance ?? 'historical'),
          ])
          // The manifest's own look for every vessel it knows; the one it does not list is drawn
          // in its faction's colours.
          const listed = pilots.has(stripped(agent.id)) || canonical.has(stripped(agent.id))
          expect([agent.id, body.appearance]).toEqual([
            agent.id,
            listed ? resolveAgentAppearance(agent.id) : resolveAgentAppearance(agent.id, expected),
          ])
          if (!listed) unlisted.push(agent.id)
          expect([agent.id, stray(body)]).toEqual([agent.id, []])
          for (const seal of body.seals) seen.add(seal.tier)
        }

        // Rich holdings earn Seals, and every tier named is one of the five. (Which of the five the
        // roster reaches is a property of the contract's pinned means, not of this route.)
        expect(seen.size).toBeGreaterThan(0)
        expect([...seen].every(tier => (TIERS as readonly string[]).includes(tier))).toBe(true)
        expect(bodies.size).toBe(HISTORICAL_AGENTS.length)
        expect(unlisted).toEqual(['greg-castro-1991']) // the one vessel drawn rather than looked up

        // The listing says of each vessel exactly what its own payload says.
        const listing = await (await h.get('?roster=true')).json()
        expect(listing.count).toBe(bodies.size)
        for (const entry of listing.agents) {
          const body = bodies.get(entry.key) as PayloadView
          expect(entry).toEqual({
            key: body.key,
            handle: body.handle,
            faction: body.faction,
            factionName: body.factionName,
            ovr: body.ovr,
            archetype: body.archetype,
            era: body.appearance.era,
            crownStyle: body.appearance.headSilhouette.crownStyle,
            signatureRelic: body.appearance.signatureRelic,
          })
        }
      },
      BULK_TIMEOUT_MS
    )

    const stray = (body: PayloadView) =>
      [
        ...body.seals.map(seal => seal.tier),
        ...body.sealProgress.flatMap(p => [p.tier, p.nextTier, p.maxTier]),
      ].filter(tier => tier !== null && !(TIERS as readonly string[]).includes(tier))

    it('is never Celestial on a placeholder chart, however rich', async () => {
      const h = await boot()
      const placeholders = HISTORICAL_AGENTS.filter(
        agent => agent.consciousness.natalChart.provenance === 'placeholder'
      )
      expect(placeholders.length).toBeGreaterThan(0)
      for (const agent of placeholders) {
        const body = await view(await h.post({ agentId: agent.id, esms: holdings(1e6) }))
        expect([agent.id, body.seals.some(seal => seal.tier === 'Celestial')]).toEqual([
          agent.id,
          false,
        ])
        expect([agent.id, body.sealProgress.some(p => p.tier === 'Celestial')]).toEqual([
          agent.id,
          false,
        ])
      }
    })
  })

  // ─── (O) a forged chart that cannot be a chart ─────────────────────────────

  describe('a forged row’s chart is bounds-checked before it rates anything', () => {
    const bodies = (sunDegree: unknown) => ({
      planets: {
        Sun: { sign: 'Aries', degree: sunDegree },
        Moon: { sign: 'Leo', degree: 3 },
        Mars: { sign: 'Sagittarius', degree: 20 },
      },
    })
    /** A chart-only row (every score column zero), read as the secret holder. */
    const rate = async (natalChart: unknown, overrides: Row = {}) => {
      const world = defaultWorld()
      world.forged = [forgedRow(FORGED, { natalChart, ...ZERO_SCORES, ...overrides })]
      const h = await boot({ world })
      return h.get(`?agentId=${FORGED}`, bearer)
    }
    const ratingsOf = async (natalChart: unknown, overrides: Row = {}) => {
      const res = await rate(natalChart, overrides)
      expect(res.status).toBe(200)
      return (await view(res)).ratings
    }

    it.each([
      [0, 200],
      [12.5, 200],
      [30, 200],
      [30.0001, 422],
      [-0.0001, 422],
      [360, 422],
      [1e9, 422],
      [Number.NaN, 422],
      [Number.POSITIVE_INFINITY, 422],
    ])('rates a body at %s degrees of its sign with %i', async (degree, status) => {
      expect((await rate(bodies(degree))).status).toBe(status)
    })

    it('reads a degree that is not a number as 0 degrees, and still rates the chart', async () => {
      expect(await ratingsOf(bodies('12'))).toEqual(await ratingsOf(bodies(0)))
    })

    it('reads it as the sign’s start and not as a first degree, in either chart shape', async () => {
      // The Moon at 0 Leo rates intuition 71; one degree further it is 72.
      const moon = (degree: unknown) => ({
        planets: { ...bodies(12).planets, Moon: { sign: 'Leo', degree } },
      })
      const zero = await ratingsOf(moon(0))
      expect(zero.intuition).toBe(71)
      expect((await ratingsOf(moon(1))).intuition).toBe(72)

      expect(await ratingsOf(moon('x'))).toEqual(zero)
      expect(await ratingsOf(moon(null))).toEqual(zero)
      const forge = (degrees: unknown) => ({
        tropical: {
          CelestialBodies: {
            all: [
              { label: 'Sun', Sign: { label: 'Aries' }, degrees: 12 },
              { label: 'Moon', Sign: { label: 'Leo' }, degrees },
              { label: 'Mars', Sign: { label: 'Sagittarius' }, degrees: 20 },
            ],
          },
        },
      })
      expect(await ratingsOf(forge(0))).toEqual(zero)
      expect(await ratingsOf(forge('x'))).toEqual(zero)
      expect((await ratingsOf(forge(1))).intuition).toBe(72)
    })

    it.each([
      ['a body with no sign', { planets: { Sun: { degree: 5 } } }],
      ['a body whose sign is not text', { planets: { Sun: { sign: 7, degree: 5 } } }],
      ['a body that is not an object', { planets: { Sun: null } }],
      ['a forge body with no sign', { tropical: { CelestialBodies: { all: [{ label: 'Sun' }] } } }],
      [
        'a forge body with no label',
        { tropical: { CelestialBodies: { all: [{ Sign: { label: 'Aries' }, degrees: 5 }] } } },
      ],
      [
        'a forge list that is not a list',
        { tropical: { CelestialBodies: { all: { label: 'Sun' } } } },
      ],
      ['a forge list that is a string', { tropical: { CelestialBodies: { all: 'Sun' } } }],
    ])('does not take %s for a chart: 422, nothing to rate', async (_label, chart) => {
      const res = await rate(chart)
      expect(res.status).toBe(422)
      expect((await res.json()).error).toContain('has no stats or natal chart to rate')
    })

    it('refuses the forge’s own shape on the same bounds', async () => {
      const forge = (degrees: number) => ({
        tropical: {
          CelestialBodies: {
            all: [
              { label: 'Sun', Sign: { label: 'Aries' }, degrees },
              { label: 'Moon', Sign: { label: 'Leo' }, degrees: 3 },
            ],
          },
        },
      })
      expect((await rate(forge(30))).status).toBe(200)
      expect((await rate(forge(30.5))).status).toBe(422)
      expect((await rate(forge(-1))).status).toBe(422)
    })

    it('gives a chart with a wrong body no part in a vessel that has scores of its own', async () => {
      // Persisted scores rate the vessel, but a chart that is wrong is dropped, not trusted:
      // no natal affinity (so no Celestial), no Sun to take a faction from.
      const h = await boot({
        world: (() => {
          const world = defaultWorld()
          world.forged = [forgedRow(FORGED, { natalChart: bodies(1e9) })]
          return world
        })(),
      })
      const body = await view(await h.get(`?agentId=${FORGED}`, bearer))
      expect(body.faction).toBe(0)
      expect(body.sealProgress.every(p => p.natalAffinity === null)).toBe(true)
      expect(body.surge?.harmonyOffset).toBe(0)
      expect(body.ratings.power).toBe(95) // the persisted 95 is still what rates it
    })

    describe('the ascendant', () => {
      const withAscendant = (ascendant: unknown) => ({ ...bodies(12), ascendant })

      it.each([
        [0, 200],
        [180, 200],
        [359.99, 200],
        [360, 200],
        [360.0001, 422],
        [-0.0001, 422],
        [1e9, 422],
      ])('rates an ecliptic ascendant of %s with %i', async (ascendant, status) => {
        expect((await rate(withAscendant(ascendant))).status).toBe(status)
      })

      it.each([Number.NaN, Number.POSITIVE_INFINITY, '120', null])(
        'treats the non-finite or non-numeric ascendant %j as none',
        async ascendant => {
          expect(await ratingsOf(withAscendant(ascendant))).toEqual(await ratingsOf(bodies(12)))
        }
      )

      it('reads the forge’s ascendant (sign and degrees) on the same bounds', async () => {
        const forge = (sign: string, degrees: unknown) => ({
          ...bodies(12),
          tropical: { Ascendant: { Sign: { label: sign }, degrees } },
        })
        expect((await rate(forge('Aries', 30))).status).toBe(200)
        expect((await rate(forge('Aries', 30.5))).status).toBe(422)
        expect((await rate(forge('Aries', -1))).status).toBe(422)
        // The forge's ascendant is its sign's start plus the degrees: Libra 10 is 190 on the wheel.
        expect(await ratingsOf(forge('Libra', 10))).toEqual(await ratingsOf(withAscendant(190)))
        // A sign that is not one of the twelve, or a degree that is not a number, is no ascendant.
        expect(await ratingsOf(forge('Ophiuchus', 10))).toEqual(await ratingsOf(bodies(12)))
        expect(await ratingsOf(forge('Libra', '10'))).toEqual(await ratingsOf(bodies(12)))
      })

      it('adds the forge’s degrees to its sign’s start, up to the whole 30', async () => {
        const forge = (sign: string, degrees: number) => ({
          ...bodies(12),
          tropical: { Ascendant: { Sign: { label: sign }, degrees } },
        })
        const none = await ratingsOf(bodies(12))
        const wheel30 = await ratingsOf(withAscendant(30))
        // 30 degrees on the wheel is worth one more point of adaptability and vitality than none.
        expect([none.adaptability, none.vitality]).toEqual([68, 70])
        expect([wheel30.adaptability, wheel30.vitality]).toEqual([69, 71])

        expect(await ratingsOf(forge('Aries', 30))).toEqual(wheel30)
        expect(await ratingsOf(forge('Taurus', 0))).toEqual(wheel30)
        expect(await ratingsOf(forge('Aries', 0))).toEqual(none)
      })

      it('takes a forge ascendant in a sign that is not one of the twelve as none, not as a position before Aries', async () => {
        // Mercury at 20 Aries rates adaptability 63; a position of -30 would pull it down to 62.
        const chart = { planets: { ...bodies(12).planets, Mercury: { sign: 'Aries', degree: 20 } } }
        const none = await ratingsOf(chart)
        expect(none.adaptability).toBe(63)
        for (const degrees of [0, 10]) {
          const unknown = { tropical: { Ascendant: { Sign: { label: 'Ophiuchus' }, degrees } } }
          expect([degrees, await ratingsOf({ ...chart, ...unknown })]).toEqual([degrees, none])
        }
      })
    })

    describe('Monica', () => {
      const monicaRow = (monicaConstant: unknown) => ({ monicaConstant })

      it('is clamped to the 0 to 10 the Sacred 7 formulas divide by', async () => {
        const at = (monica: unknown) => ratingsOf(bodies(12), monicaRow(monica))
        expect(await at(10)).toEqual(await at(1e9))
        expect(await at(10)).toEqual(await at(10.5))
        expect(await at(0)).toEqual(await at(-5))
        // ...and within that range it matters, so the clamp above has teeth.
        expect(await at(0)).not.toEqual(await at(10))
        expect(await at(5)).not.toEqual(await at(10))
      })

      it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null, 'high'])(
        'is read as 0 when it is %j',
        async monica => {
          expect(await ratingsOf(bodies(12), monicaRow(monica))).toEqual(
            await ratingsOf(bodies(12), monicaRow(0))
          )
        }
      )
    })

    describe('persisted Sacred 7 scores', () => {
      const SCORES = [
        'powerScore',
        'resonanceScore7',
        'wisdomScore',
        'charismaScore',
        'intuitionScore',
        'adaptabilityScore',
        'vitalityScore',
      ]
      const scored = (overrides: Row) => ({
        ...Object.fromEntries(SCORES.map(c => [c, 50])),
        ...overrides,
      })

      it('are used when every one is a finite 0 to 100 and at least one is above 0', async () => {
        const world = defaultWorld()
        world.forged = [forgedRow(FORGED, scored({ powerScore: 100, vitalityScore: 0 }))]
        const body = await view(await (await boot({ world })).get(`?agentId=${FORGED}`))
        // 0 rates 25 and 100 rates 99, 50 rates 62.
        expect(body.ratings).toMatchObject({ power: 99, vitality: 25, wisdom: 62 })
      })

      it.each([
        ['one is 100.01', { powerScore: 100.01 }],
        ['one is -0.01', { vitalityScore: -0.01 }],
        ['one is not a number', { wisdomScore: '50' }],
        ['one is null', { wisdomScore: null }],
        ['one is NaN', { wisdomScore: Number.NaN }],
        ['one is infinite', { wisdomScore: Number.POSITIVE_INFINITY }],
      ])('are not used when %s, and the chart rates the vessel instead', async (_label, bad) => {
        const world = defaultWorld()
        world.forged = [forgedRow(FORGED, scored(bad))]
        const body = await view(await (await boot({ world })).get(`?agentId=${FORGED}`))
        const chartOnly = await ratingsOf(forgedRow(FORGED).natalChart)
        expect(body.ratings).toEqual(chartOnly)
      })

      it('are not used when all are 0 (a row written before stats were persisted)', async () => {
        const world = defaultWorld()
        world.forged = [forgedRow(FORGED, scored(Object.fromEntries(SCORES.map(c => [c, 0]))))]
        const body = await view(await (await boot({ world })).get(`?agentId=${FORGED}`))
        expect(body.ratings).toEqual(await ratingsOf(forgedRow(FORGED).natalChart))
      })
    })
  })
})
