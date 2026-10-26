import { CANONICAL_ROSTER_AGENT_IDS } from './pentacles-canonical-roster.js'

/**
 * The privacy gate in front of Pentacles' `agent_chart` table.
 *
 * `seed_agent_player` publishes a birth instant, latitude/longitude and the full chart to a
 * table Pentacles clients can read. Only canonical roster figures may be published; a forged
 * vessel is a person's private data (see `pentacles-canonical-roster.ts` for why the test is
 * an id allow-list rather than a read of `craftedBy`).
 *
 * This module has no I/O and imports nothing but the id list, so the service, the client and
 * the tests all share one definition and none of them can drift from it.
 */

const CANONICAL = new Set<string>(CANONICAL_ROSTER_AGENT_IDS)

/**
 * Fixed vocabulary: these strings reach logs and (for the error) possibly a response, so they
 * never interpolate the row. The caller logs the id separately.
 */
export const NOT_CANONICAL_REASON =
  'not on the canonical roster: user-created and unknown agents are never seeded into Pentacles'
export const USER_CREATED_MARKER_REASON =
  'carries a user-created marker despite a canonical id: refusing to seed'

// The same markers `app/api/agents/route.ts#formatAgentRow` uses for `isUserCreated`. The
// controller image cannot import from `lib/` or `app/`, so they are repeated here and the
// root spec pins them to that route's source.
const USER_CREATED_CRAFTED_BY = 'philosopher-stone-user'
const USER_CREATED_ERAS: ReadonlySet<string> = new Set(['user_created', 'MONICA_SPECIAL'])

/** True only for an exact, case-sensitive match of a canonical roster id. */
export function isCanonicalRosterAgentId(agentId: unknown): agentId is string {
  return typeof agentId === 'string' && CANONICAL.has(agentId)
}

/**
 * Why a `historical_agents` row may NOT be published, or `null` when it may. The positive test
 * (the id is on the roster) is the gate. A canonical id on a row that nevertheless says it is
 * user-created is contradictory, and the contradiction fails closed.
 *
 * Returns a reason string rather than a tagged union because the backend package compiles with
 * `strict: false`, where `!verdict.canonical` does not narrow a discriminated union.
 */
export function rosterExclusionReason(row: {
  agentId?: unknown
  craftedBy?: unknown
  historicalEra?: unknown
}): string | null {
  if (!isCanonicalRosterAgentId(row.agentId)) return NOT_CANONICAL_REASON
  if (
    row.craftedBy === USER_CREATED_CRAFTED_BY ||
    (typeof row.historicalEra === 'string' && USER_CREATED_ERAS.has(row.historicalEra))
  ) {
    return USER_CREATED_MARKER_REASON
  }
  return null
}

export class NonCanonicalRosterAgentError extends Error {
  constructor() {
    super(`Refusing to seed Pentacles agent_chart: ${NOT_CANONICAL_REASON}`)
    this.name = 'NonCanonicalRosterAgentError'
  }
}

/**
 * Throws unless `agentKey` is a canonical roster id. The message is fixed on purpose: it can
 * end up in a run result, and it must not echo a vessel's id or anything derived from it.
 */
export function assertCanonicalRosterAgent(agentKey: unknown): asserts agentKey is string {
  if (!isCanonicalRosterAgentId(agentKey)) throw new NonCanonicalRosterAgentError()
}
