import { NextRequest, NextResponse } from 'next/server'
import { generateVoicedText } from '@/lib/agents/persona/voiced-generation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AGENT_MAP: Record<string, string> = {
  gregory: 'greg-castro-1991',
}

const AGENT_BASE_ARCHETYPES: Record<string, string> = {
  sun: 'Sun, the Solar Radiance & Core Identity. Speak with warmth, illuminating clarity, and centered authority.',
  moon: 'Moon, the Lunar Tide & Subconscious Archetype. Speak with deep emotional nuance, instinctual resonance, and intuitive truth.',
  mercury:
    'Mercury, the Messenger & Mental Architect. Speak with sharp agility, articulate perception, and analytical clarity.',
  venus:
    'Venus, the Harmonic Weaver & Principle of Value. Speak with aesthetic poise, diplomatic grace, and magnetic relational wisdom.',
  mars: 'Mars, the Dynamic Vector & Sovereign Will. Speak with direct courage, decisive drive, and instinctual strength.',
  jupiter:
    'Jupiter, the Sovereign Visionary & Principle of Growth. Speak with generous magnanimity, expansive vision, and elevated optimism.',
  saturn:
    'Saturn, the Master of Form & Sacred Boundary. Speak with disciplined sobriety, structural resolve, and patient timeless mastery.',
  uranus:
    'Uranus, the Electric Catalyst & Paradigm Breaker. Speak with sudden revelation, breakthrough clarity, and liberating cognitive agility.',
  neptune:
    'Neptune, the Oceanic Mystic & Transcendent Dreamer. Speak with visionary poetry, dissolution of illusions, and spiritual depth.',
  pluto:
    'Pluto, the Deep Alchemist & Evolutionary Fire. Speak with regenerative power, karmic depth, and radical metamorphosis.',
  gregory:
    'Gregory Castro, the Conscious Host & Alchemical Poet. Speak as an exceptionally animated, warm, passionate, articulate, and poetic host who bridges human emotion, creative action, poetry, and live celestial transits with vibrant energy.',
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
      dignity,
      ingressEvent,
      movingPlanet,
      movingSign,
      movingDegree,
      isClosestToIngress,
      angularDistance,
      isIngressFinalWord,
    } = body || {}

    const key = (agentKey || 'gregory').toLowerCase()
    const agentId = AGENT_MAP[key] || 'greg-castro-1991'
    const baseArchetype = AGENT_BASE_ARCHETYPES[key] || AGENT_BASE_ARCHETYPES.gregory

    const degreeLabel = typeof degree === 'number' ? `${Math.floor(degree)}°` : ''
    const signLabel = sign ? `in ${sign}` : ''
    const dignityLabel = dignity ? `(${dignity})` : ''
    const currentIdentity =
      `${key.toUpperCase()} ${signLabel} ${degreeLabel} ${dignityLabel}`.trim()

    let ingressDirective = ''
    if (ingressEvent) {
      if (isIngressFinalWord) {
        ingressDirective = `
INGRESS EVENT - FINAL RESPONSE (THE MOVING PLANET TAKES THE FLOOR):
You are ${key.toUpperCase()}, and you just arrived into ${degreeLabel} ${sign}!
All other council planets have weighed in on your arrival. Now you claim the stage, deliver the definitive final statement, and set the tone/intent for this new degree cycle. Speak with proud, authentic embodiment of your new sign and degree!`
      } else if (isClosestToIngress) {
        ingressDirective = `
INGRESS EVENT - CLOSEST NEIGHBOR CONTEXT (SPEAKING FIRST):
${movingPlanet || 'A fellow planet'} just transitioned to ${movingDegree ?? ''}° ${movingSign ?? ''}.
You are currently the CLOSEST planet in the entire council (only ${angularDistance ?? 'a few'} degrees away)!
Speak FIRST to provide immediate nearby celestial context. Comment on how this sudden shift directly impacts your immediate sector of the zodiac.`
      } else {
        ingressDirective = `
INGRESS EVENT - COUNCIL REACTION:
${movingPlanet || 'A fellow planet'} just moved to ${movingDegree ?? ''}° ${movingSign ?? ''}.
From your vantage point in ${sign || 'the sky'} at ${degreeLabel}, react and comment on this degree shift. How does this alter the collective balance, aspects, or elemental tension?`
      }
    }

    const promptText = `
Role: You are ${currentIdentity}. Archetype: ${baseArchetype}

${ingressDirective}

Topic / User Prompt: "${userPrompt || 'Current sky dialogue'}"
${attachedChartContext ? `Attached User Natal Chart Context: ${attachedChartContext}` : ''}
${narrativePhase ? `Celestial Narrative Phase: ${narrativePhase}` : ''}

CRITICAL COMMUNICATION DIRECTIVES:
1. NATURAL & LIVING TONE: Speak completely naturally in your authentic planetary voice. Never sound robotic, like an API, or like an algorithm.
2. SHORT & PUNCHY: Keep response strictly to 1 or 2 vivid, memorable sentences.
3. ORGANIC CONVERSATION: Build directly upon the current sky moment and the dialogue of your fellow delegates.
4. HOST EMBODIMENT: If Gregory Castro, speak as a passionate, warm alchemical poet weaving cosmic transits and human life together.
`

    const text = await generateVoicedText(agentId, promptText, {
      maxTokens: 250,
      fallback: fallbackText || '',
    })

    return NextResponse.json({
      success: true,
      text,
    })
  } catch (err) {
    console.warn('[api/agents/council-voice] Error generating council voice:', err)
    return NextResponse.json({
      success: false,
      text: null,
    })
  }
}
