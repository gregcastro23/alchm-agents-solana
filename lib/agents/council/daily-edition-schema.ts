import { z } from 'zod'
import { COUNCIL_PLANETS, type DailyCouncilEdition } from './daily-council-types'
import { detectAspect } from './aspect-dialogue-engine'
import { buildLunarState } from './lunar-state'

const iso = z.string().datetime()
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const keys = COUNCIL_PLANETS.map(planet => planet.toLowerCase())
const planetKey = z.string().refine(value => keys.includes(value))
const skyEvent = z.object({
  id: z.string().min(1),
  type: z.enum(['sign_ingress', 'station', 'lunar_phase', 'aspect_exact']),
  at: iso,
  bodies: z.array(planetKey).min(1),
  description: z.string().min(1),
  evidenceId: z.string().min(1),
})
const signs = [
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
const position = z.object({
  sign: z.enum(signs),
  degree: z.number().finite().min(0).lt(30),
  longitude: z.number().finite().min(0).lt(360),
  speed: z.number().finite().optional(),
  source: z.enum(['swiss-ephemeris', 'vsop87-approximation']),
  asOf: iso,
  retrograde: z.boolean(),
  dignity: z.string(),
  element: z.string(),
  modality: z.string(),
})

export const DailyCouncilTurnSchema = z.object({
  id: z.string().min(1).max(250),
  speakerKey: z.string().refine(value => value === 'gregory' || keys.includes(value)),
  speakerName: z.string().min(1).max(80),
  text: z.string().min(1).max(5000),
  newClaim: z.string().min(1).max(1500),
  speechAct: z.string().min(1),
  usedEvidenceIds: z.array(z.string()).min(1),
  coverageIds: z.array(z.string()),
  targetTurnId: z.string().optional(),
  provenance: z.object({
    source: z.enum(['model', 'grounded_briefing']),
    modelFamily: z.enum(['fast', 'substantive']).optional(),
    latencyMs: z.number().finite().nonnegative().optional(),
  }),
})

/** Validate persisted/public data before allowing it to become a displayed edition. */
export const DailyCouncilEditionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(250),
    date: day,
    timeZone: z.literal('UTC'),
    title: z.string().min(1).max(300),
    summary: z.string().min(1).max(3000),
    brief: z.object({
      id: z.string().min(1),
      date: day,
      timeZone: z.literal('UTC'),
      startAt: iso,
      endAt: iso,
      asOf: iso,
      source: z.enum(['swiss-ephemeris', 'vsop87-approximation']),
      quality: z.enum(['verified', 'approximate']),
      positions: z
        .record(position)
        .refine(value => COUNCIL_PLANETS.every(planet => planet in value)),
      aspects: z.array(
        z.object({
          bodyA: planetKey,
          bodyB: planetKey,
          aspectName: z.string(),
          angle: z.number().finite().min(0).max(180),
          orb: z.number().finite().nonnegative(),
          phase: z.enum(['applying', 'separating', 'exact', 'unknown']),
          quality: z.string(),
          major: z.boolean(),
        })
      ),
      lunar: z.object({
        phase: z.string(),
        elongation: z.number().finite().min(0).lt(360),
        illumination: z.number().finite().min(0).max(1),
        sign: z.string(),
      }),
      events: z.array(skyEvent),
      evidence: z
        .array(
          z.object({
            id: z.string(),
            kind: z.enum(['placement', 'aspect', 'lunar', 'motion', 'event', 'overview']),
            label: z.string(),
            bodyKeys: z.array(planetKey),
            coverageIds: z.array(z.string()),
          })
        )
        .min(1),
      requiredCoverage: z.array(z.string()).min(1),
      warnings: z.array(z.string()),
      changes: z.object({ previousDate: day, items: z.array(z.string().min(1)).min(1) }).optional(),
    }),
    turns: z.array(DailyCouncilTurnSchema).min(8).max(16),
    coveredTopics: z.array(z.string()),
    generatedAt: iso,
    generation: z.enum(['model', 'mixed', 'grounded_briefing']),
    promptVersion: z.string().min(1),
  })
  .superRefine((edition, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message })
    if (edition.date !== edition.brief.date) fail('Edition and sky dates differ')
    if (
      !edition.brief.startAt.startsWith(edition.date) ||
      edition.brief.asOf !== edition.brief.startAt
    )
      fail('Edition must use its declared UTC start snapshot')
    if (
      edition.brief.startAt !== `${edition.date}T00:00:00.000Z` ||
      Date.parse(edition.brief.endAt) - Date.parse(edition.brief.startAt) !== 86_400_000
    )
      fail('Edition must cover one UTC day')
    if (
      edition.turns[0]?.speakerKey !== 'gregory' ||
      edition.turns.at(-1)?.speakerKey !== 'gregory'
    )
      fail('Gregory must open and close the edition')
    if ((edition.brief.source === 'swiss-ephemeris') !== (edition.brief.quality === 'verified'))
      fail('Sky provenance is inconsistent')
    if (Object.keys(edition.brief.positions).length !== COUNCIL_PLANETS.length)
      fail('Exactly ten sky bodies are required')
    for (const body of Object.values(edition.brief.positions)) {
      if (Math.abs(signs.indexOf(body.sign) * 30 + body.degree - body.longitude) > 0.000001)
        fail('Placement and longitude disagree')
      if (body.speed !== undefined && body.retrograde !== body.speed < 0)
        fail('Motion and velocity disagree')
      if (body.source && body.source !== edition.brief.source)
        fail('Body source differs from edition source')
      if (body.asOf && body.asOf !== edition.brief.asOf)
        fail('Body observation time differs from edition time')
    }
    const { Sun, Moon } = edition.brief.positions
    if (Sun && Moon) {
      const lunar = buildLunarState(Sun.longitude, Moon.longitude, Moon.sign)
      if (
        edition.brief.lunar.phase !== lunar.phase ||
        edition.brief.lunar.sign !== lunar.sign ||
        Math.abs(edition.brief.lunar.elongation - lunar.elongation) > 0.000001 ||
        Math.abs(edition.brief.lunar.illumination - lunar.illumination) > 0.000001
      )
        fail('Lunar state disagrees with the opening snapshot')
    }
    const aspectPairs = new Set<string>()
    for (const aspect of edition.brief.aspects) {
      const pair = [aspect.bodyA, aspect.bodyB].sort().join('-')
      if (aspect.bodyA === aspect.bodyB || aspectPairs.has(pair))
        fail('Aspect body pairs must be distinct and unique')
      aspectPairs.add(pair)
      const bodyFor = (key: string) =>
        edition.brief.positions[key.charAt(0).toUpperCase() + key.slice(1)]
      const a = bodyFor(aspect.bodyA),
        b = bodyFor(aspect.bodyB)
      if (!a || !b) continue
      const measured = detectAspect(a.longitude, b.longitude, a.speed, b.speed)
      const phase =
        edition.brief.quality === 'approximate' && measured?.phase === 'exact'
          ? 'unknown'
          : measured?.phase
      if (
        !measured ||
        aspect.aspectName !== measured.name ||
        aspect.angle !== measured.definition.angle ||
        Math.abs(aspect.orb - measured.orb) > 0.000001 ||
        aspect.phase !== phase ||
        aspect.quality !== measured.quality ||
        aspect.major !== measured.definition.major
      )
        fail('Aspect disagrees with the opening snapshot')
    }
    if (edition.brief.quality === 'approximate' && edition.brief.events.length)
      fail('Approximate skies cannot claim verified events')
    if (
      edition.brief.events.some(
        event => event.at < edition.brief.startAt || event.at >= edition.brief.endAt
      )
    )
      fail('Event is outside the edition day')
    const evidence = new Map(edition.brief.evidence.map(item => [item.id, item]))
    if (evidence.size !== edition.brief.evidence.length) fail('Evidence IDs must be unique')
    if (new Set(edition.brief.events.map(event => event.id)).size !== edition.brief.events.length)
      fail('Event IDs must be unique')
    for (const event of edition.brief.events) {
      const support = evidence.get(event.evidenceId)
      if (!support || support.kind !== 'event' || !support.coverageIds.includes(event.id))
        fail('Event requires matching evidence')
    }
    if (edition.brief.changes) {
      if (
        Date.parse(`${edition.date}T00:00:00.000Z`) -
          Date.parse(`${edition.brief.changes.previousDate}T00:00:00.000Z`) !==
        86_400_000
      )
        fail('Sky changes must compare consecutive UTC days')
      if (!evidence.has('sky-changes') || !edition.brief.requiredCoverage.includes('sky-changes'))
        fail('Sky changes require evidence and coverage')
    }
    const mandatory = [
      ...keys.map(key => `placement-${key}`),
      'lunar-state',
      'motion-state',
      'sky-overview',
      'outer-context',
    ]
    if (mandatory.some(id => !edition.brief.requiredCoverage.includes(id)))
      fail('Daily outline omits essential topics')
    const allowedCoverage = new Set(edition.brief.evidence.flatMap(item => item.coverageIds))
    const covered = new Set(edition.turns.flatMap(turn => turn.coverageIds))
    for (const turn of edition.turns) {
      if (turn.usedEvidenceIds.some(id => !evidence.has(id)))
        fail('Turn references absent evidence')
      const supportedCoverage = new Set(
        turn.usedEvidenceIds.flatMap(id => evidence.get(id)?.coverageIds ?? [])
      )
      if (turn.coverageIds.some(id => !allowedCoverage.has(id) || !supportedCoverage.has(id)))
        fail('Turn claims coverage without supporting evidence')
    }
    if (edition.brief.requiredCoverage.some(id => !covered.has(id)))
      fail('Daily coverage is incomplete')
    if (
      edition.coveredTopics.some(id => !covered.has(id)) ||
      [...covered].some(id => !edition.coveredTopics.includes(id))
    )
      fail('Edition coverage does not match its turns')
    if (new Set(edition.turns.map(turn => turn.id)).size !== edition.turns.length)
      fail('Turn IDs must be unique')
  })

export function parseDailyCouncilEdition(value: unknown): DailyCouncilEdition | null {
  const result = DailyCouncilEditionSchema.safeParse(value)
  return result.success ? (result.data as DailyCouncilEdition) : null
}

export const DailyCouncilResponseSchema = z
  .object({
    edition: DailyCouncilEditionSchema.nullable(),
    previousEdition: DailyCouncilEditionSchema.optional(),
    updates: z.object({ asOf: iso, events: z.array(skyEvent) }).optional(),
    status: z.enum(['published', 'briefing', 'stale', 'unavailable']),
    message: z.string().optional(),
  })
  .refine(value => (value.status === 'unavailable') === (value.edition === null))
  .superRefine((value, ctx) => {
    if (!value.updates) return
    const brief = value.edition?.brief
    const events = value.updates.events
    if (
      !brief ||
      brief.quality !== 'verified' ||
      brief.source !== 'swiss-ephemeris' ||
      value.updates.asOf < brief.asOf ||
      new Set(events.map(event => event.id)).size !== events.length ||
      events.some(
        event =>
          event.at <= brief.asOf ||
          event.at > value.updates!.asOf ||
          !brief.events.some(known => JSON.stringify(known) === JSON.stringify(event))
      )
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Updates must reference elapsed verified events from this edition',
      })
  })
