/**
 * Production-Ready Error Handling and Logging Configuration
 * Centralized error management for beta testing and production deployment
 */

import { NextRequest, NextResponse } from 'next/server'

export interface ErrorLog {
  timestamp: Date
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  context?: any
  userId?: string
  sessionId?: string
  endpoint?: string
  userAgent?: string
  ip?: string
  stack?: string
}

class ProductionLogger {
  private logs: ErrorLog[] = []
  private readonly maxLogs = 1000 // Keep last 1000 logs in memory

  log(level: ErrorLog['level'], message: string, context?: any, req?: NextRequest): void {
    const errorLog: ErrorLog = {
      timestamp: new Date(),
      level,
      message,
      context,
      endpoint: req?.url,
      userAgent: req?.headers.get('user-agent') || undefined,
      ip: req?.ip || req?.headers.get('x-forwarded-for')?.toString() || undefined,
    }

    // Add to memory store
    this.logs.push(errorLog)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift() // Remove oldest log
    }

    // Console output for development
    if (process.env.NODE_ENV !== 'production') {
      const prefix = {
        error: '❌',
        warn: '⚠️',
        info: 'ℹ️',
        debug: '🐛',
      }[level]

      console.log(`${prefix} [${level.toUpperCase()}] ${message}`)
      if (context) {
        console.log('Context:', context)
      }
      if (errorLog.stack) {
        console.log('Stack:', errorLog.stack)
      }
    }

    // In production, you would send to external logging service
    // e.g., DataDog, LogRocket, Sentry, etc.
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService(errorLog)
    }
  }

  error(message: string, context?: any, req?: NextRequest): void {
    this.log('error', message, context, req)
  }

  warn(message: string, context?: any, req?: NextRequest): void {
    this.log('warn', message, context, req)
  }

  info(message: string, context?: any, req?: NextRequest): void {
    this.log('info', message, context, req)
  }

  debug(message: string, context?: any, req?: NextRequest): void {
    this.log('debug', message, context, req)
  }

  getRecentLogs(limit: number = 50): ErrorLog[] {
    return this.logs.slice(-limit)
  }

  getErrorStats(): {
    errors: number
    warnings: number
    total: number
    errorRate: number
  } {
    const errors = this.logs.filter(l => l.level === 'error').length
    const warnings = this.logs.filter(l => l.level === 'warn').length
    const total = this.logs.length

    return {
      errors,
      warnings,
      total,
      errorRate: total > 0 ? (errors / total) * 100 : 0,
    }
  }

  private sendToExternalService(log: ErrorLog): void {
    // In production, implement actual external logging
    // For now, just ensure we don't break
    try {
      // Example: send to DataDog, Sentry, etc.
      // await fetch('https://your-logging-service.com/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(log)
      // })
    } catch (error) {
      // Silent fail - don't break app because of logging issues
    }
  }
}

// Singleton logger instance
export const logger = new ProductionLogger()

/**
 * Standard error response format for APIs
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  context?: any,
  req?: NextRequest
): NextResponse {
  logger.error(message, context, req)

  return NextResponse.json(
    {
      error: message,
      timestamp: new Date().toISOString(),
      status,
    },
    { status }
  )
}

/**
 * Standard success response format for APIs
 */
export function createSuccessResponse(
  data: any,
  message?: string,
  req?: NextRequest
): NextResponse {
  if (message) {
    logger.info(message, { dataKeys: Object.keys(data) }, req)
  }

  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
    ...(message && { message }),
  })
}

/**
 * Error boundary for API routes
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args)
    } catch (error) {
      const req = args[0] as NextRequest
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      logger.error(
        'Unhandled API error',
        {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          endpoint: req?.url,
        },
        req
      )

      return createErrorResponse(
        'Internal server error',
        500,
        process.env.NODE_ENV === 'development' ? { originalError: errorMessage } : undefined,
        req
      )
    }
  }) as T
}

/**
 * Request validation helper
 */
export function validateRequest(
  req: NextRequest,
  requiredFields: string[],
  body?: any
): { isValid: boolean; error?: string } {
  try {
    if (!body) {
      return { isValid: false, error: 'Request body is required' }
    }

    for (const field of requiredFields) {
      if (!(field in body) || body[field] === undefined || body[field] === null) {
        return { isValid: false, error: `Missing required field: ${field}` }
      }
    }

    return { isValid: true }
  } catch (error) {
    logger.error('Request validation failed', { error: error.message, requiredFields }, req)
    return { isValid: false, error: 'Invalid request format' }
  }
}

/**
 * Performance monitoring helper
 */
export class PerformanceMonitor {
  private static timers: Map<string, number> = new Map()

  static start(operation: string): void {
    this.timers.set(operation, Date.now())
  }

  static end(operation: string, req?: NextRequest): number {
    const startTime = this.timers.get(operation)
    if (!startTime) {
      logger.warn(`No start time found for operation: ${operation}`, {}, req)
      return 0
    }

    const duration = Date.now() - startTime
    this.timers.delete(operation)

    // Log slow operations
    if (duration > 2000) {
      logger.warn(`Slow operation detected: ${operation}`, { duration }, req)
    } else if (duration > 1000) {
      logger.info(`Operation completed: ${operation}`, { duration }, req)
    }

    return duration
  }
}

/**
 * Beta testing specific error tracking
 */
export class BetaErrorTracker {
  static trackUserError(userId: string, operation: string, error: string, req?: NextRequest): void {
    logger.error(
      `Beta user error: ${operation}`,
      {
        userId,
        operation,
        error,
        isBetaUser: true,
      },
      req
    )
  }

  static trackFeatureUsage(
    userId: string,
    feature: string,
    success: boolean,
    req?: NextRequest
  ): void {
    logger.info(
      `Beta feature usage: ${feature}`,
      {
        userId,
        feature,
        success,
        isBetaUser: true,
      },
      req
    )
  }
}

/**
 * Database error helper
 */
export function handleDatabaseError(
  error: any,
  operation: string,
  req?: NextRequest
): NextResponse {
  let message = 'Database operation failed'
  let status = 500

  if (error.code === 'P2002') {
    message = 'Duplicate entry - this record already exists'
    status = 409
  } else if (error.code === 'P2025') {
    message = 'Record not found'
    status = 404
  } else if (error.code === 'P2003') {
    message = 'Foreign key constraint failed'
    status = 400
  }

  return createErrorResponse(
    message,
    status,
    {
      operation,
      prismaCode: error.code,
      originalMessage: error.message,
    },
    req
  )
}

// Export utilities for use in API routes
export { logger as productionLogger }
