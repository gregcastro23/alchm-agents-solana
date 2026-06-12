/**
 * Zodiac Utilities
 *
 * Derives the tropical sun sign from a birth month (0-based) and day,
 * and provides curated cosmic color palettes for each sign.
 */

export type ZodiacSign =
  | 'Aries'
  | 'Taurus'
  | 'Gemini'
  | 'Cancer'
  | 'Leo'
  | 'Virgo'
  | 'Libra'
  | 'Scorpio'
  | 'Sagittarius'
  | 'Capricorn'
  | 'Aquarius'
  | 'Pisces'

export interface ZodiacTheme {
  sign: ZodiacSign
  constellation: string
  element: 'Fire' | 'Earth' | 'Air' | 'Water'
  rulingPlanet: string
  /** Primary gradient for backgrounds — deep cosmic tones */
  gradient: string
  /** Secondary lighter gradient for cards / accents */
  cardGradient: string
  /** Primary accent HSL color string e.g. "14 90% 58%" */
  accentHsl: string
  /** Glow color as rgba for box-shadows */
  glowColor: string
  /** Border tint as rgba */
  borderColor: string
  /** Short thematic tagline */
  tagline: string
}

/**
 * Determine the tropical sun sign from month (0-based, like JS Date) and day.
 */
export function getSunSign(month: number, day: number): ZodiacSign {
  // month is 0-based: 0 = January, 11 = December
  const m = month + 1 // convert to 1-based for readability
  if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return 'Aries'
  if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return 'Taurus'
  if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return 'Gemini'
  if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return 'Cancer'
  if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return 'Leo'
  if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return 'Virgo'
  if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return 'Libra'
  if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return 'Scorpio'
  if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return 'Sagittarius'
  if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return 'Capricorn'
  if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return 'Aquarius'
  return 'Pisces' // Feb 19 – Mar 20
}

/**
 * Get a curated cosmic color palette for a zodiac sign.
 * Each palette is hand-crafted for dark cosmic backgrounds —
 * no generic Tailwind primaries.
 */
export function getZodiacTheme(sign: ZodiacSign): ZodiacTheme {
  const themes: Record<ZodiacSign, ZodiacTheme> = {
    Aries: {
      sign: 'Aries',
      constellation: '♈',
      element: 'Fire',
      rulingPlanet: 'Mars',
      gradient:
        'linear-gradient(135deg, #1a0a0a 0%, #2d0f0f 20%, #4a1515 45%, #1a0505 70%, #0d0303 100%)',
      cardGradient:
        'linear-gradient(135deg, rgba(180, 40, 40, 0.15) 0%, rgba(30, 10, 10, 0.9) 100%)',
      accentHsl: '0 75% 55%',
      glowColor: 'rgba(220, 50, 50, 0.4)',
      borderColor: 'rgba(220, 60, 60, 0.3)',
      tagline: 'The Cosmic Pioneer',
    },
    Taurus: {
      sign: 'Taurus',
      constellation: '♉',
      element: 'Earth',
      rulingPlanet: 'Venus',
      gradient:
        'linear-gradient(135deg, #0a1208 0%, #132410 20%, #1e3a18 45%, #0a150a 70%, #050a04 100%)',
      cardGradient:
        'linear-gradient(135deg, rgba(60, 140, 50, 0.12) 0%, rgba(10, 20, 10, 0.9) 100%)',
      accentHsl: '115 45% 42%',
      glowColor: 'rgba(80, 180, 60, 0.35)',
      borderColor: 'rgba(80, 160, 60, 0.3)',
      tagline: 'The Celestial Gardener',
    },
    Gemini: {
      sign: 'Gemini',
      constellation: '♊',
      element: 'Air',
      rulingPlanet: 'Mercury',
      gradient:
        'linear-gradient(135deg, #0a0d14 0%, #101828 20%, #1a2a42 45%, #0c1220 70%, #060910 100%)',
      cardGradient:
        'linear-gradient(135deg, rgba(80, 160, 220, 0.12) 0%, rgba(10, 15, 25, 0.9) 100%)',
      accentHsl: '200 70% 58%',
      glowColor: 'rgba(80, 170, 240, 0.35)',
      borderColor: 'rgba(80, 170, 240, 0.25)',
      tagline: 'The Cosmic Messenger',
    },
    Cancer: {
      sign: 'Cancer',
      constellation: '♋',
      element: 'Water',
      rulingPlanet: 'Moon',
      gradient:
        'linear-gradient(135deg, #08090e 0%, #0e1520 20%, #162238 45%, #0a0f1a 70%, #05080d 100%)',
      cardGradient:
        'linear-gradient(135deg, rgba(140, 180, 220, 0.12) 0%, rgba(10, 15, 22, 0.9) 100%)',
      accentHsl: '210 50% 68%',
      glowColor: 'rgba(140, 190, 230, 0.35)',
      borderColor: 'rgba(140, 190, 230, 0.25)',
      tagline: 'The Lunar Guardian',
    },
    Leo: {
      sign: 'Leo',
      constellation: '♌',
      element: 'Fire',
      rulingPlanet: 'Sun',
      gradient:
        'linear-gradient(135deg, #140e04 0%, #2a1a06 20%, #3d2508 45%, #1a1004 70%, #0d0802 100%)',
      cardGradient:
        'linear-gradient(135deg, rgba(220, 160, 30, 0.15) 0%, rgba(20, 14, 6, 0.9) 100%)',
      accentHsl: '40 85% 52%',
      glowColor: 'rgba(240, 180, 40, 0.4)',
      borderColor: 'rgba(240, 180, 40, 0.3)',
      tagline: 'The Solar Sovereign',
    },
    Virgo: {
      sign: 'Virgo',
      constellation: '♍',
      element: 'Earth',
      rulingPlanet: 'Mercury',
      gradient:
        'linear-gradient(135deg, #0a0b08 0%, #161a10 20%, #222a18 45%, #0e1008 70%, #070804 100%)',
      cardGradient:
        'linear-gradient(135deg, rgba(140, 160, 80, 0.12) 0%, rgba(14, 16, 10, 0.9) 100%)',
      accentHsl: '75 45% 48%',
      glowColor: 'rgba(160, 190, 70, 0.35)',
      borderColor: 'rgba(160, 190, 70, 0.25)',
      tagline: 'The Celestial Analyst',
    },
    Libra: {
      sign: 'Libra',
      constellation: '♎',
      element: 'Air',
      rulingPlanet: 'Venus',
      gradient:
        'linear-gradient(135deg, #0c0810 0%, #1a1028 20%, #28183e 45%, #120a1c 70%, #08050e 100%)',
      cardGradient:
        'linear-gradient(135deg, rgba(180, 120, 220, 0.12) 0%, rgba(15, 10, 22, 0.9) 100%)',
      accentHsl: '280 55% 65%',
      glowColor: 'rgba(180, 130, 240, 0.35)',
      borderColor: 'rgba(180, 130, 240, 0.25)',
      tagline: 'The Cosmic Harmonist',
    },
    Scorpio: {
      sign: 'Scorpio',
      constellation: '♏',
      element: 'Water',
      rulingPlanet: 'Pluto',
      gradient:
        'linear-gradient(135deg, #0d0408 0%, #1e0810 20%, #32101c 45%, #14060c 70%, #0a0306 100%)',
      cardGradient:
        'linear-gradient(135deg, rgba(160, 40, 70, 0.15) 0%, rgba(15, 5, 10, 0.9) 100%)',
      accentHsl: '340 65% 48%',
      glowColor: 'rgba(200, 50, 80, 0.4)',
      borderColor: 'rgba(200, 50, 80, 0.3)',
      tagline: 'The Cosmic Alchemist',
    },
    Sagittarius: {
      sign: 'Sagittarius',
      constellation: '♐',
      element: 'Fire',
      rulingPlanet: 'Jupiter',
      gradient:
        'linear-gradient(135deg, #0e0a04 0%, #221808 20%, #35260e 45%, #181006 70%, #0c0803 100%)',
      cardGradient:
        'linear-gradient(135deg, rgba(200, 140, 40, 0.12) 0%, rgba(18, 12, 5, 0.9) 100%)',
      accentHsl: '32 75% 52%',
      glowColor: 'rgba(220, 160, 50, 0.38)',
      borderColor: 'rgba(220, 160, 50, 0.28)',
      tagline: 'The Cosmic Explorer',
    },
    Capricorn: {
      sign: 'Capricorn',
      constellation: '♑',
      element: 'Earth',
      rulingPlanet: 'Saturn',
      gradient:
        'linear-gradient(135deg, #080808 0%, #141418 20%, #1e1e2a 45%, #0c0c12 70%, #060608 100%)',
      cardGradient:
        'linear-gradient(135deg, rgba(120, 120, 160, 0.12) 0%, rgba(10, 10, 15, 0.9) 100%)',
      accentHsl: '240 20% 55%',
      glowColor: 'rgba(130, 130, 180, 0.35)',
      borderColor: 'rgba(130, 130, 180, 0.25)',
      tagline: 'The Cosmic Architect',
    },
    Aquarius: {
      sign: 'Aquarius',
      constellation: '♒',
      element: 'Air',
      rulingPlanet: 'Uranus',
      gradient:
        'linear-gradient(135deg, #04080e 0%, #081428 20%, #0c2040 45%, #06101e 70%, #030810 100%)',
      cardGradient:
        'linear-gradient(135deg, rgba(40, 140, 220, 0.12) 0%, rgba(5, 10, 18, 0.9) 100%)',
      accentHsl: '205 75% 55%',
      glowColor: 'rgba(50, 160, 240, 0.38)',
      borderColor: 'rgba(50, 160, 240, 0.28)',
      tagline: 'The Cosmic Visionary',
    },
    Pisces: {
      sign: 'Pisces',
      constellation: '♓',
      element: 'Water',
      rulingPlanet: 'Neptune',
      gradient:
        'linear-gradient(135deg, #080610 0%, #120e24 20%, #1c1438 45%, #0e0a1e 70%, #06040e 100%)',
      cardGradient:
        'linear-gradient(135deg, rgba(120, 80, 200, 0.15) 0%, rgba(10, 8, 18, 0.9) 100%)',
      accentHsl: '265 60% 58%',
      glowColor: 'rgba(140, 90, 220, 0.4)',
      borderColor: 'rgba(140, 90, 220, 0.3)',
      tagline: 'The Cosmic Dreamer',
    },
  }

  return themes[sign]
}
