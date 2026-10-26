import type { DailyCouncilResponse, DailySkyBrief } from './daily-council-types'

/** Reveal elapsed, precomputed events without rewriting the immutable opening conversation. */
export function dailyCouncilUpdates(
  brief: DailySkyBrief,
  now: Date
): DailyCouncilResponse['updates'] {
  if (brief.quality !== 'verified' || brief.source !== 'swiss-ephemeris') return undefined
  const asOf = now.toISOString()
  if (asOf < brief.asOf) return undefined
  return {
    asOf,
    events: brief.events
      .filter(event => event.at > brief.asOf && event.at < brief.endAt && event.at <= asOf)
      .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)),
  }
}
