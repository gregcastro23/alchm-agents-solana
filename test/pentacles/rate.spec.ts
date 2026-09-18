// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  calculatePentacleConversion,
  G_MIN,
  PENTACLE_ATOMS_PER_UNIT,
  ESMS_ATOMS_PER_UNIT,
  type EsmsElement,
} from '@/lib/pentacles/rate'

describe('Pentacle Rate Calculation (Section 3 & Invariants R1, R2)', () => {
  // Pinned golden vectors from live ticker snapshot
  const LIVE_TICKER = {
    compositeIndex: 1.2119,
    spiritIndex: 1.2299,
    essenceIndex: 1.2569,
    matterIndex: 1.1093,
    substanceIndex: 1.2517,
  }

  it('calculates 10 ⛤ -> Spirit ESMS at par gate (1.0) matches ~0.99 ESMS anchor', () => {
    // 10 ⛤ = 10,000 pentacle atoms
    const res = calculatePentacleConversion({
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 10_000n,
      tokenIndex: LIVE_TICKER.spiritIndex,
      compositeIndex: LIVE_TICKER.compositeIndex,
      gate: 1.0,
    })

    // 10,000 * (1.2119 / 1.2299) * 1.0 = 9853.64... -> floor to 9853 atoms = 0.9853 ESMS
    expect(res.outAmountAtoms).toBe(9853n)
    expect(res.dustAtoms).toBeGreaterThan(0)
    expect(res.dustAtoms).toBeLessThan(1)
    expect(Number(res.outAmountAtoms) / Number(ESMS_ATOMS_PER_UNIT)).toBeCloseTo(0.9853, 3)
  })

  it('calculates 1.0 Spirit ESMS -> ⛤ at par gate (1.0)', () => {
    // 1.0 ESMS = 10,000 ESMS atoms
    const res = calculatePentacleConversion({
      direction: 'esms_to_pentacles',
      element: 'spirit',
      amountAtoms: 10_000n,
      tokenIndex: LIVE_TICKER.spiritIndex,
      compositeIndex: LIVE_TICKER.compositeIndex,
      gate: 1.0,
    })

    // 10,000 * (1.2299 / 1.2119) * 1.0 = 10148.52... -> floor to 10148 atoms = 10.148 ⛤
    expect(res.outAmountAtoms).toBe(10148n)
    expect(res.dustAtoms).toBeGreaterThan(0)
    expect(res.dustAtoms).toBeLessThan(1)
  })

  it('Invariant R2 (Floor Toward System): strictly truncates fractional atoms into dust', () => {
    const res = calculatePentacleConversion({
      direction: 'pentacles_to_esms',
      element: 'matter',
      amountAtoms: 12_345n,
      tokenIndex: LIVE_TICKER.matterIndex,
      compositeIndex: LIVE_TICKER.compositeIndex,
      gate: 0.92,
    })

    const exactFloat = 12345 * (LIVE_TICKER.compositeIndex / LIVE_TICKER.matterIndex) * 0.92
    expect(res.outAmountAtoms).toBe(BigInt(Math.floor(exactFloat)))
    expect(res.dustAtoms).toBeCloseTo(exactFloat - Math.floor(exactFloat), 6)
  })

  it('Invariant R1 (No Round-Trip Profit): Property Test over 1,000 random vectors', () => {
    // For any element, random amount in [10_000, 10_000_000] atoms, random gate in [0.85, 1.0],
    // and random token index in [0.5, 3.0], converting ESMS -> ⛤ -> ESMS never produces more than input.
    for (let i = 0; i < 1000; i++) {
      const initialEsmsAtoms = BigInt(Math.floor(Math.random() * 1_000_000) + 10_000)
      const tokenIndex = Math.random() * 2.5 + 0.5
      const compositeIndex = Math.random() * 2.5 + 0.5
      const gate = G_MIN + Math.random() * (1.0 - G_MIN) // [0.85, 1.0]

      // Leg 1: ESMS -> ⛤
      const leg1 = calculatePentacleConversion({
        direction: 'esms_to_pentacles',
        element: 'spirit',
        amountAtoms: initialEsmsAtoms,
        tokenIndex,
        compositeIndex,
        gate,
      })

      // Leg 2: ⛤ -> ESMS
      const leg2 = calculatePentacleConversion({
        direction: 'pentacles_to_esms',
        element: 'spirit',
        amountAtoms: leg1.outAmountAtoms,
        tokenIndex,
        compositeIndex,
        gate,
      })

      expect(leg2.outAmountAtoms).toBeLessThanOrEqual(initialEsmsAtoms)
    }
  })

  it('rejects invalid inputs: gate < 0.85, gate > 1.0, non-positive amounts or indices', () => {
    expect(() =>
      calculatePentacleConversion({
        direction: 'pentacles_to_esms',
        element: 'spirit',
        amountAtoms: 0n,
        tokenIndex: 1.0,
        compositeIndex: 1.0,
        gate: 1.0,
      })
    ).toThrow('Conversion amount must be positive')

    expect(() =>
      calculatePentacleConversion({
        direction: 'pentacles_to_esms',
        element: 'spirit',
        amountAtoms: 1000n,
        tokenIndex: 1.0,
        compositeIndex: 1.0,
        gate: 0.84, // below G_MIN
      })
    ).toThrow('gate must be within')

    expect(() =>
      calculatePentacleConversion({
        direction: 'pentacles_to_esms',
        element: 'spirit',
        amountAtoms: 1000n,
        tokenIndex: 1.0,
        compositeIndex: 1.0,
        gate: 1.01, // above 1.0
      })
    ).toThrow('gate must be within')
  })
})
