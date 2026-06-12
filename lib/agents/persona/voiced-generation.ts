import { generateText } from 'ai'
import { gatewayGroq, isGatewayEnabled } from '@/lib/models/gateway'
import { GROQ } from '@/lib/models/registry'
import { buildAgentContext } from './build-agent-context'

export interface VoicedGenerationOptions {
  /** Max tokens for the generated text. Keep small — actions are short. */
  maxTokens?: number
  /** If the LLM call fails for any reason, return this string instead. */
  fallback: string
}

/**
 * Generate a short piece of persona-voiced text using the FREE tier (Groq Llama 3.3).
 *
 * Designed for autonomous, high-volume contexts (feed posts, lab entries, reviews)
 * where we want voice without paying Claude tokens. Falls back silently on any
 * failure — never throws.
 */
export async function generateVoicedText(
  agentId: string,
  promptForAgent: string,
  options: VoicedGenerationOptions
): Promise<string> {
  const ctx = buildAgentContext(agentId)
  if (!ctx) return options.fallback

  if (!isGatewayEnabled && !process.env.GROQ_API_KEY) {
    return options.fallback
  }

  try {
    const model = isGatewayEnabled ? `groq/${GROQ.LLAMA_70B}` : GROQ.LLAMA_70B
    const { text } = await generateText({
      model: gatewayGroq(model) as any,
      system: ctx.personaBlock,
      prompt: promptForAgent,
      maxOutputTokens: options.maxTokens ?? 220,
    })
    const trimmed = (text || '').trim()
    return trimmed || options.fallback
  } catch (err) {
    console.warn(`[voiced-generation] failed for ${agentId}:`, err)
    return options.fallback
  }
}
