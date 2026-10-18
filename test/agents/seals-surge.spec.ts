/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import {
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
  type EsmsHoldings,
  type NatalChartInput,
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
      expect(r.tier).toBe('Aether')
      expect(r.natalAffinity).toBeNull()
      expect(r.nextTier).toBe('Celestial')
      // Crucible Finisher's league mean sits so far above the others that even a perfect
      // power stat aligns to 93.5 — short of Celestial's 96 — so it is blocked on the stat too.
      expect(r.blockedBy).toEqual(r.stat === 'power' ? ['stat', 'natal'] : ['natal'])
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

  it('is inactive just below the threshold and boosts nothing', () => {
    const s = run(10, 3) // 50 + 15 = 65
    expect(s.meter).toBe(65)
    expect(SURGE_ACTIVE_AT).toBeGreaterThan(65)
    expect(s.active).toBe(false)
    expect(s.statBoosts).toEqual({})
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

  it('keeps `active` exactly equal to `meter >= SURGE_ACTIVE_AT`', () => {
    for (let h = 0; h <= 10; h += 0.5) {
      for (let r = 0; r <= 10; r += 0.5) {
        const s = run(h, r)
        expect(s.active, `heat ${h} reactivity ${r}`).toBe(s.meter >= SURGE_ACTIVE_AT)
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
    const t = { heat: 8, reactivity: 5.5 } // sky meter 67.5
    expect(surge(null, null, t).active).toBe(false)
    const harmonious = surge(natal('Aries'), allIn('Leo'), t)
    expect(harmonious.active).toBe(true)
    expect(harmonious.surgeType).toBe('inferno')
    expect(Object.keys(harmonious.statBoosts).sort()).toEqual(['charisma', 'resonance'])
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
