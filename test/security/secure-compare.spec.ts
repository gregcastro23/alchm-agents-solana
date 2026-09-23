// @vitest-environment node
/**
 * Constant-time secret comparison and the cron auth gate built on it.
 * Same answers as `===` on real inputs; fail closed when nothing is configured;
 * the local-dev bypass never fires in anything deployed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bearerMatches, bearerToken, safeEqual, safeEqualAny } from '@/lib/security/secure-compare'
import { authorizeCron, isLocalDevelopment } from '@/lib/security/cron-auth'

describe('safeEqual', () => {
  it('matches only the exact secret', () => {
    expect(safeEqual('s3cret-value', 's3cret-value')).toBe(true)
    expect(safeEqual('s3cret-valuf', 's3cret-value')).toBe(false)
    expect(safeEqual('s3cret', 's3cret-value')).toBe(false) // prefix, different length
    expect(safeEqual('s3cret-value-and-more', 's3cret-value')).toBe(false)
  })

  it('fails closed: no configured secret matches nothing, not even an empty header', () => {
    expect(safeEqual('', '')).toBe(false)
    expect(safeEqual('anything', undefined)).toBe(false)
    expect(safeEqual(null, 's3cret')).toBe(false)
    expect(safeEqual(undefined, 's3cret')).toBe(false)
    expect(safeEqual('', 's3cret')).toBe(false)
  })

  it('safeEqualAny skips unset secrets and matches any configured one', () => {
    expect(safeEqualAny('b', [undefined, 'a', 'b'])).toBe(true)
    expect(safeEqualAny('c', [undefined, 'a', 'b'])).toBe(false)
    expect(safeEqualAny('', [undefined, ''])).toBe(false)
  })
})

describe('bearer parsing', () => {
  it('requires the Bearer scheme and the exact secret', () => {
    expect(bearerMatches('Bearer abc123', 'abc123')).toBe(true)
    expect(bearerMatches('bearer abc123', 'abc123')).toBe(true)
    expect(bearerMatches('abc123', 'abc123')).toBe(false)
    expect(bearerMatches('Bearer abc124', 'abc123')).toBe(false)
    expect(bearerMatches('Bearer ', '')).toBe(false)
    expect(bearerMatches(null, 'abc123')).toBe(false)
    expect(bearerToken('Basic abc')).toBeNull()
  })
})

describe('isLocalDevelopment', () => {
  it('is true only for a bare `next dev` process', () => {
    expect(isLocalDevelopment({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true)
  })

  it.each([
    ['production build (prod + preview deployments)', { NODE_ENV: 'production' }],
    ['the test runner', { NODE_ENV: 'test' }],
    ['unset NODE_ENV', {}],
    ['a Vercel preview', { NODE_ENV: 'development', VERCEL_ENV: 'preview' }],
    ['Vercel production', { NODE_ENV: 'development', VERCEL_ENV: 'production' }],
    ['any Vercel runtime region', { NODE_ENV: 'development', VERCEL_REGION: 'iad1' }],
    ['Railway', { NODE_ENV: 'development', RAILWAY_ENVIRONMENT_NAME: 'production' }],
  ])('is false for %s', (_label, env) => {
    expect(isLocalDevelopment(env as NodeJS.ProcessEnv)).toBe(false)
  })
})

describe('authorizeCron', () => {
  afterEach(() => vi.unstubAllEnvs())

  const req = (headers: Record<string, string> = {}) =>
    new Request('https://agents.alchm.kitchen/api/cron/x', { headers })

  it('accepts the right bearer and rejects a wrong or missing one', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'cron-s3cret')
    expect(authorizeCron(req({ authorization: 'Bearer cron-s3cret' }), 't')).toEqual({
      ok: true,
      via: 'cron-secret',
    })
    expect(authorizeCron(req({ authorization: 'Bearer cron-s3creT' }), 't').ok).toBe(false)
    expect(authorizeCron(req(), 't').ok).toBe(false)
  })

  it('no longer lets a WRONG secret through outside production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('CRON_SECRET', 'cron-s3cret')
    const res = authorizeCron(req({ authorization: 'Bearer nope' }), 't')
    expect(res.ok).toBe(false)
  })

  it('bypasses only in local development with no secret configured', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('CRON_SECRET', '')
    expect(authorizeCron(req(), 't')).toEqual({ ok: true, via: 'local-dev-bypass' })
  })

  it('refuses an unconfigured secret on a Vercel preview (NODE_ENV=production there)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('CRON_SECRET', '')
    const res = authorizeCron(req(), 't')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(401)
  })

  it('accepts a route-specific extra secret in an extra header', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'a')
    const res = authorizeCron(req({ 'x-cron-secret': 'legacy' }), 't', {
      extraSecrets: ['legacy'],
      headerNames: ['x-cron-secret'],
    })
    expect(res.ok).toBe(true)
  })
})
