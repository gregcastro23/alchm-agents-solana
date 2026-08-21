/**
 * Token-economy shop catalog for Agents & Pentacles Infrastructure.
 *
 * Three core sections wire the ESMS token economy:
 *  - tokens      direct ESMS token top-up packages (Spirit, Essence, Matter, Substance)
 *  - apothecary  digital alchemical items / agent boosts (settled by on-chain ESMS burn)
 *  - pentacles   star vessel upgrades, sigils, and pentacles infrastructure
 *
 * Icons are Material Symbols names preloaded in app/layout.tsx.
 */

import type { EsmsCost } from '@/lib/shop/pricing'
import { TOKEN_BUNDLES } from '@/lib/shop/token-bundles'

export type ShopItemKind = 'tokens' | 'apothecary' | 'pentacles'
export type ElementKey = 'spirit' | 'essence' | 'matter' | 'substance'

export interface ShopItem {
  /** Stable slug — also the on-chain order seed and entitlement key. */
  id: string
  kind: ShopItemKind
  title: string
  blurb: string
  /** Material Symbols Outlined icon (must be preloaded in app/layout.tsx). */
  icon: string
  /** Dominant ESMS axis, used for accent theming. */
  accent: ElementKey
  /** Whole-ESMS basket the buyer burns on-chain (digital items). */
  esms: EsmsCost
  /** USD reference / fiat price in cents (drives token top-ups & Card/USDC rails). */
  usdCents: number
  /** Consumable (repeatable) vs one-time unlock. Unlocks show an "Owned" state. */
  repeatable: boolean
  /** Optional Stripe checkout tier code ('5' | '10' | '25' | '50') for token items. */
  stripeTier?: '5' | '10' | '25' | '50'
}

const basket = (spirit: number, essence: number, matter: number, substance: number): EsmsCost => ({
  spirit,
  essence,
  matter,
  substance,
})

const TOKEN_CATALOG: ShopItem[] = TOKEN_BUNDLES.map(bundle => ({
  id: bundle.id,
  kind: 'tokens',
  title: bundle.name,
  blurb: `${bundle.tokens} ESMS Tokens (${bundle.perAxis} Spirit, ${bundle.perAxis} Essence, ${bundle.perAxis} Matter, ${bundle.perAxis} Substance).`,
  icon: bundle.icon,
  accent: bundle.accent,
  esms: basket(bundle.perAxis, bundle.perAxis, bundle.perAxis, bundle.perAxis),
  usdCents: bundle.usdCents,
  repeatable: true,
  stripeTier: bundle.stripeTier,
}))

export const SHOP_CATALOG: ShopItem[] = [
  // ── Tokens & Bundles — Direct ESMS Token Packages ───────────────────────────
  ...TOKEN_CATALOG,

  // ── Apothecary — Digital Alchemical Items & Agent Boosts ─────────────────────
  {
    id: 'elixir-mercury-retrograde',
    kind: 'apothecary',
    title: 'Mercury Retrograde Elixir',
    blurb:
      'A stabilizing tincture — re-rolls one agent action that fizzled during a retrograde window.',
    icon: 'science',
    accent: 'essence',
    esms: basket(4, 8, 2, 2),
    usdCents: 320,
    repeatable: true,
  },
  {
    id: 'boost-solar-ascendant',
    kind: 'apothecary',
    title: 'Solar Ascendant Boost',
    blurb: '+50% yield on your next daily ESMS claim. Burns brightest at your rising sign.',
    icon: 'flare',
    accent: 'spirit',
    esms: basket(10, 3, 2, 2),
    usdCents: 340,
    repeatable: true,
  },
  {
    id: 'catalyst-consciousness',
    kind: 'apothecary',
    title: 'Consciousness Catalyst',
    blurb: 'Temporarily boosts Council Agent synergy rating +25% during multi-agent debates.',
    icon: 'psychology',
    accent: 'substance',
    esms: basket(6, 6, 4, 8),
    usdCents: 450,
    repeatable: true,
  },

  // ── Pentacles & Sigils — Star Vessel & Agent Infrastructure ──────────────────
  {
    id: 'unlock-philosophers-stone',
    kind: 'pentacles',
    title: "Philosopher's Stone Sigil",
    blurb: 'Permanent cosmetic sigil for your agent vessel — the mark of a completed Magnum Opus.',
    icon: 'diamond',
    accent: 'matter',
    esms: basket(12, 12, 18, 12),
    usdCents: 1100,
    repeatable: false,
  },
  {
    id: 'star-vessel-ignition',
    kind: 'pentacles',
    title: 'Star Vessel Resonance Key',
    blurb:
      'Unlocks advanced synastry pairing slots for Pentacles Star Agents & custom vessel forging.',
    icon: 'hub',
    accent: 'spirit',
    esms: basket(15, 10, 10, 15),
    usdCents: 1500,
    repeatable: false,
  },
  {
    id: 'elemental-reservoir-expansion',
    kind: 'pentacles',
    title: 'Elemental Reservoir Expansion',
    blurb: 'Expands maximum off-chain ESMS storage capacity across all four elemental axes.',
    icon: 'inventory_2',
    accent: 'substance',
    esms: basket(10, 10, 10, 10),
    usdCents: 1200,
    repeatable: true,
  },
]

export function getShopItem(id: string): ShopItem | undefined {
  return SHOP_CATALOG.find(item => item.id === id)
}

export function catalogByKind(): Record<ShopItemKind, ShopItem[]> {
  return {
    tokens: SHOP_CATALOG.filter(i => i.kind === 'tokens'),
    apothecary: SHOP_CATALOG.filter(i => i.kind === 'apothecary'),
    pentacles: SHOP_CATALOG.filter(i => i.kind === 'pentacles'),
  }
}
