import type { DailySkyAspect, DailySkyEvent } from './daily-council-types'

/** Editorial priority: today's verified perfections, lunar/personal rhythm, then slow backdrop. */
export function rankDailyAspects(
  aspects: DailySkyAspect[],
  events: DailySkyEvent[] = []
): DailySkyAspect[] {
  const personal = new Set(['sun', 'moon', 'mercury', 'venus', 'mars'])
  const score = (aspect: DailySkyAspect) => {
    const perfectsToday = events.some(
      event =>
        event.type === 'aspect_exact' &&
        event.bodies.includes(aspect.bodyA) &&
        event.bodies.includes(aspect.bodyB) &&
        event.description.toLowerCase().includes(aspect.aspectName.toLowerCase())
    )
    const lunar = aspect.bodyA === 'moon' || aspect.bodyB === 'moon'
    const personalCount = Number(personal.has(aspect.bodyA)) + Number(personal.has(aspect.bodyB))
    return (
      (perfectsToday ? 20 : 0) +
      (lunar ? 4 : 0) +
      personalCount * 2 +
      (aspect.phase === 'applying' ? 1 : 0) +
      5 / (1 + aspect.orb)
    )
  }
  return [...aspects].sort(
    (a, b) =>
      Number(b.major) - Number(a.major) ||
      score(b) - score(a) ||
      a.orb - b.orb ||
      `${a.bodyA}-${a.bodyB}`.localeCompare(`${b.bodyA}-${b.bodyB}`)
  )
}
