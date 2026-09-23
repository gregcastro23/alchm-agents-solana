/**
 * Syncs a quest event to the alchm.kitchen platform.
 * Used for agents performing "demo" actions like meal planning or pantry updates.
 */
import { loadAlchmSyncConfig } from './alchmSyncConfig'
import { deliverToWten } from './wten/delivery'

export async function syncEventToAlchm(params: {
  userEmail: string
  event: string
  /**
   * Stable ID of the source event, e.g. `agent_action:{userId}:{hourKey}:event:{event}`.
   * Required: WTEN will dedupe on it (Phase 2), and until then it is what
   * makes a retried delivery recognisable as the same event.
   */
  idempotencyKey: string
  metadata?: {
    agentName?: string
    agentProfile?: {
      bio?: string | null
      monicaCreationStory?: string | null
      natalChart?: any
      natalPositions?: Array<{ planet: string; sign: string; degree: number }>
      dominantElement?: string
      monicaConstant?: number | null
      birthDate?: string
      birthTime?: string | null
      birthLocation?: string
    }
  }
}): Promise<{ ok: boolean; error?: string; completed?: any[] }> {
  const alchmConfig = (() => {
    try {
      return loadAlchmSyncConfig()
    } catch {
      return null
    }
  })()
  if (!alchmConfig) {
    console.error('[alchm-event-sync] Missing ALCHM_KITCHEN_SYNC_URL or ALCHM_KITCHEN_SYNC_SECRET')
    return { ok: false, error: 'Internal configuration error' }
  }
  const { baseUrl, secret } = alchmConfig

  // The idempotency key travels in the body AND as the Idempotency-Key header.
  // WTEN does not dedupe sync-event yet (QuestService counts every delivery), so
  // the shared client only retries failures that never reached the handler.
  const delivery = await deliverToWten({
    endpoint: 'economy/sync-event',
    url: `${baseUrl}/api/economy/sync-event`,
    headers: { 'X-Sync-Secret': secret },
    body: params,
    eventId: params.idempotencyKey,
  })

  if (delivery.outcome === 'already_applied') {
    console.log(`[alchm-event-sync] Event already reported (key: ${params.idempotencyKey})`)
    return { ok: true, completed: [] }
  }

  if (delivery.outcome !== 'delivered') {
    const data = delivery.body
    const errorMsg =
      data?.message || data?.error || delivery.error || `HTTP ${delivery.status ?? 'network'}`
    console.error(`[alchm-event-sync] Failed to sync event: ${errorMsg}`)
    return { ok: false, error: errorMsg }
  }

  console.log(`[alchm-event-sync] Event reported for ${params.userEmail}: ${params.event}`)
  return { ok: true, completed: delivery.body?.completed }
}
