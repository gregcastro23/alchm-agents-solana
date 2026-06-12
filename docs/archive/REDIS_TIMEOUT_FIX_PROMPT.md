# Fix Redis Connection Timeouts in Backend Integration Tests

## Problem Summary

Backend integration tests are timing out during the `beforeAll()` hook when trying to connect to Redis. The cache service attempts to connect to Redis for 30+ seconds, causing all tests in the suite to fail with timeout errors.

## Current Behavior

```
● Planetary Hours Service Integration Tests › beforeAll

  thrown: "Exceeded timeout of 30000 ms for a hook.
  Add a timeout value to this test to increase the timeout, if this is a long-running test."
```

**Root Cause**: The cache service in `backend/src/services/cache.ts` tries to connect to Redis via `REDIS_URL` environment variable, but when Redis is not available (local testing without Docker), it continuously retries connection with exponential backoff, blocking test execution.

## Test Execution Results

### Individual Test Files (Work Fine)

```bash
# Works when run individually
npx jest tests/integration/routes/alchemy.integration.test.ts --testTimeout=60000
# Result: 14/15 tests passing (1 flaky performance test)

npx jest tests/integration/services/planetary-hours.integration.test.ts --testTimeout=60000
# Result: 11/12 tests passing (1 flaky cache performance test)
```

### Full Integration Suite (Times Out)

```bash
# Times out during setup
npx jest --config jest.config.integration.js --ci
# Result: All tests fail with "Exceeded timeout of 30000 ms for a hook"
```

## Required Fix

**Goal**: Make integration tests work without Redis by ensuring immediate fallback to memory cache when Redis is unavailable.

### Option 1: Quick Connection Timeout (Recommended)

Modify `backend/src/services/cache.ts` to fail fast when Redis is unavailable:

```typescript
async connect(): Promise<void> {
  const redisUrl = process.env.REDIS_URL

  if (redisUrl) {
    try {
      this.redisClient = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 2000,      // 2 second connection timeout
          reconnectStrategy: false,  // Don't retry in test environment
        },
      })

      // Add connection timeout promise
      const connectPromise = this.redisClient.connect()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout')), 3000)
      )

      await Promise.race([connectPromise, timeoutPromise])
      logger.info('Cache service initialized with Redis')
    } catch (error) {
      logger.warn('Failed to connect to Redis, using memory cache:', error)
      this.redisClient?.disconnect().catch(() => {})
      this.redisClient = null
      this.setupMemoryCache()
    }
  } else {
    this.setupMemoryCache()
  }
}
```

### Option 2: Environment-Based Skip

Skip Redis connection entirely in test environment:

```typescript
async connect(): Promise<void> {
  const redisUrl = process.env.REDIS_URL
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.NO_REDIS === 'true'

  if (redisUrl && !isTestEnv) {
    // ... existing Redis connection logic
  } else {
    logger.info('Cache service initialized with memory fallback')
    this.setupMemoryCache()
  }
}
```

### Option 3: Test-Specific Setup

Modify integration test setup to disable Redis:

```typescript
// backend/tests/setup.integration.ts
export async function setupIntegrationTestEnv(): Promise<void> {
  // Disable Redis for integration tests
  process.env.NO_REDIS = 'true'

  // Initialize cache service (will use memory)
  await cacheService.connect()

  // Rest of setup...
}
```

## Files to Modify

1. **Primary**: `backend/src/services/cache.ts` (lines 15-47)
   - Add quick timeout to Redis connection
   - Add reconnectStrategy: false for test environments
   - Improve error handling and fallback

2. **Alternative**: `backend/tests/setup.integration.ts` (lines 10-30)
   - Set NO_REDIS=true before importing services
   - Ensure cache service uses memory fallback

3. **Configuration**: `backend/jest.config.integration.js`
   - Add `NO_REDIS: 'true'` to `testEnvironmentOptions`

## Verification Steps

After implementing the fix:

```bash
# Test 1: Run full integration suite (should complete in < 30 seconds)
cd backend
npx jest --config jest.config.integration.js --ci

# Expected output:
# Test Suites: 3 passed, 3 total
# Tests:       37 passed, 37 total (or 35 passed, 2 flaky)
# Time:        < 30s

# Test 2: Verify cache statistics endpoint still works
curl http://localhost:8000/api/alchemy/status
# Should include: "cache": { "type": "memory", "connected": true, ... }

# Test 3: Run in GitLab CI
git push origin main
# Check pipeline: https://gitlab.com/xalchm/my_alchm/-/pipelines
# backend:test:integration job should pass
```

## Additional Context

**Recent Changes (Just Completed)**:

- ✅ Fixed 5 integration test failures (validation & edge cases)
- ✅ All targeted tests now passing individually
- ✅ Commit: `7b04964d` - "Fix 5 integration test failures - validation & edge cases"

**Cache Service Behavior**:

- Redis connection retries with exponential backoff (2s, 4s, 8s, 16s, ...)
- During tests, this causes 30+ second delays in `beforeAll()` hooks
- Memory cache fallback works perfectly once Redis connection fails
- Need to fail fast and fallback immediately for test environments

**Current Test Status**:

- alchemy.integration.test.ts: 14/15 passing (1 flaky cache timing test)
- planetary-hours.integration.test.ts: 11/12 passing (1 flaky cache timing test)
- cache.integration.test.ts: Unknown (times out during setup)

## Success Criteria

1. Full integration test suite completes in < 30 seconds
2. All 37 integration tests pass (or 35 pass with 2 known flaky cache timing tests)
3. Tests work without Docker/Redis running locally
4. Cache service still connects to Redis properly in production
5. GitLab CI pipeline passes for backend:test:integration job

## Implementation Approach

**Recommended**: Start with Option 1 (Quick Connection Timeout) as it's the least invasive and most robust solution. If Redis is truly unavailable, it will fail within 3 seconds and fallback to memory cache.

**Test First**: Before implementing, verify the hypothesis by setting NO_REDIS=true:

```bash
NO_REDIS=true npx jest --config jest.config.integration.js --ci
```

If this works, then Option 2 (Environment-Based Skip) is the simplest solution.
