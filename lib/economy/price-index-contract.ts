/**
 * The cross-site ESMS price-index interface.
 *
 * alchm.kitchen owns the astronomical implementation. This repo consumes the
 * resulting snapshot unchanged, then joins Solana identity metadata in the UI.
 * Keeping chain identity out of the quote payload prevents a deployment on the
 * Agents site from silently becoming a second price authority.
 */

export const ESMS_TOKEN_NAMES = ['Spirit', 'Essence', 'Matter', 'Substance'] as const

export type EsmsTokenName = (typeof ESMS_TOKEN_NAMES)[number]

export interface CanonicalTokenIndexQuote {
  token: EsmsTokenName
  /** Dimensionless index points. This is not a USD or SOL market quote. */
  index: number
  change24hPct: number
  weight: number
  sparkline: number[]
}

export interface CanonicalPriceIndexPayload {
  success: true
  live: true
  generatedAt: string
  bucketStartUtc: string
  aNumber: number
  multiplier: number
  dominantElement: string
  sunSign: string
  isDiurnal: boolean
  tokens: CanonicalTokenIndexQuote[]
  compositeIndex: number
  composite24hPct: number
  degraded: string[] | null
  basis: {
    model: string
    engine: string
    constants: string
    [key: string]: unknown
  }
  railsUsd: {
    mintPerTokenUsd: number | null
    mintSource: string | null
    redeemPerTokenUsd: number | null
    redeemSource: string | null
  }
  supply: {
    live: boolean
    spirit: number
    essence: number
    matter: number
    substance: number
  }
  [key: string]: unknown
}
