'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import type {
  ElementalPriceIndexResponse,
  ElementalQuote,
  ElementAxisKey,
} from '@/app/api/economy/price-index/route'

export type CurrencyMode = 'USD' | 'SOL'

export interface UseElementalPriceIndexOptions {
  refreshIntervalMs?: number
  enabled?: boolean
}

// Fallback initial data to avoid hydration flickers
const INITIAL_FALLBACK: ElementalPriceIndexResponse = {
  success: true,
  updatedAt: new Date().toISOString(),
  solanaCluster: 'devnet',
  programId: '5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD',
  tokenProgramId: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  solUsdPrice: 185.5,
  compositeIndex: {
    valueUsd: 1.0,
    change24h: 1.25,
    dominantElement: 'fire',
    celestialSeason: 'Solar Alignment',
  },
  elements: {
    Spirit: {
      axis: 'Spirit',
      symbol: 'SPIRIT',
      name: 'Alchm Spirit',
      element: 'fire',
      archetype: 'Solar Agency & Martial Impetus',
      rulingPlanets: '☉ Sun / ♂ Mars',
      decimals: 4,
      mintAddress: '8wJ1SpiritMint11111111111111111111111111111',
      mintAuthority: '5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD',
      tokenStandard: 'Token-2022 (Perm-Burn / Non-Transferable)',
      priceUsd: 1.12,
      priceSol: 0.006038,
      change24h: 3.42,
      velocity1h: 0.85,
      harmonicResonance: 0.34,
      dominantAspect: 'Sun in Leo · Mars in Aries',
      sparkline: [1.02, 1.04, 1.06, 1.05, 1.08, 1.1, 1.12],
      supply: { circulating: 240000, max: 'Soulbound Elastic' },
    },
    Essence: {
      axis: 'Essence',
      symbol: 'ESSENCE',
      name: 'Alchm Essence',
      element: 'water',
      archetype: 'Lunar Receptivity & Neptunian Resonance',
      rulingPlanets: '☽ Moon / ♆ Neptune',
      decimals: 4,
      mintAddress: '8wJ2EssenceMint1111111111111111111111111111',
      mintAuthority: '5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD',
      tokenStandard: 'Token-2022 (Perm-Burn / Non-Transferable)',
      priceUsd: 0.96,
      priceSol: 0.005175,
      change24h: -1.15,
      velocity1h: -0.22,
      harmonicResonance: -0.11,
      dominantAspect: 'Moon in Cancer · Neptune in Pisces',
      sparkline: [0.99, 0.98, 0.97, 0.96, 0.95, 0.96, 0.96],
      supply: { circulating: 240000, max: 'Soulbound Elastic' },
    },
    Matter: {
      axis: 'Matter',
      symbol: 'MATTER',
      name: 'Alchm Matter',
      element: 'earth',
      archetype: 'Saturnian Structure & Plutonic Integration',
      rulingPlanets: '♄ Saturn / ♇ Pluto',
      decimals: 4,
      mintAddress: '8wJ3MatterMint11111111111111111111111111111',
      mintAuthority: '5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD',
      tokenStandard: 'Token-2022 (Perm-Burn / Non-Transferable)',
      priceUsd: 1.05,
      priceSol: 0.00566,
      change24h: 2.1,
      velocity1h: 0.45,
      harmonicResonance: 0.15,
      dominantAspect: 'Saturn in Capricorn · Pluto in Aquarius',
      sparkline: [1.01, 1.02, 1.03, 1.04, 1.04, 1.05, 1.05],
      supply: { circulating: 240000, max: 'Soulbound Elastic' },
    },
    Substance: {
      axis: 'Substance',
      symbol: 'SUBSTANCE',
      name: 'Alchm Substance',
      element: 'air',
      archetype: 'Mercurial Velocity & Uranian Surprisal',
      rulingPlanets: '☿ Mercury / ♅ Uranus',
      decimals: 4,
      mintAddress: '8wJ4SubstanceMint111111111111111111111111111',
      mintAuthority: '5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD',
      tokenStandard: 'Token-2022 (Perm-Burn / Non-Transferable)',
      priceUsd: 0.88,
      priceSol: 0.004744,
      change24h: -2.3,
      velocity1h: -0.5,
      harmonicResonance: -0.35,
      dominantAspect: 'Mercury in Gemini · Uranus in Taurus',
      sparkline: [0.92, 0.91, 0.9, 0.89, 0.88, 0.87, 0.88],
      supply: { circulating: 240000, max: 'Soulbound Elastic' },
    },
  },
}

export function useElementalPriceIndex(options: UseElementalPriceIndexOptions = {}) {
  const { refreshIntervalMs = 20000, enabled = true } = options

  const [data, setData] = useState<ElementalPriceIndexResponse>(INITIAL_FALLBACK)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [currency, setCurrency] = useState<CurrencyMode>('USD')
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  const fetchIndex = useCallback(async () => {
    try {
      const res = await fetch('/api/economy/price-index', {
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch price index: ${res.statusText}`)
      }
      const json = (await res.json()) as ElementalPriceIndexResponse
      if (json.success) {
        setData(json)
        setError(null)
        setLastRefreshed(new Date())
      } else {
        throw new Error('Unsuccessful price index response')
      }
    } catch (err) {
      console.warn('useElementalPriceIndex error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    fetchIndex()
    const interval = setInterval(fetchIndex, refreshIntervalMs)
    return () => clearInterval(interval)
  }, [enabled, fetchIndex, refreshIntervalMs])

  const formatPrice = useCallback(
    (quote: ElementalQuote, mode: CurrencyMode = currency): string => {
      if (mode === 'USD') {
        return `$${quote.priceUsd.toFixed(quote.priceUsd < 1 ? 4 : 2)}`
      }
      return `${quote.priceSol.toFixed(5)} SOL`
    },
    [currency]
  )

  const formatChange = useCallback((change: number): { text: string; isPositive: boolean } => {
    const isPositive = change >= 0
    return {
      text: `${isPositive ? '+' : ''}${change.toFixed(2)}%`,
      isPositive,
    }
  }, [])

  const quotesList = useMemo(() => {
    if (!data?.elements) return []
    return (['Spirit', 'Essence', 'Matter', 'Substance'] as ElementAxisKey[])
      .map(axis => data.elements[axis])
      .filter(Boolean)
  }, [data])

  return {
    data,
    loading,
    error,
    currency,
    setCurrency,
    lastRefreshed,
    refresh: fetchIndex,
    formatPrice,
    formatChange,
    quotesList,
  }
}
