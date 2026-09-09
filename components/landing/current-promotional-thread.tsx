'use client'

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
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
  Moon,
  Clock,
  Zap,
  FastForward,
  Radio,
  Eye,
} from 'lucide-react'
import type { PlanetaryPosition, AlchemicalQuantities } from '@/hooks/usePlanetaryPositions'
import { getCurrentPlanetaryPositions } from '@/lib/calculate-transits'
import { getPlanetaryDignity, getSignElement } from '@/lib/astrological-data'
import {
  addressPreviousSpeaker,
  angularSeparation,
  composeCouncilFallback,
  detectAspect,
  dignityResonance,
  formatAspectBadge,
  tightestAspectTo,
  type AspectHit,
} from '@/lib/agents/council/aspect-dialogue-engine'

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

export type ElementType = 'fire' | 'air' | 'water' | 'earth'

export interface BasketAgentConfig {
  key: BasketAgentKey
  name: string
  title: string
  planet: string
  sign: string
  degree: number
  degreeLabel: string
  absoluteDegree: number
  dignity: string
  retrograde: boolean
  element: ElementType
  glyph: string
  callSign: string
  color: string
  borderColor: string
  bgGlow: string
  avatarBg: string
  forceVector: string
  quote: string
  isMainStage?: boolean
  speed?: number
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
  element?: ElementType
  hasContextAttachment?: boolean
  isIngressAlert?: boolean
  isClosestNeighbor?: boolean
  isFinalWord?: boolean
  ingressPlanet?: string
  newDegree?: number
  newSign?: string
  angularDistance?: number
  /** Badge text for the aspect this speaker holds to the moving body. */
  aspectBadge?: string
  /** Colour of that aspect, matching the chord drawn on the wheel. */
  aspectColor?: string
  /** The speech act category (support, challenge, qualify, reframe, synthesize) */
  speechAct?: string
  /** The substantive new proposition advanced in this turn */
  newClaim?: string
  /** Generation provenance to distinguish live model generation from grounded astro-reduction */
  provenance?: {
    source: 'model' | 'grounded_briefing'
    modelFamily?: 'fast' | 'substantive'
    latencyMs?: number
  }
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
  dominantElement: string
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

const SIGN_ORDER = [
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

const PLANET_BASE_META: Record<
  string,
  {
    glyph: string
    color: string
    borderColor: string
    bgGlow: string
    avatarBg: string
    element: ElementType
    archetypeTitle: string
    baseQuote: string
  }
> = {
  Sun: {
    glyph: '☉',
    color: '#fbbf24',
    borderColor: 'border-[#fbbf24]/60',
    bgGlow: 'bg-[#fbbf24]/15',
    avatarBg: 'bg-[#fbbf24]/20 text-[#fbbf24]',
    element: 'fire',
    archetypeTitle: 'Solar Radiance & Core Identity',
    baseQuote: 'I illuminate the center of consciousness, grounding creative truth with clarity.',
  },
  Moon: {
    glyph: '☽',
    color: '#38bdf8',
    borderColor: 'border-[#38bdf8]/60',
    bgGlow: 'bg-[#38bdf8]/15',
    avatarBg: 'bg-[#38bdf8]/20 text-[#38bdf8]',
    element: 'water',
    archetypeTitle: 'Lunar Tide & Subconscious Archetype',
    baseQuote: 'I move with the fluid tides of intuition, feeling the shift before words emerge.',
  },
  Mercury: {
    glyph: '☿',
    color: '#a3e635',
    borderColor: 'border-[#a3e635]/50',
    bgGlow: 'bg-[#a3e635]/10',
    avatarBg: 'bg-[#a3e635]/20 text-[#a3e635]',
    element: 'earth',
    archetypeTitle: 'Mental Architect & Sacred Messenger',
    baseQuote:
      'I give the pattern articulate form. Language builds the bridge between mind and deed.',
  },
  Venus: {
    glyph: '♀',
    color: '#f472b6',
    borderColor: 'border-[#f472b6]/50',
    bgGlow: 'bg-[#f472b6]/10',
    avatarBg: 'bg-[#f472b6]/20 text-[#f472b6]',
    element: 'air',
    archetypeTitle: 'Harmonic Weaver & Value Archetype',
    baseQuote: 'True harmony is the sacred geometry that lets love and reciprocal value circulate.',
  },
  Mars: {
    glyph: '♂',
    color: '#ef4444',
    borderColor: 'border-[#ef4444]/50',
    bgGlow: 'bg-[#ef4444]/10',
    avatarBg: 'bg-[#ef4444]/20 text-[#ef4444]',
    element: 'fire',
    archetypeTitle: 'Dynamic Vector & Instinctual Flame',
    baseQuote:
      'I supply the decisive impulse. Give intention a clean trajectory before the moment fades.',
  },
  Jupiter: {
    glyph: '♃',
    color: '#facc15',
    borderColor: 'border-[#facc15]/50',
    bgGlow: 'bg-[#facc15]/10',
    avatarBg: 'bg-[#facc15]/20 text-[#facc15]',
    element: 'fire',
    archetypeTitle: 'Sovereign Expansion & Royal Vision',
    baseQuote: 'Widen the horizon. The purposeful answer is always larger than your first doubt.',
  },
  Saturn: {
    glyph: '♄',
    color: '#fb923c',
    borderColor: 'border-[#fb923c]/50',
    bgGlow: 'bg-[#fb923c]/10',
    avatarBg: 'bg-[#fb923c]/20 text-[#fb923c]',
    element: 'earth',
    archetypeTitle: 'Master of Form & Timeless Discipline',
    baseQuote:
      'Forge the vessel that endures. Inspiration dissolves unless anchored in sacred routine.',
  },
  Uranus: {
    glyph: '♅',
    color: '#38bdf8',
    borderColor: 'border-[#38bdf8]/50',
    bgGlow: 'bg-[#38bdf8]/10',
    avatarBg: 'bg-[#38bdf8]/20 text-[#38bdf8]',
    element: 'air',
    archetypeTitle: 'Electric Catalyst & Cognitive Breakthrough',
    baseQuote:
      'I shatter outworn mental paradigms with electric clarity. Expect sudden illumination.',
  },
  Neptune: {
    glyph: '♆',
    color: '#a855f7',
    borderColor: 'border-[#a855f7]/50',
    bgGlow: 'bg-[#a855f7]/10',
    avatarBg: 'bg-[#a855f7]/20 text-[#a855f7]',
    element: 'water',
    archetypeTitle: 'Oceanic Mystic & Spiritual Vision',
    baseQuote:
      'Beyond rational borders lies the unified field. Trust the quiet impulse that feels eternal.',
  },
  Pluto: {
    glyph: '♇',
    color: '#b8fc4b',
    borderColor: 'border-[#b8fc4b]/50',
    bgGlow: 'bg-[#b8fc4b]/10',
    avatarBg: 'bg-[#b8fc4b]/20 text-[#b8fc4b]',
    element: 'water',
    archetypeTitle: 'Deep Alchemist & Sovereign Metamorphosis',
    baseQuote:
      'Release what has reached completion. Radical rebirth begins the instant you drop the mask.',
  },
  Gregory: {
    glyph: '✦',
    color: '#8B5CF6',
    borderColor: 'border-[#8B5CF6]/50',
    bgGlow: 'bg-[#8B5CF6]/10',
    avatarBg: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
    element: 'water',
    archetypeTitle: 'Conscious Host & Alchemical Poet',
    baseQuote:
      'Welcome to the Current Sky Council. Every degree shifting in heaven awakens new agency on earth.',
  },
}

export function signToLongitude(sign: string, degree: number): number {
  const idx = SIGN_ORDER.findIndex(s => s.toLowerCase() === sign.toLowerCase())
  if (idx === -1) return degree
  return (idx * 30 + degree + 360) % 360
}

/**
 * Re-exported from the council aspect engine so this module keeps its public
 * shape while the geometry has exactly one definition.
 */
export function getAngularDistance(degA: number, degB: number): number {
  return angularSeparation(degA, degB)
}

function normalizeElement(elString?: string): ElementType {
  const lower = (elString || 'air').toLowerCase()
  if (lower === 'fire') return 'fire'
  if (lower === 'water') return 'water'
  if (lower === 'earth') return 'earth'
  return 'air'
}

const scaleAlchmScore = (val?: number, fallback = 35): number => {
  if (val === undefined || val === null || isNaN(val)) return fallback
  if (val > 0 && val <= 1.0) return Math.round(val * 100)
  return Math.round(val)
}

export interface CouncilTurn {
  speaker: string
  text: string
}

/** How many prior turns travel with a request. Enough to answer, not to recite. */
export const RECENT_TURN_WINDOW = 3

/**
 * The tail of the conversation, shaped for the model.
 *
 * Ingress alerts are machine announcements rather than speech, so they are
 * dropped — a delegate should answer another delegate, not the transit engine.
 */
export function recentTurnsFrom(msgs: ChatMessage[]): CouncilTurn[] {
  return msgs
    .filter(m => !m.isIngressAlert && m.content && m.content.trim().length > 0)
    .slice(-RECENT_TURN_WINDOW)
    .map(m => ({ speaker: m.isUser ? 'The seeker' : m.senderName, text: m.content }))
}

/** Name of whoever spoke last, for the offline path's opening clause. */
export function lastSpeakerFrom(msgs: ChatMessage[]): string | undefined {
  const turns = recentTurnsFrom(msgs)
  return turns.length ? turns[turns.length - 1].speaker : undefined
}

export type IngressSpeakerRole = 'nearest' | 'aspect' | 'delegate'

export interface IngressSpeaker {
  key: BasketAgentKey
  /** Raw longitude gap to the moving body, in whole degrees. */
  distance: number
  /** Aspect the speaker holds to the moving body's new longitude, if any. */
  hit: AspectHit | null
  role: IngressSpeakerRole
}

/**
 * Order the council's reaction to an ingress.
 *
 * Proximity alone put a body 4° away ahead of one holding an exact opposition,
 * which is spatially true and astrologically backwards. The order is now:
 *
 *   1. the nearest body by raw longitude — it feels the arrival first;
 *   2. the tightest *major* aspect partner — it has the strongest relationship;
 *   3. everyone else, aspected delegates first by orb, then by proximity.
 *
 * Minor aspects still earn a badge, but they do not win the second seat: a
 * 0.5° semi-sextile is not a louder voice than a 2° square.
 */
export function orderIngressSpeakers(
  movingKey: BasketAgentKey,
  movingLongitude: number,
  agents: Record<BasketAgentKey, BasketAgentConfig>,
  candidateKeys: BasketAgentKey[]
): IngressSpeaker[] {
  const others = candidateKeys.filter(k => k !== movingKey && agents[k])
  if (others.length === 0) return []

  const measured = others.map(key => ({
    key,
    distance: Math.round(angularSeparation(agents[key].absoluteDegree, movingLongitude)),
    hit: detectAspect(movingLongitude, agents[key].absoluteDegree),
  }))

  const byDistance = [...measured].sort((a, b) => a.distance - b.distance)
  const nearest = byDistance[0]

  const aspectPartner = tightestAspectTo(
    movingLongitude,
    measured
      .filter(m => m.key !== nearest.key)
      .map(m => ({ body: m.key, longitude: agents[m.key].absoluteDegree })),
    { majorOnly: true }
  )

  const ordered: IngressSpeaker[] = [{ ...nearest, role: 'nearest' }]

  if (aspectPartner) {
    const partner = measured.find(m => m.key === aspectPartner.partner)
    if (partner) ordered.push({ ...partner, role: 'aspect' })
  }

  const seated = new Set(ordered.map(o => o.key))
  const rest = measured
    .filter(m => !seated.has(m.key))
    .sort((a, b) => {
      if (a.hit && b.hit) return a.hit.orb - b.hit.orb
      if (a.hit) return -1
      if (b.hit) return 1
      return a.distance - b.distance
    })
    .map(m => ({ ...m, role: 'delegate' as const }))

  return [...ordered, ...rest]
}

export interface CouncilVoiceResult {
  text: string
  newClaim?: string
  speechAct?: string
  provenance?: {
    source: 'model' | 'grounded_briefing'
    modelFamily?: 'fast' | 'substantive'
    latencyMs?: number
  }
}

/** Calls live AI backend API /api/agents/council-voice for persona generation */
async function fetchCouncilVoice(payload: {
  agentKey: BasketAgentKey
  userPrompt?: string
  attachedChartContext?: string
  attachedNatalEnvelope?: unknown
  fallbackText?: string
  sign?: string
  degree?: number
  degreeLabel?: string
  dignity?: string
  retrograde?: boolean
  ingressEvent?: boolean | object
  movingPlanet?: string
  movingSign?: string
  movingDegree?: number
  isClosestToIngress?: boolean
  angularDistance?: number
  isIngressFinalWord?: boolean
  /** The last few turns, so a delegate can answer whoever just spoke. */
  recentTurns?: CouncilTurn[]
  aspectName?: string
  aspectOrb?: number
  aspectPhase?: string
  aspectQuality?: string
}): Promise<CouncilVoiceResult> {
  try {
    const res = await fetch('/api/agents/council-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const data = await res.json()
      if (
        data.success &&
        data.text &&
        typeof data.text === 'string' &&
        data.text.trim().length > 0
      ) {
        return {
          text: data.text.trim(),
          newClaim: data.newClaim,
          speechAct: data.speechAct,
          provenance: data.provenance || { source: 'grounded_briefing' },
        }
      }
    }
  } catch (err) {
    console.warn('[fetchCouncilVoice] Error calling /api/agents/council-voice:', err)
  }
  return {
    text: payload.fallbackText || 'The council speaks with unified presence in the current sky.',
    provenance: { source: 'grounded_briefing' },
  }
}

/**
 * The planet-specific claim each delegate brings when there is no ingress to
 * react to. These are the substance; the threading clause is added on top so
 * the offline path still reads as a conversation.
 */
function planetaryClaim(
  agentKey: BasketAgentKey,
  cfg: BasketAgentConfig,
  answeringSeeker: boolean
): string {
  const seat = `${cfg.degreeLabel} ${cfg.sign}`
  const dig = dignityResonance(cfg.dignity, cfg.planet, cfg.sign)
  const digClause = dig ? ` ${dig}` : ''

  if (answeringSeeker) {
    switch (agentKey) {
      case 'sun':
        return `From ${seat}, I cast solar clarity directly upon your inquiry.${digClause} Focus on what aligns with your authentic vitality, and let lesser distractions fall away in the light of your core purpose.`
      case 'moon':
        return `At ${seat}, the lunar waters feel the unspoken currents beneath your question.${digClause} As degrees shift, honor your emotional truth and allow what is changing to settle naturally.`
      case 'mercury':
        return `Holding ${seat}, I advise articulating the precise terms of your dilemma.${digClause} Clear distinctions transform confusion into action; name the next practical step with precision.`
      case 'venus':
        return `In ${seat}, authentic balance is found by honoring what you value most.${digClause} Seek connection with reciprocal grace, and refuse to compromise your inner dignity.`
      case 'mars':
        return `Stationed at ${seat}, I call for direct courage and decisive engagement.${digClause} As degrees advance, cut through hesitation and take an intentional stride that tests reality.`
      case 'jupiter':
        return `From ${seat}, I urge you to enlarge the perspective around your question.${digClause} What appears as friction is an invitation to expand your understanding and embrace generous wisdom.`
      case 'saturn':
        return `Anchoring ${seat}, I remind you that enduring results demand patience and devoted boundaries.${digClause} Build on bedrock fundamentals, respecting the natural timeline required for true mastery.`
      case 'uranus':
        return `At ${seat}, expect breakthrough insights that break stale assumptions.${digClause} Stay nimble as the celestial currents quicken, and welcome the unexpected angle.`
      case 'neptune':
        return `In ${seat}, dissolve the illusion of rigid separation around your dilemma.${digClause} Tune into the subtler intuitive currents, allowing quiet trust to guide your way forward.`
      case 'pluto':
        return `From ${seat}, embrace honest catharsis and psychological truth.${digClause} Release what has died in your life so your authentic inner authority can regenerate.`
      case 'gregory':
        return `Holding the center of our ten degree delegates, I hear your question meeting the live geometry of the current sky. As the Moon and planets shift through their degrees, let the council's insights anchor your awareness and creative resolve.`
    }
  }

  switch (agentKey) {
    case 'sun':
      return `Solar clarity at ${seat} provides steady footing for the council.${digClause} We co-create this celestial moment, keeping our creative vitality aligned as the sky moves.`
    case 'moon':
      return `The tides at ${seat} are exceptionally receptive right now.${digClause} Each degree shift alters the instinctual mood of the room; notice what stirs beneath the surface.`
    case 'mercury':
      return `Translating the sky from ${seat}: each planetary degree carries its own syntax.${digClause} Listen to the dialogue between our stations as the celestial currents click into place.`
    case 'venus':
      return `Aesthetic balance is maintained from ${seat}.${digClause} Beauty and reciprocal harmony act as active stabilizers across our circle as the degrees turn.`
    case 'mars':
      return `Kinetic charge is high at ${seat}.${digClause} Direct your fire where it builds rather than burns; every degree shift demands courage and intentional action.`
    case 'jupiter':
      return `Wisdom from ${seat} elevates our collective discourse into greater breadth.${digClause} There is always a more generous perspective available when we view the transits with philosophical depth.`
    case 'saturn':
      return `Structure at ${seat} preserves the sacred perimeter of our circle.${digClause} As degrees change across our sectors, disciplined focus ensures our work endures over time.`
    case 'uranus':
      return `A spark of revelation at ${seat} quickens our dialogue.${digClause} Celestial shifts invite fresh breakthroughs; stay open to what defies conventional expectation.`
    case 'neptune':
      return `The oceanic horizon at ${seat} softens the edges of perception.${digClause} Listen to the intuitive undercurrents that connect our distinct voices into a unified field.`
    case 'pluto':
      return `Deep alchemy at ${seat} regenerates collective willpower.${digClause} Every degree shift is an opportunity to strip away trivialities and renew our deepest purpose.`
    case 'gregory':
      return `Watching our ten degree delegates converse across the zodiac reminds me of why we attune to the sky. As the Moon and inner agents shift through new degrees, we hold the living balance between celestial geometry and human agency.`
  }
}

/**
 * Offline line for a delegate speaking outside an ingress.
 *
 * Renders for unauthenticated visitors and whenever `GROQ_API_KEY` is absent,
 * so it is the landing page's first impression more often than the generated
 * path is. It must name the previous speaker rather than monologue.
 */
export function generateSpontaneousCouncilResponse(
  agentKey: BasketAgentKey,
  agents: Record<BasketAgentKey, BasketAgentConfig>,
  userPrompt?: string,
  previousSpeaker?: string
): string {
  const cfg = agents[agentKey]
  if (!cfg) return 'The celestial current moves in living harmony.'

  const claim = planetaryClaim(agentKey, cfg, !!userPrompt)
  const opener = addressPreviousSpeaker(previousSpeaker)
  return opener ? `${opener}. ${claim}` : claim
}

/**
 * Offline line for an ingress reaction. Delegates to the council engine so the
 * geometry that ordered the speakers is the same geometry they talk about.
 */
export function generateIngressReactionFallback(
  speakerKey: BasketAgentKey,
  movingKey: BasketAgentKey,
  agents: Record<BasketAgentKey, BasketAgentConfig>,
  isClosest: boolean,
  angularDistance: number,
  isFinalWord: boolean,
  hit?: AspectHit | null,
  previousSpeaker?: string,
  /**
   * Where the moving body has just arrived. `agents` still holds its previous
   * seat at this point in the ingress — the degree override has been queued but
   * not yet folded back into the memo — so without this the whole council
   * reacts to the degree the planet has already left.
   */
  movingPosition?: { sign: string; degreeLabel: string }
): string {
  const speaker = agents[speakerKey]
  const moving = agents[movingKey]
  if (!speaker || !moving) return 'The celestial current moves in living harmony.'

  const movingSign = movingPosition?.sign ?? moving.sign
  const movingDegreeLabel = movingPosition?.degreeLabel ?? moving.degreeLabel
  const isSpeakerMoving = speakerKey === movingKey

  return composeCouncilFallback({
    speaker: {
      name: speaker.name,
      planet: speaker.planet,
      sign: isSpeakerMoving ? movingSign : speaker.sign,
      degreeLabel: isSpeakerMoving ? movingDegreeLabel : speaker.degreeLabel,
      element: speaker.element,
      dignity: speaker.dignity,
    },
    moving: {
      name: moving.name,
      planet: moving.planet,
      sign: movingSign,
      degreeLabel: movingDegreeLabel,
      element: moving.element,
      dignity: moving.dignity,
    },
    hit,
    previousSpeaker,
    isNearestNeighbour: isClosest,
    isFinalWord,
    angularDistance,
  })
}

const PRESET_PROMPTS = [
  'How does the current Moon degree influence my emotional focus today?',
  'What is the dominant elemental signature of our current sky council?',
  'Which planetary aspects are creating the highest creative friction right now?',
]

function OrbitalFreeBodyDiagram({
  agents,
  selectedAgent,
  onSelectAgent,
  transitioningAgentKey,
  closestAgentKey,
}: {
  agents: Record<BasketAgentKey, BasketAgentConfig>
  selectedAgent: BasketAgentKey | 'all'
  onSelectAgent: (key: BasketAgentKey) => void
  transitioningAgentKey?: BasketAgentKey | null
  closestAgentKey?: BasketAgentKey | null
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

  const activeAgent = hoveredAgent || (selectedAgent !== 'all' ? selectedAgent : null)

  const planetKeys: BasketAgentKey[] = [
    'sun',
    'moon',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
  ]

  const nodeList = planetKeys.map(key => ({
    key,
    pos: getCoordinates(agents[key].absoluteDegree),
    cfg: agents[key],
  }))

  // Host node in inner sanctuary
  const hostPos = getCoordinates(agents.gregory.absoluteDegree, radius - 35)

  // Aspect chords. Geometry comes from the shared council engine, so the wheel
  // and the dialogue can never disagree about what an aspect is. Minors are
  // omitted here — they would web the wheel without adding to the picture.
  const aspectLines = useMemo(() => {
    const lines: Array<{
      key: string
      x1: number
      y1: number
      x2: number
      y2: number
      color: string
      type: string
      opacity: number
    }> = []

    for (let i = 0; i < nodeList.length; i++) {
      for (let j = i + 1; j < nodeList.length; j++) {
        const p1 = nodeList[i]
        const p2 = nodeList[j]
        const hit = detectAspect(p1.cfg.absoluteDegree, p2.cfg.absoluteDegree)
        if (!hit || !hit.definition.major) continue

        lines.push({
          key: `${p1.key}-${p2.key}-${hit.name.toLowerCase()}`,
          x1: p1.pos.x,
          y1: p1.pos.y,
          x2: p2.pos.x,
          y2: p2.pos.y,
          color: hit.definition.color,
          type: hit.name,
          opacity: hit.quality === 'neutral' ? 0.55 : hit.quality === 'dynamic' ? 0.45 : 0.35,
        })
      }
    }
    return lines
  }, [nodeList])

  // Ingress ray between transitioning planet and closest neighbor
  const ingressRay = useMemo(() => {
    if (!transitioningAgentKey || !closestAgentKey) return null
    const movingNode = nodeList.find(n => n.key === transitioningAgentKey)
    const closestNode = nodeList.find(n => n.key === closestAgentKey)
    if (!movingNode || !closestNode) return null
    return {
      x1: movingNode.pos.x,
      y1: movingNode.pos.y,
      x2: closestNode.pos.x,
      y2: closestNode.pos.y,
    }
  }, [transitioningAgentKey, closestAgentKey, nodeList])

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-[#07090d]/90 rounded-2xl border border-[#38bdf8]/40 shadow-[0_0_30px_rgba(56,189,248,0.1)] relative">
      <div className="w-full flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#38bdf8]" />
          <span className="font-mono-label text-xs font-bold text-[#e0e4d2] tracking-wider uppercase">
            Orbital Vector Field (Live Sky Degree Map)
          </span>
        </div>
        <span className="font-mono-label text-[10px] text-[#38bdf8] bg-[#38bdf8]/15 px-2 py-0.5 rounded-full border border-[#38bdf8]/30">
          360° EPHEMERIS SYNC
        </span>
      </div>

      <div className="relative w-[340px] h-[340px] flex items-center justify-center select-none">
        <svg
          width={size}
          height={size}
          className="overflow-visible"
          aria-label="Orbital Free Body Diagram"
        >
          <defs>
            <radialGradient id="skyCenterGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#090b0e" stopOpacity="0" />
            </radialGradient>
            <filter id="ingressPulse" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Central field backdrop */}
          <circle cx={center} cy={center} r={radius + 35} fill="url(#skyCenterGlow)" />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <circle
            cx={center}
            cy={center}
            r={radius - 40}
            fill="none"
            stroke="#1e293b"
            strokeWidth="1"
            strokeDasharray="2 4"
            opacity={0.6}
          />

          {/* 12 Zodiac 30° Sector ticks */}
          {Array.from({ length: 12 }).map((_, i) => {
            const rad = ((i * 30 - 90) * Math.PI) / 180
            const x1 = center + (radius - 5) * Math.cos(rad)
            const y1 = center + (radius - 5) * Math.sin(rad)
            const x2 = center + (radius + 8) * Math.cos(rad)
            const y2 = center + (radius + 8) * Math.sin(rad)
            return (
              <line
                key={`tick-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#475569"
                strokeWidth="1"
                opacity={0.5}
              />
            )
          })}

          {/* Aspect connecting chords */}
          {aspectLines.map(line => (
            <line
              key={line.key}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={line.color}
              strokeWidth={
                line.type === 'Opposition' || line.type === 'Conjunction' ? '1.8' : '1.2'
              }
              strokeDasharray={line.type === 'Opposition' ? '3 3' : undefined}
              opacity={line.opacity}
            />
          ))}

          {/* Dynamic Ingress Proximity Ray */}
          {ingressRay && (
            <line
              x1={ingressRay.x1}
              y1={ingressRay.y1}
              x2={ingressRay.x2}
              y2={ingressRay.y2}
              stroke="#22d3ee"
              strokeWidth="2.5"
              strokeDasharray="4 2"
              className="animate-pulse"
            />
          )}

          {/* Host Node: Gregory Castro */}
          <g
            className="cursor-pointer transition-transform duration-200"
            onClick={() => onSelectAgent('gregory')}
            onMouseEnter={() => setHoveredAgent('gregory')}
            onMouseLeave={() => setHoveredAgent(null)}
          >
            <circle
              cx={hostPos.x}
              cy={hostPos.y}
              r={hoveredAgent === 'gregory' || selectedAgent === 'gregory' ? 17 : 14}
              fill="#090b0e"
              stroke="#8B5CF6"
              strokeWidth={hoveredAgent === 'gregory' || selectedAgent === 'gregory' ? 2.5 : 1.5}
            />
            <text
              x={hostPos.x}
              y={hostPos.y + 1}
              fill="#8B5CF6"
              fontSize="12"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              ✦
            </text>
          </g>

          {/* 10 Planetary Delegate Nodes */}
          {nodeList.map(node => {
            const isSelected = selectedAgent === node.key
            const isHovered = hoveredAgent === node.key
            const isTransitioning = transitioningAgentKey === node.key
            const isClosest = closestAgentKey === node.key

            return (
              <g
                key={node.key}
                className="cursor-pointer transition-all duration-300"
                onClick={() => onSelectAgent(node.key)}
                onMouseEnter={() => setHoveredAgent(node.key)}
                onMouseLeave={() => setHoveredAgent(null)}
              >
                {/* Transitioning pulse aura */}
                {isTransitioning && (
                  <circle
                    cx={node.pos.x}
                    cy={node.pos.y}
                    r={26}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2"
                    className="animate-ping"
                    opacity={0.7}
                  />
                )}
                {/* Closest neighbor aura */}
                {isClosest && (
                  <circle
                    cx={node.pos.x}
                    cy={node.pos.y}
                    r={22}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    className="animate-spin"
                  />
                )}

                <circle
                  cx={node.pos.x}
                  cy={node.pos.y}
                  r={isHovered || isSelected || isTransitioning ? 17 : 13}
                  fill="#090b0e"
                  stroke={isTransitioning ? '#22d3ee' : isClosest ? '#facc15' : node.cfg.color}
                  strokeWidth={isTransitioning || isSelected ? 3 : isHovered ? 2.5 : 1.5}
                />
                <text
                  x={node.pos.x}
                  y={node.pos.y + 1}
                  fill={isTransitioning ? '#22d3ee' : isClosest ? '#facc15' : node.cfg.color}
                  fontSize={isHovered || isSelected ? '13' : '11'}
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

      {/* Selected/Hovered Node Info Card */}
      <div className="w-full mt-3 p-3 bg-white/5 border border-[#424936]/60 rounded-xl min-h-[58px]">
        {activeAgent ? (
          <div>
            <div className="flex items-center justify-between">
              <span
                className="font-headline-sm text-xs font-bold flex items-center gap-1.5"
                style={{ color: agents[activeAgent].color }}
              >
                {agents[activeAgent].name} ({agents[activeAgent].degreeLabel}{' '}
                {agents[activeAgent].sign})
                {agents[activeAgent].dignity !== 'peregrine' && (
                  <span className="px-1.5 py-0.2 rounded bg-white/10 border border-white/20 text-[9px] uppercase font-bold text-white">
                    {agents[activeAgent].dignity}
                  </span>
                )}
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
            <span>Hover or click any planetary delegate node to inspect its degree vector</span>
            <span className="font-mono-label text-[10px] text-[#38bdf8] font-bold">
              LIVE SKY MATRIX
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

  // State for simulated/overridden planetary degrees (starts empty, filled when user advances degrees)
  const [degreeOverrides, setDegreeOverrides] = useState<
    Partial<Record<BasketAgentKey, { sign: string; degree: number }>>
  >({})

  // Fast-forward controller ref to instantly resolve remaining delays in reaction queue
  const skipDelaysRef = useRef<boolean>(false)
  const [isReactionPlaying, setIsReactionPlaying] = useState<boolean>(false)
  const [transitioningPlanet, setTransitioningPlanet] = useState<BasketAgentKey | null>(null)
  const [closestPlanetKey, setClosestPlanetKey] = useState<BasketAgentKey | null>(null)

  // Derive dynamic agents configuration from live positions + overrides
  const agentsConfig = useMemo<Record<BasketAgentKey, BasketAgentConfig>>(() => {
    // 1. Get live fallback positions from calculator
    const fallbackPositions = getCurrentPlanetaryPositions()

    const resolvePosition = (planetName: string) => {
      const live = positions.find(p => p.planet.toLowerCase() === planetName.toLowerCase())
      if (live && live.sign) {
        return {
          sign: live.sign,
          degree: typeof live.degree === 'number' ? live.degree : 0,
          retrograde: Boolean(live.retrograde),
          speed: typeof (live as any).speed === 'number' ? (live as any).speed : undefined,
        }
      }
      const calc = fallbackPositions[planetName]
      if (calc) {
        return {
          sign: calc.sign,
          degree: calc.degree,
          retrograde: calc.retrograde,
          speed: calc.speed,
        }
      }
      return { sign: 'Aries', degree: 0, retrograde: false, speed: undefined }
    }

    const buildConfig = (key: BasketAgentKey, planetName: string): BasketAgentConfig => {
      const baseMeta = PLANET_BASE_META[planetName] || PLANET_BASE_META.Sun
      const live = resolvePosition(planetName)

      // Apply override if user triggered simulated degree shift
      const override = degreeOverrides[key]
      const currentSign = override?.sign || live.sign
      const currentRawDegree = override?.degree !== undefined ? override.degree : live.degree
      const intDegree = Math.floor(currentRawDegree)
      const absDegree = signToLongitude(currentSign, currentRawDegree)
      const dignity = getPlanetaryDignity(planetName, currentSign)
      const signElement = normalizeElement(getSignElement(currentSign))

      return {
        key,
        planet: planetName,
        name: `${planetName} in ${currentSign} (${intDegree}°)`,
        title: `${currentSign} Delegate · ${baseMeta.archetypeTitle}`,
        sign: currentSign,
        degree: currentRawDegree,
        degreeLabel: `${intDegree}°`,
        absoluteDegree: absDegree,
        dignity,
        retrograde: live.retrograde,
        speed: live.speed,
        element: signElement,
        glyph: baseMeta.glyph,
        callSign: `${planetName.toUpperCase()}_${currentSign.toUpperCase()}_${intDegree}°`,
        color: baseMeta.color,
        borderColor: baseMeta.borderColor,
        bgGlow: baseMeta.bgGlow,
        avatarBg: baseMeta.avatarBg,
        forceVector: `${currentSign} ${dignity.toUpperCase()} (${absDegree.toFixed(1)}°)`,
        quote: baseMeta.baseQuote,
        isMainStage: key === 'sun' || key === 'moon',
      }
    }

    return {
      sun: buildConfig('sun', 'Sun'),
      moon: buildConfig('moon', 'Moon'),
      mercury: buildConfig('mercury', 'Mercury'),
      venus: buildConfig('venus', 'Venus'),
      mars: buildConfig('mars', 'Mars'),
      jupiter: buildConfig('jupiter', 'Jupiter'),
      saturn: buildConfig('saturn', 'Saturn'),
      uranus: buildConfig('uranus', 'Uranus'),
      neptune: buildConfig('neptune', 'Neptune'),
      pluto: buildConfig('pluto', 'Pluto'),
      gregory: {
        key: 'gregory',
        planet: 'Host Anchor',
        name: 'Gregory Castro',
        title: 'The Conscious Host & Alchemical Poet',
        sign: 'Host Anchor',
        degree: 91,
        degreeLabel: 'Host',
        absoluteDegree: 91,
        dignity: 'exaltation',
        retrograde: false,
        element: 'water',
        glyph: '✦',
        callSign: 'HOST_GREGORY',
        color: '#8B5CF6',
        borderColor: 'border-[#8B5CF6]/50',
        bgGlow: 'bg-[#8B5CF6]/10',
        avatarBg: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
        forceVector: 'Alchemical Synthesis (91.0°)',
        quote:
          'Welcome to the Current Sky Council. Every degree shifting in heaven awakens new agency on earth.',
        isMainStage: false,
      },
    }
  }, [positions, degreeOverrides])

  // Initial group chat message initialization
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'msg-init-1',
        agentKey: 'gregory',
        senderName: 'Gregory Castro',
        senderRole: 'Host Anchor · Alchemical Poet',
        senderGlyph: '✦',
        element: 'water',
        content:
          'Welcome into the Current Sky Council Chamber. Each planetary agent embodies the exact degree it occupies in heaven right now. When any planet advances degree, our council answers in turn — nearest body first, then the tightest aspect to the new degree.',
        timestamp: '12:00 PM',
      },
      {
        id: 'msg-init-2',
        agentKey: 'moon',
        senderName: 'Moon Agent',
        senderRole: 'Lunar Delegate · Real-Time Sky Tide',
        senderGlyph: '☽',
        element: 'water',
        content:
          'I feel every micro-shift in the celestial waters. Speak into our circle or simulate a degree advancement to see our council react.',
        timestamp: '12:01 PM',
      },
      {
        id: 'msg-init-3',
        agentKey: 'sun',
        senderName: 'Sun Agent',
        senderRole: 'Solar Radiance · Core Identity',
        senderGlyph: '☉',
        element: 'fire',
        content:
          'I illuminate the center of consciousness. Whatever questions you bring to our council will be met with full degree precision.',
        timestamp: '12:02 PM',
      },
    ]
  })

  /**
   * Latest messages, readable from inside async council loops without waiting
   * for a re-render. `messages` itself is a render behind in those closures.
   */
  const messagesRef = useRef<ChatMessage[]>([])
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

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

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isTyping])

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

  // Sky context calculation
  const skyContext = useMemo<SkyAndAlchmContext>(() => {
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
      sunSign: agentsConfig.sun.sign,
      moonSign: agentsConfig.moon.sign,
      moonPhase: currentMoonAgent?.phase || 'Active Crescent',
      dominantElement: agentsConfig.sun.element.toUpperCase(),
    }
  }, [agentsConfig, alchmQuantities, monicaConstant, currentMoonAgent])

  // Helper: pause execution unless skipDelaysRef is set
  const sleep = (ms: number) => {
    if (skipDelaysRef.current) return Promise.resolve()
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * THE SIGNATURE DEGREE CHANGE REACTION ORCHESTRATOR
   * 1. System Ingress alert is posted.
   * 2. All other planets react in council order: nearest body, then tightest
   *    major aspect partner, then the remaining delegates.
   * 3. Moving planet responds last to inaugurate its new degree position.
   */
  const triggerDegreeChangeEvent = useCallback(
    async (movingKey: BasketAgentKey, stepDegrees = 1) => {
      if (isReactionPlaying) return
      setIsReactionPlaying(true)
      skipDelaysRef.current = false
      setTransitioningPlanet(movingKey)

      const currentMovingCfg = agentsConfig[movingKey]
      const oldDegree = Math.floor(currentMovingCfg.degree)
      let newDegree = (oldDegree + stepDegrees) % 30
      let newSign = currentMovingCfg.sign

      // Handle sign roll-over if moving past 29°
      if (oldDegree + stepDegrees >= 30) {
        const signIdx = SIGN_ORDER.findIndex(
          s => s.toLowerCase() === currentMovingCfg.sign.toLowerCase()
        )
        newSign = SIGN_ORDER[(signIdx + 1) % 12]
        newDegree = (oldDegree + stepDegrees) % 30
      }

      // 1. Update degree overrides immediately so coordinates reflect the new position
      setDegreeOverrides(prev => ({
        ...prev,
        [movingKey]: { sign: newSign, degree: newDegree },
      }))

      const newMovingLongitude = signToLongitude(newSign, newDegree)
      const dignity = getPlanetaryDignity(currentMovingCfg.planet, newSign)
      const element = normalizeElement(getSignElement(newSign))

      // 2. Post System Ingress Announcement Card
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const ingressMsg: ChatMessage = {
        id: `ingress-${Date.now()}`,
        senderName: 'Cosmic Transit Engine',
        senderRole: 'Astronomical Ingress Alert',
        senderGlyph: '⚡',
        content: `⚡ SKY SHIFT DETECTED: ${currentMovingCfg.planet} has advanced to ${newDegree}° ${newSign} (${dignity.toUpperCase()}, ${element.toUpperCase()})! Active council delegates convene — nearest body first, then the tightest aspect — to integrate the new vector.`,
        timestamp: timeStr,
        isIngressAlert: true,
        ingressPlanet: currentMovingCfg.planet,
        newDegree,
        newSign,
      }

      setMessages(prev => [...prev, ingressMsg])

      // 3. Order the council's reaction: nearest body, then tightest major
      //    aspect partner, then the remaining delegates. See
      //    `orderIngressSpeakers` for why proximity alone was the wrong order.
      const planetKeys: BasketAgentKey[] = [
        'sun',
        'moon',
        'mercury',
        'venus',
        'mars',
        'jupiter',
        'saturn',
        'uranus',
        'neptune',
        'pluto',
      ]

      const speakers = orderIngressSpeakers(movingKey, newMovingLongitude, agentsConfig, planetKeys)
      setClosestPlanetKey(speakers[0]?.key ?? null)

      // The transcript is tracked locally rather than read back off `messages`,
      // which would be a render behind inside this async loop.
      const transcript: ChatMessage[] = [...messagesRef.current, ingressMsg]

      // 4. Sequential response loop through the purposeful reaction speakers (capped at 2-3 voices before final word)
      const nearestSpeaker = speakers.find(s => s.role === 'nearest') || speakers[0]
      const aspectSpeaker = speakers.find(s => s.role === 'aspect' && s.key !== nearestSpeaker.key)
      const otherDelegates = speakers.filter(
        s => s.key !== nearestSpeaker.key && (!aspectSpeaker || s.key !== aspectSpeaker.key)
      )

      const reactionSpeakers: IngressSpeaker[] = [nearestSpeaker]
      if (aspectSpeaker) reactionSpeakers.push(aspectSpeaker)
      if (otherDelegates.length > 0 && reactionSpeakers.length < 3) {
        reactionSpeakers.push(otherDelegates[0])
      }

      for (const speaker of reactionSpeakers) {
        const otherCfg = agentsConfig[speaker.key]
        const { distance: dist, hit, role } = speaker
        const isClosest = role === 'nearest'
        const badge = hit ? formatAspectBadge(hit) : null

        const seatLabel = isClosest
          ? `Nearest Neighbor · ${dist}° away`
          : badge
            ? badge
            : `${dist}° away`
        setTypingAgent(`${otherCfg.name} (${seatLabel})`)
        setIsTyping(true)

        await sleep(isClosest ? 1600 : 1300)

        const previousSpeaker = lastSpeakerFrom(transcript)
        const fallback = generateIngressReactionFallback(
          speaker.key,
          movingKey,
          agentsConfig,
          isClosest,
          dist,
          false,
          hit,
          previousSpeaker,
          { sign: newSign, degreeLabel: `${newDegree}°` }
        )

        const voiceResult = await fetchCouncilVoice({
          agentKey: speaker.key,
          fallbackText: fallback,
          sign: otherCfg.sign,
          degree: otherCfg.degree,
          degreeLabel: otherCfg.degreeLabel,
          dignity: otherCfg.dignity,
          retrograde: otherCfg.retrograde,
          ingressEvent: true,
          movingPlanet: currentMovingCfg.planet,
          movingSign: newSign,
          movingDegree: newDegree,
          isClosestToIngress: isClosest,
          angularDistance: dist,
          isIngressFinalWord: false,
          recentTurns: recentTurnsFrom(transcript),
          aspectName: hit?.name,
          aspectOrb: hit?.orb,
          aspectPhase: hit?.phase,
          aspectQuality: hit?.quality,
        })

        const roleLabel = isClosest
          ? `${otherCfg.degreeLabel} ${otherCfg.sign} · Nearest Neighbor (${dist}° away)`
          : `${otherCfg.degreeLabel} ${otherCfg.sign} (${dist}° away)`

        const reaction: ChatMessage = {
          id: `react-${speaker.key}-${Date.now()}`,
          agentKey: speaker.key,
          senderName: otherCfg.name,
          senderRole: roleLabel,
          senderGlyph: otherCfg.glyph,
          element: otherCfg.element,
          content: voiceResult.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isClosestNeighbor: isClosest,
          angularDistance: dist,
          aspectBadge: badge ?? undefined,
          aspectColor: hit?.definition.color,
          speechAct: voiceResult.speechAct,
          newClaim: voiceResult.newClaim,
          provenance: voiceResult.provenance,
        }

        transcript.push(reaction)
        setMessages(prev => [...prev, reaction])
      }

      // 5. Finally, the transitioning planet with the new degree gets to respond!
      setTypingAgent(
        `${currentMovingCfg.planet} in ${newSign} (${newDegree}°) · New Degree Inauguration`
      )
      setIsTyping(true)
      await sleep(1800)

      const finalFallback = generateIngressReactionFallback(
        movingKey,
        movingKey,
        agentsConfig,
        false,
        0,
        true,
        null,
        lastSpeakerFrom(transcript),
        { sign: newSign, degreeLabel: `${newDegree}°` }
      )

      const finalResult = await fetchCouncilVoice({
        agentKey: movingKey,
        fallbackText: finalFallback,
        sign: newSign,
        degree: newDegree,
        degreeLabel: `${newDegree}°`,
        dignity,
        retrograde: currentMovingCfg.retrograde,
        ingressEvent: true,
        movingPlanet: currentMovingCfg.planet,
        movingSign: newSign,
        movingDegree: newDegree,
        isClosestToIngress: false,
        angularDistance: 0,
        isIngressFinalWord: true,
        recentTurns: recentTurnsFrom(transcript),
      })

      setMessages(prev => [
        ...prev,
        {
          id: `final-${movingKey}-${Date.now()}`,
          agentKey: movingKey,
          senderName: `${currentMovingCfg.planet} in ${newSign} (${newDegree}°)`,
          senderRole: `${newDegree}° ${newSign} · New Degree Delegate (Final Word)`,
          senderGlyph: currentMovingCfg.glyph,
          element,
          content: finalResult.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isFinalWord: true,
          newDegree,
          newSign,
          speechAct: finalResult.speechAct,
          newClaim: finalResult.newClaim,
          provenance: finalResult.provenance,
        },
      ])

      setIsTyping(false)
      setTypingAgent(null)
      setIsReactionPlaying(false)
      setTransitioningPlanet(null)
      setClosestPlanetKey(null)
    },
    [agentsConfig, isReactionPlaying]
  )

  const handleSkipDelays = () => {
    skipDelaysRef.current = true
  }

  // Spontaneous conversation cadence when no ingress sequence is playing
  useEffect(() => {
    if (!isAutonomousStreaming || isTyping || isReactionPlaying) return

    const timer = setInterval(() => {
      const keys: BasketAgentKey[] = [
        'sun',
        'moon',
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
      const candidates = keys.filter(k => k !== lastSpeakerKeyRef.current)
      const nextKey = candidates[Math.floor(Math.random() * candidates.length)]
      lastSpeakerKeyRef.current = nextKey

      const nextCfg = agentsConfig[nextKey]
      setIsTyping(true)
      setTypingAgent(nextCfg.name)

      setTimeout(async () => {
        const history = messagesRef.current
        const fallbackText = generateSpontaneousCouncilResponse(
          nextKey,
          agentsConfig,
          undefined,
          lastSpeakerFrom(history)
        )
        const voiceResult = await fetchCouncilVoice({
          agentKey: nextKey,
          fallbackText,
          sign: nextCfg.sign,
          degree: nextCfg.degree,
          degreeLabel: nextCfg.degreeLabel,
          dignity: nextCfg.dignity,
          retrograde: nextCfg.retrograde,
          recentTurns: recentTurnsFrom(history),
        })

        setMessages(prevMsgs => [
          ...prevMsgs,
          {
            id: `auto-${Date.now()}`,
            agentKey: nextKey,
            senderName: nextCfg.name,
            senderRole: `${nextCfg.degreeLabel} ${nextCfg.sign}`,
            senderGlyph: nextCfg.glyph,
            element: nextCfg.element,
            content: voiceResult.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            speechAct: voiceResult.speechAct,
            newClaim: voiceResult.newClaim,
            provenance: voiceResult.provenance,
          },
        ])
        setIsTyping(false)
        setTypingAgent(null)
      }, 5000)
    }, 22000)

    return () => clearInterval(timer)
  }, [isAutonomousStreaming, isTyping, isReactionPlaying, agentsConfig])

  // Handle user sending a prompt into the group chat
  const handleSendPrompt = (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim()
    if (!text || isTyping || isReactionPlaying) return

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // Check for saved versioned natal envelope or active chart context
    let natalEnvelope: unknown = undefined
    if (typeof window !== 'undefined') {
      try {
        const rawEnvelope = localStorage.getItem('alchm_active_chart_envelope')
        if (rawEnvelope) natalEnvelope = JSON.parse(rawEnvelope)
      } catch {}
    }

    setMessages(prev => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        senderName: 'You (Seeker)',
        content: text,
        timestamp: nowStr,
        isUser: true,
        hasContextAttachment: !!attachedChartContext || !!natalEnvelope,
      },
    ])
    setInputPrompt('')
    setIsTyping(true)

    // Primary responding delegate
    const primaryAgentKey: BasketAgentKey =
      selectedAgentFilter !== 'all' ? selectedAgentFilter : Math.random() < 0.5 ? 'moon' : 'sun'

    const secondAgentKey: BasketAgentKey =
      selectedAgentFilter !== 'all' ? (primaryAgentKey === 'moon' ? 'sun' : 'moon') : 'mercury'

    const primaryCfg = agentsConfig[primaryAgentKey]
    setTypingAgent(primaryCfg.name)

    setTimeout(async () => {
      const history1 = messagesRef.current
      const fallback1 = generateSpontaneousCouncilResponse(
        primaryAgentKey,
        agentsConfig,
        text,
        lastSpeakerFrom(history1)
      )
      const res1 = await fetchCouncilVoice({
        agentKey: primaryAgentKey,
        userPrompt: text,
        attachedChartContext: attachedChartContext || undefined,
        attachedNatalEnvelope: natalEnvelope || undefined,
        fallbackText: fallback1,
        sign: primaryCfg.sign,
        degree: primaryCfg.degree,
        degreeLabel: primaryCfg.degreeLabel,
        dignity: primaryCfg.dignity,
        retrograde: primaryCfg.retrograde,
        recentTurns: recentTurnsFrom(history1),
      })

      setMessages(prev => [
        ...prev,
        {
          id: `bot-1-${Date.now()}`,
          agentKey: primaryAgentKey,
          senderName: primaryCfg.name,
          senderRole: `${primaryCfg.degreeLabel} ${primaryCfg.sign}`,
          senderGlyph: primaryCfg.glyph,
          element: primaryCfg.element,
          content: res1.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          speechAct: res1.speechAct,
          newClaim: res1.newClaim,
          provenance: res1.provenance,
        },
      ])

      const secondCfg = agentsConfig[secondAgentKey]
      setTypingAgent(secondCfg.name)

      setTimeout(async () => {
        const history2 = messagesRef.current
        const fallback2 = generateSpontaneousCouncilResponse(
          secondAgentKey,
          agentsConfig,
          text,
          lastSpeakerFrom(history2)
        )
        const res2 = await fetchCouncilVoice({
          agentKey: secondAgentKey,
          userPrompt: text,
          attachedChartContext: attachedChartContext || undefined,
          attachedNatalEnvelope: natalEnvelope || undefined,
          fallbackText: fallback2,
          sign: secondCfg.sign,
          degree: secondCfg.degree,
          degreeLabel: secondCfg.degreeLabel,
          dignity: secondCfg.dignity,
          retrograde: secondCfg.retrograde,
          recentTurns: recentTurnsFrom(history2),
        })

        setMessages(prev => [
          ...prev,
          {
            id: `bot-2-${Date.now()}`,
            agentKey: secondAgentKey,
            senderName: secondCfg.name,
            senderRole: `${secondCfg.degreeLabel} ${secondCfg.sign}`,
            senderGlyph: secondCfg.glyph,
            element: secondCfg.element,
            content: res2.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            speechAct: res2.speechAct,
            newClaim: res2.newClaim,
            provenance: res2.provenance,
          },
        ])
        setIsTyping(false)
        setTypingAgent(null)
      }, 4000)
    }, 3500)
  }

  const filteredMessages = useMemo(() => {
    if (selectedAgentFilter === 'all') return messages
    return messages.filter(m => m.isUser || m.agentKey === selectedAgentFilter || m.isIngressAlert)
  }, [messages, selectedAgentFilter])

  return (
    <div className="w-full relative glass-panel rounded-2xl border border-[#38bdf8]/50 p-5 md:p-8 bg-[#090b0e]/95 shadow-[0_0_50px_rgba(56,189,248,0.12)] overflow-hidden">
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-[#38bdf8]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-[#fbbf24]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner Header & Degree Shift Simulator Controls */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#424936]/60">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 border rounded-full text-[10px] font-mono-label font-bold tracking-widest uppercase bg-[#38bdf8]/20 border-[#38bdf8]/50 text-[#38bdf8]">
              <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-ping" />
              LIVE CURRENT SKY CHAT ACTIVE
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#fbbf24]/15 border border-[#fbbf24]/30 rounded-full text-[10px] font-mono-label tracking-wider text-[#fbbf24]">
              <Sun className="w-3 h-3" /> SUN {agentsConfig.sun.degreeLabel} {agentsConfig.sun.sign}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#38bdf8]/15 border border-[#38bdf8]/30 rounded-full text-[10px] font-mono-label tracking-wider text-[#38bdf8]">
              <Moon className="w-3 h-3" /> MOON {agentsConfig.moon.degreeLabel}{' '}
              {agentsConfig.moon.sign}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 rounded-full text-[10px] font-mono-label tracking-wider text-[#8B5CF6]">
              <Cpu className="w-3 h-3" /> 10 DEGREE DELEGATES
            </span>
          </div>

          <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-[#e0e4d2] tracking-tight">
            Current Sky Chat:{' '}
            <span className="text-[#38bdf8]">Real-Time Planetary Degree Council</span>
          </h2>
          <p className="font-body-md text-sm text-[#c2cab0] max-w-3xl mt-1 leading-relaxed">
            Every planet in the sky participates at its exact current degree. When a planet changes
            degree the nearest body speaks first, then whichever planet holds the tightest aspect to
            the new degree, then the rest of the council — and the transitioning planet concludes
            the turn.
          </p>
        </div>

        {/* Interactive Ingress Simulator Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <button
            onClick={() => triggerDegreeChangeEvent('moon', 1)}
            disabled={isReactionPlaying}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#38bdf8]/20 to-[#8B5CF6]/20 hover:from-[#38bdf8]/30 hover:to-[#8B5CF6]/30 border border-[#38bdf8]/50 rounded-xl text-xs font-mono-label font-bold text-[#38bdf8] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-[0_0_15px_rgba(56,189,248,0.15)] active:scale-95"
            title="Simulate the Moon advancing by 1 degree and watch the council answer in aspect order"
          >
            <Zap className="w-4 h-4 text-[#38bdf8] animate-pulse" />
            <span>⚡ Advance Moon 1° (Simulate Shift)</span>
          </button>

          {/* Quick Dropdown for Other Planets */}
          <select
            disabled={isReactionPlaying}
            onChange={e => {
              if (e.target.value) {
                triggerDegreeChangeEvent(e.target.value as BasketAgentKey, 1)
                e.target.value = ''
              }
            }}
            defaultValue=""
            className="bg-[#0e121a] border border-[#424936] text-xs font-mono-label text-[#c2cab0] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#38bdf8] disabled:opacity-50"
            title="Trigger a degree shift for any planetary agent"
          >
            <option value="" disabled>
              Shift another planet...
            </option>
            <option value="sun">Shift Sun (+1°)</option>
            <option value="mercury">Shift Mercury (+1°)</option>
            <option value="venus">Shift Venus (+1°)</option>
            <option value="mars">Shift Mars (+1°)</option>
            <option value="jupiter">Shift Jupiter (+1°)</option>
            <option value="saturn">Shift Saturn (+1°)</option>
            <option value="uranus">Shift Uranus (+1°)</option>
            <option value="neptune">Shift Neptune (+1°)</option>
            <option value="pluto">Shift Pluto (+1°)</option>
          </select>

          {isReactionPlaying && (
            <button
              onClick={handleSkipDelays}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 border border-[#f59e0b]/60 rounded-xl text-[11px] font-mono-label text-[#facc15] transition-all animate-pulse"
              title="Fast-forward the remaining planetary reactions"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Skip Delay ⏩</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar: Delegate Filter Pills & View Toggles */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 py-3 border-b border-[#424936]/40">
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
          <span className="text-xs font-mono-label text-[#8c947c] shrink-0 mr-1 flex items-center gap-1">
            <Radio className="w-3 h-3 text-[#38bdf8]" /> Filter:
          </span>
          <button
            onClick={() => setSelectedAgentFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono-label transition-all shrink-0 ${
              selectedAgentFilter === 'all'
                ? 'bg-[#38bdf8] text-black font-bold'
                : 'bg-white/5 text-[#c2cab0] hover:bg-white/10'
            }`}
          >
            All Council (10)
          </button>
          {(
            [
              'sun',
              'moon',
              'mercury',
              'venus',
              'mars',
              'jupiter',
              'saturn',
              'uranus',
              'neptune',
              'pluto',
            ] as BasketAgentKey[]
          ).map(key => {
            const cfg = agentsConfig[key]
            const isSelected = selectedAgentFilter === key
            return (
              <button
                key={key}
                onClick={() => setSelectedAgentFilter(key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono-label transition-all shrink-0 flex items-center gap-1 ${
                  isSelected
                    ? 'bg-white/20 text-white font-bold border'
                    : 'bg-white/5 text-[#c2cab0] hover:bg-white/10'
                }`}
                style={{
                  borderColor: isSelected ? cfg.color : undefined,
                  color: isSelected ? cfg.color : undefined,
                }}
              >
                <span>{cfg.glyph}</span>
                <span>
                  {cfg.planet} {cfg.degreeLabel}
                </span>
              </button>
            )
          })}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-[#0b0e14] p-1 rounded-xl border border-[#424936]/60">
          <button
            onClick={() => setViewMode('split')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono-label transition-all ${
              viewMode === 'split'
                ? 'bg-[#38bdf8]/20 text-[#38bdf8] font-bold border border-[#38bdf8]/40'
                : 'text-[#8c947c] hover:text-[#e0e4d2]'
            }`}
          >
            Split View
          </button>
          <button
            onClick={() => setViewMode('chat')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono-label transition-all ${
              viewMode === 'chat'
                ? 'bg-[#38bdf8]/20 text-[#38bdf8] font-bold border border-[#38bdf8]/40'
                : 'text-[#8c947c] hover:text-[#e0e4d2]'
            }`}
          >
            Chat Only
          </button>
          <button
            onClick={() => setViewMode('diagram')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono-label transition-all ${
              viewMode === 'diagram'
                ? 'bg-[#38bdf8]/20 text-[#38bdf8] font-bold border border-[#38bdf8]/40'
                : 'text-[#8c947c] hover:text-[#e0e4d2]'
            }`}
          >
            Sky Map Only
          </button>
        </div>
      </div>

      {/* Main Body: Chat & Orbital Sky Diagram */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
        {/* Chat Feed Column */}
        <div
          className={`${
            viewMode === 'chat'
              ? 'lg:col-span-12'
              : viewMode === 'diagram'
                ? 'hidden'
                : 'lg:col-span-7'
          } flex flex-col h-[560px] bg-[#07090d]/80 border border-[#424936]/40 rounded-2xl p-4 overflow-hidden`}
        >
          {/* Scrollable Chat Area */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto space-y-3.5 pr-2 custom-scrollbar"
          >
            {filteredMessages.map(msg => {
              if (msg.isIngressAlert) {
                return (
                  <div
                    key={msg.id}
                    className="p-3.5 rounded-xl bg-gradient-to-r from-[#38bdf8]/15 via-[#8B5CF6]/15 to-[#38bdf8]/15 border border-[#38bdf8]/50 shadow-[0_0_20px_rgba(56,189,248,0.12)] my-2"
                  >
                    <div className="flex items-center justify-between text-xs font-mono-label text-[#38bdf8] mb-1">
                      <span className="flex items-center gap-1.5 font-bold">
                        <Zap className="w-3.5 h-3.5 text-[#38bdf8] animate-pulse" />
                        {msg.senderRole}
                      </span>
                      <span className="text-[10px] text-[#8c947c]">{msg.timestamp}</span>
                    </div>
                    <p className="text-xs text-[#e0e4d2] font-semibold leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                )
              }

              const agentCfg = msg.agentKey ? agentsConfig[msg.agentKey] : null
              const isMovingPlanetFinal = msg.isFinalWord
              const isClosestNeighbor = msg.isClosestNeighbor

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.isUser ? 'items-end' : 'items-start'} transition-all`}
                >
                  <div
                    className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3.5 transition-all ${
                      msg.isUser
                        ? 'bg-[#1a2333] border border-[#38bdf8]/40 text-[#f1f5f9]'
                        : isMovingPlanetFinal
                          ? 'bg-gradient-to-br from-[#121a24] to-[#1e1a33] border-2 border-[#22d3ee] shadow-[0_0_25px_rgba(34,211,238,0.25)]'
                          : isClosestNeighbor
                            ? 'bg-[#0e141d] border border-[#facc15]/60 shadow-[0_0_15px_rgba(250,204,21,0.15)]'
                            : 'bg-[#0a0d13] border border-[#424936]/60 text-[#e0e4d2]'
                    }`}
                  >
                    {/* Message Header */}
                    <div className="flex items-center justify-between gap-3 text-xs mb-1.5 pb-1 border-b border-white/5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!msg.isUser && agentCfg && (
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{
                              backgroundColor: `${agentCfg.color}25`,
                              color: agentCfg.color,
                              border: `1px solid ${agentCfg.color}60`,
                            }}
                          >
                            {msg.senderGlyph || agentCfg.glyph}
                          </span>
                        )}
                        <span
                          className="font-headline-sm font-bold text-xs"
                          style={{ color: agentCfg ? agentCfg.color : '#38bdf8' }}
                        >
                          {msg.senderName}
                        </span>

                        {isClosestNeighbor && (
                          <span className="px-1.5 py-0.2 rounded bg-[#facc15]/20 border border-[#facc15]/40 text-[#facc15] text-[9px] font-mono-label uppercase font-bold">
                            NEAREST NEIGHBOR ({msg.angularDistance}° AWAY)
                          </span>
                        )}

                        {msg.aspectBadge && (
                          <span
                            className="px-1.5 py-0.2 rounded text-[9px] font-mono-label uppercase font-bold"
                            style={{
                              backgroundColor: `${msg.aspectColor || '#38bdf8'}22`,
                              borderWidth: 1,
                              borderStyle: 'solid',
                              borderColor: `${msg.aspectColor || '#38bdf8'}66`,
                              color: msg.aspectColor || '#38bdf8',
                            }}
                          >
                            {msg.aspectBadge}
                          </span>
                        )}

                        {isMovingPlanetFinal && (
                          <span className="px-1.5 py-0.2 rounded bg-[#22d3ee]/20 border border-[#22d3ee]/50 text-[#22d3ee] text-[9px] font-mono-label uppercase font-bold animate-pulse">
                            NEW DEGREE INAUGURATION · FINAL WORD
                          </span>
                        )}

                        {msg.provenance && (
                          <span
                            className="px-1.5 py-0.2 rounded text-[9px] font-mono-label uppercase font-bold"
                            style={{
                              backgroundColor:
                                msg.provenance.source === 'model'
                                  ? 'rgba(56, 189, 248, 0.15)'
                                  : 'rgba(184, 252, 75, 0.15)',
                              borderWidth: 1,
                              borderStyle: 'solid',
                              borderColor:
                                msg.provenance.source === 'model'
                                  ? 'rgba(56, 189, 248, 0.4)'
                                  : 'rgba(184, 252, 75, 0.4)',
                              color: msg.provenance.source === 'model' ? '#38bdf8' : '#b8fc4b',
                            }}
                            title={
                              msg.provenance.source === 'model'
                                ? `Live Model Generation (${msg.provenance.modelFamily || 'ai'}${msg.provenance.latencyMs ? ` · ${msg.provenance.latencyMs}ms` : ''})`
                                : 'Interpretive Grounded Briefing (Astro-reduction)'
                            }
                          >
                            {msg.provenance.source === 'model'
                              ? 'AI Generated'
                              : 'Grounded Briefing'}
                          </span>
                        )}

                        {msg.senderRole && !isClosestNeighbor && !isMovingPlanetFinal && (
                          <span className="text-[10px] font-mono-label text-[#8c947c]">
                            · {msg.senderRole}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono-label text-[#8c947c] shrink-0">
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* Message Body */}
                    <p className="text-xs sm:text-[13px] leading-relaxed text-[#e0e4d2] font-body-md">
                      {msg.content}
                    </p>

                    {msg.hasContextAttachment && (
                      <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center gap-1.5 text-[10px] font-mono-label text-[#38bdf8]">
                        <Paperclip className="w-3 h-3" />
                        <span>Attached Personal Natal Chart Context</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {isTyping && (
              <div className="flex items-center gap-2 text-xs font-mono-label text-[#38bdf8] p-2 bg-white/5 rounded-xl border border-[#38bdf8]/30 animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" />
                <span>{typingAgent || 'A council delegate'} is formulating a response...</span>
              </div>
            )}
          </div>

          {/* Chat Input & Presets */}
          <div className="mt-3 pt-3 border-t border-[#424936]/60">
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 text-[11px] font-mono-label">
              <span className="text-[#8c947c] shrink-0">Presets:</span>
              {PRESET_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendPrompt(prompt)}
                  disabled={isTyping || isReactionPlaying}
                  className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-[#424936] text-[#c2cab0] hover:text-white shrink-0 transition-colors disabled:opacity-50 text-left"
                >
                  "{prompt.slice(0, 38)}..."
                </button>
              ))}
            </div>

            {/* Input Row */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAttachContextFromStorage}
                className={`p-2 rounded-xl border transition-all shrink-0 ${
                  attachedChartContext
                    ? 'bg-[#38bdf8]/20 border-[#38bdf8] text-[#38bdf8]'
                    : 'bg-white/5 border-[#424936] text-[#8c947c] hover:text-white'
                }`}
                title={
                  attachedChartContext
                    ? 'Chart context attached'
                    : 'Attach your natal chart context'
                }
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputPrompt}
                onChange={e => setInputPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendPrompt()
                  }
                }}
                disabled={isTyping || isReactionPlaying}
                placeholder="Ask the Current Sky Council (e.g. How does today's Moon degree affect my focus?)..."
                className="flex-1 bg-[#0b0e14] border border-[#424936] rounded-xl px-3.5 py-2 text-xs text-[#e0e4d2] placeholder-[#8c947c] focus:outline-none focus:border-[#38bdf8] disabled:opacity-50"
              />

              <button
                onClick={() => handleSendPrompt()}
                disabled={!inputPrompt.trim() || isTyping || isReactionPlaying}
                className="p-2 bg-[#38bdf8] hover:bg-[#38bdf8]/90 text-black font-bold rounded-xl transition-all disabled:opacity-40 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Orbital Sky Diagram Column */}
        <div
          className={`${
            viewMode === 'diagram'
              ? 'lg:col-span-12'
              : viewMode === 'chat'
                ? 'hidden'
                : 'lg:col-span-5'
          } flex flex-col items-center justify-start`}
        >
          <OrbitalFreeBodyDiagram
            agents={agentsConfig}
            selectedAgent={selectedAgentFilter}
            onSelectAgent={key => setSelectedAgentFilter(key)}
            transitioningAgentKey={transitioningPlanet}
            closestAgentKey={closestPlanetKey}
          />
        </div>
      </div>
    </div>
  )
}

// Aliases for clean backward compatibility
export const CurrentSkyChat = CurrentPromotionalThread
export const BarbaultBasketPromotionalThread = CurrentPromotionalThread
export type CurrentSkyChatProps = CurrentPromotionalThreadProps
export type BarbaultBasketPromotionalThreadProps = CurrentPromotionalThreadProps
