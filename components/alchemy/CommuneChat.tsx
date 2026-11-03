'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { AlchemicalButton } from './AlchemicalButton'
import { RitualInput } from './RitualInput'
import { createUnifiedChatHeaders } from '@/lib/agents/unified-chat-request'
import { useOccultStore } from '@/lib/store/occult-store'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'
import type { RatedVesselPayload } from '@/lib/agents/rating'

/**
 * Vault Communion — the v2 in-shell chat surface (the "commune" step of the
 * core loop). Speaks to the persona-first pipeline via /api/agents/unified
 * ({action:'chat'}), which debits ESMS per exchange (waived for the weekly
 * free rotation), caps the model tier to the user's entitlement, and returns
 * post-debit balances that this component pushes into the shell sidebar.
 * The communion tier chosen in the Forge engine step is honored here.
 */

interface CommuneMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
  meta?: { provider?: string; model?: string; tier?: string }
}

export interface CommuneChatProps {
  agentId: string
  name: string
  title?: string | null
  essence?: string | null
}

export function CommuneChat({ agentId, name, title, essence }: CommuneChatProps) {
  const [messages, setMessages] = useState<CommuneMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [needsTokens, setNeedsTokens] = useState(false)
  const [freeThisWeek, setFreeThisWeek] = useState(false)
  const [ratingPayload, setRatingPayload] = useState<RatedVesselPayload | null>(null)
  const idCounter = useRef(0)
  const sessionIdRef = useRef<string>('')
  const scrollAnchor = useRef<HTMLDivElement>(null)
  const communionTier = useOccultStore(state => state.communionTier)
  const setBalances = useOccultStore(state => state.setBalances)

  if (!sessionIdRef.current && typeof crypto !== 'undefined') {
    sessionIdRef.current = `commune-${crypto.randomUUID()}`
  }

  const nextId = () => `commune-${++idCounter.current}`

  useEffect(() => {
    let cancelled = false
    fetch(`/api/agents/rating?agentId=${encodeURIComponent(agentId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data && typeof data.ovr === 'number' && data.archetype) {
          setRatingPayload(data as RatedVesselPayload)
        }
      })
      .catch(() => {
        // Non-fatal rating badge lookup
      })
    return () => {
      cancelled = true
    }
  }, [agentId])

  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy, error])

  const send = async (text: string) => {
    setBusy(true)
    setError(null)
    setNeedsAuth(false)
    setNeedsTokens(false)
    const userMsgId = nextId()
    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: text, timestamp: new Date().toISOString() },
    ])

    try {
      const res = await fetch('/api/agents/unified', {
        method: 'POST',
        headers: createUnifiedChatHeaders(),
        body: JSON.stringify({
          action: 'chat',
          parameters: {
            agentId,
            message: text,
            sessionId: sessionIdRef.current,
            modelTier: communionTier,
          },
        }),
      })

      const payload = await res.json().catch(() => null)

      if (res.status === 401) {
        setNeedsAuth(true)
        throw new Error('Only the attuned may commune. Sign in to open the channel.')
      }
      if (res.status === 402) {
        setNeedsTokens(true)
        throw new Error(
          'The vessel demands tribute — your ESMS reserves are spent. Claim yield or attune to replenish.'
        )
      }
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error ?? `The communion channel collapsed (${res.status}).`)
      }

      const reply: string =
        payload.data?.text ?? payload.data?.response ?? 'The entity remains silent.'
      const metadata = payload.data?.metadata ?? {}
      const replyId = nextId()
      setMessages(prev => [
        ...prev,
        {
          id: replyId,
          role: 'agent',
          content: reply,
          timestamp: new Date().toISOString(),
          meta: { provider: metadata.provider, model: metadata.model, tier: metadata.tier },
        },
      ])

      setFreeThisWeek(Boolean(payload.free))
      if (payload.balances && typeof payload.balances.spirit === 'number') {
        setBalances({
          spirit: Number(payload.balances.spirit),
          essence: Number(payload.balances.essence),
          matter: Number(payload.balances.matter),
          substance: Number(payload.balances.substance),
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The communion channel collapsed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-st-background pb-56 md:pb-40">
      {/* Identity header */}
      <header className="px-margin-mobile md:px-margin-desktop pt-8 max-w-container-max mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/gallery"
            className="font-label-mono text-label-mono text-on-surface-variant hover:text-st-primary transition-colors inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              arrow_back
            </span>
            Rated Entities Vault
          </Link>
          <Link
            href={`/agent/${agentId}`}
            className="font-label-mono text-[11px] uppercase tracking-widest text-amber-200 hover:text-amber-100 border border-amber-400/35 bg-amber-400/10 rounded-full px-3.5 py-1.5 inline-flex items-center gap-1.5 transition-colors"
          >
            <span>View Full Rated Codex</span>
            <span className="material-symbols-outlined text-[14px]" aria-hidden>
              arrow_forward
            </span>
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{name}</h1>
          {title && (
            <p className="font-label-mono text-label-mono text-spirit-violet uppercase">{title}</p>
          )}
          {ratingPayload && (
            <VesselRatingRibbon
              ovr={ratingPayload.ovr}
              archetype={ratingPayload.archetype}
              seals={ratingPayload.seals}
              surge={ratingPayload.surge}
              compact
            />
          )}
          {freeThisWeek && (
            <span className="font-label-mono text-[11px] uppercase tracking-widest text-st-secondary glass-panel rounded-full px-3 py-1">
              Free attunement this week
            </span>
          )}
        </div>
        {essence && (
          <p className="font-body-md text-body-md text-on-surface-variant mt-2 max-w-2xl">
            {essence}
          </p>
        )}
      </header>

      {/* Transcript */}
      <div
        aria-live="polite"
        className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto mt-8 flex flex-col gap-4"
      >
        {messages.length === 0 && (
          <p className="font-body-md text-body-md text-outline text-center py-12">
            Speak, and the entity will answer in its own voice.
          </p>
        )}
        {messages.map(msg =>
          msg.role === 'user' ? (
            <div key={msg.id} className="self-end glass-float rounded-xl px-5 py-3 max-w-[85%]">
              <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">
                {msg.content}
              </p>
            </div>
          ) : (
            <div
              key={msg.id}
              className="self-start max-w-[85%] md:max-w-[70%] rounded-xl p-5 glass-panel glow-violet border border-spirit-violet/30"
            >
              <p className="font-label-mono text-[11px] uppercase tracking-widest mb-2 text-spirit-violet">
                {name}
              </p>
              <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">
                {msg.content}
              </p>
              {(msg.meta?.provider || msg.meta?.tier) && (
                <p className="font-label-mono text-[10px] uppercase tracking-widest text-outline mt-3">
                  channel:{' '}
                  {[msg.meta.tier, msg.meta.provider, msg.meta.model].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          )
        )}
        {busy && (
          <div className="self-start glass-panel rounded-xl px-5 py-3">
            <span className="dot-typing" aria-label="responding" />
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="error-glow rounded-lg p-4 font-label-mono text-label-mono text-error"
          >
            {error}{' '}
            {needsAuth ? (
              <Link
                href={`/auth/signin?callbackUrl=${encodeURIComponent(`/vault/${agentId}`)}`}
                className="underline text-st-primary"
              >
                Sign in
              </Link>
            ) : (
              needsTokens && (
                <Link href="/attunement-circle" className="underline text-st-primary">
                  Attune to earn ESMS
                </Link>
              )
            )}
          </div>
        )}
        <div ref={scrollAnchor} />
      </div>

      {/* Composer */}
      <form
        className="fixed bottom-6 left-0 right-0 px-margin-mobile md:px-margin-desktop z-30"
        onSubmit={e => {
          e.preventDefault()
          if (!draft.trim() || busy) return
          void send(draft.trim())
          setDraft('')
        }}
      >
        <div className="max-w-3xl mx-auto flex items-end gap-3 glass-float rounded-xl p-3">
          <div className="flex-1">
            <RitualInput
              label="COMMUNION"
              placeholder={`Address ${name}…`}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              disabled={busy}
            />
          </div>
          <AlchemicalButton type="submit" disabled={busy || !draft.trim()}>
            {busy ? 'Communing…' : 'Send'}
          </AlchemicalButton>
        </div>
      </form>
    </div>
  )
}
