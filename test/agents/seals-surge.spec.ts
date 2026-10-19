/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import {
  CANONICAL_SEAL_CATALOG,
  GLOBAL_ROSTER_MEAN,
  ROSTER_BASELINE_RATINGS,
  SEAL_ESMS_GATES,
  SEAL_STAT_GATES,
  SEAL_TIER_MULTIPLIERS,
  buildCanonicalSeal,
} from '@/lib/agents/rating-contract'
import {
  CELESTIAL_MIN_NATAL_AFFINITY,
  DEFAULT_SURGE_CALIBRATION,
  ESMS_TOKENS,
  HARMONY_MAX_OFFSET,
  SEAL_CATALOG,
  SEAL_TIERS,
  SEAL_TIER_REQUIREMENTS,
  calculateResonanceSurge,
  computeMeanAlignedRating,
  earnedSeals,
  elementalHarmony,
  evaluateSeals,
  natalAffinity,
  type EsmsHoldings,
  type NatalChartInput,
  type SealProgress,
  type SealTier,
  type SkyBodies,
  type SurgeCalibration,
} from '@/lib/agents/rating/seals-surge'
import type { CoreStats } from '@/lib/agents/rating/ovr-archetype'
import {
  MONICA_EQUILIBRIUM,
  calculateMonica,
  calculateThermodynamics,
} from '@/lib/thermodynamics/kalchm'

// ─── Literals: the oracle's whole world ──────────────────────────────────────
// Everything in this block is written out by hand. Nothing in it is read from the module under
// test, so a drifted gate, mean, scale constant, token or comparison operator there cannot also
// drift here. The contract's own exports are compared TO these literals (first describe block),
// so a change to the contract fails loudly in one place instead of quietly moving the oracle.

const STATS = [
  'power',
  'resonance',
  'wisdom',
  'charisma',
  'intuition',
  'adaptability',
  'vitality',
] as const
type Stat = (typeof STATS)[number]

const TOKENS = ['spirit', 'essence', 'matter', 'substance'] as const
type Token = (typeof TOKENS)[number]

const TIERS = ['Copper', 'Silver', 'Gold', 'Astral', 'Celestial'] as const

/** The contract's pinned league means (rating-scale numbers) and the common level they align to. */
const LITERAL_MEANS: Record<Stat, number> = {
  power: 76.5,
  resonance: 67.0,
  wisdom: 68.5,
  charisma: 64.5,
  intuition: 66.0,
  adaptability: 67.5,
  vitality: 66.0,
}
const LITERAL_GLOBAL_MEAN = 68.0

const GATES: ReadonlyArray<{ tier: SealTier; rating: number; balance: number }> = [
  { tier: 'Copper', rating: 74, balance: 0.5 },
  { tier: 'Silver', rating: 80, balance: 2 },
  { tier: 'Gold', rating: 86, balance: 10 },
  { tier: 'Astral', rating: 91, balance: 50 },
  { tier: 'Celestial', rating: 96, balance: 250 },
]
const MIN_AFFINITY = 4

/** Catalog: the stat each Seal rides on, its name, and the token whose balance gates it. */
const LITERAL_SEALS: ReadonlyArray<{ stat: Stat; name: string; token: Token }> = [
  { stat: 'power', name: 'Crucible Finisher', token: 'substance' },
  { stat: 'resonance', name: 'Tidal Chorus', token: 'essence' },
  { stat: 'wisdom', name: "Philosopher's Stone", token: 'matter' },
  { stat: 'charisma', name: 'Harmonic Sovereign', token: 'essence' },
  { stat: 'intuition', name: 'Astral Vision', token: 'spirit' },
  { stat: 'adaptability', name: 'Quicksilver Pivot', token: 'spirit' },
  { stat: 'vitality', name: 'Immovable Foundation', token: 'matter' },
]
const TOKEN_OF: Record<Stat, Token> = Object.fromEntries(
  LITERAL_SEALS.map(s => [s.stat, s.token])
) as Record<Stat, Token>

/** Which element earns each token, and the element of every sign. */
const TOKEN_ELEMENT: Record<Token, string> = {
  spirit: 'Fire',
  essence: 'Water',
  matter: 'Earth',
  substance: 'Air',
}
const SIGN_ELEMENT: Record<string, string> = {
  Aries: 'Fire',
  Taurus: 'Earth',
  Gemini: 'Air',
  Cancer: 'Water',
  Leo: 'Fire',
  Virgo: 'Earth',
  Libra: 'Air',
  Scorpio: 'Water',
  Sagittarius: 'Fire',
  Capricorn: 'Earth',
  Aquarius: 'Air',
  Pisces: 'Water',
}
const SIGNS = Object.keys(SIGN_ELEMENT)

/** One sign of each token's element, and a sign of some other element per token. */
const OWN_SIGN: Record<Token, string> = {
  spirit: 'Aries',
  essence: 'Cancer',
  matter: 'Taurus',
  substance: 'Gemini',
}
const OTHER_SIGN: Record<Token, string> = {
  spirit: 'Taurus',
  essence: 'Taurus',
  matter: 'Aries',
  substance: 'Taurus',
}

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
] as const

// ─── Fixtures ────────────────────────────────────────────────────────────────

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

/** A chart with exactly `count` of the ten classical bodies (the first `count`) in the token's element. */
const chartWithAffinity = (
  token: Token,
  count: number,
  provenance: NatalChartInput['provenance'] = 'computed'
): NatalChartInput => ({
  provenance,
  planets: Object.fromEntries(
    BODIES.map((body, i) => [body, { sign: i < count ? OWN_SIGN[token] : OTHER_SIGN[token] }])
  ),
})

const bySeal = (results: readonly SealProgress[], stat: Stat): SealProgress => {
  const found = results.find(r => r.id === `seal-${stat}`)
  if (!found) throw new Error(`no Seal for ${stat}`)
  return found
}
const tierIndex = (tier: SealTier | null) => (tier === null ? -1 : TIERS.indexOf(tier))

/** Deterministic pseudo-random numbers; the sweeps below must not depend on `Math.random`. */
function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

// ─── The independent oracle ──────────────────────────────────────────────────

/** 25 + value·0.74 rounded half up, in integer arithmetic so no float can tip a .5. */
const oracleRating = (value: number): number => Math.floor((2550 + 74 * value) / 100)

/** Smallest integer stat whose rating is `rating` (every rating 25–99 is reachable). */
function statForRating(rating: number): number {
  for (let v = 0; v <= 100; v++) if (oracleRating(v) === rating) return v
  throw new Error(`no stat rates ${rating}`)
}

/** Ten-body count of signs in the token's element; `null` for a chart that earns nothing. */
function oracleAffinity(natalChart: NatalChartInput | null | undefined, token: Token) {
  if (!natalChart) return null
  if (natalChart.provenance === 'placeholder' || natalChart.provenance === 'unattributed') {
    return null
  }
  let count = 0
  for (const body of BODIES) {
    const sign = natalChart.planets[body]?.sign
    if (sign !== undefined && SIGN_ELEMENT[sign] === TOKEN_ELEMENT[token]) count++
  }
  return count
}

interface OracleRow {
  id: string
  name: string
  token: Token
  stat: Stat
  tier: SealTier | null
  nextTier: SealTier | null
  blockedBy: Array<'stat' | 'esms' | 'natal'>
  maxTier: SealTier
  statRating: number
  alignedRating: number
  balance: number
  natalAffinity: number | null
}

/** What a Seal on `stat` should read: integer stats 0–100, per-token balances, a chart. */
function oracleRow(
  stat: Stat,
  value: number,
  balances: Record<Token, number>,
  natalChart: NatalChartInput | null | undefined
): OracleRow {
  const seal = LITERAL_SEALS.find(s => s.stat === stat)!
  const statRating = oracleRating(Math.min(100, Math.max(0, value)))
  const aligned = statRating - LITERAL_MEANS[stat] + LITERAL_GLOBAL_MEAN
  const ceiling = 99 - LITERAL_MEANS[stat] + LITERAL_GLOBAL_MEAN
  const balance = balances[seal.token]
  const affinity = oracleAffinity(natalChart, seal.token)
  const natalOk = affinity !== null && affinity >= MIN_AFFINITY

  let tierIdx = -1
  let maxIdx = 0
  GATES.forEach((gate, i) => {
    const celestialBar = gate.tier === 'Celestial'
    if (aligned >= gate.rating && balance >= gate.balance && (!celestialBar || natalOk)) {
      tierIdx = i
    }
    if (gate.rating <= ceiling) maxIdx = i
  })

  const nextIdx = tierIdx + 1 <= maxIdx ? tierIdx + 1 : null
  const blockedBy: OracleRow['blockedBy'] = []
  if (nextIdx !== null) {
    const need = GATES[nextIdx]
    if (aligned < need.rating) blockedBy.push('stat')
    if (balance < need.balance) blockedBy.push('esms')
    if (need.tier === 'Celestial' && !natalOk) blockedBy.push('natal')
  }
  return {
    id: `seal-${stat}`,
    name: seal.name,
    token: seal.token,
    stat,
    tier: tierIdx >= 0 ? GATES[tierIdx].tier : null,
    nextTier: nextIdx === null ? null : GATES[nextIdx].tier,
    blockedBy,
    maxTier: GATES[maxIdx].tier,
    statRating,
    alignedRating: aligned,
    balance,
    natalAffinity: affinity,
  }
}

const rowKey = (r: OracleRow | SealProgress): string =>
  [
    r.id,
    r.name,
    r.token,
    r.stat,
    r.tier,
    r.nextTier,
    r.blockedBy.join('+'),
    r.maxTier,
    r.statRating,
    r.alignedRating,
    r.balance,
    r.natalAffinity,
  ].join('|')

/** The 12 balances every sweep probes: both extremes, and each gate one cent short and exactly on it. */
const BALANCE_POINTS = [0, 1000, ...GATES.flatMap(g => [g.balance - 0.01, g.balance])]
const STAT_VALUES = Array.from({ length: 101 }, (_, i) => i)

// ─── The contract's numbers, as this spec's oracle assumes them ──────────────

describe('the contract vocabulary, pinned as literals', () => {
  it('has the five tiers Copper, Silver, Gold, Astral, Celestial — and the retired name is gone', () => {
    expect([...SEAL_TIERS]).toEqual(['Copper', 'Silver', 'Gold', 'Astral', 'Celestial'])
    const retired = ['ae', 'ther'].join('')
    const vocabulary = [
      ...SEAL_TIERS,
      ...Object.keys(SEAL_TIER_REQUIREMENTS),
      ...Object.keys(SEAL_STAT_GATES),
      ...Object.keys(SEAL_ESMS_GATES),
      ...Object.keys(SEAL_TIER_MULTIPLIERS),
    ]
    expect(vocabulary.filter(word => word.toLowerCase() === retired)).toEqual([])
  })

  it('pins the stat gates 74 / 80 / 86 / 91 / 96 and the ESMS gates 0.5 / 2 / 10 / 50 / 250', () => {
    expect({ ...SEAL_STAT_GATES }).toEqual({
      Copper: 74,
      Silver: 80,
      Gold: 86,
      Astral: 91,
      Celestial: 96,
    })
    expect({ ...SEAL_ESMS_GATES }).toEqual({
      Copper: 0.5,
      Silver: 2,
      Gold: 10,
      Astral: 50,
      Celestial: 250,
    })
    expect({ ...SEAL_TIER_MULTIPLIERS }).toEqual({
      Copper: 1.05,
      Silver: 1.1,
      Gold: 1.18,
      Astral: 1.28,
      Celestial: 1.4,
    })
  })

  it('pins the roster means 76.5 / 67.0 / 68.5 / 64.5 / 66.0 / 67.5 / 66.0 and the common level 68.0', () => {
    expect(GLOBAL_ROSTER_MEAN).toBe(68.0)
    expect(
      Object.fromEntries(STATS.map(stat => [stat, ROSTER_BASELINE_RATINGS[stat].mean]))
    ).toEqual(LITERAL_MEANS)
  })

  it('pins the contract catalog: names, tokens, and the stat order the Seals come in', () => {
    expect(
      LITERAL_SEALS.map(s => [
        s.stat,
        CANONICAL_SEAL_CATALOG[s.stat].name,
        CANONICAL_SEAL_CATALOG[s.stat].category,
      ])
    ).toEqual(LITERAL_SEALS.map(s => [s.stat, s.name, s.token]))
  })

  it('pins this module’s own constants: Celestial affinity 4, harmony ±12', () => {
    expect(CELESTIAL_MIN_NATAL_AFFINITY).toBe(4)
    expect(HARMONY_MAX_OFFSET).toBe(12)
  })

  it('pins the default surge anchors (the calibration spec only holds them to ±10%)', () => {
    expect(DEFAULT_SURGE_CALIBRATION).toEqual({
      heat: { low: 0.0184, high: 0.1154 },
      reactivity: { low: 0.561, high: 3.586 },
    })
  })
})

describe('Seal catalog', () => {
  it('is exactly the canonical seven Seals, in the contract’s stat order, with seal-<stat> ids', () => {
    expect([...SEAL_CATALOG]).toEqual(
      LITERAL_SEALS.map(s => ({
        id: `seal-${s.stat}`,
        name: s.name,
        token: s.token,
        stat: s.stat,
      }))
    )
    expect(SEAL_CATALOG.map(s => s.id)).toEqual([
      'seal-power',
      'seal-resonance',
      'seal-wisdom',
      'seal-charisma',
      'seal-intuition',
      'seal-adaptability',
      'seal-vitality',
    ])
    expect(new Set(SEAL_CATALOG.map(s => s.id)).size).toBe(7)
  })

  it('gives every Sacred 7 stat and every ESMS token at least one Seal', () => {
    expect(new Set(SEAL_CATALOG.map(s => s.stat))).toEqual(new Set(STATS))
    expect(new Set(SEAL_CATALOG.map(s => s.token))).toEqual(new Set(TOKENS))
  })

  it('orders the ESMS tokens Spirit, Essence, Matter, Substance (EsmsId 0–3)', () => {
    expect([...ESMS_TOKENS]).toEqual(['spirit', 'essence', 'matter', 'substance'])
  })

  it('derives the tier requirements from the gates, frozen, strictly increasing on both', () => {
    expect(SEAL_TIER_REQUIREMENTS).toEqual({
      Copper: { minRating: 74, minBalance: 0.5 },
      Silver: { minRating: 80, minBalance: 2 },
      Gold: { minRating: 86, minBalance: 10 },
      Astral: { minRating: 91, minBalance: 50 },
      Celestial: { minRating: 96, minBalance: 250 },
    })
    expect(Object.isFrozen(SEAL_TIER_REQUIREMENTS)).toBe(true)
    for (const tier of TIERS) expect(Object.isFrozen(SEAL_TIER_REQUIREMENTS[tier]), tier).toBe(true)
    for (let i = 1; i < TIERS.length; i++) {
      const lower = SEAL_TIER_REQUIREMENTS[TIERS[i - 1]]
      const higher = SEAL_TIER_REQUIREMENTS[TIERS[i]]
      expect(higher.minRating).toBeGreaterThan(lower.minRating)
      expect(higher.minBalance).toBeGreaterThan(lower.minBalance)
    }
  })
})

// ─── Mean alignment (the contract's function, re-exported) ───────────────────

describe('mean-aligned rating', () => {
  it('rates a stat at its own contract mean as the common level 68, for every stat', () => {
    for (const stat of STATS) {
      expect(computeMeanAlignedRating(stat, LITERAL_MEANS[stat]), stat).toBe(68)
    }
  })

  it('shifts a rating one-for-one by (68 − mean): power down, the lower-mean stats up', () => {
    // aligned = rating − mean + 68, written out per stat for a rating of 99 and of 50.
    const AT_99: Record<Stat, number> = {
      power: 90.5,
      resonance: 100,
      wisdom: 98.5,
      charisma: 102.5,
      intuition: 101,
      adaptability: 99.5,
      vitality: 101,
    }
    const AT_50: Record<Stat, number> = {
      power: 41.5,
      resonance: 51,
      wisdom: 49.5,
      charisma: 53.5,
      intuition: 52,
      adaptability: 50.5,
      vitality: 52,
    }
    for (const stat of STATS) {
      expect(computeMeanAlignedRating(stat, 99), `${stat} at 99`).toBe(AT_99[stat])
      expect(computeMeanAlignedRating(stat, 50), `${stat} at 50`).toBe(AT_50[stat])
    }
  })

  it('documents the cost: a perfect power rating aligns to 90.5 — Gold’s tier, short of Astral’s 91', () => {
    const ceiling = computeMeanAlignedRating('power', 99)
    expect(ceiling).toBe(90.5)
    expect(ceiling).toBeGreaterThanOrEqual(86)
    expect(ceiling).toBeLessThan(91)
    for (const stat of STATS.filter(s => s !== 'power')) {
      expect(computeMeanAlignedRating(stat, 99), stat).toBeGreaterThanOrEqual(96)
    }
  })

  it('only aligns the gate comparison: statRating stays on the raw 25–99 scale', () => {
    // power 90 → 25 + 66.6 = 91.6 → 92; aligned 92 − 76.5 + 68 = 83.5.
    const seal = bySeal(
      evaluateSeals({ stats: stats(50, { power: 90 }), esmsBalances: holdings(1000) }),
      'power'
    )
    expect(seal.statRating).toBe(92)
    expect(seal.alignedRating).toBe(83.5)
    expect(seal.alignedRating).toBeLessThan(seal.statRating)
    const resonance = bySeal(
      evaluateSeals({ stats: stats(50, { resonance: 90 }), esmsBalances: holdings(1000) }),
      'resonance'
    )
    expect(resonance.statRating).toBe(92)
    expect(resonance.alignedRating).toBe(93) // 92 − 67 + 68
    expect(resonance.alignedRating).toBeGreaterThan(resonance.statRating)
  })
})

// ─── evaluateSeals ───────────────────────────────────────────────────────────

describe('evaluateSeals', () => {
  it('returns the whole catalog in the contract’s stat order, with exactly these fields', () => {
    const results = evaluateSeals({ stats: stats(50), esmsBalances: holdings(0) })
    expect(results.map(r => r.id)).toEqual(SEAL_CATALOG.map(s => s.id))
    expect(results.map(r => r.stat)).toEqual([...STATS])
    for (const r of results) {
      expect(Object.keys(r).sort(), r.id).toEqual([
        'alignedRating',
        'balance',
        'blockedBy',
        'id',
        'maxTier',
        'name',
        'natalAffinity',
        'nextTier',
        'stat',
        'statRating',
        'tier',
        'token',
      ])
    }
  })

  it('earns nothing with empty holdings, however strong the stats, and says only ESMS is missing', () => {
    const results = evaluateSeals({ stats: stats(100), esmsBalances: holdings(0) })
    expect(results).toHaveLength(7)
    for (const r of results) {
      expect(r.tier, r.id).toBeNull()
      expect(r.nextTier, r.id).toBe('Copper')
      expect(r.blockedBy, r.id).toEqual(['esms'])
    }
    expect(earnedSeals(results)).toEqual([])
  })

  it('hand-computed golden rows: tier, next tier, blockers and aligned rating', () => {
    // Each row is worked out by hand from the literals: rating = round(25 + stat · 0.74),
    // aligned = rating − mean + 68; the balance is that of the Seal's own token.
    const rows: Array<{
      stat: Stat
      value: number
      balance: number
      rating: number
      aligned: number
      tier: SealTier | null
      next: SealTier | null
      blocked: Array<'stat' | 'esms' | 'natal'>
    }> = [
      // power 90 → rating 92 → aligned 83.5: Silver on stat; 3 Substance clears Silver (2), not Gold (10).
      {
        stat: 'power',
        value: 90,
        balance: 3,
        rating: 92,
        aligned: 83.5,
        tier: 'Silver',
        next: 'Gold',
        blocked: ['stat', 'esms'],
      },
      // wisdom 80 → 84 → 83.5 (84 − 68.5 + 68): Silver; Matter exactly 10 clears Gold's balance.
      {
        stat: 'wisdom',
        value: 80,
        balance: 10,
        rating: 84,
        aligned: 83.5,
        tier: 'Silver',
        next: 'Gold',
        blocked: ['stat'],
      },
      // charisma 60 → 69 → 72.5 (69 − 64.5 + 68): under Copper's 74; Essence 0.5 is exactly Copper's.
      {
        stat: 'charisma',
        value: 60,
        balance: 0.5,
        rating: 69,
        aligned: 72.5,
        tier: null,
        next: 'Copper',
        blocked: ['stat'],
      },
      // adaptability 100 → 99 → 99.5: 49.99 Spirit is a cent short of Astral's 50 → Gold.
      {
        stat: 'adaptability',
        value: 100,
        balance: 49.99,
        rating: 99,
        aligned: 99.5,
        tier: 'Gold',
        next: 'Astral',
        blocked: ['esms'],
      },
      // vitality 0 → 25 → 27 (25 − 66 + 68): nothing, and the stat is the only thing missing.
      {
        stat: 'vitality',
        value: 0,
        balance: 1000,
        rating: 25,
        aligned: 27,
        tier: null,
        next: 'Copper',
        blocked: ['stat'],
      },
      // intuition 97 → 97 → 99: 12 Spirit clears Gold, short of Astral's 50.
      {
        stat: 'intuition',
        value: 97,
        balance: 12,
        rating: 97,
        aligned: 99,
        tier: 'Gold',
        next: 'Astral',
        blocked: ['esms'],
      },
      // resonance 75 → 81 → 82 (81 − 67 + 68): Silver; Essence 1000 is plenty; the stat is short of Gold.
      {
        stat: 'resonance',
        value: 75,
        balance: 1000,
        rating: 81,
        aligned: 82,
        tier: 'Silver',
        next: 'Gold',
        blocked: ['stat'],
      },
    ]
    for (const row of rows) {
      const balances = holdings(0, { [TOKEN_OF[row.stat]]: row.balance })
      const seal = bySeal(
        evaluateSeals({ stats: stats(50, { [row.stat]: row.value }), esmsBalances: balances }),
        row.stat
      )
      expect(seal, row.stat).toMatchObject({
        id: `seal-${row.stat}`,
        stat: row.stat,
        token: TOKEN_OF[row.stat],
        statRating: row.rating,
        alignedRating: row.aligned,
        balance: row.balance,
        tier: row.tier,
        nextTier: row.next,
        blockedBy: row.blocked,
        natalAffinity: null,
      })
    }
  })

  it('without a natal chart no Seal passes Astral; a perfect, funded vessel is told Celestial needs the chart', () => {
    const results = evaluateSeals({ stats: stats(100), esmsBalances: holdings(1000) })
    for (const r of results) {
      expect(r.natalAffinity, r.id).toBeNull()
      if (r.stat === 'power') {
        // Crucible Finisher's mean sits so far above the others that a perfect power rating
        // aligns to 90.5: Gold is the most it can ever show, so there is no next tier.
        expect(r.tier, r.id).toBe('Gold')
        expect(r.maxTier, r.id).toBe('Gold')
        expect(r.nextTier, r.id).toBeNull()
        expect(r.blockedBy, r.id).toEqual([])
      } else {
        expect(r.tier, r.id).toBe('Astral')
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
    // Spirit/Fire has 4 bodies; Earth 3, Water 2, Air 1.
    for (const stat of ['intuition', 'adaptability'] as const) {
      expect(bySeal(results, stat).natalAffinity, stat).toBe(4)
      expect(bySeal(results, stat).tier, stat).toBe('Celestial')
      expect(bySeal(results, stat).nextTier, stat).toBeNull()
      expect(bySeal(results, stat).blockedBy, stat).toEqual([])
    }
    for (const stat of ['wisdom', 'vitality'] as const) {
      expect(bySeal(results, stat).natalAffinity, stat).toBe(3)
      expect(bySeal(results, stat).tier, stat).toBe('Astral')
      expect(bySeal(results, stat).blockedBy, stat).toEqual(['natal'])
    }
    for (const stat of ['charisma', 'resonance'] as const) {
      expect(bySeal(results, stat).natalAffinity, stat).toBe(2)
      expect(bySeal(results, stat).tier, stat).toBe('Astral')
    }
    expect(bySeal(results, 'power').natalAffinity).toBe(1)
    expect(bySeal(results, 'power').tier).toBe('Gold')
  })

  it('does not let a placeholder or unattributed chart unlock Celestial, and reports no affinity', () => {
    for (const provenance of ['placeholder', 'unattributed'] as const) {
      const results = evaluateSeals({
        stats: stats(100),
        esmsBalances: holdings(1000),
        natalChart: chart(provenance),
      })
      for (const stat of ['intuition', 'adaptability'] as const) {
        expect(bySeal(results, stat).natalAffinity, `${provenance} ${stat}`).toBeNull()
        expect(bySeal(results, stat).tier, `${provenance} ${stat}`).toBe('Astral')
        expect(bySeal(results, stat).blockedBy, `${provenance} ${stat}`).toEqual(['natal'])
      }
    }
    // Only the Celestial bar is closed: every lower tier is exactly what it was without a chart.
    const placeholder = evaluateSeals({
      stats: stats(100),
      esmsBalances: holdings(1000),
      natalChart: chartWithAffinity('spirit', 10, 'placeholder'),
    })
    const noChart = evaluateSeals({ stats: stats(100), esmsBalances: holdings(1000) })
    expect(placeholder.map(r => r.tier)).toEqual(noChart.map(r => r.tier))
  })

  it('counts a chart with authored or unlabelled provenance, as well as a computed one', () => {
    for (const provenance of ['computed', 'authored', undefined] as const) {
      const results = evaluateSeals({
        stats: stats(100),
        esmsBalances: holdings(1000),
        natalChart: chart(provenance),
      })
      expect(bySeal(results, 'intuition').tier, String(provenance)).toBe('Celestial')
    }
  })

  it('rejects broken input instead of rating it as "earned nothing"', () => {
    const badStat = () =>
      evaluateSeals({ stats: stats(50, { power: NaN }), esmsBalances: holdings(1) })
    expect(badStat).toThrow(RangeError)
    expect(badStat).toThrow(/power/)
    expect(() =>
      evaluateSeals({ stats: stats(50), esmsBalances: holdings(1, { matter: -1 }) })
    ).toThrow(/matter/)
    expect(() =>
      evaluateSeals({ stats: stats(50), esmsBalances: holdings(1, { spirit: NaN }) })
    ).toThrow(/spirit/)
  })

  it('validates every token’s balance with a RangeError — NaN, negative, ±Infinity — and accepts zero', () => {
    for (const token of TOKENS) {
      for (const bad of [
        Number.NaN,
        -1,
        -0.01,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ]) {
        const call = () =>
          evaluateSeals({ stats: stats(50), esmsBalances: holdings(1, { [token]: bad }) })
        expect(call, `${token} ${bad}`).toThrow(RangeError)
        expect(call, `${token} ${bad}`).toThrow(new RegExp(`Invalid ${token} balance`))
      }
      // Zero is a legitimate balance: it earns nothing but is not an error.
      expect(() =>
        evaluateSeals({ stats: stats(50), esmsBalances: holdings(1, { [token]: 0 }) })
      ).not.toThrow()
    }
  })

  it('rejects a balance that is missing altogether', () => {
    const missing = { spirit: 1, essence: 1, matter: 1 } as unknown as EsmsHoldings
    expect(() => evaluateSeals({ stats: stats(50), esmsBalances: missing })).toThrow(RangeError)
    expect(() => evaluateSeals({ stats: stats(50), esmsBalances: missing })).toThrow(/substance/)
  })

  it('validates every stat with a RangeError — NaN and ±Infinity — not just the first ones', () => {
    for (const key of STATS) {
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        const call = () =>
          evaluateSeals({ stats: stats(50, { [key]: bad }), esmsBalances: holdings(1) })
        expect(call, `${key} ${bad}`).toThrow(RangeError)
        expect(call, `${key} ${bad}`).toThrow(new RegExp(key))
      }
    }
  })

  it('clamps an out-of-range stat onto the 25–99 scale and echoes each Seal’s own balance untouched', () => {
    const results = evaluateSeals({
      stats: stats(50, { power: 150, resonance: -20 }),
      esmsBalances: holdings(0, { substance: 7.25, essence: 3 }),
    })
    expect(bySeal(results, 'power').statRating).toBe(99)
    expect(bySeal(results, 'resonance').statRating).toBe(25)
    expect(bySeal(results, 'power').balance).toBe(7.25)
    expect(bySeal(results, 'resonance').balance).toBe(3)
    expect(bySeal(results, 'charisma').balance).toBe(3)
    expect(bySeal(results, 'intuition').balance).toBe(0)
    expect(results.map(r => r.id)).toEqual(SEAL_CATALOG.map(s => s.id))
  })

  it('ignores extra fields on the holdings and leaves its inputs unchanged', () => {
    const inputStats = Object.freeze(stats(80))
    const inputHoldings = Object.freeze({
      ...holdings(12),
      lamports: 5,
      ownerKey: 'x',
    }) as unknown as EsmsHoldings
    const natalChart = Object.freeze({ ...chart('computed') })
    const before = JSON.stringify([inputStats, inputHoldings, natalChart])
    const results = evaluateSeals({ stats: inputStats, esmsBalances: inputHoldings, natalChart })
    expect(results).toHaveLength(7)
    expect(JSON.stringify([inputStats, inputHoldings, natalChart])).toBe(before)
  })

  it('is monotone: more of any stat or any balance never lowers a tier (seeded property)', () => {
    const rand = lcg(0x51ed270b)
    for (let i = 0; i < 300; i++) {
      const s = {} as CoreStats
      for (const k of STATS) s[k] = Math.round(60 + rand() * 40)
      const h = holdings(0, {
        spirit: rand() * 400,
        essence: rand() * 400,
        matter: rand() * 400,
        substance: rand() * 400,
      })
      const natalChart = rand() < 0.5 ? chart('computed') : null
      const before = evaluateSeals({ stats: s, esmsBalances: h, natalChart })

      for (const k of STATS) {
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
      for (const t of TOKENS) {
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

// ─── The oracle-differential grid ────────────────────────────────────────────

describe('Seal tiers against an independent oracle', () => {
  it('has a sane oracle: it matches a hand-computed row and reaches every tier a Seal can show', () => {
    // power 90, 3 Substance: Silver, blocked on stat and esms (see the golden rows above).
    expect(oracleRow('power', 90, holdings(3), null)).toMatchObject({
      statRating: 92,
      alignedRating: 83.5,
      tier: 'Silver',
      nextTier: 'Gold',
      blockedBy: ['stat', 'esms'],
      maxTier: 'Gold',
    })
    for (const seal of LITERAL_SEALS) {
      const seen = new Set<string>()
      for (const value of STAT_VALUES) {
        for (const balance of BALANCE_POINTS) {
          seen.add(
            String(
              oracleRow(seal.stat, value, holdings(balance), chartWithAffinity(seal.token, 10)).tier
            )
          )
        }
      }
      // null plus every tier the Seal can show: Gold tops out power, Celestial the other six.
      expect(seen.size, seal.stat).toBe(seal.stat === 'power' ? 4 : 6)
      expect(seen.has('Celestial'), seal.stat).toBe(seal.stat !== 'power')
    }
  })

  // Chart situations: no chart, then 3 / 4 / 10 bodies in the token's element, a placeholder
  // chart with all ten in it, and an unattributed one — for each of the four tokens' elements.
  const SITUATIONS: Array<{
    label: string
    build: ((token: Token) => NatalChartInput) | null
  }> = [
    { label: 'no chart', build: null },
    { label: '3 bodies in the element', build: token => chartWithAffinity(token, 3) },
    { label: '4 bodies in the element', build: token => chartWithAffinity(token, 4) },
    { label: '10 bodies in the element', build: token => chartWithAffinity(token, 10) },
    {
      label: 'placeholder provenance, 10 bodies',
      build: token => chartWithAffinity(token, 10, 'placeholder'),
    },
    {
      label: 'unattributed provenance, 10 bodies',
      build: token => chartWithAffinity(token, 10, 'unattributed'),
    },
  ]

  for (const situation of SITUATIONS) {
    for (const token of situation.build === null ? (['spirit'] as const) : TOKENS) {
      it(`matches every field for all 7 Seals, every stat 0–100 and every balance probe — ${situation.label}${
        situation.build === null ? '' : `, ${token} chart`
      }`, () => {
        const natalChart = situation.build === null ? null : situation.build(token)
        const mismatches: unknown[] = []
        let compared = 0
        for (const value of STAT_VALUES) {
          for (const balance of BALANCE_POINTS) {
            const balances = holdings(balance)
            const results = evaluateSeals({
              stats: stats(value),
              esmsBalances: balances,
              natalChart,
            })
            for (const stat of STATS) {
              const got = bySeal(results, stat)
              const want = oracleRow(stat, value, balances, natalChart)
              compared++
              if (rowKey(got) !== rowKey(want)) mismatches.push({ stat, value, balance, got, want })
            }
          }
        }
        expect(compared).toBe(7 * 101 * 12)
        expect(mismatches.slice(0, 3)).toEqual([])
      })
    }
  }

  it('matches a seeded sweep with independent stats, per-token balances and random charts', () => {
    // The structured grid gives every stat one value and every token one balance, which cannot
    // see a Seal reading the wrong stat or the wrong token's balance. This sweep varies all of
    // them independently, with random (partial, mis-signed, mislabelled) charts.
    const rand = lcg(0xc0ffee11)
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]
    const PROVENANCE = [undefined, 'computed', 'authored', 'placeholder', 'unattributed'] as const
    const mismatches: unknown[] = []
    const tiersSeen = new Set<string>()

    for (let i = 0; i < 6000; i++) {
      const s = {} as CoreStats
      for (const k of STATS) {
        s[k] = rand() < 0.6 ? 70 + Math.floor(rand() * 31) : Math.floor(rand() * 101)
      }
      const balances = {} as Record<Token, number>
      for (const t of TOKENS) balances[t] = pick(BALANCE_POINTS)

      let natalChart: NatalChartInput | null = null
      if (rand() > 0.2) {
        const dominant = pick(SIGNS)
        const planets: Record<string, { sign: string }> = {}
        for (const body of BODIES) {
          const roll = rand()
          if (roll < 0.08) continue // body missing from the chart
          if (roll < 0.12)
            planets[body] = { sign: 'Ophiuchus' } // not a sign
          else planets[body] = { sign: rand() < 0.55 ? dominant : pick(SIGNS) }
        }
        // Points outside the ten never count.
        planets.Chiron = { sign: dominant }
        planets.Ascendant = { sign: dominant }
        natalChart = { planets, provenance: pick(PROVENANCE) }
      }

      const results = evaluateSeals({ stats: s, esmsBalances: balances, natalChart })
      expect(results).toHaveLength(7)
      for (const stat of STATS) {
        const got = bySeal(results, stat)
        const want = oracleRow(stat, s[stat], balances, natalChart)
        tiersSeen.add(String(got.tier))
        if (rowKey(got) !== rowKey(want)) {
          mismatches.push({ stat, s, balances, natalChart, got, want })
        }
      }
    }
    expect(mismatches.slice(0, 2)).toEqual([])
    // Not vacuous: the random sweep reaches every outcome.
    expect([...tiersSeen].sort()).toEqual([
      'Astral',
      'Celestial',
      'Copper',
      'Gold',
      'Silver',
      'null',
    ])
  })
})

// ─── Gate boundaries: >= and not > ───────────────────────────────────────────

describe('gate boundaries', () => {
  // Resonance, intuition and vitality have whole-number offsets from the common level (+1, +2,
  // +2), so a whole rating can sit exactly ON a stat gate. The other four have .5 offsets and
  // can only straddle one.
  const EXACT: Array<{ stat: Stat; offset: number }> = [
    { stat: 'resonance', offset: 1 },
    { stat: 'intuition', offset: 2 },
    { stat: 'vitality', offset: 2 },
  ]

  for (const { stat, offset } of EXACT) {
    it(`clears a stat gate when the aligned rating EQUALS it, and not one rating point below — ${stat}`, () => {
      const natalChart = chartWithAffinity(TOKEN_OF[stat], 10)
      GATES.forEach((gate, i) => {
        const ratingAtGate = gate.rating - offset
        const at = bySeal(
          evaluateSeals({
            stats: stats(statForRating(ratingAtGate)),
            esmsBalances: holdings(1000),
            natalChart,
          }),
          stat
        )
        const below = bySeal(
          evaluateSeals({
            stats: stats(statForRating(ratingAtGate - 1)),
            esmsBalances: holdings(1000),
            natalChart,
          }),
          stat
        )
        expect(at.statRating, `${stat} ${gate.tier}`).toBe(ratingAtGate)
        expect(at.alignedRating, `${stat} ${gate.tier}`).toBe(gate.rating)
        expect(at.tier, `${stat} at the ${gate.tier} gate`).toBe(gate.tier)
        expect(below.alignedRating, `${stat} below ${gate.tier}`).toBe(gate.rating - 1)
        expect(below.tier, `${stat} just under the ${gate.tier} gate`).toBe(
          i === 0 ? null : GATES[i - 1].tier
        )
        expect(below.nextTier, `${stat} just under the ${gate.tier} gate`).toBe(gate.tier)
        expect(below.blockedBy, `${stat} just under the ${gate.tier} gate`).toEqual(['stat'])
      })
    })
  }

  it('straddles a stat gate for the .5-offset stats: 0.5 over clears, 0.5 under does not', () => {
    // wisdom aligns as rating − 0.5: rating 87 → 86.5 clears Gold's 86, rating 86 → 85.5 does not.
    const wisdom = (value: number) =>
      bySeal(evaluateSeals({ stats: stats(value), esmsBalances: holdings(1000) }), 'wisdom')
    expect(wisdom(statForRating(87)).alignedRating).toBe(86.5)
    expect(wisdom(statForRating(87)).tier).toBe('Gold')
    expect(wisdom(statForRating(86)).alignedRating).toBe(85.5)
    expect(wisdom(statForRating(86)).tier).toBe('Silver')
    // charisma aligns as rating + 3.5: rating 71 → 74.5 clears Copper's 74; rating 70 → 73.5 does not.
    const charisma = (value: number) =>
      bySeal(evaluateSeals({ stats: stats(value), esmsBalances: holdings(1000) }), 'charisma')
    expect(charisma(statForRating(70)).alignedRating).toBe(73.5)
    expect(charisma(statForRating(70)).tier).toBeNull()
    expect(charisma(statForRating(71)).alignedRating).toBe(74.5)
    expect(charisma(statForRating(71)).tier).toBe('Copper')
  })

  it('clears an ESMS gate exactly at the gate and not one cent below it, for every gate', () => {
    // Intuition at stat 100 aligns to 101, past every stat gate; Spirit alone varies.
    for (const gate of GATES.filter(g => g.tier !== 'Celestial')) {
      const at = bySeal(
        evaluateSeals({ stats: stats(100), esmsBalances: holdings(0, { spirit: gate.balance }) }),
        'intuition'
      )
      const below = bySeal(
        evaluateSeals({
          stats: stats(100),
          esmsBalances: holdings(0, { spirit: gate.balance - 0.01 }),
        }),
        'intuition'
      )
      expect(at.tier, gate.tier).toBe(gate.tier)
      expect(tierIndex(below.tier), gate.tier).toBe(tierIndex(gate.tier) - 1)
      expect(below.nextTier, gate.tier).toBe(gate.tier)
      expect(below.blockedBy, gate.tier).toEqual(['esms'])
    }
    const natalChart = chartWithAffinity('spirit', 4)
    const atGate = bySeal(
      evaluateSeals({ stats: stats(100), esmsBalances: holdings(250), natalChart }),
      'intuition'
    )
    const belowGate = bySeal(
      evaluateSeals({ stats: stats(100), esmsBalances: holdings(249.99), natalChart }),
      'intuition'
    )
    expect(atGate.tier).toBe('Celestial')
    expect(belowGate.tier).toBe('Astral')
    expect(belowGate.blockedBy).toEqual(['esms'])
  })

  it('uses each token’s own balance: a Seal ignores the other three', () => {
    for (const seal of LITERAL_SEALS) {
      // Only this Seal's own token holds anything.
      const own = bySeal(
        evaluateSeals({ stats: stats(100), esmsBalances: holdings(0, { [seal.token]: 10 }) }),
        seal.stat
      )
      expect(own.tier, seal.stat).toBe('Gold')
      // Everything but its own token is rich.
      const others = bySeal(
        evaluateSeals({ stats: stats(100), esmsBalances: holdings(1000, { [seal.token]: 0 }) }),
        seal.stat
      )
      expect(others.tier, seal.stat).toBeNull()
    }
  })

  it('uses each Seal’s own stat: raising one stat moves only that Seal', () => {
    const base = evaluateSeals({ stats: stats(0), esmsBalances: holdings(1000) })
    for (const stat of STATS) {
      const lifted = evaluateSeals({
        stats: stats(0, { [stat]: 100 }),
        esmsBalances: holdings(1000),
      })
      lifted.forEach((r, i) => {
        if (r.stat === stat) expect(r.statRating, r.id).toBe(99)
        else expect(r, r.id).toEqual(base[i])
      })
    }
  })
})

// With the contract's real means no stat's aligned ceiling (99 − mean + 68) is a whole number
// that equals a gate, so `maxTier`'s "gate ≤ ceiling" cannot be told from "gate < ceiling"
// through the real contract. This block replaces only `computeMeanAlignedRating` with a plain
// shift (aligned = rating + shift), which puts the ceiling exactly on, just under and far
// below each gate. `evaluateSealTier` keeps the contract's real alignment, so only the tiers
// this module derives itself (`maxTier`, `nextTier`, `blockedBy`) are read here.
describe('maxTier at an aligned ceiling the real means cannot produce', () => {
  type SealsModule = typeof import('@/lib/agents/rating/seals-surge')

  afterEach(() => {
    vi.doUnmock('@/lib/agents/rating-contract')
    vi.resetModules()
  })

  const loadWithCeiling = async (ceiling: number): Promise<SealsModule> => {
    vi.resetModules()
    vi.doMock('@/lib/agents/rating-contract', async importOriginal => {
      const actual = await importOriginal<typeof import('@/lib/agents/rating-contract')>()
      // A rating of 99 (a perfect stat) aligns to exactly `ceiling`.
      return {
        ...actual,
        computeMeanAlignedRating: (_stat: string, rating: number) => rating + (ceiling - 99),
      }
    })
    return import('@/lib/agents/rating/seals-surge')
  }

  it('reaches a tier whose gate equals the ceiling, and not one above it', async () => {
    const expectations: Array<[number, SealTier]> = [
      [96, 'Celestial'],
      [95.5, 'Astral'],
      [91, 'Astral'],
      [90.5, 'Gold'],
      [86, 'Gold'],
      [85.5, 'Silver'],
      [80, 'Silver'],
      [79.5, 'Copper'],
      [74, 'Copper'],
      [73.5, 'Copper'], // below every gate: Copper is still the floor of what is nameable
      [60, 'Copper'],
    ]
    for (const [ceiling, maxTier] of expectations) {
      const { evaluateSeals: evaluate } = await loadWithCeiling(ceiling)
      const results = evaluate({ stats: stats(100), esmsBalances: holdings(0) })
      for (const seal of results) {
        // The shift is really in force: a perfect stat aligns to the ceiling itself.
        expect(seal.alignedRating, `ceiling ${ceiling} ${seal.id}`).toBe(ceiling)
        expect(seal.maxTier, `ceiling ${ceiling} ${seal.id}`).toBe(maxTier)
      }
    }
  })

  it('stops nextTier at maxTier exactly: one rung below the ceiling still has a next tier', async () => {
    const { evaluateSeals: evaluate } = await loadWithCeiling(91) // maxTier Astral
    // intuition 100 and 1000 Spirit hold Astral (no chart): the top of what the ceiling allows.
    const top = bySeal(evaluate({ stats: stats(100), esmsBalances: holdings(1000) }), 'intuition')
    expect(top.tier).toBe('Astral')
    expect(top.maxTier).toBe('Astral')
    expect(top.nextTier).toBeNull()
    expect(top.blockedBy).toEqual([])

    // 10 Spirit holds Gold, one rung below: Astral is next, blocked only by the balance.
    const gold = bySeal(evaluate({ stats: stats(100), esmsBalances: holdings(10) }), 'intuition')
    expect(gold.tier).toBe('Gold')
    expect(gold.nextTier).toBe('Astral')
    expect(gold.blockedBy).toEqual(['esms'])
  })

  it('reports the aligned rating to two decimals: neither whole, nor one decimal, nor raw', async () => {
    // The real means only produce multiples of 0.5, which any rounding to 0 or 1 decimal keeps.
    const up = await loadWithCeiling(95.557)
    const seal = bySeal(
      up.evaluateSeals({ stats: stats(100), esmsBalances: holdings(0) }),
      'intuition'
    )
    expect(seal.alignedRating).toBe(95.56)
    expect(seal.maxTier).toBe('Astral')
    const down = await loadWithCeiling(95.552)
    expect(
      bySeal(down.evaluateSeals({ stats: stats(100), esmsBalances: holdings(0) }), 'intuition')
        .alignedRating
    ).toBe(95.55)
  })

  it('does not call a stat short of a gate it sits exactly on', async () => {
    // Ceiling 96: the perfect stat aligns to Celestial's gate itself, so only the chart can block it.
    const { evaluateSeals: evaluate } = await loadWithCeiling(96)
    const seal = bySeal(evaluate({ stats: stats(100), esmsBalances: holdings(1000) }), 'intuition')
    expect(seal.alignedRating).toBe(96)
    expect(seal.nextTier).toBe('Celestial')
    expect(seal.blockedBy).toEqual(['natal'])
  })
})

// ─── The Celestial natal rule ────────────────────────────────────────────────

describe('the Celestial natal rule', () => {
  it('needs four bodies in the token’s element for Celestial — three is not enough', () => {
    for (const token of TOKENS) {
      const sealsOfToken = LITERAL_SEALS.filter(s => s.token === token && s.stat !== 'power')
      for (const [count, expected] of [
        [0, 'Astral'],
        [3, 'Astral'],
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
          const got = bySeal(results, seal.stat)
          expect(got.natalAffinity, `${token} ${count}`).toBe(count)
          expect(got.tier, `${seal.stat} with ${count} ${token} bodies`).toBe(expected)
          expect(got.blockedBy, `${seal.stat} with ${count} ${token} bodies`).toEqual(
            expected === 'Astral' ? ['natal'] : []
          )
        }
      }
    }
    // Substance rides on power alone, which tops out at Gold: the rule has no Seal to bind there,
    // and the other three tokens each have at least one.
    expect(LITERAL_SEALS.filter(s => s.token === 'substance' && s.stat !== 'power')).toEqual([])
    for (const token of ['spirit', 'essence', 'matter'] as const) {
      expect(
        LITERAL_SEALS.filter(s => s.token === token && s.stat !== 'power').length
      ).toBeGreaterThan(0)
    }
  })

  it('counts each of the ten classical bodies individually: every four-body window unlocks it', () => {
    // A window of four consecutive bodies, rotated through all ten positions, so every body is
    // taken out of the chart in turn: leaving any one of them out leaves three and no Celestial.
    BODIES.forEach((_, start) => {
      const inElement = new Set(
        [0, 1, 2, 3].map(offset => BODIES[(start + offset) % BODIES.length])
      )
      const planets = Object.fromEntries(
        BODIES.map(body => [body, { sign: inElement.has(body) ? 'Aries' : 'Taurus' }])
      )
      const four = evaluateSeals({
        stats: stats(100),
        esmsBalances: holdings(1000),
        natalChart: { planets, provenance: 'computed' },
      })
      expect(bySeal(four, 'intuition').natalAffinity, `from ${BODIES[start]}`).toBe(4)
      expect(bySeal(four, 'intuition').tier, `from ${BODIES[start]}`).toBe('Celestial')

      for (const dropped of inElement) {
        const three = { ...planets, [dropped]: { sign: 'Taurus' } }
        const result = evaluateSeals({
          stats: stats(100),
          esmsBalances: holdings(1000),
          natalChart: { planets: three, provenance: 'computed' },
        })
        expect(bySeal(result, 'intuition').natalAffinity, `without ${dropped}`).toBe(3)
        expect(bySeal(result, 'intuition').tier, `without ${dropped}`).toBe('Astral')
      }
    })
  })

  it('counts only the ten classical bodies: other points in the element never make up the four', () => {
    const planets: Record<string, { sign: string }> = {
      Sun: { sign: 'Aries' },
      Moon: { sign: 'Leo' },
      Mercury: { sign: 'Sagittarius' },
      Venus: { sign: 'Taurus' },
      Chiron: { sign: 'Aries' },
      Lilith: { sign: 'Aries' },
      NorthNode: { sign: 'Aries' },
      Ascendant: { sign: 'Aries' },
      Midheaven: { sign: 'Aries' },
    }
    const result = evaluateSeals({
      stats: stats(100),
      esmsBalances: holdings(1000),
      natalChart: { planets, provenance: 'computed' },
    })
    expect(bySeal(result, 'intuition').natalAffinity).toBe(3)
    expect(bySeal(result, 'intuition').tier).toBe('Astral')
  })

  it('ignores unknown or mis-cased signs, and an empty chart has zero affinity (not null)', () => {
    const planets: Record<string, { sign: string }> = {
      Sun: { sign: 'Ophiuchus' },
      Moon: { sign: 'Aries' },
      Mercury: { sign: 'aries' },
      Venus: { sign: 'Leo' },
    }
    expect(natalAffinity({ planets }, 'spirit')).toBe(2)
    expect(natalAffinity({ planets: {} }, 'spirit')).toBe(0)
  })

  it('maps each token to its element: Spirit Fire, Essence Water, Matter Earth, Substance Air', () => {
    const fireOnly = { planets: { Sun: { sign: 'Leo' }, Moon: { sign: 'Sagittarius' } } }
    const waterOnly = { planets: { Sun: { sign: 'Scorpio' }, Moon: { sign: 'Pisces' } } }
    const earthOnly = { planets: { Sun: { sign: 'Virgo' }, Moon: { sign: 'Capricorn' } } }
    const airOnly = { planets: { Sun: { sign: 'Libra' }, Moon: { sign: 'Aquarius' } } }
    const table: Array<[NatalChartInput, Token]> = [
      [fireOnly, 'spirit'],
      [waterOnly, 'essence'],
      [earthOnly, 'matter'],
      [airOnly, 'substance'],
    ]
    for (const [natalChart, owner] of table) {
      for (const token of TOKENS) {
        expect(natalAffinity(natalChart, token), `${owner} chart read as ${token}`).toBe(
          token === owner ? 2 : 0
        )
      }
    }
  })

  it('maps all twelve signs to the right element', () => {
    for (const sign of SIGNS) {
      for (const token of TOKENS) {
        expect(natalAffinity({ planets: { Sun: { sign } } }, token), `${sign} for ${token}`).toBe(
          SIGN_ELEMENT[sign] === TOKEN_ELEMENT[token] ? 1 : 0
        )
      }
    }
  })

  it('counts each of the ten bodies toward the affinity — and nothing else', () => {
    for (const body of BODIES) {
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

  it('reads provenance: computed, authored and unlabelled charts count; placeholder, unattributed, none do not', () => {
    expect(natalAffinity(chart('computed'), 'spirit')).toBe(4)
    expect(natalAffinity(chart('authored'), 'spirit')).toBe(4)
    expect(natalAffinity(chart(undefined), 'spirit')).toBe(4)
    expect(natalAffinity(chart('placeholder'), 'spirit')).toBeNull()
    expect(natalAffinity(chart('unattributed'), 'spirit')).toBeNull()
    expect(natalAffinity(null, 'spirit')).toBeNull()
    expect(natalAffinity(undefined, 'spirit')).toBeNull()
  })
})

// ─── maxTier and nextTier ────────────────────────────────────────────────────

describe('maxTier and nextTier', () => {
  const LITERAL_MAX_TIER: Record<Stat, SealTier> = {
    power: 'Gold',
    resonance: 'Celestial',
    wisdom: 'Celestial',
    charisma: 'Celestial',
    intuition: 'Celestial',
    adaptability: 'Celestial',
    vitality: 'Celestial',
  }

  it('pins every Seal’s maxTier: Gold for Crucible Finisher, Celestial for the other six', () => {
    const results = evaluateSeals({ stats: stats(50), esmsBalances: holdings(0) })
    expect(Object.fromEntries(results.map(r => [r.stat, r.maxTier]))).toEqual(LITERAL_MAX_TIER)
  })

  it('never changes maxTier with the stats, balances or chart', () => {
    for (const value of [0, 25, 50, 75, 99, 100]) {
      for (const balance of [0, 0.5, 49.99, 250, 1000]) {
        for (const natalChart of [
          null,
          chartWithAffinity('spirit', 4),
          chartWithAffinity('substance', 10),
          chartWithAffinity('spirit', 10, 'placeholder'),
        ]) {
          const results = evaluateSeals({
            stats: stats(value),
            esmsBalances: holdings(balance),
            natalChart,
          })
          for (const r of results) {
            expect(r.maxTier, `${r.id} stat ${value} balance ${balance}`).toBe(
              LITERAL_MAX_TIER[r.stat]
            )
          }
        }
      }
    }
  })

  it('leaves a perfect, fully funded power vessel at Gold with nothing above it', () => {
    for (const natalChart of [null, chartWithAffinity('substance', 10)]) {
      const crucible = bySeal(
        evaluateSeals({ stats: stats(100), esmsBalances: holdings(1000), natalChart }),
        'power'
      )
      expect(crucible.tier).toBe('Gold')
      expect(crucible.maxTier).toBe('Gold')
      expect(crucible.nextTier).toBeNull()
      expect(crucible.blockedBy).toEqual([])
      expect(crucible.alignedRating).toBe(90.5)
    }
  })

  it('gives power a next tier one rung short of its cap (Silver → Gold)', () => {
    // power 90 → aligned 83.5: Silver, with Gold the next and last tier it can show.
    const crucible = bySeal(
      evaluateSeals({ stats: stats(50, { power: 90 }), esmsBalances: holdings(1000) }),
      'power'
    )
    expect(crucible.tier).toBe('Silver')
    expect(crucible.nextTier).toBe('Gold')
    expect(crucible.blockedBy).toEqual(['stat'])
  })

  it('has no next tier once Celestial is cleared', () => {
    const results = evaluateSeals({
      stats: stats(100),
      esmsBalances: holdings(1000),
      natalChart: chartWithAffinity('spirit', 4),
    })
    for (const stat of ['intuition', 'adaptability'] as const) {
      const seal = bySeal(results, stat)
      expect(seal.tier).toBe('Celestial')
      expect(seal.nextTier).toBeNull()
      expect(seal.blockedBy).toEqual([])
    }
  })

  it('steps one tier at a time as Spirit is added: Copper, Silver, Gold, Astral, Celestial', () => {
    const natalChart = chartWithAffinity('spirit', 4)
    const ladder: Array<[number, SealTier | null, SealTier | null]> = [
      [0, null, 'Copper'],
      [0.5, 'Copper', 'Silver'],
      [2, 'Silver', 'Gold'],
      [10, 'Gold', 'Astral'],
      [50, 'Astral', 'Celestial'],
      [250, 'Celestial', null],
    ]
    for (const [spirit, tier, nextTier] of ladder) {
      const astral = bySeal(
        evaluateSeals({ stats: stats(100), esmsBalances: holdings(0, { spirit }), natalChart }),
        'intuition'
      )
      expect(astral.tier, `${spirit} Spirit`).toBe(tier)
      expect(astral.nextTier, `${spirit} Spirit`).toBe(nextTier)
      expect(astral.blockedBy, `${spirit} Spirit`).toEqual(nextTier === null ? [] : ['esms'])
    }
  })

  it('lists every blocker, in the order stat, esms, natal', () => {
    // Intuition 90 rates 92 and aligns to 94: Astral on the stat, but short of Celestial's 96.
    // 100 Spirit clears Astral's 50 and is short of Celestial's 250; and there is no chart.
    const astral = bySeal(
      evaluateSeals({
        stats: stats(50, { intuition: 90 }),
        esmsBalances: holdings(0, { spirit: 100 }),
      }),
      'intuition'
    )
    expect(astral.statRating).toBe(92)
    expect(astral.alignedRating).toBe(94)
    expect(astral.tier).toBe('Astral')
    expect(astral.nextTier).toBe('Celestial')
    expect(astral.blockedBy).toEqual(['stat', 'esms', 'natal'])

    // Nothing at all: Copper is blocked on stat and balance, not on the chart.
    const nothing = bySeal(
      evaluateSeals({ stats: stats(0), esmsBalances: holdings(0) }),
      'intuition'
    )
    expect(nothing.tier).toBeNull()
    expect(nothing.nextTier).toBe('Copper')
    expect(nothing.blockedBy).toEqual(['stat', 'esms'])
  })

  it('blocks Celestial on the chart alone when the stat and the balance both clear', () => {
    for (const natalChart of [null, chartWithAffinity('spirit', 3), chart('placeholder')]) {
      const seal = bySeal(
        evaluateSeals({ stats: stats(100), esmsBalances: holdings(1000), natalChart }),
        'intuition'
      )
      expect(seal.nextTier).toBe('Celestial')
      expect(seal.blockedBy).toEqual(['natal'])
    }
  })

  it('names "natal" only for the Celestial step, never for a lower tier', () => {
    const seal = bySeal(
      evaluateSeals({ stats: stats(100), esmsBalances: holdings(0, { spirit: 0 }) }),
      'intuition'
    )
    expect(seal.nextTier).toBe('Copper')
    expect(seal.blockedBy).toEqual(['esms'])
  })
})

// ─── earnedSeals ─────────────────────────────────────────────────────────────

describe('earnedSeals', () => {
  it('returns exactly the contract’s canonical Seals for the tiers held, in stat order', () => {
    const results = evaluateSeals({
      stats: stats(100),
      esmsBalances: holdings(0, { spirit: 1, matter: 3 }),
    })
    // Spirit 1 clears Copper (0.5) only; Matter 3 clears Silver (2); Essence/Substance are empty.
    const earned = earnedSeals(results)
    expect(earned).toEqual([
      buildCanonicalSeal('wisdom', 'Silver'),
      buildCanonicalSeal('intuition', 'Copper'),
      buildCanonicalSeal('adaptability', 'Copper'),
      buildCanonicalSeal('vitality', 'Silver'),
    ])
    expect(earned.map(s => s.id)).toEqual([
      'seal-wisdom',
      'seal-intuition',
      'seal-adaptability',
      'seal-vitality',
    ])
    expect(earned.map(s => s.tier)).toEqual(['Silver', 'Copper', 'Copper', 'Silver'])
    expect(earned.map(s => s.statKey)).toEqual(['wisdom', 'intuition', 'adaptability', 'vitality'])
  })

  it('carries the contract’s fields: ESMS category, tier multiplier, name and no extras', () => {
    // Fire ×4 (the first four bodies) and Earth ×6: Spirit and Matter Seals are blessed, the
    // Essence and Substance ones are not.
    const results = evaluateSeals({
      stats: stats(100),
      esmsBalances: holdings(1000),
      natalChart: chartWithAffinity('spirit', 4),
    })
    const earned = earnedSeals(results)
    expect(earned).toHaveLength(7)
    expect(earned.map(s => s.statKey)).toEqual([...STATS])
    const byStat = Object.fromEntries(earned.map(s => [s.statKey, s]))
    expect(byStat.power).toMatchObject({
      id: 'seal-power',
      name: 'Crucible Finisher',
      category: 'substance',
      tier: 'Gold',
      multiplier: 1.18,
    })
    expect(byStat.resonance).toMatchObject({
      id: 'seal-resonance',
      name: 'Tidal Chorus',
      category: 'essence',
      tier: 'Astral',
      multiplier: 1.28,
    })
    expect(byStat.intuition).toMatchObject({
      id: 'seal-intuition',
      name: 'Astral Vision',
      category: 'spirit',
      tier: 'Celestial',
      multiplier: 1.4,
    })
    expect(byStat.wisdom).toMatchObject({
      id: 'seal-wisdom',
      category: 'matter',
      tier: 'Celestial',
      multiplier: 1.4,
    })
    for (const seal of earned) {
      expect(Object.keys(seal).sort(), seal.id).toEqual([
        'category',
        'description',
        'id',
        'multiplier',
        'name',
        'statKey',
        'tier',
      ])
      expect(seal.category, seal.id).toBe(TOKEN_OF[seal.statKey!])
    }
  })

  it('leaves out every Seal whose tier is null, and returns nothing for an empty list', () => {
    expect(earnedSeals([])).toEqual([])
    const none = evaluateSeals({ stats: stats(0), esmsBalances: holdings(1000) })
    expect(none.every(r => r.tier === null)).toBe(true)
    expect(earnedSeals(none)).toEqual([])
    // Mixed: one Seal earned, six not.
    const one = evaluateSeals({
      stats: stats(0, { vitality: 100 }),
      esmsBalances: holdings(0, { matter: 2 }),
    })
    expect(earnedSeals(one)).toEqual([buildCanonicalSeal('vitality', 'Silver')])
  })

  it('follows the order of the list it is given, reading each result’s stat and tier', () => {
    const results = evaluateSeals({
      stats: stats(100),
      esmsBalances: holdings(0, { spirit: 1, matter: 3 }),
    })
    const reversed = [...results].reverse()
    expect(earnedSeals(reversed)).toEqual([
      buildCanonicalSeal('vitality', 'Silver'),
      buildCanonicalSeal('adaptability', 'Copper'),
      buildCanonicalSeal('intuition', 'Copper'),
      buildCanonicalSeal('wisdom', 'Silver'),
    ])
  })

  it('agrees with the progress list: one canonical Seal per non-null tier, same tier', () => {
    const rand = lcg(0xfeed5eed)
    for (let i = 0; i < 200; i++) {
      const s = {} as CoreStats
      for (const k of STATS) s[k] = Math.floor(rand() * 101)
      const results = evaluateSeals({
        stats: s,
        esmsBalances: holdings(0, {
          spirit: rand() * 300,
          essence: rand() * 300,
          matter: rand() * 300,
          substance: rand() * 300,
        }),
        natalChart: rand() < 0.5 ? chart('computed') : null,
      })
      const held = results.filter(r => r.tier !== null)
      expect(earnedSeals(results)).toEqual(held.map(r => buildCanonicalSeal(r.stat, r.tier!)))
    }
  })
})

// ─── Seals across the roster ─────────────────────────────────────────────────

describe('Seals across the historical roster', () => {
  it('gives a pyramid, not a flat field, when holdings are not the constraint', () => {
    const tiers = HISTORICAL_AGENTS.flatMap(agent =>
      evaluateSeals({ stats: deriveSacredStats(agent), esmsBalances: holdings(1000) }).map(r =>
        tierIndex(r.tier)
      )
    )
    const share = (atLeast: number) => tiers.filter(t => t >= atLeast).length / tiers.length
    // Measured 2026-10-19 with the contract's means: Copper+ 0.66, Silver+ 0.30, Gold+ 0.05,
    // Astral+ 0.00.
    expect(share(0)).toBeGreaterThan(0.5)
    expect(share(0)).toBeLessThan(0.85)
    expect(share(1)).toBeGreaterThan(0.15)
    expect(share(1)).toBeLessThan(0.45)
    expect(share(2)).toBeLessThan(0.1)
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

  it('does not let Crucible Finisher out-award the other Seals — alignment is what holds it back', () => {
    const rated = HISTORICAL_AGENTS.map(agent =>
      evaluateSeals({ stats: deriveSacredStats(agent), esmsBalances: holdings(0) })
    )
    const share = (stat: Stat, aligned: boolean) =>
      rated.filter(results => {
        const rating = bySeal(results, stat).statRating
        return (aligned ? computeMeanAlignedRating(stat, rating) : rating) >= 80
      }).length / rated.length
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
    const others = STATS.filter(s => s !== 'power')

    // Measured: on the raw rating power clears Silver at 2.3 times the median Seal's rate …
    expect(share('power', false) / median(others.map(s => share(s, false)))).toBeGreaterThan(2)
    // … aligned, it does not out-award them.
    expect(share('power', true) / median(others.map(s => share(s, true)))).toBeLessThan(1.5)
  })
})

// ─── calculateResonanceSurge ─────────────────────────────────────────────────

/** A calibration where a quantity of 0–100 is its own percentage: heat 50 is a position of 0.5. */
const PCT: SurgeCalibration = { heat: { low: 0, high: 100 }, reactivity: { low: 0, high: 100 } }
/** A calibration where 0–10 is the ramp. */
const UNIT: SurgeCalibration = { heat: { low: 0, high: 10 }, reactivity: { low: 0, high: 10 } }

type Archetype = { primary: Stat; secondary: Stat }
const ARCH: Archetype = { primary: 'power', secondary: 'charisma' }

/** The contract's boost table, written out: [primary, secondary, every other stat]. */
function boostsFor(archetype: Archetype, [first, second, rest]: [number, number, number]) {
  return Object.fromEntries(
    STATS.map(stat => [
      stat,
      stat === archetype.primary ? first : stat === archetype.secondary ? second : rest,
    ])
  ) as Record<Stat, number>
}
const INFERNO_OR_TEMPEST: [number, number, number] = [12, 8, 4]
const EQUILIBRIUM: [number, number, number] = [16, 12, 8]

describe('calculateResonanceSurge', () => {
  const run = (
    heat: number,
    reactivity: number,
    extras: { monica?: number | null; archetype?: Archetype } = {},
    calibration: SurgeCalibration = PCT
  ) =>
    calculateResonanceSurge(
      { thermodynamics: { heat, reactivity }, archetype: ARCH, ...extras },
      calibration
    )

  describe('the meter', () => {
    it('hand-computed ramp positions on the default calibration: 0 at the low anchors, 1 at the high', () => {
      const { heat, reactivity } = DEFAULT_SURGE_CALIBRATION
      const calm = calculateResonanceSurge({
        thermodynamics: { heat: heat.low, reactivity: reactivity.low },
        archetype: ARCH,
      })
      expect(calm).toMatchObject({
        heat: 0,
        reactivity: 0,
        skyMeter: 0,
        meter: 0,
        active: false,
        statBoosts: {},
      })

      const storm = calculateResonanceSurge({
        thermodynamics: { heat: heat.high, reactivity: reactivity.high },
        archetype: ARCH,
      })
      expect(storm).toMatchObject({
        heat: 1,
        reactivity: 1,
        skyMeter: 100,
        meter: 100,
        active: true,
      })

      // Midpoints and quarter points of 0.0184…0.1154 and 0.561…3.586, worked out by hand.
      const mid = calculateResonanceSurge({
        thermodynamics: { heat: 0.0669, reactivity: 2.0735 },
        archetype: ARCH,
      })
      expect(mid.heat).toBeCloseTo(0.5, 12)
      expect(mid.reactivity).toBeCloseTo(0.5, 12)
      expect(mid.skyMeter).toBeCloseTo(50, 10)
      const quarter = calculateResonanceSurge({
        thermodynamics: { heat: 0.04265, reactivity: 1.31725 },
        archetype: ARCH,
      })
      expect(quarter.heat).toBeCloseTo(0.25, 12)
      expect(quarter.reactivity).toBeCloseTo(0.25, 12)
      expect(quarter.skyMeter).toBeCloseTo(25, 10)
    })

    it('takes each quantity through its own anchors: heat 0.06 and reactivity 1.5', () => {
      // heat (0.06 − 0.0184) / (0.1154 − 0.0184) = 0.0416 / 0.097 = 0.42886598
      // reactivity (1.5 − 0.561) / (3.586 − 0.561) = 0.939 / 3.025 = 0.31041322
      // skyMeter = 100 · (0.5 · 0.42886598 + 0.5 · 0.31041322) = 36.96396
      const s = calculateResonanceSurge({
        thermodynamics: { heat: 0.06, reactivity: 1.5 },
        archetype: ARCH,
      })
      expect(s.heat).toBeCloseTo(0.4288659794, 9)
      expect(s.reactivity).toBeCloseTo(0.3104132231, 9)
      expect(s.skyMeter).toBeCloseTo(36.963960126, 6)
      expect(s.harmonyOffset).toBe(0)
      expect(s.meter).toBe(37)
      expect(s.active).toBe(false)
      expect(s.surgeType).toBe('inferno') // 0.4289 ≥ 0.3104
      expect(s.statBoosts).toEqual({})
    })

    it('clamps each quantity to its own 0–1 ramp and the meter to 0–100', () => {
      expect(run(-3, -3)).toMatchObject({ heat: 0, reactivity: 0, skyMeter: 0, meter: 0 })
      expect(run(500, 500)).toMatchObject({ heat: 1, reactivity: 1, skyMeter: 100, meter: 100 })
      expect(run(-3, 10, {}, UNIT)).toMatchObject({ heat: 0, reactivity: 1, skyMeter: 50 })
      expect(run(500, 0, {}, UNIT)).toMatchObject({ heat: 1, reactivity: 0, skyMeter: 50 })
      expect(run(-1e9, -1e9).skyMeter).toBe(0)
      expect(run(1e9, 1e9).skyMeter).toBe(100)
    })

    it('splits the meter evenly between heat and reactivity', () => {
      expect(run(10, 0, {}, UNIT).skyMeter).toBe(50)
      expect(run(0, 10, {}, UNIT).skyMeter).toBe(50)
      expect(run(5, 5, {}, UNIT).skyMeter).toBe(50)
      expect(run(10, 10, {}, UNIT).skyMeter).toBe(100)
      expect(run(10, 5, {}, UNIT).skyMeter).toBe(75)
      expect(run(5, 10, {}, UNIT).skyMeter).toBe(75)
      expect(run(2, 4, {}, UNIT).skyMeter).toBeCloseTo(30, 9)
    })

    it('reports heat and reactivity as ramp positions, not the raw thermodynamics', () => {
      const s = run(4, 6, {}, UNIT)
      expect(s.heat).toBeCloseTo(0.4, 12)
      expect(s.reactivity).toBeCloseTo(0.6, 12)
      // heat ramps 2→6 and reactivity 1→5: at 4 they are 0.5 and 0.75, so swapping them shows.
      const asymmetric: SurgeCalibration = {
        heat: { low: 2, high: 6 },
        reactivity: { low: 1, high: 5 },
      }
      const mid = run(4, 4, {}, asymmetric)
      expect(mid.heat).toBe(0.5)
      expect(mid.reactivity).toBe(0.75)
      expect(mid.skyMeter).toBeCloseTo(62.5, 9)
      expect(mid.meter).toBe(63) // 62.5 rounds half up
      expect(run(5.9, 4, {}, asymmetric).heat).toBeCloseTo(0.975, 12)
    })

    it('rounds the meter to an integer: 69.4 is 69 and inactive, 69.5 is 70 and active', () => {
      // heat pinned at its high anchor (a position of 1), so skyMeter = 50 + reactivity / 2.
      const table: Array<[number, number, number, boolean]> = [
        // [reactivity, skyMeter, meter, active]
        [38, 69, 69, false],
        [38.8, 69.4, 69, false],
        [38.99, 69.495, 69, false],
        [39, 69.5, 70, true],
        [39.01, 69.505, 70, true],
        [39.2, 69.6, 70, true],
        [40, 70, 70, true],
        [41.2, 70.6, 71, true],
        [44, 72, 72, true],
        [50, 75, 75, true],
        [99.2, 99.6, 100, true],
      ]
      for (const [reactivity, sky, meter, active] of table) {
        const s = run(100, reactivity)
        expect(s.skyMeter, `reactivity ${reactivity}`).toBeCloseTo(sky, 9)
        expect(s.meter, `reactivity ${reactivity}`).toBe(meter)
        expect(Number.isInteger(s.meter), `reactivity ${reactivity}`).toBe(true)
        expect(s.active, `reactivity ${reactivity}`).toBe(active)
      }
      // The boundary case really is exactly 69.5, so the rounding above is not at the mercy of a float.
      expect(run(100, 39).skyMeter).toBe(69.5)
      expect(run(100, 39).meter).toBe(70)
    })

    it('judges `active` on the rounded meter, equal to meter ≥ 70 — a literal, not a constant', () => {
      for (let h = 0; h <= 100; h += 5) {
        for (let r = 0; r <= 100; r += 2.5) {
          const s = run(h, r)
          expect(s.active, `heat ${h} reactivity ${r}`).toBe(s.meter >= 70)
          expect(Object.keys(s.statBoosts).length > 0, `heat ${h} reactivity ${r}`).toBe(s.active)
        }
      }
    })

    it('leaves boosts empty below the threshold and fills all seven stats at or above it', () => {
      const quiet = run(100, 30) // 65
      expect(quiet.meter).toBe(65)
      expect(quiet.active).toBe(false)
      expect(quiet.statBoosts).toEqual({})

      const live = run(100, 40) // 70
      expect(live.meter).toBe(70)
      expect(live.active).toBe(true)
      expect(Object.keys(live.statBoosts).sort()).toEqual([...STATS].sort())
    })

    it('keeps the meter, the sky meter and the ramp positions in range, and the meter whole', () => {
      const rand = lcg(0x2468ace1)
      for (let i = 0; i < 400; i++) {
        const s = calculateResonanceSurge({
          thermodynamics: { heat: rand() * 0.2 - 0.02, reactivity: rand() * 5 - 0.5 },
          archetype: ARCH,
        })
        expect(s.skyMeter).toBeGreaterThanOrEqual(0)
        expect(s.skyMeter).toBeLessThanOrEqual(100)
        expect(Number.isInteger(s.meter)).toBe(true)
        expect(s.meter).toBeGreaterThanOrEqual(0)
        expect(s.meter).toBeLessThanOrEqual(100)
        expect(s.heat).toBeGreaterThanOrEqual(0)
        expect(s.heat).toBeLessThanOrEqual(1)
        expect(s.reactivity).toBeGreaterThanOrEqual(0)
        expect(s.reactivity).toBeLessThanOrEqual(1)
        // Without a chart the meter is the sky meter, rounded.
        expect(s.meter).toBe(Math.round(s.skyMeter))
      }
    })

    it('is monotone: more heat or reactivity never lowers the meter or deactivates it', () => {
      const rand = lcg(0x7a3d9c15)
      for (let i = 0; i < 500; i++) {
        const heat = rand() * 0.2
        const reactivity = rand() * 5
        const before = calculateResonanceSurge({
          thermodynamics: { heat, reactivity },
          archetype: ARCH,
        })
        for (const next of [
          { heat: heat * 1.1 + 0.001, reactivity },
          { heat, reactivity: reactivity * 1.1 + 0.01 },
        ]) {
          const after = calculateResonanceSurge({ thermodynamics: next, archetype: ARCH })
          expect(after.skyMeter).toBeGreaterThanOrEqual(before.skyMeter)
          expect(after.meter).toBeGreaterThanOrEqual(before.meter)
          if (before.active) expect(after.active).toBe(true)
        }
      }
    })
  })

  describe('the surge type', () => {
    it('is inferno when the heat position leads or ties, tempest only when reactivity leads', () => {
      expect(run(10, 5, {}, UNIT).surgeType).toBe('inferno')
      expect(run(5, 10, {}, UNIT).surgeType).toBe('tempest')
      expect(run(5, 5, {}, UNIT).surgeType).toBe('inferno') // an exact tie
      expect(run(0, 0, {}, UNIT).surgeType).toBe('inferno')
      expect(run(10, 10, {}, UNIT).surgeType).toBe('inferno')
      // A one-in-a-million lead is still a lead; an exact tie is not.
      expect(run(5, 5.000001, {}, UNIT).surgeType).toBe('tempest')
      expect(run(5, 4.999999, {}, UNIT).surgeType).toBe('inferno')
    })

    it('follows the ramp positions, not the raw numbers', () => {
      const asymmetric: SurgeCalibration = {
        heat: { low: 2, high: 6 },
        reactivity: { low: 1, high: 5 },
      }
      // Raw heat 4 and reactivity 4 tie, but the positions are 0.5 and 0.75.
      expect(run(4, 4, {}, asymmetric).surgeType).toBe('tempest')
      // Raw heat 4 against reactivity 3: the raw numbers say heat leads; the positions tie at 0.5.
      const tie = run(4, 3, {}, asymmetric)
      expect(tie.heat).toBe(0.5)
      expect(tie.reactivity).toBe(0.5)
      expect(tie.surgeType).toBe('inferno')
      // Raw heat 5 against reactivity 4: positions 0.75 against 0.75 — tied again.
      expect(run(5, 4, {}, asymmetric).surgeType).toBe('inferno')
      // On the real anchors the raw numbers differ by ~30×, so only the positions compare.
      expect(
        calculateResonanceSurge({
          thermodynamics: { heat: 0.1154, reactivity: 0.6 },
          archetype: ARCH,
        }).surgeType
      ).toBe('inferno')
      expect(
        calculateResonanceSurge({
          thermodynamics: { heat: 0.0184, reactivity: 3.586 },
          archetype: ARCH,
        }).surgeType
      ).toBe('tempest')
      // heat 0.738144 against reactivity 0.740165: reactivity leads by a hair, and it is active.
      const close = calculateResonanceSurge({
        thermodynamics: { heat: 0.09, reactivity: 2.8 },
        archetype: ARCH,
      })
      expect(close.active).toBe(true)
      expect(close.surgeType).toBe('tempest')
    })

    it('names the type the meter is building toward even while quiet', () => {
      const calm = run(2, 4, {}, UNIT) // meter 30, reactivity leads
      expect(calm.active).toBe(false)
      expect(calm.surgeType).toBe('tempest')
      expect(calm.statBoosts).toEqual({})
      expect(run(4, 2, {}, UNIT).surgeType).toBe('inferno')
    })

    it('boosts an inferno and a tempest alike, +12 / +8 / +4 by archetype', () => {
      for (const [heat, reactivity, type] of [
        [10, 5, 'inferno'],
        [5, 10, 'tempest'],
      ] as const) {
        const s = run(heat, reactivity, {}, UNIT)
        expect(s.active, type).toBe(true)
        expect(s.surgeType, type).toBe(type)
        expect(s.statBoosts, type).toEqual(boostsFor(ARCH, INFERNO_OR_TEMPEST))
      }
    })
  })

  describe('Monica', () => {
    it('classifies absent, equilibrium, convergent and divergent', () => {
      const state = (monica: number | null | undefined) => run(5, 5, { monica }, UNIT).monicaState
      expect(state(null)).toBe('absent')
      expect(state(undefined)).toBe('absent')
      expect(state(1.618)).toBe('equilibrium')
      expect(state(0.3)).toBe('convergent')
      expect(state(2.2)).toBe('convergent')
      expect(state(-0.3)).toBe('divergent')
      expect(state(-3)).toBe('divergent')
      expect(state(0)).toBe('divergent') // not produced by the engine, and not positive
      expect(state(-0)).toBe('divergent')
      expect(run(5, 5, {}, UNIT).monicaState).toBe('absent') // omitted Monica is ABSENT
    })

    it('draws the equilibrium band at ±0.001 around 1.618: 1.6185 in, 1.6195 out, exact 1.618 in', () => {
      const state = (monica: number) => run(5, 5, { monica }, UNIT).monicaState
      expect(state(1.618)).toBe('equilibrium')
      expect(state(1.6185)).toBe('equilibrium')
      expect(state(1.6175)).toBe('equilibrium')
      expect(state(1.6189)).toBe('equilibrium')
      expect(state(1.6171)).toBe('equilibrium')
      expect(state(1.6195)).toBe('convergent')
      expect(state(1.6165)).toBe('convergent')
      expect(state(1.6191)).toBe('convergent')
      expect(state(1.6169)).toBe('convergent')
      expect(state(-1.618)).toBe('divergent') // the sign matters: −φ is not equilibrium
      expect(state(Number.MIN_VALUE)).toBe('convergent')
      expect(state(-Number.MIN_VALUE)).toBe('divergent')
      expect(MONICA_EQUILIBRIUM).toBe(1.618) // the engine's constant, written out
    })

    it('reports Monica on the state: the number, or null for absent — zero stays zero', () => {
      expect(run(5, 5, { monica: 1.4 }, UNIT).monica).toBe(1.4)
      expect(run(5, 5, { monica: 0 }, UNIT).monica).toBe(0)
      expect(run(5, 5, { monica: -2.5 }, UNIT).monica).toBe(-2.5)
      expect(run(5, 5, { monica: null }, UNIT).monica).toBeNull()
      expect(run(5, 5, {}, UNIT).monica).toBeNull()
      expect(run(5, 5, { monica: undefined }, UNIT).monica).toBeNull()
    })

    it('never moves the meter: every Monica gives the same sky meter, meter, positions and activity', () => {
      const thermodynamics = { heat: 0.05, reactivity: 2.1 }
      const baseline = calculateResonanceSurge({ thermodynamics, archetype: ARCH })
      for (const monica of [null, undefined, 1.618, 1.6185, 1.4, -3.2, 0, 1e9]) {
        const state = calculateResonanceSurge({ thermodynamics, monica, archetype: ARCH })
        expect(state.meter, String(monica)).toBe(baseline.meter)
        expect(state.skyMeter, String(monica)).toBe(baseline.skyMeter)
        expect(state.heat, String(monica)).toBe(baseline.heat)
        expect(state.reactivity, String(monica)).toBe(baseline.reactivity)
        expect(state.active, String(monica)).toBe(baseline.active)
        expect(state.harmonyOffset, String(monica)).toBe(baseline.harmonyOffset)
      }
    })

    it('upgrades an ACTIVE surge at Monica equilibrium to the equilibrium type with +16 / +12 / +8', () => {
      const dual = run(10, 5, { monica: 1.618 }, UNIT)
      expect(dual.active).toBe(true)
      expect(dual.surgeType).toBe('equilibrium')
      expect(dual.monicaState).toBe('equilibrium')
      expect(dual.meter).toBe(75) // Monica did not move the meter
      expect(dual.statBoosts).toEqual(boostsFor(ARCH, EQUILIBRIUM))
      expect(dual.statBoosts).toEqual({
        power: 16,
        resonance: 8,
        wisdom: 8,
        charisma: 12,
        intuition: 8,
        adaptability: 8,
        vitality: 8,
      })

      // Whichever type was building, the upgrade is the same.
      const tempest = run(5, 10, { monica: 1.618 }, UNIT)
      expect(tempest.surgeType).toBe('equilibrium')
      expect(tempest.statBoosts).toEqual(boostsFor(ARCH, EQUILIBRIUM))
    })

    it('accepts any Monica inside the band for the upgrade, and none outside it', () => {
      for (const monica of [1.618, 1.6185, 1.6175, 1.6189]) {
        expect(run(10, 5, { monica }, UNIT).surgeType, String(monica)).toBe('equilibrium')
      }
      for (const monica of [null, undefined, 1.6195, 1.6165, 1.6191, 0.3, 0, -0, -1.618, -3]) {
        const state = run(10, 5, { monica }, UNIT)
        expect(state.active, String(monica)).toBe(true)
        expect(state.surgeType, String(monica)).toBe('inferno')
        expect(state.statBoosts, String(monica)).toEqual(boostsFor(ARCH, INFERNO_OR_TEMPEST))
      }
    })

    it('does not upgrade an INACTIVE surge, whatever Monica says', () => {
      const quiet = run(10, 3, { monica: 1.618 }, UNIT) // meter 65
      expect(quiet.active).toBe(false)
      expect(quiet.surgeType).toBe('inferno')
      expect(quiet.monicaState).toBe('equilibrium')
      expect(quiet.statBoosts).toEqual({})
    })

    it('upgrades exactly when the rounded meter reaches 70, and not a hair below', () => {
      const at = run(100, 39, { monica: 1.618 }) // sky 69.5 → meter 70
      expect(at.meter).toBe(70)
      expect(at.active).toBe(true)
      expect(at.surgeType).toBe('equilibrium')
      const below = run(100, 38.8, { monica: 1.618 }) // sky 69.4 → meter 69
      expect(below.meter).toBe(69)
      expect(below.active).toBe(false)
      expect(below.surgeType).toBe('inferno')
      expect(below.statBoosts).toEqual({})
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
      const withPresent = calculateResonanceSurge({
        thermodynamics,
        monica: present,
        archetype: ARCH,
      })
      const withAbsent = calculateResonanceSurge({
        thermodynamics,
        monica: absent,
        archetype: ARCH,
      })
      expect(withPresent.monicaState).toBe('equilibrium')
      expect(withAbsent.monicaState).toBe('absent')
      expect(withAbsent.monica).toBeNull()
      expect(withAbsent.meter).toBe(withPresent.meter)
      expect(Number.isFinite(withAbsent.meter)).toBe(true)
    })
  })

  describe('the stat boosts', () => {
    it('are keyed by the archetype passed in: +12 primary, +8 secondary, +4 every other stat', () => {
      const archetypes: Archetype[] = [
        { primary: 'power', secondary: 'charisma' },
        { primary: 'charisma', secondary: 'power' },
        { primary: 'vitality', secondary: 'wisdom' },
        { primary: 'wisdom', secondary: 'vitality' },
        { primary: 'resonance', secondary: 'adaptability' },
        { primary: 'intuition', secondary: 'resonance' },
      ]
      for (const archetype of archetypes) {
        const label = `${archetype.primary}/${archetype.secondary}`
        expect(run(10, 5, { archetype }, UNIT).statBoosts, label).toEqual(
          boostsFor(archetype, INFERNO_OR_TEMPEST)
        )
        expect(run(5, 10, { archetype }, UNIT).statBoosts, `${label} tempest`).toEqual(
          boostsFor(archetype, INFERNO_OR_TEMPEST)
        )
        expect(run(10, 5, { archetype, monica: 1.618 }, UNIT).statBoosts, `${label} dual`).toEqual(
          boostsFor(archetype, EQUILIBRIUM)
        )
      }
    })

    it('hand-checked for one archetype: vitality / wisdom', () => {
      const archetype: Archetype = { primary: 'vitality', secondary: 'wisdom' }
      expect(run(10, 5, { archetype }, UNIT).statBoosts).toEqual({
        power: 4,
        resonance: 4,
        wisdom: 8,
        charisma: 4,
        intuition: 4,
        adaptability: 4,
        vitality: 12,
      })
    })

    it('boost the primary once, never the secondary on top, when primary and secondary are the same', () => {
      const same: Archetype = { primary: 'wisdom', secondary: 'wisdom' }
      const s = run(10, 5, { archetype: same }, UNIT)
      expect(s.statBoosts.wisdom).toBe(12)
      expect(Object.values(s.statBoosts).filter(v => v === 8)).toEqual([])
      expect(Object.values(s.statBoosts).filter(v => v === 4)).toHaveLength(6)
      const dual = run(10, 5, { archetype: same, monica: 1.618 }, UNIT)
      expect(dual.statBoosts.wisdom).toBe(16)
      expect(Object.values(dual.statBoosts).filter(v => v === 12)).toEqual([])
      expect(Object.values(dual.statBoosts).filter(v => v === 8)).toHaveLength(6)
    })

    it('are empty while the surge is inactive, whichever Monica', () => {
      for (const monica of [null, 1.618, 2]) {
        expect(run(10, 3, { monica }, UNIT).statBoosts).toEqual({})
        expect(run(0, 0, { monica }, UNIT).statBoosts).toEqual({})
      }
    })

    it('do not depend on how strong the surge is: a full meter boosts like a marginal one', () => {
      expect(run(100, 40).statBoosts).toEqual(boostsFor(ARCH, INFERNO_OR_TEMPEST))
      expect(run(100, 100).statBoosts).toEqual(boostsFor(ARCH, INFERNO_OR_TEMPEST))
    })
  })

  describe('the result and its inputs', () => {
    it('has the contract’s state fields plus skyMeter and harmonyOffset, and nothing else', () => {
      const s = run(10, 5, { monica: 1.4 }, UNIT)
      expect(Object.keys(s).sort()).toEqual([
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
    })

    it('reads the default calibration when none is given, and a custom one otherwise', () => {
      const thermodynamics = { heat: 0.06, reactivity: 1.5 }
      const byDefault = calculateResonanceSurge({ thermodynamics, archetype: ARCH })
      expect(byDefault).toEqual(
        calculateResonanceSurge({ thermodynamics, archetype: ARCH }, DEFAULT_SURGE_CALIBRATION)
      )
      // Honoured: the same sky on the unit ramp reads far lower (heat 0.006, reactivity 0.15).
      const custom = run(0.06, 1.5, {}, UNIT)
      expect(custom.heat).toBeCloseTo(0.006, 12)
      expect(custom.reactivity).toBeCloseTo(0.15, 12)
      expect(custom.skyMeter).toBeCloseTo(7.8, 9)
      expect(custom.meter).toBe(8)
      expect(byDefault.meter).toBe(37)
    })

    it('ramps linearly from low to high on negative and offset anchors, and honours both ends', () => {
      const cal: SurgeCalibration = {
        heat: { low: -5, high: -1 },
        reactivity: { low: 100, high: 300 },
      }
      const s = run(-4, 150, {}, cal) // heat (−4+5)/4 = 0.25, reactivity (150−100)/200 = 0.25
      expect(s.heat).toBe(0.25)
      expect(s.reactivity).toBe(0.25)
      expect(s.skyMeter).toBeCloseTo(25, 9)
      const t = run(-3, 250, {}, cal) // heat 0.5, reactivity 0.75
      expect(t.heat).toBe(0.5)
      expect(t.reactivity).toBe(0.75)
      expect(t.skyMeter).toBeCloseTo(62.5, 9)
      expect(t.surgeType).toBe('tempest')
    })

    it('does not modify its inputs, and accepts them frozen', () => {
      const thermodynamics = Object.freeze({ heat: 0.05, reactivity: 2 })
      const archetype = Object.freeze({ primary: 'power', secondary: 'wisdom' } as const)
      const natalChart = Object.freeze({ ...chart('computed') })
      const sky = Object.freeze({ Sun: Object.freeze({ sign: 'Leo' }) }) as SkyBodies
      const calibration = Object.freeze({
        heat: Object.freeze({ low: 0.0184, high: 0.1154 }),
        reactivity: Object.freeze({ low: 0.561, high: 3.586 }),
      })
      const before = JSON.stringify([thermodynamics, archetype, natalChart, sky, calibration])
      const result = calculateResonanceSurge(
        { thermodynamics, archetype, natalChart, sky, monica: 1.618 },
        calibration
      )
      expect(Number.isFinite(result.meter)).toBe(true)
      expect(JSON.stringify([thermodynamics, archetype, natalChart, sky, calibration])).toBe(before)
    })
  })

  describe('invalid input', () => {
    it('refuses thermodynamics when EITHER quantity is non-finite', () => {
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(() => run(bad, 1), `heat ${bad}`).toThrow(RangeError)
        expect(() => run(bad, 1), `heat ${bad}`).toThrow(/non-finite thermodynamics/)
        expect(() => run(1, bad), `reactivity ${bad}`).toThrow(RangeError)
        expect(() => run(1, bad), `reactivity ${bad}`).toThrow(/non-finite thermodynamics/)
        expect(() => run(bad, bad), `both ${bad}`).toThrow(RangeError)
      }
    })

    it('refuses a non-finite Monica, but accepts null, undefined and any finite number', () => {
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(() => run(5, 5, { monica: bad }, UNIT), `monica ${bad}`).toThrow(RangeError)
        expect(() => run(5, 5, { monica: bad }, UNIT), `monica ${bad}`).toThrow(
          /Monica must be a finite number or null/
        )
      }
      for (const fine of [null, undefined, 0, -0, 1.618, -1e300, 1e300]) {
        expect(() => run(5, 5, { monica: fine }, UNIT), String(fine)).not.toThrow()
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
        const heat = () => run(1, 1, {}, { ...UNIT, heat: bad })
        const reactivity = () => run(1, 1, {}, { ...UNIT, reactivity: bad })
        expect(heat, `heat ${label}`).toThrow(RangeError)
        expect(heat, `heat ${label}`).toThrow(/heat calibration/)
        expect(reactivity, `reactivity ${label}`).toThrow(RangeError)
        expect(reactivity, `reactivity ${label}`).toThrow(/reactivity calibration/)
      }
      // The smallest valid gap, a negative-anchored ramp and a wide one all pass.
      expect(() =>
        run(1, 1, {}, { ...UNIT, heat: { low: 0, high: Number.MIN_VALUE } })
      ).not.toThrow()
      expect(() => run(1, 1, {}, { ...UNIT, heat: { low: -5, high: -1 } })).not.toThrow()
      expect(() =>
        run(1, 1, {}, { ...UNIT, reactivity: { low: -1e300, high: 1e300 } })
      ).not.toThrow()
    })
  })
})

// ─── Elemental harmony with the live sky ─────────────────────────────────────

describe('elemental harmony with the live sky', () => {
  const allIn = (sign: string): Record<string, { sign: string }> =>
    Object.fromEntries(BODIES.map(b => [b, { sign }]))
  const natal = (sign: string, provenance?: NatalChartInput['provenance']): NatalChartInput => ({
    planets: allIn(sign),
    provenance,
  })
  // heat 5 / reactivity 5 on the 0–10 ramp: a shared-sky meter of exactly 50.
  const half = { heat: 5, reactivity: 5 }
  const surge = (
    natalChart: NatalChartInput | null,
    sky: SkyBodies | null,
    thermodynamics = half,
    monica?: number | null
  ) => calculateResonanceSurge({ thermodynamics, archetype: ARCH, natalChart, sky, monica }, UNIT)

  it('is bounded: +12 for the same element throughout, −12 for opposed, never more', () => {
    expect(surge(natal('Aries'), allIn('Leo')).harmonyOffset).toBe(12) // Fire on Fire
    expect(surge(natal('Aries'), allIn('Pisces')).harmonyOffset).toBe(-12) // Fire against Water
    expect(surge(natal('Taurus'), allIn('Gemini')).harmonyOffset).toBe(-12) // Earth against Air
    expect(surge(natal('Gemini'), allIn('Taurus')).harmonyOffset).toBe(-12) // Air against Earth
    expect(surge(natal('Cancer'), allIn('Aries')).harmonyOffset).toBe(-12) // Water against Fire
  })

  it('scores sympathetic pairs +6 and neutral pairs 0', () => {
    expect(surge(natal('Aries'), allIn('Gemini')).harmonyOffset).toBe(6) // Fire–Air
    expect(surge(natal('Gemini'), allIn('Aries')).harmonyOffset).toBe(6) // Air–Fire
    expect(surge(natal('Taurus'), allIn('Cancer')).harmonyOffset).toBe(6) // Earth–Water
    expect(surge(natal('Cancer'), allIn('Taurus')).harmonyOffset).toBe(6) // Water–Earth
    expect(surge(natal('Aries'), allIn('Taurus')).harmonyOffset).toBe(0) // Fire–Earth
    expect(surge(natal('Taurus'), allIn('Aries')).harmonyOffset).toBe(0) // Earth–Fire
    expect(surge(natal('Gemini'), allIn('Cancer')).harmonyOffset).toBe(0) // Air–Water
    expect(surge(natal('Cancer'), allIn('Gemini')).harmonyOffset).toBe(0) // Water–Air
  })

  it('moves the meter by the offset and keeps the pure sky meter alongside', () => {
    const harmonious = surge(natal('Aries'), allIn('Leo'))
    expect(harmonious.skyMeter).toBe(50)
    expect(harmonious.meter).toBe(62)
    const clashing = surge(natal('Aries'), allIn('Pisces'))
    expect(clashing.meter).toBe(38)
    expect(clashing.skyMeter).toBe(50)
    const sympathetic = surge(natal('Aries'), allIn('Gemini'))
    expect(sympathetic.meter).toBe(56)
    const neutral = surge(natal('Aries'), allIn('Taurus'))
    expect(neutral.meter).toBe(50)
    expect(neutral.skyMeter).toBe(50)
  })

  it('clamps the adjusted meter to [0, 100] without touching the sky meter', () => {
    const high = surge(natal('Aries'), allIn('Leo'), { heat: 10, reactivity: 9.5 })
    expect(high.skyMeter).toBeCloseTo(97.5, 9)
    expect(high.meter).toBe(100)
    const low = surge(natal('Aries'), allIn('Pisces'), { heat: 0.5, reactivity: 0.5 })
    expect(low.skyMeter).toBeCloseTo(5, 9)
    expect(low.meter).toBe(0)
  })

  it('can tip a vessel into a surge the shared sky alone would not trigger', () => {
    const t = { heat: 8, reactivity: 5.4 } // sky meter 67
    const alone = surge(null, null, t)
    expect(alone.skyMeter).toBeCloseTo(67, 9)
    expect(alone.meter).toBe(67)
    expect(alone.active).toBe(false)
    expect(alone.statBoosts).toEqual({})

    const harmonious = surge(natal('Aries'), allIn('Leo'), t)
    expect(harmonious.skyMeter).toBeCloseTo(67, 9) // the shared sky is untouched …
    expect(harmonious.harmonyOffset).toBe(12)
    expect(harmonious.meter).toBe(79) // … the vessel's meter is not
    expect(harmonious.active).toBe(true)
    expect(harmonious.surgeType).toBe('inferno')
    expect(harmonious.statBoosts).toEqual(boostsFor(ARCH, INFERNO_OR_TEMPEST))
  })

  it('can pull a vessel out of a surge the shared sky alone would trigger', () => {
    const t = { heat: 10, reactivity: 5 } // sky meter 75: active on its own
    const alone = surge(null, null, t)
    expect(alone.active).toBe(true)
    expect(alone.statBoosts).toEqual(boostsFor(ARCH, INFERNO_OR_TEMPEST))

    const clashing = surge(natal('Aries'), allIn('Pisces'), t)
    expect(clashing.skyMeter).toBeCloseTo(75, 9)
    expect(clashing.harmonyOffset).toBe(-12)
    expect(clashing.meter).toBe(63)
    expect(clashing.active).toBe(false) // judged on the adjusted meter, not the sky's
    expect(clashing.statBoosts).toEqual({})
    expect(clashing.surgeType).toBe('inferno') // the building type still follows the ramp positions
  })

  it('lets the harmony-adjusted meter, not the sky meter, reach the equilibrium type', () => {
    const t = { heat: 8, reactivity: 5.4 }
    const dual = surge(natal('Aries'), allIn('Leo'), t, 1.618)
    expect(dual.surgeType).toBe('equilibrium')
    expect(dual.statBoosts).toEqual(boostsFor(ARCH, EQUILIBRIUM))
    const quiet = surge(null, null, t, 1.618)
    expect(quiet.surgeType).toBe('inferno') // 67 is below the threshold: no upgrade
    expect(quiet.statBoosts).toEqual({})
  })

  it('rounds the offset to the nearest hundredth, in both directions', () => {
    // Seven bodies are compared, so the harmony is k/7 and the offset is 12·k/7.
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
      const [natalChart, sky] = withRelation(matching, otherSign)
      return surge(natalChart, sky).harmonyOffset
    }
    expect(offsetOf(4, 'Leo')).toBe(6.86) // 12·4/7 = 6.857… (floor would give 6.85)
    expect(offsetOf(1, 'Leo')).toBe(1.71) // 12/7 = 1.714… (ceil would give 1.72)
    expect(offsetOf(4, 'Pisces')).toBe(-6.86) // −6.857… (ceil would give −6.85)
    expect(offsetOf(1, 'Pisces')).toBe(-1.71) // −1.714… (floor would give −1.72)
    expect(offsetOf(7, 'Leo')).toBe(12)
    expect(offsetOf(0, 'Leo')).toBe(0)

    // The rounded offset is what moves the meter.
    const [natalChart, sky] = withRelation(4, 'Leo')
    const moved = surge(natalChart, sky)
    expect(moved.skyMeter).toBe(50)
    expect(moved.meter).toBe(57) // 50 + 6.86 = 56.86
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
    for (const body of BODIES) {
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
    BODIES.forEach((body, i) => {
      planets[body] = { sign: 'Aries' }
      skyBodies[body] = { sign: i < 3 ? 'Leo' : 'Pisces' }
    })
    expect(elementalHarmony({ planets }, skyBodies)).toBeCloseTo(-0.4, 12)
    // Only the bodies present on both sides are averaged: three of the four here.
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
    expect(pure.meter).toBe(50)
    expect(pure.skyMeter).toBe(50)
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

// ─── What the surge hands the contract ───────────────────────────────────────
//
// `calculateResonanceSurge` computes the meter and the contract's `evaluateSurgeState` decides
// everything else, clamping the meter it is given to 0–100 as well. The result alone therefore
// cannot show whether THIS module clamps (the contract would hide it), nor which arguments it
// passes. This block wraps the contract's `evaluateSurgeState` in a recorder and reads the call:
// (meter, heat position, reactivity position, primary, secondary, monica).
describe('the arguments the surge hands the contract', () => {
  type SealsModule = typeof import('@/lib/agents/rating/seals-surge')
  type SurgeArgs = [number, number, number, string, string, number | null]

  afterEach(() => {
    vi.doUnmock('@/lib/agents/rating-contract')
    vi.resetModules()
  })

  const loadRecording = async (): Promise<{ mod: SealsModule; calls: SurgeArgs[] }> => {
    vi.resetModules()
    const calls: SurgeArgs[] = []
    vi.doMock('@/lib/agents/rating-contract', async importOriginal => {
      const actual = await importOriginal<typeof import('@/lib/agents/rating-contract')>()
      return {
        ...actual,
        evaluateSurgeState: (...args: Parameters<typeof actual.evaluateSurgeState>) => {
          calls.push(args as unknown as SurgeArgs)
          return actual.evaluateSurgeState(...args)
        },
      }
    })
    return { mod: await import('@/lib/agents/rating/seals-surge'), calls }
  }

  const allIn = (sign: string): Record<string, { sign: string }> =>
    Object.fromEntries(BODIES.map(b => [b, { sign }]))
  const natalIn = (sign: string): NatalChartInput => ({
    planets: allIn(sign),
    provenance: 'computed',
  })

  it('passes the six arguments in the contract’s order: meter, heat, reactivity, primary, secondary, monica', async () => {
    const { mod, calls } = await loadRecording()
    mod.calculateResonanceSurge(
      {
        thermodynamics: { heat: 4, reactivity: 6 },
        archetype: { primary: 'wisdom', secondary: 'vitality' },
        monica: 1.4,
      },
      UNIT
    )
    expect(calls).toHaveLength(1)
    const [meter, heat, reactivity, primary, secondary, monica] = calls[0]
    expect(meter).toBeCloseTo(50, 9) // 100 · (0.5 · 0.4 + 0.5 · 0.6)
    expect(heat).toBeCloseTo(0.4, 12) // a ramp position, not the raw 4
    expect(reactivity).toBeCloseTo(0.6, 12) // a ramp position, not the raw 6
    expect(primary).toBe('wisdom')
    expect(secondary).toBe('vitality')
    expect(monica).toBe(1.4)
  })

  it('passes an absent Monica to the contract as null — never undefined, never zero', async () => {
    const { mod, calls } = await loadRecording()
    const thermodynamics = { heat: 5, reactivity: 5 }
    mod.calculateResonanceSurge({ thermodynamics, archetype: ARCH }, UNIT)
    mod.calculateResonanceSurge({ thermodynamics, archetype: ARCH, monica: undefined }, UNIT)
    mod.calculateResonanceSurge({ thermodynamics, archetype: ARCH, monica: null }, UNIT)
    mod.calculateResonanceSurge({ thermodynamics, archetype: ARCH, monica: 0 }, UNIT)
    expect(calls.map(call => call[5])).toEqual([null, null, null, 0])
  })

  it('hands the contract the harmony-adjusted meter, not the shared-sky meter', async () => {
    const { mod, calls } = await loadRecording()
    mod.calculateResonanceSurge(
      {
        thermodynamics: { heat: 5, reactivity: 5 },
        archetype: ARCH,
        natalChart: natalIn('Aries'),
        sky: allIn('Leo'),
      },
      UNIT
    )
    expect(calls[0][0]).toBeCloseTo(62, 9) // 50 + 12
  })

  it('clamps the meter to 0–100 itself, before the contract sees it', async () => {
    const { mod, calls } = await loadRecording()
    const surge = (heat: number, reactivity: number, natal: string, sky: string) =>
      mod.calculateResonanceSurge(
        {
          thermodynamics: { heat, reactivity },
          archetype: ARCH,
          natalChart: natalIn(natal),
          sky: allIn(sky),
        },
        UNIT
      )
    // Sky meter 5, offset −12: an unclamped meter would be −7.
    surge(0.5, 0.5, 'Aries', 'Pisces')
    // Sky meter 97.5, offset +12: an unclamped meter would be 109.5.
    surge(10, 9.5, 'Aries', 'Leo')
    // Inside the range nothing is moved: 50 − 12 and 50 + 12.
    surge(5, 5, 'Aries', 'Pisces')
    surge(5, 5, 'Aries', 'Leo')
    expect(calls.map(call => call[0])).toEqual([0, 100, 38, 62])
  })
})
