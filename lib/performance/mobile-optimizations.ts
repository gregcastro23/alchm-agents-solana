/**
 * Mobile Performance Optimizations
 * ================================
 *
 * Performance enhancements specifically for mobile devices
 * including memory management, rendering optimizations, and touch handling.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// Device detection utilities
export const useDeviceCapabilities = () => {
  const [capabilities, setCapabilities] = useState({
    isMobile: false,
    isTablet: false,
    hasTouch: false,
    supportsWebGL: false,
    memoryGB: 4,
    connectionSpeed: '4g' as 'slow' | '2g' | '3g' | '4g',
    batteryLevel: 100,
    lowPowerMode: false,
  })

  useEffect(() => {
    const detectCapabilities = () => {
      const userAgent = navigator.userAgent.toLowerCase()
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent
      )
      const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent)
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

      // WebGL support detection
      let supportsWebGL = false
      try {
        const canvas = document.createElement('canvas')
        supportsWebGL = !!(window.WebGLRenderingContext && canvas.getContext('webgl'))
      } catch (e) {
        supportsWebGL = false
      }

      // Memory estimation (rough approximation)
      let memoryGB = 4 // Default assumption
      if ('deviceMemory' in navigator) {
        memoryGB = (navigator as any).deviceMemory || 4
      }

      // Connection speed detection
      let connectionSpeed: 'slow' | '2g' | '3g' | '4g' = '4g'
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        if (connection) {
          const effectiveType = connection.effectiveType
          if (effectiveType === 'slow-2g' || effectiveType === '2g') {
            connectionSpeed = '2g'
          } else if (effectiveType === '3g') {
            connectionSpeed = '3g'
          } else {
            connectionSpeed = '4g'
          }
        }
      }

      // Battery level detection
      let batteryLevel = 100
      let lowPowerMode = false
      if ('getBattery' in navigator) {
        ;(navigator as any).getBattery().then((battery: any) => {
          batteryLevel = Math.round(battery.level * 100)
          lowPowerMode = battery.charging === false && battery.level < 0.2
          setCapabilities(prev => ({ ...prev, batteryLevel, lowPowerMode }))
        })
      }

      setCapabilities({
        isMobile,
        isTablet,
        hasTouch,
        supportsWebGL,
        memoryGB,
        connectionSpeed,
        batteryLevel,
        lowPowerMode,
      })
    }

    detectCapabilities()
  }, [])

  return capabilities
}

// Memory management for mobile devices
export class MobileMemoryManager {
  private static instance: MobileMemoryManager
  private memoryPressure = 0
  private cleanupCallbacks: (() => void)[] = []

  static getInstance(): MobileMemoryManager {
    if (!MobileMemoryManager.instance) {
      MobileMemoryManager.instance = new MobileMemoryManager()
    }
    return MobileMemoryManager.instance
  }

  registerCleanup(callback: () => void): () => void {
    this.cleanupCallbacks.push(callback)
    return () => {
      const index = this.cleanupCallbacks.indexOf(callback)
      if (index > -1) {
        this.cleanupCallbacks.splice(index, 1)
      }
    }
  }

  triggerCleanup(): void {
    this.memoryPressure++
    if (this.memoryPressure > 3) {
      // High memory pressure - aggressive cleanup
      this.cleanupCallbacks.forEach(callback => {
        try {
          callback()
        } catch (e) {
          console.warn('Cleanup callback failed:', e)
        }
      })
      this.memoryPressure = 0
    }
  }

  getMemoryPressure(): number {
    return this.memoryPressure
  }
}

// Virtual scrolling for large lists on mobile
export const useVirtualScroll = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 5
) => {
  const [scrollTop, setScrollTop] = useState(0)
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null)

  const totalHeight = items.length * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )

  const visibleItems = items.slice(startIndex, endIndex + 1).map((item, index) => ({
    item,
    index: startIndex + index,
    style: {
      position: 'absolute' as const,
      top: (startIndex + index) * itemHeight,
      height: itemHeight,
      width: '100%',
    },
  }))

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  useEffect(() => {
    if (containerRef) {
      setScrollTop(containerRef.scrollTop)
    }
  }, [containerRef])

  return {
    containerRef: setContainerRef,
    totalHeight,
    visibleItems,
    onScroll: handleScroll,
  }
}

// Touch gesture optimization for mobile
export const useOptimizedTouch = () => {
  const [touchState, setTouchState] = useState({
    isTouching: false,
    touchStart: { x: 0, y: 0 },
    touchCurrent: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    gesture: null as 'tap' | 'pan' | 'pinch' | 'swipe' | null,
  })

  const lastTouchTime = useRef(Date.now())
  const touchHistory = useRef<Array<{ x: number; y: number; time: number }>>([])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0]
    const now = Date.now()

    setTouchState(prev => ({
      ...prev,
      isTouching: true,
      touchStart: { x: touch.clientX, y: touch.clientY },
      touchCurrent: { x: touch.clientX, y: touch.clientY },
      gesture: null,
    }))

    lastTouchTime.current = now
    touchHistory.current = [{ x: touch.clientX, y: touch.clientY, time: now }]
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const now = Date.now()

      setTouchState(prev => {
        const deltaX = touch.clientX - prev.touchCurrent.x
        const deltaY = touch.clientY - prev.touchCurrent.y
        const deltaTime = now - lastTouchTime.current

        let gesture: 'tap' | 'pan' | 'pinch' | 'swipe' | null = prev.gesture

        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            gesture = deltaX > 0 ? 'pan' : 'pan'
          } else {
            gesture = 'pan'
          }
        }

        // Calculate velocity for swipe detection
        const velocity =
          deltaTime > 0
            ? {
                x: deltaX / deltaTime,
                y: deltaY / deltaTime,
              }
            : { x: 0, y: 0 }

        return {
          ...prev,
          touchCurrent: { x: touch.clientX, y: touch.clientY },
          velocity,
          gesture,
        }
      })

      lastTouchTime.current = now
      touchHistory.current.push({ x: touch.clientX, y: touch.clientY, time: now })

      // Keep only last 10 touch points for velocity calculation
      if (touchHistory.current.length > 10) {
        touchHistory.current = touchHistory.current.slice(-10)
      }
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    const now = Date.now()
    const touchDuration = now - lastTouchTime.current

    setTouchState(prev => {
      let gesture = prev.gesture

      // Detect swipe based on velocity and distance
      if (
        touchDuration < 300 &&
        (Math.abs(prev.velocity.x) > 0.5 || Math.abs(prev.velocity.y) > 0.5)
      ) {
        gesture = 'swipe'
      } else if (touchDuration < 200) {
        gesture = 'tap'
      }

      return {
        ...prev,
        isTouching: false,
        gesture,
      }
    })

    // Clear touch history after gesture recognition
    setTimeout(() => {
      touchHistory.current = []
    }, 100)
  }, [])

  return {
    touchState,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  }
}

// Image lazy loading with mobile optimization
export const useLazyImage = (src: string, placeholder?: string) => {
  const [imageSrc, setImageSrc] = useState(placeholder || '')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const img = new Image()

    const handleLoad = () => {
      setImageSrc(src)
      setIsLoading(false)
      setError(false)
    }

    const handleError = () => {
      setError(true)
      setIsLoading(false)
    }

    img.addEventListener('load', handleLoad)
    img.addEventListener('error', handleError)

    // Use Intersection Observer for lazy loading on mobile
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            img.src = src
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => {
      img.removeEventListener('load', handleLoad)
      img.removeEventListener('error', handleError)
      observer.disconnect()
    }
  }, [src, placeholder])

  return { imageSrc, isLoading, error, imgRef }
}

// Battery-aware rendering
export const useBatteryOptimization = () => {
  const [batteryState, setBatteryState] = useState({
    level: 100,
    charging: true,
    lowPowerMode: false,
  })

  useEffect(() => {
    if ('getBattery' in navigator) {
      ;(navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          setBatteryState({
            level: Math.round(battery.level * 100),
            charging: battery.charging,
            lowPowerMode: battery.charging === false && battery.level < 0.2,
          })
        }

        updateBattery()

        battery.addEventListener('levelchange', updateBattery)
        battery.addEventListener('chargingchange', updateBattery)

        return () => {
          battery.removeEventListener('levelchange', updateBattery)
          battery.removeEventListener('chargingchange', updateBattery)
        }
      })
    }
  }, [])

  return batteryState
}

// Connection-aware loading
export const useConnectionOptimization = () => {
  const [connection, setConnection] = useState({
    effectiveType: '4g' as 'slow' | '2g' | '3g' | '4g',
    saveData: false,
    downlink: 10,
  })

  useEffect(() => {
    const updateConnection = () => {
      if ('connection' in navigator) {
        const conn = (navigator as any).connection
        if (conn) {
          setConnection({
            effectiveType: conn.effectiveType || '4g',
            saveData: conn.saveData || false,
            downlink: conn.downlink || 10,
          })
        }
      }
    }

    updateConnection()

    if ('connection' in navigator) {
      const conn = (navigator as any).connection
      if (conn) {
        conn.addEventListener('change', updateConnection)
        return () => conn.removeEventListener('change', updateConnection)
      }
    }
    return undefined
  }, [])

  const getQualitySettings = useCallback(() => {
    switch (connection.effectiveType) {
      case 'slow':
      case '2g':
        return { quality: 'low', animations: false, images: 'compressed' }
      case '3g':
        return { quality: 'medium', animations: true, images: 'optimized' }
      case '4g':
      default:
        return { quality: 'high', animations: true, images: 'full' }
    }
  }, [connection.effectiveType])

  return { connection, qualitySettings: getQualitySettings() }
}

// Component visibility optimization for mobile
export const useComponentVisibility = () => {
  const [isVisible, setIsVisible] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      {
        rootMargin: '50px',
        threshold: 0,
      }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}
