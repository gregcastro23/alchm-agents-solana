/**
 * useRuneAgent Hook
 * Backend-first rune generation and agent recommendations with local fallback
 */

import { useState, useCallback, useEffect } from 'react'
import {
  RuneAgentClient,
  RuneGenerationRequest,
  RuneOfTheMoment,
  AgentRecommendation,
  RuneAgentResult,
} from '@/lib/clients/rune-agent-client'

interface UseRuneAgentOptions {
  autoGenerate?: boolean
  defaultLocation?: { latitude: number; longitude: number }
  refreshInterval?: number // in milliseconds, for auto-refresh
}

interface UseRuneAgentReturn {
  rune: RuneOfTheMoment | null
  agent: AgentRecommendation | null
  synergy: RuneAgentResult['synergy'] | null
  metadata: RuneAgentResult['metadata'] | null
  loading: boolean
  error: string | null
  generateComplete: (request?: Partial<RuneGenerationRequest>) => Promise<void>
  generateRune: (request?: Partial<RuneGenerationRequest>) => Promise<void>
  generateAgent: (request?: Partial<RuneGenerationRequest>) => Promise<void>
  refresh: () => Promise<void>
}

export function useRuneAgent(options: UseRuneAgentOptions = {}): UseRuneAgentReturn {
  const {
    autoGenerate = false,
    defaultLocation = { latitude: 37.7749, longitude: -122.4194 },
    refreshInterval,
  } = options

  const [rune, setRune] = useState<RuneOfTheMoment | null>(null)
  const [agent, setAgent] = useState<AgentRecommendation | null>(null)
  const [synergy, setSynergy] = useState<RuneAgentResult['synergy'] | null>(null)
  const [metadata, setMetadata] = useState<RuneAgentResult['metadata'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRequest, setLastRequest] = useState<RuneGenerationRequest | null>(null)

  const generateComplete = useCallback(
    async (partialRequest?: Partial<RuneGenerationRequest>) => {
      setLoading(true)
      setError(null)

      try {
        const request: RuneGenerationRequest = {
          datetime: new Date(),
          location: defaultLocation,
          context: 'cuisine',
          preferences: {
            intensity: 'moderate',
          },
          ...partialRequest,
        }

        setLastRequest(request)

        const result = await RuneAgentClient.generateComplete(request)

        setRune(result.rune)
        setAgent(result.agent)
        setSynergy(result.synergy)
        setMetadata(result.metadata)

        console.log(
          `Rune/Agent generation completed via ${result.metadata.source} in ${result.metadata.generationTime}ms`
        )
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Rune/Agent generation failed'
        setError(errorMessage)
        console.error('Rune/Agent generation error:', err)
      } finally {
        setLoading(false)
      }
    },
    [defaultLocation]
  )

  const generateRune = useCallback(
    async (partialRequest?: Partial<RuneGenerationRequest>) => {
      setLoading(true)
      setError(null)

      try {
        const request: RuneGenerationRequest = {
          datetime: new Date(),
          location: defaultLocation,
          context: 'cuisine',
          ...partialRequest,
        }

        const runeResult = await RuneAgentClient.generateRune(request)
        setRune(runeResult)

        console.log(`Rune generation completed`)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Rune generation failed'
        setError(errorMessage)
        console.error('Rune generation error:', err)
      } finally {
        setLoading(false)
      }
    },
    [defaultLocation]
  )

  const generateAgent = useCallback(
    async (partialRequest?: Partial<RuneGenerationRequest>) => {
      setLoading(true)
      setError(null)

      try {
        const request: RuneGenerationRequest = {
          datetime: new Date(),
          location: defaultLocation,
          context: 'cuisine',
          ...partialRequest,
        }

        const agentResult = await RuneAgentClient.getAgentRecommendation(request)
        setAgent(agentResult)

        console.log(`Agent recommendation completed`)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Agent recommendation failed'
        setError(errorMessage)
        console.error('Agent recommendation error:', err)
      } finally {
        setLoading(false)
      }
    },
    [defaultLocation]
  )

  const refresh = useCallback(async () => {
    if (lastRequest) {
      await generateComplete(lastRequest)
    } else {
      await generateComplete()
    }
  }, [lastRequest, generateComplete])

  // Auto-generate on mount if requested
  useEffect(() => {
    if (autoGenerate) {
      generateComplete()
    }
  }, [autoGenerate, generateComplete])

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(() => {
        refresh()
      }, refreshInterval)

      return () => clearInterval(interval)
    }
    return undefined
  }, [refreshInterval, refresh])

  return {
    rune,
    agent,
    synergy,
    metadata,
    loading,
    error,
    generateComplete,
    generateRune,
    generateAgent,
    refresh,
  }
}
