/**
 * Every scheduled ASOL job, read from `vercel.json` (the only place a Vercel
 * cron is declared), with what the Jobs page needs to judge it.
 *
 * Time limit: no cron route exports `maxDuration` and `vercel.json` has no
 * `functions` block, so every cron runs under the project default. Measured
 * 2026-09-23 via `GET /v9/projects/prj_jZKJi823tXNoq3yC6ihSzIBd0a6C`: Fluid
 * compute on, `defaultResourceConfig.functionDefaultTimeout = 300`, no project
 * override. `test/ops/cron-heartbeats.spec.ts` fails if a route starts
 * exporting its own `maxDuration` without this file following.
 */
import vercelConfig from '@/vercel.json'

export const PLATFORM_DEFAULT_MAX_DURATION_SEC = 300
export const MAX_DURATION_SOURCE =
  'Vercel project default (Fluid compute, functionDefaultTimeout 300s); no route sets maxDuration'

/** Time left at the end for the heartbeat write (two attempts plus the 1s pause). */
export const HEARTBEAT_RESERVE_MS = 15_000

/**
 * Loops that call WTEN or a model stop starting new items once less than this
 * is left before the deadline: enough for one WTEN delivery's worst case
 * (three 10s attempts plus backoff).
 */
export const ITEM_RESERVE_MS = 35_000

/** True when a loop should stop starting new items before `deadlineMs`. */
export function pastBudget(
  deadlineMs: number | undefined,
  reserveMs: number = ITEM_RESERVE_MS,
  now: number = Date.now()
): boolean {
  return deadlineMs !== undefined && now > deadlineMs - reserveMs
}

export interface CronJob {
  /** `path` without the `/api/cron/` prefix, e.g. `agents/tick`. */
  name: string
  path: string
  schedule: string
  maxDurationSec: number
  callsWten: boolean
  callsModel: boolean
}

const TRAITS: Record<string, { callsWten: boolean; callsModel: boolean }> = {
  'agents/tick': { callsWten: true, callsModel: true },
  'agents/claim-yield': { callsWten: true, callsModel: false },
  'scrabble/tick': { callsWten: true, callsModel: false },
  'push-feed': { callsWten: true, callsModel: true },
  'agents/refresh-reservoirs': { callsWten: false, callsModel: false },
  'agents/announce-weekly-feature': { callsWten: true, callsModel: false },
  'agents/weekly-menu': { callsWten: true, callsModel: true },
}

export function jobNameForPath(path: string): string {
  return path.replace(/^\/api\/cron\//, '')
}

export function listCronJobs(): CronJob[] {
  return (vercelConfig.crons ?? []).map(({ path, schedule }) => {
    const name = jobNameForPath(path)
    return {
      name,
      path,
      schedule,
      maxDurationSec: PLATFORM_DEFAULT_MAX_DURATION_SEC,
      callsWten: TRAITS[name]?.callsWten ?? true,
      callsModel: TRAITS[name]?.callsModel ?? true,
    }
  })
}

/**
 * Minutes past the hour at which WTEN's hourly-or-faster crons fire.
 * Source: gregcastro23/WhatToEatNext `vercel.json` on master after PR #867
 * (merged 2026-09-23). Re-read it when WTEN changes its schedule.
 */
export const WTEN_HOURLY_MINUTES: readonly number[] = [
  0, 2, 4, 5, 6, 8, 10, 11, 13, 15, 17, 19, 21, 23, 25, 26, 32, 34, 36, 38, 41, 43, 45, 47, 49, 51,
  53, 56,
]
