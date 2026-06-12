/**
 * Memory Manager for Agent Conversations
 * Persistent memory backed by PostgreSQL (pg library)
 *
 * Provides long-term state for agents by storing and retrieving
 * conversation history from the database.
 */

import { BufferMemory, ChatMessageHistory } from '@langchain/classic/memory'
import type { BaseMessage } from '@langchain/core/messages'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { logger } from '@/lib/structured-logger'
import { withErrorHandling } from '@/lib/error-handling'
import pg from 'pg'

const { Pool } = pg

// Ensure a single pool instance is reused
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export interface ConversationMemory {
  sessionId: string
  agentId: string
  messages: BaseMessage[]
  summary?: string
  createdAt: Date
  updatedAt: Date
}

export interface MemoryRetrievalOptions {
  limit?: number
  includeContext?: boolean
}

/**
 * Memory Manager with pg Persistence
 */
export class MemoryManager {
  private bufferMemories: Map<string, BufferMemory>

  constructor() {
    this.bufferMemories = new Map()
  }

  /**
   * Create or get memory for a session, loading from DB if needed
   */
  async getMemory(sessionId: string, agentId: string): Promise<BufferMemory> {
    const key = `${sessionId}_${agentId}`

    // Check if buffer memory exists in cache
    if (this.bufferMemories.has(key)) {
      return this.bufferMemories.get(key)!
    }

    // Load existing conversation memory from database
    const history = await this.getConversationHistory(sessionId, agentId, { limit: 20 })

    // Create new buffer memory with loaded history
    const chatHistory = new ChatMessageHistory(history)
    const bufferMemory = new BufferMemory({
      chatHistory,
      returnMessages: true,
      memoryKey: 'chat_history',
    })

    this.bufferMemories.set(key, bufferMemory)
    return bufferMemory
  }

  /**
   * Save conversation to database and update cache
   */
  async saveConversation(
    sessionId: string,
    agentId: string,
    userMessage: string,
    agentResponse: string,
    userId?: string
  ): Promise<void> {
    return withErrorHandling(
      async () => {
        const key = `${sessionId}_${agentId}`

        // 1. Save to Database (pg)
        const cuid = require('crypto').randomBytes(12).toString('hex') // Fallback ID if needed
        const query = `
          INSERT INTO "AgentConversation" (
            id, "sessionId", "agentId", "userId", "userMessage", "agentResponse", "modelUsed", "createdAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, NOW()
          )
        `
        const values = [
          cuid,
          sessionId,
          agentId,
          userId || null,
          userMessage,
          agentResponse,
          'langchain-agent',
        ]

        await pool.query(query, values)

        // 2. Update In-Memory Cache if it exists
        const bufferMemory = this.bufferMemories.get(key)
        if (bufferMemory) {
          await bufferMemory.chatHistory.addUserMessage(userMessage)
          await bufferMemory.chatHistory.addAIMessage(agentResponse)
        }

        logger.info('Conversation persisted to database via pg', {
          system: 'langchain',
          operation: 'save_memory',
          agentId,
          metadata: { sessionId, userId },
        })
      },
      {
        system: 'langchain',
        operation: 'save_memory',
        agentId,
        severity: 'medium',
      }
    ).then(() => {})
  }

  /**
   * Retrieve conversation history from database
   */
  async getConversationHistory(
    sessionId: string,
    agentId: string,
    options: MemoryRetrievalOptions = {}
  ): Promise<BaseMessage[]> {
    const { limit = 10 } = options

    try {
      const query = `
        SELECT "userMessage", "agentResponse"
        FROM "AgentConversation"
        WHERE "sessionId" = $1 AND "agentId" = $2
        ORDER BY "createdAt" ASC
        LIMIT $3
      `
      const values = [sessionId, agentId, limit]
      const result = await pool.query(query, values)

      const messages: BaseMessage[] = []
      for (const row of result.rows) {
        messages.push(new HumanMessage(row.userMessage))
        messages.push(new AIMessage(row.agentResponse))
      }

      return messages
    } catch (error) {
      logger.error('Failed to load conversation history', error, {
        system: 'langchain',
        operation: 'load_history',
        agentId,
        metadata: { sessionId },
      })
      return []
    }
  }

  /**
   * Generate conversation summary (can be enhanced with LLM later)
   */
  async generateSummary(sessionId: string, agentId: string): Promise<string> {
    const history = await this.getConversationHistory(sessionId, agentId)

    if (history.length === 0) {
      return 'No conversation history'
    }

    return `Conversation with ${agentId}: ${history.length} messages found in history.`
  }

  /**
   * Clear memory for a session (soft delete or cleanup)
   */
  async clearMemory(sessionId: string, agentId: string): Promise<void> {
    const key = `${sessionId}_${agentId}`
    this.bufferMemories.delete(key)

    logger.info('Cleared in-memory agent cache', {
      system: 'langchain',
      operation: 'clear_cache',
      agentId,
      metadata: { sessionId },
    })
  }

  /**
   * Get memory statistics from database
   */
  async getStats(): Promise<{
    totalConversations: number
    activeAgents: string[]
  }> {
    const countResult = await pool.query(`SELECT COUNT(*) FROM "AgentConversation"`)
    const count = parseInt(countResult.rows[0].count, 10)

    const agentsResult = await pool.query(`SELECT DISTINCT "agentId" FROM "AgentConversation"`)
    const agents = agentsResult.rows.map(row => row.agentId)

    return {
      totalConversations: count,
      activeAgents: agents,
    }
  }
}

/**
 * Global memory manager instance
 */
let memoryManagerInstance: MemoryManager | null = null

/**
 * Get or create memory manager
 */
export function getMemoryManager(): MemoryManager {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager()
  }
  return memoryManagerInstance
}

/**
 * Save conversation (convenience function)
 */
export async function saveConversation(
  sessionId: string,
  agentId: string,
  userMessage: string,
  agentResponse: string,
  userId?: string
): Promise<void> {
  const manager = getMemoryManager()
  await manager.saveConversation(sessionId, agentId, userMessage, agentResponse, userId)
}

/**
 * Get conversation history (convenience function)
 */
export async function getConversationHistory(
  sessionId: string,
  agentId: string,
  limit?: number
): Promise<BaseMessage[]> {
  const manager = getMemoryManager()
  return await manager.getConversationHistory(sessionId, agentId, { limit })
}
