/**
 * Ingestion Pipeline - Orchestrates RAG Knowledge Ingestion
 *
 * Main pipeline for processing historical agents and storing in vector database.
 * Handles loading, chunking, embedding, and storage with progress tracking and error handling.
 */

import {
  loadHistoricalAgents,
  loadAgentsByIds,
  chunkDocuments,
  getDocumentStats,
  type AgentDocument,
  type DocumentChunk,
} from './document-loader'
import { generateEmbeddings } from './embeddings-service'
import {
  initializeVectorStore,
  getOrCreateCollection,
  addDocuments,
  getCollectionCount,
  healthCheck,
} from './vector-store'
import type { Collection } from 'chromadb'

// Configuration
const COLLECTION_NAME = 'historical_agents'
const CHUNK_SIZE = 512 // tokens
const CHUNK_OVERLAP = 50 // tokens
const EMBEDDING_BATCH_SIZE = 100

export interface IngestionOptions {
  forceReindex?: boolean // Delete and recreate collection
  agentIds?: string[] // Only ingest specific agents
  progressCallback?: (progress: IngestionProgress) => void
  chunkSize?: number
  chunkOverlap?: number
}

export interface IngestionProgress {
  stage:
    | 'initializing'
    | 'loading'
    | 'chunking'
    | 'embedding'
    | 'storing'
    | 'validating'
    | 'complete'
  currentAgent?: string
  completed: number
  total: number
  message: string
  errors: string[]
}

export interface IngestionResult {
  success: boolean
  agentsProcessed: number
  chunksCreated: number
  embeddingsGenerated: number
  documentsStored: number
  timeElapsed: number
  errors: string[]
  stats: {
    totalAgents: number
    totalChunks: number
    totalTokens: number
    collectionSize: number
  }
}

/**
 * Main ingestion pipeline - Process and store all agent knowledge
 */
export async function ingestAgentKnowledge(options?: IngestionOptions): Promise<IngestionResult> {
  const startTime = Date.now()
  const errors: string[] = []
  let agentsProcessed = 0
  let chunksCreated = 0
  let embeddingsGenerated = 0
  let documentsStored = 0

  const progress: IngestionProgress = {
    stage: 'initializing',
    completed: 0,
    total: 0,
    message: 'Initializing ingestion pipeline...',
    errors: [],
  }

  try {
    // Report progress helper
    const reportProgress = (update: Partial<IngestionProgress>) => {
      Object.assign(progress, update)
      if (options?.progressCallback) {
        options.progressCallback(progress)
      }
    }

    // Stage 1: Initialize vector store
    reportProgress({
      stage: 'initializing',
      message: 'Connecting to ChromaDB...',
    })

    const health = await healthCheck()
    if (!health.healthy) {
      throw new Error(`ChromaDB is not healthy: ${health.message}`)
    }

    console.log('[Ingestion] ChromaDB connection verified')

    // Get or create collection
    let collection: Collection

    if (options?.forceReindex) {
      console.log('[Ingestion] Force reindex enabled - recreating collection')
      const { deleteCollection } = await import('./vector-store')
      await deleteCollection(COLLECTION_NAME)
    }

    collection = await getOrCreateCollection(COLLECTION_NAME, {
      type: 'historical_agents',
      chunkSize: options?.chunkSize || CHUNK_SIZE,
      chunkOverlap: options?.chunkOverlap || CHUNK_OVERLAP,
    })

    // Stage 2: Load agent documents
    reportProgress({
      stage: 'loading',
      message: 'Loading historical agent documents...',
    })

    let documents: AgentDocument[]

    if (options?.agentIds && options.agentIds.length > 0) {
      console.log(`[Ingestion] Loading ${options.agentIds.length} specific agents`)
      documents = await loadAgentsByIds(options.agentIds)
    } else {
      console.log('[Ingestion] Loading all historical agents')
      documents = await loadHistoricalAgents()
    }

    if (documents.length === 0) {
      throw new Error('No documents loaded - check agent data')
    }

    agentsProcessed = documents.length
    reportProgress({
      completed: agentsProcessed,
      total: agentsProcessed,
      message: `Loaded ${agentsProcessed} agent documents`,
    })

    // Log document statistics
    const docStats = getDocumentStats(documents)
    console.log('[Ingestion] Document statistics:', {
      totalDocs: docStats.totalDocuments,
      totalTokens: docStats.totalTokens,
      avgLength: Math.round(docStats.averageLength),
      eras: docStats.eras,
    })

    // Stage 3: Chunk documents
    reportProgress({
      stage: 'chunking',
      message: 'Chunking documents for optimal embedding...',
      completed: 0,
      total: documents.length,
    })

    const chunks = chunkDocuments(documents, {
      chunkSize: options?.chunkSize || CHUNK_SIZE,
      overlap: options?.chunkOverlap || CHUNK_OVERLAP,
      preserveSentences: true,
    })

    chunksCreated = chunks.length
    console.log(`[Ingestion] Created ${chunksCreated} chunks from ${documents.length} documents`)

    reportProgress({
      completed: documents.length,
      total: documents.length,
      message: `Created ${chunksCreated} document chunks`,
    })

    // Stage 4: Generate embeddings
    reportProgress({
      stage: 'embedding',
      message: 'Generating embeddings with OpenAI...',
      completed: 0,
      total: chunks.length,
    })

    const chunkTexts = chunks.map(c => c.content)
    const embeddings = await generateEmbeddings(chunkTexts, {
      batchSize: EMBEDDING_BATCH_SIZE,
      progressCallback: embProgress => {
        reportProgress({
          completed: embProgress.completed,
          total: embProgress.total,
          message: `Generating embeddings: ${embProgress.completed}/${embProgress.total}`,
        })
      },
    })

    embeddingsGenerated = embeddings.length
    console.log(`[Ingestion] Generated ${embeddingsGenerated} embeddings`)

    if (embeddings.length !== chunks.length) {
      throw new Error(
        `Embedding count mismatch: ${embeddings.length} embeddings for ${chunks.length} chunks`
      )
    }

    // Stage 5: Store in vector database
    reportProgress({
      stage: 'storing',
      message: 'Storing documents in ChromaDB...',
      completed: 0,
      total: chunks.length,
    })

    const ids = chunks.map(c => c.id)
    const metadatas = chunks.map(c => c.metadata)

    const addResult = await addDocuments(collection, chunkTexts, embeddings, metadatas, ids, {
      batchSize: 100,
      progressCallback: storeProgress => {
        reportProgress({
          completed: storeProgress.completed,
          total: storeProgress.total,
          message: `Storing documents: ${storeProgress.completed}/${storeProgress.total}`,
        })
      },
    })

    documentsStored = addResult.documentsAdded

    if (addResult.errors.length > 0) {
      errors.push(...addResult.errors)
      console.warn('[Ingestion] Some documents failed to store:', addResult.errors)
    }

    // Stage 6: Validate
    reportProgress({
      stage: 'validating',
      message: 'Validating ingestion...',
    })

    const collectionSize = await getCollectionCount(collection)
    console.log(`[Ingestion] Collection now contains ${collectionSize} documents`)

    // Stage 7: Complete
    const timeElapsed = Date.now() - startTime

    reportProgress({
      stage: 'complete',
      message: `Ingestion complete in ${(timeElapsed / 1000).toFixed(2)}s`,
      completed: chunks.length,
      total: chunks.length,
    })

    const result: IngestionResult = {
      success: addResult.success,
      agentsProcessed,
      chunksCreated,
      embeddingsGenerated,
      documentsStored,
      timeElapsed,
      errors,
      stats: {
        totalAgents: agentsProcessed,
        totalChunks: chunksCreated,
        totalTokens: docStats.totalTokens,
        collectionSize,
      },
    }

    console.log('[Ingestion] Pipeline completed:', result)

    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[Ingestion] Pipeline failed:', errorMsg)

    errors.push(errorMsg)

    const timeElapsed = Date.now() - startTime

    return {
      success: false,
      agentsProcessed,
      chunksCreated,
      embeddingsGenerated,
      documentsStored,
      timeElapsed,
      errors,
      stats: {
        totalAgents: agentsProcessed,
        totalChunks: chunksCreated,
        totalTokens: 0,
        collectionSize: 0,
      },
    }
  }
}

/**
 * Incremental update - Only ingest new or modified agents
 * (Simplified version - full implementation would track timestamps)
 */
export async function incrementalUpdate(agentIds: string[]): Promise<IngestionResult> {
  console.log('[Ingestion] Running incremental update for agents:', agentIds)

  return ingestAgentKnowledge({
    agentIds,
    forceReindex: false,
  })
}

/**
 * Validate ingestion by checking collection health
 */
export async function validateIngestion(): Promise<{
  valid: boolean
  collectionExists: boolean
  documentCount: number
  errors: string[]
}> {
  const errors: string[] = []

  try {
    // Check ChromaDB health
    const health = await healthCheck()
    if (!health.healthy) {
      errors.push(`ChromaDB unhealthy: ${health.message}`)
    }

    // Check if collection exists
    const collection = await getOrCreateCollection(COLLECTION_NAME)
    const documentCount = await getCollectionCount(collection)

    const valid = health.healthy && documentCount > 0

    return {
      valid,
      collectionExists: true,
      documentCount,
      errors,
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))

    return {
      valid: false,
      collectionExists: false,
      documentCount: 0,
      errors,
    }
  }
}

/**
 * Get ingestion status
 */
export async function getIngestionStatus(): Promise<{
  ready: boolean
  collectionName: string
  documentCount: number
  lastIngestion?: string
  message: string
}> {
  try {
    const health = await healthCheck()

    if (!health.healthy) {
      return {
        ready: false,
        collectionName: COLLECTION_NAME,
        documentCount: 0,
        message: 'ChromaDB is not available',
      }
    }

    const collection = await getOrCreateCollection(COLLECTION_NAME)
    const documentCount = await getCollectionCount(collection)

    return {
      ready: documentCount > 0,
      collectionName: COLLECTION_NAME,
      documentCount,
      message:
        documentCount > 0
          ? `Ready with ${documentCount} documents`
          : 'Collection is empty - run ingestion',
    }
  } catch (error) {
    return {
      ready: false,
      collectionName: COLLECTION_NAME,
      documentCount: 0,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// CLI execution support - check if running directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`

if (isMainModule) {
  console.log('🚀 Starting RAG Ingestion Pipeline...\n')

  ingestAgentKnowledge({
    forceReindex: process.argv.includes('--force'),
    progressCallback: progress => {
      console.log(`[${progress.stage}] ${progress.message}`)
      if (progress.errors.length > 0) {
        console.error('Errors:', progress.errors)
      }
    },
  })
    .then(result => {
      console.log('\n✅ Ingestion Complete!')
      console.log('━'.repeat(60))
      console.log(`Agents Processed: ${result.agentsProcessed}`)
      console.log(`Chunks Created: ${result.chunksCreated}`)
      console.log(`Embeddings Generated: ${result.embeddingsGenerated}`)
      console.log(`Documents Stored: ${result.documentsStored}`)
      console.log(`Time Elapsed: ${(result.timeElapsed / 1000).toFixed(2)}s`)
      console.log(`Collection Size: ${result.stats.collectionSize}`)

      if (result.errors.length > 0) {
        console.log('\n⚠️  Errors encountered:')
        result.errors.forEach(err => console.log(`  - ${err}`))
      }

      process.exit(result.success ? 0 : 1)
    })
    .catch(error => {
      console.error('\n❌ Ingestion Failed:', error)
      process.exit(1)
    })
}
