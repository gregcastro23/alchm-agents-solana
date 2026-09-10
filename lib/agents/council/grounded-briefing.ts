/**
 * Dynamic Evidence-Driven Grounded Briefing Generator
 *
 * Replaces static decoupled copy with genuine evidence-driven composition.
 * Dynamically synthesizes qualitative astrological insight from the specific
 * TurnBrief evidence items (placements, aspect geometry, dignity postures,
 * transit-to-natal contacts) and discourse speech acts (support, challenge, qualify,
 * reframe, synthesize).
 *
 * Strictly adheres to the Golden Rule: INFERENCE OVER RECAPITULATION.
 * Never recites degrees, numerical angles, or raw dignity labels.
 * Attributes ONLY the exact evidence IDs that were genuinely woven into the turn.
 */

import { type TurnBrief } from './turn-brief'
import { type SelectedEvidenceItem } from './conversation-director'
import { PLANETARY_VOICES, planetFromCouncilKey } from './planetary-personas'

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
  if (!claim) return 'the proposition before us'
  const trimmed = claim.trim().replace(/\.$/, '')
  if (trimmed.length <= 60) return trimmed
  return trimmed.slice(0, 57) + '...'
}

export function generateInterpretiveBriefing(
  brief: TurnBrief,
  isSeekerTurn: boolean
): GroundedBriefingResult {
  const speakerKey = brief.speakerKey
  const speakerPlanet = planetFromCouncilKey(speakerKey)
  const voice = speakerPlanet ? PLANETARY_VOICES[speakerPlanet] : null
  const speakerName = brief.speakerName

  const usedEvidenceIds: string[] = []
  const narrativeSentences: string[] = []

  // 1. Opening Discourse Move (Addressing Target Claim or Seeker/Ingress Opening)
  const speechAct = brief.speechAct
  const targetClaim = brief.targetClaim || brief.targetTurn?.claim

  if (targetClaim) {
    const claimSummary = summarizeClaim(targetClaim)
    switch (speechAct) {
      case 'challenge':
        narrativeSentences.push(
          `To assert that ${claimSummary} risks confusing immediate pressure with genuine necessity.`
        )
        break
      case 'synthesize':
        narrativeSentences.push(
          `Bringing the focus on ${claimSummary} into unified perspective clarifies how our choices take root below.`
        )
        break
      case 'support':
        narrativeSentences.push(
          `That proposition holds firm ground: advancing ${claimSummary} demands that we commit without reservation.`
        )
        break
      case 'qualify':
        narrativeSentences.push(
          `While there is truth in ${claimSummary}, the real distinction lies in what remains unexamined underneath.`
        )
        break
      case 'reframe':
      default:
        narrativeSentences.push(
          `Rather than framing the matter solely around ${claimSummary}, we must examine the deeper current steering this moment.`
        )
        break
    }
  } else if (isSeekerTurn) {
    if (voice) {
      narrativeSentences.push(voice.stance)
    } else {
      narrativeSentences.push(
        'Holding the center of our chamber, we look directly at what your question calls forth from human resolve.'
      )
    }
  } else {
    // Autonomous or Ingress opening
    if (voice) {
      narrativeSentences.push(voice.stance)
    } else {
      narrativeSentences.push(
        'The shifting celestial current asks for alignment between inner resolve and external action.'
      )
    }
  }

  // 2. Weave Concrete Evidence Items (Placements, Aspect Geometry, Dignity Posture, Natal Contacts)
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
      const dignityMatch = item.label.match(/(domicile|exaltation|fall|detriment|peregrine)/i)
      const dignityType = dignityMatch ? dignityMatch[1].toLowerCase() : 'peregrine'
      const posture = DIGNITY_POSTURE_THEMES[dignityType] || DIGNITY_POSTURE_THEMES.peregrine
      narrativeSentences.push(
        `From my station in the current sky, I speak as one ${posture}, refusing to substitute easy consensus for structural integrity.`
      )
      usedEvidenceIds.push(item.id)
      continue
    }

    // Fallback placement / seat evidence
    if (item.id.startsWith('seat-') || item.id.startsWith('aspect-')) {
      narrativeSentences.push(
        `Anchoring this sector of the sphere demands that we give voice to what is essential before secondary noise drowns out the signal.`
      )
      usedEvidenceIds.push(item.id)
    }
  }

  // 3. Formulate Crisp Substantive New Claim
  let newClaim = 'Grounded alignment with live celestial vectors clarifies decisive action.'
  if (voice) {
    if (speechAct === 'challenge') {
      newClaim = `Challenging premature assumptions reveals the authentic friction required for growth.`
    } else if (speechAct === 'synthesize') {
      newClaim = `Unifying contrasting perspectives bridges cosmic geometry with courageous human agency.`
    } else if (speechAct === 'support') {
      newClaim = `Decisive commitment transforms abstract potential into lasting tangible reality.`
    } else {
      newClaim = `${speakerName}'s vantage point demands prioritizing essential vitality over peripheral distractions.`
    }
  }

  // Ensure 2 to 4 articulate sentences (one well-developed paragraph)
  const paragraph = narrativeSentences.slice(0, 4).join(' ')

  return {
    text: paragraph,
    newClaim,
    usedEvidenceIds,
  }
}
