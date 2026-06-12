# RAG Quick Start Checklist

## Prerequisites

- [ ] ChromaDB running on port 8001: `docker run -d -p 8001:8000 chromadb/chroma`
- [ ] OpenAI API key configured in `.env.local`
- [ ] Anthropic API key configured (for generation)
- [ ] Environment variables set:
  ```env
  USE_RAG_GENERATION=true
  USE_VECTOR_SEARCH=true
  CHROMADB_URL=http://localhost:8001
  LLAMAINDEX_PERSIST_DIR=./data/llamaindex
  ```

## Implementation Checklist

### Phase 1: Core Infrastructure ⚡ START HERE

- [ ] **File:** `lib/llamaindex/vector-store.ts`
  - [ ] `initializeVectorStore()` - ChromaDB connection
  - [ ] `getOrCreateCollection()` - Collection management
  - [ ] `addDocuments()` - Batch document insertion
  - [ ] `queryCollection()` - Semantic search

- [ ] **File:** `lib/llamaindex/embeddings-service.ts`
  - [ ] `generateEmbeddings()` - Batch embeddings
  - [ ] `generateQueryEmbedding()` - Single query embedding
  - [ ] Rate limiting with exponential backoff
  - [ ] Redis caching (optional)

- [ ] **File:** `lib/llamaindex/document-loader.ts`
  - [ ] `loadHistoricalAgents()` - Read agent files
  - [ ] `chunkDocument()` - Split into 512-token chunks
  - [ ] `extractMetadata()` - Agent metadata extraction

- [ ] **File:** `lib/llamaindex/ingestion-pipeline.ts`
  - [ ] `ingestAgentKnowledge()` - Main pipeline
  - [ ] Progress tracking callback
  - [ ] Error handling and partial success

### Phase 2: Semantic Search

- [ ] **File:** `lib/llamaindex/semantic-search.ts`
  - [ ] `semanticSearch()` - Cross-agent search
  - [ ] `searchAgentKnowledge()` - Single agent
  - [ ] `multiAgentSearch()` - Grouped results
  - [ ] Reranking and threshold filtering

### Phase 3: RAG Integration

- [ ] **File:** `lib/rag/rag-generator.ts`
  - [ ] `generateWithRAG()` - Main RAG function
  - [ ] `buildEnhancedContext()` - Context formatting
  - [ ] Claude integration with enhanced prompt
  - [ ] Metadata tracking

- [ ] **File:** `lib/rag/monica-rag-wrapper.ts` (REPLACE STUB)
  - [ ] Feature flag check
  - [ ] Call semantic search
  - [ ] Build enhanced context
  - [ ] Generate with Claude
  - [ ] Fallback handling
  - [ ] `getRAGStatus()` - Health check

### Phase 4: API Endpoints

- [ ] **File:** `app/api/vector-store/ingest/route.ts`
  - [ ] POST - Trigger ingestion
  - [ ] GET - Ingestion status

- [ ] **File:** `app/api/vector-store/query/route.ts`
  - [ ] POST - Semantic search
  - [ ] GET - Query with params

- [ ] **File:** `app/api/agents/semantic-search/route.ts`
  - [ ] POST - Agent-focused search
  - [ ] Single and multi-agent support

### Phase 5: Testing

- [ ] Unit tests in `test/rag/`
  - [ ] `vector-store.test.ts`
  - [ ] `embeddings.test.ts`
  - [ ] `semantic-search.test.ts`
  - [ ] `rag-generator.test.ts`

- [ ] Integration tests
  - [ ] Run full ingestion pipeline
  - [ ] Test API endpoints
  - [ ] Test Monica chat with RAG

### Phase 6: Production

- [ ] Performance benchmarks
  - [ ] Ingestion < 60s for 35 agents
  - [ ] Query time < 200ms
  - [ ] Total RAG time < 500ms

- [ ] Monitoring
  - [ ] Galileo integration
  - [ ] Performance dashboard
  - [ ] Error tracking

- [ ] Documentation
  - [ ] Update `.env.example`
  - [ ] Add to CLAUDE.md
  - [ ] API documentation

## Quick Test Commands

```bash
# 1. Start ChromaDB
docker run -d -p 8001:8000 chromadb/chroma

# 2. Set environment
echo "USE_RAG_GENERATION=true" >> .env.local
echo "CHROMADB_URL=http://localhost:8001" >> .env.local

# 3. Run ingestion
yarn rag:ingest

# 4. Test semantic search
curl -X POST http://localhost:3000/api/vector-store/query \
  -H "Content-Type: application/json" \
  -d '{"query": "creativity", "topK": 5}'

# 5. Test Monica with RAG
curl -X POST http://localhost:3000/api/monica-agent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about wisdom and creativity",
    "agentId": "monica",
    "sessionId": "test-rag"
  }'

# 6. Check RAG was used
# Response should include ragMetadata with ragUsed: true
```

## Key Files Summary

| File                                   | Purpose             | Critical Functions                     |
| -------------------------------------- | ------------------- | -------------------------------------- |
| `lib/llamaindex/vector-store.ts`       | ChromaDB operations | initializeVectorStore, queryCollection |
| `lib/llamaindex/embeddings-service.ts` | OpenAI embeddings   | generateEmbeddings                     |
| `lib/llamaindex/document-loader.ts`    | Load agent data     | loadHistoricalAgents, chunkDocument    |
| `lib/llamaindex/ingestion-pipeline.ts` | Orchestration       | ingestAgentKnowledge                   |
| `lib/llamaindex/semantic-search.ts`    | Search logic        | semanticSearch                         |
| `lib/rag/rag-generator.ts`             | RAG generation      | generateWithRAG                        |
| `lib/rag/monica-rag-wrapper.ts`        | Monica integration  | generateWithRAG, getRAGStatus          |

## Common Errors

### "ChromaDB connection failed"

```bash
# Check if ChromaDB is running
curl http://localhost:8001/api/v1/heartbeat

# Restart ChromaDB
docker restart <container-id>
```

### "Module not found: llamaindex"

```bash
# Reinstall dependencies
yarn install --check-files
```

### "Embedding rate limit exceeded"

```typescript
// In embeddings-service.ts, add retry logic:
await exponentialBackoff(async () => {
  return await openai.embeddings.create(...)
}, { maxRetries: 5, baseDelay: 1000 })
```

### "Build fails with llamaindex errors"

```typescript
// Use specific imports instead of barrel exports
import { Document } from 'llamaindex/Document'
// Instead of: import { Document } from 'llamaindex'
```

## Performance Targets

| Metric                     | Target  | Critical? |
| -------------------------- | ------- | --------- |
| Ingestion time (35 agents) | < 60s   | ❌        |
| Query time                 | < 200ms | ✅        |
| Total RAG time             | < 500ms | ✅        |
| Cache hit rate             | > 80%   | ❌        |
| Error rate                 | < 1%    | ✅        |

## Next Steps After Implementation

1. **Gradual Rollout:** Start with RAG disabled, test thoroughly, then enable for 10% of users
2. **Cost Monitoring:** Track OpenAI embedding costs (1M tokens ≈ $0.13)
3. **Quality Metrics:** Measure response quality with/without RAG
4. **A/B Testing:** Compare RAG vs non-RAG responses
5. **Expansion:** Add more knowledge sources (books, articles, etc.)

## Estimated Time

- **Phase 1-2 (Core + Search):** 2-3 days
- **Phase 3 (RAG Integration):** 1-2 days
- **Phase 4 (API Endpoints):** 1 day
- **Phase 5 (Testing):** 1-2 days
- **Phase 6 (Production):** 1 day

**Total:** ~7-10 days for full implementation

---

**Start with Phase 1.1 and check off each item as you complete it!**
