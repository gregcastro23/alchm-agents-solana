/**
 * Alchm.kitchen token balance sync.
 *
 * After a successful local yield claim, this module fires a best-effort
 * server-to-server POST to alchm.kitchen's internal sync endpoint so both
 * systems stay in balance. Failures are logged but never propagate to the
 * caller — the local claim is always the source of truth.
 *
 * Required env vars:
 *   ALCHM_KITCHEN_SYNC_URL    – base URL of the alchm.kitchen app
 *                               e.g. https://alchm.kitchen
 *   ALCHM_KITCHEN_SYNC_SECRET – shared secret expected in X-Sync-Secret header
 *
 * Endpoint the alchm.kitchen app must expose:
 *   POST /api/economy/sync-credit
 *   Headers: { X-Sync-Secret: <ALCHM_KITCHEN_SYNC_SECRET> }
 *   Body:    { userEmail, amounts: { spirit, essence, matter, substance }, source, idempotencyKey }
 *   Response 200: { ok: true, balances: { spirit, essence, matter, substance } }
 *   Response 409: { ok: false, reason: "already_applied" }   // idempotency hit
 */

import { loadAlchmSyncConfig } from './alchmSyncConfig'

export interface SyncCreditPayload {
  userEmail: string
  amounts: {
    spirit: string
    essence: string
    matter: string
    substance: string
  }
  source: string
  idempotencyKey: string
}

export interface SyncCreditResult {
  ok: boolean
  balances?: { spirit: number; essence: number; matter: number; substance: number }
  skipped?: boolean
  error?: string
}

export async function syncCreditToAlchm(payload: SyncCreditPayload): Promise<SyncCreditResult> {
  const alchmConfig = (() => {
    try {
      return loadAlchmSyncConfig()
    } catch {
      return null
    }
  })()
  if (!alchmConfig) {
    return { ok: false, skipped: true, error: 'ALCHM_KITCHEN_SYNC_URL or SYNC_SECRET not set' }
  }
  const { baseUrl, secret } = alchmConfig

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)

  try {
    const res = await fetch(`${baseUrl}/api/economy/sync-credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Secret': secret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (res.status === 409) {
      return { ok: true, skipped: true }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      console.error('[alchm-sync] sync-credit failed:', res.status, text)
      return { ok: false, error: `${res.status}: ${text}` }
    }

    const data = await res.json()
    return { ok: true, balances: data.balances }
  } catch (err: any) {
    clearTimeout(timeout)
    const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message ?? String(err))
    console.error('[alchm-sync] sync-credit error:', msg)
    return { ok: false, error: msg }
  }
}
