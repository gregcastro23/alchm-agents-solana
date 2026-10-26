import { createHash } from 'node:crypto'
import {
  COUNCIL_PLANETS,
  type CouncilPlanetKey,
  type DailySkyAspect,
  type DailySkyBrief,
} from './daily-council-types'

const DAY_MS = 86_400_000
const keyFor = (planet: string) => planet.toLowerCase() as CouncilPlanetKey
const planetFor = (key: string) => COUNCIL_PLANETS.find(planet => keyFor(planet) === key) || key

const direction = (speed: number) =>
  speed < 0 ? 'backward' : speed > 0 ? 'forward' : 'zero in the supplied record'
const aspectKey = (aspect: DailySkyAspect) =>
  `${[aspect.bodyA, aspect.bodyB].sort().join('-')}-${aspect.aspectName.toLowerCase()}`
// The briefing owns editorial salience ordering; comparisons must use that
// ranking rather than silently substituting a second orb-only policy.
const rankedMajor = (brief: DailySkyBrief) =>
  brief.aspects.filter(aspect => aspect.major).slice(0, 3)

/** No ephemeris calls: compares only compatible opening snapshots one UTC day apart. */
export function withPreviousSkyChanges(
  current: DailySkyBrief,
  previous?: DailySkyBrief | null
): DailySkyBrief {
  if (
    !previous ||
    previous.source !== current.source ||
    previous.quality !== current.quality ||
    previous.timeZone !== 'UTC' ||
    current.timeZone !== 'UTC'
  )
    return current
  const currentStart = Date.parse(`${current.date}T00:00:00.000Z`)
  const previousStart = Date.parse(`${previous.date}T00:00:00.000Z`)
  if (
    !Number.isFinite(currentStart) ||
    !Number.isFinite(previousStart) ||
    currentStart - previousStart !== DAY_MS ||
    Date.parse(current.asOf) !== currentStart ||
    Date.parse(previous.asOf) !== previousStart
  )
    return current

  const items: string[] = []
  const bodies = new Set<CouncilPlanetKey>()
  for (const planet of COUNCIL_PLANETS) {
    const before = previous.positions[planet],
      now = current.positions[planet]
    if (before.sign !== now.sign) {
      items.push(
        `${planet}'s sign differs between the opening snapshots: ${before.sign} previously, ${now.sign} now. This comparison does not establish the time of the transition.`
      )
      bodies.add(keyFor(planet))
    }
    if (
      before.speed !== undefined &&
      now.speed !== undefined &&
      Number.isFinite(before.speed) &&
      Number.isFinite(now.speed) &&
      Math.sign(before.speed) !== Math.sign(now.speed)
    ) {
      items.push(
        `${planet}'s supplied apparent movement differs: ${direction(before.speed)} previously, ${direction(now.speed)} now. A precise turning time is not inferred from these two records.`
      )
      bodies.add(keyFor(planet))
    }
  }
  if (previous.lunar.phase !== current.lunar.phase) {
    items.push(
      `The lunar phase label differs between the opening snapshots: ${previous.lunar.phase.toLowerCase()} previously, ${current.lunar.phase.toLowerCase()} now. These phase categories do not establish an exact lunation time.`
    )
    bodies.add('sun')
    bodies.add('moon')
  }
  const priorRanked = new Set(rankedMajor(previous).map(aspectKey))
  for (const aspect of rankedMajor(current)) {
    if (priorRanked.has(aspectKey(aspect))) continue
    items.push(
      `New among the strongest ranked major relationships: ${planetFor(aspect.bodyA)} ${aspect.aspectName.toLowerCase()} ${planetFor(aspect.bodyB)}. This is a ranking difference between snapshots, not proof the aspect began today.`
    )
    bodies.add(aspect.bodyA)
    bodies.add(aspect.bodyB)
  }
  if (!items.length) {
    items.push(
      'No significant changes in signs, supplied motion directions, lunar phase label or the strongest ranked major relationships are identified between these opening snapshots. Degrees can still move within those categories.'
    )
  }

  const changes = { previousDate: previous.date, items }
  // Reapplying the enrichment with the same previous brief is idempotent.
  const baseId = current.id.replace(/:changes:[a-f0-9]{16}$/, '')
  const hash = createHash('sha256')
    .update(JSON.stringify({ currentId: baseId, previousId: previous.id, changes }))
    .digest('hex')
    .slice(0, 16)
  return {
    ...current,
    id: `${baseId}:changes:${hash}`,
    changes,
    evidence: [
      ...current.evidence.filter(item => item.id !== 'sky-changes'),
      {
        id: 'sky-changes',
        kind: 'overview',
        bodyKeys: [...bodies],
        coverageIds: ['sky-changes'],
        label: `Compared with the UTC opening snapshot on ${previous.date}: ${items.join(' ')}`,
      },
    ],
    requiredCoverage: [...new Set([...current.requiredCoverage, 'sky-changes'])],
  }
}
