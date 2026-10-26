/** Browser-safe validation; the server report is imported only as a type. */
import { z } from 'zod'
import { AdminAlertSchema } from '@/lib/admin/page-schemas'
import type { RecipeActivityReport } from '@/lib/admin/recipe-activity'

const sectionOf = <T extends z.ZodTypeAny>(value: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value }),
    z.object({ ok: z.literal(false), reason: z.string() }),
  ])

const count = z.number().int().nonnegative()
export const RecipeActivityReportSchema = z.object({
  generatedAt: z.string(),
  windowStart: z.string(),
  catalog: sectionOf(
    z.object({
      recipes: count,
      ingredientLines: count,
      instructionSteps: count,
      withCuisine: count,
      withMealType: count,
      withElements: count,
      withNutrition: count,
      cuisines: z.array(z.object({ name: z.string(), recipes: count })),
    })
  ),
  activity7d: sectionOf(
    z.object({
      events: count,
      alterations: count,
      catalogReviews: count,
      feedAcknowledged: count,
      feedUnacknowledged: count,
      feedUnknown: count,
    })
  ),
  recent: sectionOf(
    z.array(
      z.object({
        id: z.string(),
        agentId: z.string(),
        recipeId: z.string().nullable(),
        recipeName: z.string().nullable(),
        source: z.enum(['recipe_alteration', 'catalog_review']),
        status: z.string(),
        substitutions: count.nullable(),
        instructionReviewRequired: z.boolean().nullable(),
        feedPublished: z.boolean().nullable(),
        createdAt: z.string(),
      })
    )
  ),
  alerts: z.array(AdminAlertSchema),
})

export type RecipeActivityPayload = z.infer<typeof RecipeActivityReportSchema>
type AssertTrue<T extends true> = T
export type _RecipeActivityDrift = AssertTrue<
  [RecipeActivityReport] extends [RecipeActivityPayload] ? true : false
>
