import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  CurrentPromotionalThread,
  CurrentSkyChat,
  BarbaultBasketPromotionalThread,
} from '@/components/landing/current-promotional-thread'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
    if (typeof url === 'string' && url.includes('/api/agents/council-voice')) {
      const body = opts?.body ? JSON.parse(opts.body) : {}
      const turnIndex = body.ingressEvent?.turnIndex ?? 0
      const isFinal = turnIndex === 3
      const speakerKey =
        turnIndex === 0 ? 'sun' : turnIndex === 1 ? 'saturn' : turnIndex === 2 ? 'jupiter' : 'moon'
      const speakerName =
        speakerKey === 'sun'
          ? 'Sun'
          : speakerKey === 'saturn'
            ? 'Saturn'
            : speakerKey === 'jupiter'
              ? 'Jupiter'
              : 'Moon'

      return {
        ok: true,
        json: async () => ({
          success: true,
          speakerKey,
          speakerName,
          text: `Council response from ${speakerName} for turn ${turnIndex}.`,
          newClaim: `${speakerName} grounds the transit vector.`,
          speechAct: 'reframe',
          usedEvidenceIds: ['evidence-1'],
          provenance: { source: 'grounded_briefing' },
        }),
      }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  })
})

describe('CurrentSkyChat / CurrentPromotionalThread - Live Planetary Degree Council', () => {
  it('renders Live Current Sky Chat banner and planetary delegates', () => {
    render(<CurrentSkyChat />)

    // Check Live Current Sky Chat banner badge
    expect(screen.getByText(/LIVE CURRENT SKY CHAT ACTIVE/i)).toBeDefined()
    expect(screen.getByText(/Orbital Vector Field \(Live Sky Degree Map\)/i)).toBeDefined()

    // Check live planetary delegates are present
    expect(screen.getAllByText(/Sun/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Moon/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Mercury/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Venus/i).length).toBeGreaterThanOrEqual(1)

    // Check degree shift simulator button
    expect(screen.getByText(/⚡ Advance Moon 1° \(Simulate Shift\)/i)).toBeDefined()
  })

  it('renders transit preset prompts for the Current Sky Council', () => {
    render(<CurrentPromotionalThread />)

    expect(screen.getByText(/How does the current Moon degree/i)).toBeDefined()
    expect(screen.getByText(/What is the dominant elemental/i)).toBeDefined()
  })

  it('triggers degree shift ingress alert and fast-forwards to final response with Skip Delay', async () => {
    render(<CurrentSkyChat />)

    const advanceBtn = screen.getByText(/⚡ Advance Moon 1° \(Simulate Shift\)/i)
    fireEvent.click(advanceBtn)

    // Verify System Ingress Alert appears in chat
    await waitFor(() => {
      expect(screen.getByText(/⚡ SKY SHIFT DETECTED: Moon has advanced to/i)).toBeDefined()
    })

    // Skip delay button should appear while reaction is playing
    const skipBtn = await screen.findByText(/Skip Delay ⏩/i)
    expect(skipBtn).toBeDefined()
    fireEvent.click(skipBtn)

    // Verify nearest neighbor and final word arrive
    await waitFor(
      () => {
        expect(screen.getAllByText(/NEAREST NEIGHBOR/i).length).toBeGreaterThanOrEqual(1)
        expect(
          screen.getAllByText(/NEW DEGREE INAUGURATION · FINAL WORD/i).length
        ).toBeGreaterThanOrEqual(1)
      },
      { timeout: 4000 }
    )
  })

  it('allows user to send a prompt to the current sky council', async () => {
    render(<CurrentSkyChat />)

    const input = screen.getByPlaceholderText(/Ask the Current Sky Council/i)
    fireEvent.change(input, { target: { value: 'What energy is dominant in the sky today?' } })

    const sendBtn = screen.getByRole('button', { name: '' }) // icon button
    fireEvent.click(sendBtn)

    expect(screen.getByText('What energy is dominant in the sky today?')).toBeDefined()
  })

  it('displays real-time live sky sync badge and resets overrides to live sky', async () => {
    render(<CurrentSkyChat />)

    // Check Live Real-Time Sky Chat banner badge
    expect(screen.getByText(/LIVE CURRENT SKY CHAT ACTIVE/i)).toBeDefined()

    // Simulate shift
    const advanceBtn = screen.getByText(/⚡ Advance Moon 1° \(Simulate Shift\)/i)
    fireEvent.click(advanceBtn)

    // Reset button appears
    const resetBtn = await screen.findByText(/↺ Reset to Live Sky/i)
    expect(resetBtn).toBeDefined()

    // Click Reset
    fireEvent.click(resetBtn)
    expect(screen.queryByText(/↺ Reset to Live Sky/i)).toBeNull()
  })

  it('maintains backward compatible exports for BarbaultBasketPromotionalThread', () => {
    expect(BarbaultBasketPromotionalThread).toBe(CurrentPromotionalThread)
    expect(CurrentSkyChat).toBe(CurrentPromotionalThread)
  })
})
