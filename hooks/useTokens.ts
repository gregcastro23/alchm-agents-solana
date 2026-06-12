/**
 * useTokens Hook
 * Backend-first token rate calculations with local fallback
 */

import { useState, useCallback } from 'react'
import {
  TokensClient,
  TokenCalculationRequest,
  TokenCalculationResult,
} from '@/lib/clients/tokens-client'

interface UseTokensOptions {
  autoCalculate?: boolean
  defaultLocation?: { latitude: number; longitude: number }
}

interface UseTokensReturn {
  result: TokenCalculationResult | null
  loading: boolean
  error: string | null
  calculateRates: (request?: Partial<TokenCalculationRequest>) => Promise<void>
  refresh: () => Promise<void>
}

export function useTokens(options: UseTokensOptions = {}): UseTokensReturn {
  const { autoCalculate = false, defaultLocation = { latitude: 37.7749, longitude: -122.4194 } } =
    options

  const [result, setResult] = useState<TokenCalculationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRequest, setLastRequest] = useState<TokenCalculationRequest | null>(null)

  const calculateRates = useCallback(
    async (partialRequest?: Partial<TokenCalculationRequest>) => {
      setLoading(true)
      setError(null)

      try {
        const request: TokenCalculationRequest = {
          datetime: new Date(),
          location: defaultLocation,
          baseTokens: {
            Spirit: 1.0,
            Essence: 0.8,
            Matter: 0.6,
            Substance: 0.4,
          },
          ...partialRequest,
        }

        setLastRequest(request)

        const calculationResult = await TokensClient.calculateRates(request)
        setResult(calculationResult)

        console.log(
          `Token calculation completed via ${calculationResult.metadata.source} in ${calculationResult.metadata.calculationTime}ms`
        )
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Token calculation failed'
        setError(errorMessage)
        console.error('Token calculation error:', err)
      } finally {
        setLoading(false)
      }
    },
    [defaultLocation]
  )

  const refresh = useCallback(async () => {
    if (lastRequest) {
      await calculateRates(lastRequest)
    } else {
      await calculateRates()
    }
  }, [lastRequest, calculateRates])

  // Auto-calculate on mount if requested
  useState(() => {
    if (autoCalculate) {
      calculateRates()
    }
  })

  return {
    result,
    loading,
    error,
    calculateRates,
    refresh,
  }
}
