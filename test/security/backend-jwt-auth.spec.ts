// @vitest-environment node
/**
 * The Bun service's authMiddleware (backend/src/middleware/auth.ts) must fail closed.
 *
 * It used to verify tokens against `process.env.JWT_SECRET || 'your-secret'`, so any
 * deployment without the variable accepted a token anyone could sign with that literal.
 * It now answers 503 on every protected request until a usable secret is configured, and
 * treats the secrets that are public in this repo as unset.
 */
import fs from 'node:fs'
import path from 'node:path'
import jwt from 'jsonwebtoken'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authMiddleware, getJwtSecret } from '../../backend/src/middleware/auth'
import { validateAuthConfig } from '../../backend/src/utils/startup-validation'

const REAL_SECRET = 'a-test-secret-that-is-not-in-the-repo-4f9c2e71b8'
const PUBLIC_SECRETS = ['your-secret', 'your-production-jwt-secret-change-this']

function run(opts: { token?: string } = {}) {
  const req: any = {
    path: '/token-equilibrium',
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
  }
  const res: any = { statusCode: 200, body: undefined }
  res.status = vi.fn((code: number) => {
    res.statusCode = code
    return res
  })
  res.json = vi.fn((body: unknown) => {
    res.body = body
    return res
  })
  const next = vi.fn()
  authMiddleware(req, res, next)
  return { req, res, next }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('authMiddleware without a usable JWT_SECRET', () => {
  const unusable: Array<[string, string | undefined]> = [
    ['unset', undefined],
    ['empty', ''],
    ['whitespace', '   '],
    ...PUBLIC_SECRETS.map((s): [string, string] => [`the public placeholder "${s}"`, s]),
  ]

  it.each(unusable)('refuses every request with 503 when %s', (_label, value) => {
    vi.stubEnv('JWT_SECRET', value)

    for (const token of [undefined, 'garbage', jwt.sign({ sub: 'x' }, REAL_SECRET)]) {
      const { res, next } = run({ token })
      expect(res.statusCode).toBe(503)
      expect(res.body).toEqual({ error: 'Authentication is not configured' })
      expect(next).not.toHaveBeenCalled()
    }
  })

  it.each(PUBLIC_SECRETS)(
    'rejects a token forged with "%s" when the secret is unset',
    forgedWith => {
      vi.stubEnv('JWT_SECRET', undefined)

      const { res, next } = run({ token: jwt.sign({ sub: 'attacker', role: 'admin' }, forgedWith) })

      expect(next).not.toHaveBeenCalled()
      expect(res.statusCode).toBe(503)
    }
  )

  it('reports the missing secret at startup', () => {
    vi.stubEnv('JWT_SECRET', undefined)

    const result = validateAuthConfig()

    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatch(/JWT_SECRET/)
    expect(getJwtSecret()).toBeNull()
  })
})

describe('authMiddleware with a configured JWT_SECRET', () => {
  it('accepts a token signed with the configured secret', () => {
    vi.stubEnv('JWT_SECRET', REAL_SECRET)

    const { req, res, next } = run({ token: jwt.sign({ sub: 'user-1' }, REAL_SECRET) })

    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
    expect(req.user).toMatchObject({ sub: 'user-1' })
  })

  it.each(PUBLIC_SECRETS)('rejects a token signed with "%s"', forgedWith => {
    vi.stubEnv('JWT_SECRET', REAL_SECRET)

    const { res, next } = run({ token: jwt.sign({ sub: 'attacker' }, forgedWith) })

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ error: 'Invalid token' })
  })

  it('rejects a request with no token', () => {
    vi.stubEnv('JWT_SECRET', REAL_SECRET)

    const { res, next } = run()

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
  })

  it('reports nothing at startup', () => {
    vi.stubEnv('JWT_SECRET', REAL_SECRET)

    expect(validateAuthConfig()).toEqual({ valid: true, errors: [], warnings: [] })
    expect(getJwtSecret()).toBe(REAL_SECRET)
  })
})

describe('startup wiring', () => {
  // index.ts starts a server on import, so pin the call by source rather than by running it.
  it('index.ts runs validateAuthConfig in every environment, before the production gate', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../backend/src/index.ts'), 'utf8')
    const start = src.indexOf('async function startServer()')
    const call = src.indexOf('validateAuthConfig()', start)
    const productionGate = src.indexOf("process.env.NODE_ENV === 'production'", start)

    expect(start).toBeGreaterThan(-1)
    expect(call).toBeGreaterThan(start)
    expect(call).toBeLessThan(productionGate)
  })
})
