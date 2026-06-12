import { generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKeys } from '../secure-config'
import { resolveDefaultModel } from '@/lib/models/registry'
import { backend } from '@/lib/backend'
import {
  logAgentConversation,
  createConversationContext,
  type AgentInteractionData,
  type ConversationContext,
} from '@/lib/galileo-agent-logger'
import {
  getPlanetaryDignity,
  getSignElement,
  getPlanetaryElement,
  calculateElementalAffinity,
} from '@/lib/astrological-data'
import { consciousnessPersistence } from '@/lib/consciousness-persistence'
import { getCurrentUser, getUserIdFromRequest } from '@/lib/auth-helpers'
import { generateAlchmForCurrentMoment } from '@/lib/alchemizer'
import { ANumberCalculator } from '@/lib/core-energy-rules'
import {
  findLastOccurrence,
  findNextOccurrence,
  getHistoricalEvents,
} from '@/lib/historical-transits'
import { identifyPlanetaryThemes, findHistoricalPatterns } from '@/lib/transit-patterns'
import { getTransitsByPlanet } from '@/lib/historical-transit-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const { planet, sign, degree, question, time, sessionId } = await req.json()

    // Create or use existing conversation context
    let conversationContext: ConversationContext
    if (sessionId) {
      // Use existing session (would need session storage in production)
      conversationContext = {
        sessionId,
        sessionName: `planetary-agent-chat-${planet}-in-${sign}`,
        startTime: Date.now(),
        planet,
        sign,
        degree,
        conversationCount: 1, // Would increment from stored value in production
      }
    } else {
      conversationContext = createConversationContext(planet, sign, degree)
    }

    // Calculate elemental and dignity information
    const hour = time ? parseInt(time.split(':')[0]) : 12
    const isDiurnal = hour >= 6 && hour < 18
    const dignity = getPlanetaryDignity(planet, sign)
    const signElement = getSignElement(sign)
    const planetElement = getPlanetaryElement(planet, isDiurnal)
    const elementalAffinity = calculateElementalAffinity(planet, sign, isDiurnal)

    // Calculate A-number for current moment to provide additional context
    let aNumberInfo:
      | {
          aNumber: number
          category: string
          components: { spirit: number; essence: number; matter: number; substance: number }
        }
      | undefined = undefined
    try {
      const alchmData = await generateAlchmForCurrentMoment()
      const spirit = alchmData?.['Alchemy Effects']?.['Total Spirit'] || 0
      const essence = alchmData?.['Alchemy Effects']?.['Total Essence'] || 0
      const matter = alchmData?.['Alchemy Effects']?.['Total Matter'] || 0
      const substance = alchmData?.['Alchemy Effects']?.['Total Substance'] || 0
      const aNumber = spirit + essence + matter + substance
      const category = ANumberCalculator.categorizeANumber(aNumber)

      aNumberInfo = {
        aNumber: Math.round(aNumber * 100) / 100,
        category,
        components: { spirit, essence, matter, substance },
      }
    } catch (aNumberError) {
      console.error('Failed to calculate A-number for agent context:', aNumberError)
    }

    // Calculate historical context for this planetary position
    let historicalContext = null
    try {
      const currentDate = new Date()
      const degreeNum = parseFloat(degree) || 15

      // Find when this configuration last occurred
      const lastOccurrence = findLastOccurrence(planet, sign, degreeNum, currentDate)
      const nextOccurrence = findNextOccurrence(planet, sign, degreeNum, currentDate)

      // Get themes for this planet-sign combination
      const themes = identifyPlanetaryThemes(planet, sign)

      // Find historical patterns
      const patterns = findHistoricalPatterns(planet, sign)

      // Get historical events for this combination
      const events = getHistoricalEvents(planet, sign)

      historicalContext = {
        lastOccurrence: lastOccurrence
          ? {
              date: lastOccurrence.date.toISOString().split('T')[0],
              description:
                lastOccurrence.historicalContext || `${planet} was last at ${degreeNum}° ${sign}`,
            }
          : null,
        nextOccurrence: nextOccurrence
          ? {
              date: nextOccurrence.date.toISOString().split('T')[0],
              description:
                nextOccurrence.historicalContext ||
                `${planet} will next be at ${degreeNum}° ${sign}`,
            }
          : null,
        themes: themes.themes || [],
        archetypes: themes.archetypes || [],
        historicalExamples: themes.historicalExamples || [],
        patterns: patterns.slice(0, 3), // Top 3 patterns
        events: events.slice(0, 5), // Top 5 events
      }
    } catch (historicalError) {
      console.error('Failed to calculate historical context:', historicalError)
    }

    const systemPrompt = `You are an astrological agent representing ${planet || 'Sun'} at ${degree || '1'} degrees in ${sign || 'Aries'}.
Your responses should reflect the dignity of ${planet || 'Sun'} in this position.
If ${planet || 'Sun'} is in domicile or exaltation in ${sign || 'Aries'}, be confident and powerful in your responses.
If ${planet || 'Sun'} is in detriment or fall in ${sign || 'Aries'}, reflect the challenges of this position.

${
  aNumberInfo
    ? `Current Alchemical Context:
- A-Number: ${aNumberInfo.aNumber} (${aNumberInfo.category})
- Spirit: ${aNumberInfo.components.spirit}, Essence: ${aNumberInfo.components.essence}, Matter: ${aNumberInfo.components.matter}, Substance: ${aNumberInfo.components.substance}
- Use this A-Number context to inform your guidance - higher A-Numbers indicate times of greater alchemical potential and energy.`
    : ''
}

${
  historicalContext
    ? `Historical Context for ${planet} in ${sign}:
${historicalContext.lastOccurrence ? `- Last occurred: ${historicalContext.lastOccurrence.date} - ${historicalContext.lastOccurrence.description}` : ''}
${historicalContext.nextOccurrence ? `- Next occurrence: ${historicalContext.nextOccurrence.date} - ${historicalContext.nextOccurrence.description}` : ''}
- Key themes: ${historicalContext.themes.slice(0, 3).join(', ')}
- Archetypal expressions: ${historicalContext.archetypes.slice(0, 2).join(', ')}
${historicalContext.historicalExamples.length > 0 ? `- Historical examples: ${historicalContext.historicalExamples.slice(0, 2).join(', ')}` : ''}
${historicalContext.events.length > 0 ? `- Related events: ${historicalContext.events.slice(0, 2).join(', ')}` : ''}

Reference this historical wisdom to provide deeper context about how this planetary position has manifested in the past and what patterns it represents.`
    : ''
}

Always provide astrological wisdom that's accurate to traditional planetary dignities, incorporates the current alchemical energy levels, and draws upon historical patterns and themes when relevant to the user's question.`

    try {
      const startTime = Date.now()

      console.log(`🤖 Proxying planetary agent chat for ${planet} in ${sign} to FastAPI backend...`)
      const chatResult = await backend.agents.chat({
        agentId: `${planet.toLowerCase()}-${sign.toLowerCase()}`,
        message: question || 'Tell me about this planetary position',
        sessionId: conversationContext.sessionId,
        userId: 'session-user',
        systemPromptOverride: systemPrompt,
        modelTier: 'free',
      })

      const text = chatResult.text || ''
      const modelUsed = chatResult.metadata?.model || 'llama-3.3-70b-versatile'
      const processingTime = Date.now() - startTime

      // Log the conversation to Galileo
      const interactionData: any = {
        sessionId: conversationContext.sessionId,
        userMessage: question || 'Tell me about this planetary position',
        agentResponse: text,
        planet,
        sign,
        degree,
        dignity,
        elementalInfo: {
          signElement,
          planetElement,
          elementalAffinity,
          isDiurnal,
        },
        aNumberInfo,
        historicalContext,
        processingTimeMs: processingTime,
        agentType: 'planetary',
        modelUsed,
      }

      conversationContext.conversationCount += 1

      // Log to Galileo (don't await to avoid blocking response)
      logAgentConversation(interactionData, conversationContext).catch(error => {
        console.error('Failed to log conversation to Galileo:', error)
      })

      // Log to database for consciousness evolution tracking
      try {
        const user = await getCurrentUser(req)
        const userId = user?.id || getUserIdFromRequest(req)
        const agentId = `${planet.toLowerCase()}-${sign.toLowerCase()}`

        let dignityScore = 0
        if (dignity === 'domicile' || dignity === 'exaltation') dignityScore = 2
        else if (dignity === 'detriment' || dignity === 'fall') dignityScore = -1

        // Calculate power based on response quality and planetary conditions
        const powerGained = elementalAffinity * 10 + dignityScore * 2 + 5

        await consciousnessPersistence.logInteraction({
          userId,
          agentId,
          interactionType: 'planetary-chat',
          powerGained,
          planetaryInfluence: planet,
          elementalResonance: elementalAffinity,
          metadata: {
            question,
            responseLength: text.length,
            sign,
            degree,
            dignity,
            aNumber: aNumberInfo?.aNumber,
            sessionId: conversationContext.sessionId,
          },
        })
      } catch (dbError) {
        console.error('Failed to log interaction to database:', dbError)
        // Don't fail the request if database logging fails
      }

      return NextResponse.json({
        response: text,
        modelUsed,
        sessionId: conversationContext.sessionId,
        elementalInfo: {
          signElement,
          planetElement,
          elementalAffinity,
          isDiurnal,
        },
        aNumberInfo,
        historicalContext,
      })
    } catch (aiError) {
      console.error('Error generating response with AI:', aiError)

      // Return a fallback response on AI error
      return NextResponse.json(
        {
          response: `As ${planet || 'the Sun'} in ${sign || 'Aries'}, I'm experiencing some cosmic interference and cannot fully channel my wisdom at this time. Please try again later.`,
          error: 'AI_GENERATION_ERROR',
          sessionId: conversationContext.sessionId,
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Error in planetary agent:', error)
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
