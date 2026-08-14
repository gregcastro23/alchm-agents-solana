/**
 * Shared alert vocabulary for the operator console.
 *
 * Every admin subsystem route (`economy`, `planetary`, `codebase-health`,
 * `onboarding`, …) emits its findings as `AdminAlert`s alongside its own
 * payload, and `/api/admin/alerts` fans out to those routes and merges the
 * results into one ranked digest. Rendering therefore never has to re-derive
 * "is this bad?" from raw numbers — the subsystem that owns the number decides,
 * once, in one place.
 *
 * An alert is a *claim about live state*, so it always carries the evidence
 * (`detail`) and, where one exists, the place to go fix it (`href`).
 */

export type AlertSeverity = 'critical' | 'warning' | 'info'

/** Subsystem an alert originated from — also the console tab it links to. */
export type AlertSource =
  | 'economy'
  | 'planetary'
  | 'codebase'
  | 'onboarding'
  | 'infrastructure'
  | 'agents'
  | 'users'

export type AdminAlert = {
  /** Stable per-rule id, so the UI can dedupe and the operator can recognise a repeat. */
  id: string
  severity: AlertSeverity
  source: AlertSource
  title: string
  /** The evidence behind the claim — actual counts, ids, timestamps. */
  detail: string
  /** Where to go to act on it: a console tab, an API route, or an external dashboard. */
  href?: string
  /** Concrete next step, when there is an obvious one. */
  remediation?: string
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

export function severityRank(severity: AlertSeverity): number {
  return SEVERITY_RANK[severity]
}

/** Most severe first; stable within a severity by source then id. */
export function sortAlerts(alerts: AdminAlert[]): AdminAlert[] {
  return [...alerts].sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      a.source.localeCompare(b.source) ||
      a.id.localeCompare(b.id)
  )
}

export function countBySeverity(alerts: AdminAlert[]): Record<AlertSeverity, number> {
  const counts: Record<AlertSeverity, number> = { critical: 0, warning: 0, info: 0 }
  for (const alert of alerts) counts[alert.severity] += 1
  return counts
}

/**
 * Push an alert only when `condition` holds. Keeps rule blocks in the routes
 * flat and readable instead of a stack of `if` statements around `.push`.
 */
export function alertIf(sink: AdminAlert[], condition: boolean, alert: AdminAlert): AdminAlert[] {
  if (condition) sink.push(alert)
  return sink
}

/**
 * A subsystem that could not be read at all is itself a finding — an empty
 * panel and a broken panel must never look the same to the operator.
 */
export function unreadableAlert(source: AlertSource, subject: string, error: unknown): AdminAlert {
  return {
    id: `${source}:unreadable:${subject}`,
    severity: 'warning',
    source,
    title: `${subject} could not be read`,
    detail: error instanceof Error ? error.message : String(error),
    remediation: 'Check the database connection and that the table exists in this environment.',
  }
}

/** Overall posture, for the header badge. */
export function healthPosture(alerts: AdminAlert[]): 'healthy' | 'warn' | 'error' {
  if (alerts.some(a => a.severity === 'critical')) return 'error'
  if (alerts.some(a => a.severity === 'warning')) return 'warn'
  return 'healthy'
}
