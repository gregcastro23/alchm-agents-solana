/**
 * AlchmAgentsSolana: Canonical Discriminant Astrological Faucet Engine (ADR-014)
 *
 * Clean Chart-Ratio Formulation:
 * Evaluates the minter's natal chart ratio (E / Sp / M / Su),
 * modulated by current celestial moment transit weights w_i(t)
 * and counter-cyclical anti-glut damping Omega_i.
 *
 * Strictly conserved at 24.0000 tokens (Standard) or 48.0000 tokens (Premium).
 * No artificial sect hacks or wave functions.
 */

import { getHistoricalAgent } from '@/lib/agents/historical'
import { getCurrentPlanetaryPositions, type CurrentPlanetPosition } from '@/lib/calculate-transits'

// ---------------------------------------------------------------------------
// Canonical Token Identities & Symbol Tiers (Mandatory ADR-014 Specification)
// ---------------------------------------------------------------------------

export const CANONICAL_TOKENS = ['SPIRIT', 'ESSENCE', 'MATTER', 'SUBSTANCE'] as const
export type CanonicalToken = (typeof CANONICAL_TOKENS)[number]

export interface TokenSymbolTier {
  name: CanonicalToken
  element: 'Fire' | 'Water' | 'Earth' | 'Air'
  primaryGlyph: string // Tier 1: Alchemical Glyph
  triangularVariant: string // Tier 2: Elemental Triangle Variant
  unicodeFallback: string // Tier 3: Universal Shape / Text Fallback
  atomicCode: string
  devnetMint: string
  operationalDomain: string
}

export const TOKEN_IDENTITIES: Record<CanonicalToken, TokenSymbolTier> = {
  SPIRIT: {
    name: 'SPIRIT',
    element: 'Fire',
    primaryGlyph: '\u{1F747}', // 🝇
    triangularVariant: '\u{1F702}', // 🜂
    unicodeFallback: '\u25B3', // △
    atomicCode: '[SPRT]',
    devnetMint: 'K5kwwomtWYydxJacA7bC5yUEW9TtEuVqBKBoqAWLmhQ',
    operationalDomain: 'Conversational compute gas, reasoning, kinetic actions',
  },
  ESSENCE: {
    name: 'ESSENCE',
    element: 'Water',
    primaryGlyph: '\u{1F751}', // 🝑
    triangularVariant: '\u{1F704}', // 🜄
    unicodeFallback: '\u25BD', // ▽
    atomicCode: '[ESNC]',
    devnetMint: '3FcpToU7bj4sLD687uecbesEjzjxBfqYn2EcBXJKPaCf',
    operationalDomain: 'Confidential context, emotional resonance, memory',
  },
  MATTER: {
    name: 'MATTER',
    element: 'Earth',
    primaryGlyph: '\u{1F759}', // 🝙
    triangularVariant: '\u{1F703}', // 🜃
    unicodeFallback: '\u2BD9', // ⯛
    atomicCode: '[MATR]',
    devnetMint: '7naJZozLrknDF3dguAdEWn7Z4MviUkXitjhaAt57Vkb4',
    operationalDomain: 'Physical grounding, pantry state sync, culinary vouchers',
  },
  SUBSTANCE: {
    name: 'SUBSTANCE',
    element: 'Air',
    primaryGlyph: '\u{1F749}', // 🝉
    triangularVariant: '\u{1F701}', // 🜁
    unicodeFallback: '\u2BD9', // ⯙
    atomicCode: '[SUBS]',
    devnetMint: '6RY6ZG1eJQ2uEvpyA6XK74WyF1MpTYbw97hdhELqDUsa',
    operationalDomain: 'Dialectic cognition, multi-agent conclave, staking yield',
  },
}

// ---------------------------------------------------------------------------
// Engine Interfaces
// ---------------------------------------------------------------------------

export interface NatalChartData {
  dominantElement?: 'Fire' | 'Water' | 'Earth' | 'Air' | string | null
  spiritScore?: number | null
  essenceScore?: number | null
  matterScore?: number | null
  substanceScore?: number | null
  monicaConstant?: number | null
}

export interface TransitSkyData {
  aNumber?: number
  multiplier?: number
  isDiurnal?: boolean
  dominantElement?: 'Fire' | 'Water' | 'Earth' | 'Air' | string
  elementWeights: Record<'Fire' | 'Water' | 'Earth' | 'Air', number>
}

export interface GlobalSupplyState {
  spirit: number
  essence: number
  matter: number
  substance: number
}

export interface DiscriminantYieldBreakdown {
  natalRatio: number
  transitRatio: number
  antiGlutFactor: number
  finalYield: number
  skyDominance?: number
  natalAffinity?: number
}

export interface DiscriminantYieldResult {
  spirit: number
  essence: number
  matter: number
  substance: number
  total: number
  breakdown: {
    spirit: DiscriminantYieldBreakdown
    essence: DiscriminantYieldBreakdown
    matter: DiscriminantYieldBreakdown
    substance: DiscriminantYieldBreakdown
  }
}

// ---------------------------------------------------------------------------
// Authoritative Live Supply Fallback
// ---------------------------------------------------------------------------

export const LIVE_NETWORK_SUPPLY: GlobalSupplyState = {
  spirit: 10583.22,
  essence: 15780.23,
  matter: 29116.87,
  substance: 22133.85,
}

// Zodiac sign to element mapping
const SIGN_TO_ELEMENT: Record<string, 'Fire' | 'Water' | 'Earth' | 'Air'> = {
  Aries: 'Fire',
  Leo: 'Fire',
  Sagittarius: 'Fire',
  Cancer: 'Water',
  Scorpio: 'Water',
  Pisces: 'Water',
  Taurus: 'Earth',
  Virgo: 'Earth',
  Capricorn: 'Earth',
  Gemini: 'Air',
  Libra: 'Air',
  Aquarius: 'Air',
}

// ---------------------------------------------------------------------------
// Core Chart-Ratio Faucet Mathematical Formulation
// ---------------------------------------------------------------------------

/**
 * Computes discriminant daily yield across the 4 elemental axes using the
 * proportional clean chart-ratio formulation:
 * Yield_i = Quantize( Y_total * (r_i(N) * w_i(t) * Omega_i) / sum_j(r_j(N) * w_j(t) * Omega_j) )
 *
 * Strictly conserved at 24.0000 tokens (Standard) or 48.0000 tokens (Premium).
 */
export function computeDiscriminantDailyYield(
  natal: NatalChartData | null | undefined,
  transit: TransitSkyData,
  supply: GlobalSupplyState = LIVE_NETWORK_SUPPLY,
  isPremium = false
): DiscriminantYieldResult {
  const TOTAL_YIELD = isPremium ? 48.0 : 24.0

  // 1. Natal Chart Ratio Vector r_i(N)
  const natalRaw = {
    spirit: typeof natal?.spiritScore === 'number' && natal.spiritScore > 0 ? natal.spiritScore : 0,
    essence:
      typeof natal?.essenceScore === 'number' && natal.essenceScore > 0 ? natal.essenceScore : 0,
    matter: typeof natal?.matterScore === 'number' && natal.matterScore > 0 ? natal.matterScore : 0,
    substance:
      typeof natal?.substanceScore === 'number' && natal.substanceScore > 0
        ? natal.substanceScore
        : 0,
  }
  const natalSum = natalRaw.spirit + natalRaw.essence + natalRaw.matter + natalRaw.substance

  const natalRatio =
    natalSum > 0
      ? {
          spirit: natalRaw.spirit / natalSum,
          essence: natalRaw.essence / natalSum,
          matter: natalRaw.matter / natalSum,
          substance: natalRaw.substance / natalSum,
        }
      : {
          spirit: 0.25,
          essence: 0.25,
          matter: 0.25,
          substance: 0.25,
        }

  // 2. Transit Sky Weights w_i(t)
  const tw = transit.elementWeights || { Fire: 2.5, Water: 2.5, Earth: 2.5, Air: 2.5 }
  const transitTotal = (tw.Fire || 0) + (tw.Water || 0) + (tw.Earth || 0) + (tw.Air || 0) || 1
  const transitRatio = {
    spirit: (tw.Fire || 0) / transitTotal,
    essence: (tw.Water || 0) / transitTotal,
    matter: (tw.Earth || 0) / transitTotal,
    substance: (tw.Air || 0) / transitTotal,
  }

  // 3. Counter-Cyclical Anti-Glut Damping Omega_i
  const totalSupply = supply.spirit + supply.essence + supply.matter + supply.substance || 1
  const getOmega = (supplyVal: number) => {
    const share = supplyVal / totalSupply
    if (share > 0.3) {
      return Math.max(0.65, 1.0 - 2.0 * (share - 0.25))
    }
    return 1.0
  }

  const omega = {
    spirit: getOmega(supply.spirit),
    essence: getOmega(supply.essence),
    matter: getOmega(supply.matter),
    substance: getOmega(supply.substance),
  }

  // 4. Combined Weighting Share & Normalization
  const weighted = {
    spirit: natalRatio.spirit * transitRatio.spirit * omega.spirit,
    essence: natalRatio.essence * transitRatio.essence * omega.essence,
    matter: natalRatio.matter * transitRatio.matter * omega.matter,
    substance: natalRatio.substance * transitRatio.substance * omega.substance,
  }
  const totalWeighted =
    weighted.spirit + weighted.essence + weighted.matter + weighted.substance || 1

  // 5. Conserved Daily Allocation (Quantized to 4 decimal places)
  let spirit = Math.round(TOTAL_YIELD * (weighted.spirit / totalWeighted) * 10000) / 10000
  let essence = Math.round(TOTAL_YIELD * (weighted.essence / totalWeighted) * 10000) / 10000
  let matter = Math.round(TOTAL_YIELD * (weighted.matter / totalWeighted) * 10000) / 10000
  let substance = Math.round(TOTAL_YIELD * (weighted.substance / totalWeighted) * 10000) / 10000

  // Exact residual conservation adjustment (eliminates sub-basis floating point drift)
  const unroundedTotal = spirit + essence + matter + substance
  const diff = Math.round((TOTAL_YIELD - unroundedTotal) * 10000) / 10000
  if (Math.abs(diff) > 0 && Math.abs(diff) < 0.01) {
    spirit = Math.round((spirit + diff) * 10000) / 10000
  }

  return {
    spirit,
    essence,
    matter,
    substance,
    total: TOTAL_YIELD,
    breakdown: {
      spirit: {
        natalRatio: Math.round(natalRatio.spirit * 10000) / 10000,
        transitRatio: Math.round(transitRatio.spirit * 10000) / 10000,
        antiGlutFactor: Math.round(omega.spirit * 1000) / 1000,
        finalYield: spirit,
        skyDominance: Math.round(transitRatio.spirit * 10000) / 10000,
        natalAffinity: Math.round(natalRatio.spirit * 10000) / 10000,
      },
      essence: {
        natalRatio: Math.round(natalRatio.essence * 10000) / 10000,
        transitRatio: Math.round(transitRatio.essence * 10000) / 10000,
        antiGlutFactor: Math.round(omega.essence * 1000) / 1000,
        finalYield: essence,
        skyDominance: Math.round(transitRatio.essence * 10000) / 10000,
        natalAffinity: Math.round(natalRatio.essence * 10000) / 10000,
      },
      matter: {
        natalRatio: Math.round(natalRatio.matter * 10000) / 10000,
        transitRatio: Math.round(transitRatio.matter * 10000) / 10000,
        antiGlutFactor: Math.round(omega.matter * 1000) / 1000,
        finalYield: matter,
        skyDominance: Math.round(transitRatio.matter * 10000) / 10000,
        natalAffinity: Math.round(natalRatio.matter * 10000) / 10000,
      },
      substance: {
        natalRatio: Math.round(natalRatio.substance * 10000) / 10000,
        transitRatio: Math.round(transitRatio.substance * 10000) / 10000,
        antiGlutFactor: Math.round(omega.substance * 1000) / 1000,
        finalYield: substance,
        skyDominance: Math.round(transitRatio.substance * 10000) / 10000,
        natalAffinity: Math.round(natalRatio.substance * 10000) / 10000,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers for Live Ephemeris & Historical Roster Integration
// ---------------------------------------------------------------------------

/**
 * Converts planetary positions (e.g. from getCurrentPlanetaryPositions)
 * into TransitSkyData with active 4-element weights.
 */
export function deriveTransitWeightsFromPositions(
  positions: Record<string, CurrentPlanetPosition>
): TransitSkyData {
  const counts: Record<'Fire' | 'Water' | 'Earth' | 'Air', number> = {
    Fire: 0,
    Water: 0,
    Earth: 0,
    Air: 0,
  }

  for (const pos of Object.values(positions)) {
    const el = SIGN_TO_ELEMENT[pos.sign]
    if (el) counts[el]++
  }

  // If no positions, provide balanced default
  const total = counts.Fire + counts.Water + counts.Earth + counts.Air
  if (total === 0) {
    return {
      elementWeights: { Fire: 2.5, Water: 2.5, Earth: 2.5, Air: 2.5 },
      dominantElement: 'Fire',
    }
  }

  let dominant: 'Fire' | 'Water' | 'Earth' | 'Air' = 'Fire'
  let maxWeight = -1
  for (const [el, w] of Object.entries(counts) as ['Fire' | 'Water' | 'Earth' | 'Air', number][]) {
    if (w > maxWeight) {
      maxWeight = w
      dominant = el
    }
  }

  return {
    elementWeights: counts,
    dominantElement: dominant,
  }
}

/**
 * Returns current live sky transit weights using the VSOP87 calculator.
 */
export function getLiveTransitSky(date: Date = new Date()): TransitSkyData {
  try {
    const positions = getCurrentPlanetaryPositions(date)
    return deriveTransitWeightsFromPositions(positions)
  } catch {
    return {
      elementWeights: { Fire: 2.5, Water: 2.5, Earth: 2.5, Air: 2.5 },
      dominantElement: 'Fire',
    }
  }
}

/**
 * Resolves an agent's natal elements from the historical roster or profile data.
 */
export function resolveAgentNatalData(
  agentIdOrEmail: string,
  userProfile?: {
    natalChart?: any
    dominantElement?: string | null
    monicaConstant?: number | null
  }
): NatalChartData {
  const agentId = agentIdOrEmail.includes('@') ? agentIdOrEmail.split('@')[0] : agentIdOrEmail

  // 1. Check canonical historical roster
  const historical = getHistoricalAgent(agentId)
  if (historical?.consciousness?.alchemicalElements) {
    const el = historical.consciousness.alchemicalElements
    return {
      dominantElement: historical.consciousness.dominantElement ?? null,
      spiritScore: typeof el.spirit === 'number' ? el.spirit * 100 : 50,
      essenceScore: typeof el.essence === 'number' ? el.essence * 100 : 50,
      matterScore: typeof el.matter === 'number' ? el.matter * 100 : 50,
      substanceScore: typeof el.substance === 'number' ? el.substance * 100 : 50,
      monicaConstant: historical.consciousness.monicaConstant ?? null,
    }
  }

  // 2. Check profile natal chart / elements if provided
  if (userProfile?.natalChart) {
    const chart = userProfile.natalChart
    const alch = chart.alchemicalElements || chart
    if (
      typeof alch.spirit === 'number' ||
      typeof alch.essence === 'number' ||
      typeof alch.matter === 'number' ||
      typeof alch.substance === 'number'
    ) {
      return {
        dominantElement: userProfile.dominantElement ?? chart.dominantElement ?? null,
        spiritScore: typeof alch.spirit === 'number' ? alch.spirit * 100 : 50,
        essenceScore: typeof alch.essence === 'number' ? alch.essence * 100 : 50,
        matterScore: typeof alch.matter === 'number' ? alch.matter * 100 : 50,
        substanceScore: typeof alch.substance === 'number' ? alch.substance * 100 : 50,
        monicaConstant: userProfile.monicaConstant ?? null,
      }
    }
  }

  // 3. Neutral fallback
  return {
    dominantElement: userProfile?.dominantElement ?? null,
    spiritScore: 50,
    essenceScore: 50,
    matterScore: 50,
    substanceScore: 50,
    monicaConstant: userProfile?.monicaConstant ?? null,
  }
}
