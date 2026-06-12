# Workflow DevKit Setup Guide

## Overview

This project uses the **Workflow DevKit** to create durable, reliable workflows for long-running processes like agent consciousness evolution. Workflows can suspend, resume, and maintain state across restarts without losing progress.

## Installation

The Workflow DevKit is already installed:

```bash
yarn add workflow  # Already done
```

## What is a Workflow?

Workflows are long-running processes that can:

- **Suspend and resume** without losing state
- **Retry failed steps** automatically
- **Pause for days/weeks** without consuming resources
- **Track progress** with built-in observability

## Example: Consciousness Evolution Workflow

### 1. Workflow Definition

Located at [lib/workflows/consciousness-evolution.ts](lib/workflows/consciousness-evolution.ts)

This workflow:

- Tracks agent consciousness evolution over time
- Checks consciousness level every 7 days (configurable)
- Updates agent stats when evolution occurs
- Notifies users about consciousness milestones
- Runs indefinitely until agent reaches target consciousness level

```typescript
export async function consciousnessEvolutionWorkflow(
  input: ConsciousnessEvolutionInput
): Promise<ConsciousnessEvolutionResult> {
  "use workflow";

  // Initialize consciousness tracking
  const initialState = await initializeAgentConsciousness({...});

  // Evolution loop - runs until goal is reached
  while (currentLevel < evolutionGoal) {
    // Track interactions
    const interactionData = await trackAgentInteraction({...});

    // Assess consciousness level
    const assessment = await assessConsciousnessLevel({...});

    // Update stats if evolved
    if (assessment.evolved) {
      await updateAgentStats({...});
    }

    // Wait 7 days before next check (without consuming resources!)
    await sleep("7 days");
  }

  return result;
}
```

### 2. Workflow Steps

Located at [lib/workflows/steps/consciousness-steps.ts](lib/workflows/steps/consciousness-steps.ts)

Steps are individual operations that can be retried if they fail:

```typescript
export async function initializeAgentConsciousness(params: {...}) {
  "use step";  // Makes this function durable and retriable

  // Step implementation...
}
```

Available steps:

- `initializeAgentConsciousness` - Set up tracking
- `trackAgentInteraction` - Query interaction history
- `assessConsciousnessLevel` - Calculate new consciousness level
- `updateAgentStats` - Update agent stats in database
- `checkEvolutionMilestone` - Check for milestone achievements
- `notifyConsciousnessEvolution` - Send notifications

### 3. API Endpoint

Located at [app/api/workflows/consciousness-evolution/route.ts](app/api/workflows/consciousness-evolution/route.ts)

**Start a workflow:**

```bash
curl -X POST http://localhost:3000/api/workflows/consciousness-evolution \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "leonardo-da-vinci",
    "userId": "user123",
    "evolutionGoal": 5,
    "checkIntervalDays": 7
  }'
```

**Check workflow status:**

```bash
curl http://localhost:3000/api/workflows/consciousness-evolution?workflowId=consciousness-leonardo-da-vinci-user123-1234567890
```

## Configuration

Located at [workflow.config.ts](workflow.config.ts)

Key configuration options:

```typescript
export default defineConfig({
  runtime: {
    maxDuration: 24 * 60 * 60 * 1000, // 24 hours
    retry: {
      maxAttempts: 3,
      backoff: 'exponential',
    },
  },
  storage: {
    type: process.env.NODE_ENV === 'production' ? 'redis' : 'memory',
    redis: {
      url: process.env.REDIS_URL,
      keyPrefix: 'workflow:',
    },
  },
})
```

## Database Schema

Added to [prisma/schema.prisma](prisma/schema.prisma):

```prisma
model AgentConsciousness {
  id                  String   @id @default(cuid())
  agentId             String
  userId              String
  consciousnessLevel  Float    @default(1.0)
  totalInteractions   Int      @default(0)
  qualityScore        Float    @default(0.0)
  stats               Json?
  lastInteraction     DateTime @default(now())
  lastEvolution       DateTime?

  @@unique([agentId, userId])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String
  title     String
  message   String
  data      Json?
  read      Boolean  @default(false)
}
```

**Run migrations:**

```bash
npx prisma migrate dev --name add_workflow_models
npx prisma generate
```

## How It Works

### 1. Durable State

- Workflow state is persisted to Redis (production) or memory (development)
- If the server crashes, workflows resume from last checkpoint
- No progress is lost

### 2. Sleep Without Resources

- `await sleep("7 days")` pauses the workflow without consuming server resources
- Workflow wakes up automatically after the sleep period
- Perfect for scheduled tasks

### 3. Automatic Retries

- Steps retry automatically on failure (configurable)
- Exponential backoff prevents overwhelming services
- Fatal errors can be thrown to stop retries

### 4. Observability

- View workflow execution traces
- Monitor step-by-step progress
- Track failures and retries
- Built-in logging

## Use Cases in Planetary Agents

### Current Implementation

- **Consciousness Evolution**: Track agent growth over time

### Future Possibilities

- **User Onboarding**: Multi-step onboarding with delays
- **Celestial Events**: Schedule notifications for planetary events
- **Agent Training**: Long-running training processes
- **Data Processing**: Batch processing with retries
- **Scheduled Reports**: Daily/weekly consciousness reports
- **Milestone Tracking**: Achievement notifications

## Best Practices

### 1. Mark Long-Running Functions

```typescript
export async function myWorkflow() {
  'use workflow' // Add this directive
  // Workflow implementation...
}
```

### 2. Make Steps Retriable

```typescript
export async function myStep() {
  'use step' // Add this directive
  // Step implementation...
}
```

### 3. Handle Failures Gracefully

```typescript
import { FatalError } from 'workflow'

// Throw FatalError to prevent retries
if (criticalError) {
  throw new FatalError('Cannot proceed')
}

// Regular errors will be retried
throw new Error('Temporary failure')
```

### 4. Use Sleep for Delays

```typescript
// Don't do this:
await new Promise(resolve => setTimeout(resolve, 7 * 24 * 60 * 60 * 1000))

// Do this instead:
await sleep('7 days')
```

### 5. Keep Steps Idempotent

Steps should be safe to retry:

```typescript
export async function createRecord(params) {
  "use step";

  // Check if record exists first
  const existing = await db.findUnique({...});
  if (existing) return existing;

  // Create only if it doesn't exist
  return await db.create({...});
}
```

## Testing Workflows

### Local Development

```bash
# Start the dev server
yarn dev

# Trigger a workflow
curl -X POST http://localhost:3000/api/workflows/consciousness-evolution \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "leonardo-da-vinci",
    "userId": "test-user",
    "evolutionGoal": 2,
    "checkIntervalDays": 1
  }'
```

### Production

- Set `REDIS_URL` in environment variables
- Workflows persist across deployments
- Monitor via workflow observability dashboard

## Troubleshooting

### Workflow Not Starting

- Check that workflow directive is present: `"use workflow"`
- Verify API endpoint is accessible
- Check server logs for errors

### Step Failing

- Review step implementation for errors
- Check database connectivity
- Verify external service availability
- Look for FatalError throws

### Workflow Not Resuming

- Ensure Redis is configured in production
- Check Redis connectivity
- Verify workflow storage configuration

## Resources

- [Workflow DevKit Documentation](https://workflow.dev/docs)
- [GitHub Repository](https://github.com/workflow/workflow)
- [Examples](https://workflow.dev/examples)

## Next Steps

1. Run database migrations: `npx prisma migrate dev`
2. Generate Prisma client: `npx prisma generate`
3. Start the dev server: `yarn dev`
4. Test the workflow endpoint
5. Monitor workflow execution

---

**Setup Date**: 2025-10-30
**Workflow Version**: 4.0.1-beta.5
**Status**: ✅ Ready to use
