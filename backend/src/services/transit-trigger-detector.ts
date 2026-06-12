import { swissEphemerisService, type PlanetaryPosition } from './swiss-ephemeris.js'

export type ElementName = 'Fire' | 'Earth' | 'Air' | 'Water'

export interface SkyPlacement {
  planet: string
  longitude: number
  sign: string
  degree: number
  element: ElementName
  speed?: number
}

export interface LunarState {
  phaseName: string
  phaseAngle: number
  illumination: number
  moon: SkyPlacement
}

export interface SkyContext {
  evaluatedAt: Date
  positions: Record<string, SkyPlacement>
  lunar: LunarState
}

export interface NatalPoint {
  label: string
  longitude: number
  sign?: string
  degree?: number
}

export interface TransitTrigger {
  type: 'lunar_phase' | 'transit_conjunction'
  summary: string
  strength: number
  transitingPlanet?: string
  natalPoint?: string
  orb?: number
  lunarPhase?: string
  moonSign?: string
  moonElement?: ElementName
}

const SIGNS = [
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
] as const

const SIGN_ELEMENTS: Record<string, ElementName> = {
  Aries: 'Fire',
  Leo: 'Fire',
  Sagittarius: 'Fire',
  Taurus: 'Earth',
  Virgo: 'Earth',
  Capricorn: 'Earth',
  Gemini: 'Air',
  Libra: 'Air',
  Aquarius: 'Air',
  Cancer: 'Water',
  Scorpio: 'Water',
  Pisces: 'Water',
}

const PLANETS_FOR_ACTIONS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']

function normalizeDegrees(value: number): number {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b)) % 360
  return diff > 180 ? 360 - diff : diff
}

function placementFromLongitude(planet: string, position: PlanetaryPosition): SkyPlacement {
  const longitude = normalizeDegrees(position.longitude)
  const signIndex = Math.floor(longitude / 30)
  const sign = SIGNS[signIndex] || 'Aries'

  return {
    planet,
    longitude,
    sign,
    degree: longitude % 30,
    element: SIGN_ELEMENTS[sign],
    speed: position.speed,
  }
}

function getMoonPhaseName(phaseAngle: number): string {
  if (phaseAngle < 22.5 || phaseAngle >= 337.5) return 'New Moon'
  if (phaseAngle < 67.5) return 'Waxing Crescent'
  if (phaseAngle < 112.5) return 'First Quarter'
  if (phaseAngle < 157.5) return 'Waxing Gibbous'
  if (phaseAngle < 202.5) return 'Full Moon'
  if (phaseAngle < 247.5) return 'Waning Gibbous'
  if (phaseAngle < 292.5) return 'Last Quarter'
  return 'Waning Crescent'
}

function calculateLunarState(positions: Record<string, SkyPlacement>): LunarState {
  const sun = positions.sun
  const moon = positions.moon
  const phaseAngle = normalizeDegrees(moon.longitude - sun.longitude)
  const illumination = (1 - Math.cos((phaseAngle * Math.PI) / 180)) / 2

  return {
    phaseName: getMoonPhaseName(phaseAngle),
    phaseAngle,
    illumination,
    moon,
  }
}

export function degreesFromSign(sign: string, degree: number): number | null {
  const signIndex = SIGNS.findIndex(s => s.toLowerCase() === sign.toLowerCase())
  if (signIndex < 0 || !Number.isFinite(degree)) return null
  return normalizeDegrees(signIndex * 30 + degree)
}

export function getSignElement(sign: string): ElementName {
  return SIGN_ELEMENTS[sign] || 'Fire'
}

export function extractNatalPoint(natalChart: any, label: string): NatalPoint | null {
  const lowerLabel = label.toLowerCase()

  if (lowerLabel === 'ascendant') {
    const ascendant = Number(natalChart?.ascendant ?? natalChart?.houses?.ASC)
    if (Number.isFinite(ascendant)) {
      return {
        label: 'Ascendant',
        longitude: normalizeDegrees(ascendant),
      }
    }
  }

  const planets = natalChart?.planets || natalChart
  const placement = planets?.[label] || planets?.[lowerLabel]
  if (!placement) return null

  const longitude = Number(placement.longitude)
  if (Number.isFinite(longitude)) {
    return {
      label,
      longitude: normalizeDegrees(longitude),
      sign: placement.sign,
      degree: Number(placement.degree),
    }
  }

  const degree = Number(placement.degree)
  if (placement.sign && Number.isFinite(degree)) {
    const absolute = degreesFromSign(String(placement.sign), degree)
    if (absolute !== null) {
      return {
        label,
        longitude: absolute,
        sign: placement.sign,
        degree,
      }
    }
  }

  return null
}

export function buildSkyContext(date: Date = new Date()): SkyContext {
  const rawPositions = swissEphemerisService.getPlanetaryPositions(date, PLANETS_FOR_ACTIONS)
  const positions: Record<string, SkyPlacement> = {}

  for (const [planet, position] of Object.entries(rawPositions)) {
    positions[planet] = placementFromLongitude(planet, position)
  }

  if (!positions.sun || !positions.moon) {
    throw new Error('Current sky calculation did not return Sun and Moon positions')
  }

  return {
    evaluatedAt: date,
    positions,
    lunar: calculateLunarState(positions),
  }
}

export function detectTransitTriggers(
  natalChart: any,
  sky: SkyContext,
  options: { conjunctionOrb?: number } = {}
): TransitTrigger[] {
  const conjunctionOrb = options.conjunctionOrb ?? 3
  const triggers: TransitTrigger[] = []

  triggers.push({
    type: 'lunar_phase',
    summary: `${sky.lunar.phaseName} in ${sky.lunar.moon.sign}`,
    strength:
      sky.lunar.phaseName === 'New Moon' || sky.lunar.phaseName === 'Full Moon' ? 0.75 : 0.45,
    lunarPhase: sky.lunar.phaseName,
    moonSign: sky.lunar.moon.sign,
    moonElement: sky.lunar.moon.element,
  })

  const natalPoints = [
    extractNatalPoint(natalChart, 'Sun'),
    extractNatalPoint(natalChart, 'Ascendant'),
  ].filter((point): point is NatalPoint => Boolean(point))

  for (const natalPoint of natalPoints) {
    for (const [planet, placement] of Object.entries(sky.positions)) {
      if (planet === 'moon' && natalPoint.label === 'Ascendant') continue

      const orb = angularDistance(placement.longitude, natalPoint.longitude)
      if (orb > conjunctionOrb) continue

      const planetName = planet.charAt(0).toUpperCase() + planet.slice(1)
      const exactness = 1 - orb / conjunctionOrb
      triggers.push({
        type: 'transit_conjunction',
        summary: `${planetName} conjunct Natal ${natalPoint.label}`,
        strength: 0.65 + exactness * 0.35,
        transitingPlanet: planetName,
        natalPoint: natalPoint.label,
        orb,
      })
    }
  }

  return triggers
}

export const transitTriggerDetector = {
  buildSkyContext,
  detectTransitTriggers,
  extractNatalPoint,
}
