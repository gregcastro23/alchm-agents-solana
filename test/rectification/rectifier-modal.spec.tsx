import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BirthTimeRectifierPanel } from '@/components/rectification/BirthTimeRectifierPanel'
import { BirthTimeRectifierModal } from '@/components/rectification/BirthTimeRectifierModal'
import { NatalChartInput } from '@/components/natal-chart-input'

vi.mock('@/components/onboarding/LocationSearch', () => ({
  LocationSearch: ({ label, defaultValue }: { label?: string; defaultValue?: string }) => (
    <div>
      <span>{label || 'Birth City'}</span>
      <input readOnly aria-label={label || 'Birth City'} value={defaultValue || ''} />
    </div>
  ),
}))

describe('Interactive BirthTimeRectifierPanel, Modal & NatalChartInput Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure jsdom supports native <dialog> methods used by BirthTimeRectifierModal
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    })
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('walks through EIG questions (time_clue -> life_event) until calculation eligibility and applies time', async () => {
    const fetchMock = vi
      .fn()
      // 1. windows scan
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            rising_windows: [
              {
                sign: 'Cancer',
                start_time: '09:15',
                end_time: '11:45',
                duration_minutes: 150,
                prior_probability: 0.5,
              },
              {
                sign: 'Leo',
                start_time: '11:45',
                end_time: '14:15',
                duration_minutes: 150,
                prior_probability: 0.5,
              },
            ],
            moon_start: { sign: 'Sagittarius', longitude: 254.0 },
            moon_end: { sign: 'Sagittarius', longitude: 266.0 },
            moon_ingress_minute: null,
            moon_ingress_time: null,
            sun_rise_lmt: '06:24',
            sun_set_lmt: '18:10',
            entropy_bits: 3.49,
            next_best_questions: [
              {
                rank: 1,
                id: 'time_clue_diurnal',
                type: 'time_clue',
                category: 'time_window',
                expected_ig_bits: 1.78,
                question: 'Was the birth in pre-dawn, morning, midday, afternoon, or evening?',
                rationale: 'Coarse diurnal window breaks 4-quadrant symmetry.',
                options: [
                  {
                    id: 'morning_midday',
                    label: 'Late Morning / Midday (08:31–13:00 LMT)',
                    type: 'time_clue',
                    start_minute: 511,
                    end_minute: 780,
                    margin_minutes: 35,
                    estimated_probability: 0.25,
                    likely_signs: ['Cancer', 'Leo'],
                  },
                ],
              },
            ],
          },
        }),
      })
      // 2. score after diurnal click (not yet >= 70%)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            distribution: { Cancer: 0.54, Leo: 0.46 },
            top_sign: 'Cancer',
            top_sign_probability: 0.54,
            working_longitude: 102.5,
            working_sign: 'Cancer',
            working_time: '11:25',
            window_80_minutes: 210,
            credible_window_80: { startLocal: '09:30', endLocal: '13:00' },
            certainty: 0.42,
            is_calculations_eligible: false,
            evidence_breakdown: [],
            entropy_bits: 0.99,
            next_best_questions: [
              {
                rank: 1,
                id: 'life_event_career',
                type: 'life_event',
                category: 'career',
                cusp: 'MC',
                expected_ig_bits: 0.31,
                question: 'When did a major career breakthrough occur?',
                rationale: 'Career events activate the Midheaven (MC).',
              },
            ],
          },
        }),
      })
      // 3. score after career event -> crosses >= 70% & <= 180m gate!
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            distribution: { Cancer: 0.82, Leo: 0.18 },
            top_sign: 'Cancer',
            top_sign_probability: 0.82,
            working_longitude: 101.65,
            working_sign: 'Cancer',
            working_time: '11:30',
            window_80_minutes: 95,
            credible_window_80: { startLocal: '10:45', endLocal: '12:20' },
            certainty: 0.75,
            is_calculations_eligible: true,
            evidence_breakdown: [],
            entropy_bits: 0.68,
            next_best_questions: [],
          },
        }),
      })

    vi.stubGlobal('fetch', fetchMock)
    const onApply = vi.fn()

    render(
      <BirthTimeRectifierPanel
        initialBirthDate="1879-03-14"
        initialLocation={{ name: 'Ulm, Germany', lat: 48.4011, lon: 9.9876 }}
        mode="embed"
        autoScan
        onApply={onApply}
      />
    )

    // Auto-scanned and surfaced Question #1 (diurnal window)
    await waitFor(() => {
      expect(screen.getByText(/Late Morning \/ Midday/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Entropy: 3\.49 bits/i)).toBeInTheDocument()

    // Click diurnal window option
    fireEvent.click(screen.getByRole('button', { name: /Late Morning \/ Midday/i }))

    await waitFor(() => {
      expect(screen.getByText(/Needs Narrowing/i)).toBeInTheDocument()
      expect(screen.getByText(/When did a major career breakthrough occur/i)).toBeInTheDocument()
    })

    // Below threshold requires tentative checkbox before Use Working Time activates
    const applyBtnBefore = screen.getByRole('button', {
      name: /Use Working Time \(11:25 · Cancer\)/i,
    })
    expect(applyBtnBefore).toBeDisabled()

    // Answer Question #1 (career event date)
    fireEvent.change(screen.getByLabelText(/Milestone Date/i), { target: { value: '1905-06-30' } })
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Annus Mirabilis papers' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Add Event & Update Posterior/i }))

    await waitFor(() => {
      expect(screen.getByText(/Calculation Eligible/i)).toBeInTheDocument()
      expect(screen.getAllByText(/82\.0%/i).length).toBeGreaterThanOrEqual(1)
    })

    const applyBtnAfter = screen.getByRole('button', {
      name: /Use Working Time \(11:30 · Cancer\)/i,
    })
    expect(applyBtnAfter).toBeEnabled()
    fireEvent.click(applyBtnAfter)

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        workingTime: '11:30',
        isCalculationsEligible: true,
      })
    )
    expect(onApply.mock.calls[0][0].evidence).toHaveLength(2)
  })

  it('opens native modal dialog in BirthTimeRectifierModal and shows rectifier toggle inside NatalChartInput when unknown', () => {
    render(
      <BirthTimeRectifierModal
        open
        onClose={vi.fn()}
        title="Modal Rectifier"
        initialBirthDate="1991-06-23"
        initialLocation={{ name: 'Brooklyn, NY', lat: 40.6782, lon: -73.9442 }}
      />
    )
    expect(screen.getByText('Modal Rectifier')).toBeInTheDocument()
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()

    render(
      <NatalChartInput
        onSubmit={vi.fn(async () => {})}
        initialData={{
          chartName: 'Ada Chart',
          birthDate: '1991-06-23',
          birthTime: '',
          birthLocation: { name: 'Brooklyn, NY', lat: 40.6782, lon: -73.9442 },
        }}
      />
    )

    expect(
      screen.queryByRole('button', { name: /Estimate Ascendant via Birth Time Rectifier/i })
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Unknown' }))
    const rectifyTrigger = screen.getByRole('button', {
      name: /Estimate Ascendant via Birth Time Rectifier/i,
    })
    expect(rectifyTrigger).toBeInTheDocument()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            rising_windows: [],
            moon_start: { sign: 'Scorpio', longitude: 230 },
            moon_end: { sign: 'Scorpio', longitude: 242 },
            entropy_bits: 3.5,
            next_best_questions: [],
          },
        }),
      }))
    )
    fireEvent.click(rectifyTrigger)
    expect(screen.getByText('Rectify Unknown Birth Time')).toBeInTheDocument()
  })
})
