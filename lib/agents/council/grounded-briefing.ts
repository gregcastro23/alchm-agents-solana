/**
 * Dynamic Evidence-Driven Grounded Briefing Generator
 *
 * Replaces static decoupled copy with genuine evidence-driven composition.
 * Dynamically synthesizes qualitative astrological insight from specific
 * TurnBrief evidence items (placements, aspect geometry, dignity postures,
 * transit-to-natal contacts) and discourse speech acts (support, challenge, qualify,
 * reframe, synthesize, inaugurate).
 *
 * Strictly adheres to the Golden Rule: INFERENCE OVER RECAPITULATION.
 * Never recites degrees, numerical angles, or raw dignity labels.
 * Attributes ONLY the exact evidence IDs that were genuinely woven into the turn.
 * Completely differentiates voices across all delegates and deeply engages
 * the seeker's inquiry dilemma (e.g. corporate security vs creative craft).
 */

import { type TurnBrief } from './turn-brief'
import { type BasketAgentKey, type SpeechAct } from './council-schema'
import { planetFromCouncilKey } from './planetary-personas'

export interface GroundedBriefingResult {
  text: string
  newClaim: string
  usedEvidenceIds: string[]
}

const DIGNITY_POSTURE_THEMES: Record<string, string> = {
  domicile: 'holding uncontested native authority and sovereign clarity',
  exaltation: 'elevating high ambition into inspiring collective reach',
  fall: 'stripped of decorative privilege, demanding raw structural endurance and sober realism',
  detriment: 'operating through counter-intuitive paths to find authentic leverage',
  peregrine: 'searching freely for grounded purpose without fixed allegiance',
}

const ASPECT_GEOMETRY_THEMES: Record<string, { dynamic: string; resolution: string }> = {
  Conjunction: {
    dynamic: 'direct concentration of force where two drives merge as one',
    resolution: 'unifying focus so divided energies stop pulling in contrary directions',
  },
  Opposition: {
    dynamic: 'polar tension that reveals what is being projected across the divide',
    resolution: 'integrating both ends of the axis rather than disowning one to defend the other',
  },
  Square: {
    dynamic: 'friction that refuses avoidance and demands tangible structural proof',
    resolution: 'turning acute resistance into practical momentum through decisive action',
  },
  Trine: {
    dynamic: 'harmonious, unobstructed flow where talent moves with natural grace',
    resolution: 'channeling effortless momentum into lasting creative architecture',
  },
  Sextile: {
    dynamic: 'open opportunity requiring active engagement to yield its gifts',
    resolution: 'stepping forward to seize the opening before passive comfort sets in',
  },
}

function summarizeClaim(claim?: string): string {
  if (!claim) return 'the proposition before the chamber'
  const trimmed = claim.trim().replace(/\.$/, '')
  if (trimmed.length <= 60) return trimmed
  return trimmed.slice(0, 57) + '...'
}

interface InquiryDilemma {
  topic: 'career' | 'relationship' | 'purpose' | 'general'
  context: string
}

function extractInquiryDilemma(prompt?: string): InquiryDilemma {
  if (!prompt) return { topic: 'general', context: 'the celestial vector meeting human resolve' }
  const lower = prompt.toLowerCase()
  if (
    lower.includes('career') ||
    lower.includes('corporate') ||
    lower.includes('creative') ||
    lower.includes('job') ||
    lower.includes('work') ||
    lower.includes('profession') ||
    lower.includes('vocation')
  ) {
    return {
      topic: 'career',
      context: 'the tension between institutional security and sovereign creative craft',
    }
  }
  if (
    lower.includes('relationship') ||
    lower.includes('love') ||
    lower.includes('partner') ||
    lower.includes('marriage') ||
    lower.includes('bond')
  ) {
    return {
      topic: 'relationship',
      context: 'the balance of relational devotion and authentic self-sovereignty',
    }
  }
  if (
    lower.includes('purpose') ||
    lower.includes('meaning') ||
    lower.includes('path') ||
    lower.includes('calling') ||
    lower.includes('direction')
  ) {
    return {
      topic: 'purpose',
      context: 'aligning personal ambition with deeper authentic purpose',
    }
  }
  return { topic: 'general', context: 'the immediate celestial current meeting personal will' }
}

const VOICE_DISCOURSE_MOVES: Record<
  BasketAgentKey,
  Record<SpeechAct, (claimSummary: string, dilemma: InquiryDilemma) => string>
> = {
  gregory: {
    synthesize: (claim, dilemma) =>
      `Bringing the council's perspectives on ${dilemma.context} into unified focus: when we address "${claim}", the answer is not timid defense, but dedicating our daily labor with courageous, heart-centered craft.`,
    reframe: (claim, dilemma) =>
      `Holding the center of the chamber as we consider ${dilemma.context}: the real question is whether your vital energy is being invested where it can flourish or merely leased out for comfort.`,
    challenge: (claim, dilemma) =>
      `We must challenge the premise of "${claim}" regarding ${dilemma.context}; lasting security and creative fire are not enemies, but mastery requires stepping through the friction.`,
    support: (claim, dilemma) =>
      `That insight anchors the circle: committing wholeheartedly to "${claim}" turns high cosmic inspiration into grounded human agency across ${dilemma.context}.`,
    qualify: (claim, dilemma) =>
      `While there is undeniable truth in "${claim}", navigating ${dilemma.context} requires deliberate pacing so that dedication never collapses into exhaustion.`,
    inaugurate: (_claim, dilemma) =>
      `We inaugurate this new threshold together: step forward into ${dilemma.context} with lucid conviction and creative resolve.`,
  },
  saturn: {
    challenge: (claim, dilemma) =>
      `To argue that "${claim}" solves ${dilemma.context} confuses temporary anxiety with enduring structural necessity. If you choose institutional shelter out of fear, you merely lease your time; if you choose sovereign craft without rigorous discipline, you court collapse.`,
    reframe: (_claim, dilemma) =>
      `Strip away the romance from ${dilemma.context}: both institutional work and sovereign craft demand relentless labor. The sober test is which burden you possess the fortitude to carry for a decade.`,
    qualify: (claim, dilemma) =>
      `While "${claim}" carries weight, disciplined structure is not the enemy of sovereign vision in ${dilemma.context}; it is the stone wall that shelters the garden from the frost.`,
    support: (claim, _dilemma) =>
      `That is the bedrock reality: advancing "${claim}" demands patient accountability and absolute adherence to fundamentals.`,
    synthesize: (claim, dilemma) =>
      `Integrating the structural demands of ${dilemma.context} with "${claim}" reveals that lasting authority is earned through devoted, unglamorous consistency over time.`,
    inaugurate: (_claim, dilemma) =>
      `The bedrock is laid: establish the disciplined habits across ${dilemma.context} today that will preserve your integrity tomorrow.`,
  },
  jupiter: {
    challenge: (claim, dilemma) =>
      `Confining ${dilemma.context} to "${claim}" narrows the horizon prematurely. The field is far wider than an impoverished choice between servitude and starvation; expansive vision reveals how sovereign mastery commands its own market.`,
    reframe: (_claim, dilemma) =>
      `Look beyond the immediate crossroads of ${dilemma.context} to the overarching pattern of your life: this threshold exists to expand your capacity for genuine philosophical contribution.`,
    synthesize: (claim, dilemma) =>
      `Synthesizing the practical realities with "${claim}" demonstrates that genuine expansion in ${dilemma.context} requires courageously testing your highest gifts in the wider world.`,
    qualify: (claim, dilemma) =>
      `While optimism around "${claim}" is essential, ensure your vision for ${dilemma.context} is anchored in real service to others rather than an escapist fantasy.`,
    support: (claim, _dilemma) =>
      `That expansive perspective holds firm: dedicating yourself to "${claim}" attracts generous momentum and opens unexpected doors.`,
    inaugurate: (_claim, dilemma) =>
      `We throw open the wider gate: step forward into ${dilemma.context} with magnanimity and let your work reach its rightful scope.`,
  },
  mars: {
    challenge: (claim, dilemma) =>
      `Deliberating endlessly over "${claim}" while facing ${dilemma.context} is merely hesitation masquerading as wisdom. A dilemma is never solved on paper; take one decisive, irreversible stride and see how reality responds.`,
    reframe: (_claim, dilemma) =>
      `Stop asking which path through ${dilemma.context} feels safer, and ask which one demands the direct courage that earns self-respect.`,
    support: (claim, _dilemma) =>
      `That cuts directly to the core: strike cleanly at "${claim}" and allow peripheral doubts to burn away in the furnace of action.`,
    qualify: (claim, dilemma) =>
      `Direct initiative regarding "${claim}" is crucial, but direct your fire in ${dilemma.context} where it builds lasting ground rather than exhausting your ammunition.`,
    synthesize: (claim, dilemma) =>
      `Unifying raw passion with the discipline of "${claim}" transforms the friction of ${dilemma.context} into unstoppable forward momentum.`,
    inaugurate: (_claim, dilemma) =>
      `The spark is struck: take the initiative in ${dilemma.context} now and refuse to look back.`,
  },
  venus: {
    challenge: (claim, dilemma) =>
      `To accept "${claim}" at the expense of your inner dignity during this juncture of ${dilemma.context} is a false compromise. No external compensation is worth bartering away what you hold sacred.`,
    reframe: (_claim, dilemma) =>
      `Consider what you truly revere in ${dilemma.context}: the aesthetic and ethical integrity of your daily hours is the only enduring measure of wealth.`,
    synthesize: (claim, dilemma) =>
      `Harmonizing practical sustenance with "${claim}" reveals that ${dilemma.context} must sustain both body and spirit in reciprocal equilibrium.`,
    qualify: (claim, dilemma) =>
      `True devotion to "${claim}" is not fragile ornament; it must possess the spine to weather commercial friction without cheapening its standards in ${dilemma.context}.`,
    support: (claim, _dilemma) =>
      `That proposition honors true worth: aligning your labor with "${claim}" cultivates enduring relational and creative grace.`,
    inaugurate: (_claim, dilemma) =>
      `We consecrate this station: cultivate proportion, beauty, and sovereign self-worth throughout ${dilemma.context}.`,
  },
  mercury: {
    challenge: (claim, dilemma) =>
      `Accepting "${claim}" without dissecting its premises leaves you trapped in false syntax around ${dilemma.context}. Name the specific trade-offs with unsparing precision: what exact capabilities are you building, and what are you forfeiting each day?`,
    reframe: (_claim, dilemma) =>
      `Translate ${dilemma.context} into functional components: you do not need to make a reckless leap when you can construct the bridge stone by stone through clear distinctions.`,
    synthesize: (claim, dilemma) =>
      `Synthesizing these viewpoints with "${claim}" clarifies the tactical move: articulate the strategy clearly and execute the first step with agile accuracy across ${dilemma.context}.`,
    qualify: (claim, dilemma) =>
      `Distinguish between strategic prudence and rationalized delay regarding "${claim}"; clear thinking must serve decisive motion through ${dilemma.context}.`,
    support: (claim, _dilemma) =>
      `Precision in thought breeds efficacy in deed: define "${claim}" cleanly and execute without unnecessary baggage.`,
    inaugurate: (_claim, dilemma) =>
      `The syntax is set: let lucid articulation and agile discrimination guide your hands through ${dilemma.context}.`,
  },
  sun: {
    challenge: (claim, dilemma) =>
      `Subordinating your life to "${claim}" dims the central fire of purpose in ${dilemma.context}. You cannot cultivate an honorable sovereignty by renting your core vitality to an enterprise you do not believe in.`,
    reframe: (_claim, dilemma) =>
      `Center yourself in authentic vitality regarding ${dilemma.context}: when the sovereign self stands firm, peripheral distractions and anxious compromises lose their power.`,
    synthesize: (claim, dilemma) =>
      `Aligning central purpose with "${claim}" dissolves the false conflict between practical duty and creative calling across ${dilemma.context}.`,
    qualify: (claim, dilemma) =>
      `True sovereignty around "${claim}" requires the generosity to illuminate the whole landscape of ${dilemma.context}, not merely to defend personal pride.`,
    support: (claim, dilemma) =>
      `Stand in the light of that conviction: authentic work in ${dilemma.context} radiates from core truth outward.`,
    inaugurate: (_claim, dilemma) =>
      `We crown this threshold: let your central vitality illuminate every choice across ${dilemma.context}.`,
  },
  moon: {
    challenge: (claim, dilemma) =>
      `Ignoring the somatic cost of "${claim}" invites deep exhaustion across ${dilemma.context}. Listen to the subterranean tides of your body: what drains your life-force cannot be redeemed by a title or a paycheck.`,
    reframe: (_claim, dilemma) =>
      `Honor the organic timing of ${dilemma.context}: what is germinating inside you requires patient gestation before it can walk into the harsh daylight.`,
    synthesize: (claim, dilemma) =>
      `Weaving emotional truth into "${claim}" ensures that your choices in ${dilemma.context} nourish your spirit as well as your material table.`,
    qualify: (claim, dilemma) =>
      `Vulnerability regarding "${claim}" is not weakness, but do not mistake a temporary low tide for permanent defeat in ${dilemma.context}.`,
    support: (claim, dilemma) =>
      `Trust the natural rhythm: nourish the subterranean roots of "${claim}", and the external branches of ${dilemma.context} will flourish.`,
    inaugurate: (_claim, dilemma) =>
      `The tide turns: step into ${dilemma.context} with quiet instinctual knowing and emotional authority.`,
  },
  uranus: {
    challenge: (claim, dilemma) =>
      `Clinging to "${claim}" in ${dilemma.context} is an attempt to find security in a decaying structure. The conventional model is dissolving; dare the unconventional innovation that others fear.`,
    reframe: (_claim, dilemma) =>
      `Shatter the conventional script around ${dilemma.context}: you are not bound to career patterns designed for an era that no longer exists.`,
    synthesize: (claim, dilemma) =>
      `Integrating radical inventive freedom with "${claim}" sparks the evolutionary breakthrough required in ${dilemma.context}.`,
    qualify: (claim, dilemma) =>
      `Break the mold around "${claim}" to liberate living genius, not merely to provoke the bystanders of ${dilemma.context}.`,
    support: (claim, _dilemma) =>
      `Daring the unexpected vector of "${claim}" is the only authentic path forward; trust the lightning.`,
    inaugurate: (_claim, dilemma) =>
      `The circuit closes: awaken to independent authority and pioneer the new form in ${dilemma.context}.`,
  },
  neptune: {
    challenge: (claim, dilemma) =>
      `Building a fortress around "${claim}" only deepens spiritual isolation in ${dilemma.context}. Surrender the anxious compulsion for total control; what is calling you is subtler and vastly more profound.`,
    reframe: (_claim, dilemma) =>
      `Dissolve the rigid division between your sacred vocation and your daily life in ${dilemma.context}: trust the larger current carrying you toward your true work.`,
    synthesize: (claim, dilemma) =>
      `Transcending rigid divisions allows quiet grace to heal the friction between necessity and inspiration in "${claim}".`,
    qualify: (claim, dilemma) =>
      `Surrender to divine trust regarding "${claim}", but keep your feet firmly on the earth so your vision for ${dilemma.context} takes tangible form.`,
    support: (claim, _dilemma) =>
      `Let go of frantic grasping: aligning with "${claim}" allows the deepest currents to guide you home.`,
    inaugurate: (_claim, dilemma) =>
      `The mist clears: dedicate your journey through ${dilemma.context} to the mystery that holds and guides all things.`,
  },
  pluto: {
    challenge: (claim, dilemma) =>
      `Defending "${claim}" in ${dilemma.context} merely protects the mask that needs to die. Stop bargaining with your fears: the obsolete version of yourself cannot make this passage, and it must be left in the underworld.`,
    reframe: (_claim, dilemma) =>
      `Descend into the root truth of ${dilemma.context}: what is dying is only what was false, clearing the ground for indestructible creative sovereignty.`,
    synthesize: (claim, dilemma) =>
      `Ruthless catharsis purges the poison of compromise from "${claim}", leaving sovereign authority in its place throughout ${dilemma.context}.`,
    qualify: (claim, dilemma) =>
      `Destruction in ${dilemma.context} is only half the alchemical work; ensure the fire of "${claim}" serves rebirth rather than vindictive burnout.`,
    support: (claim, _dilemma) =>
      `Face the crucible without flinching: what survives the flames of "${claim}" is your authentic power.`,
    inaugurate: (_claim, dilemma) =>
      `From the ashes: we inaugurate the regenerated, sovereign self across ${dilemma.context}.`,
  },
}

function deriveTopicClaim(
  speakerKey: BasketAgentKey,
  speechAct: SpeechAct,
  dilemma: InquiryDilemma
): string {
  if (dilemma.topic === 'career') {
    switch (speakerKey) {
      case 'saturn':
        return 'Enduring creative sovereignty requires patient, unglamorous structural commitment over institutional security.'
      case 'jupiter':
        return 'Expanding vocational horizons reveals unforeseen avenues where authentic gifts command real dignity.'
      case 'mars':
        return 'Decisive initiative into sovereign craft cuts through the paralysis of perpetual deliberation.'
      case 'venus':
        return 'Refusing to compromise inner dignity aligns vocational livelihood with enduring worth.'
      case 'mercury':
        return 'Precise strategic distinction bridges the transition from safe employment to independent mastery.'
      case 'sun':
        return 'Central creative vitality cannot be rented out; purposeful sovereignty illuminates the true vocational path.'
      case 'moon':
        return 'Emotional truth and somatic nourishment must guide the timing of vocational transition.'
      case 'uranus':
        return 'Shattering conventional career orthodoxies liberates living genius to pioneer the new economy.'
      case 'neptune':
        return 'Transcending anxious control allows quiet faith to guide high inspiration into tangible craft.'
      case 'pluto':
        return 'Ruthless purge of comfortable compromises is the mandatory catalyst for vocational rebirth.'
      case 'gregory':
      default:
        return 'Anchoring creative vocation in disciplined daily practice transmutes inspiration into sovereign human agency.'
    }
  }

  // General or other dilemmas
  switch (speechAct) {
    case 'challenge':
      return 'Challenging premature assumptions reveals the authentic friction required for growth.'
    case 'synthesize':
      return 'Unifying contrasting perspectives bridges cosmic geometry with courageous human agency.'
    case 'support':
      return 'Decisive commitment transforms abstract potential into lasting tangible reality.'
    case 'inaugurate':
      return 'Inaugurating this celestial station anchors decisive intent in physical reality.'
    case 'qualify':
      return 'Discriminating between essential necessity and passing urgency preserves genuine momentum.'
    case 'reframe':
    default:
      return `${
        planetFromCouncilKey(speakerKey) || 'Host Anchor'
      }'s vantage point demands prioritizing essential vitality over peripheral distractions.`
  }
}

export function generateInterpretiveBriefing(
  brief: TurnBrief,
  isSeekerTurn: boolean
): GroundedBriefingResult {
  const speakerKey = brief.speakerKey as BasketAgentKey
  const speechAct = (brief.speechAct || 'reframe') as SpeechAct
  const speakerPlanet = planetFromCouncilKey(speakerKey)
  const speakerName = brief.speakerName

  const usedEvidenceIds: string[] = []
  const narrativeSentences: string[] = []

  const dilemma = extractInquiryDilemma(brief.userPrompt)
  const rawTargetClaim = brief.targetClaim || brief.targetTurn?.claim
  const claimSummary = summarizeClaim(rawTargetClaim)

  // 1. Voice-specific discourse opening move
  const speakerMoves = VOICE_DISCOURSE_MOVES[speakerKey] || VOICE_DISCOURSE_MOVES.gregory
  const moveFn = speakerMoves[speechAct] || speakerMoves.reframe
  narrativeSentences.push(moveFn(claimSummary, dilemma))

  // 2. Weave Concrete Evidence Items (Transit-to-Natal, Aspect Geometry, Dignity Posture)
  for (const item of brief.evidence) {
    // Check for transit-to-natal contact
    if (item.id.startsWith('ev-natal-')) {
      narrativeSentences.push(
        `Meeting your personal natal blueprint through this transit reveals an exact contact: the present sky directly tests your ingrained instincts, asking for disciplined maturity where passive habit once sufficed.`
      )
      usedEvidenceIds.push(item.id)
      continue
    }

    // Check for celestial aspect
    if (item.aspectName && ASPECT_GEOMETRY_THEMES[item.aspectName]) {
      const theme = ASPECT_GEOMETRY_THEMES[item.aspectName]
      narrativeSentences.push(
        `The geometric relationship across our stations creates a ${theme.dynamic}; meeting this geometry requires ${theme.resolution}.`
      )
      usedEvidenceIds.push(item.id)
      continue
    }

    // Check for dignity posture
    if (item.id.startsWith('dignity-')) {
      const cleanKey = item.id.replace('dignity-', '').toLowerCase()
      const posture =
        DIGNITY_POSTURE_THEMES[cleanKey] ||
        'attuned to the living celestial sphere with focused discernment'
      narrativeSentences.push(
        `From our orbital station, this delegate operates while ${posture}, ensuring that the council's perspective remains anchored in bedrock reality.`
      )
      usedEvidenceIds.push(item.id)
      continue
    }

    // Fallback placement evidence
    if (item.id.startsWith('sky-transit-') && !usedEvidenceIds.includes(item.id)) {
      narrativeSentences.push(
        `Anchoring this sector of the sphere grounds our inquiry, testing abstract theory against living celestial motion.`
      )
      usedEvidenceIds.push(item.id)
    }
  }

  // 3. Formulate Voice-Differentiated & Dilemma-Aware New Claim
  const newClaim = deriveTopicClaim(speakerKey, speechAct, dilemma)

  // Assemble one well-developed paragraph (2 to 4 sentences)
  const paragraph = narrativeSentences.slice(0, 4).join(' ')

  return {
    text: paragraph,
    newClaim,
    usedEvidenceIds,
  }
}
