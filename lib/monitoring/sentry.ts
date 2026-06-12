/**
 * Sentry Error Tracking and Performance Monitoring
 * ================================================
 */

import * as Sentry from '@sentry/nextjs'

export function initializeSentry() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',

      // Performance monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // Error filtering
      beforeSend(event: any) {
        // Filter out known non-critical errors
        if (event.exception?.values?.[0]?.value?.includes('Network request failed')) {
          return null // Don't send network errors to Sentry
        }

        if (event.request?.url?.includes('/favicon.ico')) {
          return null // Don't send favicon 404s
        }

        return event
      },

      // Custom integrations - updated for newer Sentry SDK
      integrations: [
        Sentry.httpIntegration({ tracing: true } as any),
        Sentry.consoleIntegration(),
        Sentry.globalHandlersIntegration(),
      ],

      // Release tracking
      release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',

      // User context
      initialScope: {
        tags: {
          component: 'planetary-agents',
          system: 'consciousness-evolution',
        },
      },
    })
  }
}

// Consciousness-specific error tracking
export function trackConsciousnessError(
  error: Error,
  context: {
    agentId?: string
    userId?: string
    evolutionLevel?: string
    interactionType?: string
  }
) {
  Sentry.withScope((scope: any) => {
    scope.setTag('error_type', 'consciousness_evolution')
    scope.setContext('consciousness', context)
    Sentry.captureException(error)
  })
}

// Performance tracking for consciousness operations
export function trackConsciousnessPerformance(
  operation: string,
  duration: number,
  metadata: any = {}
) {
  Sentry.addBreadcrumb({
    category: 'consciousness_performance',
    message: `${operation} completed in ${duration}ms`,
    level: 'info',
    data: {
      operation,
      duration,
      ...metadata,
    },
  })

  // Track slow operations
  if (duration > 1000) {
    Sentry.captureMessage(`Slow consciousness operation: ${operation}`, 'warning')
  }
}

// User journey tracking
export function trackUserJourney(event: string, userId: string, metadata: any = {}) {
  Sentry.addBreadcrumb({
    category: 'user_journey',
    message: event,
    level: 'info',
    data: {
      userId,
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  })
}

export default Sentry
