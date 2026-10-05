/**
 * TurnBrief Context Reducer
 *
 * Compiles a compact, surgical turn brief for an individual council delegate.
 * Deliberately withholds the full 10-body sky chart so the model cannot
 * recite a laundry list of placements.
 */

import { type TurnDirective, type SelectedEvidenceItem } from './conversation-director'

export interface TurnBrief {
  speakerKey: string
  speakerName: string
  targetTurn?: {
    turnId?: string
    speakerName?: string
    claim?: string
  }
  targetClaim?: string
  speechAct: string
  evidence: SelectedEvidenceItem[]
  requiredEvidenceIds?: string[]
  wordTarget: { min: number; max: number }
  userPrompt?: string
  formattedPrompt: string
}

export function compileTurnBrief(directive: TurnDirective, inquiry?: string): TurnBrief {
  const {
    speakerKey,
    speakerName,
    targetSpeakerName,
    targetClaim,
    targetTurnId,
    speechAct,
    evidence,
    directive: instruction,
    wordTarget,
    requiredEvidenceIds,
  } = directive

  const evidenceBlock = evidence.map(e => `[${e.id}]: ${e.label}`).join('\n')

  const targetBlock = targetSpeakerName
    ? `Answering ${targetSpeakerName}'s previous assertion: "${targetClaim || 'the immediate vector'}"`
    : `Opening orientation for the chamber`

  const promptSections: string[] = [
    `DISCOURSE MOVE: ${speechAct.toUpperCase()}`,
    targetBlock,
    '',
    'GROUNDING EVIDENCE (answer requested facts directly; interpret selected placements. Exact coordinates and private metrics stay out of speech. Supplied UTC event times may be stated):',
    evidenceBlock,
    requiredEvidenceIds?.length
      ? `FACTS REQUIRED TO ANSWER THIS QUESTION (cite and explain these IDs): ${requiredEvidenceIds.join(', ')}`
      : '',
    requiredEvidenceIds?.includes('edition-basis')
      ? 'State the opening snapshot date (YYYY-MM-DD) in the spoken text; label approximated positions explicitly. When event-horizon is required, state the UTC end date of the supplied window. Keep the answer itself complete; newClaim is private conversation bookkeeping.'
      : '',
    '',
    `TURN INSTRUCTION: ${instruction}`,
    '',
    `LENGTH & DENSITY TARGET: approximately ${wordTarget.min} to ${wordTarget.max} words in one articulate, poignant paragraph. Introduce one clear new claim.`,
  ]

  if (inquiry) {
    promptSections.unshift(`SEEKER QUESTION: "${inquiry}"\n`)
  }

  return {
    speakerKey,
    speakerName,
    targetTurn: targetSpeakerName
      ? {
          turnId: targetTurnId,
          speakerName: targetSpeakerName,
          claim: targetClaim,
        }
      : undefined,
    targetClaim,
    speechAct,
    evidence: evidence.map(e => ({
      id: e.id,
      label: e.label,
      aspectName: e.aspectName,
      orb: e.orb,
      placement: e.placement,
      relationship: e.relationship,
      snapshotFact: e.snapshotFact,
    })),
    wordTarget,
    userPrompt: inquiry,
    requiredEvidenceIds,
    formattedPrompt: promptSections.join('\n'),
  }
}
