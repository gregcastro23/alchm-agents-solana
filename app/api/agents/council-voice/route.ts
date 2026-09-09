import { NextRequest, NextResponse } from 'next/server'
import { dispatchTurn, type CouncilRequest } from '@/lib/agents/council/council-chamber'
import type { CouncilTurnContext } from '@/lib/agents/council/council-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Adapt request body to internal CouncilRequest format
    const councilRequest: CouncilRequest = {
      seekerInquiry: body.seekerInquiry || body.userPrompt,
      targetDelegate: body.targetDelegate || body.agentKey,
      attachedNatalEnvelope: body.attachedNatalEnvelope || body.attachedChartContext,
      ingressEvent:
        body.ingressEvent && typeof body.ingressEvent === 'object'
          ? {
              movingPlanet: body.ingressEvent.movingPlanet || body.movingPlanet || 'Moon',
              newSign: body.ingressEvent.newSign || body.movingSign || '',
              newDegree: body.ingressEvent.newDegree ?? body.movingDegree ?? 0,
              isFinalWord: body.ingressEvent.isFinalWord ?? body.isIngressFinalWord,
              turnIndex: body.ingressEvent.turnIndex,
            }
          : body.ingressEvent
            ? {
                movingPlanet: body.movingPlanet || 'Moon',
                newSign: body.movingSign || '',
                newDegree: body.movingDegree ?? 0,
                isFinalWord: body.isIngressFinalWord,
              }
            : undefined,
      recentTurns: Array.isArray(body.recentTurns)
        ? body.recentTurns.map(
            (t: any, idx: number): CouncilTurnContext => ({
              turnId: t.turnId || `turn-${idx}`,
              speakerKey: t.speakerKey || t.speaker?.toLowerCase?.() || 'gregory',
              speakerName: t.speakerName || t.speaker || 'Gregory',
              text: (t.text || '').trim(),
              claim: (t.claim || t.newClaim || t.text?.slice(0, 100) || '').trim(),
              speechAct: t.speechAct || 'speak',
            })
          )
        : undefined,
      selectedAgentFilter: body.selectedAgentFilter,
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
