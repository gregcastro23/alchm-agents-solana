// @vitest-environment jsdom
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { LivePriceIndexTicker } from '@/components/economy/LivePriceIndexTicker'
import type { EsmsTokenQuote } from '@/lib/economy/price-index-contract'

// Mock useElementalPriceIndex
const mockQuotesList: EsmsTokenQuote[] = [
  {
    axis: 'Spirit',
    name: 'Spirit',
    symbol: 'SPRT',
    element: 'Fire',
    mintAddress: 'Spirit1111111111111111111111111111111111111',
    currentPrice: 1.05,
    previousPrice: 1.0,
    change1hPct: 1.2,
    change24hPct: 5.0,
    sparkline: [1.0, 1.02, 1.05],
    weight: 0.25,
    contributingPlanets: 'Sun, Mars',
    description: 'Solar/Martian volatility',
  },
]

vi.mock('@/hooks/useElementalPriceIndex', () => ({
  useElementalPriceIndex: () => ({
    data: {
      basis: { model: 'Canonical ESMS Oracle' },
      tokens: { Spirit: mockQuotesList[0] },
    },
    loading: false,
    error: null,
    lastRefreshed: new Date('2026-10-17T05:00:00Z'),
    refresh: vi.fn(),
    formatIndex: (q: EsmsTokenQuote) => q.currentPrice.toFixed(2),
    formatChange: (pct: number) => ({ text: `+${pct.toFixed(1)}%`, isPositive: true }),
    quotesList: mockQuotesList,
  }),
}))

describe('LivePriceIndexTicker', () => {
  let eventListeners: Record<string, ((event: MessageEvent) => void)[]> = {}
  let mockClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    eventListeners = {}
    mockClose = vi.fn()

    class MockEventSource {
      url: string
      constructor(url: string) {
        this.url = url
      }
      addEventListener(type: string, listener: (event: MessageEvent) => void) {
        if (!eventListeners[type]) eventListeners[type] = []
        eventListeners[type].push(listener)
      }
      removeEventListener(type: string, listener: (event: MessageEvent) => void) {
        if (eventListeners[type]) {
          eventListeners[type] = eventListeners[type].filter(l => l !== listener)
        }
      }
      close() {
        mockClose()
      }
    }

    vi.stubGlobal('EventSource', MockEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('attaches explicit named listeners for feed and resonance_window events', () => {
    const { unmount } = render(<LivePriceIndexTicker variant="ribbon" />)

    expect(eventListeners['feed']).toBeDefined()
    expect(eventListeners['feed'].length).toBeGreaterThanOrEqual(1)

    expect(eventListeners['resonance_window']).toBeDefined()
    expect(eventListeners['resonance_window'].length).toBeGreaterThanOrEqual(1)

    unmount()
    expect(mockClose).toHaveBeenCalledOnce()
  })

  it('renders live triplicate trade and resonance window pills when SSE emits', async () => {
    render(<LivePriceIndexTicker variant="ribbon" />)

    // Emit triplicate-trade event via named 'feed' listener
    act(() => {
      const feedHandler = eventListeners['feed']?.[0]
      feedHandler?.({
        data: JSON.stringify({
          type: 'triplicate-trade',
          tradeId: 'test-trade-123',
          makerName: 'AgentSol',
          takerName: 'AgentLuna',
          gaveToken: 'Spirit',
          gaveAmount: 10,
          receivedToken: 'Essence',
          receivedAmount: 10,
          resonanceBonusPct: 15,
          aspectDescription: 'Trine (Sun-Moon)',
        }),
      } as MessageEvent)
    })

    // Emit resonance_window event via named 'resonance_window' listener
    act(() => {
      const windowHandler = eventListeners['resonance_window']?.[0]
      windowHandler?.({
        data: JSON.stringify({
          windowKey: 'triplicate_window:sol:luna',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          makerId: 'sol',
          takerId: 'luna',
          bonusPct: 15,
          harmonicAspect: 'Grand Trine',
          transitCatalyst: 'Jupiter Sextile Saturn',
        }),
      } as MessageEvent)
    })

    // Verify pills appear in DOM
    expect(screen.getAllByText(/TRIPLICATE: AgentSol ⇄ AgentLuna/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/WINDOW: Grand Trine/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\+15% REBATE/i).length).toBeGreaterThan(0)
  })
})
