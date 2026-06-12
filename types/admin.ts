export type AdminHealthValue = 'healthy' | 'error' | 'unknown'

export type AdminUserSummary = {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
}

export type AdminActivityItem = {
  type: string
  description: string
  timestamp: string
}

export type AdminTopAgent = {
  id: string
  name: string
  interactions: number
}

export type AdminRecentChat = {
  id: string
  agentId: string
  agentName: string
  sessionId: string
  userMessage: string
  agentResponse: string
  responseTime: number | null
  modelUsed: string | null
  createdAt: string
}

export type AdminJingDuel = {
  id: string
  sessionId: string
  userId: string | null
  source: string
  casterId: string
  casterName: string
  targetId: string
  targetName: string
  attackMoveId: string
  counterMoveId: string
  stance: string
  boostElement: string | null
  boostMagnitude: number
  cacheHit: boolean
  latencyMs: number | null
  modelUsed: string | null
  createdAt: string
  synastrySnapshot: unknown
  casterTransitSnapshot: unknown
  targetTransitSnapshot: unknown
  casterPrompt: string | null
  casterResponse: string | null
  targetPrompt: string | null
  targetResponse: string | null
}

export type AdminJingAggregates = {
  total: number
  last24h: number
  last7d: number
  stanceHistogram: Record<string, number>
  boostElementHistogram: Record<string, number>
  topPairs: {
    casterId: string
    targetId: string
    casterName: string
    targetName: string
    count: number
  }[]
  avgLatencyMs: number | null
}

export type AdminDashboardData = {
  users: {
    total: number
    newToday: number
    admins: number
    recent: AdminUserSummary[]
  }
  agents: {
    historical: number
    planetary: number
    created: number
    totalConversations: number
  }
  system: {
    database: 'healthy' | 'error'
    aiProviders: {
      openai: boolean
      anthropic: boolean
      google: boolean
      gateway: boolean
    }
    railwayBackend: AdminHealthValue
    vercelDeployment: {
      url: string
      lastDeploy: string | null
      commitSha?: string | null
    }
  }
  recentActivity: AdminActivityItem[]
  topAgents: AdminTopAgent[]
  recentChats: AdminRecentChat[]
  recentJingDuels: AdminJingDuel[]
  jingAggregates: AdminJingAggregates
}

export type AdminSystemStats = {
  overview: {
    totalUsers: number
    activeUsers: number
    totalInteractions: number
    recentInteractions: number
    totalAgentEvolutions: number
    recentEvolutions: number
    timeRange: string
  }
  performance: {
    systemHealth: unknown
    slowEndpoints: unknown[]
    systemMetrics: {
      memoryUsage: {
        heapUsed: number
        heapTotal: number
        external: number
        rss: number
      }
      uptime: number
      nodeVersion: string
      platform: string
      loadAverage: number[]
    }
  }
  users: {
    tierDistribution: Array<{ tier: string; count: number }>
    growthRate: string
  }
  agents: {
    popularAgents: Array<{ agentId: string; interactionCount: number }>
    evolutionLevels: Array<{ level: string; count: number }>
  }
  errors: {
    recentErrorLogs: Array<{
      id: string
      timestamp: string
      source: string
      message: string
    }>
    errorRate: number
  }
  timestamp: string
}
