/**
 * Frozen Canonical Sky Fixture ("Screenshot Sky")
 *
 * Exact timestamp: 2026-09-09T18:06:08Z
 * Calculation engine: VSOP87-Enhanced (lib/enhanced-astronomical-calculator.ts)
 *
 * This fixture freezes the live celestial state corresponding to the campaign
 * test scenarios. Sun is in Virgo, Uranus is in Gemini, Saturn is in Aries (Fall),
 * Mars is in Cancer (Fall), Mercury is in Virgo (Domicile/Exaltation), and
 * Moon is at 29° Leo ingressing into Virgo.
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

export const FROZEN_SCREENSHOT_SKY_TIMESTAMP = '2026-09-09T18:06:08Z'
export const FROZEN_SCREENSHOT_SKY_SOURCE = 'VSOP87-Enhanced'

export const FROZEN_SCREENSHOT_SKY: Record<string, FrozenSkyBody> = {
  Sun: {
    planet: 'Sun',
    sign: 'Virgo',
    degree: 17.08,
    degreeLabel: '17°',
    longitude: 167.0797,
    retrograde: false,
    speed: 0.9723,
    dignity: 'peregrine',
    element: 'earth',
  },
  Moon: {
    planet: 'Moon',
    sign: 'Leo',
    degree: 29.12,
    degreeLabel: '29°',
    longitude: 149.1235,
    retrograde: false,
    speed: 14.0374,
    dignity: 'peregrine',
    element: 'fire',
  },
  Mercury: {
    planet: 'Mercury',
    sign: 'Virgo',
    degree: 28.43,
    degreeLabel: '28°',
    longitude: 178.4316,
    retrograde: false,
    speed: 1.6421,
    dignity: 'domicile',
    element: 'earth',
  },
  Venus: {
    planet: 'Venus',
    sign: 'Libra',
    degree: 29.61,
    degreeLabel: '29°',
    longitude: 209.6099,
    retrograde: false,
    speed: 1.1534,
    dignity: 'domicile',
    element: 'air',
  },
  Mars: {
    planet: 'Mars',
    sign: 'Cancer',
    degree: 18.89,
    degreeLabel: '18°',
    longitude: 108.8879,
    retrograde: false,
    speed: 0.5982,
    dignity: 'fall',
    element: 'water',
  },
  Jupiter: {
    planet: 'Jupiter',
    sign: 'Leo',
    degree: 15.53,
    degreeLabel: '15°',
    longitude: 135.5339,
    retrograde: false,
    speed: 0.1764,
    dignity: 'peregrine',
    element: 'fire',
  },
  Saturn: {
    planet: 'Saturn',
    sign: 'Aries',
    degree: 13.22,
    degreeLabel: '13°',
    longitude: 13.2201,
    retrograde: true,
    speed: -0.0412,
    dignity: 'fall',
    element: 'fire',
  },
  Uranus: {
    planet: 'Uranus',
    sign: 'Gemini',
    degree: 5.7,
    degreeLabel: '5°',
    longitude: 65.6955,
    retrograde: false,
    speed: 0.0215,
    dignity: 'peregrine',
    element: 'air',
  },
  Neptune: {
    planet: 'Neptune',
    sign: 'Aries',
    degree: 3.43,
    degreeLabel: '3°',
    longitude: 3.4251,
    retrograde: true,
    speed: -0.0128,
    dignity: 'peregrine',
    element: 'fire',
  },
  Pluto: {
    planet: 'Pluto',
    sign: 'Aquarius',
    degree: 3.35,
    degreeLabel: '3°',
    longitude: 303.352,
    retrograde: true,
    speed: -0.0095,
    dignity: 'peregrine',
    element: 'air',
  },
}
