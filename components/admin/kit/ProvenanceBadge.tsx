'use client'

import {
  formatAge,
  PROVENANCE_DESCRIPTION,
  PROVENANCE_LABEL,
  type Provenance,
  type ProvenanceState,
} from '@/lib/admin/provenance'

const STATE_STYLES: Record<ProvenanceState, string> = {
  live: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200',
  stale: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  'no-source': 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  'not-instrumented': 'border-zinc-500/40 bg-zinc-800/70 text-zinc-300',
  partial: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
}

/** Distinct non-color indicators per state (WCAG 1.4.1). */
const STATE_GLYPHS: Record<ProvenanceState, string> = {
  live: '●',
  stale: '◷',
  'no-source': '✕',
  'not-instrumented': '◌',
  partial: '◐',
}

export function ProvenanceBadge({
  provenance,
  compact = false,
}: {
  provenance: Provenance
  compact?: boolean
}) {
  const label = PROVENANCE_LABEL[provenance.state]
  const age = provenance.measuredAt ? formatAge(provenance.measuredAt) : null
  const titleParts = [
    `${label}: ${PROVENANCE_DESCRIPTION[provenance.state]}`,
    `Source: ${provenance.source}`,
    age ? `Measured: ${age}` : null,
    provenance.missingVars?.length ? `Missing env: ${provenance.missingVars.join(', ')}` : null,
    provenance.note ? `Note: ${provenance.note}` : null,
  ].filter(Boolean)

  return (
    <span
      title={titleParts.join(' · ')}
      className={`inline-flex items-center gap-1 rounded border font-mono uppercase tracking-wider ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } ${STATE_STYLES[provenance.state]}`}
    >
      <span aria-hidden="true" className="text-[10px] leading-none">
        {STATE_GLYPHS[provenance.state]}
      </span>
      <span>{label}</span>
      {!compact && age && provenance.state === 'live' && (
        <span className="text-[10px] opacity-75">· {age}</span>
      )}
    </span>
  )
}
