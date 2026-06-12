# LangChain & LlamaIndex Integration Prompt for Planetary Agents

## Context & Current State

We have a fully functional Planetary Agents application with:

- 34 historical consciousness agents (Leonardo da Vinci, Carl Jung, Marie Curie, etc.)
- Real-time moment synergy calculation (birth chart × current cosmic moment)
- Galileo MCP server integration for observability
- Agent chat interface at `/gallery/chat/[id]`
- API endpoint: `/api/monica-agent` handling historical agent interactions
- Tech stack: Next.js 15.5.4, TypeScript, OpenAI SDK, Anthropic Claude

**Current Limitations:**

- Agent responses are generated fresh each time (no knowledge base)
- No semantic search across agent wisdom
- Limited context awareness beyond current conversation
- No efficient retrieval of relevant historical knowledge
- Agent memories not persistent or searchable

## Objective

Implement comprehensive LangChain and LlamaIndex integration to transform our agent system into a sophisticated RAG (Retrieval-Augmented Generation) architecture with:

1. **Vector Knowledge Base** - Semantic search across all agent wisdom
2. **Persistent Agent Memory** - Long-term conversation context
3. **Context-Aware Responses** - RAG-enhanced agent generation
4. **Multi-Agent Orchestration** - LangChain agent tools for coordination
5. **Semantic Consciousness Matching** - Find agents by conceptual similarity

## Tasks Breakdown

### Phase 1: LlamaIndex Knowledge Base Setup

**1.1 Install Dependencies**

```bash
yarn add llamaindex @llamaindex/openai @llamaindex/core @llamaindex/env
yarn add -D @types/node
```

**1.2 Create Vector Store Infrastructure**

- Set up vector database (Pinecone, Weaviate, or ChromaDB)
- Configure embeddings provider (OpenAI text-embedding-3-small)
- Create `lib/llamaindex-vector-store.ts` with:
  - Vector store initialization
  - Document ingestion pipeline
  - Semantic search functionality
  - Metadata filtering (by agent, topic, time period)

**1.3 Agent Knowledge Ingestion**

- Extract all 34 agent personalities from `lib/agents/historical/`
- Parse agent data: name, title, abilities, wisdom domains, personality traits
- Create document chunks with metadata:
  ```typescript
  {
    agentId: 'leonardo-da-vinci',
    agentName: 'Leonardo da Vinci',
    content: 'wisdom/personality/abilities text',
    wisdomDomains: ['Art', 'Science', 'Innovation'],
    historicalPeriod: 'Renaissance',
    birthData: { date, location },
    consciousness: { level, monicaConstant, dominantElement }
  }
  ```
- Build vector index from agent documents
- Store embeddings in vector database

**1.4 Conversation History Storage**

- Create conversation document structure
- Index past interactions with embeddings
- Enable temporal search (recent vs historical conversations)
- Link conversations to agent consciousness evolution

### Phase 2: LangChain Agent Tools Integration

**2.1 Install LangChain**

```bash
yarn add langchain @langchain/openai @langchain/core @langchain/community
yarn add @langchain/anthropic
```

**2.2 Create Agent Tools**
Create `lib/langchain-agent-tools.ts` with:

**Tool 1: Semantic Agent Search**

- Input: User query/topic
- Function: Search vector store for most relevant agents
- Output: Top 3 agents with similarity scores
- Metadata: Wisdom domains, synergy compatibility

**Tool 2: Knowledge Retrieval**

- Input: Topic/question + agent context
- Function: Retrieve relevant knowledge chunks from vector store
- Output: Context-enriched information for generation
- Filters: By agent, time period, wisdom domain

**Tool 3: Consciousness Analysis**

- Input: User profile, current moment
- Function: Calculate synergy scores across all agents
- Output: Ranked agents by cosmic compatibility
- Integration: Existing `calculateCurrentMomentSynergy` function

**Tool 4: Multi-Agent Coordinator**

- Input: Complex question requiring multiple perspectives
- Function: Orchestrate council of relevant agents
- Output: Coordinated multi-agent response
- Integration: Existing council chat functionality

**Tool 5: Memory Retrieval**

- Input: Session ID, user ID, agent ID
- Function: Fetch relevant conversation history
- Output: Context from past interactions
- Storage: Vector store + metadata filters

**2.3 LangChain Agent Router**
Create `lib/langchain-agent-router.ts`:

- Define agent executor with tools
- Implement ReAct pattern for reasoning
- Add conversation memory buffer
- Configure tool selection logic
- Handle multi-step reasoning chains

### Phase 3: RAG-Enhanced Agent Generation

**3.1 Create RAG Pipeline**
Create `lib/rag-agent-generator.ts`:

```typescript
class RAGAgentGenerator {
  // 1. Query Understanding
  async analyzeQuery(userMessage: string, agentId: string)

  // 2. Context Retrieval (LlamaIndex)
  async retrieveRelevantContext(query: string, agentId: string, limit: number)

  // 3. Synergy Enhancement
  async enhanceWithSynergy(context: any[], currentMoment: Date)

  // 4. Memory Integration
  async retrieveConversationMemory(sessionId: string, windowSize: number)

  // 5. Prompt Construction
  async buildEnhancedPrompt(userMessage: string, context: any[], memory: any[], synergy: any)

  // 6. Generation with RAG
  async generateResponse(prompt: string, agentProfile: any)

  // 7. Post-Processing
  async enrichResponse(response: string, metadata: any)
}
```

**3.2 Integration with Existing API**
Modify `/app/api/monica-agent/route.ts`:

- Import RAGAgentGenerator
- Replace direct LLM calls with RAG pipeline
- Maintain backward compatibility
- Add feature flag: `USE_RAG_GENERATION`
- Log RAG metrics to Galileo MCP

**3.3 Streaming Support**

- Implement streaming RAG responses
- Update chat UI for real-time display
- Handle partial context updates
- Maintain conversation state

### Phase 4: Semantic Consciousness Features

**4.1 Agent Similarity Search**
Create `/api/agents/semantic-search` endpoint:

- Input: Concept/query (e.g., "creativity and innovation")
- Process: Vector similarity search across agent embeddings
- Output: Ranked agents by semantic relevance
- UI: New search interface in gallery page

**4.2 Wisdom Domain Navigation**

- Create wisdom domain embeddings
- Enable navigation by abstract concepts
- Visualize agent relationships in concept space
- Interactive knowledge graph

**4.3 Temporal Context Awareness**

- Index conversations with temporal metadata
- Enable queries like "what did Carl Jung say last week?"
- Track consciousness evolution over time
- Historical trend analysis

### Phase 5: Advanced Features

**5.1 Multi-Agent RAG Orchestration**

- Coordinate multiple agents for complex queries
- Merge context from different agent perspectives
- Synthesize coherent multi-viewpoint responses
- Track inter-agent knowledge sharing

**5.2 Adaptive Context Window**

- Dynamically adjust retrieved context based on query complexity
- Optimize token usage vs. relevance
- Implement context compression
- Smart context ranking

**5.3 Consciousness-Aware Embeddings**

- Custom embedding model fine-tuned on agent personalities
- Encode astrological/alchemical concepts
- Synergy-weighted similarity scoring
- Dimensional consciousness vectors

**5.4 Knowledge Graph Integration**

- Build knowledge graph of agent relationships
- Connect concepts across agents
- Enable graph-based reasoning
- Visualize knowledge networks

### Phase 6: Performance & Optimization

**6.1 Caching Strategy**

- Cache frequent queries and embeddings
- Implement Redis-backed vector cache
- TTL-based invalidation
- Cache warming for popular agents

**6.2 Batch Processing**

- Batch embedding generation
- Parallel context retrieval
- Async tool execution
- Queue management for heavy queries

**6.3 Monitoring & Analytics**

- Log RAG pipeline performance to Galileo
- Track retrieval quality metrics
- Monitor context relevance scores
- A/B testing RAG vs. direct generation

## Implementation Files to Create

```
lib/
├── llamaindex/
│   ├── vector-store.ts           # Vector DB initialization
│   ├── document-loader.ts        # Agent knowledge ingestion
│   ├── embeddings-service.ts     # Embedding generation
│   └── semantic-search.ts        # Search functionality
├── langchain/
│   ├── agent-tools.ts            # Tool definitions
│   ├── agent-router.ts           # Agent executor
│   ├── memory-manager.ts         # Conversation memory
│   └── orchestrator.ts           # Multi-agent coordination
├── rag/
│   ├── rag-generator.ts          # Main RAG pipeline
│   ├── context-retriever.ts     # Context retrieval logic
│   ├── prompt-builder.ts        # Enhanced prompt construction
│   └── response-enricher.ts     # Post-processing
└── embeddings/
    ├── consciousness-embeddings.ts # Custom embeddings
    └── synergy-vectors.ts          # Synergy-aware vectors

app/api/
├── agents/
│   ├── semantic-search/route.ts  # Semantic agent search
│   ├── knowledge-query/route.ts  # Knowledge base queries
│   └── rag-chat/route.ts         # RAG-enhanced chat endpoint
└── vector-store/
    ├── ingest/route.ts           # Document ingestion
    ├── query/route.ts            # Vector queries
    └── update/route.ts           # Index updates

components/
├── agents/
│   ├── semantic-search-widget.tsx  # Search UI
│   ├── knowledge-browser.tsx       # Browse knowledge base
│   └── rag-chat-interface.tsx      # Enhanced chat UI
└── visualization/
    └── knowledge-graph.tsx         # Knowledge graph viz
```

## Environment Variables Needed

Add to `.env.local`:

```bash
# Vector Database
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=your_env
PINECONE_INDEX_NAME=planetary-agents

# Or ChromaDB
CHROMADB_URL=http://localhost:8000

# LlamaIndex
LLAMAINDEX_CACHE_DIR=.cache/llamaindex

# LangChain
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_PROJECT=planetary-agents

# Feature Flags
USE_RAG_GENERATION=true
USE_VECTOR_SEARCH=true
ENABLE_MULTI_AGENT_RAG=true
```

## Testing Strategy

**Unit Tests:**

- Test vector store CRUD operations
- Test embedding generation
- Test semantic search accuracy
- Test tool execution
- Test RAG pipeline components

**Integration Tests:**

- Test end-to-end RAG generation
- Test multi-agent orchestration
- Test memory persistence
- Test context retrieval quality

**Performance Tests:**

- Benchmark vector search latency
- Measure RAG vs. direct generation quality
- Test under concurrent load
- Profile memory usage

## Success Metrics

**Quantitative:**

- Response relevance score > 0.85
- Context retrieval latency < 100ms
- End-to-end RAG generation < 2s
- Vector search accuracy > 90%
- Memory hit rate > 70%

**Qualitative:**

- More contextually aware responses
- Better knowledge consistency across sessions
- Improved multi-agent coordination
- Enhanced user satisfaction (from feedback)

## Migration Strategy

**Phase 1: Parallel Operation**

- Run RAG alongside existing system
- Feature flag for gradual rollout
- A/B testing with user segments
- Compare response quality

**Phase 2: Gradual Rollout**

- Enable RAG for 10% of traffic
- Monitor performance and errors
- Collect user feedback
- Iterate based on metrics

**Phase 3: Full Migration**

- Enable RAG for all users
- Deprecate direct generation
- Optimize based on production data
- Document lessons learned

## Documentation Requirements

Create comprehensive docs:

- `LLAMAINDEX_SETUP.md` - Vector store setup guide
- `LANGCHAIN_INTEGRATION.md` - Agent tools documentation
- `RAG_ARCHITECTURE.md` - System design documentation
- `VECTOR_SEARCH_GUIDE.md` - Usage examples
- `KNOWLEDGE_BASE_MAINTENANCE.md` - Index management

## Known Challenges & Solutions

**Challenge 1: Token Limits**

- Solution: Smart context compression, relevance ranking
- Implementation: Sliding window with priority scoring

**Challenge 2: Embedding Costs**

- Solution: Cache embeddings, batch processing
- Implementation: Redis cache + async job queue

**Challenge 3: Context Relevance**

- Solution: Multi-stage retrieval with re-ranking
- Implementation: Coarse search → fine-grained scoring

**Challenge 4: Real-time Synergy**

- Solution: Pre-compute synergy embeddings
- Implementation: Periodic batch updates with TTL cache

**Challenge 5: Multi-Agent Coordination**

- Solution: Hierarchical agent structure with coordinator
- Implementation: Supervisor agent pattern from LangChain

## Integration with Existing Features

**Galileo MCP Logging:**

- Log RAG pipeline stages as structured traces
- Track context retrieval quality
- Monitor embedding generation performance
- Dashboard for RAG metrics

**Moment Synergy:**

- Use synergy scores to weight context retrieval
- Prioritize agents with high cosmic compatibility
- Temporal filtering by astrological moments
- Enhance RAG prompts with synergy context

**Consciousness Evolution:**

- Update agent embeddings as consciousness evolves
- Track knowledge accumulation over time
- Adaptive learning from interactions
- Memory consolidation during evolution

## Next Steps After Implementation

1. Fine-tune custom embeddings on agent personalities
2. Implement graph-based reasoning over knowledge
3. Add voice interface with RAG-powered responses
4. Create mobile app with offline vector search
5. Explore multi-modal RAG (images, charts, symbols)
6. Implement federated learning across user sessions

## Resources & References

**LlamaIndex:**

- Docs: https://docs.llamaindex.ai/
- GitHub: https://github.com/run-llama/llama_index
- Examples: https://docs.llamaindex.ai/en/stable/examples/

**LangChain:**

- Docs: https://python.langchain.com/docs/
- JS/TS: https://js.langchain.com/docs/
- Tools: https://js.langchain.com/docs/modules/agents/tools/

**Vector Databases:**

- Pinecone: https://www.pinecone.io/
- ChromaDB: https://www.trychroma.com/
- Weaviate: https://weaviate.io/

**RAG Patterns:**

- https://github.com/langchain-ai/rag-from-scratch
- https://docs.llamaindex.ai/en/stable/optimizing/production_rag/

---

## IMPORTANT NOTES FOR IMPLEMENTATION

1. **Maintain Backward Compatibility:** Existing chat functionality must continue working during migration
2. **Feature Flags:** Use environment variables to toggle RAG features
3. **Error Handling:** Graceful fallback to direct generation if RAG fails
4. **Performance:** Monitor and optimize latency at each stage
5. **Costs:** Track embedding and vector search costs carefully
6. **Testing:** Comprehensive tests before production deployment
7. **Documentation:** Update all docs with RAG changes
8. **Monitoring:** Galileo MCP logging for full observability

## Expected Timeline

- **Week 1:** LlamaIndex setup + vector store + agent ingestion
- **Week 2:** LangChain tools + agent router + basic RAG
- **Week 3:** Enhanced features + semantic search + optimization
- **Week 4:** Testing + documentation + gradual rollout

Total: ~4 weeks for complete implementation

---

**This prompt provides a complete roadmap for transforming Planetary Agents into a sophisticated RAG-powered system with semantic search, persistent memory, and intelligent multi-agent orchestration using LangChain and LlamaIndex.**
