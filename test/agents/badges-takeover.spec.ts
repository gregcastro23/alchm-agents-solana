/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import {
  BADGE_CATALOG,
  BADGE_TIERS,
  BADGE_TIER_REQUIREMENTS,
  CELESTIAL_MIN_NATAL_AFFINITY,
  DEFAULT_TAKEOVER_CALIBRATION,
  MAX_TAKEOVER_BOOST,
  TAKEOVER_ACTIVE_AT,
  applyStatBoosts,
  calculateTakeover,
  earnedBadges,
  evaluateBadges,
  natalAffinity,
  type EsmsHoldings,
  type NatalChartInput,
  type TakeoverCalibration,
} from '@/lib/agents/rating/badges-takeover'
import { CORE_STAT_KEYS, type CoreStats } from '@/lib/agents/rating/ovr-archetype'
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

const byId = (results: ReturnType<typeof evaluateBadges>, id: string) => {
  const found = results.find(r => r.id === id)
  if (!found) throw new Error(`no badge ${id}`)
  return found
}
const tierIndex = (tier: (typeof BADGE_TIERS)[number] | null) =>
  tier === null ? -1 : BADGE_TIERS.indexOf(tier)

describe('badge catalog', () => {
  it('has unique ids and carries the four specified badges', () => {
    expect(new Set(BADGE_CATALOG.map(b => b.id)).size).toBe(BADGE_CATALOG.length)
    const named = Object.fromEntries(BADGE_CATALOG.map(b => [b.name, `${b.token}+${b.stat}`]))
    expect(named).toMatchObject({
      'Astral Vision': 'spirit+intuition',
      'Immovable Foundation': 'matter+vitality',
      'Harmonic Floor General': 'essence+charisma',
      'Crucible Finisher': 'substance+power',
    })
  })

  it('gives every Sacred 7 stat and every ESMS token at least one badge', () => {
    expect(new Set(BADGE_CATALOG.map(b => b.stat))).toEqual(new Set(CORE_STAT_KEYS))
    expect(new Set(BADGE_CATALOG.map(b => b.token)).size).toBe(4)
  })

  it('keeps tier requirements strictly increasing on both gates', () => {
    for (let i = 1; i < BADGE_TIERS.length; i++) {
      const lower = BADGE_TIER_REQUIREMENTS[BADGE_TIERS[i - 1]]
      const higher = BADGE_TIER_REQUIREMENTS[BADGE_TIERS[i]]
      expect(higher.minRating).toBeGreaterThan(lower.minRating)
      expect(higher.minBalance).toBeGreaterThan(lower.minBalance)
    }
  })
})

describe('evaluateBadges', () => {
  it('earns nothing with empty holdings, however strong the stats', () => {
    const results = evaluateBadges({ stats: stats(100), esmsBalances: holdings(0) })
    expect(results).toHaveLength(BADGE_CATALOG.length)
    for (const r of results) {
      expect(r.tier).toBeNull()
      expect(r.nextTier).toBe('Bronze')
      expect(r.blockedBy).toEqual(['esms'])
    }
    expect(earnedBadges(results)).toEqual([])
  })

  it('takes the lower of the stat gate and the balance gate', () => {
    // intuition 97 → rating 97 clears everything on the stat side; 12 Spirit clears Gold only.
    const balanceLimited = byId(
      evaluateBadges({
        stats: stats(50, { intuition: 97 }),
        esmsBalances: holdings(0, { spirit: 12 }),
      }),
      'astral-vision'
    )
    expect(balanceLimited.tier).toBe('Gold')
    expect(balanceLimited.nextTier).toBe('Hall of Fame')
    expect(balanceLimited.blockedBy).toEqual(['esms'])

    // intuition 74 → rating 80 clears Silver; 1000 Spirit clears every balance gate.
    const statLimited = byId(
      evaluateBadges({ stats: stats(50, { intuition: 74 }), esmsBalances: holdings(1000) }),
      'astral-vision'
    )
    expect(statLimited.statRating).toBe(80)
    expect(statLimited.tier).toBe('Silver')
    expect(statLimited.blockedBy).toEqual(['stat'])
  })

  it('caps at Hall of Fame without a natal chart, and says why', () => {
    const results = evaluateBadges({ stats: stats(100), esmsBalances: holdings(1000) })
    for (const r of results) {
      expect(r.tier).toBe('Hall of Fame')
      expect(r.natalAffinity).toBeNull()
      expect(r.nextTier).toBe('Celestial')
      expect(r.blockedBy).toEqual(['natal'])
    }
  })

  it('unlocks Celestial only where the chart has enough bodies in the token’s element', () => {
    const results = evaluateBadges({
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
    expect(byId(results, 'immovable-foundation').tier).toBe('Hall of Fame')
    expect(byId(results, 'harmonic-floor-general').natalAffinity).toBe(2)
    expect(byId(results, 'crucible-finisher').natalAffinity).toBe(1)
  })

  it('does not let a placeholder or unattributed chart unlock Celestial', () => {
    for (const provenance of ['placeholder', 'unattributed'] as const) {
      const results = evaluateBadges({
        stats: stats(100),
        esmsBalances: holdings(1000),
        natalChart: chart(provenance),
      })
      expect(byId(results, 'astral-vision').natalAffinity, provenance).toBeNull()
      expect(byId(results, 'astral-vision').tier, provenance).toBe('Hall of Fame')
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
      evaluateBadges({ stats: stats(50, { power: NaN }), esmsBalances: holdings(1) })
    ).toThrow(/power/)
    expect(() =>
      evaluateBadges({ stats: stats(50), esmsBalances: holdings(1, { matter: -1 }) })
    ).toThrow(/matter/)
    expect(() =>
      evaluateBadges({ stats: stats(50), esmsBalances: holdings(1, { spirit: NaN }) })
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
      const before = evaluateBadges({ stats: s, esmsBalances: h, natalChart })

      for (const k of CORE_STAT_KEYS) {
        const after = evaluateBadges({
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
        const after = evaluateBadges({
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

describe('badges across the historical roster', () => {
  it('gives a pyramid, not a flat field, when holdings are not the constraint', () => {
    const tiers = HISTORICAL_AGENTS.flatMap(agent =>
      evaluateBadges({ stats: deriveSacredStats(agent), esmsBalances: holdings(1000) }).map(r =>
        tierIndex(r.tier)
      )
    )
    const share = (atLeast: number) => tiers.filter(t => t >= atLeast).length / tiers.length
    // Measured when written: Bronze+ 0.66, Silver+ 0.29, Gold+ 0.06, Hall of Fame+ 0.01.
    expect(share(0)).toBeGreaterThan(0.5)
    expect(share(0)).toBeLessThan(0.85)
    expect(share(1)).toBeGreaterThan(0.15)
    expect(share(1)).toBeLessThan(0.45)
    expect(share(2)).toBeLessThan(0.12)
    expect(share(3)).toBeLessThan(0.03)
    // No chart, so Celestial is out of reach — and natal stats alone never get near it.
    expect(share(4)).toBe(0)
  })

  it('caps an agent’s own alchemical elements at Bronze (the off-chain baseline)', () => {
    const preview = HISTORICAL_AGENTS.filter(a => a.consciousness.alchemicalElements)
    expect(preview.length).toBeGreaterThan(0)
    for (const agent of preview) {
      const { spirit, essence, matter, substance } = agent.consciousness.alchemicalElements!
      const results = evaluateBadges({
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

describe('calculateTakeover', () => {
  // A unit calibration keeps the arithmetic exact: heat 5 of 10 is 0.5.
  const unit: TakeoverCalibration = {
    heat: { low: 0, high: 10 },
    reactivity: { low: 0, high: 10 },
  }
  const run = (heat: number, reactivity: number, calibration = unit) =>
    calculateTakeover({ thermodynamics: { heat, reactivity } }, calibration)

  it('reads 0 at the low anchors and 100 at the high anchors', () => {
    const { heat, reactivity } = DEFAULT_TAKEOVER_CALIBRATION
    const calm = calculateTakeover({
      thermodynamics: { heat: heat.low, reactivity: reactivity.low },
    })
    expect(calm).toMatchObject({ meter: 0, active: false, statBoosts: {} })

    const storm = calculateTakeover({
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
    expect(TAKEOVER_ACTIVE_AT).toBeGreaterThan(65)
    expect(s.active).toBe(false)
    expect(s.statBoosts).toEqual({})
  })

  it('boosts the heat-linked stats when heat leads', () => {
    const s = run(10, 5) // meter 75 → round(10 · 0.75) = 8
    expect(s.meter).toBe(75)
    expect(s.active).toBe(true)
    expect(s.takeoverType).toBe('inferno')
    expect(s.statBoosts).toEqual({ resonance: 8, charisma: 8 })
  })

  it('boosts the reactivity-linked stats when reactivity leads', () => {
    const s = run(5, 10)
    expect(s.takeoverType).toBe('tempest')
    expect(s.statBoosts).toEqual({ intuition: 8, adaptability: 8 })
  })

  it('breaks an exact heat/reactivity tie toward inferno, and caps boosts at the maximum', () => {
    expect(run(0, 0).takeoverType).toBe('inferno')
    const full = run(10, 10)
    expect(full.statBoosts).toEqual({ resonance: MAX_TAKEOVER_BOOST, charisma: MAX_TAKEOVER_BOOST })
  })

  it('keeps `active` exactly equal to `meter >= TAKEOVER_ACTIVE_AT`', () => {
    for (let h = 0; h <= 10; h += 0.5) {
      for (let r = 0; r <= 10; r += 0.5) {
        const s = run(h, r)
        expect(s.active, `heat ${h} reactivity ${r}`).toBe(s.meter >= TAKEOVER_ACTIVE_AT)
        expect(Object.keys(s.statBoosts).length > 0).toBe(s.active)
      }
    }
  })

  it('never moves with Monica, and treats ABSENT (null) like any other value', () => {
    const thermodynamics = { heat: 0.05, reactivity: 2.1 }
    const baseline = calculateTakeover({ thermodynamics })
    for (const monica of [null, undefined, MONICA_EQUILIBRIUM, -3.2, 0, 1e9]) {
      expect(calculateTakeover({ thermodynamics, monica }), String(monica)).toEqual(baseline)
    }
    expect(() => calculateTakeover({ thermodynamics, monica: Number.NaN })).toThrow(/Monica/)
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
    const withPresent = calculateTakeover({ thermodynamics, monica: present })
    const withAbsent = calculateTakeover({ thermodynamics, monica: absent })
    expect(withAbsent).toEqual(withPresent)
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
      const before = calculateTakeover({ thermodynamics: { heat, reactivity } })
      for (const next of [
        { heat: heat * 1.1 + 0.001, reactivity },
        { heat, reactivity: reactivity * 1.1 + 0.01 },
      ]) {
        const after = calculateTakeover({ thermodynamics: next })
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

  it('composes with calculateTakeover', () => {
    const state = calculateTakeover(
      { thermodynamics: { heat: 10, reactivity: 10 } },
      { heat: { low: 0, high: 10 }, reactivity: { low: 0, high: 10 } }
    )
    const boosted = applyStatBoosts(stats(60), state.statBoosts)
    expect(boosted.resonance).toBe(60 + MAX_TAKEOVER_BOOST)
    expect(boosted.charisma).toBe(60 + MAX_TAKEOVER_BOOST)
    expect(boosted.power).toBe(60)
  })
})
