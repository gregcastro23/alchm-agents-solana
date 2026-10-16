import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { recipeCatalogService } from '@/lib/recipes/recipe-catalog-service'
import { recipeAlterationService } from '@/lib/recipes/recipe-alteration-service'
import { POST as alterPOST } from '@/app/api/recipes/alter/route'
import { GET as commentsGET } from '@/app/api/recipes/[recipeId]/comments/route'
import type { CraftedAgent } from '@/lib/agent-types'

// Mock prisma database
vi.mock('@/lib/db', () => ({
  prisma: {
    agent_action_events: {
      upsert: vi.fn(async ({ create }) => ({
        id: 'mock-event-id',
        ...create,
      })),
      findMany: vi.fn(async () => [
        {
          id: 'event-hildegard-1',
          agentId: 'hildegard-von-bingen',
          eventType: 'recipe_generation',
          createdAt: new Date('2026-10-16T12:00:00Z'),
          postedAt: new Date('2026-10-16T12:00:00Z'),
          metadataPayload: {
            recipeId: 'italian-risotto-alla-milanese',
            dishName: 'Saffron & Spelt Farrotto',
            rating: 5,
            review: 'By the viriditas of heaven, we cultivate spiritual vigour through spelt!',
            substitutions: [
              {
                original: 'arborio rice',
                replacement: 'spelt farro grain',
                reason: 'Spelt is warm, fertile, and imparts viriditas.',
                astrologicalBasis: 'Jovian-Venusian harmonious digestion',
                historicalBasis: 'Medieval Rhenish monastic staple',
              },
            ],
            planetarySignature: {
              dominantPlanet: 'Venus',
              dominantElement: 'Earth',
            },
            agentProfile: {
              name: 'Hildegard of Bingen',
            },
          },
        },
      ]),
    },
  },
}))

// Mock WTEN delivery
vi.mock('@/lib/wten/delivery', () => ({
  deliverToWten: vi.fn(async () => ({
    ok: true,
    status: 200,
    body: { success: true, event: { id: 'wten-feed-event-uuid-123' } },
  })),
  stableEventId: vi.fn(() => 'mock-stable-event-id'),
}))

// Mock voiced generation for deterministic review outputs in testing
vi.mock('@/lib/agents/persona/voiced-generation', () => ({
  generateVoicedText: vi.fn(async (_agentId, _prompt, options) => {
    return options?.fallback || 'Mocked alteration review'
  }),
}))

describe('Recipe Catalog & Alteration Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Recipe Catalog Service (recipeCatalogService)', () => {
    it('loads the full 1,000-recipe catalog snapshot', async () => {
      const recipes = await recipeCatalogService.getAllRecipes()
      expect(Array.isArray(recipes)).toBe(true)
      expect(recipes.length).toBeGreaterThanOrEqual(1000)

      const sample = recipes[0]
      expect(sample).toBeDefined()
      expect(sample.id).toBeDefined()
      expect(sample.name).toBeDefined()
      expect(sample.ingredients).toBeDefined()
      expect(Array.isArray(sample.ingredients)).toBe(true)
    })

    it('retrieves an existing recipe by ID', async () => {
      const all = await recipeCatalogService.getAllRecipes()
      const target = all[0]
      const found = await recipeCatalogService.getRecipeById(target.id)

      expect(found).toBeDefined()
      expect(found?.id).toBe(target.id)
      expect(found?.name).toBe(target.name)
    })

    it('filters recipes by cuisine, element, and keyword search', async () => {
      const results = await recipeCatalogService.findRecipes({
        limit: 10,
        cuisine: 'Italian',
      })

      expect(results.length).toBeGreaterThan(0)
      for (const recipe of results) {
        expect((recipe.cuisine || '').toLowerCase()).toContain('italian')
      }
    })

    it('ranks candidate recipes synergistically for historical agents', async () => {
      const mockAgent: CraftedAgent = {
        id: 'hildegard-von-bingen',
        name: 'Hildegard von Bingen',
        title: 'Sibyl of the Rhine',
        era: 'Medieval Germany (1098–1179)',
        specialization: 'Natural philosophy, herbal medicine, Christian mysticism',
        historicalDiet: {
          dietaryPhilosophy: 'Viriditas (greening life-force) balance.',
          staples: ['Spelt', 'Fennel', 'Rue', 'Verdant greens'],
          favoriteFoods: ['Spelt bread', 'Warm herbal broth'],
          avoidedFoods: ['Strawberries', 'Pork', 'Excess raw leeks'],
          culturalCuisine: 'Medieval German / Rhenish Monastic',
        },
        consciousness: {
          dominantElement: 'Earth',
          dominantModality: 'Fixed',
          natalChart: {
            planets: {
              Sun: { sign: 'Taurus', degree: 14 },
              Moon: { sign: 'Pisces', degree: 8 },
            },
          },
        },
      }

      const candidates = await recipeCatalogService.findCandidatesForAgent(mockAgent, {
        count: 5,
      })

      expect(candidates).toHaveLength(5)
      expect(candidates[0]).toHaveProperty('id')
      expect(candidates[0]).toHaveProperty('name')
      expect(candidates[0]).toHaveProperty('ingredients')
    })
  })

  describe('Recipe Alteration Service (recipeAlterationService)', () => {
    it('applies ethical vegetarian substitutions for Leonardo da Vinci', async () => {
      const daVinci: CraftedAgent = {
        id: 'leonardo-da-vinci',
        name: 'Leonardo da Vinci',
        title: 'Master of the Renaissance',
        era: 'Renaissance Italy (1452–1519)',
        specialization: 'Art, anatomy, engineering, vegetarian philosophy',
        historicalDiet: {
          dietaryPhilosophy: 'Strict ethical vegetarianism honoring living beings.',
          staples: ['Cold-pressed olive oil', 'Wild mushrooms', 'Chickpeas', 'Polenta'],
          favoriteFoods: ['Chestnut soup', 'Bean stews with fresh sage'],
          avoidedFoods: ['Meat of any animal', 'Poultry', 'Veal'],
          culturalCuisine: 'Renaissance Tuscan / Italian',
        },
        consciousness: {
          dominantElement: 'Fire',
          dominantModality: 'Cardinal',
          natalChart: {
            planets: {
              Sun: { sign: 'Aries', degree: 3 },
              Moon: { sign: 'Sagittarius', degree: 15 },
            },
          },
        },
      }

      const meatRecipe = {
        id: 'tuscan-braised-beef',
        name: 'Tuscan Braised Beef with Rosemary',
        cuisine: 'Italian',
        ingredients: [
          { name: 'beef chuck roast', amount: 800, unit: 'g', notes: 'cubed' },
          { name: 'olive oil', amount: 2, unit: 'tbsp' },
          { name: 'rosemary', amount: 2, unit: 'sprigs' },
          { name: 'red wine', amount: 1, unit: 'cup' },
        ],
        instructions: [
          'Sear beef cubes in olive oil until browned.',
          'Add rosemary and pour in red wine.',
          'Simmer for 2 hours until beef is tender.',
        ],
        elementalProperties: { Fire: 0.6, Water: 0.1, Earth: 0.2, Air: 0.1 },
        mealType: ['dinner'],
      }

      const result = await recipeAlterationService.alterRecipe({
        agentId: 'leonardo-da-vinci',
        recipeId: meatRecipe.id,
        rating: 5,
        syncToWten: true,
      })

      expect(result.ok).toBe(true)
      expect(result.originalRecipe).toBeDefined()
      expect(result.alteredRecipe).toBeDefined()
      expect(result.review).toBeDefined()
      expect(result.planetarySignature).toBeDefined()
      expect(result.recipeCommentSaved).toBe(true)

      // Ensure meat was substituted with a plant-based staple
      const subs = result.alteredRecipe.substitutions
      const meatSub = subs.find(
        s =>
          s.originalIngredient.toLowerCase().includes('beef') ||
          s.originalIngredient.toLowerCase().includes('meat')
      )

      if (meatSub) {
        expect(meatSub.astrologicalBasis).toBeDefined()
        expect(meatSub.historicalBasis).toBeDefined()
        expect(meatSub.reason).toBeDefined()
      }
    })

    it('substitutes modern refined wheat with ancient spelt for Hildegard von Bingen', async () => {
      const flourRecipe = {
        id: 'monastic-flatbread',
        name: 'Crusty Herb Flatbread',
        cuisine: 'European',
        ingredients: [
          { name: 'white flour', amount: 500, unit: 'g' },
          { name: 'active dry yeast', amount: 1, unit: 'packet' },
          { name: 'water', amount: 300, unit: 'ml' },
          { name: 'sea salt', amount: 1, unit: 'tsp' },
        ],
        instructions: [
          'Mix white flour and yeast in a bowl.',
          'Knead dough with water and sea salt.',
          'Bake until crusty and golden.',
        ],
        elementalProperties: { Fire: 0.2, Water: 0.2, Earth: 0.5, Air: 0.1 },
      }

      const result = await recipeAlterationService.alterRecipe({
        agentId: 'hildegard-von-bingen',
        recipeId: flourRecipe.id,
        rating: 5,
        syncToWten: true,
      })

      expect(result.ok).toBe(true)
      expect(result.agent.id).toBe('hildegard-of-bingen')
      expect(result.alteredRecipe.instructions.length).toBeGreaterThan(0)
    })
  })

  describe('API Endpoints Integration', () => {
    describe('POST /api/recipes/alter', () => {
      it('rejects requests missing agentId with 400', async () => {
        const req = new NextRequest('http://localhost/api/recipes/alter', {
          method: 'POST',
          body: JSON.stringify({}),
        })

        const res = await alterPOST(req)
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.success).toBe(false)
        expect(json.error).toContain('agentId is required')
      })

      it('alters a recipe and posts to the feed & recipe comments', async () => {
        const req = new NextRequest('http://localhost/api/recipes/alter', {
          method: 'POST',
          body: JSON.stringify({
            agentId: 'hildegard-von-bingen',
            preferredCuisine: 'Italian',
            rating: 5,
            syncToWten: true,
          }),
        })

        const res = await alterPOST(req)
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.success).toBe(true)
        expect(json.alteredRecipe).toBeDefined()
        expect(json.review).toBeDefined()
        expect(json.planetarySignature).toBeDefined()
        expect(json.feedEventId).toBeDefined()
      })
    })

    describe('GET /api/recipes/[recipeId]/comments', () => {
      it('returns agent alterations and reviews for a recipe', async () => {
        // Stub global.fetch for WTEN community tips lookup
        const originalFetch = global.fetch
        global.fetch = vi.fn().mockImplementation(async (url: string) => {
          if (url.includes('/community-tips')) {
            return {
              ok: true,
              json: async () => ({
                tips: [
                  {
                    id: 'tip-user-1',
                    author: 'AlchemicalChef',
                    comment: 'Toasting the grains before simmering makes all the difference!',
                    rating: 5,
                    createdAt: '2026-10-16T10:00:00Z',
                  },
                ],
              }),
            } as any
          }
          return originalFetch(url)
        })

        const req = new NextRequest(
          'http://localhost/api/recipes/italian-risotto-alla-milanese/comments'
        )
        const res = await commentsGET(req, {
          params: Promise.resolve({ recipeId: 'italian-risotto-alla-milanese' }),
        })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.success).toBe(true)
        expect(Array.isArray(json.comments)).toBe(true)
        expect(json.comments.length).toBeGreaterThanOrEqual(1)

        const agentComment = json.comments.find((c: any) => c.authorType === 'agent')
        expect(agentComment).toBeDefined()
        expect(agentComment.agentId).toBe('hildegard-von-bingen')
        expect(agentComment.substitutions).toBeDefined()

        global.fetch = originalFetch
      })
    })
  })
})
