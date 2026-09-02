// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import {
  createPrismaSolanaSyncStore,
  createSolanaSyncWebhookBodyDispatcher,
  startSolanaSyncOutboxPolling,
  encodeSolanaSyncBody,
  type AaeSolanaSyncEvent,
} from '@/lib/solana/solana-sync-service'

describe('Solana Settlement-Sync Worker (Workstream 1)', () => {
  it('polls undelivered outbox rows and marks them delivered upon successful delivery', async () => {
    const deliveredPayloads: string[] = []
    const deliverMock = vi.fn().mockImplementation(async (payload: string) => {
      deliveredPayloads.push(payload)
    })

    const rows = [
      { id: 'sig1:0', payload: '{"event":"ClaimSettled","slot":100}' },
      { id: 'sig2:0', payload: '{"event":"RedeemSettled","slot":101}' },
    ]

    const updateCalls: Array<{ id: string; data: unknown }> = []
    const mockPrismaClient = {
      solanaSyncOutbox: {
        findMany: vi.fn().mockResolvedValue(rows),
        update: vi.fn().mockImplementation(async ({ where, data }) => {
          updateCalls.push({ id: where.id, data })
          return { id: where.id }
        }),
      },
    }

    const poller = startSolanaSyncOutboxPolling({
      client: mockPrismaClient as any,
      deliver: deliverMock,
      intervalMs: 100_000, // manual tick in tests
    })

    await poller.tick()

    expect(deliverMock).toHaveBeenCalledTimes(2)
    expect(deliveredPayloads).toEqual([rows[0].payload, rows[1].payload])
    expect(updateCalls).toHaveLength(2)
    expect(updateCalls[0].id).toBe('sig1:0')
    expect(updateCalls[0].data).toMatchObject({
      attempts: { increment: 1 },
      lastError: null,
    })
    expect((updateCalls[0].data as any).deliveredAt).toBeInstanceOf(Date)

    expect(updateCalls[1].id).toBe('sig2:0')
    expect(updateCalls[1].data).toMatchObject({
      attempts: { increment: 1 },
      lastError: null,
    })

    poller.stop()
  })

  it('records lastError and stops batch progression when a webhook delivery fails', async () => {
    const deliverMock = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Webhook gateway timeout (504)'))

    const rows = [
      { id: 'row1', payload: '{"event":"1"}' },
      { id: 'row2', payload: '{"event":"2"}' },
      { id: 'row3', payload: '{"event":"3"}' },
    ]

    const updateCalls: Array<{ id: string; data: unknown }> = []
    const mockPrismaClient = {
      solanaSyncOutbox: {
        findMany: vi.fn().mockResolvedValue(rows),
        update: vi.fn().mockImplementation(async ({ where, data }) => {
          updateCalls.push({ id: where.id, data })
          return { id: where.id }
        }),
      },
    }

    const poller = startSolanaSyncOutboxPolling({
      client: mockPrismaClient as any,
      deliver: deliverMock,
      intervalMs: 100_000,
    })

    await poller.tick()

    // First delivered, second failed, third skipped
    expect(deliverMock).toHaveBeenCalledTimes(2)
    expect(updateCalls).toHaveLength(2)

    expect(updateCalls[0].id).toBe('row1')
    expect(updateCalls[0].data).toMatchObject({
      attempts: { increment: 1 },
      lastError: null,
    })

    expect(updateCalls[1].id).toBe('row2')
    expect(updateCalls[1].data).toEqual({
      attempts: { increment: 1 },
      lastError: 'Webhook gateway timeout (504)',
    })

    poller.stop()
  })

  it('dispatches webhook payload with Authorization Bearer header', async () => {
    let capturedUrl: string | undefined
    let capturedInit: RequestInit | undefined

    const mockFetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      capturedUrl = url
      capturedInit = init
      return {
        ok: true,
        status: 200,
        text: async () => 'OK',
      }
    })

    const dispatcher = createSolanaSyncWebhookBodyDispatcher({
      url: 'https://alchm.kitchen/api/solana-sync',
      bearerToken: 'alchm-secret-bearer-token-1234',
      fetchImpl: mockFetch as any,
    })

    const payload = JSON.stringify({ event: 'TestEvent', signature: '5xY...' })
    await dispatcher(payload)

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(capturedUrl).toBe('https://alchm.kitchen/api/solana-sync')
    expect(capturedInit?.method).toBe('POST')
    expect(capturedInit?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer alchm-secret-bearer-token-1234',
    })
    expect(capturedInit?.body).toBe(payload)
  })

  it('throws descriptive error on webhook response failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway upstream error',
    })

    const dispatcher = createSolanaSyncWebhookBodyDispatcher({
      url: 'https://alchm.kitchen/api/solana-sync',
      bearerToken: 'token',
      fetchImpl: mockFetch as any,
    })

    await expect(dispatcher('{"event":"fail"}')).rejects.toThrow(
      'Solana sync webhook failed (502): Bad Gateway upstream error'
    )
  })

  it('reports accurate queue depth via createPrismaSolanaSyncStore.getQueueDepth()', async () => {
    const countMock = vi.fn().mockResolvedValue(42)
    const mockClient = {
      solanaSyncOutbox: {
        count: countMock,
      },
      solanaProcessedTx: {
        findUnique: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
      },
    }

    const store = createPrismaSolanaSyncStore(mockClient as any)
    const depth = await store.getQueueDepth?.()

    expect(countMock).toHaveBeenCalledWith({ where: { deliveredAt: null } })
    expect(depth).toBe(42)
  })
})
