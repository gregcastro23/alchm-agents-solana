/**
 * Council Chamber Core Module
 *
 * Internal server-side domain coordinator for the Current Sky Council.
 * Privately builds celestial context, executes conversation direction,
 * compiles TurnBriefs, runs schema-constrained generation, and manages
 * interpretive grounded briefings with sanitized provenance.
 */

import {
  buildServerCouncilContext,
  type BasketAgentKey,
  type CouncilTurnContext,
} from './council-context'
import type { CurrentPlanetPosition } from '@/lib/calculate-transits'
import {
  directSeekerExchange,
  directAutonomousTurn,
  directIngressTurn,
  type TurnDirective,
} from './conversation-director'
import { compileTurnBrief, type TurnBrief } from './turn-brief'
import { generateInterpretiveBriefing } from './grounded-briefing'
import {
  CouncilTurnGenerationSchema,
  type CouncilTurnGeneration,
  type CouncilTurnResponse,
} from './council-schema'
import { generateStructuredVoice } from '@/lib/agents/persona/voiced-generation'
import { parseNatalContext } from '@/lib/context-card/natal-parser'
import { composeCouncilPersona } from './council-persona'
import { containsForbiddenTelemetry } from './council-schema'
import { findEditionFactContradiction, findSnapshotContradiction } from './daily-episode'
import type { DailySkyBrief } from './daily-council-types'

function agreesWithQuestionFacts(
  visibleText: string,
  sky: DailySkyBrief,
  brief: TurnBrief,
  answerTime?: string,
  claim = ''
): boolean {
  const text = `${visibleText} ${claim}`
  if (
    brief.requiredEvidenceIds?.includes('edition-basis') &&
    (!visibleText.includes(sky.asOf.slice(0, 10)) ||
      (sky.quality === 'approximate' && !/\bapproximat(?:e|ed|ion)\b/i.test(visibleText)))
  )
    return false
  if (
    brief.requiredEvidenceIds?.includes('lunar-state') &&
    !visibleText.toLowerCase().includes(sky.lunar.phase.toLowerCase())
  )
    return false
  if (
    brief.requiredEvidenceIds?.includes('event-horizon') &&
    (!visibleText.includes(sky.endAt.slice(0, 10)) || !/\bUTC\b/i.test(visibleText))
  )
    return false
  const allowedInstants = [
    sky.asOf,
    sky.startAt,
    sky.endAt,
    ...sky.events.map(event => event.at),
    ...(answerTime ? [answerTime] : []),
  ]
  const allowedTimes = new Set(allowedInstants.map(value => value.slice(11, 16)))
  for (const match of text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\s*UTC\b/gi)) {
    if (!allowedTimes.has(`${match[1].padStart(2, '0')}:${match[2]}`)) return false
  }
  for (const match of text.matchAll(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z/gi)) {
    const precision = /T\d{2}:\d{2}:/.test(match[0]) ? 1000 : 60_000
    if (
      !allowedInstants.some(
        value =>
          Math.floor(Date.parse(value) / precision) === Math.floor(Date.parse(match[0]) / precision)
      )
    )
      return false
  }
  for (const event of sky.events.filter(event =>
    brief.requiredEvidenceIds?.includes(event.evidenceId)
  )) {
    if (!visibleText.includes(event.at.slice(11, 16))) return false
  }
  return true
}

export interface CouncilRequest {
  turnIndex?: number
  seekerInquiry?: string
  targetDelegate?: string
  attachedNatalEnvelope?: unknown
  ingressEvent?: {
    movingPlanet: string
    newSign: string
    newDegree: number
    isFinalWord?: boolean
    turnIndex?: number
  }
  recentTurns?: CouncilTurnContext[]
  selectedAgentFilter?: string
  skyOverride?: Record<string, CurrentPlanetPosition>
  observationTime?: string
  /** Server-owned edition evidence; callers cannot replace it through the public question API. */
  dailySkyBrief?: DailySkyBrief
  answerTime?: string
  /** Absolute Unix timestamp in milliseconds; generation respects the caller's deadline. */
  deadlineMs?: number
}

export function auditEvidence(
  usedIds: string[],
  allowedIds: Set<string>
): { valid: boolean; reason?: string } {
  if (!usedIds || usedIds.length === 0) {
    return { valid: false, reason: 'Empty evidence list' }
  }
  const fabricated = usedIds.filter(id => !allowedIds.has(id))
  if (fabricated.length > 0) {
    return { valid: false, reason: `Fabricated evidence IDs: ${fabricated.join(', ')}` }
  }
  return { valid: true }
}

export async function dispatchTurn(request: CouncilRequest): Promise<CouncilTurnResponse> {
  // 1. Parse & validate attached natal envelope if present
  const structuredNatal = request.attachedNatalEnvelope
    ? parseNatalContext(request.attachedNatalEnvelope)
    : undefined

  // Pre-calculate ingress override if present so full context and downstream aspect detection reflect the new position
  const ingressOverride = request.ingressEvent
    ? {
        [request.ingressEvent.movingPlanet.toLowerCase() as BasketAgentKey]: {
          sign: request.ingressEvent.newSign,
          degree: request.ingressEvent.newDegree,
        },
      }
    : undefined

  // 2. Build complete server-side council context
  const ctx = buildServerCouncilContext({
    positions: request.skyOverride,
    overrides: ingressOverride,
    seekerInquiry: request.seekerInquiry,
    attachedNatalChart: structuredNatal || undefined,
    recentTurns: request.recentTurns || [],
    date: request.observationTime ? new Date(request.observationTime) : undefined,
    dailySkyBrief: request.dailySkyBrief,
    answerTime: request.answerTime,
  })

  // 3. Determine turn directive via Conversation Director
  let directive: TurnDirective

  if (request.ingressEvent) {
    const { movingPlanet, newSign, newDegree } = request.ingressEvent
    const turnIndex = request.turnIndex ?? request.ingressEvent.turnIndex ?? 0
    const movingKey = movingPlanet.toLowerCase() as BasketAgentKey
    directive = directIngressTurn(ctx, movingKey, newSign, newDegree, turnIndex)
  } else if (request.seekerInquiry) {
    const preferred = request.targetDelegate?.toLowerCase() as BasketAgentKey | undefined
    const turns = directSeekerExchange(ctx, request.seekerInquiry, preferred)
    const turnIndex = request.turnIndex ?? 0
    directive = turns[Math.min(turnIndex, 2)]
  } else {
    // Autonomous turn
    const lastSpeakerKey = ctx.recentTurns[ctx.recentTurns.length - 1]?.speakerKey
    directive = directAutonomousTurn(ctx, lastSpeakerKey)
  }

  // 4. Compile TurnBrief
  const brief: TurnBrief = compileTurnBrief(directive, request.seekerInquiry)

  // 5. Determine system prompt using Canonical CraftedAgent Persona Block
  const systemPrompt = composeCouncilPersona(directive.speakerKey, {
    placement: directive.speakerKey === 'gregory' ? undefined : ctx.sky[directive.speakerKey],
    theme: `${request.seekerInquiry || ''} ${directive.targetClaim || ''}`,
  })

  const isSeekerTurn = !!request.seekerInquiry
  const isHost = directive.speakerKey === 'gregory'
  const tier = isSeekerTurn || isHost ? 'substantive' : 'ambient'

  // 6. Schema-constrained generation
  const remaining = Math.max(
    0,
    Math.min((request.deadlineMs ?? Date.now() + 15_000) - Date.now(), 30_000)
  )
  const abort = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const elapsed = new Promise<null>(resolve => {
    if (remaining > 0)
      timeout = setTimeout(() => {
        abort.abort()
        resolve(null)
      }, remaining)
    else resolve(null)
  })
  const generationResult =
    remaining > 0
      ? await Promise.race([
          Promise.resolve().then(() =>
            generateStructuredVoice<CouncilTurnGeneration>(CouncilTurnGenerationSchema, {
              systemPrompt,
              prompt: `Sky observation instant: ${ctx.timestamp}.\n\n${brief.formattedPrompt}`,
              tier,
              maxTokens: 600,
              abortSignal: abort.signal,
            })
          ),
          elapsed,
        ])
          .catch(() => null)
          .finally(() => {
            if (timeout) clearTimeout(timeout)
          })
      : null

  // 7. Validate evidence usage and assemble response (Strict: any fabricated ID falls back)
  if (generationResult?.object && generationResult.source === 'model') {
    const allowedIds = new Set(brief.evidence.map(e => e.id))
    const rawIds = generationResult.object.usedEvidenceIds || []
    const audit = auditEvidence(rawIds, allowedIds)

    const schemaValid = CouncilTurnGenerationSchema.safeParse(generationResult.object).success
    const facts = Object.fromEntries(
      Object.values(ctx.sky)
        .filter(body => body.key !== 'gregory')
        .map(body => [body.planet, body])
    )
    const contradiction = findSnapshotContradiction(
      `${generationResult.object.text} ${generationResult.object.newClaim}`,
      facts,
      ctx.aspects as Parameters<typeof findSnapshotContradiction>[2],
      directive.speakerKey
    )
    const requiredFactsUsed = brief.requiredEvidenceIds?.every(id => rawIds.includes(id)) ?? true
    const editionContradiction =
      ctx.dailySkyBrief &&
      findEditionFactContradiction(
        ctx.dailySkyBrief,
        `${generationResult.object.text} ${generationResult.object.newClaim}`,
        rawIds
      )
    const questionFactsAgree =
      !ctx.dailySkyBrief ||
      agreesWithQuestionFacts(
        generationResult.object.text,
        ctx.dailySkyBrief,
        brief,
        ctx.answerTime,
        generationResult.object.newClaim
      )
    if (
      audit.valid &&
      schemaValid &&
      requiredFactsUsed &&
      questionFactsAgree &&
      !editionContradiction &&
      !contradiction &&
      !containsForbiddenTelemetry(generationResult.object.text)
    ) {
      return {
        success: true,
        speakerKey: directive.speakerKey,
        speakerName: directive.speakerName,
        text: generationResult.object.text.trim(),
        newClaim: generationResult.object.newClaim.trim(),
        speechAct: directive.speechAct,
        usedEvidenceIds: rawIds,
        targetTurnId: directive.targetTurnId,
        provenance: {
          source: 'model',
          modelFamily: generationResult.modelFamily,
          latencyMs: generationResult.latencyMs,
        },
      }
    }
  }

  // 8. Grounded Sky Briefing Fallback (zero canned copy, dynamic qualitative interpretation)
  const briefing = generateInterpretiveBriefing(brief, isSeekerTurn)

  return {
    success: true,
    speakerKey: directive.speakerKey,
    speakerName: directive.speakerName,
    text: briefing.text,
    newClaim: briefing.newClaim,
    speechAct: directive.speechAct,
    usedEvidenceIds: briefing.usedEvidenceIds,
    targetTurnId: directive.targetTurnId,
    provenance: {
      source: 'grounded_briefing',
      modelFamily: generationResult?.modelFamily,
      latencyMs: generationResult?.latencyMs,
    },
  }
}
