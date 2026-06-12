/**
 * Planetary Synchronization API
 * =============================
 *
 * Cross-backend synchronization endpoint that connects Planetary Agents' VSOP87
 * astronomical precision with WhatToEatNext's planetary position rectification.
 * Provides real-time synchronization for the most accurate astrological calculations.
 */

import { planetaryPositionSyncService } from '@/lib/services/planetary-position-sync'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { NextRequest, NextResponse } from 'next/server'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getSyncSecret(): string | undefined {
  return process.env.PLANETARY_SYNC_SECRET || process.env.INTERNAL_API_SECRET
}

function hasValidSyncSecret(request: NextRequest): boolean {
  const expected = getSyncSecret()

  if (!expected) {
    return process.env.NODE_ENV !== 'production'
  }

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  const provided =
    bearerToken ||
    request.headers.get('x-sync-secret') ||
    request.headers.get('x-webhook-secret') ||
    request.headers.get('internal_api_secret')

  return provided === expected
}

async function requireSyncAccess(request: NextRequest) {
  if (hasValidSyncSecret(request)) return null

  const admin = await requireAdmin()
  if (admin.ok) return null

  return adminErrorResponse(admin)
}

// GET /api/planetary-sync
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'health': {
        // Test connectivity with WhatToEatNext and overall sync health
        const healthCheck = await planetaryPositionSyncService.getHealthStatus()
        return NextResponse.json(healthCheck)
      }

      case 'sync-status': {
        // Get current synchronization status and metrics
        const status = await planetaryPositionSyncService.getSyncStatus()
        return NextResponse.json(status)
      }

      case 'cache-stats': {
        // Get cache statistics
        const cacheStats = planetaryPositionSyncService.getCacheStats()
        return NextResponse.json(cacheStats)
      }

      case 'clear-cache': {
        // Clear synchronization cache (admin operation)
        const accessError = await requireSyncAccess(request)
        if (accessError) return accessError

        planetaryPositionSyncService.clearCache()
        return NextResponse.json({ message: 'Cache cleared successfully' })
      }

      default: {
        // Perform synchronization
        const dateParam = searchParams.get('date')
        const targetDate = dateParam ? new Date(dateParam) : new Date()

        if (isNaN(targetDate.getTime())) {
          return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
        }

        const result = await planetaryPositionSyncService.synchronizePositions(targetDate)
        return NextResponse.json(result)
      }
    }
  } catch (error) {
    console.error('Planetary sync API error:', error)
    return NextResponse.json(
      { error: 'Synchronization failed', message: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

// POST /api/planetary-sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, date, positions } = body

    switch (action) {
      case 'webhook-sync': {
        // Handle webhook updates from WhatToEatNext
        const accessError = await requireSyncAccess(request)
        if (accessError) return accessError

        if (!positions || !date) {
          return NextResponse.json(
            { error: 'Missing required fields: positions and date' },
            { status: 400 }
          )
        }

        const success = await planetaryPositionSyncService.handleWebhookSync(positions, date)
        return NextResponse.json({
          received: true,
          processed: success,
          message: success
            ? 'Webhook sync processed successfully'
            : 'Webhook sync processing failed',
        })
      }

      case 'emergency-sync': {
        // Emergency synchronization request
        const accessError = await requireSyncAccess(request)
        if (accessError) return accessError

        const dateParam = date ? new Date(date) : new Date()

        if (isNaN(dateParam.getTime())) {
          return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
        }

        const result = await planetaryPositionSyncService.emergencySynchronization(dateParam)
        return NextResponse.json({
          ...result,
          message: 'Emergency synchronization completed',
        })
      }

      case 'validate-positions': {
        // Validate planetary position data
        const accessError = await requireSyncAccess(request)
        if (accessError) return accessError

        if (!positions) {
          return NextResponse.json({ error: 'Missing positions data' }, { status: 400 })
        }

        // Perform synchronization with provided positions
        const dateParam = date ? new Date(date) : new Date()
        const ourPositions =
          await planetaryPositionSyncService['getPlanetaryAgentsPositions'](dateParam)

        // Convert provided positions to sync format
        const theirPositions: Record<string, any> = {}
        Object.entries(positions).forEach(([planet, pos]: [string, any]) => {
          theirPositions[planet] = {
            planet,
            sign: pos.sign,
            degree: pos.degree,
            exact_longitude: pos.exact_longitude,
            is_retrograde: pos.is_retrograde || false,
            source: 'validation_input',
            confidence: pos.confidence || 0.8,
            last_updated: new Date().toISOString(),
            accuracy_level: 'external',
          }
        })

        // Perform validation sync
        const syncService = planetaryPositionSyncService as any
        const syncResult = syncService.performSynchronization(
          ourPositions,
          theirPositions,
          dateParam
        )

        return NextResponse.json({
          validation_result: syncResult,
          our_positions: ourPositions,
          their_positions: theirPositions,
          message: 'Position validation completed',
        })
      }

      default: {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }
    }
  } catch (error) {
    console.error('Planetary sync POST error:', error)
    return NextResponse.json(
      { error: 'Request processing failed', message: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

// PUT /api/planetary-sync (for configuration updates)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'update-config': {
        const accessError = await requireSyncAccess(request)
        if (accessError) return accessError

        // Only one runtime-mutable knob exists today: cacheTtlMs. The
        // service's other settings (whattoeatnextBaseUrl, apiKey) are
        // resolved from env at construction time and intentionally
        // immutable — changing them at runtime would let an admin
        // accidentally aim sync at the wrong cluster mid-incident.
        //
        // Accepted shape:
        //   { action: 'update-config', cacheTtlMs?: number }
        //
        // The setter clamps to [1s, 1h] so a typo can't disable
        // caching entirely. Returns the applied value plus the
        // previous one so the caller can diff.
        const updates: Record<string, unknown> = {}

        if (typeof body.cacheTtlMs === 'number') {
          const { applied, previous } = planetaryPositionSyncService.setCacheTtl(body.cacheTtlMs)
          updates.cacheTtlMs = { applied, previous }
        }

        if (Object.keys(updates).length === 0) {
          return NextResponse.json(
            {
              error: 'No supported config keys provided.',
              supportedKeys: ['cacheTtlMs'],
              note: 'Other sync settings are env-driven and require a redeploy to change.',
            },
            { status: 400 }
          )
        }

        return NextResponse.json({
          message: 'Configuration updated.',
          updates,
          currentConfig: {
            cacheTtlMs: planetaryPositionSyncService.getCacheTtl(),
          },
        })
      }

      default: {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }
    }
  } catch (error) {
    console.error('Planetary sync PUT error:', error)
    return NextResponse.json(
      { error: 'Configuration update failed', message: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
