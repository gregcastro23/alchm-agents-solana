import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  chat: vi.fn(),
  currentAlchemy: vi.fn(),
  debitDynamic: vi.fn(),
  getBalances: vi.fn(),
  isAgentFreeThisWeek: vi.fn(),
  isAgentFreeInCachedRotation: vi.fn(),
  logInteraction: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/backend', () => ({
  backend: { agents: { chat: mocks.chat } },
  getAlchemicalQuantitiesLegacy: mocks.currentAlchemy,
}))
vi.mock('@/lib/agents/persona/build-agent-context', () => ({
  buildAgentContext: vi.fn(() => ({
    agent: { consciousness: { dominantElement: 'Water' } },
    personaBlock: 'Water guide persona',
    cacheKey: 'water-guide',
  })),
}))
vi.mock('@/lib/consciousness-persistence', () => ({
  consciousnessPersistence: { logInteraction: mocks.logInteraction },
}))
vi.mock('@/lib/services/economyService', () => ({
  EconomyService: {
    ZERO_BALANCES: {
      spirit: 0,
      essence: 0,
      matter: 0,
      substance: 0,
      lastDailyClaimAt: null,
      lastDailyClaimAgentsAt: null,
    },
    debitDynamic: mocks.debitDynamic,
    getBalances: mocks.getBalances,
  },
}))
vi.mock('@/lib/agents/weekly-feature-rotation', () => ({
  isAgentFreeThisWeek: mocks.isAgentFreeThisWeek,
  isAgentFreeInCachedRotation: mocks.isAgentFreeInCachedRotation,
}))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}))
vi.mock('@/lib/utils/sanitizer', () => ({ sanitizePromptInput: (value: string) => value }))
vi.mock('@/lib/walrus', () => ({
  augmentPersonaWithMemory: vi.fn(async (persona: string) => persona),
  rememberConversation: vi.fn(async () => undefined),
}))
vi.mock('@/lib/premium/entitlements', () => ({
  getEntitlements: vi.fn(async () => ({ tier: 'free', isSubscribed: false, byokProviders: [] })),
}))
vi.mock('@/lib/premium/tiers', () => ({ capModelTier: vi.fn(() => 'free') }))
vi.mock('@/lib/historical-agents-db', () => ({
  HistoricalAgentsService: { awardXp: vi.fn(async () => undefined), awardEvs: vi.fn() },
}))
vi.mock('@/lib/security-audit-logger', () => ({ logSecurityEvent: vi.fn() }))

import { POST } from '@/app/api/agents/unified/route'

function request(parameters: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/agents/unified', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'chat-request-1' },
    body: JSON.stringify({ action: 'chat', parameters }),
  })
}

const balances = {
  spirit: 8,
  essence: 8,
  matter: 8,
  substance: 8,
  lastDailyClaimAt: null,
  lastDailyClaimAgentsAt: null,
}

describe('/api/agents/unified ESMS pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.isAgentFreeThisWeek.mockResolvedValue(false)
    mocks.isAgentFreeInCachedRotation.mockReturnValue(false)
    mocks.currentAlchemy.mockResolvedValue({
      'Alchemy Effects': {
        'Total Spirit': 1,
        'Total Essence': 9,
        'Total Matter': 3,
        'Total Substance': 2,
      },
    })
    mocks.debitDynamic.mockResolvedValue({ ok: true, balances })
    mocks.getBalances.mockResolvedValue(balances)
    mocks.chat.mockResolvedValue({ text: 'The water is aligned.' })
    mocks.logInteraction.mockResolvedValue(undefined)
  })

  it('debits the chart-resonant price for an authenticated single-agent chat', async () => {
    const response = await POST(request({ agentId: 'water-guide', message: 'Speak.' }))

    expect(response.status).toBe(200)
    expect(mocks.debitDynamic).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        Spirit: expect.any(Number),
        Essence: expect.any(Number),
        Matter: expect.any(Number),
        Substance: expect.any(Number),
      }),
      { idempotencyKey: expect.stringMatching(/^unified_chat:user-1:[a-f0-9]{64}$/) }
    )
  })

  it('falls back to the accessible base price when live transit calculation is unavailable', async () => {
    mocks.currentAlchemy.mockRejectedValueOnce(new Error('ephemeris offline'))

    const response = await POST(request({ agentId: 'water-guide', message: 'Speak.' }))

    expect(response.status).toBe(200)
    expect(mocks.debitDynamic).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        Spirit: expect.any(Number),
        Essence: expect.any(Number),
        Matter: expect.any(Number),
        Substance: expect.any(Number),
      }),
      { idempotencyKey: expect.stringMatching(/^unified_chat:user-1:[a-f0-9]{64}$/) }
    )
  })

  it('returns the actual dynamic requirement when a debit cannot be covered', async () => {
    mocks.debitDynamic.mockResolvedValueOnce({ ok: false, reason: 'insufficient_funds' })

    const response = await POST(request({ agentId: 'water-guide', message: 'Speak.' }))
    const body = await response.json()

    expect(response.status).toBe(402)
    expect(body.data.required).toEqual(
      expect.objectContaining({
        Spirit: expect.any(Number),
        Essence: expect.any(Number),
        Matter: expect.any(Number),
        Substance: expect.any(Number),
      })
    )
    expect(mocks.chat).not.toHaveBeenCalled()
  })

  it('lets an unauthenticated guest use the weekly free rotation without any debit', async () => {
    mocks.auth.mockResolvedValueOnce(null)
    mocks.isAgentFreeThisWeek.mockResolvedValueOnce(true)

    const response = await POST(request({ agentId: 'water-guide', message: 'Speak.' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.free).toBe(true)
    expect(body.balances).toEqual(expect.objectContaining({ spirit: 0, essence: 0 }))
    expect(mocks.currentAlchemy).not.toHaveBeenCalled()
    expect(mocks.debitDynamic).not.toHaveBeenCalled()
    expect(mocks.getBalances).not.toHaveBeenCalled()
    expect(mocks.chat).toHaveBeenCalledOnce()
  })

  it('uses the last-known free rotation when the live rotation lookup fails', async () => {
    mocks.auth.mockResolvedValueOnce(null)
    mocks.isAgentFreeThisWeek.mockRejectedValueOnce(new Error('ephemeris unavailable'))
    mocks.isAgentFreeInCachedRotation.mockReturnValueOnce(true)

    const response = await POST(request({ agentId: 'water-guide', message: 'Speak.' }))

    expect(response.status).toBe(200)
    expect(mocks.isAgentFreeInCachedRotation).toHaveBeenCalledWith('water-guide')
    expect(mocks.debitDynamic).not.toHaveBeenCalled()
    expect(mocks.chat).toHaveBeenCalledOnce()
  })

  it('fails open for a rate-limited guest when rotation resolution fails on a cold start', async () => {
    mocks.auth.mockResolvedValueOnce(null)
    mocks.isAgentFreeThisWeek.mockRejectedValueOnce(new Error('ephemeris unavailable'))
    mocks.isAgentFreeInCachedRotation.mockReturnValueOnce(false)

    const response = await POST(request({ agentId: 'water-guide', message: 'Speak.' }))

    expect(response.status).toBe(200)
    expect(mocks.debitDynamic).not.toHaveBeenCalled()
    expect(mocks.chat).toHaveBeenCalledOnce()
  })

  it('binds a reused client key to the agent and message payload', async () => {
    await POST(request({ agentId: 'water-guide', message: 'First prompt.' }))
    await POST(request({ agentId: 'water-guide', message: 'Different prompt.' }))

    const firstKey = mocks.debitDynamic.mock.calls[0]?.[2]?.idempotencyKey
    const secondKey = mocks.debitDynamic.mock.calls[1]?.[2]?.idempotencyKey
    expect(firstKey).not.toBe(secondKey)
    expect(mocks.chat).toHaveBeenCalledTimes(2)
  })

  it('rejects an already-processed retry before generating another response', async () => {
    mocks.debitDynamic.mockResolvedValueOnce({
      ok: true,
      reason: 'already_applied',
      balances,
    })

    const response = await POST(request({ agentId: 'water-guide', message: 'Speak.' }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.data.code).toBe('CHAT_REQUEST_ALREADY_PROCESSED')
    expect(mocks.chat).not.toHaveBeenCalled()
  })
})
