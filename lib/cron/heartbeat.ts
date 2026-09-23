import 'server-only'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { HEARTBEAT_RESERVE_MS, PLATFORM_DEFAULT_MAX_DURATION_SEC } from './registry'
import type { CronRunStatus } from './verdict'

/**
 * Cron heartbeats: one `cron_runs` row per invocation, evaluated by the admin
 * Jobs page with the same rules as WTEN (lib/cron/verdict.ts).
 *
 * Without a run record a dead cron is silence indistinguishable from health —
 * the old /admin view could only infer liveness from each job's side effects.
 */

const RECORD_RETRY_DELAY_MS = 1_000
const RETENTION_DAYS = 45
/** Prune on ~1 in 100 writes; the table grows by ~120 rows a day. */
const PRUNE_SAMPLE_RATE = 1 / 100

export interface CronRunRecord {
  status: CronRunStatus
  startedAt: Date
  finishedAt?: Date
  error?: string | null
  details?: Record<string, unknown>
}

export interface CronHeartbeatDeps {
  write: (row: {
    job: string
    startedAt: Date
    finishedAt: Date
    status: CronRunStatus
    durationMs: number
    error: string | null
    details: Record<string, unknown>
  }) => Promise<void>
  prune: (before: Date) => Promise<void>
  sleep: (ms: number) => Promise<void>
  now: () => number
  random: () => number
}

const defaultDeps: CronHeartbeatDeps = {
  write: async row => {
    await prisma.cron_runs.create({ data: { ...row, details: row.details as object } })
  },
  prune: async before => {
    await prisma.cron_runs.deleteMany({ where: { startedAt: { lt: before } } })
  },
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  now: Date.now,
  random: Math.random,
}

/**
 * Record one run. MUST never throw — a heartbeat failure must not break the
 * job's real work — and retries once, because a lost row reads exactly like a
 * dead job (WTEN lost one to a single DB read timeout on 2026-09-22).
 */
export async function recordCronRun(
  job: string,
  run: CronRunRecord,
  overrides: Partial<CronHeartbeatDeps> = {}
): Promise<boolean> {
  const deps = { ...defaultDeps, ...overrides }
  const finishedAt = run.finishedAt ?? new Date(deps.now())
  const row = {
    job,
    startedAt: run.startedAt,
    finishedAt,
    status: run.status,
    durationMs: Math.max(0, finishedAt.getTime() - run.startedAt.getTime()),
    error: run.error ? run.error.slice(0, 2000) : null,
    details: run.details ?? {},
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await deps.write(row)
      if (deps.random() < PRUNE_SAMPLE_RATE) {
        await deps.prune(new Date(deps.now() - RETENTION_DAYS * 86_400_000)).catch(() => undefined)
      }
      return true
    } catch (err) {
      if (attempt === 2) {
        console.error(
          `[cron-heartbeat] could not record ${job} (${run.status}):`,
          err instanceof Error ? err.message : err
        )
        return false
      }
      await deps.sleep(RECORD_RETRY_DELAY_MS)
    }
  }
  return false
}

export interface CronJobContext {
  startedAt: Date
  /** Epoch ms after which the job must not start new work. */
  deadlineMs: number
}

/** Small, numeric-only summary of a job's JSON response for the run record. */
async function summarise(res: Response): Promise<Record<string, unknown>> {
  const details: Record<string, unknown> = { httpStatus: res.status }
  try {
    const body = await res.clone().json()
    if (body && typeof body === 'object') {
      for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        if (typeof value === 'number' || typeof value === 'boolean') details[key] = value
        else if (Array.isArray(value) && key === 'errors') details.errorCount = value.length
      }
      const err = (body as Record<string, unknown>).error
      if (typeof err === 'string') details.errorMessage = err.slice(0, 300)
    }
  } catch {
    // Not JSON — the status is enough.
  }
  return details
}

/**
 * Run an (already authorised) cron job to a deadline and record its heartbeat.
 *
 * The deadline is the function's time limit minus HEARTBEAT_RESERVE_MS. If the
 * job is still running then, the run is recorded as `timeout` and a 504 is
 * returned while there is still time to write the row — Vercel would
 * otherwise kill the function and take the heartbeat with it. The job gets
 * `deadlineMs` so its loops can stop starting new work before that.
 *
 * 2xx (including 207, "some items failed") is `success`; the partial count
 * lands in the details. 5xx or a thrown error is `failure`.
 */
export async function runCronJob(
  job: string,
  work: (ctx: CronJobContext) => Promise<Response>,
  options: { maxDurationSec?: number; deps?: Partial<CronHeartbeatDeps> } = {}
): Promise<Response> {
  const now = options.deps?.now ?? Date.now
  const startedAt = new Date(now())
  const maxDurationMs = (options.maxDurationSec ?? PLATFORM_DEFAULT_MAX_DURATION_SEC) * 1000
  const deadlineMs = startedAt.getTime() + maxDurationMs - HEARTBEAT_RESERVE_MS

  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<'timeout'>(resolve => {
    timer = setTimeout(() => resolve('timeout'), Math.max(0, deadlineMs - now()))
  })

  try {
    const outcome = await Promise.race([work({ startedAt, deadlineMs }), timedOut])
    if (outcome === 'timeout') {
      await recordCronRun(
        job,
        {
          status: 'timeout',
          startedAt,
          error: `still running at the deadline (${Math.round((deadlineMs - startedAt.getTime()) / 1000)}s)`,
          details: { httpStatus: 504 },
        },
        options.deps
      )
      return NextResponse.json({ success: false, error: 'deadline reached' }, { status: 504 })
    }
    const details = await summarise(outcome)
    const ok = outcome.status >= 200 && outcome.status < 300
    await recordCronRun(
      job,
      {
        status: ok ? 'success' : 'failure',
        startedAt,
        error: ok
          ? null
          : ((details.errorMessage as string | undefined) ?? `HTTP ${outcome.status}`),
        details: { ...details, ...(outcome.status === 207 ? { partial: true } : {}) },
      },
      options.deps
    )
    return outcome
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await recordCronRun(job, { status: 'failure', startedAt, error: message }, options.deps)
    console.error(`[cron/${job}] Fatal error:`, err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  } finally {
    if (timer) clearTimeout(timer)
  }
}
