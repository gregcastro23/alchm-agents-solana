/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calculateAllPlanets } from '@/lib/enhanced-astronomical-calculator'
import {
  BACKEND_SKY_TOLERANCE_MS,
  SKY_BODIES,
  SkyUnavailableError,
  deriveLiveSky,
  eclipticLongitudeToEphemerisRow,
  longitudesFromBackend,
  longitudesFromLocalCalculator,
  resolveLiveSky,
  type SkyLongitudes,
} from '@/lib/agents/rating/live-sky'
import {
  deriveLiveEphemeris,
  raDecToEclipticLongitude,
} from '@/lib/spacetime/derive-live-ephemeris'
import { MONICA_EQUILIBRIUM, calculateKalchm, calculateMonica } from '@/lib/thermodynamics/kalchm'

/**
 * The machine this runs on is irrelevant: the whole file runs 14 hours ahead of UTC, so a body
 * that reads the instant through a local-time getter (`getHours`, `getDate`, `getMonth`...) is
 * reading a different clock, and often a different calendar day, from the UTC instant it was
 * handed. `vi.hoisted` runs before the imports above are evaluated, i.e. before any Date is used.
 */
const HOME_TZ = vi.hoisted(() => {
  process.env.TZ = 'Pacific/Kiritimati'
  return 'Pacific/Kiritimati'
})

type Table = Record<string, [number, boolean]>

/** 2026-10-15T05:43Z, geocentric apparent longitudes from an independent ephemeris (PyEphem). */
const OCT_15: Table = {
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

/** The sign of each OCT_15 longitude (longitude / 30, read off the zodiac by hand). */
const OCT_15_SIGNS = {
  Sun: 'Libra',
  Moon: 'Sagittarius',
  Mercury: 'Scorpio',
  Venus: 'Scorpio',
  Mars: 'Leo',
  Jupiter: 'Leo',
  Saturn: 'Aries',
  Uranus: 'Gemini',
  Neptune: 'Aries',
  Pluto: 'Aquarius',
}
const signsOf = (bodies: Record<string, { sign: string }>) =>
  Object.fromEntries(Object.entries(bodies).map(([body, { sign }]) => [body, sign]))

/**
 * A sky that is deliberately NOT the real one (Sun..Mars in Aries, the rest in Taurus). Anything
 * that comes out of a function looking like this came from the payload it was handed; anything
 * that looks like OCT_15 came from the local calculator.
 */
const SPREAD: Table = Object.fromEntries(
  SKY_BODIES.map((body, index) => [body, [15 + 3 * index, false] as [number, boolean]])
)

const longitudes = (table: Table = OCT_15): SkyLongitudes =>
  Object.fromEntries(
    SKY_BODIES.map(b => [b, { longitude: table[b][0], retrograde: table[b][1] }])
  ) as SkyLongitudes

/** A payload with no `source` key at all - what the backend served before it was stamped. */
const NO_STAMP = Symbol('no-stamp')

const backendPayload = (source: unknown = 'swiss-ephemeris', table: Table = OCT_15) => ({
  birth_info: { year: 2026, month: 10, date: 15, hour: 5, minute: 43 },
  ...(source === NO_STAMP ? {} : { source }),
  planetary_positions: Object.fromEntries(
    SKY_BODIES.map(b => [b, { exactLongitude: table[b][0], isRetrograde: table[b][1] }])
  ),
})

/** Unlike `backendPayload(undefined)`, this really carries `source: undefined`. */
const payloadWithStamp = (stamp: unknown, table: Table = OCT_15) => ({
  ...backendPayload(NO_STAMP, table),
  source: stamp,
})

const NOW = new Date('2026-10-15T05:43:00Z')

/** Smallest angle between two longitudes, in degrees. */
const angularGap = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180)

/** The error a call throws, so its class and exact message can both be asserted. */
const thrownBy = (fn: () => unknown): Error => {
  try {
    fn()
  } catch (error) {
    return error as Error
  }
  throw new Error('expected the call to throw')
}
const rejectionOf = (promise: Promise<unknown>): Promise<Error> =>
  promise.then(
    () => {
      throw new Error('expected the promise to reject')
    },
    error => error as Error
  )
const INCOMPLETE_BUT_SUN =
  'The sky is incomplete (Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto); a partial chart is never rated'

/** The stamps `longitudesFromBackend` must refuse, whatever longitudes ride along. */
const REFUSED_STAMPS: [string, unknown][] = [
  ['the local approximation label', 'vsop87-approximation'],
  ['the WTEN host stamp', 'pyswisseph'],
  ['the circular model', 'circular-approximation'],
  ['a different case', 'Swiss-Ephemeris'],
  ['upper case', 'SWISS-EPHEMERIS'],
  ['trailing whitespace', 'swiss-ephemeris '],
  ['an underscore', 'swiss_ephemeris'],
  ['an empty string', ''],
  ['undefined', undefined],
  ['null', null],
  ['a number', 1],
  ['true', true],
  ['an array holding the stamp', ['swiss-ephemeris']],
]

/** Fake only what the module under test uses, so module loading is never starved of ticks. */
const fakeClock = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })

/**
 * The default backend is consulted only while `now` sits within BACKEND_SKY_TOLERANCE_MS of the
 * real clock, so a test that rates the sky at a fixed `now` through the default fetch has to put
 * the clock there. Fake timers too (for `vi.getTimerCount()` and `advanceTimersByTimeAsync`).
 */
const fakeClockAt = (at: Date) => {
  fakeClock()
  vi.setSystemTime(at)
}

/** As `fakeClockAt`, but only the Date: real timers keep working underneath. */
const pinClockAt = (at: Date) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(at)
}

/** What the calculator gives for a far-off instant, written from the sky of that day (not read from the code). */
const JULY_2020_NOW = new Date('2020-07-01T12:00:00Z')
const JULY_2020_SIGNS = {
  Sun: 'Cancer',
  Mercury: 'Cancer', // in its June-July 2020 retrograde through Cancer
  Venus: 'Gemini',
  Mars: 'Aries',
  Jupiter: 'Capricorn',
  Uranus: 'Taurus',
  Neptune: 'Pisces',
  Pluto: 'Capricorn',
}
const expectJuly2020Signs = (bodies: Record<string, { sign: string }>) => {
  const signs = signsOf(bodies)
  for (const [body, sign] of Object.entries(JULY_2020_SIGNS)) expect(signs[body], body).toBe(sign)
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.doUnmock('@/lib/enhanced-astronomical-calculator')
  vi.doUnmock('@/lib/thermodynamics/kalchm')
  process.env.TZ = HOME_TZ
})

describe('test harness', () => {
  // Switching the process timezone works in vitest's default `forks` pool. In a worker-thread pool
  // `process.env.TZ` is a private copy that the date machinery never sees, and the local-time
  // checks below would silently prove nothing - so this fails loudly there instead.
  it('runs 14 hours ahead of UTC, so local-time reads cannot pass by accident', () => {
    expect(process.env.TZ).toBe('Pacific/Kiritimati')
    expect(NOW.getTimezoneOffset(), 'needs vitest --pool=forks (the default)').toBe(-840)
    // Late-UTC instants are already the next calendar day (and, at year end, the next year).
    expect(new Date('2026-10-15T20:31:47Z').getDate()).toBe(16)
    expect(new Date('2026-12-31T23:59:59Z').getFullYear()).toBe(2027)
    expect(NOW.getHours()).toBe(19)
  })
})

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

  it('round-trips every whole degree 0..359 within 1e-6 degrees, with RA in hours in [0, 24)', () => {
    for (let lon = 0; lon <= 359; lon += 1) {
      const row = eclipticLongitudeToEphemerisRow('Moon', lon, false)
      expect(row.ra, `ra for ${lon}`).toBeGreaterThanOrEqual(0)
      expect(row.ra, `ra for ${lon}`).toBeLessThan(24)
      const back = raDecToEclipticLongitude(row.ra, row.dec)
      expect(angularGap(back, lon), `longitude ${lon}`).toBeLessThan(1e-6)
    }
  })

  it('does not misplace a body whose right ascension is below 24 degrees', () => {
    // 15° of ecliptic longitude is ~13.8° of RA: as degrees it would be read as hours (x15).
    const row = eclipticLongitudeToEphemerisRow('Mars', 15, false)
    expect(raDecToEclipticLongitude(row.ra, row.dec)).toBeCloseTo(15, 5)
    // 13.8° of RA is 0.92 h: a value in degrees would be 13.8 h, far from this.
    expect(row.ra).toBeLessThan(1.5)
  })

  it('puts the equinoxes and solstices at 0, 6, 12 and 18 hours of right ascension', () => {
    const hours = (lon: number) => eclipticLongitudeToEphemerisRow('Sun', lon, false).ra
    expect(hours(0)).toBeCloseTo(0, 9)
    expect(hours(90)).toBeCloseTo(6, 9)
    expect(hours(180)).toBeCloseTo(12, 9)
    expect(hours(270)).toBeCloseTo(18, 9)
  })

  it('moves right ascension strictly forward with longitude all the way round', () => {
    let previous = -1
    for (let lon = 0; lon <= 359; lon += 1) {
      const { ra } = eclipticLongitudeToEphemerisRow('Sun', lon, false)
      expect(ra, `ra for ${lon}`).toBeGreaterThan(previous)
      previous = ra
    }
  })

  it('folds a longitude outside [0, 360) onto the same point of the circle', () => {
    const at = (lon: number) => eclipticLongitudeToEphemerisRow('Sun', lon, false).ra
    expect(at(-10)).toBeCloseTo(at(350), 9)
    expect(at(370)).toBeCloseTo(at(10), 9)
    expect(at(720.5)).toBeCloseTo(at(0.5), 9)
    for (const lon of [-0.000001, -1e-13, 359.9999999999, 360, 1e-13]) {
      const { ra } = eclipticLongitudeToEphemerisRow('Sun', lon, false)
      expect(ra, `ra for ${lon}`).toBeGreaterThanOrEqual(0)
      expect(ra, `ra for ${lon}`).toBeLessThan(24)
    }
  })

  it('never lets right ascension reach 24 hours, even a hair before the full turn', () => {
    const lon = 359.9999999999
    const { ra } = eclipticLongitudeToEphemerisRow('Sun', lon, false)
    expect(ra).toBeLessThanOrEqual(23.999999999)
    expect(ra).toBeGreaterThan(23.99999999)
    expect(angularGap(raDecToEclipticLongitude(ra, 0), lon)).toBeLessThan(1e-6)
  })

  it('carries the body tag and the retrograde flag, on the celestial equator', () => {
    const row = eclipticLongitudeToEphemerisRow('Venus', 215.71, true)
    expect(row.body.tag).toBe('Venus')
    expect(row.retrograde).toBe(true)
    expect(row.dec).toBe(0)
    expect(eclipticLongitudeToEphemerisRow('Mars', 10, false).retrograde).toBe(false)
    expect(eclipticLongitudeToEphemerisRow('Mars', 10, false)).toEqual({
      body: { tag: 'Mars' },
      ra: expect.any(Number),
      dec: 0,
      retrograde: false,
    })
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

  describe('mapping', () => {
    const rowsFor = (table: Table) =>
      SKY_BODIES.map(b => eclipticLongitudeToEphemerisRow(b, table[b][0], table[b][1]))

    it('files every body under its own sign', () => {
      expect(signsOf(sky.bodies)).toEqual(OCT_15_SIGNS)
    })

    it('derives the ESMS totals the dignity table gives for this sky (worked by hand)', () => {
      // Sun in Libra (detriment, x1.2), Venus in Scorpio (x1.1), Saturn in Aries (fall, x1.2),
      // Pluto in Aquarius (x1.2); every other body is in a sign without dignity (x1).
      const q = deriveLiveEphemeris(rowsFor(OCT_15)).alchmQuantities
      expect(q.spirit).toBeCloseTo(4.4, 9) // Sun 1.2 + Mercury + Jupiter + Saturn 1.2
      expect(q.essence).toBeCloseTo(7.3, 9) // Moon, Venus 1.1, Mars, Jupiter, Uranus, Neptune, Pluto 1.2
      expect(q.matter).toBeCloseTo(6.5, 9) // Moon, Venus 1.1, Mars, Saturn 1.2, Uranus, Pluto 1.2
      expect(q.substance).toBeCloseTo(2, 9) // Mercury + Neptune
      // And the spread sky: Sun 1.2 (Aries, exalted), Venus 1.1, Mars 1.1, Uranus 1.3, Pluto 1.1.
      const s = deriveLiveEphemeris(rowsFor(SPREAD)).alchmQuantities
      expect(s.spirit).toBeCloseTo(4.2, 9)
      expect(s.essence).toBeCloseTo(7.6, 9)
      expect(s.matter).toBeCloseTo(6.6, 9)
      expect(s.substance).toBeCloseTo(2, 9)
    })

    it.each([
      ['the real sky', OCT_15],
      ['a spread sky', SPREAD],
      ['Jupiter exalted in Cancer', { ...OCT_15, Jupiter: [100, false] as [number, boolean] }],
    ])('routes each engine output to its own field (%s)', (_label: string, table: Table) => {
      const out = deriveLiveSky(longitudes(table), 'swiss-ephemeris', NOW)
      const q = deriveLiveEphemeris(rowsFor(table)).alchmQuantities
      expect(out.thermodynamics).toEqual({
        heat: q.Heat,
        entropy: q.Entropy,
        reactivity: q.Reactivity,
        gregsEnergy: q.Energy,
      })
      // The four numbers are all different, so a swapped pair cannot hide.
      expect(new Set(Object.values(out.thermodynamics)).size).toBe(4)

      const kalchm = calculateKalchm({
        spirit: q.spirit,
        essence: q.essence,
        matter: q.matter,
        substance: q.substance,
      })
      expect(out.kalchm).toBe(kalchm)
      const monica = calculateMonica({ energy: q.Energy, reactivity: q.Reactivity, kalchm })
      expect(monica).not.toBeNull()
      expect(out.monica).toBe(monica)
      expect(out.monica).not.toBeNull()
    })

    it('pins the numbers for the 2026-10-15 sky, so a swapped or re-wired quantity fails', () => {
      expect(sky.thermodynamics.heat).toBeCloseTo(0.131502, 6)
      expect(sky.thermodynamics.entropy).toBeCloseTo(0.3130669, 6)
      expect(sky.thermodynamics.reactivity).toBeCloseTo(3.56568, 5)
      expect(sky.thermodynamics.gregsEnergy).toBeCloseTo(-0.9847945, 6)
      expect(sky.kalchm).toBeCloseTo(1767.876187, 4)
      expect(sky.monica).not.toBeNull()
      expect(sky.monica as number).toBeCloseTo(0.0369356, 6)
    })

    it('pins the numbers for a second sky, where Monica is negative and still a number', () => {
      const spread = deriveLiveSky(longitudes(SPREAD), 'swiss-ephemeris', NOW)
      expect(spread.thermodynamics.heat).toBeCloseTo(0.1238109, 6)
      expect(spread.thermodynamics.entropy).toBeCloseTo(0.1571734, 6)
      expect(spread.thermodynamics.reactivity).toBeCloseTo(0.6942042, 6)
      expect(spread.thermodynamics.gregsEnergy).toBeCloseTo(0.0147005, 6)
      expect(spread.kalchm).toBeCloseTo(1998.8507, 3)
      expect(spread.monica as number).toBeCloseTo(-0.0027862, 6)
      expect(signsOf(spread.bodies)).toEqual({
        Sun: 'Aries',
        Moon: 'Aries',
        Mercury: 'Aries',
        Venus: 'Aries',
        Mars: 'Aries',
        Jupiter: 'Taurus',
        Saturn: 'Taurus',
        Uranus: 'Taurus',
        Neptune: 'Taurus',
        Pluto: 'Taurus',
      })
    })

    it('stamps the source and the instant it was given', () => {
      const approx = deriveLiveSky(longitudes(), 'vsop87-approximation', NOW)
      expect(approx.source).toBe('vsop87-approximation')
      expect(deriveLiveSky(longitudes(), 'swiss-ephemeris', NOW).source).toBe('swiss-ephemeris')
      const withMillis = deriveLiveSky(
        longitudes(),
        'swiss-ephemeris',
        new Date('2026-10-15T05:43:00.123Z')
      )
      expect(withMillis.at).toBe('2026-10-15T05:43:00.123Z')
    })

    it('treats a longitude a full turn away as the same point', () => {
      const wrapped = longitudes()
      wrapped.Sun = { longitude: OCT_15.Sun[0] + 360, retrograde: false }
      wrapped.Venus = { longitude: OCT_15.Venus[0] - 360, retrograde: true }
      expect(deriveLiveSky(wrapped, 'swiss-ephemeris', NOW)).toEqual(sky)
    })

    it('accepts a body at exactly 0 degrees (a falsy longitude is still a longitude)', () => {
      const atZero = longitudes()
      atZero.Sun = { longitude: 0, retrograde: false }
      expect(deriveLiveSky(atZero, 'swiss-ephemeris', NOW).bodies.Sun.sign).toBe('Aries')
    })
  })

  describe('completeness', () => {
    it.each(SKY_BODIES)('refuses a sky without %s and names it', body => {
      const partial = longitudes() as Partial<SkyLongitudes>
      delete partial[body]
      expect(() => deriveLiveSky(partial as SkyLongitudes, 'swiss-ephemeris', NOW)).toThrow(
        new SkyUnavailableError(`The sky is incomplete (${body}); a partial chart is never rated`)
      )
    })

    it.each([
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['-Infinity', Number.NEGATIVE_INFINITY],
      ['a numeric string', '201.893'],
      ['null', null],
      ['undefined', undefined],
    ])('refuses a body whose longitude is %s', (_label, longitude) => {
      const broken = { ...longitudes(), Neptune: { longitude, retrograde: false } }
      const attempt = () => deriveLiveSky(broken as SkyLongitudes, 'swiss-ephemeris', NOW)
      expect(attempt).toThrow(SkyUnavailableError)
      expect(attempt).toThrow('The sky is incomplete (Neptune); a partial chart is never rated')
    })

    it('lists every missing body, in the order of the zodiac of bodies', () => {
      const partial = longitudes() as Partial<SkyLongitudes>
      delete partial.Pluto
      delete partial.Sun
      delete partial.Mars
      expect(() => deriveLiveSky(partial as SkyLongitudes, 'swiss-ephemeris', NOW)).toThrow(
        'The sky is incomplete (Sun, Mars, Pluto); a partial chart is never rated'
      )
    })

    it('has a name callers can match on', () => {
      const error = new SkyUnavailableError('x')
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('SkyUnavailableError')
    })
  })
})

describe('when the engine reports Monica ABSENT', () => {
  it('carries null through unchanged, never a placeholder number', async () => {
    vi.resetModules()
    vi.doMock('@/lib/thermodynamics/kalchm', async importOriginal => ({
      ...(await importOriginal<typeof import('@/lib/thermodynamics/kalchm')>()),
      calculateMonica: () => null,
    }))
    const mod = await import('@/lib/agents/rating/live-sky')
    const sky = mod.deriveLiveSky(longitudes(), 'swiss-ephemeris', NOW)
    expect(sky.monica).toBeNull()
    expect(sky.kalchm).toBeCloseTo(1767.876187, 4) // everything else is as before
    expect(sky.thermodynamics.heat).toBeCloseTo(0.131502, 6)
    const resolved = await mod.resolveLiveSky({
      now: NOW,
      fetchBackend: async () => backendPayload(),
    })
    expect(resolved.monica).toBeNull()
  })
})

describe('longitudesFromBackend', () => {
  it('accepts a payload stamped swiss-ephemeris with all ten bodies', () => {
    const parsed = longitudesFromBackend(backendPayload())
    expect(parsed?.Venus).toEqual({ longitude: 215.71, retrograde: true })
    expect(parsed?.Sun.retrograde).toBe(false)
  })

  it('returns exactly the ten bodies with their longitudes untouched', () => {
    const parsed = longitudesFromBackend(backendPayload())
    expect(parsed).toEqual(longitudes())
    expect(Object.keys(parsed ?? {})).toEqual([...SKY_BODIES])
  })

  it.each([
    ['an unstamped payload (the old circular-orbit model)', backendPayload(NO_STAMP)],
    ['a payload stamped as something else', backendPayload('circular-approximation')],
    ['null', null],
    ['a string', 'nope'],
    ['no positions', { source: 'swiss-ephemeris' }],
    ['a number', 42],
    ['true', true],
    ['undefined', undefined],
    ['an array', []],
    ['null positions', { source: 'swiss-ephemeris', planetary_positions: null }],
    ['string positions', { source: 'swiss-ephemeris', planetary_positions: 'Sun' }],
    ['array positions', { source: 'swiss-ephemeris', planetary_positions: [] }],
    ['empty positions', { source: 'swiss-ephemeris', planetary_positions: {} }],
  ])('refuses %s', (_label, raw) => {
    expect(longitudesFromBackend(raw)).toBeNull()
  })

  it.each(REFUSED_STAMPS)(
    'refuses a payload stamped with %s, with all ten bodies present',
    (_l, stamp) => {
      expect(longitudesFromBackend(payloadWithStamp(stamp))).toBeNull()
      expect(longitudesFromBackend(payloadWithStamp(stamp, SPREAD))).toBeNull()
    }
  )

  it('refuses a payload missing a body or carrying a non-finite longitude', () => {
    const missing = backendPayload() as any
    delete missing.planetary_positions.Neptune
    expect(longitudesFromBackend(missing)).toBeNull()
    const nan = backendPayload() as any
    nan.planetary_positions.Moon.exactLongitude = 'x'
    expect(longitudesFromBackend(nan)).toBeNull()
  })

  it.each(SKY_BODIES)('refuses a nine-body payload that lacks %s', body => {
    const nine = backendPayload() as any
    delete nine.planetary_positions[body]
    expect(Object.keys(nine.planetary_positions)).toHaveLength(9)
    expect(longitudesFromBackend(nine)).toBeNull()
  })

  it('refuses a body whose entry is null or an empty object', () => {
    const hollow = backendPayload() as any
    hollow.planetary_positions.Mercury = null
    expect(longitudesFromBackend(hollow)).toBeNull()
    hollow.planetary_positions.Mercury = {}
    expect(longitudesFromBackend(hollow)).toBeNull()
  })

  it('accepts an eleven-body payload and returns only the ten it knows', () => {
    const eleven = backendPayload() as any
    eleven.planetary_positions.Chiron = { exactLongitude: 'garbage', isRetrograde: true }
    expect(Object.keys(eleven.planetary_positions)).toHaveLength(11)
    const parsed = longitudesFromBackend(eleven)
    expect(parsed).toEqual(longitudes())
    expect(Object.keys(parsed ?? {})).toHaveLength(10)
    expect(parsed).not.toHaveProperty('Chiron')
  })

  it('refuses an infinite longitude, as it arrives from JSON.parse("1e999")', () => {
    const text = JSON.stringify(backendPayload())
    const plusInfinity = JSON.parse(
      text.replace('"exactLongitude":201.893', '"exactLongitude":1e999')
    )
    expect(plusInfinity.planetary_positions.Sun.exactLongitude).toBe(Number.POSITIVE_INFINITY)
    expect(longitudesFromBackend(plusInfinity)).toBeNull()
    const minusInfinity = JSON.parse(
      text.replace('"exactLongitude":303.0663', '"exactLongitude":-1e999')
    )
    expect(minusInfinity.planetary_positions.Pluto.exactLongitude).toBe(Number.NEGATIVE_INFINITY)
    expect(longitudesFromBackend(minusInfinity)).toBeNull()
    const nan = backendPayload() as any
    nan.planetary_positions.Saturn.exactLongitude = Number.NaN
    expect(longitudesFromBackend(nan)).toBeNull()
  })

  it('treats isRetrograde as retrograde only when it is exactly true', () => {
    const missing = backendPayload() as any
    delete missing.planetary_positions.Venus.isRetrograde // the table has Venus retrograde
    expect(longitudesFromBackend(missing)?.Venus).toEqual({ longitude: 215.71, retrograde: false })

    for (const loose of ['true', 1, 'yes', {}, null, undefined]) {
      const payload = backendPayload() as any
      payload.planetary_positions.Sun.isRetrograde = loose
      expect(longitudesFromBackend(payload)?.Sun.retrograde, String(loose)).toBe(false)
    }
    const strict = backendPayload() as any
    strict.planetary_positions.Sun.isRetrograde = true
    expect(longitudesFromBackend(strict)?.Sun.retrograde).toBe(true)
  })

  it('keeps a longitude of exactly 0 and does not normalise any longitude', () => {
    const odd = backendPayload() as any
    odd.planetary_positions.Sun.exactLongitude = 0
    odd.planetary_positions.Moon.exactLongitude = -5
    odd.planetary_positions.Mercury.exactLongitude = 400
    const parsed = longitudesFromBackend(odd)
    expect(parsed?.Sun.longitude).toBe(0)
    expect(parsed?.Moon.longitude).toBe(-5)
    expect(parsed?.Mercury.longitude).toBe(400)
  })
})

describe('longitudesFromLocalCalculator', () => {
  const ZONES = [
    ['Pacific/Kiritimati', -840],
    ['Pacific/Chatham', -825], // UTC+13:45 in October: not a whole hour, so minutes differ too
    ['America/Los_Angeles', 420],
    ['Asia/Kolkata', -330],
    ['UTC', 0],
  ] as const

  /** UTC instants and their calendar fields, written out by hand. */
  const INSTANTS: [string, Record<string, number>][] = [
    ['2026-10-15T05:43:00Z', { year: 2026, month: 10, day: 15, hour: 5, minute: 43, second: 0 }],
    ['2026-10-15T20:31:47Z', { year: 2026, month: 10, day: 15, hour: 20, minute: 31, second: 47 }],
    ['2026-12-31T23:59:59Z', { year: 2026, month: 12, day: 31, hour: 23, minute: 59, second: 59 }],
    ['2026-01-01T00:00:00Z', { year: 2026, month: 1, day: 1, hour: 0, minute: 0, second: 0 }],
    ['2026-03-01T00:00:01Z', { year: 2026, month: 3, day: 1, hour: 0, minute: 0, second: 1 }],
  ]

  /** The Sun's apparent longitude at the 2026 equinoxes and solstices (almanac instants, UTC). */
  const SUN_ANCHORS: [string, number][] = [
    ['2026-03-20T14:46:00Z', 0],
    ['2026-06-21T08:24:00Z', 90],
    ['2026-09-23T00:05:00Z', 180],
    ['2026-12-21T20:50:00Z', 270],
  ]

  it('matches the independent ephemeris at 2026-10-15T05:43Z to 0.2 degrees, retrograde flags included', () => {
    const local = longitudesFromLocalCalculator(NOW)
    expect(Object.keys(local)).toEqual([...SKY_BODIES])
    for (const body of SKY_BODIES) {
      const [expected, retrograde] = OCT_15[body]
      expect(angularGap(local[body].longitude, expected), body).toBeLessThan(0.2)
      expect(local[body].retrograde, `${body} retrograde`).toBe(retrograde)
    }
    // Retrograde exactly for the five outer bodies and Venus, as the table says.
    expect(SKY_BODIES.filter(b => local[b].retrograde)).toEqual([
      'Venus',
      'Saturn',
      'Uranus',
      'Neptune',
      'Pluto',
    ])
  })

  it('reports Mercury retrograde in its November 2026 retrograde, and direct in mid-October', () => {
    expect(longitudesFromLocalCalculator(new Date('2026-11-01T12:00:00Z')).Mercury.retrograde).toBe(
      true
    )
    expect(longitudesFromLocalCalculator(new Date('2026-10-15T05:43:00Z')).Mercury.retrograde).toBe(
      false
    )
    const november = longitudesFromLocalCalculator(new Date('2026-11-01T12:00:00Z'))
    expect(november.Sun.retrograde).toBe(false)
    expect(november.Moon.retrograde).toBe(false)
  })

  it('reads the calendar month and day, not a fixed one (the Sun crosses a sign each month)', async () => {
    const offline = async () => {
      throw new Error('offline')
    }
    const sunSign = async (iso: string) =>
      (await resolveLiveSky({ now: new Date(iso), fetchBackend: offline })).bodies.Sun.sign
    expect(await sunSign('2026-10-01T12:00:00Z')).toBe('Libra')
    expect(await sunSign('2026-10-15T12:00:00Z')).toBe('Libra')
    expect(await sunSign('2026-10-31T12:00:00Z')).toBe('Scorpio')
    expect(await sunSign('2026-11-15T12:00:00Z')).toBe('Scorpio')
    expect(await sunSign('2026-11-30T12:00:00Z')).toBe('Sagittarius')
    expect(await sunSign('2026-12-31T23:59:59Z')).toBe('Capricorn')
  })

  it('gives the Sun at the equinoxes and solstices where the almanac says', () => {
    for (const [iso, expected] of SUN_ANCHORS) {
      const { Sun } = longitudesFromLocalCalculator(new Date(iso))
      expect(angularGap(Sun.longitude, expected), iso).toBeLessThan(0.02)
    }
  })

  describe.each(ZONES)('with the machine clock in %s', (zone, offsetMinutes) => {
    beforeEach(() => {
      process.env.TZ = zone
    })

    it('is really running in that zone', () => {
      expect(NOW.getTimezoneOffset(), 'needs vitest --pool=forks (the default)').toBe(offsetMinutes)
    })

    it.each(INSTANTS)(
      'gives the same sky for the UTC instant %s as the calculator does for its UTC fields',
      (iso, parts) => {
        const expected = calculateAllPlanets({ ...parts, latitude: 0, longitude: 0 } as never)
        const actual = longitudesFromLocalCalculator(new Date(iso))
        for (const body of SKY_BODIES) {
          expect(actual[body].longitude, `${iso} ${body}`).toBe(expected.planets[body].longitude)
          expect(actual[body].retrograde, `${iso} ${body}`).toBe(
            Boolean(expected.planets[body].retrograde)
          )
        }
      }
    )

    it('keeps the Sun on the almanac, and the 2026-10-15 sky on the ephemeris', () => {
      for (const [iso, expected] of SUN_ANCHORS) {
        const { Sun } = longitudesFromLocalCalculator(new Date(iso))
        expect(angularGap(Sun.longitude, expected), iso).toBeLessThan(0.02)
      }
      const local = longitudesFromLocalCalculator(NOW)
      for (const body of SKY_BODIES) {
        expect(angularGap(local[body].longitude, OCT_15[body][0]), body).toBeLessThan(0.2)
        expect(local[body].retrograde, body).toBe(OCT_15[body][1])
      }
    })

    it('hands the calculator the UTC calendar fields at the geocentre', async () => {
      const calls: unknown[] = []
      const mod = await loadWithCalculator(input => {
        calls.push(input)
        return fullChart()
      })
      const cases: [string, Record<string, number>][] = [
        ...INSTANTS,
        [
          '1850-06-15T12:00:30Z',
          { year: 1850, month: 6, day: 15, hour: 12, minute: 0, second: 30 },
        ],
        ['2024-02-29T13:07:09Z', { year: 2024, month: 2, day: 29, hour: 13, minute: 7, second: 9 }],
      ]
      for (const [iso, parts] of cases) {
        calls.length = 0
        mod.longitudesFromLocalCalculator(new Date(iso))
        expect(calls, iso).toEqual([{ ...parts, latitude: 0, longitude: 0 }])
      }
    })
  })

  describe('when the calculator withholds or garbles a body', () => {
    it('names every missing body in the error', async () => {
      const mod = await loadWithCalculator(() => ({
        planets: { Sun: { longitude: 10, retrograde: false } },
      }))
      const error = thrownBy(() => mod.longitudesFromLocalCalculator(NOW))
      expect(error).toBeInstanceOf(mod.SkyUnavailableError)
      expect(error.message).toBe(INCOMPLETE_BUT_SUN)
    })

    it.each([
      ['an undefined position', undefined],
      ['a null position', null],
      ['a NaN longitude', { longitude: Number.NaN, retrograde: false }],
      ['an infinite longitude', { longitude: Number.POSITIVE_INFINITY, retrograde: false }],
      ['a string longitude', { longitude: '12', retrograde: false }],
      ['an undefined longitude', { retrograde: false }],
    ])('treats %s for Moon as a missing body', async (_label, position) => {
      const mod = await loadWithCalculator(() => fullChart({ Moon: position }))
      expect(() => mod.longitudesFromLocalCalculator(NOW)).toThrow(
        'The sky is incomplete (Moon); a partial chart is never rated'
      )
    })

    it('reads the retrograde flag as a boolean, and passes longitudes through untouched', async () => {
      const mod = await loadWithCalculator(() =>
        fullChart({
          Sun: { longitude: 0, retrograde: undefined },
          Moon: { longitude: 12.5, retrograde: 1 },
          Mercury: { longitude: 400, retrograde: 'yes' },
          Venus: { longitude: -3, retrograde: 0 },
          Mars: { longitude: 129.7684, retrograde: null },
        })
      )
      const local = mod.longitudesFromLocalCalculator(NOW)
      expect(local.Sun).toEqual({ longitude: 0, retrograde: false })
      expect(local.Moon).toEqual({ longitude: 12.5, retrograde: true })
      expect(local.Mercury).toEqual({ longitude: 400, retrograde: true })
      expect(local.Venus).toEqual({ longitude: -3, retrograde: false })
      expect(local.Mars).toEqual({ longitude: 129.7684, retrograde: false })
      expect(local.Saturn).toEqual({ longitude: 10.4673, retrograde: true })
    })
  })
})

/** A calculator result carrying all ten bodies of OCT_15, with optional per-body overrides. */
function fullChart(overrides: Record<string, unknown> = {}) {
  return {
    planets: {
      ...Object.fromEntries(
        SKY_BODIES.map(b => [b, { longitude: OCT_15[b][0], retrograde: OCT_15[b][1] }])
      ),
      ...overrides,
    },
  }
}

/** A fresh live-sky whose local calculator is replaced; undone by the file-level afterEach. */
async function loadWithCalculator(calculate: (input: unknown) => unknown) {
  vi.resetModules()
  vi.doMock('@/lib/enhanced-astronomical-calculator', async importOriginal => ({
    ...(await importOriginal<typeof import('@/lib/enhanced-astronomical-calculator')>()),
    calculateAllPlanets: calculate,
  }))
  return import('@/lib/agents/rating/live-sky')
}

describe('resolveLiveSky', () => {
  it('uses the Swiss-stamped backend sky when it answers', async () => {
    const sky = await resolveLiveSky({ now: NOW, fetchBackend: async () => backendPayload() })
    expect(sky.source).toBe('swiss-ephemeris')
    expect(sky.bodies.Sun.sign).toBe('Libra')
  })

  it('takes the positions from the backend payload, not from the local calculator', async () => {
    const sky = await resolveLiveSky({
      now: NOW,
      fetchBackend: async () => backendPayload('swiss-ephemeris', SPREAD),
    })
    expect(sky.source).toBe('swiss-ephemeris')
    expect(sky.at).toBe('2026-10-15T05:43:00.000Z')
    expect(sky.bodies.Sun.sign).toBe('Aries') // the real Sun is in Libra
    expect(sky.bodies.Jupiter.sign).toBe('Taurus') // the real Jupiter is in Leo
    expect(sky).toEqual(deriveLiveSky(longitudes(SPREAD), 'swiss-ephemeris', NOW))
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

  describe('the labelled local fallback', () => {
    it.each(REFUSED_STAMPS)(
      'never relabels a payload stamped with %s as Swiss, and does not use its positions',
      async (_label, stamp) => {
        const sky = await resolveLiveSky({
          now: NOW,
          fetchBackend: async () => payloadWithStamp(stamp, SPREAD),
        })
        expect(sky.source).toBe('vsop87-approximation')
        expect(signsOf(sky.bodies)).toEqual(OCT_15_SIGNS)
      }
    )

    it('is the local calculator’s sky, run through the same engine as the Swiss one', async () => {
      const swiss = deriveLiveSky(longitudes(), 'swiss-ephemeris', NOW)
      const sky = await resolveLiveSky({ now: NOW, fetchBackend: async () => null })
      expect(sky.source).toBe('vsop87-approximation')
      expect(sky.at).toBe('2026-10-15T05:43:00.000Z')
      expect(signsOf(sky.bodies)).toEqual(OCT_15_SIGNS)
      // Same signs, hence the same ESMS totals, hence the same derived quantities.
      expect(sky.thermodynamics).toEqual(swiss.thermodynamics)
      expect(sky.kalchm).toBe(swiss.kalchm)
      expect(sky.monica).toBe(swiss.monica)
      expect(sky).toEqual({ ...swiss, source: 'vsop87-approximation' })
    })

    it('falls back when fetchBackend throws before returning a promise', async () => {
      const sky = await resolveLiveSky({
        now: NOW,
        fetchBackend: () => {
          throw new Error('synchronous failure')
        },
      })
      expect(sky.source).toBe('vsop87-approximation')
    })

    it('falls back from a nine-body payload and uses an eleven-body one', async () => {
      const nine = backendPayload('swiss-ephemeris', SPREAD) as any
      delete nine.planetary_positions.Pluto
      const fallback = await resolveLiveSky({ now: NOW, fetchBackend: async () => nine })
      expect(fallback.source).toBe('vsop87-approximation')
      expect(signsOf(fallback.bodies)).toEqual(OCT_15_SIGNS)

      const eleven = backendPayload('swiss-ephemeris', SPREAD) as any
      eleven.planetary_positions.Chiron = { exactLongitude: 50, isRetrograde: false }
      const used = await resolveLiveSky({ now: NOW, fetchBackend: async () => eleven })
      expect(used.source).toBe('swiss-ephemeris')
      expect(Object.keys(used.bodies)).toHaveLength(10)
      expect(used.bodies).not.toHaveProperty('Chiron')
      expect(used.bodies.Sun.sign).toBe('Aries')
    })

    it('falls back from a payload carrying an infinite longitude', async () => {
      const text = JSON.stringify(backendPayload('swiss-ephemeris', SPREAD)).replace(
        '"exactLongitude":15,',
        '"exactLongitude":1e999,'
      )
      const infinite = JSON.parse(text)
      expect(infinite.planetary_positions.Sun.exactLongitude).toBe(Number.POSITIVE_INFINITY)
      const sky = await resolveLiveSky({ now: NOW, fetchBackend: async () => infinite })
      expect(sky.source).toBe('vsop87-approximation')
      expect(sky.bodies.Sun.sign).toBe('Libra')
    })
  })

  describe('when neither source can give a sky', () => {
    it('passes the incomplete-sky error through unwrapped', async () => {
      const mod = await loadWithCalculator(() => ({
        planets: { Sun: { longitude: 10, retrograde: false } },
      }))
      const error = await rejectionOf(
        mod.resolveLiveSky({ now: NOW, fetchBackend: async () => null })
      )
      expect(error).toBeInstanceOf(mod.SkyUnavailableError)
      expect(error.message).toBe(INCOMPLETE_BUT_SUN)
    })

    // The text reaches anonymous callers as `degraded.sky`, so it is fixed: whatever the
    // calculator said (a path, a connection string, a stack fragment) stays out of it.
    const FIXED = 'No sky could be computed'

    it('wraps a calculator failure in SkyUnavailableError with a fixed message, not the cause', async () => {
      const mod = await loadWithCalculator(() => {
        throw new RangeError('year 99999 is out of range')
      })
      const error = await rejectionOf(
        mod.resolveLiveSky({ now: NOW, fetchBackend: async () => null })
      )
      expect(error).toBeInstanceOf(mod.SkyUnavailableError)
      expect(error.name).toBe('SkyUnavailableError')
      expect(error.message).toBe(FIXED)
      expect(error.message).not.toContain('99999')
      expect(error.message).not.toContain('out of range')
      expect(error.message).not.toContain(':')
    })

    it('keeps the original failure on cause, for the caller’s own log', async () => {
      const original = new RangeError('year 99999 is out of range')
      const mod = await loadWithCalculator(() => {
        throw original
      })
      const error = await rejectionOf(
        mod.resolveLiveSky({ now: NOW, fetchBackend: async () => null })
      )
      expect(error.cause).toBe(original)
    })

    it('wraps a thrown non-Error with the same fixed message, not its string form', async () => {
      const thrown: unknown = 'boom'
      const mod = await loadWithCalculator(() => {
        throw thrown
      })
      const error = await rejectionOf(
        mod.resolveLiveSky({ now: NOW, fetchBackend: async () => null })
      )
      expect(error).toBeInstanceOf(mod.SkyUnavailableError)
      expect(error.message).toBe(FIXED)
      expect(error.message).not.toContain('boom')
    })

    it('wraps a calculator that returns no planets at all, without the TypeError it provokes', async () => {
      const mod = await loadWithCalculator(() => ({}))
      const error = await rejectionOf(
        mod.resolveLiveSky({ now: NOW, fetchBackend: async () => null })
      )
      expect(error).toBeInstanceOf(mod.SkyUnavailableError)
      expect(error.message).toBe(FIXED)
      expect(error.message).not.toMatch(/undefined|Cannot read|reading/)
    })

    it('does not carry a secret-bearing cause into the message', async () => {
      const leak = 'postgres://svc:hunter2@db.internal:5432/ephemeris'
      const mod = await loadWithCalculator(() => {
        throw new Error(`connect failed for ${leak}`)
      })
      const error = await rejectionOf(
        mod.resolveLiveSky({ now: NOW, fetchBackend: async () => null })
      )
      expect(error.message).toBe(FIXED)
      for (const piece of [leak, 'hunter2', 'db.internal', 'connect failed'])
        expect(error.message).not.toContain(piece)
      expect(`${error}`).toBe(`SkyUnavailableError: ${FIXED}`)
    })

    it('words the fixed message the same whatever was thrown', async () => {
      const messages: string[] = []
      for (const thrown of [new Error('a'), new TypeError('b'), 'c', 42, null, undefined]) {
        const mod = await loadWithCalculator(() => {
          throw thrown
        })
        const error = await rejectionOf(
          mod.resolveLiveSky({ now: NOW, fetchBackend: async () => null })
        )
        expect(error).toBeInstanceOf(mod.SkyUnavailableError)
        messages.push(error.message)
      }
      expect(messages).toEqual(new Array(6).fill(FIXED))
    })

    it('still names the missing bodies when the calculator answers with an incomplete chart', async () => {
      // The one message that is not fixed: it carries body names only, never a cause.
      const mod = await loadWithCalculator(() => ({
        planets: { Sun: { longitude: 10, retrograde: false } },
      }))
      const error = await rejectionOf(
        mod.resolveLiveSky({ now: NOW, fetchBackend: async () => null })
      )
      expect(error.message).toBe(INCOMPLETE_BUT_SUN)
      expect(error.message).not.toBe(FIXED)
    })

    it('never answers for an invalid instant, even with a Swiss payload in hand', async () => {
      const attempt = resolveLiveSky({
        now: new Date(Number.NaN),
        fetchBackend: async () => backendPayload(),
      })
      await expect(attempt).rejects.toThrow(SkyUnavailableError)
      const error = await rejectionOf(
        resolveLiveSky({ now: new Date(Number.NaN), fetchBackend: async () => backendPayload() })
      )
      expect(error.message).toMatch(/^(The sky is incomplete \(|No sky could be computed$)/)
      expect(error.message).not.toContain('Invalid time value')
    })
  })

  describe('timing', () => {
    const hang = () => new Promise<never>(() => {})

    it('leaves no timer behind after a backend answer', async () => {
      fakeClock()
      const sky = await resolveLiveSky({ now: NOW, fetchBackend: async () => backendPayload() })
      expect(sky.source).toBe('swiss-ephemeris')
      expect(vi.getTimerCount()).toBe(0)
    })

    it('leaves no timer behind after a refused payload or a rejected fetch', async () => {
      fakeClock()
      await resolveLiveSky({ now: NOW, fetchBackend: async () => backendPayload(NO_STAMP) })
      expect(vi.getTimerCount()).toBe(0)
      await resolveLiveSky({
        now: NOW,
        fetchBackend: async () => {
          throw new Error('ECONNRESET')
        },
      })
      expect(vi.getTimerCount()).toBe(0)
    })

    it('gives up on a hung backend after exactly timeoutMs, and then leaves no timer', async () => {
      fakeClock()
      let settled = false
      const run = resolveLiveSky({ now: NOW, timeoutMs: 250, fetchBackend: hang }).then(sky => {
        settled = true
        return sky
      })
      await vi.advanceTimersByTimeAsync(249)
      expect(settled).toBe(false)
      expect(vi.getTimerCount()).toBe(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(settled).toBe(true)
      expect((await run).source).toBe('vsop87-approximation')
      expect(vi.getTimerCount()).toBe(0)
    })

    it('waits 4000 ms by default', async () => {
      fakeClock()
      let settled = false
      const run = resolveLiveSky({ now: NOW, fetchBackend: hang }).then(sky => {
        settled = true
        return sky
      })
      await vi.advanceTimersByTimeAsync(3999)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(settled).toBe(true)
      expect((await run).source).toBe('vsop87-approximation')
      expect(vi.getTimerCount()).toBe(0)
    })

    it('honours a timeoutMs of 0 as "do not wait"', async () => {
      fakeClock()
      let settled = false
      const run = resolveLiveSky({ now: NOW, timeoutMs: 0, fetchBackend: hang }).then(sky => {
        settled = true
        return sky
      })
      await vi.advanceTimersByTimeAsync(0)
      expect(settled).toBe(true)
      expect((await run).source).toBe('vsop87-approximation')
    })

    it('uses the current time when no instant is given', async () => {
      fakeClock()
      vi.setSystemTime(new Date('2026-10-15T05:43:00Z'))
      const sky = await resolveLiveSky({ fetchBackend: async () => backendPayload() })
      expect(sky.at).toBe('2026-10-15T05:43:00.000Z')
      const local = await resolveLiveSky({ fetchBackend: async () => null })
      expect(local.at).toBe('2026-10-15T05:43:00.000Z')
      expect(signsOf(local.bodies)).toEqual(OCT_15_SIGNS)
    })
  })

  describe('the default backend fetch (no fetchBackend injected)', () => {
    const SECRET = 'dummy-secret-for-tests'
    const AGENTS = 'https://api.agents.alchm.kitchen'
    const WTEN = 'https://whattoeatnext-production.up.railway.app'

    const fetchMock = vi.fn()
    const reply = (body: unknown, init: { ok?: boolean; status?: number } = {}) => ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      statusText: init.ok === false ? 'Failure' : 'OK',
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    })
    const sentHeaders = (init: RequestInit): Record<string, string> =>
      Object.fromEntries(
        Object.entries((init.headers ?? {}) as Record<string, string>).map(([name, value]) => [
          name.toLowerCase(),
          value,
        ])
      )

    /** A fresh live-sky (and lib/backend) reading the environment as set here. */
    async function load(overrides: Record<string, string> = {}) {
      vi.resetModules()
      fetchMock.mockReset()
      vi.stubGlobal('fetch', fetchMock)
      vi.stubEnv('INTERNAL_API_SECRET', SECRET)
      for (const name of ['NEXT_PUBLIC_BACKEND_URL', 'BACKEND_URL', 'NEXT_PUBLIC_WTEN_BACKEND_URL'])
        vi.stubEnv(name, '')
      for (const [name, value] of Object.entries(overrides)) vi.stubEnv(name, value)
      const mod = await import('@/lib/agents/rating/live-sky')
      await import('@/lib/backend') // warm the module cache, so the lazy import is instant
      return mod
    }

    it('asks the agents backend for /planetary/current, anonymously, and trusts a Swiss stamp', async () => {
      const mod = await load()
      pinClockAt(NOW) // inside the window, so the default backend is consulted at all
      fetchMock.mockResolvedValue(reply(backendPayload('swiss-ephemeris', SPREAD)))
      const sky = await mod.resolveLiveSky({ now: NOW })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe(`${AGENTS}/planetary/current`)
      expect(url.startsWith('https://api.agents.alchm.kitchen/planetary/current')).toBe(true)
      expect(url).not.toContain('whattoeatnext')
      expect(init.method).toBe('GET')

      const headers = sentHeaders(init)
      expect(
        Object.keys(headers).filter(name => /secret|authorization|token|key/.test(name))
      ).toEqual([])
      expect(JSON.stringify(init.headers)).not.toContain(SECRET)

      expect(sky.source).toBe('swiss-ephemeris')
      expect(sky.bodies.Sun.sign).toBe('Aries') // from the payload, not the local calculator
    })

    it('control: the WTEN client does send the secret, to the WTEN host', async () => {
      await load()
      const { backend } = await import('@/lib/backend')
      fetchMock.mockResolvedValue(reply(payloadWithStamp('pyswisseph')))
      await backend.planetary.current()
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe(`${WTEN}/planetary/current`)
      expect(sentHeaders(init).internal_api_secret).toBe(SECRET)
    })

    it('answers with the labelled local sky when the WTEN shape (pyswisseph) comes back', async () => {
      const mod = await load()
      pinClockAt(NOW)
      fetchMock.mockResolvedValue(reply(payloadWithStamp('pyswisseph', SPREAD)))
      const sky = await mod.resolveLiveSky({ now: NOW })
      // It was asked (else the fallback below would prove nothing about the stamp) ...
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toBe(`${AGENTS}/planetary/current`)
      // ... and refused.
      expect(sky.source).toBe('vsop87-approximation')
      expect(signsOf(sky.bodies)).toEqual(OCT_15_SIGNS)
    })

    it('follows the agents base-URL overrides and never the WTEN one', async () => {
      const mod = await load({
        NEXT_PUBLIC_BACKEND_URL: 'https://agents.example.test',
        BACKEND_URL: 'https://agents-fallback.example.test',
        NEXT_PUBLIC_WTEN_BACKEND_URL: 'https://wten.example.test',
      })
      pinClockAt(NOW)
      fetchMock.mockResolvedValue(reply(backendPayload()))
      await mod.resolveLiveSky({ now: NOW })
      expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
        'https://agents.example.test/planetary/current',
      ])

      const fallback = await load({
        BACKEND_URL: 'https://agents-fallback.example.test',
        NEXT_PUBLIC_WTEN_BACKEND_URL: 'https://wten.example.test',
      })
      pinClockAt(NOW)
      fetchMock.mockResolvedValue(reply(backendPayload()))
      await fallback.resolveLiveSky({ now: NOW })
      expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
        'https://agents-fallback.example.test/planetary/current',
      ])
    })

    it.each([
      ['a network error', () => Promise.reject(new TypeError('fetch failed'))],
      ['HTTP 503', () => Promise.resolve(reply('unavailable', { ok: false, status: 503 }))],
      ['HTTP 404', () => Promise.resolve(reply('not found', { ok: false, status: 404 }))],
      [
        'a 200 whose body is not JSON',
        () =>
          Promise.resolve({
            ...reply(null),
            json: async () => {
              throw new SyntaxError('Unexpected token < in JSON')
            },
          }),
      ],
      ['a 200 carrying null', () => Promise.resolve(reply(null))],
      [
        'a 200 carrying the unstamped legacy payload',
        () => Promise.resolve(reply(backendPayload(NO_STAMP, SPREAD))),
      ],
    ])(
      'falls back to the local sky on %s, and leaves no pending timer',
      async (_label, respond) => {
        const mod = await load()
        fakeClockAt(NOW)
        fetchMock.mockImplementation(respond)
        const sky = await mod.resolveLiveSky({ now: NOW })
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(sky.source).toBe('vsop87-approximation')
        expect(signsOf(sky.bodies)).toEqual(OCT_15_SIGNS)
        expect(vi.getTimerCount()).toBe(0)
      }
    )

    it('stops waiting on a hung request after timeoutMs, then the request’s own timer is the only one left', async () => {
      const mod = await load()
      fakeClockAt(NOW)
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            )
          })
      )
      let settled = false
      const run = mod.resolveLiveSky({ now: NOW, timeoutMs: 100 }).then(sky => {
        settled = true
        return sky
      })
      await vi.advanceTimersByTimeAsync(99)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(settled).toBe(true)
      const sky = await run
      expect(sky.source).toBe('vsop87-approximation')
      expect(signsOf(sky.bodies)).toEqual(OCT_15_SIGNS)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      // lib/backend aborts the abandoned request itself after 10 s; nothing else is pending.
      await vi.advanceTimersByTimeAsync(10_000)
      expect(vi.getTimerCount()).toBe(0)
    })

    /**
     * `/planetary/current` serves the sky as it is right now, so the default fetch is asked only
     * while `now` is within BACKEND_SKY_TOLERANCE_MS (300 000 ms, inclusive) of the real clock;
     * anything else would stamp today's positions with another instant. A caller that injects its
     * own `fetchBackend` vouches for it and is always asked.
     */
    describe('the default backend answers for the present only', () => {
      const CLOCK = new Date('2026-10-15T05:43:00Z')
      const aroundClock = (offsetMs: number) => new Date(CLOCK.getTime() + offsetMs)
      const swissSpread = () => reply(backendPayload('swiss-ephemeris', SPREAD))
      /** The Swiss sky the stubbed backend serves (SPREAD), as the module labels it at `now`. */
      const backendSkyAt = (now: Date) => deriveLiveSky(longitudes(SPREAD), 'swiss-ephemeris', now)
      /** The labelled local sky for `now`, derived from the calculator's longitudes for `now`. */
      const localSkyAt = (now: Date) =>
        deriveLiveSky(longitudesFromLocalCalculator(now), 'vsop87-approximation', now)

      it('is exactly five minutes, written as 300000 ms', () => {
        expect(BACKEND_SKY_TOLERANCE_MS).toBe(300_000)
        expect(BACKEND_SKY_TOLERANCE_MS).toBe(5 * 60 * 1000)
      })

      it.each([
        ['the same instant', 0],
        ['4:59 behind the clock', -299_000],
        ['4:59 ahead of the clock', 299_000],
        ['1 ms inside the edge, behind', -299_999],
        ['1 ms inside the edge, ahead', 299_999],
        ['exactly 5:00 behind the clock (inclusive)', -300_000],
        ['exactly 5:00 ahead of the clock (inclusive)', 300_000],
      ])('asks the backend when now is %s', async (_label, offsetMs) => {
        const mod = await load()
        pinClockAt(CLOCK)
        fetchMock.mockResolvedValue(swissSpread())
        const now = aroundClock(offsetMs)

        const sky = await mod.resolveLiveSky({ now })

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock.mock.calls[0][0]).toBe(`${AGENTS}/planetary/current`)
        expect(sky.source).toBe('swiss-ephemeris')
        expect(sky.at).toBe(now.toISOString())
        expect(sky.bodies.Sun.sign).toBe('Aries') // the payload's Sun, not the real Libra one
        expect(sky).toEqual(backendSkyAt(now))
      })

      it.each([
        ['5:00.001 behind the clock', -300_001],
        ['5:00.001 ahead of the clock', 300_001],
        ['a minute past the edge, behind', -360_000],
        ['a minute past the edge, ahead', 360_000],
        ['an hour ahead', 3_600_000],
        ['an hour behind', -3_600_000],
      ])(
        'does not ask the backend at all when now is %s, and labels the local sky for now',
        async (_label, offsetMs) => {
          const mod = await load()
          pinClockAt(CLOCK)
          fetchMock.mockResolvedValue(swissSpread())
          const now = aroundClock(offsetMs)

          const sky = await mod.resolveLiveSky({ now })

          expect(fetchMock).toHaveBeenCalledTimes(0)
          expect(sky.source).toBe('vsop87-approximation')
          expect(sky.at).toBe(now.toISOString())
          expect(signsOf(sky.bodies)).toEqual(OCT_15_SIGNS) // the real sky, never the stub's
          expect(sky).toEqual(localSkyAt(now))
        }
      )

      it('keeps the local sky for a day away exactly what the local calculator derives', async () => {
        const mod = await load()
        pinClockAt(CLOCK)
        fetchMock.mockResolvedValue(swissSpread())
        for (const offsetMs of [86_400_000, -86_400_000, 30 * 86_400_000]) {
          const now = aroundClock(offsetMs)
          const sky = await mod.resolveLiveSky({ now })
          expect(sky.source, String(offsetMs)).toBe('vsop87-approximation')
          expect(sky.at, String(offsetMs)).toBe(now.toISOString())
          expect(sky, String(offsetMs)).toEqual(localSkyAt(now))
        }
        expect(fetchMock).toHaveBeenCalledTimes(0)
      })

      it('uses the local calculator for 2020, never the backend, and the sky is the one of that day', async () => {
        const mod = await load()
        pinClockAt(CLOCK)
        fetchMock.mockResolvedValue(swissSpread())

        const sky = await mod.resolveLiveSky({ now: JULY_2020_NOW })

        expect(fetchMock).toHaveBeenCalledTimes(0)
        expect(sky.source).toBe('vsop87-approximation')
        expect(sky.at).toBe('2020-07-01T12:00:00.000Z')
        expectJuly2020Signs(sky.bodies)
        expect(sky).toEqual(localSkyAt(JULY_2020_NOW))
        expect(sky.thermodynamics).not.toEqual(backendSkyAt(JULY_2020_NOW).thermodynamics)
      })

      it('does the same for an instant years ahead', async () => {
        const mod = await load()
        pinClockAt(CLOCK)
        fetchMock.mockResolvedValue(swissSpread())
        const now = new Date('2035-03-01T00:00:00Z')
        const sky = await mod.resolveLiveSky({ now })
        expect(fetchMock).toHaveBeenCalledTimes(0)
        expect(sky.source).toBe('vsop87-approximation')
        expect(sky.at).toBe('2035-03-01T00:00:00.000Z')
        expect(sky).toEqual(localSkyAt(now))
      })

      it('does not ask the backend for an invalid instant, and never answers for one', async () => {
        const mod = await load()
        pinClockAt(CLOCK)
        fetchMock.mockResolvedValue(swissSpread())
        const error = await rejectionOf(mod.resolveLiveSky({ now: new Date(Number.NaN) }))
        expect(fetchMock).toHaveBeenCalledTimes(0)
        expect(error).toBeInstanceOf(mod.SkyUnavailableError)
      })

      it('does not wait or start a timer for an instant outside the window, however the backend would behave', async () => {
        const mod = await load()
        fakeClockAt(CLOCK)
        fetchMock.mockImplementation(() => new Promise(() => {})) // would hang, if it were asked
        let settled = false
        const run = mod.resolveLiveSky({ now: aroundClock(400_000) }).then(sky => {
          settled = true
          return sky
        })
        await vi.advanceTimersByTimeAsync(0) // no time passes, yet the answer is already there
        expect(settled).toBe(true)
        expect((await run).source).toBe('vsop87-approximation')
        expect(fetchMock).toHaveBeenCalledTimes(0)
        expect(vi.getTimerCount()).toBe(0)
      })

      it('asks the backend when no instant is given, because now is the real clock', async () => {
        const mod = await load()
        pinClockAt(CLOCK)
        fetchMock.mockResolvedValue(swissSpread())

        const sky = await mod.resolveLiveSky()
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(sky.source).toBe('swiss-ephemeris')
        expect(sky.at).toBe('2026-10-15T05:43:00.000Z')
        expect(sky.bodies.Sun.sign).toBe('Aries')

        const empty = await mod.resolveLiveSky({})
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(empty.source).toBe('swiss-ephemeris')

        const withTimeout = await mod.resolveLiveSky({ timeoutMs: 1000 })
        expect(fetchMock).toHaveBeenCalledTimes(3)
        expect(withTimeout.at).toBe('2026-10-15T05:43:00.000Z')
      })

      it('falls back to the local sky for the real clock when no instant is given and the backend is unstamped', async () => {
        const mod = await load()
        pinClockAt(CLOCK)
        fetchMock.mockResolvedValue(reply(backendPayload(NO_STAMP, SPREAD)))
        const sky = await mod.resolveLiveSky()
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(sky.source).toBe('vsop87-approximation')
        expect(sky.at).toBe('2026-10-15T05:43:00.000Z')
        expect(signsOf(sky.bodies)).toEqual(OCT_15_SIGNS)
      })

      it('measures the window from the real clock, not from a fixed date', async () => {
        const mod = await load()
        const later = new Date('2030-01-01T00:00:00Z')
        pinClockAt(later)
        fetchMock.mockResolvedValue(swissSpread())

        // 2026-10-15 was inside the window when the clock stood there; it is not now.
        await mod.resolveLiveSky({ now: CLOCK })
        expect(fetchMock).toHaveBeenCalledTimes(0)

        const near = new Date(later.getTime() + 299_000)
        const sky = await mod.resolveLiveSky({ now: near })
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(sky.source).toBe('swiss-ephemeris')
        expect(sky.at).toBe('2030-01-01T00:04:59.000Z')

        const omitted = await mod.resolveLiveSky()
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(omitted.at).toBe('2030-01-01T00:00:00.000Z')
      })

      it('judges the window when the call starts, not when the backend answers', async () => {
        const mod = await load()
        fakeClockAt(CLOCK)
        // Answers after 3 s: the clock then reads 3 s later, which must not matter to `at`.
        fetchMock.mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve(swissSpread()), 3000))
        )
        const now = aroundClock(299_000)
        const run = mod.resolveLiveSky({ now })
        await vi.advanceTimersByTimeAsync(3000)
        const sky = await run
        expect(sky.source).toBe('swiss-ephemeris')
        expect(sky.at).toBe(now.toISOString())
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })

      it('falls back inside the window when the backend is refused, to the local sky for now', async () => {
        const mod = await load()
        pinClockAt(CLOCK)
        const now = aroundClock(299_000)
        for (const respond of [
          () => Promise.resolve(reply(backendPayload(NO_STAMP, SPREAD))),
          () => Promise.resolve(reply(payloadWithStamp('pyswisseph', SPREAD))),
          () => Promise.reject(new TypeError('fetch failed')),
        ]) {
          fetchMock.mockReset()
          fetchMock.mockImplementation(respond)
          const sky = await mod.resolveLiveSky({ now })
          expect(fetchMock).toHaveBeenCalledTimes(1)
          expect(sky.source).toBe('vsop87-approximation')
          expect(sky.at).toBe(now.toISOString())
          expect(sky).toEqual(localSkyAt(now))
        }
      })

      describe('an injected fetchBackend', () => {
        it('is not "injected" when it is null: the default is used, so a stale now still skips the backend', async () => {
          const mod = await load()
          pinClockAt(CLOCK)
          const sky = await mod.resolveLiveSky({
            now: JULY_2020_NOW,
            fetchBackend: null as unknown as undefined,
          })
          expect(fetchMock).toHaveBeenCalledTimes(0)
          expect(sky.source).toBe('vsop87-approximation')
          expect(sky.at).toBe('2020-07-01T12:00:00.000Z')
        })

        it('is always called, even for 2020, and its Swiss payload is labelled swiss for that instant', async () => {
          const mod = await load()
          pinClockAt(CLOCK)
          const injected = vi.fn(async () => backendPayload('swiss-ephemeris', SPREAD))

          const sky = await mod.resolveLiveSky({ now: JULY_2020_NOW, fetchBackend: injected })

          expect(injected).toHaveBeenCalledTimes(1)
          expect(fetchMock).toHaveBeenCalledTimes(0) // the default backend is never involved
          expect(sky.source).toBe('swiss-ephemeris')
          expect(sky.at).toBe('2020-07-01T12:00:00.000Z')
          expect(sky.bodies.Sun.sign).toBe('Aries')
          expect(sky).toEqual(backendSkyAt(JULY_2020_NOW))
        })

        it.each([
          ['the same instant', 0],
          ['an hour away', 3_600_000],
          ['5:00.001 away', 300_001],
          ['a year behind', -365 * 86_400_000],
          ['ten years ahead', 3650 * 86_400_000],
        ])('is called when now is %s', async (_label, offsetMs) => {
          const mod = await load()
          pinClockAt(CLOCK)
          const injected = vi.fn(async () => backendPayload('swiss-ephemeris', SPREAD))
          const now = aroundClock(offsetMs)
          const sky = await mod.resolveLiveSky({ now, fetchBackend: injected })
          expect(injected).toHaveBeenCalledTimes(1)
          expect(fetchMock).toHaveBeenCalledTimes(0)
          expect(sky.source).toBe('swiss-ephemeris')
          expect(sky.at).toBe(now.toISOString())
        })

        it('falls back to the local sky for that instant when it throws, returns null, or is unstamped', async () => {
          const mod = await load()
          pinClockAt(CLOCK)
          for (const injected of [
            vi.fn(async () => {
              throw new Error('ECONNREFUSED')
            }),
            vi.fn(async () => null),
            vi.fn(async () => backendPayload(NO_STAMP, SPREAD)),
            vi.fn(async () => payloadWithStamp('pyswisseph', SPREAD)),
          ]) {
            const sky = await mod.resolveLiveSky({ now: JULY_2020_NOW, fetchBackend: injected })
            expect(injected).toHaveBeenCalledTimes(1)
            expect(sky.source).toBe('vsop87-approximation')
            expect(sky.at).toBe('2020-07-01T12:00:00.000Z')
            expectJuly2020Signs(sky.bodies)
            expect(sky).toEqual(localSkyAt(JULY_2020_NOW))
          }
          expect(fetchMock).toHaveBeenCalledTimes(0)
        })

        it('is still given only timeoutMs to answer, however far from the clock now is', async () => {
          const mod = await load()
          fakeClockAt(CLOCK)
          const injected = vi.fn(() => new Promise<never>(() => {}))
          let settled = false
          const run = mod
            .resolveLiveSky({ now: JULY_2020_NOW, timeoutMs: 250, fetchBackend: injected })
            .then(sky => {
              settled = true
              return sky
            })
          await vi.advanceTimersByTimeAsync(249)
          expect(settled).toBe(false)
          expect(injected).toHaveBeenCalledTimes(1)
          await vi.advanceTimersByTimeAsync(1)
          expect(settled).toBe(true)
          const sky = await run
          expect(sky.source).toBe('vsop87-approximation')
          expect(sky.at).toBe('2020-07-01T12:00:00.000Z')
          expect(vi.getTimerCount()).toBe(0)
        })

        it('does not count as injected when it is explicitly undefined', async () => {
          const mod = await load()
          pinClockAt(CLOCK)
          fetchMock.mockResolvedValue(swissSpread())

          const far = await mod.resolveLiveSky({ now: JULY_2020_NOW, fetchBackend: undefined })
          expect(fetchMock).toHaveBeenCalledTimes(0)
          expect(far.source).toBe('vsop87-approximation')
          expect(far.at).toBe('2020-07-01T12:00:00.000Z')

          const near = await mod.resolveLiveSky({ now: CLOCK, fetchBackend: undefined })
          expect(fetchMock).toHaveBeenCalledTimes(1)
          expect(near.source).toBe('swiss-ephemeris')
        })
      })
    })
  })
})
