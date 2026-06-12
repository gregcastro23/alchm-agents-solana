/**
 * Moon Phase Calculator
 * Calculates precise moon phase and degree-specific lunar personalities
 */

export type MoonPhase =
  | 'New Moon'
  | 'Waxing Crescent'
  | 'First Quarter'
  | 'Waxing Gibbous'
  | 'Full Moon'
  | 'Waning Gibbous'
  | 'Last Quarter'
  | 'Waning Crescent'

export type LunarDegreePersonality = {
  phase: MoonPhase
  degree: number // 0-359 degrees
  illumination: number // 0-100%
  personality: string
  emotionalTone: string
  communicationStyle: string
  strengths: string[]
  challenges: string[]
  alchemicalBonus: {
    spirit: number
    essence: number
    matter: number
    substance: number
  }
}

// Known new moon dates for accurate calculation (UTC)
const NEW_MOON_DATES = [
  new Date('2024-01-11T11:57:00Z'),
  new Date('2024-02-09T22:59:00Z'),
  new Date('2024-03-10T09:00:00Z'),
  new Date('2024-04-08T18:21:00Z'),
  new Date('2024-05-08T03:22:00Z'),
  new Date('2024-06-06T12:38:00Z'),
  new Date('2024-07-05T22:57:00Z'),
  new Date('2024-08-04T11:13:00Z'),
  new Date('2024-09-03T01:55:00Z'),
  new Date('2024-10-02T18:49:00Z'),
  new Date('2024-11-01T12:47:00Z'),
  new Date('2024-12-01T06:21:00Z'),
  new Date('2024-12-30T22:27:00Z'),
  new Date('2025-01-29T12:36:00Z'),
  new Date('2025-02-28T00:45:00Z'),
  new Date('2025-03-29T10:58:00Z'),
  new Date('2025-04-27T19:31:00Z'),
  new Date('2025-05-27T03:02:00Z'),
  new Date('2025-06-25T10:31:00Z'),
  new Date('2025-07-24T19:11:00Z'),
  new Date('2025-08-23T06:06:00Z'),
  new Date('2025-09-21T19:54:00Z'),
  new Date('2025-10-21T12:25:00Z'),
  new Date('2025-11-20T06:47:00Z'),
  new Date('2025-12-20T01:43:00Z'),
]

const LUNAR_CYCLE_DAYS = 29.53059 // Average lunar cycle length

/**
 * Calculate moon phase for a given date
 */
export function calculateMoonPhase(date: Date = new Date()): MoonPhase {
  const moonAge = getMoonAge(date)
  const phaseProgress = (moonAge / LUNAR_CYCLE_DAYS) * 360 // Convert to degrees

  if (phaseProgress < 11.25 || phaseProgress >= 348.75) {
    return 'New Moon'
  } else if (phaseProgress < 78.75) {
    return 'Waxing Crescent'
  } else if (phaseProgress < 101.25) {
    return 'First Quarter'
  } else if (phaseProgress < 168.75) {
    return 'Waxing Gibbous'
  } else if (phaseProgress < 191.25) {
    return 'Full Moon'
  } else if (phaseProgress < 258.75) {
    return 'Waning Gibbous'
  } else if (phaseProgress < 281.25) {
    return 'Last Quarter'
  } else {
    return 'Waning Crescent'
  }
}

/**
 * Get moon age in days since last new moon
 */
function getMoonAge(date: Date): number {
  // Find the most recent new moon before the given date
  let lastNewMoon = NEW_MOON_DATES[0]

  for (const newMoonDate of NEW_MOON_DATES) {
    if (newMoonDate <= date) {
      lastNewMoon = newMoonDate
    } else {
      break
    }
  }

  // Calculate days since last new moon
  const daysSince = (date.getTime() - lastNewMoon.getTime()) / (1000 * 60 * 60 * 24)

  // Handle cycles beyond our known dates
  if (date > NEW_MOON_DATES[NEW_MOON_DATES.length - 1]) {
    const cyclesSince = Math.floor(daysSince / LUNAR_CYCLE_DAYS)
    return daysSince - cyclesSince * LUNAR_CYCLE_DAYS
  }

  return daysSince % LUNAR_CYCLE_DAYS
}

/**
 * Calculate moon illumination percentage
 */
export function calculateMoonIllumination(date: Date = new Date()): number {
  const moonAge = getMoonAge(date)
  const phaseProgress = moonAge / LUNAR_CYCLE_DAYS

  // Calculate illumination based on phase progress
  if (phaseProgress <= 0.5) {
    // Waxing: 0% to 100%
    return phaseProgress * 200
  } else {
    // Waning: 100% to 0%
    return 200 - phaseProgress * 200
  }
}

/**
 * Get specific lunar degree (0-359)
 */
export function getMoonDegree(date: Date = new Date()): number {
  const moonAge = getMoonAge(date)
  return Math.round((moonAge / LUNAR_CYCLE_DAYS) * 360) % 360
}

/**
 * Generate degree-specific lunar personality
 */
export function getLunarDegreePersonality(degree: number, sign?: string): LunarDegreePersonality {
  const phase = getPhaseFromDegree(degree)
  const illumination = getIlluminationFromDegree(degree)

  // Each degree has unique personality traits
  const personalities = generateDegreePersonalities()
  const personality = personalities[degree]

  // Phase-specific emotional tones
  const emotionalTones: Record<MoonPhase, string> = {
    'New Moon': 'introspective and initiating',
    'Waxing Crescent': 'hopeful and determined',
    'First Quarter': 'decisive and challenging',
    'Waxing Gibbous': 'refining and perfecting',
    'Full Moon': 'illuminated and expressive',
    'Waning Gibbous': 'grateful and sharing',
    'Last Quarter': 'releasing and forgiving',
    'Waning Crescent': 'contemplative and restful',
  }

  // Communication styles based on degree ranges
  const communicationStyle = getCommunicationStyle(degree)

  // Calculate alchemical bonuses based on phase and degree
  const alchemicalBonus = calculateAlchemicalBonus(phase, degree)

  return {
    phase,
    degree,
    illumination,
    personality,
    emotionalTone: emotionalTones[phase],
    communicationStyle,
    strengths: getStrengths(phase, degree),
    challenges: getChallenges(phase, degree),
    alchemicalBonus,
  }
}

/**
 * Get phase from degree
 */
function getPhaseFromDegree(degree: number): MoonPhase {
  if (degree < 11.25 || degree >= 348.75) return 'New Moon'
  if (degree < 78.75) return 'Waxing Crescent'
  if (degree < 101.25) return 'First Quarter'
  if (degree < 168.75) return 'Waxing Gibbous'
  if (degree < 191.25) return 'Full Moon'
  if (degree < 258.75) return 'Waning Gibbous'
  if (degree < 281.25) return 'Last Quarter'
  return 'Waning Crescent'
}

/**
 * Get illumination from degree
 */
function getIlluminationFromDegree(degree: number): number {
  const normalized = degree / 360
  if (normalized <= 0.5) {
    return normalized * 200
  } else {
    return 200 - normalized * 200
  }
}

/**
 * Generate unique personalities for each degree
 */
function generateDegreePersonalities(): string[] {
  const personalities: string[] = []

  // Generate 360 unique personalities based on degree
  for (let i = 0; i < 360; i++) {
    const phase = getPhaseFromDegree(i)
    const decan = Math.floor(i / 10) // 36 decans
    const microPhase = i % 30 // Position within zodiac sign

    let personality = ''

    // Base personality from phase
    const phaseTraits: Record<MoonPhase, string> = {
      'New Moon': 'pioneering',
      'Waxing Crescent': 'emerging',
      'First Quarter': 'assertive',
      'Waxing Gibbous': 'developing',
      'Full Moon': 'illuminating',
      'Waning Gibbous': 'disseminating',
      'Last Quarter': 'reorganizing',
      'Waning Crescent': 'surrendering',
    }

    // Add decan-specific modifier
    const decanModifiers = [
      'bold',
      'steady',
      'curious',
      'nurturing',
      'creative',
      'analytical',
      'harmonizing',
      'transformative',
      'adventurous',
      'ambitious',
      'innovative',
      'compassionate',
    ]

    // Add micro-phase detail
    const microModifiers = [
      'initiating',
      'building',
      'stabilizing',
      'questioning',
      'expanding',
      'perfecting',
      'balancing',
      'intensifying',
      'philosophizing',
      'structuring',
      'revolutionizing',
      'transcending',
      'integrating',
      'crystallizing',
      'releasing',
    ]

    personality = `${phaseTraits[phase]}, ${decanModifiers[decan % 12]} and ${microModifiers[Math.floor(microPhase / 2)]}`

    personalities.push(personality)
  }

  return personalities
}

/**
 * Get communication style based on degree
 */
function getCommunicationStyle(degree: number): string {
  const styles = [
    'direct and initiating', // 0-29
    'gentle and receptive', // 30-59
    'versatile and informative', // 60-89
    'nurturing and protective', // 90-119
    'expressive and dramatic', // 120-149
    'precise and helpful', // 150-179
    'diplomatic and balanced', // 180-209
    'intense and penetrating', // 210-239
    'philosophical and expansive', // 240-269
    'structured and authoritative', // 270-299
    'innovative and detached', // 300-329
    'intuitive and compassionate', // 330-359
  ]

  const index = Math.floor(degree / 30)
  return styles[index] || styles[0]
}

/**
 * Get strengths based on phase and degree
 */
function getStrengths(phase: MoonPhase, degree: number): string[] {
  const phaseStrengths: Record<MoonPhase, string[]> = {
    'New Moon': ['innovation', 'fresh starts', 'planting seeds'],
    'Waxing Crescent': ['determination', 'growth', 'faith'],
    'First Quarter': ['decision-making', 'action', 'courage'],
    'Waxing Gibbous': ['refinement', 'adjustment', 'persistence'],
    'Full Moon': ['illumination', 'fulfillment', 'celebration'],
    'Waning Gibbous': ['wisdom', 'gratitude', 'sharing'],
    'Last Quarter': ['release', 'forgiveness', 'transformation'],
    'Waning Crescent': ['rest', 'reflection', 'preparation'],
  }

  // Add degree-specific strength
  const degreeStrength = degree < 180 ? 'building momentum' : 'integrating wisdom'

  return [...phaseStrengths[phase], degreeStrength]
}

/**
 * Get challenges based on phase and degree
 */
function getChallenges(phase: MoonPhase, degree: number): string[] {
  const phaseChallenges: Record<MoonPhase, string[]> = {
    'New Moon': ['uncertainty', 'lack of clarity', 'vulnerability'],
    'Waxing Crescent': ['impatience', 'doubt', 'resistance'],
    'First Quarter': ['conflict', 'obstacles', 'tension'],
    'Waxing Gibbous': ['perfectionism', 'anxiety', 'overthinking'],
    'Full Moon': ['overwhelm', 'exposure', 'emotional intensity'],
    'Waning Gibbous': ['letting go', 'overgiving', 'depletion'],
    'Last Quarter': ['endings', 'crisis', 'breakdown'],
    'Waning Crescent': ['exhaustion', 'isolation', 'confusion'],
  }

  // Add degree-specific challenge
  const degreeChallenge = degree % 90 < 45 ? 'maintaining focus' : 'accepting change'

  return [...phaseChallenges[phase], degreeChallenge]
}

/**
 * Calculate alchemical bonus based on phase and degree
 */
function calculateAlchemicalBonus(
  phase: MoonPhase,
  degree: number
): {
  spirit: number
  essence: number
  matter: number
  substance: number
} {
  // Base values from phase
  const phaseBase: Record<MoonPhase, any> = {
    'New Moon': { spirit: 0.1, essence: 0.3, matter: 0.1, substance: 0.1 },
    'Waxing Crescent': { spirit: 0.2, essence: 0.4, matter: 0.2, substance: 0.2 },
    'First Quarter': { spirit: 0.3, essence: 0.5, matter: 0.3, substance: 0.2 },
    'Waxing Gibbous': { spirit: 0.4, essence: 0.6, matter: 0.4, substance: 0.3 },
    'Full Moon': { spirit: 0.5, essence: 0.7, matter: 0.5, substance: 0.4 },
    'Waning Gibbous': { spirit: 0.4, essence: 0.6, matter: 0.6, substance: 0.5 },
    'Last Quarter': { spirit: 0.3, essence: 0.5, matter: 0.5, substance: 0.4 },
    'Waning Crescent': { spirit: 0.2, essence: 0.4, matter: 0.4, substance: 0.3 },
  }

  const base = phaseBase[phase]

  // Add degree-specific modulation (subtle variations)
  const degreeModulation = Math.sin((degree * Math.PI) / 180) * 0.1

  return {
    spirit: Math.max(0, base.spirit + degreeModulation),
    essence: Math.max(0, base.essence + degreeModulation * 0.5),
    matter: Math.max(0, base.matter - degreeModulation * 0.3),
    substance: Math.max(0, base.substance + degreeModulation * 0.2),
  }
}

/**
 * Get moon phase emoji
 */
export function getMoonPhaseEmoji(phase: MoonPhase): string {
  const emojis: Record<MoonPhase, string> = {
    'New Moon': '🌑',
    'Waxing Crescent': '🌒',
    'First Quarter': '🌓',
    'Waxing Gibbous': '🌔',
    'Full Moon': '🌕',
    'Waning Gibbous': '🌖',
    'Last Quarter': '🌗',
    'Waning Crescent': '🌘',
  }
  return emojis[phase]
}
