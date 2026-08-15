import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/unified-multi-agent-chat/route'
import { mockUnifiedAgents } from '../fixtures/mock-data'
import { backend } from '@/lib/backend'
import { EconomyService } from '@/lib/services/economyService'
import { auth } from '@/lib/auth'
import { parseStreamResponse } from '../stream-helper'
import { ORACLE_CHAMBER_COST, FLASH_EPIPHANY_COST } from '@/lib/economy-config'
import { resolveWeeklyFeature } from '@/lib/agents/weekly-feature-rotation'

vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
}))

vi.mock('@/lib/models/registry', () => ({
  OPENAI: {
    GPT_5_5: 'gpt-4o',
    LEGACY_GPT_4O: 'gpt-4o',
    GPT_5_4_MINI: 'gpt-4o-mini',
    LEGACY_GPT_4O_MINI: 'gpt-4o-mini',
  },
  resolveDefaultModel: vi.fn((tier: string) => `mock-${tier}-model`),
  resolveOpenAIModel: vi.fn((tier: string) => `mock-openai-${tier}-model`),
  resolveOracleModel: vi.fn(() => ({ modelId: 'deepseek-v3' })),
  resolveEpiphanyModel: vi.fn(() => ({ modelId: 'deepseek-r1' })),
}))

vi.mock('@/lib/backend', () => ({
  getAlchemicalQuantitiesLegacy: vi.fn(async () => ({
    'Alchemy Effects': {
      'Total Spirit': 10,
      'Total Essence': 10,
      'Total Matter': 10,
      'Total Substance': 10,
    },
  })),
  backend: {
    agents: {
      chat: vi.fn(req =>
        Promise.resolve({
          text: `Responded with model tier ${req.modelTier}`,
          agentId: req.agentId,
          sessionId: req.sessionId || 'test-session',
          metadata: {
            model: req.modelTier === 'primary' ? 'deepseek-v3' : 'gemini-2.5-flash',
            rag_used: false,
          },
        })
      ),
    },
  },
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn((model: string) => `direct-openai-${model}`),
  createOpenAI: vi.fn(() => vi.fn((model: string) => `mocked-${model}`)),
}))

vi.mock('@/lib/agent-cache-system', () => ({
  agentCache: {
    getCachedResponse: vi.fn(),
    cacheResponse: vi.fn(),
  },
  buildCacheContext: vi.fn(() => ({ cacheKey: 'test-cache' })),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  requireAuthOrRedirect: vi.fn(),
}))

vi.mock('@/lib/services/economyService', () => ({
  EconomyService: {
    debitDynamic: vi.fn(),
    getBalances: vi.fn(),
  },
}))

vi.mock('@/lib/agents/weekly-feature-rotation', () => ({
  resolveWeeklyFeature: vi.fn(async () => ({ freeAgentIds: [] })),
}))

vi.mock('@/lib/agents/sacred-stats-prompt-generator', () => ({
  generateConsciousnessInformedPrompt: vi.fn(() => 'Mocked prompt'),
}))

vi.mock('@/lib/observability/tracker', () => ({
  observabilityTracker: {
    startTrace: vi.fn(() => 'trace-e2e-chat'),
    evaluateMetrics: vi.fn(() => ({ actionCompletion: 1 })),
    completeTrace: vi.fn(),
    recordError: vi.fn(),
    recordRoutingDecision: vi.fn(),
  },
}))

vi.mock('@/lib/consciousness/unified-tracker', () => ({
  unifiedTracker: {
    captureSnapshot: vi.fn(),
  },
}))

describe('Unified Multi-Agent Chat Modes & Economy Infusion Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as any).mockResolvedValue({ user: { id: 'test-user-e2e' } })
    ;(EconomyService.debitDynamic as any).mockResolvedValue({ ok: true, balances: {} })
    ;(resolveWeeklyFeature as any).mockResolvedValue({ freeAgentIds: [] })
  })

  it('handles mode: "standard" with free weekly rotation agent (zero debit)', async () => {
    ;(resolveWeeklyFeature as any).mockResolvedValueOnce({
      freeAgentIds: [mockUnifiedAgents[0].id],
    })

    const req = new NextRequest('http://localhost/api/unified-multi-agent-chat', {
      method: 'POST',
      body: JSON.stringify({
        agents: [mockUnifiedAgents[0]],
        message: 'Hello free agent',
        mode: 'standard',
        context: {
          sessionHistory: [],
          enableMemoryPersistence: false,
          realtimeUpdates: false,
          variant: 'standard',
        },
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(200)
    expect(EconomyService.debitDynamic).not.toHaveBeenCalled()

    const parsed = await parseStreamResponse(response)
    expect(parsed).toBeDefined()
    expect(backend.agents.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        modelTier: 'free',
      })
    )
  })

  it('handles mode: "byok" with zero platform token debit', async () => {
    const req = new NextRequest('http://localhost/api/unified-multi-agent-chat', {
      method: 'POST',
      body: JSON.stringify({
        agents: [mockUnifiedAgents[0]],
        message: 'Hello with my own key',
        mode: 'byok',
        context: {
          sessionHistory: [],
          enableMemoryPersistence: false,
          realtimeUpdates: false,
          variant: 'standard',
        },
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(200)
    expect(EconomyService.debitDynamic).not.toHaveBeenCalled()
  })

  it('handles mode: "standard" with non-free agent debits dynamic consultation fee', async () => {
    const req = new NextRequest('http://localhost/api/unified-multi-agent-chat', {
      method: 'POST',
      body: JSON.stringify({
        agents: [mockUnifiedAgents[0]],
        message: 'Hello standard paid agent',
        mode: 'standard',
        context: {
          sessionHistory: [],
          enableMemoryPersistence: false,
          realtimeUpdates: false,
          variant: 'standard',
        },
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(200)
    expect(EconomyService.debitDynamic).toHaveBeenCalledWith('test-user-e2e', expect.any(Object))
  })

  it('rejects unauthenticated requests for mode: "oracle" with 402 and 20 ESMS cost', async () => {
    ;(auth as any).mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/unified-multi-agent-chat', {
      method: 'POST',
      body: JSON.stringify({
        agents: [mockUnifiedAgents[0]],
        message: 'Delve into the oracle realm',
        mode: 'oracle',
        context: {
          sessionHistory: [],
          enableMemoryPersistence: false,
          realtimeUpdates: false,
          variant: 'standard',
        },
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(402)
    const json = await response.json()
    expect(json.isPaymentRequired).toBe(true)
    expect(json.requiredTokens).toEqual(ORACLE_CHAMBER_COST)
  })

  it('rejects insufficient balance for mode: "oracle" with 402', async () => {
    ;(EconomyService.debitDynamic as any).mockResolvedValueOnce({
      ok: false,
      error: 'INSUFFICIENT_FUNDS',
    })

    const req = new NextRequest('http://localhost/api/unified-multi-agent-chat', {
      method: 'POST',
      body: JSON.stringify({
        agents: [mockUnifiedAgents[0]],
        message: 'Oracle consultation',
        mode: 'oracle',
        context: {
          sessionHistory: [],
          enableMemoryPersistence: false,
          realtimeUpdates: false,
          variant: 'standard',
        },
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(402)
    const json = await response.json()
    expect(json.error).toContain('Insufficient tokens to enter The Oracle Chamber')
    expect(json.requiredTokens).toEqual(ORACLE_CHAMBER_COST)
  })

  it('authorizes mode: "oracle" with balance debit of 20 ESMS and routes to primary tier', async () => {
    const req = new NextRequest('http://localhost/api/unified-multi-agent-chat', {
      method: 'POST',
      body: JSON.stringify({
        agents: [mockUnifiedAgents[0]],
        message: 'Deep Oracle prophecy',
        mode: 'oracle',
        context: {
          sessionHistory: [],
          enableMemoryPersistence: false,
          realtimeUpdates: false,
          variant: 'standard',
        },
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(200)

    expect(EconomyService.debitDynamic).toHaveBeenCalledWith(
      'test-user-e2e',
      ORACLE_CHAMBER_COST,
      expect.objectContaining({
        idempotencyKey: expect.stringContaining('oracle:test-user-e2e:'),
      })
    )

    expect(backend.agents.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        modelTier: 'primary',
      })
    )
  })

  it('rejects unauthenticated requests for mode: "epiphany" with 402 and 8 ESMS cost', async () => {
    ;(auth as any).mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/unified-multi-agent-chat', {
      method: 'POST',
      body: JSON.stringify({
        agents: [mockUnifiedAgents[0]],
        message: 'Flash spark of insight',
        mode: 'epiphany',
        context: {
          sessionHistory: [],
          enableMemoryPersistence: false,
          realtimeUpdates: false,
          variant: 'standard',
        },
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(402)
    const json = await response.json()
    expect(json.isPaymentRequired).toBe(true)
    expect(json.requiredTokens).toEqual(FLASH_EPIPHANY_COST)
  })

  it('authorizes mode: "epiphany" with balance debit of 8 ESMS and routes to reflective tier', async () => {
    const req = new NextRequest('http://localhost/api/unified-multi-agent-chat', {
      method: 'POST',
      body: JSON.stringify({
        agents: [mockUnifiedAgents[0]],
        message: 'Epiphany reasoning',
        mode: 'epiphany',
        context: {
          sessionHistory: [],
          enableMemoryPersistence: false,
          realtimeUpdates: false,
          variant: 'standard',
        },
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(200)

    expect(EconomyService.debitDynamic).toHaveBeenCalledWith(
      'test-user-e2e',
      FLASH_EPIPHANY_COST,
      expect.objectContaining({
        idempotencyKey: expect.stringContaining('epiphany:test-user-e2e:'),
      })
    )

    expect(backend.agents.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        modelTier: 'reflective',
      })
    )
  })
})
