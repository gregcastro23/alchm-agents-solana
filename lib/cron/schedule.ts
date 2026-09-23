/**
 * The subset of cron that Vercel accepts (five numeric fields; lists, ranges
 * and steps; no names, and never day-of-month together with day-of-week), as
 * far as the Jobs page needs it: when a job was due, and how far apart its
 * fires are. All times are UTC — Vercel runs crons in UTC.
 */

export interface ParsedSchedule {
  minutes: ReadonlySet<number>
  hours: ReadonlySet<number>
  daysOfMonth: ReadonlySet<number> | null // null = any
  months: ReadonlySet<number> | null
  daysOfWeek: ReadonlySet<number> | null
}

function expandField(field: string, min: number, max: number): number[] {
  const out = new Set<number>()
  for (const part of field.split(',')) {
    const [range, stepRaw] = part.split('/')
    const step = stepRaw ? Number(stepRaw) : 1
    if (!Number.isInteger(step) || step < 1) throw new Error(`bad step in "${field}"`)
    let lo: number
    let hi: number
    if (range === '*') {
      lo = min
      hi = max
    } else if (range!.includes('-')) {
      ;[lo, hi] = range!.split('-').map(Number) as [number, number]
    } else {
      lo = Number(range)
      hi = stepRaw ? max : lo
    }
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < min || hi > max || lo > hi) {
      throw new Error(`field "${field}" out of range ${min}-${max}`)
    }
    for (let v = lo; v <= hi; v += step) out.add(v)
  }
  return [...out].sort((a, b) => a - b)
}

export function minutesOfSchedule(schedule: string): number[] {
  return [...parseSchedule(schedule).minutes].sort((a, b) => a - b)
}

export function parseSchedule(schedule: string): ParsedSchedule {
  const fields = schedule.trim().split(/\s+/)
  if (fields.length !== 5) throw new Error(`"${schedule}" must have 5 fields`)
  const [m, h, dom, mon, dow] = fields as [string, string, string, string, string]
  const any = (f: string) => f === '*'
  return {
    minutes: new Set(expandField(m, 0, 59)),
    hours: new Set(expandField(h, 0, 23)),
    daysOfMonth: any(dom) ? null : new Set(expandField(dom, 1, 31)),
    months: any(mon) ? null : new Set(expandField(mon, 1, 12)),
    // 7 is Sunday too.
    daysOfWeek: any(dow) ? null : new Set(expandField(dow, 0, 7).map(d => d % 7)),
  }
}

function fires(s: ParsedSchedule, t: Date): boolean {
  return (
    s.minutes.has(t.getUTCMinutes()) &&
    s.hours.has(t.getUTCHours()) &&
    (s.daysOfMonth === null || s.daysOfMonth.has(t.getUTCDate())) &&
    (s.months === null || s.months.has(t.getUTCMonth() + 1)) &&
    (s.daysOfWeek === null || s.daysOfWeek.has(t.getUTCDay()))
  )
}

const MINUTE = 60_000

/** Scheduled fire times in (fromMs, toMs], oldest first. Bounded to ~8 days of scanning. */
export function firesBetween(schedule: string, fromMs: number, toMs: number): Date[] {
  const s = parseSchedule(schedule)
  const out: Date[] = []
  const start = Math.floor(fromMs / MINUTE) * MINUTE + MINUTE
  const end = Math.min(toMs, start + 8 * 24 * 60 * MINUTE)
  for (let t = start; t <= end; t += MINUTE) {
    const d = new Date(t)
    if (fires(s, d)) out.push(d)
  }
  return out
}

/** Widest gap between consecutive fires, in minutes (scanned over two weeks). */
export function expectedIntervalMinutes(schedule: string): number {
  const s = parseSchedule(schedule)
  // Any fixed anchor works: the pattern repeats weekly for schedules without day-of-month.
  const anchor = Date.UTC(2026, 0, 5) // a Monday
  let prev: number | null = null
  let widest = 0
  for (let t = anchor; t < anchor + 14 * 24 * 60 * MINUTE; t += MINUTE) {
    if (!fires(s, new Date(t))) continue
    if (prev !== null) widest = Math.max(widest, (t - prev) / MINUTE)
    prev = t
  }
  return widest || 7 * 24 * 60
}
