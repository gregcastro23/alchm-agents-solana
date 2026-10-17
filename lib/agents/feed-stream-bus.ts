import type {
  FeedEvent,
  CircleBoardResonanceWindow,
  TriplicateTradeEvent,
  TriplicateTradeSummary,
} from '@/components/cosmic-agents/types'

export type FeedStreamMessage =
  | { event: 'feed'; data: FeedEvent }
  | { event: 'resonance_window'; data: CircleBoardResonanceWindow }
  | { event: 'token'; data: { id: string; chunk: string } }
  | { event: 'resolution'; data: FeedEvent }
  | { event: 'error'; data: { message: string; id?: string } }

type FeedStreamListener = (message: FeedStreamMessage) => void

class FeedStreamBus {
  private listeners = new Set<FeedStreamListener>()
  private recentTrades: TriplicateTradeEvent[] = []
  private activeWindows: CircleBoardResonanceWindow[] = []
  private maxTrades = 10
  private maxWindows = 5

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

  getRecentTrades(): TriplicateTradeEvent[] {
    return [...this.recentTrades]
  }

  getActiveWindows(): CircleBoardResonanceWindow[] {
    const now = Date.now()
    return this.activeWindows.filter(w => {
      const exp = new Date(w.expiresAt).getTime()
      return Number.isNaN(exp) || exp > now
    })
  }

  recordTrade(trade: TriplicateTradeEvent) {
    const key = trade.tradeId || trade.id
    this.recentTrades = [
      trade,
      ...this.recentTrades.filter(t => (t.tradeId || t.id) !== key),
    ].slice(0, this.maxTrades)
    this.publish({ event: 'feed', data: trade })
  }

  recordResonanceWindow(window: CircleBoardResonanceWindow) {
    this.activeWindows = [
      window,
      ...this.activeWindows.filter(w => w.windowKey !== window.windowKey),
    ].slice(0, this.maxWindows)
    this.publish({ event: 'resonance_window', data: window })
  }

  hydrate(trades?: TriplicateTradeSummary[], windows?: CircleBoardResonanceWindow[]) {
    if (trades && Array.isArray(trades)) {
      for (const t of trades) {
        const key = t.id
        if (!this.recentTrades.some(existing => (existing.tradeId || existing.id) === key)) {
          this.recentTrades.unshift({
            id: t.id,
            tradeId: t.id,
            timestamp: t.timestamp,
            type: 'triplicate-trade',
            makerName: t.makerName,
            takerName: t.takerName,
            gaveToken: t.gaveToken,
            gaveAmount: t.gaveAmount,
            receivedToken: t.receivedToken,
            receivedAmount: t.receivedAmount,
            resonanceBonusPct: t.resonanceBonusPct,
            aspectDescription: t.aspectDescription,
          })
        }
      }
      if (this.recentTrades.length > this.maxTrades) {
        this.recentTrades = this.recentTrades.slice(0, this.maxTrades)
      }
    }

    if (windows && Array.isArray(windows)) {
      const now = Date.now()
      for (const w of windows) {
        const exp = new Date(w.expiresAt).getTime()
        if (!Number.isNaN(exp) && exp <= now) continue
        if (!this.activeWindows.some(existing => existing.windowKey === w.windowKey)) {
          this.activeWindows.unshift(w)
        }
      }
      if (this.activeWindows.length > this.maxWindows) {
        this.activeWindows = this.activeWindows.slice(0, this.maxWindows)
      }
    }
  }

  resetForTesting() {
    this.recentTrades = []
    this.activeWindows = []
    this.listeners.clear()
  }
}

const globalForFeedStream = globalThis as typeof globalThis & {
  __alchmFeedStreamBus?: FeedStreamBus
}

export const feedStreamBus = globalForFeedStream.__alchmFeedStreamBus ?? new FeedStreamBus()

globalForFeedStream.__alchmFeedStreamBus = feedStreamBus
