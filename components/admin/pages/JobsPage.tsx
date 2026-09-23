'use client'

import { JobsReportSchema, type JobsReportPayload } from '@/lib/admin/page-schemas'
import { cn } from '@/lib/utils'
import { AdminFrame } from './AdminFrame'
import {
  AlertList,
  Badge,
  Card,
  LoadState,
  SourceNotice,
  SrOnly,
  formatAgo,
  formatDuration,
  num,
  useChartTooltip,
  useValidatedPoll,
  type Tone,
} from './primitives'

type Job = JobsReportPayload['jobs'][number]
type Run = Job['recent'][number]

const STATE: Record<string, { glyph: string; label: string; tone: Tone; help: string }> = {
  ok: { glyph: '✓', label: 'OK', tone: 'ok', help: 'Latest run succeeded on time.' },
  retrying: {
    glyph: '↻',
    label: 'Retrying',
    tone: 'warn',
    help: 'Latest run failed, the one before succeeded; the next tick decides. Not alerting.',
  },
  late: { glyph: '⏱', label: 'Late', tone: 'bad', help: 'No run inside the lateness window.' },
  failing: {
    glyph: '✕',
    label: 'Failing',
    tone: 'bad',
    help: 'Consecutive failures (one, for a daily job).',
  },
  never: {
    glyph: '○',
    label: 'No runs yet',
    tone: 'muted',
    help: 'No heartbeat recorded for this job yet.',
  },
}

function StateBadge({ state, reason }: { state: Job['state']; reason: string }) {
  if (state === null) return <Badge glyph="—" label="Unknown" tone="muted" title={reason} />
  const s = STATE[state]!
  return <Badge glyph={s.glyph} label={s.label} tone={s.tone} title={s.help} />
}

const RUN_STYLE: Record<string, { glyph: string; label: string; cls: string }> = {
  success: { glyph: '✓', label: 'success', cls: 'bg-emerald-500/25 text-emerald-100' },
  partial: {
    glyph: '◐',
    label: 'success, some items failed',
    cls: 'bg-amber-500/25 text-amber-100',
  },
  failure: { glyph: '✕', label: 'failure', cls: 'bg-rose-500/30 text-rose-100' },
  timeout: { glyph: '⧗', label: 'timeout', cls: 'bg-rose-500/30 text-rose-100' },
}

function runStyle(run: Run) {
  return RUN_STYLE[run.status === 'success' && run.partial ? 'partial' : run.status]!
}

/** Last 24 runs, oldest left. Each cell carries a glyph, a tooltip and a screen-reader line. */
function RunStrip({ runs }: { runs: Run[] }) {
  if (runs.length === 0)
    return <p className="text-xs text-zinc-400">No runs recorded in the last 7 days.</p>
  const ordered = [...runs].reverse()
  return (
    <ol className="flex flex-wrap gap-1" aria-label={`Last ${runs.length} runs, oldest first`}>
      {ordered.map(run => {
        const s = runStyle(run)
        const text = `${new Date(run.startedAt).toLocaleString()} — ${s.label}, ${formatDuration(run.durationMs)}${run.error ? ` — ${run.error}` : ''}`
        return (
          <li
            key={run.startedAt}
            title={text}
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold',
              s.cls
            )}
          >
            <span aria-hidden="true">{s.glyph}</span>
            <span className="sr-only">{text}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** p95 duration against the time limit: a thin bar that starts at zero. */
function LimitMeter({ p95, limit, reason }: { p95: number | null; limit: number; reason: string }) {
  const share = p95 === null ? 0 : Math.min(1, p95 / limit)
  return (
    <div>
      <div className="flex justify-between text-[11px] text-zinc-400">
        <span>p95 {num(p95, reason, formatDuration)}</span>
        <span>limit {formatDuration(limit)}</span>
      </div>
      <div
        className="mt-1 h-1.5 w-full rounded-full bg-white/10"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={p95 ?? undefined}
        aria-label="p95 duration against the time limit"
      >
        {p95 !== null && (
          <div
            className={cn(
              'h-1.5 rounded-full',
              share > 0.8 ? 'bg-rose-400' : share > 0.5 ? 'bg-amber-400' : 'bg-sky-400'
            )}
            style={{ width: `${Math.max(2, share * 100)}%` }}
          />
        )}
      </div>
    </div>
  )
}

function JobCard({ job, reason }: { job: Job; reason: string }) {
  const neverReason = 'No heartbeat recorded yet, so misses cannot be counted.'
  return (
    <article className="min-w-0 rounded-xl border border-white/10 bg-zinc-950/60 p-4 text-zinc-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words font-mono text-sm font-semibold text-zinc-50">{job.name}</h3>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            <code className="text-zinc-300">{job.schedule}</code> UTC · every ≤{' '}
            {job.intervalMinutes >= 1440
              ? `${job.intervalMinutes / 1440}d`
              : `${job.intervalMinutes}m`}
            {job.callsWten && ' · calls WTEN'}
            {job.callsModel && ' · calls a model'}
          </p>
        </div>
        <StateBadge state={job.state} reason={reason} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-zinc-400">Missed (24h)</dt>
          <dd className="font-semibold text-zinc-100">
            {job.state === 'never' ? num(null, neverReason) : num(job.missed24h, reason)}
            <span className="font-normal text-zinc-400"> of {job.expected24h}</span>
          </dd>
        </div>
        <div>
          <dt className="text-zinc-400">Success (7d)</dt>
          <dd className="font-semibold text-zinc-100">
            {num(
              job.successRate7d,
              job.state === 'never' ? neverReason : reason,
              v => `${Math.round(v * 100)}%`
            )}
            {job.runs7d !== null && (
              <span className="font-normal text-zinc-400"> of {job.runs7d}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-400">Last run</dt>
          <dd className="font-semibold text-zinc-100">
            {job.state === null ? num(null, reason) : formatAgo(job.lastRunAt)}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <LimitMeter
            p95={job.p95DurationMs}
            limit={job.limitMs}
            reason={job.state === 'never' ? neverReason : reason}
          />
        </div>
      </dl>

      <div className="mt-3">
        <p className="mb-1 text-[11px] text-zinc-400">
          Last {Math.min(24, job.recent.length) || 24} runs
        </p>
        {job.state === null ? (
          <p className="text-xs">{num(null, reason)}</p>
        ) : (
          <RunStrip runs={job.recent} />
        )}
      </div>

      {job.lastError && (
        <p className="mt-3 break-words rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-100">
          <span aria-hidden="true">✕ </span>
          Last error {formatAgo(job.lastError.at)}: {job.lastError.message}
        </p>
      )}
    </article>
  )
}

/** Minute of the hour: ASOL's hourly-or-faster jobs as bars, WTEN's minutes as markers. */
function MinuteChart({ minutes }: { minutes: JobsReportPayload['minutes'] }) {
  const { ref, show, hide, Tooltip } = useChartTooltip()
  const maxJobs = Math.max(1, ...minutes.map(m => m.asolJobs.length))
  const W = 600
  const H = 72
  const barTop = 8
  const barBottom = 58
  const slot = W / 60
  const label = (m: JobsReportPayload['minutes'][number]) =>
    `:${String(m.minute).padStart(2, '0')} — ASOL: ${m.asolJobs.join(', ') || 'none'} · WTEN: ${m.wten ? 'cron runs' : 'free'}`
  return (
    <div className="relative" ref={ref} onMouseLeave={hide}>
      <Tooltip />
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label="Crons by minute of the hour"
        >
          {/* y axis starts at zero: baseline and a max gridline */}
          <line
            x1={0}
            x2={W}
            y1={barBottom}
            y2={barBottom}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
          />
          <line
            x1={0}
            x2={W}
            y1={barTop}
            y2={barTop}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
          {minutes.map(m => {
            const x = m.minute * slot
            const h = ((barBottom - barTop) * m.asolJobs.length) / maxJobs
            const barW = Math.min(slot * 0.6, 8)
            return (
              <g
                key={m.minute}
                tabIndex={0}
                onMouseMove={e => show(e.clientX, label(m))}
                onFocus={e => show(e.currentTarget.getBoundingClientRect().left, label(m))}
                onBlur={hide}
                className="outline-none focus:[&>rect:first-child]:fill-white/10"
              >
                <rect x={x} y={0} width={slot} height={H} fill="transparent" />
                {m.asolJobs.length > 0 && (
                  <rect
                    x={x + (slot - barW) / 2}
                    y={barBottom - h}
                    width={barW}
                    height={h}
                    rx={2}
                    fill="#818cf8"
                  />
                )}
                {m.wten && (
                  <path d={`M ${x + slot / 2} ${barBottom + 6} l 3.5 7 h -7 z`} fill="#fbbf24" />
                )}
              </g>
            )
          })}
        </svg>
        <div
          className="pointer-events-none absolute right-0 top-0 flex flex-col justify-between text-right text-[10px] text-zinc-400"
          style={{ height: `${(barBottom / H) * 100}%` }}
          aria-hidden="true"
        >
          <span>
            {maxJobs} job{maxJobs === 1 ? '' : 's'}
          </span>
          <span>0</span>
        </div>
      </div>
      {/* Axis labels in HTML so they stay legible when the SVG scales down on phones. */}
      <div className="relative h-4 text-[10px] text-zinc-400" aria-hidden="true">
        {[0, 15, 30, 45].map(t => (
          <span key={t} className="absolute" style={{ left: `${(t / 60) * 100}%` }}>
            :{String(t).padStart(2, '0')}
          </span>
        ))}
      </div>
      <p className="mt-1 flex flex-wrap gap-4 text-[11px] text-zinc-300">
        <span>
          <span aria-hidden="true" className="text-indigo-300">
            ■
          </span>{' '}
          ASOL job
        </span>
        <span>
          <span aria-hidden="true" className="text-amber-300">
            ▲
          </span>{' '}
          WTEN cron (avoid)
        </span>
      </p>
      <SrOnly>
        <table>
          <caption>Crons by minute of the hour</caption>
          <thead>
            <tr>
              <th>Minute</th>
              <th>ASOL jobs</th>
              <th>WTEN</th>
            </tr>
          </thead>
          <tbody>
            {minutes
              .filter(m => m.asolJobs.length > 0 || m.wten)
              .map(m => (
                <tr key={m.minute}>
                  <td>:{String(m.minute).padStart(2, '0')}</td>
                  <td>{m.asolJobs.join(', ') || 'none'}</td>
                  <td>{m.wten ? 'yes' : 'no'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </SrOnly>
    </div>
  )
}

export function JobsView({ data }: { data: JobsReportPayload }) {
  const reason =
    data.heartbeats.status === 'live'
      ? ''
      : `Heartbeats ${data.heartbeats.status.replace('_', ' ')}: ${data.heartbeats.reason}`
  const clashes = data.minutes.filter(
    m => m.asolJobs.length > 1 || (m.asolJobs.length > 0 && m.wten)
  )
  return (
    <>
      <SourceNotice status={data.heartbeats} />
      <AlertList alerts={data.alerts} />
      <Card
        title="Minute of the hour"
        subtitle="ASOL's hourly-or-faster crons against WTEN's. A shared minute piles both apps' load onto WTEN's database at once."
        action={
          clashes.length === 0 ? (
            <Badge glyph="✓" label="No clashes" tone="ok" />
          ) : (
            <Badge
              glyph="✕"
              label={`${clashes.length} clash${clashes.length === 1 ? '' : 'es'}`}
              tone="bad"
            />
          )
        }
      >
        <MinuteChart minutes={data.minutes} />
      </Card>
      <Card
        title="Jobs"
        subtitle="Late = no run for (2 × interval, or 1 × for daily jobs) + max(15m, 10%). Failing = two failures in a row (one for daily jobs). One failure is “retrying” and does not alert — the same rules as WTEN."
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {data.jobs.map(job => (
            <JobCard key={job.name} job={job} reason={reason} />
          ))}
        </div>
      </Card>
    </>
  )
}

export function JobsPage() {
  const { loaded, refresh } = useValidatedPoll('/api/admin/jobs', JobsReportSchema, 60_000)
  const data =
    loaded.state === 'ok' ? loaded.data : loaded.state === 'error' ? loaded.stale : undefined
  return (
    <AdminFrame
      title="Jobs & crons"
      description="Every scheduled ASOL job, judged from its recorded heartbeats. Times are UTC; the time limit is the Vercel project default."
      updated={data ? `Read ${formatAgo(data.generatedAt)}` : undefined}
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && <JobsView data={data} />}
    </AdminFrame>
  )
}
