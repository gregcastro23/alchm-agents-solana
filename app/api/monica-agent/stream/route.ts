import { NextResponse } from 'next/server'
import { stepCountIs, streamText } from 'ai'
import { auth } from '@/lib/auth'
import { verifyApiKeys } from '../../secure-config'
import {
  buildMonicaPrompt,
  getMonicaContextPrompt,
  MONICA_BASE_SYSTEM_PROMPT,
  MONICA_SPECIALIZED_PROMPTS,
} from '@/lib/monica/monica-system-prompts'
import { sanitizeUserInput, clampTemperature } from '@/lib/monica/safety'
import { decideModel } from '@/lib/monica/router'
import { MonicaResponseHandler } from '@/lib/monica/monica-response-handler'
import { selectKnowledge } from '@/lib/monica/knowledge'
import { resolveDefaultModel } from '@/lib/models/registry'
import { runWithToolExecutionContext } from '@/lib/langchain/tool-context'
import { getRectificationAiTools } from '@/lib/rectification/ai-tools'
import {
  appendRectificationSessionTurns,
  getRectificationSessionHistory,
  isRectificationIntent,
  RECTIFICATION_INTERVIEW_INSTRUCTIONS,
} from '@/lib/rectification/intent'

// Supervisor routing imports
import { monicaRouter } from '@/lib/monica/enhanced-router'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { unifiedAgentFactory } from '@/lib/unified-agent-factory'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  if (!verifyApiKeys()) {
    return new Response('data: {"type":"error","message":"API keys missing"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }
  const session = await auth().catch(() => null)
  const userId = session?.user?.id

  const {
    message,
    model,
    preferredStyle,
    conversationStage = 'teaching',
    birthData = null,
    userPreferences = null,
    quickProfile = null,
    tarotContext = null,
    spreadContext = null,
    sessionId,
    history: bodyHistory,
    context = null,
  } = await req.json()
  const userMsg = sanitizeUserInput(message || '', 1000)
  const priorHistory = getRectificationSessionHistory(
    sessionId,
    userId,
    Array.isArray(bodyHistory) ? bodyHistory : context?.history
  )
  const wantsRectification = isRectificationIntent(userMsg, priorHistory)

  // Minimal prompt assembly (reuse of base context only for streaming path)
  const ctx = getMonicaContextPrompt({ conversationStage, birthData, userPreferences })

  // Execute Supervisor Intent-Based Routing
  const unifiedHistorical = HISTORICAL_AGENTS.map(agent =>
    unifiedAgentFactory.createFromHistorical(agent)
  )
  const routingDecision = await monicaRouter.route({
    message: userMsg,
    availableAgents: unifiedHistorical,
  })

  // Choose specialized prompt
  let specialized: string
  if (
    userMsg.toLowerCase().includes('design') ||
    userMsg.toLowerCase().includes('personalized ai')
  ) {
    specialized = MONICA_SPECIALIZED_PROMPTS.personalizedAIDesign
  } else {
    specialized = MONICA_SPECIALIZED_PROMPTS.alchmGuidance
  }

  // Inject routing suggestions into supervisor context
  if (routingDecision.selectedAgents.length > 0) {
    const recommendationsStr = routingDecision.selectedAgents
      .map(
        a =>
          `- ${a.name} (${a.title}): Specialty: ${a.capabilities.specialty}, Dominant Element: ${a.consciousness.dominantElement}`
      )
      .join('\n')

    specialized = `${specialized}

### Supervisor Agent Routing Recommendations
You have identified the following agents as highly relevant companions/counselors for this query:
${recommendationsStr}

Reason for routing: ${routingDecision.reason}

Please weave these recommendations naturally into your response to guide the user to the correct workspace or agent, explaining how their unique alchemical/astrological profiles fit the user's inquiry.`
  }
  if (wantsRectification) {
    specialized = `${specialized}\n\n${RECTIFICATION_INTERVIEW_INSTRUCTIONS}`
  }

  const knowledgeSnippets = selectKnowledge(['elemental', 'tarot'])
    .map(k => k.content)
    .join('\n')
  const sys = buildMonicaPrompt(
    MONICA_BASE_SYSTEM_PROMPT,
    ctx +
      (tarotContext
        ? `\n\nTarot Context:\n- Current Decan Card: ${tarotContext.currentCard}\n- Planetary Card: ${tarotContext.planetaryCard}\n- Synergy: ${Math.round((tarotContext.synergy || 0) * 100)}%\n- Consciousness Level: ${tarotContext.consciousnessLevel}`
        : '') +
      (spreadContext
        ? `\n\nTarot Spread Context:\n- Spread: ${spreadContext.spreadName}\n- Question: ${spreadContext.question || 'General'}\n- Overall: ${spreadContext.overallInterpretation}`
        : '') +
      (quickProfile
        ? `\n\nRapid Onboarding Hints:\n- Goal: ${quickProfile.goal || 'unspecified'}\n- Mood: ${quickProfile.mood || 'neutral'}`
        : ''),
    specialized + (knowledgeSnippets ? `\n\nKnowledge Snippets:\n${knowledgeSnippets}` : '')
  )

  const analyzed = MonicaResponseHandler.analyzeUserMessage(userMsg)
  const routing = decideModel({
    defaultModel: model || process.env.MONICA_DEFAULT_MODEL,
    complexity: wantsRectification ? 'complex' : analyzed.topicComplexity,
  })
  const activeModel = routing.model
  const temp = clampTemperature(
    (preferredStyle?.temperature ?? Number(process.env.MONICA_TEMPERATURE)) || 0.4
  )

  // MOCK_LLM safety: return a static response without calling any provider
  const MOCK_LLM = process.env.MOCK_LLM === 'true'
  if (MOCK_LLM) {
    const mockText = `*Monica speaks in a calm, resonant tone*\n\nI perceive your inquiry: "${userMsg.slice(0, 60)}..."\n\nThe alchemical currents suggest a time of reflection and synthesis. Trust in the unfolding process, for each question is a seed planted in the fertile ground of consciousness.`
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: any) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
        send({ type: 'meta', ttfbMs: 0, routing: { modelId: 'mock', reason: 'default' } })
        for (const chunk of mockText.match(/.{1,60}/g) || []) {
          send({ type: 'token', token: chunk })
        }
        send({ type: 'done' })
        controller.close()
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      try {
        const start = Date.now()

        const executeStream = async () => {
          const result = wantsRectification
            ? await streamText({
                model: activeModel,
                system: sys,
                ...(priorHistory.length > 0
                  ? {
                      messages: [
                        ...priorHistory.map(t => ({ role: t.role, content: t.content })),
                        { role: 'user' as const, content: userMsg },
                      ],
                    }
                  : { prompt: userMsg }),
                tools: getRectificationAiTools(),
                stopWhen: stepCountIs(6),
                maxOutputTokens: 1000,
                temperature: temp,
              } as any)
            : await streamText({
                model: activeModel,
                system: sys,
                prompt: userMsg,
                maxOutputTokens: 800,
                temperature: temp,
              } as any)

          let isFirstChunk = true

          for await (const chunk of result.textStream) {
            if (isFirstChunk) {
              const ttfb = Date.now() - start
              send({ type: 'meta', ttfbMs: ttfb, routing })
              isFirstChunk = false
            }
            send({ type: 'token', token: chunk })
          }

          return await result.text
        }

        const fullText = wantsRectification
          ? await runWithToolExecutionContext(
              {
                userId,
                userName: session?.user?.name,
                userEmail: session?.user?.email,
                sessionId,
              },
              executeStream
            )
          : await executeStream()

        if (wantsRectification && sessionId) {
          appendRectificationSessionTurns(sessionId, userId, userMsg, fullText)
        }

        // envelope
        const envelope = MonicaResponseHandler.formatResponse(fullText, {
          userMessage: userMsg,
          learningStage: conversationStage === 'greeting' ? 'beginner' : 'intermediate',
        })
        send({
          type: 'envelope',
          payload: {
            suggestedPractices: envelope.interactive_elements.suggested_practices,
            nextStep: envelope.educational_guidance.next_learning_step,
            followUps: envelope.interactive_elements.reflection_questions,
            routing: {
              reason: routingDecision.reason,
              confidence: routingDecision.confidence,
              strategy: routingDecision.routingStrategy,
              recommendedAgents: routingDecision.selectedAgents.map(a => ({
                id: a.id,
                name: a.name,
                title: a.title,
                type: a.type,
                avatar: a.appearance.avatar,
                color: a.appearance.color,
              })),
            },
          },
        })
        send({ type: 'done' })
        controller.close()
      } catch (e) {
        console.error('[Monica Stream] streamText error:', e)
        send({ type: 'error', message: e instanceof Error ? e.message : 'stream_failed' })
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
