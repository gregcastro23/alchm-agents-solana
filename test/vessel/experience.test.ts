import { describe, expect, it } from 'bun:test'
import {
  applyExperienceEvent,
  createExperienceLedger,
  EXPERIENCE_POLICY,
  type ExperienceEvent,
  type ExperienceLedger,
  type ExperienceSubject,
} from '@/lib/vessel/experience'

const subject: ExperienceSubject = { kind: 'agent', id: 'historical:newton' }
const base = {
  subject,
  origin: 'agents.alchm.kitchen',
  eventId: 'completed-exchange:1',
  occurredAt: '2026-10-20T00:00:00.000Z',
  policyVersion: 1 as const,
}
const chat = (): ExperienceEvent => ({ ...base, kind: 'chat.completed' })
const training = (): ExperienceEvent => ({
  ...base,
  eventId: 'training-partition:1',
  kind: 'training.imported',
  manifest: {
    provenance: 'training-manifests/newton/partition-1.json',
    sha256: 'a'.repeat(64),
    conversationCount: 100,
    verification: 'verified',
    coverage: 'disjoint-from-live-and-other-imports',
  },
})
const game = (): Extract<ExperienceEvent, { kind: 'pentacles.settled' }> => ({
  ...base,
  origin: 'pentacles.alchm.kitchen',
  eventId: 'game-settlement:7',
  kind: 'pentacles.settled',
  gameId: '7',
  outcome: 'win',
  winningsEsms: [1, 2, 3, 4],
})
const applyUnknown = (ledger: ExperienceLedger, event: unknown) =>
  applyExperienceEvent(ledger, event as ExperienceEvent)

describe('permanent Vessel experience', () => {
  it('starts at observed zero XP with historical training unknown', () => {
    expect(createExperienceLedger(subject)).toMatchObject({
      totalXp: 0,
      trainingEvidence: { status: 'unknown', importedConversations: null },
      receipts: {},
    })
  })

  it('accumulates each qualified source without mutating earlier state or inputs', () => {
    const initial = createExperienceLedger(subject)
    const events: ExperienceEvent[] = [
      chat(),
      training(),
      { ...base, kind: 'action.qualified', eventId: 'recipe:1', action: 'recipe.created' },
      {
        ...base,
        kind: 'achievement.earned',
        eventId: 'achievement:1',
        achievementId: 'first-recipe',
      },
      game(),
    ]
    let ledger = initial
    for (const event of events) {
      const next = applyExperienceEvent(ledger, event)
      expect(next.totalXp).toBeGreaterThan(ledger.totalXp)
      expect(next.subject).toEqual(subject)
      ledger = next
    }
    expect(ledger.categoryXp).toEqual({
      chat: 15,
      training: 2500,
      actions: 10,
      achievements: 120,
      pentacles: 92,
    })
    expect(ledger.totalXp).toBe(2737)
    expect(initial.totalXp).toBe(0)
    expect(initial.receipts).toEqual({})
    events[0].subject.id = 'changed-after-call'
    expect(ledger.subject.id).toBe('historical:newton')
    expect(Object.values(ledger.receipts)[0].event.subject.id).toBe('historical:newton')
    events[0].subject.id = subject.id = 'historical:newton'
  })

  it('counts identical retry and mirrored delivery only once despite property order', () => {
    const first = applyExperienceEvent(createExperienceLedger(subject), chat())
    const reordered = Object.fromEntries(Object.entries(chat()).reverse())
    expect(applyUnknown(first, reordered)).toBe(first)
    expect(Object.keys(first.receipts)).toHaveLength(1)
    expect(first.totalXp).toBe(EXPERIENCE_POLICY.completedChat)
  })

  it('rejects conflicting metadata and policy retry without awarding again', () => {
    const first = applyExperienceEvent(createExperienceLedger(subject), chat())
    expect(() =>
      applyExperienceEvent(first, { ...chat(), occurredAt: '2026-10-20T01:00:00.000Z' })
    ).toThrow('Conflicting')
    expect(() => applyUnknown(first, { ...chat(), policyVersion: 2 })).toThrow()
    expect(Object.keys(first.receipts)[0]).toBe(
      JSON.stringify(['agent', subject.id, base.origin, base.eventId])
    )
    expect(first.totalXp).toBe(EXPERIENCE_POLICY.completedChat)
  })

  it('rejects duplicate settlements and achievements even with fresh delivery IDs', () => {
    const events: ExperienceEvent[] = [
      game(),
      {
        ...base,
        kind: 'achievement.earned',
        achievementId: 'first-recipe',
      },
    ]
    for (const event of events) {
      const first = applyExperienceEvent(createExperienceLedger(subject), event)
      expect(() => applyExperienceEvent(first, { ...event, eventId: 'retry:new-id' })).toThrow(
        'Outcome already credited'
      )
      expect(Object.keys(first.receipts)).toHaveLength(1)
    }
  })

  it('isolates subjects while permitting one shared event to credit each participant', () => {
    const player: ExperienceSubject = { kind: 'user', id: subject.id }
    const agentLedger = applyExperienceEvent(createExperienceLedger(subject), chat())
    const userLedger = applyExperienceEvent(createExperienceLedger(player), {
      ...chat(),
      subject: player,
    })
    expect(agentLedger.totalXp).toBe(userLedger.totalXp)
    expect(Object.keys(agentLedger.receipts)).not.toEqual(Object.keys(userLedger.receipts))
    expect(() => applyExperienceEvent(agentLedger, { ...chat(), subject: player })).toThrow(
      'different subject'
    )
  })

  it('requires verified import evidence and distinguishes verified zero from unknown', () => {
    const initial = createExperienceLedger(subject)
    const imported = training() as Extract<ExperienceEvent, { kind: 'training.imported' }>
    for (const manifest of [
      { ...imported.manifest, conversationCount: null },
      { ...imported.manifest, verification: 'unknown' },
      { ...imported.manifest, provenance: '' },
      { ...imported.manifest, sha256: 'unverified' },
      { ...imported.manifest, coverage: 'may-overlap' },
    ]) {
      expect(() => applyUnknown(initial, { ...imported, manifest })).toThrow()
    }
    expect(initial.trainingEvidence.status).toBe('unknown')
    const observedEmpty = applyExperienceEvent(initial, {
      ...imported,
      manifest: { ...imported.manifest, conversationCount: 0 },
    })
    expect(observedEmpty.totalXp).toBe(0)
    expect(observedEmpty.trainingEvidence).toEqual({
      status: 'verified-manifests',
      importedConversations: 0,
    })
  })

  it('rejects the same manifest sent with another ID or through another origin', () => {
    const imported = training()
    const ledger = applyExperienceEvent(createExperienceLedger(subject), imported)
    expect(() =>
      applyExperienceEvent(ledger, {
        ...imported,
        origin: 'kitchen.alchm.kitchen',
        eventId: 'mirrored-import',
      })
    ).toThrow('already imported')
    expect(ledger.trainingEvidence.importedConversations).toBe(100)
  })

  it('awards participation for losses and draws without debiting stakes or XP', () => {
    for (const outcome of ['loss', 'draw'] as const) {
      const ledger = applyExperienceEvent(createExperienceLedger(subject), {
        ...game(),
        outcome,
        winningsEsms: [0, 0, 0, 0],
      })
      expect(ledger.totalXp).toBe(EXPERIENCE_POLICY.settledParticipation)
    }
    const ledger = applyExperienceEvent(createExperienceLedger(subject), game())
    expect(() =>
      applyUnknown(ledger, {
        ...game(),
        eventId: 'spend:1',
        kind: 'tokens.spent',
        winningsEsms: [-10, 0, 0, 0],
      })
    ).toThrow()
    expect(ledger.totalXp).toBe(92)
  })

  it('gives a bounded logarithmic bonus for normalized winnings, including fractions', () => {
    const winnings = [0, 0.25, 1, 10, 100, 1000, 1_000_000]
    const awards = winnings.map(
      amount =>
        applyExperienceEvent(createExperienceLedger(subject), {
          ...game(),
          winningsEsms: [amount, 0, 0, 0],
        }).totalXp
    )
    expect(awards).toEqual([...awards].sort((a, b) => a - b))
    expect(awards[0]).toBe(75)
    expect(awards[1]).toBe(76)
    expect(awards.at(-1)).toBe(75 + EXPERIENCE_POLICY.maximumWinningsBonus)
  })

  it('rejects nonfinite, negative and unsafe winnings and fractional conversation counts', () => {
    const ledger = createExperienceLedger(subject)
    for (const amount of [NaN, Infinity, -Infinity, -1, Number.MAX_SAFE_INTEGER + 1, '10']) {
      expect(() => applyUnknown(ledger, { ...game(), winningsEsms: [amount, 0, 0, 0] })).toThrow()
    }
    expect(() =>
      applyExperienceEvent(ledger, {
        ...game(),
        winningsEsms: [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0, 0],
      })
    ).toThrow('safe ESMS')
    const imported = training() as Extract<ExperienceEvent, { kind: 'training.imported' }>
    for (const conversationCount of [-1, NaN, Infinity, 1.2, Number.MAX_SAFE_INTEGER]) {
      expect(() =>
        applyUnknown(ledger, {
          ...imported,
          manifest: { ...imported.manifest, conversationCount },
        })
      ).toThrow()
    }
    expect(ledger.totalXp).toBe(0)
  })

  it('rejects arbitrary caller XP, balances, empty IDs and malformed timestamps', () => {
    const ledger = createExperienceLedger(subject)
    for (const event of [
      { ...chat(), xp: 1_000_000 },
      { ...chat(), totalXp: 1_000_000 },
      { ...game(), balances: [100, 100, 100, 100] },
      { ...chat(), eventId: '' },
      { ...chat(), origin: ' Agents.Alchm.Kitchen ' },
      { ...chat(), occurredAt: '2026-02-30' },
      { ...chat(), occurredAt: 'yesterday' },
      { ...chat(), subject: { ...subject, id: ' ' } },
    ]) {
      expect(() => applyUnknown(ledger, event)).toThrow()
    }
  })

  it('fails on aggregate overflow instead of rounding, resetting or decreasing XP', () => {
    const full: ExperienceLedger = {
      ...createExperienceLedger(subject),
      totalXp: Number.MAX_SAFE_INTEGER,
      categoryXp: {
        chat: Number.MAX_SAFE_INTEGER,
        training: 0,
        actions: 0,
        achievements: 0,
        pentacles: 0,
      },
    }
    expect(() => applyExperienceEvent(full, chat())).toThrow('safe integers')
    expect(full.totalXp).toBe(Number.MAX_SAFE_INTEGER)
    expect(() => applyExperienceEvent({ ...full, totalXp: 1 }, chat())).toThrow('do not match')
  })
})
