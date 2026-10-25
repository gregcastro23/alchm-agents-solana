// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CraftedAgent } from '@/lib/agent-types'
import {
  ANONYMOUS_VIEWER,
  PRIVATE_PROGRESSION_REASON,
  agentRowFacts,
  extractLocationName,
  extractSunSign,
  isEntitledToForgedVessel,
  isForgedVesselRow,
  isRestrictedProfileRow,
  projectForgedAgentForPublic,
  projectProgressionForPublic,
  projectPublicBirthData,
  projectPublicNatalChart,
  type ForgedViewer,
} from '@/lib/agents/forged-privacy-profile'

const viewer = (over: Partial<ForgedViewer> = {}): ForgedViewer => ({
  ...ANONYMOUS_VIEWER,
  ...over,
})

describe('isForgedVesselRow (the PR #67 predicate)', () => {
  it.each([
    ['historicalEra user_created', { agentId: 'a', historicalEra: 'user_created' }],
    ['historicalEra MONICA_SPECIAL', { agentId: 'a', historicalEra: 'MONICA_SPECIAL' }],
    ['craftedBy philosopher-stone-user', { agentId: 'a', craftedBy: 'philosopher-stone-user' }],
    ['isUserCreated flag', { agentId: 'a', isUserCreated: true }],
  ])('is true for %s', (_name, row) => {
    expect(isForgedVesselRow(row)).toBe(true)
  })

  it('is false for the seeded default', () => {
    expect(
      isForgedVesselRow({ agentId: 'a', craftedBy: 'philosopher-stone', historicalEra: 'Ancient' })
    ).toBe(false)
  })
})

describe('isRestrictedProfileRow fails closed', () => {
  it('restricts every forged row, whatever its id looks like', () => {
    expect(isRestrictedProfileRow({ agentId: 'agent-x', historicalEra: 'user_created' })).toBe(true)
    // A forged row that borrows a sky-sprite id is still a person's row.
    expect(
      isRestrictedProfileRow({
        agentId: 'planetary-mars-aries-12',
        craftedBy: 'philosopher-stone-user',
      })
    ).toBe(true)
  })

  it('restricts a row neither marker catches (the Python API creates these anonymously)', () => {
    expect(
      isRestrictedProfileRow({
        agentId: 'agent-someone-1792865588388',
        craftedBy: 'philosopher-stone',
        historicalEra: 'Modern',
      })
    ).toBe(true)
  })

  it('leaves the seeded sky sprites public', () => {
    for (const agentId of ['planetary-mars-aries-12', 'mars-aries-12', 'moon-phase-full-180']) {
      expect(isRestrictedProfileRow({ agentId, craftedBy: 'philosopher-stone' })).toBe(false)
    }
  })
})

describe('isEntitledToForgedVessel', () => {
  const row = { agentId: 'agent-mine-1' }

  it('admits an admin', () => {
    expect(isEntitledToForgedVessel(row, viewer({ isAdmin: true, userId: 'u' }))).toBe(true)
  })

  it('admits the creator found through the ledger', () => {
    const creator = viewer({ userId: 'u1', creatorAgentIds: new Set(['agent-mine-1']) })
    expect(isEntitledToForgedVessel(row, creator)).toBe(true)
  })

  it('admits the creator named on the row', () => {
    expect(isEntitledToForgedVessel({ ...row, creatorId: 'u1' }, viewer({ userId: 'u1' }))).toBe(
      true
    )
  })

  it('refuses everybody else', () => {
    expect(isEntitledToForgedVessel(row, ANONYMOUS_VIEWER)).toBe(false)
    expect(isEntitledToForgedVessel(row, viewer({ userId: 'u2' }))).toBe(false)
    expect(
      isEntitledToForgedVessel(row, viewer({ userId: 'u2', creatorAgentIds: new Set(['other']) }))
    ).toBe(false)
    // A row with no creator and a viewer with no id must not match on null === null.
    expect(isEntitledToForgedVessel({ ...row, creatorId: null }, ANONYMOUS_VIEWER)).toBe(false)
    // Degraded is a stranger, not a creator.
    expect(isEntitledToForgedVessel(row, viewer({ degraded: true }))).toBe(false)
  })
})

describe('what stays public', () => {
  it('reads the Sun sign from the roster shape, a Sun property and the forge shape', () => {
    expect(extractSunSign({ planets: { Sun: { sign: ' Pisces ', degree: 3 } } })).toBe('Pisces')
    expect(extractSunSign({ planets: [{ name: 'Sun', sign: 'Leo' }] })).toBe('Leo')
    expect(extractSunSign({ Sun: { sign: 'Virgo' } })).toBe('Virgo')
    expect(
      extractSunSign({
        tropical: { CelestialBodies: { all: [{ label: 'Sun', Sign: { label: 'Libra' } }] } },
      })
    ).toBe('Libra')
    expect(extractSunSign({ planets: { Moon: { sign: 'Cancer' } } })).toBeNull()
    expect(extractSunSign(null)).toBeNull()
  })

  it('projects a chart to the Sun sign and nothing else', () => {
    const projected = projectPublicNatalChart({
      planets: { Sun: { sign: 'Pisces', degree: 22.04, house: 11 }, Moon: { sign: 'Cancer' } },
      ascendant: 36.5,
      houses: { ASC: 36.5 },
      aspects: [{ type: 'Square' }],
    })
    expect(projected).toEqual({ planets: { Sun: { sign: 'Pisces' } } })
    expect(projectPublicNatalChart({ ascendant: 12 })).toBeNull()
  })

  it('projects birth data to the place name', () => {
    expect(projectPublicBirthData({ lat: 64.1466, lon: -21.9426, name: 'Reykjavik' })).toEqual({
      location: { name: 'Reykjavik' },
    })
    expect(projectPublicBirthData('Rome')).toEqual({ location: { name: 'Rome' } })
    expect(projectPublicBirthData({ lat: 1, lon: 2 })).toEqual({ location: { name: 'Unknown' } })
    expect(extractLocationName({ city: ' Oslo ' })).toBe('Oslo')
  })

  it('carries the user-created flag and the creator through, as the only booleans and ids it keeps', () => {
    expect(agentRowFacts({ agentId: 'a', isUserCreated: true, creatorId: 'u1' })).toMatchObject({
      isUserCreated: true,
      creatorId: 'u1',
    })
    expect(agentRowFacts({ agentId: 'a', isUserCreated: 'yes' }).isUserCreated).toBeNull()
  })

  it('picks only the decision columns out of a row', () => {
    expect(
      agentRowFacts({
        agentId: 'agent-1',
        historicalEra: 'user_created',
        natalChart: { planets: {} },
        birthDate: new Date(),
        aura: { sourceCharts: [] },
      })
    ).toEqual({
      agentId: 'agent-1',
      historicalEra: 'user_created',
      craftedBy: null,
      agentCategory: null,
      isUserCreated: null,
      creatorId: null,
    })
  })
})

// ── The allow-list ──────────────────────────────────────────────────────────

const POISON = 'POISON-MUST-NOT-SURVIVE'

/** A vessel with a private marker planted in every place a field could hide. */
function poisonedAgent(): CraftedAgent {
  return {
    id: 'agent-poisoned-1',
    name: 'Sealed Vessel',
    title: 'The Sealed',
    zzTop: POISON,
    quotes: [POISON],
    synthesis: POISON,
    monicaCreationStory: POISON,
    historicalDiet: { dietaryPhilosophy: POISON },
    birthData: {
      date: new Date('1991-03-14T04:07:00.000Z'),
      time: '04:07',
      zzBirth: POISON,
      location: { lat: 64.1466, lon: -21.9426, name: 'Reykjavik', timezone: POISON },
    },
    birthDate: '1991-03-14',
    birthTime: '04:07',
    birthLocation: { latitude: 64.1466, longitude: -21.9426, name: POISON },
    consciousness: {
      natalChart: {
        planets: {
          Sun: { sign: 'Pisces', degree: 22.04, house: 11, retrograde: false, zz: POISON },
          Moon: { sign: 'Cancer', degree: 11.27, house: 2, retrograde: false },
          Mercury: { sign: 'Pisces', degree: 8.51, house: 11, retrograde: true },
        },
        ascendant: 36.5,
        midheaven: 297.2,
        houses: { ASC: 36.5, MC: 297.2 },
        aspects: [{ planet1: 'Sun', planet2: 'Moon', type: 'square', orb: 0.9, exact: false }],
        provenance: 'computed',
        provenanceNote: POISON,
      },
      monicaConstant: 1.618,
      level: 'Illuminated',
      dominantElement: 'Water',
      dominantModality: 'Mutable',
      signature: 'Sealed Vessel',
      strength: POISON,
      emotion: POISON,
      alchemicalElements: { spirit: 1, essence: 2, matter: 3, substance: 4 },
      zzConsciousness: POISON,
    },
    personality: {
      core: {
        essence: 'ESSENCE-FREE-TEXT',
        expression: 'ABOUT-YOURSELF-FREE-TEXT',
        emotion: 'VALUES-FREE-TEXT',
        lifeStory: 'LIFE-STORY-FREE-TEXT',
        poetry: 'POETRY-FREE-TEXT',
        userProvidedContext: { aboutYourself: 'CONTEXT-FREE-TEXT' },
      },
      traits: ['Wise', 'Intuitive', 42, { zz: POISON }],
      gifts: [{ type: 'Sight', description: 'sees', expression: 'quietly', zz: POISON }],
      shadows: [{ type: 'Doubt', description: 'doubts', transformationPath: 'asks', zz: POISON }],
      challenges: [
        { type: 'Haste', description: 'rushes', growthOpportunity: 'waits', zz: POISON },
      ],
      currentMood: 'contemplative',
      evolutionStage: 2,
      zzPersonality: POISON,
    },
    abilities: {
      specialty: 'Wisdom',
      wisdomDomains: ['Philosophy', 7],
      skills: [POISON],
      teachingStyle: 'Socratic',
      resonanceType: 'Spirit',
      uniquePower: 'Foresight',
      zzAbilities: POISON,
    },
    appearance: {
      avatar: '/avatars/a.png',
      color: '#8B5CF6',
      symbol: 'X',
      aura: { sourceCharts: [{ birthChart: { ascendant: 36.5 } }], note: POISON },
      portraitDescription: POISON,
    },
    stats: {
      conversations: 3,
      wisdomShared: 4,
      resonanceScore: 0.5,
      evolutionPoints: 6,
      lastActive: new Date('2026-10-18T00:00:00.000Z'),
      kineticEvolution: { zz: POISON },
      qualityMetrics: { zz: POISON },
    },
    sacredStats: {
      power: 71.4321,
      resonance: 64.9876,
      wisdom: 80.123456,
      charisma: 55.5,
      intuition: 90.01,
      adaptability: 33.3333,
      vitality: 47.7777,
      solarAgency: 61.123456,
      lunarReceptivity: 54.8765432,
      mercurialVelocity: 50.1,
      venusianCoherence: 59.9,
      martialImpetus: 51.2,
      jovianExpansion: 70.7,
      saturnianStructure: 53.3,
      chironicAdaptation: 1,
      uranianSurprisal: 2,
      neptunianResonance: 3,
      plutonicIntegration: 4,
      kineticAlignment: 5,
    },
  } as unknown as CraftedAgent
}

describe('projectForgedAgentForPublic is an allow-list', () => {
  const projected = projectForgedAgentForPublic(poisonedAgent())
  const wire = JSON.stringify(projected)

  it('carries exactly the allow-listed top-level keys', () => {
    expect(Object.keys(projected).sort()).toEqual(
      [
        'abilities',
        'appearance',
        'birthData',
        'consciousness',
        'id',
        'name',
        'personality',
        'sacredStats',
        'stats',
        'title',
      ].sort()
    )
  })

  it('drops every key that is not named, however it is spelled or nested', () => {
    expect(wire).not.toContain(POISON)
    for (const text of [
      'FREE-TEXT',
      'sourceCharts',
      'provenance',
      'ascendant',
      'midheaven',
      'houses',
      'aspects',
      'degree',
      'house',
      'retrograde',
      'Moon',
      'Mercury',
      'Cancer',
      '1991',
      '04:07',
      '64.1466',
      '21.9426',
      '"lat"',
      '"lon"',
      'timezone',
    ]) {
      expect(wire).not.toContain(text)
    }
  })

  it('keeps the two public chart facts and nothing finer', () => {
    expect(projected.birthData).toEqual({ location: { name: 'Reykjavik' } })
    expect(projected.consciousness.natalChart).toEqual({ planets: { Sun: { sign: 'Pisces' } } })
  })

  it('keeps the persona sheet the page renders, as plain strings', () => {
    expect(projected.personality.traits).toEqual(['Wise', 'Intuitive'])
    expect(projected.personality.gifts).toEqual([
      { type: 'Sight', description: 'sees', expression: 'quietly' },
    ])
    expect(projected.personality.shadows).toEqual([
      { type: 'Doubt', description: 'doubts', transformationPath: 'asks' },
    ])
    expect(projected.personality.challenges).toEqual([
      { type: 'Haste', description: 'rushes', growthOpportunity: 'waits' },
    ])
    expect(projected.abilities.wisdomDomains).toEqual(['Philosophy'])
    expect(projected.consciousness.monicaConstant).toBe(1.618)
    expect((projected.personality as any).core).toBeUndefined()
    expect((projected.appearance as any).aura).toBeUndefined()
  })

  it('rounds the Sacred 7 to whole numbers and withholds the planetary twelve', () => {
    expect(projected.sacredStats).toEqual({
      power: 71,
      resonance: 65,
      wisdom: 80,
      charisma: 56,
      intuition: 90,
      adaptability: 33,
      vitality: 48,
    })
  })

  it('has no Sacred 7 at all when the source is missing one, rather than inventing it', () => {
    const agent = poisonedAgent() as any
    delete agent.sacredStats.vitality
    expect(projectForgedAgentForPublic(agent).sacredStats).toBeUndefined()
    delete agent.sacredStats
    expect(projectForgedAgentForPublic(agent).sacredStats).toBeUndefined()
  })

  it('survives a hostile or empty agent without throwing', () => {
    const empty = projectForgedAgentForPublic({} as CraftedAgent)
    expect(empty.birthData).toEqual({ location: { name: 'Unknown' } })
    expect(
      JSON.stringify(projectForgedAgentForPublic({ consciousness: 'x' } as any))
    ).not.toContain('x"')
  })
})

describe('projectProgressionForPublic', () => {
  it('keeps experience and drops everything computed from the degrees', () => {
    const full = {
      agentId: 'agent-poisoned-1',
      vesselLevel: 7,
      totalXp: 4321,
      xpToNextLevel: 100,
      levelBoost: 0.7,
      baseOverall: 71.2,
      trainedOverall: 72,
      currentOverall: 74.4,
      transitDelta: 2.4,
      progressionStatus: 'live',
      asOf: '2026-10-25T00:00:00.000Z',
      expBreakdown: { training: 1 },
      trainingEvidence: { status: 'verified' },
      stats: { lunarReceptivity: 54.8765432 },
      statDeltas: { lunarReceptivity: 1.23456 },
      esmsAxisAttribution: { spirit: 0.1 },
      reasons: ['Natal DNA is authored'],
    } as any

    const projected: any = projectProgressionForPublic(full)
    expect(projected.vesselLevel).toBe(7)
    expect(projected.totalXp).toBe(4321)
    expect(projected.expBreakdown).toEqual({ training: 1 })
    for (const key of [
      'baseOverall',
      'trainedOverall',
      'currentOverall',
      'transitDelta',
      'asOf',
      'stats',
      'statDeltas',
      'esmsAxisAttribution',
    ]) {
      expect(projected[key]).toBeNull()
    }
    expect(projected.progressionStatus).toBe('unavailable')
    expect(projected.reasons).toEqual([PRIVATE_PROGRESSION_REASON])
    expect(JSON.stringify(projected)).not.toContain('54.87')
  })
})

// ── Parity with the gallery API ─────────────────────────────────────────────

describe('parity with GET /api/agents (PR #67)', () => {
  const rows = [
    {
      agentId: 'agent-forged-planets',
      name: 'Adept Astra',
      title: 'The Alchemist',
      birthDate: new Date('1991-03-14T04:07:00.000Z'),
      birthTime: '04:07',
      birthLocation: { lat: 64.1466, lon: -21.9426, name: 'Reykjavik' },
      historicalEra: 'user_created',
      craftedBy: 'philosopher-stone-user',
      natalChart: {
        planets: { Sun: { sign: 'Pisces', degree: 23.45 }, Moon: { sign: 'Cancer', degree: 12.1 } },
        ascendant: 62.4,
      },
    },
    {
      agentId: 'agent-forged-tropical',
      name: 'Sol Invictus',
      title: 'Solar Pilot',
      birthDate: new Date('1985-07-20T12:00:00.000Z'),
      birthTime: '12:00',
      birthLocation: 'Rome',
      historicalEra: 'MONICA_SPECIAL',
      craftedBy: 'philosopher-stone',
      natalChart: {
        tropical: {
          CelestialBodies: { all: [{ label: 'Sun', Sign: { label: 'Leo' }, degrees: 27.8 }] },
        },
      },
    },
    {
      agentId: 'agent-forged-sunless',
      name: 'Nameless',
      title: 'Void',
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      birthTime: '00:00',
      birthLocation: { lat: 1, lon: 2 },
      historicalEra: 'user_created',
      craftedBy: 'philosopher-stone-user',
      natalChart: { planets: { Moon: { sign: 'Cancer', degree: 1 } } },
    },
  ]

  beforeEach(() => {
    vi.resetModules()
    process.env.INTERNAL_API_SECRET = 'parity-secret'
  })
  afterEach(() => {
    delete process.env.INTERNAL_API_SECRET
    vi.restoreAllMocks()
  })

  it('projects the chart and the birth data exactly as the route does', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        historical_agents: { findMany: vi.fn().mockResolvedValue(rows) },
        created_agents: { findMany: vi.fn().mockResolvedValue([]) },
      },
    }))
    vi.doMock('@/lib/backend', () => ({
      backend: { agents: { list: vi.fn().mockResolvedValue([]), create: vi.fn() } },
    }))
    vi.doMock('@/lib/historical-agents-db', () => ({ HistoricalAgentsService: {} }))
    vi.doMock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))

    const { GET } = await import('@/app/api/agents/route')
    const res = await GET(new NextRequest('http://localhost:3000/api/agents'))
    const json: any = await res.json()

    for (const row of rows) {
      const served = json.agents.find((a: any) => a.id === row.agentId)
      expect(served, row.agentId).toBeDefined()
      expect(served.consciousness.natalChart).toEqual(projectPublicNatalChart(row.natalChart))
      expect(served.birthData).toEqual(projectPublicBirthData(row.birthLocation))
      expect(isForgedVesselRow(agentRowFacts(row))).toBe(served.isUserCreated)
    }
  })
})
