// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { alterRecipe, voicedText, findMany } = vi.hoisted(() => ({
  alterRecipe: vi.fn(),
  voicedText: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { agent_action_events: { findMany } } }))
vi.mock('@/lib/recipes/recipe-alteration-service', () => ({
  recipeAlterationService: { alterRecipe },
}))
vi.mock('@/lib/agents/persona/voiced-generation', () => ({ generateVoicedText: voicedText }))
vi.mock('@/lib/celestial-energy-calculator', () => ({ celestialEnergyCalculator: {} }))
vi.mock('@/lib/consciousness/unified-tracker', () => ({ unifiedTracker: {} }))
vi.mock('@/lib/historical-agents-db', () => ({
  HistoricalAgentsService: {},
  isHistoricalAgent: () => true,
}))
vi.mock('@/lib/agents/historical', () => ({
  getHistoricalAgent: vi.fn(),
  HISTORICAL_AGENTS: [],
}))
vi.mock('@/lib/agents/persona/build-agent-context', () => ({ buildAgentContext: vi.fn() }))
vi.mock('@/lib/planetary-hour', () => ({
  PlanetaryHourCalculator: class {
    getPlanetaryHour() {
      return { planet: 'Venus' }
    }
    getPlanetaryDay() {
      return 'Venus'
    }
  },
}))

import { feedActivationEngine } from '@/lib/agents/feed-activation-engine'
import {
  generateHistoricalRecipeReview,
  getRecentHistoricalRecipeReviews,
} from '@/lib/agents/historical-recipe-review'

const agent = {
  agentId: 'hildegard-of-bingen',
  name: 'Hildegard of Bingen',
  specialty: 'Medieval cooking',
  dominantElement: 'Earth',
  natalChart: { planets: { Sun: { sign: 'Virgo', degree: 1 } } },
}
const moment = {
  timestamp: new Date('2026-10-16T12:00:00Z'),
  planetary: { dominantPlanet: 'Venus', dominantSign: 'Libra' },
  planetaryDegrees: { Sun: 23.5, Moon: 14.2 },
}
const recipe = { id: 'catalog-soup', name: 'Barley Soup', cuisine: 'Medieval' }

function alteration(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    originalRecipe: recipe,
    alteredRecipe: {
      id: 'catalog-soup-alt-hildegard-of-bingen',
      name: 'Hildegard’s Barley Soup',
      substitutions: [],
    },
    agent: {
      id: agent.agentId,
      name: agent.name,
      title: 'Sibyl of the Rhine',
      era: 'Medieval',
      dominantElement: 'Earth',
    },
    review: 'Consider using spelt for an earthy variation.',
    rating: 4,
    planetarySignature: { dominantPlanet: 'Venus', dominantElement: 'Earth' },
    deliveryId: 'recipe-delivery-1',
    feedPublished: true,
    localCommentSaved: false,
    recipeCommentSaved: undefined,
    ...overrides,
  }
}

beforeEach(() => {
  alterRecipe.mockReset().mockResolvedValue(alteration())
  voicedText.mockReset().mockResolvedValue('A reflective note about the soup.')
  findMany.mockReset().mockResolvedValue([])
  vi.stubEnv('AGENT_FEED_RENDER_IMAGES', 'false')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('recipe feed provenance', () => {
  it.each(['recipe_generation', 'made_it'])(
    'does not claim a dish was cooked for a successful %s alteration',
    async eventType => {
      const metadata = await (feedActivationEngine as any).generateMetadataPayload(
        agent,
        moment,
        { reason: 'elemental_surge_resonance', intensity: 0.75 },
        eventType,
        0.7,
        0.8,
        recipe
      )

      expect(metadata.source).toBe('recipe_alteration')
      expect(metadata.recipeId).toBe(recipe.id)
      expect(metadata.recipePayload.name).toBe('Hildegard’s Barley Soup')
      expect(metadata).not.toHaveProperty('madeIt')
      expect(metadata).not.toHaveProperty('made_it')
      expect(alterRecipe).toHaveBeenCalledWith({
        agentId: agent.agentId,
        recipeId: recipe.id,
        recipeName: recipe.name,
        syncToWten: false,
        persistLocal: false,
      })
    }
  )

  it.each(['recipe_generation', 'made_it'])(
    'does not claim a dish was cooked for a fallback %s review',
    async eventType => {
      alterRecipe.mockRejectedValueOnce(new Error('Alteration unavailable'))
      const metadata = await (feedActivationEngine as any).generateMetadataPayload(
        agent,
        moment,
        { reason: 'elemental_surge_resonance', intensity: 0.75 },
        eventType,
        0.7,
        0.8,
        recipe
      )

      expect(metadata.source).toBe('catalog_review')
      expect(metadata.recipeId).toBe(recipe.id)
      expect(metadata.review).toBe('A reflective note about the soup.')
      expect(metadata).not.toHaveProperty('madeIt')
      expect(metadata).not.toHaveProperty('made_it')
      expect(voicedText).toHaveBeenCalledOnce()
    }
  )
})

describe('historical review delivery provenance', () => {
  it('preserves separate delivery outcomes and an unconfirmed remote comment', async () => {
    const result = await generateHistoricalRecipeReview({
      agentId: agent.agentId,
      recipeId: recipe.id,
    })

    expect(result).toMatchObject({
      ok: true,
      deliveryId: 'recipe-delivery-1',
      feedPublished: true,
      localCommentSaved: false,
    })
    expect(result.eventId).toBeUndefined()
    expect(result.recipeCommentSaved).toBeUndefined()
  })

  it('preserves explicit false outcomes and the alteration result status', async () => {
    alterRecipe.mockResolvedValueOnce(
      alteration({
        ok: false,
        feedPublished: false,
        localCommentSaved: true,
        recipeCommentSaved: false,
      })
    )
    const result = await generateHistoricalRecipeReview({
      agentId: agent.agentId,
      syncToWten: false,
    })

    expect(result).toMatchObject({
      ok: false,
      feedPublished: false,
      localCommentSaved: true,
      recipeCommentSaved: false,
    })
    expect(alterRecipe).toHaveBeenCalledWith(expect.objectContaining({ syncToWten: false }))
  })

  it('propagates an explicitly confirmed feed event and remote comment', async () => {
    alterRecipe.mockResolvedValueOnce(
      alteration({
        feedEventId: 'confirmed-feed-event',
        recipeCommentSaved: true,
      })
    )
    const result = await generateHistoricalRecipeReview({ agentId: agent.agentId })

    expect(result.eventId).toBe('confirmed-feed-event')
    expect(result.recipeCommentSaved).toBe(true)
  })
})

describe('historical review read outcomes', () => {
  it('propagates a database failure instead of returning a healthy empty list', async () => {
    const failure = new Error('Database offline')
    findMany.mockRejectedValueOnce(failure)

    await expect(getRecentHistoricalRecipeReviews(5)).rejects.toBe(failure)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }))
  })

  it('returns a successful empty list when the database has no reviews', async () => {
    await expect(getRecentHistoricalRecipeReviews()).resolves.toEqual([])
  })

  it('does not manufacture a rating for an unrated review', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'review-1',
        agentId: agent.agentId,
        createdAt: moment.timestamp,
        metadataPayload: { recipeId: recipe.id, review: 'A useful variation.' },
      },
    ])

    const result = await getRecentHistoricalRecipeReviews()
    expect(result).toHaveLength(1)
    expect(result[0].rating).toBeUndefined()
  })
})
