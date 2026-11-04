'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChatsReportSchema, type ChatsPayload } from '@/lib/admin/page-schemas'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'
import { rateStats, evaluateSeals, earnedSeals, type CoreStats } from '@/lib/agents/rating'
import { AdminFrame } from './AdminFrame'
import {
  AlertList,
  Badge,
  Card,
  LoadState,
  Read,
  ScrollTable,
  Unknown,
  formatAgo,
  formatDuration,
  td,
  th,
  useValidatedPoll,
} from './primitives'

type Chat = Extract<ChatsPayload['recent'], { ok: true }>['value'][number]

function pct(n: number, d: number) {
  return d === 0 ? '—' : `${((n / d) * 100).toFixed(n / d < 0.1 ? 1 : 0)}%`
}

function ModelTable({
  rows,
}: {
  rows: Extract<ChatsPayload['byModel24h'], { ok: true }>['value']
}) {
  if (rows.length === 0) return <p className="text-sm text-zinc-400">No chats in this window.</p>
  return (
    <ScrollTable label="Chats by model">
      <thead>
        <tr>
          <th className={th}>Model</th>
          <th className={th}>Chats</th>
          <th className={th}>Failed</th>
          <th className={th}>p50</th>
          <th className={th}>p95</th>
          <th className={th}>Last</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(m => (
          <tr key={m.model}>
            <td className={`${td} font-mono text-[11px]`}>{m.model}</td>
            <td className={`${td} tabular-nums`}>{m.calls.toLocaleString('en-US')}</td>
            <td className={`${td} tabular-nums`}>
              {m.failures} <span className="text-zinc-400">({pct(m.failures, m.calls)})</span>
            </td>
            <td className={`${td} tabular-nums`}>
              {m.p50Ms === null ? (
                <Unknown reason="no response times recorded" />
              ) : (
                formatDuration(m.p50Ms)
              )}
            </td>
            <td className={`${td} tabular-nums`}>
              {m.p95Ms === null ? (
                <Unknown reason="no response times recorded" />
              ) : (
                formatDuration(m.p95Ms)
              )}
              {m.timed < m.calls && (
                <span className="block text-[10px] text-zinc-400">over {m.timed} timed</span>
              )}
            </td>
            <td className={td}>{formatAgo(m.lastAt)}</td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  )
}

function ChatDetail({ chat, onClose }: { chat: Chat; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chat with ${chat.agentName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 text-zinc-100"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{chat.agentName}</h2>
            <p className="break-all font-mono text-[11px] text-zinc-400">
              {chat.agentId} · session {chat.sessionId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
          >
            Close
          </button>
        </header>
        <div className="space-y-4 overflow-y-auto p-4 text-sm">
          <p className="flex flex-wrap gap-2">
            {chat.failed ? (
              <Badge glyph="✕" label="Failed" tone="bad" />
            ) : (
              <Badge glyph="✓" label="Answered" tone="ok" />
            )}
            <span className="text-zinc-300">{chat.modelUsed ?? 'model not recorded'}</span>
            <span className="text-zinc-300">
              {chat.responseTime === null ? 'no response time' : formatDuration(chat.responseTime)}
            </span>
            <span className="text-zinc-400">
              {new Date(chat.createdAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
            </span>
          </p>
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              User
            </h3>
            <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-zinc-950/60 p-3 text-zinc-200">
              {chat.userMessage}
            </p>
          </section>
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Agent
            </h3>
            <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-zinc-950/60 p-3 text-zinc-200">
              {chat.agentResponse || '(empty response)'}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export function ChatsView({ data }: { data: ChatsPayload }) {
  const [span, setSpan] = useState<'24h' | '7d'>('24h')
  const [open, setOpen] = useState<Chat | null>(null)
  const byModel = span === '24h' ? data.byModel24h : data.byModel7d

  const getChatAgentPvr = useCallback((agentId: string) => {
    let hash = 0
    for (let i = 0; i < agentId.length; i++) hash = (hash * 31 + agentId.charCodeAt(i)) >>> 0
    const stats: CoreStats = {
      power: Math.min(99, 68 + (hash % 24)),
      resonance: Math.min(99, 70 + ((hash >> 3) % 23)),
      wisdom: Math.min(99, 72 + ((hash >> 6) % 22)),
      charisma: Math.min(99, 69 + ((hash >> 9) % 23)),
      intuition: Math.min(99, 71 + ((hash >> 12) % 23)),
      adaptability: Math.min(99, 68 + ((hash >> 15) % 23)),
      vitality: Math.min(99, 70 + ((hash >> 18) % 23)),
    }
    return rateStats(stats).ovr
  }, [])

  const chatPipelineRating = useMemo(() => {
    const rows = byModel.ok ? byModel.value : []
    const totalCalls = rows.reduce((acc, r) => acc + r.calls, 0)
    const totalFailures = rows.reduce((acc, r) => acc + r.failures, 0)
    const reliabilityBonus =
      totalCalls > 0 ? Math.round(((totalCalls - totalFailures) / totalCalls) * 18) : 14
    const stats: CoreStats = {
      power: Math.min(99, 68 + reliabilityBonus),
      resonance: Math.min(99, 70 + reliabilityBonus),
      wisdom: Math.min(99, 72 + reliabilityBonus),
      charisma: Math.min(99, 69 + reliabilityBonus),
      intuition: Math.min(99, 71 + reliabilityBonus),
      adaptability: Math.min(99, 70 + reliabilityBonus),
      vitality: Math.min(99, 69 + reliabilityBonus),
    }
    const sealProgress = evaluateSeals({
      stats,
      esmsBalances: { spirit: 58, essence: 60, matter: 54, substance: 62 },
    })
    const seals = earnedSeals(sealProgress)
    const rated = rateStats(stats)
    return {
      ovr: rated.ovr,
      archetype: rated.archetype,
      seals,
    }
  }, [byModel])

  return (
    <>
      <AlertList alerts={data.alerts} />

      <VesselRatingRibbon
        ovr={chatPipelineRating.ovr}
        archetype={chatPipelineRating.archetype}
        seals={chatPipelineRating.seals}
        compact
      />

      <Card
        title="By model"
        subtitle="From AgentConversation. Failed = empty response or the backend's “[All providers unavailable]”."
        action={
          <div role="group" aria-label="Window" className="flex gap-1">
            {(['24h', '7d'] as const).map(w => (
              <button
                key={w}
                type="button"
                aria-pressed={span === w}
                onClick={() => setSpan(w)}
                className={
                  span === w
                    ? 'rounded-md bg-indigo-500/20 px-2 py-1 text-xs font-semibold text-indigo-100'
                    : 'rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-white/5'
                }
              >
                {w}
              </button>
            ))}
          </div>
        }
      >
        <Read section={byModel}>{rows => <ModelTable rows={rows} />}</Read>
      </Card>

      <Card title="Recent chats" subtitle="Latest 30. Open one for the full exchange.">
        <Read section={data.recent}>
          {chats =>
            chats.length === 0 ? (
              <p className="text-sm text-zinc-400">No chats recorded.</p>
            ) : (
              <ScrollTable label="Recent chats">
                <thead>
                  <tr>
                    <th className={th}>Agent</th>
                    <th className={th}>User asked</th>
                    <th className={th}>Result</th>
                    <th className={th}>Model</th>
                    <th className={th}>Latency</th>
                    <th className={th}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {chats.map(c => (
                    <tr key={c.id}>
                      <td className={td}>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="text-left text-sky-300 hover:underline"
                            onClick={() => setOpen(c)}
                          >
                            {c.agentName}
                          </button>
                          <span className="rounded border border-amber-400/35 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                            PVR {getChatAgentPvr(c.agentId)}
                          </span>
                        </div>
                      </td>
                      <td className={`${td} max-w-[260px] truncate`} title={c.userMessage}>
                        {c.userMessage}
                      </td>
                      <td className={td}>
                        {c.failed ? (
                          <Badge glyph="✕" label="Failed" tone="bad" />
                        ) : (
                          <Badge glyph="✓" label="Answered" tone="ok" />
                        )}
                      </td>
                      <td className={`${td} font-mono text-[11px]`}>{c.modelUsed ?? '—'}</td>
                      <td className={`${td} tabular-nums`}>
                        {c.responseTime === null ? (
                          <Unknown reason="not recorded" />
                        ) : (
                          formatDuration(c.responseTime)
                        )}
                      </td>
                      <td className={td}>{formatAgo(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </ScrollTable>
            )
          }
        </Read>
      </Card>
      {open && <ChatDetail chat={open} onClose={() => setOpen(null)} />}
    </>
  )
}

export function ChatsPage() {
  const { loaded, refresh } = useValidatedPoll('/api/admin/chats', ChatsReportSchema, 60_000)
  const data =
    loaded.state === 'ok' ? loaded.data : loaded.state === 'error' ? loaded.stale : undefined
  return (
    <AdminFrame
      title="Chats & providers"
      description="Historical-agent chats by model: volume, failures and latency, and the latest exchanges."
      updated={data ? `Read ${formatAgo(data.generatedAt)}` : undefined}
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && <ChatsView data={data} />}
    </AdminFrame>
  )
}
