# Vercel Environment Variables - Local Calculation Mode

**Mode**: Frontend-only (no backend dependency)
**Updated**: November 14, 2025

---

## Required Environment Variables

Copy and paste these into Vercel Dashboard → Settings → Environment Variables

---

### 🗄️ Database (Neon PostgreSQL)

```bash
DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza18td3VSbzZMendSS2tiVUNVUjl6R2QiLCJhcGlfa2V5IjoiMDFLN0dRNERENFJSQjI4QVE4U1BZRFpFVEUiLCJ0ZW5hbnRfaWQiOiI2YmI2MGYzNTUxY2Q1OGMxZDMwYWY5ZmM5YzRiM2FiOTcyZmI5ZThmY2Y3NDdjMzM4NDdjYWIxYmU5YmIzMzVjIiwiaW50ZXJuYWxfc2VjcmV0IjoiN2RlZDYwNTYtYTI5Zi00YTljLThmN2EtZWQ4MmU2YmY3MjZmIn0.CRh4PfsKi-bRJY_ixC-xN-i7WrgOa2Jrr7eblH10uTs

POSTGRES_PRISMA_URL=postgresql://neondb_owner:npg_J8CabeXrf5Od@ep-mute-thunder-ahui2n87-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15

POSTGRES_URL_NON_POOLING=postgresql://neondb_owner:npg_J8CabeXrf5Od@ep-mute-thunder-ahui2n87.us-east-1.aws.neon.tech/neondb?sslmode=require
```

---

### 🤖 AI API Keys

```bash
ANTHROPIC_API_KEY=sk-placeholder-key-redacted-for-security

OPENAI_API_KEY=sk-placeholder-key-redacted-for-security

GALILEO_API_KEY=q01AM1oNTjbStxEaiHx44gKLg0FUCd-yzmk4hV55pjU

GALILEO_PROJECT=1e7fd4a1-3e28-4fe1-a719-744f239a13be

GALILEO_LOG_STREAM=6ed50263-a348-4ad6-ab63-bd04d3a4ffdd
```

---

### 🧠 Claude Configuration

```bash
CLAUDE_DEFAULT_MODEL=claude-3-opus-20240229

CLAUDE_FAST_MODEL=claude-3-5-haiku-20241022
```

---

### 👁️ Monica Configuration

```bash
MONICA_DEFAULT_MODEL=gpt-4o-mini

MONICA_TEMPERATURE=0.4
```

---

### 🚩 Feature Flags (Public)

```bash
NEXT_PUBLIC_BETA_MODE=true

NEXT_PUBLIC_FEEDBACK_ENABLED=true

NEXT_PUBLIC_PERFORMANCE_MONITORING=true

NEXT_PUBLIC_ACCESSIBILITY_MODE=true

NEXT_PUBLIC_ADDITIVE_ONLY_ELEMENTS=false
```

---

### 📚 RAG Configuration

```bash
USE_RAG_GENERATION=true

USE_VECTOR_SEARCH=true

USE_RAG_CACHE=true
```

---

### ⚙️ Next.js Configuration

```bash
NODE_ENV=production

NEXT_TELEMETRY_DISABLED=1
```

---

### 🔐 Authentication (NextAuth)

```bash
NEXTAUTH_URL=https://planetary-agents.vercel.app

NEXTAUTH_SECRET=<GENERATE_NEW_SECRET>
```

**To generate NEXTAUTH_SECRET:**

```bash
openssl rand -base64 32
```

---

## ❌ Variables to DELETE (Backend-related)

**These should NOT be set for local-only mode:**

```bash
# DELETE these if they exist:
NEXT_PUBLIC_BACKEND_URL
BACKEND_URL
NEXT_PUBLIC_PLANETARY_HOURS_BACKEND
NEXT_PUBLIC_THERMODYNAMICS_BACKEND
NEXT_PUBLIC_TOKEN_CALCULATIONS_BACKEND
NEXT_PUBLIC_KINETICS_BACKEND
NEXT_PUBLIC_WEBSOCKET_URL
NEXT_PUBLIC_TOKENS_BACKEND
NEXT_PUBLIC_RUNE_AGENT_BACKEND
```

---

## 📋 Vercel Dashboard Setup

### Step 1: Navigate to Environment Variables

1. Go to https://vercel.com/dashboard
2. Click your project name
3. Click "Settings" tab
4. Click "Environment Variables" in sidebar

### Step 2: Add Each Variable

For each variable above:

1. Click "Add New" button
2. **Key**: Paste variable name (e.g., `DATABASE_URL`)
3. **Value**: Paste variable value
4. **Environments**: Check **Production** only (for now)
5. Click "Save"

### Step 3: Remove Old Backend Variables

For each backend variable listed in "Variables to DELETE":

1. Find variable in list
2. Click "..." menu
3. Click "Delete"
4. Confirm deletion

---

## 🧪 Testing After Setup

```bash
# Test deployment
vercel --prod

# Test API endpoints
curl https://planetary-agents.vercel.app/api/planetary-positions
curl https://planetary-agents.vercel.app/api/philosophers-stone/positions
curl https://planetary-agents.vercel.app/api/health
```

**Expected**: All return 200 OK with JSON data

---

## 📊 Variable Count

| Category      | Count  | Required         |
| ------------- | ------ | ---------------- |
| Database      | 3      | ✅ Yes           |
| AI APIs       | 5      | ✅ Yes           |
| Claude        | 2      | ✅ Yes           |
| Monica        | 2      | ✅ Yes           |
| Feature Flags | 5      | ✅ Yes           |
| RAG           | 3      | ✅ Yes           |
| Next.js       | 2      | ✅ Yes           |
| Auth          | 2      | ✅ Yes           |
| **Total**     | **24** | **All required** |

---

## ⚠️ Security Notes

1. **Rotate credentials** after this conversation (they're now exposed)
2. **Generate new NEXTAUTH_SECRET** - don't copy from docs
3. **Don't commit** these to Git (use `.env.local` for local dev)
4. **Vercel encrypts** env vars - they're safe in the dashboard

---

## 🔄 Next Steps (After Backend Deployment)

When you deploy backend to Render/Neon later:

1. Add `NEXT_PUBLIC_BACKEND_URL`
2. Add `BACKEND_URL`
3. Optionally enable feature flags:
   - `NEXT_PUBLIC_PLANETARY_HOURS_BACKEND=true`
   - `NEXT_PUBLIC_TOKENS_BACKEND=true`

---

**Generated**: November 14, 2025
**Mode**: Local calculations only (no backend)
**Status**: Production-ready configuration
