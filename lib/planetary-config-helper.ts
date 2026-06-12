// Planetary Configuration Helper for Unified Chat
// Converts MultiAgentChat planetary configs to unified format

import type { PlanetaryConfig } from './unified-agent-types'
import type { Element } from './agent-types'
import { getSignElement, getPlanetaryDignity } from './astrological-data'
import { calculateMoonPhase, getMoonDegree } from './moon-phase-calculator'

export type { PlanetaryConfig } from './unified-agent-types'

export const PLANET_SYMBOLS: Record<string, string> = {
  Sun: '☉',
  Moon: '☽',
  Mercury: '☿',
  Venus: '♀',
  Mars: '♂',
  Jupiter: '♃',
  Saturn: '♄',
  Uranus: '♅',
  Neptune: '♆',
  Pluto: '♇',
}

export const PLANET_COLORS: Record<string, string> = {
  Sun: '#f59e0b',
  Moon: '#9ca3af',
  Mercury: '#f97316',
  Venus: '#ec4899',
  Mars: '#ef4444',
  Jupiter: '#8b5cf6',
  Saturn: '#4b5563',
  Uranus: '#06b6d4',
  Neptune: '#3b82f6',
  Pluto: '#1f2937',
}

export function createDefaultPlanetaryConfigs(): PlanetaryConfig[] {
  const currentMoonPhase = calculateMoonPhase(new Date())
  const currentMoonDegree = getMoonDegree(new Date())

  return [
    {
      planet: 'Sun',
      sign: 'Leo',
      degree: '15',
      dignity: getPlanetaryDignity('Sun', 'Leo'),
      element: getSignElement('Leo') as Element,
      color: PLANET_COLORS.Sun,
      symbol: PLANET_SYMBOLS.Sun,
      liveSkySync: true,
    },
    {
      planet: 'Moon',
      sign: 'Cancer',
      degree: '10',
      dignity: getPlanetaryDignity('Moon', 'Cancer'),
      element: getSignElement('Cancer') as Element,
      color: PLANET_COLORS.Moon,
      symbol: PLANET_SYMBOLS.Moon,
      moonPhase: currentMoonPhase,
      moonDegree: currentMoonDegree,
      liveSkySync: true,
    },
    {
      planet: 'Mercury',
      sign: 'Gemini',
      degree: '20',
      dignity: getPlanetaryDignity('Mercury', 'Gemini'),
      element: getSignElement('Gemini') as Element,
      color: PLANET_COLORS.Mercury,
      symbol: PLANET_SYMBOLS.Mercury,
      liveSkySync: true,
    },
    {
      planet: 'Venus',
      sign: 'Taurus',
      degree: '12',
      dignity: getPlanetaryDignity('Venus', 'Taurus'),
      element: getSignElement('Taurus') as Element,
      color: PLANET_COLORS.Venus,
      symbol: PLANET_SYMBOLS.Venus,
      liveSkySync: true,
    },
    {
      planet: 'Mars',
      sign: 'Aries',
      degree: '8',
      dignity: getPlanetaryDignity('Mars', 'Aries'),
      element: getSignElement('Aries') as Element,
      color: PLANET_COLORS.Mars,
      symbol: PLANET_SYMBOLS.Mars,
      liveSkySync: true,
    },
    {
      planet: 'Jupiter',
      sign: 'Sagittarius',
      degree: '25',
      dignity: getPlanetaryDignity('Jupiter', 'Sagittarius'),
      element: getSignElement('Sagittarius') as Element,
      color: PLANET_COLORS.Jupiter,
      symbol: PLANET_SYMBOLS.Jupiter,
      liveSkySync: true,
    },
    {
      planet: 'Saturn',
      sign: 'Capricorn',
      degree: '5',
      dignity: getPlanetaryDignity('Saturn', 'Capricorn'),
      element: getSignElement('Capricorn') as Element,
      color: PLANET_COLORS.Saturn,
      symbol: PLANET_SYMBOLS.Saturn,
      liveSkySync: true,
    },
    {
      planet: 'Uranus',
      sign: 'Aquarius',
      degree: '18',
      dignity: getPlanetaryDignity('Uranus', 'Aquarius'),
      element: getSignElement('Aquarius') as Element,
      color: PLANET_COLORS.Uranus,
      symbol: PLANET_SYMBOLS.Uranus,
      liveSkySync: true,
    },
    {
      planet: 'Neptune',
      sign: 'Pisces',
      degree: '22',
      dignity: getPlanetaryDignity('Neptune', 'Pisces'),
      element: getSignElement('Pisces') as Element,
      color: PLANET_COLORS.Neptune,
      symbol: PLANET_SYMBOLS.Neptune,
      liveSkySync: true,
    },
    {
      planet: 'Pluto',
      sign: 'Capricorn',
      degree: '28',
      dignity: getPlanetaryDignity('Pluto', 'Capricorn'),
      element: getSignElement('Capricorn') as Element,
      color: PLANET_COLORS.Pluto,
      symbol: PLANET_SYMBOLS.Pluto,
      liveSkySync: true,
    },
  ]
}

export function updatePlanetaryConfigWithLiveSky(
  config: PlanetaryConfig,
  planetaryPositions: any
): PlanetaryConfig {
  if (!config.liveSkySync || !planetaryPositions) {
    return config
  }

  let planetData: any = null
  if (Array.isArray(planetaryPositions)) {
    planetData = planetaryPositions.find(
      (p: any) => p.planet.toLowerCase() === config.planet.toLowerCase()
    )
  } else if (typeof planetaryPositions === 'object') {
    planetData = planetaryPositions[config.planet.toLowerCase()]
  }

  if (!planetData) {
    return config
  }

  return {
    ...config,
    sign: planetData.sign || config.sign,
    degree: planetData.degree?.toString() || config.degree,
    dignity: getPlanetaryDignity(config.planet, planetData.sign || config.sign),
    element: getSignElement(planetData.sign || config.sign) as Element,
  }
}

export function getDefaultActivePlanets(): string[] {
  return ['Sun', 'Moon', 'Mercury']
}

export function convertLegacyAgentConfig(legacyConfig: any): PlanetaryConfig {
  return {
    planet: legacyConfig.planet,
    sign: legacyConfig.sign,
    degree: legacyConfig.degree,
    dignity: getPlanetaryDignity(legacyConfig.planet, legacyConfig.sign),
    element: getSignElement(legacyConfig.sign) as Element,
    color: legacyConfig.color || PLANET_COLORS[legacyConfig.planet] || '#6b7280',
    symbol: legacyConfig.symbol || PLANET_SYMBOLS[legacyConfig.planet] || '●',
    moonPhase: legacyConfig.moonPhase,
    moonDegree: legacyConfig.moonDegree,
    liveSkySync: false,
  }
}

export function getPlanetaryCouncilPresets(): Array<{
  id: string
  name: string
  description: string
  planets: string[]
  includeMonica: boolean
}> {
  return [
    {
      id: 'inner-planets',
      name: 'Inner Planets Council',
      description: 'Quick, responsive guidance from personal planets',
      planets: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'],
      includeMonica: false,
    },
    {
      id: 'classical-seven',
      name: 'Classical Seven',
      description: 'Traditional planetary wisdom with Monica as guide',
      planets: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'],
      includeMonica: true,
    },
    {
      id: 'outer-mysteries',
      name: 'Outer Mysteries',
      description: 'Transform through generational and transcendent energies',
      planets: ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'],
      includeMonica: true,
    },
    {
      id: 'elemental-balance',
      name: 'Elemental Balance',
      description: 'Fire, Earth, Air, Water - complete elemental perspective',
      planets: ['Mars', 'Saturn', 'Mercury', 'Moon'],
      includeMonica: false,
    },
    {
      id: 'consciousness-accelerator',
      name: 'Consciousness Accelerator',
      description: 'Maximum awareness expansion with Monica coordination',
      planets: ['Sun', 'Jupiter', 'Uranus', 'Neptune'],
      includeMonica: true,
    },
  ]
}
