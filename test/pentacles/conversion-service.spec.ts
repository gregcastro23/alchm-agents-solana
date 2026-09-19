// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createConversionQuote,
  executeConversionQuote,
  signQuoteToken,
  verifyQuoteToken,
  MIN_PENTACLE_CONVERT_ATOMS,
  MIN_ESMS_CONVERT_ATOMS,
  getQuoteSigningSecret,
} from '@/lib/pentacles/service'
import { prisma } from '@/lib/db'
import { loadCanonicalPriceIndex } from '@/lib/economy/canonical-price-index'
import { syncCreditToAlchm } from '@/lib/alchm-credit-sync'
import { syncDebitToAlchm } from '@/lib/alchm-debit-sync'
import { EconomyService } from '@/lib/services/economyService'
import crypto from 'node:crypto'

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

describe('Pentacle Conversion Service (Phase 4.5 Hardened)', () => {
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

  // ==========================================
  // SAFETY & EDGE-CASE MUTATION TESTS (Phase 4.5 Hardening)
  // ==========================================

  it('SAFETY 1: Rejects quote token with tampered payload or signature (invalid_quote_token)', async () => {
    const quoteRes = await createConversionQuote({
      userId: 'usr-1',
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 10_000n,
    })
    if (!quoteRes.ok) return

    // Decode, tamper with outAmountAtoms, re-encode without updating HMAC
    const raw = Buffer.from(quoteRes.quoteToken, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw)
    parsed.payload.outAmountAtoms = '999999999' // attacker attempts to give themselves huge balance
    const tamperedToken = Buffer.from(JSON.stringify(parsed)).toString('base64url')

    const execRes = await executeConversionQuote(tamperedToken, 'usr-1')
    expect(execRes.ok).toBe(false)
    if (execRes.ok) return
    expect(execRes.code).toBe('invalid_quote_token')
    expect(execRes.message).toContain('signature verification failed')
  })

  it('SAFETY 2: Rejects quote token signed with a different / wrong secret', async () => {
    const quoteRes = await createConversionQuote({
      userId: 'usr-1',
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 10_000n,
    })
    if (!quoteRes.ok) return

    // Sign with rogue secret
    const raw = Buffer.from(quoteRes.quoteToken, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw)
    const rogueHmac = crypto
      .createHmac('sha256', 'rogue-unauthorized-secret')
      .update(JSON.stringify(parsed.payload))
      .digest('hex')
    const rogueToken = Buffer.from(
      JSON.stringify({ payload: parsed.payload, hmac: rogueHmac })
    ).toString('base64url')

    const execRes = await executeConversionQuote(rogueToken, 'usr-1')
    expect(execRes.ok).toBe(false)
    if (execRes.ok) return
    expect(execRes.code).toBe('invalid_quote_token')
    expect(execRes.message).toContain('signature verification failed')
  })

  it('SAFETY 3: Rejects expired quote token with 410 quote_expired', async () => {
    const quoteRes = await createConversionQuote({
      userId: 'usr-1',
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 10_000n,
    })
    if (!quoteRes.ok) return

    // Create a quote that expired 5 seconds ago and sign it legitimately
    const expiredPayload = {
      ...quoteRes.quote,
      quoteId: 'quote-expired-test-id',
      expiresAt: Date.now() - 5000,
    }
    const expiredToken = signQuoteToken(expiredPayload)

    const execRes = await executeConversionQuote(expiredToken, 'usr-1')
    expect(execRes.ok).toBe(false)
    if (execRes.ok) return
    expect(execRes.code).toBe('quote_expired')
    expect(execRes.status).toBe(410)
  })

  it('SAFETY 4: Rejects execution attempt by unauthorized caller with 403 unauthorized', async () => {
    const quoteRes = await createConversionQuote({
      userId: 'usr-1',
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 10_000n,
    })
    if (!quoteRes.ok) return

    // Caller is usr-2 trying to execute usr-1's quote
    const execRes = await executeConversionQuote(quoteRes.quoteToken, 'usr-2')
    expect(execRes.ok).toBe(false)
    if (execRes.ok) return
    expect(execRes.code).toBe('unauthorized')
    expect(execRes.status).toBe(403)
  })

  it('SAFETY 5: Serverless multi-instance replay: Kitchen 409 already_applied halts execution and rejects with 409 quote_already_executed', async () => {
    const mockTransport = vi.fn()

    const quoteRes = await createConversionQuote({
      userId: 'usr-1',
      direction: 'esms_to_pentacles',
      element: 'spirit',
      amountAtoms: 10_000n,
    })
    if (!quoteRes.ok)
      return // Simulate Kitchen reporting idempotency hit from another server instance
    ;(syncDebitToAlchm as any).mockResolvedValueOnce({
      ok: true,
      reason: 'already_applied',
      userId: 'usr-1',
    })

    const execRes = await executeConversionQuote(quoteRes.quoteToken, 'usr-1', mockTransport as any)
    expect(execRes.ok).toBe(false)
    if (execRes.ok) return
    expect(execRes.code).toBe('quote_already_executed')
    expect(execRes.status).toBe(409)

    // Critical: SpacetimeDB must NEVER be credited on an already_applied hit!
    expect(mockTransport).not.toHaveBeenCalled()
  })

  it('SAFETY 6: Two-phase compensation on ESMS -> ⛤ SpacetimeDB credit failure', async () => {
    // SpacetimeDB transport fails
    const failingTransport = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'SpacetimeDB connection dropped',
    }))

    const quoteRes = await createConversionQuote({
      userId: 'usr-1',
      direction: 'esms_to_pentacles',
      element: 'spirit',
      amountAtoms: 10_000n,
    })
    if (!quoteRes.ok) return

    const execRes = await executeConversionQuote(
      quoteRes.quoteToken,
      'usr-1',
      failingTransport as any
    )
    expect(execRes.ok).toBe(false)
    if (execRes.ok) return
    expect(execRes.code).toBe('pentacle_credit_failed_compensated')
    expect(execRes.status).toBe(502)

    // Kitchen compensation refund was fired
    expect(syncCreditToAlchm).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: mockUser.email,
        source: 'pentacle_conversion_refund',
        idempotencyKey: `pentacle_conv_refund:${quoteRes.quote.quoteId}`,
      })
    )

    // ASOL mirror was compensated
    expect(EconomyService.creditTokens).toHaveBeenCalledWith(
      'usr-1',
      expect.objectContaining({ spirit: 1 }), // 10148 atoms = 1.0148 ESMS
      'pentacle_conversion_refund',
      expect.any(String),
      `pentacle_conv_refund:${quoteRes.quote.quoteId}`
    )
  })

  it('SAFETY 7: ⛤ -> ESMS Kitchen credit network error does NOT blindly refund escrow', async () => {
    // Escrow succeeds in SpacetimeDB
    const mockTransport = vi.fn(async (url: string) => {
      if (url.includes('refund_pentacle_conversion')) {
        throw new Error('ILLEGAL_REFUND: Should not refund on unconfirmed network error!')
      }
      return { ok: true, status: 200, json: async () => [{ rows: [] }], text: async () => '' }
    })

    // Kitchen fails with network timeout on both initial call and retry
    ;(syncCreditToAlchm as any).mockResolvedValue({
      ok: false,
      error: 'FetchError: network timeout (10s)',
    })

    const quoteRes = await createConversionQuote({
      userId: 'usr-1',
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 10_000n,
    })
    if (!quoteRes.ok) return

    const execRes = await executeConversionQuote(quoteRes.quoteToken, 'usr-1', mockTransport as any)
    expect(execRes.ok).toBe(false)
    if (execRes.ok) return
    expect(execRes.code).toBe('kitchen_sync_pending')
    expect(execRes.status).toBe(504)

    // Escrow was NOT refunded
    expect(mockTransport).not.toHaveBeenCalledWith(
      expect.stringContaining('refund_pentacle_conversion'),
      expect.anything()
    )
  })

  it('SAFETY 8: ⛤ -> ESMS Kitchen definitive rejection (400) safely refunds escrow', async () => {
    const mockTransport = vi.fn(async (url: string) => {
      return { ok: true, status: 200, json: async () => [{ rows: [] }], text: async () => '' }
    })

    // Kitchen definitively rejects with 400 invalid request
    ;(syncCreditToAlchm as any).mockResolvedValue({
      ok: false,
      error: 'HTTP 400: User account is frozen or invalid',
    })

    const quoteRes = await createConversionQuote({
      userId: 'usr-1',
      direction: 'pentacles_to_esms',
      element: 'spirit',
      amountAtoms: 10_000n,
    })
    if (!quoteRes.ok) return

    const execRes = await executeConversionQuote(quoteRes.quoteToken, 'usr-1', mockTransport as any)
    expect(execRes.ok).toBe(false)
    if (execRes.ok) return
    expect(execRes.code).toBe('kitchen_credit_failed')
    expect(execRes.status).toBe(400)

    // Escrow refund was called
    expect(mockTransport).toHaveBeenCalledWith(
      expect.stringContaining('refund_pentacle_conversion'),
      expect.anything()
    )
  })

  it('SAFETY 9: Fails closed in production if PENTACLE_QUOTE_SECRET is missing', () => {
    const originalEnv = process.env.NODE_ENV
    const originalSecret = process.env.PENTACLE_QUOTE_SECRET
    try {
      process.env.NODE_ENV = 'production'
      delete process.env.PENTACLE_QUOTE_SECRET

      expect(() => getQuoteSigningSecret()).toThrow(
        'PENTACLE_QUOTE_SECRET environment variable is required in production'
      )
    } finally {
      process.env.NODE_ENV = originalEnv
      if (originalSecret) process.env.PENTACLE_QUOTE_SECRET = originalSecret
    }
  })
})
