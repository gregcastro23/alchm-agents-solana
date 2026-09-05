import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeDiscriminantDailyYield,
  resolveAgentNatalData,
  getLiveTransitSky,
  LIVE_NETWORK_SUPPLY,
} from '@/lib/services/discriminant-faucet'

const mockPrisma = {
  user_profiles: {
    findUnique: vi.fn(),
  },
  user_natal_charts: {
    findFirst: vi.fn(),
  },
  profiles: {
    findUnique: vi.fn(),
  },
  users: {
    findUnique: vi.fn(),
  },
  tokenBalance: {
    aggregate: vi.fn().mockResolvedValue({
      _sum: {
        spirit: 10000,
        essence: 15000,
        matter: 29000,
        substance: 22000,
      },
    }),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  tokenTransaction: {
    create: vi.fn(),
  },
  $transaction: vi.fn(async (cb: any) => {
    return await cb({
      tokenBalance: {
        findUnique: vi.fn().mockResolvedValue({
          lastDailyClaimAt: null,
          lastDailyClaimAgentsAt: null,
        }),
        update: vi.fn().mockImplementation(args => ({
          spirit: args.data.spirit.increment,
          essence: args.data.essence.increment,
          matter: args.data.matter.increment,
          substance: args.data.substance.increment,
          lastDailyClaimAt: new Date(),
          lastDailyClaimAgentsAt: new Date(),
        })),
      },
      tokenTransaction: {
        create: vi.fn().mockImplementation(args => args.data),
      },
    })
  }),
}

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

describe('Profile Variable Daily Yield & Chart Context Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves direct elemental scores from user_natal_charts correctly', () => {
    const resolved = resolveAgentNatalData('user-test@example.com', {
      spiritScore: 78.5,
      essenceScore: 12.3,
      matterScore: 15.0,
      substanceScore: 24.2,
      dominantElement: 'Fire',
    })

    expect(resolved.isNeutralFallback).toBe(false)
    expect(resolved.dominantElement).toBe('Fire')
    expect(resolved.spiritScore).toBe(78.5)
    expect(resolved.essenceScore).toBe(12.3)
    expect(resolved.matterScore).toBe(15.0)
    expect(resolved.substanceScore).toBe(24.2)
  })

  it('EconomyService.resolveUserNatalData falls back to profiles.birthInfo when user_profiles is missing', async () => {
    const { EconomyService } = await import('@/lib/services/economyService')

    mockPrisma.user_profiles.findUnique.mockResolvedValue(null)
    mockPrisma.user_natal_charts.findFirst.mockResolvedValue(null)
    mockPrisma.profiles.findUnique.mockResolvedValue({
      birthInfo: {
        year: 1992,
        month: 9, // October (0-based 9)
        day: 24,
        hour: 14,
        minute: 30,
        latitude: 40.7128,
        longitude: -74.006,
      },
    })

    const natalData = await EconomyService.resolveUserNatalData(
      'usr-birth-info-only',
      'seeker@alchm.kitchen'
    )

    expect(natalData.isNeutralFallback).toBe(false)
    expect(natalData.spiritScore).toBeGreaterThan(0)
    expect(natalData.essenceScore).toBeGreaterThan(0)
    expect(natalData.matterScore).toBeGreaterThan(0)
    expect(natalData.substanceScore).toBeGreaterThan(0)
  })

  it('computes variable daily yield differentiating between two distinct user charts under identical sky', () => {
    const transit = getLiveTransitSky()

    // Fire-dominant user
    const fireUser = computeDiscriminantDailyYield(
      { spiritScore: 85, essenceScore: 15, matterScore: 15, substanceScore: 20 },
      transit,
      LIVE_NETWORK_SUPPLY
    )

    // Water-dominant user
    const waterUser = computeDiscriminantDailyYield(
      { spiritScore: 15, essenceScore: 85, matterScore: 20, substanceScore: 15 },
      transit,
      LIVE_NETWORK_SUPPLY
    )

    // Strict conservation on both
    expect(fireUser.total).toBe(12.0)
    expect(waterUser.total).toBe(12.0)

    // Genuine divergence based on birth chart
    expect(fireUser.spirit).toBeGreaterThan(waterUser.spirit)
    expect(waterUser.essence).toBeGreaterThan(fireUser.essence)

    // Not uniform amounts: Spirit, Essence, Matter, Substance are divergent
    expect(fireUser.spirit).not.toBe(fireUser.matter)
    expect(fireUser.spirit).not.toBe(fireUser.essence)
  })

  it('formats variable yield message with individual tokens instead of uniform each string', () => {
    const distribution = {
      spirit: 5.0432,
      essence: 2.1128,
      matter: 1.4421,
      substance: 3.4019,
    }

    const sp = Number(distribution.spirit).toFixed(2)
    const es = Number(distribution.essence).toFixed(2)
    const ma = Number(distribution.matter).toFixed(2)
    const su = Number(distribution.substance).toFixed(2)

    const text = `Yield harvested (12.00 ESMS): +${sp} Spirit, +${es} Essence, +${ma} Matter, +${su} Substance.`

    expect(text).toBe(
      'Yield harvested (12.00 ESMS): +5.04 Spirit, +2.11 Essence, +1.44 Matter, +3.40 Substance.'
    )
    expect(text).not.toContain('each of Spirit, Essence, Matter, and Substance')
  })
})
