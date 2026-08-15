// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/economy/price-index/route'
import {
  AAE_SOLANA_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ESMS_DECIMALS,
  getEsmsMintAddresses,
} from '@/lib/solana/esms'

describe('Elemental Live Price Index API & Solana Ticker', () => {
  it('returns valid quote payload for all four elements', async () => {
    const response = await GET()
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.solanaCluster).toBe('devnet')
    expect(data.programId).toBe(AAE_SOLANA_PROGRAM_ID.toBase58())
    expect(data.tokenProgramId).toBe(TOKEN_2022_PROGRAM_ID.toBase58())
    expect(data.elements).toBeDefined()

    const axes = ['Spirit', 'Essence', 'Matter', 'Substance'] as const
    const pdaMints = getEsmsMintAddresses(AAE_SOLANA_PROGRAM_ID)

    axes.forEach((axis, index) => {
      const quote = data.elements[axis]
      expect(quote).toBeDefined()
      expect(quote.axis).toBe(axis)
      expect(quote.decimals).toBe(ESMS_DECIMALS)
      expect(quote.decimals).toBe(4)
      expect(quote.priceUsd).toBeGreaterThan(0)
      expect(quote.priceSol).toBeGreaterThan(0)
      expect(quote.mintAddress).toBe(pdaMints[index].toBase58())
      expect(Array.isArray(quote.sparkline)).toBe(true)
      expect(quote.sparkline.length).toBeGreaterThan(10)
      expect(typeof quote.dominantAspect).toBe('string')
      expect(typeof quote.harmonicResonance).toBe('number')
    })
  })

  it('reflects correct astrological metadata & element associations', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.elements.Spirit.element).toBe('fire')
    expect(data.elements.Spirit.symbol).toBe('SPIRIT')
    expect(data.elements.Spirit.rulingPlanets).toContain('Sun')

    expect(data.elements.Essence.element).toBe('water')
    expect(data.elements.Essence.symbol).toBe('ESSENCE')
    expect(data.elements.Essence.rulingPlanets).toContain('Moon')

    expect(data.elements.Matter.element).toBe('earth')
    expect(data.elements.Matter.symbol).toBe('MATTER')
    expect(data.elements.Matter.rulingPlanets).toContain('Saturn')

    expect(data.elements.Substance.element).toBe('air')
    expect(data.elements.Substance.symbol).toBe('SUBSTANCE')
    expect(data.elements.Substance.rulingPlanets).toContain('Mercury')
  })
})
