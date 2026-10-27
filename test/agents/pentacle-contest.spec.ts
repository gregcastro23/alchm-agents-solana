/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import {
  FIXTURE_AGENTS,
  SACRED_STAT_KEYS,
  SEAL_TIERS,
  SEAL_TIER_MULTIPLIERS as CONTRACT_SEAL_TIER_MULTIPLIERS,
  buildCanonicalSeal,
  clampStat,
  evaluateSurgeState,
  type AlchemicalSeal,
  type SacredStatKey,
  type SealTier,
} from '@/lib/agents/rating-contract'
import {
  CONTROL_GAIN,
  MAX_CONTROL_SWING,
  SEAL_TIER_MULTIPLIERS,
  ZONE_PROFILES,
  bestZoneId,
  computeZoneSynergies,
  effectiveContestRating,
  resolveZoneContest,
  type ContestVessel,
} from '@/lib/agents/rating/pentacle-contest'
import {
  DEFAULT_SURGE_CALIBRATION,
  calculateResonanceSurge,
  earnedSeals,
  evaluateSeals,
} from '@/lib/agents/rating/seals-surge'
import { ELEMENT_TO_ESMS, ESMS_ELEMENT } from '@/lib/staking/elements'
import { SPIRE_LABELS, zoneKind } from '@/lib/staking/pentacle-geometry'
import type { Element, EsmsId } from '@/lib/staking/types'

/**
 * Zone contests over the Pentacles rating contract (`lib/agents/rating-contract.ts`, #65).
 *
 * A vessel here is `{ ratings, seals, surge }`: ratings are the contract's integers on 25..99,
 * seals are the contract's earned `AlchemicalSeal`s (their `category` is an ESMS token, or
 * 'general'), and a surge is the contract's `{ active, statBoosts }`, whose boosts are RATING
 * POINTS added to every stat they name only while the surge is active.
 *
 * Oracles: the zone weight table and the tier multipliers are pinned below as literals, and the
 * ECR oracle is integer arithmetic over them (it never calls the module under test). The contract
 * is used as the oracle only where it IS the contract: `clampStat`, `SEAL_TIER_MULTIPLIERS`,
 * `buildCanonicalSeal`, `evaluateSurgeState`, `FIXTURE_AGENTS`.
 *
 * On this scale an ECR is never below 25 (weights sum to 1, ratings floor at 25, multipliers are
 * at least 1), which makes two guards in `resolveZoneContest` unreachable: the `1` in
 * `max(attackerScore, defenderScore, 1)` and the `max(0, ...)` on the relative swing. They cannot
 * be tested and are not.
 */

// ─── Vocabulary the module is specified against ─────────────────────────────

/** The contract's seven stats, in its order. */
const STATS = [
  'power',
  'resonance',
  'wisdom',
  'charisma',
  'intuition',
  'adaptability',
  'vitality',
] as const satisfies readonly SacredStatKey[]

type Ratings = Record<SacredStatKey, number>
type Category = AlchemicalSeal['category']

const TIERS = [
  'Copper',
  'Silver',
  'Gold',
  'Astral',
  'Celestial',
] as const satisfies readonly SealTier[]
const TOKENS = ['spirit', 'essence', 'matter', 'substance'] as const
const CATEGORIES: readonly Category[] = [...TOKENS, 'general']

/** The retired top-but-one tier name, assembled so this file never spells it. */
const RETIRED_TIER = ['Ae', 'ther'].join('')

/** The contract's multipliers, pinned literally (and in percent for the integer oracle). */
const EXPECTED_MULTIPLIER: Record<SealTier, number> = {
  Copper: 1.05,
  Silver: 1.1,
  Gold: 1.18,
  Astral: 1.28,
  Celestial: 1.4,
}
const MULTIPLIER_PERCENT: Record<SealTier, number> = {
  Copper: 105,
  Silver: 110,
  Gold: 118,
  Astral: 128,
  Celestial: 140,
}

/** The zone weight table in whole percents. Columns follow STATS. */
const EXPECTED_PERCENT: readonly (readonly number[])[] = [
  [25, 5, 20, 5, 5, 5, 35], // 0  House N-ENE
  [35, 5, 5, 5, 5, 20, 25], // 1  House ENE-SE
  [35, 5, 5, 20, 5, 5, 25], // 2  House SE-SW
  [25, 20, 5, 5, 5, 5, 35], // 3  House SW-WNW
  [30, 5, 5, 5, 20, 5, 30], // 4  House WNW-N
  [5, 10, 35, 5, 20, 15, 10], // 5  Spire N
  [10, 5, 15, 10, 20, 35, 5], // 6  Spire ENE
  [10, 5, 20, 10, 35, 15, 5], // 7  Spire SE
  [5, 10, 30, 5, 20, 25, 5], // 8  Spire SW
  [5, 15, 20, 5, 30, 20, 5], // 9  Spire WNW
  [12, 19, 13, 19, 13, 12, 12], // 10 Crown
]

/** Compass element of each zone, and the ESMS token whose Seals multiply that zone. */
const EXPECTED_ELEMENT: readonly Element[] = [
  'Earth', // 0  House N-ENE
  'Air', // 1  House ENE-SE
  'Fire', // 2  House SE-SW
  'Water', // 3  House SW-WNW
  'Earth', // 4  House WNW-N
  'Earth', // 5  Spire N
  'Air', // 6  Spire ENE
  'Fire', // 7  Spire SE
  'Fire', // 8  Spire SW
  'Water', // 9  Spire WNW
  'Water', // 10 Crown
]
const TOKEN_OF_ELEMENT: Record<Element, (typeof TOKENS)[number]> = {
  Fire: 'spirit',
  Water: 'essence',
  Earth: 'matter',
  Air: 'substance',
}
const TOKEN_OF_ZONE = EXPECTED_ELEMENT.map(element => TOKEN_OF_ELEMENT[element])

/** The contract's catalog: which ESMS token each stat's canonical Seal is made of. */
const CANONICAL_TOKEN: Record<SacredStatKey, (typeof TOKENS)[number]> = {
  power: 'substance',
  intuition: 'spirit',
  vitality: 'matter',
  charisma: 'essence',
  resonance: 'essence',
  adaptability: 'spirit',
  wisdom: 'matter',
}

const ZONE_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

const flat = (base: number, overrides: Partial<Ratings> = {}): Ratings => ({
  power: base,
  resonance: base,
  wisdom: base,
  charisma: base,
  intuition: base,
  adaptability: base,
  vitality: base,
  ...overrides,
})

/** 25 (the rating floor) on every stat but one, which is `value` (the ceiling by default). */
const oneHot = (key: SacredStatKey, value = 99): Ratings => flat(25, { [key]: value })

/**
 * A literal earned Seal. Its `multiplier` field is the contract's for the tier. Its `statKey` is
 * deliberately not the one the catalog pairs with `category`: only `category` and `tier` decide.
 */
const seal = (
  category: Category,
  tier: SealTier,
  id = `test-${category}-${tier}`
): AlchemicalSeal => ({
  id,
  name: id,
  category,
  tier,
  description: 'test seal',
  statKey: 'power',
  multiplier: EXPECTED_MULTIPLIER[tier],
})

const vessel = (
  ratings: Ratings,
  seals: readonly AlchemicalSeal[] = [],
  surge: ContestVessel['surge'] = null
): ContestVessel => ({ ratings, seals, surge })

const surgeOf = (active: boolean, statBoosts: Partial<Ratings>): ContestVessel['surge'] => ({
  active,
  statBoosts,
})

/** A boost on every stat, the way the contract's `evaluateSurgeState` shapes one. */
function contractBoosts(
  kind: 'inferno' | 'equilibrium',
  primary: SacredStatKey,
  secondary: SacredStatKey
): Ratings {
  const [first, second, rest] = kind === 'equilibrium' ? [16, 12, 8] : [12, 8, 4]
  const boosts = {} as Ratings
  for (const key of STATS) boosts[key] = key === primary ? first : key === secondary ? second : rest
  return boosts
}

/** Seeded PRNG (mulberry32): the property tests are reproducible, never random per run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(rng: () => number, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)]

function randomVessel(rng: () => number): ContestVessel {
  const ratings = {} as Ratings
  for (const key of STATS) {
    // Mostly integers on the scale; some fractional and some beyond it, so rounding and clamping run.
    ratings[key] =
      rng() < 0.7 ? 25 + Math.floor(rng() * 75) : Math.round((rng() * 150 - 25) * 100) / 100
  }
  const seals: AlchemicalSeal[] = []
  const sealCount = Math.floor(rng() * 6)
  for (let i = 0; i < sealCount; i++) {
    seals.push(seal(pick(rng, CATEGORIES), pick(rng, TIERS), `seal-${i}`))
  }
  let surge: ContestVessel['surge'] = null
  if (rng() < 0.6) {
    const statBoosts: Partial<Ratings> = {}
    for (const key of STATS) {
      if (rng() < 0.4) statBoosts[key] = Math.round((rng() * 24 - 4) * 10) / 10
    }
    surge = { active: rng() < 0.6, statBoosts }
  }
  return { ratings, seals, surge }
}

/** The rating the contest should use: rounded, then held to 25..99, after any active boost. */
const ratingUsed = (v: ContestVessel, key: SacredStatKey): number => {
  const boost = v.surge && v.surge.active ? (v.surge.statBoosts[key] ?? 0) : 0
  return Math.min(99, Math.max(25, Math.round(v.ratings[key] + boost)))
}

/**
 * The ECR in ten-thousandths, in exact integer arithmetic: Σ percent × rating, times the
 * multiplier in percent. It reads the tables above, never `ZONE_PROFILES`.
 */
function oracleTenThousandths(v: ContestVessel, zoneId: number): number {
  let sum = 0
  STATS.forEach((key, column) => {
    sum += EXPECTED_PERCENT[zoneId][column] * ratingUsed(v, key)
  })
  let multiplier = 100
  for (const s of v.seals) {
    if (s.category === TOKEN_OF_ZONE[zoneId]) {
      multiplier = Math.max(multiplier, MULTIPLIER_PERCENT[s.tier])
    }
  }
  return sum * multiplier
}

/**
 * The acceptable 2-dp ECRs. Exactly one, except when the exact product sits on a half-cent,
 * where float noise in a correct implementation may land either side.
 */
function oracleEcr(v: ContestVessel, zoneId: number): number[] {
  const exact = oracleTenThousandths(v, zoneId)
  const whole = Math.floor(exact / 100)
  return exact % 100 === 50 ? [whole / 100, (whole + 1) / 100] : [Math.round(exact / 100) / 100]
}

const expectEcr = (actual: number, v: ContestVessel, zoneId: number, label = ''): void => {
  expect(oracleEcr(v, zoneId), `${label} zone ${zoneId} got ${actual}`).toContain(actual)
}

// ─── The contract this module is specified against ──────────────────────────

describe('the rating contract the zone engine consumes', () => {
  it('has the seven stats in the order the weight table is written in', () => {
    expect([...SACRED_STAT_KEYS]).toEqual([...STATS])
  })

  it('has the five tiers, lowest to highest, with Astral where the retired tier used to be', () => {
    expect([...SEAL_TIERS]).toEqual(['Copper', 'Silver', 'Gold', 'Astral', 'Celestial'])
    expect(SEAL_TIERS).not.toContain(RETIRED_TIER)
  })

  it('builds canonical Seals out of the ESMS token the table above says, one per stat', () => {
    for (const stat of STATS) {
      const built = buildCanonicalSeal(stat, 'Gold')
      expect(built.id).toBe(`seal-${stat}`)
      expect(built.category).toBe(CANONICAL_TOKEN[stat])
      expect(built.multiplier).toBe(1.18)
    }
  })

  it('shapes a surge’s boosts over all seven stats the way contractBoosts does', () => {
    // These fixtures stand in for what `evaluateSurgeState` hands the engine; pin that they agree.
    const inferno = evaluateSurgeState(80, 0.9, 0.5, 'power', 'charisma', null)
    expect(inferno).toMatchObject({ active: true, surgeType: 'inferno' })
    expect(inferno.statBoosts).toEqual(contractBoosts('inferno', 'power', 'charisma'))

    const tempest = evaluateSurgeState(80, 0.5, 0.9, 'wisdom', 'intuition', 0.4)
    expect(tempest.surgeType).toBe('tempest')
    expect(tempest.statBoosts).toEqual(contractBoosts('inferno', 'wisdom', 'intuition'))

    const equilibrium = evaluateSurgeState(95, 0.8, 0.8, 'power', 'charisma', 1.618)
    expect(equilibrium.surgeType).toBe('equilibrium')
    expect(equilibrium.statBoosts).toEqual(contractBoosts('equilibrium', 'power', 'charisma'))

    const idle = evaluateSurgeState(69, 0.9, 0.5, 'power', 'charisma', null)
    expect(idle).toMatchObject({ active: false, statBoosts: {} })
  })
})

// ─── Zone profile table ──────────────────────────────────────────────────────

describe('ZONE_PROFILES', () => {
  it('has exactly 11 zones and the index is the zone id', () => {
    expect(ZONE_PROFILES).toHaveLength(11)
    ZONE_PROFILES.forEach((profile, index) => expect(profile.zoneId).toBe(index))
  })

  it('takes each zone kind from the geometry: Houses 0–4, Spires 5–9, the Crown at 10', () => {
    ZONE_PROFILES.forEach(profile => expect(profile.kind).toBe(zoneKind(profile.zoneId)))
    expect(ZONE_PROFILES.map(p => p.kind)).toEqual([
      'House',
      'House',
      'House',
      'House',
      'House',
      'Spire',
      'Spire',
      'Spire',
      'Spire',
      'Spire',
      'Crown',
    ])
  })

  it('weights every Sacred 7 stat, none negative, summing to 1, with at least two non-zero', () => {
    for (const profile of ZONE_PROFILES) {
      expect(Object.keys(profile.weights).sort()).toEqual([...STATS].sort())
      const values = STATS.map(key => profile.weights[key])
      values.forEach(value => expect(value).toBeGreaterThanOrEqual(0))
      expect(Math.abs(values.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-9)
      expect(values.filter(value => value > 0).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('sums every row of the pinned table to 100 percent', () => {
    for (const row of EXPECTED_PERCENT) expect(row.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('pins the weight table (policy): any change to a weight is a deliberate edit to both', () => {
    ZONE_PROFILES.forEach((profile, zoneId) => {
      STATS.forEach((key, column) => {
        expect(profile.weights[key], `${profile.label}/${key}`).toBeCloseTo(
          EXPECTED_PERCENT[zoneId][column] / 100,
          12
        )
      })
    })
  })

  it('gives every ESMS element at least two zones, and an element that matches its token', () => {
    const counts: Record<Element, number> = { Fire: 0, Water: 0, Earth: 0, Air: 0 }
    for (const profile of ZONE_PROFILES) {
      counts[profile.element]++
      const tokenIndex = TOKENS.indexOf(profile.esmsToken)
      expect(tokenIndex).toBe(ELEMENT_TO_ESMS[profile.element])
      expect(ESMS_ELEMENT[tokenIndex as EsmsId]).toBe(profile.element)
    }
    for (const element of ['Fire', 'Water', 'Earth', 'Air'] as const) {
      expect(counts[element]).toBeGreaterThanOrEqual(2)
    }
    expect(counts).toEqual({ Earth: 3, Air: 2, Fire: 3, Water: 3 })
  })

  it('pins each zone’s element and the token a Seal needs to multiply it', () => {
    expect(ZONE_PROFILES.map(p => p.element)).toEqual([...EXPECTED_ELEMENT])
    expect(ZONE_PROFILES.map(p => p.esmsToken)).toEqual([
      'matter',
      'substance',
      'spirit',
      'essence',
      'matter',
      'matter',
      'substance',
      'spirit',
      'spirit',
      'essence',
      'essence',
    ])
    expect(ZONE_PROFILES.map(p => p.esmsToken)).toEqual(TOKEN_OF_ZONE)
  })

  it('never asks for the "general" category: no zone is multiplied by a general Seal', () => {
    for (const profile of ZONE_PROFILES) {
      expect(TOKENS).toContain(profile.esmsToken)
      expect(profile.esmsToken).not.toBe('general')
    }
  })

  it('follows the compass rule: azimuth quadrant picks the element, the Crown is Water', () => {
    // North = 0° clockwise. Spire k at 72°·k, House k midway between Spire k and k+1.
    const azimuth = (zoneId: number): number => (zoneId <= 4 ? 72 * zoneId + 36 : 72 * (zoneId - 5))
    const quadrantElement = (deg: number): Element => {
      if (deg >= 315 || deg < 45) return 'Earth' // North
      if (deg < 135) return 'Air' // East
      if (deg < 225) return 'Fire' // South
      return 'Water' // West
    }
    for (const profile of ZONE_PROFILES.slice(0, 10)) {
      expect(profile.element, profile.label).toBe(quadrantElement(azimuth(profile.zoneId)))
    }
    expect(ZONE_PROFILES[10].element).toBe('Water')
  })

  it('shapes Houses around vitality and power, each with its own secondary stat', () => {
    const houses = ZONE_PROFILES.filter(p => p.kind === 'House')
    const secondaries = new Set<string>()
    for (const house of houses) {
      const ranked = [...STATS].sort((a, b) => house.weights[b] - house.weights[a])
      expect(new Set(ranked.slice(0, 2))).toEqual(new Set(['power', 'vitality']))
      expect(house.weights.power + house.weights.vitality).toBeCloseTo(0.6, 12)
      // The third-ranked stat is the House's own secondary emphasis.
      expect(house.weights[ranked[2]]).toBeGreaterThan(house.weights[ranked[3]])
      secondaries.add(ranked[2])
    }
    expect(secondaries.size).toBe(houses.length)
  })

  it('shapes Spires around intuition, wisdom and adaptability, with one leading each', () => {
    const spireStats: readonly SacredStatKey[] = ['intuition', 'wisdom', 'adaptability']
    const leaders = new Set<string>()
    for (const spire of ZONE_PROFILES.filter(p => p.kind === 'Spire')) {
      const ranked = [...STATS].sort((a, b) => spire.weights[b] - spire.weights[a])
      expect(spireStats).toContain(ranked[0])
      expect(ranked.slice(0, 3).every(key => spireStats.includes(key))).toBe(true)
      const share = spireStats.reduce((sum, key) => sum + spire.weights[key], 0)
      expect(share).toBeGreaterThanOrEqual(0.7 - 1e-9)
      leaders.add(ranked[0])
    }
    // Every one of the three stats leads at least one Spire.
    expect(leaders).toEqual(new Set(spireStats))
  })

  it('keeps the Crown balanced, with resonance and charisma carrying extra', () => {
    const crown = ZONE_PROFILES[10]
    const values = STATS.map(key => crown.weights[key])
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(0.1)
    const ranked = [...STATS].sort((a, b) => crown.weights[b] - crown.weights[a])
    expect(new Set(ranked.slice(0, 2))).toEqual(new Set(['resonance', 'charisma']))
    for (const key of STATS) {
      if (key === 'resonance' || key === 'charisma') continue
      expect(crown.weights.resonance).toBeGreaterThan(crown.weights[key])
      expect(crown.weights.charisma).toBeGreaterThan(crown.weights[key])
    }
  })

  it('gives all 11 zones distinct weight profiles and distinct labels', () => {
    const signatures = ZONE_PROFILES.map(p => STATS.map(key => p.weights[key]).join(','))
    expect(new Set(signatures).size).toBe(11)
    expect(new Set(ZONE_PROFILES.map(p => p.label)).size).toBe(11)
  })

  it('labels zones from the geometry: Houses by the spires they span, then Spires, then the Crown', () => {
    expect(ZONE_PROFILES.map(p => p.label)).toEqual([
      'House N-ENE',
      'House ENE-SE',
      'House SE-SW',
      'House SW-WNW',
      'House WNW-N',
      'Spire N',
      'Spire ENE',
      'Spire SE',
      'Spire SW',
      'Spire WNW',
      'Crown',
    ])
    expect(SPIRE_LABELS).toEqual(['N', 'ENE', 'SE', 'SW', 'WNW'])
  })

  it('is frozen, so a caller cannot corrupt every later rating', () => {
    expect(Object.isFrozen(ZONE_PROFILES)).toBe(true)
    for (const profile of ZONE_PROFILES) {
      expect(Object.isFrozen(profile), profile.label).toBe(true)
      expect(Object.isFrozen(profile.weights), profile.label).toBe(true)
    }
    expect(() => {
      ZONE_PROFILES[0].weights.power = 1
    }).toThrow(TypeError)
    expect(() => {
      ZONE_PROFILES[0].label = 'renamed'
    }).toThrow(TypeError)
    expect(() => {
      ;(ZONE_PROFILES as unknown as unknown[])[0] = null
    }).toThrow(TypeError)
  })
})

describe('SEAL_TIER_MULTIPLIERS', () => {
  it('is exactly 1.05 / 1.10 / 1.18 / 1.28 / 1.40 for Copper through Celestial', () => {
    expect(SEAL_TIER_MULTIPLIERS).toEqual({
      Copper: 1.05,
      Silver: 1.1,
      Gold: 1.18,
      Astral: 1.28,
      Celestial: 1.4,
    })
  })

  it('is the contract’s own table, re-exported rather than copied', () => {
    expect(SEAL_TIER_MULTIPLIERS).toBe(CONTRACT_SEAL_TIER_MULTIPLIERS)
    expect(CONTRACT_SEAL_TIER_MULTIPLIERS).toEqual(EXPECTED_MULTIPLIER)
  })

  it('names the five contract tiers in order, and not the retired one', () => {
    expect(Object.keys(SEAL_TIER_MULTIPLIERS)).toEqual([
      'Copper',
      'Silver',
      'Gold',
      'Astral',
      'Celestial',
    ])
    expect(SEAL_TIER_MULTIPLIERS).not.toHaveProperty(RETIRED_TIER)
  })

  it('rises strictly with the tier order and never falls below 1', () => {
    const values = TIERS.map(tier => SEAL_TIER_MULTIPLIERS[tier])
    expect(values[0]).toBeGreaterThan(1)
    values.slice(1).forEach((value, i) => expect(value).toBeGreaterThan(values[i]))
  })

  it('is frozen', () => {
    expect(Object.isFrozen(SEAL_TIER_MULTIPLIERS)).toBe(true)
  })
})

// ─── Effective Contest Rating ────────────────────────────────────────────────

describe('effectiveContestRating: arithmetic', () => {
  it.each([25, 50, 63, 87, 99])(
    'scores a flat %s vessel as exactly that in every zone, since weights sum to 1',
    rating => {
      for (const zoneId of ZONE_IDS) {
        expect(effectiveContestRating(vessel(flat(rating)), zoneId)).toBe(rating)
      }
    }
  )

  it('reads one-hot ratings straight off the weight table in every zone', () => {
    // 25 everywhere and 99 on one stat: ECR = 25 + 74 × weight, here in whole cents.
    for (const zoneId of ZONE_IDS) {
      STATS.forEach((key, column) => {
        const expected = (2500 + 74 * EXPECTED_PERCENT[zoneId][column]) / 100
        expect(effectiveContestRating(vessel(oneHot(key)), zoneId), `${zoneId}/${key}`).toBe(
          expected
        )
      })
    }
  })

  it('pins a few one-hot values as plain numbers', () => {
    expect(effectiveContestRating(vessel(oneHot('power')), 1)).toBe(50.9) // 25 + .35 × 74
    expect(effectiveContestRating(vessel(oneHot('wisdom')), 5)).toBe(50.9)
    expect(effectiveContestRating(vessel(oneHot('resonance')), 10)).toBe(39.06) // 25 + .19 × 74
    expect(effectiveContestRating(vessel(oneHot('adaptability')), 0)).toBe(28.7) // 25 + .05 × 74
  })

  describe('hand-computed from the weight table, one zone of each kind', () => {
    const mixed = flat(0, {
      power: 90,
      resonance: 60,
      wisdom: 40,
      charisma: 30,
      intuition: 99,
      adaptability: 25,
      vitality: 70,
    })

    it('the Crown (12 / 19 / 13 / 19 / 13 / 12 / 12)', () => {
      // 10.8 + 11.4 + 5.2 + 5.7 + 12.87 + 3.0 + 8.4
      expect(effectiveContestRating(vessel(mixed), 10)).toBe(57.37)
    })

    it('a Spire, SE (10 / 5 / 20 / 10 / 35 / 15 / 5)', () => {
      // 9 + 3 + 8 + 3 + 34.65 + 3.75 + 3.5
      expect(effectiveContestRating(vessel(mixed), 7)).toBe(64.9)
    })

    it('a House, SE-SW (35 / 5 / 5 / 20 / 5 / 5 / 25)', () => {
      // 31.5 + 3 + 2 + 6 + 4.95 + 1.25 + 17.5
      expect(effectiveContestRating(vessel(mixed), 2)).toBe(66.2)
    })

    it('and rounds the product with a Seal to 2 dp after multiplying, up and down', () => {
      // House SE-SW is Fire/spirit: 66.2 × 1.18 = 78.116 → 78.12 (a floor would give 78.11).
      expect(effectiveContestRating(vessel(mixed, [seal('spirit', 'Gold')]), 2)).toBe(78.12)
      // Spire SE is Fire/spirit: 64.9 × 1.28 = 83.072 → 83.07 (a ceiling would give 83.08).
      expect(effectiveContestRating(vessel(mixed, [seal('spirit', 'Astral')]), 7)).toBe(83.07)
      // The Crown is Water/essence: 57.37 × 1.18 = 67.6966 → 67.7 (an unrounded product would not).
      expect(effectiveContestRating(vessel(mixed, [seal('essence', 'Gold')]), 10)).toBe(67.7)
    })
  })

  it('raises the ECR by exactly weight × increase when one rating of a flat 50 vessel goes up', () => {
    for (const zoneId of ZONE_IDS) {
      STATS.forEach((key, column) => {
        const expected = (5000 + EXPECTED_PERCENT[zoneId][column] * 10) / 100
        expect(effectiveContestRating(vessel(flat(50, { [key]: 60 })), zoneId)).toBe(expected)
      })
    }
  })

  it('always returns a value with at most 2 decimals', () => {
    const rng = mulberry32(11)
    for (let i = 0; i < 300; i++) {
      const ecr = effectiveContestRating(randomVessel(rng), Math.floor(rng() * 11))
      expect(Math.round(ecr * 100) / 100).toBe(ecr)
    }
  })

  it('holds each rating to 25..99 before weighting, with no surge at all', () => {
    expect(effectiveContestRating(vessel(flat(150)), 4)).toBe(99)
    expect(effectiveContestRating(vessel(flat(100)), 4)).toBe(99)
    expect(effectiveContestRating(vessel(flat(10)), 4)).toBe(25)
    expect(effectiveContestRating(vessel(flat(0)), 4)).toBe(25)
    expect(effectiveContestRating(vessel(flat(-20)), 4)).toBe(25)
    // power 150 holds at 99: House ENE-SE weighs power at .35 → 25 + .35 × 74.
    expect(effectiveContestRating(vessel(oneHot('power', 150)), 1)).toBe(50.9)
    expect(effectiveContestRating(vessel(oneHot('power', 99)), 1)).toBe(50.9)
    // power -40 holds at 25: the floor, not a negative.
    expect(effectiveContestRating(vessel(oneHot('power', -40)), 1)).toBe(25)
  })

  it('keeps the edges of the scale as they are', () => {
    expect(effectiveContestRating(vessel(flat(25)), 3)).toBe(25)
    expect(effectiveContestRating(vessel(flat(99)), 3)).toBe(99)
    expect(effectiveContestRating(vessel(flat(24.4)), 3)).toBe(25)
    expect(effectiveContestRating(vessel(flat(99.4)), 3)).toBe(99)
  })

  it('rounds a fractional rating to the nearest integer, halves upward, before weighting', () => {
    expect(effectiveContestRating(vessel(flat(60.4)), 3)).toBe(60)
    expect(effectiveContestRating(vessel(flat(60.5)), 3)).toBe(61)
    expect(effectiveContestRating(vessel(flat(60.6)), 3)).toBe(61)
    expect(effectiveContestRating(vessel(flat(61.5)), 3)).toBe(62)
    expect(effectiveContestRating(vessel(flat(61.4)), 3)).toBe(61)
    // One stat only: power 60.5 reads as 61, so House ENE-SE is 25 + .35 × 36.
    expect(effectiveContestRating(vessel(oneHot('power', 60.5)), 1)).toBe(37.6)
    expect(effectiveContestRating(vessel(oneHot('power', 60.4)), 1)).toBe(37.25)
  })

  it('agrees with an independent integer oracle over seeded random vessels', () => {
    const rng = mulberry32(2024)
    for (let i = 0; i < 600; i++) {
      const v = randomVessel(rng)
      const zoneId = Math.floor(rng() * 11)
      expectEcr(effectiveContestRating(v, zoneId), v, zoneId, `vessel ${i}`)
    }
  })

  it('never leaves 25..138.6: the rating floor, and the 99 ceiling times the best multiplier', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 400; i++) {
      const ecr = effectiveContestRating(randomVessel(rng), Math.floor(rng() * 11))
      expect(ecr).toBeGreaterThanOrEqual(25)
      expect(ecr).toBeLessThanOrEqual(138.6)
    }
  })

  it('does not mutate its input, and accepts a deeply frozen vessel', () => {
    const v = vessel(flat(70), [seal('matter', 'Gold')], surgeOf(true, { resonance: 10 }))
    Object.freeze(v.ratings)
    Object.freeze(v.seals)
    Object.freeze(v.seals[0])
    Object.freeze(v.surge?.statBoosts)
    Object.freeze(v.surge)
    Object.freeze(v)
    const first = effectiveContestRating(v, 0)
    expect(effectiveContestRating(v, 0)).toBe(first)
    expect(v.ratings.resonance).toBe(70)
    expect(v.surge?.statBoosts.resonance).toBe(10)
  })

  it('is the contract fixtures’ ECR when they are handed in as they are', () => {
    // A `RatedAgentPayload` already has `ratings`, `seals` and `surge`, so it is a vessel.
    for (const agent of FIXTURE_AGENTS) {
      for (const zoneId of ZONE_IDS) {
        expectEcr(effectiveContestRating(agent, zoneId), agent, zoneId, agent.key)
      }
    }
  })

  describe('hand-computed on three of the contract’s vessels, written out here', () => {
    // The inputs are copied from `FIXTURE_AGENTS` (ratings, earned Seals, surge) so the arithmetic
    // below does not move when the contract's fixture data is edited; the parity test says so.
    const newton = vessel(
      flat(0, {
        power: 84,
        resonance: 82,
        wisdom: 98,
        charisma: 72,
        intuition: 89,
        adaptability: 76,
        vitality: 88,
      }),
      [buildCanonicalSeal('wisdom', 'Celestial'), buildCanonicalSeal('intuition', 'Gold')],
      surgeOf(true, contractBoosts('inferno', 'wisdom', 'intuition'))
    )
    const leonardo = vessel(
      flat(0, {
        power: 78,
        resonance: 88,
        wisdom: 96,
        charisma: 85,
        intuition: 94,
        adaptability: 97,
        vitality: 79,
      }),
      [buildCanonicalSeal('adaptability', 'Celestial'), buildCanonicalSeal('wisdom', 'Celestial')],
      surgeOf(false, {})
    )
    const dickinson = vessel(
      flat(0, {
        power: 65,
        resonance: 92,
        wisdom: 86,
        charisma: 78,
        intuition: 99,
        adaptability: 74,
        vitality: 68,
      }),
      [buildCanonicalSeal('intuition', 'Celestial'), buildCanonicalSeal('resonance', 'Celestial')],
      surgeOf(true, contractBoosts('equilibrium', 'intuition', 'resonance'))
    )

    it('are the contract’s own fixtures', () => {
      const byKey = (key: string) => {
        const found = FIXTURE_AGENTS.find(agent => agent.key === key)
        if (!found) throw new Error(`missing fixture ${key}`)
        return found
      }
      const pairs: [string, ContestVessel][] = [
        ['isaac-newton', newton],
        ['leonardo-da-vinci', leonardo],
        ['emily-dickinson', dickinson],
      ]
      for (const [key, mine] of pairs) {
        const theirs = byKey(key)
        expect(mine.ratings, key).toEqual(theirs.ratings)
        expect(mine.seals, key).toEqual(
          theirs.seals.map(({ id, category, tier }) =>
            expect.objectContaining({ id, category, tier })
          )
        )
        expect(mine.surge?.active, key).toBe(theirs.surge.active)
        expect(mine.surge?.statBoosts, key).toEqual(theirs.surge.statBoosts)
      }
    })

    it('Newton: wisdom 98 + 12 clamps to 99, a Celestial matter Seal multiplies Spire N', () => {
      // boosted: power 88, resonance 86, wisdom 99, charisma 76, intuition 97, adaptability 80, vitality 92.
      // Spire N (Earth/matter): 88·.05 + 86·.10 + 99·.35 + 76·.05 + 97·.20 + 80·.15 + 92·.10 = 92.05
      // × 1.40 = 128.87.
      expect(effectiveContestRating(newton, 5)).toBe(128.87)
      // Spire SE (Fire/spirit) holds the Gold intuition Seal: 88·.10 + 86·.05 + 99·.20 + 76·.10 +
      // 97·.35 + 80·.15 + 92·.05 = 91.05, × 1.18 = 107.439.
      expect(effectiveContestRating(newton, 7)).toBe(107.44)
      // House SW-WNW (Water/essence): no essence Seal, so the bare 88·.25 + 86·.20 + 99·.05 + 76·.05
      // + 97·.05 + 80·.05 + 92·.35 = 89.
      expect(effectiveContestRating(newton, 3)).toBe(89)
    })

    it('Leonardo: an inactive surge adds nothing, two Celestial Seals multiply their own zones', () => {
      // Spire SE (Fire/spirit, Celestial adaptability): 78·.10 + 88·.05 + 96·.20 + 85·.10 + 94·.35 +
      // 97·.15 + 79·.05 = 91.3, × 1.40 = 127.82.
      expect(effectiveContestRating(leonardo, 7)).toBe(127.82)
      // House SW-WNW (Water/essence, no Seal): 78·.25 + 88·.20 + 96·.05 + 85·.05 + 94·.05 + 97·.05
      // + 79·.35 = 19.5 + 17.6 + 4.8 + 4.25 + 4.7 + 4.85 + 27.65 = 83.35.
      expect(effectiveContestRating(leonardo, 3)).toBe(83.35)
    })

    it('Dickinson: equilibrium boosts clamp two ratings at 99 before the Crown’s Celestial Seal', () => {
      // boosted: power 73, resonance 104 → 99, wisdom 94, charisma 86, intuition 115 → 99,
      // adaptability 82, vitality 76. Crown (Water/essence): 73·.12 + 99·.19 + 94·.13 + 86·.19 +
      // 99·.13 + 82·.12 + 76·.12 = 87.96, × 1.40 = 123.144.
      expect(effectiveContestRating(dickinson, 10)).toBe(123.14)
    })
  })
})

describe('effectiveContestRating: Seals', () => {
  it('applies the multiplier of the vessel’s tier for the zone’s own element, tier by tier', () => {
    // Zone 0 is Earth, whose token is matter; a flat 50 vessel makes the multiplier visible.
    const expected: Record<SealTier, number> = {
      Copper: 52.5,
      Silver: 55,
      Gold: 59,
      Astral: 64,
      Celestial: 70,
    }
    for (const tier of TIERS) {
      expect(effectiveContestRating(vessel(flat(50), [seal('matter', tier)]), 0)).toBe(
        expected[tier]
      )
    }
  })

  it('multiplies a flat vessel’s rating by the tier’s multiplier in every zone of that token', () => {
    const expected: Record<number, Record<SealTier, number>> = {
      25: { Copper: 26.25, Silver: 27.5, Gold: 29.5, Astral: 32, Celestial: 35 },
      50: { Copper: 52.5, Silver: 55, Gold: 59, Astral: 64, Celestial: 70 },
      63: { Copper: 66.15, Silver: 69.3, Gold: 74.34, Astral: 80.64, Celestial: 88.2 },
      87: { Copper: 91.35, Silver: 95.7, Gold: 102.66, Astral: 111.36, Celestial: 121.8 },
      99: { Copper: 103.95, Silver: 108.9, Gold: 116.82, Astral: 126.72, Celestial: 138.6 },
    }
    for (const [rating, byTier] of Object.entries(expected)) {
      for (const tier of TIERS) {
        for (const zoneId of ZONE_IDS) {
          const own = vessel(flat(Number(rating)), [seal(TOKEN_OF_ZONE[zoneId], tier)])
          expect(effectiveContestRating(own, zoneId), `${rating}/${tier}/${zoneId}`).toBe(
            byTier[tier]
          )
        }
      }
    }
  })

  it('does not cap the ECR at 99: a Celestial Seal on a 99 vessel is 138.6', () => {
    expect(effectiveContestRating(vessel(flat(99), [seal('matter', 'Celestial')]), 0)).toBe(138.6)
  })

  it('uses the highest earned tier among matching Seals, not the first, last or sum', () => {
    const seals = [
      seal('matter', 'Silver', 'a'),
      seal('matter', 'Astral', 'b'),
      seal('matter', 'Copper', 'c'),
    ]
    expect(effectiveContestRating(vessel(flat(50), seals), 0)).toBe(64)
    expect(effectiveContestRating(vessel(flat(50), [...seals].reverse()), 0)).toBe(64)
  })

  it('takes the best tier per token whatever order the Seals come in', () => {
    const seals = [
      seal('matter', 'Silver', 'm1'),
      seal('matter', 'Gold', 'm2'),
      seal('spirit', 'Celestial', 's1'),
      seal('spirit', 'Copper', 's2'),
      seal('essence', 'Astral', 'e1'),
      seal('general', 'Celestial', 'g1'),
    ]
    const permutations = (items: readonly AlchemicalSeal[]): AlchemicalSeal[][] =>
      items.length <= 1
        ? [[...items]]
        : items.flatMap((item, i) =>
            permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest])
          )
    const all = permutations(seals)
    expect(all).toHaveLength(720)
    // zone 0 Earth/matter → Gold, zone 2 Fire/spirit → Celestial, zone 3 Water/essence → Astral,
    // zone 1 Air/substance → none.
    const expected: Record<number, number> = { 0: 59, 2: 70, 3: 64, 1: 50 }
    for (const ordering of all) {
      for (const [zoneId, ecr] of Object.entries(expected)) {
        expect(effectiveContestRating(vessel(flat(50), ordering), Number(zoneId))).toBe(ecr)
      }
    }
  })

  it('picks a different best tier in different zones from one set of Seals', () => {
    const seals = [seal('spirit', 'Copper'), seal('matter', 'Celestial'), seal('essence', 'Gold')]
    const synergies = computeZoneSynergies(vessel(flat(100), seals))
    expect(synergies.map(s => s.synergy)).toEqual([
      138.6, // 0  Earth/matter, Celestial 1.40 on 99
      99, // 1  Air/substance, none
      103.95, // 2  Fire/spirit, Copper 1.05
      116.82, // 3  Water/essence, Gold 1.18
      138.6, // 4  Earth
      138.6, // 5  Earth
      99, // 6  Air
      103.95, // 7  Fire
      103.95, // 8  Fire
      116.82, // 9  Water
      116.82, // 10 Water
    ])
  })

  it('does not stack two Seals of the same tier', () => {
    const seals = [seal('matter', 'Gold', 'a'), seal('matter', 'Gold', 'b')]
    expect(effectiveContestRating(vessel(flat(50), seals), 0)).toBe(59)
  })

  it('counts only Seals of the zone’s token: another token never helps', () => {
    const celestialElsewhere = [
      seal('spirit', 'Celestial'),
      seal('essence', 'Celestial'),
      seal('substance', 'Celestial'),
    ]
    expect(effectiveContestRating(vessel(flat(50), celestialElsewhere), 0)).toBe(50)
    // …while the same Seals do count in the zones of their own elements.
    expect(effectiveContestRating(vessel(flat(50), celestialElsewhere), 2)).toBe(70) // Fire/spirit
    expect(effectiveContestRating(vessel(flat(50), celestialElsewhere), 3)).toBe(70) // Water/essence
    expect(effectiveContestRating(vessel(flat(50), celestialElsewhere), 1)).toBe(70) // Air/substance
  })

  it('pairs every zone with exactly its own token', () => {
    for (const profile of ZONE_PROFILES) {
      for (const token of TOKENS) {
        const ecr = effectiveContestRating(vessel(flat(50), [seal(token, 'Gold')]), profile.zoneId)
        expect(ecr, `${profile.label}/${token}`).toBe(token === profile.esmsToken ? 59 : 50)
      }
    }
  })

  it('gives a "general" Seal to no zone, at any tier', () => {
    for (const tier of TIERS) {
      for (const zoneId of ZONE_IDS) {
        const general = vessel(flat(50), [seal('general', tier)])
        expect(effectiveContestRating(general, zoneId), `${tier}/${zoneId}`).toBe(50)
      }
    }
  })

  it('lets a "general" Seal sit beside real ones without disturbing them', () => {
    const seals = [seal('general', 'Celestial', 'g'), seal('matter', 'Copper', 'm')]
    expect(effectiveContestRating(vessel(flat(50), seals), 0)).toBe(52.5)
    expect(effectiveContestRating(vessel(flat(50), [...seals].reverse()), 0)).toBe(52.5)
    // …and a general Seal alone is not a matter Seal.
    expect(effectiveContestRating(vessel(flat(50), [seals[0]]), 0)).toBe(50)
  })

  it('uses the contract’s multiplier for the tier, not whatever the Seal object claims', () => {
    const inflated: AlchemicalSeal = { ...seal('matter', 'Gold'), multiplier: 9 }
    const deflated: AlchemicalSeal = { ...seal('matter', 'Gold'), multiplier: 0 }
    expect(effectiveContestRating(vessel(flat(50), [inflated]), 0)).toBe(59)
    expect(effectiveContestRating(vessel(flat(50), [deflated]), 0)).toBe(59)
  })

  it('multiplies the weighted sum, not a rating: a 60 vessel under Silver is 66', () => {
    expect(effectiveContestRating(vessel(flat(60), [seal('spirit', 'Silver')]), 7)).toBe(66)
  })

  it('starts every token at no Seal: a vessel with none scores its bare weighted sum', () => {
    for (const zoneId of ZONE_IDS) {
      expect(effectiveContestRating(vessel(flat(80), []), zoneId)).toBe(80)
    }
  })

  it('lands each canonical contract Seal on exactly the zones of its token', () => {
    for (const stat of STATS) {
      const canonical = buildCanonicalSeal(stat, 'Gold')
      for (const zoneId of ZONE_IDS) {
        const ecr = effectiveContestRating(vessel(flat(50), [canonical]), zoneId)
        expect(ecr, `${stat}/${zoneId}`).toBe(
          TOKEN_OF_ZONE[zoneId] === CANONICAL_TOKEN[stat] ? 59 : 50
        )
      }
    }
  })

  it('reads a contract Seal list as the pipeline builds it, with the best per token winning', () => {
    const earned = [
      buildCanonicalSeal('wisdom', 'Astral'), // matter
      buildCanonicalSeal('vitality', 'Copper'), // matter
      buildCanonicalSeal('charisma', 'Gold'), // essence
      buildCanonicalSeal('resonance', 'Silver'), // essence
      buildCanonicalSeal('intuition', 'Celestial'), // spirit
    ]
    const v = vessel(flat(50), earned)
    expect(effectiveContestRating(v, 0)).toBe(64) // matter: Astral
    expect(effectiveContestRating(v, 3)).toBe(59) // essence: Gold
    expect(effectiveContestRating(v, 7)).toBe(70) // spirit: Celestial
    expect(effectiveContestRating(v, 1)).toBe(50) // substance: none
  })

  it('works on the Seals evaluateSeals and earnedSeals actually produce', () => {
    const rich = { spirit: 1000, essence: 1000, matter: 1000, substance: 1000 }
    const everyStatMaxed = {
      power: 100,
      resonance: 100,
      wisdom: 100,
      charisma: 100,
      intuition: 100,
      adaptability: 100,
      vitality: 100,
    }
    const earned = earnedSeals(evaluateSeals({ stats: everyStatMaxed, esmsBalances: rich }))
    expect(earned.length).toBeGreaterThan(0)
    const tierRank = (tier: SealTier): number => TIERS.indexOf(tier)
    for (const profile of ZONE_PROFILES) {
      const matching = earned.filter(s => s.category === profile.esmsToken)
      const best = matching.reduce<SealTier | null>(
        (top, s) => (top === null || tierRank(s.tier) > tierRank(top) ? s.tier : top),
        null
      )
      const multiplier = best === null ? 1 : EXPECTED_MULTIPLIER[best]
      expect(effectiveContestRating(vessel(flat(99), earned), profile.zoneId), profile.label).toBe(
        Math.round(99 * multiplier * 100) / 100
      )
    }
  })

  it('throws RangeError on a Seal with an unknown tier, whichever zone is asked', () => {
    const unknownTiers: unknown[] = [
      'Platinum',
      'gold',
      'GOLD',
      '',
      RETIRED_TIER,
      'constructor',
      2,
      null,
      undefined,
    ]
    for (const tier of unknownTiers) {
      const bad = { ...seal('spirit', 'Gold', 'bad-seal'), tier } as unknown as AlchemicalSeal
      for (const zoneId of ZONE_IDS) {
        const call = () => effectiveContestRating(vessel(flat(50), [bad]), zoneId)
        expect(call, `tier ${String(tier)} zone ${zoneId}`).toThrow(RangeError)
        expect(call).toThrow(/unknown tier/)
        expect(call).toThrow(/bad-seal/)
      }
    }
  })

  it('throws RangeError on a Seal with an unknown category, whichever zone is asked', () => {
    const unknownCategories: unknown[] = [
      'Fire',
      'SPIRIT',
      'spirit ',
      '',
      RETIRED_TIER.toLowerCase(),
      'constructor',
      7,
      null,
      undefined,
    ]
    for (const category of unknownCategories) {
      const bad = { ...seal('spirit', 'Gold', 'bad-seal'), category } as unknown as AlchemicalSeal
      for (const zoneId of ZONE_IDS) {
        const call = () => effectiveContestRating(vessel(flat(50), [bad]), zoneId)
        expect(call, `category ${String(category)} zone ${zoneId}`).toThrow(RangeError)
        expect(call).toThrow(/unknown token/)
        expect(call).toThrow(/bad-seal/)
      }
    }
  })

  it('finds a bad Seal anywhere in the list, even one that matches no zone being asked about', () => {
    const bad = { ...seal('spirit', 'Gold', 'late'), tier: 'Platinum' } as unknown as AlchemicalSeal
    const seals = [seal('matter', 'Copper', 'a'), seal('essence', 'Gold', 'b'), bad]
    for (const zoneId of ZONE_IDS) {
      expect(() => effectiveContestRating(vessel(flat(50), seals), zoneId)).toThrow(RangeError)
    }
  })

  it('checks a "general" Seal’s tier too: it cannot hide a broken tier', () => {
    const bad = { ...seal('general', 'Gold', 'g'), tier: 'Platinum' } as unknown as AlchemicalSeal
    for (const zoneId of ZONE_IDS) {
      expect(() => effectiveContestRating(vessel(flat(50), [bad]), zoneId)).toThrow(/unknown tier/)
    }
  })

  it('throws before it scores: a bad Seal never produces a number', () => {
    const bad = { ...seal('matter', 'Gold', 'bad'), tier: undefined } as unknown as AlchemicalSeal
    expect(() => computeZoneSynergies(vessel(flat(50), [bad]))).toThrow(RangeError)
    expect(() => bestZoneId(vessel(flat(50), [bad]))).toThrow(RangeError)
    expect(() => resolveZoneContest(vessel(flat(50), [bad]), vessel(flat(50)), 0, 50)).toThrow(
      RangeError
    )
    expect(() => resolveZoneContest(vessel(flat(50)), vessel(flat(50), [bad]), 0, 50)).toThrow(
      RangeError
    )
  })
})

describe('effectiveContestRating: Resonance Surge', () => {
  it('adds an active surge’s boosts, in rating points, to the ratings before weighting', () => {
    // Crown weighs resonance and charisma at .19 each: 60 + .19·10 + .19·10 = 63.8.
    const v = vessel(flat(60), [], surgeOf(true, { resonance: 10, charisma: 10 }))
    expect(effectiveContestRating(v, 10)).toBe(63.8)
  })

  it('contributes nothing while inactive, even with boosts over all seven stats', () => {
    const v = vessel(
      flat(60),
      [],
      surgeOf(false, contractBoosts('equilibrium', 'power', 'charisma'))
    )
    for (const zoneId of ZONE_IDS) expect(effectiveContestRating(v, zoneId)).toBe(60)
  })

  it('treats a null, absent or empty surge as no surge', () => {
    const base = effectiveContestRating({ ratings: flat(61), seals: [] }, 6)
    expect(base).toBe(61)
    expect(effectiveContestRating(vessel(flat(61), [], null), 6)).toBe(base)
    expect(effectiveContestRating(vessel(flat(61), [], surgeOf(true, {})), 6)).toBe(base)
    expect(effectiveContestRating({ ratings: flat(61), seals: [], surge: undefined }, 6)).toBe(base)
  })

  it('applies boosts over all seven stats, as the contract shapes them (inferno)', () => {
    // flat 60 under inferno boosts (power +12, charisma +8, the rest +4): power 72, charisma 68,
    // the other five 64.
    const v = vessel(flat(60), [], surgeOf(true, contractBoosts('inferno', 'power', 'charisma')))
    // Crown: 60 + .12·12 + .19·8 + (1 − .12 − .19)·4 = 60 + 1.44 + 1.52 + 2.76
    expect(effectiveContestRating(v, 10)).toBe(65.72)
    // Spire SE: 60 + .10·12 + .10·8 + .80·4
    expect(effectiveContestRating(v, 7)).toBe(65.2)
    // House SE-SW: 60 + .35·12 + .20·8 + .45·4
    expect(effectiveContestRating(v, 2)).toBe(67.6)
  })

  it('matches the integer oracle in every zone for inferno and equilibrium over all stats', () => {
    for (const kind of ['inferno', 'equilibrium'] as const) {
      const v = vessel(
        flat(61, { wisdom: 70, vitality: 45 }),
        [],
        surgeOf(true, contractBoosts(kind, 'wisdom', 'vitality'))
      )
      for (const zoneId of ZONE_IDS) expectEcr(effectiveContestRating(v, zoneId), v, zoneId, kind)
    }
  })

  it('holds boosted ratings at 99: equilibrium on a flat 90 is 98 plus a sliver', () => {
    // power 90 + 16 → 99 and charisma 90 + 12 → 99 (not 106 and 102); the other five are 98.
    const v = vessel(
      flat(90),
      [],
      surgeOf(true, contractBoosts('equilibrium', 'power', 'charisma'))
    )
    expect(effectiveContestRating(v, 10)).toBe(98.31) // 98 + .12 + .19
    expect(effectiveContestRating(v, 7)).toBe(98.2) // 98 + .10 + .10
    expect(effectiveContestRating(v, 2)).toBe(98.55) // 98 + .35 + .20
  })

  it('holds a boosted rating at 99, not 100 or more', () => {
    // resonance 99 and charisma 25 + 10: Crown = .62·25 + .19·99 + .19·35 = 40.96
    const v = vessel(
      flat(25, { resonance: 95 }),
      [],
      surgeOf(true, { resonance: 10, charisma: 10 })
    )
    expect(effectiveContestRating(v, 10)).toBe(40.96)
    // A boost that would land on exactly 99, and one that overshoots by a lot, agree.
    expect(effectiveContestRating(vessel(flat(98), [], surgeOf(true, flat(1))), 4)).toBe(99)
    expect(effectiveContestRating(vessel(flat(98), [], surgeOf(true, flat(5000))), 4)).toBe(99)
  })

  it('holds a boosted rating at 25 when a negative boost drives it below the floor', () => {
    // power 30 − 20 = 10 → 25, so House ENE-SE is .65·30 + .35·25 = 28.25 (not 23).
    const v = vessel(flat(30), [], surgeOf(true, { power: -20 }))
    expect(effectiveContestRating(v, 1)).toBe(28.25)
    expect(effectiveContestRating(vessel(flat(30), [], surgeOf(true, flat(-1e9))), 1)).toBe(25)
  })

  it('rounds the boosted rating to a whole number, halves upward', () => {
    expect(effectiveContestRating(vessel(flat(60), [], surgeOf(true, flat(0.5))), 3)).toBe(61)
    expect(effectiveContestRating(vessel(flat(60), [], surgeOf(true, flat(0.4))), 3)).toBe(60)
    expect(effectiveContestRating(vessel(flat(60), [], surgeOf(true, flat(0.6))), 3)).toBe(61)
    expect(effectiveContestRating(vessel(flat(60), [], surgeOf(true, flat(-0.4))), 3)).toBe(60)
    expect(effectiveContestRating(vessel(flat(60), [], surgeOf(true, flat(-0.6))), 3)).toBe(59)
    expect(effectiveContestRating(vessel(flat(60.3), [], surgeOf(true, flat(0.3))), 3)).toBe(61)
  })

  it('matches the contract’s clampStat for every rating and boost, in every zone', () => {
    const ratings = [-10, 0, 24, 25, 25.4, 25.5, 60.4, 60.5, 98, 98.5, 99, 99.4, 120]
    const boosts = [-30, -0.5, 0, 0.5, 4, 8, 12, 16, 50]
    for (const rating of ratings) {
      for (const boost of boosts) {
        const v = vessel(flat(rating), [], surgeOf(true, flat(boost)))
        for (const zoneId of ZONE_IDS) {
          expect(effectiveContestRating(v, zoneId), `${rating}+${boost}/${zoneId}`).toBe(
            clampStat(rating + boost)
          )
        }
      }
    }
  })

  it('boosts only the stats it names', () => {
    const v = vessel(flat(60), [], surgeOf(true, { intuition: 10 }))
    // Spire SE weighs intuition at .35: 60 + 3.5.
    expect(effectiveContestRating(v, 7)).toBe(63.5)
    // The Crown weighs it at .13: 60 + 1.3.
    expect(effectiveContestRating(v, 10)).toBe(61.3)
  })

  it('treats a stat whose boost is absent or undefined as unboosted', () => {
    const v = vessel(
      flat(60),
      [],
      surgeOf(true, { power: undefined, intuition: 10 } as unknown as Partial<Ratings>)
    )
    expect(effectiveContestRating(v, 7)).toBe(63.5)
  })

  it('ignores boost keys that are not Sacred 7 stats', () => {
    const odd = { intuition: 10, mystery: Number.NaN, kalchm: 50 } as unknown as Partial<Ratings>
    expect(effectiveContestRating(vessel(flat(60), [], surgeOf(true, odd)), 7)).toBe(63.5)
  })

  it('applies the surge before the Seal multiplier', () => {
    // (60 + 3.8) · 1.18 = 75.284 → 75.28, in the Water Crown with an Essence Gold Seal.
    const v = vessel(
      flat(60),
      [seal('essence', 'Gold')],
      surgeOf(true, { resonance: 10, charisma: 10 })
    )
    expect(effectiveContestRating(v, 10)).toBe(75.28)
  })

  it('works with a surge evaluateSurgeState produced, active and idle', () => {
    const active = evaluateSurgeState(80, 0.9, 0.5, 'power', 'charisma', null)
    expect(effectiveContestRating(vessel(flat(60), [], active), 2)).toBe(67.6)
    const idle = evaluateSurgeState(69, 0.9, 0.5, 'power', 'charisma', null)
    expect(effectiveContestRating(vessel(flat(60), [], idle), 2)).toBe(60)
    const equilibrium = evaluateSurgeState(95, 0.8, 0.8, 'power', 'charisma', 1.618)
    // flat 90: power and charisma hold at 99, the rest are 98.
    expect(effectiveContestRating(vessel(flat(90), [], equilibrium), 2)).toBe(98.55)
  })

  it('works with a surge calculateResonanceSurge actually produced', () => {
    // Drive both quantities to the top and the bottom of the calibration, whatever it is pinned
    // at: a full sky meter is an active heat-led surge, an empty one is inactive.
    const { heat, reactivity } = DEFAULT_SURGE_CALIBRATION
    const archetype = { primary: 'wisdom', secondary: 'intuition' } as const
    const live = calculateResonanceSurge({
      thermodynamics: { heat: heat.high, reactivity: reactivity.high },
      archetype,
    })
    expect(live.active).toBe(true)
    expect(live.statBoosts).toEqual(contractBoosts('inferno', 'wisdom', 'intuition'))
    // Spire SE weighs wisdom .20 and intuition .35: 60 + .20·12 + .35·8 + (1 − .55)·4 = 67.
    expect(effectiveContestRating(vessel(flat(60), [], live), 7)).toBe(67)

    const quiet = calculateResonanceSurge({
      thermodynamics: { heat: heat.low, reactivity: reactivity.low },
      archetype,
    })
    expect(quiet.active).toBe(false)
    expect(quiet.statBoosts).toEqual({})
    expect(effectiveContestRating(vessel(flat(60), [], quiet), 7)).toBe(60)
  })

  it('throws, naming the stat, if an active boost is not finite', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      const v = vessel(flat(50), [], surgeOf(true, { power: bad }))
      expect(() => effectiveContestRating(v, 1)).toThrow(RangeError)
      expect(() => effectiveContestRating(v, 1)).toThrow(/power/)
      expect(() => effectiveContestRating(v, 1)).toThrow(/after surge boosts/)
    }
  })

  it('throws when finite ratings and boosts overflow together', () => {
    const v = vessel(flat(Number.MAX_VALUE), [], surgeOf(true, { wisdom: Number.MAX_VALUE }))
    expect(() => effectiveContestRating(v, 5)).toThrow(RangeError)
    expect(() => effectiveContestRating(v, 5)).toThrow(/wisdom/)
  })

  it('does not look at the boosts of an inactive surge, so a bad one is harmless', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      const v = vessel(flat(50), [], surgeOf(false, { power: bad }))
      expect(effectiveContestRating(v, 1)).toBe(50)
    }
  })
})

describe('effectiveContestRating: RangeError cases', () => {
  it.each([-1, 11, 12, 100, 1.5, 0.1, Number.NaN, Infinity, -Infinity])(
    'rejects zone %s',
    zoneId => {
      expect(() => effectiveContestRating(vessel(flat(50)), zoneId)).toThrow(RangeError)
    }
  )

  it('rejects a zone id that is not a number', () => {
    for (const bad of ['3', 'length', null, undefined, true, [], {}]) {
      expect(() => effectiveContestRating(vessel(flat(50)), bad as unknown as number)).toThrow(
        RangeError
      )
    }
  })

  it('names the bad zone and the valid range', () => {
    expect(() => effectiveContestRating(vessel(flat(50)), 11)).toThrow(/Unknown zone 11/)
    expect(() => effectiveContestRating(vessel(flat(50)), 11)).toThrow(/0 to 10/)
  })

  it('accepts every integer from 0 to 10', () => {
    for (const zoneId of ZONE_IDS) {
      expect(() => effectiveContestRating(vessel(flat(50)), zoneId)).not.toThrow()
    }
  })

  it.each(STATS)('rejects a non-finite %s rating and names it', key => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      expect(() => effectiveContestRating(vessel(flat(50, { [key]: bad })), 0)).toThrow(RangeError)
      expect(() => effectiveContestRating(vessel(flat(50, { [key]: bad })), 0)).toThrow(
        new RegExp(key)
      )
      // It is the rating that is blamed, not a surge boost that was never there.
      expect(() => effectiveContestRating(vessel(flat(50, { [key]: bad })), 0)).toThrow(
        /is not a finite number/
      )
    }
  })

  it('rejects a rating that is not a number rather than coercing it', () => {
    for (const bad of ['50', null, true, [], {}]) {
      const v = vessel(flat(50, { wisdom: bad as unknown as number }))
      expect(() => effectiveContestRating(v, 0)).toThrow(RangeError)
    }
  })

  it('rejects a missing rating rather than rating it as the floor', () => {
    for (const key of STATS) {
      const missing = { ...flat(50) } as Partial<Ratings>
      delete missing[key]
      expect(() => effectiveContestRating(vessel(missing as Ratings), 0), key).toThrow(RangeError)
    }
  })

  it('reports a non-finite rating even when a surge would have been active', () => {
    const v = vessel(flat(50, { power: Number.NaN }), [], surgeOf(true, { power: 10 }))
    expect(() => effectiveContestRating(v, 0)).toThrow(/not a finite number/)
  })

  it('accepts finite ratings outside 25..99 and clamps them rather than throwing', () => {
    expect(() => effectiveContestRating(vessel(flat(-1e9)), 0)).not.toThrow()
    expect(effectiveContestRating(vessel(flat(1e9)), 0)).toBe(99)
    expect(effectiveContestRating(vessel(flat(-1e9)), 0)).toBe(25)
  })

  it('throws the same way from computeZoneSynergies, bestZoneId and resolveZoneContest', () => {
    const broken = vessel(flat(50, { power: Number.NaN }))
    expect(() => computeZoneSynergies(broken)).toThrow(RangeError)
    expect(() => bestZoneId(broken)).toThrow(RangeError)
    expect(() => resolveZoneContest(broken, vessel(flat(50)), 0, 50)).toThrow(RangeError)
    expect(() => resolveZoneContest(vessel(flat(50)), broken, 0, 50)).toThrow(RangeError)
    expect(() => resolveZoneContest(vessel(flat(50)), vessel(flat(50)), 11, 50)).toThrow(RangeError)
  })
})

// ─── Contest resolution ──────────────────────────────────────────────────────

describe('resolveZoneContest: constants', () => {
  it('exports the swing parameters', () => {
    expect(CONTROL_GAIN).toBe(2)
    expect(MAX_CONTROL_SWING).toBe(40)
  })
})

describe('resolveZoneContest: outcomes', () => {
  const duel = (attackerBase: number, defenderBase: number, control = 50) =>
    resolveZoneContest(vessel(flat(attackerBase)), vessel(flat(defenderBase)), 4, control)

  it('gives the attacker the win, and control, when its ECR is higher', () => {
    // 70 vs 65: margin 5, 5/70·100·2 = 14.29 → 14.
    expect(duel(70, 65)).toEqual({
      winner: 'attacker',
      attackerScore: 70,
      defenderScore: 65,
      margin: 5,
      controlDelta: 14,
      nextControl: 64,
    })
  })

  it('gives the defender the win when its ECR is higher, with a negative delta', () => {
    // 60 vs 66: margin 6, 6/66·100·2 = 18.18 → 18.
    expect(duel(60, 66)).toEqual({
      winner: 'defender',
      attackerScore: 60,
      defenderScore: 66,
      margin: 6,
      controlDelta: -18,
      nextControl: 32,
    })
  })

  it('calls equal ECRs a draw: nothing moves, and the delta is a plain 0', () => {
    const result = duel(55, 55, 37)
    expect(result).toEqual({
      winner: 'draw',
      attackerScore: 55,
      defenderScore: 55,
      margin: 0,
      controlDelta: 0,
      nextControl: 37,
    })
    expect(Object.is(result.controlDelta, 0)).toBe(true)
  })

  it('calls different rating blocks a draw when the zone weighs them equally', () => {
    // House WNW-N (zone 4) weighs power and vitality both at .30: 25 + .30 × 74 = 47.2 either way.
    const result = resolveZoneContest(vessel(oneHot('power')), vessel(oneHot('vitality')), 4, 50)
    expect(result.winner).toBe('draw')
    expect(result.attackerScore).toBe(47.2)
    expect(result.defenderScore).toBe(47.2)
  })

  it('decides the same two vessels differently in different zones', () => {
    const power = vessel(oneHot('power'))
    const vitality = vessel(oneHot('vitality'))
    // House N-ENE: power .25 against vitality .35.
    expect(resolveZoneContest(power, vitality, 0, 50).winner).toBe('defender')
    // House ENE-SE: power .35 against vitality .25.
    expect(resolveZoneContest(power, vitality, 1, 50).winner).toBe('attacker')
    // House WNW-N: level.
    expect(resolveZoneContest(power, vitality, 4, 50).winner).toBe('draw')
  })

  it('computes the swing from margin over the larger score: 1 against 51 is 4', () => {
    // 1/51·100·2 = 3.92 → 4.
    expect(duel(51, 50).controlDelta).toBe(4)
    expect(duel(50, 51).controlDelta).toBe(-4)
  })

  it('rounds the swing as a magnitude, so half-way cases are the same size both ways', () => {
    // 75 vs 80: 5/80·100·2 = 12.5 exactly. Math.round would give 13 for +12.5 but 12 for −12.5.
    expect(duel(80, 75).controlDelta).toBe(13)
    expect(duel(75, 80).controlDelta).toBe(-13)
  })

  it('caps the swing at MAX_CONTROL_SWING', () => {
    // 80 vs 60: 20/80·100·2 = 50 → 40.
    expect(duel(80, 60).controlDelta).toBe(MAX_CONTROL_SWING)
    expect(duel(60, 80).controlDelta).toBe(-MAX_CONTROL_SWING)
    expect(duel(99, 25).controlDelta).toBe(MAX_CONTROL_SWING)
    expect(duel(25, 99).controlDelta).toBe(-MAX_CONTROL_SWING)
  })

  it('reaches the cap exactly at a 20% relative margin and not before', () => {
    // 80 vs 64: 16/80 = 20% → 40 exactly. 80 vs 65: 15/80·200 = 37.5 → 38.
    expect(duel(80, 64).controlDelta).toBe(40)
    expect(duel(80, 65).controlDelta).toBe(38)
  })

  it('lets a winner by under a rounding step carry a delta of 0, never −0', () => {
    // Crown (zone 10) weighs power at .12: 60.12 against 60, margin 0.12; 0.12/60.12·200 = 0.4 → 0.
    const stronger = vessel(flat(60, { power: 61 }))
    const level = vessel(flat(60))
    const attacker = resolveZoneContest(stronger, level, 10, 50)
    expect(attacker).toEqual({
      winner: 'attacker',
      attackerScore: 60.12,
      defenderScore: 60,
      margin: 0.12,
      controlDelta: 0,
      nextControl: 50,
    })
    expect(Object.is(attacker.controlDelta, 0)).toBe(true)

    const defender = resolveZoneContest(level, stronger, 10, 50)
    expect(defender.winner).toBe('defender')
    expect(defender.margin).toBe(0.12)
    expect(Object.is(defender.controlDelta, 0)).toBe(true)
    expect(defender.nextControl).toBe(50)
  })

  it('reports the two ECRs and a 2-dp margin', () => {
    // Crown: flat 60 with resonance 62 → 60 + .19·2 = 60.38; flat 60 with power 61 → 60.12.
    const result = resolveZoneContest(
      vessel(flat(60, { resonance: 62 })),
      vessel(flat(60, { power: 61 })),
      10,
      50
    )
    expect(result.attackerScore).toBe(60.38)
    expect(result.defenderScore).toBe(60.12)
    expect(result.margin).toBe(0.26)
    expect(result.controlDelta).toBe(1) // 0.26/60.38·200 = 0.86 → 1
    expect(result.nextControl).toBe(51)
  })

  it('lets a matching Seal decide a contest between equal ratings', () => {
    // Zone 0 is Earth/matter. Gold: 59 against 50, margin 9, 9/59·200 = 30.51 → 31.
    const result = resolveZoneContest(
      vessel(flat(50), [seal('matter', 'Gold')]),
      vessel(flat(50)),
      0,
      50
    )
    expect(result).toMatchObject({
      winner: 'attacker',
      attackerScore: 59,
      defenderScore: 50,
      margin: 9,
      controlDelta: 31,
      nextControl: 81,
    })
    // A Seal of another element changes nothing, and neither does a general one.
    for (const category of ['spirit', 'general'] as const) {
      const wrong = resolveZoneContest(
        vessel(flat(50), [seal(category, 'Celestial')]),
        vessel(flat(50)),
        0,
        50
      )
      expect(wrong.winner).toBe('draw')
    }
  })

  it('lets the defender’s Seal win a contest too', () => {
    const result = resolveZoneContest(
      vessel(flat(50)),
      vessel(flat(50), [seal('matter', 'Gold')]),
      0,
      50
    )
    expect(result).toMatchObject({ winner: 'defender', controlDelta: -31, nextControl: 19 })
  })

  it('lets an active surge decide a contest between equal ratings, and an inactive one not', () => {
    const boosted = vessel(flat(50), [], surgeOf(true, { resonance: 10, charisma: 10 }))
    const idle = vessel(flat(50), [], surgeOf(false, { resonance: 10, charisma: 10 }))
    const won = resolveZoneContest(boosted, vessel(flat(50)), 10, 50)
    expect(won.winner).toBe('attacker')
    expect(won.attackerScore).toBe(53.8)
    expect(won.margin).toBe(3.8)
    expect(won.controlDelta).toBe(14) // 3.8/53.8·200 = 14.1
    expect(resolveZoneContest(idle, vessel(flat(50)), 10, 50).winner).toBe('draw')
  })

  it('treats ratings beyond the scale as its edges, so 120 against 99 is a draw', () => {
    expect(duel(120, 99).winner).toBe('draw')
    expect(duel(10, 25).winner).toBe('draw')
  })
})

describe('resolveZoneContest: control', () => {
  const attackerWins = (control: number) =>
    resolveZoneContest(vessel(flat(70)), vessel(flat(65)), 4, control) // +14
  const defenderWins = (control: number) =>
    resolveZoneContest(vessel(flat(60)), vessel(flat(66)), 4, control) // −18

  it('adds the delta to the attacker’s share', () => {
    expect(attackerWins(20).nextControl).toBe(34)
    expect(defenderWins(70).nextControl).toBe(52)
  })

  it('clamps at 100 when the attacker wins past full control', () => {
    expect(attackerWins(95).nextControl).toBe(100)
    expect(attackerWins(100).nextControl).toBe(100)
    expect(attackerWins(86).nextControl).toBe(100) // 86 + 14 lands exactly on the edge
    expect(attackerWins(85).nextControl).toBe(99)
  })

  it('clamps at 0 when the defender wins past zero', () => {
    expect(defenderWins(10).nextControl).toBe(0)
    expect(defenderWins(0).nextControl).toBe(0)
    expect(defenderWins(18).nextControl).toBe(0)
    expect(defenderWins(19).nextControl).toBe(1)
  })

  it('keeps controlDelta as the swing that was earned, not the part that was applied', () => {
    expect(attackerWins(95).controlDelta).toBe(14)
    expect(defenderWins(10).controlDelta).toBe(-18)
  })

  it('moves a full 40 in one contest from the middle', () => {
    const result = resolveZoneContest(vessel(flat(90)), vessel(flat(30)), 4, 50)
    expect(result.controlDelta).toBe(40)
    expect(result.nextControl).toBe(90)
  })

  it('keeps a fractional share exact: 33.5 + 14', () => {
    expect(attackerWins(33.5).nextControl).toBe(47.5)
  })

  it('leaves a draw’s share exactly where it was, fractional or at an edge', () => {
    for (const control of [0, 12.5, 100]) {
      const draw = resolveZoneContest(vessel(flat(55)), vessel(flat(55)), 4, control)
      expect(draw.nextControl).toBe(control)
    }
  })

  it('accepts 0 and 100 as valid control', () => {
    expect(() => attackerWins(0)).not.toThrow()
    expect(() => attackerWins(100)).not.toThrow()
  })

  it.each([-1, -0.0001, 100.0001, 101, Number.NaN, Infinity, -Infinity])(
    'rejects control %s with a RangeError',
    control => {
      expect(() => attackerWins(control)).toThrow(RangeError)
      expect(() => attackerWins(control)).toThrow(/currentControl/)
    }
  )

  it('rejects control that is not a number', () => {
    expect(() => attackerWins('50' as unknown as number)).toThrow(RangeError)
    expect(() => attackerWins(undefined as unknown as number)).toThrow(RangeError)
    expect(() => attackerWins(null as unknown as number)).toThrow(RangeError)
  })

  it('rejects an unknown zone with a RangeError, whatever the vessels are', () => {
    for (const zoneId of [-1, 11, 2.5, Number.NaN]) {
      expect(() => resolveZoneContest(vessel(flat(50)), vessel(flat(50)), zoneId, 50)).toThrow(
        RangeError
      )
    }
  })
})

describe('resolveZoneContest: properties over seeded random contests', () => {
  const CASES = 500

  it('is internally consistent: winner, margin, delta sign and bounds, control range', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < CASES; i++) {
      const a = randomVessel(rng)
      const d = randomVessel(rng)
      const zoneId = Math.floor(rng() * 11)
      const control = Math.floor(rng() * 101)
      const r = resolveZoneContest(a, d, zoneId, control)

      expect(r.attackerScore).toBe(effectiveContestRating(a, zoneId))
      expect(r.defenderScore).toBe(effectiveContestRating(d, zoneId))
      expect(r.winner).toBe(
        r.attackerScore > r.defenderScore
          ? 'attacker'
          : r.defenderScore > r.attackerScore
            ? 'defender'
            : 'draw'
      )
      expect(r.margin).toBeCloseTo(Math.abs(r.attackerScore - r.defenderScore), 9)
      expect(r.margin).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(r.controlDelta)).toBe(true)
      expect(Math.abs(r.controlDelta)).toBeLessThanOrEqual(MAX_CONTROL_SWING)
      if (r.winner === 'attacker') expect(r.controlDelta).toBeGreaterThanOrEqual(0)
      if (r.winner === 'defender') expect(r.controlDelta).toBeLessThanOrEqual(0)
      if (r.winner === 'draw') expect(Object.is(r.controlDelta, 0)).toBe(true)
      expect(Object.is(r.controlDelta, -0)).toBe(false)
      expect(r.nextControl).toBe(Math.min(100, Math.max(0, control + r.controlDelta)))
    }
  })

  it('recomputes the swing from the published formula', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < CASES; i++) {
      const a = randomVessel(rng)
      const d = randomVessel(rng)
      const zoneId = Math.floor(rng() * 11)
      const r = resolveZoneContest(a, d, zoneId, 50)
      const raw = (r.margin / Math.max(r.attackerScore, r.defenderScore)) * 100 * CONTROL_GAIN
      const swing = Math.round(Math.min(MAX_CONTROL_SWING, raw))
      const expected = r.winner === 'attacker' ? swing : r.winner === 'defender' ? -swing : 0
      expect(r.controlDelta === expected).toBe(true) // === so that 0 and −0 would both pass; −0 is checked above
    }
  })

  it('is symmetric: swapping the vessels and mirroring control mirrors the result', () => {
    const rng = mulberry32(31337)
    const flip = { attacker: 'defender', defender: 'attacker', draw: 'draw' } as const
    for (let i = 0; i < CASES; i++) {
      const a = randomVessel(rng)
      const d = randomVessel(rng)
      const zoneId = Math.floor(rng() * 11)
      const control = Math.floor(rng() * 101)
      const forward = resolveZoneContest(a, d, zoneId, control)
      const mirrored = resolveZoneContest(d, a, zoneId, 100 - control)

      expect(mirrored.winner).toBe(flip[forward.winner])
      expect(mirrored.attackerScore).toBe(forward.defenderScore)
      expect(mirrored.defenderScore).toBe(forward.attackerScore)
      expect(mirrored.margin).toBe(forward.margin)
      expect(mirrored.controlDelta === -forward.controlDelta).toBe(true)
      expect(mirrored.nextControl).toBe(100 - forward.nextControl)
    }
  })

  it('is pure: the same inputs give the same result, and the inputs are untouched', () => {
    const rng = mulberry32(5)
    for (let i = 0; i < 50; i++) {
      const a = randomVessel(rng)
      const d = randomVessel(rng)
      const before = JSON.stringify([a, d])
      const first = resolveZoneContest(a, d, 3, 42)
      expect(resolveZoneContest(a, d, 3, 42)).toEqual(first)
      expect(JSON.stringify([a, d])).toBe(before)
    }
  })
})

// ─── Zone synergies ──────────────────────────────────────────────────────────

describe('computeZoneSynergies', () => {
  it('returns one entry per zone, in zone order, carrying the zone’s identity', () => {
    const synergies = computeZoneSynergies(vessel(flat(50)))
    expect(synergies).toHaveLength(11)
    synergies.forEach((entry, index) => {
      const profile = ZONE_PROFILES[index]
      expect(entry).toEqual({
        zoneId: index,
        kind: profile.kind,
        label: profile.label,
        element: profile.element,
        esmsToken: profile.esmsToken,
        synergy: 50,
      })
    })
  })

  it('has exactly the documented fields, so the API payload cannot drift', () => {
    const [first] = computeZoneSynergies(vessel(flat(50)))
    expect(Object.keys(first).sort()).toEqual(
      ['element', 'esmsToken', 'kind', 'label', 'synergy', 'zoneId'].sort()
    )
  })

  it('is each zone’s effectiveContestRating, Seals and surge included', () => {
    const rng = mulberry32(1234)
    for (let i = 0; i < 100; i++) {
      const v = randomVessel(rng)
      const synergies = computeZoneSynergies(v)
      for (const entry of synergies) {
        expect(entry.synergy).toBe(effectiveContestRating(v, entry.zoneId))
        expectEcr(entry.synergy, v, entry.zoneId)
      }
    }
  })

  it('reflects a Seal only in the zones of its element', () => {
    const synergies = computeZoneSynergies(vessel(flat(50), [seal('spirit', 'Gold')]))
    for (const entry of synergies) {
      expect(entry.synergy, entry.label).toBe(entry.element === 'Fire' ? 59 : 50)
    }
  })

  it('reflects a "general" Seal nowhere', () => {
    const synergies = computeZoneSynergies(vessel(flat(50), [seal('general', 'Celestial')]))
    for (const entry of synergies) expect(entry.synergy, entry.label).toBe(50)
  })

  it('returns a fresh array each call', () => {
    const v = vessel(flat(50))
    const first = computeZoneSynergies(v)
    first[0].synergy = 999
    expect(computeZoneSynergies(v)[0].synergy).toBe(50)
  })
})

describe('bestZoneId', () => {
  it('picks the zone that weighs a one-hot rating most', () => {
    expect(bestZoneId(vessel(oneHot('wisdom')))).toBe(5) // Spire N, .35
    expect(bestZoneId(vessel(oneHot('adaptability')))).toBe(6) // Spire ENE, .35
    expect(bestZoneId(vessel(oneHot('intuition')))).toBe(7) // Spire SE, .35
    expect(bestZoneId(vessel(oneHot('resonance')))).toBe(3) // House SW-WNW, .20 beats the Crown's .19
    expect(bestZoneId(vessel(oneHot('charisma')))).toBe(2) // House SE-SW, .20 beats the Crown's .19
  })

  it('breaks a tie toward the lowest zone id', () => {
    expect(bestZoneId(vessel(flat(50)))).toBe(0) // every zone ties
    expect(bestZoneId(vessel(oneHot('power')))).toBe(1) // Houses 1 and 2 both weigh power .35
    expect(bestZoneId(vessel(oneHot('vitality')))).toBe(0) // Houses 0 and 3 both weigh vitality .35
  })

  it('finds the Crown for a vessel whose edge is resonance and charisma together', () => {
    // 60 everywhere with resonance and charisma at 80: Crown = 60 + 20·.38 = 67.6; the next best
    // zone (a House that weighs one of them at .20, plus a little of the other) is 65.
    const v = vessel(flat(60, { resonance: 80, charisma: 80 }))
    expect(effectiveContestRating(v, 10)).toBe(67.6)
    expect(effectiveContestRating(v, 3)).toBe(65)
    expect(effectiveContestRating(v, 2)).toBe(65)
    expect(bestZoneId(v)).toBe(10)
  })

  it('lets a Seal move the best zone', () => {
    // Flat 50 would pick zone 0 on the tie; an Air (substance) Seal pulls it to Air's first zone.
    const v = vessel(flat(50), [seal('substance', 'Gold')])
    expect(bestZoneId(v)).toBe(1)
  })

  it('lets a surge move the best zone', () => {
    // Boosting only intuition favours the zone that weighs it most: Spire SE.
    expect(bestZoneId(vessel(flat(60), [], surgeOf(true, { intuition: 20 })))).toBe(7)
    expect(bestZoneId(vessel(flat(60), [], surgeOf(false, { intuition: 20 })))).toBe(0)
  })

  it('names a zone whose synergy is the maximum', () => {
    const rng = mulberry32(808)
    for (let i = 0; i < 200; i++) {
      const v = randomVessel(rng)
      const best = bestZoneId(v)
      const synergies = computeZoneSynergies(v)
      expect(synergies[best].synergy).toBe(Math.max(...synergies.map(s => s.synergy)))
      // Lowest id among the maxima.
      expect(synergies.findIndex(s => s.synergy === synergies[best].synergy)).toBe(best)
    }
  })
})

// ─── Monotonicity ────────────────────────────────────────────────────────────

describe('monotonicity', () => {
  it('raising any rating never lowers the ECR, over seeded random vessels', () => {
    const rng = mulberry32(4242)
    for (let i = 0; i < 500; i++) {
      const v = randomVessel(rng)
      const zoneId = Math.floor(rng() * 11)
      const key = pick(rng, STATS)
      const raised = { ...v, ratings: { ...v.ratings, [key]: v.ratings[key] + rng() * 30 } }
      expect(effectiveContestRating(raised, zoneId)).toBeGreaterThanOrEqual(
        effectiveContestRating(v, zoneId)
      )
    }
  })

  it('raising a rating that a zone weighs strictly raises the ECR when it is not already clamped', () => {
    for (const zoneId of ZONE_IDS) {
      for (const key of STATS) {
        const low = effectiveContestRating(vessel(flat(40)), zoneId)
        const high = effectiveContestRating(vessel(flat(40, { [key]: 70 })), zoneId)
        expect(high, `${zoneId}/${key}`).toBeGreaterThan(low)
      }
    }
  })

  it('a rating already at the ceiling cannot be raised further', () => {
    const at = effectiveContestRating(vessel(flat(99)), 3)
    expect(effectiveContestRating(vessel(flat(99, { power: 500 })), 3)).toBe(at)
  })

  it('raising a surge boost never lowers the ECR', () => {
    const rng = mulberry32(606)
    for (let i = 0; i < 300; i++) {
      const v = randomVessel(rng)
      const zoneId = Math.floor(rng() * 11)
      const key = pick(rng, STATS)
      const boosts = { ...(v.surge?.statBoosts ?? {}) }
      const base = effectiveContestRating(
        { ...v, surge: { active: true, statBoosts: boosts } },
        zoneId
      )
      boosts[key] = (boosts[key] ?? 0) + 1 + Math.floor(rng() * 10)
      const raised = effectiveContestRating(
        { ...v, surge: { active: true, statBoosts: boosts } },
        zoneId
      )
      expect(raised).toBeGreaterThanOrEqual(base)
    }
  })

  it('a higher Seal tier never lowers the ECR, in any zone', () => {
    const rng = mulberry32(77)
    for (let i = 0; i < 300; i++) {
      const v = randomVessel(rng)
      if (v.seals.length === 0) continue
      const target = Math.floor(rng() * v.seals.length)
      const currentRank = TIERS.indexOf(v.seals[target].tier)
      const higher = TIERS[Math.min(TIERS.length - 1, currentRank + 1 + Math.floor(rng() * 3))]
      const upgraded = v.seals.map((s, index) => (index === target ? { ...s, tier: higher } : s))
      for (const zoneId of ZONE_IDS) {
        expect(effectiveContestRating({ ...v, seals: upgraded }, zoneId)).toBeGreaterThanOrEqual(
          effectiveContestRating(v, zoneId)
        )
      }
    }
  })

  it('each tier strictly beats the one below it in the zone of its own token', () => {
    for (const profile of ZONE_PROFILES) {
      let previous = effectiveContestRating(vessel(flat(80)), profile.zoneId)
      for (const tier of TIERS) {
        const next = effectiveContestRating(
          vessel(flat(80), [seal(profile.esmsToken, tier)]),
          profile.zoneId
        )
        expect(next, `${profile.label}/${tier}`).toBeGreaterThan(previous)
        previous = next
      }
    }
  })

  it('earning an extra Seal never lowers the ECR', () => {
    const rng = mulberry32(13)
    for (let i = 0; i < 300; i++) {
      const v = randomVessel(rng)
      const extra = seal(pick(rng, CATEGORIES), pick(rng, TIERS), 'extra')
      for (const zoneId of ZONE_IDS) {
        expect(
          effectiveContestRating({ ...v, seals: [...v.seals, extra] }, zoneId)
        ).toBeGreaterThanOrEqual(effectiveContestRating(v, zoneId))
      }
    }
  })

  it('with no Seals and no surge, the ECR stays within the range of the vessel’s own ratings', () => {
    const rng = mulberry32(21)
    for (let i = 0; i < 300; i++) {
      const v = { ...randomVessel(rng), seals: [], surge: null }
      const used = STATS.map(key => ratingUsed(v, key))
      const lo = Math.min(...used)
      const hi = Math.max(...used)
      for (const entry of computeZoneSynergies(v)) {
        expect(entry.synergy).toBeGreaterThanOrEqual(lo - 0.01)
        expect(entry.synergy).toBeLessThanOrEqual(hi + 0.01)
      }
    }
  })
})

// ─── The roster ──────────────────────────────────────────────────────────────

describe('roster', () => {
  /** A 0–100 stat on the rating scale, through the contract's own clamp. */
  const rosterRatings = (agent: (typeof HISTORICAL_AGENTS)[number]): Ratings => {
    const stats = deriveSacredStats(agent)
    const ratings = {} as Ratings
    for (const key of STATS) ratings[key] = clampStat(25 + (stats[key] / 100) * 74)
    return ratings
  }
  const rosterVessels = HISTORICAL_AGENTS.map(agent => ({
    id: agent.id,
    ratings: rosterRatings(agent),
  }))

  it('has enough agents to measure', () => {
    expect(rosterVessels.length).toBeGreaterThanOrEqual(20)
  })

  it('rates every agent on the contract’s integer scale', () => {
    for (const { id, ratings } of rosterVessels) {
      for (const key of STATS) {
        expect(Number.isInteger(ratings[key]), `${id}/${key}`).toBe(true)
        expect(ratings[key], `${id}/${key}`).toBeGreaterThanOrEqual(25)
        expect(ratings[key], `${id}/${key}`).toBeLessThanOrEqual(99)
      }
    }
  })

  it('gives every agent finite synergies, inside the range of its own ratings', () => {
    for (const { id, ratings } of rosterVessels) {
      const synergies = computeZoneSynergies({ ratings, seals: [] })
      expect(synergies, id).toHaveLength(11)
      const values = STATS.map(key => ratings[key])
      const lo = Math.min(...values)
      const hi = Math.max(...values)
      for (const entry of synergies) {
        expect(Number.isFinite(entry.synergy), `${id}/${entry.label}`).toBe(true)
        expect(entry.synergy, `${id}/${entry.label}`).toBeGreaterThanOrEqual(lo - 0.01)
        expect(entry.synergy, `${id}/${entry.label}`).toBeLessThanOrEqual(hi + 0.01)
      }
    }
  })

  it('lifts every zone by exactly the top multiplier when every token carries a Celestial Seal', () => {
    const celestial = TOKENS.map(token => seal(token, 'Celestial'))
    for (const { id, ratings } of rosterVessels) {
      const bare = computeZoneSynergies({ ratings, seals: [] })
      const sealed = computeZoneSynergies({ ratings, seals: celestial })
      sealed.forEach((entry, zoneId) => {
        // Integer ratings and whole-percent weights make the bare ECR exact to the cent, so the
        // two differ only by the sealed ECR's own rounding to 2 dp (half a cent at most).
        expect(
          Math.abs(entry.synergy - bare[zoneId].synergy * 1.4),
          `${id}/${entry.label}`
        ).toBeLessThanOrEqual(0.005 + 1e-9)
      })
    }
  })

  it('stays finite and inside 25..138.6 with every Seal earned and a surge up', () => {
    const celestial = TOKENS.map(token => seal(token, 'Celestial'))
    const surge = surgeOf(true, contractBoosts('equilibrium', 'power', 'charisma'))
    for (const { id, ratings } of rosterVessels) {
      for (const entry of computeZoneSynergies({ ratings, seals: celestial, surge })) {
        expect(Number.isFinite(entry.synergy), id).toBe(true)
        expect(entry.synergy, id).toBeLessThanOrEqual(138.6)
        expect(entry.synergy, id).toBeGreaterThanOrEqual(35)
      }
    }
  })

  it('does not collapse the roster onto one best zone', () => {
    const counts = new Map<number, number>()
    for (const { ratings } of rosterVessels) {
      const best = bestZoneId({ ratings, seals: [] })
      counts.set(best, (counts.get(best) ?? 0) + 1)
    }
    // Measured 2026-10-19 over the 72-agent roster on the contract's 25–99 ratings, no Seals:
    // 7 distinct best zones (1, 2, 3, 4, 7, 8, 9), the largest, House SE-SW, holding 30 of 72 (42%).
    // The Crown is best for nobody: the roster's ratings are power-heavy, so Houses win.
    expect(counts.size).toBeGreaterThanOrEqual(5)
    expect(Math.max(...counts.values()) / rosterVessels.length).toBeLessThanOrEqual(0.5)
  })

  it('has both Houses and Spires as some agent’s best zone', () => {
    const kinds = new Set(
      rosterVessels.map(({ ratings }) => ZONE_PROFILES[bestZoneId({ ratings, seals: [] })].kind)
    )
    expect(kinds.has('House')).toBe(true)
    expect(kinds.has('Spire')).toBe(true)
  })

  it('has agents whose best zone differs, and each agent’s best zone really is its maximum', () => {
    const bests = new Set<number>()
    for (const { ratings } of rosterVessels) {
      const synergies = computeZoneSynergies({ ratings, seals: [] })
      const best = bestZoneId({ ratings, seals: [] })
      bests.add(best)
      expect(synergies[best].synergy).toBe(Math.max(...synergies.map(e => e.synergy)))
    }
    expect(bests.size).toBeGreaterThan(1)
  })
})
