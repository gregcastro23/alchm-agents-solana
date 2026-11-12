export interface ClientMonicaMessageLike {
  id?: string
  type: 'user' | 'monica' | 'assistant'
  content: string
}

export interface MonicaHistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Convert client Monica chat state into bounded `{ role, content }` turns
 * starting at the first user message (omitting static welcome banners).
 */
export function buildMonicaHistoryPayload(
  messages: ClientMonicaMessageLike[],
  limit = 12
): MonicaHistoryTurn[] {
  const firstUserIndex = messages.findIndex(m => m.type === 'user')
  if (firstUserIndex === -1) return []

  return messages
    .slice(firstUserIndex)
    .filter(m => m.id !== 'welcome' && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-limit)
    .map(m => ({
      role: m.type === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }))
}

export function createMonicaSessionId(prefix = 'monica'): string {
  const randomSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 12)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return `${prefix}-${randomSuffix}`
}

/**
 * Retrieve or lazily create a stable sessionId in sessionStorage/localStorage
 * so multi-turn Monica interviews persist across turns on client surfaces.
 */
export function getOrCreateMonicaSessionId(storageKey: string, prefix = 'monica'): string {
  if (typeof window !== 'undefined') {
    try {
      const existing = window.sessionStorage?.getItem(storageKey)
      if (existing && existing.trim().length > 0) {
        return existing
      }
      const created = createMonicaSessionId(prefix)
      window.sessionStorage?.setItem(storageKey, created)
      return created
    } catch {
      // Fall through if storage is restricted
    }
  }
  return createMonicaSessionId(prefix)
}

export function setMonicaStoredSessionId(storageKey: string, sessionId: string): void {
  if (typeof window === 'undefined' || !sessionId) return
  try {
    window.sessionStorage?.setItem(storageKey, sessionId)
  } catch {
    // Non-fatal
  }
}
