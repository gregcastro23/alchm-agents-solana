// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/lib/db', () => ({ prisma: {} }))

import { RectificationView } from '@/components/admin/pages/RectificationPage'
import type { RectificationPayload } from '@/lib/admin/page-schemas'

function makeDistribution(topSign: string, topProb: number): Record<string, number> {
  const signs = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ]
  const rest = (1 - topProb) / 11
  return Object.fromEntries(signs.map(s => [s, s === topSign ? topProb : rest]))
}

const LIVE_FIXTURE: RectificationPayload = {
  generatedAt: '2026-11-12T18:30:00.000Z',
  dossiersSource: 'python-cli',
  dossiers: {
    ok: true,
    value: [
      {
        agentId: 'leonardo-da-vinci',
        fileSlug: 'leonardo-da-vinci',
        name: 'Leonardo da Vinci',
        classification: 'archival_clue',
        rectifiable: true,
        roddenRating: 'B',
        dateConfidence: 'exact',
        dateUncertaintyReason: null,
        birth: {
          year: 1452,
          month: 4,
          day: 15,
          lat: 43.7833,
          lon: 11.25,
          calendar: 'julian',
          locationName: 'Vinci, Republic of Florence',
        },
        timeClue: {
          source: 'Ser Antonio notarial ledger: alle tre ore di notte',
          startMinute: 1280,
          endMinute: 1380,
          marginMinutes: 35,
          rodden: 'B',
        },
        events: [
          {
            type: 'time_clue',
            start_minute: 1280,
            end_minute: 1380,
            description: 'Alle tre ore di notte',
          },
        ],
        notes: null,
        score: {
          distribution: makeDistribution('Sagittarius', 0.7354),
          top_sign: 'Sagittarius',
          top_sign_probability: 0.7354,
          working_longitude: 259.74,
          working_sign: 'Sagittarius',
          working_time: '22:40',
          window_80_minutes: 80,
          credible_window_80: { startLocal: '21:00', endLocal: '23:55' },
          certainty: 0.6945,
          is_calculations_eligible: true,
          evidence_breakdown: [],
        },
        recommendedProvenance: 'rectified',
        calculationsEligible: true,
      },
      {
        agentId: 'charles-darwin-1809',
        fileSlug: 'charles-darwin',
        name: 'Charles Darwin',
        classification: 'date_known_milestones',
        rectifiable: true,
        roddenRating: 'X',
        dateConfidence: 'exact',
        dateUncertaintyReason: null,
        birth: {
          year: 1809,
          month: 2,
          day: 12,
          lat: 52.708,
          lon: -2.754,
          calendar: 'gregorian',
          locationName: 'Shrewsbury, England',
        },
        timeClue: null,
        events: [
          {
            type: 'life_event',
            category: 'career',
            date: '1859-11-24',
            description: 'Origin of Species published',
          },
        ],
        notes: null,
        score: {
          distribution: makeDistribution('Virgo', 0.172),
          top_sign: 'Virgo',
          top_sign_probability: 0.172,
          working_longitude: 157.41,
          working_sign: 'Virgo',
          working_time: '18:20',
          window_80_minutes: 485,
          credible_window_80: { startLocal: '05:10', endLocal: '21:15' },
          certainty: 0.12,
          is_calculations_eligible: false,
          evidence_breakdown: [],
        },
        recommendedProvenance: 'rectified',
        calculationsEligible: false,
      },
      {
        agentId: 'lao-tzu',
        fileSlug: 'lao-tzu',
        name: 'Lao Tzu',
        classification: 'approximate_or_symbolic_date',
        rectifiable: false,
        roddenRating: 'XX',
        dateConfidence: 'disputed',
        dateUncertaintyReason: 'No historical birth record.',
        birth: {
          year: -600,
          month: 4,
          day: 8,
          lat: 34.7578,
          lon: 113.6553,
          calendar: 'julian',
          locationName: 'Chu State, China',
        },
        timeClue: null,
        events: [],
        notes: null,
        score: null,
        recommendedProvenance: 'undated',
        calculationsEligible: false,
      },
    ],
  },
  dbStates: {
    ok: true,
    value: [
      {
        agentId: 'leonardo-da-vinci',
        presentInDb: true,
        codeAscendantProvenance: 'unmeasured',
        codeAscendantDeg: 180,
        dbAscendantProvenance: 'unmeasured',
        dbAscendantDeg: 180,
        dbCalculationsEligible: false,
        dbEstimate: null,
        reviewStatus: 'pending',
        lastAudit: null,
      },
      {
        agentId: 'charles-darwin-1809',
        presentInDb: true,
        codeAscendantProvenance: 'unmeasured',
        codeAscendantDeg: 180,
        dbAscendantProvenance: 'unmeasured',
        dbAscendantDeg: 180,
        dbCalculationsEligible: false,
        dbEstimate: null,
        reviewStatus: 'pending',
        lastAudit: null,
      },
      {
        agentId: 'lao-tzu',
        presentInDb: true,
        codeAscendantProvenance: 'undated',
        codeAscendantDeg: null,
        dbAscendantProvenance: 'undated',
        dbAscendantDeg: null,
        dbCalculationsEligible: false,
        dbEstimate: null,
        reviewStatus: 'non-rectifiable',
        lastAudit: null,
      },
    ],
  },
  auditTrail: { ok: true, value: [] },
  counts: {
    total: 3,
    archivalClue: 1,
    dateKnownMilestones: 1,
    nonRectifiable: 1,
    approvedInDb: 0,
    rejectedInAudit: 0,
    calculationsEligibleInDb: 0,
  },
  alerts: [],
}

describe('RectificationView UI', () => {
  it('renders live dossiers, posterior details, and filters cleanly', () => {
    render(<RectificationView data={LIVE_FIXTURE} />)

    expect(screen.getAllByText('Leonardo da Vinci').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Sagittarius 259.74°')).toBeInTheDocument()
    expect(screen.getByText('Eligible for Sacred 7')).toBeInTheDocument()

    // Select Darwin to verify below-threshold warning banner renders
    fireEvent.click(screen.getByRole('button', { name: 'Milestones only' }))
    expect(screen.getAllByText('Charles Darwin').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Below 70% \/ 180m gate/)).toBeInTheDocument()
  })

  it('renders Unknown markers and alerts rather than 0 when dossier service is unreachable', () => {
    const unavailable: RectificationPayload = {
      generatedAt: '2026-11-12T18:30:00.000Z',
      dossiersSource: 'unavailable',
      dossiers: { ok: false, reason: 'pyswisseph missing' },
      dbStates: { ok: false, reason: 'DB offline' },
      auditTrail: { ok: false, reason: 'Audit table offline' },
      counts: {
        total: null,
        archivalClue: null,
        dateKnownMilestones: null,
        nonRectifiable: null,
        approvedInDb: null,
        rejectedInAudit: null,
        calculationsEligibleInDb: null,
      },
      alerts: [
        {
          id: 'rectification:dossiers-unreadable',
          severity: 'critical',
          source: 'agents',
          title: 'Historical rectification dossier service unreachable',
          detail: 'pyswisseph missing',
        },
      ],
    }

    render(<RectificationView data={unavailable} />)
    expect(
      screen.getByText(/Historical rectification dossier service unreachable/)
    ).toBeInTheDocument()
    expect(screen.getAllByLabelText(/^unknown: pyswisseph missing/).length).toBeGreaterThan(0)
  })
})
