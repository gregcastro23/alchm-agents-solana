# GitLab CI/CD Pipeline Fix

## Problem

GitLab CI jobs are failing with:

```
/bin/sh: cd: line 185: can't cd to backend: No such file or directory
ERROR: Job failed: exit code 2
```

## Root Cause

The `backend` directory exists locally but GitLab CI runners cannot find it. This could be due to:

1. **Git submodule issues** - backend might be a submodule not properly initialized
2. **GitLab repository settings** - partial clone or shallow clone settings
3. **Path issues** - CI running in unexpected directory
4. **Build context** - Docker or container isolation issues

## Solution Applied

### 1. Added Debugging to GitLab CI

Updated `.gitlab-ci.yml` to include diagnostic output:

```yaml
backend:install:
  stage: test
  script:
    - echo "Current directory:" && pwd
    - echo "Listing root directory:" && ls -la
    - echo "Checking if backend exists:" && test -d backend && echo "✓ backend directory found" || echo "✗ backend directory NOT found"
    - cd backend
    - yarn install --immutable || yarn install
```

### 2. Verify Backend Directory is Tracked

```bash
# Check if backend is in git
git ls-files backend/ | head -10

# Expected output: backend files should be listed
backend/.dockerignore
backend/.gitignore
backend/package.json
backend/tsconfig.json
backend/src/index.ts
...
```

### 3. Alternative: Use Monorepo Structure

If the backend continues to fail, consider restructuring as a proper monorepo:

```bash
# Root package.json
{
  "name": "planetary-agents-monorepo",
  "workspaces": [
    ".",
    "backend"
  ]
}
```

### 4. GitLab CI: Skip Backend Jobs Temporarily

If you want to deploy frontend-only while fixing backend:

```yaml
backend:install:
  stage: test
  rules:
    - when: manual # Only run when manually triggered
  script:
    - cd backend
    - yarn install
```

## Next Steps

1. **Check GitLab Logs**: The debug output will show:
   - What directory the runner starts in
   - Whether the backend directory exists
   - What files are in the root directory

2. **Verify Git Configuration**:

   ```bash
   # Check for submodules
   cat .gitmodules

   # Check if backend is ignored
   git check-ignore backend
   ```

3. **Alternative Deployment Strategy**:

   Since you're using **Vercel for frontend** and **Neon for database**, consider:
   - Deploy backend separately (Render, Railway, Fly.io)
   - Or integrate backend into Next.js API routes
   - Or use GitLab CI only for frontend, manual backend deploy

## Current Status

### ✅ Working Locally

- Backend directory exists at `/Users/GregCastro/Desktop/planetary-agents/backend/`
- Has package.json, src/, and all source files
- Is tracked in git

### ❌ Failing in GitLab CI

- Runner cannot find backend directory
- Needs debugging output to diagnose

### 🔄 Neon Database

- ✅ Connection verified
- ✅ Schema synced
- ✅ Prisma Accelerate configured
- Ready for production use

## Recommended Immediate Action

### Option 1: Deploy Frontend Only (Fastest)

Disable backend jobs temporarily:

```yaml
# In .gitlab-ci.yml, comment out backend jobs
# backend:install:
# backend:build:
# backend:test:unit:
# backend:test:integration:
```

Then deploy to Vercel:

```bash
vercel --prod
```

### Option 2: Fix GitLab CI (Proper Solution)

1. Commit the updated .gitlab-ci.yml with debug output
2. Push to GitLab
3. Review pipeline logs to see what's happening
4. Adjust based on findings

### Option 3: Move Backend to Separate Repo

If backend is meant to be separate:

```bash
# Create new backend repo
cd backend
git init
git remote add origin https://gitlab.com/your-org/planetary-agents-backend.git
git add .
git commit -m "Initial backend commit"
git push -u origin main
```

## Files Modified

- `.gitlab-ci.yml` - Added debugging and path verification

## Environment Variables Needed in GitLab CI

If/when backend jobs work, these CI/CD variables are needed:

```bash
# Database
DATABASE_URL
POSTGRES_PRISMA_URL
POSTGRES_URL_NON_POOLING

# Redis (if using)
REDIS_URL

# API Keys
ANTHROPIC_API_KEY
OPENAI_API_KEY
```

---

**Created**: 2025-11-14
**Status**: Debugging in progress
**Priority**: Medium (frontend can deploy without backend)
