import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SolarReturnCouncil } from '@/components/landing/solar-return-council'
import type { SolarReturnCouncilEdition } from '@/lib/agents/council/solar-return-types'

vi.mock('@/hooks/useSolarReturnCouncil', () => ({
  useSolarReturnCouncil: () => ({
    state: {
      edition: null,
      status: 'published',
      loading: false,
      error: null,
    },
    refresh: vi.fn(),
  }),
}))

function createMockSolarReturnEdition(): SolarReturnCouncilEdition {
  return {
    schemaVersion: 1,
    id: 'solar-return-council-v1:2026-10-27',
    date: '2026-10-27',
    timeZone: 'UTC',
    title: 'Solar Return Conclave · Scorpio 4° Alignment',
    summary:
      'A year-over-year dialogue contrasting the celestial balance from one tropical year ago with today.',
    returnIso: '2025-10-27T17:45:00.000Z',
    referenceIso: '2026-10-27T12:00:00.000Z',
    quality: 'verified',
    source: 'swiss-ephemeris',
    telemetry: {
      solarAlignment: {
        targetLongitude: 214.5,
        returnLongitude: 214.50002,
        deltaArcminutes: 0.0008,
        exactMatch: true,
        sign: 'Scorpio',
        degree: 4,
        minute: 30,
      },
      returnSky: {
        iso: '2025-10-27T17:45:00.000Z',
        timestamp: 1761587100000,
        source: 'swiss-ephemeris',
        quality: 'verified',
        positions: {
          Sun: {
            planet: 'Sun',
            sign: 'Scorpio',
            degree: 4.5,
            longitude: 214.5,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'water',
          },
          Moon: {
            planet: 'Moon',
            sign: 'Capricorn',
            degree: 15.0,
            longitude: 285.0,
            retrograde: false,
            dignity: 'Detriment',
            element: 'earth',
          },
          Mercury: {
            planet: 'Mercury',
            sign: 'Libra',
            degree: 29.0,
            longitude: 209.0,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'air',
          },
          Venus: {
            planet: 'Venus',
            sign: 'Virgo',
            degree: 19.0,
            longitude: 169.0,
            retrograde: false,
            dignity: 'Fall',
            element: 'earth',
          },
          Mars: {
            planet: 'Mars',
            sign: 'Scorpio',
            degree: 11.0,
            longitude: 221.0,
            retrograde: false,
            dignity: 'Domicile',
            element: 'water',
          },
          Jupiter: {
            planet: 'Jupiter',
            sign: 'Taurus',
            degree: 10.0,
            longitude: 40.0,
            retrograde: true,
            dignity: 'Peregrine',
            element: 'earth',
          },
          Saturn: {
            planet: 'Saturn',
            sign: 'Pisces',
            degree: 0.5,
            longitude: 330.5,
            retrograde: true,
            dignity: 'Peregrine',
            element: 'water',
          },
          Uranus: {
            planet: 'Uranus',
            sign: 'Taurus',
            degree: 21.0,
            longitude: 51.0,
            retrograde: true,
            dignity: 'Fall',
            element: 'earth',
          },
          Neptune: {
            planet: 'Neptune',
            sign: 'Pisces',
            degree: 25.0,
            longitude: 355.0,
            retrograde: true,
            dignity: 'Domicile',
            element: 'water',
          },
          Pluto: {
            planet: 'Pluto',
            sign: 'Capricorn',
            degree: 28.0,
            longitude: 298.0,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'earth',
          },
        },
        elements: {
          fire: 0,
          water: 4,
          earth: 5,
          air: 1,
          percentages: { fire: 0, water: 0.4, earth: 0.5, air: 0.1 },
        },
        esms: { spirit: 2.2, essence: 8.4, matter: 7.9, substance: 1.1 },
        thermodynamics: { heat: 0.35, reactivity: 0.88, entropy: 0.45, gregsEnergy: -0.04 },
      },
      referenceSky: {
        iso: '2026-10-27T12:00:00.000Z',
        timestamp: 1793102400000,
        source: 'swiss-ephemeris',
        quality: 'verified',
        positions: {
          Sun: {
            planet: 'Sun',
            sign: 'Scorpio',
            degree: 4.5,
            longitude: 214.5,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'water',
          },
          Moon: {
            planet: 'Moon',
            sign: 'Taurus',
            degree: 12.0,
            longitude: 42.0,
            retrograde: false,
            dignity: 'Exaltation',
            element: 'earth',
          },
          Mercury: {
            planet: 'Mercury',
            sign: 'Scorpio',
            degree: 18.0,
            longitude: 228.0,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'water',
          },
          Venus: {
            planet: 'Venus',
            sign: 'Sagittarius',
            degree: 2.0,
            longitude: 242.0,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'fire',
          },
          Mars: {
            planet: 'Mars',
            sign: 'Leo',
            degree: 28.0,
            longitude: 148.0,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'fire',
          },
          Jupiter: {
            planet: 'Jupiter',
            sign: 'Gemini',
            degree: 20.0,
            longitude: 80.0,
            retrograde: true,
            dignity: 'Detriment',
            element: 'air',
          },
          Saturn: {
            planet: 'Saturn',
            sign: 'Pisces',
            degree: 13.0,
            longitude: 343.0,
            retrograde: true,
            dignity: 'Peregrine',
            element: 'water',
          },
          Uranus: {
            planet: 'Uranus',
            sign: 'Taurus',
            degree: 26.0,
            longitude: 56.0,
            retrograde: true,
            dignity: 'Fall',
            element: 'earth',
          },
          Neptune: {
            planet: 'Neptune',
            sign: 'Pisces',
            degree: 27.0,
            longitude: 357.0,
            retrograde: true,
            dignity: 'Domicile',
            element: 'water',
          },
          Pluto: {
            planet: 'Pluto',
            sign: 'Aquarius',
            degree: 0.8,
            longitude: 300.8,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'air',
          },
        },
        elements: {
          fire: 2,
          water: 4,
          earth: 2,
          air: 2,
          percentages: { fire: 0.2, water: 0.4, earth: 0.2, air: 0.2 },
        },
        esms: { spirit: 3.1, essence: 7.2, matter: 5.5, substance: 2.0 },
        thermodynamics: { heat: 0.52, reactivity: 0.65, entropy: 0.55, gregsEnergy: 0.16 },
      },
      shiftedRulers: [
        { planet: 'Moon', fromSign: 'Capricorn', toSign: 'Taurus', shifted: true },
        { planet: 'Mercury', fromSign: 'Libra', toSign: 'Scorpio', shifted: true },
        { planet: 'Venus', fromSign: 'Virgo', toSign: 'Sagittarius', shifted: true },
        { planet: 'Mars', fromSign: 'Scorpio', toSign: 'Leo', shifted: true },
        { planet: 'Jupiter', fromSign: 'Taurus', toSign: 'Gemini', shifted: true },
      ],
      elementalDeltas: { fire: -0.2, water: 0, earth: 0.3, air: -0.1 },
      esmsDeltas: { spirit: -0.9, essence: 1.2, matter: 2.4, substance: -0.9 },
      thermodynamicDeltas: { heat: -0.17, reactivity: 0.23 },
    },
    turns: [
      {
        id: 'turn-1',
        speakerKey: 'gregory',
        speakerName: 'Gregory Castro',
        role: 'opening',
        text: 'Welcome to the Solar Return Conclave. Through verified astronomical return calculation, we assemble at the precise instant the Sun crosses its exact annual coordinate in Scorpio.',
        newClaim: 'The solar return degree in Scorpio anchors our annual benchmark.',
        speechAct: 'inaugurate',
        usedEvidenceIds: ['solar-alignment'],
        coverageIds: ['solar-alignment'],
        provenance: { source: 'grounded_briefing' },
      },
      {
        id: 'turn-2',
        speakerKey: 'moon',
        speakerName: 'Moon',
        role: 'planetary-reading',
        text: 'Speaking from my return station, in this historical return sky I spoke through Capricorn. The emotional atmosphere demanded endurance and patience.',
        newClaim: 'Moon in Capricorn asks for emotional discipline.',
        speechAct: 'support',
        usedEvidenceIds: ['placement-moon'],
        coverageIds: ['placement-moon'],
        provenance: { source: 'grounded_briefing' },
      },
      {
        id: 'turn-3',
        speakerKey: 'mars',
        speakerName: 'Mars',
        role: 'planetary-reading',
        text: 'Speaking from my return station, in this historical return sky I spoke through Scorpio. Will and strategic patience held silent power.',
        newClaim: 'Mars in Scorpio acts with focused, silent strategic willpower.',
        speechAct: 'challenge',
        usedEvidenceIds: ['placement-mars'],
        coverageIds: ['placement-mars'],
        provenance: { source: 'grounded_briefing' },
      },
      {
        id: 'turn-4',
        speakerKey: 'gregory',
        speakerName: 'Gregory Castro',
        role: 'integration',
        text: 'We pause here at the midpoint of our circle. The personal councils show us how feeling and agency held quiet ground. Now we look to the collective currents.',
        newClaim: 'Personal planetary transitions lay the foundation for collective growth.',
        speechAct: 'synthesize',
        usedEvidenceIds: ['inner-planets-bridge'],
        coverageIds: ['inner-planets-bridge'],
        provenance: { source: 'grounded_briefing' },
      },
      {
        id: 'turn-5',
        speakerKey: 'jupiter',
        speakerName: 'Jupiter',
        role: 'planetary-reading',
        text: 'In Taurus one year ago, growth was grounded in steady physical cultivation.',
        newClaim: 'Jupiter in Taurus expands through tangible stewardship.',
        speechAct: 'support',
        usedEvidenceIds: ['placement-jupiter'],
        coverageIds: ['placement-jupiter'],
        provenance: { source: 'grounded_briefing' },
      },
      {
        id: 'turn-6',
        speakerKey: 'gregory',
        speakerName: 'Gregory Castro',
        role: 'closing',
        text: 'Synthesizing our delegates: the Moon emphasized endurance while Mars held focused patience. Contrast last year’s water-heavy epoch with today’s fire-lit impetus. First, honor what matured in silence; second, animate your current actions with renewed conviction.',
        newClaim: 'Integrating return chart stillness with present momentum yields lasting growth.',
        speechAct: 'synthesize',
        usedEvidenceIds: ['closing-synthesis'],
        coverageIds: ['closing-synthesis'],
        provenance: { source: 'grounded_briefing' },
      },
    ],
    coveredTopics: [
      'solar-alignment',
      'placement-moon',
      'placement-mars',
      'inner-planets-bridge',
      'placement-jupiter',
      'closing-synthesis',
    ],
    generatedAt: '2026-10-27T12:00:00.000Z',
    promptVersion: 'solar-return-council-v1',
  }
}

describe('SolarReturnCouncil Component', () => {
  it('renders the Hero Echo Header with golden badge and exact degree match', () => {
    const mockEdition = createMockSolarReturnEdition()
    render(<SolarReturnCouncil initialEdition={mockEdition} />)

    expect(screen.getByText('Solar Return Conclave')).toBeInTheDocument()
    expect(screen.getByText(/4° 30' Scorpio/)).toBeInTheDocument()
    expect(screen.getByText(/Exact Match/)).toBeInTheDocument()
    expect(screen.getByText(/1 Year Ago \(Historical Return\)/)).toBeInTheDocument()
    expect(screen.getByText(/Today \(Reference Sky\)/)).toBeInTheDocument()
  })

  it('renders the Dual Sky Telemetry strip with shifted rulers and elemental gauges', () => {
    const mockEdition = createMockSolarReturnEdition()
    render(<SolarReturnCouncil initialEdition={mockEdition} />)

    expect(screen.getByText('Year-over-Year Dual Sky Telemetry')).toBeInTheDocument()
    expect(screen.getByText(/Shifted Fast Rulers/)).toBeInTheDocument()

    // Fast rulers
    expect(screen.getByText('☽ Moon')).toBeInTheDocument()
    expect(screen.getByText('♂ Mars')).toBeInTheDocument()
    expect(screen.getByText('♃ Jupiter')).toBeInTheDocument()

    // Elemental gauges
    expect(screen.getByText('Elemental Quad-Spectrum Contrast')).toBeInTheDocument()
    expect(screen.getByText('Fire')).toBeInTheDocument()
    expect(screen.getByText('Water')).toBeInTheDocument()
    expect(screen.getByText('Earth')).toBeInTheDocument()
    expect(screen.getByText('Air')).toBeInTheDocument()

    // Thermodynamics & ESMS
    expect(screen.getByText(/Thermodynamic & ESMS Balance Deltas/)).toBeInTheDocument()
  })

  it('renders dialogue turns with Gregory as host and planetary delegates', () => {
    const mockEdition = createMockSolarReturnEdition()
    render(<SolarReturnCouncil initialEdition={mockEdition} />)

    // Gregory turns
    const gregoryHeaders = screen.getAllByText('Gregory Castro')
    expect(gregoryHeaders.length).toBeGreaterThanOrEqual(2)

    expect(screen.getByText('Opening Inception')).toBeInTheDocument()
    expect(screen.getByText('Midway Integration')).toBeInTheDocument()
    expect(screen.getByText('Conclave Synthesis')).toBeInTheDocument()

    // Planetary delegates
    expect(screen.getByText('Moon')).toBeInTheDocument()
    expect(screen.getByText('Mars')).toBeInTheDocument()
    expect(screen.getByText('Jupiter')).toBeInTheDocument()
  })

  it('supports interactive accordion toggles on turn claims', () => {
    const mockEdition = createMockSolarReturnEdition()
    render(<SolarReturnCouncil initialEdition={mockEdition} />)

    const claimButtons = screen.getAllByRole('button', { name: /Toggle claim evidence/i })
    expect(claimButtons.length).toBeGreaterThan(0)

    const firstButton = claimButtons[0]
    expect(firstButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(firstButton)
    expect(firstButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Substantive Claim:')).toBeInTheDocument()
  })

  it('supports mode switching between Live Council and Solar Return Conclave', () => {
    const mockEdition = createMockSolarReturnEdition()
    const handleModeSelect = vi.fn()
    render(<SolarReturnCouncil initialEdition={mockEdition} onModeSelect={handleModeSelect} />)

    const liveTab = screen.getByRole('tab', { name: /Switch to Today's Live Planetary Council/i })
    const returnTab = screen.getByRole('tab', {
      name: /Switch to 1-Year-Ago Solar Return Conclave/i,
    })

    expect(returnTab).toHaveAttribute('aria-selected', 'true')
    expect(liveTab).toHaveAttribute('aria-selected', 'false')

    fireEvent.click(liveTab)
    expect(handleModeSelect).toHaveBeenCalledWith('live')
  })

  it('allows submitting private follow-up questions', () => {
    const mockEdition = createMockSolarReturnEdition()
    render(<SolarReturnCouncil initialEdition={mockEdition} />)

    const input = screen.getByPlaceholderText(/Ask about your year-over-year elemental shift/i)
    const askButton = screen.getByRole('button', {
      name: /Submit question to Solar Return Council/i,
    })

    fireEvent.change(input, { target: { value: 'How does my shifted Moon affect focus?' } })
    fireEvent.click(askButton)

    expect(screen.getByText(/Council reflection queued:/i)).toBeInTheDocument()
    expect(screen.getByText(/How does my shifted Moon affect focus\?/i)).toBeInTheDocument()
  })
})
