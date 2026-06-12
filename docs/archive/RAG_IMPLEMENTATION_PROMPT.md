# Comprehensive RAG Implementation for Planetary Agents

## Project Context

You are implementing the Retrieval-Augmented Generation (RAG) system for Planetary Agents, an astrological AI platform combining celestial wisdom with modern AI. The RAG system was previously removed due to compatibility issues with llamaindex, and stub functions were created to maintain API compatibility.

**Current State:**

- RAG is **disabled** by default (`USE_RAG_GENERATION=false`)
- Stub functions exist in `lib/rag/monica-rag-wrapper.ts`
- RAG is integrated into the Monica agent at `app/api/monica-agent/route.ts`
- ChromaDB, LangChain, and LlamaIndex packages are already installed
- 35+ historical agents with rich personality data available in `lib/agents/historical/`

**Tech Stack:**

- Next.js 15.0.3 + TypeScript 5.2.2
- Vector Store: ChromaDB 3.0.17
- RAG Framework: LlamaIndex 0.12.0 + LangChain 1.0.1
- Embeddings: OpenAI embeddings (via `@llamaindex/openai`)
- Database: PostgreSQL + Prisma
- AI: Anthropic Claude 3.5 Sonnet + OpenAI GPT-4

## Goals

Implement a production-ready RAG system that:

1. **Semantic Search** - Find relevant agent knowledge based on user queries
2. **Context Enhancement** - Augment agent responses with retrieved context
3. **Knowledge Ingestion** - Process and vectorize 35+ historical agent personalities
4. **Real-time Querying** - Sub-500ms query response times with caching
5. **Fallback Handling** - Graceful degradation when RAG is unavailable
6. **Observability** - Track RAG usage, performance, and quality metrics

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    RAG SYSTEM ARCHITECTURE                   │
└─────────────────────────────────────────────────────────────┘

1. INGESTION PIPELINE
   ┌──────────────────┐
   │ Historical Agents│ → Extract personality, wisdom, quotes
   │   (35+ files)    │ → Chunk documents (512 tokens)
   └────────┬─────────┘ → Generate embeddings
            │           → Store in ChromaDB
            ↓
   ┌──────────────────┐
   │   ChromaDB       │ ← Vector store (port 8000)
   │  Collections:    │   - historical_agents
   │  - agents        │   - monica_insights
   │  - wisdom        │   - planetary_wisdom
   └────────┬─────────┘
            │
2. QUERY PIPELINE
            │
            ↓
   ┌──────────────────┐
   │  User Query      │ → "Tell me about creativity"
   └────────┬─────────┘
            │
            ↓
   ┌──────────────────┐
   │ Query Embedder   │ → OpenAI text-embedding-3-small
   └────────┬─────────┘
            │
            ↓
   ┌──────────────────┐
   │ Vector Search    │ → Cosine similarity (topK=5)
   │  + Reranking     │ → Filter by relevance (threshold=0.7)
   └────────┬─────────┘
            │
            ↓
   ┌──────────────────┐
   │ Context Builder  │ → Combine retrieved chunks
   │                  │ → Add metadata (agent, source)
   └────────┬─────────┘
            │
3. GENERATION
            │
            ↓
   ┌──────────────────┐
   │ Monica Agent     │ → Enhanced system prompt
   │ (Claude Sonnet)  │ → Retrieved context + user query
   └────────┬─────────┘ → Generate response
            │
            ↓
   ┌──────────────────┐
   │ RAG Metadata     │ → retrievedDocs, sources, confidence
   └──────────────────┘
```

## Implementation Requirements

### Phase 1: Core Infrastructure (Priority: CRITICAL)

#### 1.1 Vector Store Manager (`lib/llamaindex/vector-store.ts`)

**Purpose:** Manage ChromaDB connection and collections

**Key Functions:**

```typescript
/**
 * Initialize ChromaDB client
 * - Connect to ChromaDB (localhost:8000 or env variable)
 * - Create collections if they don't exist
 * - Health check and retry logic
 */
export async function initializeVectorStore(): Promise<VectorStoreClient>

/**
 * Create or get collection
 * - Collection: historical_agents
 * - Metadata: agentId, category, timestamp
 * - Distance: cosine similarity
 */
export async function getOrCreateCollection(name: string): Promise<Collection>

/**
 * Add documents to collection
 * - Batch processing (100 docs at a time)
 * - Progress tracking
 * - Error handling with partial success
 */
export async function addDocuments(
  collection: Collection,
  docs: Document[],
  embeddings: number[][]
): Promise<AddResult>

/**
 * Query collection
 * - Semantic search with filters
 * - Reranking by relevance
 * - Return top K results with metadata
 */
export async function queryCollection(
  collection: Collection,
  queryEmbedding: number[],
  filters?: Filter,
  topK?: number
): Promise<QueryResult[]>
```

**Technical Details:**

- Use ChromaDB JavaScript client from `chromadb` package
- Implement connection pooling with retry logic
- Add health check endpoint: `/api/vector-store/health`
- Cache collection references (2-minute TTL)
- Handle ChromaDB port conflicts (default 8000 conflicts with backend)

**Environment Variables:**

```env
CHROMADB_URL=http://localhost:8001  # Use 8001 to avoid backend conflict
CHROMADB_TENANT=default_tenant
CHROMADB_DATABASE=default_database
```

#### 1.2 Embeddings Service (`lib/llamaindex/embeddings-service.ts`)

**Purpose:** Generate embeddings using OpenAI

**Key Functions:**

```typescript
/**
 * Generate embeddings for text
 * - Model: text-embedding-3-small (1536 dimensions)
 * - Batch size: 100 texts per request
 * - Rate limiting: 3000 RPM
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]>

/**
 * Generate single embedding
 * - For query embedding
 * - Cache results (5-minute TTL)
 */
export async function generateQueryEmbedding(query: string): Promise<number[]>
```

**Technical Details:**

- Use `@llamaindex/openai` package
- Implement exponential backoff for rate limits
- Add Redis caching for frequently queried embeddings
- Monitor token usage (track via Galileo if enabled)

#### 1.3 Document Loader (`lib/llamaindex/document-loader.ts`)

**Purpose:** Extract and chunk agent knowledge

**Key Functions:**

```typescript
/**
 * Load all historical agents
 * - Read from lib/agents/historical/*.ts
 * - Extract: name, bio, personality, wisdom, quotes
 * - Return structured documents
 */
export async function loadHistoricalAgents(): Promise<AgentDocument[]>

/**
 * Chunk document into smaller pieces
 * - Strategy: Recursive character splitting
 * - Chunk size: 512 tokens (~2048 characters)
 * - Overlap: 50 tokens (~200 characters)
 * - Preserve semantic boundaries (sentences)
 */
export function chunkDocument(
  doc: AgentDocument,
  chunkSize?: number,
  overlap?: number
): DocumentChunk[]

/**
 * Extract metadata
 * - Agent ID, name, era
 * - Personality traits, stats
 * - Birth chart data
 */
export function extractMetadata(agent: any): DocumentMetadata
```

**Data Structure:**

```typescript
interface AgentDocument {
  agentId: string
  name: string
  content: string // Bio + personality + wisdom combined
  metadata: {
    era: string
    birthDate: string
    stats: AgentStats
    traits: string[]
    keywords: string[]
  }
}

interface DocumentChunk {
  id: string // agentId-chunk-0001
  agentId: string
  content: string
  metadata: DocumentMetadata
  chunkIndex: number
  totalChunks: number
}
```

#### 1.4 Ingestion Pipeline (`lib/llamaindex/ingestion-pipeline.ts`)

**Purpose:** Orchestrate document processing and vectorization

**Key Functions:**

```typescript
/**
 * Main ingestion pipeline
 * 1. Load all historical agents (35+)
 * 2. Chunk each agent's knowledge
 * 3. Generate embeddings for each chunk
 * 4. Store in ChromaDB
 * 5. Track progress and errors
 */
export async function ingestAgentKnowledge(options?: {
  forceReindex?: boolean
  agentIds?: string[] // Selective ingestion
  progressCallback?: (progress: Progress) => void
}): Promise<IngestionResult>

/**
 * Incremental update
 * - Only ingest new or modified agents
 * - Check last modified timestamp
 */
export async function incrementalUpdate(): Promise<UpdateResult>

/**
 * Validate ingestion
 * - Check document count
 * - Verify embeddings
 * - Test sample queries
 */
export async function validateIngestion(): Promise<ValidationResult>
```

**Progress Tracking:**

```typescript
interface Progress {
  stage: 'loading' | 'chunking' | 'embedding' | 'storing'
  currentAgent: string
  completed: number
  total: number
  errors: string[]
}
```

### Phase 2: Semantic Search (`lib/llamaindex/semantic-search.ts`)

**Purpose:** Query vector store and retrieve relevant context

**Key Functions:**

```typescript
/**
 * Semantic search across all agents
 * - Query embedding generation
 * - Vector similarity search
 * - Reranking and filtering
 * - Return top K results with scores
 */
export async function semanticSearch(
  query: string,
  options?: {
    topK?: number // Default: 5
    threshold?: number // Minimum relevance: 0.7
    agentIds?: string[] // Filter by specific agents
    includeMetadata?: boolean
  }
): Promise<SearchResult[]>

/**
 * Agent-specific search
 * - Find relevant context from a single agent
 * - Use for agent chat enhancement
 */
export async function searchAgentKnowledge(
  agentId: string,
  query: string,
  topK?: number
): Promise<SearchResult[]>

/**
 * Multi-agent search with grouping
 * - Search across agents
 * - Group results by agent
 * - Return balanced results
 */
export async function multiAgentSearch(
  query: string,
  agentIds: string[],
  resultsPerAgent?: number
): Promise<GroupedSearchResults>
```

**Data Structures:**

```typescript
interface SearchResult {
  id: string
  agentId: string
  agentName: string
  content: string
  score: number // Cosine similarity (0-1)
  metadata: {
    chunkIndex: number
    source: string
    era: string
    relevantTraits: string[]
  }
}

interface GroupedSearchResults {
  query: string
  totalResults: number
  resultsByAgent: Map<string, SearchResult[]>
}
```

### Phase 3: RAG Integration (`lib/rag/`)

#### 3.1 RAG Generator (`lib/rag/rag-generator.ts`)

**Purpose:** Integrate retrieved context with AI generation

**Key Functions:**

```typescript
/**
 * Generate with RAG enhancement
 * - Perform semantic search
 * - Build enhanced context
 * - Generate with Claude/GPT
 * - Return response + metadata
 */
export async function generateWithRAG(options: RAGGenerateOptions): Promise<RAGResult>

interface RAGGenerateOptions {
  agent: any // Historical or planetary agent
  agentId: string
  userMessage: string
  systemPrompt: string
  conversationHistory?: Message[]
  sessionId?: string
  ragConfig?: {
    enabled: boolean
    topK: number
    threshold: number
    useReranking: boolean
  }
}

interface RAGResult {
  text: string // AI-generated response (empty if RAG used)
  ragMetadata: {
    enabled: boolean
    ragUsed: boolean
    retrievedDocs: number
    sources: {
      agentId: string
      agentName: string
      excerpt: string
      relevance: number
    }[]
    queryTime: number // ms
    totalTime: number // ms
  }
}
```

**Context Building Strategy:**

````typescript
/**
 * Build enhanced context from search results
 *
 * Format:
 * ```
 * ## Retrieved Context
 *
 * ### From Leonardo da Vinci
 * "The human foot is a masterpiece of engineering and a work of art."
 * [Relevance: 0.89]
 *
 * ### From Albert Einstein
 * "Creativity is intelligence having fun."
 * [Relevance: 0.85]
 * ```
 */
function buildEnhancedContext(results: SearchResult[], maxTokens: number = 1500): string
````

#### 3.2 Monica RAG Wrapper (`lib/rag/monica-rag-wrapper.ts`)

**Purpose:** Replace stub with full implementation

**Requirements:**

- Maintain existing interface for backward compatibility
- Feature flag check: `USE_RAG_GENERATION`
- Fallback to non-RAG generation if disabled or errored
- Integrate with Galileo observability if enabled

**Enhanced Implementation:**

```typescript
import { semanticSearch } from '@/lib/llamaindex/semantic-search'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export async function generateWithRAG(options: RAGGenerateOptions): Promise<RAGResult> {
  const startTime = Date.now()

  // Check feature flag
  if (!process.env.USE_RAG_GENERATION || process.env.USE_RAG_GENERATION === 'false') {
    return {
      text: '',
      ragMetadata: { enabled: false, ragUsed: false },
    }
  }

  try {
    // 1. Semantic search
    const searchResults = await semanticSearch(options.userMessage, {
      topK: options.ragConfig?.topK || 5,
      threshold: options.ragConfig?.threshold || 0.7,
      agentIds: options.agentId ? [options.agentId] : undefined,
      includeMetadata: true,
    })

    // 2. Build enhanced context
    const enhancedContext = buildEnhancedContext(searchResults)

    // 3. Generate with Claude
    const enhancedSystemPrompt = `${options.systemPrompt}

## Retrieved Knowledge Context
${enhancedContext}

Use the above context to enhance your response, but maintain your unique personality and voice.
`

    const response = await generateText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      system: enhancedSystemPrompt,
      messages: [
        ...(options.conversationHistory || []),
        { role: 'user', content: options.userMessage },
      ],
      temperature: 0.7,
    })

    // 4. Track metrics
    const totalTime = Date.now() - startTime

    return {
      text: response.text,
      ragMetadata: {
        enabled: true,
        ragUsed: true,
        retrievedDocs: searchResults.length,
        sources: searchResults.map(r => ({
          agentId: r.agentId,
          agentName: r.agentName,
          excerpt: r.content.substring(0, 100) + '...',
          relevance: r.score,
        })),
        queryTime: totalTime,
        totalTime,
      },
    }
  } catch (error) {
    console.error('RAG generation failed, falling back to standard generation:', error)

    // Fallback: return empty to trigger standard generation
    return {
      text: '',
      ragMetadata: {
        enabled: true,
        ragUsed: false,
        error: error.message,
      },
    }
  }
}

export function getRAGStatus() {
  const enabled = process.env.USE_RAG_GENERATION === 'true'

  return {
    enabled,
    vectorStoreReady: enabled, // TODO: Add actual health check
    message: enabled
      ? 'RAG is enabled and operational'
      : 'RAG is disabled (set USE_RAG_GENERATION=true)',
  }
}
```

### Phase 4: API Endpoints

#### 4.1 Vector Store Ingestion (`app/api/vector-store/ingest/route.ts`)

**Purpose:** API endpoint to trigger ingestion

```typescript
import { ingestAgentKnowledge } from '@/lib/llamaindex/ingestion-pipeline'

export async function POST(request: Request) {
  try {
    const { action, agentIds, forceReindex } = await request.json()

    if (action !== 'ingest') {
      return Response.json({ error: 'Invalid action' }, { status: 400 })
    }

    const result = await ingestAgentKnowledge({
      forceReindex,
      agentIds,
      progressCallback: (progress) => {
        console.log(`Ingestion progress: ${progress.completed}/${progress.total}`)
      }
    })

    return Response.json({
      success: true,
      result: {
        agentsProcessed: result.agentsProcessed,
        chunksCreated: result.chunksCreated,
        embeddings Generated: result.embeddingsGenerated,
        timeElapsed: result.timeElapsed,
        errors: result.errors
      }
    })

  } catch (error) {
    console.error('Ingestion failed:', error)
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function GET(request: Request) {
  // Return ingestion status
  return Response.json({
    status: 'ready',
    collections: ['historical_agents'],
    documentCount: 1000,  // TODO: Get from ChromaDB
    lastIngestion: new Date().toISOString()
  })
}
```

#### 4.2 Vector Store Query (`app/api/vector-store/query/route.ts`)

**Purpose:** API endpoint for semantic search

```typescript
import { semanticSearch } from '@/lib/llamaindex/semantic-search'

export async function POST(request: Request) {
  try {
    const { query, topK, threshold, agentIds } = await request.json()

    if (!query) {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    const results = await semanticSearch(query, {
      topK: topK || 5,
      threshold: threshold || 0.7,
      agentIds,
      includeMetadata: true,
    })

    return Response.json({
      query,
      results: results.map(r => ({
        agentId: r.agentId,
        agentName: r.agentName,
        content: r.content,
        relevance: r.score,
        metadata: r.metadata,
      })),
      count: results.length,
    })
  } catch (error) {
    console.error('Search failed:', error)
    return Response.json(
      {
        error: error.message,
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')
  const topK = parseInt(searchParams.get('topK') || '5')

  if (!query) {
    return Response.json({ error: 'Query parameter required' }, { status: 400 })
  }

  const results = await semanticSearch(query, { topK })

  return Response.json({ query, results, count: results.length })
}
```

#### 4.3 Semantic Search Endpoint (`app/api/agents/semantic-search/route.ts`)

**Purpose:** Agent-focused semantic search

```typescript
import { searchAgentKnowledge, multiAgentSearch } from '@/lib/llamaindex/semantic-search'

export async function POST(request: Request) {
  try {
    const { concept, agentId, agentIds, topK } = await request.json()

    if (!concept) {
      return Response.json({ error: 'Concept is required' }, { status: 400 })
    }

    let results

    if (agentId) {
      // Single agent search
      results = await searchAgentKnowledge(agentId, concept, topK)
    } else if (agentIds && agentIds.length > 0) {
      // Multi-agent search
      results = await multiAgentSearch(concept, agentIds, topK || 3)
    } else {
      return Response.json(
        {
          error: 'Either agentId or agentIds must be provided',
        },
        { status: 400 }
      )
    }

    return Response.json({
      concept,
      results,
      agentId,
      agentIds,
    })
  } catch (error) {
    console.error('Agent semantic search failed:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
```

### Phase 5: Testing & Validation

#### 5.1 Unit Tests (`test/rag/`)

Create comprehensive tests:

```typescript
// test/rag/vector-store.test.ts
describe('Vector Store', () => {
  it('should initialize ChromaDB client')
  it('should create collection')
  it('should add documents with embeddings')
  it('should query with filters')
  it('should handle connection errors gracefully')
})

// test/rag/embeddings.test.ts
describe('Embeddings Service', () => {
  it('should generate embeddings for text')
  it('should batch process multiple texts')
  it('should cache query embeddings')
  it('should handle rate limiting')
})

// test/rag/semantic-search.test.ts
describe('Semantic Search', () => {
  it('should find relevant documents')
  it('should filter by agent ID')
  it('should rerank results')
  it('should return results within threshold')
})

// test/rag/rag-generator.test.ts
describe('RAG Generator', () => {
  it('should generate with RAG enhancement')
  it('should fallback when RAG disabled')
  it('should build enhanced context')
  it('should track metadata correctly')
})
```

#### 5.2 Integration Tests

Test complete pipeline:

```bash
# 1. Start ChromaDB
docker run -d -p 8001:8000 chromadb/chroma

# 2. Run ingestion
yarn rag:ingest

# 3. Test semantic search
curl -X POST http://localhost:3000/api/vector-store/query \
  -H "Content-Type: application/json" \
  -d '{"query": "creativity and innovation", "topK": 5}'

# 4. Test RAG in Monica chat
curl -X POST http://localhost:3000/api/monica-agent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What do you think about creativity?",
    "agentId": "monica",
    "sessionId": "test-session"
  }'
```

#### 5.3 Performance Benchmarks

Target metrics:

- **Ingestion:** Process 35 agents in < 60 seconds
- **Query time:** < 200ms for semantic search
- **Total RAG time:** < 500ms (search + generation)
- **Embedding cache hit rate:** > 80%
- **ChromaDB query time:** < 100ms

### Phase 6: Observability & Monitoring

#### 6.1 Galileo Integration

Add RAG metrics to Galileo:

```typescript
import { logToGalileo } from '@/lib/galileo-logger'

// In rag-generator.ts
await logToGalileo({
  event: 'rag_query',
  metadata: {
    query: userMessage,
    retrievedDocs: searchResults.length,
    topScore: searchResults[0]?.score,
    queryTime,
    totalTime,
    ragUsed: true,
  },
})
```

#### 6.2 Performance Dashboard

Add to `/api/performance` endpoint:

```typescript
{
  rag: {
    enabled: true,
    totalQueries: 1234,
    avgQueryTime: 187,
    avgRetrievedDocs: 4.2,
    cacheHitRate: 0.83,
    errorRate: 0.01
  }
}
```

## Environment Variables

Add to `.env.example` and configure in `.env.local`:

```env
# ================================
# RAG Configuration
# ================================

# Enable/disable RAG features
USE_RAG_GENERATION=true
USE_VECTOR_SEARCH=true

# ChromaDB Configuration
CHROMADB_URL=http://localhost:8001
CHROMADB_TENANT=default_tenant
CHROMADB_DATABASE=default_database
CHROMADB_AUTH_TOKEN=  # Optional for cloud deployment

# LlamaIndex Configuration
LLAMAINDEX_PERSIST_DIR=./data/llamaindex
LLAMAINDEX_CHUNK_SIZE=512
LLAMAINDEX_CHUNK_OVERLAP=50

# Embeddings Configuration
EMBEDDINGS_MODEL=text-embedding-3-small
EMBEDDINGS_DIMENSIONS=1536
EMBEDDINGS_BATCH_SIZE=100

# RAG Query Configuration
RAG_TOP_K=5
RAG_RELEVANCE_THRESHOLD=0.7
RAG_USE_RERANKING=true
RAG_MAX_CONTEXT_TOKENS=1500

# Caching
RAG_CACHE_TTL=300  # 5 minutes
RAG_EMBEDDING_CACHE_TTL=3600  # 1 hour
```

## Files to Create/Modify

### New Files:

1. `lib/llamaindex/vector-store.ts` - ChromaDB client and operations
2. `lib/llamaindex/embeddings-service.ts` - OpenAI embeddings
3. `lib/llamaindex/document-loader.ts` - Agent knowledge extraction
4. `lib/llamaindex/ingestion-pipeline.ts` - Orchestration
5. `lib/llamaindex/semantic-search.ts` - Query and retrieval
6. `lib/llamaindex/index.ts` - Barrel export
7. `lib/rag/rag-generator.ts` - RAG generation logic
8. `lib/rag/index.ts` - Barrel export
9. `app/api/vector-store/ingest/route.ts` - Ingestion endpoint
10. `app/api/vector-store/query/route.ts` - Query endpoint
11. `app/api/agents/semantic-search/route.ts` - Agent search
12. `test/rag/vector-store.test.ts` - Unit tests
13. `test/rag/embeddings.test.ts` - Unit tests
14. `test/rag/semantic-search.test.ts` - Unit tests
15. `test/rag/rag-generator.test.ts` - Unit tests

### Modified Files:

1. `lib/rag/monica-rag-wrapper.ts` - Replace stub with full implementation
2. `.env.example` - Add RAG environment variables
3. `package.json` - Verify ChromaDB/LlamaIndex versions
4. `scripts/setup-rag.sh` - Update for port 8001

## Implementation Order

### Week 1: Core Infrastructure

- [ ] Day 1-2: Vector store manager + embeddings service
- [ ] Day 3-4: Document loader + ingestion pipeline
- [ ] Day 5: Testing and validation

### Week 2: Semantic Search

- [ ] Day 1-2: Semantic search implementation
- [ ] Day 3: Agent-specific search
- [ ] Day 4-5: Multi-agent search and testing

### Week 3: RAG Integration

- [ ] Day 1-2: RAG generator
- [ ] Day 3: Monica RAG wrapper
- [ ] Day 4-5: API endpoints

### Week 4: Testing & Optimization

- [ ] Day 1-2: Comprehensive testing
- [ ] Day 3: Performance optimization
- [ ] Day 4: Observability integration
- [ ] Day 5: Documentation and deployment

## Success Criteria

- [ ] All 35+ historical agents successfully ingested
- [ ] Semantic search returns relevant results (>0.7 relevance)
- [ ] RAG enhances Monica responses with agent knowledge
- [ ] Sub-500ms total RAG response time
- [ ] > 90% uptime with graceful degradation
- [ ] Zero breaking changes to existing Monica API
- [ ] Comprehensive test coverage (>80%)
- [ ] Production deployment with monitoring

## Testing Commands

```bash
# Setup
docker run -d -p 8001:8000 chromadb/chroma
yarn install

# Ingestion
yarn rag:ingest

# Unit tests
yarn rag:test:unit

# Integration tests
yarn rag:test

# Local testing
curl -X POST http://localhost:3000/api/vector-store/query \
  -H "Content-Type: application/json" \
  -d '{"query": "wisdom", "topK": 3}'
```

## Common Issues & Solutions

### Issue 1: ChromaDB Port Conflict

**Problem:** Port 8000 conflicts with Express backend
**Solution:** Use port 8001 for ChromaDB

### Issue 2: LlamaIndex Module Errors

**Problem:** `Can't resolve '../agent/dist/index.js'`
**Solution:** Use LangChain instead or import from correct paths

### Issue 3: Embedding Rate Limits

**Problem:** OpenAI rate limiting (3000 RPM)
**Solution:** Implement batch processing with exponential backoff

### Issue 4: Large Context Windows

**Problem:** Too much retrieved context exceeds token limits
**Solution:** Limit context to 1500 tokens, summarize if needed

## References

- **ChromaDB Docs:** https://docs.trychroma.com/
- **LlamaIndex Docs:** https://ts.llamaindex.ai/
- **OpenAI Embeddings:** https://platform.openai.com/docs/guides/embeddings
- **Vercel AI SDK:** https://sdk.vercel.ai/docs

## Notes

- RAG system must work without breaking existing functionality
- Feature flag allows gradual rollout
- Graceful fallback is critical for production
- Monitor costs (OpenAI embeddings)
- Consider adding semantic caching to reduce costs
- Future: Add reranking model (Cohere, etc.)

---

**Ready to implement? Start with Phase 1.1 (Vector Store Manager) and work through phases sequentially.**
