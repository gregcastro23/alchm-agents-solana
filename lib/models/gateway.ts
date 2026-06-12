/**
 * Vercel AI Gateway — Provider Factories
 *
 * When AI_GATEWAY_API_KEY is set, ALL providers are routed through the Vercel
 * AI Gateway (https://ai-gateway.vercel.sh/v1) using the OpenAI-compatible API.
 * Model IDs must be prefixed with the provider name, e.g. "anthropic/claude-sonnet-4-6".
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
// For local dev, set AI_GATEWAY_API_KEY (starts with "vgk_").
const GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
export const isGatewayEnabled = !!GATEWAY_API_KEY

// ─── Provider factories ───────────────────────────────────────────────────────

/**
 * OpenAI — GPT-4o, GPT-4o-mini, embeddings
 * Gateway model prefix: "openai/<modelId>"
 */
export const gatewayOpenAI = isGatewayEnabled
  ? createOpenAI({ apiKey: GATEWAY_API_KEY, baseURL: GATEWAY_BASE_URL })
  : createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * Anthropic — Claude Opus/Sonnet/Haiku
 * Gateway model prefix: "anthropic/<modelId>"
 *
 * Fix: when gateway is disabled we MUST use createAnthropic, not createOpenAI,
 * otherwise calls fail without OPENAI_API_KEY.
 */
export const gatewayAnthropic = isGatewayEnabled
  ? createOpenAI({ apiKey: GATEWAY_API_KEY, baseURL: GATEWAY_BASE_URL })
  : createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Google Gemini — 2.5 Flash, 2.0 Flash, Flash Lite
 * Gateway model prefix: "google/<modelId>"
 */
export const gatewayGoogle = isGatewayEnabled
  ? createOpenAI({ apiKey: GATEWAY_API_KEY, baseURL: GATEWAY_BASE_URL })
  : createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })

/**
 * Groq — Llama 3.3 70B, Llama 3.1 8B, Mixtral
 * Gateway model prefix: "groq/<modelId>"
 */
export const gatewayGroq = isGatewayEnabled
  ? createOpenAI({ apiKey: GATEWAY_API_KEY, baseURL: GATEWAY_BASE_URL })
  : createGroq({ apiKey: process.env.GROQ_API_KEY })

/**
 * OpenRouter — aggregates hundreds of models under one key.
 * Gateway model prefix: "openrouter/<modelId>"
 * Direct OpenRouter base URL when gateway is disabled.
 */
export const gatewayOpenRouter = isGatewayEnabled
  ? createOpenAI({ apiKey: GATEWAY_API_KEY, baseURL: GATEWAY_BASE_URL })
  : createOpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    })
