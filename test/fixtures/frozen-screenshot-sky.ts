/**
 * Frozen Canonical Sky Fixture ("Screenshot Sky")
 *
 * Exact timestamp: 2026-09-09T22:00:00Z (6:00 PM EDT, Sept 9, 2026)
 * Calculation engine: VSOP87-Enhanced (lib/enhanced-astronomical-calculator.ts)
 *
 * This fixture freezes the live celestial state corresponding to the canonical
 * council dialogue screenshot. Sun in Virgo (17.24°), Moon at 1.40° Virgo,
 * Uranus in Gemini (5.70°), Saturn in Aries (13.21° Fall Retrograde),
 * Mars in Cancer (18.99° Fall), and Mercury in Virgo (28.71° Domicile/Exaltation).
 */

export interface FrozenSkyBody {
  planet: string
  sign: string
  degree: number
  degreeLabel: string
  longitude: number
  retrograde: boolean
  speed: number // Degrees per day (signed)
  dignity: 'domicile' | 'exaltation' | 'detriment' | 'fall' | 'peregrine'
  element: 'fire' | 'earth' | 'air' | 'water'
}

export const FROZEN_SCREENSHOT_SKY_TIMESTAMP = '2026-09-09T22:00:00Z'
export const FROZEN_SCREENSHOT_SKY_SOURCE = 'VSOP87-Enhanced'

export const FROZEN_SCREENSHOT_SKY: Record<string, FrozenSkyBody> = {
  Sun: {
    planet: 'Sun',
    sign: 'Virgo',
    degree: 17.24,
    degreeLabel: '17°',
    longitude: 167.2375,
    retrograde: false,
    speed: 0.9716,
    dignity: 'peregrine',
    element: 'earth',
  },
  Moon: {
    planet: 'Moon',
    sign: 'Virgo',
    degree: 1.4,
    degreeLabel: '1°',
    longitude: 151.4012,
    retrograde: false,
    speed: 14.0058,
    dignity: 'peregrine',
    element: 'earth',
  },
  Mercury: {
    planet: 'Mercury',
    sign: 'Virgo',
    degree: 28.71,
    degreeLabel: '28°',
    longitude: 178.7089,
    retrograde: false,
    speed: 1.7059,
    dignity: 'domicile',
    element: 'earth',
  },
  Venus: {
    planet: 'Venus',
    sign: 'Libra',
    degree: 29.72,
    degreeLabel: '29°',
    longitude: 209.7179,
    retrograde: false,
    speed: 0.6632,
    dignity: 'domicile',
    element: 'air',
  },
  Mars: {
    planet: 'Mars',
    sign: 'Cancer',
    degree: 18.99,
    degreeLabel: '18°',
    longitude: 108.9887,
    retrograde: false,
    speed: 0.6205,
    dignity: 'fall',
    element: 'water',
  },
  Jupiter: {
    planet: 'Jupiter',
    sign: 'Leo',
    degree: 15.57,
    degreeLabel: '15°',
    longitude: 135.5669,
    retrograde: false,
    speed: 0.2032,
    dignity: 'peregrine',
    element: 'fire',
  },
  Saturn: {
    planet: 'Saturn',
    sign: 'Aries',
    degree: 13.21,
    degreeLabel: '13°',
    longitude: 13.2093,
    retrograde: true,
    speed: -0.0662,
    dignity: 'fall',
    element: 'fire',
  },
  Uranus: {
    planet: 'Uranus',
    sign: 'Gemini',
    degree: 5.7,
    degreeLabel: '5°',
    longitude: 65.6957,
    retrograde: false,
    speed: 0.0007,
    dignity: 'peregrine',
    element: 'air',
  },
  Neptune: {
    planet: 'Neptune',
    sign: 'Aries',
    degree: 3.42,
    degreeLabel: '3°',
    longitude: 3.4208,
    retrograde: true,
    speed: -0.0264,
    dignity: 'peregrine',
    element: 'fire',
  },
  Pluto: {
    planet: 'Pluto',
    sign: 'Aquarius',
    degree: 3.35,
    degreeLabel: '3°',
    longitude: 303.3495,
    retrograde: true,
    speed: -0.0153,
    dignity: 'peregrine',
    element: 'air',
  },
}
