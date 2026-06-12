/**
 * Unified Planetary Hours Client
 * -----------------------------
 * Feature-flagged client that prefers backend APIs and gracefully
 * falls back to existing frontend-compatible calculations.
 */

// Frontend fallback calculations
interface Location {
  lat: number
  lon: number
}

// Simplified planetary hour calculation for fallback
async function calculatePlanetaryHourFallback(datetime: Date, location: Location) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayName = dayNames[datetime.getDay()]

  const planetaryHours = {
    Sunday: ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'],
    Monday: ['Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury'],
    Tuesday: ['Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter'],
    Wednesday: ['Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus'],
    Thursday: ['Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn'],
    Friday: ['Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun'],
    Saturday: ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'],
  } as const

  const hourIndex = Math.floor(datetime.getHours() / 3.4) % 7
  const planet = planetaryHours[dayName as keyof typeof planetaryHours][hourIndex]

  return {
    planet,
    dayType: datetime.getHours() >= 6 && datetime.getHours() < 18 ? 'day' : 'night',
    hourIndex,
    startTime: new Date(datetime.getTime() - (datetime.getHours() % 3.4) * 60 * 60 * 1000),
    endTime: new Date(datetime.getTime() + (3.4 - (datetime.getHours() % 3.4)) * 60 * 60 * 1000),
    nextTransition: new Date(
      datetime.getTime() + (3.4 - (datetime.getHours() % 3.4)) * 60 * 60 * 1000
    ),
    modifiers: { [planet]: 0.2 },
  }
}

// Helper function to calculate planetary influences based on time and planetary hour
function calculatePlanetaryInfluence(datetime: Date, planetaryHour: string) {
  const hour = datetime.getHours()
  const dayOfYear = Math.floor(
    (datetime.getTime() - new Date(datetime.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  )

  // Base influences with seasonal and time-of-day variations
  const seasonal = Math.sin((dayOfYear / 365) * 2 * Math.PI) * 0.3
  const diurnal = Math.cos((hour / 24) * 2 * Math.PI) * 0.2

  // Planetary hour modifiers
  const planetaryModifiers = {
    Sun: {
      spirit: 1.3,
      fire: 1.2,
      air: 1.1,
      essence: 1.0,
      matter: 0.9,
      substance: 0.8,
      water: 0.9,
      earth: 0.8,
    },
    Moon: {
      essence: 1.3,
      water: 1.2,
      spirit: 1.1,
      matter: 1.0,
      substance: 0.9,
      fire: 0.8,
      air: 0.9,
      earth: 0.8,
    },
    Mercury: {
      air: 1.3,
      spirit: 1.2,
      essence: 1.1,
      matter: 1.0,
      substance: 0.9,
      fire: 0.9,
      water: 0.8,
      earth: 0.8,
    },
    Venus: {
      water: 1.3,
      essence: 1.2,
      earth: 1.1,
      spirit: 1.0,
      matter: 0.9,
      substance: 0.8,
      fire: 0.9,
      air: 0.8,
    },
    Mars: {
      fire: 1.3,
      spirit: 1.2,
      matter: 1.1,
      essence: 1.0,
      substance: 0.9,
      water: 0.8,
      air: 0.9,
      earth: 0.8,
    },
    Jupiter: {
      air: 1.3,
      spirit: 1.2,
      fire: 1.1,
      essence: 1.0,
      matter: 0.9,
      substance: 0.8,
      water: 0.9,
      earth: 0.8,
    },
    Saturn: {
      earth: 1.3,
      matter: 1.2,
      substance: 1.1,
      essence: 1.0,
      spirit: 0.9,
      fire: 0.8,
      water: 0.9,
      air: 0.8,
    },
  }

  const modifiers =
    planetaryModifiers[planetaryHour as keyof typeof planetaryModifiers] || planetaryModifiers.Sun

  return {
    spirit: Math.round((1.0 + seasonal + diurnal) * modifiers.spirit * 100) / 100,
    essence: Math.round((1.0 + seasonal * 0.8 + diurnal * 0.6) * modifiers.essence * 100) / 100,
    matter: Math.round((1.0 + seasonal * 0.6 + diurnal * 0.4) * modifiers.matter * 100) / 100,
    substance: Math.round((1.0 + seasonal * 0.4 + diurnal * 0.8) * modifiers.substance * 100) / 100,
    fire: Math.round((1.0 + seasonal + diurnal * 0.7) * modifiers.fire * 100) / 100,
    water: Math.round((1.0 + seasonal * 0.7 + diurnal) * modifiers.water * 100) / 100,
    air: Math.round((1.0 + seasonal * 0.5 + diurnal * 0.9) * modifiers.air * 100) / 100,
    earth: Math.round((1.0 + seasonal * 0.9 + diurnal * 0.5) * modifiers.earth * 100) / 100,
  }
}

export interface PlanetaryHourRequest {
  datetime?: Date
  location: Location
  timezone?: string
}

export interface PlanetaryForecastRequest {
  startDate: Date
  endDate: Date
  location: Location
  interval?: number
}

export interface OptimalTimesRequest {
  date: Date
  location: Location
  targetPlanet: string
}

export interface BackendPlanetaryResponse<T = any> {
  success: boolean
  data: T
  metadata: {
    computeTime: number
    [key: string]: any
  }
}

class BackendPlanetaryClient {
  private static backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

  static async getCurrentHour(request: PlanetaryHourRequest): Promise<BackendPlanetaryResponse> {
    const res = await fetch(`${this.backendUrl}/api/planetary/current-hour`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!res.ok) throw new Error(`Planetary hour request failed: ${res.status}`)
    return res.json()
  }

  static async getForecast(request: PlanetaryForecastRequest): Promise<BackendPlanetaryResponse> {
    const res = await fetch(`${this.backendUrl}/api/planetary/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: request.startDate.toISOString(),
        endDate: request.endDate.toISOString(),
        location: request.location,
        interval: request.interval,
      }),
    })
    if (!res.ok) throw new Error(`Planetary forecast failed: ${res.status}`)
    return res.json()
  }

  static async getOptimalTimes(request: OptimalTimesRequest): Promise<BackendPlanetaryResponse> {
    const res = await fetch(`${this.backendUrl}/api/planetary/optimal-times`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: request.date.toISOString(),
        location: request.location,
        targetPlanet: request.targetPlanet,
      }),
    })
    if (!res.ok) throw new Error(`Optimal times request failed: ${res.status}`)
    return res.json()
  }
}

export class UnifiedPlanetaryClient {
  private static useBackend =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_PLANETARY_HOURS_BACKEND === 'true'

  static async getCurrentPlanetaryHour(request: PlanetaryHourRequest): Promise<any> {
    try {
      if (this.useBackend) {
        const resp = await BackendPlanetaryClient.getCurrentHour(request)
        return resp.data
      }

      // Fallback to simplified frontend calculation
      return await calculatePlanetaryHourFallback(request.datetime || new Date(), request.location)
    } catch (error) {
      console.warn('Backend planetary hours failed, falling back to frontend:', error)

      // Always fallback to frontend calculation
      return await calculatePlanetaryHourFallback(request.datetime || new Date(), request.location)
    }
  }

  static async getForecast(request: PlanetaryForecastRequest): Promise<any> {
    try {
      if (this.useBackend) {
        const resp = await BackendPlanetaryClient.getForecast(request)
        return resp.data
      }

      // Fallback to simplified forecast
      const forecast = []
      const current = new Date(request.startDate)
      const end = request.endDate

      while (current <= end) {
        const planetaryHour = await calculatePlanetaryHourFallback(current, request.location)
        forecast.push({
          datetime: new Date(current),
          planetaryHour,
          influence: calculatePlanetaryInfluence(current, planetaryHour.planet),
        })
        current.setMinutes(current.getMinutes() + (request.interval || 60))
      }

      return forecast
    } catch (error) {
      console.warn('Backend planetary forecast failed, falling back to frontend:', error)

      // Always fallback to simplified calculation
      const forecast = []
      const current = new Date(request.startDate)
      const end = request.endDate

      while (current <= end && forecast.length < 100) {
        // Limit to prevent infinite loops
        const planetaryHour = await calculatePlanetaryHourFallback(current, request.location)
        forecast.push({
          datetime: new Date(current),
          planetaryHour,
          influence: calculatePlanetaryInfluence(current, planetaryHour.planet),
        })
        current.setMinutes(current.getMinutes() + (request.interval || 60))
      }

      return forecast
    }
  }

  static async getOptimalTimes(request: OptimalTimesRequest): Promise<any> {
    try {
      if (this.useBackend) {
        const resp = await BackendPlanetaryClient.getOptimalTimes(request)
        return resp.data
      }

      // Fallback calculation
      const optimalTimes = []
      const startOfDay = new Date(request.date)
      startOfDay.setHours(0, 0, 0, 0)

      // Check each hour of the day
      for (let hour = 0; hour < 24; hour++) {
        const hourTime = new Date(startOfDay.getTime() + hour * 60 * 60 * 1000)
        const planetaryHour = await calculatePlanetaryHourFallback(hourTime, request.location)

        if (planetaryHour.planet === request.targetPlanet) {
          optimalTimes.push(planetaryHour)
        }
      }

      return optimalTimes
    } catch (error) {
      console.warn('Backend optimal times failed, falling back to frontend:', error)

      // Always fallback to simplified calculation
      const optimalTimes = []
      const startOfDay = new Date(request.date)
      startOfDay.setHours(0, 0, 0, 0)

      // Check each hour of the day
      for (let hour = 0; hour < 24; hour++) {
        const hourTime = new Date(startOfDay.getTime() + hour * 60 * 60 * 1000)
        const planetaryHour = await calculatePlanetaryHourFallback(hourTime, request.location)

        if (planetaryHour.planet === request.targetPlanet) {
          optimalTimes.push(planetaryHour)
        }
      }

      return optimalTimes
    }
  }

  static getStatus(): {
    backendEnabled: boolean
    backendUrl: string
  } {
    return {
      backendEnabled: this.useBackend,
      backendUrl: BackendPlanetaryClient['backendUrl'],
    }
  }
}

export default UnifiedPlanetaryClient
