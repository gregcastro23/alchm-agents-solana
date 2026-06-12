import { getPlanetaryDignity, getSignElement, getPlanetaryElement } from '../astrological-data'

export interface PlanetaryAgentStats {
  power: number
  resonance: number
  wisdom: number
  charisma: number
  intuition: number
  adaptability: number
  vitality: number
  overall: number
  dominantAlchemical: 'spirit' | 'essence' | 'matter' | 'substance'
  alchemicalContributions: {
    spirit: number
    essence: number
    matter: number
    substance: number
  }
}

// Base stats for each planet based on archetypal character
const PLANET_BASE_PROFILES: Record<
  string,
  {
    stats: Omit<PlanetaryAgentStats, 'overall' | 'dominantAlchemical' | 'alchemicalContributions'>
    alchemical: { spirit: number; essence: number; matter: number; substance: number }
  }
> = {
  Sun: {
    stats: {
      power: 85,
      resonance: 60,
      wisdom: 70,
      charisma: 80,
      intuition: 50,
      adaptability: 60,
      vitality: 80,
    },
    alchemical: { spirit: 0.8, essence: 0.2, matter: 0.4, substance: 0.3 },
  },
  Moon: {
    stats: {
      power: 60,
      resonance: 80,
      wisdom: 65,
      charisma: 70,
      intuition: 90,
      adaptability: 75,
      vitality: 70,
    },
    alchemical: { spirit: 0.2, essence: 0.9, matter: 0.3, substance: 0.5 },
  },
  Mercury: {
    stats: {
      power: 55,
      resonance: 65,
      wisdom: 80,
      charisma: 75,
      intuition: 60,
      adaptability: 85,
      vitality: 65,
    },
    alchemical: { spirit: 0.4, essence: 0.3, matter: 0.2, substance: 0.9 },
  },
  Venus: {
    stats: {
      power: 65,
      resonance: 85,
      wisdom: 70,
      charisma: 90,
      intuition: 75,
      adaptability: 70,
      vitality: 75,
    },
    alchemical: { spirit: 0.5, essence: 0.8, matter: 0.6, substance: 0.4 },
  },
  Mars: {
    stats: {
      power: 90,
      resonance: 50,
      wisdom: 55,
      charisma: 65,
      intuition: 60,
      adaptability: 65,
      vitality: 85,
    },
    alchemical: { spirit: 0.9, essence: 0.2, matter: 0.7, substance: 0.3 },
  },
  Jupiter: {
    stats: {
      power: 75,
      resonance: 75,
      wisdom: 90,
      charisma: 80,
      intuition: 70,
      adaptability: 75,
      vitality: 75,
    },
    alchemical: { spirit: 0.7, essence: 0.5, matter: 0.4, substance: 0.8 },
  },
  Saturn: {
    stats: {
      power: 70,
      resonance: 50,
      wisdom: 85,
      charisma: 55,
      intuition: 60,
      adaptability: 50,
      vitality: 80,
    },
    alchemical: { spirit: 0.3, essence: 0.4, matter: 0.9, substance: 0.2 },
  },
  Uranus: {
    stats: {
      power: 80,
      resonance: 65,
      wisdom: 75,
      charisma: 60,
      intuition: 85,
      adaptability: 90,
      vitality: 70,
    },
    alchemical: { spirit: 0.6, essence: 0.4, matter: 0.2, substance: 0.9 },
  },
  Neptune: {
    stats: {
      power: 65,
      resonance: 90,
      wisdom: 80,
      charisma: 75,
      intuition: 95,
      adaptability: 85,
      vitality: 55,
    },
    alchemical: { spirit: 0.4, essence: 0.9, matter: 0.1, substance: 0.7 },
  },
  Pluto: {
    stats: {
      power: 95,
      resonance: 70,
      wisdom: 85,
      charisma: 65,
      intuition: 80,
      adaptability: 60,
      vitality: 85,
    },
    alchemical: { spirit: 0.8, essence: 0.6, matter: 0.9, substance: 0.4 },
  },
}

function clamp0100(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)))
}

export function getPlanetaryAgentStats(
  planet: string,
  sign: string,
  degree: number
): PlanetaryAgentStats {
  const profile = PLANET_BASE_PROFILES[planet] || PLANET_BASE_PROFILES['Sun']
  const stats = { ...profile.stats }
  const dignity = getPlanetaryDignity(planet, sign)
  const signElement = getSignElement(sign)

  // 1. Dignity modifier
  let dignityMod = 1.0
  if (dignity === 'domicile' || dignity === 'exaltation') dignityMod = 1.1
  else if (dignity === 'detriment' || dignity === 'fall') dignityMod = 0.9

  // 2. Degree modifier
  const isCritical = [0, 15, 29].some(crit => Math.abs(degree - crit) < 1)
  const degreeMod = isCritical ? 1.05 : 1.0

  // 3. Apply base modifiers
  const totalMod = dignityMod * degreeMod
  stats.power *= totalMod
  stats.resonance *= totalMod
  stats.wisdom *= totalMod
  stats.charisma *= totalMod
  stats.intuition *= totalMod
  stats.adaptability *= totalMod
  stats.vitality *= totalMod

  // 4. Element specific boosts
  if (signElement === 'Fire') {
    stats.power *= 1.15
    stats.charisma *= 1.1
  } else if (signElement === 'Water') {
    stats.intuition *= 1.15
    stats.resonance *= 1.1
  } else if (signElement === 'Air') {
    stats.adaptability *= 1.15
    stats.wisdom *= 1.1
  } else if (signElement === 'Earth') {
    stats.vitality *= 1.15
    stats.wisdom *= 1.1
  }

  // 5. Determine dominant alchemical
  const alchemical = { ...profile.alchemical }
  const maxAlchm = Math.max(
    alchemical.spirit,
    alchemical.essence,
    alchemical.matter,
    alchemical.substance
  )
  let dominantAlchemical: PlanetaryAgentStats['dominantAlchemical'] = 'spirit'
  if (alchemical.essence === maxAlchm) dominantAlchemical = 'essence'
  else if (alchemical.matter === maxAlchm) dominantAlchemical = 'matter'
  else if (alchemical.substance === maxAlchm) dominantAlchemical = 'substance'

  const clampedStats = {
    power: clamp0100(stats.power),
    resonance: clamp0100(stats.resonance),
    wisdom: clamp0100(stats.wisdom),
    charisma: clamp0100(stats.charisma),
    intuition: clamp0100(stats.intuition),
    adaptability: clamp0100(stats.adaptability),
    vitality: clamp0100(stats.vitality),
  }

  const overall = Math.round(
    0.25 * clampedStats.power +
      0.2 * clampedStats.wisdom +
      0.15 * clampedStats.charisma +
      0.15 * clampedStats.intuition +
      0.1 * clampedStats.adaptability +
      0.1 * clampedStats.vitality +
      0.05 * clampedStats.resonance
  )

  return {
    ...clampedStats,
    overall,
    dominantAlchemical,
    alchemicalContributions: alchemical,
  }
}
