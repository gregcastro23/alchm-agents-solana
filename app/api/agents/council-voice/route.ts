import { NextRequest, NextResponse } from 'next/server'
import { dispatchTurn, type CouncilRequest } from '@/lib/agents/council/council-chamber'
import { CouncilApiRequestSchema } from '@/lib/agents/council/council-schema'
import type { CouncilTurnContext } from '@/lib/agents/council/council-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json()

    // 1. Strict Zod schema validation
    const parsed = CouncilApiRequestSchema.safeParse({
      seekerInquiry: rawBody.seekerInquiry || rawBody.userPrompt,
      targetDelegate: rawBody.targetDelegate || rawBody.agentKey,
      attachedNatalEnvelope: rawBody.attachedNatalEnvelope || rawBody.attachedChartContext,
      ingressEvent:
        rawBody.ingressEvent && typeof rawBody.ingressEvent === 'object'
          ? {
              movingPlanet: rawBody.ingressEvent.movingPlanet || rawBody.movingPlanet,
              newSign: rawBody.ingressEvent.newSign || rawBody.movingSign,
              newDegree: rawBody.ingressEvent.newDegree ?? rawBody.movingDegree,
              turnIndex: rawBody.ingressEvent.turnIndex,
              isFinalWord: rawBody.ingressEvent.isFinalWord ?? rawBody.isIngressFinalWord,
            }
          : undefined,
      recentTurns: rawBody.recentTurns,
      selectedAgentFilter: rawBody.selectedAgentFilter,
      skyOverride: rawBody.skyOverride,
    })

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid council request payload',
          details: parsed.error.issues,
        },
        { status: 400 }
      )
    }

    const valid = parsed.data

    // 2. Adapt to internal CouncilRequest (only allow targetDelegate when seekerInquiry exists)
    const councilRequest: CouncilRequest = {
      seekerInquiry: valid.seekerInquiry,
      targetDelegate: valid.seekerInquiry ? valid.targetDelegate : undefined,
      attachedNatalEnvelope: valid.attachedNatalEnvelope,
      ingressEvent: valid.ingressEvent
        ? {
            movingPlanet: valid.ingressEvent.movingPlanet,
            newSign: valid.ingressEvent.newSign,
            newDegree: valid.ingressEvent.newDegree,
            turnIndex: valid.ingressEvent.turnIndex,
            isFinalWord: valid.ingressEvent.isFinalWord,
          }
        : undefined,
      recentTurns: valid.recentTurns as CouncilTurnContext[] | undefined,
      selectedAgentFilter: valid.selectedAgentFilter,
      skyOverride: valid.skyOverride as any,
    }

    const result = await dispatchTurn(councilRequest)
    return NextResponse.json(result)
  } catch (err) {
    console.warn('[api/agents/council-voice] Error in council-voice route:', err)
    return NextResponse.json(
      {
        success: false,
        text: 'The celestial sphere continues its silent revolution.',
        speakerKey: 'gregory',
        speakerName: 'Gregory',
        newClaim: 'The sky maintains its order through silence.',
        speechAct: 'synthesize',
        usedEvidenceIds: [],
        provenance: {
          source: 'grounded_briefing',
        },
      },
      { status: 500 }
    )
  }
}
