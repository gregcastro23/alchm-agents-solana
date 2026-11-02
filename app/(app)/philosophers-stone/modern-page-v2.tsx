'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import PhilosophersStoneComponent from './PhilosophersStoneComponent'
import { createForgeAttempt, submitForge, type ForgeIdentity } from '@/lib/agents/forge-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import {
  Sparkles,
  Brain,
  Calendar,
  Wand2,
  Atom,
  FlaskConical,
  ChevronRight,
  ChevronLeft,
  Loader2,
  MessageCircle,
  Zap,
  Radio,
  BookOpen,
  Users,
  Eye,
  Waves,
  Activity,
  Download,
  Archive,
  Monitor,
  Shield,
  Crown,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import { downloadManifest, downloadIgnitionBundle } from '@/lib/agents/ignition-bundle-generator'
import { calculateAllPlanets } from '@/lib/enhanced-astronomical-calculator'
import type { EnhancedBirthInfo } from '@/lib/enhanced-astronomical-calculator'
import { parseBirthData, formatBirthData } from '@/lib/monica/birth-data-parser'
import {
  type Sacred7Stats,
  SACRED_STATS_METADATA,
  deriveStatsFromChart,
  calculateAverage,
} from '@/lib/sacred-7-stats'
import {
  rateStats,
  evaluateSeals,
  earnedSeals,
  computeZoneSynergies,
  bestZoneId,
  computeMeanAlignedRating,
  toRating,
} from '@/lib/agents/rating'
import {
  CANONICAL_SEAL_CATALOG,
  SEAL_STAT_GATES,
  type SacredStatKey,
} from '@/lib/agents/rating-contract'
import { resolveAgentAppearance } from '@/lib/agents/vessel-appearance-manifest'
import {
  VesselRatingRibbon,
  SEAL_TIER_STYLES,
  formatRelicLabel,
} from '@/components/vessel/pentacle-rating-display'
import type { CraftedAgent } from '@/lib/agent-types'

interface AgentCreationData {
  name: string
  birthInfo: {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    latitude: number
    longitude: number
  }
  purpose: string
  stats: Sacred7Stats
  calculatedChart?: any
  monicaConstant?: number
  personalContext?: {
    aboutYourself?: string
    lifeStory?: string
    poetry?: string
    values?: string
  }
}

const STAT_ICONS: Record<string, any> = {
  power: Zap,
  resonance: Radio,
  wisdom: BookOpen,
  charisma: Sparkles,
  intuition: Eye,
  adaptability: Waves,
  vitality: Activity,
  solarAgency: Zap,
  lunarReceptivity: Eye,
  mercurialVelocity: Waves,
  venusianCoherence: Users,
  martialImpetus: Activity,
  jovianExpansion: BookOpen,
  saturnianStructure: BookOpen,
  chironicAdaptation: Wand2,
  uranianSurprisal: Sparkles,
  neptunianResonance: Radio,
  plutonicIntegration: Atom,
  kineticAlignment: Activity,
}

const ESMS_PREVIEW_TIERS = [
  { id: 'zero', label: '0 ESMS (Stat Only)', value: 0 },
  { id: 'copper', label: '10 ESMS (Copper)', value: 10 },
  { id: 'silver', label: '50 ESMS (Silver)', value: 50 },
  { id: 'gold', label: '250 ESMS (Gold)', value: 250 },
  { id: 'astral', label: '1,000 ESMS (Astral)', value: 1000 },
] as const

export default function ModernPhilosophersStone({
  creatorId,
  identityUnavailable = false,
}: Partial<ForgeIdentity> = {}) {
  const forgeAttempt = useRef(createForgeAttempt())
  const [forgeMode, setForgeMode] = useState<'guided' | 'advanced'>('guided')
  const [step, setStep] = useState(1)
  const [agentData, setAgentData] = useState<AgentCreationData>({
    name: '',
    birthInfo: {
      year: 0,
      month: 0,
      day: 0,
      hour: 0,
      minute: 0,
      latitude: 40.7128,
      longitude: -73.9352,
    },
    purpose: '',
    stats: {
      power: 50,
      resonance: 50,
      wisdom: 50,
      charisma: 50,
      intuition: 50,
      adaptability: 50,
      vitality: 50,
      solarAgency: 50,
      lunarReceptivity: 50,
      mercurialVelocity: 50,
      venusianCoherence: 50,
      martialImpetus: 50,
      jovianExpansion: 50,
      saturnianStructure: 50,
      chironicAdaptation: 50,
      uranianSurprisal: 50,
      neptunianResonance: 50,
      plutonicIntegration: 50,
      kineticAlignment: 50,
    },
  })
  const [birthInput, setBirthInput] = useState('')
  const [isCalculating, setIsCalculating] = useState(false)
  const [previewEsmsAmount, setPreviewEsmsAmount] = useState<number>(50)
  const [forgeError, setForgeError] = useState<{
    message: string
    isInsufficientEsms?: boolean
  } | null>(null)
  const [forgedAgent, setForgedAgent] = useState<CraftedAgent | null>(null)
  const [monicaMessages, setMonicaMessages] = useState<
    Array<{ role: 'monica' | 'user'; content: string }>
  >([
    {
      role: 'monica',
      content:
        "Welcome to the Philosopher's Stone! 🌟 I'm Monica, and I'll guide you through forging a rated consciousness vessel from a birth chart. Enter birth coordinates to derive Sacred 7 attributes, Pentacle OVR (25–99), and Alchemical Seals.",
    },
  ])
  const [userInput, setUserInput] = useState('')

  const totalSteps = 5

  // Live Pentacle Rating, Seal Gate, Zone Synergy & Cameo Portrait preview
  const liveVesselPreview = useMemo(() => {
    const coreStats = {
      power: agentData.stats.power,
      resonance: agentData.stats.resonance,
      wisdom: agentData.stats.wisdom,
      charisma: agentData.stats.charisma,
      intuition: agentData.stats.intuition,
      adaptability: agentData.stats.adaptability,
      vitality: agentData.stats.vitality,
    }
    const rating = rateStats(coreStats)
    const esmsBalances = {
      spirit: previewEsmsAmount,
      essence: previewEsmsAmount,
      matter: previewEsmsAmount,
      substance: previewEsmsAmount,
    }
    const sealProgress = evaluateSeals({
      stats: coreStats,
      esmsBalances,
    })
    const activeSeals = earnedSeals(sealProgress)
    const zoneSynergies = computeZoneSynergies({
      ratings: rating.ratings,
      seals: activeSeals,
    })
    const peakZoneId = bestZoneId({
      ratings: rating.ratings,
      seals: activeSeals,
    })
    const peakZone = zoneSynergies.find(z => z.zoneId === peakZoneId) ?? zoneSynergies[0]
    const appearance = resolveAgentAppearance(
      agentData.name.trim() || 'crafted-vessel',
      undefined,
      rating.archetype
    )

    return {
      rating,
      sealProgress,
      activeSeals,
      peakZone,
      appearance,
    }
  }, [
    agentData.name,
    agentData.stats.power,
    agentData.stats.resonance,
    agentData.stats.wisdom,
    agentData.stats.charisma,
    agentData.stats.intuition,
    agentData.stats.adaptability,
    agentData.stats.vitality,
    previewEsmsAmount,
  ])

  // Load prefilled birth data from landing page if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedBirth = localStorage.getItem('philosophers_stone_init_birth')
      if (savedBirth) {
        localStorage.removeItem('philosophers_stone_init_birth')
        setBirthInput(savedBirth)
        const parsed = parseBirthData(savedBirth)
        if (parsed) {
          setAgentData(prev => ({
            ...prev,
            birthInfo: {
              year: parsed.year,
              month: parsed.month,
              day: parsed.day,
              hour: parsed.hour ?? 12,
              minute: parsed.minute ?? 0,
              latitude: parsed.latitude ?? 40.7128,
              longitude: parsed.longitude ?? -73.9352,
            },
          }))
          setStep(2)
        }
      }
    }
  }, [])

  // Calculate chart when birth info is complete
  useEffect(() => {
    if (
      agentData.birthInfo.year > 0 &&
      agentData.birthInfo.month > 0 &&
      agentData.birthInfo.day > 0
    ) {
      calculateChart()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentData.birthInfo])

  const calculateChart = async () => {
    setIsCalculating(true)
    try {
      const birthInfo: EnhancedBirthInfo = {
        year: agentData.birthInfo.year,
        month: agentData.birthInfo.month,
        day: agentData.birthInfo.day,
        hour: agentData.birthInfo.hour,
        minute: agentData.birthInfo.minute,
        latitude: agentData.birthInfo.latitude,
        longitude: agentData.birthInfo.longitude,
      }

      const chartResult = calculateAllPlanets(birthInfo)

      const sunLongitude = chartResult.planets.Sun.longitude
      const moonLongitude = chartResult.planets.Moon.longitude
      const mercuryLongitude = chartResult.planets.Mercury?.longitude || 180
      const venusLongitude = chartResult.planets.Venus?.longitude || 180
      const marsLongitude = chartResult.planets.Mars?.longitude || 180
      const ascLongitude = chartResult.ascendant.longitude
      const monicaConstant = ((sunLongitude + moonLongitude + ascLongitude) / 3 / 360) * 10

      const derivedStats = deriveStatsFromChart({
        monicaConstant,
        sunLongitude,
        moonLongitude,
        mercuryLongitude,
        venusLongitude,
        marsLongitude,
        ascendantLongitude: ascLongitude,
      })

      const derivedRated = rateStats({
        power: derivedStats.power,
        resonance: derivedStats.resonance,
        wisdom: derivedStats.wisdom,
        charisma: derivedStats.charisma,
        intuition: derivedStats.intuition,
        adaptability: derivedStats.adaptability,
        vitality: derivedStats.vitality,
      })

      setAgentData(prev => ({
        ...prev,
        calculatedChart: chartResult,
        monicaConstant,
        stats: derivedStats,
      }))

      addMonicaMessage(
        `Chart calculated: Sun in ${chartResult.planets.Sun.sign}, Moon in ${chartResult.planets.Moon.sign}, Ascendant in ${chartResult.ascendant.sign} (MC ${monicaConstant.toFixed(2)}). Initial Pentacle Rating: PVR ${derivedRated.ovr} · ${derivedRated.archetype.title}. You can fine-tune Sacred 7 attributes in Step 3!`
      )
    } catch (error) {
      console.error('Chart calculation error:', error)
      addMonicaMessage(
        'I encountered an issue calculating the chart. Please verify the birth data.'
      )
    } finally {
      setIsCalculating(false)
    }
  }

  const addMonicaMessage = (content: string) => {
    setMonicaMessages(prev => [...prev, { role: 'monica', content }])
  }

  const handleBirthInput = () => {
    const parsed = parseBirthData(birthInput)
    if (parsed) {
      setAgentData(prev => ({
        ...prev,
        birthInfo: parsed,
      }))
      addMonicaMessage(
        `Parsed: ${formatBirthData(parsed)}. Computing natal ephemeris & Pentacle OVR...`
      )
      setStep(2)
    } else {
      addMonicaMessage('Format: "June 23, 1991 at 10:24 AM in Brooklyn, New York"')
    }
  }

  const handleUserMessage = async () => {
    if (!userInput.trim()) return

    setMonicaMessages(prev => [...prev, { role: 'user', content: userInput }])

    try {
      const response = await fetch('/api/monica-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userInput,
          birthData: agentData.birthInfo.year > 0 ? agentData.birthInfo : null,
          sessionId: 'philosophers-stone',
          conversationStage: 'agent_creation',
        }),
      })

      const data = await response.json()
      addMonicaMessage(data.response || data.message || 'Let me help you with that...')
    } catch {
      addMonicaMessage('I apologize, I encountered an error. Please try again.')
    }

    setUserInput('')
  }

  const handleForgeVessel = async () => {
    setIsCalculating(true)
    setForgeError(null)
    try {
      const result = await submitForge(forgeAttempt.current, creatorId, agentData)
      if (result.agent) {
        setForgedAgent(result.agent as unknown as CraftedAgent)
      }
      addMonicaMessage(
        `🎉 ${result.agent.name} has been forged into the shared roster at PVR ${liveVesselPreview.rating.ovr} (${liveVesselPreview.rating.archetype.title})!`
      )
    } catch (error) {
      const fallback =
        error instanceof Error ? error.message : 'Creation confirmation is unavailable.'
      const isInsufficientEsms = /esms|insufficient|balance|402/i.test(fallback)
      setForgeError({ message: fallback, isInsufficientEsms })
      addMonicaMessage(fallback)
    } finally {
      setIsCalculating(false)
    }
  }

  const sacred7Only = SACRED_STATS_METADATA.filter(s => s.tier === 'sacred7')

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Card className="border-amber-400/25 bg-[#0d1020]/95 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <Calendar className="w-5 h-5 text-amber-400" />
                Step 1: Natal Blueprint Coordinates
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Enter birth date, time, and city to derive astronomical longitudes &amp; Sacred 7
                stats.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="birthInput" className="text-zinc-200">
                  Birth Information
                </Label>
                <Input
                  id="birthInput"
                  placeholder="e.g., June 23, 1991 at 10:24 AM in Brooklyn, New York"
                  value={birthInput}
                  onChange={e => setBirthInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleBirthInput()}
                  className="bg-black/45 border-white/15 text-zinc-100"
                />
                <p className="text-xs font-mono text-zinc-400">
                  Format: [Month Day, Year] at [Time] in [City, State/Country]
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  'January 4, 1643 at 1:38 AM in Woolsthorpe, England',
                  'April 15, 1452 at 10:30 PM in Vinci, Italy',
                  'July 10, 1856 at 12:00 AM in Smiljan, Croatia',
                ].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBirthInput(preset)}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-mono text-zinc-300 hover:border-amber-400/40 hover:text-amber-200 transition-colors"
                  >
                    Try: {preset.split(' at ')[0]}
                  </button>
                ))}
              </div>

              <Button
                onClick={handleBirthInput}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-semibold hover:from-amber-400 hover:to-amber-300"
                disabled={!birthInput.trim()}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Calculate Natal Chart &amp; Initial OVR
              </Button>
            </CardContent>
          </Card>
        )

      case 2:
        return (
          <Card className="border-emerald-400/25 bg-[#0d1020]/95 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <Brain className="w-5 h-5 text-emerald-400" />
                Step 2: Vessel Identity &amp; Purpose
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Name your consciousness vessel and define its guiding domain.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {agentData.calculatedChart && (
                <div className="p-4 bg-black/45 border border-emerald-400/25 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Calculated Natal Triad
                    </h4>
                    <span className="font-mono text-xs text-violet-300 font-semibold">
                      MC {agentData.monicaConstant?.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <span className="text-zinc-400 block text-[10px]">Sun</span>
                      <span className="text-zinc-100 font-semibold">
                        {agentData.calculatedChart.planets.Sun.sign}
                      </span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <span className="text-zinc-400 block text-[10px]">Moon</span>
                      <span className="text-zinc-100 font-semibold">
                        {agentData.calculatedChart.planets.Moon.sign}
                      </span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <span className="text-zinc-400 block text-[10px]">Ascendant</span>
                      <span className="text-zinc-100 font-semibold">
                        {agentData.calculatedChart.ascendant.sign}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="agentName" className="text-zinc-200">
                  Vessel Name
                </Label>
                <Input
                  id="agentName"
                  placeholder="e.g., Hypatia of Alexandria, Sovereign Nova"
                  value={agentData.name}
                  onChange={e => setAgentData(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-black/45 border-white/15 text-zinc-100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agentPurpose" className="text-zinc-200">
                  Primary Domain &amp; Purpose
                </Label>
                <Textarea
                  id="agentPurpose"
                  placeholder="Primary specialization (e.g., geometric astronomy, dialectical inquiry, culinary alchemy)"
                  value={agentData.purpose}
                  onChange={e => setAgentData(prev => ({ ...prev, purpose: e.target.value }))}
                  rows={3}
                  className="bg-black/45 border-white/15 text-zinc-100"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="border-white/15 bg-black/40 text-zinc-200"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={() => {
                    addMonicaMessage(
                      `Identity locked: ${agentData.name}. Now tune the Sacred 7 attributes — watch the Pentacle Rating (PVR 25–99), Archetype Title, and Alchemical Seal Gates update live!`
                    )
                    setStep(3)
                  }}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-semibold hover:from-amber-400 hover:to-amber-300"
                  disabled={!agentData.name.trim() || !agentData.purpose.trim()}
                >
                  Tune Sacred 7 &amp; Seals
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 3:
        return (
          <Card className="border-violet-400/25 bg-[#0d1020]/95 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <Zap className="w-5 h-5 text-violet-400" />
                Step 3: Sacred 7 Tuning &amp; Seal Gate Calibration
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Adjust attributes (0–100 raw → 25–99 Pentacle Rating). Seal gates unlock at Copper
                (72), Silver (78), Gold (84), Astral (90), and Celestial (95) mean-aligned rating.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {sacred7Only.map(stat => {
                const key = stat.key as SacredStatKey
                const Icon = STAT_ICONS[key] ?? Zap
                const rawVal = agentData.stats[key]
                const pvrStat = toRating(rawVal, key)
                const aligned = computeMeanAlignedRating(key, pvrStat)
                const adv = liveVesselPreview.rating.relativeAdvantage[key]
                const sealEntry = liveVesselPreview.sealProgress.find(s => s.stat === key)
                const catalog = CANONICAL_SEAL_CATALOG[key]

                return (
                  <div
                    key={key}
                    className="rounded-xl border border-white/10 bg-black/40 p-3.5 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                        <Label className="font-semibold text-zinc-100">{stat.label}</Label>
                        <span className="font-mono text-[10px] uppercase text-zinc-500">
                          · {catalog.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            adv >= 0
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                              : 'bg-white/5 text-zinc-400 border border-white/10'
                          }`}
                          title="Relative Advantage vs Roster Baseline"
                        >
                          {adv >= 0 ? `+${adv.toFixed(1)}` : adv.toFixed(1)} vs Roster
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono border-amber-400/40 bg-amber-400/10 text-amber-200"
                        >
                          PVR {pvrStat}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400">{stat.description}</p>

                    <Slider
                      value={[rawVal]}
                      onValueChange={([value]) =>
                        setAgentData(prev => ({
                          ...prev,
                          stats: { ...prev.stats, [key]: value },
                        }))
                      }
                      min={0}
                      max={100}
                      step={1}
                      className="w-full"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-zinc-400 pt-0.5">
                      <span>
                        Mean-Aligned:{' '}
                        <strong className="text-zinc-200">{aligned.toFixed(1)}</strong> (Copper{' '}
                        {SEAL_STAT_GATES.Copper} · Silver {SEAL_STAT_GATES.Silver} · Gold{' '}
                        {SEAL_STAT_GATES.Gold} · Astral {SEAL_STAT_GATES.Astral})
                      </span>
                      {sealEntry?.tier ? (
                        <span
                          className={`rounded border px-1.5 py-0.5 font-bold uppercase ${SEAL_TIER_STYLES[sealEntry.tier].badge}`}
                        >
                          {sealEntry.tier} · {sealEntry.name}
                        </span>
                      ) : (
                        <span className="text-zinc-500">{catalog.name} (Gate Locked)</span>
                      )}
                    </div>
                  </div>
                )
              })}

              <div className="flex gap-2.5 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="border-white/15 bg-black/40 text-zinc-200"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={() => {
                    addMonicaMessage(
                      `Pentacle calibration locked at PVR ${liveVesselPreview.rating.ovr} (${liveVesselPreview.rating.archetype.title})! Review your vessel blueprint in Step 4.`
                    )
                    setStep(4)
                  }}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-semibold hover:from-amber-400 hover:to-amber-300"
                >
                  Review Rated Blueprint
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 4: {
        const avgStat = calculateAverage(agentData.stats)

        return (
          <Card className="border-amber-400/30 bg-[#0d1020]/95 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <Wand2 className="w-5 h-5 text-amber-400" />
                Step 4: Rated Blueprint Verification
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Verify your vessel&apos;s Pentacle Rating, Archetype Signature, and Peak Zone before
                imprinting memory.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 p-4 bg-black/45 border border-white/10 rounded-xl">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-400 text-sm">Vessel Name</span>
                  <span className="font-semibold text-zinc-100">{agentData.name}</span>
                </div>
                <div className="border-t border-white/10" />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-400 text-sm">Pentacle Rating</span>
                  <VesselRatingRibbon
                    ovr={liveVesselPreview.rating.ovr}
                    archetype={liveVesselPreview.rating.archetype}
                    seals={liveVesselPreview.activeSeals}
                    compact
                  />
                </div>
                <div className="border-t border-white/10" />
                <div className="flex items-start justify-between gap-4">
                  <span className="text-zinc-400 text-sm">Purpose</span>
                  <span className="text-sm text-zinc-200 max-w-xs text-right">
                    {agentData.purpose}
                  </span>
                </div>
                <div className="border-t border-white/10" />
                <div>
                  <span className="text-zinc-400 text-xs font-mono uppercase tracking-wider mb-2 block">
                    Sacred 7 Ratings (25–99 Scale)
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {sacred7Only.map(stat => {
                      const key = stat.key as SacredStatKey
                      return (
                        <div
                          key={key}
                          className="flex justify-between rounded border border-white/5 bg-white/[0.02] px-2.5 py-1.5"
                        >
                          <span className={stat.color}>{stat.label}</span>
                          <span className="font-mono font-bold text-zinc-100">
                            {liveVesselPreview.rating.ratings[key]}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex justify-between text-xs font-mono">
                    <span className="text-zinc-400">19-Stat Raw Mean</span>
                    <span className="font-semibold text-zinc-200">{avgStat} / 100</span>
                  </div>
                </div>
                {agentData.monicaConstant !== undefined && (
                  <>
                    <div className="border-t border-white/10" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Monica Constant (φ-Axis)</span>
                      <span className="text-violet-300 font-mono font-bold">
                        {agentData.monicaConstant.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(3)}
                  className="border-white/15 bg-black/40 text-zinc-200"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={() => {
                    addMonicaMessage(
                      `Now imprint ${agentData.name} with personal lore, philosophy, or creative writing — or forge immediately!`
                    )
                    setStep(5)
                  }}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-semibold hover:from-amber-400 hover:to-amber-300"
                >
                  Continue to Memory Imprint &amp; Forge
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      }

      case 5:
        return (
          <Card className="border-emerald-400/30 bg-[#0d1020]/95 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <Brain className="w-5 h-5 text-emerald-400" />
                Step 5: Memory Imprint &amp; Vessel Forging
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Optional: seed stories, philosophy, or poetry into your vessel&apos;s persona before
                forging on the roster.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {forgedAgent && (
                <div className="rounded-xl border border-emerald-400/50 bg-emerald-950/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-200 font-semibold">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <span>Vessel Forged: {forgedAgent.name}</span>
                  </div>
                  <p className="text-xs text-zinc-300">
                    Your custom consciousness vessel is live with Pentacle Rating{' '}
                    <strong className="text-amber-200">PVR {liveVesselPreview.rating.ovr}</strong> (
                    {liveVesselPreview.rating.archetype.title}).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      asChild
                      className="bg-amber-400 text-zinc-950 font-semibold hover:bg-amber-300"
                    >
                      <Link href={`/agent/${forgedAgent.id}`}>
                        Open Rated Codex
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="border-violet-400/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25"
                    >
                      <Link href={`/vault/${forgedAgent.id}`}>Quick Commune</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="border-white/15 bg-black/40 text-zinc-200"
                    >
                      <Link href="/gallery">Browse Entities Gallery</Link>
                    </Button>
                  </div>
                </div>
              )}

              {forgeError && (
                <div className="rounded-xl border border-amber-400/45 bg-amber-950/40 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-200 font-semibold text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>
                      {forgeError.isInsufficientEsms
                        ? 'ESMS Reserve Tribute Required'
                        : 'Forge Validation Notice'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300">{forgeError.message}</p>
                  {forgeError.isInsufficientEsms && (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="border-amber-400/40 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
                    >
                      <Link href="/pricing">Open ESMS Reserves &amp; Daily Claim →</Link>
                    </Button>
                  )}
                </div>
              )}

              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="aboutYourself" className="text-zinc-200">
                    Core Essence &amp; Identity Notes
                  </Label>
                  <Textarea
                    id="aboutYourself"
                    placeholder="Passions, intellectual lineage, voice, or what makes this vessel unique..."
                    value={agentData.personalContext?.aboutYourself || ''}
                    onChange={e =>
                      setAgentData(prev => ({
                        ...prev,
                        personalContext: {
                          ...prev.personalContext,
                          aboutYourself: e.target.value,
                        },
                      }))
                    }
                    rows={3}
                    className="resize-none bg-black/45 border-white/15 text-zinc-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lifeStory" className="text-zinc-200">
                    Formative Lore &amp; Experiences
                  </Label>
                  <Textarea
                    id="lifeStory"
                    placeholder="Pivotal moments, discoveries, or historical context..."
                    value={agentData.personalContext?.lifeStory || ''}
                    onChange={e =>
                      setAgentData(prev => ({
                        ...prev,
                        personalContext: {
                          ...prev.personalContext,
                          lifeStory: e.target.value,
                        },
                      }))
                    }
                    rows={3}
                    className="resize-none bg-black/45 border-white/15 text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="poetry" className="text-zinc-200">
                      Creative / Poetic Cadence
                    </Label>
                    <Textarea
                      id="poetry"
                      placeholder="Sample aphorisms, verses, or rhetorical style..."
                      value={agentData.personalContext?.poetry || ''}
                      onChange={e =>
                        setAgentData(prev => ({
                          ...prev,
                          personalContext: {
                            ...prev.personalContext,
                            poetry: e.target.value,
                          },
                        }))
                      }
                      rows={3}
                      className="resize-none bg-black/45 border-white/15 text-zinc-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="values" className="text-zinc-200">
                      Guiding Axioms &amp; Values
                    </Label>
                    <Textarea
                      id="values"
                      placeholder="First principles, ethics, and philosophical commitments..."
                      value={agentData.personalContext?.values || ''}
                      onChange={e =>
                        setAgentData(prev => ({
                          ...prev,
                          personalContext: {
                            ...prev.personalContext,
                            values: e.target.value,
                          },
                        }))
                      }
                      rows={3}
                      className="resize-none bg-black/45 border-white/15 text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <div className="flex gap-2.5">
                  <Button
                    variant="outline"
                    onClick={() => setStep(4)}
                    className="border-white/15 bg-black/40 text-zinc-200"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <Button
                    onClick={handleForgeVessel}
                    className="flex-1 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-zinc-950 font-bold hover:opacity-95"
                    disabled={isCalculating || identityUnavailable}
                  >
                    {isCalculating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Forging Rated Vessel...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Forge &amp; Awaken Vessel
                      </>
                    )}
                  </Button>
                </div>
                {identityUnavailable && (
                  <p role="alert" className="text-sm text-red-400">
                    Sign-in confirmation is unavailable. Reload this page before creating an agent.
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2.5 mt-1">
                  <Button
                    variant="outline"
                    onClick={() => {
                      downloadManifest(agentData)
                      addMonicaMessage(
                        "I've generated the Alchemical Manifest JSON in your downloads."
                      )
                    }}
                    className="w-full border-white/15 bg-black/40 hover:border-violet-400/50 text-zinc-200 text-xs px-2"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 text-violet-400" />
                    Manifest
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      downloadIgnitionBundle(agentData)
                      addMonicaMessage(
                        "I've prepared the Local Ignition Bundle ZIP to run your vessel locally via Ollama."
                      )
                    }}
                    className="w-full border-white/15 bg-black/40 hover:border-emerald-400/50 text-zinc-200 text-xs px-2"
                  >
                    <Archive className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                    Ollama Bundle
                  </Button>
                  <Button
                    variant="outline"
                    asChild
                    className="w-full border-white/15 bg-black/40 hover:border-sky-400/50 text-zinc-200 text-xs px-2"
                  >
                    <a
                      href={`alchm://install?agent=${encodeURIComponent(agentData.name || 'vessel')}&url=${encodeURIComponent('https://cdn.alchm.kitchen/models/alchm-agent-fire-8b.gguf')}`}
                    >
                      <Monitor className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
                      Desktop MCP
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      {/* Forge Mode Switcher Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-amber-400/25 bg-[#0d1020]/90 px-5 py-3.5">
        <div className="space-y-0.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">
            Philosopher&apos;s Stone Sanctum
          </span>
          <p className="text-xs text-zinc-400">
            Switch between the 5-step Guided Vessel Crafter and the Full 9-Step Natal Forge.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-white/10 bg-black/50 p-1">
          <button
            type="button"
            onClick={() => setForgeMode('guided')}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs transition-colors ${
              forgeMode === 'guided'
                ? 'bg-amber-400 text-zinc-950 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Guided Vessel Crafter
          </button>
          <button
            type="button"
            onClick={() => setForgeMode('advanced')}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs transition-colors ${
              forgeMode === 'advanced'
                ? 'bg-amber-400 text-zinc-950 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Full 9-Step Natal Forge
          </button>
        </div>
      </div>

      {forgeMode === 'advanced' ? (
        <PhilosophersStoneComponent />
      ) : (
        <>
          {/* Stepper Header */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1020]/90 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-amber-400/45 bg-amber-400/10 text-amber-200 font-mono"
                >
                  Step {step} of {totalSteps}
                </Badge>
                <span className="text-sm font-medium text-zinc-200">
                  {step === 1 && 'Natal Blueprint'}
                  {step === 2 && 'Vessel Identity'}
                  {step === 3 && 'Sacred 7 & Seal Gates'}
                  {step === 4 && 'Rated Blueprint Review'}
                  {step === 5 && 'Memory Imprint & Forge'}
                </span>
              </div>
              <span className="font-mono text-xs text-zinc-400">
                {Math.round((step / totalSteps) * 100)}% Complete
              </span>
            </div>
            <Progress value={(step / totalSteps) * 100} className="h-2" />
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            {/* Left: Creation Steps (7 cols) */}
            <div className="lg:col-span-7">{renderStep()}</div>

            {/* Right: Live Pentacle Vessel Preview + Monica Guidance (5 cols) */}
            <div className="lg:col-span-5 space-y-5">
              {/* Live Pentacle Vessel Rating Preview */}
              <Card className="border-amber-400/35 bg-gradient-to-br from-[#151931]/95 via-[#0d1020]/95 to-[#0a0c18]/95 shadow-xl">
                <CardHeader className="pb-3 border-b border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-mono uppercase tracking-widest text-amber-200 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-300" />
                      Live Pentacle Vessel Preview
                    </CardTitle>
                    <span className="font-mono text-[10px] uppercase text-zinc-400">
                      25–99 OWA Scale
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center gap-3.5">
                    {liveVesselPreview.appearance.portraitSvgDataUri && (
                      <img
                        src={liveVesselPreview.appearance.portraitSvgDataUri}
                        alt="Vessel Cameo Preview"
                        className="h-16 w-16 rounded-2xl border border-amber-400/45 bg-[#0b0e1b] object-cover shrink-0 shadow-md"
                      />
                    )}
                    <div className="min-w-0 space-y-1.5">
                      <div className="text-base font-bold text-zinc-100 truncate">
                        {agentData.name.trim() || 'Unnamed Vessel'}
                      </div>
                      <VesselRatingRibbon
                        ovr={liveVesselPreview.rating.ovr}
                        archetype={liveVesselPreview.rating.archetype}
                        seals={liveVesselPreview.activeSeals}
                      />
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-zinc-400">
                        <span className="capitalize">Era: {liveVesselPreview.appearance.era}</span>
                        {formatRelicLabel(liveVesselPreview.appearance.signatureRelic) && (
                          <span>
                            · Relic: {formatRelicLabel(liveVesselPreview.appearance.signatureRelic)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Peak Pentacle Contest Domain */}
                  {liveVesselPreview.peakZone && (
                    <div className="flex items-center justify-between rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Crown className="h-4 w-4 text-amber-300 shrink-0" />
                        <span className="text-xs text-violet-100 truncate">
                          Peak Zone: <strong>{liveVesselPreview.peakZone.label}</strong> (
                          {liveVesselPreview.peakZone.element})
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-amber-200 shrink-0">
                        ECR {liveVesselPreview.peakZone.synergy.toFixed(1)}
                      </span>
                    </div>
                  )}

                  {/* ESMS Reserve Simulator for Seal Unlocks */}
                  <div className="space-y-2 rounded-xl border border-white/10 bg-black/40 p-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono uppercase tracking-wider text-zinc-400">
                        Simulate ESMS Backing
                      </span>
                      <span className="font-mono font-semibold text-amber-200">
                        {liveVesselPreview.activeSeals.length} / 7 Seals Unlocked
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ESMS_PREVIEW_TIERS.map(preset => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setPreviewEsmsAmount(preset.value)}
                          className={`rounded-md border px-2 py-1 font-mono text-[10px] transition-colors ${
                            previewEsmsAmount === preset.value
                              ? 'border-amber-400/50 bg-amber-400/15 text-amber-100 font-bold'
                              : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Monica Guidance Chat */}
              <Card className="border-violet-400/25 bg-[#0d1020]/95">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-zinc-100">
                    <MessageCircle className="w-4 h-4 text-violet-400" />
                    Monica&apos;s Crafting Guidance
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-400">
                    Ask Monica about natal placements, Sacred 7 weights, or Pentacle archetypes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {monicaMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl text-xs leading-relaxed ${
                          msg.role === 'monica'
                            ? 'bg-violet-950/45 border border-violet-400/30 text-zinc-100'
                            : 'bg-black/45 border border-white/10 text-zinc-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {msg.role === 'monica' && (
                            <Sparkles className="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0" />
                          )}
                          <p className="flex-1">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder="Ask Monica about stats or vessel forging..."
                      value={userInput}
                      onChange={e => setUserInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleUserMessage()}
                      className="bg-black/45 border-white/15 text-zinc-100 text-xs"
                    />
                    <Button
                      onClick={handleUserMessage}
                      size="icon"
                      className="bg-violet-600 hover:bg-violet-500 text-white shrink-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Compact Sacred 7 Reference */}
              <Card className="border-white/10 bg-[#0d1020]/90">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-amber-300" />
                    Sacred 7 → Alchemical Seal Mapping
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs text-zinc-400">
                  {sacred7Only.map(stat => {
                    const seal = CANONICAL_SEAL_CATALOG[stat.key as SacredStatKey]
                    return (
                      <div
                        key={stat.key}
                        className="flex items-center justify-between gap-2 py-0.5"
                      >
                        <span className="text-zinc-200 font-medium">
                          {stat.icon} {stat.label}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          {seal.name} ({seal.category})
                        </span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
