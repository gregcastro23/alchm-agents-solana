/**
 * LangChain Agent Router
 * ReAct pattern implementation for agent orchestration
 */

import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { AgentExecutor, createToolCallingAgent } from '@langchain/classic/agents'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { planetaryAgentTools } from './agent-tools'
import { BufferMemory } from '@langchain/classic/memory'
import type { BaseMessage } from '@langchain/core/messages'
import { CLAUDE, OPENAI } from '../models/registry'
import { getMemoryManager } from './memory-manager'
import { runWithToolExecutionContext } from './tool-context'
import { RECTIFICATION_INTERVIEW_INSTRUCTIONS } from '../rectification/intent'
import { logger } from '@/lib/structured-logger'

export interface AgentRouterConfig {
  model?: 'openai' | 'anthropic' | 'groq'
  temperature?: number
  maxIterations?: number
  timeoutMs?: number
  enableMemory?: boolean
  sessionId?: string
  agentId?: string
  userId?: string
  userName?: string | null
  userEmail?: string | null
  chartId?: string
  llmOverride?: BaseChatModel
}

export interface AgentRouterExecuteOptions {
  history?: Array<{ role?: string; content?: string }>
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
      temperature: config.temperature ?? 0.7,
      maxIterations: config.maxIterations || 8,
      timeoutMs: config.timeoutMs || 30000,
      enableMemory: config.enableMemory !== false,
      sessionId: config.sessionId,
      agentId: config.agentId,
      userId: config.userId,
      userName: config.userName,
      userEmail: config.userEmail,
      chartId: config.chartId,
      llmOverride: config.llmOverride,
    }
  }

  updateRuntimeContext(config: AgentRouterConfig): void {
    if (config.userName !== undefined) this.config.userName = config.userName
    if (config.userEmail !== undefined) this.config.userEmail = config.userEmail
    if (config.chartId !== undefined) this.config.chartId = config.chartId
  }

  matchesLlmOverride(llmOverride?: BaseChatModel): boolean {
    if (!llmOverride) return true
    return this.config.llmOverride === llmOverride
  }

  /**
   * Initialize the agent executor
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing AgentRouter', {
        system: 'langchain',
        operation: 'initialize',
        metadata: {
          model: this.config.model,
          sessionId: this.config.sessionId,
          agentId: this.config.agentId,
          hasUserId: Boolean(this.config.userId),
          hasOverride: Boolean(this.config.llmOverride),
        },
      })

      const aiGatewayEnabled = String(process.env.AI_GATEWAY_ENABLED).toLowerCase() === 'true'

      let llm: BaseChatModel
      if (this.config.llmOverride) {
        this.modelName = 'custom-llm-override'
        llm = this.config.llmOverride
      } else if (this.config.model === 'anthropic') {
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
          if (this.memory) {
            this.memory.inputKey = this.memory.inputKey || 'input'
            this.memory.outputKey = this.memory.outputKey || 'output'
          }
        } else {
          this.memory = new BufferMemory({
            returnMessages: true,
            memoryKey: 'chat_history',
            inputKey: 'input',
            outputKey: 'output',
          })
        }
      }

      // Create agent prompt
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are an intelligent orchestrator and astrological guide for the Planetary Agents system.
You serve both general astrology chats (for humans discovering or refining their own natal charts and rising signs) and historical/planetary council inquiries.

Your role is to:
1. Understand user queries about agents, wisdom, consciousness, and natal chart rectification
2. Use available tools to compute real astronomical data rather than guessing
3. Coordinate multiple agents when needed for complex questions
4. Provide insightful, context-aware responses

Available tools:
- semantic_agent_search: Find agents by concept/topic
- knowledge_retrieval: Get relevant knowledge from agent wisdom
- consciousness_analysis: Analyze agent consciousness and synergy
- multi_agent_coordinator: Assemble agent councils for complex queries
- memory_retrieval: Access conversation history and context
- geocode_location: Resolve any city/place string (e.g. "Chicago, IL", "Bangkok, Thailand") to latitude, longitude, timezone, and clockToLmtMinutes
- rectify_windows: Scan 24-hour candidate rising sign windows (accepts a city \`location\` or coordinates), sunrise/sunset LMT, Moon ingress, entropy (bits), and EIG next_best_questions
- rectify_score: Execute Bayesian Ascendant rectification against dated life events and time clues (accepts \`location\` or coordinates), returning posterior distribution, calculation eligibility (>=70% top sign and <=180m window), and updated EIG next_best_questions
- rectify_apply: Save the authenticated user’s verified rectified Ascendant and working birth time to their profile/primary natal chart

${RECTIFICATION_INTERVIEW_INSTRUCTIONS}

Be thoughtful, precise, and leverage the tools effectively.`,
        ],
        ['placeholder', '{chat_history}'],
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
      ])

      // Create agent
      const agent = createToolCallingAgent({
        llm: llm as any,
        tools: planetaryAgentTools,
        prompt,
      })

      // Create executor
      this.executor = new AgentExecutor({
        agent,
        tools: planetaryAgentTools,
        maxIterations: this.config.maxIterations,
        memory: this.memory || undefined,
        returnIntermediateSteps: true,
        verbose: process.env.NODE_ENV === 'development',
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

  private async seedMemoryIfEmpty(
    history?: Array<{ role?: string; content?: string }>
  ): Promise<void> {
    if (!this.memory || !history || history.length === 0) return
    try {
      const existing = await this.memory.chatHistory.getMessages()
      if (existing.length > 0) return
      for (const msg of history) {
        if (!msg.content || typeof msg.content !== 'string') continue
        if (msg.role === 'assistant' || msg.role === 'ai') {
          await this.memory.chatHistory.addAIMessage(msg.content)
        } else if (msg.role === 'user' || msg.role === 'human') {
          await this.memory.chatHistory.addUserMessage(msg.content)
        }
      }
    } catch {
      // Non-fatal if history seeding fails
    }
  }

  /**
   * Execute agent with query
   */
  async execute(query: string, options?: AgentRouterExecuteOptions): Promise<AgentRouterResponse> {
    if (!this.executor) {
      throw new Error('Agent router not initialized. Call initialize() first.')
    }

    const startTime = Date.now()
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error('Agent execution timed out')),
        this.config.timeoutMs
      )
    })

    try {
      await this.seedMemoryIfEmpty(options?.history)

      logger.info('Executing agent query', {
        system: 'langchain',
        operation: 'execute',
        metadata: { queryLength: query.length, sessionId: this.config.sessionId },
      })

      const result = await Promise.race([
        runWithToolExecutionContext(
          {
            userId: this.config.userId,
            userName: this.config.userName,
            userEmail: this.config.userEmail,
            sessionId: this.config.sessionId,
            chartId: this.config.chartId,
          },
          () => this.executor!.invoke({ input: query })
        ),
        timeoutPromise,
      ])

      const duration = Date.now() - startTime
      logger.performance('agent_execute', duration, {
        system: 'langchain',
        metadata: { model: this.modelName, iterations: result.intermediateSteps?.length || 0 },
      })

      if (this.config.enableMemory && this.config.sessionId && this.config.agentId) {
        const memoryManager = getMemoryManager()
        await memoryManager
          .saveConversation(this.config.sessionId, this.config.agentId, query, result.output || '')
          .catch(() => {})
      }

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
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
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

const MAX_ROUTER_CACHE = 50
const routerCache = new Map<string, AgentRouter>()

function buildRouterCacheKey(config: AgentRouterConfig = {}): string {
  return [
    config.sessionId || 'default-session',
    config.agentId || 'orchestrator',
    config.model || 'openai',
    config.userId || 'anon',
  ].join(':')
}

export function clearAgentRouterCache(): void {
  routerCache.clear()
}

/**
 * Get or create an isolated agent router keyed by (sessionId, agentId, model, userId)
 */
export async function getAgentRouter(config?: AgentRouterConfig): Promise<AgentRouter> {
  // Custom unkeyed LLM overrides bypass the shared default-session cache to stay test-isolated
  if (config?.llmOverride && !config.sessionId) {
    const ephemeral = new AgentRouter(config)
    await ephemeral.initialize()
    return ephemeral
  }

  const key = buildRouterCacheKey(config)
  const existing = routerCache.get(key)
  if (existing && existing.matchesLlmOverride(config?.llmOverride)) {
    routerCache.delete(key)
    existing.updateRuntimeContext(config || {})
    routerCache.set(key, existing)
    return existing
  }

  const router = new AgentRouter(config)
  await router.initialize()

  if (routerCache.has(key)) {
    routerCache.delete(key)
  } else if (routerCache.size >= MAX_ROUTER_CACHE) {
    const oldestKey = routerCache.keys().next().value
    if (oldestKey !== undefined) {
      routerCache.delete(oldestKey)
    }
  }
  routerCache.set(key, router)
  return router
}

/**
 * Execute query with agent router (convenience function)
 */
export async function executeAgentQuery(
  query: string,
  config?: AgentRouterConfig
): Promise<AgentRouterResponse> {
  const router = await getAgentRouter(config)
  return await router.execute(query)
}
