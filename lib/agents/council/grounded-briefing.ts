import type { TurnBrief } from './turn-brief'
import { planetFromCouncilKey } from './planetary-personas'
import { ASPECT_MEANINGS, buildPlacementKnowledge } from './placement-knowledge'

export interface GroundedBriefingResult {
  text: string
  newClaim: string
  usedEvidenceIds: string[]
}

/** A clearly attributed, specific reading when model generation is unavailable. */
export function generateInterpretiveBriefing(
  brief: TurnBrief,
  _isSeekerTurn = false
): GroundedBriefingResult {
  const usedEvidenceIds: string[] = []
  const sentences: string[] = []
  const factualItems = brief.evidence.filter(
    item => item.snapshotFact && brief.requiredEvidenceIds?.includes(item.id)
  )
  for (const item of factualItems) {
    sentences.push(item.label)
    usedEvidenceIds.push(item.id)
  }
  const planet = planetFromCouncilKey(brief.speakerKey)
  const placementItem = brief.evidence.find(item => item.placement)
  const placement = placementItem?.placement
  if (planet && placement) {
    const knowledge = buildPlacementKnowledge({
      planet,
      sign: placement.sign,
      dignity: placement.dignity,
      retrograde: placement.retrograde,
    })
    sentences.push(knowledge.interpretation)
    sentences.push(
      `In this sign-dignity convention, ${knowledge.dignityMeaning}. A practical reflection is to ${knowledge.practice}.`
    )
    if (placement.retrograde) sentences.push(knowledge.motionMeaning)
    usedEvidenceIds.push(...brief.evidence.filter(item => item.placement).map(item => item.id))
  }

  for (const item of brief.evidence) {
    if (item.aspectName) {
      const meaning = ASPECT_MEANINGS[item.aspectName]
      if (meaning) {
        const pair = item.relationship
          ? `${item.relationship.bodyA} and ${item.relationship.bodyB}`
          : brief.speakerName
        sentences.push(`For ${pair}, ${meaning}.`)
        if (item.relationship?.phase === 'unknown')
          sentences.push('Its applying or separating state is unavailable in this snapshot.')
        usedEvidenceIds.push(item.id)
      }
    } else if (item.id === 'host-sky-overview') {
      sentences.push(
        `The supplied landscape is ${item.label}. Consider how the different functions share a practical choice, rather than assuming a single planetary mood describes everything.`
      )
      usedEvidenceIds.push(item.id)
    } else if (item.id === 'host-prior-claims') {
      if (brief.targetClaim)
        sentences.push(
          `The preceding reading offers this proposition: “${brief.targetClaim.slice(0, 200)}”. Use it as a perspective to examine, with your own circumstances and agency, rather than a prescribed outcome.`
        )
      usedEvidenceIds.push(item.id)
    } else if (item.id.startsWith('ev-natal-')) {
      sentences.push(
        'A supplied transit-to-natal contact connects this reading to the attached chart. It is a symbolic point of reflection, not proof of a particular life outcome.'
      )
      usedEvidenceIds.push(item.id)
    } else if (item.id.startsWith('seat-') && !placement) {
      sentences.push(
        `The supplied placement is ${item.label.replace(/\s*\([^)]*\)/g, '')}. Its sign provides the style through which the planetary function can be interpreted.`
      )
      usedEvidenceIds.push(item.id)
    }
  }

  if (
    brief.userPrompt &&
    !factualItems.some(item => item.snapshotFact === 'lunar' || item.snapshotFact === 'event')
  )
    sentences.push(
      'For your question, consider one small, reversible step that tests the reading against your actual needs; the sky alone cannot decide which choice is right for you.'
    )
  if (!sentences.length)
    sentences.push(
      'The available evidence does not support a specific interpretation yet. A complete, dated sky snapshot is needed before offering a grounded reading.'
    )
  return {
    text: sentences.join(' '),
    newClaim:
      factualItems
        .find(item => item.snapshotFact === 'lunar' || item.snapshotFact === 'event')
        ?.label.slice(0, 300) ||
      (placement && planet
        ? `${planet} in ${placement.sign} links ${buildPlacementKnowledge({ planet, sign: placement.sign }).planetMeaning} with ${buildPlacementKnowledge({ planet, sign: placement.sign }).signMeaning}`.slice(
            0,
            300
          )
        : brief.targetClaim
          ? 'The prior reading is a perspective to examine through present circumstances and personal agency.'
          : 'Distinct planetary functions provide several perspectives; no single placement determines a personal outcome.'),
    usedEvidenceIds: [...new Set(usedEvidenceIds)],
  }
}
