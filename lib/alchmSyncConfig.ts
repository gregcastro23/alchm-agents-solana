/**
 * Shared configuration loader for alchm.kitchen economy sync endpoints.
 *
 * Mirrors the pattern in lib/wtenClient.ts: lazy validation on first access,
 * cached result for repeat calls, throws clearly on missing env vars.
 *
 * Honors ALCHM_KITCHEN_API_BASE_URL as a fallback for the URL so the
 * existing alchm-debit-sync.ts "either/or" convention is preserved.
 *
 * Required env vars:
 *   ALCHM_KITCHEN_SYNC_URL (or ALCHM_KITCHEN_API_BASE_URL) — base URL
 *   ALCHM_KITCHEN_SYNC_SECRET                              — X-Sync-Secret value
 */

let cachedConfig: { baseUrl: string; secret: string } | null = null

export function loadAlchmSyncConfig(): { baseUrl: string; secret: string } {
  if (cachedConfig) return cachedConfig
  const url = process.env.ALCHM_KITCHEN_SYNC_URL || process.env.ALCHM_KITCHEN_API_BASE_URL
  const secret = process.env.ALCHM_KITCHEN_SYNC_SECRET
  if (!url || !secret) {
    throw new Error(
      'ALCHM_KITCHEN_SYNC_URL (or ALCHM_KITCHEN_API_BASE_URL) and ALCHM_KITCHEN_SYNC_SECRET are required.'
    )
  }
  cachedConfig = { baseUrl: url.replace(/\/$/, ''), secret }
  return cachedConfig
}
