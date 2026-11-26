import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ loadConfig: vi.fn() }))

vi.mock('@/lib/alchmSyncConfig', () => ({ loadAlchmSyncConfig: mocks.loadConfig }))

import { syncDebitToAlchm, type SyncDebitPayload } from '@/lib/alchm-debit-sync'

const payload: SyncDebitPayload = {
  userEmail: 'socrates@agentic.alchm.kitchen',
  amounts: { spirit: '2.0000', essence: '1.0000', matter: '0.0000', substance: '0.0000' },
  operationType: 'agent_feed_post',
  source: 'planetary_agents_action_engine',
  idempotencyKey: 'chat:user-1:request-1',
  metadata: {
    agentName: 'Socrates',
    actionType: 'chat',
    activationScore: 1,
    triggers: ['user_request'],
  },
}

describe('alchm.kitchen debit sync contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadConfig.mockReturnValue({ baseUrl: 'https://alchm.test', secret: 'sync-secret' })
  })

  it('treats a remote 409 idempotency hit as an already-applied success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ userId: 'remote-user-1' }), { status: 409 })
    )

    await expect(syncDebitToAlchm(payload)).resolves.toEqual({
      ok: true,
      reason: 'already_applied',
      userId: 'remote-user-1',
    })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('sends both X-Sync-Secret and Authorization: Bearer headers', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: true, transactionGroupId: 'tx-1', userId: 'remote-user-1' }),
        { status: 200 }
      )
    )

    await syncDebitToAlchm(payload)

    expect(fetch).toHaveBeenCalledOnce()
    const callArgs = vi.mocked(fetch).mock.calls[0]
    const headers = (callArgs[1] as any)?.headers ?? {}
    expect(headers['X-Sync-Secret']).toBe('sync-secret')
    expect(headers['Authorization']).toBe('Bearer sync-secret')
  })

  it('fails closed when the remote service rejects the sync secret', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    const result = await syncDebitToAlchm(payload)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Unauthorized')
  })

  it('returns an explicit skipped result when sync configuration is unavailable', async () => {
    mocks.loadConfig.mockImplementationOnce(() => {
      throw new Error('missing config')
    })

    await expect(syncDebitToAlchm(payload)).resolves.toMatchObject({
      ok: false,
      skipped: true,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('forwards authoritative balances and autoSwap shortfall details on 402 insufficient_funds', async () => {
    const balances = { spirit: 0.2, essence: 0.1, matter: 0.1, substance: 0.09 }
    const autoSwap = {
      reason: 'insufficient_value',
      shortfallValue: 2.51,
      deficits: { Spirit: 1.8, Essence: 0.9 },
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          reason: 'insufficient_funds',
          userId: 'remote-user-1',
          balances,
          autoSwap,
        }),
        { status: 402 }
      )
    )

    await expect(syncDebitToAlchm(payload)).resolves.toEqual({
      ok: false,
      reason: 'insufficient_funds',
      userId: 'remote-user-1',
      balances,
      autoSwap,
    })
  })

  it('preserves non-insufficient_funds 402 reasons and 200 autoSwap metadata verbatim', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          reason: 'rates_unavailable',
          userId: 'remote-user-1',
        }),
        { status: 402 }
      )
    )

    await expect(syncDebitToAlchm(payload)).resolves.toEqual({
      ok: false,
      reason: 'rates_unavailable',
      userId: 'remote-user-1',
      balances: undefined,
    })

    const postDebitBalances = { spirit: 4, essence: 2, matter: 1, substance: 1 }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          userId: 'remote-user-1',
          transactionGroupId: 'tx-200',
          balances: postDebitBalances,
          autoSwap: null,
        }),
        { status: 200 }
      )
    )

    await expect(syncDebitToAlchm(payload)).resolves.toEqual({
      ok: true,
      userId: 'remote-user-1',
      transactionGroupId: 'tx-200',
      balances: postDebitBalances,
      autoSwap: null,
    })
  })
})
