import { getPlanetaryDignity, getSignElement } from '@/lib/astrological-data'
import { getCurrentPlanetaryPositions } from '@/lib/calculate-transits'
import { getAllPlanetaryPositions } from '@/lib/swiss-ephemeris-service'
import { calculateThermodynamics } from '@/lib/thermodynamics/kalchm'
import {
  COUNCIL_PLANETS,
  type CanonicalSign,
  type CouncilPlanet,
  type ElementalKey,
  type ElementalSpectrum,
  type EphemerisQuality,
  type EphemerisSource,
  type ESMSBalance,
  type ShiftedRuler,
  type SolarAlignment,
  type SolarReturnPlanetPlacement,
  type SolarReturnSkySnapshot,
  type ThermodynamicState,
  type YearOverYearTelemetry,
} from './solar-return-types'

const TROPICAL_YEAR_MS = 365.242189 * 86_400_000
const MAX_SECANT_ITERATIONS = 8
const SECANT_CONVERGENCE_ARCMINUTES = 0.005
const CUSP_SNAPPING_ARCMINUTES = 0.1
const NOMINAL_DAILY_SOLAR_MOTION = 0.9856 / 86_400_000
const MAX_STEP_MS = 2 * 86_400_000

const SIGN_NAMES: readonly CanonicalSign[] = [
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

const FAST_RULERS: readonly CouncilPlanet[] = ['Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter']

interface AlchemyProfile {
  spirit: number
  essence: number
  matter: number
  substance: number
  elements: readonly ('Fire' | 'Water' | 'Air' | 'Earth')[]
  dignity: Partial<Record<CanonicalSign, number>>
}

const ALCHEMY_BY_PLANET: Record<CouncilPlanet, AlchemyProfile> = {
  Sun: {
    spirit: 1,
    essence: 0,
    matter: 0,
    substance: 0,
    elements: ['Fire'],
    dignity: { Leo: 1, Aries: 2, Aquarius: -1, Libra: -2 },
  },
  Moon: {
    spirit: 0,
    essence: 1,
    matter: 1,
    substance: 0,
    elements: ['Water'],
    dignity: { Cancer: 1, Taurus: 2, Capricorn: -1, Scorpio: -2 },
  },
  Mercury: {
    spirit: 1,
    essence: 0,
    matter: 0,
    substance: 1,
    elements: ['Air', 'Earth'],
    dignity: { Gemini: 1, Virgo: 3, Sagittarius: 1, Pisces: -3 },
  },
  Venus: {
    spirit: 0,
    essence: 1,
    matter: 1,
    substance: 0,
    elements: ['Water', 'Earth'],
    dignity: { Libra: 1, Taurus: 1, Pisces: 2, Aries: -1, Scorpio: -1, Virgo: -2 },
  },
  Mars: {
    spirit: 0,
    essence: 1,
    matter: 1,
    substance: 0,
    elements: ['Fire', 'Water'],
    dignity: { Aries: 1, Scorpio: 1, Capricorn: 2, Taurus: -1, Libra: -1, Cancer: -2 },
  },
  Jupiter: {
    spirit: 1,
    essence: 1,
    matter: 0,
    substance: 0,
    elements: ['Air', 'Fire'],
    dignity: { Pisces: 1, Sagittarius: 1, Cancer: 2, Gemini: -1, Virgo: -1, Capricorn: -2 },
  },
  Saturn: {
    spirit: 1,
    essence: 0,
    matter: 1,
    substance: 0,
    elements: ['Air', 'Earth'],
    dignity: { Aquarius: 1, Capricorn: 1, Libra: 2, Cancer: -1, Leo: -1, Aries: -2 },
  },
  Uranus: {
    spirit: 0,
    essence: 1,
    matter: 1,
    substance: 0,
    elements: ['Water', 'Air'],
    dignity: { Aquarius: 1, Scorpio: 2, Taurus: -3 },
  },
  Neptune: {
    spirit: 0,
    essence: 1,
    matter: 0,
    substance: 1,
    elements: ['Water'],
    dignity: { Pisces: 1, Cancer: 2, Virgo: -1, Capricorn: -2 },
  },
  Pluto: {
    spirit: 0,
    essence: 1,
    matter: 1,
    substance: 0,
    elements: ['Earth', 'Water'],
    dignity: { Scorpio: 1, Leo: 2, Taurus: -1, Aquarius: -2 },
  },
}

export function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/**
 * Continuous modular angular residual.
 * Normalizes difference to [-180, 180) to eliminate the 360° jump across the 0° Aries Vernal Equinox.
 */
export function angleDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180
}

export function longitudeToSignParts(lon: number): {
  sign: CanonicalSign
  degree: number
  minute: number
} {
  const norm = normalizeDegrees(lon)
  const signIndex = Math.min(11, Math.floor(norm / 30))
  const sign = SIGN_NAMES[signIndex] ?? 'Aries'
  const degFloat = norm - signIndex * 30
  const degree = Math.floor(degFloat)
  const minute = Math.min(59, Math.floor((degFloat - degree) * 60 + 1e-6))
  return { sign, degree, minute }
}

export function parseElementalKey(rawElement: string): ElementalKey {
  const lower = rawElement.toLowerCase()
  if (lower === 'fire') return 'fire'
  if (lower === 'water') return 'water'
  if (lower === 'earth') return 'earth'
  return 'air'
}

export function calculateElementalSpectrum(
  placements: Record<CouncilPlanet, SolarReturnPlanetPlacement>
): ElementalSpectrum {
  const counts = { fire: 0, water: 0, earth: 0, air: 0 }
  for (const planet of COUNCIL_PLANETS) {
    const pos = placements[planet]
    if (pos) {
      counts[pos.element] += 1
    }
  }
  const total = COUNCIL_PLANETS.length || 10
  return {
    ...counts,
    percentages: {
      fire: counts.fire / total,
      water: counts.water / total,
      earth: counts.earth / total,
      air: counts.air / total,
    },
  }
}

export function calculateESMSAndThermodynamics(
  placements: Record<CouncilPlanet, SolarReturnPlanetPlacement>
): {
  esms: ESMSBalance
  thermodynamics: ThermodynamicState
} {
  const esms: ESMSBalance = { spirit: 0, essence: 0, matter: 0, substance: 0 }
  const elements = { Fire: 0, Water: 0, Air: 0, Earth: 0 }

  for (const planet of COUNCIL_PLANETS) {
    const pos = placements[planet]
    if (!pos) continue
    const profile = ALCHEMY_BY_PLANET[planet]
    const dignityVal = profile.dignity[pos.sign] ?? 0
    const multiplier = 1 + Math.abs(dignityVal) * 0.1

    esms.spirit += profile.spirit * multiplier
    esms.essence += profile.essence * multiplier
    esms.matter += profile.matter * multiplier
    esms.substance += profile.substance * multiplier

    const signEl = getSignElement(pos.sign)
    if (signEl !== 'Unknown') {
      elements[signEl] += 1 + (profile.elements.includes(signEl) ? 1 : 0)
    }
  }

  const thermo = calculateThermodynamics({
    spirit: esms.spirit,
    essence: esms.essence,
    matter: esms.matter,
    substance: esms.substance,
    fire: elements.Fire,
    water: elements.Water,
    air: elements.Air,
    earth: elements.Earth,
  })

  return {
    esms,
    thermodynamics: {
      heat: thermo.heat,
      reactivity: thermo.reactivity,
      entropy: thermo.entropy,
      gregsEnergy: thermo.gregsEnergy,
    },
  }
}

export function identifyShiftedRulers(
  returnPlacements: Record<CouncilPlanet, SolarReturnPlanetPlacement>,
  referencePlacements: Record<CouncilPlanet, SolarReturnPlanetPlacement>
): ShiftedRuler[] {
  return FAST_RULERS.map(planet => {
    const fromSign = returnPlacements[planet].sign
    const toSign = referencePlacements[planet].sign
    return {
      planet,
      fromSign,
      toSign,
      shifted: fromSign !== toSign,
    }
  })
}

export interface SecantSolverResult {
  returnTimestamp: number
  finalDeltaArcminutes: number
  iterations: number
}

/**
 * Two-point bounded continuous modular Secant root-finding solver.
 * Finds the exact historical return moment ~365.242 days prior targeting |Δ| < 0.005'.
 */
export async function solveSolarReturnTimestamp(params: {
  targetLongitude: number
  referenceDate: Date
  evaluateSunLongitude: (date: Date) => Promise<number>
}): Promise<SecantSolverResult> {
  const { targetLongitude, referenceDate, evaluateSunLongitude } = params

  let t0 = referenceDate.getTime() - TROPICAL_YEAR_MS
  let f0 = angleDelta(await evaluateSunLongitude(new Date(t0)), targetLongitude)

  if (Math.abs(f0 * 60) <= SECANT_CONVERGENCE_ARCMINUTES) {
    return {
      returnTimestamp: t0,
      finalDeltaArcminutes: Math.abs(f0 * 60),
      iterations: 1,
    }
  }

  let t1 = t0 - f0 / NOMINAL_DAILY_SOLAR_MOTION
  let f1 = angleDelta(await evaluateSunLongitude(new Date(t1)), targetLongitude)
  let iterations = 2

  while (Math.abs(f1 * 60) > SECANT_CONVERGENCE_ARCMINUTES && iterations < MAX_SECANT_ITERATIONS) {
    const denom = f1 - f0
    if (Math.abs(denom) < 1e-12) {
      break
    }

    let deltaT = -f1 * ((t1 - t0) / denom)
    if (Math.abs(deltaT) > MAX_STEP_MS) {
      deltaT = Math.sign(deltaT) * MAX_STEP_MS
    }

    t0 = t1
    f0 = f1
    t1 = t1 + deltaT
    f1 = angleDelta(await evaluateSunLongitude(new Date(t1)), targetLongitude)
    iterations += 1
  }

  return {
    returnTimestamp: t1,
    finalDeltaArcminutes: Math.abs(f1 * 60),
    iterations,
  }
}

function defaultPlacement(planet: CouncilPlanet): SolarReturnPlanetPlacement {
  return {
    planet,
    sign: 'Aries',
    degree: 0,
    longitude: 0,
    retrograde: false,
    dignity: 'Peregrine',
    element: 'fire',
  }
}

/**
 * Builds standard SolarReturnPlanetPlacement records from raw position records.
 */
export function buildPlanetPlacements(
  rawPositions: Record<
    string,
    { sign: string; degree: number; longitude?: number; speed?: number; retrograde?: boolean }
  >
): Record<CouncilPlanet, SolarReturnPlanetPlacement> {
  const result: Record<CouncilPlanet, SolarReturnPlanetPlacement> = {
    Sun: defaultPlacement('Sun'),
    Moon: defaultPlacement('Moon'),
    Mercury: defaultPlacement('Mercury'),
    Venus: defaultPlacement('Venus'),
    Mars: defaultPlacement('Mars'),
    Jupiter: defaultPlacement('Jupiter'),
    Saturn: defaultPlacement('Saturn'),
    Uranus: defaultPlacement('Uranus'),
    Neptune: defaultPlacement('Neptune'),
    Pluto: defaultPlacement('Pluto'),
  }

  for (const planet of COUNCIL_PLANETS) {
    const raw = rawPositions[planet]
    const signIdx = SIGN_NAMES.findIndex(
      candidate => candidate.toLowerCase() === (raw?.sign ?? '').toLowerCase()
    )
    const safeSignIdx = signIdx >= 0 ? signIdx : 0
    const longitude = normalizeDegrees(
      typeof raw?.longitude === 'number'
        ? raw.longitude
        : typeof raw?.degree === 'number'
          ? safeSignIdx * 30 + raw.degree
          : 0
    )
    const parts = longitudeToSignParts(longitude)
    const dignity = getPlanetaryDignity(planet, parts.sign)
    const element = parseElementalKey(getSignElement(parts.sign))

    result[planet] = {
      planet,
      sign: parts.sign,
      degree: parts.degree + parts.minute / 60,
      longitude,
      speed: raw?.speed,
      retrograde: Boolean(raw?.retrograde),
      dignity,
      element,
    }
  }

  return result
}

export function snapSunCusp(
  returnPlacements: Record<CouncilPlanet, SolarReturnPlanetPlacement>,
  targetLongitude: number,
  deltaArcminutes: number
): void {
  if (deltaArcminutes < CUSP_SNAPPING_ARCMINUTES) {
    const targetParts = longitudeToSignParts(targetLongitude)
    const returnSun = returnPlacements.Sun
    if (
      returnSun.sign !== targetParts.sign ||
      Math.floor(returnSun.degree) !== targetParts.degree
    ) {
      returnSun.longitude = targetLongitude
      returnSun.sign = targetParts.sign
      returnSun.degree = targetParts.degree + targetParts.minute / 60
    }
  }
}

export function assembleYearOverYearTelemetry(params: {
  referenceDate: Date
  returnDate: Date
  referencePlacements: Record<CouncilPlanet, SolarReturnPlanetPlacement>
  returnPlacements: Record<CouncilPlanet, SolarReturnPlanetPlacement>
  deltaArcminutes: number
  source: EphemerisSource
  quality: EphemerisQuality
}): YearOverYearTelemetry {
  const {
    referenceDate,
    returnDate,
    referencePlacements,
    returnPlacements,
    deltaArcminutes,
    source,
    quality,
  } = params

  const targetLongitude = referencePlacements.Sun.longitude
  snapSunCusp(returnPlacements, targetLongitude, deltaArcminutes)

  const returnSunLon = returnPlacements.Sun.longitude
  const solarParts = longitudeToSignParts(targetLongitude)

  const solarAlignment: SolarAlignment = {
    targetLongitude,
    returnLongitude: returnSunLon,
    deltaArcminutes,
    exactMatch: deltaArcminutes < SECANT_CONVERGENCE_ARCMINUTES,
    sign: solarParts.sign,
    degree: solarParts.degree,
    minute: solarParts.minute,
  }

  const returnElements = calculateElementalSpectrum(returnPlacements)
  const refElements = calculateElementalSpectrum(referencePlacements)

  const returnAlch = calculateESMSAndThermodynamics(returnPlacements)
  const refAlch = calculateESMSAndThermodynamics(referencePlacements)

  const returnSky: SolarReturnSkySnapshot = {
    iso: returnDate.toISOString(),
    timestamp: returnDate.getTime(),
    source,
    quality,
    positions: returnPlacements,
    elements: returnElements,
    esms: returnAlch.esms,
    thermodynamics: returnAlch.thermodynamics,
  }

  const referenceSky: SolarReturnSkySnapshot = {
    iso: referenceDate.toISOString(),
    timestamp: referenceDate.getTime(),
    source,
    quality,
    positions: referencePlacements,
    elements: refElements,
    esms: refAlch.esms,
    thermodynamics: refAlch.thermodynamics,
  }

  const shiftedRulers = identifyShiftedRulers(returnPlacements, referencePlacements)

  return {
    solarAlignment,
    returnSky,
    referenceSky,
    shiftedRulers,
    elementalDeltas: {
      fire: returnElements.percentages.fire - refElements.percentages.fire,
      water: returnElements.percentages.water - refElements.percentages.water,
      earth: returnElements.percentages.earth - refElements.percentages.earth,
      air: returnElements.percentages.air - refElements.percentages.air,
    },
    esmsDeltas: {
      spirit: returnAlch.esms.spirit - refAlch.esms.spirit,
      essence: returnAlch.esms.essence - refAlch.esms.essence,
      matter: returnAlch.esms.matter - refAlch.esms.matter,
      substance: returnAlch.esms.substance - refAlch.esms.substance,
    },
    thermodynamicDeltas: {
      heat: returnAlch.thermodynamics.heat - refAlch.thermodynamics.heat,
      reactivity: returnAlch.thermodynamics.reactivity - refAlch.thermodynamics.reactivity,
    },
  }
}

/**
 * Resilient sky loader. Tries Swiss Ephemeris first; falls back gracefully
 * to local Keplerian calculator with explicit 'approximate' quality.
 */
export async function fetchSolarReturnSky(
  referenceDate: Date = new Date(),
  options?: { signal?: AbortSignal; preferSwiss?: boolean }
): Promise<YearOverYearTelemetry> {
  let useSwiss = options?.preferSwiss !== false
  let source: EphemerisSource = 'swiss-ephemeris'
  let quality: EphemerisQuality = 'verified'

  const getPositions = async (
    date: Date
  ): Promise<Record<CouncilPlanet, SolarReturnPlanetPlacement>> => {
    if (useSwiss) {
      try {
        const swiss = await getAllPlanetaryPositions(date, 0, 0, { signal: options?.signal })
        if (
          COUNCIL_PLANETS.every(
            planet => swiss[planet] && typeof swiss[planet].longitude === 'number'
          )
        ) {
          return buildPlanetPlacements(swiss)
        }
      } catch {
        useSwiss = false
        source = 'vsop87-approximation'
        quality = 'approximate'
      }
    }
    source = 'vsop87-approximation'
    quality = 'approximate'
    const fallback = getCurrentPlanetaryPositions(date, { requireComplete: true })
    return buildPlanetPlacements(fallback)
  }

  const referencePlacements = await getPositions(referenceDate)
  const targetLongitude = referencePlacements.Sun.longitude

  const solverResult = await solveSolarReturnTimestamp({
    targetLongitude,
    referenceDate,
    evaluateSunLongitude: async (date: Date) => {
      const pos = await getPositions(date)
      return pos.Sun.longitude
    },
  })

  const returnDate = new Date(solverResult.returnTimestamp)
  const returnPlacements = await getPositions(returnDate)

  return assembleYearOverYearTelemetry({
    referenceDate,
    returnDate,
    referencePlacements,
    returnPlacements,
    deltaArcminutes: solverResult.finalDeltaArcminutes,
    source,
    quality,
  })
}
