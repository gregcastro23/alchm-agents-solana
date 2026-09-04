import { describe, expect, it } from 'vitest'
import {
  computeDiscriminantDailyYield,
  deriveTransitWeightsFromPositions,
  resolveAgentNatalData,
  TOKEN_IDENTITIES,
  CANONICAL_TOKENS,
  LIVE_NETWORK_SUPPLY,
  type NatalChartData,
  type TransitSkyData,
  type GlobalSupplyState,
} from '@/lib/services/discriminant-faucet'

describe('ADR-014: Discriminant Astrological Faucet Engine', () => {
  const neutralSupply: GlobalSupplyState = {
    spirit: 25000,
    essence: 25000,
    matter: 25000,
    substance: 25000,
  }

  const neutralTransit: TransitSkyData = {
    elementWeights: { Fire: 2.5, Water: 2.5, Earth: 2.5, Air: 2.5 },
  }

  it('declares the four mandatory canonical tokens with authentic symbol tiers', () => {
    expect(CANONICAL_TOKENS).toEqual(['SPIRIT', 'ESSENCE', 'MATTER', 'SUBSTANCE'])

    expect(TOKEN_IDENTITIES.SPIRIT).toMatchObject({
      name: 'SPIRIT',
      element: 'Fire',
      primaryGlyph: '🝇',
      triangularVariant: '🜂',
      unicodeFallback: '△',
      atomicCode: '[SPRT]',
    })

    expect(TOKEN_IDENTITIES.ESSENCE).toMatchObject({
      name: 'ESSENCE',
      element: 'Water',
      primaryGlyph: '🝑',
      triangularVariant: '🜄',
      unicodeFallback: '▽',
      atomicCode: '[ESNC]',
    })

    expect(TOKEN_IDENTITIES.MATTER).toMatchObject({
      name: 'MATTER',
      element: 'Earth',
      primaryGlyph: '🝙',
      triangularVariant: '🜃',
      atomicCode: '[MATR]',
    })

    expect(TOKEN_IDENTITIES.SUBSTANCE).toMatchObject({
      name: 'SUBSTANCE',
      element: 'Air',
      primaryGlyph: '🝉',
      triangularVariant: '🜁',
      atomicCode: '[SUBS]',
    })
  })

  it('allocates a flat symmetrical 3.0000 each for a neutral claimer under neutral sky', () => {
    const res = computeDiscriminantDailyYield(null, neutralTransit, neutralSupply)

    expect(res.spirit).toBe(3.0)
    expect(res.essence).toBe(3.0)
    expect(res.matter).toBe(3.0)
    expect(res.substance).toBe(3.0)
    expect(res.total).toBe(12.0)
  })

  it('elevates SPIRIT yield significantly for a Fire-dominant chart during a Fire transit', () => {
    const fireNatal: NatalChartData = {
      dominantElement: 'Fire',
      spiritScore: 95,
      essenceScore: 40,
      matterScore: 30,
      substanceScore: 50,
    }

    const fireTransit: TransitSkyData = {
      elementWeights: { Fire: 5.0, Water: 1.5, Earth: 1.5, Air: 2.0 },
    }

    const res = computeDiscriminantDailyYield(fireNatal, fireTransit, neutralSupply)

    expect(res.spirit).toBeGreaterThan(6.0)
    expect(res.spirit).toBeGreaterThan(res.matter)
    expect(res.total).toBe(12.0)
    expect(res.spirit + res.essence + res.matter + res.substance).toBeCloseTo(12.0, 4)
  })

  it('applies counter-cyclical anti-glut damping to MATTER when MATTER share exceeds 30%', () => {
    // Under LIVE_NETWORK_SUPPLY, MATTER is 37.51%
    const res = computeDiscriminantDailyYield(null, neutralTransit, LIVE_NETWORK_SUPPLY)

    expect(res.breakdown.matter.antiGlutFactor).toBeCloseTo(0.75, 2)
    expect(res.breakdown.spirit.antiGlutFactor).toBe(1.0)
    expect(res.breakdown.essence.antiGlutFactor).toBe(1.0)
    expect(res.breakdown.substance.antiGlutFactor).toBe(1.0)

    // MATTER yield is dampened below 3.0000
    expect(res.matter).toBeLessThan(3.0)
    expect(res.total).toBe(12.0)
    expect(res.spirit + res.essence + res.matter + res.substance).toBeCloseTo(12.0, 4)
  })

  it('strictly conserves 12.0000 tokens for all users across extreme skies (no premium tier)', () => {
    const extremeTransit: TransitSkyData = {
      elementWeights: { Fire: 12.0, Water: 0.5, Earth: 0.5, Air: 1.0 },
    }

    const resExtreme = computeDiscriminantDailyYield(
      { spiritScore: 80, essenceScore: 60, matterScore: 40, substanceScore: 60 },
      extremeTransit,
      LIVE_NETWORK_SUPPLY
    )
    expect(resExtreme.total).toBe(12.0)
    expect(
      resExtreme.spirit + resExtreme.essence + resExtreme.matter + resExtreme.substance
    ).toBeCloseTo(12.0, 4)
  })

  it('produces distinct, differentiated yields for different historical agent charts under the same sky', () => {
    const equinoxSky: TransitSkyData = {
      elementWeights: { Fire: 2.5, Water: 2.5, Earth: 2.5, Air: 2.5 },
    }

    // Leonardo da Vinci (Fire dominant: 0.90 Sp / 0.70 Es / 0.50 Ma / 0.70 Su)
    const daVinciNatal = resolveAgentNatalData('leonardo-da-vinci')
    const daVinciYield = computeDiscriminantDailyYield(
      daVinciNatal,
      equinoxSky,
      LIVE_NETWORK_SUPPLY
    )

    // Isaac Newton (Earth dominant: 0.88 Sp / 0.60 Es / 0.80 Ma / 0.75 Su)
    const newtonNatal = resolveAgentNatalData('isaac-newton')
    const newtonYield = computeDiscriminantDailyYield(newtonNatal, equinoxSky, LIVE_NETWORK_SUPPLY)

    // Both strictly total 12.0000
    expect(daVinciYield.total).toBe(12.0)
    expect(newtonYield.total).toBe(12.0)

    // Leonardo's Spirit yield exceeds Newton's Matter yield ratio
    expect(daVinciYield.spirit).toBeGreaterThan(newtonYield.spirit)
    expect(newtonYield.matter).toBeGreaterThan(daVinciYield.matter)
  })

  it('converts astronomical planet positions into valid 4-element transit weights', () => {
    const positions = {
      Sun: { sign: 'Leo', degree: 15, retrograde: false }, // Fire
      Moon: { sign: 'Cancer', degree: 10, retrograde: false }, // Water
      Mercury: { sign: 'Virgo', degree: 5, retrograde: false }, // Earth
      Venus: { sign: 'Libra', degree: 20, retrograde: false }, // Air
      Mars: { sign: 'Aries', degree: 8, retrograde: false }, // Fire
    }

    const transit = deriveTransitWeightsFromPositions(positions as any)
    expect(transit.elementWeights.Fire).toBe(2)
    expect(transit.elementWeights.Water).toBe(1)
    expect(transit.elementWeights.Earth).toBe(1)
    expect(transit.elementWeights.Air).toBe(1)
    expect(transit.dominantElement).toBe('Fire')
  })
})
