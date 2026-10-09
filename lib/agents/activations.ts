import { calculateAllPlanets, type EnhancedBirthInfo } from '@/lib/enhanced-astronomical-calculator'
import {
  getPlanetaryDignity,
  getSignElement,
  getSignModality,
  getPlanetaryElement,
} from '@/lib/astrological-data'
import { getLunarDegreePersonality } from '@/lib/moon-phase-calculator'
import { parseDegreeAgentId } from '@/lib/agents/degree-agent'

export interface AgentActivationContract {
  agent: {
    id: string
    name: string
    description: string
  }
  strength: number
  dignity: string
  element: string
  planetaryRuler: string
  modality?: string
  exactDegree?: number
  absoluteDegree?: number
  sign?: string
  consciousness?: {
    level: string
    powerLevel: number
  }
}

const TRACKED_PLANETS = [
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

const BASE_DIGNITY_STRENGTH: Record<string, number> = {
  domicile: 0.95,
  exaltation: 0.9,
  triplicity: 0.78,
  term: 0.74,
  face: 0.72,
  peregrine: 0.68,
  detriment: 0.52,
  fall: 0.44,
}

function isCriticalDegree(sign: string, degree: number): boolean {
  const modality = getSignModality(sign)
  if (modality === 'Cardinal') return degree === 0 || degree === 13 || degree === 26
  if (modality === 'Fixed') return degree === 8 || degree === 21
  if (modality === 'Mutable') return degree === 4 || degree === 17
  return false
}

function calculateDegreeStrength(
  planet: string,
  sign: string,
  degree: number,
  dignity: string
): number {
  let strength = BASE_DIGNITY_STRENGTH[dignity] ?? 0.65

  // 0° Inception point bonus
  if (degree === 0) strength += 0.05
  // 29° Anaretic (degree of fate) urgency bonus
  else if (degree === 29) strength += 0.06
  // Critical degree amplification
  else if (isCriticalDegree(sign, degree)) strength += 0.03

  return Number(Math.max(0.1, Math.min(1.0, strength)).toFixed(4))
}

function deriveConsciousnessLevel(strength: number): string {
  if (strength >= 0.9) return 'Illuminated'
  if (strength >= 0.8) return 'Transcendent'
  if (strength >= 0.7) return 'Active'
  if (strength >= 0.5) return 'Awakening'
  return 'Dormant'
}

function dateToBirthInfo(date: Date): EnhancedBirthInfo {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    latitude: 0,
    longitude: 0,
    timezone: 'UTC',
  }
}

/**
 * Compute the active degree agents for a specific moment in time.
 * Only degree agents whose exact planet is currently located at that exact degree are active.
 */
export function computeActiveDegreeAgents(date: Date): AgentActivationContract[] {
  const birthInfo = dateToBirthInfo(date)
  const chart = calculateAllPlanets(birthInfo)
  const activations: AgentActivationContract[] = []

  for (const planet of TRACKED_PLANETS) {
    const pos = chart.planets[planet]
    if (!pos) continue

    const sign = pos.sign || 'Aries'
    const degree = Math.max(0, Math.min(29, Math.floor(pos.signDegree)))
    const absoluteDegree = Math.max(0, Math.min(359, Math.floor(pos.longitude)))
    const dignity = getPlanetaryDignity(planet, sign)
    const element =
      getSignElement(sign) === 'Unknown'
        ? getPlanetaryElement(planet) || 'Fire'
        : getSignElement(sign)
    const modality = getSignModality(sign)
    const strength = calculateDegreeStrength(planet, sign, degree, dignity)
    const level = deriveConsciousnessLevel(strength)

    const canonicalId = `planetary-${planet.toLowerCase()}-${sign.toLowerCase()}-${degree}`
    const displayName = `${planet} in ${sign} ${degree}°`

    let description = `${planet} transiting ${sign} at exact ${degree}° (${dignity}) — Active degree intelligence.`
    if (planet === 'Moon') {
      try {
        const lunarPersonality = getLunarDegreePersonality(absoluteDegree)
        description = `${lunarPersonality.phase} Moon in ${sign} at ${degree}° (${dignity}) — ${lunarPersonality.personality}`
      } catch {
        // fallback to standard description
      }
    }

    activations.push({
      agent: {
        id: canonicalId,
        name: displayName,
        description,
      },
      strength,
      dignity,
      element,
      planetaryRuler: planet,
      modality,
      exactDegree: degree,
      absoluteDegree,
      sign,
      consciousness: {
        level,
        powerLevel: Math.round(strength * 100),
      },
    })
  }

  // Sort by activation strength descending
  return activations.sort((a, b) => b.strength - a.strength)
}

/**
 * Returns currently active degree agents for the given date, capped by limit.
 * ONLY degree agents currently transited by their matching planet are returned.
 */
export async function getAgentActivations(
  date: Date,
  limit = 12
): Promise<AgentActivationContract[]> {
  const activations = computeActiveDegreeAgents(date)
  return activations.slice(0, limit)
}

/**
 * Synchronous/fallback activations returning the exact transiting degree agents.
 */
export function getFallbackAgentActivations(date: Date, limit = 12): AgentActivationContract[] {
  const activations = computeActiveDegreeAgents(date)
  return activations.slice(0, limit)
}

/**
 * Check if a specific degree agent is active at a given date.
 * A degree agent is ONLY active when that exact planet is transiting that exact degree.
 */
export function isDegreeAgentActive(agentId: string, date: Date = new Date()): boolean {
  const parsed = parseDegreeAgentId(agentId)
  if (!parsed) return false

  const activeAgents = computeActiveDegreeAgents(date)
  return activeAgents.some(a => a.agent.id.toLowerCase() === agentId.toLowerCase())
}

/**
 * Returns a map of absolute degrees (0-359) to active degree agents.
 * Degrees with no transiting planet are undefined (dormant).
 */
export function getActiveDegreeMap(
  date: Date = new Date()
): Record<number, AgentActivationContract> {
  const activeAgents = computeActiveDegreeAgents(date)
  const map: Record<number, AgentActivationContract> = {}
  for (const agent of activeAgents) {
    if (agent.absoluteDegree !== undefined) {
      map[agent.absoluteDegree] = agent
    }
  }
  return map
}
