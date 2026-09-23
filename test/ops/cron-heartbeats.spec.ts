// @vitest-environment node
/**
 * Cron heartbeats (A6): the verdict rules match WTEN's, the recorder never
 * throws, the wrapper records success / failure / timeout before the platform
 * would kill the function, and every scheduled route actually uses it.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { evaluateHeartbeat, lateAfterMinutes, percentile } from '@/lib/cron/verdict'
import { expectedIntervalMinutes, firesBetween } from '@/lib/cron/schedule'
import {
  HEARTBEAT_RESERVE_MS,
  PLATFORM_DEFAULT_MAX_DURATION_SEC,
  listCronJobs,
  pastBudget,
} from '@/lib/cron/registry'
import { recordCronRun, runCronJob } from '@/lib/cron/heartbeat'

const ROOT = path.resolve(__dirname, '../..')
const HOUR = 60 * 60_000
const run = (minutesAgo: number, status: 'success' | 'failure' | 'timeout', now: number) => ({
  startedAt: new Date(now - minutesAgo * 60_000).toISOString(),
  status,
})

describe('verdicts (same rules as WTEN evaluateHeartbeat)', () => {
  const now = Date.UTC(2026, 8, 23, 12, 0)

  it('late = (2 × interval sub-daily, 1 × daily) + max(15m, 10%)', () => {
    expect(lateAfterMinutes(30)).toBe(75)
    expect(lateAfterMinutes(60)).toBe(135)
    expect(lateAfterMinutes(1440)).toBe(1440 + 144)
    expect(lateAfterMinutes(10080)).toBe(10080 + 1008)
  })

  it.each([
    ['never ran', 60, null, null, 'never'],
    ['last run fine', 60, run(10, 'success', now), run(70, 'success', now), 'ok'],
    ['one missed hourly run is not late', 60, run(125, 'success', now), null, 'ok'],
    ['two missed hourly runs + grace is late', 60, run(136, 'success', now), null, 'late'],
    [
      'one hourly failure after a success is retrying',
      60,
      run(5, 'failure', now),
      run(65, 'success', now),
      'retrying',
    ],
    [
      'two hourly failures in a row is failing',
      60,
      run(5, 'timeout', now),
      run(65, 'failure', now),
      'failing',
    ],
    ['a first-ever hourly failure is retrying', 60, run(5, 'failure', now), null, 'retrying'],
    [
      'one daily failure is failing',
      1440,
      run(5, 'failure', now),
      run(1445, 'success', now),
      'failing',
    ],
    [
      'a daily job one day and a bit silent is late',
      1440,
      run(1440 + 145, 'success', now),
      null,
      'late',
    ],
  ] as const)('%s', (_label, interval, latest, previous, expected) => {
    expect(evaluateHeartbeat({ intervalMinutes: interval, latest, previous, nowMs: now })).toBe(
      expected
    )
  })

  it('percentile is nearest-rank and empty-safe', () => {
    expect(percentile([], 95)).toBeNull()
    expect(percentile([5], 95)).toBe(5)
    expect(
      percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 100], 95)
    ).toBe(19)
  })
})

describe('schedule math', () => {
  it.each([
    ['28 * * * *', 60],
    ['14,44 * * * *', 30],
    ['*/30 * * * *', 30],
    ['20 0 * * *', 1440],
    ['22 0 * * 1', 10080],
    ['9 5 * * 0', 10080],
  ])('%s fires at most %i minutes apart', (schedule, minutes) => {
    expect(expectedIntervalMinutes(schedule)).toBe(minutes)
  })

  it('counts the fires a job owed in a window', () => {
    const end = Date.UTC(2026, 8, 23, 12, 0)
    expect(firesBetween('14,44 * * * *', end - 24 * HOUR, end)).toHaveLength(48)
    expect(firesBetween('28 * * * *', end - 24 * HOUR, end)).toHaveLength(24)
    expect(firesBetween('20 0 * * *', end - 24 * HOUR, end)).toHaveLength(1)
  })
})

describe('recordCronRun', () => {
  const started = new Date(Date.UTC(2026, 8, 23, 12, 0))

  it('retries once and reports success', async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error('read timeout'))
      .mockResolvedValue(undefined)
    const sleep = vi.fn(async () => {})
    const ok = await recordCronRun(
      'agents/tick',
      { status: 'success', startedAt: started },
      { write, sleep, random: () => 1 }
    )
    expect(ok).toBe(true)
    expect(write).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledOnce()
  })

  it('never throws, even when both attempts fail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const write = vi.fn().mockRejectedValue(new Error('db down'))
    await expect(
      recordCronRun(
        'agents/tick',
        { status: 'failure', startedAt: started, error: 'x' },
        { write, sleep: async () => {} }
      )
    ).resolves.toBe(false)
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('writes duration and trims the error', async () => {
    const write = vi.fn(async () => {})
    await recordCronRun(
      'push-feed',
      {
        status: 'failure',
        startedAt: started,
        finishedAt: new Date(started.getTime() + 4200),
        error: 'e'.repeat(5000),
      },
      { write, random: () => 1 }
    )
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'push-feed', durationMs: 4200, status: 'failure' })
    )
    expect((write.mock.calls[0] as any)[0].error).toHaveLength(2000)
  })
})

describe('runCronJob', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const deps = () => {
    const rows: any[] = []
    return {
      rows,
      deps: { write: async (r: any) => void rows.push(r), sleep: async () => {}, random: () => 1 },
    }
  }

  it('records success, and a 207 as success with partial=true', async () => {
    const a = deps()
    await runCronJob('push-feed', async () => NextResponse.json({ pushedCount: 3, errors: [] }), {
      deps: a.deps,
    })
    await runCronJob(
      'agents/tick',
      async () => NextResponse.json({ actionsExecuted: 24, errors: [1, 2] }, { status: 207 }),
      { deps: a.deps }
    )
    expect(a.rows[0]).toMatchObject({
      job: 'push-feed',
      status: 'success',
      details: { httpStatus: 200, pushedCount: 3, errorCount: 0 },
    })
    expect(a.rows[1]).toMatchObject({
      status: 'success',
      details: { httpStatus: 207, partial: true, errorCount: 2 },
    })
  })

  it('records a 5xx or a throw as failure and still answers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const a = deps()
    await runCronJob('x', async () => NextResponse.json({ error: 'boom' }, { status: 500 }), {
      deps: a.deps,
    })
    const res = await runCronJob(
      'y',
      async () => {
        throw new Error('kaput')
      },
      { deps: a.deps }
    )
    expect(res.status).toBe(500)
    expect(a.rows.map(r => [r.job, r.status, r.error])).toEqual([
      ['x', 'failure', 'boom'],
      ['y', 'failure', 'kaput'],
    ])
  })

  it('records a timeout and answers 504 before the platform limit, while the job still runs', async () => {
    vi.useFakeTimers()
    const a = deps()
    let deadlineSeen = 0
    const pending = runCronJob(
      'agents/tick',
      ({ deadlineMs, startedAt }) => {
        deadlineSeen = deadlineMs - startedAt.getTime()
        return new Promise<Response>(() => {}) // never settles
      },
      { maxDurationSec: 20, deps: a.deps }
    )
    await vi.advanceTimersByTimeAsync(20_000 - HEARTBEAT_RESERVE_MS)
    const res = await pending
    expect(res.status).toBe(504)
    expect(deadlineSeen).toBe(20_000 - HEARTBEAT_RESERVE_MS)
    expect(a.rows).toHaveLength(1)
    expect(a.rows[0]).toMatchObject({ job: 'agents/tick', status: 'timeout' })
  })

  it('pastBudget stops new work only inside the reserve', () => {
    expect(pastBudget(undefined)).toBe(false)
    expect(pastBudget(100_000, 35_000, 60_000)).toBe(false)
    expect(pastBudget(100_000, 35_000, 70_000)).toBe(true)
  })
})

describe('every scheduled cron', () => {
  const jobs = listCronJobs()

  it('records a heartbeat through runCronJob', () => {
    for (const job of jobs) {
      const src = fs.readFileSync(path.join(ROOT, 'app', job.path, 'route.ts'), 'utf8')
      expect({ job: job.name, wrapped: src.includes(`runCronJob('${job.name}'`) }).toEqual({
        job: job.name,
        wrapped: true,
      })
    }
  })

  it('runs under the time limit the registry assumes (no route overrides maxDuration)', () => {
    for (const job of jobs) {
      const src = fs.readFileSync(path.join(ROOT, 'app', job.path, 'route.ts'), 'utf8')
      const override = /export const maxDuration\s*=\s*(\d+)/.exec(src)
      expect({
        job: job.name,
        maxDuration: override ? Number(override[1]) : PLATFORM_DEFAULT_MAX_DURATION_SEC,
      }).toEqual({
        job: job.name,
        maxDuration: job.maxDurationSec,
      })
    }
  })
})
