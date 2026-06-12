import { generateText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveOpenAIModel } from '@/lib/models/registry'
import {
  logAgentConversation,
  createConversationContext,
  type AgentInteractionData,
  type ConversationContext,
} from '@/lib/galileo-agent-logger'
import { backend, getAlchemicalQuantitiesLegacy } from '@/lib/backend'
import { ANumberCalculator } from '@/lib/core-energy-rules'

const planetaryPositionInputSchema = z.object({
  planet: z
    .string()
    .describe(
      'Planet name (e.g. Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto)'
    ),
  date: z.string().optional().describe('ISO 8601 date/time. Defaults to current time if omitted.'),
  latitude: z.number().optional().describe('Latitude in decimal degrees. Defaults to NYC.'),
  longitude: z.number().optional().describe('Longitude in decimal degrees. Defaults to NYC.'),
})

type PlanetaryPositionInput = z.infer<typeof planetaryPositionInputSchema>

const historicalInterpretationInputSchema = z.object({
  planet: z.string().describe('Planet name'),
  sign: z.string().optional().describe('Zodiac sign. If omitted, current sign is fetched.'),
  date: z.string().optional().describe('ISO 8601 date for the lookup (defaults to now).'),
})

type HistoricalInterpretationInput = z.infer<typeof historicalInterpretationInputSchema>

interface AdvancedAgentRequest {
  query?: string
  birthData?: unknown
  sessionId?: string
}

// Inline replacements for the deleted `@/lib/astrological-tools` Vercel AI SDK tools.
// Both call the Railway backend via `planetaryAPI` and adapt the new flat
// `planetary_positions` shape into the response the agent prompt expected.
const calculatePlanetaryPosition = tool({
  description:
    'Calculate the position of a planet (sign, degree, retrograde status, longitude) for a given UTC date/time and optional location. Use this to ground astrological interpretations in precise astronomical data.',
  inputSchema: planetaryPositionInputSchema,
  execute: async ({ planet, date, latitude, longitude }: PlanetaryPositionInput) => {
    const when = date ? new Date(date) : new Date()
    const raw = await backend.planetary.positions(when, latitude, longitude)
    const positions = raw?.planetary_positions || {}
    const matchKey = Object.keys(positions).find(
      k => k.toLowerCase() === String(planet).toLowerCase()
    )
    if (!matchKey) {
      return {
        planet,
        error: `No position returned for ${planet}`,
        availablePlanets: Object.keys(positions),
      }
    }
    const body = positions[matchKey] || {}
    return {
      planet: matchKey,
      sign: body?.sign ?? null,
      degree: typeof body?.degree === 'number' ? body.degree : null,
      minute: typeof body?.minute === 'number' ? body.minute : null,
      longitude: typeof body?.exactLongitude === 'number' ? body.exactLongitude : null,
      isRetrograde: Boolean(body?.isRetrograde),
      timestamp: when.toISOString(),
    }
  },
})

const getHistoricalInterpretation = tool({
  description:
    'Get a brief historical/traditional astrological interpretation for a planet in a given zodiac sign. Pulls a basic interpretation derived from current position data; use this for narrative context, not precision claims.',
  inputSchema: historicalInterpretationInputSchema,
  execute: async ({ planet, sign, date }: HistoricalInterpretationInput) => {
    let resolvedSign = sign
    if (!resolvedSign) {
      const when = date ? new Date(date) : new Date()
      const raw = await backend.planetary.positions(when)
      const positions = raw?.planetary_positions || {}
      const matchKey = Object.keys(positions).find(
        k => k.toLowerCase() === String(planet).toLowerCase()
      )
      resolvedSign = matchKey ? positions[matchKey]?.sign : undefined
    }
    return {
      planet,
      sign: resolvedSign ?? 'unknown',
      interpretation: resolvedSign
        ? `${planet} in ${resolvedSign}: traditional astrology associates this placement with the qualities of ${resolvedSign}. Combine with house and aspect context for a fuller reading.`
        : `Unable to resolve ${planet}'s sign for historical interpretation.`,
      source: 'derived from live planetary positions (Railway backend)',
    }
  },
})

export async function POST(req: Request) {
  try {
    const { query, birthData: _birthData, sessionId }: AdvancedAgentRequest = await req.json()

    // Create or use existing conversation context
    let conversationContext: ConversationContext
    if (sessionId) {
      conversationContext = {
        sessionId,
        sessionName: 'advanced-agent-chat',
        startTime: Date.now(),
        conversationCount: 1, // Would increment from stored value in production
      }
    } else {
      conversationContext = createConversationContext()
      conversationContext.sessionName = 'advanced-agent-chat'
    }

    // Calculate A-number for current moment to provide additional context
    let aNumberInfo:
      | {
          aNumber: number
          category: string
          components: { spirit: number; essence: number; matter: number; substance: number }
        }
      | undefined = undefined
    try {
      const alchmData = await getAlchemicalQuantitiesLegacy()
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
      console.error('Failed to calculate A-number for advanced agent context:', aNumberError)
    }

    const startTime = Date.now()

    const systemPrompt = `You are an advanced astrological agent with access to precise astronomical calculations and historical texts.

${
  aNumberInfo
    ? `Current Alchemical Context:
- A-Number: ${aNumberInfo.aNumber} (${aNumberInfo.category})
- Spirit: ${aNumberInfo.components.spirit}, Essence: ${aNumberInfo.components.essence}, Matter: ${aNumberInfo.components.matter}, Substance: ${aNumberInfo.components.substance}
- Factor this A-Number context into your interpretations - higher A-Numbers indicate times of greater alchemical potential and energy.`
    : ''
}

Provide comprehensive astrological analysis that incorporates both traditional techniques and the current alchemical energy levels.`

    const { text } = await generateText({
      model: openai(resolveOpenAIModel('powerful')),
      system: systemPrompt,
      prompt: query || 'Tell me about my chart',
      tools: {
        calculatePlanetaryPosition,
        getHistoricalInterpretation,
      },
    })

    const processingTime = Date.now() - startTime

    // Log the conversation to Galileo
    const interactionData: AgentInteractionData = {
      sessionId: conversationContext.sessionId,
      userMessage: query || 'Tell me about my chart',
      agentResponse: text,
      aNumberInfo: aNumberInfo || {
        aNumber: 0,
        category: 'Unknown',
        components: { spirit: 0, essence: 0, matter: 0, substance: 0 },
      },
      processingTimeMs: processingTime,
      agentType: 'advanced',
    }

    conversationContext.conversationCount += 1

    // Log to Galileo (don't await to avoid blocking response)
    logAgentConversation(interactionData, conversationContext).catch(error => {
      console.error('Failed to log advanced agent conversation to Galileo:', error)
    })

    return NextResponse.json({
      response: text,
      sessionId: conversationContext.sessionId,
      aNumberInfo,
    })
  } catch (error) {
    console.error('Error in advanced agent:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
