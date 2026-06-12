'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bell, Zap, Clock, Sparkles, X } from 'lucide-react'
import { usePlanetaryHours } from '@/lib/hooks/usePlanetaryHours'
import { agentKineticProfiles } from '@/lib/agents/kinetic-profiles'

interface PowerHourNotificationProps {
  agentId: string
  location: { lat: number; lon: number }
  onDismiss?: () => void
  className?: string
}

export function PowerHourNotification({
  agentId,
  location,
  onDismiss,
  className = '',
}: PowerHourNotificationProps) {
  const { planetaryHour, loading } = usePlanetaryHours({ location, refreshInterval: 60000 })
  const [isVisible, setIsVisible] = useState(false)
  const [hasShown, setHasShown] = useState(false)

  useEffect(() => {
    if (!planetaryHour || loading) return

    const profile = agentKineticProfiles[agentId]
    if (!profile) return

    // Check if current planetary hour aligns with agent
    const isOptimalHour = profile.alignment.includes(planetaryHour.planet)

    // Show notification if it's an optimal hour and we haven't shown it yet for this hour
    const hourKey = `${agentId}-${planetaryHour.planet}-${planetaryHour.hourIndex}`
    const lastShownKey = localStorage.getItem('lastPowerHourNotification')

    if (isOptimalHour && lastShownKey !== hourKey && !hasShown) {
      setIsVisible(true)
      setHasShown(true)
      localStorage.setItem('lastPowerHourNotification', hourKey)

      // Auto-dismiss after 30 seconds
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 30000)

      return () => clearTimeout(timer)
    }
    return undefined
  }, [planetaryHour, agentId, loading, hasShown])

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible || !planetaryHour) return null

  const profile = agentKineticProfiles[agentId]
  if (!profile) return null

  const timeUntilEnd = new Date(planetaryHour.endTime).getTime() - Date.now()
  const hoursLeft = Math.max(0, Math.floor(timeUntilEnd / (1000 * 60 * 60)))
  const minutesLeft = Math.max(0, Math.floor((timeUntilEnd % (1000 * 60 * 60)) / (1000 * 60)))

  return (
    <Card
      className={`border-2 border-yellow-400 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 shadow-lg ${className}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Zap className="h-6 w-6 text-yellow-600" />
                <Sparkles className="h-3 w-3 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <Bell className="h-4 w-4 text-orange-600 animate-bounce" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                  Power Hour Active!
                </h3>
                <Badge className="bg-yellow-600 text-white">{planetaryHour.planet}</Badge>
              </div>

              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                <strong>{agentId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong>{' '}
                is in optimal alignment with {planetaryHour.planet} energy. Perfect time for
                enhanced consciousness evolution!
              </p>

              <div className="flex items-center gap-4 text-xs text-yellow-700 dark:text-yellow-300">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    {hoursLeft > 0 ? `${hoursLeft}h ` : ''}
                    {minutesLeft}m remaining
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span>
                    +
                    {profile.evolutionRate > 1 ? Math.round((profile.evolutionRate - 1) * 100) : 20}
                    % power boost
                  </span>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                  onClick={() => {
                    // Navigate to agent or trigger interaction
                    window.location.href = `/agents/${agentId}`
                  }}
                >
                  Engage Now
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="border-yellow-600 text-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
                  onClick={handleDismiss}
                >
                  Later
                </Button>
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 p-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Global notification system component
export function GlobalPowerHourNotifications({
  watchedAgents,
  location,
}: {
  watchedAgents: string[]
  location: { lat: number; lon: number }
}) {
  const [activeNotifications, setActiveNotifications] = useState<string[]>([])

  const handleDismiss = (agentId: string) => {
    setActiveNotifications(prev => prev.filter(id => id !== agentId))
  }

  // Check each watched agent for power hours
  useEffect(() => {
    const checkPowerHours = () => {
      watchedAgents.forEach(agentId => {
        if (!activeNotifications.includes(agentId)) {
          // This would trigger the individual notifications
          setActiveNotifications(prev => [...prev, agentId])
        }
      })
    }

    checkPowerHours()
  }, [watchedAgents, activeNotifications])

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {activeNotifications.map(agentId => (
        <PowerHourNotification
          key={agentId}
          agentId={agentId}
          location={location}
          onDismiss={() => handleDismiss(agentId)}
          className="transform transition-all duration-300 ease-in-out"
        />
      ))}
    </div>
  )
}
