// @vitest-environment node
/**
 * The Pentacles controller must never publish a forged vessel's birth data.
 *
 * `seed_agent_player` writes `birth_unix`, `birth_lat`, `birth_lon`, `time_known`, all ten
 * placements, the ascendant and the midheaven to the SpacetimeDB `agent_chart` table, which
 * Pentacles clients can read. For a user-created vessel that is a person's own birth moment and
 * place. The controller used to seed every `isActive` row of `historical_agents`.
 *
 * The real `PentaclesAgentService` and the real `PentaclesBackendClient` run here. Only Prisma
 * (an in-memory table) and the network (`fetch`) are replaced, so every assertion about "what
 * left the process" reads the actual reducer request bodies.
 *
 * `backend/package.json` names jest, but there is no jest config in that package, and CI never
 * runs it: `backend/src` is exercised from this root suite, with winston aliased to a stub (see
 * vitest.config.ts and test/pentacles/backend-strategy.test.ts).
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isUserCreatedAgentRow } from '@/lib/agents/forged-privacy'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { CANONICAL_ROSTER_AGENT_IDS } from '../../backend/src/services/pentacles-canonical-roster'
import {
  PentaclesAgentService,
  buildSeedAgentInput,
  type RosterAgent,
} from '../../backend/src/services/pentacles-agent-service'
import { PentaclesBackendClient } from '../../backend/src/services/pentacles-client'
import {
  NOT_CANONICAL_REASON,
  NonCanonicalRosterAgentError,
  USER_CREATED_MARKER_REASON,
  assertCanonicalRosterAgent,
  isCanonicalRosterAgentId,
  rosterExclusionReason,
} from '../../backend/src/services/pentacles-roster-guard'

const h = vi.hoisted(() => ({
  table: [] as any[],
  honorIdFilter: true,
  findManyCalls: [] as any[],
  returned: [] as string[],
  warn: vi.fn(),
}))

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    historical_agents = {
      findMany: async (args: any) => {
        h.findManyCalls.push(args)
        let rows = h.table.filter(
          row => args.where?.isActive === undefined || row.isActive === args.where.isActive
        )
        const allowed = args.where?.agentId?.in
        if (h.honorIdFilter && Array.isArray(allowed)) {
          rows = rows.filter(row => allowed.includes(row.agentId))
        }
        rows = [...rows].sort((a, b) =>
          a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0
        )
        if (args.take) rows = rows.slice(0, args.take)
        h.returned.push(...rows.map(row => row.agentId))
        // Only the selected columns, as Prisma does: a column the query forgot to select
        // would be invisible to the controller here too.
        return rows.map(row => Object.fromEntries(Object.keys(args.select).map(k => [k, row[k]])))
      },
    }
  },
}))

vi.mock('../../backend/src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: h.warn, error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../backend/src/services/cache', () => ({
  cacheService: {
    exists: async () => false,
    set: async () => {},
    get: async () => null,
  },
}))

const BODIES = [
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
]
const SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]

function planetsChart(offset: number) {
  return {
    planets: Object.fromEntries(
      BODIES.map((body, i) => [
        body,
        { sign: SIGNS[(i + offset) % 12], degree: 3.5 + i * 2.25, retrograde: false },
      ])
    ),
    ascendant: 187.4,
    houses: { ASC: 187.4, MC: 96.2 },
  }
}

// Values no canonical fixture uses, so "this string is nowhere in anything that left the process"
// is a real statement.
const PRIVATE_LAT = 41.8781234
const PRIVATE_LON = -87.6298765
const PRIVATE_BIRTH = new Date('1990-04-12T06:34:00Z')
const PRIVATE_UNIX = Math.floor(PRIVATE_BIRTH.getTime() / 1_000)
const PRIVATE_NAME = 'Private Person'
const PRIVATE_PLACE = 'Chicago, IL'

function canonicalRow(agentId: string, index: number) {
  return {
    agentId,
    name: `Canonical ${index}`,
    isActive: true,
    birthDate: new Date(Date.UTC(1800 + index, 4, 23, 12)),
    birthTime: '12:00',
    birthLocation: { lat: 37.5 + index / 100, lon: 23.5 + index / 100, name: 'Athens' },
    natalChart: planetsChart(index),
    craftedBy: 'philosopher-stone',
    historicalEra: 'Ancient',
  }
}

// Every shape of vessel the audit found a writer for. Each carries a chart the controller WOULD
// seed (all ten placements), so a passing test cannot be explained by a malformed fixture.
function vessel(agentId: string, overrides: Record<string, unknown> = {}) {
  return {
    agentId,
    name: PRIVATE_NAME,
    isActive: true,
    birthDate: PRIVATE_BIRTH,
    birthTime: '06:34',
    birthLocation: { lat: PRIVATE_LAT, lon: PRIVATE_LON, name: PRIVATE_PLACE },
    natalChart: planetsChart(5),
    craftedBy: 'philosopher-stone',
    historicalEra: null,
    ...overrides,
  }
}

const VESSELS = [
  // /api/create-agent
  vessel('agent-ada-test-1730000000000-k3j9x2', {
    craftedBy: 'philosopher-stone-user',
    historicalEra: 'user_created',
  }),
  // /api/philosophers-stone/create: stores the SAME craftedBy the canonical seed uses
  vessel('agent-bea-wizard-1730000000001', {
    craftedBy: 'philosopher-stone',
    historicalEra: 'MONICA_SPECIAL',
  }),
  // Python POST /api/agents: anonymous, client-chosen id, default craftedBy, no era
  vessel('planetary-sun-aries-12'),
  vessel('moon-phase-full-moon-180'),
  vessel('agent-sprite-lookalike-7'),
  // lookalikes of a real roster id
  vessel('Nikola-Tesla-1856'),
  vessel('nikola-tesla-1856 '),
  vessel('nikola-tesla-1856-2'),
  vessel('plato​'),
]
const VESSEL_IDS = VESSELS.map(v => v.agentId)

// A canonical id whose row nevertheless says it is user-created: contradictory, fails closed.
const CONTRADICTED_ID = 'plato'

function buildTable() {
  return [
    ...CANONICAL_ROSTER_AGENT_IDS.map((id, i) =>
      id === CONTRADICTED_ID
        ? { ...canonicalRow(id, i), craftedBy: 'philosopher-stone-user' }
        : canonicalRow(id, i)
    ),
    ...VESSELS,
  ]
}
const SEEDABLE_IDS = CANONICAL_ROSTER_AGENT_IDS.filter(id => id !== CONTRADICTED_ID)

interface Fetched {
  url: string
  body: string
}
const fetched: Fetched[] = []

function stubFetch() {
  fetched.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init?: { body?: unknown }) => {
      const target = String(url)
      fetched.push({ url: target, body: String(init?.body ?? '') })
      return {
        ok: true,
        status: 200,
        json: async () => (target.endsWith('/sql') ? [{ schema: { elements: [] }, rows: [] }] : {}),
        text: async () => '',
      }
    })
  )
}
const reducerRequests = () => fetched.filter(f => f.url.includes('/call/'))
const seedRequests = () =>
  fetched
    .filter(f => f.url.endsWith('/call/seed_agent_player'))
    .map(f => JSON.parse(f.body) as any[])

function liveClient() {
  return new PentaclesBackendClient({
    uri: 'https://pentacles.test',
    database: 'test-db',
    ownerToken: 'test-owner-token',
  })
}

const PRIVATE_NEEDLES = [
  String(PRIVATE_LAT),
  String(PRIVATE_LON),
  String(PRIVATE_UNIX),
  PRIVATE_NAME,
  PRIVATE_PLACE,
]
function expectNoPrivateData(value: unknown) {
  const text = JSON.stringify(value)
  for (const needle of PRIVATE_NEEDLES) expect(text).not.toContain(needle)
}

let savedDryRun: string | undefined
beforeEach(() => {
  savedDryRun = process.env.PENTACLES_AGENT_DRY_RUN
  h.table = buildTable()
  h.honorIdFilter = true
  h.findManyCalls.length = 0
  h.returned.length = 0
  h.warn.mockClear()
  stubFetch()
})
afterEach(() => {
  vi.unstubAllGlobals()
  if (savedDryRun === undefined) delete process.env.PENTACLES_AGENT_DRY_RUN
  else process.env.PENTACLES_AGENT_DRY_RUN = savedDryRun
})

describe('canonical roster allow-list', () => {
  it('is exactly the ids of HISTORICAL_AGENTS (the controller image has no lib/, so it holds a copy)', () => {
    const roster = HISTORICAL_AGENTS.map(agent => agent.id)
    const listed = [...CANONICAL_ROSTER_AGENT_IDS]
    expect(new Set(listed).size).toBe(listed.length)
    // A new historical agent fails here until its id is added to
    // backend/src/services/pentacles-canonical-roster.ts. Until then the controller simply does
    // not seed it, which is the safe direction.
    expect({
      missingFromControllerList: roster.filter(id => !listed.includes(id)),
      notInHistoricalAgents: listed.filter(id => !roster.includes(id)),
    }).toEqual({ missingFromControllerList: [], notInHistoricalAgents: [] })
  })

  it('cannot be mutated at runtime', () => {
    expect(Object.isFrozen(CANONICAL_ROSTER_AGENT_IDS)).toBe(true)
  })

  it('stays free of imports the controller image does not ship', () => {
    const dockerfile = fs.readFileSync(
      fileURLToPath(new URL('../../backend/Dockerfile.controller', import.meta.url)),
      'utf8'
    )
    expect(dockerfile).not.toMatch(/^COPY\s+(lib|app)\b/m)
    for (const file of [
      'pentacles-canonical-roster.ts',
      'pentacles-roster-guard.ts',
      'pentacles-agent-service.ts',
      'pentacles-client.ts',
    ]) {
      const source = fs.readFileSync(
        fileURLToPath(new URL(`../../backend/src/services/${file}`, import.meta.url)),
        'utf8'
      )
      expect(source, file).not.toMatch(/from\s+['"](@\/|(\.\.\/)+(lib|app)\/)/)
    }
  })

  it('flags exactly the rows that lib/agents/forged-privacy.ts calls user-created', () => {
    // The controller image cannot import from lib/, so it repeats the markers. They are pinned
    // by behaviour against the one definition the API routes use (`isUserCreatedAgentRow`),
    // not by scanning source text, so moving that definition cannot silently unpin them.
    const crafted = [
      undefined,
      null,
      'philosopher-stone-user',
      'historical-seed',
      'Philosopher-Stone-User',
    ]
    const eras = [undefined, null, 'user_created', 'MONICA_SPECIAL', 'ancient', 'USER_CREATED']
    for (const craftedBy of crafted) {
      for (const historicalEra of eras) {
        const row = { agentId: 'plato', craftedBy, historicalEra }
        expect(rosterExclusionReason(row) === USER_CREATED_MARKER_REASON, JSON.stringify(row)).toBe(
          isUserCreatedAgentRow(row)
        )
      }
    }
  })
})

describe('roster guard', () => {
  it('accepts every canonical id and nothing else', () => {
    for (const id of CANONICAL_ROSTER_AGENT_IDS) expect(isCanonicalRosterAgentId(id)).toBe(true)
    for (const id of VESSEL_IDS) expect(isCanonicalRosterAgentId(id), id).toBe(false)
  })

  it.each([
    ['empty', ''],
    ['whitespace', ' '],
    ['upper-cased roster id', 'PLATO'],
    ['trailing whitespace', 'plato '],
    ['prefix of a roster id', 'nikola-tesla'],
    ['planetary sprite shape', 'planetary-moon-cancer-3'],
    ['degree sprite shape', 'sun-leo-10'],
    ['moon sprite shape', 'moon-phase-new-moon-0'],
    ['prototype key', 'constructor'],
    ['prototype key 2', '__proto__'],
    ['toString', 'toString'],
    ['null', null],
    ['undefined', undefined],
    ['number', 42],
    ['object', { toString: () => 'plato' }],
    ['array', ['plato']],
  ])('rejects %s', (_label, value) => {
    expect(isCanonicalRosterAgentId(value)).toBe(false)
    expect(rosterExclusionReason({ agentId: value })).toBe(NOT_CANONICAL_REASON)
    expect(() => assertCanonicalRosterAgent(value)).toThrow(NonCanonicalRosterAgentError)
  })

  it('lets a clean canonical row through', () => {
    expect(
      rosterExclusionReason({
        agentId: 'plato',
        craftedBy: 'philosopher-stone',
        historicalEra: 'Ancient',
      })
    ).toBeNull()
    expect(rosterExclusionReason({ agentId: 'plato' })).toBeNull()
  })

  it.each([
    ['craftedBy', { craftedBy: 'philosopher-stone-user' }],
    ['era user_created', { historicalEra: 'user_created' }],
    ['era MONICA_SPECIAL', { historicalEra: 'MONICA_SPECIAL' }],
  ])('fails closed on a canonical id carrying the %s marker', (_label, markers) => {
    expect(rosterExclusionReason({ agentId: 'plato', ...markers })).toBe(USER_CREATED_MARKER_REASON)
  })

  it('never puts the offending id or any row data in the error text', () => {
    let message = ''
    try {
      assertCanonicalRosterAgent(VESSEL_IDS[0])
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain(NOT_CANONICAL_REASON)
    for (const id of VESSEL_IDS) expect(message).not.toContain(id)
  })
})

describe('the roster query', () => {
  it('asks the database for the allow-list only, so a vessel row is never read', async () => {
    const service = new PentaclesAgentService(liveClient())
    await service.evaluate({ dryRun: true, maxActions: 1_000 })

    expect(h.findManyCalls).toHaveLength(1)
    expect(h.findManyCalls[0].where).toEqual({
      isActive: true,
      agentId: { in: [...CANONICAL_ROSTER_AGENT_IDS] },
    })
    // The marker columns are selected only for the contradiction check.
    expect(h.findManyCalls[0].select).toMatchObject({ craftedBy: true, historicalEra: true })
    for (const id of VESSEL_IDS) expect(h.returned).not.toContain(id)
    // The only row the roster skips is the canonical id that contradicts itself.
    expect(h.warn.mock.calls).toEqual([
      [
        'Pentacles roster skipped a non-canonical agent',
        { agentId: CONTRADICTED_ID, reason: USER_CREATED_MARKER_REASON },
      ],
    ])
  })

  it('cannot be crowded out of its take window by vessels sorting ahead of the roster', async () => {
    for (let i = 0; i < 150; i += 1) {
      h.table.push(vessel(`agent-aaa-${String(i).padStart(3, '0')}`))
    }
    const service = new PentaclesAgentService(liveClient())
    const result = await service.evaluate({ dryRun: false, maxAgents: 100, maxActions: 1_000 })

    expect(result.failed).toBe(0)
    expect(
      seedRequests()
        .map(call => call[0])
        .sort()
    ).toEqual([...SEEDABLE_IDS].sort())
    expectNoPrivateData(fetched)
  })
})

describe('live run (dry-run off)', () => {
  it('seeds every canonical figure and sends no reducer call for a vessel', async () => {
    const service = new PentaclesAgentService(liveClient())
    const result = await service.evaluate({ dryRun: false, maxActions: 1_000 })

    expect(result.failed).toBe(0)
    expect(result.errors).toEqual([])
    const seeded = seedRequests()
    // Positive control: the guard did not turn the controller off.
    expect(seeded.map(call => call[0]).sort()).toEqual([...SEEDABLE_IDS].sort())
    const sample = seeded.find(call => call[0] === 'albert-einstein')!
    expect(sample[2]).toMatchObject({ birth_lat: expect.any(Number), time_known: true })
    expect(sample[2].placements).toHaveLength(10)

    for (const call of seeded) expect(VESSEL_IDS).not.toContain(call[0])
    expect(reducerRequests().some(r => VESSEL_IDS.some(id => r.body.includes(id)))).toBe(false)
    expectNoPrivateData(fetched)
    expectNoPrivateData(result)
  })

  it('skips a vessel with a logged reason even when the database ignores the allow-list', async () => {
    h.honorIdFilter = false
    const service = new PentaclesAgentService(liveClient())
    const result = await service.evaluate({ dryRun: false, maxActions: 1_000 })

    // The bypass is real at the database layer: the vessels did come back...
    for (const id of VESSEL_IDS) expect(h.returned).toContain(id)
    // ...and none of them became a roster entry, an intent or a reducer call.
    expect(result.rosterSeen).toBe(SEEDABLE_IDS.length)
    expect(
      seedRequests()
        .map(call => call[0])
        .sort()
    ).toEqual([...SEEDABLE_IDS].sort())
    expect(result.intents.map(intent => intent.agentKey).sort()).toEqual([...SEEDABLE_IDS].sort())
    expectNoPrivateData(fetched)
    expectNoPrivateData(result)
    for (const id of VESSEL_IDS) expect(JSON.stringify(result)).not.toContain(id)

    const warned = h.warn.mock.calls.map(([message, meta]) => ({ message, ...(meta as object) }))
    for (const id of VESSEL_IDS) {
      expect(warned).toContainEqual({
        message: 'Pentacles roster skipped a non-canonical agent',
        agentId: id,
        reason: NOT_CANONICAL_REASON,
      })
    }
    expect(warned).toContainEqual({
      message: 'Pentacles roster skipped a non-canonical agent',
      agentId: CONTRADICTED_ID,
      reason: USER_CREATED_MARKER_REASON,
    })
    // The log carries ids and fixed reasons, never the row.
    expectNoPrivateData(h.warn.mock.calls)
  })

  it('does not provision the contradicted canonical row', async () => {
    const service = new PentaclesAgentService(liveClient())
    const result = await service.evaluate({ dryRun: false, maxActions: 1_000 })
    expect(seedRequests().map(call => call[0])).not.toContain(CONTRADICTED_ID)
    expect(result.rosterSeen).toBe(SEEDABLE_IDS.length)
  })
})

describe('dry-run behaviour is unchanged', () => {
  it('defaults to dry-run: plans provisioning for the roster, calls no reducer', async () => {
    delete process.env.PENTACLES_AGENT_DRY_RUN
    const service = new PentaclesAgentService(liveClient())
    const result = await service.evaluate({ maxActions: 1_000 })

    expect(result.dryRun).toBe(true)
    expect(reducerRequests()).toEqual([])
    expect(result.executed).toBe(0)
    const provisioned = result.intents.filter(intent => intent.action === 'provision_agent')
    expect(provisioned.map(intent => intent.agentKey).sort()).toEqual([...SEEDABLE_IDS].sort())
    expectNoPrivateData(result)
  })

  it('is switched off only by PENTACLES_AGENT_DRY_RUN=false', async () => {
    process.env.PENTACLES_AGENT_DRY_RUN = 'false'
    const service = new PentaclesAgentService(liveClient())
    const result = await service.evaluate({ maxActions: 1_000 })
    expect(result.dryRun).toBe(false)
    expect(seedRequests()).toHaveLength(SEEDABLE_IDS.length)

    process.env.PENTACLES_AGENT_DRY_RUN = 'true'
    stubFetch()
    const again = await service.evaluate({ maxActions: 1_000 })
    expect(again.dryRun).toBe(true)
    expect(reducerRequests()).toEqual([])
  })

  it('keeps an explicit dryRun option authoritative in both directions', async () => {
    process.env.PENTACLES_AGENT_DRY_RUN = 'false'
    const service = new PentaclesAgentService(liveClient())
    expect((await service.evaluate({ dryRun: true, maxActions: 1_000 })).dryRun).toBe(true)
    expect(reducerRequests()).toEqual([])
    delete process.env.PENTACLES_AGENT_DRY_RUN
    expect((await service.evaluate({ dryRun: false, maxActions: 1_000 })).dryRun).toBe(false)
    expect(seedRequests().length).toBeGreaterThan(0)
  })
})

describe('buildSeedAgentInput (the lowest service layer)', () => {
  const rosterAgent = (agentKey: string): RosterAgent => ({
    agentKey,
    handle: PRIVATE_NAME,
    faction: 'Mars',
    chart: {
      birthUnix: PRIVATE_UNIX,
      birthLat: PRIVATE_LAT,
      birthLon: PRIVATE_LON,
      timeKnown: true,
      placements: BODIES.map((body, i) => ({
        body: body as RosterAgent['chart']['placements'][number]['body'],
        sign: i % 12,
        arcMinutes: 100 + i,
        retrograde: false,
        dignity: 0,
      })),
      ascendant: 1_234,
      midheaven: 567,
    },
  })

  it.each(VESSEL_IDS.map(id => [id]))('refuses to build reducer arguments for %s', id => {
    expect(() => buildSeedAgentInput(rosterAgent(id))).toThrow(NonCanonicalRosterAgentError)
  })

  it('builds the full argument set for a canonical figure', () => {
    const input = buildSeedAgentInput(rosterAgent('plato'))
    expect(input.agentKey).toBe('plato')
    expect(input.faction).toBe('Mars')
    expect(input.chart).toMatchObject({
      birth_unix: PRIVATE_UNIX,
      birth_lat: PRIVATE_LAT,
      birth_lon: PRIVATE_LON,
      time_known: true,
      ascendant: 1_234,
      midheaven: 567,
    })
    expect((input.chart as any).placements).toHaveLength(10)
  })

  it('is the only route from the service to seedAgent', () => {
    const source = fs.readFileSync(
      fileURLToPath(
        new URL('../../backend/src/services/pentacles-agent-service.ts', import.meta.url)
      ),
      'utf8'
    )
    const calls = source.match(/\.seedAgent\(/g) ?? []
    expect(calls).toHaveLength(1)
    expect(source).toContain('.seedAgent(buildSeedAgentInput(roster))')
    expect(source).not.toMatch(/export\s+function\s+reducerChart/)
  })
})

describe('PentaclesBackendClient (the network boundary)', () => {
  it.each(VESSEL_IDS.map(id => [id]))(
    'refuses seed_agent_player for %s before any I/O',
    async id => {
      const client = liveClient()
      await expect(
        client.call('seed_agent_player', [
          id,
          PRIVATE_NAME,
          { birth_lat: PRIVATE_LAT },
          { mars: [] },
        ])
      ).rejects.toBeInstanceOf(NonCanonicalRosterAgentError)
      await expect(
        client.seedAgent({ agentKey: id, handle: PRIVATE_NAME, chart: {}, faction: 'Mars' })
      ).rejects.toBeInstanceOf(NonCanonicalRosterAgentError)
      expect(fetched).toEqual([])
    }
  )

  it('refuses regardless of whether an owner token is configured', async () => {
    const tokenless = new PentaclesBackendClient({
      uri: 'https://pentacles.test',
      database: 'test-db',
      ownerToken: '',
    })
    await expect(
      tokenless.call('seed_agent_player', [VESSEL_IDS[0], 'x', {}, { mars: [] }])
    ).rejects.toBeInstanceOf(NonCanonicalRosterAgentError)
  })

  it('refuses a call with no agent key at all', async () => {
    await expect(liveClient().call('seed_agent_player', [])).rejects.toBeInstanceOf(
      NonCanonicalRosterAgentError
    )
    expect(fetched).toEqual([])
  })

  it('still seeds a canonical figure', async () => {
    await liveClient().seedAgent({
      agentKey: 'plato',
      handle: 'Plato',
      chart: { birth_lat: 1 },
      faction: 'Mars',
    })
    expect(seedRequests()).toEqual([['plato', 'Plato', { birth_lat: 1 }, { mars: [] }]])
  })

  it('leaves reducers that publish no chart data alone', async () => {
    await liveClient().castWord('agent-ada-test-1730000000000-k3j9x2', 'STAR', 'Mars')
    expect(fetched.map(f => f.url)).toEqual([
      'https://pentacles.test/v1/database/test-db/call/admin_agent_cast_word',
    ])
  })
})
