import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { ADMIN_EMAILS, ADMIN_HANDLES } from '@/lib/admin-identity'
import { prisma } from '@/lib/db'
import { recentAdminActions } from '@/lib/admin/audit'
import { sortAlerts, type AdminAlert } from '@/lib/admin/alerts'
import { round, toAmount, toIso } from '@/lib/admin/serialize'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

/**
 * User administration directory.
 *
 * The previous users tab rendered the 20 most recent rows and nothing else — no
 * search, no paging, and no view of what a user actually *has*. An operator
 * investigating "this person says they can't chat" could not see whether the
 * account had a balance, a profile, or a wallet without opening a SQL client.
 *
 * This route joins those facts per page (four set reads, not four-per-user) and
 * exposes search over email, name and id.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const { searchParams } = new URL(req.url)
  const query = (searchParams.get('q') || '').trim()
  const role = searchParams.get('role') || ''
  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get('pageSize') || PAGE_SIZE) || PAGE_SIZE)
  )

  const where: Record<string, unknown> = {}
  if (query) {
    where.OR = [
      { email: { contains: query, mode: 'insensitive' } },
      { name: { contains: query, mode: 'insensitive' } },
      { id: query },
    ]
  }
  if (role) where.role = role

  const alerts: AdminAlert[] = []

  try {
    const [total, rows, roleGroups, agenticCount, verifiedCount] = await Promise.all([
      prisma.users.count({ where }),
      prisma.users.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          provider: true,
          verified: true,
          isAgentic: true,
          createdAt: true,
          lastLogin: true,
          lastActivationAt: true,
          activationCount: true,
          walletAddress: true,
          privyDid: true,
          alchmKitchenUserId: true,
        },
      }),
      prisma.users.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.users.count({ where: { isAgentic: true } }),
      prisma.users.count({ where: { verified: true } }),
    ])

    const ids = rows.map(u => u.id)

    const [balances, profiles, subscriptions, providerKeys] = await Promise.all([
      prisma.tokenBalance.findMany({ where: { userId: { in: ids } } }),
      prisma.user_profiles.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, dominantElement: true },
      }),
      prisma.userSubscription.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, tier: true, status: true, currentPeriodEnd: true },
      }),
      prisma.user_provider_keys.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, provider: true, last4: true, validatedAt: true },
      }),
    ])

    const balanceByUser = new Map(
      balances.map(b => [
        b.userId,
        {
          spirit: round(toAmount(b.spirit)),
          essence: round(toAmount(b.essence)),
          matter: round(toAmount(b.matter)),
          substance: round(toAmount(b.substance)),
          total: round(
            toAmount(b.spirit) + toAmount(b.essence) + toAmount(b.matter) + toAmount(b.substance)
          ),
          lastDailyClaimAt: toIso(b.lastDailyClaimAt),
        },
      ])
    )
    const profileByUser = new Map(profiles.map(p => [p.userId, p.dominantElement]))
    const subscriptionByUser = new Map(
      subscriptions.map(s => [
        s.userId,
        { tier: s.tier, status: s.status, currentPeriodEnd: toIso(s.currentPeriodEnd) },
      ])
    )
    const keysByUser = new Map<
      string,
      Array<{ provider: string; last4: string; validated: boolean }>
    >()
    for (const key of providerKeys) {
      const list = keysByUser.get(key.userId) ?? []
      list.push({ provider: key.provider, last4: key.last4, validated: Boolean(key.validatedAt) })
      keysByUser.set(key.userId, list)
    }

    const users = rows.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      provider: user.provider,
      verified: user.verified,
      isAgentic: user.isAgentic,
      createdAt: toIso(user.createdAt),
      lastLogin: toIso(user.lastLogin),
      lastActivationAt: toIso(user.lastActivationAt),
      activationCount: user.activationCount,
      walletAddress: user.walletAddress,
      privyLinked: Boolean(user.privyDid),
      alchmKitchenLinked: Boolean(user.alchmKitchenUserId),
      balance: balanceByUser.get(user.id) ?? null,
      dominantElement: profileByUser.get(user.id) ?? null,
      subscription: subscriptionByUser.get(user.id) ?? null,
      providerKeys: keysByUser.get(user.id) ?? [],
    }))

    const audit = await recentAdminActions(20)
    if (!audit.available) {
      alerts.push({
        id: 'users:audit-table-missing',
        severity: 'warning',
        source: 'users',
        title: 'Admin audit log is not available in this environment',
        detail: `${audit.error}. Mutations made from this console will still apply, but they will not be recorded.`,
        remediation: 'Run `bunx prisma db push` to create the admin_audit_log table.',
      })
    }

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      query,
      role,
      users,
      totals: {
        byRole: roleGroups.map(g => ({ role: g.role, count: g._count._all })),
        agentic: agenticCount,
        verified: verifiedCount,
      },
      /**
       * Identities that hold admin access through configuration rather than a
       * database role — they will not appear in a role=admin filter, which is
       * exactly the kind of gap an operator needs told rather than discovered.
       */
      configuredAdmins: { emails: ADMIN_EMAILS, handles: ADMIN_HANDLES },
      audit,
      alerts: sortAlerts(alerts),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load user directory',
      },
      { status: 500 }
    )
  }
}
