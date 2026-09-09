/**
 * Interpretive Grounded Sky Briefing Generator
 *
 * Deterministic fallback generator for when model generation is unavailable
 * or credentials fail. Emits a qualitative, archetype-grounded interpretation
 * of the celestial dynamic without reciting coordinates, degrees, or dignity
 * labels into prose (the UI already renders coordinates).
 */

import { type TurnBrief } from './turn-brief'

export interface GroundedBriefingResult {
  text: string
  newClaim: string
  usedEvidenceIds: string[]
}

const INTERPRETIVE_ARCHETYPE_CLAIMS: Record<
  string,
  {
    seekerInterpretation: string
    autonomousInterpretation: string
    coreClaim: string
  }
> = {
  sun: {
    seekerInterpretation:
      'Solar clarity demands prioritizing the vital over the merely urgent. When surrounding currents feel divided, returning to your core center cuts through the noise and clarifies what genuinely deserves your devotion.',
    autonomousInterpretation:
      'A true center holds only if it survives interruption. Our circle remains coherent not by avoiding conflict, but by anchoring our creative vitality in what is essential.',
    coreClaim: 'Aligning with core vitality clarifies action and dissolves distraction.',
  },
  moon: {
    seekerInterpretation:
      'The instinctual tide senses what has not yet been spoken aloud. Moving through this degree asks for emotional honesty: allow what is changing underneath to settle before forcing premature composure.',
    autonomousInterpretation:
      'The room feels the emotional tide before any thesis is argued. When geometry tightens, pay attention to the bodily intuition that logic is trying to rush past.',
    coreClaim: 'Honoring instinctual truth grounds decisions before rationalization begins.',
  },
  mercury: {
    seekerInterpretation:
      'Distinction is the beginning of movement. Name the precise dilemma you are facing: once the boundary between the necessary and the superfluous is articulated, practical next steps become obvious.',
    autonomousInterpretation:
      'Naming a thing correctly is half of moving it. The friction across our stations is simply an invitation to make distinctions the rest of the room is blurring.',
    coreClaim: 'Sharp distinctions transform conceptual confusion into actionable clarity.',
  },
  venus: {
    seekerInterpretation:
      'True proportion is found by honoring what you value deeply rather than what immediate pressure demands. Refuse to sacrifice your inner dignity for superficial harmony.',
    autonomousInterpretation:
      'Value is what endures after force exhausts itself. When pressure mounts between our sectors, balance is restored by safeguarding what is worth keeping.',
    coreClaim: 'True balance protects inherent value without compromising inner dignity.',
  },
  mars: {
    seekerInterpretation:
      'Action tests reality in a way deliberation cannot. When friction builds, the remedy is neither hesitation nor bluster, but choosing what must be protected and taking one decisive, irreversible step.',
    autonomousInterpretation:
      'Deliberation past clarity becomes avoidance. What our geometry demands right now is direct courage: cut through circling debate and make the first move.',
    coreClaim: 'Decisive intentional action tests reality and resolves lingering hesitation.',
  },
  jupiter: {
    seekerInterpretation:
      'Whatever obstacle appears before you is a smaller fragment of an expanding horizon. What presents as friction is an invitation to enlarge your perspective and act with generous wisdom.',
    autonomousInterpretation:
      'The constraint being defended was chosen, not given. Widening the aperture reveals that current tension is opening space for a more generous architecture.',
    coreClaim: 'Enlarging the interpretive frame reveals opportunity inside apparent constraint.',
  },
  saturn: {
    seekerInterpretation:
      'Enduring structure is not created in haste. The resistance you encounter asks for disciplined realism: strip away decorative optimism, respect natural timelines, and build strictly on bedrock fundamentals.',
    autonomousInterpretation:
      'Enthusiasm is easy; structural endurance is the test. The pressure across our circle asks us what will still be standing once the immediate current subsides.',
    coreClaim: 'Enduring integrity requires disciplined boundaries and sober realism.',
  },
  uranus: {
    seekerInterpretation:
      'A genuine breakthrough requires releasing the unspoken assumption holding your dilemma in place. Welcome the sudden angle rather than defending an outworn pattern.',
    autonomousInterpretation:
      'Revelation without a defended priority becomes spectacle, but inherited form without interruption becomes a tomb. Break the frame nobody stated.',
    coreClaim: 'Challenging unspoken assumptions opens the path to genuine breakthrough.',
  },
  neptune: {
    seekerInterpretation:
      'Dissolve the illusion of rigid separation around your dilemma. Beneath the anxiety of control lies a deeper intuitive current; trust what emerges when you quiet the noise.',
    autonomousInterpretation:
      'The hard lines being argued across the room belong more to fear than to truth. What remains when the boundary is relaxed is the actual alchemical current.',
    coreClaim: 'Quiet intuitive surrender dissolves artificial boundaries and restores trust.',
  },
  pluto: {
    seekerInterpretation:
      'Rebirth begins the moment you stop defending what has already died. Welcome honest catharsis and shed what is outworn so your authentic authority can regenerate.',
    autonomousInterpretation:
      'Name what is actually at stake. Harmony that defends a dead form is merely avoidance; strip away triviality and let what has run its course conclude.',
    coreClaim: 'Releasing outworn structures allows authentic authority to regenerate.',
  },
  gregory: {
    seekerInterpretation:
      'Holding the center of our chamber, I hear your question meeting the live clockwork of the current sky. Every shifting degree is an invitation to align your courage and craft with cosmic agency.',
    autonomousInterpretation:
      'Watching our delegates converse across the chamber reminds us of why we attune to the transits: the geometry above is a mirror for our own creative resolve below.',
    coreClaim: 'Celestial geometry awakens human agency and creative resolve.',
  },
}

export function generateInterpretiveBriefing(
  brief: TurnBrief,
  isSeekerTurn: boolean
): GroundedBriefingResult {
  const key = (brief.speakerKey || 'gregory').toLowerCase()
  const mapping = INTERPRETIVE_ARCHETYPE_CLAIMS[key] || INTERPRETIVE_ARCHETYPE_CLAIMS.gregory

  const text = isSeekerTurn ? mapping.seekerInterpretation : mapping.autonomousInterpretation

  const usedEvidenceIds = brief.evidence.slice(0, 2).map(e => e.id)

  return {
    text,
    newClaim: mapping.coreClaim,
    usedEvidenceIds,
  }
}
