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
import {
  directSeekerExchange,
  directAutonomousTurn,
  directIngressSequence,
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
import { buildPlanetaryPersonaBlock } from './planetary-personas'
import { parseNatalContext } from '@/lib/context-card/natal-parser'
import { buildAgentContext } from '@/lib/agents/persona/build-agent-context'

export interface CouncilRequest {
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
}

const HOST_AGENT_ID = 'greg-castro-1991'

export async function dispatchTurn(request: CouncilRequest): Promise<CouncilTurnResponse> {
  // 1. Parse & validate attached natal envelope if present
  const structuredNatal = request.attachedNatalEnvelope
    ? parseNatalContext(request.attachedNatalEnvelope)
    : undefined

  // 2. Build internal server-side CouncilContext
  const ctx = buildServerCouncilContext({
    seekerInquiry: request.seekerInquiry,
    attachedNatalChart: structuredNatal || undefined,
    recentTurns: request.recentTurns || [],
  })

  // 3. Determine turn directive via Conversation Director
  let directive: TurnDirective

  if (request.ingressEvent) {
    const { movingPlanet, newSign, newDegree, turnIndex = 0 } = request.ingressEvent
    const movingKey = movingPlanet.toLowerCase() as BasketAgentKey
    const sequence = directIngressSequence(ctx, movingKey, newSign, newDegree)
    directive = sequence[Math.min(turnIndex, sequence.length - 1)]
  } else if (request.seekerInquiry) {
    const preferred = request.targetDelegate?.toLowerCase() as BasketAgentKey | undefined
    const [t1, t2] = directSeekerExchange(ctx, request.seekerInquiry, preferred)
    // If recent turns already have the first response, return the second
    const hasFirstSpoken = ctx.recentTurns.some(t => t.speakerKey === t1.speakerKey)
    directive = hasFirstSpoken ? t2 : t1
  } else {
    // Autonomous turn
    const lastSpeakerKey = ctx.recentTurns[ctx.recentTurns.length - 1]?.speakerKey
    directive = directAutonomousTurn(ctx, lastSpeakerKey)
  }

  // If a specific target delegate is forced
  if (request.targetDelegate && !request.seekerInquiry) {
    const forcedKey = request.targetDelegate.toLowerCase() as BasketAgentKey
    if (ctx.sky[forcedKey]) {
      directive.speakerKey = forcedKey
      directive.speakerName = ctx.sky[forcedKey].planet
    }
  }

  // 4. Compile TurnBrief
  const brief: TurnBrief = compileTurnBrief(directive, request.seekerInquiry)

  // 5. Determine system prompt
  const isHost = directive.speakerKey === 'gregory'
  let systemPrompt: string

  if (isHost) {
    systemPrompt =
      buildAgentContext(HOST_AGENT_ID)?.personaBlock ||
      'You are Host Gregory Castro, holding the center of the Current Sky Council.'
  } else {
    const placement = ctx.sky[directive.speakerKey]
    systemPrompt =
      buildPlanetaryPersonaBlock(directive.speakerKey, {
        sign: placement?.sign,
        degreeLabel: placement?.degreeLabel,
        dignity: placement?.dignity,
        retrograde: placement?.retrograde,
      }) || ''
  }

  const isSeekerTurn = !!request.seekerInquiry
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

  // 7. Validate evidence usage and assemble response
  if (generationResult.object && generationResult.source === 'model') {
    const allowedIds = new Set(brief.evidence.map(e => e.id))
    const validUsedIds = (generationResult.object.usedEvidenceIds || []).filter(id =>
      allowedIds.has(id)
    )

    return {
      success: true,
      speakerKey: directive.speakerKey,
      speakerName: directive.speakerName,
      text: generationResult.object.text.trim(),
      newClaim: generationResult.object.newClaim.trim(),
      speechAct: directive.speechAct,
      usedEvidenceIds: validUsedIds.length > 0 ? validUsedIds : [brief.evidence[0].id],
      targetTurnId: directive.targetTurnId,
      provenance: {
        source: 'model',
        modelFamily: generationResult.modelFamily,
        latencyMs: generationResult.latencyMs,
      },
    }
  }

  // 8. Grounded Sky Briefing Fallback (zero canned copy, qualitative interpretation)
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
