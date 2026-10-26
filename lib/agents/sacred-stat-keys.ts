/** Shared stat vocabulary, independent of presentation fixtures and appearance data. */
export const SACRED_STAT_KEYS = [
  'power',
  'resonance',
  'wisdom',
  'charisma',
  'intuition',
  'adaptability',
  'vitality',
] as const

export type SacredStatKey = (typeof SACRED_STAT_KEYS)[number]
