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

// Peak Totality for August 12, 2026 Total Solar Eclipse (17:47 UTC)
const ECLIPSE_PEAK_TOTALITY_DATE = new Date('2026-08-12T17:47:00.000Z')

const calculateEclipseCountdown = (): CountdownState => {
  const now = Date.now()
  const diffMs = ECLIPSE_PEAK_TOTALITY_DATE.getTime() - now

  // Totality Window: 15 minutes before to 30 minutes after peak
  const fifteenMinsMs = 15 * 60 * 1000
  const thirtyMinsMs = 30 * 60 * 1000

  if (diffMs > fifteenMinsMs) {
    const totalSecs = Math.floor(diffMs / 1000)
    const hours = Math.floor(totalSecs / 3600)
    const minutes = Math.floor((totalSecs % 3600) / 60)
    const seconds = totalSecs % 60

    return {
      hours,
      minutes,
      seconds,
      phase: 'PRE_ECLIPSE',
      phaseTitle: 'Eclipse Approaching · Countdown to Totality',
      phaseBadgeText: 'ECLIPSE COUNTDOWN ACTIVE',
      phaseBadgeBg: 'bg-[#fbbf24]/20 border-[#fbbf24]/50',
      phaseBadgeColor: 'text-[#fbbf24]',
      isTotalityActive: false,
    }
  } else if (diffMs >= -thirtyMinsMs && diffMs <= fifteenMinsMs) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      phase: 'TOTALITY',
      phaseTitle: 'Peak Totality Active · Sun & Moon at 20° Leo',
      phaseBadgeText: 'PEAK TOTALITY ACTIVE · BLACK SUN',
      phaseBadgeBg: 'bg-amber-500/25 border-amber-400',
      phaseBadgeColor: 'text-amber-300',
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
      phaseTitle: 'Post-Eclipse Integration · Reborn Solar Crown',
      phaseBadgeText: 'POST-ECLIPSE REBIRTH ACTIVE',
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
    name: 'Sun in Leo (20°)',
    title: 'Main Stage · Solar Apex & Radiant Corona',
    planet: 'Sun',
    element: 'fire',
    glyph: '☉',
    callSign: 'SUN_LEO_20°',
    color: '#fbbf24',
    borderColor: 'border-[#fbbf24]/60',
    bgGlow: 'bg-[#fbbf24]/15',
    avatarBg: 'bg-[#fbbf24]/20 text-[#fbbf24]',
    forceVector: 'Solar Apex (140.0°)',
    quote:
      'I stand at the center of this eclipse totality. When the shadow falls, let your heart lead without asking for permission.',
    isMainStage: true,
  },
  moon: {
    key: 'moon',
    name: 'Moon in Leo (20°)',
    title: 'Main Stage · Total Eclipse Shadow & Black Sun',
    planet: 'Moon',
    element: 'fire',
    glyph: '☽',
    callSign: 'MOON_LEO_20°',
    color: '#e2e8f0',
    borderColor: 'border-[#e2e8f0]/60',
    bgGlow: 'bg-[#e2e8f0]/15',
    avatarBg: 'bg-[#e2e8f0]/20 text-[#e2e8f0]',
    forceVector: 'Eclipse Shadow (140.0°)',
    quote:
      'The glare fades so you can see your true hunger. The totality shadow isn’t darkness—it is deep subconscious truth.',
    isMainStage: true,
  },
  mercury: {
    key: 'mercury',
    name: 'Mercury in Leo (4°)',
    title: 'Solar Messenger & Mind Fire Delegate',
    planet: 'Mercury',
    element: 'fire',
    glyph: '☿',
    callSign: 'MERCURY_LEO_4°',
    color: '#f59e0b',
    borderColor: 'border-[#f59e0b]/50',
    bgGlow: 'bg-[#f59e0b]/10',
    avatarBg: 'bg-[#f59e0b]/20 text-[#f59e0b]',
    forceVector: 'Catalytic Mind (124.0°)',
    quote:
      'Stop over-rationalizing your passion. Translate your inner fire into clear, unapologetic words.',
  },
  venus: {
    key: 'venus',
    name: 'Venus in Libra (5°)',
    title: 'Harmonic Equilibrium & Aesthetic Union Delegate',
    planet: 'Venus',
    element: 'air',
    glyph: '♀',
    callSign: 'VENUS_LIBRA_5°',
    color: '#f472b6',
    borderColor: 'border-[#f472b6]/50',
    bgGlow: 'bg-[#f472b6]/10',
    avatarBg: 'bg-[#f472b6]/20 text-[#f472b6]',
    forceVector: 'Harmonic Equilibrium (185.0°)',
    quote:
      'Raw power needs grace. Make sure whatever you build in this eclipse fire is something you genuinely love.',
  },
  mars: {
    key: 'mars',
    name: 'Mars in Cancer (0°)',
    title: 'Cardinal Water & Protective Hearth Delegate',
    planet: 'Mars',
    element: 'water',
    glyph: '♂',
    callSign: 'MARS_CANCER_0°',
    color: '#ef4444',
    borderColor: 'border-[#ef4444]/50',
    bgGlow: 'bg-[#ef4444]/10',
    avatarBg: 'bg-[#ef4444]/20 text-[#ef4444]',
    forceVector: 'Cardinal Protection (90.0°)',
    quote:
      'Protect what is sacred to you. Real strength isn’t loud aggression—it’s instinctual courage for what you cherish.',
  },
  jupiter: {
    key: 'jupiter',
    name: 'Jupiter in Leo (9°)',
    title: 'Sovereign Expansion & Royal Heart Delegate',
    planet: 'Jupiter',
    element: 'fire',
    glyph: '♃',
    callSign: 'JUPITER_LEO_9°',
    color: '#facc15',
    borderColor: 'border-[#facc15]/50',
    bgGlow: 'bg-[#facc15]/10',
    avatarBg: 'bg-[#facc15]/20 text-[#facc15]',
    forceVector: 'Royal Expansion (129.0°)',
    quote:
      'Half-measures will get you nowhere under this sky. Step fully into your presence and elevate everyone around you.',
  },
  saturn: {
    key: 'saturn',
    name: 'Saturn (Rx) in Aries (15°)',
    title: 'Discipline & Solitary Fire Delegate',
    planet: 'Saturn',
    element: 'fire',
    glyph: '♄',
    callSign: 'SATURN_ARIES_15°',
    color: '#fb923c',
    borderColor: 'border-[#fb923c]/50',
    bgGlow: 'bg-[#fb923c]/10',
    avatarBg: 'bg-[#fb923c]/20 text-[#fb923c]',
    forceVector: 'Structural Mastery (15.0°)',
    quote:
      'Inspiration without discipline is just a flash in the pan. Build daily habits that can hold your fire.',
  },
  uranus: {
    key: 'uranus',
    name: 'Uranus in Gemini (5°)',
    title: 'Lightning Breakthrough & Synthesis Delegate',
    planet: 'Uranus',
    element: 'air',
    glyph: '♅',
    callSign: 'URANUS_GEMINI_5°',
    color: '#38bdf8',
    borderColor: 'border-[#38bdf8]/50',
    bgGlow: 'bg-[#38bdf8]/10',
    avatarBg: 'bg-[#38bdf8]/20 text-[#38bdf8]',
    forceVector: 'Cognitive Freedom (65.0°)',
    quote:
      'Shatter the mental loops keeping you stuck. A single lightning insight can rewrite years of doubt.',
  },
  neptune: {
    key: 'neptune',
    name: 'Neptune (Rx) in Aries (4°)',
    title: 'Mystical Pioneer & Spiritual Vision Delegate',
    planet: 'Neptune',
    element: 'fire',
    glyph: '♆',
    callSign: 'NEPTUNE_ARIES_4°',
    color: '#a855f7',
    borderColor: 'border-[#a855f7]/50',
    bgGlow: 'bg-[#a855f7]/10',
    avatarBg: 'bg-[#a855f7]/20 text-[#a855f7]',
    forceVector: 'Pioneer Flame (4.0°)',
    quote:
      'Your intuition already knows the way. Stop waiting for logical permission to trust what your spirit feels.',
  },
  pluto: {
    key: 'pluto',
    name: 'Pluto (Rx) in Aquarius (4°)',
    title: 'Self-Sovereign Power & Network Delegate',
    planet: 'Pluto',
    element: 'air',
    glyph: '♇',
    callSign: 'PLUTO_AQUARIUS_4°',
    color: '#b8fc4b',
    borderColor: 'border-[#b8fc4b]/50',
    bgGlow: 'bg-[#b8fc4b]/10',
    avatarBg: 'bg-[#b8fc4b]/20 text-[#b8fc4b]',
    forceVector: 'Structural Transformation (304.0°)',
    quote:
      'Strip away the old masks that no longer fit. True personal power begins when you stop hiding who you are.',
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
    forceVector: 'Alchemical Equilibrium (91.0°)',
    quote:
      'Welcome into the circle. Tomorrow’s total solar eclipse brings Sun and Moon together at 20° Leo, surrounded by our full council.',
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
    'Welcome into the circle. Tomorrow’s Total Solar Eclipse brings the Sun and Moon together on the Main Stage at 20° Leo, surrounded by our full planetary council. Step in, attach your chart, or speak what’s on your mind.'
  let sunContent =
    'I’m standing here at full radiance. When the Moon steps over my face tomorrow, don’t shrink back—let your heart lead without waiting for permission.'
  let moonContent =
    'The Sun gives you radiance, but I give you depth. This totality shadow isn’t here to dim your fire—it’s here to show you what your soul actually hungers for.'

  if (phase === 'TOTALITY') {
    gregoryContent =
      'Peak Totality is active right now! The Sun and Moon are locked at 20° Leo. The Black Sun coronation is underway in real time—speak your deepest truth into the portal.'
    sunContent =
      'Totality is here! My golden crown is veiled; let your raw heart-truth shine right now without hesitation.'
    moonContent =
      'We stand together in the center of the Black Sun. Look into the totality shadow and claim the subconscious power you’ve kept hidden.'
  } else if (phase === 'POST_ECLIPSE') {
    gregoryContent =
      'Totality has passed and the reborn solar light is emerging. Our council is here to help you integrate the truth revealed during the eclipse shadow.'
    sunContent =
      'The shadow has lifted and my light emerges reborn. Take the raw fire from this eclipse and build your legacy.'
    moonContent =
      'Totality has integrated. Ground the subconscious realizations you felt in the dark into your daily walk.'
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
      agentKey: 'sun',
      senderName: 'Sun in Leo (20°)',
      senderRole: 'Main Stage · Solar Apex',
      senderGlyph: '☉',
      element: 'fire',
      content: sunContent,
      timestamp: '09:01 AM',
    },
    {
      id: 'msg-3',
      agentKey: 'moon',
      senderName: 'Moon in Leo (20°)',
      senderRole: 'Main Stage · Eclipse Shadow',
      senderGlyph: '☽',
      element: 'fire',
      content: moonContent,
      timestamp: '09:02 AM',
    },
    {
      id: 'msg-4',
      agentKey: 'mercury',
      senderName: 'Mercury in Leo (4°)',
      senderRole: 'Leo Delegate · Mind Fire',
      senderGlyph: '☿',
      element: 'fire',
      content:
        'Listen to them both. If you’ve been holding back your voice or over-analyzing your passions, this is your signal to speak up.',
      timestamp: '09:03 AM',
    },
    {
      id: 'msg-5',
      agentKey: 'venus',
      senderName: 'Venus in Libra (5°)',
      senderRole: 'Libra Delegate · Harmonic Union',
      senderGlyph: '♀',
      element: 'air',
      content:
        'Passion is raw, but grace gives it staying power. Make sure whatever you build in this heat is something you can truly love.',
      timestamp: '09:04 AM',
    },
    {
      id: 'msg-6',
      agentKey: 'pluto',
      senderName: 'Pluto (Rx) in Aquarius (4°)',
      senderRole: 'Aquarius Delegate · Shadow Alchemist',
      senderGlyph: '♇',
      element: 'air',
      content:
        'Stripping away the noise is the only way forward. Stop clinging to old masks that no longer fit who you’re becoming.',
      timestamp: '09:05 AM',
    },
  ]
}

const PRESET_PROMPTS = [
  'What is the 20° Leo Sun & Moon conjunction asking me to step into?',
  'How do I balance creative courage with emotional depth during this eclipse?',
  'What should I release as the totality shadow passes?',
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
          return `Your ${sunSign} Sun and ${riseSign} Rising were made for this. Let the eclipse totality strip away whatever self-doubt is keeping you in the shadow.`
        case 'moon':
          return `With your Moon in ${moonSign}, this eclipse shadow speaks straight to your gut instincts. Trust what your feelings are revealing to you today.`
        case 'mercury':
          return `Your ${sunSign} Sun and ${moonSign} Moon give your thoughts real weight. Speak what’s actually on your mind instead of keeping it safe.`
        case 'venus':
          return `Your ${sunSign} Sun brings so much warmth to your ${riseSign} path. Let this eclipse help you attract relationships that truly honor your worth.`
        case 'mars':
          return `With your Moon in ${moonSign}, your instincts are razor sharp. Direct that drive toward protecting what truly matters.`
        case 'jupiter':
          return `Your ${sunSign} Sun and ${riseSign} Rising have outgrown small spaces. Expand your vision and take the leap.`
        case 'saturn':
          return `Your ${sunSign} Sun has big dreams, but your ${moonSign} Moon needs a real foundation. Ground your eclipse intentions into daily practice.`
        case 'uranus':
          return `Your ${sunSign} Sun is ready for a breakthrough. Stop repeating old mental habits and trust the sudden shift.`
        case 'neptune':
          return `Your ${moonSign} Moon holds deep intuitive vision. Stop waiting for logical proof—act on what your spirit knows.`
        case 'pluto':
          return `Your ${sunSign} Sun and ${moonSign} Moon are shedding old skin. Let go of past fears so your authentic strength can take root.`
        case 'gregory':
          return `Seeing your Sun in ${sunSign}, Moon in ${moonSign}, and ${riseSign} Rising step into our circle makes this eclipse alignment complete.`
      }
    }

    if (
      promptLower.includes('eclipse') ||
      promptLower.includes('transform') ||
      promptLower.includes('shadow') ||
      promptLower.includes('leo') ||
      promptLower.includes('action')
    ) {
      switch (agentKey) {
        case 'sun':
          return `Totality isn’t an ending—it’s a coronation. Look inside and reclaim the creative fire you’ve been hiding.`
        case 'moon':
          return `The shadow shows you what lies behind your conscious pride. Embrace the darkness; it’s where your real strength is forged.`
        case 'mercury':
          return `Write it down, say it out loud, and take one immediate step before this momentum fades.`
        case 'venus':
          return `Real transformation happens when you align your drive with beauty and truth. Keep your connections genuine.`
        case 'mars':
          return `Use this eclipse portal to set fierce, healthy boundaries and act directly from emotional truth.`
        case 'jupiter':
          return `Fortune favors the bold. Walk through this eclipse portal with open arms and noble confidence.`
        case 'saturn':
          return `Don’t let eclipse excitement evaporate into noise. Build a solid discipline around what you care about.`
        case 'uranus':
          return `Expect a sudden flash of clarity! The air trines are clearing out old mental fog.`
        case 'neptune':
          return `Listen to the quiet inner knowing that won't go away. Give your spiritual vision real form.`
        case 'pluto':
          return `Let the outdated version of yourself burn away. True self-sovereignty begins when you stop pretending.`
        case 'gregory':
          return `Sun and Moon lead the way on the Main Stage, while every planet grounds this eclipse energy into real human transformation.`
      }
    }
  }

  // Phase-Aware Narrative Responses
  if (narrativePhase === 'PRE_ECLIPSE') {
    switch (agentKey) {
      case 'sun':
        return `The countdown ticks closer to 20° Leo. Gather your inner fire and prepare to stand in your full radiance.`
      case 'moon':
        return `As the countdown ticks down, pay close attention to the feelings rising beneath your conscious mind.`
      case 'mercury':
        return `The portal is opening soon. Write down what you’re ready to declare before peak totality arrives.`
      case 'saturn':
        return `Preparation is key. Cleanse your intentions now so you can hold the full peak alignment.`
    }
  } else if (narrativePhase === 'TOTALITY') {
    switch (agentKey) {
      case 'sun':
        return `Totality is live at 20° Leo! The solar crown is veiled; let your raw heart-truth shine without hesitation.`
      case 'moon':
        return `We stand in the center of the Black Sun right now. Look into the totality shadow and claim your subconscious power.`
      case 'pluto':
        return `The old masks are dissolving in real time. Own your self-sovereignty in this exact moment.`
      case 'jupiter':
        return `Peak totality is here! Do not shrink back—absorb the full magnitude of this alignment.`
    }
  } else if (narrativePhase === 'POST_ECLIPSE') {
    switch (agentKey) {
      case 'sun':
        return `The totality shadow has lifted and the solar crown is reborn! Take this eclipse fire and build your legacy.`
      case 'moon':
        return `Totality has integrated. Ground the deep realizations revealed in the dark into your daily walk.`
      case 'mars':
        return `The portal has passed. Now take immediate, instinctual action on what you discovered.`
      case 'venus':
        return `Carry this reborn harmony forward. Let your relationships reflect your elevated self-worth.`
    }
  }

  const seed = Math.floor(Math.random() * 3)

  switch (agentKey) {
    case 'sun':
      if (seed === 0)
        return `${lastSpeakerName} is right about the depth, but don't forget your radiance. When you own your truth, you light up the room for everyone.`
      if (seed === 1)
        return `Light and shadow aren't enemies—they are twin aspects of one sovereign heart. Step forward.`
      return `Stop waiting for permission to shine. What you build out of this eclipse will define your next chapter.`

    case 'moon':
      if (seed === 0)
        return `The Sun speaks of radiance, but I see what you keep hidden. Trust what emerges when the glare fades.`
      if (seed === 1)
        return `Your emotional depth is your superpower today. Feel it completely, then act.`
      return `The totality shadow is complete. Let your quietest intuition guide your next move.`

    case 'mercury':
      return `Building on what ${lastSpeakerName} said—turn that inner spark into clear words. Tell the world what you're here to do.`

    case 'venus':
      return `Strength without beauty turns hard. Bring harmony into your passion so it magnetizes the right people.`

    case 'mars':
      return `Protect your inner hearth first. Channel that eclipse drive into quiet, fierce commitment.`

    case 'jupiter':
      return `When the Lights command the sky like this, half-measures won't cut it. Go all in on what actually matters.`

    case 'saturn':
      return `Fire is useless if it burns out in a day. Take that eclipse impulse and build an enduring discipline around it.`

    case 'uranus':
      return `Stop trying to solve an old dilemma with the same mindset. Let the sudden breakthrough take over.`

    case 'neptune':
      return `The mind wants answers, but your spirit already knows. Trust the quiet impulse that feels undeniable.`

    case 'pluto':
      return `Let the old mask burn away. Rebirth requires letting go of what you used to hide behind.`

    case 'gregory':
      if (seed === 0)
        return `Watching Sun and Moon lead this dialogue with every planet supporting reminds me why we're here—to bridge human life with cosmic truth.`
      if (seed === 1)
        return `Every seeker bringing their chart context into this thread adds a living frequency to our collective awakening.`
      return `Tomorrow's eclipse is an open doorway. Step in with courage and let your story unfold.`
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

  // Exact absolute degrees for August 12, 2026 Eclipse
  const sunPos = getCoordinates(agents.sun.absoluteDegree)
  const moonPos = getCoordinates(agents.moon.absoluteDegree + 1.5)
  const mercuryPos = getCoordinates(agents.mercury.absoluteDegree)
  const venusPos = getCoordinates(agents.venus.absoluteDegree)
  const marsPos = getCoordinates(agents.mars.absoluteDegree)
  const jupiterPos = getCoordinates(agents.jupiter.absoluteDegree)
  const saturnPos = getCoordinates(agents.saturn.absoluteDegree)
  const uranusPos = getCoordinates(agents.uranus.absoluteDegree)
  const neptunePos = getCoordinates(agents.neptune.absoluteDegree)
  const plutoPos = getCoordinates(agents.pluto.absoluteDegree)
  const gregoryPos = getCoordinates(agents.gregory.absoluteDegree, radius - 25)

  const activeAgent = hoveredAgent || (selectedAgent !== 'all' ? selectedAgent : null)

  const nodeList: Array<{
    key: BasketAgentKey
    pos: { x: number; y: number }
    cfg: BasketAgentConfig
  }> = [
    { key: 'sun', pos: sunPos, cfg: agents.sun },
    { key: 'moon', pos: moonPos, cfg: agents.moon },
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
    <div className="flex flex-col items-center bg-[#050608] border border-[#fbbf24]/40 rounded-2xl p-4 relative overflow-hidden shadow-[0_0_30px_rgba(251,191,36,0.08)]">
      <div className="absolute inset-0 bg-[radial-gradient(#fbbf24_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

      <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-[#424936]/40">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#fbbf24]" />
          <span className="font-headline-sm text-xs font-bold text-[#e0e4d2]">
            Orbital Vector Field (Active Eclipse Axis)
          </span>
        </div>
        <span className="font-mono-label text-[9px] px-2 py-0.5 rounded bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/40 font-bold uppercase">
          MAIN STAGE: 20° LEO
        </span>
      </div>

      <div className="relative w-[340px] h-[340px]">
        <svg width={size} height={size} className="w-full h-full" suppressHydrationWarning>
          <defs>
            <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="mainStageGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="eclipseAxisLine" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#b8fc4b" stopOpacity="0.9" />
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

          {/* Main Stage Totality Highlight Arc at 20° Leo (140°) */}
          <circle
            cx={sunPos.x}
            cy={sunPos.y}
            r={24}
            fill="url(#mainStageGlow)"
            stroke="#fbbf24"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            className="animate-pulse"
          />

          {/* Zodiac Degree Markers */}
          {[
            { label: 'SUN/MOON 20° LEO', deg: 140, col: '#fbbf24' },
            { label: 'AQUARIUS 4°', deg: 304, col: '#b8fc4b' },
            { label: 'ARIES 4°/15°', deg: 10, col: '#a855f7' },
            { label: 'GEMINI 5°', deg: 65, col: '#38bdf8' },
            { label: 'LIBRA 5°', deg: 185, col: '#f472b6' },
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
          <line
            x1={sunPos.x}
            y1={sunPos.y}
            x2={plutoPos.x}
            y2={plutoPos.y}
            stroke="url(#eclipseAxisLine)"
            strokeWidth="2.5"
            strokeDasharray="4 3"
          />
          <line
            x1={sunPos.x}
            y1={sunPos.y}
            x2={saturnPos.x}
            y2={saturnPos.y}
            stroke="#fb923c"
            strokeWidth="1.5"
            opacity="0.8"
          />
          <line
            x1={uranusPos.x}
            y1={uranusPos.y}
            x2={plutoPos.x}
            y2={plutoPos.y}
            stroke="#38bdf8"
            strokeWidth="1.5"
            opacity="0.7"
          />
          <line
            x1={neptunePos.x}
            y1={neptunePos.y}
            x2={jupiterPos.x}
            y2={jupiterPos.y}
            stroke="#a855f7"
            strokeWidth="1.5"
            opacity="0.7"
          />
          <line
            x1={venusPos.x}
            y1={venusPos.y}
            x2={uranusPos.x}
            y2={uranusPos.y}
            stroke="#f472b6"
            strokeWidth="1.5"
            opacity="0.6"
          />
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
                  <span className="px-1.5 py-0.2 rounded bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fbbf24] text-[9px] uppercase font-bold">
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
            <span className="font-mono-label text-[10px] text-[#fbbf24] font-bold">
              TOTALITY HARMONY 100%
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
      positions.find(p => p.planet.toLowerCase() === pName.toLowerCase())?.sign || 'Leo'

    const currentMonica =
      typeof monicaConstant === 'number' && Number.isFinite(monicaConstant) ? monicaConstant : null

    return {
      monicaConstant: currentMonica,
      spirit: scaleAlchmScore(alchmQuantities?.spirit, 45),
      essence: scaleAlchmScore(alchmQuantities?.essence, 38),
      matter: scaleAlchmScore(alchmQuantities?.matter, 22),
      substance: scaleAlchmScore(alchmQuantities?.substance, 30),
      heat: scaleAlchmScore(alchmQuantities?.Heat, 65),
      entropy: scaleAlchmScore(alchmQuantities?.Entropy, 18),
      reactivity: scaleAlchmScore(alchmQuantities?.Reactivity, 88),
      energy: scaleAlchmScore(alchmQuantities?.Energy, 98),
      sunSign: 'Leo',
      moonSign: 'Leo',
      moonPhase: 'New Moon Eclipse / Totality',
      mercurySign: getPlanetSign('mercury'),
      marsSign: getPlanetSign('mars'),
      saturnSign: getPlanetSign('saturn'),
    }
  }, [positions, alchmQuantities, monicaConstant])

  const agentsConfig = useMemo(() => {
    return {
      sun: {
        ...BASKET_AGENTS_CONFIG.sun,
        sign: 'Leo',
        degreeLabel: '20°',
        absoluteDegree: signToLongitude('Leo', 20),
      },
      moon: {
        ...BASKET_AGENTS_CONFIG.moon,
        sign: 'Leo',
        degreeLabel: '20°',
        absoluteDegree: signToLongitude('Leo', 20),
      },
      mercury: {
        ...BASKET_AGENTS_CONFIG.mercury,
        sign: 'Leo',
        degreeLabel: '4°',
        absoluteDegree: signToLongitude('Leo', 4),
      },
      venus: {
        ...BASKET_AGENTS_CONFIG.venus,
        sign: 'Libra',
        degreeLabel: '5°',
        absoluteDegree: signToLongitude('Libra', 5),
      },
      mars: {
        ...BASKET_AGENTS_CONFIG.mars,
        sign: 'Cancer',
        degreeLabel: '0°',
        absoluteDegree: signToLongitude('Cancer', 0),
      },
      jupiter: {
        ...BASKET_AGENTS_CONFIG.jupiter,
        sign: 'Leo',
        degreeLabel: '9°',
        absoluteDegree: signToLongitude('Leo', 9),
      },
      saturn: {
        ...BASKET_AGENTS_CONFIG.saturn,
        sign: 'Aries',
        degreeLabel: '15°',
        absoluteDegree: signToLongitude('Aries', 15),
      },
      uranus: {
        ...BASKET_AGENTS_CONFIG.uranus,
        sign: 'Gemini',
        degreeLabel: '5°',
        absoluteDegree: signToLongitude('Gemini', 5),
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

  // Sun and Moon take Main Stage 70% of the time!
  const getNextSpontaneousSpeaker = (lastKey: BasketAgentKey): BasketAgentKey => {
    const mainStageKeys: BasketAgentKey[] = ['sun', 'moon']
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
        : 'sun'
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

    // Sun or Moon leading response, with supporting planet responding after
    const mainKeys: BasketAgentKey[] = ['sun', 'moon']
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
        ? mainKeys.find(k => k !== primaryAgentKey) || 'moon'
        : Math.random() < 0.5
          ? mainKeys.find(k => k !== primaryAgentKey) || 'moon'
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
    <div className="w-full relative glass-panel rounded-2xl border border-[#fbbf24]/50 p-5 md:p-8 bg-[#090b0e]/95 shadow-[0_0_50px_rgba(251,191,36,0.15)] overflow-hidden">
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-[#fbbf24]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-[#38bdf8]/10 rounded-full blur-3xl pointer-events-none" />

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
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#e2e8f0]/15 border border-[#e2e8f0]/30 rounded-full text-[10px] font-mono-label tracking-wider text-[#e2e8f0]">
              <Sun className="w-3 h-3 text-[#fbbf24]" /> MAIN STAGE: SUN & MOON AT 20° LEO
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 rounded-full text-[10px] font-mono-label tracking-wider text-[#8B5CF6]">
              <Cpu className="w-3 h-3" /> 10 PLANETARY DEGREE DELEGATES
            </span>
          </div>
          <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-[#e0e4d2] tracking-tight">
            Current Promotion: <span className="text-[#fbbf24]">{countdown.phaseTitle}</span>
          </h2>
          <p className="font-body-md text-sm text-[#c2cab0] max-w-3xl mt-1 leading-relaxed">
            Sun & Moon command the Main Stage at 20° Leo, surrounded by our full council of
            planetary degree delegates tracking the eclipse in real time.
          </p>
        </div>

        {/* Live Eclipse Countdown Widget */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <div className="bg-[#07090d] border border-[#fbbf24]/50 rounded-2xl p-3.5 flex items-center gap-3 shadow-[0_0_25px_rgba(251,191,36,0.12)]">
            <div className="w-9 h-9 rounded-xl bg-[#fbbf24]/15 border border-[#fbbf24]/40 flex items-center justify-center text-[#fbbf24] shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-mono-label text-[9px] text-[#8c947c] tracking-widest uppercase">
                {countdown.phase === 'POST_ECLIPSE'
                  ? 'Time Post-Totality'
                  : 'Countdown To Totality'}
              </div>
              <div className="flex items-center gap-1.5 font-headline-lg text-lg font-bold text-[#fbbf24] tracking-wider mt-0.5">
                <span className="bg-[#12161f] border border-[#fbbf24]/30 px-2 py-0.5 rounded-lg">
                  {padZero(countdown.hours)}h
                </span>
                <span>:</span>
                <span className="bg-[#12161f] border border-[#fbbf24]/30 px-2 py-0.5 rounded-lg">
                  {padZero(countdown.minutes)}m
                </span>
                <span>:</span>
                <span className="bg-[#12161f] border border-[#fbbf24]/30 px-2 py-0.5 rounded-lg text-white">
                  {padZero(countdown.seconds)}s
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInfoModal(!showInfoModal)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-3 border border-[#8c947c]/60 text-[#c2cab0] hover:text-[#fbbf24] hover:border-[#fbbf24]/40 rounded-xl font-mono-label text-[11px] tracking-wider transition-all active:scale-95 bg-white/5"
            >
              <Info className="w-4 h-4 text-[#fbbf24]" />
              {showInfoModal ? 'Hide' : 'Analysis'}
            </button>
          </div>
        </div>
      </div>

      {showInfoModal && (
        <div className="relative z-10 my-5 p-5 bg-[#0d1117] border border-[#fbbf24]/40 rounded-xl space-y-3 text-xs leading-relaxed text-[#c2cab0] animate-fadeIn">
          <div className="flex justify-between items-start">
            <h4 className="font-headline-sm text-sm text-[#fbbf24] font-bold flex items-center gap-2">
              <Globe className="w-4 h-4" /> August 12, 2026 Total Solar Eclipse Totality Axis
            </h4>
            <button
              onClick={() => setShowInfoModal(false)}
              className="text-[#8c947c] hover:text-[#e0e4d2]"
            >
              ✕
            </button>
          </div>
          <p>
            At peak totality (17:47 UTC on August 12, 2026), the{' '}
            <strong>Sun and Moon align at 20° Leo</strong> on the Main Stage. Surrounding this axis,
            delegates for Mercury (4° Leo), Venus (5° Libra), Mars (0° Cancer), Jupiter (9° Leo),
            Saturn Rx (15° Aries), Uranus (5° Gemini), Neptune Rx (4° Aries), and Pluto Rx (4°
            Aquarius) synthesize the celestial energy as the live countdown ticks forward into
            totality and post-eclipse integration.
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
