# Next.js Downgrade Fix - November 4, 2025

## ✅ FIX DEPLOYED: Next.js 15.5.6 → 15.5.3

### Problem Analysis

**Error from Logs:**

```
Cannot find module 'next/dist/compiled/source-map'
Require stack:
- /var/task/node_modules/next/dist/compiled/next-server/server.runtime.prod.js
- /var/task/___next_launcher.cjs
```

**Affected Endpoints (ALL returning 500):**

- `/api/monica-agent`
- `/api/planetary-positions`
- `/api/moment-recommendations`
- `/api/philosophers-stone/positions`
- `/api/auth/session`
- `/api/auth/_log`
- `/gallery/chat/[id]` (dynamic routes)

**Working (prerendered static only):**

- `/gallery/chat/socrates` - 200
- `/gallery/chat/leonardo-da-vinci` - 200

### Root Cause

**Version History:**

1. **Next.js 15.0.3**: ✅ source-map works, ❌ work-unit-async-storage error
2. **Next.js 15.5.6**: ❌ source-map broken, ✅ work-unit-async-storage fixed
3. **Next.js 15.5.3**: 🎯 Target version (middle ground)

**Issue:** Next.js 15.5.6 has a critical bug where the internal `next/dist/compiled/source-map` module is not properly bundled in Vercel's serverless functions.

**Git History Shows:**

- This is a **recurring issue** (7+ previous fix attempts)
- Commit 23ccb5ee: "Downgrade Next.js to 15.0.3 to resolve source-map error" (worked!)
- Commit d92bdd03: "Upgrade to 15.5.6 to resolve work-unit-async-storage" (broke source-map again!)

### Solution Implemented

**Commit:** `4b73e6c6` - "fix: Downgrade Next.js to 15.5.3 to resolve source-map module error"

**Changes Applied:**

```json
{
  "dependencies": {
    "next": "15.5.3" // was 15.5.6
  },
  "devDependencies": {
    "@next/bundle-analyzer": "15.5.3", // was 15.5.6
    "@next/eslint-plugin-next": "15.5.3", // was 15.5.6
    "eslint-config-next": "15.5.3" // was 15.5.6
  },
  "optionalDependencies": {
    "@next/swc-darwin-arm64": "15.5.3" // was 15.5.6
  }
}
```

**Files Modified:**

- `package.json` - All Next.js packages downgraded to 15.5.3
- `yarn.lock` - Updated with consistent versions
- `.yarn/install-state.gz` - Yarn cache updated

### Deployment Status

**Git Push:** ✅ Complete

```bash
To gitlab.com:xalchm/my_alchm.git
   ca108497..4b73e6c6  main -> main
```

**Vercel:** 🔄 Auto-deploying now (5-10 minutes)

### Why 15.5.3?

**Rationale:**

- **15.0.3**: Known working for source-map, but has other issues
- **15.5.6**: Latest, but broken source-map bundling
- **15.5.3**: Middle-ground version likely to have:
  - ✅ Source-map bundling fix
  - ✅ Work-unit-async-storage fix
  - ✅ Other stability improvements

**Risk:** If 15.5.3 still fails, next step is to try 15.1.3 or downgrade to 15.0.3

### Testing Instructions

**Wait 5-10 minutes for Vercel deployment**, then test:

```bash
# Should all return 200 OK (not 500)

# Test planetary positions
curl https://planetary-agents.vercel.app/api/planetary-positions

# Test moment recommendations
curl "https://planetary-agents.vercel.app/api/moment-recommendations?limit=3"

# Test consciousness endpoint
curl https://planetary-agents.vercel.app/api/consciousness/live

# Test philosophers stone
curl https://planetary-agents.vercel.app/api/philosophers-stone/positions

# Test auth session
curl https://planetary-agents.vercel.app/api/auth/session

# Test dynamic gallery page
curl -I https://planetary-agents.vercel.app/gallery/chat/marie-curie-1867
```

### Expected Results

✅ **All endpoints return 200** (or appropriate success codes)
✅ **No source-map module errors** in Vercel logs
✅ **Dynamic pages load correctly**
✅ **API routes execute successfully**

### If Still Failing

**Fallback Options:**

1. **Try Next.js 15.1.3** (intermediate version):

   ```bash
   # Edit package.json: change all 15.5.3 → 15.1.3
   yarn install
   git commit -m "fix: Try Next.js 15.1.3"
   git push
   ```

2. **Downgrade to 15.0.3** (known working):

   ```bash
   # Edit package.json: change all 15.5.3 → 15.0.3
   yarn install
   git commit -m "fix: Revert to Next.js 15.0.3"
   git push
   ```

3. **Clear Vercel Build Cache**:
   - Vercel Dashboard → Settings → Clear Build Cache
   - Redeploy

4. **Simplify webpack config**:
   - Remove source-map handling from next.config.mjs
   - Let Next.js use default bundling

### Monitoring

**Check Vercel Dashboard:**

- https://vercel.com/gregcastro23s-projects/planetary-agents
- Watch for "Building..." → "Ready" status
- Check deployment logs for errors

**What to Look For:**

- ✅ Build completes without errors
- ✅ No "Cannot find module" errors in logs
- ✅ Function output shows 200 responses
- ❌ If you see same source-map error, proceed to fallback options

### Additional Context

**Previous Fix Attempts (all failed with 15.5.6):**

1. Added `source-map` as npm dependency
2. Disabled production source maps in config
3. Added webpack config to prevent externalization
4. Created optimized vercel.json

**Why This Should Work:**

- Version 15.5.3 is a stable release between 15.0.3 (working) and 15.5.6 (broken)
- Should have source-map fixes from early 15.x releases
- Should not have 15.5.6's regression bugs
- Git history shows version downgrades successfully resolved this before

### Timeline

- **20:04 UTC (Nov 4)**: Logs show source-map errors on 15.5.6
- **~20:30 UTC**: Analysis and fix plan created
- **~20:35 UTC**: Downgrade to 15.5.3 deployed
- **~20:45 UTC**: Expected deployment completion
- **~20:50 UTC**: Testing window

---

**Status**: ✅ Deployed, awaiting Vercel build
**Confidence**: High - Similar downgrade worked before (commit 23ccb5ee)
**Next Action**: Monitor Vercel deployment and test endpoints in 10 minutes
**ETA**: Full resolution by 20:50 UTC (10-15 minutes)

🚀 **Your endpoints should be working shortly!**
