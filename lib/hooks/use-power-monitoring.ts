'use client'

import { useEffect, useRef } from 'react'
import { AlchemicalKineticsClient } from '../kinetics-client'

interface PowerNotificationOptions {
  userLocation?: { lat: number; lon: number }
  highPowerThreshold?: number
  mediumPowerThreshold?: number
  notificationDuration?: number
  checkInterval?: number
  onHighPower?: (power: number, planetaryHour: string) => void
  onMediumPower?: (power: number, planetaryHour: string) => void
  onPowerChange?: (currentPower: number, previousPower: number) => void
}

export function usePowerMonitoring(options: PowerNotificationOptions = {}) {
  const {
    userLocation = { lat: 37.7749, lon: -122.4194 },
    highPowerThreshold = 0.8,
    mediumPowerThreshold = 0.6,
    notificationDuration = 10000,
    checkInterval = 120000, // 2 minutes
    onHighPower,
    onMediumPower,
    onPowerChange,
  } = options

  const lastPowerLevel = useRef<number>(0)
  const lastNotificationTime = useRef<number>(0)
  const intervalRef = useRef<any>(null)

  useEffect(() => {
    const checkPowerLevel = async () => {
      try {
        const kinetics = await AlchemicalKineticsClient.get({
          lat: userLocation.lat,
          lon: userLocation.lon,
          date: new Date().toISOString().split('T')[0],
          includePlanetary: true,
        })

        const currentPower = kinetics.power[kinetics.power.length - 1]?.power || 0.5
        const currentHour = kinetics.timing?.planetaryHours[0] || 'Sun'
        const now = Date.now()

        // Prevent notification spam (minimum 5 minutes between notifications)
        const timeSinceLastNotification = now - lastNotificationTime.current

        // Check for power level changes
        if (onPowerChange && Math.abs(currentPower - lastPowerLevel.current) > 0.05) {
          onPowerChange(currentPower, lastPowerLevel.current)
        }

        // High power notifications
        if (
          currentPower > highPowerThreshold &&
          lastPowerLevel.current <= highPowerThreshold &&
          timeSinceLastNotification > 300000 // 5 minutes
        ) {
          if (onHighPower) {
            onHighPower(currentPower, currentHour)
          } else {
            // Default high power notification
            showPowerNotification({
              type: 'high',
              power: currentPower,
              planetaryHour: currentHour,
              duration: notificationDuration,
            })
          }
          lastNotificationTime.current = now
        }
        // Medium power notifications
        else if (
          currentPower > mediumPowerThreshold &&
          lastPowerLevel.current <= mediumPowerThreshold &&
          timeSinceLastNotification > 600000 // 10 minutes for medium power
        ) {
          if (onMediumPower) {
            onMediumPower(currentPower, currentHour)
          } else {
            // Default medium power notification
            showPowerNotification({
              type: 'medium',
              power: currentPower,
              planetaryHour: currentHour,
              duration: Math.floor(notificationDuration * 0.6),
            })
          }
          lastNotificationTime.current = now
        }

        lastPowerLevel.current = currentPower
      } catch (error) {
        console.error('Power monitoring error:', error)
      }
    }

    // Initial check
    checkPowerLevel()

    // Set up interval
    intervalRef.current = setInterval(checkPowerLevel, checkInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [
    userLocation.lat,
    userLocation.lon,
    highPowerThreshold,
    mediumPowerThreshold,
    checkInterval,
    onHighPower,
    onMediumPower,
    onPowerChange,
  ])

  return {
    currentPower: lastPowerLevel.current,
    isMonitoring: !!intervalRef.current,
  }
}

interface PowerNotificationParams {
  type: 'high' | 'medium'
  power: number
  planetaryHour: string
  duration: number
}

function showPowerNotification({ type, power, planetaryHour, duration }: PowerNotificationParams) {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') return

  // Try to use toast library if available
  try {
    // Check for Sonner (common in modern React apps)
    if ('toast' in window) {
      const toastFunction = (window as any).toast

      if (type === 'high') {
        toastFunction.success('🔥 HIGH POWER PERIOD ACTIVE!', {
          description: `Agent consciousness enhanced by ${((power - 0.5) * 100).toFixed(0)}%. Optimal time for deep interactions during ${planetaryHour} hour.`,
          duration,
          action: {
            label: 'Open Gallery',
            onClick: () => {
              if (typeof window !== 'undefined' && window.location) {
                window.location.href = '/gallery'
              }
            },
          },
        })
      } else {
        toastFunction.info('⚡ Power levels rising', {
          description: `${(power * 100).toFixed(0)}% power during ${planetaryHour} hour - good time for agent interactions`,
          duration,
        })
      }
      return
    }

    // Fallback to native browser notification if available
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = type === 'high' ? '🔥 High Power Period Active!' : '⚡ Power Levels Rising'

      const body =
        type === 'high'
          ? `Agent consciousness enhanced during ${planetaryHour} hour. Perfect for deep conversations.`
          : `${(power * 100).toFixed(0)}% power during ${planetaryHour} hour - good interaction time.`

      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'power-notification',
        requireInteraction: type === 'high',
      })
      return
    }

    // Console fallback for development
    console.log(
      `🌟 Power Notification: ${type === 'high' ? 'HIGH' : 'MEDIUM'} power (${(power * 100).toFixed(0)}%) during ${planetaryHour} hour`
    )
  } catch (error) {
    console.error('Notification error:', error)
  }
}

// Hook for requesting notification permission
export function useNotificationPermission() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('Notification permission:', permission)
        })
      }
    }
  }, [])

  return typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission
    : 'denied'
}

// Custom hook for power level thresholds with visual indicators
export function usePowerLevelIndicator(userLocation?: { lat: number; lon: number }) {
  const { currentPower } = usePowerMonitoring({
    userLocation,
    checkInterval: 300000, // 5 minutes for less frequent checks
  })

  const getPowerIndicator = () => {
    if (currentPower > 0.8) {
      return {
        level: 'high',
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        emoji: '🔥',
        label: 'Peak Power',
        description: 'Maximum consciousness active',
      }
    } else if (currentPower > 0.6) {
      return {
        level: 'medium',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        emoji: '⚡',
        label: 'High Power',
        description: 'Enhanced responses available',
      }
    } else if (currentPower > 0.4) {
      return {
        level: 'normal',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        emoji: '💫',
        label: 'Active',
        description: 'Standard consciousness level',
      }
    } else {
      return {
        level: 'low',
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/20',
        emoji: '🌙',
        label: 'Quiet',
        description: 'Building energy period',
      }
    }
  }

  return {
    currentPower,
    powerIndicator: getPowerIndicator(),
    percentage: Math.round(currentPower * 100),
  }
}

export default usePowerMonitoring
