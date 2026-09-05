/**
 * AlchmAgentsSolana: Canonical Discriminant Astrological Faucet Engine (ADR-014)
 *
 * Clean Chart-Ratio Formulation:
 * Evaluates the minter's natal chart ratio (E / Sp / M / Su),
 * modulated by current celestial moment transit weights w_i(t)
 * and counter-cyclical anti-glut damping Omega_i.
 *
 * Strictly conserved at 12.0000 tokens universally for all users.
 * No artificial sect hacks or wave functions.
 */

import { getHistoricalAgent } from '@/lib/agents/historical'
import {
  getCurrentPlanetaryPositions,
  type CurrentPlanetPosition,
  DegradedEphemerisError,
} from '@/lib/calculate-transits'
import { AXIS_FLOOR, Y_MIN, Y_MAX } from '@/lib/economy-config'
import {
  calculatePlanetaryDignity,
  calculateAlchemicalQuantities,
  type PlanetaryPlacement,
} from '@/lib/astrological-dignities-engine'

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
  isNeutralFallback?: boolean
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
  total?: number
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
// Live Supply Provider with In-Memory Cache
// ---------------------------------------------------------------------------

export const LIVE_NETWORK_SUPPLY: GlobalSupplyState = {
  spirit: 10583.22,
  essence: 15780.23,
  matter: 29116.87,
  substance: 22133.85,
}

let cachedSupply: { data: GlobalSupplyState; expiresAt: number } | null = null
const SUPPLY_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function getLiveNetworkSupply(prismaClient?: any): Promise<GlobalSupplyState> {
  const now = Date.now()
  if (cachedSupply && cachedSupply.expiresAt > now) {
    return cachedSupply.data
  }

  try {
    const db = prismaClient || (await import('@/lib/db')).prisma
    const totals = await db.tokenBalance.aggregate({
      _sum: {
        spirit: true,
        essence: true,
        matter: true,
        substance: true,
      },
    })

    const sp = Number(totals._sum?.spirit) || 0
    const es = Number(totals._sum?.essence) || 0
    const ma = Number(totals._sum?.matter) || 0
    const su = Number(totals._sum?.substance) || 0
    const total = sp + es + ma + su

    if (total > 0) {
      const data: GlobalSupplyState = {
        spirit: sp,
        essence: es,
        matter: ma,
        substance: su,
        total,
      }
      cachedSupply = { data, expiresAt: now + SUPPLY_CACHE_TTL_MS }
      return data
    }
  } catch (err) {
    console.warn(
      '[DiscriminantFaucet] Could not query live supply from DB, falling back to baseline snapshot:',
      err
    )
  }

  return LIVE_NETWORK_SUPPLY
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
// Core Chart-Ratio Faucet Mathematical Formulation (ADR-014 / ADR-015 Phase 1)
// ---------------------------------------------------------------------------

/**
 * Computes discriminant daily yield across the 4 elemental axes using the
 * proportional clean chart-ratio formulation with dynamic operational gas floor:
 *
 * Yield_i = Quantize( AXIS_FLOOR + (Y_total - 4*AXIS_FLOOR) * (r_i(N) * w_i(t) * Omega_i) / sum_j(...) )
 *
 * Strictly conserved at 12.0000 tokens universally for all users.
 * Floor AXIS_FLOOR = 0.30 guarantees conversational compute gas is never starved (INV-2).
 * Residual adjustment is assigned to the largest allocated axis to preserve floor integrity.
 */
export function computeDiscriminantDailyYield(
  natal: NatalChartData | null | undefined,
  transit: TransitSkyData,
  supply: GlobalSupplyState
): DiscriminantYieldResult {
  const TOTAL_YIELD = 12.0 // Strictly universal 12.0000 ESMS for all users

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

  // 5. Conserved Daily Allocation with Dynamic AXIS_FLOOR (Quantized to 4 decimal places)
  const floorPerAxis = AXIS_FLOOR // 0.30
  const totalFloor = floorPerAxis * 4 // 1.20
  const distributableYield = Math.max(0, TOTAL_YIELD - totalFloor) // 10.80

  let spirit =
    Math.round((floorPerAxis + distributableYield * (weighted.spirit / totalWeighted)) * 10000) /
    10000
  let essence =
    Math.round((floorPerAxis + distributableYield * (weighted.essence / totalWeighted)) * 10000) /
    10000
  let matter =
    Math.round((floorPerAxis + distributableYield * (weighted.matter / totalWeighted)) * 10000) /
    10000
  let substance =
    Math.round((floorPerAxis + distributableYield * (weighted.substance / totalWeighted)) * 10000) /
    10000

  // Exact residual conservation adjustment (eliminates sub-basis floating point drift)
  // Assign residual to the largest allocated axis (always >= 3.0 >> 0.3, so diff cannot breach floor)
  const unroundedTotal = spirit + essence + matter + substance
  const diff = Math.round((TOTAL_YIELD - unroundedTotal) * 10000) / 10000
  if (Math.abs(diff) > 0 && Math.abs(diff) < 0.01) {
    const axes: Array<{ key: 'spirit' | 'essence' | 'matter' | 'substance'; val: number }> = [
      { key: 'spirit', val: spirit },
      { key: 'essence', val: essence },
      { key: 'matter', val: matter },
      { key: 'substance', val: substance },
    ]
    axes.sort((a, b) => b.val - a.val)
    const largestKey = axes[0].key
    if (largestKey === 'spirit') spirit = Math.round((spirit + diff) * 10000) / 10000
    else if (largestKey === 'essence') essence = Math.round((essence + diff) * 10000) / 10000
    else if (largestKey === 'matter') matter = Math.round((matter + diff) * 10000) / 10000
    else substance = Math.round((substance + diff) * 10000) / 10000
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

/**
 * Fail-closed ledger boundary invariant validation (ADR-015 Phase 2).
 * Throws if total is outside [Y_MIN, Y_MAX], any axis is below AXIS_FLOOR, or values are non-finite.
 */
export function validateLedgerClamp(distribution: {
  spirit: number
  essence: number
  matter: number
  substance: number
  total: number
}): void {
  if (
    distribution.total < Y_MIN ||
    distribution.total > Y_MAX ||
    distribution.spirit < AXIS_FLOOR ||
    distribution.essence < AXIS_FLOOR ||
    distribution.matter < AXIS_FLOOR ||
    distribution.substance < AXIS_FLOOR ||
    !Number.isFinite(distribution.total) ||
    !Number.isFinite(distribution.spirit) ||
    !Number.isFinite(distribution.essence) ||
    !Number.isFinite(distribution.matter) ||
    !Number.isFinite(distribution.substance)
  ) {
    throw new Error(
      `Ledger clamp invariant breach: total=${distribution.total} (allowed [${Y_MIN}, ${Y_MAX}]), minAxis=${Math.min(
        distribution.spirit,
        distribution.essence,
        distribution.matter,
        distribution.substance
      )} (floor ${AXIS_FLOOR})`
    )
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
  positions: Record<string, CurrentPlanetPosition>,
  options?: { requireComplete?: boolean }
): TransitSkyData {
  if (options?.requireComplete && Object.keys(positions).length < 10) {
    throw new DegradedEphemerisError(
      `Degraded ephemeris: expected 10 planetary bodies, received ${Object.keys(positions).length}`
    )
  }

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
export function getLiveTransitSky(
  date: Date = new Date(),
  options?: { requireComplete?: boolean }
): TransitSkyData {
  try {
    const positions = getCurrentPlanetaryPositions(date, options)
    return deriveTransitWeightsFromPositions(positions, options)
  } catch (error) {
    if (options?.requireComplete) {
      throw error
    }
    console.warn('[DiscriminantFaucet] Ephemeris fallback triggered:', error)
    return {
      elementWeights: { Fire: 2.5, Water: 2.5, Earth: 2.5, Air: 2.5 },
      dominantElement: 'Fire',
    }
  }
}

/** Extract planetary placements from userProfile for dignity/element calculation */
function extractPlacementsFromProfile(
  userProfile: any
): Array<{ planet: string; sign: string; degree: number; house?: number }> | null {
  if (!userProfile) return null

  // 1. Explicit array in natalPositions
  if (Array.isArray(userProfile.natalPositions) && userProfile.natalPositions.length > 0) {
    const valid = userProfile.natalPositions.map((p: any) => ({
      planet: String(p.planet || p.label || 'Sun'),
      sign: String(p.sign || 'Aries'),
      degree: Number(p.degree ?? p.degrees ?? 0) || 0,
      house: typeof p.house === 'number' ? p.house : undefined,
    }))
    if (valid.length > 0) return valid
  }

  // 2. Horoscope structure in natalChart (tropical.CelestialBodies.all)
  const chart = userProfile.natalChart
  if (chart && typeof chart === 'object') {
    const celestialAll = chart.tropical?.CelestialBodies?.all
    if (Array.isArray(celestialAll) && celestialAll.length > 0) {
      return celestialAll.map((b: any, idx: number) => ({
        planet: String(b.label || b.planet || `Body_${idx}`),
        sign: String(b.Sign?.label || b.sign || 'Aries'),
        degree: Number(b.degrees ?? b.degree ?? 0) || 0,
        house: typeof b.house === 'number' ? b.house : idx + 1,
      }))
    }

    // 3. Object map in chart.planets
    if (chart.planets && typeof chart.planets === 'object' && !Array.isArray(chart.planets)) {
      return Object.entries(chart.planets).map(([planet, data]: [string, any], idx) => ({
        planet,
        sign: String(data?.sign || 'Aries'),
        degree: Number(data?.signDegree ?? data?.degree ?? 0) || 0,
        house: typeof data?.house === 'number' ? data.house : idx + 1,
      }))
    }

    // 4. Array in chart
    if (Array.isArray(chart) && chart.length > 0) {
      return chart.map((p: any, idx: number) => ({
        planet: String(p.planet || p.label || `Body_${idx}`),
        sign: String(p.sign || 'Aries'),
        degree: Number(p.degree ?? p.degrees ?? 0) || 0,
        house: typeof p.house === 'number' ? p.house : idx + 1,
      }))
    }
  }

  return null
}

/**
 * Resolves an agent's or user's natal elements from the historical roster,
 * authentic natal placements, or profile data.
 */
export function resolveAgentNatalData(
  agentIdOrEmail: string,
  userProfile?: {
    natalChart?: any
    natalPositions?: any
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
      isNeutralFallback: false,
    }
  }

  // 2. Check profile for direct alchemical effects / elements
  if (userProfile?.natalChart) {
    const chart = userProfile.natalChart
    const alch = chart.alchemicalElements || chart['Alchemy Effects'] || chart
    const sp = alch.spirit ?? alch['Total Spirit']
    const es = alch.essence ?? alch['Total Essence']
    const ma = alch.matter ?? alch['Total Matter']
    const su = alch.substance ?? alch['Total Substance']
    if (
      typeof sp === 'number' &&
      typeof es === 'number' &&
      typeof ma === 'number' &&
      typeof su === 'number'
    ) {
      return {
        dominantElement: userProfile.dominantElement ?? chart.dominantElement ?? null,
        spiritScore: sp > 1 ? sp : sp * 100,
        essenceScore: es > 1 ? es : es * 100,
        matterScore: ma > 1 ? ma : ma * 100,
        substanceScore: su > 1 ? su : su * 100,
        monicaConstant: userProfile.monicaConstant ?? null,
        isNeutralFallback: false,
      }
    }
  }

  // 3. Derive authentic elemental scores from natal placements
  const placements = extractPlacementsFromProfile(userProfile)
  if (placements && placements.length > 0) {
    try {
      const dignitiesPlacements: PlanetaryPlacement[] = placements.map((p, idx) => ({
        planet: p.planet,
        sign: p.sign,
        degree: p.degree,
        house: p.house || idx + 1,
        dignity: calculatePlanetaryDignity(p.planet, p.sign, p.degree, p.house || idx + 1),
      }))
      const quantities = calculateAlchemicalQuantities(dignitiesPlacements)
      return {
        dominantElement: userProfile?.dominantElement ?? null,
        spiritScore: Math.round(quantities.spirit * 10000) / 100,
        essenceScore: Math.round(quantities.essence * 10000) / 100,
        matterScore: Math.round(quantities.matter * 10000) / 100,
        substanceScore: Math.round(quantities.substance * 10000) / 100,
        monicaConstant: userProfile?.monicaConstant ?? null,
        isNeutralFallback: false,
      }
    } catch (e) {
      console.warn(
        '[DiscriminantFaucet] Failed calculating alchemical quantities from placements:',
        e
      )
    }
  }

  // 4. Neutral fallback
  return {
    dominantElement: userProfile?.dominantElement ?? null,
    spiritScore: 50,
    essenceScore: 50,
    matterScore: 50,
    substanceScore: 50,
    monicaConstant: userProfile?.monicaConstant ?? null,
    isNeutralFallback: true,
  }
}
