/**
 * The live sky as the rating system needs it: the ten classical bodies' signs, plus the
 * thermodynamics and Monica derived from them.
 *
 * Nothing here defines a thermodynamic quantity. Positions are turned into the ESMS totals
 * and element counts by `deriveLiveEphemeris` — the very function the Resonance Surge anchors
 * were calibrated against (`test/agents/surge-calibration.spec.ts`) — which in turn calls
 * `calculateThermodynamics`; Kalchm and Monica come from `calculateKalchm` / `calculateMonica`
 * (`lib/thermodynamics/kalchm.ts`). This module only gets positions into that shape.
 *
 * ## Where positions come from, and what is never done
 *
 * 1. The planetary-agents backend (`/planetary/current`), but only when its payload is stamped
 *    `source: "swiss-ephemeris"`. Until 2026-10 that endpoint served a circular-orbit model with
 *    no stamp; an unstamped payload is therefore refused rather than trusted.
 * 2. The local Keplerian calculator, which stamps itself `vsop87-approximation`. That label is
 *    carried into the result, so a caller can see which sky it is looking at.
 *
 * A partial chart is never used: dropping bodies collapses the ESMS axes toward each other and
 * sends Monica through its singularity (see `_require_complete_chart` in backend/main.py), so
 * fewer than ten usable bodies is a `SkyUnavailableError`, not a smaller sky.
 */
import { calculateAllPlanets } from '@/lib/enhanced-astronomical-calculator'
import type { Ephemeris } from '@/lib/spacetime/generated/types'
import { deriveLiveEphemeris } from '@/lib/spacetime/derive-live-ephemeris'
import { signOfLongitude } from '@/lib/staking/elements'
import { calculateKalchm, calculateMonica, type Thermodynamics } from '@/lib/thermodynamics/kalchm'
import type { SkyBodies } from './seals-surge'

export const SKY_BODIES = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
] as const

export type SkyBodyName = (typeof SKY_BODIES)[number]
export type SkySource = 'swiss-ephemeris' | 'vsop87-approximation'

/** Geocentric ecliptic longitude of date (degrees) and apparent direction of motion. */
export interface SkyPosition {
  longitude: number
  retrograde: boolean
}
export type SkyLongitudes = Record<SkyBodyName, SkyPosition>

export interface LiveSky {
  source: SkySource
  /** The instant the positions are for, ISO-8601. */
  at: string
  thermodynamics: Thermodynamics
  kalchm: number
  /** `null` means ABSENT, never a placeholder number. */
  monica: number | null
  /** Body → sign, for the elemental harmony of a natal chart against this sky. */
  bodies: SkyBodies
}

export class SkyUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkyUnavailableError'
  }
}

const OBLIQUITY = (23.43928 * Math.PI) / 180

/**
 * An `Ephemeris` row for a body at an ecliptic longitude (latitude 0), the inverse of
 * `raDecToEclipticLongitude` at dec = 0: tan λ = tan α · cos ε.
 *
 * Right ascension is emitted in HOURS (0 ≤ ra < 24). `raDecToEclipticLongitude` reads any value
 * with |ra| ≤ 24 as hours and anything larger as degrees, so a right ascension in degrees below
 * 24° (a body near 0° of RA) would be silently multiplied by 15.
 */
export function eclipticLongitudeToEphemerisRow(
  body: SkyBodyName,
  longitudeDeg: number,
  retrograde: boolean
): Ephemeris {
  const lambda = (longitudeDeg * Math.PI) / 180
  const alpha = Math.atan2(Math.sin(lambda), Math.cos(lambda) * Math.cos(OBLIQUITY))
  const raDegrees = ((((alpha * 180) / Math.PI) % 360) + 360) % 360
  const raHours = Math.min(raDegrees / 15, 23.999999999)
  return { body: { tag: body }, ra: raHours, dec: 0, retrograde } as unknown as Ephemeris
}

function assertComplete(longitudes: Partial<Record<SkyBodyName, SkyPosition>>): void {
  const missing = SKY_BODIES.filter(body => {
    const lon = longitudes[body]?.longitude
    return typeof lon !== 'number' || !Number.isFinite(lon)
  })
  if (missing.length > 0) {
    throw new SkyUnavailableError(
      `The sky is incomplete (${missing.join(', ')}); a partial chart is never rated`
    )
  }
}

/** Pure: positions in, the quantities the rating system reads out. */
export function deriveLiveSky(longitudes: SkyLongitudes, source: SkySource, at: Date): LiveSky {
  assertComplete(longitudes)
  const rows = SKY_BODIES.map(body =>
    eclipticLongitudeToEphemerisRow(body, longitudes[body].longitude, longitudes[body].retrograde)
  )
  const derived = deriveLiveEphemeris(rows)
  const q = derived.alchmQuantities
  const thermodynamics: Thermodynamics = {
    heat: q.Heat,
    entropy: q.Entropy,
    reactivity: q.Reactivity,
    gregsEnergy: q.Energy,
  }
  const kalchm = calculateKalchm({
    spirit: q.spirit,
    essence: q.essence,
    matter: q.matter,
    substance: q.substance,
  })
  const monica = calculateMonica({
    energy: thermodynamics.gregsEnergy,
    reactivity: thermodynamics.reactivity,
    kalchm,
  })

  const bodies = {} as SkyBodies
  for (const body of SKY_BODIES)
    bodies[body] = { sign: signOfLongitude(longitudes[body].longitude) }
  return { source, at: at.toISOString(), thermodynamics, kalchm, monica, bodies }
}

/**
 * Parse `GET /planetary/current`. Returns `null` unless the payload is stamped
 * `swiss-ephemeris` and carries a finite longitude for all ten bodies.
 */
export function longitudesFromBackend(raw: unknown): SkyLongitudes | null {
  if (!raw || typeof raw !== 'object') return null
  const { source, planetary_positions: positions } = raw as {
    source?: unknown
    planetary_positions?: Record<string, { exactLongitude?: unknown; isRetrograde?: unknown }>
  }
  if (source !== 'swiss-ephemeris' || !positions || typeof positions !== 'object') return null
  const out: Partial<SkyLongitudes> = {}
  for (const body of SKY_BODIES) {
    const longitude = positions[body]?.exactLongitude
    if (typeof longitude !== 'number' || !Number.isFinite(longitude)) return null
    out[body] = { longitude, retrograde: positions[body]?.isRetrograde === true }
  }
  return out as SkyLongitudes
}

/** The local Keplerian approximation. Throws when it withholds any of the ten bodies. */
export function longitudesFromLocalCalculator(at: Date): SkyLongitudes {
  const chart = calculateAllPlanets({
    year: at.getUTCFullYear(),
    month: at.getUTCMonth() + 1,
    day: at.getUTCDate(),
    hour: at.getUTCHours(),
    minute: at.getUTCMinutes(),
    second: at.getUTCSeconds(),
    latitude: 0,
    longitude: 0,
  })
  const out: Partial<SkyLongitudes> = {}
  for (const body of SKY_BODIES) {
    const position = chart.planets[body]
    if (!position || !Number.isFinite(position.longitude)) continue
    out[body] = {
      longitude: position.longitude,
      retrograde: Boolean(position.retrograde),
    }
  }
  assertComplete(out)
  return out as SkyLongitudes
}

export interface ResolveLiveSkyOptions {
  now?: Date
  /** Fetch the backend's `/planetary/current` payload. Defaults to the shared backend client. */
  fetchBackend?: () => Promise<unknown>
  /** Give up on the backend after this many milliseconds (default 4000). */
  timeoutMs?: number
}

async function defaultFetchBackend(): Promise<unknown> {
  const { backend } = await import('@/lib/backend')
  return backend.planetary.current()
}

/** Race a promise against a timer that is always cleared. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`sky backend timed out after ${ms} ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * The live sky for `now`: the Swiss-stamped backend positions when available, else the
 * labelled local approximation. Throws `SkyUnavailableError` when neither yields all ten bodies.
 */
export async function resolveLiveSky(options: ResolveLiveSkyOptions = {}): Promise<LiveSky> {
  const now = options.now ?? new Date()
  const fetchBackend = options.fetchBackend ?? defaultFetchBackend
  try {
    const raw = await withTimeout(fetchBackend(), options.timeoutMs ?? 4000)
    const longitudes = longitudesFromBackend(raw)
    if (longitudes) return deriveLiveSky(longitudes, 'swiss-ephemeris', now)
  } catch {
    // The backend is best-effort here: fall through to the labelled local sky.
  }
  try {
    return deriveLiveSky(longitudesFromLocalCalculator(now), 'vsop87-approximation', now)
  } catch (error) {
    if (error instanceof SkyUnavailableError) throw error
    throw new SkyUnavailableError(
      `No sky could be computed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
