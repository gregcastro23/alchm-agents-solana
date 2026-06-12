'use client'

import { useState, useEffect } from 'react'

interface PlanetaryHour {
  planet: string
  dayType: 'day' | 'night'
  hourIndex: number
  startTime: Date
  endTime: Date
  nextTransition: Date
  modifiers: Record<string, number>
}

interface UsePlanetaryHoursOptions {
  location: { lat: number; lon: number }
  refreshInterval?: number // milliseconds
}

export function usePlanetaryHours({ location, refreshInterval = 60000 }: UsePlanetaryHoursOptions) {
  const [planetaryHour, setPlanetaryHour] = useState<PlanetaryHour | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    const fetchPlanetaryHour = async () => {
      try {
        setError(null)

        // Check if backend is enabled
        const backendEnabled = process.env.NEXT_PUBLIC_PLANETARY_HOURS_BACKEND === 'true'
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

        if (backendEnabled) {
          // Try backend first
          try {
            const response = await fetch(`${backendUrl}/api/planetary/current-hour`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                datetime: new Date().toISOString(),
                location,
              }),
            })

            if (response.ok) {
              const result = await response.json()
              if (result.success && result.data) {
                // Convert string dates back to Date objects
                const data = result.data
                setPlanetaryHour({
                  ...data,
                  startTime: new Date(data.startTime),
                  endTime: new Date(data.endTime),
                  nextTransition: new Date(data.nextTransition),
                })
                setLastUpdated(new Date())
                setLoading(false)
                return
              }
            }
          } catch (backendError) {
            console.warn('Backend planetary hours failed, falling back to frontend:', backendError)
          }
        }

        // Fallback to frontend calculation
        const fallbackHour = await calculatePlanetaryHourFrontend(location)
        setPlanetaryHour(fallbackHour)
        setLastUpdated(new Date())
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch planetary hour')
        setLoading(false)
      }
    }

    fetchPlanetaryHour()

    // Set up refresh interval
    if (refreshInterval > 0) {
      const interval = setInterval(fetchPlanetaryHour, refreshInterval)
      return () => clearInterval(interval)
    }
    return undefined
  }, [location.lat, location.lon, refreshInterval])

  return {
    planetaryHour,
    loading,
    error,
    lastUpdated,
    refresh: () => {
      setLoading(true)
      // Trigger useEffect by updating a dependency
    },
  }
}

// Simplified frontend fallback calculation
async function calculatePlanetaryHourFrontend(location: {
  lat: number
  lon: number
}): Promise<PlanetaryHour> {
  const now = new Date()
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayName = dayNames[now.getDay()]

  // Simplified planetary hour sequence
  const planetaryHours = {
    Sunday: ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'],
    Monday: ['Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury'],
    Tuesday: ['Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter'],
    Wednesday: ['Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus'],
    Thursday: ['Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn'],
    Friday: ['Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun'],
    Saturday: ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'],
  } as const

  // Simple approximation - each planetary hour is ~3.4 regular hours
  const hourIndex = Math.floor(now.getHours() / 3.4) % 7
  const planet = planetaryHours[dayName as keyof typeof planetaryHours][hourIndex]

  // Approximate start and end times
  const startTime = new Date(now)
  startTime.setHours(Math.floor(hourIndex * 3.4), 0, 0, 0)

  const endTime = new Date(startTime)
  endTime.setHours(Math.floor((hourIndex + 1) * 3.4), 0, 0, 0)

  const nextTransition = new Date(endTime)

  return {
    planet,
    dayType: now.getHours() >= 6 && now.getHours() < 18 ? 'day' : 'night',
    hourIndex,
    startTime,
    endTime,
    nextTransition,
    modifiers: {
      [planet]: 0.2, // Simple 20% boost for current planetary ruler
    },
  }
}
