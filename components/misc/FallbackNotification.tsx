'use client'

import React, { useState, useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, X, Info, CheckCircle, Clock, Wifi, WifiOff, RefreshCw } from 'lucide-react'

interface FallbackNotificationProps {
  isVisible: boolean
  accuracy: 'high' | 'medium' | 'low' | 'fallback'
  source: 'external-api' | 'enhanced-calculator' | 'basic-transits' | 'static-fallback'
  error?: string
  onDismiss?: () => void
  onRetry?: () => void
  autoHide?: boolean
  autoHideDelay?: number
}

const FallbackNotification: React.FC<FallbackNotificationProps> = ({
  isVisible,
  accuracy,
  source,
  error,
  onDismiss,
  onRetry,
  autoHide = true,
  autoHideDelay = 10000,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [countdown, setCountdown] = useState(autoHideDelay / 1000)

  useEffect(() => {
    if (!isVisible || !autoHide) return

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onDismiss?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isVisible, autoHide, onDismiss])

  const getNotificationConfig = () => {
    switch (accuracy) {
      case 'high':
        return {
          variant: 'default' as const,
          icon: CheckCircle,
          title: 'High Accuracy Active',
          message: 'Real-time planetary positions with maximum precision',
          bgColor: 'bg-green-50 border-green-200',
          textColor: 'text-green-800',
        }
      case 'medium':
        return {
          variant: 'default' as const,
          icon: Info,
          title: 'Enhanced Accuracy Active',
          message: 'Advanced astronomical calculations providing reliable data',
          bgColor: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-800',
        }
      case 'low':
        return {
          variant: 'default' as const,
          icon: Clock,
          title: 'Basic Accuracy Active',
          message: 'Standard calculations providing functional astrology data',
          bgColor: 'bg-yellow-50 border-yellow-200',
          textColor: 'text-yellow-800',
        }
      case 'fallback':
        return {
          variant: 'destructive' as const,
          icon: AlertTriangle,
          title: 'Fallback Mode Active',
          message: 'Using pre-calculated data due to service unavailability',
          bgColor: 'bg-red-50 border-red-200',
          textColor: 'text-red-800',
        }
    }
  }

  const getSourceInfo = () => {
    switch (source) {
      case 'external-api':
        return { icon: Wifi, label: 'Professional API', status: 'Connected' }
      case 'enhanced-calculator':
        return { icon: RefreshCw, label: 'Enhanced Calculator', status: 'Active' }
      case 'basic-transits':
        return { icon: Clock, label: 'Basic Transits', status: 'Active' }
      case 'static-fallback':
        return { icon: WifiOff, label: 'Static Data', status: 'Offline Mode' }
    }
  }

  if (!isVisible) return null

  const config = getNotificationConfig()
  const sourceInfo = getSourceInfo()
  const Icon = config.icon
  const SourceIcon = sourceInfo.icon

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-md ${config.bgColor} border rounded-lg shadow-lg`}
    >
      <Alert className={`${config.bgColor} border-0`}>
        <Icon className={`h-4 w-4 ${config.textColor}`} />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`font-semibold ${config.textColor}`}>{config.title}</span>
              <Badge variant="outline" className="text-xs">
                <SourceIcon className="h-3 w-3 mr-1" />
                {sourceInfo.label}
              </Badge>
            </div>

            <div className="flex items-center space-x-2">
              {autoHide && countdown > 0 && (
                <span className="text-xs text-gray-500">Auto-hide in {countdown}s</span>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 p-0"
              >
                <Info className="h-3 w-3" />
              </Button>

              {onDismiss && (
                <Button variant="ghost" size="sm" onClick={onDismiss} className="h-6 w-6 p-0">
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          <AlertDescription className={`${config.textColor} mt-1`}>
            {config.message}
          </AlertDescription>

          {isExpanded && (
            <div className="mt-3 space-y-3">
              {/* Source Status */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Data Source:</span>
                <div className="flex items-center space-x-1">
                  <SourceIcon className="h-3 w-3" />
                  <span>{sourceInfo.status}</span>
                </div>
              </div>

              {/* Accuracy Level */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Accuracy Level:</span>
                <Badge
                  className={
                    accuracy === 'high'
                      ? 'bg-green-500'
                      : accuracy === 'medium'
                        ? 'bg-blue-500'
                        : accuracy === 'low'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                  }
                >
                  {accuracy.toUpperCase()}
                </Badge>
              </div>

              {/* Error Details */}
              {error && (
                <div className="p-2 bg-red-100 border border-red-200 rounded text-sm">
                  <div className="flex items-center text-red-600 mb-1">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    <span className="font-medium">Issue Details</span>
                  </div>
                  <p className="text-red-700 text-xs">{error}</p>
                </div>
              )}

              {/* Impact Explanation */}
              <div className="text-xs text-gray-600">
                {accuracy === 'fallback' ? (
                  <p>
                    Astrology calculations will use pre-calculated planetary positions. Results may
                    be less accurate for current timing but remain functional.
                  </p>
                ) : (
                  <p>
                    Your astrology experience is optimized with {accuracy} accuracy data. All
                    features remain fully functional.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2 pt-2">
                {onRetry && accuracy === 'fallback' && (
                  <Button onClick={onRetry} size="sm" variant="outline" className="text-xs">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Try Again
                  </Button>
                )}

                <Button
                  onClick={() => setIsExpanded(false)}
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                >
                  Hide Details
                </Button>
              </div>
            </div>
          )}
        </div>
      </Alert>
    </div>
  )
}

export default FallbackNotification
