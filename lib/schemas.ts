import { z } from 'zod'

export const BirthInfoSchema = z.object({
  year: z.number().int(),
  month: z.number().int(), // zero-based [[memory:3826859]]
  day: z.number().int(),
  hour: z.number().int(),
  minute: z.number().int(),
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
})
export type BirthInfo = z.infer<typeof BirthInfoSchema>

export const AlchmAlchemyEffectsSchema = z
  .object({
    'Total Spirit': z.number().optional().default(0),
    'Total Essence': z.number().optional().default(0),
    'Total Day Essence': z.number().optional().default(0),
    'Total Matter': z.number().optional().default(0),
    'Total Substance': z.number().optional().default(0),
    'Total Night Essence': z.number().optional().default(0),
  })
  .passthrough()

export const AlchmResponseSchema = z
  .object({
    alchm: z
      .object({
        'Alchemy Effects': AlchmAlchemyEffectsSchema,
        'Total Effect Value': z
          .object({
            Fire: z.number().default(0),
            Water: z.number().default(0),
            Air: z.number().default(0),
            Earth: z.number().default(0),
          })
          .passthrough(),
        Heat: z.number().optional().default(0),
        Entropy: z.number().optional().default(0),
        Reactivity: z.number().optional().default(0),
        Energy: z.number().optional().default(0),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()
export type AlchmResponse = z.infer<typeof AlchmResponseSchema>

export const AstrologizeWheelSchema = z
  .object({
    svg: z.string().optional(),
    imageUrl: z.string().optional(),
    meta: z.any().optional(),
  })
  .passthrough()
export type AstrologizeWheel = z.infer<typeof AstrologizeWheelSchema>
