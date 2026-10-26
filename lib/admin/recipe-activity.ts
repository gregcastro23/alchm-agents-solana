import 'server-only'

import type { AdminAlert } from '@/lib/admin/alerts'
import { readSection, type Section } from '@/lib/admin/section'
import { prisma } from '@/lib/db'
import { recipeCatalogService, type CatalogRecipe } from '@/lib/recipes/recipe-catalog-service'

export interface CatalogCoverage {
  recipes: number
  ingredientLines: number
  instructionSteps: number
  withCuisine: number
  withMealType: number
  withElements: number
  withNutrition: number
  cuisines: Array<{ name: string; recipes: number }>
}

export interface RecipeActivitySummary {
  events: number
  alterations: number
  catalogReviews: number
  feedAcknowledged: number
  feedUnacknowledged: number
  feedUnknown: number
}

export interface RecentRecipeActivity {
  id: string
  agentId: string
  recipeId: string | null
  recipeName: string | null
  source: 'recipe_alteration' | 'catalog_review'
  status: string
  substitutions: number | null
  instructionReviewRequired: boolean | null
  feedPublished: boolean | null
  createdAt: string
}

export interface RecipeActivityReport {
  generatedAt: string
  windowStart: string
  catalog: Section<CatalogCoverage>
  activity7d: Section<RecipeActivitySummary>
  recent: Section<RecentRecipeActivity[]>
  alerts: AdminAlert[]
}

/** Metadata coverage of this deployment's bundled catalog, not the live WTEN catalog. */
export function catalogCoverage(recipes: CatalogRecipe[]): CatalogCoverage {
  const cuisines = new Map<string, number>()
  const coverage: CatalogCoverage = {
    recipes: recipes.length,
    ingredientLines: 0,
    instructionSteps: 0,
    withCuisine: 0,
    withMealType: 0,
    withElements: 0,
    withNutrition: 0,
    cuisines: [],
  }
  for (const recipe of recipes) {
    coverage.ingredientLines += recipe.ingredients.length
    coverage.instructionSteps += recipe.instructions.length
    const cuisine = recipe.cuisine?.trim()
    if (cuisine) {
      coverage.withCuisine++
      cuisines.set(cuisine, (cuisines.get(cuisine) ?? 0) + 1)
    }
    if (recipe.mealType?.some(meal => meal.trim())) coverage.withMealType++
    if (
      recipe.elementalProperties &&
      ['Fire', 'Water', 'Earth', 'Air'].every(element => {
        const value =
          recipe.elementalProperties?.[element as keyof typeof recipe.elementalProperties]
        return typeof value === 'number' && Number.isFinite(value) && value >= 0
      })
    )
      coverage.withElements++
    if (
      recipe.nutrition &&
      ['calories', 'protein', 'carbs', 'fat'].every(nutrient => {
        const value = recipe.nutrition?.[nutrient as keyof typeof recipe.nutrition]
        return typeof value === 'number' && Number.isFinite(value) && value >= 0
      })
    )
      coverage.withNutrition++
  }
  coverage.cuisines = [...cuisines].map(([name, count]) => ({ name, recipes: count }))
  coverage.cuisines.sort((a, b) => b.recipes - a.recipes || a.name.localeCompare(b.name))
  return coverage
}

/** $1/$2 are the creation-time bounds. JSON booleans are checked without coercing strings. */
export const RECIPE_ACTIVITY_SUMMARY_SQL = `
SELECT COUNT(*)::int AS events,
       COUNT(*) FILTER (WHERE "metadataPayload"->>'source' = 'recipe_alteration')::int AS alterations,
       COUNT(*) FILTER (WHERE "metadataPayload"->>'source' = 'catalog_review')::int AS catalog_reviews,
       COUNT(*) FILTER (WHERE "metadataPayload"->'feedPublished' = 'true'::jsonb)::int AS feed_acknowledged,
       COUNT(*) FILTER (WHERE "metadataPayload"->'feedPublished' = 'false'::jsonb)::int AS feed_unacknowledged,
       COUNT(*) FILTER (WHERE "metadataPayload"->'feedPublished' IS NULL
                          OR "metadataPayload"->'feedPublished' NOT IN ('true'::jsonb, 'false'::jsonb))::int AS feed_unknown
  FROM "agent_action_events"
 WHERE "createdAt" >= $1 AND "createdAt" <= $2
   AND "metadataPayload"->>'source' IN ('recipe_alteration', 'catalog_review')`

interface SummaryRow {
  events: number
  alterations: number
  catalog_reviews: number
  feed_acknowledged: number
  feed_unacknowledged: number
  feed_unknown: number
}

interface EventRow {
  id: string
  agentId: string
  status: string
  metadataPayload: unknown
  createdAt: Date
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function textField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.slice(0, 200) : null
}

export function recipeActivityRow(row: EventRow): RecentRecipeActivity {
  const metadata = record(row.metadataPayload)
  const source = metadata.source
  if (source !== 'recipe_alteration' && source !== 'catalog_review')
    throw new Error('Unexpected recipe activity source')
  const payload = record(metadata.recipePayload)
  return {
    id: row.id,
    agentId: row.agentId,
    recipeId: textField(metadata.recipeId) ?? textField(metadata.recipe_id),
    recipeName: textField(metadata.recipeName) ?? textField(metadata.dishName),
    source,
    status: row.status,
    substitutions: Array.isArray(metadata.substitutions) ? metadata.substitutions.length : null,
    instructionReviewRequired:
      typeof payload.instructionReviewRequired === 'boolean'
        ? payload.instructionReviewRequired
        : null,
    feedPublished: typeof metadata.feedPublished === 'boolean' ? metadata.feedPublished : null,
    createdAt: row.createdAt.toISOString(),
  }
}

interface RecipeActivityReads {
  readCatalog(): Promise<CatalogRecipe[]>
  readSummary(since: Date, until: Date): Promise<RecipeActivitySummary>
  readRecent(since: Date, until: Date): Promise<RecentRecipeActivity[]>
}

const reads: RecipeActivityReads = {
  readCatalog: () => recipeCatalogService.getAllRecipes(),
  readSummary: async (since, until) => {
    const [row] = await prisma.$queryRawUnsafe<SummaryRow[]>(
      RECIPE_ACTIVITY_SUMMARY_SQL,
      since,
      until
    )
    if (!row) throw new Error('Recipe activity count query returned no result')
    return {
      events: Number(row.events),
      alterations: Number(row.alterations),
      catalogReviews: Number(row.catalog_reviews),
      feedAcknowledged: Number(row.feed_acknowledged),
      feedUnacknowledged: Number(row.feed_unacknowledged),
      feedUnknown: Number(row.feed_unknown),
    }
  },
  readRecent: async (since, until) => {
    const rows = await prisma.agent_action_events.findMany({
      where: {
        createdAt: { gte: since, lte: until },
        OR: [
          { metadataPayload: { path: ['source'], equals: 'recipe_alteration' } },
          { metadataPayload: { path: ['source'], equals: 'catalog_review' } },
        ],
      },
      select: { id: true, agentId: true, status: true, metadataPayload: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
    })
    return rows.map(recipeActivityRow)
  },
}

export async function loadRecipeActivity(
  now: Date = new Date(),
  sources: RecipeActivityReads = reads
): Promise<RecipeActivityReport> {
  const since = new Date(now.getTime() - 7 * 86_400_000)
  const [catalog, activity7d, recent] = await Promise.all([
    readSection(async () => catalogCoverage(await sources.readCatalog())),
    readSection(() => sources.readSummary(since, now)),
    readSection(() => sources.readRecent(since, now)),
  ])
  const alerts: AdminAlert[] = []
  for (const [key, section] of Object.entries({ catalog, activity7d, recent })) {
    if (!section.ok)
      alerts.push({
        id: `recipes:unreadable:${key}`,
        severity: 'warning',
        source: key === 'catalog' ? 'agents' : 'infrastructure',
        title: `Could not read recipe ${key === 'activity7d' ? 'activity counts' : key}`,
        detail: section.reason,
        href: '/admin/recipes',
      })
  }
  return {
    generatedAt: now.toISOString(),
    windowStart: since.toISOString(),
    catalog,
    activity7d,
    recent,
    alerts,
  }
}
