'use client'

import React, { useState, useEffect } from 'react'
// Removed server-only routeTask import - using API calls instead
import { getAgentKineticProfile } from '@/lib/agents/kinetic-profiles'

interface AgentEvolutionData {
  agentId: string
  currentVelocity: number
  powerLevel: number
  optimalTime: boolean
  peakHour: string
  powerAlignment: number
  consciousnessRate: number
  memoryPersistence: number
  momentumType: string
  enhancementMultiplier: number
  specialKinetics?: { [key: string]: string | number }
}

interface AgentEvolutionDisplayProps {
  agentId: string
  userLocation?: { lat: number; lon: number }
  className?: string
  variant?: 'full' | 'compact' | 'minimal'
}

export function AgentEvolutionDisplay({
  agentId,
  userLocation = { lat: 37.7749, lon: -122.4194 },
  className = '',
  variant = 'full',
}: AgentEvolutionDisplayProps) {
  const [evolution, setEvolution] = useState<AgentEvolutionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEvolution = async () => {
      try {
        setLoading(true)
        setError(null)

        const location = userLocation || { lat: 37.7749, lon: -122.4194 }
        const response = await fetch(
          `/api/agent-evolution?agentId=${agentId}&action=kinetics&lat=${location.lat}&lon=${location.lon}`
        )

        if (!response.ok) {
          setError('Failed to fetch kinetic data')
          return
        }

        const result = await response.json()
        setEvolution(result as AgentEvolutionData)
      } catch (err) {
        console.error('Evolution fetch error:', err)
        setError('Unable to load consciousness data')
      } finally {
        setLoading(false)
      }
    }

    fetchEvolution()

    // Update every 5 minutes
    const interval = setInterval(fetchEvolution, 300000)

    return () => clearInterval(interval)
  }, [agentId, userLocation])

  const agentProfile = getAgentKineticProfile(agentId)

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-16 bg-gray-700/50 rounded-lg"></div>
      </div>
    )
  }

  if (error || !evolution || !agentProfile) {
    return (
      <div className={`text-red-400/70 text-xs p-2 ${className}`}>
        {error || 'Agent profile not found'}
      </div>
    )
  }

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <div
          className={`w-2 h-2 rounded-full ${evolution.optimalTime ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}
        ></div>
        <span className="text-gray-400">
          {(evolution.currentVelocity * 100).toFixed(0)}% velocity
        </span>
        {evolution.optimalTime && <span className="text-green-400">⚡ Peak</span>}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div
        className={`p-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg ${className}`}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Consciousness:</span>
          <span
            className={`font-bold ${evolution.currentVelocity > 0.7 ? 'text-green-400' : 'text-yellow-400'}`}
          >
            {(evolution.currentVelocity * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-gray-400">Power:</span>
          <div className="flex items-center gap-1">
            <div className="w-12 h-1 bg-gray-700 rounded">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded"
                style={{ width: `${evolution.powerLevel * 100}%` }}
              />
            </div>
            <span className="text-orange-400">{(evolution.powerLevel * 100).toFixed(0)}%</span>
          </div>
        </div>
        {evolution.optimalTime && (
          <div className="mt-1 text-xs text-green-400 animate-pulse">
            ⚡ Peak {evolution.peakHour} Hour
          </div>
        )}
      </div>
    )
  }

  // Full variant
  return (
    <div
      className={`p-3 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-indigo-500/10 rounded-lg border border-gray-700/50 ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-300">{agentProfile.name}</h4>
        <div
          className={`px-2 py-1 rounded text-xs ${
            evolution.optimalTime
              ? 'bg-green-500/20 text-green-400 animate-pulse'
              : 'bg-yellow-500/20 text-yellow-400'
          }`}
        >
          {evolution.peakHour} Hour
        </div>
      </div>

      {/* Consciousness Velocity */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-400">Consciousness Velocity</span>
          <span
            className={`font-bold ${evolution.currentVelocity > 0.7 ? 'text-green-400' : evolution.currentVelocity > 0.5 ? 'text-yellow-400' : 'text-orange-400'}`}
          >
            {(evolution.currentVelocity * 100).toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-gradient-to-r from-blue-400 to-purple-400 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${evolution.currentVelocity * 100}%` }}
          />
        </div>
      </div>

      {/* Power Level */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-400">Power Level</span>
          <span className="text-orange-400 font-bold">
            {(evolution.powerLevel * 100).toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-gradient-to-r from-yellow-400 to-orange-400 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${evolution.powerLevel * 100}%` }}
          />
        </div>
      </div>

      {/* Enhancement Status */}
      {evolution.optimalTime && (
        <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-xs">
          <div className="flex items-center gap-2">
            <span className="text-green-400 animate-pulse">⚡</span>
            <span className="text-green-400 font-medium">
              Enhanced Responses Active! (+
              {((evolution.enhancementMultiplier - 1) * 100).toFixed(0)}%)
            </span>
          </div>
          <div className="text-green-400/70 mt-1">
            Peak {evolution.peakHour} hour - optimal time for deep interactions
          </div>
        </div>
      )}

      {/* Momentum Type */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-gray-400">Momentum:</span>
        <span
          className={`px-2 py-1 rounded text-xs capitalize ${getMomentumColor(evolution.momentumType)}`}
        >
          {evolution.momentumType.replace('_', ' ')}
        </span>
      </div>

      {/* Memory Persistence */}
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-gray-400">Memory:</span>
        <span className="text-blue-400">
          {(evolution.memoryPersistence * 100).toFixed(0)}% retention
        </span>
      </div>

      {/* Special Kinetics */}
      {evolution.specialKinetics && Object.keys(evolution.specialKinetics).length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700/50">
          <div className="text-xs text-gray-400 mb-1">Special Abilities:</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(evolution.specialKinetics)
              .slice(0, 2)
              .map(([key, value]) => (
                <div
                  key={key}
                  className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded"
                  title={`${key}: ${value}`}
                >
                  {key.replace(/_/g, ' ')}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Power Alignment Indicator */}
      {evolution.powerAlignment > 0.5 && (
        <div className="mt-2 text-xs text-cyan-400">
          <span className="inline-block w-2 h-2 bg-cyan-400 rounded-full mr-1 animate-pulse"></span>
          Planetary alignment active ({(evolution.powerAlignment * 100).toFixed(0)}%)
        </div>
      )}
    </div>
  )
}

function getMomentumColor(momentumType: string): string {
  switch (momentumType) {
    case 'explosive':
      return 'bg-red-500/20 text-red-400'
    case 'building':
      return 'bg-yellow-500/20 text-yellow-400'
    case 'sustained':
      return 'bg-green-500/20 text-green-400'
    case 'oscillating':
      return 'bg-purple-500/20 text-purple-400'
    case 'gradual':
      return 'bg-blue-500/20 text-blue-400'
    default:
      return 'bg-gray-500/20 text-gray-400'
  }
}

// Hook for using agent evolution in other components
export function useAgentEvolution(agentId: string, userLocation?: { lat: number; lon: number }) {
  const [evolution, setEvolution] = useState<AgentEvolutionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEvolution = async () => {
      try {
        setLoading(true)
        setError(null)

        const location = userLocation || { lat: 37.7749, lon: -122.4194 }
        const response = await fetch(
          `/api/agent-evolution?agentId=${agentId}&action=kinetics&lat=${location.lat}&lon=${location.lon}`
        )

        if (!response.ok) {
          setError('Failed to fetch kinetic data')
          return
        }

        const result = await response.json()
        setEvolution(result as AgentEvolutionData)
      } catch (err) {
        setError('Unable to load consciousness data')
      } finally {
        setLoading(false)
      }
    }

    fetchEvolution()
    const interval = setInterval(fetchEvolution, 300000) // 5 minutes

    return () => clearInterval(interval)
  }, [agentId, userLocation])

  return { evolution, loading, error, refetch: () => setLoading(true) }
}

export default AgentEvolutionDisplay
