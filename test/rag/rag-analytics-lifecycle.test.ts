import { afterEach, describe, expect, it, vi } from 'vitest'
import { RAGAnalyticsManager } from '@/lib/rag/rag-analytics'
import { parseRagAdminSnapshot } from '@/lib/rag/rag-admin-snapshot'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('RAG analytics query lifecycle', () => {
  it('returns the database query ID used by feedback and does not persist raw prompts locally', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, queryId: 'db-query-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    const analytics = new RAGAnalyticsManager()

    const queryId = await analytics.logQuery({
      agentId: 'agent-1',
      agentName: 'Agent',
      query: 'private prompt',
      queryLength: 14,
      ragUsed: false,
      sourcesRetrieved: 0,
      retrievalTime: 0,
      totalTime: 10,
      success: true,
      relevanceScores: [],
      averageRelevance: 0,
      sessionId: 'session-1',
    })

    expect(queryId).toBe('db-query-1')
    expect(storageSpy).not.toHaveBeenCalled()
    expect(analytics.getRecentLogs(1)[0]?.id).toBe('db-query-1')
  })

  it('maps the server contract without reconstructing prompt or session content', () => {
    const snapshot = parseRagAdminSnapshot({
      contract: {
        version: 1,
        generatedAt: '2026-09-01T12:00:00.000Z',
        source: 'postgres',
        status: 'ok',
        healthStatus: 'good',
        content: 'redacted',
      },
      queries: [
        {
          id: 'db-query-1',
          timestamp: '2026-09-01T11:00:00.000Z',
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
      ],
      stats: {
        totalQueries: 10,
        ragUsageRate: 0.6,
        successRate: 0.9,
        avgRetrievalTime: 30,
        avgGenerationTime: 70,
        avgTotalTime: 100,
        avgRelevance: 0.8,
        totalSources: 20,
      },
    })

    expect(snapshot.analytics.totalQueries).toBe(10)
    expect(snapshot.analytics.ragEnabledQueries).toBe(6)
    expect(snapshot.analytics.healthStatus).toBe('good')
    expect(snapshot.recentLogs[0]).toMatchObject({
      id: 'db-query-1',
      query: '[redacted]',
      sessionId: '[redacted]',
    })
  })

  it('marks an empty server snapshot as empty instead of failed', () => {
    const snapshot = parseRagAdminSnapshot({
      contract: {
        version: 1,
        generatedAt: '2026-09-01T12:00:00.000Z',
        source: 'postgres',
        status: 'empty',
        healthStatus: 'empty',
        content: 'redacted',
      },
      queries: [],
      stats: {
        totalQueries: 0,
        ragUsageRate: 0,
        successRate: 0,
        avgRetrievalTime: 0,
        avgGenerationTime: 0,
        avgTotalTime: 0,
        avgRelevance: 0,
        totalSources: 0,
      },
    })

    expect(snapshot.analytics.dataStatus).toBe('empty')
    expect(snapshot.analytics.healthStatus).toBe('empty')
  })
})
