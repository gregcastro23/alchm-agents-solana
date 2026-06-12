# Vercel Environment Variables Setup Guide

## 🎯 Minimum Required Variables

These are the **critical variables** you must set for your application to work:

```bash
DATABASE_URL=postgresql://user:password@host:port/database
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=BwPncOutL5ZNLFCPR3BU8DzD86PYIK1gm3UjzQThEg0=
OPENAI_API_KEY=sk-your-openai-key-here
NEXT_PUBLIC_ADDITIVE_ONLY_ELEMENTS=true
```

---

## 📋 Step-by-Step Vercel Setup Instructions

### 1. Access Your Vercel Dashboard

1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your **Planetary Agents** project
3. Navigate to **Settings** → **Environment Variables**

### 2. Set Up Required Variables

For each variable below, click **Add New** and follow these steps:

#### ✅ **DATABASE_URL** (Critical)

**Important:** You need a **Prisma Accelerate** connection string, not a direct PostgreSQL URL.

**Option A: Use Prisma Accelerate (Recommended for Production)**

1. Go to [Prisma Console](https://console.prisma.io)
2. Sign in or create an account
3. Create a new project or select your existing project
4. Enable Prisma Accelerate
5. Copy the **Accelerate Connection String** (format: `prisma://accelerate.prisma-data.net/?api_key=...`)

**Option B: Use Direct PostgreSQL (if you have a database)**

Format: `postgresql://username:password@hostname:5432/database`

Example:

```bash
DATABASE_URL=postgresql://myuser:mypassword@db.example.com:5432/planetary_agents
```

**Add to Vercel:**

- Name: `DATABASE_URL`
- Value: Your connection string
- Environment: Select **Production**, **Preview**, and **Development**

---

#### Jupiter: **NEXTAUTH_URL** (Critical)

Your production URL from Vercel.

```bash
NEXTAUTH_URL=https://v0-planetary-agents.vercel.app
```

**Add to Vercel:**

- Name: `NEXTAUTH_URL`
- Value: `https://v0-planetary-agents.vercel.app`
- Environment: **Production only**

---

#### 🔐 **NEXTAUTH_SECRET** (Critical)

**Newly Generated Secret:**

```bash
NEXTAUTH_SECRET=BwPncOutL5ZNLFCPR3BU8DzD86PYIK1gm3UjzQThEg0=
```

This secret has been generated for you and is **cryptographically secure**.

**Add to Vercel:**

- Name: `NEXTAUTH_SECRET`
- Value: `BwPncOutL5ZNLFCPR3BU8DzD86PYIK1gm3UjzQThEg0=`
- Environment: **Production**, **Preview**, and **Development**

---

#### 🤖 **OPENAI_API_KEY** (Critical)

You already have this in your project. Retrieve it from:

**Option A: From your existing config**

- Check your existing Vercel environment variables
- Or retrieve from the OpenAI dashboard

**Add to Vercel:**

- Name: `OPENAI_API_KEY`
- Value: Your OpenAI API key (starts with `sk-...`)
- Environment: **Production**, **Preview**, and **Development**

---

#### 🌟 **NEXT_PUBLIC_ADDITIVE_ONLY_ELEMENTS** (Required for your system)

```bash
NEXT_PUBLIC_ADDITIVE_ONLY_ELEMENTS=true
```

This controls your elemental logic system.

**Add to Vercel:**

- Name: `NEXT_PUBLIC_ADDITIVE_ONLY_ELEMENTS`
- Value: `true`
- Environment: **Production**, **Preview**, and **Development**

---

## 🔄 After Adding Variables

### 1. Redeploy Your Application

After adding all variables, you **must redeploy**:

1. Go to your project's **Deployments** tab in Vercel
2. Click the three dots (...) on the latest deployment
3. Select **Redeploy**
4. Confirm **Use Existing Build Cache** or rebuild fresh
5. Wait for deployment to complete

### 2. Verify Variables Are Applied

Check your deployment logs to ensure all variables are loaded:

1. Go to **Deployments** → Select latest deployment
2. Click **Build Logs**
3. Look for any environment variable errors

---

## 📝 Complete Environment Variable List

For your reference, here's the **complete set** of environment variables your application uses (from `vercel-env-variables.env`):

### Core Application

```bash
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://v0-planetary-agents.vercel.app
NEXTAUTH_SECRET=BwPncOutL5ZNLFCPR3BU8DzD86PYIK1gm3UjzQThEg0=
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://v0-planetary-agents.vercel.app
```

### AI API Keys

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Feature Flags

```bash
NEXT_PUBLIC_ADDITIVE_ONLY_ELEMENTS=true
NEXT_PUBLIC_PLANETARY_HOURS_BACKEND=true
NEXT_PUBLIC_THERMODYNAMICS_BACKEND=true
NEXT_PUBLIC_TOKEN_CALCULATIONS_BACKEND=true
NEXT_PUBLIC_KINETICS_BACKEND=true
```

### Backend Integration (if using)

```bash
NEXT_PUBLIC_BACKEND_URL=https://idiodynamic-quadrilaterally-roberta.ngrok-free.dev
NEXT_PUBLIC_WEBSOCKET_URL=wss://idiodynamic-quadrilaterally-roberta.ngrok-free.dev
```

### Monica Configuration

```bash
MONICA_DEFAULT_MODEL=gpt-4o-mini
NEXT_PUBLIC_MONICA_DEFAULT_MODEL=gpt-4o-mini
```

### Galileo Observability (Optional)

```bash
GALILEO_API_KEY=q01AM1oNTjbStxEaiHx44gKLg0FUCd-yzmk4hV55pjU
GALILEO_PROJECT=AlchmPlanetaryAgents
GALILEO_LOG_STREAM=production
GALILEO_FAIL_SILENTLY=true
GALILEO_LOG_ENABLED=false
```

### Cross-Backend Sync (Optional)

```bash
WHATTOEATNEXT_BASE_URL=https://api.whattoeatnext.com/api
WHATTOEATNEXT_API_KEY=planetary_agents_shared_key_2025
CROSS_BACKEND_SYNC_ENABLED=true
SYNC_MONITORING_ENABLED=true
```

### Background Processing

```bash
ENABLE_TRANSIT_SCHEDULER=true
TRANSIT_SCHEDULER_INTERVAL=60
BACKGROUND_REFRESH_INTERVAL_MS=600000
```

---

## 🚨 Troubleshooting

### Issue: Database Connection Errors

**Symptoms:** Errors about database connectivity
**Solution:**

1. Verify your DATABASE_URL is correct
2. Ensure your database is accessible from Vercel
3. If using Prisma Accelerate, ensure it's enabled

### Issue: Authentication Not Working

**Symptoms:** NextAuth errors, session issues
**Solution:**

1. Verify NEXTAUTH_URL matches your production URL exactly
2. Ensure NEXTAUTH_SECRET is set
3. Redeploy after changing these values

### Issue: API Key Errors

**Symptoms:** OpenAI or Anthropic errors
**Solution:**

1. Verify API keys are valid in their respective dashboards
2. Check for extra spaces or characters
3. Ensure sufficient API credits

### Issue: Build Fails After Adding Variables

**Solution:**

1. Check variable names for typos
2. Ensure no special characters in values
3. Clear Vercel build cache and redeploy
4. Check build logs for specific errors

---

## ✅ Quick Copy-Paste for Minimum Setup

Here's what to copy into Vercel for the minimum setup:

```bash
# Critical Variables - Add these first

DATABASE_URL=your-postgres-or-accelerate-url-here
NEXTAUTH_URL=https://v0-planetary-agents.vercel.app
NEXTAUTH_SECRET=BwPncOutL5ZNLFCPR3BU8DzD86PYIK1gm3UjzQThEg0=
OPENAI_API_KEY=your-openai-key-here
NEXT_PUBLIC_ADDITIVE_ONLY_ELEMENTS=true
```

**Remember:** Replace `your-postgres-or-accelerate-url-here` and `your-openai-key-here` with actual values!

---

## 📞 Need Help?

If you encounter issues:

1. Check the deployment logs in Vercel
2. Review the [Vercel Environment Variables Docs](https://vercel.com/docs/projects/environment-variables)
3. Check your database connection
4. Verify API keys are active in their respective dashboards

---

## ✨ Next Steps

After setting up the minimum variables:

1. ✅ Add all variables from the complete list above
2. ✅ Redeploy your application
3. ✅ Test your application thoroughly
4. ✅ Monitor deployment logs for errors
5. ✅ Set up database migrations if needed

**Last Updated:** 2025-09-19  
**Generated NEXTAUTH_SECRET:** `BwPncOutL5ZNLFCPR3BU8DzD86PYIK1gm3Ujz权ThEg0=`
