'use client'

/**
 * Shared primitives for operator-console panels.
 *
 * The original panels each re-declared their own metric card, section header
 * and empty state, so the console drifted visually tab to tab. New panels build
 * from here; the tone scale and spacing match the existing glassmorphic shell in
 * `AdminOperatorConsole`.
 */

import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, Info, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdminAlert, AlertSeverity } from '@/lib/admin/alerts'

export type Tone = 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' | 'zinc'

const TONE_RING: Record<Tone, string> = {
  sky: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
  emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  rose: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
  violet: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
  zinc: 'border-white/10 bg-white/5 text-zinc-300',
}

const TONE_BAR: Record<Tone, string> = {
  sky: 'bg-sky-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  violet: 'bg-violet-400',
  zinc: 'bg-zinc-400',
}

export function formatNumber(value: number | null | undefined, maximumFractionDigits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    notation: Math.abs(value) >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits,
  }).format(value)
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'n/a'
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "4m ago" / "3d ago" — for freshness, where the absolute time is noise. */
export function formatAge(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return 'never'
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`
  return `${Math.round(minutes / (60 * 24))}d ago`
}

export function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'sky',
}: {
  icon?: LucideIcon
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: Tone
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/40 p-5 backdrop-blur-md transition-all duration-300 hover:border-white/10 hover:bg-zinc-900/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
          <p className="mt-2 truncate text-3xl font-black text-zinc-50">{value}</p>
          {detail && <p className="mt-1 text-xs font-medium text-zinc-500">{detail}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
              TONE_RING[tone]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  )
}

export function Section({
  title,
  icon: Icon,
  children,
  action,
  subtitle,
}: {
  title: string
  icon?: LucideIcon
  children: ReactNode
  action?: ReactNode
  subtitle?: string
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/20 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-zinc-950/20 px-5 py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-300">
            {Icon && <Icon className="h-4 w-4 text-indigo-400" />}
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-[11px] text-zinc-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

/**
 * Panel header. Every new panel opens with one so the operator always knows
 * which subsystem they are looking at and when it was last read.
 */
export function PanelHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  tone = 'sky',
  action,
}: {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
  tone?: Tone
  action?: ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-zinc-900/60 via-zinc-950/40 to-zinc-950 p-6 backdrop-blur-md">
      <div
        className={cn(
          'absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full blur-3xl opacity-40',
          TONE_BAR[tone]
        )}
      />
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]',
              TONE_RING[tone]
            )}
          >
            <Icon className="h-3 w-3" />
            {eyebrow}
          </div>
          <h3 className="mt-1.5 text-2xl font-black tracking-tight text-zinc-50">{title}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">{description}</p>
        </div>
        {action}
      </div>
    </div>
  )
}

export function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-center text-xs text-zinc-500">
      {label}
    </div>
  )
}

export function PanelSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-6">
      <div className="h-28 animate-pulse rounded-2xl border border-white/5 bg-zinc-900/40" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-white/5 bg-zinc-900/40"
          />
        ))}
      </div>
    </div>
  )
}

/**
 * A panel that failed to load says so. A degraded read must never be
 * indistinguishable from a healthy-but-empty one.
 */
export function PanelError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-200">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
        <XCircle className="h-4 w-4" />
        Panel failed to load
      </div>
      <p className="mt-2 font-mono text-xs leading-relaxed text-rose-100/80">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-100 transition hover:bg-rose-500/20"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function Pill({ tone = 'zinc', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]',
        TONE_RING[tone]
      )}
    >
      {children}
    </span>
  )
}

export function Bar({ value, max, tone = 'sky' }: { value: number; max: number; tone?: Tone }) {
  const width = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
      <div className={cn('h-full rounded-full', TONE_BAR[tone])} style={{ width: `${width}%` }} />
    </div>
  )
}

/** Label/value row — the workhorse for config and status readouts. */
export function KeyValue({ label, value, tone }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-2 last:border-0">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <span
        className={cn(
          'truncate text-right font-mono text-xs font-bold',
          tone ? TONE_RING[tone].split(' ').pop() : 'text-zinc-200'
        )}
      >
        {value}
      </span>
    </div>
  )
}

const SEVERITY_TONE: Record<AlertSeverity, Tone> = {
  critical: 'rose',
  warning: 'amber',
  info: 'sky',
}

const SEVERITY_ICON: Record<AlertSeverity, LucideIcon> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
}

export function AlertRow({
  alert,
  onNavigate,
}: {
  alert: AdminAlert
  onNavigate?: (href: string) => void
}) {
  const Icon = SEVERITY_ICON[alert.severity]
  const tone = SEVERITY_TONE[alert.severity]

  const isTab = alert.href?.startsWith('tab:')
  const body = (
    <>
      <div className={cn('mt-0.5 shrink-0 rounded-lg border p-1.5', TONE_RING[tone])}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold text-zinc-100">{alert.title}</p>
          <Pill tone="zinc">{alert.source}</Pill>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{alert.detail}</p>
        {alert.remediation && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
            <span className="font-bold text-zinc-400">Next:</span> {alert.remediation}
          </p>
        )}
      </div>
    </>
  )

  if (isTab && onNavigate && alert.href) {
    return (
      <button
        type="button"
        onClick={() => onNavigate(alert.href!.slice(4))}
        className="flex w-full items-start gap-3 rounded-xl border border-white/5 bg-zinc-950/30 p-3.5 text-left transition hover:border-white/15 hover:bg-zinc-900/50"
      >
        {body}
      </button>
    )
  }

  if (alert.href) {
    return (
      <a
        href={alert.href}
        target={alert.href.startsWith('http') ? '_blank' : undefined}
        rel="noreferrer"
        className="flex items-start gap-3 rounded-xl border border-white/5 bg-zinc-950/30 p-3.5 transition hover:border-white/15 hover:bg-zinc-900/50"
      >
        {body}
      </a>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-zinc-950/30 p-3.5">
      {body}
    </div>
  )
}

export function StatusDot({
  ok,
  label,
  unknown = false,
}: {
  ok: boolean
  label: string
  unknown?: boolean
}) {
  const Icon = unknown ? CircleDashed : ok ? CheckCircle2 : XCircle
  const tone: Tone = unknown ? 'sky' : ok ? 'emerald' : 'rose'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]',
        TONE_RING[tone]
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}
