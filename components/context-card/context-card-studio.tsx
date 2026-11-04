'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CardDoc } from './card-doc'
import { ExportPanel } from './export-panel'
import { buildOutput } from '@/lib/context-card/serializers'
import { DEMO_SKY, type SkySource } from '@/lib/context-card/transit-engine'
import type { ContextCardData, ExportFormat, ExportOptions } from '@/lib/context-card/types'
import {
  VesselRatingRibbon,
  AlchemicalSealsCodex,
} from '@/components/vessel/pentacle-rating-display'
import { rateStats, evaluateSeals, earnedSeals, type CoreStats } from '@/lib/agents/rating'

const ACCENTS: Record<string, { gold: string; hi: string; border: string }> = {
  'Solar gold': { gold: '#e9b86f', hi: '#f5d195', border: 'rgba(245,181,66,0.42)' },
  Amethyst: { gold: '#a78bfa', hi: '#c4b5fd', border: 'rgba(167,139,250,0.46)' },
  Tide: { gold: '#5e9bd6', hi: '#8fbfe8', border: 'rgba(94,155,214,0.46)' },
  Ember: { gold: '#ef5d4e', hi: '#f59b8f', border: 'rgba(239,93,78,0.44)' },
}
const ACCENT_NAMES = Object.keys(ACCENTS)
const DENSITIES = ['compact', 'regular', 'comfy'] as const
type Density = (typeof DENSITIES)[number]

const PRICE = 12
const STORE = { unlocked: 'alchm_card_unlocked', balance: 'alchm_card_balance' }
const START_BALANCE = 208

interface Props {
  data: ContextCardData
  sky?: SkySource
  /** server-side entitlement: true when the signed-in user has already unlocked */
  initialUnlocked?: boolean
}

export function ContextCardStudio({ data, sky = DEMO_SKY, initialUnlocked = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  const [accent, setAccent] = useState('Solar gold')
  const [density, setDensity] = useState<Density>('regular')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [format, setFormat] = useState<ExportFormat>('md')
  const [opts, setOpts] = useState<ExportOptions>({
    promptHeader: true,
    synopsis: true,
    houses: true,
    aspects: true,
    minorAspects: true,
    transits: !!data.transits,
    alchm: true,
    annotated: false,
  })

  // 'real' once we've confirmed a live wallet; 'demo' falls back to localStorage.
  const [mode, setMode] = useState<'demo' | 'real'>('demo')
  // Seeded from the server-side entitlement so an already-unlocked user sees the
  // card unlocked on first paint (no flash); the effect ORs in any local demo unlock.
  const [unlocked, setUnlocked] = useState(initialUnlocked)
  const [unlocking, setUnlocking] = useState(false)
  const [balance, setBalance] = useState(START_BALANCE)
  const [toastMsg, setToastMsg] = useState('')
  const [toastShow, setToastShow] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sumEsms = (b: Record<string, unknown> | null | undefined) =>
    Math.round(
      (Number(b?.spirit) || 0) +
        (Number(b?.essence) || 0) +
        (Number(b?.matter) || 0) +
        (Number(b?.substance) || 0)
    )

  // Hydrate unlock UI state + resolve the wallet. If the live balance endpoint
  // answers we're in 'real' mode (total ESMS = sum of the four token types);
  // otherwise (signed out / economy unreachable) we fall back to the localStorage demo.
  useEffect(() => {
    let cancelled = false
    if (localStorage.getItem(STORE.unlocked) === '1') setUnlocked(true)
    ;(async () => {
      try {
        const res = await fetch('/api/economy/balances', { cache: 'no-store' })
        if (!res.ok) throw new Error('balances unavailable')
        const b = await res.json()
        if (!cancelled) {
          setMode('real')
          setBalance(sumEsms(b))
        }
      } catch {
        const v = parseInt(localStorage.getItem(STORE.balance) || '', 10)
        if (!cancelled) {
          setMode('demo')
          if (Number.isFinite(v)) setBalance(v)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // apply accent → scoped CSS vars (no global bleed)
  useEffect(() => {
    const a = ACCENTS[accent] || ACCENTS['Solar gold']
    const el = rootRef.current
    if (!el) return
    el.style.setProperty('--gold', a.gold)
    el.style.setProperty('--gold-hi', a.hi)
    el.style.setProperty('--border-gold', a.border)
  }, [accent])

  const toast = (msg: string) => {
    setToastMsg(msg)
    setToastShow(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastShow(false), 2200)
  }

  const toggleOpt = (key: keyof ExportOptions) => setOpts(o => ({ ...o, [key]: !o[key] }))

  const onUnlock = async () => {
    if (unlocked || unlocking) return

    if (mode === 'demo') {
      if (balance < PRICE) {
        toast('Not enough ESMS — top up to unlock')
        return
      }
      const next = balance - PRICE
      setBalance(next)
      setUnlocked(true)
      localStorage.setItem(STORE.balance, String(next))
      localStorage.setItem(STORE.unlocked, '1')
      toast(PRICE + ' ESMS spent · card unlocked')
      return
    }

    // real spend
    setUnlocking(true)
    try {
      const res = await fetch('/api/context-card/unlock', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.ok) {
        setUnlocked(true)
        localStorage.setItem(STORE.unlocked, '1')
        if (body.balances) setBalance(sumEsms(body.balances))
        toast(body.skipped ? 'Card unlocked' : PRICE + ' ESMS spent · card unlocked')
      } else if (res.status === 402) {
        if (body.balances) setBalance(sumEsms(body.balances))
        toast('Not enough ESMS — top up to unlock')
      } else if (res.status === 401) {
        toast('Sign in to unlock your card')
      } else {
        toast('Unlock failed — please try again')
      }
    } catch {
      toast('Unlock failed — please try again')
    } finally {
      setUnlocking(false)
    }
  }

  const resetUnlock = () => {
    localStorage.removeItem(STORE.unlocked)
    setUnlocked(false)
    setSettingsOpen(false)
    if (mode === 'demo') {
      localStorage.setItem(STORE.balance, String(START_BALANCE))
      setBalance(START_BALANCE)
      toast('Unlock reset · balance restored')
    } else {
      toast('Card relocked')
    }
  }

  const output = useMemo(() => buildOutput(data, format, opts), [data, format, opts])

  const planetCount = data.points.filter(p => p.kind === 'planet').length
  const pointCount = data.points.filter(p => p.kind === 'point').length
  const houseCount = data.houses.length
  const aspectCount = data.aspects.length
  const hasSacredStats =
    Object.keys(data.alchm.sacred7).length > 0 || Object.keys(data.alchm.planetary12).length > 0

  const contextCardRating = useMemo(() => {
    const s7 = data.alchm.sacred7 || {}
    const stats: CoreStats = {
      power: Math.min(99, Math.max(55, Math.round(Number(s7.power ?? s7.Power ?? 74)))),
      resonance: Math.min(99, Math.max(55, Math.round(Number(s7.resonance ?? s7.Resonance ?? 76)))),
      wisdom: Math.min(99, Math.max(55, Math.round(Number(s7.wisdom ?? s7.Wisdom ?? 78)))),
      charisma: Math.min(99, Math.max(55, Math.round(Number(s7.charisma ?? s7.Charisma ?? 73)))),
      intuition: Math.min(99, Math.max(55, Math.round(Number(s7.intuition ?? s7.Intuition ?? 77)))),
      adaptability: Math.min(
        99,
        Math.max(55, Math.round(Number(s7.adaptability ?? s7.Adaptability ?? 74)))
      ),
      vitality: Math.min(99, Math.max(55, Math.round(Number(s7.vitality ?? s7.Vitality ?? 75)))),
    }
    const perAxis = Math.max(12, Math.round(balance / 4))
    const esmsBalances = {
      spirit: Math.max(perAxis, Math.round(Number(data.alchm.esms?.spirit ?? 0) * 100)),
      essence: Math.max(perAxis, Math.round(Number(data.alchm.esms?.essence ?? 0) * 100)),
      matter: Math.max(perAxis, Math.round(Number(data.alchm.esms?.matter ?? 0) * 100)),
      substance: Math.max(perAxis, Math.round(Number(data.alchm.esms?.substance ?? 0) * 100)),
    }
    const sealProgress = evaluateSeals({ stats, esmsBalances })
    const seals = earnedSeals(sealProgress)
    const rated = rateStats(stats)
    return {
      ovr: rated.ovr,
      archetype: rated.archetype,
      seals,
      sealProgress,
    }
  }, [data.alchm.sacred7, data.alchm.esms, balance])

  return (
    <div className="acc-root" ref={rootRef}>
      <header className="studio-top">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <span className="ttl">Cosmic Agents</span>
          <span className="crumb">Context Card</span>
        </div>
        <div className="spacer"></div>
        <Link className="back-link" href="/profile">
          My Natal Codex →
        </Link>
        <Link className="back-link" href="/pentacles">
          Star Vaults →
        </Link>
        <Link className="back-link" href="/council-feed">
          ← Council Feed
        </Link>
        <button
          className="settings-toggle"
          onClick={() => setSettingsOpen(v => !v)}
          aria-expanded={settingsOpen}
        >
          ⚙ Display
        </button>
        <div className="wallet">
          <span className="esms-mark">◈</span>
          <span className="bal">{balance}</span>
          <span className="lab">ESMS</span>
        </div>
      </header>

      {settingsOpen ? (
        <div className="settings-pop">
          <div className="sgroup">
            <div className="slabel">Accent</div>
            <div className="accent-row">
              {ACCENT_NAMES.map(name => (
                <div
                  key={name}
                  className={'accent-chip ' + (accent === name ? 'on' : '')}
                  title={name}
                  style={{ background: ACCENTS[name].gold }}
                  onClick={() => setAccent(name)}
                />
              ))}
            </div>
          </div>
          <div className="sgroup">
            <div className="slabel">Density</div>
            <div className="seg">
              {DENSITIES.map(d => (
                <span
                  key={d}
                  className={'s ' + (density === d ? 'on' : '')}
                  onClick={() => setDensity(d)}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
          <button className="back-link" style={{ justifyContent: 'center' }} onClick={resetUnlock}>
            {mode === 'demo' ? 'Reset unlock & refund' : 'Relock card'}
          </button>
        </div>
      ) : null}

      <section className="studio-intro">
        <div className="eyebrow">Personalized LLM context · alchm astrology</div>
        <h1>Your whole sky, in one file an&nbsp;LLM can read.</h1>
        <p>
          Most astrology AI reads one paragraph for 600&nbsp;million people. This card hands any
          model your <b style={{ color: 'var(--ink)', fontWeight: 500 }}>complete natal chart</b> —
          every placement, house cusp and aspect at Swiss-Ephemeris precision — fused with your
          alchm energetic profile. Attach it once; get answers grounded in <i>your</i> chart,
          forever.
        </p>
        <div className="badges">
          <span className="ibadge">
            <b>{planetCount}</b> planets
            {pointCount ? (
              <>
                {' '}
                + <b>{pointCount}</b> points
              </>
            ) : null}
          </span>
          {houseCount ? (
            <span className="ibadge">
              <b>{houseCount}</b> house cusps
            </span>
          ) : null}
          {aspectCount ? (
            <span className="ibadge">
              <b>{aspectCount}</b> aspects
            </span>
          ) : null}
          <span className="ibadge">
            <b>ESMS</b> · Kalchm · Monica
          </span>
          {hasSacredStats ? (
            <span className="ibadge">Sacred&nbsp;7 + Planetary&nbsp;12</span>
          ) : null}
        </div>
        <div style={{ marginTop: 16, maxWidth: 680 }}>
          <VesselRatingRibbon
            ovr={contextCardRating.ovr}
            archetype={contextCardRating.archetype}
            seals={contextCardRating.seals}
            compact
          />
        </div>
      </section>

      <main className={'studio density-' + density}>
        <div className="panel">
          <div className="panel-head">
            <h2>Context Card</h2>
            <span className="sub">
              {data.birth.zodiac} · {data.birth.houseSystem}
            </span>
          </div>
          <CardDoc data={data} opts={opts} sky={sky} />
        </div>

        <ExportPanel
          format={format}
          setFormat={setFormat}
          opts={opts}
          toggleOpt={toggleOpt}
          output={output}
          unlocked={unlocked}
          price={PRICE}
          balance={balance}
          onUnlock={onUnlock}
          toast={toast}
        />
      </main>

      <div className={'toast ' + (toastShow ? 'show' : '')}>
        <span className="d"></span>
        {toastMsg}
      </div>
    </div>
  )
}
