import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { alertIf, sortAlerts, unreadableAlert, type AdminAlert } from '@/lib/admin/alerts'
import { minutesSince, percent, round, toIso } from '@/lib/admin/serialize'
import { classifyAgent, dignityOf, PLANETS } from '@/lib/agents/agent-type-model'
import {
  APPROXIMATION_SOURCE,
  CHART_BODIES,
  ELEMENT_SET_VALID_FROM_YEAR,
  ELEMENT_SET_VALID_TO_YEAR,
  calculatePlanetPositionOrNull,
  dateToJulianDay,
} from '@/lib/enhanced-astronomical-calculator'
import {
  EphemerisUnavailableError,
  SWISS_EPHEMERIS_SOURCE,
  getAllPlanetaryPositions,
} from '@/lib/swiss-ephemeris-service'

export const dynamic = 'force-dynamic'

/**
 * Planetary-agents integration pulse.
 *
 * The planetary layer is three things that fail independently, so this route
 * reports them separately rather than as one "planetary: ok":
 *
 *  1. **Ephemeris provenance** — is the live sky coming from the Swiss backend
 *     or from the local Keplerian approximation? A chart stamped
 *     `swiss-ephemeris` that was actually approximated is the exact defect
 *     CLAUDE.md documents, so the answer here is measured (by asking the
 *     backend) rather than assumed from an env var.
 *  2. **Sprite roster** — the ~3,600 degree sprites and lunar sprites that hold
 *     ESMS reservoirs, classified through the canonical `classifyAgent`.
 *  3. **Automation** — the crons that drive attunement, yield and the feed.
 *     There is no cron run-log table, so liveness is inferred from the most
 *     recent side effect each job leaves behind, and the inference is labelled
 *     as such.
 */

/** Each Vercel cron, and the DB side effect that proves it ran. */
const CRON_JOBS = [
  {
    path: '/api/cron/agents/tick',
    schedule: '0 * * * *',
    label: 'Agent activation tick',
    expectedIntervalMinutes: 60,
    evidence: 'agent_action_events.evaluatedAt',
  },
  {
    path: '/api/cron/agents/claim-yield',
    schedule: '0 * * * *',
    label: 'Agent daily yield claim',
    expectedIntervalMinutes: 60,
    evidence: 'token_balances.lastDailyClaimAgentsAt',
  },
  {
    path: '/api/cron/agents/refresh-reservoirs',
    schedule: '0 0 * * *',
    label: 'Sprite reservoir refresh',
    expectedIntervalMinutes: 60 * 24,
    evidence: 'token_balances.updatedAt (sprite wallets)',
  },
  {
    path: '/api/cron/scrabble/tick',
    schedule: '0 * * * *',
    label: 'Scrabble league tick',
    expectedIntervalMinutes: 60,
    evidence: 'AgentScrabbleMatch.createdAt',
  },
  {
    path: '/api/cron/push-feed',
    schedule: '*/30 * * * *',
    label: 'Feed push',
    expectedIntervalMinutes: 30,
    evidence: 'notifications.createdAt',
  },
] as const

type SectionResult<T> = { data: T | null; error: string | null }

async function section<T>(
  name: string,
  alerts: AdminAlert[],
  read: () => Promise<T>
): Promise<SectionResult<T>> {
  try {
    return { data: await read(), error: null }
  } catch (error) {
    alerts.push(unreadableAlert('planetary', name, error))
    return { data: null, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Latest timestamp from a `_max` aggregate, or null. */
async function latest(read: () => Promise<Date | null | undefined>): Promise<string | null> {
  try {
    return toIso(await read())
  } catch {
    return null
  }
}

export async function GET(_req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const alerts: AdminAlert[] = []
  const now = new Date()
  const nowMs = now.getTime()
  const since24h = new Date(nowMs - 24 * 60 * 60 * 1000)
  const since7d = new Date(nowMs - 7 * 24 * 60 * 60 * 1000)

  // ── 1. Ephemeris provenance, measured ────────────────────────────────────
  const ephemerisStart = Date.now()
  let ephemeris: {
    source: string
    reachable: boolean
    backendUrl: string
    latencyMs: number | null
    bodies: Array<{
      planet: string
      sign: string
      degree: number
      longitude: number
      retrograde: boolean
    }>
    /** Bodies the approximation refused to return because they failed its bounds. */
    withheld: string[]
    error: string | null
    approximationValidRange: string
  }

  try {
    const positions = await getAllPlanetaryPositions(now)
    ephemeris = {
      source: SWISS_EPHEMERIS_SOURCE,
      reachable: true,
      backendUrl: process.env.NEXT_PUBLIC_EPHEMERIS_BACKEND_URL || 'http://localhost:3001',
      latencyMs: Date.now() - ephemerisStart,
      bodies: Object.values(positions).map(pos => ({
        planet: pos.planet,
        sign: pos.sign,
        degree: round(pos.degree, 2),
        longitude: round(pos.longitude, 3),
        retrograde: pos.retrograde,
      })),
      withheld: [],
      error: null,
      approximationValidRange: `${ELEMENT_SET_VALID_FROM_YEAR}–${ELEMENT_SET_VALID_TO_YEAR}`,
    }
  } catch (error) {
    // The Swiss backend is unreachable. Report what the *approximation* would
    // serve, explicitly stamped as the approximation — never as Swiss.
    const bodies: Array<{
      planet: string
      sign: string
      degree: number
      longitude: number
      retrograde: boolean
    }> = []
    const withheld: string[] = []
    const jd = dateToJulianDay(now)
    for (const name of CHART_BODIES) {
      // Returns null — rather than a wrong number — when the body violates the
      // approximation's own plausibility bounds.
      const pos = calculatePlanetPositionOrNull(name, jd)
      if (!pos) {
        withheld.push(name)
        continue
      }
      bodies.push({
        planet: pos.planet,
        sign: pos.sign,
        degree: round(pos.signDegree, 2),
        longitude: round(pos.longitude, 3),
        retrograde: pos.retrograde,
      })
    }

    ephemeris = {
      source: APPROXIMATION_SOURCE,
      reachable: false,
      backendUrl: process.env.NEXT_PUBLIC_EPHEMERIS_BACKEND_URL || 'http://localhost:3001',
      latencyMs: Date.now() - ephemerisStart,
      bodies,
      withheld,
      error:
        error instanceof EphemerisUnavailableError || error instanceof Error
          ? error.message
          : String(error),
      approximationValidRange: `${ELEMENT_SET_VALID_FROM_YEAR}–${ELEMENT_SET_VALID_TO_YEAR}`,
    }
  }

  alertIf(alerts, !ephemeris.reachable, {
    id: 'planetary:ephemeris-degraded',
    severity: 'critical',
    source: 'planetary',
    title: 'Swiss ephemeris backend unreachable — serving the local approximation',
    detail: `${ephemeris.backendUrl} did not answer (${ephemeris.error}). Every chart computed right now carries source="${APPROXIMATION_SOURCE}" and is a Keplerian approximation valid only for ${ephemeris.approximationValidRange}.`,
    href: 'tab:planetary',
    remediation:
      'Bring the Bun ephemeris service up, or set NEXT_PUBLIC_EPHEMERIS_BACKEND_URL to a reachable instance.',
  })

  alertIf(alerts, ephemeris.withheld.length > 0, {
    id: 'planetary:bodies-withheld',
    severity: 'warning',
    source: 'planetary',
    title: `${ephemeris.withheld.length} body/bodies withheld by plausibility bounds`,
    detail: `The approximation refused to return ${ephemeris.withheld.join(', ')} rather than emit a position that violates its physical bounds.`,
    href: 'tab:planetary',
  })

  // ── 2. Backend reachability, both services ───────────────────────────────
  const backends = await Promise.all(
    [
      {
        name: 'PA agents backend (FastAPI)',
        url: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.agents.alchm.kitchen',
        path: '/health',
        env: 'NEXT_PUBLIC_BACKEND_URL',
      },
      {
        name: 'WTEN culinary backend',
        url:
          process.env.NEXT_PUBLIC_WTEN_BACKEND_URL ||
          'https://whattoeatnext-production.up.railway.app',
        path: '/health',
        env: 'NEXT_PUBLIC_WTEN_BACKEND_URL',
      },
      {
        name: 'Swiss ephemeris backend (Bun)',
        url: process.env.NEXT_PUBLIC_EPHEMERIS_BACKEND_URL || 'http://localhost:3001',
        path: '/health',
        env: 'NEXT_PUBLIC_EPHEMERIS_BACKEND_URL',
      },
    ].map(async target => {
      const started = Date.now()
      try {
        const res = await fetch(`${target.url}${target.path}`, {
          signal: AbortSignal.timeout(4000),
          cache: 'no-store',
        })
        return {
          ...target,
          ok: res.ok,
          status: res.status,
          latencyMs: Date.now() - started,
          error: res.ok ? null : `HTTP ${res.status}`,
          configured: Boolean(process.env[target.env]),
        }
      } catch (error) {
        return {
          ...target,
          ok: false,
          status: null as number | null,
          latencyMs: Date.now() - started,
          error: error instanceof Error ? error.message : String(error),
          configured: Boolean(process.env[target.env]),
        }
      }
    })
  )

  for (const backend of backends) {
    alertIf(alerts, !backend.ok, {
      id: `planetary:backend-down:${backend.env}`,
      severity: backend.env === 'NEXT_PUBLIC_BACKEND_URL' ? 'critical' : 'warning',
      source: 'planetary',
      title: `${backend.name} not responding`,
      detail: `${backend.url}${backend.path} → ${backend.error} (${backend.latencyMs}ms). ${backend.configured ? 'Configured explicitly.' : 'Using the code default — no env var set.'}`,
      href: 'tab:planetary',
    })
  }

  // ── 3. Sprite roster, classified canonically ─────────────────────────────
  const roster = await section('Agent roster', alerts, async () => {
    const rows = await prisma.historical_agents.findMany({
      select: { agentId: true, conversations: true },
    })

    let wallets = 0
    let degreeSprites = 0
    let lunarSprites = 0
    const perPlanet = new Map<string, number>()
    const perDignity = new Map<string, number>()

    for (const row of rows) {
      const classification = classifyAgent(row.agentId)
      if (classification.economyRole === 'wallet') wallets += 1
      else if (classification.lunar) lunarSprites += 1
      else if (classification.isSprite) {
        degreeSprites += 1
        if (classification.planet) {
          perPlanet.set(classification.planet, (perPlanet.get(classification.planet) ?? 0) + 1)
        }
        if (classification.planet && classification.sign) {
          const tier = dignityOf(classification.planet, classification.sign)
          perDignity.set(tier, (perDignity.get(tier) ?? 0) + 1)
        }
      }
    }

    return {
      total: rows.length,
      wallets,
      degreeSprites,
      lunarSprites,
      /** A full degree grid is 11 planets × 12 signs × 30 degrees. */
      degreeGridExpected: PLANETS.length * 12 * 30,
      perPlanet: [...perPlanet.entries()]
        .map(([planet, count]) => ({ planet, count }))
        .sort((a, b) => b.count - a.count),
      perDignity: [...perDignity.entries()]
        .map(([tier, count]) => ({ tier, count }))
        .sort((a, b) => b.count - a.count),
    }
  })

  // ── 4. Planetary agent conversation volume ───────────────────────────────
  const conversations = await section('Planetary conversations', alerts, async () => {
    const [byAgent24h, total24h, total7d] = await Promise.all([
      prisma.agentConversation.groupBy({
        by: ['agentId'],
        where: { createdAt: { gte: since7d } },
        _count: { _all: true },
        _avg: { responseTime: true },
      }),
      prisma.agentConversation.count({ where: { createdAt: { gte: since24h } } }),
      prisma.agentConversation.count({ where: { createdAt: { gte: since7d } } }),
    ])

    let spriteConversations = 0
    let walletConversations = 0
    const topSprites: Array<{ agentId: string; count: number; avgLatencyMs: number | null }> = []

    for (const row of byAgent24h) {
      const classification = classifyAgent(row.agentId)
      if (classification.isSprite) {
        spriteConversations += row._count._all
        topSprites.push({
          agentId: row.agentId,
          count: row._count._all,
          avgLatencyMs: row._avg.responseTime ? Math.round(row._avg.responseTime) : null,
        })
      } else {
        walletConversations += row._count._all
      }
    }

    topSprites.sort((a, b) => b.count - a.count)

    return {
      total24h,
      total7d,
      spriteConversations7d: spriteConversations,
      walletConversations7d: walletConversations,
      spriteSharePct: percent(spriteConversations, spriteConversations + walletConversations),
      topSprites: topSprites.slice(0, 10),
    }
  })

  // ── 5. Transit automation ────────────────────────────────────────────────
  const transits = await section('Transit monitoring', alerts, async () => {
    const [byStatus, failed, overdue, recent, notifications24h, catalogedTransitCount] =
      await Promise.all([
        prisma.transit_monitoring_jobs.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.transit_monitoring_jobs.count({ where: { status: 'failed' } }),
        prisma.transit_monitoring_jobs.count({
          where: { status: 'pending', scheduledFor: { lt: new Date(nowMs - 60 * 60 * 1000) } },
        }),
        prisma.transit_monitoring_jobs.findMany({
          take: 12,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            jobType: true,
            status: true,
            scheduledFor: true,
            completedAt: true,
            executionTime: true,
            lastError: true,
            retryCount: true,
            chartsProcessed: true,
            transitsFound: true,
            notificationsCreated: true,
          },
        }),
        prisma.transit_notifications.count({ where: { createdAt: { gte: since24h } } }),
        prisma.planetaryTransit.count(),
      ])

    const statusCounts: Record<string, number> = {}
    for (const row of byStatus) statusCounts[row.status] = row._count._all

    return {
      statusCounts,
      failed,
      overdue,
      notifications24h,
      catalogedTransits: catalogedTransitCount,
      totalJobs: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      recent: recent.map(job => ({
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        scheduledFor: toIso(job.scheduledFor),
        completedAt: toIso(job.completedAt),
        executionTime: job.executionTime,
        lastError: job.lastError,
        retryCount: job.retryCount,
        chartsProcessed: job.chartsProcessed,
        transitsFound: job.transitsFound,
        notificationsCreated: job.notificationsCreated,
      })),
    }
  })

  // ── 6. Feed activation engine ────────────────────────────────────────────
  const activation = await section('Agent action events', alerts, async () => {
    const [byStatus, recentFailures, evaluated24h, posted24h, scoreAgg] = await Promise.all([
      prisma.agent_action_events.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.agent_action_events.findMany({
        where: { status: 'failed' },
        take: 10,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          agentId: true,
          eventType: true,
          triggerType: true,
          triggerSummary: true,
          score: true,
          attempts: true,
          lastError: true,
          evaluatedAt: true,
        },
      }),
      prisma.agent_action_events.count({ where: { evaluatedAt: { gte: since24h } } }),
      prisma.agent_action_events.count({ where: { postedAt: { gte: since24h } } }),
      prisma.agent_action_events.aggregate({
        where: { evaluatedAt: { gte: since24h } },
        _avg: { score: true },
        _max: { score: true },
      }),
    ])

    const statusCounts: Record<string, number> = {}
    for (const row of byStatus) statusCounts[row.status] = row._count._all

    return {
      statusCounts,
      evaluated24h,
      posted24h,
      avgScore24h: scoreAgg._avg.score ? round(scoreAgg._avg.score, 3) : null,
      maxScore24h: scoreAgg._max.score ? round(scoreAgg._max.score, 3) : null,
      recentFailures: recentFailures.map(row => ({
        ...row,
        score: round(row.score, 3),
        evaluatedAt: toIso(row.evaluatedAt),
      })),
    }
  })

  // ── 7. Cron liveness, inferred from side effects ─────────────────────────
  const [tickAt, yieldAt, reservoirAt, scrabbleAt, feedAt] = await Promise.all([
    latest(
      async () =>
        (await prisma.agent_action_events.aggregate({ _max: { evaluatedAt: true } }))._max
          .evaluatedAt
    ),
    latest(
      async () =>
        (await prisma.tokenBalance.aggregate({ _max: { lastDailyClaimAgentsAt: true } }))._max
          .lastDailyClaimAgentsAt
    ),
    latest(
      async () =>
        (await prisma.tokenBalance.aggregate({ _max: { updatedAt: true } }))._max.updatedAt
    ),
    latest(
      async () =>
        (await prisma.agentScrabbleMatch.aggregate({ _max: { createdAt: true } }))._max.createdAt
    ),
    latest(
      async () =>
        (await prisma.notifications.aggregate({ _max: { createdAt: true } }))._max.createdAt
    ),
  ])

  const evidenceAt: Record<string, string | null> = {
    '/api/cron/agents/tick': tickAt,
    '/api/cron/agents/claim-yield': yieldAt,
    '/api/cron/agents/refresh-reservoirs': reservoirAt,
    '/api/cron/scrabble/tick': scrabbleAt,
    '/api/cron/push-feed': feedAt,
  }

  const crons = CRON_JOBS.map(job => {
    const lastEvidenceAt = evidenceAt[job.path] ?? null
    const ageMinutes = minutesSince(lastEvidenceAt, nowMs)
    // Two missed windows before calling it stalled — one skipped run is noise.
    const staleAfter = job.expectedIntervalMinutes * 2
    return {
      ...job,
      lastEvidenceAt,
      ageMinutes,
      stale: ageMinutes === null || ageMinutes > staleAfter,
      staleAfterMinutes: staleAfter,
    }
  })

  const cronSecretSet = Boolean(process.env.CRON_SECRET)
  alertIf(alerts, !cronSecretSet && process.env.NODE_ENV === 'production', {
    id: 'planetary:cron-secret-missing',
    severity: 'critical',
    source: 'planetary',
    title: 'CRON_SECRET is not set in production',
    detail:
      'Every cron route rejects unauthenticated calls in production, so with no secret configured all seven scheduled jobs fail closed.',
    href: 'tab:planetary',
    remediation: 'Set CRON_SECRET on the Vercel project and redeploy.',
  })

  for (const cron of crons.filter(c => c.stale)) {
    alerts.push({
      id: `planetary:cron-stale:${cron.path}`,
      severity: 'warning',
      source: 'planetary',
      title: `${cron.label} has left no trace recently`,
      detail: `Expected roughly every ${cron.expectedIntervalMinutes}m (${cron.schedule}); ${cron.evidence} last moved ${cron.ageMinutes === null ? 'never' : `${cron.ageMinutes}m ago`}. Liveness here is inferred from side effects, not a run log — an idle-but-healthy job looks the same as a stopped one.`,
      href: 'tab:planetary',
    })
  }

  if (transits.data) {
    alertIf(alerts, transits.data.failed > 0, {
      id: 'planetary:transit-jobs-failed',
      severity: 'warning',
      source: 'planetary',
      title: `${transits.data.failed} transit monitoring job(s) failed`,
      detail: 'Failed jobs produce no transit notifications for their target charts.',
      href: 'tab:planetary',
    })
    alertIf(alerts, transits.data.overdue > 0, {
      id: 'planetary:transit-jobs-overdue',
      severity: 'warning',
      source: 'planetary',
      title: `${transits.data.overdue} transit job(s) overdue by more than an hour`,
      detail:
        'Jobs still pending well past their scheduled time — the runner may not be draining the queue.',
      href: 'tab:planetary',
    })
    alertIf(alerts, transits.data.catalogedTransits === 0, {
      id: 'planetary:transit-catalog-empty',
      severity: 'info',
      source: 'planetary',
      title: 'Planetary transit catalog is empty',
      detail:
        'PlanetaryTransit has no rows, so historical transit lookups fall back to static data.',
      href: 'tab:planetary',
    })
  }

  if (activation.data) {
    const failed = activation.data.statusCounts.failed ?? 0
    const pending = activation.data.statusCounts.pending ?? 0
    alertIf(alerts, failed > 0, {
      id: 'planetary:activation-failures',
      severity: 'warning',
      source: 'planetary',
      title: `${failed} agent action event(s) failed`,
      detail:
        activation.data.recentFailures[0]?.lastError ??
        'Actions were evaluated and scored but never posted.',
      href: 'tab:planetary',
    })
    alertIf(alerts, pending > 50, {
      id: 'planetary:activation-backlog',
      severity: 'warning',
      source: 'planetary',
      title: `${pending} agent action events pending`,
      detail: 'The activation queue is filling faster than the tick drains it.',
      href: 'tab:planetary',
    })
  }

  if (roster.data) {
    alertIf(alerts, roster.data.degreeSprites === 0, {
      id: 'planetary:no-sprites',
      severity: 'warning',
      source: 'planetary',
      title: 'No planetary degree sprites in the roster',
      detail: `historical_agents holds ${roster.data.total} rows, all classified as wallets. The degree grid (${roster.data.degreeGridExpected} expected) has not been seeded into this database, so reservoirs and transit attunement have nothing to act on.`,
      href: 'tab:planetary',
      remediation: 'Run the degree/moon seeding scripts against this environment.',
    })
  }

  return NextResponse.json({
    success: true,
    generatedAt: now.toISOString(),
    ephemeris,
    backends,
    roster: roster.data,
    conversations: conversations.data,
    transits: transits.data,
    activation: activation.data,
    crons: { secretConfigured: cronSecretSet, jobs: crons },
    degraded: Object.entries({
      roster: roster.error,
      conversations: conversations.error,
      transits: transits.error,
      activation: activation.error,
    })
      .filter(([, error]) => error)
      .map(([name, error]) => ({ section: name, error: error as string })),
    alerts: sortAlerts(alerts),
  })
}
