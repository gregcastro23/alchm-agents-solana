/**
 * Council Generation & API Schemas
 *
 * Enforces structured schema constraints on API requests and model outputs via Zod.
 */

import { z } from 'zod'

export const SPEECH_ACTS = ['support', 'challenge', 'qualify', 'reframe', 'synthesize'] as const
export type SpeechAct = (typeof SPEECH_ACTS)[number]

export const BASKET_AGENT_KEYS = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'gregory',
] as const
export type BasketAgentKey = (typeof BASKET_AGENT_KEYS)[number]

export const CouncilTurnGenerationSchema = z.object({
  text: z
    .string()
    .min(100, 'Turn text must be at least 100 characters')
    .max(1200, 'Turn text must not exceed 1200 characters')
    .describe(
      'The articulate, voiced paragraph spoken into the council round table. Follows persona and brief directives.'
    ),
  newClaim: z
    .string()
    .min(15, 'New claim must be at least 15 characters')
    .max(300, 'New claim must not exceed 300 characters')
    .describe(
      'The single, core substantive proposition or claim introduced in this turn that advances the conversation.'
    ),
  usedEvidenceIds: z
    .array(z.string())
    .min(1, 'Must cite at least one used evidence ID')
    .describe(
      'The exact IDs of evidence items from the private grounding evidence list whose implications were woven into this turn.'
    ),
})

export type CouncilTurnGeneration = z.infer<typeof CouncilTurnGenerationSchema>

export const CouncilApiRequestSchema = z.object({
  seekerInquiry: z.string().max(1000).optional(),
  targetDelegate: z.enum(BASKET_AGENT_KEYS).optional(),
  attachedNatalEnvelope: z.unknown().optional(),
  ingressEvent: z
    .object({
      movingPlanet: z.string().min(1).max(30),
      newSign: z.string().min(1).max(30),
      newDegree: z.number().min(0).max(30),
      turnIndex: z.number().int().min(0).max(4).optional(),
      isFinalWord: z.boolean().optional(),
    })
    .optional(),
  recentTurns: z
    .array(
      z.object({
        turnId: z.string().max(100),
        speakerKey: z.enum(BASKET_AGENT_KEYS),
        speakerName: z.string().max(50),
        text: z.string().max(1200),
        claim: z.string().max(300),
        speechAct: z.enum(SPEECH_ACTS).optional(),
      })
    )
    .max(10)
    .optional(),
  selectedAgentFilter: z.string().max(50).optional(),
  skyOverride: z.record(z.string(), z.any()).optional(),
})

export type CouncilApiRequest = z.infer<typeof CouncilApiRequestSchema>

export interface CouncilProvenance {
  source: 'model' | 'grounded_briefing'
  modelFamily?: 'fast' | 'substantive'
  latencyMs?: number
}

export interface CouncilTurnResponse {
  success: boolean
  speakerKey: BasketAgentKey
  speakerName: string
  text: string
  newClaim: string
  speechAct: SpeechAct
  usedEvidenceIds: string[]
  targetTurnId?: string
  provenance: CouncilProvenance
}
