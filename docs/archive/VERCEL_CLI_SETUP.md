# Vercel CLI Setup for GitLab CI/CD

Complete guide to set up Vercel CLI authentication for automated deployments from GitLab CI.

## Overview

This project uses Vercel CLI in GitLab CI pipelines for:

- **Production deployments** (automatic on `main` branch)
- **Preview deployments** (manual for feature branches)

## Prerequisites

- Vercel account with access to the project
- GitLab repository access with CI/CD permissions
- Project already exists on Vercel

## Project Information

- **Project Name**: `planetary-agents`
- **Vercel Project ID**: `prj_47jKTcJvhdXzrf3YSTbbYu9SVRTf`
- **Vercel Org/Team ID**: `team_eVYHTIN1tCXo7sPrkzqJbLzO`
- **Production URL**: https://planetary-agents.vercel.app

## Step 1: Generate Vercel Access Token

### Option A: Personal Access Token (Recommended for Teams)

1. **Go to Vercel Account Settings**
   - Visit: https://vercel.com/account/tokens
   - Or: Dashboard → Settings → Tokens

2. **Create New Token**
   - Click "Create Token"
   - **Token Name**: `GitLab CI - Planetary Agents` (or similar)
   - **Scope**: Select your team (`team_eVYHTIN1tCXo7sPrkzqJbLzO`)
   - **Expiration**: Choose based on security policy (90 days recommended)
   - Click "Create"

3. **Copy Token Immediately**
   - ⚠️ **IMPORTANT**: Copy the token NOW - you won't see it again!
   - Format: `vercel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Store it securely (you'll add it to GitLab in the next step)

### Option B: Project-Level Token (Alternative)

1. Go to Project Settings: https://vercel.com/team_eVYHTIN1tCXo7sPrkzqJbLzO/planetary-agents/settings/tokens
2. Create a project-specific token (more restrictive)

## Step 2: Add Token to GitLab CI/CD Variables

### Add VERCEL_TOKEN Variable

1. **Navigate to GitLab CI/CD Settings**
   - Go to: https://gitlab.com/xalchm/planetary_agents/-/settings/ci_cd
   - Or: Your Project → Settings → CI/CD → Variables

2. **Expand Variables Section**
   - Click "Expand" next to "Variables"

3. **Add New Variable**
   - Click "Add variable"
   - **Key**: `VERCEL_TOKEN`
   - **Value**: Paste your Vercel token (from Step 1)
   - **Type**: Variable
   - **Environment scope**: All (default)
   - **Protect variable**: ✅ **CHECKED** (only available in protected branches)
   - **Mask variable**: ✅ **CHECKED** (hide in job logs)
   - **Expand variable reference**: ❌ Unchecked
   - Click "Add variable"

### Verify Variable is Added

You should see:

```
Key: VERCEL_TOKEN
Value: ********* (masked)
Protected: Yes
Masked: Yes
```

## Step 3: Verify GitLab CI Configuration

The `.gitlab-ci.yml` already includes the Vercel CLI deployment jobs:

### Production Deployment Job

```yaml
deploy_to_vercel:
  stage: deploy
  image: node:20-alpine
  variables:
    VERCEL_ORG_ID: 'team_eVYHTIN1tCXo7sPrkzqJbLzO'
    VERCEL_PROJECT_ID: 'prj_47jKTcJvhdXzrf3YSTbbYu9SVRTf'
  script:
    - vercel deploy --token=$VERCEL_TOKEN --prod --yes
  only:
    - main
```

### Preview Deployment Job

```yaml
deploy_to_vercel_preview:
  stage: deploy
  script:
    - vercel deploy --token=$VERCEL_TOKEN --yes
  except:
    - main
  when: manual
```

## Step 4: Test the Setup

### Test Production Deployment

1. **Push to main branch**:

   ```bash
   git checkout main
   git commit --allow-empty -m "test: Verify Vercel CLI deployment"
   git push origin main
   ```

2. **Monitor Pipeline**:
   - Go to: https://gitlab.com/xalchm/planetary_agents/-/pipelines
   - Watch the `deploy_to_vercel` job
   - Check for successful deployment message

3. **Verify Deployment**:
   - Job should output: `✅ Deployment successful!`
   - Deployment URL should be shown in logs
   - Visit https://planetary-agents.vercel.app to verify

### Test Preview Deployment (Optional)

1. **Create a feature branch**:

   ```bash
   git checkout -b feature/test-preview
   git commit --allow-empty -m "test: Preview deployment"
   git push origin feature/test-preview
   ```

2. **Trigger Manual Deployment**:
   - Go to pipeline for the feature branch
   - Find `deploy_to_vercel_preview` job
   - Click "Play" button to trigger manually

3. **Get Preview URL**:
   - Check job logs for preview URL
   - Or download artifact `preview-url.txt`

## Troubleshooting

### Error: "Authentication required"

**Cause**: `VERCEL_TOKEN` not set or incorrect

**Solution**:

1. Verify token is added in GitLab CI/CD Variables
2. Ensure token is not expired
3. Check token has correct scope/permissions

### Error: "Project not found"

**Cause**: Wrong project ID or org ID

**Solution**:

1. Verify `.vercel/project.json` has correct IDs:
   ```json
   {
     "projectId": "prj_47jKTcJvhdXzrf3YSTbbYu9SVRTf",
     "orgId": "team_eVYHTIN1tCXo7sPrkzqJbLzO"
   }
   ```
2. Ensure token has access to the team

### Error: "Forbidden"

**Cause**: Token doesn't have permission to deploy

**Solution**:

1. Regenerate token with correct team scope
2. Ensure you're a member of the Vercel team
3. Check project permissions

### Pipeline Hangs or Times Out

**Cause**: Vercel CLI waiting for input

**Solution**:

- Ensure `--yes` flag is used (already included)
- Check `.vercel/project.json` exists and is valid
- Verify all required flags are passed

## Security Best Practices

### Token Security

- ✅ Use masked and protected variables in GitLab
- ✅ Set token expiration (rotate regularly)
- ✅ Use team-scoped tokens (not personal)
- ✅ Revoke tokens immediately if compromised
- ❌ Never commit tokens to Git
- ❌ Never log tokens in CI output

### Access Control

- Limit token to specific teams/projects
- Use protected branches for production deployments
- Require approval for preview deployments (optional)

## Benefits of Vercel CLI vs Deploy Hooks

| Feature                     | Deploy Hook   | Vercel CLI       |
| --------------------------- | ------------- | ---------------- |
| Deployment control          | Limited       | Full             |
| Deployment visibility       | External      | In GitLab logs   |
| Preview deployments         | No            | Yes              |
| Deployment URL in artifacts | No            | Yes              |
| Build configuration         | Via Vercel UI | Via CLI flags    |
| Debugging                   | Difficult     | Easy (full logs) |
| Programmatic control        | No            | Yes              |

## Additional Resources

- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [GitLab CI/CD Variables](https://docs.gitlab.com/ee/ci/variables/)
- [Vercel Tokens](https://vercel.com/docs/concepts/personal-accounts/overview#tokens)

## Support

If you encounter issues:

1. Check GitLab CI job logs for error details
2. Verify Vercel token is valid and not expired
3. Ensure project IDs match `.vercel/project.json`
4. Check Vercel deployment logs in dashboard

---

**Last Updated**: 2025-11-14
**Status**: ✅ Active
**Maintainer**: Planetary Agents Team
