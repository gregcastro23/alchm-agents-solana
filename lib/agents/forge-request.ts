import { createHash } from 'node:crypto'
import { z } from 'zod'

const finite = z.number().finite()
const latitude = finite.min(-90).max(90)
const longitude = finite.min(-180).max(180)
const birthInfo = z
  .object({
    year: finite.int().refine(year => year !== 0),
    month: finite.int().min(1).max(12),
    day: finite.int().min(1).max(31),
    hour: finite.int().min(0).max(23),
    minute: finite.int().min(0).max(59),
    latitude,
    longitude,
  })
  .refine(value => {
    const date = new Date(0)
    date.setUTCFullYear(value.year, value.month - 1, value.day)
    return (
      date.getUTCFullYear() === value.year &&
      date.getUTCMonth() === value.month - 1 &&
      date.getUTCDate() === value.day
    )
  }, 'Invalid birth date')

// Parse before looking up a key: malformed payloads must never retrieve an agent.
// Unrecognized fields are omitted from the fingerprint, and object field order
// is normalized by these schemas. A changed consumed field yields a 409 replay.
export const ForgeRequestSchema = z
  .object({
    clientRequestId: z.string().uuid().optional(),
    name: z
      .string()
      .max(100)
      .refine(name => name.trim().length > 0),
    birthInfo: birthInfo.optional(),
    purpose: z.string().optional(),
    stats: z
      .object({
        power: finite,
        resonance: finite,
        wisdom: finite,
        charisma: finite,
        intuition: finite,
        adaptability: finite,
        vitality: finite,
      })
      .optional(),
    personalContext: z
      .object({
        aboutYourself: z.string().optional(),
        lifeStory: z.string().optional(),
        poetry: z.string().optional(),
        values: z.string().optional(),
      })
      .optional(),
    monicaConstant: finite.optional(),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(value => {
        const date = new Date(value)
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
      }, 'Invalid birth date')
      .optional(),
    birthTime: z
      .string()
      .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .optional(),
    birthLocation: z
      .object({
        name: z.string().trim().min(1),
        latitude,
        longitude,
        timezone: z.string().trim().min(1),
      })
      .optional(),
    preferredSpecialty: z.string().max(200).optional(),
    personalityNotes: z.string().max(1000).optional(),
    personalityParameters: z
      .object({
        wisdom: finite,
        charisma: finite,
        intuition: finite,
        analytical: finite,
        creativity: finite,
        empathy: finite,
        authority: finite,
        mysticism: finite,
        practicality: finite,
        humor: finite,
        formality: finite,
        directness: finite,
        eloquence: finite,
        passion: finite,
        patience: finite,
        teacherMode: finite,
        counselorMode: finite,
        visionaryMode: finite,
        scholarMode: finite,
        mysticMode: finite,
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.birthInfo) return
    const date = value.birthDate ? new Date(value.birthDate) : new Date(NaN)
    if (
      !value.birthDate ||
      !value.birthTime ||
      !value.birthLocation ||
      !Number.isFinite(date.getTime()) ||
      date > new Date() ||
      date < new Date('1800-01-01')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Complete valid birth data is required',
      })
    }
  })

export function forgeRequestHash(input: z.infer<typeof ForgeRequestSchema>) {
  const { clientRequestId: _, ...details } = input
  return createHash('sha256').update(JSON.stringify(details)).digest('hex')
}
