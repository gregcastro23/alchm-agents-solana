/**
 * AI Gateway Utility — Vercel AI Gateway Integration
 *
 * Aligned with the actual Vercel AI Gateway:
 *   Base URL : https://ai-gateway.vercel.sh/v1
 *   Auth     : Bearer <AI_GATEWAY_API_KEY>  (starts with "vgk_")
 *   OIDC     : VERCEL_OIDC_TOKEN can be used in CI/CD instead of a static key
 *
 * Activation: set AI_GATEWAY_API_KEY in your environment.
 * When the key is present, isGatewayEnabled = true and all AI SDK calls
 * automatically route through the gateway (see lib/models/gateway.ts).
 */

export const GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1'

// ─── Runtime detection ────────────────────────────────────────────────────────

export interface AIGatewayConfig {
  enabled: boolean
  apiKey: string | undefined
  baseUrl: string
  /** Whether auth comes from a static API key vs OIDC token */
  authMode: 'api-key' | 'oidc' | 'none'
}

/**
 * Read Vercel AI Gateway configuration from environment.
 * Priority: AI_GATEWAY_API_KEY → VERCEL_OIDC_TOKEN (CI/CD) → disabled
 */
export function getAIGatewayConfig(): AIGatewayConfig {
  const apiKey = process.env.AI_GATEWAY_API_KEY
  const oidcToken = process.env.VERCEL_OIDC_TOKEN

  const effectiveKey = apiKey || oidcToken
  const authMode = apiKey ? 'api-key' : oidcToken ? 'oidc' : 'none'

  return {
    enabled: !!effectiveKey,
    apiKey: effectiveKey,
    baseUrl: GATEWAY_BASE_URL,
    authMode,
  }
}

/**
 * Check if the gateway is currently active.
 * Mirrors the check in lib/models/gateway.ts for use outside the registry.
 */
export function isAIGatewayConfigured(): boolean {
  return getAIGatewayConfig().enabled
}

// ─── Model ID helpers ─────────────────────────────────────────────────────────

/**
 * Providers the Vercel AI Gateway natively understands.
 * Use these prefixes when constructing model IDs for gateway calls.
 */
export const GATEWAY_PROVIDERS = [
  'anthropic',
  'openai',
  'google',
  'groq',
  'mistral',
  'cohere',
  'meta',
  'xai',
  'perplexity',
  'openrouter',
] as const

export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number]

/**
 * Build a gateway-prefixed model ID.
 * e.g. toGatewayModelId('anthropic', 'claude-sonnet-4-6')
 *      → 'anthropic/claude-sonnet-4-6'
 */
export function toGatewayModelId(provider: GatewayProvider, modelId: string): string {
  return `${provider}/${modelId}`
}

// ─── Status & diagnostics ────────────────────────────────────────────────────

export interface AIGatewayStatus {
  ready: boolean
  authMode: AIGatewayConfig['authMode']
  baseUrl: string
  activeProviders: string[]
  recommendation: string
}

/**
 * Detect which provider keys are available in the environment.
 */
function detectActiveProviders(): string[] {
  const providerKeyMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_GENERATIVE_AI_API_KEY',
    groq: 'GROQ_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    cerebras: 'CEREBRAS_API_KEY',
  }

  return Object.entries(providerKeyMap)
    .filter(([, envKey]) => !!process.env[envKey])
    .map(([provider]) => provider)
}

export function getAIGatewayStatus(): AIGatewayStatus {
  const config = getAIGatewayConfig()
  const activeProviders = detectActiveProviders()

  let recommendation: string
  if (!config.enabled) {
    recommendation =
      'Set AI_GATEWAY_API_KEY (from Vercel Dashboard → AI Gateway → API Keys) to activate unified model routing, observability, and spend monitoring.'
  } else if (config.authMode === 'oidc') {
    recommendation =
      'Running with OIDC token (CI/CD mode). For local development, set AI_GATEWAY_API_KEY explicitly.'
  } else {
    recommendation = `Gateway active (${config.authMode}). Traffic is being routed through Vercel AI Gateway with full observability.`
  }

  return {
    ready: config.enabled,
    authMode: config.authMode,
    baseUrl: config.baseUrl,
    activeProviders,
    recommendation,
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateAIGatewayConfig(): { valid: boolean; errors: string[] } {
  const config = getAIGatewayConfig()
  const errors: string[] = []

  if (!config.enabled) {
    errors.push('AI_GATEWAY_API_KEY is not set — gateway is disabled.')
  } else if (config.authMode === 'api-key') {
    const key = config.apiKey || ''
    // vck_ = Vercel AI Gateway static key (current format)
    // vgk_ = legacy format (kept for backward compat)
    // eyJ  = JWT/OIDC token (CI/CD)
    if (!key.startsWith('vck_') && !key.startsWith('vgk_') && !key.startsWith('eyJ')) {
      errors.push(
        'AI_GATEWAY_API_KEY does not look like a valid Vercel gateway key (expected "vck_..." prefix).'
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

// ─── Dev logging ──────────────────────────────────────────────────────────────

export function logAIGatewayStatus(): void {
  const status = getAIGatewayStatus()
  const icon = status.ready ? '✅' : '⚠️ '
  console.log(`\n${icon} Vercel AI Gateway:`)
  console.log(`   Auth mode   : ${status.authMode}`)
  console.log(`   Base URL    : ${status.baseUrl}`)
  console.log(`   Providers   : ${status.activeProviders.join(', ') || 'none detected'}`)
  console.log(`   Tip         : ${status.recommendation}\n`)
}
