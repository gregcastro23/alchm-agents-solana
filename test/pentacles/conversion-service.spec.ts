// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createConversionQuote,
  executeConversionQuote,
  signQuoteToken,
  verifyQuoteToken,
  MIN_PENTACLE_CONVERT_ATOMS,
  MIN_ESMS_CONVERT_ATOMS,
} from '@/lib/pentacles/service'
import { prisma } from '@/lib/db'
import { loadCanonicalPriceIndex } from '@/lib/economy/canonical-price-index'
import { syncCreditToAlchm } from '@/lib/alchm-credit-sync'
import { syncDebitToAlchm } from '@/lib/alchm-debit-sync'
import { EconomyService } from '@/lib/services/economyService'

vi.mock('@/lib/db', () => ({
  prisma: {
    users: { findUnique: vi.fn() },
    verifiedSolanaWallet: { findUnique: vi.fn() },
    user_natal_charts: { findFirst: vi.fn() },
    user_profiles: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/economy/canonical-price-index', () => ({
  loadCanonicalPriceIndex: vi.fn(),
}))

vi.mock('@/lib/alchm-credit-sync', () => ({
  syncCreditToAlchm: vi.fn(),
}))

vi.mock('@/lib/alchm-debit-sync', () => ({
  syncDebitToAlchm: vi.fn(),
}))

vi.mock('@/lib/services/economyService', () => ({
  EconomyService: {
    creditTokens: vi.fn(),
    debitDynamic: vi.fn(),
  },
}))

describe('Pentacle Conversion Service (Phase 4.5)', () => {
  const mockUser = { id: 'usr-1', email: 'alchemist@alchm.kitchen' }
  const mockWallet = { solanaPubKey: '4YCVh9KHrhN6mFSMvybGVqLeGfaRkfUtqrn19mLLJGku' }
  const mockChart = {
    spiritScore: 40,
    essenceScore: 20,
    matterScore: 20,
    substanceScore: 20,
    dominantElement: 'Fire',
  }
  const mockPriceIndex = {
    success: true,
    live: true,
    generatedAt: new Date().toISOString(),
    bucketStartUtc: new Date().toISOString(),
    compositeIndex: 1.2119,
    tokens: [
      { token: 'spirit', index: 1.2299 },
      { token: 'essence', index: 1.2569 },
      { token: 'matter', index: 1.1093 },
      { token: 'substance', index: 1.2517 },
    ],
    degraded: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.users.findUnique as any).mockResolvedValue(mockUser)
    ;(prisma.verifiedSolanaWallet.findUnique as any).mockResolvedValue(mockWallet)
    ;(prisma.user_natal_charts.findFirst as any).mockResolvedValue(mockChart)
    ;(loadCanonicalPriceIndex as any).mockResolvedValue(mockPriceIndex)
    ;(syncCreditToAlchm as any).mockResolvedValue({ ok: true, balances: {} })
    ;(syncDebitToAlchm as any).mockResolvedValue({ ok: true, transactionGroupId: 'tx-1' })
    ;(EconomyService.creditTokens as any).mockResolvedValue({ ok: true })
    ;(EconomyService.debitDynamic as any).mockResolvedValue({ ok: true })
  })

  it('creates quote successfully and signs tamper-proof quote token', async () => {
    const res = await createConversionQuote({
      userId: 'usr-1',
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 10_000n,
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return

    expect(res.quote.inAmountAtoms).toBe('10000')
    expect(res.quote.outAmountAtoms).toBe('9853')
    expect(res.quote.gateApplied).toBe(1.0)
    expect(res.quoteToken).toBeDefined()

    // Verify token unpacks correctly
    const verified = verifyQuoteToken(res.quoteToken)
    expect(verified.quoteId).toBe(res.quote.quoteId)
  })

  it('rejects quote when requested amount is below minimum', async () => {
    const res = await createConversionQuote({
      userId: 'usr-1',
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 9_999n, // below 10 ⛤
    })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('amount_below_minimum')
  })

  it('rejects quote when price index is degraded or stale', async () => {
    ;(loadCanonicalPriceIndex as any).mockResolvedValue({
      ...mockPriceIndex,
      degraded: ['spirit'],
    })

    const res = await createConversionQuote({
      userId: 'usr-1',
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 10_000n,
    })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('ticker_degraded')
  })

  it('executes ⛤ -> ESMS: escrows in SpacetimeDB, credits Kitchen, updates ASOL mirror, settles escrow', async () => {
    const mockTransport = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ rows: [] }],
      text: async () => '',
    }))

    const quoteRes = await createConversionQuote({
      userId: 'usr-1',
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 10_000n,
    })
    expect(quoteRes.ok).toBe(true)
    if (!quoteRes.ok) return

    const execRes = await executeConversionQuote(quoteRes.quoteToken, 'usr-1', mockTransport as any)
    expect(execRes.ok).toBe(true)
    if (!execRes.ok) return

    expect(execRes.settled).toBe(true)
    expect(execRes.outAmountAtoms).toBe('9853')

    // Kitchen was credited with idempotent key
    expect(syncCreditToAlchm).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: mockUser.email,
        source: 'pentacle_conversion',
        idempotencyKey: `pentacle_conv:${quoteRes.quote.quoteId}`,
      })
    )

    // ASOL mirror was updated
    expect(EconomyService.creditTokens).toHaveBeenCalledWith(
      'usr-1',
      expect.objectContaining({ spirit: 0.9853 }),
      'pentacle_conversion',
      expect.any(String),
      expect.stringMatching(/^pentacle_conv:/)
    )

    // SpacetimeDB reducers were invoked: escrow then settle
    expect(mockTransport).toHaveBeenCalled()
  })

  it('executes ESMS -> ⛤: debits Kitchen, debits ASOL mirror, credits free pentacles in SpacetimeDB', async () => {
    const mockTransport = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ rows: [] }],
      text: async () => '',
    }))

    const quoteRes = await createConversionQuote({
      userId: 'usr-1',
      direction: 'esms_to_pentacles',
      element: 'spirit',
      amountAtoms: 10_000n,
    })
    expect(quoteRes.ok).toBe(true)
    if (!quoteRes.ok) return

    const execRes = await executeConversionQuote(quoteRes.quoteToken, 'usr-1', mockTransport as any)
    expect(execRes.ok).toBe(true)
    if (!execRes.ok) return

    expect(execRes.settled).toBe(true)
    expect(syncDebitToAlchm).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: mockUser.email,
        operationType: 'pentacle_conversion',
        idempotencyKey: `pentacle_conv:${quoteRes.quote.quoteId}`,
      })
    )
    expect(EconomyService.debitDynamic).toHaveBeenCalled()
  })

  it('rejects duplicate execution of same quote with 409 quote_already_executed', async () => {
    const mockTransport = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ rows: [] }],
      text: async () => '',
    }))

    const quoteRes = await createConversionQuote({
      userId: 'usr-1',
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 10_000n,
    })
    if (!quoteRes.ok) return

    const first = await executeConversionQuote(quoteRes.quoteToken, 'usr-1', mockTransport as any)
    expect(first.ok).toBe(true)

    // Replay attempt
    const second = await executeConversionQuote(quoteRes.quoteToken, 'usr-1', mockTransport as any)
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.code).toBe('quote_already_executed')
  })
})
