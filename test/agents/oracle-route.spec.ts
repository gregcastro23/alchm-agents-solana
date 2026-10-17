// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ORACLE_SYSTEM_PROMPT } from '@/lib/agents/oracle-persona'
import * as route from '@/app/api/agents/oracle/route'

const mocks = vi.hoisted(() => ({
  gatewayEnabled: false,
  generateText: vi.fn(),
  groq: vi.fn((id: string) => ({ provider: 'groq', id })),
  google: vi.fn((id: string) => ({ provider: 'google', id })),
  openai: vi.fn((id: string) => ({ provider: 'openai', id })),
  anthropic: vi.fn((id: string) => ({ provider: 'anthropic', id })),
  rateLimit: vi.fn(),
}))

vi.mock('ai', () => ({ generateText: mocks.generateText }))
vi.mock('@/lib/models/gateway', () => ({
  get isGatewayEnabled() {
    return mocks.gatewayEnabled
  },
  gatewayGroq: mocks.groq,
  gatewayGoogle: mocks.google,
  gatewayOpenAI: mocks.openai,
  gatewayAnthropic: mocks.anthropic,
  gatewayOpenRouter: vi.fn(),
}))

vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: mocks.rateLimit,
  getClientIp: (headers: Headers) =>
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
}))

const { POST, OPTIONS } = route

const URL_ = 'http://localhost:3000/api/agents/oracle'

function post(body: unknown, raw = false): NextRequest {
  return new NextRequest(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  })
}

/** The one call the mocked model SDK received. */
function lastCall(): Record<string, unknown> {
  const calls = mocks.generateText.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  return calls[calls.length - 1][0] as Record<string, unknown>
}

const ALL_KEYS = [
  'GROQ_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'HISTORICAL_AGENT_DEFAULT_TIER',
  'HISTORICAL_AGENT_MAX_TIER',
] as const

beforeEach(() => {
  vi.clearAllMocks()
  mocks.gatewayEnabled = false
  for (const key of ALL_KEYS) vi.stubEnv(key, '')
  vi.stubEnv('GROQ_API_KEY', 'test-groq-key')
  mocks.generateText.mockResolvedValue({ text: 'The stars favour the bold.' })
  mocks.rateLimit.mockReturnValue({ ok: true, remaining: 99, limit: 100, resetMs: 1000 })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/agents/oracle: input validation (400)', () => {
  async function expectBadRequest(body: unknown, raw = false) {
    const res = await POST(post(body, raw))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(typeof json.error).toBe('string')
    expect(json.error.length).toBeGreaterThan(0)
    expect(json).not.toHaveProperty('answer')
    expect(mocks.generateText).not.toHaveBeenCalled()
    return json
  }

  it('rejects a missing, empty or whitespace-only question', async () => {
    await expectBadRequest({})
    await expectBadRequest({ context: 'sky' })
    await expectBadRequest({ question: '' })
    await expectBadRequest({ question: '   \n\t  ' })
  })

  it('rejects a non-string question', async () => {
    for (const question of [42, true, null, ['a'], { q: 'a' }]) {
      await expectBadRequest({ question })
    }
  })

  it('rejects a question over 500 bytes (ASCII)', async () => {
    await expectBadRequest({ question: 'a'.repeat(501) })
  })

  it('counts BYTES not characters: multi-byte questions over 500 bytes are rejected', async () => {
    // 251 chars but 502 bytes.
    await expectBadRequest({ question: 'é'.repeat(251) })
    // 126 chars but 504 bytes (4-byte code points).
    await expectBadRequest({ question: '🔮'.repeat(126) })
    // 167 chars but 501 bytes (3-byte code points).
    await expectBadRequest({ question: '☉'.repeat(167) })
  })

  it('measures the byte limit on the TRIMMED question', async () => {
    const padded = `  ${'a'.repeat(500)}  `
    const res = await POST(post({ question: padded }))
    expect(res.status).toBe(200)
  })

  it('accepts a question of exactly 500 bytes, including multi-byte', async () => {
    expect((await POST(post({ question: 'a'.repeat(500) }))).status).toBe(200)
    expect((await POST(post({ question: 'é'.repeat(250) }))).status).toBe(200)
    expect((await POST(post({ question: '🔮'.repeat(125) }))).status).toBe(200)
  })

  it('rejects a non-string context', async () => {
    for (const context of [42, true, ['sky'], { sky: 'x' }]) {
      await expectBadRequest({ question: 'Who holds Zone 3?', context })
    }
  })

  it('rejects a body that is not a JSON object', async () => {
    await expectBadRequest('not json', true)
    await expectBadRequest('', true)
    await expectBadRequest(null)
    await expectBadRequest(['Who holds Zone 3?'])
    await expectBadRequest('Who holds Zone 3?')
  })

  it('never echoes the question back in an error', async () => {
    const json = await expectBadRequest({ question: 'SECRET-QUESTION'.repeat(40) })
    expect(JSON.stringify(json)).not.toContain('SECRET-QUESTION')
  })
})

describe('POST /api/agents/oracle: happy path (200)', () => {
  it('answers with exactly {answer, provider, model, timestamp}', async () => {
    mocks.generateText.mockResolvedValue({ text: '  The   stars\nfavour\n\nthe  bold.  ' })

    const res = await POST(post({ question: 'Should I attack Zone 3?' }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Object.keys(json).sort()).toEqual(['answer', 'model', 'provider', 'timestamp'])
    expect(json.answer).toBe('The stars favour the bold.') // whitespace collapsed + trimmed
    expect(json.provider).toBe('groq')
    expect(json.model).toBe('llama-3.3-70b-versatile')
    expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp)
  })

  it('passes the byte-stable persona as the system prompt, verbatim', async () => {
    await POST(post({ question: 'Should I attack Zone 3?', context: 'Mars is rising.' }))

    expect(lastCall().system).toBe(ORACLE_SYSTEM_PROMPT)
  })

  it('never interpolates the question or context into the system prompt', async () => {
    await POST(post({ question: 'UNIQUE-QUESTION-TOKEN', context: 'UNIQUE-CONTEXT-TOKEN' }))

    const system = String(lastCall().system)
    expect(system).not.toContain('UNIQUE-QUESTION-TOKEN')
    expect(system).not.toContain('UNIQUE-CONTEXT-TOKEN')
  })

  it('builds the user turn with a context block when context is present', async () => {
    await POST(post({ question: 'Should I attack Zone 3?', context: 'Mars is rising.' }))

    expect(lastCall().prompt).toBe(
      'Context:\nMars is rising.\n\nQuestion:\nShould I attack Zone 3?\n\nReply in at most 120 words.'
    )
  })

  it('omits the context block when context is empty, blank, null or absent', async () => {
    const expected = 'Question:\nShould I attack Zone 3?\n\nReply in at most 120 words.'
    for (const body of [
      { question: 'Should I attack Zone 3?', context: '' },
      { question: 'Should I attack Zone 3?', context: '  \n ' },
      { question: 'Should I attack Zone 3?', context: null },
      { question: 'Should I attack Zone 3?' },
    ]) {
      mocks.generateText.mockClear()
      const res = await POST(post(body))
      expect(res.status).toBe(200)
      expect(lastCall().prompt).toBe(expected)
    }
  })

  it('trims the question and the context', async () => {
    await POST(post({ question: '  Who holds Zone 3?  \n', context: '\n  Sun in Leo.  ' }))

    expect(lastCall().prompt).toBe(
      'Context:\nSun in Leo.\n\nQuestion:\nWho holds Zone 3?\n\nReply in at most 120 words.'
    )
  })

  it('caps context at 2000 characters', async () => {
    await POST(post({ question: 'Q?', context: 'x'.repeat(3000) }))

    expect(lastCall().prompt).toBe(
      `Context:\n${'x'.repeat(2000)}\n\nQuestion:\nQ?\n\nReply in at most 120 words.`
    )
  })

  it('caps context by code point so an astral character is never split', async () => {
    await POST(post({ question: 'Q?', context: '🔮'.repeat(2500) }))

    const prompt = String(lastCall().prompt)
    const context = prompt.slice('Context:\n'.length, prompt.indexOf('\n\nQuestion:'))
    expect(Array.from(context)).toHaveLength(2000)
    expect(context).toBe('🔮'.repeat(2000))
    // A split surrogate pair would not survive a UTF-8 round trip.
    expect(Buffer.from(prompt, 'utf8').toString('utf8')).toBe(prompt)
  })

  it('limits output to 280 tokens, with no SDK retries and an abort signal', async () => {
    await POST(post({ question: 'Q?' }))

    const call = lastCall()
    expect(call.maxOutputTokens).toBe(280)
    expect(call.maxRetries).toBe(0)
    expect(call.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('marks responses uncacheable (vercel.json would otherwise add s-maxage=60)', async () => {
    const ok = await POST(post({ question: 'Q?' }))
    expect(ok.headers.get('cache-control')).toBe('no-store')
    const bad = await POST(post({}))
    expect(bad.headers.get('cache-control')).toBe('no-store')
  })
})

describe('POST /api/agents/oracle: provider chain', () => {
  it('uses the registry Gateway ids when the AI Gateway is on', async () => {
    mocks.gatewayEnabled = true

    const res = await POST(post({ question: 'Q?' }))
    const json = await res.json()

    expect(mocks.groq).toHaveBeenCalledWith('meta/llama-3.3-70b')
    expect(json).toMatchObject({ provider: 'groq', model: 'meta/llama-3.3-70b' })
  })

  it('walks Groq, then Gemini, then OpenAI, skipping links without credentials', async () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test-google-key')
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    mocks.generateText
      .mockRejectedValueOnce(new Error('groq down'))
      .mockRejectedValueOnce(new Error('gemini quota'))
      .mockResolvedValueOnce({ text: 'OpenAI answered.' })

    const json = await (await POST(post({ question: 'Q?' }))).json()

    expect(mocks.generateText).toHaveBeenCalledTimes(3)
    expect(mocks.groq).toHaveBeenCalledWith('llama-3.3-70b-versatile')
    expect(mocks.google).toHaveBeenCalledWith('gemini-2.0-flash')
    expect(mocks.openai).toHaveBeenCalledWith('gpt-4o-mini')
    expect(json).toMatchObject({
      answer: 'OpenAI answered.',
      provider: 'openai',
      model: 'gpt-4o-mini',
    })
  })

  it('moves on when a provider returns empty text', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    mocks.generateText
      .mockResolvedValueOnce({ text: '  \n ' })
      .mockResolvedValueOnce({ text: 'Second link answered.' })

    const json = await (await POST(post({ question: 'Q?' }))).json()

    expect(json).toMatchObject({ answer: 'Second link answered.', provider: 'openai' })
  })

  it('only calls links that have a key', async () => {
    vi.stubEnv('GROQ_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')

    await POST(post({ question: 'Q?' }))

    expect(mocks.groq).not.toHaveBeenCalled()
    expect(mocks.google).not.toHaveBeenCalled()
    expect(mocks.openai).toHaveBeenCalledTimes(1)
  })

  describe('Anthropic is opt-in by tier (CLAUDE.md: credits reserved for development)', () => {
    beforeEach(() => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key')
    })

    it('is never called on the default (free) tier, even with a key', async () => {
      await POST(post({ question: 'Q?' }))
      expect(mocks.anthropic).not.toHaveBeenCalled()
    })

    it('is never called when the tier var is unrecognised', async () => {
      vi.stubEnv('HISTORICAL_AGENT_DEFAULT_TIER', 'platinum')
      await POST(post({ question: 'Q?' }))
      expect(mocks.anthropic).not.toHaveBeenCalled()
    })

    it('leads the chain on cheap_fast with the registry Haiku id', async () => {
      vi.stubEnv('HISTORICAL_AGENT_DEFAULT_TIER', 'cheap_fast')

      const json = await (await POST(post({ question: 'Q?' }))).json()

      expect(mocks.anthropic).toHaveBeenCalledWith('claude-haiku-4-5-20251001')
      expect(mocks.groq).not.toHaveBeenCalled() // first link answered
      expect(json).toMatchObject({ provider: 'anthropic', model: 'claude-haiku-4-5-20251001' })
    })

    it('falls through to the free chain when the paid link fails', async () => {
      vi.stubEnv('HISTORICAL_AGENT_DEFAULT_TIER', 'cheap_fast')
      mocks.generateText
        .mockRejectedValueOnce(new Error('401 invalid x-api-key'))
        .mockResolvedValueOnce({ text: 'Groq answered.' })

      const json = await (await POST(post({ question: 'Q?' }))).json()

      expect(json).toMatchObject({ provider: 'groq', answer: 'Groq answered.' })
    })

    it('uses Sonnet on primary and clamps reflective to it', async () => {
      vi.stubEnv('HISTORICAL_AGENT_DEFAULT_TIER', 'primary')
      await POST(post({ question: 'Q?' }))
      expect(mocks.anthropic).toHaveBeenLastCalledWith('claude-sonnet-4-6')

      vi.stubEnv('HISTORICAL_AGENT_DEFAULT_TIER', 'reflective')
      vi.stubEnv('HISTORICAL_AGENT_MAX_TIER', 'reflective')
      await POST(post({ question: 'Q?' }))
      expect(mocks.anthropic).toHaveBeenLastCalledWith('claude-sonnet-4-6')
    })

    it('is capped by HISTORICAL_AGENT_MAX_TIER (default primary)', async () => {
      vi.stubEnv('HISTORICAL_AGENT_DEFAULT_TIER', 'reflective')
      await POST(post({ question: 'Q?' }))
      expect(mocks.anthropic).toHaveBeenLastCalledWith('claude-sonnet-4-6')

      mocks.anthropic.mockClear()
      vi.stubEnv('HISTORICAL_AGENT_MAX_TIER', 'free')
      await POST(post({ question: 'Q?' }))
      expect(mocks.anthropic).not.toHaveBeenCalled()
    })

    it('is skipped on a paid tier when there is no Anthropic key and no Gateway', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', '')
      vi.stubEnv('HISTORICAL_AGENT_DEFAULT_TIER', 'cheap_fast')
      await POST(post({ question: 'Q?' }))
      expect(mocks.anthropic).not.toHaveBeenCalled()
    })

    it('uses the Gateway catalog id when the Gateway is on', async () => {
      mocks.gatewayEnabled = true
      vi.stubEnv('HISTORICAL_AGENT_DEFAULT_TIER', 'cheap_fast')

      const json = await (await POST(post({ question: 'Q?' }))).json()

      expect(mocks.anthropic).toHaveBeenCalledWith('anthropic/claude-haiku-4.5')
      expect(json).toMatchObject({ provider: 'anthropic', model: 'anthropic/claude-haiku-4.5' })
    })
  })
})

describe('POST /api/agents/oracle: no answer is non-2xx (503), never a stub', () => {
  async function expectUnavailable(res: Response) {
    expect(res.status).toBe(503)
    expect(res.status).toBeGreaterThanOrEqual(500) // non-2xx: the feeder falls back
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(typeof json.error).toBe('string')
    expect(json).not.toHaveProperty('answer')
    expect(json).not.toHaveProperty('provider')
    expect(json).not.toHaveProperty('model')
  }

  it('is 503 when the only provider throws', async () => {
    mocks.generateText.mockRejectedValue(new Error('provider exploded'))
    await expectUnavailable(await POST(post({ question: 'Q?' })))
  })

  it('is 503 when every provider in the chain throws', async () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test-google-key')
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    mocks.generateText.mockRejectedValue(new Error('everything is down'))

    await expectUnavailable(await POST(post({ question: 'Q?' })))
    expect(mocks.generateText).toHaveBeenCalledTimes(3)
  })

  it('is 503 when the model returns empty or whitespace-only text', async () => {
    for (const text of ['', '   \n\t ', undefined]) {
      mocks.generateText.mockResolvedValue({ text })
      await expectUnavailable(await POST(post({ question: 'Q?' })))
    }
  })

  it('is 503 without calling any model when no provider is configured', async () => {
    vi.stubEnv('GROQ_API_KEY', '')

    await expectUnavailable(await POST(post({ question: 'Q?' })))
    expect(mocks.generateText).not.toHaveBeenCalled()
  })

  it('is 503 when a provider rejects with a non-Error value', async () => {
    mocks.generateText.mockRejectedValue('boom')
    await expectUnavailable(await POST(post({ question: 'Q?' })))
  })

  it('cuts off a hung provider at 8 s, aborts it, and tries the next link', async () => {
    vi.useFakeTimers()
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    const signals: AbortSignal[] = []
    mocks.generateText.mockImplementationOnce(({ abortSignal }: { abortSignal: AbortSignal }) => {
      signals.push(abortSignal)
      return new Promise(() => {}) // never settles, ignores the abort
    })
    mocks.generateText.mockResolvedValueOnce({ text: 'Second link answered.' })

    const pending = POST(post({ question: 'Q?' }))
    await vi.advanceTimersByTimeAsync(7_999)
    expect(mocks.generateText).toHaveBeenCalledTimes(1)
    expect(signals[0].aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    const res = await pending
    expect(signals[0].aborted).toBe(true)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ provider: 'openai', answer: 'Second link answered.' })
  })

  it('answers 503 inside 14 s even when every link hangs', async () => {
    vi.useFakeTimers()
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test-google-key')
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    const signals: AbortSignal[] = []
    mocks.generateText.mockImplementation(({ abortSignal }: { abortSignal: AbortSignal }) => {
      signals.push(abortSignal)
      return new Promise(() => {})
    })

    const started = Date.now()
    const pending = POST(post({ question: 'Q?' }))
    // Links get 8 s, then the 6 s left of the 14 s budget; the third never starts.
    await vi.advanceTimersByTimeAsync(14_000)

    await expectUnavailable(await pending)
    expect(Date.now() - started).toBeLessThanOrEqual(14_000)
    expect(mocks.generateText).toHaveBeenCalledTimes(2)
    expect(signals.every(signal => signal.aborted)).toBe(true)
  })

  it('stays inside the function limit and the feeder 30 s timeout', () => {
    expect(route.maxDuration).toBeGreaterThan(14)
    expect(route.maxDuration).toBeLessThan(30)
  })
})

describe('POST /api/agents/oracle: no leaks', () => {
  it('logs neither the question, the context nor provider error text', async () => {
    mocks.generateText.mockRejectedValue(
      Object.assign(new Error('Bad key sk-live-XYZ for prompt: PRIVATE-QUESTION'), {
        statusCode: 401,
      })
    )

    const res = await POST(
      post({ question: 'PRIVATE-QUESTION about Zone 3', context: 'PRIVATE-CONTEXT' })
    )
    expect(res.status).toBe(503)
    expect(JSON.stringify(await res.json())).not.toMatch(/PRIVATE|sk-live/)

    const logged = [console.log, console.warn, console.error]
      .flatMap(spy => (spy as unknown as { mock: { calls: unknown[][] } }).mock.calls)
      .flat()
      .join('\n')
    expect(logged).toContain('provider=groq')
    expect(logged).toContain('Error:401')
    expect(logged).not.toMatch(/PRIVATE|sk-live/)
  })
})

describe('OPTIONS /api/agents/oracle and route config', () => {
  it('answers the CORS preflight like the sibling brain routes', async () => {
    const res = await OPTIONS()
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type')
  })

  it('is a dynamic, uncached Node route', () => {
    expect(route.runtime).toBe('nodejs')
    expect(route.dynamic).toBe('force-dynamic')
    expect(route.revalidate).toBe(0)
  })
})

describe('POST /api/agents/oracle: public-route gate (429, 413)', () => {
  const OVER = { ok: false, remaining: 0, limit: 1, resetMs: 1000 }
  const OK = { ok: true, remaining: 9, limit: 10, resetMs: 1000 }

  it('keys the limit per caller (hourly) and then overall, with the Python primary defaults', async () => {
    const req = new NextRequest(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
      body: JSON.stringify({ question: 'Who holds the Crown?' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mocks.rateLimit.mock.calls).toEqual([
      ['oracle:203.0.113.7', { limit: 120, windowMs: 3_600_000 }],
      ['oracle:global', { limit: 400, windowMs: 3_600_000 }],
    ])
  })

  it('answers 429 with Retry-After, never reaches a model, and is not a contract-valid body', async () => {
    mocks.rateLimit.mockReturnValueOnce(OVER)

    const res = await POST(post({ question: 'Who holds the Crown?' }))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    const json = await res.json()
    expect(json).toEqual({ success: false, error: 'Too Many Requests' })
    expect(json.answer).toBeUndefined()
    expect(mocks.generateText).not.toHaveBeenCalled()
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1) // an over-limit caller does not spend the global budget
  })

  it('answers 429 when the overall budget is spent even though the caller is fine', async () => {
    mocks.rateLimit.mockReturnValueOnce(OK).mockReturnValueOnce(OVER)

    const res = await POST(post({ question: 'Who holds the Crown?' }))

    expect(res.status).toBe(429)
    expect(mocks.generateText).not.toHaveBeenCalled()
  })

  it('reads the limits from the same env names as the primary, ignoring junk', async () => {
    vi.stubEnv('BRAIN_ORACLE_PER_CALLER_PER_HOUR', '7')
    vi.stubEnv('BRAIN_ORACLE_GLOBAL_PER_HOUR', 'many')

    await POST(post({ question: 'Who holds the Crown?' }))

    expect(mocks.rateLimit.mock.calls.map(c => c[1].limit)).toEqual([7, 400])
  })

  it('rejects a body declared larger than 16 KiB with 413 before any work', async () => {
    const big = JSON.stringify({ question: 'q', context: 'x'.repeat(20_000) })
    const req = new NextRequest(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(big.length) },
      body: big,
    })

    const res = await POST(req)

    expect(res.status).toBe(413)
    expect(mocks.generateText).not.toHaveBeenCalled()
    expect(mocks.rateLimit).not.toHaveBeenCalled()
  })
})
