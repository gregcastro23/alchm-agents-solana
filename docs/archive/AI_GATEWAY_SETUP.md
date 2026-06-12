# AI Gateway Setup Guide

## Overview

The Planetary Agents platform now supports AI Gateway routing for cost optimization, centralized monitoring, and improved reliability across all AI providers.

## Benefits

✅ **30-70% cost reduction** through intelligent caching  
✅ **Rate limiting and DDoS protection**  
✅ **Centralized monitoring and analytics**  
✅ **Easy cost tracking** per user/session  
✅ **Automatic retries and fallbacks**  
✅ **Multi-provider load balancing**

## Supported Gateway Providers

### 1. Cloudflare AI Gateway (Recommended)

**Setup:**

```bash
AI_GATEWAY_ENABLED=true
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1
AI_GATEWAY_API_KEY=your_cloudflare_key
```

**Features:**

- Automatic caching and cost optimization
- Built-in rate limiting
- Request analytics dashboard
- $0.01 per 1M requests

**Sign up:** https://developers.cloudflare.com/workers-ai/

### 2. Portkey

**Setup:**

```bash
AI_GATEWAY_ENABLED=true
AI_GATEWAY_URL=https://api.portkey.ai/v1
AI_GATEWAY_API_KEY=your_portkey_key
```

**Features:**

- Observability and monitoring
- Load balancing across providers
- Fallback configurations
- A/B testing capabilities

**Sign up:** https://portkey.ai/

### 3. Helicone

**Setup:**

```bash
AI_GATEWAY_ENABLED=true
AI_GATEWAY_URL=https://oai.helicone.ai/v1
AI_GATEWAY_API_KEY=your_helicone_key
```

**Features:**

- Request observability
- Cost tracking and analytics
- Rate limiting
- User tagging

**Sign up:** https://www.helicone.ai/

### 4. Custom Gateway

**Setup:**

```bash
AI_GATEWAY_ENABLED=true
AI_GATEWAY_URL=https://your-gateway.example.com/v1
AI_GATEWAY_API_KEY=your_custom_key
```

## Configuration

### Environment Variables

Add to your `.env.local` or deployment environment:

```bash
# Enable AI Gateway
AI_GATEWAY_ENABLED=true

# Gateway endpoint URL
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1

# Gateway API key (different from provider keys)
AI_GATEWAY_API_KEY=your-gateway-api-key
```

### By Default

AI Gateway is **disabled by default** (`AI_GATEWAY_ENABLED=false`). You can:

1. Use it selectively in development
2. Enable it for production cost optimization
3. Test with different providers

## How It Works

### Architecture

```
┌─────────────────┐
│  Application    │
└────────┬────────┘
         │
    ┌────▼─────┐
    │ AI SDK   │
    │ Router   │
    └────┬─────┘
         │
    ┌────▼──────────┐
    │ AI Gateway    │  ← Caching, monitoring, analytics
    └────┬──────────┘
         │
    ┌────▼────┐
    │  OpenAI │
    │Anthropic│  ← Direct provider APIs
    │ Gateway │
    └─────────┘
```

### Request Flow

1. **Request arrives** at your application
2. **AI Gateway checks** cache for similar requests
3. **If cached:** Returns cached response (30-70% faster, free)
4. **If not cached:** Routes to provider, caches response
5. **Analytics logged** for monitoring and cost tracking

### Models Supported

All current models are supported:

- ✅ GPT-4, GPT-4 Turbo, GPT-4o
- ✅ Claude 3.5 Sonnet, Claude 3.5 Haiku
- ✅ LangChain agents
- ✅ RAG generation pipeline
- ✅ Streaming responses

## Setup Instructions

### Step 1: Choose a Provider

We recommend starting with **Cloudflare AI Gateway** for ease of setup.

### Step 2: Get API Key

1. Sign up for your chosen gateway provider
2. Create a project/workspace
3. Generate an API key
4. Copy the gateway URL (usually `/v1`)

### Step 3: Configure Locally

Create `.env.local`:

```bash
# AI Gateway Configuration
AI_GATEWAY_ENABLED=true
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1
AI_GATEWAY_API_KEY=your_key_here

# Keep your existing API keys (gateway will use them)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Step 4: Configure Production

#### Vercel

Add to Vercel dashboard → Settings → Environment Variables

#### Render

Update `render-frontend.env` and `render-backend.env`:

```bash
AI_GATEWAY_ENABLED=true
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1
AI_GATEWAY_API_KEY=your_key_here
```

### Step 5: Test

Run your application and check logs:

```bash
yarn dev
```

Look for: `[AI Gateway] Routing through gateway: true`

## Monitoring & Analytics

### Cost Tracking

Track costs per:

- User/session
- API endpoint
- Model used
- Cache hit rate

### Performance Metrics

- **Cache hit rate:** % of requests served from cache
- **Average latency:** Response time reduction
- **Cost savings:** Monthly savings compared to direct API

### Dashboard Access

Access your gateway dashboard:

- **Cloudflare:** https://dash.cloudflare.com/
- **Portkey:** https://app.portkey.ai/
- **Helicone:** https://helicone.ai/

## Troubleshooting

### Issue: "Invalid credentials" error

**Solution:** The gateway API key is different from your provider keys. Make sure you're using the gateway key, not the provider key.

### Issue: Requests not going through gateway

**Check:**

1. `AI_GATEWAY_ENABLED=true` is set
2. `AI_GATEWAY_URL` is correct (ends with `/v1`)
3. `AI_GATEWAY_API_KEY` is valid
4. Restart your application after changes

### Issue: Higher latency than direct API

**Solution:** This is normal for first request. Subsequent requests hit cache and are much faster. Check your cache hit rate in the dashboard.

### Issue: Cache not working

**Check:**

1. Gateway provider supports caching for your model
2. Request parameters are consistent (same prompt = cache hit)
3. Cache settings in gateway dashboard

## Cost Analysis

### Example Savings

**Before (Direct API):**

- 1,000 requests/day × 2,000 tokens avg = 2M tokens
- Cost: $20/day = $600/month

**After (With AI Gateway, 50% cache hit):**

- 500 requests hit cache (FREE)
- 500 requests to API = 1M tokens
- Cost: $10/day = $300/month
- **Savings: 50%** ($300/month)

### ROI Calculation

For a platform with:

- **10,000 requests/day**
- **Average: 3,000 tokens/request**
- **50% cacheable requests**

**Monthly savings:** $900  
**Annual savings:** $10,800

## Advanced Configuration

### Per-Endpoint Routing

You can disable gateway for specific endpoints:

```typescript
// In your API route
const useGateway =
  process.env.AI_GATEWAY_ENABLED === 'true' && endpoint !== '/api/sensitive-endpoint'
```

### Custom Cache TTL

Configure in your gateway dashboard:

- **Short-lived cache:** 1 hour (for dynamic content)
- **Long-lived cache:** 24 hours (for static content)

### Fallback Strategy

If gateway fails, the system automatically:

1. Retries the gateway (up to 3 times)
2. Falls back to direct API calls
3. Logs the issue for monitoring

## Best Practices

1. **Enable in Production:** Start with production to maximize savings
2. **Monitor Cache Hit Rate:** Aim for 50-70% cache hit rate
3. **Review Analytics Weekly:** Track costs and optimize
4. **Use Tags:** Tag requests by user/session for better tracking
5. **Set Budget Alerts:** Configure alerts in gateway dashboard

## Migration Checklist

- [ ] Choose a gateway provider
- [ ] Sign up and get API key
- [ ] Configure `.env.local` for development
- [ ] Test locally
- [ ] Configure production environment
- [ ] Deploy and monitor
- [ ] Review analytics after 24 hours
- [ ] Optimize cache settings based on hit rate

## Support

- **Gateway Issues:** Check provider documentation
- **Platform Issues:** Open GitHub issue
- **Cost Questions:** Review provider pricing

## References

- [Cloudflare AI Gateway](https://developers.cloudflare.com/workers-ai/)
- [Portkey Documentation](https://docs.portkey.ai/)
- [Helicone Documentation](https://docs.helicone.ai/)
- [AI SDK Documentation](https://sdk.vercel.ai/)

---

**Last Updated:** 2025-10-29  
**Status:** Production Ready  
**Version:** 1.0.0
