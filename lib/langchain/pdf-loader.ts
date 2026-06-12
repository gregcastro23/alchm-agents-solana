/**
 * PDF Loader - Astrological Chart and Research Paper Ingestion
 *
 * Uses @langchain/community PDFLoader to extract text from PDF files
 * and ingest them into the ChromaDB vector store for enhanced agent knowledge.
 *
 * Phase 1 of LangChain Community Integration
 */

import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { getOrCreateCollection, addDocuments } from '@/lib/llamaindex/vector-store'
import { generateEmbeddings } from '@/lib/llamaindex/embeddings-service'
import { logger } from '@/lib/structured-logger'
import type { DocumentMetadata } from '@/lib/llamaindex/vector-store'
import * as fs from 'fs'
import * as path from 'path'

// Configuration
const DEFAULT_CHUNK_SIZE = 1000 // characters
const DEFAULT_CHUNK_OVERLAP = 200 // characters
const DEFAULT_COLLECTION_NAME = 'historical-agents'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * Result type for PDF ingestion operations
 */
export interface PDFIngestionResult {
  success: boolean
  agentId: string
  pagesProcessed: number
  documentsAdded: number
  documentId: string
  fileName: string
  fileSize: number
  errors: string[]
  timestamp: string
}

/**
 * Options for PDF ingestion operations
 */
export interface PDFIngestionOptions {
  chunkSize?: number
  chunkOverlap?: number
  collectionName?: string
  splitPages?: boolean
  metadata?: Record<string, any>
}

/**
 * Ingest an astrological PDF file into the vector store
 *
 * @param filePath - Absolute path to the PDF file
 * @param agentId - The agent ID to associate with the knowledge
 * @param options - Optional configuration for chunking and metadata
 * @returns Result object with statistics
 */
export async function ingestAstrologicalPDF(
  filePath: string,
  agentId: string,
  options?: PDFIngestionOptions
): Promise<PDFIngestionResult> {
  const startTime = Date.now()
  const errors: string[] = []

  logger.info('Starting PDF ingestion', {
    system: 'langchain',
    operation: 'ingest_pdf',
    agentId,
    metadata: {
      filePath,
      chunkSize: options?.chunkSize || DEFAULT_CHUNK_SIZE,
    },
  })

  try {
    // Validate inputs
    if (!agentId || agentId.trim().length === 0) {
      throw new Error('Agent ID is required')
    }

    if (!filePath || filePath.trim().length === 0) {
      throw new Error('File path is required')
    }

    // Validate file path (security check)
    const sanitizedPath = validateFilePath(filePath)

    // Check if file exists
    if (!fs.existsSync(sanitizedPath)) {
      throw new Error(`File not found: ${sanitizedPath}`)
    }

    // Check file size
    const stats = fs.statSync(sanitizedPath)
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${stats.size} bytes (max: ${MAX_FILE_SIZE})`)
    }

    if (stats.size === 0) {
      throw new Error('File is empty')
    }

    // Extract file name
    const fileName = path.basename(sanitizedPath)

    logger.info(`Loading PDF: ${fileName} (${stats.size} bytes)`, {
      system: 'langchain',
      operation: 'load_pdf',
      agentId,
    })

    // Create PDFLoader
    const loader = new PDFLoader(sanitizedPath, {
      splitPages: options?.splitPages !== false, // Default: true
    })

    // Load documents
    const docs = await loader.load()

    if (docs.length === 0) {
      throw new Error('No content could be extracted from PDF')
    }

    logger.info(`Extracted ${docs.length} pages from PDF`, {
      system: 'langchain',
      operation: 'load_pdf',
      agentId,
      metadata: { pageCount: docs.length },
    })

    // Initialize text splitter
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: options?.chunkSize || DEFAULT_CHUNK_SIZE,
      chunkOverlap: options?.chunkOverlap || DEFAULT_CHUNK_OVERLAP,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    })

    // Process each page
    const allDocuments: string[] = []
    const allMetadata: DocumentMetadata[] = []
    const allIds: string[] = []
    let totalChunks = 0

    for (let pageIndex = 0; pageIndex < docs.length; pageIndex++) {
      const doc = docs[pageIndex]
      const pageContent = doc.pageContent.trim()

      if (pageContent.length === 0) {
        logger.warn(`Empty page ${pageIndex + 1}, skipping`, {
          system: 'langchain',
          operation: 'process_page',
          agentId,
        })
        continue
      }

      // Split page content into chunks
      const chunks = await textSplitter.splitText(pageContent)

      logger.debug(`Page ${pageIndex + 1}: ${chunks.length} chunks`, {
        system: 'langchain',
        operation: 'chunk_page',
        agentId,
      })

      // Create metadata and IDs for each chunk
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const documentId = `${agentId}-pdf-${Date.now()}-${totalChunks}`

        const metadata: DocumentMetadata = {
          agentId,
          agentName: agentId, // Will be updated with actual name if available
          era: 'External',
          chunkIndex,
          totalChunks: chunks.length,
          source: 'pdf',
          fileName,
          filePath: sanitizedPath,
          fileSize: stats.size,
          page: pageIndex + 1,
          totalPages: docs.length,
          ingestedAt: new Date().toISOString(),
          contentType: 'pdf_document',
          // Include any additional metadata provided
          ...options?.metadata,
        }

        allDocuments.push(chunks[chunkIndex])
        allMetadata.push(metadata)
        allIds.push(documentId)
        totalChunks++
      }
    }

    // If no documents were successfully processed, return early
    if (allDocuments.length === 0) {
      throw new Error('No text content could be extracted from PDF')
    }

    logger.info(`Generated ${totalChunks} chunks from ${docs.length} pages`, {
      system: 'langchain',
      operation: 'chunk_pdf',
      agentId,
      metadata: { totalChunks, pageCount: docs.length },
    })

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
    logger.performance('ingest_pdf', duration, {
      system: 'langchain',
      agentId,
      metadata: {
        pagesProcessed: docs.length,
        documentsAdded: addResult.documentsAdded,
      },
    })

    // Generate unique document ID for tracking
    const documentId = `${agentId}-${fileName}-${Date.now()}`

    return {
      success: addResult.success,
      agentId,
      pagesProcessed: docs.length,
      documentsAdded: addResult.documentsAdded,
      documentId,
      fileName,
      fileSize: stats.size,
      errors: addResult.errors,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    const errorMsg = `PDF ingestion failed: ${error instanceof Error ? error.message : String(error)}`
    logger.error(errorMsg, error, {
      system: 'langchain',
      operation: 'ingest_pdf',
      agentId,
      metadata: { severity: 'high' },
    })

    throw new Error(errorMsg)
  }
}

/**
 * Validate and sanitize file path (security check)
 *
 * @param filePath - The file path to validate
 * @returns Sanitized absolute path
 * @throws Error if path is invalid or potentially dangerous
 */
function validateFilePath(filePath: string): string {
  // Resolve to absolute path
  const absolutePath = path.resolve(filePath)

  // Check for directory traversal attempts
  if (absolutePath.includes('..')) {
    throw new Error('Directory traversal detected in file path')
  }

  // Check file extension
  const ext = path.extname(absolutePath).toLowerCase()
  if (ext !== '.pdf') {
    throw new Error(`Invalid file extension: ${ext}. Only .pdf files are allowed`)
  }

  // Additional security checks could be added here
  // For example, restricting to specific directories

  return absolutePath
}

/**
 * Ingest multiple PDF files in batch
 *
 * @param files - Array of file paths and agent IDs
 * @param options - Optional configuration
 * @returns Array of ingestion results
 */
export async function ingestMultiplePDFs(
  files: Array<{ filePath: string; agentId: string }>,
  options?: PDFIngestionOptions
): Promise<PDFIngestionResult[]> {
  const results: PDFIngestionResult[] = []

  logger.info(`Starting batch PDF ingestion: ${files.length} files`, {
    system: 'langchain',
    operation: 'ingest_batch',
  })

  for (const file of files) {
    try {
      const result = await ingestAstrologicalPDF(file.filePath, file.agentId, options)
      results.push(result)
    } catch (error) {
      logger.error(`Failed to ingest ${file.filePath}`, error, {
        system: 'langchain',
        operation: 'ingest_batch',
        agentId: file.agentId,
      })

      // Add failed result
      results.push({
        success: false,
        agentId: file.agentId,
        pagesProcessed: 0,
        documentsAdded: 0,
        documentId: '',
        fileName: path.basename(file.filePath),
        fileSize: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        timestamp: new Date().toISOString(),
      })
    }
  }

  logger.info(
    `Batch ingestion complete: ${results.filter(r => r.success).length}/${files.length} successful`,
    {
      system: 'langchain',
      operation: 'ingest_batch',
    }
  )

  return results
}

/**
 * Calculate statistics for PDF ingestion results
 *
 * @param results - Array of ingestion results
 * @returns Aggregated statistics
 */
export function calculatePDFStats(results: PDFIngestionResult[]): {
  totalDocuments: number
  totalPages: number
  totalFileSize: number
  successRate: number
  averagePagesPerFile: number
} {
  const totalDocuments = results.reduce((sum, r) => sum + r.documentsAdded, 0)
  const totalPages = results.reduce((sum, r) => sum + r.pagesProcessed, 0)
  const totalFileSize = results.reduce((sum, r) => sum + r.fileSize, 0)
  const successfulIngestions = results.filter(r => r.success).length

  return {
    totalDocuments,
    totalPages,
    totalFileSize,
    successRate: results.length > 0 ? successfulIngestions / results.length : 0,
    averagePagesPerFile: results.length > 0 ? totalPages / results.length : 0,
  }
}

/**
 * Extract metadata from PDF file (without full ingestion)
 *
 * @param filePath - Path to PDF file
 * @returns Basic metadata about the PDF
 */
export async function extractPDFMetadata(filePath: string): Promise<{
  fileName: string
  fileSize: number
  pageCount: number
  valid: boolean
}> {
  try {
    const sanitizedPath = validateFilePath(filePath)
    const stats = fs.statSync(sanitizedPath)
    const fileName = path.basename(sanitizedPath)

    // Load PDF to count pages
    const loader = new PDFLoader(sanitizedPath, { splitPages: true })
    const docs = await loader.load()

    return {
      fileName,
      fileSize: stats.size,
      pageCount: docs.length,
      valid: docs.length > 0,
    }
  } catch (error) {
    logger.error('Failed to extract PDF metadata', error, {
      system: 'langchain',
      operation: 'extract_metadata',
    })

    return {
      fileName: path.basename(filePath),
      fileSize: 0,
      pageCount: 0,
      valid: false,
    }
  }
}
