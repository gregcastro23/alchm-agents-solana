// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/menu-publication', () => ({ publicationActor: vi.fn() }))
vi.mock('@/lib/recipes/recipe-alteration-service', () => ({
  RecipeNotFoundError: class RecipeNotFoundError extends Error {},
  recipeAlterationService: { alterRecipe: vi.fn() },
}))
vi.mock('@/lib/security/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimit: vi.fn(() => ({ ok: true, resetMs: 60_000 })),
}))

import { publicationActor } from '@/lib/menu-publication'
import {
  RecipeNotFoundError,
  recipeAlterationService,
} from '@/lib/recipes/recipe-alteration-service'
import { POST } from '@/app/api/recipes/alter/route'

function request(body: unknown = { agentId: 'leonardo-da-vinci' }) {
  return new NextRequest('https://agents.test/api/recipes/alter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'publisher-key' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(publicationActor).mockResolvedValue({ id: 'user:publisher-1' })
  vi.mocked(recipeAlterationService.alterRecipe).mockResolvedValue({ ok: true } as any)
})

describe('recipe alteration publisher boundary', () => {
  it.each([401, 403])('rejects a caller denied with %s before any alteration', async status => {
    vi.mocked(publicationActor).mockResolvedValue({
      response: NextResponse.json({ success: false, error: 'Publisher required' }, { status }),
    })
    const req = request({ agentId: 'leonardo-da-vinci', syncToWten: false })
    const response = await POST(req)
    expect(response.status).toBe(status)
    expect(publicationActor).toHaveBeenCalledWith(req)
    expect(recipeAlterationService.alterRecipe).not.toHaveBeenCalled()
  })

  it('accepts a verified publisher and applies explicit defaults', async () => {
    const response = await POST(request({ agentId: ' leonardo-da-vinci ' }))
    expect(response.status).toBe(200)
    expect(recipeAlterationService.alterRecipe).toHaveBeenCalledWith({
      agentId: 'leonardo-da-vinci',
      rating: 5,
      syncToWten: true,
    })
    expect(await response.json()).toEqual({ success: true, ok: true })
  })

  it('passes validated optional values and preserves an explicit no-sync request', async () => {
    const response = await POST(
      request({
        agentId: 'leonardo-da-vinci',
        recipeId: ' soup-1 ',
        preferredCuisine: ' Italian ',
        mealType: ' dinner ',
        customPrompt: ' Use seasonal herbs. ',
        rating: 4,
        syncToWten: false,
      })
    )
    expect(response.status).toBe(200)
    expect(recipeAlterationService.alterRecipe).toHaveBeenCalledWith({
      agentId: 'leonardo-da-vinci',
      recipeId: 'soup-1',
      preferredCuisine: 'Italian',
      mealType: 'dinner',
      customPrompt: 'Use seasonal herbs.',
      rating: 4,
      syncToWten: false,
    })
  })

  it('returns 404 when an explicit recipe does not exist', async () => {
    vi.mocked(recipeAlterationService.alterRecipe).mockRejectedValue(
      new RecipeNotFoundError('Recipe not found: missing-recipe')
    )
    const response = await POST(
      request({ agentId: 'leonardo-da-vinci', recipeId: 'missing-recipe' })
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Recipe not found: missing-recipe',
    })
  })
})

describe('recipe alteration input validation', () => {
  it.each([
    null,
    [],
    {},
    { agentId: 42 },
    { agentId: '   ' },
    { agentId: 'leonardo-da-vinci', recipeId: 12 },
    { agentId: 'leonardo-da-vinci', recipeId: '' },
    { agentId: 'leonardo-da-vinci', preferredCuisine: false },
    { agentId: 'leonardo-da-vinci', mealType: [] },
    { agentId: 'leonardo-da-vinci', customPrompt: {} },
    { agentId: 'leonardo-da-vinci', rating: '5' },
    { agentId: 'leonardo-da-vinci', rating: 6 },
    { agentId: 'leonardo-da-vinci', syncToWten: 'false' },
    { agentId: 'leonardo-da-vinci', role: 'admin' },
  ])('rejects malformed payload %j without an alteration', async body => {
    expect((await POST(request(body))).status).toBe(400)
    expect(recipeAlterationService.alterRecipe).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON', async () => {
    const response = await POST(
      new NextRequest('https://agents.test/api/recipes/alter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      })
    )
    expect(response.status).toBe(400)
    expect(recipeAlterationService.alterRecipe).not.toHaveBeenCalled()
  })
})
