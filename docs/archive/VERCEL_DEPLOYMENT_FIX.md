# Vercel Deployment Fix - Source Map Error

## Problem

**Error**: `Cannot find module 'next/dist/compiled/source-map'`

**Cause**: Next.js version inconsistency (15.5.6 vs 15.5.3) causing broken build on Vercel

**Impact**: ALL API routes and pages returning 500 errors

## Solution Options

### Option 1: Force Clean Build (RECOMMENDED ✅)

This clears Vercel's cache and forces a fresh build.

**Steps**:

1. **Add vercel.json to force clean builds**:

```json
{
  "buildCommand": "yarn install --frozen-lockfile && next build",
  "cacheDirectories": []
}
```

2. **Clear Vercel build cache via dashboard**:
   - Go to Vercel dashboard → Your project → Settings
   - Scroll to "Deployment Protection"
   - Under "Advanced", find "Clear Build Cache"
   - Click "Clear Build Cache"

3. **Redeploy**:

```bash
git commit --allow-empty -m "chore: Force Vercel rebuild to fix source-map error"
git push origin main
```

### Option 2: Fix Version Consistency

**Update package.json** to make all Next.js versions match:

```json
{
  "dependencies": {
    "next": "15.5.6"
  },
  "optionalDependencies": {
    "@next/swc-darwin-arm64": "15.5.6" // Changed from 15.5.3
  }
}
```

Then:

```bash
yarn install
git add package.json yarn.lock
git commit -m "fix: Align Next.js SWC version to match Next.js 15.5.6"
git push origin main
```

### Option 3: Add Source Map Explicitly

If Options 1 & 2 don't work, add source-map as explicit dependency:

```bash
yarn add source-map
git add package.json yarn.lock
git commit -m "fix: Add source-map to fix Vercel build"
git push origin main
```

## Recommended Approach

**Do ALL THREE in order**:

1. ✅ Fix version consistency (Option 2)
2. ✅ Add explicit source-map (Option 3)
3. ✅ Force clean build (Option 1)

This ensures maximum compatibility.

## Verification

After deployment, test these endpoints:

```bash
# Should return 200, not 500
curl https://planetary-agents.vercel.app/api/planetary-positions

# Should return 200
curl https://planetary-agents.vercel.app/api/moment-recommendations?limit=3

# Should return 200
curl https://planetary-agents.vercel.app/api/consciousness/live
```

## Vercel Build Settings

Ensure your Vercel project has these settings:

**Build & Development Settings**:

- Framework Preset: Next.js
- Build Command: `next build` (default)
- Output Directory: `.next` (default)
- Install Command: `yarn install` (default)

**Node.js Version**:

- Set to `20.x` (recommended for Next.js 15)

**Environment Variables** (set these in Vercel dashboard):

```bash
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
NEXTAUTH_URL=https://your-domain.vercel.app
```

## Alternative: Downgrade Next.js

If the issue persists, consider downgrading to the stable version:

```bash
yarn add next@15.0.3
yarn add -D @next/eslint-plugin-next@15.0.3 eslint-config-next@15.0.3 @next/bundle-analyzer@15.0.3
```

Your commit history shows 15.0.3 was stable:

```
23ccb5ee - fix: Downgrade Next.js to 15.0.3 to resolve Vercel source-map error
```

## Root Cause Analysis

1. **Next.js 15.5.6 upgrade** (commit d92bdd03) fixed work-unit-async-storage error
2. But introduced source-map dependency issue on Vercel
3. Local builds work fine because source-map is available in local node_modules
4. Vercel's serverless build is missing this internal Next.js module

## Additional Resources

- Next.js Vercel Deployment: https://nextjs.org/docs/deployment
- Vercel Build Configuration: https://vercel.com/docs/concepts/projects/build-configuration
- Clear Build Cache: https://vercel.com/docs/concepts/deployments/builds#clearing-the-cache

---

**Status**: Ready to implement
**Priority**: CRITICAL - Blocking all production functionality
**Estimated Fix Time**: 5-10 minutes
