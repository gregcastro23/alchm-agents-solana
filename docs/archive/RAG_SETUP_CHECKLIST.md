# RAG System Setup Checklist

**Complete guide for setting up the Retrieval-Augmented Generation system**

## Prerequisites

- [x] Node.js 20+ installed
- [x] PostgreSQL database provisioned
- [x] ChromaDB running on port 8001
- [x] Anthropic API key with model access

## Environment Setup

### 1. Copy Environment Template

```bash
cp .env.example .env.local
```

### 2. Configure Required Variables

Edit `.env.local` and set:

#### Critical (Must Have)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/planetary_agents

# Auth
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000

# AI APIs
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# RAG System
CHROMA_URL=http://localhost:8001
USE_RAG_GENERATION=true
USE_VECTOR_SEARCH=true
USE_RAG_CACHE=true
```

#### Optional (Recommended)

```bash
# Redis for production caching
REDIS_URL=redis://localhost:6379

# Analytics
GALILEO_API_KEY=...
```

## Database Migration

```bash
# Install dependencies
yarn install

# Run Prisma migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

## ChromaDB Setup

### Option 1: Docker (Recommended)

```bash
docker run -d \
  --name chromadb \
  -p 8001:8000 \
  -v $(pwd)/chroma_data:/chroma/chroma \
  chromadb/chroma:latest
```

### Option 2: Python Installation

```bash
pip install chromadb
chroma run --path ./chroma_data
```

### Verify ChromaDB

```bash
curl http://localhost:8001/api/v1/heartbeat
# Should return: {"nanosecond heartbeat": ...}
```

## RAG Data Ingestion

### Ingest Historical Agent Data

```bash
# Run ingestion pipeline (requires OPENAI_API_KEY and CHROMA_URL)
OPENAI_API_KEY="sk-..." \
CHROMA_URL=http://localhost:8001 \
npx tsx lib/llamaindex/ingestion-pipeline.ts

# Expected output:
# ✅ Processed 35 agents
# ✅ Created 500+ document chunks
# ✅ Generated embeddings
# ✅ Stored in ChromaDB collection: historical-agents
```

### Verify Ingestion

```bash
# Test semantic search
OPENAI_API_KEY="sk-..." \
CHROMA_URL=http://localhost:8001 \
npx tsx lib/llamaindex/test-semantic-search.ts

# Should return relevant results for test queries
```

## Start Development Server

```bash
yarn dev
```

## Verify RAG System

### 1. Check API Endpoints

```bash
# RAG Analytics
curl http://localhost:3000/api/rag/analytics
# Should return: {"success": true, "analytics": {...}}

# RAG Cache
curl http://localhost:3000/api/rag/cache
# Should return: {"success": true, "stats": {...}}

# RAG Feedback
curl http://localhost:3000/api/rag/feedback
# Should return: {"success": true, "feedback": [], "totalCount": 0}
```

### 2. Visit Admin Dashboard

Open in browser:

```
http://localhost:3000/admin/rag-analytics
```

Should see:

- ✅ System health monitor
- ✅ 9 interactive charts
- ✅ Query logs table
- ✅ Cache metrics (if queries have been made)

### 3. Test RAG in Chat

1. Go to: `http://localhost:3000/gallery`
2. Select any agent (e.g., Socrates)
3. Enable RAG toggle (top right)
4. Ask: "What is virtue?"
5. Verify:
   - ✅ Response includes source citations
   - ✅ Source relevance scores shown
   - ✅ Feedback widget appears below sources
   - ✅ Console shows RAG pipeline logs

### 4. Test Caching

1. Ask the same question again: "What is virtue?"
2. Check console for:
   - ✅ `[RAG] 🎯 Cache hit! Returning cached result (Xms)`
   - ✅ Response time <50ms (vs ~400ms uncached)
3. Visit admin dashboard:
   - ✅ Cache hit rate should be >0%

## Known Issues & Solutions

### Issue 1: Anthropic Model Access (404 Error)

**Symptom:**

```
Error: 404 - model_not_found
The model 'claude-3-5-sonnet-latest' is not available
```

**Cause:** Organization lacks model access permissions

**Solution:**

1. Contact Anthropic support: support@anthropic.com
2. Provide Organization ID: `ac71abc6-daa2-4aa9-a0a5-acc52a3c1bd6`
3. Request access to: `claude-3-sonnet-20240229`, `claude-3-opus-20240229`

**Workaround:**
Use older model IDs in `.env.local`:

```bash
CLAUDE_DEFAULT_MODEL=claude-3-sonnet-20240229
CLAUDE_FAST_MODEL=claude-3-haiku-20240307
```

**Status:**

- ✅ Vector search: Working perfectly (60-65% relevance)
- ✅ Document retrieval: Operational
- ❌ Text generation: Blocked by API access

### Issue 2: ChromaDB Connection Failed

**Symptom:**

```
Error: connect ECONNREFUSED 127.0.0.1:8001
```

**Solutions:**

1. Verify ChromaDB is running:

   ```bash
   curl http://localhost:8001/api/v1/heartbeat
   ```

2. Check Docker container status:

   ```bash
   docker ps | grep chromadb
   ```

3. Restart ChromaDB:
   ```bash
   docker restart chromadb
   ```

### Issue 3: No Search Results

**Symptom:**

```
[RAG] No relevant documents found
```

**Solutions:**

1. Verify data ingestion completed:

   ```bash
   curl http://localhost:8001/api/v1/collections
   # Should show "historical-agents" collection
   ```

2. Re-run ingestion:

   ```bash
   npx tsx lib/llamaindex/ingestion-pipeline.ts --force
   ```

3. Lower relevance threshold in `.env.local`:
   ```bash
   RAG_RELEVANCE_THRESHOLD=0.5  # Default: 0.7
   ```

### Issue 4: Slow Response Times

**Solutions:**

1. Enable caching (should be default):

   ```bash
   USE_RAG_CACHE=true
   ```

2. Reduce context size:

   ```bash
   RAG_MAX_CONTEXT_TOKENS=1000  # Default: 1500
   ```

3. Limit top-K results:

   ```bash
   RAG_TOP_K=3  # Default: 5
   ```

4. Add Redis for production:
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

## Performance Benchmarks

After setup, you should see:

| Metric             | Expected Value        |
| ------------------ | --------------------- |
| Cache hit rate     | 30-50% (after warmup) |
| Cached response    | <50ms                 |
| Uncached response  | <500ms                |
| Retrieval accuracy | 60-65%                |
| Database write     | <100ms                |

## Troubleshooting Commands

```bash
# Check environment variables
env | grep -E "(CHROMA|RAG|ANTHROPIC|OPENAI)"

# Test database connection
npx prisma db pull

# View Prisma schema
npx prisma studio

# Clear RAG cache
curl -X DELETE http://localhost:3000/api/rag/cache

# Export analytics
curl http://localhost:3000/api/rag/analytics > analytics-export.json

# Check ChromaDB collections
curl http://localhost:8001/api/v1/collections

# View server logs
yarn dev | grep -i rag
```

## Next Steps

After successful setup:

1. ✅ Test RAG with various queries
2. ✅ Monitor analytics dashboard
3. ✅ Collect user feedback
4. ✅ Tune relevance threshold based on feedback
5. ✅ Add custom documents to ChromaDB
6. ✅ Deploy to production

## Production Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for production deployment instructions.

## Support

- **Documentation:** [RAG_IMPLEMENTATION_SUMMARY.md](./RAG_IMPLEMENTATION_SUMMARY.md)
- **Issues:** Check [RAG_TROUBLESHOOTING.md](./RAG_TROUBLESHOOTING.md)
- **Testing:** See [RAG_TESTING_GUIDE.md](./RAG_TESTING_GUIDE.md)

---

**Setup Complete!** 🎉

Your RAG system should now be operational. Visit `/admin/rag-analytics` to monitor performance.
