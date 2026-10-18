/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
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
import { CORE_STAT_KEYS, type CoreStatKey, type CoreStats } from '@/lib/agents/rating/ovr-archetype'
import {
  DEFAULT_SURGE_CALIBRATION,
  ESMS_TOKENS,
  MAX_SURGE_BOOST,
  SEAL_TIERS,
  calculateResonanceSurge,
  evaluateSeals,
  type AlchemicalSeal,
  type EsmsToken,
  type SealTier,
} from '@/lib/agents/rating/seals-surge'
import { ELEMENT_TO_ESMS, ESMS_ELEMENT } from '@/lib/staking/elements'
import { SPIRE_LABELS, zoneKind } from '@/lib/staking/pentacle-geometry'
import type { Element, EsmsId } from '@/lib/staking/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const stats = (base: number, overrides: Partial<CoreStats> = {}): CoreStats => ({
  power: base,
  resonance: base,
  wisdom: base,
  charisma: base,
  intuition: base,
  adaptability: base,
  vitality: base,
  ...overrides,
})

/** A stat block that is `value` on one stat and 0 everywhere else. */
const oneHot = (key: CoreStatKey, value = 100): CoreStats => stats(0, { [key]: value })

const makeSeal = (
  token: EsmsToken,
  tier: SealTier | null,
  id = `test-${token}`
): AlchemicalSeal => ({
  id,
  name: id,
  token,
  stat: 'power',
  tier,
  nextTier: null,
  blockedBy: [],
  statRating: 62,
  alignedRating: 62,
  balance: 0,
  natalAffinity: null,
})

const vessel = (
  s: CoreStats,
  seals: readonly AlchemicalSeal[] = [],
  surge: ContestVessel['surge'] = null
): ContestVessel => ({ stats: s, seals, surge })

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
  const s = {} as CoreStats
  // Mostly in range, with some out-of-range values so the clamp is exercised.
  for (const key of CORE_STAT_KEYS) s[key] = Math.round((rng() * 120 - 10) * 100) / 100
  const seals: AlchemicalSeal[] = []
  const sealCount = Math.floor(rng() * 6)
  for (let i = 0; i < sealCount; i++) {
    seals.push(makeSeal(pick(rng, ESMS_TOKENS), pick(rng, [null, ...SEAL_TIERS]), `seal-${i}`))
  }
  let surge: ContestVessel['surge'] = null
  if (rng() < 0.6) {
    const statBoosts: Partial<CoreStats> = {}
    for (const key of CORE_STAT_KEYS) if (rng() < 0.4) statBoosts[key] = Math.floor(rng() * 11)
    surge = { active: rng() < 0.6, statBoosts }
  }
  return { stats: s, seals, surge }
}

/** Columns follow CORE_STAT_KEYS: power · resonance · wisdom · charisma · intuition · adaptability · vitality. */
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

const EXPECTED_MULTIPLIER: Record<SealTier, number> = {
  Copper: 1.05,
  Silver: 1.1,
  Gold: 1.18,
  Aether: 1.28,
  Celestial: 1.4,
}

const TOKEN_OF_ELEMENT: Record<Element, EsmsToken> = {
  Fire: 'spirit',
  Water: 'essence',
  Earth: 'matter',
  Air: 'substance',
}

/**
 * An independent oracle for the ECR: it reads the percent table above, not `ZONE_PROFILES`, and
 * walks the tiers by rank rather than through `SEAL_TIERS.indexOf`.
 */
function referenceEcr(v: ContestVessel, zoneId: number): number {
  const boosts = v.surge && v.surge.active ? v.surge.statBoosts : {}
  let weighted = 0
  CORE_STAT_KEYS.forEach((key, i) => {
    const boosted = v.stats[key] + (boosts[key] ?? 0)
    weighted += (EXPECTED_PERCENT[zoneId][i] / 100) * Math.min(100, Math.max(0, boosted))
  })
  const token = TOKEN_OF_ELEMENT[ZONE_PROFILES[zoneId].element]
  let multiplier = 1
  for (const seal of v.seals) {
    if (seal.token !== token || seal.tier === null) continue
    multiplier = Math.max(multiplier, EXPECTED_MULTIPLIER[seal.tier])
  }
  return Math.round(weighted * multiplier * 100) / 100
}

const ZONE_IDS = ZONE_PROFILES.map(profile => profile.zoneId)

// ─── Zone profile table ──────────────────────────────────────────────────────

describe('ZONE_PROFILES', () => {
  it('has exactly 11 zones and the index is the zone id', () => {
    expect(ZONE_PROFILES).toHaveLength(11)
    ZONE_PROFILES.forEach((profile, index) => expect(profile.zoneId).toBe(index))
  })

  it('takes each zone kind from the geometry: Houses 0–4, Spires 5–9, the Crown at 10', () => {
    ZONE_PROFILES.forEach(profile => expect(profile.kind).toBe(zoneKind(profile.zoneId)))
    expect(ZONE_PROFILES.filter(p => p.kind === 'House').map(p => p.zoneId)).toEqual([
      0, 1, 2, 3, 4,
    ])
    expect(ZONE_PROFILES.filter(p => p.kind === 'Spire').map(p => p.zoneId)).toEqual([
      5, 6, 7, 8, 9,
    ])
    expect(ZONE_PROFILES.filter(p => p.kind === 'Crown').map(p => p.zoneId)).toEqual([10])
  })

  it('weights every Sacred 7 stat, none negative, summing to 1, with at least two non-zero', () => {
    for (const profile of ZONE_PROFILES) {
      expect(Object.keys(profile.weights).sort()).toEqual([...CORE_STAT_KEYS].sort())
      const values = CORE_STAT_KEYS.map(key => profile.weights[key])
      values.forEach(value => expect(value).toBeGreaterThanOrEqual(0))
      expect(Math.abs(values.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-9)
      expect(values.filter(value => value > 0).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('pins the weight table (policy): any change to a weight is a deliberate edit to both', () => {
    ZONE_PROFILES.forEach((profile, zoneId) => {
      CORE_STAT_KEYS.forEach((key, column) => {
        expect(profile.weights[key]).toBeCloseTo(EXPECTED_PERCENT[zoneId][column] / 100, 12)
      })
    })
  })

  it('gives every ESMS element at least two zones, and an element that matches its token', () => {
    const counts: Record<Element, number> = { Fire: 0, Water: 0, Earth: 0, Air: 0 }
    for (const profile of ZONE_PROFILES) {
      counts[profile.element]++
      const tokenIndex = ESMS_TOKENS.indexOf(profile.esmsToken)
      expect(tokenIndex).toBe(ELEMENT_TO_ESMS[profile.element])
      expect(ESMS_ELEMENT[tokenIndex as EsmsId]).toBe(profile.element)
    }
    for (const element of ['Fire', 'Water', 'Earth', 'Air'] as const) {
      expect(counts[element]).toBeGreaterThanOrEqual(2)
    }
    expect(counts).toEqual({ Earth: 3, Air: 2, Fire: 3, Water: 3 })
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
      const ranked = [...CORE_STAT_KEYS].sort((a, b) => house.weights[b] - house.weights[a])
      expect(new Set(ranked.slice(0, 2))).toEqual(new Set(['power', 'vitality']))
      expect(house.weights.power + house.weights.vitality).toBeCloseTo(0.6, 12)
      // The third-ranked stat is the House's own secondary emphasis.
      expect(house.weights[ranked[2]]).toBeGreaterThan(house.weights[ranked[3]])
      secondaries.add(ranked[2])
    }
    expect(secondaries.size).toBe(houses.length)
  })

  it('shapes Spires around intuition, wisdom and adaptability, with one leading each', () => {
    const spireStats: readonly CoreStatKey[] = ['intuition', 'wisdom', 'adaptability']
    const leaders = new Set<string>()
    for (const spire of ZONE_PROFILES.filter(p => p.kind === 'Spire')) {
      const ranked = [...CORE_STAT_KEYS].sort((a, b) => spire.weights[b] - spire.weights[a])
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
    const values = CORE_STAT_KEYS.map(key => crown.weights[key])
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(0.1)
    const ranked = [...CORE_STAT_KEYS].sort((a, b) => crown.weights[b] - crown.weights[a])
    expect(new Set(ranked.slice(0, 2))).toEqual(new Set(['resonance', 'charisma']))
    for (const key of CORE_STAT_KEYS) {
      if (key === 'resonance' || key === 'charisma') continue
      expect(crown.weights.resonance).toBeGreaterThan(crown.weights[key])
      expect(crown.weights.charisma).toBeGreaterThan(crown.weights[key])
    }
  })

  it('gives all 11 zones distinct weight profiles and distinct labels', () => {
    const signatures = ZONE_PROFILES.map(p => CORE_STAT_KEYS.map(key => p.weights[key]).join(','))
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
    expect(Object.isFrozen(ZONE_PROFILES[0])).toBe(true)
    expect(Object.isFrozen(ZONE_PROFILES[0].weights)).toBe(true)
    expect(() => {
      ZONE_PROFILES[0].weights.power = 1
    }).toThrow(TypeError)
  })
})

describe('SEAL_TIER_MULTIPLIERS', () => {
  it('is exactly 1.05 / 1.10 / 1.18 / 1.28 / 1.40 for Copper through Celestial', () => {
    expect(SEAL_TIER_MULTIPLIERS).toEqual(EXPECTED_MULTIPLIER)
  })

  it('rises strictly with the tier order and never falls below 1', () => {
    const values = SEAL_TIERS.map(tier => SEAL_TIER_MULTIPLIERS[tier])
    expect(values[0]).toBeGreaterThan(1)
    values.slice(1).forEach((value, i) => expect(value).toBeGreaterThan(values[i]))
  })

  it('is frozen', () => {
    expect(Object.isFrozen(SEAL_TIER_MULTIPLIERS)).toBe(true)
  })
})

// ─── Effective Contest Rating ────────────────────────────────────────────────

describe('effectiveContestRating: arithmetic', () => {
  it('scores a flat 50 vessel as exactly 50 in every zone, since weights sum to 1', () => {
    for (const zoneId of ZONE_IDS) {
      expect(effectiveContestRating(vessel(stats(50)), zoneId)).toBe(50)
    }
  })

  it('reads one-hot stats straight off the weight table in every zone', () => {
    for (const zoneId of ZONE_IDS) {
      CORE_STAT_KEYS.forEach((key, column) => {
        expect(effectiveContestRating(vessel(oneHot(key)), zoneId), `${zoneId}/${key}`).toBe(
          EXPECTED_PERCENT[zoneId][column]
        )
      })
    }
  })

  it('matches hand-computed mixed stats', () => {
    const mixed = stats(0, {
      power: 80,
      resonance: 60,
      wisdom: 40,
      charisma: 20,
      intuition: 100,
      adaptability: 0,
      vitality: 50,
    })
    // Crown .12/.19/.13/.19/.13/.12/.12: 9.6 + 11.4 + 5.2 + 3.8 + 13 + 0 + 6
    expect(effectiveContestRating(vessel(mixed), 10)).toBe(49)
    // Spire SE .10/.05/.20/.10/.35/.15/.05: 8 + 3 + 8 + 2 + 35 + 0 + 2.5
    expect(effectiveContestRating(vessel(mixed), 7)).toBe(58.5)
    // House SE-SW .35/.05/.05/.20/.05/.05/.25: 28 + 3 + 2 + 4 + 5 + 0 + 12.5
    expect(effectiveContestRating(vessel(mixed), 2)).toBe(54.5)
  })

  it('raises the ECR by exactly weight × increase when one stat of a flat 50 vessel goes up', () => {
    for (const zoneId of ZONE_IDS) {
      CORE_STAT_KEYS.forEach((key, column) => {
        const expected =
          Math.round((50 + (EXPECTED_PERCENT[zoneId][column] / 100) * 10) * 100) / 100
        expect(effectiveContestRating(vessel(stats(50, { [key]: 60 })), zoneId)).toBe(expected)
      })
    }
  })

  it('rounds to 2 decimal places, after the Seal multiplier', () => {
    expect(effectiveContestRating(vessel(stats(33.333)), 3)).toBe(33.33)
    expect(effectiveContestRating(vessel(stats(33.337)), 3)).toBe(33.34)
    // 40.004 × 1.40 = 56.0056 → 56.01; rounding the base first would give 40 × 1.4 = 56.
    const seals = [makeSeal('matter', 'Celestial')]
    expect(effectiveContestRating(vessel(stats(40.004), seals), 0)).toBe(56.01)
  })

  it('always returns a value with at most 2 decimals', () => {
    const rng = mulberry32(11)
    for (let i = 0; i < 300; i++) {
      const ecr = effectiveContestRating(randomVessel(rng), Math.floor(rng() * 11))
      expect(Math.round(ecr * 100) / 100).toBe(ecr)
    }
  })

  it('clamps each stat to 0–100 before weighting', () => {
    expect(effectiveContestRating(vessel(stats(150)), 4)).toBe(100)
    expect(effectiveContestRating(vessel(stats(-20)), 4)).toBe(0)
    // power 150 clamps to 100: House ENE-SE weighs power at .35.
    expect(effectiveContestRating(vessel(oneHot('power', 150)), 1)).toBe(35)
    expect(effectiveContestRating(vessel(oneHot('power', -40)), 1)).toBe(0)
  })

  it('agrees with an independent oracle over seeded random vessels', () => {
    const rng = mulberry32(2024)
    for (let i = 0; i < 400; i++) {
      const v = randomVessel(rng)
      const zoneId = Math.floor(rng() * 11)
      expect(effectiveContestRating(v, zoneId)).toBe(referenceEcr(v, zoneId))
    }
  })

  it('does not mutate its input, and accepts a deeply frozen vessel', () => {
    const v = vessel(stats(70), [makeSeal('matter', 'Gold')], {
      active: true,
      statBoosts: { resonance: 10 },
    })
    Object.freeze(v.stats)
    Object.freeze(v.seals)
    Object.freeze(v.surge?.statBoosts)
    Object.freeze(v.surge)
    Object.freeze(v)
    const first = effectiveContestRating(v, 0)
    expect(effectiveContestRating(v, 0)).toBe(first)
    expect(v.stats.resonance).toBe(70)
  })
})

describe('effectiveContestRating: Seals', () => {
  it('applies the multiplier of the vessel’s tier for the zone’s own element, tier by tier', () => {
    // Zone 0 is Earth, whose token is matter; a flat 50 vessel makes the multiplier visible.
    const expected: Record<SealTier, number> = {
      Copper: 52.5,
      Silver: 55,
      Gold: 59,
      Aether: 64,
      Celestial: 70,
    }
    for (const tier of SEAL_TIERS) {
      expect(effectiveContestRating(vessel(stats(50), [makeSeal('matter', tier)]), 0)).toBe(
        expected[tier]
      )
    }
  })

  it('uses the highest earned tier among matching Seals, not the first, last or sum', () => {
    const seals = [
      makeSeal('matter', 'Silver', 'a'),
      makeSeal('matter', 'Aether', 'b'),
      makeSeal('matter', 'Copper', 'c'),
    ]
    expect(effectiveContestRating(vessel(stats(50), seals), 0)).toBe(64)
    expect(effectiveContestRating(vessel(stats(50), [...seals].reverse()), 0)).toBe(64)
  })

  it('does not stack two Seals of the same tier', () => {
    const seals = [makeSeal('matter', 'Gold', 'a'), makeSeal('matter', 'Gold', 'b')]
    expect(effectiveContestRating(vessel(stats(50), seals), 0)).toBe(59)
  })

  it('counts only Seals of the zone’s token: another token never helps', () => {
    const celestialElsewhere = [
      makeSeal('spirit', 'Celestial'),
      makeSeal('essence', 'Celestial'),
      makeSeal('substance', 'Celestial'),
    ]
    expect(effectiveContestRating(vessel(stats(50), celestialElsewhere), 0)).toBe(50)
    // …while the same Seals do count in the zones of their own elements.
    expect(effectiveContestRating(vessel(stats(50), celestialElsewhere), 2)).toBe(70) // Fire/spirit
    expect(effectiveContestRating(vessel(stats(50), celestialElsewhere), 3)).toBe(70) // Water/essence
    expect(effectiveContestRating(vessel(stats(50), celestialElsewhere), 1)).toBe(70) // Air/substance
  })

  it('ignores a Seal with tier null, including alongside a lower earned one', () => {
    expect(effectiveContestRating(vessel(stats(50), [makeSeal('matter', null)]), 0)).toBe(50)
    const seals = [makeSeal('matter', null, 'a'), makeSeal('matter', 'Copper', 'b')]
    expect(effectiveContestRating(vessel(stats(50), seals), 0)).toBe(52.5)
  })

  it('pairs every zone with exactly its own token', () => {
    for (const profile of ZONE_PROFILES) {
      for (const token of ESMS_TOKENS) {
        const ecr = effectiveContestRating(
          vessel(stats(50), [makeSeal(token, 'Gold')]),
          profile.zoneId
        )
        expect(ecr, `${profile.label}/${token}`).toBe(token === profile.esmsToken ? 59 : 50)
      }
    }
  })

  it('multiplies the stat sum, not a rating: a 60-point vessel under Silver is 66', () => {
    expect(effectiveContestRating(vessel(stats(60), [makeSeal('spirit', 'Silver')]), 7)).toBe(66)
  })

  it('works on the Seals evaluateSeals actually produces', () => {
    const rich = { spirit: 1000, essence: 1000, matter: 1000, substance: 1000 }
    const seals = evaluateSeals({ stats: stats(100), esmsBalances: rich })
    const earned = seals.filter(seal => seal.tier !== null)
    expect(earned.length).toBeGreaterThan(0)
    for (const profile of ZONE_PROFILES) {
      const tiers = earned
        .filter(seal => seal.token === profile.esmsToken)
        .map(seal => SEAL_TIERS.indexOf(seal.tier as SealTier))
      const expectedMultiplier =
        tiers.length === 0 ? 1 : SEAL_TIER_MULTIPLIERS[SEAL_TIERS[Math.max(...tiers)]]
      expect(effectiveContestRating(vessel(stats(100), seals), profile.zoneId)).toBe(
        Math.round(100 * expectedMultiplier * 100) / 100
      )
    }
  })

  it('throws RangeError on a Seal with an unknown tier or token, whichever zone is asked', () => {
    const badTier = makeSeal('spirit', 'Platinum' as unknown as SealTier)
    const badToken = makeSeal('aether' as unknown as EsmsToken, 'Gold')
    for (const zoneId of [0, 2, 10]) {
      expect(() => effectiveContestRating(vessel(stats(50), [badTier]), zoneId)).toThrow(RangeError)
      expect(() => effectiveContestRating(vessel(stats(50), [badToken]), zoneId)).toThrow(
        RangeError
      )
    }
  })
})

describe('effectiveContestRating: Resonance Surge', () => {
  const surge = (active: boolean, statBoosts: Partial<CoreStats>) => ({ active, statBoosts })

  it('adds an active surge’s boosts to the stats before weighting', () => {
    // Crown weighs resonance and charisma at .19 each: 50 + .19·10 + .19·10 = 53.8.
    const v = vessel(stats(50), [], surge(true, { resonance: 10, charisma: 10 }))
    expect(effectiveContestRating(v, 10)).toBe(53.8)
  })

  it('contributes nothing while inactive, even with non-empty boosts', () => {
    const v = vessel(stats(50), [], surge(false, { resonance: 10, charisma: 10, power: 10 }))
    for (const zoneId of ZONE_IDS) expect(effectiveContestRating(v, zoneId)).toBe(50)
  })

  it('treats a null, absent or empty surge as no surge', () => {
    const base = effectiveContestRating({ stats: stats(61), seals: [] }, 6)
    expect(effectiveContestRating(vessel(stats(61), [], null), 6)).toBe(base)
    expect(effectiveContestRating(vessel(stats(61), [], surge(true, {})), 6)).toBe(base)
  })

  it('clamps boosted stats at 100', () => {
    // resonance 95 + 10 → 100, not 105: Crown = .19·100 + .19·10 (charisma 0 + 10) = 20.9.
    const v = vessel(stats(0, { resonance: 95 }), [], surge(true, { resonance: 10, charisma: 10 }))
    expect(effectiveContestRating(v, 10)).toBe(20.9)
  })

  it('floors a stat driven below zero by a negative boost at 0', () => {
    const v = vessel(stats(0, { power: 20 }), [], surge(true, { power: -30 }))
    expect(effectiveContestRating(v, 1)).toBe(0)
  })

  it('boosts only the stats it names', () => {
    const v = vessel(stats(50), [], surge(true, { intuition: 10 }))
    // Spire SE weighs intuition at .35: 50 + 3.5.
    expect(effectiveContestRating(v, 7)).toBe(53.5)
    // The Crown weighs it at .13: 50 + 1.3.
    expect(effectiveContestRating(v, 10)).toBe(51.3)
  })

  it('applies the surge before the Seal multiplier', () => {
    // (50 + 3.8) · 1.18 = 63.484 → 63.48, in the Water Crown with an Essence Gold Seal.
    const v = vessel(
      stats(50),
      [makeSeal('essence', 'Gold')],
      surge(true, { resonance: 10, charisma: 10 })
    )
    expect(effectiveContestRating(v, 10)).toBe(63.48)
  })

  it('works with a surge calculateResonanceSurge actually produced', () => {
    // Drive both quantities to the top and the bottom of the calibration, whatever it is pinned
    // at: a full sky meter is an active heat-led surge, an empty one is inactive.
    const { heat, reactivity } = DEFAULT_SURGE_CALIBRATION
    const live = calculateResonanceSurge({
      thermodynamics: { heat: heat.high, reactivity: reactivity.high },
    })
    expect(live.active).toBe(true)
    expect(live.statBoosts).toEqual({ resonance: MAX_SURGE_BOOST, charisma: MAX_SURGE_BOOST })
    // Crown: 50 + .19·10 + .19·10.
    expect(effectiveContestRating(vessel(stats(50), [], live), 10)).toBe(53.8)

    const quiet = calculateResonanceSurge({
      thermodynamics: { heat: heat.low, reactivity: reactivity.low },
    })
    expect(quiet.active).toBe(false)
    expect(quiet.statBoosts).toEqual({})
    expect(effectiveContestRating(vessel(stats(50), [], quiet), 10)).toBe(50)
  })

  it('throws if a boost makes a stat non-finite', () => {
    const v = vessel(stats(50), [], surge(true, { power: Number.NaN }))
    expect(() => effectiveContestRating(v, 1)).toThrow(RangeError)
  })

  it('does not look at the boosts of an inactive surge, so a bad one is harmless', () => {
    const v = vessel(stats(50), [], surge(false, { power: Number.NaN }))
    expect(effectiveContestRating(v, 1)).toBe(50)
  })
})

describe('effectiveContestRating: RangeError cases', () => {
  it.each([-1, 11, 12, 100, 1.5, 0.1, Number.NaN, Infinity, -Infinity])(
    'rejects zone %s',
    zoneId => {
      expect(() => effectiveContestRating(vessel(stats(50)), zoneId)).toThrow(RangeError)
    }
  )

  it('rejects a zone id that is not a number', () => {
    expect(() => effectiveContestRating(vessel(stats(50)), '3' as unknown as number)).toThrow(
      RangeError
    )
    expect(() => effectiveContestRating(vessel(stats(50)), undefined as unknown as number)).toThrow(
      RangeError
    )
  })

  it('accepts every integer from 0 to 10', () => {
    for (let zoneId = 0; zoneId <= 10; zoneId++) {
      expect(() => effectiveContestRating(vessel(stats(50)), zoneId)).not.toThrow()
    }
  })

  it.each(CORE_STAT_KEYS)('rejects a non-finite %s and names it', key => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      expect(() => effectiveContestRating(vessel(stats(50, { [key]: bad })), 0)).toThrow(RangeError)
      expect(() => effectiveContestRating(vessel(stats(50, { [key]: bad })), 0)).toThrow(
        new RegExp(key)
      )
    }
  })

  it('rejects a missing stat rather than rating it as 0', () => {
    const missing = { ...stats(50) } as Partial<CoreStats>
    delete missing.wisdom
    expect(() => effectiveContestRating(vessel(missing as CoreStats), 0)).toThrow(RangeError)
  })

  it('throws the same way from computeZoneSynergies and resolveZoneContest', () => {
    const broken = vessel(stats(50, { power: Number.NaN }))
    expect(() => computeZoneSynergies(broken)).toThrow(RangeError)
    expect(() => bestZoneId(broken)).toThrow(RangeError)
    expect(() => resolveZoneContest(broken, vessel(stats(50)), 0, 50)).toThrow(RangeError)
    expect(() => resolveZoneContest(vessel(stats(50)), broken, 0, 50)).toThrow(RangeError)
    expect(() => resolveZoneContest(vessel(stats(50)), vessel(stats(50)), 11, 50)).toThrow(
      RangeError
    )
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
    resolveZoneContest(vessel(stats(attackerBase)), vessel(stats(defenderBase)), 4, control)

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

  it('calls different stat blocks a draw when the zone weighs them equally', () => {
    // House WNW-N (zone 4) weighs power and vitality both at .30.
    const result = resolveZoneContest(vessel(oneHot('power')), vessel(oneHot('vitality')), 4, 50)
    expect(result.winner).toBe('draw')
    expect(result.attackerScore).toBe(30)
    expect(result.defenderScore).toBe(30)
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

  it('computes the swing from margin over the larger score: 1.00 against 51 is 4', () => {
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
    expect(duel(100, 0).controlDelta).toBe(MAX_CONTROL_SWING)
    expect(duel(0, 100).controlDelta).toBe(-MAX_CONTROL_SWING)
  })

  it('reaches the cap exactly at a 20% relative margin and not before', () => {
    // 80 vs 64: 16/80 = 20% → 40 exactly. 80 vs 65: 15/80·200 = 37.5 → 38.
    expect(duel(80, 64).controlDelta).toBe(40)
    expect(duel(80, 65).controlDelta).toBe(38)
  })

  it('floors the denominator at 1, so tiny ratings do not blow up the swing', () => {
    // 0.5 vs 0.4: margin 0.1; 0.1/max(0.5, 0.4, 1)·200 = 20. Without the floor it would be 40.
    const result = resolveZoneContest(vessel(stats(0.5)), vessel(stats(0.4)), 4, 50)
    expect(result.margin).toBe(0.1)
    expect(result.controlDelta).toBe(20)
  })

  it('lets a winner by under a rounding step carry a delta of 0, never −0', () => {
    // 50 vs 50.01: the defender wins, 0.01/50.01·200 = 0.04 → 0.
    const result = resolveZoneContest(vessel(stats(50)), vessel(stats(50.01)), 4, 50)
    expect(result.winner).toBe('defender')
    expect(result.margin).toBe(0.01)
    expect(Object.is(result.controlDelta, 0)).toBe(true)
    expect(result.nextControl).toBe(50)
  })

  it('reports the two ECRs and a 2-dp margin', () => {
    const result = resolveZoneContest(vessel(stats(50.123)), vessel(stats(60.456)), 4, 50)
    expect(result.attackerScore).toBe(50.12)
    expect(result.defenderScore).toBe(60.46)
    expect(result.margin).toBe(10.34)
  })

  it('lets a matching Seal decide a contest between equal stats', () => {
    // Zone 0 is Earth/matter. Gold: 59 against 50, margin 9, 9/59·200 = 30.51 → 31.
    const result = resolveZoneContest(
      vessel(stats(50), [makeSeal('matter', 'Gold')]),
      vessel(stats(50)),
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
    // A Seal of another element changes nothing.
    const wrong = resolveZoneContest(
      vessel(stats(50), [makeSeal('spirit', 'Celestial')]),
      vessel(stats(50)),
      0,
      50
    )
    expect(wrong.winner).toBe('draw')
  })

  it('lets an active surge decide a contest between equal stats, and an inactive one not', () => {
    const boosted = vessel(stats(50), [], {
      active: true,
      statBoosts: { resonance: 10, charisma: 10 },
    })
    const idle = vessel(stats(50), [], {
      active: false,
      statBoosts: { resonance: 10, charisma: 10 },
    })
    const won = resolveZoneContest(boosted, vessel(stats(50)), 10, 50)
    expect(won.winner).toBe('attacker')
    expect(won.attackerScore).toBe(53.8)
    expect(resolveZoneContest(idle, vessel(stats(50)), 10, 50).winner).toBe('draw')
  })
})

describe('resolveZoneContest: control', () => {
  const attackerWins = (control: number) =>
    resolveZoneContest(vessel(stats(70)), vessel(stats(65)), 4, control) // +14
  const defenderWins = (control: number) =>
    resolveZoneContest(vessel(stats(60)), vessel(stats(66)), 4, control) // −18

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
    const result = resolveZoneContest(vessel(stats(90)), vessel(stats(10)), 4, 50)
    expect(result.controlDelta).toBe(40)
    expect(result.nextControl).toBe(90)
  })

  it('keeps a fractional share exact: 33.5 + 14', () => {
    expect(attackerWins(33.5).nextControl).toBe(47.5)
  })

  it('accepts 0 and 100 as valid control', () => {
    expect(() => attackerWins(0)).not.toThrow()
    expect(() => attackerWins(100)).not.toThrow()
  })

  it.each([-1, -0.0001, 100.0001, 101, Number.NaN, Infinity, -Infinity])(
    'rejects control %s with a RangeError',
    control => {
      expect(() => attackerWins(control)).toThrow(RangeError)
    }
  )

  it('rejects control that is not a number', () => {
    expect(() => attackerWins('50' as unknown as number)).toThrow(RangeError)
    expect(() => attackerWins(undefined as unknown as number)).toThrow(RangeError)
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
      const raw = (r.margin / Math.max(r.attackerScore, r.defenderScore, 1)) * 100 * CONTROL_GAIN
      const swing = Math.round(Math.min(MAX_CONTROL_SWING, Math.max(0, raw)))
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
    const synergies = computeZoneSynergies(vessel(stats(50)))
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
    const [first] = computeZoneSynergies(vessel(stats(50)))
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
        expect(entry.synergy).toBe(referenceEcr(v, entry.zoneId))
      }
    }
  })

  it('reflects a Seal only in the zones of its element', () => {
    const synergies = computeZoneSynergies(vessel(stats(50), [makeSeal('spirit', 'Gold')]))
    for (const entry of synergies) {
      expect(entry.synergy, entry.label).toBe(entry.element === 'Fire' ? 59 : 50)
    }
  })

  it('returns a fresh array each call', () => {
    const v = vessel(stats(50))
    const first = computeZoneSynergies(v)
    first[0].synergy = 999
    expect(computeZoneSynergies(v)[0].synergy).toBe(50)
  })
})

describe('bestZoneId', () => {
  it('picks the zone that weighs a one-hot stat most', () => {
    expect(bestZoneId(vessel(oneHot('wisdom')))).toBe(5) // Spire N, .35
    expect(bestZoneId(vessel(oneHot('adaptability')))).toBe(6) // Spire ENE, .35
    expect(bestZoneId(vessel(oneHot('intuition')))).toBe(7) // Spire SE, .35
    expect(bestZoneId(vessel(oneHot('resonance')))).toBe(3) // House SW-WNW, .20 beats the Crown's .19
    expect(bestZoneId(vessel(oneHot('charisma')))).toBe(2) // House SE-SW, .20 beats the Crown's .19
  })

  it('breaks a tie toward the lowest zone id', () => {
    expect(bestZoneId(vessel(stats(50)))).toBe(0) // every zone ties
    expect(bestZoneId(vessel(oneHot('power')))).toBe(1) // Houses 1 and 2 both weigh power .35
    expect(bestZoneId(vessel(oneHot('vitality')))).toBe(0) // Houses 0 and 3 both weigh vitality .35
  })

  it('finds the Crown for a vessel whose edge is resonance and charisma together', () => {
    // 60 everywhere with resonance and charisma at 80: Crown = 60 + 20·.38 = 67.6; the next best
    // zone (a House that weighs one of them at .20, plus a little of the other) is 65.
    const v = vessel(stats(60, { resonance: 80, charisma: 80 }))
    expect(effectiveContestRating(v, 10)).toBe(67.6)
    expect(bestZoneId(v)).toBe(10)
  })

  it('lets a Seal move the best zone', () => {
    // Flat 50 would pick zone 0 on the tie; an Air (substance) Seal pulls it to Air's first zone.
    const v = vessel(stats(50), [makeSeal('substance', 'Gold')])
    expect(bestZoneId(v)).toBe(1)
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
  it('raising any stat never lowers the ECR, over seeded random vessels', () => {
    const rng = mulberry32(4242)
    for (let i = 0; i < 500; i++) {
      const v = randomVessel(rng)
      const zoneId = Math.floor(rng() * 11)
      const key = pick(rng, CORE_STAT_KEYS)
      const raised = { ...v, stats: { ...v.stats, [key]: v.stats[key] + rng() * 30 } }
      expect(effectiveContestRating(raised, zoneId)).toBeGreaterThanOrEqual(
        effectiveContestRating(v, zoneId)
      )
    }
  })

  it('raising a stat that a zone weighs strictly raises the ECR when it is not already clamped', () => {
    for (const zoneId of ZONE_IDS) {
      for (const key of CORE_STAT_KEYS) {
        const low = effectiveContestRating(vessel(stats(40)), zoneId)
        const high = effectiveContestRating(vessel(stats(40, { [key]: 70 })), zoneId)
        expect(high, `${zoneId}/${key}`).toBeGreaterThan(low)
      }
    }
  })

  it('a stat already at the ceiling cannot be raised further', () => {
    const at = effectiveContestRating(vessel(stats(100)), 3)
    expect(effectiveContestRating(vessel(stats(100, { power: 500 })), 3)).toBe(at)
  })

  it('raising a surge boost never lowers the ECR', () => {
    const rng = mulberry32(606)
    for (let i = 0; i < 300; i++) {
      const v = randomVessel(rng)
      const zoneId = Math.floor(rng() * 11)
      const key = pick(rng, CORE_STAT_KEYS)
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
      const current = v.seals[target].tier
      const currentRank = current === null ? -1 : SEAL_TIERS.indexOf(current)
      const higher =
        SEAL_TIERS[Math.min(SEAL_TIERS.length - 1, currentRank + 1 + Math.floor(rng() * 3))]
      const upgraded = v.seals.map((seal, index) =>
        index === target ? { ...seal, tier: higher } : seal
      )
      for (const zoneId of ZONE_IDS) {
        expect(effectiveContestRating({ ...v, seals: upgraded }, zoneId)).toBeGreaterThanOrEqual(
          effectiveContestRating(v, zoneId)
        )
      }
    }
  })

  it('each tier strictly beats the one below it in the zone of its own token', () => {
    for (const profile of ZONE_PROFILES) {
      let previous = effectiveContestRating(vessel(stats(80)), profile.zoneId)
      for (const tier of SEAL_TIERS) {
        const next = effectiveContestRating(
          vessel(stats(80), [makeSeal(profile.esmsToken, tier)]),
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
      const extra = makeSeal(pick(rng, ESMS_TOKENS), pick(rng, [null, ...SEAL_TIERS]), 'extra')
      for (const zoneId of ZONE_IDS) {
        expect(
          effectiveContestRating({ ...v, seals: [...v.seals, extra] }, zoneId)
        ).toBeGreaterThanOrEqual(effectiveContestRating(v, zoneId))
      }
    }
  })

  it('with no Seals, the ECR stays within the range of the vessel’s own stats', () => {
    const rng = mulberry32(21)
    for (let i = 0; i < 300; i++) {
      const v = { ...randomVessel(rng), seals: [], surge: null }
      const clamped = CORE_STAT_KEYS.map(key => Math.min(100, Math.max(0, v.stats[key])))
      const lo = Math.min(...clamped)
      const hi = Math.max(...clamped)
      for (const entry of computeZoneSynergies(v)) {
        expect(entry.synergy).toBeGreaterThanOrEqual(lo - 0.01)
        expect(entry.synergy).toBeLessThanOrEqual(hi + 0.01)
      }
    }
  })
})

// ─── The roster ──────────────────────────────────────────────────────────────

describe('roster', () => {
  const rosterStats = HISTORICAL_AGENTS.map(agent => ({
    id: agent.id,
    stats: deriveSacredStats(agent),
  }))

  it('has agents to measure', () => {
    expect(rosterStats.length).toBeGreaterThan(0)
  })

  it('gives every agent finite synergies in a sane range, inside its own stat range', () => {
    for (const { id, stats: s } of rosterStats) {
      const synergies = computeZoneSynergies({ stats: s, seals: [] })
      expect(synergies, id).toHaveLength(11)
      const values = CORE_STAT_KEYS.map(key => s[key])
      const lo = Math.min(...values)
      const hi = Math.max(...values)
      for (const entry of synergies) {
        expect(Number.isFinite(entry.synergy), `${id}/${entry.label}`).toBe(true)
        expect(entry.synergy, `${id}/${entry.label}`).toBeGreaterThanOrEqual(Math.max(0, lo - 0.01))
        expect(entry.synergy, `${id}/${entry.label}`).toBeLessThanOrEqual(Math.min(100, hi + 0.01))
      }
    }
  })

  it('still stays finite and within the top multiplier when every Seal is earned and a surge is up', () => {
    const celestial = ESMS_TOKENS.map(token => makeSeal(token, 'Celestial'))
    const surge = {
      active: true,
      statBoosts: { resonance: 10, charisma: 10, intuition: 10, adaptability: 10 },
    }
    for (const { id, stats: s } of rosterStats) {
      for (const entry of computeZoneSynergies({ stats: s, seals: celestial, surge })) {
        expect(Number.isFinite(entry.synergy), id).toBe(true)
        expect(entry.synergy, id).toBeLessThanOrEqual(140)
        expect(entry.synergy, id).toBeGreaterThan(0)
      }
    }
  })

  it('does not collapse the roster onto one best zone', () => {
    const counts = new Map<number, number>()
    for (const { stats: s } of rosterStats) {
      const best = bestZoneId({ stats: s, seals: [] })
      counts.set(best, (counts.get(best) ?? 0) + 1)
    }
    // Measured 2026-10-18 over the 72-agent roster: 7 distinct best zones, the largest holding 42%.
    expect(counts.size).toBeGreaterThanOrEqual(4)
    expect(Math.max(...counts.values()) / rosterStats.length).toBeLessThanOrEqual(0.6)
  })

  it('has agents whose best zone differs, and the difference is explained by their stats', () => {
    const bestOf = (s: CoreStats) => bestZoneId({ stats: s, seals: [] })
    const bests = new Set(rosterStats.map(({ stats: s }) => bestOf(s)))
    expect(bests.size).toBeGreaterThan(1)
    // Each agent's best zone really is a maximum of their own synergies.
    for (const { stats: s } of rosterStats) {
      const synergies = computeZoneSynergies({ stats: s, seals: [] })
      expect(synergies[bestOf(s)].synergy).toBe(Math.max(...synergies.map(e => e.synergy)))
    }
  })
})
