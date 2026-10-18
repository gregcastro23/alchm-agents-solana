/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest'
import {
  SKY_BODIES,
  SkyUnavailableError,
  deriveLiveSky,
  eclipticLongitudeToEphemerisRow,
  longitudesFromBackend,
  resolveLiveSky,
  type SkyLongitudes,
} from '@/lib/agents/rating/live-sky'
import { raDecToEclipticLongitude } from '@/lib/spacetime/derive-live-ephemeris'
import { MONICA_EQUILIBRIUM } from '@/lib/thermodynamics/kalchm'

/** 2026-10-15T05:43Z, geocentric apparent longitudes from an independent ephemeris (PyEphem). */
const OCT_15: Record<string, [number, boolean]> = {
  Sun: [201.893, false],
  Moon: [254.488, false],
  Mercury: [226.6762, false],
  Venus: [215.71, true],
  Mars: [129.7684, false],
  Jupiter: [141.9852, false],
  Saturn: [10.4673, true],
  Uranus: [65.2121, true],
  Neptune: [2.4796, true],
  Pluto: [303.0663, true],
}
const longitudes = (table = OCT_15): SkyLongitudes =>
  Object.fromEntries(
    SKY_BODIES.map(b => [b, { longitude: table[b][0], retrograde: table[b][1] }])
  ) as SkyLongitudes

const backendPayload = (source: unknown = 'swiss-ephemeris', table = OCT_15) => ({
  birth_info: { year: 2026, month: 10, date: 15, hour: 5, minute: 43 },
  ...(source === NO_STAMP ? {} : { source }),
  planetary_positions: Object.fromEntries(
    SKY_BODIES.map(b => [b, { exactLongitude: table[b][0], isRetrograde: table[b][1] }])
  ),
})

const NOW = new Date('2026-10-15T05:43:00Z')
/** A payload with no `source` key at all - what the backend served before it was stamped. */
const NO_STAMP = Symbol('no-stamp')

describe('eclipticLongitudeToEphemerisRow', () => {
  it('round-trips every longitude through raDecToEclipticLongitude, including 0–24° of RA', () => {
    for (let lon = 0; lon < 360; lon += 0.5) {
      const row = eclipticLongitudeToEphemerisRow('Sun', lon, false)
      expect(row.ra, `ra for ${lon}`).toBeGreaterThanOrEqual(0)
      expect(row.ra, `ra for ${lon}`).toBeLessThan(24) // hours, never mistaken for degrees
      const back = raDecToEclipticLongitude(row.ra, row.dec)
      const delta = Math.abs(((back - lon + 540) % 360) - 180)
      expect(delta, `longitude ${lon}`).toBeLessThan(1e-6)
    }
  })

  it('does not misplace a body whose right ascension is below 24 degrees', () => {
    // 15° of ecliptic longitude is ~13.8° of RA: as degrees it would be read as hours (x15).
    const row = eclipticLongitudeToEphemerisRow('Mars', 15, false)
    expect(raDecToEclipticLongitude(row.ra, row.dec)).toBeCloseTo(15, 5)
  })

  it('carries the body tag and the retrograde flag', () => {
    const row = eclipticLongitudeToEphemerisRow('Venus', 215.71, true)
    expect(row.body.tag).toBe('Venus')
    expect(row.retrograde).toBe(true)
  })
})

describe('deriveLiveSky', () => {
  const sky = deriveLiveSky(longitudes(), 'swiss-ephemeris', NOW)

  it('places the bodies in the right signs and records provenance and time', () => {
    expect(sky.source).toBe('swiss-ephemeris')
    expect(sky.at).toBe('2026-10-15T05:43:00.000Z')
    expect(sky.bodies.Sun.sign).toBe('Libra')
    expect(sky.bodies.Saturn.sign).toBe('Aries')
    expect(sky.bodies.Pluto.sign).toBe('Aquarius')
    expect(Object.keys(sky.bodies).sort()).toEqual([...SKY_BODIES].sort())
  })

  it('returns finite thermodynamics from the canonical engine, and Monica as a number or null', () => {
    for (const value of Object.values(sky.thermodynamics)) expect(Number.isFinite(value)).toBe(true)
    expect(sky.thermodynamics.heat).toBeGreaterThan(0)
    expect(sky.kalchm).toBeGreaterThan(0)
    expect(sky.monica === null || Number.isFinite(sky.monica)).toBe(true)
    expect(sky.monica).not.toBe(0)
    expect(MONICA_EQUILIBRIUM).toBe(1.618) // the constant the surge classifies against
  })

  it('is deterministic and responds to the sky', () => {
    expect(deriveLiveSky(longitudes(), 'swiss-ephemeris', NOW)).toEqual(sky)
    // Jupiter from Leo into Cancer (exaltation) changes the dignity multiplier, so the ESMS totals.
    const shifted = { ...OCT_15, Jupiter: [100, false] as [number, boolean] }
    const other = deriveLiveSky(longitudes(shifted), 'swiss-ephemeris', NOW)
    expect(other.thermodynamics).not.toEqual(sky.thermodynamics)
  })

  it('refuses a partial or non-finite sky instead of rating a smaller one', () => {
    const partial = longitudes() as Partial<SkyLongitudes>
    delete partial.Pluto
    expect(() => deriveLiveSky(partial as SkyLongitudes, 'swiss-ephemeris', NOW)).toThrow(
      SkyUnavailableError
    )
    expect(() => deriveLiveSky(partial as SkyLongitudes, 'swiss-ephemeris', NOW)).toThrow(/Pluto/)
    const broken = { ...longitudes(), Sun: { longitude: Number.NaN, retrograde: false } }
    expect(() => deriveLiveSky(broken, 'swiss-ephemeris', NOW)).toThrow(/Sun/)
  })
})

describe('longitudesFromBackend', () => {
  it('accepts a payload stamped swiss-ephemeris with all ten bodies', () => {
    const parsed = longitudesFromBackend(backendPayload())
    expect(parsed?.Venus).toEqual({ longitude: 215.71, retrograde: true })
    expect(parsed?.Sun.retrograde).toBe(false)
  })

  it.each([
    ['an unstamped payload (the old circular-orbit model)', backendPayload(NO_STAMP)],
    ['a payload stamped as something else', backendPayload('circular-approximation')],
    ['null', null],
    ['a string', 'nope'],
    ['no positions', { source: 'swiss-ephemeris' }],
  ])('refuses %s', (_label, raw) => {
    expect(longitudesFromBackend(raw)).toBeNull()
  })

  it('refuses a payload missing a body or carrying a non-finite longitude', () => {
    const missing = backendPayload() as any
    delete missing.planetary_positions.Neptune
    expect(longitudesFromBackend(missing)).toBeNull()
    const nan = backendPayload() as any
    nan.planetary_positions.Moon.exactLongitude = 'x'
    expect(longitudesFromBackend(nan)).toBeNull()
  })
})

describe('resolveLiveSky', () => {
  it('uses the Swiss-stamped backend sky when it answers', async () => {
    const sky = await resolveLiveSky({ now: NOW, fetchBackend: async () => backendPayload() })
    expect(sky.source).toBe('swiss-ephemeris')
    expect(sky.bodies.Sun.sign).toBe('Libra')
  })

  it('refuses an unstamped backend and falls back to the labelled local approximation', async () => {
    const sky = await resolveLiveSky({
      now: NOW,
      fetchBackend: async () => backendPayload(NO_STAMP),
    })
    expect(sky.source).toBe('vsop87-approximation')
    expect(Object.keys(sky.bodies)).toHaveLength(10)
  })

  it('falls back when the backend throws or hangs', async () => {
    const down = await resolveLiveSky({
      now: NOW,
      fetchBackend: async () => {
        throw new Error('ECONNREFUSED')
      },
    })
    expect(down.source).toBe('vsop87-approximation')

    const hung = await resolveLiveSky({
      now: NOW,
      timeoutMs: 20,
      fetchBackend: () => new Promise(() => {}),
    })
    expect(hung.source).toBe('vsop87-approximation')
  })

  it('throws SkyUnavailableError when the local calculator withholds a body', async () => {
    vi.resetModules()
    vi.doMock('@/lib/enhanced-astronomical-calculator', () => ({
      calculateAllPlanets: () => ({ planets: { Sun: { longitude: 10, retrograde: false } } }),
    }))
    const mod = await import('@/lib/agents/rating/live-sky')
    await expect(mod.resolveLiveSky({ now: NOW, fetchBackend: async () => null })).rejects.toThrow(
      mod.SkyUnavailableError
    )
    vi.doUnmock('@/lib/enhanced-astronomical-calculator')
    vi.resetModules()
  })
})
