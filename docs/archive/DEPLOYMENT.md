# Deployment Checklist for Vercel

## Overview

This document provides a comprehensive checklist for deploying Planetary Agents to Vercel. Follow these steps carefully to ensure a successful deployment.

## Before Pushing Code

- [ ] `yarn build` succeeds locally without errors
- [ ] All TypeScript errors resolved (or documented with TODO comments)
- [ ] No console errors during local testing
- [ ] `.env.local` has all required variables
- [ ] Test all critical API routes locally:
  - [ ] `/api/planetary-positions`
  - [ ] `/api/philosophers-stone/positions`
  - [ ] `/api/moment-recommendations`
  - [ ] `/api/auth/session`
  - [ ] `/api/auth/providers`

## Vercel Dashboard Configuration

### General Settings

- [ ] **Node.js Version** set to **20.x**
  - Navigate to: Project Settings → General → Node.js Version
  - Select: `20.x` from dropdown
  - Click: Save

- [ ] **Build Command**: `yarn build` (should be auto-detected from vercel.json)
- [ ] **Install Command**: `yarn install` (should be auto-detected from vercel.json)
- [ ] **Output Directory**: `.next` (auto-detected for Next.js)

### Environment Variables

Add these in: **Project Settings → Environment Variables**

#### CRITICAL (Required for Deployment)

Select environments: ✅ Production ✅ Preview ✅ Development

- [ ] `NEXTAUTH_SECRET`
  - Generate with: `openssl rand -base64 32`
  - **IMPORTANT**: Use a DIFFERENT value for production than development

- [ ] `ANTHROPIC_API_KEY`
  - Get from: https://console.anthropic.com/

- [ ] `OPENAI_API_KEY`
  - Get from: https://platform.openai.com/api-keys

- [ ] `DATABASE_URL`
  - Format: `postgresql://username:password@host:5432/database?sslmode=require`
  - Recommended providers: Neon, Supabase, PlanetScale

#### OPTIONAL (Recommended for Production)

- [ ] `REDIS_URL` - For caching and better performance
  - Format: `redis://username:password@host:6379`
  - App works without this, but performance is enhanced with it

- [ ] `SENTRY_DSN` - For error tracking
  - Get from: https://sentry.io/

- [ ] `GALILEO_API_KEY` - For observability
  - Set `GALILEO_LOG_ENABLED=true` if using

#### After Adding Variables

⚠️ **CRITICAL**: After adding/modifying environment variables, you MUST:

- [ ] Trigger a new deployment (click "Redeploy" button)
- [ ] Environment variables only take effect after redeployment

### Deployment Protection

- [ ] **Deployment Protection** is DISABLED (or set to "Vercel Authentication OFF")
  - Navigate to: Project Settings → Deployment Protection
  - If enabled with HTML authentication, it will break API routes
  - Only use if you understand the implications

### OAuth Provider Configuration

If using authentication with OAuth providers (Google, GitHub, etc.):

#### Google Cloud Console

- [ ] **Authorized JavaScript origins**: `https://planetary-agents.vercel.app`
- [ ] **Authorized redirect URIs**: `https://planetary-agents.vercel.app/api/auth/callback/google`

#### GitHub OAuth App

- [ ] **Homepage URL**: `https://planetary-agents.vercel.app`
- [ ] **Authorization callback URL**: `https://planetary-agents.vercel.app/api/auth/callback/github`

## After Deployment

### Verify Successful Deployment

- [ ] Deployment status shows **"Ready"** (green checkmark)
- [ ] Visit site - no white screen or React errors
- [ ] Check browser console (F12) - no 500 errors
- [ ] Check Function Logs - no errors
  - Navigate to: Deployments → [Latest Deployment] → Functions → View Logs

### Test API Routes

Test these URLs return **JSON** (not HTML):

```bash
# Test auth providers (should return JSON provider config)
curl https://planetary-agents.vercel.app/api/auth/providers

# Test session (should return JSON session or null)
curl https://planetary-agents.vercel.app/api/auth/session

# Test planetary positions (should return JSON data)
curl https://planetary-agents.vercel.app/api/planetary-positions

# Test philosopher's stone (should return JSON data)
curl https://planetary-agents.vercel.app/api/philosophers-stone/positions

# Test moment recommendations (should return JSON data)
curl "https://planetary-agents.vercel.app/api/moment-recommendations?limit=6"
```

**Expected**: All should return valid JSON
**If HTML returned**: Check environment variables and function logs for errors

### Monitor for Errors

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Follow logs in real-time
vercel logs https://planetary-agents.vercel.app --follow
```

Look for:

- [ ] No missing environment variable errors
- [ ] No database connection errors
- [ ] No 500/405 errors in function logs
- [ ] No authentication errors

### Test User Flows

- [ ] Homepage loads correctly
- [ ] Navigation works
- [ ] Gallery page loads agents
- [ ] Can initiate chat with agent
- [ ] Chat responses working
- [ ] No client-side errors in console

## Troubleshooting

### Build Fails

**Symptom**: Deployment fails during build phase

**Check**:

1. Node version is 20.x in Vercel dashboard
2. `yarn.lock` is committed (not `package-lock.json`)
3. Build logs for specific error messages
4. TypeScript errors locally: `yarn typecheck`

**Solution**:

```bash
# Fix locally first
yarn build

# If build succeeds locally, check Vercel build logs
# Common issues: missing environment variables, TypeScript errors
```

### 500 Errors on API Routes

**Symptom**: API routes return 500 Internal Server Error

**Check**:

1. Function Logs in Vercel dashboard
2. All required environment variables are set
3. Database connection is working
4. No CORS issues

**Solution**:

```bash
# Check function logs for actual error
# Vercel Dashboard → Deployments → Functions → View Logs

# Common causes:
# - Missing ANTHROPIC_API_KEY or OPENAI_API_KEY
# - Invalid DATABASE_URL
# - Database not accessible from Vercel's IP range
```

### NextAuth CLIENT_FETCH_ERROR

**Symptom**: `SyntaxError: Unexpected token '<', "<!DOCTYPE"... is not valid JSON`

**Check**:

1. `NEXTAUTH_SECRET` is set in environment variables
2. NextAuth file is at: `app/api/auth/[...nextauth]/route.ts`
3. File correctly exports: `export { handler as GET, handler as POST }`
4. OAuth redirect URIs match deployment URL

**Solution**:

```bash
# Generate new secret
openssl rand -base64 32

# Add to Vercel environment variables
# Redeploy after adding
```

### 405 Method Not Allowed

**Symptom**: API route returns 405 error

**Check**:

1. Route file exports the correct HTTP method (GET, POST, etc.)
2. For App Router: Named exports like `export async function GET()`
3. No `output: 'export'` in `next.config.js`

**Solution**:

- Verify route file structure matches App Router pattern
- Check if route should support multiple methods

### HTML Instead of JSON from API

**Symptom**: API routes return HTML error pages

**Check**:

1. Deployment Protection is disabled
2. No authentication middleware catching API routes
3. Route file is correctly structured

**Solution**:

- Disable Deployment Protection
- Verify API route structure
- Check for middleware interfering with API routes

### Database Connection Errors

**Symptom**: `P1001: Can't reach database server`

**Check**:

1. DATABASE_URL is correct
2. Database allows connections from Vercel IPs
3. Connection string includes `?sslmode=require` for PostgreSQL
4. Database service is running

**Solution**:

- Verify connection string format
- Check database provider's firewall settings
- Test connection from a different tool

### Missing Environment Variables

**Symptom**: Errors mentioning undefined environment variables

**Check**:

1. All required variables from `.env.example` are in Vercel
2. Variables are set for all environments (Production, Preview, Development)
3. Deployment was triggered AFTER adding variables

**Solution**:

- Add missing variables in Vercel dashboard
- **MUST** redeploy after adding variables
- Use `.env.example` as reference

## Performance Optimization

### After Successful Deployment

- [ ] Enable Redis caching (add `REDIS_URL`)
- [ ] Monitor function execution times
- [ ] Check for slow API endpoints
- [ ] Review Vercel Analytics

### Recommended Monitoring

- [ ] Set up Sentry for error tracking
- [ ] Enable Vercel Analytics
- [ ] Monitor function logs regularly
- [ ] Set up uptime monitoring (e.g., UptimeRobot)

## Security Checklist

- [ ] All API keys are in environment variables (not hardcoded)
- [ ] `NEXTAUTH_SECRET` is unique and secure
- [ ] Database credentials are not exposed
- [ ] CORS is properly configured
- [ ] Rate limiting considered for public endpoints
- [ ] OAuth redirect URIs are exact matches

## Deployment Success Criteria

✅ **Deployment is successful when:**

1. Build completes without errors
2. All API routes return JSON (not HTML)
3. No 500 errors in function logs
4. Authentication flows work
5. Database queries succeed
6. Chat functionality works
7. No client-side console errors

## Files Modified for Deployment

This deployment fix modified:

- `package.json` - Removed platform-specific optionalDependencies, updated Node version
- `yarn.lock` - Regenerated without platform-specific binaries
- `vercel.json` - Simplified build command
- `.env.example` - Comprehensive environment variable documentation
- All API route files - Verified proper structure and error handling

## Deployment URL

Production: https://planetary-agents.vercel.app/

## Support

If issues persist after following this checklist:

1. Check Vercel function logs for specific errors
2. Review `.env.example` for missing required variables
3. Verify database connectivity
4. Check OAuth provider configuration
5. Review recent code changes

## Status: READY FOR DEPLOYMENT ✅

This codebase is configured and ready for deployment to Vercel.
