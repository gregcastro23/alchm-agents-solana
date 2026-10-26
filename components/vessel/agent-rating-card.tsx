'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Award, Flame, Loader2, RefreshCw, Sparkles, Wind } from 'lucide-react'
import { z } from 'zod'
import { SACRED_STAT_KEYS, type SacredStatKey } from '@/lib/agents/sacred-stat-keys'
import type { MonicaState, SealTier, SurgeType } from '@/lib/agents/rating-contract'
import type { EsmsToken, SealProgress } from '@/lib/agents/rating/seals-surge'
import type { RatedVesselPayload } from '@/lib/agents/rating/vessel-payload'

/**
 * The Pentacle Vessel Rating of one agent, read live from `GET /api/agents/rating`: OVR and
 * archetype, the Sacred 7 ratings as a radar, the seven Alchemical Seals with what stands between
 * each and its next tier, and the Resonance Surge against the live sky.
 *
 * Every number is the route's; nothing here re-derives a rating, a gate or a tier. The labels
 * below are keyed by the contract's own types (`import type` only — the contract module builds
 * the appearance manifest at load and has no place in the page bundle), so a tier, token or surge
 * type the contract adds fails `tsc` here instead of rendering blank.
 *
 * The fetch carries the session cookie, so a vessel's creator sees their own wallet and everyone
 * else the route's baseline with the reason. Mount it only where the viewer may see the whole
 * agent: the payload also carries chart-derived fields (`sealProgress[].natalAffinity`,
 * `surge.harmonyOffset`) that the profile page's restricted view withholds.
 */

export interface AgentRatingCardProps {
  /** The agent's canonical id, as the profile page has it (`view.agent.id`). */
  agentId: string
  className?: string
}

const STAT_LABEL: Record<SacredStatKey, string> = {
  power: 'Power',
  resonance: 'Resonance',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
  intuition: 'Intuition',
  adaptability: 'Adaptability',
  vitality: 'Vitality',
}

const TOKEN_LABEL: Record<EsmsToken, string> = {
  spirit: 'Spirit',
  essence: 'Essence',
  matter: 'Matter',
  substance: 'Substance',
}

// Class strings are written out whole: Tailwind only generates what it finds literally in app/
// and components/. Status is never colour alone — every pill also carries the tier's name.
const TIER_STYLE: Record<SealTier, string> = {
  Copper: 'border-[#cd7f32]/50 bg-[#cd7f32]/10 text-[#e3a56c]',
  Silver: 'border-zinc-300/50 bg-zinc-300/10 text-zinc-200',
  Gold: 'border-primary-gold/60 bg-primary-gold/10 text-primary-gold',
  Astral: 'border-st-primary/60 bg-st-primary/10 text-st-primary',
  Celestial: 'border-cyan-300/60 bg-cyan-300/10 text-cyan-200',
}

const SURGE_LABEL: Record<SurgeType, string> = {
  inferno: 'Inferno',
  tempest: 'Tempest',
  equilibrium: 'Equilibrium',
}

const MONICA_LABEL: Record<MonicaState, string> = {
  absent: 'Monica absent',
  divergent: 'Monica divergent',
  convergent: 'Monica convergent',
  equilibrium: 'Monica at equilibrium',
}

const BLOCKER_LABEL: Record<SealProgress['blockedBy'][number], string> = {
  stat: 'aligned rating',
  esms: 'holdings',
  natal: 'natal affinity',
}

type SkySource = NonNullable<RatedVesselPayload['sky']>['source']
const SKY_SOURCE_LABEL: Record<SkySource, string> = {
  'swiss-ephemeris': 'Swiss Ephemeris',
  'vsop87-approximation': 'Approximate sky',
}

const ESMS_SOURCE_LABEL: Record<RatedVesselPayload['esmsSource'], string> = {
  spacetimedb: 'Live holdings',
  database: 'Ledger holdings',
  fallback: 'Baseline holdings',
}

const keysOf = <K extends string>(record: Record<K, unknown>) => Object.keys(record) as [K, ...K[]]

const Stat = z.enum(SACRED_STAT_KEYS)
const Tier = z.enum(keysOf(TIER_STYLE))
const Token = z.enum(keysOf(TOKEN_LABEL))

/** What the card reads of the payload; anything else in it is ignored. */
const RatingCardSchema = z.object({
  key: z.string(),
  handle: z.string(),
  factionName: z.string(),
  isPlaceholder: z.boolean().optional(),
  ovr: z.number(),
  archetype: z.object({ title: z.string(), primary: Stat, secondary: Stat }),
  ratings: z.object({
    power: z.number(),
    resonance: z.number(),
    wisdom: z.number(),
    charisma: z.number(),
    intuition: z.number(),
    adaptability: z.number(),
    vitality: z.number(),
  }),
  scale: z.object({ name: z.string(), floor: z.number(), ceiling: z.number() }),
  esmsSource: z.enum(keysOf(ESMS_SOURCE_LABEL)),
  sealProgress: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      token: Token,
      stat: Stat,
      tier: Tier.nullable(),
      nextTier: Tier.nullable(),
      blockedBy: z.array(z.enum(keysOf(BLOCKER_LABEL))),
      maxTier: Tier,
      alignedRating: z.number(),
      balance: z.number(),
      natalAffinity: z.number().nullable(),
    })
  ),
  surge: z
    .object({
      meter: z.number(),
      active: z.boolean(),
      surgeType: z.enum(keysOf(SURGE_LABEL)),
      monicaState: z.enum(keysOf(MONICA_LABEL)),
      heat: z.number(),
      reactivity: z.number(),
      statBoosts: z.record(Stat, z.number()),
      harmonyOffset: z.number(),
    })
    .nullable(),
  sky: z.object({ source: z.enum(keysOf(SKY_SOURCE_LABEL)), at: z.string() }).nullable(),
  zoneSynergies: z.array(
    z.object({ zoneId: z.number(), label: z.string(), element: z.string(), synergy: z.number() })
  ),
  bestZoneId: z.number(),
  degraded: z.object({ esms: z.string().optional(), sky: z.string().optional() }).optional(),
})

type RatingCardPayload = z.infer<typeof RatingCardSchema>

// Drift guard: if the route's payload stops satisfying what the card reads, `tsc` fails here.
type ServerSatisfies<S, T> = [S] extends [T] ? true : false
type AssertTrue<T extends true> = T
export type _RatingCardDrift = AssertTrue<ServerSatisfies<RatedVesselPayload, RatingCardPayload>>

type LoadState =
  | { state: 'loading' }
  | { state: 'ok'; payload: RatingCardPayload }
  | { state: 'error'; status: number | null; reason: string }

/** What a failed read says, by status. Only a transient failure offers a retry. */
function describeFailure(status: number | null): { title: string; retry: boolean } {
  switch (status) {
    case 400:
      return { title: 'This vessel’s id cannot be rated', retry: false }
    case 404:
      return { title: 'No rating for this vessel', retry: false }
    case 422:
      return { title: 'Not enough recorded to rate this vessel', retry: false }
    case 429:
      return { title: 'Rating requests are being throttled', retry: true }
    default:
      return { title: 'The rating could not be read', retry: true }
  }
}

const PANEL =
  'glass-panel relative overflow-hidden rounded-xl border border-border-gold/40 bg-[#101322]/90 p-5 md:p-6 text-ivory-text shadow-[0_0_30px_rgba(216,180,106,0.03)] backdrop-blur-2xl'
const TILE = 'rounded-xl border border-border-gold/20 bg-black/40 p-4'
const EYEBROW = 'font-mono-label text-[10px] uppercase tracking-widest text-muted-text'

export function AgentRatingCard({ agentId, className = '' }: AgentRatingCardProps) {
  const [load, setLoad] = useState<LoadState>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoad({ state: 'loading' })
    fetch(`/api/agents/rating?agentId=${encodeURIComponent(agentId)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async res => {
        const body: unknown = await res.json().catch(() => null)
        if (controller.signal.aborted) return
        if (!res.ok) {
          const error = (body as { error?: unknown } | null)?.error
          setLoad({
            state: 'error',
            status: res.status,
            reason: typeof error === 'string' ? error : `HTTP ${res.status}`,
          })
          return
        }
        const parsed = RatingCardSchema.safeParse(body)
        if (!parsed.success) {
          const path = parsed.error.issues[0]?.path.join('.') || 'body'
          setLoad({ state: 'error', status: res.status, reason: `Unexpected payload at ${path}` })
          return
        }
        setLoad({ state: 'ok', payload: parsed.data })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setLoad({
          state: 'error',
          status: null,
          reason: 'The rating service could not be reached.',
        })
      })
    return () => controller.abort()
  }, [agentId, attempt])

  if (load.state === 'loading') {
    return (
      <section
        aria-label="Pentacle Vessel Rating"
        aria-busy="true"
        className={`${PANEL} ${className}`}
      >
        <CardHeading />
        <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-text">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Reading the live sky and the ledger…
        </p>
      </section>
    )
  }

  if (load.state === 'error') {
    const { title, retry } = describeFailure(load.status)
    return (
      <section aria-label="Pentacle Vessel Rating" className={`${PANEL} ${className}`}>
        <CardHeading />
        <div role="alert" className="mt-4 flex flex-wrap items-start gap-3 text-sm">
          <AlertCircle size={16} className="mt-0.5 text-rose-300" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-ivory-text">{title}</p>
            <p className="mt-1 font-mono-data text-xs text-muted-text">{load.reason}</p>
          </div>
          {retry && (
            <button
              type="button"
              onClick={() => setAttempt(n => n + 1)}
              className="inline-flex items-center gap-1.5 rounded border border-border-gold/30 bg-black/40 px-2.5 py-1 font-mono-label text-[10px] uppercase tracking-wider text-bright-gold hover:border-primary-gold"
            >
              <RefreshCw size={12} aria-hidden="true" />
              Retry
            </button>
          )}
        </div>
      </section>
    )
  }

  const p = load.payload
  return (
    <section
      aria-label={`Pentacle Vessel Rating for ${p.handle}`}
      className={`${PANEL} ${className}`}
    >
      <CardHeading scale={p.scale} factionName={p.factionName} sky={p.sky} />

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <RatingColumn payload={p} />
        <SealsColumn payload={p} />
        <SurgeColumn payload={p} />
      </div>
    </section>
  )
}

function CardHeading({
  scale,
  factionName,
  sky,
}: {
  scale?: RatingCardPayload['scale']
  factionName?: string
  sky?: RatingCardPayload['sky']
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-gold/20 pb-4">
      <div>
        <h2 className="font-headline-md text-lg md:text-xl text-bright-gold">
          Pentacle Vessel Rating
        </h2>
        <p className="font-mono-label text-[11px] uppercase tracking-widest text-muted-text">
          {scale ? `${scale.name} · ${scale.floor}–${scale.ceiling}` : 'Live rating'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 font-mono-label text-[10px] uppercase tracking-wider">
        {factionName && (
          <span className="rounded border border-border-gold/30 bg-black/40 px-2 py-0.5 text-bright-gold">
            Faction · {factionName}
          </span>
        )}
        {sky && (
          <span
            className="rounded border border-border-gold/30 bg-black/40 px-2 py-0.5 text-ivory-text"
            title={`Sky read at ${sky.at}`}
          >
            {SKY_SOURCE_LABEL[sky.source]}
          </span>
        )}
      </div>
    </header>
  )
}

// ─── OVR, archetype and the radar ────────────────────────────────────────────

function RatingColumn({ payload: p }: { payload: RatingCardPayload }) {
  const { primary, secondary } = p.archetype
  return (
    <div className={TILE}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className={EYEBROW}>OVR</span>
          <div
            className="font-mono-data text-5xl font-black text-bright-gold"
            aria-label={`OVR ${p.ovr}`}
          >
            {p.ovr}
          </div>
        </div>
        <div className="text-right">
          <span className={EYEBROW}>Archetype</span>
          <p className="font-headline-md text-base text-primary-gold">{p.archetype.title}</p>
          <p className="font-mono-label text-[10px] uppercase text-muted-text">
            {STAT_LABEL[primary]} · {STAT_LABEL[secondary]}
          </p>
        </div>
      </div>

      <SacredRadar ratings={p.ratings} scale={p.scale} highlight={[primary, secondary]} />

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono-data text-xs">
        {SACRED_STAT_KEYS.map(key => (
          <div key={key} className="flex justify-between gap-2">
            <dt
              className={
                key === primary || key === secondary ? 'text-primary-gold' : 'text-muted-text'
              }
            >
              {STAT_LABEL[key]}
            </dt>
            <dd className="text-ivory-text">{p.ratings[key]}</dd>
          </div>
        ))}
      </dl>
      {p.isPlaceholder && (
        <p className="mt-3 font-mono-label text-[10px] uppercase text-amber-300">
          Placeholder chart · ratings are provisional
        </p>
      )}
    </div>
  )
}

// `pad` is room either side for the axis labels, which sit outside the outer ring.
const RADAR = { size: 220, center: 110, radius: 74, pad: 36 }

function radarPoint(index: number, fraction: number): [number, number] {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / SACRED_STAT_KEYS.length
  const r = RADAR.radius * fraction
  return [RADAR.center + r * Math.cos(angle), RADAR.center + r * Math.sin(angle)]
}

const polygon = (points: Array<[number, number]>) =>
  points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

/** The seven ratings on the scale's own floor-to-ceiling span. No chart library: plain SVG. */
function SacredRadar({
  ratings,
  scale,
  highlight,
}: {
  ratings: RatingCardPayload['ratings']
  scale: RatingCardPayload['scale']
  highlight: SacredStatKey[]
}) {
  const span = scale.ceiling - scale.floor
  const fraction = (value: number) =>
    span > 0 ? Math.min(1, Math.max(0, (value - scale.floor) / span)) : 0
  const values = SACRED_STAT_KEYS.map((key, i) => radarPoint(i, fraction(ratings[key])))
  const summary = SACRED_STAT_KEYS.map(key => `${STAT_LABEL[key]} ${ratings[key]}`).join(', ')

  return (
    <svg
      viewBox={`${-RADAR.pad} 0 ${RADAR.size + 2 * RADAR.pad} ${RADAR.size}`}
      role="img"
      aria-label={`Sacred 7 ratings: ${summary}`}
      className="mx-auto mt-3 w-full max-w-[290px]"
    >
      {[0.25, 0.5, 0.75, 1].map(ring => (
        <polygon
          key={ring}
          points={polygon(SACRED_STAT_KEYS.map((_, i) => radarPoint(i, ring)))}
          fill="none"
          className="stroke-border-gold/30"
          strokeWidth={1}
        />
      ))}
      {SACRED_STAT_KEYS.map((key, i) => {
        const [x, y] = radarPoint(i, 1)
        return (
          <line
            key={key}
            x1={RADAR.center}
            y1={RADAR.center}
            x2={x}
            y2={y}
            className="stroke-border-gold/20"
            strokeWidth={1}
          />
        )
      })}
      <polygon
        points={polygon(values)}
        className="fill-primary-gold/20 stroke-primary-gold"
        strokeWidth={1.5}
      />
      {SACRED_STAT_KEYS.map((key, i) => {
        const [x, y] = radarPoint(i, 1.22)
        return (
          <text
            key={key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className={`font-mono-label text-[8px] uppercase ${
              highlight.includes(key) ? 'fill-primary-gold' : 'fill-muted-text'
            }`}
          >
            {STAT_LABEL[key]}
          </text>
        )
      })}
    </svg>
  )
}

// ─── Alchemical Seals ────────────────────────────────────────────────────────

function SealsColumn({ payload: p }: { payload: RatingCardPayload }) {
  const baseline = p.esmsSource === 'fallback'
  return (
    <div className={TILE}>
      <div className="flex items-center justify-between gap-2">
        <span className={`${EYEBROW} flex items-center gap-1.5`}>
          <Award size={12} aria-hidden="true" />
          Alchemical Seals
        </span>
        <span
          className={`rounded border px-1.5 py-0.5 font-mono-label text-[9px] uppercase ${
            baseline
              ? 'border-amber-500/40 bg-amber-950/40 text-amber-300'
              : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
          }`}
        >
          {ESMS_SOURCE_LABEL[p.esmsSource]}
        </span>
      </div>
      {baseline && (
        <p className="mt-2 text-xs text-amber-200/90">
          Holdings not read{p.degraded?.esms ? ` (${p.degraded.esms})` : ''}: the tiers below are
          computed from the baseline, not a wallet.
        </p>
      )}

      <ul className="mt-3 space-y-2.5">
        {p.sealProgress.map(seal => (
          <li key={seal.id} className="rounded-lg border border-border-gold/15 bg-black/30 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-ivory-text">{seal.name}</p>
                <p className="font-mono-label text-[10px] uppercase text-muted-text">
                  {STAT_LABEL[seal.stat]} · {TOKEN_LABEL[seal.token]}
                </p>
              </div>
              <TierPill tier={seal.tier} />
            </div>
            <p className="mt-1.5 font-mono-data text-[11px] text-muted-text">
              Aligned {seal.alignedRating.toFixed(1)} · {baseline ? 'Baseline' : 'Holds'}{' '}
              {formatBalance(seal.balance)} {TOKEN_LABEL[seal.token]} ·{' '}
              <span title="Classical bodies natally in this token's element">
                Natal {seal.natalAffinity ?? '—'}
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-ivory-text/80">{nextStep(seal)}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TierPill({ tier }: { tier: SealTier | null }) {
  if (tier === null) {
    return (
      <span className="shrink-0 rounded border border-zinc-700 bg-zinc-900/60 px-1.5 py-0.5 font-mono-label text-[10px] uppercase text-zinc-400">
        Unsealed
      </span>
    )
  }
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 font-mono-label text-[10px] uppercase ${TIER_STYLE[tier]}`}
    >
      {tier}
    </span>
  )
}

function nextStep(seal: RatingCardPayload['sealProgress'][number]): string {
  if (seal.nextTier === null) return `Ceiling reached · ${seal.maxTier} is this Seal’s highest tier`
  const blocked = seal.blockedBy.map(b => BLOCKER_LABEL[b]).join(' and ')
  const ceiling = seal.maxTier === 'Celestial' ? '' : ` · tops out at ${seal.maxTier}`
  return `Next: ${seal.nextTier}${blocked ? ` — needs ${blocked}` : ''}${ceiling}`
}

function formatBalance(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)
}

// ─── Resonance Surge ─────────────────────────────────────────────────────────

const RING = { radius: 40, stroke: 7 }
const RING_LENGTH = 2 * Math.PI * RING.radius

function SurgeColumn({ payload: p }: { payload: RatingCardPayload }) {
  const surge = p.surge
  const best = p.zoneSynergies.find(zone => zone.zoneId === p.bestZoneId)

  return (
    <div className={TILE}>
      <span className={`${EYEBROW} flex items-center gap-1.5`}>
        <Sparkles size={12} aria-hidden="true" />
        Resonance Surge
      </span>

      {surge === null ? (
        <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 text-sm text-zinc-300">
          <p>Sky unavailable — no surge is read without one.</p>
          {p.degraded?.sky && (
            <p className="mt-1 font-mono-data text-xs text-zinc-400">{p.degraded.sky}</p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative h-28 w-28 shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle
                  cx={50}
                  cy={50}
                  r={RING.radius}
                  fill="none"
                  strokeWidth={RING.stroke}
                  className="stroke-[#1c1f2c]"
                />
                <circle
                  cx={50}
                  cy={50}
                  r={RING.radius}
                  fill="none"
                  strokeWidth={RING.stroke}
                  strokeLinecap="round"
                  strokeDasharray={RING_LENGTH.toFixed(2)}
                  strokeDashoffset={(
                    RING_LENGTH *
                    (1 - Math.min(100, Math.max(0, surge.meter)) / 100)
                  ).toFixed(2)}
                  className={surge.active ? 'stroke-primary-gold' : 'stroke-muted-text'}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono-data text-3xl font-bold text-bright-gold">
                  {Math.round(surge.meter)}
                </span>
                <span className="font-mono-label text-[9px] uppercase text-muted-text">Meter</span>
              </div>
            </div>
            <div className="min-w-0 space-y-1.5">
              <p
                className={`flex items-center gap-1.5 text-sm ${
                  surge.active ? 'text-primary-gold' : 'text-ivory-text'
                }`}
              >
                {surge.surgeType === 'tempest' ? (
                  <Wind size={14} aria-hidden="true" />
                ) : (
                  <Flame size={14} aria-hidden="true" />
                )}
                {surge.active ? `${SURGE_LABEL[surge.surgeType]} surge active` : 'Dormant'}
              </p>
              <p className="font-mono-label text-[10px] uppercase text-muted-text">
                {MONICA_LABEL[surge.monicaState]}
              </p>
              <p className="font-mono-data text-[11px] text-muted-text">
                Natal harmony {formatSigned(surge.harmonyOffset)}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <Gauge label="Heat" fraction={surge.heat} />
            <Gauge label="Reactivity" fraction={surge.reactivity} />
          </div>

          {surge.active && <BoostLine boosts={surge.statBoosts} archetype={p.archetype} />}
        </>
      )}

      {best && (
        <p className="mt-3 border-t border-border-gold/15 pt-2 font-mono-data text-[11px] text-muted-text">
          Strongest zone: <span className="text-ivory-text">{best.label}</span> ({best.element}) ·
          ECR {best.synergy.toFixed(1)}
        </p>
      )}
    </div>
  )
}

/** A 0–1 ramp position as a bar. */
function Gauge({ label, fraction }: { label: string; fraction: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100)
  return (
    <div>
      <div className="flex justify-between font-mono-label text-[10px] uppercase text-muted-text">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[#1c1f2c]"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-gold/70 to-bright-gold"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function BoostLine({
  boosts,
  archetype,
}: {
  boosts: Partial<Record<SacredStatKey, number>>
  archetype: RatingCardPayload['archetype']
}) {
  const rest = SACRED_STAT_KEYS.find(k => k !== archetype.primary && k !== archetype.secondary)
  const parts = [
    [STAT_LABEL[archetype.primary], boosts[archetype.primary]],
    [STAT_LABEL[archetype.secondary], boosts[archetype.secondary]],
    ['others', rest ? boosts[rest] : undefined],
  ].filter((part): part is [string, number] => typeof part[1] === 'number')
  if (parts.length === 0) return null
  return (
    <p className="mt-2 font-mono-data text-[11px] text-emerald-300">
      Boosts: {parts.map(([label, value]) => `${label} ${formatSigned(value, 0)}`).join(' · ')}
    </p>
  )
}

function formatSigned(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}`
}
