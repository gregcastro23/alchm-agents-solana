import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('admin browser navigation middleware', () => {
  it('does not require a service secret before cookie-backed admin auth can run', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('INTERNAL_API_SECRET', 'service-only-secret')

    const response = middleware(
      new NextRequest('https://agents.alchm.kitchen/admin', {
        headers: { cookie: 'next-auth.session-token=signed-session' },
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})
