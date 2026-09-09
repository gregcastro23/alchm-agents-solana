/**
 * Council Generation Schemas
 *
 * Enforces structured schema constraints on model outputs via Zod.
 */

import { z } from 'zod'

export const CouncilTurnGenerationSchema = z.object({
  text: z
    .string()
    .describe(
      'The articulate, voiced paragraph spoken into the council round table. Follows persona and brief directives.'
    ),
  newClaim: z
    .string()
    .describe(
      'The single, core substantive proposition or claim introduced in this turn that advances the conversation.'
    ),
  usedEvidenceIds: z
    .array(z.string())
    .describe(
      'The exact IDs of evidence items from the private grounding evidence list whose implications were woven into this turn.'
    ),
})

export type CouncilTurnGeneration = z.infer<typeof CouncilTurnGenerationSchema>

export interface CouncilTurnResponse {
  success: boolean
  speakerKey: string
  speakerName: string
  text: string
  newClaim: string
  speechAct: string
  usedEvidenceIds: string[]
  targetTurnId?: string
  provenance: {
    source: 'model' | 'grounded_briefing'
    modelFamily?: 'fast' | 'substantive'
    latencyMs?: number
  }
}
