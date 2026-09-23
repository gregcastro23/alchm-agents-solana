// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from 'vitest'

const syncConfig = vi.hoisted(() => ({
  load: vi.fn((): { baseUrl: string; secret: string } => ({
    baseUrl: 'https://kitchen.test',
    secret: 'test-sync-value',
  })),
}))
vi.mock('@/lib/alchmSyncConfig', () => ({ loadAlchmSyncConfig: syncConfig.load }))

import {
  fetchKitchenStatus,
  reconcileConversion,
  reconcileStaleEscrowsBatch,
} from '@/lib/pentacles/reconciler'

beforeEach(() => {
  syncConfig.load.mockClear()
  syncConfig.load.mockImplementation(() => ({
    baseUrl: 'https://kitchen.test',
    secret: 'test-sync-value',
  }))
})

describe('Pentacle Reconciler (Section 4.2)', () => {
  it('settles escrow when Kitchen reports transaction was applied', async () => {
    const mockTransport = vi.fn(async (url: string) => {
      expect(url).toContain('settle_pentacle_conversion')
      return { ok: true, status: 200, text: async () => '' }
    })

    const decision = await reconcileConversion(
      'conv-123',
      { state: 'applied' },
      mockTransport as any
    )

    expect(decision.action).toBe('settle')
    expect(decision.conversionId).toBe('conv-123')
  })

  it('refunds escrow when Kitchen reports transaction was NOT applied', async () => {
    const mockTransport = vi.fn(async (url: string) => {
      expect(url).toContain('refund_pentacle_conversion')
      return { ok: true, status: 200, text: async () => '' }
    })

    const decision = await reconcileConversion(
      'conv-456',
      { state: 'not_applied' },
      mockTransport as any
    )

    expect(decision.action).toBe('refund')
    expect(decision.conversionId).toBe('conv-456')
  })

  it('touches nothing when the Kitchen status is unknown', async () => {
    const mockTransport = vi.fn()

    const decision = await reconcileConversion(
      'conv-789',
      { state: 'unknown', reason: 'Kitchen status check returned HTTP 404' },
      mockTransport as any
    )

    expect(decision).toMatchObject({ action: 'noop', kitchen: 'unknown' })
    expect(decision.reason).toContain('HTTP 404')
    expect(mockTransport).not.toHaveBeenCalled()
  })

  it('batch driver reconciles stale escrows discovered in SpacetimeDB', async () => {
    const mockTransport = vi.fn(async (url: string) => {
      if (url.includes('/sql')) {
        // Return two stale escrows
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              rows: [
                {
                  conversion_id: 'conv-stale-1',
                  identity: 'ident-1',
                  status: 'escrowed',
                  created_at: new Date(Date.now() - 3600_000).toISOString(),
                  atoms: ['1000', '0', '0', '0'],
                },
                {
                  conversion_id: 'conv-stale-2',
                  identity: 'ident-2',
                  status: 'escrowed',
                  created_at: new Date(Date.now() - 3600_000).toISOString(),
                  atoms: ['0', '1000', '0', '0'],
                },
              ],
            },
          ],
        }
      }
      // Reducer calls settle or refund
      return { ok: true, status: 200, text: async () => '' }
    })

    const decisions = await reconcileStaleEscrowsBatch(10, mockTransport as any)
    expect(decisions).toHaveLength(2)
    expect(decisions[0].conversionId).toBe('conv-stale-1')
    expect(decisions[1].conversionId).toBe('conv-stale-2')
  })
})

/**
 * Only a parsed answer from the Kitchen may settle or refund. A 404 (WTEN has no sync-status
 * route yet), a 5xx, a timeout or an unreadable body used to become `applied: false` and refund
 * the escrow even when the credit had landed.
 */
describe('reconcileStaleEscrowsBatch: the Kitchen answer decides, a failed read does not', () => {
  const CONVERSION_ID = 'conv-abc'
  const KEY = `pentacle_conv:${CONVERSION_ID}`

  function harness(statusReply: (init: RequestInit) => Promise<Response>) {
    const reducers: string[] = []
    const statusRequests: Array<{ url: string; init: RequestInit }> = []
    const transport = vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.endsWith('/sql')) {
        return new Response(
          JSON.stringify([
            {
              rows: [
                {
                  conversion_id: CONVERSION_ID,
                  identity: 'ident-1',
                  status: 'escrowed',
                  created_at: new Date(Date.now() - 3600_000).toISOString(),
                  atoms: ['1000', '0', '0', '0'],
                },
              ],
            },
          ]),
          { status: 200 }
        )
      }
      if (url.includes('/api/economy/sync-status')) {
        statusRequests.push({ url, init })
        return statusReply(init)
      }
      const reducer = url.match(/\/call\/(\w+)$/)?.[1]
      if (reducer) {
        reducers.push(reducer)
        return new Response('', { status: 200 })
      }
      throw new Error(`unexpected request: ${url}`)
    })
    return { transport: transport as unknown as typeof fetch, reducers, statusRequests }
  }

  const json =
    (body: unknown, status = 200) =>
    async () =>
      new Response(JSON.stringify(body), { status })

  it('{ applied: true } settles, and only settles', async () => {
    const h = harness(json({ ok: true, idempotencyKey: KEY, applied: true }))

    const [decision] = await reconcileStaleEscrowsBatch(10, h.transport)

    expect(decision).toMatchObject({
      conversionId: CONVERSION_ID,
      action: 'settle',
      kitchen: 'applied',
    })
    expect(h.reducers).toEqual(['settle_pentacle_conversion'])
  })

  it('{ applied: false } refunds, and only refunds', async () => {
    const h = harness(json({ ok: true, idempotencyKey: KEY, applied: false }))

    const [decision] = await reconcileStaleEscrowsBatch(10, h.transport)

    expect(decision).toMatchObject({
      conversionId: CONVERSION_ID,
      action: 'refund',
      kitchen: 'not_applied',
    })
    expect(h.reducers).toEqual(['refund_pentacle_conversion'])
  })

  const timeout = async (init: RequestInit): Promise<Response> => {
    // What AbortSignal.timeout(5_000) rejects with; the real 5 s wait is not worth spending here.
    expect(init.signal).toBeInstanceOf(AbortSignal)
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
  }

  const unknownCases: Array<[string, (init: RequestInit) => Promise<Response>, RegExp]> = [
    ['404 (the route does not exist on WTEN yet)', json({ error: 'Not Found' }, 404), /HTTP 404/],
    ['500', json({ error: 'boom' }, 500), /HTTP 500/],
    ['503', json({ error: 'unavailable' }, 503), /HTTP 503/],
    ['a timeout', timeout, /timed out after 5s/],
    [
      'a network error',
      async () => {
        throw new TypeError('fetch failed')
      },
      /failed: fetch failed/,
    ],
    ['a 200 that is not JSON', async () => new Response('<html>ok</html>'), /not JSON/],
    ['a 200 with no body', async () => new Response(null, { status: 200 }), /not JSON/],
    ['a 200 JSON null', json(null), /not an object/],
    ['a 200 without `applied`', json({ ok: true, idempotencyKey: KEY }), /boolean `applied`/],
    [
      'a 200 with a string `applied`',
      json({ ok: true, idempotencyKey: KEY, applied: 'false' }),
      /boolean `applied`/,
    ],
    [
      'a 200 answering for a different key',
      json({ ok: true, idempotencyKey: 'pentacle_conv:someone-else', applied: false }),
      /different idempotency key/,
    ],
    [
      'a 200 that does not echo the key',
      json({ ok: true, applied: false }),
      /different idempotency key/,
    ],
  ]

  it.each(unknownCases)(
    '%s leaves the escrow alone and reports it as unknown',
    async (_label, reply, reason) => {
      const h = harness(reply)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const decisions = await reconcileStaleEscrowsBatch(10, h.transport)

      expect(decisions).toHaveLength(1)
      expect(decisions[0]).toMatchObject({
        conversionId: CONVERSION_ID,
        action: 'noop',
        kitchen: 'unknown',
      })
      expect(decisions[0].reason).toMatch(reason)
      expect(decisions[0].reason).toContain('escrow left for the next pass')
      expect(h.reducers).toEqual([])
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('1 of 1 escrow(s) left in place: Kitchen status unknown')
      )
      warn.mockRestore()
    }
  )

  it('an unconfigured Kitchen sync leaves the escrow alone without calling it', async () => {
    syncConfig.load.mockImplementation(() => {
      throw new Error('ALCHM_KITCHEN_SYNC_URL ... are required.')
    })
    const h = harness(json({ ok: true, idempotencyKey: KEY, applied: false }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const [decision] = await reconcileStaleEscrowsBatch(10, h.transport)
    warn.mockRestore()

    expect(decision).toMatchObject({ action: 'noop', kitchen: 'unknown' })
    expect(decision.reason).toMatch(/not configured/)
    expect(h.statusRequests).toEqual([])
    expect(h.reducers).toEqual([])
  })

  it('a failed settle after { applied: true } is a noop that still records the answer', async () => {
    const h = harness(json({ ok: true, idempotencyKey: KEY, applied: true }))
    const inner = h.transport
    const transport = (async (url: string, init?: RequestInit) =>
      url.includes('/call/')
        ? new Response('reducer exploded', { status: 500 })
        : inner(url, init)) as typeof fetch
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const [decision] = await reconcileStaleEscrowsBatch(10, transport)

    expect(decision).toMatchObject({ action: 'noop', kitchen: 'applied' })
    expect(decision.reason).toMatch(/Failed to settle/)
    error.mockRestore()
  })
})

describe('fetchKitchenStatus request', () => {
  it('asks by encoded idempotency key with X-Sync-Secret and a timeout', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const transport = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ idempotencyKey: 'pentacle_conv:a/b c', applied: true }))
    }) as unknown as typeof fetch

    const status = await fetchKitchenStatus('pentacle_conv:a/b c', transport)

    expect(status).toEqual({ state: 'applied' })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(
      'https://kitchen.test/api/economy/sync-status?idempotencyKey=pentacle_conv%3Aa%2Fb%20c'
    )
    expect(calls[0].init.headers).toEqual({ 'X-Sync-Secret': 'test-sync-value' })
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal)
    expect(calls[0].init.method ?? 'GET').toBe('GET')
  })
})
