import 'server-only'

/**
 * Prisma hands back `Decimal` for `@db.Decimal` columns and `BigInt` for
 * `BigInt` ids. Neither survives `JSON.stringify` — `BigInt` throws outright and
 * `Decimal` serialises as an opaque object — so every admin route that touches
 * `token_balances`, `token_transactions` or `mcp_invocations` has to normalise
 * before responding.
 *
 * ESMS amounts are `Decimal(12,4)`: well inside the range where a JS number is
 * exact to four decimal places, so `Number` is lossless here. Slot numbers and
 * autoincrement ids are *not* guaranteed to be, so those become strings rather
 * than silently rounding.
 */

type DecimalLike = { toNumber: () => number }

function isDecimalLike(value: unknown): value is DecimalLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DecimalLike).toNumber === 'function'
  )
}

/** ESMS/token amount → number, rounded to the column's 4 decimal places. */
export function toAmount(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'bigint') return Number(value)
  if (isDecimalLike(value)) {
    const asNumber = value.toNumber()
    return Number.isFinite(asNumber) ? asNumber : fallback
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Round for display without pretending to more precision than the column has. */
export function round(value: number, places = 2): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/**
 * BigInt → string. Solana slots and autoincrement ids can exceed
 * `Number.MAX_SAFE_INTEGER`, so they must not pass through `Number`.
 */
export function toIdString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

export function toIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value as string)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** Percentage of `part` in `total`, with an explicit answer for an empty total. */
export function percent(part: number, total: number, fallback = 0): number {
  if (!total) return fallback
  return round((part / total) * 100, 1)
}

/** Minutes since `date`, or null when there is no date to measure from. */
export function minutesSince(value: unknown, now = Date.now()): number | null {
  const iso = toIso(value)
  if (!iso) return null
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
}
