/**
 * Monica's Alchemical Training endpoint.
 *
 * Previously stubbed at 501 with "backend required" — but the training
 * logic was already present in lib/monica/alchemical-trainer.ts and
 * doesn't need a Python backend at all. This route just wires the
 * request shape (mode/numSamples/location/exportFormat) to the
 * existing TS trainer functions.
 *
 * Modes:
 *   - 'standard'    → trainOnAlchemicalValues(numSamples)
 *   - 'hourly'      → todayHourlyAlchemize(location)
 *   - 'retrograde'  → trainWithRetrogrades(numSamples)
 *
 * Export formats:
 *   - 'json'    (default) — full TrainingResult
 *   - 'summary'           — statistics only, samples omitted
 *   - 'csv'               — simple CSV of samples for spreadsheet eyeballing
 */

import { NextResponse } from 'next/server'

import {
  trainOnAlchemicalValues,
  todayHourlyAlchemize,
  trainWithRetrogrades,
  type TrainingResult,
  type AlchemicalSample,
} from '@/lib/monica/alchemical-trainer'

type Mode = 'standard' | 'hourly' | 'retrograde'
type ExportFormat = 'json' | 'summary' | 'csv'

interface TrainRequestBody {
  mode?: Mode
  numSamples?: number
  location?: { latitude: number; longitude: number }
  exportFormat?: ExportFormat
}

const DEFAULT_NUM_SAMPLES = 15
const MAX_NUM_SAMPLES = 1000

const DEFAULT_LOCATION = { latitude: 37.7749, longitude: -122.4194 }

function clampSamples(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_NUM_SAMPLES
  return Math.min(Math.max(1, Math.round(n)), MAX_NUM_SAMPLES)
}

function summarize(result: TrainingResult) {
  // Drop the samples array — for "summary" mode the caller just wants
  // the aggregate stats. Keeps response payloads reasonable when
  // numSamples is high.
  const { samples, ...rest } = result
  return { ...rest, sampleCount: samples.length }
}

function toCsv(samples: AlchemicalSample[]): string {
  if (samples.length === 0) {
    return 'spirit,essence,matter,substance,Heat,Entropy,Reactivity,Energy,planetaryHour\n'
  }
  const header = [
    'spirit',
    'essence',
    'matter',
    'substance',
    'Heat',
    'Entropy',
    'Reactivity',
    'Energy',
    'planetaryHour',
  ].join(',')
  const rows = samples.map(s => {
    const d = s.alchmData
    return [
      d.spirit,
      d.essence,
      d.matter,
      d.substance,
      d.Heat,
      d.Entropy,
      d.Reactivity,
      d.Energy,
      s.planetaryHour?.planet ?? '',
    ].join(',')
  })
  return [header, ...rows].join('\n')
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TrainRequestBody
    const mode: Mode = body.mode ?? 'standard'
    const numSamples = clampSamples(body.numSamples)
    const exportFormat: ExportFormat = body.exportFormat ?? 'json'

    let result: TrainingResult | any

    switch (mode) {
      case 'standard':
        result = await trainOnAlchemicalValues(numSamples)
        break
      case 'retrograde':
        result = await trainWithRetrogrades(numSamples)
        break
      case 'hourly':
        // todayHourlyAlchemize is a different shape — it returns
        // 24 hour buckets, not a TrainingResult. Pass through as-is;
        // exportFormat=csv/summary are no-ops for this mode.
        result = await todayHourlyAlchemize(body.location ?? DEFAULT_LOCATION)
        return NextResponse.json({
          success: true,
          mode,
          location: body.location ?? DEFAULT_LOCATION,
          result,
        })
      default:
        return NextResponse.json(
          {
            success: false,
            error: `Invalid mode "${mode}". Use standard | hourly | retrograde.`,
          },
          { status: 400 }
        )
    }

    if (exportFormat === 'csv') {
      const csv = toCsv((result as TrainingResult).samples ?? [])
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="alchemical-${mode}-${numSamples}.csv"`,
        },
      })
    }

    if (exportFormat === 'summary' && (result as TrainingResult).samples) {
      return NextResponse.json({
        success: true,
        mode,
        numSamples,
        result: summarize(result as TrainingResult),
      })
    }

    return NextResponse.json({
      success: true,
      mode,
      numSamples,
      result,
    })
  } catch (error: any) {
    console.error('Alchemical training error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message ?? 'Unknown error occurred',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') || 'info'

    if (mode === 'info') {
      return NextResponse.json({
        success: true,
        info: {
          description: "Monica's Alchemical Training System",
          version: '2.0',
          status: 'available',
          capabilities: [
            'Standard training with statistical analysis',
            'Hourly alchemical calculations',
            'Retrograde impact analysis',
            'Multiple export formats (JSON, CSV, Summary)',
            'Planetary hour integration',
            'Location-based calculations',
            'Pattern recognition and insights',
          ],
          endpoints: {
            POST: {
              parameters: {
                mode: ['standard', 'hourly', 'retrograde'],
                numSamples: `number (1-${MAX_NUM_SAMPLES}, default ${DEFAULT_NUM_SAMPLES})`,
                location: '{ latitude: number, longitude: number }',
                exportFormat: ['json', 'csv', 'summary'],
              },
            },
            GET: {
              parameters: {
                mode: ['info', 'sample'],
              },
            },
          },
        },
      })
    }

    if (mode === 'sample') {
      // Run a tiny smoke-test training so callers can confirm the
      // pipeline works end-to-end without committing to a long run.
      const result = await trainOnAlchemicalValues(3)
      return NextResponse.json({
        success: true,
        mode: 'sample',
        result: summarize(result),
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: `Invalid mode "${mode}". Use info | sample.`,
      },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}
