/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import {
  BALANCED_SPREAD,
  BALANCED_TITLE,
  CORE_STAT_KEYS,
  RATING_CEILING,
  RATING_FLOOR,
  STAT_BASELINES,
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
    // (90 − 76.5) / 8.8 = 1.53 and (70 − 68.4) / 5.8 = 0.28 league standard deviations.
    expect(r.relativeAdvantage.power).toBe(1.53)
    expect(r.relativeAdvantage.wisdom).toBe(0.28)
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

  it('names the title from league-relative advantage, not the tallest bar', () => {
    // power is the tallest bar (84 vs 83), but intuition sits further above its own
    // league average (+1.04σ vs +0.40σ) — so intuition leads the title.
    const r = rateStats(stats({ power: 80, intuition: 78 }, 60))
    expect(r.ratings.power).toBeGreaterThan(r.ratings.intuition)
    expect(r.relativeAdvantage.intuition).toBeGreaterThan(r.relativeAdvantage.power)
    expect(r.archetype).toEqual({
      kind: 'specialist',
      primary: 'intuition',
      secondary: 'power',
      title: 'Sovereign Seer',
    })
  })

  it('breaks ties by canonical stat order, independent of input key order', () => {
    // Every stat exactly at its league mean → zero advantage everywhere → a pure tie.
    const atMean = Object.fromEntries(
      CORE_STAT_KEYS.map(k => [k, STAT_BASELINES[k].mean])
    ) as CoreStats
    const a = rateStats(atMean)
    expect(Object.values(a.relativeAdvantage).every(v => v === 0)).toBe(true)
    expect(a.archetype.primary).toBe('power')
    expect(a.archetype.secondary).toBe('resonance')

    const reversed = Object.fromEntries([...Object.entries(atMean)].reverse()) as CoreStats
    expect(rateStats(reversed)).toEqual(a)
  })

  it('names the two largest relative advantages even for a balanced build', () => {
    const r = rateStats(stats({ intuition: 50 + BALANCED_SPREAD / 2 }))
    expect(r.spread).toBeLessThan(BALANCED_SPREAD)
    expect(r.archetype.kind).toBe('balanced')
    expect(r.archetype.title).toBe(BALANCED_TITLE)

    const { primary, secondary } = r.archetype
    const adv = r.relativeAdvantage
    for (const key of CORE_STAT_KEYS) {
      expect(adv[primary]).toBeGreaterThanOrEqual(adv[key])
      if (key !== primary) expect(adv[secondary]).toBeGreaterThanOrEqual(adv[key])
    }
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

  it('keeps STAT_BASELINES calibrated to the roster', () => {
    const natal = HISTORICAL_AGENTS.map(agent => deriveSacredStats(agent))
    for (const key of CORE_STAT_KEYS) {
      const xs = natal.map(s => s[key])
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
      const pinned = STAT_BASELINES[key]
      const hint =
        `${key}: pinned { mean: ${pinned.mean}, sd: ${pinned.sd} } but the roster now measures ` +
        `{ mean: ${mean.toFixed(1)}, sd: ${sd.toFixed(1)} } — re-pin STAT_BASELINES`
      expect(Math.abs(mean - pinned.mean), hint).toBeLessThanOrEqual(1)
      expect(Math.abs(sd - pinned.sd), hint).toBeLessThanOrEqual(1)
    }
  })

  it('spreads titles and primaries across the roster (ratchet — raise as this improves)', () => {
    // `deriveStatsFromChart` gives `power` a ×25 Monica coefficient against ×5–10 for the
    // rest, so naming by raw height made ~70% of the roster a "… Vanguard" (17 of 42
    // titles). Naming by league-relative advantage measured 26 distinct titles and no
    // primary stat above 28% of the roster when this spec was written.
    const distinct = new Set(ratings.map(r => r.archetype.title))
    expect(distinct.size).toBeGreaterThanOrEqual(22)

    const primaryCounts = new Map<string, number>()
    for (const r of ratings) {
      primaryCounts.set(r.archetype.primary, (primaryCounts.get(r.archetype.primary) ?? 0) + 1)
    }
    expect(Math.max(...primaryCounts.values()) / ratings.length).toBeLessThanOrEqual(0.4)
  })
})
