import {
  COUNCIL_PLANETS,
  type CouncilPlanet,
  type CouncilPlanetKey,
  type CouncilSpeakerKey,
} from './daily-council-types'
import { CANONICAL_SIGNS, type CanonicalSign, type SpeechAct } from './council-schema'

export { COUNCIL_PLANETS }
export type { CouncilPlanet, CouncilPlanetKey, CouncilSpeakerKey, CanonicalSign, SpeechAct }

export const SOLAR_RETURN_COUNCIL_VERSION = 'solar-return-council-v1'

export type EphemerisQuality = 'verified' | 'approximate'
export type EphemerisSource = 'swiss-ephemeris' | 'vsop87-approximation'

export type ElementalKey = 'fire' | 'water' | 'earth' | 'air'

export interface ElementalSpectrum {
  fire: number
  water: number
  earth: number
  air: number
  percentages: {
    fire: number
    water: number
    earth: number
    air: number
  }
}

export interface ESMSBalance {
  spirit: number
  essence: number
  matter: number
  substance: number
}

export interface ThermodynamicState {
  heat: number
  reactivity: number
  entropy: number
  gregsEnergy: number
}

export interface SolarReturnPlanetPlacement {
  planet: CouncilPlanet
  sign: CanonicalSign
  degree: number
  longitude: number
  speed?: number
  retrograde: boolean
  dignity: string
  element: ElementalKey
}

export interface SolarReturnSkySnapshot {
  iso: string
  timestamp: number
  source: EphemerisSource
  quality: EphemerisQuality
  positions: Record<CouncilPlanet, SolarReturnPlanetPlacement>
  elements: ElementalSpectrum
  esms: ESMSBalance
  thermodynamics: ThermodynamicState
}

export interface ShiftedRuler {
  planet: CouncilPlanet
  fromSign: CanonicalSign
  toSign: CanonicalSign
  shifted: boolean
}

export interface SolarAlignment {
  targetLongitude: number
  returnLongitude: number
  deltaArcminutes: number
  exactMatch: boolean
  sign: CanonicalSign
  degree: number
  minute: number
}

export interface YearOverYearTelemetry {
  solarAlignment: SolarAlignment
  returnSky: SolarReturnSkySnapshot
  referenceSky: SolarReturnSkySnapshot
  shiftedRulers: ShiftedRuler[]
  elementalDeltas: {
    fire: number
    water: number
    earth: number
    air: number
  }
  esmsDeltas: {
    spirit: number
    essence: number
    matter: number
    substance: number
  }
  thermodynamicDeltas: {
    heat: number
    reactivity: number
  }
}

export type SolarReturnTurnRole = 'opening' | 'integration' | 'planetary-reading' | 'closing'

export interface SolarReturnTurnProvenance {
  source: 'model' | 'grounded_briefing'
  modelFamily?: 'fast' | 'substantive'
  latencyMs?: number
}

export interface SolarReturnCouncilTurn {
  id: string
  speakerKey: CouncilSpeakerKey
  speakerName: string
  role: SolarReturnTurnRole
  text: string
  newClaim: string
  speechAct: SpeechAct
  usedEvidenceIds: string[]
  coverageIds: string[]
  targetTurnId?: string
  provenance: SolarReturnTurnProvenance
}

export interface SolarReturnCouncilEdition {
  schemaVersion: 1
  id: string
  date: string
  timeZone: 'UTC'
  title: string
  summary: string
  returnIso: string
  referenceIso: string
  quality: EphemerisQuality
  source: EphemerisSource
  telemetry: YearOverYearTelemetry
  turns: SolarReturnCouncilTurn[]
  coveredTopics: string[]
  generatedAt: string
  promptVersion: string
}

export interface SolarReturnCouncilResponse {
  status: 'published' | 'briefing' | 'stale' | 'unavailable'
  edition: SolarReturnCouncilEdition | null
  message?: string
}
