# Deploy Hook Setup Guide

## Issue

GitLab pushes are not automatically triggering Vercel deployments. The Git integration shows "No Active Branches" and deployments are not appearing in the Vercel dashboard.

## Solution: Create Deploy Hook + GitLab Webhook

### Step 1: Create Vercel Deploy Hook

1. Go to https://vercel.com/gregcastro23s-projects/planetary-agents/settings/git
2. Scroll to "Deploy Hooks" section
3. Click "Create Hook"
4. Configure:
   - **Name**: `GitLab Main Branch`
   - **Branch**: `main`
5. Click "Create Hook"
6. **Copy the generated hook URL** (looks like: `https://api.vercel.com/v1/integrations/deploy/prj_xxx/yyy`)

### Step 2: Add Webhook to GitLab

1. Go to your GitLab repository: https://gitlab.com/xalchm/my_alchm
2. Navigate to: **Settings** → **Webhooks**
3. Click "Add new webhook"
4. Configure:
   - **URL**: Paste the Vercel deploy hook URL from Step 1
   - **Secret Token**: Leave empty (not required for deploy hooks)
   - **Trigger**: Check "Push events"
   - **Branch filter**: `main` (or leave empty for all branches)
   - **SSL verification**: ✅ Enable SSL verification
5. Click "Add webhook"

### Step 3: Test the Webhook

After adding the webhook, you can test it:

**Option A: Test from GitLab UI**

1. In GitLab webhook settings, click "Test" → "Push events"
2. Should trigger a Vercel deployment
3. Check Vercel dashboard for new deployment

**Option B: Test with a commit**

```bash
# Make a trivial change
echo "" >> DEPLOY_HOOK_SETUP.md
git add DEPLOY_HOOK_SETUP.md
git commit -m "test: Verify deploy hook integration"
git push origin main
```

Watch for:

- GitLab webhook shows successful delivery (green checkmark)
- Vercel dashboard shows new deployment starting
- Deployment appears in "Deployments" tab

### Step 4: Verify Deployment

After pushing, check:

1. **GitLab**: Settings → Webhooks → Recent Deliveries
   - Should show HTTP 200 response
2. **Vercel**: Deployments tab
   - New deployment should appear with your latest commit
   - Status should progress: Queued → Building → Ready

## Deploy Hook vs Git Integration

**Deploy Hook (Webhook)**:

- ✅ Simple and reliable
- ✅ Works with any Git provider
- ✅ No OAuth permissions needed
- ✅ Easy to debug
- ❌ Doesn't show Git info in dashboard
- ❌ Manual webhook configuration

**Git Integration (OAuth)**:

- ✅ Shows branch info and commit details
- ✅ Auto-configures webhooks
- ✅ Better dashboard UX
- ❌ Requires OAuth permissions
- ❌ Can disconnect unexpectedly
- ❌ More complex to troubleshoot

**Recommendation**: Use deploy hooks for GitLab. They're more reliable than the native Git integration for non-GitHub providers.

## Webhook Payload

When GitLab sends a push event, Vercel receives:

```json
{
  "ref": "refs/heads/main",
  "commits": [...],
  "repository": {
    "url": "https://gitlab.com/xalchm/my_alchm.git"
  }
}
```

Vercel extracts the branch name and triggers a deployment.

## Troubleshooting

### Webhook Not Firing

1. Check GitLab webhook "Recent Deliveries"
2. Look for error messages or failed deliveries
3. Verify URL is exactly as provided by Vercel
4. Ensure "Push events" trigger is enabled

### Deployment Not Starting

1. Verify deploy hook URL is correct
2. Check if hook is enabled in Vercel settings
3. Verify branch name matches (`main`)
4. Check Vercel project isn't paused or suspended

### Build Failures

1. Check deployment logs in Vercel dashboard
2. Verify environment variables are set
3. Ensure `vercel.json` configuration is valid
4. Test local build: `yarn build`

## Alternative: Manual Deployment

If webhooks aren't working, you can manually deploy:

```bash
# Option 1: Trigger deploy hook via curl
curl -X POST 'YOUR_DEPLOY_HOOK_URL'

# Option 2: Use Vercel CLI (if it stops hanging)
vercel --prod --yes

# Option 3: Redeploy from Vercel dashboard
# Go to Deployments → Click "..." → Redeploy
```

## Expected Behavior After Setup

Once configured correctly:

1. **Developer pushes to GitLab** `main` branch
2. **GitLab fires webhook** to Vercel deploy hook URL
3. **Vercel receives webhook** and queues deployment
4. **Vercel builds project** using `vercel.json` configuration
5. **Deployment goes live** at planetary-agents.vercel.app
6. **Developer receives notification** (if enabled)

**Deployment time**: 3-5 minutes from push to live

## Security Notes

- Deploy hook URLs are secret - don't commit them to Git
- Anyone with the URL can trigger deployments
- Consider using GitLab CI/CD secrets for the URL
- Monitor webhook deliveries for unauthorized access

## Next Steps After Setup

1. ✅ Create deploy hook in Vercel
2. ✅ Add webhook to GitLab
3. ✅ Test with a commit
4. ✅ Verify deployment appears in dashboard
5. ✅ Document the hook URL in a secure location (password manager, not in Git)
6. ✅ Remove the old/broken Git integration if present

## Current Deployment Status

- **Latest Commit**: 526289fe (docs: Add agent enhancement context)
- **Deployed Commit**: 4d28411 (older commit)
- **Needs Redeployment**: Yes, with deploy hook

Once the deploy hook is set up, push commit 526289fe or trigger the hook manually to get the latest version live.
