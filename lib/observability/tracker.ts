/**
 * Agent Observability Tracker
 * Implements comprehensive tracking for multi-agent interactions
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  ObservabilityTrace,
  ObservabilitySession,
  AgentObservabilityMetrics,
  ToolInvocation,
  AgentRoutingDecision,
  ObservabilityError,
  ObservabilityInsight,
  MonicaRoutingAnalysis,
  AgentPerformanceBenchmark,
  PERFORMANCE_THRESHOLDS,
} from './types'

/**
 * In-memory storage for observability data
 * In production, this would be replaced with database storage
 */
class ObservabilityStore {
  private sessions: Map<string, ObservabilitySession> = new Map()
  private traces: Map<string, ObservabilityTrace> = new Map()
  private insights: Map<string, ObservabilityInsight> = new Map()

  // Add trace to storage
  addTrace(trace: ObservabilityTrace): void {
    this.traces.set(trace.traceId, trace)

    // Add to session
    let session = this.sessions.get(trace.sessionId)
    if (!session) {
      session = this.createSession(trace.sessionId, trace.timestamp)
    }
    session.traces.push(trace)
    this.updateSessionMetrics(session)
  }

  // Get all traces for a session
  getSessionTraces(sessionId: string): ObservabilityTrace[] {
    const session = this.sessions.get(sessionId)
    return session?.traces || []
  }

  // Get session
  getSession(sessionId: string): ObservabilitySession | undefined {
    return this.sessions.get(sessionId)
  }

  // Create new session
  private createSession(sessionId: string, startTime: Date): ObservabilitySession {
    const session: ObservabilitySession = {
      sessionId,
      startTime,
      chatType: 'group',
      traces: [],
      sessionMetrics: {
        totalMessages: 0,
        totalAgents: 0,
        avgResponseTime: 0,
        actionCompletionRate: 0,
        errorRate: 0,
      },
      insights: [],
    }
    this.sessions.set(sessionId, session)
    return session
  }

  // Update session metrics based on traces
  private updateSessionMetrics(session: ObservabilitySession): void {
    const traces = session.traces

    if (traces.length === 0) return

    session.sessionMetrics = {
      totalMessages: traces.length,
      totalAgents: new Set(traces.map(t => t.agentId)).size,
      avgResponseTime: traces.reduce((sum, t) => sum + t.metrics.latencyMs, 0) / traces.length,
      actionCompletionRate:
        traces.reduce((sum, t) => sum + t.metrics.actionCompletion, 0) / traces.length,
      errorRate: traces.filter(t => t.errors.length > 0).length / traces.length,
    }
  }

  // Get all sessions in time range
  getSessionsInRange(start: Date, end: Date): ObservabilitySession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.startTime >= start && s.startTime <= end
    )
  }

  // Add insight
  addInsight(insight: ObservabilityInsight): void {
    this.insights.set(insight.insightId, insight)
  }

  // Get all insights
  getInsights(timeWindow?: { start: Date; end: Date }): ObservabilityInsight[] {
    const allInsights = Array.from(this.insights.values())
    if (!timeWindow) return allInsights

    return allInsights.filter(
      i => i.timeWindow.start >= timeWindow.start && i.timeWindow.end <= timeWindow.end
    )
  }

  // Clear old data (retention policy)
  cleanupOldData(retentionDays: number = 30): void {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    // Remove old sessions
    this.sessions.forEach((session, sessionId) => {
      if (session.startTime < cutoffDate) {
        this.sessions.delete(sessionId)
      }
    })

    // Remove old traces
    this.traces.forEach((trace, traceId) => {
      if (trace.timestamp < cutoffDate) {
        this.traces.delete(traceId)
      }
    })

    // Remove old insights
    this.insights.forEach((insight, insightId) => {
      if (insight.timestamp < cutoffDate) {
        this.insights.delete(insightId)
      }
    })
  }
}

/**
 * Main observability tracker class
 */
export class AgentObservabilityTracker {
  private store: ObservabilityStore
  private activeTraces: Map<string, Partial<ObservabilityTrace>> = new Map()

  constructor() {
    this.store = new ObservabilityStore()
  }

  /**
   * Start tracking a new agent interaction
   */
  startTrace(
    sessionId: string,
    agentId: string,
    agentType: string,
    agentName: string,
    userMessage: string
  ): string {
    const traceId = uuidv4()

    const trace: Partial<ObservabilityTrace> = {
      traceId,
      sessionId,
      timestamp: new Date(),
      agentId,
      agentType: agentType as any,
      agentName,
      userMessage,
      userIntent: [],
      routingDecisions: [],
      toolInvocations: [],
      errors: [],
    }

    this.activeTraces.set(traceId, trace)
    return traceId
  }

  /**
   * Record a tool invocation
   */
  recordToolInvocation(
    traceId: string,
    toolName: string,
    parameters: Record<string, any>,
    result: any,
    success: boolean,
    executionTimeMs: number
  ): void {
    const trace = this.activeTraces.get(traceId)
    if (!trace) return

    const invocation: ToolInvocation = {
      toolName,
      parameters,
      result,
      success,
      executionTimeMs,
      timestamp: new Date(),
    }

    trace.toolInvocations!.push(invocation)
  }

  /**
   * Record a routing decision (Monica coordinator)
   */
  recordRoutingDecision(
    traceId: string,
    fromAgent: string | null,
    toAgent: string,
    reason: string,
    confidence: number
  ): void {
    const trace = this.activeTraces.get(traceId)
    if (!trace) return

    const decision: AgentRoutingDecision = {
      fromAgent,
      toAgent,
      reason,
      confidence,
      timestamp: new Date(),
    }

    trace.routingDecisions!.push(decision)
  }

  /**
   * Record an error
   */
  recordError(
    traceId: string,
    type: ObservabilityError['type'],
    message: string,
    severity: ObservabilityError['severity'],
    context?: Record<string, any>
  ): void {
    const trace = this.activeTraces.get(traceId)
    if (!trace) return

    const error: ObservabilityError = {
      type,
      message,
      severity,
      timestamp: new Date(),
      context,
    }

    trace.errors!.push(error)
  }

  /**
   * Complete a trace with response and metrics
   */
  completeTrace(
    traceId: string,
    response: string,
    metrics: AgentObservabilityMetrics,
    modelUsed: string,
    temperature: number,
    tokensUsed?: number,
    groupContext?: ObservabilityTrace['groupContext']
  ): void {
    const trace = this.activeTraces.get(traceId)
    if (!trace) return

    const completedTrace: ObservabilityTrace = {
      ...trace,
      response,
      metrics,
      modelUsed,
      temperature,
      tokensUsed,
      groupContext,
    } as ObservabilityTrace

    // Store the completed trace
    this.store.addTrace(completedTrace)

    // Remove from active traces
    this.activeTraces.delete(traceId)

    // Analyze for insights
    this.analyzeTraceForInsights(completedTrace)
  }

  /**
   * Evaluate metrics for a trace
   * This would typically use an LLM judge for quality assessment
   */
  evaluateMetrics(
    response: string,
    userMessage: string,
    toolInvocations: ToolInvocation[],
    routingDecisions: AgentRoutingDecision[],
    latencyMs: number,
    errors: ObservabilityError[]
  ): AgentObservabilityMetrics {
    // Action Completion: Did agent fully address the request?
    const actionCompletion = this.evaluateActionCompletion(response, userMessage)

    // Tool Selection Quality: Were tools used correctly?
    const toolSelectionQuality = this.evaluateToolSelection(toolInvocations, userMessage)

    // Routing Accuracy: Did Monica route correctly?
    const routingAccuracy = this.evaluateRoutingAccuracy(routingDecisions)

    // Context Retention: Did agent remember conversation?
    const contextRetention = response.length > 50 // Simple heuristic

    // ============================================================================
    // ACTUAL CONSCIOUSNESS EVOLUTION CALCULATION
    // Replaces hardcoded 0.1 with real metrics
    // ============================================================================
    const consciousnessEvolution = this.calculateConsciousnessEvolution(
      response,
      actionCompletion,
      toolSelectionQuality,
      routingAccuracy,
      latencyMs,
      errors.length
    )

    return {
      actionCompletion,
      toolSelectionQuality,
      latencyMs,
      apiFailures: errors.filter(e => e.type === 'api_failure').length,
      consciousnessEvolution,
      routingAccuracy,
      contextRetention,
    }
  }

  /**
   * Calculate actual consciousness evolution from interaction quality
   * Combines multiple factors for accurate evolution measurement
   */
  private calculateConsciousnessEvolution(
    response: string,
    actionCompletion: number,
    toolQuality: number,
    routingAccuracy: number,
    latencyMs: number,
    errorCount: number
  ): number {
    // Base evolution from response quality
    let evolution = 0

    // Factor 1: Action Completion (40% weight)
    evolution += actionCompletion * 0.4

    // Factor 2: Tool Selection Quality (20% weight)
    evolution += toolQuality * 0.2

    // Factor 3: Routing Accuracy (15% weight)
    evolution += routingAccuracy * 0.15

    // Factor 4: Response Depth (15% weight)
    const depthScore = Math.min(1.0, response.length / 500) // Normalize to 500 chars
    evolution += depthScore * 0.15

    // Factor 5: Performance (10% weight) - faster is better
    const performanceScore = latencyMs < 2000 ? 1.0 : latencyMs < 5000 ? 0.7 : 0.4
    evolution += performanceScore * 0.1

    // Penalty for errors
    evolution *= Math.max(0.3, 1.0 - errorCount * 0.2)

    // Bonus for exceptional quality (all factors > 0.8)
    if (actionCompletion > 0.8 && toolQuality > 0.8 && routingAccuracy > 0.8 && depthScore > 0.8) {
      evolution *= 1.2 // 20% bonus
    }

    return Math.max(0, Math.min(1.0, evolution))
  }

  /**
   * Simple action completion evaluation
   * In production, use LLM-as-judge for accurate assessment
   */
  private evaluateActionCompletion(response: string, userMessage: string): number {
    // Simple heuristics - replace with LLM judge
    if (response.length < 20) return 0.3
    if (response.includes('I apologize') || response.includes("I'm sorry")) return 0.5
    if (response.length > 100 && !response.includes("I don't know")) return 0.9
    return 0.7
  }

  /**
   * Evaluate tool selection quality
   */
  private evaluateToolSelection(toolInvocations: ToolInvocation[], userMessage: string): number {
    if (toolInvocations.length === 0) {
      // No tools used - check if they should have been
      const needsTools =
        userMessage.toLowerCase().includes('calculate') ||
        userMessage.toLowerCase().includes('check') ||
        userMessage.toLowerCase().includes('find')
      return needsTools ? 0.3 : 0.9
    }

    // Calculate success rate
    const successRate = toolInvocations.filter(t => t.success).length / toolInvocations.length

    return successRate
  }

  /**
   * Evaluate routing accuracy
   */
  private evaluateRoutingAccuracy(routingDecisions: AgentRoutingDecision[]): number {
    if (routingDecisions.length === 0) return 1.0

    // Average confidence of routing decisions
    const avgConfidence =
      routingDecisions.reduce((sum, d) => sum + d.confidence, 0) / routingDecisions.length

    return avgConfidence
  }

  /**
   * Analyze trace for insights
   */
  private analyzeTraceForInsights(trace: ObservabilityTrace): void {
    // Check for low action completion
    if (trace.metrics.actionCompletion < 0.8) {
      this.generateInsight({
        type: 'quality_degradation',
        severity: 'warning',
        title: 'Low Action Completion',
        description: `Agent ${trace.agentName} (${trace.agentType}) had action completion of ${(trace.metrics.actionCompletion * 100).toFixed(0)}%`,
        affectedTraces: [trace.traceId],
        suggestedAction: 'Review agent prompt and ensure it fully addresses user requests',
        frequency: 1,
        timeWindow: {
          start: trace.timestamp,
          end: trace.timestamp,
        },
      })
    }

    // Check for high latency
    if (trace.metrics.latencyMs > 8000) {
      this.generateInsight({
        type: 'pattern',
        severity: 'warning',
        title: 'High Latency Detected',
        description: `Response took ${(trace.metrics.latencyMs / 1000).toFixed(1)}s for ${trace.agentName}`,
        affectedTraces: [trace.traceId],
        suggestedAction: 'Check for slow tool calls or optimize model selection',
        frequency: 1,
        timeWindow: {
          start: trace.timestamp,
          end: trace.timestamp,
        },
      })
    }

    // Check for errors
    if (trace.errors.length > 0) {
      const criticalErrors = trace.errors.filter(e => e.severity === 'critical')
      if (criticalErrors.length > 0) {
        this.generateInsight({
          type: 'failure',
          severity: 'critical',
          title: 'Critical Errors in Agent Response',
          description: `${criticalErrors.length} critical error(s) in ${trace.agentName}`,
          affectedTraces: [trace.traceId],
          suggestedAction: `Review errors: ${criticalErrors.map(e => e.message).join(', ')}`,
          frequency: criticalErrors.length,
          timeWindow: {
            start: trace.timestamp,
            end: trace.timestamp,
          },
        })
      }
    }
  }

  /**
   * Generate insight
   */
  private generateInsight(insight: Omit<ObservabilityInsight, 'insightId' | 'timestamp'>): void {
    const fullInsight: ObservabilityInsight = {
      ...insight,
      insightId: uuidv4(),
      timestamp: new Date(),
    }

    this.store.addInsight(fullInsight)
  }

  /**
   * Get session data
   */
  getSession(sessionId: string): ObservabilitySession | undefined {
    return this.store.getSession(sessionId)
  }

  /**
   * Get all insights
   */
  getInsights(timeWindow?: { start: Date; end: Date }): ObservabilityInsight[] {
    return this.store.getInsights(timeWindow)
  }

  /**
   * Get performance benchmarks for an agent
   */
  getAgentBenchmark(
    agentId: string,
    timeWindow: { start: Date; end: Date }
  ): AgentPerformanceBenchmark | null {
    const sessions = this.store.getSessionsInRange(timeWindow.start, timeWindow.end)
    const traces = sessions.flatMap(s => s.traces).filter(t => t.agentId === agentId)

    if (traces.length === 0) return null

    const avgMetrics = this.calculateAverageMetrics(traces)
    const rating = this.calculateRating(avgMetrics)

    return {
      agentId,
      agentType: traces[0].agentType,
      timeWindow,
      averageMetrics: avgMetrics,
      rating,
      actionCompletionTrend: 'stable',
      latencyTrend: 'stable',
      totalInteractions: traces.length,
      totalErrors: traces.reduce((sum, t) => sum + t.errors.length, 0),
      commonFailures: [],
      slowestOperations: [],
    }
  }

  /**
   * Calculate average metrics across traces
   */
  private calculateAverageMetrics(traces: ObservabilityTrace[]): AgentObservabilityMetrics {
    const sum = traces.reduce(
      (acc, t) => ({
        actionCompletion: acc.actionCompletion + t.metrics.actionCompletion,
        toolSelectionQuality: acc.toolSelectionQuality + t.metrics.toolSelectionQuality,
        latencyMs: acc.latencyMs + t.metrics.latencyMs,
        apiFailures: acc.apiFailures + t.metrics.apiFailures,
        consciousnessEvolution: acc.consciousnessEvolution + t.metrics.consciousnessEvolution,
        routingAccuracy: acc.routingAccuracy + t.metrics.routingAccuracy,
        contextRetention: acc.contextRetention,
      }),
      {
        actionCompletion: 0,
        toolSelectionQuality: 0,
        latencyMs: 0,
        apiFailures: 0,
        consciousnessEvolution: 0,
        routingAccuracy: 0,
        contextRetention: true,
      }
    )

    const count = traces.length

    return {
      actionCompletion: sum.actionCompletion / count,
      toolSelectionQuality: sum.toolSelectionQuality / count,
      latencyMs: sum.latencyMs / count,
      apiFailures: sum.apiFailures / count,
      consciousnessEvolution: sum.consciousnessEvolution / count,
      routingAccuracy: sum.routingAccuracy / count,
      contextRetention: sum.contextRetention,
    }
  }

  /**
   * Calculate performance rating
   */
  private calculateRating(
    metrics: AgentObservabilityMetrics
  ): 'excellent' | 'good' | 'needs_improvement' {
    const thresholds = {
      actionCompletion: { excellent: 0.95, good: 0.85 },
      toolSelectionQuality: { excellent: 0.9, good: 0.85 },
      latencyMs: { excellent: 2000, good: 4000 },
      routingAccuracy: { excellent: 0.95, good: 0.9 },
    }

    const scores = {
      excellent: 0,
      good: 0,
      needs_improvement: 0,
    }

    // Action completion
    if (metrics.actionCompletion >= thresholds.actionCompletion.excellent) {
      scores.excellent++
    } else if (metrics.actionCompletion >= thresholds.actionCompletion.good) {
      scores.good++
    } else {
      scores.needs_improvement++
    }

    // Tool selection
    if (metrics.toolSelectionQuality >= thresholds.toolSelectionQuality.excellent) {
      scores.excellent++
    } else if (metrics.toolSelectionQuality >= thresholds.toolSelectionQuality.good) {
      scores.good++
    } else {
      scores.needs_improvement++
    }

    // Latency (lower is better)
    if (metrics.latencyMs <= thresholds.latencyMs.excellent) {
      scores.excellent++
    } else if (metrics.latencyMs <= thresholds.latencyMs.good) {
      scores.good++
    } else {
      scores.needs_improvement++
    }

    // Routing accuracy
    if (metrics.routingAccuracy >= thresholds.routingAccuracy.excellent) {
      scores.excellent++
    } else if (metrics.routingAccuracy >= thresholds.routingAccuracy.good) {
      scores.good++
    } else {
      scores.needs_improvement++
    }

    // Determine overall rating
    if (scores.needs_improvement > 1) return 'needs_improvement'
    if (scores.excellent >= 3) return 'excellent'
    return 'good'
  }

  /**
   * Analyze Monica's routing performance
   */
  analyzeMonicaRouting(sessionId: string): MonicaRoutingAnalysis | null {
    const session = this.store.getSession(sessionId)
    if (!session) return null

    const monicaTraces = session.traces.filter(t => t.agentType === 'monica')
    const allRoutingDecisions = monicaTraces.flatMap(t => t.routingDecisions)

    if (allRoutingDecisions.length === 0) return null

    // Calculate routing accuracy
    const routingAccuracy =
      allRoutingDecisions.reduce((sum, d) => sum + d.confidence, 0) / allRoutingDecisions.length

    // Find most common routes
    const routeCounts: Map<string, { count: number; totalConfidence: number }> = new Map()

    allRoutingDecisions.forEach(d => {
      const key = `${d.fromAgent || 'initial'}->${d.toAgent}`
      const current = routeCounts.get(key) || { count: 0, totalConfidence: 0 }
      routeCounts.set(key, {
        count: current.count + 1,
        totalConfidence: current.totalConfidence + d.confidence,
      })
    })

    const mostCommonRoutes = Array.from(routeCounts.entries())
      .map(([route, data]) => ({
        fromAgent: route.split('->')[0] === 'initial' ? null : route.split('->')[0],
        toAgent: route.split('->')[1],
        count: data.count,
        avgConfidence: data.totalConfidence / data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      sessionId,
      totalRoutings: allRoutingDecisions.length,
      routingAccuracy,
      mostCommonRoutes,
      incorrectRoutings: [],
      avgRoutingLatency:
        monicaTraces.reduce((sum, t) => sum + t.metrics.latencyMs, 0) / monicaTraces.length,
      handoffCount: allRoutingDecisions.filter(d => d.fromAgent !== null).length,
      contextLossIncidents: 0,
    }
  }
}

// Singleton instance
export const observabilityTracker = new AgentObservabilityTracker()
