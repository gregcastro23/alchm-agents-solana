import { describe, expect, it } from 'vitest'

import {
  canonicalizeContext,
  ESMS_DECIMALS,
  hashEpochContext,
  hashTargetPersona,
  ledgerUnitsToAtoms,
  openZeppelinStarLeaf,
} from '@/lib/solana/vectors'

describe('Solana protocol golden vectors', () => {
  it('maps four-decimal ledger units directly to raw ESMS atoms', () => {
    expect(ESMS_DECIMALS).toBe(4)
    expect(ledgerUnitsToAtoms('100.0000')).toBe(1_000_000n)
    expect(ledgerUnitsToAtoms('0.0001')).toBe(1n)
    expect(ledgerUnitsToAtoms('99999999.9999')).toBe(999_999_999_999n)
    expect(() => ledgerUnitsToAtoms('1.')).toThrow()
    expect(() => ledgerUnitsToAtoms('1.00000')).toThrow()
    expect(() => ledgerUnitsToAtoms('-1.0000')).toThrow()
  })

  it('hashes the canonical 64-dimensional persona and epoch context', () => {
    const persona = Array.from({ length: 64 }, (_, index) => (index === 0 ? -0 : (index - 32) / 8))
    const context = {
      transits: { Moon: 123.456 },
      retrogrades: ['Mercury'],
      epoch: 42,
      domicile: 'Sun',
    }

    expect(hashTargetPersona('gregory-castro', persona)).toBe(
      'd796333f06b38838fd61c409a36a83051e441bc1cd3ae5185d428ddce9fae4c0'
    )
    expect(canonicalizeContext(context)).toBe(
      '{"domicile":"Sun","epoch":42,"retrogrades":["Mercury"],"transits":{"Moon":123.456}}'
    )
    expect(hashEpochContext(context)).toBe(
      'fa9eb38e5689391a27906e2f356d9fc60b78f8f6b0c3fc1a5ff41222ffe58063'
    )
  })

  it('matches the OpenZeppelin StandardMerkleTree uint32 leaf', () => {
    expect(openZeppelinStarLeaf(677)).toBe(
      '0x3faa6d4015e2c725ac8e804470bee904ec1855a333dafaf3fbf6e06fdf3e94a2'
    )
  })
})
