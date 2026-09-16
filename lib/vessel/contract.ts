/**
 * The Alchm Vessel — cross-app treasury contract (v1).
 *
 * One shape for every surface that renders a player's elemental treasury:
 * agents.alchm.kitchen (this repo), the Pentacles drawer, and the HackStation
 * cockpit all read it from GET /api/vessel/summary.
 *
 * Honesty rules baked into the types:
 *   - `ledgerEsms` totals come only from the authoritative alchm.kitchen
 *     token ledger (credit-only source types, 4-decimal quantized).
 *   - A stat whose source was unreachable or does not exist yet is `null`,
 *     never an estimate. `sources` says which reads succeeded and why not.
 *   - The Vessel is read-only: nothing here mints, moves, or converts ESMS.
 */

export const VESSEL_CONTRACT_VERSION = 1 as const

/** [Spirit, Essence, Matter, Substance] — Fire, Water, Earth, Air. */
export type EsmsTuple = [number, number, number, number]

export type VesselStreamKey = 'jingDuels' | 'staking' | 'pentaclesMelee' | 'kitchenAchievements'

export type VesselSourceKey = 'kitchenLedger' | 'agentsArena' | 'spacetimedb' | 'priceIndex'

export interface VesselSourceStatus {
  ok: boolean
  detail?: string
}

export interface VesselLedgerEntry {
  id: string
  stream: VesselStreamKey | 'other'
  sourceType: string
  tokenType: string
  amount: number
  description: string | null
  createdAt: string
}

export interface VesselClash {
  duelId: string
  source: 'agents' | 'pentacles'
  kind: string
  opponent: string
  /** true/false once resolved; null for unresolved or unrecorded outcomes. */
  won: boolean | null
  timestamp: number
}

export interface AlchmVesselState {
  version: typeof VESSEL_CONTRACT_VERSION
  /** Verified Solana wallet (base58), or null when none is bound. */
  walletAddress: string | null
  /** Pentacles SpacetimeDB identity (hex) linked through the verified wallet. */
  spacetimeIdentity: string | null
  lastSyncedAt: number

  balances: {
    spirit: number
    essence: number
    matter: number
    substance: number
    /** Total tokens × the Kitchen redeem rail; null when no USD rail is published. */
    totalUsdEquivalent: number | null
    usdRail: { perTokenUsd: number; source: string | null } | null
  }

  streams: {
    jingDuels: {
      ledgerEsms: EsmsTuple
      ledgerEntries: number
      /** Agents Jing Arena rounds recorded for this user. */
      agentDuelsRecorded: number | null
      /** Resolved Pentacles Jing + 14-Pillars duels won / resolved. */
      arenaWins: number | null
      arenaResolved: number | null
      recentClashes: VesselClash[]
    }
    staking: {
      ledgerEsms: EsmsTuple
      ledgerEntries: number
      streakDays: number | null
      /** On-chain StarVault accrual is not aggregated server-side yet. */
      starVaultAccrued: number | null
    }
    pentaclesMelee: {
      ledgerEsms: EsmsTuple
      ledgerEntries: number
      /** Pentacles arena tokens (word duels, AR captures, StarDex claims). */
      arenaTokens: number | null
      wordWins: number | null
      /** 14-Pillars in-game ESMS pool (f64 game state, not ledger ESMS). */
      /** Pentacles game pool units: tenths of an ESMS (circuit baseline 80 = 8.0 ESMS). */
      pillarPool: EsmsTuple | null
    }
    kitchenAchievements: {
      ledgerEsms: EsmsTuple
      ledgerEntries: number
      achievementsUnlocked: number | null
      questsCompleted: number | null
    }
  }

  ledger: VesselLedgerEntry[]
  sources: Record<VesselSourceKey, VesselSourceStatus>
}

export const EMPTY_ESMS: EsmsTuple = [0, 0, 0, 0]

export function quantizeEsms(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 10_000) / 10_000
}
