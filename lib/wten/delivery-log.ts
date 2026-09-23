import 'server-only'

import { prisma } from '@/lib/db'
import type { DeliveryAttempt } from './delivery'

/**
 * Persists each ASOL → WTEN delivery attempt to `wten_deliveries` for the
 * admin WTEN-link page. Never throws and never blocks a delivery for long.
 *
 * Until the table is provisioned (`prisma db push`), every write fails with
 * P2021; after the first such failure the writer goes quiet for a while so a
 * missing table costs one log line, not one per attempt.
 */

const MISSING_TABLE_BACKOFF_MS = 10 * 60_000
const RETENTION_DAYS = 14
/** Prune on ~1 in 200 writes: bounded table size without a dedicated job. */
const PRUNE_SAMPLE_RATE = 1 / 200

let quietUntil = 0

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'P2021'
}

export async function recordDeliveryAttempt(
  attempt: DeliveryAttempt,
  random: () => number = Math.random
): Promise<void> {
  if (Date.now() < quietUntil) return
  try {
    await prisma.wten_deliveries.create({
      data: {
        endpoint: attempt.endpoint,
        eventId: attempt.eventId.slice(0, 500),
        attempt: attempt.attempt,
        status: attempt.status,
        result: attempt.result,
        latencyMs: Math.max(0, Math.round(attempt.latencyMs)),
        error: attempt.error?.slice(0, 1000) ?? null,
      },
    })
    if (random() < PRUNE_SAMPLE_RATE) {
      await prisma.wten_deliveries.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) } },
      })
    }
  } catch (err) {
    if (isMissingTable(err)) {
      quietUntil = Date.now() + MISSING_TABLE_BACKOFF_MS
      console.warn('[wten-delivery] wten_deliveries is not provisioned; run `prisma db push`')
      return
    }
    console.warn(
      '[wten-delivery] could not record attempt:',
      err instanceof Error ? err.message : err
    )
  }
}

/** Test-only. */
export function __resetDeliveryLog(): void {
  quietUntil = 0
}
