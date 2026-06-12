import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backend } from '@/lib/backend'

const REQUIRED_METADATA_FIELDS = ['tier', 'provider', 'model', 'cache'] as const

describe('backend /api/chat metadata contract', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('forwards {tier, provider, model, cache} unchanged from the FastAPI response', async () => {
    const stubMetadata = {
      timestamp: '2026-05-15T00:00:00Z',
      rag_used: false,
      tier: 'free',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      persona_source: 'override',
      persona_cache_key: 'abcd1234abcd1234',
      cache: null,
    }
    const stubResponse = {
      text: 'A stubbed reply.',
      agentId: 'socrates',
      sessionId: 'session-test',
      metadata: stubMetadata,
    }

    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(stubResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    ) as unknown as typeof fetch

    const result = await backend.agents.chat({
      agentId: 'socrates',
      message: 'hello',
    })

    expect(result.text).toBe('A stubbed reply.')
    expect(result.metadata).toBeDefined()
    for (const field of REQUIRED_METADATA_FIELDS) {
      expect(
        result.metadata,
        `metadata must include ${field} — required for cost/observability dashboards`
      ).toHaveProperty(field)
    }
    expect(result.metadata.tier).toBe('free')
    expect(result.metadata.provider).toBe('groq')
    expect(result.metadata.model).toBe('llama-3.3-70b-versatile')
  })

  it('preserves a cache object when Anthropic is the used provider', async () => {
    const stubResponse = {
      text: 'A reflective reply.',
      agentId: 'albert-einstein',
      sessionId: 'session-test',
      metadata: {
        timestamp: '2026-05-15T00:00:00Z',
        rag_used: true,
        tier: 'cheap_fast',
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        persona_source: 'override',
        persona_cache_key: 'feedfacefeedface',
        cache: { read: 1234, write: 89 },
      },
    }

    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(stubResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    ) as unknown as typeof fetch

    const result = await backend.agents.chat({
      agentId: 'albert-einstein',
      message: 'hello',
      modelTier: 'cheap_fast',
    })

    expect(result.metadata.cache).toEqual({ read: 1234, write: 89 })
    expect(result.metadata.provider).toBe('anthropic')
  })
})
