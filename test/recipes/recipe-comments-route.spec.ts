import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/recipes/[recipeId]/comments/route'

const { findMany, fetchMock } = vi.hoisted(() => ({
  findMany: vi.fn(),
  fetchMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { agent_action_events: { findMany } },
}))

const recipeId = 'italian-risotto-alla-milanese'

function localComment(metadata: Record<string, unknown> = {}) {
  return {
    id: 'local-event',
    agentId: 'hildegard-von-bingen',
    createdAt: new Date('2026-10-16T12:00:00Z'),
    postedAt: null,
    metadataPayload: { recipeId, review: 'A useful variation.', ...metadata },
  }
}

async function getComments() {
  return GET(new NextRequest(`https://example.test/api/recipes/${recipeId}/comments`), {
    params: Promise.resolve({ recipeId }),
  })
}

describe('recipe comments source boundaries', () => {
  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([])
    fetchMock.mockReset().mockResolvedValue(Response.json({ tips: [] }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('filters both recipe ID fields in the database before applying the limit', async () => {
    findMany.mockResolvedValue([
      localComment({ recipeId: undefined, recipe_id: recipeId }),
      localComment({ recipeId: 'another-recipe', review: 'Not this recipe.' }),
    ])

    const response = await getComments()
    const body = await response.json()

    expect(findMany).toHaveBeenCalledWith({
      where: {
        eventType: { in: ['recipe_generation', 'made_it', 'recipe_adapted', 'recipe_review'] },
        OR: [
          { metadataPayload: { path: ['recipeId'], equals: recipeId } },
          { metadataPayload: { path: ['recipe_id'], equals: recipeId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    expect(body.count).toBe(1)
    expect(body.comments[0]).not.toHaveProperty('rating')
    expect(body.bounded).toBe(true)
  })

  it('preserves upstream IDs, accepts comment text, and leaves unknown actor types as community', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ tips: [{ id: 'upstream-comment', comment: 'A community note.' }] })
    )

    const body = await (await getComments()).json()

    expect(body.comments).toEqual([
      expect.objectContaining({
        id: 'upstream-comment',
        comment: 'A community note.',
        authorType: 'community',
      }),
    ])
    expect(body.comments[0]).not.toHaveProperty('postedAt')
  })

  it('keeps the WTEN tip contract and skips empty or duplicate comments', async () => {
    findMany.mockResolvedValue([localComment()])
    fetchMock.mockResolvedValue(
      Response.json({
        tips: [
          { tip: 'A useful variation.' },
          { tip: '   ' },
          { tip: 'A second note.', authorType: 'agent' },
          null,
        ],
      })
    )

    const body = await (await getComments()).json()

    expect(body.count).toBe(2)
    expect(body.comments[1]).toMatchObject({ comment: 'A second note.', authorType: 'agent' })
  })

  it('reports healthy empty sources without treating them as a failure', async () => {
    const response = await getComments()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      degraded: false,
      comments: [],
      sources: {
        local: { success: true, limit: 50 },
        wten: { success: true, limit: 10, coverage: 'top-rated-tips' },
      },
    })
  })

  it('returns local results with an explicit degraded status when WTEN fails', async () => {
    findMany.mockResolvedValue([localComment()])
    fetchMock.mockResolvedValue(new Response('Unavailable', { status: 503 }))

    const response = await getComments()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      degraded: true,
      count: 1,
      sources: { local: { success: true }, wten: { success: false } },
    })
  })

  it('returns community results when the local database fails', async () => {
    findMany.mockRejectedValue(new Error('Database unavailable'))
    fetchMock.mockResolvedValue(Response.json({ tips: [{ tip: 'A remote note.' }] }))

    const response = await getComments()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      degraded: true,
      count: 1,
      sources: { local: { success: false }, wten: { success: true } },
    })
  })

  it('returns 503 when neither source can be read', async () => {
    findMany.mockRejectedValue(new Error('Database unavailable'))
    fetchMock.mockRejectedValue(new Error('Network unavailable'))

    const response = await getComments()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({ success: false, degraded: true, comments: [] })
  })

  it('treats malformed upstream data as unavailable and bounds valid upstream lists', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ unexpected: [] }))
    expect(await (await getComments()).json()).toMatchObject({
      degraded: true,
      sources: { wten: { success: false } },
    })

    fetchMock.mockResolvedValueOnce(
      Response.json({ tips: Array.from({ length: 15 }, (_, index) => ({ tip: `Tip ${index}` })) })
    )
    const body = await (await getComments()).json()
    expect(body.count).toBe(10)
    expect(body.degraded).toBe(false)
  })
})
