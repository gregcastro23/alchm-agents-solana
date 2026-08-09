# 🚀 Deployment Environment Variables - Quick Reference

**Swiss Ephemeris Migration - November 22, 2025**

## 📦 RENDER BACKEND

Copy these to: **Render Dashboard** → **Your Service** → **Environment** tab

### Core Variables (Copy-Paste Ready)

```bash
NODE_ENV=production
NODE_VERSION=20.11.0
PORT=8000
HOST=0.0.0.0
DATABASE_URL=postgresql://neondb_owner:npg_J8CabeXrf5Od@ep-mute-thunder-ahui2n87-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
CORS_ORIGINS=https://v0-planetary-agents1.vercel.app,https://v0-planetary-agents-git-main-gregcastro23s-projects.vercel.app,https://*.vercel.app,https://planetary-agents.vercel.app
ANTHROPIC_API_KEY=sk-placeholder-key-redacted-for-security
OPENAI_API_KEY=sk-placeholder-key-redacted-for-security
PLANETARY_HOURS_BACKEND=true
THERMODYNAMICS_BACKEND=true
TOKEN_CALCULATIONS_BACKEND=true
KINETICS_BACKEND=true
ENABLE_WEBSOCKET=false
ALCHM_BACKEND_URL=https://alchm-backend.onrender.com
ALCHM_BACKEND_TIMEOUT=30000
MAX_REQUEST_SIZE_MB=2
LOG_LEVEL=info
```

### Render Build Configuration

| Setting               | Value                                      |
| --------------------- | ------------------------------------------ |
| **Build Command**     | `cd backend && yarn install && yarn build` |
| **Start Command**     | `cd backend && yarn start`                 |
| **Root Directory**    | (leave empty)                              |
| **Health Check Path** | `/api/health`                              |

---

## 🌐 VERCEL FRONTEND

Copy these to: **Vercel Dashboard** → **Settings** → **Environment Variables**

### Critical Variable

**⚠️ IMPORTANT**: Update this to match your Render backend URL!

```bash
NEXT_PUBLIC_BACKEND_URL=https://alchm-backend.onrender.com
```

**OR** if you deployed a new backend service:

```bash
NEXT_PUBLIC_BACKEND_URL=https://planetary-agents-backend.onrender.com
```

### How to Find Your Backend URL

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on your backend service
3. Copy the URL shown at the top (e.g., `https://your-service.onrender.com`)
4. Paste that into Vercel's `NEXT_PUBLIC_BACKEND_URL`

### Other Variables (Should Already Exist)

```bash
ANTHROPIC_API_KEY=sk-placeholder-key-redacted-for-security
OPENAI_API_KEY=sk-placeholder-key-redacted-for-security
DATABASE_URL=postgresql://neondb_owner:npg_J8CabeXrf5Od@ep-mute-thunder-ahui2n87-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
NEXT_PUBLIC_BETA_MODE=true
NEXT_PUBLIC_FEEDBACK_ENABLED=true
NEXT_PUBLIC_PERFORMANCE_MONITORING=true
NEXT_PUBLIC_ACCESSIBILITY_MODE=true
NEXT_PUBLIC_ADDITIVE_ONLY_ELEMENTS=false
```

---

## ✅ Deployment Checklist

### Step 1: Render Backend

- [ ] Go to Render Dashboard
- [ ] Select/Create backend service
- [ ] Copy all environment variables from above
- [ ] Set Build Command: `cd backend && yarn install && yarn build`
- [ ] Set Start Command: `cd backend && yarn start`
- [ ] Set Health Check Path: `/api/health`
- [ ] Save and deploy
- [ ] Wait for build to complete (~5-10 minutes)
- [ ] Check logs for: "✓ swisseph@npm:0.5.17 must be built"
- [ ] Check logs for: "🚀 Planetary Agents Backend started"
- [ ] Copy your backend URL (e.g., `https://your-service.onrender.com`)

### Step 2: Test Backend

```bash
# Health check
curl https://your-backend.onrender.com/api/health

# Available planets
curl https://your-backend.onrender.com/api/planets/available

# Planetary positions
curl -X POST https://your-backend.onrender.com/api/planets/positions \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-11-22T18:00:00Z","latitude":40.8681,"longitude":-73.9176,"planets":["sun","moon"]}'
```

**Expected**: All should return JSON with `"success": true`

### Step 3: Vercel Frontend

- [ ] Go to Vercel Dashboard
- [ ] Select planetary-agents project
- [ ] Go to Settings → Environment Variables
- [ ] Update `NEXT_PUBLIC_BACKEND_URL` with your Render backend URL
- [ ] Apply to: Production, Preview, Development
- [ ] Save changes
- [ ] Go to Deployments → Redeploy latest
- [ ] Wait for build (~2-3 minutes)
- [ ] Check build logs for: "✓ Compiled successfully"
- [ ] Verify NO errors about swisseph or node-gyp

### Step 4: Test Production

- [ ] Visit your Vercel frontend URL
- [ ] Open DevTools → Console (should be no errors)
- [ ] Open DevTools → Network tab
- [ ] Navigate to a page with planetary data (e.g., `/chart-of-the-moment`)
- [ ] Verify API calls to Render backend
- [ ] Check for 200 OK responses
- [ ] Confirm planetary data displays correctly

---

## 🔧 Quick Test Script

Run this in your browser console on your Vercel site:

```javascript
// Test backend connection
fetch(window.NEXT_PUBLIC_BACKEND_URL || 'https://your-backend.onrender.com/api/planets/available')
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      console.log('✅ Backend connected!', data.data.length, 'planets available')
    } else {
      console.error('❌ Backend error:', data)
    }
  })
  .catch(err => console.error('❌ Connection failed:', err))

// Test planetary positions
fetch('https://your-backend.onrender.com/api/planets/positions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    date: new Date().toISOString(),
    latitude: 40.8681,
    longitude: -73.9176,
    planets: ['sun', 'moon', 'mars'],
  }),
})
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      console.log('✅ Planetary positions:', data.data)
    } else {
      console.error('❌ API error:', data)
    }
  })
```

---

## 🚨 Troubleshooting

### Backend Build Fails

**Error**: `swisseph compilation failed`

**Solution**:

- Verify `NODE_VERSION=20.11.0` is set
- Check that build command is: `cd backend && yarn install && yarn build`
- Review Render build logs for specific error
- Ensure `backend/package.json` has `"swisseph": "^0.5.17"`

### Backend Won't Start

**Error**: `Service unhealthy` or `Failed to bind to port`

**Solution**:

- Verify `PORT=8000` and `HOST=0.0.0.0` are set
- Check start command is: `cd backend && yarn start`
- Review logs for import errors
- Ensure `dist/index.js` was created during build

### CORS Errors

**Error**: `Access-Control-Allow-Origin` in browser console

**Solution**:

- Add your Vercel URL to `CORS_ORIGINS` in Render
- Include wildcard: `https://*.vercel.app`
- Restart Render service after updating
- Clear browser cache and retry

### Frontend Can't Connect

**Error**: `Failed to fetch` or `Network error`

**Solution**:

- Verify `NEXT_PUBLIC_BACKEND_URL` in Vercel matches your Render URL
- Check Render service is running (not sleeping)
- Test backend directly: `curl https://your-backend.onrender.com/api/health`
- Check browser console for exact error message
- Verify no typos in backend URL

### 503 Service Unavailable

**Error**: `503` response from backend

**Cause**: Free tier service is sleeping

**Solution**:

- Wait 30-60 seconds for service to wake up
- First request after sleep will be slow
- Subsequent requests will be fast
- Consider upgrading to paid tier ($7/month) for always-on

---

## 📊 Success Criteria

✅ **Backend Deployed Successfully**:

- Build completes without errors
- Logs show: "swisseph@npm:0.5.17 must be built"
- Logs show: "Planetary Agents Backend started"
- Health check returns 200 OK
- `/api/planets/available` returns 12 planets

✅ **Frontend Deployed Successfully**:

- Build completes without swisseph errors
- No node-gyp compilation attempts
- "Compiled successfully" message
- Build time under 5 minutes

✅ **Integration Working**:

- Frontend makes successful API calls to backend
- Planetary data displays correctly
- No CORS errors in console
- Response times under 500ms
- No 503 errors after warm-up

---

## 📞 Support

**Documentation**:

- `SWISS_EPHEMERIS_ARCHITECTURE.md` - Full architecture guide
- `SWISS_EPHEMERIS_MIGRATION_COMPLETE.md` - Migration details
- `backend/.env.render.swiss-ephemeris` - Detailed env var docs

**Testing**:

- `scripts/test-swiss-ephemeris-migration.ts` - Integration tests
- Run locally: `npx tsx scripts/test-swiss-ephemeris-migration.ts`

**External Resources**:

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Swiss Ephemeris](https://www.astro.com/swisseph/)

---

**Last Updated**: November 22, 2025
**Migration**: Swiss Ephemeris Backend-Only Architecture
**Commit**: e347d722
