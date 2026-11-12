import { afterEach, describe, it, expect, vi } from 'vitest'
import { decideModel } from '@/lib/monica/router'

describe('Monica model routing', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults to mini', () => {
    const r = decideModel({ defaultModel: 'gpt-4o-mini', complexity: 'simple' })
    expect(r.modelId).toBe('gpt-4o-mini')
    expect(r.reason).toBe('default')
  })
  it('elevates on complexity', () => {
    const r = decideModel({ complexity: 'complex' })
    expect(r.modelId).toBe('gpt-4o')
    expect(r.reason).toBe('complexity_elevate')
  })

  it('uses chat completions (.chat) and valid AI Gateway model IDs when Gateway is enabled', async () => {
    vi.resetModules()
    vi.stubEnv('AI_GATEWAY_API_KEY', 'vck_test_gateway_key')

    const gateway = await import('@/lib/models/gateway')
    const registry = await import('@/lib/models/registry')
    const monicaRouter = await import('@/lib/monica/router')

    expect(gateway.isGatewayEnabled).toBe(true)

    const openaiModel = gateway.gatewayOpenAI('openai/gpt-4o') as unknown as {
      provider: string
      modelId: string
    }
    expect(openaiModel.provider).toBe('openai.chat')
    expect(openaiModel.modelId).toBe('openai/gpt-4o')

    const groqFast = registry.resolveGroqModel('fast') as unknown as {
      provider: string
      modelId: string
    }
    expect(groqFast.provider).toBe('openai.chat')
    expect(groqFast.modelId).toBe('meta/llama-3.1-8b')

    const groqDefault = registry.resolveGroqModel('default') as unknown as { modelId: string }
    expect(groqDefault.modelId).toBe('meta/llama-3.3-70b')

    const googleDefault = registry.resolveGoogleModel('default') as unknown as { modelId: string }
    expect(googleDefault.modelId).toBe('google/gemini-2.5-flash')

    const claudeDefault = registry.resolveClaudeModel('default') as unknown as { modelId: string }
    expect(claudeDefault.modelId).toBe('anthropic/claude-sonnet-4.6')

    const complexDecision = monicaRouter.decideModel({ complexity: 'complex' }) as unknown as {
      model: { provider: string; modelId: string }
    }
    expect(complexDecision.model.provider).toBe('openai.chat')
    expect(complexDecision.model.modelId).toBe('openai/gpt-4o')

    const simpleDecision = monicaRouter.decideModel({ complexity: 'simple' }) as unknown as {
      model: { provider: string; modelId: string }
    }
    expect(simpleDecision.model.provider).toBe('openai.chat')
    expect(simpleDecision.model.modelId).toBe('meta/llama-3.1-8b')
  })
})
