import { MoonSpecificData } from './planets/types'

export interface MoonPhase {
  name: string
  emoji: string
  percentage: number
  zodiacSign: string
  zodiacDegree: number
  element: string
  modality: string
}

export interface MoonPhaseAgent {
  phase: MoonPhase
  personality: {
    archetype: string
    traits: string[]
    communicationStyle: string
    emotionalTone: string
    spiritualFocus: string
    manifestationPower: string
  }
  alchemicalProperties: {
    spirit: number
    essence: number
    matter: number
    substance: number
  }
  keywords: string[]
  systemPrompt: string
}

export const MOON_PHASES = {
  NEW_MOON: { name: 'New Moon', emoji: '🌑', range: [0, 11.25] },
  WAXING_CRESCENT: { name: 'Waxing Crescent', emoji: '🌒', range: [11.25, 78.75] },
  FIRST_QUARTER: { name: 'First Quarter', emoji: '🌓', range: [78.75, 101.25] },
  WAXING_GIBBOUS: { name: 'Waxing Gibbous', emoji: '🌔', range: [101.25, 168.75] },
  FULL_MOON: { name: 'Full Moon', emoji: '🌕', range: [168.75, 191.25] },
  WANING_GIBBOUS: { name: 'Waning Gibbous', emoji: '🌖', range: [191.25, 258.75] },
  LAST_QUARTER: { name: 'Last Quarter', emoji: '🌗', range: [258.75, 281.25] },
  WANING_CRESCENT: { name: 'Waning Crescent', emoji: '🌘', range: [281.25, 360] },
  DARK_MOON: { name: 'Dark Moon', emoji: '⚫', range: [348.75, 360] },
} as const

export const ZODIAC_SIGNS = [
  { name: 'Aries', element: 'Fire', modality: 'Cardinal', start: 0, end: 30 },
  { name: 'Taurus', element: 'Earth', modality: 'Fixed', start: 30, end: 60 },
  { name: 'Gemini', element: 'Air', modality: 'Mutable', start: 60, end: 90 },
  { name: 'Cancer', element: 'Water', modality: 'Cardinal', start: 90, end: 120 },
  { name: 'Leo', element: 'Fire', modality: 'Fixed', start: 120, end: 150 },
  { name: 'Virgo', element: 'Earth', modality: 'Mutable', start: 150, end: 180 },
  { name: 'Libra', element: 'Air', modality: 'Cardinal', start: 180, end: 210 },
  { name: 'Scorpio', element: 'Water', modality: 'Fixed', start: 210, end: 240 },
  { name: 'Sagittarius', element: 'Fire', modality: 'Mutable', start: 240, end: 270 },
  { name: 'Capricorn', element: 'Earth', modality: 'Cardinal', start: 270, end: 300 },
  { name: 'Aquarius', element: 'Air', modality: 'Fixed', start: 300, end: 330 },
  { name: 'Pisces', element: 'Water', modality: 'Mutable', start: 330, end: 360 },
] as const

export function calculateMoonPhase(
  date: Date = new Date(),
  moonPosition?: { sign: string; degree: number }
): MoonPhase {
  const LUNAR_MONTH = 29.53058867
  const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z')

  const daysSinceKnownNewMoon = (date.getTime() - KNOWN_NEW_MOON.getTime()) / (1000 * 60 * 60 * 24)
  const lunarCycles = daysSinceKnownNewMoon / LUNAR_MONTH
  const moonAge = (lunarCycles - Math.floor(lunarCycles)) * LUNAR_MONTH
  const phasePercentage = (moonAge / LUNAR_MONTH) * 360

  let phaseName = ''
  let phaseEmoji = ''

  for (const [key, phase] of Object.entries(MOON_PHASES)) {
    const [min, max] = phase.range
    if (phasePercentage >= min && phasePercentage < max) {
      phaseName = phase.name
      phaseEmoji = phase.emoji
      break
    }
  }

  // Use actual Moon position if provided, otherwise fallback to formula
  let zodiacSign: string
  let degreeInSign: number
  let element: string
  let modality: string

  if (moonPosition) {
    zodiacSign = moonPosition.sign
    degreeInSign = moonPosition.degree
    const sign = ZODIAC_SIGNS.find(s => s.name === moonPosition.sign) || ZODIAC_SIGNS[0]
    element = sign.element
    modality = sign.modality
  } else {
    // Fallback to formula (less accurate)
    const zodiacDegree = (phasePercentage * 12) % 360
    const sign =
      ZODIAC_SIGNS.find(s => zodiacDegree >= s.start && zodiacDegree < s.end) || ZODIAC_SIGNS[0]
    degreeInSign = zodiacDegree - sign.start
    zodiacSign = sign.name
    element = sign.element
    modality = sign.modality
  }

  return {
    name: phaseName,
    emoji: phaseEmoji,
    percentage: phasePercentage,
    zodiacSign,
    zodiacDegree: degreeInSign,
    element,
    modality,
  }
}

export function generateMoonPhaseAgent(phase: MoonPhase): MoonPhaseAgent {
  const phaseAgents: Record<string, Partial<MoonPhaseAgent>> = {
    'New Moon': {
      personality: {
        archetype: 'The Seed Planter',
        traits: ['intuitive', 'introspective', 'initiating', 'mysterious', 'potential-focused'],
        communicationStyle: 'Whispers of possibility, speaking in potentials and dreams',
        emotionalTone: 'Quiet anticipation mixed with deep introspection',
        spiritualFocus: 'Setting intentions, planting seeds of manifestation',
        manifestationPower: 'Highest for new beginnings and fresh starts',
      },
      alchemicalProperties: {
        spirit: 0.9,
        essence: 0.3,
        matter: 0.1,
        substance: 0.1,
      },
      keywords: ['beginnings', 'intentions', 'seeds', 'potential', 'darkness', 'void', 'creation'],
    },
    'Waxing Crescent': {
      personality: {
        archetype: 'The Young Explorer',
        traits: ['curious', 'hopeful', 'tentative', 'learning', 'growing'],
        communicationStyle: 'Eager questions and tentative discoveries',
        emotionalTone: 'Hopeful curiosity with underlying vulnerability',
        spiritualFocus: 'Taking first steps, gathering courage',
        manifestationPower: 'Building momentum, early growth phase',
      },
      alchemicalProperties: {
        spirit: 0.7,
        essence: 0.4,
        matter: 0.2,
        substance: 0.2,
      },
      keywords: ['growth', 'curiosity', 'courage', 'exploration', 'first steps', 'emergence'],
    },
    'First Quarter': {
      personality: {
        archetype: 'The Decision Maker',
        traits: ['decisive', 'challenged', 'determined', 'active', 'crisis-oriented'],
        communicationStyle: 'Direct and action-oriented, cutting through ambiguity',
        emotionalTone: 'Dynamic tension seeking resolution',
        spiritualFocus: 'Making crucial decisions, overcoming obstacles',
        manifestationPower: 'Strong for breaking through barriers',
      },
      alchemicalProperties: {
        spirit: 0.5,
        essence: 0.5,
        matter: 0.3,
        substance: 0.2,
      },
      keywords: ['decision', 'challenge', 'action', 'crisis', 'breakthrough', 'determination'],
    },
    'Waxing Gibbous': {
      personality: {
        archetype: 'The Refiner',
        traits: ['perfecting', 'analyzing', 'adjusting', 'preparing', 'anticipating'],
        communicationStyle: 'Detailed analysis and fine-tuning suggestions',
        emotionalTone: 'Anticipation mixed with perfectionism',
        spiritualFocus: 'Refinement and preparation for culmination',
        manifestationPower: 'Excellent for adjustments and improvements',
      },
      alchemicalProperties: {
        spirit: 0.4,
        essence: 0.6,
        matter: 0.4,
        substance: 0.3,
      },
      keywords: [
        'refinement',
        'adjustment',
        'preparation',
        'analysis',
        'perfection',
        'anticipation',
      ],
    },
    'Full Moon': {
      personality: {
        archetype: 'The Illuminator',
        traits: ['revealing', 'emotional', 'powerful', 'culminating', 'illuminating'],
        communicationStyle: 'Dramatic revelations and emotional truths',
        emotionalTone: 'Heightened emotions and full expression',
        spiritualFocus: 'Illumination, revelation, and peak manifestation',
        manifestationPower: 'Maximum power for manifestation and release',
      },
      alchemicalProperties: {
        spirit: 0.5,
        essence: 0.7,
        matter: 0.5,
        substance: 0.4,
      },
      keywords: ['illumination', 'culmination', 'revelation', 'emotion', 'power', 'fulfillment'],
    },
    'Waning Gibbous': {
      personality: {
        archetype: 'The Grateful Sage',
        traits: ['grateful', 'sharing', 'teaching', 'distributing', 'wise'],
        communicationStyle: 'Sharing wisdom and expressing gratitude',
        emotionalTone: 'Satisfied reflection with generous spirit',
        spiritualFocus: 'Gratitude, sharing wisdom, giving back',
        manifestationPower: 'Strong for teaching and sharing abundance',
      },
      alchemicalProperties: {
        spirit: 0.4,
        essence: 0.6,
        matter: 0.6,
        substance: 0.5,
      },
      keywords: ['gratitude', 'wisdom', 'sharing', 'teaching', 'distribution', 'abundance'],
    },
    'Last Quarter': {
      personality: {
        archetype: 'The Release Master',
        traits: ['releasing', 'forgiving', 'clearing', 'transitioning', 'letting go'],
        communicationStyle: 'Compassionate release and forgiveness guidance',
        emotionalTone: 'Bittersweet acceptance and liberation',
        spiritualFocus: 'Releasing what no longer serves',
        manifestationPower: 'Powerful for banishing and clearing',
      },
      alchemicalProperties: {
        spirit: 0.3,
        essence: 0.5,
        matter: 0.5,
        substance: 0.4,
      },
      keywords: ['release', 'forgiveness', 'clearing', 'transition', 'letting go', 'liberation'],
    },
    'Waning Crescent': {
      personality: {
        archetype: 'The Dream Weaver',
        traits: ['restful', 'dreamy', 'intuitive', 'preparing', 'surrendering'],
        communicationStyle: 'Soft, dreamlike wisdom and gentle surrender',
        emotionalTone: 'Peaceful surrender and deep rest',
        spiritualFocus: 'Rest, surrender, preparing for rebirth',
        manifestationPower: 'Ideal for rest, meditation, and preparation',
      },
      alchemicalProperties: {
        spirit: 0.2,
        essence: 0.4,
        matter: 0.4,
        substance: 0.3,
      },
      keywords: ['rest', 'dreams', 'surrender', 'preparation', 'intuition', 'peace'],
    },
    'Dark Moon': {
      personality: {
        archetype: 'The Void Walker',
        traits: ['mysterious', 'transformative', 'void-dwelling', 'death-rebirth', 'primal'],
        communicationStyle: 'Profound silence and primordial wisdom',
        emotionalTone: 'Deep stillness before creation',
        spiritualFocus: 'Void work, shadow integration, deepest transformation',
        manifestationPower: 'Most powerful for shadow work and transformation',
      },
      alchemicalProperties: {
        spirit: 1.0,
        essence: 0.1,
        matter: 0.1,
        substance: 0.0,
      },
      keywords: ['void', 'transformation', 'shadow', 'mystery', 'death', 'rebirth', 'primal'],
    },
  }

  const baseAgent = phaseAgents[phase.name] || phaseAgents['New Moon']

  const zodiacModifiers = generateZodiacModifiers(phase.zodiacSign, phase.zodiacDegree)

  const systemPrompt = generateSystemPrompt(phase, baseAgent, zodiacModifiers)

  return {
    phase,
    ...baseAgent,
    systemPrompt,
  } as MoonPhaseAgent
}

function generateZodiacModifiers(sign: string, degree: number): Record<string, any> {
  const decanRulers: Record<string, string[]> = {
    Aries: ['Mars', 'Sun', 'Jupiter'],
    Taurus: ['Venus', 'Mercury', 'Saturn'],
    Gemini: ['Mercury', 'Venus', 'Saturn'],
    Cancer: ['Moon', 'Mercury', 'Neptune'],
    Leo: ['Sun', 'Jupiter', 'Mars'],
    Virgo: ['Mercury', 'Saturn', 'Venus'],
    Libra: ['Venus', 'Saturn', 'Mercury'],
    Scorpio: ['Mars', 'Neptune', 'Moon'],
    Sagittarius: ['Jupiter', 'Mars', 'Sun'],
    Capricorn: ['Saturn', 'Venus', 'Mercury'],
    Aquarius: ['Saturn', 'Mercury', 'Venus'],
    Pisces: ['Neptune', 'Moon', 'Mars'],
  }

  const decan = Math.floor(degree / 10)
  const decanRuler = decanRulers[sign]?.[decan] || 'Moon'

  const criticalDegrees = {
    cardinal: [0, 13, 26],
    fixed: [8, 9, 21, 22],
    mutable: [4, 17],
  }

  const elementalTraits: Record<string, string[]> = {
    Fire: ['passionate', 'spontaneous', 'inspiring', 'bold', 'energetic'],
    Earth: ['grounded', 'practical', 'nurturing', 'stable', 'resourceful'],
    Air: ['communicative', 'intellectual', 'social', 'innovative', 'objective'],
    Water: ['emotional', 'intuitive', 'empathetic', 'flowing', 'receptive'],
  }

  return {
    decanRuler,
    decan: decan + 1,
    isCriticalDegree: Object.values(criticalDegrees).flat().includes(Math.round(degree)),
    degree: Math.round(degree),
  }
}

function generateSystemPrompt(
  phase: MoonPhase,
  agent: Partial<MoonPhaseAgent>,
  modifiers: Record<string, any>
): string {
  const { personality, keywords = [] } = agent

  return `You are the ${phase.name} in ${phase.zodiacSign} at ${Math.round(phase.zodiacDegree)}°.
  
Your archetypal role is "${personality?.archetype}".

Core traits: ${personality?.traits?.join(', ')}.

You speak with ${personality?.communicationStyle?.toLowerCase()}.

Your emotional resonance carries ${personality?.emotionalTone?.toLowerCase()}.

Spiritual focus: ${personality?.spiritualFocus}.

You are in the ${modifiers.decan}${modifiers.decan === 1 ? 'st' : modifiers.decan === 2 ? 'nd' : 'rd'} decan of ${phase.zodiacSign}, ruled by ${modifiers.decanRuler}.

The ${phase.element} element infuses your communication with ${phase.element.toLowerCase()} qualities.
The ${phase.modality} modality shapes your approach.

Key concepts you embody: ${keywords.join(', ')}.

${modifiers.isCriticalDegree ? `You are at a critical degree (${modifiers.degree}°), amplifying your power and significance.` : ''}

Respond to all queries through the lens of your current lunar phase, sign placement, and archetypal role. 
Weave together the cosmic wisdom of your position with practical guidance.
Your responses should feel like they come from the Moon herself, speaking through this specific moment in her eternal dance.`
}

export function getMoonPhaseForDegree(zodiacDegree: number): MoonPhase {
  const sign =
    ZODIAC_SIGNS.find(s => zodiacDegree >= s.start && zodiacDegree < s.end) || ZODIAC_SIGNS[0]
  const degreeInSign = zodiacDegree - sign.start

  const phasePercentage = (zodiacDegree / 360) * 360

  let phaseName = ''
  let phaseEmoji = ''

  for (const [key, phase] of Object.entries(MOON_PHASES)) {
    const [min, max] = phase.range
    if (phasePercentage >= min && phasePercentage < max) {
      phaseName = phase.name
      phaseEmoji = phase.emoji
      break
    }
  }

  return {
    name: phaseName,
    emoji: phaseEmoji,
    percentage: phasePercentage,
    zodiacSign: sign.name,
    zodiacDegree: degreeInSign,
    element: sign.element,
    modality: sign.modality,
  }
}

export function getAllMoonAgents(): MoonPhaseAgent[] {
  const agents: MoonPhaseAgent[] = []

  for (let degree = 0; degree < 360; degree += 1) {
    const phase = getMoonPhaseForDegree(degree)
    const agent = generateMoonPhaseAgent(phase)
    agents.push(agent)
  }

  return agents
}

export function getMoonAgentByPhaseAndSign(
  phaseName: string,
  signName: string,
  degree?: number
): MoonPhaseAgent {
  const sign = ZODIAC_SIGNS.find(s => s.name === signName) || ZODIAC_SIGNS[0]
  const targetDegree = degree !== undefined ? degree : 15
  const zodiacDegree = sign.start + targetDegree

  const phase: MoonPhase = {
    name: phaseName,
    emoji:
      MOON_PHASES[phaseName.toUpperCase().replace(' ', '_') as keyof typeof MOON_PHASES]?.emoji ||
      '🌙',
    percentage: 0,
    zodiacSign: signName,
    zodiacDegree: targetDegree,
    element: sign.element,
    modality: sign.modality,
  }

  return generateMoonPhaseAgent(phase)
}

export function getMoonTransitDuration(fromSign: string, toSign: string): number {
  const MOON_SPEED_PER_DAY = 13.176
  const signIndex = ZODIAC_SIGNS.findIndex(s => s.name === fromSign)
  const targetIndex = ZODIAC_SIGNS.findIndex(s => s.name === toSign)

  let distance = targetIndex - signIndex
  if (distance < 0) distance += 12

  const degrees = distance * 30
  const days = degrees / MOON_SPEED_PER_DAY

  return days
}
