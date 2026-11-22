/**
 * Provenance vocabulary for Planetary Agents admin telemetry.
 *
 * Every KPI, domain card, and readiness summary carries an explicit
 * `Provenance` record so operators can tell the difference between a live
 * measurement, stale cached data, an unconfigured/unreachable upstream source,
 * a not-yet-instrumented signal, and a partial composite. Zero fabricated
 * fallbacks.
 */

export type ProvenanceState = 'live' | 'stale' | 'no-source' | 'not-instrumented' | 'partial'

export interface Provenance {
  state: ProvenanceState
  source: string
  measuredAt?: string
  staleAfterMs?: number
  missingVars?: string[]
  note?: string
}

export const PROVENANCE_LABEL: Record<ProvenanceState, string> = {
  live: 'LIVE',
  stale: 'STALE',
  'no-source': 'NO SOURCE',
  'not-instrumented': 'NOT INSTRUMENTED',
  partial: 'PARTIAL',
}

export const PROVENANCE_DESCRIPTION: Record<ProvenanceState, string> = {
  live: 'Measured directly from a live upstream store or runtime probe within its freshness window.',
  stale: 'Last measurement is older than the expected freshness window.',
  'no-source':
    'Upstream data store, credential, or network dependency is unavailable or unconfigured.',
  'not-instrumented': 'Telemetry hook or reporter has not yet been provisioned for this signal.',
  partial: 'Composite built from a mix of live and unavailable/uninstrumented signals.',
}

/** Strict null-and-NaN guard for honest numeric/object readouts. */
export function hasValue<T>(v: T | null | undefined): v is T {
  if (v === null || v === undefined) return false
  if (typeof v === 'number' && Number.isNaN(v)) return false
  return true
}

/** Checks whether a timestamp has crossed its freshness budget. */
export function isStale(
  measuredAt: string | Date | null | undefined,
  staleAfterMs: number | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!measuredAt || !staleAfterMs || staleAfterMs <= 0) return false
  const ts = typeof measuredAt === 'string' ? Date.parse(measuredAt) : measuredAt.getTime()
  if (!Number.isFinite(ts)) return false
  return nowMs - ts > staleAfterMs
}

export interface FromLiveFlagInput {
  live: boolean
  source: string
  measuredAt?: string | null
  staleAfterMs?: number
  missingVars?: string[]
  reason?: string | null
  note?: string
  nowMs?: number
}

/** Builds a Provenance record from a boolean SourceStatus or live probe. */
export function fromLiveFlag(input: FromLiveFlagInput): Provenance {
  const {
    live,
    source,
    measuredAt,
    staleAfterMs,
    missingVars,
    reason,
    note,
    nowMs = Date.now(),
  } = input

  if (!live) {
    const cleanedReason = reason?.trim()
    const isUninstrumented =
      !missingVars?.length &&
      cleanedReason != null &&
      /not instrumented|uninstrumented|not provisioned/i.test(cleanedReason)

    return {
      state: isUninstrumented ? 'not-instrumented' : 'no-source',
      source,
      ...(measuredAt ? { measuredAt } : {}),
      ...(staleAfterMs ? { staleAfterMs } : {}),
      ...(missingVars?.length ? { missingVars } : {}),
      ...(note || cleanedReason ? { note: note ?? cleanedReason } : {}),
    }
  }

  const stale = isStale(measuredAt, staleAfterMs, nowMs)
  return {
    state: stale ? 'stale' : 'live',
    source,
    ...(measuredAt ? { measuredAt } : {}),
    ...(staleAfterMs ? { staleAfterMs } : {}),
    ...(note ? { note } : {}),
  }
}

/**
 * Combines multiple Provenance records into an honest composite state.
 * - All live -> live
 * - Empty -> not-instrumented
 * - Some live + some degraded -> partial
 * - All no-source -> no-source; all not-instrumented -> not-instrumented; mixed degraded -> partial
 * - Only live + stale -> stale
 */
export function combine(items: readonly Provenance[], source = 'composite'): Provenance {
  if (items.length === 0) {
    return { state: 'not-instrumented', source }
  }

  const states = new Set(items.map(i => i.state))
  const measuredTimes = items
    .map(i => (i.measuredAt ? Date.parse(i.measuredAt) : NaN))
    .filter(n => Number.isFinite(n))
  const latestMeasuredAt =
    measuredTimes.length > 0 ? new Date(Math.max(...measuredTimes)).toISOString() : undefined
  const missingVars = Array.from(new Set(items.flatMap(i => i.missingVars ?? [])))

  let state: ProvenanceState
  if (states.size === 1) {
    state = items[0].state
  } else if (states.has('live') && states.has('stale') && states.size === 2) {
    state = 'stale'
  } else {
    state = 'partial'
  }

  return {
    state,
    source,
    ...(latestMeasuredAt ? { measuredAt: latestMeasuredAt } : {}),
    ...(missingVars.length > 0 ? { missingVars } : {}),
  }
}

/** Human-readable relative age for timestamps in KPI cards and operator banners. */
export function formatAge(
  measuredAt: string | Date | null | undefined,
  nowMs: number = Date.now()
): string {
  if (!measuredAt) return 'unknown'
  const ts = typeof measuredAt === 'string' ? Date.parse(measuredAt) : measuredAt.getTime()
  if (!Number.isFinite(ts)) return 'unknown'

  const diffMs = Math.max(0, nowMs - ts)
  const sec = Math.floor(diffMs / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}
