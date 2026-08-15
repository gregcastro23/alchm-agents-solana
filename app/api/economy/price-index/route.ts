import { NextResponse } from 'next/server'
import { generateAlchmForCurrentMoment } from '@/lib/alchemizer'
import { computeDignityWaveharmonics } from '@/lib/economy/chat-pricing'
import {
  AAE_SOLANA_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ESMS_DECIMALS,
  getEsmsMintAddresses,
} from '@/lib/solana/esms'
import { getCurrentPlanetaryPositions } from '@/lib/calculate-transits'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export type ElementAxisKey = 'Spirit' | 'Essence' | 'Matter' | 'Substance'

export interface ElementalQuote {
  axis: ElementAxisKey
  symbol: string
  name: string
  element: 'fire' | 'water' | 'earth' | 'air'
  archetype: string
  rulingPlanets: string
  decimals: number
  mintAddress: string
  mintAuthority: string
  tokenStandard: string
  priceUsd: number
  priceSol: number
  change24h: number
  velocity1h: number
  harmonicResonance: number
  dominantAspect: string
  sparkline: number[]
  supply: {
    circulating: number
    max: string
  }
}

export interface ElementalPriceIndexResponse {
  success: boolean
  updatedAt: string
  solanaCluster: 'devnet' | 'mainnet-beta'
  programId: string
  tokenProgramId: string
  solUsdPrice: number
  compositeIndex: {
    valueUsd: number
    change24h: number
    dominantElement: 'fire' | 'water' | 'earth' | 'air'
    celestialSeason: string
  }
  elements: Record<ElementAxisKey, ElementalQuote>
}

// Approximate reference SOL price in USD
const ESTIMATED_SOL_USD = 185.5

const ELEMENT_METADATA: Record<
  ElementAxisKey,
  {
    symbol: string
    name: string
    element: 'fire' | 'water' | 'earth' | 'air'
    archetype: string
    rulingPlanets: string
    baseAspect: string
  }
> = {
  Spirit: {
    symbol: 'SPIRIT',
    name: 'Alchm Spirit',
    element: 'fire',
    archetype: 'Solar Agency & Martial Impetus',
    rulingPlanets: '☉ Sun / ♂ Mars',
    baseAspect: 'Solar Radiance (Fire Trinity)',
  },
  Essence: {
    symbol: 'ESSENCE',
    name: 'Alchm Essence',
    element: 'water',
    archetype: 'Lunar Receptivity & Neptunian Resonance',
    rulingPlanets: '☽ Moon / ♆ Neptune',
    baseAspect: 'Lunar Tidal Drift (Water Flow)',
  },
  Matter: {
    symbol: 'MATTER',
    name: 'Alchm Matter',
    element: 'earth',
    archetype: 'Saturnian Structure & Plutonic Integration',
    rulingPlanets: '♄ Saturn / ♇ Pluto',
    baseAspect: 'Saturnian Bedrock (Earth Stability)',
  },
  Substance: {
    symbol: 'SUBSTANCE',
    name: 'Alchm Substance',
    element: 'air',
    archetype: 'Mercurial Velocity & Uranian Surprisal',
    rulingPlanets: '☿ Mercury / ♅ Uranus',
    baseAspect: 'Mercurial Slipstream (Air Velocity)',
  },
}

function roundTo(n: number, decimals = 4): number {
  const factor = Math.pow(10, decimals)
  return Math.round((n + Number.EPSILON) * factor) / factor
}

// Generate 24-point sparkline for a given element based on 24h harmonic wave
function generateSparkline(
  basePrice: number,
  harmonic: number,
  axisIndex: number,
  nowMs: number
): number[] {
  const points: number[] = []
  const hourMs = 3600 * 1000
  const phaseOffset = axisIndex * (Math.PI / 2)

  for (let i = 24; i >= 0; i--) {
    const t = (nowMs - i * hourMs) / (1000 * 3600)
    // Diurnal 24h wave + 12h tidal wave + continuous harmonic modulation
    const diurnal = Math.sin(t * (Math.PI / 12) + phaseOffset) * 0.08
    const tidal = Math.cos(t * (Math.PI / 6) + phaseOffset) * 0.04
    const micro = Math.sin(t * 1.5 + axisIndex) * 0.015
    const mod = 1.0 + harmonic * 0.25 + diurnal + tidal + micro
    const price = Math.max(0.1, basePrice * mod)
    points.push(roundTo(price, 4))
  }
  return points
}

export async function GET() {
  try {
    const now = new Date()
    const nowMs = now.getTime()

    // 1. Fetch current alchemical quantities and waveharmonics
    let alchmData: Record<string, any> = {}
    try {
      alchmData = await generateAlchmForCurrentMoment()
    } catch (e) {
      console.warn('Price index: Fallback to synthetic sky harmonics', e)
    }

    const waveHarmonics = computeDignityWaveharmonics(alchmData)
    const positions = getCurrentPlanetaryPositions(now)

    // 2. Fetch Solana Token-2022 Mint Addresses
    let mintAddresses: string[] = []
    try {
      mintAddresses = getEsmsMintAddresses(AAE_SOLANA_PROGRAM_ID).map(pk => pk.toBase58())
    } catch {
      mintAddresses = [
        'K5kwwomtWYydxJacA7bC5yUEW9TtEuVqBKBoqAWLmhQ',
        '3FcpToU7bj4sLD687uecbesEjzjxBfqYn2EcBXJKPaCf',
        '7naJZozLrknDF3dguAdEWn7Z4MviUkXitjhaAt57Vkb4',
        '6RY6ZG1eJQ2uEvpyA6XK74WyF1MpTYbw97hdhELqDUsa',
      ]
    }

    // 3. Compute continuous pricing for all 4 elements
    const axes: ElementAxisKey[] = ['Spirit', 'Essence', 'Matter', 'Substance']
    const quotes: Partial<Record<ElementAxisKey, ElementalQuote>> = {}

    let totalUsdPrice = 0
    let dominantElement: 'fire' | 'water' | 'earth' | 'air' = 'fire'
    let highestHarmonic = -Infinity

    axes.forEach((axis, index) => {
      const meta = ELEMENT_METADATA[axis]
      const harmonic = waveHarmonics[axis] ?? 0
      if (harmonic > highestHarmonic) {
        highestHarmonic = harmonic
        dominantElement = meta.element
      }

      // Base price is $1.00 USD baseline for 1 ESMS atomic unit
      // Instantaneous price: $1.00 * (1.0 + 0.35 * Psi_a)
      const basePrice = 1.0
      const instantaneousPriceUsd = roundTo(Math.max(0.2, basePrice * (1.0 + 0.35 * harmonic)), 4)
      const instantaneousPriceSol = roundTo(instantaneousPriceUsd / ESTIMATED_SOL_USD, 6)

      // 24-point sparkline
      const sparkline = generateSparkline(basePrice, harmonic, index, nowMs)
      const price24hAgo = sparkline[0]
      const currentPrice = sparkline[sparkline.length - 1]
      const change24h = roundTo(((currentPrice - price24hAgo) / price24hAgo) * 100, 2)

      const price1hAgo = sparkline[sparkline.length - 2] ?? price24hAgo
      const velocity1h = roundTo(((currentPrice - price1hAgo) / price1hAgo) * 100, 2)

      // Active dynamic aspect description
      let dominantAspect = meta.baseAspect
      if (axis === 'Spirit' && positions.Sun) {
        dominantAspect = `Sun in ${positions.Sun.sign} (${positions.Sun.degree}°)${positions.Mars?.sign ? ` · Mars in ${positions.Mars.sign}` : ''}`
      } else if (axis === 'Essence' && positions.Moon) {
        dominantAspect = `Moon in ${positions.Moon.sign} (${positions.Moon.degree}°)${positions.Neptune?.sign ? ` · Neptune in ${positions.Neptune.sign}` : ''}`
      } else if (axis === 'Matter' && positions.Saturn) {
        dominantAspect = `Saturn in ${positions.Saturn.sign} (${positions.Saturn.degree}°)${positions.Pluto?.sign ? ` · Pluto in ${positions.Pluto.sign}` : ''}`
      } else if (axis === 'Substance' && positions.Mercury) {
        dominantAspect = `Mercury in ${positions.Mercury.sign} (${positions.Mercury.degree}°)${positions.Uranus?.sign ? ` · Uranus in ${positions.Uranus.sign}` : ''}`
      }

      totalUsdPrice += instantaneousPriceUsd

      quotes[axis] = {
        axis,
        symbol: meta.symbol,
        name: meta.name,
        element: meta.element,
        archetype: meta.archetype,
        rulingPlanets: meta.rulingPlanets,
        decimals: ESMS_DECIMALS,
        mintAddress: mintAddresses[index] || `ESMS_MINT_${axis.toUpperCase()}`,
        mintAuthority: AAE_SOLANA_PROGRAM_ID.toBase58(),
        tokenStandard: 'Token-2022 (Perm-Burn / Non-Transferable)',
        priceUsd: instantaneousPriceUsd,
        priceSol: instantaneousPriceSol,
        change24h,
        velocity1h,
        harmonicResonance: roundTo(harmonic, 4),
        dominantAspect,
        sparkline,
        supply: {
          circulating: 240_000,
          max: 'Soulbound Elastic',
        },
      }
    })

    const avgChange24h = roundTo(
      Object.values(quotes).reduce((sum, q) => sum + (q?.change24h || 0), 0) / 4,
      2
    )

    const sunSign = positions.Sun?.sign || 'Aquarius'
    const celestialSeason = `Season of ${sunSign} (Dominant: ${dominantElement.toUpperCase()})`

    const responseData: ElementalPriceIndexResponse = {
      success: true,
      updatedAt: now.toISOString(),
      solanaCluster: 'devnet',
      programId: AAE_SOLANA_PROGRAM_ID.toBase58(),
      tokenProgramId: TOKEN_2022_PROGRAM_ID.toBase58(),
      solUsdPrice: ESTIMATED_SOL_USD,
      compositeIndex: {
        valueUsd: roundTo(totalUsdPrice / 4, 4),
        change24h: avgChange24h,
        dominantElement,
        celestialSeason,
      },
      elements: quotes as Record<ElementAxisKey, ElementalQuote>,
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error serving elemental price index:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown price index error',
      },
      { status: 500 }
    )
  }
}
