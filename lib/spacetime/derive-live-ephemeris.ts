import type { AlchemicalQuantities, PlanetaryPosition } from '@/hooks/usePlanetaryPositions'
import { calculatePhiAxisIndex } from '@/lib/monica/monica-constant-validator'
import { calculateThermodynamics } from '@/lib/thermodynamics/kalchm'
import type { Ephemeris, Planet } from '@/lib/spacetime/generated/types'

/**
 * The pure half of the live ephemeris: SpacetimeDB `Ephemeris` rows → planetary positions,
 * alchemical quantities and thermodynamics. Split out of `hooks/useLiveEphemeris.ts`
 * (a `'use client'` module that pulls in React and the SpacetimeDB context) so server code,
 * such as the agent rating route, can derive the same numbers the board does — the Resonance
 * Surge anchors are calibrated against exactly this function. The hook re-exports both
 * functions, so existing imports are unchanged.
 */

type PlanetName = Planet['tag']
type Element = 'Fire' | 'Water' | 'Air' | 'Earth'

interface AlchemyProfile {
  spirit: number
  essence: number
  matter: number
  substance: number
  elements: readonly Element[]
  dignity: Partial<Record<(typeof ZODIAC_SIGNS)[number], number>>
}

const ZODIAC_SIGNS = [
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

const ELEMENT_BY_SIGN: Record<(typeof ZODIAC_SIGNS)[number], Element> = {
  Aries: 'Fire',
  Taurus: 'Earth',
  Gemini: 'Air',
  Cancer: 'Water',
  Leo: 'Fire',
  Virgo: 'Earth',
  Libra: 'Air',
  Scorpio: 'Water',
  Sagittarius: 'Fire',
  Capricorn: 'Earth',
  Aquarius: 'Air',
  Pisces: 'Water',
}

const PLANET_ORDER: PlanetName[] = [
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
]

const ALCHEMY_BY_PLANET: Record<PlanetName, AlchemyProfile> = {
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

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

export function raDecToEclipticLongitude(ra: number, dec: number): number {
  const raDegrees = Math.abs(ra) <= 24 ? ra * 15 : ra
  const rightAscension = (normalizeDegrees(raDegrees) * Math.PI) / 180
  const declination = (dec * Math.PI) / 180
  const obliquity = (23.43928 * Math.PI) / 180

  const longitude = Math.atan2(
    Math.sin(rightAscension) * Math.cos(obliquity) + Math.tan(declination) * Math.sin(obliquity),
    Math.cos(rightAscension)
  )

  return normalizeDegrees((longitude * 180) / Math.PI)
}

export function deriveLiveEphemeris(rows: readonly Ephemeris[]) {
  const elements: Record<Element, number> = { Fire: 0, Water: 0, Air: 0, Earth: 0 }
  const totals = { spirit: 0, essence: 0, matter: 0, substance: 0 }

  const planetaryPositions = rows
    .map(row => {
      const planet = row.body.tag
      const longitude = raDecToEclipticLongitude(row.ra, row.dec)
      const signIndex = Math.floor(longitude / 30) % ZODIAC_SIGNS.length
      const sign = ZODIAC_SIGNS[signIndex]
      const profile = ALCHEMY_BY_PLANET[planet]
      const dignity = profile.dignity[sign] ?? 0
      const multiplier = 1 + Math.abs(dignity) * 0.1
      const element = ELEMENT_BY_SIGN[sign]

      totals.spirit += profile.spirit * multiplier
      totals.essence += profile.essence * multiplier
      totals.matter += profile.matter * multiplier
      totals.substance += profile.substance * multiplier
      elements[element] += 1 + (profile.elements.includes(element) ? 1 : 0)

      return {
        planet,
        sign,
        degree: longitude % 30,
        retrograde: row.retrograde,
      } satisfies PlanetaryPosition
    })
    .sort(
      (left, right) =>
        PLANET_ORDER.indexOf(left.planet as PlanetName) -
        PLANET_ORDER.indexOf(right.planet as PlanetName)
    )

  const { heat, entropy, reactivity, gregsEnergy } = calculateThermodynamics({
    ...totals,
    fire: elements.Fire,
    water: elements.Water,
    air: elements.Air,
    earth: elements.Earth,
  })

  const alchmQuantities: AlchemicalQuantities = {
    ...totals,
    Heat: heat,
    Entropy: entropy,
    Reactivity: reactivity,
    Energy: gregsEnergy,
  }

  return {
    planetaryPositions,
    alchmQuantities,
    // Field name kept for the existing consumer contract; the value is the Phi Axis Index,
    // not the thermodynamic Monica (lib/thermodynamics/kalchm.ts).
    monicaConstant: calculatePhiAxisIndex(
      totals.spirit,
      totals.essence,
      totals.matter,
      totals.substance,
      elements.Fire,
      elements.Water,
      elements.Air,
      elements.Earth
    ),
  }
}
