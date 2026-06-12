# Backend Deployment Guide - Web-Hosted Endpoint

## 🚨 Current Problem

You're using **ngrok** to expose your local backend, which is causing issues:

- ❌ ngrok tunnel is down/expired
- ❌ URLs change on every restart (free tier)
- ❌ Not reliable for production
- ❌ Requires your computer to be running 24/7

## ✅ Solution: Deploy Backend to Render

Deploy your backend to **Render.com** for a stable, web-hosted endpoint that works 24/7.

---

## 🚀 Quick Deploy to Render (15 minutes)

### Step 1: Prepare Your Repository

Make sure your code is pushed to GitHub:

```bash
git add .
git commit -m "Prepare backend for Render deployment"
git push origin main
```

### Step 2: Create Render Web Service

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Click "New +"** → **"Web Service"**
3. **Connect your GitHub repository**
4. **Select your repository**: `planetary-agents` (or your repo name)

### Step 3: Configure Service Settings

**Basic Settings:**

- **Name**: `planetary-agents-backend`
- **Region**: `Oregon` (or closest to your users)
- **Branch**: `main`
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `yarn install && yarn build`
- **Start Command**: `yarn start`

**OR use the automated render.yaml** (recommended):

- Render will auto-detect `render.yaml` in your repo
- It's already configured at the root level
- Just select "Apply Render Blueprint" when prompted

### Step 4: Set Environment Variables

In Render dashboard, go to **Environment** tab and add:

```bash
# Core Configuration
NODE_ENV=production
PORT=8000
HOST=0.0.0.0

# Database (same as your Vercel/Neon)
DATABASE_URL=postgresql://neondb_owner:npg_J8CabeXrt50d@ep-mute-thunder-ahui2n87-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# CORS - Your Vercel frontend URL
CORS_ORIGINS=https://v0-planetary-agents1.vercel.app,https://*.vercel.app

# Feature Flags (enable what you need)
PLANETARY_HOURS_BACKEND=true
THERMODYNAMICS_BACKEND=true
TOKEN_CALCULATIONS_BACKEND=true
KINETICS_BACKEND=true

# WebSocket (optional, disable for free tier)
ENABLE_WEBSOCKET=false

# Redis (optional - will use memory fallback if not set)
# REDIS_URL=redis://your-redis-url:6379

# AI API Keys (same as Vercel)
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key

# External Services
ALCHM_BACKEND_URL=https://alchm-backend.onrender.com
ALCHM_BACKEND_TIMEOUT=30000
```

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will:
   - Clone your repo
   - Install dependencies
   - Build the backend
   - Start the service
3. Wait 5-10 minutes for first deployment

### Step 6: Get Your Backend URL

After deployment, Render will give you a URL like:

```
https://planetary-agents-backend.onrender.com
```

**Save this URL** - you'll need it for the frontend!

---

## 🔧 Update Frontend (Vercel)

### Step 1: Update Vercel Environment Variables

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

**Remove old ngrok variables:**

- Delete `NEXT_PUBLIC_BACKEND_URL` (if pointing to ngrok)
- Delete `NEXT_PUBLIC_WEBSOCKET_URL` (if pointing to ngrok)

**Add new Render backend URL:**

```bash
NEXT_PUBLIC_BACKEND_URL=https://planetary-agents-backend.onrender.com
NEXT_PUBLIC_WEBSOCKET_URL=wss://planetary-agents-backend.onrender.com
```

**Keep feature flags enabled:**

```bash
NEXT_PUBLIC_PLANETARY_HOURS_BACKEND=true
NEXT_PUBLIC_THERMODYNAMICS_BACKEND=true
NEXT_PUBLIC_TOKEN_CALCULATIONS_BACKEND=true
NEXT_PUBLIC_KINETICS_BACKEND=true
```

### Step 2: Redeploy Frontend

```bash
# Via CLI
vercel --prod

# Or via Dashboard
# Go to Deployments → Click "..." → "Redeploy"
```

---

## ✅ Verify Deployment

### Test Backend Health

```bash
# Health check
curl https://planetary-agents-backend.onrender.com/api/health

# Expected response:
# {"status":"ok","uptime":"...","version":"1.0.0"}
```

### Test from Frontend

1. Visit your Vercel site
2. Open browser console (F12)
3. Check for backend API calls
4. Should see successful requests to Render backend

### Test API Endpoints

```bash
# Planetary hours
curl -X POST https://planetary-agents-backend.onrender.com/api/planetary/current-hour \
  -H "Content-Type: application/json" \
  -d '{"location":{"lat":40.7128,"lon":-74.0060}}'

# Consciousness calculation
curl -X POST https://planetary-agents-backend.onrender.com/api/consciousness/live \
  -H "Content-Type: application/json" \
  -d '{"agentId":"leonardo-da-vinci","birthInfo":{...}}'
```

---

## 🎯 Alternative: Railway.app (Faster, Better Free Tier)

If Render free tier is too slow, try **Railway**:

### Quick Deploy to Railway

```bash
cd backend
railway login
railway init
railway up
```

**Advantages:**

- ✅ Faster cold starts
- ✅ Better free tier
- ✅ Automatic HTTPS
- ✅ Built-in Redis/PostgreSQL

**Configuration:**

- Uses `backend/deploy/railway.toml` (if exists)
- Or auto-detects from `package.json`

---

## 📊 Render Free Tier Limitations

**What to expect:**

- ⚠️ **Cold starts**: First request after 15min inactivity takes ~30-60s
- ⚠️ **Sleep mode**: Service sleeps after 15min of inactivity
- ⚠️ **Bandwidth**: 100GB/month free
- ✅ **Uptime**: 99%+ when active
- ✅ **HTTPS**: Automatic SSL

**Solutions:**

1. **Upgrade to paid tier** ($7/month) - no sleep, faster
2. **Use Railway** - better free tier
3. **Keep-alive ping** - ping `/api/health` every 10min (not recommended)

---

## 🔍 Troubleshooting

### Backend Not Starting

**Check Render Logs:**

1. Go to Render dashboard → Your service → Logs
2. Look for errors in build/start process

**Common Issues:**

- **Build fails**: Check `yarn build` works locally
- **Port error**: Ensure `PORT` env var is set
- **Database error**: Verify `DATABASE_URL` is correct

### CORS Errors

**Error**: `Access-Control-Allow-Origin` blocked

**Fix**: Update `CORS_ORIGINS` in Render:

```bash
CORS_ORIGINS=https://v0-planetary-agents1.vercel.app,https://*.vercel.app
```

### 503 Service Unavailable

**Cause**: Service is sleeping (free tier)

**Fix**:

1. Wait 30-60 seconds for wake-up
2. Or upgrade to paid tier
3. Or use Railway (better free tier)

### Backend URL Not Working

**Check:**

1. Service is deployed and running
2. URL is correct (no typos)
3. Health endpoint responds: `/api/health`
4. CORS is configured correctly

---

## 🎯 Recommended Architecture

```
┌─────────────────────┐
│  Vercel Frontend    │
│  (Next.js)          │
└──────────┬──────────┘
           │
           │ API Calls
           │
┌──────────▼──────────┐
│  Render Backend      │
│  (Express.js)        │
│  Port 8000           │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │              │
┌───▼───┐    ┌────▼────┐
│ Neon  │    │ Redis   │
│  DB   │    │ (opt)   │
└───────┘    └─────────┘
```

---

## 📋 Deployment Checklist

### Backend (Render)

- [ ] Repository pushed to GitHub
- [ ] Render service created
- [ ] Environment variables set
- [ ] Service deployed successfully
- [ ] Health check passes: `/api/health`
- [ ] Backend URL saved

### Frontend (Vercel)

- [ ] Old ngrok variables removed
- [ ] New Render backend URL added
- [ ] Feature flags enabled
- [ ] Frontend redeployed
- [ ] Tested from production site

### Verification

- [ ] Backend responds to health check
- [ ] Frontend can call backend APIs
- [ ] No CORS errors in console
- [ ] API endpoints return data
- [ ] No 500 errors

---

## 🚀 Next Steps

1. **Deploy backend to Render** (15 min)
2. **Update Vercel environment variables** (5 min)
3. **Test integration** (5 min)
4. **Monitor for 24 hours** (check logs)

**Total time**: ~25 minutes to get a stable, web-hosted backend!

---

## 💡 Pro Tips

1. **Use Render Blueprint** (`render.yaml`) for automatic configuration
2. **Enable auto-deploy** so changes push automatically
3. **Set up monitoring** to get alerts if backend goes down
4. **Use Railway** if Render free tier is too slow
5. **Consider paid tier** ($7/month) for production reliability

---

## 📞 Support

**Render Issues:**

- Render Docs: https://render.com/docs
- Render Support: support@render.com

**Backend Issues:**

- Check logs in Render dashboard
- Test locally: `cd backend && yarn dev`
- Verify environment variables

---

**Status**: Ready to deploy! 🚀

Your backend will have a stable URL like:
`https://planetary-agents-backend.onrender.com`

No more ngrok! No more changing URLs! No more keeping your computer on 24/7!
