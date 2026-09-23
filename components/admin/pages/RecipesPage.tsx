'use client'

import type { ReactNode } from 'react'
import { RecipeLatencyReportSchema, type RecipeLatencyPayload } from '@/lib/admin/page-schemas'
import { cn } from '@/lib/utils'
import { AdminFrame } from './AdminFrame'
import {
  AlertList,
  Card,
  LoadState,
  ScrollTable,
  SourceNotice,
  formatAgo,
  formatDuration,
  num,
  td,
  th,
  useValidatedPoll,
} from './primitives'

function Stat({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-zinc-950/60 p-3">
      <dt className="text-[11px] text-zinc-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-zinc-50">{children}</dd>
      {note && <p className="mt-0.5 text-[11px] text-zinc-400">{note}</p>}
    </div>
  )
}

/** p95 against WTEN's 45s budget: a thin bar starting at zero. */
function BudgetMeter({
  p95,
  budget,
  reason,
}: {
  p95: number | null
  budget: number
  reason: string
}) {
  const share = p95 === null ? 0 : Math.min(1, p95 / budget)
  return (
    <div>
      <div className="flex justify-between text-[11px] text-zinc-400">
        <span>p95 {num(p95, reason, formatDuration)}</span>
        <span>WTEN budget {formatDuration(budget)}</span>
      </div>
      <div
        className="mt-1 h-1.5 rounded-full bg-white/10"
        role="meter"
        aria-label="p95 generation time against WTEN's prewarm budget"
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={p95 ?? undefined}
      >
        {p95 !== null && (
          <div
            className={cn(
              'h-1.5 rounded-full',
              share >= 1 ? 'bg-rose-400' : share > 0.7 ? 'bg-amber-400' : 'bg-sky-400'
            )}
            style={{ width: `${Math.max(2, share * 100)}%` }}
          />
        )}
      </div>
    </div>
  )
}

export function RecipesView({ data }: { data: RecipeLatencyPayload }) {
  const s = data.summary
  const reason =
    data.source.status === 'live'
      ? 'No generations in the window.'
      : `Latency source ${data.source.status.replace('_', ' ')}: ${data.source.reason}`
  const providers = s ? Object.entries(s.byProvider).sort((a, b) => b[1].count - a[1].count) : []
  return (
    <>
      <AlertList alerts={data.alerts} />
      <SourceNotice status={data.source} />
      <Card
        title="/api/generate-recipe"
        subtitle={
          s ? (
            <>
              Counted by the Python backend since {formatAgo(s.countingSince)} (process start{' '}
              {new Date(s.processStartedAt).toLocaleString()}); resets on each deploy. Cache hits
              are excluded from latency.
            </>
          ) : (
            'The Python backend keeps an in-process window of generation times.'
          )
        }
      >
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="p50">{num(s?.p50Ms, reason, formatDuration)}</Stat>
          <Stat label="p95">{num(s?.p95Ms, reason, formatDuration)}</Stat>
          <Stat
            label="Error rate"
            note={s ? `${s.errors} of ${s.generated + s.errors} generations` : undefined}
          >
            {num(
              s?.errorRate,
              s ? 'No generation attempts in the window.' : reason,
              v => `${(v * 100).toFixed(1)}%`
            )}
          </Stat>
          <Stat label="Generated / cache hits">
            {s ? (
              <span>
                {s.generated.toLocaleString('en-US')} / {s.cacheHits.toLocaleString('en-US')}
              </span>
            ) : (
              num(null, reason)
            )}
          </Stat>
        </dl>
        <div className="mt-4">
          <BudgetMeter p95={s?.p95Ms ?? null} budget={data.wtenBudgetMs} reason={reason} />
        </div>
      </Card>

      <Card
        title="By provider"
        subtitle="Which model in the fallback chain produced each recipe, and how long it took."
      >
        {providers.length === 0 ? (
          <p className="text-sm text-zinc-300">
            {s ? 'No generations in the window.' : num(null, reason)}
          </p>
        ) : (
          <ScrollTable label="Recipe generation by provider">
            <thead>
              <tr>
                <th className={th}>Provider</th>
                <th className={th}>Recipes</th>
                <th className={th}>p50</th>
                <th className={th}>p95</th>
              </tr>
            </thead>
            <tbody>
              {providers.map(([name, p]) => (
                <tr key={name}>
                  <td className={cn(td, 'font-mono')}>{name}</td>
                  <td className={td}>{p.count}</td>
                  <td className={td}>{num(p.p50Ms, 'No samples', formatDuration)}</td>
                  <td className={td}>{num(p.p95Ms, 'No samples', formatDuration)}</td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        )}
        <p className="mt-3 text-[11px] text-zinc-400">
          Not measured yet: how often each provider in the chain is tried and skipped (fallback
          rate). The backend logs <code className="text-zinc-300">fallback_event</code> lines but
          does not count them anywhere this page can read.
        </p>
      </Card>
    </>
  )
}

export function RecipesPage() {
  const { loaded, refresh } = useValidatedPoll(
    '/api/admin/recipe-latency',
    RecipeLatencyReportSchema,
    60_000
  )
  const data =
    loaded.state === 'ok' ? loaded.data : loaded.state === 'error' ? loaded.stale : undefined
  return (
    <AdminFrame
      title="Recipe generation"
      description="Latency and failures of /api/generate-recipe, which WTEN's hourly prewarm calls with a 45-second budget per recipe."
      updated={data ? `Read ${formatAgo(data.generatedAt)}` : undefined}
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && <RecipesView data={data} />}
    </AdminFrame>
  )
}
