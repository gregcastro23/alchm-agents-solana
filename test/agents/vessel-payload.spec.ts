/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import type { CraftedAgent } from '@/lib/agent-types'
import { HISTORICAL_AGENTS, getHistoricalAgent } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import {
  CORE_STAT_KEYS,
  SKY_BODIES,
  VESSEL_ALIASES,
  VESSEL_RATING_SCALE,
  bestZoneId,
  calculateResonanceSurge,
  computeZoneSynergies,
  evaluateSeals,
  holdingsFromAlchemicalElements,
  buildRatedAgentPayload,
  appearanceFromSeed,
  deriveLiveSky,
  deriveVesselAppearance,
  getVesselAppearance,
  rateStats,
  ratableFromForgedRow,
  ratableFromRoster,
  resolveVesselAlias,
  summarizeVessel,
  type CoreStats,
  type ForgedAgentRow,
  type LiveSky,
  type RatableVessel,
  type SkyLongitudes,
} from '@/lib/agents/rating'
import { generateAccurateHoroscope } from '@/lib/monica/horoscope-generator'
import { deriveStatsFromChart, type Sacred7Stats } from '@/lib/sacred-7-stats'

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
const balances = (agentId: string) => ({
  agentId,
  balances: holdingsFromAlchemicalElements(
    getHistoricalAgent(agentId)?.consciousness.alchemicalElements
  ),
  esmsSource: 'fallback' as const,
})

describe('ratableFromRoster', () => {
  it('rates a roster agent from its derived Sacred 7 stats and natal chart', () => {
    const vessel = ratableFromRoster(newton)
    const stats = deriveSacredStats(newton)
    expect(vessel).toMatchObject({
      agentId: 'isaac-newton',
      name: 'Isaac Newton',
      origin: 'roster',
    })
    for (const key of CORE_STAT_KEYS) expect(vessel.stats[key]).toBe(stats[key])
    expect(vessel.natalChart).toBe(newton.consciousness.natalChart)
    expect(vessel.appearance.agentId).toBe('isaac-newton')
  })

  it('keeps an alias as the vessel id and uses the avatar’s hand-authored look', () => {
    const greg = getHistoricalAgent(VESSEL_ALIASES['user-avatar-neo'])!
    const vessel = ratableFromRoster(greg, 'user-avatar-neo')
    expect(vessel.agentId).toBe('user-avatar-neo')
    expect(vessel.name).toBe(greg.name)
    expect(vessel.appearance.era).toBe('astral')
    expect(vessel.stats).toEqual(ratableFromRoster(greg).stats)
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
    expect(payload.agentId).toBe('isaac-newton')
    expect(payload.scale.name).toBe('Pentacle Vessel Rating Scale')
    expect(payload.seals).toHaveLength(7)
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
    const poor = buildRatedAgentPayload({
      vessel,
      balances: { agentId: 'x', balances: { spirit: 0, essence: 0, matter: 0, substance: 0 }, esmsSource: 'database' },
      sky,
    }) // prettier-ignore
    const rich = buildRatedAgentPayload({
      vessel,
      balances: { agentId: 'x', balances: { spirit: 500, essence: 500, matter: 500, substance: 500 }, esmsSource: 'database' },
      sky,
    }) // prettier-ignore
    const rank = (tier: string | null) =>
      tier === null ? -1 : ['Copper', 'Silver', 'Gold', 'Aether', 'Celestial'].indexOf(tier)
    poor.seals.forEach((s, i) =>
      expect(rank(rich.seals[i].tier)).toBeGreaterThanOrEqual(rank(s.tier))
    )
    expect(poor.seals.every(s => s.tier === null)).toBe(true)
    expect(rich.seals.some(s => s.tier !== null)).toBe(true)
  })
})

describe('the whole roster', () => {
  const payloads = HISTORICAL_AGENTS.map(agent => {
    const vessel = ratableFromRoster(agent)
    return buildRatedAgentPayload({ vessel, balances: balances(vessel.agentId), sky })
  })

  it('builds a complete, finite payload for every historical agent', () => {
    expect(payloads).toHaveLength(HISTORICAL_AGENTS.length)
    expect(new Set(payloads.map(p => p.agentId)).size).toBe(payloads.length)
    for (const p of payloads) {
      expect(p.ovr, p.agentId).toBeGreaterThanOrEqual(25)
      expect(p.ovr, p.agentId).toBeLessThanOrEqual(99)
      expect(p.seals, p.agentId).toHaveLength(7)
      expect(
        p.zoneSynergies.every(z => Number.isFinite(z.synergy)),
        p.agentId
      ).toBe(true)
      expect(p.appearance.portraitSvgDataUri.startsWith('data:image/svg+xml'), p.agentId).toBe(true)
      expect(p.surge?.monicaState, p.agentId).toMatch(/^(absent|equilibrium|convergent|divergent)$/)
    }
  })

  it('shares one surge meter across the roster except for each natal chart’s harmony offset', () => {
    const skyMeters = new Set(payloads.map(p => p.surge!.skyMeter))
    expect(skyMeters.size).toBe(1)
    const offsets = payloads.map(p => p.surge!.harmonyOffset)
    expect(new Set(offsets).size).toBeGreaterThan(5) // not all one meter
    for (const offset of offsets) expect(Math.abs(offset)).toBeLessThanOrEqual(12)
  })

  it('does not hand any single Seal to a runaway share of the roster at the same balances', () => {
    const rich = HISTORICAL_AGENTS.map(agent => {
      const vessel = ratableFromRoster(agent)
      return buildRatedAgentPayload({
        vessel,
        balances: { agentId: vessel.agentId, balances: { spirit: 1000, essence: 1000, matter: 1000, substance: 1000 }, esmsSource: 'database' },
        sky,
      }) // prettier-ignore
    })
    const share = (id: string) =>
      rich.filter(p => p.seals.find(s => s.id === id)!.tier !== null).length / rich.length
    const shares = [
      'crucible-finisher',
      'astral-vision',
      'immovable-foundation',
      'harmonic-sovereign',
      'tidal-chorus',
      'quicksilver-pivot',
      'philosophers-stone',
    ].map(share)
    expect(Math.max(...shares) / Math.min(...shares)).toBeLessThan(1.5)
  })

  it('summarises a vessel in one light row', () => {
    const row = summarizeVessel(ratableFromRoster(newton))
    expect(row).toMatchObject({
      agentId: 'isaac-newton',
      era: 'enlightenment',
      crownStyle: 'newton-curls',
      signatureRelic: 'prism-octahedron',
    })
    expect(row.ovr).toBe(payloads.find(p => p.agentId === 'isaac-newton')!.ovr)
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

// ─── Vessel ids that name Object.prototype members; the pilots' own looks ────

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

  it.each(PROTOTYPE_IDS)('gives a forged vessel called %s a real, serialisable look', id => {
    const vessel = ratableFromForgedRow(persistedRow({ agentId: id }))!
    expect(vessel).not.toBeNull()
    expect(typeof vessel.appearance).toBe('object')
    expect(vessel.appearance).not.toBeNull()
    expect(Object.keys(vessel.appearance)).toEqual(
      expect.arrayContaining(['era', 'portraitSvgDataUri'])
    )
    expect(vessel.appearance.agentId).toBe(id)
    expect(vessel.appearance.era).toBe('astral')
    expect(vessel.appearance.portraitSvgDataUri.startsWith('data:image/svg+xml')).toBe(true)
    // …the look of an unregistered id seeded from it, with the relic of the vessel’s primary stat.
    expect(vessel.appearance).toEqual(appearanceFromSeed(id, 'charisma', 'astral'))
    const wire = JSON.parse(JSON.stringify(vessel))
    expect(wire.appearance).toEqual(vessel.appearance)
    expect(Object.keys(wire)).toContain('appearance')
  })

  it.each(PROTOTYPE_IDS)(
    'gives a roster agent served under the id %s the derived look, not a prototype member',
    id => {
      const vessel = ratableFromRoster(newton, id)
      expect(vessel.agentId).toBe(id)
      expect(typeof vessel.appearance).toBe('object')
      expect(vessel.appearance).toEqual(deriveVesselAppearance(newton))
      expect(vessel.appearance.era).toBe('enlightenment')
      expect(vessel.appearance.headSilhouette.crownStyle).not.toBe('newton-curls') // never the pilot
      expect(Object.keys(JSON.parse(JSON.stringify(vessel)))).toContain('appearance')
    }
  )

  it.each(PILOTS)(
    'keeps the hand-authored look of %s (crown %s) for the roster agent',
    (id, crown) => {
      const vessel = ratableFromRoster(getHistoricalAgent(id)!)
      expect(vessel.appearance.headSilhouette.crownStyle).toBe(crown)
      expect(vessel.appearance).toBe(getVesselAppearance(id))
    }
  )

  it.each(PILOTS)(
    'keeps the hand-authored look of %s (crown %s) for a forged row of that id',
    (id, crown) => {
      const vessel = ratableFromForgedRow(persistedRow({ agentId: id }))!
      expect(vessel.appearance.headSilhouette.crownStyle).toBe(crown)
      expect(vessel.appearance).toBe(getVesselAppearance(id))
    }
  )

  it('keeps the avatar’s hand-authored look under the alias, for the roster agent and for a forged row', () => {
    const greg = getHistoricalAgent('greg-castro-1991')!
    const aliased = ratableFromRoster(greg, 'user-avatar-neo')
    expect(aliased.appearance.headSilhouette.crownStyle).toBe('astral-helm')
    expect(aliased.appearance.signatureRelic).toBe('solar-astrolabe')
    expect(aliased.appearance).toBe(getVesselAppearance('user-avatar-neo'))
    // …while the same agent under its own id gets its own derived look.
    expect(ratableFromRoster(greg).appearance.headSilhouette.crownStyle).not.toBe('astral-helm')
    expect(ratableFromRoster(greg).appearance).toBe(getVesselAppearance('greg-castro-1991'))

    const forged = ratableFromForgedRow(persistedRow({ agentId: 'user-avatar-neo' }))!
    expect(forged.appearance.headSilhouette.crownStyle).toBe('astral-helm')
  })

  it('serves a roster agent that is not a pilot the registry’s look for its id', () => {
    const plain = HISTORICAL_AGENTS.find(a => !PILOTS.some(([id]) => id === a.id))!
    expect(ratableFromRoster(plain).appearance).toBe(getVesselAppearance(plain.id))
  })

  it('seeds an unregistered forged id from the id and the primary stat of its rating', () => {
    const vessel = ratableFromForgedRow(persistedRow({ agentId: 'agent-seeded-0007' }))!
    expect(getVesselAppearance('agent-seeded-0007')).toBeUndefined()
    // Persisted stats 60/70/65/72/68/55/61 have charisma the furthest above its league mean.
    expect(rateStats(vessel.stats).archetype.primary).toBe('charisma')
    expect(vessel.appearance).toEqual(appearanceFromSeed('agent-seeded-0007', 'charisma', 'astral'))
    expect(vessel.appearance.signatureRelic).not.toBe(
      appearanceFromSeed('agent-seeded-0007', 'resonance', 'astral').signatureRelic
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

// ─── The payload, value by value ─────────────────────────────────────────────

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
  const CHART = {
    planets: {
      Sun: { sign: 'Aries' },
      Moon: { sign: 'Leo' },
      Mercury: { sign: 'Gemini' },
      Venus: { sign: 'Taurus' },
      Mars: { sign: 'Sagittarius' },
      Jupiter: { sign: 'Cancer' },
      Saturn: { sign: 'Capricorn' },
      Uranus: { sign: 'Aquarius' },
      Neptune: { sign: 'Pisces' },
      Pluto: { sign: 'Scorpio' },
    },
  }
  const HOLDINGS = { spirit: 60, essence: 3, matter: 12, substance: 30 }
  const vessel: RatableVessel = {
    agentId: 'fixed-vessel',
    name: 'Fixed Vessel',
    origin: 'forged',
    stats: STATS,
    natalChart: CHART,
    appearance: appearanceFromSeed('fixed-vessel', 'intuition', 'modern'),
  }
  const resolved = (
    over: Partial<Parameters<typeof buildRatedAgentPayload>[0]['balances']> = {}
  ): Parameters<typeof buildRatedAgentPayload>[0]['balances'] => ({
    agentId: 'fixed-vessel',
    balances: HOLDINGS,
    esmsSource: 'database',
    ...over,
  })
  const surgeFor = (liveSky: LiveSky) =>
    calculateResonanceSurge({
      thermodynamics: liveSky.thermodynamics,
      monica: liveSky.monica,
      natalChart: CHART,
      sky: liveSky.bodies,
    })
  /** A sky hot enough for the meter to be full, with a Monica that is neither absent nor 1.618. */
  const hotSky: LiveSky = {
    ...sky,
    thermodynamics: { ...sky.thermodynamics, heat: 0.2, reactivity: 4 },
    monica: 2.5,
  }
  const payload = buildRatedAgentPayload({ vessel, balances: resolved(), sky })

  it('names the vessel and the scale it is rated on', () => {
    expect(payload.agentId).toBe('fixed-vessel')
    expect(payload.name).toBe('Fixed Vessel')
    expect(payload.scale).toEqual(VESSEL_RATING_SCALE)
    expect(payload.scale).toEqual({ name: 'Pentacle Vessel Rating Scale', floor: 25, ceiling: 99 })
  })

  it('serves the rating of the vessel’s stats, field for field', () => {
    const rating = rateStats(STATS)
    expect(payload.ovr).toBe(rating.ovr)
    expect(payload.ratings).toEqual(rating.ratings)
    expect(payload.spread).toBe(rating.spread)
    expect(payload.relativeAdvantage).toEqual(rating.relativeAdvantage)
    expect(payload.archetype).toEqual(rating.archetype)
  })

  it('pins the numbers for one fixed vessel, worked out on paper', () => {
    // rating = round(25 + 0.74·stat); OVR weights the best two ratings 1.6 and 1.3.
    expect(payload.ratings).toEqual({
      power: 84,
      resonance: 55,
      wisdom: 73,
      charisma: 66,
      intuition: 92,
      adaptability: 47,
      vitality: 77,
    })
    expect(payload.ovr).toBe(73) // (92·1.6 + 84·1.3 + 77 + 73 + 66 + 55 + 47) / 7.9 = 72.7
    expect(payload.spread).toBe(45) // 92 − 47
    expect(payload.relativeAdvantage.intuition).toBe(2.64) // (90 − 70.2) / 7.5
    expect(payload.relativeAdvantage.power).toBe(0.4) // (80 − 76.5) / 8.8
    expect(payload.archetype).toEqual({
      kind: 'specialist',
      primary: 'intuition',
      secondary: 'vitality',
      title: 'Verdant Seer',
    })
  })

  it('passes the resolved holdings and their source through untouched', () => {
    expect(payload.esmsBalances).toEqual(HOLDINGS)
    expect(payload.esmsSource).toBe('database')
    for (const esmsSource of ['spacetimedb', 'database', 'fallback'] as const) {
      const again = buildRatedAgentPayload({ vessel, balances: resolved({ esmsSource }), sky })
      expect(again.esmsSource).toBe(esmsSource)
    }
  })

  it('serves the Seals evaluateSeals gives these stats, holdings and chart, maxTier included', () => {
    const expected = evaluateSeals({ stats: STATS, esmsBalances: HOLDINGS, natalChart: CHART })
    expect(payload.seals).toEqual(expected)
    expect(payload.seals.map(s => s.maxTier)).toEqual([
      'Aether', // Crucible Finisher: a perfect power aligns to 93.5, short of Celestial’s 96
      'Celestial',
      'Celestial',
      'Celestial',
      'Celestial',
      'Celestial',
      'Celestial',
    ])
    // The chart reaches the Seals: with none, no Seal reports a natal affinity.
    const chartless = buildRatedAgentPayload({
      vessel: { ...vessel, natalChart: null },
      balances: resolved(),
      sky,
    })
    expect(payload.seals.every(s => s.natalAffinity !== null)).toBe(true)
    expect(chartless.seals.every(s => s.natalAffinity === null)).toBe(true)
  })

  it('pins a handful of Seal figures for the fixed vessel', () => {
    const seal = (id: string) => payload.seals.find(s => s.id === id)!
    // intuition 90 → rating 92 → aligned 92 − 76.948 + 76.113 = 91.16: clears Aether with 60 spirit.
    expect(seal('astral-vision')).toMatchObject({
      tier: 'Aether',
      nextTier: 'Celestial',
      blockedBy: ['stat', 'esms', 'natal'],
      maxTier: 'Celestial',
      statRating: 92,
      alignedRating: 91.16,
      balance: 60,
      natalAffinity: 3,
    })
    // power 80 → rating 84 → aligned 78.5: Copper with 30 substance; Silver needs 80.
    expect(seal('crucible-finisher')).toMatchObject({
      tier: 'Copper',
      nextTier: 'Silver',
      blockedBy: ['stat'],
      maxTier: 'Aether',
      statRating: 84,
      alignedRating: 78.5,
      balance: 30,
    })
    expect(seal('tidal-chorus').tier).toBeNull()
  })

  it('stops advertising a tier above what a Seal’s stat can reach', () => {
    const peak = buildRatedAgentPayload({
      vessel: { ...vessel, stats: { ...STATS, power: 100 } },
      balances: resolved({ balances: { spirit: 0, essence: 0, matter: 0, substance: 1000 } }),
      sky,
    })
    const crucible = peak.seals.find(s => s.id === 'crucible-finisher')!
    expect(crucible).toMatchObject({
      tier: 'Aether',
      nextTier: null,
      blockedBy: [],
      maxTier: 'Aether',
    })
  })

  it('reads the surge from the live sky, the vessel’s chart against it, and the sky’s Monica', () => {
    expect(payload.surge).toEqual(surgeFor(sky))
    expect(payload.surge!.harmonyOffset).toBe(2.4) // mean elemental relation 0.2 of ±12

    const hot = buildRatedAgentPayload({ vessel, balances: resolved(), sky: hotSky })
    expect(hot.surge).toEqual(surgeFor(hotSky))
    expect(hot.surge).toMatchObject({
      active: true,
      meter: 100,
      monicaState: 'convergent',
      statBoosts: { resonance: 10, charisma: 10 },
    })

    const absentMonica = buildRatedAgentPayload({
      vessel,
      balances: resolved(),
      sky: { ...hotSky, monica: null },
    })
    expect(absentMonica.surge!.monicaState).toBe('absent')
    expect(absentMonica.sky!.monica).toBeNull()
  })

  it('echoes the sky the surge was read from, field for field', () => {
    expect(payload.sky).toStrictEqual({
      source: 'swiss-ephemeris',
      at: '2026-10-15T05:43:00.000Z',
      heat: sky.thermodynamics.heat,
      reactivity: sky.thermodynamics.reactivity,
      monica: sky.monica,
    })
    expect(sky.thermodynamics.heat).not.toBe(sky.thermodynamics.reactivity)

    const hot = buildRatedAgentPayload({ vessel, balances: resolved(), sky: hotSky })
    expect(hot.sky).toStrictEqual({
      source: 'swiss-ephemeris',
      at: '2026-10-15T05:43:00.000Z',
      heat: 0.2,
      reactivity: 4,
      monica: 2.5,
    })
    const approximated = buildRatedAgentPayload({
      vessel,
      balances: resolved(),
      sky: { ...sky, source: 'vsop87-approximation' },
    })
    expect(approximated.sky!.source).toBe('vsop87-approximation')
  })

  it('scores every zone with the Seals, the stats and the surge together', () => {
    const vessels: [string, CoreStats][] = [
      [
        'power-led',
        {
          power: 95,
          resonance: 40,
          wisdom: 40,
          charisma: 40,
          intuition: 40,
          adaptability: 40,
          vitality: 85,
        },
      ],
      [
        'intuition-led',
        {
          power: 40,
          resonance: 40,
          wisdom: 85,
          charisma: 40,
          intuition: 95,
          adaptability: 40,
          vitality: 40,
        },
      ],
      [
        'adaptability-led',
        {
          power: 40,
          resonance: 40,
          wisdom: 60,
          charisma: 40,
          intuition: 70,
          adaptability: 95,
          vitality: 40,
        },
      ],
    ]
    const best = new Set<number>()
    for (const [label, stats] of vessels) {
      const rich = { spirit: 300, essence: 300, matter: 300, substance: 300 }
      const built = buildRatedAgentPayload({
        vessel: { ...vessel, stats },
        balances: resolved({ balances: rich }),
        sky: hotSky,
      })
      const seals = evaluateSeals({ stats, esmsBalances: rich, natalChart: CHART })
      const surge = surgeFor(hotSky)
      const contestant = { stats, seals, surge }

      expect(built.zoneSynergies, label).toEqual(computeZoneSynergies(contestant))
      expect(built.bestZoneId, label).toBe(bestZoneId(contestant))
      expect(built.zoneSynergies[built.bestZoneId].synergy, label).toBe(
        Math.max(...built.zoneSynergies.map(z => z.synergy))
      )
      // Each ingredient matters: leaving any one out gives different zones.
      expect(built.zoneSynergies, label).not.toEqual(
        computeZoneSynergies({ stats, seals, surge: null })
      )
      expect(built.zoneSynergies, label).not.toEqual(
        computeZoneSynergies({ stats, seals: [], surge })
      )
      expect(built.zoneSynergies, label).not.toEqual(
        computeZoneSynergies({ stats: vessel.stats, seals, surge })
      )
      best.add(built.bestZoneId)
    }
    expect(best.size).toBeGreaterThan(1) // not one zone for every build
  })

  it('has no degraded key when the sky and the holdings were both read cleanly', () => {
    expect(Object.hasOwn(payload, 'degraded')).toBe(false)
    expect('degraded' in JSON.parse(JSON.stringify(payload))).toBe(false)
    const ignored = buildRatedAgentPayload({
      vessel,
      balances: resolved(),
      sky,
      skyError: 'ignored',
    })
    expect(Object.hasOwn(ignored, 'degraded')).toBe(false)
  })

  it('reports an unreadable ledger as degraded.esms alone, with the resolver’s own words', () => {
    const built = buildRatedAgentPayload({
      vessel,
      balances: resolved({
        esmsSource: 'fallback',
        degraded: { reason: 'owner wallet is private' },
      }),
      sky,
    })
    expect(built.degraded).toStrictEqual({ esms: 'owner wallet is private' })
    expect(built.esmsSource).toBe('fallback')
    expect(built.surge).not.toBeNull()
  })

  it('reports a missing sky as degraded.sky alone, with a default or the caller’s reason', () => {
    const plain = buildRatedAgentPayload({ vessel, balances: resolved(), sky: null })
    expect(plain.degraded).toStrictEqual({ sky: 'live sky unavailable' })
    expect(plain.surge).toBeNull()
    expect(plain.sky).toBeNull()

    const explained = buildRatedAgentPayload({
      vessel,
      balances: resolved(),
      sky: null,
      skyError: 'The sky is incomplete (Pluto)',
    })
    expect(explained.degraded).toStrictEqual({ sky: 'The sky is incomplete (Pluto)' })
  })

  it('reports both when both reads were degraded', () => {
    const both = buildRatedAgentPayload({
      vessel,
      balances: resolved({ esmsSource: 'fallback', degraded: { reason: 'no ledger row' } }),
      sky: null,
      skyError: 'sky offline',
    })
    expect(both.degraded).toStrictEqual({ esms: 'no ledger row', sky: 'sky offline' })
    // Everything not read from the sky or the ledger is unchanged by either failure.
    expect(both.ovr).toBe(payload.ovr)
    expect(both.ratings).toEqual(payload.ratings)
    expect(both.archetype).toEqual(payload.archetype)
    expect(both.appearance).toBe(vessel.appearance)
  })

  it('drops the surge’s lift, and only the surge’s, from the zones when the sky is gone', () => {
    const calm = buildRatedAgentPayload({ vessel, balances: resolved(), sky: null })
    const seals = evaluateSeals({ stats: STATS, esmsBalances: HOLDINGS, natalChart: CHART })
    expect(calm.zoneSynergies).toEqual(computeZoneSynergies({ stats: STATS, seals, surge: null }))
    expect(calm.bestZoneId).toBe(bestZoneId({ stats: STATS, seals, surge: null }))
    expect(calm.seals).toEqual(seals)
  })

  it('serves the vessel’s own look', () => {
    expect(payload.appearance).toBe(vessel.appearance)
  })
})

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
    appearance: getVesselAppearance('isaac-newton')!,
  }

  it('is one light row of the vessel’s id, name, overall, archetype and three look fields', () => {
    const row = summarizeVessel(vessel)
    expect(row).toStrictEqual({
      agentId: 'row-vessel',
      name: 'Row Vessel',
      ovr: 73,
      archetype: {
        kind: 'specialist',
        primary: 'intuition',
        secondary: 'vitality',
        title: 'Verdant Seer',
      },
      era: 'enlightenment',
      crownStyle: 'newton-curls',
      signatureRelic: 'prism-octahedron',
    })
    expect(row.ovr).toBe(rateStats(vessel.stats).ovr)
    expect(row.archetype).toEqual(rateStats(vessel.stats).archetype)
  })

  it('takes the look from the vessel and the rating from its stats, not the other way round', () => {
    const other = appearanceFromSeed('another-vessel', 'power', 'romantic')
    const row = summarizeVessel({ ...vessel, appearance: other })
    expect(row.era).toBe('romantic')
    expect(row.crownStyle).toBe(other.headSilhouette.crownStyle)
    expect(row.signatureRelic).toBe(other.signatureRelic)
    expect(row.ovr).toBe(73)
  })
})
