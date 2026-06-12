# Webhook Not Triggering on Push - Troubleshooting

## Problem

The deploy hook URL works (manual curl succeeded), but GitLab pushes aren't triggering deployments automatically.

## Evidence

1. ✅ Manual curl test: Created job `ix6gjjfmNO4K2DiNynGm` - **SUCCESS**
2. ✅ Commit pushed: `8b9d18c6` - **SUCCESS**
3. ❌ No new deployment in Vercel dashboard - **PROBLEM**
4. ❓ GitLab webhook "Recent events" status - **NEED TO CHECK**

## Most Likely Causes

### 1. Webhook Branch Filter Misconfigured

**Issue:** Webhook is set to wrong branch or branch pattern doesn't match

**Check:**

- Go to: https://gitlab.com/xalchm/my_alchm/-/settings/webhooks
- Click "Edit" on "Vercel Deploy Hook - Main Branch"
- Under "Push events", verify:
  - If using "Wildcard pattern": Pattern should be exactly `main`
  - If using "All branches": Should work for any branch
  - If using "Regular expression": Might be wrong regex

**Fix:** Change to "All branches" for testing to rule out branch filtering

### 2. Webhook Not Enabled for Push Events

**Issue:** "Push events" trigger might be unchecked

**Check:**

- In webhook edit page
- Ensure "Push events" checkbox is ✅ checked

### 3. Webhook Secret Token Issue

**Issue:** If a secret token is set, Vercel deploy hooks might reject it

**Fix:** Ensure "Secret token" field is **completely empty**

### 4. Webhook URL Has Typo

**Issue:** URL might have been mistyped when adding to GitLab

**Verify:** The URL should be exactly:

```
https://api.vercel.com/v1/integrations/deploy/prj_47jKTcJvhdXzrf3YSTbbYu9SVRTf/jfRfGiZlr5
```

### 5. GitLab Not Firing Webhook at All

**Issue:** Webhook configuration prevents it from firing

**Check "Recent events":**

- Go to webhook details page
- Look for "Recent events" or "Recent deliveries" section
- Should show events with timestamps
- If empty = webhook never fired
- If shows errors = webhook fired but failed

## Diagnostic Steps

### Step 1: Check Recent Events in GitLab

1. Go to: https://gitlab.com/xalchm/my_alchm/-/settings/webhooks
2. Find "Vercel Deploy Hook - Main Branch"
3. Click on the webhook name (not Edit)
4. Scroll to "Recent events" section

**What to look for:**

- ✅ Events present with HTTP 200 = Working!
- ❌ Events present with HTTP 4xx/5xx = Error in delivery
- ⚠️ No events at all = Webhook not firing

### Step 2: Test Push Event Manually

1. In webhook details page
2. Click "Test" dropdown
3. Select "Push events"
4. Should see success message
5. Check Vercel dashboard for new deployment

### Step 3: Verify Webhook Configuration

Edit the webhook and ensure:

- ✅ URL is correct
- ✅ Secret token is empty
- ✅ Push events is checked
- ✅ Branch filter is "All branches" OR "main"
- ✅ SSL verification is enabled

## Alternative Solution: Use GitLab CI/CD to Trigger Deploy Hook

If the webhook continues not working, we can use GitLab CI/CD pipeline to trigger deployments:

**Add to `.gitlab-ci.yml`:**

```yaml
deploy:vercel:
  stage: deploy
  only:
    - main
  script:
    - curl -X POST "$VERCEL_DEPLOY_HOOK"
  variables:
    VERCEL_DEPLOY_HOOK: 'https://api.vercel.com/v1/integrations/deploy/prj_47jKTcJvhdXzrf3YSTbbYu9SVRTf/jfRfGiZlr5'
```

This would trigger Vercel deployment as part of the GitLab CI/CD pipeline.

## Expected Behavior Once Fixed

**After push:**

1. GitLab receives push to `main`
2. GitLab fires webhook to Vercel deploy hook URL
3. Webhook appears in "Recent events" with HTTP 200
4. Vercel creates deployment job
5. Deployment appears in Vercel dashboard within 30 seconds
6. Build completes in 3-5 minutes

## Next Actions

1. **Check "Recent events" in GitLab webhook** - This will tell us if webhook is firing
2. **If no events**: Webhook not triggering - need to fix configuration
3. **If events with errors**: Webhook triggering but failing - need to fix URL/settings
4. **If events with HTTP 200**: Webhook working - deployment should appear soon

---

## Quick Fix to Try Now

**Edit the webhook and change to "All branches":**

1. Go to webhook settings
2. Click "Edit" on Vercel deploy hook
3. Under "Push events":
   - Change from "Wildcard pattern" to "All branches"
4. Save webhook
5. Push a test commit

This eliminates branch filtering as a potential issue.
