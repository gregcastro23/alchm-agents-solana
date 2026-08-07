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
})
