// @vitest-environment node
/**
 * The shared ASOL → WTEN delivery client: stable IDs across retries, the retry
 * policy per status, bounded backoff, and the caller's deadline.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetWarnedMissingSecret,
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
import { computeV1Signature, parseWebhookSecret } from '@/lib/wten/sign'

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

beforeEach(() => {
  __resetWtenReachability()
  __resetWarnedMissingSecret()
})

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
    const res = await send('internal/agent-sync', h.deps)
    expect(res).toMatchObject({ outcome: 'rejected', attempts: 1 })
  })
})

describe('in-flight 409 handling on sync-event, feed, and agent-recipes', () => {
  const legacyBodies: Record<'economy/sync-event' | 'feed' | 'internal/agent-recipes', any> = {
    'economy/sync-event': {
      ok: false,
      error: 'conflict',
      message: 'Event is currently being processed',
    },
    feed: { success: false, error: 'conflict', message: 'Event is currently being processed' },
    'internal/agent-recipes': {
      success: false,
      error: 'conflict',
      message: 'Event is currently being processed',
    },
  }

  it.each(['economy/sync-event', 'feed', 'internal/agent-recipes'] as const)(
    '%s: retries WTEN legacy 409 body without in_flight marker',
    async endpoint => {
      const h = harness([
        { status: 409, body: legacyBodies[endpoint], headers: { 'retry-after': '1' } },
        { status: 200, body: { ok: true, success: true } },
      ])
      const res = await send(endpoint, h.deps)
      expect(res).toMatchObject({ outcome: 'delivered', attempts: 2 })
      expect(h.sleeps).toEqual([1000])
    }
  )

  it.each(['economy/sync-event', 'feed', 'internal/agent-recipes'] as const)(
    '%s: retries marker body { status: "in_flight" }',
    async endpoint => {
      const h = harness([
        { status: 409, body: { status: 'in_flight', message: 'processing' } },
        { status: 200, body: { ok: true, success: true } },
      ])
      const res = await send(endpoint, h.deps)
      expect(res).toMatchObject({ outcome: 'delivered', attempts: 2 })
    }
  )

  it.each(['economy/sync-event', 'feed', 'internal/agent-recipes'] as const)(
    '%s: exhausting attempts while in-flight ends as failed',
    async endpoint => {
      const h = harness([
        { status: 409, body: legacyBodies[endpoint] },
        { status: 409, body: legacyBodies[endpoint] },
        { status: 409, body: legacyBodies[endpoint] },
      ])
      const res = await send(endpoint, h.deps, { maxAttempts: 3 })
      expect(res).toMatchObject({
        outcome: 'failed',
        ok: false,
        attempts: 3,
        status: 409,
      })
      expect(h.attempts.at(-1)!.result).toBe('failed')
    }
  )
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
  it('economy/sync-event: a 500 or a mid-flight network error may have been applied, so it is not retried', async () => {
    expect(WTEN_ENDPOINT_POLICY['economy/sync-event'].receiverDedupes).toBe(false)
    const h500 = harness([{ status: 500 }, { status: 200, body: {} }])
    expect(await send('economy/sync-event', h500.deps)).toMatchObject({
      outcome: 'failed',
      attempts: 1,
    })

    const reset = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } })
    const hNet = harness([reset, { status: 200, body: {} }])
    expect(await send('economy/sync-event', hNet.deps)).toMatchObject({
      outcome: 'failed',
      attempts: 1,
    })
  })

  it('still retries answers that never reached the handler: 429, 503, connect errors', async () => {
    const refused = Object.assign(new TypeError('fetch failed'), {
      cause: { code: 'ECONNREFUSED' },
    })
    const h = harness([{ status: 429 }, { status: 503 }, refused, { status: 200, body: {} }])
    const res = await send('economy/sync-event', h.deps, { maxAttempts: 4 })
    expect(res).toMatchObject({ outcome: 'delivered', attempts: 4 })
  })

  it.each(['feed', 'internal/agent-recipes'] as const)(
    '%s: receiverDedupes is true, so 500 and network errors are retried',
    async endpoint => {
      expect(WTEN_ENDPOINT_POLICY[endpoint].receiverDedupes).toBe(true)
      const h500 = harness([{ status: 500 }, { status: 200, body: { ok: true, success: true } }])
      expect(await send(endpoint, h500.deps)).toMatchObject({ outcome: 'delivered', attempts: 2 })

      const reset = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } })
      const hNet = harness([reset, { status: 200, body: { ok: true, success: true } }])
      expect(await send(endpoint, hNet.deps)).toMatchObject({ outcome: 'delivered', attempts: 2 })
    }
  )
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

    const credit = WTEN_ENDPOINT_POLICY['economy/sync-credit']
    expect(classifyResponse(409, { reason: 'already_applied' }, credit)).toBe('already_applied')
    expect(classifyResponse(409, { status: 'in_flight' }, credit)).toBe('retry')
    expect(classifyResponse(500, null, credit)).toBe('retry')

    const syncEvent = WTEN_ENDPOINT_POLICY['economy/sync-event']
    expect(classifyResponse(409, { error: 'conflict' }, syncEvent)).toBe('retry')
    expect(classifyResponse(409, { status: 'in_flight' }, syncEvent)).toBe('retry')
    expect(classifyResponse(500, null, syncEvent)).toBe('failed')
    expect(classifyResponse(503, null, syncEvent)).toBe('retry')

    const agentSync = WTEN_ENDPOINT_POLICY['internal/agent-sync']
    expect(classifyResponse(409, { error: 'conflict' }, agentSync)).toBe('rejected')
    expect(classifyResponse(409, { status: 'in_flight' }, agentSync)).toBe('retry')
    expect(classifyResponse(500, null, agentSync)).toBe('retry')

    const recipes = WTEN_ENDPOINT_POLICY['internal/agent-recipes']
    expect(classifyResponse(409, { error: 'conflict' }, recipes)).toBe('retry')
    expect(classifyResponse(409, { status: 'in_flight' }, recipes)).toBe('retry')
    expect(classifyResponse(500, null, recipes)).toBe('retry')

    const feed = WTEN_ENDPOINT_POLICY['feed']
    expect(classifyResponse(409, { error: 'conflict' }, feed)).toBe('retry')
    expect(classifyResponse(409, { status: 'in_flight' }, feed)).toBe('retry')
    expect(classifyResponse(500, null, feed)).toBe('retry')
  })
})

describe('Standard Webhooks signing in deliverToWten', () => {
  const TEST_SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw='
  const TEST_KEY = parseWebhookSecret(TEST_SECRET)

  it('attaches webhook-id, webhook-timestamp, and webhook-signature when secret is configured', async () => {
    const { calls, deps } = harness([{ status: 200, body: { ok: true } }], 1_614_265_330_000)
    deps.webhookSecret = TEST_SECRET

    const body = '{"test": 2432232314}'
    const eventId = 'msg_p5jXN8AQM9LWM0D4loKWxJek'

    const result = await deliverToWten(
      {
        endpoint: 'feed',
        url: 'https://alchm.test/api/feed',
        headers: {},
        body,
        eventId,
      },
      deps
    )

    expect(result.ok).toBe(true)
    expect(calls).toHaveLength(1)

    const init = calls[0]!.init
    expect(header(init, 'webhook-id')).toBe(eventId)
    expect(header(init, 'webhook-timestamp')).toBe('1614265330')
    expect(header(init, 'webhook-signature')).toBe(
      'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE='
    )
    expect(header(init, 'Idempotency-Key')).toBe(eventId)
  })

  it('retries maintain identical webhook-id and body, with fresh webhook-timestamp and signature per attempt', async () => {
    // 2 500s then 200
    const { calls, deps } = harness(
      [
        { status: 500, body: { error: 'down' } },
        { status: 500, body: { error: 'down' } },
        { status: 200, body: { ok: true } },
      ],
      1_700_000_000_000
    )
    deps.webhookSecret = TEST_SECRET

    let clock = 1_700_000_000_000
    deps.now = () => clock
    deps.sleep = async ms => {
      clock += ms + 1_000 // simulate time passing during backoff
    }

    const body = { action: 'chat', text: 'hello' }
    const eventId = 'feed:agent_chat:monica-001:abcd'

    const result = await deliverToWten(
      {
        endpoint: 'feed',
        url: 'https://alchm.test/api/feed',
        headers: {},
        body,
        eventId,
      },
      deps
    )

    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(3)
    expect(calls).toHaveLength(3)

    // Body bytes must be identical on all attempts
    const sentBody0 = calls[0]!.init.body
    const sentBody1 = calls[1]!.init.body
    const sentBody2 = calls[2]!.init.body
    expect(sentBody0).toBe(sentBody1)
    expect(sentBody1).toBe(sentBody2)

    // webhook-id must be identical
    expect(header(calls[0]!.init, 'webhook-id')).toBe(eventId)
    expect(header(calls[1]!.init, 'webhook-id')).toBe(eventId)
    expect(header(calls[2]!.init, 'webhook-id')).toBe(eventId)

    // Timestamps must reflect the time of each attempt
    const ts0 = header(calls[0]!.init, 'webhook-timestamp')!
    const ts1 = header(calls[1]!.init, 'webhook-timestamp')!
    const ts2 = header(calls[2]!.init, 'webhook-timestamp')!
    expect(ts0).not.toBe(ts1)
    expect(ts1).not.toBe(ts2)

    // Signatures must verify for each attempt's timestamp
    const expectedSig0 = computeV1Signature({
      id: eventId,
      timestamp: Number(ts0),
      bodyBytes: String(sentBody0),
      secret: TEST_KEY,
    })
    const expectedSig1 = computeV1Signature({
      id: eventId,
      timestamp: Number(ts1),
      bodyBytes: String(sentBody1),
      secret: TEST_KEY,
    })
    const expectedSig2 = computeV1Signature({
      id: eventId,
      timestamp: Number(ts2),
      bodyBytes: String(sentBody2),
      secret: TEST_KEY,
    })

    expect(header(calls[0]!.init, 'webhook-signature')).toBe(expectedSig0)
    expect(header(calls[1]!.init, 'webhook-signature')).toBe(expectedSig1)
    expect(header(calls[2]!.init, 'webhook-signature')).toBe(expectedSig2)
  })

  it('omits webhook-* headers and warns once when HOOK_SECRET_ASOL is unset', async () => {
    const prevSecret = process.env.HOOK_SECRET_ASOL
    delete process.env.HOOK_SECRET_ASOL
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const { calls: calls1, deps: deps1 } = harness([{ status: 200, body: { ok: true } }])
      const res1 = await send('feed', deps1)
      expect(res1.ok).toBe(true)
      expect(header(calls1[0]!.init, 'webhook-id')).toBeNull()
      expect(header(calls1[0]!.init, 'webhook-timestamp')).toBeNull()
      expect(header(calls1[0]!.init, 'webhook-signature')).toBeNull()

      const { calls: calls2, deps: deps2 } = harness([{ status: 200, body: { ok: true } }])
      const res2 = await send('feed', deps2)
      expect(res2.ok).toBe(true)
      expect(header(calls2[0]!.init, 'webhook-signature')).toBeNull()

      // Warned exactly once across both calls
      const missingSecretWarns = warnSpy.mock.calls.filter(args =>
        String(args[0]).includes('HOOK_SECRET_ASOL is unset')
      )
      expect(missingSecretWarns).toHaveLength(1)
    } finally {
      if (prevSecret !== undefined) process.env.HOOK_SECRET_ASOL = prevSecret
      warnSpy.mockRestore()
    }
  })

  it('delivery attempts and results never leak secret or signature', async () => {
    const { attempts, deps } = harness([{ status: 200, body: { ok: true } }])
    deps.webhookSecret = TEST_SECRET

    const result = await send('feed', deps)
    expect(result.ok).toBe(true)

    const attemptStr = JSON.stringify(attempts)
    expect(attemptStr).not.toContain(TEST_SECRET)
    expect(attemptStr).not.toContain('v1,')

    const resultStr = JSON.stringify(result)
    expect(resultStr).not.toContain(TEST_SECRET)
    expect(resultStr).not.toContain('v1,')
  })
})
