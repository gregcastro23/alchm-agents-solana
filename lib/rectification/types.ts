import type { AscendantEstimate, NatalChart } from '@/lib/agent-types'

export type RectifyCalendar = 'gregorian' | 'julian'

export type RectifyEvidenceType =
  | 'time_clue'
  | 'recorded_time'
  | 'moon_sign'
  | 'life_event'
  | 'angular_transits'
  | 'secondary_progressions'
  | 'annual_profections'
  | 'primary_directions'
  | 'physical_temperament'

export type LifeEventCategory = 'career' | 'marriage' | 'relocation' | 'illness' | 'general'

export interface RectifyEvidenceItem {
  type: RectifyEvidenceType
  description?: string
  citation?: string
  // time_clue
  start_minute?: number
  end_minute?: number
  margin_minutes?: number
  window?: 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'night'
  // recorded_time
  reported_minute?: number
  time?: string
  rodden_rating?: 'AA' | 'A' | 'B' | 'C' | 'DD'
  // moon_sign
  moon_sign?: string
  expected_sign?: string
  // life_event / timing techniques
  category?: LifeEventCategory | string
  event_date?: string
  date?: string
  // physical_temperament
  affinity?: Record<string, number>
}

export interface EIGQuestionOption {
  id: string
  label: string
  short_label?: string
  type: RectifyEvidenceType
  start_minute?: number
  end_minute?: number
  margin_minutes?: number
  time_range?: string
  moon_sign?: string
  affinity?: Record<string, number>
  estimated_probability?: number
  likely_signs?: string[]
}

export interface EIGQuestion {
  rank: number
  id: string
  type: RectifyEvidenceType
  category: string
  cusp?: string
  ingress_time?: string
  expected_ig_bits: number
  question: string
  rationale: string
  options?: EIGQuestionOption[]
  competing_signs?: Array<{ sign: string; probability: number }>
}

export interface RisingWindow {
  sign: string
  start_time: string
  end_time: string
  duration_minutes: number
  prior_probability: number
}

export interface RectifyWindowsResult {
  rising_windows: RisingWindow[]
  moon_start: { sign: string; longitude: number }
  moon_end: { sign: string; longitude: number }
  moon_ingress_minute: number | null
  moon_ingress_time: string | null
  sun_rise_lmt: string | null
  sun_set_lmt: string | null
  entropy_bits: number
  next_best_questions: EIGQuestion[]
}

export interface RectifyScoreResult {
  distribution: Record<string, number>
  top_sign: string
  top_sign_probability: number
  working_longitude: number
  working_sign: string
  working_time: string
  window_80_minutes: number
  credible_window_80: { startLocal: string; endLocal: string }
  certainty: number
  is_calculations_eligible: boolean
  evidence_breakdown: Array<Record<string, any>>
  entropy_bits: number
  next_best_questions: EIGQuestion[]
}

const DIURNAL_WINDOW_DEFAULTS: Record<
  'dawn' | 'morning' | 'afternoon' | 'dusk' | 'night',
  { start_minute: number; end_minute: number; margin_minutes: number; label: string }
> = {
  dawn: { start_minute: 270, end_minute: 480, margin_minutes: 40, label: 'Dawn / Early Morning' },
  morning: {
    start_minute: 480,
    end_minute: 720,
    margin_minutes: 45,
    label: 'Morning / Late Morning',
  },
  afternoon: { start_minute: 720, end_minute: 1050, margin_minutes: 45, label: 'Afternoon' },
  dusk: {
    start_minute: 1020,
    end_minute: 1230,
    margin_minutes: 40,
    label: 'Sunset / Dusk / Evening',
  },
  night: {
    start_minute: 1230,
    end_minute: 1439,
    margin_minutes: 60,
    label: 'Late Evening / Night',
  },
}

/**
 * Normalizes LLM, CLI, and UI evidence shapes into the canonical Python scorer contract
 * (`start_minute`/`end_minute`, `reported_minute`, `moon_sign`, `event_date`, `category`).
 */
export function normalizeEvidenceItem(raw: RectifyEvidenceItem): RectifyEvidenceItem {
  const item: RectifyEvidenceItem = { ...raw }

  if (item.type === 'time_clue') {
    if (
      (item.start_minute === undefined || item.end_minute === undefined) &&
      item.window &&
      item.window in DIURNAL_WINDOW_DEFAULTS
    ) {
      const def = DIURNAL_WINDOW_DEFAULTS[item.window]
      item.start_minute = def.start_minute
      item.end_minute = def.end_minute
      if (item.margin_minutes === undefined) {
        item.margin_minutes = def.margin_minutes
      }
      if (!item.description) {
        item.description = def.label
      }
    }
    if (item.margin_minutes === undefined) {
      item.margin_minutes = 40
    }
  }

  if (item.type === 'recorded_time') {
    if (item.reported_minute === undefined && typeof item.time === 'string') {
      const match = /^(\d{1,2}):(\d{2})$/.exec(item.time.trim())
      if (match) {
        const hh = Math.min(23, Math.max(0, parseInt(match[1], 10)))
        const mm = Math.min(59, Math.max(0, parseInt(match[2], 10)))
        item.reported_minute = hh * 60 + mm
      }
    }
    if (!item.description) {
      const m = item.reported_minute ?? 720
      const hh = String(Math.floor(m / 60)).padStart(2, '0')
      const mm = String(m % 60).padStart(2, '0')
      item.description = `Reported time ~${hh}:${mm} (${item.rodden_rating || 'B'})`
    }
  }

  if (item.type === 'moon_sign') {
    if (!item.moon_sign && item.expected_sign) {
      item.moon_sign = item.expected_sign
    }
    if (!item.description && item.moon_sign) {
      item.description = `Moon in ${item.moon_sign}`
    }
  }

  if (
    item.type === 'life_event' ||
    item.type === 'angular_transits' ||
    item.type === 'secondary_progressions' ||
    item.type === 'annual_profections' ||
    item.type === 'primary_directions'
  ) {
    if (!item.event_date && item.date) {
      item.event_date = item.date
    }
    if (!item.description && item.event_date) {
      item.description = `${item.category || 'life'} event (${item.event_date})`
    }
  }

  return item
}

export function normalizeEvidenceList(items: RectifyEvidenceItem[]): RectifyEvidenceItem[] {
  return items.map(normalizeEvidenceItem)
}

export function buildAscendantEstimateFromScore(
  score: RectifyScoreResult,
  evidence: RectifyEvidenceItem[],
  method = 'bayesian_rectification_v1'
): AscendantEstimate {
  return {
    distribution: score.distribution,
    topSign: score.top_sign,
    topSignProbability: score.top_sign_probability,
    workingLongitude: score.working_longitude,
    workingSign: score.working_sign,
    window80Minutes: score.window_80_minutes,
    credibleWindow80: score.credible_window_80,
    certainty: score.certainty,
    evidence: evidence.map(ev => ({
      type: ev.type,
      description:
        ev.description ||
        ev.event_date ||
        ev.date ||
        ev.moon_sign ||
        ev.window ||
        'User-supplied rectification evidence',
      ...(ev.citation ? { citation: ev.citation } : {}),
    })),
    method,
  }
}

export function applyRectificationToNatalChart(
  chart: NatalChart,
  score: RectifyScoreResult,
  evidence: RectifyEvidenceItem[]
): NatalChart {
  const estimate = buildAscendantEstimateFromScore(score, evidence)
  return {
    ...chart,
    houses: {
      ...(chart.houses || {}),
      ASC: score.working_longitude,
    },
    ascendant: score.working_longitude,
    ascendantProvenance: 'rectified',
    ascendantEstimate: estimate,
  }
}
