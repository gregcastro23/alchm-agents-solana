import type { RAGAnalytics, RAGQueryLog } from '@/lib/rag/rag-analytics'

type RagSnapshotQuery = {
  id: string
  timestamp: string
  agentId: string
  agentName: string
  queryLength: number
  ragUsed: boolean
  sourcesRetrieved: number
  retrievalTime: number
  generationTime: number | null
  totalTime: number
  success: boolean
  avgRelevance: number
}

type RagSnapshotPayload = {
  contract: {
    version: 1
    generatedAt: string
    source: 'postgres'
    status: 'ok' | 'empty' | 'degraded'
    healthStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'empty'
    content: 'redacted'
  }
  queries: RagSnapshotQuery[]
  stats: {
    totalQueries: number
    ragUsageRate: number
    successRate: number
    avgRetrievalTime: number
    avgGenerationTime: number
    avgTotalTime: number
    avgRelevance: number
    totalSources: number
  }
}

export type RagAdminSnapshot = {
  generatedAt: string
  analytics: RAGAnalytics
  recentLogs: RAGQueryLog[]
}

function sampleTopAgents(logs: RAGQueryLog[]): RAGAnalytics['topAgents'] {
  const counts = new Map<string, { agentName: string; queryCount: number }>()
  for (const log of logs) {
    const current = counts.get(log.agentId)
    counts.set(log.agentId, {
      agentName: log.agentName,
      queryCount: (current?.queryCount ?? 0) + 1,
    })
  }

  return Array.from(counts.entries())
    .map(([agentId, value]) => ({ agentId, ...value }))
    .sort((a, b) => b.queryCount - a.queryCount)
    .slice(0, 10)
}

function sampleTrends(logs: RAGQueryLog[]) {
  const days = new Map<string, RAGQueryLog[]>()
  for (const log of logs) {
    const date = log.timestamp.toISOString().slice(0, 10)
    days.set(date, [...(days.get(date) ?? []), log])
  }

  const entries = Array.from(days.entries()).sort(([left], [right]) => left.localeCompare(right))
  return {
    performanceTrend: entries.map(([date, dayLogs]) => ({
      date,
      avgTime: dayLogs.reduce((sum, log) => sum + log.totalTime, 0) / dayLogs.length,
      queryCount: dayLogs.length,
    })),
    relevanceTrend: entries.map(([date, dayLogs]) => ({
      date,
      avgRelevance: dayLogs.reduce((sum, log) => sum + log.averageRelevance, 0) / dayLogs.length,
    })),
  }
}

function isPayload(value: unknown): value is RagSnapshotPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<RagSnapshotPayload>
  return (
    payload.contract?.version === 1 &&
    ['ok', 'empty', 'degraded'].includes(payload.contract.status) &&
    typeof payload.contract.healthStatus === 'string' &&
    payload.contract.content === 'redacted' &&
    Array.isArray(payload.queries) &&
    Boolean(payload.stats)
  )
}

export function parseRagAdminSnapshot(value: unknown): RagAdminSnapshot {
  if (!isPayload(value)) throw new Error('RAG analytics returned an unsupported contract')

  const recentLogs: RAGQueryLog[] = value.queries.map(query => ({
    id: query.id,
    timestamp: new Date(query.timestamp),
    agentId: query.agentId,
    agentName: query.agentName,
    query: '[redacted]',
    queryLength: query.queryLength,
    ragUsed: query.ragUsed,
    sourcesRetrieved: query.sourcesRetrieved,
    retrievalTime: query.retrievalTime,
    generationTime: query.generationTime ?? undefined,
    totalTime: query.totalTime,
    success: query.success,
    relevanceScores: [],
    averageRelevance: query.avgRelevance,
    sessionId: '[redacted]',
  }))
  const trends = sampleTrends(recentLogs)
  const { stats } = value

  return {
    generatedAt: value.contract.generatedAt,
    recentLogs,
    analytics: {
      dataStatus: value.contract.status,
      healthStatus: value.contract.healthStatus,
      totalQueries: stats.totalQueries,
      ragEnabledQueries: Math.round(stats.totalQueries * stats.ragUsageRate),
      ragUsageRate: stats.ragUsageRate,
      totalSources: stats.totalSources,
      avgSourcesPerQuery: stats.totalQueries > 0 ? stats.totalSources / stats.totalQueries : 0,
      avgRetrievalTime: stats.avgRetrievalTime,
      avgGenerationTime: stats.avgGenerationTime,
      avgTotalTime: stats.avgTotalTime,
      avgRelevanceScore: stats.avgRelevance,
      successRate: stats.successRate,
      errorRate: 1 - stats.successRate,
      // Cache provenance is not part of the database snapshot. The admin page
      // omits cache charts until a server collector provides these values.
      cacheHitRate: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgCacheLatency: 0,
      avgCachedResponseTime: 0,
      avgUncachedResponseTime: 0,
      topAgents: sampleTopAgents(recentLogs),
      topDocuments: [],
      ...trends,
    },
  }
}

export async function fetchRagAdminSnapshot(): Promise<RagAdminSnapshot> {
  const response = await fetch('/api/rag/analytics?limit=100', { cache: 'no-store' })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || `RAG analytics returned ${response.status}`)
  }
  return parseRagAdminSnapshot(payload)
}
