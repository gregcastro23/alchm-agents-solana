# GitLab Webhook Form Configuration

## Form Fields to Fill:

### Basic Settings

- **Name (optional)**: `Vercel Deploy Hook - Main Branch`
- **Description (optional)**: `Triggers Vercel production deployment on push to main branch`

### URL

```
https://api.vercel.com/v1/integrations/deploy/prj_47jKTcJvhdXzrf3YSTbbYu9SVRTf/jfRfGiZlr5
```

### Secret token

- **Leave empty** (Vercel deploy hooks don't require a secret token)

### Custom headers

- **Leave as is**: 0 custom headers configured

### Trigger Section

Select **ONLY** these triggers:

✅ **Push events**

- Select: "All branches" OR "Wildcard pattern" with `main`
- (Recommended: Use "Wildcard pattern" and enter `main` to only trigger on main branch)

❌ **Tag push events** - Uncheck
❌ **Comments** - Uncheck
❌ **Confidential comments** - Uncheck
❌ **Issue events** - Uncheck
❌ **Confidential issue events** - Uncheck
❌ **Merge request events** - Uncheck
❌ **Job events** - Uncheck
❌ **Pipeline events** - Uncheck
❌ **Wiki page events** - Uncheck
❌ **Deployment events** - Uncheck
❌ **Feature flag events** - Uncheck
❌ **Releases events** - Uncheck
❌ **Milestone events** - Uncheck
❌ **Emoji events** - Uncheck
❌ **Project or group access token events** - Uncheck
❌ **Vulnerability events** - Uncheck

### Custom webhook template

- **Leave empty** (not needed for Vercel)

### SSL verification

✅ **Enable SSL verification** - CHECK THIS BOX

---

## Summary - What to Enter:

1. **Name**: `Vercel Deploy Hook - Main Branch`
2. **URL**: `https://api.vercel.com/v1/integrations/deploy/prj_47jKTcJvhdXzrf3YSTbbYu9SVRTf/jfRfGiZlr5`
3. **Secret token**: (leave empty)
4. **Triggers**: ✅ Push events ONLY (select "Wildcard pattern" and enter `main`)
5. **SSL verification**: ✅ Enabled

Click "Add webhook" at the bottom!

---

## Note About Existing Webhooks

I see you already have 2 webhooks configured:

1. `https://api.render.com/hooks/gitlab` - For Render deployments
2. `https://api.vercel.com/v1/incoming/gitlab?accountId=...` - Old Vercel Git integration

The new webhook we're adding is different - it's a **deploy hook** specifically for the planetary-agents project, not the general Git integration.

You can keep all three webhooks active - they won't conflict.
