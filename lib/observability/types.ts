/**
 * Observability Types for Agent Tracking
 * Based on Galileo multi-agent observability best practices
 */

export interface AgentObservabilityMetrics {
  // Core Quality Metrics
  actionCompletion: number // 0-1 score: Did the agent fully address the user's request?
  toolSelectionQuality: number // 0-1 score: Did the agent choose the right tools with correct parameters?

  // System Performance Metrics
  latencyMs: number // Total response time
  apiFailures: number // Count of failed API calls

  // Agent-Specific Metrics
  consciousnessEvolution: number // Did the interaction advance consciousness?
  routingAccuracy: number // For Monica: Did she route to the right agent?
  contextRetention: boolean // Did the agent remember conversation context?

  // Custom Metrics for Planetary Agents
  celestialInsightQuality?: number // Accuracy of astrological insights
  consciousnessCoherenceScore?: number // How well agent maintained consciousness level
  synergyActivation?: number // Successful multi-agent synergies activated
}

export interface ToolInvocation {
  toolName: string
  parameters: Record<string, any>
  result: any
  success: boolean
  executionTimeMs: number
  timestamp: Date
}

export interface AgentRoutingDecision {
  fromAgent: string | null // null if initial routing from Monica
  toAgent: string
  reason: string
  confidence: number // 0-1: How confident was the routing decision?
  timestamp: Date
  wasCorrect?: boolean // Evaluated post-interaction
}

export interface ObservabilityTrace {
  traceId: string
  sessionId: string
  timestamp: Date

  // User Context
  userMessage: string
  userIntent: string[] // Detected intents

  // Agent Execution
  agentId: string
  agentType: 'historical' | 'planetary' | 'monica' | 'generic'
  agentName: string

  // Routing Information (for Monica coordinator)
  routingDecisions: AgentRoutingDecision[]

  // Tool Usage
  toolInvocations: ToolInvocation[]

  // Response Quality
  response: string
  metrics: AgentObservabilityMetrics

  // Debugging Information
  modelUsed: string
  temperature: number
  tokensUsed?: number

  // Error Tracking
  errors: ObservabilityError[]

  // Group Dynamics (for multi-agent sessions)
  groupContext?: {
    totalAgents: number
    agentIds: string[]
    crossReferences: string[]
    synergiesActivated: string[]
  }
}

export interface ObservabilityError {
  type: 'api_failure' | 'tool_error' | 'routing_error' | 'timeout' | 'other'
  message: string
  timestamp: Date
  severity: 'critical' | 'warning' | 'info'
  context?: Record<string, any>
}

export interface ObservabilityInsight {
  insightId: string
  type: 'pattern' | 'failure' | 'optimization' | 'quality_degradation'
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  affectedTraces: string[]
  suggestedAction: string
  frequency: number // How many times this pattern occurred
  timeWindow: {
    start: Date
    end: Date
  }
  timestamp: Date
}

export interface AgentPerformanceBenchmark {
  agentId: string
  agentType: string
  timeWindow: {
    start: Date
    end: Date
  }

  // Aggregate Metrics
  averageMetrics: AgentObservabilityMetrics

  // Quality Ratings
  rating: 'excellent' | 'good' | 'needs_improvement'

  // Trends
  actionCompletionTrend: 'improving' | 'stable' | 'degrading'
  latencyTrend: 'improving' | 'stable' | 'degrading'

  // Volume
  totalInteractions: number
  totalErrors: number

  // Specific Issues
  commonFailures: string[]
  slowestOperations: string[]
}

export interface MonicaRoutingAnalysis {
  sessionId: string
  totalRoutings: number
  routingAccuracy: number // 0-1

  // Routing Patterns
  mostCommonRoutes: Array<{
    fromAgent: string | null
    toAgent: string
    count: number
    avgConfidence: number
  }>

  // Issues
  incorrectRoutings: Array<{
    decision: AgentRoutingDecision
    expectedAgent: string
    reason: string
  }>

  // Performance
  avgRoutingLatency: number
  handoffCount: number
  contextLossIncidents: number
}

export interface ObservabilitySession {
  sessionId: string
  startTime: Date
  endTime?: Date

  // Session Metadata
  userId?: string
  chatType: 'single' | 'group' | 'council' | 'laboratory'

  // All traces in this session
  traces: ObservabilityTrace[]

  // Session-level metrics
  sessionMetrics: {
    totalMessages: number
    totalAgents: number
    avgResponseTime: number
    actionCompletionRate: number
    errorRate: number
  }

  // Monica-specific session analysis
  monicaAnalysis?: MonicaRoutingAnalysis

  // Insights generated for this session
  insights: ObservabilityInsight[]
}

/**
 * Performance thresholds based on Galileo best practices
 */
export const PERFORMANCE_THRESHOLDS = {
  actionCompletion: {
    excellent: 0.95,
    good: 0.85,
    needsImprovement: 0.8,
  },
  toolSelectionQuality: {
    excellent: 0.9,
    good: 0.85,
    needsImprovement: 0.85,
  },
  latencyMs: {
    excellent: 2000,
    good: 4000,
    needsImprovement: 4000,
  },
  routingAccuracy: {
    excellent: 0.95,
    good: 0.9,
    needsImprovement: 0.9,
  },
} as const

/**
 * Alert configuration based on metric thresholds
 */
export interface AlertConfig {
  metric: keyof AgentObservabilityMetrics
  threshold: number
  comparison: 'less_than' | 'greater_than'
  severity: 'critical' | 'warning'
  message: string
}

export const DEFAULT_ALERTS: AlertConfig[] = [
  {
    metric: 'actionCompletion',
    threshold: 0.9,
    comparison: 'less_than',
    severity: 'critical',
    message: 'Action completion dropped below 90% - agents not fully addressing requests',
  },
  {
    metric: 'toolSelectionQuality',
    threshold: 0.85,
    comparison: 'less_than',
    severity: 'warning',
    message: 'Tool selection quality degraded - review agent tool descriptions',
  },
  {
    metric: 'latencyMs',
    threshold: 8000,
    comparison: 'greater_than',
    severity: 'warning',
    message: 'Response latency exceeding 8 seconds - check for bottlenecks',
  },
  {
    metric: 'routingAccuracy',
    threshold: 0.9,
    comparison: 'less_than',
    severity: 'critical',
    message: 'Monica routing accuracy dropped - review routing logic',
  },
]
