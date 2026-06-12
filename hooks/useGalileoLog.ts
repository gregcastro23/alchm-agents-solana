import { useState, useCallback, useEffect } from 'react'

type LogLevel = 'info' | 'warning' | 'error' | 'debug'

interface LogOptions {
  metadata?: Record<string, any>
  level?: LogLevel
  componentName?: string
}

interface LogResult {
  success: boolean
  error?: string
  message?: string
}

/**
 * Hook for logging to the Galileo system
 */
export function useGalileoLog(defaultComponentName?: string) {
  const [isLogging, setIsLogging] = useState(false)
  const [lastResult, setLastResult] = useState<LogResult | null>(null)
  const [componentMounted, setComponentMounted] = useState(false)

  // Set component as mounted in useEffect
  useEffect(() => {
    setComponentMounted(true)

    // When component unmounts, log that event
    return () => {
      if (defaultComponentName) {
        logEvent('Component unmounted', {
          componentName: defaultComponentName,
          level: 'info',
        })
      }
      setComponentMounted(false)
    }
  }, [defaultComponentName])

  // Log component mounted event
  useEffect(() => {
    if (componentMounted && defaultComponentName) {
      logEvent('Component mounted', {
        componentName: defaultComponentName,
        level: 'info',
      })
    }
  }, [componentMounted, defaultComponentName])

  // Internal function to log events
  const logEvent = useCallback(
    async (message: string, options: LogOptions = {}): Promise<LogResult> => {
      try {
        const response = await fetch('/api/galileo-log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            metadata: {
              ...(options.metadata || {}),
              component: options.componentName || defaultComponentName || 'unknown',
              timestamp: new Date().toISOString(),
            },
            level: options.level || 'info',
          }),
        })

        const result = await response.json()
        return result
      } catch (error) {
        const errorResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
        return errorResult
      }
    },
    [defaultComponentName]
  )

  const log = useCallback(
    async (message: string, options: LogOptions = {}): Promise<LogResult> => {
      setIsLogging(true)

      try {
        const result = await logEvent(message, options)
        setLastResult(result)
        return result
      } catch (error) {
        const errorResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
        setLastResult(errorResult)
        return errorResult
      } finally {
        setIsLogging(false)
      }
    },
    [logEvent]
  )

  // Convenience methods for different log levels
  const info = useCallback(
    (message: string, metadata?: Record<string, any>, componentName?: string) =>
      log(message, { metadata, level: 'info', componentName }),
    [log]
  )

  const warn = useCallback(
    (message: string, metadata?: Record<string, any>, componentName?: string) =>
      log(message, { metadata, level: 'warning', componentName }),
    [log]
  )

  const error = useCallback(
    (message: string, metadata?: Record<string, any>, componentName?: string) =>
      log(message, { metadata, level: 'error', componentName }),
    [log]
  )

  const debug = useCallback(
    (message: string, metadata?: Record<string, any>, componentName?: string) =>
      log(message, { metadata, level: 'debug', componentName }),
    [log]
  )

  return {
    log,
    info,
    warn,
    error,
    debug,
    isLogging,
    lastResult,
  }
}
