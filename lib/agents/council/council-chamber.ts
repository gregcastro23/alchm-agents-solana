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
import { buildAgentContext } from '@/lib/agents/persona/build-agent-context'

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
    const [t1, t2] = directSeekerExchange(ctx, request.seekerInquiry, preferred)
    const turnIndex = request.turnIndex ?? 0
    directive = turnIndex === 0 ? t1 : t2
  } else {
    // Autonomous turn
    const lastSpeakerKey = ctx.recentTurns[ctx.recentTurns.length - 1]?.speakerKey
    directive = directAutonomousTurn(ctx, lastSpeakerKey)
  }

  // 4. Compile TurnBrief
  const brief: TurnBrief = compileTurnBrief(directive, request.seekerInquiry)

  // 5. Determine system prompt using Canonical CraftedAgent Persona Block
  const agentCtx = buildAgentContext(directive.speakerKey)
  const systemPrompt =
    agentCtx?.personaBlock ||
    (directive.speakerKey === 'gregory'
      ? 'You are Host Gregory Castro, holding the center of the Current Sky Council.'
      : `You are the ${directive.speakerName} delegate on the Current Sky Council.`)

  const isSeekerTurn = !!request.seekerInquiry
  const isHost = directive.speakerKey === 'gregory'
  const tier = isSeekerTurn || isHost ? 'substantive' : 'ambient'

  // 6. Schema-constrained generation
  const generationResult = await generateStructuredVoice<CouncilTurnGeneration>(
    CouncilTurnGenerationSchema,
    {
      systemPrompt,
      prompt: brief.formattedPrompt,
      tier,
      maxTokens: 450,
    }
  )

  // 7. Validate evidence usage and assemble response (Strict: any fabricated ID falls back)
  if (generationResult.object && generationResult.source === 'model') {
    const allowedIds = new Set(brief.evidence.map(e => e.id))
    const rawIds = generationResult.object.usedEvidenceIds || []
    const audit = auditEvidence(rawIds, allowedIds)

    if (audit.valid) {
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
      modelFamily: generationResult.modelFamily,
      latencyMs: generationResult.latencyMs,
    },
  }
}
