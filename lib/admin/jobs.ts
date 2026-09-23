import 'server-only'

import { prisma } from '@/lib/db'
import type { AdminAlert } from '@/lib/admin/alerts'
import { expectedIntervalMinutes, firesBetween, minutesOfSchedule } from '@/lib/cron/schedule'
import { listCronJobs, WTEN_HOURLY_MINUTES, type CronJob } from '@/lib/cron/registry'
import {
  evaluateHeartbeat,
  percentile,
  type CronRunStatus,
  type CronState,
} from '@/lib/cron/verdict'

/**
 * The admin Jobs & crons report, built from `cron_runs` heartbeats.
 *
 * Honesty contract: when the heartbeat table cannot be read, every
 * heartbeat-derived number is `null` and the source says why — never 0. A job
 * with no recorded run is `never` with `missed24h: null`, because runs the
 * schedule owed before heartbeats existed are not misses we can measure.
 */

export type SourceStatus =
  | { status: 'live' }
  | { status: 'not_provisioned'; reason: string }
  | { status: 'unavailable'; reason: string }

export interface JobRun {
  startedAt: string
  status: CronRunStatus
  durationMs: number
  partial: boolean
  error: string | null
}

export interface JobRow {
  name: string
  path: string
  schedule: string
  intervalMinutes: number
  limitMs: number
  callsWten: boolean
  callsModel: boolean
  /** null = unknown (heartbeats unreadable) */
  state: CronState | null
  lastRunAt: string | null
  lastStatus: CronRunStatus | null
  lastError: { at: string; message: string } | null
  expected24h: number
  runs24h: number | null
  missed24h: number | null
  runs7d: number | null
  successRate7d: number | null
  p95DurationMs: number | null
  /** Most recent first, at most 24. */
  recent: JobRun[]
}

export interface MinuteSlot {
  minute: number
  asolJobs: string[]
  wten: boolean
}

export interface JobsReport {
  generatedAt: string
  heartbeats: SourceStatus
  jobs: JobRow[]
  minutes: MinuteSlot[]
  alerts: AdminAlert[]
}

export interface RunRow {
  job: string
  startedAt: Date
  status: string
  durationMs: number
  error: string | null
  details: unknown
}

const DAY_MS = 86_400_000
/** A fire this recent may still be running; don't count it as missed yet. */
const IN_FLIGHT_GRACE_MS = 5 * 60_000

function isStatus(value: string): value is CronRunStatus {
  return value === 'success' || value === 'failure' || value === 'timeout'
}

function toRun(row: RunRow): JobRun | null {
  if (!isStatus(row.status)) return null
  const details = (row.details ?? {}) as Record<string, unknown>
  return {
    startedAt: row.startedAt.toISOString(),
    status: row.status,
    durationMs: row.durationMs,
    partial: details.partial === true,
    error: row.error,
  }
}

function minuteMap(jobs: CronJob[]): MinuteSlot[] {
  const hourly = jobs.filter(j => j.schedule.trim().split(/\s+/)[1] === '*')
  const wten = new Set(WTEN_HOURLY_MINUTES)
  return Array.from({ length: 60 }, (_, minute) => ({
    minute,
    asolJobs: hourly.filter(j => minutesOfSchedule(j.schedule).includes(minute)).map(j => j.name),
    wten: wten.has(minute),
  }))
}

/** Pure: everything the page shows, from the registry and the recorded runs. */
export function buildJobsReport(args: {
  jobs: CronJob[]
  runs: RunRow[] | null
  firstRunAt: Map<string, Date> | null
  heartbeats: SourceStatus
  nowMs: number
}): JobsReport {
  const { jobs, runs, firstRunAt, heartbeats, nowMs } = args
  const alerts: AdminAlert[] = []
  const byJob = new Map<string, JobRun[]>()
  for (const row of runs ?? []) {
    const run = toRun(row)
    if (!run) continue
    const list = byJob.get(row.job) ?? []
    list.push(run)
    byJob.set(row.job, list)
  }
  for (const list of byJob.values()) list.sort((a, b) => b.startedAt.localeCompare(a.startedAt))

  const rows = jobs.map((job): JobRow => {
    const intervalMinutes = expectedIntervalMinutes(job.schedule)
    const expected24h = firesBetween(job.schedule, nowMs - DAY_MS, nowMs).length
    const base = {
      name: job.name,
      path: job.path,
      schedule: job.schedule,
      intervalMinutes,
      limitMs: job.maxDurationSec * 1000,
      callsWten: job.callsWten,
      callsModel: job.callsModel,
      expected24h,
    }
    if (runs === null) {
      return {
        ...base,
        state: null,
        lastRunAt: null,
        lastStatus: null,
        lastError: null,
        runs24h: null,
        missed24h: null,
        runs7d: null,
        successRate7d: null,
        p95DurationMs: null,
        recent: [],
      }
    }

    const all = byJob.get(job.name) ?? []
    const [latest = null, previous = null] = all
    const state = evaluateHeartbeat({ intervalMinutes, latest, previous, nowMs })
    const runs24h = all.filter(r => Date.parse(r.startedAt) > nowMs - DAY_MS).length

    // Only fires after heartbeats began for this job can be missed.
    const first = firstRunAt?.get(job.name) ?? null
    let missed24h: number | null = null
    if (first) {
      const from = Math.max(nowMs - DAY_MS, first.getTime() - 60_000)
      const owed = firesBetween(job.schedule, from, nowMs - IN_FLIGHT_GRACE_MS).length
      const recorded = all.filter(r => Date.parse(r.startedAt) > from).length
      missed24h = Math.max(0, owed - recorded)
    }

    const successes = all.filter(r => r.status === 'success').length
    const failed = all.find(r => r.status !== 'success' && r.error)
    const row: JobRow = {
      ...base,
      state,
      lastRunAt: latest?.startedAt ?? null,
      lastStatus: latest?.status ?? null,
      lastError: failed ? { at: failed.startedAt, message: failed.error! } : null,
      runs24h,
      missed24h,
      runs7d: all.length,
      successRate7d: all.length ? successes / all.length : null,
      p95DurationMs: percentile(
        all.map(r => r.durationMs),
        95
      ),
      recent: all.slice(0, 24),
    }

    if (state === 'failing' || state === 'late') {
      alerts.push({
        id: `jobs:${job.name}:${state}`,
        severity: intervalMinutes >= 1440 || state === 'late' ? 'critical' : 'warning',
        source: 'infrastructure',
        title: `Cron ${job.name} is ${state}`,
        detail:
          state === 'late'
            ? `No run since ${latest?.startedAt ?? 'never'} (schedule ${job.schedule}).`
            : `Last runs: ${[latest, previous]
                .filter(Boolean)
                .map(r => r!.status)
                .join(', ')}. ${failed ? `Last error: ${failed.error}` : ''}`.trim(),
        href: '/admin/jobs',
      })
    }
    if (row.p95DurationMs !== null && row.p95DurationMs > row.limitMs * 0.8) {
      alerts.push({
        id: `jobs:${job.name}:near-limit`,
        severity: 'warning',
        source: 'infrastructure',
        title: `Cron ${job.name} runs close to its time limit`,
        detail: `p95 ${Math.round(row.p95DurationMs / 1000)}s of ${job.maxDurationSec}s.`,
        href: '/admin/jobs',
      })
    }
    return row
  })

  if (heartbeats.status !== 'live') {
    alerts.push({
      id: `jobs:heartbeats:${heartbeats.status}`,
      severity: heartbeats.status === 'unavailable' ? 'critical' : 'warning',
      source: 'infrastructure',
      title:
        heartbeats.status === 'not_provisioned'
          ? 'Cron heartbeats are not provisioned'
          : 'Cron heartbeats are unreadable',
      detail: heartbeats.reason,
      remediation:
        heartbeats.status === 'not_provisioned'
          ? 'Run `bunx prisma db push` against this environment to create cron_runs.'
          : undefined,
      href: '/admin/jobs',
    })
  }

  return {
    generatedAt: new Date(nowMs).toISOString(),
    heartbeats,
    jobs: rows,
    minutes: minuteMap(jobs),
    alerts,
  }
}

function describeReadError(err: unknown): SourceStatus {
  const code = (err as { code?: string } | null)?.code
  if (code === 'P2021') {
    return {
      status: 'not_provisioned',
      reason: 'Table cron_runs does not exist yet (db push pending).',
    }
  }
  return {
    status: 'unavailable',
    reason: err instanceof Error ? err.message.slice(0, 300) : 'heartbeat read failed',
  }
}

export async function loadJobsReport(nowMs: number = Date.now()): Promise<JobsReport> {
  const jobs = listCronJobs()
  try {
    const since = new Date(nowMs - 7 * DAY_MS)
    const [runs, firsts] = await Promise.all([
      prisma.cron_runs.findMany({
        where: { startedAt: { gte: since } },
        orderBy: { startedAt: 'desc' },
        select: {
          job: true,
          startedAt: true,
          status: true,
          durationMs: true,
          error: true,
          details: true,
        },
      }),
      prisma.cron_runs.groupBy({ by: ['job'], _min: { startedAt: true } }),
    ])
    const firstRunAt = new Map<string, Date>()
    for (const f of firsts) if (f._min.startedAt) firstRunAt.set(f.job, f._min.startedAt)
    return buildJobsReport({ jobs, runs, firstRunAt, heartbeats: { status: 'live' }, nowMs })
  } catch (err) {
    return buildJobsReport({
      jobs,
      runs: null,
      firstRunAt: null,
      heartbeats: describeReadError(err),
      nowMs,
    })
  }
}
