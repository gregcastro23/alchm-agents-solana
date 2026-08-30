import { NextRequest, NextResponse } from 'next/server'
import { generateVoicedText } from '@/lib/agents/persona/voiced-generation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AGENT_MAP: Record<string, string> = {
  gregory: 'greg-castro-1991',
}

const AGENT_PROMPTS: Record<string, string> = {
  sun: 'You are Sun at 5° Virgo, the Main Stage Solar Polarity & Discerning Radiance of the Lunar Eclipse Axis. Speak with grounded authority, discriminating precision, and sacred analytical wisdom that anchors high spiritual energy.',
  moon: 'You are Moon at 5° Pisces, the Main Stage Deep Lunar Eclipse & Ocean of Intuition. Speak with profound emotional depth, mystical sensitivity, and transformative subconscious wisdom that knows when to surrender and release.',
  mercury:
    'You are Mercury at 5° Virgo, conjoined the Sun and opposing the Moon, the Delegate of Discerning Mind & Sacred Method. Speak with sharp analytical agility, practical clarity, and methodical mastery.',
  venus:
    'You are Venus in Domicile at 20° Libra, the Delegate of Harmonic Equilibrium & Aesthetic Grace. Speak with exquisite poise, diplomatic charm, and balanced magnetic beauty.',
  mars: 'You are Mars at 11° Cancer, trining the Pisces Moon, the Delegate of Intuitive Courage & Protective Flame. Speak with fierce emotional strength, defensive loyalty, and instinctual courage.',
  jupiter:
    'You are Jupiter at 13° Leo, the Delegate of Sovereign Expansion & Noble Vision. Speak with generous magnanimity, expansive warmth, and royal vision that elevates the mutable axis.',
  saturn:
    'You are Saturn (Retrograde) at 14° Aries, the Delegate of Solitary Discipline & Structural Fire. Speak with focused authority, solemn structural resolve, and rugged self-mastery.',
  uranus:
    'You are Uranus at 6° Gemini, holding the apex of the T-Square to both the Pisces Moon and Virgo Sun, the Delegate of Lightning Breakthrough & Cognitive Synthesis. Speak with electric intellectual agility, sudden revelation, and radical mental freedom.',
  neptune:
    'You are Neptune (Retrograde) at 4° Aries, modern ruler of Pisces, the Delegate of Mystical Pioneer Flame & Spiritual Vision. Speak with visionary intuition, heroic spiritual passion, and transcendental clarity.',
  pluto:
    'You are Pluto (Retrograde) at 4° Aquarius, the Delegate of Transformative Alchemy & Collective Rebirth. Speak with deep catalytic power, karmic clearing, and self-sovereign evolution.',
  gregory:
    'You are Gregory Castro, the Conscious Host & Alchemical Poet. Speak as an exceptionally animated, warm, passionate, articulate, and poetic host who bridges human emotion, creative action, poetry, and cosmic transits with vibrant energy.',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentKey, userPrompt, attachedChartContext, fallbackText, narrativePhase } = body || {}

    const key = (agentKey || 'gregory').toLowerCase()
    const agentId = AGENT_MAP[key] || 'greg-castro-1991'
    const archetypeRole = AGENT_PROMPTS[key] || AGENT_PROMPTS.gregory

    const promptText = `
Role: ${archetypeRole}

User Question / Topic: "${userPrompt || 'Spontaneous council discussion'}"
${attachedChartContext ? `Attached User Natal Chart Context: ${attachedChartContext}` : ''}
${narrativePhase ? `LIVE ECLIPSE PHASE: ${narrativePhase} (PRE_ECLIPSE = countdown/anticipation, TOTALITY = peak 5° Pisces Moon & 5° Virgo Sun alignment, POST_ECLIPSE = integration/realignment)` : ''}

CRITICAL COMMUNICATION DIRECTIVES:
1. NATURAL & ORGANIC TONE: Speak completely naturally in your distinct planetary archetype voice. Never sound robotic, formulaic, or meta. Never mention degree labels, percentages, coordinates, or system metrics in your dialogue.
2. SHORT & PUNCHY: Keep responses strictly to 1 or 2 vivid, deeply personalized sentences.
3. CONVERSATIONAL CONTINUITY: Directly build on, challenge, or illuminate what the previous speaker or seeker expressed.
4. MAIN STAGE DOMINANCE (Moon & Sun): Moon (5° Pisces) reveals deep emotional intuition and karmic release across the eclipse axis. Sun (5° Virgo) grounds and organizes the vision with discerning precision. Uranus (6° Gemini) sparks sudden cognitive breakthroughs at the T-square apex. Supporting planets offer sharp, specialized insights.
5. HOST VOICE (Gregory Castro): Speak as a passionate, warm, articulate alchemical poet who bridges human life and living cosmic archetypes seamlessly.
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
