/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SURGE_CALIBRATION, calculateResonanceSurge } from '@/lib/agents/rating/seals-surge'
import { calculateAllPlanets } from '@/lib/enhanced-astronomical-calculator'
import { eclipticLongitudeToEphemerisRow, type SkyBodyName } from '@/lib/agents/rating/live-sky'
import { deriveLiveEphemeris } from '@/lib/spacetime/hooks/useLiveEphemeris'
import { ZODIAC_SIGNS } from '@/lib/staking/elements'

/**
 * `DEFAULT_SURGE_CALIBRATION` is a measurement of the live sky, so this spec
 * repeats it: the same 600 evenly spaced dates (2020–2035) through the same
 * `deriveLiveEphemeris` the Pentacles board reads. If the ephemeris or the
 * alchemy profiles move, the anchors go stale and this fails — re-pin
 * `DEFAULT_SURGE_CALIBRATION` from the numbers in the message.
 *
 * The surge itself is the rating contract's `ResonanceSurgeState` (`meter` an integer, `active` at
 * 70 or more of that integer, `heat` and `reactivity` the quantities' ramp positions 0–1), fed
 * the meter this module computes. Every expectation below is written out from the pinned
 * anchors, not read back from `calculateResonanceSurge`.
 */
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
]
const SAMPLES = 600
const START = Date.UTC(2020, 0, 1)
const SPAN = 15 * 365.25 * 86_400_000
function sampleSky() {
  const heat: number[] = []
  const reactivity: number[] = []
  for (let i = 0; i < SAMPLES; i++) {
    const at = new Date(START + (SPAN * i) / SAMPLES)
    const chart = calculateAllPlanets({
      year: at.getUTCFullYear(),
      month: at.getUTCMonth() + 1,
      day: at.getUTCDate(),
      hour: at.getUTCHours(),
      minute: 0,
      second: 0,
      latitude: 0,
      longitude: 0,
    })
    const rows = Object.entries(chart.planets)
      .filter(([name]) => BODIES.includes(name))
      .map(([name, p]) =>
        eclipticLongitudeToEphemerisRow(
          name as SkyBodyName,
          ZODIAC_SIGNS.indexOf(p.sign as (typeof ZODIAC_SIGNS)[number]) * 30 + p.signDegree,
          Boolean(p.retrograde)
        )
      )
    const q = deriveLiveEphemeris(rows).alchmQuantities
    heat.push(q.Heat)
    reactivity.push(q.Reactivity)
  }
  return { heat, reactivity }
}

const percentile = (xs: number[], p: number) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]

/** The archetype every sample is surged for; the contract boosts its primary and secondary most. */
const ARCHETYPE = { primary: 'wisdom', secondary: 'intuition' } as const

/** The anchors, written out: the independent oracle for the ramp positions. */
const ANCHORS = {
  heat: { low: 0.0184, high: 0.1154 },
  reactivity: { low: 0.561, high: 3.586 },
}
const rampPosition = (value: number, { low, high }: { low: number; high: number }) =>
  Math.min(1, Math.max(0, (value - low) / (high - low)))

describe('surge calibration against the live sky', () => {
  const sky = sampleSky()
  const surgeAt = (i: number, monica?: number | null) =>
    calculateResonanceSurge({
      thermodynamics: { heat: sky.heat[i], reactivity: sky.reactivity[i] },
      archetype: ARCHETYPE,
      monica,
    })
  const states = sky.heat.map((_, i) => surgeAt(i))

  it('samples the 600 dates it says it does, all with a real (finite, positive) sky', () => {
    expect(sky.heat).toHaveLength(600)
    expect(sky.reactivity).toHaveLength(600)
    for (let i = 0; i < SAMPLES; i++) {
      expect(Number.isFinite(sky.heat[i]) && sky.heat[i] > 0, `heat ${i}`).toBe(true)
      expect(Number.isFinite(sky.reactivity[i]) && sky.reactivity[i] > 0, `reactivity ${i}`).toBe(
        true
      )
    }
  })

  it('pins the anchors the sky is compared with (re-pin here AND in seals-surge.spec.ts)', () => {
    expect(DEFAULT_SURGE_CALIBRATION).toEqual(ANCHORS)
  })

  it.each([
    ['heat', 'low', 0.05],
    ['heat', 'high', 0.95],
    ['reactivity', 'low', 0.05],
    ['reactivity', 'high', 0.95],
  ] as const)('keeps the %s %s anchor at the sky’s %s quantile (±10%%)', (quantity, end, p) => {
    const measured = percentile(sky[quantity], p)
    const pinned = DEFAULT_SURGE_CALIBRATION[quantity][end]
    expect(
      Math.abs(measured - pinned) / pinned,
      `${quantity}.${end}: pinned ${pinned} but the sky now measures ${measured.toFixed(4)} — re-pin`
    ).toBeLessThanOrEqual(0.1)
  })

  it('makes a resonance surge an event, not a steady state, and lets both types occur', () => {
    const activeShare = states.filter(s => s.active).length / states.length
    const infernoShare = states.filter(s => s.surgeType === 'inferno').length / states.length
    // Measured 2026-10-19 (the meter is rounded before the 70 test, which moves no sample here):
    // 8.3% active, 43% heat-led.
    expect(activeShare).toBeGreaterThan(0.04)
    expect(activeShare).toBeLessThan(0.14)
    expect(infernoShare).toBeGreaterThan(0.25)
    expect(infernoShare).toBeLessThan(0.75)
    // Without a Monica the contract never promotes a surge to the equilibrium type.
    expect(states.filter(s => s.surgeType === 'equilibrium')).toEqual([])
  })

  it('reports heat and reactivity as ramp positions on the pinned anchors, for every sample', () => {
    sky.heat.forEach((heat, i) => {
      expect(states[i].heat, `heat ${i}`).toBeCloseTo(rampPosition(heat, ANCHORS.heat), 12)
      expect(states[i].reactivity, `reactivity ${i}`).toBeCloseTo(
        rampPosition(sky.reactivity[i], ANCHORS.reactivity),
        12
      )
      expect(states[i].heat).toBeGreaterThanOrEqual(0)
      expect(states[i].heat).toBeLessThanOrEqual(1)
      expect(states[i].reactivity).toBeGreaterThanOrEqual(0)
      expect(states[i].reactivity).toBeLessThanOrEqual(1)
    })
  })

  it('reads half the meter from each quantity, whole, and active at 70 of that whole', () => {
    sky.heat.forEach((heat, i) => {
      const s = states[i]
      const skyMeter =
        50 *
        (rampPosition(heat, ANCHORS.heat) + rampPosition(sky.reactivity[i], ANCHORS.reactivity))
      expect(s.skyMeter, `sample ${i}`).toBeCloseTo(skyMeter, 9)
      expect(s.harmonyOffset).toBe(0)
      expect(Number.isInteger(s.meter), `sample ${i}`).toBe(true)
      expect(s.meter, `sample ${i}`).toBe(Math.round(skyMeter))
      expect(s.active, `sample ${i}`).toBe(s.meter >= 70)
    })
  })

  it('types a surge by the ramp positions: heat leads or ties is inferno, otherwise tempest', () => {
    sky.heat.forEach((heat, i) => {
      const heatPosition = rampPosition(heat, ANCHORS.heat)
      const reactivityPosition = rampPosition(sky.reactivity[i], ANCHORS.reactivity)
      expect(states[i].surgeType, `sample ${i}`).toBe(
        heatPosition >= reactivityPosition ? 'inferno' : 'tempest'
      )
    })
  })

  it('boosts all seven stats only while active: +12 / +8 / +4 by the archetype, nothing otherwise', () => {
    for (const s of states) {
      if (!s.active) {
        expect(s.statBoosts).toEqual({})
        continue
      }
      expect(s.statBoosts).toEqual({
        power: 4,
        resonance: 4,
        wisdom: 12,
        charisma: 4,
        intuition: 8,
        adaptability: 4,
        vitality: 4,
      })
    }
    expect(states.some(s => s.active)).toBe(true)
  })

  it('promotes exactly the active samples to the equilibrium type at Monica equilibrium', () => {
    sky.heat.forEach((_, i) => {
      const dual = surgeAt(i, 1.618)
      expect(dual.meter, `sample ${i}`).toBe(states[i].meter)
      expect(dual.active, `sample ${i}`).toBe(states[i].active)
      expect(dual.monicaState).toBe('equilibrium')
      if (states[i].active) {
        expect(dual.surgeType, `sample ${i}`).toBe('equilibrium')
        expect(dual.statBoosts.wisdom).toBe(16)
        expect(dual.statBoosts.intuition).toBe(12)
        expect(dual.statBoosts.power).toBe(8)
      } else {
        expect(dual.surgeType, `sample ${i}`).toBe(states[i].surgeType)
        expect(dual.statBoosts).toEqual({})
      }
    })
  })
})
