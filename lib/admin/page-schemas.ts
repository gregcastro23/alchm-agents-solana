/**
 * Client-side validation for the admin pages' payloads.
 *
 * Every page parses its endpoint's JSON with one of these before rendering, so
 * a changed or broken response shows as "—" plus the reason instead of as
 * wrong numbers. Each schema also carries a compile-time drift guard: if a
 * field is renamed or retyped on the server, `bunx tsc --noEmit` fails here.
 *
 * Only `import type` from the server modules — this file ships to the browser.
 */
import { z } from 'zod'
import type { JobsReport } from '@/lib/admin/jobs'
import type { WtenLinkReport } from '@/lib/admin/wten-link'
import type { RecipeLatencyReport } from '@/lib/admin/recipe-latency'
import type { AdminAlert } from '@/lib/admin/alerts'

type ServerSatisfies<S, T> = [S] extends [T] ? true : false
type AssertTrue<T extends true> = T

export const AdminAlertSchema = z.object({
  id: z.string(),
  severity: z.enum(['critical', 'warning', 'info']),
  source: z.enum([
    'economy',
    'planetary',
    'codebase',
    'onboarding',
    'infrastructure',
    'agents',
    'users',
  ]),
  title: z.string(),
  detail: z.string(),
  href: z.string().optional(),
  remediation: z.string().optional(),
})
export type _AlertDrift = AssertTrue<ServerSatisfies<AdminAlert, z.infer<typeof AdminAlertSchema>>>

export const SourceStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('live') }),
  z.object({ status: z.literal('not_provisioned'), reason: z.string() }),
  z.object({ status: z.literal('unavailable'), reason: z.string() }),
])

const RunStatus = z.enum(['success', 'failure', 'timeout'])

export const JobsReportSchema = z.object({
  generatedAt: z.string(),
  heartbeats: SourceStatusSchema,
  jobs: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      schedule: z.string(),
      intervalMinutes: z.number(),
      limitMs: z.number(),
      callsWten: z.boolean(),
      callsModel: z.boolean(),
      state: z.enum(['ok', 'retrying', 'late', 'failing', 'never']).nullable(),
      lastRunAt: z.string().nullable(),
      lastStatus: RunStatus.nullable(),
      lastError: z.object({ at: z.string(), message: z.string() }).nullable(),
      expected24h: z.number(),
      runs24h: z.number().nullable(),
      missed24h: z.number().nullable(),
      runs7d: z.number().nullable(),
      successRate7d: z.number().nullable(),
      p95DurationMs: z.number().nullable(),
      recent: z.array(
        z.object({
          startedAt: z.string(),
          status: RunStatus,
          durationMs: z.number(),
          partial: z.boolean(),
          error: z.string().nullable(),
        })
      ),
    })
  ),
  minutes: z.array(
    z.object({ minute: z.number(), asolJobs: z.array(z.string()), wten: z.boolean() })
  ),
  alerts: z.array(AdminAlertSchema),
})
export type JobsReportPayload = z.infer<typeof JobsReportSchema>
export type _JobsDrift = AssertTrue<ServerSatisfies<JobsReport, JobsReportPayload>>

export const WtenLinkReportSchema = z.object({
  generatedAt: z.string(),
  windowHours: z.number(),
  deliveries: SourceStatusSchema,
  endpoints: z
    .array(
      z.object({
        endpoint: z.string(),
        attempts: z.number(),
        events: z.number(),
        split: z.object({
          ok2xx: z.number(),
          alreadyApplied409: z.number(),
          insufficientFunds402: z.number(),
          otherClient4xx: z.number(),
          server5xx: z.number(),
          timeouts: z.number(),
          networkErrors: z.number(),
        }),
        p95LatencyMs: z.number().nullable(),
        lastAt: z.string().nullable(),
        lastError: z
          .object({ at: z.string(), status: z.number().nullable(), message: z.string() })
          .nullable(),
        timeoutMs: z.number().nullable(),
        receiverDedupes: z.boolean().nullable(),
      })
    )
    .nullable(),
  recent: z
    .array(
      z.object({
        at: z.string(),
        endpoint: z.string(),
        eventId: z.string(),
        attempt: z.number(),
        status: z.number().nullable(),
        result: z.string(),
        latencyMs: z.number(),
        error: z.string().nullable(),
      })
    )
    .nullable(),
  secrets: z.array(
    z.object({
      secret: z.enum(['INTERNAL_API_SECRET', 'ALCHM_KITCHEN_SYNC_SECRET']),
      verdict: z.enum(['match', 'mismatch', 'not_configured', 'unknown']),
      probe: z.string(),
      status: z.number().nullable(),
      detail: z.string(),
      checkedAt: z.string(),
    })
  ),
  alerts: z.array(AdminAlertSchema),
})
export type WtenLinkPayload = z.infer<typeof WtenLinkReportSchema>
export type _WtenLinkDrift = AssertTrue<ServerSatisfies<WtenLinkReport, WtenLinkPayload>>

const MsOrNull = z.number().nullable()

export const RecipeLatencyReportSchema = z.object({
  generatedAt: z.string(),
  source: SourceStatusSchema,
  summary: z
    .object({
      windowSeconds: z.number(),
      countingSince: z.string(),
      processStartedAt: z.string(),
      requests: z.number(),
      generated: z.number(),
      cacheHits: z.number(),
      errors: z.number(),
      errorRate: z.number().nullable(),
      p50Ms: MsOrNull,
      p95Ms: MsOrNull,
      maxMs: MsOrNull,
      byProvider: z.record(
        z.string(),
        z.object({ count: z.number(), p50Ms: MsOrNull, p95Ms: MsOrNull })
      ),
    })
    .nullable(),
  wtenBudgetMs: z.number(),
  alerts: z.array(AdminAlertSchema),
})
export type RecipeLatencyPayload = z.infer<typeof RecipeLatencyReportSchema>
export type _RecipeLatencyDrift = AssertTrue<
  ServerSatisfies<RecipeLatencyReport, RecipeLatencyPayload>
>
