# RAG Phase 6: Advanced Features & Quality Enhancement

**Start Date:** November 6, 2025
**Status:** Planning → In Progress
**Focus:** User feedback, caching, multi-step reasoning, and quality improvements

---

## Phase 6 Goals

1. **Complete Phase 5 Carryovers** - User feedback widget and caching layer
2. **Multi-Step RAG Reasoning** - Chain multiple RAG retrievals for complex queries
3. **Custom Knowledge Injection** - Allow users to add documents to agent knowledge
4. **RAG Quality Improvements** - Enhanced relevance scoring and context selection
5. **Real-Time RAG Updates** - WebSocket-based live source streaming
6. **Cross-Agent Knowledge Synthesis** - Combine knowledge from multiple agents

---

## Task Breakdown

### 6.1: User Feedback Widget ✅ HIGH PRIORITY (Phase 5 Carryover)

**Goal:** Allow users to rate RAG response quality inline

**Component Design:**

```tsx
// components/rag/rag-feedback-widget.tsx
interface RAGFeedbackWidgetProps {
  queryId: string
  agentId: string
  sessionId: string
  sources: RAGSource[]
  compact?: boolean
}

// Features:
// - Thumbs up/down (quick feedback)
// - Star rating 1-5 (detailed quality)
// - "Sources were helpful" checkbox
// - Optional comment field (expandable)
// - Submit to /api/rag/feedback
```

**UI Placement:**

- Below source citations in chat messages
- Collapsed by default (thumbs up/down visible)
- Expands to show full form on interaction
- Shows "Thank you" confirmation after submission

**Analytics Integration:**

- Display feedback metrics in admin dashboard
- Filter queries by feedback rating
- Show correlation between relevance score and user rating
- Identify poorly-rated agents for improvement

**Database:** Already exists (RAGFeedback model from Phase 5)

**Estimated Time:** 2-3 hours

---

### 6.2: Intelligent Caching Layer ✅ HIGH PRIORITY (Phase 5 Carryover)

**Goal:** Cache RAG results to reduce latency and API costs

**Implementation:**

```typescript
// lib/rag/rag-cache.ts
interface CachedRAGResult {
  query: string
  queryHash: string
  agentId: string
  sources: RAGSource[]
  generatedResponse?: string
  timestamp: Date
  ttl: number
  hits: number
}

class RAGCache {
  // Primary: Redis (production)
  // Fallback: In-memory Map (development)

  async get(query: string, agentId: string): Promise<CachedRAGResult | null>
  async set(query: string, agentId: string, result: CachedRAGResult): Promise<void>
  async findSimilar(queryEmbedding: number[], agentId: string): Promise<CachedRAGResult | null>
  async invalidateAgent(agentId: string): Promise<void>
  async clear(): Promise<void>
  async stats(): Promise<CacheStats>
}
```

**Caching Strategy:**

- **Exact Match:** Hash-based lookup (query + agentId)
- **Similar Queries:** Cosine similarity >0.95 on embeddings
- **TTL:** 1 hour for exact, 30 min for similar
- **Invalidation:** Manual via admin dashboard or when agent bio updates

**Performance Targets:**

- Cache hit rate: >30%
- Cached response time: <50ms (vs ~400ms uncached)
- Cost savings: ~60-70% on embedding/generation calls

**Cache Warming:** Pre-populate with common queries:

- "Tell me about your life"
- "What are your greatest achievements?"
- "What wisdom do you have for modern times?"

**Estimated Time:** 3-4 hours

---

### 6.3: Multi-Step RAG Reasoning ✅ HIGH PRIORITY

**Goal:** Chain multiple RAG retrievals for complex, multi-faceted queries

**Use Cases:**

- "Compare Leonardo da Vinci and Michelangelo's views on art"
  → Retrieve from both agents, synthesize comparison
- "What would Einstein say about quantum computing based on his work?"
  → Retrieve Einstein's quantum views, apply to modern context
- "How would these 3 historical figures approach climate change?"
  → Multi-agent retrieval + synthesis

**Implementation:**

```typescript
// lib/rag/multi-step-rag.ts
interface RAGStep {
  step: number
  query: string
  agentIds: string[]
  sources: RAGSource[]
  reasoning: string
}

interface MultiStepRAGResult {
  steps: RAGStep[]
  synthesis: string
  confidence: number
  totalSources: number
}

async function executeMultiStepRAG(
  query: string,
  agents: Agent[],
  maxSteps: number = 3
): Promise<MultiStepRAGResult>
```

**Algorithm:**

1. **Query Analysis:** Identify if query requires multi-step reasoning
2. **Decomposition:** Break complex query into sub-queries
3. **Parallel Retrieval:** Fetch sources for each sub-query
4. **Progressive Synthesis:** Build answer incrementally
5. **Quality Check:** Verify coherence and completeness

**UI Updates:**

- Show "Analyzing query..." step-by-step progress
- Display sources grouped by reasoning step
- Expandable sections for each step's sources

**Estimated Time:** 4-5 hours

---

### 6.4: Custom Knowledge Injection ✅ MEDIUM PRIORITY

**Goal:** Allow users to upload documents to expand agent knowledge

**Features:**

1. **Document Upload Interface:**
   - Upload PDF, TXT, MD files
   - Attach to specific agent or create custom agent
   - Auto-generate embeddings
   - Add to ChromaDB collection

2. **Custom Agent Creator:**
   - "Create Custom Agent" button in gallery
   - Upload biography/knowledge base
   - Choose personality traits
   - Generate profile image (optional)

3. **Knowledge Management:**
   - View uploaded documents per agent
   - Edit/delete documents
   - Re-index on changes
   - Version control for documents

**Database Schema:**

```prisma
model CustomDocument {
  id          String   @id @default(cuid())
  userId      String
  agentId     String?   // null = general knowledge
  title       String
  content     String    @db.Text
  fileType    String    // pdf, txt, md
  fileName    String
  fileSize    Int
  embeddings  Json      // vector embeddings
  metadata    Json?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([userId])
  @@index([agentId])
}
```

**Security:**

- File size limit: 10MB
- Allowed types: PDF, TXT, MD only
- Virus scanning on upload
- User quota: 100 documents per user
- Content moderation for inappropriate content

**Estimated Time:** 5-6 hours

---

### 6.5: RAG Quality Improvements ✅ MEDIUM PRIORITY

**Goal:** Enhance retrieval relevance and context quality

**Improvements:**

1. **Hybrid Search:**
   - Combine semantic (embeddings) + keyword (BM25)
   - Weight: 70% semantic, 30% keyword
   - Better results for specific names/dates/facts

2. **Re-Ranking:**
   - After initial retrieval, re-rank by:
     - Temporal relevance (how recent is query context)
     - Source diversity (avoid redundant sources)
     - Agent expertise alignment
   - Use lightweight re-ranking model

3. **Context Window Optimization:**
   - Smart truncation (keep most relevant parts)
   - Source summarization for long documents
   - Token budget management (stay under limits)

4. **Relevance Threshold Tuning:**
   - Current: 0.35 (L2 distance)
   - Experiment with adaptive thresholds
   - Lower threshold for specific queries
   - Higher threshold for general queries

5. **Query Expansion:**
   - Expand user query with synonyms
   - Add temporal context ("as of 2025")
   - Clarify ambiguous terms

**A/B Testing:**

- Track relevance improvements with user feedback
- Compare old vs new retrieval strategies
- Measure impact on response quality

**Estimated Time:** 4-5 hours

---

### 6.6: Real-Time RAG Streaming ✅ LOW PRIORITY

**Goal:** Stream RAG sources and generation in real-time

**Implementation:**

```typescript
// lib/rag/rag-stream.ts
async function* streamRAGResponse(query: string, agentId: string) {
  // Step 1: Stream source retrieval
  yield { type: 'sources', sources: [...] }

  // Step 2: Stream generation with sources
  for await (const chunk of generateWithRAG(query, sources)) {
    yield { type: 'text', chunk }
  }

  // Step 3: Stream analytics
  yield { type: 'analytics', metadata: {...} }
}
```

**UI Updates:**

- Source citations appear as retrieved (progressive)
- Response streams word-by-word (better UX)
- Progress indicators for each step
- WebSocket or Server-Sent Events

**Benefits:**

- Perceived performance improvement
- Better user engagement
- Early feedback on retrieval quality

**Estimated Time:** 3-4 hours

---

### 6.7: Cross-Agent Knowledge Synthesis ✅ LOW PRIORITY

**Goal:** Combine knowledge from multiple agents for richer responses

**Use Cases:**

- "What would a council of Einstein, Da Vinci, and Tesla say about AI?"
- "Compare Renaissance and Enlightenment views on human potential"
- "Synthesize ancient and modern wisdom on meditation"

**Implementation:**

```typescript
// lib/rag/cross-agent-synthesis.ts
interface SynthesisResult {
  query: string
  agents: Agent[]
  sources: RAGSource[] // grouped by agent
  synthesis: string
  perspectives: {
    agentId: string
    agentName: string
    viewpoint: string
    sources: RAGSource[]
  }[]
  consensus?: string
  conflicts?: string
}

async function synthesizeAcrossAgents(query: string, agentIds: string[]): Promise<SynthesisResult>
```

**Algorithm:**

1. **Parallel Retrieval:** Query all agents simultaneously
2. **Perspective Extraction:** Identify each agent's viewpoint
3. **Consensus Detection:** Find common themes
4. **Conflict Identification:** Highlight disagreements
5. **Synthesis:** Weave perspectives into coherent response

**UI Display:**

- Tabbed view: Synthesis | Individual Perspectives | Sources
- Visual consensus meter
- Highlighted agreements/conflicts
- Interactive source exploration

**Estimated Time:** 4-5 hours

---

## Success Criteria

### 6.1: User Feedback Widget

- ✅ Widget visible in all RAG-enhanced messages
- ✅ Feedback submission <200ms
- ✅ Feedback appears in admin analytics
- ✅ >20% feedback participation rate

### 6.2: Caching Layer

- ✅ Cache hit rate >30%
- ✅ Cached response time <50ms
- ✅ Zero stale data issues
- ✅ Redis fallback working

### 6.3: Multi-Step RAG

- ✅ Correctly identifies complex queries
- ✅ Response quality improvement >25%
- ✅ Step-by-step UI clear and helpful
- ✅ No performance regression

### 6.4: Custom Knowledge

- ✅ Document upload works for PDF/TXT/MD
- ✅ Embeddings generated in <30s
- ✅ Custom documents appear in RAG results
- ✅ No security vulnerabilities

### 6.5: Quality Improvements

- ✅ Relevance score improvement >15%
- ✅ User feedback rating improvement
- ✅ Reduced "no relevant sources" cases
- ✅ A/B test shows statistical significance

### 6.6: Real-Time Streaming

- ✅ Sources stream progressively
- ✅ Text generation streams smoothly
- ✅ No connection drops
- ✅ Mobile-compatible

### 6.7: Cross-Agent Synthesis

- ✅ Accurate perspective extraction
- ✅ Consensus detection >80% accuracy
- ✅ Synthesis coherent and insightful
- ✅ UI intuitive and engaging

---

## Timeline

**Week 1 (Nov 6-12):**

- Day 1-2: 6.1 User Feedback Widget
- Day 2-3: 6.2 Caching Layer
- Day 4-5: 6.3 Multi-Step RAG (part 1)

**Week 2 (Nov 13-19):**

- Day 1-2: 6.3 Multi-Step RAG (part 2)
- Day 3-4: 6.4 Custom Knowledge Injection
- Day 5: 6.5 Quality Improvements (part 1)

**Week 3 (Nov 20-26):**

- Day 1-2: 6.5 Quality Improvements (part 2)
- Day 3: 6.6 Real-Time Streaming
- Day 4-5: 6.7 Cross-Agent Synthesis

**Total Estimated Time:** 25-30 hours over 3 weeks

---

## Priority Order

1. **P0 (Critical):** 6.1 User Feedback, 6.2 Caching
2. **P1 (High):** 6.3 Multi-Step RAG, 6.5 Quality Improvements
3. **P2 (Medium):** 6.4 Custom Knowledge
4. **P3 (Low):** 6.6 Streaming, 6.7 Cross-Agent Synthesis

**Recommended Approach:** Complete P0 tasks first, then proceed based on user needs and feedback.

---

## Dependencies

- ✅ Phase 5 core tasks complete
- ✅ Database schema with RAGFeedback model
- ✅ ChromaDB operational
- ✅ Admin analytics dashboard
- ⚠️ Redis (optional for caching, fallback available)
- ⚠️ Anthropic model access (still resolving)

---

## Risks & Mitigations

**High Risk:**

- **Caching complexity:** Cache invalidation edge cases
  - _Mitigation:_ Conservative TTLs, manual invalidation controls

**Medium Risk:**

- **Multi-step reasoning accuracy:** May produce incorrect synthesis
  - _Mitigation:_ Add confidence scores, show reasoning steps, allow feedback

- **Custom document quality:** User uploads may be low-quality
  - _Mitigation:_ Content guidelines, quality scoring, moderation

**Low Risk:**

- **Streaming implementation:** WebSocket complexity
  - _Mitigation:_ Fallback to polling, comprehensive error handling

---

## Post-Phase 6 Ideas (Phase 7+)

- **Multi-Language RAG** - Support non-English queries and documents
- **Voice-Based RAG** - Speech-to-text → RAG → text-to-speech
- **Mobile App** - Native iOS/Android RAG experience
- **Collaborative Sessions** - Share RAG conversations
- **Fine-Tuned Embeddings** - Custom embedding model for historical texts
- **Agentic RAG** - Autonomous agents that use RAG to improve themselves

---

## Deliverables

1. **Code:**
   - RAGFeedbackWidget component
   - RAGCache class with Redis integration
   - Multi-step RAG pipeline
   - Custom document upload system
   - Enhanced retrieval algorithms
   - Real-time streaming (optional)
   - Cross-agent synthesis (optional)

2. **Documentation:**
   - User feedback guide
   - Caching strategy documentation
   - Multi-step RAG usage guide
   - Custom knowledge injection tutorial
   - Quality improvement benchmarks

3. **Testing:**
   - Unit tests for all new features
   - Integration tests for caching
   - Performance benchmarks
   - User acceptance testing

---

**Phase 6 Status:** 🚀 Ready to Start
**Priority:** High (Enhances user experience and system performance)
**Estimated Completion:** 3 weeks (Nov 26, 2025)
**Success Metric:** >40% improvement in user satisfaction with RAG responses
