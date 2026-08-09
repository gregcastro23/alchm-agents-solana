# 🔑 Simple API Key Test for Production

## The Build Logs Are Fine ✅

Your build succeeded:

```
✅ Build Completed in /vercel/output [3m]
✅ Deployment completed
✅ /api/monica-agent function created
```

**The build is NOT the problem.**

## The Real Issue: Runtime API Keys

The chat breaks AFTER deployment when the function tries to use API keys.

## 🧪 Quick Test - Run This Command

Copy/paste this into your terminal:

```bash
curl https://planetary-agents.vercel.app/api/galileo-config
```

**This will tell us if API keys are available in production.**

### Expected Responses:

**If API keys ARE set in Vercel:**

```json
{
  "quantitiesConfig": {
    "hasApiKey": true,  ← Should be TRUE
    ...
  },
  "agentConfig": {
    "hasApiKey": true,  ← Should be TRUE
    ...
  }
}
```

**If API keys are MISSING in Vercel:**

```json
{
  "quantitiesConfig": {
    "hasApiKey": false,  ← This means NO API KEY!
    ...
  }
}
```

## 🎯 What to Do Based on Result

### If `hasApiKey: false`

**You MUST add API keys to Vercel:**

1. **Vercel Dashboard** → **Your Project** → **Settings**
2. **Environment Variables** (left sidebar)
3. **Add Variable** button
4. Add these:

```
Name: ANTHROPIC_API_KEY
Value: sk-placeholder-key-redacted-for-security
Environments: ✅ Production ✅ Preview ✅ Development

Name: OPENAI_API_KEY
Value: sk-placeholder-key-redacted-for-security
Environments: ✅ Production ✅ Preview ✅ Development
```

5. Click **Save**
6. Vercel will ask to redeploy - click **Redeploy**
7. Wait 2-3 minutes
8. Test chat again - WILL WORK! ✅

### If `hasApiKey: true`

Then the keys exist but might be:

- Invalid/expired
- Wrong format
- Different issue

Share the full galileo-config output and I'll diagnose further.

## ⚡ Most Common Issue (90% of cases)

**API keys NOT added to Vercel environment variables.**

Even though they're in your `.env` files locally, Vercel needs them added separately through the dashboard.

## 📞 Quick Check

**Right now, go to:**

1. https://vercel.com/dashboard
2. Click your project
3. **Settings** (left sidebar)
4. **Environment Variables**
5. Do you see `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`?

**YES** → Click to edit, verify values are filled (not blank)
**NO** → Add them now using the values above

---

**Run that curl command and tell me what `hasApiKey` says!** That will immediately tell us if this is an API key config issue. 🔍
