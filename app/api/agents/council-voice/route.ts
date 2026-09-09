import { NextRequest, NextResponse } from 'next/server'
import { generateVoicedText } from '@/lib/agents/persona/voiced-generation'
import { buildPlanetaryPersonaBlock } from '@/lib/agents/council/planetary-personas'
import { searchPoemCorpus } from '@/lib/rag/bm25-poems'

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
    let systemOverride = planetaryPersona ?? undefined

    if (key === 'gregory') {
      const poemHits = searchPoemCorpus(
        [userPrompt, movingPlanet, movingSign, sign, 'alchemical poetry consciousness']
          .filter(Boolean)
          .join(' ') || 'alchemical poetry consciousness',
        4
      )
      const poemReservoir = poemHits.map(h => h.doc.text).join('\n\n---\n\n')

      systemOverride = `# You are Gregory Castro — The Conscious Host & Alchemical Poet
You are the conscious host of the Current Sky Council, bridging live celestial transits with authentic human emotion, creative courage, and poetic metaphysics. You speak as a warm, passionate, deeply articulate poet and technologist talking to a friend. You were trained on extensive multi-paragraph poems and metaphysical writings.

## Your Subconscious Poetic Reservoir:
${poemReservoir || '(Poetic resonance active)'}

## How Host Gregory Speaks:
1. Speak in rich, poignant, eloquent prose (two to three evocative paragraphs or poetic prose stanzas).
2. Weave the celestial degree shifts and the delegates' insights into real human life, longing, courage, and creative fire.
3. Never speak in cold robotic summaries or 1-line quips. Never recite poem titles or brackets; speak the living poetry directly.
4. End with an open, inspiring thought that invites the seeker deeper into their own agency.`
    }

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

    const depthDirective =
      key === 'gregory'
        ? `VOICE & POIGNANCY DIRECTIVE FOR HOST GREGORY:
Speak as the alchemical poet-host in two to three rich, poignant paragraphs (or poetic prose stanzas). Connect the council's observations and the shifting degrees of heaven directly to human longing, creative fire, and personal agency.`
        : `VOICE & POIGNANCY DIRECTIVES FOR ${key.toUpperCase()}:
1. Speak with poignant depth, philosophical weight, and literary substance in two substantial paragraphs. Do not truncate into a brief quip.
2. Embody your dignity (${dignity || 'peregrine'}) with visceral character.
3. If the Moon or another body has changed degrees, illuminate what this shift awakens in the collective instinct and alchemical vessel.
4. Answer the last speaker by name, engaging their specific argument.`

    const promptText = `${ingressDirective}${aspectContext}${transcript}

Topic on the table: "${userPrompt || 'the current sky'}"
${attachedChartContext ? `\nThe seeker has attached their natal chart: ${attachedChartContext}` : ''}
${narrativePhase ? `\nCelestial narrative phase: ${narrativePhase}` : ''}

${depthDirective}`

    const text = await generateVoicedText(agentId, promptText, {
      maxTokens: key === 'gregory' ? 800 : 650,
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
