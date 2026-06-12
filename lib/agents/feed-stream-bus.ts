import type { FeedEvent } from '@/components/cosmic-agents/types'

export type FeedStreamMessage =
  | { event: 'feed'; data: FeedEvent }
  | { event: 'token'; data: { id: string; chunk: string } }
  | { event: 'resolution'; data: FeedEvent }
  | { event: 'error'; data: { message: string; id?: string } }

type FeedStreamListener = (message: FeedStreamMessage) => void

class FeedStreamBus {
  private listeners = new Set<FeedStreamListener>()

  get listenerCount(): number {
    return this.listeners.size
  }

  subscribe(listener: FeedStreamListener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  publish(message: FeedStreamMessage) {
    for (const listener of this.listeners) {
      listener(message)
    }
  }
}

const globalForFeedStream = globalThis as typeof globalThis & {
  __alchmFeedStreamBus?: FeedStreamBus
}

export const feedStreamBus = globalForFeedStream.__alchmFeedStreamBus ?? new FeedStreamBus()

globalForFeedStream.__alchmFeedStreamBus = feedStreamBus
