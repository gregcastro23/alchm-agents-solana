/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TAKEOVER_CALIBRATION,
  calculateTakeover,
} from '@/lib/agents/rating/badges-takeover'
import { calculateAllPlanets } from '@/lib/enhanced-astronomical-calculator'
import type { Ephemeris } from '@/lib/spacetime/generated/types'
import { deriveLiveEphemeris } from '@/lib/spacetime/hooks/useLiveEphemeris'
import { ZODIAC_SIGNS } from '@/lib/staking/elements'

/**
 * `DEFAULT_TAKEOVER_CALIBRATION` is a measurement of the live sky, so this spec
 * repeats it: the same 600 evenly spaced dates (2020–2035) through the same
 * `deriveLiveEphemeris` the Pentacles board reads. If the ephemeris or the
 * alchemy profiles move, the anchors go stale and this fails — re-pin
 * `DEFAULT_TAKEOVER_CALIBRATION` from the numbers in the message.
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
const OBLIQUITY = (23.43928 * Math.PI) / 180

/** Inverse of `raDecToEclipticLongitude` at dec = 0: tan λ = tan α · cos ε. */
function rowFor(planet: string, longitudeDeg: number, retrograde: boolean): Ephemeris {
  const lambda = (longitudeDeg * Math.PI) / 180
  const alpha = Math.atan2(Math.sin(lambda), Math.cos(lambda) * Math.cos(OBLIQUITY))
  const ra = ((((alpha * 180) / Math.PI) % 360) + 360) % 360
  return { body: { tag: planet }, ra, dec: 0, retrograde } as unknown as Ephemeris
}

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
        rowFor(
          name,
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

describe('takeover calibration against the live sky', () => {
  const sky = sampleSky()

  it.each([
    ['heat', 'low', 0.05],
    ['heat', 'high', 0.95],
    ['reactivity', 'low', 0.05],
    ['reactivity', 'high', 0.95],
  ] as const)('keeps the %s %s anchor at the sky’s %s quantile (±10%%)', (quantity, end, p) => {
    const measured = percentile(sky[quantity], p)
    const pinned = DEFAULT_TAKEOVER_CALIBRATION[quantity][end]
    expect(
      Math.abs(measured - pinned) / pinned,
      `${quantity}.${end}: pinned ${pinned} but the sky now measures ${measured.toFixed(4)} — re-pin`
    ).toBeLessThanOrEqual(0.1)
  })

  it('makes takeover an event, not a steady state, and lets both types occur', () => {
    const states = sky.heat.map((heat, i) =>
      calculateTakeover({ thermodynamics: { heat, reactivity: sky.reactivity[i] } })
    )
    const activeShare = states.filter(s => s.active).length / states.length
    const infernoShare = states.filter(s => s.takeoverType === 'inferno').length / states.length
    // Measured when written: 6.2% active, 45% heat-led.
    expect(activeShare).toBeGreaterThan(0.02)
    expect(activeShare).toBeLessThan(0.12)
    expect(infernoShare).toBeGreaterThan(0.25)
    expect(infernoShare).toBeLessThan(0.75)
  })
})
