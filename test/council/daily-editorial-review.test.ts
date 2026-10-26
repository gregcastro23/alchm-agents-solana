/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { asSchema } from 'ai'
import {
  inspectDailyDialogue,
  reviewDailyDialogue,
} from '@/lib/agents/council/daily-edition-review'
import { rankDailyAspects } from '@/lib/agents/council/aspect-salience'
import { generateStructuredVoice } from '@/lib/agents/persona/voiced-generation'
import type {
  DailySkyAspect,
  DailySkyBrief,
  DailySkyEvent,
  DailyCouncilTurn,
} from '@/lib/agents/council/daily-council-types'

vi.mock('@/lib/agents/persona/voiced-generation', () => ({ generateStructuredVoice: vi.fn() }))
const generate = vi.mocked(generateStructuredVoice)
beforeEach(() => {
  generate.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('daily editorial review', () => {
  const turn = {
    id: 'full-versioned-edition:2026-10-05:beat-1',
    speakerKey: 'gregory',
    speakerName: 'Gregory Castro',
    text: 'An educational opening.',
    newClaim: 'A distinct contribution.',
    coverageIds: ['placement-sun'],
    provenance: { source: 'model' },
  } as DailyCouncilTurn

  it('maps constrained short review IDs back to the exact published turn', async () => {
    generate.mockResolvedValue({
      source: 'model',
      object: {
        acceptable: false,
        issues: [
          {
            kind: 'conversation',
            turnId: 'turn-1',
            reason: 'Explain the current Sun sign before synthesizing.',
          },
        ],
      },
    })
    const verdict = await inspectDailyDialogue({} as DailySkyBrief, [turn], Date.now() + 1000)
    expect(verdict).toEqual({
      status: 'reviewed',
      acceptable: false,
      issues: [{ turnId: turn.id, reason: 'Explain the current Sun sign before synthesizing.' }],
    })
    const [schema, options] = generate.mock.calls[0]
    expect(JSON.parse(options.prompt).dialogue[0].id).toBe('turn-1')
    expect(
      schema.safeParse({
        acceptable: false,
        issues: [{ kind: 'conversation', turnId: 'beat-1', reason: 'Wrong ID.' }],
      }).success
    ).toBe(false)
  })

  it('identifies exact roles in a mixed edition without moving closing duties to the last model host', async () => {
    const mixedTurns: DailyCouncilTurn[] = [
      turn,
      { ...turn, id: 'moon-model', speakerKey: 'moon', speakerName: 'Moon' },
      { ...turn, id: 'host-integration' },
      {
        ...turn,
        id: 'venus-backup',
        speakerKey: 'venus',
        speakerName: 'Venus',
        provenance: { source: 'grounded_briefing' },
      },
      { ...turn, id: 'host-backup-closing', provenance: { source: 'grounded_briefing' } },
    ]
    generate.mockResolvedValue({ source: 'model', object: { acceptable: true, issues: [] } })
    await inspectDailyDialogue({} as DailySkyBrief, mixedTurns, Date.now() + 1000)
    const options = generate.mock.calls[0][1]
    const input = JSON.parse(options.prompt)
    expect(input.dialogue.map((entry: { role: string }) => entry.role)).toEqual([
      'opening',
      'planetary-reading',
      'integration',
      'planetary-reading',
      'closing',
    ])
    expect(input.conversationEligibleTurnIds).toEqual(['turn-1', 'turn-2', 'turn-3'])
    expect(options.systemPrompt).toContain('only to its explicit role')
    expect(options.systemPrompt).toContain('approximate sky snapshot')
    expect(options.systemPrompt).toContain('Never transfer closing duties')
  })

  it('rejects oversized editorial reasons without silently truncating a correction', async () => {
    generate.mockResolvedValue({
      source: 'model',
      object: {
        acceptable: false,
        issues: [{ kind: 'conversation', turnId: 'turn-1', reason: 'x'.repeat(301) }],
      },
    })
    expect(
      (await inspectDailyDialogue({} as DailySkyBrief, [turn], Date.now() + 1000)).status
    ).toBe('invalid')
  })

  it('limits conversation defects to model turns while checking every source for factual and coverage defects', async () => {
    const backup = {
      ...turn,
      id: 'exact-backup-turn',
      provenance: { source: 'grounded_briefing' },
    } as DailyCouncilTurn
    generate.mockResolvedValue({ source: 'model', object: { acceptable: true, issues: [] } })
    await inspectDailyDialogue({} as DailySkyBrief, [turn, backup], Date.now() + 1000)
    const [schema, options] = generate.mock.calls[0]
    expect(JSON.parse(options.prompt).conversationEligibleTurnIds).toEqual(['turn-1'])
    expect(JSON.parse(options.prompt).dialogue.map((entry: { id: string }) => entry.id)).toEqual([
      'turn-1',
      'turn-2',
    ])
    for (const kind of ['factual', 'coverage']) {
      const object = {
        acceptable: false,
        issues: [
          { kind, turnId: 'turn-2', reason: 'Correct the supplied sky fact or missing topic.' },
        ],
      }
      expect(schema.safeParse(object).success).toBe(true)
      generate.mockResolvedValue({ source: 'model', object })
      expect(
        await inspectDailyDialogue({} as DailySkyBrief, [turn, backup], Date.now() + 1000)
      ).toMatchObject({ status: 'reviewed', issues: [{ turnId: backup.id }] })
    }
    const styleDefect = {
      acceptable: false,
      issues: [
        { kind: 'conversation', turnId: 'turn-2', reason: 'Make the backup voice livelier.' },
      ],
    }
    expect(schema.safeParse(styleDefect).success).toBe(false)
    generate.mockResolvedValue({ source: 'model', object: styleDefect })
    expect(
      (await inspectDailyDialogue({} as DailySkyBrief, [turn, backup], Date.now() + 1000)).status
    ).toBe('invalid')

    const jsonSchema = asSchema(schema).jsonSchema as {
      properties: {
        issues: {
          items: {
            anyOf: Array<{
              properties: { kind: { const: string }; turnId: { enum: string[] } }
            }>
          }
        }
      }
    }
    const choices = jsonSchema.properties.issues.items.anyOf
    expect(choices).toHaveLength(3)
    for (const choice of choices) {
      const kind = choice.properties.kind.const
      expect(choice.properties.turnId.enum).toEqual(
        kind === 'conversation' ? ['turn-1'] : ['turn-1', 'turn-2']
      )
    }
  })

  it('rejects duplicate or out-of-order defects and more than four defective turns', async () => {
    const turns = Array.from({ length: 5 }, (_, index) => ({ ...turn, id: `canonical-${index}` }))
    for (const ids of [
      ['turn-2', 'turn-1'],
      ['turn-1', 'turn-1'],
      ['turn-1', 'turn-2', 'turn-3', 'turn-4', 'turn-5'],
    ]) {
      generate.mockResolvedValue({
        source: 'model',
        object: {
          acceptable: false,
          issues: ids.map(turnId => ({
            kind: 'conversation',
            turnId,
            reason: 'Add new teaching.',
          })),
        },
      })
      expect(
        (await inspectDailyDialogue({} as DailySkyBrief, turns, Date.now() + 1000)).status
      ).toBe('invalid')
    }
  })

  it('requires an affirmative semantic review before accepting model dialogue', async () => {
    generate.mockResolvedValue({ source: 'model', object: { acceptable: true, issues: [] } })
    expect(await reviewDailyDialogue({} as DailySkyBrief, [], Date.now() + 1000)).toBe(true)
    generate.mockResolvedValue({
      source: 'model',
      object: {
        acceptable: false,
        issues: [
          {
            kind: 'conversation',
            turnId: 'second',
            reason: 'Repeats the earlier claim in different words without a new contribution.',
          },
        ],
      },
    })
    expect(await reviewDailyDialogue({} as DailySkyBrief, [], Date.now() + 1000)).toBe(false)
    expect(generate.mock.calls[0][1].systemPrompt).toContain('paraphrased repetitions')
  })
  it('fails closed on missing reviews, malformed judgments, or an expired budget', async () => {
    generate.mockResolvedValue({ source: 'grounded_briefing', object: null })
    expect(await reviewDailyDialogue({} as DailySkyBrief, [], Date.now() + 1000)).toBe(false)
    generate.mockResolvedValue({
      source: 'model',
      object: {
        acceptable: true,
        issues: [{ kind: 'factual', turnId: 'second', reason: 'Unsupported statement.' }],
      },
    })
    expect(await reviewDailyDialogue({} as DailySkyBrief, [], Date.now() + 1000)).toBe(false)
    generate.mockClear()
    expect(await reviewDailyDialogue({} as DailySkyBrief, [], Date.now() - 1)).toBe(false)
    expect(generate).not.toHaveBeenCalled()
  })
  it('rejects an editor referring to an unknown turn or rejecting without an actionable issue', async () => {
    for (const issues of [
      [],
      [{ kind: 'factual', turnId: 'invented', reason: 'Unsupported statement.' }],
    ]) {
      generate.mockResolvedValue({ source: 'model', object: { acceptable: false, issues } })
      expect((await inspectDailyDialogue({} as DailySkyBrief, [], Date.now() + 1000)).status).toBe(
        'invalid'
      )
    }
  })
  it('aborts an unresponsive editor when its allotted time expires', async () => {
    vi.useFakeTimers()
    generate.mockImplementation(() => new Promise(() => {}))
    const pending = inspectDailyDialogue({} as DailySkyBrief, [], Date.now() + 200)
    await vi.advanceTimersByTimeAsync(200)
    expect(await pending).toEqual({ status: 'unavailable', acceptable: false, issues: [] })
    expect(generate.mock.calls[0][1].abortSignal?.aborted).toBe(true)
  })
  it('ranks daily motion and verified perfections ahead of an orb-only slow backdrop', () => {
    const background: DailySkyAspect = {
      bodyA: 'neptune',
      bodyB: 'pluto',
      aspectName: 'Sextile',
      orb: 0.01,
      angle: 60,
      phase: 'separating',
      quality: 'harmonious',
      major: true,
    }
    const lunar: DailySkyAspect = {
      ...background,
      bodyA: 'moon',
      bodyB: 'mars',
      orb: 1.5,
      phase: 'applying',
    }
    expect(rankDailyAspects([background, lunar])[0]).toBe(lunar)
    const event: DailySkyEvent = {
      id: 'event',
      type: 'aspect_exact',
      at: '2026-10-02T18:00:00Z',
      bodies: ['neptune', 'pluto'],
      description: 'Neptune sextile Pluto perfects',
      evidenceId: 'event',
    }
    expect(rankDailyAspects([lunar, background], [event])[0]).toBe(background)
  })
})
