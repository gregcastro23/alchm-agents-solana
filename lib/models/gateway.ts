/**
 * Vercel AI Gateway — Provider Factories
 *
 * When AI_GATEWAY_API_KEY is set, ALL providers are routed through the Vercel
 * AI Gateway (https://ai-gateway.vercel.sh/v1) using the OpenAI-compatible API.
 * Model IDs use the Gateway catalog's creator/model names, e.g. "anthropic/claude-sonnet-4.6".
 *
 * When the key is NOT set, each provider falls back to its native SDK using
 * its own direct API key.
 */

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'

// ─── Base URL — single constant used everywhere ───────────────────────────────
export const GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1'

// ─── Gateway detection ────────────────────────────────────────────────────────
// OIDC token is auto-provisioned by Vercel in CI/CD builds.
// For local dev, set AI_GATEWAY_API_KEY (starts with "vck_").
const GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
export const isGatewayEnabled = !!GATEWAY_API_KEY

// ─── Provider factories ───────────────────────────────────────────────────────

/**
 * Force `@ai-sdk/openai` v2 providers onto `/v1/chat/completions` (`provider.chat(...)`)
 * instead of the default OpenAI Responses API (`provider(...)`).
 *
 * Stateless multi-step tool calling (`stopWhen: stepCountIs(n)`) through Vercel AI
 * Gateway (`https://ai-gateway.vercel.sh/v1`) and non-OpenAI chat models fails under
 * `openai.responses` with "No tool call found for function call output with call_id ...".
 * Keeps a transparent passthrough when `@ai-sdk/openai` is mocked as a bare function in tests.
 */
function asChatCompletionsProvider<T extends ReturnType<typeof createOpenAI>>(provider: T): T {
  if (typeof (provider as { chat?: unknown }).chat === 'function') {
    const factory = (modelId: string) => provider.chat(modelId)
    return Object.assign(factory, provider) as T
  }
  return provider
}

/**
 * OpenAI — GPT-4o, GPT-4o-mini, embeddings
 * Gateway model prefix: "openai/<modelId>"
 */
export const gatewayOpenAI = asChatCompletionsProvider(
  isGatewayEnabled
    ? createOpenAI({ apiKey: GATEWAY_API_KEY, baseURL: GATEWAY_BASE_URL })
    : createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
)

/**
 * Anthropic — Claude Opus/Sonnet/Haiku
 * Gateway model prefix: "anthropic/<modelId>"
 *
 * Fix: when gateway is disabled we MUST use createAnthropic, not createOpenAI,
 * otherwise calls fail without OPENAI_API_KEY.
 */
export const gatewayAnthropic = isGatewayEnabled
  ? asChatCompletionsProvider(createOpenAI({ apiKey: GATEWAY_API_KEY, baseURL: GATEWAY_BASE_URL }))
  : createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Google Gemini — 2.5 Flash, 2.0 Flash, Flash Lite
 * Gateway model prefix: "google/<modelId>"
 */
export const gatewayGoogle = isGatewayEnabled
  ? asChatCompletionsProvider(createOpenAI({ apiKey: GATEWAY_API_KEY, baseURL: GATEWAY_BASE_URL }))
  : createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })

/**
 * Groq — Llama 3.3 70B, Llama 3.1 8B, Mixtral
 * Gateway uses the model creator, e.g. "meta/llama-3.3-70b".
 */
export const gatewayGroq = isGatewayEnabled
  ? asChatCompletionsProvider(createOpenAI({ apiKey: GATEWAY_API_KEY, baseURL: GATEWAY_BASE_URL }))
  : createGroq({ apiKey: process.env.GROQ_API_KEY })

/**
 * OpenRouter — aggregates hundreds of models under one key.
 * Gateway model prefix: "openrouter/<modelId>"
 * Direct OpenRouter base URL when gateway is disabled.
 */
export const gatewayOpenRouter = asChatCompletionsProvider(
  isGatewayEnabled
    ? createOpenAI({ apiKey: GATEWAY_API_KEY, baseURL: GATEWAY_BASE_URL })
    : createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      })
)
