/**
 * Internal Server-Side Council Context
 *
 * Privately compiles high-precision celestial mechanics, aspect geometry,
 * relative velocities, and validated natal chart contacts.
 *
 * Never exposed raw to the client or dumped into model prompts; the Conversation
 * Director queries this context to synthesize a surgical TurnBrief for each turn.
 */

import { getCurrentPlanetaryPositions, type CurrentPlanetPosition } from '@/lib/calculate-transits'
import {
  detectAspect,
  signToLongitude,
  type AspectName,
  type AspectPhase,
  type AspectQuality,
} from './aspect-dialogue-engine'
import { getPlanetaryDignity, getSignElement } from '@/lib/astrological-data'
export type ElementType = 'fire' | 'water' | 'air' | 'earth'

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

export type ModalityType = 'cardinal' | 'fixed' | 'mutable'

const SIGN_MODALITIES: Record<string, ModalityType> = {
  Aries: 'cardinal',
  Cancer: 'cardinal',
  Libra: 'cardinal',
  Capricorn: 'cardinal',
  Taurus: 'fixed',
  Leo: 'fixed',
  Scorpio: 'fixed',
  Aquarius: 'fixed',
  Gemini: 'mutable',
  Virgo: 'mutable',
  Sagittarius: 'mutable',
  Pisces: 'mutable',
}

export type CelestialPlacement = CouncilContextPlacement

export interface CouncilContextPlacement {
  key: BasketAgentKey
  planet: string
  sign: string
  degree: number // Raw decimal degree, e.g. 17.08
  degreeLabel: string // Formatted whole degree, e.g. "17°"
  absoluteDegree: number // Decimal ecliptic longitude 0-360
  dignity: string
  retrograde: boolean
  speed?: number // Longitudinal velocity in degrees per day (signed)
  element: ElementType
  modality: ModalityType
}

export interface CouncilContextAspect {
  bodyA: BasketAgentKey
  bodyB: BasketAgentKey
  aspectName: AspectName
  angle: number
  orb: number
  phase: AspectPhase
  quality: AspectQuality
  major: boolean
}

export interface StructuredNatalData {
  handle?: string
  bigThree?: { sun?: string; moon?: string; rising?: string }
  placements: Array<{
    body: string
    sign: string
    deg: number
    house?: number
    retro?: boolean
    dignity?: string
  }>
  houses?: Array<{ house: number; sign: string; deg: number }>
  aspects?: Array<{
    a: string
    b: string
    type: string
    orb: number
    applying?: boolean
  }>
}

export interface CouncilTurnContext {
  turnId: string
  speakerKey: BasketAgentKey
  speakerName: string
  text: string
  claim?: string
  speechAct?: 'support' | 'challenge' | 'qualify' | 'reframe' | 'synthesize'
  usedEvidenceIds?: string[]
}

export interface CouncilContext {
  sky: Record<BasketAgentKey, CouncilContextPlacement>
  aspects: CouncilContextAspect[]
  speakerAspects: Record<BasketAgentKey, CouncilContextAspect[]>
  seekerInquiry?: string
  attachedNatalChart?: StructuredNatalData
  recentTurns: CouncilTurnContext[]
  timestamp: string
}

const CANONICAL_KEYS: readonly BasketAgentKey[] = [
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

const KEY_TO_PLANET_NAME: Record<BasketAgentKey, string> = {
  sun: 'Sun',
  moon: 'Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
  gregory: 'Host Anchor',
}

export function buildServerCouncilContext(params: {
  positions?: Record<string, CurrentPlanetPosition>
  overrides?: Partial<Record<BasketAgentKey, { sign?: string; degree?: number }>>
  seekerInquiry?: string
  attachedNatalChart?: StructuredNatalData
  recentTurns?: CouncilTurnContext[]
  date?: Date
}): CouncilContext {
  const date = params.date || new Date()
  const ephemeris = params.positions || getCurrentPlanetaryPositions(date)

  const sky = {} as Record<BasketAgentKey, CouncilContextPlacement>

  for (const key of CANONICAL_KEYS) {
    const planetName = KEY_TO_PLANET_NAME[key]
    const live = ephemeris[planetName] || {
      sign: 'Aries',
      degree: 0,
      retrograde: false,
      longitude: 0,
      speed: undefined,
    }

    const override = params.overrides?.[key]
    const sign = override?.sign || live.sign
    const degree = override?.degree !== undefined ? override.degree : live.degree
    const absoluteDegree = signToLongitude(sign, degree)
    const dignity = getPlanetaryDignity(planetName, sign)
    const signElement = (getSignElement(sign) || 'air').toLowerCase() as ElementType
    const modality = SIGN_MODALITIES[sign] || 'cardinal'

    sky[key] = {
      key,
      planet: planetName,
      sign,
      degree,
      degreeLabel: `${Math.floor(degree)}°`,
      absoluteDegree,
      dignity,
      retrograde: live.retrograde,
      speed: live.speed,
      element: signElement,
      modality,
    }
  }

  // Host Gregory sits anchored at the center of the wheel
  sky.gregory = {
    key: 'gregory',
    planet: 'Host Anchor',
    sign: sky.sun.sign,
    degree: sky.sun.degree,
    degreeLabel: sky.sun.degreeLabel,
    absoluteDegree: sky.sun.absoluteDegree,
    dignity: 'domicile',
    retrograde: false,
    speed: sky.sun.speed,
    element: 'water',
    modality: sky.sun.modality,
  }

  // Compute all pairwise aspects with relative velocity symmetry
  const aspects: CouncilContextAspect[] = []
  const speakerAspects = {} as Record<BasketAgentKey, CouncilContextAspect[]>
  for (const key of [...CANONICAL_KEYS, 'gregory'] as BasketAgentKey[]) {
    speakerAspects[key] = []
  }

  for (let i = 0; i < CANONICAL_KEYS.length; i++) {
    const keyA = CANONICAL_KEYS[i]
    const bodyA = sky[keyA]

    for (let j = i + 1; j < CANONICAL_KEYS.length; j++) {
      const keyB = CANONICAL_KEYS[j]
      const bodyB = sky[keyB]

      const hit = detectAspect(bodyA.absoluteDegree, bodyB.absoluteDegree, bodyA.speed, bodyB.speed)

      if (!hit) continue

      const aspectRecord: CouncilContextAspect = {
        bodyA: keyA,
        bodyB: keyB,
        aspectName: hit.name,
        angle: hit.definition.angle,
        orb: hit.orb,
        phase: hit.phase,
        quality: hit.quality,
        major: hit.definition.major,
      }

      aspects.push(aspectRecord)
      speakerAspects[keyA].push(aspectRecord)
      speakerAspects[keyB].push(aspectRecord)
    }
  }

  // Sort speaker aspects tightest orb first
  for (const key of CANONICAL_KEYS) {
    speakerAspects[key].sort((a, b) => a.orb - b.orb)
  }

  return {
    sky,
    aspects,
    speakerAspects,
    seekerInquiry: params.seekerInquiry,
    attachedNatalChart: params.attachedNatalChart,
    recentTurns: params.recentTurns || [],
    timestamp: date.toISOString(),
  }
}
