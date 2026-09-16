/**
 * In-memory sliding rate limiter for routes that spend model credits on the
 * platform's API key.
 *
 * Deliberately per-instance and best-effort: it is a cost brake on a single
 * authenticated user, not a distributed quota. Serverless instances each keep
 * their own window, so the effective ceiling is this limit times the number of
 * warm instances — enough to stop a script, not a botnet. A real quota belongs
 * in the shared store that the session-revocation work introduces.
 */

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()

export function checkModelCallRateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now()
  const entry = windows.get(key)

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    }
  }

  entry.count += 1
  return { allowed: true, remaining: limit - entry.count, retryAfterSeconds: 0 }
}

export function resetModelCallRateLimits(): void {
  windows.clear()
}
