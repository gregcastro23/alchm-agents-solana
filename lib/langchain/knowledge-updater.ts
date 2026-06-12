/**
 * Knowledge Updater - Dynamic Web Content Ingestion
 *
 * Uses @langchain/community CheerioWebBaseLoader to scrape external web content
 * and ingest it into the ChromaDB vector store for enhanced agent knowledge.
 *
 * Phase 1 of LangChain Community Integration
 */

import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { getOrCreateCollection, addDocuments } from '@/lib/llamaindex/vector-store'
import { generateEmbeddings } from '@/lib/llamaindex/embeddings-service'
import { logger } from '@/lib/structured-logger'
import type { DocumentMetadata } from '@/lib/llamaindex/vector-store'

// Configuration
const DEFAULT_CHUNK_SIZE = 1000 // characters
const DEFAULT_CHUNK_OVERLAP = 200 // characters
const DEFAULT_COLLECTION_NAME = 'historical-agents'

// Selectors for content extraction (prioritize main content)
const CONTENT_SELECTORS = ['article', 'main', '.content', '.entry-content', '#content', 'p']

/**
 * Result type for knowledge update operations
 */
export interface KnowledgeUpdateResult {
  success: boolean
  agentId: string
  documentsAdded: number
  urls: number
  chunks: number
  errors: string[]
  timestamp: string
}

/**
 * Options for knowledge update operations
 */
export interface KnowledgeUpdateOptions {
  chunkSize?: number
  chunkOverlap?: number
  collectionName?: string
  contentSelector?: string
}

/**
 * Update agent knowledge from web URLs using CheerioWebBaseLoader
 *
 * @param agentId - The agent ID to associate with the knowledge
 * @param urls - Array of URLs to load content from
 * @param options - Optional configuration for chunking and collection
 * @returns Result object with statistics
 */
export async function updateAgentKnowledge(
  agentId: string,
  urls: string[],
  options?: KnowledgeUpdateOptions
): Promise<KnowledgeUpdateResult> {
  const startTime = Date.now()
  const errors: string[] = []
  let totalChunks = 0
  let successfulUrls = 0

  logger.info('Starting knowledge update', {
    system: 'langchain',
    operation: 'update_knowledge',
    agentId,
    metadata: {
      urlCount: urls.length,
      chunkSize: options?.chunkSize || DEFAULT_CHUNK_SIZE,
    },
  })

  try {
    // Validate inputs
    if (!agentId || agentId.trim().length === 0) {
      throw new Error('Agent ID is required')
    }

    if (!urls || urls.length === 0) {
      throw new Error('At least one URL is required')
    }

    // Validate and sanitize URLs
    const validUrls = validateUrls(urls)
    if (validUrls.length === 0) {
      throw new Error('No valid URLs provided')
    }

    // Initialize text splitter
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: options?.chunkSize || DEFAULT_CHUNK_SIZE,
      chunkOverlap: options?.chunkOverlap || DEFAULT_CHUNK_OVERLAP,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    })

    // Load and process each URL
    const allDocuments: string[] = []
    const allMetadata: DocumentMetadata[] = []
    const allIds: string[] = []

    for (const url of validUrls) {
      try {
        logger.debug(`Loading content from URL: ${url}`, {
          system: 'langchain',
          operation: 'load_url',
          agentId,
        })

        // Create CheerioWebBaseLoader
        const loader = new CheerioWebBaseLoader(url, {
          selector: options?.contentSelector || CONTENT_SELECTORS.join(', '),
        })

        // Load documents
        const docs = await loader.load()

        if (docs.length === 0) {
          errors.push(`No content extracted from ${url}`)
          continue
        }

        // Extract and clean text content
        const fullText = docs.map(doc => doc.pageContent).join('\n\n')

        if (fullText.trim().length === 0) {
          errors.push(`Empty content from ${url}`)
          continue
        }

        logger.info(`Loaded ${fullText.length} characters from ${url}`, {
          system: 'langchain',
          operation: 'load_url',
          agentId,
        })

        // Split into chunks
        const chunks = await textSplitter.splitText(fullText)

        logger.info(`Split content into ${chunks.length} chunks`, {
          system: 'langchain',
          operation: 'chunk_text',
          agentId,
          metadata: { chunkCount: chunks.length },
        })

        // Create metadata and IDs for each chunk
        for (let i = 0; i < chunks.length; i++) {
          const chunkId = `${agentId}-web-${Date.now()}-${totalChunks + i}`

          const metadata: DocumentMetadata = {
            agentId,
            agentName: agentId, // Will be updated with actual name if available
            era: 'External',
            chunkIndex: i,
            totalChunks: chunks.length,
            source: 'web',
            sourceUrl: url,
            ingestedAt: new Date().toISOString(),
            contentType: 'web_article',
          }

          allDocuments.push(chunks[i])
          allMetadata.push(metadata)
          allIds.push(chunkId)
        }

        totalChunks += chunks.length
        successfulUrls++
      } catch (error) {
        const errorMsg = `Failed to process ${url}: ${error instanceof Error ? error.message : String(error)}`
        logger.error(errorMsg, error, {
          system: 'langchain',
          operation: 'load_url',
          agentId,
        })
        errors.push(errorMsg)
      }
    }

    // If no documents were successfully processed, return early
    if (allDocuments.length === 0) {
      logger.warn('No documents to ingest', {
        system: 'langchain',
        operation: 'update_knowledge',
        agentId,
      })

      return {
        success: false,
        agentId,
        documentsAdded: 0,
        urls: 0,
        chunks: 0,
        errors: errors.length > 0 ? errors : ['No content could be extracted from any URL'],
        timestamp: new Date().toISOString(),
      }
    }

    // Generate embeddings
    logger.info(`Generating embeddings for ${allDocuments.length} chunks`, {
      system: 'langchain',
      operation: 'generate_embeddings',
      agentId,
    })

    const embeddings = await generateEmbeddings(allDocuments, {
      progressCallback: progress => {
        logger.debug(`Embedding progress: ${progress.completed}/${progress.total}`, {
          system: 'langchain',
          operation: 'generate_embeddings',
          agentId,
        })
      },
    })

    // Get or create collection
    const collectionName = options?.collectionName || DEFAULT_COLLECTION_NAME
    const collection = await getOrCreateCollection(collectionName)

    // Add documents to vector store
    logger.info(`Adding ${allDocuments.length} documents to vector store`, {
      system: 'langchain',
      operation: 'ingest_documents',
      agentId,
    })

    const addResult = await addDocuments(
      collection,
      allDocuments,
      embeddings,
      allMetadata,
      allIds,
      {
        progressCallback: progress => {
          logger.debug(`Ingestion progress: ${progress.completed}/${progress.total}`, {
            system: 'langchain',
            operation: 'ingest_documents',
            agentId,
          })
        },
      }
    )

    const duration = Date.now() - startTime
    logger.performance('update_knowledge', duration, {
      system: 'langchain',
      agentId,
      metadata: {
        documentsAdded: addResult.documentsAdded,
        urls: successfulUrls,
        chunks: totalChunks,
      },
    })

    return {
      success: addResult.success,
      agentId,
      documentsAdded: addResult.documentsAdded,
      urls: successfulUrls,
      chunks: totalChunks,
      errors: [...addResult.errors, ...errors],
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    const errorMsg = `Knowledge update failed: ${error instanceof Error ? error.message : String(error)}`
    logger.error(errorMsg, error, {
      system: 'langchain',
      operation: 'update_knowledge',
      agentId,
      metadata: { severity: 'high' },
    })

    throw new Error(errorMsg)
  }
}

/**
 * Ingest a single already-extracted text document (from TXT / MD / JSON / DOCX /
 * PDF uploads) into an agent's ChromaDB knowledge collection. Mirrors
 * {@link updateAgentKnowledge}'s chunk → embed → upsert pipeline, but for raw
 * text rather than a fetched URL. Degrades the same way (ChromaDB / embeddings
 * outage surfaces as a thrown error the caller can catch).
 */
export async function ingestAgentText(
  agentId: string,
  text: string,
  opts?: {
    fileName?: string
    contentType?: string
    agentName?: string
    chunkSize?: number
    chunkOverlap?: number
    collectionName?: string
  }
): Promise<KnowledgeUpdateResult> {
  const startTime = Date.now()

  if (!agentId || agentId.trim().length === 0) {
    throw new Error('Agent ID is required')
  }

  const cleaned = (text || '').trim()
  if (cleaned.length === 0) {
    return {
      success: false,
      agentId,
      documentsAdded: 0,
      urls: 0,
      chunks: 0,
      errors: [`Empty document${opts?.fileName ? `: ${opts.fileName}` : ''}`],
      timestamp: new Date().toISOString(),
    }
  }

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: opts?.chunkSize || DEFAULT_CHUNK_SIZE,
    chunkOverlap: opts?.chunkOverlap || DEFAULT_CHUNK_OVERLAP,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  })

  const chunks = await textSplitter.splitText(cleaned)
  if (chunks.length === 0) {
    return {
      success: false,
      agentId,
      documentsAdded: 0,
      urls: 0,
      chunks: 0,
      errors: ['No chunks produced from document'],
      timestamp: new Date().toISOString(),
    }
  }

  const allDocuments: string[] = []
  const allMetadata: DocumentMetadata[] = []
  const allIds: string[] = []
  const stamp = Date.now()

  for (let i = 0; i < chunks.length; i++) {
    allDocuments.push(chunks[i])
    allMetadata.push({
      agentId,
      agentName: opts?.agentName || agentId,
      era: 'External',
      chunkIndex: i,
      totalChunks: chunks.length,
      source: 'file',
      sourceUrl: opts?.fileName || 'upload',
      ingestedAt: new Date().toISOString(),
      contentType: opts?.contentType || 'file_upload',
    })
    allIds.push(`${agentId}-file-${stamp}-${i}`)
  }

  logger.info(`Ingesting ${chunks.length} chunks from ${opts?.fileName || 'upload'}`, {
    system: 'langchain',
    operation: 'ingest_agent_text',
    agentId,
    metadata: { chunks: chunks.length },
  })

  const embeddings = await generateEmbeddings(allDocuments)
  const collectionName = opts?.collectionName || DEFAULT_COLLECTION_NAME
  const collection = await getOrCreateCollection(collectionName)
  const addResult = await addDocuments(collection, allDocuments, embeddings, allMetadata, allIds)

  logger.performance('ingest_agent_text', Date.now() - startTime, {
    system: 'langchain',
    agentId,
    metadata: { documentsAdded: addResult.documentsAdded, chunks: chunks.length },
  })

  return {
    success: addResult.success,
    agentId,
    documentsAdded: addResult.documentsAdded,
    urls: 0,
    chunks: chunks.length,
    errors: addResult.errors,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Validate and sanitize URLs
 *
 * @param urls - Array of URLs to validate
 * @returns Array of valid, sanitized URLs
 */
function validateUrls(urls: string[]): string[] {
  const validUrls: string[] = []

  for (const url of urls) {
    try {
      const urlObj = new URL(url)

      // Security checks
      // Block localhost and private IPs
      const hostname = urlObj.hostname.toLowerCase()
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')
      ) {
        logger.warn(`Blocked private URL: ${url}`, {
          system: 'langchain',
          operation: 'validate_url',
        })
        continue
      }

      // Only allow http and https protocols
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        logger.warn(`Blocked non-HTTP(S) URL: ${url}`, {
          system: 'langchain',
          operation: 'validate_url',
        })
        continue
      }

      validUrls.push(url)
    } catch (error) {
      logger.warn(`Invalid URL: ${url}`, {
        system: 'langchain',
        operation: 'validate_url',
      })
    }
  }

  return validUrls
}

/**
 * Get recent knowledge updates for an agent
 *
 * @param agentId - The agent ID to query
 * @param limit - Maximum number of updates to return
 * @returns Array of recent update metadata
 */
export async function getRecentKnowledgeUpdates(
  agentId: string,
  limit: number = 10
): Promise<DocumentMetadata[]> {
  try {
    const collection = await getOrCreateCollection(DEFAULT_COLLECTION_NAME)

    // Query for recent documents for this agent
    // Note: This is a simplified version - in production, you'd want to
    // store update history in a separate database table

    logger.info('Querying recent knowledge updates', {
      system: 'langchain',
      operation: 'get_recent_updates',
      agentId,
      metadata: { limit },
    })

    // For now, return empty array - this would require additional
    // ChromaDB query functionality to list documents by metadata
    return []
  } catch (error) {
    logger.error('Failed to get recent updates', error, {
      system: 'langchain',
      operation: 'get_recent_updates',
      agentId,
    })
    return []
  }
}

/**
 * Calculate statistics for knowledge updates
 *
 * @param results - Array of update results
 * @returns Aggregated statistics
 */
export function calculateKnowledgeStats(results: KnowledgeUpdateResult[]): {
  totalDocuments: number
  totalUrls: number
  totalChunks: number
  successRate: number
  averageChunksPerUrl: number
} {
  const totalDocuments = results.reduce((sum, r) => sum + r.documentsAdded, 0)
  const totalUrls = results.reduce((sum, r) => sum + r.urls, 0)
  const totalChunks = results.reduce((sum, r) => sum + r.chunks, 0)
  const successfulUpdates = results.filter(r => r.success).length

  return {
    totalDocuments,
    totalUrls,
    totalChunks,
    successRate: results.length > 0 ? successfulUpdates / results.length : 0,
    averageChunksPerUrl: totalUrls > 0 ? totalChunks / totalUrls : 0,
  }
}
