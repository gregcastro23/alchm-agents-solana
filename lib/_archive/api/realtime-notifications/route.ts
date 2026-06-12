/**
 * Real-Time Notifications API
 * ============================
 *
 * Server-Sent Events (SSE) endpoint for real-time notifications
 */

import { handleRealtimeConnection } from '@/lib/services/realtime-notification-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/realtime-notifications
 * Establish SSE connection for real-time notifications
 */
export async function GET(request: Request) {
  try {
    return handleRealtimeConnection(request as any)
  } catch (error) {
    console.error('Error establishing real-time connection:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to establish real-time connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
