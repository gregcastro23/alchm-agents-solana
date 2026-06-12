/**
 * Embeddings Service - OpenAI Text Embeddings Generation
 *
 * Generates vector embeddings for text using OpenAI's embedding models.
 * Model selection is centralized via lib/models/registry.ts.
 */

import { OpenAI } from 'openai'
import { resolveEmbeddingModel } from '../models/registry'

// Configuration
const EMBEDDING_MODEL = resolveEmbeddingModel()
const EMBEDDING_DIMENSIONS = 1536
const BATCH_SIZE = 100 // OpenAI allows up to 2048 inputs per request
const MAX_RETRIES = 3
const RETRY_DELAY = 1000

// Simple in-memory cache for embeddings (can be replaced with Redis)
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// OpenAI client
let openaiClient: OpenAI | null = null

/**
 * Initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for embeddings generation')
    }

    openaiClient = new OpenAI({ apiKey })
  }

  return openaiClient
}

/**
 * Generate cache key for text
 */
function getCacheKey(text: string): string {
  // Simple hash function for cache key
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `embed_${hash}_${text.length}`
}

/**
 * Get embedding from cache if available and not expired
 */
function getFromCache(text: string): number[] | null {
  const key = getCacheKey(text)
  const cached = embeddingCache.get(key)

  if (cached) {
    const age = Date.now() - cached.timestamp
    if (age < CACHE_TTL) {
      return cached.embedding
    } else {
      // Expired, remove from cache
      embeddingCache.delete(key)
    }
  }

  return null
}

/**
 * Store embedding in cache
 */
function storeInCache(text: string, embedding: number[]): void {
  const key = getCacheKey(text)
  embeddingCache.set(key, {
    embedding,
    timestamp: Date.now(),
  })

  // Clean up old entries if cache is too large (keep last 1000)
  if (embeddingCache.size > 1000) {
    const entries = Array.from(embeddingCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

    // Remove oldest 100 entries
    for (let i = 0; i < 100; i++) {
      embeddingCache.delete(entries[i][0])
    }
  }
}

/**
 * Generate embedding for a single text with retry logic
 */
async function generateSingleEmbeddingWithRetry(text: string, retries = 0): Promise<number[]> {
  const client = getOpenAIClient()

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    } as any)

    return response.data[0].embedding
  } catch (error: any) {
    // Handle rate limiting
    if (error?.status === 429 && retries < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retries) // Exponential backoff
      console.log(
        `[Embeddings] Rate limited, retrying in ${delay}ms... (attempt ${retries + 1}/${MAX_RETRIES})`
      )
      await new Promise(resolve => setTimeout(resolve, delay))
      return generateSingleEmbeddingWithRetry(text, retries + 1)
    }

    throw error
  }
}

/**
 * Generate embedding for a single query (with caching)
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  if (!query || query.trim().length === 0) {
    throw new Error('Query text cannot be empty')
  }

  // Check cache first
  const cached = getFromCache(query)
  if (cached) {
    console.log('[Embeddings] Cache hit for query embedding')
    return cached
  }

  try {
    const embedding = await generateSingleEmbeddingWithRetry(query)
    storeInCache(query, embedding)
    return embedding
  } catch (error) {
    console.error('[Embeddings] Failed to generate query embedding:', error)
    throw new Error(
      `Failed to generate query embedding: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Generate embeddings for multiple texts in batches
 */
export async function generateEmbeddings(
  texts: string[],
  options?: {
    batchSize?: number
    progressCallback?: (progress: { completed: number; total: number }) => void
  }
): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return []
  }

  const batchSize = options?.batchSize || BATCH_SIZE
  const total = texts.length
  const embeddings: number[][] = []
  let completed = 0

  console.log(`[Embeddings] Generating embeddings for ${total} texts in batches of ${batchSize}`)

  try {
    const client = getOpenAIClient()

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, texts.length)
      const batchTexts = texts.slice(i, batchEnd)

      // Filter out empty texts
      const validTexts = batchTexts.map((text, idx) => ({
        text: text || ' ', // Replace empty with space to avoid API error
        originalIndex: i + idx,
      }))

      try {
        const response = await client.embeddings.create({
          model: EMBEDDING_MODEL,
          input: validTexts.map(t => t.text),
          dimensions: EMBEDDING_DIMENSIONS,
        } as any)

        // Add embeddings in correct order
        for (const item of response.data) {
          embeddings[validTexts[item.index].originalIndex] = item.embedding
        }

        completed += batchTexts.length

        if (options?.progressCallback) {
          options.progressCallback({ completed, total })
        }

        console.log(`[Embeddings] Progress: ${completed}/${total} embeddings generated`)

        // Add small delay to avoid rate limiting
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error: any) {
        // Handle rate limiting with retry
        if (error?.status === 429) {
          console.log('[Embeddings] Rate limited, waiting 2 seconds...')
          await new Promise(resolve => setTimeout(resolve, 2000))
          i -= batchSize // Retry this batch
          continue
        }

        throw error
      }
    }

    console.log(`[Embeddings] Successfully generated ${embeddings.length} embeddings`)
    return embeddings
  } catch (error) {
    console.error('[Embeddings] Failed to generate embeddings:', error)
    throw new Error(
      `Failed to generate embeddings: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Calculate token count (approximate)
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}

/**
 * Calculate total tokens for a batch of texts
 */
export function estimateBatchTokens(texts: string[]): number {
  return texts.reduce((sum, text) => sum + estimateTokenCount(text), 0)
}

/**
 * Clear embedding cache
 */
export function clearCache(): void {
  embeddingCache.clear()
  console.log('[Embeddings] Cache cleared')
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number
  oldestEntry: number
  newestEntry: number
} {
  const entries = Array.from(embeddingCache.values())

  if (entries.length === 0) {
    return { size: 0, oldestEntry: 0, newestEntry: 0 }
  }

  const timestamps = entries.map(e => e.timestamp)

  return {
    size: embeddingCache.size,
    oldestEntry: Math.min(...timestamps),
    newestEntry: Math.max(...timestamps),
  }
}

/**
 * Validate embedding dimensions
 */
export function validateEmbedding(embedding: number[]): boolean {
  return (
    Array.isArray(embedding) &&
    embedding.length === EMBEDDING_DIMENSIONS &&
    embedding.every(n => typeof n === 'number' && !isNaN(n))
  )
}
