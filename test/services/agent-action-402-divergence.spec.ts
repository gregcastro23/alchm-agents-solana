// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface StoredActionEvent {
  id: string
  agentId: string
  agentEmail: string
  eventType: string
  status: string
  metadataPayload: Record<string, unknown>
  idempotencyKey: string
  evaluatedAt: Date
  updatedAt: Date
  createdAt: Date
}

const mocks = vi.hoisted(() => ({
  agents: vi.fn(),
  stories: vi.fn(),
  updateUser: vi.fn(),
  balances: vi.fn(),
  debit: vi.fn(),
  feed: vi.fn(),
  txGroupBy: vi.fn(),
  balFindMany: vi.fn(),
  eventStore: new Map<string, StoredActionEvent>(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    users: { findMany: mocks.agents, update: mocks.updateUser },
    historical_agents: { findMany: mocks.stories },
    tokenTransaction: { groupBy: mocks.txGroupBy },
    tokenBalance: { findMany: mocks.balFindMany },
    agent_action_events: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = mocks.eventStore.get(where.idempotencyKey)
        if (existing) {
          const merged: StoredActionEvent = {
            ...existing,
            status: update.status ?? existing.status,
            metadataPayload: (update.metadataPayload ?? existing.metadataPayload) as Record<
              string,
              unknown
            >,
            updatedAt: update.updatedAt ?? new Date(),
          }
          mocks.eventStore.set(where.idempotencyKey, merged)
          return merged
        }
        const row: StoredActionEvent = {
          id: `evt-${mocks.eventStore.size + 1}`,
          agentId: create.agentId,
          agentEmail: create.agentEmail,
          eventType: create.eventType,
          status: create.status,
          metadataPayload: (create.metadataPayload ?? {}) as Record<string, unknown>,
          idempotencyKey: create.idempotencyKey,
          evaluatedAt: create.evaluatedAt ?? new Date(),
          updatedAt: create.updatedAt ?? new Date(),
          createdAt: create.createdAt ?? new Date(),
        }
        mocks.eventStore.set(where.idempotencyKey, row)
        return row
      }),
      findMany: vi.fn(async ({ where }: any) => {
        const all = [...mocks.eventStore.values()].sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
        )
        if (where?.status?.in) {
          const allowed = new Set<string>(where.status.in)
          const agentIds = new Set<string>(where.agentId?.in ?? [])
          const seen = new Set<string>()
          const distinctRows: StoredActionEvent[] = []
          for (const row of all) {
            if (!allowed.has(row.status)) continue
            if (agentIds.size > 0 && !agentIds.has(row.agentId)) continue
            if (seen.has(row.agentId)) continue
            seen.add(row.agentId)
            distinctRows.push(row)
          }
          return distinctRows
        }
        if (where?.eventType?.in) {
          const allowedTypes = new Set<string>(where.eventType.in)
          const emails = new Set<string>(where.agentEmail?.in ?? [])
          return all.filter(
            row =>
              allowedTypes.has(row.eventType) && (emails.size === 0 || emails.has(row.agentEmail))
          )
        }
        return all
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        for (const row of mocks.eventStore.values()) {
          if (row.id === where.id || row.idempotencyKey === where.idempotencyKey) return row
        }
        return null
      }),
      update: vi.fn(async ({ where, data }: any) => {
        for (const [key, row] of mocks.eventStore.entries()) {
          if (row.id === where.id) {
            const updated: StoredActionEvent = {
              ...row,
              metadataPayload: (data.metadataPayload ?? row.metadataPayload) as Record<
                string,
                unknown
              >,
              updatedAt: new Date(),
            }
            mocks.eventStore.set(key, updated)
            return updated
          }
        }
        return null
      }),
    },
  },
}))

vi.mock('@/lib/services/economyService', () => ({
  EconomyService: { getBalances: mocks.balances },
}))
vi.mock('@/lib/alchm-debit-sync', () => ({ syncDebitToAlchm: mocks.debit }))
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
import { syncCreditToAlchm } from '@/lib/alchm-credit-sync'
import { classifyDebitPathFromDeliveries } from '@/lib/admin/debit-path'
import { __resetWtenCreditSignalsForTests } from '@/lib/economy/wten-agent-balance-gate'
import { __resetWtenReachability } from '@/lib/wten/delivery'

const makeAgent = (
  id = 'agent-1',
  email = 'socrates@agentic.alchm.kitchen',
  name = 'Socrates'
) => ({
  id,
  email,
  name,
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

const priceIndexPayload = (prices = [1, 1, 1, 1]) => ({
  success: true,
  live: true,
  generatedAt: '2026-11-26T00:00:00.000Z',
  bucketStartUtc: '2026-11-26T00:00:00.000Z',
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

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-26T02:28:00.000Z'))
  vi.resetAllMocks()
  __resetWtenCreditSignalsForTests()
  __resetWtenReachability()
  mocks.eventStore.clear()

  vi.stubEnv('ALCHM_KITCHEN_SYNC_URL', 'https://kitchen.test')
  vi.stubEnv('ALCHM_KITCHEN_SYNC_SECRET', '')
  vi.stubEnv('AGENT_CIRCLE_TRADING', '')

  mocks.agents.mockResolvedValue([makeAgent()])
  mocks.stories.mockResolvedValue([])
  mocks.updateUser.mockResolvedValue({})
  mocks.feed.mockResolvedValue({ success: true, pushedCount: 1, errors: [] })
  mocks.txGroupBy.mockResolvedValue([])
  mocks.balFindMany.mockResolvedValue([])

  // Local Prisma ledger has inflated historical balances (diverged from WTEN)
  mocks.balances.mockResolvedValue({
    spirit: 120,
    essence: 85,
    matter: 90,
    substance: 60,
    lastDailyClaimAt: null,
    lastDailyClaimAgentsAt: null,
  })

  vi.mocked(fetch).mockImplementation(async input => {
    const url = String(input)
    if (url.endsWith('/api/economy/price-index')) {
      return jsonResponse(priceIndexPayload())
    }
    throw new Error(`Unexpected fetch URL: ${url}`)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Issue #103: WTEN sync-debit 402 two-ledger divergence mitigation', () => {
  it('1. pauses an underfunded agent after 402 (with balances + autoSwap.shortfallValue) across warm and cold ticks', async () => {
    mocks.debit.mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_funds',
      userId: 'wten-socrates',
      balances: { spirit: 0.2, essence: 0.1, matter: 0.1, substance: 0.09 },
      autoSwap: {
        reason: 'insufficient_value',
        shortfallValue: 2.51,
        deficits: { Spirit: 1.8, Essence: 0.9 },
      },
    })

    const service = new AgentActionService()
    const tick1 = await service.runTick()

    expect(tick1.activatedCount).toBe(1)
    expect(tick1.actionsExecuted).toBe(0)
    expect(tick1.skippedFor402Cooldown).toBe(0)
    expect(tick1.errors).toEqual([{ userId: 'agent-1', error: 'insufficient_funds' }])
    expect(mocks.debit).toHaveBeenCalledTimes(1)

    // Verify metadataPayload persisted WTEN balances, shortfallValue, and pauseUntil
    const stored = [...mocks.eventStore.values()][0]!
    expect(stored.status).toBe('debit_failed')
    expect(stored.metadataPayload).toMatchObject({
      reason: 'insufficient_funds',
      wtenBalances: { spirit: 0.2, essence: 0.1, matter: 0.1, substance: 0.09 },
      autoSwap: { reason: 'insufficient_value', shortfallValue: 2.51 },
    })

    // Next hourly tick (03:28Z) on warm instance: skipped before calling sync-debit
    vi.setSystemTime(new Date('2026-11-26T03:28:00.000Z'))
    const tick2 = await service.runTick()
    expect(tick2.activatedCount).toBe(0)
    expect(tick2.skippedFor402Cooldown).toBe(1)
    expect(tick2.errors).toEqual([])
    expect(mocks.debit).toHaveBeenCalledTimes(1)

    // Next hourly tick (04:28Z) on a cold-started serverless instance: hydrated from DB and still skipped
    vi.setSystemTime(new Date('2026-11-26T04:28:00.000Z'))
    const coldService = new AgentActionService()
    const tick3 = await coldService.runTick()
    expect(tick3.activatedCount).toBe(0)
    expect(tick3.skippedFor402Cooldown).toBe(1)
    expect(tick3.errors).toEqual([])
    expect(mocks.debit).toHaveBeenCalledTimes(1)
  })

  it('2a. immediately clears the 402 pause when syncCreditToAlchm lands a credit', async () => {
    vi.stubEnv('ALCHM_KITCHEN_SYNC_SECRET', 'test-sync-secret')
    vi.mocked(fetch).mockImplementation(async input => {
      const url = String(input)
      if (url.endsWith('/api/economy/price-index')) {
        return jsonResponse(priceIndexPayload())
      }
      if (url.endsWith('/api/economy/sync-credit')) {
        return jsonResponse({
          ok: true,
          balances: { spirit: 3.2, essence: 3.1, matter: 3.1, substance: 3.09 },
        })
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    })

    mocks.debit
      .mockResolvedValueOnce({
        ok: false,
        reason: 'insufficient_funds',
        balances: { spirit: 0.2, essence: 0.1, matter: 0.1, substance: 0.09 },
        autoSwap: { reason: 'insufficient_value', shortfallValue: 2.51 },
      })
      .mockResolvedValueOnce({
        ok: true,
        transactionGroupId: 'tx-after-credit',
        balances: { spirit: 1.2, essence: 2.1, matter: 3.1, substance: 3.09 },
      })

    const service = new AgentActionService()
    await service.runTick()
    expect(mocks.debit).toHaveBeenCalledTimes(1)

    // Confirm paused before credit
    vi.setSystemTime(new Date('2026-11-26T03:28:00.000Z'))
    const pausedTick = await service.runTick()
    expect(pausedTick.skippedFor402Cooldown).toBe(1)
    expect(mocks.debit).toHaveBeenCalledTimes(1)

    // ASOL syncs a yield credit at 03:40Z
    vi.setSystemTime(new Date('2026-11-26T03:40:00.000Z'))
    const creditRes = await syncCreditToAlchm({
      userEmail: 'socrates@agentic.alchm.kitchen',
      amounts: { spirit: '3.0000', essence: '3.0000', matter: '3.0000', substance: '3.0000' },
      source: 'agents_yield',
      idempotencyKey: 'daily:agents:sync:socrates@agentic.alchm.kitchen:2026-11-26',
    })
    expect(creditRes.ok).toBe(true)

    // Next tick (04:28Z) immediately resumes and executes the action
    vi.setSystemTime(new Date('2026-11-26T04:28:00.000Z'))
    const resumedTick = await service.runTick()
    expect(resumedTick.skippedFor402Cooldown).toBe(0)
    expect(resumedTick.activatedCount).toBe(1)
    expect(resumedTick.actionsExecuted).toBe(1)
    expect(mocks.debit).toHaveBeenCalledTimes(2)
  })

  it('2b. clears a persisted 402 pause on cold start when DB records a newer yield transaction', async () => {
    mocks.debit
      .mockResolvedValueOnce({
        ok: false,
        reason: 'insufficient_funds',
        balances: { spirit: 0.1, essence: 0.1, matter: 0.1, substance: 0.1 },
        autoSwap: { reason: 'insufficient_value', shortfallValue: 2.6 },
      })
      .mockResolvedValueOnce({
        ok: true,
        transactionGroupId: 'tx-cold-resume',
        balances: { spirit: 9, essence: 2, matter: 1, substance: 0 },
      })

    // First invocation records 402 at 11:28Z
    vi.setSystemTime(new Date('2026-11-26T11:28:00.000Z'))
    await new AgentActionService().runTick()
    expect(mocks.debit).toHaveBeenCalledTimes(1)

    // Separate cron invocation (`claim-yield` at 12:00Z) wrote positive token_transactions
    mocks.txGroupBy.mockResolvedValue([
      { userId: 'agent-1', _max: { createdAt: new Date('2026-11-26T12:00:00.000Z') } },
    ])

    // Cold-start tick at 12:28Z detects the 12:00Z credit > 11:28Z 402 and resumes immediately
    vi.setSystemTime(new Date('2026-11-26T12:28:00.000Z'))
    const resumed = await new AgentActionService().runTick()
    expect(resumed.skippedFor402Cooldown).toBe(0)
    expect(resumed.activatedCount).toBe(1)
    expect(resumed.actionsExecuted).toBe(1)
    expect(mocks.debit).toHaveBeenCalledTimes(2)
  })

  it('3a. expires the 402 cooldown across WTEN 00:30Z daily yield window so external credits wake up', async () => {
    // Agent gets 402 at 00:28Z (two minutes BEFORE WTEN's 00:30Z agents-daily-yield)
    vi.setSystemTime(new Date('2026-11-26T00:28:00.000Z'))
    mocks.debit
      .mockResolvedValueOnce({
        ok: false,
        reason: 'insufficient_funds',
        balances: { spirit: 0.2, essence: 0.1, matter: 0.1, substance: 0.09 },
        autoSwap: { reason: 'insufficient_value', shortfallValue: 2.51 },
      })
      .mockResolvedValueOnce({
        ok: true,
        transactionGroupId: 'tx-post-0030-yield',
        balances: { spirit: 4, essence: 3, matter: 3, substance: 2 },
      })

    const service = new AgentActionService()
    await service.runTick()
    expect(mocks.debit).toHaveBeenCalledTimes(1)

    // Before 00:30Z (at 00:29Z), agent is still paused
    vi.setSystemTime(new Date('2026-11-26T00:29:00.000Z'))
    const preYieldTick = await service.runTick()
    expect(preYieldTick.skippedFor402Cooldown).toBe(1)
    expect(mocks.debit).toHaveBeenCalledTimes(1)

    // At 01:28Z (after WTEN's 00:30Z yield), cooldown has expired and agent acts cleanly
    vi.setSystemTime(new Date('2026-11-26T01:28:00.000Z'))
    const postYieldTick = await service.runTick()
    expect(postYieldTick.skippedFor402Cooldown).toBe(0)
    expect(postYieldTick.activatedCount).toBe(1)
    expect(postYieldTick.actionsExecuted).toBe(1)
    expect(mocks.debit).toHaveBeenCalledTimes(2)
  })

  it('3b. uses bounded GET /api/economy/balance probes after 00:30Z to wake funded agents with zero new 402s on unfunded ones', async () => {
    vi.stubEnv('ALCHM_KITCHEN_SYNC_SECRET', 'test-sync-secret')
    const funded = makeAgent('agent-funded', 'funded@agentic.alchm.kitchen', 'Funded')
    const unfunded = makeAgent('agent-unfunded', 'unfunded@agentic.alchm.kitchen', 'Unfunded')
    mocks.agents.mockResolvedValue([funded, unfunded])

    // Both hit 402 at 23:28Z prior to 00:30Z
    vi.setSystemTime(new Date('2026-11-25T23:28:00.000Z'))
    mocks.debit
      .mockResolvedValueOnce({
        ok: false,
        reason: 'insufficient_funds',
        balances: { spirit: 0.2, essence: 0.1, matter: 0.1, substance: 0.09 },
      })
      .mockResolvedValueOnce({
        ok: false,
        reason: 'insufficient_funds',
        balances: { spirit: 0.1, essence: 0.1, matter: 0.1, substance: 0.1 },
      })
      .mockResolvedValueOnce({
        ok: true,
        transactionGroupId: 'tx-funded-woke',
        balances: { spirit: 1, essence: 2, matter: 3, substance: 3 },
      })

    const service = new AgentActionService()
    await service.runTick()
    expect(mocks.debit).toHaveBeenCalledTimes(2)

    // At 01:28Z (after 00:30Z), WTEN funded `funded@` (+12 ESMS) while `unfunded@` stayed at 0.4 ESMS
    vi.mocked(fetch).mockImplementation(async input => {
      const url = String(input)
      if (url.endsWith('/api/economy/price-index')) {
        return jsonResponse(priceIndexPayload())
      }
      if (url.includes('/api/economy/balance?email=funded%40')) {
        return jsonResponse({ balances: { spirit: 3, essence: 3, matter: 3, substance: 3 } })
      }
      if (url.includes('/api/economy/balance?email=unfunded%40')) {
        return jsonResponse({
          balances: { spirit: 0.1, essence: 0.1, matter: 0.1, substance: 0.1 },
        })
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    })

    vi.setSystemTime(new Date('2026-11-26T01:28:00.000Z'))
    const postYield = await service.runTick()
    expect(postYield.wtenBalanceProbes).toBe(2)
    expect(postYield.activatedCount).toBe(1)
    expect(postYield.actionsExecuted).toBe(1)
    expect(postYield.skippedForWtenBalance).toBe(1)
    expect(postYield.errors).toEqual([])
    // Only `funded@` called sync-debit; `unfunded@` caused ZERO 402s!
    expect(mocks.debit).toHaveBeenCalledTimes(3)
    expect(mocks.debit.mock.calls[2]![0].userEmail).toBe('funded@agentic.alchm.kitchen')
  })

  it('4. does NOT pause agents on 402 with reason !== "insufficient_funds", transient autoSwap faults, or 5xx/network errors', async () => {
    const service = new AgentActionService()

    const transientFailures = [
      { ok: false, reason: 'rates_unavailable' },
      {
        ok: false,
        reason: 'insufficient_funds',
        autoSwap: { reason: 'rates_unavailable' },
      },
      { ok: false, error: '502: Bad Gateway' },
      { ok: false, error: 'timeout (10000ms)' },
    ]

    for (const [idx, failure] of transientFailures.entries()) {
      vi.setSystemTime(new Date(Date.UTC(2026, 10, 26, 2 + idx, 28, 0)))
      mocks.debit.mockResolvedValueOnce(failure)
      const res = await service.runTick()
      expect(res.activatedCount).toBe(1)
      expect(res.skippedFor402Cooldown).toBe(0)
      expect(res.actionsExecuted).toBe(0)
    }

    // Immediately on the next hour, with NO credit issued, the agent retries and succeeds
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 26, 7, 28, 0)))
    mocks.debit.mockResolvedValueOnce({
      ok: true,
      transactionGroupId: 'tx-recovered',
      balances: { spirit: 10, essence: 10, matter: 10, substance: 10 },
    })
    const recovered = await service.runTick()
    expect(recovered.skippedFor402Cooldown).toBe(0)
    expect(recovered.activatedCount).toBe(1)
    expect(recovered.actionsExecuted).toBe(1)
    expect(mocks.debit).toHaveBeenCalledTimes(transientFailures.length + 1)
  })

  it('5. preserves 200 / 409 happy paths, pre-checks post-200 WTEN residual balances, and keeps classifyDebitPathFromDeliveries intact', async () => {
    const service = new AgentActionService()

    // 200 OK that leaves 0.49 ESMS on WTEN (< 3.0 feed_post cost)
    mocks.debit.mockResolvedValueOnce({
      ok: true,
      userId: 'wten-socrates',
      transactionGroupId: 'tx-200-last-drop',
      balances: { spirit: 0.2, essence: 0.2, matter: 0.09, substance: 0 },
    })
    const tick200 = await service.runTick()
    expect(tick200.actionsExecuted).toBe(1)
    expect(mocks.feed).toHaveBeenCalledTimes(1)

    // Next hour: pre-check reads the cached 0.49 WTEN balance and skips BEFORE hitting a 402!
    vi.setSystemTime(new Date('2026-11-26T03:28:00.000Z'))
    const tickSkippedByBalance = await service.runTick()
    expect(tickSkippedByBalance.activatedCount).toBe(0)
    expect(tickSkippedByBalance.skippedForWtenBalance).toBe(1)
    expect(mocks.debit).toHaveBeenCalledTimes(1)

    // 409 already_applied happy path on a second agent
    mocks.agents.mockResolvedValue([
      makeAgent('agent-plato', 'plato@agentic.alchm.kitchen', 'Plato'),
    ])
    mocks.debit.mockResolvedValueOnce({
      ok: true,
      reason: 'already_applied',
      userId: 'wten-plato',
    })
    vi.setSystemTime(new Date('2026-11-26T04:28:00.000Z'))
    const tick409 = await service.runTick()
    expect(tick409.activatedCount).toBe(1)
    expect(tick409.actionsExecuted).toBe(1)
    expect(tick409.errors).toEqual([])

    // Liveness invariant in lib/admin/debit-path.ts remains intact
    expect(
      classifyDebitPathFromDeliveries({ status: 'live' }, [
        {
          endpoint: 'feed',
          attempts: 18,
          split: { ok2xx: 18, alreadyApplied409: 0 },
          lastError: null,
        },
        {
          endpoint: 'economy/sync-debit',
          attempts: 18,
          split: { ok2xx: 17, alreadyApplied409: 1 },
          lastError: null,
        },
      ]).verdict
    ).toBe('OK')

    expect(
      classifyDebitPathFromDeliveries({ status: 'live' }, [
        {
          endpoint: 'feed',
          attempts: 12,
          split: { ok2xx: 12, alreadyApplied409: 0 },
          lastError: null,
        },
        {
          endpoint: 'economy/sync-debit',
          attempts: 0,
          split: { ok2xx: 0, alreadyApplied409: 0 },
          lastError: null,
        },
      ]).verdict
    ).toBe('INCIDENT')

    expect(classifyDebitPathFromDeliveries({ status: 'live' }, []).verdict).toBe('IDLE')
    expect(
      classifyDebitPathFromDeliveries({ status: 'unavailable', reason: 'timeout' }, null).verdict
    ).toBe('UNKNOWN')
  })
})
