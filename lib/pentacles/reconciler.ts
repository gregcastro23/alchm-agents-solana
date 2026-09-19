import {
  settlePentacleConversion,
  refundPentacleConversion,
  queryStalePentacleEscrows,
  type StalePentacleEscrow,
} from './client'
import type { Transport } from '@/lib/vessel/spacetime-stats'
import { loadAlchmSyncConfig } from '../alchmSyncConfig'

export interface ReconcileDecision {
  conversionId: string
  action: 'settle' | 'refund' | 'noop'
  reason: string
}

/**
 * Reconciles an escrowed pentacle conversion against the Kitchen ledger idempotency status.
 * Guarantees Invariant: either settle OR refund, NEVER both.
 */
export async function reconcileConversion(
  conversionId: string,
  kitchenStatus: { applied: boolean; reason?: string },
  customTransport?: Transport
): Promise<ReconcileDecision> {
  if (kitchenStatus.applied) {
    // Kitchen applied the transaction -> Settle SpacetimeDB escrow
    const res = await settlePentacleConversion(conversionId, customTransport)
    if (!res.ok) {
      throw new Error(`Failed to settle conversion during reconciliation: ${res.error}`)
    }
    return {
      conversionId,
      action: 'settle',
      reason: 'Kitchen confirmed transaction applied',
    }
  } else {
    // Kitchen did not apply -> Refund SpacetimeDB escrow
    const res = await refundPentacleConversion(conversionId, customTransport)
    if (!res.ok) {
      throw new Error(`Failed to refund conversion during reconciliation: ${res.error}`)
    }
    return {
      conversionId,
      action: 'refund',
      reason: 'Kitchen confirmed transaction not applied',
    }
  }
}

/**
 * Active reconciler driver: queries stale escrows older than the threshold,
 * checks Kitchen ledger status via idempotency status inquiry, and settles or refunds.
 */
export async function reconcileStaleEscrowsBatch(
  olderThanMinutes = 10,
  transport: Transport = fetch
): Promise<ReconcileDecision[]> {
  const staleEscrows = await queryStalePentacleEscrows(olderThanMinutes, transport)
  const decisions: ReconcileDecision[] = []

  for (const escrow of staleEscrows) {
    try {
      // Inquire Kitchen status via idempotent check
      const idempotencyKey = `pentacle_conv:${escrow.conversionId}`
      const cfg = (() => {
        try {
          return loadAlchmSyncConfig()
        } catch {
          return null
        }
      })()

      let applied = false
      if (cfg) {
        // Ping sync endpoint or status query if configured
        const res = await transport(
          `${cfg.baseUrl}/api/economy/sync-status?idempotencyKey=${encodeURIComponent(idempotencyKey)}`,
          {
            headers: { 'X-Sync-Secret': cfg.secret },
            signal: AbortSignal.timeout(5_000),
          }
        ).catch(() => null)

        if (res && res.ok) {
          const data = await res.json().catch(() => null)
          applied = Boolean(data?.applied)
        }
      }

      const decision = await reconcileConversion(
        escrow.conversionId,
        {
          applied,
          reason: applied ? 'Kitchen verified applied' : 'Kitchen status unapplied or expired',
        },
        transport
      )
      decisions.push(decision)
    } catch (err: any) {
      console.error(`[PentaclesReconciler] Failed reconciling escrow ${escrow.conversionId}:`, err)
      decisions.push({
        conversionId: escrow.conversionId,
        action: 'noop',
        reason: `Reconciliation error: ${err.message}`,
      })
    }
  }

  return decisions
}
