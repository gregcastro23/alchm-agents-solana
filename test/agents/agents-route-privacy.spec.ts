// @vitest-environment node
import { NextRequest } from 'next/server'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OWNER_FREE_TEXT,
  chartKeyPaths,
  forgeVessel,
  keyPaths,
  numberLeaves,
  type ForgedVessel,
} from './support/forge'

const TEST_SECRET = 'test-internal-api-secret-12345'

const sampleForgedRow1 = {
  agentId: 'agent-forged-user1',
  name: 'Adept Astra',
  title: 'The Alchemist',
  birthDate: new Date('1991-03-14T04:07:00.000Z'),
  birthTime: '04:07',
  birthLocation: {
    lat: 64.1466,
    lon: -21.9426,
    name: 'Reykjavik',
  },
  historicalEra: 'user_created',
  craftedBy: 'philosopher-stone-user',
  isActive: true,
  consciousnessLevel: 'Illuminated',
  monicaConstant: 1.618,
  dominantElement: 'Water',
  dominantModality: 'Mutable',
  signature: 'Standard',
  personalityCore: { trait: 'curious' },
  personalityShadows: [],
  personalityGifts: [],
  personalityChallenges: [],
  currentMood: 'contemplative',
  evolutionStage: 1,
  specialty: 'Celestial Transmutation',
  wisdomDomains: ['Alchemy'],
  teachingStyle: 'Socratic',
  resonanceType: 'Resonant',
  uniquePower: 'Aetheric Spark',
  avatar: '/avatars/astra.png',
  color: '#9333ea',
  symbol: '☿',
  aura: null,
  conversations: 5,
  wisdomShared: 12,
  resonanceScore: 0.85,
  evolutionPoints: 42,
  lastActive: new Date('2026-10-18T00:00:00.000Z'),
  level: 3,
  xp: 350,
  evolutionValues: {},
  evTotal: 10,
  ivSnapshot: null,
  natalChart: {
    planets: {
      Sun: { sign: 'Pisces', degree: 23.45 },
      Moon: { sign: 'Cancer', degree: 12.1 },
      Mercury: { sign: 'Aquarius', degree: 5.6 },
    },
    ascendant: 62.4,
    aspects: [{ planet1: 'Sun', planet2: 'Moon', type: 'Trine', orb: 1.2 }],
    houses: { ASC: 62.4 },
  },
}

const sampleForgedRow2 = {
  agentId: 'agent-forged-user2',
  name: 'Sol Invictus',
  title: 'Solar Pilot',
  birthDate: new Date('1985-07-20T12:00:00.000Z'),
  birthTime: '12:00',
  birthLocation: {
    lat: 41.9028,
    lon: 12.4964,
    name: 'Rome',
  },
  historicalEra: 'user_created',
  craftedBy: 'philosopher-stone-user',
  isActive: true,
  consciousnessLevel: 'Transcendent',
  monicaConstant: 2.718,
  dominantElement: 'Fire',
  dominantModality: 'Fixed',
  signature: 'Solar',
  personalityCore: {},
  personalityShadows: [],
  personalityGifts: [],
  personalityChallenges: [],
  currentMood: 'radiant',
  evolutionStage: 2,
  specialty: 'Solar Radiance',
  wisdomDomains: ['Hermeticism'],
  teachingStyle: 'Direct',
  resonanceType: 'Solar',
  uniquePower: 'Corona Flare',
  avatar: '/avatars/sol.png',
  color: '#f59e0b',
  symbol: '☉',
  aura: null,
  conversations: 10,
  wisdomShared: 40,
  resonanceScore: 0.95,
  evolutionPoints: 100,
  lastActive: new Date('2026-10-19T00:00:00.000Z'),
  level: 5,
  xp: 1200,
  evolutionValues: {},
  evTotal: 25,
  ivSnapshot: null,
  natalChart: {
    tropical: {
      CelestialBodies: {
        all: [
          { label: 'Sun', Sign: { label: 'Leo' }, degrees: 27.8 },
          { label: 'Moon', Sign: { label: 'Aries' }, degrees: 14.2 },
        ],
      },
      Ascendant: { Sign: { label: 'Scorpio' }, degrees: 15.0 },
    },
  },
}

/**
 * Rows written before the writer was fixed still carry `aura.sourceCharts` (a second, complete
 * copy of the owner's chart) until `scripts/scrub-forged-aura-charts.ts` has run against that
 * database, so the readers must hold on those rows too.
 */
function legacyAuraOf(row: Record<string, any>) {
  return {
    ...row.aura,
    sourceCharts: [
      { 'Alchemy Effects': { 'Total Spirit': 4 }, transits: {}, activatedHouses: [] },
      structuredClone(row.natalChart),
    ],
  }
}

describe('GET /api/agents privacy & birth data redaction', () => {
  const originalEnv = process.env.INTERNAL_API_SECRET

  // The hand-built rows above used `aura: null` and a toy `personalityCore`, which is exactly
  // why the first redaction could not see the chart in `aura` or the owner's own words in the
  // core. Their aura and core are now what the REAL create-agent writer persists (the aura in
  // its pre-fix shape, which unscrubbed rows still have).
  beforeAll(async () => {
    const real = await forgeVessel()
    for (const row of [sampleForgedRow1, sampleForgedRow2]) {
      Object.assign(row, {
        aura: legacyAuraOf(real.row),
        personalityCore: structuredClone(real.row.personalityCore),
      })
    }
  })

  beforeEach(() => {
    vi.resetModules()
    process.env.INTERNAL_API_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env.INTERNAL_API_SECRET = originalEnv
    vi.restoreAllMocks()
  })

  it('redacts exact birth date, time, coordinates, and full chart for anonymous callers', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        historical_agents: {
          findMany: vi.fn().mockResolvedValue([sampleForgedRow1, sampleForgedRow2]),
        },
        created_agents: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    }))
    vi.doMock('@/lib/backend', () => ({
      backend: { agents: { list: vi.fn().mockResolvedValue([]), create: vi.fn() } },
    }))
    vi.doMock('@/lib/historical-agents-db', () => ({ HistoricalAgentsService: {} }))
    vi.doMock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))

    const { GET } = await import('@/app/api/agents/route')
    const res = await GET(new NextRequest('http://localhost:3000/api/agents'))
    expect(res.status).toBe(200)

    const json: any = await res.json()
    expect(json.success).toBe(true)

    const forged1 = json.agents.find((a: any) => a.id === sampleForgedRow1.agentId)
    expect(forged1).toBeDefined()
    expect(forged1.isUserCreated).toBe(true)

    // Redacted birthData: only location name remains
    expect(forged1.birthData.date).toBeUndefined()
    expect(forged1.birthData.time).toBeUndefined()
    expect(forged1.birthData.location.lat).toBeUndefined()
    expect(forged1.birthData.location.lon).toBeUndefined()
    expect(forged1.birthData.location.latitude).toBeUndefined()
    expect(forged1.birthData.location.longitude).toBeUndefined()
    expect(forged1.birthData.location.name).toBe('Reykjavik')

    // Redacted natalChart: only Sun sign remains for gallery faction filter
    expect(forged1.consciousness.natalChart.planets.Sun.sign).toBe('Pisces')
    expect(forged1.consciousness.natalChart.planets.Sun.degree).toBeUndefined()
    expect(forged1.consciousness.natalChart.planets.Moon).toBeUndefined()
    expect(forged1.consciousness.natalChart.planets.Mercury).toBeUndefined()
    expect(forged1.consciousness.natalChart.ascendant).toBeUndefined()
    expect(forged1.consciousness.natalChart.aspects).toBeUndefined()
    expect(forged1.consciousness.natalChart.houses).toBeUndefined()

    // Test forged2 with tropical format
    const forged2 = json.agents.find((a: any) => a.id === sampleForgedRow2.agentId)
    expect(forged2).toBeDefined()
    expect(forged2.birthData.date).toBeUndefined()
    expect(forged2.birthData.time).toBeUndefined()
    expect(forged2.birthData.location.lat).toBeUndefined()
    expect(forged2.birthData.location.name).toBe('Rome')
    expect(forged2.consciousness.natalChart.planets.Sun.sign).toBe('Leo')
    expect(forged2.consciousness.natalChart.planets.Sun.degree).toBeUndefined()
    expect(forged2.consciousness.natalChart.tropical).toBeUndefined()

    // The aura and the personality core carry no chart and none of the owner's words
    for (const forged of [forged1, forged2]) {
      expect(chartKeyPaths(forged)).toEqual([])
      expect(forged.appearance.aura).toEqual({})
      expect(Object.keys(forged.personality.core).sort()).toEqual(['essence', 'temperament'])
      for (const text of Object.values(OWNER_FREE_TEXT)) {
        expect(JSON.stringify(forged)).not.toContain(text)
      }
    }

    // Canonical historical agents remain unredacted
    const canonical = json.agents.find((a: any) => !a.isUserCreated)
    expect(canonical).toBeDefined()
    expect(canonical.birthData).toBeDefined()
    expect(canonical.birthData.date).toBeDefined()
    expect(canonical.consciousness.natalChart).toBeDefined()
  })

  it('serves full birth data and full chart to internal service holding bearer secret', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        historical_agents: {
          findMany: vi.fn().mockResolvedValue([sampleForgedRow1]),
        },
        created_agents: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    }))
    vi.doMock('@/lib/backend', () => ({
      backend: { agents: { list: vi.fn().mockResolvedValue([]), create: vi.fn() } },
    }))
    vi.doMock('@/lib/historical-agents-db', () => ({ HistoricalAgentsService: {} }))
    vi.doMock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))

    const { GET } = await import('@/app/api/agents/route')
    const req = new NextRequest('http://localhost:3000/api/agents', {
      headers: {
        Authorization: `Bearer ${TEST_SECRET}`,
      },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const json: any = await res.json()
    const forged = json.agents.find((a: any) => a.id === sampleForgedRow1.agentId)
    expect(forged).toBeDefined()

    // Unredacted birthData
    expect(new Date(forged.birthData.date).toISOString()).toBe(
      sampleForgedRow1.birthDate.toISOString()
    )
    expect(forged.birthData.time).toBe('04:07')
    expect(forged.birthData.location.lat).toBe(64.1466)
    expect(forged.birthData.location.lon).toBe(-21.9426)
    expect(forged.birthData.location.name).toBe('Reykjavik')

    // Unredacted natalChart
    expect(forged.consciousness.natalChart.planets.Sun.sign).toBe('Pisces')
    expect(forged.consciousness.natalChart.planets.Sun.degree).toBe(23.45)
    expect(forged.consciousness.natalChart.planets.Moon.sign).toBe('Cancer')
    expect(forged.consciousness.natalChart.ascendant).toBe(62.4)
    expect(forged.consciousness.natalChart.aspects).toHaveLength(1)

    // The service holder keeps the aura and the core as stored
    expect(forged.appearance.aura).toEqual(JSON.parse(JSON.stringify(sampleForgedRow1.aura)))
    expect(forged.personality.core.userProvidedContext).toEqual(OWNER_FREE_TEXT)

    // ...and the answer must not be shared with anyone else
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('serves full birth data and full chart to admin users', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        historical_agents: {
          findMany: vi.fn().mockResolvedValue([sampleForgedRow1]),
        },
        created_agents: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        // requireAdmin re-reads the role from the database: the session claim alone is not enough
        users: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'admin-user-id',
            email: 'admin@example.com',
            name: 'Admin',
            role: 'admin',
          }),
        },
      },
    }))
    vi.doMock('@/lib/backend', () => ({
      backend: { agents: { list: vi.fn().mockResolvedValue([]), create: vi.fn() } },
    }))
    vi.doMock('@/lib/historical-agents-db', () => ({ HistoricalAgentsService: {} }))
    vi.doMock('@/lib/auth', () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: 'admin-user-id', role: 'admin', email: 'admin@example.com' },
      }),
    }))

    const { GET } = await import('@/app/api/agents/route')
    const res = await GET(new NextRequest('http://localhost:3000/api/agents'))
    expect(res.status).toBe(200)

    const json: any = await res.json()
    const forged = json.agents.find((a: any) => a.id === sampleForgedRow1.agentId)
    expect(forged).toBeDefined()
    expect(forged.birthData.date).toBeDefined()
    expect(forged.birthData.location.lat).toBe(64.1466)
    expect(forged.consciousness.natalChart.ascendant).toBe(62.4)
  })

  it('serves full birth data to vessel creator and redacts other creators vessels', async () => {
    const creatorUserId = 'user-creator-astra'

    vi.doMock('@/lib/db', () => ({
      prisma: {
        historical_agents: {
          findMany: vi.fn().mockResolvedValue([sampleForgedRow1, sampleForgedRow2]),
        },
        created_agents: {
          findMany: vi.fn().mockImplementation(async (args: any) => {
            if (args?.where?.creatorId === creatorUserId) {
              return [
                {
                  id: 'created-cuid-1',
                  creatorId: creatorUserId,
                  blueprint: { agentId: sampleForgedRow1.agentId },
                  momentChart: null,
                },
              ]
            }
            return []
          }),
        },
      },
    }))
    vi.doMock('@/lib/backend', () => ({
      backend: { agents: { list: vi.fn().mockResolvedValue([]), create: vi.fn() } },
    }))
    vi.doMock('@/lib/historical-agents-db', () => ({ HistoricalAgentsService: {} }))
    vi.doMock('@/lib/auth', () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: creatorUserId, role: 'user', email: 'creator@example.com' },
      }),
    }))

    const { GET } = await import('@/app/api/agents/route')
    const res = await GET(new NextRequest('http://localhost:3000/api/agents'))
    expect(res.status).toBe(200)

    const json: any = await res.json()

    // Creator own vessel is UNREDACTED
    const ownForged = json.agents.find((a: any) => a.id === sampleForgedRow1.agentId)
    expect(ownForged).toBeDefined()
    expect(ownForged.birthData.date).toBeDefined()
    expect(ownForged.birthData.time).toBe('04:07')
    expect(ownForged.birthData.location.lat).toBe(64.1466)
    expect(ownForged.consciousness.natalChart.ascendant).toBe(62.4)

    // Other creator vessel is REDACTED
    const otherForged = json.agents.find((a: any) => a.id === sampleForgedRow2.agentId)
    expect(otherForged).toBeDefined()
    expect(otherForged.birthData.date).toBeUndefined()
    expect(otherForged.birthData.time).toBeUndefined()
    expect(otherForged.birthData.location.lat).toBeUndefined()
    expect(otherForged.birthData.location.name).toBe('Rome')
    expect(otherForged.consciousness.natalChart.planets.Sun.sign).toBe('Leo')
    expect(otherForged.consciousness.natalChart.planets.Sun.degree).toBeUndefined()
  })
})

// ─── A vessel forged through the REAL writer ────────────────────────────────────────────────
//
// The fixtures above are hand-built. These are not: the row is whatever `/api/create-agent` and
// `HistoricalAgentsService.createAgent` hand to Prisma, so the spec cannot drift from the writer.

const CREATOR = 'user-creator-wren'
const STRANGER = 'user-stranger-9'
const DB_ADMIN = { id: 'user-db-admin', email: 'admin@example.test', name: 'Admin', role: 'admin' }

interface World {
  rows?: any[]
  backendRows?: any[]
  backendList?: ReturnType<typeof vi.fn>
  planetary?: ReturnType<typeof vi.fn>
  session?: any
  createdAgents?: any[]
  dbUser?: any
}

function mockWorld(world: World) {
  vi.doMock('@/lib/db', () => ({
    prisma: {
      historical_agents: { findMany: vi.fn().mockResolvedValue(world.rows ?? []) },
      created_agents: {
        findMany: vi.fn(async (args: any) =>
          (world.createdAgents ?? []).filter(r => r.creatorId === args?.where?.creatorId)
        ),
      },
      users: { findFirst: vi.fn().mockResolvedValue(world.dbUser ?? null) },
    },
  }))
  vi.doMock('@/lib/backend', () => ({
    backend: {
      agents: {
        list: world.backendList ?? vi.fn().mockResolvedValue(world.backendRows ?? []),
        create: vi.fn(),
      },
    },
  }))
  vi.doMock('@/lib/historical-agents-db', () => ({
    HistoricalAgentsService: {
      getPlanetaryDegreeAgents: world.planetary ?? vi.fn().mockResolvedValue([]),
    },
  }))
  vi.doMock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(world.session ?? null) }))
}

async function getAgents(world: World, path = '/api/agents', headers: Record<string, string> = {}) {
  mockWorld(world)
  const { GET } = await import('@/app/api/agents/route')
  const res = await GET(new NextRequest(`http://localhost:3000${path}`, { headers }))
  return { res, json: (await res.json()) as any }
}

/** The shape of Railway's `schemas.Agent`: no natalChart, no aura, no craftedBy. */
function railwayRowOf(row: Record<string, any>, overrides: Record<string, unknown> = {}) {
  const keep = [
    'agentId',
    'name',
    'title',
    'birthTime',
    'birthLocation',
    'consciousnessLevel',
    'monicaConstant',
    'dominantElement',
    'dominantModality',
    'specialty',
    'wisdomDomains',
    'avatar',
    'color',
    'symbol',
    'personalityCore',
    'personalityShadows',
    'personalityGifts',
    'personalityChallenges',
    'historicalEra',
    'currentMood',
    'evolutionStage',
    'conversations',
    'wisdomShared',
    'resonanceScore',
    'evolutionPoints',
    'level',
    'xp',
    'evolutionValues',
    'evTotal',
    'ivSnapshot',
  ]
  return {
    ...Object.fromEntries(keep.map(k => [k, row[k]])),
    birthDate: row.birthDate.toISOString().replace('Z', ''),
    birthYear: row.birthDate.getUTCFullYear(),
    lastActive: row.lastActive.toISOString(),
    ...overrides,
  }
}

const NOT_ENTITLED: Array<[string, { headers?: Record<string, string>; world?: World }]> = [
  ['anonymous', {}],
  [
    'wrong bearer and wrong X-Internal-Secret',
    { headers: { authorization: 'Bearer nope', 'x-internal-secret': 'nope' } },
  ],
  ['signed-in stranger', { world: { session: { user: { id: STRANGER, role: 'user' } } } }],
  [
    'a session that claims admin which the database has never heard of',
    { world: { session: { user: { id: 'user-fake-admin', role: 'admin' } }, dbUser: null } },
  ],
  [
    'a session that claims admin whom the database knows as a plain user',
    {
      world: {
        session: { user: { id: 'user-stale-admin', role: 'admin' } },
        dbUser: { ...DB_ADMIN, id: 'user-stale-admin', role: 'user' },
      },
    },
  ],
]

describe('GET /api/agents: a vessel forged through the real writer', () => {
  const originalEnv = process.env.INTERNAL_API_SECRET
  let vessel: ForgedVessel
  /** The same vessel as a row written BEFORE the writer fix holds it (aura.sourceCharts present). */
  let legacyRow: Record<string, any>
  let sunSign: string

  beforeAll(async () => {
    vessel = await forgeVessel({ creatorId: CREATOR })
    legacyRow = { ...vessel.row, aura: legacyAuraOf(vessel.row) }
    const sun = vessel.row.natalChart.tropical.CelestialBodies.all.find(
      (b: any) => b.label === 'Sun'
    )
    sunSign = sun.Sign.label
  })

  beforeEach(() => {
    vi.resetModules()
    process.env.INTERNAL_API_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env.INTERNAL_API_SECRET = originalEnv
    vi.restoreAllMocks()
  })

  it('the fixture is the real writer output: a chart in natalChart, scalars in aura, the owner words in the core', () => {
    expect(vessel.row.craftedBy).toBe('philosopher-stone-user')
    expect(vessel.row.historicalEra).toBe('user_created')
    expect(chartKeyPaths(vessel.row.natalChart).length).toBeGreaterThan(20)
    expect(Object.keys(vessel.row.aura).sort()).toEqual(['consciousness', 'monicaConstant'])
    expect(vessel.row.personalityCore.userProvidedContext).toEqual(OWNER_FREE_TEXT)
    // ...and the pre-fix shape really did carry the owner's complete chart
    expect(chartKeyPaths(legacyRow.aura).length).toBeGreaterThan(20)
  })

  /** What a stranger may learn about the vessel, and nothing else. */
  function expectPublicView(agent: any, row: Record<string, any>) {
    // No key anywhere in the vessel's JSON is one that only a birth chart carries
    expect(chartKeyPaths(agent)).toEqual([])
    for (const forbidden of ['Ascendant', 'Houses', 'CelestialBodies', 'sourceCharts', 'degrees']) {
      expect(keyPaths(agent).filter(p => p.split('.').pop() === forbidden)).toEqual([])
    }
    // No free text the owner typed, in any field
    const serialized = JSON.stringify(agent)
    for (const text of Object.values(OWNER_FREE_TEXT)) expect(serialized).not.toContain(text)
    // No private number: neither a coordinate nor any degree of the stored chart
    const numbers = numberLeaves(agent)
    for (const secret of [
      row.birthLocation.lat,
      row.birthLocation.lon,
      ...numberLeaves(row.natalChart).filter(n => !Number.isInteger(n)),
    ]) {
      expect(numbers).not.toContain(secret)
    }
    expect(serialized).not.toContain(row.birthTime)

    // Exactly what is public by design
    expect(agent.name).toBe('Verdant Wren')
    expect(agent.title).toBe('Garden alchemy')
    expect(agent.birthData).toEqual({ location: { name: 'User Location' } })
    expect(agent.consciousness.natalChart).toEqual({ planets: { Sun: { sign: sunSign } } })
    expect(agent.appearance.aura).toEqual({})
    expect(agent.appearance.avatar).toBe('/avatars/user-created/default.png')
    expect(agent.personality.core).toEqual({
      essence: 'Garden alchemy',
      temperament: row.personalityCore.temperament,
    })
    expect(agent.isUserCreated).toBe(true)
  }

  for (const [storedAs, rowOf] of [
    ['as the fixed writer stores it', () => vessel.row],
    ['as an unscrubbed row still holds it', () => legacyRow],
  ] as const) {
    describe(storedAs, () => {
      for (const [who, caller] of NOT_ENTITLED) {
        it(`default roster, ${who}: the public view only`, async () => {
          const row = rowOf()
          const { res, json } = await getAgents(
            { ...caller.world, rows: [row] },
            '/api/agents',
            caller.headers
          )
          expect(res.status).toBe(200)
          const agent = json.agents.find((a: any) => a.id === vessel.agentId)
          expect(agent).toBeDefined()
          expectPublicView(agent, row)
        })

        it(`?source=backend, ${who}: the public view only`, async () => {
          const row = rowOf()
          const { res, json } = await getAgents(
            { ...caller.world, backendRows: [railwayRowOf(row)] },
            '/api/agents?source=backend',
            caller.headers
          )
          expect(res.status).toBe(200)
          const agent = json.agents.find((a: any) => a.id === vessel.agentId)
          expect(agent).toBeDefined()
          // a Railway row has no natalChart or aura at all; the rest is the same
          expect(chartKeyPaths(agent)).toEqual([])
          for (const text of Object.values(OWNER_FREE_TEXT)) {
            expect(JSON.stringify(agent)).not.toContain(text)
          }
          expect(agent.birthData).toEqual({ location: { name: 'User Location' } })
          expect(agent.personality.core).toEqual({
            essence: 'Garden alchemy',
            temperament: row.personalityCore.temperament,
          })
          expect(numberLeaves(agent)).not.toContain(row.birthLocation.lat)
          expect(numberLeaves(agent)).not.toContain(row.birthLocation.lon)
        })

        it(`category=planetary, ${who}: a person's row is projected here too`, async () => {
          const row = rowOf()
          const { json } = await getAgents(
            { ...caller.world, planetary: vi.fn().mockResolvedValue([row]) },
            '/api/agents?category=planetary',
            caller.headers
          )
          expectPublicView(json.agents[0], row)
        })
      }

      it('the creator keeps everything, on the default roster', async () => {
        const row = rowOf()
        const { json } = await getAgents({
          rows: [row],
          session: { user: { id: CREATOR, role: 'user' } },
          createdAgents: [vessel.createdAgentsRow],
        })
        const agent = json.agents.find((a: any) => a.id === vessel.agentId)
        expect(agent.birthData.location.lat).toBe(47.6062)
        expect(agent.birthData.location.lon).toBe(-122.3321)
        expect(agent.birthData.time).toBe('05:41')
        expect(agent.consciousness.natalChart).toEqual(JSON.parse(JSON.stringify(row.natalChart)))
        expect(agent.personality.core.userProvidedContext).toEqual(OWNER_FREE_TEXT)
        expect(agent.appearance.aura).toEqual(JSON.parse(JSON.stringify(row.aura)))
      })

      it('the holder of INTERNAL_API_SECRET keeps everything, however the secret is presented', async () => {
        for (const headers of [
          { authorization: `Bearer ${TEST_SECRET}` },
          { 'x-internal-secret': TEST_SECRET },
        ]) {
          vi.resetModules()
          const row = rowOf()
          const { json } = await getAgents({ rows: [row] }, '/api/agents', headers)
          const agent = json.agents.find((a: any) => a.id === vessel.agentId)
          expect(agent.birthData.location.lat).toBe(47.6062)
          expect(agent.consciousness.natalChart.tropical.Ascendant).toBeDefined()
          expect(agent.personality.core.userProvidedContext).toEqual(OWNER_FREE_TEXT)
          expect(agent.appearance.aura).toEqual(JSON.parse(JSON.stringify(row.aura)))
        }
      })

      it('a database-verified admin keeps everything', async () => {
        const row = rowOf()
        const { json } = await getAgents({
          rows: [row],
          session: { user: { id: DB_ADMIN.id, email: DB_ADMIN.email, role: 'admin' } },
          dbUser: DB_ADMIN,
        })
        const agent = json.agents.find((a: any) => a.id === vessel.agentId)
        expect(agent.birthData.location.lon).toBe(-122.3321)
        expect(agent.personality.core.lifeStory).toBe(OWNER_FREE_TEXT.lifeStory)
      })

      it('?source=backend: the creator and the secret holder keep the birth data and the core', async () => {
        for (const world of [
          {
            session: { user: { id: CREATOR, role: 'user' } },
            createdAgents: [vessel.createdAgentsRow],
          },
          {},
        ]) {
          vi.resetModules()
          const headers = 'session' in world ? {} : { authorization: `Bearer ${TEST_SECRET}` }
          const { json } = await getAgents(
            { ...world, backendRows: [railwayRowOf(rowOf())] },
            '/api/agents?source=backend',
            headers
          )
          const agent = json.agents.find((a: any) => a.id === vessel.agentId)
          expect(agent.birthData.location.lat).toBe(47.6062)
          expect(agent.birthData.time).toBe('05:41')
          expect(agent.personality.core.userProvidedContext).toEqual(OWNER_FREE_TEXT)
        }
      })
    })
  }

  it("another creator's vessel stays redacted for a signed-in creator of a different vessel", async () => {
    const { json } = await getAgents({
      rows: [vessel.row],
      session: { user: { id: 'user-someone-else', role: 'user' } },
      createdAgents: [
        {
          id: 'c-2',
          creatorId: 'user-someone-else',
          blueprint: { agentId: 'agent-other' },
          momentChart: null,
        },
      ],
    })
    expectPublicView(
      json.agents.find((a: any) => a.id === vessel.agentId),
      vessel.row
    )
  })

  describe('a Railway row says nothing about who it belongs to', () => {
    const PYTHON_PERSON = (row: Record<string, any>) =>
      railwayRowOf(row, {
        agentId: 'agent-created-through-python-post',
        // what backend/utils.py:determine_historical_era stamps on any 1800+ birth
        historicalEra: 'modern_pre1950',
        personalityCore: { essence: 'A person', expression: OWNER_FREE_TEXT.aboutYourself },
      })

    it('a person created through the Python API (era modern_pre1950) is redacted for a stranger', async () => {
      const { json } = await getAgents(
        { backendRows: [PYTHON_PERSON(vessel.row)] },
        '/api/agents?source=backend'
      )
      const agent = json.agents[0]
      expect(agent.birthData).toEqual({ location: { name: 'User Location' } })
      expect(JSON.stringify(agent)).not.toContain(OWNER_FREE_TEXT.aboutYourself)
      expect(numberLeaves(agent)).not.toContain(47.6062)
    })

    it('...and shown in full to the secret holder', async () => {
      const { json } = await getAgents(
        { backendRows: [PYTHON_PERSON(vessel.row)] },
        '/api/agents?source=backend',
        { authorization: `Bearer ${TEST_SECRET}` }
      )
      expect(json.agents[0].birthData.location.lat).toBe(47.6062)
    })

    it('a canonical figure and a sky-generated agent stay public on this path', async () => {
      const canonicalId = HISTORICAL_AGENTS[0].id
      const { json } = await getAgents(
        {
          backendRows: [
            railwayRowOf(vessel.row, { agentId: canonicalId, historicalEra: 'Antiquity' }),
            railwayRowOf(vessel.row, { agentId: 'moon-agent-0123', historicalEra: 'planetary' }),
          ],
        },
        '/api/agents?source=backend'
      )
      for (const agent of json.agents) {
        expect(agent.birthData.time).toBe('05:41')
        expect(agent.birthData.location.lat).toBe(47.6062)
      }
    })
  })

  it('a planetary degree agent is not a person: its row is served as stored', async () => {
    const planetaryRow = {
      ...vessel.row,
      agentId: 'planetary-sun-0001',
      craftedBy: 'planetary-seed',
      historicalEra: 'planetary',
    }
    const { json } = await getAgents(
      { planetary: vi.fn().mockResolvedValue([planetaryRow]) },
      '/api/agents?category=planetary'
    )
    expect(json.agents[0].birthData.location.lat).toBe(47.6062)
    expect(json.agents[0].consciousness.natalChart.tropical.Ascendant).toBeDefined()
  })

  describe('caching: the answer varies by caller', () => {
    // Built lazily: `vessel` only exists once `beforeAll` has forged it.
    const entitledCallers: Array<
      [string, () => { headers?: Record<string, string>; world?: World }]
    > = [
      ['the secret holder', () => ({ headers: { authorization: `Bearer ${TEST_SECRET}` } })],
      [
        'the creator',
        () => ({
          world: {
            session: { user: { id: CREATOR, role: 'user' } },
            createdAgents: [vessel.createdAgentsRow],
          },
        }),
      ],
      [
        'a database-verified admin',
        () => ({
          world: { session: { user: { id: DB_ADMIN.id, role: 'admin' } }, dbUser: DB_ADMIN },
        }),
      ],
    ]

    for (const path of [
      '/api/agents',
      '/api/agents?source=backend',
      '/api/agents?category=planetary',
    ]) {
      for (const [who, callerOf] of entitledCallers) {
        it(`${path}, ${who}: private, no-store`, async () => {
          const caller = callerOf()
          const { res } = await getAgents(
            { rows: [vessel.row], backendRows: [], ...caller.world },
            path,
            caller.headers
          )
          expect(res.headers.get('cache-control')).toBe('private, no-store')
          expect(res.headers.get('cdn-cache-control')).toBe('no-store')
        })
      }

      for (const [who, caller] of NOT_ENTITLED.slice(0, 2)) {
        it(`${path}, ${who}: never marked private, so the shared cache keeps working for strangers`, async () => {
          const { res } = await getAgents(
            { rows: [vessel.row], ...caller.world },
            path,
            caller.headers
          )
          expect(res.headers.get('cache-control') ?? '').not.toMatch(/private|no-store/)
          expect(res.headers.get('cdn-cache-control')).toBeNull()
        })
      }

      it(`${path}: every response varies by the credentials that change it`, async () => {
        const callers = [NOT_ENTITLED[0][1], entitledCallers[0][1]()]
        for (const caller of callers) {
          vi.resetModules()
          const { res } = await getAgents(
            { rows: [vessel.row], ...caller.world },
            path,
            caller.headers
          )
          const vary = (res.headers.get('vary') ?? '').split(',').map(v => v.trim().toLowerCase())
          expect(vary).toEqual(
            expect.arrayContaining(['authorization', 'cookie', 'x-internal-secret'])
          )
        }
      })
    }
  })

  describe('failures do not echo the datastore to the caller', () => {
    const LEAK =
      'Invalid `prisma.historical_agents.findMany()` invocation in /srv/app/lib/historical-agents-db.ts:480:52 Authentication failed against database server at db.internal.example:5432'
    const expectNoLeak = (body: unknown) => {
      const text = JSON.stringify(body)
      for (const fragment of [
        'Invalid',
        '/srv/app',
        'db.internal',
        'Authentication failed',
        'findMany',
      ]) {
        expect(text).not.toContain(fragment)
      }
    }

    it('category=planetary: a fixed message and a 503, not the exception text', async () => {
      const { res, json } = await getAgents(
        { planetary: vi.fn().mockRejectedValue(new Error(LEAK)) },
        '/api/agents?category=planetary'
      )
      expect(res.status).toBe(503)
      expect(json).toEqual({
        success: false,
        agents: [],
        total: 0,
        error: 'Planetary agents are temporarily unavailable',
      })
      expectNoLeak(json)
      expect(res.headers.get('vary')).toContain('Cookie')
    })

    it('source=backend: the demo fallback says why in a fixed message only', async () => {
      const { res, json } = await getAgents(
        { backendList: vi.fn().mockRejectedValue(new Error(LEAK)) },
        '/api/agents?source=backend'
      )
      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.agents.length).toBeGreaterThan(0)
      expect(json.error).toBe('Backend unavailable, falling back to demo data')
      expectNoLeak(json)
    })
  })
})
