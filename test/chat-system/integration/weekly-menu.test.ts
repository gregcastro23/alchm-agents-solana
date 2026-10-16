import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { generateObject } from 'ai'
import { POST as generatePOST } from '@/app/api/menu-planner/generate/route'
import { POST as weeklyPOST, GET as weeklyGET } from '@/app/api/menu-planner/weekly/route'
import { getAgentWeeklyMenu, postAgentWeeklyMenu } from '@/lib/wtenClient'
import { recipeCatalogService } from '@/lib/recipes/recipe-catalog-service'

// Mock external dependencies
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn((model: string) => `mocked-${model}`),
  createOpenAI: vi.fn(() => (model: string) => `fallback-${model}`),
}))

vi.mock('@/lib/recipes/recipe-catalog-service', () => ({
  recipeCatalogService: { findCandidatesForAgent: vi.fn(), getAllRecipes: vi.fn() },
}))

vi.mock('@/lib/agents/resolve-any-agent', () => ({
  resolveAnyAgent: vi.fn(async () => ({
    id: 'hildegard-of-bingen',
    name: 'Hildegard of Bingen',
    title: 'Sibyl of the Rhine',
    abilities: { specialty: 'Verdant Fermentation' },
    era: 'Medieval',
    historicalDiet: { staples: ['Spelt'] },
    personality: { traits: ['Mystical'] },
    consciousness: {
      natalChart: { planets: { Sun: { sign: 'Taurus' } } },
      dominantElement: 'Earth',
      dominantModality: 'Fixed',
    },
  })),
}))

vi.mock('@/lib/wtenClient', () => ({
  getAgentWeeklyMenu: vi.fn(),
  postAgentWeeklyMenu: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/security/privileged-api-auth', () => ({
  requireAdminRequest: vi.fn(async () => ({
    ok: false,
    response: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }),
  })),
}))

vi.mock('@/lib/backend', () => ({
  getAlchemicalQuantitiesLegacy: vi.fn(async () => ({})),
  backend: {
    planetary: {
      current: vi.fn(async () => ({
        planetary_positions: {
          Sun: { sign: 'Taurus', degree: 22 },
        },
      })),
    },
  },
}))

describe('Weekly Menu Planner Integration', () => {
  let mockGenerateObject: any
  let mockGetAgentWeeklyMenu: any
  let mockPostAgentWeeklyMenu: any
  let generatedMenu: any

  beforeEach(() => {
    vi.clearAllMocks()
    global.console.error = console.error
    global.console.log = console.log
    mockGenerateObject = vi.mocked(generateObject)
    mockGetAgentWeeklyMenu = vi.mocked(getAgentWeeklyMenu)
    mockPostAgentWeeklyMenu = vi.mocked(postAgentWeeklyMenu)
    vi.stubEnv('OPENROUTER_API_KEY', '')
    const candidates = [
      {
        id: 'mock-recipe',
        name: 'Mock Dish',
        ingredients: [{ name: 'Spelt flour' }, { name: 'Verdant herbs' }],
        instructions: ['Mix the flour and herbs, then bake.'],
      },
      {
        id: 'second-catalog-recipe',
        name: 'Another Dish',
        ingredients: [{ name: 'Barley' }],
        instructions: ['Simmer the barley.'],
      },
    ]
    vi.mocked(recipeCatalogService.findCandidatesForAgent).mockResolvedValue(candidates)
    vi.mocked(recipeCatalogService.getAllRecipes).mockResolvedValue([
      ...candidates,
      {
        id: 'catalog-outside-shortlist',
        name: 'A valid older catalog choice',
        ingredients: [{ name: 'Lentils' }],
        instructions: ['Simmer the lentils.'],
      },
    ])

    // Default mock implementation of generateObject returning exactly 28 meals
    generatedMenu = {
      title: "Hildegard's Verdant Fermentation Week",
      summary: 'A weekly menu balanced in elemental green virtues and spiritual nourishment.',
      planetaryFocus: 'Venus',
      dietaryFocus: 'Verdant Spelt',
      meals: Array.from({ length: 28 }).map((_, i) => ({
        id: `slot-${i}`,
        dayOfWeek: Math.floor(i / 4),
        mealType: ['breakfast', 'lunch', 'dinner', 'snack'][i % 4],
        servings: 1,
        recipe: {
          id: 'mock-recipe',
          name: 'Mock Dish',
          cuisine: 'Medieval Spelt',
          ingredients: ['Spelt flour', 'Verdant herbs'],
          nutrition: { calories: 350, protein: 12, carbs: 60, fat: 5 },
          elementalProperties: { Fire: 0.1, Water: 0.3, Earth: 0.5, Air: 0.1 },
        },
        planetarySnapshot: {
          dominantPlanet: 'Venus',
          zodiacSign: 'Gemini',
          lunarPhase: 'Full Moon',
          elementalState: { Fire: 0.15, Water: 0.35, Earth: 0.4, Air: 0.1 },
          timestamp: new Date().toISOString(),
        },
        notes: 'A wonderful Medieval dish for spiritual health.',
      })),
      nutritionalTotals: { calories: 1500, protein: 50, carbs: 220, fat: 35 },
      groceryList: [{ name: 'Spelt flour', category: 'Pantry', quantity: 2, unit: 'kg' }],
      inventory: ['Verdant herbs'],
      featuredMeals: [
        {
          dayOfWeek: 0,
          mealType: 'breakfast',
          recipeId: 'mock-recipe',
          recipeName: 'Mock Dish',
        },
      ],
    }
    mockGenerateObject.mockReset().mockResolvedValue({ object: generatedMenu })
  })

  afterEach(() => vi.unstubAllEnvs())

  describe('Generate API Route (/api/menu-planner/generate)', () => {
    it('generates a new weekly menu when no draft exists', async () => {
      mockGetAgentWeeklyMenu.mockResolvedValueOnce(null)
      mockPostAgentWeeklyMenu.mockResolvedValueOnce({
        success: true,
        agentEmail: 'hildegard-of-bingen@agentic.alchm.kitchen',
        userId: 'wten-user-uuid',
        menu: { id: 'mock-persisted-menu-id' },
      })

      const request = new NextRequest('http://localhost/api/menu-planner/generate', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'hildegard-of-bingen',
          regenerate: false,
        }),
      })

      const response = await generatePOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.reused).toBe(false)
      expect(data.menu.title).toBe("Hildegard's Verdant Fermentation Week")
      expect(data.menu.meals).toHaveLength(28)
      expect(mockGenerateObject).toHaveBeenCalledOnce()
      expect(data.menu.status).toBe('draft')
      expect(data.menu.shareToFeed).toBe(false)
      expect(mockPostAgentWeeklyMenu).not.toHaveBeenCalled()
    })

    it('reuses a complete existing catalog menu even outside the new candidate shortlist', async () => {
      const existingMenu = {
        ...structuredClone(generatedMenu),
        id: 'existing-id',
        title: 'Existing Menu',
        status: 'completed',
        shareToFeed: true,
      }
      existingMenu.meals[0].recipe.id = 'catalog-outside-shortlist'
      existingMenu.featuredMeals[0].recipeId = 'catalog-outside-shortlist'
      mockGetAgentWeeklyMenu.mockResolvedValueOnce(existingMenu)

      const request = new NextRequest('http://localhost/api/menu-planner/generate', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'hildegard-of-bingen',
          regenerate: false,
        }),
      })

      const response = await generatePOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.reused).toBe(true)
      expect(data.menu.id).toBe('existing-id')
      expect(data.menu.meals).toHaveLength(28)
      expect(data.menu.meals[0].recipe.id).toBe('catalog-outside-shortlist')
      expect(data.menu.status).toBe('draft')
      expect(data.menu.shareToFeed).toBe(false)
      expect(existingMenu.status).toBe('completed')
      expect(mockPostAgentWeeklyMenu).not.toHaveBeenCalled()
      expect(mockGenerateObject).not.toHaveBeenCalled()
      expect(recipeCatalogService.findCandidatesForAgent).not.toHaveBeenCalled()
    })

    it.each([
      [
        'unknown recipe',
        (menu: any) => {
          menu.meals[0].recipe.id = 'not-in-catalog'
        },
      ],
      [
        'incomplete week',
        (menu: any) => {
          menu.meals.pop()
        },
      ],
      [
        'duplicate slot',
        (menu: any) => {
          menu.meals[1].mealType = 'breakfast'
        },
      ],
      [
        'inconsistent featured recipe',
        (menu: any) => {
          menu.featuredMeals[0].recipeId = 'second-catalog-recipe'
        },
      ],
    ])('regenerates a saved menu with an %s', async (_label, mutate) => {
      const saved = structuredClone(generatedMenu)
      ;(mutate as (menu: any) => void)(saved)
      mockGetAgentWeeklyMenu.mockResolvedValueOnce({ ...saved, id: 'invalid-saved-menu' })

      const response = await generatePOST(
        new NextRequest('http://localhost/api/menu-planner/generate', {
          method: 'POST',
          body: JSON.stringify({ agentId: 'hildegard-of-bingen' }),
        })
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.reused).toBe(false)
      expect(data.menu.id).not.toBe('invalid-saved-menu')
      expect(data.menu.meals).toHaveLength(28)
      expect(mockGenerateObject).toHaveBeenCalledOnce()
      expect(mockPostAgentWeeklyMenu).not.toHaveBeenCalled()
    })

    it('fails explicitly if the catalog cannot validate a saved menu', async () => {
      mockGetAgentWeeklyMenu.mockResolvedValueOnce(structuredClone(generatedMenu))
      vi.mocked(recipeCatalogService.getAllRecipes).mockRejectedValueOnce(
        new Error('Catalog offline')
      )

      const response = await generatePOST(
        new NextRequest('http://localhost/api/menu-planner/generate', {
          method: 'POST',
          body: JSON.stringify({ agentId: 'hildegard-of-bingen' }),
        })
      )

      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({ success: false })
      expect(mockGenerateObject).not.toHaveBeenCalled()
      expect(mockPostAgentWeeklyMenu).not.toHaveBeenCalled()
    })

    it('forces regeneration even if a menu exists when regenerate is true', async () => {
      mockPostAgentWeeklyMenu.mockResolvedValueOnce({
        success: true,
        menu: { id: 'new-id' },
      })

      const request = new NextRequest('http://localhost/api/menu-planner/generate', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'hildegard-of-bingen',
          regenerate: true,
        }),
      })

      const response = await generatePOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.reused).toBe(false)
      expect(data.menu.title).toBe("Hildegard's Verdant Fermentation Week")
      expect(mockGenerateObject).toHaveBeenCalledOnce()
      expect(mockPostAgentWeeklyMenu).not.toHaveBeenCalled()
    })

    it.each([{ status: 'completed' }, { shareToFeed: true }])(
      'rejects publication flags %o before generation',
      async flags => {
        const response = await generatePOST(
          new NextRequest('http://localhost/api/menu-planner/generate', {
            method: 'POST',
            body: JSON.stringify({ agentId: 'hildegard-of-bingen', ...flags }),
          })
        )
        expect(response.status).toBe(400)
        expect(mockGenerateObject).not.toHaveBeenCalled()
        expect(mockPostAgentWeeklyMenu).not.toHaveBeenCalled()
      }
    )
  })

  describe('Catalog grounding and complete-week validation', () => {
    const generationRequest = () =>
      new NextRequest('http://localhost/api/menu-planner/generate', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'hildegard-of-bingen', regenerate: true }),
      })

    it.each([
      [
        'an invented recipe ID',
        (menu: any) => {
          menu.meals[0].recipe.id = 'invented-dish'
        },
      ],
      [
        'an incomplete week',
        (menu: any) => {
          menu.meals.pop()
        },
      ],
      [
        'a duplicated day and meal slot',
        (menu: any) => {
          menu.meals[1].mealType = 'breakfast'
        },
      ],
      [
        'a fractional day',
        (menu: any) => {
          menu.meals[0].dayOfWeek = 0.5
        },
      ],
      [
        'a featured recipe not assigned to its slot',
        (menu: any) => {
          menu.featuredMeals[0].recipeId = 'second-catalog-recipe'
        },
      ],
    ])('rejects generated output with %s', async (_label, mutate) => {
      ;(mutate as (menu: any) => void)(generatedMenu)
      const response = await generatePOST(generationRequest())

      expect(response.status).toBe(502)
      expect(await response.json()).toMatchObject({ success: false })
      expect(mockPostAgentWeeklyMenu).not.toHaveBeenCalled()
    })

    it.each(['empty', 'unavailable'])(
      'fails before generation when the catalog is %s',
      async state => {
        const catalog = vi.mocked(recipeCatalogService.findCandidatesForAgent)
        if (state === 'empty') catalog.mockResolvedValueOnce([])
        else catalog.mockRejectedValueOnce(new Error('Catalog unavailable'))

        const response = await generatePOST(generationRequest())

        expect(response.status).toBe(503)
        expect(mockGenerateObject).not.toHaveBeenCalled()
        expect(mockPostAgentWeeklyMenu).not.toHaveBeenCalled()
      }
    )

    it('validates the fallback response with the same catalog and complete-week rules', async () => {
      vi.stubEnv('OPENROUTER_API_KEY', 'test-key')
      const invalid = structuredClone(generatedMenu)
      invalid.meals[0].recipe.id = 'invented-fallback-dish'
      mockGenerateObject
        .mockRejectedValueOnce(new Error('Primary unavailable'))
        .mockResolvedValueOnce({ object: invalid })

      const response = await generatePOST(generationRequest())

      expect(response.status).toBe(502)
      expect(mockGenerateObject).toHaveBeenCalledTimes(2)
      expect(mockPostAgentWeeklyMenu).not.toHaveBeenCalled()
    })

    it('can recover from invalid primary output using a valid fallback', async () => {
      vi.stubEnv('OPENROUTER_API_KEY', 'test-key')
      const incomplete = structuredClone(generatedMenu)
      incomplete.meals.pop()
      mockGenerateObject
        .mockResolvedValueOnce({ object: incomplete })
        .mockResolvedValueOnce({ object: generatedMenu })

      const response = await generatePOST(generationRequest())

      expect(response.status).toBe(200)
      expect((await response.json()).menu.meals).toHaveLength(28)
      expect(mockGenerateObject).toHaveBeenCalledTimes(2)
      expect(mockPostAgentWeeklyMenu).not.toHaveBeenCalled()
    })

    it('rejects an invalid week date before generation', async () => {
      const response = await generatePOST(
        new NextRequest('http://localhost/api/menu-planner/generate', {
          method: 'POST',
          body: JSON.stringify({ agentId: 'hildegard-of-bingen', weekStartDate: 'invalid' }),
        })
      )

      expect(response.status).toBe(400)
      expect(mockGenerateObject).not.toHaveBeenCalled()
    })
  })

  describe('Proxy Weekly API Routes (/api/menu-planner/weekly)', () => {
    it('successfully proxies GET requests', async () => {
      const mockMenu = { id: 'fetched-id', title: 'Fetched Menu' }
      mockGetAgentWeeklyMenu.mockResolvedValueOnce(mockMenu)

      const request = new NextRequest(
        'http://localhost/api/menu-planner/weekly?agentSlug=hildegard-of-bingen&weekStartDate=2026-05-31',
        { method: 'GET' }
      )

      const response = await weeklyGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.menu.id).toBe('fetched-id')
      expect(mockGetAgentWeeklyMenu).toHaveBeenCalledWith('hildegard-of-bingen', '2026-05-31')
    })

    it('blocks anonymous legacy POST publication', async () => {
      const payload = {
        agentSlug: 'hildegard-of-bingen',
        weekStartDate: '2026-05-31',
        meals: [{ id: 'slot-1' }],
        status: 'completed',
        shareToFeed: true,
      }

      mockPostAgentWeeklyMenu.mockResolvedValueOnce({
        success: true,
        feedShared: true,
        menu: { id: 'published-id' },
      })

      const request = new NextRequest('http://localhost/api/menu-planner/weekly', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const response = await weeklyPOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
      expect(mockPostAgentWeeklyMenu).not.toHaveBeenCalled()
    })
  })
})
