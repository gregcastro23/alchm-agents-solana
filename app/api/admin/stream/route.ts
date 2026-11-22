import type { NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { buildOverviewPulse } from '@/lib/admin/overview-pulse'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TICK_INTERVAL_MS = 15_000
const KEEPALIVE_INTERVAL_MS = 15_000
const MAX_STREAM_LIFETIME_MS = 50_000

const encoder = new TextEncoder()

function sseFrame(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return adminErrorResponse(auth)

  const once = req.nextUrl.searchParams.get('once') === '1'

  let closed = false
  let inFlight = false
  let tickTimer: ReturnType<typeof setInterval> | null = null
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null
  let rotateTimer: ReturnType<typeof setTimeout> | null = null

  const cleanup = () => {
    if (closed) return
    closed = true
    if (tickTimer) clearInterval(tickTimer)
    if (keepaliveTimer) clearInterval(keepaliveTimer)
    if (rotateTimer) clearTimeout(rotateTimer)
    tickTimer = null
    keepaliveTimer = null
    rotateTimer = null
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return
        try {
          controller.enqueue(chunk)
        } catch {
          cleanup()
        }
      }

      const emitPulse = async () => {
        if (closed || inFlight) return
        inFlight = true
        try {
          const pulse = await buildOverviewPulse()
          safeEnqueue(sseFrame('pulse', pulse))
        } catch (err) {
          safeEnqueue(
            sseFrame('stream-error', {
              message: err instanceof Error ? err.message : 'Failed to build overview pulse',
            })
          )
        } finally {
          inFlight = false
        }
      }

      safeEnqueue(encoder.encode('retry: 5000\n\n'))
      await emitPulse()

      if (once) {
        cleanup()
        try {
          controller.close()
        } catch {
          // Stream already closed.
        }
        return
      }

      req.signal.addEventListener('abort', () => {
        cleanup()
        try {
          controller.close()
        } catch {
          // Ignore double close on client abort.
        }
      })

      tickTimer = setInterval(() => {
        void emitPulse()
      }, TICK_INTERVAL_MS)

      keepaliveTimer = setInterval(() => {
        safeEnqueue(encoder.encode(': keepalive\n\n'))
      }, KEEPALIVE_INTERVAL_MS)

      rotateTimer = setTimeout(() => {
        safeEnqueue(sseFrame('reconnect', { reason: 'maxDuration' }))
        cleanup()
        try {
          controller.close()
        } catch {
          // Ignore close after abort.
        }
      }, MAX_STREAM_LIFETIME_MS)
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
