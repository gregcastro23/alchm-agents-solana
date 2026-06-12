# Planetary Agents - Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Create an account at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to a GitHub repository
3. **API Keys**: Obtain the required API keys

## Required Environment Variables

Set these in your Vercel project settings (Project Settings → Environment Variables):

### Required

```
NEXTAUTH_SECRET=your-secure-random-secret-here
NEXTAUTH_URL=https://your-project-name.vercel.app
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### Optional (for enhanced functionality)

```
DATABASE_URL=postgresql://username:password@host:port/database
SENDGRID_API_KEY=your-sendgrid-api-key
FEEDBACK_FROM_EMAIL=noreply@yourdomain.com
NEXT_PUBLIC_ADDITIVE_ONLY_ELEMENTS=false
```

## Deployment Steps

### 1. Connect Repository to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` or `yarn build`
   - **Output Directory**: `.next` (leave as default)

### 2. Set Environment Variables

In your Vercel project dashboard:

1. Go to Project Settings → Environment Variables
2. Add each environment variable listed above
3. Set the environment to "Production" for all variables

### 3. Configure Build Settings

In Project Settings → Build & Development Settings:

- **Node.js Version**: 20.x (or latest LTS)
- **Build Command**: `yarn build`
- **Install Command**: `yarn install --immutable`

### 4. Deploy

1. Click "Deploy" in Vercel
2. Wait for the build to complete
3. Your site will be available at `https://your-project-name.vercel.app`

## Post-Deployment Checks

After deployment, verify these features work:

### ✅ Core Functionality

- [ ] Homepage loads without errors
- [ ] Time Laboratory page accessible
- [ ] Planetary Agents view shows all 10 planets
- [ ] Group Chat button works

### ✅ API Endpoints

- [ ] `/api/moment-planetary-group-chat` returns planetary agents
- [ ] No more 500 errors in browser console

### ✅ Authentication (if using)

- [ ] NextAuth session management works
- [ ] No authentication-related errors

## Troubleshooting

### Build Failures

- Check that all environment variables are set
- Verify Node.js version compatibility
- Check build logs for specific errors

### Runtime Errors

- Verify API keys are valid and have proper permissions
- Check browser console for JavaScript errors
- Ensure database connection works (if using)

### API Timeouts

- Vercel has a 10-second execution limit for API routes
- Some astronomical calculations might need optimization

## Performance Optimization

For better performance on Vercel:

1. **Enable caching** for static assets
2. **Use Vercel Edge Functions** for API routes if needed
3. **Optimize bundle size** by lazy loading components
4. **Use Vercel's analytics** to monitor performance

## Custom Domain (Optional)

To use a custom domain:

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. Update `NEXTAUTH_URL` environment variable

## Monitoring

- Use Vercel's built-in analytics dashboard
- Monitor API usage and performance
- Set up error tracking if needed

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Verify environment variables are set correctly
3. Test locally first: `yarn build && yarn start`
4. Check GitHub repository for any CI/CD issues
