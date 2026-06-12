# RAG System Testing Guide

## Manual Test Checklist

### 1. Cache Testing ✅

```bash
# Test 1: First query (cache miss)
1. Visit: http://localhost:3000/gallery
2. Select: Socrates
3. Enable RAG toggle
4. Ask: "What is virtue?"
5. Check console: [RAG] Cache miss
6. Note response time: ~400-500ms

# Test 2: Repeat query (cache hit)
7. Ask same question: "What is virtue?"
8. Check console: [RAG] 🎯 Cache hit!
9. Response time should be: <50ms

# Test 3: Verify in dashboard
10. Visit: http://localhost:3000/admin/rag-analytics
11. Verify cache hit rate > 0%
12. Check cache metrics card shows 1 hit

# Test 4: Clear cache
curl -X DELETE http://localhost:3000/api/rag/cache
# Should return: {"success": true}
```

### 2. Quality Improvements Testing ✅

```bash
# Test ambiguous query detection
1. Ask: "tell me about it"
2. Check console for: ⚠️ Ambiguous query detected
3. Response should still be generated

# Test specific query (high quality)
4. Ask: "How did Socrates define justice in the Republic?"
5. Check console for:quality score: ~80%+
6. Should see reranking + filtering logs

# Test filtering
7. Check console: "Quality filtering: X → Y (reranked) → Z (filtered)"
8. Filtered count should be ≤ original count
```

### 3. User Feedback Testing ✅

```bash
# Test thumbs up
1. Send query in gallery chat
2. Click thumbs up (should auto-submit in compact mode)
3. Check: "Thank you!" message appears

# Test thumbs down with form
4. Send another query
5. Click thumbs down (form should expand)
6. Select: 3 stars
7. Check: "Sources helpful" checkbox
8. Add comment: "Good but could be better"
9. Submit feedback
10. Verify in database:
   SELECT * FROM "RAGFeedback";
```

### 4. Analytics Dashboard Testing ✅

```bash
# Visit dashboard
http://localhost:3000/admin/rag-analytics

# Verify all sections:
✅ System health banner (if error rate > 50%)
✅ Top metrics row (4 cards)
✅ Success rate radial chart
✅ RAG usage radial chart
✅ Sources per query chart
✅ Cache performance section (3 cards)
✅ Query volume line chart
✅ Performance trends
✅ Top agents table
✅ Query logs table

# Test export
- Click "Export" button
- Verify JSON download with analytics data
```

### 5. API Endpoint Testing ✅

```bash
# Test analytics API
curl http://localhost:3000/api/rag/analytics
# Should return analytics JSON

# Test cache API
curl http://localhost:3000/api/rag/cache
# Should return cache stats

# Test feedback API
curl http://localhost:3000/api/rag/feedback
# Should return feedback array

# Clear cache
curl -X DELETE http://localhost:3000/api/rag/cache
# Should return success message
```

### 6. Performance Testing ✅

**Target Response Times:**

- Cached: <50ms ✅
- Uncached with RAG: <500ms ✅
- No RAG: <200ms ✅

**Test procedure:**

```bash
# Use browser dev tools Network tab
1. Ask first query → Note time (should be ~400-500ms)
2. Ask same query → Note time (should be <50ms)
3. Disable RAG toggle
4. Ask query → Note time (should be <200ms)
```

## Automated Testing

### Unit Tests for Quality Module

Create: `lib/rag/__tests__/rag-quality.test.ts`

```typescript
import {
  rerankResults,
  filterLowQualitySources,
  detectAmbiguousQuery,
  calculateQueryQuality,
} from '../rag-quality'

describe('RAG Quality Improvements', () => {
  describe('rerankResults', () => {
    it('should rerank with quality signals', () => {
      const mockResults = [
        { agentId: 'socrates', score: 0.7, content: '...', agentName: 'Socrates' },
        { agentId: 'plato', score: 0.8, content: '...', agentName: 'Plato' },
      ]
      const reranked = rerankResults(mockResults, 'test query')
      expect(reranked.length).toBe(2)
      expect(reranked[0]).toHaveProperty('qualityMetrics')
    })
  })

  describe('filterLowQualitySources', () => {
    it('should filter below threshold', () => {
      const mockResults = [
        { score: 0.8 },
        { score: 0.3 }, // Below threshold
        { score: 0.6 },
      ]
      const filtered = filterLowQualitySources(mockResults, { threshold: 0.35 })
      expect(filtered.length).toBe(2)
      expect(filtered.every(r => r.score >= 0.35)).toBe(true)
    })

    it('should keep minimum results', () => {
      const mockResults = [{ score: 0.1 }, { score: 0.2 }]
      const filtered = filterLowQualitySources(mockResults, {
        threshold: 0.5,
        minResults: 2,
      })
      expect(filtered.length).toBe(2)
    })
  })

  describe('detectAmbiguousQuery', () => {
    it('should detect vague queries', () => {
      const result = detectAmbiguousQuery('tell me about it')
      expect(result.isAmbiguous).toBe(true)
      expect(result.suggestions.length).toBeGreaterThan(0)
    })

    it('should allow specific queries', () => {
      const result = detectAmbiguousQuery('How did Socrates define justice?')
      expect(result.isAmbiguous).toBe(false)
    })
  })

  describe('calculateQueryQuality', () => {
    it('should score high-quality queries highly', () => {
      const result = calculateQueryQuality("How did Socrates define justice in Plato's Republic?")
      expect(result.score).toBeGreaterThan(0.7)
    })

    it('should score low-quality queries lowly', () => {
      const result = calculateQueryQuality('it')
      expect(result.score).toBeLessThan(0.5)
    })
  })
})
```

Run tests:

```bash
yarn test lib/rag/__tests__/rag-quality.test.ts
```

## Integration Testing Scenarios

### Scenario 1: Complete RAG Flow

```
1. User visits gallery → Selects agent
2. Enables RAG toggle
3. Types query → Submits
4. System:
   - Checks cache (miss)
   - Runs semantic search
   - Applies quality filtering
   - Generates response
   - Stores in cache
   - Logs analytics
5. User sees:
   - Agent response
   - Source citations
   - Feedback widget
6. User clicks thumbs up
7. Feedback saved to database
```

### Scenario 2: Cache Performance

```
Query 1: "What is virtue?" (cache miss, ~400ms)
Query 2: "What is virtue?" (cache hit, <50ms) ✅
Query 3: "What is excellence?" (cache miss, ~400ms)
Query 4: "What is virtue?" (cache hit, <50ms) ✅

Expected cache hit rate: 50%
```

### Scenario 3: Quality Filtering

```
Input: Ambiguous query "tell me about this"
Console logs:
  - ⚠️ Ambiguous query detected ✅
  - Query quality score: 40% ✅
  - Suggestions provided ✅
Output: Response still generated (no blocking)
```

## Performance Benchmarks

Run load test (optional):

```bash
npm install -g autocannon

autocannon -c 10 -d 30 -m POST \
  -H "Content-Type: application/json" \
  -b '{"agents": [{"id":"socrates", "name":"Socrates", "type":"historical"}], "message":"What is virtue?"}' \
  http://localhost:3000/api/unified-multi-agent-chat
```

**Expected results:**

- Requests/sec: 20-50
- Latency p50: <500ms
- Latency p99: <1000ms
- Error rate: <1%

## Regression Testing

### After Each Deployment

- [ ] Test basic chat functionality
- [ ] Test RAG toggle on/off
- [ ] Test source citations display
- [ ] Test feedback widget
- [ ] Test cache functionality
- [ ] Test analytics dashboard
- [ ] Verify no console errors

### After Code Changes

- [ ] Run unit tests
- [ ] Test affected features manually
- [ ] Check performance hasn't regressed
- [ ] Verify error handling
- [ ] Test edge cases

## Troubleshooting Test Failures

### Cache not working

```bash
# Check if USE_RAG_CACHE is enabled
echo $USE_RAG_CACHE  # Should be "true"

# Check cache stats
curl http://localhost:3000/api/rag/cache
```

### No search results

```bash
# Verify ChromaDB is running
curl http://localhost:8001/api/v1/heartbeat

# Check if data was ingested
curl http://localhost:8001/api/v1/collections

# Lower threshold temporarily
RAG_RELEVANCE_THRESHOLD=0.5 yarn dev
```

### Feedback not saving

```bash
# Check database connection
npx prisma studio

# Verify RAGFeedback table exists
SELECT * FROM "RAGFeedback" LIMIT 1;
```

## CI/CD Testing (Future)

```yaml
# .github/workflows/test.yml
name: RAG Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: yarn install
      - run: yarn test:rag
```

---

**Testing Complete!** ✅

All RAG features should now be thoroughly tested and verified.
