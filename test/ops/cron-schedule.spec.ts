// @vitest-environment node
/**
 * ASOL's Vercel crons are staggered: no two hourly-or-faster jobs share a
 * minute, and no job lands on a minute WTEN's own crons use.
 *
 * Why: WTEN measured its DB timeouts clustering on :00–:02 (2026-09-22 sample),
 * with /api/economy/sync-debit — which ASOL's agent tick calls — the path hit
 * hardest. Staggering is hygiene, not a claimed fix for WTEN's database.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Minutes past the hour at which WTEN's hourly-or-faster crons fire.
 * Source: gregcastro23/WhatToEatNext `vercel.json` on master after PR #867
 * (merged 2026-09-23), read 2026-09-22 UTC-4. Re-read it when WTEN changes its
 * schedule; WTEN keeps its own no-shared-minute test.
 */
const WTEN_HOURLY_MINUTES = [
  0, 2, 4, 5, 6, 8, 10, 11, 13, 15, 17, 19, 21, 23, 25, 26, 32, 34, 36, 38, 41, 43, 45, 47, 49, 51,
  53, 56,
]

interface Cron {
  path: string
  schedule: string
}

const ROOT = path.resolve(__dirname, '../..')
const crons: Cron[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).crons

function expandField(field: string, min: number, max: number): number[] {
  const out = new Set<number>()
  for (const part of field.split(',')) {
    const [range, stepRaw] = part.split('/')
    const step = stepRaw ? Number(stepRaw) : 1
    const [lo, hi] =
      range === '*'
        ? [min, max]
        : range!.includes('-')
          ? range!.split('-').map(Number)
          : [Number(range), stepRaw ? max : Number(range)]
    for (let v = lo!; v <= hi!; v += step) out.add(v)
  }
  return [...out].sort((a, b) => a - b)
}

const fields = (c: Cron) => c.schedule.trim().split(/\s+/)
/** Runs at least once an hour: the hour field is `*`. */
const isHourlyOrFaster = (c: Cron) => fields(c)[1] === '*'
const minutesOf = (c: Cron) => expandField(fields(c)[0]!, 0, 59)

describe('vercel.json crons', () => {
  it('use only syntax Vercel accepts', () => {
    for (const c of crons) {
      const f = fields(c)
      expect({ path: c.path, fieldCount: f.length }).toEqual({ path: c.path, fieldCount: 5 })
      // Vercel rejects named months/days (MON, JAN) …
      expect({ path: c.path, named: /[A-Za-z]/.test(c.schedule) }).toEqual({
        path: c.path,
        named: false,
      })
      // … and setting day-of-month and day-of-week together.
      expect({ path: c.path, both: f[2] !== '*' && f[4] !== '*' }).toEqual({
        path: c.path,
        both: false,
      })
      for (const m of minutesOf(c)) expect(m >= 0 && m <= 59).toBe(true)
    }
  })

  it('point at routes that exist', () => {
    for (const c of crons) {
      const file = path.join(ROOT, 'app', c.path, 'route.ts')
      expect({ path: c.path, exists: fs.existsSync(file) }).toEqual({ path: c.path, exists: true })
    }
  })

  it('no two hourly-or-faster crons share a minute', () => {
    const owner = new Map<number, string>()
    const clashes: string[] = []
    for (const c of crons.filter(isHourlyOrFaster)) {
      for (const m of minutesOf(c)) {
        if (owner.has(m)) clashes.push(`:${m} — ${owner.get(m)} and ${c.path}`)
        else owner.set(m, c.path)
      }
    }
    expect(clashes).toEqual([])
  })

  it('no cron fires on a minute WTEN uses', () => {
    const wten = new Set(WTEN_HOURLY_MINUTES)
    const clashes = crons.flatMap(c =>
      minutesOf(c)
        .filter(m => wten.has(m))
        .map(m => `${c.path} (${c.schedule}) fires at :${m}`)
    )
    expect(clashes).toEqual([])
  })

  it('the minute parser understands lists, steps and ranges', () => {
    expect(expandField('14,44', 0, 59)).toEqual([14, 44])
    expect(expandField('*/30', 0, 59)).toEqual([0, 30])
    expect(expandField('10-12', 0, 59)).toEqual([10, 11, 12])
    expect(expandField('5/20', 0, 59)).toEqual([5, 25, 45])
  })
})
