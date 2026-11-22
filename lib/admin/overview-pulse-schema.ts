import { z } from 'zod'
import { DashboardReportSchema } from '@/lib/admin/page-schemas'

/**
 * Browser-safe Zod schema and TypeScript types for `/api/admin/overview-pulse`
 * and SSE frames from `/api/admin/stream`. Must never import `@/lib/db` or
 * `server-only` modules.
 */

export const PostureStateSchema = z.enum(['NOMINAL', 'ATTENTION', 'CRITICAL'])

export const ProvenanceStateSchema = z.enum([
  'live',
  'stale',
  'no-source',
  'not-instrumented',
  'partial',
])

export const ProvenanceSchema = z.object({
  state: ProvenanceStateSchema,
  source: z.string(),
  measuredAt: z.string().optional(),
  staleAfterMs: z.number().optional(),
  missingVars: z.array(z.string()).optional(),
  note: z.string().optional(),
})

export const ControlPlaneDomainSchema = z.object({
  key: z.enum(['database', 'backend', 'wten-link', 'jobs', 'agents', 'mcp', 'councils', 'arena']),
  label: z.string(),
  state: PostureStateSchema,
  headline: z.string(),
  detail: z.string(),
  href: z.string(),
  provenance: ProvenanceSchema,
})

export const ControlPlanePrioritySchema = z.object({
  id: z.string(),
  tier: z.enum(['P0', 'P1', 'P2']),
  source: z.string(),
  title: z.string(),
  detail: z.string(),
  remediation: z.string().optional(),
  href: z.string(),
})

export const MaintenanceItemSchema = z.object({
  id: z.enum(['cron-heartbeats', 'wten-delivery-log', 'shared-secrets', 'alert-delivery']),
  label: z.string(),
  status: z.enum(['ready', 'degraded', 'missing']),
  summary: z.string(),
  detail: z.string(),
  href: z.string(),
})

export const OperationsControlPlaneSchema = z.object({
  generatedAt: z.string(),
  state: PostureStateSchema,
  readinessScore: z.number().nullable(),
  summary: z.string(),
  coverage: z.object({
    live: z.number(),
    total: z.number(),
    pct: z.number(),
    provenance: ProvenanceSchema,
  }),
  domains: z.array(ControlPlaneDomainSchema),
  priorities: z.array(ControlPlanePrioritySchema),
  maintenance: z.array(MaintenanceItemSchema),
})

export const AlertDeliveryStatusSchema = z.object({
  emailConfigured: z.boolean(),
  slackConfigured: z.boolean(),
  ready: z.boolean(),
  channels: z.array(z.enum(['email', 'slack'])),
  recipientsCount: z.number(),
  missingEnv: z.array(z.string()),
  fromAddress: z.string(),
  dashboardUrl: z.string(),
})

export const OperatorAlertEventSchema = z.object({
  id: z.string(),
  component: z.string(),
  subject: z.string(),
  summary: z.string(),
  remediation: z.string().optional(),
  severity: z.enum(['critical', 'warning', 'info']),
  fromState: PostureStateSchema,
  toState: PostureStateSchema,
  kind: z.enum([
    'degraded',
    'escalated',
    'improved',
    'recovered',
    'unchanged',
    'sustained-incident',
  ]),
  createdAt: z.string(),
  dispatchedTo: z.array(z.enum(['email', 'slack'])),
  deliveryErrors: z.array(z.string()),
})

export const DebitPathSummarySchema = z.object({
  verdict: z.enum(['OK', 'IDLE', 'INCIDENT', 'UNKNOWN']),
  summary: z.string(),
  feedAttempts: z.number(),
  debitAttempts: z.number(),
  debitsLanded: z.number(),
  lastDebitError: z.string().nullable(),
})

export const OverviewPulseSchema = z.object({
  generatedAt: z.string(),
  controlPlane: OperationsControlPlaneSchema,
  debitPath: DebitPathSummarySchema,
  alertDelivery: AlertDeliveryStatusSchema,
  recentAlerts: z.array(OperatorAlertEventSchema),
  dashboard: DashboardReportSchema,
})

export type OverviewPulsePayload = z.infer<typeof OverviewPulseSchema>
