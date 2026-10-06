/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDailySkyBrief } from '@/lib/agents/council/daily-sky'
import { COUNCIL_PLANETS } from '@/lib/agents/council/daily-council-types'
import { buildServerCouncilContext } from '@/lib/agents/council/council-context'
import { directSeekerExchange } from '@/lib/agents/council/conversation-director'
import { dispatchTurn } from '@/lib/agents/council/council-chamber'
import { generateStructuredVoice } from '@/lib/agents/persona/voiced-generation'

vi.mock('@/lib/agents/persona/voiced-generation', () => ({ generateStructuredVoice: vi.fn() }))
const generator = vi.mocked(generateStructuredVoice)
const observed = '2026-10-02T00:00:00.000Z'
const checked = '2026-10-02T12:00:00.000Z'
const question = 'What phase is the Moon, and what time does it enter Virgo?'
function fixture(approximate = false) {
  const positions = Object.fromEntries(
    COUNCIL_PLANETS.map((body, index) => [
      body,
      { longitude: 15 + index * 33, speed: approximate ? undefined : index > 6 ? -0.1 : 1 },
    ])
  )
  positions.Moon = { longitude: 149, speed: approximate ? undefined : 12 }
  return buildDailySkyBrief({
    date: new Date(observed),
    source: approximate ? 'vsop87-approximation' : 'swiss-ephemeris',
    eventScanComplete: !approximate,
    positions,
    events: approximate
      ? []
      : [
          {
            id: 'moon-virgo-ingress',
            evidenceId: 'moon-virgo-ingress',
            type: 'sign_ingress',
            at: '2026-10-02T02:00:00.000Z',
            bodies: ['moon'],
            description: 'Moon enters Virgo',
          },
        ],
  })
}
beforeEach(() => {
  generator.mockReset()
})
afterEach(() => vi.useRealTimers())

function modelAnswer(brief = fixture()) {
  const ctx = buildServerCouncilContext({
    dailySkyBrief: brief,
    seekerInquiry: question,
    answerTime: checked,
  })
  return {
    source: 'model' as const,
    modelFamily: 'substantive' as const,
    object: {
      text: `At the 2026-10-02 opening snapshot, the Moon phase was ${brief.lunar.phase}. Moon enters Virgo at 02:00 UTC; that recorded time has passed. Events beyond 2026-10-03 at 00:00 UTC are outside this edition. You might use that distinction to reflect on how expression and practical care support each other.`,
      newClaim:
        'The opening lunar state and the later verified ingress describe different moments.',
      usedEvidenceIds: directSeekerExchange(ctx, question)[0].evidence.map(item => item.id),
    },
  }
}

describe('immutable daily facts in private questions', () => {
  it('uses the whole saved brief and ignores competing position/as-of inputs', () => {
    const brief = fixture()
    const ctx = buildServerCouncilContext({
      dailySkyBrief: brief,
      positions: fixture(true).positions,
      date: new Date('2027-01-01T00:00:00Z'),
      answerTime: checked,
    })
    expect(ctx.dailySkyBrief).toBe(brief)
    expect(ctx.timestamp).toBe(observed)
    expect(ctx.answerTime).toBe(checked)
    expect(ctx.sky.moon.absoluteDegree).toBe(brief.positions.Moon.longitude)
    expect(ctx.aspects).toEqual(brief.aspects)
    const directive = directSeekerExchange({ ...ctx, seekerInquiry: question }, question)[0]
    expect(directive.speakerKey).toBe('moon')
    expect(directive.requiredEvidenceIds).toContain('lunar-state')
    expect(directive.requiredEvidenceIds).toContain('moon-virgo-ingress')
  })

  it('preserves approximate exact-aspect uncertainty in both full-brief and legacy contexts', () => {
    const positions = fixture(true).positions
    positions.Sun = { ...positions.Sun, longitude: 0, degree: 0, sign: 'Aries' }
    positions.Moon = { ...positions.Moon, longitude: 60, degree: 0, sign: 'Gemini' }
    const brief = buildDailySkyBrief({
      date: new Date(observed),
      source: 'vsop87-approximation',
      positions,
    })
    for (const ctx of [
      buildServerCouncilContext({ dailySkyBrief: brief }),
      buildServerCouncilContext({ positions: brief.positions }),
    ]) {
      expect(
        ctx.aspects.find(aspect => aspect.bodyA === 'sun' && aspect.bodyB === 'moon')?.phase
      ).toBe('unknown')
    }
  })

  it('answers phase and verified timing during a provider outage, labeling elapsed events and the horizon', async () => {
    const brief = fixture()
    const response = await dispatchTurn({
      seekerInquiry: question,
      dailySkyBrief: brief,
      answerTime: checked,
      deadlineMs: Date.now() - 1,
    })
    expect(generator).not.toHaveBeenCalled()
    expect(response.provenance?.source).toBe('grounded_briefing')
    expect(response.text).toContain(brief.lunar.phase)
    expect(response.text).toContain('Moon enters Virgo at 2026-10-02T02:00:00.000Z')
    expect(response.text).toContain('its scheduled time has passed')
    expect(response.text).toContain('Events beyond 2026-10-03T00:00:00.000Z')
    expect(response.text).toContain(`Edition observation: ${observed}`)
    expect(response.usedEvidenceIds).toContain('moon-virgo-ingress')
    expect(response.text).not.toContain('For your question, consider one small')
  })

  it('labels future events as upcoming and keeps unverified event times unavailable', async () => {
    const upcoming = await dispatchTurn({
      seekerInquiry: question,
      dailySkyBrief: fixture(),
      answerTime: '2026-10-02T01:00:00.000Z',
      deadlineMs: Date.now() - 1,
    })
    expect(upcoming.text).toContain('upcoming as of 2026-10-02T01:00:00.000Z')
    const unknown = await dispatchTurn({
      seekerInquiry: question,
      dailySkyBrief: fixture(true),
      answerTime: checked,
      deadlineMs: Date.now() - 1,
    })
    expect(unknown.text).toContain('No upcoming timed change is verified')
    expect(unknown.text).toContain('Exact event times and station claims are withheld')
    expect(unknown.text).not.toContain('Moon enters Virgo at')
  })

  it.each(['missing answer', 'wrong UTC time', 'invented ISO time'])(
    'rejects %s even when evidence IDs are valid',
    async defect => {
      const brief = fixture()
      const ctx = buildServerCouncilContext({
        dailySkyBrief: brief,
        seekerInquiry: question,
        answerTime: checked,
      })
      const ids = directSeekerExchange(ctx, question)[0].evidence.map(item => item.id)
      generator.mockResolvedValue({
        source: 'model',
        modelFamily: 'substantive',
        object: {
          text:
            defect === 'missing answer'
              ? 'Moon in Leo brings creative attention to emotional life. You can reflect on how generosity helps you express a feeling with clarity and warmth.'
              : `At the opening observation the Moon phase was ${brief.lunar.phase}. Moon enters Virgo at ${defect === 'wrong UTC time' ? '18:00 UTC' : '2026-10-02T18:00:00.000Z'}. This invites reflection without determining what you will experience.`,
          newClaim: 'The lunar facts offer context for reflection without guaranteeing an outcome.',
          usedEvidenceIds: ids,
        },
      })
      const response = await dispatchTurn({
        seekerInquiry: question,
        dailySkyBrief: brief,
        answerTime: checked,
      })
      expect(response.provenance?.source).toBe('grounded_briefing')
      expect(response.text).toContain('02:00:00.000Z')
      expect(response.text).not.toContain('18:00')
    }
  )

  it('keeps a provider exception recoverable through the same factual fallback', async () => {
    generator.mockRejectedValue(new Error('Provider unavailable'))
    const response = await dispatchTurn({
      seekerInquiry: question,
      dailySkyBrief: fixture(),
      answerTime: checked,
    })
    expect(response.success).toBe(true)
    expect(response.provenance?.source).toBe('grounded_briefing')
    expect(response.text).toContain('Moon enters Virgo')
  })

  it('keeps a grounded model answer when its visible text answers the question and discloses the edition horizon', async () => {
    const answer = modelAnswer()
    generator.mockResolvedValue(answer)
    const response = await dispatchTurn({
      seekerInquiry: question,
      dailySkyBrief: fixture(),
      answerTime: checked,
    })
    expect(response.provenance?.source).toBe('model')
    expect(response.text).toBe(answer.object.text)
  })

  it.each(['12:00 UTC', '2026-10-02T12:00:00.000Z', '2026-10-02 at 12:00 UTC'])(
    'rejects an event attributed to the allowed answer clock %s',
    async wrongTime => {
      const answer = modelAnswer()
      answer.object.text = `${answer.object.text.replace('Moon enters Virgo at 02:00 UTC', `Moon enters Virgo at ${wrongTime}`)} The earlier 02:00 UTC estimate has been superseded.`
      generator.mockResolvedValue(answer)
      const response = await dispatchTurn({
        seekerInquiry: question,
        dailySkyBrief: fixture(),
        answerTime: checked,
      })
      expect(response.provenance?.source).toBe('grounded_briefing')
      expect(response.text).toContain('Moon enters Virgo at 2026-10-02T02:00:00.000Z')
    }
  )

  it('allows observation and window clocks alongside the correctly timed event', async () => {
    const answer = modelAnswer()
    answer.object.text = `As of 12:00 UTC, ${answer.object.text} The answer clock is 2026-10-02T12:00:00.000Z.`
    generator.mockResolvedValue(answer)
    const response = await dispatchTurn({
      seekerInquiry: question,
      dailySkyBrief: fixture(),
      answerTime: checked,
    })
    expect(response.provenance?.source).toBe('model')
    expect(response.text).toBe(answer.object.text)
  })

  it.each(['contradictory lunar phase', 'wrong ingress destination'])(
    'rejects %s even alongside the correct required phase and event time',
    async defect => {
      const answer = modelAnswer()
      answer.object.text =
        defect === 'contradictory lunar phase'
          ? `${answer.object.text} Today is also the full moon.`
          : answer.object.text.replace('Moon enters Virgo', 'Moon enters Libra')
      generator.mockResolvedValue(answer)
      const response = await dispatchTurn({
        seekerInquiry: question,
        dailySkyBrief: fixture(),
        answerTime: checked,
      })
      expect(response.provenance?.source).toBe('grounded_briefing')
      expect(response.text).toContain(fixture().lunar.phase)
      expect(response.text).toContain('Moon enters Virgo')
      expect(response.text).not.toContain('full moon')
      expect(response.text).not.toContain('Moon enters Libra')
    }
  )

  it('limits required timing evidence to bodies named in the question', async () => {
    const brief = fixture()
    brief.events.push({
      id: 'mercury-cancer-ingress',
      evidenceId: 'mercury-cancer-ingress',
      type: 'sign_ingress',
      at: '2026-10-02T13:00:00.000Z',
      bodies: ['mercury'],
      description: 'Mercury enters Cancer',
    })
    const inquiry = 'When does Mercury enter Cancer?'
    const ctx = buildServerCouncilContext({
      dailySkyBrief: brief,
      seekerInquiry: inquiry,
      answerTime: checked,
    })
    for (const directive of directSeekerExchange(ctx, inquiry)) {
      expect(directive.evidence.map(item => item.id)).toContain('mercury-cancer-ingress')
      expect(directive.evidence.map(item => item.id)).not.toContain('moon-virgo-ingress')
    }
    const response = await dispatchTurn({
      seekerInquiry: inquiry,
      dailySkyBrief: brief,
      answerTime: checked,
      deadlineMs: Date.now() - 1,
    })
    expect(response.text).toContain('Mercury enters Cancer')
    expect(response.text).not.toContain('Moon enters Virgo')
  })

  it('does not count a lunar answer hidden only in the private claim as an answer to the reader', async () => {
    const answer = modelAnswer()
    answer.object.text = answer.object.text.replace(fixture().lunar.phase, 'a recorded phase')
    answer.object.newClaim = `The opening lunar phase was ${fixture().lunar.phase}.`
    generator.mockResolvedValue(answer)
    const response = await dispatchTurn({
      seekerInquiry: question,
      dailySkyBrief: fixture(),
      answerTime: checked,
    })
    expect(response.provenance?.source).toBe('grounded_briefing')
    expect(response.text).toContain(fixture().lunar.phase)
  })

  it('returns a grounded answer on deadline even if a provider ignores abort and resolves late', async () => {
    vi.useFakeTimers()
    let resolveLate!: (value: ReturnType<typeof modelAnswer>) => void
    generator.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveLate = resolve
        })
    )
    const pending = dispatchTurn({
      seekerInquiry: question,
      dailySkyBrief: fixture(),
      answerTime: checked,
      deadlineMs: Date.now() + 50,
    })
    await vi.advanceTimersByTimeAsync(50)
    const response = await pending
    expect(generator.mock.calls[0][1].abortSignal?.aborted).toBe(true)
    expect(response.provenance?.source).toBe('grounded_briefing')
    resolveLate(modelAnswer())
    await Promise.resolve()
    expect(response.provenance?.source).toBe('grounded_briefing')
  })
})
