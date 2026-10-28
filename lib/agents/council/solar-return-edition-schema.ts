import { z } from 'zod'
import {
  COUNCIL_PLANETS,
  type CouncilSpeakerKey,
  type SolarReturnCouncilEdition,
} from './solar-return-types'
import { CANONICAL_SIGNS, SPEECH_ACTS, containsForbiddenTelemetry } from './council-schema'

const iso = z.string().datetime()
const dayRegex = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const SPEAKER_KEYS: readonly [CouncilSpeakerKey, ...CouncilSpeakerKey[]] = [
  'gregory',
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

const councilPlanetKeys = COUNCIL_PLANETS.map(p => p.toLowerCase())

export const SolarReturnPlanetKeySchema = z
  .string()
  .refine(val => councilPlanetKeys.includes(val), { message: 'Must be a valid council planet key' })

export const SolarReturnSpeakerKeySchema = z.enum(SPEAKER_KEYS)

export const SolarReturnTurnRoleSchema = z.enum([
  'opening',
  'integration',
  'planetary-reading',
  'closing',
])

export const SolarReturnPlanetPlacementSchema = z.object({
  planet: z.enum(COUNCIL_PLANETS),
  sign: z.enum(CANONICAL_SIGNS),
  degree: z.number().finite().min(0).lt(30),
  longitude: z.number().finite().min(0).lt(360),
  speed: z.number().finite().optional(),
  retrograde: z.boolean(),
  dignity: z.string(),
  element: z.enum(['fire', 'water', 'earth', 'air']),
})

export const ElementalSpectrumSchema = z.object({
  fire: z.number().finite().nonnegative(),
  water: z.number().finite().nonnegative(),
  earth: z.number().finite().nonnegative(),
  air: z.number().finite().nonnegative(),
  percentages: z.object({
    fire: z.number().finite().min(0).max(1),
    water: z.number().finite().min(0).max(1),
    earth: z.number().finite().min(0).max(1),
    air: z.number().finite().min(0).max(1),
  }),
})

export const ESMSBalanceSchema = z.object({
  spirit: z.number().finite().nonnegative(),
  essence: z.number().finite().nonnegative(),
  matter: z.number().finite().nonnegative(),
  substance: z.number().finite().nonnegative(),
})

export const ThermodynamicStateSchema = z.object({
  heat: z.number().finite(),
  reactivity: z.number().finite(),
  entropy: z.number().finite(),
  gregsEnergy: z.number().finite(),
})

export const SolarReturnSkySnapshotSchema = z.object({
  iso: iso,
  timestamp: z.number().finite(),
  source: z.enum(['swiss-ephemeris', 'vsop87-approximation']),
  quality: z.enum(['verified', 'approximate']),
  positions: z
    .record(SolarReturnPlanetPlacementSchema)
    .refine(
      posMap => COUNCIL_PLANETS.every(planet => Boolean(posMap[planet])),
      'All 10 council planets must be present in positions map'
    ),
  elements: ElementalSpectrumSchema,
  esms: ESMSBalanceSchema,
  thermodynamics: ThermodynamicStateSchema,
})

export const ShiftedRulerSchema = z.object({
  planet: z.enum(COUNCIL_PLANETS),
  fromSign: z.enum(CANONICAL_SIGNS),
  toSign: z.enum(CANONICAL_SIGNS),
  shifted: z.boolean(),
})

export const SolarAlignmentSchema = z.object({
  targetLongitude: z.number().finite().min(0).lt(360),
  returnLongitude: z.number().finite().min(0).lt(360),
  deltaArcminutes: z.number().finite().nonnegative(),
  exactMatch: z.boolean(),
  sign: z.enum(CANONICAL_SIGNS),
  degree: z.number().finite().min(0).lt(30),
  minute: z.number().finite().min(0).lt(60),
})

export const YearOverYearTelemetrySchema = z.object({
  solarAlignment: SolarAlignmentSchema,
  returnSky: SolarReturnSkySnapshotSchema,
  referenceSky: SolarReturnSkySnapshotSchema,
  shiftedRulers: z.array(ShiftedRulerSchema).min(1),
  elementalDeltas: z.object({
    fire: z.number().finite(),
    water: z.number().finite(),
    earth: z.number().finite(),
    air: z.number().finite(),
  }),
  esmsDeltas: z.object({
    spirit: z.number().finite(),
    essence: z.number().finite(),
    matter: z.number().finite(),
    substance: z.number().finite(),
  }),
  thermodynamicDeltas: z.object({
    heat: z.number().finite(),
    reactivity: z.number().finite(),
  }),
})

export const SolarReturnCouncilTurnSchema = z
  .object({
    id: z.string().min(1).max(250),
    speakerKey: SolarReturnSpeakerKeySchema,
    speakerName: z.string().min(1).max(80),
    role: SolarReturnTurnRoleSchema,
    text: z.string().min(50).max(5000),
    newClaim: z.string().min(10).max(1500),
    speechAct: z.enum(SPEECH_ACTS),
    usedEvidenceIds: z.array(z.string()).min(1),
    coverageIds: z.array(z.string()),
    targetTurnId: z.string().optional(),
    provenance: z.object({
      source: z.enum(['model', 'grounded_briefing']),
      modelFamily: z.enum(['fast', 'substantive']).optional(),
      latencyMs: z.number().finite().nonnegative().optional(),
    }),
  })
  .refine(turn => !containsForbiddenTelemetry(turn.text), {
    message: 'Turn text contains forbidden telemetry',
    path: ['text'],
  })
  .refine(turn => !containsForbiddenTelemetry(turn.newClaim), {
    message: 'Turn new claim contains forbidden telemetry',
    path: ['newClaim'],
  })

export const SolarReturnCouncilEditionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(250),
    date: dayRegex,
    timeZone: z.literal('UTC'),
    title: z.string().min(1).max(300),
    summary: z.string().min(1).max(3000),
    returnIso: iso,
    referenceIso: iso,
    quality: z.enum(['verified', 'approximate']),
    source: z.enum(['swiss-ephemeris', 'vsop87-approximation']),
    telemetry: YearOverYearTelemetrySchema,
    turns: z.array(SolarReturnCouncilTurnSchema).min(8).max(16),
    coveredTopics: z.array(z.string()),
    generatedAt: iso,
    promptVersion: z.string().min(1),
  })
  .superRefine((edition, ctx) => {
    const addError = (message: string) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message })
    }

    const firstTurn = edition.turns[0]
    const lastTurn = edition.turns[edition.turns.length - 1]

    if (!firstTurn || firstTurn.speakerKey !== 'gregory' || firstTurn.role !== 'opening') {
      addError('Gregory must open the Solar Return edition with role="opening"')
    }

    if (!lastTurn || lastTurn.speakerKey !== 'gregory' || lastTurn.role !== 'closing') {
      addError('Gregory must close the Solar Return edition with role="closing"')
    }

    const turnIds = new Set<string>()
    for (const turn of edition.turns) {
      if (turnIds.has(turn.id)) {
        addError(`Duplicate turn ID: ${turn.id}`)
      }
      turnIds.add(turn.id)
    }

    if ((edition.source === 'swiss-ephemeris') !== (edition.quality === 'verified')) {
      addError('Ephemeris source and quality provenance must agree')
    }
  })

export function parseSolarReturnCouncilEdition(value: unknown): SolarReturnCouncilEdition | null {
  let candidate = value
  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(value)
    } catch {
      return null
    }
  }
  const result = SolarReturnCouncilEditionSchema.safeParse(candidate)
  if (!result.success) {
    return null
  }
  return result.data
}

export const SolarReturnCouncilResponseSchema = z.object({
  status: z.enum(['published', 'briefing', 'stale', 'unavailable']),
  edition: SolarReturnCouncilEditionSchema.nullable(),
  message: z.string().optional(),
})
