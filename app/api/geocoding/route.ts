/**
 * Geocoding API Route
 * GET /api/geocoding?q=location - Autocomplete search for birth locations
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { searchGeocodeLocations } from '@/lib/services/geocoding-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        {
          success: false,
          message: 'Query must be at least 2 characters',
          results: [],
        },
        { status: 400 }
      )
    }

    const results = await searchGeocodeLocations(query.trim(), 6)

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error('[API/Geocoding] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to geocode location',
        results: [],
      },
      { status: 500 }
    )
  }
}
