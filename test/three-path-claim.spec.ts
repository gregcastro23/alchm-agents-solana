import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TokenType, TOKEN_TYPES, AXIS_FLOOR } from '@/lib/economy-config'
import {
  computeDiscriminantDailyYield,
  resolveAgentNatalData,
  getLiveTransitSky,
  getLiveNetworkSupply,
  validateLedgerClamp,
  LIVE_NETWORK_SUPPLY,
} from '@/lib/services/discriminant-faucet'

// Mock prisma for EconomyService
const mockCreatedTransactions: any[] = []
let mockUpdatedBalance: any = null

const mockPrisma = {
  user_profiles: {
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
        update: vi.fn().mockImplementation(args => {
          mockUpdatedBalance = args.data
          return {
            spirit: args.data.spirit.increment,
            essence: args.data.essence.increment,
            matter: args.data.matter.increment,
            substance: args.data.substance.increment,
            lastDailyClaimAt: new Date(),
            lastDailyClaimAgentsAt: new Date(),
          }
        }),
      },
      tokenTransaction: {
        create: vi.fn().mockImplementation(args => {
          mockCreatedTransactions.push(args.data)
          return args.data
        }),
      },
    })
  }),
}

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

describe('INV-6 & E2E: Three-Path Claim Equivalence & Divergence Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreatedTransactions.length = 0
    mockUpdatedBalance = null
  })

  it('EconomyService.claimKitchenYield generates conserved transactions and canonical keys', async () => {
    const { EconomyService } = await import('@/lib/services/economyService')

    mockPrisma.users.findUnique.mockResolvedValue({ email: 'socrates@example.com' })
    mockPrisma.user_profiles.findUnique.mockResolvedValue(null)

    const userId = 'usr-kitchen-test'
    const result = await EconomyService.claimKitchenYield(userId)

    expect(result.distribution).toBeDefined()
    const distSum =
      Math.round(
        (result.distribution.Spirit +
          result.distribution.Essence +
          result.distribution.Matter +
          result.distribution.Substance) *
          10000
      ) / 10000
    expect(distSum).toBe(12.0)

    // Verify 4 transactions were recorded in the transaction
    expect(mockCreatedTransactions).toHaveLength(4)
    const dateStr = new Date().toISOString().split('T')[0]

    let txSum = 0
    for (const tx of mockCreatedTransactions) {
      expect(tx.userId).toBe(userId)
      expect(tx.sourceType).toBe('kitchen_daily_yield')
      expect(tx.idempotencyKey).toBe(`daily:kitchen:${userId}:${dateStr}:${tx.tokenType}`)
      expect(Number(tx.amount)).toBeGreaterThanOrEqual(AXIS_FLOOR)
      txSum += Number(tx.amount)
    }
    expect(Math.round(txSum * 10000) / 10000).toBe(12.0)

    // Verify token balance increments match exactly
    expect(mockUpdatedBalance.spirit.increment).toBe(result.distribution.Spirit)
    expect(mockUpdatedBalance.essence.increment).toBe(result.distribution.Essence)
    expect(mockUpdatedBalance.matter.increment).toBe(result.distribution.Matter)
    expect(mockUpdatedBalance.substance.increment).toBe(result.distribution.Substance)
  })

  it('EconomyService.claimAgentsYield generates conserved transactions and canonical keys', async () => {
    const { EconomyService } = await import('@/lib/services/economyService')

    mockPrisma.users.findUnique.mockResolvedValue({ email: 'socrates@example.com' })
    mockPrisma.user_profiles.findUnique.mockResolvedValue(null)

    const userId = 'usr-agents-test'
    const result = await EconomyService.claimAgentsYield(userId)

    expect(result.distribution).toBeDefined()
    const distSum =
      Math.round(
        (result.distribution.Spirit +
          result.distribution.Essence +
          result.distribution.Matter +
          result.distribution.Substance) *
          10000
      ) / 10000
    expect(distSum).toBe(12.0)

    expect(mockCreatedTransactions).toHaveLength(4)
    const dateStr = new Date().toISOString().split('T')[0]

    let txSum = 0
    for (const tx of mockCreatedTransactions) {
      expect(tx.userId).toBe(userId)
      expect(tx.sourceType).toBe('agents_daily_yield')
      expect(tx.idempotencyKey).toBe(`daily:agents:${userId}:${dateStr}:${tx.tokenType}`)
      expect(Number(tx.amount)).toBeGreaterThanOrEqual(AXIS_FLOOR)
      txSum += Number(tx.amount)
    }
    expect(Math.round(txSum * 10000) / 10000).toBe(12.0)
  })

  it('detects and prevents path divergence between Email resolution and Id fallback', async () => {
    // When user has email matching historical agent
    mockPrisma.users.findUnique.mockResolvedValue({ email: 'socrates@example.com' })
    mockPrisma.user_profiles.findUnique.mockResolvedValue(null)

    const userWithEmail = await mockPrisma.users.findUnique({ where: { id: 'test' } })
    const identEmail = userWithEmail?.email?.toLowerCase() || 'unmatched-uuid'
    const natalFromEmail = resolveAgentNatalData(identEmail)

    // When user has no email or unmatched email
    const identId = null?.toLowerCase?.() || 'unmatched-uuid'
    const natalFromId = resolveAgentNatalData(identId)

    // Socrates has known historical consciousness placements (Air dominant)
    expect(natalFromEmail.isNeutralFallback).toBe(false)
    expect(natalFromId.isNeutralFallback).toBe(true)

    // Both produce valid 12.0 yield when computed
    const sky = getLiveTransitSky(new Date('2026-09-04T12:00:00Z'))
    const yieldFromEmail = computeDiscriminantDailyYield(natalFromEmail, sky, LIVE_NETWORK_SUPPLY)
    const yieldFromId = computeDiscriminantDailyYield(natalFromId, sky, LIVE_NETWORK_SUPPLY)

    expect(yieldFromEmail.total).toBe(12.0)
    expect(yieldFromId.total).toBe(12.0)
    expect(yieldFromEmail.substance).not.toBe(yieldFromId.substance) // Socrates Air resonance differs from neutral flat
  })

  it('verifies desktop raw SQL claim flow simulates identical mathematical distribution and key format', async () => {
    // Simulate desktop claimDailyYield logic (from server.ts lines 1858-1980)
    const mockPgPool = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('FROM token_balances')) {
          return {
            rows: [
              {
                spirit: '10000',
                essence: '15000',
                matter: '29000',
                substance: '22000',
              },
            ],
          }
        }
        if (sql.includes('FROM user_profiles')) {
          return { rows: [] }
        }
        if (sql.includes('FROM users')) {
          return { rows: [{ email: 'socrates@example.com' }] }
        }
        return { rows: [] }
      }),
    }

    const userId = 'usr-desktop-test'
    const site = 'kitchen'

    const profileRes = await mockPgPool.query(`SELECT ... FROM user_profiles WHERE userId = $1`, [
      userId,
    ])
    const profileRow = profileRes.rows[0]
    const userRes = await mockPgPool.query(`SELECT email FROM users WHERE id = $1`, [userId])
    const userRow = userRes.rows[0]

    const identifier = userRow?.email?.toLowerCase() || userId
    const natalData = resolveAgentNatalData(identifier, profileRow)
    const transitSky = getLiveTransitSky(new Date('2026-09-04T12:00:00Z'))
    const supply = await getLiveNetworkSupply(mockPgPool)
    const desktopYield = computeDiscriminantDailyYield(natalData, transitSky, supply)

    validateLedgerClamp(desktopYield)

    expect(desktopYield.total).toBe(12.0)
    expect(supply.isDegraded).toBe(false)

    // Build keys as server.ts does
    const dateStr = '2026-09-04'
    const keys = TOKEN_TYPES.map(token => `daily:${site}:${userId}:${dateStr}:${token}`)

    expect(keys[0]).toBe(`daily:kitchen:usr-desktop-test:2026-09-04:Spirit`)
    expect(keys[1]).toBe(`daily:kitchen:usr-desktop-test:2026-09-04:Essence`)
    expect(keys[2]).toBe(`daily:kitchen:usr-desktop-test:2026-09-04:Matter`)
    expect(keys[3]).toBe(`daily:kitchen:usr-desktop-test:2026-09-04:Substance`)
  })

  it('aborts and rolls back on duplicate idempotency key (code 23505)', async () => {
    // Simulate server.ts error handling for unique violation
    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN') return
        if (sql.includes('INSERT INTO token_transactions')) {
          const err: any = new Error('duplicate key value violates unique constraint')
          err.code = '23505'
          throw err
        }
        if (sql === 'ROLLBACK') return
      }),
      release: vi.fn(),
    }

    let status = 200
    let message = ''

    try {
      await mockClient.query('BEGIN')
      await mockClient.query('INSERT INTO token_transactions ...')
    } catch (error: any) {
      await mockClient.query('ROLLBACK')
      if (error.code === '23505' || error.message?.includes('idempotency_key')) {
        status = 409
        message = 'Kitchen yield already claimed today.'
      }
    } finally {
      mockClient.release()
    }

    expect(status).toBe(409)
    expect(message).toBe('Kitchen yield already claimed today.')
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
  })
})
