/**
 * Constant-time comparison for shared secrets.
 *
 * `a === b` on a secret returns as soon as the first byte differs, so response
 * time leaks how much of a guess was right. `timingSafeEqual` does not, but it
 * throws on unequal lengths — and the usual early `length !==` check leaks the
 * length instead. Both sides are therefore hashed to a fixed 32 bytes first:
 * the comparison takes the same time whatever was sent, and a wrong-length
 * guess is simply wrong.
 *
 * Mirrors WTEN's `src/lib/hooks/secureCompare.ts` so the two apps answer the
 * same way. `test/security/secret-compare-scan.spec.ts` fails if a secret is
 * compared with `===`/`!==` anywhere again.
 */
import { createHash, timingSafeEqual } from 'node:crypto'

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

/**
 * True only when a secret is configured, a value was received, and they match.
 * An unset or empty expected secret never matches anything (fail closed).
 */
export function safeEqual(
  received: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!expected || received === null || received === undefined) return false
  return timingSafeEqual(digest(received), digest(expected))
}

/** True when `received` matches ANY of the configured secrets (unset ones are skipped). */
export function safeEqualAny(
  received: string | null | undefined,
  expected: ReadonlyArray<string | null | undefined>
): boolean {
  // Evaluate every candidate so the answer's timing does not reveal which one matched.
  let matched = false
  for (const secret of expected) {
    if (safeEqual(received, secret)) matched = true
  }
  return matched
}

/** The token from `Authorization: Bearer <token>`, or null when the scheme is absent. */
export function bearerToken(authorization: string | null | undefined): string | null {
  if (!authorization) return null
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
  return match ? match[1]!.trim() : null
}

/** `Authorization: Bearer <secret>` check, constant-time. */
export function bearerMatches(
  authorization: string | null | undefined,
  secret: string | null | undefined
): boolean {
  if (!secret) return false
  return safeEqual(bearerToken(authorization), secret)
}
