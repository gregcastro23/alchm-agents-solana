// @vitest-environment node
/**
 * /api/generate-recipe caller auth, step 1 (log-only): a user or service bearer
 * is recognised, an anonymous call is still served but logged and rate-limited,
 * and RECIPE_AUTH_ENFORCE=true (step 2) turns anonymous calls into 401s.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  request: vi.fn(async () => ({ id: 'recipe-1', name: 'Solar Risotto' })),
  resolveAuth: vi.fn(async () => ({ session: null, identityUnavailable: false })),
}))
vi.mock('@/lib/backend', () => ({ backend: { request: mocks.request } }))
vi.mock('@/lib/auth', () => ({ resolveAuth: mocks.resolveAuth }))
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: vi.fn(), adminErrorResponse: vi.fn() }))

import { POST } from '@/app/api/generate-recipe/route'
import { __resetRateLimitStore } from '@/lib/security/rate-limit'

const SECRET = 'internal-s3cret'
const call = (headers: Record<string, string> = {}) =>
  POST(
    new NextRequest('https://agents.alchm.kitchen/api/generate-recipe', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9', ...headers },
      body: JSON.stringify({ prompt: 'fire', tier: 'premium' }),
    })
  )

let warn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  __resetRateLimitStore()
  vi.stubEnv('INTERNAL_API_SECRET', SECRET)
  vi.stubEnv('RECIPE_AUTH_ENFORCE', '')
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('step 1: log-only', () => {
  it('serves an anonymous call but logs it with a hashed IP, never the IP itself', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    const line = warn.mock.calls
      .map(c => String(c[0]))
      .find(l => l.includes('recipe_auth_unauthenticated'))
    expect(line).toMatch(/path=\/api\/generate-recipe ip_hash=[0-9a-f]{16} enforced=false/)
    expect(line).not.toContain('203.0.113.9')
  })

  it('recognises the service bearer and does not log it as anonymous', async () => {
    const res = await call({ authorization: `Bearer ${SECRET}` })
    expect(res.status).toBe(200)
    expect(warn.mock.calls.some(c => String(c[0]).includes('recipe_auth_unauthenticated'))).toBe(
      false
    )
  })

  it('a wrong bearer is simply anonymous (logged, still served in step 1)', async () => {
    const res = await call({ authorization: 'Bearer nope' })
    expect(res.status).toBe(200)
    expect(warn.mock.calls.some(c => String(c[0]).includes('recipe_auth_unauthenticated'))).toBe(
      true
    )
  })

  it('rate-limits anonymous callers per hashed IP with a Retry-After', async () => {
    for (let i = 0; i < 10; i++) expect((await call()).status).toBe(200)
    const limited = await call()
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    // A different caller is unaffected; so is the service bearer.
    expect((await call({ 'x-forwarded-for': '198.51.100.4' })).status).toBe(200)
    expect((await call({ authorization: `Bearer ${SECRET}` })).status).toBe(200)
    expect(mocks.request).toHaveBeenCalledTimes(12)
  })
})

describe('step 2: RECIPE_AUTH_ENFORCE=true', () => {
  it('rejects anonymous calls before any model runs, and still serves the service bearer', async () => {
    vi.stubEnv('RECIPE_AUTH_ENFORCE', 'true')
    mocks.request.mockClear()
    expect((await call()).status).toBe(401)
    expect(mocks.request).not.toHaveBeenCalled()
    expect((await call({ authorization: `Bearer ${SECRET}` })).status).toBe(200)
  })
})
