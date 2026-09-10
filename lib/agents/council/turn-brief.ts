/**
 * TurnBrief Context Reducer
 *
 * Compiles a compact, surgical turn brief for an individual council delegate.
 * Deliberately withholds the full 10-body sky chart so the model cannot
 * recite a laundry list of placements.
 */

import { type TurnDirective } from './conversation-director'

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
  evidence: Array<{ id: string; label: string; aspectName?: string; orb?: number }>
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
  } = directive

  const evidenceBlock = evidence.map(e => `[${e.id}]: ${e.label}`).join('\n')

  const targetBlock = targetSpeakerName
    ? `Answering ${targetSpeakerName}'s previous assertion: "${targetClaim || 'the immediate vector'}"`
    : `Opening orientation for the chamber`

  const promptSections: string[] = [
    `DISCOURSE MOVE: ${speechAct.toUpperCase()}`,
    targetBlock,
    '',
    'PRIVATE GROUNDING EVIDENCE (incorporate the implication of 1 or 2 items; do NOT recite raw numbers):',
    evidenceBlock,
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
    })),
    wordTarget,
    userPrompt: inquiry,
    formattedPrompt: promptSections.join('\n'),
  }
}
