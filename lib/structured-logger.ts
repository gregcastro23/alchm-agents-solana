/**
 * Structured Logging System for Planetary Agents
 * ==============================================
 *
 * Production-ready logging with structured data, log levels, and performance monitoring.
 * Replaces console.log/error throughout the application for better observability.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LogContext {
  system?: string
  operation?: string
  userId?: string
  agentId?: string
  sessionId?: string
  requestId?: string
  duration?: number
  metadata?: Record<string, any>
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context: LogContext
  error?: Error
  stack?: string
  performance?: {
    memoryUsage?: NodeJS.MemoryUsage
    uptime?: number
    responseTime?: number
  }
}

class StructuredLogger {
  private static instance: StructuredLogger
  private logLevel: LogLevel = LogLevel.INFO
  private logBuffer: LogEntry[] = []
  private maxBufferSize = 1000
  private isDevelopment = process.env.NODE_ENV !== 'production'
  private enablePerformanceLogging = true

  private constructor() {
    // Set log level from environment
    const envLevel = process.env.LOG_LEVEL?.toUpperCase()
    if (envLevel && envLevel in LogLevel) {
      this.logLevel = LogLevel[envLevel as keyof typeof LogLevel]
    }
  }

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger()
    }
    return StructuredLogger.instance
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context)
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context)
  }

  /**
   * Log an error with optional error object
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const logContext = { ...context }
    if (error instanceof Error) {
      logContext.metadata = {
        ...logContext.metadata,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      }
    }

    this.log(LogLevel.ERROR, message, logContext, error instanceof Error ? error : undefined)
  }

  /**
   * Log a critical error
   */
  critical(message: string, error?: Error | unknown, context?: LogContext): void {
    const logContext = { ...context }
    if (error instanceof Error) {
      logContext.metadata = {
        ...logContext.metadata,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      }
    }

    this.log(LogLevel.CRITICAL, message, logContext, error instanceof Error ? error : undefined)
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, context?: LogContext): void {
    const perfContext: LogContext = {
      ...context,
      operation,
      duration,
      system: 'performance',
    }

    this.info(`Performance: ${operation} completed in ${duration}ms`, perfContext)
  }

  /**
   * Log API request/response
   */
  apiRequest(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level =
      statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO
    const message = `API ${method} ${endpoint} - ${statusCode} (${duration}ms)`

    this.log(level, message, {
      ...context,
      system: 'api',
      operation: 'request',
      duration,
      metadata: { method, endpoint, statusCode },
    })
  }

  /**
   * Log agent interactions
   */
  agentInteraction(
    agentId: string,
    userId: string,
    interactionType: string,
    context?: LogContext
  ): void {
    this.info(`Agent interaction: ${interactionType}`, {
      ...context,
      system: 'agent',
      operation: 'interaction',
      agentId,
      userId,
      metadata: { interactionType },
    })
  }

  /**
   * Log planetary position calculations
   */
  planetaryCalculation(
    source: string,
    accuracy: string,
    duration: number,
    cached: boolean,
    context?: LogContext
  ): void {
    this.info(`Planetary calculation: ${source} (${accuracy})`, {
      ...context,
      system: 'planetary',
      operation: 'calculation',
      duration,
      metadata: { source, accuracy, cached },
    })
  }

  /**
   * Log consciousness operations
   */
  consciousness(operation: string, agentId: string, success: boolean, context?: LogContext): void {
    const level = success ? LogLevel.INFO : LogLevel.WARN
    const message = `Consciousness ${operation}: ${success ? 'success' : 'failed'}`

    this.log(level, message, {
      ...context,
      system: 'consciousness',
      operation,
      agentId,
      metadata: { success },
    })
  }

  /**
   * Get recent logs for debugging
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count)
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel, count: number = 50): LogEntry[] {
    return this.logBuffer.filter(entry => entry.level >= level).slice(-count)
  }

  /**
   * Get performance metrics from logs
   */
  getPerformanceMetrics(hours: number = 1): {
    averageResponseTime: number
    errorRate: number
    requestCount: number
    topEndpoints: Record<string, number>
  } {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000
    const recentLogs = this.logBuffer.filter(
      entry => new Date(entry.timestamp).getTime() > cutoffTime
    )

    const apiLogs = recentLogs.filter(entry => entry.context.system === 'api')
    const errorLogs = recentLogs.filter(entry => entry.level >= LogLevel.ERROR)

    const responseTimes = apiLogs
      .map(entry => entry.context.duration)
      .filter((duration): duration is number => duration !== undefined)

    const topEndpoints: Record<string, number> = {}
    apiLogs.forEach(entry => {
      const endpoint = entry.context.metadata?.endpoint as string
      if (endpoint) {
        topEndpoints[endpoint] = (topEndpoints[endpoint] || 0) + 1
      }
    })

    return {
      averageResponseTime:
        responseTimes.length > 0
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
          : 0,
      errorRate: recentLogs.length > 0 ? errorLogs.length / recentLogs.length : 0,
      requestCount: apiLogs.length,
      topEndpoints,
    }
  }

  /**
   * Private logging method
   */
  private log(level: LogLevel, message: string, context: LogContext = {}, error?: Error): void {
    // Skip if below current log level
    if (level < this.logLevel) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        metadata: {
          ...context.metadata,
          environment: process.env.NODE_ENV,
          version: process.env.npm_package_version || 'unknown',
        },
      },
      error,
      stack: error?.stack,
    }

    // Add performance data if enabled
    if (this.enablePerformanceLogging && typeof window === 'undefined') {
      entry.performance = {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      }
    }

    // Add to buffer
    this.logBuffer.push(entry)

    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize)
    }

    // Console output (development only or for errors)
    if (this.isDevelopment || level >= LogLevel.WARN) {
      this.outputToConsole(entry)
    }

    // Could send to external logging service here
    // this.sendToExternalService(entry)
  }

  /**
   * Output to console with appropriate formatting
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString()
    const levelName = LogLevel[entry.level].toLowerCase()
    const prefix = `[${timestamp}] ${levelName.toUpperCase()}`

    const contextStr = this.formatContext(entry.context)
    const fullMessage = `${prefix} ${entry.message}${contextStr}`

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(fullMessage)
        break
      case LogLevel.INFO:
        console.info(fullMessage)
        break
      case LogLevel.WARN:
        console.warn(fullMessage)
        if (entry.error) console.warn(entry.error)
        break
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(fullMessage)
        if (entry.error) console.error(entry.error)
        break
    }
  }

  /**
   * Format context for console output
   */
  private formatContext(context: LogContext): string {
    const parts: string[] = []

    if (context.system) parts.push(`system:${context.system}`)
    if (context.operation) parts.push(`op:${context.operation}`)
    if (context.userId) parts.push(`user:${context.userId}`)
    if (context.agentId) parts.push(`agent:${context.agentId}`)
    if (context.duration) parts.push(`${context.duration}ms`)
    if (context.sessionId) parts.push(`session:${context.sessionId}`)
    if (context.requestId) parts.push(`req:${context.requestId}`)

    return parts.length > 0 ? ` (${parts.join(', ')})` : ''
  }

  /**
   * Send to external logging service (placeholder)
   */
  private sendToExternalService(entry: LogEntry): void {
    // In production, send to services like DataDog, LogRocket, or custom logging service
    // For now, this is a placeholder
    if (process.env.LOGGING_ENDPOINT && entry.level >= LogLevel.WARN) {
      // fetch(process.env.LOGGING_ENDPOINT, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry)
      // }).catch(() => {}) // Ignore logging errors
    }
  }
}

// Export singleton instance
export const logger = StructuredLogger.getInstance()

// Convenience functions for common use cases
export const logAPIRequest = (
  endpoint: string,
  method: string,
  statusCode: number,
  duration: number,
  context?: LogContext
) => {
  logger.apiRequest(endpoint, method, statusCode, duration, context)
}

export const logAgentInteraction = (
  agentId: string,
  userId: string,
  interactionType: string,
  context?: LogContext
) => {
  logger.agentInteraction(agentId, userId, interactionType, context)
}

export const logPlanetaryCalculation = (
  source: string,
  accuracy: string,
  duration: number,
  cached: boolean,
  context?: LogContext
) => {
  logger.planetaryCalculation(source, accuracy, duration, cached, context)
}

export const logConsciousnessOperation = (
  operation: string,
  agentId: string,
  success: boolean,
  context?: LogContext
) => {
  logger.consciousness(operation, agentId, success, context)
}

export const logPerformance = (operation: string, duration: number, context?: LogContext) => {
  logger.performance(operation, duration, context)
}
