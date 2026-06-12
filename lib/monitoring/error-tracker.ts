/**
 * Error Tracking and Reporting System
 * ===================================
 *
 * Comprehensive error tracking, categorization, and reporting system
 * for the Planetary Agent Transit System.
 */

import React, { useCallback, useEffect, useRef } from 'react'

// Error types and categories
export enum ErrorType {
  JAVASCRIPT = 'javascript',
  NETWORK = 'network',
  API = 'api',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  PERFORMANCE = 'performance',
  COMPATIBILITY = 'compatibility',
  RESOURCE = 'resource',
  SECURITY = 'security',
  UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  USER_INTERFACE = 'user_interface',
  DATA_PROCESSING = 'data_processing',
  EXTERNAL_SERVICE = 'external_service',
  SYSTEM_RESOURCE = 'system_resource',
  NETWORK_CONNECTIVITY = 'network_connectivity',
  BROWSER_COMPATIBILITY = 'browser_compatibility',
  USER_INPUT = 'user_input',
  APPLICATION_LOGIC = 'application_logic',
}

// Error tracking interface
export interface ErrorReport {
  id: string
  timestamp: number
  type: ErrorType
  severity: ErrorSeverity
  category: ErrorCategory
  message: string
  stack?: string
  url: string
  userAgent: string
  userId?: string
  sessionId?: string
  component?: string
  action?: string
  metadata: Record<string, any>
  browser: {
    name: string
    version: string
    platform: string
    mobile: boolean
  }
  environment: {
    nodeEnv: string
    userTimezone: string
    language: string
    screenResolution: string
    viewport: string
  }
  context: {
    userJourney: string[]
    lastActions: string[]
    planetaryContext?: {
      selectedDate?: string
      selectedDegree?: number
      activeAgent?: string
      zodiacSign?: string
    }
  }
  resolution?: {
    status: 'open' | 'investigating' | 'resolved' | 'wont_fix'
    resolution?: string
    resolvedBy?: string
    resolvedAt?: number
  }
}

// Error aggregation and analytics
export interface ErrorAnalytics {
  totalErrors: number
  errorsByType: Record<ErrorType, number>
  errorsBySeverity: Record<ErrorSeverity, number>
  errorsByCategory: Record<ErrorCategory, number>
  topErrorMessages: Array<{
    message: string
    count: number
    percentage: number
  }>
  errorsOverTime: Array<{
    timestamp: number
    count: number
    severity: ErrorSeverity
  }>
  affectedUsers: number
  errorRate: number // errors per user session
  mostProblematicComponents: Array<{
    component: string
    errorCount: number
    userImpact: number
  }>
}

// Error tracking manager
class ErrorTrackerManager {
  private static instance: ErrorTrackerManager
  private errorQueue: ErrorReport[] = []
  private isInitialized = false
  private flushInterval: NodeJS.Timeout | null = null
  private globalErrorHandler: ((event: ErrorEvent) => void) | null = null
  private unhandledRejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null

  static getInstance(): ErrorTrackerManager {
    if (!ErrorTrackerManager.instance) {
      ErrorTrackerManager.instance = new ErrorTrackerManager()
    }
    return ErrorTrackerManager.instance
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    // Set up global error handlers
    this.setupGlobalErrorHandlers()

    // Set up performance monitoring
    this.setupPerformanceMonitoring()

    // Start periodic error flushing
    this.startPeriodicFlush()

    this.isInitialized = true
  }

  private setupGlobalErrorHandlers(): void {
    // JavaScript errors
    this.globalErrorHandler = (event: ErrorEvent) => {
      this.trackError({
        type: ErrorType.JAVASCRIPT,
        severity: this.determineSeverity(event.error),
        category: ErrorCategory.APPLICATION_LOGIC,
        message: event.message,
        stack: event.error?.stack,
        component: 'global',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          originalEvent: event,
        },
      })
    }

    // Unhandled promise rejections
    this.unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      this.trackError({
        type: ErrorType.JAVASCRIPT,
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.APPLICATION_LOGIC,
        message: 'Unhandled Promise Rejection',
        metadata: {
          reason: event.reason,
          originalEvent: event,
        },
      })
    }

    // Network errors
    window.addEventListener('error', this.globalErrorHandler)
    window.addEventListener('unhandledrejection', this.unhandledRejectionHandler)

    // Resource loading errors
    window.addEventListener(
      'error',
      event => {
        const target = event.target as HTMLElement
        if (
          target &&
          (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')
        ) {
          this.trackError({
            type: ErrorType.RESOURCE,
            severity: ErrorSeverity.LOW,
            category: ErrorCategory.USER_INTERFACE,
            message: `Failed to load resource: ${target.tagName}`,
            metadata: {
              resourceUrl: (target as any).src || (target as any).href,
              resourceType: target.tagName.toLowerCase(),
              originalEvent: event,
            },
          })
        }
      },
      true
    )
  }

  private setupPerformanceMonitoring(): void {
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 100) {
              // Tasks longer than 100ms
              this.trackError({
                type: ErrorType.PERFORMANCE,
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.SYSTEM_RESOURCE,
                message: 'Long running task detected',
                metadata: {
                  duration: entry.duration,
                  startTime: entry.startTime,
                  entryType: entry.entryType,
                  originalEntry: entry,
                },
              })
            }
          }
        })

        observer.observe({ entryTypes: ['longtask'] })
      } catch (error) {
        console.warn('Performance monitoring setup failed:', error)
      }
    }
  }

  private determineSeverity(error: Error | null): ErrorSeverity {
    if (!error) return ErrorSeverity.LOW

    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ''

    // Critical errors
    if (
      message.includes('out of memory') ||
      message.includes('stack overflow') ||
      message.includes('maximum call stack')
    ) {
      return ErrorSeverity.CRITICAL
    }

    // High severity errors
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      stack.includes('api') ||
      stack.includes('auth')
    ) {
      return ErrorSeverity.HIGH
    }

    // Medium severity errors
    if (
      message.includes('validation') ||
      message.includes('parse') ||
      message.includes('syntax') ||
      stack.includes('component') ||
      stack.includes('render')
    ) {
      return ErrorSeverity.MEDIUM
    }

    return ErrorSeverity.LOW
  }

  async trackError(errorData: Partial<ErrorReport>): Promise<void> {
    try {
      const errorReport: ErrorReport = {
        id: this.generateErrorId(),
        timestamp: Date.now(),
        type: ErrorType.UNKNOWN,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.APPLICATION_LOGIC,
        message: 'Unknown error',
        url: window.location.href,
        userAgent: navigator.userAgent,
        browser: this.getBrowserInfo(),
        environment: this.getEnvironmentInfo(),
        context: this.getContextInfo(),
        metadata: {},
        ...errorData,
      } as ErrorReport

      // Add to queue
      this.errorQueue.push(errorReport)

      // Immediate flush for critical errors
      if (errorReport.severity === ErrorSeverity.CRITICAL) {
        await this.flushErrors(true)
      } else if (this.errorQueue.length >= 5) {
        // Batch flush for multiple errors
        await this.flushErrors()
      }

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Error tracked:', errorReport)
      }
    } catch (trackingError) {
      console.error('Error tracking failed:', trackingError)
    }
  }

  private getBrowserInfo() {
    const ua = navigator.userAgent

    let name = 'Unknown'
    let version = '0'

    if (ua.includes('Chrome') && !ua.includes('Edg')) {
      name = 'Chrome'
      const match = ua.match(/Chrome\/(\d+)/)
      version = match ? match[1] : '0'
    } else if (ua.includes('Firefox')) {
      name = 'Firefox'
      const match = ua.match(/Firefox\/(\d+)/)
      version = match ? match[1] : '0'
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      name = 'Safari'
      const match = ua.match(/Version\/(\d+)/)
      version = match ? match[1] : '0'
    } else if (ua.includes('Edg')) {
      name = 'Edge'
      const match = ua.match(/Edg\/(\d+)/)
      version = match ? match[1] : '0'
    }

    return {
      name,
      version,
      platform: navigator.platform,
      mobile: /Mobi|Android/i.test(ua),
    }
  }

  private getEnvironmentInfo() {
    return {
      nodeEnv: process.env.NODE_ENV || 'production',
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    }
  }

  private getContextInfo() {
    // Get context from session storage or global state
    const context = {
      userJourney: [],
      lastActions: [],
      planetaryContext: undefined,
    }

    try {
      const journey = sessionStorage.getItem('planetary_agent_journey')
      if (journey) {
        context.userJourney = JSON.parse(journey)
      }

      const lastActions = sessionStorage.getItem('planetary_agent_last_actions')
      if (lastActions) {
        context.lastActions = JSON.parse(lastActions)
      }

      const planetaryContext = sessionStorage.getItem('planetary_agent_context')
      if (planetaryContext) {
        context.planetaryContext = JSON.parse(planetaryContext)
      }
    } catch (error) {
      // Ignore context retrieval errors
    }

    return context
  }

  private async flushErrors(immediate = false): Promise<void> {
    if (this.errorQueue.length === 0) return

    try {
      const errorsToSend = [...this.errorQueue]
      this.errorQueue = []

      // Send to error reporting service
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/errors/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errors: errorsToSend }),
        })
      }

      // Store locally for development/debugging
      if (process.env.NODE_ENV === 'development') {
        const existingErrors = JSON.parse(localStorage.getItem('planetary_agent_errors') || '[]')
        existingErrors.push(...errorsToSend)
        localStorage.setItem('planetary_agent_errors', JSON.stringify(existingErrors.slice(-100))) // Keep last 100
      }
    } catch (error) {
      console.error('Error flushing failed:', error)
      // Re-queue errors for retry
      this.errorQueue.unshift(...this.errorQueue)
    }
  }

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushErrors()
    }, 60000) // Flush every minute
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Public API methods
  async trackCustomError(
    type: ErrorType,
    severity: ErrorSeverity,
    category: ErrorCategory,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.trackError({
      type,
      severity,
      category,
      message,
      metadata,
    })
  }

  getErrorAnalytics(): ErrorAnalytics | null {
    if (!this.isInitialized) return null

    // This would typically fetch from the error reporting service
    // For now, return mock data
    return {
      totalErrors: 247,
      errorsByType: {
        [ErrorType.JAVASCRIPT]: 89,
        [ErrorType.NETWORK]: 45,
        [ErrorType.API]: 67,
        [ErrorType.AUTHENTICATION]: 12,
        [ErrorType.VALIDATION]: 23,
        [ErrorType.PERFORMANCE]: 8,
        [ErrorType.COMPATIBILITY]: 3,
        [ErrorType.RESOURCE]: 0,
        [ErrorType.SECURITY]: 0,
        [ErrorType.UNKNOWN]: 0,
      },
      errorsBySeverity: {
        [ErrorSeverity.LOW]: 156,
        [ErrorSeverity.MEDIUM]: 78,
        [ErrorSeverity.HIGH]: 12,
        [ErrorSeverity.CRITICAL]: 1,
      },
      errorsByCategory: {
        [ErrorCategory.USER_INTERFACE]: 45,
        [ErrorCategory.DATA_PROCESSING]: 67,
        [ErrorCategory.EXTERNAL_SERVICE]: 89,
        [ErrorCategory.SYSTEM_RESOURCE]: 12,
        [ErrorCategory.NETWORK_CONNECTIVITY]: 23,
        [ErrorCategory.BROWSER_COMPATIBILITY]: 8,
        [ErrorCategory.USER_INPUT]: 3,
        [ErrorCategory.APPLICATION_LOGIC]: 0,
      },
      topErrorMessages: [
        { message: 'Network request failed', count: 45, percentage: 18.2 },
        { message: 'Component render error', count: 32, percentage: 12.9 },
        { message: 'API timeout', count: 28, percentage: 11.3 },
        { message: 'Validation failed', count: 19, percentage: 7.7 },
        { message: 'Memory limit exceeded', count: 15, percentage: 6.1 },
      ],
      errorsOverTime: [],
      affectedUsers: 1234,
      errorRate: 0.023,
      mostProblematicComponents: [
        { component: 'ZodiacWheel', errorCount: 34, userImpact: 0.15 },
        { component: 'AgentChat', errorCount: 28, userImpact: 0.12 },
        { component: 'TimeLaboratory', errorCount: 21, userImpact: 0.09 },
        { component: 'API Client', errorCount: 18, userImpact: 0.08 },
        { component: 'Authentication', errorCount: 12, userImpact: 0.05 },
      ],
    }
  }

  // Cleanup
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }

    if (this.globalErrorHandler) {
      window.removeEventListener('error', this.globalErrorHandler)
    }

    if (this.unhandledRejectionHandler) {
      window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler)
    }

    this.flushErrors(true)
    this.isInitialized = false
  }
}

// React hooks for error tracking
export const useErrorTracking = () => {
  const errorTrackerRef = useRef(ErrorTrackerManager.getInstance())

  useEffect(() => {
    errorTrackerRef.current.initialize()

    return () => {
      errorTrackerRef.current.destroy()
    }
  }, [])

  const trackError = useCallback(
    async (
      type: ErrorType,
      severity: ErrorSeverity,
      category: ErrorCategory,
      message: string,
      metadata?: Record<string, any>
    ) => {
      await errorTrackerRef.current.trackCustomError(type, severity, category, message, metadata)
    },
    []
  )

  const trackJavaScriptError = useCallback(
    async (error: Error, context?: string) => {
      await trackError(
        ErrorType.JAVASCRIPT,
        ErrorSeverity.HIGH,
        ErrorCategory.APPLICATION_LOGIC,
        error.message,
        {
          stack: error.stack,
          context,
          component: 'unknown',
        }
      )
    },
    [trackError]
  )

  const trackNetworkError = useCallback(
    async (url: string, status?: number, context?: string) => {
      await trackError(
        ErrorType.NETWORK,
        status && status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
        ErrorCategory.NETWORK_CONNECTIVITY,
        `Network request failed: ${url}`,
        {
          url,
          status,
          context,
        }
      )
    },
    [trackError]
  )

  const trackAPIError = useCallback(
    async (endpoint: string, error: any, context?: string) => {
      await trackError(
        ErrorType.API,
        ErrorSeverity.HIGH,
        ErrorCategory.EXTERNAL_SERVICE,
        `API request failed: ${endpoint}`,
        {
          endpoint,
          error: error?.message || error,
          context,
        }
      )
    },
    [trackError]
  )

  const trackValidationError = useCallback(
    async (field: string, value: any, reason: string) => {
      await trackError(
        ErrorType.VALIDATION,
        ErrorSeverity.LOW,
        ErrorCategory.USER_INPUT,
        `Validation failed for field: ${field}`,
        {
          field,
          value: typeof value === 'object' ? JSON.stringify(value) : value,
          reason,
        }
      )
    },
    [trackError]
  )

  const getErrorAnalytics = useCallback(() => {
    return errorTrackerRef.current.getErrorAnalytics()
  }, [])

  return {
    trackError,
    trackJavaScriptError,
    trackNetworkError,
    trackAPIError,
    trackValidationError,
    getErrorAnalytics,
  }
}

// Higher-order component for error boundary
// Note: This should be moved to a .tsx file for proper JSX support
export const withErrorTracking = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  return class ErrorTrackedComponent extends React.Component<P, { hasError: boolean }> {
    constructor(props: P) {
      super(props)
      this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true }
    }

    override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      const errorTracker = ErrorTrackerManager.getInstance()
      errorTracker.trackError({
        type: ErrorType.JAVASCRIPT,
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.USER_INTERFACE,
        message: `React component error in ${componentName}`,
        stack: error.stack,
        component: componentName,
        metadata: {
          errorInfo,
          componentStack: errorInfo.componentStack,
          originalError: error,
        },
      })
    }

    override render() {
      if (this.state.hasError) {
        // Create error boundary JSX programmatically
        return React.createElement(
          'div',
          {
            className: 'p-4 border border-red-500/20 rounded-lg bg-red-500/5',
          },
          React.createElement('div', { className: 'text-red-400 font-medium' }, 'Component Error'),
          React.createElement(
            'div',
            { className: 'text-red-300 text-sm mt-1' },
            `Something went wrong with the ${componentName} component. Please refresh the page.`
          )
        )
      }

      return React.createElement(Component, this.props)
    }
  }
}

export default ErrorTrackerManager
