# Swiss Ephemeris Migration - Deployment Next Steps

## Current Status

✅ **Completed:**

- Backend code with Swiss Ephemeris routes committed (commit e347d722)
- Environment variable files created for Render and Vercel
- Integration tests passing locally (5/5 tests)
- Render environment variables updated
- Git pushed to GitLab

⚠️ **Issues Identified:**

1. **Render hasn't deployed the new code yet**
   - Testing `https://alchm-backend.onrender.com/api/planets/available` returns 404
   - The new `/api/planets/*` routes aren't live yet
   - Render needs to pull from GitLab and rebuild

2. **Vercel missing critical environment variable**
   - `NEXT_PUBLIC_BACKEND_URL` not configured
   - Frontend API routes failing with 500 errors
   - Production console showing multiple API failures

## Immediate Actions Required

### Step 1: Trigger Render Deployment

**Option A: Manual Redeploy**

1. Go to Render Dashboard: https://dashboard.render.com
2. Find your backend service: `alchm-backend` or `planetary-agents-backend`
3. Click **"Manual Deploy"** → **"Deploy latest commit"**
4. Wait for build to complete (~3-5 minutes)
5. Watch build logs for:
   ```
   ✓ swisseph@npm:0.5.17 must be built
   🚀 Planetary Agents Backend started on port 8000
   ```

**Option B: Git Push Trigger**
If auto-deploy is enabled on GitLab integration:

1. Check if Render is already deploying (Deployments tab)
2. If not, trigger with empty commit:
   ```bash
   git commit --allow-empty -m "Trigger Render deployment"
   git push origin main
   ```

### Step 2: Verify Backend Deployment

Once Render build completes, test these endpoints:

```bash
# 1. Health check (if exists)
curl https://alchm-backend.onrender.com/api/health

# 2. Available planets (NEW endpoint)
curl https://alchm-backend.onrender.com/api/planets/available

# Expected response:
# {
#   "success": true,
#   "data": [ /* 12 planets with alchemy data */ ],
#   "metadata": { "total": 12, "alchemicalPrinciple": "..." }
# }

# 3. Planetary positions (NEW endpoint)
curl -X POST https://alchm-backend.onrender.com/api/planets/positions \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-11-22T18:00:00Z",
    "planets": ["sun", "moon"]
  }'

# Expected response:
# {
#   "success": true,
#   "data": {
#     "sun": { "longitude": 240.69, ... },
#     "moon": { "longitude": 267.57, ... }
#   },
#   "metadata": { "computeTime": 50, "totalPlanets": 2 }
# }
```

**Success Criteria:**

- ✅ All 3 endpoints return `"success": true`
- ✅ No 404 or 500 errors
- ✅ Response times < 500ms (when warm)
- ✅ Build logs show swisseph compilation success

### Step 3: Add Environment Variable to Vercel

**Critical:** This is blocking frontend production right now.

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Select project: `planetary-agents`

2. **Navigate to Environment Variables:**
   - Click **Settings** tab
   - Click **Environment Variables** in sidebar

3. **Add the new variable:**

   ```
   Variable Name: NEXT_PUBLIC_BACKEND_URL
   Value: https://alchm-backend.onrender.com
   ```

4. **Select all environments:**
   - ✅ Production
   - ✅ Preview
   - ✅ Development

5. **Save and redeploy:**
   - Click **Save**
   - Go to **Deployments** tab
   - Click **︙** (three dots) on latest deployment
   - Click **Redeploy**
   - ✅ Check **"Use existing Build Cache"** (faster)
   - Click **Redeploy**

**Reference file:** `VERCEL_ENV_UPDATES.txt` (in project root)

### Step 4: Verify Vercel Deployment

Once Vercel redeploy completes (~2-3 minutes):

1. **Check build logs:**
   - Should see: `✓ Compiled successfully`
   - Should NOT see: swisseph, node-gyp, or Python errors

2. **Test production site:**

   ```bash
   # Visit in browser
   open https://planetary-agents.vercel.app
   ```

3. **Check browser console (F12):**
   - Should see NO red errors
   - Previous 500 errors should be gone:
     - ❌ `/api/planetary-positions` (should now work)
     - ❌ `/api/philosophers-stone/positions` (should now work)
     - ❌ `/api/moment-recommendations` (should now work)

4. **Test backend connectivity from browser console:**

   ```javascript
   // Run this in browser DevTools console:
   fetch('https://alchm-backend.onrender.com/api/planets/available')
     .then(r => r.json())
     .then(d => console.log('✅ Backend connected:', d.data.length, 'planets'))
     .catch(e => console.error('❌ Backend failed:', e))
   ```

   **Expected output:** `✅ Backend connected: 12 planets`

### Step 5: Integration Testing

Test the full stack working together:

1. **Navigate to planetary features:**
   - Gallery: https://planetary-agents.vercel.app/gallery
   - Time Laboratory: https://planetary-agents.vercel.app/time-laboratory
   - Philosophers Stone: https://planetary-agents.vercel.app/philosophers-stone

2. **Verify planetary calculations work:**
   - Birth chart displays correctly
   - Planetary positions update
   - Consciousness metrics calculate
   - No console errors

3. **Check Network tab (F12 → Network):**
   - Filter by `planets`
   - Should see successful calls to `alchm-backend.onrender.com`
   - Response times should be reasonable (< 1s for cold start, < 500ms warm)

## Troubleshooting

### Render Build Fails

**Error: "swisseph compilation error"**

```bash
# Solution: Verify environment variables set correctly
# Check: NODE_VERSION=20.11.0
# Check: Build command includes: cd backend && yarn install && yarn build
```

**Error: "Cannot find module 'swisseph'"**

```bash
# Solution: Ensure package.json has swisseph dependency
# Check: backend/package.json includes "swisseph": "^0.5.17"
```

### Render Endpoints Return 404

**Symptom:** `/api/planets/available` returns `Cannot GET /api/planets/available`

**Causes:**

1. Deployment didn't complete - check Render dashboard
2. Build succeeded but service didn't restart - manual redeploy
3. Routes not registered in index.ts - verify backend/src/index.ts:171

**Solution:** Trigger manual redeploy from Render dashboard

### Vercel Build Fails

**Error: "Cannot find module 'swisseph'"**

```bash
# This means swisseph wasn't fully removed from frontend
# Solution:
rm -rf node_modules
rm -rf .next
yarn install
yarn build
```

**Error: "node-gyp rebuild failed"**

```bash
# This means swisseph is still being compiled on frontend
# Solution:
# 1. Verify package.json has NO swisseph
# 2. Check no imports of swisseph in frontend code
# 3. Search codebase: grep -r "swisseph" --exclude-dir=node_modules
```

### Frontend 500 Errors Persist

**After adding NEXT_PUBLIC_BACKEND_URL:**

1. **Verify environment variable is set:**

   ```bash
   # In Vercel build logs, should see:
   # NEXT_PUBLIC_BACKEND_URL: https://alchm-backend.onrender.com
   ```

2. **Check backend is responding:**

   ```bash
   curl https://alchm-backend.onrender.com/api/planets/available
   # Should return JSON with 12 planets
   ```

3. **Clear Vercel cache and redeploy:**
   - Go to Deployments → Redeploy
   - ✅ **UNCHECK** "Use existing Build Cache"
   - This forces fresh build with new env var

### CORS Errors in Browser

**Symptom:** `Access-Control-Allow-Origin` errors in console

**Solution:** Verify Render environment variable:

```bash
CORS_ORIGINS=https://planetary-agents.vercel.app,https://planetary-agents-frontend.onrender.com,https://*.vercel.app
```

If still failing:

1. Check Render logs for CORS middleware initialization
2. Verify frontend URL matches exactly (no trailing slash)
3. Test with curl to see if CORS headers are present

### Backend Cold Start Issues

**Symptom:** First request takes 30-60 seconds

**This is expected on Render free tier:**

- Service sleeps after 15 minutes of inactivity
- First request wakes it up (cold start)
- Subsequent requests are fast (< 500ms)

**Solutions:**

1. Keep service warm with health checks (costs money)
2. Upgrade to paid tier ($7/month for always-on)
3. Accept cold starts (inform users: "First load may be slow")

## Deployment Checklist

### Backend (Render)

- [ ] Code pushed to GitLab (commit e347d722)
- [ ] Render environment variables updated
- [ ] Manual deployment triggered
- [ ] Build logs show swisseph compilation success
- [ ] Service started successfully (logs show "Backend started")
- [ ] Health endpoint responds: `/api/health`
- [ ] Planets endpoint responds: `/api/planets/available`
- [ ] Positions endpoint works: `/api/planets/positions`

### Frontend (Vercel)

- [ ] `NEXT_PUBLIC_BACKEND_URL` added to all environments
- [ ] Redeployment triggered
- [ ] Build succeeds with no swisseph errors
- [ ] Production site loads without errors
- [ ] Browser console shows no 500 errors
- [ ] Backend connectivity test passes
- [ ] Planetary features work correctly

### Integration

- [ ] Gallery displays agent data
- [ ] Time Laboratory calculates correctly
- [ ] Birth charts render properly
- [ ] Consciousness metrics update
- [ ] No CORS errors in console
- [ ] Response times acceptable (< 1s cold, < 500ms warm)

## Success Metrics

When migration is complete, you should see:

✅ **Backend (Render):**

- Build time: 3-5 minutes (includes swisseph compilation)
- Response time: 50-200ms (warm), 30-60s (cold start)
- Memory usage: ~200-300MB (within free tier 512MB limit)
- All 3 endpoints returning `"success": true`

✅ **Frontend (Vercel):**

- Build time: 2-3 minutes (NO swisseph compilation)
- No node-gyp errors in build logs
- Clean console (no 500 errors)
- Successful API calls to backend

✅ **User Experience:**

- Planetary data displays correctly
- Birth charts render accurately
- Consciousness calculations work
- No visible errors or loading failures

## Rollback Plan

If deployment fails catastrophically:

```bash
# 1. Revert git commit
git revert e347d722
git push origin main

# 2. Restore Render to previous deployment
# Go to Render Dashboard → Deployments → Find previous successful deploy
# Click "Redeploy from this version"

# 3. Remove NEXT_PUBLIC_BACKEND_URL from Vercel
# Go to Vercel Settings → Environment Variables
# Delete NEXT_PUBLIC_BACKEND_URL
# Redeploy

# 4. Verify rollback worked
# Test production site
# Check for errors
# Verify planetary features work
```

## Timeline Estimate

**Best case scenario:**

- Render deployment: 5 minutes
- Vercel env var + redeploy: 3 minutes
- Testing: 2 minutes
- **Total: ~10 minutes**

**Realistic scenario:**

- Render deployment: 10 minutes (including troubleshooting)
- Vercel env var + redeploy: 5 minutes
- Testing and verification: 5 minutes
- **Total: ~20 minutes**

**Worst case scenario:**

- Render build issues: 30 minutes
- Vercel cache clearing: 10 minutes
- CORS troubleshooting: 10 minutes
- **Total: ~50 minutes**

## Next Steps RIGHT NOW

1. **Check Render Dashboard** - Is it currently deploying?
   - If YES: Wait for completion, then test endpoints
   - If NO: Trigger manual deploy

2. **Once Render is live** - Test the 3 endpoints
   - `/api/planets/available`
   - `/api/planets/positions`
   - `/api/planets/houses`

3. **Add Vercel environment variable**
   - `NEXT_PUBLIC_BACKEND_URL=https://alchm-backend.onrender.com`

4. **Redeploy Vercel** - Wait for build to complete

5. **Test production** - Visit https://planetary-agents.vercel.app

---

**Files Created for Reference:**

- `backend/.env.render.swiss-ephemeris` - Comprehensive env var guide (550+ lines)
- `backend/RENDER_ENV_PASTE.txt` - Copy-paste format for Render
- `backend/RENDER_CHANGES_ONLY.txt` - Just the new variables
- `VERCEL_ENV_UPDATES.txt` - Vercel instructions
- `DEPLOYMENT_NEXT_STEPS.md` - This file

**Test Script:**

- `scripts/test-swiss-ephemeris-migration.ts` - Run locally to verify

**Git Commits:**

- `e347d722` - Swiss Ephemeris migration (backend implementation)
- `2566bd65` - Environment configuration files

🔮 **Alchemical Principle Applied:**
_Separation of Vessels - Air (Vercel) carries light, Earth (Render) bears weight, Fire (API) transforms between_
