'use client'

/**
 * Building blocks for the route-level admin pages.
 *
 * The standard every page meets:
 *  - every number comes from a live source; a failed read renders "—" plus the
 *    reason, never 0 (a real, read zero renders 0);
 *  - payloads are zod-validated before rendering (see lib/admin/page-schemas.ts);
 *  - status is never shown by colour alone — always a glyph and a word;
 *  - charts are thin, start at zero, have a tooltip, and carry a hidden data
 *    table for screen readers;
 *  - everything works at 375px without horizontal page scroll.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ZodType } from 'zod'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export type Loaded<T> =
  | { state: 'loading' }
  | { state: 'ok'; data: T; fetchedAt: number }
  | { state: 'error'; reason: string; fetchedAt: number; stale?: T }

/** Poll a JSON endpoint and validate it. Keeps the last good payload visible, marked stale, on a failed refresh. */
export function useValidatedPoll<T>(url: string, schema: ZodType<T>, intervalMs = 60_000) {
  const [loaded, setLoaded] = useState<Loaded<T>>({ state: 'loading' })
  const last = useRef<T | undefined>(undefined)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        const detail =
          body && typeof body === 'object' && 'error' in body
            ? `: ${String((body as any).error)}`
            : ''
        throw new Error(`HTTP ${res.status}${detail}`)
      }
      const parsed = schema.safeParse(body)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new Error(
          `Response did not match the expected shape (${issue?.path.join('.') || 'root'}: ${issue?.message})`
        )
      }
      last.current = parsed.data
      setLoaded({ state: 'ok', data: parsed.data, fetchedAt: Date.now() })
    } catch (err) {
      setLoaded({
        state: 'error',
        reason: err instanceof Error ? err.message : String(err),
        fetchedAt: Date.now(),
        stale: last.current,
      })
    }
  }, [url, schema])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { loaded, refresh }
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** "—" with the reason available on hover, focus, and to screen readers. */
export function Unknown({ reason }: { reason: string }) {
  return (
    <span
      className="cursor-help text-zinc-500"
      title={reason}
      tabIndex={0}
      aria-label={`unknown: ${reason}`}
    >
      —
    </span>
  )
}

/** A section of a payload: `{ ok: true, value } | { ok: false, reason }`. */
export type Section<T> = { ok: true; value: T } | { ok: false; reason: string }

/** Render a section's value, or "—" plus the reason when it could not be read. */
export function Read<T>({
  section,
  children,
}: {
  section: Section<T>
  children: (value: T) => ReactNode
}) {
  if (!section.ok) {
    return (
      <p className="text-sm text-zinc-300">
        <Unknown reason={section.reason} />{' '}
        <span className="text-zinc-400">Could not read: {section.reason}</span>
      </p>
    )
  }
  return <>{children(section.value)}</>
}

/** One headline number with its label; `value` is already rendered (use `num`). */
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-3">
      <p className="text-[11px] text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-50">{value}</p>
      {sub && <p className="mt-0.5 break-words text-[11px] text-zinc-400">{sub}</p>}
    </div>
  )
}

export function num(
  value: number | null | undefined,
  reason: string,
  format?: (v: number) => string
) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return <Unknown reason={reason} />
  return <span>{format ? format(value) : value.toLocaleString('en-US')}</span>
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

export function formatAgo(iso: string | null, nowMs: number = Date.now()): string {
  if (!iso) return 'never'
  const minutes = Math.round((nowMs - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`
  return `${Math.round(minutes / 1440)}d ago`
}

// ---------------------------------------------------------------------------
// Status: glyph + word, colour only reinforces
// ---------------------------------------------------------------------------

export type Tone = 'ok' | 'warn' | 'bad' | 'muted'

const TONE: Record<Tone, string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  bad: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  muted: 'border-white/10 bg-white/5 text-zinc-300',
}

export function Badge({
  glyph,
  label,
  tone,
  title,
}: {
  glyph: string
  label: string
  tone: Tone
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold',
        TONE[tone]
      )}
    >
      <span aria-hidden="true">{glyph}</span>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-zinc-900/40">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-white/5 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-200">{title}</h2>
          {subtitle && <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="min-w-0 p-4 text-zinc-200">{children}</div>
    </section>
  )
}

export function SourceNotice({ status }: { status: { status: string; reason?: string } }) {
  if (status.status === 'live') return null
  const unreadable = status.status === 'unavailable'
  return (
    <div
      role="status"
      className={cn('rounded-xl border px-4 py-3 text-sm', unreadable ? TONE.bad : TONE.warn)}
    >
      <span aria-hidden="true">{unreadable ? '✕ ' : '○ '}</span>
      <strong>{unreadable ? 'Source unreadable' : 'Source not provisioned'}:</strong>{' '}
      {status.reason}
      <span className="block text-xs text-zinc-300">
        Numbers from this source show as “—”, not 0.
      </span>
    </div>
  )
}

export function LoadState({ loaded, onRetry }: { loaded: Loaded<unknown>; onRetry: () => void }) {
  if (loaded.state === 'loading') {
    return (
      <p className="text-sm text-zinc-400" role="status">
        Loading…
      </p>
    )
  }
  if (loaded.state === 'error') {
    return (
      <div role="alert" className={cn('rounded-xl border px-4 py-3 text-sm', TONE.bad)}>
        <span aria-hidden="true">✕ </span>
        <strong>Could not load:</strong> {loaded.reason}
        {loaded.stale !== undefined && (
          <span className="block text-xs">Showing the last good read below.</span>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 block rounded-md border border-white/20 px-2 py-1 text-xs text-zinc-100 hover:bg-white/10"
        >
          Retry
        </button>
      </div>
    )
  }
  return null
}

/** A table that scrolls inside its card, never the page. */
export function ScrollTable({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[640px] border-collapse text-left text-xs text-zinc-200">
        {children}
      </table>
    </div>
  )
}

export const th =
  'border-b border-white/10 px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400'
export const td = 'border-b border-white/5 px-2 py-2 align-top text-zinc-200'

/** Visually hidden, read by screen readers. */
export function SrOnly({ children }: { children: ReactNode }) {
  return <div className="sr-only">{children}</div>
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

/**
 * Tooltip that stays inside its chart: positioned from the hovered point and
 * clamped to the container's width, so it never clips at the edges.
 */
export function useChartTooltip() {
  const ref = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ x: number; text: string } | null>(null)
  const show = (clientX: number, text: string) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    setTip({ x: clientX - box.left, text })
  }
  const Tooltip = () => {
    if (!tip) return null
    const width = ref.current?.clientWidth ?? 0
    const tipWidth = 200
    const left = Math.min(Math.max(0, tip.x - tipWidth / 2), Math.max(0, width - tipWidth))
    return (
      <div
        role="tooltip"
        className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-md border border-white/15 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100 shadow-lg"
        style={{ left, width: tipWidth }}
      >
        {tip.text}
      </div>
    )
  }
  return { ref, show, hide: () => setTip(null), Tooltip }
}

export function AlertList({
  alerts,
}: {
  alerts: Array<{
    id: string
    severity: 'critical' | 'warning' | 'info'
    title: string
    detail: string
    remediation?: string
  }>
}) {
  if (alerts.length === 0) return null
  return (
    <ul className="space-y-2" aria-label="Alerts">
      {alerts.map(a => (
        <li
          key={a.id}
          className={cn(
            'break-words rounded-xl border px-4 py-3 text-sm',
            a.severity === 'critical' ? TONE.bad : a.severity === 'warning' ? TONE.warn : TONE.muted
          )}
        >
          <span aria-hidden="true">
            {a.severity === 'critical' ? '✕ ' : a.severity === 'warning' ? '! ' : 'i '}
          </span>
          <strong>
            {a.severity === 'critical' ? 'Critical' : a.severity === 'warning' ? 'Warning' : 'Note'}
            : {a.title}
          </strong>
          <span className="block text-xs opacity-90">{a.detail}</span>
          {a.remediation && <span className="block text-xs opacity-90">{a.remediation}</span>}
        </li>
      ))}
    </ul>
  )
}
