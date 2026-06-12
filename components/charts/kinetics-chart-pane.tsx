// Classical planetary sequence (Chaldean order)
const PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const

// Seasonal elemental base values [fire, water, air, earth] — Northern Hemisphere
const SEASON_BASES: Record<string, [number, number, number, number]> = {
  Spring: [0.6, 0.5, 0.7, 0.4],
  Summer: [0.85, 0.4, 0.65, 0.35],
  Autumn: [0.5, 0.65, 0.5, 0.7],
  Winter: [0.3, 0.7, 0.4, 0.8],
}

function clampUnit(v: number): number {
  return Math.max(0, Math.min(1, isFinite(v) ? v : 0))
}

function getSeason(month: number): string {
  if (month <= 1 || month === 11) return 'Winter'
  if (month <= 4) return 'Spring'
  if (month <= 7) return 'Summer'
  return 'Autumn'
}

export interface KineticMetrics {
  A: number // Alchemical Number
  SMES: {
    spirit: number
    matter: number
    essence: number
    substance: number
  }
  kinetic: {
    velocity: number
    momentum: number
    power: number
    inertia: number
  }
  consciousness: {
    resonance: number
    amplitude: number
    activation: number
  }
}

/**
 * Pure client-side kinetic calculation using:
 * - Chaldean planetary hours (current UTC hour mod 7)
 * - Seasonal elemental bases (month of year)
 * - Daily solar wave (sinusoidal peak at solar noon)
 * - Birth chart resonance bonus when birthInfo is provided
 *
 * Formulas mirror lib/alchemical-kinetics.ts:
 *   Velocity (Celeritas)  — Mercury principle; rate of elemental transformation
 *   Inertia (Stabilitas)  — max(1, 1 + matter + earth + substance/2), normalized
 *   Momentum (Impetus)    — inertia × velocity, Mars/Saturn boosted
 *   Power (Potentia)      — solar principle; dEnergy/dt × solar amplification
 */
export function computeLocalKinetics(
  now: Date,
  birthInfo?: { year: number; month: number; day: number; hour: number; minute: number }
): KineticMetrics {
  const utcHour = now.getUTCHours()
  const utcMin = now.getUTCMinutes()
  const month = now.getUTCMonth() // 0-based

  const planetaryHour = PLANETS[utcHour % 7]
  const dayFraction = (utcHour + utcMin / 60) / 24
  const isNight = utcHour < 6 || utcHour >= 18

  // Solar wave: peaks at hour 12, troughs at midnight [0.15, 0.85]
  const solarWave = clampUnit(0.5 + 0.35 * Math.sin((dayFraction - 0.25) * 2 * Math.PI))

  const [bFire, bWater, bAir, bEarth] = SEASON_BASES[getSeason(month)]

  // Planetary velocity modifiers — from alchemical-kinetics.ts getPlanetaryVelocityModifier
  const modFire = planetaryHour === 'Sun' || planetaryHour === 'Mars' ? 1.2 : 1.0
  const modWater = planetaryHour === 'Moon' || planetaryHour === 'Venus' ? 1.15 : 1.0
  const modAir = planetaryHour === 'Mercury' ? 1.15 : 1.0
  const modEarth = planetaryHour === 'Saturn' ? 1.1 : 1.0

  const fire = clampUnit(bFire * modFire)
  const water = clampUnit(bWater * modWater)
  const air = clampUnit(bAir * modAir)
  const earth = clampUnit(bEarth * modEarth)

  // SMES — Spirit (Air/Fire active), Essence (Water fluid), Matter (Earth grounded), Substance (Earth dense)
  const spirit = clampUnit(air * 0.55 + fire * 0.35 + solarWave * 0.1)
  const essence = clampUnit(water * 0.7 + air * 0.2 + (isNight ? 0.08 : 0))
  const matter = clampUnit(earth * 0.8 + water * 0.12 + 0.05)
  const substance = clampUnit(earth * 0.55 + fire * 0.25 + water * 0.12 + 0.08)

  // Velocity (Celeritas) — Mercury principle; peaks in Mercury/Sun hours
  const velMod = planetaryHour === 'Mercury' ? 1.2 : planetaryHour === 'Sun' ? 1.1 : 1.0
  const velocity = clampUnit(solarWave * velMod * (spirit + essence) * 0.55)

  // Inertia (Stabilitas) — m(t) = max(1, 1 + matter + earth + substance/2), normalized [1,3]→[0,1]
  const inertiaMod = planetaryHour === 'Saturn' ? 1.1 : 1.0
  const rawInertia = (1 + matter + earth + substance * 0.5) * inertiaMod
  const inertia = clampUnit((rawInertia - 1) / 2.5)

  // Momentum (Impetus) — p = m × v, Mars/Saturn synthesis boost
  const momMod = planetaryHour === 'Mars' || planetaryHour === 'Saturn' ? 1.15 : 1.0
  const momentum = clampUnit(inertia * velocity * momMod * 1.6)

  // Power (Potentia) — Solar principle; dEnergy/dt × solar amplification (+30% on Sun hour)
  const solarAmp = planetaryHour === 'Sun' ? 1.3 : 1.0
  const power = clampUnit(solarWave * solarAmp * (spirit * 0.4 + fire * 0.35 + air * 0.25))

  // Alchemical Number: composite of all four kinetics, range [0, 2]
  const A = ((velocity + momentum + power + inertia) / 4) * 2

  // Consciousness — derived from active elemental resonance
  let resonance = clampUnit(spirit * 0.4 + power * 0.35 + solarWave * 0.25)
  let amplitude = clampUnit((spirit + essence + power + fire) / 4)
  let activation = clampUnit(velocity * 0.45 + momentum * 0.3 + power * 0.25)

  // Birth chart resonance: matching planetary hour and season amplify all three
  if (birthInfo) {
    const birthPlanet = PLANETS[birthInfo.hour % 7]
    const birthSeason = getSeason(birthInfo.month)
    const hourBonus = birthPlanet === planetaryHour ? 0.12 : 0
    const seasonBonus = birthSeason === getSeason(month) ? 0.08 : 0
    resonance = clampUnit(resonance + hourBonus + seasonBonus)
    amplitude = clampUnit(amplitude + hourBonus * 0.5)
    activation = clampUnit(activation + hourBonus * 0.4)
  }

  return {
    A,
    SMES: { spirit, matter, essence, substance },
    kinetic: { velocity, momentum, power, inertia },
    consciousness: { resonance, amplitude, activation },
  }
}
