/**
 * LangChain Agent Router
 * ReAct pattern implementation for agent orchestration
 */

import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { AgentExecutor, createOpenAIFunctionsAgent } from '@langchain/classic/agents'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { planetaryAgentTools } from './agent-tools'
import { BufferMemory } from '@langchain/classic/memory'
import type { BaseMessage } from '@langchain/core/messages'
import { CLAUDE, OPENAI } from '../models/registry'
import { getMemoryManager } from './memory-manager'
import { logger } from '@/lib/structured-logger'

export interface AgentRouterConfig {
  model?: 'openai' | 'anthropic' | 'groq'
  temperature?: number
  maxIterations?: number
  timeoutMs?: number
  enableMemory?: boolean
  sessionId?: string
  agentId?: string
}

export interface AgentRouterResponse {
  output: string
  intermediateSteps?: any[]
  toolCalls?: string[]
  error?: string
  metadata?: {
    model: string
    iterations: number
    duration: number
    timedOut?: boolean
  }
}

/**
 * Agent Router using ReAct pattern
 */
export class AgentRouter {
  private executor: AgentExecutor | null = null
  private config: AgentRouterConfig
  private memory: BufferMemory | null = null
  private modelName: string = ''

  constructor(config: AgentRouterConfig = {}) {
    this.config = {
      model: config.model || 'openai',
      temperature: config.temperature || 0.7,
      maxIterations: config.maxIterations || 5,
      timeoutMs: config.timeoutMs || 30000,
      enableMemory: config.enableMemory !== false,
      sessionId: config.sessionId,
      agentId: config.agentId,
    }
  }

  /**
   * Initialize the agent executor
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing AgentRouter', {
        system: 'langchain',
        operation: 'initialize',
        metadata: this.config,
      })

      // Initialize LLM based on model choice
      const aiGatewayEnabled = String(process.env.AI_GATEWAY_ENABLED).toLowerCase() === 'true'

      let llm
      if (this.config.model === 'anthropic') {
        this.modelName = CLAUDE.SONNET
        llm = new ChatAnthropic({
          modelName: CLAUDE.SONNET,
          temperature: this.config.temperature,
          anthropicApiKey: aiGatewayEnabled
            ? process.env.AI_GATEWAY_API_KEY
            : process.env.ANTHROPIC_API_KEY,
          baseURL: aiGatewayEnabled ? process.env.AI_GATEWAY_URL : undefined,
        } as any)
      } else if (this.config.model === 'groq') {
        this.modelName = 'llama-3.3-70b-versatile'
        llm = new ChatOpenAI({
          modelName: 'llama-3.3-70b-versatile',
          temperature: this.config.temperature,
          openAIApiKey: process.env.GROQ_API_KEY,
          configuration: {
            baseURL: 'https://api.groq.com/openai/v1',
          },
        } as any)
      } else {
        this.modelName = OPENAI.GPT_5_4_MINI
        llm = new ChatOpenAI({
          modelName: OPENAI.GPT_5_4_MINI,
          temperature: this.config.temperature,
          openAIApiKey: aiGatewayEnabled
            ? process.env.AI_GATEWAY_API_KEY
            : process.env.OPENAI_API_KEY,
          baseURL: aiGatewayEnabled ? process.env.AI_GATEWAY_URL : undefined,
        } as any)
      }

      // Initialize memory if enabled
      if (this.config.enableMemory) {
        if (this.config.sessionId && this.config.agentId) {
          const memoryManager = getMemoryManager()
          this.memory = await memoryManager.getMemory(this.config.sessionId, this.config.agentId)
        } else {
          this.memory = new BufferMemory({
            returnMessages: true,
            memoryKey: 'chat_history',
          })
        }
      }

      // Create agent prompt
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are an intelligent orchestrator for the Planetary Agents system.
You have access to tools for semantic search, knowledge retrieval, consciousness analysis, and multi-agent coordination.

Your role is to:
1. Understand user queries about agents, wisdom, and consciousness
2. Use available tools to find relevant information
3. Coordinate multiple agents when needed for complex questions
4. Provide insightful, context-aware responses

Available tools:
- semantic_agent_search: Find agents by concept/topic
- knowledge_retrieval: Get relevant knowledge from agent wisdom
- consciousness_analysis: Analyze agent consciousness and synergy
- multi_agent_coordinator: Assemble agent councils for complex queries
- memory_retrieval: Access conversation history and context

Be thoughtful, precise, and leverage the tools effectively.`,
        ],
        ['placeholder', '{chat_history}'],
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
      ])

      // Create agent
      const agent = await createOpenAIFunctionsAgent({
        llm,
        tools: planetaryAgentTools,
        prompt,
      })

      // Create executor
      this.executor = new AgentExecutor({
        agent,
        tools: planetaryAgentTools,
        maxIterations: this.config.maxIterations,
        memory: this.memory || undefined,
        verbose: true,
      })

      logger.info('AgentRouter initialized successfully', {
        system: 'langchain',
        operation: 'initialize',
        metadata: { model: this.modelName },
      })
    } catch (error) {
      logger.error('AgentRouter initialization failed', error, {
        system: 'langchain',
        operation: 'initialize',
      })
      throw new Error(
        `Agent router initialization failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Execute agent with query
   */
  async execute(query: string): Promise<AgentRouterResponse> {
    if (!this.executor) {
      throw new Error('Agent router not initialized. Call initialize() first.')
    }

    const startTime = Date.now()
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Agent execution timed out')), this.config.timeoutMs)
    })

    try {
      logger.info('Executing agent query', {
        system: 'langchain',
        operation: 'execute',
        metadata: { queryLength: query.length },
      })

      // Race against timeout
      const result = await Promise.race([
        this.executor.invoke({
          input: query,
        }),
        timeoutPromise,
      ])

      const duration = Date.now() - startTime
      logger.performance('agent_execute', duration, {
        system: 'langchain',
        metadata: { model: this.modelName, iterations: result.intermediateSteps?.length || 0 },
      })

      return {
        output: result.output,
        intermediateSteps: result.intermediateSteps,
        toolCalls: this.extractToolCalls(result.intermediateSteps),
        metadata: {
          model: this.modelName,
          iterations: result.intermediateSteps?.length || 0,
          duration,
        },
      }
    } catch (error: any) {
      const isTimeout = error.message === 'Agent execution timed out'

      logger.error(
        isTimeout ? 'Streaming agent execution timed out' : 'Streaming agent execution failed',
        error,
        {
          system: 'langchain',
          operation: 'execute_stream',
          metadata: { timedOut: isTimeout },
        }
      )

      return {
        output: '',
        error: isTimeout ? 'Execution timed out' : `Streaming execution failed: ${error.message}`,
        metadata: {
          model: this.modelName,
          iterations: 0,
          duration: Date.now() - startTime,
          timedOut: isTimeout,
        },
      }
    }
  }

  /**
   * Extract tool calls from intermediate steps
   */
  private extractToolCalls(intermediateSteps?: any[]): string[] {
    if (!intermediateSteps || intermediateSteps.length === 0) return []

    return intermediateSteps.map(step => {
      if (step.action && step.action.tool) {
        return step.action.tool
      }
      return 'unknown_tool'
    })
  }

  /**
   * Clear conversation memory
   */
  async clearMemory(): Promise<void> {
    if (this.memory) {
      await this.memory.clear()
      logger.info('Agent memory cleared', {
        system: 'langchain',
        operation: 'clear_memory',
      })
    }
  }

  /**
   * Get conversation history
   */
  async getHistory(): Promise<BaseMessage[]> {
    if (!this.memory) return []

    const history = await this.memory.loadMemoryVariables({})
    return history.chat_history || []
  }
}

/**
 * Global agent router instance
 */
let agentRouterInstance: AgentRouter | null = null

/**
 * Get or create agent router
 */
export async function getAgentRouter(config?: AgentRouterConfig): Promise<AgentRouter> {
  if (!agentRouterInstance) {
    agentRouterInstance = new AgentRouter(config)
    await agentRouterInstance.initialize()
  }
  return agentRouterInstance
}

/**
 * Execute query with agent router (convenience function)
 */
export async function executeAgentQuery(query: string): Promise<AgentRouterResponse> {
  const router = await getAgentRouter()
  return await router.execute(query)
}
