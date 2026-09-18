// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { calculatePentacleConversion, G_MIN } from '@/lib/pentacles/rate'

describe('Phase 4.5 Mutation Checks', () => {
  it('M1: Gate > 1.0 is strictly prohibited and fails calculation', () => {
    expect(() =>
      calculatePentacleConversion({
        direction: 'pentacles_to_esms',
        element: 'spirit',
        amountAtoms: 10_000n,
        tokenIndex: 1.0,
        compositeIndex: 1.0,
        gate: 1.0001, // Gate above 1.0
      })
    ).toThrow('gate must be within')
  })

  it('M2: Truncation strictly floors; rounding up would breach Invariant R1', () => {
    // With tokenIndex = 1.0, composite = 1.0, gate = 1.0:
    // If output were Math.ceil or Math.round, fractional amounts could accumulate value.
    const res = calculatePentacleConversion({
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 9999n,
      tokenIndex: 1.25,
      compositeIndex: 1.0,
      gate: 1.0,
    })

    const raw = 9999 * (1.0 / 1.25) // 7999.2
    expect(res.outAmountAtoms).toBe(7999n) // Strict floor
    expect(res.outAmountAtoms).not.toBe(8000n) // Must NOT round up
  })

  it('M3: Invariant R1 holds even with highest possible parity indices', () => {
    const input = 100_000n
    const leg1 = calculatePentacleConversion({
      direction: 'esms_to_pentacles',
      element: 'matter',
      amountAtoms: input,
      tokenIndex: 2.5,
      compositeIndex: 1.5,
      gate: 1.0,
    })

    const leg2 = calculatePentacleConversion({
      direction: 'pentacles_to_esms',
      element: 'matter',
      amountAtoms: leg1.outAmountAtoms,
      tokenIndex: 2.5,
      compositeIndex: 1.5,
      gate: 1.0,
    })

    expect(leg2.outAmountAtoms).toBeLessThanOrEqual(input)
  })
})
