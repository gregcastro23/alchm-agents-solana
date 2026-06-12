# AI Gateway Quick Start

## 5-Minute Setup

### Step 1: Choose a Provider (Recommended: Cloudflare)

**Cloudflare AI Gateway** - Easiest setup, great for beginners

- Sign up: https://developers.cloudflare.com/workers-ai/
- Free tier: $0.01 per 1M requests
- Dashboard: https://dash.cloudflare.com/

### Step 2: Get Your API Key

1. Sign up for Cloudflare AI Gateway
2. Create a new project
3. Copy your API key
4. Copy the gateway URL: `https://gateway.ai.cloudflare.com/v1`

### Step 3: Configure

Add to your `.env.local` (development) or Render/Vercel dashboard (production):

```bash
AI_GATEWAY_ENABLED=true
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1
AI_GATEWAY_API_KEY=your_cloudflare_api_key_here
```

### Step 4: Restart

Restart your development server:

```bash
yarn dev
```

### Step 5: Check Status

Visit: http://localhost:3000/api/ai-gateway/health

You should see:

```json
{
  "status": {
    "ready": true,
    "recommendation": "✅ AI Gateway is enabled and configured"
  }
}
```

## Expected Results

### Immediate Benefits

- ✅ All AI requests cached intelligently
- ✅ 30-70% reduction in API costs
- ✅ Automatic rate limiting

### After 24 Hours

- Check your Cloudflare dashboard for:
  - **Cache hit rate** (aim for 50-70%)
  - **Cost savings** (should see 30-70% reduction)
  - **Request analytics**

## Troubleshooting

### "Invalid credentials"

- Make sure you're using the **Gateway API key**, not your provider API key
- Gateway key is different from OPENAI_API_KEY and ANTHROPIC_API_KEY

### Not seeing cost savings

- First requests don't hit cache (normal)
- Wait 24 hours for cache to build up
- Check cache hit rate in dashboard (aim for >50%)

### How to disable

Simply set:

```bash
AI_GATEWAY_ENABLED=false
```

## Cost Estimate

For typical usage:

- **Without Gateway:** $300/month
- **With Gateway (50% cache hit):** $150/month
- **Savings:** $150/month = $1,800/year

## Next Steps

📚 Read full documentation: [AI_GATEWAY_SETUP.md](./AI_GATEWAY_SETUP.md)

🌐 Check health: http://localhost:3000/api/ai-gateway/health

📊 Monitor costs: Your gateway provider dashboard

---

**Need help?** Check AI_GATEWAY_SETUP.md or open a GitHub issue.
