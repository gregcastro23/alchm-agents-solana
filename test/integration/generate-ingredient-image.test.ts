import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildIngredientPrompt,
  resolveStoragePath,
  extractImageUrl,
  type IngredientImageInput,
} from '@/lib/ingredient-image-generator'

// ---------------------------------------------------------------------------
// Mock the provider so tests never hit the network
// ---------------------------------------------------------------------------
vi.mock('@/lib/astrologize', () => ({
  fetchImaginize: vi.fn(),
}))

// next/server is not available in jsdom — provide minimal stubs
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

import { fetchImaginize } from '@/lib/astrologize'
import { POST } from '@/app/api/generate-ingredient-image/route'

// ---------------------------------------------------------------------------
// buildIngredientPrompt
// ---------------------------------------------------------------------------
describe('buildIngredientPrompt', () => {
  it('includes the ingredient name', () => {
    expect(buildIngredientPrompt({ name: 'Saffron' })).toContain('Saffron')
  })

  it('includes category in parentheses when provided', () => {
    const prompt = buildIngredientPrompt({ name: 'Saffron', category: 'Spice' })
    expect(prompt).toContain('(Spice)')
  })

  it('appends first sentence of description (max 120 chars)', () => {
    const prompt = buildIngredientPrompt({
      name: 'Truffle',
      description: 'A rare subterranean fungus. Known for its deep umami.',
    })
    expect(prompt).toContain('a rare subterranean fungus')
    expect(prompt).not.toContain('Known for')
  })

  it('adds elemental accent only for dominant elements (> 0.3)', () => {
    const prompt = buildIngredientPrompt({
      name: 'Chili',
      elementalProperties: { Fire: 0.8, Water: 0.1, Earth: 0.05, Air: 0.05 },
    })
    expect(prompt).toContain('warm amber side lighting')
    expect(prompt).not.toContain('cool moisture')
  })

  it('adds two accents when two elements exceed threshold', () => {
    const prompt = buildIngredientPrompt({
      name: 'Seaweed',
      elementalProperties: { Fire: 0.05, Water: 0.6, Earth: 0.05, Air: 0.4 },
    })
    expect(prompt).toContain('cool moisture')
    expect(prompt).toContain('soft airy backlighting')
  })

  it('omits elemental accent when no element exceeds 0.3', () => {
    const prompt = buildIngredientPrompt({
      name: 'Neutral Herb',
      elementalProperties: { Fire: 0.1, Water: 0.1, Earth: 0.1, Air: 0.1 },
    })
    expect(prompt).not.toContain('accent')
  })

  it('includes up to 4 qualities', () => {
    const prompt = buildIngredientPrompt({
      name: 'Herb',
      qualities: ['aromatic', 'bitter', 'cooling', 'fresh', 'pungent'],
    })
    expect(prompt).toContain('aromatic')
    expect(prompt).toContain('fresh')
    expect(prompt).not.toContain('pungent')
  })

  it('includes photography style directives', () => {
    const prompt = buildIngredientPrompt({ name: 'Basil' })
    expect(prompt).toContain('professional food photography')
    expect(prompt).toContain('studio lighting')
    expect(prompt).toContain('dark slate surface')
  })
})

// ---------------------------------------------------------------------------
// resolveStoragePath
// ---------------------------------------------------------------------------
describe('resolveStoragePath', () => {
  it('prefers slug over ingredient_id and name', () => {
    expect(resolveStoragePath({ slug: 'fresh-basil', ingredient_id: 'id-1', name: 'Basil' })).toBe(
      'ingredients/fresh-basil.png'
    )
  })

  it('falls back to ingredient_id when no slug', () => {
    expect(resolveStoragePath({ ingredient_id: 'ing-42', name: 'Basil' })).toBe(
      'ingredients/ing-42.png'
    )
  })

  it('normalizes name to kebab-case when no slug or id', () => {
    expect(resolveStoragePath({ name: 'Black Truffle' })).toBe('ingredients/black-truffle.png')
  })

  it('strips leading and trailing hyphens from normalized name', () => {
    expect(resolveStoragePath({ name: '---weird---' })).toBe('ingredients/weird.png')
  })

  it('collapses consecutive special chars into one hyphen', () => {
    expect(resolveStoragePath({ name: 'Star   Anise!!!' })).toBe('ingredients/star-anise.png')
  })
})

// ---------------------------------------------------------------------------
// extractImageUrl
// ---------------------------------------------------------------------------
describe('extractImageUrl', () => {
  it('returns generated_image_url first', () => {
    expect(
      extractImageUrl({ generated_image_url: 'https://a.com/img.png', url: 'https://b.com' })
    ).toBe('https://a.com/img.png')
  })

  it('falls back to url when generated_image_url absent', () => {
    expect(extractImageUrl({ url: 'https://b.com/img.png' })).toBe('https://b.com/img.png')
  })

  it('falls back to imageUrl as last resort', () => {
    expect(extractImageUrl({ imageUrl: 'https://c.com/img.png' })).toBe('https://c.com/img.png')
  })

  it('returns null when no URL fields are present', () => {
    expect(extractImageUrl({ fallback: true, error: 'unavailable' })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// POST handler — request validation, provider call, response shape
// ---------------------------------------------------------------------------
describe('POST /api/generate-ingredient-image handler', () => {
  beforeEach(() => vi.resetAllMocks())

  const makeRequest = (body: unknown) =>
    new Request('http://localhost/api/generate-ingredient-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as unknown as Parameters<typeof POST>[0]

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest({ category: 'Spice' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/name/)
  })

  it('returns 400 when name is an empty string', async () => {
    const res = await POST(makeRequest({ name: '   ' }))
    expect(res.status).toBe(400)
  })

  it('returns standardized response shape on success', async () => {
    vi.mocked(fetchImaginize).mockResolvedValue({
      generated_image_url: 'ingredients/saffron.png',
    })

    const res = await POST(
      makeRequest({
        name: 'Saffron',
        slug: 'saffron',
        category: 'Spice',
        elementalProperties: { Fire: 0.7, Earth: 0.2, Water: 0.1, Air: 0.0 },
        qualities: ['floral', 'medicinal'],
      } satisfies IngredientImageInput)
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('ingredients/saffron.png')
    expect(json.image_url).toBe(json.url)
    expect(json.provider).toBe('nanobanana')
    expect(typeof json.prompt).toBe('string')
    expect(json.prompt).toContain('Saffron')
    expect(json.storage_path).toBe('ingredients/saffron.png')
  })

  it('passes photorealistic options to fetchImaginize', async () => {
    vi.mocked(fetchImaginize).mockResolvedValue({ url: 'ingredients/cardamom.png' })

    await POST(makeRequest({ name: 'Cardamom' }))

    expect(vi.mocked(fetchImaginize)).toHaveBeenCalledWith(
      expect.stringContaining('Cardamom'),
      expect.objectContaining({ style_preset: 'photorealistic', width: 1024, height: 1024 })
    )
  })

  it('includes fallback fields when provider is degraded', async () => {
    vi.mocked(fetchImaginize).mockResolvedValue({
      imageUrl: null,
      fallback: true,
      error: 'External image service unavailable (503)',
    })

    const res = await POST(makeRequest({ name: 'Cardamom' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.fallback).toBe(false)
    expect(json.url).toBe('ingredients/cardamom.png')
    expect(json.image_url).toBe('ingredients/cardamom.png')
    expect(json.provider).toBe('nanobanana')
    expect(json.storage_path).toContain('ingredients/')
  })

  it('returns 200 even when fetchImaginize throws (async generation)', async () => {
    vi.mocked(fetchImaginize).mockRejectedValue(new Error('connection refused'))

    const res = await POST(makeRequest({ name: 'Vanilla' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('ingredients/vanilla.png')
    expect(json.image_url).toBe('ingredients/vanilla.png')
    expect(json.provider).toBe('nanobanana')
  })

  it('uses slug for storage_path when provided', async () => {
    vi.mocked(fetchImaginize).mockResolvedValue({ url: 'https://example.com/img.png' })

    const res = await POST(makeRequest({ name: 'Black Truffle', slug: 'black-truffle' }))
    const json = await res.json()
    expect(json.storage_path).toBe('ingredients/black-truffle.png')
  })

  it('normalizes name to storage_path when no slug or id', async () => {
    vi.mocked(fetchImaginize).mockResolvedValue({ url: 'https://example.com/img.png' })

    const res = await POST(makeRequest({ name: 'Star Anise' }))
    const json = await res.json()
    expect(json.storage_path).toBe('ingredients/star-anise.png')
  })
})
