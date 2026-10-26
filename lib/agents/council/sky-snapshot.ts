import type { CurrentPlanetPosition } from '@/lib/calculate-transits'
import { SIGN_ORDER, signToLongitude } from './aspect-dialogue-engine'
import { COUNCIL_PLANETS } from './daily-council-types'

export const SKY_PLANETS = COUNCIL_PLANETS
export type SkyPlanet = (typeof SKY_PLANETS)[number]
export type SkySource = 'swiss-ephemeris' | 'vsop87-approximation' | 'unverified'

export interface SkyPosition extends CurrentPlanetPosition {
  source: SkySource
  asOf?: string
}
export type SkyPositions = Record<SkyPlanet, SkyPosition>

export class InvalidSkySnapshotError extends Error {
  override readonly name = 'InvalidSkySnapshotError'
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const normalizeLongitude = (value: number) => ((value % 360) + 360) % 360

export function canonicalPlanet(raw: string): SkyPlanet | undefined {
  return SKY_PLANETS.find(planet => planet.toLowerCase() === raw.trim().toLowerCase())
}

function parsePosition(raw: unknown, options: { source?: SkySource; asOf?: string }): SkyPosition {
  if (!raw || typeof raw !== 'object')
    throw new InvalidSkySnapshotError('Position is not an object')
  const body = raw as Record<string, unknown>
  for (const field of ['longitude', 'exactLongitude', 'degree', 'speed', 'longitudeSpeed']) {
    if (body[field] !== undefined && !finite(body[field])) {
      throw new InvalidSkySnapshotError(`Invalid finite number for ${field}`)
    }
  }
  const sign =
    typeof body.sign === 'string'
      ? SIGN_ORDER.find(
          candidate => candidate.toLowerCase() === (body.sign as string).trim().toLowerCase()
        )
      : undefined
  if (body.sign !== undefined && !sign) throw new InvalidSkySnapshotError('Invalid zodiac sign')
  if (finite(body.degree) && (body.degree < 0 || body.degree >= 30)) {
    throw new InvalidSkySnapshotError('Within-sign degree must be in [0, 30)')
  }
  const rawLongitude = body.longitude ?? body.exactLongitude
  const longitude = finite(rawLongitude)
    ? normalizeLongitude(rawLongitude)
    : sign && finite(body.degree)
      ? signToLongitude(sign, body.degree)
      : undefined
  if (longitude === undefined)
    throw new InvalidSkySnapshotError('No measured longitude or sign/degree')
  const derivedSign = SIGN_ORDER[Math.floor(longitude / 30)]
  const derivedDegree = longitude % 30
  if (finite(body.longitude) && finite(body.exactLongitude)) {
    const difference = Math.abs(
      normalizeLongitude(body.longitude) - normalizeLongitude(body.exactLongitude)
    )
    if (Math.min(difference, 360 - difference) > 0.000001)
      throw new InvalidSkySnapshotError('Longitude fields disagree')
  }
  if (sign && sign !== derivedSign) throw new InvalidSkySnapshotError('Sign and longitude disagree')
  if (finite(rawLongitude) && finite(body.degree)) {
    // The Python API's legacy degree is the integer component; exactLongitude
    // holds its fractional precision. Canonical longitude payloads use decimals.
    const degreeMatches =
      body.longitude === undefined &&
      body.exactLongitude !== undefined &&
      Number.isInteger(body.degree)
        ? Math.floor(derivedDegree) === body.degree
        : Math.abs(body.degree - derivedDegree) <= 0.000001
    if (!degreeMatches) throw new InvalidSkySnapshotError('Degree and longitude disagree')
  }
  const speed = body.speed ?? body.longitudeSpeed
  if (
    finite(body.speed) &&
    finite(body.longitudeSpeed) &&
    Math.abs(body.speed - body.longitudeSpeed) > 0.000001
  )
    throw new InvalidSkySnapshotError('Velocity fields disagree')
  if (options.source && body.source !== undefined && options.source !== body.source) {
    throw new InvalidSkySnapshotError('Ephemeris source cannot be relabelled')
  }
  if (body.retrograde !== undefined && typeof body.retrograde !== 'boolean') {
    throw new InvalidSkySnapshotError('Invalid retrograde flag')
  }
  if (body.isRetrograde !== undefined && typeof body.isRetrograde !== 'boolean') {
    throw new InvalidSkySnapshotError('Invalid retrograde flag')
  }
  if (
    body.retrograde !== undefined &&
    body.isRetrograde !== undefined &&
    body.retrograde !== body.isRetrograde
  )
    throw new InvalidSkySnapshotError('Retrograde flags disagree')
  const retrograde = body.retrograde ?? body.isRetrograde
  if (finite(speed) && retrograde !== undefined && retrograde !== speed < 0)
    throw new InvalidSkySnapshotError('Motion and velocity disagree')
  const rawSource = options.source ?? body.source ?? 'unverified'
  if (!['swiss-ephemeris', 'vsop87-approximation', 'unverified'].includes(String(rawSource))) {
    throw new InvalidSkySnapshotError('Invalid ephemeris source')
  }
  const rawTime = options.asOf ?? body.asOf
  if (
    options.asOf &&
    body.asOf !== undefined &&
    Date.parse(options.asOf) !== Date.parse(String(body.asOf))
  ) {
    throw new InvalidSkySnapshotError('Ephemeris instant cannot be relabelled')
  }
  if (
    rawTime !== undefined &&
    (typeof rawTime !== 'string' || !Number.isFinite(Date.parse(rawTime)))
  ) {
    throw new InvalidSkySnapshotError('Invalid ephemeris instant')
  }
  return {
    sign: derivedSign,
    degree: derivedDegree,
    longitude,
    speed: finite(speed) ? speed : undefined,
    retrograde: finite(speed) ? speed < 0 : Boolean(body.retrograde ?? body.isRetrograde),
    source: rawSource as SkySource,
    asOf: typeof rawTime === 'string' ? new Date(rawTime).toISOString() : undefined,
  }
}

/** One case-insensitive boundary; absent or invalid bodies never become 0° Aries. */
export function normalizeSkyPositions(
  input: unknown,
  options: { source?: SkySource; asOf?: string } = {}
): SkyPositions {
  if (!input || typeof input !== 'object')
    throw new InvalidSkySnapshotError('Sky snapshot is absent')
  const entries: [string, unknown][] = Array.isArray(input)
    ? input.map(body => [String(body?.planet ?? ''), body])
    : Object.entries(input)
  const parsed: Partial<SkyPositions> = {}
  for (const [name, raw] of entries) {
    const planet = canonicalPlanet(name)
    if (!planet) continue
    if (parsed[planet]) throw new InvalidSkySnapshotError(`Duplicate sky body: ${planet}`)
    try {
      parsed[planet] = parsePosition(raw, options)
    } catch (error) {
      throw new InvalidSkySnapshotError(`${planet}: ${(error as Error).message}`)
    }
  }
  const missing = SKY_PLANETS.filter(planet => !parsed[planet])
  if (missing.length)
    throw new InvalidSkySnapshotError(`Incomplete sky snapshot; missing ${missing.join(', ')}`)
  return parsed as SkyPositions
}
