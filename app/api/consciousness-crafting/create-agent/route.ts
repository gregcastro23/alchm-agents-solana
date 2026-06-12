import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { ConsciousnessClient } from '@/lib/api-client/consciousness-client'

const CreateAgentSchema = z.object({
  birthChart: z.any().nullable().optional(),
  momentChart: z.any(),
  additionalCharts: z.array(z.any()).optional(),
  timestamp: z.string().optional(),
})

const client = new ConsciousnessClient()

export async function POST(req: Request) {
  try {
    const session = await auth().catch(() => null)
    const body = await req.json().catch(() => ({}))
    const parsed = CreateAgentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { birthChart = null, momentChart, additionalCharts = [], timestamp } = parsed.data

    const blueprint = await client.createAgentOfMoment(
      birthChart,
      momentChart,
      additionalCharts,
      timestamp
    )

    return NextResponse.json({
      blueprint,
      creator: session?.user?.id || 'guest',
    })
  } catch (error) {
    console.error('create-agent error:', error)
    return NextResponse.json({ error: 'Failed to generate agent blueprint' }, { status: 500 })
  }
}
