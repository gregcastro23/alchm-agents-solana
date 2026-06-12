import { logger } from '../utils/logger.js'

// Core constants and engine extracted into a shared module

export const signs: Record<number, string> = {
  0: 'Aries',
  1: 'Taurus',
  2: 'Gemini',
  3: 'Cancer',
  4: 'Leo',
  5: 'Virgo',
  6: 'Libra',
  7: 'Scorpio',
  8: 'Sagittarius',
  9: 'Capricorn',
  10: 'Aquarius',
  11: 'Pisces',
}

export type ElementName = 'Fire' | 'Water' | 'Air' | 'Earth'

export type ElementTotals = Record<ElementName, number>

export interface AlchmInfo {
  [key: string]: any
}

export const planetInfo: Record<string, any> = {
  Sun: {
    'Dignity Effect': { Leo: 1, Aries: 2, Aquarius: -1, Libra: -2 },
    Elements: ['Fire', 'Fire'],
    Alchemy: { Spirit: 1, Essence: 0, Matter: 0, Substance: 0 },
    'Diurnal Element': 'Fire',
    'Nocturnal Element': 'Fire',
  },
  Moon: {
    'Dignity Effect': { Cancer: 1, Taurus: 2, Capricorn: -1, Scorpio: -2 },
    Elements: ['Water', 'Water'],
    Alchemy: { Spirit: 0, Essence: 1, Matter: 1, Substance: 0 },
    'Diurnal Element': 'Water',
    'Nocturnal Element': 'Water',
  },
  Mercury: {
    'Dignity Effect': { Gemini: 1, Virgo: 3, Sagittarius: 1, Pisces: -3 },
    Elements: ['Air', 'Earth'],
    Alchemy: { Spirit: 1, Essence: 0, Matter: 0, Substance: 1 },
    'Diurnal Element': 'Air',
    'Nocturnal Element': 'Earth',
  },
  Venus: {
    'Dignity Effect': { Libra: 1, Taurus: 1, Pisces: 2, Aries: -1, Scorpio: -1, Virgo: -2 },
    Elements: ['Water', 'Earth'],
    Alchemy: { Spirit: 0, Essence: 1, Matter: 1, Substance: 0 },
    'Diurnal Element': 'Water',
    'Nocturnal Element': 'Earth',
  },
  Mars: {
    'Dignity Effect': { Aries: 1, Scorpio: 1, Capricorn: 2, Taurus: -1, Libra: -1, Cancer: -2 },
    Elements: ['Fire', 'Water'],
    Alchemy: { Spirit: 0, Essence: 1, Matter: 1, Substance: 0 },
    'Diurnal Element': 'Fire',
    'Nocturnal Element': 'Water',
  },
  Jupiter: {
    'Dignity Effect': {
      Pisces: 1,
      Sagittarius: 1,
      Cancer: 2,
      Gemini: -1,
      Virgo: -1,
      Capricorn: -2,
    },
    Elements: ['Air', 'Fire'],
    Alchemy: { Spirit: 1, Essence: 1, Matter: 0, Substance: 0 },
    'Diurnal Element': 'Air',
    'Nocturnal Element': 'Fire',
  },
  Saturn: {
    'Dignity Effect': { Aquarius: 1, Capricorn: 1, Libra: 2, Cancer: -1, Leo: -1, Aries: -2 },
    Elements: ['Air', 'Earth'],
    Alchemy: { Spirit: 1, Essence: 0, Matter: 1, Substance: 0 },
    'Diurnal Element': 'Air',
    'Nocturnal Element': 'Earth',
  },
  Uranus: {
    'Dignity Effect': { Aquarius: 1, Scorpio: 2, Taurus: -3 },
    Elements: ['Water', 'Air'],
    Alchemy: { Spirit: 0, Essence: 1, Matter: 1, Substance: 0 },
    'Diurnal Element': 'Water',
    'Nocturnal Element': 'Air',
  },
  Neptune: {
    'Dignity Effect': { Pisces: 1, Cancer: 2, Virgo: -1, Capricorn: -2 },
    Elements: ['Water', 'Water'],
    Alchemy: { Spirit: 0, Essence: 1, Matter: 0, Substance: 1 },
    'Diurnal Element': 'Water',
    'Nocturnal Element': 'Water',
  },
  Pluto: {
    'Dignity Effect': { Scorpio: 1, Leo: 2, Taurus: -1, Aquarius: -2 },
    Elements: ['Earth', 'Water'],
    Alchemy: { Spirit: 0, Essence: 1, Matter: 1, Substance: 0 },
    'Diurnal Element': 'Earth',
    'Nocturnal Element': 'Water',
  },
  Ascendant: { 'Diurnal Element': 'Earth', 'Nocturnal Element': 'Earth' },
}

export const signInfo: Record<string, any> = {
  Aries: {
    Element: 'Fire',
    Start: { Day: 21, Month: 3, Year: 2022 },
    End: { Day: 19, Month: 4, Year: 2022 },
    'Major Tarot Card': 'The Emperor',
    'Minor Tarot Cards': {
      '1st Decan': '2 of Wands',
      '2nd Decan': '3 of Wands',
      '3rd Decan': '4 of Wands',
    },
    'Decan Effects': { '1st Decan': ['Mars'], '2nd Decan': ['Sun'], '3rd Decan': ['Venus'] },
    'Degree Effects': {
      Mercury: [15, 21],
      Venus: [7, 14],
      Mars: [22, 26],
      Jupiter: [1, 6],
      Saturn: [27, 30],
    },
    Ruler: 'Mars',
    Modality: 'Cardinal',
  },
  Taurus: {
    Element: 'Earth',
    Start: { Day: 20, Month: 4, Year: 2022 },
    End: { Day: 20, Month: 5, Year: 2022 },
    'Major Tarot Card': 'The Heirophant',
    'Minor Tarot Cards': {
      '1st Decan': '5 of Pentacles',
      '2nd Decan': '6 of Pentacles',
      '3rd Decan': '7 of Pentacles',
    },
    'Decan Effects': { '1st Decan': ['Mercury'], '2nd Decan': ['Moon'], '3rd Decan': ['Saturn'] },
    'Degree Effects': {
      Mercury: [9, 15],
      Venus: [1, 8],
      Mars: [27, 30],
      Jupiter: [16, 22],
      Saturn: [23, 26],
    },
    Ruler: 'Venus',
    Modality: 'Fixed',
  },
  Gemini: {
    Element: 'Air',
    Start: { Day: 21, Month: 5, Year: 2022 },
    End: { Day: 20, Month: 6, Year: 2022 },
    'Major Tarot Card': 'The Lovers',
    'Minor Tarot Cards': {
      '1st Decan': '8 of Swords',
      '2nd Decan': '9 of Swords',
      '3rd Decan': '10 of Swords',
    },
    'Decan Effects': {
      '1st Decan': ['Jupiter'],
      '2nd Decan': ['Mars'],
      '3rd Decan': ['Uranus', 'Sun'],
    },
    'Degree Effects': {
      Mercury: [1, 7],
      Venus: [15, 20],
      Mars: [26, 30],
      Jupiter: [8, 14],
      Saturn: [22, 25],
    },
    Ruler: 'Mercury',
    Modality: 'Mutable',
  },
  Cancer: {
    Element: 'Water',
    Start: { Day: 21, Month: 6, Year: 2022 },
    End: { Day: 22, Month: 7, Year: 2022 },
    'Major Tarot Card': 'The Chariot',
    'Minor Tarot Cards': {
      '1st Decan': '2 of Cups',
      '2nd Decan': '3 of Cups',
      '3rd Decan': '4 of Cups',
    },
    'Decan Effects': {
      '1st Decan': ['Venus'],
      '2nd Decan': ['Mercury', 'Pluto'],
      '3rd Decan': ['Neptune', 'Moon'],
    },
    'Degree Effects': {
      Mercury: [14, 20],
      Venus: [21, 27],
      Mars: [1, 6],
      Jupiter: [7, 13],
      Saturn: [28, 30],
    },
    Ruler: 'Moon',
    Modality: 'Cardinal',
  },
  Leo: {
    Element: 'Fire',
    Start: { Day: 23, Month: 7, Year: 2022 },
    End: { Day: 22, Month: 8, Year: 2022 },
    'Major Tarot Card': 'Strength',
    'Minor Tarot Cards': {
      '1st Decan': '5 of Wands',
      '2nd Decan': '6 of Wands',
      '3rd Decan': '7 of Wands',
    },
    'Decan Effects': { '1st Decan': ['Saturn'], '2nd Decan': ['Jupiter'], '3rd Decan': ['Mars'] },
    'Degree Effects': {
      Mercury: [7, 13],
      Venus: [14, 19],
      Mars: [26, 30],
      Jupiter: [20, 25],
      Saturn: [1, 6],
    },
    Ruler: 'Sun',
    Modality: 'Fixed',
  },
  Virgo: {
    Element: 'Earth',
    Start: { Day: 23, Month: 7, Year: 2022 },
    End: { Day: 22, Month: 8, Year: 2022 },
    'Major Tarot Card': 'The Hermit',
    'Minor Tarot Cards': {
      '1st Decan': '8 of Pentacles',
      '2nd Decan': '9 of Pentacles',
      '3rd Decan': '10 of Pentacles',
    },
    'Decan Effects': {
      '1st Decan': ['Mars', 'Sun'],
      '2nd Decan': ['Venus'],
      '3rd Decan': ['Mercury'],
    },
    'Degree Effects': {
      Mercury: [1, 7],
      Venus: [8, 13],
      Mars: [25, 30],
      Jupiter: [14, 18],
      Saturn: [19, 24],
    },
    Ruler: 'Mercury',
    Modality: 'Mutable',
  },
  Libra: {
    Element: 'Air',
    Start: { Day: 23, Month: 9, Year: 2022 },
    End: { Day: 22, Month: 10, Year: 2022 },
    'Major Tarot Card': 'Justice',
    'Minor Tarot Cards': {
      '1st Decan': '2 of Swords',
      '2nd Decan': '3 of Swords',
      '3rd Decan': '4 of Swords',
    },
    'Decan Effects': {
      '1st Decan': ['Moon'],
      '2nd Decan': ['Saturn', 'Uranus'],
      '3rd Decan': ['Jupiter'],
    },
    'Degree Effects': {
      Mercury: [20, 24],
      Venus: [7, 11],
      Mars: [],
      Jupiter: [12, 19],
      Saturn: [1, 6],
    },
    Ruler: 'Venus',
    Modality: 'Cardinal',
  },
  Scorpio: {
    Element: 'Water',
    Start: { Day: 23, Month: 10, Year: 2022 },
    End: { Day: 21, Month: 11, Year: 2022 },
    'Major Tarot Card': 'Death',
    'Minor Tarot Cards': {
      '1st Decan': '5 of Cups',
      '2nd Decan': '6 of Cups',
      '3rd Decan': '7 of Cups',
    },
    'Decan Effects': {
      '1st Decan': ['Pluto'],
      '2nd Decan': ['Neptune', 'Sun'],
      '3rd Decan': ['Venus'],
    },
    'Degree Effects': {
      Mercury: [22, 27],
      Venus: [15, 21],
      Mars: [1, 6],
      Jupiter: [7, 14],
      Saturn: [28, 30],
    },
    Ruler: 'Mars',
    Modality: 'Fixed',
  },
  Sagittarius: {
    Element: 'Fire',
    Start: { Day: 22, Month: 11, Year: 2022 },
    End: { Day: 21, Month: 12, Year: 2022 },
    'Major Tarot Card': 'Temperance',
    'Minor Tarot Cards': {
      '1st Decan': '8 of Wands',
      '2nd Decan': '9 of Wands',
      '3rd Decan': '10 of Wands',
    },
    'Decan Effects': { '1st Decan': ['Mercury'], '2nd Decan': ['Moon'], '3rd Decan': ['Saturn'] },
    'Degree Effects': {
      Mercury: [15, 20],
      Venus: [9, 14],
      Mars: [],
      Jupiter: [1, 8],
      Saturn: [21, 25],
    },
    Ruler: 'Jupiter',
    Modality: 'Mutable',
  },
  Capricorn: {
    Element: 'Earth',
    Start: { Day: 22, Month: 12, Year: 2022 },
    End: { Day: 19, Month: 1, Year: 2022 },
    'Major Tarot Card': 'The Devil',
    'Minor Tarot Cards': {
      '1st Decan': '2 of Pentacles',
      '2nd Decan': '3 of Pentacles',
      '3rd Decan': '4 of Pentacles',
    },
    'Decan Effects': { '1st Decan': ['Jupiter'], '2nd Decan': [], '3rd Decan': ['Sun'] },
    'Degree Effects': {
      Mercury: [7, 12],
      Venus: [1, 6],
      Mars: [],
      Jupiter: [13, 19],
      Saturn: [26, 30],
    },
    Ruler: 'Saturn',
    Modality: 'Cardinal',
  },
  Aquarius: {
    Element: 'Air',
    Start: { Day: 20, Month: 1, Year: 2022 },
    End: { Day: 18, Month: 2, Year: 2022 },
    'Major Tarot Card': 'The Star',
    'Minor Tarot Cards': {
      '1st Decan': '5 of Swords',
      '2nd Decan': '6 of Swords',
      '3rd Decan': '7 of Swords',
    },
    'Decan Effects': { '1st Decan': ['Uranus'], '2nd Decan': ['Mercury'], '3rd Decan': ['Moon'] },
    'Degree Effects': {
      Mercury: [],
      Venus: [13, 20],
      Mars: [26, 30],
      Jupiter: [21, 25],
      Saturn: [1, 6],
    },
    Ruler: 'Saturn',
    Modality: 'Fixed',
  },
  Pisces: {
    Element: 'Water',
    Start: { Day: 19, Month: 2, Year: 2022 },
    End: { Day: 20, Month: 3, Year: 2022 },
    'Major Tarot Card': 'The Moon',
    'Minor Tarot Cards': {
      '1st Decan': '8 of Cups',
      '2nd Decan': '9 of Cups',
      '3rd Decan': '10 of Cups',
    },
    'Decan Effects': {
      '1st Decan': ['Saturn', 'Neptune', 'Venus'],
      '2nd Decan': ['Jupiter'],
      '3rd Decan': ['Pisces', 'Mars'],
    },
    'Degree Effects': {
      Mercury: [15, 20],
      Venus: [1, 8],
      Mars: [21, 26],
      Jupiter: [9, 14],
      Saturn: [27, 30],
    },
    Ruler: 'Jupiter',
    Modality: 'Mutable',
  },
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function createElementObject(): ElementTotals {
  return { Fire: 0, Water: 0, Air: 0, Earth: 0 }
}

export function combineElementObjects(a: ElementTotals, b: ElementTotals): ElementTotals {
  return {
    Fire: a.Fire + b.Fire,
    Water: a.Water + b.Water,
    Air: a.Air + b.Air,
    Earth: a.Earth + b.Earth,
  }
}

export function getElementRanking(
  elementTotals: ElementTotals,
  rank: number = 1
): Record<number, ElementName | ''> {
  const elementRankings: Array<{ name: ElementName; value: number }> = [
    { name: 'Fire', value: elementTotals.Fire },
    { name: 'Water', value: elementTotals.Water },
    { name: 'Air', value: elementTotals.Air },
    { name: 'Earth', value: elementTotals.Earth },
  ]
  elementRankings.sort((x, y) => y.value - x.value)
  const dict: Record<number, ElementName | ''> = { 1: '', 2: '', 3: '', 4: '' }
  elementRankings.forEach((entry, idx) => {
    dict[idx + 1] = entry.name
  })
  return dict
}

export function getAbsoluteElementValue(elementTotals: ElementTotals): number {
  return elementTotals.Fire + elementTotals.Water + elementTotals.Air + elementTotals.Earth
}

// Full alchemize implementation ported from workspace rules
export function alchemize(birth_info: any, horoscope_dict: any): AlchmInfo {
  const horoscope = horoscope_dict['tropical']
  const silent_mode = false
  const celestialBodies = horoscope.CelestialBodies
  let diurnal_or_nocturnal = 'Diurnal'
  if (birth_info['hour'] < 5 || birth_info['hour'] > 17) {
    diurnal_or_nocturnal = 'Nocturnal'
  }
  const metadata: any = {}
  metadata.name = 'Alchm NFT'
  metadata.description =
    'Alchm is unlike any other NFT collection on Earth. Just like people, no two Alchm NFTs are the same, and there is no limit on how many can exist. Your Alchm NFT has no random features, and is completely customized and unique to you. By minting, you gain permanent access to limitless information about your astrology and identity through our sites and apps.'
  metadata.attributes = []
  const alchmInfo: any = {
    'Sun Sign': '',
    'Major Arcana': { Sun: '', Ascendant: '' },
    'Minor Arcana': { Decan: '', Cusp: 'None' },
    'Alchemy Effects': {
      'Total Spirit': 0,
      'Total Essence': 0,
      'Total Day Essence': 0,
      'Total Matter': 0,
      'Total Substance': 0,
      'Total Night Essence': 0,
    },
    'Chart Ruler': '',
    'Total Dignity Effect': createElementObject(),
    'Total Decan Effect': createElementObject(),
    'Total Degree Effect': createElementObject(),
    'Total Aspect Effect': createElementObject(),
    'Total Elemental Effect': createElementObject(),
    'Total Effect Value': createElementObject(),
    'Dominant Element': '',
    'Total Chart Absolute Effect': 0,
    Heat: 0,
    Entropy: 0,
    Reactivity: 0,
    Energy: 0,
    '# Cardinal': 0,
    '# Fixed': 0,
    '# Mutable': 0,
    '% Cardinal': 0,
    '% Fixed': 0,
    '% Mutable': 0,
    'Dominant Modality': '',
    'All Conjunctions': [],
    'All Trines': [],
    'All Squares': [],
    'All Oppositions': [],
    Stelliums: [],
    Signs: {
      Aries: {},
      Taurus: {},
      Gemini: {},
      Cancer: {},
      Leo: {},
      Virgo: {},
      Libra: {},
      Scorpio: {},
      Sagittarius: {},
      Capricorn: {},
      Aquarius: {},
      Pisces: {},
    },
    Planets: {
      Sun: {},
      Moon: {},
      Mercury: {},
      Venus: {},
      Mars: {},
      Jupiter: {},
      Saturn: {},
      Uranus: {},
      Neptune: {},
      Pluto: {},
      Ascendant: {},
    },
  }

  const rising_sign = horoscope.Ascendant['Sign']['label']
  ;(planetInfo as any)['Ascendant']['Diurnal Element'] = signInfo[rising_sign]['Element']
  ;(planetInfo as any)['Ascendant']['Nocturnal Element'] = signInfo[rising_sign]['Element']
  alchmInfo['Major Arcana']['Ascendant'] = signInfo[rising_sign]['Major Tarot Card']

  let planet: string, sign: string, house: string
  let entry: any, trait_type: string, value: string
  let sun_sign: string = ''
  let celestial_bodies_index = 0
  while (celestial_bodies_index < 11) {
    if (celestial_bodies_index === 10) {
      entry = horoscope.Ascendant
      planet = 'Ascendant'
    } else {
      entry = celestialBodies['all'][celestial_bodies_index]
      planet = entry['label']
    }
    alchmInfo['Planets'][planet]['Total Effect'] = createElementObject()
    if (!silent_mode) {
      // console.log('--- New Planet:', planet)
    }

    // Sign
    sign = entry['Sign']['label']
    alchmInfo['Planets'][planet]['Sign'] = sign
    if (planet === 'Sun') {
      trait_type = '"Sign" (Sun Sign)'
      sun_sign = sign
      alchmInfo['Sun Sign'] = sun_sign
      alchmInfo['Major Arcana']['Sun'] = signInfo[sun_sign]['Major Tarot Card']
      alchmInfo['Chart Ruler'] = signInfo[sun_sign]['Ruler']
    } else {
      trait_type = `${planet} Sign`
    }
    value = sign
    metadata.attributes.push({ trait_type, value })

    // Modality
    const modality = signInfo[sign]['Modality']
    alchmInfo['Planets'][planet]['Sign Modality'] = modality
    alchmInfo[`# ${modality}`] += 1

    // Diurnal and Nocturnal Elements
    alchmInfo['Planets'][planet]['Diurnal Element'] =
      `${signInfo[sign]['Element']} in ${planetInfo[planet]['Diurnal Element']}`
    alchmInfo['Planets'][planet]['Nocturnal Element'] =
      `${signInfo[sign]['Element']} in ${planetInfo[planet]['Nocturnal Element']}`

    // All planets but Ascendant
    if (planet !== 'Ascendant') {
      // House
      house = entry['House']['label']
      alchmInfo['Planets'][planet]['House'] = house
      trait_type = `${planet} House`
      value = house
      metadata.attributes.push({ trait_type, value })

      // Degree & Decan Calculation
      const degreeStr: string =
        celestialBodies[planet.toLowerCase()]['ChartPosition']['Ecliptic'][
          'ArcDegreesFormatted30'
        ].split('°')[0]
      const degree = Number(degreeStr)
      let decan_value: number, decan_string: string
      if (degreeStr.length === 1) {
        decan_value = 1
        decan_string = '1st Decan'
      } else {
        decan_value = Number(degreeStr[0]) + 1
        if (decan_value > 3) {
          decan_value = 3
        }
        if (decan_value === 2) {
          decan_string = '2nd Decan'
        } else {
          decan_string = '3rd Decan'
        }
      }
      alchmInfo['Planets'][planet]['Degree'] = degree
      alchmInfo['Planets'][planet]['Decan'] = decan_string

      // Dignity Effect
      const dignity_effect = createElementObject()
      const dignity_effect_value = planetInfo[planet]['Dignity Effect'][sign]
      if (dignity_effect_value) {
        if (Math.abs(dignity_effect_value) === 1 || Math.abs(dignity_effect_value) === 3) {
          dignity_effect[signInfo[sign]['Element']] = (1 *
            (dignity_effect_value / Math.abs(dignity_effect_value))) as number
        }
        if (Math.abs(dignity_effect_value) > 1) {
          dignity_effect[planetInfo[planet]['Diurnal Element']] +=
            1 * (dignity_effect_value / Math.abs(dignity_effect_value))
          dignity_effect[planetInfo[planet]['Nocturnal Element']] +=
            1 * (dignity_effect_value / Math.abs(dignity_effect_value))
        }
      }
      alchmInfo['Planets'][planet]['Dignity Effect'] = dignity_effect
      alchmInfo['Planets'][planet]['Total Effect'] = combineElementObjects(
        alchmInfo['Planets'][planet]['Total Effect'],
        dignity_effect
      )
      alchmInfo['Total Dignity Effect'] = combineElementObjects(
        alchmInfo['Total Dignity Effect'],
        dignity_effect
      )

      // Minor Arcana for Decan & Cusp (Sun only)
      if (planet === 'Sun') {
        alchmInfo['Minor Arcana']['Decan'] = signInfo[sun_sign]['Minor Tarot Cards'][decan_string]
        if (degree < 1 || degree > 29) {
          let new_sign_number: number
          let sign_index = 0
          while (signs[sign_index] !== sign) {
            sign_index += 1
          }
          if (degree < 1) {
            new_sign_number = (sign_index - 1) % 12
            alchmInfo['Minor Arcana']['Cusp'] =
              signInfo[signs[new_sign_number]]['Minor Tarot Cards']['3rd Decan']
          } else if (degree > 29) {
            new_sign_number = (sign_index + 1) % 12
            alchmInfo['Minor Arcana']['Cusp'] =
              signInfo[signs[new_sign_number]]['Minor Tarot Cards']['1st Decan']
          }
        }
      }

      // Decan Specific Elemental Effects
      const decan_effect = createElementObject()
      let planet_index = 0
      while (planet_index < signInfo[sign]['Decan Effects'][decan_string].length) {
        if (planet === signInfo[sign]['Decan Effects'][decan_string][planet_index]) {
          decan_effect[signInfo[sign]['Element']] += 1
        }
        planet_index += 1
      }
      alchmInfo['Planets'][planet]['Decan Effect'] = decan_effect
      alchmInfo['Planets'][planet]['Total Effect'] = combineElementObjects(
        alchmInfo['Planets'][planet]['Total Effect'],
        decan_effect
      )
      alchmInfo['Total Decan Effect'] = combineElementObjects(
        alchmInfo['Total Decan Effect'],
        decan_effect
      )

      // Degree Specific Elemental Effect
      const degree_effect = createElementObject()
      if (signInfo[sign]['Degree Effects'][planet]) {
        const degree_minimum = signInfo[sign]['Degree Effects'][planet][0]
        const degree_maximum = signInfo[sign]['Degree Effects'][planet][1]
        if (degree >= degree_minimum && degree < degree_maximum) {
          degree_effect[planetInfo[planet]['Diurnal Element']] += 1
          degree_effect[planetInfo[planet]['Nocturnal Element']] += 1
        }
      }
      alchmInfo['Planets'][planet]['Degree Effect'] = degree_effect
      alchmInfo['Planets'][planet]['Total Effect'] = combineElementObjects(
        alchmInfo['Planets'][planet]['Total Effect'],
        degree_effect
      )
      alchmInfo['Total Degree Effect'] = combineElementObjects(
        alchmInfo['Total Degree Effect'],
        degree_effect
      )

      // Elemental Effect
      const elemental_effect = createElementObject()
      if (planet !== 'Sun' && planet !== 'Moon') {
        if (planetInfo[planet]['Diurnal Element'] === signInfo[sign]['Element']) {
          elemental_effect[signInfo[sign]['Element']] += 1
        } else if (planetInfo[planet]['Nocturnal Element'] === signInfo[sign]['Element']) {
          elemental_effect[signInfo[sign]['Element']] += 1
        } else {
          elemental_effect[signInfo[sign]['Element']] -= 1
        }
      } else {
        if (planetInfo[planet][`${diurnal_or_nocturnal} Element`] === signInfo[sign]['Element']) {
          elemental_effect[signInfo[sign]['Element']] += 1
        }
      }
      alchmInfo['Planets'][planet]['Elemental Effect'] = elemental_effect
      alchmInfo['Planets'][planet]['Total Effect'] = combineElementObjects(
        alchmInfo['Planets'][planet]['Total Effect'],
        elemental_effect
      )
      alchmInfo['Total Elemental Effect'] = combineElementObjects(
        alchmInfo['Total Elemental Effect'],
        elemental_effect
      )

      // Aspect Effects
      alchmInfo['Planets'][planet]['Aspects'] = {}
      alchmInfo['Planets'][planet]['Aspects']['Total Effect'] = createElementObject()
      const aspect_list = horoscope.Aspects['points'][planet.toLowerCase()]
      let aspect_type: string, aspect_planet: string, aspect_effect: ElementTotals, aspect_dict: any
      let aspect_list_index = 0
      while (aspect_list && aspect_list_index < aspect_list.length) {
        aspect_dict = {}
        aspect_type = capitalize(aspect_list[aspect_list_index]['aspectKey'])
        if (!alchmInfo['Planets'][planet]['Aspects'][aspect_type]) {
          alchmInfo['Planets'][planet]['Aspects'][aspect_type] = {
            'Total Effect': createElementObject(),
          }
        }
        if (aspect_list[aspect_list_index]['point1Label'] !== planet) {
          aspect_planet = aspect_list[aspect_list_index]['point1Label']
        } else {
          aspect_planet = aspect_list[aspect_list_index]['point2Label']
        }
        aspect_dict['Planets'] = [planet, aspect_planet]
        aspect_effect = createElementObject()
        if ((planetInfo as any)[aspect_planet]) {
          if (aspect_type === 'Conjunction') {
            aspect_effect[signInfo[sign]['Element']] += 2
          } else if (aspect_type === 'Opposition') {
            aspect_effect[signInfo[sign]['Element']] -= 2
          } else if (aspect_type === 'Trine') {
            aspect_effect[signInfo[sign]['Element']] += 1
          } else if (aspect_type === 'Square') {
            if (aspect_planet === 'Ascendant') {
              aspect_effect[signInfo[sign]['Element']] += 1
            } else {
              aspect_effect[signInfo[sign]['Element']] -= 1
            }
          }
        }
        alchmInfo['Planets'][planet]['Aspects'][aspect_type][aspect_planet] = aspect_effect
        alchmInfo['Planets'][planet]['Aspects'][aspect_type]['Total Effect'] =
          combineElementObjects(
            aspect_effect,
            alchmInfo['Planets'][planet]['Aspects'][aspect_type]['Total Effect']
          )
        alchmInfo['Planets'][planet]['Aspects']['Total Effect'] = combineElementObjects(
          aspect_effect,
          alchmInfo['Planets'][planet]['Aspects']['Total Effect']
        )
        alchmInfo['Planets'][planet]['Total Effect'] = combineElementObjects(
          aspect_effect,
          alchmInfo['Planets'][planet]['Total Effect']
        )
        alchmInfo['Total Aspect Effect'] = combineElementObjects(
          aspect_effect,
          alchmInfo['Total Aspect Effect']
        )
        aspect_dict['Effects'] = aspect_effect
        aspect_dict['Sign'] = sign
        if (alchmInfo[`All ${aspect_type}s`]) {
          let aspect_dict_index = 0
          let pair_already_recorded = false
          while (aspect_dict_index < alchmInfo[`All ${aspect_type}s`].length) {
            if (
              alchmInfo[`All ${aspect_type}s`][aspect_dict_index]['Planets'].includes(planet) &&
              alchmInfo[`All ${aspect_type}s`][aspect_dict_index]['Planets'].includes(aspect_planet)
            ) {
              pair_already_recorded = true
              alchmInfo[`All ${aspect_type}s`][aspect_dict_index]['Effects'] =
                combineElementObjects(
                  aspect_effect,
                  alchmInfo[`All ${aspect_type}s`][aspect_dict_index]['Effects']
                )
            }
            aspect_dict_index += 1
          }
          if (!pair_already_recorded) {
            alchmInfo[`All ${aspect_type}s`].push(aspect_dict)
          }
        }
        aspect_list_index += 1
      }

      // Alchemy Values - always last
      const total_effect_multiplier = getAbsoluteElementValue(
        alchmInfo['Planets'][planet]['Total Effect']
      )
      alchmInfo['Planets'][planet]['Total Effect Multiplier'] = total_effect_multiplier
      const base_alchemy_values = planetInfo[planet]['Alchemy']
      const alchemy_values: any = {}
      if (base_alchemy_values['Spirit']) {
        const spirit_bonus = base_alchemy_values['Spirit'] * total_effect_multiplier
        alchemy_values['Spirit'] = spirit_bonus
        alchmInfo['Alchemy Effects']['Total Spirit'] += spirit_bonus
        alchemy_values['Day Alchemy'] = { Spirit: spirit_bonus }
      }
      if (base_alchemy_values['Essence']) {
        const essence_bonus = base_alchemy_values['Essence'] * total_effect_multiplier
        alchemy_values['Essence'] = essence_bonus
        alchmInfo['Alchemy Effects']['Total Essence'] += essence_bonus
        if (alchemy_values['Spirit']) {
          alchemy_values['Night Alchemy'] = { Essence: essence_bonus }
          alchmInfo['Alchemy Effects']['Total Night Essence'] += essence_bonus
        } else {
          alchemy_values['Day Alchemy'] = { Essence: essence_bonus }
          alchmInfo['Alchemy Effects']['Total Day Essence'] += essence_bonus
        }
      }
      if (base_alchemy_values['Matter']) {
        const matter_bonus = base_alchemy_values['Matter'] * total_effect_multiplier
        alchemy_values['Matter'] = matter_bonus
        alchmInfo['Alchemy Effects']['Total Matter'] += matter_bonus
        alchemy_values['Night Alchemy'] = { Matter: matter_bonus }
      }
      if (base_alchemy_values['Substance']) {
        const substance_bonus = base_alchemy_values['Substance'] * total_effect_multiplier
        alchemy_values['Substance'] = substance_bonus
        alchmInfo['Alchemy Effects']['Total Substance'] += substance_bonus
        alchemy_values['Night Alchemy'] = { Substance: substance_bonus }
      }
      alchmInfo['Planets'][planet]['Alchemy Effects'] = alchemy_values
    }
    celestial_bodies_index += 1
  }

  // Totals
  alchmInfo['Total Effect Value'] = combineElementObjects(
    alchmInfo['Total Dignity Effect'],
    alchmInfo['Total Effect Value']
  )
  alchmInfo['Total Effect Value'] = combineElementObjects(
    alchmInfo['Total Decan Effect'],
    alchmInfo['Total Effect Value']
  )
  alchmInfo['Total Effect Value'] = combineElementObjects(
    alchmInfo['Total Degree Effect'],
    alchmInfo['Total Effect Value']
  )
  alchmInfo['Total Effect Value'] = combineElementObjects(
    alchmInfo['Total Aspect Effect'],
    alchmInfo['Total Effect Value']
  )
  alchmInfo['Total Effect Value'] = combineElementObjects(
    alchmInfo['Total Elemental Effect'],
    alchmInfo['Total Effect Value']
  )
  alchmInfo['Dominant Element'] = getElementRanking(alchmInfo['Total Effect Value'])[1]

  alchmInfo['Total Chart Absolute Effect'] = getAbsoluteElementValue(
    alchmInfo['Total Effect Value']
  )
  alchmInfo['Alchemy Effects']['A #'] =
    alchmInfo['Alchemy Effects']['Total Spirit'] +
    alchmInfo['Alchemy Effects']['Total Essence'] +
    alchmInfo['Alchemy Effects']['Total Matter'] +
    alchmInfo['Alchemy Effects']['Total Substance']

  // Modality Percentages & Dominance
  alchmInfo['% Cardinal'] = alchmInfo['# Cardinal'] / 11
  alchmInfo['% Fixed'] = alchmInfo['# Fixed'] / 11
  alchmInfo['% Mutable'] = alchmInfo['# Mutable'] / 11
  if (
    alchmInfo['% Cardinal'] >= alchmInfo['% Fixed'] &&
    alchmInfo['% Cardinal'] >= alchmInfo['% Mutable']
  ) {
    alchmInfo['Dominant Modality'] = 'Cardinal'
  } else if (
    alchmInfo['% Fixed'] >= alchmInfo['% Cardinal'] &&
    alchmInfo['% Fixed'] >= alchmInfo['% Mutable']
  ) {
    alchmInfo['Dominant Modality'] = 'Fixed'
  } else if (
    alchmInfo['% Mutable'] >= alchmInfo['% Cardinal'] &&
    alchmInfo['% Mutable'] >= alchmInfo['% Fixed']
  ) {
    alchmInfo['Dominant Modality'] = 'Mutable'
  }

  // Heat, Entropy, Reactivity, Energy
  const fire = alchmInfo['Total Effect Value']['Fire']
  const water = alchmInfo['Total Effect Value']['Water']
  const air = alchmInfo['Total Effect Value']['Air']
  const earth = alchmInfo['Total Effect Value']['Earth']
  const spirit = alchmInfo['Alchemy Effects']['Total Spirit']
  const essence = alchmInfo['Alchemy Effects']['Total Essence']
  const matter = alchmInfo['Alchemy Effects']['Total Matter']
  const substance = alchmInfo['Alchemy Effects']['Total Substance']

  alchmInfo['Heat'] =
    (spirit ** 2 + fire ** 2) / (substance + essence + matter + water + air + earth) ** 2
  alchmInfo['Entropy'] =
    (spirit ** 2 + substance ** 2 + fire ** 2 + air ** 2) / (essence + matter + earth + water) ** 2
  alchmInfo['Reactivity'] =
    (spirit ** 2 + substance ** 2 + essence ** 2 + fire ** 2 + air ** 2 + water ** 2) /
    (matter + earth) ** 2
  alchmInfo['Energy'] = alchmInfo['Heat'] - alchmInfo['Reactivity'] * alchmInfo['Entropy']

  return alchmInfo
}

export default {
  alchemize,
  signs,
  signInfo,
  planetInfo,
  createElementObject,
  combineElementObjects,
  getElementRanking,
  getAbsoluteElementValue,
  capitalize,
}
