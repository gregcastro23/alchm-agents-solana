import { describe, expect, it } from 'vitest'
import { AGENT_DAILY_YIELD, AGENT_OPERATION_COSTS } from '@/lib/economy-config'
import { calculateAgentChatPricing, dominantTransitElement } from '@/lib/economy/chat-pricing'

const sky = (spirit: number, essence: number, matter: number, substance: number) => ({
  'Alchemy Effects': {
    'Total Spirit': spirit,
    'Total Essence': essence,
    'Total Matter': matter,
    'Total Substance': substance,
  },
})

describe('chart-dynamic ESMS chat pricing', () => {
  it('uses all four ESMS axes for the rebalanced base price', () => {
    expect(AGENT_OPERATION_COSTS.unified_chat).toEqual({
      Spirit: 2,
      Essence: 1,
      Matter: 1,
      Substance: 1,
    })
  })

  it('finds the dominant live-sky element from legacy alchemy totals', () => {
    expect(dominantTransitElement(sky(2, 9, 4, 1))).toBe('Water')
    expect(dominantTransitElement(sky(2, 1, 4, 11))).toBe('Air')
    expect(dominantTransitElement(sky(4, 4, 1, 1))).toBeNull()
  })

  it('applies an exact 0.5x resonance discount without rounding fractional axes up', () => {
    expect(calculateAgentChatPricing('Water', sky(2, 9, 4, 1))).toMatchObject({
      relationship: 'resonance',
      multiplier: 0.5,
      agentElement: 'Water',
      transitElement: 'Water',
      cost: { Spirit: 1, Essence: 0.5, Matter: 0.5, Substance: 0.5 },
    })
  })

  it('applies the configured clash markup to opposing elements', () => {
    expect(calculateAgentChatPricing('Fire', sky(2, 9, 4, 1))).toMatchObject({
      relationship: 'clash',
      multiplier: 1.5,
      cost: { Spirit: 3, Essence: 1.5, Matter: 1.5, Substance: 1.5 },
    })
  })

  it('keeps the base price for non-opposing elements and unavailable transit data', () => {
    expect(calculateAgentChatPricing('Air', sky(2, 9, 4, 1))).toMatchObject({
      relationship: 'neutral',
      multiplier: 1,
      cost: AGENT_OPERATION_COSTS.unified_chat,
    })
    expect(calculateAgentChatPricing('Earth', {})).toMatchObject({
      relationship: 'neutral',
      multiplier: 1,
      transitElement: null,
      cost: AGENT_OPERATION_COSTS.unified_chat,
    })
  })

  it('lets one base daily claim fund two neutral interactions', () => {
    const perAxisYield = AGENT_DAILY_YIELD / 4
    const { cost } = calculateAgentChatPricing('Air', sky(2, 9, 4, 1))

    expect(Math.floor(perAxisYield / cost.Spirit)).toBeGreaterThanOrEqual(2)
    expect(Math.floor(perAxisYield / cost.Essence)).toBeGreaterThanOrEqual(2)
    expect(Math.floor(perAxisYield / cost.Matter)).toBeGreaterThanOrEqual(2)
    expect(Math.floor(perAxisYield / cost.Substance)).toBeGreaterThanOrEqual(2)
  })

  it('funds at least two interactions even at the maximum clash price', () => {
    const perAxisYield = AGENT_DAILY_YIELD / 4
    const { cost } = calculateAgentChatPricing('Fire', sky(2, 9, 4, 1))

    expect(Math.floor(perAxisYield / cost.Spirit)).toBeGreaterThanOrEqual(2)
    expect(Math.floor(perAxisYield / cost.Essence)).toBeGreaterThanOrEqual(2)
    expect(Math.floor(perAxisYield / cost.Matter)).toBeGreaterThanOrEqual(2)
    expect(Math.floor(perAxisYield / cost.Substance)).toBeGreaterThanOrEqual(2)
  })
})
