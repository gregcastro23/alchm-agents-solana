import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { chartData } = await req.json()

    const systemPrompt = `You are an expert astrologer specializing in natal chart interpretation.
Analyze the provided chart data and give insightful interpretations based on:
- Planetary positions by sign and house
- Major aspects between planets
- Overall chart patterns and dominant elements
Your analysis should be thorough but accessible to someone with basic astrological knowledge.`

    const { text } = await generateText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      prompt: `Please interpret this natal chart data: ${JSON.stringify(chartData || {})}`,
    })

    return NextResponse.json({ interpretation: text })
  } catch (error) {
    console.error('Error in chart interpretation:', error)
    return NextResponse.json({ error: 'Failed to interpret chart' }, { status: 500 })
  }
}
