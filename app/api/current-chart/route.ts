import { NextRequest, NextResponse } from 'next/server'
import { generateAlchmForCurrentMoment } from '@/lib/alchemizer'

// naive in-process cache
let cached: { at: number; data: any } | null = null
const TTL = Number(process.env.BACKGROUND_REFRESH_INTERVAL_MS || 600000)

export async function GET(req: NextRequest) {
  const now = Date.now()
  if (cached && now - cached.at < TTL) {
    return NextResponse.json({ ...cached.data, cached: true, ageMs: now - cached.at })
  }
  try {
    const data = await generateAlchmForCurrentMoment()
    // extract compact fields
    const spirit = data?.['Alchemy Effects']?.['Total Spirit'] || 0
    const essence = data?.['Alchemy Effects']?.['Total Essence'] || 0
    const matter = data?.['Alchemy Effects']?.['Total Matter'] || 0
    const substance = data?.['Alchemy Effects']?.['Total Substance'] || 0
    const aNumber = spirit + essence + matter + substance
    const decan = data?.['Sun Sign'] ? data?.['Planets']?.['Sun']?.['Decan'] : null
    const payload = { aNumber, components: { spirit, essence, matter, substance }, decan }
    cached = { at: now, data: payload }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Current chart calculation failed:', error)

    // Provide specific error messages based on error type
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network')
    const isDataError = errorMessage.includes('parsing') || errorMessage.includes('invalid')

    let userMessage = 'Failed to calculate current chart'
    let statusCode = 500

    if (isNetworkError) {
      userMessage = 'Unable to fetch astronomical data. Please try again later.'
      statusCode = 503
    } else if (isDataError) {
      userMessage = 'Invalid chart data received. Please check input parameters.'
      statusCode = 400
    }

    return NextResponse.json(
      {
        error: userMessage,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        timestamp: new Date().toISOString(),
        endpoint: 'current-chart',
      },
      { status: statusCode }
    )
  }
}
