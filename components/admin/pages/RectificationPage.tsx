'use client'

import { useMemo, useState } from 'react'
import { AdminFrame } from './AdminFrame'
import {
  AlertList,
  Badge,
  Card,
  LoadState,
  ScrollTable,
  Stat,
  Unknown,
  formatAgo,
  num,
  td,
  th,
  useValidatedPoll,
} from './primitives'
import {
  RectificationProposalSchema,
  RectificationReportSchema,
  type RectificationPayload,
} from '@/lib/admin/page-schemas'

type ProposalItem = Extract<RectificationPayload['dossiers'], { ok: true }>['value'][number]
type DbStateRow = Extract<RectificationPayload['dbStates'], { ok: true }>['value'][number]

type ClassificationFilter =
  | 'all'
  | 'archival_clue'
  | 'date_known_milestones'
  | 'approximate_or_symbolic_date'
  | 'approved'

function formatBirthDate(birth: ProposalItem['birth']): string {
  const yearLabel = birth.year <= 0 ? `${Math.abs(birth.year) + 1} BCE` : `${birth.year}`
  const m = String(birth.month).padStart(2, '0')
  const d = String(birth.day).padStart(2, '0')
  return `${yearLabel}-${m}-${d} (${birth.calendar})`
}

function formatMinuteLmt(min: number): string {
  const hh = String(Math.floor(min / 60)).padStart(2, '0')
  const mm = String(min % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function ClassificationBadge({
  classification,
}: {
  classification: ProposalItem['classification']
}) {
  if (classification === 'archival_clue') {
    return <Badge glyph="◎" label="Archival clue" tone="ok" />
  }
  if (classification === 'date_known_milestones') {
    return <Badge glyph="◇" label="Milestones only" tone="warn" />
  }
  return <Badge glyph="✕" label="Undated / synthetic" tone="muted" />
}

function ReviewStatusBadge({ row }: { row: DbStateRow | undefined }) {
  if (!row) return <Badge glyph="○" label="Pending" tone="muted" />
  if (row.reviewStatus === 'approved') {
    return (
      <Badge
        glyph="✓"
        label={row.dbCalculationsEligible ? 'Approved · Eligible' : 'Approved · Neutral'}
        tone={row.dbCalculationsEligible ? 'ok' : 'warn'}
      />
    )
  }
  if (row.reviewStatus === 'rejected') {
    return <Badge glyph="!" label="Rejected" tone="bad" />
  }
  if (row.reviewStatus === 'non-rectifiable') {
    return <Badge glyph="○" label="Held undated" tone="muted" />
  }
  return <Badge glyph="○" label="Pending review" tone="muted" />
}

export function RectificationView({
  data,
  onRefresh,
}: {
  data: RectificationPayload
  onRefresh?: () => Promise<void> | void
}) {
  const [filter, setFilter] = useState<ClassificationFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scoredOverrides, setScoredOverrides] = useState<Record<string, ProposalItem>>({})
  const [customEventsByAgent, setCustomEventsByAgent] = useState<
    Record<string, Array<Record<string, unknown>>>
  >({})
  const [newCategory, setNewCategory] = useState<'career' | 'marriage' | 'relocation' | 'illness'>(
    'career'
  )
  const [newDate, setNewDate] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionBanner, setActionBanner] = useState<{
    tone: 'ok' | 'bad'
    text: string
  } | null>(null)

  const dossiersList = useMemo(() => {
    if (!data.dossiers.ok) return []
    return data.dossiers.value.map(item => scoredOverrides[item.agentId] ?? item)
  }, [data.dossiers, scoredOverrides])

  const dbByAgent = useMemo(() => {
    if (!data.dbStates.ok) return new Map<string, DbStateRow>()
    return new Map(data.dbStates.value.map(row => [row.agentId, row]))
  }, [data.dbStates])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return dossiersList.filter(d => {
      const dbRow = dbByAgent.get(d.agentId)
      if (filter === 'approved' && dbRow?.reviewStatus !== 'approved') return false
      if (filter !== 'all' && filter !== 'approved' && d.classification !== filter) {
        return false
      }
      if (!q) return true
      return (
        d.name.toLowerCase().includes(q) ||
        d.agentId.toLowerCase().includes(q) ||
        d.birth.locationName.toLowerCase().includes(q)
      )
    })
  }, [dossiersList, dbByAgent, filter, query])

  const activeProposal = useMemo(() => {
    if (dossiersList.length === 0) return null
    if (selectedId) {
      const found = dossiersList.find(d => d.agentId === selectedId)
      if (found) return found
    }
    return filtered[0] ?? dossiersList[0] ?? null
  }, [dossiersList, filtered, selectedId])

  const activeDbState = activeProposal ? dbByAgent.get(activeProposal.agentId) : undefined
  const activeEvents = activeProposal
    ? (customEventsByAgent[activeProposal.agentId] ?? activeProposal.events)
    : []

  const activeScore = activeProposal?.score ?? null
  const activeSavedEstimate = activeDbState?.dbEstimate ?? null

  const sortedDistribution = useMemo(() => {
    const dist = activeScore?.distribution ?? activeSavedEstimate?.distribution ?? null
    if (!dist) return []
    return Object.entries(dist).sort((a, b) => b[1] - a[1])
  }, [activeScore, activeSavedEstimate])

  const reason = (s: { ok: boolean; reason?: string }) => (s.ok ? '' : (s.reason ?? 'unreadable'))

  async function callRectifyPost(payload: Record<string, unknown>) {
    const res = await fetch('/api/admin/rectify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`)
    }
    return body
  }

  async function handleScoreAll() {
    setBusyAction('score_batch')
    setActionBanner(null)
    try {
      const body = await callRectifyPost({
        action: 'score_batch',
        classification:
          filter === 'archival_clue' || filter === 'date_known_milestones' ? filter : undefined,
        stepMinutes: 5,
      })
      const incoming = Array.isArray(body?.proposals) ? body.proposals : []
      const next: Record<string, ProposalItem> = { ...scoredOverrides }
      for (const raw of incoming) {
        const parsed = RectificationProposalSchema.safeParse(raw)
        if (parsed.success) {
          next[parsed.data.agentId] = parsed.data
        }
      }
      setScoredOverrides(next)
      setActionBanner({
        tone: 'ok',
        text: `Scored ${incoming.length} rectifiable dossiers via Swiss Ephemeris sweep.`,
      })
    } catch (err) {
      setActionBanner({
        tone: 'bad',
        text: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleScoreSingle(proposal: ProposalItem) {
    setBusyAction(`score:${proposal.agentId}`)
    setActionBanner(null)
    try {
      const events = customEventsByAgent[proposal.agentId] ?? proposal.events
      const body = await callRectifyPost({
        action: 'score',
        agentId: proposal.agentId,
        evidence: events,
        stepMinutes: 5,
      })
      const parsed = RectificationProposalSchema.safeParse(body?.proposal)
      if (!parsed.success) {
        throw new Error('Scored proposal response did not match expected schema.')
      }
      setScoredOverrides(prev => ({ ...prev, [proposal.agentId]: parsed.data }))
      setActionBanner({
        tone: 'ok',
        text: `Swept ${proposal.name}: ${parsed.data.score?.top_sign ?? 'Unknown'} (${((parsed.data.score?.top_sign_probability ?? 0) * 100).toFixed(1)}%, window ${parsed.data.score?.window_80_minutes ?? '?'}m).`,
      })
    } catch (err) {
      setActionBanner({
        tone: 'bad',
        text: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleApprove(proposal: ProposalItem) {
    setBusyAction(`approve:${proposal.agentId}`)
    setActionBanner(null)
    try {
      const events = customEventsByAgent[proposal.agentId] ?? proposal.events
      const body = await callRectifyPost({
        action: 'approve',
        agentId: proposal.agentId,
        evidence: customEventsByAgent[proposal.agentId] ? events : undefined,
        stepMinutes: 5,
        note: reviewNote.trim() || undefined,
      })
      await onRefresh?.()
      setActionBanner({
        tone: 'ok',
        text: `Approved ${proposal.name} (${Number(body.ascendant ?? 0).toFixed(2)}° -> rectified, calculationsEligible=${String(body.calculationsEligible)}). Audit persisted.`,
      })
    } catch (err) {
      setActionBanner({
        tone: 'bad',
        text: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleReject(proposal: ProposalItem) {
    setBusyAction(`reject:${proposal.agentId}`)
    setActionBanner(null)
    try {
      const body = await callRectifyPost({
        action: 'reject',
        agentId: proposal.agentId,
        note: reviewNote.trim() || undefined,
      })
      await onRefresh?.()
      setActionBanner({
        tone: 'ok',
        text: body.revertedFromRectified
          ? `Rejected & reverted ${proposal.name} back to ${body.ascendantProvenance}.`
          : `Recorded rejection audit entry for ${proposal.name}.`,
      })
    } catch (err) {
      setActionBanner({
        tone: 'bad',
        text: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusyAction(null)
    }
  }

  function handleAddEvent(proposal: ProposalItem) {
    if (!newDate.trim() || !newDescription.trim()) return
    const current = customEventsByAgent[proposal.agentId] ?? proposal.events
    const next = [
      ...current,
      {
        type: 'life_event',
        category: newCategory,
        date: newDate.trim(),
        description: newDescription.trim(),
      },
    ]
    setCustomEventsByAgent(prev => ({ ...prev, [proposal.agentId]: next }))
    setNewDate('')
    setNewDescription('')
  }

  function handleRemoveCustomEvent(proposal: ProposalItem, index: number) {
    const current = customEventsByAgent[proposal.agentId] ?? proposal.events
    setCustomEventsByAgent(prev => ({
      ...prev,
      [proposal.agentId]: current.filter((_, i) => i !== index),
    }))
  }

  return (
    <>
      <AlertList alerts={data.alerts} />

      {actionBanner && (
        <div
          role="status"
          className={
            actionBanner.tone === 'ok'
              ? 'rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200'
              : 'rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200'
          }
        >
          <span aria-hidden="true">{actionBanner.tone === 'ok' ? '✓ ' : '✕ '}</span>
          {actionBanner.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Dossier corpus"
          value={num(data.counts.total, reason(data.dossiers))}
          sub={
            data.counts.archivalClue !== null && data.counts.dateKnownMilestones !== null
              ? `${data.counts.archivalClue} archival clues · ${data.counts.dateKnownMilestones} milestones · ${data.counts.nonRectifiable ?? 0} undated`
              : `source: ${data.dossiersSource}`
          }
        />
        <Stat
          label="Archival clues"
          value={num(data.counts.archivalClue, reason(data.dossiers))}
          sub="Primary hour/period records (Rodden AA–B)"
        />
        <Stat
          label="Approved in DB"
          value={num(data.counts.approvedInDb, reason(data.dbStates))}
          sub={
            data.counts.rejectedInAudit !== null
              ? `${data.counts.rejectedInAudit} rejected in audit log`
              : undefined
          }
        />
        <Stat
          label="Calculations eligible"
          value={num(data.counts.calculationsEligibleInDb, reason(data.dbStates))}
          sub="Gate: ≥ 70% top sign AND ≤ 180m 80% window"
        />
      </div>

      <Card
        title="Historical Ascendant Rectification Proposals"
        subtitle="Audit all 39 unmeasured historical agents before promoting any chart to rectified. Calculation gate requires ≥ 70% posterior concentration and ≤ 180m credible window."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              glyph={data.dossiersSource === 'unavailable' ? '✕' : '⚙'}
              label={`Engine: ${data.dossiersSource}`}
              tone={data.dossiersSource === 'unavailable' ? 'bad' : 'muted'}
            />
            <button
              type="button"
              onClick={handleScoreAll}
              disabled={busyAction !== null || !data.dossiers.ok}
              className="rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
            >
              {busyAction === 'score_batch' ? 'Sweeping ephemeris…' : 'Score all rectifiable'}
            </button>
          </div>
        }
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', 'All dossiers'],
                ['archival_clue', 'Archival clue'],
                ['date_known_milestones', 'Milestones only'],
                ['approximate_or_symbolic_date', 'Non-rectifiable'],
                ['approved', 'DB Approved'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={
                  filter === key
                    ? 'rounded-lg border border-indigo-400/50 bg-indigo-500/25 px-2.5 py-1 text-xs font-semibold text-indigo-100'
                    : 'rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/10'
                }
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter by agent name, slug, or birthplace…"
            aria-label="Filter historical dossiers"
            className="w-full rounded-lg border border-white/15 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 sm:w-64"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7">
            {!data.dossiers.ok ? (
              <p className="text-sm text-zinc-300">
                <Unknown reason={data.dossiers.reason} /> {data.dossiers.reason}
              </p>
            ) : (
              <ScrollTable label="Unmeasured historical agent rectification dossiers">
                <thead>
                  <tr>
                    <th className={th}>Agent</th>
                    <th className={th}>Tier</th>
                    <th className={th}>Evidence</th>
                    <th className={th}>Sweep / Saved Peak</th>
                    <th className={th}>DB Status</th>
                    <th className={th}>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const row = dbByAgent.get(item.agentId)
                    const sc = item.score
                    const saved = row?.dbEstimate
                    const topSign = sc?.top_sign ?? saved?.topSign ?? null
                    const topProb = sc?.top_sign_probability ?? saved?.topSignProbability ?? null
                    const win80 = sc?.window_80_minutes ?? saved?.window80Minutes ?? null
                    const eligible =
                      sc?.is_calculations_eligible ??
                      (row?.dbAscendantProvenance === 'rectified'
                        ? row.dbCalculationsEligible
                        : null)
                    const isSelected = activeProposal?.agentId === item.agentId

                    return (
                      <tr
                        key={item.agentId}
                        className={isSelected ? 'bg-indigo-500/10' : 'hover:bg-white/[0.03]'}
                      >
                        <td className={td}>
                          <div className="font-semibold text-zinc-100">{item.name}</div>
                          <div className="text-[11px] text-zinc-400">
                            {formatBirthDate(item.birth)} · {item.birth.locationName}
                          </div>
                        </td>
                        <td className={td}>
                          <ClassificationBadge classification={item.classification} />
                          <div className="mt-1 text-[10px] text-zinc-500">
                            Rodden {item.roddenRating} · {item.dateConfidence}
                          </div>
                        </td>
                        <td className={td}>
                          <span className="tabular-nums text-zinc-200">
                            {(customEventsByAgent[item.agentId] ?? item.events).length} items
                          </span>
                          {item.timeClue && (
                            <div className="mt-0.5 text-[10px] text-emerald-300">
                              Clue:{' '}
                              {typeof item.timeClue.startMinute === 'number' &&
                              typeof item.timeClue.endMinute === 'number'
                                ? `${formatMinuteLmt(item.timeClue.startMinute)}–${formatMinuteLmt(item.timeClue.endMinute)} LMT`
                                : typeof item.timeClue.recordedMinuteLmt === 'number'
                                  ? `${formatMinuteLmt(item.timeClue.recordedMinuteLmt)} LMT`
                                  : 'Recorded'}
                            </div>
                          )}
                        </td>
                        <td className={td}>
                          {!item.rectifiable ? (
                            <span className="text-[11px] text-zinc-500">Non-rectifiable</span>
                          ) : topSign && topProb !== null ? (
                            <div>
                              <span className="font-semibold text-zinc-100">
                                {topSign} {(topProb * 100).toFixed(1)}%
                              </span>
                              <div className="mt-0.5 text-[10px] text-zinc-400">
                                80% win: {win80}m ·{' '}
                                {eligible ? (
                                  <span className="text-emerald-300">Eligible</span>
                                ) : (
                                  <span className="text-amber-300">Below gate</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <Badge glyph="○" label="Unscored" tone="muted" />
                          )}
                        </td>
                        <td className={td}>
                          <ReviewStatusBadge row={row} />
                          {row && !row.presentInDb && (
                            <div className="mt-0.5 text-[10px] text-amber-300">
                              Not seeded in DB
                            </div>
                          )}
                        </td>
                        <td className={td}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(item.agentId)}
                            className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-zinc-100 hover:bg-white/10"
                          >
                            {isSelected ? 'Selected' : 'Review'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td className={`${td} text-center text-zinc-400`} colSpan={6}>
                        No historical dossiers match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </ScrollTable>
            )}
          </div>

          <div className="min-w-0 lg:col-span-5">
            {!activeProposal ? (
              <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-4 text-xs text-zinc-400">
                Select an agent dossier to inspect archival clues, dated milestones, Bayesian
                posterior distribution, and approval controls.
              </div>
            ) : (
              <div className="space-y-4 rounded-xl border border-white/10 bg-zinc-950/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100">{activeProposal.name}</h3>
                    <p className="text-[11px] text-zinc-400">
                      {activeProposal.agentId} · {formatBirthDate(activeProposal.birth)} ·{' '}
                      {activeProposal.birth.lat.toFixed(3)}, {activeProposal.birth.lon.toFixed(3)}
                    </p>
                  </div>
                  <ReviewStatusBadge row={activeDbState} />
                </div>

                {activeProposal.timeClue && (
                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                    <div className="font-semibold">
                      Archival Time Clue ({activeProposal.roddenRating})
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                      {activeProposal.timeClue.source}
                    </p>
                  </div>
                )}

                {activeProposal.dateUncertaintyReason && (
                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">
                    <div className="font-semibold">Date / Ephemeris Uncertainty</div>
                    <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                      {activeProposal.dateUncertaintyReason}
                    </p>
                  </div>
                )}

                {activeProposal.notes && (
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    {activeProposal.notes}
                  </p>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                      Biographical & Time Evidence ({activeEvents.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleScoreSingle(activeProposal)}
                      disabled={
                        busyAction !== null ||
                        (!activeProposal.rectifiable && activeEvents.length === 0)
                      }
                      className="rounded-md border border-indigo-400/40 bg-indigo-500/20 px-2.5 py-1 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
                    >
                      {busyAction === `score:${activeProposal.agentId}`
                        ? 'Sweeping…'
                        : 'Run Swiss Ephemeris Sweep'}
                    </button>
                  </div>

                  <ul className="space-y-1.5 text-xs">
                    {activeEvents.map((ev, idx) => (
                      <li
                        key={`${idx}-${String(ev.description ?? ev.date ?? idx)}`}
                        className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-zinc-900/60 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-zinc-200">
                            [{String(ev.category ?? ev.type ?? 'evidence')}]
                          </span>{' '}
                          {typeof ev.date === 'string' && (
                            <span className="tabular-nums text-indigo-300">{ev.date} · </span>
                          )}
                          <span className="text-zinc-300">{String(ev.description ?? '')}</span>
                        </div>
                        {customEventsByAgent[activeProposal.agentId] && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomEvent(activeProposal, idx)}
                            className="shrink-0 text-[10px] text-rose-300 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    ))}
                    {activeEvents.length === 0 && (
                      <li className="text-[11px] text-zinc-500">
                        No verifiable historical dates recorded. Add a documented milestone below to
                        test whether the chart can be rectified.
                      </li>
                    )}
                  </ul>

                  <div className="mt-2.5 grid grid-cols-1 gap-2 rounded-lg border border-white/10 bg-zinc-900/40 p-2.5 sm:grid-cols-4">
                    <select
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value as typeof newCategory)}
                      aria-label="Milestone category"
                      className="rounded border border-white/15 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-200"
                    >
                      <option value="career">Career / Work</option>
                      <option value="marriage">Partnership</option>
                      <option value="relocation">Relocation / Move</option>
                      <option value="illness">Crisis / Illness</option>
                    </select>
                    <input
                      type="text"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      aria-label="Milestone YYYY-MM-DD"
                      className="rounded border border-white/15 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-500"
                    />
                    <input
                      type="text"
                      value={newDescription}
                      onChange={e => setNewDescription(e.target.value)}
                      placeholder="Verifiable event…"
                      aria-label="Milestone description"
                      className="rounded border border-white/15 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-500 sm:col-span-2"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddEvent(activeProposal)}
                      className="rounded border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-semibold text-zinc-100 hover:bg-white/15 sm:col-span-4"
                    >
                      + Stage event &amp; re-sweep
                    </button>
                  </div>
                </div>

                {(activeScore || activeSavedEstimate) && (
                  <div className="space-y-3 border-t border-white/10 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                        {activeScore ? 'Live Sweep Posterior' : 'Saved DB Rectification Estimate'}
                      </h4>
                      {(activeScore?.is_calculations_eligible ??
                      activeDbState?.dbCalculationsEligible) ? (
                        <Badge glyph="✓" label="Eligible for Sacred 7" tone="ok" />
                      ) : (
                        <Badge glyph="!" label="Below 70% / 180m gate (Neutral)" tone="warn" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-2.5">
                        <div className="text-[10px] text-zinc-400">MAP Ascendant</div>
                        <div className="mt-0.5 font-semibold text-zinc-100">
                          {activeScore
                            ? `${activeScore.working_sign} ${activeScore.working_longitude.toFixed(2)}°`
                            : `${activeSavedEstimate!.workingSign} ${activeSavedEstimate!.workingLongitude.toFixed(2)}°`}
                        </div>
                        {activeScore && (
                          <div className="text-[10px] text-zinc-400">
                            {activeScore.working_time} LMT
                          </div>
                        )}
                      </div>
                      <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-2.5">
                        <div className="text-[10px] text-zinc-400">80% Credible Window</div>
                        <div className="mt-0.5 font-semibold text-zinc-100">
                          {activeScore
                            ? `${activeScore.credible_window_80.startLocal}–${activeScore.credible_window_80.endLocal}`
                            : `${activeSavedEstimate!.credibleWindow80.startLocal}–${activeSavedEstimate!.credibleWindow80.endLocal}`}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {activeScore?.window_80_minutes ?? activeSavedEstimate!.window80Minutes}m
                          · certainty{' '}
                          {(
                            (activeScore?.certainty ?? activeSavedEstimate!.certainty) * 100
                          ).toFixed(1)}
                          %
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {sortedDistribution.slice(0, 6).map(([sign, prob]) => (
                        <div key={sign} className="flex items-center gap-2 text-[11px]">
                          <span className="w-24 shrink-0 text-zinc-300">{sign}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className={
                                prob >= 0.7 ? 'h-full bg-emerald-400' : 'h-full bg-indigo-400'
                              }
                              style={{ width: `${Math.min(100, Math.round(prob * 100))}%` }}
                            />
                          </div>
                          <span className="w-12 shrink-0 text-right tabular-nums text-zinc-300">
                            {(prob * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>

                    {!(
                      activeScore?.is_calculations_eligible ?? activeDbState?.dbCalculationsEligible
                    ) && (
                      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                        Approving this below-threshold chart records `ascendantProvenance:
                        rectified` and its posterior estimate, while Sacred 7 stats and persona
                        prompts continue to keep house-dependent weights neutral until probability ≥
                        70% and 80% window ≤ 180m.
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2 border-t border-white/10 pt-3">
                  <input
                    type="text"
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    placeholder="Optional admin audit note (citation / reason)…"
                    aria-label="Reviewer audit note"
                    className="w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(activeProposal)}
                      disabled={
                        busyAction !== null ||
                        (!activeProposal.rectifiable &&
                          !customEventsByAgent[activeProposal.agentId]?.length)
                      }
                      className="flex-1 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      {busyAction === `approve:${activeProposal.agentId}`
                        ? 'Persisting…'
                        : 'Approve -> rectified'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(activeProposal)}
                      disabled={busyAction !== null}
                      className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                    >
                      {busyAction === `reject:${activeProposal.agentId}`
                        ? 'Recording…'
                        : activeDbState?.dbAscendantProvenance === 'rectified'
                          ? 'Reject & revert'
                          : 'Reject proposal'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card
        title="Rectification Audit Log"
        subtitle="Every approval and rejection is written to admin_audit_log before mutating historical_agents."
      >
        {!data.auditTrail.ok ? (
          <p className="text-sm text-zinc-300">
            <Unknown reason={data.auditTrail.reason} /> {data.auditTrail.reason}
          </p>
        ) : data.auditTrail.value.length === 0 ? (
          <p className="text-xs text-zinc-400">No rectification reviews recorded yet.</p>
        ) : (
          <ScrollTable label="Recent rectification admin audit entries">
            <thead>
              <tr>
                <th className={th}>Time</th>
                <th className={th}>Action</th>
                <th className={th}>Agent</th>
                <th className={th}>Reviewer</th>
                <th className={th}>Note</th>
              </tr>
            </thead>
            <tbody>
              {data.auditTrail.value.slice(0, 20).map(entry => (
                <tr key={entry.id}>
                  <td className={td}>{formatAgo(entry.createdAt)}</td>
                  <td className={td}>
                    <Badge
                      glyph={entry.action === 'rectification.approve' ? '✓' : '!'}
                      label={entry.action}
                      tone={entry.action === 'rectification.approve' ? 'ok' : 'warn'}
                    />
                  </td>
                  <td className={`${td} font-mono text-[11px]`}>{entry.targetId ?? '—'}</td>
                  <td className={td}>{entry.actorEmail}</td>
                  <td className={td}>{entry.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        )}
      </Card>
    </>
  )
}

export function RectificationPage() {
  const { loaded, refresh } = useValidatedPoll(
    '/api/admin/rectify',
    RectificationReportSchema,
    120_000
  )
  const data =
    loaded.state === 'ok' ? loaded.data : loaded.state === 'error' ? loaded.stale : undefined

  return (
    <AdminFrame
      title="Ascendant Rectification"
      description="Review Bayesian birth-time sweeps, archival clues, and dated milestones for the 39 unmeasured historical agents before persisting rectified estimates."
      updated={data ? `Read ${formatAgo(data.generatedAt)}` : undefined}
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && <RectificationView data={data} onRefresh={refresh} />}
    </AdminFrame>
  )
}
