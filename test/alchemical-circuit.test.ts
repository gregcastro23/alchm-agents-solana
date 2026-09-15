import { describe, it, expect } from 'vitest'
import fixtures from '../alchm-astro-core/spec/fixtures/cast-power.v1.json'
import {
  PILLARS,
  PILLAR_CONSTANTS,
  PILLAR_SPEC_VERSION,
  hand,
  isPillarKey,
  type ChartInput,
  type Esms,
} from '../lib/alchemy/pillars'
import { castDelta, circuitState, resolveDuel, roomShares } from '../lib/alchemical-circuit'

// The same fixture file is checked by alchm-astro-core/tests/spec_parity.rs, so
// passing here and there means the TypeScript and Rust circuits agree.

const TOL = fixtures.tolerance
const charts = new Map<string, ChartInput>(fixtures.charts.map(c => [c.id, c]))

function chart(id: string): ChartInput {
  const c = charts.get(id)
  if (!c) throw new Error(`fixture chart ${id} missing`)
  return c
}

function expectClose(label: string, got: number, want: number) {
  const scale = Math.max(1, Math.abs(got), Math.abs(want))
  if (Math.abs(got - want) > TOL * scale) {
    throw new Error(`${label}: got ${got}, want ${want}`)
  }
}

function expectClose4(label: string, got: readonly number[], want: readonly number[]) {
  expect(got).toHaveLength(4)
  got.forEach((v, k) => expectClose(`${label}[${k}]`, v, want[k]))
}

describe('pillar spec', () => {
  it('loads fourteen pillars with unit ESMS effects', () => {
    expect(PILLAR_SPEC_VERSION).toBe(fixtures.specVersion)
    expect(PILLARS).toHaveLength(14)
    expect(new Set(PILLARS.map(p => p.id)).size).toBe(14)
    for (const p of PILLARS) {
      expect(p.effects.every(e => e === 1 || e === -1)).toBe(true)
      expect(isPillarKey(p.key)).toBe(true)
    }
    expect(isPillarKey('Comixion')).toBe(true)
    expect(isPillarKey('Comixtion')).toBe(false)
    expect(isPillarKey('Meltdown')).toBe(false)
  })

  it('never delivers more than the charge a cast spends', () => {
    for (const p of PILLARS) {
      for (const m of [PILLAR_CONSTANTS.magnitudeMin, 1, PILLAR_CONSTANTS.magnitudeMax]) {
        const total = castDelta(p, m, PILLAR_CONSTANTS.castCharge).reduce(
          (sum, v) => sum + Math.abs(v),
          0
        )
        expect(total).toBeLessThanOrEqual(PILLAR_CONSTANTS.castCharge + 1e-12)
      }
    }
  })
})

describe('circuit state matches the golden fixtures', () => {
  it.each(fixtures.states.map((s, i) => [i, s] as const))('state %i', (_i, s) => {
    const c = chart(s.chart)
    const got = circuitState(c, s.pools as Esms)
    const want = s.expected
    expect(got.elementCounts).toEqual(want.elementCounts)
    expect(got.modalityCounts).toEqual(want.modalityCounts)
    expect(got.bodies).toBe(want.bodies)
    expectClose4('natalEsms', got.natalEsms, want.natalEsms)
    expectClose4('liveEsms', got.liveEsms, want.liveEsms)
    for (const field of [
      'heat',
      'entropy',
      'reactivity',
      'energy',
      'charge',
      'chargeSpent',
      'current',
      'voltage',
      'power',
      'potency',
      'magnitude',
    ] as const) {
      expectClose(field, got[field], want[field])
    }
    expect(got.canCast).toBe(want.canCast)
    expect(hand(c, 'diurnal')).toEqual(want.handDiurnal)
    expect(hand(c, 'nocturnal')).toEqual(want.handNocturnal)
  })

  it('gives every chart at least the minimum hand in both skies', () => {
    for (const c of charts.values()) {
      expect(hand(c, 'diurnal').length).toBeGreaterThanOrEqual(PILLAR_CONSTANTS.minHand)
      expect(hand(c, 'nocturnal').length).toBeGreaterThanOrEqual(PILLAR_CONSTANTS.minHand)
    }
  })
})

describe('duels match the golden fixtures', () => {
  it.each(fixtures.duels.map((d, i) => [i, d] as const))('duel %i', (_i, d) => {
    const got = resolveDuel(
      { chart: chart(d.a.chart), pools: d.a.pools as Esms, pillarId: d.a.pillar },
      { chart: chart(d.b.chart), pools: d.b.pools as Esms, pillarId: d.b.pillar }
    )
    const want = d.expected
    expectClose('magnitudeA', got.magnitudeA, want.magnitudeA)
    expectClose('magnitudeB', got.magnitudeB, want.magnitudeB)
    expectClose4('deltaA', got.deltaA, want.deltaA)
    expectClose4('deltaB', got.deltaB, want.deltaB)
    expectClose4('poolsA', got.poolsA, want.poolsA)
    expectClose4('poolsB', got.poolsB, want.poolsB)
    expectClose('ratioA', got.ratioA, want.ratioA)
    expectClose('ratioB', got.ratioB, want.ratioB)
    expect(got.winner).toBe(want.winner)
  })

  it('refuses a duel when a caster cannot cover the charge', () => {
    const broke = fixtures.states.find(s => !s.expected.canCast)
    expect(broke).toBeDefined()
    expect(() =>
      resolveDuel(
        { chart: chart(broke!.chart), pools: broke!.pools as Esms, pillarId: 1 },
        { chart: chart('c03'), pools: [80, 80, 80, 80], pillarId: 5 }
      )
    ).toThrow(/cast charge/)
  })
})

describe('room shares match the golden fixtures', () => {
  it.each(fixtures.rooms.map((r, i) => [i, r] as const))('room %i', (_i, room) => {
    const got = roomShares(room.magnitude, room.receivers.map(chart))
    expect(got).toHaveLength(room.expected.length)
    got.forEach((g, j) => {
      const w = room.expected[j]
      expectClose(`share ${j}`, g.share, w.share)
      expectClose(`real ${j}`, g.real, w.real)
      expectClose(`kick ${j}`, g.kick, w.kick)
      expectClose(`tension ${j}`, g.tension, w.tension)
    })
    expect(got.reduce((sum, g) => sum + g.share, 0)).toBeCloseTo(1, 12)
  })
})
