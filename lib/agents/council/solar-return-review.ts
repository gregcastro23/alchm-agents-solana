import { z } from 'zod'
import { generateStructuredVoice } from '@/lib/agents/persona/voiced-generation'
import { containsForbiddenTelemetry } from './council-schema'
import type { SolarReturnCouncilTurn, YearOverYearTelemetry } from './solar-return-types'

export type SolarReviewIssueKind = 'factual' | 'coverage' | 'conversation'

export interface SolarEditorialIssue {
  kind: SolarReviewIssueKind
  turnId: string
  reason: string
}

export interface SolarEditorialVerdict {
  status: 'reviewed' | 'unavailable' | 'expired' | 'invalid'
  acceptable: boolean
  issues: SolarEditorialIssue[]
}

const issueKindSchema = z.enum(['factual', 'coverage', 'conversation'])

const reviewOutputSchema = z.object({
  acceptable: z.boolean(),
  issues: z
    .array(
      z.object({
        kind: issueKindSchema,
        turnId: z.string().min(1),
        reason: z.string().min(1).max(300),
      })
    )
    .max(4),
})

/**
 * Validates a single turn against factual constraints of the historical return sky.
 */
export function validateTurnAgainstTelemetry(
  turn: SolarReturnCouncilTurn,
  telemetry: YearOverYearTelemetry
): SolarEditorialIssue | null {
  if (containsForbiddenTelemetry(turn.text)) {
    return {
      kind: 'factual',
      turnId: turn.id,
      reason: 'Turn text contains forbidden coordinate telemetry or raw numbers',
    }
  }

  if (containsForbiddenTelemetry(turn.newClaim)) {
    return {
      kind: 'factual',
      turnId: turn.id,
      reason: 'New claim contains forbidden telemetry',
    }
  }

  // Host role checks
  if (turn.role === 'opening') {
    const textLower = turn.text.toLowerCase()
    const disclosesQuality =
      textLower.includes('verified') ||
      textLower.includes('approximate') ||
      textLower.includes('return')
    if (!disclosesQuality) {
      return {
        kind: 'conversation',
        turnId: turn.id,
        reason: 'Opening turn must disclose observation quality or solar return epoch',
      }
    }
  }

  if (turn.role === 'closing') {
    if (turn.text.length < 120) {
      return {
        kind: 'conversation',
        turnId: turn.id,
        reason: 'Closing turn is too brief to synthesize delegates and offer two reflections',
      }
    }
  }

  return null
}

/**
 * Editorial Review Gate:
 * Inspects all turns for factual consistency against the historical sky snapshot,
 * flags contradictions or missing topics, and enforces high-pedagogy conversation standards.
 */
export async function inspectSolarReturnDialogue(
  telemetry: YearOverYearTelemetry,
  turns: SolarReturnCouncilTurn[],
  deadlineMs: number
): Promise<SolarEditorialVerdict> {
  const turnIds = turns.map(t => t.id)
  const localIssues: SolarEditorialIssue[] = []

  // Deterministic pre-flight check
  for (const turn of turns) {
    const issue = validateTurnAgainstTelemetry(turn, telemetry)
    if (issue) {
      localIssues.push(issue)
    }
  }

  if (localIssues.length > 0) {
    return {
      status: 'reviewed',
      acceptable: false,
      issues: localIssues.slice(0, 4),
    }
  }

  const remaining = Math.min(20_000, deadlineMs - Date.now())
  if (remaining <= 0) {
    return { status: 'expired', acceptable: true, issues: [] }
  }

  const abort = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<null>(resolve => {
    timer = setTimeout(() => {
      abort.abort()
      resolve(null)
    }, remaining)
  })

  try {
    const systemPrompt =
      'You are the internal editor of the Solar Return Historical Planetary Council. Review the dialogue for factual contradictions with the historical 1-year-ago sky snapshot, missing planet coverage, and conversation flow. No raw degrees or coordinate telemetry are permitted in dialogue. Gregory must open with observation quality, integrate personal and collective currents midway, and close by synthesizing delegate claims with two practical year-over-year reflections. Return {"acceptable": boolean, "issues": [{"kind": "factual"|"coverage"|"conversation", "turnId": "...", "reason": "..."}]}. If acceptable, issues must be empty.'

    const prompt = JSON.stringify({
      historicalReturnSky: {
        solarAlignment: telemetry.solarAlignment,
        positions: telemetry.returnSky.positions,
        elements: telemetry.returnSky.elements,
        shiftedRulers: telemetry.shiftedRulers,
      },
      referenceTodaySky: {
        positions: telemetry.referenceSky.positions,
      },
      turns: turns.map(t => ({
        id: t.id,
        speaker: t.speakerName,
        role: t.role,
        text: t.text,
        claim: t.newClaim,
      })),
    })

    const result = await Promise.race([
      generateStructuredVoice(reviewOutputSchema, {
        systemPrompt,
        prompt,
        tier: 'expert',
        maxTokens: 1200,
        abortSignal: abort.signal,
      }),
      timeoutPromise,
    ])

    if (!result || result.source !== 'model' || !result.object) {
      return { status: 'unavailable', acceptable: true, issues: [] }
    }

    const parsed = reviewOutputSchema.safeParse(result.object)
    if (!parsed.success) {
      return { status: 'invalid', acceptable: false, issues: [] }
    }

    const validIssues = parsed.data.issues
      .filter(i => turnIds.includes(i.turnId))
      .map(i => ({
        kind: i.kind,
        turnId: i.turnId,
        reason: i.reason,
      }))

    return {
      status: 'reviewed',
      acceptable: parsed.data.acceptable && validIssues.length === 0,
      issues: validIssues,
    }
  } catch {
    return { status: 'unavailable', acceptable: true, issues: [] }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
