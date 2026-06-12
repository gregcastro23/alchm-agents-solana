/**
 * Galileo Agent MCP Integration
 * Provides structured logging for agent interactions compatible with Galileo MCP server
 */

import { UnifiedGalileoService } from './galileo-unified'

interface AgentInteraction {
  agentId: string
  agentName: string
  agentType: 'historical' | 'planetary' | 'monica'
  userMessage: string
  agentResponse: string
  sessionId: string
  momentSynergy?: {
    score: number
    description: string
    harmonicCount: number
    challengingCount: number
  }
  consciousness?: {
    level: string
    monicaConstant: number
    dominantElement: string
  }
  performance?: {
    responseTime: number
    tokenCount: number
    modelUsed: string
  }
  timestamp: Date
}

interface AgentTrace {
  traceId: string
  sessionId: string
  spans: AgentSpan[]
  metadata?: Record<string, any>
}

interface AgentSpan {
  spanId: string
  name: string
  type: 'retrieval' | 'computation' | 'generation' | 'analysis'
  status: 'success' | 'error' | 'pending'
  durationMs: number
  input?: any
  output?: any
  metadata?: Record<string, any>
}

export class GalileoAgentMCPIntegration {
  private galileo: UnifiedGalileoService

  constructor() {
    this.galileo = new UnifiedGalileoService({
      stream: 'agent-interactions',
      failSilently: true,
    })
  }

  /**
   * Log a complete agent interaction with structured tracing
   */
  async logAgentInteraction(interaction: AgentInteraction): Promise<boolean> {
    const trace: AgentTrace = {
      traceId: `${interaction.sessionId}-${Date.now()}`,
      sessionId: interaction.sessionId,
      spans: [
        {
          spanId: `${interaction.sessionId}-input`,
          name: 'user-input',
          type: 'retrieval',
          status: 'success',
          durationMs: 0,
          input: { message: interaction.userMessage },
          metadata: {
            agentId: interaction.agentId,
            agentType: interaction.agentType,
          },
        },
        {
          spanId: `${interaction.sessionId}-consciousness`,
          name: 'consciousness-analysis',
          type: 'analysis',
          status: 'success',
          durationMs: 50,
          output: interaction.consciousness,
          metadata: {
            momentSynergy: interaction.momentSynergy,
          },
        },
        {
          spanId: `${interaction.sessionId}-generation`,
          name: 'response-generation',
          type: 'generation',
          status: 'success',
          durationMs: interaction.performance?.responseTime || 0,
          output: { response: interaction.agentResponse },
          metadata: {
            modelUsed: interaction.performance?.modelUsed,
            tokenCount: interaction.performance?.tokenCount,
          },
        },
      ],
      metadata: {
        agentName: interaction.agentName,
        timestamp: interaction.timestamp.toISOString(),
        synergyScore: interaction.momentSynergy?.score,
      },
    }

    return this.galileo.logSession({
      id: interaction.sessionId,
      name: `agent-chat-${interaction.agentType}`,
      traces: [trace],
      metadata: {
        agentId: interaction.agentId,
        agentName: interaction.agentName,
        agentType: interaction.agentType,
        synergyScore: interaction.momentSynergy?.score,
        consciousnessLevel: interaction.consciousness?.level,
        responseTime: interaction.performance?.responseTime,
      },
    })
  }

  /**
   * Log synergy calculations as structured events
   */
  async logSynergyCalculation(data: {
    agentId: string
    natalChart: any
    currentMoment: Date
    synergyScore: number
    harmonicAspects: any[]
    challengingAspects: any[]
    calculationTime: number
  }): Promise<boolean> {
    return this.galileo.log({
      message: 'Synergy calculation completed',
      level: 'info',
      metadata: {
        component: 'synergy-calculator',
        agentId: data.agentId,
        synergyScore: data.synergyScore,
        harmonicCount: data.harmonicAspects.length,
        challengingCount: data.challengingAspects.length,
        calculationTimeMs: data.calculationTime,
        timestamp: data.currentMoment.toISOString(),
      },
    })
  }

  /**
   * Log agent consciousness evolution
   */
  async logConsciousnessEvolution(data: {
    agentId: string
    previousLevel: string
    newLevel: string
    monicaConstant: number
    evolutionTrigger: string
    timestamp: Date
  }): Promise<boolean> {
    return this.galileo.log({
      message: 'Agent consciousness evolved',
      level: 'info',
      metadata: {
        component: 'consciousness-evolution',
        agentId: data.agentId,
        previousLevel: data.previousLevel,
        newLevel: data.newLevel,
        monicaConstant: data.monicaConstant,
        evolutionTrigger: data.evolutionTrigger,
        timestamp: data.timestamp.toISOString(),
      },
    })
  }

  /**
   * Log performance metrics for dashboard analysis
   */
  async logPerformanceMetrics(data: {
    endpoint: string
    responseTime: number
    statusCode: number
    errorMessage?: string
    metadata?: Record<string, any>
  }): Promise<boolean> {
    return this.galileo.log({
      message: 'API performance metric',
      level: data.statusCode >= 400 ? 'error' : 'info',
      metadata: {
        component: 'api-performance',
        endpoint: data.endpoint,
        responseTimeMs: data.responseTime,
        statusCode: data.statusCode,
        errorMessage: data.errorMessage,
        ...data.metadata,
        timestamp: new Date().toISOString(),
      },
    })
  }

  /**
   * Log multi-agent interactions (council mode)
   */
  async logCouncilInteraction(data: {
    sessionId: string
    agents: string[]
    userQuestion: string
    responses: Record<string, string>
    synergies: Record<string, number>
    totalResponseTime: number
  }): Promise<boolean> {
    const trace: AgentTrace = {
      traceId: `council-${data.sessionId}-${Date.now()}`,
      sessionId: data.sessionId,
      spans: data.agents.map((agentId, index) => ({
        spanId: `${data.sessionId}-agent-${index}`,
        name: `agent-${agentId}-response`,
        type: 'generation' as const,
        status: 'success' as const,
        durationMs: data.totalResponseTime / data.agents.length,
        input: { question: data.userQuestion },
        output: { response: data.responses[agentId] },
        metadata: {
          agentId,
          synergyScore: data.synergies[agentId],
        },
      })),
      metadata: {
        councilSize: data.agents.length,
        totalTime: data.totalResponseTime,
      },
    }

    return this.galileo.logSession({
      id: data.sessionId,
      name: 'agent-council',
      traces: [trace],
      metadata: {
        agents: data.agents,
        councilSize: data.agents.length,
        averageSynergy:
          Object.values(data.synergies).reduce((a, b) => a + b, 0) / data.agents.length,
      },
    })
  }
}

// Singleton instance for reuse
let galileoAgentMCP: GalileoAgentMCPIntegration | null = null

export function getGalileoAgentMCP(): GalileoAgentMCPIntegration {
  if (!galileoAgentMCP) {
    galileoAgentMCP = new GalileoAgentMCPIntegration()
  }
  return galileoAgentMCP
}
