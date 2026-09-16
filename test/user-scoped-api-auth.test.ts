/**
 * User-scoped API authorization.
 *
 * These routes take a `userId` from the request. Identity must come from the
 * session: an unauthenticated caller gets 401, a signed-in user asking for
 * somebody else's id gets 403 and the data layer is never reached, and a
 * service credential may name a user explicitly.
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'

import { GET as consciousnessCurrentGET } from '@/app/api/consciousness/current/route'
import { GET as consciousnessTimelineGET } from '@/app/api/consciousness/timeline/route'
import { GET as surveyGET } from '@/app/api/consciousness-survey/route'
import { GET as stoneSessionGET } from '@/app/api/philosophers-stone/session/route'
import { GET as notificationsGET } from '@/app/api/transit-notifications/route'
import { GET as jobsGET } from '@/app/api/transit-monitoring-jobs/route'
import { GET as personalizedTransitsGET } from '@/app/api/personalized-transits/route'
import { GET as personalizedPlanetaryGET } from '@/app/api/personalized-planetary-transits/route'

import { unifiedTracker } from '@/lib/consciousness/unified-tracker'
import { getUpcomingNotifications } from '@/lib/services/transit-notification-service'
import { getJobHistory } from '@/lib/services/job-management-service'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [] }) }))

vi.mock('@/lib/db', () => ({
  prisma: {
    consciousnessProfile: { findFirst: vi.fn() },
    userSession: { findFirst: vi.fn(), create: vi.fn() },
    user_natal_charts: { findFirst: vi.fn() },
    transitNotification: { findFirst: vi.fn() },
    consciousness_interactions: { groupBy: vi.fn() },
  },
}))

vi.mock('@/lib/consciousness/unified-tracker', () => ({
  unifiedTracker: {
    getCurrentState: vi.fn(),
    getEvolutionMetrics: vi.fn(),
    getTrend: vi.fn(),
  },
}))

vi.mock('@/lib/services/transit-notification-service', () => ({
  getUpcomingNotifications: vi.fn(),
  createTransitNotification: vi.fn(),
  markNotificationAsRead: vi.fn(),
  dismissNotification: vi.fn(),
  getUserNotificationPreferences: vi.fn(),
  updateUserNotificationPreferences: vi.fn(),
  getNotificationStatistics: vi.fn(),
}))

vi.mock('@/lib/services/job-management-service', () => ({
  getJobHistory: vi.fn(),
  getJobStatistics: vi.fn(),
  cancelJob: vi.fn(),
  getActiveJobs: vi.fn(),
}))

vi.mock('@/lib/jobs/transit-monitoring-job', () => ({
  runTransitMonitoringJob: vi.fn(),
  TransitMonitoringScheduler: class {
    isActive() {
      return false
    }
  },
}))

vi.mock('@/lib/galileo-logger', () => ({
  default: {
    startSession: vi.fn(),
    startTrace: vi.fn(),
    startSpan: vi.fn(),
    endSpan: vi.fn(),
    endTrace: vi.fn(),
    endSession: vi.fn(),
  },
  logQuantitiesToGalileo: vi.fn(),
}))

const getServerSessionMock = vi.mocked(getServerSession)
const prismaMock = vi.mocked(prisma, { deep: true })
const trackerMock = vi.mocked(unifiedTracker, { deep: true })

const OWNER = 'user-owner'
const VICTIM = 'user-victim'
const INTERNAL_SECRET = 'test-internal-secret'
process.env.INTERNAL_API_SECRET = INTERNAL_SECRET

function req(path: string, init?: RequestInit) {
  return new NextRequest(`http://localhost${path}`, init as never)
}

function signIn(id: string) {
  getServerSessionMock.mockResolvedValue({
    user: { id, email: `${id}@example.com`, name: id, role: 'user' },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as never)
}

/**
 * Every data-layer mock these routes can reach. The 403 case asserts that none
 * of them ran — a route that 403s *after* querying has still leaked the read.
 */
function allDataMocks() {
  return [
    prismaMock.consciousnessProfile.findFirst,
    prismaMock.userSession.findFirst,
    prismaMock.user_natal_charts.findFirst,
    prismaMock.transitNotification.findFirst,
    trackerMock.getCurrentState,
    trackerMock.getEvolutionMetrics,
    trackerMock.getTrend,
    vi.mocked(getUpcomingNotifications),
    vi.mocked(getJobHistory),
  ]
}

/** GET routes that scope their read to a caller-supplied `userId`. */
const scopedGetRoutes: ReadonlyArray<
  readonly [string, (r: NextRequest) => Promise<Response>, (userId: string) => string]
> = [
  [
    'consciousness/current',
    consciousnessCurrentGET as never,
    u => `/api/consciousness/current?userId=${u}&agentId=agent-1`,
  ],
  [
    'consciousness/timeline',
    consciousnessTimelineGET as never,
    u => `/api/consciousness/timeline?userId=${u}&agentId=agent-1`,
  ],
  ['consciousness-survey', surveyGET as never, u => `/api/consciousness-survey?userId=${u}`],
  [
    'philosophers-stone/session',
    stoneSessionGET as never,
    u => `/api/philosophers-stone/session?userId=${u}`,
  ],
  [
    'transit-notifications',
    notificationsGET as never,
    u => `/api/transit-notifications?userId=${u}`,
  ],
  ['transit-monitoring-jobs', jobsGET as never, u => `/api/transit-monitoring-jobs?userId=${u}`],
  [
    'personalized-transits',
    personalizedTransitsGET as never,
    u => `/api/personalized-transits?userId=${u}`,
  ],
  [
    'personalized-planetary-transits',
    personalizedPlanetaryGET as never,
    u => `/api/personalized-planetary-transits?userId=${u}`,
  ],
]

describe('user-scoped API authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trackerMock.getCurrentState.mockResolvedValue(null as never)
    trackerMock.getEvolutionMetrics.mockResolvedValue({} as never)
    trackerMock.getTrend.mockResolvedValue([] as never)
    prismaMock.consciousnessProfile.findFirst.mockResolvedValue({ id: 'p1' } as never)
    prismaMock.userSession.findFirst.mockResolvedValue(null as never)
    prismaMock.user_natal_charts.findFirst.mockResolvedValue(null as never)
    vi.mocked(getUpcomingNotifications).mockResolvedValue([] as never)
    vi.mocked(getJobHistory).mockResolvedValue([] as never)
  })

  it.each(scopedGetRoutes)('rejects unauthenticated GET %s', async (_name, handler, url) => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await handler(req(url(VICTIM)))

    expect(response.status).toBe(401)
    for (const mock of allDataMocks()) expect(mock).not.toHaveBeenCalled()
  })

  it.each(scopedGetRoutes)(
    'rejects GET %s for a userId the session does not own',
    async (_name, handler, url) => {
      signIn(OWNER)

      const response = await handler(req(url(VICTIM)))

      expect(response.status).toBe(403)
      for (const mock of allDataMocks()) expect(mock).not.toHaveBeenCalled()
    }
  )

  // "Allowed" means the guard let the request reach the handler. What the
  // handler then returns (200, or 404 for a user with no data) is not this
  // suite's business — only that it is neither 401 nor 403.
  it.each(scopedGetRoutes)('allows GET %s for the session owner', async (_name, handler, url) => {
    signIn(OWNER)

    const response = await handler(req(url(OWNER)))

    expect(response.status).not.toBe(401)
    expect(response.status).not.toBe(403)
  })

  // A server-to-server caller carries no session, so it must be able to name the
  // user it is acting for. This is the one path where a supplied userId is honoured.
  it.each(scopedGetRoutes)(
    'allows GET %s for a service credential naming a user',
    async (_name, handler, url) => {
      getServerSessionMock.mockResolvedValue(null)

      const response = await handler(
        req(url(VICTIM), { headers: { 'x-internal-secret': INTERNAL_SECRET } })
      )

      expect(response.status).not.toBe(401)
      expect(response.status).not.toBe(403)
    }
  )

  it('rejects a service credential that names no user', async () => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await consciousnessCurrentGET(
      req('/api/consciousness/current?agentId=agent-1', {
        headers: { 'x-internal-secret': INTERNAL_SECRET },
      }) as never
    )

    expect(response.status).toBe(400)
    for (const mock of allDataMocks()) expect(mock).not.toHaveBeenCalled()
  })

  it('rejects a wrong internal secret rather than treating it as a service call', async () => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await consciousnessCurrentGET(
      req(`/api/consciousness/current?userId=${VICTIM}&agentId=agent-1`, {
        headers: { 'x-internal-secret': 'not-the-secret' },
      }) as never
    )

    expect(response.status).toBe(401)
    for (const mock of allDataMocks()) expect(mock).not.toHaveBeenCalled()
  })
})
