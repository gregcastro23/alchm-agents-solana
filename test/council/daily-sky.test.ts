import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildDailySkyBrief,
  loadDailySkyBrief,
  searchDailySkyEvents,
  utcCouncilDay,
} from '@/lib/agents/council/daily-sky'
import { SKY_PLANETS, type SkyPositions } from '@/lib/agents/council/sky-snapshot'
import { swissEphemerisService } from '@/lib/swiss-ephemeris-service'
import { SIGN_ORDER } from '@/lib/agents/council/aspect-dialogue-engine'

const day = new Date('2026-10-01T00:00:00Z')
const normalize = (value: number) => ((value % 360) + 360) % 360

function fixture(
  at = day,
  source: 'swiss-ephemeris' | 'vsop87-approximation' = 'swiss-ephemeris'
): SkyPositions {
  return Object.fromEntries(
    SKY_PLANETS.map((planet, index) => {
      const longitude = index * 31 + 3.234567
      return [
        planet,
        {
          longitude,
          sign: SIGN_ORDER[Math.floor(longitude / 30)],
          degree: longitude % 30,
          speed: index === 6 ? -0.045678 : 1 + index / 100,
          retrograde: index === 6,
          source,
          asOf: at.toISOString(),
        },
      ]
    })
  ) as SkyPositions
}
function setLongitude(
  sky: SkyPositions,
  planet: keyof SkyPositions,
  longitude: number,
  speed?: number
) {
  const value = normalize(longitude)
  sky[planet] = {
    ...sky[planet],
    longitude: value,
    sign: SIGN_ORDER[Math.floor(value / 30)],
    degree: value % 30,
    ...(speed !== undefined ? { speed, retrograde: speed < 0 } : {}),
  }
}

describe('deterministic daily sky', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('anchors a shared day to UTC even across a local-date or DST boundary', () => {
    expect(utcCouncilDay(new Date('2026-11-01T23:30:00-05:00')).date).toBe('2026-11-02')
    const one = buildDailySkyBrief({ positions: fixture(), date: day, source: 'swiss-ephemeris' })
    const two = buildDailySkyBrief({
      positions: fixture(),
      date: new Date('2026-10-01T23:59:59Z'),
      source: 'swiss-ephemeris',
    })
    expect(one.id).toBe(two.id)
    expect(one.asOf).toBe('2026-10-01T00:00:00.000Z')
    expect(one.endAt).toBe('2026-10-02T00:00:00.000Z')
    expect(one.positions.Saturn.speed).toBe(-0.045678)
    expect(one.positions.Saturn.asOf).toBe(one.asOf)
  })

  it('computes lunar phase from Sun–Moon elongation and illumination as a fraction', () => {
    const sky = fixture()
    setLongitude(sky, 'Sun', 359)
    setLongitude(sky, 'Moon', 89)
    const brief = buildDailySkyBrief({ positions: sky, date: day, source: 'swiss-ephemeris' })
    expect(brief.lunar.phase).toBe('First Quarter')
    expect(brief.lunar.elongation).toBe(90)
    expect(brief.lunar.illumination).toBeCloseTo(0.5, 8)
    setLongitude(sky, 'Moon', 179)
    expect(
      buildDailySkyBrief({ positions: sky, date: day, source: 'swiss-ephemeris' }).lunar
        .illumination
    ).toBe(1)
  })

  it('ranks major aspects and requires all ten placements, lunar state, motion, and outer context', () => {
    const sky = fixture()
    setLongitude(sky, 'Sun', 0, 1)
    setLongitude(sky, 'Moon', 88, 13)
    const brief = buildDailySkyBrief({ positions: sky, date: day, source: 'swiss-ephemeris' })
    expect(
      brief.aspects.find(aspect => aspect.bodyA === 'sun' && aspect.bodyB === 'moon')
    ).toMatchObject({ aspectName: 'Square', phase: 'applying', orb: 2 })
    expect(brief.aspects.findIndex(aspect => !aspect.major)).toBeGreaterThanOrEqual(
      brief.aspects.filter(aspect => aspect.major).length - 1
    )
    for (const planet of SKY_PLANETS)
      expect(brief.requiredCoverage).toContain(`placement-${planet.toLowerCase()}`)
    expect(brief.requiredCoverage).toEqual(
      expect.arrayContaining(['lunar-state', 'motion-state', 'outer-context', 'sky-overview'])
    )
    const available = new Set(brief.evidence.flatMap(item => item.coverageIds))
    expect(brief.requiredCoverage.every(id => available.has(id))).toBe(true)
  })

  it('changes snapshot identity when provenance, measurements, or event coverage changes', () => {
    const verified = buildDailySkyBrief({
      positions: fixture(),
      date: day,
      source: 'swiss-ephemeris',
    })
    const scanned = buildDailySkyBrief({
      positions: fixture(),
      date: day,
      source: 'swiss-ephemeris',
      eventScanComplete: true,
    })
    const approximate = buildDailySkyBrief({
      positions: fixture(day, 'vsop87-approximation'),
      date: day,
      source: 'vsop87-approximation',
    })
    const changed = fixture()
    setLongitude(changed, 'Moon', changed.Moon.longitude + 0.01)
    expect(
      new Set([
        verified.id,
        scanned.id,
        approximate.id,
        buildDailySkyBrief({ positions: changed, date: day, source: 'swiss-ephemeris' }).id,
      ]).size
    ).toBe(4)
  })

  it('withholds exact events and exactness claims from approximate readings', () => {
    const sky = fixture(day, 'vsop87-approximation')
    setLongitude(sky, 'Sun', 0)
    setLongitude(sky, 'Moon', 90)
    const brief = buildDailySkyBrief({
      positions: sky,
      date: day,
      source: 'vsop87-approximation',
      events: [
        {
          id: 'fake',
          evidenceId: 'fake',
          type: 'station',
          at: '2026-10-01T12:00:00Z',
          bodies: ['mercury'],
          description: 'unverified station',
        },
      ],
    })
    expect(brief.events).toEqual([])
    expect(
      brief.aspects.find(aspect => aspect.bodyA === 'sun' && aspect.bodyB === 'moon')!.phase
    ).toBe('unknown')
    expect(brief.warnings.join(' ')).toMatch(/Keplerian.*withheld/)
    expect(brief.evidence.find(item => item.id === 'motion-state')?.label).toMatch(
      /Estimated retrogrades.*estimated daily velocities/
    )
    const unknown = fixture(day, 'vsop87-approximation')
    unknown.Mercury.speed = undefined
    unknown.Mercury.retrograde = true
    const uncertain = buildDailySkyBrief({
      positions: unknown,
      date: day,
      source: 'vsop87-approximation',
    })
    expect(uncertain.evidence.find(item => item.id === 'motion-state')?.label).toMatch(
      /unmeasured motion: Mercury/
    )
    expect(uncertain.evidence.find(item => item.id === 'motion-state')?.label).not.toMatch(
      /retrogrades: Mercury/
    )
    expect(() =>
      buildDailySkyBrief({
        positions: fixture(new Date('2026-10-01T12:00:00Z')),
        date: day,
        source: 'swiss-ephemeris',
      })
    ).toThrow(/instant.*relabelled/)
  })

  it('loads one shared verified opening snapshot without event scans on read', async () => {
    const date = new Date('2026-10-03T12:00:00Z')
    const get = vi
      .spyOn(swissEphemerisService, 'getAllPlanetaryPositions')
      .mockImplementation(async at => fixture(at) as any)
    const [a, b] = await Promise.all([loadDailySkyBrief(date), loadDailySkyBrief(date)])
    expect(a.id).toBe(b.id)
    expect(a.quality).toBe('verified')
    expect(get).toHaveBeenCalledTimes(1)
    expect(a.warnings.join(' ')).toMatch(/timing has not been calculated/)
  })

  it('rejects partial Swiss payloads and keeps fallback source truthful', async () => {
    const partial = fixture()
    delete (partial as any).Pluto
    vi.spyOn(swissEphemerisService, 'getAllPlanetaryPositions').mockResolvedValue(partial as any)
    const brief = await loadDailySkyBrief(new Date('2026-10-04T12:00:00Z'))
    expect(brief.source).toBe('vsop87-approximation')
    expect(Object.keys(brief.positions)).toHaveLength(10)
    expect(
      Object.values(brief.positions).every(body => body.source === 'vsop87-approximation')
    ).toBe(true)
  })

  it('times out a stuck ephemeris read and returns a labelled fallback', async () => {
    vi.useFakeTimers()
    vi.spyOn(swissEphemerisService, 'getAllPlanetaryPositions').mockImplementation(
      () => new Promise(() => {})
    )
    const pending = loadDailySkyBrief(new Date('2026-10-05T12:00:00Z'))
    await vi.advanceTimersByTimeAsync(2001)
    expect((await pending).source).toBe('vsop87-approximation')
  })

  it('honors each caller deadline without cancelling a shared snapshot needed by another reader', async () => {
    vi.useFakeTimers()
    const date = new Date('2026-10-07T12:00:00Z')
    let resolveSample!: (value: any) => void
    const get = vi
      .spyOn(swissEphemerisService, 'getAllPlanetaryPositions')
      .mockImplementation(() => new Promise(resolve => (resolveSample = resolve)))
    const first = loadDailySkyBrief(date, { deadlineMs: Date.now() + 1_000 })
    const second = loadDailySkyBrief(date, { deadlineMs: Date.now() + 20 })
    const timedOut = expect(second).rejects.toThrow(/time budget exhausted/)
    await vi.advanceTimersByTimeAsync(21)
    await timedOut
    expect(get).toHaveBeenCalledTimes(1)
    resolveSample(fixture(utcCouncilDay(date).start))
    expect((await first).source).toBe('swiss-ephemeris')
    await expect(loadDailySkyBrief(date, { deadlineMs: Date.now() - 1 })).rejects.toThrow(
      /time budget exhausted/
    )
    await expect(
      loadDailySkyBrief(new Date('2026-10-09T12:00:00Z'), { deadlineMs: Date.now() - 1 })
    ).rejects.toThrow(/time budget exhausted/)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('opts into a complete sampled event scan only for scheduled generation', async () => {
    const get = vi
      .spyOn(swissEphemerisService, 'getAllPlanetaryPositions')
      .mockImplementation(async at => {
        const sky = fixture(at)
        for (const body of Object.values(sky)) {
          body.speed = 0
          body.retrograde = false
        }
        return sky as any
      })
    const brief = await loadDailySkyBrief(new Date('2026-10-06T12:00:00Z'), { includeEvents: true })
    expect(get).toHaveBeenCalledTimes(25)
    expect(brief.quality).toBe('verified')
    expect(brief.events).toEqual([])
    expect(brief.warnings.some(warning => warning.includes('timing has not been calculated'))).toBe(
      false
    )
  })

  it('keeps shared work alive when its first caller has the shortest wait deadline', async () => {
    vi.useFakeTimers()
    const date = new Date('2026-10-10T12:00:00Z')
    let resolveSample!: (value: any) => void
    const get = vi
      .spyOn(swissEphemerisService, 'getAllPlanetaryPositions')
      .mockImplementation(() => new Promise(resolve => (resolveSample = resolve)))
    const first = loadDailySkyBrief(date, { deadlineMs: Date.now() + 20 })
    const second = loadDailySkyBrief(date, { deadlineMs: Date.now() + 1_000 })
    const timedOut = expect(first).rejects.toThrow(/time budget exhausted/)
    await vi.advanceTimersByTimeAsync(21)
    await timedOut
    expect(get).toHaveBeenCalledTimes(1)
    resolveSample(fixture(utcCouncilDay(date).start))
    expect((await second).source).toBe('swiss-ephemeris')
  })

  it('aborts event samples at the initiating cron deadline without continuing the scan', async () => {
    vi.useFakeTimers()
    const date = new Date('2026-10-11T12:00:00Z')
    let stalledSignal: AbortSignal | undefined
    const get = vi
      .spyOn(swissEphemerisService, 'getAllPlanetaryPositions')
      .mockImplementation(async (at, _latitude, _longitude, options) => {
        if (at.getUTCHours() === 0) return fixture(at) as any
        stalledSignal = options?.signal
        return new Promise(() => {})
      })
    const pending = loadDailySkyBrief(date, {
      includeEvents: true,
      deadlineMs: Date.now() + 50,
    }).catch(error => error)
    await vi.advanceTimersByTimeAsync(51)
    await pending
    expect(stalledSignal?.aborted).toBe(true)
    expect(get).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('searches real sample crossings, separating ingress from integer-degree change and handling retrograde wrap', async () => {
    const provider = async (at: Date) => {
      const sky = fixture(at)
      const hours = (at.getTime() - day.getTime()) / 3_600_000
      // Synthetic measured trajectory for testing the solver, not a real sky claim.
      for (const planet of SKY_PLANETS) setLongitude(sky, planet, sky[planet].longitude, 0)
      setLongitude(sky, 'Moon', 359 + hours * 0.5, 12)
      setLongitude(sky, 'Mercury', 1 - hours * 0.5, -12)
      setLongitude(sky, 'Venus', 10 + hours * 0.2, 4.8)
      setLongitude(sky, 'Mars', 88 + hours * 0.5, 12)
      setLongitude(sky, 'Sun', 0, 0)
      setLongitude(sky, 'Jupiter', sky.Jupiter.longitude, (hours - 5) * 0.01)
      return sky
    }
    const samples = await Promise.all(
      Array.from({ length: 25 }, async (_, hour) => {
        const at = new Date(day.getTime() + hour * 3_600_000)
        return { at, positions: await provider(at) }
      })
    )
    const events = await searchDailySkyEvents({ date: day, samples, getPositions: provider })
    expect(
      events.find(event => event.type === 'sign_ingress' && event.bodies[0] === 'moon')
    ).toMatchObject({ at: '2026-10-01T02:00:00.000Z' })
    expect(
      events.find(event => event.type === 'sign_ingress' && event.bodies[0] === 'mercury')!
        .description
    ).toMatch(/Pisces.*retrograde/)
    expect(events.some(event => event.type === 'sign_ingress' && event.bodies[0] === 'venus')).toBe(
      false
    )
    expect(
      events.find(event => event.type === 'station' && event.bodies[0] === 'jupiter')!.description
    ).toMatch(/direct/)
    expect(
      events.some(event => event.type === 'lunar_phase' && event.description.includes('New Moon'))
    ).toBe(true)
    expect(
      events.some(
        event => event.type === 'aspect_exact' && event.description.includes('Sun square Mars')
      )
    ).toBe(true)
    expect(
      events.every(event => event.at >= day.toISOString() && event.at < '2026-10-02T00:00:00.000Z')
    ).toBe(true)
    const brief = buildDailySkyBrief({
      positions: await provider(day),
      date: day,
      source: 'swiss-ephemeris',
      events,
      eventScanComplete: true,
    })
    expect(
      events.every(
        event =>
          brief.requiredCoverage.includes(event.id) &&
          brief.evidence.some(item => item.id === event.evidenceId)
      )
    ).toBe(true)
    await expect(
      searchDailySkyEvents({ date: day, samples: samples.slice(1), getPositions: provider })
    ).rejects.toThrow(/complete UTC day/)
    const approximateSamples = samples.map(sample => ({
      at: sample.at,
      positions: fixture(sample.at, 'vsop87-approximation'),
    }))
    await expect(
      searchDailySkyEvents({ date: day, samples: approximateSamples, getPositions: provider })
    ).rejects.toThrow(/verified Swiss/)
  })

  it('excludes next-day midnight crossings and includes the same measured events at day opening', async () => {
    const provider = async (at: Date) => {
      const sky = fixture(at)
      const hours = (at.getTime() - day.getTime()) / 3_600_000
      for (const planet of SKY_PLANETS) setLongitude(sky, planet, sky[planet].longitude, 0)
      setLongitude(sky, 'Sun', 0, 0)
      setLongitude(sky, 'Moon', 89 + hours / 24, 1)
      setLongitude(sky, 'Mercury', 29 + hours / 24, 1)
      setLongitude(sky, 'Venus', 59 + hours / 24, 1)
      setLongitude(sky, 'Jupiter', sky.Jupiter.longitude, (hours - 24) * 0.01)
      return sky
    }
    const scan = async (start: Date) => {
      const samples = await Promise.all(
        Array.from({ length: 25 }, async (_, hour) => {
          const at = new Date(start.getTime() + hour * 3_600_000)
          return { at, positions: await provider(at) }
        })
      )
      return searchDailySkyEvents({ date: start, samples, getPositions: provider })
    }
    const today = await scan(day)
    expect(today.some(event => event.type === 'lunar_phase')).toBe(false)
    expect(
      today.some(event => event.type === 'sign_ingress' && event.bodies[0] === 'mercury')
    ).toBe(false)
    expect(
      today.some(
        event =>
          event.type === 'aspect_exact' &&
          event.bodies.includes('sun') &&
          event.bodies.includes('venus')
      )
    ).toBe(false)
    expect(today.some(event => event.type === 'station')).toBe(false)
    const tomorrow = await scan(utcCouncilDay(day).end)
    expect(tomorrow.find(event => event.type === 'lunar_phase')?.at).toBe(
      '2026-10-02T00:00:00.000Z'
    )
    expect(
      tomorrow.find(event => event.type === 'sign_ingress' && event.bodies[0] === 'mercury')?.at
    ).toBe('2026-10-02T00:00:00.000Z')
    expect(
      tomorrow.find(
        event =>
          event.type === 'aspect_exact' &&
          event.bodies.includes('sun') &&
          event.bodies.includes('venus')
      )?.at
    ).toBe('2026-10-02T00:00:00.000Z')
    expect(tomorrow.find(event => event.type === 'station')?.at).toBe('2026-10-02T00:00:00.000Z')
  })

  it('keeps a crossing just before midnight in the day and rounds within one minute', async () => {
    const targetMs = day.getTime() + 86_400_000 - 15_000
    const provider = async (at: Date) => {
      const sky = fixture(at)
      for (const planet of SKY_PLANETS) setLongitude(sky, planet, sky[planet].longitude, 0)
      setLongitude(sky, 'Mercury', 30 + (at.getTime() - targetMs) / 86_400_000, 1)
      return sky
    }
    const samples = await Promise.all(
      Array.from({ length: 25 }, async (_, hour) => {
        const at = new Date(day.getTime() + hour * 3_600_000)
        return { at, positions: await provider(at) }
      })
    )
    const events = await searchDailySkyEvents({ date: day, samples, getPositions: provider })
    const ingress = events.find(
      event => event.type === 'sign_ingress' && event.bodies[0] === 'mercury'
    )!
    expect(ingress.at).toBe('2026-10-01T23:59:00.000Z')
    expect(Math.abs(Date.parse(ingress.at) - targetMs)).toBeLessThan(60_000)
  })
})
