import { settlePentacleConversion, refundPentacleConversion } from './client'
import type { Transport } from '@/lib/vessel/spacetime-stats'

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
