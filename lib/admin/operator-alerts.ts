import 'server-only'

import { getConfiguredAdminEmails } from '@/lib/admin/admin-emails'
import type { AdminAlert } from '@/lib/admin/alerts'

/**
 * Operator alert delivery, state-transition classification, and sustained
 * incident reminder helpers (WTEN-parity).
 *
 * Alerts are considered `ready` whenever at least one real delivery channel
 * (Resend email to configured AUTH_ADMIN_EMAIL / ADMIN_EMAILS, or Slack
 * incoming webhook via ALERT_SLACK_WEBHOOK_URL) is provisioned.
 */

export type PostureState = 'NOMINAL' | 'ATTENTION' | 'CRITICAL'

export type AlertTransitionKind = 'degraded' | 'escalated' | 'improved' | 'recovered' | 'unchanged'

export interface AlertDeliveryStatus {
  emailConfigured: boolean
  slackConfigured: boolean
  ready: boolean
  channels: Array<'email' | 'slack'>
  recipientsCount: number
  missingEnv: string[]
  fromAddress: string
  dashboardUrl: string
}

export interface StateTransition {
  changed: boolean
  kind: AlertTransitionKind
  severity: 'critical' | 'warning' | 'info'
  from: PostureState
  to: PostureState
  summary: string
}

export interface ControlPlaneSnapshotSummary {
  state: PostureState
  readinessScore: number | null
  domains: Array<{
    key: string
    label: string
    state: PostureState
    detail: string
  }>
  alerts: AdminAlert[]
}

export interface OperatorAlertEvent {
  id: string
  component: string
  subject: string
  summary: string
  remediation?: string
  severity: 'critical' | 'warning' | 'info'
  fromState: PostureState
  toState: PostureState
  kind: AlertTransitionKind | 'sustained-incident'
  createdAt: string
  dispatchedTo: Array<'email' | 'slack'>
  deliveryErrors: string[]
}

const POSTURE_RANK: Record<PostureState, number> = {
  NOMINAL: 0,
  ATTENTION: 1,
  CRITICAL: 2,
}

const DEFAULT_COOLDOWN_MINUTES = 60
const DEFAULT_REMINDER_HOURS = 24
const MAX_RECENT_EVENTS = 50

let lastSnapshot: ControlPlaneSnapshotSummary | null = null
const lastSentByKey = new Map<string, number>()
const recentEvents: OperatorAlertEvent[] = []

export function getAlertDeliveryStatus(env: NodeJS.ProcessEnv = process.env): AlertDeliveryStatus {
  const recipients = getConfiguredAdminEmails(env)
  const emailConfigured = Boolean(env.RESEND_API_KEY?.trim()) && recipients.length > 0
  const slackConfigured = Boolean(env.ALERT_SLACK_WEBHOOK_URL?.trim())
  const channels: Array<'email' | 'slack'> = []
  if (emailConfigured) channels.push('email')
  if (slackConfigured) channels.push('slack')

  const missingEnv: string[] = []
  if (!env.RESEND_API_KEY?.trim()) missingEnv.push('RESEND_API_KEY')
  if (recipients.length === 0) missingEnv.push('AUTH_ADMIN_EMAIL')
  if (!slackConfigured) missingEnv.push('ALERT_SLACK_WEBHOOK_URL')

  const siteBase = (
    env.NEXT_PUBLIC_SITE_URL ||
    env.NEXT_PUBLIC_APP_URL ||
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : '') ||
    'https://agents.alchm.kitchen'
  ).replace(/\/$/, '')

  return {
    emailConfigured,
    slackConfigured,
    ready: emailConfigured || slackConfigured,
    channels,
    recipientsCount: recipients.length,
    missingEnv,
    fromAddress: env.ALERT_FROM_EMAIL?.trim() || 'Alchm Agents Ops <ops@alchm.kitchen>',
    dashboardUrl: `${siteBase}/admin`,
  }
}

export function classifyTransition(from: PostureState | null, to: PostureState): StateTransition {
  const effectiveFrom = from ?? to
  if (from === null || from === to) {
    return {
      changed: false,
      kind: 'unchanged',
      severity: to === 'CRITICAL' ? 'critical' : to === 'ATTENTION' ? 'warning' : 'info',
      from: effectiveFrom,
      to,
      summary: `Posture remains ${to}.`,
    }
  }

  const nextRank = POSTURE_RANK[to]
  const prevRank = POSTURE_RANK[from]
  if (nextRank > prevRank) {
    return {
      changed: true,
      kind: from === 'NOMINAL' ? 'degraded' : 'escalated',
      severity: to === 'CRITICAL' ? 'critical' : 'warning',
      from,
      to,
      summary: `Posture ${from === 'NOMINAL' ? 'degraded' : 'escalated'} from ${from} to ${to}.`,
    }
  }

  return {
    changed: true,
    kind: to === 'NOMINAL' ? 'recovered' : 'improved',
    severity: to === 'NOMINAL' ? 'info' : 'warning',
    from,
    to,
    summary: `Posture ${to === 'NOMINAL' ? 'recovered' : 'improved'} from ${from} to ${to}.`,
  }
}

export interface SnapshotDiffOptions {
  nowMs?: number
  cooldownMinutes?: number
  lastSentLookup?: Map<string, number>
}

export function diffSnapshotsForAlerts(
  previous: ControlPlaneSnapshotSummary | null,
  current: ControlPlaneSnapshotSummary,
  options: SnapshotDiffOptions = {}
): Omit<OperatorAlertEvent, 'id' | 'dispatchedTo' | 'deliveryErrors'>[] {
  const nowMs = options.nowMs ?? Date.now()
  const cooldownMs = Math.max(1, options.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES) * 60_000
  const sentMap = options.lastSentLookup ?? lastSentByKey
  const createdAt = new Date(nowMs).toISOString()
  const generated: Array<Omit<OperatorAlertEvent, 'id' | 'dispatchedTo' | 'deliveryErrors'>> = []

  const overallTransition = classifyTransition(previous?.state ?? null, current.state)
  const isInitialIncident = previous === null && current.state !== 'NOMINAL'

  if (overallTransition.changed || isInitialIncident) {
    const key = `control-plane:${current.state}`
    const prevSent = sentMap.get(key)
    const allow =
      overallTransition.kind === 'recovered' ||
      prevSent === undefined ||
      nowMs - prevSent >= cooldownMs

    if (allow) {
      const topAlert = current.alerts[0]
      generated.push({
        component: topAlert?.title || 'Operations Control Plane',
        subject:
          current.state === 'NOMINAL'
            ? `Planetary Agents recovered to NOMINAL`
            : `Planetary Agents ${current.state}: ${topAlert?.title || overallTransition.summary}`,
        summary: topAlert?.detail || overallTransition.summary,
        remediation:
          current.alerts.find(a => a.severity === 'critical')?.source === 'infrastructure'
            ? 'Verify PostgreSQL connectivity/quota and backend /health on agents.alchm.kitchen/admin.'
            : undefined,
        severity: overallTransition.severity,
        fromState: overallTransition.from,
        toState: overallTransition.to,
        kind: overallTransition.changed ? overallTransition.kind : 'degraded',
        createdAt,
      })
    }
  }

  return generated
}

export function buildSustainedReminder(input: {
  current: ControlPlaneSnapshotSummary
  previousSentAtMs: number | null | undefined
  nowMs?: number
  reminderHours?: number
}): Omit<OperatorAlertEvent, 'id' | 'dispatchedTo' | 'deliveryErrors'> | null {
  const { current, previousSentAtMs } = input
  if (current.state !== 'CRITICAL') return null

  const nowMs = input.nowMs ?? Date.now()
  const reminderHours = input.reminderHours ?? DEFAULT_REMINDER_HOURS
  const reminderMs = Math.max(1, reminderHours) * 3_600_000

  if (previousSentAtMs !== null && previousSentAtMs !== undefined) {
    if (nowMs - previousSentAtMs < reminderMs) return null
  }

  const criticalAlerts = current.alerts.filter(a => a.severity === 'critical')
  const detailLines = criticalAlerts
    .slice(0, 3)
    .map(a => `${a.title}: ${a.detail}`)
    .join(' • ')

  return {
    component: 'Sustained incident',
    subject: `Planetary Agents still CRITICAL (${reminderHours}h)`,
    summary:
      detailLines ||
      `Still in CRITICAL with no recovery after ${reminderHours}h. Repeats every ${reminderHours}h until resolved.`,
    severity: 'critical',
    fromState: 'CRITICAL',
    toState: 'CRITICAL',
    kind: 'sustained-incident',
    createdAt: new Date(nowMs).toISOString(),
  }
}

export function recordOperatorAlert(event: OperatorAlertEvent): void {
  recentEvents.unshift(event)
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.length = MAX_RECENT_EVENTS
  }
}

export function getRecentOperatorAlerts(limit = 20): OperatorAlertEvent[] {
  return recentEvents.slice(0, Math.max(0, limit))
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildAlertEmailHtml(
  event: Omit<OperatorAlertEvent, 'id' | 'dispatchedTo' | 'deliveryErrors'>,
  dashboardUrl: string
): string {
  const bannerColor =
    event.severity === 'critical' ? '#dc2626' : event.severity === 'warning' ? '#d97706' : '#059669'

  return `
<div style="font-family:Inter,system-ui,-apple-system,sans-serif;background:#09090b;color:#f4f4f5;padding:24px;border-radius:14px;max-width:600px;">
  <div style="background:${bannerColor};color:#ffffff;padding:18px 20px;border-radius:10px;">
    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">ALCHM AGENTS OPERATOR ALERT</div>
    <div style="font-size:20px;font-weight:700;margin-top:6px;">${escapeHtml(event.subject)}</div>
  </div>
  <div style="margin-top:16px;padding:14px 16px;background:#18181b;border-radius:10px;border:1px solid #27272a;">
    <div style="font-size:11px;color:#a1a1aa;letter-spacing:0.08em;text-transform:uppercase;">Component</div>
    <div style="font-size:15px;font-weight:600;margin-top:4px;">${escapeHtml(event.component)}</div>
  </div>
  <div style="margin-top:10px;padding:14px 16px;background:#18181b;border-radius:10px;border:1px solid #27272a;">
    <div style="font-size:11px;color:#a1a1aa;letter-spacing:0.08em;text-transform:uppercase;">Transition</div>
    <div style="font-size:13px;font-weight:600;margin-top:6px;">${escapeHtml(event.fromState)} &rarr; ${escapeHtml(event.toState)}</div>
  </div>
  <p style="margin-top:16px;font-size:14px;line-height:1.55;color:#e4e4e7;">${escapeHtml(event.summary)}</p>
  ${
    event.remediation
      ? `<p style="margin-top:8px;font-size:13px;line-height:1.5;color:#fbbf24;">Remediation: ${escapeHtml(event.remediation)}</p>`
      : ''
  }
  <div style="margin-top:20px;">
    <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;">Open Operator Dashboard &rarr;</a>
  </div>
  <p style="margin-top:20px;font-size:11px;color:#71717a;">Automated alert from Planetary Agents operator console. Recipients come from AUTH_ADMIN_EMAIL / ADMIN_EMAILS.</p>
</div>`.trim()
}

export async function evaluateAndDispatchSnapshot(
  current: ControlPlaneSnapshotSummary,
  options: { nowMs?: number; dryRun?: boolean; env?: NodeJS.ProcessEnv } = {}
): Promise<{
  evaluatedAt: string
  previousState: PostureState | null
  currentState: PostureState
  delivery: AlertDeliveryStatus
  events: OperatorAlertEvent[]
}> {
  const nowMs = options.nowMs ?? Date.now()
  const env = options.env ?? process.env
  const delivery = getAlertDeliveryStatus(env)
  const cooldownMinutes = Number(env.ALERT_COOLDOWN_MINUTES) || DEFAULT_COOLDOWN_MINUTES
  const reminderHours = Number(env.ALERT_REMINDER_HOURS) || DEFAULT_REMINDER_HOURS

  const previousState = lastSnapshot?.state ?? null
  const pending = diffSnapshotsForAlerts(lastSnapshot, current, {
    nowMs,
    cooldownMinutes,
    lastSentLookup: lastSentByKey,
  })

  if (pending.length === 0 && current.state === 'CRITICAL') {
    const reminder = buildSustainedReminder({
      current,
      previousSentAtMs:
        lastSentByKey.get('sustained:CRITICAL') ?? lastSentByKey.get('control-plane:CRITICAL'),
      nowMs,
      reminderHours,
    })
    if (reminder) pending.push(reminder)
  }

  lastSnapshot = current

  const dispatchedEvents: OperatorAlertEvent[] = []
  for (const draft of pending) {
    const dispatchedTo: Array<'email' | 'slack'> = []
    const deliveryErrors: string[] = []

    if (!options.dryRun && delivery.ready) {
      const jobs: Array<Promise<void>> = []

      if (delivery.emailConfigured) {
        const recipients = getConfiguredAdminEmails(env)
        jobs.push(
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: delivery.fromAddress,
              to: recipients,
              subject: draft.subject,
              html: buildAlertEmailHtml(draft, delivery.dashboardUrl),
            }),
            signal: AbortSignal.timeout(5000),
          })
            .then(async res => {
              if (!res.ok) {
                deliveryErrors.push(`Resend answered ${res.status}`)
              } else {
                dispatchedTo.push('email')
              }
            })
            .catch(err => {
              deliveryErrors.push(err instanceof Error ? err.message : String(err))
            })
        )
      }

      if (delivery.slackConfigured && env.ALERT_SLACK_WEBHOOK_URL) {
        const slackUrl = env.ALERT_SLACK_WEBHOOK_URL
        jobs.push(
          fetch(slackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `*${draft.subject}*\n${draft.fromState} -> ${draft.toState}\n${draft.summary}\n${delivery.dashboardUrl}`,
            }),
            signal: AbortSignal.timeout(5000),
          })
            .then(res => {
              if (!res.ok) {
                deliveryErrors.push(`Slack webhook answered ${res.status}`)
              } else {
                dispatchedTo.push('slack')
              }
            })
            .catch(err => {
              deliveryErrors.push(err instanceof Error ? err.message : String(err))
            })
        )
      }

      await Promise.allSettled(jobs)
    }

    const event: OperatorAlertEvent = {
      ...draft,
      id: `${nowMs}-${dispatchedEvents.length}`,
      dispatchedTo,
      deliveryErrors,
    }
    if (draft.kind === 'sustained-incident') {
      lastSentByKey.set('sustained:CRITICAL', nowMs)
    } else {
      lastSentByKey.set(`control-plane:${draft.toState}`, nowMs)
      if (draft.toState === 'NOMINAL') {
        lastSentByKey.delete('sustained:CRITICAL')
      }
    }
    recordOperatorAlert(event)
    dispatchedEvents.push(event)
  }

  return {
    evaluatedAt: new Date(nowMs).toISOString(),
    previousState,
    currentState: current.state,
    delivery,
    events: dispatchedEvents,
  }
}

export function __resetOperatorAlertsForTests(): void {
  lastSnapshot = null
  lastSentByKey.clear()
  recentEvents.length = 0
}
