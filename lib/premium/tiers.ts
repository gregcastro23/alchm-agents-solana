/**
 * Token Economy Model Capability & Access Routing.
 *
 * In the Planetary Agents token economy:
 *  - Visitors (guests without accounts) use the base high-throughput fallback chain (Groq / Gemini / Cerebras).
 *  - Account Holders (authenticated users holding ESMS token balances) and Administrators have access
 *    to enhanced model tiers (Anthropic, DeepSeek, GPT-5.x, Claude Opus) and token-fueled infusions.
 *  - Users connecting their own BYOK provider keys (OpenAI, Anthropic, OpenRouter, Google) route directly.
 */

export type PaTier = 'free' | 'alchemist' | 'master'
export type ChatModelTier = 'free' | 'cheap_fast' | 'primary' | 'reflective'
export type ByokProvider = 'openai' | 'anthropic' | 'openrouter' | 'google'

/** Ascending capability/cost order. */
export const CHAT_TIER_ORDER: ChatModelTier[] = ['free', 'cheap_fast', 'primary', 'reflective']

/** Which provider serves each chat model tier. */
export const CHAT_TIER_PROVIDER: Record<ChatModelTier, 'groq' | 'anthropic'> = {
  free: 'groq',
  cheap_fast: 'anthropic',
  primary: 'anthropic',
  reflective: 'anthropic',
}

/** Highest chat model tier available for each account level. */
export const MAX_CHAT_TIER_FOR: Record<PaTier, ChatModelTier> = {
  free: 'free',
  alchemist: 'reflective',
  master: 'reflective',
}

/** Enhanced model tiers beyond the base free chain. */
export function isPremiumChatTier(tier: ChatModelTier): boolean {
  return CHAT_TIER_PROVIDER[tier] !== 'groq'
}

export function normalizeChatTier(value: unknown): ChatModelTier | null {
  if (typeof value === 'string' && (CHAT_TIER_ORDER as string[]).includes(value)) {
    return value as ChatModelTier
  }
  return null
}

/**
 * Route requested chat model tier based on visitor vs account holder & BYOK status.
 *
 * - Visitors (unauthenticated / guest) → 'free' (base fast fallback chain).
 * - Account Holders and Administrators → full access to enhanced model tiers.
 * - BYOK-funded users → direct provider access to all tiers.
 */
export function capModelTier(
  requested: unknown,
  paTier: PaTier,
  byokProviders: ByokProvider[] = []
): ChatModelTier {
  const req = normalizeChatTier(requested) ?? 'free'
  if (!isPremiumChatTier(req)) return req

  const isAccountHolder = paTier !== 'free'
  const hasAnthropicKey = byokProviders.includes('anthropic')
  if (!isAccountHolder && !hasAnthropicKey) return 'free'

  const ceiling: ChatModelTier = isAccountHolder ? MAX_CHAT_TIER_FOR[paTier] : 'reflective'
  const reqIdx = CHAT_TIER_ORDER.indexOf(req)
  const capIdx = CHAT_TIER_ORDER.indexOf(ceiling)
  return reqIdx <= capIdx ? req : ceiling
}
