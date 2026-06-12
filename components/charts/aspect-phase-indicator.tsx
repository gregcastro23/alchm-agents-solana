'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Circle } from 'lucide-react'
// Analyze planetary aspects with kinetics
const analyzeAspectsWithKinetics = async (samples: any[], location: any) => {
  if (!samples || samples.length === 0) {
    return { aspects: [] }
  }

  const aspects = []
  const planets = [
    'Sun',
    'Moon',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Uranus',
    'Neptune',
    'Pluto',
  ]

  // Analyze aspects between all planet pairs
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const planet1 = planets[i]
      const planet2 = planets[j]

      // Get current positions from sample data
      const currentSample = samples[0]
      if (!currentSample || !currentSample.planets) continue

      const pos1 = currentSample.planets[planet1]
      const pos2 = currentSample.planets[planet2]

      if (
        !pos1 ||
        !pos2 ||
        typeof pos1.longitude !== 'number' ||
        typeof pos2.longitude !== 'number'
      )
        continue

      // Calculate angular separation
      let separation = Math.abs(pos1.longitude - pos2.longitude)
      if (separation > 180) separation = 360 - separation

      // Determine aspect type and orb
      const aspectsToCheck = [
        { type: 'conjunction', angle: 0, orb: 8 },
        { type: 'sextile', angle: 60, orb: 6 },
        { type: 'square', angle: 90, orb: 7 },
        { type: 'trine', angle: 120, orb: 8 },
        { type: 'opposition', angle: 180, orb: 8 },
      ]

      for (const aspect of aspectsToCheck) {
        const orb = Math.abs(separation - aspect.angle)
        if (orb <= aspect.orb) {
          // Calculate aspect phase (applying, exact, separating)
          let status: 'applying' | 'exact' | 'separating' = 'exact'
          let rate = 0

          if (samples.length > 1) {
            // Calculate movement rate
            const prevSample = samples[1]
            if (prevSample && prevSample.planets) {
              const prevPos1 = prevSample.planets[planet1]
              const prevPos2 = prevSample.planets[planet2]

              if (prevPos1 && prevPos2) {
                const prevSeparation = Math.abs(prevPos1.longitude - prevPos2.longitude)
                const prevAdjustedSeparation =
                  prevSeparation > 180 ? 360 - prevSeparation : prevSeparation
                const movement = separation - prevAdjustedSeparation

                if (Math.abs(orb) < 1) {
                  status = 'exact'
                } else if (
                  (movement > 0 && separation < aspect.angle) ||
                  (movement < 0 && separation > aspect.angle)
                ) {
                  status = 'applying'
                } else {
                  status = 'separating'
                }

                rate = Math.abs(movement)
              }
            }
          }

          aspects.push({
            planet1,
            planet2,
            type: aspect.type,
            status,
            orb: separation - aspect.angle, // Signed orb
            rate: rate || 0.1, // Default rate if unable to calculate
          })

          break // Only add the closest aspect
        }
      }
    }
  }

  return { aspects }
}
// Browser-safe replacement for the deleted `sampleHourlyAlchm`. Uses the
// `/api/astrologize/bulk` proxy to fetch planetary positions over a small
// time window. Returns samples in the legacy shape `{ planets: { [name]: { longitude } } }`.
// Positions-only is the intended shape: the backend doesn't emit
// elemental decomposition (it's ESMS-native), so this indicator works
// off longitudes alone. No elemental augmentation is pending.
async function sampleHourlyAlchm(
  location: { latitude: number; longitude: number },
  end: Date,
  opts: { hoursToSample?: number; includePlanetaryHours?: boolean } = {}
): Promise<Array<{ planets: Record<string, { longitude: number }> }>> {
  const hours = opts.hoursToSample ?? 3
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000)
  try {
    const res = await fetch('/api/astrologize/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        intervalHours: 1,
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const list: any[] = Array.isArray(data?.samples)
      ? data.samples
      : Array.isArray(data?.snapshots)
        ? data.snapshots
        : Array.isArray(data)
          ? data
          : []
    // Normalise into { planets: { Name: { longitude } } } and reverse so [0] is most recent
    const samples = list
      .map((entry: any) => {
        const planetsRaw = entry?.planetary_positions || entry?.planets || {}
        const planets: Record<string, { longitude: number }> = {}
        Object.entries(planetsRaw).forEach(([name, body]: [string, any]) => {
          const lon = body?.exactLongitude ?? body?.longitude
          if (typeof lon === 'number') planets[name] = { longitude: lon }
        })
        return { planets }
      })
      .reverse()
    return samples
  } catch (err) {
    console.error('sampleHourlyAlchm proxy fetch failed:', err)
    return []
  }
}

interface AspectPhaseIndicatorProps {
  planet1: string
  planet2: string
  location?: { latitude: number; longitude: number }
  className?: string
}

export function AspectPhaseIndicator({
  planet1,
  planet2,
  location = { latitude: 37.7749, longitude: -122.4194 },
  className = '',
}: AspectPhaseIndicatorProps) {
  const [aspectData, setAspectData] = useState<{
    type: string
    phase: 'applying' | 'exact' | 'separating'
    orb: number
    rate: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAspect = async () => {
      try {
        setLoading(true)

        // Sample alchemical data for aspect analysis
        const samples = await sampleHourlyAlchm(location, new Date(), {
          hoursToSample: 3,
          includePlanetaryHours: true,
        })

        if (!samples || samples.length === 0) {
          setAspectData(null)
          return
        }

        // Analyze aspects with kinetics
        const analysis = await analyzeAspectsWithKinetics(samples, location)

        // Check if aspects data is available
        if (!analysis || !analysis.aspects || !Array.isArray(analysis.aspects)) {
          setAspectData(null)
          return
        }

        // Find the aspect between our two planets
        const relevantAspect = analysis.aspects.find(
          a =>
            (a.planet1 === planet1 && a.planet2 === planet2) ||
            (a.planet1 === planet2 && a.planet2 === planet1)
        )

        if (relevantAspect) {
          setAspectData({
            type: relevantAspect.type,
            phase: relevantAspect.status,
            orb: Math.abs(relevantAspect.orb),
            rate: relevantAspect.rate,
          })
        } else {
          setAspectData(null)
        }
      } catch (error) {
        console.error('Error checking aspect phase:', error)
        setAspectData(null)
      } finally {
        setLoading(false)
      }
    }

    checkAspect()
    // Refresh every 5 minutes
    const interval = setInterval(checkAspect, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [planet1, planet2, location.latitude, location.longitude])

  if (loading) {
    return (
      <Badge variant="outline" className={className}>
        <Circle className="w-3 h-3 mr-1 animate-pulse" />
        Calculating...
      </Badge>
    )
  }

  if (!aspectData) {
    return null
  }

  const getPhaseIcon = () => {
    switch (aspectData.phase) {
      case 'applying':
        return <TrendingDown className="w-3 h-3 mr-1 text-blue-500" />
      case 'exact':
        return <Circle className="w-3 h-3 mr-1 text-green-500" />
      case 'separating':
        return <TrendingUp className="w-3 h-3 mr-1 text-orange-500" />
    }
  }

  const getPhaseColor = () => {
    switch (aspectData.phase) {
      case 'applying':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
      case 'exact':
        return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
      case 'separating':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
    }
  }

  const getPhaseDescription = () => {
    const orbText = `${aspectData.orb.toFixed(1)}°`
    const rateText =
      Math.abs(aspectData.rate) > 0.01 ? ` (${Math.abs(aspectData.rate).toFixed(2)}°/hr)` : ''

    switch (aspectData.phase) {
      case 'applying':
        return `Building ${aspectData.type} - ${orbText}${rateText}`
      case 'exact':
        return `Exact ${aspectData.type} - ${orbText}`
      case 'separating':
        return `Waning ${aspectData.type} - ${orbText}${rateText}`
    }
  }

  return (
    <Badge className={`${getPhaseColor()} ${className}`}>
      {getPhaseIcon()}
      {getPhaseDescription()}
    </Badge>
  )
}

export function AspectPhaseWidget({
  planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'],
  location = { latitude: 37.7749, longitude: -122.4194 },
  className = '',
}: {
  planets?: string[]
  location?: { latitude: number; longitude: number }
  className?: string
}) {
  const [aspects, setAspects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const analyzeAllAspects = async () => {
      try {
        setLoading(true)

        // Sample alchemical data for aspect analysis
        const samples = await sampleHourlyAlchm(location, new Date(), {
          hoursToSample: 3,
          includePlanetaryHours: true,
        })

        if (!samples || samples.length === 0) {
          setAspects([])
          return
        }

        // Analyze aspects with kinetics
        const analysis = await analyzeAspectsWithKinetics(samples, location)

        // Check if aspects data is available
        if (!analysis || !analysis.aspects || !Array.isArray(analysis.aspects)) {
          setAspects([])
          return
        }

        // Filter for aspects involving our selected planets
        const relevantAspects = analysis.aspects.filter(
          a => planets.includes(a.planet1) || planets.includes(a.planet2)
        )

        // Sort by orb (closest to exact first)
        relevantAspects.sort((a, b) => Math.abs(a.orb) - Math.abs(b.orb))

        setAspects(relevantAspects.slice(0, 5)) // Show top 5
      } catch (error) {
        console.error('Error analyzing aspects:', error)
        setAspects([])
      } finally {
        setLoading(false)
      }
    }

    analyzeAllAspects()
    // Refresh every 5 minutes
    const interval = setInterval(analyzeAllAspects, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [planets.join(','), location.latitude, location.longitude])

  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <h3 className="text-sm font-semibold">Aspect Dynamics</h3>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            <Circle className="w-3 h-3 mr-1 animate-pulse" />
            Calculating aspects...
          </Badge>
        </div>
      </div>
    )
  }

  if (aspects.length === 0) {
    return null
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-sm font-semibold">Active Aspect Dynamics</h3>
      <div className="flex flex-wrap gap-2">
        {aspects.map((aspect, idx) => (
          <AspectPhaseIndicator
            key={idx}
            planet1={aspect.planet1}
            planet2={aspect.planet2}
            location={location}
          />
        ))}
      </div>
    </div>
  )
}
