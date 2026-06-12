// Unified Galileo Service - Consolidates all logging functionality
// Replaces: galileo-sdk-logger, galileo-direct-client, galileo-client, galileo-adapter

import { circuitBreaker, withRetries } from './resilience'

interface GalileoConfig {
  apiKey: string
  project: string
  stream: string
  baseUrl?: string
  failSilently?: boolean
}

interface LogEntry {
  message: string
  level: 'info' | 'warn' | 'error' | 'debug'
  metadata?: Record<string, any>
  timestamp?: string
}

interface SessionData {
  id: string
  name: string
  traces: any[]
  metadata?: Record<string, any>
}

export class UnifiedGalileoService {
  private config: GalileoConfig
  private fallbackLogs: LogEntry[] = []
  private maxFallbackLogs = 1000

  constructor(config: Partial<GalileoConfig>) {
    this.config = {
      apiKey: config.apiKey || process.env.GALILEO_API_KEY || '',
      project: config.project || process.env.GALILEO_PROJECT || 'AlchmPlanetaryAgents',
      stream: config.stream || process.env.GALILEO_LOG_STREAM || 'default',
      baseUrl: config.baseUrl || 'https://console.rungalileo.io/api',
      failSilently: config.failSilently || process.env.GALILEO_FAIL_SILENTLY === 'true',
    }
  }

  // Main logging method with circuit breaker and retries
  async log(entry: LogEntry): Promise<boolean> {
    if (!this.config.apiKey) {
      if (!this.config.failSilently) {
        console.warn('Galileo API key not configured, logging to console')
      }
      this.logToConsole(entry)
      return false
    }

    try {
      const result = await withRetries(
        () => circuitBreaker(() => this.sendToGalileo(entry)),
        3,
        1000
      )
      return result
    } catch (error) {
      this.handleLogError(error, entry)
      return false
    }
  }

  // Session logging with structured traces
  async logSession(sessionData: SessionData): Promise<boolean> {
    if (!this.config.apiKey) {
      this.logToConsole({
        message: `Session: ${sessionData.name}`,
        level: 'info',
        metadata: { sessionId: sessionData.id, traces: sessionData.traces.length },
      })
      return false
    }

    try {
      const result = await withRetries(
        () => circuitBreaker(() => this.sendSessionToGalileo(sessionData)),
        3,
        1000
      )
      return result
    } catch (error) {
      this.handleSessionError(error, sessionData)
      return false
    }
  }

  // Quantities-specific logging (replaces galileo-quantities-tracker)
  async logQuantities(
    quantities: Record<string, number>,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    return this.log({
      message: 'Alchemical quantities calculated',
      level: 'info',
      metadata: {
        quantities,
        ...metadata,
        component: 'alchemizer',
      },
    })
  }

  // Agent-specific logging
  async logAgentInteraction(
    agentId: string,
    input: any,
    output: any,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    return this.log({
      message: `Agent interaction: ${agentId}`,
      level: 'info',
      metadata: {
        agentId,
        input: typeof input === 'object' ? JSON.stringify(input) : input,
        output: typeof output === 'object' ? JSON.stringify(output) : output,
        ...metadata,
        component: 'agent-system',
      },
    })
  }

  // Batch logging for performance
  async logBatch(entries: LogEntry[]): Promise<boolean[]> {
    if (!this.config.apiKey) {
      entries.forEach(entry => this.logToConsole(entry))
      return entries.map(() => false)
    }

    try {
      const results = await Promise.allSettled(entries.map(entry => this.log(entry)))
      return results.map(result => (result.status === 'fulfilled' ? result.value : false))
    } catch (error) {
      console.error('Batch logging failed:', error)
      return entries.map(() => false)
    }
  }

  // Private methods
  private async sendToGalileo(entry: LogEntry): Promise<boolean> {
    const payload = {
      timestamp: entry.timestamp || new Date().toISOString(),
      project: this.config.project,
      stream: this.config.stream,
      message: entry.message,
      level: entry.level,
      metadata: {
        ...entry.metadata,
        source: 'planetary-agents',
      },
    }

    const response = await fetch(`${this.config.baseUrl}/logs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')

      // Handle specific 422 error for project type
      if (response.status === 422 && errorText.includes('not of type Observe')) {
        const message = `Galileo API error: 422 unknown - ${errorText}`
        if (this.config.failSilently) {
          // Completely silent when failSilently is enabled
          return false
        }
        throw new Error(
          `${message}\nHint: Configure GALILEO_PROJECT as an Observe project or set GALILEO_FAIL_SILENTLY=true`
        )
      }

      throw new Error(`Galileo API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return true
  }

  private async sendSessionToGalileo(sessionData: SessionData): Promise<boolean> {
    const payload = {
      ...sessionData,
      project: this.config.project,
      stream: this.config.stream,
      timestamp: new Date().toISOString(),
    }

    const response = await fetch(`${this.config.baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(
        `Galileo Session API error: ${response.status} ${response.statusText} - ${errorText}`
      )
    }

    return true
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp || new Date().toISOString()
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`

    switch (entry.level) {
      case 'error':
        console.error(prefix, entry.message, entry.metadata)
        break
      case 'warn':
        console.warn(prefix, entry.message, entry.metadata)
        break
      case 'debug':
        console.debug(prefix, entry.message, entry.metadata)
        break
      default:
        console.log(prefix, entry.message, entry.metadata)
    }
  }

  private handleLogError(error: any, entry: LogEntry): void {
    if (this.config.failSilently) {
      console.warn('Galileo logging failed, falling back to console:', error.message)
      this.logToConsole(entry)
    } else {
      // Store in fallback buffer
      if (this.fallbackLogs.length >= this.maxFallbackLogs) {
        this.fallbackLogs.shift() // Remove oldest
      }
      this.fallbackLogs.push(entry)

      console.error('Galileo logging failed:', error)
      this.logToConsole(entry)
    }
  }

  private handleSessionError(error: any, sessionData: SessionData): void {
    console.error('Galileo session logging failed:', error)
    this.logToConsole({
      message: `Session failed to log: ${sessionData.name}`,
      level: 'error',
      metadata: { sessionId: sessionData.id, error: error.message },
    })
  }

  // Utility methods
  getFallbackLogs(): LogEntry[] {
    return [...this.fallbackLogs]
  }

  clearFallbackLogs(): void {
    this.fallbackLogs = []
  }

  getConfig(): GalileoConfig {
    return { ...this.config }
  }
}

// Singleton instance
export const galileoService = new UnifiedGalileoService({})

// Convenience functions
export const logInfo = (message: string, metadata?: Record<string, any>) =>
  galileoService.log({ message, level: 'info', metadata })

export const logError = (message: string, metadata?: Record<string, any>) =>
  galileoService.log({ message, level: 'error', metadata })

export const logWarn = (message: string, metadata?: Record<string, any>) =>
  galileoService.log({ message, level: 'warn', metadata })

export const logQuantities = (quantities: Record<string, number>, metadata?: Record<string, any>) =>
  galileoService.logQuantities(quantities, metadata)

export const logAgentInteraction = (
  agentId: string,
  input: any,
  output: any,
  metadata?: Record<string, any>
) => galileoService.logAgentInteraction(agentId, input, output, metadata)
