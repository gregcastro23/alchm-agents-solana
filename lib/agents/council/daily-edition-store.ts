import 'server-only'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/db'
import { DAILY_COUNCIL_VERSION, type DailyCouncilEdition } from './daily-council-types'
import { parseDailyCouncilEdition } from './daily-edition-schema'

const LEASE_MS = 6 * 60_000
const MAX_ATTEMPTS = 3

export function dailyEditionKey(day: string): string {
  return `${DAILY_COUNCIL_VERSION}:${day}`
}

export interface DailyEditionStore {
  read(day: string): Promise<DailyCouncilEdition | null>
  latest(day: string): Promise<DailyCouncilEdition | null>
  find(editionId: string): Promise<DailyCouncilEdition | null>
  claim(day: string, now: Date): Promise<string | null>
  publish(day: string, token: string, edition: DailyCouncilEdition, now: Date): Promise<boolean>
  release(day: string, token: string): Promise<void>
}

interface StoredEdition {
  id: string
  day: string
  promptVersion: string
  status: string
  editionId: string | null
  payload: unknown
}

function parseStoredEdition(row: StoredEdition | null): DailyCouncilEdition | null {
  if (!row || row.status !== 'published') return null
  const edition = parseDailyCouncilEdition(row.payload)
  if (
    !edition ||
    row.id !== dailyEditionKey(row.day) ||
    row.promptVersion !== DAILY_COUNCIL_VERSION ||
    edition.promptVersion !== row.promptVersion ||
    edition.date !== row.day ||
    edition.id !== row.editionId ||
    edition.id !== `${DAILY_COUNCIL_VERSION}:${row.day}:${edition.brief.id}`
  )
    return null
  return edition
}

export const dailyEditionStore: DailyEditionStore = {
  async read(day) {
    const row = await prisma.council_daily_editions.findUnique({
      where: { id: dailyEditionKey(day) },
    })
    const edition = parseStoredEdition(row)
    return edition?.date === day ? edition : null
  },
  async latest(day) {
    const row = await prisma.council_daily_editions.findFirst({
      where: { status: 'published', day: { lte: day }, promptVersion: DAILY_COUNCIL_VERSION },
      orderBy: { day: 'desc' },
    })
    const edition = parseStoredEdition(row)
    return edition && edition.date <= day ? edition : null
  },
  async find(editionId) {
    const row = await prisma.council_daily_editions.findUnique({ where: { editionId } })
    const edition = parseStoredEdition(row)
    return edition?.id === editionId ? edition : null
  },
  async claim(day, now) {
    const id = dailyEditionKey(day)
    const token = randomUUID()
    const leaseUntil = new Date(now.getTime() + LEASE_MS)
    try {
      await prisma.council_daily_editions.create({
        data: {
          id,
          day,
          promptVersion: DAILY_COUNCIL_VERSION,
          leaseToken: token,
          leaseUntil,
          attempts: 1,
        },
      })
      return token
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error
    }
    // Atomic compare-and-set: a published edition or another live lease cannot be claimed.
    const result = await prisma.council_daily_editions.updateMany({
      where: {
        id,
        status: { not: 'published' },
        attempts: { lt: MAX_ATTEMPTS },
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      },
      data: { status: 'generating', leaseToken: token, leaseUntil, attempts: { increment: 1 } },
    })
    return result.count === 1 ? token : null
  },
  async publish(day, token, edition, now) {
    const validated = parseDailyCouncilEdition(edition)
    if (
      !validated ||
      validated.date !== day ||
      validated.promptVersion !== DAILY_COUNCIL_VERSION ||
      validated.id !== `${DAILY_COUNCIL_VERSION}:${day}:${validated.brief.id}`
    )
      throw new Error('Cannot publish an invalid daily council')
    const result = await prisma.council_daily_editions.updateMany({
      where: {
        id: dailyEditionKey(day),
        leaseToken: token,
        leaseUntil: { gt: now },
        status: 'generating',
      },
      data: {
        status: 'published',
        payload: JSON.parse(JSON.stringify(validated)),
        editionId: validated.id,
        publishedAt: now,
        leaseToken: null,
        leaseUntil: null,
      },
    })
    return result.count === 1
  },
  async release(day, token) {
    await prisma.council_daily_editions.updateMany({
      where: { id: dailyEditionKey(day), leaseToken: token, status: 'generating' },
      data: { status: 'failed', leaseToken: null, leaseUntil: null },
    })
  },
}
