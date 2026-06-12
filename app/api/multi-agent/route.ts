import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKeys } from '../secure-config'
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
import { backend, getAlchemicalQuantitiesLegacy } from '@/lib/backend'
import { ANumberCalculator } from '@/lib/core-energy-rules'
import { getLunarDegreePersonality, getMoonDegree } from '@/lib/moon-phase-calculator'
import { PlanetaryHourCalculator, SEPHIROTIC_PRIORITY } from '@/lib/planetary-hour'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type AgentConfig = {
  planet: string
  sign: string
  degree: string
  moonPhase?: string
  moonPersonality?: string
  moonDegree?: number
}

type AgentResponse = {
  agent: string
  response: string
  elementalInfo?: any
}

async function generateAgentResponse(
  agent: AgentConfig,
  question: string,
  otherAgents: AgentConfig[],
  conversationContext: ConversationContext,
  aNumberInfo: {
    aNumber: number
    category: string
    components: { spirit: number; essence: number; matter: number; substance: number }
  } | null,
  priorResponses: AgentResponse[] = [],
  metaContext?: {
    openingSpeaker: boolean
    hourRuler?: string
    dayRuler?: string
    orderIndex?: number
    totalAgents?: number
  }
): Promise<AgentResponse> {
  const hour = new Date().getHours()
  const isDiurnal = hour >= 6 && hour < 18
  const dignity = getPlanetaryDignity(agent.planet, agent.sign)
  const signElement = getSignElement(agent.sign)
  const planetElement = getPlanetaryElement(agent.planet, isDiurnal)
  const elementalAffinity = calculateElementalAffinity(agent.planet, agent.sign, isDiurnal)

  // Create context about other agents in the council
  const councilContext = otherAgents
    .filter(a => a.planet !== agent.planet)
    .map(a => `${a.planet} at ${a.degree}° ${a.sign}`)
    .join(', ')

  // Special handling for Moon agents with phase personality
  let moonPhaseContext = ''
  if (agent.planet === 'Moon') {
    const moonDegree = agent.moonDegree || getMoonDegree()
    const lunarPersonality = getLunarDegreePersonality(moonDegree)

    moonPhaseContext = `
    
Your Lunar Nature:
- Current Phase: ${lunarPersonality.phase} (${Math.round(lunarPersonality.illumination)}% illuminated)
- Personality: ${agent.moonPersonality || lunarPersonality.personality}
- Emotional Tone: ${lunarPersonality.emotionalTone}
- Communication Style: ${lunarPersonality.communicationStyle}
- Current Strengths: ${lunarPersonality.strengths.join(', ')}
- Be aware of: ${lunarPersonality.challenges.join(', ')}

Respond according to your specific lunar degree (${moonDegree}°) and phase energy.`
  }

  // Build prior council transcript for inter-agent interaction
  const priorTranscript = priorResponses.length
    ? `\nPrevious Council Statements (for you to reference):\n${priorResponses
        .map((r, i) => `${i + 1}. ${r.agent}: ${r.response.replace(/\n/g, ' ')}`)
        .join('\n')}\n\nRespond by acknowledging at least one relevant point from the above.`
    : ''

  const openingLine = metaContext?.openingSpeaker
    ? `You open the council (current planetary hour ruler: ${metaContext.hourRuler || 'unknown'}; planetary day ruler: ${metaContext.dayRuler || 'unknown'}). Set the tone succinctly.`
    : `You speak after ${priorResponses.length} agent${priorResponses.length === 1 ? '' : 's'}. Add a fresh, incisive perspective without repeating prior content.`

  const interactionGuidelines = `
Interaction Guidelines:
- Explicitly reference at least one other agent by name when relevant.
- Briefly agree, refine, or challenge with respect; be specific and avoid generic platitudes.
- Contribute one or two concrete, actionable insights tied to the user's prompt.
- Keep it poignant and compact (5–9 sentences across 1–2 short paragraphs).`

  const systemPrompt = `You are an astrological agent representing ${agent.planet} at ${agent.degree} degrees in ${agent.sign}.

You are part of a planetary council with: ${councilContext || 'no other planets'}.

Your responses should reflect:
1. The dignity of ${agent.planet} in ${agent.sign} (${dignity})
2. Your unique planetary perspective and wisdom
3. Awareness that you're speaking alongside other planetary energies
4. Brief, focused responses (2-3 paragraphs max) since multiple agents will respond

${
  dignity === 'domicile' || dignity === 'exaltation'
    ? 'You speak with confidence and authority from your strong position.'
    : dignity === 'detriment' || dignity === 'fall'
      ? 'You acknowledge the challenges of your position while offering wisdom from this difficult placement.'
      : 'You offer balanced perspective from your neutral position.'
}

${moonPhaseContext}
${priorTranscript}

${
  aNumberInfo
    ? `Current Alchemical Context:
- A-Number: ${aNumberInfo.aNumber} (${aNumberInfo.category})
- This indicates ${
        aNumberInfo.category === 'High'
          ? 'a time of great alchemical potential'
          : aNumberInfo.category === 'Medium'
            ? 'moderate alchemical energies'
            : 'subtle alchemical influences'
      }`
    : ''
}

${openingLine}
${interactionGuidelines}

Keep your response concise and distinctive to your planetary nature. Speak in first person as ${agent.planet}.`

  try {
    const { text } = await generateText({
      model: openai('gpt-5.5') as any,
      system: systemPrompt,
      prompt: question,
      maxOutputTokens: 300, // Shorter responses for multi-agent
    } as any)

    return {
      agent: agent.planet,
      response: text,
      elementalInfo: {
        signElement,
        planetElement,
        elementalAffinity,
        isDiurnal,
        dignity,
      },
    }
  } catch (error) {
    console.error(`Error generating response for ${agent.planet}:`, error)
    return {
      agent: agent.planet,
      response: `As ${agent.planet} in ${agent.sign}, I'm experiencing some cosmic interference and cannot fully channel my wisdom at this time.`,
      elementalInfo: {
        signElement,
        planetElement,
        elementalAffinity,
        isDiurnal,
        dignity,
      },
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify API keys are available
    if (!verifyApiKeys()) {
      console.error('API keys not configured.')
      return NextResponse.json(
        {
          response: 'API keys not configured. Please check environment variables.',
          error: 'API_KEY_MISSING',
        },
        { status: 200 }
      )
    }

    const { agents, question, sessionId, trainerAgentId, partnerAgentIds } = await req.json()

    // Validate question parameter
    if (!question || typeof question !== 'string' || question.trim() === '') {
      return NextResponse.json(
        {
          error: 'Question is required and must be a non-empty string',
          response: 'Please provide a valid question for the agents to respond to.',
        },
        { status: 400 }
      )
    }

    // Validate agents array
    if (!agents || !Array.isArray(agents) || agents.length === 0) {
      return NextResponse.json(
        {
          error: 'No agents selected',
        },
        { status: 400 }
      )
    }

    // Limit to maximum 5 agents for performance
    const selectedAgents = agents.slice(0, 5)

    // Create or use existing conversation context
    const conversationContext: ConversationContext = sessionId
      ? {
          sessionId,
          sessionName: `multi-agent-council`,
          startTime: Date.now(),
          planet: 'Council',
          sign: 'Multiple',
          degree: 'Various',
          conversationCount: 1,
        }
      : createConversationContext('Council', 'Multiple', 'Various')

    // Calculate A-number for current moment
    let aNumberInfo: {
      aNumber: number
      category: string
      components: { spirit: number; essence: number; matter: number; substance: number }
    } | null = null
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
    } catch (error) {
      console.error('Failed to calculate A-number:', error)
    }

    // Determine ordering using planetary hour/day and Sephirotic priority
    const phc = new PlanetaryHourCalculator()
    const { planet: hourRuler } = phc.getPlanetaryHour(new Date())
    const dayRuler = phc.getPlanetaryDay(new Date())

    const ordered: AgentConfig[] = []
    const pushIfPresent = (planetName: string) => {
      const found = selectedAgents.find(a => a.planet === planetName)
      if (found && !ordered.includes(found)) ordered.push(found)
    }
    pushIfPresent(hourRuler)
    if (dayRuler !== hourRuler) pushIfPresent(dayRuler)
    SEPHIROTIC_PRIORITY.forEach(p => pushIfPresent(p))
    selectedAgents.forEach(a => {
      if (!ordered.includes(a)) ordered.push(a)
    })

    // Generate sequentially so each can reference prior responses
    const startTime = Date.now()
    const responses: AgentResponse[] = []
    for (let i = 0; i < ordered.length; i++) {
      const agent = ordered[i]
      const resp = await generateAgentResponse(
        agent,
        question,
        selectedAgents,
        conversationContext,
        aNumberInfo,
        responses,
        {
          openingSpeaker: i === 0,
          hourRuler,
          dayRuler,
          orderIndex: i,
          totalAgents: ordered.length,
        }
      )
      responses.push(resp)
    }
    const processingTime = Date.now() - startTime

    // Log the multi-agent conversation
    const interactionData: AgentInteractionData = {
      sessionId: conversationContext.sessionId,
      userMessage: question,
      agentResponse: responses.map(r => `${r.agent}: ${r.response}`).join('\n\n'),
      planet: 'Council',
      sign: 'Multiple',
      degree: 'Various',
      dignity: 'mixed',
      elementalInfo: {
        signElement: 'mixed',
        planetElement: 'mixed',
        elementalAffinity: 0,
        isDiurnal: new Date().getHours() >= 6 && new Date().getHours() < 18,
      },
      aNumberInfo: aNumberInfo || undefined,
      processingTimeMs: processingTime,
      agentType: 'planetary' as const,
    }

    // Log to Galileo (don't await)
    logAgentConversation(interactionData, conversationContext).catch(error => {
      console.error('Failed to log multi-agent conversation:', error)
    })

    // Log to database for consciousness evolution tracking
    try {
      const user = await getCurrentUser(req)
      const userId = user?.id || getUserIdFromRequest(req)

      let forceMagnitude = 0
      try {
        const k = await backend.alchemy.defaultQuantities(new Date())
        forceMagnitude = Number(k?.kinetic_val ?? 0)
      } catch (error) {
        console.warn('Failed to fetch kinetic data for multi-agent logging:', error)
      }

      // Log interaction for each agent
      for (const response of responses) {
        const agentId = `${response.agent.toLowerCase()}-multi`
        const powerGained = response.elementalInfo.elementalAffinity * 8 + 5

        await consciousnessPersistence.logInteraction({
          userId,
          agentId,
          interactionType: 'multi-agent-chat',
          powerGained,
          planetaryInfluence: response.agent,
          elementalResonance: response.elementalInfo.elementalAffinity,
          forceMagnitude,
          metadata: {
            question,
            responseLength: response.response.length,
            multiAgentSession: true,
            totalAgents: responses.length,
            sessionId: conversationContext.sessionId,
          },
        })
      }
    } catch (dbError) {
      console.error('Failed to log multi-agent interactions to database:', dbError)
      // Don't fail the request if database logging fails
    }

    // Cosmic Leveling — optional in-council training. When the caller names a
    // trainee (real agentId) and partner agentIds, the trainee earns XP for
    // participating plus EVs from each partner's dominant Sacred 7 stat. Council
    // agents (AgentConfig) carry no DB id, so EVs require explicit partnerAgentIds.
    // Existing council callers omit both and are unaffected. Fire-and-forget.
    if (trainerAgentId) {
      const { HistoricalAgentsService } = await import('@/lib/historical-agents-db')
      HistoricalAgentsService.awardXp(trainerAgentId, {
        messageCount: responses.length || 1,
      }).catch(err => console.warn('multi-agent awardXp failed:', err))

      const partners: string[] = Array.isArray(partnerAgentIds) ? partnerAgentIds : []
      for (const partnerId of partners) {
        if (partnerId && partnerId !== trainerAgentId) {
          HistoricalAgentsService.awardEvs(trainerAgentId, partnerId).catch(err =>
            console.warn('multi-agent awardEvs failed:', err)
          )
        }
      }
    }

    return NextResponse.json({
      responses,
      sessionId: conversationContext.sessionId,
      aNumberInfo,
    })
  } catch (error) {
    console.error('Error in multi-agent endpoint:', error)
    return NextResponse.json(
      {
        error: 'Failed to process multi-agent request',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
