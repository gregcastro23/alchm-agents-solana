/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { generateStructuredVoice, generateVoicedText } from '@/lib/agents/persona/voiced-generation'

const routing = vi.hoisted(() => ({
  gatewayEnabled: false,
  groq: vi.fn((id: string) => ({ provider: 'groq', id })),
  anthropic: vi.fn((id: string) => ({ provider: 'anthropic', id })),
  google: vi.fn((id: string) => ({ provider: 'google', id })),
  generateObject: vi.fn(),
  generateText: vi.fn(),
}))

vi.mock('@/lib/models/gateway', () => ({
  get isGatewayEnabled() {
    return routing.gatewayEnabled
  },
  gatewayGroq: routing.groq,
  gatewayAnthropic: routing.anthropic,
  gatewayGoogle: routing.google,
  gatewayOpenAI: vi.fn(),
  gatewayOpenRouter: vi.fn(),
}))
vi.mock('ai', () => ({
  generateObject: routing.generateObject,
  generateText: routing.generateText,
}))
vi.mock('@/lib/agents/persona/build-agent-context', () => ({
  buildAgentContext: () => ({ personaBlock: 'Speak with your own voice.' }),
}))

const schema = z.object({ text: z.string() })
const voiceOptions = { systemPrompt: 'Host the council.', prompt: 'Explain the sky.' }

beforeEach(() => {
  vi.clearAllMocks()
  routing.gatewayEnabled = false
  vi.stubEnv('ANTHROPIC_API_KEY', '')
  vi.stubEnv('GROQ_API_KEY', '')
  vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '')
  routing.generateObject.mockResolvedValue({ object: { text: 'A grounded observation.' } })
  routing.generateText.mockResolvedValue({ text: 'A living voice.' })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('voiced generation provider routing', () => {
  it('uses canonical schema-capable Gateway models for both council tiers', async () => {
    routing.gatewayEnabled = true
    const ambient = await generateStructuredVoice(schema, voiceOptions)
    expect(routing.anthropic).toHaveBeenCalledWith('anthropic/claude-haiku-4.5')
    expect(routing.groq).not.toHaveBeenCalled()
    expect(ambient).toMatchObject({ source: 'model', modelFamily: 'fast' })
    expect(routing.generateObject).toHaveBeenLastCalledWith(
      expect.objectContaining({
        model: { provider: 'anthropic', id: 'anthropic/claude-haiku-4.5' },
        maxRetries: 0,
        providerOptions: { openai: { strictJsonSchema: true } },
      })
    )

    const substantive = await generateStructuredVoice(schema, {
      ...voiceOptions,
      tier: 'substantive',
    })
    expect(routing.anthropic).toHaveBeenCalledWith('anthropic/claude-haiku-4.5')
    expect(substantive).toMatchObject({ source: 'model', modelFamily: 'substantive' })
    expect(routing.generateObject).toHaveBeenLastCalledWith(
      expect.objectContaining({ providerOptions: { openai: { strictJsonSchema: true } } })
    )
  })

  it('keeps native Anthropic and Groq names when Gateway is disabled', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key')
    await generateStructuredVoice(schema, { ...voiceOptions, tier: 'substantive' })
    expect(routing.anthropic).toHaveBeenCalledWith('claude-haiku-4-5-20251001')

    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')
    await generateStructuredVoice(schema, voiceOptions)
    expect(routing.groq).toHaveBeenCalledWith('llama-3.3-70b-versatile')
    expect(routing.generateObject.mock.calls.at(-1)?.[0]).not.toHaveProperty('providerOptions')
  })

  it('uses Sonnet for opt-in expert hosting and editorial review without changing substantive defaults', async () => {
    routing.gatewayEnabled = true
    expect(
      await generateStructuredVoice(schema, { ...voiceOptions, tier: 'expert' })
    ).toMatchObject({ source: 'model', modelFamily: 'substantive' })
    expect(routing.anthropic).toHaveBeenLastCalledWith('anthropic/claude-sonnet-4.6')
    routing.gatewayEnabled = false
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key')
    await generateStructuredVoice(schema, { ...voiceOptions, tier: 'expert' })
    expect(routing.anthropic).toHaveBeenLastCalledWith('claude-sonnet-4-6')
    await generateStructuredVoice(schema, { ...voiceOptions, tier: 'substantive' })
    expect(routing.anthropic).toHaveBeenLastCalledWith('claude-haiku-4-5-20251001')
  })

  it('retains native Google and Groq credential fallbacks for substantive turns', async () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test-google-key')
    await generateStructuredVoice(schema, { ...voiceOptions, tier: 'substantive' })
    expect(routing.google).toHaveBeenCalledWith('gemini-2.0-flash')

    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '')
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')
    const fallback = await generateStructuredVoice(schema, {
      ...voiceOptions,
      tier: 'substantive',
    })
    expect(routing.groq).toHaveBeenCalledWith('llama-3.3-70b-versatile')
    expect(fallback.modelFamily).toBe('fast')
  })

  it('uses canonical Gateway 70B for text while preserving direct Groq behavior', async () => {
    routing.gatewayEnabled = true
    expect(await generateVoicedText('host', 'Welcome the reader.', { fallback: 'Welcome.' })).toBe(
      'A living voice.'
    )
    expect(routing.groq).toHaveBeenCalledWith('meta/llama-3.3-70b')

    routing.gatewayEnabled = false
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')
    await generateVoicedText('host', 'Welcome the reader.', { fallback: 'Welcome.' })
    expect(routing.groq).toHaveBeenLastCalledWith('llama-3.3-70b-versatile')
  })

  it('returns a grounded briefing without a provider call when credentials are absent', async () => {
    expect(await generateStructuredVoice(schema, voiceOptions)).toMatchObject({
      source: 'grounded_briefing',
      object: null,
      error: 'credentials_unavailable',
    })
    expect(routing.generateObject).not.toHaveBeenCalled()
    expect(await generateVoicedText('host', 'Welcome.', { fallback: 'Welcome.' })).toBe('Welcome.')
    expect(routing.generateText).not.toHaveBeenCalled()
  })

  it('falls back safely on provider errors and leaves retries to council callers', async () => {
    routing.gatewayEnabled = true
    routing.generateObject.mockRejectedValue(new Error('Provider request failed.'))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await generateStructuredVoice(schema, voiceOptions)).toMatchObject({
      source: 'grounded_briefing',
      object: null,
      error: 'provider_failure',
    })
    expect(routing.generateObject).toHaveBeenCalledTimes(1)
    expect(warning).toHaveBeenCalledWith(
      '[voiced-generation] Structured generation failed:',
      'provider_failure'
    )

    routing.generateText.mockRejectedValue(new Error('Provider request failed.'))
    expect(await generateVoicedText('host', 'Welcome.', { fallback: 'Welcome.' })).toBe('Welcome.')
    expect(routing.generateText).toHaveBeenCalledTimes(1)
  })
})
