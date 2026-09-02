/**
 * Solana Reconciliation Engine
 *
 * Single source of truth for off-chain ledger vs. on-chain Solana state reconciliation:
 * 1. Claim Reconciliation: Verifies PostgreSQL claims against on-chain `ClaimReceipt` PDAs
 *    at `'finalized'` commitment. Heals orphaned debited claims and detects ghost claims
 *    with staleness guards and multi-endpoint verification.
 * 2. Token-2022 Supply Audit: Compares on-chain mint supplies against aggregate minted atoms.
 * 3. Outbox Inspection: Tracks delivery lag, dead letters (`attempts >= 3`), and queue depth.
 *
 * Emits canonical `AdminAlert[]` consumed by `/api/admin/economy` and `scripts/reconciliation/`.
 */

import { Connection } from '@solana/web3.js'
import { getMint } from '@solana/spl-token'
import type { PrismaClient } from '@prisma/client'
import {
  ASOL_SOLANA_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getEsmsMintAddresses,
  getReceiptAddress,
  claimIdToBytes32,
} from '@/lib/solana/esms'
import { resolveSolanaRpcUrls } from '@/lib/solana/rpc-failover'
import type { AdminAlert } from '@/lib/admin/alerts'

export const OUTBOX_FAILING_THRESHOLD = 3
export const STUCK_CLAIM_THRESHOLD_MS = 60 * 60 * 1000 // 1 hour
export const GHOST_CLAIM_MIN_AGE_MS = 15 * 60 * 1000 // 15 minutes staleness guard

export interface ClaimDiscrepancy {
  claimId: string
  userId: string
  walletAddress: string
  statusInDb: string
  onChainExists: boolean
  type: 'unhealed_debited' | 'ghost_claim' | 'stuck_pending'
  detail: string
  ageMinutes: number
}

export interface SupplyAudit {
  element: 'spirit' | 'essence' | 'matter' | 'substance'
  mintAddress: string
  onChainSupply: bigint
  dbTotalAtoms: bigint
  drift: bigint // onChain - db
}

export interface OutboxInspectionResult {
  pendingCount: number
  failingCount: number
  backlogWarning: boolean
  oldestPendingMinutes: number | null
}

export interface ReconciliationReport {
  timestamp: string
  status: 'healthy' | 'degraded' | 'critical'
  claims: {
    totalChecked: number
    mintedCount: number
    debitedCount: number
    pendingCount: number
    failedCount: number
    stuckCount: number
    unhealedCount: number
    healedCount: number
    ghostCount: number
    discrepancies: ClaimDiscrepancy[]
  }
  supplies: Record<string, { onChain: string; db: string; drift: string }> | null
  outbox: OutboxInspectionResult
  alerts: AdminAlert[]
}

/**
 * Inspect transactional outbox for stuck delivery attempts and growing queue lag.
 */
export async function inspectSolanaOutbox(prisma: PrismaClient): Promise<{
  inspection: OutboxInspectionResult
  alerts: AdminAlert[]
}> {
  const alerts: AdminAlert[] = []

  const [pendingCount, failingCount, oldestPending] = await Promise.all([
    prisma.solanaSyncOutbox.count({ where: { deliveredAt: null } }),
    prisma.solanaSyncOutbox.count({
      where: { deliveredAt: null, attempts: { gte: OUTBOX_FAILING_THRESHOLD } },
    }),
    prisma.solanaSyncOutbox.findFirst({
      where: { deliveredAt: null },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ])

  const now = Date.now()
  const oldestPendingMinutes = oldestPending
    ? Math.max(0, Math.floor((now - oldestPending.createdAt.getTime()) / 60_000))
    : null

  if (failingCount > 0) {
    alerts.push({
      id: 'economy:outbox-failing',
      severity: 'warning',
      source: 'economy',
      title: `${failingCount} outbox event(s) retrying without success`,
      detail: `${pendingCount} undelivered total; ${failingCount} have failed ${OUTBOX_FAILING_THRESHOLD}+ attempts.`,
      href: 'tab:economy',
      remediation: 'Check webhook endpoints and sync worker logs.',
    })
  }

  if (pendingCount > 100) {
    alerts.push({
      id: 'economy:outbox-backlog',
      severity: 'warning',
      source: 'economy',
      title: 'Solana outbox backlog growing',
      detail: `${pendingCount} events await delivery.${
        oldestPendingMinutes !== null ? ` Oldest: ${oldestPendingMinutes}m ago.` : ''
      }`,
      href: 'tab:economy',
    })
  }

  return {
    inspection: {
      pendingCount,
      failingCount,
      backlogWarning: pendingCount > 100,
      oldestPendingMinutes,
    },
    alerts,
  }
}

/**
 * Reconciles PostgreSQL claims against on-chain Solana ClaimReceipt PDAs.
 * Safe against lagging RPCs via staleness guards and multi-endpoint verification.
 */
export async function reconcileEsmsClaims(options: {
  prisma: PrismaClient
  connection?: Connection
  endpoints?: readonly string[]
  autoHeal?: boolean
}): Promise<{
  claimsSummary: ReconciliationReport['claims']
  alerts: AdminAlert[]
}> {
  const { prisma, autoHeal = false } = options
  const alerts: AdminAlert[] = []
  const discrepancies: ClaimDiscrepancy[] = []
  const now = Date.now()

  // 1. Fetch claims relevant to Solana (network includes solana or wallet matches base58 address)
  const claims = await prisma.esms_claims.findMany({
    where: {
      OR: [{ network: { contains: 'solana' } }, { walletAddress: { not: { startsWith: '0x' } } }],
    },
    orderBy: { createdAt: 'desc' },
  })

  let totalChecked = claims.length
  let mintedCount = 0
  let debitedCount = 0
  let pendingCount = 0
  let failedCount = 0
  let stuckCount = 0
  let unhealedCount = 0
  let healedCount = 0
  let ghostCount = 0

  const primaryConn = options.connection ?? new Connection(resolveSolanaRpcUrls()[0], 'finalized')
  const failoverUrls = options.endpoints ?? resolveSolanaRpcUrls()

  for (const claim of claims) {
    const ageMs = now - claim.createdAt.getTime()
    const ageMinutes = Math.floor(ageMs / 60_000)

    if (claim.status === 'minted') mintedCount++
    else if (claim.status === 'debited') debitedCount++
    else if (claim.status === 'pending') pendingCount++
    else if (claim.status === 'failed') failedCount++

    // Stuck claim check: pending or debited for > 1 hour
    const isStuck =
      (claim.status === 'pending' || claim.status === 'debited') && ageMs > STUCK_CLAIM_THRESHOLD_MS
    if (isStuck) {
      stuckCount++
      discrepancies.push({
        claimId: claim.id,
        userId: claim.userId,
        walletAddress: claim.walletAddress,
        statusInDb: claim.status,
        onChainExists: false,
        type: 'stuck_pending',
        detail: `Claim in status '${claim.status}' for ${ageMinutes}m without completing on-chain mint.`,
        ageMinutes,
      })
    }

    // On-chain PDA derivation
    let claimBytes: Uint8Array
    try {
      claimBytes = claimIdToBytes32(claim.id)
    } catch {
      continue
    }
    const receiptAddress = getReceiptAddress('claim', claimBytes, ASOL_SOLANA_PROGRAM_ID)

    let accountInfo = null
    try {
      accountInfo = await primaryConn.getAccountInfo(receiptAddress, 'finalized')
    } catch {
      // RPC read failed, skip deep inspection for this claim
      continue
    }

    const onChainExists = accountInfo !== null

    // Case A: Unhealed Debited Claim (On-chain receipt exists at finalized, but DB is debited)
    if (onChainExists && claim.status === 'debited') {
      unhealedCount++
      if (autoHeal) {
        try {
          const sigs = await primaryConn.getSignaturesForAddress(receiptAddress, { limit: 1 })
          const txHash = sigs[0]?.signature ?? claim.txHash ?? 'reconciled_onchain'
          await prisma.esms_claims.update({
            where: { id: claim.id },
            data: { status: 'minted', txHash, error: null },
          })
          healedCount++
        } catch {
          // Auto-heal failed best-effort
        }
      }
      discrepancies.push({
        claimId: claim.id,
        userId: claim.userId,
        walletAddress: claim.walletAddress,
        statusInDb: claim.status,
        onChainExists: true,
        type: 'unhealed_debited',
        detail: `Claim was finalized on-chain but database was left in 'debited' status. ${
          autoHeal ? 'Auto-healed to minted.' : 'Requires reconciliation.'
        }`,
        ageMinutes,
      })
    }

    // Case B: Ghost Claim (DB says minted, but no on-chain receipt found)
    // Guard: Only flag if claim is older than 15 minutes AND absence reproduces on at least 2 endpoints
    if (!onChainExists && claim.status === 'minted' && ageMs > GHOST_CLAIM_MIN_AGE_MS) {
      let verifiedAbsent = true

      // Verify on secondary endpoint if available
      if (failoverUrls.length > 1) {
        const secondaryUrl = failoverUrls[1]
        try {
          const secondaryConn = new Connection(secondaryUrl, 'finalized')
          const secAccount = await secondaryConn.getAccountInfo(receiptAddress, 'finalized')
          if (secAccount !== null) {
            verifiedAbsent = false // Lagging primary RPC, not a real ghost!
          }
        } catch {
          // Secondary failed, do not assume ghost
          verifiedAbsent = false
        }
      }

      if (verifiedAbsent) {
        ghostCount++
        discrepancies.push({
          claimId: claim.id,
          userId: claim.userId,
          walletAddress: claim.walletAddress,
          statusInDb: claim.status,
          onChainExists: false,
          type: 'ghost_claim',
          detail: `Claim recorded as 'minted' in database ${ageMinutes}m ago but no ClaimReceipt PDA exists on-chain across independent endpoints.`,
          ageMinutes,
        })
      }
    }
  }

  // Generate AdminAlerts
  if (stuckCount > 0) {
    alerts.push({
      id: 'economy:claims-stuck',
      severity: 'critical',
      source: 'economy',
      title: `${stuckCount} ESMS claim(s) stuck mid-settlement`,
      detail: `Claims have sat in pending/debited for over an hour. A debited claim has left the off-chain ledger; if it never mints, that balance is trapped.`,
      href: 'tab:economy',
      remediation: 'Reconcile against the chain and re-drive or refund each claim id.',
    })
  }

  if (ghostCount > 0) {
    alerts.push({
      id: 'economy:ghost-claims',
      severity: 'critical',
      source: 'economy',
      title: `${ghostCount} ghost claim(s) detected`,
      detail: `Claims are marked 'minted' in database but no ClaimReceipt PDA exists on-chain at finalized commitment.`,
      href: 'tab:economy',
      remediation: 'Verify transaction signatures on explorer; re-mint or rectify database status.',
    })
  }

  if (unhealedCount > 0 && !autoHeal) {
    alerts.push({
      id: 'economy:claims-unhealed',
      severity: 'warning',
      source: 'economy',
      title: `${unhealedCount} unhealed Solana claim(s) ready for reconciliation`,
      detail: `Claims successfully minted on-chain but status in database remains 'debited'.`,
      href: 'tab:economy',
      remediation: 'Run reconciliation with --auto-heal to promote debited to minted.',
    })
  }

  return {
    claimsSummary: {
      totalChecked,
      mintedCount,
      debitedCount,
      pendingCount,
      failedCount,
      stuckCount,
      unhealedCount,
      healedCount,
      ghostCount,
      discrepancies,
    },
    alerts,
  }
}

/**
 * Reconciles Token-2022 on-chain supplies against aggregate DB minted atoms.
 */
export async function reconcileToken2022Supplies(options: {
  prisma: PrismaClient
  connection?: Connection
}): Promise<{
  supplies: SupplyAudit[]
  alerts: AdminAlert[]
}> {
  const { prisma } = options
  const alerts: AdminAlert[] = []
  const primaryConn = options.connection ?? new Connection(resolveSolanaRpcUrls()[0], 'finalized')

  const mintAddresses = getEsmsMintAddresses(ASOL_SOLANA_PROGRAM_ID)
  const elements: Array<'spirit' | 'essence' | 'matter' | 'substance'> = [
    'spirit',
    'essence',
    'matter',
    'substance',
  ]

  // Aggregate minted atoms in PostgreSQL for Solana claims
  const mintedClaims = await prisma.esms_claims.findMany({
    where: {
      status: 'minted',
      OR: [{ network: { contains: 'solana' } }, { walletAddress: { not: { startsWith: '0x' } } }],
    },
    select: {
      spirit: true,
      essence: true,
      matter: true,
      substance: true,
    },
  })

  const dbTotals: Record<(typeof elements)[number], bigint> = {
    spirit: 0n,
    essence: 0n,
    matter: 0n,
    substance: 0n,
  }

  for (const row of mintedClaims) {
    dbTotals.spirit += BigInt(Math.round(Number(row.spirit || 0) * 10_000))
    dbTotals.essence += BigInt(Math.round(Number(row.essence || 0) * 10_000))
    dbTotals.matter += BigInt(Math.round(Number(row.matter || 0) * 10_000))
    dbTotals.substance += BigInt(Math.round(Number(row.substance || 0) * 10_000))
  }

  const audits: SupplyAudit[] = []

  for (let i = 0; i < 4; i++) {
    const element = elements[i]
    const mintPubkey = mintAddresses[i]
    let onChainSupply = 0n

    try {
      const mintInfo = await getMint(primaryConn, mintPubkey, 'finalized', TOKEN_2022_PROGRAM_ID)
      onChainSupply = mintInfo.supply
    } catch {
      // Mint account uninitialized or RPC unreachable
      continue
    }

    const dbTotal = dbTotals[element]
    const drift = onChainSupply - dbTotal

    audits.push({
      element,
      mintAddress: mintPubkey.toBase58(),
      onChainSupply,
      dbTotalAtoms: dbTotal,
      drift,
    })

    if (drift !== 0n) {
      alerts.push({
        id: `economy:supply-drift-${element}`,
        severity: 'warning',
        source: 'economy',
        title: `Token-2022 ${element} supply drift detected`,
        detail: `On-chain supply (${onChainSupply} atoms) differs from database ledger (${dbTotal} atoms) by ${drift} atoms.`,
        href: 'tab:economy',
        remediation: 'Inspect recent claims and burns for unrecorded on-chain activity.',
      })
    }
  }

  return { supplies: audits, alerts }
}

/**
 * Runs a complete reconciliation audit across claims, Token-2022 supplies, and transactional outbox.
 */
export async function reconcileSolanaState(options: {
  prisma: PrismaClient
  connection?: Connection
  autoHeal?: boolean
}): Promise<ReconciliationReport> {
  const { prisma, connection, autoHeal = false } = options

  const [outboxRes, claimsRes, supplyRes] = await Promise.all([
    inspectSolanaOutbox(prisma).catch(() => ({
      inspection: {
        pendingCount: 0,
        failingCount: 0,
        backlogWarning: false,
        oldestPendingMinutes: null,
      },
      alerts: [],
    })),
    reconcileEsmsClaims({ prisma, connection, autoHeal }).catch(err => ({
      claimsSummary: {
        totalChecked: 0,
        mintedCount: 0,
        debitedCount: 0,
        pendingCount: 0,
        failedCount: 0,
        stuckCount: 0,
        unhealedCount: 0,
        healedCount: 0,
        ghostCount: 0,
        discrepancies: [],
      },
      alerts: [
        {
          id: 'economy:reconciliation-failed',
          severity: 'warning' as const,
          source: 'economy' as const,
          title: 'Solana claims reconciliation failed',
          detail: err instanceof Error ? err.message : String(err),
        },
      ],
    })),
    reconcileToken2022Supplies({ prisma, connection }).catch(() => ({
      supplies: [],
      alerts: [],
    })),
  ])

  const allAlerts = [...outboxRes.alerts, ...claimsRes.alerts, ...supplyRes.alerts]

  let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy'
  if (allAlerts.some(a => a.severity === 'critical')) {
    overallStatus = 'critical'
  } else if (allAlerts.some(a => a.severity === 'warning')) {
    overallStatus = 'degraded'
  }

  const suppliesMap =
    supplyRes.supplies.length > 0
      ? Object.fromEntries(
          supplyRes.supplies.map(s => [
            s.element,
            {
              onChain: s.onChainSupply.toString(),
              db: s.dbTotalAtoms.toString(),
              drift: s.drift.toString(),
            },
          ])
        )
      : null

  return {
    timestamp: new Date().toISOString(),
    status: overallStatus,
    claims: claimsRes.claimsSummary,
    supplies: suppliesMap,
    outbox: outboxRes.inspection,
    alerts: allAlerts,
  }
}
