import 'server-only'
import { dailyEditionStore, type DailyEditionStore } from './daily-edition-store'
import { loadDailySkyBrief, utcCouncilDay } from './daily-sky'
import { withPreviousSkyChanges } from './daily-sky-changes'
import { createBriefingEdition, generateDailyEdition } from './daily-episode'
import { parseDailyCouncilEdition } from './daily-edition-schema'
import type {
  DailyCouncilEdition,
  DailyCouncilResponse,
  DailySkyBrief,
} from './daily-council-types'

interface CouncilServiceDependencies {
  store: DailyEditionStore
  loadBrief: (
    date: Date,
    options: { includeEvents: boolean; deadlineMs?: number }
  ) => Promise<DailySkyBrief>
  brief: (sky: DailySkyBrief) => DailyCouncilEdition
  generate: (sky: DailySkyBrief, options: { deadlineMs?: number }) => Promise<DailyCouncilEdition>
  now: () => Date
}

/** Public reading has no path to model generation or persistence writes. */
export function createDailyCouncilService(deps: CouncilServiceDependencies) {
  const previousDay = (day: string) =>
    new Date(Date.parse(`${day}T00:00:00.000Z`) - 1).toISOString().slice(0, 10)
  const briefings = new Map<string, DailyCouncilEdition>()
  let pending: { day: string; promise: Promise<DailyCouncilEdition> } | undefined
  let cached: { day: string; expiresAt: number; edition: DailyCouncilEdition } | undefined

  function remember(edition: DailyCouncilEdition) {
    briefings.set(edition.id, edition)
    // Retain a few immutable snapshots so a reader's open page can ask about
    // exactly what it displayed, even after a newer source becomes available.
    while (briefings.size > 8) briefings.delete(briefings.keys().next().value!)
    return edition
  }

  async function briefing(date: Date, previous?: DailyCouncilEdition | null) {
    const day = utcCouncilDay(date).date
    if (cached?.day === day && cached.expiresAt > deps.now().getTime()) return cached.edition
    if (pending?.day === day) return pending.promise
    const promise = (async () => {
      const loaded = await deps.loadBrief(date, { includeEvents: false })
      const sky = previous ? withPreviousSkyChanges(loaded, previous.brief) : loaded
      const edition = parseDailyCouncilEdition(deps.brief(sky))
      if (!edition || edition.date !== day) throw new Error('Invalid daily briefing')
      cached = { day, expiresAt: deps.now().getTime() + 300_000, edition: remember(edition) }
      return edition
    })()
    pending = { day, promise }
    try {
      return await promise
    } finally {
      if (pending?.promise === promise) pending = undefined
    }
  }

  async function read(date = deps.now()): Promise<DailyCouncilResponse> {
    const day = utcCouncilDay(date).date
    try {
      const published = await deps.store.read(day)
      if (published) return { edition: published, status: 'published' }
    } catch {
      /* A missing store must not take the public sky briefing offline. */
    }
    let previous: DailyCouncilEdition | null = null
    try {
      previous = await deps.store.latest(previousDay(day))
    } catch {
      /* Optional context. */
    }
    try {
      return {
        edition: await briefing(date, previous),
        ...(previous && previous.generation !== 'grounded_briefing'
          ? { previousEdition: previous }
          : {}),
        status: 'briefing',
        message: 'A factual sky briefing is available while the hosted edition is being prepared.',
      }
    } catch {
      if (previous)
        return {
          edition: previous,
          status: 'stale',
          message: `Showing the ${previous.date} edition. Today’s sky data is temporarily unavailable.`,
        }
      return {
        edition: null,
        status: 'unavailable',
        message: 'The daily sky briefing is temporarily unavailable. Please try again shortly.',
      }
    }
  }

  async function find(editionId: string): Promise<DailyCouncilEdition | null> {
    try {
      const published = await deps.store.find(editionId)
      if (published) return published
    } catch {
      /* A current deterministic briefing can still support a question. */
    }
    const existing = briefings.get(editionId)
    if (existing) return existing
    // Another server instance may reconstruct the current briefing, but only
    // accept it if its immutable snapshot ID is identical to the reader's.
    try {
      const current = (await read(deps.now())).edition
      return current?.id === editionId ? current : null
    } catch {
      return null
    }
  }

  async function publish(options: { date?: Date; deadlineMs?: number } = {}) {
    const date = options.date ?? deps.now()
    const day = utcCouncilDay(date).date
    const existing = await deps.store.read(day)
    if (existing) return { status: 'already_published' as const, editionId: existing.id }
    // Failure to acquire a durable lease fails closed before any model call.
    const token = await deps.store.claim(day, deps.now())
    if (!token) return { status: 'not_claimed' as const }
    try {
      if (options.deadlineMs && deps.now().getTime() >= options.deadlineMs)
        throw new Error('Daily council deadline reached')
      const loaded = await deps.loadBrief(date, {
        includeEvents: true,
        deadlineMs: options.deadlineMs,
      })
      if (options.deadlineMs && deps.now().getTime() >= options.deadlineMs)
        throw new Error('Daily council deadline reached')
      const previous = await deps.store.latest(previousDay(day))
      const sky = previous ? withPreviousSkyChanges(loaded, previous.brief) : loaded
      const edition = parseDailyCouncilEdition(
        await deps.generate(sky, { deadlineMs: options.deadlineMs })
      )
      if (!edition || edition.date !== day)
        throw new Error('Daily council failed coverage validation')
      if (edition.generation === 'grounded_briefing') {
        // Keep a provider/editorial failure eligible for the next bounded cron
        // retry. Readers already have a no-cost briefing; don't freeze it as
        // the day's hosted publication after a transient outage.
        await deps.store.release(day, token)
        return { status: 'briefing_only' as const }
      }
      if (options.deadlineMs && deps.now().getTime() >= options.deadlineMs)
        throw new Error('Daily council deadline reached')
      const saved = await deps.store.publish(day, token, edition, deps.now())
      if (!saved) throw new Error('Daily council publication lease expired')
      return { status: 'published' as const, editionId: edition.id, generation: edition.generation }
    } catch (error) {
      await deps.store.release(day, token).catch(() => undefined)
      throw error
    }
  }

  return { read, find, publish }
}

export const dailyCouncilService = createDailyCouncilService({
  store: dailyEditionStore,
  loadBrief: loadDailySkyBrief,
  brief: createBriefingEdition,
  generate: generateDailyEdition,
  now: () => new Date(),
})
