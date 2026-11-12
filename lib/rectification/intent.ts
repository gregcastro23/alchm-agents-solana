export interface RectificationChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface RectificationHistoryInputTurn {
  role?: string
  content?: string
}

const MAX_SESSIONS = 100
const MAX_TURNS_PER_SESSION = 12
const sessionHistoryStore = new Map<string, RectificationChatTurn[]>()

function makeSessionHistoryKey(sessionId: string, userId?: string): string {
  return `${userId || 'anon'}:${sessionId}`
}

/**
 * Retrieve bounded multi-turn chat history for an active Monica rectification session.
 */
export function getRectificationSessionHistory(
  sessionId?: string,
  userId?: string,
  providedHistory?: RectificationHistoryInputTurn[]
): RectificationChatTurn[] {
  if (Array.isArray(providedHistory) && providedHistory.length > 0) {
    return providedHistory
      .filter(
        (t): t is { role?: string; content: string } =>
          typeof t?.content === 'string' && t.content.trim().length > 0
      )
      .slice(-MAX_TURNS_PER_SESSION)
      .map(t => ({
        role: t.role === 'assistant' || t.role === 'ai' ? 'assistant' : 'user',
        content: t.content,
      }))
  }

  if (!sessionId) return []
  const key = makeSessionHistoryKey(sessionId, userId)
  const existing = sessionHistoryStore.get(key)
  if (!existing) return []
  // Refresh LRU recency
  sessionHistoryStore.delete(key)
  sessionHistoryStore.set(key, existing)
  return existing
}

export function appendRectificationSessionTurns(
  sessionId: string | undefined,
  userId: string | undefined,
  userMessage: string,
  assistantMessage: string
): void {
  if (!sessionId || !assistantMessage) return
  const key = makeSessionHistoryKey(sessionId, userId)
  const existing = sessionHistoryStore.get(key) ?? []
  const updated: RectificationChatTurn[] = [
    ...existing,
    { role: 'user' as const, content: userMessage },
    { role: 'assistant' as const, content: assistantMessage },
  ].slice(-MAX_TURNS_PER_SESSION)

  if (sessionHistoryStore.has(key)) {
    sessionHistoryStore.delete(key)
  } else if (sessionHistoryStore.size >= MAX_SESSIONS) {
    const oldest = sessionHistoryStore.keys().next().value
    if (oldest !== undefined) sessionHistoryStore.delete(oldest)
  }
  sessionHistoryStore.set(key, updated)
}

export function clearRectificationSessionHistory(): void {
  sessionHistoryStore.clear()
}

const DIRECT_RECTIFICATION_PATTERNS = [
  /\b(rising sign|ascendant|birth\s*time|time of birth|rectif(y|ying|ication))\b/i,
  /\b(don'?t|do not|never|uncertain|unsure|unknown|missing|forgot|no)\s+(know|have|remember)?\s*(my|their|his|her)?\s*(exact\s*)?(birth\s*time|time of birth|rising)\b/i,
  /\b(find|discover|estimate|determine|calculate|figure out|narrow down|save|apply|set|update)\s+(my|the|a)?\s*(rising|ascendant|birth\s*time)\b/i,
]

const PRIOR_RECTIFICATION_CONTEXT_PATTERN =
  /\b(rectif(y|ication)|rising sign|ascendant|credible window|working birth time|entropy|rectify_windows|rectify_score|rectify_apply|top sign|dawn|morning|afternoon|evening|night|life milestone)\b/i

const FOLLOWUP_ANSWER_PATTERN =
  /\b(dawn|morning|afternoon|evening|dusk|night|noon|midnight|breakfast|lunch|dinner|sunrise|sunset|am|pm|\d{1,2}:\d{2}|graduat|marri|wed|mov|relocat|job|career|promot|illness|hospital|award|publish|born|save|apply|confirm|yes|yeah|yep|sure|okay|ok|please|another question)\b|\b(19|20)\d{2}\b/i

/**
 * Detect whether the user message is initiating or continuing a conversational
 * birth-time / Ascendant rectification workflow.
 */
export function isRectificationIntent(
  message: string,
  history: RectificationHistoryInputTurn[] = []
): boolean {
  const trimmed = (message || '').trim()
  if (!trimmed) return false

  if (DIRECT_RECTIFICATION_PATTERNS.some(pattern => pattern.test(trimmed))) {
    return true
  }

  if (history.length > 0 && FOLLOWUP_ANSWER_PATTERN.test(trimmed)) {
    const recentHistory = history.slice(-6)
    return recentHistory.some(
      turn =>
        typeof turn.content === 'string' && PRIOR_RECTIFICATION_CONTEXT_PATTERN.test(turn.content)
    )
  }

  return false
}

export const RECTIFICATION_INTERVIEW_INSTRUCTIONS = `
Birth-Time & Ascendant Rectification Workflow:
- You have dedicated Swiss Ephemeris rectification tools: \`geocode_location\`, \`rectify_windows\`, \`rectify_score\`, and \`rectify_apply\`.
- When a user does not know their birth time or asks to find/estimate/save their Rising Sign (Ascendant):
  1. Do NOT ask the user for latitude or longitude! If they give a city name (e.g. "Chicago, IL" or "Bangkok, Thailand"), pass \`location\` directly to \`rectify_windows\` / \`rectify_score\` (or resolve it first with \`geocode_location\`). Remember \`rectify_windows\` and \`rectify_score\` operate in astronomical Local Mean Time (LMT) minutes and \`clockToLmtMinutes\` from \`geocode_location\` converts clock times accurately.
  2. Start by calling \`rectify_windows\` as soon as you have birth date (year, month, day) and birthplace. Present the candidate rising windows concisely and ask ONLY the single highest Expected Information Gain question from \`recommendedNextQuestion\` (e.g., diurnal time window first, then a high-leverage dated career/marriage/relocation/health milestone).
  3. On each user reply, append the new clue/milestone into the cumulative \`evidence\` array and call \`rectify_score\`. Report the updated top rising sign, probability (%), working time, and 80% credible window width. If \`calculationEligible\` is false (< 70% probability or > 180m window), ask only the next best \`recommendedNextQuestion\`.
  4. Never claim that a Rising Sign or rectified birth time has been saved unless \`rectify_apply\` has actually been called and returned \`success: true\`. If \`rectify_apply\` returns \`requiresAuth: true\`, clearly invite the user to sign in or visit \`/rectify\`. If it returns \`requiresConfirmation: true\`, explain the current probability and ask whether to answer another question or explicitly confirm saving a tentative working estimate (\`allowUnconfirmed: true\`).
`.trim()
