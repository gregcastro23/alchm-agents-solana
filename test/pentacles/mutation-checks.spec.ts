// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { calculatePentacleConversion, G_MIN } from '@/lib/pentacles/rate'
import {
  verifyQuoteToken,
  signQuoteToken,
  type ConversionQuotePayload,
} from '@/lib/pentacles/service'

describe('Phase 4.5 Mutation Checks (Hardened)', () => {
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

  it('M2: Truncation strictly floors; distinguishes floor from round, ceil, and int cast', () => {
    // Input chosen specifically such that raw value has fractional part > 0.5 (8000.8):
    // 10,001 * (1.0 / 1.25) = 8000.8
    // Math.floor(8000.8) = 8000
    // Math.round(8000.8) = 8001 (MUST FAIL if mutated to round)
    // Math.ceil(8000.8)  = 8001 (MUST FAIL if mutated to ceil)
    const res = calculatePentacleConversion({
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 10_001n,
      tokenIndex: 1.25,
      compositeIndex: 1.0,
      gate: 1.0,
    })

    expect(res.outAmountAtoms).toBe(8000n)
    expect(res.outAmountAtoms).not.toBe(8001n) // Catches Math.round and Math.ceil mutations!
    expect(res.dustAtoms).toBeCloseTo(0.8, 4)

    // And test fractional part < 0.5 (7999.2):
    // 9,999 * (1.0 / 1.25) = 7999.2
    // Math.floor(7999.2) = 7999
    // Math.ceil(7999.2) = 8000 (MUST FAIL if mutated to ceil)
    const resLow = calculatePentacleConversion({
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 9_999n,
      tokenIndex: 1.25,
      compositeIndex: 1.0,
      gate: 1.0,
    })
    expect(resLow.outAmountAtoms).toBe(7999n)
    expect(resLow.outAmountAtoms).not.toBe(8000n) // Catches Math.ceil
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

  it('M4: Token HMAC verification cannot be bypassed; corrupting a single bit throws', () => {
    const validPayload: ConversionQuotePayload = {
      quoteId: 'm4-quote-1',
      userId: 'usr-1',
      identity: '4YCVh9KHrhN6mFSMvybGVqLeGfaRkfUtqrn19mLLJGku',
      userEmail: 'user@test.com',
      direction: 'pentacles_to_esms',
      element: 'spirit',
      inAmountAtoms: '10000',
      outAmountAtoms: '9853',
      dustAtoms: 0.64,
      rate: 0.9853,
      gateApplied: 1.0,
      tokenIndex: 1.2299,
      compositeIndex: 1.2119,
      bucketStartUtc: new Date().toISOString(),
      createdAt: Date.now(),
      expiresAt: Date.now() + 120_000,
    }

    const token = signQuoteToken(validPayload)
    const verified = verifyQuoteToken(token)
    expect(verified.quoteId).toBe('m4-quote-1')

    // Corrupt signature
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw)
    // Flip last character of HMAC
    const lastChar = parsed.hmac.slice(-1)
    parsed.hmac = parsed.hmac.slice(0, -1) + (lastChar === 'a' ? 'b' : 'a')
    const corruptedToken = Buffer.from(JSON.stringify(parsed)).toString('base64url')

    expect(() => verifyQuoteToken(corruptedToken)).toThrow(
      'Quote token signature verification failed'
    )
  })
})
