'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Info,
  Wifi,
  WifiOff,
  Database,
} from 'lucide-react'

interface PlanetaryPositionData {
  source: 'external-api' | 'enhanced-calculator' | 'basic-transits' | 'static-fallback'
  accuracy: 'high' | 'medium' | 'low' | 'fallback'
  cached: boolean
  cacheAge?: number
  error?: string
  timestamp: string
}

interface PlanetaryPositionIndicatorProps {
  positionData?: PlanetaryPositionData
  showDetails?: boolean
  size?: 'sm' | 'md' | 'lg'
  compact?: boolean
}

const PlanetaryPositionIndicator: React.FC<PlanetaryPositionIndicatorProps> = ({
  positionData,
  showDetails = false,
  size = 'md',
  compact = false,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const getAccuracyConfig = (accuracy: string) => {
    switch (accuracy) {
      case 'high':
        return {
          color: 'bg-green-500 text-white',
          icon: CheckCircle,
          label: 'High Accuracy',
          description: 'Real-time calculations with external API validation',
        }
      case 'medium':
        return {
          color: 'bg-yellow-500 text-white',
          icon: AlertTriangle,
          label: 'Medium Accuracy',
          description: 'Enhanced astronomical calculations',
        }
      case 'low':
        return {
          color: 'bg-orange-500 text-white',
          icon: Clock,
          label: 'Basic Accuracy',
          description: 'Standard astronomical transits',
        }
      case 'fallback':
        return {
          color: 'bg-red-500 text-white',
          icon: XCircle,
          label: 'Fallback Mode',
          description: 'Static data due to service unavailability',
        }
      default:
        return {
          color: 'bg-gray-500 text-white',
          icon: Info,
          label: 'Unknown',
          description: 'Accuracy level undetermined',
        }
    }
  }

  const getSourceConfig = (source: string) => {
    switch (source) {
      case 'external-api':
        return {
          label: 'External API',
          icon: Wifi,
          description: 'Real-time data from professional astrology service',
        }
      case 'enhanced-calculator':
        return {
          label: 'Enhanced Calculator',
          icon: Database,
          description: 'Advanced astronomical calculations with corrections',
        }
      case 'basic-transits':
        return {
          label: 'Basic Transits',
          icon: RefreshCw,
          description: 'Standard astronomical transit calculations',
        }
      case 'static-fallback':
        return {
          label: 'Static Fallback',
          icon: WifiOff,
          description: 'Pre-calculated data due to service issues',
        }
      default:
        return {
          label: 'Unknown Source',
          icon: Info,
          description: 'Data source undetermined',
        }
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = currentTime
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  const formatCacheAge = (age?: number) => {
    if (!age) return 'Fresh'
    const ageMins = Math.floor(age / (1000 * 60))
    if (ageMins < 1) return 'Fresh'
    if (ageMins < 60) return `${ageMins}m old`
    const ageHours = Math.floor(ageMins / 60)
    return `${ageHours}h old`
  }

  if (!positionData) {
    return (
      <Badge variant="outline" className="text-gray-500">
        <Info className="h-3 w-3 mr-1" />
        Loading...
      </Badge>
    )
  }

  const accuracyConfig = getAccuracyConfig(positionData.accuracy)
  const sourceConfig = getSourceConfig(positionData.source)
  const AccuracyIcon = accuracyConfig.icon
  const SourceIcon = sourceConfig.icon

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2',
  }

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <Badge className={`${accuracyConfig.color} ${sizeClasses[size]}`}>
          <AccuracyIcon className="h-3 w-3 mr-1" />
          {accuracyConfig.label}
        </Badge>
        {positionData.cached && (
          <Badge variant="outline" className="text-xs">
            <Database className="h-3 w-3 mr-1" />
            Cached
          </Badge>
        )}
      </div>
    )
  }

  const indicator = (
    <div className="flex items-center space-x-2">
      <Badge className={`${accuracyConfig.color} ${sizeClasses[size]}`}>
        <AccuracyIcon className="h-3 w-3 mr-1" />
        {accuracyConfig.label}
      </Badge>

      <Badge variant="outline" className="text-xs">
        <SourceIcon className="h-3 w-3 mr-1" />
        {sourceConfig.label}
      </Badge>

      {positionData.cached && (
        <Badge variant="outline" className="text-xs text-blue-600">
          <Database className="h-3 w-3 mr-1" />
          {formatCacheAge(positionData.cacheAge)}
        </Badge>
      )}

      <span className="text-xs text-gray-500">{formatTimeAgo(positionData.timestamp)}</span>
    </div>
  )

  if (!showDetails) {
    return indicator
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-auto p-1">
          {indicator}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2 flex items-center">
              <AccuracyIcon className="h-4 w-4 mr-2" />
              Accuracy Level: {accuracyConfig.label}
            </h4>
            <p className="text-sm text-gray-600">{accuracyConfig.description}</p>
          </div>

          <div>
            <h4 className="font-semibold mb-2 flex items-center">
              <SourceIcon className="h-4 w-4 mr-2" />
              Data Source: {sourceConfig.label}
            </h4>
            <p className="text-sm text-gray-600">{sourceConfig.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Last Updated:</span>
              <br />
              {new Date(positionData.timestamp).toLocaleString()}
            </div>
            <div>
              <span className="font-medium">Cache Status:</span>
              <br />
              {positionData.cached
                ? `Cached (${formatCacheAge(positionData.cacheAge)})`
                : 'Live Data'}
            </div>
          </div>

          {positionData.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center text-red-600 mb-1">
                <AlertTriangle className="h-4 w-4 mr-1" />
                <span className="font-medium">Error Detected</span>
              </div>
              <p className="text-sm text-red-600">{positionData.error}</p>
            </div>
          )}

          <div className="text-xs text-gray-500 border-t pt-2">
            This indicator shows the reliability and freshness of planetary position data. Higher
            accuracy levels provide more precise astrological calculations.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default PlanetaryPositionIndicator
