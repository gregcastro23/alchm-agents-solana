/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
} from '@/lib/agents/council/daily-council-types'

vi.mock('@/lib/agents/persona/voiced-generation', () => ({ generateStructuredVoice: vi.fn() }))
const generate = vi.mocked(generateStructuredVoice)
beforeEach(() => {
  generate.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('daily editorial review', () => {
  it('requires an affirmative semantic review before accepting model dialogue', async () => {
    generate.mockResolvedValue({ source: 'model', object: { acceptable: true, issues: [] } })
    expect(await reviewDailyDialogue({} as DailySkyBrief, [], Date.now() + 1000)).toBe(true)
    generate.mockResolvedValue({
      source: 'model',
      object: {
        acceptable: false,
        issues: [
          {
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
        issues: [{ turnId: 'second', reason: 'Unsupported statement.' }],
      },
    })
    expect(await reviewDailyDialogue({} as DailySkyBrief, [], Date.now() + 1000)).toBe(false)
    generate.mockClear()
    expect(await reviewDailyDialogue({} as DailySkyBrief, [], Date.now() - 1)).toBe(false)
    expect(generate).not.toHaveBeenCalled()
  })
  it('rejects an editor referring to an unknown turn or rejecting without an actionable issue', async () => {
    for (const issues of [[], [{ turnId: 'invented', reason: 'Unsupported statement.' }]]) {
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
