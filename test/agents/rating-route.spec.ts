// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { CORE_STAT_KEYS } from '@/lib/agents/rating/ovr-archetype'
import { SEAL_TIERS, type EsmsHoldings } from '@/lib/agents/rating/seals-surge'

const mocks = vi.hoisted(() => ({
  resolveBalances: vi.fn(),
  resolveSky: vi.fn(),
  findUnique: vi.fn(),
  rateLimit: vi.fn(),
}))

vi.mock('@/lib/agents/rating/esms-balance-resolver', () => ({
  resolveAgentEsmsBalances: mocks.resolveBalances,
}))
vi.mock('@/lib/agents/rating/live-sky', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/agents/rating/live-sky')>()),
  resolveLiveSky: mocks.resolveSky,
}))
vi.mock('@/lib/db', () => ({ prisma: { historical_agents: { findUnique: mocks.findUnique } } }))
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: mocks.rateLimit,
  getClientIp: (h: Headers) => h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
}))

import { GET, OPTIONS, POST } from '@/app/api/agents/rating/route'
import {
  SkyUnavailableError,
  deriveLiveSky,
  type SkyLongitudes,
} from '@/lib/agents/rating/live-sky'
import { SKY_BODIES } from '@/lib/agents/rating/live-sky'

const URL_ = 'http://localhost:3000/api/agents/rating'
const SECRET = 'test-internal-secret-value'
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

const holdings = (each = 0): EsmsHoldings => ({
  spirit: each,
  essence: each,
  matter: each,
  substance: each,
})
const ledger = (balances: EsmsHoldings, agentId = 'x') => ({
  agentId,
  balances,
  esmsSource: 'database' as const,
})

const get = (query: string, headers: Record<string, string> = {}) =>
  GET(new NextRequest(`${URL_}${query}`, { headers }))
const post = (body: unknown, auth: string | null = `Bearer ${SECRET}`, raw = false) =>
  POST(
    new NextRequest(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { authorization: auth } : {}) },
      body: raw ? (body as string) : JSON.stringify(body),
    })
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('INTERNAL_API_SECRET', SECRET)
  mocks.rateLimit.mockReturnValue({ ok: true, remaining: 99, limit: 100, resetMs: 1000 })
  mocks.resolveBalances.mockImplementation(async (agentId: string, options: any) =>
    options?.spacetime
      ? { agentId, balances: options.spacetime, esmsSource: 'spacetimedb' }
      : ledger(holdings(3), agentId)
  )
  mocks.resolveSky.mockResolvedValue(sky)
  mocks.findUnique.mockResolvedValue(null)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('GET /api/agents/rating?agentId=', () => {
  it('serves a fully rated roster vessel on the Pentacle Vessel Rating Scale', async () => {
    const res = await get('?agentId=isaac-newton')
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
    expect(body.zoneSynergies).toHaveLength(11)
    expect(body.zoneSynergies.map((z: { zoneId: number }) => z.zoneId)).toEqual([
      ...Array(11).keys(),
    ])
    expect(body.sky).toMatchObject({ source: 'swiss-ephemeris', at: '2026-10-15T05:43:00.000Z' })
    expect(body.degraded).toBeUndefined()
  })

  it('allows the Pentacles web client to read it and never caches a live rating', async () => {
    const res = await get('?agentId=isaac-newton')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('cache-control')).toBe('no-store')
    const preflight = await OPTIONS()
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS')
  })

  it('reads the ledger for the agent, never strictly, with no live override by default', async () => {
    await get('?agentId=isaac-newton')
    expect(mocks.resolveBalances).toHaveBeenCalledWith('isaac-newton', {
      spacetime: null,
      strict: false,
    })
  })

  it('rates Gregory’s Pentacles avatar from his roster agent and keeps the avatar look', async () => {
    const body = await (await get('?agentId=user-avatar-neo')).json()
    expect(body.agentId).toBe('user-avatar-neo')
    expect(body.name).toBe('Gregory Castro')
    expect(body.appearance).toMatchObject({ agentId: 'user-avatar-neo', era: 'astral' })
    expect(mocks.resolveBalances).toHaveBeenCalledWith('greg-castro-1991', expect.anything())
  })

  it('announces a ledger it could not read instead of showing a healthy zero', async () => {
    mocks.resolveBalances.mockResolvedValue({
      agentId: 'isaac-newton',
      balances: holdings(0.5),
      esmsSource: 'fallback',
      degraded: { reason: 'ledger read failed: ECONNREFUSED' },
    })
    const res = await get('?agentId=isaac-newton')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.esmsSource).toBe('fallback')
    expect(body.degraded).toEqual({ esms: 'ledger read failed: ECONNREFUSED' })
  })

  it('announces a sky it could not compute: surge and sky are null, not defaults', async () => {
    mocks.resolveSky.mockRejectedValue(new SkyUnavailableError('The sky is incomplete (Pluto)'))
    const res = await get('?agentId=isaac-newton')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.surge).toBeNull()
    expect(body.sky).toBeNull()
    expect(body.degraded.sky).toMatch(/incomplete \(Pluto\)/)
    expect(body.seals).toHaveLength(7) // everything that does not need the sky is still served
    expect(body.ovr).toBeGreaterThan(0)
  })

  it('rates a user-forged vessel from its database row', async () => {
    mocks.findUnique.mockResolvedValue({
      agentId: 'agent-moonwalker-ab12',
      name: 'Moonwalker',
      monicaConstant: 1.2,
      natalChart: { planets: { Sun: { sign: 'Aries', degree: 12 }, Moon: { sign: 'Leo', degree: 3 } } },
      powerScore: 60, resonanceScore7: 70, wisdomScore: 65, charismaScore: 72,
      intuitionScore: 68, adaptabilityScore: 55, vitalityScore: 61,
    }) // prettier-ignore
    const body = await (await get('?agentId=agent-moonwalker-ab12')).json()
    expect(body.agentId).toBe('agent-moonwalker-ab12')
    expect(body.appearance.era).toBe('astral')
    expect(body.ratings.charisma).toBeGreaterThan(body.ratings.power)
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { agentId: 'agent-moonwalker-ab12' } })
  })

  it('is 404 for an unknown agent and 422 for a row with nothing to rate', async () => {
    expect((await get('?agentId=nobody-here')).status).toBe(404)
    mocks.findUnique.mockResolvedValue({ agentId: 'blank', name: 'Blank', natalChart: {} })
    const res = await get('?agentId=blank')
    expect(res.status).toBe(422)
    expect((await res.json()).success).toBe(false)
  })

  it('is 503, not 404, when the agent lookup itself fails', async () => {
    mocks.findUnique.mockRejectedValue(new Error('connection refused'))
    const res = await get('?agentId=some-forged-agent')
    expect(res.status).toBe(503)
    expect(JSON.stringify(await res.json())).not.toContain('connection refused')
  })

  it.each(['', '%20', 'a/b', '../etc/passwd', 'x'.repeat(101), 'bad id', 'é-agent', '-leading'])(
    'rejects the agentId %j with 400 before any lookup',
    async id => {
      const res = await get(`?agentId=${id}`)
      expect(res.status).toBe(400)
      expect(mocks.findUnique).not.toHaveBeenCalled()
      expect(mocks.resolveBalances).not.toHaveBeenCalled()
    }
  )

  it('is 400 with no agentId at all', async () => {
    expect((await get('')).status).toBe(400)
  })

  it('answers 429 with Retry-After when the caller or the overall budget is spent', async () => {
    mocks.rateLimit.mockReturnValueOnce({ ok: false, remaining: 0, limit: 1, resetMs: 1 })
    const res = await get('?agentId=isaac-newton')
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('60')
    expect(mocks.resolveBalances).not.toHaveBeenCalled()
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1) // a limited caller does not spend the global budget

    mocks.rateLimit
      .mockReturnValueOnce({ ok: true, remaining: 1, limit: 2, resetMs: 1 })
      .mockReturnValueOnce({ ok: false, remaining: 0, limit: 1, resetMs: 1 })
    expect((await get('?agentId=isaac-newton')).status).toBe(429)
  })

  it('keys the limit per caller with documented defaults', async () => {
    await get('?agentId=isaac-newton', { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' })
    expect(mocks.rateLimit.mock.calls).toEqual([
      ['rating:203.0.113.9', { limit: 120, windowMs: 60_000 }],
      ['rating:global', { limit: 1200, windowMs: 60_000 }],
    ])
  })
})

describe('GET /api/agents/rating?roster=true', () => {
  it('summarises every historical agent without touching the ledger or the sky', async () => {
    const res = await get('?roster=true')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.count).toBe(HISTORICAL_AGENTS.length)
    expect(body.agents).toHaveLength(HISTORICAL_AGENTS.length)
    expect(new Set(body.agents.map((a: { agentId: string }) => a.agentId)).size).toBe(body.count)
    for (const entry of body.agents) {
      expect(Object.keys(entry).sort()).toEqual(
        ['agentId', 'archetype', 'crownStyle', 'era', 'name', 'ovr', 'signatureRelic'].sort()
      )
      expect(entry.ovr).toBeGreaterThanOrEqual(25)
      expect(entry.ovr).toBeLessThanOrEqual(99)
    }
    expect(mocks.resolveBalances).not.toHaveBeenCalled()
    expect(mocks.resolveSky).not.toHaveBeenCalled()
    expect(res.headers.get('cache-control')).toBe('public, max-age=300')
  })
})

describe('POST /api/agents/rating (internal ESMS push)', () => {
  const valid = { agentId: 'isaac-newton', esmsBalances: holdings(12) }

  it('fails closed with 503 when no INTERNAL_API_SECRET is configured', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', '')
    const res = await post(valid)
    expect(res.status).toBe(503)
    expect(mocks.resolveBalances).not.toHaveBeenCalled()
  })

  it.each([
    ['no Authorization header', null],
    ['a wrong secret', 'Bearer not-the-secret'],
    ['a prefix of the secret', `Bearer ${SECRET.slice(0, -1)}`],
    ['the secret with extra characters', `Bearer ${SECRET}x`],
    ['the wrong scheme', `Basic ${SECRET}`],
    ['an empty bearer', 'Bearer '],
  ])('is 401 with %s', async (_label, auth) => {
    const res = await post(valid, auth)
    expect(res.status).toBe(401)
    expect(mocks.resolveBalances).not.toHaveBeenCalled()
  })

  it('recalculates with the pushed holdings as live SpacetimeDB state and returns the payload', async () => {
    const res = await post(valid)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.esmsSource).toBe('spacetimedb')
    expect(body.esmsBalances).toEqual(holdings(12))
    expect(mocks.resolveBalances).toHaveBeenCalledWith('isaac-newton', {
      spacetime: holdings(12),
      strict: false,
    })
    // 12 whole tokens of each element clears the Gold balance gate (10) where the stat allows.
    expect(body.seals.every((s: { balance: number }) => s.balance === 12)).toBe(true)
  })

  it('sends no CORS headers: it is a server-to-server webhook', async () => {
    for (const res of [await post(valid), await post(valid, null)]) {
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    }
  })

  it('never writes the ledger: the only database access is reading the agent', async () => {
    mocks.findUnique.mockResolvedValue(null)
    await post({ agentId: 'some-forged', esmsBalances: holdings(1) })
    expect(Object.keys((await import('@/lib/db')).prisma)).toEqual(['historical_agents'])
  })

  it.each([
    ['a missing token', { spirit: 1, essence: 1, matter: 1 }],
    ['a negative balance', { ...holdings(1), matter: -0.1 }],
    ['a string balance', { ...holdings(1), spirit: '5' }],
    ['a non-finite balance', { ...holdings(1), essence: null }],
    ['no holdings', undefined],
    ['an array', [1, 2, 3, 4]],
  ])('rejects %s with 400', async (_label, esmsBalances) => {
    const res = await post({ agentId: 'isaac-newton', esmsBalances })
    expect(res.status).toBe(400)
    expect(mocks.resolveBalances).not.toHaveBeenCalled()
  })

  it('rejects a bad agentId, malformed JSON, an unknown agent and an oversized body', async () => {
    expect((await post({ agentId: '../x', esmsBalances: holdings(1) })).status).toBe(400)
    expect((await post('{not json', `Bearer ${SECRET}`, true)).status).toBe(400)
    expect((await post({ agentId: 'nobody-here', esmsBalances: holdings(1) })).status).toBe(404)
    const big = new NextRequest(URL_, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${SECRET}`,
        'content-type': 'application/json',
        'content-length': '99999',
      },
      body: JSON.stringify(valid),
    })
    expect((await POST(big)).status).toBe(413)
  })

  it('lets the next GET see the pushed holdings for a minute, then forgets them', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    await post({ agentId: 'plato', esmsBalances: holdings(7) })

    await get('?agentId=plato')
    expect(mocks.resolveBalances).toHaveBeenLastCalledWith('plato', {
      spacetime: holdings(7),
      strict: false,
    })

    vi.setSystemTime(new Date(NOW.getTime() + 61_000))
    await get('?agentId=plato')
    expect(mocks.resolveBalances).toHaveBeenLastCalledWith('plato', {
      spacetime: null,
      strict: false,
    })
  })
})
