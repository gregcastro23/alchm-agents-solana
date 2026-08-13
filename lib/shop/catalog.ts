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

import type { EsmsCost } from './pricing'

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

export const SHOP_CATALOG: ShopItem[] = [
  // ── Tokens & Bundles — Direct ESMS Token Packages ───────────────────────────
  {
    id: 'token-starter-bundle',
    kind: 'tokens',
    title: 'Cosmic Starter Bundle',
    blurb: '100 Cosmic ESMS Tokens (25 Spirit, 25 Essence, 25 Matter, 25 Substance).',
    icon: 'toll',
    accent: 'spirit',
    esms: basket(25, 25, 25, 25),
    usdCents: 500,
    repeatable: true,
    stripeTier: '5',
  },
  {
    id: 'token-alchemist-bundle',
    kind: 'tokens',
    title: "Alchemist's Quadrant",
    blurb: '240 Cosmic ESMS Tokens (60 Spirit, 60 Essence, 60 Matter, 60 Substance).',
    icon: 'auto_awesome',
    accent: 'essence',
    esms: basket(60, 60, 60, 60),
    usdCents: 1000,
    repeatable: true,
    stripeTier: '10',
  },
  {
    id: 'token-magnum-opus',
    kind: 'tokens',
    title: 'Magnum Opus Catalyst',
    blurb: '700 Cosmic ESMS Tokens (175 Spirit, 175 Essence, 175 Matter, 175 Substance).',
    icon: 'diamond',
    accent: 'substance',
    esms: basket(175, 175, 175, 175),
    usdCents: 2500,
    repeatable: true,
    stripeTier: '25',
  },
  {
    id: 'token-cosmic-sovereign',
    kind: 'tokens',
    title: 'Sovereign Council Reservoir',
    blurb:
      '1600 Cosmic ESMS Tokens (400 Spirit, 400 Essence, 400 Matter, 400 Substance). Premium Tier.',
    icon: 'stars',
    accent: 'matter',
    esms: basket(400, 400, 400, 400),
    usdCents: 5000,
    repeatable: true,
    stripeTier: '50',
  },

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
