# Vercel Environment Variables Checklist

## Required for Production Build

### Database

- `DATABASE_URL` - PostgreSQL connection string with Prisma Accelerate

### Authentication

- `NEXTAUTH_URL` - Production URL (e.g., https://your-app.vercel.app)
- `NEXTAUTH_SECRET` - Secret for NextAuth.js session encryption

### AI APIs

- `OPENAI_API_KEY` - OpenAI API key for agent consciousness
- `ANTHROPIC_API_KEY` - Anthropic Claude API key (optional)

### Feature Flags

- `NEXT_PUBLIC_ADDITIVE_ONLY_ELEMENTS` - Elemental logic mode (true/false)

### Optional Backend Integration

- `NEXT_PUBLIC_BACKEND_URL` - Express.js backend URL (if using)
- `NEXT_PUBLIC_WEBSOCKET_URL` - WebSocket URL (if using)
- `NEXT_PUBLIC_PLANETARY_HOURS_BACKEND` - Enable backend planetary hours (true/false)
- `NEXT_PUBLIC_THERMODYNAMICS_BACKEND` - Enable backend thermodynamics (true/false)
- `NEXT_PUBLIC_TOKEN_CALCULATIONS_BACKEND` - Enable backend token calculations (true/false)
- `NEXT_PUBLIC_KINETICS_BACKEND` - Enable backend kinetics (true/false)

### Optional Observability

- `GALILEO_API_KEY` - Galileo observability (optional)
- `GALILEO_FAIL_SILENTLY` - Continue on Galileo errors (true recommended)
- `GALILEO_LOG_ENABLED` - Enable Galileo logging (false recommended for production)

### Optional Cross-Backend Sync

- `WHATTOEATNEXT_BASE_URL` - Cross-system API URL (optional)
- `WHATTOEATNEXT_API_KEY` - Cross-system API key (optional)
- `CROSS_BACKEND_SYNC_ENABLED` - Enable sync (true/false)
- `SYNC_MONITORING_ENABLED` - Enable sync monitoring (true/false)

## Minimum Required for Basic Functionality

```bash
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-secret-here
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_ADDITIVE_ONLY_ELEMENTS=true
```

## How to Set on Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings > Environment Variables
3. Add each variable with appropriate values
4. Select environments: Production, Preview, Development
5. Redeploy after adding variables
