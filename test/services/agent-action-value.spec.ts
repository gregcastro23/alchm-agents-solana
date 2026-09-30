// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  agents: vi.fn(),
  stories: vi.fn(),
  update: vi.fn(),
  event: vi.fn(),
  balances: vi.fn(),
  debit: vi.fn(),
  feed: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    users: { findMany: mocks.agents, update: mocks.update },
    historical_agents: { findMany: mocks.stories },
    agent_action_events: { upsert: mocks.event },
  },
}))
vi.mock('@/lib/services/economyService', () => ({
  EconomyService: { getBalances: mocks.balances },
}))
vi.mock('@/lib/alchm-debit-sync', () => ({ syncDebitToAlchm: mocks.debit }))
vi.mock('@/lib/alchm-credit-sync', () => ({ syncCreditToAlchm: vi.fn() }))
vi.mock('@/lib/alchm-event-sync', () => ({ syncEventToAlchm: vi.fn() }))
vi.mock('@/lib/agents/feed-pusher', () => ({ feedPusherService: { pushActions: mocks.feed } }))
vi.mock('@/lib/agents/feed-activation-engine', () => ({}))
vi.mock('@/lib/services/discriminant-faucet', () => ({}))
vi.mock('@/lib/calculate-transits', () => ({
  getCurrentPlanetaryPositions: () => ({
    Sun: { sign: 'Leo', degree: 0 },
  }),
}))
vi.mock('@/lib/planetary-hour', () => ({
  PlanetaryHourCalculator: class {
    getPlanetaryHour() {
      return { planet: 'Sun', isDaytime: true }
    }
    getPlanetaryDay() {
      return 'Sun'
    }
  },
}))

import { AgentActionService } from '@/lib/services/agent-action-service'

const agent = (id = 'agent-1', email = 'socrates@agentic.alchm.kitchen') => ({
  id,
  email,
  name: 'Socrates',
  lastActivationAt: null,
  activationCount: 0,
  user_profiles: {
    natalPositions: [{ planet: 'Sun', sign: 'Leo', degree: 0, longitude: 120 }],
    natalChart: null,
    dominantElement: 'Fire',
    monicaConstant: 1.618,
    birthDate: new Date('1970-01-01'),
    birthTime: null,
    birthLocation: null,
    bio: null,
  },
})
const lopsided = { spirit: 0, essence: 0, matter: 800, substance: 0 }
const index = (prices = [0.9, 1.1, 1.5, 0.8]) => ({
  success: true,
  live: true,
  generatedAt: '2026-09-30T12:00:00.000Z',
  bucketStartUtc: '2026-09-30T12:00:00.000Z',
  aNumber: 5,
  multiplier: 1,
  dominantElement: 'Fire',
  sunSign: 'leo',
  isDiurnal: true,
  tokens: ['Spirit', 'Essence', 'Matter', 'Substance'].map((token, i) => ({
    token,
    index: prices[i],
    change24hPct: 0,
    weight: 0.25,
    sparkline: [1, prices[i]],
  })),
  compositeIndex: 1,
  composite24hPct: 0,
  degraded: null,
  basis: { model: 'ADR-011', engine: 'WTEN', constants: 'WTEN' },
  railsUsd: {
    mintPerTokenUsd: null,
    mintSource: null,
    redeemPerTokenUsd: null,
    redeemSource: null,
  },
  supply: { live: false, spirit: 0, essence: 0, matter: 0, substance: 0 },
})
const reply = (body: unknown) => new Response(JSON.stringify(body))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ALCHM_KITCHEN_SYNC_URL', 'https://kitchen.test/')
  vi.stubEnv('AGENT_CIRCLE_TRADING', '')
  mocks.agents.mockResolvedValue([agent()])
  mocks.stories.mockResolvedValue([])
  mocks.update.mockResolvedValue({})
  mocks.event.mockResolvedValue({})
  mocks.feed.mockResolvedValue({})
  mocks.balances.mockResolvedValue(lopsided)
  mocks.debit.mockResolvedValue({ ok: true })
  vi.mocked(fetch).mockResolvedValue(reply(index()))
})
afterEach(() => vi.unstubAllEnvs())

describe('activation and action selection honor the Swapping Bridge', () => {
  it('activates lopsided agents and chooses feed_post, sharing one quote per tick', async () => {
    mocks.agents.mockResolvedValue([agent(), agent('agent-2')])
    const result = await new AgentActionService().runTick()
    expect(result.activations.map(a => a.activated)).toEqual([true, true])
    expect(result.actionsExecuted).toBe(2)
    expect(fetch).toHaveBeenCalledOnce()
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://kitchen.test/api/economy/price-index')
    expect(mocks.debit).toHaveBeenCalledTimes(2)
    for (const [payload] of mocks.debit.mock.calls) {
      expect(payload.operationType).toBe('agent_feed_post')
      expect(payload.metadata.actionType).toBe('feed_post')
    }
  })

  it('values tokens at the index rather than counting units', async () => {
    // 0.3 Matter costs 3.3 at this index, enough for the 3-value feed basket.
    mocks.balances.mockResolvedValue({ ...lopsided, matter: 0.3 })
    vi.mocked(fetch).mockResolvedValue(reply(index([1, 1, 11, 1])))
    const result = await new AgentActionService().runTick()
    expect(result.activatedCount).toBe(1)
    expect(mocks.debit.mock.calls[0][0].metadata.actionType).toBe('feed_post')
  })

  it('rejects a treasury whose total value is insufficient', async () => {
    mocks.balances.mockResolvedValue({ ...lopsided, matter: 0.01 })
    const result = await new AgentActionService().runTick()
    expect(result.activatedCount).toBe(0)
    expect(mocks.debit).not.toHaveBeenCalled()
  })

  it.each(['unreachable', 'not-live', 'missing-axis', 'invalid-price'])(
    '%s index falls back to per-axis checks without activating a lopsided agent',
    async failure => {
      if (failure === 'unreachable') vi.mocked(fetch).mockRejectedValue(new Error('offline'))
      else {
        const payload = index()
        if (failure === 'not-live') payload.live = false
        if (failure === 'missing-axis') payload.tokens.pop()
        if (failure === 'invalid-price') payload.tokens[0].index = 0
        vi.mocked(fetch).mockResolvedValue(reply(payload))
      }
      const result = await new AgentActionService().runTick()
      expect(result.activatedCount).toBe(0)
      expect(fetch).toHaveBeenCalledOnce()
      expect(mocks.debit).not.toHaveBeenCalled()
    }
  )

  it('the fallback still activates and posts when the original per-axis check passes', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    mocks.balances.mockResolvedValue({ spirit: 2, essence: 1, matter: 0, substance: 0 })
    const result = await new AgentActionService().runTick()
    expect(result.actionsExecuted).toBe(1)
    expect(mocks.debit.mock.calls[0][0].metadata.actionType).toBe('feed_post')
  })

  it('applies the value gate to specialized actions too', async () => {
    mocks.agents.mockResolvedValue([agent('tesla-id', 'nikola-tesla@agentic.alchm.kitchen')])
    const result = await new AgentActionService().runTick()
    expect(result.actionsExecuted).toBe(1)
    expect(mocks.debit.mock.calls[0][0].operationType).toBe('agent_energy_harmonic_calibration')
  })

  it('keeps a WTEN 402 final and records debit_failed without posting', async () => {
    mocks.debit.mockResolvedValue({ ok: false, reason: 'insufficient_funds' })
    const result = await new AgentActionService().runTick()
    expect(result.activatedCount).toBe(1)
    expect(result.actionsExecuted).toBe(0)
    expect(result.errors[0].error).toBe('insufficient_funds')
    expect(mocks.event.mock.calls[0][0].create.status).toBe('debit_failed')
    expect(mocks.feed).not.toHaveBeenCalled()
  })
})
