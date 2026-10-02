/** Public, JSON-serializable contract shared by the daily council and its two views. */
export { DAILY_COUNCIL_VERSION } from './council-version'
export const COUNCIL_PLANETS = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
] as const
export type CouncilPlanet = (typeof COUNCIL_PLANETS)[number]
export type CouncilPlanetKey = Lowercase<CouncilPlanet>
export type CouncilSpeakerKey = CouncilPlanetKey | 'gregory'

export interface DailySkyPosition {
  sign: string
  degree: number
  longitude: number
  speed?: number
  source: 'swiss-ephemeris' | 'vsop87-approximation'
  asOf: string
  retrograde: boolean
  dignity: string
  element: string
  modality: string
}

export interface DailySkyAspect {
  bodyA: CouncilPlanetKey
  bodyB: CouncilPlanetKey
  aspectName: string
  angle: number
  orb: number
  phase: 'applying' | 'separating' | 'exact' | 'unknown'
  quality: string
  major: boolean
}

export interface DailySkyEvidence {
  id: string
  kind: 'placement' | 'aspect' | 'lunar' | 'motion' | 'event' | 'overview'
  label: string
  bodyKeys: CouncilPlanetKey[]
  coverageIds: string[]
}

export interface DailySkyEvent {
  id: string
  type: 'sign_ingress' | 'station' | 'lunar_phase' | 'aspect_exact'
  at: string
  bodies: CouncilPlanetKey[]
  description: string
  evidenceId: string
}

export interface DailySkyBrief {
  id: string
  date: string
  timeZone: 'UTC'
  startAt: string
  endAt: string
  asOf: string
  source: 'swiss-ephemeris' | 'vsop87-approximation'
  quality: 'verified' | 'approximate'
  /** Canonical Titlecase planet keys. All ten bodies are required. */
  positions: Record<CouncilPlanet, DailySkyPosition>
  aspects: DailySkyAspect[]
  lunar: { phase: string; elongation: number; illumination: number; sign: string }
  events: DailySkyEvent[]
  evidence: DailySkyEvidence[]
  requiredCoverage: string[]
  warnings: string[]
  /** Differences between comparable consecutive UTC opening snapshots, not timed events. */
  changes?: { previousDate: string; items: string[] }
}

export interface DailyCouncilTurn {
  id: string
  speakerKey: CouncilSpeakerKey
  speakerName: string
  text: string
  newClaim: string
  speechAct: string
  usedEvidenceIds: string[]
  coverageIds: string[]
  targetTurnId?: string
  provenance: {
    source: 'model' | 'grounded_briefing'
    modelFamily?: 'fast' | 'substantive'
    latencyMs?: number
  }
}

export interface DailyCouncilEdition {
  schemaVersion: 1
  id: string
  date: string
  timeZone: 'UTC'
  title: string
  summary: string
  brief: DailySkyBrief
  turns: DailyCouncilTurn[]
  coveredTopics: string[]
  generatedAt: string
  generation: 'model' | 'mixed' | 'grounded_briefing'
  promptVersion: string
}

export interface DailyCouncilResponse {
  edition: DailyCouncilEdition | null
  previousEdition?: DailyCouncilEdition
  status: 'published' | 'briefing' | 'stale' | 'unavailable'
  message?: string
}
