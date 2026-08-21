'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ESMS_TOKEN_NAMES,
  type CanonicalPriceIndexPayload,
  type CanonicalTokenIndexQuote,
  type EsmsTokenName,
} from '@/lib/economy/price-index-contract'

export interface UseElementalPriceIndexOptions {
  refreshIntervalMs?: number
  enabled?: boolean
}

export interface EsmsTokenIndexView extends CanonicalTokenIndexQuote {
  axis: EsmsTokenName
  symbol: string
  name: string
  decimals: 4
  mintAddress: string
  contributingPlanets: string
  description: string
  change1hPct: number
}

const TOKEN_IDENTITY: Record<
  EsmsTokenName,
  Omit<
    EsmsTokenIndexView,
    'axis' | 'token' | 'index' | 'change24hPct' | 'weight' | 'sparkline' | 'change1hPct'
  >
> = {
  Spirit: {
    symbol: 'SPIRIT',
    name: 'Alchm Spirit',
    decimals: 4,
    mintAddress: 'K5kwwomtWYydxJacA7bC5yUEW9TtEuVqBKBoqAWLmhQ',
    contributingPlanets: '☉ Sun · ☿ Mercury · ♃ Jupiter · ♄ Saturn',
    description: 'Agency and generative force in the canonical ESMS projection.',
  },
  Essence: {
    symbol: 'ESSENCE',
    name: 'Alchm Essence',
    decimals: 4,
    mintAddress: '3FcpToU7bj4sLD687uecbesEjzjxBfqYn2EcBXJKPaCf',
    contributingPlanets: '☽ Moon · ♀ Venus · ♂ Mars · ♃ Jupiter · ♅ Uranus · ♆ Neptune · ♇ Pluto',
    description: 'Receptivity and generative potential in the canonical ESMS projection.',
  },
  Matter: {
    symbol: 'MATTER',
    name: 'Alchm Matter',
    decimals: 4,
    mintAddress: '7naJZozLrknDF3dguAdEWn7Z4MviUkXitjhaAt57Vkb4',
    contributingPlanets: '☽ Moon · ♀ Venus · ♂ Mars · ♄ Saturn · ♅ Uranus · ♇ Pluto',
    description: 'Structure and embodiment in the canonical ESMS projection.',
  },
  Substance: {
    symbol: 'SUBSTANCE',
    name: 'Alchm Substance',
    decimals: 4,
    mintAddress: '6RY6ZG1eJQ2uEvpyA6XK74WyF1MpTYbw97hdhELqDUsa',
    contributingPlanets: '☿ Mercury · ♆ Neptune',
    description: 'Transmission and binding in the canonical ESMS projection.',
  },
}

function oneHourChange(sparkline: number[]): number {
  const current = sparkline.at(-1)
  const previous = sparkline.at(-2)
  if (current === undefined || previous === undefined || previous === 0) return 0
  return (current / previous - 1) * 100
}

export function useElementalPriceIndex(options: UseElementalPriceIndexOptions = {}) {
  const { refreshIntervalMs = 20_000, enabled = true } = options

  const [data, setData] = useState<CanonicalPriceIndexPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const fetchIndex = useCallback(async () => {
    try {
      const response = await fetch('/api/economy/price-index', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error(`Price oracle unavailable (HTTP ${response.status})`)
      }
      const payload = (await response.json()) as CanonicalPriceIndexPayload
      if (payload.success !== true || payload.live !== true || !Array.isArray(payload.tokens)) {
        throw new Error('Price oracle returned an invalid contract')
      }
      setData(payload)
      setError(null)
      setLastRefreshed(new Date(payload.generatedAt))
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : 'Price oracle unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void fetchIndex()
    const interval = window.setInterval(() => void fetchIndex(), refreshIntervalMs)
    return () => window.clearInterval(interval)
  }, [enabled, fetchIndex, refreshIntervalMs])

  const formatIndex = useCallback(
    (quote: Pick<CanonicalTokenIndexQuote, 'index'>): string => quote.index.toFixed(4),
    []
  )

  const formatChange = useCallback((change: number): { text: string; isPositive: boolean } => {
    const isPositive = change >= 0
    return {
      text: `${isPositive ? '+' : ''}${change.toFixed(2)}%`,
      isPositive,
    }
  }, [])

  const quotesList = useMemo<EsmsTokenIndexView[]>(() => {
    if (!data) return []
    const quotes = new Map(data.tokens.map(quote => [quote.token, quote]))
    return ESMS_TOKEN_NAMES.flatMap(axis => {
      const quote = quotes.get(axis)
      if (!quote) return []
      return [
        {
          ...quote,
          ...TOKEN_IDENTITY[axis],
          axis,
          change1hPct: oneHourChange(quote.sparkline),
        },
      ]
    })
  }, [data])

  return {
    data,
    loading,
    error,
    lastRefreshed,
    refresh: fetchIndex,
    formatIndex,
    formatChange,
    quotesList,
  }
}
