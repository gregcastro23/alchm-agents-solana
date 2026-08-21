export type TokenBundleTier = '5' | '10' | '25' | '50'

export interface TokenBundle {
  id: string
  stripeTier: TokenBundleTier
  name: string
  tokens: number
  perAxis: number
  usdCents: number
  bonusPercent: number
  icon: string
  accent: 'spirit' | 'essence' | 'matter' | 'substance'
}

/**
 * Canonical ESMS bundle definitions shared by pricing, the Bazaar, and Stripe.
 * Keep all package names, allocations, and prices in this one source of truth.
 */
export const TOKEN_BUNDLES: readonly TokenBundle[] = Object.freeze([
  {
    id: 'token-starter-bundle',
    stripeTier: '5',
    name: 'Initiate Box',
    tokens: 100,
    perAxis: 25,
    usdCents: 500,
    bonusPercent: 0,
    icon: 'toll',
    accent: 'spirit',
  },
  {
    id: 'token-alchemist-bundle',
    stripeTier: '10',
    name: 'Adept Sphere',
    tokens: 240,
    perAxis: 60,
    usdCents: 1000,
    bonusPercent: 20,
    icon: 'auto_awesome',
    accent: 'essence',
  },
  {
    id: 'token-magnum-opus',
    stripeTier: '25',
    name: 'Alchemist Chest',
    tokens: 700,
    perAxis: 175,
    usdCents: 2500,
    bonusPercent: 40,
    icon: 'diamond',
    accent: 'substance',
  },
  {
    id: 'token-cosmic-sovereign',
    stripeTier: '50',
    name: 'Sovereign Vault',
    tokens: 1600,
    perAxis: 400,
    usdCents: 5000,
    bonusPercent: 60,
    icon: 'stars',
    accent: 'matter',
  },
])

export function getTokenBundle(tier: unknown): TokenBundle | undefined {
  return TOKEN_BUNDLES.find(bundle => bundle.stripeTier === tier)
}

export function isTokenBundleTotal(value: string): boolean {
  return TOKEN_BUNDLES.some(bundle => String(bundle.tokens) === value)
}
