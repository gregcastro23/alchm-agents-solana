import { feedStreamBus } from '@/lib/agents/feed-stream-bus'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/feed/stream
 *
 * Server-Sent Events stream of FeedEvent objects.
 *
 * Emits live feed events from the in-process feed bus plus keep-alive comments
 * so the client's EventSource stays open without retry-spamming. This gives the
 * desktop Ghost Feed an immediate producer path for local Jing casts; a Redis
 * pub/sub channel can replace the bus when feeds need to span processes.
 */
export async function GET(req: Request) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const enqueue = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          closed = true
        }
      }

      // Open the stream with an immediate comment so proxies don't buffer
      enqueue('retry: 5000\n: feed-stream open\n\n')

      const unsubscribe = feedStreamBus.subscribe(message => {
        enqueue(`event: ${message.event}\ndata: ${JSON.stringify(message.data)}\n\n`)
      })

      // Keep-alive every 25s — below the typical 30s proxy idle timeout
      const keepAlive = setInterval(() => {
        enqueue(': ka\n\n')
        if (closed) {
          clearInterval(keepAlive)
          unsubscribe()
        }
      }, 25_000)

      const closeStream = () => {
        if (closed) return
        closed = true
        clearInterval(keepAlive)
        unsubscribe()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      req.signal.addEventListener('abort', closeStream)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
