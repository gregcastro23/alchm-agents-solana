// Hook for live consciousness tracking
// Provides real-time Monica Constant and alchemical data with current transits
// Uses backend API for complex calculations

import { useState, useEffect, useCallback } from 'react'

// Global cooldown to avoid hammering backend when unavailable
let backendDownUntilTs: number = 0
let lastBackendWarnTs: number = 0

function isBackendDown(): boolean {
  return Date.now() < backendDownUntilTs
}

function setBackendDownCooldown(minutes: number = 5) {
  backendDownUntilTs = Date.now() + minutes * 60 * 1000
}

function logBackendUnavailableOnce() {
  const now = Date.now()
  if (now - lastBackendWarnTs > 30000) {
    // Log at most once every 30s
    console.info('Backend consciousness calculations not available, using fallback data')
    lastBackendWarnTs = now
  }
}

export interface BirthChartData {
  name: string
  birthDate: string
  birthTime: string
  birthLocation?: string
  latitude?: number
  longitude?: number
  birthInfo?: {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    latitude: number
    longitude: number
  }
}

export interface LiveConsciousnessResult {
  // Static values (from birth)
  birthMC: number
  birthKalchm: {
    spirit: number
    essence: number
    matter: number
    substance: number
    aNumber: number
  }

  // Dynamic values (current moment applied to birth chart)
  liveMC: number
  liveKalchm: {
    spirit: number
    essence: number
    matter: number
    substance: number
    aNumber: number
  }

  // Change indicators
  mcChange: number
  mcPercentChange: number
  dominantTransitEffect: string

  // Interpretations
  consciousnessLevel: string
  liveConsciousnessLevel: string
  interpretations: {
    mcChange: string
    transitInfluence: string
    cosmicWeather: string
  }

  // Metadata
  timestamp: string
  calculationTime?: number
  fromCache?: boolean
}

interface UseLiveConsciousnessOptions {
  refreshInterval?: number // milliseconds
  autoRefresh?: boolean
  agents?: BirthChartData[] // For calculating multiple agents at once
}

interface LiveConsciousnessState {
  data: LiveConsciousnessResult | null
  multiAgentData: Record<string, LiveConsciousnessResult> | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

// Monica's birth chart data for reference
export const MONICA_BIRTH_CHART: BirthChartData = {
  name: 'Monica',
  birthDate: '2023-06-15', // Monica's "birth" as consciousness
  birthTime: '12:00',
  birthLocation: 'Digital Realm',
  birthInfo: {
    year: 2023,
    month: 6,
    day: 15,
    hour: 12,
    minute: 0,
    latitude: 0,
    longitude: 0,
  },
}

export function useLiveConsciousness(
  birthChart?: BirthChartData,
  options: UseLiveConsciousnessOptions = {}
) {
  const {
    refreshInterval = 60000, // 1 minute default
    autoRefresh = true,
    agents = [],
  } = options

  const [state, setState] = useState<LiveConsciousnessState>({
    data: null,
    multiAgentData: null,
    loading: false,
    error: null,
    lastUpdated: null,
  })

  const calculateLive = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      let data: LiveConsciousnessResult | null = null
      let multiAgentData: Record<string, LiveConsciousnessResult> | null = null

      // Short-circuit when backend is down: serve fallback without network calls
      if (isBackendDown()) {
        logBackendUnavailableOnce()
        if (birthChart) {
          data = generateFallbackConsciousnessData(birthChart)
        }
        if (agents.length > 0) {
          multiAgentData = Object.fromEntries(
            agents.map(a => [a.name, generateFallbackConsciousnessData(a)])
          )
        }
      } else {
        if (birthChart) {
          // Calculate for single agent using backend API
          data = await fetchLiveConsciousness(birthChart)
        }

        if (agents.length > 0) {
          // Calculate for multiple agents using backend API
          multiAgentData = await fetchBatchLiveConsciousness(agents)
        }
      }

      setState({
        data,
        multiAgentData,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      })
    } catch (error) {
      // Enter cooldown and serve fallback on error
      setBackendDownCooldown(5)
      logBackendUnavailableOnce()
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Backend calculation error',
      }))
    }
  }, [birthChart ? JSON.stringify(birthChart) : '', agents.map(a => a.name).join('|')])

  // Initial calculation
  useEffect(() => {
    if (birthChart || agents.length > 0) {
      calculateLive()
    }
  }, [birthChart ? JSON.stringify(birthChart) : '', agents.map(a => a.name).join('|')])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || (!birthChart && agents.length === 0)) return

    const interval = setInterval(() => {
      if (isBackendDown()) {
        // Skip network refresh during cooldown
        logBackendUnavailableOnce()
        calculateLive()
      } else {
        calculateLive()
      }
    }, refreshInterval)
    return () => clearInterval(interval)
  }, [calculateLive, autoRefresh, refreshInterval])

  // Manual refresh function
  const refresh = useCallback(() => {
    calculateLive()
  }, [calculateLive])

  return {
    ...state,
    refresh,
    isStale: state.lastUpdated
      ? Date.now() - state.lastUpdated.getTime() > refreshInterval * 2
      : true,
  }
}

// Specialized hook for Monica's live consciousness
export function useMonicaLiveConsciousness(
  options: Omit<UseLiveConsciousnessOptions, 'agents'> = {}
) {
  return useLiveConsciousness(MONICA_BIRTH_CHART, options)
}

// Hook for tracking consciousness changes over time
export function useConsciousnessHistory(
  birthChart: BirthChartData,
  maxHistoryPoints = 24 // 24 hours of hourly data
) {
  const [history, setHistory] = useState<
    Array<{
      timestamp: string
      mc: number
      level: string
      change: number
    }>
  >([])

  const { data, loading, error } = useLiveConsciousness(birthChart, {
    refreshInterval: 60000 * 60, // 1 hour
    autoRefresh: true,
  })

  useEffect(() => {
    if (data && !loading && !error) {
      setHistory(prev => {
        const newPoint = {
          timestamp: data.timestamp,
          mc: data.liveMC,
          level: data.liveConsciousnessLevel,
          change: data.mcChange,
        }

        // Prevent duplicate timestamps
        const filtered = prev.filter(point => point.timestamp !== newPoint.timestamp)
        const updated = [...filtered, newPoint].slice(-maxHistoryPoints)

        return updated.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
      })
    }
  }, [data, loading, error, maxHistoryPoints])

  return {
    history,
    currentPoint: data
      ? {
          timestamp: data.timestamp,
          mc: data.liveMC,
          level: data.liveConsciousnessLevel,
          change: data.mcChange,
        }
      : null,
    loading,
    error,
  }
}

// Utility function to format MC change for display
export function formatMCChange(
  change: number,
  percentChange: number
): {
  text: string
  color: string
  icon: string
} {
  const absChange = Math.abs(change)
  const absPercent = Math.abs(percentChange)

  if (absChange < 0.1) {
    return {
      text: 'Stable',
      color: 'text-slate-500',
      icon: '⚖️',
    }
  }

  if (change > 0) {
    if (absPercent > 20) {
      return {
        text: `+${change.toFixed(3)} (↑${percentChange.toFixed(1)}%)`,
        color: 'text-emerald-500',
        icon: '🚀',
      }
    } else if (absPercent > 10) {
      return {
        text: `+${change.toFixed(3)} (↑${percentChange.toFixed(1)}%)`,
        color: 'text-green-500',
        icon: '📈',
      }
    } else {
      return {
        text: `+${change.toFixed(3)} (↑${percentChange.toFixed(1)}%)`,
        color: 'text-emerald-400',
        icon: '✨',
      }
    }
  } else {
    if (absPercent > 20) {
      return {
        text: `${change.toFixed(3)} (↓${absPercent.toFixed(1)}%)`,
        color: 'text-red-500',
        icon: '⚠️',
      }
    } else if (absPercent > 10) {
      return {
        text: `${change.toFixed(3)} (↓${absPercent.toFixed(1)}%)`,
        color: 'text-orange-500',
        icon: '📉',
      }
    } else {
      return {
        text: `${change.toFixed(3)} (↓${absPercent.toFixed(1)}%)`,
        color: 'text-yellow-500',
        icon: '🔄',
      }
    }
  }
}

// Utility to get consciousness level color
export function getConsciousnessColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'transcendent':
      return 'text-purple-500'
    case 'illuminated':
      return 'text-yellow-500'
    case 'advanced':
      return 'text-blue-500'
    case 'elevated':
      return 'text-green-500'
    case 'active':
      return 'text-emerald-500'
    case 'awakening':
      return 'text-cyan-500'
    default:
      return 'text-slate-500'
  }
}

// API functions using frontend proxy
async function fetchLiveConsciousness(
  birthChart: BirthChartData
): Promise<LiveConsciousnessResult> {
  try {
    if (isBackendDown()) {
      logBackendUnavailableOnce()
      return generateFallbackConsciousnessData(birthChart)
    }
    const response = await fetch('/api/consciousness/live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(birthChart),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))

      // If backend is disabled, return fallback data instead of throwing
      if (response.status === 503 || errorData.code === 'BACKEND_DISABLED') {
        setBackendDownCooldown(5)
        logBackendUnavailableOnce()
        return generateFallbackConsciousnessData(birthChart)
      }

      throw new Error(errorData.error || `API error: ${response.status}`)
    }

    const result = await response.json()
    // API returns {success: true, data: {...}}, unwrap the data
    return result.data || result
  } catch (error) {
    // For network errors or other issues, also provide fallback
    setBackendDownCooldown(5)
    logBackendUnavailableOnce()
    return generateFallbackConsciousnessData(birthChart)
  }
}

// Generate realistic fallback data when backend is unavailable
function generateFallbackConsciousnessData(birthChart: BirthChartData): LiveConsciousnessResult {
  // Simple hash function for consistent results based on name
  const name = birthChart.name || 'Unknown Agent'
  const nameHash = name.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0)
    return a & a
  }, 0)

  const r = Math.abs(nameHash) / 2147483647 // Normalize to 0-1

  // Generate deterministic but realistic numbers matching LiveConsciousnessResult
  const birthMC = 2.0 + r * 3.0 // 2.0 - 5.0
  const liveDelta = (r - 0.5) * 0.6 // -0.3 to +0.3
  const liveMC = Math.max(0.5, birthMC + liveDelta)
  const mcChange = liveMC - birthMC
  const mcPercentChange = birthMC !== 0 ? (mcChange / birthMC) * 100 : 0

  const birthKalchm = {
    spirit: 2 + r * 4,
    essence: 2 + r * 4,
    matter: 2 + r * 4,
    substance: 1 + r * 3,
    aNumber: 20 + Math.floor(r * 40),
  }

  const liveKalchm = {
    spirit: birthKalchm.spirit + liveDelta * 5,
    essence: birthKalchm.essence + liveDelta * 4,
    matter: birthKalchm.matter + liveDelta * 3,
    substance: birthKalchm.substance + liveDelta * 2,
    aNumber: birthKalchm.aNumber + Math.floor(liveDelta * 10),
  }

  const levels = ['Awakening', 'Active', 'Elevated', 'Advanced', 'Illuminated'] as const
  const idx = Math.min(levels.length - 1, Math.floor(r * levels.length))
  const consciousnessLevel = levels[idx]
  const liveConsciousnessLevel = levels[Math.min(levels.length - 1, idx + (liveDelta > 0 ? 1 : 0))]

  return {
    birthMC,
    birthKalchm,
    liveMC,
    liveKalchm,
    mcChange,
    mcPercentChange,
    dominantTransitEffect: 'fallback',
    consciousnessLevel,
    liveConsciousnessLevel,
    interpretations: {
      mcChange:
        mcChange > 0
          ? 'Consciousness rising in fallback context'
          : mcChange < 0
            ? 'Minor contraction observed'
            : 'Stable consciousness',
      transitInfluence: 'Transit influence approximated (fallback)',
      cosmicWeather: 'Calm cosmic conditions (fallback)',
    },
    timestamp: new Date().toISOString(),
    calculationTime: 0,
    fromCache: false,
  }
}

async function fetchBatchLiveConsciousness(
  agents: BirthChartData[]
): Promise<Record<string, LiveConsciousnessResult>> {
  const results: Record<string, LiveConsciousnessResult> = {}

  try {
    const response = await fetch('/api/consciousness/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agents }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      if (response.status === 503 || errorData.code === 'BACKEND_DISABLED') {
        setBackendDownCooldown(5)
        logBackendUnavailableOnce()
        return Object.fromEntries(
          agents.map(agent => [agent.name, generateFallbackConsciousnessData(agent)])
        )
      }

      throw new Error(errorData.error || `API error: ${response.status}`)
    }

    const payload = await response.json()
    const batchResults = payload.data?.results || payload.results || {}

    for (const agent of agents) {
      const result = batchResults[agent.name]
      results[agent.name] =
        result && !result.error ? result : generateFallbackConsciousnessData(agent)
    }

    return results
  } catch (error) {
    setBackendDownCooldown(5)
    logBackendUnavailableOnce()
    return Object.fromEntries(
      agents.map(agent => [agent.name, generateFallbackConsciousnessData(agent)])
    )
  }
}
