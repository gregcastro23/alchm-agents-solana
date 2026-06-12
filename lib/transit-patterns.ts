import { getTransitsByPlanet, getCurrentTransits, TransitRecord } from './historical-transit-data'
import { getPlanetCycleLength } from './historical-transits'

export interface TransitPattern {
  type: 'return' | 'opposition' | 'square' | 'trine' | 'conjunction'
  planet: string
  cycleLength: number
  description: string
  significance: string
  frequency: string
  lastOccurrence?: Date
  nextOccurrence?: Date
}

export interface PlanetaryTheme {
  planet: string
  sign: string
  themes: string[]
  historicalExamples: string[]
  archetypes: string[]
}

export interface TransitCycle {
  planet: string
  fullCycleDays: number
  fullCycleYears: number
  currentPhase: string
  phaseDescription: string
  percentComplete: number
}

// Calculate planetary return patterns
export function calculateReturnPattern(
  planet: string,
  birthDate: Date,
  currentDate: Date = new Date()
): TransitPattern {
  const cycleLength = getPlanetCycleLength(planet)
  const daysSince = Math.floor(
    (currentDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  const returnsCompleted = Math.floor(daysSince / cycleLength)
  const daysIntoCurrentCycle = daysSince % cycleLength

  const lastReturn = new Date(birthDate)
  lastReturn.setDate(lastReturn.getDate() + returnsCompleted * cycleLength)

  const nextReturn = new Date(birthDate)
  nextReturn.setDate(nextReturn.getDate() + (returnsCompleted + 1) * cycleLength)

  return {
    type: 'return',
    planet,
    cycleLength,
    description: `${planet} returns to its natal position`,
    significance: getReturnSignificance(planet, returnsCompleted + 1),
    frequency: `Every ${(cycleLength / 365.25).toFixed(1)} years`,
    lastOccurrence: returnsCompleted > 0 ? lastReturn : undefined,
    nextOccurrence: nextReturn,
  }
}

// Get significance of planetary returns
function getReturnSignificance(planet: string, returnNumber: number): string {
  const significances: Record<string, string[]> = {
    Jupiter: [
      'Age 12: First expansion of consciousness',
      'Age 24: Career and purpose clarification',
      'Age 36: Professional mastery phase',
      'Age 48: Wisdom teaching phase',
      'Age 60: Elder wisdom emergence',
      'Age 72: Sage advisor status',
      'Age 84: Master teacher completion',
    ],
    Saturn: [
      'Age 29-30: First maturity milestone, life restructuring',
      'Age 58-60: Second maturity, wisdom crystallization',
      'Age 87-90: Life completion, legacy review',
    ],
    Uranus: [
      'Age 21: First square - rebellion and independence',
      'Age 42: Opposition - midlife awakening',
      'Age 63: Second square - freedom from convention',
      'Age 84: Return - complete life revolution',
    ],
    Neptune: [
      'Age 42: Square - spiritual questioning',
      'Age 82: Opposition - transcendent understanding',
      'Age 165: Return - collective consciousness shift',
    ],
    Pluto: [
      'Age 36-42: Square - power confrontation',
      'Age 82-90: Opposition - transformation mastery',
      'Age 248: Return - civilizational rebirth',
    ],
  }

  const planetSigs = significances[planet]
  if (planetSigs && planetSigs[returnNumber - 1]) {
    return planetSigs[returnNumber - 1]
  }

  return `${planet} return #${returnNumber}: Major life cycle completion`
}

// Identify recurring themes for planet-sign combinations
export function identifyPlanetaryThemes(planet: string, sign: string): PlanetaryTheme {
  const themes = planetSignThemes[`${planet}_${sign}`] || {
    themes: ['General transit themes'],
    historicalExamples: ['Historical patterns'],
    archetypes: ['Universal archetypes'],
  }

  return {
    planet,
    sign,
    ...themes,
  }
}

// Database of planetary themes by sign
const planetSignThemes: Record<string, Omit<PlanetaryTheme, 'planet' | 'sign'>> = {
  Jupiter_Aries: {
    themes: [
      'Pioneer expansion',
      'New philosophical frontiers',
      'Bold initiatives',
      'Entrepreneurial growth',
    ],
    historicalExamples: [
      'Arab Spring (2011)',
      'AI revolution acceleration (2023)',
      'Space race beginnings',
    ],
    archetypes: ['The Pioneer', 'The Entrepreneur', 'The Warrior-Philosopher'],
  },
  Jupiter_Taurus: {
    themes: ['Material abundance', 'Value expansion', 'Sustainable growth', 'Economic development'],
    historicalExamples: [
      'Dot-com bubble (2000)',
      'Economic recovery periods',
      'Agricultural revolutions',
    ],
    archetypes: ['The Builder', 'The Provider', 'The Earth Guardian'],
  },
  Jupiter_Gemini: {
    themes: [
      'Information expansion',
      'Communication boom',
      'Educational growth',
      'Intellectual exploration',
    ],
    historicalExamples: [
      'Internet expansion (2000-2001)',
      'Social media rise (2012-2013)',
      'AI communication era (2024-2025)',
    ],
    archetypes: ['The Messenger', 'The Teacher', 'The Networker'],
  },
  Jupiter_Cancer: {
    themes: ['Emotional healing', 'Family expansion', 'National identity', 'Nurturing growth'],
    historicalExamples: ['Post-crisis unity periods', 'Housing booms', 'Family value movements'],
    archetypes: ['The Nurturer', 'The Protector', 'The Homeland Guardian'],
  },
  Saturn_Aquarius: {
    themes: [
      'Social restructuring',
      'Digital responsibility',
      'Collective boundaries',
      'Democratic reform',
    ],
    historicalExamples: [
      'End of Cold War (1991)',
      'COVID social restructuring (2020-2023)',
      'Digital age regulations',
    ],
    archetypes: ['The Social Architect', 'The Democratic Builder', 'The Digital Lawmaker'],
  },
  Saturn_Pisces: {
    themes: [
      'Spiritual structure',
      'Compassionate boundaries',
      'Dissolving old forms',
      'Mystical discipline',
    ],
    historicalExamples: [
      'Spiritual movements institutionalization',
      'Mental health awareness',
      'Artistic discipline periods',
    ],
    archetypes: ['The Spiritual Teacher', 'The Mystic Builder', 'The Compassionate Authority'],
  },
  Pluto_Aquarius: {
    themes: [
      'Collective transformation',
      'Technology revolution',
      'Democratic rebirth',
      'Humanity evolution',
    ],
    historicalExamples: [
      'American Revolution (1778)',
      'French Revolution influence',
      'AI transformation (2024-2044)',
    ],
    archetypes: ['The Revolutionary', 'The Collective Transformer', 'The Future Architect'],
  },
  Neptune_Pisces: {
    themes: [
      'Spiritual renaissance',
      'Universal compassion',
      'Artistic flowering',
      'Mystical awakening',
    ],
    historicalExamples: [
      'Transcendentalist movement',
      'New Age spirituality',
      'Global meditation movement (2011-2025)',
    ],
    archetypes: ['The Mystic', 'The Visionary', 'The Universal Healer'],
  },
  Uranus_Taurus: {
    themes: ['Financial revolution', 'Earth changes', 'Value disruption', 'Material innovation'],
    historicalExamples: [
      'Cryptocurrency rise (2018-2026)',
      'Climate action acceleration',
      'Sustainable technology boom',
    ],
    archetypes: ['The Earth Revolutionary', 'The Value Disruptor', 'The Material Innovator'],
  },
}

// Calculate current phase of planetary cycle
export function calculateCyclePhase(
  planet: string,
  startDate: Date,
  currentDate: Date = new Date()
): TransitCycle {
  const cycleLength = getPlanetCycleLength(planet)
  const daysSince = Math.floor(
    (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  const percentComplete = ((daysSince % cycleLength) / cycleLength) * 100

  const phase = getPhaseFromPercent(percentComplete)

  return {
    planet,
    fullCycleDays: cycleLength,
    fullCycleYears: cycleLength / 365.25,
    currentPhase: phase.name,
    phaseDescription: phase.description,
    percentComplete,
  }
}

// Determine phase based on percentage
function getPhaseFromPercent(percent: number): { name: string; description: string } {
  if (percent < 12.5) return { name: 'New', description: 'Beginning of new cycle, planting seeds' }
  if (percent < 25) return { name: 'Crescent', description: 'Initial growth, building momentum' }
  if (percent < 37.5)
    return { name: 'First Quarter', description: 'First challenges, decisive action' }
  if (percent < 50) return { name: 'Gibbous', description: 'Refinement, adjustment, persistence' }
  if (percent < 62.5) return { name: 'Full', description: 'Culmination, maximum illumination' }
  if (percent < 75) return { name: 'Disseminating', description: 'Sharing wisdom, distribution' }
  if (percent < 87.5)
    return { name: 'Last Quarter', description: 'Release, letting go, transition' }
  return { name: 'Balsamic', description: 'Completion, rest, preparation for new cycle' }
}

// Find historical patterns and correlations
export function findHistoricalPatterns(
  planet: string,
  sign: string,
  date?: Date
): Array<{ pattern: string; examples: string[]; frequency: string }> {
  const transits = getTransitsByPlanet(planet).filter(t => t.sign === sign)
  const patterns: Array<{ pattern: string; examples: string[]; frequency: string }> = []

  // Analyze recurring themes
  const themeCount: Record<string, number> = {}
  transits.forEach(transit => {
    transit.themes?.forEach(theme => {
      themeCount[theme] = (themeCount[theme] || 0) + 1
    })
  })

  // Identify most common themes
  Object.entries(themeCount)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([theme, count]) => {
      patterns.push({
        pattern: theme,
        examples: transits
          .filter(t => t.themes?.includes(theme))
          .map(t => `${t.startDate.split('-')[0]}: ${t.historicalEvents?.[0] || theme}`)
          .slice(0, 3),
        frequency: `Occurs ${count} times in historical record`,
      })
    })

  return patterns
}

// Calculate synodic cycles between planets
export function calculateSynodicCycle(
  planet1: string,
  planet2: string
): { cycleLength: number; description: string; significance: string } {
  const cycle1 = getPlanetCycleLength(planet1)
  const cycle2 = getPlanetCycleLength(planet2)

  // Calculate synodic period
  const synodicPeriod = Math.abs((cycle1 * cycle2) / (cycle1 - cycle2))

  const cycles: Record<string, { description: string; significance: string }> = {
    Jupiter_Saturn: {
      description: 'Great Conjunction - 20 years',
      significance: 'Societal shifts, new eras, generational markers',
    },
    Jupiter_Uranus: {
      description: 'Expansion-Innovation cycle - 14 years',
      significance: 'Technological breakthroughs, freedom movements',
    },
    Saturn_Uranus: {
      description: 'Structure-Revolution cycle - 45 years',
      significance: 'Major societal restructuring, old vs new',
    },
    Uranus_Neptune: {
      description: 'Awakening-Transcendence cycle - 172 years',
      significance: 'Consciousness evolution, spiritual revolution',
    },
    Neptune_Pluto: {
      description: 'Vision-Transformation cycle - 492 years',
      significance: 'Civilizational transformation, age transitions',
    },
  }

  const key = `${planet1}_${planet2}`
  const reverseKey = `${planet2}_${planet1}`
  const cycleInfo = cycles[key] ||
    cycles[reverseKey] || {
      description: `${planet1}-${planet2} cycle - ${(synodicPeriod / 365.25).toFixed(1)} years`,
      significance: 'Planetary interaction and combined influence',
    }

  return {
    cycleLength: synodicPeriod,
    ...cycleInfo,
  }
}

// Identify active historical patterns for current date
export function getActivePatterns(date: Date = new Date()): TransitPattern[] {
  const currentTransits = getCurrentTransits(date)
  const patterns: TransitPattern[] = []

  currentTransits.forEach(transit => {
    // Calculate where we are in this transit
    const startDate = new Date(transit.startDate)
    const endDate = new Date(transit.endDate)
    const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    const daysIn = (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    const percentComplete = (daysIn / totalDays) * 100

    patterns.push({
      type: 'conjunction',
      planet: transit.planet,
      cycleLength: getPlanetCycleLength(transit.planet),
      description: `${transit.planet} in ${transit.sign} (${percentComplete.toFixed(0)}% complete)`,
      significance: transit.themes?.join(', ') || 'Transit in progress',
      frequency: `${(getPlanetCycleLength(transit.planet) / 365.25).toFixed(1)} year cycle`,
      lastOccurrence: startDate,
      nextOccurrence: endDate,
    })
  })

  return patterns
}
