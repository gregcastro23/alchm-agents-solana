/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import {
  ESMS_TOKENS,
  SEAL_CATALOG,
  SEAL_TIERS,
  SEAL_TIER_REQUIREMENTS,
  CELESTIAL_MIN_NATAL_AFFINITY,
  DEFAULT_SURGE_CALIBRATION,
  GLOBAL_ROSTER_MEAN,
  HARMONY_MAX_OFFSET,
  MAX_SURGE_BOOST,
  SURGE_ACTIVE_AT,
  applyStatBoosts,
  calculateResonanceSurge,
  classifyMonica,
  computeMeanAlignedRating,
  earnedSeals,
  elementalHarmony,
  evaluateSeals,
  natalAffinity,
  type AlchemicalSeal,
  type EsmsHoldings,
  type EsmsToken,
  type NatalChartInput,
  type SealTier,
  type SkyBodies,
  type SurgeCalibration,
} from '@/lib/agents/rating/seals-surge'
import {
  CORE_STAT_KEYS,
  RATING_CEILING,
  STAT_BASELINES,
  toRating,
  type CoreStats,
} from '@/lib/agents/rating/ovr-archetype'
import {
  MONICA_EQUILIBRIUM,
  calculateMonica,
  calculateThermodynamics,
} from '@/lib/thermodynamics/kalchm'

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

const holdings = (each: number, overrides: Partial<EsmsHoldings> = {}): EsmsHoldings => ({
  spirit: each,
  essence: each,
  matter: each,
  substance: each,
  ...overrides,
})

/** Fire ×4 (Sun, Moon, Mercury, Venus), Earth ×3, Water ×2, Air ×1. */
const CHART_PLANETS: Record<string, { sign: string }> = {
  Sun: { sign: 'Aries' },
  Moon: { sign: 'Leo' },
  Mercury: { sign: 'Sagittarius' },
  Venus: { sign: 'Aries' },
  Mars: { sign: 'Taurus' },
  Jupiter: { sign: 'Gemini' },
  Saturn: { sign: 'Cancer' },
  Uranus: { sign: 'Virgo' },
  Neptune: { sign: 'Capricorn' },
  Pluto: { sign: 'Scorpio' },
}
const chart = (provenance?: NatalChartInput['provenance']): NatalChartInput => ({
  planets: CHART_PLANETS,
  provenance,
})

const byId = (results: ReturnType<typeof evaluateSeals>, id: string) => {
  const found = results.find(r => r.id === id)
  if (!found) throw new Error(`no Seal ${id}`)
  return found
}
const tierIndex = (tier: (typeof SEAL_TIERS)[number] | null) =>
  tier === null ? -1 : SEAL_TIERS.indexOf(tier)

// ─── An independent oracle for the Seal gates ───────────────────────────────
// Everything here is written out as literals. Nothing is read from the module under test, so a
// drifted gate, league mean, scale constant or comparison operator in it cannot also drift here.

type SealStat = (typeof CORE_STAT_KEYS)[number]

/** League means of the Sacred 7 (0–100 scale). `STAT_BASELINES` is checked against these below. */
const LITERAL_MEANS: Record<SealStat, number> = {
  power: 76.5,
  resonance: 69.0,
  wisdom: 68.4,
  charisma: 67.3,
  intuition: 70.2,
  adaptability: 65.0,
  vitality: 67.1,
}
const LITERAL_GLOBAL_MEAN = (76.5 + 69.0 + 68.4 + 67.3 + 70.2 + 65.0 + 67.1) / 7

const LITERAL_GATES: ReadonlyArray<{ tier: SealTier; rating: number; balance: number }> = [
  { tier: 'Copper', rating: 74, balance: 0.5 },
  { tier: 'Silver', rating: 80, balance: 2 },
  { tier: 'Gold', rating: 86, balance: 10 },
  { tier: 'Aether', rating: 91, balance: 50 },
  { tier: 'Celestial', rating: 96, balance: 250 },
]
const LITERAL_MIN_AFFINITY = 4

/** The element each ESMS token is earned through, and one sign of it (and of some other element). */
const TOKEN_SIGNS: Record<EsmsToken, { own: string; other: string }> = {
  spirit: { own: 'Aries', other: 'Taurus' }, // Fire
  essence: { own: 'Cancer', other: 'Taurus' }, // Water
  matter: { own: 'Taurus', other: 'Aries' }, // Earth
  substance: { own: 'Gemini', other: 'Taurus' }, // Air
}

const BODY_NAMES = [
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
] as const

/** A `computed` chart with exactly `count` of the ten classical bodies in the token's element. */
const chartWithAffinity = (token: EsmsToken, count: number): NatalChartInput => ({
  provenance: 'computed',
  planets: Object.fromEntries(
    BODY_NAMES.map((body, i) => [
      body,
      { sign: i < count ? TOKEN_SIGNS[token].own : TOKEN_SIGNS[token].other },
    ])
  ),
})

interface OracleSeal {
  statRating: number
  alignedRating: number
  tier: SealTier | null
  maxTier: SealTier
  nextTier: SealTier | null
  blockedBy: Array<'stat' | 'esms' | 'natal'>
}

/** What a Seal on `stat` should read for an integer stat 0–100, a balance and a chart's affinity. */
function oracleSeal(
  stat: SealStat,
  value: number,
  balance: number,
  affinity: number | null
): OracleSeal {
  // 25 + value·0.74, rounded half up — in integer arithmetic so no float can tip a .5.
  const statRating = Math.floor((2550 + 74 * value) / 100)
  const offset = 0.74 * (LITERAL_GLOBAL_MEAN - LITERAL_MEANS[stat])
  const aligned = statRating + offset
  const ceiling = 99 + offset
  const natalOk = affinity !== null && affinity >= LITERAL_MIN_AFFINITY

  let tierIdx = -1
  let maxIdx = 0
  LITERAL_GATES.forEach((gate, i) => {
    const isCelestial = gate.tier === 'Celestial'
    if (aligned >= gate.rating && balance >= gate.balance && (!isCelestial || natalOk)) tierIdx = i
    if (gate.rating <= ceiling) maxIdx = i
  })

  const nextIdx = tierIdx + 1 <= maxIdx ? tierIdx + 1 : null
  const blockedBy: OracleSeal['blockedBy'] = []
  if (nextIdx !== null) {
    const need = LITERAL_GATES[nextIdx]
    if (aligned < need.rating) blockedBy.push('stat')
    if (balance < need.balance) blockedBy.push('esms')
    if (need.tier === 'Celestial' && !natalOk) blockedBy.push('natal')
  }
  return {
    statRating,
    alignedRating: Math.round(aligned * 100) / 100,
    tier: tierIdx >= 0 ? LITERAL_GATES[tierIdx].tier : null,
    maxTier: LITERAL_GATES[maxIdx].tier,
    nextTier: nextIdx === null ? null : LITERAL_GATES[nextIdx].tier,
    blockedBy,
  }
}

const readSeal = (r: AlchemicalSeal): OracleSeal => ({
  statRating: r.statRating,
  alignedRating: r.alignedRating,
  tier: r.tier,
  maxTier: r.maxTier,
  nextTier: r.nextTier,
  blockedBy: r.blockedBy,
})

describe('Seal catalog', () => {
  it('has unique ids and is exactly the canonical seven Seals', () => {
    expect(new Set(SEAL_CATALOG.map(b => b.id)).size).toBe(SEAL_CATALOG.length)
    expect(SEAL_CATALOG).toHaveLength(7)
    const named = Object.fromEntries(SEAL_CATALOG.map(b => [b.stat, `${b.name}|${b.token}`]))
    expect(named).toEqual({
      power: 'Crucible Finisher|substance',
      intuition: 'Astral Vision|spirit',
      vitality: 'Immovable Foundation|matter',
      charisma: 'Harmonic Sovereign|essence',
      resonance: 'Tidal Chorus|essence',
      adaptability: 'Quicksilver Pivot|spirit',
      wisdom: "Philosopher's Stone|matter",
    })
  })

  it('uses the tier names Copper, Silver, Gold, Aether, Celestial — in that order', () => {
    expect([...SEAL_TIERS]).toEqual(['Copper', 'Silver', 'Gold', 'Aether', 'Celestial'])
  })

  it('gives every Sacred 7 stat and every ESMS token at least one Seal', () => {
    expect(new Set(SEAL_CATALOG.map(b => b.stat))).toEqual(new Set(CORE_STAT_KEYS))
    expect(new Set(SEAL_CATALOG.map(b => b.token)).size).toBe(4)
  })

  it('keeps tier requirements strictly increasing on both gates', () => {
    for (let i = 1; i < SEAL_TIERS.length; i++) {
      const lower = SEAL_TIER_REQUIREMENTS[SEAL_TIERS[i - 1]]
      const higher = SEAL_TIER_REQUIREMENTS[SEAL_TIERS[i]]
      expect(higher.minRating).toBeGreaterThan(lower.minRating)
      expect(higher.minBalance).toBeGreaterThan(lower.minBalance)
    }
  })

  it('pins the gates as literals, so no other assertion measures them against themselves', () => {
    expect(SEAL_TIER_REQUIREMENTS).toEqual({
      Copper: { minRating: 74, minBalance: 0.5 },
      Silver: { minRating: 80, minBalance: 2 },
      Gold: { minRating: 86, minBalance: 10 },
      Aether: { minRating: 91, minBalance: 50 },
      Celestial: { minRating: 96, minBalance: 250 },
    })
    expect(CELESTIAL_MIN_NATAL_AFFINITY).toBe(4)
  })

  it('orders the ESMS tokens Spirit, Essence, Matter, Substance (EsmsId 0–3)', () => {
    expect([...ESMS_TOKENS]).toEqual(['spirit', 'essence', 'matter', 'substance'])
  })
})

describe('evaluateSeals', () => {
  it('earns nothing with empty holdings, however strong the stats', () => {
    const results = evaluateSeals({ stats: stats(100), esmsBalances: holdings(0) })
    expect(results).toHaveLength(SEAL_CATALOG.length)
    for (const r of results) {
      expect(r.tier).toBeNull()
      expect(r.nextTier).toBe('Copper')
      expect(r.blockedBy).toEqual(['esms'])
    }
    expect(earnedSeals(results)).toEqual([])
  })

  it('takes the lower of the stat gate and the balance gate', () => {
    // intuition 97 → rating 97 clears everything on the stat side; 12 Spirit clears Gold only.
    const balanceLimited = byId(
      evaluateSeals({
        stats: stats(50, { intuition: 97 }),
        esmsBalances: holdings(0, { spirit: 12 }),
      }),
      'astral-vision'
    )
    expect(balanceLimited.tier).toBe('Gold')
    expect(balanceLimited.nextTier).toBe('Aether')
    expect(balanceLimited.blockedBy).toEqual(['esms'])

    // intuition 75 → rating 81, aligned ≈ 80.2: clears Silver (80), not Gold (86);
    // 1000 Spirit clears every balance gate.
    const statLimited = byId(
      evaluateSeals({ stats: stats(50, { intuition: 75 }), esmsBalances: holdings(1000) }),
      'astral-vision'
    )
    expect(statLimited.statRating).toBe(81)
    expect(statLimited.alignedRating).toBeCloseTo(80.16, 1)
    expect(statLimited.tier).toBe('Silver')
    expect(statLimited.blockedBy).toEqual(['stat'])
  })

  it('caps at Aether without a natal chart, and says why', () => {
    const results = evaluateSeals({ stats: stats(100), esmsBalances: holdings(1000) })
    for (const r of results) {
      expect(r.tier, r.id).toBe('Aether')
      expect(r.natalAffinity, r.id).toBeNull()
      if (r.stat === 'power') {
        // Crucible Finisher's league mean sits so far above the others that even a perfect
        // power stat aligns to 93.5 — short of Celestial's 96 — so Aether is its ceiling and
        // there is no next tier to be blocked on.
        expect(r.maxTier, r.id).toBe('Aether')
        expect(r.nextTier, r.id).toBeNull()
        expect(r.blockedBy, r.id).toEqual([])
      } else {
        expect(r.maxTier, r.id).toBe('Celestial')
        expect(r.nextTier, r.id).toBe('Celestial')
        expect(r.blockedBy, r.id).toEqual(['natal'])
      }
    }
  })

  it('unlocks Celestial only where the chart has enough bodies in the token’s element', () => {
    const results = evaluateSeals({
      stats: stats(100),
      esmsBalances: holdings(1000),
      natalChart: chart('computed'),
    })
    // Spirit/Fire has 4 bodies; Earth has 3, Water 2, Air 1.
    expect(byId(results, 'astral-vision').natalAffinity).toBe(4)
    expect(byId(results, 'astral-vision').tier).toBe('Celestial')
    expect(byId(results, 'astral-vision').blockedBy).toEqual([])
    expect(byId(results, 'astral-vision').nextTier).toBeNull()

    expect(CELESTIAL_MIN_NATAL_AFFINITY).toBe(4)
    expect(byId(results, 'immovable-foundation').natalAffinity).toBe(3)
    expect(byId(results, 'immovable-foundation').tier).toBe('Aether')
    expect(byId(results, 'harmonic-sovereign').natalAffinity).toBe(2)
    expect(byId(results, 'crucible-finisher').natalAffinity).toBe(1)
  })

  it('does not let a placeholder or unattributed chart unlock Celestial', () => {
    for (const provenance of ['placeholder', 'unattributed'] as const) {
      const results = evaluateSeals({
        stats: stats(100),
        esmsBalances: holdings(1000),
        natalChart: chart(provenance),
      })
      expect(byId(results, 'astral-vision').natalAffinity, provenance).toBeNull()
      expect(byId(results, 'astral-vision').tier, provenance).toBe('Aether')
    }
  })

  it('counts a chart with authored or absent provenance', () => {
    expect(natalAffinity(chart('authored'), 'spirit')).toBe(4)
    expect(natalAffinity(chart(undefined), 'spirit')).toBe(4)
  })

  it('counts only the ten classical bodies, and ignores unknown signs', () => {
    expect(
      natalAffinity(
        {
          planets: {
            Chiron: { sign: 'Aries' },
            Ascendant: { sign: 'Aries' },
            Sun: { sign: 'Ophiuchus' },
            Moon: { sign: 'Aries' },
          },
        },
        'spirit'
      )
    ).toBe(1)
    expect(natalAffinity(null, 'spirit')).toBeNull()
    expect(natalAffinity(undefined, 'spirit')).toBeNull()
  })

  it('rejects broken input instead of rating it as "earned nothing"', () => {
    expect(() =>
      evaluateSeals({ stats: stats(50, { power: NaN }), esmsBalances: holdings(1) })
    ).toThrow(/power/)
    expect(() =>
      evaluateSeals({ stats: stats(50), esmsBalances: holdings(1, { matter: -1 }) })
    ).toThrow(/matter/)
    expect(() =>
      evaluateSeals({ stats: stats(50), esmsBalances: holdings(1, { spirit: NaN }) })
    ).toThrow(/spirit/)
  })

  it('validates every token’s balance and every stat, not just the first ones', () => {
    for (const token of ESMS_TOKENS) {
      for (const bad of [
        Number.NaN,
        -1,
        -0.01,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ]) {
        expect(
          () => evaluateSeals({ stats: stats(50), esmsBalances: holdings(1, { [token]: bad }) }),
          `${token} ${bad}`
        ).toThrow(new RegExp(`Invalid ${token} balance`))
      }
      // Zero is a legitimate balance: it earns nothing but is not an error.
      expect(() =>
        evaluateSeals({ stats: stats(50), esmsBalances: holdings(1, { [token]: 0 }) })
      ).not.toThrow()
    }
    for (const key of CORE_STAT_KEYS) {
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(
          () => evaluateSeals({ stats: stats(50, { [key]: bad }), esmsBalances: holdings(1) }),
          `${key} ${bad}`
        ).toThrow(new RegExp(key))
      }
    }
  })

  it('clamps an out-of-range stat onto the 25–99 scale and echoes the inputs it was given', () => {
    const results = evaluateSeals({
      stats: stats(50, { power: 150, resonance: -20 }),
      esmsBalances: holdings(0, { substance: 7.25, essence: 3 }),
    })
    expect(byId(results, 'crucible-finisher').statRating).toBe(99)
    expect(byId(results, 'tidal-chorus').statRating).toBe(25)
    // Each Seal reports the balance of ITS token, untouched.
    expect(byId(results, 'crucible-finisher').balance).toBe(7.25)
    expect(byId(results, 'tidal-chorus').balance).toBe(3)
    expect(byId(results, 'harmonic-sovereign').balance).toBe(3)
    expect(byId(results, 'astral-vision').balance).toBe(0)
    expect(results.map(r => r.id)).toEqual(SEAL_CATALOG.map(b => b.id))
  })

  it('earnedSeals keeps exactly the Seals that have a tier, in catalog order', () => {
    const results = evaluateSeals({
      stats: stats(100),
      esmsBalances: holdings(0, { spirit: 1, matter: 3 }),
    })
    // Spirit 1 clears Copper (0.5) only; Matter 3 clears Silver (2); Essence/Substance are empty.
    const earned = earnedSeals(results)
    expect(earned.map(r => r.id)).toEqual([
      'astral-vision',
      'immovable-foundation',
      'quicksilver-pivot',
      'philosophers-stone',
    ])
    expect(earned.map(r => r.tier)).toEqual(['Copper', 'Silver', 'Copper', 'Silver'])
    expect(earnedSeals([])).toEqual([])
  })

  it('is monotone: more of any stat or any balance never lowers a tier (seeded property)', () => {
    let seed = 0x51ed270b
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 2 ** 32
    }
    for (let i = 0; i < 300; i++) {
      const s = {} as CoreStats
      for (const k of CORE_STAT_KEYS) s[k] = Math.round(60 + rand() * 40)
      const h = holdings(0, {
        spirit: rand() * 400,
        essence: rand() * 400,
        matter: rand() * 400,
        substance: rand() * 400,
      })
      const natalChart = rand() < 0.5 ? chart('computed') : null
      const before = evaluateSeals({ stats: s, esmsBalances: h, natalChart })

      for (const k of CORE_STAT_KEYS) {
        const after = evaluateSeals({
          stats: { ...s, [k]: Math.min(100, s[k] + 3) },
          esmsBalances: h,
          natalChart,
        })
        after.forEach((r, j) =>
          expect(tierIndex(r.tier), `${k} on ${r.id}`).toBeGreaterThanOrEqual(
            tierIndex(before[j].tier)
          )
        )
      }
      for (const t of ['spirit', 'essence', 'matter', 'substance'] as const) {
        const after = evaluateSeals({
          stats: s,
          esmsBalances: { ...h, [t]: h[t] * 1.5 + 1 },
          natalChart,
        })
        after.forEach((r, j) =>
          expect(tierIndex(r.tier), `${t} on ${r.id}`).toBeGreaterThanOrEqual(
            tierIndex(before[j].tier)
          )
        )
      }
    }
  })
})

describe('Seal tiers against an independent oracle', () => {
  it('uses the engine’s league means (re-pin LITERAL_MEANS here if STAT_BASELINES is re-measured)', () => {
    for (const key of CORE_STAT_KEYS) {
      expect(STAT_BASELINES[key].mean, key).toBe(LITERAL_MEANS[key])
    }
    expect(GLOBAL_ROSTER_MEAN).toBeCloseTo(LITERAL_GLOBAL_MEAN, 12)
  })

  // 0 and 1000 bracket everything; each gate is probed one cent below and exactly on it.
  const BALANCES = [0, 1000, ...LITERAL_GATES.flatMap(g => [g.balance - 0.01, g.balance])]
  const STAT_VALUES = Array.from({ length: 101 }, (_, i) => i)
  const AFFINITIES: Array<number | null> = [null, 3, 4, 10]

  for (const token of ESMS_TOKENS) {
    for (const affinity of AFFINITIES) {
      it(`matches tier, next tier, blockers and ceiling for every stat 0–100 — ${token} Seals, ${
        affinity === null ? 'no chart' : `${affinity} bodies in the element`
      }`, () => {
        const natalChart = affinity === null ? null : chartWithAffinity(token, affinity)
        const sealsOfToken = SEAL_CATALOG.filter(seal => seal.token === token)
        expect(sealsOfToken.length).toBeGreaterThan(0)

        const mismatches: unknown[] = []
        for (const value of STAT_VALUES) {
          for (const balance of BALANCES) {
            const results = evaluateSeals({
              stats: stats(value),
              esmsBalances: holdings(balance),
              natalChart,
            })
            for (const seal of sealsOfToken) {
              const got = readSeal(byId(results, seal.id))
              const want = oracleSeal(seal.stat, value, balance, affinity)
              if (JSON.stringify(got) !== JSON.stringify(want)) {
                mismatches.push({ seal: seal.id, value, balance, got, want })
              }
            }
          }
        }
        expect(mismatches.slice(0, 3)).toEqual([])
      })
    }
  }

  it('is not vacuous: the sweep reaches every tier (and null) that each Seal can ever show', () => {
    for (const seal of SEAL_CATALOG) {
      const seen = new Set<string>()
      for (const value of STAT_VALUES) {
        for (const balance of BALANCES) {
          seen.add(String(oracleSeal(seal.stat, value, balance, 10).tier))
        }
      }
      const reachable = seal.stat === 'power' ? 5 : 6 // null + 4 or 5 tiers
      expect(seen.size, seal.id).toBe(reachable)
      expect(seen.has('Celestial'), seal.id).toBe(seal.stat !== 'power')
    }
  })

  it('clears a balance gate exactly at the gate and not one cent below it', () => {
    // Stat 100 clears every rating gate (Crucible Finisher's aligned ceiling is 93.5, Aether).
    for (const gate of LITERAL_GATES.filter(g => g.tier !== 'Celestial')) {
      const at = byId(
        evaluateSeals({ stats: stats(100), esmsBalances: holdings(gate.balance) }),
        'astral-vision'
      )
      const below = byId(
        evaluateSeals({ stats: stats(100), esmsBalances: holdings(gate.balance - 0.01) }),
        'astral-vision'
      )
      expect(at.tier, gate.tier).toBe(gate.tier)
      expect(tierIndex(below.tier), gate.tier).toBe(tierIndex(gate.tier) - 1)
      expect(below.blockedBy, gate.tier).toEqual(['esms'])
    }
    const celestial = chartWithAffinity('spirit', 4)
    const atGate = evaluateSeals({
      stats: stats(100),
      esmsBalances: holdings(250),
      natalChart: celestial,
    })
    const belowGate = evaluateSeals({
      stats: stats(100),
      esmsBalances: holdings(249.99),
      natalChart: celestial,
    })
    expect(byId(atGate, 'astral-vision').tier).toBe('Celestial')
    expect(byId(belowGate, 'astral-vision').tier).toBe('Aether')
    expect(byId(belowGate, 'astral-vision').blockedBy).toEqual(['esms'])
  })

  it('needs four bodies in the token’s element for Celestial — three is not enough', () => {
    for (const token of ESMS_TOKENS) {
      const sealsOfToken = SEAL_CATALOG.filter(s => s.token === token && s.stat !== 'power')
      for (const [count, expected] of [
        [0, 'Aether'],
        [3, 'Aether'],
        [4, 'Celestial'],
        [5, 'Celestial'],
        [10, 'Celestial'],
      ] as const) {
        const results = evaluateSeals({
          stats: stats(100),
          esmsBalances: holdings(1000),
          natalChart: chartWithAffinity(token, count),
        })
        for (const seal of sealsOfToken) {
          const got = byId(results, seal.id)
          expect(got.natalAffinity, `${token} ${count}`).toBe(count)
          expect(got.tier, `${seal.id} with ${count} ${token} bodies`).toBe(expected)
          expect(got.blockedBy, `${seal.id} ${count}`).toEqual(
            expected === 'Aether' ? ['natal'] : []
          )
        }
      }
    }
  })

  it('counts each of the ten classical bodies toward the affinity — and nothing else', () => {
    for (const body of BODY_NAMES) {
      expect(natalAffinity({ planets: { [body]: { sign: 'Aries' } } }, 'spirit'), body).toBe(1)
      expect(natalAffinity({ planets: { [body]: { sign: 'Taurus' } } }, 'spirit'), body).toBe(0)
    }
    expect(
      natalAffinity(
        {
          planets: {
            Chiron: { sign: 'Aries' },
            Lilith: { sign: 'Aries' },
            NorthNode: { sign: 'Aries' },
            Ascendant: { sign: 'Aries' },
            Midheaven: { sign: 'Aries' },
          },
        },
        'spirit'
      )
    ).toBe(0)
  })

  it('maps each token to its element: Spirit Fire, Essence Water, Matter Earth, Substance Air', () => {
    const fireOnly = { planets: { Sun: { sign: 'Leo' }, Moon: { sign: 'Sagittarius' } } }
    const waterOnly = { planets: { Sun: { sign: 'Scorpio' }, Moon: { sign: 'Pisces' } } }
    const earthOnly = { planets: { Sun: { sign: 'Virgo' }, Moon: { sign: 'Capricorn' } } }
    const airOnly = { planets: { Sun: { sign: 'Libra' }, Moon: { sign: 'Aquarius' } } }
    const table: Array<[NatalChartInput, EsmsToken]> = [
      [fireOnly, 'spirit'],
      [waterOnly, 'essence'],
      [earthOnly, 'matter'],
      [airOnly, 'substance'],
    ]
    for (const [natalChart, owner] of table) {
      for (const token of ESMS_TOKENS) {
        expect(natalAffinity(natalChart, token), `${owner} chart read as ${token}`).toBe(
          token === owner ? 2 : 0
        )
      }
    }
  })
})

describe('maxTier and nextTier', () => {
  const LITERAL_MAX_TIER: Record<string, SealTier> = {
    'crucible-finisher': 'Aether',
    'astral-vision': 'Celestial',
    'immovable-foundation': 'Celestial',
    'harmonic-sovereign': 'Celestial',
    'tidal-chorus': 'Celestial',
    'quicksilver-pivot': 'Celestial',
    'philosophers-stone': 'Celestial',
  }

  it('pins every Seal’s maxTier: Aether for Crucible Finisher, Celestial for the other six', () => {
    const results = evaluateSeals({ stats: stats(50), esmsBalances: holdings(0) })
    expect(Object.fromEntries(results.map(r => [r.id, r.maxTier]))).toEqual(LITERAL_MAX_TIER)
  })

  it('never changes maxTier with the stats, balances or chart', () => {
    for (const value of [0, 25, 50, 75, 99, 100]) {
      for (const balance of [0, 0.5, 49.99, 250, 1000]) {
        for (const natalChart of [
          null,
          chartWithAffinity('spirit', 4),
          chartWithAffinity('substance', 10),
          { ...chartWithAffinity('spirit', 10), provenance: 'placeholder' as const },
        ]) {
          const results = evaluateSeals({
            stats: stats(value),
            esmsBalances: holdings(balance),
            natalChart,
          })
          for (const r of results) {
            expect(r.maxTier, `${r.id} stat ${value} balance ${balance}`).toBe(
              LITERAL_MAX_TIER[r.id]
            )
          }
        }
      }
    }
  })

  it('leaves a perfect, fully funded power vessel at Aether with nothing above it', () => {
    for (const natalChart of [null, chartWithAffinity('substance', 10)]) {
      const crucible = byId(
        evaluateSeals({ stats: stats(100), esmsBalances: holdings(1000), natalChart }),
        'crucible-finisher'
      )
      expect(crucible.tier).toBe('Aether')
      expect(crucible.maxTier).toBe('Aether')
      expect(crucible.nextTier).toBeNull()
      expect(crucible.blockedBy).toEqual([])
      expect(crucible.alignedRating).toBeCloseTo(93.5, 1)
    }
  })

  it('shows every other perfect vessel at Aether with Celestial next, blocked only on the chart', () => {
    const results = evaluateSeals({ stats: stats(100), esmsBalances: holdings(1000) })
    for (const r of results.filter(x => x.id !== 'crucible-finisher')) {
      expect(r.tier, r.id).toBe('Aether')
      expect(r.nextTier, r.id).toBe('Celestial')
      expect(r.blockedBy, r.id).toEqual(['natal'])
    }
  })

  it('has no next tier once Celestial is cleared', () => {
    const results = evaluateSeals({
      stats: stats(100),
      esmsBalances: holdings(1000),
      natalChart: chartWithAffinity('spirit', 4),
    })
    const astral = byId(results, 'astral-vision')
    expect(astral.tier).toBe('Celestial')
    expect(astral.nextTier).toBeNull()
    expect(astral.blockedBy).toEqual([])
  })

  it('steps one tier at a time as Spirit is added: Copper, Silver, Gold, Aether, Celestial', () => {
    const natalChart = chartWithAffinity('spirit', 4)
    const ladder: Array<[number, SealTier | null, SealTier | null]> = [
      [0, null, 'Copper'],
      [0.5, 'Copper', 'Silver'],
      [2, 'Silver', 'Gold'],
      [10, 'Gold', 'Aether'],
      [50, 'Aether', 'Celestial'],
      [250, 'Celestial', null],
    ]
    for (const [spirit, tier, nextTier] of ladder) {
      const astral = byId(
        evaluateSeals({
          stats: stats(100),
          esmsBalances: holdings(0, { spirit }),
          natalChart,
        }),
        'astral-vision'
      )
      expect(astral.tier, `${spirit} Spirit`).toBe(tier)
      expect(astral.nextTier, `${spirit} Spirit`).toBe(nextTier)
      expect(astral.blockedBy, `${spirit} Spirit`).toEqual(nextTier === null ? [] : ['esms'])
    }
  })

  it('lists every blocker, in the order stat, esms, natal', () => {
    // Intuition 93 rates 94 and aligns to 93.16: Aether on the stat, but short of Celestial's 96.
    // 100 Spirit clears Aether's 50 and is short of Celestial's 250; no chart at all.
    const astral = byId(
      evaluateSeals({
        stats: stats(50, { intuition: 93 }),
        esmsBalances: holdings(0, { spirit: 100 }),
      }),
      'astral-vision'
    )
    expect(astral.statRating).toBe(94)
    expect(astral.alignedRating).toBeCloseTo(93.16, 2)
    expect(astral.tier).toBe('Aether')
    expect(astral.nextTier).toBe('Celestial')
    expect(astral.blockedBy).toEqual(['stat', 'esms', 'natal'])

    // Nothing at all: Copper is blocked on stat and balance, not on the chart.
    const nothing = byId(
      evaluateSeals({ stats: stats(0), esmsBalances: holdings(0) }),
      'astral-vision'
    )
    expect(nothing.tier).toBeNull()
    expect(nothing.nextTier).toBe('Copper')
    expect(nothing.blockedBy).toEqual(['stat', 'esms'])
  })
})

describe('Seals across the historical roster', () => {
  it('gives a pyramid, not a flat field, when holdings are not the constraint', () => {
    const tiers = HISTORICAL_AGENTS.flatMap(agent =>
      evaluateSeals({ stats: deriveSacredStats(agent), esmsBalances: holdings(1000) }).map(r =>
        tierIndex(r.tier)
      )
    )
    const share = (atLeast: number) => tiers.filter(t => t >= atLeast).length / tiers.length
    // Measured with mean-aligned gates: Copper+ 0.65, Silver+ 0.28, Gold+ 0.02, Aether+ 0.00.
    expect(share(0)).toBeGreaterThan(0.5)
    expect(share(0)).toBeLessThan(0.85)
    expect(share(1)).toBeGreaterThan(0.15)
    expect(share(1)).toBeLessThan(0.45)
    expect(share(2)).toBeLessThan(0.06)
    expect(share(3)).toBeLessThan(0.01)
    // No chart, so Celestial is out of reach — and natal stats alone never get near it.
    expect(share(4)).toBe(0)
  })

  it('caps an agent’s own alchemical elements at Copper (the off-chain baseline)', () => {
    const preview = HISTORICAL_AGENTS.filter(a => a.consciousness.alchemicalElements)
    expect(preview.length).toBeGreaterThan(0)
    for (const agent of preview) {
      const { spirit, essence, matter, substance } = agent.consciousness.alchemicalElements!
      const results = evaluateSeals({
        stats: deriveSacredStats(agent),
        esmsBalances: { spirit, essence, matter, substance },
        natalChart: agent.consciousness.natalChart,
      })
      for (const r of results) {
        expect(tierIndex(r.tier), `${agent.id} ${r.id}`).toBeLessThanOrEqual(0)
      }
    }
  })
})

describe('calculateResonanceSurge', () => {
  // A unit calibration keeps the arithmetic exact: heat 5 of 10 is 0.5.
  const unit: SurgeCalibration = {
    heat: { low: 0, high: 10 },
    reactivity: { low: 0, high: 10 },
  }
  const run = (heat: number, reactivity: number, calibration = unit) =>
    calculateResonanceSurge({ thermodynamics: { heat, reactivity } }, calibration)

  it('reads 0 at the low anchors and 100 at the high anchors', () => {
    const { heat, reactivity } = DEFAULT_SURGE_CALIBRATION
    const calm = calculateResonanceSurge({
      thermodynamics: { heat: heat.low, reactivity: reactivity.low },
    })
    expect(calm).toMatchObject({ meter: 0, active: false, statBoosts: {} })

    const storm = calculateResonanceSurge({
      thermodynamics: { heat: heat.high, reactivity: reactivity.high },
    })
    expect(storm.meter).toBe(100)
    expect(storm.active).toBe(true)
    expect(storm.components).toEqual({ heat: 1, reactivity: 1 })
  })

  it('clamps beyond the anchors rather than overshooting', () => {
    expect(run(-3, -3).meter).toBe(0)
    expect(run(500, 500).meter).toBe(100)
  })

  it('splits the meter evenly between heat and reactivity', () => {
    expect(run(10, 0).meter).toBe(50)
    expect(run(0, 10).meter).toBe(50)
    expect(run(5, 5).meter).toBe(50)
  })

  it('pins the surge constants as literals', () => {
    expect(SURGE_ACTIVE_AT).toBe(70)
    expect(MAX_SURGE_BOOST).toBe(10)
    expect(HARMONY_MAX_OFFSET).toBe(12)
  })

  it('is inactive well below the threshold and boosts nothing', () => {
    const s = run(10, 3) // 50 + 15 = 65
    expect(s.meter).toBe(65)
    expect(s.active).toBe(false)
    expect(s.statBoosts).toEqual({})
  })

  it('activates at a meter of exactly 70, and not at 69.5', () => {
    const at = run(10, 4) // 50 + 20
    expect(at.meter).toBeCloseTo(70, 9)
    expect(at.active).toBe(true)
    expect(at.surgeType).toBe('inferno')
    expect(at.statBoosts).toEqual({ resonance: 7, charisma: 7 })

    const below = run(10, 3.9) // 50 + 19.5
    expect(below.meter).toBeCloseTo(69.5, 9)
    expect(below.active).toBe(false)
    expect(below.statBoosts).toEqual({})
  })

  it('scales the boost with the meter and rounds it to the nearest stat point', () => {
    // meter = 50 + 5·reactivity (heat pinned at its high anchor). Boost = round(10 · meter / 100).
    const table: Array<[number, number, number]> = [
      [4, 70, 7], // 7.0
      [4.2, 71, 7], // 7.1  (Math.ceil would give 8)
      [4.8, 74, 7], // 7.4
      [4.9, 74.5, 7], // 7.45 (a divisor of 99 instead of 100 would round this up to 8)
      [5, 75, 8], // 7.5  (Math.floor would give 7)
      [5.2, 76, 8], // 7.6
      [6, 80, 8], // 8.0
      [6.9, 84.5, 8], // 8.45
      [7, 85, 9], // 8.5  rounds half up
      [8, 90, 9], // 9.0
      [8.9, 94.5, 9], // 9.45
      [9, 95, 10], // 9.5  rounds half up
      [10, 100, 10], // the maximum
    ]
    for (const [reactivity, meter, boost] of table) {
      const s = run(10, reactivity)
      expect(s.meter, `reactivity ${reactivity}`).toBeCloseTo(meter, 9)
      expect(s.active, `reactivity ${reactivity}`).toBe(true)
      expect(s.statBoosts, `reactivity ${reactivity}`).toEqual({
        resonance: boost,
        charisma: boost,
      })
    }
  })

  it('reports each quantity’s share on its own calibration, clamped to 0–1 without touching skyMeter’s scale', () => {
    // heat ramps 2→6 and reactivity 1→5: at 4 they are 0.5 and 0.75, so swapping them shows.
    const asymmetric: SurgeCalibration = {
      heat: { low: 2, high: 6 },
      reactivity: { low: 1, high: 5 },
    }
    const mid = run(4, 4, asymmetric)
    expect(mid.components).toEqual({ heat: 0.5, reactivity: 0.75 })
    // The type follows the SHARES, not the raw values (which tie at 4 and 4 here).
    expect(mid.surgeType).toBe('tempest')
    expect(run(5, 4, asymmetric).surgeType).toBe('inferno') // heat 0.75 against reactivity 0.75
    expect(run(5.9, 4, asymmetric).components.heat).toBeCloseTo(0.975, 9)
    expect(mid.skyMeter).toBeCloseTo(62.5, 9)
    expect(mid.meter).toBeCloseTo(62.5, 9)

    // Each quantity is clamped on its own, below low and above high.
    expect(run(-3, 10).components).toEqual({ heat: 0, reactivity: 1 })
    expect(run(-3, 10).skyMeter).toBe(50)
    expect(run(500, 0).components).toEqual({ heat: 1, reactivity: 0 })
    expect(run(500, 0).skyMeter).toBe(50)
    expect(run(2, 0, asymmetric).components).toEqual({ heat: 0, reactivity: 0 })
    expect(run(6, 5, asymmetric).components).toEqual({ heat: 1, reactivity: 1 })
    expect(run(-1e9, -1e9).skyMeter).toBe(0)
    expect(run(1e9, 1e9).skyMeter).toBe(100)
  })

  it('reads the default calibration when none is given, and a custom one otherwise', () => {
    const thermodynamics = { heat: 0.06, reactivity: 1.5 }
    const byDefault = calculateResonanceSurge({ thermodynamics })
    expect(byDefault).toEqual(
      calculateResonanceSurge({ thermodynamics }, DEFAULT_SURGE_CALIBRATION)
    )
    expect(byDefault.meter).not.toBeCloseTo(run(0.06, 1.5).meter, 1)
    // heat (0.06 − 0.0184) / 0.097 = 0.4289, reactivity (1.5 − 0.561) / 3.025 = 0.3104.
    expect(byDefault.components.heat).toBeCloseTo(0.4289, 4)
    expect(byDefault.components.reactivity).toBeCloseTo(0.3104, 4)
    expect(byDefault.skyMeter).toBeCloseTo(36.964, 2)
  })

  it('pins the default anchors as literals (re-pin here AND per surge-calibration.spec.ts)', () => {
    // surge-calibration.spec.ts re-measures the live sky and tolerates ±10%, so a quiet drift of
    // an anchor inside that band would otherwise go unnoticed. Changing an anchor is a decision.
    expect(DEFAULT_SURGE_CALIBRATION).toEqual({
      heat: { low: 0.0184, high: 0.1154 },
      reactivity: { low: 0.561, high: 3.586 },
    })
  })

  it('boosts the heat-linked stats when heat leads', () => {
    const s = run(10, 5) // meter 75 → round(10 · 0.75) = 8
    expect(s.meter).toBe(75)
    expect(s.active).toBe(true)
    expect(s.surgeType).toBe('inferno')
    expect(s.statBoosts).toEqual({ resonance: 8, charisma: 8 })
  })

  it('boosts the reactivity-linked stats when reactivity leads', () => {
    const s = run(5, 10)
    expect(s.surgeType).toBe('tempest')
    expect(s.statBoosts).toEqual({ intuition: 8, adaptability: 8 })
  })

  it('breaks an exact heat/reactivity tie toward inferno, and caps boosts at the maximum', () => {
    expect(run(0, 0).surgeType).toBe('inferno')
    const full = run(10, 10)
    expect(full.statBoosts).toEqual({ resonance: MAX_SURGE_BOOST, charisma: MAX_SURGE_BOOST })
  })

  it('keeps `active` exactly equal to `meter >= 70` — a literal, not the constant under test', () => {
    for (let h = 0; h <= 10; h += 0.5) {
      for (let r = 0; r <= 10; r += 0.5) {
        const s = run(h, r)
        // `active` is decided on the very same double that `meter` reports.
        expect(s.active, `heat ${h} reactivity ${r}`).toBe(s.meter >= 70)
        expect(Object.keys(s.statBoosts).length > 0).toBe(s.active)
      }
    }
  })

  it('never moves the meter with Monica, and treats ABSENT (null) like any other value', () => {
    const thermodynamics = { heat: 0.05, reactivity: 2.1 }
    const baseline = calculateResonanceSurge({ thermodynamics })
    for (const monica of [null, undefined, MONICA_EQUILIBRIUM, -3.2, 0, 1e9]) {
      const state = calculateResonanceSurge({ thermodynamics, monica })
      // Everything the meter feeds is identical; only the Monica classification differs.
      expect({ ...state, monicaState: undefined }, String(monica)).toEqual({
        ...baseline,
        monicaState: undefined,
      })
    }
    expect(() => calculateResonanceSurge({ thermodynamics, monica: Number.NaN })).toThrow(/Monica/)
  })

  it('classifies Monica: absent, equilibrium, convergent, divergent', () => {
    expect(classifyMonica(null)).toBe('absent')
    expect(classifyMonica(undefined)).toBe('absent')
    expect(classifyMonica(MONICA_EQUILIBRIUM)).toBe('equilibrium')
    expect(classifyMonica(1.6180000001)).toBe('convergent') // equilibrium is the exact constant
    expect(classifyMonica(0.3)).toBe('convergent')
    expect(classifyMonica(-0.3)).toBe('divergent')
    expect(classifyMonica(0)).toBe('divergent') // not produced by the engine; not positive
    expect(() => classifyMonica(Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(run(5, 5).monicaState).toBe('absent') // omitted Monica is ABSENT, never a number
  })

  it('draws Monica’s boundaries exactly: 1.618 is equilibrium, a hair either side is not', () => {
    expect(MONICA_EQUILIBRIUM).toBe(1.618) // the engine's constant, written out
    expect(classifyMonica(1.618)).toBe('equilibrium')
    expect(classifyMonica(1.6180001)).toBe('convergent')
    expect(classifyMonica(1.6179999)).toBe('convergent')
    expect(classifyMonica(-1.618)).toBe('divergent') // the sign matters: -φ is not equilibrium
    // Zero is not a value the engine produces. It is not positive, so it is divergent — and
    // so is negative zero (-0 > 0 is false); the smallest positive and negative doubles flank it.
    expect(classifyMonica(0)).toBe('divergent')
    expect(classifyMonica(-0)).toBe('divergent')
    expect(classifyMonica(Number.MIN_VALUE)).toBe('convergent')
    expect(classifyMonica(-Number.MIN_VALUE)).toBe('divergent')
    expect(classifyMonica(Number.MAX_VALUE)).toBe('convergent')
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => classifyMonica(bad), String(bad)).toThrow(RangeError)
      expect(() => classifyMonica(bad), String(bad)).toThrow(/finite number or null/)
    }
  })

  it('reports the classification on the surge state, for every Monica state', () => {
    const states: Array<[number | null | undefined, string]> = [
      [null, 'absent'],
      [undefined, 'absent'],
      [1.618, 'equilibrium'],
      [0.3, 'convergent'],
      [-0.3, 'divergent'],
      [0, 'divergent'],
    ]
    for (const [monica, expected] of states) {
      expect(
        calculateResonanceSurge({ thermodynamics: { heat: 5, reactivity: 5 }, monica }, unit)
          .monicaState
      ).toBe(expected)
    }
  })

  it('upgrades an ACTIVE surge at Monica equilibrium to the dual type with the union of boosts', () => {
    const dual = calculateResonanceSurge(
      { thermodynamics: { heat: 10, reactivity: 5 }, monica: MONICA_EQUILIBRIUM },
      unit
    )
    expect(dual.active).toBe(true)
    expect(dual.surgeType).toBe('equilibrium')
    expect(dual.monicaState).toBe('equilibrium')
    expect(dual.meter).toBe(75) // Monica did not move the meter
    expect(dual.statBoosts).toEqual({ resonance: 8, charisma: 8, intuition: 8, adaptability: 8 })

    // The same sky without equilibrium keeps its single type.
    const single = calculateResonanceSurge(
      { thermodynamics: { heat: 10, reactivity: 5 }, monica: 2.2 },
      unit
    )
    expect(single.surgeType).toBe('inferno')
    expect(single.monicaState).toBe('convergent')
    expect(single.statBoosts).toEqual({ resonance: 8, charisma: 8 })
  })

  it('upgrades exactly at the activation threshold, and not a hair below it', () => {
    const atThreshold = calculateResonanceSurge(
      { thermodynamics: { heat: 10, reactivity: 4 }, monica: 1.618 },
      unit
    )
    expect(atThreshold.meter).toBeCloseTo(70, 9)
    expect(atThreshold.active).toBe(true)
    expect(atThreshold.surgeType).toBe('equilibrium')
    expect(atThreshold.statBoosts).toEqual({
      resonance: 7,
      charisma: 7,
      intuition: 7,
      adaptability: 7,
    })

    const justBelow = calculateResonanceSurge(
      { thermodynamics: { heat: 10, reactivity: 3.9 }, monica: 1.618 },
      unit
    )
    expect(justBelow.meter).toBeCloseTo(69.5, 9)
    expect(justBelow.active).toBe(false)
    expect(justBelow.surgeType).toBe('inferno')
    expect(justBelow.statBoosts).toEqual({})
  })

  it('boosts the union of both types — and only those four stats — whichever type leads', () => {
    for (const [heat, reactivity, building] of [
      [10, 5, 'inferno'],
      [5, 10, 'tempest'],
    ] as const) {
      const dual = calculateResonanceSurge(
        { thermodynamics: { heat, reactivity }, monica: 1.618 },
        unit
      )
      expect(dual.surgeType, building).toBe('equilibrium')
      expect(Object.keys(dual.statBoosts).sort(), building).toEqual([
        'adaptability',
        'charisma',
        'intuition',
        'resonance',
      ])
      expect(new Set(Object.values(dual.statBoosts)), building).toEqual(new Set([8]))
    }
  })

  it('upgrades only at EXACT equilibrium: absent, convergent and divergent Monica keep the single type', () => {
    for (const monica of [null, undefined, 1.6180001, 1.6179999, 0.3, 0, -0, -1.618, -3]) {
      const state = calculateResonanceSurge(
        { thermodynamics: { heat: 10, reactivity: 5 }, monica },
        unit
      )
      expect(state.active, String(monica)).toBe(true)
      expect(state.surgeType, String(monica)).toBe('inferno')
      expect(state.statBoosts, String(monica)).toEqual({ resonance: 8, charisma: 8 })
    }
  })

  it('names the type the meter is building toward even while quiet, and breaks ties toward inferno', () => {
    const calm = run(2, 4) // meter 30, reactivity leads
    expect(calm.active).toBe(false)
    expect(calm.surgeType).toBe('tempest')
    expect(calm.statBoosts).toEqual({})
    expect(run(4, 2).surgeType).toBe('inferno')
    // A one-in-a-million lead is still a lead; an exact tie is not.
    expect(run(5, 5.000001).surgeType).toBe('tempest')
    expect(run(5, 4.999999).surgeType).toBe('inferno')
    expect(run(5, 5).surgeType).toBe('inferno')
    expect(run(3, 3).components.heat).toBe(run(3, 3).components.reactivity)
    // On the real anchors the raw numbers differ by ~30×, so only the shares can be compared:
    // a hot, quiet sky is heat-led although its reactivity figure is the bigger number.
    const hot = calculateResonanceSurge({ thermodynamics: { heat: 0.1154, reactivity: 0.6 } })
    expect(hot.surgeType).toBe('inferno')
    const stormy = calculateResonanceSurge({ thermodynamics: { heat: 0.0184, reactivity: 3.586 } })
    expect(stormy.surgeType).toBe('tempest')
  })

  it('does not upgrade an INACTIVE surge, whatever Monica says', () => {
    const quiet = calculateResonanceSurge(
      { thermodynamics: { heat: 10, reactivity: 3 }, monica: MONICA_EQUILIBRIUM },
      unit
    ) // meter 65
    expect(quiet.active).toBe(false)
    expect(quiet.surgeType).toBe('inferno')
    expect(quiet.monicaState).toBe('equilibrium')
    expect(quiet.statBoosts).toEqual({})
  })

  it('takes the canonical engine’s output directly, including an absent Monica', () => {
    const axes = {
      spirit: 1,
      essence: 1,
      matter: 1,
      substance: 1,
      fire: 1,
      water: 1,
      air: 1,
      earth: 1,
    }
    const thermodynamics = calculateThermodynamics(axes)
    const present = calculateMonica({
      energy: thermodynamics.gregsEnergy,
      reactivity: thermodynamics.reactivity,
      kalchm: 1,
    })
    expect(present).toBe(MONICA_EQUILIBRIUM)

    const absent = calculateMonica({ energy: Number.NaN, reactivity: 1, kalchm: 2 })
    expect(absent).toBeNull()

    // The full `Thermodynamics` object (with entropy and gregsEnergy) is accepted as-is.
    const withPresent = calculateResonanceSurge({ thermodynamics, monica: present })
    const withAbsent = calculateResonanceSurge({ thermodynamics, monica: absent })
    expect(withPresent.monicaState).toBe('equilibrium')
    expect(withAbsent.monicaState).toBe('absent')
    expect({ ...withAbsent, monicaState: undefined }).toEqual({
      ...withPresent,
      monicaState: undefined,
    })
    expect(Number.isFinite(withAbsent.meter)).toBe(true)
  })

  it('is monotone: more heat or reactivity never lowers the meter or deactivates it', () => {
    let seed = 0x7a3d9c15
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 2 ** 32
    }
    for (let i = 0; i < 500; i++) {
      const heat = rand() * 0.2
      const reactivity = rand() * 5
      const before = calculateResonanceSurge({ thermodynamics: { heat, reactivity } })
      for (const next of [
        { heat: heat * 1.1 + 0.001, reactivity },
        { heat, reactivity: reactivity * 1.1 + 0.01 },
      ]) {
        const after = calculateResonanceSurge({ thermodynamics: next })
        expect(after.meter).toBeGreaterThanOrEqual(before.meter)
        if (before.active) expect(after.active).toBe(true)
      }
    }
  })

  it('refuses non-finite thermodynamics and degenerate calibration', () => {
    expect(() => run(Number.NaN, 1)).toThrow(RangeError)
    expect(() => run(1, Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => run(1, 1, { ...unit, heat: { low: 5, high: 5 } })).toThrow(/heat calibration/)
  })

  it('refuses thermodynamics when EITHER quantity is non-finite', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => run(bad, 1), `heat ${bad}`).toThrow(/non-finite thermodynamics/)
      expect(() => run(1, bad), `reactivity ${bad}`).toThrow(/non-finite thermodynamics/)
      expect(() => run(bad, bad), `both ${bad}`).toThrow(RangeError)
    }
  })

  it('rejects an invalid calibration for either quantity, naming it', () => {
    const invalid: Array<[string, { low: number; high: number }]> = [
      ['equal anchors', { low: 5, high: 5 }],
      ['reversed anchors', { low: 6, high: 5 }],
      ['NaN low', { low: Number.NaN, high: 5 }],
      ['NaN high', { low: 0, high: Number.NaN }],
      ['infinite high', { low: 0, high: Number.POSITIVE_INFINITY }],
      ['infinite low', { low: Number.NEGATIVE_INFINITY, high: 0 }],
      ['both infinite', { low: Number.NEGATIVE_INFINITY, high: Number.POSITIVE_INFINITY }],
    ]
    for (const [label, bad] of invalid) {
      expect(() => run(1, 1, { ...unit, heat: bad }), `heat ${label}`).toThrow(RangeError)
      expect(() => run(1, 1, { ...unit, heat: bad }), `heat ${label}`).toThrow(/heat calibration/)
      expect(() => run(1, 1, { ...unit, reactivity: bad }), `reactivity ${label}`).toThrow(
        /reactivity calibration/
      )
    }
    // The smallest valid gap, a negative-anchored ramp and a wide one all pass.
    expect(() => run(1, 1, { ...unit, heat: { low: 0, high: Number.MIN_VALUE } })).not.toThrow()
    expect(() => run(1, 1, { ...unit, heat: { low: -5, high: -1 } })).not.toThrow()
    expect(() => run(1, 1, { ...unit, reactivity: { low: -1e300, high: 1e300 } })).not.toThrow()
  })

  it('ramps linearly from low to high and ignores the order the two quantities arrive in', () => {
    const cal: SurgeCalibration = {
      heat: { low: -5, high: -1 },
      reactivity: { low: 100, high: 300 },
    }
    const s = run(-4, 150, cal) // heat (−4+5)/4 = 0.25, reactivity (150−100)/200 = 0.25
    expect(s.components).toEqual({ heat: 0.25, reactivity: 0.25 })
    expect(s.meter).toBeCloseTo(25, 9)
    const t = run(-3, 250, cal) // heat 0.5, reactivity 0.75
    expect(t.components).toEqual({ heat: 0.5, reactivity: 0.75 })
    expect(t.meter).toBeCloseTo(62.5, 9)
    expect(t.surgeType).toBe('tempest')
  })
})

describe('applyStatBoosts', () => {
  it('adds boosts, clamps at 100, leaves other stats alone, and does not mutate', () => {
    const before = stats(95, { wisdom: 50 })
    const frozen = { ...before }
    const after = applyStatBoosts(before, { resonance: 8, wisdom: 8 })
    expect(after.resonance).toBe(100)
    expect(after.wisdom).toBe(58)
    expect(after.power).toBe(95)
    expect(before).toEqual(frozen)
  })

  it('composes with calculateResonanceSurge', () => {
    const state = calculateResonanceSurge(
      { thermodynamics: { heat: 10, reactivity: 10 } },
      { heat: { low: 0, high: 10 }, reactivity: { low: 0, high: 10 } }
    )
    const boosted = applyStatBoosts(stats(60), state.statBoosts)
    expect(boosted.resonance).toBe(60 + MAX_SURGE_BOOST)
    expect(boosted.charisma).toBe(60 + MAX_SURGE_BOOST)
    expect(boosted.power).toBe(60)
  })
})

describe('mean-aligned Seal gates', () => {
  const ratingOfStat = (stat: number) => 25 + (stat / 100) * 74

  it('is the mean of the seven league means', () => {
    const means = CORE_STAT_KEYS.map(k => STAT_BASELINES[k].mean)
    expect(GLOBAL_ROSTER_MEAN).toBeCloseTo(means.reduce((a, b) => a + b, 0) / 7, 10)
    expect(GLOBAL_ROSTER_MEAN).toBeCloseTo(69.07, 2)
  })

  it('rates a stat at its own league mean as the common mean, for every stat', () => {
    for (const key of CORE_STAT_KEYS) {
      const atLeagueMean = ratingOfStat(STAT_BASELINES[key].mean)
      expect(computeMeanAlignedRating(key, atLeagueMean), key).toBeCloseTo(
        ratingOfStat(GLOBAL_ROSTER_MEAN),
        8
      )
    }
  })

  it('shifts in rating points (0.74 per stat point): power down, lower-mean stats up', () => {
    const perStatPoint = 74 / 100
    expect(computeMeanAlignedRating('power', 80)).toBeCloseTo(
      80 - perStatPoint * (STAT_BASELINES.power.mean - GLOBAL_ROSTER_MEAN),
      8
    )
    expect(computeMeanAlignedRating('power', 80)).toBeLessThan(80)
    expect(computeMeanAlignedRating('adaptability', 80)).toBeGreaterThan(80)
    // Never a rating-scale value minus a stat-scale one: the offset stays small (< 6 points).
    for (const key of CORE_STAT_KEYS) {
      expect(Math.abs(computeMeanAlignedRating(key, 80) - 80), key).toBeLessThan(6)
    }
  })

  it('refuses a non-finite rating', () => {
    expect(() => computeMeanAlignedRating('power', Number.NaN)).toThrow(RangeError)
  })

  it('only aligns the gate comparison: statRating and the radar stay on the raw scale', () => {
    const seal = byId(
      evaluateSeals({ stats: stats(50, { power: 90 }), esmsBalances: holdings(1000) }),
      'crucible-finisher'
    )
    expect(seal.statRating).toBe(toRating(90))
    expect(seal.alignedRating).toBeCloseTo(computeMeanAlignedRating('power', toRating(90)), 2)
    expect(seal.alignedRating).toBeLessThan(seal.statRating)
  })

  it('stops Crucible Finisher from out-awarding the other Seals across the roster', () => {
    const silver = SEAL_TIER_REQUIREMENTS.Silver.minRating
    const rawShare = (stat: (typeof CORE_STAT_KEYS)[number]) =>
      HISTORICAL_AGENTS.filter(a => toRating(deriveSacredStats(a)[stat], stat) >= silver).length /
      HISTORICAL_AGENTS.length
    const alignedShare = (stat: (typeof CORE_STAT_KEYS)[number]) =>
      HISTORICAL_AGENTS.filter(
        a => computeMeanAlignedRating(stat, toRating(deriveSacredStats(a)[stat], stat)) >= silver
      ).length / HISTORICAL_AGENTS.length
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
    const others = CORE_STAT_KEYS.filter(k => k !== 'power')

    // Measured: raw gates gave power Silver+ 0.64 against a median of 0.28 for the rest.
    expect(rawShare('power') / median(others.map(rawShare))).toBeGreaterThan(2)
    // Aligned: 0.35 against 0.28.
    expect(alignedShare('power') / median(others.map(alignedShare))).toBeLessThan(1.5)
    for (const k of others) {
      expect(alignedShare('power') / alignedShare(k), k).toBeLessThan(2)
    }
  })

  it('documents the cost: a perfect power stat aligns to 93.5, short of Celestial’s 96', () => {
    // Pure shift alignment lowers power’s ceiling by the size of its baseline lead. Crucible
    // Finisher can still reach Aether (91) with a near-perfect stat, but never Celestial.
    const ceiling = computeMeanAlignedRating('power', RATING_CEILING)
    expect(ceiling).toBeCloseTo(93.5, 1)
    expect(ceiling).toBeGreaterThanOrEqual(SEAL_TIER_REQUIREMENTS.Aether.minRating)
    expect(ceiling).toBeLessThan(SEAL_TIER_REQUIREMENTS.Celestial.minRating)
    for (const key of CORE_STAT_KEYS.filter(k => k !== 'power')) {
      expect(computeMeanAlignedRating(key, RATING_CEILING), key).toBeGreaterThanOrEqual(
        SEAL_TIER_REQUIREMENTS.Celestial.minRating
      )
    }
  })
})

describe('elemental harmony with the live sky', () => {
  const allIn = (sign: string): Record<string, { sign: string }> =>
    Object.fromEntries(
      [
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
      ].map(b => [b, { sign }])
    )
  const natal = (sign: string, provenance?: NatalChartInput['provenance']): NatalChartInput => ({
    planets: allIn(sign),
    provenance,
  })
  // heat/reactivity chosen so the shared-sky meter is exactly 50.
  const thermodynamics = { heat: 5, reactivity: 5 }
  const unitCal: SurgeCalibration = { heat: { low: 0, high: 10 }, reactivity: { low: 0, high: 10 } }
  const surge = (natalChart: NatalChartInput | null, sky: SkyBodies | null, t = thermodynamics) =>
    calculateResonanceSurge({ thermodynamics: t, natalChart, sky }, unitCal)

  it('is bounded: ±12 at the extremes, never more', () => {
    expect(HARMONY_MAX_OFFSET).toBe(12)
    expect(surge(natal('Aries'), allIn('Leo')).harmonyOffset).toBe(12) // Fire on Fire
    expect(surge(natal('Aries'), allIn('Pisces')).harmonyOffset).toBe(-12) // Fire against Water
    expect(surge(natal('Taurus'), allIn('Gemini')).harmonyOffset).toBe(-12) // Earth against Air
  })

  it('scores sympathetic and neutral pairs in between', () => {
    expect(surge(natal('Aries'), allIn('Gemini')).harmonyOffset).toBe(6) // Fire–Air
    expect(surge(natal('Taurus'), allIn('Cancer')).harmonyOffset).toBe(6) // Earth–Water
    expect(surge(natal('Aries'), allIn('Taurus')).harmonyOffset).toBe(0) // Fire–Earth
    expect(surge(natal('Gemini'), allIn('Cancer')).harmonyOffset).toBe(0) // Air–Water
  })

  it('moves the meter by the offset and keeps the pure sky meter alongside', () => {
    const harmonious = surge(natal('Aries'), allIn('Leo'))
    expect(harmonious.skyMeter).toBe(50)
    expect(harmonious.meter).toBe(62)
    const clashing = surge(natal('Aries'), allIn('Pisces'))
    expect(clashing.meter).toBe(38)
    expect(clashing.skyMeter).toBe(50)
  })

  it('clamps the adjusted meter to [0, 100]', () => {
    expect(surge(natal('Aries'), allIn('Leo'), { heat: 10, reactivity: 9.5 }).meter).toBe(100)
    expect(surge(natal('Aries'), allIn('Pisces'), { heat: 0.5, reactivity: 0.5 }).meter).toBe(0)
  })

  it('can tip an agent into a surge the shared sky alone would not trigger', () => {
    const t = { heat: 8, reactivity: 5.5 } // heat 0.8, reactivity 0.55 → sky meter 67.5
    const sky = surge(null, null, t)
    expect(sky.skyMeter).toBeCloseTo(67.5, 9)
    expect(sky.meter).toBeCloseTo(67.5, 9)
    expect(sky.active).toBe(false)
    expect(sky.statBoosts).toEqual({})

    const harmonious = surge(natal('Aries'), allIn('Leo'), t)
    expect(harmonious.skyMeter).toBeCloseTo(67.5, 9) // the shared sky is untouched …
    expect(harmonious.harmonyOffset).toBe(12)
    expect(harmonious.meter).toBeCloseTo(79.5, 9) // … the agent's meter is not
    expect(harmonious.active).toBe(true)
    expect(harmonious.surgeType).toBe('inferno')
    // The boost is sized from the harmony-adjusted meter: round(10 · 79.5 / 100) = 8.
    // A boost sized from the shared-sky meter would be round(6.75) = 7.
    expect(harmonious.statBoosts).toEqual({ resonance: 8, charisma: 8 })
  })

  it('can pull an agent out of a surge the shared sky alone would trigger', () => {
    const t = { heat: 10, reactivity: 5 } // sky meter 75: active on its own
    const alone = surge(null, null, t)
    expect(alone.active).toBe(true)
    expect(alone.statBoosts).toEqual({ resonance: 8, charisma: 8 })

    const clashing = surge(natal('Aries'), allIn('Pisces'), t)
    expect(clashing.skyMeter).toBeCloseTo(75, 9)
    expect(clashing.harmonyOffset).toBe(-12)
    expect(clashing.meter).toBeCloseTo(63, 9)
    expect(clashing.active).toBe(false) // judged on the adjusted meter, not the sky's
    expect(clashing.statBoosts).toEqual({})
    expect(clashing.surgeType).toBe('inferno') // the building type still follows heat vs reactivity
  })

  it('lets the harmony-adjusted meter, not the sky meter, reach the dual type', () => {
    const t = { heat: 8, reactivity: 5.5 }
    const dual = calculateResonanceSurge(
      { thermodynamics: t, natalChart: natal('Aries'), sky: allIn('Leo'), monica: 1.618 },
      unitCal
    )
    expect(dual.surgeType).toBe('equilibrium')
    expect(dual.statBoosts).toEqual({ resonance: 8, charisma: 8, intuition: 8, adaptability: 8 })
    const quiet = calculateResonanceSurge({ thermodynamics: t, monica: 1.618 }, unitCal)
    expect(quiet.surgeType).toBe('inferno') // 67.5 is below the threshold: no upgrade
  })

  it('rounds the offset to the nearest hundredth, in both directions', () => {
    // Seven bodies are compared, so the harmony is k/7 and the offset is 12k/7.
    const SEVEN = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const
    const withRelation = (matching: number, otherSign: string): [NatalChartInput, SkyBodies] => {
      const planets: Record<string, { sign: string }> = {}
      const skyBodies: SkyBodies = {}
      SEVEN.forEach((body, i) => {
        planets[body] = { sign: 'Aries' } // Fire, against…
        skyBodies[body] = { sign: i < matching ? otherSign : 'Taurus' } // …Leo/Pisces, or Earth (0)
      })
      return [{ planets, provenance: 'computed' }, skyBodies]
    }
    const offsetOf = (matching: number, otherSign: string) => {
      const [chart, sky] = withRelation(matching, otherSign)
      return surge(chart, sky).harmonyOffset
    }
    expect(offsetOf(4, 'Leo')).toBe(6.86) // 12·4/7 = 6.857… (floor would give 6.85)
    expect(offsetOf(1, 'Leo')).toBe(1.71) // 12/7 = 1.714… (ceil would give 1.72)
    expect(offsetOf(4, 'Pisces')).toBe(-6.86) // −6.857… (ceil would give −6.85)
    expect(offsetOf(1, 'Pisces')).toBe(-1.71) // −1.714… (floor would give −1.72)
    expect(offsetOf(7, 'Leo')).toBe(12)
    expect(offsetOf(0, 'Leo')).toBe(0)

    // The rounded offset is what moves the meter.
    const [chart, sky] = withRelation(4, 'Leo')
    const moved = surge(chart, sky)
    expect(moved.skyMeter).toBe(50)
    expect(moved.meter).toBeCloseTo(56.86, 9)
  })

  it('scores all sixteen ordered element pairs: same 1, sympathetic 0.5, opposed −1, neutral 0', () => {
    // natal element (row) against the sky's element (column), in this order.
    const SIGN = { Fire: 'Aries', Earth: 'Taurus', Air: 'Gemini', Water: 'Cancer' } as const
    const EXPECTED = {
      Fire: { Fire: 1, Earth: 0, Air: 0.5, Water: -1 },
      Earth: { Fire: 0, Earth: 1, Air: -1, Water: 0.5 },
      Air: { Fire: 0.5, Earth: -1, Air: 1, Water: 0 },
      Water: { Fire: -1, Earth: 0.5, Air: 0, Water: 1 },
    } as const
    for (const natalElement of Object.keys(SIGN) as Array<keyof typeof SIGN>) {
      for (const skyElement of Object.keys(SIGN) as Array<keyof typeof SIGN>) {
        expect(
          elementalHarmony(
            { planets: { Sun: { sign: SIGN[natalElement] } } },
            { Sun: { sign: SIGN[skyElement] } }
          ),
          `${natalElement} against ${skyElement}`
        ).toBe(EXPECTED[natalElement][skyElement])
      }
    }
  })

  it('averages over the bodies present in both, counting each of the ten and no others', () => {
    // Every one of the ten classical bodies contributes (Sun first, Pluto last).
    for (const body of BODY_NAMES) {
      expect(
        elementalHarmony({ planets: { [body]: { sign: 'Aries' } } }, { [body]: { sign: 'Leo' } }),
        body
      ).toBe(1)
      expect(
        elementalHarmony(
          { planets: { [body]: { sign: 'Aries' } } },
          { [body]: { sign: 'Pisces' } }
        ),
        body
      ).toBe(-1)
    }
    // Bodies outside the ten are not counted: Chiron would drag 1 down to 0 if it were.
    expect(
      elementalHarmony(
        {
          planets: {
            Sun: { sign: 'Aries' },
            Chiron: { sign: 'Aries' },
            Ascendant: { sign: 'Aries' },
          },
        },
        { Sun: { sign: 'Leo' }, Chiron: { sign: 'Pisces' }, Ascendant: { sign: 'Pisces' } }
      )
    ).toBe(1)
    // Three agree, seven oppose: (3 − 7) / 10.
    const planets: Record<string, { sign: string }> = {}
    const skyBodies: SkyBodies = {}
    BODY_NAMES.forEach((body, i) => {
      planets[body] = { sign: 'Aries' }
      skyBodies[body] = { sign: i < 3 ? 'Leo' : 'Pisces' }
    })
    expect(elementalHarmony({ planets }, skyBodies)).toBeCloseTo(-0.4, 12)
    // Only the bodies present on both sides are averaged: four of the ten here.
    expect(
      elementalHarmony(
        { planets: { Sun: { sign: 'Aries' }, Moon: { sign: 'Aries' }, Mars: { sign: 'Aries' } } },
        {
          Sun: { sign: 'Leo' },
          Moon: { sign: 'Leo' },
          Mars: { sign: 'Taurus' },
          Pluto: { sign: 'Pisces' },
        }
      )
    ).toBeCloseTo(2 / 3, 12)
    // No overlap at all, or no sky, or no chart: nothing to say.
    expect(
      elementalHarmony({ planets: { Sun: { sign: 'Aries' } } }, { Moon: { sign: 'Leo' } })
    ).toBeNull()
    expect(elementalHarmony({ planets: { Sun: { sign: 'Aries' } } }, null)).toBeNull()
    expect(elementalHarmony({ planets: { Sun: { sign: 'Aries' } } }, undefined)).toBeNull()
    expect(elementalHarmony(null, { Sun: { sign: 'Leo' } })).toBeNull()
    expect(elementalHarmony(undefined, { Sun: { sign: 'Leo' } })).toBeNull()
  })

  it('ignores a placeholder or unattributed chart, but not a computed, authored or unlabelled one', () => {
    const sky = { Sun: { sign: 'Leo' } }
    for (const provenance of ['placeholder', 'unattributed'] as const) {
      expect(
        elementalHarmony({ planets: { Sun: { sign: 'Aries' } }, provenance }, sky),
        provenance
      ).toBeNull()
    }
    for (const provenance of ['computed', 'authored', undefined] as const) {
      expect(
        elementalHarmony({ planets: { Sun: { sign: 'Aries' } }, provenance }, sky),
        String(provenance)
      ).toBe(1)
    }
  })

  it('falls back to the pure sky meter without a chart, a sky, or a usable chart', () => {
    const pure = surge(null, null)
    expect(pure.harmonyOffset).toBe(0)
    expect(pure.meter).toBe(pure.skyMeter)
    expect(surge(natal('Aries'), null)).toEqual(pure)
    expect(surge(null, allIn('Leo'))).toEqual(pure)
    for (const provenance of ['placeholder', 'unattributed'] as const) {
      expect(surge(natal('Aries', provenance), allIn('Leo')), provenance).toEqual(pure)
    }
    expect(surge(natal('Aries', 'authored'), allIn('Leo')).harmonyOffset).toBe(12)
    expect(elementalHarmony({ planets: {} }, allIn('Leo'))).toBeNull()
  })

  it('compares only bodies present in both, and ignores unknown signs', () => {
    expect(
      elementalHarmony(
        {
          planets: {
            Sun: { sign: 'Aries' },
            Moon: { sign: 'Ophiuchus' },
            Chiron: { sign: 'Aries' },
          },
        },
        { Sun: { sign: 'Leo' }, Moon: { sign: 'Leo' }, Chiron: { sign: 'Leo' } }
      )
    ).toBe(1)
  })
})

// With the real league means every aligned rating carries an irrational-looking offset (the
// global mean is 483.5 / 7), so no integer rating can sit exactly ON a gate and `>=` versus `>`
// cannot be told apart through the real module. Fabricated, all-equal baselines make the
// alignment the identity (aligned === rating), which puts a rating exactly on each gate.
describe('gate boundaries the real baselines can never land on', () => {
  type SealsModule = typeof import('@/lib/agents/rating/seals-surge')

  afterEach(() => {
    vi.doUnmock('@/lib/agents/rating/ovr-archetype')
    vi.resetModules()
  })

  /** seals-surge loaded against equal league means (so alignment is exact) and, optionally, a ceiling. */
  const loadSeals = async (ceiling?: number): Promise<SealsModule> => {
    vi.resetModules()
    vi.doMock('@/lib/agents/rating/ovr-archetype', async importOriginal => {
      const actual = await importOriginal<typeof import('@/lib/agents/rating/ovr-archetype')>()
      return {
        ...actual,
        RATING_CEILING: ceiling ?? actual.RATING_CEILING,
        STAT_BASELINES: Object.fromEntries(
          actual.CORE_STAT_KEYS.map(key => [key, { mean: 50, sd: 1 }])
        ),
      }
    })
    return import('@/lib/agents/rating/seals-surge')
  }

  // Stat values (0–100) whose rating is exactly the number in the key; 25 + stat · 0.74, rounded.
  const STAT_FOR_RATING: Record<number, number> = {
    73: 64.86,
    74: 66.22,
    79: 72.97,
    80: 74.32,
    85: 81.08,
    86: 82.43,
    90: 87.84,
    91: 89.19,
    95: 94.59,
    96: 95.95,
  }

  it('really is the identity alignment: the aligned rating is the raw rating', async () => {
    const { evaluateSeals: evaluate } = await loadSeals()
    for (const [rating, stat] of Object.entries(STAT_FOR_RATING)) {
      for (const seal of evaluate({ stats: stats(stat), esmsBalances: holdings(1000) })) {
        expect(seal.statRating, `${rating} ${seal.id}`).toBe(Number(rating))
        expect(seal.alignedRating, `${rating} ${seal.id}`).toBe(Number(rating))
      }
    }
  })

  it('clears a rating gate when the aligned rating equals it, and not one point below', async () => {
    const { evaluateSeals: evaluate } = await loadSeals()
    const natalChart = chartWithAffinity('spirit', 10)
    const ladder: Array<[number, number, SealTier | null, SealTier]> = [
      // [gate, stat at the gate, tier one rating point short of it, tier at it]
      [74, 66.22, null, 'Copper'],
      [80, 74.32, 'Copper', 'Silver'],
      [86, 82.43, 'Silver', 'Gold'],
      [91, 89.19, 'Gold', 'Aether'],
      [96, 95.95, 'Aether', 'Celestial'],
    ]
    for (const [gate, stat, shortTier, atTier] of ladder) {
      const short = STAT_FOR_RATING[gate - 1]
      const at = byId(
        evaluate({ stats: stats(stat), esmsBalances: holdings(1000), natalChart }),
        'astral-vision'
      )
      const below = byId(
        evaluate({ stats: stats(short), esmsBalances: holdings(1000), natalChart }),
        'astral-vision'
      )
      expect(at.alignedRating, `gate ${gate}`).toBe(gate)
      expect(at.tier, `gate ${gate}`).toBe(atTier)
      expect(below.alignedRating, `gate ${gate - 1}`).toBe(gate - 1)
      expect(below.tier, `gate ${gate - 1}`).toBe(shortTier)
      expect(below.blockedBy, `gate ${gate - 1}`).toEqual(['stat'])
    }
  })

  it('counts a balance exactly on its gate and not one cent short, in the same module', async () => {
    const { evaluateSeals: evaluate } = await loadSeals()
    const natalChart = chartWithAffinity('spirit', 10)
    for (const gate of LITERAL_GATES) {
      const at = byId(
        evaluate({ stats: stats(100), esmsBalances: holdings(gate.balance), natalChart }),
        'astral-vision'
      )
      const short = byId(
        evaluate({ stats: stats(100), esmsBalances: holdings(gate.balance - 0.01), natalChart }),
        'astral-vision'
      )
      expect(at.tier, gate.tier).toBe(gate.tier)
      expect(tierIndex(short.tier), gate.tier).toBe(tierIndex(gate.tier) - 1)
    }
  })

  it('reaches a tier whose gate equals the stat’s aligned ceiling, and not one above it', async () => {
    // Ceiling c with equal baselines: a perfect stat aligns to exactly c.
    const expectations: Array<[number, SealTier]> = [
      [96, 'Celestial'],
      [95, 'Aether'],
      [91, 'Aether'],
      [90, 'Gold'],
      [86, 'Gold'],
      [85, 'Silver'],
      [80, 'Silver'],
      [79, 'Copper'],
      [74, 'Copper'],
      [73, 'Copper'], // below every gate: Copper is still the floor of what is nameable
      [60, 'Copper'],
    ]
    for (const [ceiling, maxTier] of expectations) {
      const { evaluateSeals: evaluate } = await loadSeals(ceiling)
      const results = evaluate({ stats: stats(50), esmsBalances: holdings(0) })
      for (const seal of results) {
        expect(seal.maxTier, `ceiling ${ceiling} ${seal.id}`).toBe(maxTier)
      }
    }
  })

  it('stops nextTier at maxTier exactly: one rung below the ceiling still has a next tier', async () => {
    const { evaluateSeals: evaluate } = await loadSeals(91) // maxTier Aether
    const natalChart = chartWithAffinity('spirit', 10)
    const top = byId(
      evaluate({ stats: stats(89.19), esmsBalances: holdings(1000), natalChart }),
      'astral-vision'
    )
    expect(top.tier).toBe('Aether')
    expect(top.maxTier).toBe('Aether')
    expect(top.nextTier).toBeNull()
    expect(top.blockedBy).toEqual([])

    const gold = byId(
      evaluate({ stats: stats(89.19), esmsBalances: holdings(10), natalChart }),
      'astral-vision'
    )
    expect(gold.tier).toBe('Gold')
    expect(gold.nextTier).toBe('Aether')
    expect(gold.blockedBy).toEqual(['esms'])
  })
})
