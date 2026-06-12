# 🔍 How to Check Vercel Function Logs (RUNTIME ERRORS)

## ⚠️ What You're Looking At Now: BUILD LOGS

Those Uranus/Neptune errors are **build-time warnings** - they're NOT causing the chat failure.

They happen during `next build` and are non-critical.

## 🎯 What You NEED to Check: RUNTIME FUNCTION LOGS

When Joan of Arc chat fails, it's a **runtime error** happening AFTER deployment.

## 📋 Step-by-Step: Find the Real Error

### Step 1: Go to Vercel Dashboard

```
https://vercel.com/dashboard
```

### Step 2: Click Your Project

Find and click: **planetary-agents** (or whatever your project name is)

### Step 3: Click "Logs" Tab

At the top navigation, click: **Logs**

### Step 4: Filter to Functions

Look for a dropdown or filter that says:

- **Source**: Functions
- OR click "Runtime Logs"
- OR click "Serverless Functions"

### Step 5: Look for Recent Errors

You should see logs with timestamps around **1:00 AM - 1:30 AM** (when you tested)

Look for lines containing:

```
/api/monica-agent
[Monica API] Request received
[Monica API] API keys verified: false  ← KEY ISSUE!
Error: ...
```

### Step 6: Find the Specific Error

**Most Likely You'll See:**

**Option A - Missing API Keys:**

```
[Monica API] API keys verified: false
Missing required environment variables: OPENAI_API_KEY
```

→ **FIX**: Add OPENAI_API_KEY to Vercel environment variables

**Option B - Function Timeout:**

```
Task timed out after 10.00 seconds
```

→ **FIX**: Increase function timeout in vercel.json

**Option C - Import Error:**

```
Error: Cannot find module '@ai-sdk/anthropic'
```

→ **FIX**: Already fixed in latest commit, wait for redeploy

**Option D - Database Error:**

```
Error: P1001: Can't reach database server
```

→ **FIX**: Check DATABASE_URL in Vercel

## 🆘 If You Can't Find Function Logs

Try this alternative:

### Go to Deployments Tab Instead

1. Click **"Deployments"** tab
2. Click on the **latest deployment** (should be from ~20 minutes ago)
3. Click **"Functions"** tab
4. Click on **`/api/monica-agent`**
5. You should see execution logs there

## 📸 What to Share With Me

**Take a screenshot or copy/paste:**

1. **Any error message** from the function logs
2. **The timestamp** when error occurred
3. **The full error stack** if available

OR just tell me what you see, like:

- "It says: Missing required environment variables: OPENAI_API_KEY"
- "It says: Function timed out after 10s"
- "I don't see any logs for /api/monica-agent"

## 🔑 Quick Check: Environment Variables

While you're in Vercel, also check:

**Project Settings** → **Environment Variables**

Do you see these? (take screenshot if needed):

```
✅ ANTHROPIC_API_KEY - Applied to Production
✅ OPENAI_API_KEY - Applied to Production
✅ DATABASE_URL - Applied to Production
```

If ANY are missing or not applied to "Production", that's the problem!

## ⚡ Most Common Issue

**90% of the time it's this:**

Environment variables exist in Vercel BUT:

- ❌ Not applied to "Production" environment (only Preview/Development)
- ❌ Value is blank/empty
- ❌ Has extra quotes or spaces

**Fix:** Edit each variable and ensure:

1. Value is EXACT from .env files (no quotes)
2. ALL THREE checkboxes checked: Production, Preview, Development
3. Click "Save"
4. Redeploy

---

**PLEASE check these logs and tell me what you find!** That's the key to fixing this! 🔍
