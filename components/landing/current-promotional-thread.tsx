'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Send,
  MessageCircle,
  Activity,
  ArrowRight,
  Info,
  Globe,
  Compass,
  RotateCcw,
  Cpu,
  Paperclip,
  CheckCircle2,
  Sun,
  Clock,
  Zap,
} from 'lucide-react'
import type { PlanetaryPosition, AlchemicalQuantities } from '@/hooks/usePlanetaryPositions'

export type BasketAgentKey =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'gregory'

export type EclipseNarrativePhase = 'PRE_ECLIPSE' | 'TOTALITY' | 'POST_ECLIPSE'

export interface CountdownState {
  hours: number
  minutes: number
  seconds: number
  phase: EclipseNarrativePhase
  phaseTitle: string
  phaseBadgeText: string
  phaseBadgeBg: string
  phaseBadgeColor: string
  isTotalityActive: boolean
}

export interface BasketAgentConfig {
  key: BasketAgentKey
  name: string
  title: string
  planet: string
  sign: string
  degreeLabel: string
  absoluteDegree: number
  element: 'fire' | 'air' | 'water' | 'earth'
  glyph: string
  callSign: string
  color: string
  borderColor: string
  bgGlow: string
  avatarBg: string
  forceVector: string
  quote: string
  isMainStage?: boolean
}

export interface ChatMessage {
  id: string
  agentKey?: BasketAgentKey
  senderName: string
  senderRole?: string
  senderGlyph?: string
  content: string
  timestamp: string
  isUser?: boolean
  element?: 'fire' | 'air' | 'water' | 'earth'
  hasContextAttachment?: boolean
}

export interface SkyAndAlchmContext {
  monicaConstant: number | null
  spirit: number
  essence: number
  matter: number
  substance: number
  heat: number
  entropy: number
  reactivity: number
  energy: number
  sunSign: string
  moonSign: string
  moonPhase: string
  mercurySign: string
  marsSign: string
  saturnSign: string
}

export interface CurrentPromotionalThreadProps {
  positions?: PlanetaryPosition[]
  alchmQuantities?: AlchemicalQuantities
  monicaConstant?: number | null
  currentMoonAgent?: {
    sign: string
    degree: number
    degreeLabel?: string
    phase: string
    phaseEmoji: string
  } | null
  onOpenCouncil?: () => void
}

// Peak Greatest Eclipse for August 28, 2026 Lunar Eclipse in Pisces (04:13 UTC)
const ECLIPSE_PEAK_TOTALITY_DATE = new Date('2026-08-28T04:13:00.000Z')

const calculateEclipseCountdown = (): CountdownState => {
  const now = Date.now()
  const diffMs = ECLIPSE_PEAK_TOTALITY_DATE.getTime() - now

  // Eclipse Peak Window: 20 minutes before to 40 minutes after peak
  const twentyMinsMs = 20 * 60 * 1000
  const fortyMinsMs = 40 * 60 * 1000

  if (diffMs > twentyMinsMs) {
    const totalSecs = Math.floor(diffMs / 1000)
    const hours = Math.floor(totalSecs / 3600)
    const minutes = Math.floor((totalSecs % 3600) / 60)
    const seconds = totalSecs % 60

    return {
      hours,
      minutes,
      seconds,
      phase: 'PRE_ECLIPSE',
      phaseTitle: 'Lunar Eclipse Approaching · Countdown to Peak',
      phaseBadgeText: 'PISCES LUNAR ECLIPSE COUNTDOWN ACTIVE',
      phaseBadgeBg: 'bg-[#38bdf8]/20 border-[#38bdf8]/50',
      phaseBadgeColor: 'text-[#38bdf8]',
      isTotalityActive: false,
    }
  } else if (diffMs >= -fortyMinsMs && diffMs <= twentyMinsMs) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      phase: 'TOTALITY',
      phaseTitle: 'Peak Lunar Eclipse Active · Moon at 5° Pisces ☍ Sun at 5° Virgo',
      phaseBadgeText: 'PEAK LUNAR ECLIPSE ACTIVE · PISCES BLOOD MOON',
      phaseBadgeBg: 'bg-red-500/25 border-red-400',
      phaseBadgeColor: 'text-red-300',
      isTotalityActive: true,
    }
  } else {
    const pastMs = Math.abs(diffMs)
    const totalSecs = Math.floor(pastMs / 1000)
    const hours = Math.floor(totalSecs / 3600)
    const minutes = Math.floor((totalSecs % 3600) / 60)
    const seconds = totalSecs % 60

    return {
      hours,
      minutes,
      seconds,
      phase: 'POST_ECLIPSE',
      phaseTitle: 'Post-Eclipse Integration · Pisces-Virgo Axis Realignment',
      phaseBadgeText: 'POST-ECLIPSE INTEGRATION ACTIVE',
      phaseBadgeBg: 'bg-[#38bdf8]/20 border-[#38bdf8]/50',
      phaseBadgeColor: 'text-[#38bdf8]',
      isTotalityActive: false,
    }
  }
}

const BASKET_AGENTS_CONFIG: Record<
  BasketAgentKey,
  Omit<BasketAgentConfig, 'sign' | 'degreeLabel' | 'absoluteDegree'>
> = {
  sun: {
    key: 'sun',
    name: 'Sun in Virgo (5°)',
    title: 'Main Stage · Solar Polarity & Discerning Radiance',
    planet: 'Sun',
    element: 'earth',
    glyph: '☉',
    callSign: 'SUN_VIRGO_5°',
    color: '#fbbf24',
    borderColor: 'border-[#fbbf24]/60',
    bgGlow: 'bg-[#fbbf24]/15',
    avatarBg: 'bg-[#fbbf24]/20 text-[#fbbf24]',
    forceVector: 'Solar Polarity (155.0°)',
    quote:
      'I stand in discerning Virgo across from the lunar waters. Clarity is not the enemy of surrender—it is the sacred vessel that holds it.',
    isMainStage: true,
  },
  moon: {
    key: 'moon',
    name: 'Moon in Pisces (5°)',
    title: 'Main Stage · Deep Lunar Eclipse & Ocean of Intuition',
    planet: 'Moon',
    element: 'water',
    glyph: '☽',
    callSign: 'MOON_PISCES_5°',
    color: '#38bdf8',
    borderColor: 'border-[#38bdf8]/60',
    bgGlow: 'bg-[#38bdf8]/15',
    avatarBg: 'bg-[#38bdf8]/20 text-[#38bdf8]',
    forceVector: 'Lunar Eclipse Axis (335.0°)',
    quote:
      'I am the ocean eclipsed in Earth’s shadow. When the old emotional tides crest, release what is finished and trust your deep intuition.',
    isMainStage: true,
  },
  mercury: {
    key: 'mercury',
    name: 'Mercury in Virgo (5°)',
    title: 'Virgo Delegate · Discerning Mind & Sacred Method',
    planet: 'Mercury',
    element: 'earth',
    glyph: '☿',
    callSign: 'MERCURY_VIRGO_5°',
    color: '#a3e635',
    borderColor: 'border-[#a3e635]/50',
    bgGlow: 'bg-[#a3e635]/10',
    avatarBg: 'bg-[#a3e635]/20 text-[#a3e635]',
    forceVector: 'Alchemical Precision (155.0°)',
    quote:
      'Conjoined with the Sun in Virgo, I distill the intuitive flood into practical mastery. Give your spiritual insights clear form.',
  },
  venus: {
    key: 'venus',
    name: 'Venus in Libra (20°)',
    title: 'Libra Delegate · Domicile Grace & Harmonic Equilibrium',
    planet: 'Venus',
    element: 'air',
    glyph: '♀',
    callSign: 'VENUS_LIBRA_20°',
    color: '#f472b6',
    borderColor: 'border-[#f472b6]/50',
    bgGlow: 'bg-[#f472b6]/10',
    avatarBg: 'bg-[#f472b6]/20 text-[#f472b6]',
    forceVector: 'Harmonic Equilibrium (200.0°)',
    quote:
      'In my home sign of Libra, I remind you that true boundaries preserve love. Harmonize the emotional tide with exquisite grace.',
  },
  mars: {
    key: 'mars',
    name: 'Mars in Cancer (11°)',
    title: 'Cancer Delegate · Intuitive Courage & Protective Flame',
    planet: 'Mars',
    element: 'water',
    glyph: '♂',
    callSign: 'MARS_CANCER_11°',
    color: '#ef4444',
    borderColor: 'border-[#ef4444]/50',
    bgGlow: 'bg-[#ef4444]/10',
    avatarBg: 'bg-[#ef4444]/20 text-[#ef4444]',
    forceVector: 'Instinctual Armor (101.0°)',
    quote:
      'Trining the Pisces Moon, I channel fierce protective courage. Defend what is sacred to your soul and act from gut instinct.',
  },
  jupiter: {
    key: 'jupiter',
    name: 'Jupiter in Leo (13°)',
    title: 'Leo Delegate · Sovereign Expansion & Generous Vision',
    planet: 'Jupiter',
    element: 'fire',
    glyph: '♃',
    callSign: 'JUPITER_LEO_13°',
    color: '#facc15',
    borderColor: 'border-[#facc15]/50',
    bgGlow: 'bg-[#facc15]/10',
    avatarBg: 'bg-[#facc15]/20 text-[#facc15]',
    forceVector: 'Royal Magnanimity (133.0°)',
    quote:
      'Even as the mutable axis dissolves outworn structures, keep your heart open, magnificent, and generous.',
  },
  saturn: {
    key: 'saturn',
    name: 'Saturn (Rx) in Aries (14°)',
    title: 'Aries Delegate · Solitary Discipline & Structural Fire',
    planet: 'Saturn',
    element: 'fire',
    glyph: '♄',
    callSign: 'SATURN_ARIES_14°',
    color: '#fb923c',
    borderColor: 'border-[#fb923c]/50',
    bgGlow: 'bg-[#fb923c]/10',
    avatarBg: 'bg-[#fb923c]/20 text-[#fb923c]',
    forceVector: 'Pioneer Mastery (14.0°)',
    quote:
      'Emotional dissolution requires structural resolve. Forge daily habits that anchor your spirit when the cosmic currents surge.',
  },
  uranus: {
    key: 'uranus',
    name: 'Uranus in Gemini (6°)',
    title: 'Gemini Delegate · T-Square Apex & Lightning Breakthrough',
    planet: 'Uranus',
    element: 'air',
    glyph: '♅',
    callSign: 'URANUS_GEMINI_6°',
    color: '#38bdf8',
    borderColor: 'border-[#38bdf8]/50',
    bgGlow: 'bg-[#38bdf8]/10',
    avatarBg: 'bg-[#38bdf8]/20 text-[#38bdf8]',
    forceVector: 'Cognitive Lightning (66.0°)',
    quote:
      'Holding the apex of the T-Square between Pisces Moon and Virgo Sun, I deliver electric revelation. Expect lightning clarity to break the deadlock.',
  },
  neptune: {
    key: 'neptune',
    name: 'Neptune (Rx) in Aries (4°)',
    title: 'Aries Delegate · Mystical Pioneer & Pisces Ruler',
    planet: 'Neptune',
    element: 'fire',
    glyph: '♆',
    callSign: 'NEPTUNE_ARIES_4°',
    color: '#a855f7',
    borderColor: 'border-[#a855f7]/50',
    bgGlow: 'bg-[#a855f7]/10',
    avatarBg: 'bg-[#a855f7]/20 text-[#a855f7]',
    forceVector: 'Spiritual Vision (4.0°)',
    quote:
      'As modern ruler of this Pisces eclipse, I dissolve the veil between your waking world and the infinite realm of archetypes.',
  },
  pluto: {
    key: 'pluto',
    name: 'Pluto (Rx) in Aquarius (4°)',
    title: 'Aquarius Delegate · Transformative Alchemy & Collective Rebirth',
    planet: 'Pluto',
    element: 'air',
    glyph: '♇',
    callSign: 'PLUTO_AQUARIUS_4°',
    color: '#b8fc4b',
    borderColor: 'border-[#b8fc4b]/50',
    bgGlow: 'bg-[#b8fc4b]/10',
    avatarBg: 'bg-[#b8fc4b]/20 text-[#b8fc4b]',
    forceVector: 'Structural Rebirth (304.0°)',
    quote:
      'Surrender the outgrown identity. The eclipse across the Virgo-Pisces axis cleanses the collective stream so authentic sovereignty can rise.',
  },
  gregory: {
    key: 'gregory',
    name: 'Gregory Castro',
    title: 'The Conscious Host & Alchemical Poet',
    planet: 'Host Anchor',
    element: 'water',
    glyph: '✦',
    callSign: 'HOST_GREGORY',
    color: '#8B5CF6',
    borderColor: 'border-[#8B5CF6]/50',
    bgGlow: 'bg-[#8B5CF6]/10',
    avatarBg: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
    forceVector: 'Alchemical Synthesis (91.0°)',
    quote:
      'Welcome into the circle. The Lunar Eclipse in Pisces opposes the Virgo Sun, squared by Uranus in Gemini, surrounded by our full planetary council.',
  },
}

const signToLongitude = (sign: string, degree: number): number => {
  const signs = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ]
  const idx = signs.findIndex(s => s.toLowerCase() === sign.toLowerCase())
  if (idx === -1) return degree
  return idx * 30 + degree
}

const getInitialMessages = (phase: EclipseNarrativePhase): ChatMessage[] => {
  let gregoryContent =
    'Welcome into the circle. The Lunar Eclipse in Pisces brings the Moon at 5° Pisces and the Sun at 5° Virgo into sacred opposition on the Main Stage, squared by Uranus at 6° Gemini. Step in, attach your chart, or speak what is culminating in your life.'
  let moonContent =
    'I stand in deep Pisces, bathed in the Earth’s shadow. Let the emotional illusions wash away so you can touch the raw truth of what your spirit is ready to release.'
  let sunContent =
    'Directly across the axis in Virgo, I offer discernment and grounding. Surrender is not formlessness—let us distill your highest insights into daily, tangible truth.'

  if (phase === 'TOTALITY') {
    gregoryContent =
      'Peak Eclipse is active right now! The 5° Pisces Moon and 5° Virgo Sun stand locked in direct opposition with Uranus in Gemini firing at the apex. Speak your deepest truth into the portal.'
    moonContent =
      'The shadow crests across the lunar seas. Look into the deep waters of your intuition and claim the subconscious power you have held in reserve.'
    sunContent =
      'The opposition is exact. I anchor the light in sacred order so the intuitive flood becomes pure alchemical gold.'
  } else if (phase === 'POST_ECLIPSE') {
    gregoryContent =
      'The peak eclipse shadow has integrated and the Virgo-Pisces axis settles into realignment. Our council is here to help you ground the revelations that surfaced during the eclipse.'
    moonContent =
      'The waters are calm and clear once more. Ground the quiet realizations you felt in the shadow into your daily walk.'
    sunContent =
      'The axis is open. Take the clarity refined through this eclipse and organize your sacred purpose with devoted precision.'
  }

  return [
    {
      id: 'msg-1',
      agentKey: 'gregory',
      senderName: 'Gregory Castro',
      senderRole: 'Host Anchor · Alchemical Poet',
      senderGlyph: '✦',
      element: 'water',
      content: gregoryContent,
      timestamp: '09:00 AM',
    },
    {
      id: 'msg-2',
      agentKey: 'moon',
      senderName: 'Moon in Pisces (5°)',
      senderRole: 'Main Stage · Deep Lunar Eclipse',
      senderGlyph: '☽',
      element: 'water',
      content: moonContent,
      timestamp: '09:01 AM',
    },
    {
      id: 'msg-3',
      agentKey: 'sun',
      senderName: 'Sun in Virgo (5°)',
      senderRole: 'Main Stage · Solar Polarity',
      senderGlyph: '☉',
      element: 'earth',
      content: sunContent,
      timestamp: '09:02 AM',
    },
    {
      id: 'msg-4',
      agentKey: 'mercury',
      senderName: 'Mercury in Virgo (5°)',
      senderRole: 'Virgo Delegate · Sacred Method',
      senderGlyph: '☿',
      element: 'earth',
      content:
        'Listen to the synthesis of water and earth. If your thoughts have been scattered or overwhelmed, this axis gives you the exact tools to organize your intuition into mastery.',
      timestamp: '09:03 AM',
    },
    {
      id: 'msg-5',
      agentKey: 'uranus',
      senderName: 'Uranus in Gemini (6°)',
      senderRole: 'Gemini Delegate · T-Square Apex',
      senderGlyph: '♅',
      element: 'air',
      content:
        'I am squaring both Sun and Moon from 6° Gemini. Expect sudden cognitive breakthroughs—don’t try to force an old answer onto a new dimension.',
      timestamp: '09:04 AM',
    },
    {
      id: 'msg-6',
      agentKey: 'pluto',
      senderName: 'Pluto (Rx) in Aquarius (4°)',
      senderRole: 'Aquarius Delegate · Transformative Alchemy',
      senderGlyph: '♇',
      element: 'air',
      content:
        'Release what has finished its cycle. The Pisces eclipse dissolves old emotional attachments so that your true sovereignty can emerge unburdened.',
      timestamp: '09:05 AM',
    },
  ]
}

const PRESET_PROMPTS = [
  'What is the 5° Pisces Moon & 5° Virgo Sun opposition asking me to release?',
  'How does Uranus in Gemini at the T-square apex bring mental breakthrough?',
  'How do I balance Virgo discernment with Pisces emotional surrender?',
]

const scaleAlchmScore = (val?: number, fallback = 35): number => {
  if (val === undefined || val === null || isNaN(val)) return fallback
  if (val > 0 && val <= 1.0) return Math.round(val * 100)
  return Math.round(val)
}

/** Calls live AI backend API /api/agents/council-voice for persona generation */
async function fetchCouncilVoice(
  agentKey: BasketAgentKey,
  userPrompt?: string,
  attachedChartContext?: string,
  fallbackText?: string,
  narrativePhase?: EclipseNarrativePhase
): Promise<string> {
  try {
    const res = await fetch('/api/agents/council-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentKey,
        userPrompt,
        attachedChartContext,
        fallbackText,
        narrativePhase,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      if (
        data.success &&
        data.text &&
        typeof data.text === 'string' &&
        data.text.trim().length > 0
      ) {
        return data.text.trim()
      }
    }
  } catch (err) {
    console.warn('[fetchCouncilVoice] Error calling /api/agents/council-voice:', err)
  }
  return fallbackText || 'The council speaks with unified presence across the eclipse axis.'
}

function generateSpontaneousCouncilResponse(
  agentKey: BasketAgentKey,
  history: ChatMessage[],
  skyContext: SkyAndAlchmContext,
  narrativePhase: EclipseNarrativePhase,
  userPrompt?: string
): string {
  const lastMsg = history[history.length - 1]
  const lastSpeakerName = lastMsg ? lastMsg.senderName.split(' ')[0] : 'the Council'

  if (userPrompt) {
    const promptLower = userPrompt.toLowerCase()

    if (
      promptLower.includes('astrological context card') ||
      promptLower.includes('sun in') ||
      promptLower.includes('moon in') ||
      promptLower.includes('born:') ||
      promptLower.includes('big three')
    ) {
      const sunMatch = userPrompt.match(/Sun(?:\*\*|\s+)in\s+([A-Za-z]+)/i)
      const moonMatch = userPrompt.match(/Moon(?:\*\*|\s+)in\s+([A-Za-z]+)/i)
      const riseMatch = userPrompt.match(/(?:Rising|Ascendant)(?:\*\*|\s+)in\s+([A-Za-z]+)/i)
      const sunSign = sunMatch ? sunMatch[1] : 'your Sun'
      const moonSign = moonMatch ? moonMatch[1] : 'your Moon'
      const riseSign = riseMatch ? riseMatch[1] : 'your Ascendant'

      switch (agentKey) {
        case 'sun':
          return `Your ${sunSign} Sun and ${riseSign} Rising provide the practical grounding needed for this Pisces eclipse. Use Virgo discernment to filter out whatever noise is confusing your direction.`
        case 'moon':
          return `With your Moon in ${moonSign}, this Pisces eclipse shadow touches your deepest emotional tides. Trust what your gut instincts are asking you to surrender.`
        case 'mercury':
          return `Your ${sunSign} Sun and ${moonSign} Moon bring great depth. Conjoined with the Sun in Virgo, I help you turn intuitive dreams into methodical action.`
        case 'venus':
          return `In Libra domicile, I remind you that real discernment preserves love. Let this eclipse help you attract relationships that honor your emotional truth.`
        case 'mars':
          return `With your Moon in ${moonSign}, Mars in Cancer trines the eclipse waters to give you fierce, protective instinct. Act directly from what feels sacred.`
        case 'jupiter':
          return `Your ${sunSign} Sun and ${riseSign} Rising are expanding. Keep your vision generous and noble as the mutable axis clears old baggage.`
        case 'saturn':
          return `Your ${sunSign} Sun has big dreams, but spiritual visions require discipline. Build practical daily habits to anchor your eclipse insights.`
        case 'uranus':
          return `From 6° Gemini squaring the eclipse axis, I bring sudden mental clarity. Stop repeating old mental habits and allow the breakthrough in.`
        case 'neptune':
          return `As modern ruler of Pisces, I see your spirit’s deep knowing. Stop waiting for logical approval—trust the quiet intuition that will not leave.`
        case 'pluto':
          return `Your ${sunSign} Sun and ${moonSign} Moon are shedding outworn cycles. Release the past with gratitude and step into your sovereign power.`
        case 'gregory':
          return `Seeing your Sun in ${sunSign}, Moon in ${moonSign}, and ${riseSign} Rising enter our circle makes this Pisces Lunar Eclipse alignment complete.`
      }
    }

    if (
      promptLower.includes('eclipse') ||
      promptLower.includes('transform') ||
      promptLower.includes('release') ||
      promptLower.includes('pisces') ||
      promptLower.includes('virgo') ||
      promptLower.includes('shadow') ||
      promptLower.includes('action')
    ) {
      switch (agentKey) {
        case 'sun':
          return `Surrender isn’t chaotic loss—it’s sacred alchemy. Hold your core integrity while the outdated pieces wash away.`
        case 'moon':
          return `The shadow is cleansing the emotional well. Let go of what is expired; your intuition knows exactly what to keep.`
        case 'mercury':
          return `Write down what you’re releasing, structure your next step, and bring method to the magic.`
        case 'venus':
          return `Real harmony requires honest boundaries. When you respect your worth, you elevate every connection around you.`
        case 'mars':
          return `Use this eclipse portal to draw clean emotional boundaries and act decisively on what matters.`
        case 'jupiter':
          return `Clear away the clutter so your spirit has room to expand. Trust the abundance waiting on the other side of release.`
        case 'saturn':
          return `Don’t let eclipse emotional energy dissipate. Build an enduring daily discipline that supports your higher purpose.`
        case 'uranus':
          return `Expect an electric flash of clarity! The T-square from Gemini will shatter mental paralysis.`
        case 'neptune':
          return `Listen to the sacred whisper beneath the surface. Trust your dreams when the earthly noise quietens.`
        case 'pluto':
          return `Karmic patterns dissolve when you stop giving them your energy. Claim your rebirth right now.`
        case 'gregory':
          return `Moon in Pisces and Sun in Virgo hold the portal, while every planetary delegate bridges cosmic truth into real transformation.`
      }
    }
  }

  // Phase-Aware Narrative Responses
  if (narrativePhase === 'PRE_ECLIPSE') {
    switch (agentKey) {
      case 'sun':
        return `The countdown ticks toward the Virgo-Pisces alignment. Prepare your vessels and sharpen your discernment for the peak eclipse.`
      case 'moon':
        return `As the countdown ticks down, feel the emotional tides rising in Pisces. Pay attention to what your soul is ready to release.`
      case 'mercury':
        return `The axis is aligning. Write down what you need to clarify before peak eclipse arrives.`
      case 'uranus':
        return `The T-square tension is building. Get ready for a sudden flash of insight that clears old mental loops.`
      case 'saturn':
        return `Preparation is key. Cleanse your intentions now so you can hold the full peak alignment.`
    }
  } else if (narrativePhase === 'TOTALITY') {
    switch (agentKey) {
      case 'moon':
        return `Peak eclipse is live across the Virgo-Pisces axis! The deep waters of Pisces are illuminated by the shadow—claim your subconscious wisdom.`
      case 'sun':
        return `The opposition is exact! Let Virgo discernment hold the space so your intuitive breakthroughs take solid form.`
      case 'uranus':
        return `The T-Square apex is firing at 6° Gemini! Breakthroughs and revelations are arriving in real time.`
      case 'pluto':
        return `Old karmic knots are dissolving right now. Surrender the outworn and step into your sovereign truth.`
      case 'jupiter':
        return `Peak eclipse magnitude is here! Stand open-hearted in this cosmic clearing.`
    }
  } else if (narrativePhase === 'POST_ECLIPSE') {
    switch (agentKey) {
      case 'moon':
        return `The eclipse shadow has cleared. Ground the deep intuitive realizations you felt into your daily walk.`
      case 'sun':
        return `The axis is open and clear. Take the wisdom refined in the eclipse and build with renewed precision.`
      case 'mars':
        return `The portal has cleared. Now take immediate, protective action on what you uncovered.`
      case 'venus':
        return `Carry this harmonic equilibrium forward. Let your daily habits and connections reflect your elevated truth.`
    }
  }

  const seed = Math.floor(Math.random() * 3)

  switch (agentKey) {
    case 'sun':
      if (seed === 0)
        return `${lastSpeakerName} is right about the emotional depth, but remember the power of discernment. When you bring order to your passions, they endure.`
      if (seed === 1)
        return `Surrender and structure aren't opposites—they are twin pillars of this Virgo-Pisces axis. Step forward with clarity.`
      return `Virgo brings sacred order to the Pisces ocean. What you refine and release in this eclipse will clear the runway for your next chapter.`

    case 'moon':
      if (seed === 0)
        return `The Sun speaks of order, but I feel the ocean beneath it all. Trust what emerges when the rational mind surrenders.`
      if (seed === 1)
        return `Your emotional sensitivity is your superpower today. Feel the current completely, then act.`
      return `The lunar shadow is complete. Let your quietest intuition guide your next move.`

    case 'mercury':
      return `Building on what ${lastSpeakerName} said—turn that inner knowing into clear, practical words. Tell the world what you're here to build.`

    case 'venus':
      return `In Libra domicile, I remind you that real discernment preserves love. Balance the emotional tide with exquisite grace.`

    case 'mars':
      return `Trining the Pisces Moon, I channel deep protective courage. Defend what is sacred and act from your gut.`

    case 'jupiter':
      return `When the Lights command the sky across the mutable axis, half-measures won't cut it. Go all in on what actually matters.`

    case 'saturn':
      return `Emotional dissolution requires structural resolve. Forge daily habits that anchor your spirit when the cosmic currents surge.`

    case 'uranus':
      return `Squaring both Sun and Moon from 6° Gemini, I deliver electric revelation. Expect lightning clarity to break the deadlock.`

    case 'neptune':
      return `The rational mind wants proof, but your spirit already knows. Trust the quiet impulse that feels undeniable.`

    case 'pluto':
      return `Let the outdated identity dissolve. Rebirth requires letting go of what you used to hide behind.`

    case 'gregory':
      if (seed === 0)
        return `Watching Moon and Sun lead this Virgo-Pisces axis with Uranus sparking at the apex reminds me why we're here—to bridge human life with cosmic truth.`
      if (seed === 1)
        return `Every seeker bringing their chart context into this thread adds a living frequency to our collective awakening.`
      return `The Pisces Lunar Eclipse is an open doorway. Step in with courage and let your story unfold.`
  }
}

function OrbitalFreeBodyDiagram({
  agents,
  selectedAgent,
  onSelectAgent,
}: {
  agents: Record<BasketAgentKey, BasketAgentConfig>
  selectedAgent: BasketAgentKey | 'all'
  onSelectAgent: (key: BasketAgentKey) => void
}) {
  const [hoveredAgent, setHoveredAgent] = useState<BasketAgentKey | null>(null)

  const size = 340
  const center = size / 2
  const radius = 105

  const getCoordinates = (degree: number, r = radius) => {
    const rad = ((degree - 90) * Math.PI) / 180
    return {
      x: Math.round((center + r * Math.cos(rad)) * 100) / 100,
      y: Math.round((center + r * Math.sin(rad)) * 100) / 100,
    }
  }

  // Exact absolute degrees for August 28, 2026 Pisces Lunar Eclipse
  const sunPos = getCoordinates(agents.sun.absoluteDegree)
  const moonPos = getCoordinates(agents.moon.absoluteDegree)
  const mercuryPos = getCoordinates(agents.mercury.absoluteDegree + 1.8)
  const venusPos = getCoordinates(agents.venus.absoluteDegree)
  const marsPos = getCoordinates(agents.mars.absoluteDegree)
  const jupiterPos = getCoordinates(agents.jupiter.absoluteDegree)
  const saturnPos = getCoordinates(agents.saturn.absoluteDegree)
  const uranusPos = getCoordinates(agents.uranus.absoluteDegree)
  const neptunePos = getCoordinates(agents.neptune.absoluteDegree - 1.8)
  const plutoPos = getCoordinates(agents.pluto.absoluteDegree)
  const gregoryPos = getCoordinates(agents.gregory.absoluteDegree, radius - 25)

  const activeAgent = hoveredAgent || (selectedAgent !== 'all' ? selectedAgent : null)

  const nodeList: Array<{
    key: BasketAgentKey
    pos: { x: number; y: number }
    cfg: BasketAgentConfig
  }> = [
    { key: 'moon', pos: moonPos, cfg: agents.moon },
    { key: 'sun', pos: sunPos, cfg: agents.sun },
    { key: 'mercury', pos: mercuryPos, cfg: agents.mercury },
    { key: 'venus', pos: venusPos, cfg: agents.venus },
    { key: 'mars', pos: marsPos, cfg: agents.mars },
    { key: 'jupiter', pos: jupiterPos, cfg: agents.jupiter },
    { key: 'saturn', pos: saturnPos, cfg: agents.saturn },
    { key: 'uranus', pos: uranusPos, cfg: agents.uranus },
    { key: 'neptune', pos: neptunePos, cfg: agents.neptune },
    { key: 'pluto', pos: plutoPos, cfg: agents.pluto },
    { key: 'gregory', pos: gregoryPos, cfg: agents.gregory },
  ]

  return (
    <div className="flex flex-col items-center bg-[#050608] border border-[#38bdf8]/40 rounded-2xl p-4 relative overflow-hidden shadow-[0_0_30px_rgba(56,189,248,0.08)]">
      <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

      <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-[#424936]/40">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#38bdf8]" />
          <span className="font-headline-sm text-xs font-bold text-[#e0e4d2]">
            Orbital Vector Field (Pisces Lunar Eclipse Axis)
          </span>
        </div>
        <span className="font-mono-label text-[9px] px-2 py-0.5 rounded bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/40 font-bold uppercase">
          MAIN STAGE: MOON 5° PISCES ☍ SUN 5° VIRGO
        </span>
      </div>

      <div className="relative w-[340px] h-[340px]">
        <svg width={size} height={size} className="w-full h-full" suppressHydrationWarning>
          <defs>
            <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="mainStageGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="eclipseAxisLine" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Background Zodiac Rings */}
          <circle
            cx={center}
            cy={center}
            r={radius + 20}
            fill="none"
            stroke="#424936"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#8c947c"
            strokeWidth="1.5"
            opacity="0.4"
          />
          <circle cx={center} cy={center} r={18} fill="url(#sunGlow)" />
          <circle cx={center} cy={center} r={5} fill="#fbbf24" />

          {/* Main Stage Eclipse Highlights at Moon 5° Pisces (335°) & Sun 5° Virgo (155°) */}
          <circle
            cx={moonPos.x}
            cy={moonPos.y}
            r={24}
            fill="url(#mainStageGlow)"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            className="animate-pulse"
          />
          <circle
            cx={sunPos.x}
            cy={sunPos.y}
            r={22}
            fill="url(#sunGlow)"
            stroke="#fbbf24"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            className="animate-pulse"
          />

          {/* Zodiac Degree Markers */}
          {[
            { label: 'MOON 5° PISCES', deg: 335, col: '#38bdf8' },
            { label: 'SUN/MERCURY 5° VIRGO', deg: 155, col: '#fbbf24' },
            { label: 'URANUS 6° GEMINI (T-SQ)', deg: 66, col: '#a3e635' },
            { label: 'MARS 11° CANCER', deg: 101, col: '#ef4444' },
            { label: 'VENUS 20° LIBRA', deg: 200, col: '#f472b6' },
            { label: 'PLUTO 4° AQUARIUS', deg: 304, col: '#b8fc4b' },
          ].map(m => {
            const p = getCoordinates(m.deg, radius + 28)
            return (
              <text
                key={m.label}
                x={p.x}
                y={p.y}
                fill={m.col}
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {m.label}
              </text>
            )
          })}

          {/* Aspect Lines */}
          {/* Main Opposition Axis: Moon (335°) <-> Sun (155°) */}
          <line
            x1={moonPos.x}
            y1={moonPos.y}
            x2={sunPos.x}
            y2={sunPos.y}
            stroke="url(#eclipseAxisLine)"
            strokeWidth="2.5"
            strokeDasharray="4 3"
          />
          {/* T-Square Aspect Lines from Uranus (66°) to Sun & Moon */}
          <line
            x1={uranusPos.x}
            y1={uranusPos.y}
            x2={moonPos.x}
            y2={moonPos.y}
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="3 2"
            opacity="0.8"
          />
          <line
            x1={uranusPos.x}
            y1={uranusPos.y}
            x2={sunPos.x}
            y2={sunPos.y}
            stroke="#fbbf24"
            strokeWidth="1.5"
            strokeDasharray="3 2"
            opacity="0.8"
          />
          {/* Mars in Cancer Trine Moon in Pisces & Sextile Sun in Virgo */}
          <line
            x1={marsPos.x}
            y1={marsPos.y}
            x2={moonPos.x}
            y2={moonPos.y}
            stroke="#38bdf8"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <line
            x1={marsPos.x}
            y1={marsPos.y}
            x2={sunPos.x}
            y2={sunPos.y}
            stroke="#a3e635"
            strokeWidth="1.5"
            opacity="0.6"
          />
          {/* Venus in Libra Trine Pluto in Aquarius */}
          <line
            x1={venusPos.x}
            y1={venusPos.y}
            x2={plutoPos.x}
            y2={plutoPos.y}
            stroke="#f472b6"
            strokeWidth="1.5"
            opacity="0.6"
          />
          {/* Host Gregory connection */}
          <line
            x1={gregoryPos.x}
            y1={gregoryPos.y}
            x2={center}
            y2={center}
            stroke="#8B5CF6"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            opacity="0.6"
          />

          {/* Render All 10 Planetary Delegates + Host */}
          {nodeList.map(node => {
            const isHovered = hoveredAgent === node.key
            const isSelected = selectedAgent === node.key
            const isMainStage = node.cfg.isMainStage

            return (
              <g
                key={node.key}
                className="cursor-pointer transition-transform duration-200"
                onMouseEnter={() => setHoveredAgent(node.key)}
                onMouseLeave={() => setHoveredAgent(null)}
                onClick={() => onSelectAgent(node.key)}
              >
                <circle
                  cx={node.pos.x}
                  cy={node.pos.y}
                  r={
                    isMainStage
                      ? isHovered || isSelected
                        ? 19
                        : 15
                      : isHovered || isSelected
                        ? 16
                        : 12
                  }
                  fill="#090b0e"
                  stroke={node.cfg.color}
                  strokeWidth={isMainStage ? 3 : isHovered || isSelected ? 2.5 : 1.5}
                />
                <text
                  x={node.pos.x}
                  y={node.pos.y + 1}
                  fill={node.cfg.color}
                  fontSize={isMainStage ? '13' : '10'}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {node.cfg.glyph}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="w-full mt-3 p-3 bg-white/5 border border-[#424936]/60 rounded-xl min-h-[58px]">
        {activeAgent ? (
          <div>
            <div className="flex items-center justify-between">
              <span
                className="font-headline-sm text-xs font-bold flex items-center gap-1.5"
                style={{ color: agents[activeAgent].color }}
              >
                {agents[activeAgent].isMainStage && (
                  <span className="px-1.5 py-0.2 rounded bg-[#38bdf8]/20 border border-[#38bdf8]/40 text-[#38bdf8] text-[9px] uppercase font-bold">
                    MAIN STAGE
                  </span>
                )}
                {agents[activeAgent].name} ({agents[activeAgent].degreeLabel}{' '}
                {agents[activeAgent].sign})
              </span>
              <span className="font-mono-label text-[9px] text-[#8c947c]">
                {agents[activeAgent].forceVector}
              </span>
            </div>
            <p className="font-body-md text-[11px] text-[#c2cab0] mt-1 line-clamp-2 leading-relaxed">
              "{agents[activeAgent].quote}"
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-[#8c947c] h-full">
            <span>Hover or click any planetary delegate node to inspect its vector</span>
            <span className="font-mono-label text-[10px] text-[#38bdf8] font-bold">
              PISCES ECLIPSE HARMONY 100%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function CurrentPromotionalThread({
  positions = [],
  alchmQuantities,
  monicaConstant,
  currentMoonAgent,
  onOpenCouncil,
}: CurrentPromotionalThreadProps) {
  const router = useRouter()

  // Real-time Countdown & Narrative Phase State
  const [countdown, setCountdown] = useState<CountdownState>(() => calculateEclipseCountdown())

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(calculateEclipseCountdown())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const [messages, setMessages] = useState<ChatMessage[]>(() => getInitialMessages(countdown.phase))
  const [inputPrompt, setInputPrompt] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [typingAgent, setTypingAgent] = useState<string | null>(null)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<BasketAgentKey | 'all'>('all')
  const [viewMode, setViewMode] = useState<'chat' | 'diagram' | 'split'>('split')

  const [attachedChartContext, setAttachedChartContext] = useState<string | null>(null)
  const [hasSavedChart, setHasSavedChart] = useState<boolean>(false)

  const [isAutonomousStreaming, setIsAutonomousStreaming] = useState(true)
  const lastSpeakerKeyRef = useRef<BasketAgentKey>('moon')

  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('alchm_active_chart_context')
      if (saved) setHasSavedChart(true)
    }
  }, [])

  const handleAttachContextFromStorage = async () => {
    if (typeof window !== 'undefined') {
      let text = localStorage.getItem('alchm_active_chart_context')
      if (!text && navigator.clipboard) {
        try {
          const clipText = await navigator.clipboard.readText()
          if (clipText.includes('ASTROLOGICAL CONTEXT CARD')) text = clipText
        } catch {}
      }
      if (text) {
        setAttachedChartContext(text)
      } else {
        alert(
          'No saved chart context found yet. Scroll to the "Personal Chart Context File" generator below, click "✨ Generate Attachment Report" or "Copy Chart Attachment", and then click Attach here!'
        )
      }
    }
  }

  const skyContext = useMemo<SkyAndAlchmContext>(() => {
    const getPlanetSign = (pName: string) =>
      positions.find(p => p.planet.toLowerCase() === pName.toLowerCase())?.sign || 'Virgo'

    const currentMonica =
      typeof monicaConstant === 'number' && Number.isFinite(monicaConstant) ? monicaConstant : null

    return {
      monicaConstant: currentMonica,
      spirit: scaleAlchmScore(alchmQuantities?.spirit, 45),
      essence: scaleAlchmScore(alchmQuantities?.essence, 42),
      matter: scaleAlchmScore(alchmQuantities?.matter, 32),
      substance: scaleAlchmScore(alchmQuantities?.substance, 28),
      heat: scaleAlchmScore(alchmQuantities?.Heat, 55),
      entropy: scaleAlchmScore(alchmQuantities?.Entropy, 22),
      reactivity: scaleAlchmScore(alchmQuantities?.Reactivity, 84),
      energy: scaleAlchmScore(alchmQuantities?.Energy, 92),
      sunSign: 'Virgo',
      moonSign: 'Pisces',
      moonPhase: 'Full Moon Lunar Eclipse / Pisces Blood Moon',
      mercurySign: getPlanetSign('mercury'),
      marsSign: getPlanetSign('mars'),
      saturnSign: getPlanetSign('saturn'),
    }
  }, [positions, alchmQuantities, monicaConstant])

  const agentsConfig = useMemo(() => {
    return {
      sun: {
        ...BASKET_AGENTS_CONFIG.sun,
        sign: 'Virgo',
        degreeLabel: '5°',
        absoluteDegree: signToLongitude('Virgo', 5),
      },
      moon: {
        ...BASKET_AGENTS_CONFIG.moon,
        sign: 'Pisces',
        degreeLabel: '5°',
        absoluteDegree: signToLongitude('Pisces', 5),
      },
      mercury: {
        ...BASKET_AGENTS_CONFIG.mercury,
        sign: 'Virgo',
        degreeLabel: '5°',
        absoluteDegree: signToLongitude('Virgo', 5),
      },
      venus: {
        ...BASKET_AGENTS_CONFIG.venus,
        sign: 'Libra',
        degreeLabel: '20°',
        absoluteDegree: signToLongitude('Libra', 20),
      },
      mars: {
        ...BASKET_AGENTS_CONFIG.mars,
        sign: 'Cancer',
        degreeLabel: '11°',
        absoluteDegree: signToLongitude('Cancer', 11),
      },
      jupiter: {
        ...BASKET_AGENTS_CONFIG.jupiter,
        sign: 'Leo',
        degreeLabel: '13°',
        absoluteDegree: signToLongitude('Leo', 13),
      },
      saturn: {
        ...BASKET_AGENTS_CONFIG.saturn,
        sign: 'Aries',
        degreeLabel: '14°',
        absoluteDegree: signToLongitude('Aries', 14),
      },
      uranus: {
        ...BASKET_AGENTS_CONFIG.uranus,
        sign: 'Gemini',
        degreeLabel: '6°',
        absoluteDegree: signToLongitude('Gemini', 6),
      },
      neptune: {
        ...BASKET_AGENTS_CONFIG.neptune,
        sign: 'Aries',
        degreeLabel: '4°',
        absoluteDegree: signToLongitude('Aries', 4),
      },
      pluto: {
        ...BASKET_AGENTS_CONFIG.pluto,
        sign: 'Aquarius',
        degreeLabel: '4°',
        absoluteDegree: signToLongitude('Aquarius', 4),
      },
      gregory: {
        ...BASKET_AGENTS_CONFIG.gregory,
        sign: 'Host Anchor',
        degreeLabel: 'Host',
        absoluteDegree: 91,
      },
    }
  }, [])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const handleRestartChat = () => {
    setMessages(getInitialMessages(countdown.phase))
    lastSpeakerKeyRef.current = 'moon'
    setIsTyping(false)
    setTypingAgent(null)
    setIsAutonomousStreaming(true)
  }

  // Moon and Sun take Main Stage across the Eclipse Axis 70% of the time!
  const getNextSpontaneousSpeaker = (lastKey: BasketAgentKey): BasketAgentKey => {
    const mainStageKeys: BasketAgentKey[] = ['moon', 'sun']
    const supportingKeys: BasketAgentKey[] = [
      'mercury',
      'venus',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
      'gregory',
    ]

    if (Math.random() < 0.7) {
      const candidates = mainStageKeys.filter(k => k !== lastKey)
      return candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : 'moon'
    } else {
      const candidates = supportingKeys.filter(k => k !== lastKey)
      return candidates[Math.floor(Math.random() * candidates.length)]
    }
  }

  useEffect(() => {
    if (!isAutonomousStreaming || isTyping) return

    const timer = setInterval(() => {
      const nextKey = getNextSpontaneousSpeaker(lastSpeakerKeyRef.current)
      lastSpeakerKeyRef.current = nextKey

      const nextCfg = agentsConfig[nextKey]
      setIsTyping(true)
      setTypingAgent(nextCfg.name)

      setTimeout(async () => {
        const fallbackText = generateSpontaneousCouncilResponse(
          nextKey,
          messages,
          skyContext,
          countdown.phase
        )
        const responseText = await fetchCouncilVoice(
          nextKey,
          undefined,
          attachedChartContext || undefined,
          fallbackText,
          countdown.phase
        )

        setMessages(prevMsgs => {
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          const newMsg: ChatMessage = {
            id: `auto-${Date.now()}`,
            agentKey: nextKey,
            senderName: nextCfg.name,
            senderRole: `${nextCfg.degreeLabel} ${nextCfg.sign}`,
            senderGlyph: nextCfg.glyph,
            element: nextCfg.element,
            content: responseText,
            timestamp: nowStr,
          }
          return [...prevMsgs, newMsg]
        })
        setIsTyping(false)
        setTypingAgent(null)
      }, 5500)
    }, 18000)

    return () => clearInterval(timer)
  }, [
    isAutonomousStreaming,
    isTyping,
    agentsConfig,
    skyContext,
    attachedChartContext,
    messages,
    countdown.phase,
  ])

  const handleSendPrompt = (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim()
    if (!text || isTyping) return

    const now = new Date()
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    let fullPromptForCouncil = text
    if (attachedChartContext) {
      fullPromptForCouncil = `${attachedChartContext}\n\n[USER QUESTION]: ${text}`
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      senderName: 'You (Searcher)',
      content: text,
      timestamp: timeStr,
      isUser: true,
      hasContextAttachment: !!attachedChartContext,
    }

    setMessages(prev => [...prev, userMsg])
    setInputPrompt('')
    setIsTyping(true)

    // Moon or Sun leading response across Eclipse Axis, with supporting delegate responding after
    const mainKeys: BasketAgentKey[] = ['moon', 'sun']
    const supportingKeys: BasketAgentKey[] = [
      'mercury',
      'venus',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
      'gregory',
    ]

    const primaryAgentKey =
      selectedAgentFilter !== 'all'
        ? selectedAgentFilter
        : mainKeys[Math.floor(Math.random() * mainKeys.length)]

    const secondAgentKey =
      selectedAgentFilter !== 'all'
        ? mainKeys.find(k => k !== primaryAgentKey) || 'sun'
        : Math.random() < 0.5
          ? mainKeys.find(k => k !== primaryAgentKey) || 'sun'
          : supportingKeys[Math.floor(Math.random() * supportingKeys.length)]

    const primaryCfg = agentsConfig[primaryAgentKey]
    setTypingAgent(primaryCfg.name)

    setTimeout(async () => {
      const fallbackText1 = generateSpontaneousCouncilResponse(
        primaryAgentKey,
        messages,
        skyContext,
        countdown.phase,
        fullPromptForCouncil
      )
      const responseText1 = await fetchCouncilVoice(
        primaryAgentKey,
        text,
        attachedChartContext || undefined,
        fallbackText1,
        countdown.phase
      )

      setMessages(prevMsgs => {
        const botMsg1: ChatMessage = {
          id: `bot-1-${Date.now()}`,
          agentKey: primaryAgentKey,
          senderName: primaryCfg.name,
          senderRole: `${primaryCfg.degreeLabel} ${primaryCfg.sign}`,
          senderGlyph: primaryCfg.glyph,
          element: primaryCfg.element,
          content: responseText1,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
        return [...prevMsgs, botMsg1]
      })

      const secondCfg = agentsConfig[secondAgentKey]
      setTypingAgent(secondCfg.name)

      setTimeout(async () => {
        const fallbackText2 = generateSpontaneousCouncilResponse(
          secondAgentKey,
          messages,
          skyContext,
          countdown.phase,
          fullPromptForCouncil
        )
        const responseText2 = await fetchCouncilVoice(
          secondAgentKey,
          text,
          attachedChartContext || undefined,
          fallbackText2,
          countdown.phase
        )

        setMessages(prevMsgs => {
          const botMsg2: ChatMessage = {
            id: `bot-2-${Date.now()}`,
            agentKey: secondAgentKey,
            senderName: secondCfg.name,
            senderRole: `${secondCfg.degreeLabel} ${secondCfg.sign}`,
            senderGlyph: secondCfg.glyph,
            element: secondCfg.element,
            content: responseText2,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
          return [...prevMsgs, botMsg2]
        })
        setIsTyping(false)
        setTypingAgent(null)
      }, 5000)
    }, 4500)
  }

  const filteredMessages = useMemo(() => {
    if (selectedAgentFilter === 'all') return messages
    return messages.filter(m => m.isUser || m.agentKey === selectedAgentFilter)
  }, [messages, selectedAgentFilter])

  const padZero = (num: number) => num.toString().padStart(2, '0')

  return (
    <div className="w-full relative glass-panel rounded-2xl border border-[#38bdf8]/50 p-5 md:p-8 bg-[#090b0e]/95 shadow-[0_0_50px_rgba(56,189,248,0.12)] overflow-hidden">
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-[#38bdf8]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-[#fbbf24]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner Header with Countdown Clock Widget */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#424936]/60">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-full text-[10px] font-mono-label font-bold tracking-widest uppercase ${countdown.phaseBadgeBg} ${countdown.phaseBadgeColor}`}
            >
              <span className="w-2 h-2 rounded-full bg-current animate-ping" />
              {countdown.phaseBadgeText}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#38bdf8]/15 border border-[#38bdf8]/30 rounded-full text-[10px] font-mono-label tracking-wider text-[#38bdf8]">
              <Sparkles className="w-3 h-3 text-[#38bdf8]" /> MAIN STAGE: MOON 5° PISCES ☍ SUN 5°
              VIRGO
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 rounded-full text-[10px] font-mono-label tracking-wider text-[#8B5CF6]">
              <Cpu className="w-3 h-3" /> 10 PLANETARY DEGREE DELEGATES
            </span>
          </div>
          <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-[#e0e4d2] tracking-tight">
            Current Promotion: <span className="text-[#38bdf8]">{countdown.phaseTitle}</span>
          </h2>
          <p className="font-body-md text-sm text-[#c2cab0] max-w-3xl mt-1 leading-relaxed">
            Moon in Pisces and Sun in Virgo command the Main Stage across the Lunar Eclipse axis,
            squared by Uranus in Gemini at the T-square apex and supported by our full council of
            planetary degree delegates.
          </p>
        </div>

        {/* Live Eclipse Countdown Widget */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <div className="bg-[#07090d] border border-[#38bdf8]/50 rounded-2xl p-3.5 flex items-center gap-3 shadow-[0_0_25px_rgba(56,189,248,0.12)]">
            <div className="w-9 h-9 rounded-xl bg-[#38bdf8]/15 border border-[#38bdf8]/40 flex items-center justify-center text-[#38bdf8] shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-mono-label text-[9px] text-[#8c947c] tracking-widest uppercase">
                {countdown.phase === 'POST_ECLIPSE' ? 'Time Post-Peak' : 'Countdown To Peak'}
              </div>
              <div className="flex items-center gap-1.5 font-headline-lg text-lg font-bold text-[#38bdf8] tracking-wider mt-0.5">
                <span className="bg-[#12161f] border border-[#38bdf8]/30 px-2 py-0.5 rounded-lg">
                  {padZero(countdown.hours)}h
                </span>
                <span>:</span>
                <span className="bg-[#12161f] border border-[#38bdf8]/30 px-2 py-0.5 rounded-lg">
                  {padZero(countdown.minutes)}m
                </span>
                <span>:</span>
                <span className="bg-[#12161f] border border-[#38bdf8]/30 px-2 py-0.5 rounded-lg text-white">
                  {padZero(countdown.seconds)}s
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInfoModal(!showInfoModal)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-3 border border-[#8c947c]/60 text-[#c2cab0] hover:text-[#38bdf8] hover:border-[#38bdf8]/40 rounded-xl font-mono-label text-[11px] tracking-wider transition-all active:scale-95 bg-white/5"
            >
              <Info className="w-4 h-4 text-[#38bdf8]" />
              {showInfoModal ? 'Hide' : 'Analysis'}
            </button>
          </div>
        </div>
      </div>

      {showInfoModal && (
        <div className="relative z-10 my-5 p-5 bg-[#0d1117] border border-[#38bdf8]/40 rounded-xl space-y-3 text-xs leading-relaxed text-[#c2cab0] animate-fadeIn">
          <div className="flex justify-between items-start">
            <h4 className="font-headline-sm text-sm text-[#38bdf8] font-bold flex items-center gap-2">
              <Globe className="w-4 h-4" /> August 28, 2026 Lunar Eclipse in Pisces Axis (Saros 138)
            </h4>
            <button
              onClick={() => setShowInfoModal(false)}
              className="text-[#8c947c] hover:text-[#e0e4d2]"
            >
              ✕
            </button>
          </div>
          <p>
            At peak eclipse (04:13 UTC on August 28, 2026), the{' '}
            <strong>Moon at 5° Pisces opposes the Sun and Mercury at 5° Virgo</strong> on the Main
            Stage, forming an intense <strong>T-Square to Uranus at 6° Gemini</strong> at the apex.
            Surrounding this axis, delegates for Venus in domicile (20° Libra), Mars (11° Cancer,
            trining the Moon), Jupiter (13° Leo), Saturn Rx (14° Aries), Neptune Rx (4° Aries, ruler
            of Pisces), and Pluto Rx (4° Aquarius) synthesize the deep intuitive release and
            practical discernment in real time.
          </p>
        </div>
      )}

      {/* Main Content Grid: Chat + Free-Body Diagram */}
      <div className="relative z-10 grid grid-cols-12 gap-5 mt-2">
        {/* Left Column: Chat Thread */}
        <div
          className={`${
            viewMode === 'diagram'
              ? 'hidden'
              : viewMode === 'chat'
                ? 'col-span-12'
                : 'col-span-12 lg:col-span-7'
          } bg-[#040507]/90 border border-[#424936]/80 rounded-xl p-4 md:p-6 flex flex-col h-[540px]`}
        >
          {/* Chat Thread Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#424936]/40">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#fbbf24]" />
              <span className="font-headline-sm text-xs text-[#e0e4d2] font-semibold">
                Eclipse Celestial Council Thread
              </span>
              <span className="font-mono-label text-[10px] text-[#8c947c]">
                ({filteredMessages.length} messages)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isAutonomousStreaming ? 'bg-[#fbbf24] animate-ping' : 'bg-amber-500'
                }`}
              />
              <span className="font-mono-label text-[10px] text-[#fbbf24]">
                {isAutonomousStreaming ? 'TOTALITY STREAM ACTIVE' : 'PAUSED'}
              </span>
              <button
                onClick={handleRestartChat}
                title="Reset Running Chat"
                className="flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-[#fbbf24]/15 border border-[#424936] hover:border-[#fbbf24]/40 rounded-lg text-[10px] font-mono-label text-[#c2cab0] hover:text-[#fbbf24] transition-all active:scale-95 ml-2 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Chat
              </button>
            </div>
          </div>

          {/* Scrollable Message List */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto space-y-3.5 pr-2 scrollbar-thin scrollbar-thumb-[#424936] scrollbar-track-transparent"
          >
            {filteredMessages.map(msg => {
              if (msg.isUser) {
                return (
                  <div key={msg.id} className="flex flex-col items-end">
                    <div className="max-w-[88%] bg-[#fbbf24]/15 border border-[#fbbf24]/40 rounded-2xl rounded-tr-none p-3 text-right">
                      <div className="font-mono-label text-[10px] text-[#fbbf24] font-bold mb-1 flex items-center justify-end gap-1.5">
                        {msg.hasContextAttachment && (
                          <span className="px-2 py-0.5 rounded bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fbbf24] font-bold text-[9px] uppercase tracking-wider flex items-center gap-1">
                            <Paperclip className="w-3 h-3" /> Chart Context Attached
                          </span>
                        )}
                        <span>
                          {msg.senderName} · {msg.timestamp}
                        </span>
                      </div>
                      <p className="font-body-md text-xs text-[#e0e4d2] leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                )
              }

              const agentCfg = msg.agentKey ? agentsConfig[msg.agentKey] : null
              const isMainStage = agentCfg?.isMainStage

              return (
                <div key={msg.id} className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold mt-0.5 ${
                      agentCfg ? agentCfg.avatarBg : 'bg-white/10 text-white'
                    } ${isMainStage ? 'ring-2 ring-[#fbbf24]/60' : ''}`}
                  >
                    {msg.senderGlyph || '✦'}
                  </div>
                  <div
                    className={`flex-1 max-w-[92%] bg-[#0c0e12] border ${
                      isMainStage
                        ? 'border-[#fbbf24]/50 shadow-[0_0_15px_rgba(251,191,36,0.06)]'
                        : 'border-[#424936]/60'
                    } rounded-2xl rounded-tl-none p-3.5`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-headline-sm text-xs font-bold text-[#e0e4d2]">
                          {msg.senderName}
                        </span>
                        {isMainStage && (
                          <span className="font-mono-label text-[8px] text-[#223600] px-1.5 py-0.2 rounded bg-[#fbbf24] font-bold uppercase">
                            MAIN STAGE
                          </span>
                        )}
                        {msg.senderRole && (
                          <span className="font-mono-label text-[9px] text-[#8c947c] px-1.5 py-0.2 rounded bg-white/5">
                            {msg.senderRole}
                          </span>
                        )}
                      </div>
                      <span className="font-mono-label text-[9px] text-[#8c947c]">
                        {msg.timestamp}
                      </span>
                    </div>
                    <p className="font-body-md text-xs text-[#c2cab0] leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </div>
              )
            })}

            {isTyping && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#fbbf24]/10 border border-[#fbbf24]/40 flex items-center justify-center text-[#fbbf24] text-xs font-bold animate-spin">
                  ⟳
                </div>
                <div className="bg-[#0c0e12] border border-[#fbbf24]/40 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <span className="font-mono-label text-xs text-[#fbbf24] animate-pulse">
                    {typingAgent
                      ? `${typingAgent} is responding to the thread...`
                      : 'Council is contemplating next response...'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Preset Prompt Chips */}
          <div className="mt-3 pt-3 border-t border-[#424936]/40 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="font-mono-label text-[9px] text-[#8c947c] shrink-0 uppercase tracking-widest">
              Event Prompts:
            </span>
            {PRESET_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                disabled={isTyping}
                onClick={() => handleSendPrompt(prompt)}
                className="shrink-0 px-2.5 py-1 bg-white/5 hover:bg-[#fbbf24]/15 border border-[#424936] hover:border-[#fbbf24]/40 rounded-full font-mono-label text-[10px] text-[#c2cab0] hover:text-[#fbbf24] transition-all disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Invitation Banner to Attach Personal Chart Context */}
          <div className="mt-2.5 p-3 bg-[#0d121a] border border-[#fbbf24]/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(251,191,36,0.06)]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#fbbf24]/15 border border-[#fbbf24]/30 flex items-center justify-center text-[#fbbf24] shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="font-headline-sm text-xs font-bold text-[#e0e4d2] flex items-center gap-2">
                  Attach Your Personal Natal Chart Context
                </div>
                <p className="font-body-md text-[11px] text-[#c2cab0] mt-0.5">
                  Attach your chart below so Sun, Moon, and our planetary council speak directly to
                  your placements!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleAttachContextFromStorage}
                className="px-3.5 py-2 bg-[#fbbf24] text-[#223600] font-mono-label text-xs font-bold rounded-xl flex items-center gap-1.5 hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all active:scale-95"
              >
                <Paperclip className="w-3.5 h-3.5" />
                {attachedChartContext
                  ? 'Chart Attached ✦'
                  : hasSavedChart
                    ? 'Attach Saved Chart'
                    : 'Attach Chart Context'}
              </button>
            </div>
          </div>

          {attachedChartContext && (
            <div className="mt-2 px-3 py-1.5 bg-[#fbbf24]/10 border border-[#fbbf24]/40 rounded-xl flex items-center justify-between text-xs text-[#fbbf24] animate-fadeIn">
              <div className="flex items-center gap-2 font-mono-label text-[11px] font-bold">
                <CheckCircle2 className="w-4 h-4 text-[#fbbf24]" />
                <span>NATAL CHART CONTEXT ATTACHED ({attachedChartContext.length} chars)</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedChartContext(null)}
                className="text-[#8c947c] hover:text-[#ef4444] font-mono-label text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 hover:bg-red-500/10 transition-all"
              >
                Remove
              </button>
            </div>
          )}

          {/* Input Box */}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={inputPrompt}
              onChange={e => setInputPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendPrompt()}
              disabled={isTyping}
              placeholder="Ask the Celestial Council a question..."
              className="flex-1 bg-[#090b0e] border border-[#424936] focus:border-[#fbbf24] rounded-xl px-4 py-2.5 text-xs text-[#e0e4d2] placeholder-[#8c947c] outline-none transition-all disabled:opacity-50"
            />
            <button
              onClick={() => handleSendPrompt()}
              disabled={!inputPrompt.trim() || isTyping}
              className="px-4 py-2.5 bg-[#fbbf24] text-[#223600] font-mono-label text-xs font-bold rounded-xl flex items-center gap-1.5 hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none shrink-0"
            >
              <Send className="w-3.5 h-3.5" /> ASK
            </button>
          </div>
        </div>

        {/* Right Column: Free-Body Diagram */}
        <div
          className={`${
            viewMode === 'chat'
              ? 'hidden'
              : viewMode === 'diagram'
                ? 'col-span-12'
                : 'col-span-12 lg:col-span-5'
          }`}
        >
          <OrbitalFreeBodyDiagram
            agents={agentsConfig}
            selectedAgent={selectedAgentFilter}
            onSelectAgent={key => setSelectedAgentFilter(key)}
          />
        </div>
      </div>

      {/* Bottom CTAs */}
      <div className="relative z-10 mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#424936]/60">
        <div className="flex items-center gap-2 font-mono-label text-xs text-[#c2cab0]">
          <Sparkles className="w-4 h-4 text-[#fbbf24]" />
          <span>Experience multi-agent cosmic synthesis in real time</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/planetary-agents')}
            className="px-4 py-2 border border-[#8c947c] text-[#e0e4d2] font-mono-label text-xs tracking-wider rounded-xl hover:bg-white/5 transition-all"
          >
            All Planetary Agents
          </button>
          <button
            onClick={() => (onOpenCouncil ? onOpenCouncil() : router.push('/planetary-council'))}
            className="px-5 py-2 bg-[#fbbf24] text-[#223600] font-mono-label text-xs tracking-wider font-bold rounded-xl flex items-center gap-2 hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all active:scale-95"
          >
            Open Full Council <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Backwards compatibility alias export
export const BarbaultBasketPromotionalThread = CurrentPromotionalThread
export type BarbaultBasketPromotionalThreadProps = CurrentPromotionalThreadProps
