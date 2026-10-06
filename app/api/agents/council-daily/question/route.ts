import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { dailyCouncilService } from '@/lib/agents/council/daily-council-service'
import { dispatchTurn } from '@/lib/agents/council/council-chamber'
import { BASKET_AGENT_KEYS, SPEECH_ACTS, type SpeechAct } from '@/lib/agents/council/council-schema'
import type { CouncilTurnContext } from '@/lib/agents/council/council-context'
import type { DailyCouncilTurn } from '@/lib/agents/council/daily-council-types'
import { requireUserOrService } from '@/lib/security/privileged-api-auth'
import { checkModelCallRateLimit } from '@/lib/security/model-call-limiter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const requestSchema = z.object({
  editionId: z.string().min(1).max(250),
  question: z.string().trim().min(1).max(1000),
  targetDelegate: z.enum(BASKET_AGENT_KEYS).optional(),
  recentTurns: z
    .array(
      z.object({
        id: z.string().max(250),
        speakerKey: z.enum(BASKET_AGENT_KEYS),
        speakerName: z.string().max(80),
        text: z.string().max(5000),
        newClaim: z.string().max(1500),
        speechAct: z.string().max(50),
      })
    )
    .max(6)
    .optional(),
})

const privateHeaders = { 'Cache-Control': 'private, no-store' }
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: privateHeaders })

export async function POST(request: NextRequest) {
  const access = await requireUserOrService(request, { failClosed: true })
  if (!access.ok) {
    access.response.headers.set('Cache-Control', 'private, no-store')
    return access.response
  }
  const caller = access.kind === 'user' ? `user:${access.user.id}` : 'service'
  const limit = checkModelCallRateLimit(`daily-council:${caller}`, 6)
  if (!limit.allowed)
    return NextResponse.json(
      { error: 'Please wait a moment before asking another question.' },
      {
        status: 429,
        headers: { ...privateHeaders, 'Retry-After': String(limit.retryAfterSeconds) },
      }
    )
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return reply({ error: 'Invalid question payload' }, 400)
  }
  const parsed = requestSchema.safeParse(raw)
  if (!parsed.success)
    return reply(
      { error: 'Please send a question of 1–1,000 characters and a valid edition.' },
      400
    )
  const { editionId, question, recentTurns = [], targetDelegate } = parsed.data
  const edition = await dailyCouncilService.find(editionId)
  if (!edition)
    return reply(
      {
        error: 'This sky edition is no longer available. Refresh the daily council before asking.',
      },
      409
    )

  const toContext = (turn: (typeof recentTurns)[number]): CouncilTurnContext => ({
    turnId: turn.id,
    speakerKey: turn.speakerKey,
    speakerName: turn.speakerName,
    text: turn.text,
    claim: turn.newClaim,
    speechAct: SPEECH_ACTS.includes(turn.speechAct as SpeechAct)
      ? (turn.speechAct as SpeechAct)
      : undefined,
  })
  const context = [...edition.turns.slice(-6).map(toContext), ...recentTurns.map(toContext)]
  const turns: DailyCouncilTurn[] = []
  const questionId = randomUUID()
  const deadlineMs = Date.now() + 48_000
  const answerTime = new Date().toISOString()
  try {
    for (let turnIndex = 0; turnIndex < 3; turnIndex++) {
      const result = await dispatchTurn({
        turnIndex,
        seekerInquiry: question,
        targetDelegate,
        skyOverride: edition.brief.positions,
        observationTime: edition.brief.asOf,
        dailySkyBrief: edition.brief,
        answerTime,
        recentTurns: context.slice(-10),
        deadlineMs,
      })
      if (!result.success) throw new Error('Question generation failed')
      const turn: DailyCouncilTurn = {
        ...result,
        id: `${questionId}:${turnIndex}`,
        coverageIds: [],
      }
      turns.push(turn)
      context.push(toContext(turn))
    }
    return reply({ editionId, turns })
  } catch {
    return reply({ error: 'The council could not finish this answer. Please try again.' }, 503)
  }
}
