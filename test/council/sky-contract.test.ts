import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { normalizeSkyPositions, SKY_PLANETS } from '@/lib/agents/council/sky-snapshot'
import { CouncilApiRequestSchema } from '@/lib/agents/council/council-schema'
import { buildServerCouncilContext } from '@/lib/agents/council/council-context'
import { usePlanetaryPositions } from '@/hooks/usePlanetaryPositions'
import { swissEphemerisService } from '@/lib/swiss-ephemeris-service'
import {
  getPlanetaryPositionsAction,
  getAlchemicalQuantitiesAction,
} from '@/lib/actions/backend-actions'

vi.mock('@/lib/actions/backend-actions', () => ({
  getPlanetaryPositionsAction: vi.fn(),
  getAlchemicalQuantitiesAction: vi.fn(),
}))

const instant = '2026-10-01T00:00:00.000Z'
const snapshot = () =>
  Object.fromEntries(
    SKY_PLANETS.map((planet, index) => [
      planet,
      {
        sign: 'Libra',
        degree: index + 0.123456,
        speed: index === 2 ? -0.432109 : index + 0.01,
        retrograde: index === 2,
        source: 'swiss-ephemeris',
        asOf: instant,
      },
    ])
  )

describe('council sky contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(['Titlecase', 'lowercase'])(
    'roundtrips %s client map through schema and context without fabricating Aries',
    casing => {
      const input = Object.fromEntries(
        Object.entries(snapshot()).map(([name, body]) => [
          casing === 'lowercase' ? name.toLowerCase() : name,
          body,
        ])
      )
      const parsed = CouncilApiRequestSchema.parse({ skyOverride: input })
      const context = buildServerCouncilContext({
        positions: parsed.skyOverride,
        date: new Date(instant),
      })
      expect(Object.keys(parsed.skyOverride!)).toEqual(SKY_PLANETS)
      expect(context.sky.sun.sign).toBe('Libra')
      expect(context.sky.sun.absoluteDegree).toBeCloseTo(180.123456, 6)
      expect(context.sky.mercury.speed).toBe(-0.432109)
      expect(context.sky.mercury.retrograde).toBe(true)
      expect(context.sky.mercury.source).toBe('swiss-ephemeris')
      expect(context.sky.mercury.asOf).toBe(instant)
    }
  )

  it('preserves full longitude precision with optional derived coordinates and a legacy integer degree', () => {
    const positions = snapshot()
    positions.Sun = { ...positions.Sun, degree: undefined, longitude: 188.7654321 } as any
    const parsed = normalizeSkyPositions(positions)
    expect(parsed.Sun.degree).toBeCloseTo(8.7654321, 7)
    expect(parsed.Sun.longitude).toBeCloseTo(188.7654321, 7)
    positions.Sun = {
      ...positions.Sun,
      degree: 8,
      longitude: undefined,
      exactLongitude: 188.7654321,
    } as any
    expect(normalizeSkyPositions(positions).Sun.degree).toBeCloseTo(8.7654321, 7)
  })

  it('rejects contradictory coordinates and motion instead of silently replacing provider fields', () => {
    const sun = snapshot().Sun
    for (const contradictory of [
      { ...sun, longitude: 188.7654321 },
      { ...sun, sign: 'Aries', longitude: 180.123456 },
      { ...sun, longitude: 180.123456, exactLongitude: 181.123456 },
      { ...sun, exactLongitude: 188.7654321 },
      { ...sun, speed: -1, retrograde: false },
      { ...sun, speed: 1, longitudeSpeed: -1 },
      { ...sun, retrograde: false, isRetrograde: true },
    ]) {
      expect(() => normalizeSkyPositions({ ...snapshot(), Sun: contradictory })).toThrow(/disagree/)
    }
  })

  it('rejects partial, nonfinite, invalid sign, duplicate, or relabelled snapshots', () => {
    const partial = snapshot()
    delete partial.Pluto
    expect(() => normalizeSkyPositions(partial)).toThrow(/Pluto/)
    expect(() => buildServerCouncilContext({ positions: partial as any })).toThrow(/Pluto/)
    expect(CouncilApiRequestSchema.safeParse({ skyOverride: partial }).success).toBe(false)
    expect(() =>
      normalizeSkyPositions({ ...snapshot(), Sun: { sign: 'Libra', degree: NaN } })
    ).toThrow(/finite/)
    expect(() =>
      normalizeSkyPositions({ ...snapshot(), Sun: { sign: 'Unknown', degree: 8 } })
    ).toThrow(/sign/)
    expect(() => normalizeSkyPositions({ ...snapshot(), sun: snapshot().Sun })).toThrow(/Duplicate/)
    expect(() => normalizeSkyPositions(snapshot(), { source: 'vsop87-approximation' })).toThrow(
      /relabelled/
    )
    expect(() => normalizeSkyPositions(snapshot(), { asOf: '2026-10-01T12:00:00Z' })).toThrow(
      /relabelled/
    )
  })

  it('keeps absent speed unknown instead of constructing a mean velocity', () => {
    const positions = snapshot()
    positions.Moon = { ...positions.Moon, speed: undefined } as any
    expect(normalizeSkyPositions(positions).Moon.speed).toBeUndefined()
    expect(
      buildServerCouncilContext({ positions: positions as any })
        .speakerAspects.moon.filter(aspect => aspect.orb > 0.25)
        .every(aspect => aspect.phase === 'unknown')
    ).toBe(true)
  })

  it('retains Swiss precision just below a cusp without manufacturing a coordinate conflict', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: Object.fromEntries(
          SKY_PLANETS.map(planet => [
            planet.toLowerCase(),
            { longitude: 29.9999995, latitude: 0, distance: 1, speed: 1 },
          ])
        ),
      }),
    } as Response)
    try {
      const result = await swissEphemerisService.getAllPlanetaryPositions(new Date(instant))
      const parsed = normalizeSkyPositions(result, { asOf: instant })
      expect(parsed.Sun.degree).toBeCloseTo(29.9999995, 7)
      expect(parsed.Sun.longitude).toBeCloseTo(29.9999995, 7)
      expect(parsed.Sun.sign).toBe('Aries')
      expect(parsed.Sun.source).toBe('swiss-ephemeris')
    } finally {
      fetch.mockRestore()
    }
  })

  it('preserves backend longitude/speed in the live hook without claiming Swiss provenance', async () => {
    const raw = Object.fromEntries(
      SKY_PLANETS.map((planet, index) => [
        planet,
        {
          sign: 'Libra',
          degree: index,
          exactLongitude: 180 + index + 0.76543,
          longitudeSpeed: index === 2 ? -0.54321 : 1,
          isRetrograde: index === 2,
        },
      ])
    )
    vi.mocked(getPlanetaryPositionsAction).mockResolvedValue({ planetary_positions: raw } as any)
    vi.mocked(getAlchemicalQuantitiesAction).mockResolvedValue({ spirit_score: 1 } as any)
    const { result, unmount } = renderHook(() => usePlanetaryPositions({ refreshInterval: 0 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const mercury = result.current.planetaryPositions.find(body => body.planet === 'Mercury')!
    expect(mercury.degree).toBeCloseTo(2.76543, 5)
    expect(mercury.longitude).toBeCloseTo(182.76543, 5)
    expect(mercury.speed).toBe(-0.54321)
    expect(mercury.retrograde).toBe(true)
    expect(mercury.source).toBe('unverified')
    expect(mercury.asOf).toBe(result.current.timestamp)
    expect(getAlchemicalQuantitiesAction).toHaveBeenCalledWith(true, mercury.asOf)
    unmount()
  })
})
