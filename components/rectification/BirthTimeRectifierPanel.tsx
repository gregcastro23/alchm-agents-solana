'use client'

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocationSearch, type LocationData } from '@/components/onboarding/LocationSearch'
import type {
  EIGQuestion,
  EIGQuestionOption,
  RectifyCalendar,
  RectifyEvidenceItem,
  RectifyScoreResult,
  RectifyWindowsResult,
} from '@/lib/rectification/types'
import {
  CheckCircle2,
  Clock,
  Compass,
  HelpCircle,
  Moon,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react'

const ZODIAC_ORDER = [
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
] as const

export interface RectifierApplyPayload {
  workingTime: string
  score: RectifyScoreResult
  evidence: RectifyEvidenceItem[]
  isCalculationsEligible: boolean
}

export interface BirthTimeRectifierPanelProps {
  initialBirthDate?: string
  initialLocation?: { name: string; lat: number; lon: number }
  initialCalendar?: RectifyCalendar
  mode?: 'standalone' | 'embed'
  chartId?: string
  allowUnconfirmedApply?: boolean
  autoScan?: boolean
  onApply?: (result: RectifierApplyPayload) => void
  onCancel?: () => void
}

function parseBirthDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  if (!m) return null
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  const day = parseInt(m[3], 10)
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

function parseHhMmToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const hh = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

export function BirthTimeRectifierPanel({
  initialBirthDate = '',
  initialLocation,
  initialCalendar = 'gregorian',
  mode = 'standalone',
  chartId,
  allowUnconfirmedApply = true,
  autoScan = false,
  onApply,
  onCancel,
}: BirthTimeRectifierPanelProps) {
  const formId = useId()
  const questionHeadingRef = useRef<HTMLHeadingElement>(null)

  const [birthDate, setBirthDate] = useState(initialBirthDate)
  const [calendar, setCalendar] = useState<RectifyCalendar>(initialCalendar)
  const [location, setLocation] = useState<{ name: string; lat: number; lon: number }>({
    name: initialLocation?.name || '',
    lat: initialLocation?.lat ?? 0,
    lon: initialLocation?.lon ?? 0,
  })

  const [windowsResult, setWindowsResult] = useState<RectifyWindowsResult | null>(null)
  const [scoreResult, setScoreResult] = useState<RectifyScoreResult | null>(null)
  const [evidence, setEvidence] = useState<RectifyEvidenceItem[]>([])
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0)

  // Event & custom time input states
  const [eventDate, setEventDate] = useState('')
  const [eventCategory, setEventCategory] = useState('career')
  const [eventDescription, setEventDescription] = useState('')
  const [customStartTime, setCustomStartTime] = useState('')
  const [customEndTime, setCustomEndTime] = useState('')
  const [showCustomTimeBox, setShowCustomTimeBox] = useState(false)
  const [confirmUnconfirmedSave, setConfirmUnconfirmedSave] = useState(false)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')

  const hasValidCoordinates =
    Boolean(parseBirthDateParts(birthDate)) &&
    Boolean(location.name) &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lon) &&
    !(location.lat === 0 && location.lon === 0)

  const runInitialScan = useCallback(
    async (targetDate = birthDate, targetLocation = location, targetCalendar = calendar) => {
      const parts = parseBirthDateParts(targetDate)
      if (!parts) {
        setError('Please enter a valid birth date (YYYY-MM-DD).')
        return
      }
      if (!targetLocation.name && targetLocation.lat === 0 && targetLocation.lon === 0) {
        setError('Please search and select a birth city before scanning.')
        return
      }

      setLoading(true)
      setError(null)
      setSaveMessage(null)
      try {
        const res = await fetch('/api/rectify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'windows',
            year: parts.year,
            month: parts.month,
            day: parts.day,
            latitude: targetLocation.lat,
            longitude: targetLocation.lon,
            calendar: targetCalendar,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json?.data) {
          throw new Error(json?.error || `Rectification scan failed (${res.status})`)
        }
        setWindowsResult(json.data as RectifyWindowsResult)
        setScoreResult(null)
        setEvidence([])
        setActiveQuestionIdx(0)
        setConfirmUnconfirmedSave(false)
        setStatusMessage(
          `Scanned 24-hour rising windows. Shannon entropy is ${(json.data.entropy_bits ?? 3.58).toFixed(2)} bits.`
        )
      } catch (err: any) {
        setError(err?.message || 'Unable to run birth time scan')
      } finally {
        setLoading(false)
      }
    },
    [birthDate, calendar, location]
  )

  // Auto-scan when opened inside a form that already collected birth date + location
  const didAutoScanRef = useRef(false)
  useEffect(() => {
    if (autoScan && !didAutoScanRef.current && hasValidCoordinates) {
      didAutoScanRef.current = true
      void runInitialScan()
    }
  }, [autoScan, hasValidCoordinates, runInitialScan])

  const scoreWithEvidence = useCallback(
    async (nextEvidence: RectifyEvidenceItem[], announcementLabel?: string) => {
      const parts = parseBirthDateParts(birthDate)
      if (!parts) return

      if (nextEvidence.length === 0) {
        setEvidence([])
        setScoreResult(null)
        setActiveQuestionIdx(0)
        setStatusMessage('Cleared all evidence back to 24-hour rising prior.')
        return
      }

      setLoading(true)
      setError(null)
      setSaveMessage(null)
      try {
        const res = await fetch('/api/rectify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'score',
            year: parts.year,
            month: parts.month,
            day: parts.day,
            latitude: location.lat,
            longitude: location.lon,
            calendar,
            evidence: nextEvidence,
            step_minutes: 5,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json?.data) {
          throw new Error(json?.error || `Scoring failed (${res.status})`)
        }
        const scored = json.data as RectifyScoreResult
        setEvidence(nextEvidence)
        setScoreResult(scored)
        setActiveQuestionIdx(0)
        const nextCat = scored.next_best_questions?.[0]?.category
        if (nextCat && ['career', 'marriage', 'relocation', 'illness'].includes(nextCat)) {
          setEventCategory(nextCat)
        }
        setStatusMessage(
          `${announcementLabel ? `${announcementLabel}. ` : ''}Top rising sign ${scored.top_sign} at ${(scored.top_sign_probability * 100).toFixed(1)}%, working time ${scored.working_time} LMT, 80% window ${scored.window_80_minutes} minutes.`
        )
        questionHeadingRef.current?.focus()
      } catch (err: any) {
        setError(err?.message || 'Failed to compute rectification posterior')
      } finally {
        setLoading(false)
      }
    },
    [birthDate, calendar, location.lat, location.lon]
  )

  const activeQuestions: EIGQuestion[] = useMemo(() => {
    if (scoreResult?.next_best_questions) return scoreResult.next_best_questions
    if (windowsResult?.next_best_questions) return windowsResult.next_best_questions
    return []
  }, [scoreResult, windowsResult])

  const currentQuestion: EIGQuestion | null =
    activeQuestions[activeQuestionIdx] || activeQuestions[0] || null

  // Pre-sync category dropdown when user switches question tab
  useEffect(() => {
    if (
      currentQuestion?.type === 'life_event' &&
      currentQuestion.category &&
      ['career', 'marriage', 'relocation', 'illness'].includes(currentQuestion.category)
    ) {
      setEventCategory(currentQuestion.category)
    }
  }, [currentQuestion])

  const handleOptionSelect = (option: EIGQuestionOption) => {
    let item: RectifyEvidenceItem
    if (option.type === 'time_clue') {
      item = {
        type: 'time_clue',
        description: option.label,
        start_minute: option.start_minute,
        end_minute: option.end_minute,
        margin_minutes: option.margin_minutes ?? 35,
      }
    } else if (option.type === 'moon_sign') {
      item = {
        type: 'moon_sign',
        description: option.label,
        moon_sign: option.moon_sign,
      }
    } else {
      item = {
        type: option.type,
        description: option.label,
        affinity: option.affinity,
      }
    }
    void scoreWithEvidence([...evidence, item], option.label)
  }

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventDate) {
      setError('Please select a date for this life milestone.')
      return
    }
    const item: RectifyEvidenceItem = {
      type: 'life_event',
      category: eventCategory,
      event_date: eventDate,
      description: eventDescription.trim() || `${eventCategory} milestone (${eventDate})`,
    }
    setEventDate('')
    setEventDescription('')
    void scoreWithEvidence([...evidence, item], `Added ${eventCategory} event (${eventDate})`)
  }

  const handleCustomTimeAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const sMin = parseHhMmToMinutes(customStartTime)
    const eMin = parseHhMmToMinutes(customEndTime || customStartTime)
    if (sMin === null || eMin === null) {
      setError('Enter valid HH:MM local time bounds.')
      return
    }
    const item: RectifyEvidenceItem =
      sMin === eMin
        ? {
            type: 'recorded_time',
            reported_minute: sMin,
            rodden_rating: 'B',
            description: `Approximate family clock memory (~${customStartTime} LMT)`,
          }
        : {
            type: 'time_clue',
            start_minute: Math.min(sMin, eMin),
            end_minute: Math.max(sMin, eMin),
            margin_minutes: 30,
            description: `Custom clock window (${customStartTime}–${customEndTime} LMT)`,
          }
    setCustomStartTime('')
    setCustomEndTime('')
    setShowCustomTimeBox(false)
    void scoreWithEvidence([...evidence, item], item.description)
  }

  const handleRemoveEvidence = (index: number) => {
    const next = evidence.filter((_, idx) => idx !== index)
    void scoreWithEvidence(next, 'Removed evidence item')
  }

  const handleApplyOrSave = async () => {
    if (!scoreResult) return
    const eligible = scoreResult.is_calculations_eligible
    if (!eligible && (!allowUnconfirmedApply || !confirmUnconfirmedSave)) {
      setError(
        'Check the confirmation box below to save an unconfirmed working estimate (< 70% certainty or > 180m window).'
      )
      return
    }

    if (mode === 'embed' && onApply && !chartId) {
      onApply({
        workingTime: scoreResult.working_time,
        score: scoreResult,
        evidence,
        isCalculationsEligible: eligible,
      })
      return
    }

    const parts = parseBirthDateParts(birthDate)
    if (!parts) return

    setSaving(true)
    setError(null)
    setSaveMessage(null)
    try {
      const payload = chartId
        ? {
            action: 'apply_chart',
            chartId,
            evidence,
            step_minutes: 3,
            allowUnconfirmed: !eligible && confirmUnconfirmedSave,
          }
        : {
            action: 'apply_profile',
            year: parts.year,
            month: parts.month,
            day: parts.day,
            latitude: location.lat,
            longitude: location.lon,
            calendar,
            locationName: location.name,
            evidence,
            step_minutes: 3,
            allowUnconfirmed: !eligible && confirmUnconfirmedSave,
          }

      const res = await fetch('/api/rectify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) {
          if (onApply) {
            onApply({
              workingTime: scoreResult.working_time,
              score: scoreResult,
              evidence,
              isCalculationsEligible: eligible,
            })
            return
          }
          throw new Error('Sign in to save your rectified Ascendant directly to your profile.')
        }
        throw new Error(json?.error || `Save failed (${res.status})`)
      }

      setSaveMessage(
        `Saved working birth time ${scoreResult.working_time} LMT (${scoreResult.top_sign} rising).`
      )
      onApply?.({
        workingTime: scoreResult.working_time,
        score: scoreResult,
        evidence,
        isCalculationsEligible: eligible,
      })
    } catch (err: any) {
      setError(err?.message || 'Unable to save rectified chart')
    } finally {
      setSaving(false)
    }
  }

  // Derive normalized 12-sign distribution for display from scoreResult or prior windowsResult
  const displayDistribution = useMemo(() => {
    const raw: Record<string, number> = Object.fromEntries(ZODIAC_ORDER.map(s => [s, 0]))
    if (scoreResult?.distribution) {
      for (const s of ZODIAC_ORDER) {
        raw[s] = scoreResult.distribution[s] ?? 0
      }
    } else if (windowsResult?.rising_windows) {
      for (const w of windowsResult.rising_windows) {
        raw[w.sign] = (raw[w.sign] || 0) + (w.prior_probability || 0)
      }
    }
    return ZODIAC_ORDER.map(sign => ({ sign, probability: raw[sign] ?? 0 })).sort(
      (a, b) => b.probability - a.probability
    )
  }, [scoreResult, windowsResult])

  const currentEntropy = scoreResult?.entropy_bits ?? windowsResult?.entropy_bits ?? null
  const isScanned = Boolean(windowsResult || scoreResult)
  const canSubmitApply =
    Boolean(scoreResult) &&
    (scoreResult!.is_calculations_eligible || (allowUnconfirmedApply && confirmUnconfirmedSave))

  return (
    <div className="space-y-5 text-slate-100">
      {/* Live region for screen readers and AJAX progress updates */}
      <div role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </div>

      {/* Birth Coordinates Card */}
      <Card className="border-violet-500/30 bg-slate-950/75 text-slate-100">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg text-violet-100">
                <Compass className="h-5 w-5 text-violet-400" aria-hidden="true" />
                Bayesian Birth Time Rectifier
              </CardTitle>
              <CardDescription className="text-slate-400">
                Adaptive Expected Information Gain (EIG) interviewer powered by minute-by-minute
                Swiss Ephemeris geometry and null-calibrated Western timing techniques.
              </CardDescription>
            </div>
            {currentEntropy !== null && (
              <Badge
                variant="outline"
                className="border-cyan-400/40 bg-cyan-500/10 font-mono text-xs text-cyan-200"
              >
                Entropy: {currentEntropy.toFixed(2)} bits
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor={`${formId}-bdate`} className="text-slate-200">
                Birth Date <span aria-hidden="true">*</span>
              </Label>
              <Input
                id={`${formId}-bdate`}
                name="birthDate"
                type="date"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                required
                disabled={loading}
                className="mt-1 bg-slate-900/90 border-violet-500/30 text-slate-100"
              />
            </div>

            <div>
              <Label htmlFor={`${formId}-calendar`} className="text-slate-200">
                Calendar System
              </Label>
              <select
                id={`${formId}-calendar`}
                name="calendar"
                value={calendar}
                onChange={e => setCalendar(e.target.value as RectifyCalendar)}
                disabled={loading}
                className="mt-1 flex h-10 w-full rounded-md border border-violet-500/30 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-violet-400"
              >
                <option value="gregorian">Gregorian (Modern)</option>
                <option value="julian">Julian (Pre-1582 / Historical)</option>
              </select>
            </div>

            <div className="sm:col-span-1">
              <LocationSearch
                label="Birth City"
                defaultValue={location.name}
                defaultLatitude={location.lat || undefined}
                defaultLongitude={location.lon || undefined}
                onLocationSelect={(loc: LocationData) => {
                  setLocation({
                    name: loc.displayName,
                    lat: loc.latitude,
                    lon: loc.longitude,
                  })
                }}
                placeholder="Search birth city..."
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void runInitialScan()}
              disabled={loading}
              className="bg-violet-600 hover:bg-violet-500 text-white"
            >
              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              {loading && !isScanned
                ? 'Scanning 24h Ephemeris...'
                : isScanned
                  ? 'Re-Scan 24h Sky Prior'
                  : 'Start Interactive Rectification'}
            </Button>
            {windowsResult && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                {windowsResult.sun_rise_lmt && (
                  <span className="inline-flex items-center gap-1">
                    <Sun className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                    Sunrise ~{windowsResult.sun_rise_lmt} LMT
                  </span>
                )}
                {windowsResult.sun_set_lmt && (
                  <span className="inline-flex items-center gap-1">
                    <Moon className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
                    Sunset ~{windowsResult.sun_set_lmt} LMT
                  </span>
                )}
                {windowsResult.moon_ingress_time && (
                  <Badge className="bg-amber-500/15 text-amber-200 border border-amber-400/30">
                    Moon Ingress {windowsResult.moon_start.sign} → {windowsResult.moon_end.sign} @{' '}
                    {windowsResult.moon_ingress_time} LMT
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </div>
      )}

      {saveMessage && (
        <div
          role="status"
          className="rounded-md border border-emerald-500/40 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-200"
        >
          {saveMessage}
        </div>
      )}

      {isScanned && (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left 7 cols: Adaptive #1 EIG Question + Evidence Builder */}
          <div className="space-y-4 lg:col-span-7">
            <Card className="border-amber-400/30 bg-slate-950/80 text-slate-100">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge className="bg-amber-500/20 text-amber-200 border border-amber-400/40">
                    Next Highest-Gain Question
                    {currentQuestion
                      ? ` (+${currentQuestion.expected_ig_bits.toFixed(2)} bits IG)`
                      : ''}
                  </Badge>
                  {activeQuestions.length > 1 && (
                    <span className="text-xs text-slate-400">
                      Question {activeQuestionIdx + 1} of {activeQuestions.length} queued
                    </span>
                  )}
                </div>
                <CardTitle
                  ref={questionHeadingRef}
                  tabIndex={-1}
                  className="pt-1 text-base text-white outline-none"
                >
                  {currentQuestion
                    ? currentQuestion.question
                    : 'All high-leverage rectification questions answered!'}
                </CardTitle>
                {currentQuestion?.rationale && (
                  <CardDescription className="text-slate-400">
                    {currentQuestion.rationale}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Interactive prompt controls based on active question type */}
                {currentQuestion &&
                  (currentQuestion.type === 'time_clue' ||
                    currentQuestion.type === 'moon_sign' ||
                    currentQuestion.type === 'physical_temperament') &&
                  currentQuestion.options && (
                    <fieldset className="space-y-2">
                      <legend className="text-xs font-medium uppercase tracking-wider text-slate-400">
                        Select the closest match
                      </legend>
                      <div className="grid gap-2">
                        {currentQuestion.options.map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={loading}
                            onClick={() => handleOptionSelect(opt)}
                            className="flex w-full items-center justify-between rounded-lg border border-slate-700/80 bg-slate-900/90 px-3.5 py-3 text-left text-sm transition hover:border-violet-400/70 hover:bg-violet-950/40 focus-visible:outline-2 focus-visible:outline-violet-400 disabled:opacity-50"
                          >
                            <div>
                              <div className="font-medium text-slate-100">{opt.label}</div>
                              {opt.likely_signs && opt.likely_signs.length > 0 && (
                                <div className="mt-0.5 text-xs text-slate-400">
                                  Likely rising: {opt.likely_signs.join(', ')}
                                </div>
                              )}
                            </div>
                            {typeof opt.estimated_probability === 'number' && (
                              <span className="ml-3 shrink-0 font-mono text-xs text-cyan-300">
                                {(opt.estimated_probability * 100).toFixed(0)}% prior
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  )}

                {/* Dated Life Event Submission Form */}
                {(currentQuestion?.type === 'life_event' || !currentQuestion) && (
                  <form onSubmit={handleEventSubmit} className="space-y-3">
                    <fieldset className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3.5">
                      <legend className="px-1 text-xs font-medium uppercase tracking-wider text-amber-200">
                        Add Dated Life Milestone
                      </legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`${formId}-ev-date`} className="text-slate-200">
                            Milestone Date <span aria-hidden="true">*</span>
                          </Label>
                          <Input
                            id={`${formId}-ev-date`}
                            name="eventDate"
                            type="date"
                            value={eventDate}
                            onChange={e => setEventDate(e.target.value)}
                            required
                            disabled={loading}
                            className="mt-1 bg-slate-950 border-slate-700 text-slate-100"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`${formId}-ev-cat`} className="text-slate-200">
                            Domain (House Cusp)
                          </Label>
                          <select
                            id={`${formId}-ev-cat`}
                            name="eventCategory"
                            value={eventCategory}
                            onChange={e => setEventCategory(e.target.value)}
                            disabled={loading}
                            className="mt-1 flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-violet-400"
                          >
                            <option value="career">Career / Publication / Office (MC)</option>
                            <option value="marriage">Marriage / Partnership / Legal (DSC)</option>
                            <option value="relocation">Relocation / Home / Parent (IC)</option>
                            <option value="illness">
                              Illness / Surgery / Vitality Shift (ASC)
                            </option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`${formId}-ev-desc`} className="text-slate-200">
                          Description (Optional)
                        </Label>
                        <Input
                          id={`${formId}-ev-desc`}
                          name="eventDescription"
                          type="text"
                          value={eventDescription}
                          onChange={e => setEventDescription(e.target.value)}
                          placeholder="e.g. Published debut work / Moved to New York"
                          disabled={loading}
                          className="mt-1 bg-slate-950 border-slate-700 text-slate-100"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white"
                      >
                        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                        {loading ? 'Updating Posterior...' : 'Add Event & Update Posterior'}
                      </Button>
                    </fieldset>
                  </form>
                )}

                {/* Switch between remaining EIG questions or enter custom approximate time range */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/90 pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {activeQuestions.map((q, idx) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setActiveQuestionIdx(idx)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          idx === activeQuestionIdx
                            ? 'bg-violet-600 text-white'
                            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        #{q.rank} {q.category.replace('_', ' ')} (+{q.expected_ig_bits.toFixed(2)})
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-expanded={showCustomTimeBox}
                    onClick={() => setShowCustomTimeBox(prev => !prev)}
                    className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200 underline"
                  >
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {showCustomTimeBox ? 'Hide Clock Input' : 'Have a rough clock window?'}
                  </button>
                </div>

                {showCustomTimeBox && (
                  <form
                    onSubmit={handleCustomTimeAdd}
                    className="rounded-md border border-cyan-500/30 bg-cyan-950/20 p-3 space-y-2.5"
                  >
                    <p className="text-xs text-cyan-100">
                      Enter an exact or rough local birth clock range (leave End blank for an
                      approximate single memory time):
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`${formId}-cstart`} className="text-xs text-slate-200">
                          Start Time (HH:MM)
                        </Label>
                        <Input
                          id={`${formId}-cstart`}
                          type="time"
                          value={customStartTime}
                          onChange={e => setCustomStartTime(e.target.value)}
                          required
                          className="mt-1 bg-slate-950 border-slate-700 text-slate-100"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`${formId}-cend`} className="text-xs text-slate-200">
                          End Time (Optional)
                        </Label>
                        <Input
                          id={`${formId}-cend`}
                          type="time"
                          value={customEndTime}
                          onChange={e => setCustomEndTime(e.target.value)}
                          className="mt-1 bg-slate-950 border-slate-700 text-slate-100"
                        />
                      </div>
                    </div>
                    <Button type="submit" size="sm" variant="secondary" disabled={loading}>
                      Apply Clock Constraint
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Evidence Ledger */}
            {evidence.length > 0 && (
              <Card className="border-slate-800 bg-slate-950/75 text-slate-100">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-200">
                      Applied Evidence ({evidence.length})
                    </CardTitle>
                    <button
                      type="button"
                      onClick={() => void scoreWithEvidence([])}
                      disabled={loading}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                      Reset All
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {evidence.map((ev, idx) => (
                    <div
                      key={`${ev.type}-${idx}`}
                      className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs"
                    >
                      <div>
                        <span className="mr-2 font-mono uppercase text-violet-300">{ev.type}</span>
                        <span className="text-slate-200">
                          {ev.description || ev.event_date || ev.moon_sign}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEvidence(idx)}
                        disabled={loading}
                        aria-label={`Remove ${ev.description || ev.type}`}
                        className="ml-2 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right 5 cols: Posterior Distribution & Calculation Gate Summary */}
          <div className="space-y-4 lg:col-span-5">
            <Card className="border-slate-800 bg-slate-950/85 text-slate-100">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base text-white">Posterior Ascendant</CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      {scoreResult
                        ? `MAP Estimate: ${scoreResult.working_sign} ${scoreResult.working_longitude.toFixed(1)}° (${scoreResult.working_time} LMT)`
                        : '24-hour astronomical prior before clues'}
                    </CardDescription>
                  </div>
                  {scoreResult && (
                    <Badge
                      className={
                        scoreResult.is_calculations_eligible
                          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                          : 'bg-amber-500/15 text-amber-200 border border-amber-400/35'
                      }
                    >
                      {scoreResult.is_calculations_eligible ? (
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <HelpCircle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {scoreResult.is_calculations_eligible
                        ? 'Calculation Eligible'
                        : 'Needs Narrowing'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {scoreResult && (
                  <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-slate-800 bg-slate-900/75 p-3 text-xs">
                    <div>
                      <div className="text-slate-400">Top Rising Sign</div>
                      <div className="mt-0.5 text-base font-semibold text-white">
                        {scoreResult.top_sign}{' '}
                        <span className="font-mono text-sm text-cyan-300">
                          {(scoreResult.top_sign_probability * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">80% Credible Window</div>
                      <div className="mt-0.5 font-mono text-sm font-semibold text-white">
                        {scoreResult.credible_window_80.startLocal}–
                        {scoreResult.credible_window_80.endLocal}
                        <span className="ml-1 text-xs text-slate-400">
                          ({scoreResult.window_80_minutes}m)
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5 text-[11px] text-slate-300">
                      {scoreResult.is_calculations_eligible ? (
                        <>
                          <CheckCircle2
                            className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                            aria-hidden="true"
                          />
                          Meets Sacred 7 threshold (&ge; 70% posterior &amp; &le; 180m window).
                        </>
                      ) : (
                        <>
                          <ShieldAlert
                            className="h-3.5 w-3.5 shrink-0 text-amber-300"
                            aria-hidden="true"
                          />
                          Threshold for Sacred 7 calculations: &ge; 70% top sign and &le; 180m
                          window.
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* 12-Sign Posterior Bars */}
                <div className="space-y-2" aria-label="Ascendant sign probability distribution">
                  {displayDistribution.slice(0, 6).map(({ sign, probability }) => {
                    const pct = Math.min(100, Math.max(0, probability * 100))
                    return (
                      <div key={sign} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-200">{sign}</span>
                          <span className="font-mono text-slate-300">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full transition-all duration-300 ${
                              pct >= 70
                                ? 'bg-emerald-400'
                                : pct >= 25
                                  ? 'bg-violet-400'
                                  : 'bg-slate-500'
                            }`}
                            style={{ width: `${Math.max(pct > 0.4 ? 2 : 0, pct)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Apply / Save Action */}
                {scoreResult && (
                  <div className="space-y-3 border-t border-slate-800 pt-3">
                    {!scoreResult.is_calculations_eligible && allowUnconfirmedApply && (
                      <label className="flex items-start gap-2 text-xs text-amber-200">
                        <input
                          type="checkbox"
                          checked={confirmUnconfirmedSave}
                          onChange={e => setConfirmUnconfirmedSave(e.target.checked)}
                          className="mt-0.5 accent-amber-500"
                        />
                        <span>
                          Apply tentative working time ({scoreResult.working_time} LMT) as
                          unconfirmed (
                          <span className="font-mono">isCalculationsEligible = false</span>)
                        </span>
                      </label>
                    )}

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        disabled={!canSubmitApply || loading || saving}
                        onClick={() => void handleApplyOrSave()}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        {saving
                          ? 'Saving Working Time...'
                          : chartId
                            ? `Save Working Time (${scoreResult.working_time})`
                            : mode === 'embed'
                              ? `Use Working Time (${scoreResult.working_time} · ${scoreResult.top_sign})`
                              : `Save to My Profile (${scoreResult.working_time})`}
                      </Button>
                      {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
