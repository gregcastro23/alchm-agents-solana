import { NextRequest, NextResponse } from 'next/server'
import { feedPusherService } from '@/lib/agents/feed-pusher'
import {
  planetaryDegreeFeedService,
  type PlanetaryDegreeFeedOptions,
} from '@/lib/agents/planetary-degree-feed'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function parseOptions(request: NextRequest): PlanetaryDegreeFeedOptions {
  const { searchParams } = new URL(request.url)
  const planets = searchParams.get('planets')?.split(',').filter(Boolean)
  const lookbackMinutes = Number(searchParams.get('lookbackMinutes'))

  return {
    date: parseDate(searchParams.get('date')),
    previousDate: parseDate(searchParams.get('previousDate')),
    lookbackMinutes: Number.isFinite(lookbackMinutes) ? lookbackMinutes : undefined,
    force: searchParams.get('force') === 'true',
    planets,
  }
}

export async function GET(request: NextRequest) {
  try {
    const options = parseOptions(request)
    const messages = await planetaryDegreeFeedService.evaluateDegreeChanges(options)

    return NextResponse.json({
      success: true,
      pushed: false,
      count: messages.length,
      validResponses: messages.every(message => message.valid),
      responses: messages.map(message => ({
        id: message.id,
        agentId: message.agentId,
        agentName: message.agentName,
        response: message.response,
        valid: message.valid,
        validationErrors: message.validationErrors,
        metadata: message.action.metadataPayload,
      })),
      messages,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error evaluating planetary degree group chat:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate planetary degree group chat' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const queryOptions = parseOptions(request)
    const body = await request.json().catch(() => ({}))
    const options: PlanetaryDegreeFeedOptions = {
      ...queryOptions,
      date: body.date ? parseDate(body.date) : queryOptions.date,
      previousDate: body.previousDate ? parseDate(body.previousDate) : queryOptions.previousDate,
      lookbackMinutes: body.lookbackMinutes ?? queryOptions.lookbackMinutes,
      force: body.force ?? queryOptions.force,
      planets: body.planets ?? queryOptions.planets,
      userContext: body.userContext,
    }

    const result = await feedPusherService.evaluatePlanetaryAndPush(options)

    return NextResponse.json({
      success: result.success,
      pushed: true,
      pushedCount: result.pushedCount,
      validResponses: result.messages?.every(message => message.valid) ?? true,
      responses:
        result.messages?.map(message => ({
          id: message.id,
          agentId: message.agentId,
          agentName: message.agentName,
          response: message.response,
          valid: message.valid,
          validationErrors: message.validationErrors,
          metadata: message.action.metadataPayload,
        })) ?? [],
      errors: result.errors.map(error => (error instanceof Error ? error.message : String(error))),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error pushing planetary degree group chat:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to push planetary degree group chat' },
      { status: 500 }
    )
  }
}
