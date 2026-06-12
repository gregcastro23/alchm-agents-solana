# RAG System - Production Deployment Guide

**Complete production deployment instructions for the RAG system**

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations tested locally
- [ ] ChromaDB accessible from deployment environment
- [ ] API keys validated
- [ ] Build succeeds locally: `yarn build`
- [ ] Analytics dashboard functional
- [ ] Cache metrics working

## Production Environment Variables

###Required for Vercel Dashboard

```bash
# Database
DATABASE_URL=postgresql://user:password@prod-host:5432/planetary_agents

# NextAuth
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=https://your-production-domain.com

# AI APIs
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# RAG System
CHROMA_URL=https://your-chromadb-instance.com:8000
USE_RAG_GENERATION=true
USE_VECTOR_SEARCH=true
USE_RAG_CACHE=true
RAG_MAX_CONTEXT_TOKENS=1500
RAG_TOP_K=5
RAG_RELEVANCE_THRESHOLD=0.7
RAG_USE_RERANKING=true
```

### Recommended Optional

```bash
# Redis (Highly recommended)
REDIS_URL=redis://:password@redis-host:6379

# Error Tracking
SENTRY_DSN=https://...@sentry.io/...

# Observability
GALILEO_API_KEY=...
GALILEO_LOG_ENABLED=true
```

## Deployment Steps

### 1. Deploy ChromaDB (Required First)

ChromaDB must be deployed separately before the main app.

#### Option A: Railway

```bash
railway up chromadb/chroma:latest
```

#### Option B: Render

Create web service with:

- Docker image: `chromadb/chroma:latest`
- Port: 8000
- Persistent disk: `/chroma/chroma`

#### Option C: Self-Hosted VPS

```bash
docker run -d \
  --name chromadb \
  --restart always \
  -p 8000:8000 \
  -v /data/chroma:/chroma/chroma \
  chromadb/chroma:latest
```

Get the ChromaDB URL and set `CHROMA_URL` environment variable.

### 2. Deploy Main Application to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### 3. Configure Environment Variables in Vercel

In Vercel Dashboard → Project Settings → Environment Variables, add all required variables.

**Critical:** Use production values, not development values!

### 4. Run Database Migration

```bash
# Pull production environment
vercel env pull .env.production

# Run migrations
npx prisma migrate deploy

# Verify
npx prisma db pull
```

### 5. Ingest Data to Production ChromaDB

```bash
# Set production credentials
export OPENAI_API_KEY="sk-..."
export CHROMA_URL="https://your-production-chromadb.com:8000"

# Run ingestion pipeline
npx tsx lib/llamaindex/ingestion-pipeline.ts

# Verify collection exists
curl ${CHROMA_URL}/api/v1/collections
# Should return: {"collections": [{"name": "historical-agents", ...}]}
```

### 6. Verify Deployment

```bash
# Health check
curl https://your-domain.com/api/health

# RAG endpoints
curl https://your-domain.com/api/rag/analytics
curl https://your-domain.com/api/rag/cache
curl https://your-domain.com/api/rag/feedback

# Admin dashboard
open https://your-domain.com/admin/rag-analytics
```

## Performance Targets

| Metric             | Target | Alert Threshold |
| ------------------ | ------ | --------------- |
| Cache hit rate     | 30-50% | <20%            |
| Cached response    | <50ms  | >100ms          |
| Uncached response  | <500ms | >1000ms         |
| Retrieval accuracy | 60-65% | <50%            |
| Error rate         | <1%    | >5%             |
| Uptime             | 99.9%  | <99%            |

## Monitoring Setup

### Health Check Endpoints

```bash
# Application
https://your-domain.com/api/health

# ChromaDB
${CHROMA_URL}/api/v1/heartbeat

# RAG Analytics
https://your-domain.com/api/rag/analytics
```

### Configure Alerts

Set up monitoring for:

- Cache hit rate drops below 20%
- Response time exceeds 1000ms
- Error rate exceeds 5%
- ChromaDB connection failures

### Analytics Dashboard

Access: `https://your-domain.com/admin/rag-analytics`

Monitor daily:

- Query volume trends
- Cache performance
- Relevance scores
- Top performing agents

## Security Checklist

- [ ] NEXTAUTH_SECRET is production-specific
- [ ] API keys not committed to git
- [ ] Database SSL enabled
- [ ] ChromaDB authentication enabled
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Logs filtered for sensitive data

## Backup Strategy

### Database Backups

```bash
# Daily automated via hosting provider
# Or manual:
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### ChromaDB Backups

```bash
# If using Docker:
docker exec chromadb tar czf /tmp/chroma-backup.tar.gz /chroma/chroma
docker cp chromadb:/tmp/chroma-backup.tar.gz ./backups/

# If using managed service, use provider's backup tools
```

## Troubleshooting

### Issue: 404 Model Not Found

**Solution:** Use older Claude models:

```bash
CLAUDE_DEFAULT_MODEL=claude-3-sonnet-20240229
```

### Issue: ChromaDB Connection Failed

**Solutions:**

1. Verify ChromaDB is running: `curl ${CHROMA_URL}/api/v1/heartbeat`
2. Check firewall rules allow traffic on port 8000
3. Verify CHROMA_URL includes protocol: `https://` not `http://`

### Issue: No Search Results

**Solutions:**

1. Verify data ingestion: `curl ${CHROMA_URL}/api/v1/collections`
2. Lower threshold: `RAG_RELEVANCE_THRESHOLD=0.5`
3. Re-run ingestion with `--force` flag

## Post-Deployment Tasks

### Week 1

- [ ] Monitor error rates daily
- [ ] Check cache hit rates
- [ ] Review first user feedback
- [ ] Tune relevance threshold

### Month 1

- [ ] Analyze query patterns
- [ ] Optimize slow queries
- [ ] Update agent knowledge
- [ ] Review backup integrity

### Quarterly

- [ ] Security audit
- [ ] Performance review
- [ ] Dependency updates
- [ ] Disaster recovery test

## Support Resources

- Setup: [RAG_SETUP_CHECKLIST.md](./RAG_SETUP_CHECKLIST.md)
- Testing: [RAG_TESTING_GUIDE.md](./RAG_TESTING_GUIDE.md)
- Implementation: [RAG_IMPLEMENTATION_SUMMARY.md](./RAG_IMPLEMENTATION_SUMMARY.md)
- Status: [RAG_FINAL_STATUS.md](./RAG_FINAL_STATUS.md)

---

**Deployment Complete!** 🚀

Monitor your production instance: `https://your-domain.com/admin/rag-analytics`
