/**
 * Cosmic EV & Leveling Engine
 * ---------------------------
 * Pokémon-inspired training/leveling math for Planetary Agents.
 *
 * - Individual Values (IVs): deterministic "cosmic blueprint" derived from an
 *   agent's natal Sacred Stats. NOT random — they ARE the existing score fields
 *   on `historical_agents`.
 * - Evolution Values (EVs): earned by cross-training. Capped at 510 total, 252
 *   per stat. Mirror the Sacred 7 keys.
 * - XP / Level: earned from every conversation. Level 1–100, cubic curve.
 *
 * This module is intentionally pure (no imports, no I/O) so it can be shared by
 * Next.js server code, standalone `bun run` scripts, and the browser bundle
 * alike. Do not add `server-only`, Prisma, or fetch here.
 */

// --- Constants ---
export const EV_TOTAL_CAP = 510
export const EV_SINGLE_CAP = 252
export const MAX_LEVEL = 100
export const MIN_LEVEL = 1
export const BASE_XP_PER_MESSAGE = 10

export const SACRED_7_KEYS = [
  'wisdom',
  'charisma',
  'intuition',
  'analytical',
  'creativity',
  'empathy',
  'vitality',
] as const

export type Sacred7Key = (typeof SACRED_7_KEYS)[number]
export type EvolutionValues = Partial<Record<Sacred7Key, number>>

/**
 * The subset of `historical_agents` score columns needed to derive IVs.
 * Every field is optional/nullable because planetary + crafted agents may not
 * have the full Planetary 12 populated.
 */
export interface AgentScoreFields {
  wisdomScore?: number | null
  charismaScore?: number | null
  intuitionScore?: number | null
  adaptabilityScore?: number | null
  vitalityScore?: number | null
  venusianCoherence?: number | null
  neptunianResonance?: number | null
  lunarReceptivity?: number | null
  chironicAdaptation?: number | null
}

// --- IV Derivation ---
/**
 * Maps the existing Float score fields on `historical_agents` into a clean,
 * Sacred-7-keyed IV object. Deterministic — same agent always yields the same
 * IVs. `analytical` is the renamed `adaptabilityScore`; `creativity` and
 * `empathy` are blends of two Planetary 12 stats.
 */
export function deriveIVs(agent: AgentScoreFields): Record<Sacred7Key, number> {
  return {
    wisdom: agent.wisdomScore ?? 0,
    charisma: agent.charismaScore ?? 0,
    intuition: agent.intuitionScore ?? 0,
    analytical: agent.adaptabilityScore ?? 0,
    creativity: ((agent.venusianCoherence ?? 0) + (agent.neptunianResonance ?? 0)) / 2,
    empathy: ((agent.lunarReceptivity ?? 0) + (agent.chironicAdaptation ?? 0)) / 2,
    vitality: agent.vitalityScore ?? 0,
  }
}

// --- Level from XP ---
/**
 * Inverse of {@link xpForLevel}. Clamped to [MIN_LEVEL, MAX_LEVEL] so an agent
 * is never below level 1 even at 0 XP (the schema default level is 1).
 */
export function levelFromXp(xp: number): number {
  const raw = Math.floor(Math.cbrt(Math.max(0, xp) / 10))
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, raw))
}

/** XP threshold required to reach a given level. Level 100 = 10,000,000 XP. */
export function xpForLevel(level: number): number {
  return 10 * Math.pow(level, 3)
}

/**
 * Progress info for a UI XP bar. `progress` is 0–1 within the current level.
 * At MAX_LEVEL, progress is pinned to 1 and `nextLevelXp === currentLevelXp`.
 */
export function levelProgress(xp: number): {
  level: number
  currentLevelXp: number
  nextLevelXp: number
  xpIntoLevel: number
  xpForLevelSpan: number
  progress: number
} {
  const level = levelFromXp(xp)
  const currentLevelXp = xpForLevel(level)
  if (level >= MAX_LEVEL) {
    return {
      level,
      currentLevelXp,
      nextLevelXp: currentLevelXp,
      xpIntoLevel: 0,
      xpForLevelSpan: 0,
      progress: 1,
    }
  }
  const nextLevelXp = xpForLevel(level + 1)
  const xpForLevelSpan = nextLevelXp - currentLevelXp
  const xpIntoLevel = Math.max(0, xp - currentLevelXp)
  const progress = xpForLevelSpan > 0 ? Math.min(1, xpIntoLevel / xpForLevelSpan) : 0
  return { level, currentLevelXp, nextLevelXp, xpIntoLevel, xpForLevelSpan, progress }
}

// --- Effective Stat ---
/**
 * The battle-ready stat the UI surfaces: cosmic blueprint (IV) + earned
 * training (EV/4) + a flat per-level bonus.
 */
export function effectiveStat(iv: number, ev: number, level: number): number {
  return iv + ev / 4 + level * 0.5
}

/** Compute every effective Sacred 7 stat at once for a card/radar overlay. */
export function effectiveStats(
  ivs: Record<Sacred7Key, number>,
  evs: EvolutionValues,
  level: number
): Record<Sacred7Key, number> {
  const out = {} as Record<Sacred7Key, number>
  for (const key of SACRED_7_KEYS) {
    out[key] = effectiveStat(ivs[key] ?? 0, evs[key] ?? 0, level)
  }
  return out
}

// --- EV Award ---
/**
 * Given a training partner, determine which Sacred 7 stat is dominant and how
 * many EVs to award, respecting both the per-stat (252) and total (510) caps.
 * Returns the gain plus the new EV object/total so callers can persist them.
 */
export function calculateEvGain(
  partnerAgent: AgentScoreFields,
  currentEvs: EvolutionValues,
  currentEvTotal: number,
  evPerInteraction = 4
): { stat: Sacred7Key; gain: number; newEvs: EvolutionValues; newTotal: number } {
  const partnerIVs = deriveIVs(partnerAgent)

  // Dominant stat — first key wins ties (stable).
  const dominant = SACRED_7_KEYS.reduce(
    (best, key) => (partnerIVs[key] > partnerIVs[best] ? key : best),
    SACRED_7_KEYS[0]
  )

  const currentStatEv = currentEvs[dominant] ?? 0
  const roomInStat = EV_SINGLE_CAP - currentStatEv
  const roomInTotal = EV_TOTAL_CAP - currentEvTotal
  const actualGain = Math.max(0, Math.min(evPerInteraction, roomInStat, roomInTotal))

  if (actualGain <= 0) {
    return { stat: dominant, gain: 0, newEvs: currentEvs, newTotal: currentEvTotal }
  }

  const newEvs: EvolutionValues = { ...currentEvs, [dominant]: currentStatEv + actualGain }
  return { stat: dominant, gain: actualGain, newEvs, newTotal: currentEvTotal + actualGain }
}

// --- XP Award ---
/**
 * XP for a turn: base 10 per message, scaled by a quality multiplier
 * (response depth, length, etc.). Rounded to a whole number.
 */
export function calculateXpGain(messageCount = 1, qualityMultiplier = 1.0): number {
  return Math.round(
    BASE_XP_PER_MESSAGE * Math.max(0, messageCount) * Math.max(0, qualityMultiplier)
  )
}

/**
 * Normalize a value coming back from the `evolutionValues` JSON column (which
 * may be `null`, a string, or an object) into a clean {@link EvolutionValues}.
 */
export function normalizeEvs(raw: unknown): EvolutionValues {
  if (!raw) return {}
  let obj: any = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) return {}
  const out: EvolutionValues = {}
  for (const key of SACRED_7_KEYS) {
    const v = obj[key]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      out[key] = Math.min(EV_SINGLE_CAP, Math.round(v))
    }
  }
  return out
}

/** Sum of all EVs, clamped to the total cap. */
export function evTotal(evs: EvolutionValues): number {
  const sum = SACRED_7_KEYS.reduce((acc, key) => acc + (evs[key] ?? 0), 0)
  return Math.min(EV_TOTAL_CAP, sum)
}
