/**
 * Session-surface hardening.
 *
 * A2: the desktop session route must not fabricate a signed-in session with
 *     balances no ledger backs when it is running in production.
 * A3: sign-out is a state change — POST only, same-origin, and it must expire
 *     chunked session cookies as well as the base names.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [] }) }))
vi.mock('@/lib/db', () => ({
  prisma: { desktopApiKey: { findFirst: vi.fn(), update: vi.fn() } },
  StreakTracker: {},
}))
vi.mock('@/lib/services/economyService', () => ({ EconomyService: { getBalances: vi.fn() } }))
vi.mock('@/lib/profile-yield', () => ({ buildProfileYieldStateFromBalances: vi.fn() }))

const ORIGINAL_ENV = { ...process.env }

describe('desktop session route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('refuses to fabricate a local-dev session in production', async () => {
    process.env.VERCEL_ENV = 'production'
    const { GET } = await import('@/app/api/desktop/session/route')

    const response = await GET(new Request('https://agents.alchm.kitchen/api/desktop/session'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(JSON.stringify(body)).not.toContain('local-dev')
    expect(JSON.stringify(body)).not.toContain('150')
  })

  it('still serves the local-dev session outside production', async () => {
    delete process.env.VERCEL_ENV
    process.env.NODE_ENV = 'development'
    const { GET } = await import('@/app/api/desktop/session/route')

    const response = await GET(new Request('http://localhost:3000/api/desktop/session'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.mode).toBe('local-dev')
  })
})

describe('logout route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NEXTAUTH_URL = 'https://agents.alchm.kitchen'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('does not sign the user out on GET', async () => {
    const mod = await import('@/app/api/logout/route')
    const response = await mod.GET()

    expect(response.status).toBe(405)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('rejects a cross-origin POST', async () => {
    const { POST } = await import('@/app/api/logout/route')

    const response = await POST(
      new Request('https://agents.alchm.kitchen/api/logout', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
      })
    )

    expect(response.status).toBe(403)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('clears base and chunked session cookies on a same-origin POST', async () => {
    const { POST } = await import('@/app/api/logout/route')

    const response = await POST(
      new Request('https://agents.alchm.kitchen/api/logout', {
        method: 'POST',
        headers: { origin: 'https://agents.alchm.kitchen' },
      })
    )

    expect(response.status).toBe(307)
    const setCookie = response.headers.getSetCookie().join('\n')

    for (const name of [
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'authjs.session-token',
      '__Secure-authjs.session-token',
    ]) {
      expect(setCookie).toContain(`${name}=`)
      // The chunked forms must go too, or an oversized session survives logout.
      expect(setCookie).toContain(`${name}.0=`)
      expect(setCookie).toContain(`${name}.1=`)
    }
  })
})
