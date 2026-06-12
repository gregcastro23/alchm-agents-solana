import { getPlanetCycleLength } from './historical-transits'

export interface DegreeHistoricalData {
  planet: string
  sign: string
  degree: number
  occurrences: HistoricalOccurrence[]
  significance: string
  themes: string[]
  nextOccurrence?: Date
}

export interface HistoricalOccurrence {
  date: Date
  year: number
  events: string[]
  culturalContext: string
  significance: string
  cycleNumber: number
}

// Detailed historical events database
const HISTORICAL_EVENTS_DATABASE: Record<string, string[]> = {
  '2020': [
    'COVID-19 pandemic reshapes global society',
    'Digital transformation accelerates worldwide',
    'Black Lives Matter protests spark global movement',
    'US Presidential election amid political tensions',
  ],
  '2008': [
    'Global financial crisis begins',
    'Barack Obama elected US President',
    'Large Hadron Collider activated',
    "Beijing Olympics showcase China's rise",
  ],
  '2001': [
    'September 11 attacks change world order',
    'War on Terror begins',
    'iPod revolutionizes music industry',
    'Wikipedia launches, democratizing knowledge',
  ],
  '1991': [
    'Soviet Union collapses, Cold War ends',
    'Gulf War demonstrates new military technology',
    'World Wide Web becomes publicly available',
    'Nelson Mandela released from prison',
  ],
  '1989': [
    'Berlin Wall falls, German reunification begins',
    'Tiananmen Square protests in China',
    'Exxon Valdez oil spill raises environmental awareness',
    'Nintendo Game Boy transforms gaming',
  ],
  '1981': [
    'IBM Personal Computer launches',
    'MTV debuts, revolutionizing entertainment',
    'AIDS epidemic begins to emerge',
    'Space Shuttle Columbia first flight',
  ],
  '1973': [
    'Oil crisis reshapes global energy',
    'Watergate scandal undermines trust',
    'Vietnam War ends, America reassesses',
    'Roe vs Wade decision transforms society',
  ],
  '1969': [
    'Apollo 11 Moon landing - humanity reaches space',
    'Woodstock festival defines counterculture',
    'ARPANET precursor to internet created',
    'Stonewall riots launch LGBTQ+ rights movement',
  ],
  '1963': [
    'President Kennedy assassination shocks world',
    'March on Washington for civil rights',
    'Beatles release debut album',
    'Nuclear Test Ban Treaty signed',
  ],
  '1945': [
    'World War II ends, new world order emerges',
    'United Nations established',
    'Atomic age begins with nuclear weapons',
    'Computer age starts with ENIAC',
  ],
  '1929': [
    'Stock Market Crash triggers Great Depression',
    'Sound films revolutionize entertainment',
    'Penicillin discovered by Fleming',
    'Television broadcasts begin experimentally',
  ],
  '1918': [
    'World War I ends, empires collapse',
    'Spanish flu pandemic kills millions',
    'Russian Revolution establishes Soviet Union',
    'Women gain voting rights in many countries',
  ],
  '1914': [
    'World War I begins, old order crumbles',
    'Panama Canal opens, connecting oceans',
    'Ford assembly line revolutionizes production',
    'Einstein publishes theory of relativity',
  ],
  '1900': [
    'Quantum theory introduced by Planck',
    'Freud publishes "Interpretation of Dreams"',
    'Wright brothers achieve powered flight',
    'Industrial Revolution reaches full maturity',
  ],
}

// Cultural context descriptions by era
const CULTURAL_CONTEXTS: Record<string, string> = {
  '2020': 'Digital Age Transformation - pandemic accelerates remote work and digital life',
  '2008': 'Global Financial Crisis Era - economic instability leads to political upheaval',
  '2001': 'Post-9/11 Security Era - terrorism fears reshape society and politics',
  '1991': 'End of Cold War - new world order emerges with American hegemony',
  '1989': 'Fall of Communism - democratic revolutions sweep Eastern Europe',
  '1981': 'Personal Computer Revolution - technology begins entering homes',
  '1973': 'Oil Crisis Era - environmental awareness and energy independence emerge',
  '1969': 'Counterculture Peak - youth rebellion challenges traditional values',
  '1963': 'Civil Rights Era - social justice movements gain momentum',
  '1945': 'Post-War Reconstruction - new international order and atomic age',
  '1929': 'Great Depression - economic collapse leads to government intervention',
  '1918': 'Post-WWI Reconstruction - old empires fall, new nations emerge',
  '1914': 'World War I Era - technological warfare and societal transformation',
  '1900': 'Industrial Age Peak - scientific revolution and technological optimism',
}

export class DegreeSpecificHistoryService {
  static generateHistoricalData(
    planet: string,
    sign: string,
    degree: number
  ): DegreeHistoricalData {
    const cycleLength = getPlanetCycleLength(planet)
    if (cycleLength === 0) {
      throw new Error(`Unknown planet: ${planet}`)
    }

    const cycleYears = cycleLength / 365.25
    const currentYear = new Date().getFullYear()
    const occurrences: HistoricalOccurrence[] = []

    // Generate historical occurrences based on planetary cycle
    let cycleNumber = 1
    const maxCycles = Math.min(8, Math.floor(100 / cycleYears)) // Look back up to 100 years or 8 cycles

    for (let i = 1; i <= maxCycles; i++) {
      const historicalYear = Math.floor(currentYear - cycleYears * i)

      // Find the closest year in our events database
      const availableYears = Object.keys(HISTORICAL_EVENTS_DATABASE)
        .map(y => parseInt(y))
        .sort((a, b) => Math.abs(historicalYear - a) - Math.abs(historicalYear - b))

      const closestYear = availableYears[0]
      const yearKey = closestYear.toString()

      if (HISTORICAL_EVENTS_DATABASE[yearKey]) {
        const occurrence: HistoricalOccurrence = {
          date: new Date(historicalYear, this.getMonthForSign(sign), 15),
          year: historicalYear,
          events: HISTORICAL_EVENTS_DATABASE[yearKey],
          culturalContext:
            CULTURAL_CONTEXTS[yearKey] || `Historical period around ${historicalYear}`,
          significance: this.getPlanetarySignificance(planet, sign, degree, historicalYear),
          cycleNumber: cycleNumber++,
        }
        occurrences.push(occurrence)
      }
    }

    // Calculate next occurrence
    const nextOccurrenceYear = currentYear + cycleYears
    const nextOccurrence = new Date(nextOccurrenceYear, this.getMonthForSign(sign), 15)

    return {
      planet,
      sign,
      degree,
      occurrences: occurrences.slice(0, 6), // Limit to 6 most relevant
      significance: this.getOverallSignificance(planet, sign, degree),
      themes: this.getPlanetaryThemes(planet, sign),
      nextOccurrence,
    }
  }

  private static getMonthForSign(sign: string): number {
    const signMonths: Record<string, number> = {
      Aries: 2,
      Taurus: 3,
      Gemini: 4,
      Cancer: 5,
      Leo: 6,
      Virgo: 7,
      Libra: 8,
      Scorpio: 9,
      Sagittarius: 10,
      Capricorn: 11,
      Aquarius: 0,
      Pisces: 1,
    }
    return signMonths[sign] || 5 // Default to June
  }

  private static getPlanetarySignificance(
    planet: string,
    sign: string,
    degree: number,
    year: number
  ): string {
    const planetarySignificances: Record<string, string> = {
      Jupiter: `Expansion and growth themes manifest - year of philosophical and educational advancement`,
      Saturn: `Structural changes and discipline required - period of karmic lessons and responsibility`,
      Uranus: `Revolutionary changes and innovation - breakthrough technologies and social upheaval`,
      Neptune: `Spiritual and artistic renaissance - dissolution of old forms and mystical insights`,
      Pluto: `Deep transformation and power shifts - death and rebirth of societal structures`,
    }

    const baseSignificance = planetarySignificances[planet] || 'Significant planetary influence'
    return `${baseSignificance} around ${year} when ${planet} occupied ${degree}° ${sign}`
  }

  private static getOverallSignificance(planet: string, sign: string, degree: number): string {
    return `${planet} at ${degree}° ${sign} represents a unique confluence of ${planet}'s archetypal energy 
            filtered through ${sign}'s qualities and focused at the specific ${degree}° position. 
            This degree carries the accumulated wisdom and experience of previous historical cycles.`
  }

  private static getPlanetaryThemes(planet: string, sign: string): string[] {
    const planetThemes: Record<string, string[]> = {
      Jupiter: ['Expansion', 'Wisdom', 'Growth', 'Philosophy', 'Education', 'Travel'],
      Saturn: ['Structure', 'Discipline', 'Responsibility', 'Time', 'Authority', 'Limitation'],
      Uranus: ['Revolution', 'Innovation', 'Freedom', 'Technology', 'Awakening', 'Change'],
      Neptune: ['Spirituality', 'Dreams', 'Illusion', 'Compassion', 'Art', 'Transcendence'],
      Pluto: [
        'Transformation',
        'Power',
        'Death/Rebirth',
        'Hidden Truth',
        'Regeneration',
        'Psychology',
      ],
      Mars: ['Action', 'Courage', 'Conflict', 'Energy', 'Competition', 'Initiative'],
      Venus: ['Love', 'Beauty', 'Harmony', 'Values', 'Relationships', 'Art'],
      Mercury: ['Communication', 'Learning', 'Analysis', 'Travel', 'Commerce', 'Writing'],
      Sun: ['Identity', 'Leadership', 'Vitality', 'Purpose', 'Authority', 'Consciousness'],
      Moon: ['Emotions', 'Intuition', 'Memory', 'Nurturing', 'Cycles', 'Home'],
    }

    const signQualities: Record<string, string[]> = {
      Aries: ['Pioneering', 'Independent', 'Direct'],
      Taurus: ['Stable', 'Practical', 'Enduring'],
      Gemini: ['Versatile', 'Communicative', 'Curious'],
      Cancer: ['Nurturing', 'Protective', 'Intuitive'],
      Leo: ['Creative', 'Expressive', 'Generous'],
      Virgo: ['Analytical', 'Service-oriented', 'Perfecting'],
      Libra: ['Harmonious', 'Diplomatic', 'Aesthetic'],
      Scorpio: ['Intense', 'Transformative', 'Mysterious'],
      Sagittarius: ['Philosophical', 'Adventurous', 'Optimistic'],
      Capricorn: ['Ambitious', 'Disciplined', 'Traditional'],
      Aquarius: ['Innovative', 'Humanitarian', 'Independent'],
      Pisces: ['Compassionate', 'Imaginative', 'Spiritual'],
    }

    const planetaryThemes = planetThemes[planet] || []
    const signThemes = signQualities[sign] || []

    return [...planetaryThemes.slice(0, 3), ...signThemes].slice(0, 5)
  }

  // Get historical context for a specific year range
  static getHistoricalEventsForYearRange(
    startYear: number,
    endYear: number
  ): Array<{ year: number; events: string[] }> {
    const events: Array<{ year: number; events: string[] }> = []

    Object.entries(HISTORICAL_EVENTS_DATABASE).forEach(([yearStr, eventList]) => {
      const year = parseInt(yearStr)
      if (year >= startYear && year <= endYear) {
        events.push({ year, events: eventList })
      }
    })

    return events.sort((a, b) => b.year - a.year)
  }

  // Get the most significant historical periods for a planet
  static getSignificantPeriods(
    planet: string
  ): Array<{ period: string; years: string; significance: string }> {
    const significantPeriods: Record<
      string,
      Array<{ period: string; years: string; significance: string }>
    > = {
      Pluto: [
        {
          period: 'Pluto in Aquarius',
          years: '2023-2044',
          significance: 'Transformation of technology and collective consciousness',
        },
        {
          period: 'Pluto in Capricorn',
          years: '2008-2023',
          significance: 'Restructuring of authority and institutions',
        },
        {
          period: 'Pluto in Sagittarius',
          years: '1995-2008',
          significance: 'Transformation of belief systems and global consciousness',
        },
      ],
      Neptune: [
        {
          period: 'Neptune in Pisces',
          years: '2011-2025',
          significance: 'Spiritual awakening and dissolution of boundaries',
        },
        {
          period: 'Neptune in Aquarius',
          years: '1998-2011',
          significance: 'Digital illusions and collective dreams',
        },
        {
          period: 'Neptune in Capricorn',
          years: '1984-1998',
          significance: 'Dissolution of traditional structures',
        },
      ],
      Uranus: [
        {
          period: 'Uranus in Taurus',
          years: '2018-2026',
          significance: 'Revolutionary changes in values and resources',
        },
        {
          period: 'Uranus in Aries',
          years: '2010-2018',
          significance: 'Individual freedom and identity revolution',
        },
        {
          period: 'Uranus in Pisces',
          years: '2003-2010',
          significance: 'Technological spirituality and digital transcendence',
        },
      ],
    }

    return significantPeriods[planet] || []
  }
}
