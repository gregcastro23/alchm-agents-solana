/**
 * Session policy (Phase B).
 *
 * B2: a 30-day absolute cap on top of the existing 7-day idle window.
 * B3: the kitchen bridge forwards only the kitchen's own cookie, announces
 *     itself, and distinguishes "nobody is signed in" from "we could not ask".
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: { $transaction: vi.fn(async (cb: any) => cb({})) },
}))
vi.mock('@/lib/user-provisioning', () => ({
  provisionPaUser: vi.fn(async () => ({ id: 'pa-user-123', created: true })),
}))

import { filterKitchenCookies, resolveBridgeOutcome, resolveBridgeUser } from '@/lib/auth-bridge'
import { ABSOLUTE_MAX_AGE_MS, IDLE_MAX_AGE_SECONDS, resolveAuthTime } from '@/lib/auth-options'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = fetchMock as any
})

describe('B2 — absolute session lifetime', () => {
  it('caps at 30 days and keeps the 7-day idle window', () => {
    expect(ABSOLUTE_MAX_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000)
    expect(IDLE_MAX_AGE_SECONDS).toBe(7 * 24 * 60 * 60)
  })

  it('rejects a token one second past 30 days', () => {
    const now = Date.now()
    const authTime = now - (ABSOLUTE_MAX_AGE_MS + 1000)

    expect(resolveAuthTime(authTime, now)).toEqual({ authTime, expired: true })
  })

  it('accepts a token at 29 days', () => {
    const now = Date.now()
    const authTime = now - 29 * 24 * 60 * 60 * 1000

    expect(resolveAuthTime(authTime, now)).toEqual({ authTime, expired: false })
  })

  it('stamps a pre-policy token instead of signing that whole population out', () => {
    const now = Date.now()

    expect(resolveAuthTime(undefined, now)).toEqual({ authTime: now, expired: false })
    expect(resolveAuthTime('not-a-number', now)).toEqual({ authTime: now, expired: false })
  })
})

describe('B3 — kitchen bridge', () => {
  it('forwards only the kitchen session cookie and its chunks', () => {
    const jar = [
      'next-auth.session-token=PA-SECRET',
      '__Secure-next-auth.session-token=PA-SECRET-2',
      '__Secure-authjs.session-token=KITCHEN',
      '__Secure-authjs.session-token.0=CHUNK0',
      'authjs.session-token.1=CHUNK1',
      'ph_analytics=whatever',
    ].join('; ')

    const filtered = filterKitchenCookies(jar)

    expect(filtered).toContain('__Secure-authjs.session-token=KITCHEN')
    expect(filtered).toContain('__Secure-authjs.session-token.0=CHUNK0')
    expect(filtered).toContain('authjs.session-token.1=CHUNK1')
    // This app's own session token must never be handed to the kitchen.
    expect(filtered).not.toContain('PA-SECRET')
    expect(filtered).not.toContain('ph_analytics')
  })

  it('announces itself with x-alchm-bridge', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 'wten-1', email: 'a@example.com' } }),
    })

    await resolveBridgeUser('__Secure-authjs.session-token=hdr-case')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['x-alchm-bridge']).toBe('agents')
    expect(init.headers.cookie).toBe('__Secure-authjs.session-token=hdr-case')
  })

  it('reports a timeout as unavailable, not as a signed-out visitor', async () => {
    fetchMock.mockRejectedValue(new Error('The operation timed out'))

    const outcome = await resolveBridgeOutcome('__Secure-authjs.session-token=timeout-case')

    expect(outcome.status).toBe('unavailable')
  })

  it('reports a kitchen 5xx as unavailable', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })

    const outcome = await resolveBridgeOutcome('__Secure-authjs.session-token=5xx-case')

    expect(outcome.status).toBe('unavailable')
  })

  it('reports a kitchen 401 as genuinely anonymous', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })

    const outcome = await resolveBridgeOutcome('__Secure-authjs.session-token=401-case')

    expect(outcome.status).toBe('anonymous')
  })

  it('does not call the kitchen when no kitchen cookie is present', async () => {
    const outcome = await resolveBridgeOutcome('next-auth.session-token=only-pa')

    expect(outcome.status).toBe('anonymous')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('B3 — money routes fail closed', () => {
  it('returns 503 when identity cannot be verified, instead of 401 or anonymous', async () => {
    vi.resetModules()

    vi.doMock('@/lib/auth', () => ({
      resolveAuth: vi.fn(async () => ({ session: null, identityUnavailable: true })),
    }))
    vi.doMock('@/lib/security/internal-auth', () => ({
      hasInternalApiSecret: () => false,
      hasPrivilegedInternalApiSecret: () => false,
    }))
    vi.doMock('@/lib/admin-auth', () => ({
      requireAdmin: vi.fn(),
      adminErrorResponse: vi.fn(),
    }))

    const { requireUserOrService } = await import('@/lib/security/privileged-api-auth')
    const request = new Request('https://agents.alchm.kitchen/api/paid', { method: 'GET' })

    const access = await requireUserOrService(request, { failClosed: true })

    expect(access.ok).toBe(false)
    if (!access.ok) {
      expect(access.response.status).toBe(503)
      expect(access.response.headers.get('retry-after')).toBe('30')
    }

    // The same outage on an ordinary read path is still a plain 401.
    const ordinary = await requireUserOrService(request)
    expect(ordinary.ok).toBe(false)
    if (!ordinary.ok) expect(ordinary.response.status).toBe(401)

    vi.doUnmock('@/lib/auth')
    vi.resetModules()
  })
})
