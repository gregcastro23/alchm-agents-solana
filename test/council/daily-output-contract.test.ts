/** @vitest-environment node */
import { beforeEach, expect, it, vi } from 'vitest'
import { asSchema } from 'ai'
import { generateStructuredVoice } from '@/lib/agents/persona/voiced-generation'
import {
  createBriefingEdition,
  generateDailyEdition,
  getBeatFactualAssertions,
  planDailyEpisode,
  validateDailyTurn,
  type DailyCouncilDraft,
  type DailyGenerationDiagnostic,
} from '@/lib/agents/council/daily-episode'
import { buildDailySkyBrief } from '@/lib/agents/council/daily-sky'
import { COUNCIL_PLANETS } from '@/lib/agents/council/daily-council-types'
import { PLANET_FUNCTIONS } from '@/lib/agents/council/placement-knowledge'

vi.mock('@/lib/agents/persona/voiced-generation', () => ({ generateStructuredVoice: vi.fn() }))

const generator = vi.mocked(generateStructuredVoice)
beforeEach(() => {
  generator.mockReset()
})
const buildBrief = () =>
  buildDailySkyBrief({
    date: new Date('2026-10-02T00:00:00Z'),
    source: 'vsop87-approximation',
    positions: Object.fromEntries(
      COUNCIL_PLANETS.map((planet, index) => [
        planet,
        { longitude: 15 + index * 33, speed: index > 6 ? -0.1 : 1 },
      ])
    ),
  })

it('gives every daily turn an explicit object contract with structured factual assertions', async () => {
  generator.mockResolvedValue({ source: 'grounded_briefing', object: null })
  const brief = buildBrief()
  await generateDailyEdition(brief, { deadlineMs: Date.now() + 30_000 })
  const prompts = generator.mock.calls
    .filter(([, options]) => !options.systemPrompt.startsWith('You are the internal editor'))
    .map(([, options]) => options.prompt)
  expect(prompts.length).toBeGreaterThanOrEqual(8)
  for (const prompt of prompts) {
    const shapeLine = prompt.split('\n').find(line => line.startsWith('OUTPUT SHAPE EXAMPLE'))!
    const shape = JSON.parse(shapeLine.slice(shapeLine.indexOf(': ') + 2))
    expect(Object.keys(shape).sort()).toEqual(
      ['text', 'newClaim', 'usedEvidenceIds', 'coverageIds', 'factualAssertions'].sort()
    )
    expect(shape.factualAssertions).toEqual([
      { evidenceId: expect.any(String), statement: expect.any(String) },
    ])
    expect(prompt).toContain('never use bare strings')
    expect(prompt).toContain('Copy each statement exactly')
  }
})

it('restricts generated metadata to the assigned evidence, coverage and exact assertion pairs', async () => {
  generator.mockResolvedValue({ source: 'grounded_briefing', object: null })
  const brief = buildBrief()
  await generateDailyEdition(brief, { deadlineMs: Date.now() + 30_000 })
  const schema = generator.mock.calls[0][0]
  const beat = planDailyEpisode(brief)[0]
  const assertions = getBeatFactualAssertions(brief, beat)
  const candidate = { ...createBriefingEdition(brief).turns[0], factualAssertions: assertions }
  expect(schema.safeParse(candidate).success).toBe(true)
  expect(schema.safeParse({ ...candidate, usedEvidenceIds: ['invented-evidence'] }).success).toBe(
    false
  )
  expect(schema.safeParse({ ...candidate, coverageIds: ['invented-coverage'] }).success).toBe(false)
  expect(
    schema.safeParse({
      ...candidate,
      factualAssertions: [{ ...assertions[0], statement: 'An invented sky assertion.' }],
    }).success
  ).toBe(false)
  expect(
    schema.safeParse({
      ...candidate,
      factualAssertions: [
        { evidenceId: assertions[0].evidenceId, statement: assertions[1].statement },
      ],
    }).success
  ).toBe(false)
  const jsonSchema = asSchema(schema).jsonSchema as {
    properties: {
      usedEvidenceIds: { items: { enum: string[] } }
      coverageIds: { items: { enum: string[] } }
      factualAssertions: {
        items: {
          anyOf: Array<{
            properties: { evidenceId: { enum: string[] }; statement: { enum: string[] } }
          }>
        }
      }
    }
  }
  expect(jsonSchema.properties.usedEvidenceIds.items.enum).toEqual(
    beat.evidence.map(item => item.id)
  )
  expect(jsonSchema.properties.coverageIds.items.enum).toEqual(beat.coverageIds)
  expect(
    jsonSchema.properties.factualAssertions.items.anyOf.map(option => ({
      evidenceId: option.properties.evidenceId.enum,
      statement: option.properties.statement.enum,
    }))
  ).toEqual(
    assertions.map(assertion => ({
      evidenceId: [assertion.evidenceId],
      statement: [assertion.statement],
    }))
  )
})

it('traces rejected candidates before factual validation using only visible dialogue fields', async () => {
  const brief = buildBrief()
  const candidate = {
    ...createBriefingEdition(brief).turns[0],
    text: `${createBriefingEdition(brief).turns[0].text} Sun is in Pisces.`,
    factualAssertions: getBeatFactualAssertions(brief, planDailyEpisode(brief)[0]),
  }
  generator
    .mockResolvedValueOnce({ source: 'model', object: candidate })
    .mockResolvedValue({ source: 'grounded_briefing', object: null })
  const drafts: DailyCouncilDraft[] = []
  const order: string[] = []
  const edition = await generateDailyEdition(brief, {
    deadlineMs: Date.now() + 30_000,
    onDraft: draft => {
      drafts.push(draft)
      order.push('draft')
      // Observability cannot mutate the metadata being validated.
      draft.candidate.usedEvidenceIds.push('trace-only-change')
    },
    onDiagnostic: event => {
      if (event.beatId === 'beat-1') order.push(event.outcome)
    },
  })
  expect(order.slice(0, 2)).toEqual(['draft', 'rejected'])
  expect(drafts).toHaveLength(1)
  expect(drafts[0]).toMatchObject({ beatId: 'beat-1', speakerKey: 'gregory', phase: 'turn' })
  expect(Object.keys(drafts[0].candidate).sort()).toEqual(
    ['text', 'newClaim', 'usedEvidenceIds', 'coverageIds'].sort()
  )
  expect(candidate.usedEvidenceIds).not.toContain('trace-only-change')
  expect(edition.turns[0].provenance.source).toBe('grounded_briefing')
})

it('includes reviewed editorial issues in opt-in diagnostics', async () => {
  const brief = buildBrief()
  const turn = createBriefingEdition(brief).turns[0]
  const issue = { turnId: turn.id, reason: 'Add a concrete application to the opening.' }
  let firstTurn = true
  let reviews = 0
  generator.mockImplementation(async (_schema, options) => {
    if (options.systemPrompt.startsWith('You are the internal editor'))
      return {
        source: 'model',
        object:
          ++reviews === 1
            ? { acceptable: false, issues: [{ ...issue, kind: 'conversation', turnId: 'turn-1' }] }
            : { acceptable: true, issues: [] },
      }
    if (firstTurn) {
      firstTurn = false
      return {
        source: 'model',
        object: {
          ...turn,
          factualAssertions: getBeatFactualAssertions(brief, planDailyEpisode(brief)[0]),
        },
      }
    }
    return { source: 'grounded_briefing', object: null }
  })
  const diagnostics: DailyGenerationDiagnostic[] = []
  await generateDailyEdition(brief, {
    deadlineMs: Date.now() + 30_000,
    onDiagnostic: event => diagnostics.push(event),
  })
  expect(diagnostics.find(event => event.phase === 'review')).toMatchObject({
    outcome: 'rejected',
    issues: [issue],
  })
  expect(diagnostics.find(event => event.phase === 'final_review')).toMatchObject({
    outcome: 'accepted',
    issues: [],
  })
})

it('keeps the host opening focused and gives closing explicit synthesis duties', async () => {
  generator.mockResolvedValue({ source: 'grounded_briefing', object: null })
  const brief = buildBrief()
  const beats = planDailyEpisode(brief)
  const edition = await generateDailyEdition(brief, { deadlineMs: Date.now() + 30_000 })
  const prompts = generator.mock.calls.map(([, options]) => options.prompt)
  const opening = prompts[0]
  const contextLine = opening.split('\n').find(line => line.startsWith('Assigned opening context'))!
  const context = JSON.parse(contextLine.slice(contextLine.indexOf(': ') + 2))
  expect(context).not.toHaveProperty('lunar')
  expect(context).not.toHaveProperty('events')
  expect(context).not.toHaveProperty('elementCounts')
  expect(beats[0].evidence.some(evidence => evidence.kind === 'overview')).toBe(false)
  expect(opening).toContain('Save lunar rhythm, motion, other placements')
  expect(opening).toContain('Every supplied placement belongs to the collective public snapshot')
  expect(prompts[1]).toContain('This planetary speaker’s current public-sky placement')
  expect(prompts.at(-1)).toContain('connecting two distinct actual claims')
  expect(prompts.at(-1)).toContain('two distinct concrete practices')
  expect(prompts.at(-1)).toContain('event timing unavailable')
  expect(edition.turns[0].text).not.toContain('The elemental overview')
  expect(edition.turns.find(turn => turn.text.includes('The elemental overview'))?.speakerKey).toBe(
    'gregory'
  )
  expect(edition.coveredTopics).toEqual(expect.arrayContaining(brief.requiredCoverage))
})

it('rejects unsupported reader birth-chart attributions while allowing practical reader language', () => {
  const brief = buildBrief()
  const beat = planDailyEpisode(brief)[1]
  const turn = createBriefingEdition(brief).turns[1]
  for (const attribution of [
    `Your Sun in ${brief.positions.Sun.sign} seeks creative purpose.`,
    `Your Moon is now in ${brief.positions.Moon.sign}.`,
    `Your ${brief.positions.Moon.sign} Moon needs emotional care.`,
    'Your Libran Sun brings purpose into relationships.',
    `Your Sun’s placement in ${brief.positions.Sun.sign} shapes who you are.`,
    'That’s not a constraint on your Leo Moon’s need for warmth.',
    'Your Libran Sun does not guarantee an easy conversation.',
    'It is not your Leo Moon, but your Libran Sun that gives this reading its purpose.',
    `We cannot infer an ingress, and your Sun in ${brief.positions.Sun.sign} shapes your purpose.`,
  ])
    expect(
      validateDailyTurn(brief, beat, { ...turn, text: `${turn.text} ${attribution}` }).reason
    ).toBe('Unsupported reader natal attribution')
  for (const practical of [
    'Bring your attention back to one conversation before deciding how to act.',
    'Give your feelings a little space before asking what they mean.',
    'Your daily rhythms can guide a practical choice without determining its outcome.',
    `We cannot infer your Sun in ${brief.positions.Sun.sign} from this snapshot.`,
    'The public sky does not establish your Libran Sun.',
    'Today’s Moon is not your Leo Moon; it belongs to the collective snapshot.',
  ])
    expect(
      validateDailyTurn(brief, beat, { ...turn, text: `${turn.text} ${practical}` }).valid
    ).toBe(true)
  expect(
    validateDailyTurn(brief, beat, {
      ...turn,
      newClaim: 'This is not a constraint on your Leo Moon’s need for emotional care.',
    }).reason
  ).toBe('Unsupported reader natal attribution')
})

it('keeps each grouped fallback claim tied to that planet’s own sign and function', () => {
  const brief = buildBrief()
  const beats = planDailyEpisode(brief)
  const edition = createBriefingEdition(brief)
  for (const [index, beat] of beats.entries()) {
    if (!['personal', 'growth', 'outer'].includes(beat.topic)) continue
    const claim = edition.turns[index].newClaim
    const bodies = beat.evidence
      .filter(item => item.kind === 'placement')
      .flatMap(item => item.bodyKeys)
    expect(bodies.length).toBeGreaterThan(1)
    for (const key of bodies) {
      const planet = COUNCIL_PLANETS.find(body => body.toLowerCase() === key)!
      expect(claim).toContain(
        `${planet} in ${brief.positions[planet].sign} expresses ${PLANET_FUNCTIONS[planet]}`
      )
    }
    expect(claim.length).toBeLessThanOrEqual(1500)
  }
})
