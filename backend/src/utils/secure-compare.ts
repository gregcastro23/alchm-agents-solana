/**
 * Constant-time secret comparison for the Bun service.
 *
 * Same contract as the Next.js app's `lib/security/secure-compare.ts` (this
 * package cannot import from the root `lib/`): both sides are hashed to 32
 * bytes before `timingSafeEqual`, so neither the content nor the length of a
 * guess leaks through timing, and an unset expected secret never matches.
 */
import { createHash, timingSafeEqual } from 'node:crypto'

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

export function safeEqual(
  received: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!expected || received === null || received === undefined) return false
  return timingSafeEqual(digest(received), digest(expected))
}
