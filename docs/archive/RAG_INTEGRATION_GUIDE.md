# LangChain & LlamaIndex RAG Integration Guide

## Overview

This guide covers the complete Retrieval-Augmented Generation (RAG) system integrated into Planetary Agents using LangChain and LlamaIndex.

## Architecture

### Components

1. **LlamaIndex Vector Store** (`lib/llamaindex/`)
   - ChromaDB-based vector storage
   - OpenAI embeddings (text-embedding-3-small)
   - Semantic search capabilities
   - Agent knowledge ingestion

2. **LangChain Agent Tools** (`lib/langchain/`)
   - 5 specialized tools for agent orchestration
   - ReAct pattern implementation
   - Conversation memory management
   - Multi-agent coordination

3. **RAG Pipeline** (`lib/rag/`)
   - 7-stage generation process
   - Context retrieval
   - Memory integration
   - Synergy enhancement

## Installation

Dependencies are already installed:

```json
{
  "llamaindex": "^0.12.0",
  "@llamaindex/core": "^0.6.22",
  "@llamaindex/openai": "^0.4.20",
  "@llamaindex/env": "^0.1.30",
  "langchain": "^1.0.1",
  "@langchain/openai": "^1.0.0",
  "@langchain/core": "^1.0.1",
  "@langchain/anthropic": "^1.0.0",
  "@langchain/community": "^1.0.0",
  "chromadb": "^3.0.17"
}
```

## Setup

### 1. Start ChromaDB

```bash
# Option 1: Docker
docker run -p 8000:8000 chromadb/chroma

# Option 2: Python
pip install chromadb
chroma run --host localhost --port 8000
```

### 2. Configure Environment

Add to `.env.local`:

```bash
# Vector Database
CHROMADB_URL=http://localhost:8000

# LangChain (optional for tracing)
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=

# LlamaIndex
LLAMAINDEX_CACHE_DIR=.cache/llamaindex

# Feature Flags
USE_RAG_GENERATION=true
USE_VECTOR_SEARCH=true
ENABLE_MULTI_AGENT_RAG=true
RAG_MAX_KNOWLEDGE_CHUNKS=3
RAG_MIN_SIMILARITY=0.6
```

### 3. Ingest Agent Knowledge

**Option 1: Static Knowledge (Historical Agents)**

```bash
# Using the API endpoint
curl -X POST http://localhost:3000/api/vector-store/ingest \
  -H "Content-Type: application/json" \
  -d '{"action": "ingest"}'

# Or using the CLI script
npx tsx lib/llamaindex/ingestion-pipeline.ts
```

Expected output:

```
Planetary Agents - Vector Store Ingestion
============================================================
[Ingestion] Starting agent knowledge ingestion...
[Ingestion] Vector store initialized
[Ingestion] Loaded 155 documents from 31 agents
[Ingestion] Processed 155/155 documents
[Ingestion] Completed!
  - Total Documents: 155
  - Successful: 155
  - Failed: 0
  - Duration: 45000ms
```

**Option 2: Dynamic Knowledge Updates ✨ NEW (January 2025)**

Update agent knowledge from external web sources:

```bash
# Ingest from web URLs
curl -X POST http://localhost:3000/api/knowledge-updater \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "plato",
    "type": "web",
    "urls": ["https://plato.stanford.edu/entries/plato/"]
  }'

# Ingest from PDF files
curl -X POST http://localhost:3000/api/knowledge-updater \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "carl-jung",
    "type": "pdf",
    "filePath": "/uploads/collective-unconscious.pdf"
  }'
```

**See:** [LANGCHAIN_USAGE_GUIDE.md](./LANGCHAIN_USAGE_GUIDE.md) for complete documentation

## Usage

### 1. Semantic Agent Search

Find agents by concept or topic:

```typescript
import { searchAgentsByConcept } from '@/lib/llamaindex/semantic-search'

const results = await searchAgentsByConcept('creativity and innovation', {
  topK: 3,
  minRelevance: 0.6,
})

// Results:
// [
//   {
//     agent: { id: 'leonardo-da-vinci', name: 'Leonardo da Vinci', ... },
//     relevanceScore: 0.89,
//     wisdomAlignment: ['Art', 'Science', 'Innovation']
//   },
//   ...
// ]
```

**API Endpoint:**

```bash
curl -X POST http://localhost:3000/api/agents/semantic-search \
  -H "Content-Type: application/json" \
  -d '{"concept": "wisdom and philosophy", "topK": 5}'
```

### 2. Knowledge Retrieval for RAG

Retrieve relevant knowledge chunks:

```typescript
import { getRelevantKnowledgeForRAG } from '@/lib/llamaindex/semantic-search'

const knowledge = await getRelevantKnowledgeForRAG(
  'How do I cultivate creativity?',
  'leonardo-da-vinci',
  { maxChunks: 3 }
)

// Returns:
// [
//   "Leonardo da Vinci's Abilities\nSpecialty: Renaissance Innovation...",
//   "Leonardo's Personality\nCore Essence: Universal curiosity...",
//   ...
// ]
```

### 3. RAG-Enhanced Generation

Generate responses with retrieved context:

```typescript
import { generateRAGResponse } from '@/lib/rag/rag-generator'
import { LEONARDO_DA_VINCI } from '@/lib/agents/historical'

const response = await generateRAGResponse({
  agentId: 'leonardo-da-vinci',
  agent: LEONARDO_DA_VINCI,
  userMessage: 'How can I combine art and science?',
  sessionId: 'user-123',
  includeMemory: true,
  maxKnowledgeChunks: 3,
  model: 'openai',
  temperature: 0.7,
})

console.log(response.response)
// "As one who has walked the bridge between art and science..."

console.log(response.metadata)
// {
//   knowledgeChunksUsed: 3,
//   memoryMessagesUsed: 5,
//   generationTime: 1250
// }
```

### 4. LangChain Agent Tools

Use the agent orchestrator:

```typescript
import { executeAgentQuery } from '@/lib/langchain/agent-router'

const result = await executeAgentQuery(
  'Find me 3 agents who can help with understanding consciousness'
)

console.log(result.output)
// "Based on the semantic search, I found three excellent agents..."

console.log(result.toolCalls)
// ['semantic_agent_search', 'consciousness_analysis']
```

### 5. Vector Store Queries

Direct vector store access:

```bash
# Query vector store
curl -X POST http://localhost:3000/api/vector-store/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "alchemical transformation",
    "topK": 5,
    "minSimilarity": 0.6,
    "filterByElement": "Fire"
  }'
```

## LangChain Tools

### 1. Semantic Agent Search Tool

- **Name:** `semantic_agent_search`
- **Purpose:** Find agents by concept/topic
- **Input:** `{ concept: string, topK?: number }`

### 2. Knowledge Retrieval Tool

- **Name:** `knowledge_retrieval`
- **Purpose:** Retrieve knowledge chunks for RAG
- **Input:** `{ query: string, agentId?: string, maxChunks?: number }`

### 3. Consciousness Analysis Tool

- **Name:** `consciousness_analysis`
- **Purpose:** Analyze agent consciousness and synergy
- **Input:** `{ agentId: string, analysisType?: 'synergy' | 'compatibility' | 'consciousness_metrics' }`

### 4. Multi-Agent Coordinator Tool

- **Name:** `multi_agent_coordinator`
- **Purpose:** Assemble agent councils for complex queries
- **Input:** `{ query: string, numAgents?: number, wisdomDomain?: string }`

### 5. Memory Retrieval Tool

- **Name:** `memory_retrieval`
- **Purpose:** Access conversation history
- **Input:** `{ agentId: string, query?: string, limit?: number }`

## RAG Pipeline Stages

### Stage 1: Query Analysis

- Intent detection
- Topic extraction
- Query understanding

### Stage 2: Context Retrieval

- Semantic search through vector store
- Metadata filtering
- Relevance ranking

### Stage 3: Synergy Enhancement

- Cosmic moment alignment (optional)
- Astrological compatibility
- Elemental synergy

### Stage 4: Memory Integration

- Conversation history retrieval
- Context window management
- Temporal awareness

### Stage 5: Prompt Construction

- Agent personality integration
- Knowledge contextualization
- Memory incorporation

### Stage 6: Generation

- LLM invocation (OpenAI or Anthropic)
- Temperature control
- Token management

### Stage 7: Response Enrichment

- Post-processing
- Citation addition
- Format optimization

## Performance Optimization

### Caching

- Embedding cache in `EmbeddingsService`
- Vector query caching (2-min TTL recommended)
- Memory buffer caching

### Batch Processing

```typescript
import { generateBatchEmbeddings } from '@/lib/llamaindex/embeddings-service'

const texts = [
  /* array of texts */
]
const embeddings = await generateBatchEmbeddings(texts, 20) // batch size 20
```

### Vector Store Statistics

```typescript
import { vectorStoreManager } from '@/lib/llamaindex/vector-store'

const stats = await vectorStoreManager.getStats()
console.log(stats)
// { documentCount: 155, collectionName: 'planetary-agents' }
```

## Maintenance

### Reindex Single Agent

```bash
curl -X POST http://localhost:3000/api/vector-store/ingest \
  -H "Content-Type: application/json" \
  -d '{"action": "reindex", "agentId": "leonardo-da-vinci"}'
```

### Rebuild Entire Index

```bash
curl -X POST http://localhost:3000/api/vector-store/ingest \
  -H "Content-Type: application/json" \
  -d '{"action": "rebuild"}'
```

### Clear Memory

```typescript
import { getMemoryManager } from '@/lib/langchain/memory-manager'

const manager = getMemoryManager()
await manager.clearMemory('session-123', 'leonardo-da-vinci')
```

## Monitoring

### Galileo Integration

All RAG operations log to Galileo MCP for observability:

- Context retrieval quality
- Embedding generation performance
- Response generation latency
- Tool execution traces

### Metrics to Track

- Response relevance score (target: >0.85)
- Context retrieval latency (target: <100ms)
- End-to-end generation time (target: <2s)
- Vector search accuracy (target: >90%)
- Memory hit rate (target: >70%)

## Troubleshooting

### ChromaDB Connection Error

```
Error: Vector store not initialized
```

**Solution:** Ensure ChromaDB is running on port 8000

```bash
docker run -p 8000:8000 chromadb/chroma
```

### No Search Results

```
No agents found for concept: creativity
```

**Solution:** Verify index is populated

```bash
curl http://localhost:3000/api/vector-store/ingest -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "ingest"}'
```

### Memory Errors

```
Agent router not initialized
```

**Solution:** Initialize router before use

```typescript
import { getAgentRouter } from '@/lib/langchain/agent-router'

const router = await getAgentRouter()
// Router is now initialized
```

## Advanced Features

### Custom Embeddings

```typescript
import { EmbeddingsService } from '@/lib/llamaindex/embeddings-service'

const service = new EmbeddingsService({
  model: 'text-embedding-3-large',
  dimensions: 3072,
})

const embedding = await service.generateEmbedding('custom text')
```

### Streaming RAG

```typescript
import { getRAGGenerator } from '@/lib/rag/rag-generator'

const generator = getRAGGenerator()
await generator.generateStream(options, token => {
  console.log(token) // Stream tokens as they arrive
})
```

### Multi-Agent Orchestration

```typescript
import { multiAgentCoordinatorTool } from '@/lib/langchain/agent-tools'

const result = await multiAgentCoordinatorTool.invoke({
  query: 'How do we understand the nature of reality?',
  numAgents: 5,
  wisdomDomain: 'Philosophy',
})
```

## Next Steps

1. **Integration with Monica Agent API** - Add RAG to existing chat endpoints
2. **Fine-tune Embeddings** - Custom embeddings for astrological concepts
3. **Knowledge Graph** - Build agent relationship graphs
4. **Voice Interface** - RAG-powered voice responses
5. **Mobile Optimization** - Offline vector search

## Resources

- [LlamaIndex Docs](https://docs.llamaindex.ai/)
- [LangChain JS Docs](https://js.langchain.com/docs/)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)

## Support

For issues or questions:

1. Check troubleshooting section
2. Review Galileo MCP logs
3. Open GitHub issue with reproduction steps
