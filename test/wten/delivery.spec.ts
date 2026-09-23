// @vitest-environment node
/**
 * The shared ASOL → WTEN delivery client: stable IDs across retries, the retry
 * policy per status, bounded backoff, and the caller's deadline.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetWtenReachability,
  backoffDelayMs,
  classifyResponse,
  deliverToWten,
  parseRetryAfterMs,
  RETRY,
  stableEventId,
  WTEN_ENDPOINT_POLICY,
  type DeliveryAttempt,
  type DeliveryDeps,
  type WtenEndpoint,
} from '@/lib/wten/delivery'

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | Error

function harness(replies: Reply[], start = 1_000_000) {
  let clock = start
  const calls: Array<{ url: string; init: RequestInit }> = []
  const attempts: DeliveryAttempt[] = []
  const sleeps: number[] = []
  const fetchMock = vi.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), init })
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)]!
    if (reply instanceof Error) throw reply
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: reply.headers,
    })
  })
  const deps: Partial<DeliveryDeps> = {
    fetch: fetchMock as unknown as typeof fetch,
    sleep: async ms => {
      sleeps.push(ms)
      clock += ms
    },
    random: () => 0.5,
    now: () => clock,
    onAttempt: a => attempts.push(a),
  }
  return { deps, calls, attempts, sleeps, advance: (ms: number) => (clock += ms) }
}

const send = (
  endpoint: WtenEndpoint,
  deps: Partial<DeliveryDeps>,
  extra: Partial<Parameters<typeof deliverToWten>[0]> = {}
) =>
  deliverToWten(
    {
      endpoint,
      url: 'https://alchm.test/api/x',
      headers: { 'X-Sync-Secret': 'never-logged' },
      body: { amount: '1.0000', nested: { b: 2, a: 1 } },
      eventId: 'agent_action:user-1:2026-09-22T20',
      ...extra,
    },
    deps
  )

const header = (init: RequestInit, name: string) => new Headers(init.headers).get(name)

beforeEach(() => __resetWtenReachability())

describe('retries reuse the same event ID and the same bytes', () => {
  it('sends an identical Idempotency-Key and body on every attempt', async () => {
    const h = harness([
      { status: 503 },
      new TypeError('fetch failed'),
      { status: 200, body: { ok: true } },
    ])
    const res = await send('economy/sync-debit', h.deps)

    expect(res).toMatchObject({ ok: true, outcome: 'delivered', attempts: 3 })
    expect(h.calls).toHaveLength(3)
    const keys = h.calls.map(c => header(c.init, 'idempotency-key'))
    expect(new Set(keys)).toEqual(new Set(['agent_action:user-1:2026-09-22T20']))
    const bodies = h.calls.map(c => c.init.body)
    expect(new Set(bodies).size).toBe(1) // serialised once, sent verbatim
  })

  it('never puts the auth header in the attempt log', async () => {
    const h = harness([{ status: 500 }, { status: 200, body: {} }])
    await send('economy/sync-credit', h.deps)
    expect(JSON.stringify(h.attempts)).not.toContain('never-logged')
    expect(h.attempts.map(a => a.result)).toEqual(['retry', 'delivered'])
  })
})

describe('final answers are not retried', () => {
  it.each([
    [400, 'rejected'],
    [401, 'rejected'],
    [402, 'rejected'],
    [404, 'rejected'],
    [422, 'rejected'],
  ] as const)('HTTP %i → %s after one attempt', async (status, outcome) => {
    const h = harness([{ status, body: { reason: 'x' } }])
    const res = await send('economy/sync-debit', h.deps)
    expect(res).toMatchObject({ outcome, ok: false, attempts: 1, status })
    expect(h.sleeps).toEqual([])
  })

  it('sync-debit 409 already_applied is success and final', async () => {
    const h = harness([
      { status: 409, body: { ok: false, reason: 'already_applied', userId: 'u' } },
    ])
    const res = await send('economy/sync-debit', h.deps)
    expect(res).toMatchObject({ outcome: 'already_applied', ok: true, attempts: 1 })
    expect(res.body.userId).toBe('u')
  })

  it('a 409 on an endpoint where it does not mean "applied" is a rejection', async () => {
    const h = harness([{ status: 409, body: { error: 'conflict' } }])
    const res = await send('feed', h.deps)
    expect(res).toMatchObject({ outcome: 'rejected', attempts: 1 })
  })
})

describe('transient answers are retried', () => {
  it('retries a 409 that says the first delivery is still in flight', async () => {
    const h = harness([
      { status: 409, body: { received: true, status: 'in_flight' } },
      { status: 200, body: { ok: true } },
    ])
    const res = await send('economy/sync-credit', h.deps)
    expect(res).toMatchObject({ outcome: 'delivered', attempts: 2 })
  })

  it('honours Retry-After on 429 when it fits the budget', async () => {
    const h = harness([
      { status: 429, headers: { 'retry-after': '3' } },
      { status: 200, body: {} },
    ])
    await send('economy/sync-debit', h.deps)
    expect(h.sleeps).toEqual([3000])
  })

  it('gives up instead of stalling when Retry-After exceeds the budget', async () => {
    const h = harness([
      { status: 429, headers: { 'retry-after': '120' } },
      { status: 200, body: {} },
    ])
    const res = await send('economy/sync-debit', h.deps)
    expect(res).toMatchObject({ ok: false, attempts: 1 })
    expect(res.error).toMatch(/Retry-After 120s exceeds budget/)
  })

  it('stops after maxAttempts and reports the last failure', async () => {
    const h = harness([{ status: 502 }])
    const res = await send('economy/sync-debit', h.deps)
    expect(res).toMatchObject({
      outcome: 'failed',
      ok: false,
      attempts: RETRY.maxAttempts,
      status: 502,
    })
    expect(h.attempts.at(-1)!.result).toBe('failed')
  })
})

describe('endpoints WTEN does not dedupe yet', () => {
  it.each(['economy/sync-event', 'feed', 'internal/agent-recipes'] as const)(
    '%s: a 500 or a mid-flight network error may have been applied, so it is not retried',
    async endpoint => {
      expect(WTEN_ENDPOINT_POLICY[endpoint].receiverDedupes).toBe(false)
      const h500 = harness([{ status: 500 }, { status: 200, body: {} }])
      expect(await send(endpoint, h500.deps)).toMatchObject({ outcome: 'failed', attempts: 1 })

      const reset = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } })
      const hNet = harness([reset, { status: 200, body: {} }])
      expect(await send(endpoint, hNet.deps)).toMatchObject({ outcome: 'failed', attempts: 1 })
    }
  )

  it('still retries answers that never reached the handler: 429, 503, connect errors', async () => {
    const refused = Object.assign(new TypeError('fetch failed'), {
      cause: { code: 'ECONNREFUSED' },
    })
    const h = harness([{ status: 429 }, { status: 503 }, refused, { status: 200, body: {} }])
    const res = await send('economy/sync-event', h.deps, { maxAttempts: 4 })
    expect(res).toMatchObject({ outcome: 'delivered', attempts: 4 })
  })
})

describe('bounded backoff', () => {
  it('grows exponentially, jitters within [cap/2, cap], and never exceeds the max', () => {
    for (let attempt = 1; attempt <= 12; attempt++) {
      const cap = Math.min(RETRY.maxDelayMs, RETRY.baseDelayMs * 2 ** (attempt - 1))
      expect(backoffDelayMs(attempt, () => 0)).toBe(Math.round(cap / 2))
      expect(backoffDelayMs(attempt, () => 1)).toBe(cap)
      expect(backoffDelayMs(attempt, () => 0.999)).toBeLessThanOrEqual(RETRY.maxDelayMs)
    }
    expect(backoffDelayMs(1, () => 1)).toBe(250)
    expect(backoffDelayMs(2, () => 1)).toBe(500)
    expect(backoffDelayMs(30, () => 1)).toBe(RETRY.maxDelayMs)
  })

  it('the total wait for one delivery is bounded', async () => {
    const h = harness([{ status: 503 }])
    await send('economy/sync-debit', h.deps, { maxAttempts: 10 })
    expect(h.sleeps).toHaveLength(9)
    expect(h.sleeps.every(ms => ms <= RETRY.maxDelayMs)).toBe(true)
  })
})

describe('deadline', () => {
  it('does not start an attempt when too little time is left', async () => {
    const h = harness([{ status: 200, body: {} }])
    const res = await send('economy/sync-debit', h.deps, { deadline: 1_000_000 + 500 })
    expect(res).toMatchObject({
      ok: false,
      attempts: 0,
      error: 'deadline reached before first attempt',
    })
    expect(h.calls).toHaveLength(0)
  })

  it('does not sleep past the deadline to retry', async () => {
    const h = harness([{ status: 503 }, { status: 200, body: {} }])
    // 1.1s leaves room for one attempt but not for backoff (188ms) + another (1s minimum).
    const res = await send('economy/sync-debit', h.deps, { deadline: 1_000_000 + 1_100 })
    expect(res).toMatchObject({ ok: false, attempts: 1 })
    expect(res.error).toMatch(/no time left to retry/)
    expect(h.sleeps).toEqual([])
  })
})

describe('an unreachable WTEN', () => {
  it('after one delivery gets no response at all, the next makes a single attempt', async () => {
    const down = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    const h = harness([down])
    expect(await send('economy/sync-debit', h.deps)).toMatchObject({ attempts: 3, ok: false })
    expect(await send('economy/sync-debit', h.deps)).toMatchObject({ attempts: 1, ok: false })
  })

  it('stops failing fast after the window, or as soon as WTEN answers', async () => {
    const down = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    const h = harness([down])
    await send('economy/sync-debit', h.deps)
    h.advance(RETRY.unreachableWindowMs + 1)
    expect(await send('economy/sync-debit', h.deps)).toMatchObject({ attempts: 3 })

    __resetWtenReachability()
    const h2 = harness([down, down, down, { status: 503 }, { status: 503 }, { status: 503 }])
    await send('economy/sync-debit', h2.deps) // 3 × no response → unreachable
    expect(await send('economy/sync-debit', h2.deps)).toMatchObject({ attempts: 1, status: 503 })
    // WTEN answered (even with a 503), so full retries are back.
    expect(await send('economy/sync-debit', h2.deps)).toMatchObject({ attempts: 3 })
  })

  it('a 5xx is an answer, not unreachability', async () => {
    const h = harness([{ status: 500 }])
    await send('economy/sync-debit', h.deps)
    expect(await send('economy/sync-debit', h.deps)).toMatchObject({ attempts: 3 })
  })
})

describe('helpers', () => {
  it('stableEventId is deterministic and key-order independent', () => {
    const a = stableEventId('agent-sync:x@agentic.alchm.kitchen', { b: 1, a: [1, { d: 2, c: 3 }] })
    const b = stableEventId('agent-sync:x@agentic.alchm.kitchen', { a: [1, { c: 3, d: 2 }], b: 1 })
    expect(a).toBe(b)
    expect(a).toMatch(/^agent-sync:x@agentic\.alchm\.kitchen:[0-9a-f]{24}$/)
    expect(stableEventId('p', { b: 2 })).not.toBe(stableEventId('p', { b: 3 }))
  })

  it('parseRetryAfterMs reads seconds and HTTP dates', () => {
    expect(parseRetryAfterMs('7')).toBe(7000)
    expect(parseRetryAfterMs(new Date(10_000).toUTCString(), 4_000)).toBe(6_000)
    expect(parseRetryAfterMs('soon')).toBeNull()
    expect(parseRetryAfterMs(null)).toBeNull()
  })

  it('classifyResponse matches the documented table', () => {
    const debit = WTEN_ENDPOINT_POLICY['economy/sync-debit']
    expect(classifyResponse(201, null, debit)).toBe('delivered')
    expect(classifyResponse(409, { reason: 'already_applied' }, debit)).toBe('already_applied')
    expect(classifyResponse(409, { status: 'in_flight' }, debit)).toBe('retry')
    expect(classifyResponse(402, null, debit)).toBe('rejected')
    expect(classifyResponse(429, null, debit)).toBe('retry')
    expect(classifyResponse(500, null, debit)).toBe('retry')
  })
})
