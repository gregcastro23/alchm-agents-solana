import { getRulingPlanet, getSignElement, getSignModality } from '@/lib/astrological-data'
import { PLANETARY_TRAITS, type Planet } from '@/lib/agents/planetary-traits'
import { DEGREE_PLANETARY_AGENT_MAPPING } from '@/lib/degree-planetary-agent-mapping'
import { getPlanetaryAgent } from './planetary-agents'

/** Interpretive vocabulary, deliberately separate from measured sky evidence. */
import { PLACEMENT_KNOWLEDGE_VERSION } from './council-version'
export { PLACEMENT_KNOWLEDGE_VERSION } from './council-version'
export const PLACEMENT_FRAMEWORK =
  'Project-authored synthesis of Western astrological symbolism; interpretations are reflective possibilities, not measured causes or predictions.'

export const SIGN_KNOWLEDGE: Record<string, { meaning: string; practice: string }> = {
  Aries: {
    meaning: 'initiative, directness and willingness to begin',
    practice: 'make a small first move with a clear boundary',
  },
  Taurus: {
    meaning: 'steadiness, embodied values and patient cultivation',
    practice: 'give the work a sustainable pace and a tangible foundation',
  },
  Gemini: {
    meaning: 'curiosity, exchange and considering more than one angle',
    practice: 'ask a second question before settling on the first explanation',
  },
  Cancer: {
    meaning: 'care, memory, belonging and emotional continuity',
    practice: 'name what needs protection and who carries the consequences',
  },
  Leo: {
    meaning: 'creative confidence, generosity and being seen',
    practice: 'share a piece of work with warmth while leaving room for others',
  },
  Virgo: {
    meaning: 'discernment, useful craft and careful refinement',
    practice: 'improve one specific detail without demanding perfection',
  },
  Libra: {
    meaning: 'reciprocity, proportion and negotiating shared values',
    practice: 'make the terms of an exchange fair and explicit',
  },
  Scorpio: {
    meaning: 'emotional honesty, hidden stakes and deep change',
    practice: 'identify the attachment or unspoken concern beneath the surface',
  },
  Sagittarius: {
    meaning: 'meaning, exploration and widening the horizon',
    practice: 'test an assumption by seeking a perspective beyond your usual circle',
  },
  Capricorn: {
    meaning: 'responsibility, durable structure and earned progress',
    practice: 'turn the ambition into a commitment you can actually maintain',
  },
  Aquarius: {
    meaning: 'independence, collective systems and questioning convention',
    practice: 'ask who benefits from the current arrangement and what could work differently',
  },
  Pisces: {
    meaning: 'imagination, compassion and porous boundaries',
    practice: 'make space for intuition, then give it a practical boundary',
  },
}

export const PLANET_FUNCTIONS: Record<Planet, string> = {
  Sun: 'purpose, identity and creative vitality',
  Moon: 'emotional needs, instinct and daily rhythms',
  Mercury: 'communication, learning and how we make distinctions',
  Venus: 'relationships, attraction and what we value',
  Mars: 'initiative, conflict and how we act on desire',
  Jupiter: 'growth, meaning and the scope of our expectations',
  Saturn: 'responsibility, limits and what can endure',
  Uranus: 'change, independence and questioning established patterns',
  Neptune: 'imagination, compassion and the boundary between vision and uncertainty',
  Pluto: 'power, deep attachments and the structures involved in transformation',
}

export const DIGNITY_MEANINGS: Record<string, string> = {
  domicile:
    'the planetary function has a familiar mode of expression, though familiarity is no guarantee of a good outcome',
  rulership:
    'the planetary function has a familiar mode of expression, though familiarity is no guarantee of a good outcome',
  exaltation:
    'the tradition gives this planetary function an emphasized expression; confidence still benefits from proportion',
  detriment:
    'the planetary function works through a contrasting style and may benefit from translation rather than force',
  fall: 'the planetary function calls for extra care in this style; tension can invite adaptation rather than predict failure',
  peregrine:
    'the planetary function has no major sign dignity in this convention, so its relationships provide useful context',
}

export const ASPECT_MEANINGS: Record<string, string> = {
  Conjunction:
    'a conjunction brings two planetary functions together, concentrating or blending their concerns',
  Square:
    'a square describes friction between functions that ask for action in different directions',
  Opposition:
    'an opposition places two functions across an axis, inviting perspective and balance without erasing either side',
  Trine: 'a trine describes an easier flow between functions, which still needs conscious use',
  Sextile: 'a sextile describes a cooperative opening that benefits from participation',
  Quincunx:
    'a quincunx describes differing styles that call for adjustment rather than an automatic fit',
  Semisextile: 'a semisextile describes a nearby difference that may require small adjustments',
  Semisquare:
    'a semisquare describes a subtler friction that can benefit from a practical adjustment',
  Sesquiquadrate:
    'a sesquiquadrate describes persistent friction that can ask for a change of approach',
}

export interface PlacementKnowledgeInput {
  planet: Planet
  sign: string
  dignity?: string
  retrograde?: boolean
  speed?: number
  degree?: number
}

// Different planetary functions produce different tasks, even in the same sign.
const PLANET_PRACTICES: Record<Planet, string> = {
  Sun: 'choose the purpose you want your next decision to serve',
  Moon: 'name an emotional need before deciding what would actually nourish it',
  Mercury: 'rewrite one unclear message so another person can answer it',
  Venus: 'identify what each person values in an exchange before negotiating its terms',
  Mars: 'choose a concrete first action and a boundary that keeps it constructive',
  Jupiter: 'test a hopeful plan against an experience outside your usual perspective',
  Saturn: 'give one commitment a realistic limit, deadline or supporting routine',
  Uranus: 'question an inherited rule and try a small, reversible alternative',
  Neptune: 'give an imaginative idea a form you can share and check for misunderstanding',
  Pluto: 'notice who holds power in an arrangement and name a change that returns agency',
}

export function buildPlacementKnowledge(input: PlacementKnowledgeInput) {
  const sign = SIGN_KNOWLEDGE[input.sign]
  if (!sign) throw new Error(`Unknown placement sign: ${input.sign}`)
  const element = getSignElement(input.sign)
  const modality = getSignModality(input.sign)
  const modalityMeaning = {
    Cardinal: 'begins and initiates',
    Fixed: 'sustains and concentrates',
    Mutable: 'adapts and revises',
    Unknown: 'unspecified',
  }[modality]
  const dignityMeaning =
    DIGNITY_MEANINGS[input.dignity || 'peregrine'] || DIGNITY_MEANINGS.peregrine
  const signs = Object.keys(SIGN_KNOWLEDGE)
  const withinSign = Math.min(29, Math.max(0, Math.floor(input.degree ?? 15)))
  const signSource = DEGREE_PLANETARY_AGENT_MAPPING[signs.indexOf(input.sign) * 30 + withinSign]
  const canonical = getPlanetaryAgent(input.planet.toLowerCase())
  return {
    id: `knowledge-${input.planet.toLowerCase()}-${input.sign.toLowerCase()}`,
    version: PLACEMENT_KNOWLEDGE_VERSION,
    framework: PLACEMENT_FRAMEWORK,
    planetMeaning: PLANET_FUNCTIONS[input.planet],
    signMeaning: sign.meaning,
    element,
    modality,
    ruler: getRulingPlanet(input.sign),
    signThemes: signSource.themes,
    signQualities: signSource.qualities,
    sourceIds: [
      'canonical-planetary-traits',
      'canonical-crafted-planetary-agent',
      'degree-planetary-agent-mapping',
    ],
    perspective: {
      beliefs: canonical?.coreBeliefs?.slice(0, 2) || [],
      gift: canonical?.personality?.gifts?.[0]?.expression,
      shadow: canonical?.personality?.shadows?.[0]?.transformationPath,
    },
    dignityMeaning,
    interpretation: `${input.planet} in ${input.sign} connects ${PLANET_FUNCTIONS[input.planet]} with ${sign.meaning}. Its ${element.toLowerCase()} symbolism works through a style that ${modalityMeaning}.`,
    practice: `${PLANET_PRACTICES[input.planet]}; then ${sign.practice}`,
    motionMeaning:
      input.speed === undefined
        ? 'Motion is unmeasured in this supplied snapshot; do not infer a direct or retrograde state from a default Boolean.'
        : input.retrograde
          ? 'Retrograde means apparent backward movement as seen from Earth. Within this interpretive framework it can invite review; it does not imply that events must go wrong.'
          : 'Direct motion describes apparent forward movement as seen from Earth; it does not guarantee progress in a person’s life.',
    domains: PLANETARY_TRAITS[input.planet].wisdomDomains,
  }
}

export function describePlacement(input: PlacementKnowledgeInput): string {
  const knowledge = buildPlacementKnowledge(input)
  return `${knowledge.interpretation} A practical reflection is to ${knowledge.practice}.${input.retrograde ? ` ${knowledge.motionMeaning}` : ''}`
}
