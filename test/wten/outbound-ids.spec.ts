// @vitest-environment node
/**
 * The real ASOL → WTEN callers put a stable event ID on the wire.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/alchmSyncConfig', () => ({
  loadAlchmSyncConfig: () => ({ baseUrl: 'https://alchm.test', secret: 'sync-secret' }),
}))
vi.mock('@/lib/agents/feed-activation-engine', () => ({
  feedActivationEngine: { evaluateActivations: vi.fn(async () => []) },
}))
vi.mock('@/lib/agents/planetary-degree-feed', () => ({
  planetaryDegreeFeedService: { evaluateDegreeChanges: vi.fn(async () => []) },
}))

import { syncEventToAlchm } from '@/lib/alchm-event-sync'
import { syncCreditToAlchm } from '@/lib/alchm-credit-sync'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('INTERNAL_API_SECRET', 'internal-secret')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const ok = (body: unknown = { ok: true }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
const sent = (i: number) => {
  const [url, init] = fetchMock.mock.calls[i]!
  return {
    url: String(url),
    headers: new Headers(init.headers),
    body: JSON.parse(init.body as string),
  }
}

describe('sync-event', () => {
  it('carries the idempotency key in the body AND as Idempotency-Key', async () => {
    fetchMock.mockResolvedValueOnce(ok({ completed: [] }))
    const key = 'agent_action:user-1:2026-09-22T20:event:generate_recipe'
    await syncEventToAlchm({
      userEmail: 'a@agentic.alchm.kitchen',
      event: 'generate_recipe',
      idempotencyKey: key,
    })

    const call = sent(0)
    expect(call.url).toBe('https://alchm.test/api/economy/sync-event')
    expect(call.body.idempotencyKey).toBe(key)
    expect(call.headers.get('idempotency-key')).toBe(key)
    expect(call.headers.get('x-sync-secret')).toBe('sync-secret')
  })

  it('retries when WTEN answers 409 (in-flight) and succeeds on next attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: 'conflict',
            message: 'Event is currently being processed',
          }),
          { status: 409, headers: { 'retry-after': '0' } }
        )
      )
      .mockResolvedValueOnce(ok({ deduplicated: true, completed: [] }))
    const res = await syncEventToAlchm({ userEmail: 'a@x', event: 'e', idempotencyKey: 'k' })
    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('treats a finished duplicate (200 deduplicated: true) as success', async () => {
    fetchMock.mockResolvedValueOnce(ok({ deduplicated: true, completed: [] }))
    const res = await syncEventToAlchm({ userEmail: 'a@x', event: 'e', idempotencyKey: 'k' })
    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe('sync-credit', () => {
  it('sends its idempotency key as Idempotency-Key and treats 409 as applied', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ reason: 'already_applied' }), { status: 409 })
    )
    const res = await syncCreditToAlchm({
      userEmail: 'u@example.com',
      amounts: { spirit: '1.0000' },
      source: 'chat_quest',
      idempotencyKey: 'group_quest:user-1:2026-W39',
    })
    expect(res).toEqual({ ok: true })
    expect(sent(0).headers.get('idempotency-key')).toBe('group_quest:user-1:2026-W39')
  })
})

describe('feed posts', () => {
  const action = {
    agentEmail: 'socrates@agentic.alchm.kitchen',
    eventType: 'insight' as const,
    metadataPayload: {
      insightTitle: 'On the good',
      insightContent: 'Know thyself; the unexamined life is not worth living.',
    },
  }

  it('a post with no producer key still carries a stable derived ID, identical on re-push', async () => {
    fetchMock.mockImplementation(async () => ok({ event: { id: 'wten-evt-1' } }))
    const { feedPusherService } = await import('@/lib/agents/feed-pusher')

    await feedPusherService.pushActions([structuredClone(action)])
    await feedPusherService.pushActions([structuredClone(action)])

    const wten = fetchMock.mock.calls
      .map((_, i) => sent(i))
      .filter(c => c.url.startsWith('https://alchm.kitchen/api/feed'))
    expect(wten).toHaveLength(2)
    const [first, second] = wten
    expect(first!.headers.get('idempotency-key')).toMatch(
      /^feed:insight:socrates@agentic\.alchm\.kitchen:[0-9a-f]{24}$/
    )
    expect(second!.headers.get('idempotency-key')).toBe(first!.headers.get('idempotency-key'))
    expect(first!.body.idempotencyKey).toBe(first!.headers.get('idempotency-key'))
    expect(first!.headers.get('authorization')).toBe('Bearer internal-secret')
  })

  it("a producer's own key wins", async () => {
    fetchMock.mockImplementation(async () => ok({ event: { id: 'wten-evt-2' } }))
    const { feedPusherService } = await import('@/lib/agents/feed-pusher')
    await feedPusherService.pushActions([
      { ...structuredClone(action), idempotencyKey: 'weekly-feature:2026-09-21' },
    ])
    const wten = fetchMock.mock.calls
      .map((_, i) => sent(i))
      .find(c => c.url.startsWith('https://alchm.kitchen'))
    expect(wten!.headers.get('idempotency-key')).toBe('weekly-feature:2026-09-21')
  })
})
