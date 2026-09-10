/**
 * Council Generation & API Schemas
 *
 * Enforces structured schema constraints on API requests and model outputs via Zod.
 * Prohibits telemetry, coordinate recitation, and raw dignity jargon from model text.
 */

import { z } from 'zod'

export const SPEECH_ACTS = [
  'support',
  'challenge',
  'qualify',
  'reframe',
  'synthesize',
  'inaugurate',
] as const
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

export const CANONICAL_PLANETS = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
] as const
export type CanonicalPlanet = (typeof CANONICAL_PLANETS)[number]

export const CANONICAL_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const
export type CanonicalSign = (typeof CANONICAL_SIGNS)[number]

/**
 * Forbidden telemetry patterns: raw degrees, degree labels, crude dignity jargon,
 * internal system metrics, and numeric percentages.
 */
export const FORBIDDEN_TELEMETRY_PATTERNS = [
  /\b\d{1,2}(?:\.\d+)?°\b/i,
  /\b\d{1,2}\s*degrees?\b/i,
  /\b(in\s+)?(domicile|exaltation|detriment|fall|peregrine)\b/i,
  /\b(monica\s+constant|alchm\s+yield|consciousness\s+velocity|vector\s+field|turnbrief|turndirective)\b/i,
  /\b\d{1,3}%\b/,
]

export function containsForbiddenTelemetry(str: string): boolean {
  return FORBIDDEN_TELEMETRY_PATTERNS.some(pat => pat.test(str))
}

export const CouncilTurnGenerationSchema = z
  .object({
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
  .refine(val => !containsForbiddenTelemetry(val.text), {
    message: 'Turn text contains forbidden telemetry (degrees, dignity labels, or system metrics)',
    path: ['text'],
  })
  .refine(val => !containsForbiddenTelemetry(val.newClaim), {
    message: 'New claim contains forbidden telemetry',
    path: ['newClaim'],
  })

export type CouncilTurnGeneration = z.infer<typeof CouncilTurnGenerationSchema>

export const SkyBodyOverrideSchema = z.object({
  sign: z.enum(CANONICAL_SIGNS),
  degree: z.number().min(0).lt(30),
  speed: z.number().optional(),
  retrograde: z.boolean().optional(),
})

export const SkyOverrideMapSchema = z.record(z.string(), SkyBodyOverrideSchema).refine(
  map => {
    const requiredKeys: BasketAgentKey[] = [
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
    ]
    return requiredKeys.every(k => k in map)
  },
  { message: 'skyOverride must provide all 10 core planetary bodies' }
)

export const CouncilApiRequestSchema = z.object({
  turnIndex: z.number().int().min(0).max(4).optional(),
  seekerInquiry: z.string().max(1000).optional(),
  targetDelegate: z.enum(BASKET_AGENT_KEYS).optional(),
  attachedNatalEnvelope: z.unknown().optional(),
  ingressEvent: z
    .object({
      movingPlanet: z.enum(CANONICAL_PLANETS),
      newSign: z.enum(CANONICAL_SIGNS),
      newDegree: z.number().min(0).lt(30),
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
  skyOverride: SkyOverrideMapSchema.optional(),
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
