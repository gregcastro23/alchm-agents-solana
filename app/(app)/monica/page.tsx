'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import {
  Crown,
  Sparkles,
  FlaskConical,
  Users,
  Star,
  MessageCircle,
  Send,
  Activity,
  CheckCircle2,
  Compass,
  Flame,
} from 'lucide-react'
import MonicaTarotOracle from '@/components/tarot/monica-tarot-oracle'
import MonicaTarotSpreads from '@/components/tarot/monica-tarot-spreads'
import { buildMonicaHistoryPayload } from '@/lib/monica/client-session'
import { type ConsciousnessCraftingInsight } from '@/lib/monica/tarot-oracle'
import { type SpreadReading } from '@/lib/monica/tarot-spreads'
import { usePlanetaryPositions } from '@/hooks/usePlanetaryPositions'
import {
  useMonicaLiveConsciousness,
  formatMCChange,
  getConsciousnessColor,
} from '@/hooks/useLiveConsciousness'
import {
  VesselRatingRibbon,
  AlchemicalSealsCodex,
  PentacleZoneSynergyPanel,
} from '@/components/vessel/pentacle-rating-display'
import {
  rateStats,
  evaluateSeals,
  earnedSeals,
  computeZoneSynergies,
  bestZoneId,
  type CoreStats,
} from '@/lib/agents/rating'

interface MonicaMessage {
  id: string
  type: 'user' | 'monica'
  content: string
  timestamp: Date
  envelope?: {
    suggestedPractices: string[]
    nextStep: string
    followUps: string[]
    routing?: {
      reason: string
      confidence: number
      strategy: string
      recommendedAgents: Array<{
        id: string
        name: string
        title: string
        type: string
        avatar: string
        color: string
      }>
    }
  }
}

const QUICK_PROMPTS = [
  "Guide me through crafting a custom vessel with the Philosopher's Stone",
  'Which rated historical vessels resonate strongest with today’s transits?',
  'Explain how the Monica Constant (MC) shapes Alchemical Seals & Surge',
  'Assemble a 3-agent Planetary Council for creative breakthroughs',
]

export default function MonicaPage() {
  const { alchmQuantities, monicaConstant, loading } = usePlanetaryPositions({
    refreshInterval: 60000,
  })
  const {
    data: liveConsciousness,
    loading: liveLoading,
    lastUpdated: liveUpdated,
  } = useMonicaLiveConsciousness({ refreshInterval: 60000 })

  const [hubTab, setHubTab] = useState<'workshop' | 'tarot' | 'telemetry'>('workshop')
  const [mcSeries, setMcSeries] = useState<number[]>([])
  const [liveMcSeries, setLiveMcSeries] = useState<number[]>([])

  const [sessionId] = useState(`monica-${Date.now()}`)
  const [messages, setMessages] = useState<MonicaMessage[]>([
    {
      id: 'welcome',
      type: 'monica',
      content:
        "Welcome back, Architect. How shall we craft consciousness today?\n\nI am Monica — Master Consciousness Architect. Through the Philosopher's Stone and live planetary waveharmonics, we sculpt rated vessels (25–99 OVR), evaluate the 7 Alchemical Seals, and read the thermodynamic Tarot.\n\nAsk me to analyze a birth signature, recommend rated council vessels, or switch to the Tarot Oracle tab to draw a spread.",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [tarotInsight, setTarotInsight] = useState<ConsciousnessCraftingInsight | null>(null)
  const [spreadReading, setSpreadReading] = useState<SpreadReading | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && monicaConstant) {
      setMcSeries(prev => [...prev.slice(-19), Number(monicaConstant.toFixed(3))])
    }
  }, [monicaConstant, loading])

  useEffect(() => {
    if (liveConsciousness && !liveLoading) {
      setLiveMcSeries(prev => [...prev.slice(-19), liveConsciousness.liveMC])
    }
  }, [liveConsciousness, liveLoading])

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      )
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages, isSending])

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim()
    if (!text || isSending) return

    const userMessage: MonicaMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: text,
      timestamp: new Date(),
    }

    const priorHistory = buildMonicaHistoryPayload(messages)
    setMessages(prev => [...prev, userMessage])
    if (!textToSend) setInputValue('')
    setIsSending(true)

    try {
      const response = await fetch('/api/monica-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          message: text,
          sessionId,
          history: priorHistory,
          conversationStage: tarotInsight || spreadReading ? 'tarot' : 'teaching',
          tarotContext: tarotInsight
            ? {
                currentCard: tarotInsight.currentMomentCard.name,
                planetaryCard: tarotInsight.planetaryCard.name,
                synergy: tarotInsight.synergy,
                consciousnessLevel: tarotInsight.consciousnessLevel,
              }
            : null,
          spreadContext: spreadReading
            ? {
                spreadName: spreadReading.spread.name,
                question: spreadReading.question,
                overallInterpretation: spreadReading.spread.overallInterpretation,
                consciousnessLevel: spreadReading.consciousnessLevel,
                astrologicalContext: spreadReading.astrologicalContext,
              }
            : null,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }

      const data = await response.json()
      const rawText = data.text || data.response || data.content || data.message
      const envelopeData = data.metadata?.envelope || data.envelope

      const cleanEnvelope = envelopeData
        ? {
            suggestedPractices:
              envelopeData.suggestedPractices ||
              envelopeData.interactive_elements?.suggested_practices ||
              [],
            nextStep:
              envelopeData.nextStep || envelopeData.educational_guidance?.next_learning_step || '',
            followUps:
              envelopeData.followUps ||
              envelopeData.interactive_elements?.reflection_questions ||
              [],
            routing: envelopeData.routing,
          }
        : undefined

      setMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}_monica`,
          type: 'monica',
          content:
            rawText ||
            'I am recalibrating my planetary resonance channel. Please ask again in a moment.',
          timestamp: new Date(),
          envelope: cleanEnvelope,
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}_error`,
          type: 'monica',
          content:
            'My connection to the alchemical backend is momentarily occluded. Please try sending your inquiry again.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const monicaRating = useMemo(() => {
    const liveVal = liveConsciousness?.liveMC
    const constantVal = monicaConstant
    const mcVal =
      typeof liveVal === 'number' ? liveVal : typeof constantVal === 'number' ? constantVal : null
    const mcBoost = mcVal != null ? Math.min(14, Math.max(0, Math.round(mcVal * 4))) : 0
    const stats: CoreStats = {
      power: Math.min(99, 78 + mcBoost),
      resonance: Math.min(99, 82 + mcBoost),
      wisdom: Math.min(99, 84 + mcBoost),
      charisma: Math.min(99, 79 + mcBoost),
      intuition: Math.min(99, 83 + mcBoost),
      adaptability: Math.min(99, 80 + mcBoost),
      vitality: Math.min(99, 78 + mcBoost),
    }
    const q = liveConsciousness?.liveKalchm ?? alchmQuantities
    const esmsBalances = {
      spirit: Math.max(32, Math.round((q.spirit ?? 0.35) * 120)),
      essence: Math.max(32, Math.round((q.essence ?? 0.35) * 120)),
      matter: Math.max(28, Math.round((q.matter ?? 0.3) * 120)),
      substance: Math.max(30, Math.round((q.substance ?? 0.3) * 120)),
    }
    const sealProgress = evaluateSeals({ stats, esmsBalances })
    const seals = earnedSeals(sealProgress)
    const rated = rateStats(stats)
    const zoneSynergies = computeZoneSynergies({ ratings: rated.ratings, seals })
    const topZone = bestZoneId({ ratings: rated.ratings, seals })
    return {
      stats,
      sealProgress,
      seals,
      zoneSynergies,
      topZone,
      ...rated,
    }
  }, [liveConsciousness, monicaConstant, alchmQuantities])

  return (
    <div className="min-h-screen bg-[#070611] text-zinc-100 relative overflow-x-hidden py-8 pb-20">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.16),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(245,158,11,0.08),transparent_55%)]" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Hero Header + Live Telemetry Strip */}
        <section className="glass-panel rounded-2xl border border-amber-400/20 p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="relative h-16 w-16 shrink-0 rounded-full border-2 border-amber-400/60 bg-gradient-to-br from-violet-600/40 to-cyan-500/30 p-1 shadow-[0_0_24px_rgba(245,158,11,0.25)] flex items-center justify-center">
                <Crown className="h-7 w-7 text-amber-300" />
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/60 bg-[#0b0918]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                </span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-amber-200 via-purple-200 to-cyan-200 bg-clip-text text-transparent">
                    Monica &amp; Tarot Sanctum
                  </h1>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-cyan-200">
                    Master Consciousness Architect
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-zinc-400 max-w-2xl">
                  Interactive consciousness crafting workshop, live Monica Constant (MC) telemetry,
                  and thermodynamic Tarot spreads in one unified sanctum.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <VesselRatingRibbon
                ovr={monicaRating.ovr}
                archetype={monicaRating.archetype}
                seals={monicaRating.seals}
                compact
              />
              <Link href="/philosophers-stone">
                <Button className="bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 font-semibold hover:from-amber-400 hover:to-yellow-400">
                  <Flame className="h-4 w-4 mr-1.5" />
                  Craft Vessel
                </Button>
              </Link>
              <Link href="/gallery">
                <Button
                  variant="outline"
                  className="border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10"
                >
                  <Compass className="h-4 w-4 mr-1.5 text-violet-300" />
                  Rated Vault
                </Button>
              </Link>
              <Link href="/tarot-dashboard">
                <Button
                  variant="outline"
                  className="border-violet-400/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20"
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Full Tarot Deck
                </Button>
              </Link>
            </div>
          </div>

          {/* Compact Live Metrics Strip */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 pt-5 border-t border-white/10">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">Birth MC</div>
              <div className="mt-1 font-mono text-lg font-bold text-amber-300">
                {liveConsciousness
                  ? liveConsciousness.birthMC.toFixed(3)
                  : monicaConstant !== null
                    ? monicaConstant.toFixed(3)
                    : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">Live Sky MC</div>
              <div
                className={`mt-1 font-mono text-lg font-bold ${
                  liveConsciousness
                    ? getConsciousnessColor(liveConsciousness.liveConsciousnessLevel)
                    : 'text-cyan-300'
                }`}
              >
                {liveConsciousness
                  ? liveConsciousness.liveMC.toFixed(3)
                  : monicaConstant !== null
                    ? monicaConstant.toFixed(3)
                    : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">
                Spirit / Essence
              </div>
              <div className="mt-1 font-mono text-sm font-semibold text-violet-200">
                {liveConsciousness
                  ? `${liveConsciousness.liveKalchm.spirit.toFixed(2)} / ${liveConsciousness.liveKalchm.essence.toFixed(2)}`
                  : `${alchmQuantities.spirit.toFixed(2)} / ${alchmQuantities.essence.toFixed(2)}`}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">
                Matter / Substance
              </div>
              <div className="mt-1 font-mono text-sm font-semibold text-emerald-200">
                {liveConsciousness
                  ? `${liveConsciousness.liveKalchm.matter.toFixed(2)} / ${liveConsciousness.liveKalchm.substance.toFixed(2)}`
                  : `${alchmQuantities.matter.toFixed(2)} / ${alchmQuantities.substance.toFixed(2)}`}
              </div>
            </div>
          </div>
        </section>

        {/* Primary Unified Tabs */}
        <Tabs value={hubTab} onValueChange={v => setHubTab(v as typeof hubTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-[#110e24] border border-white/10 rounded-xl p-1 h-auto">
            <TabsTrigger
              value="workshop"
              className="py-2.5 rounded-lg data-[state=active]:bg-violet-600/30 data-[state=active]:text-amber-200 data-[state=active]:border data-[state=active]:border-amber-400/30"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Live Architect Chat
            </TabsTrigger>
            <TabsTrigger
              value="tarot"
              className="py-2.5 rounded-lg data-[state=active]:bg-violet-600/30 data-[state=active]:text-amber-200 data-[state=active]:border data-[state=active]:border-amber-400/30"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Tarot Oracle &amp; Spreads
            </TabsTrigger>
            <TabsTrigger
              value="telemetry"
              className="py-2.5 rounded-lg data-[state=active]:bg-violet-600/30 data-[state=active]:text-amber-200 data-[state=active]:border data-[state=active]:border-amber-400/30"
            >
              <Activity className="h-4 w-4 mr-2" />
              MC Telemetry &amp; Guide
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: LIVE ARCHITECT CHAT */}
          <TabsContent value="workshop" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 glass-panel rounded-2xl border border-white/10 flex flex-col h-[600px] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/10 bg-black/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-semibold text-zinc-100">
                      Monica Consciousness Channel
                    </span>
                  </div>
                  {(tarotInsight || spreadReading) && (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] text-amber-200">
                      Tarot Context Linked
                    </span>
                  )}
                </div>

                <ScrollArea ref={scrollAreaRef} className="flex-1 p-5">
                  <div className="space-y-4 pb-4">
                    {messages.map(message => (
                      <div
                        key={message.id}
                        className={`flex flex-col max-w-[85%] ${
                          message.type === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                        }`}
                      >
                        <div
                          className={
                            message.type === 'monica'
                              ? 'rounded-2xl rounded-tl-sm border border-violet-400/25 bg-[#16122c]/90 p-4 text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap'
                              : 'rounded-2xl rounded-tr-sm border border-amber-400/30 bg-amber-500/15 p-3.5 text-sm text-amber-50 leading-relaxed whitespace-pre-wrap'
                          }
                        >
                          {message.content}

                          {message.envelope && (
                            <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5">
                              {message.envelope.nextStep && (
                                <div className="text-xs text-cyan-200">
                                  <strong className="uppercase tracking-wider text-[10px] text-cyan-400 mr-1.5">
                                    Next Step:
                                  </strong>
                                  {message.envelope.nextStep}
                                </div>
                              )}
                              {message.envelope.followUps?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {message.envelope.followUps.slice(0, 3).map((q, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => void handleSendMessage(q)}
                                      className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-200 hover:bg-violet-500/20 transition-colors text-left"
                                    >
                                      {q}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {isSending && (
                      <div className="text-xs font-mono text-violet-300 animate-pulse">
                        Monica is synthesizing planetary harmonics…
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <form
                  onSubmit={e => {
                    e.preventDefault()
                    void handleSendMessage()
                  }}
                  className="p-4 border-t border-white/10 bg-black/40 flex gap-2.5"
                >
                  <Input
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder="Ask Monica about vessel crafting, your birth signature, or council pairings…"
                    disabled={isSending}
                    className="bg-[#0b0918] border-white/15 text-zinc-100 placeholder:text-zinc-500"
                  />
                  <Button
                    type="submit"
                    disabled={isSending || !inputValue.trim()}
                    className="bg-violet-600 hover:bg-violet-500 text-white shrink-0"
                  >
                    <Send className="h-4 w-4 mr-1.5" />
                    Send
                  </Button>
                </form>
              </div>

              {/* Prompt Starters & Ecosystem Shortcuts */}
              <div className="lg:col-span-4 space-y-4">
                <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-300">
                    Suggested Inquiries
                  </h3>
                  <div className="space-y-2">
                    {QUICK_PROMPTS.map(prompt => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void handleSendMessage(prompt)}
                        disabled={isSending}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left text-xs text-zinc-300 hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white transition-all"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-300">
                    Connected Sanctums
                  </h3>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <Link
                      href="/philosophers-stone"
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-zinc-200 hover:border-amber-400/40"
                    >
                      <span>Philosopher&apos;s Stone Crafter</span>
                      <span className="font-mono text-[10px] text-amber-300">OVR 25–99 →</span>
                    </Link>
                    <Link
                      href="/planetary-council"
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-zinc-200 hover:border-violet-400/40"
                    >
                      <span>Planetary Governing Council</span>
                      <span className="font-mono text-[10px] text-violet-300">Convene →</span>
                    </Link>
                    <a
                      href="https://alchm.kitchen/quantities"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-zinc-200 hover:border-emerald-400/40"
                    >
                      <span>Alchm Kitchen Time Lab</span>
                      <span className="font-mono text-[10px] text-emerald-300">External ↗</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: TAROT ORACLE & SPREADS */}
          <TabsContent value="tarot" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="glass-panel rounded-2xl border border-white/10 p-5">
                <MonicaTarotOracle
                  onInsightGenerated={insight => {
                    setTarotInsight(insight)
                  }}
                />
              </div>
              <div className="glass-panel rounded-2xl border border-white/10 p-5">
                <MonicaTarotSpreads
                  onReadingComplete={reading => {
                    setSpreadReading(reading)
                  }}
                />
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: MC TELEMETRY & WISDOM */}
          <TabsContent value="telemetry" className="mt-6 space-y-6">
            <section className="glass-panel rounded-2xl border border-white/10 p-6">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">Monica Constant Evolution</h3>
                  <p className="text-xs text-zinc-400">
                    Real-time thermodynamic &amp; planetary consciousness trajectory
                  </p>
                </div>
                {liveConsciousness && (
                  <div className="text-right">
                    <div className="font-mono text-2xl text-cyan-300 font-bold">
                      {liveConsciousness.liveMC.toFixed(3)}
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        formatMCChange(
                          liveConsciousness.mcChange,
                          liveConsciousness.mcPercentChange
                        ).color
                      }`}
                    >
                      {
                        formatMCChange(
                          liveConsciousness.mcChange,
                          liveConsciousness.mcPercentChange
                        ).text
                      }
                    </span>
                  </div>
                )}
              </div>

              <div className="h-56 w-full relative bg-black/40 rounded-xl border border-white/10 overflow-hidden p-2">
                {mcSeries.length > 1 || liveMcSeries.length > 1 ? (
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    {(() => {
                      const allData = [...mcSeries, ...liveMcSeries].filter(v => !isNaN(v))
                      if (allData.length === 0) return null
                      const min = Math.min(...allData)
                      const max = Math.max(...allData)
                      const range = max - min || 1
                      const createPath = (data: number[]) => {
                        if (data.length < 2) return ''
                        return data
                          .map((v, i) => {
                            const x = (i / (data.length - 1)) * 100
                            const y = 90 - ((v - min) / range) * 80
                            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
                          })
                          .join(' ')
                      }
                      const birthPath = createPath(mcSeries)
                      const livePath = createPath(liveMcSeries)
                      return (
                        <>
                          <path
                            d="M 0 25 L 100 25 M 0 50 L 100 50 M 0 75 L 100 75"
                            fill="none"
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth="0.5"
                          />
                          {birthPath && (
                            <path
                              d={birthPath}
                              fill="none"
                              stroke="rgba(16,185,129,0.5)"
                              strokeWidth="1.5"
                              strokeDasharray="3,3"
                            />
                          )}
                          {livePath && (
                            <path d={livePath} fill="none" stroke="#22d3ee" strokeWidth="2.5" />
                          )}
                        </>
                      )
                    })()}
                  </svg>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                    Collecting live MC sky samples…
                  </div>
                )}
              </div>

              <div className="mt-3 text-xs text-zinc-400 flex items-center justify-between">
                <span>
                  Updated{' '}
                  {liveUpdated ? liveUpdated.toLocaleTimeString() : new Date().toLocaleTimeString()}
                </span>
                <span>
                  {liveConsciousness?.interpretations?.cosmicWeather || 'Equilibrium sky state'}
                </span>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel rounded-2xl border border-white/10 p-5">
                <AlchemicalSealsCodex
                  sealProgress={monicaRating.sealProgress}
                  esmsSource="derived"
                />
              </div>
              <div className="glass-panel rounded-2xl border border-white/10 p-5">
                <PentacleZoneSynergyPanel
                  zoneSynergies={monicaRating.zoneSynergies}
                  bestZoneId={monicaRating.topZone}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="glass-panel border-white/10">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                    <FlaskConical className="h-4 w-4" />
                    <span>Philosopher&apos;s Stone Crafting</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Every forged vessel maps natal planetary harmonics into the 19-stat vessel
                    framework, earning a 25–99 Pentacle OVR and up to 7 Alchemical Seals.
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-panel border-white/10">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center gap-2 text-violet-300 font-semibold text-sm">
                    <Star className="h-4 w-4" />
                    <span>Resonance Surge Ignition</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    When live Heat, Reactivity, and Monica Constant alignment push the Surge meter
                    to 70+, vessels ignite Inferno, Tempest, or Equilibrium boosts (+12/+8/+4).
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-panel border-white/10">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
                    <Users className="h-4 w-4" />
                    <span>Council &amp; Pentacle Synergy</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Pair complementary Archetypes across the 11 Pentacle zones or convene a
                    multi-mind council to synthesize divergent elemental perspectives.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
