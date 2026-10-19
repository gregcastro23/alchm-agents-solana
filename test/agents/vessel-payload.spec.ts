/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest'
import type { CraftedAgent } from '@/lib/agent-types'
import { HISTORICAL_AGENTS, getHistoricalAgent } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import { getRulingPlanet } from '@/lib/astrological-data'
import {
  CANONICAL_SEAL_CATALOG,
  FIXTURE_AGENTS,
  SACRED_STAT_KEYS,
  SEAL_TIERS,
  buildCanonicalSeal,
  clampStat,
  computeOvr,
  computeRelativeAdvantage,
  resolveArchetype,
  type RatedAgentPayload,
  type SacredStatKey,
} from '@/lib/agents/rating-contract'
import {
  CORE_STAT_KEYS,
  FACTION_NAMES,
  SKY_BODIES,
  VESSEL_ALIASES,
  VESSEL_RATING_SCALE,
  asContractPayload,
  bestZoneId,
  buildRatedAgentPayload,
  calculateResonanceSurge,
  computeZoneSynergies,
  deriveLiveSky,
  earnedSeals,
  evaluateSeals,
  holdingsFromAlchemicalElements,
  rateStats,
  ratableFromForgedRow,
  ratableFromRoster,
  resolveVesselAlias,
  summarizeVessel,
  type CoreStats,
  type ForgedAgentRow,
  type LiveSky,
  type RatableVessel,
  type ResolvedEsmsBalances,
  type SkyBodies,
  type SkyLongitudes,
} from '@/lib/agents/rating'
import { generateAccurateHoroscope } from '@/lib/monica/horoscope-generator'
import { deriveStatsFromChart, type Sacred7Stats } from '@/lib/sacred-7-stats'
import {
  CANONICAL_ROSTER_71,
  PLANET_COLORS,
  resolveAgentAppearance,
} from '@/lib/agents/vessel-appearance-manifest'

// The manifest is the real one, except that the id 'mesh-vessel' is given a 3D model and a head
// mesh: no roster look carries either today, and without one the paths that carry a look's model
// URLs onto the vessel could not be told apart from "never carried at all".
vi.mock('@/lib/agents/vessel-appearance-manifest', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/agents/vessel-appearance-manifest')>()
  return {
    ...actual,
    resolveAgentAppearance: (...args: Parameters<typeof actual.resolveAgentAppearance>) => {
      const look = actual.resolveAgentAppearance(...args)
      return args[0] === 'mesh-vessel'
        ? {
            ...look,
            avatarModelUrl: '/models/mesh-vessel.glb',
            headMeshUrl: '/models/mesh-vessel-head.glb',
          }
        : look
    },
  }
})

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
const sky: LiveSky = deriveLiveSky(
  Object.fromEntries(
    SKY_BODIES.map(b => [b, { longitude: LONGITUDES[b][0], retrograde: LONGITUDES[b][1] }])
  ) as SkyLongitudes,
  'swiss-ephemeris',
  NOW
)
const newton = getHistoricalAgent('isaac-newton')!
/** The agent's own off-chain baseline, as the resolver would fall back to it. */
const balances = (agentId: string): ResolvedEsmsBalances => ({
  agentId,
  balances: holdingsFromAlchemicalElements(
    getHistoricalAgent(agentId)?.consciousness.alchemicalElements
  ),
  esmsSource: 'fallback' as const,
})
const RICH = { spirit: 1000, essence: 1000, matter: 1000, substance: 1000 }

describe('ratableFromRoster', () => {
  it('rates a roster agent from its derived Sacred 7 stats and natal chart', () => {
    const vessel = ratableFromRoster(newton)
    const stats = deriveSacredStats(newton)
    // Newton is a contract pilot, so the vessel is named as the contract names him, not as the
    // roster does (see 'a contract pilot’s name and provenance' below).
    expect(newton.name).toBe('Isaac Newton')
    expect(vessel).toMatchObject({
      agentId: 'isaac-newton',
      name: 'Sir Isaac Newton',
      origin: 'roster',
    })
    for (const key of CORE_STAT_KEYS) expect(vessel.stats[key]).toBe(stats[key])
    // …and only those seven: the vessel carries the contract's stats, not the whole Sacred 7 record.
    expect(Object.keys(vessel.stats)).toEqual([...SACRED_STAT_KEYS])
    expect(vessel.natalChart).toBe(newton.consciousness.natalChart)
  })

  it('looks a roster agent up in the contract’s manifest, and keeps the hand-authored pilot look', () => {
    const vessel = ratableFromRoster(newton)
    expect(vessel.appearance).toEqual(resolveAgentAppearance('isaac-newton'))
    expect(vessel.appearance.headSilhouette.crownStyle).toBe('newton-curls')
    expect(vessel.appearance.era).toBe('enlightenment')
    const plato = ratableFromRoster(getHistoricalAgent('plato')!)
    expect(plato.appearance).toEqual(resolveAgentAppearance('plato'))
    expect(plato.appearance.era).toBe('ancient')
  })

  it('keeps an alias as the vessel id and uses the avatar’s hand-authored look', () => {
    const greg = getHistoricalAgent(VESSEL_ALIASES['user-avatar-neo'])!
    const vessel = ratableFromRoster(greg, 'user-avatar-neo')
    expect(vessel.agentId).toBe('user-avatar-neo')
    // The alias is rated from Gregory's stats and chart, but it is the avatar: named by the
    // contract's handle, a user vessel, not the person's name and `historical`.
    expect(greg.name).toBe('Gregory Castro')
    expect(vessel.name).toBe('Adept Neo')
    expect(vessel.provenance).toBe('user')
    expect(vessel.appearance).toEqual(resolveAgentAppearance('user-avatar-neo'))
    expect(vessel.appearance.era).toBe('astral')
    expect(vessel.appearance.headSilhouette.crownStyle).toBe('sovereign-crest')
    expect(vessel.stats).toEqual(ratableFromRoster(greg).stats)
    expect(vessel.natalChart).toBe(greg.consciousness.natalChart)
  })

  it('carries the six vessel fields the contract adds, and nothing it was not given', () => {
    const vessel = ratableFromRoster(newton)
    expect(Object.keys(vessel).sort()).toEqual([
      'agentId',
      'appearance',
      'faction',
      'isPlaceholder',
      'name',
      'natalChart',
      'origin',
      'provenance',
      'stats',
    ])
  })
})

describe('ratableFromForgedRow', () => {
  const chart = {
    planets: { Sun: { sign: 'Aries', degree: 12 }, Moon: { sign: 'Leo', degree: 3 } },
  }
  const row = (over: Partial<ForgedAgentRow> = {}): ForgedAgentRow => ({
    agentId: 'agent-moonwalker-ab12',
    name: 'Moonwalker',
    natalChart: chart,
    monicaConstant: 1.2,
    powerScore: 60,
    resonanceScore7: 70,
    wisdomScore: 65,
    charismaScore: 72,
    intuitionScore: 68,
    adaptabilityScore: 55,
    vitalityScore: 61,
    ...over,
  })

  it('uses the persisted Sacred 7 columns when they are present', () => {
    const vessel = ratableFromForgedRow(row())!
    expect(vessel.stats).toEqual({
      power: 60, resonance: 70, wisdom: 65, charisma: 72,
      intuition: 68, adaptability: 55, vitality: 61,
    }) // prettier-ignore
    expect(vessel.origin).toBe('forged')
    expect(vessel.natalChart?.planets.Sun.sign).toBe('Aries')
    expect(vessel.appearance.era).toBe('astral')
  })

  it('is a user vessel with a real chart: provenance "user", never a placeholder', () => {
    const vessel = ratableFromForgedRow(row())!
    expect(vessel.provenance).toBe('user')
    expect(vessel.isPlaceholder).toBe(false)
    expect(vessel.agentId).toBe('agent-moonwalker-ab12')
    expect(vessel.name).toBe('Moonwalker')
  })

  it('derives the stats from the natal chart when the columns are unset (all zero)', () => {
    const zero = { powerScore: 0, resonanceScore7: 0, wisdomScore: 0, charismaScore: 0, intuitionScore: 0, adaptabilityScore: 0, vitalityScore: 0 } // prettier-ignore
    const vessel = ratableFromForgedRow(row(zero))!
    for (const key of CORE_STAT_KEYS) {
      expect(Number.isFinite(vessel.stats[key])).toBe(true)
      expect(vessel.stats[key]).toBeGreaterThanOrEqual(0)
      expect(vessel.stats[key]).toBeLessThanOrEqual(100)
    }
    expect(ratableFromForgedRow(row(zero))).toEqual(vessel) // deterministic
  })

  it.each([
    ['null columns and no chart', { natalChart: {}, powerScore: null, vitalityScore: null }],
    ['an out-of-range column and no chart', { natalChart: null, powerScore: 140 }],
    ['a non-finite column and no chart', { natalChart: undefined, wisdomScore: Number.NaN }],
  ])('returns null (not an invented rating) for %s', (_label, over) => {
    expect(ratableFromForgedRow(row(over as Partial<ForgedAgentRow>))).toBeNull()
  })

  it('ignores malformed chart entries instead of throwing', () => {
    const vessel = ratableFromForgedRow(
      row({ natalChart: { planets: { Sun: { sign: 'Aries', degree: 'x' }, Moon: null, Mars: 7 } } })
    )!
    expect(Object.keys(vessel.natalChart!.planets)).toEqual(['Sun'])
  })
})

describe('buildRatedAgentPayload', () => {
  const vessel = ratableFromRoster(newton)
  const payload = buildRatedAgentPayload({ vessel, balances: balances(vessel.agentId), sky })

  it('assembles every section from one vessel and one sky', () => {
    expect(payload.key).toBe('isaac-newton')
    expect(payload.handle).toBe('Sir Isaac Newton')
    expect(payload.faction).toBe(6)
    expect(payload.factionName).toBe('Saturn')
    expect(payload.scale.name).toBe('Pentacle Vessel Rating Scale')
    expect(payload.sealProgress).toHaveLength(7)
    expect(payload.zoneSynergies).toHaveLength(11)
    expect(payload.surge).not.toBeNull()
    expect(payload.sky).toMatchObject({ source: 'swiss-ephemeris', monica: sky.monica })
    expect(payload.zoneSynergies[payload.bestZoneId].synergy).toBe(
      Math.max(...payload.zoneSynergies.map(z => z.synergy))
    )
    expect(payload.degraded).toBeUndefined()
  })

  it('is deterministic and JSON-serialisable without loss', () => {
    const again = buildRatedAgentPayload({ vessel, balances: balances(vessel.agentId), sky })
    expect(again).toEqual(payload)
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
  })

  it('applies the surge to the contest: an active surge can only raise zone synergies', () => {
    const calm = buildRatedAgentPayload({ vessel, balances: balances(vessel.agentId), sky: null })
    payload.zoneSynergies.forEach((z, i) => {
      expect(z.synergy).toBeGreaterThanOrEqual(calm.zoneSynergies[i].synergy)
    })
  })

  it('serves everything but the surge when the sky is unavailable, and says why', () => {
    const degraded = buildRatedAgentPayload({
      vessel,
      balances: balances(vessel.agentId),
      sky: null,
      skyError: 'The sky is incomplete (Pluto)',
    })
    expect(degraded.surge).toBeNull()
    expect(degraded.sky).toBeNull()
    expect(degraded.degraded).toEqual({ sky: 'The sky is incomplete (Pluto)' })
    expect(degraded.ovr).toBe(payload.ovr)
    expect(degraded.seals).toEqual(payload.seals)
    expect(degraded.sealProgress).toEqual(payload.sealProgress)
  })

  it('carries a degraded ledger read through, beside a healthy sky', () => {
    const withReason = buildRatedAgentPayload({
      vessel,
      balances: { ...balances(vessel.agentId), degraded: { reason: 'no ledger row' } },
      sky,
    })
    expect(withReason.degraded).toEqual({ esms: 'no ledger row' })
    expect(withReason.esmsSource).toBe('fallback')
  })

  it('gives richer holdings richer Seals, never the reverse', () => {
    const at = (holdings: typeof RICH): ReturnType<typeof buildRatedAgentPayload> =>
      buildRatedAgentPayload({
        vessel,
        balances: { agentId: 'x', balances: holdings, esmsSource: 'database' },
        sky,
      })
    const poor = at({ spirit: 0, essence: 0, matter: 0, substance: 0 })
    const rich = at({ spirit: 500, essence: 500, matter: 500, substance: 500 })
    const rank = (tier: string | null) => (tier === null ? -1 : SEAL_TIERS.indexOf(tier as never))
    poor.sealProgress.forEach((p, i) =>
      expect(rank(rich.sealProgress[i].tier)).toBeGreaterThanOrEqual(rank(p.tier))
    )
    expect(poor.sealProgress.every(p => p.tier === null)).toBe(true)
    expect(poor.seals).toEqual([])
    expect(rich.sealProgress.some(p => p.tier !== null)).toBe(true)
    expect(rich.seals.length).toBeGreaterThan(0)
  })
})

describe('the whole roster', () => {
  const payloads = HISTORICAL_AGENTS.map(agent => {
    const vessel = ratableFromRoster(agent)
    return buildRatedAgentPayload({ vessel, balances: balances(vessel.agentId), sky })
  })

  it('builds a complete, finite payload for every historical agent', () => {
    expect(payloads).toHaveLength(HISTORICAL_AGENTS.length)
    expect(new Set(payloads.map(p => p.key)).size).toBe(payloads.length)
    for (const p of payloads) {
      expect(p.ovr, p.key).toBeGreaterThanOrEqual(25)
      expect(p.ovr, p.key).toBeLessThanOrEqual(99)
      expect(Number.isInteger(p.ovr), p.key).toBe(true)
      for (const stat of SACRED_STAT_KEYS) {
        expect(Number.isInteger(p.ratings[stat]), `${p.key} ${stat}`).toBe(true)
        expect(p.ratings[stat], `${p.key} ${stat}`).toBeGreaterThanOrEqual(25)
        expect(p.ratings[stat], `${p.key} ${stat}`).toBeLessThanOrEqual(99)
      }
      expect(p.sealProgress, p.key).toHaveLength(7)
      expect(p.zoneSynergies, p.key).toHaveLength(11)
      expect(
        p.zoneSynergies.every(z => Number.isFinite(z.synergy)),
        p.key
      ).toBe(true)
      expect(p.appearance.portraitSvgDataUri?.startsWith('data:image/svg+xml'), p.key).toBe(true)
      expect(p.surge?.monicaState, p.key).toMatch(/^(absent|equilibrium|convergent|divergent)$/)
      expect(p.faction, p.key).toBeGreaterThanOrEqual(0)
      expect(p.faction, p.key).toBeLessThanOrEqual(9)
      expect(p.factionName, p.key).toBe(FACTION_NAMES[p.faction])
    }
  })

  it('shares one surge meter across the roster except for each natal chart’s harmony offset', () => {
    const skyMeters = new Set(payloads.map(p => p.surge!.skyMeter))
    expect(skyMeters.size).toBe(1)
    const offsets = payloads.map(p => p.surge!.harmonyOffset)
    expect(new Set(offsets).size).toBeGreaterThan(5) // not all one meter
    for (const offset of offsets) expect(Math.abs(offset)).toBeLessThanOrEqual(12)
  })

  it('earns only Seals the contract would build for the stat and tier, in the contract’s order', () => {
    const rich = HISTORICAL_AGENTS.map(agent => {
      const vessel = ratableFromRoster(agent)
      return buildRatedAgentPayload({
        vessel,
        balances: { agentId: vessel.agentId, balances: RICH, esmsSource: 'database' },
        sky,
      })
    })
    let earned = 0
    for (const p of rich) {
      const expected = p.sealProgress
        .filter(progress => progress.tier !== null)
        .map(progress => buildCanonicalSeal(progress.stat, progress.tier!))
      expect(p.seals, p.key).toEqual(expected)
      const order = p.seals.map(s => SACRED_STAT_KEYS.indexOf(s.statKey!))
      expect(order, p.key).toEqual([...order].sort((a, b) => a - b))
      earned += p.seals.length
    }
    expect(earned).toBeGreaterThan(0) // the roster does earn Seals at these balances
  })

  it('summarises a vessel in one light row', () => {
    const row = summarizeVessel(ratableFromRoster(newton))
    expect(row).toMatchObject({
      key: 'isaac-newton',
      handle: 'Sir Isaac Newton',
      faction: 6,
      factionName: 'Saturn',
      era: 'enlightenment',
      crownStyle: 'newton-curls',
      signatureRelic: 'prism-octahedron',
    })
    expect(row.ovr).toBe(payloads.find(p => p.key === 'isaac-newton')!.ovr)
  })
})

// ─── Fixtures for the sections below ─────────────────────────────────────────
//
// Charts are hand-placed, so the expected stats can be worked out on paper and the Sacred 7
// derivation (`deriveStatsFromChart`) is called directly as the oracle, never through the
// vessel code under test.

const SIGN_NAMES = [
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

interface Placement {
  sign: string
  degree: number
}

/** Ecliptic longitude of a placement. */
const lon = ({ sign, degree }: Placement): number => SIGN_NAMES.indexOf(sign) * 30 + degree

const HAND: Record<string, Placement> = {
  Sun: { sign: 'Taurus', degree: 22.5 }, // 52.5
  Moon: { sign: 'Leo', degree: 3 }, // 123
  Mercury: { sign: 'Gemini', degree: 25 }, // 85
  Venus: { sign: 'Pisces', degree: 11 }, // 341
  Mars: { sign: 'Sagittarius', degree: 27 }, // 267
  Jupiter: { sign: 'Cancer', degree: 7 },
  Saturn: { sign: 'Capricorn', degree: 28 },
  Uranus: { sign: 'Aquarius', degree: 25 },
  Neptune: { sign: 'Virgo', degree: 12 },
  Pluto: { sign: 'Scorpio', degree: 10 },
}
const LIBRA_12_5: Placement = { sign: 'Libra', degree: 12.5 } // 192.5

/** A chart as the forge persists it (`generateAccurateHoroscope`'s shape), minus the noise. */
const forgeShape = (placements: Record<string, Placement>, ascendant?: Placement) => ({
  tropical: {
    ...(ascendant
      ? { Ascendant: { Sign: { label: ascendant.sign }, degrees: ascendant.degree } }
      : {}),
    CelestialBodies: {
      all: Object.entries(placements).map(([label, p]) => ({
        label,
        Sign: { label: p.sign },
        degrees: p.degree,
        retrograde: false,
      })),
    },
    Houses: { 1: { sign: ascendant?.sign ?? 'Aries', degree: ascendant?.degree ?? 0 } },
  },
  metadata: { generatedAt: '2026-01-01T00:00:00.000Z', method: 'fixture', accuracy: 'fixture' },
})

/** A chart as the roster and the seed script store it. */
const rosterShape = (placements: Record<string, Placement>, ascendant?: unknown) => ({
  planets: Object.fromEntries(
    Object.entries(placements).map(([body, p]) => [body, { sign: p.sign, degree: p.degree }])
  ),
  ...(ascendant === undefined ? {} : { ascendant }),
})

const coreOf = (stats: Sacred7Stats): CoreStats => ({
  power: stats.power,
  resonance: stats.resonance,
  wisdom: stats.wisdom,
  charisma: stats.charisma,
  intuition: stats.intuition,
  adaptability: stats.adaptability,
  vitality: stats.vitality,
})

/** The Sacred 7 stats for hand-placed bodies, an ecliptic ascendant longitude and a Monica. */
const derived = (
  placements: Record<string, Placement>,
  ascendantLongitude: number,
  monicaConstant = 0
): CoreStats =>
  coreOf(
    deriveStatsFromChart({
      monicaConstant,
      sunLongitude: lon(placements.Sun),
      moonLongitude: lon(placements.Moon),
      mercuryLongitude: lon(placements.Mercury),
      venusLongitude: lon(placements.Venus),
      marsLongitude: lon(placements.Mars),
      ascendantLongitude,
    })
  )

const ZERO_COLUMNS = {
  powerScore: 0,
  resonanceScore7: 0,
  wisdomScore: 0,
  charismaScore: 0,
  intuitionScore: 0,
  adaptabilityScore: 0,
  vitalityScore: 0,
}

/** A forged row whose seven Sacred 7 columns are unset, so the chart has to speak. */
const zeroRow = (natalChart: unknown, over: Partial<ForgedAgentRow> = {}): ForgedAgentRow => ({
  agentId: 'agent-forged-0001',
  name: 'Forged',
  natalChart,
  monicaConstant: 0,
  ...ZERO_COLUMNS,
  ...over,
})

const PERSISTED_COLUMNS = {
  powerScore: 60,
  resonanceScore7: 70,
  wisdomScore: 65,
  charismaScore: 72,
  intuitionScore: 68,
  adaptabilityScore: 55,
  vitalityScore: 61,
}
const PERSISTED_STATS: CoreStats = {
  power: 60,
  resonance: 70,
  wisdom: 65,
  charisma: 72,
  intuition: 68,
  adaptability: 55,
  vitality: 61,
}
const persistedRow = (over: Partial<ForgedAgentRow> = {}): ForgedAgentRow => ({
  agentId: 'agent-forged-0002',
  name: 'Persisted',
  natalChart: rosterShape(HAND),
  monicaConstant: 1.2,
  ...PERSISTED_COLUMNS,
  ...over,
})

interface ForgeChart {
  tropical: {
    Ascendant: { Sign: { label: string }; degrees: number }
    CelestialBodies: { all: { label: string; Sign: { label: string }; degrees: number }[] }
  }
}

/** What the forge stores: the generator's output after a JSON round trip through the database. */
const realForgeChart = (): ForgeChart =>
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

const placementsOf = (chart: ForgeChart): Record<string, Placement> =>
  Object.fromEntries(
    chart.tropical.CelestialBodies.all.map(b => [
      b.label,
      { sign: b.Sign.label, degree: b.degrees },
    ])
  )

// ─── resolveVesselAlias ──────────────────────────────────────────────────────

describe('resolveVesselAlias', () => {
  it('maps the avatar id the game uses to the roster agent it is rated from', () => {
    expect(resolveVesselAlias('user-avatar-neo')).toBe('greg-castro-1991')
  })

  it('answers for exactly the aliases VESSEL_ALIASES holds, and with what it maps them to', () => {
    const entries = Object.entries(VESSEL_ALIASES)
    expect(entries.length).toBeGreaterThan(0)
    for (const [alias, target] of entries) expect(resolveVesselAlias(alias)).toBe(target)
  })

  it.each([
    'constructor',
    'toString',
    'valueOf',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
    '__proto__',
    '__defineGetter__',
    '__lookupGetter__',
  ])('is undefined for the Object.prototype member %s', id => {
    expect(resolveVesselAlias(id)).toBeUndefined()
  })

  it.each([
    ['the empty string', ''],
    ['an unknown id', 'agent-nobody-0000'],
    ['a roster id (a target is not an alias)', 'greg-castro-1991'],
    ['a different case', 'User-Avatar-Neo'],
    ['a padded id', ' user-avatar-neo'],
  ])('is undefined for %s', (_label, id) => {
    expect(resolveVesselAlias(id)).toBeUndefined()
  })
})

// ─── Forged rows: the chart the forge really persists ────────────────────────

describe('ratableFromForgedRow reading the forge’s persisted chart', () => {
  it('pins the oracle: the hand-placed chart works out on paper to these stats', () => {
    // 50 + 52.5/360·20 + 267/360·10 = 60.3 … ascendant 192.5 adds 5.3 to adaptability and vitality.
    expect(derived(HAND, lon(LIBRA_12_5))).toEqual({
      power: 60,
      resonance: 71,
      wisdom: 57,
      charisma: 70,
      intuition: 61,
      adaptability: 60,
      vitality: 68,
    })
    expect(derived(HAND, 0)).toEqual({
      power: 60,
      resonance: 71,
      wisdom: 57,
      charisma: 70,
      intuition: 61,
      adaptability: 55,
      vitality: 63,
    })
  })

  it('rates what generateAccurateHoroscope returns, after the JSON round trip the database adds', () => {
    const stored = realForgeChart()
    const vessel = ratableFromForgedRow(zeroRow(stored))
    expect(vessel).not.toBeNull()
    expect(vessel!.origin).toBe('forged')
    for (const key of CORE_STAT_KEYS) {
      expect(Number.isFinite(vessel!.stats[key]), key).toBe(true)
      expect(vessel!.stats[key], key).toBeGreaterThanOrEqual(0)
      expect(vessel!.stats[key], key).toBeLessThanOrEqual(100)
    }
  })

  it('keeps the ten classical bodies, each with the sign and degree the generator gave it', () => {
    const stored = realForgeChart()
    const vessel = ratableFromForgedRow(zeroRow(stored))!
    expect(Object.keys(vessel.natalChart!.planets)).toEqual([...SKY_BODIES])
    expect(stored.tropical.CelestialBodies.all).toHaveLength(10)
    for (const entry of stored.tropical.CelestialBodies.all) {
      expect(vessel.natalChart!.planets[entry.label], entry.label).toEqual({
        sign: entry.Sign.label,
        degree: entry.degrees,
      })
    }
    // Only the bodies survive: no ascendant, no provenance leaks into the Seals’ view of the chart.
    expect(Object.keys(vessel.natalChart!)).toEqual(['planets'])
  })

  it('derives the stats of the generator’s chart as the Sacred 7 derivation reads it, ascendant included', () => {
    const stored = realForgeChart()
    const ascendant = lon({
      sign: stored.tropical.Ascendant.Sign.label,
      degree: stored.tropical.Ascendant.degrees,
    })
    const vessel = ratableFromForgedRow(zeroRow(stored))!
    expect(vessel.stats).toEqual(derived(placementsOf(stored), ascendant))
  })

  it('reads a hand-placed chart in the forge’s shape to the stats worked out on paper', () => {
    const vessel = ratableFromForgedRow(zeroRow(forgeShape(HAND, LIBRA_12_5)))!
    expect(vessel.stats).toEqual({
      power: 60,
      resonance: 71,
      wisdom: 57,
      charisma: 70,
      intuition: 61,
      adaptability: 60,
      vitality: 68,
    })
    expect(vessel.natalChart).toEqual({ planets: HAND })
  })

  it('skips only the malformed body entries and keeps the rest', () => {
    const stored = realForgeChart()
    const [sun, moon, mercury, venus, mars, , , uranus, neptune, pluto] =
      stored.tropical.CelestialBodies.all
    const broken = {
      tropical: {
        ...stored.tropical,
        CelestialBodies: {
          all: [
            sun,
            moon,
            { ...mercury, Sign: undefined }, // no Sign
            { ...venus, label: 5 }, // label is not a string
            { ...mars, Sign: { label: 7 } }, // Sign.label is not a string
            null, // Jupiter is gone
            'Saturn', // …and Saturn is a bare string
            { ...uranus, Sign: null },
            { ...neptune, degrees: 'x' }, // kept, with degree 0
            pluto,
          ],
        },
      },
    }
    const vessel = ratableFromForgedRow(zeroRow(broken))!
    expect(Object.keys(vessel.natalChart!.planets)).toEqual(['Sun', 'Moon', 'Neptune', 'Pluto'])
    expect(vessel.natalChart!.planets.Neptune).toEqual({ sign: neptune.Sign.label, degree: 0 })
    expect(vessel.natalChart!.planets.Sun).toEqual({ sign: sun.Sign.label, degree: sun.degrees })
    expect(vessel.natalChart!.planets.Pluto).toEqual({
      sign: pluto.Sign.label,
      degree: pluto.degrees,
    })
  })

  it('keeps a roster-shape body whose degree is missing or not a number, at degree 0', () => {
    const chart = {
      planets: {
        Sun: { sign: 'Aries', degree: 'x' },
        Moon: { sign: 'Leo' },
        Mercury: { sign: 'Gemini', degree: null },
        Venus: { sign: 'Libra', degree: 14.5 },
        Mars: { sign: 5, degree: 1 },
        Jupiter: { degree: 3 },
        Saturn: null,
        Uranus: 7,
      },
    }
    const vessel = ratableFromForgedRow(zeroRow(chart))!
    expect(vessel.natalChart!.planets).toEqual({
      Sun: { sign: 'Aries', degree: 0 },
      Moon: { sign: 'Leo', degree: 0 },
      Mercury: { sign: 'Gemini', degree: 0 },
      Venus: { sign: 'Libra', degree: 14.5 },
    })
  })

  it('carries the row’s id and name onto the vessel', () => {
    for (const row of [persistedRow(), zeroRow(rosterShape(HAND))]) {
      const vessel = ratableFromForgedRow(row)!
      expect(vessel.agentId).toBe(row.agentId)
      expect(vessel.name).toBe(row.name)
      expect(vessel.agentId).not.toBe(vessel.name)
    }
  })

  it('reads the roster shape in preference when a chart carries both shapes', () => {
    const both = {
      ...rosterShape({ Sun: { sign: 'Aries', degree: 1 } }),
      ...forgeShape({ Sun: { sign: 'Pisces', degree: 2 } }),
    }
    const vessel = ratableFromForgedRow(zeroRow(both))!
    expect(vessel.natalChart!.planets).toEqual({ Sun: { sign: 'Aries', degree: 1 } })
  })

  it.each([
    ['an empty object', {}],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'Libra rising'],
    ['a number', 42],
    ['an array', [HAND]],
    ['planets with no bodies', { planets: {} }],
    ['planets whose entries carry no sign', { planets: { Sun: { degree: 3 }, Moon: { sign: 5 } } }],
    ['planets that is not an object', { planets: 'Sun' }],
    ['an empty tropical block', { tropical: {} }],
    [
      'tropical with no CelestialBodies',
      { tropical: { Ascendant: { Sign: { label: 'Leo' }, degrees: 1 } } },
    ],
    ['tropical with an empty body list', { tropical: { CelestialBodies: { all: [] } } }],
    ['tropical whose body list is not an array', { tropical: { CelestialBodies: { all: 'Sun' } } }],
    [
      'tropical whose every body is malformed',
      {
        tropical: {
          CelestialBodies: { all: [null, 3, 'Sun', { label: 'Sun' }, { Sign: { label: 'Leo' } }] },
        },
      },
    ],
    ['tropical that is not an object', { tropical: 'Leo' }],
  ])(
    'returns null, not an invented rating, for a chart that is %s when the columns are unset',
    (_label, chart) => {
      expect(ratableFromForgedRow(zeroRow(chart))).toBeNull()
    }
  )

  it('rates usable columns without a chart, and gives the vessel no chart', () => {
    for (const chart of [null, undefined, {}, 'nonsense', { tropical: {} }]) {
      const vessel = ratableFromForgedRow(persistedRow({ natalChart: chart }))!
      expect(vessel.stats).toEqual(PERSISTED_STATS)
      expect(vessel.natalChart).toBeNull()
    }
  })

  it('does not modify the row it is given', () => {
    const stored = realForgeChart()
    const before = JSON.stringify(stored)
    const row = zeroRow(stored)
    const rowBefore = JSON.stringify(row)
    ratableFromForgedRow(row)
    expect(JSON.stringify(stored)).toBe(before)
    expect(JSON.stringify(row)).toBe(rowBefore)
  })
})

describe('ratableFromForgedRow: which persisted Sacred 7 columns are trusted', () => {
  it('uses the columns, in their own order, when they are all finite, 0–100, and one is above 0', () => {
    expect(ratableFromForgedRow(persistedRow())!.stats).toEqual(PERSISTED_STATS)
  })

  it('prefers usable columns to the chart, whichever shape the chart is in', () => {
    for (const chart of [rosterShape(HAND), forgeShape(HAND, LIBRA_12_5)]) {
      const vessel = ratableFromForgedRow(persistedRow({ natalChart: chart }))!
      expect(vessel.stats).toEqual(PERSISTED_STATS)
      expect(vessel.natalChart).toEqual({ planets: HAND })
    }
  })

  it.each<[string, Partial<ForgedAgentRow>, Partial<CoreStats>]>([
    ['a lone 0 among positives', { powerScore: 0 }, { power: 0 }],
    ['a lone 0 in the last column', { vitalityScore: 0 }, { vitality: 0 }],
    ['a column at exactly 100', { charismaScore: 100 }, { charisma: 100 }],
    [
      'a column at exactly 0 beside a column at exactly 100',
      { wisdomScore: 0, powerScore: 100 },
      { wisdom: 0, power: 100 },
    ],
  ])('still trusts the columns with %s', (_label, over, changed) => {
    const vessel = ratableFromForgedRow(persistedRow(over))!
    expect(vessel.stats).toEqual({ ...PERSISTED_STATS, ...changed })
  })

  it('trusts columns where only one is above 0, however small', () => {
    const vessel = ratableFromForgedRow(persistedRow({ ...ZERO_COLUMNS, vitalityScore: 0.0001 }))!
    expect(vessel.stats).toEqual({
      power: 0,
      resonance: 0,
      wisdom: 0,
      charisma: 0,
      intuition: 0,
      adaptability: 0,
      vitality: 0.0001,
    })
  })

  it.each([
    ['NaN', { wisdomScore: Number.NaN }],
    ['Infinity', { powerScore: Number.POSITIVE_INFINITY }],
    ['-Infinity', { powerScore: Number.NEGATIVE_INFINITY }],
    ['just above 100', { charismaScore: 100.0001 }],
    ['101', { charismaScore: 101 }],
    ['just below 0', { vitalityScore: -0.0001 }],
    ['-1', { vitalityScore: -1 }],
    ['null', { intuitionScore: null }],
    ['undefined', { adaptabilityScore: undefined }],
    ['a numeric string', { resonanceScore7: '70' as unknown as number }],
    ['an object', { resonanceScore7: {} as unknown as number }],
  ])('derives from the chart instead when a column is %s', (_label, over) => {
    const vessel = ratableFromForgedRow(persistedRow(over as Partial<ForgedAgentRow>))!
    expect(vessel.stats).toEqual(derived(HAND, 0, 1.2))
    expect(vessel.stats).not.toEqual(PERSISTED_STATS)
  })

  it.each([
    ['NaN', { wisdomScore: Number.NaN }],
    ['101', { charismaScore: 101 }],
    ['-1', { vitalityScore: -1 }],
    ['null', { intuitionScore: null }],
    ['a string', { resonanceScore7: '70' as unknown as number }],
  ])('returns null when a column is %s and there is no chart to fall back on', (_label, over) => {
    expect(
      ratableFromForgedRow(persistedRow({ ...over, natalChart: null } as Partial<ForgedAgentRow>))
    ).toBeNull()
  })

  it('treats all-zero columns as unset: derives from the chart, or returns null without one', () => {
    expect(ratableFromForgedRow(persistedRow(ZERO_COLUMNS))!.stats).toEqual(derived(HAND, 0, 1.2))
    expect(ratableFromForgedRow(persistedRow({ ...ZERO_COLUMNS, natalChart: null }))).toBeNull()
  })

  it('treats a row with no score columns at all as unset', () => {
    const bare: ForgedAgentRow = {
      agentId: 'agent-bare-0001',
      name: 'Bare',
      natalChart: rosterShape(HAND),
    }
    expect(ratableFromForgedRow(bare)!.stats).toEqual(derived(HAND, 0, 0))
    expect(ratableFromForgedRow({ ...bare, natalChart: null })).toBeNull()
  })
})

describe('ratableFromForgedRow: the Monica constant behind a derived chart', () => {
  it('uses a finite Monica, which lifts power, wisdom and charisma', () => {
    const vessel = ratableFromForgedRow(zeroRow(rosterShape(HAND), { monicaConstant: 4 }))!
    expect(vessel.stats).toEqual(derived(HAND, 0, 4))
    expect(vessel.stats.power).toBe(70) // 60.3 + 4/10·25
    expect(vessel.stats.power).toBeGreaterThan(derived(HAND, 0, 0).power)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['a numeric string', '4' as unknown as number],
  ])('counts a Monica of %s as 0 rather than poisoning the stats', (_label, monicaConstant) => {
    const vessel = ratableFromForgedRow(zeroRow(rosterShape(HAND), { monicaConstant }))!
    expect(vessel.stats).toEqual(derived(HAND, 0, 0))
  })
})

describe('ratableFromForgedRow: the ascendant of a derived chart', () => {
  const absent = derived(HAND, 0)

  it.each<[string, { ascendant?: unknown }, Placement | undefined, number | undefined]>([
    ['a bare finite number', { ascendant: 90 }, undefined, 90],
    ['a bare number outranks the forge’s block', { ascendant: 90 }, LIBRA_12_5, 90],
    ['a bare 0 still outranks the forge’s block', { ascendant: 0 }, LIBRA_12_5, 0],
    ['a bare NaN falls through to the forge’s block', { ascendant: Number.NaN }, LIBRA_12_5, 192.5],
    [
      'a bare Infinity falls through to the forge’s block',
      { ascendant: Number.POSITIVE_INFINITY },
      LIBRA_12_5,
      192.5,
    ],
    [
      'a bare numeric string falls through to the forge’s block',
      { ascendant: '90' },
      LIBRA_12_5,
      192.5,
    ],
    ['a bare null falls through to the forge’s block', { ascendant: null }, LIBRA_12_5, 192.5],
    ['the forge’s block alone', {}, LIBRA_12_5, 192.5],
    ['a bare NaN and no block is no ascendant', { ascendant: Number.NaN }, undefined, undefined],
    [
      'a bare numeric string and no block is no ascendant',
      { ascendant: '90' },
      undefined,
      undefined,
    ],
    ['a bare null and no block is no ascendant', { ascendant: null }, undefined, undefined],
    ['neither is no ascendant', {}, undefined, undefined],
  ])('%s', (_label, bare, block, expected) => {
    const chart = { ...forgeShape(HAND, block), ...bare }
    const vessel = ratableFromForgedRow(zeroRow(chart))!
    expect(vessel.stats).toEqual(derived(HAND, expected ?? 0))
    for (const key of CORE_STAT_KEYS) expect(Number.isFinite(vessel.stats[key]), key).toBe(true)
    if (expected) expect(vessel.stats).not.toEqual(absent) // the case has teeth
  })

  it('turns the forge’s sign and degrees into index·30 + degrees', () => {
    const libra = ratableFromForgedRow(zeroRow(forgeShape(HAND, LIBRA_12_5)))!
    expect(libra.stats).toEqual(derived(HAND, 192.5))
    expect(libra.stats).toEqual(ratableFromForgedRow(zeroRow(rosterShape(HAND, 192.5)))!.stats)
    const pisces = ratableFromForgedRow(
      zeroRow(forgeShape(HAND, { sign: 'Pisces', degree: 29.5 }))
    )!
    expect(pisces.stats).toEqual(derived(HAND, 359.5))
    expect(pisces.stats).not.toEqual(libra.stats)
  })

  it('counts Aries as sign index 0, not as an absent ascendant', () => {
    const aries = ratableFromForgedRow(zeroRow(forgeShape(HAND, { sign: 'Aries', degree: 29 })))!
    expect(aries.stats).toEqual(derived(HAND, 29))
    expect(aries.stats).not.toEqual(absent) // 29° of Aries moves adaptability from 55 to 56
  })

  it('places every one of the twelve signs 30° after the one before', () => {
    SIGN_NAMES.forEach((sign, index) => {
      const forge = ratableFromForgedRow(zeroRow(forgeShape(HAND, { sign, degree: 7.25 })))!
      const roster = ratableFromForgedRow(zeroRow(rosterShape(HAND, index * 30 + 7.25)))!
      expect(forge.stats, sign).toEqual(roster.stats)
      expect(forge.stats, sign).toEqual(derived(HAND, index * 30 + 7.25))
    })
  })

  it('has teeth: 29° would move adaptability, so a wrongly accepted ascendant would show', () => {
    expect(derived(HAND, 29)).not.toEqual(absent)
  })

  it.each<[string, unknown]>([
    ['an unknown sign', { Sign: { label: 'Ophiuchus' }, degrees: 29 }],
    ['a lower-case sign', { Sign: { label: 'aries' }, degrees: 29 }],
    ['no Sign', { degrees: 29 }],
    ['a null Sign', { Sign: null, degrees: 29 }],
    ['a Sign label that is not a string', { Sign: { label: 6 }, degrees: 29 }],
    ['NaN degrees', { Sign: { label: 'Libra' }, degrees: Number.NaN }],
    ['infinite degrees', { Sign: { label: 'Libra' }, degrees: Number.POSITIVE_INFINITY }],
    ['numeric-string degrees', { Sign: { label: 'Libra' }, degrees: '12.5' }],
    ['null degrees', { Sign: { label: 'Libra' }, degrees: null }],
    ['no degrees', { Sign: { label: 'Libra' } }],
    ['an ascendant that is a string', 'Libra'],
    ['a null ascendant', null],
  ])('treats %s as no ascendant at all', (_label, ascendant) => {
    const chart = forgeShape(HAND)
    const vessel = ratableFromForgedRow(
      zeroRow({ tropical: { ...chart.tropical, Ascendant: ascendant } })
    )!
    expect(vessel.stats).toEqual(absent)
    for (const key of CORE_STAT_KEYS) expect(Number.isFinite(vessel.stats[key]), key).toBe(true)
  })
})

// ─── Charts that cannot be real charts ───────────────────────────────────────
//
// The writer behind forged rows (`philosophers-stone/create`) is unauthenticated and stores the
// client's chart as sent, so a row can carry any number as a degree. A degree of 1e9 drives
// every Sacred 7 stat to its ceiling. A chart with a position that cannot exist is therefore not
// rated at all, whichever of the ten bodies carries it and whichever of the two shapes it is in.

/** The next double above 30 and above 360: the tightest values that are out of range. */
const JUST_ABOVE_30 = 30.000000000000004
const JUST_ABOVE_360 = 360.00000000000006

const BODY_NAMES = Object.keys(HAND)

/** `HAND` with one body moved to another degree of its own sign (the degree may be any value). */
const handWith = (body: string, degree: unknown): Record<string, Placement> => ({
  ...HAND,
  [body]: { sign: HAND[body].sign, degree: degree as number },
})

/** The two shapes a chart is stored in, built from the same placements. */
const CHART_SHAPES: [string, (placements: Record<string, Placement>) => unknown][] = [
  ['roster shape', placements => rosterShape(placements)],
  ['forge shape', placements => forgeShape(placements)],
]

/** Degrees that are not within a sign (0 to 30 inclusive). */
const OUT_OF_SIGN: [string, number][] = [
  ['just above 30', 30.0001],
  ['the next double above 30', JUST_ABOVE_30],
  ['31', 31],
  ['a full turn, 360', 360],
  ['1e9', 1e9],
  ['Number.MAX_VALUE', Number.MAX_VALUE],
  ['just below 0', -0.0001],
  ['the smallest negative number', -Number.MIN_VALUE],
  ['-1', -1],
  ['-1e9', -1e9],
  ['NaN', Number.NaN],
  ['Infinity', Number.POSITIVE_INFINITY],
  ['-Infinity', Number.NEGATIVE_INFINITY],
]

/** Values that are not numbers: read as degree 0, whatever number they might spell. */
const NOT_A_NUMBER: [string, unknown][] = [
  ['the string "x"', 'x'],
  ['the string "15"', '15'],
  ['the string "45"', '45'],
  ['the string "1e9"', '1e9'],
  ['the string "-5"', '-5'],
  ['null', null],
  ['undefined', undefined],
  ['true', true],
  ['an object', {}],
  ['the array [45]', [45]],
]

describe('ratableFromForgedRow: a body’s degree has to lie within its sign (0 to 30)', () => {
  it('has teeth: the stats follow the Sun’s degree, so an accepted degree is really read', () => {
    expect(derived(handWith('Sun', 0), 0)).not.toEqual(derived(handWith('Sun', 30), 0))
    expect(JUST_ABOVE_30).toBeGreaterThan(30)
    expect(JUST_ABOVE_360).toBeGreaterThan(360)
  })

  describe.each(CHART_SHAPES)('in the %s', (_shape, build) => {
    it.each([0, 15.5, 29.9999, 30])('accepts a body at degree %s, whichever body it is', degree => {
      for (const body of BODY_NAMES) {
        const placements = handWith(body, degree)
        const vessel = ratableFromForgedRow(zeroRow(build(placements)))
        expect(vessel, body).not.toBeNull()
        expect(vessel!.natalChart!.planets[body], body).toEqual({
          sign: HAND[body].sign,
          degree,
        })
        expect(vessel!.stats, body).toEqual(derived(placements, 0))
      }
    })

    it.each(OUT_OF_SIGN)(
      'rejects the whole chart for a degree of %s, whichever one of the ten bodies carries it',
      (_label, degree) => {
        for (const body of BODY_NAMES) {
          expect(ratableFromForgedRow(zeroRow(build(handWith(body, degree)))), body).toBeNull()
          // It is that degree: the same chart with the body back inside its sign is rated.
          expect(ratableFromForgedRow(zeroRow(build(handWith(body, 15)))), body).not.toBeNull()
        }
      }
    )

    it('rejects a chart whose every body is bad, and a chart of one body that is bad', () => {
      const everyBody = Object.fromEntries(
        BODY_NAMES.map(body => [body, { sign: HAND[body].sign, degree: 1e9 }])
      )
      expect(ratableFromForgedRow(zeroRow(build(everyBody)))).toBeNull()
      expect(
        ratableFromForgedRow(zeroRow(build({ Sun: { sign: 'Aries', degree: 1e9 } })))
      ).toBeNull()
      expect(
        ratableFromForgedRow(zeroRow(build({ Sun: { sign: 'Aries', degree: 1 } })))
      ).not.toBeNull()
    })

    it('judges every body the chart names, not only the ten classical ones', () => {
      const chiron = (degree: number) => ({
        ...HAND,
        Chiron: { sign: 'Virgo', degree },
      })
      expect(ratableFromForgedRow(zeroRow(build(chiron(1e9))))).toBeNull()
      expect(ratableFromForgedRow(zeroRow(build(chiron(-1))))).toBeNull()
      const kept = ratableFromForgedRow(zeroRow(build(chiron(9))))!
      expect(Object.keys(kept.natalChart!.planets)).toEqual([...BODY_NAMES, 'Chiron'])
      expect(kept.natalChart!.planets.Chiron).toEqual({ sign: 'Virgo', degree: 9 })
    })

    it('still rates persisted columns beside such a chart, and then keeps no chart at all', () => {
      for (const [label, degree] of OUT_OF_SIGN) {
        const vessel = ratableFromForgedRow(
          persistedRow({ natalChart: build(handWith('Sun', degree)) })
        )
        expect(vessel, label).not.toBeNull()
        expect(vessel!.stats, label).toEqual(PERSISTED_STATS)
        expect(vessel!.natalChart, label).toBeNull()
      }
    })

    it.each(NOT_A_NUMBER)(
      'reads a degree of %s as 0 and keeps the body, even when it spells a number out of range',
      (_label, degree) => {
        for (const body of BODY_NAMES) {
          const vessel = ratableFromForgedRow(zeroRow(build(handWith(body, degree))))
          expect(vessel, body).not.toBeNull()
          expect(vessel!.natalChart!.planets[body], body).toEqual({
            sign: HAND[body].sign,
            degree: 0,
          })
          expect(vessel!.stats, body).toEqual(derived(handWith(body, 0), 0))
        }
      }
    )

    it('reads a degree that went through the database’s JSON as 0, because JSON turns NaN into null', () => {
      for (const degree of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        const stored = JSON.parse(JSON.stringify(build(handWith('Sun', degree))))
        const vessel = ratableFromForgedRow(zeroRow(stored))!
        expect(vessel.natalChart!.planets.Sun).toEqual({ sign: HAND.Sun.sign, degree: 0 })
        expect(vessel.stats).toEqual(derived(handWith('Sun', 0), 0))
      }
    })
  })

  it('judges a degree only on an entry that names a sign: a body without one is skipped first', () => {
    const roster = rosterShape(HAND)
    const rosterJunk = {
      planets: {
        ...roster.planets,
        Chiron: { sign: 5, degree: 1e9 },
        Lilith: { degree: 1e9 },
        Vesta: null,
        Pallas: 7,
        Ceres: 'x',
      },
    }
    const forge = forgeShape(HAND)
    const forgeJunk = {
      tropical: {
        ...forge.tropical,
        CelestialBodies: {
          all: [
            ...forge.tropical.CelestialBodies.all,
            { label: 'Chiron', Sign: { label: 5 }, degrees: 1e9 },
            { label: 'Lilith', degrees: 1e9 },
            { label: 'Vesta', Sign: null, degrees: 1e9 },
            { label: 7, Sign: { label: 'Leo' }, degrees: 1e9 },
            { Sign: { label: 'Leo' }, degrees: 1e9 },
            null,
            'Ceres',
            1e9,
          ],
        },
      },
    }
    for (const chart of [rosterJunk, forgeJunk]) {
      const vessel = ratableFromForgedRow(zeroRow(chart))
      expect(vessel).not.toBeNull()
      expect(Object.keys(vessel!.natalChart!.planets)).toEqual(BODY_NAMES)
      expect(vessel!.stats).toEqual(derived(HAND, 0))
    }
  })

  it('reads the roster shape alone when a chart carries both, so only it can reject', () => {
    const goodRoster = {
      ...rosterShape(HAND),
      ...forgeShape(handWith('Sun', 1e9)),
    }
    expect(ratableFromForgedRow(zeroRow(goodRoster))!.natalChart).toEqual({ planets: HAND })
    const badRoster = {
      ...rosterShape(handWith('Sun', 1e9)),
      ...forgeShape(HAND),
    }
    expect(ratableFromForgedRow(zeroRow(badRoster))).toBeNull()
  })
})

describe('the forged row an anonymous writer could store', () => {
  const FIVE = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars']
  const attackBodies: Record<string, Placement> = {
    ...HAND,
    ...Object.fromEntries(FIVE.map(body => [body, { sign: HAND[body].sign, degree: 1e9 }])),
  }
  const attackForge = forgeShape(attackBodies, { sign: 'Aries', degree: 1e9 })
  const attackRoster = rosterShape(attackBodies, 1e9)

  it('would be rated 99 across the board if its chart were believed: the premise of the guard', () => {
    const believed = derived(attackBodies, 1e9, 1)
    expect(Object.values(believed)).toEqual(Array(7).fill(100))
    expect(rateStats(believed).ovr).toBe(99)
  })

  it('is refused, not rated, in the forge’s shape', () => {
    expect(ratableFromForgedRow(zeroRow(attackForge, { monicaConstant: 1 }))).toBeNull()
  })

  it('is refused, not rated, in the roster shape', () => {
    expect(ratableFromForgedRow(zeroRow(attackRoster, { monicaConstant: 1 }))).toBeNull()
  })

  it.each<[string, unknown]>([
    ['the five bodies alone', forgeShape(attackBodies)],
    ['the forge’s ascendant alone', forgeShape(HAND, { sign: 'Aries', degree: 1e9 })],
    ['a bare ascendant alone', rosterShape(HAND, 1e9)],
    ['a bare ascendant alone, in the forge’s shape', { ...forgeShape(HAND), ascendant: 1e9 }],
  ])('is refused on %s', (_label, chart) => {
    expect(ratableFromForgedRow(zeroRow(chart, { monicaConstant: 1 }))).toBeNull()
  })

  it('cannot be lifted by the Monica constant alone: a sane chart with Monica 1e9 rates as Monica 10', () => {
    const lifted = ratableFromForgedRow(zeroRow(rosterShape(HAND), { monicaConstant: 1e9 }))!
    expect(lifted.stats).toEqual(derived(HAND, 0, 10))
    expect(rateStats(lifted.stats).ovr).toBe(rateStats(derived(HAND, 0, 10)).ovr)
    expect(rateStats(lifted.stats).ovr).toBeLessThan(rateStats(derived(HAND, 0, 1e9)).ovr)
  })

  it('is rated from its persisted columns when it has them, and then carries no chart', () => {
    for (const chart of [attackForge, attackRoster]) {
      const vessel = ratableFromForgedRow(persistedRow({ natalChart: chart, monicaConstant: 1 }))!
      expect(vessel.stats).toEqual(PERSISTED_STATS)
      expect(vessel.natalChart).toBeNull()
    }
  })
})

describe('ratableFromForgedRow: the ascendant has to be a position, or it is no ascendant', () => {
  const absent = derived(HAND, 0)
  const libra = (degrees: unknown) => ({ Sign: { label: 'Libra' }, degrees })
  /** A chart in the forge’s shape, with an optional bare `ascendant` and an optional block. */
  const forgeWith = (bare?: unknown, block?: unknown) => ({
    ...forgeShape(HAND),
    tropical: {
      ...forgeShape(HAND).tropical,
      ...(block === undefined ? {} : { Ascendant: block }),
    },
    ...(bare === undefined ? {} : { ascendant: bare }),
  })
  const rate = (chart: unknown) => ratableFromForgedRow(zeroRow(chart))

  /** A bare `ascendant`, and optionally the forge's block beside it, in each of the two shapes. */
  const BARE_SHAPES: [string, (bare: unknown, block?: unknown) => unknown][] = [
    [
      'roster shape',
      (bare, block) => ({
        ...rosterShape(HAND, bare),
        ...(block === undefined ? {} : { tropical: { Ascendant: block } }),
      }),
    ],
    ['forge shape', (bare, block) => forgeWith(bare, block)],
  ]

  it('has teeth: the ascendant moves the stats across the whole zodiac', () => {
    expect(derived(HAND, 0)).not.toEqual(derived(HAND, 360))
    expect(derived(HAND, 180)).not.toEqual(absent)
  })

  describe.each(BARE_SHAPES)('a bare ascendant in the %s', (_shape, build) => {
    it.each([0, 1, 180.5, 359.9999, 360])('accepts %s as the longitude it is', longitude => {
      const vessel = rate(build(longitude))!
      expect(vessel).not.toBeNull()
      expect(vessel.stats).toEqual(derived(HAND, longitude))
      expect(vessel.natalChart).toEqual({ planets: HAND })
    })

    it.each<[string, number]>([
      ['just above 360', 360.0001],
      ['the next double above 360', JUST_ABOVE_360],
      ['390', 390],
      ['1e9', 1e9],
      ['Number.MAX_VALUE', Number.MAX_VALUE],
      ['just below 0', -0.0001],
      ['the smallest negative number', -Number.MIN_VALUE],
      ['-1', -1],
      ['-1e9', -1e9],
    ])('makes the whole chart unratable for an ascendant of %s', (_label, longitude) => {
      expect(rate(build(longitude))).toBeNull()
    })

    it.each<[string, unknown]>([
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['-Infinity', Number.NEGATIVE_INFINITY],
      ['the string "x"', 'x'],
      ['the string "90"', '90'],
      ['the string "1e9"', '1e9'],
      ['null', null],
      ['undefined', undefined],
      ['true', true],
      ['an object', {}],
      ['the array [90]', [90]],
    ])('counts a bare ascendant of %s as none', (_label, bare) => {
      expect(rate(build(bare))!.stats).toEqual(absent)
    })

    it.each<[string, unknown]>([
      ['NaN', Number.NaN],
      ['-Infinity', Number.NEGATIVE_INFINITY],
      ['the string "x"', 'x'],
      ['null', null],
    ])(
      'falls through from a bare %s to the forge’s block, whatever that block says',
      (_l, bare) => {
        expect(rate(build(bare, libra(12.5)))!.stats).toEqual(derived(HAND, 192.5))
        expect(rate(build(bare, libra(30)))!.stats).toEqual(derived(HAND, 210))
        expect(rate(build(bare, libra(1e9)))).toBeNull() // the block itself is out of range
        expect(rate(build(bare, libra(-1)))).toBeNull()
        expect(rate(build(bare, libra(Number.NaN)))!.stats).toEqual(absent) // …or no ascendant
      }
    )

    it('is not rescued by a valid forge block when the bare ascendant itself is out of range', () => {
      for (const bare of [360.0001, JUST_ABOVE_360, -1, -0.0001, 1e9, -1e9]) {
        expect(rate(build(bare, libra(12.5))), String(bare)).toBeNull()
      }
    })

    it('does not consult the forge block once the bare ascendant is a position', () => {
      for (const block of [libra(1e9), libra(-1), libra(Number.NaN), libra(12.5), 'Libra']) {
        expect(rate(build(90, block))!.stats, JSON.stringify(block)).toEqual(derived(HAND, 90))
      }
      // A bare 0 is a position too, not an absent value that lets the block speak.
      expect(rate(build(0, libra(1e9)))!.stats).toEqual(absent)
      expect(rate(build(0, libra(12.5)))!.stats).toEqual(absent)
    })

    it('is not consulted at all when the persisted columns are used', () => {
      for (const longitude of [360.0001, -1, 1e9, Number.NaN]) {
        const vessel = ratableFromForgedRow(persistedRow({ natalChart: build(longitude) }))!
        expect(vessel.stats, String(longitude)).toEqual(PERSISTED_STATS)
        expect(vessel.natalChart, String(longitude)).toEqual({ planets: HAND })
      }
    })
  })

  describe('the forge’s ascendant block', () => {
    const block = (sign: string, degrees: unknown) => ({ Sign: { label: sign }, degrees })
    const chartWith = (ascendant: unknown) => ({
      tropical: { ...forgeShape(HAND).tropical, Ascendant: ascendant },
    })

    it.each([0, 12.5, 29.9999, 30])(
      'puts %s degrees of any of the twelve signs at index·30 + degrees',
      degrees => {
        SIGN_NAMES.forEach((sign, index) => {
          const vessel = rate(chartWith(block(sign, degrees)))!
          expect(vessel, sign).not.toBeNull()
          expect(vessel.stats, sign).toEqual(derived(HAND, index * 30 + degrees))
        })
      }
    )

    it('takes 30° of a sign as the start of the next one', () => {
      SIGN_NAMES.slice(0, -1).forEach((sign, index) => {
        expect(rate(chartWith(block(sign, 30)))!.stats, sign).toEqual(
          rate(chartWith(block(SIGN_NAMES[index + 1], 0)))!.stats
        )
      })
      // …and 30° of Pisces is a whole turn: the bare 360 that is accepted.
      expect(rate(chartWith(block('Pisces', 30)))!.stats).toEqual(derived(HAND, 360))
    })

    it.each<[string, number]>([
      ['just above 30', 30.0001],
      ['the next double above 30', JUST_ABOVE_30],
      ['31', 31],
      ['1e9', 1e9],
      ['Number.MAX_VALUE', Number.MAX_VALUE],
      ['just below 0', -0.0001],
      ['the smallest negative number', -Number.MIN_VALUE],
      ['-1', -1],
      ['-1e9', -1e9],
    ])('makes the whole chart unratable for %s degrees of a known sign', (_label, degrees) => {
      for (const sign of SIGN_NAMES) expect(rate(chartWith(block(sign, degrees))), sign).toBeNull()
    })

    it.each<[string, unknown]>([
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['-Infinity', Number.NEGATIVE_INFINITY],
      ['the string "12.5"', '12.5'],
      ['the string "1e9"', '1e9'],
      ['null', null],
      ['undefined', undefined],
      ['true', true],
      ['an object', {}],
      ['the array [12.5]', [12.5]],
    ])('counts %s degrees as no ascendant, not as an unratable one', (_label, degrees) => {
      for (const sign of SIGN_NAMES) {
        expect(rate(chartWith(block(sign, degrees)))!.stats, sign).toEqual(absent)
      }
    })

    it.each<[string, unknown]>([
      ['an unknown sign', block('Ophiuchus', 1e9)],
      ['a lower-case sign', block('libra', 1e9)],
      ['a padded sign', block(' Libra', -1)],
      ['a sign that is not a string', { Sign: { label: 6 }, degrees: 1e9 }],
      ['a null Sign', { Sign: null, degrees: 1e9 }],
      ['no Sign', { degrees: 1e9 }],
      ['no sign label', { Sign: {}, degrees: -1e9 }],
      ['an ascendant that is a string', 'Libra'],
      ['an ascendant that is a number', 1e9],
      ['a null ascendant', null],
    ])(
      'counts %s as no ascendant, whatever its degrees say: the sign is judged first',
      (_label, ascendant) => {
        expect(rate(chartWith(ascendant))!.stats).toEqual(absent)
      }
    )

    it('is not consulted at all when the persisted columns are used', () => {
      for (const degrees of [30.0001, -1, 1e9, Number.NaN]) {
        const vessel = ratableFromForgedRow(
          persistedRow({ natalChart: chartWith(block('Libra', degrees)) })
        )!
        expect(vessel.stats, String(degrees)).toEqual(PERSISTED_STATS)
        expect(vessel.natalChart, String(degrees)).toEqual({ planets: HAND })
      }
    })

    it('is read beside roster-shape bodies too, and rejects the chart there as well', () => {
      const roster = rosterShape(HAND)
      expect(rate({ ...roster, ...chartWith(libra(12.5)) })!.stats).toEqual(derived(HAND, 192.5))
      expect(rate({ ...roster, ...chartWith(libra(1e9)) })).toBeNull()
    })
  })
})

describe('ratableFromForgedRow: the Monica constant is kept within what the formulas expect (0 to 10)', () => {
  const chart = rosterShape(HAND)
  const statsFor = (monicaConstant: unknown, natalChart: unknown = chart) =>
    ratableFromForgedRow(zeroRow(natalChart, { monicaConstant: monicaConstant as number }))!.stats

  it('has teeth: the stats follow Monica between 0 and 10, and would run away past 10 and below 0', () => {
    expect(derived(HAND, 0, 0)).not.toEqual(derived(HAND, 0, 10))
    expect(derived(HAND, 0, 10)).not.toEqual(derived(HAND, 0, 11))
    expect(derived(HAND, 0, 10)).not.toEqual(derived(HAND, 0, 1000))
    expect(derived(HAND, 0, 0)).not.toEqual(derived(HAND, 0, -1))
    expect(derived(HAND, 0, 0)).not.toEqual(derived(HAND, 0, -5))
  })

  it.each([0, 0.5, 1.618, 4, 7.77, 9.99, 10])('leaves a Monica of %s alone', monica => {
    expect(statsFor(monica)).toEqual(derived(HAND, 0, monica))
  })

  it.each([11, 12.5, 25, 1000, 1e9, Number.MAX_VALUE])(
    'rates a Monica of %s as exactly 10',
    monica => {
      expect(statsFor(monica)).toEqual(derived(HAND, 0, 10))
      expect(statsFor(monica)).toEqual(statsFor(10))
    }
  )

  it.each([-1, -5, -1000, -1e9, -Number.MAX_VALUE])('rates a Monica of %s as exactly 0', monica => {
    expect(statsFor(monica)).toEqual(derived(HAND, 0, 0))
    expect(statsFor(monica)).toEqual(statsFor(0))
  })

  it.each<[string, unknown]>([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['null', null],
    ['undefined', undefined],
    ['the string "3"', '3'],
    ['the string "1000"', '1000'],
    ['true', true],
    ['an object', {}],
    ['the array [3]', [3]],
  ])('counts a Monica of %s as 0, not as a value to clamp', (_label, monica) => {
    expect(statsFor(monica)).toEqual(derived(HAND, 0, 0))
    // Infinity is not "very large, so 10": it is not a number to use at all.
    expect(statsFor(monica)).not.toEqual(derived(HAND, 0, 10))
  })

  describe('at the very edges of the clamp', () => {
    // Stats are rounded, so a clamp bound that is off by a hair shows only where an unrounded
    // stat sits on a .5 edge. This chart puts one on each side, at each end of the clamp:
    //   power  = 50 + Sun/18 + 2.5·Monica (Mars at 0°)  → 60.499999 at 0, 85.499999 at 10:
    //            rounds down, and up the moment a bound is raised;
    //   wisdom = 50 + Mercury/24 + Monica (Moon at 0°)  → 57.500001 at 0, 67.500001 at 10:
    //            rounds up, and down the moment a bound is lowered.
    const EDGE: Record<string, Placement> = {
      ...HAND,
      Sun: { sign: 'Libra', degree: 8.999982 }, // 188.999982
      Moon: { sign: 'Aries', degree: 0 },
      Mercury: { sign: 'Libra', degree: 0.000024 }, // 180.000024
      Mars: { sign: 'Aries', degree: 0 },
    }
    const edge = (monica: unknown) => statsFor(monica, rosterShape(EDGE))
    const oracle = (monica: number) => derived(EDGE, 0, monica)

    it('has teeth: a Monica a hair past either end of the clamp changes a stat of this chart', () => {
      expect(oracle(0).power).toBe(60)
      expect(oracle(0.001).power).toBe(61) // a lower bound raised
      expect(oracle(0).wisdom).toBe(58)
      expect(oracle(-0.001).wisdom).toBe(57) // a lower bound lowered
      expect(oracle(10).power).toBe(85)
      expect(oracle(10.001).power).toBe(86) // an upper bound raised
      expect(oracle(10).wisdom).toBe(68)
      expect(oracle(9.999).wisdom).toBe(67) // an upper bound lowered
    })

    it.each([0, 10])('keeps a Monica of exactly %s', monica => {
      expect(edge(monica)).toEqual(oracle(monica))
    })

    it.each([10.001, 10.5, 11, 1000, 1e9])('rates a Monica of %s as exactly 10', monica => {
      expect(edge(monica)).toEqual(oracle(10))
    })

    it.each([-0.001, -0.5, -1, -1000, -1e9])('rates a Monica of %s as exactly 0', monica => {
      expect(edge(monica)).toEqual(oracle(0))
    })

    it('keeps a Monica just inside either end', () => {
      expect(edge(9.999)).toEqual(oracle(9.999))
      expect(edge(0.001)).toEqual(oracle(0.001))
    })
  })

  it('counts a row without a Monica column as 0', () => {
    const bare: ForgedAgentRow = { agentId: 'agent-bare-0002', name: 'Bare', natalChart: chart }
    expect(ratableFromForgedRow(bare)!.stats).toEqual(derived(HAND, 0, 0))
  })

  it('clamps beside an ascendant and in the forge’s shape, with the same result', () => {
    const forged = forgeShape(HAND, LIBRA_12_5)
    expect(statsFor(1000, forged)).toEqual(derived(HAND, 192.5, 10))
    expect(statsFor(-5, forged)).toEqual(derived(HAND, 192.5, 0))
    expect(statsFor(Number.NaN, forged)).toEqual(derived(HAND, 192.5, 0))
    expect(statsFor(4, forged)).toEqual(derived(HAND, 192.5, 4))
    expect(statsFor(1000, rosterShape(HAND, 192.5))).toEqual(derived(HAND, 192.5, 10))
  })

  it('is not consulted when the persisted columns are used', () => {
    for (const monicaConstant of [1e9, -1e9, Number.NaN, null]) {
      expect(ratableFromForgedRow(persistedRow({ monicaConstant }))!.stats).toEqual(PERSISTED_STATS)
    }
  })
})

describe('the charts the forge’s generator really produces are never refused', () => {
  it('rates 500 generated charts across three centuries, with the stats the derivation gives', () => {
    const refused: string[] = []
    const differing: string[] = []
    let rated = 0
    for (let year = 1700; year <= 2040; year += 17) {
      for (let month = 1; month <= 12; month += 1) {
        for (const [latitude, longitude] of [
          [40.7, -74],
          [-33.9, 151.2],
        ]) {
          const stored: ForgeChart = JSON.parse(
            JSON.stringify(
              generateAccurateHoroscope({
                year,
                month,
                day: ((year + month * 3) % 28) + 1,
                hour: (year * month) % 24,
                minute: year % 60,
                latitude,
                longitude,
              })
            )
          )
          const label = `${year}-${month}@${latitude}`
          const vessel = ratableFromForgedRow(zeroRow(stored))
          if (!vessel) {
            refused.push(label)
            continue
          }
          rated += 1
          const ascendant = lon({
            sign: stored.tropical.Ascendant.Sign.label,
            degree: stored.tropical.Ascendant.degrees,
          })
          if (
            JSON.stringify(vessel.stats) !==
            JSON.stringify(derived(placementsOf(stored), ascendant))
          ) {
            differing.push(label)
          }
        }
      }
    }
    expect(rated).toBeGreaterThanOrEqual(500)
    expect(refused).toEqual([])
    expect(differing).toEqual([])
  })
})

// ─── Parity: a chart rates the same as a forged row and as a roster agent ────

describe('a chart rates identically as a forged row and as a roster agent', () => {
  const chartOf = (agent: CraftedAgent) =>
    agent.consciousness.natalChart as unknown as {
      planets: Record<string, Placement>
      ascendant: number
    }

  it('starts from a roster that actually exercises the ascendant', () => {
    expect(HISTORICAL_AGENTS).toHaveLength(72)
    for (const agent of HISTORICAL_AGENTS) {
      const { planets, ascendant } = chartOf(agent)
      expect(Object.keys(planets), agent.id).toHaveLength(10)
      expect(Number.isFinite(ascendant), agent.id).toBe(true)
      expect(ascendant, agent.id).toBeGreaterThanOrEqual(0)
      expect(ascendant, agent.id).toBeLessThan(360)
    }
  })

  const zeroRowFor = (agent: CraftedAgent, natalChart: unknown): ForgedAgentRow =>
    zeroRow(natalChart, {
      agentId: agent.id,
      name: agent.name,
      monicaConstant: agent.consciousness.monicaConstant,
    })

  it('gives all 72 historical charts, fed back as zero-column rows in the roster shape, the roster’s stats', () => {
    const differing = HISTORICAL_AGENTS.filter(
      agent =>
        JSON.stringify(
          ratableFromForgedRow(zeroRowFor(agent, agent.consciousness.natalChart))!.stats
        ) !== JSON.stringify(ratableFromRoster(agent).stats)
    ).map(agent => agent.id)
    expect(differing).toEqual([])
  })

  it('shows the ascendant is what the parity rests on: without it the same charts diverge', () => {
    const withoutAscendant = HISTORICAL_AGENTS.filter(agent => {
      const { planets } = chartOf(agent)
      const stripped = ratableFromForgedRow(zeroRowFor(agent, { planets }))!
      return JSON.stringify(stripped.stats) !== JSON.stringify(ratableFromRoster(agent).stats)
    })
    expect(withoutAscendant.length).toBeGreaterThan(0)
  })

  it('gives all 72 historical charts, rewritten in the forge’s shape, the roster’s stats', () => {
    const differing = HISTORICAL_AGENTS.filter(agent => {
      const { planets, ascendant } = chartOf(agent)
      const index = Math.floor(ascendant / 30)
      const forge = forgeShape(planets, {
        sign: SIGN_NAMES[index],
        degree: ascendant - index * 30,
      })
      return (
        JSON.stringify(ratableFromForgedRow(zeroRowFor(agent, forge))!.stats) !==
        JSON.stringify(ratableFromRoster(agent).stats)
      )
    }).map(agent => agent.id)
    expect(differing).toEqual([])
  })

  it('reads the same ten bodies from both shapes of one chart', () => {
    for (const agent of HISTORICAL_AGENTS) {
      const { planets, ascendant } = chartOf(agent)
      const index = Math.floor(ascendant / 30)
      const fromRoster = ratableFromForgedRow(zeroRowFor(agent, agent.consciousness.natalChart))!
      const fromForge = ratableFromForgedRow(
        zeroRowFor(
          agent,
          forgeShape(planets, { sign: SIGN_NAMES[index], degree: ascendant - index * 30 })
        )
      )!
      expect(fromForge.natalChart, agent.id).toEqual(fromRoster.natalChart)
    }
  })
})

// ─── Faction: the planet a vessel flies under ────────────────────────────────

describe('FACTION_NAMES', () => {
  it('is the ten classical bodies in the contract’s planet order, one per manifest colour', () => {
    expect([...FACTION_NAMES]).toEqual([
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
    ])
    expect([...FACTION_NAMES]).toEqual([...SKY_BODIES])
    expect(FACTION_NAMES).toHaveLength(PLANET_COLORS.length)
  })
})

describe('the faction of a vessel', () => {
  /** A persisted-column row, so only the id and the chart decide the faction. */
  const factionOf = (agentId: string, ...chart: unknown[]): number =>
    ratableFromForgedRow(
      persistedRow({ agentId, natalChart: chart.length > 0 ? chart[0] : rosterShape(HAND) })
    )!.faction
  const sunIn = (sign: string) => rosterShape({ Sun: { sign, degree: 10 } })
  /** The manifest keys a trailing birth year off, as the vessel code does. */
  const rosterFaction = new Map(
    CANONICAL_ROSTER_71.map(entry => [entry.key.replace(/-\d+$/, ''), entry.faction])
  )

  it('takes a contract pilot’s own faction first, for a roster agent and for a forged row alike', () => {
    for (const fixture of FIXTURE_AGENTS) {
      const forged = ratableFromForgedRow(
        persistedRow({ agentId: fixture.key, natalChart: sunIn('Aries') })
      )!
      expect(forged.faction, fixture.key).toBe(fixture.faction)
      const payload = buildRatedAgentPayload({
        vessel: forged,
        balances: { agentId: fixture.key, balances: RICH, esmsSource: 'database' },
        sky: null,
      })
      expect(payload.faction, fixture.key).toBe(fixture.faction)
      expect(payload.factionName, fixture.key).toBe(fixture.factionName)
    }
    expect(ratableFromRoster(newton).faction).toBe(6)
    expect(ratableFromRoster(getHistoricalAgent('emily-dickinson')!).faction).toBe(3)
    expect(ratableFromRoster(getHistoricalAgent('leonardo-da-vinci')!).faction).toBe(9)
  })

  it('puts user-avatar-neo under the Sun, whatever its chart or its stats say', () => {
    expect(factionOf('user-avatar-neo', sunIn('Aries'))).toBe(0) // Aries would be Mars, 4
    expect(factionOf('user-avatar-neo', sunIn('Pisces'))).toBe(0)
    const greg = getHistoricalAgent(VESSEL_ALIASES['user-avatar-neo'])!
    const aliased = ratableFromRoster(greg, 'user-avatar-neo')
    expect(aliased.faction).toBe(0)
    const payload = buildRatedAgentPayload({
      vessel: aliased,
      balances: balances('greg-castro-1991'),
      sky: null,
    })
    expect(payload.faction).toBe(0)
    expect(payload.factionName).toBe('Sun')
    // …while the same agent under its own id is not a pilot: its Cancer Sun is ruled by the Moon.
    expect(ratableFromRoster(greg).faction).toBe(1)
    expect(ratableFromRoster(greg).faction).not.toBe(aliased.faction)
  })

  it('ranks a pilot above the roster: the contract says Saturn for Newton, the roster says Moon', () => {
    const roster = CANONICAL_ROSTER_71.find(entry => entry.key === 'isaac-newton')!
    expect(roster.faction).toBe(1)
    expect(factionOf('isaac-newton', sunIn('Aries'))).toBe(6)
    expect(factionOf('isaac-newton')).toBe(6)
  })

  it('gives each roster agent the roster’s canonical faction, pilots aside', () => {
    const pilots = new Set(FIXTURE_AGENTS.map(fixture => fixture.key))
    const wrong: string[] = []
    let checked = 0
    for (const agent of HISTORICAL_AGENTS) {
      const expected = rosterFaction.get(agent.id.replace(/-\d+$/, ''))
      if (pilots.has(agent.id) || expected === undefined) continue
      checked += 1
      if (ratableFromRoster(agent).faction !== expected) wrong.push(agent.id)
    }
    expect(wrong).toEqual([])
    expect(checked).toBeGreaterThan(60)
  })

  it.each([
    ['plato', 0, 'Sun'],
    ['aristotle', 4, 'Mars'],
    ['alexander-the-great', 6, 'Saturn'],
    ['michelangelo', 1, 'Moon'],
    ['wolfgang-mozart', 2, 'Mercury'],
    ['thomas-aquinas', 7, 'Uranus'],
    ['galileo-galilei', 7, 'Uranus'],
    ['tecumseh', 8, 'Neptune'],
    ['mahatma-gandhi', 9, 'Pluto'],
    ['rachel-carson', 5, 'Jupiter'],
  ])('puts the roster agent %s under faction %i (%s)', (id, faction, name) => {
    const agent = getHistoricalAgent(id)!
    const vessel = ratableFromRoster(agent)
    expect(vessel.faction).toBe(faction)
    const payload = buildRatedAgentPayload({ vessel, balances: balances(id), sky: null })
    expect(payload.factionName).toBe(name)
    // A roster id outranks the chart: the same id as a forged row, under a different Sun.
    expect(factionOf(id, sunIn(id === 'aristotle' ? 'Taurus' : 'Aries'))).toBe(faction)
  })

  it('finds a roster agent whose key carries a birth year, with or without the year', () => {
    expect(rosterFaction.get('nikola-tesla')).toBe(3)
    expect(CANONICAL_ROSTER_71.some(entry => entry.key === 'nikola-tesla-1856')).toBe(true)
    expect(getHistoricalAgent('nikola-tesla-1856')).toBeDefined()
    const tesla = ratableFromRoster(getHistoricalAgent('nikola-tesla-1856')!)
    expect(tesla.faction).toBe(3)
    expect(tesla.provenance).not.toBe('user')
    for (const id of ['nikola-tesla-1856', 'nikola-tesla', 'nikola-tesla-1900']) {
      expect(factionOf(id, sunIn('Aries')), id).toBe(3) // Aries alone would be Mars
    }
    expect(factionOf('voltaire-1694', sunIn('Aries'))).toBe(9)
    expect(factionOf('voltaire', sunIn('Aries'))).toBe(9)
    expect(factionOf('rene-descartes-1596', sunIn('Aries'))).toBe(3)
    expect(factionOf('mark-twain-1835', sunIn('Aries'))).toBe(5)
  })

  it('reads an id without regard to its case or surrounding space', () => {
    expect(factionOf(' ISAAC-Newton ', sunIn('Aries'))).toBe(6)
    expect(factionOf('Plato', sunIn('Aries'))).toBe(0)
    expect(factionOf(' Nikola-Tesla-1856', sunIn('Aries'))).toBe(3)
  })

  it('does not strip anything but a trailing run of digits from an id', () => {
    // 'plato-x' and 'xplato' are not Plato; only a trailing -<digits> is a birth year.
    expect(factionOf('plato-x', sunIn('Aries'))).toBe(4)
    expect(factionOf('xplato', sunIn('Aries'))).toBe(4)
    expect(factionOf('1991-plato', sunIn('Aries'))).toBe(4)
    // …and only at the end: a digit run in the middle of an id is left where it is,
    // as is a bare trailing hyphen.
    expect(factionOf('pl-1ato', sunIn('Aries'))).toBe(4)
    expect(factionOf('plato-', sunIn('Aries'))).toBe(4)
    expect(factionOf('plato-1-x', sunIn('Aries'))).toBe(4)
  })

  it.each([
    ['Aries', 4, 'Mars'],
    ['Taurus', 3, 'Venus'],
    ['Gemini', 2, 'Mercury'],
    ['Cancer', 1, 'Moon'],
    ['Leo', 0, 'Sun'],
    ['Virgo', 2, 'Mercury'],
    ['Libra', 3, 'Venus'],
    ['Scorpio', 9, 'Pluto'],
    ['Sagittarius', 5, 'Jupiter'],
    ['Capricorn', 6, 'Saturn'],
    ['Aquarius', 7, 'Uranus'],
    ['Pisces', 8, 'Neptune'],
  ])(
    'puts a vessel outside the roster whose Sun is in %s under faction %i (%s)',
    (sign, faction, name) => {
      const roster = factionOf('agent-outside-ab12', sunIn(sign))
      expect(roster).toBe(faction)
      const forge = factionOf('agent-outside-ab12', forgeShape({ Sun: { sign, degree: 10 } }))
      expect(forge).toBe(faction)
      const vessel = ratableFromForgedRow(
        persistedRow({ agentId: 'agent-outside-ab12', natalChart: sunIn(sign) })
      )!
      const payload = buildRatedAgentPayload({
        vessel,
        balances: { agentId: vessel.agentId, balances: RICH, esmsSource: 'database' },
        sky: null,
      })
      expect(payload.faction).toBe(faction)
      expect(payload.factionName).toBe(name)
    }
  )

  describe('which strings name a Sun sign that rules a faction', () => {
    // `getRulingPlanet` alone reads any string it does not know as Aries, and so as Mars (4): a
    // chart whose Sun sign is not one of the twelve must not fly under Mars, it falls to the Sun's
    // faction 0 as a chart with no sign does. Case and surrounding space are not part of a sign.
    const REAL_SIGNS: [string, number][] = [
      ['aries', 4],
      ['  aries ', 4],
      ['ARIES', 4],
      ['\tcapricorn\n', 6],
      ['SCORPIO', 9],
      ['cAnCeR', 1],
      ['PISCES', 8],
      [' Sagittarius ', 5],
      ['AqUaRiUs', 7],
      ['LEO', 0],
      ['leo ', 0],
    ]
    const NOT_SIGNS = [
      'Banana',
      'Ophiuchus',
      'constructor',
      'toString',
      '__proto__',
      '',
      '   ',
      'Ari es',
      'Arie',
      'Ariess',
      'Aries1',
      'Aries.',
      'Aries Taurus',
      'Sun',
      'Mars',
      'Aries\u0000',
    ]
    const gregWithSun = (sign: string): CraftedAgent => {
      const greg = getHistoricalAgent('greg-castro-1991')!
      const chart = greg.consciousness.natalChart!
      return {
        ...greg,
        consciousness: {
          ...greg.consciousness,
          natalChart: {
            ...chart,
            planets: { ...chart.planets, Sun: { ...chart.planets.Sun, sign } },
          },
        },
      } as unknown as CraftedAgent
    }

    it('has teeth: the ruling-planet lookup alone reads the strings below as Mars', () => {
      for (const sign of ['Banana', 'Ophiuchus', 'constructor', '', 'Arie']) {
        expect((FACTION_NAMES as readonly string[]).indexOf(getRulingPlanet(sign)), sign).toBe(4)
      }
    })

    it.each(REAL_SIGNS)(
      'rules the Sun sign %j with faction %i, in every chart shape',
      (sign, faction) => {
        expect(factionOf('agent-outside-ab12', sunIn(sign))).toBe(faction)
        expect(factionOf('agent-outside-ab12', forgeShape({ Sun: { sign, degree: 10 } }))).toBe(
          faction
        )
        expect(ratableFromRoster(gregWithSun(sign)).faction).toBe(faction)
      }
    )

    it.each(NOT_SIGNS)('gives the Sun sign %j no ruler: faction 0, never Mars (4)', sign => {
      expect(factionOf('agent-outside-ab12', sunIn(sign))).toBe(0)
      expect(factionOf('agent-outside-ab12', forgeShape({ Sun: { sign, degree: 10 } }))).toBe(0)
      expect(ratableFromRoster(gregWithSun(sign)).faction).toBe(0)
    })

    it('names that faction the Sun in the payload, and draws the look in its colour', () => {
      for (const sign of ['Banana', 'Ophiuchus', '']) {
        const vessel = ratableFromRoster(gregWithSun(sign))
        const payload = buildRatedAgentPayload({
          vessel,
          balances: balances('greg-castro-1991'),
          sky: null,
        })
        expect(payload.faction, sign).toBe(0)
        expect(payload.factionName, sign).toBe('Sun')
        expect(payload.appearance.paletteOverrides.secondaryTrimHex, sign).toBe(PLANET_COLORS[0])
      }
    })

    it('does not let an unreadable sign outrank a readable one: a roster id or pilot still wins', () => {
      expect(factionOf('isaac-newton', sunIn('Banana'))).toBe(6)
      expect(factionOf('plato', sunIn('Banana'))).toBe(0)
      expect(factionOf('aristotle', sunIn('Banana'))).toBe(4) // Mars by the roster, not by default
    })
  })

  it('reads the Sun from the Sun alone: another body in another sign does not move the faction', () => {
    const chart = rosterShape({
      Sun: { sign: 'Gemini', degree: 3 },
      Moon: { sign: 'Pisces', degree: 3 },
      Mars: { sign: 'Capricorn', degree: 3 },
    })
    expect(factionOf('agent-outside-ab12', chart)).toBe(2)
  })

  it('falls back to faction 0 (Sun) when there is no chart, or no Sun, or no sign to read', () => {
    expect(factionOf('agent-outside-ab12', null)).toBe(0)
    expect(factionOf('agent-outside-ab12', undefined)).toBe(0)
    expect(factionOf('agent-outside-ab12', {})).toBe(0)
    expect(
      factionOf('agent-outside-ab12', rosterShape({ Moon: { sign: 'Pisces', degree: 3 } }))
    ).toBe(0)
    expect(factionOf('agent-outside-ab12', { planets: { Sun: { sign: '', degree: 3 } } })).toBe(0)
  })

  it('treats the chart as absent for a roster agent with none, and gives it faction 0 too', () => {
    const chartless = {
      ...getHistoricalAgent('greg-castro-1991')!,
      consciousness: {
        ...getHistoricalAgent('greg-castro-1991')!.consciousness,
        natalChart: undefined,
      },
    } as unknown as CraftedAgent
    const vessel = ratableFromRoster(chartless)
    expect(vessel.natalChart).toBeNull()
    expect(vessel.faction).toBe(0)
  })

  it('keeps the faction an integer 0–9 and its name one of the ten, for ids that name prototype members', () => {
    for (const id of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']) {
      for (const chart of [sunIn('Taurus'), null]) {
        const faction = factionOf(id, chart)
        expect(faction, id).toBe(chart === null ? 0 : 3)
        expect(Number.isInteger(faction), id).toBe(true)
      }
      expect(ratableFromRoster(newton, id).faction, id).toBe(6) // newton's Capricorn Sun: Saturn
    }
  })

  it('names every faction from FACTION_NAMES, and falls back to the Sun’s name for an index outside it', () => {
    const vessel = ratableFromForgedRow(persistedRow())!
    FACTION_NAMES.forEach((name, index) => {
      const payload = buildRatedAgentPayload({
        vessel: { ...vessel, faction: index },
        balances: { agentId: 'x', balances: RICH, esmsSource: 'database' },
        sky: null,
      })
      expect(payload.faction).toBe(index)
      expect(payload.factionName).toBe(name)
      expect(summarizeVessel({ ...vessel, faction: index }).factionName).toBe(name)
    })
    for (const faction of [10, 99, -1]) {
      const payload = buildRatedAgentPayload({
        vessel: { ...vessel, faction },
        balances: { agentId: 'x', balances: RICH, esmsSource: 'database' },
        sky: null,
      })
      expect(payload.factionName).toBe('Sun')
      expect(summarizeVessel({ ...vessel, faction }).factionName).toBe('Sun')
    }
  })

  it('reads the same faction for a roster chart fed back as a forged row, unless a pilot outranks it', () => {
    const differing = HISTORICAL_AGENTS.filter(agent => {
      const forged = ratableFromForgedRow(
        zeroRow(agent.consciousness.natalChart, { agentId: agent.id, name: agent.name })
      )!
      return forged.faction !== ratableFromRoster(agent).faction
    })
    expect(differing.map(agent => agent.id)).toEqual([])
  })
})

// ─── Provenance and the placeholder flag ─────────────────────────────────────

describe('provenance and isPlaceholder', () => {
  const withProvenance = (provenance: unknown): CraftedAgent =>
    ({
      ...newton,
      consciousness: {
        ...newton.consciousness,
        natalChart: { ...newton.consciousness.natalChart, provenance },
      },
    }) as unknown as CraftedAgent

  it('marks a roster agent with a placeholder chart as a placeholder vessel', () => {
    const vessel = ratableFromRoster(withProvenance('placeholder'))
    expect(vessel.isPlaceholder).toBe(true)
    expect(vessel.provenance).toBe('placeholder')
  })

  it.each(['computed', 'authored', 'unattributed', undefined, 'anything-else'])(
    'marks a roster agent whose chart provenance is %s as historical, not a placeholder',
    provenance => {
      const vessel = ratableFromRoster(withProvenance(provenance))
      expect(vessel.isPlaceholder).toBe(false)
      expect(vessel.provenance).toBe('historical')
    }
  )

  it('marks a roster agent without a chart as historical', () => {
    const chartless = {
      ...newton,
      consciousness: { ...newton.consciousness, natalChart: undefined },
    } as unknown as CraftedAgent
    const vessel = ratableFromRoster(chartless)
    expect(vessel.isPlaceholder).toBe(false)
    expect(vessel.provenance).toBe('historical')
    expect(vessel.natalChart).toBeNull()
  })

  it('follows the chart for the real roster: placeholder charts and only they are placeholders', () => {
    const placeholders = HISTORICAL_AGENTS.filter(
      agent => agent.consciousness.natalChart?.provenance === 'placeholder'
    )
    expect(placeholders.length).toBeGreaterThan(0)
    expect(placeholders.length).toBeLessThan(HISTORICAL_AGENTS.length)
    for (const agent of HISTORICAL_AGENTS) {
      const vessel = ratableFromRoster(agent)
      const isPlaceholder = placeholders.includes(agent)
      expect(vessel.isPlaceholder, agent.id).toBe(isPlaceholder)
      expect(vessel.provenance, agent.id).toBe(isPlaceholder ? 'placeholder' : 'historical')
    }
  })

  it('never lets a placeholder chart earn Celestial, at balances that would otherwise allow it', () => {
    for (const agent of HISTORICAL_AGENTS) {
      const vessel = ratableFromRoster(agent)
      if (!vessel.isPlaceholder) continue
      const payload = buildRatedAgentPayload({
        vessel,
        balances: { agentId: agent.id, balances: RICH, esmsSource: 'database' },
        sky,
      })
      expect(
        payload.seals.filter(seal => seal.tier === 'Celestial'),
        agent.id
      ).toEqual([])
      expect(
        payload.sealProgress.every(progress => progress.natalAffinity === null),
        agent.id
      ).toBe(true)
    }
  })

  it('marks every forged vessel a user vessel, even when its stored chart claims to be a placeholder', () => {
    for (const natalChart of [
      rosterShape(HAND),
      { ...rosterShape(HAND), provenance: 'placeholder' },
      forgeShape(HAND, LIBRA_12_5),
    ]) {
      for (const row of [persistedRow({ natalChart }), zeroRow(natalChart)]) {
        const vessel = ratableFromForgedRow(row)!
        expect(vessel.isPlaceholder).toBe(false)
        expect(vessel.provenance).toBe('user')
        expect(vessel.natalChart).toEqual({ planets: HAND }) // the stored provenance is not carried
      }
    }
  })

  it('serves the vessel’s two flags in the payload as they are', () => {
    const base = ratableFromForgedRow(persistedRow())!
    const at = (over: Partial<RatableVessel>) =>
      buildRatedAgentPayload({
        vessel: { ...base, ...over },
        balances: { agentId: 'x', balances: RICH, esmsSource: 'database' },
        sky: null,
      })
    expect(at({})).toMatchObject({ isPlaceholder: false, provenance: 'user' })
    expect(at({ isPlaceholder: true, provenance: 'placeholder' })).toMatchObject({
      isPlaceholder: true,
      provenance: 'placeholder',
    })
    expect(at({ provenance: 'historical' })).toMatchObject({
      isPlaceholder: false,
      provenance: 'historical',
    })
  })

  describe('a placeholder chart against the same chart with a source', () => {
    // Every stat at its ceiling and all ten bodies in Fire signs: the Spirit Seals (intuition,
    // adaptability) clear Celestial on stats, on balance and on the chart's element. Only the
    // chart's provenance differs between the two vessels.
    const FIRE_CHART = {
      planets: Object.fromEntries(
        SKY_BODIES.map((body, i) => [body, { sign: ['Aries', 'Leo', 'Sagittarius'][i % 3] }])
      ),
    }
    const MAXED: CoreStats = {
      power: 100,
      resonance: 100,
      wisdom: 100,
      charisma: 100,
      intuition: 100,
      adaptability: 100,
      vitality: 100,
    }
    const build = (provenance: 'placeholder' | 'computed' | 'authored' | 'unattributed') => {
      const isPlaceholder = provenance === 'placeholder'
      const vessel: RatableVessel = {
        ...ratableFromForgedRow(persistedRow())!,
        stats: MAXED,
        natalChart: { ...FIRE_CHART, provenance },
        isPlaceholder,
        provenance: isPlaceholder ? 'placeholder' : 'historical',
      }
      return buildRatedAgentPayload({
        vessel,
        balances: { agentId: 'x', balances: RICH, esmsSource: 'database' },
        sky: null,
      })
    }
    const celestial = (p: ReturnType<typeof build>) =>
      p.seals.filter(s => s.tier === 'Celestial').map(s => s.statKey)

    it('has teeth: a sourced chart earns both Spirit Seals at Celestial', () => {
      expect(celestial(build('computed'))).toEqual(['intuition', 'adaptability'])
      expect(celestial(build('authored'))).toEqual(['intuition', 'adaptability'])
    })

    it('stops at Astral for the placeholder, and reports no natal affinity for it', () => {
      const placeholder = build('placeholder')
      expect(celestial(placeholder)).toEqual([])
      const intuition = placeholder.seals.find(s => s.statKey === 'intuition')!
      expect(intuition.tier).toBe('Astral')
      expect(placeholder.sealProgress.find(p => p.stat === 'intuition')).toMatchObject({
        tier: 'Astral',
        nextTier: 'Celestial',
        blockedBy: ['natal'],
        natalAffinity: null,
      })
    })

    it('treats an unattributed chart like a placeholder: it earns nothing from the chart', () => {
      const unattributed = build('unattributed')
      expect(celestial(unattributed)).toEqual([])
      expect(unattributed.sealProgress.every(p => p.natalAffinity === null)).toBe(true)
    })
  })
})

// ─── The contract's pilots: their name and provenance, as well as their faction and look ──

describe('a contract pilot’s name and provenance', () => {
  const greg = getHistoricalAgent('greg-castro-1991')!
  /** [key, the contract's handle, the contract's provenance, what the roster calls the agent]. */
  const PILOT_IDENTITIES: ['isaac-newton' | 'leonardo-da-vinci' | 'emily-dickinson' | 'user-avatar-neo', string, 'historical' | 'user', string][] = [
    ['isaac-newton', 'Sir Isaac Newton', 'historical', 'Isaac Newton'],
    ['leonardo-da-vinci', 'Leonardo da Vinci', 'historical', 'Leonardo da Vinci'],
    ['emily-dickinson', 'Emily Dickinson', 'historical', 'Emily Dickinson'],
    ['user-avatar-neo', 'Adept Neo', 'user', 'Gregory Castro'],
  ] // prettier-ignore
  /** The roster agent a pilot key is rated from (the avatar is rated from Gregory's agent). */
  const agentFor = (key: string): CraftedAgent =>
    key === 'user-avatar-neo' ? greg : getHistoricalAgent(key)!
  const withChartProvenance = (agent: CraftedAgent, provenance: unknown): CraftedAgent =>
    ({
      ...agent,
      consciousness: {
        ...agent.consciousness,
        natalChart: { ...agent.consciousness.natalChart, provenance },
      },
    }) as unknown as CraftedAgent
  const payloadOf = (vessel: RatableVessel) =>
    buildRatedAgentPayload({
      vessel,
      balances: { agentId: vessel.agentId, balances: RICH, esmsSource: 'database' },
      sky: null,
    })

  it('has teeth: the table below is the contract’s own, and the roster names two of them differently', () => {
    expect(FIXTURE_AGENTS.map(f => [f.key, f.handle, f.provenance])).toEqual(
      PILOT_IDENTITIES.map(([key, handle, provenance]) => [key, handle, provenance])
    )
    for (const [key, handle, , rosterName] of PILOT_IDENTITIES) {
      expect(agentFor(key).name, key).toBe(rosterName)
      expect(rosterName === handle, key).toBe(key !== 'isaac-newton' && key !== 'user-avatar-neo')
    }
  })

  it.each(PILOT_IDENTITIES)(
    'names %s “%s” with provenance %s, in the vessel, the payload and the roster row',
    (key, handle, provenance) => {
      const vessel = ratableFromRoster(agentFor(key), key)
      expect(vessel.agentId).toBe(key)
      expect(vessel.name).toBe(handle)
      expect(vessel.provenance).toBe(provenance)
      expect(vessel.isPlaceholder).toBe(false)
      const payload = payloadOf(vessel)
      expect(payload.key).toBe(key)
      expect(payload.handle).toBe(handle)
      expect(payload.provenance).toBe(provenance)
      expect(payload.isPlaceholder).toBe(false)
      expect(summarizeVessel(vessel).handle).toBe(handle)
      expect(summarizeVessel(vessel).key).toBe(key)
    }
  )

  it('reads every identity field of a pilot as the contract carries it', () => {
    for (const fixture of FIXTURE_AGENTS) {
      const payload = payloadOf(ratableFromRoster(agentFor(fixture.key), fixture.key))
      expect(payload.key, fixture.key).toBe(fixture.key)
      expect(payload.handle, fixture.key).toBe(fixture.handle)
      expect(payload.faction, fixture.key).toBe(fixture.faction)
      expect(payload.factionName, fixture.key).toBe(fixture.factionName)
      expect(payload.provenance, fixture.key).toBe(fixture.provenance)
      expect(payload.isPlaceholder, fixture.key).toBe(fixture.isPlaceholder)
      expect(payload.appearance, fixture.key).toEqual(fixture.appearance)
    }
  })

  it('leaves the stats, the chart and the wallet of the avatar to the roster agent behind the alias', () => {
    const vessel = ratableFromRoster(greg, 'user-avatar-neo')
    expect(vessel.name).toBe('Adept Neo')
    expect(vessel.stats).toEqual(ratableFromRoster(greg).stats)
    expect(vessel.natalChart).toBe(greg.consciousness.natalChart)
    expect(resolveVesselAlias(vessel.agentId)).toBe(greg.id)
    // …and under its own id the same agent is the person, not the avatar.
    const own = ratableFromRoster(greg)
    expect(own.name).toBe('Gregory Castro')
    expect(own.provenance).toBe('historical')
  })

  it.each([
    ['isaac-newton-1643', 'isaac-newton', 'Sir Isaac Newton'],
    ['  ISAAC-Newton ', 'isaac-newton', 'Sir Isaac Newton'],
    ['Leonardo-Da-Vinci-1452', 'leonardo-da-vinci', 'Leonardo da Vinci'],
    ['user-avatar-neo-1991', 'user-avatar-neo', 'Adept Neo'],
    [' USER-AVATAR-NEO', 'user-avatar-neo', 'Adept Neo'],
  ])(
    'finds the pilot for the served id %j, as the manifest does (case, space, birth year)',
    (id, key, handle) => {
      const vessel = ratableFromRoster(agentFor(key), id)
      expect(vessel.agentId).toBe(id) // the id is served as given
      expect(vessel.name).toBe(handle)
      expect(vessel.provenance).toBe(key === 'user-avatar-neo' ? 'user' : 'historical')
    }
  )

  it('finds the pilot by the id a vessel is served under, never by the agent behind it', () => {
    // Socrates has a sourced chart (not a placeholder), so only the served id decides the identity.
    const socrates = getHistoricalAgent('socrates')!
    expect(socrates.consciousness.natalChart?.provenance).toBe('authored')
    const asNewton = ratableFromRoster(socrates, 'isaac-newton')
    expect(asNewton.name).toBe('Sir Isaac Newton')
    expect(asNewton.provenance).toBe('historical')
    expect(asNewton.faction).toBe(6)
    const asNeo = ratableFromRoster(socrates, 'user-avatar-neo')
    expect(asNeo.name).toBe('Adept Neo')
    expect(asNeo.provenance).toBe('user')
    expect(asNeo.faction).toBe(0)
    // Newton's own agent under another id is just the agent, and carries that id's faction.
    const newtonAsSocrates = ratableFromRoster(newton, 'socrates')
    expect(newtonAsSocrates.name).toBe('Isaac Newton')
    expect(newtonAsSocrates.provenance).toBe('historical')
    expect(newtonAsSocrates.faction).toBe(2) // Socrates', by the roster
  })

  it.each([
    'isaac-newton-x',
    'xisaac-newton',
    'isaac-newtons',
    'isaac-newton-1643-2',
    'isaac',
    'user-avatar',
    'user-avatar-neo-x',
    '',
    'constructor',
    '__proto__',
  ])('does not take the id %j for a pilot: the agent keeps its own name and provenance', id => {
    const vessel = ratableFromRoster(newton, id)
    expect(vessel.name).toBe('Isaac Newton')
    expect(vessel.provenance).toBe('historical')
  })

  it('keeps every other roster agent’s own name and provenance, and only Newton differs from his roster name', () => {
    const renamed = HISTORICAL_AGENTS.filter(agent => ratableFromRoster(agent).name !== agent.name)
    expect(renamed.map(agent => agent.id)).toEqual(['isaac-newton'])
    for (const agent of HISTORICAL_AGENTS) {
      const vessel = ratableFromRoster(agent)
      expect(vessel.provenance, agent.id).toBe(vessel.isPlaceholder ? 'placeholder' : 'historical')
    }
    const socrates = ratableFromRoster(getHistoricalAgent('socrates')!)
    expect([socrates.name, socrates.provenance]).toEqual(['Socrates', 'historical'])
    const plato = ratableFromRoster(getHistoricalAgent('plato')!) // a placeholder chart
    expect([plato.name, plato.provenance]).toEqual(['Plato', 'placeholder'])
  })

  it.each(PILOT_IDENTITIES)(
    'lets a placeholder chart outrank the contract’s provenance for %s, and keeps its handle',
    (key, handle) => {
      const vessel = ratableFromRoster(withChartProvenance(agentFor(key), 'placeholder'), key)
      expect(vessel.provenance).toBe('placeholder')
      expect(vessel.isPlaceholder).toBe(true)
      expect(vessel.name).toBe(handle)
      const payload = payloadOf(vessel)
      expect(payload.provenance).toBe('placeholder')
      expect(payload.isPlaceholder).toBe(true)
      expect(payload.handle).toBe(handle)
    }
  )

  it.each(['computed', 'authored', 'unattributed', undefined, 'anything-else'])(
    'keeps the contract’s provenance for a pilot whose chart provenance is %s',
    chartProvenance => {
      for (const [key, , provenance] of PILOT_IDENTITIES) {
        const vessel = ratableFromRoster(withChartProvenance(agentFor(key), chartProvenance), key)
        expect(vessel.provenance, key).toBe(provenance)
        expect(vessel.isPlaceholder, key).toBe(false)
      }
    }
  )

  it('leaves a forged row its own name and its user provenance, whatever its id', () => {
    for (const [key] of PILOT_IDENTITIES) {
      const vessel = ratableFromForgedRow(persistedRow({ agentId: key, name: 'Not The Pilot' }))!
      expect(vessel.name, key).toBe('Not The Pilot')
      expect(vessel.provenance, key).toBe('user')
      expect(vessel.origin, key).toBe('forged')
    }
  })
})

// ─── Looks: the contract's manifest, and ids that name Object.prototype members ──

describe('vessel ids and the look a vessel gets', () => {
  const PROTOTYPE_IDS = [
    'constructor',
    'toString',
    'valueOf',
    'hasOwnProperty',
    'isPrototypeOf',
    '__proto__',
  ]
  const PILOTS: [string, string][] = [
    ['isaac-newton', 'newton-curls'],
    ['leonardo-da-vinci', 'da-vinci-beret-beard'],
    ['emily-dickinson', 'dickinson-parted-bun'],
  ]
  /** The ratings of PERSISTED_STATS on the contract's scale, and the archetype they make. */
  const PERSISTED_RATINGS: Record<SacredStatKey, number> = {
    power: 69,
    resonance: 77,
    wisdom: 73,
    charisma: 78,
    intuition: 75,
    adaptability: 66,
    vitality: 70,
  }
  const PERSISTED_ARCHETYPE = {
    title: 'Resonant Herald',
    primary: 'charisma',
    secondary: 'resonance',
  }

  it('has teeth: the persisted stats rate as worked out on paper to the Resonant Herald', () => {
    expect(resolveArchetype(computeRelativeAdvantage(PERSISTED_RATINGS))).toEqual(
      PERSISTED_ARCHETYPE
    )
    expect(rateStats(PERSISTED_STATS).ratings).toEqual(PERSISTED_RATINGS)
  })

  it.each(PROTOTYPE_IDS)('gives a forged vessel called %s a real, serialisable look', id => {
    const vessel = ratableFromForgedRow(persistedRow({ agentId: id }))!
    expect(vessel).not.toBeNull()
    expect(typeof vessel.appearance).toBe('object')
    expect(vessel.appearance).not.toBeNull()
    expect(Object.keys(vessel.appearance)).toEqual(
      expect.arrayContaining(['era', 'portraitSvgDataUri'])
    )
    expect(vessel.appearance.era).toBe('astral')
    expect(vessel.appearance.portraitSvgDataUri!.startsWith('data:image/svg+xml')).toBe(true)
    // …the look of an unregistered id, seeded from its faction (Venus) and its archetype.
    expect(vessel.appearance).toEqual(resolveAgentAppearance(id, 3, PERSISTED_ARCHETYPE))
    const wire = JSON.parse(JSON.stringify(vessel))
    expect(wire.appearance).toEqual(vessel.appearance)
    expect(Object.keys(wire)).toContain('appearance')
  })

  it.each(PROTOTYPE_IDS)(
    'gives a roster agent served under the id %s a look derived from the id in its faction’s colour, not a prototype member',
    id => {
      const vessel = ratableFromRoster(newton, id)
      expect(vessel.agentId).toBe(id)
      // Neither a pilot nor on the roster: the manifest has no look for the id, so the look is
      // derived from the id and the faction the vessel flies under (Newton's Capricorn Sun: Saturn).
      expect(vessel.faction).toBe(6)
      expect(typeof vessel.appearance).toBe('object')
      expect(vessel.appearance).toEqual(resolveAgentAppearance(id, 6))
      expect(vessel.appearance.paletteOverrides.secondaryTrimHex).toBe(PLANET_COLORS[6])
      expect(vessel.appearance).not.toEqual(resolveAgentAppearance(id)) // the faction-less look is the Sun's
      expect(vessel.appearance.era).toBe('astral') // not on the roster, so not Newton's era
      expect(vessel.appearance.headSilhouette.crownStyle).not.toBe('newton-curls') // never the pilot
      expect(Object.keys(JSON.parse(JSON.stringify(vessel)))).toContain('appearance')
    }
  )

  it('serves a roster vessel exactly the look resolveAgentAppearance gives its id, for the whole roster the manifest lists', () => {
    // What the manifest knows: the contract's pilots and the 71 roster entries, by base key.
    const stripYear = (id: string): string => id.trim().toLowerCase().replace(/-\d+$/, '')
    const listed = new Set([...FIXTURE_AGENTS, ...CANONICAL_ROSTER_71].map(e => stripYear(e.key)))
    // In practice that is every roster agent but one, which the manifest has no entry for…
    expect(
      HISTORICAL_AGENTS.filter(agent => !listed.has(stripYear(agent.id))).map(a => a.id)
    ).toEqual(['greg-castro-1991'])
    // …and for all the others the vessel's look is the manifest's, byte for byte.
    const wrong = HISTORICAL_AGENTS.filter(
      agent =>
        listed.has(stripYear(agent.id)) &&
        JSON.stringify(ratableFromRoster(agent).appearance) !==
          JSON.stringify(resolveAgentAppearance(agent.id))
    )
    expect(wrong.map(agent => agent.id)).toEqual([])
    expect(HISTORICAL_AGENTS.filter(agent => listed.has(stripYear(agent.id))).length).toBe(71)
  })

  it('keeps the manifest’s own look for a listed id even when the served id differs from the roster’s key', () => {
    // 'plato-1900' is not a key anywhere, but its base key 'plato' is listed: the manifest strips
    // the suffix and answers with Plato's look. A look drawn from the id and the faction instead
    // would be the astral one.
    const plato = getHistoricalAgent('plato')!
    const vessel = ratableFromRoster(plato, 'plato-1900')
    expect(vessel.agentId).toBe('plato-1900')
    expect(vessel.appearance).toEqual(resolveAgentAppearance('plato-1900'))
    expect(vessel.appearance).toEqual(resolveAgentAppearance('plato'))
    expect(vessel.appearance.era).toBe('ancient')
    expect(vessel.appearance).not.toEqual(resolveAgentAppearance('plato-1900', vessel.faction))
    expect(resolveAgentAppearance('plato-1900', vessel.faction).era).toBe('astral')
  })

  it.each(PILOTS)(
    'keeps the hand-authored look of %s (crown %s) for the roster agent',
    (id, crown) => {
      const vessel = ratableFromRoster(getHistoricalAgent(id)!)
      expect(vessel.appearance.headSilhouette.crownStyle).toBe(crown)
      expect(vessel.appearance).toEqual(resolveAgentAppearance(id))
    }
  )

  it.each(PILOTS)(
    'keeps the hand-authored look of %s (crown %s) for a forged row of that id',
    (id, crown) => {
      const vessel = ratableFromForgedRow(persistedRow({ agentId: id }))!
      expect(vessel.appearance.headSilhouette.crownStyle).toBe(crown)
      expect(vessel.appearance).toEqual(resolveAgentAppearance(id))
    }
  )

  it('gives every contract pilot the look the contract itself carries', () => {
    for (const fixture of FIXTURE_AGENTS) {
      const forged = ratableFromForgedRow(persistedRow({ agentId: fixture.key }))!
      expect(forged.appearance, fixture.key).toEqual(fixture.appearance)
    }
  })

  it('keeps the avatar’s hand-authored look under the alias, for the roster agent and for a forged row', () => {
    const greg = getHistoricalAgent('greg-castro-1991')!
    const aliased = ratableFromRoster(greg, 'user-avatar-neo')
    expect(aliased.appearance.headSilhouette.crownStyle).toBe('sovereign-crest')
    expect(aliased.appearance.signatureRelic).toBe('solar-astrolabe')
    expect(aliased.appearance.era).toBe('astral')
    expect(aliased.appearance).toEqual(resolveAgentAppearance('user-avatar-neo'))
    // The alias carries the roster agent's stats and chart, not the pilot's.
    expect(aliased.stats).toEqual(ratableFromRoster(greg).stats)
    expect(aliased.natalChart).toBe(greg.consciousness.natalChart)
    // …and it keeps the pilot's own hand-authored trim, not the colour of the person's faction.
    expect(aliased.appearance.paletteOverrides.secondaryTrimHex).toBe('#efc45c')
    expect(aliased.appearance.paletteOverrides.secondaryTrimHex).not.toBe(PLANET_COLORS[1])
    expect(aliased.faction).toBe(0)
    // …while the same agent under its own id is not the avatar: the manifest lists no such id,
    // so its look is drawn from the id in its faction's colour (a Cancer Sun: the Moon).
    const own = ratableFromRoster(greg)
    expect(own.faction).toBe(1)
    expect(own.appearance).toEqual(resolveAgentAppearance('greg-castro-1991', 1))
    expect(own.appearance.paletteOverrides.secondaryTrimHex).toBe(PLANET_COLORS[1])
    expect(own.appearance.headSilhouette.crownStyle).not.toBe('sovereign-crest')
    expect(own.appearance).not.toEqual(aliased.appearance)

    const forged = ratableFromForgedRow(persistedRow({ agentId: 'user-avatar-neo' }))!
    expect(forged.appearance.headSilhouette.crownStyle).toBe('sovereign-crest')
    expect(forged.appearance).toEqual(aliased.appearance)
  })

  describe('the one roster agent the manifest does not list, asked for under its own id', () => {
    const greg = getHistoricalAgent('greg-castro-1991')!
    const withSun = (sign: string | null): CraftedAgent => {
      const chart = greg.consciousness.natalChart!
      return {
        ...greg,
        consciousness: {
          ...greg.consciousness,
          natalChart:
            sign === null
              ? undefined
              : { ...chart, planets: { ...chart.planets, Sun: { ...chart.planets.Sun, sign } } },
        },
      } as unknown as CraftedAgent
    }

    it('has teeth: neither the pilots nor the 71 roster entries list the id, so the manifest derives its look', () => {
      const listed = [...FIXTURE_AGENTS, ...CANONICAL_ROSTER_71].map(entry => entry.key)
      expect(listed.some(key => key.replace(/-\d+$/, '') === 'greg-castro')).toBe(false)
      expect(listed).not.toContain('greg-castro-1991')
      expect(resolveAgentAppearance('greg-castro-1991', 1)).not.toEqual(
        resolveAgentAppearance('greg-castro-1991')
      )
    })

    it('draws the look in the colour of the faction the natal Sun sign gives it', () => {
      const vessel = ratableFromRoster(greg)
      expect(vessel.faction).toBe(1) // a Cancer Sun: the Moon
      expect(vessel.appearance).toEqual(resolveAgentAppearance('greg-castro-1991', vessel.faction))
      expect(vessel.appearance.paletteOverrides.secondaryTrimHex).toBe(PLANET_COLORS[1])
      expect(vessel.appearance).not.toEqual(resolveAgentAppearance('greg-castro-1991'))
      expect(vessel.appearance.era).toBe('astral')
    })

    it.each(SIGN_NAMES.map((sign, index) => [sign, index] as const))(
      'follows the Sun sign: with the Sun in %s the look is that sign’s ruler’s colour',
      sign => {
        const vessel = ratableFromRoster(withSun(sign))
        const ruler = (FACTION_NAMES as readonly string[]).indexOf(getRulingPlanet(sign))
        expect(vessel.faction).toBe(ruler)
        expect(vessel.appearance).toEqual(resolveAgentAppearance('greg-castro-1991', ruler))
        expect(vessel.appearance.paletteOverrides.secondaryTrimHex).toBe(PLANET_COLORS[ruler])
        expect(
          buildRatedAgentPayload({
            vessel,
            balances: balances('greg-castro-1991'),
            sky: null,
          }).appearance
        ).toEqual(vessel.appearance)
      }
    )

    it('is drawn in the Sun’s colour when there is no chart to read a faction from', () => {
      const vessel = ratableFromRoster(withSun(null))
      expect(vessel.natalChart).toBeNull()
      expect(vessel.faction).toBe(0)
      expect(vessel.appearance).toEqual(resolveAgentAppearance('greg-castro-1991', 0))
      expect(vessel.appearance.paletteOverrides.secondaryTrimHex).toBe(PLANET_COLORS[0])
    })

    it('draws a look from the served id as given, so another spelling of it is another look', () => {
      const shouted = ratableFromRoster(greg, 'GREG-CASTRO-1991')
      expect(shouted.agentId).toBe('GREG-CASTRO-1991')
      expect(shouted.faction).toBe(1)
      expect(shouted.appearance).toEqual(resolveAgentAppearance('GREG-CASTRO-1991', 1))
      expect(shouted.appearance.paletteOverrides.secondaryTrimHex).toBe(PLANET_COLORS[1])
    })

    it('does not give a pilot or a listed roster agent a faction-drawn look, whatever its chart says', () => {
      for (const id of ['isaac-newton', 'plato', 'aristotle', 'voltaire-1694']) {
        const agent = getHistoricalAgent(id)!
        const vessel = ratableFromRoster(agent)
        expect(vessel.appearance, id).toEqual(resolveAgentAppearance(id))
      }
    })
  })

  it('keeps a year-suffixed pilot look for the roster agent and for a forged row', () => {
    const tesla = getHistoricalAgent('nikola-tesla-1856')!
    const roster = ratableFromRoster(tesla)
    const forged = ratableFromForgedRow(persistedRow({ agentId: 'nikola-tesla-1856' }))!
    for (const vessel of [roster, forged]) {
      expect(vessel.appearance.headSilhouette.crownStyle).toBe('tesla-parted-mustache')
      expect(vessel.appearance.signatureRelic).toBe('tesla-induction-coil')
      expect(vessel.appearance).toEqual(resolveAgentAppearance('nikola-tesla-1856'))
    }
  })

  it('seeds an unregistered forged id from the id, the faction and the archetype of its rating', () => {
    const vessel = ratableFromForgedRow(persistedRow({ agentId: 'agent-seeded-0007' }))!
    expect(vessel.appearance).toEqual(
      resolveAgentAppearance('agent-seeded-0007', 3, PERSISTED_ARCHETYPE)
    )
    expect(vessel.appearance.era).toBe('astral')
    // The faction decides the trim: Venus here (a Taurus Sun), Mars under an Aries Sun.
    expect(vessel.appearance.paletteOverrides.secondaryTrimHex).toBe(PLANET_COLORS[3])
    expect(vessel.appearance.paletteOverrides.secondaryTrimHex).toBe('#f6cf83')
    const mars = ratableFromForgedRow(
      persistedRow({
        agentId: 'agent-seeded-0007',
        natalChart: rosterShape({ Sun: { sign: 'Aries', degree: 10 } }),
      })
    )!
    expect(mars.faction).toBe(4)
    expect(mars.appearance.paletteOverrides.secondaryTrimHex).toBe('#f44336')
    expect(mars.appearance).toEqual(
      resolveAgentAppearance('agent-seeded-0007', 4, PERSISTED_ARCHETYPE)
    )
    expect(mars.appearance).not.toEqual(vessel.appearance)
  })

  it('lets the archetype shape the look: the same id and chart, rated differently, look different', () => {
    const power = ratableFromForgedRow(
      persistedRow({
        agentId: 'agent-seeded-0007',
        powerScore: 95,
        charismaScore: 40,
        resonanceScore7: 40,
        vitalityScore: 85,
      })
    )!
    expect(rateStats(power.stats).archetype.title).toBe('Juggernaut Anchor')
    expect(power.faction).toBe(3) // same chart, same faction
    expect(power.appearance).toEqual(
      resolveAgentAppearance('agent-seeded-0007', 3, 'Juggernaut Anchor')
    )
    expect(power.appearance).not.toEqual(
      ratableFromForgedRow(persistedRow({ agentId: 'agent-seeded-0007' }))!.appearance
    )
  })

  it('leaves a roster agent without a chart with no chart rather than an empty one', () => {
    const chartless = {
      ...newton,
      consciousness: { ...newton.consciousness, natalChart: undefined },
    } as unknown as CraftedAgent
    expect(ratableFromRoster(chartless).natalChart).toBeNull()
  })
})

// ─── 3D model URLs: carried when there are some, absent (not undefined) otherwise ──

describe('avatarModelUrl and headMeshUrl', () => {
  const withUrls = (urls: { avatarModelUrl?: string; headMeshUrl?: string }): CraftedAgent =>
    ({ ...newton, ...urls }) as unknown as CraftedAgent
  const OWN = { avatarModelUrl: '/models/own.glb', headMeshUrl: '/models/own-head.glb' }
  const hasKey = (value: object, key: string) => Object.hasOwn(value, key)

  it('has no such keys on a roster vessel whose agent and look name none, rather than undefined ones', () => {
    const vessel = ratableFromRoster(newton)
    expect(hasKey(vessel, 'avatarModelUrl')).toBe(false)
    expect(hasKey(vessel, 'headMeshUrl')).toBe(false)
    expect(Object.keys(JSON.parse(JSON.stringify(vessel)))).not.toContain('avatarModelUrl')
  })

  it('carries the agent’s own model and head mesh onto the vessel, each independently', () => {
    expect(ratableFromRoster(withUrls(OWN))).toMatchObject(OWN)
    const modelOnly = ratableFromRoster(withUrls({ avatarModelUrl: '/models/own.glb' }))
    expect(modelOnly.avatarModelUrl).toBe('/models/own.glb')
    expect(hasKey(modelOnly, 'headMeshUrl')).toBe(false)
    const meshOnly = ratableFromRoster(withUrls({ headMeshUrl: '/models/own-head.glb' }))
    expect(meshOnly.headMeshUrl).toBe('/models/own-head.glb')
    expect(hasKey(meshOnly, 'avatarModelUrl')).toBe(false)
  })

  it('takes both from the look when the agent names none, and prefers the agent’s own when it does', () => {
    const fromLook = ratableFromRoster(newton, 'mesh-vessel')
    expect(fromLook.avatarModelUrl).toBe('/models/mesh-vessel.glb')
    expect(fromLook.headMeshUrl).toBe('/models/mesh-vessel-head.glb')
    expect(ratableFromRoster(withUrls(OWN), 'mesh-vessel')).toMatchObject(OWN)
    const mixed = ratableFromRoster(withUrls({ avatarModelUrl: '/models/own.glb' }), 'mesh-vessel')
    expect(mixed.avatarModelUrl).toBe('/models/own.glb')
    expect(mixed.headMeshUrl).toBe('/models/mesh-vessel-head.glb')
  })

  it('carries a forged vessel’s look URLs onto the vessel, and none when the look has none', () => {
    const plain = ratableFromForgedRow(persistedRow({ agentId: 'agent-plain-0001' }))!
    expect(hasKey(plain, 'avatarModelUrl')).toBe(false)
    expect(hasKey(plain, 'headMeshUrl')).toBe(false)
    const meshed = ratableFromForgedRow(persistedRow({ agentId: 'mesh-vessel' }))!
    expect(meshed.avatarModelUrl).toBe('/models/mesh-vessel.glb')
    expect(meshed.headMeshUrl).toBe('/models/mesh-vessel-head.glb')
  })

  it('passes both through to the payload when the vessel has them, and keeps the keys absent when not', () => {
    const base = ratableFromForgedRow(persistedRow())!
    const at = (urls: { avatarModelUrl?: string; headMeshUrl?: string }) =>
      buildRatedAgentPayload({
        vessel: { ...base, ...urls },
        balances: { agentId: 'x', balances: RICH, esmsSource: 'database' },
        sky: null,
      })
    const both = at(OWN)
    expect(both.avatarModelUrl).toBe('/models/own.glb')
    expect(both.headMeshUrl).toBe('/models/own-head.glb')
    const modelOnly = at({ avatarModelUrl: '/models/own.glb' })
    expect(modelOnly.avatarModelUrl).toBe('/models/own.glb')
    expect(hasKey(modelOnly, 'headMeshUrl')).toBe(false)
    const meshOnly = at({ headMeshUrl: '/models/own-head.glb' })
    expect(meshOnly.headMeshUrl).toBe('/models/own-head.glb')
    expect(hasKey(meshOnly, 'avatarModelUrl')).toBe(false)
    for (const none of [at({}), at({ avatarModelUrl: undefined, headMeshUrl: undefined })]) {
      expect(hasKey(none, 'avatarModelUrl')).toBe(false)
      expect(hasKey(none, 'headMeshUrl')).toBe(false)
      expect(Object.keys(JSON.parse(JSON.stringify(none)))).not.toContain('headMeshUrl')
    }
    // An empty string names no model: it is not carried either.
    const empty = at({ avatarModelUrl: '', headMeshUrl: '' })
    expect(hasKey(empty, 'avatarModelUrl')).toBe(false)
    expect(hasKey(empty, 'headMeshUrl')).toBe(false)
  })

  it('goes from a look with a model, through the vessel, to the payload', () => {
    const vessel = ratableFromForgedRow(persistedRow({ agentId: 'mesh-vessel' }))!
    const payload = buildRatedAgentPayload({
      vessel,
      balances: { agentId: 'mesh-vessel', balances: RICH, esmsSource: 'database' },
      sky: null,
    })
    expect(payload.avatarModelUrl).toBe('/models/mesh-vessel.glb')
    expect(payload.headMeshUrl).toBe('/models/mesh-vessel-head.glb')
    expect(payload.appearance.avatarModelUrl).toBe('/models/mesh-vessel.glb')
  })
})

// ─── The payload, value by value ─────────────────────────────────────────────

/** The Sacred 7 ratings of stats on the contract's 25–99 scale, from the contract's own clamp. */
const ratingsOf = (stats: CoreStats): Record<SacredStatKey, number> =>
  Object.fromEntries(
    SACRED_STAT_KEYS.map(key => [key, clampStat(25 + (stats[key] / 100) * 74)])
  ) as Record<SacredStatKey, number>

/** The chart's ten bodies in `SKY_BODIES` order, as signs. */
const signsOf = (signs: string[]): SkyBodies =>
  Object.fromEntries(SKY_BODIES.map((body, i) => [body, { sign: signs[i] }]))

/** A live sky with chosen thermodynamics, Monica and signs. */
const makeSky = (
  heat: number,
  reactivity: number,
  monica: number | null,
  signs: string[]
): LiveSky => ({
  source: 'swiss-ephemeris',
  at: '2026-10-15T05:43:00.000Z',
  thermodynamics: { heat, entropy: 0.31, reactivity, gregsEnergy: -0.98 },
  kalchm: 1767.88,
  monica,
  bodies: signsOf(signs),
})

describe('buildRatedAgentPayload, value by value', () => {
  const STATS: CoreStats = {
    power: 80,
    resonance: 40,
    wisdom: 65,
    charisma: 55,
    intuition: 90,
    adaptability: 30,
    vitality: 70,
  }
  /** Natal signs in `SKY_BODIES` order: Fire, Fire, Air, Earth, Fire, Water, Earth, Air, Water, Water. */
  const NATAL = [
    'Aries',
    'Leo',
    'Gemini',
    'Taurus',
    'Sagittarius',
    'Cancer',
    'Capricorn',
    'Aquarius',
    'Pisces',
    'Scorpio',
  ]
  const CHART = { planets: signsOf(NATAL) }
  /** Every body in the element that is neither kin nor foe: Fire↔Earth, Air↔Water. */
  const NEUTRAL = ['Taurus', 'Capricorn', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Aries', 'Scorpio', 'Gemini', 'Aquarius'] // prettier-ignore
  /** Every body in the opposing element: Fire↔Water, Air↔Earth. */
  const OPPOSED = ['Cancer', 'Scorpio', 'Capricorn', 'Aquarius', 'Pisces', 'Aries', 'Gemini', 'Taurus', 'Leo', 'Sagittarius'] // prettier-ignore
  /** Heat at the top of its ramp (share 1), reactivity 60% up its own (share 0.6): a meter of 80. */
  const HOT: [number, number] = [0.12, 2.376]
  const HOLDINGS = { spirit: 60, essence: 3, matter: 12, substance: 30 }
  const ZERO_HOLDINGS = { spirit: 0, essence: 0, matter: 0, substance: 0 }
  /** A look that is deliberately not the one 'fixed-vessel' would be given. */
  const look = resolveAgentAppearance('plato')
  const vessel: RatableVessel = {
    agentId: 'fixed-vessel',
    name: 'Fixed Vessel',
    origin: 'forged',
    stats: STATS,
    natalChart: CHART,
    faction: 4,
    isPlaceholder: false,
    provenance: 'user',
    appearance: look,
  }
  const resolved = (over: Partial<ResolvedEsmsBalances> = {}): ResolvedEsmsBalances => ({
    agentId: 'fixed-vessel',
    balances: HOLDINGS,
    esmsSource: 'database',
    ...over,
  })
  const build = (
    liveSky: LiveSky | null,
    over: Partial<Parameters<typeof buildRatedAgentPayload>[0]> = {}
  ) => buildRatedAgentPayload({ vessel, balances: resolved(), sky: liveSky, ...over })

  const neutralHot = makeSky(...HOT, 0.5, NEUTRAL)
  const payload = build(neutralHot)
  const calm = build(null)
  /** The ratings above, on the contract's scale. */
  const RATINGS: Record<SacredStatKey, number> = {
    power: 84,
    resonance: 55,
    wisdom: 73,
    charisma: 66,
    intuition: 92,
    adaptability: 47,
    vitality: 77,
  }

  it('names the vessel under the contract’s keys, with its faction, provenance and look', () => {
    expect(payload).toMatchObject({
      key: 'fixed-vessel',
      handle: 'Fixed Vessel',
      faction: 4,
      factionName: 'Mars',
      isPlaceholder: false,
      provenance: 'user',
    })
    // The look is the vessel's own, not one re-resolved from its id.
    expect(payload.appearance).toEqual(look)
    expect(payload.appearance).not.toEqual(resolveAgentAppearance('fixed-vessel', 4, 'x'))
  })

  it('serves the id and the name exactly as the vessel holds them: no trimming, no case folding', () => {
    // Only the faction lookup normalises an id; the key the game reads back is the id it sent.
    const odd = { ...vessel, agentId: '  Odd-ID-1856 ', name: '  Odd  Name ' }
    const built = build(null, { vessel: odd })
    expect(built.key).toBe('  Odd-ID-1856 ')
    expect(built.handle).toBe('  Odd  Name ')
    const row = summarizeVessel(odd)
    expect(row.key).toBe('  Odd-ID-1856 ')
    expect(row.handle).toBe('  Odd  Name ')
    const forged = ratableFromForgedRow(persistedRow({ agentId: ' Plato ', name: ' Plato  ' }))!
    expect(forged.agentId).toBe(' Plato ')
    expect(forged.name).toBe(' Plato  ')
    expect(forged.faction).toBe(0) // …while the faction lookup does fold it: Plato is the Sun's
  })

  it('serves none of the keys the contract retired', () => {
    for (const retired of ['agentId', 'name', 'esmsBalances', 'spread']) {
      expect(Object.hasOwn(payload, retired), retired).toBe(false)
    }
    const text = JSON.stringify(payload).toLowerCase()
    expect(text).not.toContain(['ae', 'ther'].join(''))
  })

  it('names the scale the ratings are on', () => {
    expect(payload.scale).toEqual(VESSEL_RATING_SCALE)
    expect(payload.scale).toEqual({ name: 'Pentacle Vessel Rating Scale', floor: 25, ceiling: 99 })
  })

  it('serves the contract’s own bounds as the scale: what its clamp pins any stat to', () => {
    // The contract states 25 and 99 only inside `clampStat`; the scale is read from it. (An
    // infinity is not a stat to clamp but a non-number the contract floors, so use huge finite ones.)
    expect(payload.scale.floor).toBe(clampStat(-1e9))
    expect(payload.scale.ceiling).toBe(clampStat(1e9))
    for (const rating of [...Object.values(payload.ratings), payload.ovr]) {
      expect(rating).toBeGreaterThanOrEqual(payload.scale.floor)
      expect(rating).toBeLessThanOrEqual(payload.scale.ceiling)
    }
  })

  it('pins the rating of one fixed vessel, worked out on paper', () => {
    // rating = round(25 + 0.74·stat), on 25–99.
    expect(payload.ratings).toEqual(RATINGS)
    // OVR = (92·1.6 + 84·1.3 + mean(77, 73, 66, 55, 47)=63.6) / 3.9 = 320 / 3.9 = 82.05
    expect(payload.ovr).toBe(82)
    // rating minus the contract's baseline 63 / 62 / 64 / 61 / 62 / 63 / 62
    expect(payload.relativeAdvantage).toEqual({
      power: 21,
      resonance: -7,
      wisdom: 9,
      charisma: 5,
      intuition: 30,
      adaptability: -16,
      vitality: 15,
    })
    expect(payload.archetype).toEqual({
      title: 'Prescient Ingressor',
      primary: 'intuition',
      secondary: 'power',
    })
  })

  it('pins a second vessel, led by power and vitality', () => {
    const stats: CoreStats = {
      power: 95,
      resonance: 40,
      wisdom: 40,
      charisma: 40,
      intuition: 40,
      adaptability: 40,
      vitality: 85,
    }
    const built = build(null, { vessel: { ...vessel, stats } })
    // power 95, vitality 88, the other five 55: (95·1.6 + 88·1.3 + 55) / 3.9 = 321.4 / 3.9 = 82.4
    expect(built.ratings).toEqual({
      power: 95,
      resonance: 55,
      wisdom: 55,
      charisma: 55,
      intuition: 55,
      adaptability: 55,
      vitality: 88,
    })
    expect(built.ovr).toBe(82)
    expect(built.relativeAdvantage.power).toBe(32)
    expect(built.relativeAdvantage.wisdom).toBe(-9)
    expect(built.archetype).toEqual({
      title: 'Juggernaut Anchor',
      primary: 'power',
      secondary: 'vitality',
    })
  })

  it('serves the contract’s own figures for the same ratings, over a spread of stat vectors', () => {
    // A fixed linear-congruential stream: the same 300 vectors on every run and every machine.
    let state = 20261019
    const next = () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return state / 4294967296
    }
    const vectors: CoreStats[] = [
      { power: 0, resonance: 0, wisdom: 0, charisma: 0, intuition: 0, adaptability: 0, vitality: 0 },
      { power: 100, resonance: 100, wisdom: 100, charisma: 100, intuition: 100, adaptability: 100, vitality: 100 },
      { power: 50, resonance: 50, wisdom: 50, charisma: 50, intuition: 50, adaptability: 50, vitality: 50 },
    ] // prettier-ignore
    for (let i = 0; i < 300; i += 1) {
      vectors.push(
        Object.fromEntries(
          SACRED_STAT_KEYS.map(key => [key, Math.round(next() * 10_000) / 100])
        ) as CoreStats
      )
    }
    const wrong: string[] = []
    for (const [i, stats] of vectors.entries()) {
      const built = build(null, { vessel: { ...vessel, stats } })
      const ratings = ratingsOf(stats)
      const relativeAdvantage = computeRelativeAdvantage(ratings)
      const ok =
        JSON.stringify(built.ratings) === JSON.stringify(ratings) &&
        built.ovr === computeOvr(ratings) &&
        JSON.stringify(built.relativeAdvantage) === JSON.stringify(relativeAdvantage) &&
        JSON.stringify(built.archetype) === JSON.stringify(resolveArchetype(relativeAdvantage))
      if (!ok) wrong.push(`#${i} ${JSON.stringify(stats)}`)
    }
    expect(wrong).toEqual([])
  })

  it('passes the resolved holdings and their source through untouched', () => {
    expect(payload.esms).toEqual(HOLDINGS)
    expect(payload.esmsSource).toBe('database')
    for (const esmsSource of ['spacetimedb', 'database', 'fallback'] as const) {
      const again = build(neutralHot, { balances: resolved({ esmsSource }) })
      expect(again.esmsSource).toBe(esmsSource)
    }
    const other = { spirit: 1.5, essence: 2.5, matter: 3.5, substance: 4.5 }
    expect(build(neutralHot, { balances: resolved({ balances: other }) }).esms).toEqual(other)
  })

  describe('seals', () => {
    it('earns, from these stats and holdings, exactly the three Seals the contract builds', () => {
      expect(payload.seals).toEqual([
        buildCanonicalSeal('power', 'Copper'),
        buildCanonicalSeal('intuition', 'Astral'),
        buildCanonicalSeal('vitality', 'Copper'),
      ])
      expect(payload.seals.map(s => [s.id, s.tier, s.category, s.multiplier])).toEqual([
        ['seal-power', 'Copper', 'substance', 1.05],
        ['seal-intuition', 'Astral', 'spirit', 1.28],
        ['seal-vitality', 'Copper', 'matter', 1.05],
      ])
      expect(payload.seals.map(s => s.name)).toEqual([
        CANONICAL_SEAL_CATALOG.power.name,
        'Astral Vision',
        'Immovable Foundation',
      ])
    })

    it('gives every earned Seal the full contract shape, and nothing else', () => {
      for (const seal of payload.seals) {
        expect(Object.keys(seal).sort()).toEqual([
          'category',
          'description',
          'id',
          'multiplier',
          'name',
          'statKey',
          'tier',
        ])
      }
    })

    it('is the earned subset of sealProgress, built by the contract per stat and tier', () => {
      expect(payload.seals).toEqual(earnedSeals(payload.sealProgress))
      const expected = payload.sealProgress
        .filter(progress => progress.tier !== null)
        .map(progress => buildCanonicalSeal(progress.stat, progress.tier!))
      expect(payload.seals).toEqual(expected)
      expect(payload.seals.length).toBeLessThan(payload.sealProgress.length)
    })

    it('reports every catalog Seal in the contract’s stat order, earned or not', () => {
      expect(payload.sealProgress.map(p => p.id)).toEqual(SACRED_STAT_KEYS.map(k => `seal-${k}`))
      expect(payload.sealProgress.map(p => p.stat)).toEqual([...SACRED_STAT_KEYS])
      expect(payload.sealProgress.map(p => p.tier)).toEqual([
        'Copper',
        null,
        null,
        null,
        'Astral',
        null,
        'Copper',
      ])
      expect(payload.sealProgress.map(p => p.token)).toEqual([
        'substance',
        'essence',
        'matter',
        'essence',
        'spirit',
        'spirit',
        'matter',
      ])
    })

    it('says which Seals can never reach Celestial: power tops out at Gold, the rest can reach it', () => {
      expect(payload.sealProgress.map(p => p.maxTier)).toEqual([
        'Gold', // Crucible Finisher: a perfect power aligns to 90.5, short of Astral's 91
        'Celestial',
        'Celestial',
        'Celestial',
        'Celestial',
        'Celestial',
        'Celestial',
      ])
    })

    it('pins the standing of the intuition and power Seals', () => {
      const progress = (stat: string) => payload.sealProgress.find(p => p.stat === stat)!
      // intuition 90 → rating 92 → aligned 92 − 66 + 68 = 94: Astral (91) with 60 spirit (50),
      // short of Celestial on stat (96), balance (250) and the chart (3 Fire bodies of 4).
      expect(progress('intuition')).toMatchObject({
        id: 'seal-intuition',
        name: 'Astral Vision',
        token: 'spirit',
        tier: 'Astral',
        nextTier: 'Celestial',
        blockedBy: ['stat', 'esms', 'natal'],
        maxTier: 'Celestial',
        statRating: 92,
        alignedRating: 94,
        balance: 60,
        natalAffinity: 3,
      })
      // power 80 → rating 84 → aligned 84 − 76.5 + 68 = 75.5: Copper (74) with 30 substance;
      // Silver needs 80 on stat.
      expect(progress('power')).toMatchObject({
        id: 'seal-power',
        name: 'Crucible Finisher',
        token: 'substance',
        tier: 'Copper',
        nextTier: 'Silver',
        blockedBy: ['stat'],
        maxTier: 'Gold',
        statRating: 84,
        alignedRating: 75.5,
        balance: 30,
        natalAffinity: 2,
      })
      expect(progress('resonance')).toMatchObject({
        tier: null,
        nextTier: 'Copper',
        alignedRating: 56,
      })
    })

    it('stops advertising a tier above what a Seal’s stat can reach', () => {
      const peak = build(null, {
        vessel: { ...vessel, stats: { ...STATS, power: 100 } },
        balances: resolved({ balances: { spirit: 0, essence: 0, matter: 0, substance: 1000 } }),
      })
      expect(peak.sealProgress.find(p => p.stat === 'power')).toMatchObject({
        tier: 'Gold',
        nextTier: null,
        blockedBy: [],
        maxTier: 'Gold',
      })
    })

    it('reads the stats, the holdings and the chart from the vessel and the resolved balances', () => {
      // Poorer holdings: no spirit or substance, so neither the Astral nor the power Copper Seal.
      const poor = build(null, {
        balances: resolved({ balances: { ...HOLDINGS, spirit: 0, substance: 0 } }),
      })
      expect(poor.seals.map(s => s.id)).toEqual(['seal-vitality'])
      const none = build(null, { balances: resolved({ balances: ZERO_HOLDINGS }) })
      expect(none.seals).toEqual([])
      expect(none.sealProgress).toHaveLength(7)
      // Weaker stats: intuition falls from Astral.
      const weak = build(null, { vessel: { ...vessel, stats: { ...STATS, intuition: 70 } } })
      expect(weak.sealProgress.find(p => p.stat === 'intuition')!.tier).not.toBe('Astral')
      // No chart: no Seal reports a natal affinity.
      const chartless = build(null, { vessel: { ...vessel, natalChart: null } })
      expect(payload.sealProgress.every(p => p.natalAffinity !== null)).toBe(true)
      expect(chartless.sealProgress.every(p => p.natalAffinity === null)).toBe(true)
      expect(chartless.seals).toEqual(payload.seals) // …and no tier below Celestial depends on it
    })

    it('lets the chart open Celestial where the stat and the balance already clear it', () => {
      const maxed: CoreStats = { ...STATS, intuition: 100, adaptability: 100 }
      const rich = resolved({ balances: { ...HOLDINGS, spirit: 300 } })
      const fire = { planets: signsOf(['Aries', 'Leo', 'Sagittarius', 'Aries', 'Leo', 'Sagittarius', 'Aries', 'Leo', 'Sagittarius', 'Aries']) } // prettier-ignore
      const opened = build(null, {
        vessel: { ...vessel, stats: maxed, natalChart: fire },
        balances: rich,
      })
      const closed = build(null, { vessel: { ...vessel, stats: maxed }, balances: rich })
      expect(opened.seals.find(s => s.statKey === 'intuition')!.tier).toBe('Celestial')
      expect(closed.seals.find(s => s.statKey === 'intuition')!.tier).toBe('Astral') // 3 Fire bodies
    })
  })

  describe('surge', () => {
    const surgeOf = (liveSky: LiveSky) => build(liveSky).surge!
    const BASE_BOOST = { power: 8, resonance: 4, wisdom: 4, charisma: 4, intuition: 12, adaptability: 4, vitality: 4 } // prettier-ignore

    it('is built from the live sky, the vessel’s chart against it, the sky’s Monica and the vessel’s archetype', () => {
      const surge = surgeOf(neutralHot)
      expect(surge).toEqual(
        calculateResonanceSurge({
          thermodynamics: neutralHot.thermodynamics,
          monica: neutralHot.monica,
          archetype: { primary: 'intuition', secondary: 'power' },
          natalChart: CHART,
          sky: neutralHot.bodies,
        })
      )
    })

    it('pins a neutral hot sky: meter 80, active, an inferno, boosts led by the vessel’s primary and secondary', () => {
      const surge = surgeOf(neutralHot)
      expect(surge).toMatchObject({
        meter: 80,
        active: true,
        surgeType: 'inferno',
        monica: 0.5,
        monicaState: 'convergent',
        heat: 1,
        harmonyOffset: 0,
        statBoosts: BASE_BOOST,
      })
      expect(surge.skyMeter).toBeCloseTo(80, 9)
      expect(surge.reactivity).toBeCloseTo(0.6, 9) // a ramp position, not the raw 2.376
    })

    it('boosts the primary by 12 and the secondary by 8 for whichever archetype the vessel has', () => {
      const power = build(neutralHot, {
        vessel: { ...vessel, stats: { ...STATS, power: 95, vitality: 85, intuition: 40 } },
      })
      expect(power.archetype.primary).toBe('power')
      expect(power.archetype.secondary).toBe('vitality')
      expect(power.surge!.statBoosts).toEqual({
        power: 12,
        resonance: 4,
        wisdom: 4,
        charisma: 4,
        intuition: 4,
        adaptability: 4,
        vitality: 8,
      })
    })

    it('moves the meter by the chart’s harmony with the sky: kin +12, foe −12, neutral 0', () => {
      const aligned = surgeOf(makeSky(...HOT, 0.5, NATAL))
      expect(aligned.harmonyOffset).toBe(12)
      expect(aligned.meter).toBe(92)
      expect(aligned.active).toBe(true)
      const opposed = surgeOf(makeSky(...HOT, 0.5, OPPOSED))
      expect(opposed.harmonyOffset).toBe(-12)
      expect(opposed.meter).toBe(68)
      expect(opposed.skyMeter).toBeCloseTo(80, 9) // the shared sky is the same; only the chart differs
    })

    it('does not ignite when the chart’s harmony pulls the meter under 70, and boosts nothing', () => {
      const opposed = surgeOf(makeSky(...HOT, 0.5, OPPOSED))
      expect(opposed.active).toBe(false)
      expect(opposed.statBoosts).toEqual({})
      expect(opposed.surgeType).toBe('inferno')
    })

    it('reads a chartless vessel and a placeholder chart as a neutral one, offset 0', () => {
      const chartless = build(makeSky(...HOT, 0.5, NATAL), {
        vessel: { ...vessel, natalChart: null },
      })
      expect(chartless.surge!.harmonyOffset).toBe(0)
      expect(chartless.surge!.meter).toBe(80)
      const placeholder = build(makeSky(...HOT, 0.5, NATAL), {
        vessel: { ...vessel, natalChart: { ...CHART, provenance: 'placeholder' } },
      })
      expect(placeholder.surge!.harmonyOffset).toBe(0)
    })

    it('makes a tempest when the reactivity ramp leads the heat ramp', () => {
      const tempest = surgeOf(makeSky(0.04, 3.6, null, NATAL))
      // heat share (0.04 − 0.0184)/0.097 ≈ 0.223, reactivity share 1: a sky meter of ≈ 61.1, +12.
      expect(tempest.meter).toBe(73)
      expect(tempest.active).toBe(true)
      expect(tempest.surgeType).toBe('tempest')
      expect(tempest.statBoosts).toEqual(BASE_BOOST)
      expect(tempest.heat).toBeLessThan(tempest.reactivity)
    })

    it('upgrades an active surge at Monica equilibrium, with the larger boosts', () => {
      const equilibrium = surgeOf(makeSky(...HOT, 1.618, NEUTRAL))
      expect(equilibrium).toMatchObject({
        active: true,
        surgeType: 'equilibrium',
        monica: 1.618,
        monicaState: 'equilibrium',
        statBoosts: {
          power: 12,
          resonance: 8,
          wisdom: 8,
          charisma: 8,
          intuition: 16,
          adaptability: 8,
          vitality: 8,
        },
      })
      // An inactive surge does not upgrade, whatever the Monica.
      const inactive = surgeOf(makeSky(...HOT, 1.618, OPPOSED))
      expect(inactive).toMatchObject({
        active: false,
        surgeType: 'inferno',
        monicaState: 'equilibrium',
      })
      expect(inactive.statBoosts).toEqual({})
    })

    it('classifies the sky’s Monica: absent when null, convergent when positive', () => {
      expect(surgeOf(makeSky(...HOT, 0.5, NEUTRAL)).monicaState).toBe('convergent')
      const absent = surgeOf(makeSky(...HOT, null, NEUTRAL))
      expect(absent.monicaState).toBe('absent')
      expect(absent.monica).toBeNull()
      expect(absent.active).toBe(true) // an absent Monica never quiets a surge
      expect(build(makeSky(...HOT, null, NEUTRAL)).sky!.monica).toBeNull()
    })

    it('refuses a broken sky instead of reporting a calm surge', () => {
      expect(() => build(makeSky(Number.NaN, 2, 0.5, NEUTRAL))).toThrow(RangeError)
      expect(() => build(makeSky(0.1, Number.POSITIVE_INFINITY, 0.5, NEUTRAL))).toThrow(RangeError)
      expect(() => build(makeSky(0.1, 2, Number.NaN, NEUTRAL))).toThrow(RangeError)
    })

    it('echoes the sky the surge was read from, field for field', () => {
      expect(payload.sky).toStrictEqual({
        source: 'swiss-ephemeris',
        at: '2026-10-15T05:43:00.000Z',
        heat: 0.12,
        reactivity: 2.376,
        monica: 0.5,
      })
      const approximated = build({ ...neutralHot, source: 'vsop87-approximation' })
      expect(approximated.sky!.source).toBe('vsop87-approximation')
      // The echo carries the engine's raw figures, the surge their ramp positions.
      expect(payload.sky!.heat).not.toBe(payload.surge!.heat)
      expect(payload.sky!.reactivity).not.toBe(payload.surge!.reactivity)
    })
  })

  describe('zones', () => {
    // Worked on paper from the ratings above and the zone weights: zone 3 has weights
    // 25 / 20 / 5 / 5 / 5 / 5 / 35 and no Essence Seal, so calm it is
    // .25·84 + .20·55 + .05·(73 + 66 + 92 + 47) + .35·77 = 72.85. Zone 2 (Fire) takes the Astral
    // Spirit Seal's ×1.28 on 75.2 → 96.26. An active inferno adds +8 / +4 / +4 / +4 / +12 / +4 / +4
    // (intuition clamped at 99), which makes zone 3 .25·92 + .20·59 + .05·(77 + 70 + 99 + 51) +
    // .35·81 = 78.
    const CALM = [79.33, 75.97, 96.26, 72.85, 82.69, 75.29, 70.77, 96.58, 88.19, 71.2, 69.4]
    const ACTIVE = [84.74, 81.8, 103.36, 78, 88.78, 80.33, 76.02, 103.55, 94.34, 76.3, 74.27]

    it('pins every zone’s synergy for the calm vessel and for the vessel under an active surge', () => {
      expect(calm.zoneSynergies.map(z => z.synergy)).toEqual(CALM)
      expect(payload.zoneSynergies.map(z => z.synergy)).toEqual(ACTIVE)
      expect(calm.bestZoneId).toBe(7)
      expect(payload.bestZoneId).toBe(7)
      expect(calm.zoneSynergies.map(z => z.zoneId)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    it('does not light the surge when it did not ignite: the zones are the calm ones', () => {
      const inactive = build(makeSky(...HOT, 0.5, OPPOSED))
      expect(inactive.surge!.active).toBe(false)
      expect(inactive.zoneSynergies.map(z => z.synergy)).toEqual(CALM)
    })

    it('lets the surge change which zone is best, not only the scores', () => {
      // Found by searching stat vectors: calm, these stats put zone 10 first; under the active
      // inferno (resonance leads, so it takes +12, power +8, the rest +4) zone 3 takes the lead.
      const stats: CoreStats = {
        power: 78,
        resonance: 85,
        wisdom: 18,
        charisma: 47,
        intuition: 34,
        adaptability: 71,
        vitality: 18,
      }
      const lit = build(neutralHot, { vessel: { ...vessel, stats } })
      const quiet = build(null, { vessel: { ...vessel, stats } })
      expect(lit.surge!.active).toBe(true)
      expect(lit.archetype.primary).toBe('resonance')
      expect(quiet.bestZoneId).toBe(10)
      expect(lit.bestZoneId).toBe(3)
      expect(lit.bestZoneId).toBe(
        bestZoneId({ ratings: lit.ratings, seals: lit.seals, surge: lit.surge })
      )
      expect(lit.bestZoneId).not.toBe(
        bestZoneId({ ratings: lit.ratings, seals: lit.seals, surge: null })
      )
      expect(lit.zoneSynergies[lit.bestZoneId].synergy).toBe(
        Math.max(...lit.zoneSynergies.map(z => z.synergy))
      )
    })

    it('equals the contest engine on the rated vessel, its earned Seals and its surge', () => {
      const contestant = { ratings: RATINGS, seals: payload.seals, surge: payload.surge }
      expect(payload.zoneSynergies).toEqual(computeZoneSynergies(contestant))
      expect(payload.bestZoneId).toBe(bestZoneId(contestant))
      expect(calm.zoneSynergies).toEqual(
        computeZoneSynergies({ ratings: RATINGS, seals: calm.seals, surge: null })
      )
    })

    it('scores every build with its Seals, ratings and surge together, and each ingredient matters', () => {
      const builds: [string, CoreStats][] = [
        ['power-led', { power: 95, resonance: 40, wisdom: 40, charisma: 40, intuition: 40, adaptability: 40, vitality: 85 }], // prettier-ignore
        ['intuition-led', { power: 40, resonance: 40, wisdom: 85, charisma: 40, intuition: 95, adaptability: 40, vitality: 40 }], // prettier-ignore
        ['adaptability-led', { power: 40, resonance: 40, wisdom: 60, charisma: 40, intuition: 70, adaptability: 95, vitality: 40 }], // prettier-ignore
      ]
      const best = new Set<number>()
      const rich = { spirit: 300, essence: 300, matter: 300, substance: 300 }
      for (const [label, stats] of builds) {
        const built = build(neutralHot, {
          vessel: { ...vessel, stats },
          balances: resolved({ balances: rich }),
        })
        const ratings = ratingsOf(stats)
        const seals = earnedSeals(evaluateSeals({ stats, esmsBalances: rich, natalChart: CHART }))
        const surge = built.surge!
        const contestant = { ratings, seals, surge }
        expect(built.seals, label).toEqual(seals)
        expect(built.zoneSynergies, label).toEqual(computeZoneSynergies(contestant))
        expect(built.bestZoneId, label).toBe(bestZoneId(contestant))
        expect(built.zoneSynergies[built.bestZoneId].synergy, label).toBe(
          Math.max(...built.zoneSynergies.map(z => z.synergy))
        )
        // Leaving any ingredient out gives different zones.
        expect(built.zoneSynergies, label).not.toEqual(
          computeZoneSynergies({ ratings, seals, surge: null })
        )
        expect(built.zoneSynergies, label).not.toEqual(
          computeZoneSynergies({ ratings, seals: [], surge })
        )
        expect(built.zoneSynergies, label).not.toEqual(
          computeZoneSynergies({ ratings: RATINGS, seals, surge })
        )
        best.add(built.bestZoneId)
      }
      expect(best.size).toBeGreaterThan(1) // not one zone for every build
    })

    it('drops the surge’s lift, and only the surge’s, from the zones when the sky is gone', () => {
      const seals = [
        buildCanonicalSeal('power', 'Copper'),
        buildCanonicalSeal('intuition', 'Astral'),
        buildCanonicalSeal('vitality', 'Copper'),
      ]
      expect(calm.zoneSynergies).toEqual(
        computeZoneSynergies({ ratings: RATINGS, seals, surge: null })
      )
      expect(calm.bestZoneId).toBe(bestZoneId({ ratings: RATINGS, seals, surge: null }))
      expect(calm.seals).toEqual(seals)
    })
  })

  describe('degraded reads', () => {
    it('has no degraded key when the sky and the holdings were both read cleanly', () => {
      expect(Object.hasOwn(payload, 'degraded')).toBe(false)
      expect('degraded' in JSON.parse(JSON.stringify(payload))).toBe(false)
      const ignored = build(neutralHot, { skyError: 'ignored' })
      expect(Object.hasOwn(ignored, 'degraded')).toBe(false)
    })

    it('reports an unreadable ledger as degraded.esms alone, with the resolver’s own words', () => {
      const built = build(neutralHot, {
        balances: resolved({
          esmsSource: 'fallback',
          degraded: { reason: 'owner wallet is private' },
        }),
      })
      expect(built.degraded).toStrictEqual({ esms: 'owner wallet is private' })
      expect(built.esmsSource).toBe('fallback')
      expect(built.surge).not.toBeNull()
    })

    it('reports a missing sky as degraded.sky alone, with a default or the caller’s reason', () => {
      expect(calm.degraded).toStrictEqual({ sky: 'live sky unavailable' })
      expect(calm.surge).toBeNull()
      expect(calm.sky).toBeNull()
      const explained = build(null, { skyError: 'The sky is incomplete (Pluto)' })
      expect(explained.degraded).toStrictEqual({ sky: 'The sky is incomplete (Pluto)' })
    })

    it('reports both when both reads were degraded, and leaves the rest of the payload alone', () => {
      const both = build(null, {
        balances: resolved({ esmsSource: 'fallback', degraded: { reason: 'no ledger row' } }),
        skyError: 'sky offline',
      })
      expect(both.degraded).toStrictEqual({ esms: 'no ledger row', sky: 'sky offline' })
      expect(both.ovr).toBe(payload.ovr)
      expect(both.ratings).toEqual(payload.ratings)
      expect(both.archetype).toEqual(payload.archetype)
      expect(both.appearance).toEqual(look)
      expect(both.surge).toBeNull()
      expect(both.sky).toBeNull()
    })
  })

  describe('the payload’s keys', () => {
    /** The keys of the contract's `RatedAgentPayload` that a healthy rating always carries. */
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
    const EXTENSION_KEYS = [
      'scale',
      'sealProgress',
      'esmsSource',
      'zoneSynergies',
      'bestZoneId',
      'sky',
    ]

    it('has every key the contract’s own fixtures carry', () => {
      for (const fixture of FIXTURE_AGENTS) {
        expect(Object.keys(fixture), fixture.key).toEqual(expect.arrayContaining(CONTRACT_KEYS))
      }
    })

    it('is exactly the contract’s keys and the extensions for a healthy vessel without models', () => {
      expect(Object.keys(payload).sort()).toEqual([...CONTRACT_KEYS, ...EXTENSION_KEYS].sort())
    })

    it('adds degraded, and only degraded, for a degraded one; and the model URLs only when present', () => {
      expect(Object.keys(calm).sort()).toEqual(
        [...CONTRACT_KEYS, ...EXTENSION_KEYS, 'degraded'].sort()
      )
      const meshed = build(neutralHot, {
        vessel: { ...vessel, avatarModelUrl: '/m.glb', headMeshUrl: '/h.glb' },
      })
      expect(Object.keys(meshed).sort()).toEqual(
        [...CONTRACT_KEYS, ...EXTENSION_KEYS, 'avatarModelUrl', 'headMeshUrl'].sort()
      )
    })

    it('shapes the surge as the contract’s state plus how its meter was reached', () => {
      expect(Object.keys(payload.surge!).sort()).toEqual([
        'active',
        'harmonyOffset',
        'heat',
        'meter',
        'monica',
        'monicaState',
        'reactivity',
        'skyMeter',
        'statBoosts',
        'surgeType',
      ])
      for (const fixture of FIXTURE_AGENTS) {
        expect(Object.keys(payload.surge!), fixture.key).toEqual(
          expect.arrayContaining(Object.keys(fixture.surge))
        )
      }
    })

    it('shapes the Seals, the rating and the esms as the contract’s fixtures do', () => {
      for (const fixture of FIXTURE_AGENTS) {
        expect(Object.keys(payload.ratings).sort(), fixture.key).toEqual(
          Object.keys(fixture.ratings).sort()
        )
        expect(Object.keys(payload.relativeAdvantage).sort(), fixture.key).toEqual(
          Object.keys(fixture.relativeAdvantage).sort()
        )
        expect(Object.keys(payload.esms).sort(), fixture.key).toEqual(
          Object.keys(fixture.esms).sort()
        )
        expect(Object.keys(payload.archetype).sort(), fixture.key).toEqual(
          Object.keys(fixture.archetype).sort()
        )
        for (const seal of fixture.seals) {
          expect(Object.keys(payload.seals[0]).sort(), fixture.key).toEqual(
            Object.keys(seal).sort()
          )
        }
      }
    })

    it('names no tier but the contract’s, and none of the retired one', () => {
      const rich = build(neutralHot, { balances: resolved({ balances: RICH }) })
      const tiers = new Set<string>([
        ...rich.seals.map(s => s.tier),
        ...rich.sealProgress.flatMap(p => [p.tier, p.nextTier, p.maxTier]).filter(t => t !== null),
      ])
      expect(tiers.size).toBeGreaterThan(1)
      for (const tier of tiers) expect(SEAL_TIERS as readonly string[]).toContain(tier)
    })
  })
})

// ─── asContractPayload ───────────────────────────────────────────────────────

describe('asContractPayload', () => {
  const vessel = ratableFromRoster(newton)
  const at = (liveSky: LiveSky | null) =>
    buildRatedAgentPayload({ vessel, balances: balances(vessel.agentId), sky: liveSky })

  it('is null for a payload without a surge: the contract has no calm-looking stand-in', () => {
    expect(asContractPayload(at(null))).toBeNull()
  })

  it('is a payload with every key the contract’s fixtures carry, and the surge in it', () => {
    const payload = at(sky)
    const contract: RatedAgentPayload = asContractPayload(payload)!
    expect(contract).not.toBeNull()
    for (const fixture of FIXTURE_AGENTS) {
      for (const key of Object.keys(fixture).filter(k => k !== 'portraitUrl')) {
        expect(Object.hasOwn(contract, key), `${fixture.key}.${key}`).toBe(true)
      }
    }
    expect(contract.surge).toBe(payload.surge)
    expect(contract.key).toBe('isaac-newton')
    expect(contract.handle).toBe('Sir Isaac Newton')
    expect(contract.faction).toBe(6)
    expect(contract.factionName).toBe('Saturn')
    expect(contract.ratings).toEqual(payload.ratings)
    expect(contract.seals).toEqual(payload.seals)
    expect(contract.esms).toEqual(payload.esms)
    expect(contract.appearance).toEqual(payload.appearance)
    expect(contract.provenance).toBe('historical')
    expect(contract.isPlaceholder).toBe(false)
  })

  it('carries the whole payload, and the extensions ride along unchanged', () => {
    const payload = at(sky)
    const contract = asContractPayload(payload)!
    expect(contract).toEqual(payload)
    expect(contract).toHaveProperty('sealProgress', payload.sealProgress)
    expect(contract).toHaveProperty('zoneSynergies', payload.zoneSynergies)
  })
})

// ─── summarizeVessel ─────────────────────────────────────────────────────────

describe('summarizeVessel, field by field', () => {
  const vessel: RatableVessel = {
    agentId: 'row-vessel',
    name: 'Row Vessel',
    origin: 'forged',
    stats: {
      power: 80,
      resonance: 40,
      wisdom: 65,
      charisma: 55,
      intuition: 90,
      adaptability: 30,
      vitality: 70,
    },
    natalChart: null,
    faction: 5,
    isPlaceholder: false,
    provenance: 'user',
    appearance: resolveAgentAppearance('isaac-newton'),
  }

  it('is one light row of the vessel’s key, handle, faction, overall, archetype and three look fields', () => {
    const row = summarizeVessel(vessel)
    expect(row).toStrictEqual({
      key: 'row-vessel',
      handle: 'Row Vessel',
      faction: 5,
      factionName: 'Jupiter',
      ovr: 82,
      archetype: { title: 'Prescient Ingressor', primary: 'intuition', secondary: 'power' },
      era: 'enlightenment',
      crownStyle: 'newton-curls',
      signatureRelic: 'prism-octahedron',
    })
    const ratings = ratingsOf(vessel.stats)
    expect(row.ovr).toBe(computeOvr(ratings))
    expect(row.archetype).toEqual(resolveArchetype(computeRelativeAdvantage(ratings)))
  })

  it('takes the look from the vessel and the rating from its stats, not the other way round', () => {
    const other = resolveAgentAppearance('albert-einstein')
    const row = summarizeVessel({ ...vessel, appearance: other })
    expect(row.era).toBe('modern')
    expect(row.crownStyle).toBe(other.headSilhouette.crownStyle)
    expect(row.signatureRelic).toBe(other.signatureRelic)
    expect(row.ovr).toBe(82)
  })

  it('agrees with the full payload on the overall, the archetype and the faction', () => {
    for (const agent of HISTORICAL_AGENTS.slice(0, 20)) {
      const rosterVessel = ratableFromRoster(agent)
      const row = summarizeVessel(rosterVessel)
      const payload = buildRatedAgentPayload({
        vessel: rosterVessel,
        balances: balances(agent.id),
        sky: null,
      })
      expect(row.key, agent.id).toBe(payload.key)
      expect(row.handle, agent.id).toBe(payload.handle)
      expect(row.ovr, agent.id).toBe(payload.ovr)
      expect(row.archetype, agent.id).toEqual(payload.archetype)
      expect(row.faction, agent.id).toBe(payload.faction)
      expect(row.factionName, agent.id).toBe(payload.factionName)
    }
  })
})
