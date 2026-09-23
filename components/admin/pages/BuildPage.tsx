'use client'

import CodebaseHealthPanel, {
  type CodebaseHealthPayload,
} from '@/components/admin/panels/CodebaseHealthPanel'
import { BuildHealthReportSchema, type BuildHealthPayload } from '@/lib/admin/page-schemas'
import { AdminFrame } from './AdminFrame'
import { useAdminNavigate, useEnvelopePanel } from './hooks'
import {
  AlertList,
  Badge,
  Card,
  LoadState,
  Read,
  ScrollTable,
  Stat,
  formatAgo,
  formatDuration,
  num,
  td,
  th,
  useValidatedPoll,
  type Tone,
} from './primitives'

const CI: Record<string, { glyph: string; label: string; tone: Tone }> = {
  success: { glyph: '✓', label: 'Passing', tone: 'ok' },
  failure: { glyph: '✕', label: 'Failing', tone: 'bad' },
  pending: { glyph: '◔', label: 'Running', tone: 'warn' },
  cancelled: { glyph: '○', label: 'Cancelled', tone: 'muted' },
  none: { glyph: '—', label: 'No runs', tone: 'muted' },
}

function CiBadge({ state }: { state: string }) {
  const c = CI[state] ?? CI.none
  return <Badge glyph={c.glyph} label={c.label} tone={c.tone} />
}

const LINK = 'text-sky-300 underline-offset-2 hover:underline'

export function BuildView({ data }: { data: BuildHealthPayload }) {
  const failing = data.ci.ok ? data.ci.value.filter(r => r.state === 'failure').length : null
  return (
    <>
      <AlertList alerts={data.alerts} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="CI on main"
          value={
            data.ci.ok ? (
              failing === 0 ? (
                <span>
                  <span aria-hidden="true">✓ </span>Green
                </span>
              ) : (
                <span>
                  <span aria-hidden="true">✕ </span>
                  {failing} failing
                </span>
              )
            ) : (
              num(null, data.ci.reason)
            )
          }
          sub={data.ci.ok ? `${data.ci.value.length} workflows` : undefined}
        />
        <Stat
          label="Open pull requests"
          value={num(
            data.pulls.ok ? data.pulls.value.length : null,
            data.pulls.ok ? '' : data.pulls.reason
          )}
          sub={
            data.pulls.ok
              ? `${data.pulls.value.filter(p => p.ci === 'failure').length} with failing CI`
              : undefined
          }
        />
        <Stat
          label="Behind main"
          value={num(
            data.behind.ok ? data.behind.value.commits : null,
            data.behind.ok ? '' : data.behind.reason
          )}
          sub={
            data.deployed.sha
              ? `running ${data.deployed.sha.slice(0, 7)} (${data.deployed.env ?? '?'})`
              : 'not a Vercel deployment'
          }
        />
        <Stat
          label="main head"
          value={
            data.main.ok ? (
              <a
                className={`${LINK} font-mono text-base`}
                href={data.main.value.url}
                target="_blank"
                rel="noreferrer"
              >
                {data.main.value.sha.slice(0, 7)}
              </a>
            ) : (
              num(null, data.main.reason)
            )
          }
          sub={
            data.main.ok
              ? `${formatAgo(data.main.value.committedAt)} · ${data.main.value.message}`
              : undefined
          }
        />
      </div>

      <Card
        title="Workflows on main"
        subtitle={`Latest push run of each workflow in ${data.repo}.`}
      >
        <Read section={data.ci}>
          {runs =>
            runs.length === 0 ? (
              <p className="text-sm text-zinc-400">No workflow runs on main.</p>
            ) : (
              <ScrollTable label="Workflows on main">
                <thead>
                  <tr>
                    <th className={th}>Workflow</th>
                    <th className={th}>Result</th>
                    <th className={th}>Commit</th>
                    <th className={th}>Started</th>
                    <th className={th}>Took</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(r => (
                    <tr key={r.workflow}>
                      <td className={td}>
                        <a className={LINK} href={r.url} target="_blank" rel="noreferrer">
                          {r.workflow}
                        </a>
                      </td>
                      <td className={td}>
                        <CiBadge state={r.state} />
                      </td>
                      <td className={`${td} font-mono`}>{r.sha.slice(0, 7)}</td>
                      <td className={td}>{formatAgo(r.startedAt)}</td>
                      <td className={td}>
                        {r.durationMs === null ? 'running' : formatDuration(r.durationMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ScrollTable>
            )
          }
        </Read>
      </Card>

      <Card
        title="Open pull requests"
        subtitle="Most recently updated first; CI is the worst result across workflows at the PR's head commit."
      >
        <Read section={data.pulls}>
          {pulls =>
            pulls.length === 0 ? (
              <p className="text-sm text-zinc-400">No open pull requests.</p>
            ) : (
              <ScrollTable label="Open pull requests">
                <thead>
                  <tr>
                    <th className={th}>PR</th>
                    <th className={th}>CI</th>
                    <th className={th}>Branch</th>
                    <th className={th}>Author</th>
                    <th className={th}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {pulls.map(p => (
                    <tr key={p.number}>
                      <td className={td}>
                        <a className={LINK} href={p.url} target="_blank" rel="noreferrer">
                          #{p.number}
                        </a>{' '}
                        <span className="text-zinc-200">{p.title}</span>
                        {p.draft && <span className="ml-1 text-[11px] text-zinc-400">(draft)</span>}
                      </td>
                      <td className={td}>
                        <CiBadge state={p.ci} />
                      </td>
                      <td className={`${td} font-mono text-[11px]`}>{p.head}</td>
                      <td className={td}>{p.author}</td>
                      <td className={td}>{formatAgo(p.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </ScrollTable>
            )
          }
        </Read>
        {!data.authenticated && (
          <p className="mt-2 text-[11px] text-zinc-400">
            Read without a token (60 requests/hour, cached 5 min). Set GITHUB_TOKEN to raise the
            limit.
          </p>
        )}
      </Card>

      <Card
        title="Type-check and lint counts"
        subtitle="Live counts need CI to publish them; until it does, the census below is the committed manifest, with its age."
      >
        <p className="text-sm text-zinc-300">
          CI runs <code>bunx tsc --noEmit</code> and <code>bun run lint</code> as pass/fail gates —
          their result is the Frontend workflow above. Error counts are only in the manifest census
          below.
        </p>
      </Card>
    </>
  )
}

/** The committed code census (gates, provenance debt, coverage, markers), with its age. */
function CodebaseManifestSection() {
  const navigate = useAdminNavigate()
  const p = useEnvelopePanel<CodebaseHealthPayload>('/api/admin/codebase-health', 600_000)
  return <CodebaseHealthPanel {...p} onNavigate={navigate} />
}

export function BuildPage() {
  const { loaded, refresh } = useValidatedPoll('/api/admin/build', BuildHealthReportSchema, 300_000)
  const data =
    loaded.state === 'ok' ? loaded.data : loaded.state === 'error' ? loaded.stale : undefined
  return (
    <AdminFrame
      title="Build health"
      description="CI on main, open pull requests, how far this deployment trails main, and the committed code census."
      updated={data ? `Read ${formatAgo(data.generatedAt)}` : undefined}
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && <BuildView data={data} />}
      <CodebaseManifestSection />
    </AdminFrame>
  )
}
