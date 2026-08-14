'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Bug,
  FileCode2,
  FlaskConical,
  GitCommitHorizontal,
  ListChecks,
  ShieldCheck,
  Stars,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdminAlert } from '@/lib/admin/alerts'
import type { CodebaseHealthManifest } from '@/lib/admin/codebase-health-types'
import {
  AlertRow,
  Bar,
  Empty,
  KeyValue,
  Metric,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  Pill,
  Section,
  StatusDot,
  formatAge,
  formatDateTime,
  formatNumber,
  type Tone,
} from './ui'

export type CodebaseHealthPayload = {
  generatedAt: string
  /** The committed manifest, plus the freshness the route computed for it. */
  manifest: CodebaseHealthManifest & {
    ageMinutes: number | null
    stale: boolean
    staleAfterDays: number
  }
  live: {
    totalAgents: number
    agentsNeverConsulted: number
    agentsWithoutNatalChart: number
    conversationsTotal: number
    conversationsMissingModel: number
    orphanProfiles: number
  } | null
  liveError: string | null
  alerts: AdminAlert[]
}

const MARKER_TONE: Record<string, Tone> = {
  todo: 'sky',
  fixme: 'amber',
  hack: 'amber',
  xxx: 'rose',
  'not-implemented': 'rose',
  'ts-expect': 'violet',
  'skipped-test': 'amber',
}

export default function CodebaseHealthPanel({
  data,
  loading,
  error,
  onRetry,
  onNavigate,
}: {
  data: CodebaseHealthPayload | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onNavigate?: (tab: string) => void
}) {
  const [showAllUntested, setShowAllUntested] = useState(false)

  if (error) return <PanelError message={error} onRetry={onRetry} />
  if (loading && !data) return <PanelSkeleton />
  if (!data) return <Empty label="Codebase health manifest is unavailable." />

  const { manifest, live } = data
  const maxArea = Math.max(1, ...manifest.byArea.map(a => a.count))
  const untestedShown = showAllUntested
    ? manifest.routeCoverage.untested
    : manifest.routeCoverage.untested.slice(0, 12)

  return (
    <div className="space-y-6">
      <PanelHeader
        eyebrow="Codebase Health"
        title="Weak Points & Unfinished Work"
        description="A build-time scan of the source tree paired with live database signals: repo invariant gates, natal-chart provenance debt, API route test coverage, type-safety escape hatches, and every unfinished-work marker left in the code."
        icon={Wrench}
        tone="rose"
        action={
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <StatusDot
                ok={!manifest.stale}
                label={manifest.stale ? 'manifest stale' : 'manifest fresh'}
              />
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-zinc-500">
              scanned {formatAge(manifest.ageMinutes)}
              {manifest.commit && (
                <>
                  {' · '}
                  <GitCommitHorizontal className="inline h-3 w-3" /> {manifest.commit}
                </>
              )}
            </p>
          </div>
        }
      />

      {manifest.stale && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-100/90">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            This picture is {formatAge(manifest.ageMinutes)}, not live
          </div>
          <p className="mt-2">
            The manifest was scanned at commit{' '}
            <span className="font-mono">{manifest.commit ?? 'unknown'}</span> on branch{' '}
            <span className="font-mono">{manifest.branch ?? 'unknown'}</span>. Anything merged since
            is invisible here. Regenerate with{' '}
            <span className="font-mono">bun run generate:codebase-health</span>.
          </p>
        </div>
      )}

      {data.alerts.length > 0 && (
        <Section title="Codebase Findings" icon={AlertTriangle}>
          <div className="space-y-2.5">
            {data.alerts.map(alert => (
              <AlertRow key={alert.id} alert={alert} onNavigate={onNavigate} />
            ))}
          </div>
        </Section>
      )}

      {/* Headline */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={FileCode2}
          label="Scanned"
          value={formatNumber(manifest.totals.files)}
          detail={`${formatNumber(manifest.totals.lines)} lines`}
          tone="sky"
        />
        <Metric
          icon={ListChecks}
          label="Unfinished Markers"
          value={formatNumber(manifest.totals.markers)}
          detail={`${manifest.totals.markerDensityPerKLoc}/kLoc`}
          tone={manifest.totals.markers > 0 ? 'amber' : 'emerald'}
        />
        <Metric
          icon={FlaskConical}
          label="Route Coverage"
          value={`${manifest.routeCoverage.coveragePct}%`}
          detail={`${manifest.routeCoverage.untestedCount} of ${manifest.routeCoverage.totalRoutes} untested`}
          tone={manifest.routeCoverage.coveragePct < 50 ? 'rose' : 'emerald'}
        />
        <Metric
          icon={Stars}
          label="Placeholder Charts"
          value={formatNumber(manifest.natalProvenance.placeholders.length)}
          detail={`of ${manifest.natalProvenance.total} historical agents`}
          tone={manifest.natalProvenance.placeholders.length > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* Gates */}
      <Section
        title="Repo Invariant Gates"
        icon={ShieldCheck}
        subtitle="Run for real during the scan — a gate reported as merely 'configured' tells you nothing"
      >
        {manifest.gates.length === 0 ? (
          <Empty label="Gates were skipped during this scan." />
        ) : (
          <div className="space-y-3">
            {manifest.gates.map(gate => (
              <div
                key={gate.id}
                className={cn(
                  'rounded-xl border p-4',
                  gate.passing
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-rose-500/25 bg-rose-500/10'
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-100">{gate.label}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{gate.command}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-zinc-500">{gate.durationMs}ms</span>
                    <StatusDot ok={gate.passing} label={gate.passing ? 'pass' : 'fail'} />
                  </div>
                </div>
                {!gate.passing && gate.output && (
                  <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-[10px] leading-relaxed text-rose-200">
                    {gate.output}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Natal provenance */}
        <Section
          title="Natal Chart Provenance Debt"
          icon={Stars}
          subtitle="A placeholder chart is a chart nobody derived — everything downstream of it is unfounded"
        >
          {!manifest.natalProvenance.available ? (
            <Empty label="Agent source tree was not readable during the scan." />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(manifest.natalProvenance.counts).map(([kind, count]) => (
                  <Pill
                    key={kind}
                    tone={kind === 'computed' ? 'emerald' : kind === 'authored' ? 'sky' : 'rose'}
                  >
                    {kind} {count}
                  </Pill>
                ))}
              </div>

              {manifest.natalProvenance.placeholders.length === 0 ? (
                <Empty label="No agent is on a placeholder chart." />
              ) : (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Agents awaiting a real chart
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {manifest.natalProvenance.placeholders.map(agent => (
                      <span
                        key={agent}
                        className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 font-mono text-[10px] text-rose-200"
                      >
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Type escapes */}
        <Section
          title="Type Safety Escape Hatches"
          icon={Bug}
          subtitle="next.config.mjs sets ignoreBuildErrors, so the build will not police these for you"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Metric
                icon={Bug}
                label="any usages"
                value={formatNumber(manifest.typeEscapes.any)}
                tone="amber"
              />
              <Metric
                icon={AlertTriangle}
                label="Non-null assertions"
                value={formatNumber(manifest.typeEscapes.nonNullAssertions)}
                tone="violet"
              />
            </div>

            {manifest.typeErrors.ran ? (
              <div className="rounded-xl border border-white/5 bg-zinc-950/40 p-3.5">
                <KeyValue label="tsc --noEmit errors" value={manifest.typeErrors.total} />
                {manifest.typeErrors.byFile.slice(0, 8).map(row => (
                  <KeyValue key={row.file} label={row.file} value={row.count} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-[11px] leading-relaxed text-zinc-500">
                The TypeScript error census did not run for this manifest, so the error count is{' '}
                <span className="font-bold text-zinc-400">unknown</span>, not zero. Regenerate with{' '}
                <span className="font-mono">bun run generate:codebase-health:full</span>.
              </div>
            )}

            {manifest.typeEscapes.worstFiles.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Densest `any` files
                </p>
                <div className="max-h-52 space-y-1.5 overflow-y-auto">
                  {manifest.typeEscapes.worstFiles.map(row => (
                    <div key={row.file} className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono text-[10px] text-zinc-400">
                        {row.file}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] font-bold text-amber-300">
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Route coverage */}
      <Section
        title="API Routes With No Test"
        icon={FlaskConical}
        subtitle={`${manifest.routeCoverage.untestedCount} of ${manifest.routeCoverage.totalRoutes} routes are not named by any test file`}
        action={
          manifest.routeCoverage.untested.length > 12 && (
            <button
              type="button"
              onClick={() => setShowAllUntested(v => !v)}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300 transition hover:bg-white/[0.07]"
            >
              {showAllUntested
                ? 'Show fewer'
                : `Show all ${manifest.routeCoverage.untested.length}`}
            </button>
          )
        }
      >
        {manifest.routeCoverage.untested.length === 0 ? (
          <Empty label="Every API route is referenced by at least one test." />
        ) : (
          <div className="space-y-3">
            <Bar
              value={manifest.routeCoverage.totalRoutes - manifest.routeCoverage.untestedCount}
              max={manifest.routeCoverage.totalRoutes}
              tone={manifest.routeCoverage.coveragePct < 50 ? 'rose' : 'emerald'}
            />
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {untestedShown.map(route => (
                <span
                  key={route}
                  className="truncate rounded-lg border border-white/5 bg-zinc-950/40 px-2.5 py-1.5 font-mono text-[10px] text-zinc-400"
                >
                  {route}
                </span>
              ))}
            </div>
            {manifest.routeCoverage.untestedTruncated > 0 && (
              <p className="text-[11px] text-zinc-500">
                {manifest.routeCoverage.untestedTruncated} further untested route(s) were not
                recorded in the manifest.
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Markers */}
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Section title="Debt by Area" icon={FileCode2}>
          {manifest.byArea.length === 0 ? (
            <Empty label="No unfinished-work markers found in the scanned trees." />
          ) : (
            <div className="space-y-3">
              {manifest.byArea.map(row => (
                <div key={row.area} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono font-bold text-zinc-300">{row.area}/</span>
                    <span className="font-mono text-zinc-500">{row.count}</span>
                  </div>
                  <Bar value={row.count} max={maxArea} tone="amber" />
                </div>
              ))}
              <div className="border-t border-white/5 pt-3">
                {Object.entries(manifest.byKind).map(([kind, count]) => (
                  <KeyValue key={kind} label={kind} value={count} />
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section
          title="Unfinished Work Markers"
          icon={ListChecks}
          subtitle={
            manifest.truncated > 0
              ? `Showing ${manifest.markers.length} of ${manifest.totals.markers} (capped at ${manifest.markerCap})`
              : `All ${manifest.totals.markers} markers`
          }
        >
          {manifest.markers.length === 0 ? (
            <Empty label="No TODO, FIXME, HACK, or skipped-test markers in the scanned trees." />
          ) : (
            <div className="max-h-[26rem] space-y-2 overflow-y-auto">
              {manifest.markers.map(marker => (
                <div
                  key={`${marker.file}:${marker.line}`}
                  className="rounded-xl border border-white/5 bg-zinc-950/40 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={MARKER_TONE[marker.kind] ?? 'zinc'}>{marker.kind}</Pill>
                    <span className="truncate font-mono text-[10px] text-zinc-500">
                      {marker.file}:{marker.line}
                    </span>
                  </div>
                  <p className="mt-1.5 break-words font-mono text-[11px] leading-relaxed text-zinc-400">
                    {marker.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Live DB signals */}
      <Section
        title="Live Data Signals"
        icon={FlaskConical}
        subtitle="Debt the file scan cannot see"
      >
        {data.liveError ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 font-mono text-[11px] text-rose-200">
            {data.liveError}
          </div>
        ) : !live ? (
          <Empty label="Live signals unavailable." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={Stars}
              label="Agents Never Consulted"
              value={formatNumber(live.agentsNeverConsulted)}
              detail={`of ${formatNumber(live.totalAgents)} in the roster`}
              tone={live.agentsNeverConsulted > 0 ? 'amber' : 'emerald'}
            />
            <Metric
              icon={Bug}
              label="Chats Missing Model"
              value={formatNumber(live.conversationsMissingModel)}
              detail={`of ${formatNumber(live.conversationsTotal)} logged`}
              tone={live.conversationsMissingModel > 0 ? 'amber' : 'emerald'}
            />
            <Metric
              icon={AlertTriangle}
              label="Users Without Profile"
              value={formatNumber(live.agentsWithoutNatalChart)}
              detail="No natal profile row"
              tone={live.agentsWithoutNatalChart > 0 ? 'amber' : 'emerald'}
            />
            <Metric
              icon={AlertTriangle}
              label="Orphan Profiles"
              value={formatNumber(live.orphanProfiles)}
              detail="Profiles with no user"
              tone={live.orphanProfiles > 0 ? 'rose' : 'emerald'}
            />
          </div>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
          Scan roots: <span className="font-mono">{manifest.scannedRoots.join(', ')}</span>.
          Generated {formatDateTime(manifest.generatedAt)} on{' '}
          <span className="font-mono">{manifest.branch ?? 'unknown branch'}</span>.
        </p>
      </Section>
    </div>
  )
}
