/**
 * Heartbeat verdicts — the same rules as WTEN's `evaluateHeartbeat`
 * (src/services/cronHeartbeatService.ts, WTEN #867), so both apps page on the
 * same things. Built to alert on a job that is actually broken, not on one bad
 * tick:
 *   - a sub-daily job is `late` after two missed runs plus grace, and `failing`
 *     after two consecutive failures; a single failure is `retrying` (shown,
 *     not alertable) because the next tick self-heals;
 *   - a daily-or-slower job has no next tick to wait for: one missed or failed
 *     run is the alarm.
 * Pure; no I/O.
 */

export type CronRunStatus = 'success' | 'failure' | 'timeout'
export type CronState = 'ok' | 'retrying' | 'late' | 'failing' | 'never'

export interface CronRunSummary {
  startedAt: string
  status: CronRunStatus
}

const MINUTES_PER_DAY = 1440
const LATE_GRACE_MINUTES = 15

/** Minutes of silence before `late`: (2 × interval sub-daily, 1 × daily) + max(15m, 10%). */
export function lateAfterMinutes(intervalMinutes: number): number {
  const missedRuns = intervalMinutes < MINUTES_PER_DAY ? 2 : 1
  const grace = Math.max(LATE_GRACE_MINUTES, Math.round(intervalMinutes * 0.1))
  return missedRuns * intervalMinutes + grace
}

export function evaluateHeartbeat(args: {
  intervalMinutes: number
  latest: CronRunSummary | null
  previous: CronRunSummary | null
  nowMs: number
}): CronState {
  const { intervalMinutes, latest, previous, nowMs } = args
  if (!latest) return 'never'
  const silentMinutes = (nowMs - Date.parse(latest.startedAt)) / 60_000
  if (silentMinutes > lateAfterMinutes(intervalMinutes)) return 'late'
  if (latest.status === 'success') return 'ok'
  const daily = intervalMinutes >= MINUTES_PER_DAY
  if (daily || (previous !== null && previous.status !== 'success')) return 'failing'
  return 'retrying'
}

/** Nearest-rank percentile; null for an empty sample. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))]!
}
