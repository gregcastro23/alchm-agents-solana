interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimits = new Map<string, RateLimitEntry>()

export function checkAttestationRateLimit(
  trader: string,
  limit = 20,
  windowMs = 10_000
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimits.get(trader)
  if (!entry || now > entry.resetAt) {
    rateLimits.set(trader, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 }
  }
  entry.count += 1
  return { allowed: true, remaining: limit - entry.count }
}

export function resetAttestationRateLimits(): void {
  rateLimits.clear()
}
