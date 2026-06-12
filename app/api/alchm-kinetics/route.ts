import { NextResponse } from 'next/server'
import { sampleHourlyAlchm, validateTimingPatterns } from '@/lib/alchemical-kinetics-sampler'
import {
  computeElementalVelocity,
  computeMetricVelocity,
  computeElementalMomentum,
  computePower,
  computeForce,
  computeInertia,
  validateKineticResults,
  validateCalculusRelationships,
  type ElementKey,
  type ElementVector,
  type ForceVector,
} from '@/lib/alchemical-kinetics'

// Simple moving average used for optional smoothing (Mercury triad default)
function movingAverage(values: number[], window: number): number[] {
  const w = Math.max(1, Math.floor(window))
  const out: number[] = new Array(values.length).fill(0)
  let run = 0
  for (let i = 0; i < values.length; i++) {
    run += values[i]
    if (i >= w) run -= values[i - w]
    const denom = i < w - 1 ? i + 1 : w
    out[i] = run / denom
  }
  return out
}

function parseBool(v: string | null, defaultValue: boolean): boolean {
  if (v === null) return defaultValue
  const val = v.toLowerCase()
  if (val === 'true') return true
  if (val === 'false') return false
  return defaultValue
}

function qualitativeBalance(avg: number, maxAvg: number): string {
  if (maxAvg <= 0) return 'neutral'
  const ratio = avg / maxAvg
  if (ratio >= 0.75) return 'dominant'
  if (ratio >= 0.5) return 'elevated'
  return 'subtle'
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get('lat') || '37.7749')
    const lon = parseFloat(searchParams.get('lon') || '-122.4194')
    const dateStr = searchParams.get('date') // YYYY-MM-DD
    const windowStr = searchParams.get('window')
    const hoursStr = searchParams.get('hours') // Number of hours to sample
    const includeElemental = parseBool(searchParams.get('includeElemental'), true)
    const includePlanetary = parseBool(searchParams.get('includePlanetary'), true)
    const validateTraditional = parseBool(searchParams.get('validateTraditional'), false)
    const includeForce = parseBool(searchParams.get('includeForce'), false)

    const smoothingWindow = Number.isFinite(parseInt(windowStr || ''))
      ? Math.max(1, parseInt(windowStr!))
      : 3

    // Default to 3 hours for current moment requests (current + next 2), or 24 for full day
    const hoursToSample = Number.isFinite(parseInt(hoursStr || ''))
      ? Math.max(1, Math.min(24, parseInt(hoursStr!)))
      : 3 // Changed default from 24 to 3

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: 'Invalid lat/lon' }, { status: 400 })
    }

    let targetDate: Date
    if (dateStr) {
      const [y, m, d] = dateStr.split('-').map(v => parseInt(v, 10))
      if (!y || !m || !d)
        return NextResponse.json(
          { error: 'Invalid date format, expected YYYY-MM-DD' },
          { status: 400 }
        )
      // Use zero-based month indexing for Date ctor (January = 0)
      targetDate = new Date(y, m - 1, d)
    } else {
      targetDate = new Date()
    }

    // Start from current hour when requesting limited samples, 0 for full day
    const startHour = hoursToSample < 24 ? new Date().getHours() : 0

    // Phase 2 sampler: gather hourly data with planetary context
    const samples = await sampleHourlyAlchm({ latitude: lat, longitude: lon }, targetDate, {
      includePlanetaryHours: includePlanetary,
      validateTiming: validateTraditional,
      hoursToSample,
      startHour,
    })

    if (!samples || samples.length === 0) {
      return NextResponse.json({ error: 'No samples generated' }, { status: 500 })
    }

    // Optionally apply smoothing to the base time-series prior to derivatives
    const smoothed = samples.map((s, idx, arr) => {
      // Apply Mercury triad smoothing for traditional calibration
      if (idx === 0 || idx === arr.length - 1) {
        return s // Keep first and last samples unchanged
      }

      const prev = arr[idx - 1]
      const next = arr[idx + 1]

      // Mercury triad smoothing: weighted average with neighboring samples
      const smoothingFactor = 0.2 // 20% influence from neighbors

      const smoothedTotals = {
        Fire:
          s.totals.Fire * (1 - smoothingFactor) +
          ((prev.totals.Fire + next.totals.Fire) * smoothingFactor) / 2,
        Water:
          s.totals.Water * (1 - smoothingFactor) +
          ((prev.totals.Water + next.totals.Water) * smoothingFactor) / 2,
        Earth:
          s.totals.Earth * (1 - smoothingFactor) +
          ((prev.totals.Earth + next.totals.Earth) * smoothingFactor) / 2,
        Air:
          s.totals.Air * (1 - smoothingFactor) +
          ((prev.totals.Air + next.totals.Air) * smoothingFactor) / 2,
      }

      return {
        ...s,
        totals: smoothedTotals,
      }
    })
    // Mercury triad smoothing applied for traditional calibration

    // Build inputs for kinetics
    const elementalInput = smoothed.map(s => ({
      t: s.t,
      totals: s.totals,
      planetaryHour: s.planetaryHour,
    }))
    const metricInput = samples.map(s => ({
      t: s.t,
      Heat: s.Heat,
      Entropy: s.Entropy,
      Reactivity: s.Reactivity,
      Energy: s.Energy,
    }))
    const powerInput = samples.map(s => ({
      t: s.t,
      Energy: s.Energy,
      planetaryHour: s.planetaryHour,
    }))

    // Compute velocities
    const elementalVelocity = includeElemental ? computeElementalVelocity(elementalInput) : []
    const metricVelocity = computeMetricVelocity(metricInput)

    // Compute power (Potentia)
    const power = computePower(powerInput, { window: smoothingWindow })

    // Compute inertia and momentum
    let elementalMomentum: Array<{
      t: Date
      p: ElementVector
      magnitude: number
      momentumType: 'building' | 'sustained' | 'dissipating'
    }> = []
    let elementalForce: Array<{
      t: Date
      f: ForceVector
      magnitude: number
      forceType: 'accelerating' | 'decelerating' | 'balanced'
    }> = []
    if (includeElemental) {
      const momentumInput = elementalVelocity.map((vRec, i) => {
        const s = samples[i]
        const inertia = computeInertia({
          matter: s.matter,
          earth: s.earth,
          substance: s.substance,
          planetaryHour: s.planetaryHour,
        })
        return { t: vRec.t, v: vRec.v, inertia, substance: s.substance }
      })
      elementalMomentum = computeElementalMomentum(momentumInput)

      // Compute force if requested
      if (includeForce) {
        elementalForce = computeForce(
          elementalMomentum.map((p, i) => ({
            t: p.t,
            p: p.p,
            inertia: momentumInput[i].inertia,
            planetaryHour: samples[i].planetaryHour,
          })),
          elementalVelocity.map(v => ({
            t: v.t,
            v: v.v,
            planetaryHour: samples.find(s => s.t.getTime() === v.t.getTime())?.planetaryHour,
          }))
        )
      }
    }

    // Traditional validation
    let traditionalValidation: any = undefined
    if (validateTraditional) {
      const kineticsForValidation: any = {
        elementalVelocity: elementalVelocity.map((r, i) => ({
          ...r,
          planetaryHour: samples[i]?.planetaryHour,
        })),
        metricVelocity,
        elementalMomentum,
        elementalForce,
        power: power.map((p, i) => ({ ...p, planetaryHour: samples[i]?.planetaryHour })),
      }
      const validationCore = validateKineticResults(kineticsForValidation, {
        velocityMax: 1000,
        momentumMax: 5000,
        powerMax: 1000,
        forceMax: 10000,
      })

      // Elemental balance qualitative assessment
      const totalsAvg: ElementVector = samples.reduce(
        (acc, s) => ({
          Fire: acc.Fire + s.totals.Fire,
          Water: acc.Water + s.totals.Water,
          Air: acc.Air + s.totals.Air,
          Earth: acc.Earth + s.totals.Earth,
        }),
        { Fire: 0, Water: 0, Air: 0, Earth: 0 }
      )
      const n = samples.length
      const avg: ElementVector = {
        Fire: totalsAvg.Fire / n,
        Water: totalsAvg.Water / n,
        Air: totalsAvg.Air / n,
        Earth: totalsAvg.Earth / n,
      }
      const maxAvg = Math.max(avg.Fire, avg.Water, avg.Air, avg.Earth)

      traditionalValidation = {
        isValid: validationCore.isValid,
        warnings: validationCore.warnings,
        assessment: validationCore.traditionalAssessment,
        elementalBalance: {
          Fire: qualitativeBalance(avg.Fire, maxAvg),
          Water: qualitativeBalance(avg.Water, maxAvg),
          Air: qualitativeBalance(avg.Air, maxAvg),
          Earth: qualitativeBalance(avg.Earth, maxAvg),
        },
      }

      // Calculus relationship validation
      try {
        if (
          samples.length >= 2 &&
          elementalVelocity.length >= 2 &&
          elementalMomentum.length >= 2 &&
          power.length >= 2
        ) {
          const calculusSamples = samples
            .slice(
              0,
              Math.min(
                samples.length,
                elementalVelocity.length,
                elementalMomentum.length,
                power.length
              )
            )
            .map((sample, i) => {
              // Calculate inertia from sample data if not provided
              const inertia =
                (sample as any).inertia ||
                Math.max(
                  1,
                  1 +
                    (sample.matter || 0) +
                    (sample.totals?.Earth || 0) +
                    (sample.substance || 0) / 2
                )

              return {
                t: new Date(sample.t),
                elements: sample.totals,
                velocity: elementalVelocity[i]?.v || { Fire: 0, Water: 0, Air: 0, Earth: 0 },
                momentum: elementalMomentum[i]?.p || { Fire: 0, Water: 0, Air: 0, Earth: 0 },
                inertia,
                energy: sample.Energy,
                power: power[i]?.power || 0,
                force: elementalForce[i]?.f,
              }
            })

          const calculusValidation = validateCalculusRelationships(calculusSamples)
          traditionalValidation.calculusValidation = calculusValidation
        }
      } catch (error) {
        console.error('Calculus validation error:', error)
        traditionalValidation.calculusValidation = {
          isValid: false,
          errors: [
            `Calculus validation failed: ${error instanceof Error ? error.message : String(error)}`,
          ],
          warnings: [],
        }
      }
    }

    // Timing summary
    const planetaryHours = samples.map(s => s.planetaryHour)
    const freq: Record<string, number> = {}
    planetaryHours.forEach(ph => {
      const key = ph || 'unknown'
      freq[key] = (freq[key] || 0) + 1
    })
    const dominantPlanets = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([p]) => p)

    const seasonalInfluence = samples[0]?.seasonalPhase || 'Unknown'

    // Optional timing validation (planetary & seasonal)
    const timingValidation = validateTraditional ? validateTimingPatterns(samples) : undefined

    return NextResponse.json({
      elementalVelocity,
      metricVelocity,
      elementalMomentum,
      elementalForce: includeForce ? elementalForce : undefined,
      power,
      traditionalValidation,
      timing: {
        planetaryHours,
        dominantPlanets,
        seasonalInfluence,
        timingValidation,
      },
    })
  } catch (error) {
    console.error('alchm-kinetics API error:', error)
    return NextResponse.json({ error: 'Failed to compute alchemical kinetics' }, { status: 500 })
  }
}

// POST: batch/moment-to-moment style kinetics over a time range
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const lat = parseFloat(String(body.lat ?? '37.7749'))
    const lon = parseFloat(String(body.lon ?? '-122.4194'))
    const startTime = body.startTime as string | undefined
    const endTime = body.endTime as string | undefined
    const intervalMinutes = Number.isFinite(Number(body.intervalMinutes))
      ? Math.max(1, Number(body.intervalMinutes))
      : 60
    const includeElemental = body.includeElemental !== false
    const includePlanetary = body.includePlanetary !== false
    const validateTraditional = body.validateTraditional === true
    const includeForce = body.includeForce === true

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'startTime and endTime are required (ISO strings)' },
        { status: 400 }
      )
    }

    const start = new Date(startTime)
    const end = new Date(endTime)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'Invalid start/end times' }, { status: 400 })
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: 'Invalid lat/lon' }, { status: 400 })
    }

    // Build timeline at the requested interval (minutes)
    const timeline: Date[] = []
    const maxPoints = 24 * 7 * 60 // up to 7 days worth of minutes as a guard
    let cursor = new Date(start)
    let guard = 0
    while (cursor <= end && guard < maxPoints) {
      timeline.push(new Date(cursor))
      cursor = new Date(cursor.getTime() + intervalMinutes * 60 * 1000)
      guard++
    }

    // Sample each timestamp (hourly granularity via sampler)
    const samples = [] as Awaited<ReturnType<typeof sampleHourlyAlchm>>
    for (const t of timeline) {
      const day = new Date(t.getFullYear(), t.getMonth(), t.getDate())
      const oneSample = await sampleHourlyAlchm({ latitude: lat, longitude: lon }, day, {
        includePlanetaryHours: includePlanetary,
        hoursToSample: 1,
        startHour: t.getHours(),
      })
      if (oneSample && oneSample.length > 0) samples.push(oneSample[0])
    }

    if (samples.length === 0) {
      return NextResponse.json(
        { error: 'No samples generated for the requested range' },
        { status: 500 }
      )
    }

    // Build inputs for kinetics
    const elementalInput = samples.map(s => ({
      t: s.t,
      totals: s.totals,
      planetaryHour: s.planetaryHour,
    }))
    const metricInput = samples.map(s => ({
      t: s.t,
      Heat: s.Heat,
      Entropy: s.Entropy,
      Reactivity: s.Reactivity,
      Energy: s.Energy,
    }))
    const powerInput = samples.map(s => ({
      t: s.t,
      Energy: s.Energy,
      planetaryHour: s.planetaryHour,
    }))

    const elementalVelocity = includeElemental ? computeElementalVelocity(elementalInput) : []
    const metricVelocity = computeMetricVelocity(metricInput)
    const power = computePower(powerInput, {
      window: Math.max(1, parseInt(String(body.window ?? '1')) || 1),
    })

    let elementalMomentum: Array<{
      t: Date
      p: ElementVector
      magnitude: number
      momentumType: 'building' | 'sustained' | 'dissipating'
    }> = []
    let elementalForce: Array<{
      t: Date
      f: ForceVector
      magnitude: number
      forceType: 'accelerating' | 'decelerating' | 'balanced'
    }> = []
    if (includeElemental) {
      const momentumInput = elementalVelocity.map((vRec, i) => {
        const s = samples[i]
        const inertia = computeInertia({
          matter: s.matter,
          earth: s.earth,
          substance: s.substance,
          planetaryHour: s.planetaryHour,
        })
        return { t: vRec.t, v: vRec.v, inertia, substance: s.substance }
      })
      elementalMomentum = computeElementalMomentum(momentumInput)

      // Compute force if requested
      if (includeForce) {
        elementalForce = computeForce(
          elementalMomentum.map((p, i) => ({
            t: p.t,
            p: p.p,
            inertia: momentumInput[i].inertia,
            planetaryHour: samples[i].planetaryHour,
          })),
          elementalVelocity.map(v => ({
            t: v.t,
            v: v.v,
            planetaryHour: samples.find(s => s.t.getTime() === v.t.getTime())?.planetaryHour,
          }))
        )
      }
    }

    let traditionalValidation: any = undefined
    if (validateTraditional) {
      const kineticsForValidation: any = {
        elementalVelocity: elementalVelocity.map((r, i) => ({
          ...r,
          planetaryHour: samples[i]?.planetaryHour,
        })),
        metricVelocity,
        elementalMomentum,
        power: power.map((p, i) => ({ ...p, planetaryHour: samples[i]?.planetaryHour })),
      }
      traditionalValidation = validateKineticResults(kineticsForValidation, {
        velocityMax: 2000,
        momentumMax: 8000,
        powerMax: 2000,
        forceMax: 10000,
      })
    }

    return NextResponse.json({
      range: { start: start.toISOString(), end: end.toISOString(), intervalMinutes },
      count: samples.length,
      timestamps: samples.map(s => s.t),
      elementalVelocity,
      metricVelocity,
      elementalMomentum,
      elementalForce: includeForce ? elementalForce : undefined,
      power,
      traditionalValidation,
    })
  } catch (error) {
    console.error('alchm-kinetics POST error:', error)
    return NextResponse.json({ error: 'Failed to compute batch kinetics' }, { status: 500 })
  }
}

// Helper function to flatten alchemical data for CSV export
function flattenAlchemyInfo(alchmData: any): Record<string, any> {
  const flattened: Record<string, any> = {}

  // Core alchemical values
  if (alchmData['Alchemy Effects']) {
    flattened['Total_Spirit'] = alchmData['Alchemy Effects']['Total Spirit'] || 0
    flattened['Total_Essence'] = alchmData['Alchemy Effects']['Total Essence'] || 0
    flattened['Total_Matter'] = alchmData['Alchemy Effects']['Total Matter'] || 0
    flattened['Total_Substance'] = alchmData['Alchemy Effects']['Total Substance'] || 0
    flattened['A_Number'] = alchmData['Alchemy Effects']['A #'] || 0
    flattened['Total_Day_Essence'] = alchmData['Alchemy Effects']['Total Day Essence'] || 0
    flattened['Total_Night_Essence'] = alchmData['Alchemy Effects']['Total Night Essence'] || 0
  }

  // Thermodynamic metrics
  flattened['Heat'] = alchmData['Heat'] || 0
  flattened['Entropy'] = alchmData['Entropy'] || 0
  flattened['Reactivity'] = alchmData['Reactivity'] || 0
  flattened['Energy'] = alchmData['Energy'] || 0

  // Elemental totals
  if (alchmData['Total Effect Value']) {
    flattened['Fire_Total'] = alchmData['Total Effect Value']['Fire'] || 0
    flattened['Water_Total'] = alchmData['Total Effect Value']['Water'] || 0
    flattened['Air_Total'] = alchmData['Total Effect Value']['Air'] || 0
    flattened['Earth_Total'] = alchmData['Total Effect Value']['Earth'] || 0
  }

  // Force values (if available)
  if (alchmData['force']) {
    flattened['Fire_Force'] = alchmData['force']['Fire'] || 0
    flattened['Water_Force'] = alchmData['force']['Water'] || 0
    flattened['Air_Force'] = alchmData['force']['Air'] || 0
    flattened['Earth_Force'] = alchmData['force']['Earth'] || 0
    // Calculate magnitude if force values exist
    const f = alchmData['force']
    flattened['Force_Magnitude'] = Math.sqrt(
      (f.Fire || 0) ** 2 + (f.Water || 0) ** 2 + (f.Air || 0) ** 2 + (f.Earth || 0) ** 2
    )
  }

  // Chart info
  flattened['Sun_Sign'] = alchmData['Sun Sign'] || ''
  flattened['Dominant_Element'] = alchmData['Dominant Element'] || ''
  flattened['Chart_Ruler'] = alchmData['Chart Ruler'] || ''
  flattened['Total_Chart_Absolute_Effect'] = alchmData['Total Chart Absolute Effect'] || 0

  // Modality info
  flattened['Cardinal_Count'] = alchmData['# Cardinal'] || 0
  flattened['Fixed_Count'] = alchmData['# Fixed'] || 0
  flattened['Mutable_Count'] = alchmData['# Mutable'] || 0
  flattened['Dominant_Modality'] = alchmData['Dominant Modality'] || ''

  return flattened
}

// Helper function to generate birth info range (time series)
function generateBirthInfoRange(
  startTime: string,
  endTime: string,
  intervalMinutes: number,
  location: { latitude: number; longitude: number }
) {
  const start = new Date(startTime)
  const end = new Date(endTime)
  const interval = intervalMinutes * 60 * 1000 // convert to milliseconds

  const birthInfoList = []
  let current = new Date(start)

  while (current <= end) {
    birthInfoList.push({
      year: current.getFullYear(),
      month: current.getMonth() + 1, // 1-based for alchemizer
      day: current.getDate(),
      hour: current.getHours(),
      minute: current.getMinutes(),
      latitude: location.latitude,
      longitude: location.longitude,
      ISO: current.toISOString(),
    })

    current = new Date(current.getTime() + interval)
  }

  return birthInfoList
}

// PUT endpoint for CSV batch export (mimicking /alchmize-batch)
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const lat = parseFloat(String(body.lat ?? '37.7749'))
    const lon = parseFloat(String(body.lon ?? '-122.4194'))
    const startTime = body['start-time'] as string
    const endTime = body['end-time'] as string
    const timeInterval = Number(body['time-interval']) || 60 // minutes
    const exportFormat = body.exportFormat || 'csv'

    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'start-time and end-time are required' }, { status: 400 })
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: 'Invalid lat/lon' }, { status: 400 })
    }

    console.log('alchm-kinetics >>> REQUEST -> /alchmize-batch equivalent')

    // Generate birth info range
    const birthInfoList = generateBirthInfoRange(startTime, endTime, timeInterval, {
      latitude: lat,
      longitude: lon,
    })
    const alchmInfoList = []

    // Process each birth info through our sampler
    for (const birthInfo of birthInfoList) {
      try {
        const date = new Date(birthInfo.year, birthInfo.month - 1, birthInfo.day)
        const samples = await sampleHourlyAlchm({ latitude: lat, longitude: lon }, date, {
          hoursToSample: 1,
          startHour: birthInfo.hour,
          includePlanetaryHours: true,
        })

        if (samples && samples.length > 0) {
          const sample = samples[0]
          // Convert sample to alchemical format for flattening
          const alchmInfo = {
            birth_info: birthInfo,
            planetaryHour: sample.planetaryHour,
            alchemy_info: {
              'Alchemy Effects': {
                'Total Spirit': sample.spirit,
                'Total Essence': sample.essence,
                'Total Matter': sample.matter,
                'Total Substance': sample.substance,
                'A #': sample.spirit + sample.essence + sample.matter + sample.substance,
                'Total Day Essence': sample.essence * 0.6, // Approximate day/night split
                'Total Night Essence': sample.essence * 0.4,
              },
              Heat: sample.Heat,
              Entropy: sample.Entropy,
              Reactivity: sample.Reactivity,
              Energy: sample.Energy,
              'Total Effect Value': sample.totals,
              'Sun Sign': 'Unknown', // Would need full chart calculation
              'Dominant Element':
                sample.totals.Fire >
                Math.max(sample.totals.Water, sample.totals.Air, sample.totals.Earth)
                  ? 'Fire'
                  : sample.totals.Water > Math.max(sample.totals.Air, sample.totals.Earth)
                    ? 'Water'
                    : sample.totals.Air > sample.totals.Earth
                      ? 'Air'
                      : 'Earth',
              'Chart Ruler': 'Unknown',
              'Total Chart Absolute Effect':
                sample.totals.Fire + sample.totals.Water + sample.totals.Air + sample.totals.Earth,
              '# Cardinal': 0, // Would need full chart
              '# Fixed': 0,
              '# Mutable': 0,
              'Dominant Modality': 'Unknown',
            },
          }
          alchmInfoList.push(alchmInfo)
        }
      } catch (error) {
        console.error(`Error processing birth info for ${birthInfo.ISO}:`, error)
        // Add empty entry to maintain timeline
        alchmInfoList.push({
          birth_info: birthInfo,
          alchemy_info: {
            'Alchemy Effects': {
              'Total Spirit': 0,
              'Total Essence': 0,
              'Total Matter': 0,
              'Total Substance': 0,
              'A #': 0,
            },
            Heat: 0,
            Entropy: 0,
            Reactivity: 0,
            Energy: 0,
            'Total Effect Value': { Fire: 0, Water: 0, Air: 0, Earth: 0 },
            'Dominant Element': 'Unknown',
          },
        })
      }
    }

    // Convert to flat rows for CSV
    const rows = alchmInfoList.map((info: any) => {
      const flatAlchemy = flattenAlchemyInfo(info.alchemy_info)
      return {
        Timestamp: info.birth_info?.ISO || '',
        Planetary_Hour: (info as any).planetaryHour || '',
        ...flatAlchemy,
      }
    })

    if (exportFormat === 'json') {
      return NextResponse.json({
        success: true,
        data: rows,
        count: rows.length,
        range: { startTime, endTime, intervalMinutes: timeInterval },
      })
    }

    // Generate CSV
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No data generated for the specified range' },
        { status: 500 }
      )
    }

    const headers = Object.keys(rows[0])
    const csvContent = [
      headers.join(','), // Header row
      ...rows.map(row =>
        headers
          .map(header => {
            const value = (row as any)[header]
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`
            }
            return value
          })
          .join(',')
      ),
    ].join('\n')

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="alchemy_kinetics_batch.csv"',
      },
    })
  } catch (error) {
    console.error('alchm-kinetics PUT error:', error)
    return NextResponse.json({ error: 'Failed to generate batch CSV' }, { status: 500 })
  }
}
