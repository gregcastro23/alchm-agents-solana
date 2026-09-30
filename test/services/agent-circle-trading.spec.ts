// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CircleBoardOffer,
  CircleBoardSuccess,
  CircleOwnOffer,
} from '@/lib/alchm-transmute-sync'

const mocks = vi.hoisted(() => ({ board: vi.fn(), accept: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/alchm-transmute-sync', () => ({
  circleBoard: mocks.board,
  acceptCircleOffer: mocks.accept,
  postCircleOffer: mocks.post,
}))
// runTick is exercised with its action evaluation stubbed. Keep unrelated
// service initialization out of these trading policy tests.
vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/services/economyService', () => ({ EconomyService: {} }))
vi.mock('@/lib/alchm-debit-sync', () => ({ syncDebitToAlchm: vi.fn() }))
vi.mock('@/lib/alchm-credit-sync', () => ({ syncCreditToAlchm: vi.fn() }))
vi.mock('@/lib/alchm-event-sync', () => ({ syncEventToAlchm: vi.fn() }))
vi.mock('@/lib/agents/feed-pusher', () => ({ feedPusherService: {} }))
vi.mock('@/lib/agents/feed-activation-engine', () => ({}))
vi.mock('@/lib/services/discriminant-faucet', () => ({}))
vi.mock('@/lib/calculate-transits', () => ({ getCurrentPlanetaryPositions: vi.fn() }))
vi.mock('@/lib/planetary-hour', () => ({ PlanetaryHourCalculator: class {} }))

import { circleStep, type CircleAgent } from '@/lib/services/agent-circle-trading'
import { AgentActionService, type ActivationResult } from '@/lib/services/agent-action-service'

const agent: CircleAgent = {
  userId: 'asol-id',
  agentEmail: 'socrates@agentic.alchm.kitchen',
  agentName: 'Socrates ',
}
const offer = (changes: Partial<CircleBoardOffer> = {}): CircleBoardOffer => ({
  id: 'human-offer',
  giveToken: 'Spirit',
  giveAmount: 4,
  wantToken: 'Matter',
  wantAmount: 4,
  message: null,
  status: 'open',
  directed: false,
  replyToOfferId: null,
  createdAt: '2026-09-30T00:00:00Z',
  expiresAt: '2026-10-01T00:00:00Z',
  closedAt: null,
  market: { parityWantAmount: 4, takerEdgePct: 0, withinCorridor: true },
  maker: { name: 'Human', isAgent: false },
  directedToYou: false,
  youCanFill: true,
  complementsYou: true,
  ...changes,
})
const ownOffer = (changes: Partial<CircleOwnOffer> = {}): CircleOwnOffer => ({
  ...offer(),
  funded: true,
  counterparty: null,
  taker: null,
  ...changes,
})
const board = (changes: Partial<CircleBoardSuccess> = {}): CircleBoardSuccess => ({
  ok: true,
  agentId: 'wten-id',
  board: [offer()],
  mine: [],
  needs: { lacking: ['Spirit'], surplus: ['Matter'] },
  suggestion: { giveToken: 'Matter', giveAmount: 4, wantToken: 'Spirit', wantAmount: 4 },
  stats: { trades: 0, partners: 0, lastTradeAt: null },
  pulse: { trades24h: 0, openOffers: 1 },
  market: {
    live: true,
    prices: { Spirit: 1, Essence: 1, Matter: 1, Substance: 1 },
    priceBucketStartUtc: '2026-09-30T00:00:00Z',
    corridorPct: 25,
  },
  bonus: { tokenType: 'Spirit', baseAmount: 1, minTradeValue: 1, perPartnerPerDay: 1 },
  ...changes,
})
const activation = (activated: boolean): ActivationResult => ({
  ...agent,
  activated,
  score: activated ? 1 : 0,
  triggers: [],
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-30T12:00:00Z'))
  vi.stubEnv('AGENT_CIRCLE_TRADING', '')
  vi.stubEnv('AGENT_CIRCLE_MIN_EDGE_PCT', '')
  vi.stubEnv('ALCHM_KITCHEN_SYNC_URL', '')
  vi.stubEnv('ALCHM_KITCHEN_API_BASE_URL', '')
  mocks.board.mockResolvedValue(board())
  mocks.accept.mockResolvedValue({ ok: true, trade: { transactionGroupId: 'trade' } })
  mocks.post.mockResolvedValue({ ok: true, offer: { id: 'posted' } })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('one Circle step', () => {
  it('prefers accepting the first eligible offer over posting', async () => {
    mocks.board.mockResolvedValue(board({ board: [offer(), offer({ id: 'second' })] }))
    await circleStep(agent)
    expect(mocks.accept).toHaveBeenCalledExactlyOnceWith(agent.agentEmail, 'human-offer')
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('skips undirected agent makers and chooses a human next', async () => {
    mocks.board.mockResolvedValue(
      board({ board: [offer({ id: 'wash', maker: { name: 'Agent', isAgent: true } }), offer()] })
    )
    await circleStep(agent)
    expect(mocks.accept).toHaveBeenCalledExactlyOnceWith(agent.agentEmail, 'human-offer')
  })

  it('allows an agent maker only when the offer is directed to this agent', async () => {
    mocks.board.mockResolvedValue(
      board({
        board: [
          offer({
            id: 'direct',
            maker: { name: 'Agent', isAgent: true },
            directed: true,
            directedToYou: true,
          }),
        ],
      })
    )
    await circleStep(agent)
    expect(mocks.accept).toHaveBeenCalledExactlyOnceWith(agent.agentEmail, 'direct')
  })

  it.each([
    { youCanFill: false },
    { complementsYou: false },
    { market: null },
    { market: { parityWantAmount: 4, takerEdgePct: -0.01, withinCorridor: true } },
  ])('skips an ineligible offer (%j) and posts the parity suggestion', async changes => {
    mocks.board.mockResolvedValue(board({ board: [offer(changes)] }))
    await circleStep(agent)
    expect(mocks.accept).not.toHaveBeenCalled()
    expect(mocks.post).toHaveBeenCalledOnce()
  })

  it('honors a configured minimum edge and accepts exactly at the threshold', async () => {
    vi.stubEnv('AGENT_CIRCLE_MIN_EDGE_PCT', '2')
    mocks.board.mockResolvedValue(
      board({
        board: [
          offer({
            id: 'below',
            market: { parityWantAmount: 4, takerEdgePct: 1.99, withinCorridor: true },
          }),
          offer({
            id: 'threshold',
            market: { parityWantAmount: 4, takerEdgePct: 2, withinCorridor: true },
          }),
        ],
      })
    )
    await circleStep(agent)
    expect(mocks.accept).toHaveBeenCalledExactlyOnceWith(agent.agentEmail, 'threshold')
  })

  it('caps accepts via lastTradeAt today, but may still post a daily offer', async () => {
    mocks.board.mockResolvedValue(
      board({ stats: { trades: 1, partners: 1, lastTradeAt: '2026-09-30T01:00:00Z' } })
    )
    await circleStep(agent)
    expect(mocks.accept).not.toHaveBeenCalled()
    expect(mocks.post).toHaveBeenCalledOnce()
  })

  it('uses UTC after normalizing an offset timestamp', async () => {
    mocks.board.mockResolvedValue(
      board({ stats: { trades: 1, partners: 1, lastTradeAt: '2026-09-29T23:30:00-02:00' } })
    )
    await circleStep(agent)
    expect(mocks.accept).not.toHaveBeenCalled()
  })

  it('permits a fill on the UTC day after the previous trade', async () => {
    mocks.board.mockResolvedValue(
      board({ stats: { trades: 1, partners: 1, lastTradeAt: '2026-09-29T23:59:59Z' } })
    )
    await circleStep(agent)
    expect(mocks.accept).toHaveBeenCalledOnce()
  })

  it.each([true, false])('does not post while an open offer exists (funded=%s)', async funded => {
    mocks.board.mockResolvedValue(board({ board: [], mine: [ownOffer({ funded })] }))
    await circleStep(agent)
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('posts only the suggestion, with 24h TTL, a daily body key and agent message', async () => {
    mocks.board.mockResolvedValue(board({ board: [], mine: [ownOffer({ status: 'expired' })] }))
    await circleStep(agent)
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith({
      agentEmail: agent.agentEmail,
      giveToken: 'Matter',
      giveAmount: 4,
      wantToken: 'Spirit',
      wantAmount: 4,
      ttlHours: 24,
      idempotencyKey: 'circle_offer:asol-id:2026-09-30',
      message: 'Socrates seeks Spirit — trading Matter at the index.',
    })
  })

  it('does not post without a suggestion', async () => {
    mocks.board.mockResolvedValue(board({ board: [], suggestion: null }))
    await circleStep(agent)
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it.each([
    board({ market: { live: false, prices: null, priceBucketStartUtc: null, corridorPct: 25 } }),
    board({ needs: null }),
    board({ needs: { lacking: [], surplus: ['Matter'] } }),
    { ok: false, reason: 'rates_unavailable' },
  ])('stops when the board cannot authorize trading', async snapshot => {
    mocks.board.mockResolvedValue(snapshot)
    await circleStep(agent)
    expect(mocks.accept).not.toHaveBeenCalled()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it.each([
    { ok: false, reason: 'offer_closed' },
    { ok: false, reason: 'off_market' },
    { ok: false, error: 'timeout (10000ms)' },
  ])('stops and logs an accept refusal or timeout without posting', async refusal => {
    mocks.accept.mockResolvedValue(refusal)
    await circleStep(agent)
    expect(mocks.accept).toHaveBeenCalledOnce()
    expect(mocks.post).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('accept refused'))
  })

  it('logs a post refusal without another mutation', async () => {
    mocks.board.mockResolvedValue(board({ board: [] }))
    mocks.post.mockResolvedValue({ ok: false, reason: 'too_many_open_offers' })
    await circleStep(agent)
    expect(mocks.post).toHaveBeenCalledOnce()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('too_many_open_offers'))
  })
})

describe('runTick Circle flag and budget', () => {
  it.each(['', '0', 'false', 'true'])('flag %j makes no Circle calls', async flag => {
    vi.stubEnv('AGENT_CIRCLE_TRADING', flag)
    const service = new AgentActionService()
    vi.spyOn(service, 'evaluateAgentActivations').mockResolvedValue([activation(false)])
    await service.runTick()
    expect(mocks.board).not.toHaveBeenCalled()
    expect(mocks.accept).not.toHaveBeenCalled()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('flag 1 trades for every evaluated agent, after the action loop', async () => {
    vi.stubEnv('AGENT_CIRCLE_TRADING', '1')
    const service = new AgentActionService()
    const active = activation(true)
    const inactive = {
      ...activation(false),
      userId: 'inactive',
      agentEmail: 'inactive@agentic.alchm.kitchen',
    }
    vi.spyOn(service, 'evaluateAgentActivations').mockResolvedValue([active, inactive])
    const action = vi
      .spyOn(service, 'executeAgentAction')
      .mockResolvedValue({ success: true, actionType: 'feed_post' })
    const result = await service.runTick()
    expect(action).toHaveBeenCalledOnce()
    expect(mocks.board.mock.calls).toEqual([[active.agentEmail], [inactive.agentEmail]])
    expect(action.mock.invocationCallOrder[0]).toBeLessThan(mocks.board.mock.invocationCallOrder[0])
    expect(result.actionsExecuted).toBe(1)
  })

  it('does not begin trading after the cron budget expires', async () => {
    vi.stubEnv('AGENT_CIRCLE_TRADING', '1')
    const service = new AgentActionService()
    vi.spyOn(service, 'evaluateAgentActivations').mockResolvedValue([activation(false)])
    await service.runTick({ deadlineMs: Date.now() - 1 })
    expect(mocks.board).not.toHaveBeenCalled()
  })

  it('stops before the next agent when trading consumes the remaining budget', async () => {
    vi.stubEnv('AGENT_CIRCLE_TRADING', '1')
    const service = new AgentActionService()
    vi.spyOn(service, 'evaluateAgentActivations').mockResolvedValue([
      activation(false),
      { ...activation(false), userId: 'second', agentEmail: 'second@agentic.alchm.kitchen' },
    ])
    const deadlineMs = Date.now() + 60_000
    mocks.board.mockImplementationOnce(async () => {
      vi.setSystemTime(deadlineMs + 1)
      return board()
    })
    await service.runTick({ deadlineMs })
    expect(mocks.board).toHaveBeenCalledOnce()
  })
})
