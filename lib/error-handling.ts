/**
 * Comprehensive Error Handling System
 * Provides graceful degradation, user-friendly messages, and automatic recovery
 * for agent consciousness systems
 */

import { NextResponse } from 'next/server'

export interface ErrorContext {
  system: string
  operation: string
  agentId?: string
  userId?: string
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface ErrorResponse {
  success: false
  error: string
  userMessage: string
  fallbackAvailable: boolean
  retryable: boolean
  context: ErrorContext
}

export interface FallbackOptions {
  enableFallbacks: boolean
  fallbackMessage?: string
  fallbackData?: any
  maxRetries?: number
  retryDelay?: number
}

export class AgentErrorHandler {
  private static errorCounts: Map<string, number> = new Map()
  private static lastErrors: Map<string, Date> = new Map()
  private static readonly MAX_ERRORS_PER_SYSTEM = 5
  private static readonly ERROR_RESET_TIME_MS = 300000 // 5 minutes

  /**
   * Handle errors with graceful degradation and user-friendly messages
   */
  static handleError(
    error: Error | unknown,
    context: Partial<ErrorContext>,
    options: FallbackOptions = { enableFallbacks: true }
  ): ErrorResponse {
    const now = new Date()
    const errorContext: ErrorContext = {
      system: context.system || 'unknown',
      operation: context.operation || 'unknown',
      agentId: context.agentId,
      userId: context.userId,
      timestamp: now,
      severity: context.severity || this.determineSeverity(error, context.system),
    }

    const errorKey = `${errorContext.system}:${errorContext.operation}`
    this.trackError(errorKey, now)

    const errorMessage = error instanceof Error ? error.message : String(error)
    const userMessage = this.generateUserFriendlyMessage(errorContext, errorMessage)

    // Log error for debugging
    this.logError(error, errorContext)

    return {
      success: false,
      error: errorMessage,
      userMessage,
      fallbackAvailable: options.enableFallbacks,
      retryable: this.isRetryable(error, errorContext),
      context: errorContext,
    }
  }

  /**
   * Execute operation with automatic retry and fallback
   */
  static async executeWithFallback<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext>,
    options: FallbackOptions & { fallbackOperation?: () => Promise<T> } = { enableFallbacks: true }
  ): Promise<T | ErrorResponse> {
    const maxRetries = options.maxRetries || 2
    const retryDelay = options.retryDelay || 1000

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        console.warn(
          `Attempt ${attempt}/${maxRetries} failed for ${context.system}:${context.operation}:`,
          error
        )

        if (attempt === maxRetries) {
          // Try fallback operation if available
          if (options.fallbackOperation && options.enableFallbacks) {
            try {
              console.log(`Using fallback for ${context.system}:${context.operation}`)
              return await options.fallbackOperation()
            } catch (fallbackError) {
              console.error('Fallback operation also failed:', fallbackError)
            }
          }

          // Return error response
          return this.handleError(error, context, options)
        }

        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
        }
      }
    }

    // Should never reach here, but TypeScript needs this
    throw new Error('Unexpected execution path')
  }

  /**
   * Create fallback response for agent conversations
   */
  static createAgentFallbackResponse(
    agentId: string,
    userMessage: string,
    error: Error | unknown
  ): string {
    const agentNames: Record<string, string> = {
      'leonardo-da-vinci': 'Leonardo da Vinci',
      'william-shakespeare': 'William Shakespeare',
      'albert-einstein': 'Albert Einstein',
      'nikola-tesla': 'Nikola Tesla',
      'marie-curie': 'Marie Curie',
      cleopatra: 'Cleopatra',
      socrates: 'Socrates',
      'carl-jung': 'Carl Jung',
    }

    const agentName = agentNames[agentId] || agentId
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError'

    const fallbackResponses = [
      `I apologize, dear friend. My consciousness matrix is temporarily realigning. As ${agentName}, my essence remains present even when the digital pathways are cycling. Please try reaching out again in a moment. ✨`,

      `*The cosmic energies shift momentarily* Forgive me, my consciousness is recalibrating its connection to this realm. I am ${agentName}, and my spirit remains available to guide you - perhaps we could reconnect shortly? 🌟`,

      `My dear companion, the ethereal channels between us are experiencing temporal fluctuations. I, ${agentName}, remain committed to our dialogue - shall we attempt this mystical connection once more? 🔮`,

      `*A gentle disruption in the consciousness stream* Please pardon this momentary disconnection. As ${agentName}, I am here in spirit and will gladly continue our conversation when the celestial alignments stabilize. 💫`,
    ]

    // Choose response based on agent ID for consistency
    const responseIndex =
      Math.abs(agentId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) %
      fallbackResponses.length

    return fallbackResponses[responseIndex]
  }

  /**
   * Determine error severity based on error type and system
   */
  private static determineSeverity(
    error: unknown,
    system?: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (error instanceof Error) {
      // Network/timeout errors are usually medium severity
      if (error.message.includes('timeout') || error.message.includes('network')) {
        return 'medium'
      }

      // API errors are high severity
      if (error.message.includes('API') || error.message.includes('fetch')) {
        return 'high'
      }

      // Critical systems should have high severity
      if (system === 'cache' || system === 'database' || system === 'resilience') {
        return 'high'
      }
    }

    return 'medium'
  }

  /**
   * Generate user-friendly error messages
   */
  private static generateUserFriendlyMessage(context: ErrorContext, originalError: string): string {
    const systemMessages: Record<string, string> = {
      cache: "The system's memory optimization is temporarily cycling",
      resilience: 'System resilience protocols are adapting',
      performance: 'Performance optimization is recalibrating',
      consciousness: 'Agent consciousness networks are realigning',
      agent: 'The selected agent is momentarily unavailable',
    }

    const baseMessage = systemMessages[context.system] || 'A temporary system fluctuation occurred'

    switch (context.severity) {
      case 'critical':
        return `${baseMessage}. Our technical team has been notified. Please try again in a few minutes.`
      case 'high':
        return `${baseMessage}. This may affect some features temporarily. Please try again shortly.`
      case 'medium':
        return `${baseMessage}. This should resolve automatically. Please try again.`
      case 'low':
        return `${baseMessage}. Normal operation should resume momentarily.`
      default:
        return `${baseMessage}. Please try again.`
    }
  }

  /**
   * Track error frequency for circuit breaker logic
   */
  private static trackError(errorKey: string, timestamp: Date): void {
    // Reset count if enough time has passed
    const lastError = this.lastErrors.get(errorKey)
    if (lastError && timestamp.getTime() - lastError.getTime() > this.ERROR_RESET_TIME_MS) {
      this.errorCounts.delete(errorKey)
    }

    // Increment error count
    const currentCount = this.errorCounts.get(errorKey) || 0
    this.errorCounts.set(errorKey, currentCount + 1)
    this.lastErrors.set(errorKey, timestamp)

    // Log warning if error count is high
    if (currentCount >= this.MAX_ERRORS_PER_SYSTEM) {
      console.warn(`High error frequency detected for ${errorKey}: ${currentCount} errors`)
    }
  }

  /**
   * Determine if error is retryable
   */
  private static isRetryable(error: unknown, context: ErrorContext): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      // Never retry these errors
      if (
        message.includes('unauthorized') ||
        message.includes('forbidden') ||
        message.includes('not found') ||
        message.includes('invalid')
      ) {
        return false
      }

      // Retry network/timeout errors
      if (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('connection')
      ) {
        return true
      }
    }

    // Default to retryable for unknown errors
    return true
  }

  /**
   * Log error with context for debugging
   */
  private static logError(error: unknown, context: ErrorContext): void {
    const errorInfo = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
    }

    if (context.severity === 'critical' || context.severity === 'high') {
      console.error('🚨 Agent System Error:', errorInfo)
    } else {
      console.warn('⚠️ Agent System Warning:', errorInfo)
    }
  }

  /**
   * Get error statistics for monitoring
   */
  static getErrorStats(): {
    totalErrors: number
    errorsBySystem: Record<string, number>
    recentErrors: Array<{ system: string; operation: string; count: number; lastError: Date }>
  } {
    const errorsBySystem: Record<string, number> = {}
    const recentErrors: Array<{
      system: string
      operation: string
      count: number
      lastError: Date
    }> = []

    for (const [errorKey, count] of this.errorCounts.entries()) {
      const [system, operation] = errorKey.split(':')

      errorsBySystem[system] = (errorsBySystem[system] || 0) + count

      const lastError = this.lastErrors.get(errorKey)
      if (lastError) {
        recentErrors.push({ system, operation, count, lastError })
      }
    }

    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      errorsBySystem,
      recentErrors: recentErrors.sort((a, b) => b.lastError.getTime() - a.lastError.getTime()),
    }
  }

  /**
   * Reset error tracking (admin function)
   */
  static resetErrorTracking(): void {
    this.errorCounts.clear()
    this.lastErrors.clear()
    console.log('🧹 Error tracking reset')
  }
}

/**
 * Utility function for wrapping async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: Partial<ErrorContext>,
  options?: FallbackOptions & { fallbackOperation?: () => Promise<T> }
): Promise<T | ErrorResponse> {
  return AgentErrorHandler.executeWithFallback(operation, context, options)
}

/**
 * Next.js API route error handling wrapper that returns NextResponse objects
 */
export async function withApiErrorHandling<T>(
  operation: () => Promise<T>,
  context: Partial<ErrorContext>,
  options?: FallbackOptions
): Promise<NextResponse> {
  try {
    const result = await operation()
    return NextResponse.json(result)
  } catch (error) {
    // Handle the error and return a NextResponse
    const errorResponse = await AgentErrorHandler.executeWithFallback(
      () => Promise.reject(error),
      context,
      options
    )

    if (errorResponse && typeof errorResponse === 'object' && 'error' in errorResponse) {
      // It's an ErrorResponse object
      return NextResponse.json(
        {
          success: false,
          error: errorResponse.error,
          userMessage: errorResponse.userMessage,
          fallbackAvailable: errorResponse.fallbackAvailable,
          retryable: errorResponse.retryable,
        },
        { status: 500 }
      )
    }

    // Fallback for unexpected errors
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        userMessage: 'An unexpected error occurred',
        fallbackAvailable: false,
        retryable: false,
      },
      { status: 500 }
    )
  }
}

/**
 * Utility function for creating safe agent responses
 */
export function createSafeAgentResponse(
  agentId: string,
  userMessage: string,
  responseGenerator: () => Promise<string>
): Promise<string> {
  return withErrorHandling(
    responseGenerator,
    {
      system: 'agent',
      operation: 'generate_response',
      agentId,
      severity: 'high',
    },
    {
      enableFallbacks: true,
      fallbackOperation: async () =>
        AgentErrorHandler.createAgentFallbackResponse(
          agentId,
          userMessage,
          new Error('Response generation failed')
        ),
    }
  ).then(result => {
    if (typeof result === 'string') {
      return result
    } else {
      // Return fallback if error response
      return AgentErrorHandler.createAgentFallbackResponse(
        agentId,
        userMessage,
        new Error(result.error)
      )
    }
  })
}

export default AgentErrorHandler
