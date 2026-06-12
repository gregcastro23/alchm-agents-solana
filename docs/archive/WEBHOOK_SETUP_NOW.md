# ⚡ Quick Webhook Setup - Do This Now!

## Step 1: Add Webhook to GitLab (2 minutes)

**Go to:** https://gitlab.com/xalchm/my_alchm/-/settings/webhooks

**Click:** "Add new webhook"

**Fill in:**

- **URL:**
  ```
  https://api.vercel.com/v1/integrations/deploy/prj_47jKTcJvhdXzrf3YSTbbYu9SVRTf/jfRfGiZlr5
  ```
- **Secret token:** Leave empty
- **Trigger:** ☑ Push events (only this one)
- **Branch filter:** `main`
- **SSL verification:** ☑ Enable SSL verification

**Click:** "Add webhook"

## Step 2: Test the Webhook

After adding, you'll see the webhook in the list.

**Click:** "Test" button → Select "Push events"

**Expected result:**

- ✅ "Hook executed successfully: HTTP 200"
- A new deployment should appear in Vercel dashboard

## Step 3: Push the Commit

Once the webhook is added and tested, I'll push the commit:

```bash
git push origin main
```

This will trigger an automatic deployment via the webhook!

## What Happens Next

1. GitLab receives the push
2. GitLab fires the webhook to Vercel
3. Vercel receives webhook and starts deployment
4. Build runs (3-5 minutes)
5. New version goes live at planetary-agents.vercel.app

## Verify It's Working

After pushing, check:

**GitLab:**

- Settings → Webhooks → Recent Deliveries
- Should show HTTP 200 response

**Vercel:**

- https://vercel.com/gregcastro23s-projects/planetary-agents/deployments
- New deployment should appear with commit 8b9d18c6

---

## 🚨 Ready to Push?

Tell me when you've added the webhook to GitLab, and I'll push the commit to test it!

The commit is ready:

- Commit: 8b9d18c6
- Message: "docs: Add Vercel deployment troubleshooting and deploy hook setup"
- Files: 4 new deployment documentation files
