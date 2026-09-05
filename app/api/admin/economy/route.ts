import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { alertIf, sortAlerts, unreadableAlert, type AdminAlert } from '@/lib/admin/alerts'
import { minutesSince, percent, round, toAmount, toIso } from '@/lib/admin/serialize'
import { Prisma } from '@prisma/client'
import {
  AGENT_OPERATION_COSTS,
  DAILY_ESMS_YIELD,
  DUEL_YIELD_DAILY_CAP,
  DUEL_YIELD_REWARD,
  TOKEN_TYPES,
  AXIS_FLOOR,
  Y_MIN,
  Y_MAX,
} from '@/lib/economy-config'
import { inspectSolanaOutbox } from '@/lib/solana/reconciliation'
import { resolveAgentNatalData, getLiveNetworkSupply } from '@/lib/services/discriminant-faucet'

export const dynamic = 'force-dynamic'

/**
 * Token-economy pulse for the operator console.
 *
 * The ESMS economy is a *closed loop with two ledgers*: the off-chain
 * `token_balances` / `token_transactions` pair is authoritative, and
 * `esms_claims` mirrors a debited balance onto chain. Those two can disagree —
 * a claim stuck in `debited` has taken ESMS off the books without minting it —
 * so reconciliation is the first thing this route reports, not an afterthought.
 *
 * Everything is read defensively per-section. A table that is absent in this
 * environment degrades that section to `null` and raises an alert, rather than
 * failing the whole response and blanking the panel.
 */

const AXES = ['spirit', 'essence', 'matter', 'substance'] as const
type Axis = (typeof AXES)[number]

/** Balance bands for the distribution histogram, in total ESMS across all axes. */
const BALANCE_BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: '0 (empty)', min: 0, max: 0 },
  { label: '0–24', min: 0.0001, max: 24 },
  { label: '24–100', min: 24.0001, max: 100 },
  { label: '100–500', min: 100.0001, max: 500 },
  { label: '500+', min: 500.0001, max: Number.POSITIVE_INFINITY },
]

type SectionResult<T> = { data: T | null; error: string | null }

/**
 * Run one section's reads in isolation. A section that throws contributes an
 * alert and a `null` payload; it never takes the rest of the digest with it.
 */
async function section<T>(
  name: string,
  alerts: AdminAlert[],
  read: () => Promise<T>
): Promise<SectionResult<T>> {
  try {
    return { data: await read(), error: null }
  } catch (error) {
    alerts.push(unreadableAlert('economy', name, error))
    return { data: null, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function GET(_req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const alerts: AdminAlert[] = []
  const now = new Date()
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // ── Supply: who holds ESMS, and how much ─────────────────────────────────
  const supply = await section('Token balances', alerts, async () => {
    const [
      holders,
      totals,
      claimedToday,
      claimedTodayAgents,
      totalProfiles,
      sampleProfiles,
      liveSupply,
    ] = await Promise.all([
      prisma.tokenBalance.count(),
      prisma.tokenBalance.aggregate({
        _sum: { spirit: true, essence: true, matter: true, substance: true },
        _avg: { spirit: true, essence: true, matter: true, substance: true },
        _max: { spirit: true, essence: true, matter: true, substance: true },
      }),
      prisma.tokenBalance.count({ where: { lastDailyClaimAt: { gte: todayStart } } }),
      prisma.tokenBalance.count({ where: { lastDailyClaimAgentsAt: { gte: todayStart } } }),
      prisma.user_profiles.count(),
      prisma.user_profiles.findMany({
        take: 200,
        select: {
          userId: true,
          dominantElement: true,
          natalPositions: true,
          natalChart: true,
          monicaConstant: true,
        },
      }),
      getLiveNetworkSupply(prisma),
    ])

    if (liveSupply.isDegraded) {
      alertIf(alerts, true, {
        id: 'economy:faucet-supply-degraded',
        severity: 'critical',
        source: 'economy',
        title: 'Live Network Supply Degraded (Frozen Baseline Active)',
        detail:
          'Failed to aggregate live token supply from database. Faucet is falling back to static baseline LIVE_NETWORK_SUPPLY.',
        href: 'tab:economy',
        remediation:
          'Check database connectivity and token_balances table aggregation performance.',
      })
    }

    const sampleList = Array.isArray(sampleProfiles) ? sampleProfiles : []
    const fallbackCount = sampleList.filter(
      p => resolveAgentNatalData(p?.userId || '', p as any).isNeutralFallback
    ).length
    const neutralFallbackRatePct =
      sampleList.length > 0 ? percent(fallbackCount, sampleList.length) : 0

    const perAxis = AXES.map(axis => ({
      axis,
      total: round(toAmount(totals._sum?.[axis])),
      average: round(toAmount(totals._avg?.[axis])),
      max: round(toAmount(totals._max?.[axis])),
    }))

    // The distribution needs the *sum across axes* per holder, which Prisma
    // cannot aggregate directly — one raw query beats pulling every row.
    const bands = await prisma.$queryRaw<Array<{ band: string; count: bigint }>>`
      SELECT
        CASE
          WHEN (spirit + essence + matter + substance) <= 0 THEN '0 (empty)'
          WHEN (spirit + essence + matter + substance) <= 24 THEN '0–24'
          WHEN (spirit + essence + matter + substance) <= 100 THEN '24–100'
          WHEN (spirit + essence + matter + substance) <= 500 THEN '100–500'
          ELSE '500+'
        END AS band,
        COUNT(*)::bigint AS count
      FROM token_balances
      GROUP BY 1
    `
    const bandCounts = new Map(bands.map(row => [row.band, Number(row.count)]))

    const circulating = perAxis.reduce((sum, axis) => sum + axis.total, 0)

    return {
      holders,
      circulating: round(circulating),
      perAxis,
      distribution: BALANCE_BANDS.map(band => ({
        band: band.label,
        count: bandCounts.get(band.label) ?? 0,
      })),
      dailyClaims: {
        humansToday: claimedToday,
        agentsToday: claimedTodayAgents,
        yieldPerClaim: {
          min: Y_MIN,
          max: Y_MAX,
          base: DAILY_ESMS_YIELD,
          axisFloor: AXIS_FLOOR,
        },
        neutralFallbackRatePct,
        claimRatePct: percent(claimedToday, holders),
      },
    }
  })

  // ── Flow: what minted ESMS and what burned it ────────────────────────────
  const flow = await section('Token transactions', alerts, async () => {
    const [bySource24h, bySource7d, count24h, count7d, recent, floorBreach] = await Promise.all([
      prisma.tokenTransaction.groupBy({
        by: ['sourceType'],
        where: { createdAt: { gte: since24h } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.tokenTransaction.groupBy({
        by: ['sourceType'],
        where: { createdAt: { gte: since7d } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.tokenTransaction.count({ where: { createdAt: { gte: since24h } } }),
      prisma.tokenTransaction.count({ where: { createdAt: { gte: since7d } } }),
      prisma.tokenTransaction.findMany({
        take: 25,
        orderBy: { createdAt: 'desc' },
        select: {
          transactionGroupId: true,
          userId: true,
          tokenType: true,
          amount: true,
          sourceType: true,
          sourceId: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.tokenTransaction.findFirst({
        where: {
          sourceType: { in: ['kitchen_daily_yield', 'agents_daily_yield'] },
          createdAt: { gte: since24h },
          amount: { lt: new Prisma.Decimal(AXIS_FLOOR) },
        },
        select: { id: true, amount: true, tokenType: true, userId: true },
      }),
    ])

    alertIf(alerts, Boolean(floorBreach), {
      id: 'economy:gas-floor-breach',
      severity: 'critical',
      source: 'economy',
      title: 'Operational Gas Floor Breach (INV-2)',
      detail: `Daily claim transaction yielded ${floorBreach?.amount} on ${floorBreach?.tokenType} < AXIS_FLOOR (${AXIS_FLOOR})`,
      href: 'tab:economy',
      remediation: 'Investigate discriminant faucet allocation and per-axis floor enforcement',
    })

    const shape = (
      rows: Array<{ sourceType: string; _sum: { amount: unknown }; _count: { _all: number } }>
    ) =>
      rows
        .map(row => ({
          sourceType: row.sourceType,
          net: round(toAmount(row._sum.amount)),
          entries: row._count._all,
        }))
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

    const sources24h = shape(bySource24h)
    const minted24h = sources24h.filter(s => s.net > 0).reduce((sum, s) => sum + s.net, 0)
    const burned24h = sources24h.filter(s => s.net < 0).reduce((sum, s) => sum + s.net, 0)

    return {
      count24h,
      count7d,
      minted24h: round(minted24h),
      burned24h: round(Math.abs(burned24h)),
      /** Positive means the economy inflated over the window. */
      net24h: round(minted24h + burned24h),
      sources24h,
      sources7d: shape(bySource7d),
      recent: recent.map(tx => ({
        transactionGroupId: tx.transactionGroupId,
        userId: tx.userId,
        tokenType: tx.tokenType,
        amount: round(toAmount(tx.amount), 4),
        sourceType: tx.sourceType,
        sourceId: tx.sourceId,
        description: tx.description,
        createdAt: toIso(tx.createdAt),
      })),
    }
  })

  // ── Chain reconciliation: off-chain debit vs on-chain mint ───────────────
  const chain = await section('ESMS chain claims', alerts, async () => {
    const [byStatus, recent, stuck] = await Promise.all([
      prisma.esms_claims.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.esms_claims.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          walletAddress: true,
          status: true,
          txHash: true,
          network: true,
          error: true,
          spirit: true,
          essence: true,
          matter: true,
          substance: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      // Debited but never minted for over an hour: ESMS is off the books and
      // not on chain. This is the reconciliation hole, so it gets its own read.
      prisma.esms_claims.findMany({
        where: {
          status: { in: ['pending', 'debited'] },
          updatedAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) },
        },
        take: 25,
        orderBy: { updatedAt: 'asc' },
        select: {
          id: true,
          userId: true,
          status: true,
          spirit: true,
          essence: true,
          matter: true,
          substance: true,
          error: true,
          updatedAt: true,
        },
      }),
    ])

    const statusCounts: Record<string, number> = {}
    for (const row of byStatus) statusCounts[row.status] = row._count._all

    const claimAmount = (row: {
      spirit: unknown
      essence: unknown
      matter: unknown
      substance: unknown
    }) => round(AXES.reduce((sum, axis) => sum + toAmount(row[axis as Axis]), 0))

    return {
      statusCounts,
      total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      failed: statusCounts.failed ?? 0,
      minted: statusCounts.minted ?? 0,
      stuck: stuck.map(row => ({
        id: row.id,
        userId: row.userId,
        status: row.status,
        amount: claimAmount(row),
        error: row.error,
        stuckForMinutes: minutesSince(row.updatedAt, now.getTime()),
        updatedAt: toIso(row.updatedAt),
      })),
      recent: recent.map(row => ({
        id: row.id,
        userId: row.userId,
        walletAddress: row.walletAddress,
        status: row.status,
        txHash: row.txHash,
        network: row.network,
        error: row.error,
        amount: claimAmount(row),
        createdAt: toIso(row.createdAt),
      })),
    }
  })

  // ── Subscriptions: the fiat side of the economy ──────────────────────────
  const subscriptions = await section('Subscriptions', alerts, async () => {
    const [byTier, byStatus, active, expiringSoon] = await Promise.all([
      prisma.userSubscription.groupBy({ by: ['tier'], _count: { _all: true } }),
      prisma.userSubscription.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.userSubscription.count({
        where: { status: 'active', currentPeriodEnd: { gte: now } },
      }),
      prisma.userSubscription.count({
        where: {
          status: 'active',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ])

    return {
      active,
      churningWithin7d: expiringSoon,
      byTier: byTier.map(row => ({ tier: row.tier, count: row._count._all })),
      byStatus: byStatus.map(row => ({ status: row.status, count: row._count._all })),
    }
  })

  // ── Solana rail: indexer liveness and bridge backlog ─────────────────────
  const solana = await section('Solana rail', alerts, async () => {
    const [heartbeats, outboxResult, bridgeByStatus, verifiedWallets] = await Promise.all([
      prisma.solanaServiceHeartbeat.findMany({ orderBy: { heartbeatAt: 'desc' } }),
      inspectSolanaOutbox(prisma),
      prisma.solanaBridgeTransfer.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.verifiedSolanaWallet.count(),
    ])

    alerts.push(...outboxResult.alerts)

    return {
      services: heartbeats.map(hb => ({
        service: hb.service,
        connectionStatus: hb.connectionStatus,
        activeRpc: hb.activeRpc,
        reconnectAttempts: hb.reconnectAttempts,
        queueDepth: hb.queueDepth,
        // BigInt slot — string, never Number: a Solana u64 exceeds MAX_SAFE_INTEGER.
        lastProcessedSlot: hb.lastProcessedSlot === null ? null : String(hb.lastProcessedSlot),
        lastError: hb.lastError,
        heartbeatAt: toIso(hb.heartbeatAt),
        staleForMinutes: minutesSince(hb.heartbeatAt, now.getTime()),
      })),
      outbox: {
        pending: outboxResult.inspection.pendingCount,
        failing: outboxResult.inspection.failingCount,
      },
      bridge: bridgeByStatus.map(row => ({ status: row.status, count: row._count._all })),
      verifiedWallets,
    }
  })

  // ── Sink pricing, as configured right now ────────────────────────────────
  const pricing = {
    tokenTypes: [...TOKEN_TYPES],
    dailyYield: DAILY_ESMS_YIELD,
    duelYield: { reward: DUEL_YIELD_REWARD, dailyCap: DUEL_YIELD_DAILY_CAP },
    operations: Object.entries(AGENT_OPERATION_COSTS)
      .map(([operation, cost]) => ({
        operation,
        cost,
        total: round(Object.values(cost).reduce((sum, value) => sum + (value ?? 0), 0)),
      }))
      .sort((a, b) => b.total - a.total),
  }

  // ── Rules ────────────────────────────────────────────────────────────────
  if (chain.data) {
    alertIf(alerts, chain.data.stuck.length > 0, {
      id: 'economy:claims-stuck',
      severity: 'critical',
      source: 'economy',
      title: `${chain.data.stuck.length} ESMS claim(s) stuck mid-settlement`,
      detail: `Claims have sat in pending/debited for over an hour. A debited claim has already left the off-chain ledger; if it never mints, that ESMS is destroyed silently. Oldest: ${chain.data.stuck[0]?.stuckForMinutes ?? '?'}m.`,
      href: 'tab:economy',
      remediation: 'Reconcile against the chain and re-drive or refund each claim id.',
    })
    alertIf(alerts, chain.data.failed > 0, {
      id: 'economy:claims-failed',
      severity: 'warning',
      source: 'economy',
      title: `${chain.data.failed} ESMS claim(s) failed`,
      detail: 'Claims terminated in the failed state and were never minted on chain.',
      href: 'tab:economy',
    })
  }

  if (solana.data) {
    const staleServices = solana.data.services.filter(
      s => s.staleForMinutes !== null && s.staleForMinutes > 15
    )
    alertIf(alerts, staleServices.length > 0, {
      id: 'economy:solana-heartbeat-stale',
      severity: 'critical',
      source: 'economy',
      title: `Solana service heartbeat stale`,
      detail: staleServices
        .map(s => `${s.service}: last beat ${s.staleForMinutes}m ago (${s.connectionStatus})`)
        .join('; '),
      href: 'tab:economy',
      remediation: 'The worker is stopped or wedged — restart the sync/bridge process.',
    })
  }

  if (supply.data && flow.data) {
    // A day where nothing was spent but ESMS was handed out is an economy with
    // no sink pulling against the faucet.
    alertIf(alerts, flow.data.minted24h > 0 && flow.data.burned24h === 0, {
      id: 'economy:no-sink',
      severity: 'warning',
      source: 'economy',
      title: 'ESMS minted with no burn in 24h',
      detail: `${flow.data.minted24h} ESMS credited and 0 debited over the last day across ${supply.data.holders} holders. The faucet is running without a sink.`,
      href: 'tab:economy',
      remediation: 'Confirm chat/shop debits are reaching token_transactions.',
    })
    alertIf(alerts, supply.data.holders > 0 && flow.data.count24h === 0, {
      id: 'economy:no-flow',
      severity: 'info',
      source: 'economy',
      title: 'No token transactions in 24h',
      detail: `${supply.data.holders} holders on the books but zero ledger entries today.`,
      href: 'tab:economy',
    })
  }

  return NextResponse.json({
    success: true,
    generatedAt: now.toISOString(),
    supply: supply.data,
    flow: flow.data,
    chain: chain.data,
    subscriptions: subscriptions.data,
    solana: solana.data,
    pricing,
    /** Sections that could not be read, so the panel can say so explicitly. */
    degraded: Object.entries({
      supply: supply.error,
      flow: flow.error,
      chain: chain.error,
      subscriptions: subscriptions.error,
      solana: solana.error,
    })
      .filter(([, error]) => error)
      .map(([name, error]) => ({ section: name, error: error as string })),
    alerts: sortAlerts(alerts),
  })
}
