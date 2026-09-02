import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { ragCache } from '@/lib/rag/rag-cache'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [] }) }))

vi.mock('@/lib/db', () => ({
  prisma: {
    users: { findFirst: vi.fn() },
    rAGQuery: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    rAGFeedback: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    admin_audit_log: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rag/rag-cache', () => ({
  ragCache: {
    getStats: vi.fn(() => ({ cacheSize: 0, totalHits: 0 })),
    clear: vi.fn(),
    invalidateAgent: vi.fn(),
  },
}))

const getServerSessionMock = vi.mocked(getServerSession)
const db = vi.mocked(prisma, { deep: true })

function request(path: string, init?: RequestInit) {
  return new NextRequest(`https://agents.alchm.kitchen${path}`, init as never)
}

describe('admin-adjacent operations authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue(null)
    db.users.findFirst.mockResolvedValue({
      id: 'admin-1',
      email: 'ops@example.com',
      name: 'Ops',
      role: 'admin',
    } as never)
    db.admin_audit_log.create.mockResolvedValue({ id: 'audit-1' } as never)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const guardedReads: Array<[string, () => Promise<Response>]> = [
    [
      '/api/rag/analytics',
      async () => {
        const { GET } = await import('@/app/api/rag/analytics/route')
        return GET(request('/api/rag/analytics'))
      },
    ],
    [
      '/api/rag/cache',
      async () => {
        const { GET } = await import('@/app/api/rag/cache/route')
        return GET(request('/api/rag/cache'))
      },
    ],
    [
      '/api/rag/feedback',
      async () => {
        const { GET } = await import('@/app/api/rag/feedback/route')
        return GET(request('/api/rag/feedback'))
      },
    ],
    [
      '/api/knowledge-updater',
      async () => {
        const { GET } = await import('@/app/api/knowledge-updater/route')
        return GET(request('/api/knowledge-updater')) as Promise<Response>
      },
    ],
  ]

  it.each(guardedReads)('rejects anonymous operational reads from %s', async (_path, call) => {
    const response = await call()

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
  })

  const guardedWrites: Array<[string, () => Promise<Response>]> = [
    [
      '/api/knowledge-updater/ingest',
      async () => {
        const { POST } = await import('@/app/api/knowledge-updater/ingest/route')
        return POST(request('/api/knowledge-updater/ingest', { method: 'POST' }))
      },
    ],
    [
      '/api/vector-store/ingest',
      async () => {
        const { POST } = await import('@/app/api/vector-store/ingest/route')
        return POST(request('/api/vector-store/ingest', { method: 'POST' }))
      },
    ],
  ]

  it.each(guardedWrites)('rejects anonymous operational mutations at %s', async (_path, call) => {
    const response = await call()

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
  })

  it('rejects cross-origin cookie-authenticated mutations before state changes', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'ops@example.com', role: 'admin' },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as never)
    const { DELETE } = await import('@/app/api/rag/cache/route')

    const response = await DELETE(
      request('/api/rag/cache', {
        method: 'DELETE',
        headers: { origin: 'https://attacker.example' },
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Invalid request origin' })
    expect(ragCache.clear).not.toHaveBeenCalled()
  })

  it('allows service-authenticated mutations without browser origin headers', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'service-secret')
    const { DELETE } = await import('@/app/api/rag/cache/route')

    const response = await DELETE(
      request('/api/rag/cache', {
        method: 'DELETE',
        headers: { authorization: 'Bearer service-secret' },
      })
    )

    expect(response.status).toBe(200)
    expect(ragCache.clear).toHaveBeenCalledOnce()
    expect(db.admin_audit_log.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorSource: 'internal-secret',
          action: 'rag.cache.clear.requested',
        }),
      })
    )
    expect(getServerSessionMock).not.toHaveBeenCalled()
  })

  it('does not treat the kitchen sync credential as admin-adjacent service auth', async () => {
    vi.stubEnv('ALCHM_KITCHEN_SYNC_SECRET', 'sync-secret')
    const { DELETE } = await import('@/app/api/rag/cache/route')

    const response = await DELETE(
      request('/api/rag/cache', {
        method: 'DELETE',
        headers: { 'x-sync-secret': 'sync-secret' },
      })
    )

    expect(response.status).toBe(401)
    expect(ragCache.clear).not.toHaveBeenCalled()
  })

  it('does not mutate RAG cache when the mandatory audit write fails', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'service-secret')
    db.admin_audit_log.create.mockRejectedValue(new Error('audit unavailable'))
    const { DELETE } = await import('@/app/api/rag/cache/route')

    const response = await DELETE(
      request('/api/rag/cache', {
        method: 'DELETE',
        headers: { authorization: 'Bearer service-secret' },
      })
    )

    expect(response.status).toBe(503)
    expect(ragCache.clear).not.toHaveBeenCalled()
  })

  it('rejects cross-origin native admin actions', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'ops@example.com', role: 'admin' },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as never)
    const { POST } = await import('@/app/api/admin/system-stats/route')

    const response = await POST(
      request('/api/admin/system-stats', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://attacker.example' },
        body: JSON.stringify({ action: 'clear_cache', data: {} }),
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Invalid request origin' })
  })

  it('does not execute native admin actions when their audit cannot be recorded', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'ops@example.com', role: 'admin' },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as never)
    db.admin_audit_log.create.mockRejectedValue(new Error('audit unavailable'))
    const { POST } = await import('@/app/api/admin/system-stats/route')

    const response = await POST(
      request('/api/admin/system-stats', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://agents.alchm.kitchen' },
        body: JSON.stringify({ action: 'clear_cache', data: {} }),
      })
    )

    expect(response.status).toBe(503)
    expect((await response.json()).error).toContain('audit')
  })

  it('does not start knowledge ingestion when its mandatory audit cannot be recorded', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'service-secret')
    vi.stubEnv('USE_RAG_GENERATION', 'true')
    db.admin_audit_log.create.mockRejectedValue(new Error('audit unavailable'))
    const { POST } = await import('@/app/api/knowledge-updater/route')

    const response = (await POST(
      request('/api/knowledge-updater', {
        method: 'POST',
        headers: {
          authorization: 'Bearer service-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          type: 'pdf',
          agentId: 'agent-1',
          path: '/srv/knowledge/reference.pdf',
        }),
      })
    )) as Response

    expect(response.status).toBe(503)
    expect((await response.json()).error).toContain('audit')
  })

  it('does not start vector ingestion when its mandatory audit cannot be recorded', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'service-secret')
    vi.stubEnv('USE_RAG_GENERATION', 'true')
    db.admin_audit_log.create.mockRejectedValue(new Error('audit unavailable'))
    const { POST } = await import('@/app/api/vector-store/ingest/route')

    const response = await POST(
      request('/api/vector-store/ingest', {
        method: 'POST',
        headers: {
          authorization: 'Bearer service-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ options: {} }),
      })
    )

    expect(response.status).toBe(503)
    expect((await response.json()).error).toContain('audit')
  })

  it('allows anonymous gallery chat to persist a redacted-linkable RAG query', async () => {
    db.rAGQuery.create.mockResolvedValue({ id: 'anonymous-query-1', sources: [] } as never)
    const { POST } = await import('@/app/api/rag/analytics/route')

    const response = await POST(
      request('/api/rag/analytics', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://agents.alchm.kitchen' },
        body: JSON.stringify({ agentId: 'agent-1', query: 'hello', sessionId: 'session-1' }),
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, queryId: 'anonymous-query-1' })
    expect(db.rAGQuery.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: null }) })
    )
  })

  it('uses the signed-in user identity and returns the persisted RAG query ID', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as never)
    db.rAGQuery.create.mockResolvedValue({ id: 'db-query-1', sources: [] } as never)
    const { POST } = await import('@/app/api/rag/analytics/route')

    const response = await POST(
      request('/api/rag/analytics', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://agents.alchm.kitchen' },
        body: JSON.stringify({
          agentId: 'agent-1',
          agentName: 'Agent',
          query: 'hello',
          queryLength: 5,
          ragUsed: false,
          sourcesRetrieved: 0,
          retrievalTime: 0,
          totalTime: 10,
          success: true,
          relevanceScores: [],
          averageRelevance: 0,
          sessionId: 'session-1',
          userId: 'forged-user',
          sources: [],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, queryId: 'db-query-1' })
    expect(db.rAGQuery.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1' }) })
    )
  })

  it('returns a versioned, redacted RAG admin snapshot', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'ops@example.com', role: 'admin' },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as never)
    db.rAGQuery.findMany.mockResolvedValue([
      {
        id: 'db-query-1',
        timestamp: new Date('2026-09-01T12:00:00.000Z'),
        agentId: 'agent-1',
        agentName: 'Agent',
        queryLength: 14,
        ragUsed: true,
        sourcesRetrieved: 2,
        retrievalTime: 30,
        generationTime: 70,
        totalTime: 100,
        success: true,
        avgRelevance: 0.8,
      },
    ] as never)
    db.rAGQuery.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(1)
    db.rAGQuery.aggregate.mockResolvedValue({
      _avg: { retrievalTime: 30, generationTime: 70, totalTime: 100, avgRelevance: 0.8 },
      _sum: { sourcesRetrieved: 2 },
      _count: { id: 1 },
    } as never)
    const { GET } = await import('@/app/api/rag/analytics/route')

    const response = await GET(request('/api/rag/analytics'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.contract).toMatchObject({ version: 1, source: 'postgres', content: 'redacted' })
    expect(body.queries[0]).not.toHaveProperty('query')
    expect(body.queries[0]).not.toHaveProperty('sources')
    expect(db.rAGQuery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          query: expect.anything(),
          sources: expect.anything(),
        }),
      })
    )
  })

  it('links feedback only to the matching persisted query and signed-in user', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as never)
    db.rAGQuery.findUnique.mockResolvedValue({
      id: 'db-query-1',
      agentId: 'agent-1',
      sessionId: 'session-1',
      userId: 'user-1',
    } as never)
    db.rAGFeedback.create.mockResolvedValue({ id: 'feedback-1' } as never)
    const { POST } = await import('@/app/api/rag/feedback/route')

    const response = await POST(
      request('/api/rag/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://agents.alchm.kitchen' },
        body: JSON.stringify({
          queryId: 'db-query-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          userId: 'forged-user',
          thumbsUp: true,
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(db.rAGFeedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ queryId: 'db-query-1', userId: 'user-1' }),
    })
  })

  it('returns feedback metadata without identifiers or comments', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'ops@example.com', role: 'admin' },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as never)
    db.rAGFeedback.findMany.mockResolvedValue([
      {
        timestamp: new Date('2026-09-01T12:00:00.000Z'),
        agentId: 'agent-1',
        thumbsUp: true,
        starRating: 5,
        sourcesHelpful: true,
      },
    ] as never)
    db.rAGFeedback.count.mockResolvedValue(1)
    db.rAGFeedback.aggregate.mockResolvedValue({
      _avg: { starRating: 5 },
      _count: { id: 1, thumbsUp: 1, starRating: 1 },
    } as never)
    const { GET } = await import('@/app/api/rag/feedback/route')

    const response = await GET(request('/api/rag/feedback'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.feedback[0]).toEqual({
      timestamp: '2026-09-01T12:00:00.000Z',
      agentId: 'agent-1',
      thumbsUp: true,
      starRating: 5,
      sourcesHelpful: true,
    })
    expect(db.rAGFeedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          userId: expect.anything(),
          comment: expect.anything(),
        }),
      })
    )
  })
})
