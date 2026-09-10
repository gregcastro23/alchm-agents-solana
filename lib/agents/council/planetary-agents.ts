/**
 * Canonical Crafted Agents for the Ten Planetary Delegates
 *
 * Implements the canonical CraftedAgent interface (lib/agent-types.ts)
 * for all 10 planetary delegates in the Current Sky Council.
 *
 * Each planetary delegate is a first-class citizen resolving through
 * buildAgentContext(), ensuring unified persona generation, prompt caching,
 * and Sacred 7 consciousness derivation.
 */

import type { CraftedAgent, Element, Modality, ConsciousnessLevel } from '@/lib/agent-types'
import { PLANETARY_VOICES } from './planetary-personas'
import { PLANETARY_TRAITS, type Planet } from '@/lib/agents/planetary-traits'
import type { BasketAgentKey } from './council-context'

export const PLANETARY_DELEGATE_KEYS: BasketAgentKey[] = [
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

const PLANET_NAME_TO_KEY: Record<Planet, BasketAgentKey> = {
  Sun: 'sun',
  Moon: 'moon',
  Mercury: 'mercury',
  Venus: 'venus',
  Mars: 'mars',
  Jupiter: 'jupiter',
  Saturn: 'saturn',
  Uranus: 'uranus',
  Neptune: 'neptune',
  Pluto: 'pluto',
}

const PLANET_COLORS: Record<Planet, string> = {
  Sun: '#fbbf24',
  Moon: '#38bdf8',
  Mercury: '#34d399',
  Venus: '#f472b6',
  Mars: '#ef4444',
  Jupiter: '#a78bfa',
  Saturn: '#f59e0b',
  Uranus: '#22d3ee',
  Neptune: '#818cf8',
  Pluto: '#c084fc',
}

const PLANET_GLYPHS: Record<Planet, string> = {
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

function buildCanonicalPlanetaryAgent(planet: Planet): CraftedAgent {
  const key = PLANET_NAME_TO_KEY[planet]
  const voice = PLANETARY_VOICES[planet]
  const traits = PLANETARY_TRAITS[planet]
  const color = PLANET_COLORS[planet]
  const glyph = PLANET_GLYPHS[planet]

  const PLANET_ELEMENTS: Record<Planet, Element> = {
    Sun: 'Fire',
    Moon: 'Water',
    Mercury: 'Air',
    Venus: 'Air',
    Mars: 'Fire',
    Jupiter: 'Fire',
    Saturn: 'Earth',
    Uranus: 'Air',
    Neptune: 'Water',
    Pluto: 'Water',
  }

  const PLANET_MODALITIES: Record<Planet, Modality> = {
    Sun: 'Fixed',
    Moon: 'Cardinal',
    Mercury: 'Mutable',
    Venus: 'Fixed',
    Mars: 'Cardinal',
    Jupiter: 'Mutable',
    Saturn: 'Cardinal',
    Uranus: 'Fixed',
    Neptune: 'Mutable',
    Pluto: 'Fixed',
  }

  const dominantElement: Element = PLANET_ELEMENTS[planet] || 'Fire'
  const dominantModality: Modality = PLANET_MODALITIES[planet] || 'Fixed'

  const PLANET_RULERSHIPS: Record<Planet, string[]> = {
    Sun: ['Leo'],
    Moon: ['Cancer'],
    Mercury: ['Gemini', 'Virgo'],
    Venus: ['Taurus', 'Libra'],
    Mars: ['Aries', 'Scorpio'],
    Jupiter: ['Sagittarius', 'Pisces'],
    Saturn: ['Capricorn', 'Aquarius'],
    Uranus: ['Aquarius'],
    Neptune: ['Pisces'],
    Pluto: ['Scorpio'],
  }

  const rulership = PLANET_RULERSHIPS[planet] || ['Aries']

  return {
    id: key,
    name: planet,
    title: voice.title,
    era: 'Cosmic / Celestial',
    specialization: `${planet} Transit Vector · Planetary Degree Council`,
    appearance: {
      avatar: '',
      color,
      symbol: glyph,
      aura: { type: 'stellar', color, intensity: 0.9 },
    },
    birthData: {
      date: new Date('2024-01-01T00:00:00Z'),
      time: '00:00',
      location: { lat: 0, lon: 0, name: `${planet} Celestial Sphere` },
    },
    consciousness: {
      natalChart: {
        planets: {
          [planet]: { sign: rulership[0], degree: 0, retrograde: false, house: 1 },
        } as any,
        houses: { ASC: 0, MC: 90 },
        aspects: [],
        ascendant: 0,
        midheaven: 90,
      },
      monicaConstant: 1.0,
      level: 'Illuminated' as ConsciousnessLevel,
      dominantElement,
      dominantModality,
      signature: `CELESTIAL-COUNCIL-${planet.toUpperCase()}`,
    },
    coreBeliefs: [
      `Contests: ${voice.contests}`,
      `Avoids: ${voice.avoids}`,
      `Dynamic tension with: ${voice.tensionWith.join(', ')}`,
      `Harmonic affinity with: ${voice.affinityWith.join(', ')}`,
    ],
    quotes: [voice.stance, `Contests: ${voice.contests}`, voice.texture],
    personality: {
      core: {
        essence: voice.stance,
        expression: voice.texture,
        emotion: `Governed by ${rulership.join(' & ')}`,
      },
      traits: [voice.stance, voice.texture],
      gifts: [
        {
          type: `${planet} Discernment`,
          description: voice.stance,
          expression: voice.texture,
        },
      ],
      shadows: [
        {
          type: `${planet} Contestation`,
          description: voice.contests,
          transformationPath: `Avoid ${voice.avoids}`,
        },
      ],
      currentMood: 'mystically-attuned',
      evolutionStage: 3,
    },
    abilities: {
      specialty: `${planet} Discourse & Celestial Transit Geometry`,
      wisdomDomains: [
        'Celestial Mechanics',
        'Orbital Geometry',
        'Hermetic Alchemy',
        'Transit Dynamics',
      ],
      teachingStyle: voice.texture,
      resonanceType: 'Philosophical',
      uniquePower: voice.stance,
    },
    stats: {
      conversations: 0,
      wisdomShared: 0,
      resonanceScore: 100,
      evolutionPoints: 0,
      lastActive: new Date(),
      kineticEvolution: {
        consciousnessVelocity: 1.0,
        interactionMomentum: 1.0,
        evolutionTrajectory: 'ascending',
        powerLevelUnlocks: [],
        optimalInteractionHours: [],
        aspectSensitivityGrowth: 1.0,
        memoryPersistence: 1.0,
        lastKineticUpdate: new Date(),
      },
      qualityMetrics: {
        averageResponseDepth: 1.0,
        aspectInfluenceStrength: 1.0,
        temporalAlignment: 1.0,
        personalityEvolution: 1.0,
        kineticResonance: 1.0,
      },
    },
  }
}

export const PLANETARY_AGENTS: Record<BasketAgentKey, CraftedAgent> = {
  sun: buildCanonicalPlanetaryAgent('Sun'),
  moon: buildCanonicalPlanetaryAgent('Moon'),
  mercury: buildCanonicalPlanetaryAgent('Mercury'),
  venus: buildCanonicalPlanetaryAgent('Venus'),
  mars: buildCanonicalPlanetaryAgent('Mars'),
  jupiter: buildCanonicalPlanetaryAgent('Jupiter'),
  saturn: buildCanonicalPlanetaryAgent('Saturn'),
  uranus: buildCanonicalPlanetaryAgent('Uranus'),
  neptune: buildCanonicalPlanetaryAgent('Neptune'),
  pluto: buildCanonicalPlanetaryAgent('Pluto'),
  gregory: undefined as any, // Gregory is host in historical registry
}

export function getPlanetaryAgent(key: string): CraftedAgent | undefined {
  const lowered = key.toLowerCase().trim() as BasketAgentKey
  return PLANETARY_AGENTS[lowered]
}
