import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST, GET, DELETE } from '@/app/api/account/byok/route'
import { validateProviderKey } from '@/lib/byok/validate'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    user_provider_keys: {
      upsert: vi.fn(async ({ create }) => ({
        userId: create.userId,
        provider: create.provider,
        last4: create.last4,
        validatedAt: create.validatedAt,
      })),
      findMany: vi.fn(async ({ where }) => [
        {
          provider: 'openrouter',
          last4: '1234',
          validatedAt: new Date(),
        },
      ]),
      findUnique: vi.fn(),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  },
}))

import { auth } from '@/lib/auth'

describe('BYOK Account API & Validation Suite (OpenRouter & Google)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BYOK_ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    ;(auth as any).mockResolvedValue({ user: { id: 'test-user-byok' } })
  })

  describe('validateProviderKey unit testing', () => {
    it('validates OpenRouter key against auth endpoint (mock success & failure)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      // Mock OpenRouter success
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }))
      const validRes = await validateProviderKey('openrouter', 'sk-or-v1-testkey1234')
      expect(validRes.valid).toBe(true)

      // Mock OpenRouter auth failure (401)
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      )
      const invalidRes = await validateProviderKey('openrouter', 'sk-or-invalid')
      expect(invalidRes.valid).toBe(false)
      expect(invalidRes.error).toContain('Invalid OpenRouter API key')

      fetchSpy.mockRestore()
    })

    it('validates Google Gemini key against models endpoint (mock success & failure)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      // Mock Google success
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ models: [] }), { status: 200 }))
      const validRes = await validateProviderKey('google', 'AIzaSyTestGoogleKey5678')
      expect(validRes.valid).toBe(true)

      // Mock Google auth failure (400)
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400 })
      )
      const invalidRes = await validateProviderKey('google', 'AIzaSyInvalidKey')
      expect(invalidRes.valid).toBe(false)
      expect(invalidRes.error).toContain('Invalid Google Gemini API key')

      fetchSpy.mockRestore()
    })
  })

  describe('POST /api/account/byok integration', () => {
    it('rejects unauthorized requests without session', async () => {
      ;(auth as any).mockResolvedValueOnce(null)

      const req = new NextRequest('http://localhost/api/account/byok', {
        method: 'POST',
        body: JSON.stringify({ provider: 'openrouter', apiKey: 'sk-or-v1-test' }),
      })

      const res = await POST(req)
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('rejects invalid or unsupported provider', async () => {
      const req = new NextRequest('http://localhost/api/account/byok', {
        method: 'POST',
        body: JSON.stringify({ provider: 'unsupported-provider', apiKey: 'sk-test' }),
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('provider must be one of')
    })

    it('successfully saves and encrypts OpenRouter key returning masked summary', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }))

      const req = new NextRequest('http://localhost/api/account/byok', {
        method: 'POST',
        body: JSON.stringify({ provider: 'openrouter', apiKey: 'sk-or-v1-abcdef1234' }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.key).toBeDefined()
      expect(data.key.provider).toBe('openrouter')
      expect(data.key.last4).toBe('1234')
      expect(data.key.apiKey).toBeUndefined()

      fetchSpy.mockRestore()
    })

    it('successfully saves and encrypts Google key returning masked summary', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ models: [] }), { status: 200 }))

      const req = new NextRequest('http://localhost/api/account/byok', {
        method: 'POST',
        body: JSON.stringify({ provider: 'google', apiKey: 'AIzaSyGoogleKey9999' }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.key).toBeDefined()
      expect(data.key.provider).toBe('google')
      expect(data.key.last4).toBe('9999')

      fetchSpy.mockRestore()
    })
  })
})
