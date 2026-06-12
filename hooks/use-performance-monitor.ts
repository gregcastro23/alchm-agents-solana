import React, { useEffect, useRef, useCallback } from 'react'
import { logPerformance } from '@/lib/structured-logger'

interface PerformanceMetrics {
  componentName: string
  mountTime: number
  renderCount: number
  lastRenderTime: number
  averageRenderTime: number
  memoryUsage?: number
}

export function usePerformanceMonitor(componentName: string, enabled: boolean = true) {
  const mountTimeRef = useRef<number>(0)
  const renderCountRef = useRef<number>(0)
  const renderTimesRef = useRef<number[]>([])
  const lastRenderTimeRef = useRef<number>(0)

  // Track component mount
  useEffect(() => {
    if (!enabled) return

    mountTimeRef.current = Date.now()
    logPerformance(`${componentName}_mount`, 0, {
      system: 'component',
      operation: 'mount',
      metadata: {
        componentName,
        timestamp: mountTimeRef.current,
      },
    })

    // Track component unmount
    return () => {
      const unmountTime = Date.now()
      const totalLifetime = unmountTime - mountTimeRef.current

      logPerformance(`${componentName}_unmount`, totalLifetime, {
        system: 'component',
        operation: 'unmount',
        metadata: {
          componentName,
          totalLifetime,
          renderCount: renderCountRef.current,
          averageRenderTime:
            renderTimesRef.current.length > 0
              ? renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length
              : 0,
        },
      })
    }
  }, [componentName, enabled])

  // Track renders
  useEffect(() => {
    if (!enabled) return

    const startTime = performance.now()
    renderCountRef.current += 1

    return () => {
      const renderTime = performance.now() - startTime
      renderTimesRef.current.push(renderTime)
      lastRenderTimeRef.current = renderTime

      // Only log significant render times (> 16ms = 1 frame at 60fps)
      if (renderTime > 16) {
        logPerformance(`${componentName}_render`, renderTime, {
          system: 'component',
          operation: 'render',
          metadata: {
            componentName,
            renderCount: renderCountRef.current,
            renderTime,
            isSlow: renderTime > 16,
          },
        })
      }

      // Keep only last 10 render times for average calculation
      if (renderTimesRef.current.length > 10) {
        renderTimesRef.current = renderTimesRef.current.slice(-10)
      }
    }
  })

  // Memory monitoring (if available)
  const getMemoryUsage = useCallback(() => {
    const perf = performance as any
    if (!enabled || typeof performance === 'undefined' || !perf.memory) {
      return undefined
    }

    return {
      used: perf.memory.usedJSHeapSize,
      total: perf.memory.totalJSHeapSize,
      limit: perf.memory.jsHeapSizeLimit,
    }
  }, [enabled])

  // Manual performance tracking
  const trackInteraction = useCallback(
    (interactionName: string, duration?: number) => {
      if (!enabled) return

      logPerformance(`${componentName}_${interactionName}`, duration || 0, {
        system: 'component',
        operation: 'interaction',
        metadata: {
          componentName,
          interactionName,
          memoryUsage: getMemoryUsage(),
        },
      })
    },
    [componentName, enabled, getMemoryUsage]
  )

  // Get current metrics
  const getMetrics = useCallback((): PerformanceMetrics => {
    return {
      componentName,
      mountTime: mountTimeRef.current,
      renderCount: renderCountRef.current,
      lastRenderTime: lastRenderTimeRef.current,
      averageRenderTime:
        renderTimesRef.current.length > 0
          ? renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length
          : 0,
      memoryUsage: getMemoryUsage()?.used,
    }
  }, [componentName, getMemoryUsage])

  return {
    trackInteraction,
    getMetrics,
    getMemoryUsage,
  }
}

// Higher-order component for performance monitoring
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
  enabled: boolean = true
) {
  const WrappedComponent = (props: P) => {
    usePerformanceMonitor(componentName, enabled)
    return React.createElement(Component, props)
  }

  WrappedComponent.displayName = `withPerformanceMonitoring(${componentName})`
  return WrappedComponent
}
