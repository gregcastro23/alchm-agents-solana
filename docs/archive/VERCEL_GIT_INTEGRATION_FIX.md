# Vercel Git Integration Fix Guide

## Issue Identified

**Root Cause**: Vercel dashboard shows "No Active Branches" and "Commit using our Git connections" - indicating the GitLab integration is disconnected.

## Why CLI Deployments Fail

The Vercel CLI gets stuck at "Deploying gregcastro23s-projects/planetary-agents" because:

1. The project link exists locally (`vercel link` succeeds)
2. But the Git provider integration at the dashboard level is broken
3. CLI deployments require both local link AND active Git integration

## Solution: Reconnect Git Integration in Vercel Dashboard

### Step 1: Access Project Settings

1. Go to https://vercel.com/gregcastro23s-projects/planetary-agents
2. Click "Settings" tab
3. Navigate to "Git" section

### Step 2: Reconnect GitLab

You'll see one of these options:

**Option A: Reconnect Existing Integration**

- Look for "Git Provider: GitLab" section
- Click "Reconnect" or "Refresh Connection"
- Authorize Vercel to access your GitLab repositories
- Select the repository: `xalchm/my_alchm`
- Confirm the branch: `main`

**Option B: Add New Git Integration**
If no Git provider is shown:

1. Click "Connect Git Repository"
2. Select "GitLab"
3. Authorize Vercel access
4. Choose repository: `xalchm/my_alchm`
5. Select production branch: `main`
6. Save settings

### Step 3: Configure Build Settings (if needed)

Verify these settings match your `vercel.json`:

- **Framework Preset**: Next.js
- **Build Command**: `yarn build`
- **Install Command**: `yarn install`
- **Output Directory**: Leave default (Next.js auto-detects)
- **Root Directory**: `.` (root)

### Step 4: Trigger New Deployment

After reconnecting Git:

**Method 1: Push New Commit (Recommended)**

```bash
# Make a trivial change
echo "# Vercel Git Integration Fixed" >> VERCEL_GIT_INTEGRATION_FIX.md
git add VERCEL_GIT_INTEGRATION_FIX.md
git commit -m "chore: Fix Vercel Git integration"
git push origin main
```

This will automatically trigger Vercel deployment via webhook.

**Method 2: Manual Redeploy from Dashboard**

1. Go to "Deployments" tab
2. Find commit `526289fe` or latest commit
3. Click "⋯" menu → "Redeploy"
4. Confirm redeployment

### Step 5: Verify Active Branches

After reconnecting:

- Dashboard should show "Active Branches: main"
- New commits will auto-deploy
- Webhook status will show "Active"

## Alternative: Trigger Deployment Without Git Integration

If you want immediate deployment while fixing Git integration:

### Manual Upload via CLI (Alternative)

Since CLI is hanging, this won't work until Git integration is fixed.

### Import from GitHub (Alternative)

1. Mirror your GitLab repo to GitHub
2. Connect Vercel to GitHub instead
3. Deploy from GitHub

But **fixing the GitLab integration is the proper solution**.

## Expected Timeline

- Reconnecting Git: 2-3 minutes
- First deployment after reconnect: 3-5 minutes
- Future auto-deployments: 3-5 minutes per push

## Environment Variables

After reconnecting, verify these are set in Vercel dashboard → Settings → Environment Variables:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- Any other required variables from `.env.local`

## Testing After Fix

1. Push a test commit to `main` branch
2. Check Vercel dashboard for new deployment appearing
3. Verify deployment progresses through stages:
   - Queued
   - Building
   - Deploying
   - Ready
4. Test the deployed site at `planetary-agents.vercel.app`

## Current Code Status

✅ **Code is ready for deployment**:

- Commit: 526289fe
- Local build: Success
- GitLab CI/CD: Passing
- 52 agents fully enhanced
- All tests passing

Once Git integration is reconnected, deployment should succeed immediately.

## Contact Vercel Support (If Needed)

If reconnection doesn't work:

1. Go to https://vercel.com/help
2. Reference:
   - Project: planetary-agents
   - Account: gregcastro23
   - Issue: "Git integration disconnected - No Active Branches"
   - Last working deployment: 2 days ago
   - Recent changes: None to Vercel settings

## Summary

**Action Required**: Manually reconnect GitLab integration in Vercel dashboard → Settings → Git section. This is a UI operation that cannot be done via CLI.
