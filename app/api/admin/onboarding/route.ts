import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { alertIf, sortAlerts, unreadableAlert, type AdminAlert } from '@/lib/admin/alerts'
import { percent, toIso } from '@/lib/admin/serialize'

export const dynamic = 'force-dynamic'

/**
 * Onboarding funnel.
 *
 * A new user is only *onboarded* once they have the things the product needs to
 * work for them: a birth profile, a natal chart, an ESMS balance to spend, and
 * at least one consultation. Each of those lives in a different table, so a
 * signup that stalls at step two is invisible from any single one of them.
 *
 * The funnel is measured as a set of independent counts rather than a chain of
 * filters: a user can acquire a token balance without a profile, and reporting
 * that as "0% reached step 3" would hide it. Step-over-step conversion is
 * derived for display, but the underlying numbers are absolute.
 */

/** Signup cohorts the funnel is reported over. */
const WINDOWS = [
  { id: '24h', label: 'Last 24 hours', hours: 24 },
  { id: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { id: '30d', label: 'Last 30 days', hours: 24 * 30 },
  { id: 'all', label: 'All time', hours: null },
] as const

export async function GET(_req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const alerts: AdminAlert[] = []
  const now = new Date()

  let funnels: Array<{
    window: string
    label: string
    steps: Array<{ id: string; label: string; count: number; pctOfSignups: number }>
  }> = []
  let funnelError: string | null = null

  try {
    funnels = await Promise.all(
      WINDOWS.map(async window => {
        const since = window.hours ? new Date(now.getTime() - window.hours * 60 * 60 * 1000) : null
        const userWhere = since ? { createdAt: { gte: since } } : {}

        const signups = await prisma.users.count({ where: userWhere })

        // The cohort's ids drive every downstream count, so a user who signed
        // up outside the window can never inflate a later step.
        const cohort = await prisma.users.findMany({
          where: userWhere,
          select: { id: true, email: true },
        })
        const cohortIds = cohort.map(u => u.id)

        if (cohortIds.length === 0) {
          return {
            window: window.id,
            label: window.label,
            steps: [
              { id: 'signup', label: 'Signed up', count: 0, pctOfSignups: 0 },
              { id: 'profile', label: 'Birth profile saved', count: 0, pctOfSignups: 0 },
              { id: 'chart', label: 'Natal chart stored', count: 0, pctOfSignups: 0 },
              { id: 'tokens', label: 'ESMS balance funded', count: 0, pctOfSignups: 0 },
              { id: 'chat', label: 'First consultation', count: 0, pctOfSignups: 0 },
              { id: 'wallet', label: 'Wallet linked', count: 0, pctOfSignups: 0 },
            ],
          }
        }

        const [profiles, charts, balances, chatted, wallets] = await Promise.all([
          prisma.user_profiles.count({ where: { userId: { in: cohortIds } } }),
          prisma.user_natal_charts
            .findMany({
              where: { userId: { in: cohortIds } },
              select: { userId: true },
              distinct: ['userId'],
            })
            .then(rows => rows.length),
          prisma.tokenBalance.count({ where: { userId: { in: cohortIds } } }),
          // AgentConversation has no userId — sessions key it — so first-chat is
          // measured from the interaction table that does carry a user.
          prisma.consciousness_interactions
            .findMany({
              where: { userId: { in: cohortIds } },
              select: { userId: true },
              distinct: ['userId'],
            })
            .then(rows => rows.length),
          prisma.users.count({
            where: { id: { in: cohortIds }, walletAddress: { not: null } },
          }),
        ])

        const steps = [
          { id: 'signup', label: 'Signed up', count: signups },
          { id: 'profile', label: 'Birth profile saved', count: profiles },
          { id: 'chart', label: 'Natal chart stored', count: charts },
          { id: 'tokens', label: 'ESMS balance funded', count: balances },
          { id: 'chat', label: 'First consultation', count: chatted },
          { id: 'wallet', label: 'Wallet linked', count: wallets },
        ]

        return {
          window: window.id,
          label: window.label,
          steps: steps.map(step => ({
            ...step,
            pctOfSignups: percent(step.count, signups),
          })),
        }
      })
    )
  } catch (error) {
    alerts.push(unreadableAlert('onboarding', 'Funnel', error))
    funnelError = error instanceof Error ? error.message : String(error)
  }

  // ── Recent signups, with their actual completion state ───────────────────
  let recent: Array<{
    id: string
    email: string
    name: string | null
    provider: string | null
    verified: boolean
    createdAt: string | null
    lastLogin: string | null
    hasProfile: boolean
    hasChart: boolean
    hasBalance: boolean
    hasWallet: boolean
    hasChatted: boolean
    completedSteps: number
  }> = []
  let recentError: string | null = null

  try {
    const users = await prisma.users.findMany({
      take: 40,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        provider: true,
        verified: true,
        createdAt: true,
        lastLogin: true,
        walletAddress: true,
      },
    })
    const ids = users.map(u => u.id)

    // Four set-membership reads instead of 4×N per-user queries.
    const [profileRows, chartRows, balanceRows, interactionRows] = await Promise.all([
      prisma.user_profiles.findMany({ where: { userId: { in: ids } }, select: { userId: true } }),
      prisma.user_natal_charts.findMany({
        where: { userId: { in: ids } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.tokenBalance.findMany({ where: { userId: { in: ids } }, select: { userId: true } }),
      prisma.consciousness_interactions.findMany({
        where: { userId: { in: ids } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ])

    const withProfile = new Set(profileRows.map(r => r.userId))
    const withChart = new Set(chartRows.map(r => r.userId))
    const withBalance = new Set(balanceRows.map(r => r.userId))
    const withChat = new Set(interactionRows.map(r => r.userId))

    recent = users.map(user => {
      const hasProfile = withProfile.has(user.id)
      const hasChart = withChart.has(user.id)
      const hasBalance = withBalance.has(user.id)
      const hasWallet = Boolean(user.walletAddress)
      const hasChatted = withChat.has(user.id)
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider,
        verified: user.verified,
        createdAt: toIso(user.createdAt),
        lastLogin: toIso(user.lastLogin),
        hasProfile,
        hasChart,
        hasBalance,
        hasWallet,
        hasChatted,
        completedSteps: [hasProfile, hasChart, hasBalance, hasChatted, hasWallet].filter(Boolean)
          .length,
      }
    })
  } catch (error) {
    alerts.push(unreadableAlert('onboarding', 'Recent signups', error))
    recentError = error instanceof Error ? error.message : String(error)
  }

  // ── Monica guide progress ────────────────────────────────────────────────
  let monica: {
    withSettings: number
    withProgress: number
    avgLevel: number | null
    avgInteractions: number | null
    activeStreaks: number
  } | null = null

  try {
    const [withSettings, withProgress, aggregates, activeStreaks] = await Promise.all([
      prisma.monica_user_settings.count(),
      prisma.monica_user_progress.count(),
      prisma.monica_user_progress.aggregate({
        _avg: { level: true, totalInteractions: true },
      }),
      prisma.monica_user_progress.count({ where: { currentStreak: { gte: 2 } } }),
    ])

    monica = {
      withSettings,
      withProgress,
      avgLevel: aggregates._avg.level ? Math.round(aggregates._avg.level * 10) / 10 : null,
      avgInteractions: aggregates._avg.totalInteractions
        ? Math.round(aggregates._avg.totalInteractions * 10) / 10
        : null,
      activeStreaks,
    }
  } catch (error) {
    alerts.push(unreadableAlert('onboarding', 'Monica progress', error))
  }

  // ── Rules ────────────────────────────────────────────────────────────────
  const weekly = funnels.find(f => f.window === '7d')
  if (weekly) {
    const signups = weekly.steps[0].count
    const profiled = weekly.steps[1].count
    const funded = weekly.steps[3].count
    const chatted = weekly.steps[4].count

    alertIf(alerts, signups > 0 && percent(profiled, signups) < 50, {
      id: 'onboarding:profile-dropoff',
      severity: 'warning',
      source: 'onboarding',
      title: 'Most new users never save a birth profile',
      detail: `${profiled} of ${signups} signups in the last 7 days completed the birth profile step (${percent(profiled, signups)}%). Without it there is no natal chart, so personalisation, transits and Sacred 7 derivation all stay inert for them.`,
      href: 'tab:onboarding',
      remediation: 'Check the onboarding wizard and the geocoding step for errors.',
    })

    alertIf(alerts, signups > 0 && funded === 0, {
      id: 'onboarding:no-funding',
      severity: 'critical',
      source: 'onboarding',
      title: 'No new user received an ESMS balance',
      detail: `${signups} signups in the last 7 days and zero token_balances rows among them. A user with no balance cannot hold a single consultation.`,
      href: 'tab:onboarding',
      remediation:
        'Verify the signup path provisions a token balance and the daily claim reaches new accounts.',
    })

    alertIf(alerts, signups > 0 && chatted === 0, {
      id: 'onboarding:no-activation',
      severity: 'warning',
      source: 'onboarding',
      title: 'No new user reached a first consultation',
      detail: `${signups} signups in the last 7 days, none of whom have an interaction recorded.`,
      href: 'tab:onboarding',
    })
  }

  const stalled = recent.filter(user => user.completedSteps === 0)
  alertIf(alerts, recent.length > 0 && stalled.length / recent.length > 0.5, {
    id: 'onboarding:stalled-signups',
    severity: 'warning',
    source: 'onboarding',
    title: `${stalled.length} of the ${recent.length} most recent signups completed no step at all`,
    detail:
      'These accounts exist but have no profile, no chart, no balance, no wallet and no interaction — they registered and stopped.',
    href: 'tab:onboarding',
  })

  return NextResponse.json({
    success: true,
    generatedAt: now.toISOString(),
    funnels,
    funnelError,
    recent,
    recentError,
    monica,
    alerts: sortAlerts(alerts),
  })
}
