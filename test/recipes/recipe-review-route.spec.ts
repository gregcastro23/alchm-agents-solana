// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/menu-publication', () => ({ publicationActor: vi.fn() }))
vi.mock('@/lib/agents/historical-recipe-review', () => ({
  generateHistoricalRecipeReview: vi.fn(),
  getRecentHistoricalRecipeReviews: vi.fn(),
}))
vi.mock('@/lib/recipes/recipe-alteration-service', () => ({
  RecipeNotFoundError: class RecipeNotFoundError extends Error {},
}))

import { publicationActor } from '@/lib/menu-publication'
import {
  generateHistoricalRecipeReview,
  getRecentHistoricalRecipeReviews,
} from '@/lib/agents/historical-recipe-review'
import { RecipeNotFoundError } from '@/lib/recipes/recipe-alteration-service'
import { GET, POST } from '@/app/api/agents/recipe-review/route'

function request(body: unknown = { agentId: 'hildegard-of-bingen' }) {
  return new NextRequest('https://agents.test/api/agents/recipe-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(publicationActor).mockResolvedValue({ id: 'user:publisher-1' })
  vi.mocked(generateHistoricalRecipeReview).mockResolvedValue({ ok: true } as any)
  vi.mocked(getRecentHistoricalRecipeReviews).mockResolvedValue([])
})

describe('historical recipe review reads', () => {
  it.each(['NaN', '-1', '0', '51', '2.5', ''])('rejects invalid limit %j', async limit => {
    const response = await GET(
      new NextRequest(`https://agents.test/api/agents/recipe-review?limit=${limit}`)
    )
    expect(response.status).toBe(400)
    expect(getRecentHistoricalRecipeReviews).not.toHaveBeenCalled()
  })

  it('reports unavailable review storage as a failure', async () => {
    vi.mocked(getRecentHistoricalRecipeReviews).mockRejectedValue(new Error('DB unavailable'))
    const response = await GET(new NextRequest('https://agents.test/api/agents/recipe-review'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ success: false, error: 'Failed to fetch reviews' })
  })

  it('returns a healthy empty result only after a successful read', async () => {
    const response = await GET(new NextRequest('https://agents.test/api/agents/recipe-review'))
    expect(response.status).toBe(200)
    expect(getRecentHistoricalRecipeReviews).toHaveBeenCalledWith(20)
    expect(await response.json()).toEqual({ success: true, reviews: [] })
  })
})

describe('historical recipe review publication', () => {
  it.each([401, 403])('requires publisher authorization before a write (%s)', async status => {
    vi.mocked(publicationActor).mockResolvedValue({
      response: NextResponse.json({ error: 'Publisher required' }, { status }),
    })
    const req = request()
    expect((await POST(req)).status).toBe(status)
    expect(publicationActor).toHaveBeenCalledWith(req)
    expect(generateHistoricalRecipeReview).not.toHaveBeenCalled()
  })

  it('publishes for a verified caller with normalized input', async () => {
    const response = await POST(
      request({
        agentId: ' hildegard-of-bingen ',
        recipeId: ' soup-1 ',
        recipeName: ' Herb Soup ',
        rating: 4,
        promptHint: ' Consider spelt. ',
        location: { lat: 40.7, lon: -74 },
      })
    )
    expect(response.status).toBe(200)
    expect(generateHistoricalRecipeReview).toHaveBeenCalledWith({
      agentId: 'hildegard-of-bingen',
      recipeId: 'soup-1',
      recipeName: 'Herb Soup',
      rating: 4,
      promptHint: 'Consider spelt.',
      location: { lat: 40.7, lon: -74 },
      syncToWten: true,
    })
    expect(await response.json()).toEqual({ success: true, ok: true })
  })

  it('returns 404 for an explicit recipe missing from the catalog', async () => {
    vi.mocked(generateHistoricalRecipeReview).mockRejectedValue(new RecipeNotFoundError('missing'))
    const response = await POST(request({ agentId: 'hildegard-of-bingen', recipeId: 'missing' }))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ success: false, error: 'missing' })
  })

  it.each([
    null,
    {},
    { agentId: ' ' },
    { agentId: 1 },
    { agentId: 'hildegard-of-bingen', recipeId: [] },
    { agentId: 'hildegard-of-bingen', recipeName: 42 },
    { agentId: 'hildegard-of-bingen', rating: '5' },
    { agentId: 'hildegard-of-bingen', rating: 0 },
    { agentId: 'hildegard-of-bingen', promptHint: true },
    { agentId: 'hildegard-of-bingen', location: { lat: 91, lon: 0 } },
    { agentId: 'hildegard-of-bingen', location: { lat: 0, lon: -181 } },
    { agentId: 'hildegard-of-bingen', syncToWten: false },
  ])('rejects invalid payload %j before calling the service', async body => {
    expect((await POST(request(body))).status).toBe(400)
    expect(generateHistoricalRecipeReview).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const response = await POST(
      new NextRequest('https://agents.test/api/agents/recipe-review', {
        method: 'POST',
        body: '{',
      })
    )
    expect(response.status).toBe(400)
    expect(generateHistoricalRecipeReview).not.toHaveBeenCalled()
  })
})
