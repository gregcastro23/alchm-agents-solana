/**
 * Vector Store Manager - ChromaDB Client and Operations
 *
 * Manages ChromaDB connection, collections, and vector operations for RAG system.
 * Uses ChromaDB for efficient semantic search across historical agent knowledge.
 */

import type { ChromaClient, Collection } from 'chromadb'
import { logger } from '@/lib/structured-logger'

// Type definitions
export interface VectorStoreConfig {
  url: string
  tenant?: string
  database?: string
  authToken?: string
}

export interface DocumentMetadata {
  agentId: string
  agentName: string
  era?: string
  chunkIndex: number
  totalChunks: number
  source: string
  [key: string]: any
}

export interface AddDocumentsOptions {
  batchSize?: number
  progressCallback?: (progress: { completed: number; total: number }) => void
}

export interface AddResult {
  success: boolean
  documentsAdded: number
  errors: string[]
}

export interface QueryFilter {
  agentId?: string
  era?: string
  [key: string]: any
}

export interface QueryResult {
  id: string
  document: string
  metadata: DocumentMetadata
  distance: number
  score: number // Converted from distance (1 - distance for cosine)
}

export interface QueryOptions {
  topK?: number
  filter?: QueryFilter
  includeMetadata?: boolean
}

// Global client instance
let chromaClient: any | null = null
let connectionRetries = 0
const MAX_RETRIES = 3
const RETRY_DELAY = 1000

/**
 * Initialize ChromaDB client with configuration from environment
 */
export async function initializeVectorStore(config?: VectorStoreConfig): Promise<ChromaClient> {
  if (chromaClient) {
    return chromaClient
  }

  const url = config?.url || process.env.CHROMADB_URL || 'http://localhost:8001'
  const tenant = config?.tenant || process.env.CHROMADB_TENANT || 'default_tenant'
  const database = config?.database || process.env.CHROMADB_DATABASE || 'default_database'

  try {
    const { ChromaClient } = await import('chromadb')
    chromaClient = new ChromaClient({
      path: url,
      auth: config?.authToken ? { provider: 'token', credentials: config.authToken } : undefined,
    })

    // Test connection with heartbeat
    await chromaClient.heartbeat()

    logger.info('Successfully connected to ChromaDB', {
      system: 'vector_store',
      operation: 'initialize',
      metadata: { url },
    })
    connectionRetries = 0

    return chromaClient
  } catch (error) {
    logger.error('Failed to connect to ChromaDB', {
      system: 'vector_store',
      operation: 'initialize',
      metadata: {
        url,
        error: error instanceof Error ? error.message : String(error),
      },
    })

    if (connectionRetries < MAX_RETRIES) {
      connectionRetries++
      logger.info('Retrying ChromaDB connection', {
        system: 'vector_store',
        operation: 'initialize',
        metadata: { attempt: connectionRetries, maxRetries: MAX_RETRIES },
      })
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * connectionRetries))
      return initializeVectorStore(config)
    }

    throw new Error(
      `Failed to connect to ChromaDB after ${MAX_RETRIES} attempts. ` +
        `Please ensure ChromaDB is running at ${url}. ` +
        `Run: docker run -d -p 8001:8000 chromadb/chroma`
    )
  }
}

/**
 * Get or create a collection in ChromaDB
 */
export async function getOrCreateCollection(
  name: string,
  metadata?: Record<string, any>
): Promise<Collection> {
  const client = await initializeVectorStore()

  try {
    // Try to get existing collection
    const collection = await client.getCollection({
      name,
      embeddingFunction: undefined, // We handle embeddings separately
    })

    logger.debug('Retrieved existing collection', {
      system: 'vector_store',
      operation: 'get_collection',
      metadata: { name },
    })
    return collection
  } catch (error) {
    // Collection doesn't exist, create it
    logger.info('Creating new collection', {
      system: 'vector_store',
      operation: 'create_collection',
      metadata: { name },
    })

    const collection = await client.createCollection({
      name,
      metadata: {
        description: 'Historical agent knowledge for RAG',
        createdAt: new Date().toISOString(),
        ...metadata,
      },
      embeddingFunction: undefined, // We handle embeddings separately
    })

    return collection
  }
}

/**
 * Add documents to a collection with embeddings
 */
export async function addDocuments(
  collection: Collection,
  documents: string[],
  embeddings: number[][],
  metadatas: DocumentMetadata[],
  ids: string[],
  options?: AddDocumentsOptions
): Promise<AddResult> {
  const batchSize = options?.batchSize || 100
  const total = documents.length
  let completed = 0
  const errors: string[] = []

  if (
    documents.length !== embeddings.length ||
    documents.length !== ids.length ||
    documents.length !== metadatas.length
  ) {
    throw new Error('Documents, embeddings, metadatas, and ids arrays must have the same length')
  }

  try {
    // Process in batches
    for (let i = 0; i < documents.length; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, documents.length)
      const batchDocs = documents.slice(i, batchEnd)
      const batchEmbeddings = embeddings.slice(i, batchEnd)
      const batchMetadatas = metadatas.slice(i, batchEnd)
      const batchIds = ids.slice(i, batchEnd)

      try {
        // Sanitize metadata - remove null values and ensure all values are primitive types
        const sanitizedMetadatas = batchMetadatas.map(meta => {
          const sanitized: any = {}
          for (const [key, value] of Object.entries(meta)) {
            if (value !== null && value !== undefined) {
              sanitized[key] = String(value)
            }
          }
          return sanitized
        })

        await collection.add({
          ids: batchIds,
          embeddings: batchEmbeddings,
          documents: batchDocs,
          metadatas: sanitizedMetadatas,
        })

        completed += batchDocs.length

        if (options?.progressCallback) {
          options.progressCallback({ completed, total })
        }
      } catch (error) {
        const errorMsg = `Failed to add batch ${i}-${batchEnd}: ${error instanceof Error ? error.message : String(error)}`
        logger.error('Batch add failed', {
          system: 'vector_store',
          operation: 'add_documents',
          metadata: { batchStart: i, batchEnd, errorMsg },
        })
        errors.push(errorMsg)
      }
    }

    logger.info('Documents added to collection', {
      system: 'vector_store',
      operation: 'add_documents',
      metadata: { completed, total, success: errors.length === 0 },
    })

    return {
      success: errors.length === 0,
      documentsAdded: completed,
      errors,
    }
  } catch (error) {
    logger.error('Error adding documents', {
      system: 'vector_store',
      operation: 'add_documents',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        completed,
        total,
      },
    })
    return {
      success: false,
      documentsAdded: completed,
      errors: [error instanceof Error ? error.message : String(error)],
    }
  }
}

/**
 * Query collection for similar documents
 */
export async function queryCollection(
  collection: Collection,
  queryEmbedding: number[],
  options?: QueryOptions
): Promise<QueryResult[]> {
  const topK = options?.topK || 5
  const includeMetadata = options?.includeMetadata !== false

  try {
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
      where: options?.filter,
      include: includeMetadata
        ? ['documents', 'metadatas', 'distances']
        : ['documents', 'distances'],
    })

    // Transform results to QueryResult format
    const queryResults: QueryResult[] = []

    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const id = results.ids[0][i]
        const document = results.documents?.[0]?.[i] || ''
        const metadata =
          (results.metadatas?.[0]?.[i] as DocumentMetadata) || ({} as DocumentMetadata)
        const distance = results.distances?.[0]?.[i] || 1.0

        // Convert distance to similarity score
        // ChromaDB uses squared L2 distance by default
        // Score = 1 / (1 + distance) - normalizes to 0-1 range where higher is better
        const score = 1 / (1 + distance)

        queryResults.push({
          id,
          document,
          metadata,
          distance,
          score,
        })
      }
    }

    return queryResults
  } catch (error) {
    logger.error('Query failed', {
      system: 'vector_store',
      operation: 'query',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        topK,
      },
    })
    throw new Error(
      `Vector store query failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Get document count in collection
 */
export async function getCollectionCount(collection: Collection): Promise<number> {
  try {
    const count = await collection.count()
    return count
  } catch (error) {
    logger.error('Failed to get collection count', {
      system: 'vector_store',
      operation: 'count',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    })
    return 0
  }
}

/**
 * Delete collection
 */
export async function deleteCollection(name: string): Promise<boolean> {
  try {
    const client = await initializeVectorStore()
    await client.deleteCollection({ name })
    logger.info('Deleted collection', {
      system: 'vector_store',
      operation: 'delete',
      metadata: { name },
    })
    return true
  } catch (error) {
    logger.error('Failed to delete collection', {
      system: 'vector_store',
      operation: 'delete',
      metadata: {
        name,
        error: error instanceof Error ? error.message : String(error),
      },
    })
    return false
  }
}

/**
 * List all collections
 */
export async function listCollections(): Promise<string[]> {
  try {
    const client = await initializeVectorStore()
    const collections = await client.listCollections()
    return collections.map(c => c.name)
  } catch (error) {
    logger.error('Failed to list collections', {
      system: 'vector_store',
      operation: 'list',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    })
    return []
  }
}

/**
 * Health check for ChromaDB connection
 */
export async function healthCheck(): Promise<{
  healthy: boolean
  message: string
  url?: string
}> {
  try {
    const url = process.env.CHROMADB_URL || 'http://localhost:8001'
    const client = await initializeVectorStore()
    await client.heartbeat()

    return {
      healthy: true,
      message: 'ChromaDB is operational',
      url,
    }
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Reset client connection (useful for testing or reconnection)
 */
export function resetConnection(): void {
  chromaClient = null
  connectionRetries = 0
}
