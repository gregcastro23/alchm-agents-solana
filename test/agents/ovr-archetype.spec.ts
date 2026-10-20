/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import * as ovrArchetypeModule from '@/lib/agents/rating/ovr-archetype'
import {
  CORE_STAT_KEYS,
  RATING_CEILING,
  RATING_FLOOR,
  VESSEL_RATING_SCALE,
  rateAgent,
  rateStats,
  toRating,
  type CoreStatKey,
  type CoreStats,
} from '@/lib/agents/rating/ovr-archetype'
import { SACRED_STAT_KEYS, clampStat } from '@/lib/agents/rating-contract'

/**
 * `ovr-archetype.ts` is a thin adapter over the Pentacles rating contract
 * (`lib/agents/rating-contract.ts`, #65): it maps a 0-100 stat onto the contract's 25-99 rating
 * scale and then calls the contract's `computeOvr`, `computeRelativeAdvantage` and
 * `resolveArchetype`.
 *
 * So this spec does not copy the contract's code. It pins the contract's numbers as literals
 * (baselines, title table) and checks the adapter against small oracles written here:
 *
 *   rating  = round-half-up(25 + 0.74 * stat), clamped to 25..99     (exact integer arithmetic)
 *   OVR     = round((16*top1 + 13*top2 + 2*sum(other five)) / 39)    (= the contract's 1.6 / 1.3 /
 *             mean-of-rest formula divided by 3.9, with numerator and denominator times ten)
 *   advantage = rating - baseline
 *   archetype = top two advantages, ties broken by stat order, looked up in the title table
 */

// --- the contract's pinned numbers and wording, as literals -----------------------------------

const STAT_ORDER: readonly CoreStatKey[] = [
  'power',
  'resonance',
  'wisdom',
  'charisma',
  'intuition',
  'adaptability',
  'vitality',
]

/** `ROSTER_BASELINE_RATINGS[k].baseline` from the contract. */
const BASELINE: Record<CoreStatKey, number> = {
  power: 63,
  resonance: 62,
  wisdom: 64,
  charisma: 61,
  intuition: 62,
  adaptability: 63,
  vitality: 62,
}

/** `ARCHETYPE_TITLE_MATRIX` from the contract's source text, keyed `primary:secondary`. */
const TITLE: Record<string, string> = {
  'power:vitality': 'Juggernaut Anchor',
  'power:resonance': 'Kinetic Resonator',
  'power:wisdom': 'Celestial Mechanist',
  'power:charisma': 'Dominant Commander',
  'power:intuition': 'Instinctive Striker',
  'power:adaptability': 'Dynamic Breaker',

  'resonance:intuition': 'Harmonic Seer',
  'resonance:wisdom': 'Synthesizing Sage',
  'resonance:power': 'Astral Striker',
  'resonance:charisma': 'Symphonic Virtuoso',
  'resonance:adaptability': 'Fluid Harmonizer',
  'resonance:vitality': 'Resilient Prism',

  'wisdom:power': 'Celestial Mechanist',
  'wisdom:adaptability': 'Polymath Craftsman',
  'wisdom:resonance': 'Universal Theorist',
  'wisdom:intuition': 'Illuminated Sage',
  'wisdom:charisma': 'Enlightened Statesman',
  'wisdom:vitality': 'Ancient Pillar',

  'charisma:power': 'Apex Sovereign',
  'charisma:wisdom': 'Inspiring Luminary',
  'charisma:intuition': 'Magnetic Visionary',
  'charisma:resonance': 'Resonant Herald',
  'charisma:adaptability': 'Charismatic Catalyst',
  'charisma:vitality': 'Indomitable Leader',

  'intuition:resonance': 'Reclusive Visionary',
  'intuition:wisdom': 'Mystic Oracle',
  'intuition:power': 'Prescient Ingressor',
  'intuition:charisma': 'Prophetic Guide',
  'intuition:adaptability': 'Intuitive Shifter',
  'intuition:vitality': 'Eternal Vigilant',

  'adaptability:wisdom': 'Polymath Craftsman',
  'adaptability:intuition': 'Quicksilver Weaver',
  'adaptability:power': 'Tactical Marauder',
  'adaptability:resonance': 'Harmonic Pivot',
  'adaptability:charisma': 'Diplomatic Emissary',
  'adaptability:vitality': 'Unshakable Survivor',

  'vitality:power': 'Ironbound Guardian',
  'vitality:wisdom': 'Enduring Sentinel',
  'vitality:resonance': 'Stalwart Conduit',
  'vitality:intuition': 'Steadfast Bastion',
  'vitality:charisma': 'Tenacious Champion',
  'vitality:adaptability': 'Adaptive Fortress',
}

const ORDERED_PAIRS: Array<[CoreStatKey, CoreStatKey]> = STAT_ORDER.flatMap(p =>
  STAT_ORDER.filter(s => s !== p).map((s): [CoreStatKey, CoreStatKey] => [p, s])
)

// --- oracles and helpers ----------------------------------------------------------------------

/** Deterministic PRNG (mulberry32); every test makes its own so order never matters. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Rating of a stat given in thousandths (stat = milli / 1000), in exact integer arithmetic:
 * floor(25 + 74 * milli / 100000 + 1/2). The only exact .5 points on the 0-100 axis are stats
 * 25 (43.5) and 75 (80.5), both exactly representable, and every other stat on this grid sits at
 * least 2e-5 away from a rounding boundary, far beyond floating-point noise.
 */
function oracleRating(milli: number): number {
  return Math.min(99, Math.max(25, Math.floor((2550000 + 74 * milli) / 100000)))
}

/**
 * OWA OVR in exact integer arithmetic. No exact .5 can occur: the quotient is n / 39, and
 * n / 39 = m + 1/2 would need 2n = 39 * (2m + 1), an even number equal to an odd one.
 */
function oracleOvrExact(values: number[]): number {
  const [top1, top2, ...rest] = [...values].sort((a, b) => b - a)
  const restSum = rest.reduce((sum, v) => sum + v, 0)
  return Math.min(99, Math.max(25, Math.round((16 * top1 + 13 * top2 + 2 * restSum) / 39)))
}

/** The same OVR written the way the contract describes it. */
function oracleOvrDecimal(values: number[]): number {
  const [top1, top2, ...rest] = [...values].sort((a, b) => b - a)
  const restMean = rest.reduce((sum, v) => sum + v, 0) / rest.length
  return Math.min(99, Math.max(25, Math.round((top1 * 1.6 + top2 * 1.3 + restMean * 1.0) / 3.9)))
}

interface Archetype {
  title: string
  primary: CoreStatKey
  secondary: CoreStatKey
}

/** Top two advantages over the baselines, ties by stat order, then the literal title table. */
function oracleArchetype(ratings: Record<CoreStatKey, number>): Archetype {
  const ranked = STAT_ORDER.map((key, index) => ({
    key,
    index,
    advantage: ratings[key] - BASELINE[key],
  })).sort((a, b) => b.advantage - a.advantage || a.index - b.index)
  const primary = ranked[0].key
  const secondary = ranked[1].key
  return { title: TITLE[`${primary}:${secondary}`], primary, secondary }
}

/** A stat that rates as exactly `rating` (the rating scale is 0.74 rating points per stat point). */
function statFor(rating: number): number {
  return (rating - 25) / 0.74
}

function statsForRatings(ratings: Record<CoreStatKey, number>): CoreStats {
  const out = {} as Record<CoreStatKey, number>
  for (const key of STAT_ORDER) out[key] = statFor(ratings[key])
  return out
}

function flat(value: number, overrides: Partial<CoreStats> = {}): CoreStats {
  return {
    power: value,
    resonance: value,
    wisdom: value,
    charisma: value,
    intuition: value,
    adaptability: value,
    vitality: value,
    ...overrides,
  }
}

/** Ratings object with every stat at `value` except the overrides. */
function flatRatings(
  value: number,
  overrides: Partial<Record<CoreStatKey, number>> = {}
): Record<CoreStatKey, number> {
  return { ...flat(value), ...overrides } as Record<CoreStatKey, number>
}

interface Sample {
  /** The stats handed to the module (thousandths / 1000). */
  stats: CoreStats
  /** Oracle ratings for those stats. */
  ratings: Record<CoreStatKey, number>
}

/** Seeded stat vectors on the 0.001 grid; a third of them are drawn from five values to force ties. */
function sampleVectors(rand: () => number, count: number): Sample[] {
  const tieValues = [0, 25000, 50000, 75000, 100000]
  const out: Sample[] = []
  for (let i = 0; i < count; i++) {
    const tied = i % 3 === 0
    const stats = {} as Record<CoreStatKey, number>
    const ratings = {} as Record<CoreStatKey, number>
    for (const key of STAT_ORDER) {
      const milli = tied
        ? tieValues[Math.floor(rand() * tieValues.length)]
        : i % 3 === 1
          ? Math.round(rand() * 100) * 1000
          : Math.floor(rand() * 100001)
      stats[key] = milli / 1000
      ratings[key] = oracleRating(milli)
    }
    out.push({ stats, ratings })
  }
  return out
}

function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// --- tests ------------------------------------------------------------------------------------

describe('constants and public surface', () => {
  it('lists the seven core stats in the contract order', () => {
    expect([...CORE_STAT_KEYS]).toEqual([
      'power',
      'resonance',
      'wisdom',
      'charisma',
      'intuition',
      'adaptability',
      'vitality',
    ])
    expect([...CORE_STAT_KEYS]).toEqual([...SACRED_STAT_KEYS])
  })

  it('pins the rating scale at 25..99 and names it', () => {
    expect(RATING_FLOOR).toBe(25)
    expect(RATING_CEILING).toBe(99)
    expect(VESSEL_RATING_SCALE).toEqual({
      name: 'Pentacle Vessel Rating Scale',
      floor: 25,
      ceiling: 99,
    })
  })

  it('uses the same bounds as the contract clamp', () => {
    expect(clampStat(-1e9)).toBe(RATING_FLOOR)
    expect(clampStat(1e9)).toBe(RATING_CEILING)
    expect(VESSEL_RATING_SCALE.floor).toBe(clampStat(-1e9))
    expect(VESSEL_RATING_SCALE.ceiling).toBe(clampStat(1e9))
  })

  it('no longer exports the pre-contract rating machinery', () => {
    const exported = Object.keys(ovrArchetypeModule)
    for (const retired of [
      'STAT_BASELINES',
      'OVR_RANK_WEIGHTS',
      'archetypeTitle',
      'BALANCED_SPREAD',
      'BALANCED_TITLE',
      'components',
    ]) {
      expect(exported, retired).not.toContain(retired)
    }
    for (const kept of [
      'CORE_STAT_KEYS',
      'RATING_FLOOR',
      'RATING_CEILING',
      'VESSEL_RATING_SCALE',
      'toRating',
      'rateStats',
      'rateAgent',
    ]) {
      expect(exported, kept).toContain(kept)
    }
  })
})

describe('toRating', () => {
  it('maps 0 to the floor, 50 to 62 and 100 to the ceiling', () => {
    expect(toRating(0)).toBe(25)
    expect(toRating(50)).toBe(62)
    expect(toRating(100)).toBe(99)
  })

  it.each([
    [1, 26],
    [2, 26],
    [3, 27],
    [10, 32],
    [20, 40],
    [40, 55],
    [60, 69],
    [80, 84],
    [90, 92],
    [99, 98],
  ])('rates stat %s as %s (25 + 0.74 * stat, rounded)', (stat, rating) => {
    expect(toRating(stat)).toBe(rating)
  })

  it('matches exact integer arithmetic for every whole stat 0..100', () => {
    for (let stat = 0; stat <= 100; stat++) {
      expect(toRating(stat), `stat ${stat}`).toBe(oracleRating(stat * 1000))
    }
  })

  it('rounds an exact .5 up, at both places the scale lands on one', () => {
    // 25 + 0.74 * 25 = 43.5 and 25 + 0.74 * 75 = 80.5, both exact in binary.
    expect(toRating(25)).toBe(44)
    expect(toRating(75)).toBe(81)
  })

  it('rounds either side of a .5 to the nearest integer', () => {
    expect(toRating(24.99)).toBe(43)
    expect(toRating(25.01)).toBe(44)
    expect(toRating(74.99)).toBe(80)
    expect(toRating(75.01)).toBe(81)
    expect(toRating(0.67)).toBe(25) // 25.4958
    expect(toRating(0.68)).toBe(26) // 25.5032
  })

  it('returns an integer on the 25..99 scale for fractional stats, and never decreases', () => {
    const rand = seeded(0x5ca1ab1e)
    const stats = Array.from({ length: 2000 }, () => rand() * 100).sort((a, b) => a - b)
    let previous = -Infinity
    for (const stat of stats) {
      const rating = toRating(stat)
      expect(Number.isInteger(rating), `stat ${stat}`).toBe(true)
      expect(rating).toBeGreaterThanOrEqual(25)
      expect(rating).toBeLessThanOrEqual(99)
      expect(rating, `stat ${stat}`).toBeGreaterThanOrEqual(previous)
      previous = rating
    }
  })

  it('agrees with the exact oracle on a seeded 0.001 grid', () => {
    const rand = seeded(0xfeed1234)
    for (let i = 0; i < 5000; i++) {
      const milli = Math.floor(rand() * 100001)
      expect(toRating(milli / 1000), `stat ${milli / 1000}`).toBe(oracleRating(milli))
    }
  })

  it('clamps finite out-of-range input instead of throwing', () => {
    expect(toRating(-0.01)).toBe(25)
    expect(toRating(-40)).toBe(25)
    expect(toRating(-1e9)).toBe(25)
    expect(toRating(-Number.MAX_VALUE)).toBe(25)
    expect(toRating(100.01)).toBe(99)
    expect(toRating(101)).toBe(99)
    expect(toRating(250)).toBe(99)
    expect(toRating(1e9)).toBe(99)
    expect(toRating(Number.MAX_VALUE)).toBe(99)
  })

  it('rates a very small positive stat and negative zero as the floor', () => {
    expect(toRating(Number.MIN_VALUE)).toBe(25)
    expect(toRating(-0)).toBe(25)
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('throws a RangeError for %s rather than rating it as the floor', (text, value) => {
    expect(() => toRating(value)).toThrow(RangeError)
    expect(() => toRating(value)).toThrow(new RegExp(text))
  })

  it('names the stat in the error, defaulting to "stat"', () => {
    expect(() => toRating(Number.NaN, 'power')).toThrow(/power/)
    expect(() => toRating(Number.POSITIVE_INFINITY, 'vitality')).toThrow(/vitality/)
    expect(() => toRating(Number.NaN)).toThrow(/stat/)
    expect(() => toRating(Number.NaN, 'power')).not.toThrow(/vitality/)
  })

  it('can produce every rating from 25 to 99 (the scale has no gaps)', () => {
    for (let rating = 25; rating <= 99; rating++) {
      expect(toRating(statFor(rating)), `rating ${rating}`).toBe(rating)
    }
  })
})

describe('rateStats: shape', () => {
  it('returns exactly ratings, ovr, relativeAdvantage and archetype', () => {
    const result = rateStats(flat(50))
    expect(Object.keys(result).sort()).toEqual(['archetype', 'ovr', 'ratings', 'relativeAdvantage'])
    expect(Object.keys(result.ratings)).toEqual([...STAT_ORDER])
    expect(Object.keys(result.relativeAdvantage)).toEqual([...STAT_ORDER])
    expect(Object.keys(result.archetype).sort()).toEqual(['primary', 'secondary', 'title'])
  })

  it('does not carry the pre-contract spread, kind or z-score fields', () => {
    const result = rateStats(flat(50)) as unknown as Record<string, unknown>
    expect(result).not.toHaveProperty('spread')
    expect(result).not.toHaveProperty('components')
    expect(result.archetype).not.toHaveProperty('kind')
  })

  it('ignores stats beyond the seven core ones', () => {
    const richer = { ...flat(60), solarAgency: 99, lunarReceptivity: 3, notAStat: Number.NaN }
    expect(rateStats(richer)).toEqual(rateStats(flat(60)))
  })

  it('does not depend on the key order of its input', () => {
    const rand = seeded(0x0ddba11)
    for (const { stats } of sampleVectors(rand, 60)) {
      const reversed = Object.fromEntries(Object.entries(stats).reverse()) as CoreStats
      expect(rateStats(reversed)).toEqual(rateStats(stats))
    }
  })

  it('does not mutate its input and returns fresh objects every call', () => {
    const input = Object.freeze(flat(55, { power: 91.5 }))
    const before = JSON.stringify(input)
    const first = rateStats(input)
    const second = rateStats(input)
    expect(JSON.stringify(input)).toBe(before)
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second.ratings).not.toBe(first.ratings)
    expect(second.archetype).not.toBe(first.archetype)
    first.ratings.power = 1
    first.archetype.title = 'tampered'
    expect(rateStats(input)).toEqual(second)
  })

  it.each([...STAT_ORDER])('refuses a non-finite %s, naming it', key => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => rateStats(flat(50, { [key]: bad }))).toThrow(RangeError)
      expect(() => rateStats(flat(50, { [key]: bad }))).toThrow(new RegExp(key))
    }
  })

  it.each([...STAT_ORDER])('refuses a missing %s rather than rating it as the floor', key => {
    const partial: Partial<CoreStats> = flat(50)
    delete partial[key]
    expect(() => rateStats(partial as CoreStats)).toThrow(RangeError)
    expect(() => rateStats(partial as CoreStats)).toThrow(new RegExp(key))
  })

  it('clamps finite out-of-range stats onto the 25..99 scale', () => {
    const result = rateStats(flat(50, { power: 500, resonance: -5, wisdom: 100.5, charisma: -0.1 }))
    expect(result.ratings).toEqual({
      power: 99,
      resonance: 25,
      wisdom: 99,
      charisma: 25,
      intuition: 62,
      adaptability: 62,
      vitality: 62,
    })
  })
})

describe('rateStats: literal vectors', () => {
  it('rates a flat 50 build: every rating 62, OVR 62, advantages are the negated baselines', () => {
    const result = rateStats(flat(50))
    expect(result.ratings).toEqual(flatRatings(62))
    expect(result.ovr).toBe(62)
    // 62 minus the baselines 63, 62, 64, 61, 62, 63, 62.
    expect(result.relativeAdvantage).toEqual({
      power: -1,
      resonance: 0,
      wisdom: -2,
      charisma: 1,
      intuition: 0,
      adaptability: -1,
      vitality: 0,
    })
    // charisma leads (+1); resonance, intuition and vitality tie at 0, so stat order picks resonance.
    expect(result.archetype).toEqual({
      title: 'Resonant Herald',
      primary: 'charisma',
      secondary: 'resonance',
    })
  })

  it('rates all zeros as the floor everywhere', () => {
    const result = rateStats(flat(0))
    expect(result.ratings).toEqual(flatRatings(25))
    expect(result.ovr).toBe(25)
    expect(result.relativeAdvantage).toEqual({
      power: -38,
      resonance: -37,
      wisdom: -39,
      charisma: -36,
      intuition: -37,
      adaptability: -38,
      vitality: -37,
    })
    expect(result.archetype).toEqual({
      title: 'Resonant Herald',
      primary: 'charisma',
      secondary: 'resonance',
    })
  })

  it('rates all hundreds as the ceiling everywhere', () => {
    const result = rateStats(flat(100))
    expect(result.ratings).toEqual(flatRatings(99))
    expect(result.ovr).toBe(99)
    expect(result.relativeAdvantage).toEqual({
      power: 36,
      resonance: 37,
      wisdom: 35,
      charisma: 38,
      intuition: 37,
      adaptability: 36,
      vitality: 37,
    })
    expect(result.archetype.primary).toBe('charisma')
    expect(result.archetype.secondary).toBe('resonance')
  })

  it('matches a hand-computed specialist', () => {
    // stats power 90, resonance 40, wisdom 70, the rest 50
    //   -> ratings power 92, resonance 55, wisdom 77, the other four 62
    //   -> OVR (92*1.6 + 77*1.3 + mean(62, 62, 62, 62, 55)) / 3.9 = 307.9 / 3.9 = 78.95 -> 79
    //   -> advantages power +29, wisdom +13, charisma +1, resonance -7
    const result = rateStats(flat(50, { power: 90, resonance: 40, wisdom: 70 }))
    expect(result.ratings).toEqual({
      power: 92,
      resonance: 55,
      wisdom: 77,
      charisma: 62,
      intuition: 62,
      adaptability: 62,
      vitality: 62,
    })
    expect(result.ovr).toBe(79)
    expect(result.relativeAdvantage).toEqual({
      power: 29,
      resonance: -7,
      wisdom: 13,
      charisma: 1,
      intuition: 0,
      adaptability: -1,
      vitality: 0,
    })
    expect(result.archetype).toEqual({
      title: 'Celestial Mechanist',
      primary: 'power',
      secondary: 'wisdom',
    })
  })

  it('weights the top two ratings: two 100s over five 0s is 80, one 100 over six 0s is 55', () => {
    // (99*1.6 + 99*1.3 + 25) / 3.9 = 312.1 / 3.9 = 80.03
    expect(rateStats(flat(0, { power: 100, resonance: 100 })).ovr).toBe(80)
    // (99*1.6 + 25*1.3 + 25) / 3.9 = 215.9 / 3.9 = 55.36
    expect(rateStats(flat(0, { vitality: 100 })).ovr).toBe(55)
  })

  it('lifts OVR to 77 when any single stat of a flat 50 build goes to 100, whichever stat it is', () => {
    // (99*1.6 + 62*1.3 + 62) / 3.9 = 301 / 3.9 = 77.18
    for (const key of STAT_ORDER) {
      expect(rateStats(flat(50, { [key]: 100 })).ovr, key).toBe(77)
    }
  })

  it('rates a top-heavy build above a flat one with a lower sum (ratings in OWA order)', () => {
    // 88 + 6*60 = 448, the same sum as seven 64s, but OVR (88*1.6 + 60*1.3 + 60) / 3.9 = 71.49.
    const peaked = rateStats(statsForRatings(flatRatings(60, { power: 88 })))
    const even = rateStats(statsForRatings(flatRatings(64)))
    expect(peaked.ratings.power).toBe(88)
    expect(peaked.ovr).toBe(71)
    expect(even.ovr).toBe(64)
  })

  it('names the title from advantage over the baseline, not from the tallest bar', () => {
    // power 80 is the tallest rating (advantage +17); charisma 79 is lower (advantage +18) because
    // its baseline is lower (61 against 63). Charisma therefore leads.
    const result = rateStats(statsForRatings(flatRatings(50, { power: 80, charisma: 79 })))
    expect(result.ratings.power).toBeGreaterThan(result.ratings.charisma)
    expect(result.relativeAdvantage.power).toBe(17)
    expect(result.relativeAdvantage.charisma).toBe(18)
    expect(result.archetype).toEqual({
      title: 'Apex Sovereign',
      primary: 'charisma',
      secondary: 'power',
    })
  })
})

describe('rateStats: relative advantage', () => {
  it('is each rating minus the contract baseline, per stat', () => {
    const rand = seeded(0xad7a47a9)
    for (const { stats, ratings } of sampleVectors(rand, 400)) {
      const result = rateStats(stats)
      for (const key of STAT_ORDER) {
        expect(result.relativeAdvantage[key], `${key} ${JSON.stringify(stats)}`).toBe(
          ratings[key] - BASELINE[key]
        )
      }
    }
  })

  it('is zero exactly when a rating sits on its baseline, and never negative zero', () => {
    const result = rateStats(statsForRatings(BASELINE))
    expect(result.ratings).toEqual(BASELINE)
    for (const key of STAT_ORDER) {
      expect(Object.is(result.relativeAdvantage[key], 0), key).toBe(true)
    }
  })

  it('moves one-for-one with the rating and carries a single decimal place at most', () => {
    const base = statsForRatings(flatRatings(70))
    const bumped = statsForRatings(flatRatings(70, { wisdom: 71 }))
    const before = rateStats(base).relativeAdvantage
    const after = rateStats(bumped).relativeAdvantage
    expect(after.wisdom - before.wisdom).toBe(1)
    for (const key of STAT_ORDER) {
      expect(Math.round(after[key] * 10) / 10, key).toBe(after[key])
    }
  })
})

describe('rateStats: OVR against an independent oracle', () => {
  it('has an oracle whose exact and decimal forms agree', () => {
    const rand = seeded(0x0acc1e)
    for (const { ratings } of sampleVectors(rand, 3000)) {
      const values = Object.values(ratings)
      expect(oracleOvrDecimal(values)).toBe(oracleOvrExact(values))
    }
  })

  it('matches the oracle for ratings and OVR on 3000 seeded vectors', () => {
    const rand = seeded(0x51ed270b)
    for (const { stats, ratings } of sampleVectors(rand, 3000)) {
      const result = rateStats(stats)
      const label = JSON.stringify(stats)
      expect(result.ratings, label).toEqual(ratings)
      expect(result.ovr, label).toBe(oracleOvrExact(Object.values(ratings)))
    }
  })

  it('counts a tied best rating once at 1.6 and once at 1.3', () => {
    // ratings 80, 80 and five 60s: (80*1.6 + 80*1.3 + 60) / 3.9 = 292 / 3.9 = 74.87 -> 75
    const result = rateStats(statsForRatings(flatRatings(60, { power: 80, resonance: 80 })))
    expect(result.ovr).toBe(75)
  })

  it('weights by rank: 99, 90, 80, 70, 60, 50, 40 is 86 whichever stat holds which rating', () => {
    // (99*1.6 + 90*1.3 + mean(80, 70, 60, 50, 40)) / 3.9 = 335.4 / 3.9 = 86
    const values = [99, 90, 80, 70, 60, 50, 40]
    for (let shift = 0; shift < 7; shift++) {
      const ratings = {} as Record<CoreStatKey, number>
      STAT_ORDER.forEach((key, i) => {
        ratings[key] = values[(i + shift) % 7]
      })
      expect(rateStats(statsForRatings(ratings)).ovr, `shift ${shift}`).toBe(86)
    }
  })

  it('is unchanged by permuting the seven stats among the keys', () => {
    const rand = seeded(0xc0ffee)
    for (const { stats } of sampleVectors(rand, 400)) {
      const values = STAT_ORDER.map(key => stats[key])
      const order = shuffled(STAT_ORDER, rand)
      const permuted = {} as Record<CoreStatKey, number>
      order.forEach((key, i) => {
        permuted[key] = values[i]
      })
      const before = rateStats(stats)
      const after = rateStats(permuted)
      expect(after.ovr, JSON.stringify(stats)).toBe(before.ovr)
      expect(Object.values(after.ratings).sort((a, b) => a - b)).toEqual(
        Object.values(before.ratings).sort((a, b) => a - b)
      )
    }
  })

  it('gives a tied top three the same OVR wherever the tie sits', () => {
    // ratings 90, 90, 90 and four 60s: (90*1.6 + 90*1.3 + mean(90, 60, 60, 60, 60)) / 3.9 = 83.85
    for (let start = 0; start < 5; start++) {
      const ratings = flatRatings(60)
      for (const key of STAT_ORDER.slice(start, start + 3)) ratings[key] = 90
      expect(rateStats(statsForRatings(ratings)).ovr, `top three from ${STAT_ORDER[start]}`).toBe(
        84
      )
    }
    expect(oracleOvrExact([90, 90, 90, 60, 60, 60, 60])).toBe(84)
  })

  it('stays within the worst and best rating and never falls below the rounded plain mean', () => {
    const rand = seeded(0xb0a4d)
    for (const { stats } of sampleVectors(rand, 1500)) {
      const result = rateStats(stats)
      const values = Object.values(result.ratings)
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      expect(result.ovr).toBeGreaterThanOrEqual(Math.min(...values))
      expect(result.ovr).toBeLessThanOrEqual(Math.max(...values))
      expect(result.ovr).toBeGreaterThanOrEqual(Math.round(mean))
      expect(result.ovr).toBeGreaterThanOrEqual(RATING_FLOOR)
      expect(result.ovr).toBeLessThanOrEqual(RATING_CEILING)
      expect(Number.isInteger(result.ovr)).toBe(true)
    }
  })

  it('is monotone: raising any one stat never lowers OVR, its rating or its advantage', () => {
    const rand = seeded(0x2f6e2b1)
    for (const { stats } of sampleVectors(rand, 400)) {
      const before = rateStats(stats)
      for (const key of STAT_ORDER) {
        const raised = Math.min(100, stats[key] + rand() * 30)
        const after = rateStats({ ...stats, [key]: raised })
        const label = `${key} ${stats[key]} -> ${raised} in ${JSON.stringify(stats)}`
        expect(after.ovr, label).toBeGreaterThanOrEqual(before.ovr)
        expect(after.ratings[key], label).toBeGreaterThanOrEqual(before.ratings[key])
        expect(after.relativeAdvantage[key], label).toBeGreaterThanOrEqual(
          before.relativeAdvantage[key]
        )
        for (const other of STAT_ORDER) {
          if (other === key) continue
          expect(after.ratings[other], label).toBe(before.ratings[other])
          expect(after.relativeAdvantage[other], label).toBe(before.relativeAdvantage[other])
        }
      }
    }
  })

  it('is monotone the other way too: lowering any one stat never raises OVR', () => {
    const rand = seeded(0x10fe5)
    for (const { stats } of sampleVectors(rand, 300)) {
      const before = rateStats(stats).ovr
      for (const key of STAT_ORDER) {
        const lowered = Math.max(0, stats[key] - rand() * 30)
        expect(
          rateStats({ ...stats, [key]: lowered }).ovr,
          `${key} in ${JSON.stringify(stats)}`
        ).toBeLessThanOrEqual(before)
      }
    }
  })
})

describe('rateStats: archetype', () => {
  it('names the title of every one of the 42 ordered pairs, never the fallback', () => {
    expect(ORDERED_PAIRS).toHaveLength(42)
    expect(Object.keys(TITLE)).toHaveLength(42)
    for (const [primary, secondary] of ORDERED_PAIRS) {
      // primary at the ceiling (advantage 99 - baseline >= 35), secondary at rating 75
      // (advantage <= 14), the other five at the floor (advantage <= -36).
      const ratings = flatRatings(25, { [primary]: 99, [secondary]: 75 })
      const result = rateStats(statsForRatings(ratings))
      const label = `${primary}:${secondary}`
      expect(result.ratings, label).toEqual(ratings)
      expect(result.archetype, label).toEqual({
        title: TITLE[label],
        primary,
        secondary,
      })
      const fallback = `${primary[0].toUpperCase()}${primary.slice(1)}-${secondary[0].toUpperCase()}${secondary.slice(1)} Specialist`
      expect(result.archetype.title, label).not.toBe(fallback)
      expect(result.archetype.title, label).not.toMatch(/Specialist/)
    }
  })

  it('names the contract titles quoted from its source for the headline pairs', () => {
    const titleFor = (primary: CoreStatKey, secondary: CoreStatKey) =>
      rateStats(statsForRatings(flatRatings(25, { [primary]: 99, [secondary]: 75 }))).archetype
        .title
    expect(titleFor('power', 'charisma')).toBe('Dominant Commander')
    expect(titleFor('power', 'vitality')).toBe('Juggernaut Anchor')
    expect(titleFor('intuition', 'resonance')).toBe('Reclusive Visionary')
    expect(titleFor('charisma', 'power')).toBe('Apex Sovereign')
    expect(titleFor('vitality', 'adaptability')).toBe('Adaptive Fortress')
  })

  it('shares a title between exactly two pairs of reversed stats (40 distinct titles for 42 pairs)', () => {
    const byTitle = new Map<string, string[]>()
    for (const [primary, secondary] of ORDERED_PAIRS) {
      const title = rateStats(statsForRatings(flatRatings(25, { [primary]: 99, [secondary]: 75 })))
        .archetype.title
      byTitle.set(title, [...(byTitle.get(title) ?? []), `${primary}:${secondary}`])
    }
    expect(byTitle.size).toBe(40)
    const shared = [...byTitle.entries()].filter(([, pairs]) => pairs.length > 1)
    expect(Object.fromEntries(shared)).toEqual({
      'Celestial Mechanist': ['power:wisdom', 'wisdom:power'],
      'Polymath Craftsman': ['wisdom:adaptability', 'adaptability:wisdom'],
    })
  })

  it('always names two different stats, because it ranks seven distinct keys', () => {
    const rand = seeded(0xd15711c7)
    for (const { stats } of sampleVectors(rand, 2000)) {
      const { archetype } = rateStats(stats)
      expect(archetype.primary).not.toBe(archetype.secondary)
      expect(STAT_ORDER).toContain(archetype.primary)
      expect(STAT_ORDER).toContain(archetype.secondary)
    }
  })

  it('matches an independent ranking-and-lookup oracle on 4000 seeded vectors', () => {
    const rand = seeded(0xa2c4e7)
    const seen = new Set<string>()
    for (const { stats, ratings } of sampleVectors(rand, 4000)) {
      const { archetype } = rateStats(stats)
      expect(archetype, JSON.stringify(stats)).toEqual(oracleArchetype(ratings))
      expect(archetype.title).toBe(TITLE[`${archetype.primary}:${archetype.secondary}`])
      expect(archetype.title).not.toMatch(/Specialist/)
      seen.add(`${archetype.primary}:${archetype.secondary}`)
    }
    // The sample is varied enough to exercise many different pairs (the oracle check above is
    // vacuous if every vector landed on one title).
    expect(seen.size).toBeGreaterThanOrEqual(10)
  })

  it('breaks a total tie by stat order: every rating on its baseline names power then resonance', () => {
    const result = rateStats(statsForRatings(BASELINE))
    expect(Object.values(result.relativeAdvantage).every(v => v === 0)).toBe(true)
    expect(result.archetype).toEqual({
      title: 'Kinetic Resonator',
      primary: 'power',
      secondary: 'resonance',
    })
    const reversed = Object.fromEntries(
      Object.entries(statsForRatings(BASELINE)).reverse()
    ) as CoreStats
    expect(rateStats(reversed).archetype).toEqual(result.archetype)
  })

  it('breaks a tie for first place by stat order', () => {
    // wisdom and vitality both +20 (ratings 84 and 82); everything else far lower.
    const result = rateStats(statsForRatings(flatRatings(40, { wisdom: 84, vitality: 82 })))
    expect(result.relativeAdvantage.wisdom).toBe(20)
    expect(result.relativeAdvantage.vitality).toBe(20)
    expect(result.archetype).toEqual({
      title: 'Ancient Pillar',
      primary: 'wisdom',
      secondary: 'vitality',
    })
  })

  it('breaks a tie for second place by stat order', () => {
    // power +30 leads; resonance, charisma and adaptability all +10, so resonance is second.
    const result = rateStats(
      statsForRatings(flatRatings(40, { power: 93, resonance: 72, charisma: 71, adaptability: 73 }))
    )
    expect(result.relativeAdvantage.power).toBe(30)
    expect(result.relativeAdvantage.resonance).toBe(10)
    expect(result.relativeAdvantage.charisma).toBe(10)
    expect(result.relativeAdvantage.adaptability).toBe(10)
    expect(result.archetype).toEqual({
      title: 'Kinetic Resonator',
      primary: 'power',
      secondary: 'resonance',
    })
  })
})

describe('historical roster', () => {
  const rated = HISTORICAL_AGENTS.map(agent => ({ agent, derived: deriveSacredStats(agent) }))

  it('has agents to rate (so the loops below are not vacuous)', () => {
    expect(HISTORICAL_AGENTS.length).toBeGreaterThan(50)
    expect(new Set(HISTORICAL_AGENTS.map(agent => agent.id)).size).toBe(HISTORICAL_AGENTS.length)
  })

  it('rateAgent is rateStats of the derived Sacred 7 stats, for every agent', () => {
    for (const { agent, derived } of rated) {
      expect(rateAgent(agent), agent.id).toEqual(rateStats(derived))
    }
  })

  it('derives stats the rating scale accepts: finite and inside 0..100', () => {
    for (const { agent, derived } of rated) {
      for (const key of STAT_ORDER) {
        expect(Number.isFinite(derived[key]), `${agent.id} ${key}`).toBe(true)
        expect(derived[key], `${agent.id} ${key}`).toBeGreaterThanOrEqual(0)
        expect(derived[key], `${agent.id} ${key}`).toBeLessThanOrEqual(100)
      }
    }
  })

  it('rates every agent on the 25..99 scale, consistently with the oracles', () => {
    for (const { agent, derived } of rated) {
      const result = rateAgent(agent)
      const ratings = {} as Record<CoreStatKey, number>
      for (const key of STAT_ORDER) {
        // The derived stats sit on the 0.001 grid (they are whole numbers today), which is what
        // makes the exact integer oracle valid: stats 25 and 75 land on an exact .5 boundary.
        expect(Math.round(derived[key] * 1000) / 1000, `${agent.id} ${key}`).toBe(derived[key])
        ratings[key] = oracleRating(Math.round(derived[key] * 1000))
      }
      expect(result.ratings, agent.id).toEqual(ratings)
      expect(result.ovr, agent.id).toBe(oracleOvrExact(Object.values(ratings)))
      for (const key of STAT_ORDER) {
        expect(result.relativeAdvantage[key], `${agent.id} ${key}`).toBe(
          ratings[key] - BASELINE[key]
        )
      }
      expect(result.archetype, agent.id).toEqual(oracleArchetype(ratings))
      expect(result.archetype.title, agent.id).not.toMatch(/Specialist/)
    }
  })

  it('is deterministic and leaves the agent untouched', () => {
    for (const { agent } of rated) {
      const snapshot = JSON.stringify(agent)
      const first = rateAgent(agent)
      expect(rateAgent(agent), agent.id).toEqual(first)
      expect(JSON.stringify(agent), agent.id).toBe(snapshot)
    }
  })
})
