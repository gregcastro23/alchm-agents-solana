/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import {
  BALANCED_SPREAD,
  BALANCED_TITLE,
  CORE_STAT_KEYS,
  RATING_CEILING,
  RATING_FLOOR,
  archetypeTitle,
  rateAgent,
  rateStats,
  toRating,
  type CoreStatKey,
  type CoreStats,
} from '@/lib/agents/rating/ovr-archetype'

const stats = (overrides: Partial<CoreStats> = {}, base = 50): CoreStats => ({
  power: base,
  resonance: base,
  wisdom: base,
  charisma: base,
  intuition: base,
  adaptability: base,
  vitality: base,
  ...overrides,
})

describe('toRating', () => {
  it('maps 0 → floor, 100 → ceiling, 50 → 62', () => {
    expect(toRating(0)).toBe(RATING_FLOOR)
    expect(toRating(100)).toBe(RATING_CEILING)
    expect(toRating(50)).toBe(62)
  })

  it('clamps finite out-of-range input', () => {
    expect(toRating(-40)).toBe(RATING_FLOOR)
    expect(toRating(250)).toBe(RATING_CEILING)
  })

  it('throws on non-finite input and names the stat, rather than rating it as the floor', () => {
    expect(() => toRating(NaN, 'power')).toThrow(/power/)
    expect(() => toRating(Infinity)).toThrow(RangeError)
  })
})

describe('rateStats', () => {
  it('rates a flat build as a balanced adept at 62', () => {
    const r = rateStats(stats())
    expect(r.ovr).toBe(62)
    expect(r.spread).toBe(0)
    expect(r.archetype.kind).toBe('balanced')
    expect(r.archetype.title).toBe(BALANCED_TITLE)
  })

  it('matches a hand-computed specialist', () => {
    // ratings: power 92, wisdom 77, resonance 55, the other four 62.
    // (92·1.6 + 77·1.3 + 62·4 + 55) / (1.6 + 1.3 + 5) = 550.3 / 7.9 = 69.66 → 70
    const r = rateStats(stats({ power: 90, resonance: 40, wisdom: 70 }))
    expect(r.ratings).toMatchObject({ power: 92, wisdom: 77, resonance: 55, charisma: 62 })
    expect(r.ovr).toBe(70)
    expect(r.spread).toBe(37)
    expect(r.archetype).toEqual({
      kind: 'specialist',
      primary: 'power',
      secondary: 'wisdom',
      title: 'Hermetic Vanguard',
    })
  })

  it('rates a specialist above a generalist with the same total', () => {
    const generalist = rateStats(stats({}, 60)) // sum 420
    const specialist = rateStats(stats({ power: 90 }, 55)) // sum 420
    expect(specialist.ovr).toBeGreaterThan(generalist.ovr)
  })

  it('breaks ties by canonical stat order, independent of input key order', () => {
    const a = rateStats(stats({ vitality: 80, wisdom: 80 }))
    expect(a.archetype.primary).toBe('wisdom')
    expect(a.archetype.secondary).toBe('vitality')

    const reversed = Object.fromEntries(
      [...Object.entries(stats({ vitality: 80, wisdom: 80 }))].reverse()
    ) as CoreStats
    expect(rateStats(reversed)).toEqual(a)
  })

  it('keeps the top two named even for a balanced build', () => {
    const r = rateStats(stats({ intuition: 50 + BALANCED_SPREAD / 2 }))
    expect(r.spread).toBeLessThan(BALANCED_SPREAD)
    expect(r.archetype.kind).toBe('balanced')
    expect(r.archetype.primary).toBe('intuition')
  })

  it('treats a spread of exactly BALANCED_SPREAD as a specialist', () => {
    // 50 → 62; 58 → 25 + 0.58·74 = 67.92 → 68; spread 6.
    const r = rateStats(stats({ charisma: 58 }))
    expect(r.spread).toBe(BALANCED_SPREAD)
    expect(r.archetype.kind).toBe('specialist')
  })

  it('refuses to rate a build containing a non-finite stat', () => {
    expect(() => rateStats(stats({ wisdom: NaN }))).toThrow(/wisdom/)
  })
})

describe('archetype titles', () => {
  it('yields 42 distinct titles for the 42 ordered pairs, none equal to the balanced title', () => {
    const titles = new Set<string>()
    for (const p of CORE_STAT_KEYS) {
      for (const s of CORE_STAT_KEYS) {
        if (p !== s) titles.add(archetypeTitle(p, s))
      }
    }
    expect(titles.size).toBe(42)
    expect(titles.has(BALANCED_TITLE)).toBe(false)
  })
})

describe('OVR invariants (seeded property check)', () => {
  // Small deterministic LCG so a failure reproduces.
  let seed = 0x2f6e2b1
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  const randomStats = (): CoreStats => {
    const s = {} as Record<CoreStatKey, number>
    for (const k of CORE_STAT_KEYS) s[k] = Math.round(rand() * 100)
    return s
  }

  it('is bounded by the worst and best rating, and never below the plain mean', () => {
    for (let i = 0; i < 500; i++) {
      const r = rateStats(randomStats())
      const values = Object.values(r.ratings)
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      expect(r.ovr).toBeGreaterThanOrEqual(Math.min(...values))
      expect(r.ovr).toBeLessThanOrEqual(Math.max(...values))
      expect(r.ovr).toBeGreaterThanOrEqual(Math.round(mean))
    }
  })

  it('is monotone: raising any one stat never lowers OVR', () => {
    for (let i = 0; i < 500; i++) {
      const base = randomStats()
      const before = rateStats(base).ovr
      for (const k of CORE_STAT_KEYS) {
        const after = rateStats({ ...base, [k]: Math.min(100, base[k] + 1) }).ovr
        expect(after, `${k}: ${JSON.stringify(base)}`).toBeGreaterThanOrEqual(before)
      }
    }
  })
})

describe('historical roster', () => {
  const ratings = HISTORICAL_AGENTS.map(agent => ({ id: agent.id, ...rateAgent(agent) }))

  it('rates every agent finitely, inside the rating scale', () => {
    expect(ratings.length).toBeGreaterThan(0)
    for (const r of ratings) {
      expect(r.ovr, r.id).toBeGreaterThanOrEqual(RATING_FLOOR)
      expect(r.ovr, r.id).toBeLessThanOrEqual(RATING_CEILING)
    }
  })

  it('is deterministic', () => {
    for (const agent of HISTORICAL_AGENTS.slice(0, 10)) {
      expect(rateAgent(agent)).toEqual(rateAgent(agent))
    }
  })

  it('does not collapse the roster into a handful of builds (ratchet — raise as this improves)', () => {
    // KNOWN SKEW: `deriveStatsFromChart` gives `power` a ×25 Monica coefficient
    // against ×5–10 for the rest, so roster-mean power (≈76) sits ~8 points above
    // every other stat (≈65–70) and ~70% of agents rate as "… Vanguard". Measured
    // when this spec was written: 17 distinct titles of a possible 42. Ranking
    // against roster-relative baselines would give ~26. This floor guards against
    // getting worse; raise it when the derivation or the ranking is rebalanced.
    const distinct = new Set(ratings.map(r => r.archetype.title))
    expect(distinct.size).toBeGreaterThanOrEqual(15)
  })
})
