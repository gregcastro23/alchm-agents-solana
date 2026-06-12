# 🚀 Vercel Deployment Checklist

**Latest Commit**: `d26e7ad2`  
**Purpose**: Fix production chat errors and mobile navigation

## ⚠️ Current Issue

Production site (https://planetary-agents.vercel.app/) is showing:

- ❌ 500 Internal Server Error on API endpoints
- ❌ Chat not working ("error channeling consciousness")
- ❌ Old version deployed (no Philosopher's Stone, no mobile menu)

## 🔧 Root Cause

Previous build **FAILED** due to autoprefixer issue:

```
Error: Cannot find module 'autoprefixer'
```

## ✅ Fixes Applied (Commit d26e7ad2)

1. **Removed autoprefixer** from postcss.config.mjs (Next.js handles it)
2. **Added mobile navigation** with hamburger menu
3. **Fixed viewport** configuration
4. **Fixed N/A synergy** scores
5. **Fixed Isaac Asimov** name (removed year)

## 📋 Vercel Dashboard Checklist

### Step 1: Monitor the Deployment

1. Go to: **https://vercel.com/dashboard**
2. Find your project: **planetary-agents**
3. Click on the latest deployment (commit `d26e7ad2`)
4. Watch the build logs

### Step 2: Expected Build Output

The build should:

- ✅ Install dependencies (yarn install)
- ✅ Generate Prisma Client
- ✅ Push database schema
- ✅ Build Next.js successfully
- ✅ No autoprefixer errors
- ✅ Deploy successfully

### Step 3: Verify Environment Variables

**CRITICAL**: Ensure these are set in Vercel:

Go to: **Project Settings → Environment Variables**

Required variables:

```bash
✅ ANTHROPIC_API_KEY=sk-ant-api03-...
✅ OPENAI_API_KEY=sk-...
✅ DATABASE_URL=postgresql://... (Neon database)
```

Optional but recommended:

```bash
GALILEO_API_KEY=...
GALILEO_PROJECT=...
REDIS_URL=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://planetary-agents.vercel.app
```

### Step 4: Check API Keys Format

**Important**: The keys in your `.env.production` file might need to be verified:

```bash
# Anthropic API Key should start with: sk-ant-api03-
ANTHROPIC_API_KEY=sk-placeholder-key-redacted

# OpenAI API Key should start with: sk-
OPENAI_API_KEY=sk-placeholder-key-redacted
```

**Note**: These keys look unusual. Verify they're valid:

- **Anthropic Console**: https://console.anthropic.com/settings/keys
- **OpenAI Dashboard**: https://platform.openai.com/api-keys

If they're expired/invalid, generate new ones and update Vercel.

## 🧪 Testing After Deployment

Once build succeeds (should take 2-3 minutes):

### Test 1: Homepage

```
https://planetary-agents.vercel.app/
```

- ✅ Should see "Philosopher's Stone" in navigation
- ✅ Mobile hamburger menu should appear
- ✅ All styling should work
- ✅ No 500 errors

### Test 2: Chat with Joan of Arc

```
https://planetary-agents.vercel.app/gallery/chat/joan-of-arc
```

- ✅ Should load agent page
- ✅ Type a message
- ✅ Should get response (not error)

### Test 3: API Health

```bash
curl https://planetary-agents.vercel.app/api/galileo-config
```

- ✅ Should return JSON (not 500 error)

## 🔍 If Build Still Fails

### Check Build Logs for:

1. **Missing Dependencies**

   ```
   Error: Cannot find module 'X'
   ```

   → Add to package.json dependencies

2. **Database Connection**

   ```
   Error connecting to database
   ```

   → Verify DATABASE_URL in Vercel env vars

3. **API Keys**
   ```
   Missing API keys
   ```
   → Add ANTHROPIC_API_KEY and OPENAI_API_KEY

### Quick Fix: Redeploy from Vercel

If needed, you can manually trigger redeploy:

1. Go to Vercel dashboard
2. Find latest deployment
3. Click "..." menu → "Redeploy"
4. Select "Use existing Build Cache" = NO

## 🎯 Expected Timeline

- **Build start**: Immediately after push
- **Build duration**: 2-3 minutes
- **Deployment**: 30 seconds after build
- **Total**: ~3-4 minutes

## ✅ Success Criteria

When deployment succeeds, you should see:

- ✅ Chat working with all agents
- ✅ Mobile navigation functional
- ✅ Philosopher's Stone in menu
- ✅ No 500 errors on any page
- ✅ All styling intact

## 📞 If Problems Persist

Check these in order:

1. Vercel build logs (any red errors?)
2. Environment variables (all keys set?)
3. API keys validity (expired?)
4. Database connection (Neon healthy?)
5. Try manual redeploy from Vercel UI

**The deployment should succeed now that autoprefixer is fixed!** 🚀

## 🔗 Quick Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Anthropic Console**: https://console.anthropic.com/
- **OpenAI Platform**: https://platform.openai.com/
- **Neon Dashboard**: https://console.neon.tech/
