import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isAscendantCalculationsEligible } from '@/lib/agent-types'
import {
  applyRectificationToNatalChart,
  buildAscendantEstimateFromScore,
  normalizeEvidenceList,
  type RectifyScoreResult,
  type RectifyWindowsResult,
} from '@/lib/rectification/types'

const mockAuth = vi.hoisted(() => vi.fn())
const mockRunWindows = vi.hoisted(() => vi.fn())
const mockRunScore = vi.hoisted(() => vi.fn())
const mockGetNatalChart = vi.hoisted(() => vi.fn())
const mockApplyChart = vi.hoisted(() => vi.fn())
const mockUserProfileUpsert = vi.hoisted(() => vi.fn())
const mockBasicProfileUpsert = vi.hoisted(() => vi.fn())
const mockGetAlchemicalLegacy = vi.hoisted(() => vi.fn())
const mockGenerateHoroscope = vi.hoisted(() => vi.fn())
const mockAnalyzePhi = vi.hoisted(() => vi.fn())

const MockUnavailableError = vi.hoisted(
  () =>
    class extends Error {
      constructor(msg: string) {
        super(msg)
        this.name = 'RectificationUnavailableError'
      }
    }
)

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/rectification/server-runner', () => ({
  RectificationUnavailableError: MockUnavailableError,
  runRectifyWindows: mockRunWindows,
  runRectifyScore: mockRunScore,
}))
vi.mock('@/lib/services/natal-chart-storage', () => ({
  getNatalChart: mockGetNatalChart,
  applyRectifiedBirthTimeToChart: mockApplyChart,
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    user_profiles: { upsert: mockUserProfileUpsert },
    profiles: { upsert: mockBasicProfileUpsert },
  },
}))
vi.mock('@/lib/backend', () => ({
  backend: { request: vi.fn() },
  getAlchemicalQuantitiesLegacy: mockGetAlchemicalLegacy,
}))
vi.mock('@/lib/monica/horoscope-generator', () => ({
  generateAccurateHoroscope: mockGenerateHoroscope,
}))
vi.mock('@/lib/monica/monica-constant', () => ({
  analyzePhiAxisIndex: mockAnalyzePhi,
}))
vi.mock('@/lib/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { POST } from '@/app/api/rectify/route'
import { rectifyScoreTool, rectifyWindowsTool } from '@/lib/langchain/agent-tools'

const SAMPLE_WINDOWS: RectifyWindowsResult = {
  rising_windows: [
    {
      sign: 'Cancer',
      start_time: '09:15',
      end_time: '11:45',
      duration_minutes: 150,
      prior_probability: 0.1042,
    },
  ],
  moon_start: { sign: 'Sagittarius', longitude: 254.1 },
  moon_end: { sign: 'Sagittarius', longitude: 266.2 },
  moon_ingress_minute: null,
  moon_ingress_time: null,
  sun_rise_lmt: '06:24',
  sun_set_lmt: '18:10',
  entropy_bits: 3.4893,
  next_best_questions: [
    {
      rank: 1,
      id: 'time_clue_diurnal',
      type: 'time_clue',
      category: 'time_window',
      expected_ig_bits: 1.7786,
      question: 'Was the birth in pre-dawn, morning, midday, afternoon, or evening?',
      rationale: 'Coarse diurnal windowing breaks 4-quadrant symmetry.',
      options: [
        {
          id: 'morning_midday',
          label: 'Late Morning / Midday (08:31–13:00 LMT)',
          type: 'time_clue',
          start_minute: 511,
          end_minute: 780,
          margin_minutes: 35,
          estimated_probability: 0.25,
          likely_signs: ['Cancer', 'Leo', 'Gemini'],
        },
      ],
    },
  ],
}

const SAMPLE_ELIGIBLE_SCORE: RectifyScoreResult = {
  distribution: { Cancer: 0.84, Leo: 0.11, Gemini: 0.05 },
  top_sign: 'Cancer',
  top_sign_probability: 0.84,
  working_longitude: 101.65,
  working_sign: 'Cancer',
  working_time: '11:30',
  window_80_minutes: 95,
  credible_window_80: { startLocal: '10:45', endLocal: '12:20' },
  certainty: 0.78,
  is_calculations_eligible: true,
  evidence_breakdown: [
    {
      evidence: 'Morning birth record',
      type: 'time_clue',
      max_log_shift: 0,
      min_log_shift: -12,
      null_discount_applied: false,
    },
  ],
  entropy_bits: 0.77,
  next_best_questions: [],
}

describe('Public Rectification API, Helpers & LangChain Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateHoroscope.mockReturnValue({ tropical: { CelestialBodies: { all: [] } } })
    mockGetAlchemicalLegacy.mockResolvedValue({
      'Alchemy Effects': {
        'Total Spirit': 1,
        'Total Essence': 1,
        'Total Matter': 1,
        'Total Substance': 1,
      },
      'Dominant Element': 'Water',
    })
    mockAnalyzePhi.mockReturnValue({ value: 1.618 })
  })

  it('normalizes LLM/UI evidence aliases and builds eligible NatalChart updates', () => {
    const normalized = normalizeEvidenceList([
      { type: 'time_clue', window: 'morning' },
      { type: 'moon_sign', expected_sign: 'Scorpio' },
      { type: 'recorded_time', time: '10:24', rodden_rating: 'AA' },
      { type: 'life_event', category: 'career', date: '1905-06-30' },
    ])

    expect(normalized[0].start_minute).toBe(480)
    expect(normalized[0].end_minute).toBe(720)
    expect(normalized[1].moon_sign).toBe('Scorpio')
    expect(normalized[2].reported_minute).toBe(624)
    expect(normalized[3].event_date).toBe('1905-06-30')

    const updated = applyRectificationToNatalChart(
      {
        planets: {},
        houses: { ASC: 0, MC: 270 },
        aspects: [],
        ascendant: 0,
        midheaven: 270,
        ascendantProvenance: 'unmeasured',
      },
      SAMPLE_ELIGIBLE_SCORE,
      normalized
    )
    expect(updated.ascendant).toBe(101.65)
    expect(updated.ascendantProvenance).toBe('rectified')
    expect(isAscendantCalculationsEligible(updated)).toBe(true)

    const lowScore: RectifyScoreResult = {
      ...SAMPLE_ELIGIBLE_SCORE,
      top_sign_probability: 0.55,
      window_80_minutes: 210,
      is_calculations_eligible: false,
    }
    const lowEst = buildAscendantEstimateFromScore(lowScore, normalized)
    expect(
      isAscendantCalculationsEligible({
        ascendant: lowEst.workingLongitude,
        ascendantProvenance: 'rectified',
        ascendantEstimate: lowEst,
      })
    ).toBe(false)
  })

  it('handles public windows & score actions and fails closed with 503 when unavailable', async () => {
    mockRunWindows.mockResolvedValueOnce(SAMPLE_WINDOWS)
    const wReq = new Request('http://localhost/api/rectify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'windows',
        year: 1879,
        month: 3,
        day: 14,
        latitude: 48.4011,
        longitude: 9.9876,
      }),
    })
    const wRes = await POST(wReq)
    expect(wRes.status).toBe(200)
    const wJson = await wRes.json()
    expect(wJson.data.entropy_bits).toBe(3.4893)
    expect(wJson.data.next_best_questions[0].type).toBe('time_clue')

    mockRunScore.mockRejectedValueOnce(new MockUnavailableError('pyswisseph unavailable'))
    const sReq = new Request('http://localhost/api/rectify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'score',
        year: 1879,
        month: 3,
        day: 14,
        latitude: 48.4011,
        longitude: 9.9876,
        evidence: [{ type: 'time_clue', window: 'morning' }],
      }),
    })
    const sRes = await POST(sReq)
    expect(sRes.status).toBe(503)
  })

  it('requires authentication and enforces calculation-eligibility gate on apply_profile & apply_chart', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const unauthRes = await POST(
      new Request('http://localhost/api/rectify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_profile',
          year: 1991,
          month: 6,
          day: 23,
          latitude: 40.6782,
          longitude: -73.9442,
          evidence: [{ type: 'time_clue', window: 'morning' }],
        }),
      })
    )
    expect(unauthRes.status).toBe(401)

    // Unconfirmed posterior without allowUnconfirmed -> 409 conflict
    mockAuth.mockResolvedValue({ user: { id: 'user-1', name: 'Test User' } })
    mockRunScore.mockResolvedValueOnce({
      ...SAMPLE_ELIGIBLE_SCORE,
      top_sign_probability: 0.45,
      window_80_minutes: 240,
      is_calculations_eligible: false,
    })
    const conflictRes = await POST(
      new Request('http://localhost/api/rectify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_profile',
          year: 1991,
          month: 6,
          day: 23,
          latitude: 40.6782,
          longitude: -73.9442,
          evidence: [{ type: 'time_clue', window: 'morning' }],
        }),
      })
    )
    expect(conflictRes.status).toBe(409)

    // Eligible posterior -> saves user_profiles + profiles with ascendantProvenance='rectified'
    mockRunScore.mockResolvedValueOnce(SAMPLE_ELIGIBLE_SCORE)
    mockUserProfileUpsert.mockResolvedValueOnce({ id: 'prof-1', birthTime: '11:30' })
    mockBasicProfileUpsert.mockResolvedValueOnce({ id: 'basic-1' })

    const okProfileRes = await POST(
      new Request('http://localhost/api/rectify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_profile',
          year: 1991,
          month: 6,
          day: 23,
          latitude: 40.6782,
          longitude: -73.9442,
          locationName: 'Brooklyn, NY',
          evidence: [{ type: 'recorded_time', time: '10:24', rodden_rating: 'AA' }],
        }),
      })
    )
    expect(okProfileRes.status).toBe(200)
    const upsertCall = mockUserProfileUpsert.mock.calls[0][0]
    expect(upsertCall.update.birthTime).toBe('11:30')
    expect(upsertCall.update.natalChart.ascendantProvenance).toBe('rectified')
    expect(upsertCall.update.natalChart.ascendantEstimate.topSign).toBe('Cancer')

    // Chart ownership check + apply_chart success
    mockGetNatalChart.mockResolvedValueOnce(null)
    const missingChartRes = await POST(
      new Request('http://localhost/api/rectify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_chart',
          chartId: 'missing-chart',
          evidence: [{ type: 'time_clue', window: 'morning' }],
        }),
      })
    )
    expect(missingChartRes.status).toBe(404)

    mockGetNatalChart.mockResolvedValueOnce({
      id: 'chart-1',
      userId: 'user-1',
      birthDate: new Date('1991-06-23T12:00:00Z'),
      birthLocation: { name: 'Brooklyn', lat: 40.6782, lon: -73.9442 },
    })
    mockRunScore.mockResolvedValueOnce(SAMPLE_ELIGIBLE_SCORE)
    mockApplyChart.mockResolvedValueOnce({ id: 'chart-1', birthTime: '11:30' })

    const okChartRes = await POST(
      new Request('http://localhost/api/rectify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_chart',
          chartId: 'chart-1',
          evidence: [{ type: 'recorded_time', time: '10:24', rodden_rating: 'AA' }],
        }),
      })
    )
    expect(okChartRes.status).toBe(200)
    expect(mockApplyChart).toHaveBeenCalledWith(
      'chart-1',
      'user-1',
      '11:30',
      expect.objectContaining({ topSign: 'Cancer', topSignProbability: 0.84 })
    )
  })

  it('surfaces entropyBits & recommendedNextQuestion in LangChain rectify tools', async () => {
    mockRunWindows.mockResolvedValueOnce(SAMPLE_WINDOWS)
    const wOut = JSON.parse(
      await rectifyWindowsTool.invoke({
        year: 1879,
        month: 3,
        day: 14,
        latitude: 48.4011,
        longitude: 9.9876,
      })
    )
    expect(wOut.success).toBe(true)
    expect(wOut.entropyBits).toBe(3.4893)
    expect(wOut.recommendedNextQuestion.id).toBe('time_clue_diurnal')

    mockRunScore.mockResolvedValueOnce(SAMPLE_ELIGIBLE_SCORE)
    const sOut = JSON.parse(
      await rectifyScoreTool.invoke({
        year: 1879,
        month: 3,
        day: 14,
        latitude: 48.4011,
        longitude: 9.9876,
        evidence: [
          { type: 'time_clue', window: 'morning' },
          { type: 'life_event', category: 'career', date: '1905-06-30' },
        ],
        step_minutes: 15, // clamped to <= 10 by tool
      })
    )
    expect(sOut.success).toBe(true)
    expect(sOut.calculationEligible).toBe(true)
    expect(sOut.topSign).toBe('Cancer')
    expect(mockRunScore).toHaveBeenCalledWith(
      expect.objectContaining({
        step_minutes: 10,
        evidence: expect.arrayContaining([
          expect.objectContaining({ type: 'time_clue', start_minute: 480, end_minute: 720 }),
          expect.objectContaining({
            type: 'life_event',
            category: 'career',
            event_date: '1905-06-30',
          }),
        ]),
      })
    )
  })
})
