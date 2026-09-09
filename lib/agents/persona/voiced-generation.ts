import { generateText, generateObject } from 'ai'
import { z } from 'zod'
import {
  gatewayGroq,
  gatewayAnthropic,
  gatewayGoogle,
  isGatewayEnabled,
} from '@/lib/models/gateway'
import { GROQ, CLAUDE, GEMINI } from '@/lib/models/registry'
import { buildAgentContext } from './build-agent-context'

export interface VoicedGenerationOptions {
  /** Max tokens for the generated text. Keep small — actions are short. */
  maxTokens?: number
  /** If the LLM call fails for any reason, return this string instead. */
  fallback: string
  /**
   * Use this string as the system prompt instead of looking `agentId` up in the
   * agent registry.
   */
  systemOverride?: string
}

export interface StructuredVoiceOptions {
  systemPrompt: string
  prompt: string
  tier?: 'substantive' | 'ambient'
  maxTokens?: number
}

export interface StructuredVoiceResult<T> {
  object: T | null
  source: 'model' | 'grounded_briefing'
  modelFamily?: 'fast' | 'substantive'
  latencyMs?: number
  error?: string
}

/**
 * Generate a short piece of persona-voiced text using the FREE tier (Groq Llama 3.3).
 * Backward-compatible helper for feed posts, lab entries, and reviews.
 */
export async function generateVoicedText(
  agentId: string,
  promptForAgent: string,
  options: VoicedGenerationOptions
): Promise<string> {
  const systemPrompt = options.systemOverride ?? buildAgentContext(agentId)?.personaBlock
  if (!systemPrompt) return options.fallback

  if (!isGatewayEnabled && !process.env.GROQ_API_KEY) {
    return options.fallback
  }

  try {
    const model = isGatewayEnabled ? `groq/${GROQ.LLAMA_70B}` : GROQ.LLAMA_70B
    const { text } = await generateText({
      model: gatewayGroq(model) as any,
      system: systemPrompt,
      prompt: promptForAgent,
      maxOutputTokens: options.maxTokens ?? 320,
    })
    const trimmed = (text || '').trim()
    return trimmed || options.fallback
  } catch (err) {
    console.warn(`[voiced-generation] failed for ${agentId}:`, err)
    return options.fallback
  }
}

/**
 * Schema-constrained generation with model tiering and provenance tracking.
 */
export async function generateStructuredVoice<T>(
  schema: z.ZodType<T>,
  options: StructuredVoiceOptions
): Promise<StructuredVoiceResult<T>> {
  const startTime = Date.now()
  const tier = options.tier || 'ambient'

  // Model selection by tier and credential availability
  let modelInstance: any = null
  let modelFamily: 'fast' | 'substantive' = 'fast'

  if (tier === 'substantive') {
    if (isGatewayEnabled) {
      modelInstance = gatewayAnthropic(`anthropic/${CLAUDE.HAIKU}`)
      modelFamily = 'substantive'
    } else if (process.env.ANTHROPIC_API_KEY) {
      modelInstance = gatewayAnthropic(CLAUDE.HAIKU)
      modelFamily = 'substantive'
    } else if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      modelInstance = gatewayGoogle(GEMINI.FLASH_20)
      modelFamily = 'substantive'
    }
  }

  // Fall back to Groq if substantive model not available or if ambient tier
  if (!modelInstance) {
    if (isGatewayEnabled) {
      modelInstance = gatewayGroq(`groq/${GROQ.LLAMA_70B}`)
    } else if (process.env.GROQ_API_KEY) {
      modelInstance = gatewayGroq(GROQ.LLAMA_70B)
    }
  }

  if (!modelInstance) {
    return {
      object: null,
      source: 'grounded_briefing',
      modelFamily,
      latencyMs: Date.now() - startTime,
      error: 'credentials_unavailable',
    }
  }

  try {
    const result = await generateObject({
      model: modelInstance,
      schema,
      system: options.systemPrompt,
      prompt: options.prompt,
      maxOutputTokens: options.maxTokens ?? 400,
    })

    return {
      object: result.object as T,
      source: 'model',
      modelFamily,
      latencyMs: Date.now() - startTime,
    }
  } catch (err: any) {
    console.warn('[voiced-generation] Structured generation error:', err?.message || err)
    return {
      object: null,
      source: 'grounded_briefing',
      modelFamily,
      latencyMs: Date.now() - startTime,
      error: err?.message || 'generation_failed',
    }
  }
}
