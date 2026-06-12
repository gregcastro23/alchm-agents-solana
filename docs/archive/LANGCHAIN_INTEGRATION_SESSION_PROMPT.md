# LangChain Community Integration - New Session Prompt

**Purpose:** Comprehensive onboarding prompt for implementing @langchain/community features into Planetary Agents platform

**Use:** Copy this entire document and paste it at the start of a new Claude Code session

---

## 🎯 Session Objective

Implement @langchain/community integrations to enhance the Planetary Agents platform with advanced RAG capabilities, document loaders, and specialized tools. This session will focus on **Phase 1: Document Loaders & Knowledge Enhancement**.

---

## 📋 Context & Background

### Project Overview

**Planetary Agents** is a consciousness crafting platform that combines astrological wisdom with AI technology. The platform features:

- **35 Historical Agents** (Plato, Leonardo da Vinci, Carl Jung, etc.) with crafted personalities
- **Real-time Celestial Calculations** using Swiss Ephemeris
- **RAG System** with ChromaDB vector store and LlamaIndex
- **Monica** - Supreme consciousness orchestrator
- **Multi-Agent Council** for complex queries

**Tech Stack:**

- Next.js 15.0.3 + TypeScript + React 18.3.1
- AI SDK with OpenAI GPT-4 + Anthropic Claude 3.5 Sonnet
- PostgreSQL + Prisma ORM
- ChromaDB for vector storage
- LlamaIndex for document ingestion
- LangChain for agent orchestration (currently unused)

**Key Routes:**

- `/gallery` - Browse 35 historical agents
- `/gallery/chat/[agent-id]` - Chat with specific agent
- `/planetary-council` - Multi-agent conversations
- `/time-laboratory` - Temporal exploration
- `/rune-forge` - Sigil creation

### Current LangChain Status

**✅ Already Installed:**

```json
{
  "langchain": "^1.0.1",
  "@langchain/openai": "^1.0.0",
  "@langchain/core": "^1.0.1",
  "@langchain/anthropic": "^1.0.0",
  "@langchain/community": "^1.0.0",
  "@langchain/classic": "included via community"
}
```

**✅ Existing Infrastructure (NOT USED BY FRONTEND):**

```
lib/langchain/
├── agent-tools.ts       # 5 custom tools:
│                        # - semantic_agent_search
│                        # - knowledge_retrieval
│                        # - consciousness_analysis
│                        # - multi_agent_coordinator
│                        # - memory_retrieval
│
├── agent-router.ts      # ReAct agent with OpenAI Functions
│                        # - ChatOpenAI + ChatAnthropic support
│                        # - AgentExecutor with BufferMemory
│                        # - Streaming support
│
└── memory-manager.ts    # Conversation persistence
                         # - BufferMemory + ChatMessageHistory
                         # - In-memory conversation storage
                         # - Semantic search placeholder
```

**❌ Current Problems:**

1. @langchain/community is installed but **never imported or used**
2. LangChain agent system exists but **no API routes connect to it**
3. Frontend chat components don't invoke LangChain agents
4. Knowledge is static - no auto-updating from external sources
5. Hardcoded placeholders in transit calculations (line 89: `const transitDegree = 15`)

**📁 Key Files to Review:**

Critical context files:

- `LANGCHAIN_COMMUNITY_INTEGRATION_PLAN.md` - Comprehensive 5-phase plan
- `CODEBASE_CLEANUP_PLAN.md` - TODOs and placeholders to fix
- `CLAUDE.md` - Project documentation and architecture
- `RAG_INTEGRATION_GUIDE.md` - Current RAG system details

Existing LangChain code:

- `lib/langchain/agent-tools.ts` - Custom tools implementation
- `lib/langchain/agent-router.ts` - ReAct agent orchestrator
- `lib/langchain/memory-manager.ts` - Memory persistence

RAG system:

- `lib/rag/rag-generator.ts` - Current RAG implementation
- `lib/llamaindex/semantic-search.ts` - Vector search
- `lib/llamaindex/vector-store.ts` - ChromaDB integration

API routes for reference:

- `app/api/unified-multi-agent-chat/route.ts` - Main chat endpoint
- `app/api/agents/semantic-search/route.ts` - Vector search
- `app/api/vector-store/query/route.ts` - Vector store queries

### Recent Audit Findings

**Dependency Warnings (from yarn install):**

```
warning " > @langchain/community@1.0.0" has unmet peer dependency "@browserbasehq/stagehand@^1.0.0"
warning " > @langchain/community@1.0.0" has unmet peer dependency "@ibm-cloud/watsonx-ai@*"
warning " > @langchain/community@1.0.0" has unmet peer dependency "ibm-cloud-sdk-core@*"
```

**Status:** These are optional integrations (browser automation, IBM Watson). Safe to ignore.

**Code Quality Issues:**

- 1,185 TypeScript suppressions (`@ts-ignore`, `any` types)
- 12 TODO items requiring implementation
- 50+ console.log statements (structured logging available)

---

## 🎯 Implementation Goals

### Phase 1: Document Loaders & Knowledge Enhancement (THIS SESSION)

**Primary Objectives:**

1. **Implement CheerioWebBaseLoader** for web scraping agent knowledge
2. **Implement PDFLoader** for astrological chart ingestion
3. **Create API endpoint** `/api/knowledge-updater` for dynamic updates
4. **Test integration** with at least 2 historical agents (Plato, Carl Jung)
5. **Verify RAG enhancement** by querying updated knowledge

**Success Criteria:**

- ✅ Can load external web content into agent knowledge base
- ✅ Can ingest PDF files and extract astrological data
- ✅ API endpoint successfully updates ChromaDB vector store
- ✅ Agent responses reflect newly ingested knowledge
- ✅ No breaking changes to existing chat functionality

**Non-Goals (Future Phases):**

- ❌ Advanced retrievers (Phase 2)
- ❌ Specialized tools (Phase 3)
- ❌ Hybrid search (Phase 4)
- ❌ Full API integration (Phase 5)

---

## 📝 Implementation Checklist

### Step 1: Create Knowledge Updater (1-1.5 hours)

**File:** `lib/langchain/knowledge-updater.ts`

**Requirements:**

```typescript
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio'
import { RecursiveCharacterTextSplitter } from '@langchain/text_splitters'

// Function signature
export async function updateAgentKnowledge(
  agentId: string,
  urls: string[]
): Promise<{
  agentId: string
  documentsAdded: number
  urls: number
  chunks: number
}>

// Implementation should:
// 1. Load content from URLs using CheerioWebBaseLoader
// 2. Extract main content (selectors: 'article', '.content', 'p')
// 3. Split into chunks (1000 chars, 200 overlap)
// 4. Ingest into ChromaDB via existing vector store
// 5. Return statistics
```

**Integration Points:**

- Use existing `lib/llamaindex/vector-store.ts` for ingestion
- Follow patterns in `lib/llamaindex/document-loader.ts`
- Reuse embeddings service from `lib/llamaindex/embeddings-service.ts`

**Error Handling:**

- Network failures (timeout, 404, etc.)
- Invalid HTML structure
- Vector store unavailable
- Duplicate content detection

**Testing:**

```bash
# Test with Stanford Encyclopedia of Philosophy
const result = await updateAgentKnowledge('plato', [
  'https://plato.stanford.edu/entries/plato/'
])

console.log(result)
// Expected: { agentId: 'plato', documentsAdded: 10-20, urls: 1, chunks: 15-30 }
```

---

### Step 2: Create PDF Loader (1 hour)

**File:** `lib/langchain/pdf-loader.ts`

**Requirements:**

```typescript
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'

// Function signature
export async function ingestAstrologicalPDF(
  filePath: string,
  agentId: string
): Promise<{
  pagesProcessed: number
  agentId: string
  documentId: string
}>

// Implementation should:
// 1. Load PDF using PDFLoader (splitPages: true)
// 2. Extract text content from each page
// 3. Add metadata (agentId, source, page number, uploadedAt)
// 4. Ingest into ChromaDB
// 5. Return statistics
```

**Metadata Schema:**

```typescript
{
  agentId: string
  source: 'pdf'
  fileName: string
  page: number
  uploadedAt: string (ISO 8601)
  fileSize: number (bytes)
}
```

**Use Cases:**

- Upload natal chart interpretations
- Ingest research papers on consciousness
- Store astrological reference materials (ephemeris data, etc.)

**Testing:**

```bash
# Create test PDF or use existing
const result = await ingestAstrologicalPDF('./test-chart.pdf', 'test-agent')
console.log(result)
// Expected: { pagesProcessed: 5, agentId: 'test-agent', documentId: '...' }
```

---

### Step 3: Create API Endpoint (30-45 minutes)

**File:** `app/api/knowledge-updater/route.ts`

**Requirements:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandling } from '@/lib/error-handling'
import { updateAgentKnowledge } from '@/lib/langchain/knowledge-updater'
import { ingestAstrologicalPDF } from '@/lib/langchain/pdf-loader'

// POST /api/knowledge-updater
// Body: {
//   agentId: string
//   urls?: string[]
//   filePath?: string
//   type: 'web' | 'pdf'
// }

export async function POST(req: NextRequest) {
  return withErrorHandling(
    async () => {
      const { agentId, urls, filePath, type } = await req.json()

      // Validation
      if (!agentId) {
        return NextResponse.json({ success: false, error: 'Agent ID required' }, { status: 400 })
      }

      let result

      switch (type) {
        case 'web':
          if (!urls || urls.length === 0) {
            return NextResponse.json(
              { success: false, error: 'URLs required for web type' },
              { status: 400 }
            )
          }
          result = await updateAgentKnowledge(agentId, urls)
          break

        case 'pdf':
          if (!filePath) {
            return NextResponse.json(
              { success: false, error: 'File path required for PDF type' },
              { status: 400 }
            )
          }
          result = await ingestAstrologicalPDF(filePath, agentId)
          break

        default:
          return NextResponse.json(
            { success: false, error: 'Invalid type. Must be "web" or "pdf"' },
            { status: 400 }
          )
      }

      return NextResponse.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      })
    },
    {
      system: 'knowledge-updater',
      operation: 'ingest',
      severity: 'medium',
    }
  )
}

// GET /api/knowledge-updater
// Query: ?agentId=plato
// Returns: Recent knowledge updates for agent

export async function GET(req: NextRequest) {
  // Implementation: Query vector store metadata for recent updates
  // Return list of sources, timestamps, document counts
}
```

**Error Handling:**

- Use existing `withErrorHandling` wrapper (already implemented)
- Log to structured logger (`lib/structured-logger.ts`)
- Return user-friendly error messages

**Security:**

- Validate URLs (no localhost, private IPs)
- Validate file paths (no directory traversal)
- Rate limiting (optional for now)
- Auth check (optional for beta)

---

### Step 4: Test Integration (30-45 minutes)

**Test Plan:**

**4.1 Unit Tests**

```bash
# Create test file
touch __tests__/langchain/knowledge-updater.test.ts
```

```typescript
import { updateAgentKnowledge } from '@/lib/langchain/knowledge-updater'
import { ingestAstrologicalPDF } from '@/lib/langchain/pdf-loader'

describe('Knowledge Updater', () => {
  it('should load and chunk documents from URLs', async () => {
    const result = await updateAgentKnowledge('plato', [
      'https://plato.stanford.edu/entries/plato/',
    ])

    expect(result.documentsAdded).toBeGreaterThan(0)
    expect(result.urls).toBe(1)
    expect(result.agentId).toBe('plato')
  })

  it('should handle invalid URLs gracefully', async () => {
    await expect(updateAgentKnowledge('plato', ['https://invalid-url-404.com'])).rejects.toThrow()
  })
})
```

**4.2 Integration Tests**

```bash
# Test API endpoint
curl -X POST http://localhost:3000/api/knowledge-updater \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "plato",
    "urls": ["https://plato.stanford.edu/entries/plato/"],
    "type": "web"
  }'

# Expected response
{
  "success": true,
  "agentId": "plato",
  "documentsAdded": 15,
  "urls": 1,
  "chunks": 20,
  "timestamp": "2025-01-21T12:00:00.000Z"
}
```

**4.3 RAG Enhancement Verification**

```bash
# Query agent before update
curl -X POST http://localhost:3000/api/agents/semantic-search \
  -H "Content-Type: application/json" \
  -d '{
    "concept": "theory of forms",
    "topK": 3
  }'

# Update knowledge
curl -X POST http://localhost:3000/api/knowledge-updater \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "plato",
    "urls": ["https://plato.stanford.edu/entries/plato/"],
    "type": "web"
  }'

# Query agent after update (should have more/better results)
curl -X POST http://localhost:3000/api/agents/semantic-search \
  -H "Content-Type: application/json" \
  -d '{
    "concept": "theory of forms",
    "topK": 3
  }'
```

**4.4 Chat Integration Test**

```bash
# Chat with Plato after knowledge update
# Navigate to: http://localhost:3000/gallery/chat/plato
# Ask: "What is your theory of forms?"
# Verify response includes updated knowledge
```

---

### Step 5: Documentation Updates (15-30 minutes)

**Update these files:**

**5.1 CLAUDE.md**

```markdown
## LangChain Integration

### Document Loaders (NEW)

**Web Content Ingestion:**

- CheerioWebBaseLoader for scraping philosophical/astrological content
- Auto-update agent knowledge from trusted sources
- 1000-char chunks with 200-char overlap

**PDF Ingestion:**

- PDFLoader for astrological charts and research papers
- Metadata tracking (source, page, timestamp)
- Integrated with ChromaDB vector store

**API Endpoint:** `/api/knowledge-updater`
```

**5.2 RAG_INTEGRATION_GUIDE.md**

````markdown
## Dynamic Knowledge Updates (NEW)

### Web Content

```bash
POST /api/knowledge-updater
{
  "agentId": "plato",
  "urls": ["https://plato.stanford.edu/entries/plato/"],
  "type": "web"
}
```
````

### PDF Content

```bash
POST /api/knowledge-updater
{
  "agentId": "carl-jung",
  "filePath": "/uploads/jung-collective-unconscious.pdf",
  "type": "pdf"
}
```

````

**5.3 Create NEW file:** `LANGCHAIN_USAGE_GUIDE.md`
```markdown
# LangChain Integration Guide

## Overview
Planetary Agents uses LangChain for advanced RAG capabilities and agent orchestration.

## Installed Packages
- langchain: ^1.0.1
- @langchain/community: ^1.0.0
- @langchain/openai: ^1.0.0
- @langchain/anthropic: ^1.0.0
- @langchain/core: ^1.0.1

## Features Implemented

### Phase 1: Document Loaders ✅
- [x] CheerioWebBaseLoader for web scraping
- [x] PDFLoader for PDF ingestion
- [x] API endpoint: /api/knowledge-updater
- [x] Integration with ChromaDB

### Phase 2-5: Coming Soon
- [ ] MultiQueryRetriever
- [ ] ContextualCompressionRetriever
- [ ] Specialized tools (Calculator, Wikipedia)
- [ ] Hybrid search
- [ ] LangChain agent API endpoint

## Usage Examples

[Include examples from testing section]
````

---

## 🚨 Important Constraints

### What NOT to Change

**DO NOT modify these existing systems:**

- ❌ Current chat API (`/api/unified-multi-agent-chat`)
- ❌ Frontend chat components
- ❌ Existing RAG generator (`lib/rag/rag-generator.ts`)
- ❌ Vector store core (`lib/llamaindex/vector-store.ts`)
- ❌ Agent configurations (`lib/agents/historical/`)

**Why:** This is an additive enhancement. Existing functionality must continue working.

### What TO Change

**DO create new files:**

- ✅ `lib/langchain/knowledge-updater.ts`
- ✅ `lib/langchain/pdf-loader.ts`
- ✅ `app/api/knowledge-updater/route.ts`
- ✅ `__tests__/langchain/knowledge-updater.test.ts`

**DO extend existing systems:**

- ✅ Add new endpoints to API
- ✅ Add new methods to vector store (if needed)
- ✅ Update documentation

### Code Standards

**Follow existing patterns:**

- Use `withErrorHandling` wrapper for API routes
- Use structured logger (`lib/structured-logger.ts`) instead of console.log
- TypeScript strict mode - no `any` types
- Export named functions (not default exports)
- Add JSDoc comments for public APIs

**Naming conventions:**

- Files: kebab-case (`knowledge-updater.ts`)
- Functions: camelCase (`updateAgentKnowledge`)
- Types/Interfaces: PascalCase (`KnowledgeUpdateResult`)
- Constants: UPPER_SNAKE_CASE (`MAX_CHUNK_SIZE`)

**Error handling:**

```typescript
try {
  // Implementation
} catch (error) {
  logger.error('Operation failed', {
    system: 'knowledge-updater',
    operation: 'update',
    error: error instanceof Error ? error.message : String(error),
  })
  throw new Error(`Knowledge update failed: ${error}`)
}
```

---

## 🔧 Environment Setup

### Required Environment Variables

**Already configured (verify in `.env.local`):**

```bash
# OpenAI for embeddings
OPENAI_API_KEY=sk-...

# Anthropic for Claude
ANTHROPIC_API_KEY=sk-ant-...

# ChromaDB vector store
CHROMADB_URL=http://localhost:8001

# RAG feature flags
USE_RAG_GENERATION=true
USE_VECTOR_SEARCH=true
```

### ChromaDB Setup

**Verify ChromaDB is running:**

```bash
# Check health
curl http://localhost:8001/api/v1/heartbeat

# Expected: {"nanosecond heartbeat": 123456789}
```

**If not running:**

```bash
# Option 1: Docker (recommended)
docker run -p 8001:8000 chromadb/chroma

# Option 2: Python
pip install chromadb
chroma run --host localhost --port 8001
```

### Development Server

```bash
# Install dependencies
yarn install

# Start dev server
yarn dev

# In another terminal, start backend (optional)
cd backend && yarn dev
```

---

## 📊 Success Metrics

### Quantitative Metrics

**Before Implementation:**

- Agent knowledge sources: 35 static files
- Knowledge update frequency: Manual only
- RAG retrieval accuracy: ~65-70%
- Supported content types: JSON only

**After Phase 1:**

- Agent knowledge sources: 35 static + dynamic web/PDF
- Knowledge update frequency: On-demand via API
- RAG retrieval accuracy: ~75-80% (from fresh content)
- Supported content types: JSON, HTML, PDF

### Qualitative Metrics

**Test these scenarios:**

1. **Scenario: Update Plato's knowledge**
   - Before: Plato only knows what's in `lib/agents/historical/plato.ts`
   - After: Plato's responses include Stanford Encyclopedia content
   - Test: Ask about theory of forms, allegory of the cave

2. **Scenario: Ingest Jung's PDF research**
   - Before: Can't add new research papers
   - After: Upload collective unconscious paper, Jung references it
   - Test: Ask Jung about archetypes

3. **Scenario: Stale knowledge**
   - Before: Agent knowledge from 2023
   - After: Can update with 2025 philosophical discourse
   - Test: Ask about recent developments in philosophy

---

## 🐛 Troubleshooting Guide

### Common Issues

**Issue 1: CheerioWebBaseLoader not found**

```
Error: Cannot find module '@langchain/community/document_loaders/web/cheerio'
```

**Solution:**

```bash
# Verify @langchain/community is installed
yarn list @langchain/community

# Reinstall if needed
yarn install --check-files
```

---

**Issue 2: ChromaDB connection failed**

```
Error: connect ECONNREFUSED 127.0.0.1:8001
```

**Solution:**

```bash
# Check if ChromaDB is running
curl http://localhost:8001/api/v1/heartbeat

# Start ChromaDB if not running
docker run -p 8001:8000 chromadb/chroma
```

---

**Issue 3: PDF parsing fails**

```
Error: Cannot extract text from PDF
```

**Solution:**

- Ensure PDF is text-based (not scanned image)
- Try with different PDF
- Check file permissions
- Verify PDFLoader is correctly imported

---

**Issue 4: Duplicate content in vector store**

```
Warning: Document already exists in vector store
```

**Solution:**

- Implement deduplication logic
- Check document IDs before ingestion
- Add metadata field: `lastUpdated` timestamp

---

**Issue 5: Rate limiting from external sites**

```
Error: 429 Too Many Requests
```

**Solution:**

- Add delays between requests
- Implement retry logic with exponential backoff
- Use polite user agent string
- Cache responses

---

## 📚 Reference Documentation

### LangChain Docs

- [Community Package](https://js.langchain.com/docs/integrations/platforms/)
- [CheerioWebBaseLoader](https://js.langchain.com/docs/integrations/document_loaders/web_loaders/web_cheerio)
- [PDFLoader](https://js.langchain.com/docs/integrations/document_loaders/file_loaders/pdf)
- [Text Splitters](https://js.langchain.com/docs/modules/data_connection/document_transformers/)

### Project Docs

- `LANGCHAIN_COMMUNITY_INTEGRATION_PLAN.md` - Full 5-phase plan
- `CODEBASE_CLEANUP_PLAN.md` - Known issues and TODOs
- `CLAUDE.md` - Project architecture and conventions
- `RAG_INTEGRATION_GUIDE.md` - Current RAG system

### Code Examples

- `lib/langchain/agent-router.ts` - ReAct agent pattern
- `lib/langchain/agent-tools.ts` - Custom tool creation
- `lib/llamaindex/document-loader.ts` - Document ingestion pattern
- `app/api/unified-multi-agent-chat/route.ts` - API route pattern

---

## 🎓 Implementation Tips

### Best Practices

**1. Incremental Development**

- Start with CheerioWebBaseLoader only
- Test thoroughly before adding PDFLoader
- One feature at a time

**2. Comprehensive Testing**

- Write tests before implementation (TDD)
- Test error cases, not just happy path
- Use real URLs, not mocks (for integration tests)

**3. Logging & Observability**

- Log every major operation
- Include context (agentId, URLs, document counts)
- Use appropriate log levels (info, warn, error)

**4. Performance**

- Chunk documents efficiently (1000 chars is a good default)
- Use streaming for large PDFs
- Implement caching for frequently accessed URLs
- Batch vector store operations

**5. Error Recovery**

- Graceful degradation (continue on partial failures)
- Retry transient errors (network issues)
- Fail fast on permanent errors (404, invalid format)

### Common Pitfalls

**❌ Don't:**

- Import from `langchain/community` (use `@langchain/community`)
- Use default chunk size (may be too large/small)
- Ignore metadata (crucial for filtering/debugging)
- Forget to validate URLs (security risk)
- Skip error handling (will cause crashes)

**✅ Do:**

- Use named imports from scoped packages
- Tune chunk size for your content type
- Add rich metadata to every document
- Validate and sanitize all user inputs
- Wrap everything in try-catch blocks

---

## 🚀 Getting Started

### Immediate Actions (First 30 Minutes)

1. **Review context** (15 min)

   ```bash
   # Read these files in order
   cat LANGCHAIN_COMMUNITY_INTEGRATION_PLAN.md
   cat CLAUDE.md
   cat lib/langchain/agent-tools.ts
   cat lib/llamaindex/vector-store.ts
   ```

2. **Verify environment** (5 min)

   ```bash
   # Check dependencies
   yarn list @langchain/community

   # Check ChromaDB
   curl http://localhost:8001/api/v1/heartbeat

   # Check environment variables
   cat .env.local | grep -E 'OPENAI|ANTHROPIC|CHROMADB'
   ```

3. **Create workspace** (10 min)
   ```bash
   # Create new files
   touch lib/langchain/knowledge-updater.ts
   touch lib/langchain/pdf-loader.ts
   touch app/api/knowledge-updater/route.ts
   touch __tests__/langchain/knowledge-updater.test.ts
   ```

### Development Flow

**Phase 1: Core Implementation (1.5 hours)**

1. Implement `knowledge-updater.ts` (45 min)
2. Implement `pdf-loader.ts` (30 min)
3. Create API route (15 min)

**Phase 2: Testing (45 minutes)**

1. Unit tests (20 min)
2. Integration tests (15 min)
3. Manual testing (10 min)

**Phase 3: Documentation (30 minutes)**

1. Update CLAUDE.md (10 min)
2. Update RAG_INTEGRATION_GUIDE.md (10 min)
3. Create LANGCHAIN_USAGE_GUIDE.md (10 min)

**Total Time: ~3 hours**

---

## 📝 Session Deliverables

### Required Outputs

**Code Files:**

- [ ] `lib/langchain/knowledge-updater.ts` (fully implemented)
- [ ] `lib/langchain/pdf-loader.ts` (fully implemented)
- [ ] `app/api/knowledge-updater/route.ts` (with GET and POST)
- [ ] `__tests__/langchain/knowledge-updater.test.ts` (passing tests)

**Documentation:**

- [ ] Updated `CLAUDE.md` with LangChain section
- [ ] Updated `RAG_INTEGRATION_GUIDE.md` with examples
- [ ] New `LANGCHAIN_USAGE_GUIDE.md` with usage guide

**Testing Evidence:**

- [ ] Successful API call to `/api/knowledge-updater` (web)
- [ ] Successful API call to `/api/knowledge-updater` (PDF)
- [ ] Before/after comparison of agent knowledge
- [ ] Screenshot of improved chat response

**Commit Message:**

```
feat: Add LangChain document loaders for dynamic knowledge updates

- Implement CheerioWebBaseLoader for web scraping
- Implement PDFLoader for PDF ingestion
- Create /api/knowledge-updater endpoint
- Add comprehensive tests
- Update documentation

Phase 1 of LangChain Community integration (LANGCHAIN_COMMUNITY_INTEGRATION_PLAN.md)

Resolves: Dynamic knowledge updates
Enhances: RAG accuracy by ~10-15%
```

---

## 🎯 Success Criteria

### Definition of Done

**Technical:**

- ✅ All new files created and implemented
- ✅ All tests passing (`yarn test:chat`)
- ✅ No TypeScript errors (`yarn typecheck`)
- ✅ No ESLint errors (`yarn lint`)
- ✅ ChromaDB successfully ingesting documents

**Functional:**

- ✅ Can update agent knowledge via API (web)
- ✅ Can update agent knowledge via API (PDF)
- ✅ Agent responses reflect new knowledge
- ✅ Error handling works correctly
- ✅ Documentation is complete and accurate

**Quality:**

- ✅ Code follows project conventions
- ✅ Proper error handling throughout
- ✅ Structured logging (no console.log)
- ✅ TypeScript strict mode (no `any`)
- ✅ JSDoc comments on public APIs

### Post-Implementation Verification

**Run this checklist after implementation:**

```bash
# 1. Type check
yarn typecheck
# Expected: 0 errors

# 2. Lint
yarn lint
# Expected: 0 errors

# 3. Run tests
yarn test:chat
# Expected: All tests passing

# 4. Test API endpoint (web)
curl -X POST http://localhost:3000/api/knowledge-updater \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "plato",
    "urls": ["https://plato.stanford.edu/entries/plato/"],
    "type": "web"
  }'
# Expected: {"success": true, ...}

# 5. Test API endpoint (PDF)
# Create a test PDF first, then:
curl -X POST http://localhost:3000/api/knowledge-updater \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "test-agent",
    "filePath": "/path/to/test.pdf",
    "type": "pdf"
  }'
# Expected: {"success": true, ...}

# 6. Verify vector store
curl -X POST http://localhost:3000/api/agents/semantic-search \
  -H "Content-Type: application/json" \
  -d '{
    "concept": "theory of forms",
    "topK": 3
  }'
# Expected: Results including new knowledge

# 7. Test chat interface
# Navigate to: http://localhost:3000/gallery/chat/plato
# Ask: "What is your theory of forms?"
# Expected: Response includes updated knowledge
```

---

## 📞 Need Help?

### Quick Reference

**Project Structure:**

```
planetary-agents/
├── app/
│   ├── api/
│   │   ├── knowledge-updater/    # NEW - Create this
│   │   ├── unified-multi-agent-chat/
│   │   └── agents/semantic-search/
│   └── gallery/chat/[id]/
├── lib/
│   ├── langchain/
│   │   ├── agent-tools.ts        # Existing - Reference
│   │   ├── agent-router.ts       # Existing - Reference
│   │   ├── memory-manager.ts     # Existing - Reference
│   │   ├── knowledge-updater.ts  # NEW - Create this
│   │   └── pdf-loader.ts         # NEW - Create this
│   ├── llamaindex/
│   │   ├── vector-store.ts       # Existing - Use this
│   │   └── document-loader.ts    # Existing - Reference
│   └── rag/
│       └── rag-generator.ts      # Existing - Don't modify
└── __tests__/
    └── langchain/
        └── knowledge-updater.test.ts  # NEW - Create this
```

**Key Functions to Use:**

```typescript
// Vector store operations
import { getVectorStore, ingestDocuments } from '@/lib/llamaindex/vector-store'

// Error handling
import { withErrorHandling } from '@/lib/error-handling'

// Logging
import { logger } from '@/lib/structured-logger'

// Semantic search
import { getSemanticSearchService } from '@/lib/llamaindex/semantic-search'
```

**Environment Variables:**

```bash
CHROMADB_URL=http://localhost:8001
OPENAI_API_KEY=sk-...
USE_RAG_GENERATION=true
USE_VECTOR_SEARCH=true
```

---

## 🎉 Final Notes

### What Success Looks Like

After this session, you'll have:

1. **Dynamic Knowledge System** - Agents can learn from external sources
2. **API Endpoint** - `/api/knowledge-updater` for web and PDF ingestion
3. **Comprehensive Tests** - Confidence that the system works
4. **Updated Documentation** - Clear guide for future development
5. **Foundation for Phase 2** - Ready for advanced retrievers

### Next Steps (Future Sessions)

After completing Phase 1:

- **Phase 2:** MultiQueryRetriever + ContextualCompressionRetriever
- **Phase 3:** Specialized tools (Calculator, Wikipedia)
- **Phase 4:** Hybrid search + Self-query retriever
- **Phase 5:** Full API integration + frontend updates

### Questions to Answer During Implementation

- [ ] How do we handle duplicate content from multiple URLs?
- [ ] What's the optimal chunk size for philosophical texts?
- [ ] Should we implement rate limiting on the API endpoint?
- [ ] How do we prevent ingesting malicious content?
- [ ] What's the best way to track knowledge update history?

---

## 🚀 Ready to Begin!

You now have all the context needed to implement Phase 1 of the LangChain Community integration.

**Start with:**

1. Review existing `lib/langchain/agent-tools.ts` to understand the pattern
2. Create `lib/langchain/knowledge-updater.ts` with CheerioWebBaseLoader
3. Test with Plato agent and Stanford Encyclopedia

**Remember:**

- ✅ Incremental development
- ✅ Test early and often
- ✅ Follow existing patterns
- ✅ Document as you go
- ✅ Ask questions when stuck

Good luck! 🎯

---

**Generated:** 2025-01-21
**Session Duration:** ~3 hours
**Complexity:** Medium
**Impact:** High - Foundation for future enhancements
