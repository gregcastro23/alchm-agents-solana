import { describe, expect, it } from 'vitest'
import {
  ALL_VESSEL_STAT_KEYS,
  MAX_SKY_AGE_MS,
  computeAmbientAlchemicalTide,
  computeDyadicChordGain,
  computeVesselGrowth,
  computeVesselProgression,
  type VesselProgressionInput,
  type VesselStats,
} from '../../lib/vessel/progression'

const PLANETS = [
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
  'Chiron',
]
const SACRED = ['power', 'resonance', 'wisdom', 'charisma', 'intuition', 'adaptability', 'vitality']
const NOW = Date.parse('2026-10-20T12:00:00Z')
const positions = (longitude: number) =>
  Object.fromEntries(PLANETS.map(planet => [planet, { longitude }]))

// Synthetic geometry deliberately isolates game rules; these are not real charts.
function input(): VesselProgressionInput {
  return {
    stats: Object.fromEntries(
      ALL_VESSEL_STAT_KEYS.map(key => [key, SACRED.includes(key) ? 62 : 50])
    ) as VesselStats,
    totalXp: 10_000,
    natal: { provenance: 'computed', positions: positions(0) },
    sky: { asOf: new Date(NOW).toISOString(), source: 'swiss-ephemeris', positions: positions(0) },
    character: { primary: 'wisdom', secondary: 'intuition' },
    now: NOW,
  }
}

describe('Vessel progression reference rules', () => {
  it('can report permanent growth independently of unavailable charts and stats', () => {
    expect(computeVesselGrowth(40_000)).toEqual({
      level: 21,
      totalXp: 40_000,
      xpToNextLevel: 4_100,
      levelBoost: (12 * 20) / 99,
    })
    expect(() => computeVesselGrowth(-1)).toThrow(RangeError)
  })

  it('uses every Sacred and Planetary stat without rounding away small improvements', () => {
    const original = input()
    const baseline = computeVesselProgression(original)
    expect(ALL_VESSEL_STAT_KEYS).toHaveLength(19)
    for (const key of ALL_VESSEL_STAT_KEYS) {
      const changed = input()
      changed.stats[key] += 0.001
      const result = computeVesselProgression(changed)
      expect(result.baseOverall).toBeGreaterThan(baseline.baseOverall)
      expect(result.trainedOverall).toBeGreaterThan(baseline.trainedOverall)
      expect(result.currentOverall!).toBeGreaterThan(baseline.currentOverall!)
    }
  })

  it('uses normalized Sacred and Planetary scales with equal family weight', () => {
    const low = input()
    for (const key of ALL_VESSEL_STAT_KEYS) low.stats[key] = SACRED.includes(key) ? 25 : 0
    expect(computeVesselProgression(low).baseOverall).toBe(25)
    for (const key of SACRED) low.stats[key as keyof VesselStats] = 99
    expect(computeVesselProgression(low).baseOverall).toBe(62)
    for (const key of ALL_VESSEL_STAT_KEYS) low.stats[key] = SACRED.includes(key) ? 99 : 100
    expect(computeVesselProgression(low).baseOverall).toBe(99)
  })

  it('adds permanent Vessel Level growth to the trained baseline', () => {
    const fresh = input()
    fresh.totalXp = 0
    const grown = input()
    grown.totalXp = 40_000
    const before = computeVesselProgression(fresh)
    const after = computeVesselProgression(grown)
    expect(before.level).toBe(1)
    expect(after.level).toBe(21)
    expect(after.baseOverall).toBe(before.baseOverall)
    expect(after.trainedOverall).toBeGreaterThan(before.trainedOverall)
    expect(after.currentOverall!).toBeGreaterThan(before.currentOverall!)
  })

  it('honors XP thresholds and keeps accumulating XP after the level cap', () => {
    for (const [xp, level, remaining] of [
      [0, 1, 100],
      [99, 1, 1],
      [100, 2, 300],
      [400, 3, 500],
      [980_099, 99, 1],
    ]) {
      const fixture = input()
      fixture.totalXp = xp
      const result = computeVesselProgression(fixture)
      expect(result.level).toBe(level)
      expect(result.xpToNextLevel).toBe(remaining)
    }
    for (const xp of [980_100, 1_500_000, Number.MAX_SAFE_INTEGER]) {
      const fixture = input()
      fixture.totalXp = xp
      const result = computeVesselProgression(fixture)
      expect(result.level).toBe(100)
      expect(result.totalXp).toBe(xp)
      expect(result.xpToNextLevel).toBeNull()
      expect(result.trainedOverall - result.baseOverall).toBeCloseTo(12)
    }
  })

  it('moves Current Overall both above and below baseline without changing earned growth', () => {
    const favorable = input()
    const difficult = input()
    difficult.sky!.positions = positions(180)
    const up = computeVesselProgression(favorable)
    const down = computeVesselProgression(difficult)
    expect(up.currentOverall!).toBeGreaterThan(up.trainedOverall)
    expect(down.currentOverall!).toBeLessThan(down.trainedOverall)
    expect(up.currentOverall! - up.trainedOverall).toBeLessThanOrEqual(15 + 1e-9)
    expect(down.trainedOverall - down.currentOverall!).toBeLessThanOrEqual(15 + 1e-9)
    for (const key of [
      'level',
      'totalXp',
      'xpToNextLevel',
      'baseOverall',
      'trainedOverall',
    ] as const) {
      expect(down[key]).toBe(up[key])
    }
  })

  it('gives different natal DNA different responses to the exact same sky', () => {
    const first = input()
    const second = input()
    second.natal.positions = positions(180)
    const aligned = computeVesselProgression(first)
    const opposed = computeVesselProgression(second)
    expect(aligned.currentOverall!).toBeGreaterThan(aligned.trainedOverall)
    expect(opposed.currentOverall!).toBeLessThan(opposed.trainedOverall)
    expect(opposed.level).toBe(aligned.level)
  })

  it('allows every transiting planet to affect a different natal body', () => {
    for (const planet of PLANETS) {
      const favorableLon = planet === 'Saturn' ? 180 : 0
      const favorable = input()
      favorable.natal.positions = { Sun: { longitude: favorableLon } }
      favorable.sky!.positions = { [planet]: { longitude: favorableLon } }
      const difficult = structuredClone(favorable)
      difficult.sky!.positions[planet].longitude = (favorableLon + 180) % 360
      const up = computeVesselProgression(favorable)
      const down = computeVesselProgression(difficult)
      expect(up.statDeltas.solarAgency).toBeGreaterThan(0)
      expect(down.statDeltas.solarAgency).toBeLessThan(0)
      expect(up.status).toBe('estimated')
    }
  })

  it('changes a natal Sun stat when transiting Mars moves, even with the current Sun held fixed', () => {
    const first = input()
    first.natal.positions = positions(45)
    first.natal.positions.Sun.longitude = 0
    first.sky!.positions = positions(45)
    first.sky!.positions.Mars.longitude = 0
    const second = structuredClone(first)
    second.sky!.positions.Mars.longitude = 180
    expect(computeVesselProgression(first).statDeltas.solarAgency).toBeGreaterThan(0)
    expect(computeVesselProgression(second).statDeltas.solarAgency).toBeLessThan(0)
  })

  it('uses character affinities to shape the response', () => {
    const intuitive = input()
    intuitive.character = { primary: 'intuition', secondary: 'resonance' }
    const forceful = input()
    forceful.character = { primary: 'power', secondary: 'vitality' }
    const first = computeVesselProgression(intuitive)
    const second = computeVesselProgression(forceful)
    expect(first.statDeltas.lunarReceptivity).toBeGreaterThan(second.statDeltas.lunarReceptivity)
    expect(second.statDeltas.martialImpetus).toBeGreaterThan(first.statDeltas.martialImpetus)
  })

  it('requires all ten main planets on both sides for live status, with optional Chiron', () => {
    const complete = input()
    delete complete.natal.positions.Chiron
    delete complete.sky!.positions.Chiron
    expect(computeVesselProgression(complete).status).toBe('live')
    const missingSky = structuredClone(complete)
    delete missingSky.sky!.positions.Neptune
    const skyResult = computeVesselProgression(missingSky)
    expect(skyResult.status).toBe('estimated')
    expect(skyResult.reasons.join(' ')).toContain('Sky snapshot coverage unavailable for Neptune')
    const missingNatal = structuredClone(complete)
    delete missingNatal.natal.positions.Pluto
    const natalResult = computeVesselProgression(missingNatal)
    expect(natalResult.status).toBe('estimated')
    expect(natalResult.reasons.join(' ')).toContain('Natal chart coverage unavailable for Pluto')
  })

  it('does not amplify remaining measurements when a positive sky contribution is missing', () => {
    const full = input()
    const partial = input()
    delete partial.sky!.positions.Venus
    const fullResult = computeVesselProgression(full)
    const partialResult = computeVesselProgression(partial)
    expect(partialResult.status).toBe('estimated')
    expect(partialResult.currentOverall!).toBeGreaterThan(partialResult.trainedOverall)
    expect(partialResult.currentOverall!).toBeLessThan(fullResult.currentOverall!)
    expect(partialResult.statDeltas.solarAgency).toBeLessThan(fullResult.statDeltas.solarAgency)
  })

  it('marks authored DNA and approximate sky as estimated', () => {
    const authored = input()
    authored.natal.provenance = 'authored'
    expect(computeVesselProgression(authored).status).toBe('estimated')
    const approximate = input()
    approximate.sky!.source = 'vsop87-approximation'
    expect(computeVesselProgression(approximate).status).toBe('estimated')
  })

  it('returns no invented Current Overall for missing, stale, or unattributed sources', () => {
    const invalid: VesselProgressionInput[] = []
    const missing = input()
    missing.sky = null
    invalid.push(missing)
    const stale = input()
    stale.sky!.asOf = new Date(NOW - MAX_SKY_AGE_MS - 1).toISOString()
    invalid.push(stale)
    const future = input()
    future.sky!.asOf = new Date(NOW + 60_001).toISOString()
    invalid.push(future)
    const unverified = input()
    unverified.sky!.source = 'unverified'
    invalid.push(unverified)
    const placeholder = input()
    placeholder.natal.provenance = 'placeholder'
    invalid.push(placeholder)
    const empty = input()
    empty.natal.positions = {}
    invalid.push(empty)
    for (const fixture of invalid) {
      const result = computeVesselProgression(fixture)
      expect(result.status).toBe('unavailable')
      expect(result.currentOverall).toBeNull()
      expect(result.reasons.length).toBeGreaterThan(0)
      expect(Object.values(result.statDeltas).every(delta => delta === 0)).toBe(true)
      expect(result.level).toBe(11)
      expect(result.totalXp).toBe(10_000)
    }
  })

  it('normalizes wrapped angles and accepts case-insensitive planet names', () => {
    const first = input()
    first.sky!.positions = positions(359)
    const second = input()
    second.sky!.positions = Object.fromEntries(
      PLANETS.map(planet => [planet.toLowerCase(), { longitude: -1 }])
    )
    expect(computeVesselProgression(second)).toEqual(computeVesselProgression(first))
    const third = input()
    third.sky!.positions = positions(719)
    expect(computeVesselProgression(third).currentOverall).toBe(
      computeVesselProgression(first).currentOverall
    )
  })

  it('tapers continuously to neutral at the aspect orb boundary', () => {
    const near = input()
    near.sky!.positions = positions(7.99999)
    const edge = input()
    edge.sky!.positions = positions(8)
    const outside = input()
    outside.sky!.positions = positions(8.00001)
    const nearResult = computeVesselProgression(near)
    const edgeResult = computeVesselProgression(edge)
    const outsideResult = computeVesselProgression(outside)
    expect(Math.abs(nearResult.currentOverall! - edgeResult.currentOverall!)).toBeLessThan(0.0001)
    expect(outsideResult.currentOverall).toBe(edgeResult.currentOverall)
  })

  it('caps ratings and sky deltas while retaining a decline from a capped baseline', () => {
    const maximum = input()
    maximum.totalXp = 980_100
    for (const key of ALL_VESSEL_STAT_KEYS) maximum.stats[key] = SACRED.includes(key) ? 99 : 100
    const capped = computeVesselProgression(maximum)
    expect(capped.trainedOverall).toBe(99)
    expect(capped.currentOverall).toBe(99)
    expect(Object.values(capped.statDeltas).every(delta => delta === 0)).toBe(true)
    maximum.sky!.positions = positions(180)
    const declined = computeVesselProgression(maximum)
    expect(declined.currentOverall!).toBeLessThan(99)
    expect(declined.currentOverall!).toBeGreaterThanOrEqual(84)
    expect(declined.level).toBe(100)
    const minimum = input()
    minimum.totalXp = 0
    minimum.sky!.positions = positions(180)
    for (const key of ALL_VESSEL_STAT_KEYS) minimum.stats[key] = SACRED.includes(key) ? 25 : 0
    expect(computeVesselProgression(minimum).currentOverall).toBe(25)
  })

  it('rejects invalid and duplicate positions instead of silently inventing a chart', () => {
    const duplicate = input()
    duplicate.sky!.positions.sun = { longitude: 90 }
    expect(computeVesselProgression(duplicate).currentOverall).toBeNull()
    const invalid = input()
    invalid.natal.positions.Mars.longitude = Number.NaN
    expect(computeVesselProgression(invalid).currentOverall).toBeNull()
  })

  it('rejects invalid XP and incomplete stats and does not mutate a valid input', () => {
    for (const xp of [-1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const fixture = input()
      fixture.totalXp = xp
      expect(() => computeVesselProgression(fixture)).toThrow(RangeError)
    }
    const incomplete = input()
    delete (incomplete.stats as Partial<VesselStats>).plutonicIntegration
    expect(() => computeVesselProgression(incomplete)).toThrow(RangeError)
    const fixture = input()
    const original = structuredClone(fixture)
    computeVesselProgression(fixture)
    expect(fixture).toEqual(original)
  })

  it('produces significant scalar dignity (|R_dignity| >= 4) for a single exact Solar Return without zero dilution', () => {
    const fixture = input()
    fixture.natal.positions = positions(0)
    fixture.sky!.positions = Object.fromEntries(
      PLANETS.map(planet => [planet, { longitude: planet === 'Sun' ? 0 : 45 }])
    )
    const result = computeVesselProgression(fixture)
    const dignityRating = result.transitDelta ?? result.currentOverall! - result.trainedOverall
    expect(Math.abs(dignityRating)).toBeGreaterThanOrEqual(4)
  })

  it('preserves true unclamped transitDelta in [-15, +15] even when trainedOverall >= 85 saturates currentOverall at 99', () => {
    const highLevel = input()
    highLevel.totalXp = 980_100 // Level 100 (+12 levelBoost)
    for (const key of ALL_VESSEL_STAT_KEYS) {
      highLevel.stats[key] = SACRED.includes(key) ? 80 : 75
    }
    const result = computeVesselProgression(highLevel)
    expect(result.trainedOverall).toBeGreaterThanOrEqual(90)
    expect(result.currentOverall).toBe(99)
    expect(result.transitDelta).not.toBeNull()
    expect(result.transitDelta!).toBeGreaterThan(99 - result.trainedOverall)
    expect(result.transitDelta!).toBeGreaterThanOrEqual(12)
  })

  it('couples Stage 2 planetary responses with the 4D ESMS wavefunction and exposes esmsAxisAttribution', () => {
    const wave = { Spirit: 2.0, Essence: -1.0, Matter: -1.0, Substance: 0.0 }
    expect(computeAmbientAlchemicalTide('Sun', wave)).toBe(1.0)
    expect(computeAmbientAlchemicalTide('Moon', wave)).toBe(-0.5)

    // Channel B dyadic chord gain stays strictly within [0.65, 1.35] and never flips aspect sign
    const resonantGain = computeDyadicChordGain('Sun', 'Sun', 0.85, wave)
    const cushionedGain = computeDyadicChordGain('Sun', 'Sun', -0.8, wave)
    expect(resonantGain).toBeCloseTo(1.35, 5)
    expect(cushionedGain).toBeCloseTo(0.65, 5)
    expect(cushionedGain).toBeGreaterThan(0)

    const liveResult = computeVesselProgression(input())
    expect(liveResult.esmsAxisAttribution).not.toBeNull()
    for (const axis of ['Spirit', 'Essence', 'Matter', 'Substance'] as const) {
      expect(liveResult.esmsAxisAttribution![axis]).toBeGreaterThanOrEqual(-1)
      expect(liveResult.esmsAxisAttribution![axis]).toBeLessThanOrEqual(1)
    }
  })
})
