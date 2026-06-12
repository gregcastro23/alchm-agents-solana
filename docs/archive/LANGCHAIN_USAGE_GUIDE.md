# LangChain Community Integration Guide

## Overview

Planetary Agents uses LangChain for advanced RAG capabilities, agent orchestration, and dynamic knowledge updates. This guide covers the implemented features and usage patterns.

**Integration Status:** Phase 1 Complete ✅ (January 2025)

## Installed Packages

```json
{
  "langchain": "^1.0.1",
  "@langchain/community": "^1.0.0",
  "@langchain/openai": "^1.0.0",
  "@langchain/anthropic": "^1.0.0",
  "@langchain/core": "^1.0.1",
  "@langchain/textsplitters": "^1.0.0"
}
```

## Implementation Status

### ✅ Phase 1: Document Loaders (COMPLETE)

**Implemented Features:**

- [x] CheerioWebBaseLoader for web scraping
- [x] PDFLoader for PDF ingestion
- [x] API endpoint: `/api/knowledge-updater`
- [x] Integration with ChromaDB vector store
- [x] Comprehensive error handling
- [x] Security validation (URL/path sanitization)
- [x] Unit tests with Vitest

**Files Created:**

- `lib/langchain/knowledge-updater.ts` - Web content ingestion
- `lib/langchain/pdf-loader.ts` - PDF document ingestion
- `app/api/knowledge-updater/route.ts` - HTTP API endpoint
- `__tests__/langchain/knowledge-updater.test.ts` - Unit tests
- `test-knowledge-updater.sh` - Integration test script

### 🔜 Phase 2-5: Planned Features

- [ ] **Phase 2:** MultiQueryRetriever + ContextualCompressionRetriever
- [ ] **Phase 3:** Specialized tools (Calculator, Wikipedia)
- [ ] **Phase 4:** Hybrid search (BM25 + Vector)
- [ ] **Phase 5:** LangChain agent API endpoint

---

## Features

### 1. Web Content Ingestion

Extract and ingest knowledge from web pages using CheerioWebBaseLoader.

**Use Cases:**

- Update agent knowledge from Stanford Encyclopedia of Philosophy
- Ingest Wikipedia articles
- Add philosophical texts and research papers
- Enhance agent responses with current information

**Implementation:**

```typescript
import { updateAgentKnowledge } from '@/lib/langchain/knowledge-updater'

const result = await updateAgentKnowledge('plato', ['https://plato.stanford.edu/entries/plato/'], {
  chunkSize: 1000,
  chunkOverlap: 200,
  contentSelector: 'article, main, .content',
})

console.log(`Added ${result.documentsAdded} documents from ${result.urls} URLs`)
```

**Security Features:**

- ✅ URL validation (only HTTP/HTTPS)
- ✅ Blocks localhost and private IPs
- ✅ Prevents directory traversal
- ✅ Configurable content selectors

### 2. PDF Document Ingestion

Extract text from PDF files for astrological charts and research papers.

**Use Cases:**

- Ingest natal chart interpretations
- Add research papers on consciousness
- Store astrological reference materials
- Upload historical documents

**Implementation:**

```typescript
import { ingestAstrologicalPDF } from '@/lib/langchain/pdf-loader'

const result = await ingestAstrologicalPDF('/path/to/chart.pdf', 'carl-jung', {
  chunkSize: 1000,
  chunkOverlap: 200,
  splitPages: true,
  metadata: {
    category: 'research',
    tags: ['psychology', 'collective-unconscious'],
  },
})

console.log(`Processed ${result.pagesProcessed} pages`)
```

**Security Features:**

- ✅ File path validation
- ✅ File extension check (.pdf only)
- ✅ File size limit (50MB max)
- ✅ Directory traversal prevention

### 3. Knowledge Updater API

HTTP endpoints for dynamic knowledge management.

#### POST /api/knowledge-updater

Ingest knowledge from web URLs or PDF files.

**Request Body (Web):**

```json
{
  "agentId": "plato",
  "type": "web",
  "urls": ["https://plato.stanford.edu/entries/plato/"],
  "options": {
    "chunkSize": 1000,
    "chunkOverlap": 200,
    "contentSelector": "article"
  }
}
```

**Request Body (PDF):**

```json
{
  "agentId": "carl-jung",
  "type": "pdf",
  "filePath": "/uploads/jung-collective-unconscious.pdf",
  "options": {
    "chunkSize": 1000,
    "chunkOverlap": 200,
    "metadata": {
      "category": "research"
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "agentId": "plato",
  "documentsAdded": 15,
  "urls": 1,
  "chunks": 20,
  "errors": [],
  "timestamp": "2025-01-21T12:00:00.000Z",
  "duration": 3500
}
```

#### GET /api/knowledge-updater

Query recent knowledge updates for an agent.

**Request:**

```bash
GET /api/knowledge-updater?agentId=plato&limit=10
```

**Response:**

```json
{
  "success": true,
  "agentId": "plato",
  "updates": [],
  "count": 0,
  "timestamp": "2025-01-21T12:00:00.000Z"
}
```

---

## Usage Examples

### Example 1: Update Plato's Knowledge

Update Plato with current philosophical discourse:

```bash
curl -X POST http://localhost:3000/api/knowledge-updater \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "plato",
    "urls": ["https://plato.stanford.edu/entries/plato/"],
    "type": "web"
  }'
```

**Expected Output:**

```json
{
  "success": true,
  "agentId": "plato",
  "documentsAdded": 15,
  "urls": 1,
  "chunks": 20,
  "errors": [],
  "timestamp": "2025-01-21T12:00:00.000Z"
}
```

### Example 2: Ingest Jung's Research

Add Carl Jung's research papers:

```bash
curl -X POST http://localhost:3000/api/knowledge-updater \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "carl-jung",
    "filePath": "/uploads/collective-unconscious.pdf",
    "type": "pdf"
  }'
```

**Expected Output:**

```json
{
  "success": true,
  "agentId": "carl-jung",
  "pagesProcessed": 50,
  "documentsAdded": 120,
  "documentId": "carl-jung-collective-unconscious.pdf-1234567890",
  "fileName": "collective-unconscious.pdf",
  "fileSize": 2048576,
  "errors": [],
  "timestamp": "2025-01-21T12:00:00.000Z"
}
```

### Example 3: Batch Update Multiple Agents

Update multiple agents with relevant content:

```typescript
import { updateAgentKnowledge } from '@/lib/langchain/knowledge-updater'
import { calculateKnowledgeStats } from '@/lib/langchain/knowledge-updater'

const agents = [
  { id: 'plato', urls: ['https://plato.stanford.edu/entries/plato/'] },
  { id: 'aristotle', urls: ['https://plato.stanford.edu/entries/aristotle/'] },
  { id: 'socrates', urls: ['https://plato.stanford.edu/entries/socrates/'] },
]

const results = []

for (const agent of agents) {
  try {
    const result = await updateAgentKnowledge(agent.id, agent.urls)
    results.push(result)
    console.log(`✅ Updated ${agent.id}: ${result.documentsAdded} documents`)
  } catch (error) {
    console.error(`❌ Failed to update ${agent.id}:`, error)
  }
}

const stats = calculateKnowledgeStats(results)
console.log(`Total: ${stats.totalDocuments} documents from ${stats.totalUrls} URLs`)
```

### Example 4: Test Script

Use the provided test script for integration testing:

```bash
chmod +x test-knowledge-updater.sh
./test-knowledge-updater.sh
```

---

## Configuration

### Environment Variables

Required environment variables in `.env.local`:

```bash
# OpenAI for embeddings
OPENAI_API_KEY=sk-...

# ChromaDB vector store
CHROMADB_URL=http://localhost:8001

# Optional: Logging level
LOG_LEVEL=INFO
```

### Chunking Configuration

Default chunking parameters (can be overridden):

```typescript
const DEFAULT_CHUNK_SIZE = 1000 // characters
const DEFAULT_CHUNK_OVERLAP = 200 // characters
const DEFAULT_COLLECTION_NAME = 'historical-agents'
```

**Recommended Settings:**

| Content Type        | Chunk Size | Overlap | Rationale               |
| ------------------- | ---------- | ------- | ----------------------- |
| Philosophical texts | 1000       | 200     | Preserve argument flow  |
| Research papers     | 800        | 150     | Dense technical content |
| General articles    | 1200       | 250     | Broader context needed  |
| Natal charts        | 500        | 100     | Structured data         |

### Content Selectors

For web scraping, prioritize these HTML elements:

```typescript
const CONTENT_SELECTORS = [
  'article', // Primary article content
  'main', // Main content area
  '.content', // Common content class
  '.entry-content', // WordPress articles
  '#content', // Content by ID
  'p', // Fallback to paragraphs
]
```

---

## Error Handling

### Common Errors

#### 1. ChromaDB Connection Failed

**Error:**

```
Failed to connect to ChromaDB after 3 attempts
```

**Solution:**

```bash
# Start ChromaDB
docker run -d -p 8001:8000 chromadb/chroma

# Verify it's running
curl http://localhost:8001/api/v2/heartbeat
```

#### 2. URL Blocked (Security)

**Error:**

```
Blocked private URL: http://localhost:3000
```

**Solution:**
Only use public URLs. Private IPs and localhost are blocked for security.

#### 3. PDF Parsing Failed

**Error:**

```
No text content could be extracted from PDF
```

**Solutions:**

- Ensure PDF is text-based (not scanned image)
- Try OCR preprocessing if needed
- Check file is not corrupted

#### 4. Rate Limiting

**Error:**

```
Rate limited, retrying in 2000ms...
```

**Solution:**
The system automatically retries with exponential backoff. Wait for completion.

#### 5. Invalid File Path

**Error:**

```
Directory traversal detected in file path
```

**Solution:**
Use absolute paths without `..` traversal:

```typescript
// ✅ Good
'/uploads/chart.pdf'

// ❌ Bad
'../../etc/passwd'
```

---

## Performance

### Benchmarks

Typical performance metrics:

| Operation                        | Duration    | Notes                |
| -------------------------------- | ----------- | -------------------- |
| Load web page                    | 500-2000ms  | Depends on page size |
| Load PDF (10 pages)              | 1000-3000ms | Depends on file size |
| Generate embeddings (100 chunks) | 2000-5000ms | OpenAI API call      |
| Ingest to ChromaDB (100 docs)    | 500-1500ms  | Batch processing     |
| **Total: Web ingestion**         | **4-10s**   | Full pipeline        |
| **Total: PDF ingestion**         | **5-12s**   | Full pipeline        |

### Optimization Tips

1. **Batch Operations:** Update multiple agents in parallel
2. **Cache Embeddings:** In-memory cache reduces API calls
3. **Adjust Chunk Size:** Larger chunks = fewer embeddings = faster
4. **Content Selectors:** Specific selectors reduce parsing time

---

## Testing

### Unit Tests

Run the unit test suite:

```bash
# Run all LangChain tests
yarn test __tests__/langchain/knowledge-updater.test.ts

# Run with coverage
yarn test --coverage __tests__/langchain/
```

### Integration Tests

Run the integration test script:

```bash
# Make script executable
chmod +x test-knowledge-updater.sh

# Run tests
./test-knowledge-updater.sh
```

### Manual Testing

Test the API endpoints manually:

```bash
# Test web ingestion
curl -X POST http://localhost:3000/api/knowledge-updater \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "plato",
    "urls": ["https://plato.stanford.edu/entries/plato/"],
    "type": "web"
  }' | jq '.'

# Test query endpoint
curl -X GET "http://localhost:3000/api/knowledge-updater?agentId=plato&limit=5" | jq '.'
```

---

## Best Practices

### 1. URL Selection

✅ **Good URLs:**

- Stanford Encyclopedia of Philosophy
- Wikipedia articles (stable versions)
- Academic journals (open access)
- Official documentation sites

❌ **Avoid:**

- Paywalled content
- Dynamic/JavaScript-heavy pages
- Sites with aggressive anti-scraping
- Private/internal URLs

### 2. Content Quality

- Verify content is relevant before ingestion
- Use specific content selectors to avoid noise
- Test with small URL sets first
- Monitor chunk quality with sample queries

### 3. Rate Limiting

- Add delays between batch operations
- Respect website robots.txt
- Use polite user-agent strings
- Monitor API usage (OpenAI, ChromaDB)

### 4. Security

- Always validate URLs and file paths
- Never expose API keys in logs
- Implement authentication for production
- Sanitize user inputs
- Use HTTPS for external requests

### 5. Maintenance

- Periodically update agent knowledge
- Monitor vector store size
- Clean up outdated embeddings
- Log all operations for debugging
- Track success/failure rates

---

## Future Enhancements (Phases 2-5)

### Phase 2: Advanced Retrievers

```typescript
// MultiQueryRetriever - Generate multiple query variations
const retriever = new MultiQueryRetriever({
  vectorStore,
  llm: new ChatOpenAI(),
  numQueries: 3,
})

// ContextualCompressionRetriever - Compress retrieved documents
const compressor = new LLMChainExtractor({
  llm: new ChatOpenAI(),
})

const compressionRetriever = new ContextualCompressionRetriever({
  baseCompressor: compressor,
  baseRetriever: vectorStoreRetriever,
})
```

### Phase 3: Specialized Tools

```typescript
// Calculator tool for numerical queries
import { Calculator } from '@langchain/community/tools/calculator'

// Wikipedia tool for encyclopedic knowledge
import { WikipediaQueryRun } from '@langchain/community/tools/wikipedia_query_run'

// Web browser tool for dynamic scraping
import { WebBrowser } from '@langchain/community/tools/webbrowser'
```

### Phase 4: Hybrid Search

```typescript
// Combine BM25 (keyword) + Vector (semantic) search
import { BM25Retriever } from '@langchain/community/retrievers/bm25'

const hybridRetriever = new HybridRetriever({
  vectorRetriever,
  bm25Retriever,
  weights: { vector: 0.7, bm25: 0.3 },
})
```

### Phase 5: Full Agent Integration

```typescript
// LangChain-powered agent endpoint
POST /api/langchain-agent

// Request
{
  "query": "What is Plato's theory of forms?",
  "agentIds": ["plato", "aristotle"],
  "tools": ["semantic_search", "wikipedia", "calculator"]
}

// Response
{
  "answer": "...",
  "sources": [...],
  "reasoning": "...",
  "toolsUsed": [...]
}
```

---

## Troubleshooting

### Debug Mode

Enable verbose logging:

```bash
# In .env.local
LOG_LEVEL=DEBUG

# Check logs
yarn dev
# Watch for [langchain] prefixed logs
```

### Common Issues

1. **"No content extracted"**
   - Try different content selectors
   - Check if page requires JavaScript
   - Verify URL is accessible

2. **"Embeddings generation failed"**
   - Check OPENAI_API_KEY is valid
   - Verify API quota hasn't been exceeded
   - Check network connectivity

3. **"ChromaDB unavailable"**
   - Restart ChromaDB container
   - Check CHROMADB_URL is correct
   - Verify port 8001 is not blocked

4. **"File not found"**
   - Use absolute file paths
   - Check file permissions
   - Verify file exists on filesystem

---

## Support

### Resources

- **Documentation:** [CLAUDE.md](./CLAUDE.md) - Project overview
- **RAG Guide:** [RAG_INTEGRATION_GUIDE.md](./RAG_INTEGRATION_GUIDE.md) - Vector store details
- **Integration Plan:** [LANGCHAIN_COMMUNITY_INTEGRATION_PLAN.md](./LANGCHAIN_COMMUNITY_INTEGRATION_PLAN.md) - Full roadmap

### Code References

- **Knowledge Updater:** [lib/langchain/knowledge-updater.ts](./lib/langchain/knowledge-updater.ts)
- **PDF Loader:** [lib/langchain/pdf-loader.ts](./lib/langchain/pdf-loader.ts)
- **API Endpoint:** [app/api/knowledge-updater/route.ts](./app/api/knowledge-updater/route.ts)
- **Unit Tests:** [**tests**/langchain/knowledge-updater.test.ts](./__tests__/langchain/knowledge-updater.test.ts)

### External Documentation

- **LangChain JS:** https://js.langchain.com/docs/
- **ChromaDB:** https://docs.trychroma.com/
- **OpenAI Embeddings:** https://platform.openai.com/docs/guides/embeddings

---

## Changelog

### Phase 1 - January 21, 2025

**Added:**

- ✅ CheerioWebBaseLoader for web scraping
- ✅ PDFLoader for PDF document ingestion
- ✅ `/api/knowledge-updater` HTTP endpoint (POST, GET)
- ✅ Integration with ChromaDB vector store
- ✅ URL and file path security validation
- ✅ Comprehensive error handling
- ✅ Unit tests with Vitest
- ✅ Integration test script
- ✅ Documentation (this file)

**Security:**

- ✅ URL validation (blocks localhost, private IPs)
- ✅ File path sanitization (prevents directory traversal)
- ✅ File type validation (.pdf only)
- ✅ File size limits (50MB max)

**Performance:**

- ✅ Batch processing for embeddings
- ✅ In-memory caching for embeddings
- ✅ Retry logic with exponential backoff
- ✅ Progress callbacks for long operations

---

**Status:** Phase 1 Complete ✅
**Next:** Phase 2 - Advanced Retrievers (Q1 2025)
**Generated:** 2025-01-21
**Maintainer:** Planetary Agents Team
