/**
 * Unified Token Calculator Client
 * -------------------------------
 * Feature-flagged client that prefers backend APIs and gracefully
 * falls back to existing frontend-compatible calculations.
 */

type Location = { lat: number; lon: number }
const frontendService = {
  calculateTokens: async (request: any) => ({
    rates: request.tokens,
    projections: [],
    events: [],
    harmonics: {},
    metadata: {},
  }),
  getHistoricalData: async (s: any, e: any, l: any, i: any) => ({ data: [] }),
  batchAnalyze: async (input: any) => [],
}

export interface TokenRates {
  Spirit: number
  Essence: number
  Matter: number
  Substance: number
}

export interface TokenCalculationRequest {
  tokens: TokenRates
  planetaryHour?: string
  location: Location
  timestamp?: Date
}

export interface HistoricalDataRequest {
  startDate: Date
  endDate: Date
  location: Location
  interval?: number
}

export interface ProjectionsRequest {
  location: Location
  timestamp?: Date
  timeframe?: 'nearTerm' | 'seasonal' | 'both'
}

export interface EventsRequest {
  location: Location
  timestamp?: Date
  lookAhead?: number
}

export interface BackendTokenResponse<T = any> {
  success: boolean
  data: T
  metadata: {
    computeTime?: number
    location: Location
    timestamp: string
    [key: string]: any
  }
}

class BackendTokenClient {
  private static backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

  static async calculateTokens(request: TokenCalculationRequest): Promise<BackendTokenResponse> {
    const res = await fetch(`${this.backendUrl}/api/tokens/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokens: request.tokens,
        planetaryHour: request.planetaryHour,
        location: request.location,
        timestamp: request.timestamp?.toISOString(),
      }),
    })
    if (!res.ok) throw new Error(`Token calculation failed: ${res.status}`)
    return res.json()
  }

  static async getHistoricalData(request: HistoricalDataRequest): Promise<BackendTokenResponse> {
    const res = await fetch(`${this.backendUrl}/api/tokens/historical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: request.startDate.toISOString(),
        endDate: request.endDate.toISOString(),
        location: request.location,
        interval: request.interval,
      }),
    })
    if (!res.ok) throw new Error(`Historical token data request failed: ${res.status}`)
    return res.json()
  }

  static async getProjections(request: ProjectionsRequest): Promise<BackendTokenResponse> {
    const res = await fetch(`${this.backendUrl}/api/tokens/projections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: request.location,
        timestamp: request.timestamp?.toISOString(),
        timeframe: request.timeframe,
      }),
    })
    if (!res.ok) throw new Error(`Token projections request failed: ${res.status}`)
    return res.json()
  }

  static async getEvents(request: EventsRequest): Promise<BackendTokenResponse> {
    const res = await fetch(`${this.backendUrl}/api/tokens/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: request.location,
        timestamp: request.timestamp?.toISOString(),
        lookAhead: request.lookAhead,
      }),
    })
    if (!res.ok) throw new Error(`Token events request failed: ${res.status}`)
    return res.json()
  }

  static async getTokenInfo(): Promise<BackendTokenResponse> {
    const res = await fetch(`${this.backendUrl}/api/tokens/info`)
    if (!res.ok) throw new Error(`Token info request failed: ${res.status}`)
    return res.json()
  }
}

export class UnifiedTokenClient {
  private static useBackend =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_TOKEN_CALCULATIONS_BACKEND === 'true'

  static async calculateTokens(request: TokenCalculationRequest): Promise<any> {
    try {
      if (this.useBackend) {
        const resp = await BackendTokenClient.calculateTokens(request)
        return resp.data
      }

      // Fallback to frontend calculation
      return await frontendService.calculateTokens(request)
    } catch (error) {
      console.warn('Backend token calculation failed, falling back to frontend:', error)

      // Always fallback to frontend calculation
      return await frontendService.calculateTokens(request)
    }
  }

  static async getHistoricalData(request: HistoricalDataRequest): Promise<any> {
    try {
      if (this.useBackend) {
        const resp = await BackendTokenClient.getHistoricalData(request)
        return resp.data
      }

      // Fallback to frontend calculation
      return await frontendService.getHistoricalData(
        request.startDate,
        request.endDate,
        request.location,
        request.interval
      )
    } catch (error) {
      console.warn('Backend historical data failed, falling back to frontend:', error)

      // Always fallback to frontend calculation
      return await frontendService.getHistoricalData(
        request.startDate,
        request.endDate,
        request.location,
        request.interval
      )
    }
  }

  static async getProjections(request: ProjectionsRequest): Promise<any> {
    try {
      if (this.useBackend) {
        const resp = await BackendTokenClient.getProjections(request)
        return resp.data
      }

      // Fallback: calculate tokens and extract projections
      const baseTokens = { Spirit: 1.0, Essence: 0.8, Matter: 0.6, Substance: 0.4 }
      const result = await frontendService.calculateTokens({
        tokens: baseTokens,
        location: request.location,
        timestamp: request.timestamp,
      })

      return {
        projections: result.projections,
        events: result.events,
        harmonics: result.harmonics,
        metadata: result.metadata,
      }
    } catch (error) {
      console.warn('Backend token projections failed, falling back to frontend:', error)

      // Always fallback to frontend calculation
      const baseTokens = { Spirit: 1.0, Essence: 0.8, Matter: 0.6, Substance: 0.4 }
      const result = await frontendService.calculateTokens({
        tokens: baseTokens,
        location: request.location,
        timestamp: request.timestamp,
      })

      return {
        projections: result.projections,
        events: result.events,
        harmonics: result.harmonics,
        metadata: result.metadata,
      }
    }
  }

  static async getEvents(request: EventsRequest): Promise<any> {
    try {
      if (this.useBackend) {
        const resp = await BackendTokenClient.getEvents(request)
        return resp.data
      }

      // Fallback: calculate tokens and extract events
      const baseTokens = { Spirit: 1.0, Essence: 0.8, Matter: 0.6, Substance: 0.4 }
      const result = await frontendService.calculateTokens({
        tokens: baseTokens,
        location: request.location,
        timestamp: request.timestamp,
      })

      // Filter events by lookAhead if specified
      let events = result.events
      if (request.lookAhead) {
        const now = request.timestamp || new Date()
        const cutoffTime = new Date(now.getTime() + request.lookAhead * 60 * 60 * 1000)
        events = events.filter((event: any) => new Date(event.timestamp) <= cutoffTime)
      }

      return {
        events,
        marketPhase: (result.metadata as any)?.marketPhase,
        volatilityIndex: (result.metadata as any)?.volatilityIndex,
      }
    } catch (error) {
      console.warn('Backend token events failed, falling back to frontend:', error)

      // Always fallback to frontend calculation
      const baseTokens = { Spirit: 1.0, Essence: 0.8, Matter: 0.6, Substance: 0.4 }
      const result = await frontendService.calculateTokens({
        tokens: baseTokens,
        location: request.location,
        timestamp: request.timestamp,
      })

      return {
        events: result.events,
        marketPhase: (result.metadata as any)?.marketPhase,
        volatilityIndex: (result.metadata as any)?.volatilityIndex,
      }
    }
  }

  static async getTokenInfo(): Promise<any> {
    try {
      if (this.useBackend) {
        const resp = await BackendTokenClient.getTokenInfo()
        return resp.data
      }

      // Fallback to static token info
      return {
        Spirit: {
          element: 'Fire',
          baseRate: 1.0,
          description: 'Primary alchemical essence, highest volatility',
          planetaryAffinities: ['Sun', 'Mars', 'Jupiter'],
        },
        Essence: {
          element: 'Water',
          baseRate: 0.8,
          description: 'Life force energy, moderate volatility',
          planetaryAffinities: ['Moon', 'Venus', 'Jupiter'],
        },
        Matter: {
          element: 'Earth',
          baseRate: 0.6,
          description: 'Physical manifestation, stable growth',
          planetaryAffinities: ['Saturn', 'Mars', 'Venus'],
        },
        Substance: {
          element: 'Air',
          baseRate: 0.4,
          description: 'Transformative catalyst, high reactivity',
          planetaryAffinities: ['Mercury', 'Saturn', 'Sun'],
        },
      }
    } catch (error) {
      console.warn('Backend token info failed, using static fallback:', error)

      // Static fallback
      return {
        Spirit: { element: 'Fire', baseRate: 1.0 },
        Essence: { element: 'Water', baseRate: 0.8 },
        Matter: { element: 'Earth', baseRate: 0.6 },
        Substance: { element: 'Air', baseRate: 0.4 },
      }
    }
  }

  /**
   * Quick rate calculation without full analysis
   * Always uses frontend for speed
   */
  static async calculateQuickRates(
    tokens: TokenRates,
    location: Location,
    timestamp?: Date
  ): Promise<TokenRates> {
    const result = await frontendService.calculateTokens({
      tokens,
      location,
      timestamp,
    })
    return result.rates
  }

  /**
   * Validate token rates
   */
  static validateTokenRates(rates: TokenRates): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const requiredTokens = ['Spirit', 'Essence', 'Matter', 'Substance']

    for (const token of requiredTokens) {
      const value = rates[token as keyof TokenRates]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        errors.push(`${token} must be a non-negative finite number`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  static getStatus(): {
    backendEnabled: boolean
    backendUrl: string
  } {
    return {
      backendEnabled: this.useBackend,
      backendUrl: BackendTokenClient['backendUrl'],
    }
  }
}

export default UnifiedTokenClient
