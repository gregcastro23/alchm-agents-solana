import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { CurrentPromotionalThread } from '@/components/landing/current-promotional-thread'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

describe('CurrentPromotionalThread - Pisces Lunar Eclipse', () => {
  it('renders Pisces Lunar Eclipse Main Stage banner and delegates', () => {
    render(<CurrentPromotionalThread />)

    // Check Main Stage Moon 5° Pisces and Sun 5° Virgo (both header badge & diagram badge)
    const mainStageBadges = screen.getAllByText(/MAIN STAGE: MOON 5° PISCES ☍ SUN 5° VIRGO/i)
    expect(mainStageBadges.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Orbital Vector Field \(Pisces Lunar Eclipse Axis\)/i)).toBeDefined()
    expect(screen.getAllByText(/Moon in Pisces \(5°\)/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Sun in Virgo \(5°\)/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Mercury in Virgo \(5°\)/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Uranus in Gemini \(6°\)/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders the event preset prompts for the Pisces Lunar Eclipse', () => {
    render(<CurrentPromotionalThread />)

    expect(
      screen.getByText(
        /What is the 5° Pisces Moon & 5° Virgo Sun opposition asking me to release\?/i
      )
    ).toBeDefined()
    expect(
      screen.getByText(
        /How does Uranus in Gemini at the T-square apex bring mental breakthrough\?/i
      )
    ).toBeDefined()
    expect(
      screen.getByText(/How do I balance Virgo discernment with Pisces emotional surrender\?/i)
    ).toBeDefined()
  })
})
