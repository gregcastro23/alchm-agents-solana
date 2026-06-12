/**
 * LlamaIndex Module - RAG Infrastructure Exports
 *
 * Provides unified access to vector store, embeddings, document loading,
 * and ingestion pipeline for the RAG system.
 */

// Vector Store
export {
  initializeVectorStore,
  getOrCreateCollection,
  addDocuments,
  queryCollection,
  getCollectionCount,
  deleteCollection,
  listCollections,
  healthCheck,
  resetConnection,
  type VectorStoreConfig,
  type DocumentMetadata,
  type AddDocumentsOptions,
  type AddResult,
  type QueryFilter,
  type QueryResult,
  type QueryOptions,
} from './vector-store'

// Embeddings Service
export {
  generateQueryEmbedding,
  generateEmbeddings,
  estimateTokenCount,
  estimateBatchTokens,
  clearCache,
  getCacheStats,
  validateEmbedding,
} from './embeddings-service'

// Document Loader
export {
  loadHistoricalAgents,
  loadAgentsByIds,
  convertAgentToDocument,
  extractMetadata,
  chunkDocument,
  chunkDocuments,
  estimateTokens,
  getDocumentStats,
  type AgentDocument,
  type DocumentChunk,
  type ChunkingOptions,
} from './document-loader'

// Ingestion Pipeline
export {
  ingestAgentKnowledge,
  incrementalUpdate,
  validateIngestion,
  getIngestionStatus,
  type IngestionOptions,
  type IngestionProgress,
  type IngestionResult,
} from './ingestion-pipeline'

// Semantic Search
export {
  semanticSearch,
  searchAgentKnowledge,
  multiAgentSearch,
  findSimilarAgents,
  diverseSearch,
  searchWithFilters,
  getSearchStats,
  type SearchOptions,
  type SearchResult,
  type GroupedSearchResults,
} from './semantic-search'
