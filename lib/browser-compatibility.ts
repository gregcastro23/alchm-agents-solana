/**
 * Browser Compatibility & Polyfills
 * ================================
 *
 * Comprehensive browser compatibility testing and polyfill management
 * for the Planetary Agent Transit System.
 */

import { useEffect, useState } from 'react'

// Browser detection utilities
export interface BrowserInfo {
  name: string
  version: string
  engine: string
  isMobile: boolean
  isSupported: boolean
  missingFeatures: string[]
  recommendedAction?: string
}

export const detectBrowser = (): BrowserInfo => {
  const ua = navigator.userAgent
  const isMobile = /Mobi|Android/i.test(ua)

  // Browser detection
  let name = 'Unknown'
  let version = '0'
  let engine = 'Unknown'

  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    name = 'Chrome'
    const match = ua.match(/Chrome\/(\d+)/)
    version = match ? match[1] : '0'
    engine = 'Blink'
  } else if (ua.includes('Firefox')) {
    name = 'Firefox'
    const match = ua.match(/Firefox\/(\d+)/)
    version = match ? match[1] : '0'
    engine = 'Gecko'
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    name = 'Safari'
    const match = ua.match(/Version\/(\d+)/)
    version = match ? match[1] : '0'
    engine = 'WebKit'
  } else if (ua.includes('Edg')) {
    name = 'Edge'
    const match = ua.match(/Edg\/(\d+)/)
    version = match ? match[1] : '0'
    engine = 'Blink'
  } else if (ua.includes('Opera')) {
    name = 'Opera'
    const match = ua.match(/OPR\/(\d+)/)
    version = match ? match[1] : '0'
    engine = 'Blink'
  }

  // Feature detection
  const missingFeatures: string[] = []

  // ES6 Features
  if (!window.Promise) missingFeatures.push('Promises')
  if (!window.fetch) missingFeatures.push('Fetch API')
  if (!window.Map) missingFeatures.push('Map')
  if (!window.Set) missingFeatures.push('Set')
  if (!Array.prototype.includes) missingFeatures.push('Array.includes')
  if (!String.prototype.includes) missingFeatures.push('String.includes')

  // Modern APIs
  if (!('IntersectionObserver' in window)) missingFeatures.push('Intersection Observer')
  if (!('ResizeObserver' in window)) missingFeatures.push('Resize Observer')
  if (!('requestAnimationFrame' in window)) missingFeatures.push('requestAnimationFrame')
  if (!('performance' in window)) missingFeatures.push('Performance API')

  // SVG and Canvas
  const canvas = document.createElement('canvas')
  if (!(canvas.getContext && canvas.getContext('2d'))) missingFeatures.push('Canvas 2D')

  // Touch events for mobile
  if (isMobile && !('ontouchstart' in window)) missingFeatures.push('Touch Events')

  // WebGL for advanced graphics
  let hasWebGL = false
  try {
    hasWebGL = !!(window.WebGLRenderingContext && canvas.getContext('webgl'))
  } catch {
    // Context creation can throw on blocked/headless GPUs — treat as unsupported.
  }
  if (!hasWebGL) missingFeatures.push('WebGL')

  // Minimum version requirements
  const minVersions = {
    Chrome: 90,
    Firefox: 88,
    Safari: 14,
    Edge: 90,
    Opera: 76,
  }

  const minVersion = minVersions[name as keyof typeof minVersions] || 0
  const versionNum = parseInt(version)
  const isSupported = versionNum >= minVersion && missingFeatures.length === 0

  let recommendedAction: string | undefined
  if (!isSupported) {
    if (versionNum < minVersion) {
      recommendedAction = `Update ${name} to version ${minVersion} or higher`
    } else if (missingFeatures.length > 0) {
      recommendedAction = 'Install modern browser or enable missing features'
    }
  }

  return {
    name,
    version,
    engine,
    isMobile,
    isSupported,
    missingFeatures,
    recommendedAction,
  }
}

// Polyfill manager
export class PolyfillManager {
  private static loadedPolyfills = new Set<string>()

  static async loadPolyfill(feature: string): Promise<void> {
    if (this.loadedPolyfills.has(feature)) return

    switch (feature) {
      case 'Promises':
        await this.loadScript('https://cdn.jsdelivr.net/npm/es6-promise@4/dist/es6-promise.auto.js')
        break
      case 'Fetch API':
        await this.loadScript('https://cdn.jsdelivr.net/npm/whatwg-fetch@3/dist/fetch.umd.js')
        break
      case 'Intersection Observer':
        await this.loadScript(
          'https://polyfill.io/v3/polyfill.min.js?features=IntersectionObserver'
        )
        break
      case 'Resize Observer':
        await this.loadScript(
          'https://cdn.jsdelivr.net/npm/resize-observer-polyfill@1/dist/ResizeObserver.global.js'
        )
        break
      case 'requestAnimationFrame':
        // Fallback implementation
        if (!window.requestAnimationFrame) {
          window.requestAnimationFrame = callback => setTimeout(callback, 16)
        }
        break
      case 'Performance API':
        // Basic fallback
        if (!window.performance) {
          window.performance = { now: () => Date.now() } as any
        }
        break
    }

    this.loadedPolyfills.add(feature)
  }

  static async loadEssentialPolyfills(): Promise<void> {
    const browser = detectBrowser()
    const polyfills = [
      'Promises',
      'Fetch API',
      'Intersection Observer',
      'Resize Observer',
      'requestAnimationFrame',
      'Performance API',
    ]

    const loadPromises = polyfills
      .filter(polyfill => browser.missingFeatures.includes(polyfill))
      .map(polyfill => this.loadPolyfill(polyfill))

    await Promise.all(loadPromises)
  }

  private static async loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load ${src}`))
      document.head.appendChild(script)
    })
  }
}

// Browser compatibility hook
export const useBrowserCompatibility = () => {
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null)
  const [polyfillsLoaded, setPolyfillsLoaded] = useState(false)
  const [compatibilityStatus, setCompatibilityStatus] = useState<
    'checking' | 'compatible' | 'incompatible' | 'polyfilled'
  >('checking')

  useEffect(() => {
    const checkCompatibility = async () => {
      const info = detectBrowser()
      setBrowserInfo(info)

      if (info.isSupported) {
        setCompatibilityStatus('compatible')
        return
      }

      // Try loading polyfills for missing features
      try {
        await PolyfillManager.loadEssentialPolyfills()
        setPolyfillsLoaded(true)

        // Re-check after polyfills
        const recheckInfo = detectBrowser()
        setCompatibilityStatus(recheckInfo.isSupported ? 'polyfilled' : 'incompatible')
      } catch (error) {
        console.warn('Failed to load polyfills:', error)
        setCompatibilityStatus('incompatible')
      }
    }

    checkCompatibility()
  }, [])

  return {
    browserInfo,
    compatibilityStatus,
    polyfillsLoaded,
    isCompatible: compatibilityStatus === 'compatible' || compatibilityStatus === 'polyfilled',
  }
}

// CSS custom property support detection
export const detectCSSSupport = () => {
  const testEl = document.createElement('div')
  const supports = {
    cssVariables: CSS && CSS.supports('color', 'var(--test)'),
    cssGrid: CSS && CSS.supports('display', 'grid'),
    cssFlexbox: CSS && CSS.supports('display', 'flex'),
    cssTransforms: 'transform' in testEl.style,
    cssAnimations: 'animation' in testEl.style,
    cssTransitions: 'transition' in testEl.style,
    backdropFilter: 'backdropFilter' in testEl.style || 'webkitBackdropFilter' in testEl.style,
  }

  return supports
}

// Feature detection for specific planetary agent features
export const detectPlanetaryAgentSupport = () => {
  const canvas = document.createElement('canvas')
  const supports = {
    svg:
      !!document.createElementNS && !!document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    canvas: !!(canvas.getContext && canvas.getContext('2d')),
    webgl: (() => {
      try {
        return !!(window.WebGLRenderingContext && canvas.getContext('webgl'))
      } catch (e) {
        return false
      }
    })(),
    touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    geolocation: 'geolocation' in navigator,
    localStorage: (() => {
      try {
        localStorage.setItem('test', 'test')
        localStorage.removeItem('test')
        return true
      } catch (e) {
        return false
      }
    })(),
    indexedDB: 'indexedDB' in window,
    webWorkers: 'Worker' in window,
    serviceWorkers: 'serviceWorker' in navigator,
    webRTC: 'RTCPeerConnection' in window,
    webAudio: 'AudioContext' in window || 'webkitAudioContext' in window,
  }

  return supports
}

// Performance optimization based on browser capabilities
export const getBrowserOptimizations = (browserInfo: BrowserInfo) => {
  const optimizations = {
    reduceAnimations: false,
    useCanvasFallback: false,
    disableWebGL: false,
    reduceQuality: false,
    enableLazyLoading: true,
    useVirtualScrolling: false,
    limitConcurrentRequests: false,
  }

  // Mobile optimizations
  if (browserInfo.isMobile) {
    optimizations.reduceAnimations = true
    optimizations.useVirtualScrolling = true
    optimizations.limitConcurrentRequests = true
  }

  // Older browser optimizations
  const version = parseInt(browserInfo.version)
  if (browserInfo.name === 'Safari' && version < 15) {
    optimizations.disableWebGL = true
    optimizations.useCanvasFallback = true
  }

  if (browserInfo.name === 'Firefox' && version < 90) {
    optimizations.reduceQuality = true
  }

  // Memory-constrained environments
  if (browserInfo.missingFeatures.length > 2) {
    optimizations.reduceAnimations = true
    optimizations.reduceQuality = true
  }

  return optimizations
}

// Browser-specific CSS fixes
export const applyBrowserFixes = (browserInfo: BrowserInfo) => {
  const root = document.documentElement

  // Safari flexbox fixes
  if (browserInfo.name === 'Safari') {
    root.style.setProperty('--safari-flex-fix', '1')
  }

  // Firefox transform fixes
  if (browserInfo.name === 'Firefox') {
    root.style.setProperty('--firefox-transform-fix', '1')
  }

  // Mobile viewport fixes
  if (browserInfo.isMobile) {
    const viewport = document.querySelector('meta[name=viewport]')
    if (viewport) {
      viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover'
      )
    }
  }
}
