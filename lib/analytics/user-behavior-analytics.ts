/**
 * User Behavior Analytics for Planetary Agent System
 * ================================================
 *
 * Comprehensive analytics system to track user interactions,
 * feature usage, and behavioral patterns within the Planetary Agent System.
 */

import { useCallback, useEffect, useRef } from 'react'

// Analytics event types
export interface AnalyticsEvent {
  eventId: string
  timestamp: number
  sessionId: string
  userId?: string
  eventType: string
  eventCategory: string
  eventAction: string
  eventLabel?: string
  eventValue?: number
  metadata?: Record<string, any>
  userAgent: string
  url: string
  referrer?: string
  viewport: {
    width: number
    height: number
  }
  device: {
    type: 'desktop' | 'tablet' | 'mobile'
    touch: boolean
    platform: string
  }
  performance: {
    loadTime: number
    domReady: number
    firstPaint: number
    largestContentfulPaint: number
  }
}

// Session management
export interface UserSession {
  sessionId: string
  startTime: number
  lastActivity: number
  pageViews: number
  events: AnalyticsEvent[]
  userJourney: string[]
  featureUsage: Record<string, number>
  agentInteractions: {
    totalChats: number
    uniqueAgents: Set<string>
    councilSessions: number
    averageResponseTime: number
    consciousnessGrowth: number
  }
  zodiacExploration: {
    degreesViewed: Set<number>
    signsExplored: Set<string>
    agentsActivated: Set<string>
    interactionTime: number
  }
  technicalMetrics: {
    errors: number
    performanceIssues: number
    browserCrashes: number
    networkFailures: number
  }
}

class AnalyticsManager {
  private static instance: AnalyticsManager
  private currentSession: UserSession | null = null
  private eventQueue: AnalyticsEvent[] = []
  private isInitialized = false
  private flushInterval: NodeJS.Timeout | null = null

  static getInstance(): AnalyticsManager {
    if (!AnalyticsManager.instance) {
      AnalyticsManager.instance = new AnalyticsManager()
    }
    return AnalyticsManager.instance
  }

  async initialize(userId?: string): Promise<void> {
    if (this.isInitialized) return

    try {
      // Generate or restore session
      const sessionId = this.generateSessionId()
      const existingSession = this.restoreSession(sessionId)

      this.currentSession = existingSession || {
        sessionId,
        startTime: Date.now(),
        lastActivity: Date.now(),
        pageViews: 0,
        events: [],
        userJourney: [],
        featureUsage: {},
        agentInteractions: {
          totalChats: 0,
          uniqueAgents: new Set(),
          councilSessions: 0,
          averageResponseTime: 0,
          consciousnessGrowth: 0,
        },
        zodiacExploration: {
          degreesViewed: new Set(),
          signsExplored: new Set(),
          agentsActivated: new Set(),
          interactionTime: 0,
        },
        technicalMetrics: {
          errors: 0,
          performanceIssues: 0,
          browserCrashes: 0,
          networkFailures: 0,
        },
      }

      // Track initial page load
      await this.trackEvent({
        eventType: 'page_load',
        eventCategory: 'navigation',
        eventAction: 'planetary_agents_loaded',
        metadata: {
          userId,
          timestamp: Date.now(),
        },
      })

      // Start periodic data flush
      this.startPeriodicFlush()

      // Set up unload handler
      window.addEventListener('beforeunload', () => {
        this.flushEvents(true)
      })

      // Track visibility changes
      document.addEventListener('visibilitychange', () => {
        this.trackEvent({
          eventType: 'visibility_change',
          eventCategory: 'engagement',
          eventAction: document.hidden ? 'page_hidden' : 'page_visible',
          metadata: {
            hidden: document.hidden,
            timeSpent: Date.now() - (this.currentSession?.lastActivity || Date.now()),
          },
        })
      })

      this.isInitialized = true
    } catch (error) {
      console.warn('Analytics initialization failed:', error)
    }
  }

  async trackEvent(eventData: Partial<AnalyticsEvent>): Promise<void> {
    if (!this.currentSession) return

    try {
      const event: AnalyticsEvent = {
        eventId: this.generateEventId(),
        timestamp: Date.now(),
        sessionId: this.currentSession.sessionId,
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        device: this.detectDevice(),
        performance: this.getPerformanceMetrics(),
        ...eventData,
      } as AnalyticsEvent

      // Add to session events
      this.currentSession.events.push(event)
      this.currentSession.lastActivity = Date.now()

      // Add to queue for batch processing
      this.eventQueue.push(event)

      // Process specific event types
      this.processSpecializedTracking(event)

      // Auto-flush if queue gets large
      if (this.eventQueue.length >= 10) {
        this.flushEvents()
      }
    } catch (error) {
      console.warn('Event tracking failed:', error)
    }
  }

  private processSpecializedTracking(event: AnalyticsEvent): void {
    if (!this.currentSession) return

    const { eventType, eventCategory, eventAction, metadata } = event

    // Agent interaction tracking
    if (eventCategory === 'agent_chat') {
      this.currentSession.agentInteractions.totalChats++

      if (metadata?.agentId) {
        this.currentSession.agentInteractions.uniqueAgents.add(metadata.agentId)
      }

      if (eventAction === 'council_started') {
        this.currentSession.agentInteractions.councilSessions++
      }

      if (metadata?.consciousnessGrowth) {
        this.currentSession.agentInteractions.consciousnessGrowth += metadata.consciousnessGrowth
      }
    }

    // Zodiac exploration tracking
    if (eventCategory === 'zodiac_wheel') {
      if (metadata?.degree !== undefined) {
        this.currentSession.zodiacExploration.degreesViewed.add(metadata.degree)

        // Determine sign from degree
        const signs = [
          'Aries',
          'Taurus',
          'Gemini',
          'Cancer',
          'Leo',
          'Virgo',
          'Libra',
          'Scorpio',
          'Sagittarius',
          'Capricorn',
          'Aquarius',
          'Pisces',
        ]
        const signIndex = Math.floor(metadata.degree / 30) % 12
        this.currentSession.zodiacExploration.signsExplored.add(signs[signIndex])
      }

      if (metadata?.agentId) {
        this.currentSession.zodiacExploration.agentsActivated.add(metadata.agentId)
      }

      if (metadata?.interactionTime) {
        this.currentSession.zodiacExploration.interactionTime += metadata.interactionTime
      }
    }

    // Feature usage tracking
    if (eventCategory === 'feature_usage') {
      this.currentSession.featureUsage[eventAction] =
        (this.currentSession.featureUsage[eventAction] || 0) + 1
    }

    // Technical issue tracking
    if (eventCategory === 'error') {
      this.currentSession.technicalMetrics.errors++
    }

    if (eventCategory === 'performance') {
      this.currentSession.technicalMetrics.performanceIssues++
    }

    // User journey tracking
    if (eventType === 'page_view' || eventType === 'tab_switch') {
      this.currentSession.pageViews++
      this.currentSession.userJourney.push(`${eventCategory}:${eventAction}`)
    }
  }

  private detectDevice(): AnalyticsEvent['device'] {
    const ua = navigator.userAgent
    const isMobile = /Mobi|Android/i.test(ua)
    const isTablet = /Tablet|iPad/i.test(ua)

    let type: 'desktop' | 'tablet' | 'mobile' = 'desktop'
    if (isTablet) type = 'tablet'
    else if (isMobile) type = 'mobile'

    return {
      type,
      touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      platform: navigator.platform,
    }
  }

  private getPerformanceMetrics(): AnalyticsEvent['performance'] {
    const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const paint = performance.getEntriesByType('paint')

    return {
      loadTime: perf?.loadEventEnd - perf?.fetchStart || 0,
      domReady: perf?.domContentLoadedEventEnd - perf?.fetchStart || 0,
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
      largestContentfulPaint:
        (performance as any).getEntriesByType('largest-contentful-paint')[0]?.startTime || 0,
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private restoreSession(sessionId: string): UserSession | null {
    try {
      const stored = localStorage.getItem(`planetary_agents_session_${sessionId}`)
      if (stored) {
        const session = JSON.parse(stored)
        // Restore Sets from arrays
        session.agentInteractions.uniqueAgents = new Set(session.agentInteractions.uniqueAgents)
        session.zodiacExploration.degreesViewed = new Set(session.zodiacExploration.degreesViewed)
        session.zodiacExploration.signsExplored = new Set(session.zodiacExploration.signsExplored)
        session.zodiacExploration.agentsActivated = new Set(
          session.zodiacExploration.agentsActivated
        )
        return session
      }
    } catch (error) {
      console.warn('Session restore failed:', error)
    }
    return null
  }

  private saveSession(): void {
    if (!this.currentSession) return

    try {
      // Convert Sets to arrays for storage
      const sessionForStorage = {
        ...this.currentSession,
        agentInteractions: {
          ...this.currentSession.agentInteractions,
          uniqueAgents: Array.from(this.currentSession.agentInteractions.uniqueAgents),
        },
        zodiacExploration: {
          ...this.currentSession.zodiacExploration,
          degreesViewed: Array.from(this.currentSession.zodiacExploration.degreesViewed),
          signsExplored: Array.from(this.currentSession.zodiacExploration.signsExplored),
          agentsActivated: Array.from(this.currentSession.zodiacExploration.agentsActivated),
        },
      }

      localStorage.setItem(
        `planetary_agents_session_${this.currentSession.sessionId}`,
        JSON.stringify(sessionForStorage)
      )
    } catch (error) {
      console.warn('Session save failed:', error)
    }
  }

  private async flushEvents(immediate = false): Promise<void> {
    if (this.eventQueue.length === 0) return

    try {
      const eventsToSend = [...this.eventQueue]
      this.eventQueue = []

      // Send to analytics endpoint (implement server-side collection)
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/analytics/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: eventsToSend }),
        })
      }

      // Save session state
      this.saveSession()
    } catch (error) {
      console.warn('Event flush failed:', error)
      // Re-queue events for retry
      this.eventQueue.unshift(...this.eventQueue)
    }
  }

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushEvents()
    }, 30000) // Flush every 30 seconds
  }

  // Public API methods
  getCurrentSession(): UserSession | null {
    return this.currentSession
  }

  getAnalyticsSummary(): {
    sessionDuration: number
    totalEvents: number
    featureUsage: Record<string, number>
    agentEngagement: {
      chatsStarted: number
      uniqueAgents: number
      councilSessions: number
      consciousnessGrowth: number
    }
    explorationMetrics: {
      degreesExplored: number
      signsVisited: number
      agentsActivated: number
      interactionTime: number
    }
    technicalHealth: {
      errorRate: number
      performanceScore: number
    }
  } | null {
    if (!this.currentSession) return null

    const sessionDuration = Date.now() - this.currentSession.startTime
    const totalEvents = this.currentSession.events.length

    return {
      sessionDuration,
      totalEvents,
      featureUsage: this.currentSession.featureUsage,
      agentEngagement: {
        chatsStarted: this.currentSession.agentInteractions.totalChats,
        uniqueAgents: this.currentSession.agentInteractions.uniqueAgents.size,
        councilSessions: this.currentSession.agentInteractions.councilSessions,
        consciousnessGrowth: this.currentSession.agentInteractions.consciousnessGrowth,
      },
      explorationMetrics: {
        degreesExplored: this.currentSession.zodiacExploration.degreesViewed.size,
        signsVisited: this.currentSession.zodiacExploration.signsExplored.size,
        agentsActivated: this.currentSession.zodiacExploration.agentsActivated.size,
        interactionTime: this.currentSession.zodiacExploration.interactionTime,
      },
      technicalHealth: {
        errorRate: this.currentSession.technicalMetrics.errors / Math.max(totalEvents, 1),
        performanceScore: this.currentSession.technicalMetrics.performanceIssues === 0 ? 1 : 0,
      },
    }
  }

  // Cleanup
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flushEvents(true)
    this.isInitialized = false
  }
}

// React hooks for analytics
export const useAnalytics = () => {
  const analyticsRef = useRef(AnalyticsManager.getInstance())

  useEffect(() => {
    analyticsRef.current.initialize()

    return () => {
      analyticsRef.current.destroy()
    }
  }, [])

  const trackEvent = useCallback((eventData: Partial<AnalyticsEvent>) => {
    analyticsRef.current.trackEvent(eventData)
  }, [])

  const trackFeatureUsage = useCallback(
    (feature: string, metadata?: Record<string, any>) => {
      trackEvent({
        eventType: 'feature_interaction',
        eventCategory: 'feature_usage',
        eventAction: feature,
        metadata,
      })
    },
    [trackEvent]
  )

  const trackAgentInteraction = useCallback(
    (agentId: string, action: string, metadata?: Record<string, any>) => {
      trackEvent({
        eventType: 'agent_interaction',
        eventCategory: 'agent_chat',
        eventAction: action,
        eventLabel: agentId,
        metadata: { agentId, ...metadata },
      })
    },
    [trackEvent]
  )

  const trackZodiacInteraction = useCallback(
    (degree: number, action: string, metadata?: Record<string, any>) => {
      trackEvent({
        eventType: 'zodiac_interaction',
        eventCategory: 'zodiac_wheel',
        eventAction: action,
        eventValue: degree,
        metadata: { degree, ...metadata },
      })
    },
    [trackEvent]
  )

  const trackError = useCallback(
    (error: Error, context?: string) => {
      trackEvent({
        eventType: 'error_occurred',
        eventCategory: 'error',
        eventAction: error.name,
        eventLabel: context,
        metadata: {
          message: error.message,
          stack: error.stack,
          context,
        },
      })
    },
    [trackEvent]
  )

  const getAnalyticsSummary = useCallback(() => {
    return analyticsRef.current.getAnalyticsSummary()
  }, [])

  return {
    trackEvent,
    trackFeatureUsage,
    trackAgentInteraction,
    trackZodiacInteraction,
    trackError,
    getAnalyticsSummary,
  }
}

// Specialized tracking hooks
export const useAgentChatAnalytics = (agentId: string) => {
  const { trackAgentInteraction } = useAnalytics()

  const trackChatStart = useCallback(() => {
    trackAgentInteraction(agentId, 'chat_started')
  }, [agentId, trackAgentInteraction])

  const trackMessageSent = useCallback(
    (messageLength: number) => {
      trackAgentInteraction(agentId, 'message_sent', { messageLength })
    },
    [agentId, trackAgentInteraction]
  )

  const trackResponseReceived = useCallback(
    (responseTime: number, consciousnessGrowth: number) => {
      trackAgentInteraction(agentId, 'response_received', {
        responseTime,
        consciousnessGrowth,
      })
    },
    [agentId, trackAgentInteraction]
  )

  const trackChatEnd = useCallback(
    (duration: number, messageCount: number) => {
      trackAgentInteraction(agentId, 'chat_ended', {
        duration,
        messageCount,
      })
    },
    [agentId, trackAgentInteraction]
  )

  return {
    trackChatStart,
    trackMessageSent,
    trackResponseReceived,
    trackChatEnd,
  }
}

export const useZodiacAnalytics = () => {
  const { trackZodiacInteraction } = useAnalytics()

  const trackDegreeClick = useCallback(
    (degree: number, sign: string) => {
      trackZodiacInteraction(degree, 'degree_clicked', { sign })
    },
    [trackZodiacInteraction]
  )

  const trackWheelZoom = useCallback(
    (zoomLevel: number) => {
      trackZodiacInteraction(0, 'wheel_zoomed', { zoomLevel })
    },
    [trackZodiacInteraction]
  )

  const trackWheelRotate = useCallback(
    (rotation: number) => {
      trackZodiacInteraction(0, 'wheel_rotated', { rotation })
    },
    [trackZodiacInteraction]
  )

  const trackAgentActivation = useCallback(
    (degree: number, agentId: string, strength: number) => {
      trackZodiacInteraction(degree, 'agent_activated', {
        agentId,
        strength,
      })
    },
    [trackZodiacInteraction]
  )

  return {
    trackDegreeClick,
    trackWheelZoom,
    trackWheelRotate,
    trackAgentActivation,
  }
}

export const usePerformanceAnalytics = () => {
  const { trackEvent } = useAnalytics()

  const trackPerformanceMetric = useCallback(
    (metric: string, value: number, threshold?: number) => {
      const isIssue = threshold && value > threshold

      trackEvent({
        eventType: 'performance_metric',
        eventCategory: 'performance',
        eventAction: metric,
        eventValue: value,
        metadata: {
          threshold,
          isIssue,
          timestamp: Date.now(),
        },
      })
    },
    [trackEvent]
  )

  const trackLoadTime = useCallback(
    (loadTime: number) => {
      trackPerformanceMetric('page_load_time', loadTime, 3000)
    },
    [trackPerformanceMetric]
  )

  const trackInteractionLatency = useCallback(
    (action: string, latency: number) => {
      trackPerformanceMetric(`interaction_latency_${action}`, latency, 100)
    },
    [trackPerformanceMetric]
  )

  const trackMemoryUsage = useCallback(
    (used: number, total: number) => {
      const usagePercent = (used / total) * 100
      trackPerformanceMetric('memory_usage_percent', usagePercent, 80)
    },
    [trackPerformanceMetric]
  )

  return {
    trackPerformanceMetric,
    trackLoadTime,
    trackInteractionLatency,
    trackMemoryUsage,
  }
}

export default AnalyticsManager
