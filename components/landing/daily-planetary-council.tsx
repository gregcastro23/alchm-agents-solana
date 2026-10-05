'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, ChevronDown, RefreshCw, Send, Sparkles } from 'lucide-react'
import { useDailyPlanetaryCouncil } from '@/hooks/useDailyPlanetaryCouncil'
import {
  COUNCIL_PLANETS,
  type CouncilSpeakerKey,
  type DailyCouncilEdition,
  type DailyCouncilTurn,
} from '@/lib/agents/council/daily-council-types'
import { DailyCouncilTurnSchema } from '@/lib/agents/council/daily-edition-schema'
import { ASPECT_DEFINITIONS } from '@/lib/agents/council/aspect-dialogue-engine'

const SPEAKER_STYLE: Record<CouncilSpeakerKey, { glyph: string; color: string }> = {
  gregory: { glyph: '✦', color: '#b8fc4b' },
  sun: { glyph: '☉', color: '#fbbf24' },
  moon: { glyph: '☽', color: '#cbd5e1' },
  mercury: { glyph: '☿', color: '#7bd1fa' },
  venus: { glyph: '♀', color: '#f472b6' },
  mars: { glyph: '♂', color: '#fb923c' },
  jupiter: { glyph: '♃', color: '#c084fc' },
  saturn: { glyph: '♄', color: '#a3b8a2' },
  uranus: { glyph: '♅', color: '#67e8f9' },
  neptune: { glyph: '♆', color: '#93c5fd' },
  pluto: { glyph: '♇', color: '#fda4af' },
}

const formatUtc = (value: string, dateOnly = false) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: dateOnly ? 'numeric' : undefined,
    hour: dateOnly ? undefined : 'numeric',
    minute: dateOnly ? undefined : '2-digit',
  }).format(date)
}

const planetName = (key: string) => key.charAt(0).toUpperCase() + key.slice(1)

function EditionBasis({ edition }: { edition: DailyCouncilEdition }) {
  const brief = edition.brief
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-relaxed text-[#8c947c]">
      <span>{formatUtc(`${edition.date}T12:00:00Z`, true)} · UTC day</span>
      <span>Sky observed {formatUtc(brief.asOf)} UTC</span>
      <span>
        {brief.source === 'swiss-ephemeris' ? 'Swiss Ephemeris' : 'Approximate ephemeris'}
        {brief.quality === 'approximate' ? ' · approximate positions' : ' · verified positions'}
      </span>
    </div>
  )
}

function CouncilTurn({ turn }: { turn: DailyCouncilTurn }) {
  const style = SPEAKER_STYLE[turn.speakerKey] || SPEAKER_STYLE.gregory
  const host = turn.speakerKey === 'gregory'
  return (
    <li
      className={`flex gap-3 sm:gap-4 ${host ? 'rounded-xl bg-[#b8fc4b]/[0.04] p-4' : 'px-4 py-3'}`}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-[#050506] text-xl"
        style={{ color: style.color, borderColor: `${style.color}50` }}
      >
        {style.glyph}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-headline-sm text-sm" style={{ color: style.color }}>
            {host ? 'Gregory Castro' : turn.speakerName}
          </span>
          {host && (
            <span className="font-mono-label text-[9px] uppercase tracking-widest text-[#b8fc4b]">
              Host
            </span>
          )}
          <span className="text-[10px] text-[#8c947c]">
            {turn.provenance.source === 'grounded_briefing' ? 'Sky briefing' : 'Council voice'}
          </span>
        </div>
        <p className="whitespace-pre-wrap font-body-md text-sm leading-7 text-[#e0e4d2]">
          {turn.text}
        </p>
      </div>
    </li>
  )
}

function SkyFacts({ edition }: { edition: DailyCouncilEdition }) {
  const { brief } = edition
  const covered = new Set(edition.coveredTopics)
  const required = brief.requiredCoverage
  const coveredCount = required.filter(topic => covered.has(topic)).length
  const topicLabel = (topic: string) => {
    const evidence =
      brief.evidence.find(item => item.id === topic) ||
      brief.evidence.find(item => item.coverageIds.includes(topic))
    return evidence?.label.split(';')[0] || 'Sky context explained'
  }
  return (
    <details className="rounded-xl border border-[#424936]/70 bg-[#050506]/40">
      <summary className="cursor-pointer p-4 text-sm text-[#c2cab0] marker:text-[#b8fc4b]">
        Explore today&apos;s sky · all 10 placements · {coveredCount}/{required.length} topics
        covered
      </summary>
      <div className="space-y-6 border-t border-[#424936]/60 p-4 sm:p-5">
        <p className="text-xs leading-relaxed text-[#8c947c]">
          Tropical zodiac, viewed from Earth. Placements and aspects describe the opening UTC
          snapshot; timed changes below describe later events. Lunar phase names describe a stage of
          the cycle; exact phase crossings are listed separately when verified.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {COUNCIL_PLANETS.map(planet => {
            const position = brief.positions[planet]
            const key = planet.toLowerCase() as CouncilSpeakerKey
            return (
              <div key={planet} className="rounded-lg border border-[#424936]/60 bg-[#090b0e] p-3">
                <p className="mb-1 text-sm" style={{ color: SPEAKER_STYLE[key].color }}>
                  <span aria-hidden="true">{SPEAKER_STYLE[key].glyph}</span> {planet}
                </p>
                <p className="text-sm text-[#e0e4d2]">
                  {position.sign} {position.degree.toFixed(1)}°
                </p>
                <p className="mt-1 text-xs capitalize text-[#8c947c]">
                  {position.speed === undefined
                    ? 'Motion unavailable'
                    : position.retrograde
                      ? 'Retrograde'
                      : 'Direct'}{' '}
                  · {position.dignity}
                </p>
              </div>
            )
          })}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-headline-sm text-sm text-[#7bd1fa]">Lunar rhythm</h3>
            <p className="text-sm leading-relaxed text-[#c2cab0]">
              {brief.lunar.phase} · Moon in {brief.lunar.sign} ·{' '}
              {Math.round(brief.lunar.illumination * 100)}% illuminated
            </p>
            <h3 className="mb-2 mt-5 font-headline-sm text-sm text-[#7bd1fa]">
              The day&apos;s turning points
            </h3>
            {brief.events.length ? (
              <ul className="space-y-2 text-sm leading-relaxed text-[#c2cab0]">
                {brief.events.map(event => (
                  <li key={event.id}>
                    <span className="text-[#8c947c]">{formatUtc(event.at)} UTC</span> ·{' '}
                    {event.description}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#8c947c]">No timed changes verified for this edition.</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 font-headline-sm text-sm text-[#7bd1fa]">
              Planetary relationships
            </h3>
            <p className="mb-3 text-xs leading-relaxed text-[#8c947c]">
              Applying aspects are drawing closer; separating aspects are easing away. The orb
              measures distance from an exact alignment. This council uses{' '}
              {ASPECT_DEFINITIONS.filter(aspect => aspect.major)
                .map(aspect => `${aspect.name.toLowerCase()} ${aspect.orb}°`)
                .join(', ')}{' '}
              as maximum major-aspect orbs. “Exact” in the opening snapshot means within a quarter
              degree; a timed exact crossing is calculated separately.
            </p>
            {brief.aspects.length ? (
              <ul className="space-y-2 text-sm leading-relaxed text-[#c2cab0]">
                {brief.aspects.map(aspect => (
                  <li key={`${aspect.bodyA}-${aspect.bodyB}-${aspect.aspectName}`}>
                    {planetName(aspect.bodyA)} {aspect.aspectName.toLowerCase()}{' '}
                    {planetName(aspect.bodyB)}
                    <span className="text-[#8c947c]">
                      {' '}
                      · {aspect.orb.toFixed(1)}° orb ·{' '}
                      {aspect.phase === 'unknown' ? 'motion unavailable' : aspect.phase}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#8c947c]">No qualifying aspects in this snapshot.</p>
            )}
          </div>
        </div>
        {required.length > 0 && (
          <div>
            <h3 className="mb-2 font-headline-sm text-sm text-[#7bd1fa]">Conversation coverage</h3>
            <ul className="flex flex-wrap gap-2">
              {required.map(topic => (
                <li
                  key={topic}
                  className="rounded-md border border-[#424936]/70 px-2 py-1 text-xs text-[#c2cab0]"
                >
                  {covered.has(topic) ? '✓ ' : 'Pending: '}
                  {topicLabel(topic)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {brief.warnings.length > 0 && (
          <ul className="space-y-1 border-t border-[#424936]/60 pt-3 text-xs leading-relaxed text-amber-200">
            {brief.warnings.map(warning => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}

function FollowUpQuestions({ edition }: { edition: DailyCouncilEdition }) {
  const [question, setQuestion] = useState('')
  const [exchanges, setExchanges] = useState<
    Array<{ question: string; turns: DailyCouncilTurn[] }>
  >([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setExchanges([])
    setError(null)
    setSending(false)
    return () => requestRef.current?.abort()
  }, [edition.id])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const text = question.trim()
    if (!text || sending) return
    const controller = new AbortController()
    requestRef.current = controller
    setSending(true)
    setError(null)
    try {
      const response = await fetch('/api/agents/council-daily/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          editionId: edition.id,
          question: text,
          recentTurns: exchanges.flatMap(exchange => exchange.turns).slice(-6),
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        const defaults: Record<number, string> = {
          401: 'Sign in to ask the council a follow-up. Everyone can read the daily conversation.',
          402: 'Your account does not have enough credit for this follow-up.',
          429: 'The council has reached its question limit. Please wait a moment and try again.',
          409: 'This edition has changed. Refresh the daily council before asking again.',
          503: 'The council is temporarily unavailable. Please try again shortly.',
        }
        throw new Error(
          response.status === 401
            ? defaults[401]
            : payload.message ||
                payload.error ||
                defaults[response.status] ||
                'Your question could not be answered. Please try again.'
        )
      }
      const turns = DailyCouncilTurnSchema.array().min(1).max(6).safeParse(payload.turns)
      if (!turns.success) {
        throw new Error(
          'The council returned an unreadable answer. Your question is still here to try again.'
        )
      }
      if (controller.signal.aborted) return
      setExchanges(previous => [
        ...previous,
        { question: text, turns: turns.data as DailyCouncilTurn[] },
      ])
      setQuestion('')
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : 'Your question could not be answered.')
    } finally {
      if (requestRef.current === controller) {
        setSending(false)
        requestRef.current = null
      }
    }
  }

  return (
    <div className="border-t border-[#424936]/60 pt-5">
      {exchanges.length > 0 && (
        <div className="mb-5 space-y-5" aria-live="polite">
          {exchanges.map((exchange, index) => (
            <div key={index}>
              <p className="mb-3 rounded-lg border border-[#7bd1fa]/30 bg-[#7bd1fa]/5 p-3 text-sm leading-relaxed text-[#c2cab0]">
                <span className="mb-1 block text-xs text-[#7bd1fa]">Your follow-up</span>
                {exchange.question}
              </p>
              <ol className="space-y-2">
                {exchange.turns.map(turn => (
                  <CouncilTurn key={turn.id} turn={turn} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        <label
          htmlFor="daily-council-question"
          className="block font-headline-sm text-sm text-[#e0e4d2]"
        >
          Ask about today&apos;s sky
        </label>
        <p id="daily-council-question-help" className="text-xs leading-relaxed text-[#8c947c]">
          Sign in for a personal follow-up with Gregory and the planetary delegates.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="daily-council-question"
            aria-describedby="daily-council-question-help"
            value={question}
            onChange={event => setQuestion(event.target.value)}
            maxLength={1000}
            disabled={sending}
            placeholder="What should I pay attention to today?"
            className="min-w-0 flex-1 rounded-lg border border-[#424936] bg-[#050506] px-4 py-3 text-sm text-[#e0e4d2] placeholder:text-[#8c947c] focus:border-[#7bd1fa] focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!question.trim() || sending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#b8fc4b] px-4 py-3 text-sm font-semibold text-[#090b0e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send aria-hidden="true" className="h-4 w-4" />
            {sending ? 'Asking the council…' : 'Ask the council'}
          </button>
        </div>
        {sending && (
          <p role="status" className="text-xs text-[#7bd1fa]">
            The council is considering your follow-up.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm leading-relaxed text-amber-200">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}

export interface DailyPlanetaryCouncilProps {
  compact?: boolean
  onOpenCouncil?: () => void
}

export function DailyPlanetaryCouncil({
  compact = false,
  onOpenCouncil,
}: DailyPlanetaryCouncilProps) {
  const { edition, previousEdition, updates, status, loading, error, message, refresh } =
    useDailyPlanetaryCouncil()
  const [expanded, setExpanded] = useState(false)
  const label =
    status === 'stale'
      ? 'Previous edition'
      : status === 'briefing'
        ? 'Sky briefing'
        : 'Daily edition'

  return (
    <section
      id={compact ? undefined : 'daily-planetary-council'}
      className="glass-panel overflow-hidden rounded-2xl border border-[#424936]/80 bg-[#090b0e]/95"
      aria-label={compact ? 'Daily council preview' : 'Daily planetary council'}
    >
      <div className={compact ? 'p-5' : 'p-5 sm:p-8'}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-mono-label text-[10px] uppercase tracking-widest text-[#b8fc4b]">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            {label} · Hosted by Gregory Castro
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            aria-label={compact ? 'Refresh council preview' : 'Refresh daily council'}
            className="inline-flex items-center gap-2 rounded-lg border border-[#424936] px-3 py-2 text-xs text-[#c2cab0] disabled:opacity-50"
          >
            <RefreshCw aria-hidden="true" className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <h2
          className={`font-headline-sm text-[#e0e4d2] ${compact ? 'text-lg' : 'text-2xl sm:text-3xl'}`}
        >
          {compact ? 'The planetary council today' : 'Today at the planetary roundtable'}
        </h2>
        {edition ? (
          <>
            <div className="mt-3">
              <EditionBasis edition={edition} />
            </div>
            <p className="mt-4 font-headline-sm text-lg text-[#7bd1fa]">{edition.title}</p>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-[#c2cab0]">{edition.summary}</p>
            {message && (
              <p role="status" className="mt-3 text-xs leading-relaxed text-amber-200">
                {message}
              </p>
            )}
            {status === 'stale' && !message && (
              <p role="status" className="mt-3 text-xs text-amber-200">
                This is the previous edition. Today&apos;s conversation is not yet available.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-amber-200">
                {error} The displayed edition remains available.
              </p>
            )}
            {compact ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setExpanded(value => !value)}
                  aria-expanded={expanded}
                  className="inline-flex items-center gap-2 text-sm text-[#7bd1fa]"
                >
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-4 w-4 ${expanded ? 'rotate-180' : ''}`}
                  />
                  {expanded ? 'Close preview' : 'Read the opening'}
                </button>
                {expanded && (
                  <ol className="mt-3 space-y-2">
                    {edition.turns.slice(0, 3).map(turn => (
                      <CouncilTurn key={turn.id} turn={turn} />
                    ))}
                  </ol>
                )}
                <a
                  href="#daily-planetary-council"
                  className="ml-5 inline-flex items-center gap-1 text-sm text-[#b8fc4b]"
                >
                  Read the full conversation <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </a>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <ol className="space-y-3" aria-label="Today's planetary conversation">
                  {edition.turns.map(turn => (
                    <CouncilTurn key={turn.id} turn={turn} />
                  ))}
                </ol>
                {!!updates?.events.length && (
                  <div className="rounded-xl border border-[#7bd1fa]/30 bg-[#7bd1fa]/[0.03] p-4 sm:p-5">
                    <h3 className="font-headline-sm text-base text-[#7bd1fa]">
                      Updates since the opening
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-[#8c947c]">
                      Calculated events that have now occurred, through {formatUtc(updates.asOf)}{' '}
                      UTC. These use this edition&apos;s verified ephemeris calculations. The
                      opening conversation remains dated to its original snapshot.
                    </p>
                    <ol aria-label="Updates since the opening" className="mt-4 space-y-3">
                      {updates.events.map(event => (
                        <li key={event.id} className="text-sm leading-relaxed text-[#c2cab0]">
                          <time dateTime={event.at} className="text-[#7bd1fa]">
                            {formatUtc(event.at)} UTC
                          </time>{' '}
                          · {event.description}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <SkyFacts edition={edition} />
                {previousEdition && (
                  <details className="rounded-xl border border-[#424936]/70 p-4">
                    <summary className="cursor-pointer text-sm text-[#c2cab0]">
                      Previous hosted conversation · {previousEdition.date} UTC
                    </summary>
                    <p className="my-3 text-xs text-[#8c947c]">
                      This earlier conversation is preserved alongside today&apos;s factual
                      briefing.
                    </p>
                    <ol className="space-y-3" aria-label="Previous hosted conversation">
                      {previousEdition.turns.map(turn => (
                        <CouncilTurn key={turn.id} turn={turn} />
                      ))}
                    </ol>
                  </details>
                )}
                <FollowUpQuestions edition={edition} />
              </div>
            )}
          </>
        ) : loading ? (
          <p role="status" className="mt-4 text-sm text-[#8c947c]">
            Reading the daily planetary conversation…
          </p>
        ) : (
          <p
            role={error ? 'alert' : 'status'}
            className="mt-4 text-sm leading-relaxed text-[#c2cab0]"
          >
            {error ||
              message ||
              'The daily council is not available yet. Please check back or refresh.'}
          </p>
        )}
        {compact && onOpenCouncil && (
          <button type="button" onClick={onOpenCouncil} className="mt-4 text-xs text-[#8c947c]">
            Explore the council chamber ↗
          </button>
        )}
      </div>
    </section>
  )
}
