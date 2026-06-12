import { NextResponse } from 'next/server'
import { logToGalileoStream, isGalileoConfigured } from '@/lib/galileo-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  console.log('Galileo Log API called with method:', req.method)

  try {
    // Check if Galileo is configured
    if (!isGalileoConfigured()) {
      console.error('Galileo API key not configured')
      return NextResponse.json(
        {
          success: false,
          error: 'Galileo API key not configured. Check your .env file.',
        },
        { status: 500 }
      )
    }

    // Log env variables for debugging
    console.log('GALILEO_API_KEY exists:', !!process.env.GALILEO_API_KEY)
    console.log('GALILEO_PROJECT:', process.env.GALILEO_PROJECT)
    console.log('GALILEO_LOG_STREAM:', process.env.GALILEO_LOG_STREAM)

    // Parse request body
    const body = await req.json()
    console.log('Parsed request body:', JSON.stringify(body))

    const { message, metadata = {}, level = 'info' } = body

    // Validate required fields
    if (!message) {
      console.error('Missing required field: message')
      return NextResponse.json(
        { success: false, error: 'Missing required field: message' },
        { status: 400 }
      )
    }

    // Enrich metadata with request information
    const enrichedMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString(),
      level,
      userAgent: req.headers.get('user-agent') || 'unknown',
      origin: req.headers.get('origin') || 'unknown',
    }

    console.log('Sending log to Galileo with message:', message)
    console.log('Enriched metadata:', JSON.stringify(enrichedMetadata))

    // Log to Galileo stream
    const success = await logToGalileoStream(message, enrichedMetadata)

    if (success) {
      console.log('Successfully sent log to Galileo')
      return NextResponse.json({
        success: true,
        message: 'Log entry successfully sent to Galileo stream',
      })
    } else {
      console.error('Failed to send log to Galileo')
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send log entry to Galileo stream',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in Galileo log API:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      console.error('Error stack:', error.stack)
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
