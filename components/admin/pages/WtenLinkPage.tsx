'use client'

import { WtenLinkReportSchema, type WtenLinkPayload } from '@/lib/admin/page-schemas'
import { cn } from '@/lib/utils'
import { AdminFrame } from './AdminFrame'
import {
  AlertList,
  Badge,
  Card,
  LoadState,
  ScrollTable,
  SourceNotice,
  SrOnly,
  formatAgo,
  formatDuration,
  num,
  td,
  th,
  useChartTooltip,
  useValidatedPoll,
} from './primitives'

type Endpoint = NonNullable<WtenLinkPayload['endpoints']>[number]
type Split = Endpoint['split']

const VERDICT = {
  match: { glyph: '✓', label: 'Matches WTEN', tone: 'ok' },
  mismatch: { glyph: '✕', label: 'Rejected by WTEN', tone: 'bad' },
  not_configured: { glyph: '○', label: 'Not set here', tone: 'bad' },
  unknown: { glyph: '—', label: 'Unknown', tone: 'muted' },
} as const

/** Order, word and glyph for each outcome; colour only reinforces. */
const SEGMENTS: Array<{ key: keyof Split; label: string; glyph: string; color: string }> = [
  { key: 'ok2xx', label: '2xx', glyph: '✓', color: '#34d399' },
  { key: 'alreadyApplied409', label: '409 already applied', glyph: '≡', color: '#6ee7b7' },
  { key: 'insufficientFunds402', label: '402 insufficient funds', glyph: '¤', color: '#fbbf24' },
  { key: 'otherClient4xx', label: 'other 4xx', glyph: '!', color: '#fb923c' },
  { key: 'server5xx', label: '5xx', glyph: '✕', color: '#f87171' },
  { key: 'timeouts', label: 'timeout', glyph: '⧗', color: '#e879f9' },
  { key: 'networkErrors', label: 'no answer', glyph: '∅', color: '#a1a1aa' },
]

/** Thin stacked bar of outcomes, starting at zero, with a tooltip and a hidden table. */
function SplitBar({ endpoint }: { endpoint: Endpoint }) {
  const { ref, show, hide, Tooltip } = useChartTooltip()
  const total = SEGMENTS.reduce((n, s) => n + endpoint.split[s.key], 0)
  let offset = 0
  return (
    <div className="relative" ref={ref} onMouseLeave={hide}>
      <Tooltip />
      <svg
        viewBox="0 0 100 4"
        preserveAspectRatio="none"
        className="h-2 w-full rounded"
        role="img"
        aria-label={`Outcomes for ${endpoint.endpoint}`}
      >
        <rect x={0} y={0} width={100} height={4} fill="rgba(255,255,255,0.08)" />
        {total > 0 &&
          SEGMENTS.map(s => {
            const value = endpoint.split[s.key]
            if (value === 0) return null
            const width = (value / total) * 100
            const x = offset
            offset += width
            const text = `${s.label}: ${value} of ${total} (${Math.round((value / total) * 100)}%)`
            return (
              <rect
                key={s.key}
                x={x}
                y={0}
                width={width}
                height={4}
                fill={s.color}
                onMouseMove={e => show(e.clientX, text)}
              />
            )
          })}
      </svg>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-300">
        {SEGMENTS.filter(s => endpoint.split[s.key] > 0).map(s => (
          <li key={s.key}>
            <span aria-hidden="true" style={{ color: s.color }}>
              {s.glyph}
            </span>{' '}
            {s.label} <strong className="text-zinc-100">{endpoint.split[s.key]}</strong>
          </li>
        ))}
      </ul>
      <SrOnly>
        <table>
          <caption>Delivery outcomes for {endpoint.endpoint}</caption>
          <tbody>
            {SEGMENTS.map(s => (
              <tr key={s.key}>
                <th>{s.label}</th>
                <td>{endpoint.split[s.key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SrOnly>
    </div>
  )
}

function EndpointCard({ e }: { e: Endpoint }) {
  return (
    <article className="min-w-0 rounded-xl border border-white/10 bg-zinc-950/60 p-4 text-zinc-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="break-all font-mono text-sm font-semibold text-zinc-50">{e.endpoint}</h3>
        {e.receiverDedupes === false ? (
          <Badge
            glyph="!"
            label="WTEN does not dedupe yet"
            tone="warn"
            title="Only failures that never reached WTEN are retried."
          />
        ) : e.receiverDedupes ? (
          <Badge glyph="✓" label="WTEN dedupes" tone="ok" />
        ) : null}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-zinc-400">Attempts</dt>
          <dd className="font-semibold text-zinc-100">{e.attempts.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Events</dt>
          <dd className="font-semibold text-zinc-100">{e.events.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">p95 latency</dt>
          <dd className="font-semibold text-zinc-100">
            {num(e.p95LatencyMs, 'No attempts in the window.', formatDuration)}
            {e.timeoutMs !== null && (
              <span className="font-normal text-zinc-400"> / {formatDuration(e.timeoutMs)}</span>
            )}
          </dd>
        </div>
      </dl>
      <div className="mt-3">
        <SplitBar endpoint={e} />
      </div>
      {e.lastError && (
        <p className="mt-3 break-words rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-100">
          <span aria-hidden="true">✕ </span>
          Last error {formatAgo(e.lastError.at)}
          {e.lastError.status !== null ? ` (HTTP ${e.lastError.status})` : ' (no answer)'}:{' '}
          {e.lastError.message}
        </p>
      )}
    </article>
  )
}

export function WtenLinkView({ data }: { data: WtenLinkPayload }) {
  const deliveryReason =
    data.deliveries.status === 'live'
      ? ''
      : `Delivery log ${data.deliveries.status.replace('_', ' ')}: ${data.deliveries.reason}`
  return (
    <>
      <AlertList alerts={data.alerts} />
      <Card
        title="Shared secrets"
        subtitle="Judged from the status WTEN answers a harmless probe with (re-checked every 5 minutes). ASOL never reads WTEN's values."
      >
        <ul className="space-y-3">
          {data.secrets.map(s => {
            const v = VERDICT[s.verdict]
            return (
              <li
                key={s.secret}
                className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3"
              >
                <div className="flex shrink-0 items-center gap-2 sm:w-72">
                  <code className="text-xs text-zinc-100">{s.secret}</code>
                </div>
                <div className="min-w-0 text-xs text-zinc-300">
                  <Badge glyph={v.glyph} label={v.label} tone={v.tone} />
                  <p className="mt-1 break-words">{s.detail}</p>
                  <p className="mt-0.5 break-words text-zinc-500">
                    Probe: {s.probe} · {s.status === null ? 'no answer' : `HTTP ${s.status}`} ·{' '}
                    {formatAgo(s.checkedAt)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      <SourceNotice status={data.deliveries} />

      <Card
        title={`Deliveries by endpoint (${data.windowHours}h)`}
        subtitle="Every attempt ASOL makes to WTEN, written by the shared delivery client. 409 on sync-credit / sync-debit means already applied — success."
      >
        {data.endpoints === null ? (
          <p className="text-sm">
            {num(null, deliveryReason)} <span className="text-zinc-400">{deliveryReason}</span>
          </p>
        ) : data.endpoints.length === 0 ? (
          <p className="text-sm text-zinc-300">
            No deliveries recorded in the last {data.windowHours} hours (the log was read and is
            empty).
          </p>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {data.endpoints.map(e => (
              <EndpointCard key={e.endpoint} e={e} />
            ))}
          </div>
        )}
      </Card>

      <Card title="Latest attempts" subtitle="Newest first; retried attempts share an event ID.">
        {data.recent === null ? (
          <p className="text-sm">
            {num(null, deliveryReason)} <span className="text-zinc-400">{deliveryReason}</span>
          </p>
        ) : data.recent.length === 0 ? (
          <p className="text-sm text-zinc-300">No attempts recorded.</p>
        ) : (
          <ScrollTable label="Latest delivery attempts">
            <thead>
              <tr>
                <th className={th}>When</th>
                <th className={th}>Endpoint</th>
                <th className={th}>Event ID</th>
                <th className={th}>Try</th>
                <th className={th}>Status</th>
                <th className={th}>Result</th>
                <th className={th}>Latency</th>
                <th className={th}>Error</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r, i) => (
                <tr key={`${r.eventId}-${r.attempt}-${i}`}>
                  <td className={cn(td, 'whitespace-nowrap')}>{formatAgo(r.at)}</td>
                  <td className={cn(td, 'font-mono')}>{r.endpoint}</td>
                  <td className={cn(td, 'max-w-[220px] truncate font-mono')} title={r.eventId}>
                    {r.eventId}
                  </td>
                  <td className={td}>{r.attempt}</td>
                  <td className={td}>{r.status ?? '—'}</td>
                  <td className={td}>{r.result}</td>
                  <td className={cn(td, 'whitespace-nowrap')}>{formatDuration(r.latencyMs)}</td>
                  <td className={cn(td, 'max-w-[240px] truncate')} title={r.error ?? ''}>
                    {r.error ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        )}
      </Card>
    </>
  )
}

export function WtenLinkPage() {
  const { loaded, refresh } = useValidatedPoll('/api/admin/wten-link', WtenLinkReportSchema, 60_000)
  const data =
    loaded.state === 'ok' ? loaded.data : loaded.state === 'error' ? loaded.stale : undefined
  return (
    <AdminFrame
      title="WTEN link"
      description="How ASOL's requests to WTEN (alchm.kitchen) are landing, and whether the two apps share their secrets. The ASOL mirror of WTEN's webhook_events."
      updated={data ? `Read ${formatAgo(data.generatedAt)}` : undefined}
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && <WtenLinkView data={data} />}
    </AdminFrame>
  )
}
