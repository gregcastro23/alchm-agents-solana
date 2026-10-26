import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  recent: vi.fn(),
  catalog: vi.fn(),
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRawUnsafe: mocks.query,
    agent_action_events: { findMany: mocks.recent },
  },
}))
vi.mock('@/lib/recipes/recipe-catalog-service', () => ({
  recipeCatalogService: { getAllRecipes: mocks.catalog },
}))
vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: mocks.requireAdmin,
  adminErrorResponse: (result: { error: string; status: number }) =>
    Response.json({ error: result.error }, { status: result.status }),
}))

import {
  RECIPE_ACTIVITY_SUMMARY_SQL,
  catalogCoverage,
  loadRecipeActivity,
  recipeActivityRow,
} from '@/lib/admin/recipe-activity'
import { RecipeActivityReportSchema } from '@/lib/admin/recipe-activity-schema'
import { RecipeActivityView } from '@/components/admin/pages/RecipesPage'
import { GET } from '@/app/api/admin/recipe-activity/route'
import type { CatalogRecipe } from '@/lib/recipes/recipe-catalog-service'

const now = new Date('2026-10-20T20:00:00.000Z')
const catalog: CatalogRecipe[] = [
  {
    id: 'dish-1',
    name: 'Chickpea stew',
    cuisine: 'Mediterranean',
    ingredients: [{ name: 'chickpeas' }, { name: 'tomato' }],
    instructions: ['Simmer ingredients.'],
    elementalProperties: { Fire: 0.4, Water: 0.3, Earth: 0.2, Air: 0.1 },
    nutrition: { calories: 300, protein: 10, carbs: 40, fat: 5 },
    mealType: ['dinner'],
  },
  { id: 'dish-2', name: 'Rice', ingredients: [{ name: 'rice' }], instructions: ['Steam rice.'] },
]
const summary = {
  events: 3,
  alterations: 2,
  catalog_reviews: 1,
  feed_acknowledged: 1,
  feed_unacknowledged: 1,
  feed_unknown: 1,
}
const event = (metadata: Record<string, unknown> = {}) => ({
  id: 'event-1',
  agentId: 'hypatia',
  status: 'completed',
  createdAt: now,
  metadataPayload: {
    source: 'recipe_alteration',
    recipeId: 'dish-1',
    recipeName: 'Chickpea stew',
    substitutions: [{ original: 'chickpeas', replacement: 'lentils' }],
    recipePayload: { instructionReviewRequired: true },
    feedPublished: true,
    ...metadata,
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.catalog.mockResolvedValue(catalog)
  mocks.query.mockResolvedValue([summary])
  mocks.recent.mockResolvedValue([event()])
  mocks.requireAdmin.mockResolvedValue({ ok: true, user: { id: 'ops' }, source: 'db-role' })
})

describe('recipe activity report', () => {
  it('counts metadata completeness without treating missing metadata as complete', () => {
    expect(catalogCoverage(catalog)).toEqual({
      recipes: 2,
      ingredientLines: 3,
      instructionSteps: 2,
      withCuisine: 1,
      withMealType: 1,
      withElements: 1,
      withNutrition: 1,
      cuisines: [{ name: 'Mediterranean', recipes: 1 }],
    })
    expect(
      catalogCoverage([
        {
          ...catalog[0],
          elementalProperties: { Fire: NaN, Water: 0.3, Earth: 0.2, Air: 0.1 },
          nutrition: { calories: -1, protein: 1, carbs: 1, fat: 1 },
        },
      ])
    ).toMatchObject({ withElements: 0, withNutrition: 0 })
  })

  it('keeps absent acknowledgements unknown, even for completed local events', () => {
    const row = recipeActivityRow(
      event({ source: 'catalog_review', feedPublished: undefined, substitutions: undefined })
    )
    expect(row).toMatchObject({ status: 'completed', feedPublished: null, substitutions: null })
    expect(recipeActivityRow(event({ feedPublished: 'true' })).feedPublished).toBeNull()
    expect(recipeActivityRow(event({ feedPublished: false })).feedPublished).toBe(false)
    expect(recipeActivityRow(event({ substitutions: [] })).substitutions).toBe(0)
    expect(recipeActivityRow(event()).instructionReviewRequired).toBe(true)
  })

  it('binds the 7-day creation window, filters recipe provenance and bounds recent reads', async () => {
    const report = await loadRecipeActivity(now)
    expect(RecipeActivityReportSchema.safeParse(report).success).toBe(true)
    expect(mocks.query).toHaveBeenCalledWith(
      RECIPE_ACTIVITY_SUMMARY_SQL,
      new Date('2026-10-13T20:00:00.000Z'),
      now
    )
    expect(RECIPE_ACTIVITY_SUMMARY_SQL).toContain(
      `"metadataPayload"->>'source' IN ('recipe_alteration', 'catalog_review')`
    )
    expect(RECIPE_ACTIVITY_SUMMARY_SQL).toContain(`'true'::jsonb`)
    expect(mocks.recent).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        where: {
          createdAt: { gte: new Date(report.windowStart), lte: now },
          OR: [
            { metadataPayload: { path: ['source'], equals: 'recipe_alteration' } },
            { metadataPayload: { path: ['source'], equals: 'catalog_review' } },
          ],
        },
      })
    )
    expect(report.activity7d).toEqual({
      ok: true,
      value: {
        events: 3,
        alterations: 2,
        catalogReviews: 1,
        feedAcknowledged: 1,
        feedUnacknowledged: 1,
        feedUnknown: 1,
      },
    })
    expect(report.alerts).toEqual([])
  })

  it('a count failure preserves catalog and recent reads and owns an alert', async () => {
    mocks.query.mockRejectedValue(new Error('agent_action_events unavailable'))
    const report = await loadRecipeActivity(now)
    expect(report.catalog.ok).toBe(true)
    expect(report.recent.ok).toBe(true)
    expect(report.activity7d).toEqual({ ok: false, reason: 'agent_action_events unavailable' })
    expect(report.alerts).toEqual([
      expect.objectContaining({
        id: 'recipes:unreadable:activity7d',
        source: 'infrastructure',
        href: '/admin/recipes',
      }),
    ])
  })

  it('a catalog failure preserves event reads; empty live activity raises no alert', async () => {
    mocks.catalog.mockRejectedValue(new Error('Invalid bundled recipe catalog'))
    const report = await loadRecipeActivity(now)
    expect(report.catalog).toEqual({ ok: false, reason: 'Invalid bundled recipe catalog' })
    expect(report.activity7d.ok).toBe(true)
    expect(report.recent.ok).toBe(true)
    expect(report.alerts[0]).toMatchObject({ source: 'agents', href: '/admin/recipes' })

    mocks.catalog.mockResolvedValue(catalog)
    mocks.query.mockResolvedValue([
      {
        events: 0,
        alterations: 0,
        catalog_reviews: 0,
        feed_acknowledged: 0,
        feed_unacknowledged: 0,
        feed_unknown: 0,
      },
    ])
    mocks.recent.mockResolvedValue([])
    expect((await loadRecipeActivity(now)).alerts).toEqual([])
  })
})

describe('recipe activity page', () => {
  it('shows provenance, required review and explicit unknown delivery', async () => {
    mocks.recent.mockResolvedValue([event({ feedPublished: undefined })])
    const report = await loadRecipeActivity(now)
    render(<RecipeActivityView data={RecipeActivityReportSchema.parse(report)} />)
    expect(screen.getByText('Catalog coverage')).toBeInTheDocument()
    expect(screen.getByText('Chickpea stew')).toBeInTheDocument()
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByText(/Recipe comment delivery is not recorded here/)).toBeInTheDocument()
  })

  it('unreadable recent activity shows its reason instead of an empty-activity claim', async () => {
    mocks.recent.mockRejectedValue(new Error('Recipe event read timed out'))
    const report = await loadRecipeActivity(now)
    render(<RecipeActivityView data={RecipeActivityReportSchema.parse(report)} />)
    const recentCard = screen.getByText('Recent recipe activity').closest('section')!
    expect(
      within(recentCard).getByLabelText('unknown: Recipe event read timed out')
    ).toHaveTextContent('—')
    expect(screen.queryByText('No recorded recipe activity in the last 7 days.')).toBeNull()
    expect(screen.getByText('Catalog coverage')).toBeInTheDocument()
  })
})

describe('recipe activity route', () => {
  it.each([401, 403])('admin guard rejects HTTP %s before any source read', async status => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, status, error: 'Access refused' })
    expect((await GET()).status).toBe(status)
    expect(mocks.query).not.toHaveBeenCalled()
    expect(mocks.recent).not.toHaveBeenCalled()
    expect(mocks.catalog).not.toHaveBeenCalled()
  })

  it('serves an admin-gated, no-store, validated report', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(RecipeActivityReportSchema.safeParse(await response.json()).success).toBe(true)
  })
})
