// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('GET /api/agents privacy & birth data redaction', () => {
  const originalEnv = process.env.INTERNAL_API_SECRET

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
