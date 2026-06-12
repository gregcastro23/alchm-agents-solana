# RAG System Troubleshooting Guide

This guide helps diagnose and resolve common issues with the Retrieval-Augmented Generation (RAG) system.

---

## Current Known Issue: Anthropic Model Access

### Problem

All Claude models return 404 "model not found" errors when attempting text generation.

### Symptoms

```
APICallError: model: claude-3-5-sonnet-20241022
not_found_error
Status Code: 404
Organization ID: ac71abc6-daa2-4aa9-a0a5-acc52a3c1bd6
```

### What's Working ✅

- ✅ **API Authentication:** Key authenticates successfully
- ✅ **Vector Search:** ChromaDB operational on port 8001
- ✅ **Document Retrieval:** Finding documents with 60-65% relevance scores
- ✅ **Semantic Search:** Sub-500ms retrieval latency
- ✅ **RAG UI Components:** All Phase 4 features operational
- ✅ **Analytics Tracking:** Query logging and metrics working

### What's Blocked ❌

- ❌ **Text Generation:** All Claude models unavailable
- ❌ **End-to-end RAG:** Cannot generate responses with retrieved context

### Root Cause

The Anthropic API key (`sk-ant-api03-7tdpI31...`) authenticates successfully but the organization account does not have access to any Claude models. This is a permissions/subscription issue, not a code issue.

### Models Tested (All 404)

- `claude-3-5-sonnet-20241022` ❌
- `claude-3-5-sonnet-20240620` ❌
- `claude-3-5-sonnet-latest` ❌
- `claude-3-sonnet-20240229` ❌

### Solution

**Contact Anthropic Support** to enable Claude model access:

1. Go to https://console.anthropic.com
2. Navigate to Settings → API Keys
3. Verify organization: `ac71abc6-daa2-4aa9-a0a5-acc52a3c1bd6`
4. Contact support to enable model access
5. Specify required models:
   - `claude-3-5-sonnet-20241022` (primary)
   - `claude-3-5-haiku-20241022` (fast responses)

### Workaround (Temporary)

Use OpenAI models for text generation while waiting for Anthropic access:

```typescript
// In lib/rag/rag-generator.ts
import { openai } from '@ai-sdk/openai'

const response = await generateText({
  model: openai('gpt-4o-mini'), // Fallback to OpenAI
  system: enhancedSystemPrompt,
  messages,
  temperature: 0.7,
})
```

### Verification Test

Once model access is enabled, test with:

```bash
npx tsx lib/llamaindex/test-rag-generation.ts
```

Expected output:

```
✅ RAG Response Generated:
   RAG Used: true
   Retrieved Docs: 3
   Response length: 450+ chars
```

---

## Other Common Issues

### Issue: ChromaDB Connection Failed

**Symptoms:**

```
[VectorStore] Failed to connect to ChromaDB
ECONNREFUSED 127.0.0.1:8001
```

**Solution:**

```bash
# Start ChromaDB server
docker-compose up -d chromadb
# Or
python -m chromadb.server --port 8001
```

**Verify:**

```bash
curl http://localhost:8001/api/v1/heartbeat
# Expected: {"nanosecond heartbeat": <number>}
```

---

### Issue: No Documents in Collection

**Symptoms:**

```
[SemanticSearch] Found 0 results
Collection has 0 documents
```

**Solution:**

```bash
# Re-ingest agent biographies
npx tsx lib/llamaindex/ingestion-pipeline.ts
```

**Verify:**

```bash
curl http://localhost:8001/api/v1/collections/historical_agents
# Should show count: 33
```

---

### Issue: Low Relevance Scores

**Symptoms:**

```
[SemanticSearch] Found 3 results (avg score: 0.25)
All results below threshold 0.35
```

**Possible Causes:**

1. Query too vague or general
2. No relevant content in collection
3. Embedding model mismatch

**Solution:**

```typescript
// Lower threshold temporarily
const ragConfig = {
  threshold: 0.25, // Lower from 0.35
  topK: 5,
}
```

**Better Approach:**
Improve query specificity:

- ❌ "Tell me about science"
- ✅ "What was Marie Curie's approach to radioactivity research?"

---

### Issue: RAG Toggle Not Persisting

**Symptoms:**
RAG toggle resets to default on page reload

**Solution:**

```typescript
// Check browser localStorage
localStorage.getItem('rag-enabled') // Should return "true" or "false"

// Clear if corrupted
localStorage.removeItem('rag-enabled')
```

---

### Issue: Analytics Not Updating

**Symptoms:**
Admin dashboard shows 0 queries despite RAG usage

**Possible Causes:**

1. Analytics not being logged
2. LocalStorage quota exceeded
3. Browser privacy settings blocking localStorage

**Solution:**

```typescript
// Manually verify logging
import { ragAnalytics } from '@/lib/rag/rag-analytics'

// Check logs
console.log(ragAnalytics.getRecentLogs(10))

// Clear if corrupted
ragAnalytics.clearLogs()
```

---

### Issue: Source Citations Not Displaying

**Symptoms:**
RAG retrieves sources but SourceCitations component doesn't render

**Checklist:**

1. ✅ Check `ragMetadata.sources` exists
2. ✅ Verify `sources` array is not empty
3. ✅ Ensure component is imported correctly
4. ✅ Check console for React errors

**Debug:**

```typescript
console.log('RAG Metadata:', ragMetadata)
console.log('Sources:', ragMetadata?.sources)
console.log('Sources length:', ragMetadata?.sources?.length)
```

---

### Issue: Performance Degradation

**Symptoms:**
Retrieval time >1000ms, previously <500ms

**Possible Causes:**

1. ChromaDB memory pressure
2. Large query batch
3. Network latency

**Solution:**

```bash
# Restart ChromaDB
docker-compose restart chromadb

# Check ChromaDB logs
docker-compose logs chromadb

# Monitor memory usage
docker stats chromadb
```

**Optimize:**

```typescript
// Reduce topK to limit results
const ragConfig = {
  topK: 3, // Reduce from 5
}
```

---

## Diagnostic Commands

### Check RAG System Health

```bash
# 1. Verify ChromaDB is running
curl http://localhost:8001/api/v1/heartbeat

# 2. Check collection exists
curl http://localhost:8001/api/v1/collections/historical_agents

# 3. Test semantic search
npx tsx lib/llamaindex/test-semantic-search.ts

# 4. Test RAG generation (will fail with current API key issue)
npx tsx lib/llamaindex/test-rag-generation.ts
```

### Check Environment Variables

```bash
# Required for RAG
echo $OPENAI_API_KEY        # For embeddings
echo $ANTHROPIC_API_KEY     # For generation
echo $CHROMADB_URL          # Should be http://localhost:8001

# Optional
echo $CLAUDE_DEFAULT_MODEL  # Default: claude-3-5-sonnet-20241022
```

### Check File Structure

```bash
# RAG components
ls -la components/rag/

# RAG libraries
ls -la lib/rag/

# Test files
ls -la lib/llamaindex/test-*.ts

# Admin dashboard
ls -la app/admin/rag-analytics/
```

---

## Error Codes Reference

| Error Code   | Meaning             | Solution                              |
| ------------ | ------------------- | ------------------------------------- |
| 404          | Model not found     | Contact Anthropic for model access    |
| 401          | Invalid API key     | Check ANTHROPIC_API_KEY in .env.local |
| 429          | Rate limit exceeded | Implement request throttling          |
| 500          | Server error        | Check ChromaDB logs                   |
| ECONNREFUSED | Connection refused  | Start ChromaDB server                 |

---

## Performance Benchmarks

Expected performance metrics:

| Metric          | Target  | Acceptable | Poor    |
| --------------- | ------- | ---------- | ------- |
| Retrieval Time  | <300ms  | <500ms     | >1000ms |
| Generation Time | <2000ms | <3000ms    | >5000ms |
| Relevance Score | >0.6    | >0.4       | <0.3    |
| Success Rate    | >95%    | >85%       | <70%    |

---

## Getting Help

1. **Check this guide** for known issues
2. **Review Phase 4 documentation:** `RAG_PHASE4_COMPLETE.md`
3. **Check admin dashboard:** `/admin/rag-analytics`
4. **Review logs:** Browser console + server logs
5. **GitHub Issues:** Report bugs at project repository

---

## Quick Reference

### Start RAG System

```bash
# 1. Start ChromaDB
docker-compose up -d chromadb

# 2. Verify connection
curl http://localhost:8001/api/v1/heartbeat

# 3. Start dev server
yarn dev

# 4. Test RAG
npx tsx lib/llamaindex/test-semantic-search.ts
```

### Reset RAG System

```bash
# 1. Clear analytics
# Navigate to /admin/rag-analytics
# Click "Clear Logs"

# 2. Re-ingest documents
npx tsx lib/llamaindex/ingestion-pipeline.ts --force

# 3. Restart ChromaDB
docker-compose restart chromadb

# 4. Clear browser cache
# Dev Tools → Application → Clear Storage
```

---

**Last Updated:** November 5, 2025
**RAG Version:** Phase 4 Complete
