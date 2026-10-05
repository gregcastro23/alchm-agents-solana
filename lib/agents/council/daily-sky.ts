import { getCurrentPlanetaryPositions } from '@/lib/calculate-transits'
import { createHash } from 'node:crypto'
import { getPlanetaryDignity, getSignElement } from '@/lib/astrological-data'
import { swissEphemerisService } from '@/lib/swiss-ephemeris-service'
import { rankDailyAspects } from './aspect-salience'
import { buildLunarState } from './lunar-state'
import { ASPECT_DEFINITIONS, SIGN_ORDER, detectAspect, signedDelta } from './aspect-dialogue-engine'
import {
  normalizeSkyPositions,
  SKY_PLANETS,
  type SkyPositions,
  type SkyPlanet,
} from './sky-snapshot'
import {
  DAILY_COUNCIL_VERSION,
  type CouncilPlanetKey,
  type DailySkyBrief,
  type DailySkyEvidence,
  type DailySkyEvent,
} from './daily-council-types'

const DAY_MS = 86_400_000
const keyFor = (planet: SkyPlanet) => planet.toLowerCase() as CouncilPlanetKey
const normalize = (value: number) => ((value % 360) + 360) % 360
const MODALITIES = ['cardinal', 'fixed', 'mutable'] as const

export function utcCouncilDay(date: Date): { date: string; start: Date; end: Date } {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid council date')
  const label = date.toISOString().slice(0, 10)
  const start = new Date(`${label}T00:00:00.000Z`)
  return { date: label, start, end: new Date(start.getTime() + DAY_MS) }
}

/** Pure, reproducible briefing. Positions must describe the UTC edition's opening instant. */
export function buildDailySkyBrief(params: {
  positions: unknown
  date: Date
  source: DailySkyBrief['source']
  events?: DailySkyEvent[]
  eventScanComplete?: boolean
}): DailySkyBrief {
  const day = utcCouncilDay(params.date)
  const asOf = day.start.toISOString()
  const snapshot = normalizeSkyPositions(params.positions, { source: params.source, asOf })
  for (const planet of SKY_PLANETS) {
    if (snapshot[planet].asOf && snapshot[planet].asOf !== asOf) {
      throw new Error(`${planet} snapshot does not describe the UTC edition opening instant`)
    }
  }
  const positions = {} as DailySkyBrief['positions']
  const evidence: DailySkyEvidence[] = []
  const requiredCoverage: string[] = []
  for (const planet of SKY_PLANETS) {
    const body = snapshot[planet]
    const key = keyFor(planet)
    positions[planet] = {
      ...body,
      source: params.source,
      asOf,
      dignity: getPlanetaryDignity(planet, body.sign),
      element: (getSignElement(body.sign) || 'air').toLowerCase(),
      modality: MODALITIES[SIGN_ORDER.indexOf(body.sign as (typeof SIGN_ORDER)[number]) % 3],
    }
    const id = `placement-${key}`
    requiredCoverage.push(id)
    evidence.push({
      id,
      kind: 'placement',
      bodyKeys: [key],
      label: `${planet} in ${body.sign}; ${positions[planet].dignity} posture; ${body.speed === undefined ? 'motion unmeasured' : body.retrograde ? 'retrograde' : 'direct'}`,
      coverageIds: [
        id,
        ...(['Uranus', 'Neptune', 'Pluto'].includes(planet) ? ['outer-context'] : []),
      ],
    })
  }

  const aspects: DailySkyBrief['aspects'] = []
  for (let i = 0; i < SKY_PLANETS.length; i++) {
    for (let j = i + 1; j < SKY_PLANETS.length; j++) {
      const planetA = SKY_PLANETS[i],
        planetB = SKY_PLANETS[j]
      const a = snapshot[planetA],
        b = snapshot[planetB]
      const hit = detectAspect(a.longitude, b.longitude, a.speed, b.speed)
      if (!hit) continue
      aspects.push({
        bodyA: keyFor(planetA),
        bodyB: keyFor(planetB),
        aspectName: hit.name,
        angle: hit.definition.angle,
        orb: hit.orb,
        phase:
          params.source === 'vsop87-approximation' && hit.phase === 'exact' ? 'unknown' : hit.phase,
        quality: hit.quality,
        major: hit.definition.major,
      })
    }
  }
  aspects.splice(
    0,
    aspects.length,
    ...rankDailyAspects(
      aspects,
      params.source === 'swiss-ephemeris'
        ? (params.events || []).filter(
            event => event.at >= asOf && event.at < day.end.toISOString()
          )
        : []
    )
  )
  aspects.forEach((aspect, index) => {
    const id = `aspect-${aspect.bodyA}-${aspect.bodyB}-${aspect.aspectName.toLowerCase()}`
    evidence.push({
      id,
      kind: 'aspect',
      bodyKeys: [aspect.bodyA, aspect.bodyB],
      coverageIds: [id],
      label: `${aspect.bodyA} ${aspect.aspectName.toLowerCase()} ${aspect.bodyB}; ${aspect.phase === 'unknown' ? 'applying/separating unmeasured' : aspect.phase}; ${params.source === 'swiss-ephemeris' ? aspect.orb.toFixed(2) : aspect.orb.toFixed(1)}° orb${params.source === 'vsop87-approximation' ? ' (approximate)' : ''}`,
    })
    if (index < 3 && aspect.major) requiredCoverage.push(id)
  })

  const lunar = buildLunarState(snapshot.Sun.longitude, snapshot.Moon.longitude, snapshot.Moon.sign)
  evidence.push({
    id: 'lunar-state',
    kind: 'lunar',
    bodyKeys: ['sun', 'moon'],
    coverageIds: ['lunar-state'],
    label: `${lunar.phase}; Moon in ${lunar.sign}; ${lunar.elongation < 180 ? 'waxing' : 'waning'} lunar light`,
  })
  const retrogrades = SKY_PLANETS.filter(
    planet => snapshot[planet].speed !== undefined && snapshot[planet].retrograde
  )
  const unknownMotion = SKY_PLANETS.filter(planet => snapshot[planet].speed === undefined)
  evidence.push({
    id: 'motion-state',
    kind: 'motion',
    bodyKeys: SKY_PLANETS.map(keyFor),
    coverageIds: ['motion-state'],
    label: `${params.source === 'swiss-ephemeris' ? 'Measured' : 'Estimated'} retrogrades: ${retrogrades.join(', ') || 'none'}; ${unknownMotion.length ? `unmeasured motion: ${unknownMotion.join(', ')}` : `all ten ${params.source === 'swiss-ephemeris' ? 'measured' : 'estimated'} daily velocities available`}`,
  })
  const elementCounts: Record<string, number> = {}
  for (const body of Object.values(positions))
    elementCounts[body.element] = (elementCounts[body.element] || 0) + 1
  evidence.push({
    id: 'sky-overview',
    kind: 'overview',
    bodyKeys: SKY_PLANETS.map(keyFor),
    coverageIds: ['sky-overview', 'outer-context'],
    label: `Element distribution: ${Object.entries(elementCounts)
      .map(([element, count]) => `${element} ${count}`)
      .join(
        ', '
      )}. Outer-planet backdrop: Uranus in ${positions.Uranus.sign}, Neptune in ${positions.Neptune.sign}, Pluto in ${positions.Pluto.sign}.`,
  })
  requiredCoverage.push('lunar-state', 'motion-state', 'sky-overview', 'outer-context')

  const events =
    params.source === 'swiss-ephemeris'
      ? (params.events || []).filter(event => event.at >= asOf && event.at < day.end.toISOString())
      : []
  for (const event of events) {
    evidence.push({
      id: event.evidenceId,
      kind: 'event',
      label: `${event.description} at ${event.at} UTC`,
      bodyKeys: event.bodies,
      coverageIds: [event.id],
    })
    requiredCoverage.push(event.id)
  }
  const warnings: string[] = []
  if (params.source === 'vsop87-approximation')
    warnings.push(
      'Positions are a labelled local Keplerian approximation. Exact event times and station claims are withheld.'
    )
  else if (!params.eventScanComplete)
    warnings.push(
      'Daily event timing has not been calculated; this briefing makes no claim that the day has no events.'
    )
  if (unknownMotion.length)
    warnings.push(
      `Daily velocity unavailable for ${unknownMotion.join(', ')}; applying/separating and station timing are unknown for those bodies.`
    )
  const snapshotHash = createHash('sha256')
    .update(
      JSON.stringify({
        asOf,
        source: params.source,
        positions,
        events,
        eventScanComplete: Boolean(params.eventScanComplete),
        warnings,
      })
    )
    .digest('hex')
    .slice(0, 16)
  return {
    id: `${DAILY_COUNCIL_VERSION}:${day.date}:UTC:${snapshotHash}`,
    date: day.date,
    timeZone: 'UTC',
    startAt: asOf,
    endAt: day.end.toISOString(),
    asOf,
    source: params.source,
    quality: params.source === 'swiss-ephemeris' ? 'verified' : 'approximate',
    positions,
    aspects,
    lunar,
    events,
    evidence,
    requiredCoverage: [...new Set(requiredCoverage)],
    warnings,
  }
}

export interface DailySkySample {
  at: Date
  positions: unknown
}
type SampleProvider = (date: Date) => Promise<unknown>
type Candidate = {
  type: DailySkyEvent['type']
  bodies: SkyPlanet[]
  start: Date
  end: Date
  target: number
  initialValue: number
  value: (positions: SkyPositions) => number
  description: (positions: SkyPositions) => string
}

function crossedTargets(
  start: number,
  end: number,
  targets: number[],
  excludeEnd: boolean
): number[] {
  const low = Math.min(start, end),
    high = Math.max(start, end)
  const hits: number[] = []
  for (const target of targets) {
    for (
      let cycle = Math.floor((low - target) / 360);
      cycle <= Math.ceil((high - target) / 360);
      cycle++
    ) {
      const value = target + cycle * 360
      // The final sample closes the search bracket but belongs to tomorrow.
      // Decide membership from measured geometry before rounding its clock label.
      if (excludeEnd && Math.abs(value - end) < 1e-10) continue
      if (value >= low && value <= high && start !== end) hits.push(value)
    }
  }
  return [...new Set(hits)]
}

/** Event times are refined from actual verified samples, never from average motion. */
export async function searchDailySkyEvents(params: {
  date: Date
  samples: DailySkySample[]
  getPositions: SampleProvider
}): Promise<DailySkyEvent[]> {
  const day = utcCouncilDay(params.date)
  const samples = params.samples
    .map(sample => ({
      at: sample.at,
      positions: normalizeSkyPositions(sample.positions, { asOf: sample.at.toISOString() }),
    }))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
  if (
    samples.length < 2 ||
    samples[0].at.getTime() !== day.start.getTime() ||
    samples.at(-1)!.at.getTime() !== day.end.getTime()
  )
    throw new Error('Event search requires the complete UTC day')
  if (
    samples.some(sample =>
      SKY_PLANETS.some(planet => sample.positions[planet].source !== 'swiss-ephemeris')
    )
  )
    throw new Error('Event timing requires verified Swiss Ephemeris samples')
  const candidates: Candidate[] = []
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i],
      b = samples[i + 1]
    const endsAtNextDay = b.at.getTime() === day.end.getTime()
    if (b.at.getTime() - a.at.getTime() > 3_600_000)
      throw new Error('Event samples must be no more than one hour apart')
    for (const planet of SKY_PLANETS) {
      const start = a.positions[planet].longitude
      const end = start + signedDelta(start, b.positions[planet].longitude)
      for (const target of crossedTargets(
        start,
        end,
        Array.from({ length: 12 }, (_, index) => index * 30),
        endsAtNextDay
      )) {
        const direction = Math.sign(end - start)
        const sign = SIGN_ORDER[Math.floor(normalize(target + direction * 0.00001) / 30)]
        candidates.push({
          type: 'sign_ingress',
          bodies: [planet],
          start: a.at,
          end: b.at,
          target,
          initialValue: start,
          value: sky => sky[planet].longitude,
          description: () => `${planet} enters ${sign}${direction < 0 ? ' while retrograde' : ''}`,
        })
      }
      const speedA = a.positions[planet].speed,
        speedB = b.positions[planet].speed
      if (
        planet !== 'Sun' &&
        planet !== 'Moon' &&
        speedA !== undefined &&
        speedB !== undefined &&
        (speedA * speedB < 0 || (speedA === 0 && speedB !== 0))
      ) {
        candidates.push({
          type: 'station',
          bodies: [planet],
          start: a.at,
          end: b.at,
          target: 0,
          initialValue: speedA,
          value: sky => sky[planet].speed!,
          description: () => `${planet} stations ${speedB < 0 ? 'retrograde' : 'direct'}`,
        })
      }
    }
    const phase = (sky: SkyPositions) => normalize(sky.Moon.longitude - sky.Sun.longitude)
    const phaseA = phase(a.positions),
      phaseB = phaseA + signedDelta(phaseA, phase(b.positions))
    for (const target of crossedTargets(phaseA, phaseB, [0, 90, 180, 270], endsAtNextDay)) {
      candidates.push({
        type: 'lunar_phase',
        bodies: ['Sun', 'Moon'],
        start: a.at,
        end: b.at,
        target,
        initialValue: phaseA,
        value: phase,
        description: () =>
          `${['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'][normalize(target) / 90]} perfects`,
      })
    }
    for (let j = 0; j < SKY_PLANETS.length; j++) {
      for (let k = j + 1; k < SKY_PLANETS.length; k++) {
        const planetA = SKY_PLANETS[j],
          planetB = SKY_PLANETS[k]
        if (planetA === 'Sun' && planetB === 'Moon') continue // Lunar phase already covers this pair.
        const relative = (sky: SkyPositions) =>
          normalize(sky[planetB].longitude - sky[planetA].longitude)
        const relativeA = relative(a.positions),
          relativeB = relativeA + signedDelta(relativeA, relative(b.positions))
        for (const aspect of ASPECT_DEFINITIONS.filter(definition => definition.major)) {
          const targets =
            aspect.angle === 0 || aspect.angle === 180
              ? [aspect.angle]
              : [aspect.angle, 360 - aspect.angle]
          for (const target of crossedTargets(relativeA, relativeB, targets, endsAtNextDay)) {
            candidates.push({
              type: 'aspect_exact',
              bodies: [planetA, planetB],
              start: a.at,
              end: b.at,
              target,
              initialValue: relativeA,
              value: relative,
              description: () => `${planetA} ${aspect.name.toLowerCase()} ${planetB} perfects`,
            })
          }
        }
      }
    }
  }
  const events: DailySkyEvent[] = []
  for (const candidate of candidates) {
    let low = candidate.start.getTime(),
      high = candidate.end.getTime()
    const unwrap = (value: number) =>
      candidate.type === 'station'
        ? value
        : candidate.initialValue + signedDelta(normalize(candidate.initialValue), value)
    const initialResidual = candidate.initialValue - candidate.target
    let sky: SkyPositions | undefined
    // Resolve to a one-minute bracket; all midpoint values come from the same ephemeris.
    while (high - low > 60_000) {
      const mid = Math.floor((low + high) / 2)
      sky = normalizeSkyPositions(await params.getPositions(new Date(mid)), {
        asOf: new Date(mid).toISOString(),
      })
      if (SKY_PLANETS.some(planet => sky![planet].source !== 'swiss-ephemeris'))
        throw new Error('Refinement sample has unverified provenance')
      const measuredValue = candidate.value(sky)
      if (!Number.isFinite(measuredValue))
        throw new Error('Refinement sample is missing measured event motion')
      const residual = unwrap(measuredValue) - candidate.target
      if (Math.sign(residual) === Math.sign(initialResidual)) low = mid
      else high = mid
    }
    // Nearest-minute rounding plus the sub-minute bracket keeps the error below
    // a minute. Preserve a crossing just before midnight in its measured day.
    const at = Math.max(
      day.start.getTime(),
      Math.min(day.end.getTime() - 60_000, Math.round((low + high) / 120_000) * 60_000)
    )
    const bodies = candidate.bodies.map(keyFor)
    const description = `${candidate.description(sky || samples[0].positions)} (time resolved within one minute)`
    const iso = new Date(at).toISOString()
    const id = `event-${candidate.type}-${bodies.join('-')}-${description.split(' ')[1]}-${iso}`
    if (
      events.some(
        event =>
          event.type === candidate.type &&
          event.description === description &&
          event.bodies.join() === bodies.join() &&
          Math.abs(Date.parse(event.at) - at) < 120_000
      )
    )
      continue
    events.push({ id, type: candidate.type, at: iso, bodies, description, evidenceId: id })
  }
  return events.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
}

const briefCache = new Map<string, Promise<DailySkyBrief>>()

async function waitForBrief(
  pending: Promise<DailySkyBrief>,
  deadline: number
): Promise<DailySkyBrief> {
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new Error('Daily ephemeris time budget exhausted')
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Daily ephemeris time budget exhausted')),
          remaining
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

/** Bounded server loader. Cheap reads omit timing scans; scheduled generation opts in. */
export async function loadDailySkyBrief(
  date: Date = new Date(),
  options: { includeEvents?: boolean; deadlineMs?: number } = {}
): Promise<DailySkyBrief> {
  const day = utcCouncilDay(date)
  const computationDeadline = Math.min(
    Date.now() + (options.includeEvents ? 80_000 : 2_500),
    // Event scans belong to the cron's lease and must stop within its budget.
    options.includeEvents
      ? (options.deadlineMs ?? Number.POSITIVE_INFINITY)
      : Number.POSITIVE_INFINITY
  )
  const deadline = Math.min(options.deadlineMs ?? Number.POSITIVE_INFINITY, computationDeadline)
  if (deadline <= Date.now()) throw new Error('Daily ephemeris time budget exhausted')
  const cacheKey = `${day.date}:${Boolean(options.includeEvents)}`
  const cached = briefCache.get(cacheKey)
  // Each reader keeps its own budget while sharing the underlying computation.
  if (cached) return waitForBrief(cached, deadline)
  const pending = (async () => {
    const samplesCache = new Map<string, SkyPositions>()
    const verifiedPositions = async (at: Date): Promise<SkyPositions> => {
      const key = at.toISOString()
      const cachedSample = samplesCache.get(key)
      if (cachedSample) return cachedSample
      // Public opening reads share a fixed bounded lifetime. Event scans also
      // retain the initiating cron's budget so they cannot outlive its lease.
      const remaining = computationDeadline - Date.now()
      if (remaining <= 0) throw new Error('Daily ephemeris time budget exhausted')
      const controller = new AbortController()
      let timeout: ReturnType<typeof setTimeout> | undefined
      const timedOut = new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => {
            controller.abort()
            reject(new Error('Swiss Ephemeris sample timed out'))
          },
          Math.min(2_000, remaining)
        )
      })
      try {
        const result = await Promise.race([
          swissEphemerisService.getAllPlanetaryPositions(at, 0, 0, { signal: controller.signal }),
          timedOut,
        ])
        const parsed = normalizeSkyPositions(result, { asOf: key })
        if (SKY_PLANETS.some(planet => parsed[planet].source !== 'swiss-ephemeris'))
          throw new Error('Unverified ephemeris source')
        samplesCache.set(key, parsed)
        return parsed
      } finally {
        if (timeout) clearTimeout(timeout)
      }
    }
    let positions: SkyPositions
    try {
      positions = await verifiedPositions(day.start)
    } catch {
      return buildDailySkyBrief({
        positions: getCurrentPlanetaryPositions(day.start, { requireComplete: true }),
        date: day.start,
        source: 'vsop87-approximation',
      })
    }
    let events: DailySkyEvent[] = [],
      eventScanComplete = false
    if (options.includeEvents) {
      try {
        const samples: DailySkySample[] = []
        for (let hour = 0; hour <= 24; hour++) {
          const at = new Date(day.start.getTime() + hour * 3_600_000)
          samples.push({ at, positions: await verifiedPositions(at) })
        }
        events = await searchDailySkyEvents({
          date: day.start,
          samples,
          getPositions: verifiedPositions,
        })
        eventScanComplete = true
      } catch {
        /* Keep the verified opening snapshot, with explicit unknown event timing. */
      }
    }
    return buildDailySkyBrief({
      positions,
      date: day.start,
      source: 'swiss-ephemeris',
      events,
      eventScanComplete,
    })
  })()
  briefCache.set(cacheKey, pending)
  // Approximate/read-only briefs retry after five minutes so an outage can recover.
  pending
    .then(brief => {
      if (
        brief.quality === 'approximate' ||
        !options.includeEvents ||
        brief.warnings.some(warning => warning.startsWith('Daily event timing'))
      ) {
        const expiry = setTimeout(() => briefCache.delete(cacheKey), 300_000)
        expiry.unref?.()
      }
    })
    .catch(() => briefCache.delete(cacheKey))
  if (briefCache.size > 8) briefCache.delete(briefCache.keys().next().value!)
  return waitForBrief(pending, deadline)
}
