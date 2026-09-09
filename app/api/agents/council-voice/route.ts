import { NextRequest, NextResponse } from 'next/server'
import { generateVoicedText } from '@/lib/agents/persona/voiced-generation'
import { buildPlanetaryPersonaBlock } from '@/lib/agents/council/planetary-personas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The host is the one delegate with a real `CraftedAgent` behind them, so
 * Gregory keeps going through the agent registry. The ten planets have no
 * agent record — they arrive as a `systemOverride` persona block instead. See
 * `lib/agents/council/planetary-personas.ts` for why that indirection exists.
 */
const HOST_AGENT_ID = 'greg-castro-1991'

interface CouncilTurn {
  speaker: string
  text: string
}

/** Keep the transcript short — this is a round table, not a context dump. */
const MAX_RECENT_TURNS = 3

function sanitizeTurns(value: unknown): CouncilTurn[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (t): t is CouncilTurn =>
        !!t &&
        typeof t === 'object' &&
        typeof (t as CouncilTurn).speaker === 'string' &&
        typeof (t as CouncilTurn).text === 'string' &&
        (t as CouncilTurn).text.trim().length > 0
    )
    .slice(-MAX_RECENT_TURNS)
    .map(t => ({ speaker: t.speaker.trim(), text: t.text.trim().slice(0, 400) }))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      agentKey,
      userPrompt,
      attachedChartContext,
      fallbackText,
      narrativePhase,
      sign,
      degree,
      degreeLabel,
      dignity,
      retrograde,
      ingressEvent,
      movingPlanet,
      movingSign,
      movingDegree,
      isClosestToIngress,
      angularDistance,
      isIngressFinalWord,
      recentTurns,
      aspectName,
      aspectOrb,
      aspectPhase,
      aspectQuality,
    } = body || {}

    const key = (agentKey || 'gregory').toLowerCase()
    const resolvedDegreeLabel =
      degreeLabel || (typeof degree === 'number' ? `${Math.floor(degree)}°` : '')

    const planetaryPersona = buildPlanetaryPersonaBlock(key, {
      sign,
      degreeLabel: resolvedDegreeLabel,
      dignity,
      retrograde,
    })

    // Planets carry their own persona block; the host resolves through the
    // registry. Anything unrecognised falls back to the host rather than
    // producing a voiceless delegate.
    const agentId = HOST_AGENT_ID
    const systemOverride = planetaryPersona ?? undefined

    const turns = sanitizeTurns(recentTurns)
    const transcript = turns.length
      ? `\nWHAT THE COUNCIL JUST SAID (most recent last):\n${turns
          .map(t => `- ${t.speaker}: "${t.text}"`)
          .join(
            '\n'
          )}\n\nAnswer the last speaker by name. Agree, sharpen, or refuse — do not restate them.`
      : ''

    const aspectContext =
      typeof aspectName === 'string' && aspectName
        ? `\nYOUR GEOMETRY TO THE MOVING BODY: ${aspectName}${
            typeof aspectOrb === 'number' ? `, orb ${aspectOrb.toFixed(1)}°` : ''
          }${aspectPhase ? `, ${aspectPhase}` : ''}${
            aspectQuality ? ` (${aspectQuality})` : ''
          }.\nLet that geometry shape what you claim. A square does not sound like a trine.`
        : ''

    let ingressDirective = ''
    if (ingressEvent) {
      if (isIngressFinalWord) {
        ingressDirective = `
INGRESS — YOU TAKE THE FLOOR LAST:
You have just arrived at ${resolvedDegreeLabel} ${sign}. Every other delegate has
weighed in on your arrival. Answer what they said, then claim the degree and set
the intent for the cycle it opens.`
      } else if (isClosestToIngress) {
        ingressDirective = `
INGRESS — YOU SPEAK FIRST (NEAREST BODY):
${movingPlanet || 'A fellow delegate'} has moved to ${movingDegree ?? ''}° ${movingSign ?? ''}.
You are the nearest body in the sky, ${angularDistance ?? 'a few'}° away. Open the
reaction: say what lands in your own sector before anyone else has framed it.`
      } else {
        ingressDirective = `
INGRESS — COUNCIL REACTION:
${movingPlanet || 'A fellow delegate'} has moved to ${movingDegree ?? ''}° ${movingSign ?? ''}.
From ${resolvedDegreeLabel} ${sign || 'your seat'}, react. Say what it changes in the
balance of the whole — and take a position the previous speaker did not.`
      }
    }

    const promptText = `${ingressDirective}${aspectContext}${transcript}

Topic on the table: "${userPrompt || 'the current sky'}"
${attachedChartContext ? `\nThe seeker has attached their natal chart: ${attachedChartContext}` : ''}
${narrativePhase ? `\nCelestial narrative phase: ${narrativePhase}` : ''}

Speak now, in one or two sentences, as yourself.`

    const text = await generateVoicedText(agentId, promptText, {
      maxTokens: 250,
      fallback: fallbackText || '',
      systemOverride,
    })

    return NextResponse.json({
      success: true,
      text,
      persona: systemOverride ? key : 'host',
    })
  } catch (err) {
    console.warn('[api/agents/council-voice] Error generating council voice:', err)
    return NextResponse.json({
      success: false,
      text: null,
    })
  }
}
