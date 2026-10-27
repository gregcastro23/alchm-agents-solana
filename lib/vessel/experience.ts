import { z } from 'zod'

/**
 * Metadata-only experience receipts. This reducer does not authenticate a source,
 * verify an achievement, or prove that an imported conversation was trained on.
 * A trusted server adapter must do that before calling it, and persist the ledger
 * atomically. Transport mirrors must preserve the original origin and eventId.
 */
export const EXPERIENCE_POLICY_VERSION = 1 as const

/** Game tuning. Changing these weights requires a new policy version. */
export const EXPERIENCE_POLICY = Object.freeze({
  version: EXPERIENCE_POLICY_VERSION,
  completedChat: 15,
  importedConversation: 25,
  qualifiedAction: 10,
  earnedAchievement: 120,
  settledParticipation: 10,
  settledWin: 65,
  winningsLogFactor: 5,
  maximumWinningsBonus: 40,
})

const identifier = z
  .string()
  .min(1)
  .max(512)
  .refine(
    value => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value),
    'Identifiers must be canonical, nonempty and contain no control characters'
  )
const subjectSchema = z
  .object({
    kind: z.enum(['agent', 'user']),
    id: identifier,
  })
  .strict()
const safeCount = z.number().finite().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const timestamp = z.string().refine(value => {
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value
}, 'occurredAt must be a canonical UTC ISO timestamp')
const eventBase = {
  subject: subjectSchema,
  /** Authoritative source namespace, not the site forwarding a mirror. */
  origin: z.string().regex(/^[a-z0-9][a-z0-9.-]{0,127}$/),
  eventId: identifier,
  occurredAt: timestamp,
  policyVersion: z.literal(EXPERIENCE_POLICY_VERSION),
}
const esmsAmount = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER)
const eventSchema = z.discriminatedUnion('kind', [
  z.object({ ...eventBase, kind: z.literal('chat.completed') }).strict(),
  z
    .object({
      ...eventBase,
      kind: z.literal('training.imported'),
      manifest: z
        .object({
          /** Stable evidence reference; no corpus or chat text is stored here. */
          provenance: identifier,
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          conversationCount: safeCount,
          verification: z.literal('verified'),
          /**
           * The importing adapter must prove this partition excludes every prior
           * import and every chat receipt, including future replay of old chats.
           * A digest alone cannot establish non-overlap between different corpora.
           */
          coverage: z.literal('disjoint-from-live-and-other-imports'),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...eventBase,
      kind: z.literal('action.qualified'),
      /** A completed action the authoritative server has qualified for XP. */
      action: identifier,
    })
    .strict(),
  z
    .object({
      ...eventBase,
      kind: z.literal('achievement.earned'),
      achievementId: identifier,
    })
    .strict(),
  z
    .object({
      ...eventBase,
      kind: z.literal('pentacles.settled'),
      gameId: identifier,
      outcome: z.enum(['win', 'loss', 'draw']),
      /**
       * Settled positive winnings in normalized ESMS:
       * [Spirit, Essence, Matter, Substance]. Not atoms, game-pool units, wallet
       * balances, stake returns or net profit/loss. Normalize before calling.
       */
      winningsEsms: z.tuple([esmsAmount, esmsAmount, esmsAmount, esmsAmount]),
    })
    .strict(),
])

export type ExperienceSubject = z.infer<typeof subjectSchema>
export type ExperienceEvent = z.infer<typeof eventSchema>
export type ExperienceCategory = 'chat' | 'training' | 'actions' | 'achievements' | 'pentacles'

export interface ExperienceReceipt {
  readonly event: ExperienceEvent
  readonly category: ExperienceCategory
  readonly awardedXp: number
}

export interface ExperienceLedger {
  readonly version: 1
  readonly subject: ExperienceSubject
  /** Permanent earned XP, independent of sky, balances and token spending. */
  readonly totalXp: number
  readonly categoryXp: Readonly<Record<ExperienceCategory, number>>
  readonly trainingEvidence: {
    /**
     * Verified manifests establish only the imported partitions. They do not
     * claim that the subject's entire training history has been recovered.
     */
    readonly status: 'unknown' | 'verified-manifests'
    readonly importedConversations: number | null
  }
  readonly receipts: Readonly<Record<string, ExperienceReceipt>>
}

export function createExperienceLedger(subject: ExperienceSubject): ExperienceLedger {
  return {
    version: 1,
    subject: subjectSchema.parse(subject),
    totalXp: 0,
    categoryXp: { chat: 0, training: 0, actions: 0, achievements: 0, pentacles: 0 },
    trainingEvidence: { status: 'unknown', importedConversations: null },
    receipts: {},
  }
}

function safeAdd(a: number, b: number): number {
  const result = a + b
  if (
    !Number.isSafeInteger(a) ||
    a < 0 ||
    !Number.isSafeInteger(b) ||
    b < 0 ||
    !Number.isSafeInteger(result)
  ) {
    throw new RangeError('Experience totals must remain nonnegative safe integers')
  }
  return result
}

function award(event: ExperienceEvent): { category: ExperienceCategory; xp: number } {
  switch (event.kind) {
    case 'chat.completed':
      return { category: 'chat', xp: EXPERIENCE_POLICY.completedChat }
    case 'training.imported':
      return {
        category: 'training',
        xp: safeAdd(0, event.manifest.conversationCount * EXPERIENCE_POLICY.importedConversation),
      }
    case 'action.qualified':
      return { category: 'actions', xp: EXPERIENCE_POLICY.qualifiedAction }
    case 'achievement.earned':
      return { category: 'achievements', xp: EXPERIENCE_POLICY.earnedAchievement }
    case 'pentacles.settled': {
      const winnings = event.winningsEsms.reduce((sum, amount) => sum + amount, 0)
      if (!Number.isFinite(winnings) || winnings > Number.MAX_SAFE_INTEGER) {
        throw new RangeError('Normalized winnings exceed the safe ESMS range')
      }
      const winningsBonus = Math.min(
        EXPERIENCE_POLICY.maximumWinningsBonus,
        Math.floor(EXPERIENCE_POLICY.winningsLogFactor * Math.log2(1 + winnings))
      )
      return {
        category: 'pentacles',
        xp:
          EXPERIENCE_POLICY.settledParticipation +
          (event.outcome === 'win' ? EXPERIENCE_POLICY.settledWin : 0) +
          winningsBonus,
      }
    }
  }
}

/**
 * Deterministic, immutable reducer. Inputs contain evidence metadata, never XP.
 * A canonical source event may credit each participating subject once. The key
 * intentionally excludes policy version: repricing must not re-award an event.
 * Changed metadata on an existing key is an error, not a second award.
 */
export function applyExperienceEvent(
  ledger: ExperienceLedger,
  input: ExperienceEvent
): ExperienceLedger {
  const event = eventSchema.parse(input)
  const subject = subjectSchema.parse(ledger.subject)
  if (ledger.version !== 1) throw new Error('Unsupported experience ledger version')
  if (event.subject.kind !== subject.kind || event.subject.id !== subject.id) {
    throw new Error('Experience event belongs to a different subject')
  }
  const categories: ExperienceCategory[] = [
    'chat',
    'training',
    'actions',
    'achievements',
    'pentacles',
  ]
  const recordedTotal = categories.reduce(
    (sum, category) => safeAdd(sum, ledger.categoryXp[category]),
    0
  )
  if (safeAdd(0, ledger.totalXp) !== recordedTotal) {
    throw new Error('Experience category totals do not match the ledger total')
  }
  const evidence = ledger.trainingEvidence
  if (
    evidence.status === 'unknown'
      ? evidence.importedConversations !== null
      : evidence.status !== 'verified-manifests' || evidence.importedConversations === null
  ) {
    throw new Error('Invalid training evidence state')
  }
  if (evidence.importedConversations !== null) safeAdd(0, evidence.importedConversations)

  const key = JSON.stringify([subject.kind, subject.id, event.origin, event.eventId])
  const existing = ledger.receipts[key]
  if (existing) {
    // Zod rebuilds fields in schema order, so caller property order is irrelevant.
    if (JSON.stringify(eventSchema.parse(existing.event)) !== JSON.stringify(event)) {
      throw new Error('Conflicting experience event retry')
    }
    return ledger
  }
  if (
    event.kind === 'training.imported' &&
    Object.values(ledger.receipts).some(
      receipt =>
        receipt.event.kind === 'training.imported' &&
        receipt.event.manifest.sha256 === event.manifest.sha256
    )
  ) {
    throw new Error('Training manifest was already imported for this subject')
  }
  // A producer may retry under a new delivery ID; the business outcome is still unique.
  const sameOutcome = Object.values(ledger.receipts).some(
    ({ event: previous }) =>
      previous.origin === event.origin &&
      ((event.kind === 'achievement.earned' &&
        previous.kind === 'achievement.earned' &&
        event.achievementId === previous.achievementId) ||
        (event.kind === 'pentacles.settled' &&
          previous.kind === 'pentacles.settled' &&
          event.gameId === previous.gameId))
  )
  if (sameOutcome) throw new Error('Outcome already credited for this subject')
  const { category, xp } = award(event)
  const totalXp = safeAdd(ledger.totalXp, xp)
  return {
    version: 1,
    subject,
    totalXp,
    categoryXp: { ...ledger.categoryXp, [category]: safeAdd(ledger.categoryXp[category], xp) },
    trainingEvidence:
      event.kind === 'training.imported'
        ? {
            status: 'verified-manifests',
            importedConversations: safeAdd(
              evidence.importedConversations ?? 0,
              event.manifest.conversationCount
            ),
          }
        : { ...evidence },
    receipts: { ...ledger.receipts, [key]: { event, category, awardedXp: xp } },
  }
}
