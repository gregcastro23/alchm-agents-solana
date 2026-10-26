// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { feedStreamBus } from '@/lib/agents/feed-stream-bus'
import type {
  CircleBoardResonanceWindow,
  TriplicateTradeEvent,
  TriplicateTradeSummary,
} from '@/components/cosmic-agents/types'

describe('Triplicate Feed Stream & Ring Buffer Bus', () => {
  beforeEach(() => {
    feedStreamBus.resetForTesting()
  })

  it('records and publishes a triplicate trade event, capping buffer at 10', () => {
    const published: unknown[] = []
    const unsub = feedStreamBus.subscribe(msg => {
      published.push(msg)
    })

    const sampleTrade: TriplicateTradeEvent = {
      id: 'trade-1',
      tradeId: 'trade-1',
      timestamp: new Date().toISOString(),
      type: 'triplicate-trade',
      makerName: 'Agent Sol',
      takerName: 'Agent Luna',
      gaveToken: 'Spirit',
      gaveAmount: 10,
      receivedToken: 'Essence',
      receivedAmount: 10,
      resonanceBonusPct: 12,
      aspectDescription: 'Grand Trine (Sun-Jupiter-Mars)',
    }

    feedStreamBus.recordTrade(sampleTrade)

    expect(published).toHaveLength(1)
    expect(published[0]).toEqual({
      event: 'feed',
      data: sampleTrade,
    })

    const recent = feedStreamBus.getRecentTrades()
    expect(recent.some(t => t.tradeId === 'trade-1')).toBe(true)

    // Push 12 more trades to verify 10-item cap
    for (let i = 2; i <= 15; i++) {
      feedStreamBus.recordTrade({
        ...sampleTrade,
        id: `trade-${i}`,
        tradeId: `trade-${i}`,
      })
    }

    const capped = feedStreamBus.getRecentTrades()
    expect(capped.length).toBeLessThanOrEqual(10)
    // Most recent trade should be first
    expect(capped[0].tradeId).toBe('trade-15')

    unsub()
  })

  it('records and publishes a resonance window, filtering expired windows', () => {
    const published: unknown[] = []
    const unsub = feedStreamBus.subscribe(msg => {
      published.push(msg)
    })

    const futureExpiry = new Date(Date.now() + 60_000).toISOString()
    const sampleWindow: CircleBoardResonanceWindow = {
      windowKey: 'triplicate_window:sol:luna:2026-10-17T05',
      expiresAt: futureExpiry,
      makerId: 'sol',
      takerId: 'luna',
      bonusPct: 14,
      harmonicAspect: 'Trine',
      transitCatalyst: 'Sun Trine Mars',
    }

    feedStreamBus.recordResonanceWindow(sampleWindow)

    expect(published).toHaveLength(1)
    expect(published[0]).toEqual({
      event: 'resonance_window',
      data: sampleWindow,
    })

    const active = feedStreamBus.getActiveWindows()
    expect(active.some(w => w.windowKey === sampleWindow.windowKey)).toBe(true)

    // Add an expired window
    const pastExpiry = new Date(Date.now() - 60_000).toISOString()
    feedStreamBus.recordResonanceWindow({
      ...sampleWindow,
      windowKey: 'triplicate_window:past',
      expiresAt: pastExpiry,
    })

    const activeAfter = feedStreamBus.getActiveWindows()
    expect(activeAfter.some(w => w.windowKey === 'triplicate_window:past')).toBe(false)

    unsub()
  })

  it('hydrates ring buffers from CircleBoard payload', () => {
    const trades: TriplicateTradeSummary[] = [
      {
        id: 'trade-hydrated-1',
        timestamp: new Date().toISOString(),
        makerName: 'Hermes',
        takerName: 'Athena',
        gaveToken: 'Matter',
        gaveAmount: 5,
        receivedToken: 'Substance',
        receivedAmount: 5,
        resonanceBonusPct: 8,
        aspectDescription: 'Sextile (Mercury-Venus)',
      },
    ]

    const windows: CircleBoardResonanceWindow[] = [
      {
        windowKey: 'triplicate_window:hermes:athena:2026-10-17T05',
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        makerId: 'hermes',
        takerId: 'athena',
        bonusPct: 8,
        harmonicAspect: 'Sextile',
        transitCatalyst: 'Mercury Sextile Venus',
      },
    ]

    feedStreamBus.hydrate(trades, windows)

    const recentTrades = feedStreamBus.getRecentTrades()
    expect(recentTrades.some(t => t.tradeId === 'trade-hydrated-1')).toBe(true)

    const activeWindows = feedStreamBus.getActiveWindows()
    expect(
      activeWindows.some(w => w.windowKey === 'triplicate_window:hermes:athena:2026-10-17T05')
    ).toBe(true)
  })
})
