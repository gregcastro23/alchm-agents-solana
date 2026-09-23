'use client'

import McpInvocationsPanel from '@/components/admin/panels/McpInvocationsPanel'
import { ALCHM_DESKTOP_DOWNLOAD_LABEL, DESKTOP_APP_DOWNLOAD_URL } from '@/lib/desktop-download'
import type { DashboardPayload } from '@/lib/admin/page-schemas'
import { AdminFrame } from './AdminFrame'
import { readAt, useDashboard } from './hooks'
import { Badge, Card, LoadState, Read } from './primitives'

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-zinc-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-zinc-100">{children}</dd>
    </div>
  )
}

const LINK = 'text-sky-300 underline-offset-2 hover:underline'

export function InfrastructureView({ system }: { system: DashboardPayload['system'] }) {
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Database" subtitle="SELECT 1 through Prisma from this deployment.">
          {system.database.ok ? (
            <p className="text-sm">
              <Badge glyph="✓" label="Up" tone="ok" />{' '}
              <span className="text-zinc-300">{system.database.value.latencyMs} ms round trip</span>
            </p>
          ) : (
            <p className="text-sm">
              <Badge glyph="✕" label="Down" tone="bad" />{' '}
              <span className="break-words text-zinc-300">{system.database.reason}</span>
            </p>
          )}
        </Card>
        <Card
          title="Agents backend"
          subtitle="GET /health on the Python API (Railway, planetary agents)."
        >
          {system.backend.ok ? (
            <p className="text-sm">
              <Badge glyph="✓" label={`HTTP ${system.backend.value.status}`} tone="ok" />{' '}
              <span className="text-zinc-300">
                {system.backend.value.latencyMs} ms · {system.backend.value.url}
              </span>
            </p>
          ) : (
            <p className="text-sm">
              <Badge glyph="✕" label="Unreachable" tone="bad" />{' '}
              <span className="break-words text-zinc-300">{system.backend.reason}</span>
            </p>
          )}
        </Card>
      </div>
      <Card
        title="AI provider keys on this deployment"
        subtitle="Whether each key is set here — configured, not verified. The chat fallback chain runs on the Python backend."
      >
        <ul className="flex flex-wrap gap-2">
          {Object.entries(system.providersConfigured).map(([name, set]) => (
            <li key={name}>
              {set ? (
                <Badge glyph="✓" label={`${name}: set`} tone="ok" />
              ) : (
                <Badge glyph="○" label={`${name}: not set`} tone="muted" />
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-zinc-400">
          To test each provider for real (one 1-token call each):{' '}
          <a className={LINK} href="/api/providers/health" target="_blank" rel="noreferrer">
            /api/providers/health
          </a>
          . Chat success and latency per model are on{' '}
          <a className={LINK} href="/admin/chats">
            Chats &amp; providers
          </a>
          .
        </p>
      </Card>
    </>
  )
}

export function InfrastructurePage() {
  const { loaded, refresh, data } = useDashboard()
  return (
    <AdminFrame
      title="Infrastructure"
      description="Database and agents-backend liveness from this deployment, and which provider keys it holds."
      updated={readAt(data?.generatedAt)}
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && <InfrastructureView system={data.system} />}
    </AdminFrame>
  )
}

export function DeploymentsView({
  deployment,
}: {
  deployment: DashboardPayload['system']['deployment']
}) {
  const sha = deployment.commitSha
  return (
    <>
      <Card title="This deployment" subtitle="From Vercel's system environment variables.">
        <dl className="grid gap-3 sm:grid-cols-2">
          <KV label="Environment">{deployment.env ?? 'not on Vercel'}</KV>
          <KV label="URL">{deployment.url ?? '—'}</KV>
          <KV label="Commit">
            {sha ? (
              <a
                className={`${LINK} font-mono`}
                href={`https://github.com/gregcastro23/alchm-agents-solana/commit/${sha}`}
                target="_blank"
                rel="noreferrer"
              >
                {sha.slice(0, 7)}
              </a>
            ) : (
              '—'
            )}
            {deployment.commitRef && (
              <span className="text-zinc-400"> on {deployment.commitRef}</span>
            )}
          </KV>
          <KV label="Region">{deployment.region ?? '—'}</KV>
        </dl>
        <p className="mt-3 text-xs text-zinc-400">
          How far this is behind main, and CI on main, are on{' '}
          <a className={LINK} href="/admin/build">
            Build health
          </a>
          .
        </p>
      </Card>
      <Card
        title="Where each host builds from"
        subtitle="Recorded in docs/integrations/WTEN_CONTRACT.md."
      >
        <ul className="space-y-2 text-sm text-zinc-200">
          <li>
            <strong>agents.alchm.kitchen</strong> (Vercel): this repo, <code>main</code>.
          </li>
          <li>
            <strong>api.agents.alchm.kitchen</strong> (Railway, planetary agents): this repo,{' '}
            <code>main</code>, root <code>backend</code> — since 2026-09-23. A merge that touches{' '}
            <code>backend/</code> deploys the Python API.
          </li>
        </ul>
      </Card>
      <Card
        title="Desktop companion"
        subtitle="Links only — the desktop app reports no telemetry here."
      >
        <ul className="space-y-2 text-sm">
          <li>
            <a className={LINK} href={DESKTOP_APP_DOWNLOAD_URL} target="_blank" rel="noreferrer">
              {ALCHM_DESKTOP_DOWNLOAD_LABEL}
            </a>
          </li>
          <li>
            <a className={LINK} href="/api/models/catalog" target="_blank" rel="noreferrer">
              Model catalog API
            </a>
          </li>
        </ul>
      </Card>
    </>
  )
}

export function DeploymentsPage() {
  const { loaded, refresh, data } = useDashboard()
  return (
    <AdminFrame
      title="Deployments"
      description="What this deployment is running, where each host builds from, and the desktop companion's downloads."
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && <DeploymentsView deployment={data.system.deployment} />}
    </AdminFrame>
  )
}

export function McpPage() {
  const { loaded, refresh, data } = useDashboard()
  return (
    <AdminFrame
      title="MCP invocations"
      description="Calls into the Alchm data MCP server: volume, success, latency and the latest invocations."
      updated={readAt(data?.generatedAt)}
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && <Read section={data.mcp}>{v => <McpInvocationsPanel data={v} />}</Read>}
    </AdminFrame>
  )
}
