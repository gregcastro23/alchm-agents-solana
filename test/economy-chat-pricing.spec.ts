import { describe, expect, it } from 'vitest'
import {
  AGENT_DAILY_YIELD,
  AGENT_OPERATION_COSTS,
  UNIFIED_CHAT_BASE_COST,
} from '@/lib/economy-config'
import {
  calculateAgentChatPricing,
  dominantTransitElement,
  deriveAgentBaseCost,
  computeDignityWaveharmonics,
} from '@/lib/economy/chat-pricing'

const sky = (spirit: number, essence: number, matter: number, substance: number) => ({
  'Alchemy Effects': {
    'Total Spirit': spirit,
    'Total Essence': essence,
    'Total Matter': matter,
    'Total Substance': substance,
  },
})

describe('chart-dynamic ESMS chat pricing', () => {
  it('uses accessible four-axis sub-token baseline prices', () => {
    expect(AGENT_OPERATION_COSTS.unified_chat).toEqual({
      Spirit: 0.3,
      Essence: 0.2,
      Matter: 0.2,
      Substance: 0.2,
    })
  })

  it('derives accessible agent-specific base costs from chart/planetary orientation', () => {
    // Spirit-oriented (Fire / Sun / Jupiter)
    expect(deriveAgentBaseCost('Fire')).toEqual({
      Spirit: 0.4,
      Essence: 0.25,
      Matter: 0.25,
      Substance: 0.25,
    })
    // Essence-oriented (Water / Moon / Neptune)
    expect(deriveAgentBaseCost('Water')).toEqual({
      Spirit: 0.25,
      Essence: 0.4,
      Matter: 0.25,
      Substance: 0.25,
    })
    // Matter-oriented (Earth / Saturn)
    expect(deriveAgentBaseCost('Earth')).toEqual({
      Spirit: 0.25,
      Essence: 0.25,
      Matter: 0.4,
      Substance: 0.25,
    })
    // Substance-oriented (Air / Mercury)
    expect(deriveAgentBaseCost('Air')).toEqual({
      Spirit: 0.25,
      Essence: 0.25,
      Matter: 0.25,
      Substance: 0.4,
    })
  })

  it('calculates continuous dignity waveharmonics from live sky transits', () => {
    const harmonics = computeDignityWaveharmonics(sky(2, 9, 4, 1))
    expect(harmonics.Essence).toBeGreaterThan(0)
    expect(harmonics.Substance).toBeGreaterThan(0)
  })

  it('computes affordable resonant fees for Water agent during Water transit', () => {
    const pricing = calculateAgentChatPricing('Water', sky(2, 9, 4, 1))
    expect(pricing.relationship).toBe('resonance')
    expect(pricing.cost.Spirit).toBeLessThan(0.3)
    expect(pricing.cost.Essence).toBeLessThan(0.3)
    expect(pricing.cost.Matter).toBeLessThan(0.3)
    expect(pricing.cost.Substance).toBeLessThan(0.3)
  })

  it('keeps fees accessible even during maximum elemental clash', () => {
    const pricing = calculateAgentChatPricing('Fire', sky(2, 9, 4, 1))
    expect(pricing.relationship).toBe('clash')
    // Total cost remains well below 1.5 tokens
    const totalCost =
      pricing.cost.Spirit + pricing.cost.Essence + pricing.cost.Matter + pricing.cost.Substance
    expect(totalCost).toBeLessThan(1.5)
  })

  it('allows baseCostOverride for fixed baseline calculations', () => {
    expect(calculateAgentChatPricing('Air', sky(2, 9, 4, 1), UNIFIED_CHAT_BASE_COST)).toMatchObject(
      {
        relationship: 'neutral',
        multiplier: 1,
        baseCost: UNIFIED_CHAT_BASE_COST,
      }
    )
  })

  it('allows a daily yield claim to fund 20+ agent consultations', () => {
    const perAxisYield = AGENT_DAILY_YIELD / 4 // 6 of each token axis
    const waterCost = calculateAgentChatPricing('Water', sky(2, 9, 4, 1)).cost

    expect(Math.floor(perAxisYield / waterCost.Essence)).toBeGreaterThanOrEqual(20)
  })
})
