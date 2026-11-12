import { spawn } from 'node:child_process'
import path from 'node:path'
import { backend } from '@/lib/backend'
import {
  normalizeEvidenceList,
  type RectifyCalendar,
  type RectifyEvidenceItem,
  type RectifyScoreResult,
  type RectifyWindowsResult,
} from '@/lib/rectification/types'

export class RectificationUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RectificationUnavailableError'
  }
}

export interface RectifyWindowsPayload {
  year: number
  month: number
  day: number
  latitude: number
  longitude: number
  calendar?: RectifyCalendar
}

export interface RectifyScorePayload extends RectifyWindowsPayload {
  evidence: RectifyEvidenceItem[]
  step_minutes?: number
}

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3'
const RECTIFY_CLI_SCRIPT = path.resolve(process.cwd(), 'backend/rectification_service.py')
const CLI_TIMEOUT_MS = 20_000

async function runPythonRectifyCli<T>(cmd: 'windows' | 'score', payload: unknown): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [RECTIFY_CLI_SCRIPT, cmd, '--stdin'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        child.kill('SIGKILL')
        reject(
          new RectificationUnavailableError(
            `Rectification Python CLI timed out after ${CLI_TIMEOUT_MS}ms`
          )
        )
      }
    }, CLI_TIMEOUT_MS)

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', err => {
      clearTimeout(timer)
      if (!settled) {
        settled = true
        reject(
          new RectificationUnavailableError(
            `Failed to invoke Python Swiss Ephemeris CLI (${err.message})`
          )
        )
      }
    })

    child.on('close', code => {
      clearTimeout(timer)
      if (settled) return
      settled = true

      if (code !== 0) {
        reject(
          new RectificationUnavailableError(
            `Rectification Python CLI exited with ${code}: ${stderr.trim() || stdout.trim()}`
          )
        )
        return
      }

      try {
        resolve(JSON.parse(stdout) as T)
      } catch (parseErr: any) {
        reject(
          new RectificationUnavailableError(
            `Invalid JSON from rectification CLI: ${parseErr?.message || String(parseErr)}`
          )
        )
      }
    })

    child.stdin.write(JSON.stringify(payload))
    child.stdin.end()
  })
}

export async function runRectifyWindows(
  payload: RectifyWindowsPayload
): Promise<RectifyWindowsResult> {
  const body = {
    year: payload.year,
    month: payload.month,
    day: payload.day,
    latitude: payload.latitude,
    longitude: payload.longitude,
    calendar: payload.calendar || 'gregorian',
  }

  try {
    if (backend?.rectify?.windows) {
      const res = await backend.rectify.windows(body)
      if (res && Array.isArray(res.rising_windows)) {
        return res as RectifyWindowsResult
      }
    }
  } catch {
    // FastAPI service offline — fall back transparently to standalone Swiss Ephemeris CLI
  }

  return await runPythonRectifyCli<RectifyWindowsResult>('windows', body)
}

export async function runRectifyScore(payload: RectifyScorePayload): Promise<RectifyScoreResult> {
  const stepMinutes = Math.min(10, Math.max(1, Math.round(payload.step_minutes ?? 5)))
  const normalizedEvidence = normalizeEvidenceList(payload.evidence || [])

  const body = {
    year: payload.year,
    month: payload.month,
    day: payload.day,
    latitude: payload.latitude,
    longitude: payload.longitude,
    calendar: payload.calendar || 'gregorian',
    evidence: normalizedEvidence,
    step_minutes: stepMinutes,
  }

  try {
    if (backend?.rectify?.score) {
      const res = await backend.rectify.score(body)
      if (res && res.distribution && typeof res.top_sign === 'string') {
        return res as RectifyScoreResult
      }
    }
  } catch {
    // FastAPI service offline — fall back transparently to standalone Swiss Ephemeris CLI
  }

  return await runPythonRectifyCli<RectifyScoreResult>('score', body)
}
