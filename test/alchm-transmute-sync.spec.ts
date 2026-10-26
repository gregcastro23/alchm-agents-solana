// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ config: vi.fn(), user: vi.fn(), log: vi.fn() }))
vi.mock('@/lib/alchmSyncConfig', () => ({ loadAlchmSyncConfig: mocks.config }))
vi.mock('@/lib/db', () => ({ prisma: { users: { findUnique: mocks.user } } }))
vi.mock('@/lib/wten/delivery-log', () => ({ recordDeliveryAttempt: mocks.log }))

import {
  circleBoard,
  postCircleOffer,
  acceptCircleOffer,
  cancelCircleOffer,
  declineCircleOffer,
} from '@/lib/alchm-transmute-sync'
import { __resetWtenReachability } from '@/lib/wten/delivery'

const email = 'socrates@agentic.alchm.kitchen'
const input = {
  agentEmail: email,
  giveToken: 'Spirit' as const,
  giveAmount: 4,
  wantToken: 'Essence' as const,
  wantAmount: 3.2,
  counterpartyEmail: 'human@example.com',
  message: 'At parity',
  ttlHours: 24,
  idempotencyKey: 'daily-offer-2026-09-30',
}
const response = (status = 200, body: unknown = { ok: true, agentId: 'wten-id' }) =>
  new Response(JSON.stringify(body), { status })

beforeEach(() => {
  vi.resetAllMocks()
  __resetWtenReachability()
  vi.useFakeTimers()
  mocks.config.mockReturnValue({ baseUrl: 'https://alchm.test', secret: 'secret' })
  mocks.user.mockResolvedValue({ id: 'asol-id' })
  vi.mocked(fetch).mockResolvedValue(response())
})
afterEach(() => vi.useRealTimers())

describe('Circle requests use the shared delivery client', () => {
  it('sends the board body with S2S auth', async () => {
    expect((await circleBoard(email)).ok).toBe(true)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://alchm.test/api/economy/sync-transmute')
    expect(JSON.parse(init!.body as string)).toEqual({ action: 'board', agentEmail: email })
    expect(new Headers(init!.headers).get('X-Sync-Secret')).toBe('secret')
    expect(new Headers(init!.headers).get('Idempotency-Key')).toMatch(/^circle_board:/)
    expect(mocks.user).not.toHaveBeenCalled()
  })

  it.each([200, 201])('sends offer body and body key, preserving a %i success', async status => {
    const body = { ok: true, agentId: 'wten-id', offer: { id: 'offer' }, replayed: status === 200 }
    vi.mocked(fetch).mockResolvedValue(response(status, body))
    expect(await postCircleOffer(input)).toEqual(body)
    const init = vi.mocked(fetch).mock.calls[0][1]!
    expect(JSON.parse(init.body as string)).toEqual({ ...input, action: 'offer' })
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe(
      `circle_offer:asol-id:${input.idempotencyKey}`
    )
  })

  it.each([
    ['accept', acceptCircleOffer],
    ['cancel', cancelCircleOffer],
    ['decline', declineCircleOffer],
  ] as const)('sends %s with a stable source ID', async (action, call) => {
    await call(email, 'offer-id')
    const init = vi.mocked(fetch).mock.calls[0][1]!
    expect(JSON.parse(init.body as string)).toEqual({
      action,
      agentEmail: email,
      offerId: 'offer-id',
    })
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe(
      `circle_${action}:asol-id:offer-id`
    )
  })

  it.each([
    [409, 'offer_closed'],
    [409, 'maker_cannot_cover'],
    [409, 'too_many_open_offers'],
    [402, 'insufficient_funds'],
    [410, 'offer_expired'],
    [422, 'off_market'],
  ] as const)('%i %s is final and rejected, never already applied', async (status, reason) => {
    vi.mocked(fetch).mockResolvedValue(response(status, { ok: false, reason, message: 'refused' }))
    expect(await acceptCircleOffer(email, 'offer-id')).toMatchObject({
      ok: false,
      reason,
      message: 'refused',
      outcome: 'rejected',
      status,
    })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('retries 503 with identical bytes and ID', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(503, { ok: false, reason: 'rates_unavailable' }))
      .mockResolvedValueOnce(response())
    const pending = acceptCircleOffer(email, 'offer-id')
    await vi.runAllTimersAsync()
    expect((await pending).ok).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(fetch).mock.calls
    expect(calls[0][1]!.body).toBe(calls[1][1]!.body)
    expect(new Headers(calls[0][1]!.headers).get('Idempotency-Key')).toBe(
      new Headers(calls[1][1]!.headers).get('Idempotency-Key')
    )
  })

  it('does not retry an accept timeout', async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )
    const pending = acceptCircleOffer(email, 'offer-id')
    await vi.runAllTimersAsync()
    expect(await pending).toMatchObject({ ok: false, outcome: 'failed', status: null })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('does not retry a rolled-back 500 fill', async () => {
    vi.mocked(fetch).mockResolvedValue(response(500, { ok: false, reason: 'failed' }))
    expect(await acceptCircleOffer(email, 'offer-id')).toMatchObject({
      ok: false,
      reason: 'failed',
    })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it.each([
    () => circleBoard(email),
    () => postCircleOffer(input),
    () => acceptCircleOffer(email, 'offer-id'),
    () => cancelCircleOffer(email, 'offer-id'),
    () => declineCircleOffer(email, 'offer-id'),
  ])('returns skipped with missing environment', async call => {
    mocks.config.mockImplementation(() => {
      throw new Error('missing')
    })
    expect(await call()).toEqual({ ok: false, skipped: true })
    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.user).not.toHaveBeenCalled()
  })

  it('returns an identity lookup failure without throwing or sending', async () => {
    mocks.user.mockRejectedValue(new Error('database unavailable'))
    expect(await acceptCircleOffer(email, 'offer-id')).toEqual({
      ok: false,
      error: 'database unavailable',
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
