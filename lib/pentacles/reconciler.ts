import {
  settlePentacleConversion,
  refundPentacleConversion,
  queryStalePentacleEscrows,
  type StalePentacleEscrow,
} from './client'
import type { Transport } from '@/lib/vessel/spacetime-stats'
import { loadAlchmSyncConfig } from '../alchmSyncConfig'

/**
 * What the Kitchen (WTEN) said about a conversion's ESMS credit.
 *
 * Only `applied` and `not_applied` are answers, and both come from a parsed 2xx body. Everything
 * else — sync not configured, network error, timeout, 404, any other non-2xx, a body that is not
 * `{ idempotencyKey, applied: boolean }` for the key that was asked about — is `unknown`. A failed
 * read must never impersonate "not applied": that refunds an escrow whose credit may have landed,
 * and the user keeps both.
 */
export type KitchenStatus =
  | { state: 'applied' }
  | { state: 'not_applied' }
  | { state: 'unknown'; reason: string }

export interface ReconcileDecision {
  conversionId: string
  action: 'settle' | 'refund' | 'noop'
  kitchen: KitchenStatus['state']
  reason: string
}

const STATUS_TIMEOUT_MS = 5_000

/**
 * Asks the Kitchen whether the credit keyed `idempotencyKey` was applied. Never throws: any
 * failure is `unknown`, carrying the reason.
 */
export async function fetchKitchenStatus(
  idempotencyKey: string,
  transport: Transport = fetch
): Promise<KitchenStatus> {
  const unknown = (reason: string): KitchenStatus => ({ state: 'unknown', reason })

  let cfg: { baseUrl: string; secret: string }
  try {
    cfg = loadAlchmSyncConfig()
  } catch {
    return unknown('Kitchen sync is not configured')
  }

  let res: Response
  try {
    res = await transport(
      `${cfg.baseUrl}/api/economy/sync-status?idempotencyKey=${encodeURIComponent(idempotencyKey)}`,
      {
        headers: { 'X-Sync-Secret': cfg.secret },
        signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
        cache: 'no-store',
      }
    )
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      return unknown(`Kitchen status check timed out after ${STATUS_TIMEOUT_MS / 1000}s`)
    }
    return unknown(
      `Kitchen status check failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  // A 404 is not "no such transaction": WTEN answers that with 200 { applied: false }. Until
  // the route exists, every call lands here.
  if (!res.ok) return unknown(`Kitchen status check returned HTTP ${res.status}`)

  let body: unknown
  try {
    body = await res.json()
  } catch {
    return unknown('Kitchen status response is not JSON')
  }

  if (typeof body !== 'object' || body === null) {
    return unknown('Kitchen status response is not an object')
  }
  // The echoed key ties the answer to the question: a misrouted or cached answer for another
  // conversion must not settle or refund this one.
  const echoedKey = 'idempotencyKey' in body ? body.idempotencyKey : undefined
  if (echoedKey !== idempotencyKey) {
    return unknown('Kitchen status response is for a different idempotency key')
  }
  const applied = 'applied' in body ? body.applied : undefined
  if (applied === true) return { state: 'applied' }
  if (applied === false) return { state: 'not_applied' }
  return unknown('Kitchen status response has no boolean `applied`')
}

/**
 * Reconciles an escrowed pentacle conversion against the Kitchen's answer.
 * Invariant: settle OR refund, never both — and neither without an answer.
 */
export async function reconcileConversion(
  conversionId: string,
  kitchenStatus: KitchenStatus,
  customTransport?: Transport
): Promise<ReconcileDecision> {
  switch (kitchenStatus.state) {
    case 'applied': {
      // Kitchen applied the credit -> settle the SpacetimeDB escrow
      const res = await settlePentacleConversion(conversionId, customTransport)
      if (!res.ok) {
        throw new Error(`Failed to settle conversion during reconciliation: ${res.error}`)
      }
      return {
        conversionId,
        action: 'settle',
        kitchen: 'applied',
        reason: 'Kitchen confirmed transaction applied',
      }
    }
    case 'not_applied': {
      // Kitchen confirmed it did not apply the credit -> refund the SpacetimeDB escrow
      const res = await refundPentacleConversion(conversionId, customTransport)
      if (!res.ok) {
        throw new Error(`Failed to refund conversion during reconciliation: ${res.error}`)
      }
      return {
        conversionId,
        action: 'refund',
        kitchen: 'not_applied',
        reason: 'Kitchen confirmed transaction not applied',
      }
    }
    case 'unknown':
      // No answer -> touch nothing; the escrow stays for the next pass.
      return {
        conversionId,
        action: 'noop',
        kitchen: 'unknown',
        reason: `Kitchen status unknown (${kitchenStatus.reason}); escrow left for the next pass`,
      }
  }
}

/**
 * Active reconciler driver: queries stale escrows older than the threshold, asks the Kitchen
 * about each one's credit, and settles, refunds or leaves it according to the answer.
 */
export async function reconcileStaleEscrowsBatch(
  olderThanMinutes = 10,
  transport: Transport = fetch
): Promise<ReconcileDecision[]> {
  const staleEscrows: StalePentacleEscrow[] = await queryStalePentacleEscrows(
    olderThanMinutes,
    transport
  )
  const decisions: ReconcileDecision[] = []

  for (const escrow of staleEscrows) {
    const status = await fetchKitchenStatus(`pentacle_conv:${escrow.conversionId}`, transport)
    try {
      decisions.push(await reconcileConversion(escrow.conversionId, status, transport))
    } catch (err: any) {
      console.error(`[PentaclesReconciler] Failed reconciling escrow ${escrow.conversionId}:`, err)
      decisions.push({
        conversionId: escrow.conversionId,
        action: 'noop',
        kitchen: status.state,
        reason: `Reconciliation error: ${err.message}`,
      })
    }
  }

  const unknown = decisions.filter(d => d.kitchen === 'unknown')
  if (unknown.length > 0) {
    console.warn(
      `[PentaclesReconciler] ${unknown.length} of ${decisions.length} escrow(s) left in place: Kitchen status unknown`
    )
  }

  return decisions
}
